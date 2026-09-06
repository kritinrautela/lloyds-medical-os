const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { runQuery, getQuery } = require('../db');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const row = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    if (!row) return res.json({ success: true, settings: null });

    // The export password never leaves the server. Any browser on the clinic
    // Wi-Fi can call this endpoint, so shipping the password here would hand
    // the audit workbook's only lock to every device on the network.
    const { export_password, ...settings } = row;
    settings.export_password_set = !!(export_password && export_password.length > 0);

    res.json({ success: true, settings });
  } catch (err) {
    console.error('Fetch settings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings
router.put('/', requirePermission('settings.edit'), async (req, res) => {
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
      export_password,
      default_consultation_fee,
      admin_email
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
        default_consultation_fee = COALESCE(?, default_consultation_fee),
        admin_email = COALESCE(?, admin_email),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      name, tagline, logo_url, address, province, district, country, phone,
      email, reg_number, doctor_in_charge, currency_symbol, currency_code,
      receipt_footer, export_password,
      default_consultation_fee === undefined || default_consultation_fee === null
        ? null
        : Number(default_consultation_fee),
      admin_email
    ]);

    if (export_password) {
      await runQuery(`
        INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
        VALUES ('Export Password Changed', ?, 'Administrator', 'Facility Settings',
                'The audit workbook encryption password was changed.', 'Warning')
      `, [req.body.changed_by || 'Administrator']);
    }

    const row = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    const { export_password: _secret, ...updated } = row;
    updated.export_password_set = !!(_secret && _secret.length > 0);

    res.json({ success: true, message: 'Hospital settings updated successfully', settings: updated });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/reset-records
// Clears the sample records a new installation ships with, so the clinic starts
// from an empty register on its first real day. This is destructive and cannot
// be undone, so it requires the facility export password and is written to the
// audit trail with the name of whoever ran it.
router.post('/reset-records', requirePermission('settings.clearRecords'), async (req, res) => {
  try {
    const { password, performed_by } = req.body || {};
    const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    const configured = settings && settings.export_password ? settings.export_password : '';

    if (configured && String(password || '') !== configured) {
      await runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
         VALUES ('Records Reset Refused', ?, '', 'Facility Settings', ?, 'Warning')`,
        [
          (performed_by || 'Unattributed'),
          'An attempt to clear every clinical record was refused: the facility password did not match.'
        ]
      );
      return res.status(403).json({
        success: false,
        message: 'Incorrect facility password. This attempt has been recorded in the audit trail.'
      });
    }

    const counts = {};
    for (const table of ['patients', 'visits', 'dispensations', 'occupational_incidents', 'shift_handover_notes']) {
      const row = await getQuery(`SELECT COUNT(*) as n FROM ${table}`);
      counts[table] = row ? row.n : 0;
    }

    await runQuery('DELETE FROM dispensation_items');
    await runQuery('DELETE FROM dispensations');
    await runQuery('DELETE FROM visits');
    await runQuery('DELETE FROM patients');
    await runQuery('DELETE FROM shift_handover_notes');
    await runQuery('DELETE FROM occupational_incidents');
    await runQuery('DELETE FROM end_of_day_reports');
    await runQuery('DELETE FROM activity_logs');
    try { await runQuery('DELETE FROM sync_logs'); } catch (err) { /* table may not exist yet */ }
    // The off-site counters described the sample records; they start again too.
    try {
      await runQuery(`UPDATE cloud_sync_config SET records_synced_count = 0, photos_synced_count = 0,
        last_sync_status = 'Not Configured', last_synced_at = NULL, last_auto_attempt_at = NULL WHERE id = 1`);
    } catch (err) { /* table may not exist yet */ }

    // An emptied bed carries no patient and no observations. Writing a cheerful
    // placeholder here is exactly the habit this rebuild removed: the board
    // should show a dash, not a sentence that reads like a measurement.
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
        vitals_ticker = NULL,
        notes = NULL
    `);

    // Remove the stored photographs of the sample patients as well.
    try {
      const photoDir = path.join(__dirname, '..', 'data', 'patient_photos');
      if (fs.existsSync(photoDir)) {
        for (const file of fs.readdirSync(photoDir)) {
          if (file.toLowerCase().endsWith('.jpg')) fs.unlinkSync(path.join(photoDir, file));
        }
      }
    } catch (err) {
      console.error('Could not clear patient photographs:', err.message);
    }

    await runQuery('UPDATE hospital_settings SET live_since = CURRENT_TIMESTAMP WHERE id = 1');

    const summary = Object.entries(counts)
      .map(([table, n]) => `${n} ${table.replace(/_/g, ' ')}`)
      .join(', ');

    await runQuery(
      `INSERT INTO activity_logs (action_type, user_name, user_role, location, details, severity)
       VALUES ('Records Cleared for Live Use', ?, '', 'Facility Settings', ?, 'Warning')`,
      [
        (performed_by || 'Unattributed'),
        `Sample records removed before going live: ${summary}. The drug formulary and staff accounts were kept.`
      ]
    );

    res.json({
      success: true,
      cleared: counts,
      message: 'Sample records cleared. The register is now empty and ready for real patients.'
    });
  } catch (err) {
    console.error('Reset records error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
