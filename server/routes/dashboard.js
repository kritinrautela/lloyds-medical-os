const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../db');
const { requirePermission, requireAuth } = require('../middleware/auth');

/*
 * Dashboard data layer.
 *
 * Rule for this file: every figure returned is read or derived from the
 * database. Where a record has no value the field is returned as null so the
 * interface can print an em dash instead of inventing a plausible number.
 * Nothing here carries a default that could be mistaken for a measurement.
 */

const ONLINE_WINDOW_MINUTES = 5;
const EXPIRY_HORIZON_DAYS = 90;

// SQLite stores CURRENT_TIMESTAMP in UTC, so ages are computed in SQL where
// both sides of the subtraction are UTC.
// Presentations that actually drive workload in a Papua New Guinea clinic
// serving a mining district. The list decides how recorded diagnoses are
// grouped for the surveillance panel; it never invents a case.
const CONDITION_GROUPS = [
  { label: 'Malaria', match: ['malaria', 'falciparum', 'vivax', 'plasmodium'] },
  { label: 'Respiratory infection', match: ['pneumonia', 'respiratory', 'asthma', 'bronch', 'cough'] },
  { label: 'Diarrhoeal illness', match: ['diarrhoea', 'diarrhea', 'gastroenteritis', 'dysentery', 'cholera'] },
  { label: 'Tuberculosis', match: ['tuberculosis', ' tb ', 'tb.', 'ptb'] },
  { label: 'Snakebite and envenoming', match: ['snake', 'envenom', 'taipan', 'adder'] },
  { label: 'Injury and trauma', match: ['wound', 'laceration', 'fracture', 'trauma', 'injury', 'burn', 'crush'] },
  { label: 'Skin and soft tissue infection', match: ['abscess', 'cellulitis', 'boil', 'ulcer', 'scabies'] },
  { label: 'Typhoid and enteric fever', match: ['typhoid', 'enteric fever'] },
  { label: 'Heat illness and dehydration', match: ['heat exhaustion', 'heat stroke', 'dehydration'] },
  { label: 'Maternal and antenatal', match: ['antenatal', 'pregnan', 'obstetric', 'postnatal'] }
];

const MINUTES_SINCE = (col) => `CAST((julianday('now') - julianday(${col})) * 1440 AS INTEGER)`;

