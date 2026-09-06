const XlsxPopulate = require('xlsx-populate');
const crypto = require('crypto');
const os = require('os');
const { getQuery, allQuery } = require('./db');

/*
 * The protected audit workbook.
 *
 * What the protection actually is, stated plainly because the workbook itself
 * says the same thing to whoever opens it:
 *
 *  - The file is encrypted with the facility's export password using the
 *    standard Office document encryption that Excel itself implements. Without
 *    the password the file cannot be opened at all.
 *  - Every sheet is marked read-only inside the workbook. That stops accidental
 *    edits and casual ones. It is not a cryptographic guarantee: anyone who
 *    knows the password and is determined enough can remove sheet protection.
 *  - Each sheet carries a SHA-256 checksum of the records it was built from.
 *    Because the checksum travels in the same file, it does not by itself prove
 *    the file was not altered. Its use is comparison: the same checksum can be
 *    recomputed from the clinic database and against another copy of the export,
 *    so two copies that should match can be shown to match.
 *
 * The workbook is written to be read on paper as much as on screen — frozen
 * headers, filters, real number and date formats, and totals that are live
 * formulas rather than values typed in by the generator.
 */

const BRAND_NAVY = '0B2545';
const BRAND_RED = 'C8102E';
const HEADER_TEXT = 'FFFFFF';
const BAND = 'F1F4F8';
const RULE = 'D5DBE3';
const MUTED = '5B6875';
const NEGATIVE = 'B4232B';
const POSITIVE = '1B7A4B';
const WARN = 'A9720E';
const LINK = '1155CC';

const MONEY = '#,##0.00';
const WHOLE = '#,##0';
const DATE = 'yyyy-mm-dd';
const DATETIME = 'yyyy-mm-dd hh:mm';

/** Excel shows a blank cell for something never recorded; it never invents a value. */
function cellValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && value.trim() === '') return '';
  return value;
}

/** A stored date string becomes a real date so Excel can sort and filter it. */
function asDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2}/.test(text) ? text.replace(' ', 'T') : text;
  const parsed = new Date(iso.endsWith('Z') || iso.length <= 10 ? iso : `${iso}Z`);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed;
}

/**
 * A sheet is defined once, as columns, and everything else follows from that:
 * the header band, the widths, the number formats, the alignment, the filter,
 * the frozen header and the totals row.
 */
