const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../db');

// GET /api/drugs (Search, filter by low stock, expiry, category)
router.get('/', async (req, res) => {
  try {
    const { q, category, low_stock, expiring_soon } = req.query;
    let sql = 'SELECT * FROM drugs WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND (name LIKE ? OR generic_name LIKE ? OR code LIKE ? OR batch_number LIKE ?)';
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (low_stock === 'true') {
      sql += ' AND stock_quantity <= min_stock_alert';
    }

    if (expiring_soon === 'true') {
      const future90Days = new Date();
      future90Days.setDate(future90Days.getDate() + 90);
      const futureStr = future90Days.toISOString().split('T')[0];
      sql += ' AND expiry_date <= ? AND stock_quantity > 0';
      params.push(futureStr);
    }

    sql += ' ORDER BY stock_quantity ASC, name ASC';
    const drugs = await allQuery(sql, params);

    res.json({ success: true, count: drugs.length, drugs });
  } catch (err) {
    console.error('Fetch drugs error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await allQuery('SELECT DISTINCT category FROM drugs ORDER BY category ASC');
    res.json({ success: true, categories: categories.map(c => c.category) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/:id
router.get('/:id', async (req, res) => {
  try {
    const drug = await getQuery('SELECT * FROM drugs WHERE id = ?', [req.params.id]);
    if (!drug) return res.status(404).json({ success: false, message: 'Drug not found' });
    res.json({ success: true, drug });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/drugs (Add new medication)
router.post('/', async (req, res) => {
  try {
    const {
      name,
      generic_name,
      category,
      dosage_form,
      strength,
      unit_price,
      cost_price,
      stock_quantity,
      min_stock_alert,
      batch_number,
      expiry_date,
      supplier,
      storage_condition
    } = req.body;

    if (!name || !category || !dosage_form || unit_price === undefined) {
      return res.status(400).json({ success: false, message: 'Name, category, dosage form, and unit price are required' });
    }

    // Auto drug code
    const countRow = await getQuery('SELECT COUNT(*) as cnt FROM drugs');
    const code = `DRG-PNG-${(countRow.cnt + 1).toString().padStart(3, '0')}`;

    const result = await runQuery(`
      INSERT INTO drugs (
        code, name, generic_name, category, dosage_form, strength, unit_price, cost_price,
        stock_quantity, min_stock_alert, batch_number, expiry_date, supplier, storage_condition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code,
      name.trim(),
      generic_name || '',
      category,
      dosage_form,
      strength || '',
      parseFloat(unit_price) || 0,
      parseFloat(cost_price) || 0,
      parseInt(stock_quantity, 10) || 0,
      parseInt(min_stock_alert, 10) || 20,
      batch_number || '',
      expiry_date || null,
      supplier || 'PNG Central Medical Supplies',
      storage_condition || 'Room Temperature'
    ]);

    const created = await getQuery('SELECT * FROM drugs WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, message: 'Medication added to inventory', drug: created });
  } catch (err) {
    console.error('Create drug error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/drugs/:id (Update medication)
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      generic_name,
      category,
      dosage_form,
      strength,
      unit_price,
      cost_price,
      stock_quantity,
      min_stock_alert,
      batch_number,
      expiry_date,
      supplier,
      storage_condition
    } = req.body;

    await runQuery(`
      UPDATE drugs SET
        name = COALESCE(?, name),
        generic_name = COALESCE(?, generic_name),
        category = COALESCE(?, category),
        dosage_form = COALESCE(?, dosage_form),
        strength = COALESCE(?, strength),
        unit_price = COALESCE(?, unit_price),
        cost_price = COALESCE(?, cost_price),
        stock_quantity = COALESCE(?, stock_quantity),
        min_stock_alert = COALESCE(?, min_stock_alert),
        batch_number = COALESCE(?, batch_number),
        expiry_date = COALESCE(?, expiry_date),
        supplier = COALESCE(?, supplier),
        storage_condition = COALESCE(?, storage_condition)
      WHERE id = ?
    `, [
      name, generic_name, category, dosage_form, strength,
      unit_price !== undefined ? parseFloat(unit_price) : null,
      cost_price !== undefined ? parseFloat(cost_price) : null,
      stock_quantity !== undefined ? parseInt(stock_quantity, 10) : null,
      min_stock_alert !== undefined ? parseInt(min_stock_alert, 10) : null,
      batch_number, expiry_date, supplier, storage_condition,
      req.params.id
    ]);

    const updated = await getQuery('SELECT * FROM drugs WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Medication updated', drug: updated });
  } catch (err) {
    console.error('Update drug error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/drugs/:id/stock (Quick Stock Adjustment / Restock)
router.post('/:id/stock', async (req, res) => {
  try {
    const { change_amount, reason } = req.body;
    const delta = parseInt(change_amount, 10);
    if (isNaN(delta) || delta === 0) {
      return res.status(400).json({ success: false, message: 'Valid non-zero change amount required' });
    }

    const current = await getQuery('SELECT stock_quantity, name FROM drugs WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ success: false, message: 'Drug not found' });

    const newStock = Math.max(0, current.stock_quantity + delta);
    await runQuery('UPDATE drugs SET stock_quantity = ? WHERE id = ?', [newStock, req.params.id]);

    const updated = await getQuery('SELECT * FROM drugs WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: `Stock updated for ${current.name}: ${current.stock_quantity} -> ${newStock} (${reason || 'Adjustment'})`,
      drug: updated
    });
  } catch (err) {
    console.error('Adjust stock error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/drugs/:id
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM drugs WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Medication removed from formulary' });
  } catch (err) {
    console.error('Delete drug error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
