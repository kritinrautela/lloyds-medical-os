const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { generateProtectedExcel } = require('../exportExcel');
const { runQuery, getQuery, reopenDatabase, DB_PATH } = require('../db');
const sqlite3 = require('sqlite3');
const backup = require('../lib/backup');

const upload = multer({ dest: path.join(__dirname, '../data/uploads') });
const crypto = require('crypto');

/*
 * The database backup is the whole clinic on one file — every patient, every
 * visit, every allergy. It used to leave the building as a plain SQLite file
 * on a USB stick. Now it leaves encrypted with the same facility export
 * password that locks the Excel workbook, so a lost stick is a lost stick and
 * nothing more.
 *
 * Layout of a .lloydsbackup file:
 *   8 bytes  magic  "LLOYDSB1"
 *  16 bytes  salt   (scrypt, per file)
 *  12 bytes  iv     (AES-256-GCM)
 *  16 bytes  tag    (GCM authentication tag)
 *   rest     ciphertext
 * GCM means a file that has been altered, or a wrong password, fails cleanly
 * instead of restoring garbage.
 */
const MAGIC = Buffer.from('LLOYDSB1', 'ascii');
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'ascii');

function encryptBuffer(plain, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

function decryptBuffer(blob, password) {
  if (blob.length < 8 + 16 + 12 + 16 || !blob.subarray(0, 8).equals(MAGIC)) {
    throw new Error('This is not a Lloyds backup file.');
  }
  const salt = blob.subarray(8, 24);
  const iv = blob.subarray(24, 36);
  const tag = blob.subarray(36, 52);
  const body = blob.subarray(52);
  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch (err) {
    throw new Error('The password is wrong, or the file has been altered since it was made.');
  }
}

function isSqlite(buffer) {
  return buffer.length > 100 && buffer.subarray(0, 16).equals(SQLITE_HEADER);
}

function logEvent(action_type, user_name, details, severity) {
  return runQuery(
    `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
     VALUES (?, ?, 'Staff', 'Records & Export', ?, ?)`,
    [action_type, user_name || 'Unattributed', details, severity || 'Info']
  ).catch((err) => console.error('Audit log failed:', err.message));
}

/*
 * GET /api/export/excel
 *
 * The workbook is always encrypted with the facility's configured password,
 * held server-side. The caller must supply that same password to download it,
 * so a member of staff cannot mint a copy locked with a password only they
 * know. Both a granted and a refused attempt are written to the audit trail.
 */
router.get('/excel', requirePermission('export.download'), async (req, res) => {
  const requestedBy = (req.query.by || '').toString().trim() || 'Unattributed';

  try {
    const settings = await getQuery('SELECT export_password FROM hospital_settings LIMIT 1');
    const configured = settings && settings.export_password ? settings.export_password : '';
    const supplied = (req.query.password || '').toString();

    // Without a configured password the workbook cannot be encrypted, and an
    // unencrypted copy of the whole patient record is exactly what this export
    // exists to prevent. Refuse, and say what to do about it.
    if (!configured) {
      await logEvent(
        'Export Refused',
        requestedBy,
        'A workbook export was refused because no facility export password has been set.',
        'Warning'
      );
      return res.status(409).json({
        success: false,
        message:
          'No export password has been set for this facility, so the workbook cannot be encrypted. An administrator must set one in Facility settings before records can be exported.'
      });
    }

    if (supplied !== configured) {
      await logEvent(
        'Export Refused',
        requestedBy,
        'A protected workbook export was refused: the supplied password did not match the facility export password.',
        'Warning'
      );
      return res.status(403).json({
        success: false,
        message: 'Incorrect export password. This attempt has been recorded in the audit trail.'
      });
    }

    const excelBuffer = await generateProtectedExcel(configured);

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `Lloyds_Clinic_Audit_${todayStr}.xlsx`;

    await logEvent(
      'Protected Excel Export',
      requestedBy,
      `Encrypted, read-only audit workbook generated (${filename}).`,
      'Success'
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(excelBuffer);
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/export/backup-db — the whole database, encrypted, for a USB stick
router.get('/backup-db', requirePermission('export.download'), async (req, res) => {
  try {
    const dbPath = path.join(__dirname, '../data/hospital.db');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, message: 'Database file not found' });
    }

    const who = req.user.full_name;
    const settings = await getQuery('SELECT export_password FROM hospital_settings LIMIT 1');
    const configured = settings && settings.export_password ? settings.export_password : '';
    const supplied = (req.query.password || '').toString();

    if (!configured) {
      await logEvent('Backup Refused', who, 'A database backup was refused because no facility export password has been set.', 'Warning');
      return res.status(409).json({
        success: false,
        message: 'No export password has been set, so the backup cannot be encrypted. An administrator sets one in Facility settings.'
      });
    }
    if (supplied !== configured) {
      await logEvent('Backup Refused', who, 'A database backup was refused: the supplied password did not match the facility export password.', 'Warning');
      return res.status(403).json({ success: false, message: 'Incorrect export password. This attempt has been recorded in the audit trail.' });
    }

    // A consistent snapshot: SQLite's own backup API copies the pages in a
    // way that is safe while the clinic is still writing.
    const snapshot = path.join(__dirname, `../data/.snapshot_${Date.now()}.db`);
    await runQuery(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
    const plain = fs.readFileSync(snapshot);
    fs.rmSync(snapshot, { force: true });

    const encrypted = encryptBuffer(plain, configured);
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await logEvent('Database Backup', who, `Encrypted database backup downloaded (${(encrypted.length / 1024).toFixed(0)} KB).`, 'Success');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="clinic_backup_${todayStr}.lloydsbackup"`);
    res.send(encrypted);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * POST /api/export/restore-db
 *
 * Brings the records back from a copy, on this computer or a replacement.
 * Three kinds of file are accepted: the nightly and off-site copies
 * (hospital-*.db.enc, locked with the backup key), the older download from
 * this page (.lloydsbackup, locked with the export password), and a plain
 * database file. The copy is decrypted to a scratch file, opened on its own
 * and checked before anything is touched, the current database is put aside
 * under a dated name, and the server switches to the restored records
 * without a restart. Nothing is ever deleted here.
 */
const LMEDB = Buffer.from('LMEDB1', 'ascii');
const RESTORE_UPLOAD = path.join(__dirname, '../data/restore-upload.bin');
const RESTORE_CANDIDATE = path.join(__dirname, '../data/hospital.restore-candidate.db');
const restoreFiles = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } })
  .fields([{ name: 'db_file', maxCount: 1 }, { name: 'key_file', maxCount: 1 }]);

function inspectDatabase(file) {
  return new Promise((resolve, reject) => {
    const probe = new sqlite3.Database(file, sqlite3.OPEN_READONLY, (openErr) => {
      if (openErr) return reject(openErr);
      const get = (sql) => new Promise((res, rej) => probe.get(sql, (err, row) => (err ? rej(err) : res(row))));
      (async () => {
        const check = await get('PRAGMA integrity_check');
        if (!check || check.integrity_check !== 'ok') throw new Error('The copy failed its integrity check. It may be damaged.');
        const patients = await get('SELECT COUNT(*) AS n FROM patients');
        const visits = await get('SELECT COUNT(*) AS n, MAX(visit_date) AS latest FROM visits');
        return { patients: patients ? patients.n : 0, visits: visits ? visits.n : 0, latest_visit: visits ? visits.latest : null };
      })()
        .then((facts) => probe.close(() => resolve(facts)))
        .catch((err) => probe.close(() => reject(err)));
    });
  });
}

/*
 * Every key that could open a backup-key copy, in the order to try them: the
 * key on this computer, then the passphrase against the key file that came
 * with the copy, the one kept here, and the one saved in the settings.
 */
async function unlockBackupCopy(source, passphrase, keyUpload) {
  const attempts = [];
  if (backup.keyFileExists()) attempts.push({ key: backup.dataKey(), how: 'the key on this computer' });
  if (passphrase) {
    const records = [];
    if (keyUpload) records.push(keyUpload.toString('utf8'));
    if (fs.existsSync(backup.WRAPPED_KEY_FILE)) records.push(fs.readFileSync(backup.WRAPPED_KEY_FILE, 'utf8'));
    const row = await getQuery('SELECT backup_key_wrapped FROM hospital_settings LIMIT 1').catch(() => null);
    if (row && row.backup_key_wrapped) records.push(row.backup_key_wrapped);
    for (const record of records) {
      try { attempts.push({ key: backup.unwrapKey(passphrase, record), how: 'the passphrase' }); } catch (err) { /* wrong passphrase for this record */ }
    }
  }
  for (const attempt of attempts) {
    try {
      backup.decryptFile(attempt.key, source, RESTORE_CANDIDATE);
      return attempt.how;
    } catch (err) { /* try the next key */ }
  }
  if (!passphrase) {
    throw new Error('This copy was locked on another computer. Type the backup passphrase, and pick the backup.key.wrapped file that sits beside the copy on the stick.');
  }
  throw new Error('The passphrase did not open this copy. Check it, and that the key file is the one from the same clinic.');
}

router.post('/restore-db', requirePermission('settings.clearRecords'), restoreFiles, async (req, res) => {
  try {
    const files = req.files || {};
    const uploaded = files.db_file && files.db_file[0] ? files.db_file[0] : null;
    const keyUpload = files.key_file && files.key_file[0] ? files.key_file[0].buffer : null;
    if (!uploaded) return res.status(400).json({ success: false, message: 'Choose the copy to bring back.' });

    const who = req.user.full_name;
    const raw = uploaded.buffer;
    const secret = String(req.body.passphrase || req.body.password || '');
    let unlockedWith = 'nothing, it was not locked';

    if (raw.subarray(0, LMEDB.length).equals(LMEDB)) {
      fs.writeFileSync(RESTORE_UPLOAD, raw, { mode: 0o600 });
      unlockedWith = await unlockBackupCopy(RESTORE_UPLOAD, secret, keyUpload);
    } else if (raw.subarray(0, 8).equals(MAGIC)) {
      // The older download from this page, locked with the export password.
      if (!secret) return res.status(400).json({ success: false, message: 'This file is locked with the export password it was made with. Type it and choose the file again.' });
      fs.writeFileSync(RESTORE_CANDIDATE, decryptBuffer(raw, secret), { mode: 0o600 });
      unlockedWith = 'the export password';
    } else if (isSqlite(raw)) {
      fs.writeFileSync(RESTORE_CANDIDATE, raw, { mode: 0o600 });
    } else {
      await logEvent('Restore Refused', who, `A restore was refused: ${uploaded.originalname} is neither a clinic copy nor a database.`, 'Warning');
      return res.status(400).json({ success: false, message: 'That file is not a clinic copy. Nothing was changed.' });
    }

    const head = Buffer.alloc(16);
    const fd = fs.openSync(RESTORE_CANDIDATE, 'r');
    try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }
    if (!head.equals(SQLITE_HEADER)) {
      await logEvent('Restore Refused', who, 'A restore was refused: the unlocked file was not a database.', 'Warning');
      return res.status(400).json({ success: false, message: 'The file opened but does not contain clinic records. Nothing was changed.' });
    }

    const facts = await inspectDatabase(RESTORE_CANDIDATE);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const asidePath = path.join(path.dirname(DB_PATH), `hospital_pre_restore_${stamp}.db`);

    await reopenDatabase(() => {
      // With no connection open: the live file goes aside under a dated
      // name, any leftover journal beside it goes aside too, and the checked
      // copy takes its place.
      if (fs.existsSync(DB_PATH)) fs.renameSync(DB_PATH, asidePath);
      for (const suffix of ['-wal', '-shm', '-journal']) {
        if (fs.existsSync(DB_PATH + suffix)) fs.renameSync(DB_PATH + suffix, asidePath + suffix);
      }
      fs.copyFileSync(RESTORE_CANDIDATE, DB_PATH);
    });

    // The copy carries whatever sign-ins were live when it was made, some of
    // them months old. They all end now; only the person doing the restore
    // stays signed in, and only if their sign-in is in the copy at all.
    await runQuery(
      `UPDATE sessions SET expires_at = datetime('now', '-1 minute') WHERE token != ?`,
      [req.sessionToken || '']
    );
    const stillSignedIn = !!(await getQuery('SELECT 1 FROM sessions WHERE token = ?', [req.sessionToken || '']));

    await logEvent(
      'Database Restored', who,
      `The records were replaced from ${uploaded.originalname} (${facts.patients} patients, ${facts.visits} visits, unlocked with ${unlockedWith}). The previous records are kept at ${path.basename(asidePath)}.`,
      'Warning'
    );

    res.json({
      success: true,
      message: `The records are back: ${facts.patients} patients and ${facts.visits} visits${facts.latest_visit ? `, up to ${facts.latest_visit}` : ''}. ${stillSignedIn ? 'Everyone else has been signed out.' : 'Everyone has been signed out; sign in again to carry on.'}`,
      ...facts,
      signed_out: !stillSignedIn,
      previous_copy: path.basename(asidePath)
    });
  } catch (err) {
    console.error('Restore DB error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
