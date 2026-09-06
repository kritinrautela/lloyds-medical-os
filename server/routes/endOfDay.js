const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
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

    /*
     * The exceptions of the day. These are the lines a supervisor actually
     * needs to look at: medicine that left the shelf for less than its price,
     * or for nothing at all, and stock that moved with no patient attached.
     */
    const reducedSales = await allQuery(`
      SELECT invoice_number, patient_name, total_amount, discount, paid_amount,
             discount_reason, dispensed_by_name, created_at
      FROM dispensations
      WHERE date(created_at) = ? AND (discount > 0 OR paid_amount = 0)
      ORDER BY id DESC
    `, [todayStr]);

    const stockMovements = await allQuery(`
      SELECT created_at, action_type, user_name, details, severity
      FROM activity_logs
      WHERE date(created_at) = ?
        AND action_type IN ('Stock received', 'Stock removed', 'Medicine removed from formulary')
      ORDER BY id DESC
    `, [todayStr]);

    const unattributed = await getQuery(`
      SELECT COUNT(*) AS cnt FROM dispensations
      WHERE date(created_at) = ? AND (dispensed_by_name IS NULL OR dispensed_by_name = '')
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
        dispensed_medicines: dispensedMeds,
        reduced_sales: reducedSales || [],
        stock_movements: stockMovements || [],
        unattributed_dispensations: (unattributed && unattributed.cnt) || 0
      }
    });
  } catch (err) {
    console.error('End of day summary error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/end-of-day/close (Finalize and record End-of-Day report)
router.post('/close', requirePermission('endOfDay.close'), async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { cashier_name, cash_reconciled, notes } = req.body;

    /*
     * The counted cash must be supplied. Defaulting it to the expected total
     * would write a perfect reconciliation for a drawer nobody counted, and a
     * shortfall would then be invisible in the very report meant to reveal it.
     */
    if (cash_reconciled === undefined || cash_reconciled === null || cash_reconciled === '') {
      return res.status(400).json({
        success: false,
        message: 'Count the cash in the drawer and enter the amount. The shift cannot be closed without it.'
      });
    }
    const countedCash = parseFloat(cash_reconciled);
    if (Number.isNaN(countedCash) || countedCash < 0) {
      return res.status(400).json({ success: false, message: 'Enter the counted cash as a number.' });
    }
    if (!String(cashier_name || '').trim()) {
      return res.status(400).json({ success: false, message: 'The shift close must be recorded against a name.' });
    }

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
      countedCash,
      String(cashier_name).trim(),
      String(notes || '').trim() || null
    ]);

    const variance = countedCash - totalRev;
    await runQuery(`
      INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
      VALUES ('Shift closed', ?, '', 'Shift close', ?, ?)
    `, [
      String(cashier_name).trim(),
      `${todayStr}: expected ${totalRev.toFixed(2)}, counted ${countedCash.toFixed(2)}, ` +
        (Math.abs(variance) < 0.005
          ? 'balanced.'
          : `${variance > 0 ? 'over' : 'short'} by ${Math.abs(variance).toFixed(2)}.`),
      Math.abs(variance) < 0.005 ? 'Success' : 'Warning'
    ]);

    const saved = await getQuery('SELECT * FROM end_of_day_reports WHERE report_date = ?', [todayStr]);

    res.json({
      success: true,
      message: Math.abs(variance) < 0.005
        ? 'The shift is closed and the drawer balances.'
        : `The shift is closed. The drawer is ${variance > 0 ? 'over' : 'short'} by ${Math.abs(variance).toFixed(2)}, and that has been recorded.`,
      report: saved,
      variance
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
