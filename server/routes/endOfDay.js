const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../db');

// GET /api/end-of-day/today (Shift summary for current day)
router.get('/today', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Visits & OPD Fees
    const visitStats = await getQuery(`
      SELECT 
        COUNT(*) as total_visits,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_visits,
        COALESCE(SUM(consultation_fee), 0) as total_opd_fees
      FROM visits 
      WHERE visit_date = ?
    `, [todayStr]) || { total_visits: 0, completed_visits: 0, total_opd_fees: 0 };

    // Dispensations & Pharmacy Sales
    const dispStats = await getQuery(`
      SELECT 
        COUNT(*) as total_dispensations,
        COALESCE(SUM(paid_amount), 0) as total_pharmacy_sales
      FROM dispensations 
      WHERE date(created_at) = ?
    `, [todayStr]) || { total_dispensations: 0, total_pharmacy_sales: 0 };

    // Breakdown of Medicines Dispensed Today
    const dispensedMeds = await allQuery(`
      SELECT di.drug_name, SUM(di.quantity) as total_units, SUM(di.subtotal) as total_revenue
      FROM dispensation_items di
      JOIN dispensations d ON di.dispensation_id = d.id
      WHERE date(d.created_at) = ?
      GROUP BY di.drug_name
      ORDER BY total_units DESC
    `, [todayStr]);

    // Check if today is already closed
    const existingClose = await getQuery('SELECT * FROM end_of_day_reports WHERE report_date = ?', [todayStr]);

    const totalRevenue = (visitStats.total_opd_fees || 0) + (dispStats.total_pharmacy_sales || 0);

    res.json({
      success: true,
      report_date: todayStr,
      is_closed: !!existingClose,
      existing_report: existingClose,
      summary: {
        total_patients: visitStats.total_visits || 0,
        completed_consultations: visitStats.completed_visits || 0,
        total_prescriptions: dispStats.total_dispensations || 0,
        total_opd_fees: visitStats.total_opd_fees || 0,
        total_pharmacy_sales: dispStats.total_pharmacy_sales || 0,
        total_revenue: totalRevenue,
        dispensed_medicines: dispensedMeds
      }
    });
  } catch (err) {
    console.error('End of day summary error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/end-of-day/close (Finalize and record End-of-Day report)
router.post('/close', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { cashier_name, cash_reconciled, notes } = req.body;

    // Calculate actual figures
    const visitStats = await getQuery(`
      SELECT 
        COUNT(*) as total_visits,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_visits,
        COALESCE(SUM(consultation_fee), 0) as total_opd_fees
      FROM visits 
      WHERE visit_date = ?
    `, [todayStr]);

    const dispStats = await getQuery(`
      SELECT 
        COUNT(*) as total_dispensations,
        COALESCE(SUM(paid_amount), 0) as total_pharmacy_sales
      FROM dispensations 
      WHERE date(created_at) = ?
    `, [todayStr]);

    const totalRev = (visitStats.total_opd_fees || 0) + (dispStats.total_pharmacy_sales || 0);

    // Upsert closing report
    await runQuery(`
      INSERT INTO end_of_day_reports (
        report_date, total_patients, total_consultations, total_prescriptions,
        total_opd_fees, total_pharmacy_sales, total_revenue, cash_reconciled, cashier_name, notes, cloud_sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Sync')
      ON CONFLICT(report_date) DO UPDATE SET
        total_patients = excluded.total_patients,
        total_consultations = excluded.total_consultations,
        total_prescriptions = excluded.total_prescriptions,
        total_opd_fees = excluded.total_opd_fees,
        total_pharmacy_sales = excluded.total_pharmacy_sales,
        total_revenue = excluded.total_revenue,
        cash_reconciled = excluded.cash_reconciled,
        cashier_name = excluded.cashier_name,
        notes = excluded.notes,
        created_at = CURRENT_TIMESTAMP
    `, [
      todayStr,
      visitStats.total_visits || 0,
      visitStats.completed_visits || 0,
      dispStats.total_dispensations || 0,
      visitStats.total_opd_fees || 0,
      dispStats.total_pharmacy_sales || 0,
      totalRev,
      cash_reconciled !== undefined ? parseFloat(cash_reconciled) : totalRev,
      cashier_name || 'Officer on Duty',
      notes || 'End-of-day shift reconciled successfully.'
    ]);

    const saved = await getQuery('SELECT * FROM end_of_day_reports WHERE report_date = ?', [todayStr]);

    res.json({
      success: true,
      message: 'End-of-day shift successfully closed and reconciled',
      report: saved
    });
  } catch (err) {
    console.error('End of day close error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/end-of-day/history (Past shift reports)
router.get('/history', async (req, res) => {
  try {
    const history = await allQuery('SELECT * FROM end_of_day_reports ORDER BY report_date DESC LIMIT 60');
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
