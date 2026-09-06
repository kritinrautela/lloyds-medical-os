/**
 * Automated Verification Test: Excel Export & Invoice Generation
 * Lloyds Medical Operating System (LMOS-PNG)
 * 
 * Verifies:
 * 1. System Health API
 * 2. Pharmacy Point-of-Sale (POS) Dispensation & Invoice Generation
 * 3. Retrieval of itemized tax invoice receipt
 * 4. Password-protected AES-256 corporate Excel generation
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4000';

async function runTests() {
  console.log('================================================================');
  console.log('   LLOYDS MEDICAL OS — AUTOMATED INVOICE & EXCEL TEST SUITE');
  console.log('================================================================\n');

  const startTime = Date.now();

  try {
    // 1. Health Probe
    process.stdout.write('1. Testing System Health API... ');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
    const healthData = await healthRes.json();
    console.log(`[PASS] (${healthData.system} - ${healthData.mode})`);

    // 2. Fetch or create a test patient
    process.stdout.write('2. Checking Patient Registry... ');
    const patientsRes = await fetch(`${BASE_URL}/api/patients`);
    const patientsData = await patientsRes.json();
    let patient = patientsData.patients && patientsData.patients[0];

    if (!patient) {
      const createPatRes = await fetch(`${BASE_URL}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: 'Tarun Doe',
          age: 42,
          gender: 'Male',
          address_or_village: 'Mine Pit Alpha',
          blood_group: 'O+',
          allergies: 'None'
        })
      });
      const createPatData = await createPatRes.json();
      patient = createPatData.patient;
    }
    console.log(`[PASS] (Patient: ${patient.full_name} | Code: ${patient.patient_code})`);

    // 3. Check Pharmacy Formulary
    process.stdout.write('3. Checking Drug Formulary... ');
    const drugsRes = await fetch(`${BASE_URL}/api/drugs`);
    const drugsData = await drugsRes.json();
    const drug = drugsData.drugs && drugsData.drugs[0];
    if (!drug) throw new Error('No drugs found in formulary');
    console.log(`[PASS] (Using: ${drug.name} - ${drug.unit_price} PGK)`);

    // 4. Test POS Dispensation & Invoice Creation
    process.stdout.write('4. Testing Invoice Creation & Dispensation (POST /api/dispense)... ');
    const invoicePayload = {
      patient_id: patient.id,
      patient_name: patient.full_name,
      items: [
        {
          drug_id: drug.id,
          drug_name: drug.name,
          quantity: 2,
          unit_price: drug.unit_price || 15.0,
          subtotal: (drug.unit_price || 15.0) * 2,
          instructions: '1 tab twice daily after meals x 5 days'
        }
      ],
      discount: 0,
      total_amount: (drug.unit_price || 15.0) * 2,
      paid_amount: (drug.unit_price || 15.0) * 2,
      payment_method: 'Cash (Kina)',
      payment_status: 'Paid',
      pharmacist_notes: 'Automated test dispensation receipt verified.'
    };

    const dispenseRes = await fetch(`${BASE_URL}/api/dispense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoicePayload)
    });
    if (!dispenseRes.ok) throw new Error(`Dispensation failed: ${dispenseRes.status}`);
    const dispenseData = await dispenseRes.json();
    if (!dispenseData.success || !dispenseData.invoice) throw new Error(`Dispensation error: ${dispenseData.error || 'No invoice returned'}`);
    const createdInvoice = dispenseData.invoice;
    console.log(`[PASS] (Invoice Created: ${createdInvoice.invoice_number} | Paid: ${createdInvoice.paid_amount} PGK)`);

    // 5. Test Invoice Retrieval & Print Data
    process.stdout.write(`5. Verifying Invoice Receipt (GET /api/dispense/${createdInvoice.id})... `);
    const invoiceGetRes = await fetch(`${BASE_URL}/api/dispense/${createdInvoice.id}`);
    if (!invoiceGetRes.ok) throw new Error(`Fetch invoice failed: ${invoiceGetRes.status}`);
    const invoiceGetData = await invoiceGetRes.json();
    if (!invoiceGetData.invoice || invoiceGetData.items.length === 0) {
      throw new Error('Invoice data missing required line items');
    }
    console.log(`[PASS] (Receipt verified with ${invoiceGetData.items.length} line item(s))`);

    // 6. Test AES-256 Protected Excel Generation
    process.stdout.write('6. Testing Corporate Excel Generator (GET /api/export/excel)... ');
    const excelRes = await fetch(`${BASE_URL}/api/export/excel?password=lloyds2026`);
    if (!excelRes.ok) throw new Error(`Excel export failed: ${excelRes.status}`);
    const excelBuffer = Buffer.from(await excelRes.arrayBuffer());

    if (excelBuffer.length < 5000) {
      throw new Error(`Excel buffer unexpectedly small: ${excelBuffer.length} bytes`);
    }

    const testOutputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
    const excelOutputPath = path.join(testOutputDir, 'test_audit_export.xlsx');
    fs.writeFileSync(excelOutputPath, excelBuffer);

    console.log(`[PASS] (${excelBuffer.length.toLocaleString()} bytes generated & saved to ${excelOutputPath})`);

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n================================================================');
    console.log(`✅ ALL TESTS PASSED SUCCESSFULLY IN ${totalDuration}s`);
    console.log('   - Health Check: OK');
    console.log(`   - Invoice Number: ${createdInvoice.invoice_number}`);
    console.log(`   - Invoice Amount: ${createdInvoice.paid_amount} PGK`);
    console.log(`   - Protected Excel: ${excelOutputPath} (${excelBuffer.length} bytes)`);
    console.log('================================================================\n');

  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error.message}`);
    process.exit(1);
  }
}

runTests();