function buildSheet(sheet, { title, subtitle, columns, rows, checksum, totalsLabel }) {
  const lastCol = columns.length;

  sheet.cell(1, 1).value(title).style({ bold: true, fontSize: 13, fontColor: BRAND_NAVY });
  sheet.range(1, 1, 1, lastCol).merged(true);
  sheet.cell(2, 1).value(subtitle).style({ fontSize: 9, fontColor: MUTED });
  sheet.range(2, 1, 2, lastCol).merged(true);
  sheet.row(1).height(20);

  const headerRow = 4;
  columns.forEach((col, i) => {
    sheet.cell(headerRow, i + 1).value(col.header).style({
      bold: true,
      fill: BRAND_NAVY,
      fontColor: HEADER_TEXT,
      fontSize: 9,
      horizontalAlignment: col.align || (col.type === 'number' || col.type === 'money' ? 'right' : 'left'),
      verticalAlignment: 'center',
      wrapText: true
    });
    sheet.column(i + 1).width(col.width || 18);
  });
  sheet.row(headerRow).height(28);

  rows.forEach((record, rIdx) => {
    const r = headerRow + 1 + rIdx;
    columns.forEach((col, cIdx) => {
      const raw = col.value(record);
      const cell = sheet.cell(r, cIdx + 1);

      if (col.type === 'date' || col.type === 'datetime') {
        const d = asDate(raw);
        cell.value(d);
        if (d instanceof Date) {
          cell.style('numberFormat', col.type === 'date' ? DATE : DATETIME);
        }
      } else if (col.type === 'money') {
        cell.value(raw === null || raw === undefined || raw === '' ? '' : Number(raw));
        cell.style('numberFormat', MONEY);
      } else if (col.type === 'number') {
        cell.value(raw === null || raw === undefined || raw === '' ? '' : Number(raw));
        cell.style('numberFormat', WHOLE);
      } else {
        cell.value(cellValue(raw));
      }

      cell.style({
        fontSize: 9,
        verticalAlignment: 'top',
        wrapText: !!col.wrap,
        horizontalAlignment: col.align || (col.type === 'number' || col.type === 'money' ? 'right' : 'left')
      });

      if (rIdx % 2 === 1) cell.style('fill', BAND);
      const tone = col.tone ? col.tone(record) : null;
      if (tone) cell.style({ fontColor: tone, bold: true });

      // A link is only offered when there is something on the other end of it.
      const link = col.link ? col.link(record) : null;
      if (link) {
        cell.hyperlink(link);
        cell.style({ fontColor: LINK, underline: true });
      }
    });
  });

  const firstDataRow = headerRow + 1;
  const lastDataRow = headerRow + rows.length;

  // Totals are formulas, not numbers written by the generator, so a reader who
  // filters or corrects a row sees the total follow.
  const hasTotals = columns.some((c) => c.total);
  let totalRow = null;
  if (hasTotals && rows.length > 0) {
    totalRow = lastDataRow + 1;
    sheet.cell(totalRow, 1).value(totalsLabel || 'Total').style({ bold: true, fontSize: 9 });
    columns.forEach((col, i) => {
      const cell = sheet.cell(totalRow, i + 1);
      cell.style({ bold: true, fontSize: 9, border: { top: { style: 'thin', color: RULE } } });
      if (col.total) {
        const letter = sheet.cell(headerRow, i + 1).columnName();
        cell.formula(`SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`);
        cell.style({ numberFormat: col.type === 'money' ? MONEY : WHOLE, horizontalAlignment: 'right' });
      }
    });
  }

  if (rows.length === 0) {
    sheet.cell(firstDataRow, 1).value('No records of this kind had been entered when this workbook was made.')
      .style({ italic: true, fontSize: 9, fontColor: MUTED });
  } else {
    sheet.autoFilter(sheet.range(headerRow, 1, lastDataRow, lastCol));
  }

  sheet.freezePanes(0, headerRow);

  const footRow = (totalRow || lastDataRow) + 2;
  sheet.cell(footRow, 1).value(
    `${rows.length} record${rows.length === 1 ? '' : 's'}. Sheet checksum ${checksum}.`
  ).style({ fontSize: 8, fontColor: MUTED });

  sheet.gridLinesVisible(false);
  lockSheetReadOnly(sheet);
}

/**
 * Marks the sheet read-only inside the workbook. This is Excel's own sheet
 * protection: it prevents editing when the file is opened normally. It is a
 * deterrent against alteration, not an unbreakable seal.
 */
function lockSheetReadOnly(sheet) {
  if (sheet && sheet._node && sheet._node.children) {
    sheet._node.children.push({
      name: 'sheetProtection',
      attributes: {
        sheet: '1', objects: '1', scenarios: '1',
        selectLockedCells: '0', selectUnlockedCells: '0',
        formatCells: '1', formatColumns: '0', formatRows: '0',
        insertColumns: '1', insertRows: '1', insertHyperlinks: '1',
        deleteColumns: '1', deleteRows: '1',
        sort: '0', autoFilter: '0', pivotTables: '1'
      }
    });
  }
}

function checksumOf(rows) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(rows))
    .digest('hex')
    .toUpperCase()
    .slice(0, 16);
}

// Excel cannot hold the photographs themselves: the library that puts the
// password on this workbook has no way to embed a picture, and dropping the
// password to gain pictures would be the wrong trade. So the workbook carries
// a link that opens the photograph from the clinic server instead. It works on
// any computer on the clinic network; away from the clinic the link will not
// open, which is the honest behaviour for a photograph that never left the
// building.
function clinicBaseUrl() {
  const port = process.env.PORT || 4000;
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return `http://${iface.address}:${port}`;
      }
    }
  }
  return `http://localhost:${port}`;
}

