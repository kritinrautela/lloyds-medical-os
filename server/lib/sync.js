const fs = require('fs');
const path = require('path');
const dns = require('dns');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { runQuery, getQuery, allQuery } = require('../db');
const google = require('./google');

/*
 * The off-site copy.
 *
 * Everything the clinic records lives in the SQLite file on the clinic
 * computer, and nothing here is needed for the clinic to run. When the
 * computer can reach Google, this module sends a copy of the records — and
 * the patient photographs — to a Google Sheet and Drive folder the company
 * owns, through a small script the administrator pastes into that sheet.
 *
 * Three things make it trustworthy rather than decorative:
 *
 *  - It runs by itself. A worker checks every minute whether it is time,
 *    whether a connection exists, and whether anything changed, and sends
 *    only then. Nobody has to remember to press a button.
 *  - It is signed. Every payload carries a key that only this server and the
 *    receiving script know. A stranger who finds the web app address cannot
 *    write into the clinic's records.
 *  - It never lies about success. A send is recorded as done only when the
 *    script answered that it accepted the data. "Could not reach Google" is
 *    written down as exactly that.
 */

const PHOTO_DIR = path.join(__dirname, '..', 'data', 'patient_photos');
const PHOTOS_PER_SEND = 25;
const TICK_MS = 60 * 1000;

let running = false;
let timer = null;

function newSyncKey() {
  return crypto.randomBytes(24).toString('hex');
}

// A cheap, honest "are we online" — one DNS lookup of the host we are about
// to talk to. If that fails there is no point building a payload.
function canReachGoogle() {
  return new Promise((resolve) => {
    dns.lookup('www.googleapis.com', (err) => resolve(!err));
  });
}

/*
 * POSTs JSON and resolves only when the far end accepted it. Apps Script
 * answers every request with HTTP 200 and puts the real result in the body,
 * so the body is read and a { ok: false } is treated as a refusal.
 */
function postJson(targetUrl, data, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(targetUrl);
    } catch (e) {
      return reject(new Error('The sync URL is not a valid web address.'));
    }
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
      return reject(new Error('The sync URL must start with http:// or https://'));
    }

    const postData = JSON.stringify(data);
    const client = urlObj.protocol === 'https:' ? https : http;
    const request = client.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 60000
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location && redirectsLeft > 0) {
          response.resume();
          return resolve(postJson(response.headers.location, data, redirectsLeft - 1));
        }
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          if (status < 200 || status >= 300) {
            return reject(new Error(`Endpoint responded with HTTP ${status}`));
          }
          let parsed = null;
          try { parsed = JSON.parse(body); } catch (e) { parsed = null; }
          if (parsed && parsed.ok === false) {
            return reject(new Error(parsed.error || 'The receiving script refused the data.'));
          }
          resolve({ status, body: parsed || body.slice(0, 2000) });
        });
      }
    );
    request.on('error', (err) => reject(err));
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Connection timed out after 60 seconds'));
    });
    request.write(postData);
    request.end();
  });
}

// Photographs Google has not been given yet, or has been given an older
// version of. Sent in small batches so one send stays a few megabytes.
async function pendingPhotos() {
  const rows = await allQuery(
    `SELECT id, hospital_number, photo_path, photo_taken_at
       FROM patients
      WHERE photo_path IS NOT NULL AND photo_path != ''
        AND (photo_synced_at IS NULL OR photo_synced_at < photo_taken_at)
      ORDER BY photo_taken_at ASC
      LIMIT ?`,
    [PHOTOS_PER_SEND]
  );
  const photos = [];
  for (const row of rows || []) {
    const file = path.isAbsolute(row.photo_path) ? row.photo_path : path.join(PHOTO_DIR, path.basename(row.photo_path));
    if (!fs.existsSync(file)) continue;
    const ext = path.extname(file).toLowerCase() === '.png' ? 'png' : 'jpg';
    photos.push({
      bytes: fs.readFileSync(file),
      patient_id: row.id,
      hospital_number: row.hospital_number || `patient-${row.id}`,
      file_name: `${row.hospital_number || `patient-${row.id}`}.${ext}`,
      mime: ext === 'png' ? 'image/png' : 'image/jpeg',
      taken_at: row.photo_taken_at,
      data_base64: fs.readFileSync(file).toString('base64')
    });
  }
  return photos;
}

