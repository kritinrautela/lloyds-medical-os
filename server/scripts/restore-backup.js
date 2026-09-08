#!/usr/bin/env node
/*
 * Opens an encrypted backup into a plain database file you can inspect or put
 * into service by hand.
 *
 *   node server/scripts/restore-backup.js data/backups/hospital-20260908-2345.db.enc
 *
 * The key is taken from server/data/backup.key when this computer has one.
 * On another computer the script asks for the backup passphrase and unwraps
 * the key from backup.key.wrapped, which is looked for next to the backup
 * file and then in server/data/backups.
 *
 * The result is written as hospital.restored.db beside the backup. This
 * script never writes to the live database: putting a restored copy into
 * service is a decision for a person, made with the server stopped.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node server/scripts/restore-backup.js <backup file .db.enc>');
  process.exit(1);
}

const source = path.resolve(input);
if (!fs.existsSync(source)) {
  console.error(`No such file: ${source}`);
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const LIVE_DB = path.join(DATA_DIR, 'hospital.db');
const KEY_FILE = path.join(DATA_DIR, 'backup.key');
const target = path.join(path.dirname(source), 'hospital.restored.db');

if (path.resolve(target) === path.resolve(LIVE_DB)) {
  console.error('Refusing to write over the live database.');
  process.exit(1);
}

// Checked before anybody is asked for a passphrase.
{
  const head = Buffer.alloc(6);
  const fd = fs.openSync(source, 'r');
  const n = fs.readSync(fd, head, 0, 6, 0);
  fs.closeSync(fd);
  if (n < 6 || head.toString('latin1') !== 'LMEDB1') {
    console.error('This is not a Lloyds Medical OS backup file (the LMEDB1 header is missing).');
    process.exit(1);
  }
}

// The cryptography lives in lib/backup.js, but requiring that module through
// the database layer would open the live database, which this script must
// not touch. The file format is small enough to carry here.
const crypto = require('crypto');
const MAGIC = Buffer.from('LMEDB1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + IV_BYTES + TAG_BYTES;

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

function unwrapKey(passphrase, doc) {
  const wrappingKey = crypto.scryptSync(String(passphrase), Buffer.from(doc.salt, 'hex'), 32, {
    N: doc.N || 32768, r: doc.r || 8, p: doc.p || 1, maxmem: 128 * 1024 * 1024
  });
  const decipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, Buffer.from(doc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(doc.tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(doc.wrapped, 'hex')), decipher.final()]);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput;
    let answered = false;
    rl.question(question, (answer) => {
      answered = true;
      rl._writeToOutput = write;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    // Nothing typed and the input closed: run non-interactively, the
    // passphrase can be given as LLOYDS_BACKUP_PASSPHRASE instead.
    rl.on('close', () => { if (!answered) resolve(null); });
    rl._writeToOutput = function (text) {
      if (text.startsWith(question)) write.call(rl, question);
    };
  });
}

async function findKey() {
  if (fs.existsSync(KEY_FILE)) {
    const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      console.log(`Using the key file at ${KEY_FILE}.`);
      return Buffer.from(hex, 'hex');
    }
    console.log('The key file on this computer is not readable as a key; falling back to the passphrase.');
  }

  const candidates = [
    path.join(path.dirname(source), 'backup.key.wrapped'),
    path.join(DATA_DIR, 'backups', 'backup.key.wrapped')
  ];
  const wrappedPath = candidates.find((p) => fs.existsSync(p));
  if (!wrappedPath) {
    console.error(
      'No key file and no backup.key.wrapped found. A backup can only be opened on another computer\n' +
      'when an administrator set a backup passphrase before it was taken, which writes backup.key.wrapped\n' +
      'beside the backups. Copy that file next to this backup and run the script again.'
    );
    process.exit(1);
  }
  const doc = JSON.parse(fs.readFileSync(wrappedPath, 'utf8'));
  const passphrase = process.env.LLOYDS_BACKUP_PASSPHRASE || await askHidden('Backup passphrase: ');
  if (!passphrase) {
    console.error('No passphrase was given. Type it at the prompt, or set LLOYDS_BACKUP_PASSPHRASE when running without a terminal.');
    process.exit(1);
  }
  try {
    return unwrapKey(passphrase, doc);
  } catch (err) {
    console.error('That passphrase does not open the wrapped key.');
    process.exit(1);
  }
  return null;
}

async function main() {
  const key = await findKey();
  try {
    decryptFile(key, source, target);
  } catch (err) {
    try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch (e) { /* nothing to do */ }
    console.error(`The backup could not be opened: ${err.message}`);
    process.exit(1);
  }

  // A plain check that what came out is a database and that it is whole.
  const head = Buffer.alloc(16);
  const fd = fs.openSync(target, 'r');
  fs.readSync(fd, head, 0, 16, 0);
  fs.closeSync(fd);
  if (head.toString('utf8', 0, 15) !== 'SQLite format 3') {
    console.error('The file decrypted but is not a SQLite database. The backup may be damaged.');
    process.exit(1);
  }

  let summary = '';
  try {
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(target, sqlite3.OPEN_READONLY);
    const get = (sql) => new Promise((resolve, reject) => db.get(sql, (err, row) => (err ? reject(err) : resolve(row))));
    const integrity = await get('PRAGMA integrity_check');
    const patients = await get('SELECT COUNT(*) AS n FROM patients');
    const visits = await get('SELECT COUNT(*) AS n FROM visits');
    db.close();
    summary = `Integrity: ${integrity ? integrity.integrity_check : 'unknown'}. Patients: ${patients.n}. Visits: ${visits.n}.`;
  } catch (err) {
    summary = `The database opened but could not be checked further (${err.message}).`;
  }

  console.log(`
Restored copy written to:
  ${target}
${summary}

The live database at ${LIVE_DB} was not touched.
To put this copy into service: stop the server, move the live hospital.db aside
(keep it), copy hospital.restored.db to that path as hospital.db, then start
the server again.
`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
