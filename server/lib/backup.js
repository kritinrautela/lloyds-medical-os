/*
 * Encrypted copies of the database, kept on this computer.
 *
 * The threat is not a stranger on the internet: the clinic is offline. It is
 * the ordinary disasters of a small facility. A disk that fails, a computer
 * that is stolen, a laptop that goes to a repair shop with the clinic's whole
 * patient history on it. So a backup is taken every evening, and each copy is
 * encrypted before it touches the disk, so a backup that leaves the building
 * on a memory stick is unreadable without the key.
 *
 * There are two ways to open a backup:
 *
 *   1. The data key in data/backup.key, created on first use. A backup opened
 *      on the same computer needs nothing else.
 *   2. A passphrase set by an administrator. The data key is wrapped under a
 *      key derived from that passphrase and stored alongside the backups, so
 *      a copy can be restored on a different machine from the passphrase
 *      alone. Without a passphrase, a backup is only readable where the key
 *      file lives; the interface says so.
 *
 * Restoring is deliberately a separate, manual script (scripts/restore-backup.js)
 * that never touches the live database.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runQuery, getQuery } = require('../db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const KEY_FILE = path.join(DATA_DIR, 'backup.key');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const WRAPPED_KEY_FILE = path.join(BACKUP_DIR, 'backup.key.wrapped');

const MAGIC = Buffer.from('LMEDB1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + IV_BYTES + TAG_BYTES;

const KEEP_RECENT = 14;
const KEEP_MONTHS = 12;
const MIN_PASSPHRASE = 12;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
}

// The data key. Made once, read thereafter, never written to a log.
function dataKey() {
  ensureDirs();
  if (fs.existsSync(KEY_FILE)) {
    const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
      throw new Error('data/backup.key is not a 32-byte hex key. Move it aside to have a new one made.');
    }
    return Buffer.from(hex, 'hex');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex') + '\n', { mode: 0o600 });
  fs.chmodSync(KEY_FILE, 0o600);
  return key;
}

function keyFileExists() {
  return fs.existsSync(KEY_FILE);
}

/*
 * Wrapping the data key under a passphrase. The result is a small JSON
 * document holding everything needed to unwrap it again except the
 * passphrase itself.
 */
function wrapKey(passphrase, key) {
  const salt = crypto.randomBytes(16);
  const wrappingKey = crypto.scryptSync(String(passphrase), salt, 32, SCRYPT);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);
  const wrapped = Buffer.concat([cipher.update(key), cipher.final()]);
  return {
    v: 1,
    kdf: 'scrypt',
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    wrapped: wrapped.toString('hex')
  };
}

function unwrapKey(passphrase, record) {
  const doc = typeof record === 'string' ? JSON.parse(record) : record;
  const wrappingKey = crypto.scryptSync(String(passphrase), Buffer.from(doc.salt, 'hex'), 32, {
    N: doc.N || SCRYPT.N, r: doc.r || SCRYPT.r, p: doc.p || SCRYPT.p, maxmem: SCRYPT.maxmem
  });
  const decipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, Buffer.from(doc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(doc.tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(doc.wrapped, 'hex')), decipher.final()]);
}

async function setPassphrase(passphrase, actor) {
  const text = String(passphrase || '');
  if (text.length < MIN_PASSPHRASE) {
    const err = new Error(`Choose a backup passphrase of at least ${MIN_PASSPHRASE} characters.`);
    err.status = 400;
    throw err;
  }
  const record = wrapKey(text, dataKey());
  const json = JSON.stringify(record);
  const setAt = new Date().toISOString();
  await runQuery(
    'UPDATE hospital_settings SET backup_key_wrapped = ?, backup_passphrase_set_at = ?',
    [json, setAt]
  );
  ensureDirs();
  fs.writeFileSync(WRAPPED_KEY_FILE, json + '\n', { mode: 0o600 });
  fs.chmodSync(WRAPPED_KEY_FILE, 0o600);
  await runQuery(
    `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
     VALUES ('Backup passphrase set', ?, ?, 'Security', 'The backup passphrase was set. Backups can now be restored on another computer from the passphrase.', 'Info')`,
    [actor ? actor.full_name : 'Unattributed', actor ? actor.role : '']
  ).catch(() => {});
  return setAt;
}

