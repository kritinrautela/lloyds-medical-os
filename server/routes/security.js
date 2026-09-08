/*
 * The security page: what protections are on, who is signed in and from
 * where, how the sign-in route has been treated lately, and the state of the
 * encrypted backups. Administrators see the whole facility; everyone else
 * sees only their own sessions, which they may end.
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireAuth, SESSION_HOURS, destroySession } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../db');
const { readCertificate } = require('../lib/tls');
const backup = require('../lib/backup');

// Mirrors the guard the client runs: a quarter hour without a touch and the
// person is signed out of that device.
const IDLE_MINUTES = 15;

function requireAdministrator(req, res, next) {
  const actor = req.user;
  if (!actor) {
    return res.status(401).json({ success: false, code: 'SIGN_IN_REQUIRED', message: 'Your session has ended. Sign in again to carry on.' });
  }
  if (actor.role !== 'Administrator' || actor.status !== 'Active') {
    return res.status(403).json({
      success: false,
      code: 'NOT_PERMITTED',
      message: `A ${actor.role} is not permitted to do this. An administrator can.`
    });
  }
  return next();
}

// A session is named to the interface by a fingerprint of its token, never
// the token itself, which stays between the browser that holds it and here.
function sessionId(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 16);
}

// SQLite's CURRENT_TIMESTAMP is UTC without a marker; the interface is handed
// an unambiguous instant.
function iso(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return text.replace(' ', 'T') + 'Z';
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

async function audit(action, actor, details, severity = 'Info') {
  await runQuery(
    `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
     VALUES (?, ?, ?, 'Security', ?, ?)`,
    [action, actor ? actor.full_name : 'Unattributed', actor ? actor.role : '', details, severity]
  ).catch(() => {});
}

// GET /api/security/status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const admin = req.user.role === 'Administrator';

    let httpsAvailable = false;
    try { httpsAvailable = !!readCertificate(); } catch (err) { httpsAvailable = false; }

    const counts = await getQuery(`
      SELECT
        SUM(CASE WHEN action_type = 'Sign-in failed' THEN 1 ELSE 0 END) AS failed_24h,
        SUM(CASE WHEN action_type = 'Sign-in locked' THEN 1 ELSE 0 END) AS locked_24h,
        SUM(CASE WHEN action_type = 'Sign-in throttled' THEN 1 ELSE 0 END) AS throttled_24h
      FROM activity_logs
      WHERE created_at >= datetime('now', '-1 day')
    `) || {};

    const rows = await allQuery(`
      SELECT s.token, s.user_id, s.device, s.created_at, s.last_seen, s.expires_at,
             u.full_name, u.role, u.staff_id
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > ?
      ORDER BY s.last_seen DESC
    `, [new Date().toISOString()]);

    const sessions = rows
      .filter((row) => admin || row.user_id === req.user.id)
      .map((row) => ({
        id: sessionId(row.token),
        user_name: row.full_name,
        role: row.role,
        staff_id: row.staff_id,
        device: row.device || '',
        created_at: iso(row.created_at),
        last_seen: iso(row.last_seen),
        current: row.token === req.sessionToken
      }));

    const backups = await backup.status();
    if (!admin) backups.files = [];

    res.json({
      success: true,
      https: { available: httpsAvailable, port: Number(process.env.HTTPS_PORT || 4443) },
      session: { idle_minutes: IDLE_MINUTES, hours: SESSION_HOURS },
      password_hashing: 'scrypt',
      signins: {
        failed_24h: counts.failed_24h || 0,
        locked_24h: counts.locked_24h || 0,
        throttled_24h: counts.throttled_24h || 0
      },
      sessions,
      backups
    });
  } catch (err) {
    console.error('Security status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/security/backup
router.post('/backup', requireAuth, requireAdministrator, async (req, res) => {
  try {
    const file = await backup.writeBackup(req.user);
    res.json({ success: true, file });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, message: `The backup could not be written: ${err.message}` });
  }
});

// POST /api/security/backup-passphrase
router.post('/backup-passphrase', requireAuth, requireAdministrator, async (req, res) => {
  try {
    const setAt = await backup.setPassphrase((req.body || {}).passphrase, req.user);
    res.json({ success: true, passphrase_set_at: setAt });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
    console.error('Backup passphrase error:', err);
    res.status(500).json({ success: false, message: `The passphrase could not be set: ${err.message}` });
  }
});

// DELETE /api/security/sessions/:id
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const wanted = String(req.params.id || '').toLowerCase();
    if (!/^[0-9a-f]{16}$/.test(wanted)) {
      return res.status(400).json({ success: false, message: 'That is not a session reference.' });
    }
    const rows = await allQuery(`
      SELECT s.token, s.user_id, s.device, u.full_name, u.role
      FROM sessions s JOIN users u ON u.id = s.user_id
    `);
    const found = rows.find((row) => sessionId(row.token) === wanted);
    if (!found) {
      return res.status(404).json({ success: false, message: 'That session has already ended.' });
    }
    const own = found.user_id === req.user.id;
    if (!own && req.user.role !== 'Administrator') {
      return res.status(403).json({ success: false, code: 'NOT_PERMITTED', message: 'Only an administrator can end somebody else\'s session.' });
    }
    await destroySession(found.token);
    await audit(
      'Session ended',
      req.user,
      own
        ? `The account holder ended one of their own sessions (${found.device || 'device not recorded'}).`
        : `An administrator ended the session of ${found.full_name} (${found.role}) on ${found.device || 'a device that was not recorded'}.`,
      own ? 'Info' : 'Warning'
    );
    res.json({ success: true, ended_current: found.token === req.sessionToken });
  } catch (err) {
    console.error('End session error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
