const express = require('express');
const router = express.Router();
const { runQuery, getQuery } = require('../db');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Fetch settings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const {
      name,
      tagline,
      logo_url,
      address,
      province,
      district,
      country,
      phone,
      email,
      reg_number,
      doctor_in_charge,
      currency_symbol,
      currency_code,
      receipt_footer,
      export_password
    } = req.body;

    await runQuery(`
      UPDATE hospital_settings SET
        name = COALESCE(?, name),
        tagline = COALESCE(?, tagline),
        logo_url = COALESCE(?, logo_url),
        address = COALESCE(?, address),
        province = COALESCE(?, province),
        district = COALESCE(?, district),
        country = COALESCE(?, country),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        reg_number = COALESCE(?, reg_number),
        doctor_in_charge = COALESCE(?, doctor_in_charge),
        currency_symbol = COALESCE(?, currency_symbol),
        currency_code = COALESCE(?, currency_code),
        receipt_footer = COALESCE(?, receipt_footer),
        export_password = COALESCE(?, export_password),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      name, tagline, logo_url, address, province, district, country, phone,
      email, reg_number, doctor_in_charge, currency_symbol, currency_code,
      receipt_footer, export_password
    ]);

    const updated = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    res.json({ success: true, message: 'Hospital settings updated successfully', settings: updated });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
