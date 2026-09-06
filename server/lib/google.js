const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runQuery, getQuery } = require('../db');

/*
 * The company's Google account, connected directly.
 *
 * The paste-a-script method works but asks an administrator to do six things
 * inside Google's editor. This does the same job by asking them to do one:
 * sign in. The server then makes the spreadsheet and the photograph folder in
 * that account itself and writes into them with Google's own Sheets and Drive
 * interfaces, using a long-lived permission Google hands back after sign-in.
 *
 * The permission is narrow on purpose. "drive.file" reaches only files this
 * software created, never the rest of the company's Drive. The sign-in must be
 * done on the clinic server itself (Google only sends the answer back to
 * "localhost"), which is the one machine that should hold this permission.
 *
 * Nothing here is used by the clinic's day-to-day work. If Google is
 * unreachable, the send is recorded as not sent and tried again later.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

const TABLE_SHEETS = [
  ['patients', 'Patients'],
  ['visits', 'Visits'],
  ['dispensations', 'Dispensations'],
  ['dispensation_items', 'Dispensation items'],
  ['drugs', 'Formulary'],
  ['incidents', 'Incidents'],
  ['end_of_day', 'Shift close'],
  ['referrals', 'Referrals'],
  ['staff', 'Staff']
];
const EXTRA_SHEETS = ['Photographs', 'Summary'];

const pendingStates = new Map();
let cachedAccess = { token: null, expiresAt: 0, forKey: '' };

function redirectUri(port) {
  return `http://localhost:${port}/api/google/callback`;
}

function newState() {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now() + 10 * 60 * 1000);
  for (const [key, expiry] of pendingStates) if (expiry < Date.now()) pendingStates.delete(key);
  return state;
}

function consumeState(state) {
  const expiry = pendingStates.get(state);
  pendingStates.delete(state);
  return !!expiry && expiry >= Date.now();
}

function authUrl(config, port) {
  const params = new URLSearchParams({
    client_id: config.google_client_id,
    redirect_uri: redirectUri(port),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: newState()
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function googleFetch(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    if (!res.ok) {
      const reason = body && body.error
        ? (body.error.message || body.error_description || body.error)
        : `HTTP ${res.status}`;
      const err = new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
      err.status = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function exchangeCode(config, code, port) {
  const body = new URLSearchParams({
    code,
    client_id: config.google_client_id,
    client_secret: config.google_client_secret,
    redirect_uri: redirectUri(port),
    grant_type: 'authorization_code'
  });
  return googleFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
}

async function accessToken(config) {
  const key = `${config.google_client_id}:${config.google_refresh_token}`;
  if (cachedAccess.token && cachedAccess.forKey === key && cachedAccess.expiresAt > Date.now() + 60000) {
    return cachedAccess.token;
  }
  const body = new URLSearchParams({
    client_id: config.google_client_id,
    client_secret: config.google_client_secret,
    refresh_token: config.google_refresh_token,
    grant_type: 'refresh_token'
  });
  const res = await googleFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  cachedAccess = {
    token: res.access_token,
    expiresAt: Date.now() + (Number(res.expires_in) || 3600) * 1000,
    forKey: key
  };
  return res.access_token;
}

async function api(config, url, options = {}) {
  const token = await accessToken(config);
  return googleFetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
}

async function whoAmI(config, freshAccessToken) {
  const res = await googleFetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${freshAccessToken}` }
  });
  return res && res.email ? res.email : '';
}

async function revoke(config) {
  if (!config.google_refresh_token) return;
  try {
    await googleFetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(config.google_refresh_token)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      15000
    );
  } catch (err) {
    // A permission Google no longer recognises is already revoked.
  }
  cachedAccess = { token: null, expiresAt: 0, forKey: '' };
}

/*
 * The spreadsheet and the folder, made once. If an administrator deletes
 * the sheet in Drive, the next send notices (Google answers 404) and makes a
 * fresh one rather than failing forever.
 */
async function ensureWorkspace(config, facilityName) {
  const name = facilityName || 'Lloyds clinic';
  let sheetId = config.google_sheet_id || '';
  let sheetUrl = config.google_sheet_url || '';
  let folderId = config.google_folder_id || '';
  let folderUrl = config.drive_folder_url || '';

  let meta = null;
  if (sheetId) {
    try {
      meta = await api(config, `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=spreadsheetUrl,sheets.properties.title`);
    } catch (err) {
      if (err.status === 404 || err.status === 403) { sheetId = ''; meta = null; } else throw err;
    }
  }
  if (!sheetId) {
    const created = await api(config, 'https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: `${name} — clinic records` },
        sheets: [...TABLE_SHEETS.map(([, title]) => title), ...EXTRA_SHEETS].map((title) => ({ properties: { title } }))
      })
    });
    sheetId = created.spreadsheetId;
    sheetUrl = created.spreadsheetUrl;
    meta = created;
  } else {
    sheetUrl = meta.spreadsheetUrl || sheetUrl;
    const existing = new Set((meta.sheets || []).map((s) => s.properties.title));
    const missing = [...TABLE_SHEETS.map(([, t]) => t), ...EXTRA_SHEETS].filter((t) => !existing.has(t));
    if (missing.length) {
      await api(config, `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) })
      });
    }
  }

  if (folderId) {
    try {
      const f = await api(config, `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,trashed,webViewLink`);
      if (f.trashed) folderId = '';
      else folderUrl = f.webViewLink || folderUrl;
    } catch (err) {
      if (err.status === 404) folderId = ''; else throw err;
    }
  }
  if (!folderId) {
    const f = await api(config, 'https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${name} — patient photographs`, mimeType: 'application/vnd.google-apps.folder' })
    });
    folderId = f.id;
    folderUrl = f.webViewLink;
  }

  await runQuery(
    `UPDATE cloud_sync_config SET google_sheet_id = ?, google_sheet_url = ?, google_folder_id = ?, drive_folder_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
    [sheetId, sheetUrl, folderId, folderUrl]
  );
  return { sheetId, sheetUrl, folderId, folderUrl };
}

function cell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function tableToValues(rows, extraColumns = {}) {
  if (!rows || rows.length === 0) return [['(no records)']];
  const columns = Object.keys(rows[0]);
  for (const key of Object.keys(extraColumns)) if (!columns.includes(key)) columns.push(key);
  const header = columns;
  const body = rows.map((row) => columns.map((c) => cell(c in row ? row[c] : (extraColumns[c] ? extraColumns[c](row) : ''))));
  return [header, ...body];
}

async function uploadPhoto(config, folderId, photo) {
  const fileName = `${photo.hospital_number}.${photo.ext || 'jpg'}`;
  // One file per patient. An older photograph of the same person is replaced,
  // not kept beside the new one, so the folder never shows two faces for one number.
  const q = encodeURIComponent(`name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`);
  const found = await api(config, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
  for (const f of (found.files || [])) {
    await api(config, `https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'DELETE' });
  }

  const boundary = `lloyds${crypto.randomBytes(8).toString('hex')}`;
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const mime = photo.ext === 'png' ? 'image/png' : 'image/jpeg';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    photo.bytes,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const created = await api(config, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(body.length) },
    body
  });
  return created.webViewLink;
}

