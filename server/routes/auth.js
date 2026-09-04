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
      return res.status(403).json({ success: false, message: 'This account has been deactivated.' });
    }

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

// GET /api/auth/users (List All Staff Accounts)
router.get('/users', async (req, res) => {
  try {
    const users = await allQuery(`
      SELECT id, username, full_name, email, role, staff_id, department, status, created_at 
      FROM users 
      ORDER BY id ASC
    `);
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/auth/users/:id (Update Staff Details / Status)
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

    res.json({ success: true, message: 'Staff member updated', user: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
