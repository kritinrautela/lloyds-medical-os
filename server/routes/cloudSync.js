const express = require('express');
const os = require('os');

const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../db');
const { runSync, postJson, newSyncKey, countPendingPhotos } = require('../lib/sync');

/*
 * The off-site copy — the routes. The work itself lives in lib/sync.js so the
 * background worker and the "send now" button do exactly the same thing.
 */

// GET /api/cloud-sync/status
router.get('/status', async (req, res) => {
  try {
    const config = (await getQuery('SELECT * FROM cloud_sync_config LIMIT 1')) || {};
    const logs = await allQuery('SELECT * FROM sync_logs ORDER BY id DESC LIMIT 20');
    const pendingClose = await getQuery("SELECT COUNT(*) as count FROM end_of_day_reports WHERE cloud_sync_status = 'Pending Sync'");
    const todayStr = new Date().toISOString().split('T')[0];
    const todayVisits = await getQuery('SELECT COUNT(*) as cnt FROM visits WHERE visit_date = ?', [todayStr]);
    const todaySales = await getQuery('SELECT COUNT(*) as cnt FROM dispensations WHERE date(created_at) = ?', [todayStr]);
    const photosWaiting = await countPendingPhotos();
    const photosTotal = await getQuery("SELECT COUNT(*) AS n FROM patients WHERE photo_path IS NOT NULL AND photo_path != ''");

    // The key itself is never sent back to a browser after it is made: a page
    // that shows it forever is a page anyone walking past can photograph.
    const { sync_key, google_client_secret, google_refresh_token, ...safeConfig } = config;

    res.json({
      success: true,
      config: { ...safeConfig, sync_key_set: !!sync_key },
      google: {
        credentials_set: !!(config.google_client_id && google_client_secret),
        connected: !!(config.google_client_id && google_client_secret && google_refresh_token),
        email: config.google_account_email || '',
        connected_at: config.google_connected_at || null,
        sheet_url: config.google_sheet_url || '',
        folder_url: config.drive_folder_url || ''
      },
      recent_logs: logs,
      pending_sync_count: pendingClose ? pendingClose.count : 0,
      photos: { waiting: photosWaiting, total: photosTotal ? photosTotal.n : 0 },
      buffer: {
        today_visits_queued: todayVisits?.cnt || 0,
        today_sales_queued: todaySales?.cnt || 0
      }
    });
  } catch (err) {
    console.error('Fetch cloud sync status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * POST /api/cloud-sync/sync-key — makes a new key and returns it once.
 *
 * This is the "authentication" between the clinic and its Google Sheet. The
 * same key is typed into the script's properties on the Google side; a
 * payload without it is refused there. Making a new key invalidates the old
 * one the moment the script is updated, which is how access is revoked.
 */
router.post('/sync-key', requirePermission('cloudSync.configure'), async (req, res) => {
  try {
    const key = newSyncKey();
    await runQuery('UPDATE cloud_sync_config SET sync_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [key]);
    await runQuery(
      `INSERT INTO sync_logs (sync_type, records_count, status, message) VALUES ('Sync key made', 0, 'Success', ?)`,
      [`A new sync key was made by ${req.user.full_name}. The Google script must be given the same key before the next send.`]
    );
    res.json({
      success: true,
      sync_key: key,
      message: 'Copy this key into the Google script now. It is shown only this once.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * POST /api/cloud-sync/google-auth
 *
 * Records which Google account owns the destination spreadsheet. A label for
 * the audit trail, not a sign-in: nothing here grants or holds Google access.
 */
router.post('/google-auth', requirePermission('cloudSync.configure'), async (req, res) => {
  try {
    const email = String(req.body.email || req.body.google_account_email || '').trim();
    if (!email) return res.status(400).json({ success: false, message: 'A Google account email is required.' });

    await runQuery(
      'UPDATE cloud_sync_config SET google_account_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [email]
    );
    await runQuery(
      `INSERT INTO sync_logs (sync_type, records_count, status, message) VALUES ('Destination account recorded', 0, 'Success', ?)`,
      [`Sheet owner recorded as ${email} by ${req.user.full_name}.`]
    );
    res.json({ success: true, message: `Recorded ${email} as the owner of the destination spreadsheet.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/cloud-sync/config
router.put('/config', requirePermission('cloudSync.configure'), async (req, res) => {
  try {
    const { google_account_email, google_sheet_id, webhook_url, sync_enabled, auto_sync_on_wifi, sync_interval_minutes } = req.body;

    const interval = sync_interval_minutes === undefined || sync_interval_minutes === null
      ? null
      : Math.min(1440, Math.max(5, parseInt(sync_interval_minutes, 10) || 15));

    await runQuery(`
      UPDATE cloud_sync_config SET
        google_account_email = COALESCE(?, google_account_email),
        google_sheet_id = COALESCE(?, google_sheet_id),
        webhook_url = COALESCE(?, webhook_url),
        sync_enabled = COALESCE(?, sync_enabled),
        auto_sync_on_wifi = COALESCE(?, auto_sync_on_wifi),
        sync_interval_minutes = COALESCE(?, sync_interval_minutes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      google_account_email === undefined ? null : String(google_account_email).trim(),
      google_sheet_id === undefined ? null : google_sheet_id,
      webhook_url === undefined ? null : String(webhook_url).trim(),
      sync_enabled !== undefined ? (sync_enabled ? 1 : 0) : null,
      auto_sync_on_wifi !== undefined ? (auto_sync_on_wifi ? 1 : 0) : null,
      interval
    ]);

    const updated = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');
    const { sync_key, google_client_secret, google_refresh_token, ...safeConfig } = updated || {};
    res.json({ success: true, message: 'Saved.', config: { ...safeConfig, sync_key_set: !!sync_key } });
  } catch (err) {
    console.error('Update cloud sync config error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/cloud-sync/sync-now
router.post('/sync-now', requirePermission('cloudSync.configure'), async (req, res) => {
  try {
    const result = await runSync({ manual: true });
    const updated = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');
    const { sync_key, google_client_secret, google_refresh_token, ...safeConfig } = updated || {};
    res.json({ ...result, config: { ...safeConfig, sync_key_set: !!sync_key } });
  } catch (err) {
    console.error('Cloud sync error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * POST /api/cloud-sync/test — one probe, carrying the key, so the answer
 * proves both that the address is right and that the key on each side matches.
 */
router.post('/test', requirePermission('cloudSync.configure'), async (req, res) => {
  try {
    const bodyUrl = req.body && req.body.webhook_url ? String(req.body.webhook_url).trim() : '';
    const config = (await getQuery('SELECT * FROM cloud_sync_config LIMIT 1')) || {};
    const endpoint = bodyUrl || (config.webhook_url ? config.webhook_url.trim() : '');

    if (!endpoint || !endpoint.startsWith('http')) {
      return res.status(400).json({
        success: false,
        message: 'Enter the Apps Script web app URL first. It should start with https://script.google.com/'
      });
    }

    const result = await postJson(endpoint, {
      schema_version: 3,
      test: true,
      sync_key: config.sync_key || '',
      sent_at: new Date().toISOString(),
      message: 'Connection test from Lloyds Medical OS'
    });

    await runQuery(
      `INSERT INTO sync_logs (sync_type, records_count, status, message) VALUES ('Connection test', 0, 'Success', ?)`,
      [`The Google script answered and accepted the key (HTTP ${result.status}).`]
    );
    res.json({ success: true, message: 'Connected. The Google script answered and the sync key matches.', response_preview: result.body });
  } catch (err) {
    await runQuery(
      `INSERT INTO sync_logs (sync_type, records_count, status, message) VALUES ('Connection test', 0, 'Failed', ?)`,
      [err.message]
    ).catch(() => {});
    res.status(200).json({ success: false, message: `The test did not pass: ${err.message}` });
  }
});

/*
 * GET /api/cloud-sync/apps-script — the Google Apps Script to paste into the
 * destination spreadsheet. No OAuth client, no API key, no paid service.
 */
router.get('/apps-script', (req, res) => {
  const script = String.raw`// Lloyds Medical OS -> Google Sheets and Drive receiver (schema 3).
//
// 1. Open your Google Sheet, choose Extensions > Apps Script.
// 2. Replace everything in Code.gs with this file and save.
// 3. Project Settings (the gear) > Script Properties > Add property:
//      Property: SYNC_KEY    Value: the key shown in Lloyds Medical OS
// 4. Deploy > New deployment > Web app.
//    Execute as: Me.   Who has access: Anyone.
// 5. Copy the web app URL into Google Sheets backup in Lloyds Medical OS
//    and press Test the connection.
//
// "Anyone" only means anyone can knock. Without the key nothing is written.
// The first run asks you to authorise Sheets, Drive and Mail; run doPost once
// from this editor if the test does not trigger that prompt.

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var expected = PropertiesService.getScriptProperties().getProperty('SYNC_KEY') || '';

  if (!expected) {
    return json({ ok: false, error: 'SYNC_KEY is not set in this script\'s properties. Add it under Project Settings.' });
  }
  if (!payload.sync_key || payload.sync_key !== expected) {
    return json({ ok: false, error: 'The sync key was rejected. Make sure the key in the script properties matches the one in Lloyds Medical OS.' });
  }

  var book = SpreadsheetApp.getActiveSpreadsheet();

  if (payload.test) {
    writeLog(book, 'Connection test received; key accepted');
    return json({ ok: true, test: true });
  }

  var photoFolder = ensurePhotoFolder(book, payload.facility);
  var photoLinks = savePhotos(photoFolder, payload.photos || []);
  var existingLinks = readPhotoLinks(book);
  Object.keys(photoLinks).forEach(function (k) { existingLinks[k] = photoLinks[k]; });

  var tables = payload.tables || {};
  Object.keys(tables).forEach(function (name) {
    var rows = tables[name] || [];
    if (!rows.length) return;
    if (name === 'patients') {
      rows = rows.map(function (row) {
        var link = existingLinks[row.hospital_number] || '';
        row.photograph = link;
        return row;
      });
    }
    var headers = Object.keys(rows[0]);
    var values = rows.map(function (row) {
      return headers.map(function (h) { return row[h] === null || row[h] === undefined ? '' : row[h]; });
    });
    writeSheet(book, title(name), headers, values);
  });

  writePhotoLinks(book, existingLinks);
  writeLog(book, 'Received ' + JSON.stringify(payload.counts));
  emailSummary(payload);

  return json({
    ok: true,
    received: payload.counts,
    photo_folder_url: photoFolder ? photoFolder.getUrl() : ''
  });
}

// A folder next to this spreadsheet, named for the clinic, holding one image
// per patient named by hospital number. A newer photograph replaces the old.
function ensurePhotoFolder(book, facility) {
  var name = ((facility && facility.name) || 'Clinic') + ' — patient photographs';
  var file = DriveApp.getFileById(book.getId());
  var parents = file.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

function savePhotos(folder, photos) {
  var links = {};
  photos.forEach(function (p) {
    if (!p.data_base64 || !p.file_name) return;
    var blob = Utilities.newBlob(Utilities.base64Decode(p.data_base64), p.mime || 'image/jpeg', p.file_name);
    var existing = folder.getFilesByName(p.file_name);
    while (existing.hasNext()) existing.next().setTrashed(true);
    var created = folder.createFile(blob);
    links[p.hospital_number] = created.getUrl();
  });
  return links;
}

function readPhotoLinks(book) {
  var sheet = book.getSheetByName('Photographs');
  var links = {};
  if (!sheet || sheet.getLastRow() < 2) return links;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  values.forEach(function (row) { if (row[0]) links[row[0]] = row[1]; });
  return links;
}

function writePhotoLinks(book, links) {
  var keys = Object.keys(links).sort();
  if (!keys.length) return;
  writeSheet(book, 'Photographs', ['hospital_number', 'photograph'],
    keys.map(function (k) { return [k, links[k]]; }));
}

// Each sync replaces the sheet contents, so the spreadsheet mirrors the clinic
// database rather than accumulating duplicate rows. The sync log is appended
// to, so the history of syncs is kept.
function writeSheet(book, name, headers, values) {
  var sheet = book.getSheetByName(name) || book.insertSheet(name);
  sheet.clear();
  sheet.appendRow(headers);
  if (values.length) {
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function writeLog(book, text) {
  var sheet = book.getSheetByName('Sync Log') || book.insertSheet('Sync Log');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['time', 'event']);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(), text]);
}

// Emails the day's figures to the address set in Facility settings, at most
// once per day, so repeated sends through the day do not fill an inbox.
function emailSummary(payload) {
  var to = payload.admin_email;
  if (!to) return;

  var today = payload.sync_date;
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('summary_sent_for') === today) return;

  var counts = payload.counts || {};
  var facility = payload.facility || {};
  var eodRows = (payload.tables && payload.tables.end_of_day) || [];
  var eod = null;
  eodRows.forEach(function (r) { if (r.report_date === today) eod = r; });
  var symbol = facility.currency_symbol || '';

  var lines = [
    (facility.name || 'Clinic') + ' — summary for ' + today,
    '',
    'Patients seen today: ' + (counts.visits_today || 0),
    'Medicines handed over today: ' + (counts.dispensations_today || 0),
    'Workplace incidents today: ' + (counts.incidents_today || 0),
    'Registered patients in total: ' + (counts.patients || 0),
    ''
  ];

  if (eod) {
    var expected = Number(eod.total_revenue || 0);
    var counted = Number(eod.cash_reconciled || 0);
    var diff = counted - expected;
    lines.push('The shift was closed by ' + (eod.cashier_name || 'someone unnamed') + '.');
    lines.push('Expected in the drawer: ' + symbol + expected.toFixed(2));
    lines.push('Counted in the drawer:  ' + symbol + counted.toFixed(2));
    lines.push(Math.abs(diff) < 0.005
      ? 'The drawer balanced.'
      : 'The drawer was ' + (diff > 0 ? 'over' : 'short') + ' by ' + symbol + Math.abs(diff).toFixed(2) + '.');
    if (eod.notes) lines.push('Note: ' + eod.notes);
  } else {
    lines.push('The shift had not been closed when this was sent.');
  }

  lines.push('');
  lines.push('The full records are in this spreadsheet and the photographs in the');
  lines.push('folder beside it. This email is sent by the clinic system when it');
  lines.push('reaches the internet, and reports only what was actually recorded.');

  MailApp.sendEmail({
    to: to,
    subject: (facility.name || 'Clinic') + ' — daily summary ' + today,
    body: lines.join('\n')
  });

  props.setProperty('summary_sent_for', today);
}

function title(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

  res.json({ success: true, script });
});

// The one-touch bundle is a download onto this computer, so a photograph in
// it is best pointed at where it opens from on the clinic network. The raw
// filename is dropped: on its own it tells a reader nothing.
function clinicBaseUrl() {
  const port = process.env.PORT || 4000;
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return `http://${iface.address}:${port}`;
    }
  }
  return `http://localhost:${port}`;
}

function patientsForSync(rows) {
  const base = clinicBaseUrl();
  return (rows || []).map((p) => {
    const { photo_path, ...rest } = p;
    return { ...rest, photograph: photo_path ? `${base}/api/patients/${p.id}/photo` : '' };
  });
}

// GET /api/cloud-sync/export-drive-bundle (One-touch Google Drive / Sheets Backup Bundle)
router.get('/export-drive-bundle', requirePermission('export.download'), async (req, res) => {
  try {
    const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    const todayStr = new Date().toISOString().split('T')[0];
    const patients = await allQuery('SELECT * FROM patients ORDER BY id DESC');
    const visits = await allQuery('SELECT * FROM visits ORDER BY id DESC LIMIT 200');
    const drugs = await allQuery('SELECT * FROM drugs ORDER BY category, name');
    const dispensations = await allQuery('SELECT * FROM dispensations ORDER BY id DESC LIMIT 200');
    const beds = await allQuery('SELECT * FROM inpatient_beds ORDER BY id ASC');
    const incidents = await allQuery('SELECT * FROM occupational_incidents ORDER BY id DESC');
    const eodReports = await allQuery('SELECT * FROM end_of_day_reports ORDER BY id DESC LIMIT 30');

    // Generate CSV for Google Sheets
    function toCsv(rows, headers) {
      if (!rows || !rows.length) return headers.join(',') + '\n';
      const lines = [headers.join(',')];
      for (const r of rows) {
        const line = headers.map(h => {
          const val = r[h] !== undefined && r[h] !== null ? String(r[h]).replace(/"/g, '""') : '';
          return `"${val}"`;
        }).join(',');
        lines.push(line);
      }
      return lines.join('\n');
    }

    const driveBundle = {
      facility: settings?.name || 'Lloyds Metals & Energy Ltd',
      export_date: todayStr,
      generated_at: new Date().toISOString(),
      architecture: 'Local SQLite database on the clinic computer, copied to Google Sheets when there is internet',
      summary: {
        total_patients: patients.length,
        total_visits: visits.length,
        formulary_items: drugs.length,
        total_dispensations: dispensations.length,
        inpatient_beds_count: beds.length,
        ohs_incidents: incidents.length
      },
      google_sheets_formula_presets: {
        total_revenue: '=SUM(Dispensations!E2:E) + SUM(Visits!N2:N)',
        total_patients_seen: '=COUNTA(Visits!A2:A)',
        acute_triage_count: '=COUNTIF(Visits!E2:E, "Emergency") + COUNTIF(Visits!E2:E, "Urgent")',
        low_stock_reorder_alert: '=COUNTIF(Pharmacy!F2:F, "REORDER")'
      },
      csv_sheets: {
        patients: toCsv(patientsForSync(patients), ['hospital_number', 'patient_code', 'full_name', 'age', 'gender', 'blood_group', 'allergies', 'address_or_village', 'photograph', 'photo_taken_at', 'registered_by']),
        visits: toCsv(visits, ['visit_code', 'patient_id', 'visit_date', 'reason', 'triage_priority', 'bp', 'pulse', 'temp', 'spo2', 'diagnosis', 'status', 'consultation_fee']),
        pharmacy_inventory: toCsv(drugs, ['code', 'name', 'category', 'strength', 'dosage_form', 'stock_quantity', 'min_stock_alert', 'unit_price', 'expiry_date']),
        dispensations: toCsv(dispensations, ['invoice_number', 'patient_name', 'total_amount', 'paid_amount', 'payment_status', 'created_at']),
        inpatient_beds: toCsv(beds, ['bed_code', 'ward_name', 'status', 'patient_name', 'acuity_level', 'diagnosis', 'attending_doctor', 'admission_date']),
        ohs_incidents: toCsv(incidents, ['incident_code', 'patient_name', 'department', 'incident_type', 'severity', 'fit_for_work_status'])
      },
      raw_json_data: {
        patients,
        visits,
        drugs,
        dispensations,
        beds,
        incidents,
        eodReports
      }
    };

    // Log to sync audit
    await runQuery(`
      INSERT INTO sync_logs (sync_type, records_count, status, message)
      VALUES ('Google Drive Data Pack Export', ?, 'Success', 'Exported comprehensive Google Drive JSON & CSV data pack for cloud backup.')
    `, [patients.length + visits.length + drugs.length + dispensations.length]);

    const filename = `Lloyds_Hospital_GoogleDrive_Sync_${todayStr.replace(/-/g, '')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(driveBundle, null, 2));
  } catch (err) {
    console.error('Export drive bundle error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

