const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { runQuery } = require('../db');
const backup = require('./backup');
const { installConfig } = require('./installConfig');

/*
 * The two ways a copy leaves the clinic that need nothing from the staff.
 *
 * USB stick: plug any stick into the clinic server and, within a minute, the
 * latest encrypted backup is written onto it in a folder of its own. Nothing
 * else on the stick is read or touched, and nothing on it is ever removed.
 * A stick that stays plugged in gets every nightly copy as well. Someone
 * carries the stick to town.
 *
 * Head office: where Lloyds runs a receiver (see offsite/cloudflare-receiver),
 * the same encrypted file is sent to it whenever the server has a connection.
 * The address and key are set at installation, never at the clinic.
 *
 * Both copies are the encrypted backup file. Without the backup passphrase a
 * stick found on the road, or a receiver read by a stranger, holds nothing
 * that can be opened.
 */

const STATE_FILE = path.join(__dirname, '..', 'data', 'offsite-state.json');
const STICK_FOLDER = 'Lloyds Medical OS backups';
const POLL_MS = 20 * 1000;
const HEAD_OFFICE_RETRY_MS = 30 * 60 * 1000;
const FRESH_MS = 10 * 60 * 1000;

let state = { usb: null, usb_volumes: {}, head_office: null };
let knownVolumes = new Set();
let copying = null;
let sending = null;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      state = { usb: null, usb_volumes: {}, head_office: null, ...parsed };
    }
  } catch (err) {
    state = { usb: null, usb_volumes: {}, head_office: null };
  }
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Off-site state could not be saved:', err.message);
  }
}

// Every copy, made or missed, goes into the audit trail and into the list the
// off-site page shows, so what happened is in one place for the clinic to read.
function log(action, actor, details, severity) {
  runQuery(
    `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
     VALUES (?, ?, ?, 'Off-site copy', ?, ?)`,
    [action, actor ? actor.full_name : 'System', actor ? actor.role : '', details, severity]
  ).catch(() => {});
  runQuery(
    `INSERT INTO sync_logs (sync_type, records_count, status, message) VALUES (?, 0, ?, ?)`,
    [action, severity === 'Success' ? 'Success' : 'Failed', details]
  ).catch(() => {});
}

function run(cmd, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      resolve(err ? '' : String(stdout || ''));
    });
  });
}

function writable(dir) {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function subdirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => path.join(dir, d.name));
  } catch (err) {
    return [];
  }
}

/*
 * Which mounted volumes are removable. Each platform answers differently,
 * and a volume that cannot be written to is left out: a read-only disk image
 * or a locked card is not somewhere a copy can go.
 */
async function removableVolumes() {
  const platform = process.platform;
  const found = [];

  if (platform === 'darwin') {
    let rootDev = null;
    try { rootDev = fs.statSync('/').dev; } catch (err) { rootDev = null; }
    for (const dir of subdirs('/Volumes')) {
      try {
        if (fs.lstatSync(dir).isSymbolicLink()) continue;
        if (fs.statSync(dir).dev === rootDev) continue;
      } catch (err) { continue; }
      const info = await run('diskutil', ['info', '-plist', dir]);
      const internal = /<key>Internal<\/key>\s*<true\/>/.test(info);
      const removable = /<key>(RemovableMedia|Removable|Ejectable)<\/key>\s*<true\/>/.test(info);
      const external = /<key>Internal<\/key>\s*<false\/>/.test(info);
      if (info && internal && !removable) continue;
      if (info && !removable && !external) continue;
      if (!writable(dir)) continue;
      found.push({ path: dir, label: path.basename(dir) });
    }
    return found;
  }

  if (platform === 'linux') {
    const candidates = [];
    for (const user of subdirs('/media')) candidates.push(user, ...subdirs(user));
    for (const user of subdirs('/run/media')) candidates.push(...subdirs(user));
    candidates.push(...subdirs('/mnt'));
    for (const dir of candidates) {
      let mounted = false;
      try {
        const parent = fs.statSync(path.dirname(dir)).dev;
        mounted = fs.statSync(dir).dev !== parent;
      } catch (err) { mounted = false; }
      if (!mounted || !writable(dir)) continue;
      found.push({ path: dir, label: path.basename(dir) });
    }
    return found;
  }

  if (platform === 'win32') {
    const out = await run('powershell', [
      '-NoProfile', '-Command',
      "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2' | ForEach-Object { $_.DeviceID + '|' + $_.VolumeName }"
    ], 15000);
    for (const line of out.split(/\r?\n/)) {
      const [id, label] = line.trim().split('|');
      if (!id || !/^[A-Z]:$/i.test(id)) continue;
      const dir = `${id}\\`;
      if (!writable(dir)) continue;
      found.push({ path: dir, label: (label || '').trim() || `Drive ${id}` });
    }
    return found;
  }

  return found;
}