router.get('/stats', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + EXPIRY_HORIZON_DAYS);
    const horizonStr = horizon.toISOString().split('T')[0];

    // ---------------------------------------------------------------- census
    const { total_patients } = (await getQuery(
      'SELECT COUNT(*) as total_patients FROM patients'
    )) || { total_patients: 0 };

    const { new_patients_today } = (await getQuery(
      'SELECT COUNT(*) as new_patients_today FROM patients WHERE date(created_at) = ?',
      [todayStr]
    )) || { new_patients_today: 0 };

    const { today_visitors } = (await getQuery(
      'SELECT COUNT(*) as today_visitors FROM visits WHERE visit_date = ?',
      [todayStr]
    )) || { today_visitors: 0 };

    const STAGES = ['Waiting', 'Triage / Vitals', 'In Consultation', 'At Pharmacy', 'Completed'];

    // Count and longest wait per stage, in one pass.
    const stageRows = await allQuery(
      `SELECT status,
              COUNT(*) as count,
              MAX(${MINUTES_SINCE('created_at')}) as longest_wait_minutes
       FROM visits
       WHERE visit_date = ?
       GROUP BY status`,
      [todayStr]
    );

    const queueMap = {};
    const stageWait = {};
    STAGES.forEach((s) => { queueMap[s] = 0; stageWait[s] = null; });
    stageRows.forEach((row) => {
      queueMap[row.status] = row.count;
      // A completed visit is no longer waiting, so its age is not a wait time.
      stageWait[row.status] = row.status === 'Completed' ? null : row.longest_wait_minutes;
    });

    const open_visits = STAGES.slice(0, 4).reduce((sum, s) => sum + (queueMap[s] || 0), 0);

    const waitRow = await getQuery(
      `SELECT MAX(${MINUTES_SINCE('created_at')}) as longest,
              AVG(${MINUTES_SINCE('created_at')}) as average
       FROM visits
       WHERE visit_date = ? AND status != 'Completed'`,
      [todayStr]
    );

    const longest_wait_minutes = waitRow && waitRow.longest !== null ? waitRow.longest : null;
    const average_wait_minutes =
      waitRow && waitRow.average !== null ? Math.round(waitRow.average) : null;

    // Median door-to-completion for visits actually finished today.
    const turnaroundRow = await getQuery(
      `SELECT AVG((julianday(completed_at) - julianday(created_at)) * 1440) as avg_minutes,
              COUNT(*) as n
       FROM visits
       WHERE visit_date = ? AND completed_at IS NOT NULL`,
      [todayStr]
    );
    const average_turnaround_minutes =
      turnaroundRow && turnaroundRow.n > 0 && turnaroundRow.avg_minutes !== null
        ? Math.round(turnaroundRow.avg_minutes)
        : null;

    // ------------------------------------------------------------- financial
    const { today_pharmacy_revenue } = (await getQuery(
      `SELECT COALESCE(SUM(paid_amount), 0) as today_pharmacy_revenue
       FROM dispensations WHERE date(created_at) = ?`,
      [todayStr]
    )) || { today_pharmacy_revenue: 0 };

    const { today_opd_fees } = (await getQuery(
      `SELECT COALESCE(SUM(consultation_fee), 0) as today_opd_fees
       FROM visits WHERE visit_date = ?`,
      [todayStr]
    )) || { today_opd_fees: 0 };

    const { total_pharmacy_revenue } = (await getQuery(
      'SELECT COALESCE(SUM(paid_amount), 0) as total_pharmacy_revenue FROM dispensations'
    )) || { total_pharmacy_revenue: 0 };

    const discountRow = (await getQuery(
      `SELECT COALESCE(SUM(discount), 0) as discount_total,
              COALESCE(SUM(total_amount), 0) as gross_total,
              COUNT(*) as transactions
       FROM dispensations WHERE date(created_at) = ?`,
      [todayStr]
    )) || { discount_total: 0, gross_total: 0, transactions: 0 };

    // --------------------------------------------------------------- pharmacy
    const lowStockDrugs = (await allQuery(
      `SELECT id, code, name, category, stock_quantity, min_stock_alert, unit_price
       FROM drugs
       WHERE stock_quantity <= min_stock_alert
       ORDER BY (CAST(stock_quantity AS REAL) / NULLIF(min_stock_alert, 0)) ASC, name ASC`
    )) || [];

    const low_stock_count = lowStockDrugs.length;
    const out_of_stock_count = lowStockDrugs.filter((d) => d.stock_quantity <= 0).length;

    const expiringDrugs = (await allQuery(
      `SELECT id, code, name, category, batch_number, expiry_date, stock_quantity,
              CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as days_to_expiry
       FROM drugs
       WHERE expiry_date IS NOT NULL AND expiry_date <= ? AND stock_quantity > 0
       ORDER BY expiry_date ASC`,
      [horizonStr]
    )) || [];

    const expiring_soon_count = expiringDrugs.length;
    const expired_count = expiringDrugs.filter((d) => d.days_to_expiry < 0).length;

    const { formulary_value } = (await getQuery(
      'SELECT COALESCE(SUM(stock_quantity * cost_price), 0) as formulary_value FROM drugs'
    )) || { formulary_value: 0 };

    const { items_dispensed_today } = (await getQuery(
      `SELECT COALESCE(SUM(di.quantity), 0) as items_dispensed_today
       FROM dispensation_items di
       JOIN dispensations d ON di.dispensation_id = d.id
       WHERE date(d.created_at) = ?`,
      [todayStr]
    )) || { items_dispensed_today: 0 };

    // -------------------------------------------------------------- clinical
    const urgentVisits = await allQuery(
      `SELECT v.id, v.visit_code, v.reason, v.triage_priority, v.status, v.diagnosis,
              v.bp, v.pulse, v.temp, v.resp_rate, v.spo2, v.doctor_name,
              ${MINUTES_SINCE('v.created_at')} as waiting_minutes,
              p.full_name as patient_name, p.patient_code, p.age, p.gender, p.allergies
       FROM visits v
       JOIN patients p ON v.patient_id = p.id
       WHERE v.visit_date = ?
         AND v.triage_priority IN ('Urgent', 'Emergency')
         AND v.status != 'Completed'
       ORDER BY CASE v.triage_priority WHEN 'Emergency' THEN 0 ELSE 1 END, v.created_at ASC`,
      [todayStr]
    );

    const activeVisits = await allQuery(
      `SELECT v.id, v.visit_code, v.reason, v.triage_priority, v.status,
              v.bp, v.pulse, v.temp, v.resp_rate, v.spo2,
              ${MINUTES_SINCE('v.created_at')} as waiting_minutes,
              p.full_name as patient_name, p.patient_code, p.age, p.gender
       FROM visits v
       JOIN patients p ON v.patient_id = p.id
       WHERE v.visit_date = ? AND v.status != 'Completed'
       ORDER BY v.created_at ASC`,
      [todayStr]
    );

    const beds = (await allQuery('SELECT * FROM inpatient_beds ORDER BY id ASC')) || [];
    const occupied_beds = beds.filter((b) => b.status === 'Occupied').length;
    const available_beds = beds.filter((b) => b.status === 'Available').length;
    const total_beds = beds.length;

    // ---------------------------------------------------------------- trends
    const footfallTrend = await allQuery(
      `SELECT visit_date,
              COUNT(*) as count,
              COALESCE(SUM(consultation_fee), 0) as fees
       FROM visits
       WHERE visit_date >= date('now', '-6 days')
       GROUP BY visit_date
       ORDER BY visit_date ASC`
    );

    const topDiagnoses = await allQuery(
      `SELECT diagnosis, COUNT(*) as count
       FROM visits
       WHERE diagnosis IS NOT NULL AND TRIM(diagnosis) != ''
       GROUP BY diagnosis ORDER BY count DESC LIMIT 6`
    );

    const topMedicines = await allQuery(
      `SELECT drug_name, SUM(quantity) as total_dispensed
       FROM dispensation_items
       GROUP BY drug_name ORDER BY total_dispensed DESC LIMIT 6`
    );

    // Condition groups over the last 30 days. Each visit is counted once, and
    // only if a clinician actually wrote something matching into the diagnosis
    // or the presenting reason. This is a count of what was written down, not
    // a laboratory-confirmed case count, and the interface says so.
    const surveillanceWindow = (await allQuery(
      `SELECT diagnosis, reason
       FROM visits
       WHERE date(visit_date) >= date('now', '-30 day')`
    )) || [];

    const conditionGroups = CONDITION_GROUPS.map((group) => {
      const visits = surveillanceWindow.filter((v) => {
        const text = `${v.diagnosis || ''} ${v.reason || ''}`.toLowerCase();
        return group.match.some((term) => text.includes(term));
      }).length;
      return { label: group.label, visits };
    }).filter((g) => g.visits > 0).sort((a, b) => b.visits - a.visits);

    // ------------------------------------------------- governance and audit
    // Who dispensed what today. This is the ledger that makes stock leaving
    // the pharmacy attributable to a named member of staff.
    const dispensingByStaff = await allQuery(
      `SELECT COALESCE(NULLIF(TRIM(dispensed_by_name), ''), 'Unattributed') as staff_name,
              dispensed_by_role as staff_role,
              COUNT(*) as transactions,
              COALESCE(SUM(paid_amount), 0) as collected,
              COALESCE(SUM(discount), 0) as discount_given,
              SUM(CASE WHEN discount > 0 THEN 1 ELSE 0 END) as discounted_transactions,
              SUM(CASE WHEN paid_amount = 0 THEN 1 ELSE 0 END) as zero_paid_transactions
       FROM dispensations
       WHERE date(created_at) = ?
       GROUP BY staff_name, staff_role
       ORDER BY collected DESC`,
      [todayStr]
    );

    // Transactions that deserve a second look at shift close: money was
    // discounted or nothing was collected at all.
    const flaggedDispensations = await allQuery(
      `SELECT id, invoice_number, patient_name, total_amount, discount, paid_amount,
              payment_method, dispensed_by_name, created_at
       FROM dispensations
       WHERE date(created_at) = ? AND (discount > 0 OR paid_amount = 0)
       ORDER BY discount DESC, id DESC
       LIMIT 20`,
      [todayStr]
    );

    const eodToday = await getQuery(
      'SELECT * FROM end_of_day_reports WHERE report_date = ?',
      [todayStr]
    );

    // Trading days with money recorded but no shift close filed.
    const unreconciledDays = await allQuery(
      `SELECT v.visit_date as day, COUNT(*) as visits
       FROM visits v
       WHERE v.visit_date < ?
         AND v.visit_date >= date('now', '-30 days')
         AND NOT EXISTS (
           SELECT 1 FROM end_of_day_reports e WHERE e.report_date = v.visit_date
         )
       GROUP BY v.visit_date
       ORDER BY v.visit_date DESC`,
      [todayStr]
    );

    // ------------------------------------------------ registers and returns
    const followUpRows = await allQuery(
      `SELECT v.id, v.follow_up_date, v.follow_up_note, v.patient_id, p.full_name AS patient_name, p.hospital_number,
              CAST(julianday(v.follow_up_date) - julianday(date('now', 'localtime')) AS INTEGER) AS days_until,
              (SELECT MAX(visit_date) FROM visits w WHERE w.patient_id = v.patient_id AND w.id != v.id AND w.visit_date >= v.follow_up_date) AS attended_on
       FROM visits v JOIN patients p ON p.id = v.patient_id
       WHERE v.follow_up_date IS NOT NULL AND v.follow_up_date <= date('now', 'localtime')
         AND v.id = (SELECT MAX(id) FROM visits x WHERE x.patient_id = v.patient_id AND x.follow_up_date IS NOT NULL)
       ORDER BY v.follow_up_date ASC`
    );
    const followUpsDue = followUpRows.filter((r) => !r.attended_on);
    const follow_ups_due_today = followUpsDue.filter((r) => r.days_until === 0).length;
    const follow_ups_overdue = followUpsDue.filter((r) => r.days_until < 0).length;

    const openReferrals = await allQuery(
      `SELECT r.id, r.referral_code, r.referred_to, r.urgency, r.created_at, p.full_name AS patient_name, p.hospital_number,
              CAST(julianday('now') - julianday(r.created_at) AS INTEGER) AS days_open
       FROM referrals r JOIN patients p ON p.id = r.patient_id
       WHERE r.outcome = 'Awaiting outcome' ORDER BY r.created_at ASC LIMIT 50`
    );

    const { notifiable_30d } = (await getQuery(
      `SELECT COUNT(*) AS notifiable_30d FROM visits
       WHERE notifiable_condition IS NOT NULL AND notifiable_condition != '' AND date(visit_date) >= date('now', '-30 day')`
    )) || { notifiable_30d: 0 };
    const { notifiable_today } = (await getQuery(
      `SELECT COUNT(*) AS notifiable_today FROM visits
       WHERE notifiable_condition IS NOT NULL AND notifiable_condition != '' AND visit_date = ?`, [todayStr]
    )) || { notifiable_today: 0 };

    const { unfit_open } = (await getQuery(
      `SELECT COUNT(*) AS unfit_open FROM visits
       WHERE fitness_status IN ('Unfit for work', 'Fit with restrictions')
         AND fitness_until IS NOT NULL AND fitness_until >= date('now', 'localtime')`
    )) || { unfit_open: 0 };

    const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    const syncConfig = await getQuery('SELECT * FROM cloud_sync_config LIMIT 1');

    const lastSuccessfulSync = await getQuery(
      `SELECT * FROM sync_logs WHERE status = 'Success' ORDER BY id DESC LIMIT 1`
    );

    const lastExport = await getQuery(
      `SELECT * FROM activity_logs
       WHERE action_type IN ('Protected Excel Export', 'Database Backup')
       ORDER BY id DESC LIMIT 1`
    );

    const activities = (await allQuery(
      'SELECT * FROM activity_logs ORDER BY id DESC LIMIT 40'
    )) || [];

    const { audit_events_today } = (await getQuery(
      `SELECT COUNT(*) as audit_events_today FROM activity_logs WHERE date(created_at) = ?`,
      [todayStr]
    )) || { audit_events_today: 0 };

    // ------------------------------------------------------------- presence
    const staff = (await allQuery(
      `SELECT id, full_name, role, department, staff_id, status, last_login, last_seen,
              ${MINUTES_SINCE('last_seen')} as minutes_since_seen
       FROM users
       ORDER BY (last_seen IS NULL), last_seen DESC`
    )) || [];

    const staffPresence = staff.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      role: u.role,
      department: u.department,
      staff_id: u.staff_id,
      account_status: u.status,
      last_login: u.last_login,
      last_seen: u.last_seen,
      minutes_since_seen: u.last_seen ? u.minutes_since_seen : null,
      online: !!u.last_seen && u.minutes_since_seen !== null && u.minutes_since_seen <= ONLINE_WINDOW_MINUTES
    }));

    const staff_online = staffPresence.filter((u) => u.online).length;

    // --------------------------------------------------------------- notes
    const shiftNotes =
      (await allQuery('SELECT * FROM shift_handover_notes ORDER BY id DESC LIMIT 20')) || [];
    const incidents =
      (await allQuery('SELECT * FROM occupational_incidents ORDER BY incident_date DESC, id DESC LIMIT 20')) || [];

    const { open_restricted_duty } = (await getQuery(
      `SELECT COUNT(*) as open_restricted_duty FROM occupational_incidents
       WHERE fit_for_work_status IS NOT NULL
         AND fit_for_work_status != 'Fit for Full Duty'`
    )) || { open_restricted_duty: 0 };

    const { incidents_30d } = (await getQuery(
      `SELECT COUNT(*) as incidents_30d FROM occupational_incidents
       WHERE incident_date >= date('now', '-30 days')`
    )) || { incidents_30d: 0 };

    const lastIncident = await getQuery(
      `SELECT incident_date FROM occupational_incidents ORDER BY incident_date DESC LIMIT 1`
    );

    const days_since_last_incident = lastIncident
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(`${lastIncident.incident_date}T00:00:00`).getTime()) / 86400000
          )
        )
      : null;

    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      stats: {
        // The client reads only the stats object, so the timestamp is repeated
        // inside it. The board prints how old its figures are rather than
        // implying they are live.
        generated_at: new Date().toISOString(),

        // census
        total_patients,
        new_patients_today,
        today_visitors,
        queueMap,
        stageWait,
        open_visits,
        longest_wait_minutes,
        average_wait_minutes,
        average_turnaround_minutes,

        // financial
        today_pharmacy_revenue,
        today_opd_fees,
        total_revenue_today: today_pharmacy_revenue + today_opd_fees,
        total_pharmacy_revenue,
        discount_total_today: discountRow.discount_total,
        gross_sales_today: discountRow.gross_total,
        dispense_transactions_today: discountRow.transactions,
        items_dispensed_today,

        // pharmacy
        low_stock_count,
        out_of_stock_count,
        lowStockDrugs,
        expiring_soon_count,
        expired_count,
        expiringDrugs,
        formulary_value,

        // clinical
        urgentVisits,
        activeVisits,
        beds,
        occupied_beds,
        available_beds,
        total_beds,

        // trends
        footfallTrend,
        topDiagnoses,
        topMedicines,
        conditionGroups,
        conditionGroupsWindowDays: 30,
        conditionGroupsVisitsConsidered: surveillanceWindow.length,

        // governance
        dispensingByStaff,
        flaggedDispensations,
        endOfDayToday: eodToday || null,
        unreconciledDays,
        exportProtected: !!(settings && settings.export_password && settings.export_password.length > 0),
        liveSince: (settings && settings.live_since) || null,
        // A brand new installation carries sample records so staff can be
        // trained before the clinic opens. Until they are cleared the board
        // says so, rather than letting invented patients read as real ones.
        sampleDataPresent: !(settings && settings.live_since),
        lastExport: lastExport || null,
        cloudSync: syncConfig
          ? {
              sync_enabled: !!syncConfig.sync_enabled,
              auto_sync_on_wifi: !!syncConfig.auto_sync_on_wifi,
              configured: !!(syncConfig.webhook_url && syncConfig.webhook_url.startsWith('http')),
              google_account_email: syncConfig.google_account_email || null,
              google_sheet_id: syncConfig.google_sheet_id || null,
              last_synced_at: syncConfig.last_synced_at || null,
              last_sync_status: syncConfig.last_sync_status || 'Never synced',
              last_sync_message: syncConfig.last_sync_message || null,
              records_synced_count: syncConfig.records_synced_count || 0,
              last_successful_sync_at: lastSuccessfulSync ? lastSuccessfulSync.synced_at : null
            }
          : null,
        activities,
        audit_events_today,

        // presence
        staffPresence,
        staff_online,

        // registers and returns
        followUpsDue: followUpsDue.slice(0, 20),
        follow_ups_due_today,
        follow_ups_overdue,
        openReferrals,
        open_referrals: openReferrals.length,
        notifiable_30d,
        notifiable_today,
        unfit_open,

        // notes and safety
        shiftNotes,
        incidents,
        incidents_30d,
        open_restricted_duty,
        days_since_last_incident
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Presence heartbeat. The client pings this while a session is open so the
 * control board can show who is actually on the system right now rather than
 * who logged in at some point today.
 */
router.post('/heartbeat', requireAuth, async (req, res) => {
  try {
    // Presence is read from the session, not from a name in the request. The
    // old version let anybody mark any member of staff as present, which made
    // "staff on the system" evidence of nothing.
    await runQuery('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id]);
    res.json({ success: true, at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dashboard/shift-notes
router.post('/shift-notes', requirePermission('notes.write'), async (req, res) => {
  try {
    const { shift_type, priority, category, title, note_content } = req.body;
    // The author is whoever is signed in. A handover note is a clinical
    // instruction to the next shift, so it has to carry a real name.
    const author_name = req.user.full_name;
    const author_role = req.user.role;
    if (!title || !note_content) {
      return res.status(400).json({ success: false, message: 'Title and note content are required.' });
    }

    const result = await runQuery(
      `INSERT INTO shift_handover_notes
         (shift_type, author_name, author_role, priority, category, title, note_content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        shift_type || 'Day Shift (06:00 - 18:00)',
        author_name,
        author_role,
        priority || 'Standard',
        category || 'General',
        title,
        note_content
      ]
    );

    await runQuery(
      `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
       VALUES ('Shift Handover Note', ?, ?, 'Clinical Handover', ?, ?)`,
      [
        author_name,
        author_role,
        `${priority || 'Standard'} note recorded: ${title}`,
        priority === 'Critical Emergency' ? 'Emergency' : 'Info'
      ]
    );

    const created = await getQuery('SELECT * FROM shift_handover_notes WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, note: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/dashboard/beds/:id — admit, discharge, or change bed state
router.put('/beds/:id', requirePermission('beds.manage'), async (req, res) => {
  try {
    const {
      status, patient_name, patient_code, patient_id, age, gender,
      acuity_level, diagnosis, attending_doctor, vitals_ticker, notes
    } = req.body;

    const existing = await getQuery('SELECT * FROM inpatient_beds WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Bed not found' });

    const isAdmitting = status === 'Occupied' && existing.status !== 'Occupied';
    const isDischarging = status !== 'Occupied' && existing.status === 'Occupied';
    const clearing = status !== 'Occupied';

    if (isAdmitting && (!patient_name || !String(patient_name).trim())) {
      return res.status(400).json({
        success: false,
        message: 'A patient name is required to occupy a bed.'
      });
    }

    await runQuery(
      `UPDATE inpatient_beds SET
         status = COALESCE(?, status),
         patient_name = ?,
         patient_code = ?,
         patient_id = ?,
         age = ?,
         gender = ?,
         admission_date = CASE
           WHEN ? = 'Occupied' AND admission_date IS NULL THEN CURRENT_TIMESTAMP
           WHEN ? != 'Occupied' THEN NULL
           ELSE admission_date END,
         acuity_level = ?,
         diagnosis = ?,
         attending_doctor = ?,
         vitals_ticker = ?,
         notes = ?
       WHERE id = ?`,
      [
        status,
        clearing ? null : (patient_name || existing.patient_name),
        clearing ? null : (patient_code || existing.patient_code),
        clearing ? null : (patient_id || existing.patient_id),
        clearing ? null : (age || existing.age),
        clearing ? null : (gender || existing.gender),
        status,
        status,
        clearing ? null : (acuity_level || existing.acuity_level),
        clearing ? null : (diagnosis || existing.diagnosis),
        clearing ? null : (attending_doctor || existing.attending_doctor),
        // Never carry a previous patient's vitals onto an empty bed.
        clearing ? null : (vitals_ticker !== undefined ? vitals_ticker : existing.vitals_ticker),
        notes !== undefined ? notes : existing.notes,
        req.params.id
      ]
    );

    if (isAdmitting) {
      await runQuery(
        `INSERT INTO activity_logs
           (action_type, user_name, user_role, patient_name, location, details, severity)
         VALUES ('Inpatient Admission', ?, 'Clinical Staff', ?, ?, ?, 'Warning')`,
        [
          (attending_doctor || '').trim() || req.user.full_name,
          patient_name,
          `${existing.ward_name} (${existing.bed_code})`,
          `Admitted to ${existing.bed_code}. Diagnosis: ${diagnosis || 'not recorded'}. Acuity: ${acuity_level || 'not recorded'}.`
        ]
      );
    } else if (isDischarging) {
      await runQuery(
        `INSERT INTO activity_logs
           (action_type, user_name, user_role, patient_name, location, details, severity)
         VALUES ('Inpatient Discharge', ?, 'Nursing Staff', ?, ?, ?, 'Info')`,
        [
          existing.attending_doctor || 'Ward Nurse',
          existing.patient_name || 'Patient',
          `${existing.ward_name} (${existing.bed_code})`,
          `Discharged from ${existing.bed_code}. Bed set to ${status}. ${notes || ''}`.trim()
        ]
      );
    }

    const updated = await getQuery('SELECT * FROM inpatient_beds WHERE id = ?', [req.params.id]);
    res.json({ success: true, bed: updated });
  } catch (err) {
    console.error('Update bed error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dashboard/activities — append to the audit trail
/*
 * The audit trail is the whole basis of staff accountability here, so the name
 * on an entry has to be the name of the person who made it.
 *
 * This route previously accepted a name and a role in the request body and
 * wrote them down as fact, with no sign-in required at all. Anyone on the
 * clinic network could have written an entry under somebody else's name — the
 * exact opposite of what an audit trail is for. The name and role now come
 * from the session and the ones in the request body are ignored.
 *
 * Severity is fixed at Info. An entry the client can label "Emergency" would
 * let a member of staff bury a real alert in noise.
 */
router.post('/activities', requireAuth, async (req, res) => {
  try {
    const { action_type, patient_name, location, details } = req.body;
    if (!action_type || !details) {
      return res.status(400).json({ success: false, message: 'action_type and details are required' });
    }

    const result = await runQuery(
      `INSERT INTO activity_logs
         (action_type, user_name, user_role, patient_name, location, details, severity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        action_type,
        req.user.full_name,
        req.user.role,
        patient_name || null,
        location || 'Clinic Station',
        details,
        'Info'
      ]
    );

    const created = await getQuery('SELECT * FROM activity_logs WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, activity: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
