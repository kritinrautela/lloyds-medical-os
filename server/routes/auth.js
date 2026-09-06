const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { runQuery, getQuery, allQuery } = require('../db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// POST /api/auth/register (Create New Staff Account)
router.post('/register', async (req, res) => {
  try {
    const { username, password, full_name, email, role, department } = req.body;

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
        username, password_hash, full_name, email, role, staff_id, department
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanUsername,
      password_hash,
      full_name.trim(),
      email ? email.trim() : '',
      role,
      staff_id,
      department || 'Occupational Health & Emergency'
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
        'STAFF_REGISTERED',
        cleanUsername,
        role,
        department || 'Occupational Health',
        `New clinical personnel registered: ${full_name.trim()} (${staff_id}) - Role: ${role}`,
        'Info'
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
    const password_hash = hashPassword(password);

    const user = await getQuery(`
      SELECT id, username, full_name, email, role, staff_id, department, status, created_at 
      FROM users 
      WHERE username = ? AND password_hash = ?
    `, [cleanUsername, password_hash]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'This account has been deactivated by the Administrator.' });
    }

    // Update last_login timestamp
    try {
      await runQuery('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    } catch (e) {}

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');

    res.json({
      success: true,
      message: `Welcome back, ${user.full_name}`,
      token,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
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
    const user = await getQuery('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const newPassword = req.body.password || 'lloyds2026';
    const password_hash = hashPassword(newPassword);

    await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, user.id]);

    try {
      await runQuery(`
        INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'STAFF_PASSWORD_RESET',
        'admin',
        'Administrator',
        'Staff Management',
        `Admin reset credentials for @${user.username} (${user.full_name})`,
        'Warning'
      ]);
    } catch (e) {}

    res.json({ 
      success: true, 
      message: `Password reset successfully for @${user.username}. New PIN: ${newPassword}` 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/users/:id/toggle-status (Activate / Deactivate Account)
router.post('/users/:id/toggle-status', async (req, res) => {
  try {
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
