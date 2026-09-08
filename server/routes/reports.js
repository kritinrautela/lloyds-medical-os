const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getQuery, allQuery } = require('../db');
const { AGE_BANDS, ageBandOf } = require('../lib/publicHealth');
const { installConfig } = require('../lib/installConfig');

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

// The week runs Monday to Sunday, which is how the clinic roster is written.
function isoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function weekBounds(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  const base = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const day = base.getUTCDay() || 7;
  const monday = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - (day - 1)));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
  const previousMonday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() - 7));
  const previousSunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() - 1));
  return {
    from: isoDate(monday), to: isoDate(sunday),
    previous_from: isoDate(previousMonday), previous_to: isoDate(previousSunday)
  };
}

/*
 * Everything the returns count, for any span of days. The monthly return and
 * the week's numbers are the same counts over different spans, so they share
 * one reader and can never disagree with each other.
 */
async function summarise(from, to) {
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

  return {
    from,
    to,
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
  };
}

// The shelf as it stands today, not over the span: what has run out and what
// is about to go out of date is what head office needs to act on this week.
async function shelfNow() {
  const out = await allQuery(
    `SELECT name FROM drugs WHERE stock_quantity <= 0 ORDER BY name LIMIT 30`
  );
  const low = (await getQuery(
    `SELECT COUNT(*) AS n FROM drugs WHERE stock_quantity > 0 AND min_stock_alert IS NOT NULL AND stock_quantity <= min_stock_alert`
  )) || { n: 0 };
  const expiring = (await getQuery(
    `SELECT COUNT(*) AS n FROM drugs WHERE stock_quantity > 0 AND expiry_date IS NOT NULL
       AND date(expiry_date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')`
  )) || { n: 0 };
  const expired = (await getQuery(
    `SELECT COUNT(*) AS n FROM drugs WHERE stock_quantity > 0 AND expiry_date IS NOT NULL AND date(expiry_date) < date('now', 'localtime')`
  )) || { n: 0 };
  return { out_of_stock: out.map((d) => d.name), low_stock: low.n, expiring_30d: expiring.n, expired: expired.n };
}

function longDay(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function kina(symbol, n) {
  return `${symbol}${Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

/*
 * The message a nurse sends to head office on a Monday. Plain text, short
 * enough to read on a phone, every line a figure from the records. A line
 * with nothing to say is left out rather than sent as a zero.
 */
function weekText(report, previous, shelf, settings) {
  const a = report.attendances;
  const symbol = (settings && settings.currency_symbol) || 'K';
  const name = (settings && settings.name) || 'The clinic';
  const lines = [];
  lines.push(`${name}, week ${longDay(report.from)} to ${longDay(report.to)}`);
  lines.push('');
  const change = previous ? ` (last week ${previous.attendances.total})` : '';
  lines.push(`Patients seen: ${a.total}${change}`);
  if (a.new_patients) lines.push(`New patients: ${a.new_patients}`);
  if (a.emergency || a.urgent) lines.push(`Emergencies: ${a.emergency}, urgent: ${a.urgent}`);
  if (report.referrals.total) {
    lines.push(`Referred out: ${report.referrals.total}${report.referrals.awaiting ? ` (${report.referrals.awaiting} awaiting outcome)` : ''}`);
  }
  if (report.malaria.done) lines.push(`Malaria tests: ${report.malaria.done}, positive ${report.malaria.positive}`);
  if (report.notifiable.length) {
    lines.push(`Reportable diseases: ${report.notifiable.map((n) => `${n.condition} ${n.cases}`).join(', ')}`);
  }
  if (report.fitness.unfit || report.fitness.restricted) {
    lines.push(`Unfit for work: ${report.fitness.unfit}, restricted duty: ${report.fitness.restricted}`);
  }
  const incidents = report.incidents.reduce((s, i) => s + i.n, 0);
  if (incidents) lines.push(`Workplace incidents: ${incidents}`);
  if (report.diagnoses.length) {
    lines.push(`Most seen: ${report.diagnoses.slice(0, 3).map((d) => `${d.diagnosis} ${d.cases}`).join(', ')}`);
  }
  lines.push(`Money: fees ${kina(symbol, report.money.fees)}, pharmacy ${kina(symbol, report.money.pharmacy)}`);
  if (shelf.out_of_stock.length) {
    lines.push(`Out of stock: ${shelf.out_of_stock.slice(0, 8).join(', ')}${shelf.out_of_stock.length > 8 ? ` and ${shelf.out_of_stock.length - 8} more` : ''}`);
  }
  if (shelf.expired) lines.push(`Expired on the shelf: ${shelf.expired}`);
  if (shelf.expiring_30d) lines.push(`Expiring within 30 days: ${shelf.expiring_30d}`);
  if (report.shift_closes < report.trading_days) {
    lines.push(`Shift closes: ${report.shift_closes} of ${report.trading_days} clinic days`);
  }
  lines.push('');
  lines.push('Sent from Lloyds Medical OS');
  return lines.join('\n');
}

// GET /api/reports/monthly?month=YYYY-MM
router.get('/monthly', requireAuth, async (req, res) => {
  try {
    const bounds = monthBounds(req.query.month);
    if (!bounds) return res.status(400).json({ success: false, message: 'Give the month as YYYY-MM.' });
    const report = await summarise(bounds.from, bounds.to);
    const settings = await getQuery('SELECT name, address, province, district, phone, doctor_in_charge, reg_number FROM hospital_settings LIMIT 1');
    res.json({
      success: true,
      month: req.query.month,
      generated_at: new Date().toISOString(),
      facility: settings || null,
      ...report
    });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * GET /api/reports/weekly?date=YYYY-MM-DD
 *
 * The week containing that date, Monday to Sunday, with the week before it
 * for comparison and the message ready to send.
 */
router.get('/weekly', requireAuth, async (req, res) => {
  try {
    const bounds = weekBounds(req.query.date);
    if (!bounds) return res.status(400).json({ success: false, message: 'Give the date as YYYY-MM-DD.' });
    const [report, previous, shelf] = await Promise.all([
      summarise(bounds.from, bounds.to),
      summarise(bounds.previous_from, bounds.previous_to),
      shelfNow()
    ]);
    const settings = await getQuery('SELECT name, currency_symbol, phone, doctor_in_charge FROM hospital_settings LIMIT 1');
    const install = installConfig();
    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      facility: settings || null,
      send_to: install.support_whatsapp || '',
      previous: { from: bounds.previous_from, to: bounds.previous_to, attendances: previous.attendances, money: previous.money },
      shelf,
      text: weekText(report, previous, shelf, settings),
      ...report
    });
  } catch (err) {
    console.error('Weekly report error:', err);
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
