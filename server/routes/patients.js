const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { requirePermission, requireAuth } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../db');
const { formatHospitalNumber, normaliseHospitalNumber } = require('../lib/patientId');

const PHOTO_DIR = path.join(__dirname, '..', 'data', 'patient_photos');
if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });

// Photographs are held as files next to the database rather than inside it, so
// the database stays small enough to copy onto a memory stick at the end of a
// shift and the whole clinic record still travels as one folder.
const MAX_PHOTO_BYTES = 900 * 1024;

async function logEvent(action, user, patientName, details, severity = 'Info') {
  try {
    await runQuery(
      `INSERT INTO activity_logs (action_type, user_name, user_role, patient_name, location, details, severity)
       VALUES (?, ?, ?, ?, 'Reception', ?, ?)`,
      [action, user || 'Unattributed', '', patientName || null, details, severity]
    );
  } catch (err) {
    console.error('Activity log write failed:', err.message);
  }
}

// GET /api/patients (List with search and filter)
router.get('/', async (req, res) => {
  try {
    const { q, province } = req.query;
    let sql = 'SELECT * FROM patients WHERE 1=1';
    const params = [];

    if (q) {
      // A clerk may type the number off the patient's card with the dashes
      // missing or in lower case, so it is normalised before the lookup.
      const exactNumber = normaliseHospitalNumber(q);
      sql += ' AND (full_name LIKE ? OR patient_code LIKE ? OR hospital_number LIKE ? OR hospital_number = ? OR phone LIKE ? OR address_or_village LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, exactNumber || '\u0000', searchTerm, searchTerm);
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
/*
 * GET /api/patients/:id — the whole record.
 *
 * Opening a record is itself recorded, the way a hospital's electronic file
 * keeps an access log: who looked at whom, and when. One line per person per
 * patient per quarter hour, so a nurse moving between tabs does not fill the
 * audit trail, but a record opened at midnight by somebody with no visit to
 * justify it is there to be found.
 */
/*
 * GET /api/patients/similar?name=&age=&village=
 * People who may already be on the register. Many patients share a name and
 * few carry documents, so the check is deliberately loose: same surname and a
 * similar given name, or the whole name close enough to be a spelling
 * difference, with age and village used to rank rather than to exclude.
 */
function simplify(text) {
  return String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length; const n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
router.get('/similar', requireAuth, async (req, res) => {
  try {
    const name = simplify(req.query.name);
    if (name.length < 3) return res.json({ success: true, matches: [] });
    const age = parseInt(req.query.age, 10);
    const village = simplify(req.query.village);
    const tokens = name.split(' ').filter((t) => t.length >= 2);
    if (!tokens.length) return res.json({ success: true, matches: [] });

    const rows = await allQuery(
      `SELECT id, full_name, hospital_number, age, gender, address_or_village, district, phone, created_at, photo_path
       FROM patients WHERE ${tokens.map(() => 'LOWER(full_name) LIKE ?').join(' OR ')} LIMIT 300`,
      // The first three letters cast a wide net; the scoring below narrows it,
      // so "Malony" still finds "Maloni".
      tokens.map((t) => `%${t.slice(0, 3)}%`)
    );

    const matches = rows.map((p) => {
      const other = simplify(p.full_name);
      const otherTokens = other.split(' ');
      const shared = tokens.filter((t) => otherTokens.some((o) => o === t || (t.length > 3 && o.length > 3 && editDistance(t, o) <= 1)));
      const whole = editDistance(name, other);
      let score = 0;
      if (whole <= 2) score += 60;
      score += Math.min(40, shared.length * 20);
      if (Number.isFinite(age) && typeof p.age === 'number') {
        if (Math.abs(p.age - age) <= 2) score += 20;
        else if (Math.abs(p.age - age) > 10) score -= 25;
      }
      if (village && simplify(p.address_or_village) === village) score += 20;
      return { ...p, score, why: [
        whole <= 2 ? 'almost the same name' : shared.length >= 2 ? 'same given name and surname' : shared.length === 1 ? 'shares a name' : null,
        Number.isFinite(age) && typeof p.age === 'number' && Math.abs(p.age - age) <= 2 ? 'similar age' : null,
        village && simplify(p.address_or_village) === village ? 'same village' : null
      ].filter(Boolean).join(', ') };
    }).filter((p) => p.score >= 40).sort((a, b) => b.score - a.score).slice(0, 6);

    res.json({ success: true, matches });
  } catch (err) {
    console.error('Similar patients error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const patient = await getQuery('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const recent = await getQuery(
      `SELECT id FROM activity_logs
        WHERE action_type = 'Record opened' AND user_name = ? AND patient_name = ?
          AND created_at >= datetime('now', '-15 minutes') LIMIT 1`,
      [req.user.full_name, patient.full_name]
    );
    if (!recent) {
      await runQuery(
        `INSERT INTO activity_logs (action_type, user_name, user_role, patient_name, location, details, severity)
         VALUES ('Record opened', ?, ?, ?, 'Patient register', ?, 'Info')`,
        [req.user.full_name, req.user.role, patient.full_name,
         `Opened the record of ${patient.full_name} (${patient.hospital_number || patient.patient_code}).`]
      ).catch(() => {});
    }

    // Everything the audit trail holds about this person, newest first.
    const history = await allQuery(
      `SELECT id, action_type, user_name, user_role, details, severity, created_at
         FROM activity_logs WHERE patient_name = ? ORDER BY id DESC LIMIT 30`,
      [patient.full_name]
    );

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

    const referrals = await allQuery(
      `SELECT r.*, v.visit_code, v.diagnosis FROM referrals r LEFT JOIN visits v ON v.id = r.visit_id
       WHERE r.patient_id = ? ORDER BY r.id DESC`,
      [patient.id]
    );

    res.json({
      success: true,
      patient,
      visits,
      dispensations,
      referrals,
      history
    });
  } catch (err) {
    console.error('Fetch patient details error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/patients (Register new patient)
router.post('/', requirePermission('patients.register'), async (req, res) => {
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

    // The registration reference records the day the patient first attended.
    // Two devices on the clinic Wi-Fi can reach this line at the same moment,
    // so a clash on the unique index is retried rather than thrown at the
    // clerk, who would otherwise be told to try again for no visible reason.
    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = `LMEL-${todayStr.replace(/-/g, '')}-`;

    let result = null;
    let patient_code = null;
    for (let attempt = 0; attempt < 8 && !result; attempt += 1) {
      const lastPatient = await getQuery(
        'SELECT patient_code FROM patients WHERE patient_code LIKE ? ORDER BY patient_code DESC LIMIT 1',
        [`${prefix}%`]
      );
      let nextSeqNum = 1;
      if (lastPatient && lastPatient.patient_code) {
        const lastSeq = parseInt(lastPatient.patient_code.split('-').pop(), 10);
        if (!Number.isNaN(lastSeq)) nextSeqNum = lastSeq + 1;
      }
      patient_code = `${prefix}${String(nextSeqNum + attempt).padStart(3, '0')}`;

      try {
        result = await runQuery(`
          INSERT INTO patients (
            patient_code, full_name, age, gender, phone, province, district,
            address_or_village, blood_group, allergies, emergency_contact,
            medical_history, registered_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          medical_history || '',
          (req.body.registered_by || '').trim() || 'Unattributed'
        ]);
      } catch (err) {
        if (!String(err.message).includes('UNIQUE')) throw err;
      }
    }

    if (!result) {
      return res.status(409).json({
        success: false,
        message: 'Could not allocate a registration number. Try once more.'
      });
    }

    // The hospital number is derived from the row the database just created,
    // so it is unique by construction and can never be handed out twice.
    const hospital_number = formatHospitalNumber(result.lastID);
    await runQuery('UPDATE patients SET hospital_number = ? WHERE id = ?', [
      hospital_number,
      result.lastID
    ]);

    const newPatient = await getQuery('SELECT * FROM patients WHERE id = ?', [result.lastID]);

    await logEvent(
      'Patient Registered',
      req.body.registered_by,
      newPatient.full_name,
      `${hospital_number} issued to ${newPatient.full_name}, age ${newPatient.age}, ${newPatient.gender}.`,
      'Success'
    );

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

// GET /api/patients/:id/photo (Serve the stored photograph)
// A photograph is how a clerk confirms the person at the counter is the person
// the record belongs to. In a district where many patients share a name and
// few carry identity documents, it is the most reliable check available.
router.get('/:id/photo', async (req, res) => {
  try {
    const patient = await getQuery('SELECT photo_path FROM patients WHERE id = ?', [req.params.id]);
    if (!patient || !patient.photo_path) {
      return res.status(404).json({ success: false, message: 'No photograph on this record' });
    }
    const filePath = path.join(PHOTO_DIR, path.basename(patient.photo_path));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'The photograph file is missing from disk' });
    }
    res.setHeader('Content-Type', filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Serve patient photo error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/patients/:id/photo (Save a photograph taken on the clinic camera)
router.post('/:id/photo', requirePermission('patients.photo'), async (req, res) => {
  try {
    const { image, taken_by } = req.body;
    const patient = await getQuery('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const match = typeof image === 'string' && image.match(/^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'The photograph was not readable. Take it again from the camera panel.'
      });
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_PHOTO_BYTES) {
      return res.status(413).json({
        success: false,
        message: 'That photograph is too large. The camera panel shrinks images before sending them.'
      });
    }

    // Store the file under the format it actually is. A camera capture arrives
    // as JPEG and a photograph picked off a laptop is often PNG; naming both
    // .jpg would leave the server describing a file as something it is not.
    const extension = match[1] === 'png' ? 'png' : 'jpg';
    const stem = patient.hospital_number || `patient-${patient.id}`;
    const fileName = `${stem}.${extension}`;
    // A replacement in the other format would otherwise sit alongside the old
    // file and the record would point at only one of them.
    for (const stale of ['jpg', 'png']) {
      if (stale === extension) continue;
      const old = path.join(PHOTO_DIR, `${stem}.${stale}`);
      if (fs.existsSync(old)) fs.rmSync(old);
    }
    fs.writeFileSync(path.join(PHOTO_DIR, fileName), buffer);

    await runQuery(
      'UPDATE patients SET photo_path = ?, photo_taken_at = CURRENT_TIMESTAMP, photo_taken_by = ? WHERE id = ?',
      [fileName, (taken_by || '').trim() || 'Unattributed', patient.id]
    );

    const updated = await getQuery('SELECT * FROM patients WHERE id = ?', [patient.id]);

    await logEvent(
      patient.photo_path ? 'Patient Photograph Replaced' : 'Patient Photograph Taken',
      taken_by,
      patient.full_name,
      `Photograph stored against ${patient.hospital_number || patient.patient_code}.`,
      'Info'
    );

    res.json({ success: true, patient: updated });
  } catch (err) {
    console.error('Save patient photo error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/patients/lookup/:number (Resolve a hospital number from a card)
router.get('/lookup/:number', async (req, res) => {
  try {
    const normalised = normaliseHospitalNumber(req.params.number);
    if (!normalised) {
      return res.status(400).json({
        success: false,
        message: 'That is not a valid hospital number. Check the digits against the card.'
      });
    }
    const patient = await getQuery('SELECT * FROM patients WHERE hospital_number = ?', [normalised]);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `${normalised} is a well-formed number but no patient holds it.`
      });
    }
    res.json({ success: true, patient });
  } catch (err) {
    console.error('Hospital number lookup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/patients/:id (Update patient)
router.put('/:id', requirePermission('patients.edit'), async (req, res) => {
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
router.delete('/:id', requirePermission('settings.clearRecords'), async (req, res) => {
  try {
    await runQuery('DELETE FROM patients WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (err) {
    console.error('Delete patient error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
