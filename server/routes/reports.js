const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getQuery, allQuery } = require('../db');
const { AGE_BANDS, ageBandOf } = require('../lib/publicHealth');

/*
 * Reports read from the records as they stand. Nothing here is estimated or
 * carried forward: a month with no recorded attendances returns zeros, and a
 * field nobody filled in is counted as not recorded rather than as normal.
 */

function monthBounds(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  const from = `${m[1]}-${m[2]}-01`;
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const to = `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

// GET /api/reports/monthly?month=YYYY-MM
router.get('/monthly', requireAuth, async (req, res) => {
  try {
    const bounds = monthBounds(req.query.month);
    if (!bounds) return res.status(400).json({ success: false, message: 'Give the month as YYYY-MM.' });
    const { from, to } = bounds;

    const visits = await allQuery(
      `SELECT v.id, v.visit_date, v.patient_id, v.diagnosis, v.reason, v.triage_priority, v.status,
              v.rdt_result, v.notifiable_condition, v.fitness_status, v.consultation_fee, v.follow_up_date,
              p.age, p.gender, p.created_at AS registered_at
       FROM visits v JOIN patients p ON p.id = v.patient_id
       WHERE v.visit_date BETWEEN ? AND ?`,
      [from, to]
    );

    const bySex = { Male: 0, Female: 0, Other: 0 };
    const byBand = {};
    AGE_BANDS.forEach((b) => { byBand[b.label] = { Male: 0, Female: 0, total: 0 }; });
    byBand['Not recorded'] = { Male: 0, Female: 0, total: 0 };

    const firstVisitOfPatient = new Map();
    for (const v of visits) {
      const sex = v.gender === 'Male' || v.gender === 'Female' ? v.gender : 'Other';
      bySex[sex] += 1;
      const band = ageBandOf(v.age);
      byBand[band].total += 1;
      if (sex !== 'Other') byBand[band][sex] += 1;
      if (!firstVisitOfPatient.has(v.patient_id)) firstVisitOfPatient.set(v.patient_id, v.visit_date);
    }

    const { new_patients } = (await getQuery(
      `SELECT COUNT(*) AS new_patients FROM patients WHERE date(created_at) BETWEEN ? AND ?`, [from, to]
    )) || { new_patients: 0 };

    const diagnoses = await allQuery(
      `SELECT diagnosis, COUNT(*) AS cases FROM visits
       WHERE visit_date BETWEEN ? AND ? AND diagnosis IS NOT NULL AND TRIM(diagnosis) != ''
       GROUP BY diagnosis ORDER BY cases DESC, diagnosis ASC LIMIT 20`,
      [from, to]
    );

    const rdt = { done: 0, positive: 0, falciparum: 0, vivax: 0, mixed: 0, negative: 0, invalid: 0 };
    for (const v of visits) {
      const r = v.rdt_result || '';
      if (!r || r === 'Not done') continue;
      rdt.done += 1;
      if (r.startsWith('Positive')) rdt.positive += 1;
      if (r.includes('falciparum')) rdt.falciparum += 1;
      else if (r.includes('vivax')) rdt.vivax += 1;
      else if (r.includes('mixed')) rdt.mixed += 1;
      else if (r === 'Negative') rdt.negative += 1;
      else if (r.startsWith('Invalid')) rdt.invalid += 1;
    }

    const notifiable = await allQuery(
      `SELECT notifiable_condition AS condition, COUNT(*) AS cases FROM visits
       WHERE visit_date BETWEEN ? AND ? AND notifiable_condition IS NOT NULL AND notifiable_condition != ''
       GROUP BY notifiable_condition ORDER BY cases DESC`,
      [from, to]
    );

    const referrals = await allQuery(
      `SELECT urgency, outcome, referred_to, COUNT(*) AS n FROM referrals
       WHERE date(created_at) BETWEEN ? AND ? GROUP BY urgency, outcome, referred_to`,
      [from, to]
    );
    const referralSummary = {
      total: referrals.reduce((s, r) => s + r.n, 0),
      emergency: referrals.filter((r) => r.urgency === 'Emergency').reduce((s, r) => s + r.n, 0),
      awaiting: referrals.filter((r) => r.outcome === 'Awaiting outcome').reduce((s, r) => s + r.n, 0),
      did_not_attend: referrals.filter((r) => r.outcome === 'Did not attend').reduce((s, r) => s + r.n, 0),
      died: referrals.filter((r) => r.outcome === 'Died').reduce((s, r) => s + r.n, 0),
      destinations: Object.values(referrals.reduce((acc, r) => {
        acc[r.referred_to] = acc[r.referred_to] || { referred_to: r.referred_to, n: 0 };
        acc[r.referred_to].n += r.n;
        return acc;
      }, {})).sort((a, b) => b.n - a.n)
    };

    const fitness = { assessed: 0, fit: 0, restricted: 0, unfit: 0 };
    for (const v of visits) {
      const f = v.fitness_status || '';
      if (!f || f === 'Not assessed') continue;
      fitness.assessed += 1;
      if (f === 'Fit for full duty') fitness.fit += 1;
      else if (f === 'Fit with restrictions') fitness.restricted += 1;
      else if (f === 'Unfit for work') fitness.unfit += 1;
    }

    const incidents = await allQuery(
      `SELECT severity, COUNT(*) AS n FROM occupational_incidents WHERE incident_date BETWEEN ? AND ? GROUP BY severity`,
      [from, to]
    );

    const money = (await getQuery(
      `SELECT
         (SELECT COALESCE(SUM(consultation_fee), 0) FROM visits WHERE visit_date BETWEEN ? AND ?) AS fees,
         (SELECT COALESCE(SUM(paid_amount), 0) FROM dispensations WHERE date(created_at) BETWEEN ? AND ?) AS pharmacy,
         (SELECT COALESCE(SUM(discount), 0) FROM dispensations WHERE date(created_at) BETWEEN ? AND ?) AS reductions,
         (SELECT COUNT(*) FROM dispensations WHERE date(created_at) BETWEEN ? AND ?) AS hand_overs,
         (SELECT COALESCE(SUM(di.quantity), 0) FROM dispensation_items di JOIN dispensations d ON d.id = di.dispensation_id
            WHERE date(d.created_at) BETWEEN ? AND ?) AS items`,
      [from, to, from, to, from, to, from, to, from, to]
    )) || {};

    const topMedicines = await allQuery(
      `SELECT di.drug_name, SUM(di.quantity) AS quantity, COUNT(DISTINCT d.id) AS hand_overs
       FROM dispensation_items di JOIN dispensations d ON d.id = di.dispensation_id
       WHERE date(d.created_at) BETWEEN ? AND ?
       GROUP BY di.drug_name ORDER BY quantity DESC LIMIT 15`,
      [from, to]
    );

    const shiftCloses = (await getQuery(
      `SELECT COUNT(*) AS n FROM end_of_day_reports WHERE report_date BETWEEN ? AND ?`, [from, to]
    )) || { n: 0 };
    const tradingDays = (await getQuery(
      `SELECT COUNT(DISTINCT visit_date) AS n FROM visits WHERE visit_date BETWEEN ? AND ?`, [from, to]
    )) || { n: 0 };

    const settings = await getQuery('SELECT name, address, province, district, phone, doctor_in_charge, reg_number FROM hospital_settings LIMIT 1');

    res.json({
      success: true,
      month: req.query.month,
      from,
      to,
      generated_at: new Date().toISOString(),
      facility: settings || null,
      attendances: {
        total: visits.length,
        completed: visits.filter((v) => v.status === 'Completed').length,
        emergency: visits.filter((v) => v.triage_priority === 'Emergency').length,
        urgent: visits.filter((v) => v.triage_priority === 'Urgent').length,
        distinct_patients: firstVisitOfPatient.size,
        new_patients,
        by_sex: bySex,
        by_age_band: AGE_BANDS.map((b) => ({ band: b.label, ...byBand[b.label] })).concat(
          byBand['Not recorded'].total ? [{ band: 'Not recorded', ...byBand['Not recorded'] }] : []
        ),
        follow_ups_set: visits.filter((v) => v.follow_up_date).length
      },
      diagnoses,
      malaria: rdt,
      notifiable,
      referrals: referralSummary,
      fitness,
      incidents,
      money: {
        fees: Number(money.fees) || 0,
        pharmacy: Number(money.pharmacy) || 0,
        reductions: Number(money.reductions) || 0,
        hand_overs: Number(money.hand_overs) || 0,
        items: Number(money.items) || 0
      },
      topMedicines,
      shift_closes: shiftCloses.n,
      trading_days: tradingDays.n
    });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/notifiable?from=&to=
router.get('/notifiable', requireAuth, async (req, res) => {
  try {
    const to = req.query.to || new Date().toISOString().split('T')[0];
    const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const cases = await allQuery(
      `SELECT v.id, v.visit_code, v.visit_date, v.diagnosis, v.notifiable_condition, v.rdt_result, v.doctor_name,
              v.status, v.triage_priority,
              p.id AS patient_id, p.full_name AS patient_name, p.hospital_number, p.age, p.gender,
              p.address_or_village, p.district, p.province, p.phone
       FROM visits v JOIN patients p ON p.id = v.patient_id
       WHERE v.visit_date BETWEEN ? AND ? AND v.notifiable_condition IS NOT NULL AND v.notifiable_condition != ''
       ORDER BY v.visit_date DESC, v.id DESC LIMIT 1000`,
      [from, to]
    );
    res.json({ success: true, from, to, cases });
  } catch (err) {
    console.error('Notifiable list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