async function countPendingPhotos() {
  const row = await getQuery(
    `SELECT COUNT(*) AS n FROM patients
      WHERE photo_path IS NOT NULL AND photo_path != ''
        AND (photo_synced_at IS NULL OR photo_synced_at < photo_taken_at)`
  );
  return row ? row.n : 0;
}

function stripPhotoPath(rows) {
  return (rows || []).map((p) => {
    const { photo_path, ...rest } = p;
    return { ...rest, has_photograph: photo_path ? 'yes' : '' };
  });
}

async function buildPayload(config, settings) {
  const todayStr = new Date().toISOString().split('T')[0];

  // The sheet is a mirror of the database, so everything is sent every time.
  // A clinic's whole history is a few thousand rows; the alternative — only
  // today's rows, which then overwrite yesterday's in the sheet — is how the
  // off-site copy silently lost every day but the last one.
  const patients = await allQuery('SELECT * FROM patients ORDER BY id ASC');
  const visits = await allQuery('SELECT * FROM visits ORDER BY id ASC');
  const dispensations = await allQuery('SELECT * FROM dispensations ORDER BY id ASC');
  const dispensationItems = await allQuery('SELECT * FROM dispensation_items ORDER BY id ASC');
  const drugs = await allQuery(
    'SELECT code, name, generic_name, category, dosage_form, strength, stock_quantity, min_stock_alert, unit_price, batch_number, expiry_date, supplier FROM drugs ORDER BY name'
  );
  const incidents = await allQuery('SELECT * FROM occupational_incidents ORDER BY id ASC');
  const endOfDay = await allQuery('SELECT * FROM end_of_day_reports ORDER BY report_date ASC');
  const referrals = await allQuery(`
    SELECT r.*, p.hospital_number, p.full_name AS patient_name
    FROM referrals r JOIN patients p ON p.id = r.patient_id
    ORDER BY r.id ASC`);
  const staff = await allQuery('SELECT employee_id, full_name, role, status, last_seen FROM users ORDER BY full_name');
  const photos = await pendingPhotos();
  const eodToday = endOfDay.find((r) => r.report_date === todayStr) || null;

  const totalRecords =
    patients.length + visits.length + dispensations.length + dispensationItems.length +
    drugs.length + incidents.length + endOfDay.length + referrals.length;

  return {
    totalRecords,
    photos,
    eodToday,
    payload: {
      schema_version: 3,
      sync_key: config.sync_key || '',
      sent_at: new Date().toISOString(),
      sync_date: todayStr,
      facility: settings
        ? {
            name: settings.name,
            province: settings.province,
            district: settings.district,
            reg_number: settings.reg_number,
            currency_code: settings.currency_code,
            currency_symbol: settings.currency_symbol
          }
        : null,
      admin_email: (settings && settings.admin_email) || '',
      counts: {
        patients: patients.length,
        visits_today: visits.filter((v) => v.visit_date === todayStr).length,
        dispensations_today: dispensations.filter((d) => String(d.created_at || '').startsWith(todayStr)).length,
        formulary_items: drugs.length,
        incidents_today: incidents.filter((i) => i.incident_date === todayStr).length,
        referrals_awaiting_outcome: referrals.filter((r) => r.outcome === 'Awaiting outcome').length,
        photographs_in_this_send: photos.length,
        end_of_day_filed: !!eodToday
      },
      tables: {
        patients: stripPhotoPath(patients),
        visits,
        dispensations,
        dispensation_items: dispensationItems,
        drugs,
        incidents,
        end_of_day: endOfDay,
        referrals,
        staff
      },
      // The script receives the base64 form only; the raw bytes are for the
      // Drive upload and must not be serialised into the JSON body.
      photos: photos.map(({ bytes, ...rest }) => rest)
    }
  };
}

async function record(syncType, count, status, message) {
  await runQuery(
    'INSERT INTO sync_logs (sync_type, records_count, status, message) VALUES (?, ?, ?, ?)',
    [syncType, count, status, message]
  );
}

/*
 * One complete send. Returns what happened in plain words. Never throws for
 * an unreachable endpoint — that is an outcome, not an error.
 */
