const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const https = require('https');

// Initialize database
const { getQuery } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const SECURE_PORT = process.env.HTTPS_PORT || 4443;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Every request is checked for a session token before it reaches a route, so
// each route can ask who is making the request instead of believing a name in
// the request body. It refuses nothing on its own.
app.use(require('./middleware/auth').attachUser);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/drugs', require('./routes/drugs'));
app.use('/api/dispense', require('./routes/dispense'));
app.use('/api/end-of-day', require('./routes/endOfDay'));
app.use('/api/cloud-sync', require('./routes/cloudSync'));
app.use('/api/google', require('./routes/google'));
app.use('/api/export', require('./routes/export'));
app.use('/api/settings', require('./routes/settings'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Lloyds Hospital Management System',
    version: '2.4.0-PNG',
    mode: '100% Offline-First (SQLite)',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  const indexHtml = path.join(clientDistPath, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.send(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; background: #08172E; color: #fff; text-align: center;">
            <h2>Lloyds Hospital Server is Running</h2>
            <p>API is active on port ${PORT}. Client bundle is building or running on Vite dev server.</p>
            <p><a href="http://localhost:5173" style="color: #38bdf8;">Click here to open Client on Port 5173</a></p>
          </body>
        </html>
      `);
    }
  });
});

// Utility: get local network IP for offline LAN sharing
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// The banner reports what the database actually says. It does not assert that
// a protection is on: an operator reading it needs to know which of these are
// genuinely configured on this machine, because the ones that are not are the
// ones somebody has to go and set up.
async function describeState() {
  const lines = [];
  try {
    const settings = await getQuery('SELECT export_password, live_since FROM hospital_settings LIMIT 1');
    lines.push(
      settings && settings.export_password
        ? 'Excel export password  : set — workbooks open read-only'
        : 'Excel export password  : NOT SET — exports refused until an admin sets one in Settings'
    );
    lines.push(
      settings && settings.live_since
        ? `Sample records         : cleared on ${String(settings.live_since).slice(0, 10)} — this is live patient data`
        : 'Sample records         : still present — records on screen are demonstration data, not real patients'
    );
  } catch (err) {
    lines.push(`Settings               : could not be read (${err.message})`);
  }

  try {
    const sync = await getQuery(
      'SELECT sync_enabled, webhook_url, last_sync_status, last_synced_at FROM cloud_sync_config LIMIT 1'
    );
    if (!sync || !sync.webhook_url) {
      lines.push('Google Sheets sync     : not connected — no Apps Script address saved');
    } else if (!sync.sync_enabled) {
      lines.push('Google Sheets sync     : connected but switched off');
    } else {
      const when = sync.last_synced_at ? String(sync.last_synced_at).slice(0, 16) : 'never run';
      lines.push(`Google Sheets sync     : on — last run ${when} (${sync.last_sync_status || 'no status'})`);
    }
  } catch (err) {
    lines.push(`Google Sheets sync     : could not be read (${err.message})`);
  }

  try {
    const staff = await getQuery("SELECT COUNT(*) AS n FROM users WHERE status = 'Active'");
    lines.push(`Staff accounts         : ${staff ? staff.n : 0} active — sign-in is required to open the system`);
  } catch (err) {
    lines.push(`Staff accounts         : could not be read (${err.message})`);
  }

  return lines;
}

// A tablet only installs the system as an application when it was opened
// from an https address, so the clinic's own certificate is used when one
// has been made. Without it everything still works over http on a computer;
// the tablets just get a browser tab instead of an installed application.
const { readCertificate } = require('./lib/tls');

function startSecureServer(localIp) {
  const credentials = readCertificate();
  if (!credentials) {
    return `Android tablets        : http only — run "node server/scripts/make-certificate.js" to install on tablets`;
  }
  try {
    https.createServer(credentials, app).listen(SECURE_PORT, '0.0.0.0');
    return `Android tablets        : https://${localIp}:${SECURE_PORT} — open this one, then "Install app"`;
  } catch (err) {
    return `Android tablets        : https could not start (${err.message})`;
  }
}

app.listen(PORT, '0.0.0.0', async () => {
  const localIp = getLocalIp();
  const state = await describeState();
  const tablets = startSecureServer(localIp);

  // The off-site copy sends itself whenever the computer can reach Google
  // and something has changed. Nothing about seeing patients waits on it.
  require('./lib/sync').startAutoSync();
  console.log(`
  ==============================================================
   LLOYDS COMMUNITY CLINIC & PHARMACY SYSTEM (PNG EDITION)
   Runs on this computer. No internet connection is required.
  ==============================================================
   This computer          : http://localhost:${PORT}
   Other clinic computers : http://${localIp}:${PORT}
   ${tablets}
  --------------------------------------------------------------
   ${state.join('\n   ')}
  ==============================================================
  `);
});
