const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../db');

// GET /api/patients (List with search and filter)
router.get('/', async (req, res) => {
  try {
    const { q, province } = req.query;
    let sql = 'SELECT * FROM patients WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND (full_name LIKE ? OR patient_code LIKE ? OR phone LIKE ? OR address_or_village LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (province) {
      sql += ' AND province = ?';
      params.push(province);
    }

    sql += ' ORDER BY id DESC LIMIT 100';
    const patients = await allQuery(sql, params);

    res.json({ success: true, count: patients.length, patients });
  } catch (err) {
    console.error('Fetch patients error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/patients/:id (Full patient record with timeline)
router.get('/:id', async (req, res) => {
  try {
    const patient = await getQuery('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Get all visits
    const visits = await allQuery(`
      SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_date DESC, id DESC
    `, [patient.id]);

    // Get all dispensations
    const dispensations = await allQuery(`
      SELECT d.*, 
        (SELECT GROUP_CONCAT(di.drug_name || ' (x' || di.quantity || ')', ', ') 
         FROM dispensation_items di WHERE di.dispensation_id = d.id) as drugs_summary
      FROM dispensations d 
      WHERE d.patient_id = ? 
      ORDER BY d.created_at DESC
    `, [patient.id]);

    res.json({
      success: true,
      patient,
      visits,
      dispensations
    });
  } catch (err) {
    console.error('Fetch patient details error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/patients (Register new patient)
router.post('/', async (req, res) => {
  try {
    const {
      full_name,
      age,
      gender,
      phone,
      province,
      district,
      address_or_village,
      blood_group,
      allergies,
      emergency_contact,
      medical_history
    } = req.body;

    if (!full_name || !age || !gender) {
      return res.status(400).json({ success: false, message: 'Full name, age, and gender are required' });
    }

    // Generate unique Patient Code with Registration Date: LMEL-YYYYMMDD-XXX
    const todayStr = new Date().toISOString().split('T')[0];
    const datePart = todayStr.replace(/-/g, '');
    const prefix = `LMEL-${datePart}-`;
    const lastPatient = await getQuery(
      "SELECT patient_code FROM patients WHERE patient_code LIKE ? ORDER BY patient_code DESC LIMIT 1",
      [`${prefix}%`]
    );
    let nextSeqNum = 1;
    if (lastPatient && lastPatient.patient_code) {
      const parts = lastPatient.patient_code.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeqNum = lastSeq + 1;
      }
    }
    const seq = nextSeqNum.toString().padStart(3, '0');
    const patient_code = `${prefix}${seq}`;

    const result = await runQuery(`
      INSERT INTO patients (
        patient_code, full_name, age, gender, phone, province, district, address_or_village, blood_group, allergies, emergency_contact, medical_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      patient_code,
      full_name.trim(),
      parseInt(age, 10),
      gender,
      phone || '',
      province || 'Morobe Province',
      district || 'Lae Urban',
      address_or_village || '',
      blood_group || '',
      allergies || 'None',
      emergency_contact || '',
      medical_history || ''
    ]);

    const newPatient = await getQuery('SELECT * FROM patients WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      patient: newPatient
    });
  } catch (err) {
    console.error('Create patient error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/patients/:id (Update patient)
router.put('/:id', async (req, res) => {
  try {
    const {
      full_name,
      age,
      gender,
      phone,
      province,
      district,
      address_or_village,
      blood_group,
      allergies,
      emergency_contact,
      medical_history
    } = req.body;

    await runQuery(`
      UPDATE patients SET
        full_name = COALESCE(?, full_name),
        age = COALESCE(?, age),
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        province = COALESCE(?, province),
        district = COALESCE(?, district),
        address_or_village = COALESCE(?, address_or_village),
        blood_group = COALESCE(?, blood_group),
        allergies = COALESCE(?, allergies),
        emergency_contact = COALESCE(?, emergency_contact),
        medical_history = COALESCE(?, medical_history)
      WHERE id = ?
    `, [
      full_name,
      age ? parseInt(age, 10) : null,
      gender,
      phone,
      province,
      district,
      address_or_village,
      blood_group,
      allergies,
      emergency_contact,
      medical_history,
      req.params.id
    ]);

    const updated = await getQuery('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Patient updated', patient: updated });
  } catch (err) {
    console.error('Update patient error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM patients WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (err) {
    console.error('Delete patient error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