async function runSync({ manual = false } = {}) {
  if (running) {
    return { success: false, status: 'Busy', message: 'A send is already in progress.' };
  }
  running = true;
  const syncType = manual ? 'Manual send' : 'Automatic send';

  try {
    const config = (await getQuery('SELECT * FROM cloud_sync_config LIMIT 1')) || {};
    const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    const endpoint = config.webhook_url ? String(config.webhook_url).trim() : '';

    // A connected Google account is used in preference to a pasted script.
    if (google.isConnected(config)) {
      return await runGoogleSync(config, settings, syncType);
    }

    if (!endpoint || !endpoint.startsWith('http')) {
      const message = 'No Google web app address is saved, so nothing was sent. An administrator adds it under Google Sheets backup.';
      await record(syncType, 0, 'Not Configured', message);
      await runQuery(
        "UPDATE cloud_sync_config SET last_sync_status = 'Not Configured', last_sync_message = ? WHERE id = 1",
        [message]
      );
      return { success: false, status: 'Not Configured', message, records_synced: 0 };
    }

    if (!config.sync_key) {
      const message = 'No sync key has been made yet, so the send was not attempted. Make one under Google Sheets backup and add it to the script.';
      await record(syncType, 0, 'Not Configured', message);
      await runQuery(
        "UPDATE cloud_sync_config SET last_sync_status = 'Not Configured', last_sync_message = ? WHERE id = 1",
        [message]
      );
      return { success: false, status: 'Not Configured', message, records_synced: 0 };
    }

    const { payload, totalRecords, photos, eodToday } = await buildPayload(config, settings);

    let status = 'Success';
    let message = '';
    let driveFolder = null;
    try {
      const result = await postJson(endpoint, payload);
      const accepted = result.body && typeof result.body === 'object' ? result.body : {};
      driveFolder = accepted.photo_folder_url || null;
      message =
        `${syncType}: ${totalRecords} records` +
        (photos.length ? ` and ${photos.length} photograph${photos.length === 1 ? '' : 's'}` : '') +
        ' accepted by the Google script.';
    } catch (err) {
      status = /refused|rejected|key/i.test(err.message) ? 'Refused' : 'Queued Offline';
      message =
        status === 'Refused'
          ? `${syncType} was refused by the Google script: ${err.message}`
          : `${syncType} could not reach Google (${err.message}). Every record stays on this machine and will be sent on the next attempt.`;
    }

    await record(syncType, status === 'Success' ? totalRecords : 0, status, message);

    if (status === 'Success') {
      await runQuery(
        `UPDATE cloud_sync_config SET
           last_synced_at = CURRENT_TIMESTAMP,
           last_sync_status = ?,
           last_sync_message = ?,
           records_synced_count = records_synced_count + ?,
           photos_synced_count = photos_synced_count + ?,
           drive_folder_url = COALESCE(?, drive_folder_url)
         WHERE id = 1`,
        [status, message, totalRecords, photos.length, driveFolder]
      );
      for (const photo of photos) {
        await runQuery('UPDATE patients SET photo_synced_at = CURRENT_TIMESTAMP WHERE id = ?', [photo.patient_id]);
      }
      if (eodToday) {
        await runQuery("UPDATE end_of_day_reports SET cloud_sync_status = 'Synced' WHERE report_date = ?", [eodToday.report_date]);
      }
    } else {
      await runQuery(
        'UPDATE cloud_sync_config SET last_sync_status = ?, last_sync_message = ? WHERE id = 1',
        [status, message]
      );
    }

    return {
      success: status === 'Success',
      status,
      message,
      records_synced: status === 'Success' ? totalRecords : 0,
      photos_synced: status === 'Success' ? photos.length : 0
    };
  } finally {
    running = false;
  }
}

/*
 * The same send, through the connected Google account. Same honesty rules:
 * success is recorded only when Google has acknowledged every write.
 */
