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

// POST /api/settings/reset-records (Purge demo patients, visits & test data for a completely clean start)
router.post('/reset-records', async (req, res) => {
  try {
    await runQuery('DELETE FROM dispensation_items');
    await runQuery('DELETE FROM dispensations');
    await runQuery('DELETE FROM visits');
    await runQuery('DELETE FROM patients');
    await runQuery('DELETE FROM shift_handover_notes');
    await runQuery('DELETE FROM occupational_incidents');
    await runQuery('DELETE FROM activity_logs');
    await runQuery(`
      UPDATE inpatient_beds SET
        status = 'Available',
        patient_id = NULL,
        patient_name = NULL,
        patient_code = NULL,
        age = NULL,
        gender = NULL,
        admission_date = NULL,
        acuity_level = NULL,
        diagnosis = NULL,
        attending_doctor = NULL,
        vitals_ticker = 'Ready for Admission',
        notes = 'Sanitized and ready for admission.'
    `);

    // Log initialization event
    await runQuery(`
      INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
      VALUES ('Clinical Reset', 'Hospital Administration', 'Administrator', 'Operations Terminal', 'Demo records cleared. Hospital system operating in 100% clean production mode.', 'Info')
    `);

    res.json({ 
      success: true, 
      message: 'All test and demo records cleared successfully. Hospital is now in a 100% clean production state.' 
    });
  } catch (err) {
    console.error('Reset records error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