function restoreNote() {
  return [
    'Lloyds Medical OS backups',
    '',
    'These files are encrypted copies of the clinic records.',
    'Each one is a complete copy at the moment named in the file.',
    'Nothing in them can be read without the backup passphrase set under Facility settings.',
    'backup.key.wrapped is the key to the copies, locked under that passphrase. Keep it with them.',
    '',
    'To bring the records back onto a clinic computer:',
    '  1. Start Lloyds Medical OS on that computer and sign in as an administrator.',
    '  2. Open Protected export and press "Bring records back from a copy".',
    '  3. Pick the newest .db.enc file in this folder.',
    '  4. If it is not the computer that made the copy, also pick backup.key.wrapped',
    '     from this folder and type the backup passphrase.',
    '  5. The records already on that computer are kept aside, not thrown away.',
    '',
    'Or hand the stick to Lloyds and they will do this for you.',
    '',
    'Older copies in this folder can be removed by hand once they are no longer wanted.',
    ''
  ].join('\r\n');
}

/*
 * Writes the latest backup onto a stick. With refresh, a backup older than
 * ten minutes is taken again first, so a stick that has just been plugged in
 * leaves with the records as they are now. The copy is written to a temporary
 * name and only renamed into place once its size matches, so a stick pulled
 * out mid-copy never holds a half file under the real name.
 */
async function copyToUsb(volumePath, actor, { refresh = true } = {}) {
  if (copying) return copying;
  copying = (async () => {
    const volumes = await removableVolumes();
    const target = volumePath ? volumes.find((v) => v.path === volumePath) : volumes[0];
    if (!target) throw new Error('No USB stick is plugged into the clinic server.');

    let latest = backup.listBackups()[0];
    if (refresh && (!latest || Date.now() - new Date(latest.at).getTime() > FRESH_MS)) {
      await backup.writeBackup(actor || null);
      latest = backup.listBackups()[0];
    }
    if (!latest) throw new Error('There is no backup to copy yet.');

    const folder = path.join(target.path, STICK_FOLDER);
    fs.mkdirSync(folder, { recursive: true });
    const source = path.join(backup.BACKUP_DIR, latest.name);
    const partial = path.join(folder, `${latest.name}.part`);
    const dest = path.join(folder, latest.name);
    fs.copyFileSync(source, partial);
    const written = fs.statSync(partial).size;
    if (written !== fs.statSync(source).size) {
      throw new Error('The copy on the stick came out the wrong size. The stick may be full or faulty.');
    }
    fs.renameSync(partial, dest);
    try { fs.writeFileSync(path.join(folder, 'HOW TO RESTORE.txt'), restoreNote()); } catch (err) { /* optional */ }
    // The wrapped key travels with the copies, so a replacement computer can
    // open them with nothing but the stick and the passphrase.
    try {
      if (fs.existsSync(backup.WRAPPED_KEY_FILE)) fs.copyFileSync(backup.WRAPPED_KEY_FILE, path.join(folder, 'backup.key.wrapped'));
    } catch (err) { /* the copy itself is what matters */ }

    const record = { at: new Date().toISOString(), volume: target.path, label: target.label, file: latest.name, size: written };
    state.usb = record;
    state.usb_volumes[target.path] = { file: latest.name, at: record.at };
    saveState();
    log('USB copy written', actor, `${latest.name} (${written} bytes) copied to the stick "${target.label}".`, 'Success');
    return record;
  })().finally(() => { copying = null; });
  return copying;
}

