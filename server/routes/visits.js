const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../db');

// GET /api/visits/today (Live OPD Queue for current day)
router.get('/today', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const visits = await allQuery(`
      SELECT v.*, p.patient_code, p.full_name as patient_name, p.age, p.gender, p.phone, p.allergies, p.blood_group
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.visit_date = ?
      ORDER BY 
        CASE v.triage_priority
          WHEN 'Emergency' THEN 1
          WHEN 'Urgent' THEN 2
          ELSE 3
        END,
        v.id ASC
    `, [todayStr]);

    res.json({ success: true, count: visits.length, visits });
  } catch (err) {
    console.error('Fetch today visits error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/visits (Filtered by date, status, or patient)
router.get('/', async (req, res) => {
  try {
    const { date, status, patient_id } = req.query;
    let sql = `
      SELECT v.*, p.patient_code, p.full_name as patient_name, p.age, p.gender, p.phone
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      sql += ' AND v.visit_date = ?';
      params.push(date);
    }
    if (status) {
      sql += ' AND v.status = ?';
      params.push(status);
    }
    if (patient_id) {
      sql += ' AND v.patient_id = ?';
      params.push(patient_id);
    }

    sql += ' ORDER BY v.visit_date DESC, v.id DESC LIMIT 150';
    const visits = await allQuery(sql, params);

    res.json({ success: true, count: visits.length, visits });
  } catch (err) {
    console.error('Fetch visits error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/visits (Check-in patient to queue)
router.post('/', async (req, res) => {
  try {
    const {
      patient_id,
      visit_date,
      reason,
      triage_priority,
      doctor_name,
      consultation_fee,
      bp,
      pulse,
      temp,
      resp_rate,
      spo2,
      weight
    } = req.body;

    if (!patient_id) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }

    const todayStr = visit_date || new Date().toISOString().split('T')[0];

    // Generate unique Visit Code
    const countRow = await getQuery('SELECT COUNT(*) as cnt FROM visits WHERE visit_date = ?', [todayStr]);
    const seq = (countRow.cnt + 1).toString().padStart(3, '0');
    const visit_code = `VST-${todayStr.replace(/-/g, '')}-${seq}`;

    const result = await runQuery(`
      INSERT INTO visits (
        visit_code, patient_id, visit_date, reason, triage_priority, doctor_name, status,
        bp, pulse, temp, resp_rate, spo2, weight, consultation_fee
      ) VALUES (?, ?, ?, ?, ?, ?, 'Waiting', ?, ?, ?, ?, ?, ?, ?)
    `, [
      visit_code,
      patient_id,
      todayStr,
      reason || 'General checkup',
      triage_priority || 'Standard',
      doctor_name || 'Chief Medical Officer',
      bp || '',
      pulse || '',
      temp || '',
      resp_rate || '',
      spo2 || '',
      weight || '',
      consultation_fee || 15.0
    ]);

    const created = await getQuery(`
      SELECT v.*, p.patient_code, p.full_name as patient_name 
      FROM visits v 
      JOIN patients p ON v.patient_id = p.id 
      WHERE v.id = ?
    `, [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Patient checked into OPD queue',
      visit: created
    });
  } catch (err) {
    console.error('Create visit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/visits/:id/status (Transition status in triage pipeline)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Waiting', 'Triage / Vitals', 'In Consultation', 'At Pharmacy', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const completedAt = status === 'Completed' ? new Date().toISOString() : null;

    await runQuery(`
      UPDATE visits SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?
    `, [status, completedAt, req.params.id]);

    const updated = await getQuery('SELECT * FROM visits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: `Status updated to ${status}`, visit: updated });
  } catch (err) {
    console.error('Update visit status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/visits/:id/vitals (Update clinical notes, diagnosis, vitals)
router.put('/:id/vitals', async (req, res) => {
  try {
    const { bp, pulse, temp, resp_rate, spo2, weight, doctor_notes, diagnosis, doctor_name, triage_priority, consultation_fee } = req.body;

    await runQuery(`
      UPDATE visits SET
        bp = COALESCE(?, bp),
        pulse = COALESCE(?, pulse),
        temp = COALESCE(?, temp),
        resp_rate = COALESCE(?, resp_rate),
        spo2 = COALESCE(?, spo2),
        weight = COALESCE(?, weight),
        doctor_notes = COALESCE(?, doctor_notes),
        diagnosis = COALESCE(?, diagnosis),
        doctor_name = COALESCE(?, doctor_name),
        triage_priority = COALESCE(?, triage_priority),
        consultation_fee = COALESCE(?, consultation_fee)
      WHERE id = ?
    `, [bp, pulse, temp, resp_rate, spo2, weight, doctor_notes, diagnosis, doctor_name, triage_priority, consultation_fee, req.params.id]);

    const updated = await getQuery('SELECT * FROM visits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Clinical observations saved', visit: updated });
  } catch (err) {
    console.error('Update vitals error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/visits/:id
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM visits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Visit record removed' });
  } catch (err) {
    console.error('Delete visit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
