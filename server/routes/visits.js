const express = require('express');
const router = express.Router();
const { requirePermission, requireAuth } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../db');
const { notifiableFor, RDT_RESULTS, FITNESS_STATUSES } = require('../lib/publicHealth');

/*
 * Clinical and money-touching events are written to the tamper-evident
 * activity log. A consultation sets the fee that reception later collects, so
 * every change needs a name against it. A failed log write must never block
 * clinical care, so it is caught and reported to the console only.
 */
async function logEvent(action, user, patientName, details, severity = 'Info') {
  try {
    await runQuery(
      `INSERT INTO activity_logs (action_type, user_name, user_role, patient_name, location, details, severity)
       VALUES (?, ?, ?, ?, 'Outpatients', ?, ?)`,
      [action, user || 'Unattributed', '', patientName || null, details, severity]
    );
  } catch (err) {
    console.error('Activity log write failed:', err.message);
  }
}

async function visitContext(id) {
  return getQuery(
    `SELECT v.id, v.visit_code, v.consultation_fee, v.status, v.rdt_result, v.notifiable_condition, v.diagnosis,
            v.follow_up_date, v.fitness_status, p.full_name AS patient_name
     FROM visits v JOIN patients p ON v.patient_id = p.id WHERE v.id = ?`,
    [id]
  );
}

