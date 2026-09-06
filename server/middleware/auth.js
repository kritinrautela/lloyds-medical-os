/*
 * Session handling.
 *
 * Before this existed the server believed whatever name the browser put in the
 * request body. Every "only an administrator can do this" check was therefore
 * a suggestion: anyone who could reach the clinic network could send a request
 * claiming to be the administrator and the server would carry it out.
 *
 * Now signing in issues a token that is stored here. The token is the only
 * thing that identifies a request, the role is read from the database row it
 * points at, and a name supplied in a request body is treated as what it is:
 * an unverified string.
 */

const crypto = require('crypto');
const { runQuery, getQuery } = require('../db');
const { can, describe } = require('../lib/permissions');

// A clinic shift is long and the machines are shared. A day is long enough
// that nobody is thrown out mid-consultation, and short enough that a computer
// left switched on overnight does not stay signed in for a week.
const SESSION_HOURS = 16;

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function expiryFromNow() {
  return new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
}

async function createSession(userId, device) {
  const token = newToken();
  await runQuery(
    'INSERT INTO sessions (token, user_id, expires_at, device) VALUES (?, ?, ?, ?)',
    [token, userId, expiryFromNow(), (device || '').toString().slice(0, 200)]
  );
  return token;
}

async function destroySession(token) {
  if (!token) return;
  await runQuery('DELETE FROM sessions WHERE token = ?', [token]).catch(() => {});
}

async function destroyAllSessionsFor(userId) {
  await runQuery('DELETE FROM sessions WHERE user_id = ?', [userId]).catch(() => {});
}

function tokenFrom(req) {
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  // A file download is started by pointing the browser at a URL, which cannot
  // carry a header, so those routes may pass the token as a query parameter.
  if (req.query && req.query.token) return String(req.query.token);
  return null;
}

/*
 * Resolves the token on every request and hangs the user off req.user. It never
 * refuses anything on its own: routes that do not need an identity carry on
 * working, and routes that do call requireAuth or requirePermission below.
 */
async function attachUser(req, res, next) {
  req.user = null;
  req.sessionToken = null;
  try {
    const token = tokenFrom(req);
    if (!token) return next();

    const row = await getQuery(
      `SELECT s.token, s.expires_at, u.id, u.username, u.full_name, u.role, u.staff_id,
              u.department, u.status, u.email, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      [token]
    );
    if (!row) return next();

    // An expired session is cleared rather than left to accumulate.
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await destroySession(token);
      return next();
    }

    // An account disabled by an administrator loses its session immediately,
    // rather than staying signed in until the token happens to expire.
    if (row.status !== 'Active') {
      await destroyAllSessionsFor(row.id);
      return next();
    }

    const { token: _t, expires_at: _e, ...user } = row;
    req.user = user;
    req.sessionToken = token;

    // Doubles as the presence signal behind "who is on the system now".
    runQuery('UPDATE sessions SET last_seen = CURRENT_TIMESTAMP WHERE token = ?', [token]).catch(() => {});
    runQuery('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [user.id]).catch(() => {});
  } catch (err) {
    console.error('Session lookup failed:', err.message);
  }
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      code: 'SIGN_IN_REQUIRED',
      message: 'Your session has ended. Sign in again to carry on.'
    });
  }
  return next();
}

/*
 * The gate the whole accountability story rests on. The role is read from the
 * database, never from the request, so a member of staff cannot grant
 * themselves an administrator's powers by editing what the browser sends.
 */
// "A HSE Safety Officer" reads as a mistake to anyone who says it out loud.
// The article follows the sound of the first letter: a vowel, or an acronym
// like HSE whose first letter is said "aitch".
function article(role) {
  const name = String(role || '');
  const startsWithAcronym = /^[A-Z]{2,}/.test(name);
  const vowelSound = startsWithAcronym ? /^[AEFHILMNORSX]/.test(name) : /^[AEIOU]/.test(name);
  return vowelSound ? 'An' : 'A';
}

function requirePermission(capability) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'SIGN_IN_REQUIRED',
        message: 'Your session has ended. Sign in again to carry on.'
      });
    }
    if (!can(req.user, capability)) {
      // Refusals are worth recording: a pattern of them is a person trying
      // doors, and the alternative is a silent failure nobody can explain.
      runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Permission Refused', ?, ?, 'Access control', ?, 'Warning')`,
        [
          req.user.full_name,
          req.user.role,
          `Tried to ${describe(capability).toLowerCase()}, which ${article(req.user.role).toLowerCase()} ${req.user.role} is not permitted to do.`
        ]
      ).catch(() => {});

      return res.status(403).json({
        success: false,
        code: 'NOT_PERMITTED',
        message: `${article(req.user.role)} ${req.user.role} is not permitted to ${describe(capability).toLowerCase()}. An administrator can do this.`
      });
    }
    return next();
  };
}

module.exports = {
  SESSION_HOURS,
  createSession,
  destroySession,
  destroyAllSessionsFor,
  attachUser,
  requireAuth,
  requirePermission
};
