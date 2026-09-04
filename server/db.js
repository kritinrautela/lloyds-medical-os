const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'hospital.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to local SQLite database at:', dbPath);
    initDatabase();
  }
});

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function initDatabase() {
  try {
    await runQuery('PRAGMA foreign_keys = ON;');

    // 1. Hospital Settings
    await runQuery(`
      CREATE TABLE IF NOT EXISTS hospital_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tagline TEXT,
        logo_url TEXT,
        address TEXT,
        province TEXT DEFAULT 'National Capital District',
        district TEXT DEFAULT 'Port Moresby',
        country TEXT DEFAULT 'Papua New Guinea',
        phone TEXT,
        email TEXT,
        reg_number TEXT,
        doctor_in_charge TEXT,
        currency_symbol TEXT DEFAULT 'K',
        currency_code TEXT DEFAULT 'PGK',
        receipt_footer TEXT,
        export_password TEXT DEFAULT 'png_health_2026',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Patients Table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        phone TEXT,
        province TEXT,
        district TEXT,
        address_or_village TEXT,
        blood_group TEXT,
        allergies TEXT,
        emergency_contact TEXT,
        medical_history TEXT,
        id_card_qr TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Visits (Daily OPD Queue & Footfall Tracker)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_code TEXT UNIQUE NOT NULL,
        patient_id INTEGER NOT NULL,
        visit_date DATE NOT NULL,
        reason TEXT,
        triage_priority TEXT DEFAULT 'Standard', -- 'Standard', 'Urgent', 'Emergency'
        doctor_name TEXT,
        status TEXT DEFAULT 'Waiting', -- 'Waiting', 'Triage / Vitals', 'In Consultation', 'At Pharmacy', 'Completed'
        bp TEXT,
        pulse TEXT,
        temp TEXT,
        resp_rate TEXT,
        spo2 TEXT,
        weight TEXT,
        doctor_notes TEXT,
        diagnosis TEXT,
        consultation_fee REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      )
    `);

    // 4. Drugs Inventory
    await runQuery(`
      CREATE TABLE IF NOT EXISTS drugs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        generic_name TEXT,
        category TEXT NOT NULL,
        dosage_form TEXT NOT NULL, -- Tablet, Syrup, Capsule, Injection, Inhaler, IV Fluid
        strength TEXT,
        unit_price REAL NOT NULL,
        cost_price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        min_stock_alert INTEGER DEFAULT 20,
        batch_number TEXT,
        expiry_date DATE,
        supplier TEXT,
        storage_condition TEXT DEFAULT 'Room Temperature',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Dispensations (Sales & Pharmacy POS)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS dispensations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        patient_id INTEGER,
        visit_id INTEGER,
        patient_name TEXT NOT NULL,
        total_amount REAL NOT NULL,
        discount REAL DEFAULT 0.0,
        paid_amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'Cash (Kina)',
        payment_status TEXT DEFAULT 'Paid',
        pharmacist_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
        FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL
      )
    `);

    // 6. Dispensation Items
    await runQuery(`
      CREATE TABLE IF NOT EXISTS dispensation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispensation_id INTEGER NOT NULL,
        drug_id INTEGER NOT NULL,
        drug_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        instructions TEXT,
        FOREIGN KEY (dispensation_id) REFERENCES dispensations(id) ON DELETE CASCADE,
        FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE RESTRICT
      )
    `);

    // 7. End of Day Closing Reports (Day-End reconciliation)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS end_of_day_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date DATE UNIQUE NOT NULL,
        total_patients INTEGER NOT NULL DEFAULT 0,
        total_consultations INTEGER NOT NULL DEFAULT 0,
        total_prescriptions INTEGER NOT NULL DEFAULT 0,
        total_opd_fees REAL NOT NULL DEFAULT 0.0,
        total_pharmacy_sales REAL NOT NULL DEFAULT 0.0,
        total_revenue REAL NOT NULL DEFAULT 0.0,
        cash_reconciled REAL NOT NULL DEFAULT 0.0,
        cashier_name TEXT,
        notes TEXT,
        cloud_sync_status TEXT DEFAULT 'Pending Sync',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Cloud & Google Sheets Sync Configuration
    await runQuery(`
      CREATE TABLE IF NOT EXISTS cloud_sync_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT DEFAULT 'Google Sheets',
        sync_enabled INTEGER DEFAULT 1,
        auto_sync_on_wifi INTEGER DEFAULT 1,
        google_account_email TEXT,
        google_sheet_id TEXT,
        webhook_url TEXT,
        last_synced_at DATETIME,
        last_sync_status TEXT DEFAULT 'Never Synced',
        last_sync_message TEXT,
        records_synced_count INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Sync Audit Logs
    await runQuery(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL, -- 'Automatic (Wi-Fi Detected)', 'Manual Export', 'End-of-Day Close'
        records_count INTEGER NOT NULL,
        status TEXT NOT NULL, -- 'Success', 'Queued Offline', 'Failed'
        message TEXT,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. Staff Accounts & Users (Offline Authentication)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL,
        staff_id TEXT UNIQUE NOT NULL,
        department TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Inpatient & Observation Beds Management
    await runQuery(`
      CREATE TABLE IF NOT EXISTS inpatient_beds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bed_code TEXT UNIQUE NOT NULL,
        ward_name TEXT NOT NULL,
        bed_type TEXT DEFAULT 'Observation Bed',
        patient_id INTEGER,
        patient_name TEXT,
        patient_code TEXT,
        age INTEGER,
        gender TEXT,
        admission_date DATETIME,
        acuity_level TEXT,
        diagnosis TEXT,
        attending_doctor TEXT,
        vitals_ticker TEXT,
        status TEXT DEFAULT 'Available',
        notes TEXT
      )
    `);

    // 12. Shift Handover & Clinical Logbook
    await runQuery(`
      CREATE TABLE IF NOT EXISTS shift_handover_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_type TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        priority TEXT DEFAULT 'Standard',
        category TEXT DEFAULT 'Clinical Telemetry',
        title TEXT NOT NULL,
        note_content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. Mine Site Occupational Health & Safety Incidents
    await runQuery(`
      CREATE TABLE IF NOT EXISTS occupational_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_code TEXT UNIQUE NOT NULL,
        patient_name TEXT NOT NULL,
        employee_id TEXT,
        department TEXT NOT NULL,
        incident_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        incident_date DATE NOT NULL,
        fit_for_work_status TEXT DEFAULT 'Under Evaluation',
        doctor_recommendation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 14. Real-Time Hospital Activity & Security Telemetry Log ("Black Box Recorder")
    await runQuery(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        patient_name TEXT,
        location TEXT NOT NULL,
        details TEXT NOT NULL,
        severity TEXT DEFAULT 'Info',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if seeded or needs update
    const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1');
    if (!settings) {
      console.log('Seeding initial Papua New Guinea clinic dataset...');
      await seedInitialData();
    } else {
      // Ensure company branding is updated to Lloyds Metals & Energy Ltd
      await runQuery(`
        UPDATE hospital_settings SET
          name = 'Lloyds Metals & Energy Ltd',
          tagline = 'Occupational Health Centre & Community Hospital — Papua New Guinea Operations',
          logo_url = '/lloyds_metals_logo.png',
          address = 'Mining Operational Concession, Markham Valley Highway',
          province = 'Morobe Province',
          district = 'Lae Mining District',
          email = 'health.png@lloyds.in',
          doctor_in_charge = 'Chief Medical Officer (Occupational & Tropical Medicine)',
          receipt_footer = 'Lloyds Metals & Energy Ltd — Serving Mine Personnel & Papua New Guinea Communities'
        WHERE id = ?
      `, [settings.id]);
    }

    // Ensure staff accounts are seeded
    await seedUsersIfEmpty();
    await seedBedsIfEmpty();
    await seedShiftNotesIfEmpty();
    await seedIncidentsIfEmpty();
    await seedActivityLogsIfEmpty();
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

async function seedInitialData() {
  // 1. Settings (Papua New Guinea Lloyd's Clinic)
  await runQuery(`
    INSERT INTO hospital_settings (
      name, tagline, logo_url, address, province, district, country, phone, email, reg_number, doctor_in_charge, currency_symbol, currency_code, receipt_footer, export_password
    ) VALUES (
      'Lloyds Community Clinic & Health Center',
      'Primary Healthcare, Malaria Control & Essential Pharmacy Services',
      '',
      'Section 14, Allotment 8, Highlands Highway',
      'Morobe Province',
      'Lae Urban District',
      'Papua New Guinea',
      '+675 472 8890 / +675 7234 5678',
      'info@lloydshealth.org.pg',
      'PNG-NDOH-HC-2026-092',
      'Chief Medical Officer (MBBS, DTM&H)',
      'K',
      'PGK',
      'Serving the people of Papua New Guinea. Tenkyu tru na lukautim gut!',
      'png_health_2026'
    )
  `);

  // 2. Cloud Sync Default Config
  await runQuery(`
    INSERT INTO cloud_sync_config (
      provider, sync_enabled, auto_sync_on_wifi, google_account_email, google_sheet_id, webhook_url, last_synced_at, last_sync_status, last_sync_message
    ) VALUES (
      'Google Sheets Cloud Sync',
      1,
      1,
      'admin@lloydshealth.org.pg',
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      'https://script.google.com/macros/s/AKfycbx_png_lloyds_sync/exec',
      NULL,
      'Queued for Wi-Fi Connection',
      'System is operating in 100% offline mode. Auto-sync will trigger immediately once Wi-Fi or mobile data is detected.'
    )
  `);

  // 3. Drugs Catalog (PNG National Essential Medicines Formulary)
  const pngEssentialDrugs = [
    ['DRG-PNG-001', 'Coartem (Artemether + Lumefantrine)', 'Artemether 20mg / Lumefantrine 120mg', 'Antimalarial (1st Line PNG)', 'Tablet', '20/120mg', 15.00, 8.00, 140, 30, 'BCH-PNG-CRT-881', '2027-11-20', 'Novartis / PNG NDOH Central Store', 'Below 30°C'],
    ['DRG-PNG-002', 'Paracetamol 500mg', 'Acetaminophen', 'Analgesic / Antipyretic', 'Tablet', '500mg', 1.00, 0.30, 850, 100, 'BCH-PCM-904', '2028-02-15', 'Apex Healthcare PNG', 'Room Temperature'],
    ['DRG-PNG-003', 'Amoxicillin 500mg', 'Amoxicillin Trihydrate', 'Antibiotic', 'Capsule', '500mg', 2.50, 1.10, 420, 60, 'BCH-AMX-442', '2027-09-10', 'PNG Medical Supplies Ltd', 'Room Temperature'],
    ['DRG-PNG-004', 'Oral Rehydration Salts (ORS) WHO Formula', 'Sodium Chloride, Trisodium Citrate, Potassium, Glucose', 'Electrolyte / Diarrhea', 'Sachet', '20.5g', 2.00, 0.70, 500, 80, 'BCH-ORS-601', '2028-06-30', 'UNICEF PNG Supply', 'Cool dry place'],
    ['DRG-PNG-005', 'Zinc Sulfate 20mg Dispersible', 'Zinc Sulfate', 'Pediatric Diarrhea Protocol', 'Tablet', '20mg', 0.80, 0.25, 380, 50, 'BCH-ZNC-305', '2027-10-15', 'UNICEF PNG', 'Room Temperature'],
    ['DRG-PNG-006', 'Doxycycline 100mg', 'Doxycycline Hyclate', 'Antimalarial / Antibiotic', 'Capsule', '100mg', 3.00, 1.20, 260, 40, 'BCH-DOX-112', '2027-08-22', 'Apex Healthcare PNG', 'Protect from light'],
    ['DRG-PNG-007', 'Metformin HCl 500mg', 'Metformin Hydrochloride', 'Antidiabetic', 'Tablet', '500mg', 1.50, 0.60, 310, 50, 'BCH-MET-883', '2027-12-31', 'LifeMed Global', 'Room Temperature'],
    ['DRG-PNG-008', 'Ibuprofen 400mg', 'Ibuprofen', 'NSAID / Anti-inflammatory', 'Tablet', '400mg', 1.80, 0.70, 220, 40, 'BCH-IBU-320', '2027-07-14', 'Apex Healthcare PNG', 'Room Temperature'],
    ['DRG-PNG-009', 'Salbutamol Inhaler 100mcg', 'Salbutamol Sulfate', 'Respiratory / Bronchodilator', 'Inhaler', '100mcg/dose', 28.00, 14.00, 14, 25, 'BCH-SLB-221', '2026-12-10', 'Glaxo PNG Supply', 'Store below 25°C'], // LOW STOCK ALERT
    ['DRG-PNG-010', 'Ciprofloxacin 500mg', 'Ciprofloxacin HCl', 'Antibiotic (Broad Spectrum)', 'Tablet', '500mg', 4.50, 1.80, 18, 30, 'BCH-CIP-905', '2026-11-05', 'Sunway Labs', 'Room Temperature'], // LOW STOCK ALERT
    ['DRG-PNG-011', 'Cetirizine 10mg', 'Cetirizine Dihydrochloride', 'Antihistamine / Allergy', 'Tablet', '10mg', 1.00, 0.35, 450, 50, 'BCH-CTZ-620', '2028-04-10', 'LifeMed Global', 'Room Temperature'],
    ['DRG-PNG-012', 'Artesunate Injection 60mg', 'Artesunate', 'Severe Malaria Emergency', 'Vial', '60mg powder', 35.00, 18.00, 40, 15, 'BCH-ART-701', '2027-05-18', 'PNG NDOH Emergency Depot', 'Protect from heat'],
    ['DRG-PNG-013', 'Compound Sodium Lactate (Hartmanns)', 'Electrolyte Infusion', 'IV Fluid / Resuscitation', 'Bag', '500ml', 12.00, 5.50, 75, 20, 'BCH-IV-551', '2027-08-15', 'Baxter Healthcare PNG', 'Room Temperature'],
    ['DRG-PNG-014', 'Polyvalent Snake Antivenom (Taipan/Death Adder)', 'Purified Equine Immunoglobulin', 'Emergency Antivenom', 'Vial', '50ml', 250.00, 140.00, 6, 8, 'BCH-AVN-019', '2026-10-30', 'CSL Seqirus Australia', 'Keep Refrigerated 2-8°C']
  ];

  for (const drug of pngEssentialDrugs) {
    await runQuery(`
      INSERT INTO drugs (code, name, generic_name, category, dosage_form, strength, unit_price, cost_price, stock_quantity, min_stock_alert, batch_number, expiry_date, supplier, storage_condition)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, drug);
  }

  // 4. Sample Patients from PNG Provinces
  const samplePatients = [
    ['PAT-PNG-001', 'Gari Kila', 36, 'Male', '+675 7123 4567', 'Central Province', 'Kairuku-Hiri', 'Kwikila Settlement, Bush Camp', 'O+', 'None known', 'Brother: +675 7123 4568', 'Frequent occupational exposure to mosquitoes. History of malaria in 2024.'],
    ['PAT-PNG-002', 'Tenikau Wari', 28, 'Female', '+675 7234 5678', 'Morobe Province', 'Lae Urban', 'Boundary Road, Compound 4', 'A+', 'Penicillin allergy (skin rash)', 'Husband: +675 7234 5679', 'Currently breastfeeding 6-month-old infant. Mild intermittent asthma.'],
    ['PAT-PNG-003', 'Paulus Kurum', 58, 'Male', '+675 7345 6789', 'Western Highlands', 'Hagen Central', 'Kagamuga Village near tea plantation', 'B+', 'None', 'Son: +675 7345 6790', 'Type 2 Diabetes mellitus for 5 years. Controlled on diet and oral hypoglycemics.'],
    ['PAT-PNG-004', 'Maryanne Pora', 7, 'Female', '+675 7456 7890', 'Madang Province', 'Madang Urban', 'Modilon Suburb, Ward 6', 'AB+', 'Sulphonamides (Bactrim)', 'Mother: +675 7456 7891', 'Pediatric presentation: 2-day fever, vomiting, watery stools.'],
    ['PAT-PNG-005', 'Samson Kagl', 42, 'Male', '+675 7567 8901', 'Eastern Highlands', 'Goroka Urban', 'North Goroka Market area', 'O-', 'Aspirin allergy', 'Wife: +675 7567 8902', 'Hypertension under observation; mild lower back strain from cargo handling.']
  ];

  for (const patient of samplePatients) {
    await runQuery(`
      INSERT INTO patients (patient_code, full_name, age, gender, phone, province, district, address_or_village, blood_group, allergies, emergency_contact, medical_history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, patient);
  }

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // 5. Today's OPD Visits (Footfall & Clinical Triage)
  const sampleVisits = [
    ['VST-PNG-001', 1, todayStr, 'High fever (39.2°C), severe chills, vomiting, joint pain', 'Urgent', 'Chief Medical Officer', 'At Pharmacy', '118/76', '94 bpm', '39.2°C', '20/min', '97%', '68 kg', 'Rapid Diagnostic Test (RDT) positive for P. falciparum. Immediate Coartem initiation.', 'Acute Falciparum Malaria', 20.0],
    ['VST-PNG-002', 2, todayStr, 'Wheezing, nocturnal coughing, tight chest', 'Standard', 'Duty Medical Officer', 'Completed', '115/72', '86 bpm', '36.8°C', '22/min', '96%', '56 kg', 'Expiratory wheeze bilateral. Prescribed Salbutamol inhaler with spacer.', 'Acute Bronchial Asthma Exacerbation', 20.0],
    ['VST-PNG-003', 3, todayStr, 'Monthly diabetes checkup and routine medicine refill', 'Standard', 'Chief Medical Officer', 'Waiting', '132/84', '72 bpm', '36.5°C', '16/min', '98%', '82 kg', 'Fasting capillary blood glucose: 134 mg/dL. Foot inspection normal. Refill Metformin.', 'Type 2 Diabetes Mellitus', 15.0],
    ['VST-PNG-004', 4, todayStr, 'Frequent watery diarrhea (6x today) and lethargy', 'Urgent', 'Duty Medical Officer', 'Completed', '90/60', '112 bpm', '38.1°C', '24/min', '98%', '21 kg', 'Skin pinch goes back slowly. Sunken eyes. Administer oral rehydration salt therapy and Zinc.', 'Acute Gastroenteritis with Moderate Dehydration', 15.0],
    ['VST-PNG-005', 5, todayStr, 'Laceration on right forearm after clearing brush', 'Standard', 'Chief Medical Officer', 'Triage / Vitals', '128/82', '80 bpm', '36.7°C', '18/min', '99%', '76 kg', 'Clean 4cm wound. Tetanus toxoid booster indicated. Dressing and oral analgesia.', 'Clean Incised Wound / Trauma', 25.0]
  ];

  for (const visit of sampleVisits) {
    await runQuery(`
      INSERT INTO visits (visit_code, patient_id, visit_date, reason, triage_priority, doctor_name, status, bp, pulse, temp, resp_rate, spo2, weight, doctor_notes, diagnosis, consultation_fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, visit);
  }

  // 6. Pharmacy Sales & Dispensations
  await runQuery(`
    INSERT INTO dispensations (invoice_number, patient_id, visit_id, patient_name, total_amount, discount, paid_amount, payment_method, payment_status, pharmacist_notes)
    VALUES ('INV-PNG-001', 2, 2, 'Tenikau Wari', 29.00, 0.0, 29.00, 'Cash (Kina)', 'Paid', 'Dispensed 1 Salbutamol Inhaler and 1 pack Cetirizine 10mg')
  `);
  await runQuery(`
    INSERT INTO dispensation_items (dispensation_id, drug_id, drug_name, quantity, unit_price, subtotal, instructions)
    VALUES (1, 9, 'Salbutamol Inhaler 100mcg', 1, 28.00, 28.00, '2 puffs inhaled every 4 to 6 hours as needed for chest tightness')
  `);
  await runQuery(`
    INSERT INTO dispensation_items (dispensation_id, drug_id, drug_name, quantity, unit_price, subtotal, instructions)
    VALUES (1, 11, 'Cetirizine 10mg', 1, 1.00, 1.00, '1 tablet at bedtime for 7 days')
  `);

  await runQuery(`
    INSERT INTO dispensations (invoice_number, patient_id, visit_id, patient_name, total_amount, discount, paid_amount, payment_method, payment_status, pharmacist_notes)
    VALUES ('INV-PNG-002', 4, 4, 'Maryanne Pora', 14.00, 0.0, 14.00, 'Cash (Kina)', 'Paid', 'Pediatric acute rehydration protocol')
  `);
  await runQuery(`
    INSERT INTO dispensation_items (dispensation_id, drug_id, drug_name, quantity, unit_price, subtotal, instructions)
    VALUES (2, 4, 'Oral Rehydration Salts (ORS) WHO Formula', 4, 2.00, 8.00, 'Dissolve 1 sachet into 1 liter boiled clean water. Sip after every loose stool.')
  `);
  await runQuery(`
    INSERT INTO dispensation_items (dispensation_id, drug_id, drug_name, quantity, unit_price, subtotal, instructions)
    VALUES (2, 5, 'Zinc Sulfate 20mg Dispersible', 5, 0.80, 4.00, '1 tablet dissolved in clean water or breastmilk once daily for 10 days')
  `);
  await runQuery(`
    INSERT INTO dispensation_items (dispensation_id, drug_id, drug_name, quantity, unit_price, subtotal, instructions)
    VALUES (2, 2, 'Paracetamol 500mg', 2, 1.00, 2.00, 'Half tablet crushed in water for high temperature')
  `);

  console.log('Seeding complete for Papua New Guinea clinic system.');
}

async function seedUsersIfEmpty() {
  const userCount = await getQuery('SELECT COUNT(*) as cnt FROM users');
  if (userCount && userCount.cnt > 0) return;

  console.log('Seeding official Lloyds Metals hospital staff accounts...');
  const hash = crypto.createHash('sha256').update('lloyds2026').digest('hex');

  const defaultStaff = [
    ['admin', hash, 'Hospital Operations Director', 'admin.png@lloyds.in', 'Administrator', 'LMEL-ADM-001', 'Clinical Governance & Administration'],
    ['doctor', hash, 'Chief Medical Officer', 'cmo.png@lloyds.in', 'Chief Medical Officer', 'LMEL-DOC-002', 'Emergency & Tropical Medicine'],
    ['nurse', hash, 'Senior Triage Nurse', 'triage.png@lloyds.in', 'Senior Triage Nurse', 'LMEL-NUR-003', 'Outpatient & Acute Triage'],
    ['pharmacist', hash, 'Registered Chief Pharmacist', 'pharmacy.png@lloyds.in', 'Registered Pharmacist', 'LMEL-PHM-004', 'Pharmacy & Medical Depot'],
    ['labtech', hash, 'Pathology & RDT Specialist', 'lab.png@lloyds.in', 'Pathology Technician', 'LMEL-LAB-005', 'Diagnostic Laboratory'],
    ['safety', hash, 'HSE Mine Health Officer', 'safety.png@lloyds.in', 'HSE Safety Officer', 'LMEL-HSE-006', 'Mine Occupational Safety']
  ];

  for (const staff of defaultStaff) {
    await runQuery(`
      INSERT INTO users (username, password_hash, full_name, email, role, staff_id, department)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, staff);
  }
}

async function seedBedsIfEmpty() {
  const bedCount = await getQuery('SELECT COUNT(*) as cnt FROM inpatient_beds');
  if (bedCount && bedCount.cnt > 0) return;

  console.log('Seeding hospital observation beds...');
  const defaultBeds = [
    ['BED-RES-01', 'Emergency Resuscitation Bay', 'Crash Bed (Defibrillator & O2)', 1, 'Gari Kila', 'PAT-PNG-001', 36, 'Male', '2026-09-04 08:30:00', 'Resuscitation (Acuity 1)', 'Severe Falciparum Malaria with Hyperpyrexia', 'Chief Medical Officer', 'BP: 118/76 | HR: 94 | SpO2: 97% | Temp: 39.2°C', 'Occupied', 'IV Artesunate loading dose administered. Monitor blood glucose.'],
    ['BED-RES-02', 'Emergency Resuscitation Bay', 'Acute Trauma / Resus Bed', null, null, null, null, null, null, null, null, null, 'Monitors Calibrated', 'Available', 'Equipped with suction, ambu bag, and cervical collars.'],
    ['BED-TRP-01', 'Tropical Medicine Ward', 'Step-Down Observation Bed', 5, 'Samson Kagl', 'PAT-PNG-005', 42, 'Male', '2026-09-04 10:15:00', 'Standard (Acuity 4)', 'Forearm Incised Wound / Mine Brush Laceration', 'Chief Medical Officer', 'BP: 128/82 | HR: 80 | SpO2: 99% | Temp: 36.7°C', 'Occupied', 'Wound debridement completed. Tetanus toxoid given.'],
    ['BED-TRP-02', 'Tropical Medicine Ward', 'Pediatric & Dehydration Bed', 4, 'Maryanne Pora', 'PAT-PNG-004', 7, 'Female', '2026-09-04 11:00:00', 'Urgent (Acuity 3)', 'Acute Gastroenteritis with Moderate Dehydration', 'Duty Medical Officer', 'BP: 90/60 | HR: 112 | SpO2: 98% | Temp: 38.1°C', 'Occupied', 'Oral rehydration salt therapy active. Zinc supplementation initiated.'],
    ['BED-TRP-03', 'Tropical Medicine Ward', 'Observation Bed', null, null, null, null, null, null, null, null, null, 'Cleaned & Ready', 'Available', 'Fresh linen, IV pole ready.'],
    ['BED-TRP-04', 'Tropical Medicine Ward', 'Isolation / Vector-borne Bed', null, null, null, null, null, null, null, null, null, 'Bed Mesh Netting Intact', 'Cleaning / Sanitizing', 'Terminal disinfectant sanitization in progress.'],
    ['BED-OHS-01', 'Mine Occupational Health Bay', 'Industrial Trauma & Heat Stress', null, 'Kavai Bau', 'PAT-PNG-006', 31, 'Male', '2026-09-04 12:30:00', 'Urgent (Acuity 3)', 'Haul Road Heat Exhaustion & Dehydration', 'Duty Medical Officer', 'BP: 110/70 | HR: 82 | SpO2: 99% | Temp: 37.4°C', 'Occupied', 'Administering 1000ml Compound Sodium Lactate (Hartmanns). Cooling fans active.'],
    ['BED-OHS-02', 'Mine Occupational Health Bay', 'Audiometry / Spirometry Station', null, null, null, null, null, null, null, null, null, 'Soundproof Booth Ready', 'Available', 'For shift fit-for-work and dust screening tests.'],
    ['BED-TOX-01', 'Toxicology & Snakebite Observation', '20WBCT Venom Bed', null, null, null, null, null, null, null, null, null, 'Antivenom Refrigerator Active', 'Available', 'Taipan and Death Adder polyvalent vials prepped at 3.8°C.'],
    ['BED-SURG-01', 'Minor Surgical & Suture Bay', 'Procedure Table', null, null, null, null, null, null, null, null, null, 'Autoclave Batch Passed', 'Available', 'Sterile suture packs, lidocaine, and irrigation saline ready.']
  ];

  for (const bed of defaultBeds) {
    await runQuery(`
      INSERT INTO inpatient_beds (bed_code, ward_name, bed_type, patient_id, patient_name, patient_code, age, gender, admission_date, acuity_level, diagnosis, attending_doctor, vitals_ticker, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, bed);
  }
}

async function seedShiftNotesIfEmpty() {
  const notesCount = await getQuery('SELECT COUNT(*) as cnt FROM shift_handover_notes');
  if (notesCount && notesCount.cnt > 0) return;

  console.log('Seeding clinical shift handover logbook...');
  const defaultNotes = [
    ['Day Shift (06:00 - 18:00)', 'Chief Medical Officer', 'Chief Medical Officer', 'Critical Emergency', 'Acuity / Emergency', 'Taipan Snakebite Protocol Standing Alert', 'Heavy rains along Markham Valley conveyor corridor. 6 vials of CSL Polyvalent antivenom verified in Emergency Refrigerator 1 (temp verified 3.8°C). 20WBCT glass test tubes restocked at Triage.'],
    ['Day Shift (06:00 - 18:00)', 'Senior Triage Nurse', 'Senior Triage Nurse', 'Clinical Alert', 'Malaria Surveillance', 'Malaria RDT Positivity Surge (Morobe Province)', '3 of 5 rapid diagnostic tests positive for Plasmodium Falciparum today. Coartem blister packs restocked at Pharmacy. Hematocrit screening protocol active for all pediatric febrile cases.'],
    ['Day Shift (06:00 - 18:00)', 'Registered Pharmacist', 'Registered Pharmacist', 'Medication Stock', 'Medication Stock', 'Oxygen Cylinders & IV Fluids Inventory', '8 manifold oxygen cylinders at 180 bar. 75 bags of Compound Sodium Lactate (Hartmanns) available. Salbutamol inhalers down to 14 units - emergency PO raised to Port Moresby.'],
    ['Day Shift (06:00 - 18:00)', 'HSE Safety Officer', 'HSE Safety Officer', 'Mine Safety Incident', 'Mine Safety Incident', 'Conveyor Pit Heat Index & Hydration Checks', 'Wet Bulb Globe Temp reached 32.4°C at Pit 3. Mandatory 15-minute hydration rotations enforced for exploration drill crews. Zero lost-time injuries today.']
  ];

  for (const n of defaultNotes) {
    await runQuery(`
      INSERT INTO shift_handover_notes (shift_type, author_name, author_role, priority, category, title, note_content)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, n);
  }
}

async function seedIncidentsIfEmpty() {
  const incCount = await getQuery('SELECT COUNT(*) as cnt FROM occupational_incidents');
  if (incCount && incCount.cnt > 0) return;

  console.log('Seeding mine occupational health incidents...');
  const defaultIncidents = [
    ['INC-PNG-001', 'Gari Kila', 'LMEL-EMP-4091', 'Open Pit Mining', 'Laceration & Foreign Body', 'Medical Treatment Injury (MTI)', '2026-09-04', 'Restricted Alternate Duty', 'Forearm wound sutured; avoid immersion in tailings/slurry for 7 days. Recheck wound Sunday.'],
    ['INC-PNG-002', 'Kavai Bau', 'LMEL-EMP-3120', 'Ore Processing Plant', 'Heat Exhaustion', 'Medical Treatment Injury (MTI)', '2026-09-04', 'Medically Unfit / Off-Duty (24h)', 'Administered 1000ml Hartmanns IV. Core temp returned to 37.4°C. Rest 24h with oral electrolyte rehydration.'],
    ['INC-PNG-003', 'John Auka', 'LMEL-EMP-5502', 'Heavy Haulage', 'Ergonomic Lumbar Strain', 'Minor First Aid', '2026-09-03', 'Fit for Full Duty', 'Oral Ibuprofen prescribed. Ergonomic seat cushion adjusted in Cat 777 haul truck.']
  ];

  for (const inc of defaultIncidents) {
    await runQuery(`
      INSERT INTO occupational_incidents (incident_code, patient_name, employee_id, department, incident_type, severity, incident_date, fit_for_work_status, doctor_recommendation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, inc);
  }
}

async function seedActivityLogsIfEmpty() {
  const logCount = await getQuery('SELECT COUNT(*) as cnt FROM activity_logs');
  if (logCount && logCount.cnt > 0) return;

  console.log('Seeding clinical activity and telemetry logs...');
  const defaultLogs = [
    ['Emergency Admission', 'Chief Medical Officer', 'Chief Medical Officer', 'Gari Kila', 'Emergency Crash Bay 1', 'Assessed severe high fever (39.2°C). Positive Plasmodium Falciparum RDT. Ordered IV Artesunate loading dose.', 'Emergency'],
    ['Triage & Vitals Check', 'Senior Triage Nurse', 'Senior Triage Nurse', 'Maryanne Pora', 'Triage Station', '7-year-old child admitted with severe vomiting and diarrhea. SpO2 98%, HR 112 bpm, BP 90/60. Dehydration protocol activated.', 'Warning'],
    ['Medication Dispensed', 'Registered Chief Pharmacist', 'Registered Pharmacist', 'Tenikau Wari', 'Pharmacy POS Counter', 'Dispensed 1 Salbutamol Inhaler 100mcg & 1 pack Cetirizine 10mg. Stock auto-decremented from batch BCH-SLB-221. Cash paid K 29.00.', 'Success'],
    ['Surgical Procedure', 'Chief Medical Officer', 'Chief Medical Officer', 'Samson Kagl', 'Minor Suture Bay', 'Sutured 4cm laceration on right forearm. Tetanus toxoid booster administered. Transferred to Tropical Ward Bed 1.', 'Info'],
    ['OHS Pit Evacuation', 'HSE Mine Health Officer', 'HSE Safety Officer', 'Kavai Bau', 'Conveyor Pit 3 Haul Road', 'Wet Bulb Globe Temp 32.4°C. Evacuated operator showing heat exhaustion signs. Infused 1000ml Hartmanns IV.', 'Warning'],
    ['Cold Chain Verification', 'Registered Chief Pharmacist', 'Registered Pharmacist', 'Facility Routine Check', 'Dangerous Drugs & Antivenom Refrigerator', 'Temperature verified 3.8°C. Inspected 6 vials of CSL Seqirus Polyvalent Snake Antivenom (Taipan/Death Adder). Safe & ready.', 'Success'],
    ['Encrypted Audit Backup', 'Hospital Operations Director', 'Administrator', 'System Closeout', 'Server Admin Terminal', 'Generated AES-256 encrypted workbook backup. SHA-256 digital fingerprint verified and saved to USB pen drive.', 'Success']
  ];

  for (const log of defaultLogs) {
    await runQuery(`
      INSERT INTO activity_logs (action_type, user_name, user_role, patient_name, location, details, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, log);
  }
}

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery
};
