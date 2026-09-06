const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../db');

/*
 * Referrals to another facility.
 *
 * The clinic can stabilise and treat, but a fracture that needs plating, a
 * severe malaria that needs a ward, or a pregnancy that has gone wrong goes to
 * Angau Memorial in Lae. A referral here is the record that the patient was
 * sent, why, how, and by whom, and it stays open until somebody writes down
 * what happened to them. The open list is on the clinical board so a patient
 * sent away on a Friday is still somebody's business on Monday.
 */

const URGENCIES = ['Routine', 'Urgent', 'Emergency'];
const OUTCOMES = ['Awaiting outcome', 'Seen and returned', 'Admitted', 'Did not attend', 'Transferred elsewhere', 'Died'];

async function logEvent(action, user, role, patientName, details, severity = 'Info') {
  try {
    await runQuery(
      `INSERT INTO activity_logs (action_type, user_name, user_role, patient_name, location, details, severity)
       VALUES (?, ?, ?, ?, 'Referrals', ?, ?)`,
      [action, user || 'Unattributed', role || '', patientName || null, details, severity]
    );
  } catch (err) {
    console.error('Activity log write failed:', err.message);
  }
}

const SELECT = `
  SELECT r.*, p.full_name AS patient_name, p.hospital_number, p.patient_code, p.age, p.gender,
         p.address_or_village, p.phone, p.allergies, p.blood_group,
         v.visit_code, v.diagnosis, v.bp, v.pulse, v.temp, v.spo2, v.resp_rate, v.weight
  FROM referrals r
  JOIN patients p ON p.id = r.patient_id
  LEFT JOIN visits v ON v.id = r.visit_id`;

// GET /api/referrals?status=open|closed|all&from=&to=&patient_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status = 'all', from, to, patient_id } = req.query;
    const where = [];
    const params = [];
    if (status === 'open') where.push(`r.outcome = 'Awaiting outcome'`);
    if (status === 'closed') where.push(`r.outcome != 'Awaiting outcome'`);
    if (from) { where.push('date(r.created_at) >= date(?)'); params.push(from); }
    if (to) { where.push('date(r.created_at) <= date(?)'); params.push(to); }
    if (patient_id) { where.push('r.patient_id = ?'); params.push(patient_id); }
    const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.id DESC LIMIT 500`;
    const referrals = await allQuery(sql, params);
    res.json({ success: true, referrals });
  } catch (err) {
    console.error('List referrals error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const referral = await getQuery(`${SELECT} WHERE r.id = ?`, [req.params.id]);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });
    res.json({ success: true, referral });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/referrals
router.post('/', requirePermission('queue.consult'), async (req, res) => {
  try {
    const { patient_id, visit_id, referred_to, department, urgency, transport, reason, clinical_summary } = req.body;
    if (!patient_id || !referred_to || !String(referred_to).trim() || !reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'A referral needs a patient, a facility to send them to, and a reason.' });
    }
    const patient = await getQuery('SELECT id, full_name, hospital_number FROM patients WHERE id = ?', [patient_id]);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const level = URGENCIES.includes(urgency) ? urgency : 'Routine';
    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = `REF-${todayStr.replace(/-/g, '')}-`;

    let result = null;
    let code = null;
    for (let attempt = 0; attempt < 8 && !result; attempt += 1) {
      const last = await getQuery(
        'SELECT referral_code FROM referrals WHERE referral_code LIKE ? ORDER BY referral_code DESC LIMIT 1',
        [`${prefix}%`]
      );
      let seq = 1;
      if (last && last.referral_code) {
        const n = parseInt(last.referral_code.split('-').pop(), 10);
        if (!Number.isNaN(n)) seq = n + 1;
      }
      code = `${prefix}${String(seq + attempt).padStart(3, '0')}`;
      try {
        result = await runQuery(
          `INSERT INTO referrals (referral_code, patient_id, visit_id, referred_to, department, urgency, transport,
                                  reason, clinical_summary, referred_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, patient.id, visit_id || null, String(referred_to).trim(), department || '', level, transport || '',
           String(reason).trim(), clinical_summary || '', req.user.full_name]
        );
      } catch (err) {
        if (!String(err.message).includes('UNIQUE')) throw err;
      }
    }
    if (!result) return res.status(409).json({ success: false, message: 'Could not allocate a referral number. Try once more.' });

    await logEvent(
      'Patient referred', req.user.full_name, req.user.role, patient.full_name,
      `${code}: ${patient.full_name} (${patient.hospital_number || ''}) referred to ${String(referred_to).trim()}, ${level.toLowerCase()}. Reason: ${String(reason).trim()}`,
      level === 'Emergency' ? 'Warning' : 'Notice'
    );

    const referral = await getQuery(`${SELECT} WHERE r.id = ?`, [result.lastID]);
    res.status(201).json({ success: true, referral });
  } catch (err) {
    console.error('Create referral error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/referrals/:id/outcome
router.put('/:id/outcome', requirePermission('queue.triage'), async (req, res) => {
  try {
    const { outcome, outcome_note } = req.body;
    if (!OUTCOMES.includes(outcome)) {
      return res.status(400).json({ success: false, message: 'Choose one of the listed outcomes.' });
    }
    const before = await getQuery(`${SELECT} WHERE r.id = ?`, [req.params.id]);
    if (!before) return res.status(404).json({ success: false, message: 'Referral not found' });

    const closing = outcome !== 'Awaiting outcome';
    await runQuery(
      `UPDATE referrals SET outcome = ?, outcome_note = ?, outcome_by = ?, outcome_at = ? WHERE id = ?`,
      [outcome, outcome_note || '', closing ? req.user.full_name : null, closing ? new Date().toISOString() : null, req.params.id]
    );

    await logEvent(
      'Referral outcome recorded', req.user.full_name, req.user.role, before.patient_name,
      `${before.referral_code}: outcome "${outcome}"${outcome_note ? ` — ${outcome_note}` : ''}.`,
      outcome === 'Died' ? 'Critical' : 'Info'
    );

    const referral = await getQuery(`${SELECT} WHERE r.id = ?`, [req.params.id]);
    res.json({ success: true, referral });
  } catch (err) {
    console.error('Referral outcome error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