// hospital-YYYYMMDD-HHMM.db.enc, in local clinic time.
function backupName(now) {
  const p = (n) => String(n).padStart(2, '0');
  return `hospital-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.db.enc`;
}

function sqlLiteral(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

/*
 * Encrypts one file into another. Header: the magic, the iv, the tag; the tag
 * is only known once the whole file has gone through, so its slot is written
 * last.
 */
function encryptFile(key, sourcePath, targetPath) {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const fd = fs.openSync(targetPath, 'w', 0o600);
    let position = HEADER_BYTES;
    try {
      fs.writeSync(fd, Buffer.concat([MAGIC, iv, Buffer.alloc(TAG_BYTES)]), 0, HEADER_BYTES, 0);
    } catch (err) {
      fs.closeSync(fd);
      return reject(err);
    }
    const input = fs.createReadStream(sourcePath);
    input.on('error', (err) => { fs.closeSync(fd); reject(err); });
    input.on('data', (chunk) => {
      const out = cipher.update(chunk);
      if (out.length) {
        fs.writeSync(fd, out, 0, out.length, position);
        position += out.length;
      }
    });
    input.on('end', () => {
      try {
        const out = cipher.final();
        if (out.length) {
          fs.writeSync(fd, out, 0, out.length, position);
          position += out.length;
        }
        fs.writeSync(fd, cipher.getAuthTag(), 0, TAG_BYTES, MAGIC.length + IV_BYTES);
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        resolve(position);
      } catch (err) {
        fs.closeSync(fd);
        reject(err);
      }
    });
  });
}

function decryptFile(key, sourcePath, targetPath) {
  const fd = fs.openSync(sourcePath, 'r');
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    const read = fs.readSync(fd, header, 0, HEADER_BYTES, 0);
    if (read < HEADER_BYTES || !header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('This is not a Lloyds Medical OS backup file (the LMEDB1 header is missing).');
    }
    const iv = header.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
    const tag = header.subarray(MAGIC.length + IV_BYTES, HEADER_BYTES);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const out = fs.openSync(targetPath, 'w', 0o600);
    try {
      const chunk = Buffer.alloc(64 * 1024);
      let position = HEADER_BYTES;
      for (;;) {
        const n = fs.readSync(fd, chunk, 0, chunk.length, position);
        if (n === 0) break;
        position += n;
        const plain = decipher.update(chunk.subarray(0, n));
        if (plain.length) fs.writeSync(out, plain);
      }
      // final() is where a wrong key or a tampered file is found out.
      const last = decipher.final();
      if (last.length) fs.writeSync(out, last);
      fs.fsyncSync(out);
    } finally {
      fs.closeSync(out);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function parseName(name) {
  const m = /^hospital-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})?\.db\.enc$/.exec(name);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
}

function listBackups() {
  ensureDirs();
  const files = [];
  for (const name of fs.readdirSync(BACKUP_DIR)) {
    const when = parseName(name);
    if (!when) continue;
    let stat;
    try { stat = fs.statSync(path.join(BACKUP_DIR, name)); } catch (err) { continue; }
    files.push({ name, size: stat.size, at: when.toISOString() });
  }
  files.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return files;
}

/*
 * What to keep: the fourteen most recent copies, and the first copy of each
 * month for the past year, so a mistake noticed weeks later can still be
 * undone. Nothing under a day old is ever removed, whatever the count.
 */
function prune() {
  const files = listBackups();
  const keep = new Set(files.slice(0, KEEP_RECENT).map((f) => f.name));
  const firstOfMonth = new Map();
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() - KEEP_MONTHS);
  for (const f of files) {
    const when = new Date(f.at);
    if (when < horizon) continue;
    const month = `${when.getFullYear()}-${when.getMonth()}`;
    const current = firstOfMonth.get(month);
    if (!current || f.at < current.at) firstOfMonth.set(month, f);
  }
  for (const f of firstOfMonth.values()) keep.add(f.name);

  const removed = [];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const f of files) {
    if (keep.has(f.name) || new Date(f.at).getTime() > dayAgo) continue;
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, f.name));
      removed.push(f.name);
    } catch (err) {
      console.error(`Could not remove old backup ${f.name}:`, err.message);
    }
  }
  return removed;
}

