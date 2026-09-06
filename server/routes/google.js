const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { runQuery, getQuery } = require('../db');
const google = require('../lib/google');

/*
 * Connecting the company's Google account. See lib/google.js for why the
 * sign-in has to happen on the clinic server itself.
 */

const PORT = process.env.PORT || 4000;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(title, body, ok) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{margin:0;background:#f6f7f9;color:#1b2330;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border:1px solid #dfe3e8;border-radius:10px;padding:28px 32px;max-width:440px;box-shadow:0 8px 30px rgba(20,30,50,.08)}
h1{font-size:18px;margin:0 0 8px}p{margin:8px 0;color:#4a5566}.ok{color:#1c7a45}.bad{color:#b3261e}code{font-family:ui-monospace,Menlo,monospace;font-size:13px}</style></head>
<body><main><h1 class="${ok ? 'ok' : 'bad'}">${escapeHtml(title)}</h1>${body}</main></body></html>`;
}

// PUT /api/google/credentials — the OAuth client made in Google Cloud Console
router.put('/credentials', requirePermission('cloudSync.configure'), async (req, res) => {
  try {
    const id = String(req.body.client_id || '').trim();
    const secret = String(req.body.client_secret || '').trim();
    if (!id.endsWith('.apps.googleusercontent.com')) {
      return res.status(400).json({ success: false, message: 'The client ID should end in .apps.googleusercontent.com. Copy it from the OAuth client in Google Cloud Console.' });
    }
    if (!secret) {
      return res.status(400).json({ success: false, message: 'The client secret is missing.' });
    }
    await runQuery(
      'UPDATE cloud_sync_config SET google_client_id = ?, google_client_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [id, secret]
    );
    res.json({ success: true, message: 'Saved. Now connect the Google account.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/google/start — where the browser should go to sign in
router.get('/start', requirePermission('cloudSync.configure'), async (req, res) => {
  try {
    const config = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');
    if (!config || !config.google_client_id || !config.google_client_secret) {
      return res.status(409).json({ success: false, message: 'Save the client ID and secret first.' });
    }
    const host = String(req.get('host') || '');
    if (!/^localhost(:\d+)?$/.test(host) && !/^127\.0\.0\.1(:\d+)?$/.test(host)) {
      return res.status(409).json({
        success: false,
        message: `Google only sends the sign-in answer back to localhost, so this step has to be done on the clinic server itself. Open http://localhost:${PORT} on that computer and press Connect there.`
      });
    }
    res.json({ success: true, url: google.authUrl(config, PORT), redirect_uri: google.redirectUri(PORT) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/google/callback — Google sends the browser back here
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  try {
    if (error) {
      return res.status(400).send(page('Google did not connect', `<p>Google answered: <code>${escapeHtml(error)}</code>.</p><p>Close this tab and try again from the clinic system.</p>`, false));
    }
    if (!code || !state || !google.consumeState(String(state))) {
      return res.status(400).send(page('That link has expired', '<p>Start the connection again from the clinic system. Each sign-in link is valid for ten minutes.</p>', false));
    }
    const config = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');
    const tokens = await google.exchangeCode(config, String(code), PORT);
    if (!tokens.refresh_token) {
      return res.status(400).send(page('Google did not hand back a lasting permission', '<p>This usually means the account was connected before and Google skipped the consent step. Remove the clinic from the account\'s connected apps at <code>myaccount.google.com/permissions</code>, then connect again.</p>', false));
    }
    const email = await google.whoAmI(config, tokens.access_token);
    await runQuery(
      `UPDATE cloud_sync_config SET google_refresh_token = ?, google_account_email = ?, google_connected_at = CURRENT_TIMESTAMP,
         sync_enabled = 1, auto_sync_on_wifi = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
      [tokens.refresh_token, email]
    );
    const fresh = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');
    const settings = await getQuery('SELECT name FROM hospital_settings LIMIT 1');
    const ws = await google.ensureWorkspace(fresh, settings ? settings.name : '');
    await runQuery(
      `INSERT INTO sync_logs (sync_type, records_count, status, message) VALUES ('Google account connected', 0, 'Success', ?)`,
      [`Connected ${email}. Spreadsheet and photograph folder created in that account.`]
    );
    res.send(page('Connected', `<p>The clinic is connected to <strong>${escapeHtml(email)}</strong>.</p>
<p>Records go to <a href="${escapeHtml(ws.sheetUrl)}" target="_blank" rel="noreferrer">this spreadsheet</a> and photographs to <a href="${escapeHtml(ws.folderUrl)}" target="_blank" rel="noreferrer">this folder</a>, automatically, whenever the server has a connection.</p>
<p>You can close this tab and go back to the clinic system.</p>`, true));
  } catch (err) {
    console.error('Google callback error:', err);
    res.status(500).send(page('The connection could not be finished', `<p>${escapeHtml(err.message)}</p><p>Close this tab and try again from the clinic system.</p>`, false));
  }
});

// POST /api/google/disconnect
router.post('/disconnect', requirePermission('cloudSync.configure'), async (req, res) => {
  try {
    const config = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');
    await google.revoke(config);
    await runQuery(
      `UPDATE cloud_sync_config SET google_refresh_token = NULL, google_connected_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
    );
    await runQuery(
      `INSERT INTO sync_logs (sync_type, records_count, status, message) VALUES ('Google account disconnected', 0, 'Success', ?)`,
      [`${req.user.full_name} disconnected the Google account. The spreadsheet and folder stay in that account; nothing more is sent to them.`]
    );
    res.json({ success: true, message: 'Disconnected. The spreadsheet and folder remain in the Google account; the clinic can no longer write to them.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
