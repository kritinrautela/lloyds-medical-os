const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../db');
const { allergyConflicts } = require('../lib/allergies');

// GET /api/dispense?patient_id=&limit= (List recent dispensations)
router.get('/', async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
    const patientId = parseInt(req.query.patient_id, 10);
    const params = [];
    let where = '';
    if (Number.isFinite(patientId)) {
      where = 'WHERE d.patient_id = ?';
      params.push(patientId);
    }
    const dispensations = await allQuery(`
      SELECT d.*, 
        (SELECT GROUP_CONCAT(di.drug_name || ' (x' || di.quantity || ')', ', ') 
         FROM dispensation_items di WHERE di.dispensation_id = d.id) as items_summary,
        COALESCE(d.dispensed_by, d.dispensed_by_name) AS dispensed_by
      FROM dispensations d
      ${where}
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT ?
    `, [...params, limit]);
    res.json({ success: true, count: dispensations.length, dispensations, limit });
  } catch (err) {
    console.error('Fetch dispensations error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/*
 * GET /api/dispense/repeat-check?patient_id=&drug_id=&days=30
 *
 * Whether this patient was given this medicine recently. The counter asks
 * before adding an item, so a second course inside the window is a decision
 * somebody makes knowingly, with the earlier date and quantity in front of
 * them, rather than something nobody noticed.
 */
router.get('/repeat-check', async (req, res) => {
  try {
    const patientId = parseInt(req.query.patient_id, 10);
    const drugId = parseInt(req.query.drug_id, 10);
    const daysRaw = parseInt(req.query.days, 10);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : 30;
    if (!Number.isFinite(patientId) || !Number.isFinite(drugId)) {
      return res.status(400).json({ success: false, message: 'patient_id and drug_id are required.' });
    }
    const previous = await getQuery(`
      SELECT d.created_at AS at, di.quantity, d.invoice_number,
             COALESCE(d.dispensed_by, d.dispensed_by_name) AS dispensed_by, di.instructions
      FROM dispensation_items di
      JOIN dispensations d ON d.id = di.dispensation_id
      WHERE d.patient_id = ? AND di.drug_id = ?
        AND d.created_at >= datetime('now', ?)
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT 1
    `, [patientId, drugId, `-${days} days`]);
    // SQLite stores CURRENT_TIMESTAMP as UTC without saying so; the counter is
    // handed an unambiguous instant to show in clinic time.
    if (previous && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(previous.at))) {
      previous.at = String(previous.at).replace(' ', 'T') + 'Z';
    }
    res.json({ success: true, found: !!previous, days, previous: previous || null });
  } catch (err) {
    console.error('Repeat check error:', err);
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
router.post('/', requirePermission('dispense.sell'), async (req, res) => {
  try {
    const {
      patient_id,
      patient_name,
      visit_id,
      items, // Array of { drug_id, quantity, unit_price, instructions }
      discount,
      paid_amount,
      payment_method,
      pharmacist_notes,
      discount_reason,
      discount_authorised_by,
      dispensed_by_user_id,
      dispensed_by_name,
      dispensed_by_role,
      allergy_checked
    } = req.body;

    if (!patient_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Patient name and at least one drug item are required' });
    }

    const discountValue = parseFloat(discount) || 0;
    if (discountValue > 0 && !String(discount_reason || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'A reduced price needs a stated reason before it can be recorded.'
      });
    }

    // Step 1: every item must exist, be in stock, and be in date. An expired
    // batch is refused outright rather than warned about: a medicine past its
    // date is not the clinic's to hand over, whatever the counter thinks.
    const today = new Date().toISOString().slice(0, 10);
    for (const item of items) {
      const drug = await getQuery('SELECT id, name, stock_quantity, batch_number, expiry_date FROM drugs WHERE id = ?', [item.drug_id]);
      if (!drug) {
        return res.status(400).json({ success: false, message: `Medication ID ${item.drug_id} not found in formulary` });
      }
      if (drug.expiry_date && String(drug.expiry_date).slice(0, 10) < today) {
        return res.status(409).json({
          success: false,
          code: 'EXPIRED',
          message: `${drug.name} (batch ${drug.batch_number || 'not recorded'}) expired on ${String(drug.expiry_date).slice(0, 10)} and cannot be handed over. Remove it from the shelf and record the new batch in the formulary.`
        });
      }
      if (drug.stock_quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${drug.name}. Available: ${drug.stock_quantity}, requested: ${item.quantity}`
        });
      }
    }

    // Step 1b: a medicine that matches the patient's written allergy is
    // refused unless the counter has said the warning was seen. The check
    // runs here as well as on the screen so it cannot be skipped by a stale
    // screen or a request that never came through one.
    if (patient_id) {
      const patient = await getQuery('SELECT full_name, allergies FROM patients WHERE id = ?', [patient_id]);
      if (patient && patient.allergies) {
        const conflicts = [];
        for (const item of items) {
          const drug = await getQuery('SELECT name FROM drugs WHERE id = ?', [item.drug_id]);
          const words = drug ? allergyConflicts(patient.allergies, drug.name) : [];
          if (words.length) conflicts.push({ drug_id: drug ? item.drug_id : null, drug: drug ? drug.name : '', words });
        }
        if (conflicts.length && !allergy_checked) {
          return res.status(409).json({
            success: false,
            code: 'ALLERGY',
            conflicts,
            message: `${conflicts.map((c) => c.drug).join(', ')} matches the allergy recorded for ${patient.full_name} (${patient.allergies}). Confirm the warning has been checked before recording.`
          });
        }
        if (conflicts.length) {
          await runQuery(`
            INSERT INTO activity_logs (action_type, user_name, user_role, patient_name, location, details, severity)
            VALUES ('Allergy warning acknowledged', ?, ?, ?, 'Pharmacy Counter', ?, 'Warning')
          `, [
            req.user ? req.user.full_name : (dispensed_by_name || 'Unattributed'),
            req.user ? req.user.role : (dispensed_by_role || 'Pharmacy'),
            patient.full_name,
            `Recorded despite the allergy note "${patient.allergies}": ${conflicts.map((c) => `${c.drug} (${c.words.join(', ')})`).join('; ')}.`
          ]);
        }
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
        instructions: (item.instructions || '').trim() || null
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
        paid_amount, payment_method, payment_status, pharmacist_notes,
        discount_reason, discount_authorised_by,
        dispensed_by_user_id, dispensed_by_name, dispensed_by_role, dispensed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice_number,
      patient_id || null,
      visit_id || null,
      patient_name.trim(),
      finalTotal,
      discountVal,
      paidVal,
      payment_method || 'Cash (Kina)',
      pharmacist_notes || '',
      discountVal > 0 ? String(discount_reason).trim() : null,
      discountVal > 0 ? (discount_authorised_by || dispensed_by_name || null) : null,
      dispensed_by_user_id || null,
      dispensed_by_name || null,
      dispensed_by_role || null,
      // From the session, never from the body: the name on the record is the
      // person who was signed in at the counter.
      req.user ? req.user.full_name : null
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

    // Record the movement in the tamper-evident audit trail. Discounted or
    // unpaid transactions are raised to Warning so they surface at shift close.
    const itemSummary = preparedItems
      .map((i) => `${i.drug_name} x${i.quantity}`)
      .join(', ');

    await runQuery(`
      INSERT INTO activity_logs (
        action_type, user_name, user_role, patient_name, location, details, severity
      ) VALUES ('Medication Dispensed', ?, ?, ?, 'Pharmacy Counter', ?, ?)
    `, [
      dispensed_by_name || 'Unattributed',
      dispensed_by_role || 'Pharmacy',
      patient_name.trim(),
      `${invoice_number}: ${itemSummary}. Gross ${finalTotal.toFixed(2)}, discount ${discountVal.toFixed(2)}, collected ${paidVal.toFixed(2)}.` +
        (discountVal > 0 ? ` Reason given: ${String(discount_reason).trim()}.` : ''),
      (discountVal > 0 || paidVal === 0) ? 'Warning' : 'Success'
    ]);

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
