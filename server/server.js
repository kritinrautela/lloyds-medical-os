const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

// Initialize database
require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/drugs', require('./routes/drugs'));
app.use('/api/dispense', require('./routes/dispense'));
app.use('/api/end-of-day', require('./routes/endOfDay'));
app.use('/api/cloud-sync', require('./routes/cloudSync'));
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

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`
  ==============================================================
   LLOYDS COMMUNITY CLINIC & PHARMACY SYSTEM (PNG EDITION)
   Mode: 100% Offline-First | Local SQLite Database Active
  ==============================================================
   Local Access (This PC) : http://localhost:${PORT}
   LAN Access (Clinic Wi-Fi): http://${localIp}:${PORT}
   Password-Protected Excel : Enabled (AES-128/256)
   End-of-Day Shift Close  : Enabled
   Google Cloud Sync       : Ready for Wi-Fi Detection
  ==============================================================
  `);
});