/*
 * One complete send through Google's own interfaces. Resolves with the links
 * and the photograph map, or throws with a plain reason.
 */
async function push(config, payload, photoFiles) {
  const facility = payload.facility ? payload.facility.name : '';
  const ws = await ensureWorkspace(config, facility);

  const photoLinks = {};
  for (const photo of photoFiles) {
    photoLinks[photo.hospital_number] = await uploadPhoto(config, ws.folderId, photo);
  }

  // Existing links survive a send with no new photographs: read them back.
  let previous = {};
  try {
    const old = await api(config, `https://sheets.googleapis.com/v4/spreadsheets/${ws.sheetId}/values/${encodeURIComponent("'Photographs'!A2:B")}`);
    for (const row of (old.values || [])) if (row[0] && row[1]) previous[row[0]] = row[1];
  } catch (err) { previous = {}; }
  const allLinks = { ...previous, ...photoLinks };

  const data = TABLE_SHEETS.map(([key, title]) => {
    const rows = payload.tables[key] || [];
    const extra = key === 'patients' ? { photograph: (row) => allLinks[row.hospital_number] || '' } : {};
    return { range: `'${title}'!A1`, values: tableToValues(rows, extra) };
  });
  data.push({
    range: "'Photographs'!A1",
    values: [['hospital_number', 'drive_link'], ...Object.entries(allLinks)]
  });
  data.push({
    range: "'Summary'!A1",
    values: [
      ['Facility', facility],
      ['Last send', payload.sent_at],
      ['Schema', payload.schema_version],
      ...Object.entries(payload.counts || {}).map(([k, v]) => [k, cell(v)])
    ]
  });

  await api(config, `https://sheets.googleapis.com/v4/spreadsheets/${ws.sheetId}/values:batchClear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranges: data.map((d) => d.range.replace('!A1', '')) })
  });
  await api(config, `https://sheets.googleapis.com/v4/spreadsheets/${ws.sheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data })
  });

  return { sheetUrl: ws.sheetUrl, folderUrl: ws.folderUrl, photoLinks };
}

/*
 * The daily summary, sent from the connected account to the administrator.
 * Once per calendar day, on the first successful send of that day.
 */
async function sendSummaryEmail(config, payload, toAddress) {
  if (!toAddress) return false;
  const facility = payload.facility ? payload.facility.name : 'Clinic';
  const c = payload.counts || {};
  const eod = (payload.tables.end_of_day || []).find((r) => r.report_date === payload.sync_date);
  const lines = [
    `${facility} — daily summary for ${payload.sync_date}`,
    '',
    `Patients on the register: ${c.patients}`,
    `Visits today: ${c.visits_today}`,
    `Medicines handed over today: ${c.dispensations_today}`,
    `Incidents today: ${c.incidents_today}`,
    `Shift close filed: ${c.end_of_day_filed ? 'yes' : 'not yet'}`
  ];
  if (eod) {
    for (const [k, v] of Object.entries(eod)) {
      if (['id', 'created_at', 'cloud_sync_status'].includes(k)) continue;
      lines.push(`${k.replace(/_/g, ' ')}: ${cell(v)}`);
    }
  }
  lines.push('', `Records: ${config.google_sheet_url || ''}`, `Photographs: ${config.drive_folder_url || ''}`,
    '', 'Sent automatically by the clinic server. Every figure is read from the clinic database; nothing is estimated.');
  const raw = [
    `To: ${toAddress}`,
    `Subject: ${facility} — ${payload.sync_date} summary`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    lines.join('\n')
  ].join('\r\n');
  await api(config, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(raw).toString('base64url') })
  });
  return true;
}

function isConnected(config) {
  return !!(config && config.google_client_id && config.google_client_secret && config.google_refresh_token);
}

module.exports = {
  SCOPES, authUrl, consumeState, exchangeCode, whoAmI, revoke, ensureWorkspace, push,
  sendSummaryEmail, isConnected, redirectUri
};