async function generateProtectedExcel(password) {
  const settings = (await getQuery('SELECT * FROM hospital_settings LIMIT 1')) || {};
  const currency = settings.currency_symbol || 'K';
  const photoBase = clinicBaseUrl();

  // There is deliberately no built-in fallback password. A password compiled
  // into the source would be known to anyone with a copy of the software, which
  // is the opposite of what this file is for.
  const finalPassword = (password || settings.export_password || '').toString();
  const encrypted = finalPassword.length > 0;

  const [patients, visits, drugs, dispensations, beds, incidents, referrals, activity] = await Promise.all([
    allQuery('SELECT * FROM patients ORDER BY id DESC'),
    allQuery(`
      SELECT v.*, p.patient_code, p.hospital_number, p.full_name AS patient_name,
             p.gender, p.age, p.address_or_village
      FROM visits v JOIN patients p ON v.patient_id = p.id
      ORDER BY v.visit_date DESC, v.id DESC
    `),
    allQuery('SELECT * FROM drugs ORDER BY category, name'),
    allQuery(`
      SELECT d.*,
        (SELECT GROUP_CONCAT(di.drug_name || ' x' || di.quantity, '; ')
         FROM dispensation_items di WHERE di.dispensation_id = d.id) AS medicines_list
      FROM dispensations d ORDER BY d.id DESC
    `),
    allQuery('SELECT * FROM inpatient_beds ORDER BY id ASC'),
    allQuery('SELECT * FROM occupational_incidents ORDER BY id DESC'),
    allQuery(`
      SELECT r.*, p.hospital_number, p.full_name AS patient_name, p.age, p.gender, v.visit_code, v.diagnosis
      FROM referrals r
      JOIN patients p ON p.id = r.patient_id
      LEFT JOIN visits v ON v.id = r.visit_id
      ORDER BY r.id DESC`),
    allQuery('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 5000')
  ]).then((sets) => sets.map((s) => s || []));

  const workbook = await XlsxPopulate.fromBlankAsync();
  const generatedAt = new Date();
  const facility = settings.name || 'This facility';
  const place = [settings.district, settings.province, settings.country].filter(Boolean).join(' · ');

  const subtitleFor = (what) =>
    `${facility}${place ? ` — ${place}` : ''} · ${what} · exported ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

  // ---- Sheet 1: what this file is ----------------------------------------
  const cover = workbook.sheet(0).name('About this export');
  cover.column(1).width(34);
  cover.column(2).width(62);
  cover.gridLinesVisible(false);

  cover.cell('A1').value(facility).style({ bold: true, fontSize: 16, fontColor: BRAND_RED });
  cover.cell('A2').value(settings.tagline || 'Clinic records export')
    .style({ fontSize: 10, fontColor: BRAND_NAVY });
  cover.cell('A3').value(place).style({ fontSize: 9, fontColor: MUTED });

  cover.cell('A5').value('HOW THIS FILE IS PROTECTED')
    .style({ bold: true, fill: BRAND_NAVY, fontColor: HEADER_TEXT, fontSize: 10 });
  cover.range('A5:B5').merged(true);

  const protectionNotes = [
    ['Opening the file', encrypted
      ? 'The file is encrypted with the facility export password. Without that password it cannot be opened.'
      : 'NO EXPORT PASSWORD IS SET, so this file is NOT encrypted and anyone who has it can open it. Set an export password in Facility settings and export again.'],
    ['Editing the sheets', 'Every sheet is marked read-only, which prevents editing when the file is opened normally. This is a deterrent, not an unbreakable seal.'],
    ['Checking a copy', 'Each sheet carries a checksum of the records it was built from. Two copies of the same export can be compared by checksum. A checksum inside a file cannot on its own prove the file was never altered.'],
    ['Who made it', 'The clinic system records who asked for each export, and refuses attempts made with the wrong password. That record lives in the clinic database, in the Activity record sheet of this workbook.'],
    ['Patient photographs', 'A password-protected workbook cannot hold the photographs themselves. The Patients sheet gives each photograph as a link instead. On a computer connected to the clinic network the link opens the photograph; away from the clinic it will not open, because the photographs stay on the clinic server.']
  ];
  protectionNotes.forEach(([k, v], i) => {
    const r = 6 + i;
    cover.cell(r, 1).value(k).style({ bold: true, fontSize: 9, verticalAlignment: 'top' });
    cover.cell(r, 2).value(v).style({ fontSize: 9, wrapText: true, verticalAlignment: 'top',
      fontColor: !encrypted && i === 0 ? NEGATIVE : '000000' });
    cover.row(r).height(30);
  });

  cover.cell('A12').value('WHAT IS IN IT')
    .style({ bold: true, fill: BRAND_NAVY, fontColor: HEADER_TEXT, fontSize: 10 });
  cover.range('A12:B12').merged(true);

  const counts = [
    ['Registered patients', patients.length],
    ['Outpatient visits', visits.length],
    ['Medicines in the formulary', drugs.length],
    ['Dispensing records', dispensations.length],
    ['Beds', beds.length],
    ['Workplace health incidents', incidents.length],
    ['Referrals to other facilities', referrals.length],
    ['Activity records included', activity.length]
  ];
  counts.forEach(([k, v], i) => {
    const r = 13 + i;
    cover.cell(r, 1).value(k).style({ bold: true, fontSize: 9 });
    cover.cell(r, 2).value(v).style({ fontSize: 9, numberFormat: WHOLE, horizontalAlignment: 'left' });
  });

  // These read across from the other sheets, so the cover cannot drift from the
  // data behind it.
  cover.cell('A21').value('MONEY RECORDED')
    .style({ bold: true, fill: BRAND_NAVY, fontColor: HEADER_TEXT, fontSize: 10 });
  cover.range('A21:B21').merged(true);
  cover.cell('A22').value(`Pharmacy collected (${currency})`).style({ bold: true, fontSize: 9 });
  cover.cell('A23').value(`Price reductions given (${currency})`).style({ bold: true, fontSize: 9 });
  cover.cell('A24').value(`Consultation fees recorded (${currency})`).style({ bold: true, fontSize: 9 });

  cover.cell('A26').value(
    'Blank cells mean nothing was recorded. They do not mean zero, and they do not mean normal.'
  ).style({ italic: true, fontSize: 9, fontColor: MUTED });
  cover.range('A26:B26').merged(true);

  cover.cell('A27').value(`Exported ${generatedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`)
    .style({ fontSize: 8, fontColor: MUTED });

  lockSheetReadOnly(cover);

  // ---- Sheet 2: patients --------------------------------------------------
  buildSheet(workbook.addSheet('Patients'), {
    title: 'Patient register',
    subtitle: subtitleFor('every registered patient'),
    checksum: checksumOf(patients),
    columns: [
      { header: 'Hospital number', width: 16, value: (p) => p.hospital_number },
      { header: 'Old code', width: 16, value: (p) => p.patient_code },
      { header: 'Full name', width: 24, value: (p) => p.full_name },
      { header: 'Age', width: 7, type: 'number', value: (p) => p.age },
      { header: 'Sex', width: 9, value: (p) => p.gender },
      { header: 'Phone', width: 15, value: (p) => p.phone },
      { header: 'Village or address', width: 28, wrap: true, value: (p) => p.address_or_village },
      { header: 'District', width: 16, value: (p) => p.district },
      { header: 'Province', width: 16, value: (p) => p.province },
      { header: 'Blood group', width: 11, value: (p) => p.blood_group },
      { header: 'Allergies', width: 24, wrap: true, value: (p) => p.allergies,
        tone: (p) => (p.allergies && String(p.allergies).trim() ? NEGATIVE : null) },
      { header: 'Emergency contact', width: 22, value: (p) => p.emergency_contact },
      { header: 'Medical history', width: 34, wrap: true, value: (p) => p.medical_history },
      { header: 'Photograph', width: 16,
        value: (p) => (p.photo_path ? 'Open photograph' : ''),
        link: (p) => (p.photo_path ? `${photoBase}/api/patients/${p.id}/photo` : null) },
      { header: 'Photo taken on', width: 17, type: 'datetime', value: (p) => p.photo_taken_at },
      { header: 'Photo taken by', width: 20, value: (p) => p.photo_taken_by },
      { header: 'Registered by', width: 20, value: (p) => p.registered_by },
      { header: 'Registered on', width: 17, type: 'datetime', value: (p) => p.created_at }
    ],
    rows: patients
  });

  // ---- Sheet 3: visits ----------------------------------------------------
  buildSheet(workbook.addSheet('Outpatient visits'), {
    title: 'Outpatient visits',
    subtitle: subtitleFor('every recorded attendance'),
    checksum: checksumOf(visits),
    totalsLabel: 'Total fees',
    columns: [
      { header: 'Visit', width: 16, value: (v) => v.visit_code },
      { header: 'Date', width: 12, type: 'date', value: (v) => v.visit_date },
      { header: 'Hospital number', width: 16, value: (v) => v.hospital_number },
      { header: 'Patient', width: 22, value: (v) => v.patient_name },
      { header: 'Age', width: 7, type: 'number', value: (v) => v.age },
      { header: 'Sex', width: 9, value: (v) => v.gender },
      { header: 'Village', width: 20, value: (v) => v.address_or_village },
      { header: 'Priority', width: 12, value: (v) => v.triage_priority,
        tone: (v) => (v.triage_priority === 'Emergency' ? NEGATIVE : v.triage_priority === 'Urgent' ? WARN : null) },
      { header: 'Stage', width: 15, value: (v) => v.status },
      { header: 'BP', width: 10, value: (v) => v.bp },
      { header: 'Pulse', width: 8, type: 'number', value: (v) => v.pulse },
      { header: 'Temp', width: 8, value: (v) => v.temp },
      { header: 'SpO2', width: 8, type: 'number', value: (v) => v.spo2 },
      { header: 'Resp', width: 8, type: 'number', value: (v) => v.resp_rate },
      { header: 'Weight', width: 9, value: (v) => v.weight },
      { header: 'Diagnosis', width: 30, wrap: true, value: (v) => v.diagnosis },
      { header: 'Clinical note', width: 40, wrap: true, value: (v) => v.doctor_notes },
      { header: 'Seen by', width: 22, value: (v) => v.doctor_name },
      { header: 'Checked in by', width: 20, value: (v) => v.checked_in_by },
      { header: `Fee (${currency})`, width: 12, type: 'money', total: true, value: (v) => v.consultation_fee },
      { header: 'Return on', width: 12, type: 'date', value: (v) => v.follow_up_date },
      { header: 'Reason for return', width: 24, wrap: true, value: (v) => v.follow_up_note },
      { header: 'Malaria RDT', width: 20, value: (v) => v.rdt_result,
        tone: (v) => (String(v.rdt_result || '').startsWith('Positive') ? WARN : null) },
      { header: 'Reportable condition', width: 26, value: (v) => v.notifiable_condition,
        tone: (v) => (v.notifiable_condition ? NEGATIVE : null) },
      { header: 'Fitness for work', width: 20, value: (v) => v.fitness_status,
        tone: (v) => (v.fitness_status === 'Unfit for work' ? NEGATIVE : v.fitness_status === 'Fit with restrictions' ? WARN : null) },
      { header: 'Restrictions', width: 26, wrap: true, value: (v) => v.fitness_restrictions },
      { header: 'Fitness until', width: 12, type: 'date', value: (v) => v.fitness_until }
    ],
    rows: visits
  });

  // ---- Sheet 4: formulary -------------------------------------------------
  const today = new Date();
  buildSheet(workbook.addSheet('Medicine store'), {
    title: 'Medicine store',
    subtitle: subtitleFor('stock as it stood at the moment of export'),
    checksum: checksumOf(drugs),
    totalsLabel: 'Total',
    columns: [
      { header: 'Medicine', width: 26, value: (d) => d.name },
      { header: 'Generic name', width: 24, value: (d) => d.generic_name },
      { header: 'Category', width: 22, value: (d) => d.category },
      { header: 'Form', width: 13, value: (d) => d.dosage_form },
      { header: 'Strength', width: 13, value: (d) => d.strength },
      { header: 'Stored', width: 18, value: (d) => d.storage_condition },
      { header: 'On the shelf', width: 12, type: 'number', total: true, value: (d) => d.stock_quantity,
        tone: (d) => {
          const floor = d.min_stock_alert ?? d.reorder_level;
          if (d.stock_quantity <= 0) return NEGATIVE;
          if (floor != null && d.stock_quantity <= floor) return WARN;
          return POSITIVE;
        } },
      { header: 'Warn below', width: 11, type: 'number', value: (d) => d.min_stock_alert ?? d.reorder_level },
      { header: `Price (${currency})`, width: 12, type: 'money', value: (d) => d.unit_price },
      { header: `Cost (${currency})`, width: 12, type: 'money', value: (d) => d.cost_price },
      { header: `Value on hand (${currency})`, width: 15, type: 'money', total: true,
        value: (d) => (d.stock_quantity || 0) * (d.cost_price || d.unit_price || 0) },
      { header: 'Batch', width: 16, value: (d) => d.batch_number },
      { header: 'Expires', width: 12, type: 'date', value: (d) => d.expiry_date,
        tone: (d) => {
          if (!d.expiry_date) return null;
          const days = (new Date(d.expiry_date) - today) / 86400000;
          if (Number.isNaN(days)) return null;
          if (days < 0) return NEGATIVE;
          if (days <= 90) return WARN;
          return null;
        } },
      { header: 'Supplier', width: 24, value: (d) => d.supplier }
    ],
    rows: drugs
  });

  // ---- Sheet 5: dispensing ledger -----------------------------------------
  buildSheet(workbook.addSheet('Dispensing ledger'), {
    title: 'Dispensing and payments',
    subtitle: subtitleFor('every medicine hand-over, and who recorded it'),
    checksum: checksumOf(dispensations),
    totalsLabel: 'Totals',
    columns: [
      { header: 'Invoice', width: 20, value: (s) => s.invoice_number },
      { header: 'When', width: 17, type: 'datetime', value: (s) => s.created_at },
      { header: 'Patient', width: 24, value: (s) => s.patient_name },
      { header: 'Medicines', width: 44, wrap: true, value: (s) => s.medicines_list },
      { header: `Value (${currency})`, width: 13, type: 'money', total: true, value: (s) => s.total_amount },
      { header: `Reduction (${currency})`, width: 13, type: 'money', total: true, value: (s) => s.discount,
        tone: (s) => (s.discount > 0 ? WARN : null) },
      { header: 'Reason for reduction', width: 26, wrap: true, value: (s) => s.discount_reason,
        tone: (s) => (s.discount > 0 && !s.discount_reason ? NEGATIVE : null) },
      { header: `Collected (${currency})`, width: 13, type: 'money', total: true, value: (s) => s.paid_amount,
        tone: (s) => (Number(s.paid_amount) === 0 ? NEGATIVE : null) },
      { header: 'Paid how', width: 18, value: (s) => s.payment_method },
      { header: 'Dispensed by', width: 22, value: (s) => s.dispensed_by_name,
        tone: (s) => (s.dispensed_by_name ? null : NEGATIVE) },
      { header: 'Role', width: 16, value: (s) => s.dispensed_by_role },
      { header: 'Notes', width: 30, wrap: true, value: (s) => s.pharmacist_notes }
    ],
    rows: dispensations
  });

  // ---- Sheet 6: beds ------------------------------------------------------
  buildSheet(workbook.addSheet('Beds'), {
    title: 'Beds',
    subtitle: subtitleFor('bed occupancy at the moment of export'),
    checksum: checksumOf(beds),
    columns: [
      { header: 'Bed', width: 12, value: (b) => b.bed_code },
      { header: 'Ward', width: 26, value: (b) => b.ward_name },
      { header: 'Type', width: 22, value: (b) => b.bed_type },
      { header: 'State', width: 14, value: (b) => b.status,
        tone: (b) => (b.status === 'Occupied' ? NEGATIVE : POSITIVE) },
      { header: 'Patient', width: 22, value: (b) => b.patient_name },
      { header: 'Patient code', width: 16, value: (b) => b.patient_code },
      { header: 'Acuity', width: 18, value: (b) => b.acuity_level },
      { header: 'Admitted', width: 14, type: 'date', value: (b) => b.admission_date },
      { header: 'Diagnosis', width: 30, wrap: true, value: (b) => b.diagnosis },
      { header: 'Attending', width: 22, value: (b) => b.attending_doctor },
      { header: 'Last observations', width: 30, wrap: true, value: (b) => b.vitals_ticker },
      { header: 'Notes', width: 34, wrap: true, value: (b) => b.notes }
    ],
    rows: beds
  });

  // ---- Sheet 7: workplace incidents ---------------------------------------
  buildSheet(workbook.addSheet('Workplace health'), {
    title: 'Workplace health and safety',
    subtitle: subtitleFor('incidents recorded for mine site workers'),
    checksum: checksumOf(incidents),
    columns: [
      { header: 'Incident', width: 16, value: (i) => i.incident_code },
      { header: 'Worker', width: 24, value: (i) => i.patient_name },
      { header: 'Employee number', width: 16, value: (i) => i.employee_id },
      { header: 'Department', width: 24, value: (i) => i.department },
      { header: 'What happened', width: 26, wrap: true, value: (i) => i.incident_type },
      { header: 'Severity', width: 26, value: (i) => i.severity,
        tone: (i) => {
          const s = String(i.severity || '');
          if (s.includes('Lost Time')) return NEGATIVE;
          if (s.includes('Treatment')) return WARN;
          return null;
        } },
      { header: 'Date', width: 13, type: 'date', value: (i) => i.incident_date },
      { header: 'Fit for work', width: 24, value: (i) => i.fit_for_work_status },
      { header: 'Doctor recommendation', width: 44, wrap: true, value: (i) => i.doctor_recommendation }
    ],
    rows: incidents
  });

  // ---- Sheet 8: referrals -------------------------------------------------
  buildSheet(workbook.addSheet('Referrals'), {
    title: 'Referrals to other facilities',
    subtitle: subtitleFor('patients sent on, and what came back'),
    checksum: checksumOf(referrals),
    columns: [
      { header: 'Referral', width: 18, value: (r) => r.referral_code },
      { header: 'Referred', width: 18, type: 'datetime', value: (r) => r.created_at },
      { header: 'Hospital number', width: 16, value: (r) => r.hospital_number },
      { header: 'Patient', width: 24, value: (r) => r.patient_name },
      { header: 'Age', width: 7, type: 'number', value: (r) => r.age },
      { header: 'Sex', width: 9, value: (r) => r.gender },
      { header: 'Visit', width: 16, value: (r) => r.visit_code },
      { header: 'Diagnosis', width: 28, wrap: true, value: (r) => r.diagnosis },
      { header: 'Sent to', width: 30, wrap: true, value: (r) => r.referred_to },
      { header: 'Department', width: 18, value: (r) => r.department },
      { header: 'Urgency', width: 12, value: (r) => r.urgency,
        tone: (r) => (r.urgency === 'Emergency' ? NEGATIVE : r.urgency === 'Urgent' ? WARN : null) },
      { header: 'Transport', width: 18, value: (r) => r.transport },
      { header: 'Reason', width: 40, wrap: true, value: (r) => r.reason },
      { header: 'Clinical summary', width: 44, wrap: true, value: (r) => r.clinical_summary },
      { header: 'Referred by', width: 22, value: (r) => r.referred_by },
      { header: 'Outcome', width: 20, value: (r) => r.outcome,
        tone: (r) => (r.outcome === 'Died' ? NEGATIVE : r.outcome === 'Awaiting outcome' || r.outcome === 'Did not attend' ? WARN : null) },
      { header: 'Outcome note', width: 32, wrap: true, value: (r) => r.outcome_note },
      { header: 'Outcome recorded by', width: 22, value: (r) => r.outcome_by },
      { header: 'Outcome recorded', width: 18, type: 'datetime', value: (r) => r.outcome_at }
    ],
    rows: referrals
  });

  // ---- Sheet 9: activity record -------------------------------------------
  buildSheet(workbook.addSheet('Activity record'), {
    title: 'Activity record',
    subtitle: subtitleFor('what was done in the system, by whom, most recent first'),
    checksum: checksumOf(activity),
    columns: [
      { header: 'When', width: 17, type: 'datetime', value: (a) => a.created_at },
      { header: 'What', width: 28, value: (a) => a.action_type },
      { header: 'Who', width: 22, value: (a) => a.user_name,
        tone: (a) => (a.user_name === 'Unattributed' ? NEGATIVE : null) },
      { header: 'Role', width: 16, value: (a) => a.user_role },
      { header: 'Where', width: 20, value: (a) => a.location },
      { header: 'Patient', width: 22, value: (a) => a.patient_name },
      { header: 'Detail', width: 66, wrap: true, value: (a) => a.details },
      { header: 'Level', width: 11, value: (a) => a.severity,
        tone: (a) => (a.severity === 'Warning' ? WARN : a.severity === 'Critical' ? NEGATIVE : null) }
    ],
    rows: activity
  });

  // Cover figures read across from the ledger sheets, written last so the row
  // counts they point at are known.
  const ledgerRows = dispensations.length;
  const visitRows = visits.length;
  if (ledgerRows > 0) {
    cover.cell('B22').formula(`'Dispensing ledger'!H${5 + ledgerRows}`).style({ numberFormat: MONEY, fontSize: 9, bold: true });
    cover.cell('B23').formula(`'Dispensing ledger'!F${5 + ledgerRows}`).style({ numberFormat: MONEY, fontSize: 9, bold: true });
  } else {
    cover.cell('B22').value(0).style({ numberFormat: MONEY, fontSize: 9 });
    cover.cell('B23').value(0).style({ numberFormat: MONEY, fontSize: 9 });
  }
  if (visitRows > 0) {
    cover.cell('B24').formula(`'Outpatient visits'!T${5 + visitRows}`).style({ numberFormat: MONEY, fontSize: 9, bold: true });
  } else {
    cover.cell('B24').value(0).style({ numberFormat: MONEY, fontSize: 9 });
  }

  return encrypted
    ? workbook.outputAsync({ password: finalPassword })
    : workbook.outputAsync();
}

module.exports = { generateProtectedExcel };