// GET /api/visits/today (Live OPD Queue for current day)
router.get('/today', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const visits = await allQuery(`
      SELECT v.*, p.patient_code, p.hospital_number, p.photo_path, p.photo_taken_at, p.full_name as patient_name, p.age, p.gender, p.phone, p.allergies, p.blood_group
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

/*
 * GET /api/visits/follow-ups?days=7
 * Patients asked to come back. A return is "due" from its date until the
 * patient attends again on or after that date, or a later consultation sets a
 * new date. Overdue means the date has passed with no attendance since.
 */
router.get('/follow-ups', requireAuth, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(0, parseInt(req.query.days, 10) || 7));
    const rows = await allQuery(
      `SELECT v.id, v.visit_code, v.visit_date, v.follow_up_date, v.follow_up_note, v.diagnosis, v.doctor_name,
              p.id AS patient_id, p.full_name AS patient_name, p.hospital_number, p.age, p.gender,
              p.address_or_village, p.phone, p.allergies,
              CAST(julianday(v.follow_up_date) - julianday(date('now', 'localtime')) AS INTEGER) AS days_until,
              (SELECT MAX(visit_date) FROM visits w WHERE w.patient_id = v.patient_id AND w.id != v.id AND w.visit_date >= v.follow_up_date) AS attended_on
       FROM visits v JOIN patients p ON p.id = v.patient_id
       WHERE v.follow_up_date IS NOT NULL
         AND v.follow_up_date <= date('now', 'localtime', '+' || ? || ' days')
         AND v.id = (SELECT MAX(id) FROM visits x WHERE x.patient_id = v.patient_id AND x.follow_up_date IS NOT NULL)
       ORDER BY v.follow_up_date ASC, v.id ASC`,
      [days]
    );
    const followUps = rows.filter((r) => !r.attended_on).map((r) => ({
      ...r,
      state: r.days_until < 0 ? 'Overdue' : r.days_until === 0 ? 'Due today' : 'Coming up'
    }));
    res.json({ success: true, days, followUps });
  } catch (err) {
    console.error('Follow-ups error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/visits (Filtered by date, status, or patient)
router.get('/', async (req, res) => {
  try {
    const { date, status, patient_id } = req.query;
    let sql = `
      SELECT v.*, p.patient_code, p.hospital_number, p.photo_path, p.photo_taken_at, p.full_name as patient_name, p.age, p.gender, p.phone
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
router.post('/', requirePermission('queue.checkIn'), async (req, res) => {
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

    // Nothing clinical or financial is invented here. This row becomes the
    // patient's permanent record of the visit and the basis of their receipt,
    // so an empty reason stays empty rather than becoming "General checkup",
    // an unnamed clinician stays unnamed rather than becoming whoever runs the
    // clinic, and a fee of zero stays zero. A default fee of 15 charged the
    // patient for a consultation the clinic had recorded as free, because
    // `0 || 15` is 15.
    const reasonGiven = (reason || '').toString().trim();
    if (!reasonGiven) {
      return res.status(400).json({
        success: false,
        message: 'Write why the patient has come. It is the first thing the clinician reads.'
      });
    }

    const fee = consultation_fee === undefined || consultation_fee === null || consultation_fee === ''
      ? 0
      : Number(consultation_fee);
    if (!Number.isFinite(fee) || fee < 0) {
      return res.status(400).json({ success: false, message: 'The consultation fee is not a number.' });
    }

    const result = await runQuery(`
      INSERT INTO visits (
        visit_code, patient_id, visit_date, reason, triage_priority, doctor_name, status,
        bp, pulse, temp, resp_rate, spo2, weight, consultation_fee, checked_in_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'Waiting', ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      visit_code,
      patient_id,
      todayStr,
      reasonGiven,
      triage_priority || 'Standard',
      (doctor_name || '').toString().trim(),
      bp || '',
      pulse || '',
      temp || '',
      resp_rate || '',
      spo2 || '',
      weight || '',
      fee,
      // Taken from the signed-in session, never from the request body, so it
      // is a record of who was actually at the desk.
      req.user ? req.user.full_name : null
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
router.put('/:id/status', requirePermission('queue.triage'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Waiting', 'Triage / Vitals', 'In Consultation', 'At Pharmacy', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const completedAt = status === 'Completed' ? new Date().toISOString() : null;
    const before = await visitContext(req.params.id);

    await runQuery(`
      UPDATE visits SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?
    `, [status, completedAt, req.params.id]);

    await logEvent(
      'Visit stage changed',
      req.body.moved_by,
      before?.patient_name,
      `${before?.visit_code || `Visit ${req.params.id}`} moved from ${before?.status || 'unknown'} to ${status}.`
    );

    const updated = await getQuery('SELECT * FROM visits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: `Status updated to ${status}`, visit: updated });
  } catch (err) {
    console.error('Update visit status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/visits/:id/vitals (Update clinical notes, diagnosis, vitals)
router.put('/:id/vitals', requirePermission('queue.triage'), async (req, res) => {
  try {
    const {
      bp, pulse, temp, resp_rate, spo2, weight, doctor_notes, diagnosis, doctor_name, triage_priority, consultation_fee,
      follow_up_date, follow_up_note, rdt_result, fitness_status, fitness_restrictions, fitness_until
    } = req.body;
    const before = await visitContext(req.params.id);

    // Values outside the fixed lists are not written: a typo must not become a
    // test result. An empty string clears a field; undefined leaves it alone.
    const clean = (value, allowed) => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return '';
      return allowed.includes(value) ? value : undefined;
    };
    const rdt = clean(rdt_result, RDT_RESULTS);
    const fitness = clean(fitness_status, FITNESS_STATUSES);
    const isoDate = (value) => (value === undefined ? undefined : (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value : ''));
    const followDate = isoDate(follow_up_date);
    const fitUntil = isoDate(fitness_until);

    // A reportable diagnosis is flagged from the clinician's own words. Malaria
    // is only "confirmed" when a test says so; otherwise it is recorded as a
    // clinical diagnosis, which the line list shows separately.
    let notifiable;
    if (diagnosis !== undefined) {
      notifiable = notifiableFor(diagnosis) || '';
      const testResult = rdt !== undefined ? rdt : before?.rdt_result;
      if (notifiable === 'Malaria, confirmed') {
        if (testResult === 'Negative') notifiable = '';
        else if (!testResult || !String(testResult).startsWith('Positive')) notifiable = 'Malaria, clinical diagnosis (not test-confirmed)';
      }
    } else if (rdt !== undefined && notifiableFor(before?.diagnosis) === 'Malaria, confirmed') {
      // Only the test result changed: re-read the flag from the existing
      // diagnosis so a later positive result restores it.
      notifiable = rdt === 'Negative' ? '' : (String(rdt).startsWith('Positive') ? 'Malaria, confirmed' : 'Malaria, clinical diagnosis (not test-confirmed)');
    }

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
        consultation_fee = COALESCE(?, consultation_fee),
        follow_up_date = COALESCE(NULLIF(?, ''), CASE WHEN ? = '' THEN NULL ELSE follow_up_date END),
        follow_up_note = COALESCE(?, follow_up_note),
        rdt_result = COALESCE(NULLIF(?, ''), CASE WHEN ? = '' THEN NULL ELSE rdt_result END),
        notifiable_condition = COALESCE(NULLIF(?, ''), CASE WHEN ? = '' THEN NULL ELSE notifiable_condition END),
        fitness_status = COALESCE(NULLIF(?, ''), CASE WHEN ? = '' THEN NULL ELSE fitness_status END),
        fitness_restrictions = COALESCE(?, fitness_restrictions),
        fitness_until = COALESCE(NULLIF(?, ''), CASE WHEN ? = '' THEN NULL ELSE fitness_until END)
      WHERE id = ?
    `, [bp, pulse, temp, resp_rate, spo2, weight, doctor_notes, diagnosis, doctor_name, triage_priority, consultation_fee,
        followDate, followDate, follow_up_note, rdt, rdt, notifiable, notifiable, fitness, fitness, fitness_restrictions, fitUntil, fitUntil,
        req.params.id]);

    const after = await getQuery('SELECT * FROM visits WHERE id = ?', [req.params.id]);
    if (after?.notifiable_condition && after.notifiable_condition !== before?.notifiable_condition) {
      await logEvent(
        'Reportable condition flagged', doctor_name, before?.patient_name,
        `${before?.visit_code || `Visit ${req.params.id}`}: "${after.notifiable_condition}" is on the reportable list. It appears on the notifiable line list for the provincial health office.`,
        'Notice'
      );
    }
    if (followDate && followDate !== before?.follow_up_date) {
      await logEvent('Return visit set', doctor_name, before?.patient_name,
        `${before?.visit_code || `Visit ${req.params.id}`}: asked to return on ${followDate}${follow_up_note ? ` (${follow_up_note})` : ''}.`);
    }
    if (fitness && fitness !== 'Not assessed' && fitness !== before?.fitness_status) {
      await logEvent('Fitness for work recorded', doctor_name, before?.patient_name,
        `${before?.visit_code || `Visit ${req.params.id}`}: ${fitness}${fitUntil ? ` until ${fitUntil}` : ''}${fitness_restrictions ? `. ${fitness_restrictions}` : ''}.`,
        fitness === 'Unfit for work' ? 'Notice' : 'Info');
    }

    const updated = await getQuery('SELECT * FROM visits WHERE id = ?', [req.params.id]);

    // A fee that departs from the recorded default is the event worth being
    // able to find later, so it is logged as its own line at Notice severity.
    const feeChanged =
      consultation_fee != null && before && Number(before.consultation_fee) !== Number(consultation_fee);

    await logEvent(
      'Consultation recorded',
      doctor_name,
      before?.patient_name,
      `${before?.visit_code || `Visit ${req.params.id}`}: ${diagnosis ? `diagnosis "${diagnosis}"` : 'observations'} saved.`
    );

    if (feeChanged) {
      await logEvent(
        'Consultation fee changed',
        doctor_name,
        before?.patient_name,
        `${before?.visit_code || `Visit ${req.params.id}`}: fee changed from ${before.consultation_fee ?? 'unset'} to ${consultation_fee}.`,
        'Notice'
      );
    }

    res.json({ success: true, message: 'Clinical observations saved', visit: updated });
  } catch (err) {
    console.error('Update vitals error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/visits/:id
router.delete('/:id', requirePermission('settings.clearRecords'), async (req, res) => {
  try {
    await runQuery('DELETE FROM visits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Visit record removed' });
  } catch (err) {
    console.error('Delete visit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
