const express = require('express');
const router = express.Router();
const { getQuery, allQuery } = require('../db');

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Total Patients
    const { total_patients } = await getQuery('SELECT COUNT(*) as total_patients FROM patients') || { total_patients: 0 };

    // 2. Today's Footfall
    const { today_visitors } = await getQuery('SELECT COUNT(*) as today_visitors FROM visits WHERE visit_date = ?', [todayStr]) || { today_visitors: 0 };

    // 3. Active Queue Counts
    const queueBreakdown = await allQuery(`
      SELECT status, COUNT(*) as count 
      FROM visits 
      WHERE visit_date = ? 
      GROUP BY status
    `, [todayStr]);

    const queueMap = {
      'Waiting': 0,
      'Triage / Vitals': 0,
      'In Consultation': 0,
      'At Pharmacy': 0,
      'Completed': 0
    };
    queueBreakdown.forEach(row => {
      if (queueMap[row.status] !== undefined) queueMap[row.status] = row.count;
    });

    // 4. Pharmacy Revenue & OPD Fees (Today)
    const { today_pharmacy_revenue } = await getQuery(`
      SELECT COALESCE(SUM(paid_amount), 0) as today_pharmacy_revenue 
      FROM dispensations 
      WHERE date(created_at) = ?
    `, [todayStr]) || { today_pharmacy_revenue: 0 };

    const { today_opd_fees } = await getQuery(`
      SELECT COALESCE(SUM(consultation_fee), 0) as today_opd_fees 
      FROM visits 
      WHERE visit_date = ?
    `, [todayStr]) || { today_opd_fees: 0 };

    // 5. Total Pharmacy Revenue All Time
    const { total_pharmacy_revenue } = await getQuery(`
      SELECT COALESCE(SUM(paid_amount), 0) as total_pharmacy_revenue FROM dispensations
    `) || { total_pharmacy_revenue: 0 };

    // 6. Low stock & Expiry Alerts
    const { low_stock_count } = await getQuery(`
      SELECT COUNT(*) as low_stock_count FROM drugs WHERE stock_quantity <= min_stock_alert
    `) || { low_stock_count: 0 };

    // Expiring within 90 days
    const future90Days = new Date();
    future90Days.setDate(future90Days.getDate() + 90);
    const future90Str = future90Days.toISOString().split('T')[0];

    const { expiring_soon_count } = await getQuery(`
      SELECT COUNT(*) as expiring_soon_count FROM drugs WHERE expiry_date <= ? AND stock_quantity > 0
    `, [future90Str]) || { expiring_soon_count: 0 };

    // 7. 7-Day Footfall Trend
    const footfallTrend = await allQuery(`
      SELECT visit_date, COUNT(*) as count 
      FROM visits 
      WHERE visit_date >= date('now', '-6 days')
      GROUP BY visit_date 
      ORDER BY visit_date ASC
    `);

    // 8. Top Diagnosed Conditions (PNG Context)
    const topDiagnoses = await allQuery(`
      SELECT diagnosis, COUNT(*) as count 
      FROM visits 
      WHERE diagnosis IS NOT NULL AND diagnosis != ''
      GROUP BY diagnosis 
      ORDER BY count DESC 
      LIMIT 5
    `);

    // 9. Top Dispensed Medicines
    const topMedicines = await allQuery(`
      SELECT drug_name, SUM(quantity) as total_dispensed 
      FROM dispensation_items 
      GROUP BY drug_name 
      ORDER BY total_dispensed DESC 
      LIMIT 5
    `);

    // 10. Urgent / Emergency Queue
    const urgentVisits = await allQuery(`
      SELECT v.*, p.full_name as patient_name, p.patient_code, p.age, p.gender
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.visit_date = ? AND v.triage_priority IN ('Urgent', 'Emergency') AND v.status != 'Completed'
      ORDER BY v.id ASC
    `, [todayStr]);

    // 11. Inpatient & Observation Beds
    const beds = await allQuery('SELECT * FROM inpatient_beds ORDER BY id ASC') || [];
    const occupied_beds = beds.filter(b => b.status === 'Occupied').length;
    const total_beds = beds.length;

    // 12. Clinical Shift Handover Notes
    const shiftNotes = await allQuery('SELECT * FROM shift_handover_notes ORDER BY id DESC LIMIT 10') || [];

    // 13. Mine Occupational Health & Safety Incidents
    const incidents = await allQuery('SELECT * FROM occupational_incidents ORDER BY id DESC LIMIT 10') || [];

    // 14. Tropical Surveillance Quick Tally
    const { malaria_cases } = await getQuery(`
      SELECT COUNT(*) as malaria_cases FROM visits WHERE diagnosis LIKE '%Malaria%'
    `) || { malaria_cases: 0 };

    // 15. Live Hospital Clinical Activity & Telemetry Recorder
    const activities = await allQuery('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 25') || [];

    res.json({
      success: true,
      stats: {
        total_patients,
        today_visitors,
        queueMap,
        today_pharmacy_revenue,
        today_opd_fees,
        total_revenue_today: today_pharmacy_revenue + today_opd_fees,
        total_pharmacy_revenue,
        low_stock_count,
        expiring_soon_count,
        footfallTrend,
        topDiagnoses,
        topMedicines,
        urgentVisits,
        beds,
        occupied_beds,
        total_beds,
        shiftNotes,
        incidents,
        malaria_cases,
        activities
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dashboard/shift-notes (Add Clinical Shift Note)
router.post('/shift-notes', async (req, res) => {
  try {
    const { shift_type, author_name, author_role, priority, category, title, note_content } = req.body;
    if (!title || !note_content) {
      return res.status(400).json({ success: false, message: 'Title and note content are required.' });
    }
    const { runQuery, getQuery } = require('../db');
    const result = await runQuery(`
      INSERT INTO shift_handover_notes (shift_type, author_name, author_role, priority, category, title, note_content)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      shift_type || 'Day Shift (06:00 - 18:00)',
      author_name || 'Duty Medical Officer',
      author_role || 'Medical Staff',
      priority || 'Standard',
      category || 'Clinical Telemetry',
      title,
      note_content
    ]);

    const created = await getQuery('SELECT * FROM shift_handover_notes WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, note: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/dashboard/beds/:id (Update Bed Status / Admit / Discharge)
router.put('/beds/:id', async (req, res) => {
  try {
    const { status, patient_name, patient_code, acuity_level, diagnosis, attending_doctor, vitals_ticker, notes } = req.body;
    const { runQuery, getQuery } = require('../db');
    await runQuery(`
      UPDATE inpatient_beds SET
        status = COALESCE(?, status),
        patient_name = ?,
        patient_code = ?,
        acuity_level = ?,
        diagnosis = ?,
        attending_doctor = ?,
        vitals_ticker = ?,
        notes = ?
      WHERE id = ?
    `, [
      status,
      status === 'Available' ? null : patient_name,
      status === 'Available' ? null : patient_code,
      status === 'Available' ? null : acuity_level,
      status === 'Available' ? null : diagnosis,
      status === 'Available' ? null : attending_doctor,
      status === 'Available' ? 'Ready for Admission' : vitals_ticker,
      notes,
      req.params.id
    ]);

    const updated = await getQuery('SELECT * FROM inpatient_beds WHERE id = ?', [req.params.id]);
    res.json({ success: true, bed: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dashboard/activities (Log Live Clinical Action)
router.post('/activities', async (req, res) => {
  try {
    const { action_type, user_name, user_role, patient_name, location, details, severity } = req.body;
    const { runQuery, getQuery } = require('../db');
    const result = await runQuery(`
      INSERT INTO activity_logs (action_type, user_name, user_role, patient_name, location, details, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      action_type,
      user_name || 'Medical Staff',
      user_role || 'Staff',
      patient_name || null,
      location || 'Clinic Station',
      details,
      severity || 'Info'
    ]);
    const created = await getQuery('SELECT * FROM activity_logs WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, activity: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
