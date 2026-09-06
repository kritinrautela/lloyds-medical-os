const express = require('express');
const {
  createSession, destroySession, destroyAllSessionsFor, requireAuth
} = require('../middleware/auth');
const { capabilitiesFor, sectionsFor, landingFor } = require('../lib/permissions');
const router = express.Router();
const crypto = require('crypto');
const { runQuery, getQuery, allQuery } = require('../db');

/*
 * Password storage.
 *
 * Passwords are stored as scrypt hashes with a random per-account salt, so two
 * people who choose the same password do not get the same stored value and a
 * stolen database cannot be run against a precomputed table.
 *
 * Accounts created by earlier versions hold a bare SHA-256 hash. Those still
 * verify, and are quietly upgraded to scrypt the next time the person signs in
 * successfully, so nobody is locked out by the change.
 */
const SCRYPT_KEYLEN = 64;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function legacyHash(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

/** @returns {{ ok: boolean, legacy: boolean }} */
function verifyPassword(password, stored) {
  if (!stored) return { ok: false, legacy: false };

  if (stored.startsWith('scrypt$')) {
    const [, salt, expected] = stored.split('$');
    if (!salt || !expected) return { ok: false, legacy: false };
    const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
    const expectedBuf = Buffer.from(expected, 'hex');
    const ok = derived.length === expectedBuf.length && crypto.timingSafeEqual(derived, expectedBuf);
    return { ok, legacy: false };
  }

  const candidate = Buffer.from(legacyHash(password), 'hex');
  const storedBuf = Buffer.from(stored, 'hex');
  const ok = candidate.length === storedBuf.length && crypto.timingSafeEqual(candidate, storedBuf);
  return { ok, legacy: ok };
}

/*
 * Account creation is restricted to administrators. The one exception is the
 * very first account on a fresh installation, which has to be possible before
 * any administrator exists; it is forced to be an administrator so the clinic
 * always has one, and it is recorded as the founding account.
 */
async function assertMayCreateAccount(req) {
  const total = await getQuery('SELECT COUNT(*) AS cnt FROM users');
  if (!total || total.cnt === 0) return { allowed: true, bootstrap: true };

  // The actor comes from the session token, never from the request body. An id
  // in the body is a claim anyone can type; a session is one the server issued.
  const actor = req.user;
  if (!actor) {
    return { allowed: false, message: 'Sign in as an administrator to create a staff account.' };
  }
  if (actor.role !== 'Administrator' || actor.status !== 'Active') {
    return { allowed: false, message: 'Only an active administrator can create a staff account.' };
  }
  return { allowed: true, bootstrap: false, actor };
}

/*
 * Account management — resetting a password, disabling an account, deleting one
 * — is administrator work. The acting administrator is whoever the session
 * token belongs to, with their role read from the database on every request,
 * and they are named in the audit trail.
 */
async function requireAdmin(req) {
  const actor = req.user;
  if (!actor) return { ok: false, message: 'Your session has ended. Sign in again to carry on.' };
  if (actor.role !== 'Administrator' || actor.status !== 'Active') {
    return { ok: false, message: `A ${actor.role} is not permitted to do this. An administrator can.` };
  }
  return { ok: true, actor };
}

// POST /api/auth/register (Create New Staff Account)
router.post('/register', async (req, res) => {
  try {
    const { username, password, full_name, email, role, department } = req.body;

    const permission = await assertMayCreateAccount(req);
    if (!permission.allowed) {
      await runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Account creation refused', ?, '', 'Staff and access', ?, 'Warning')`,
        [req.body.created_by || 'Unattributed',
         `An attempt to create the account "${(username || '').toString().trim()}" was refused: the request did not come from an active administrator.`]
      ).catch(() => {});
      return res.status(403).json({ success: false, message: permission.message });
    }

    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, password, full name, and role are required.' 
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await getQuery('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: `Username '${cleanUsername}' is already registered. Please choose another.` 
      });
    }

    // Generate unique Staff ID
    const countRow = await getQuery('SELECT COUNT(*) as cnt FROM users');
    const staff_id = `LMEL-MED-${(countRow.cnt + 1).toString().padStart(3, '0')}`;
    const password_hash = hashPassword(password);

    const result = await runQuery(`
      INSERT INTO users (
        username, password_hash, full_name, email, role, staff_id, department,
        must_change_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanUsername,
      password_hash,
      full_name.trim(),
      email ? email.trim() : '',
      permission.bootstrap ? 'Administrator' : role,
      staff_id,
      department || '',
      // An administrator setting up somebody else's account has necessarily
      // chosen that person's password and knows it, so it stands only until
      // the holder signs in and replaces it. The first account on a new
      // installation is the administrator's own, so it is theirs already.
      permission.bootstrap ? 0 : 1
    ]);

    const newUser = await getQuery(`
      SELECT id, username, full_name, email, role, staff_id, department, created_at 
      FROM users WHERE id = ?
    `, [result.lastID]);

    // Record in Medico-Legal Black Box Activity Log
    try {
      await runQuery(`
        INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Account created',
        permission.actor ? permission.actor.full_name : (req.body.created_by || 'First-run setup'),
        permission.actor ? 'Administrator' : '',
        'Staff and access',
        permission.bootstrap
          ? `The founding administrator account ${full_name.trim()} (${staff_id}) was created during first-run setup.`
          : `Account created for ${full_name.trim()} (${staff_id}) with the role ${role}.`,
        role === 'Administrator' ? 'Warning' : 'Info'
      ]);
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: `Staff account successfully created for ${newUser.full_name} (${newUser.staff_id})`,
      user: newUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login (Authenticate User)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Five wrong passwords in a quarter of an hour and the account rests for
    // the remainder of that quarter hour. Slow enough to defeat guessing, short
    // enough that a nurse who mistyped on a tablet is not locked out of a shift.
    const recentFailures = await getQuery(
      `SELECT COUNT(*) AS n, MAX(created_at) AS last_at FROM activity_logs
        WHERE action_type = 'Sign-in failed' AND user_name = ?
          AND created_at >= datetime('now', '-15 minutes')`,
      [cleanUsername]
    );
    if (recentFailures && recentFailures.n >= LOCKOUT_ATTEMPTS) {
      const lastMs = new Date(`${recentFailures.last_at}Z`).getTime();
      const waitMin = Math.max(1, Math.ceil((lastMs + LOCKOUT_MINUTES * 60000 - Date.now()) / 60000));
      await runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Sign-in locked', ?, '', 'Sign in', ?, 'Warning')`,
        [cleanUsername, `Sign-in refused: ${recentFailures.n} failed attempts in ${LOCKOUT_MINUTES} minutes.`]
      ).catch(() => {});
      return res.status(429).json({
        success: false,
        message: `Too many wrong passwords for this account. Try again in ${waitMin} minute${waitMin === 1 ? '' : 's'}, or ask an administrator to reset the password.`
      });
    }

    const record = await getQuery(`
      SELECT id, username, password_hash, full_name, email, role, staff_id, department, status,
             created_at, must_change_password
      FROM users WHERE username = ?
    `, [cleanUsername]);

    const check = record
      ? verifyPassword(password, record.password_hash)
      : { ok: false, legacy: false };

    if (!record || !check.ok) {
      await runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Sign-in failed', ?, '', 'Sign in', 'A sign-in attempt failed.', 'Warning')`,
        [cleanUsername]
      ).catch(() => {});
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Upgrade a password still held in the old unsalted form.
    if (check.legacy) {
      await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), record.id])
        .catch((err) => console.error('Password upgrade failed:', err.message));
    }

    const { password_hash: _stored, ...user } = record;

    if (user.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'This account has been deactivated by the Administrator.' });
    }

    // Update last_login timestamp
    try {
      await runQuery('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    } catch (e) {}

    // A stored session, not a decorative random string. Until this existed the
    // token was thrown away by the server and every role check was advisory.
    const token = await createSession(user.id, req.get('user-agent'));

    res.json({
      success: true,
      message: `Welcome back, ${user.full_name}`,
      token,
      user,
      // What this person may do and where they should land, so the interface
      // draws itself from the same rules the server enforces.
      capabilities: capabilitiesFor(user.role),
      sections: sectionsFor(user.role),
      landing: landingFor(user.role),
      // A temporary password gets the holder as far as the password screen and
      // no further. The client refuses to show clinical data until it is gone.
      must_change_password: !!user.must_change_password
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * GET /api/auth/bootstrap-status
 *
 * A clinic that has just installed the software has no accounts at all. Rather
 * than shipping one with a password printed in the source, the first person to
 * open it creates the administrator account themselves.
 */
router.get('/bootstrap-status', async (req, res) => {
  try {
    const total = await getQuery('SELECT COUNT(*) AS cnt FROM users');
    res.json({ success: true, needs_setup: !total || total.cnt === 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * POST /api/auth/change-password
 *
 * A person changing their own password. It requires the password they are
 * replacing, so possession of an unattended signed-in machine is not enough to
 * lock the real holder out of their own account.
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};

    if (!new_password || String(new_password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Choose a password of at least 8 characters.'
      });
    }
    if (String(new_password) === String(current_password)) {
      return res.status(400).json({
        success: false,
        message: 'The new password must be different from the current one.'
      });
    }

    const record = await getQuery('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const check = record ? verifyPassword(current_password, record.password_hash) : { ok: false };
    if (!check.ok) {
      await runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Password change refused', ?, ?, 'Sign in', 'The current password given did not match.', 'Warning')`,
        [req.user.full_name, req.user.role]
      ).catch(() => {});
      return res.status(403).json({ success: false, message: 'That is not your current password.' });
    }

    await runQuery(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [hashPassword(new_password), req.user.id]
    );

    // Every other device signed in as this person is dropped: if the password
    // was being changed because somebody else knew it, that is the point.
    await runQuery('DELETE FROM sessions WHERE user_id = ? AND token != ?', [req.user.id, req.sessionToken])
      .catch(() => {});

    await runQuery(
      `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
       VALUES ('Password changed', ?, ?, 'Sign in', 'The account holder set a new password. Other devices were signed out.', 'Info')`,
      [req.user.full_name, req.user.role]
    ).catch(() => {});

    res.json({ success: true, message: 'Your password has been changed.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * GET /api/auth/session
 *
 * The browser holds a token across a page reload; this says whether that token
 * is still a session, and returns the person it belongs to. It is what stops a
 * disabled account carrying on until its token happens to expire.
 */
router.get('/session', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, code: 'SIGN_IN_REQUIRED', message: 'No active session.' });
  }
  res.json({
    success: true,
    user: req.user,
    capabilities: capabilitiesFor(req.user.role),
    sections: sectionsFor(req.user.role),
    landing: landingFor(req.user.role),
    must_change_password: !!req.user.must_change_password
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  const who = req.user;
  await destroySession(req.sessionToken);
  await runQuery(
    `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
     VALUES ('Signed out', ?, ?, 'Sign in', 'The session was ended from this device.', 'Info')`,
    [who.full_name, who.role]
  ).catch(() => {});
  res.json({ success: true });
});

// GET /api/auth/users (List All Staff Accounts with End-to-End Metrics)
router.get('/users', async (req, res) => {
  try {
    const users = await allQuery(`
      SELECT 
        u.id, 
        u.username, 
        u.full_name, 
        u.email, 
        u.role, 
        u.staff_id, 
        u.department, 
        u.status, 
        u.last_login,
        u.created_at,
        (SELECT COUNT(*) FROM activity_logs WHERE user_name = u.username) AS activity_count,
        (SELECT COUNT(*) FROM visits WHERE doctor_name = u.full_name) AS consultations_count,
        (SELECT COUNT(*) FROM end_of_day_reports WHERE cashier_name = u.full_name OR cashier_name = u.username) AS shifts_reconciled
      FROM users u
      ORDER BY u.id ASC
    `);
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/auth/users/:id (Update Staff Details)
router.put('/users/:id', async (req, res) => {
  try {
    const { full_name, email, role, department, status } = req.body;
    await runQuery(`
      UPDATE users SET
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        department = COALESCE(?, department),
        status = COALESCE(?, status)
      WHERE id = ?
    `, [full_name, email, role, department, status, req.params.id]);

    const updated = await getQuery(`
      SELECT id, username, full_name, email, role, staff_id, department, status 
      FROM users WHERE id = ?
    `, [req.params.id]);

    try {
      await runQuery(`
        INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'STAFF_UPDATED',
        'admin',
        'Administrator',
        'Staff Management',
        `Updated profile for staff member ${updated?.full_name} (@${updated?.username})`,
        'Info'
      ]);
    } catch (e) {}

    res.json({ success: true, message: 'Staff member updated', user: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/users/:id/reset-password (Admin Password Reset)
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return res.status(403).json({ success: false, message: admin.message });

    const user = await getQuery('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    // There is deliberately no fallback password. A default compiled into the
    // source would be known to anyone holding a copy of this software.
    const newPassword = String(req.body.password || '');
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Choose a new password of at least eight characters for this account.'
      });
    }
    const password_hash = hashPassword(newPassword);

    await runQuery(
      'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
      [password_hash, user.id]
    );

    // Whoever was signed in as this account is dropped. A reset is usually done
    // because access is in doubt, and leaving old sessions alive would defeat it.
    await destroyAllSessionsFor(user.id);

    try {
      await runQuery(`
        INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Password reset',
        admin.actor.full_name,
        'Administrator',
        'Staff Management',
        `Admin reset credentials for @${user.username} (${user.full_name})`,
        'Warning'
      ]);
    } catch (e) {}

    res.json({ 
      success: true, 
      message: `The password for @${user.username} has been changed. Tell them the new password in person; it is not shown again here.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/users/:id/toggle-status (Activate / Deactivate Account)
router.post('/users/:id/toggle-status', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return res.status(403).json({ success: false, message: admin.message });

    const user = await getQuery('SELECT id, username, full_name, status FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    if (user.username === 'admin') {
      return res.status(400).json({ success: false, message: 'Root administrator account cannot be deactivated.' });
    }

    const newStatus = user.status === 'Active' ? 'Deactivated' : 'Active';
    await runQuery('UPDATE users SET status = ? WHERE id = ?', [newStatus, user.id]);

    try {
      await runQuery(`
        INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'STAFF_STATUS_CHANGED',
        'admin',
        'Administrator',
        'Staff Management',
        `Staff @${user.username} account status changed to ${newStatus}`,
        newStatus === 'Deactivated' ? 'Warning' : 'Info'
      ]);
    } catch (e) {}

    res.json({ 
      success: true, 
      message: `Account for @${user.username} is now ${newStatus}.`, 
      status: newStatus 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/auth/users/:id (Admin Account Removal)
router.delete('/users/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return res.status(403).json({ success: false, message: admin.message });

    const user = await getQuery('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    if (user.username === 'admin') {
      return res.status(400).json({ success: false, message: 'Root administrator account cannot be deleted.' });
    }

    await runQuery('DELETE FROM users WHERE id = ?', [user.id]);

    try {
      await runQuery(`
        INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'STAFF_DELETED',
        'admin',
        'Administrator',
        'Staff Management',
        `Staff account @${user.username} (${user.full_name}, ${user.role}) permanently removed from local database.`,
        'Warning'
      ]);
    } catch (e) {}

    res.json({ 
      success: true, 
      message: `Staff account @${user.username} permanently deleted from database.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
