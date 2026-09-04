const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../db');

// GET /api/dispense (List recent dispensations)
router.get('/', async (req, res) => {
  try {
    const dispensations = await allQuery(`
      SELECT d.*, 
        (SELECT GROUP_CONCAT(di.drug_name || ' (x' || di.quantity || ')', ', ') 
         FROM dispensation_items di WHERE di.dispensation_id = d.id) as items_summary
      FROM dispensations d
      ORDER BY d.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, count: dispensations.length, dispensations });
  } catch (err) {
    console.error('Fetch dispensations error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dispense/:id (Get full invoice detail with items for printing)
router.get('/:id', async (req, res) => {
  try {
    const invoice = await getQuery('SELECT * FROM dispensations WHERE id = ?', [req.params.id]);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const items = await allQuery(`
      SELECT di.*, d.strength, d.dosage_form, d.batch_number, d.expiry_date
      FROM dispensation_items di
      JOIN drugs d ON di.drug_id = d.id
      WHERE di.dispensation_id = ?
    `, [invoice.id]);

    const patient = invoice.patient_id ? await getQuery('SELECT * FROM patients WHERE id = ?', [invoice.patient_id]) : null;
    const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1');

    res.json({
      success: true,
      invoice,
      items,
      patient,
      hospital: settings
    });
  } catch (err) {
    console.error('Fetch invoice error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dispense (Execute Dispensation & Decrement Stock)
router.post('/', async (req, res) => {
  try {
    const {
      patient_id,
      patient_name,
      visit_id,
      items, // Array of { drug_id, quantity, unit_price, instructions }
      discount,
      paid_amount,
      payment_method,
      pharmacist_notes
    } = req.body;

    if (!patient_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Patient name and at least one drug item are required' });
    }

    // Step 1: Stock verification for all items
    for (const item of items) {
      const drug = await getQuery('SELECT id, name, stock_quantity FROM drugs WHERE id = ?', [item.drug_id]);
      if (!drug) {
        return res.status(400).json({ success: false, message: `Medication ID ${item.drug_id} not found in formulary` });
      }
      if (drug.stock_quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${drug.name}. Available: ${drug.stock_quantity}, requested: ${item.quantity}`
        });
      }
    }

    // Step 2: Calculate Totals
    let totalAmount = 0;
    const preparedItems = [];

    for (const item of items) {
      const drug = await getQuery('SELECT * FROM drugs WHERE id = ?', [item.drug_id]);
      const qty = parseInt(item.quantity, 10);
      const price = parseFloat(item.unit_price) || drug.unit_price;
      const subtotal = qty * price;
      totalAmount += subtotal;

      preparedItems.push({
        drug_id: drug.id,
        drug_name: drug.name,
        quantity: qty,
        unit_price: price,
        subtotal: subtotal,
        instructions: item.instructions || 'Take as advised by medical officer'
      });
    }

    const discountVal = parseFloat(discount) || 0;
    const finalTotal = Math.max(0, totalAmount - discountVal);
    const paidVal = paid_amount !== undefined ? parseFloat(paid_amount) : finalTotal;

    // Generate Invoice Number
    const countRow = await getQuery('SELECT COUNT(*) as cnt FROM dispensations');
    const todayNum = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = (countRow.cnt + 1).toString().padStart(4, '0');
    const invoice_number = `INV-PNG-${todayNum}-${seq}`;

    // Step 3: Insert Dispensation Record
    const dispResult = await runQuery(`
      INSERT INTO dispensations (
        invoice_number, patient_id, visit_id, patient_name, total_amount, discount,
        paid_amount, payment_method, payment_status, pharmacist_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?)
    `, [
      invoice_number,
      patient_id || null,
      visit_id || null,
      patient_name.trim(),
      finalTotal,
      discountVal,
      paidVal,
      payment_method || 'Cash (Kina)',
      pharmacist_notes || ''
    ]);

    const dispensationId = dispResult.lastID;

    // Step 4: Insert Items and Decrement Stock
    for (const item of preparedItems) {
      await runQuery(`
        INSERT INTO dispensation_items (
          dispensation_id, drug_id, drug_name, quantity, unit_price, subtotal, instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        dispensationId,
        item.drug_id,
        item.drug_name,
        item.quantity,
        item.unit_price,
        item.subtotal,
        item.instructions
      ]);

      // Decrement stock
      await runQuery(`
        UPDATE drugs SET stock_quantity = stock_quantity - ? WHERE id = ?
      `, [item.quantity, item.drug_id]);
    }

    // Step 5: If visit_id is attached, mark visit as Completed
    if (visit_id) {
      await runQuery(`
        UPDATE visits SET status = 'Completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [visit_id]);
    }

    const fullInvoice = await getQuery('SELECT * FROM dispensations WHERE id = ?', [dispensationId]);
    const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1');

    res.status(201).json({
      success: true,
      message: 'Medications successfully dispensed & stock updated',
      invoice: fullInvoice,
      items: preparedItems,
      hospital: settings
    });
  } catch (err) {
    console.error('Dispense error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