let running = null;

/*
 * Takes one backup. VACUUM INTO writes a consistent, compacted copy of the
 * database while it stays open for use, which is then encrypted and removed.
 */
async function writeBackup(actor) {
  if (running) return running;
  running = (async () => {
    ensureDirs();
    const now = new Date();
    let name = backupName(now);
    if (fs.existsSync(path.join(BACKUP_DIR, name))) {
      name = name.replace(/\.db\.enc$/, `${String(now.getSeconds()).padStart(2, '0')}.db.enc`);
    }
    const target = path.join(BACKUP_DIR, name);
    const temp = path.join(BACKUP_DIR, `.snapshot-${process.pid}-${Date.now()}.db`);
    const who = actor ? actor.full_name : 'System schedule';
    const role = actor ? actor.role : '';
    try {
      const key = dataKey();
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
      await runQuery(`VACUUM INTO ${sqlLiteral(temp)}`);
      const size = await encryptFile(key, temp, target);
      fs.unlinkSync(temp);
      const removed = prune();
      await runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Backup written', ?, ?, 'Security', ?, 'Success')`,
        [who, role, `Encrypted backup ${name} written (${size} bytes).` + (removed.length ? ` Removed ${removed.length} older cop${removed.length === 1 ? 'y' : 'ies'}.` : '')]
      ).catch(() => {});
      return { name, size, at: now.toISOString() };
    } catch (err) {
      try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch (e) { /* nothing to do */ }
      try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch (e) { /* nothing to do */ }
      await runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Backup failed', ?, ?, 'Security', ?, 'Warning')`,
        [who, role, `The backup could not be written: ${err.message}`]
      ).catch(() => {});
      throw err;
    } finally {
      running = null;
    }
  })();
  return running;
}

async function status() {
  const files = listBackups();
  let setAt = null;
  try {
    const row = await getQuery('SELECT backup_passphrase_set_at FROM hospital_settings LIMIT 1');
    setAt = row ? row.backup_passphrase_set_at || null : null;
  } catch (err) {
    setAt = null;
  }
  return {
    key_file: keyFileExists(),
    passphrase_set_at: setAt,
    last_at: files.length ? files[0].at : null,
    count: files.length,
    files
  };
}

/*
 * Every day at 23:45 local time, after the shift has closed; and once shortly
 * after start-up if the last copy is more than a day old, which covers a
 * computer that was switched off at the usual hour.
 */
const BACKUP_HOUR = 23;
const BACKUP_MINUTE = 45;

function msUntilNextRun(from) {
  const next = new Date(from);
  next.setHours(BACKUP_HOUR, BACKUP_MINUTE, 0, 0);
  if (next <= from) next.setDate(next.getDate() + 1);
  return next - from;
}

function startBackupSchedule() {
  const scheduleNext = () => {
    const timer = setTimeout(async () => {
      try { await writeBackup(null); } catch (err) { console.error('Scheduled backup failed:', err.message); }
      scheduleNext();
    }, msUntilNextRun(new Date()));
    timer.unref();
  };
  scheduleNext();

  const catchUp = setTimeout(async () => {
    try {
      const files = listBackups();
      const fresh = files.length && (Date.now() - new Date(files[0].at).getTime()) < 24 * 60 * 60 * 1000;
      if (!fresh) await writeBackup(null);
    } catch (err) {
      console.error('Start-up backup failed:', err.message);
    }
  }, 2 * 60 * 1000);
  catchUp.unref();
}

module.exports = {
  KEY_FILE,
  BACKUP_DIR,
  WRAPPED_KEY_FILE,
  MIN_PASSPHRASE,
  dataKey,
  keyFileExists,
  wrapKey,
  unwrapKey,
  setPassphrase,
  writeBackup,
  listBackups,
  prune,
  status,
  decryptFile,
  startBackupSchedule
};
