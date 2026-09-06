const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { generateProtectedExcel } = require('../exportExcel');
const { runQuery, getQuery } = require('../db');

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

// POST /api/export/restore-db — replace the live database from a backup file
router.post('/restore-db', upload.single('db_file'), requirePermission('settings.clearRecords'), async (req, res) => {
  const uploaded = req.file ? req.file.path : null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const who = req.user.full_name;
    const raw = fs.readFileSync(uploaded);
    let database;

    if (raw.subarray(0, 8).equals(MAGIC)) {
      // Encrypted: the password is whichever export password was set when
      // the backup was made, which is normally the current one.
      const password = (req.body.password || '').toString();
      if (!password) {
        return res.status(400).json({ success: false, message: 'This backup is encrypted. Type the export password it was made with.' });
      }
      database = decryptBuffer(raw, password);
    } else if (isSqlite(raw)) {
      // An older, unencrypted backup is still accepted so nothing made before
      // this version is lost.
      database = raw;
    } else {
      await logEvent('Restore Refused', who, 'A restore was refused: the file was neither a Lloyds backup nor a database.', 'Warning');
      return res.status(400).json({ success: false, message: 'That file is not a clinic backup. Nothing was changed.' });
    }

    if (!isSqlite(database)) {
      await logEvent('Restore Refused', who, 'A restore was refused: the decrypted file was not a database.', 'Warning');
      return res.status(400).json({ success: false, message: 'The file opened but does not contain a clinic database. Nothing was changed.' });
    }

    const targetDbPath = path.join(__dirname, '../data/hospital.db');
    const asidePath = path.join(__dirname, `../data/hospital_pre_restore_${Date.now()}.db`);

    // The current database is copied aside first, so a restore from the wrong
    // file is always reversible.
    if (fs.existsSync(targetDbPath)) fs.copyFileSync(targetDbPath, asidePath);
    fs.writeFileSync(targetDbPath, database);

    await logEvent('Database Restored', who, `The database was replaced from a backup. The previous copy is at ${path.basename(asidePath)}.`, 'Warning');

    res.json({
      success: true,
      message: 'Database restored. The previous database was saved alongside it before the overwrite. Restart the server to load the restored records.'
    });
  } catch (err) {
    console.error('Restore DB error:', err);
    res.status(400).json({ success: false, message: err.message });
  } finally {
    if (uploaded && fs.existsSync(uploaded)) fs.rmSync(uploaded, { force: true });
  }
});

module.exports = router;
