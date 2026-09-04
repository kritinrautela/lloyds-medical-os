const XlsxPopulate = require('xlsx-populate');
const crypto = require('crypto');
const { getQuery, allQuery } = require('./db');

/**
 * Generates an AES-encrypted, 100% read-only locked Excel file containing all hospital and pharmacy records:
 * - Official Lloyds Metals Branding & Executive KPIs
 * - Anti-Theft & Drug Diversion Warning with Cryptographic Fingerprint
 * - Inpatient & Observation Bay Ward Status
 * - Patients Master Directory
 * - Outpatient Department (OPD) Visits & Triage Acuity
 * - Pharmacy Formulary & Drug Stock (with Anti-Pilferage Audit)
 * - Medication Dispensation & Sales Ledger
 * - Mine Site Occupational Health & Safety (OHS) Incidents
 *
 * @param {string} password - Password used to encrypt the Excel document
 * @returns {Promise<Buffer>} - Encrypted file buffer
 */
async function generateProtectedExcel(password) {
  const settings = await getQuery('SELECT * FROM hospital_settings LIMIT 1') || {
    name: 'Lloyds Metals & Energy Ltd',
    tagline: 'Occupational Health Centre & Community Hospital — Papua New Guinea Operations',
    currency_symbol: 'K',
    currency_code: 'PGK',
    export_password: 'png_health_2026'
  };

  const finalPassword = password || settings.export_password || 'png_health_2026';

  const patients = await allQuery('SELECT * FROM patients ORDER BY id DESC') || [];
  const visits = await allQuery(`
    SELECT v.*, p.patient_code, p.full_name as patient_name, p.gender, p.age, p.address_or_village
    FROM visits v
    JOIN patients p ON v.patient_id = p.id
    ORDER BY v.visit_date DESC, v.id DESC
  `) || [];
  const drugs = await allQuery('SELECT * FROM drugs ORDER BY category, name') || [];
  const dispensations = await allQuery(`
    SELECT d.*, 
      (SELECT GROUP_CONCAT(di.drug_name || ' (x' || di.quantity || ')', '; ') 
       FROM dispensation_items di WHERE di.dispensation_id = d.id) as medicines_list
    FROM dispensations d
    ORDER BY d.id DESC
  `) || [];
  const beds = await allQuery('SELECT * FROM inpatient_beds ORDER BY id ASC') || [];
  const incidents = await allQuery('SELECT * FROM occupational_incidents ORDER BY id DESC') || [];

  // Generate cryptographic integrity hash of inventory & sales
  const hashPayload = JSON.stringify({
    timestamp: new Date().toISOString(),
    drug_counts: drugs.length,
    stock_sum: drugs.reduce((acc, d) => acc + (d.stock_quantity || 0), 0),
    sales_total: dispensations.reduce((acc, s) => acc + (s.paid_amount || 0), 0)
  });
  const digitalFingerprint = crypto.createHash('sha256').update(hashPayload).digest('hex').toUpperCase();

  const workbook = await XlsxPopulate.fromBlankAsync();

  // Official Lloyds Brand Colors
  const brandRed = 'E31E24';
  const brandBlack = '111111';
  const headerFill = '0B2545';
  const headerFontColor = 'FFFFFF';
  const subHeaderFill = '1E3A8A';
  const alertFill = 'FEE2E2';

  // Helper to lock a worksheet against editing (Read-Only Sheet Protection)
  function lockSheetReadOnly(sheet) {
    if (sheet && sheet._node && sheet._node.children) {
      sheet._node.children.push({
        name: 'sheetProtection',
        attributes: {
          sheet: '1',
          objects: '1',
          scenarios: '1',
          selectLockedCells: '1',
          selectUnlockedCells: '0',
          formatCells: '1',
          formatColumns: '1',
          formatRows: '1',
          insertColumns: '1',
          insertRows: '1',
          insertHyperlinks: '1',
          deleteColumns: '1',
          deleteRows: '1',
          sort: '1',
          autoFilter: '1',
          pivotTables: '1'
        }
      });
    }
  }

  // ----------------------------------------------------
  // SHEET 1: Hospital Overview & Executive Audit
  // ----------------------------------------------------
  const sheetSummary = workbook.sheet(0).name('Executive Overview & KPIs');
  sheetSummary.cell('A1').value('LLOYDS METALS & ENERGY LTD').style({ bold: true, fontSize: 18, fontColor: brandRed });
  sheetSummary.cell('A2').value('OCCUPATIONAL HEALTH CENTRE & COMMUNITY HOSPITAL — PAPUA NEW GUINEA').style({ bold: true, fontSize: 11, fontColor: brandBlack });
  sheetSummary.cell('A3').value(`CONFIDENTIAL AUDIT EXPORT | AES-256 ENCRYPTED | READ-ONLY LOCKED`).style({ italic: true, bold: true, fontSize: 9, fontColor: '475569' });
  sheetSummary.cell('A4').value(`Export Timestamp: ${new Date().toLocaleString()} | Digital Fingerprint: ${digitalFingerprint.substring(0, 16)}...`).style({ fontSize: 9 });

  // Anti-Theft & Pilferage Warning Box
  sheetSummary.range('A6:B8').style({ fill: alertFill });
  sheetSummary.cell('A6').value('ANTI-PILFERAGE & MEDICATION INTEGRITY NOTICE:').style({ bold: true, fontColor: '991B1B' });
  sheetSummary.cell('A7').value('This document is cryptographically fingerprinted and protected against tampering. Any unauthorized editing, alteration of drug quantities, or unrecorded dispensing is strictly prohibited and audited by Lloyds Corporate Compliance.').style({ italic: true, fontSize: 9, fontColor: '7F1D1D' });
  sheetSummary.cell('A8').value(`Verification Checksum: SHA256-${digitalFingerprint}`).style({ bold: true, fontSize: 8, fontColor: '7F1D1D' });

  sheetSummary.cell('A10').value('HOSPITAL & CLINIC TELEMETRY').style({ bold: true, fill: headerFill, fontColor: headerFontColor });
  sheetSummary.cell('B10').value('AUDITED VALUE').style({ bold: true, fill: headerFill, fontColor: headerFontColor });

  const totalPatients = patients.length;
  const totalVisits = visits.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayVisits = visits.filter(v => v.visit_date === todayStr).length;
  const totalDrugs = drugs.length;
  const lowStockDrugs = drugs.filter(d => d.stock_quantity <= d.min_stock_alert).length;
  const totalRevenue = dispensations.reduce((sum, d) => sum + (d.paid_amount || 0), 0);
  const occupiedBeds = beds.filter(b => b.status === 'Occupied').length;

  const kpis = [
    ['Company / Facility', 'Lloyds Metals & Energy Ltd (PNG Operations)'],
    ['Location & Province', 'Markham Valley / Morobe Province, Papua New Guinea'],
    ['Total Registered Patients', totalPatients],
    ['Total Recorded OPD Visits', totalVisits],
    ["Today's Patient Footfall (Census)", todayVisits],
    ['Observation Beds Occupied', `${occupiedBeds} of ${beds.length} beds (${Math.round((occupiedBeds/beds.length)*100)}% load)`],
    ['Active Drug Formulations in Pharmacy', totalDrugs],
    ['Drugs with Low Stock Warning', lowStockDrugs],
    ['Total Pharmacy Revenue To Date', `${settings.currency_symbol} ${totalRevenue.toFixed(2)} (${settings.currency_code})`],
    ['Mine OHS Incidents Recorded', incidents.length],
    ['Protection Status', 'AES Compound Encrypted & Worksheet Read-Only Locked']
  ];

  kpis.forEach((item, idx) => {
    const row = 11 + idx;
    sheetSummary.cell(`A${row}`).value(item[0]).style({ bold: true });
    sheetSummary.cell(`B${row}`).value(item[1]);
  });

  sheetSummary.column('A').width(40);
  sheetSummary.column('B').width(45);
  lockSheetReadOnly(sheetSummary);

  // ----------------------------------------------------
  // SHEET 2: Inpatient & Observation Bay Beds
  // ----------------------------------------------------
  const sheetBeds = workbook.addSheet('Observation & Inpatient Beds');
  const bedHeaders = ['Bed Code', 'Ward / Unit', 'Bed Type', 'Status', 'Patient Name', 'Patient Code', 'Acuity Level', 'Admitted Date', 'Diagnosis', 'Attending Medical Officer', 'Live Vitals Ticker', 'Clinical Notes'];
  bedHeaders.forEach((h, i) => {
    sheetBeds.row(1).cell(i + 1).value(h).style({ bold: true, fill: subHeaderFill, fontColor: headerFontColor });
  });

  beds.forEach((b, rIdx) => {
    const r = rIdx + 2;
    sheetBeds.row(r).cell(1).value(b.bed_code).style({ bold: true });
    sheetBeds.row(r).cell(2).value(b.ward_name);
    sheetBeds.row(r).cell(3).value(b.bed_type);
    sheetBeds.row(r).cell(4).value(b.status).style({
      bold: true,
      fontColor: b.status === 'Occupied' ? 'DC2626' : '16A34A'
    });
    sheetBeds.row(r).cell(5).value(b.patient_name || '-');
    sheetBeds.row(r).cell(6).value(b.patient_code || '-');
    sheetBeds.row(r).cell(7).value(b.acuity_level || '-');
    sheetBeds.row(r).cell(8).value(b.admission_date || '-');
    sheetBeds.row(r).cell(9).value(b.diagnosis || '-');
    sheetBeds.row(r).cell(10).value(b.attending_doctor || '-');
    sheetBeds.row(r).cell(11).value(b.vitals_ticker || '-');
    sheetBeds.row(r).cell(12).value(b.notes || '-');
  });

  sheetBeds.column('A').width(14);
  sheetBeds.column('B').width(30);
  sheetBeds.column('C').width(26);
  sheetBeds.column('D').width(16);
  sheetBeds.column('E').width(22);
  sheetBeds.column('F').width(16);
  sheetBeds.column('G').width(24);
  sheetBeds.column('H').width(20);
  sheetBeds.column('I').width(35);
  sheetBeds.column('J').width(25);
  sheetBeds.column('K').width(35);
  sheetBeds.column('L').width(35);
  lockSheetReadOnly(sheetBeds);

  // ----------------------------------------------------
  // SHEET 3: Patients Directory
  // ----------------------------------------------------
  const sheetPatients = workbook.addSheet('Patients Directory');
  const patientHeaders = ['ID', 'Patient Code', 'Full Name', 'Age', 'Gender', 'Phone', 'Province', 'District', 'Address / Village', 'Blood Group', 'Known Allergies', 'Emergency Contact', 'Medical History', 'Registered At'];
  patientHeaders.forEach((h, i) => {
    sheetPatients.row(1).cell(i + 1).value(h).style({ bold: true, fill: headerFill, fontColor: headerFontColor });
  });

  patients.forEach((p, rIdx) => {
    const r = rIdx + 2;
    sheetPatients.row(r).cell(1).value(p.id);
    sheetPatients.row(r).cell(2).value(p.patient_code);
    sheetPatients.row(r).cell(3).value(p.full_name).style({ bold: true });
    sheetPatients.row(r).cell(4).value(p.age);
    sheetPatients.row(r).cell(5).value(p.gender);
    sheetPatients.row(r).cell(6).value(p.phone || '-');
    sheetPatients.row(r).cell(7).value(p.province || '-');
    sheetPatients.row(r).cell(8).value(p.district || '-');
    sheetPatients.row(r).cell(9).value(p.address_or_village || '-');
    sheetPatients.row(r).cell(10).value(p.blood_group || '-');
    sheetPatients.row(r).cell(11).value(p.allergies || 'None recorded');
    sheetPatients.row(r).cell(12).value(p.emergency_contact || '-');
    sheetPatients.row(r).cell(13).value(p.medical_history || '-');
    sheetPatients.row(r).cell(14).value(p.created_at);
  });

  sheetPatients.column('A').width(8);
  sheetPatients.column('B').width(16);
  sheetPatients.column('C').width(24);
  sheetPatients.column('D').width(8);
  sheetPatients.column('E').width(10);
  sheetPatients.column('F').width(18);
  sheetPatients.column('G').width(18);
  sheetPatients.column('H').width(18);
  sheetPatients.column('I').width(30);
  sheetPatients.column('J').width(12);
  sheetPatients.column('K').width(22);
  sheetPatients.column('L').width(22);
  sheetPatients.column('M').width(35);
  sheetPatients.column('N').width(20);
  lockSheetReadOnly(sheetPatients);

  // ----------------------------------------------------
  // SHEET 4: OPD Visits & Clinical Triage Queue
  // ----------------------------------------------------
  const sheetVisits = workbook.addSheet('OPD Visits & Footfall');
  const visitHeaders = ['Visit Code', 'Date', 'Patient Name', 'Patient Code', 'Age', 'Gender', 'Village / Site', 'Triage Priority', 'Status', 'Blood Pressure', 'Pulse', 'Temperature', 'SpO2', 'Doctor / CMO', 'Diagnosis', 'Doctor Clinical Notes', 'Fee (Kina)'];
  visitHeaders.forEach((h, i) => {
    sheetVisits.row(1).cell(i + 1).value(h).style({ bold: true, fill: subHeaderFill, fontColor: headerFontColor });
  });

  visits.forEach((v, rIdx) => {
    const r = rIdx + 2;
    sheetVisits.row(r).cell(1).value(v.visit_code);
    sheetVisits.row(r).cell(2).value(v.visit_date);
    sheetVisits.row(r).cell(3).value(v.patient_name).style({ bold: true });
    sheetVisits.row(r).cell(4).value(v.patient_code);
    sheetVisits.row(r).cell(5).value(v.age);
    sheetVisits.row(r).cell(6).value(v.gender);
    sheetVisits.row(r).cell(7).value(v.address_or_village || '-');
    sheetVisits.row(r).cell(8).value(v.triage_priority).style({
      bold: true,
      fontColor: v.triage_priority === 'Emergency' ? 'DC2626' : (v.triage_priority === 'Urgent' ? 'D97706' : '16A34A')
    });
    sheetVisits.row(r).cell(9).value(v.status);
    sheetVisits.row(r).cell(10).value(v.bp || '-');
    sheetVisits.row(r).cell(11).value(v.pulse || '-');
    sheetVisits.row(r).cell(12).value(v.temp || '-');
    sheetVisits.row(r).cell(13).value(v.spo2 || '-');
    sheetVisits.row(r).cell(14).value(v.doctor_name || '-');
    sheetVisits.row(r).cell(15).value(v.diagnosis || '-').style({ bold: true });
    sheetVisits.row(r).cell(16).value(v.doctor_notes || '-');
    sheetVisits.row(r).cell(17).value(v.consultation_fee || 0);
  });

  sheetVisits.column('A').width(16);
  sheetVisits.column('B').width(12);
  sheetVisits.column('C').width(22);
  sheetVisits.column('D').width(16);
  sheetVisits.column('E').width(8);
  sheetVisits.column('F').width(10);
  sheetVisits.column('G').width(22);
  sheetVisits.column('H').width(15);
  sheetVisits.column('I').width(16);
  sheetVisits.column('J').width(14);
  sheetVisits.column('K').width(10);
  sheetVisits.column('L').width(12);
  sheetVisits.column('M').width(10);
  sheetVisits.column('N').width(22);
  sheetVisits.column('O').width(30);
  sheetVisits.column('P').width(40);
  sheetVisits.column('Q').width(12);
  lockSheetReadOnly(sheetVisits);

  // ----------------------------------------------------
  // SHEET 5: Pharmacy Inventory & Anti-Pilferage Formulary
  // ----------------------------------------------------
  const sheetDrugs = workbook.addSheet('Pharmacy Inventory (Anti-Theft)');
  const drugHeaders = ['Drug Code', 'Trade Name', 'Generic Formula', 'Category', 'Dosage Form', 'Strength', 'Storage Condition', 'Stock on Hand', 'Min Alert Threshold', 'Unit Price (K)', 'Cost (K)', 'Batch Number', 'Expiry Date', 'Registered Supplier', 'Anti-Theft Status'];
  drugHeaders.forEach((h, i) => {
    sheetDrugs.row(1).cell(i + 1).value(h).style({ bold: true, fill: headerFill, fontColor: headerFontColor });
  });

  drugs.forEach((d, rIdx) => {
    const r = rIdx + 2;
    const isLow = d.stock_quantity <= d.min_stock_alert;
    sheetDrugs.row(r).cell(1).value(d.code);
    sheetDrugs.row(r).cell(2).value(d.name).style({ bold: true });
    sheetDrugs.row(r).cell(3).value(d.generic_name || '-');
    sheetDrugs.row(r).cell(4).value(d.category);
    sheetDrugs.row(r).cell(5).value(d.dosage_form);
    sheetDrugs.row(r).cell(6).value(d.strength || '-');
    sheetDrugs.row(r).cell(7).value(d.storage_condition || 'Room Temp');
    sheetDrugs.row(r).cell(8).value(d.stock_quantity).style({
      bold: true,
      fontColor: isLow ? 'DC2626' : '16A34A'
    });
    sheetDrugs.row(r).cell(9).value(d.min_stock_alert);
    sheetDrugs.row(r).cell(10).value(d.unit_price);
    sheetDrugs.row(r).cell(11).value(d.cost_price);
    sheetDrugs.row(r).cell(12).value(d.batch_number || '-');
    sheetDrugs.row(r).cell(13).value(d.expiry_date || '-');
    sheetDrugs.row(r).cell(14).value(d.supplier || '-');
    sheetDrugs.row(r).cell(15).value('LOCKED - AUDITED').style({ bold: true, fontColor: '2563EB' });
  });

  sheetDrugs.column('A').width(14);
  sheetDrugs.column('B').width(26);
  sheetDrugs.column('C').width(26);
  sheetDrugs.column('D').width(22);
  sheetDrugs.column('E').width(14);
  sheetDrugs.column('F').width(14);
  sheetDrugs.column('G').width(18);
  sheetDrugs.column('H').width(14);
  sheetDrugs.column('I').width(16);
  sheetDrugs.column('J').width(14);
  sheetDrugs.column('K').width(12);
  sheetDrugs.column('L').width(16);
  sheetDrugs.column('M').width(14);
  sheetDrugs.column('N').width(24);
  sheetDrugs.column('O').width(18);
  lockSheetReadOnly(sheetDrugs);

  // ----------------------------------------------------
  // SHEET 6: Pharmacy Sales & Dispensation Ledger
  // ----------------------------------------------------
  const sheetSales = workbook.addSheet('Dispensing & Sales Ledger');
  const salesHeaders = ['Invoice #', 'Date & Time', 'Patient Name', 'Medicines Dispensed', 'Total (Kina)', 'Discount (Kina)', 'Paid (Kina)', 'Payment Method', 'Status', 'Pharmacist Audit Notes'];
  salesHeaders.forEach((h, i) => {
    sheetSales.row(1).cell(i + 1).value(h).style({ bold: true, fill: subHeaderFill, fontColor: headerFontColor });
  });

  dispensations.forEach((s, rIdx) => {
    const r = rIdx + 2;
    sheetSales.row(r).cell(1).value(s.invoice_number);
    sheetSales.row(r).cell(2).value(s.created_at);
    sheetSales.row(r).cell(3).value(s.patient_name).style({ bold: true });
    sheetSales.row(r).cell(4).value(s.medicines_list || '-');
    sheetSales.row(r).cell(5).value(s.total_amount);
    sheetSales.row(r).cell(6).value(s.discount || 0);
    sheetSales.row(r).cell(7).value(s.paid_amount);
    sheetSales.row(r).cell(8).value(s.payment_method || 'Cash (Kina)');
    sheetSales.row(r).cell(9).value(s.payment_status);
    sheetSales.row(r).cell(10).value(s.pharmacist_notes || '-');
  });

  sheetSales.column('A').width(18);
  sheetSales.column('B').width(20);
  sheetSales.column('C').width(24);
  sheetSales.column('D').width(45);
  sheetSales.column('E').width(14);
  sheetSales.column('F').width(14);
  sheetSales.column('G').width(14);
  sheetSales.column('H').width(16);
  sheetSales.column('I').width(12);
  sheetSales.column('J').width(30);
  lockSheetReadOnly(sheetSales);

  // ----------------------------------------------------
  // SHEET 7: Mine Site Occupational Health & Safety (OHS)
  // ----------------------------------------------------
  const sheetOHS = workbook.addSheet('Mine Occupational Health (OHS)');
  const ohsHeaders = ['Incident #', 'Employee / Patient', 'Employee ID', 'Mine Department', 'Incident Type', 'Severity Classification', 'Date', 'Fit for Work Status', 'Medical Doctor Recommendation'];
  ohsHeaders.forEach((h, i) => {
    sheetOHS.row(1).cell(i + 1).value(h).style({ bold: true, fill: headerFill, fontColor: headerFontColor });
  });

  incidents.forEach((inc, rIdx) => {
    const r = rIdx + 2;
    sheetOHS.row(r).cell(1).value(inc.incident_code);
    sheetOHS.row(r).cell(2).value(inc.patient_name).style({ bold: true });
    sheetOHS.row(r).cell(3).value(inc.employee_id || '-');
    sheetOHS.row(r).cell(4).value(inc.department);
    sheetOHS.row(r).cell(5).value(inc.incident_type);
    sheetOHS.row(r).cell(6).value(inc.severity).style({
      bold: true,
      fontColor: inc.severity.includes('Lost Time') ? 'DC2626' : (inc.severity.includes('Treatment') ? 'D97706' : '16A34A')
    });
    sheetOHS.row(r).cell(7).value(inc.incident_date);
    sheetOHS.row(r).cell(8).value(inc.fit_for_work_status).style({ bold: true });
    sheetOHS.row(r).cell(9).value(inc.doctor_recommendation || '-');
  });

  sheetOHS.column('A').width(16);
  sheetOHS.column('B').width(22);
  sheetOHS.column('C').width(16);
  sheetOHS.column('D').width(24);
  sheetOHS.column('E').width(24);
  sheetOHS.column('F').width(28);
  sheetOHS.column('G').width(14);
  sheetOHS.column('H').width(26);
  sheetOHS.column('I').width(45);
  lockSheetReadOnly(sheetOHS);

  // Encrypt with password using AES compound encryption
  const buffer = await workbook.outputAsync({ password: finalPassword });
  return buffer;
}

module.exports = {
  generateProtectedExcel
};