function headOfficeConfig() {
  const cfg = installConfig();
  const configured = !!(cfg.offsite_url && cfg.offsite_key && cfg.clinic_id);
  let host = '';
  try { host = configured ? new URL(cfg.offsite_url).host : ''; } catch (err) { host = ''; }
  return { ...cfg, configured, host };
}

/*
 * The wrapped key goes to head office once, and again whenever the passphrase
 * changes, so a copy held there can be brought back without the clinic's
 * computer. It opens nothing on its own.
 */
async function sendWrappedKey(cfg) {
  if (!fs.existsSync(backup.WRAPPED_KEY_FILE)) return;
  const mtime = fs.statSync(backup.WRAPPED_KEY_FILE).mtime.toISOString();
  if (state.head_office_key && state.head_office_key.mtime === mtime) return;
  const body = fs.readFileSync(backup.WRAPPED_KEY_FILE);
  const url = `${cfg.offsite_url.replace(/\/+$/, '')}/backups/${encodeURIComponent(cfg.clinic_id)}/backup.key.wrapped`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cfg.offsite_key}`, 'Content-Type': 'application/octet-stream', 'Content-Length': String(body.length) },
    body
  });
  if (!res.ok) throw new Error(`Head office answered HTTP ${res.status} for the key file.`);
  state.head_office_key = { mtime, at: new Date().toISOString() };
  saveState();
}

/*
 * Sends the latest backup to head office. Unless forced, a file that has
 * already been accepted is not sent again, so the half-hourly attempt costs
 * nothing on a quiet day.
 */
async function sendToHeadOffice({ force = false, actor = null } = {}) {
  const cfg = headOfficeConfig();
  if (!cfg.configured) {
    return { success: false, configured: false, message: 'Head office copies are not set up on this server.' };
  }
  if (sending) return sending;
  sending = (async () => {
    const latest = backup.listBackups()[0];
    if (!latest) return { success: false, configured: true, message: 'There is no backup to send yet.' };
    const last = state.head_office;
    if (!force && last && last.file === latest.name && last.status === 'Sent') {
      return { success: true, configured: true, message: 'The latest copy has already been sent.', ...last };
    }
    const url = `${cfg.offsite_url.replace(/\/+$/, '')}/backups/${encodeURIComponent(cfg.clinic_id)}/${encodeURIComponent(latest.name)}`;
    const now = new Date().toISOString();
    let result;
    try {
      const body = fs.readFileSync(path.join(backup.BACKUP_DIR, latest.name));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      let res;
      try {
        res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${cfg.offsite_key}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(body.length)
          },
          body,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`Head office answered HTTP ${res.status}.`);
      result = { at: now, file: latest.name, size: body.length, status: 'Sent', message: `${latest.name} was accepted by ${cfg.host}.` };
      log('Head office copy sent', actor, result.message, 'Success');
      await sendWrappedKey(cfg).catch(() => {});
    } catch (err) {
      let reason = err.message;
      if (err.name === 'AbortError') reason = 'Head office did not answer in time.';
      else if (err.cause || /fetch failed/i.test(err.message)) reason = 'No connection to head office.';
      result = { at: now, file: latest.name, size: latest.size, status: 'Not sent', message: reason };
      log('Head office copy not sent', actor, `${latest.name}: ${reason}`, 'Warning');
    }
    state.head_office = result;
    saveState();
    return { success: result.status === 'Sent', configured: true, ...result };
  })().finally(() => { sending = null; });
  return sending;
}

/*
 * The copy a phone carries. A backup older than ten minutes is taken again
 * first, the same as for a stick, and the hand-over is recorded: the file is
 * encrypted, but the audit trail still says who took a copy out and when.
 */
async function handoff(actor) {
  let latest = backup.listBackups()[0];
  if (!latest || Date.now() - new Date(latest.at).getTime() > FRESH_MS) {
    await backup.writeBackup(actor || null);
    latest = backup.listBackups()[0];
  }
  if (!latest) throw new Error('There is no backup to hand over yet.');
  log('Copy handed to a phone', actor, `${latest.name} (${latest.size} bytes) was fetched by ${actor ? actor.full_name : 'a device'} to carry out of the clinic.`, 'Success');
  return { name: latest.name, size: latest.size, path: path.join(backup.BACKUP_DIR, latest.name) };
}

async function status() {
  const cfg = headOfficeConfig();
  const sticks = await removableVolumes().catch(() => []);
  const latest = backup.listBackups()[0];
  return {
    phone: { to: cfg.support_whatsapp || '' },
    usb: {
      sticks: sticks.map((s) => {
        const onStick = state.usb_volumes[s.path];
        return { ...s, has_latest: !!(onStick && latest && onStick.file === latest.name && !onStick.failed) };
      }),
      last: state.usb
    },
    head_office: {
      configured: cfg.configured,
      host: cfg.host,
      clinic_id: cfg.configured ? cfg.clinic_id : '',
      last: state.head_office
    }
  };
}

// The short form for the sidebar, read from memory with no disk or shell work.
function summary() {
  const cfg = headOfficeConfig();
  return {
    usb_last_at: state.usb ? state.usb.at : null,
    usb_label: state.usb ? state.usb.label : null,
    head_office_configured: cfg.configured,
    head_office_last_at: state.head_office && state.head_office.status === 'Sent' ? state.head_office.at : null,
    head_office_status: state.head_office ? state.head_office.status : null
  };
}

function startOffsiteWatch() {
  loadState();
  removableVolumes().then((v) => { knownVolumes = new Set(v.map((x) => x.path)); }).catch(() => {});

  const tick = async () => {
    let volumes;
    try { volumes = await removableVolumes(); } catch (err) { return; }
    const present = new Set(volumes.map((v) => v.path));
    const latest = backup.listBackups()[0];
    for (const v of volumes) {
      const fresh = !knownVolumes.has(v.path);
      knownVolumes.add(v.path);
      const onStick = state.usb_volumes[v.path];
      const behind = latest && (!onStick || onStick.file !== latest.name);
      if (!fresh && !behind) continue;
      try {
        await copyToUsb(v.path, null, { refresh: fresh });
      } catch (err) {
        log('USB copy failed', null, `The copy to "${v.label}" failed: ${err.message}`, 'Warning');
        // Remember the attempt so a full stick is not retried every twenty seconds.
        state.usb_volumes[v.path] = { file: latest ? latest.name : '', at: new Date().toISOString(), failed: true };
      }
    }
    for (const known of Array.from(knownVolumes)) {
      if (!present.has(known)) {
        knownVolumes.delete(known);
        state.usb_volumes[known] = undefined;
      }
    }
  };
  const poll = setInterval(tick, POLL_MS);
  poll.unref();

  const retry = setInterval(() => { sendToHeadOffice({}).catch(() => {}); }, HEAD_OFFICE_RETRY_MS);
  retry.unref();
  const first = setTimeout(() => { sendToHeadOffice({}).catch(() => {}); }, 3 * 60 * 1000);
  first.unref();
}

module.exports = { removableVolumes, copyToUsb, sendToHeadOffice, handoff, status, summary, startOffsiteWatch, STICK_FOLDER };