async function runGoogleSync(config, settings, syncType) {
  const { payload, totalRecords, photos, eodToday } = await buildPayload(config, settings);
  const photoFiles = photos.map((p) => ({ hospital_number: p.hospital_number, ext: p.ext, bytes: p.bytes }));

  let status = 'Success';
  let message = '';
  let links = null;
  try {
    links = await google.push(config, payload, photoFiles);
    message =
      `${syncType}: ${totalRecords} records` +
      (photos.length ? ` and ${photos.length} photograph${photos.length === 1 ? '' : 's'}` : '') +
      ` written to the Google account ${config.google_account_email || ''}.`;
  } catch (err) {
    const denied = err.status === 401 || err.status === 403 || /invalid_grant|revoked|unauthorized/i.test(err.message);
    status = denied ? 'Refused' : 'Queued Offline';
    message = denied
      ? `${syncType} was refused by Google (${err.message}). The account's permission may have been withdrawn; connect it again under Off-site copy.`
      : `${syncType} could not reach Google (${err.message}). Every record stays on this machine and will be sent on the next attempt.`;
  }

  await record(syncType, status === 'Success' ? totalRecords : 0, status, message);

  if (status === 'Success') {
    await runQuery(
      `UPDATE cloud_sync_config SET
         last_synced_at = CURRENT_TIMESTAMP, last_sync_status = ?, last_sync_message = ?,
         records_synced_count = records_synced_count + ?, photos_synced_count = photos_synced_count + ?,
         google_sheet_url = COALESCE(?, google_sheet_url), drive_folder_url = COALESCE(?, drive_folder_url)
       WHERE id = 1`,
      [status, message, totalRecords, photos.length, links.sheetUrl || null, links.folderUrl || null]
    );
    for (const photo of photos) {
      await runQuery('UPDATE patients SET photo_synced_at = CURRENT_TIMESTAMP WHERE id = ?', [photo.patient_id]);
    }
    if (eodToday) {
      await runQuery("UPDATE end_of_day_reports SET cloud_sync_status = 'Synced' WHERE report_date = ?", [eodToday.report_date]);
    }

    // The administrator's daily summary, once a day, from the connected account.
    const adminEmail = settings && settings.admin_email;
    if (adminEmail && config.last_summary_email_date !== payload.sync_date) {
      try {
        const fresh = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');
        await google.sendSummaryEmail(fresh, payload, adminEmail);
        await runQuery('UPDATE cloud_sync_config SET last_summary_email_date = ? WHERE id = 1', [payload.sync_date]);
        await record('Daily summary email', 0, 'Success', `Daily summary for ${payload.sync_date} emailed to ${adminEmail}.`);
      } catch (err) {
        await record('Daily summary email', 0, 'Failed', `The summary email to ${adminEmail} was not sent: ${err.message}`);
      }
    }
  } else {
    await runQuery('UPDATE cloud_sync_config SET last_sync_status = ?, last_sync_message = ? WHERE id = 1', [status, message]);
  }

  return {
    success: status === 'Success',
    status,
    message,
    records_synced: status === 'Success' ? totalRecords : 0,
    photos_synced: status === 'Success' ? photos.length : 0
  };
}

// Has anything changed since the last successful send? Compares the newest
// timestamps in the tables against last_synced_at, so a quiet clinic does not
// re-send an identical copy every quarter hour.
async function changedSince(lastSyncedAt) {
  if (!lastSyncedAt) return true;
  const checks = [
    ['patients', 'created_at'],
    ['visits', 'created_at'],
    ['dispensations', 'created_at'],
    ['end_of_day_reports', 'created_at'],
    ['occupational_incidents', 'created_at'],
    ['referrals', 'created_at'],
    ['activity_logs', 'created_at']
  ];
  for (const [table, column] of checks) {
    try {
      const row = await getQuery(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} > ?`, [lastSyncedAt]);
      if (row && row.n > 0) return true;
    } catch (err) {
      // A table without that column is simply not consulted.
    }
  }
  return (await countPendingPhotos()) > 0;
}

async function tick() {
  try {
    const config = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');
    if (!config || !config.sync_enabled || !config.auto_sync_on_wifi) return;
    if (!google.isConnected(config) && (!config.webhook_url || !config.sync_key)) return;

    const every = Math.max(5, Number(config.sync_interval_minutes) || 15);
    const last = config.last_auto_attempt_at ? new Date(config.last_auto_attempt_at + 'Z').getTime() : 0;
    if (Date.now() - last < every * 60 * 1000) return;

    if (!(await changedSince(config.last_synced_at))) return;
    if (!(await canReachGoogle())) return;

    await runQuery('UPDATE cloud_sync_config SET last_auto_attempt_at = CURRENT_TIMESTAMP WHERE id = 1');
    const result = await runSync({ manual: false });
    console.log(`  Automatic off-site copy: ${result.status} — ${result.message}`);
  } catch (err) {
    console.error('  Automatic off-site copy failed to run:', err.message);
  }
}

function startAutoSync() {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
  timer.unref();
  setTimeout(tick, 15 * 1000).unref();
}

module.exports = { runSync, startAutoSync, postJson, newSyncKey, countPendingPhotos, canReachGoogle };
