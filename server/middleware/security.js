/*
 * The browser-facing hardening: response headers, a content security policy
 * for the served application, an origin allowlist in place of the open CORS
 * the server used to run with, and a per-address brake on the sign-in route.
 *
 * None of this replaces the session checks in middleware/auth.js. It closes
 * the doors around them: a page from somewhere else on the network cannot
 * call this API from a browser, the application cannot be framed, scripts
 * cannot be injected into it, and a machine hammering the sign-in route is
 * slowed down before it gets to the password check.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { runQuery } = require('../db');

const CLIENT_INDEX = path.join(__dirname, '..', '..', 'client', 'dist', 'index.html');

/*
 * Inline scripts in the built index.html are allowed by hash rather than by
 * switching inline scripts on. The hashes are read from the file the server
 * actually serves, so a rebuild of the client never needs an edit here.
 */
let inlineHashes = { mtime: -1, list: [] };

function inlineScriptHashes() {
  let stat;
  try {
    stat = fs.statSync(CLIENT_INDEX);
  } catch (err) {
    return [];
  }
  if (stat.mtimeMs === inlineHashes.mtime) return inlineHashes.list;
  const list = [];
  try {
    const html = fs.readFileSync(CLIENT_INDEX, 'utf8');
    const pattern = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (!match[1].trim()) continue;
      list.push(`'sha256-${crypto.createHash('sha256').update(match[1]).digest('base64')}'`);
    }
  } catch (err) {
    console.error('Could not read the client index for the script policy:', err.message);
  }
  inlineHashes = { mtime: stat.mtimeMs, list };
  return list;
}

/*
 * What the served application is allowed to load. Everything comes from this
 * server: there is no web-font service, no analytics, no remote script, by
 * design, because the clinic has no internet. Images may also be data: and
 * blob: because patient photographs are drawn through a canvas and the QR
 * code on a patient card is generated in the browser. Styles allow inline
 * because the interface sets colours and sizes on elements directly. Workers
 * may come from blob: for the same reason images may: a library draws its
 * animation off the main thread from script this server already served.
 */
function contentSecurityPolicy() {
  const scriptSources = ["'self'", ...inlineScriptHashes()].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

function headers(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', contentSecurityPolicy());
  if (req.path.startsWith('/api/')) {
    // Patient data must not be left in a browser or proxy cache after the
    // person has signed out.
    res.setHeader('Cache-Control', 'no-store');
  }
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  return next();
}

/*
 * Which pages may call this API from a browser. The application itself, on
 * whatever address the computer was reached at; and the development server
 * on this machine. Anything else is refused with a plain answer rather than
 * the browser's silent CORS failure, so the refusal can be found.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const refusedOrigins = new Map();

function originAllowed(req, origin) {
  let host;
  try {
    host = new URL(origin).hostname;
  } catch (err) {
    return false;
  }
  if (LOCAL_HOSTS.has(host)) return true;
  return host !== '' && host === req.hostname;
}

function corsAllowlist(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();

  if (!originAllowed(req, origin)) {
    // One audit line per origin per quarter hour, so a misconfigured page
    // that retries every second does not fill the log by itself.
    const last = refusedOrigins.get(origin) || 0;
    if (Date.now() - last > 15 * 60 * 1000) {
      refusedOrigins.set(origin, Date.now());
      runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Origin refused', 'System', '', 'Access control', ?, 'Warning')`,
        [`A browser page at ${origin} tried to call the clinic API and was refused.`]
      ).catch(() => {});
    }
    return res.status(403).json({
      success: false,
      code: 'ORIGIN_REFUSED',
      message: 'This page is not part of the clinic system and may not use its records.'
    });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
}

/*
 * Sign-in attempts per address. The account lockout in routes/auth.js stops
 * somebody guessing one person's password; this stops a machine working
 * through every account in turn. Thirty attempts in a quarter of an hour is
 * far more than a shared clinic computer produces even on a bad morning.
 *
 * The count lives in memory and starts again when the server restarts, which
 * is acceptable: a restart is something an administrator does at the machine,
 * not something a guesser on the network can cause.
 */
const THROTTLE_ATTEMPTS = 30;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const attemptsByAddress = new Map();
const throttleNoted = new Map();

function addressOf(req) {
  const raw = String(req.ip || (req.socket && req.socket.remoteAddress) || 'unknown');
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

function prune(now) {
  for (const [address, times] of attemptsByAddress) {
    const kept = times.filter((t) => now - t < THROTTLE_WINDOW_MS);
    if (kept.length) attemptsByAddress.set(address, kept);
    else attemptsByAddress.delete(address);
  }
}

function loginThrottle(req, res, next) {
  if (req.method !== 'POST') return next();
  const now = Date.now();
  if (attemptsByAddress.size > 500) prune(now);

  const address = addressOf(req);
  const recent = (attemptsByAddress.get(address) || []).filter((t) => now - t < THROTTLE_WINDOW_MS);
  recent.push(now);
  attemptsByAddress.set(address, recent);

  if (recent.length <= THROTTLE_ATTEMPTS) return next();

  const waitMs = recent[recent.length - 1 - THROTTLE_ATTEMPTS] + THROTTLE_WINDOW_MS - now;
  const waitMin = Math.max(1, Math.ceil(waitMs / 60000));

  // Recorded once a minute per address while the brake is on, not once per
  // refused request, so the audit trail shows the event without being buried.
  if (now - (throttleNoted.get(address) || 0) > 60 * 1000) {
    throttleNoted.set(address, now);
    runQuery(
      `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
       VALUES ('Sign-in throttled', ?, '', 'Sign in', ?, 'Warning')`,
      [
        String(req.body && req.body.username ? req.body.username : '').trim().toLowerCase() || 'Unattributed',
        `Sign-in refused for address ${address}: more than ${THROTTLE_ATTEMPTS} attempts in ${THROTTLE_WINDOW_MS / 60000} minutes.`
      ]
    ).catch(() => {});
  }

  res.setHeader('Retry-After', String(Math.ceil(waitMs / 1000)));
  return res.status(429).json({
    success: false,
    code: 'SIGN_IN_THROTTLED',
    message: `Too many sign-in attempts from this device. Wait ${waitMin} minute${waitMin === 1 ? '' : 's'} and try again, or ask an administrator for help.`
  });
}

module.exports = {
  headers,
  corsAllowlist,
  loginThrottle,
  contentSecurityPolicy,
  THROTTLE_ATTEMPTS,
  THROTTLE_WINDOW_MS
};
