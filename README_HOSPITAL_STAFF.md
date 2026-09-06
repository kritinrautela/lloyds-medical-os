# 🏥 Lloyds Medical OS — Clinical Staff Operating Guide
### Standard Operating Procedures & Quick Reference Manual
**Lloyds Metals & Energy Limited** • *Mining & Occupational Health Division*

---

## ⚡ 1. Starting the Clinic System

The platform runs 100% locally from your computer or clinic USB flash drive. No internet connection is required.

- **On Windows:** Double-click `Start_Hospital_Windows.bat`
- **On Mac:** Double-click `Start_Hospital_Mac.command`

Your default browser will open automatically to **`http://localhost:4000`**.

---

## 👥 2. Staff Roles & Default Login Passwords

All default accounts use the password: **`lloyds2026`**

| Role | Username | Password | Operational Duties |
| :--- | :--- | :--- | :--- |
| **Chief Medical Officer (Doctor)** | `doctor` | `lloyds2026` | Consultations, diagnosis, electronic prescriptions, inpatient admissions, shift sign-off |
| **Senior Triage Nurse** | `triage_officer` | `lloyds2026` | Patient check-in, vital signs intake, rapid malaria tests, observation bay monitoring |
| **Registered Pharmacist** | `pharmacist` | `lloyds2026` | Medication dispensing, inventory stock count, batch expiry control, POS cashiering |
| **Clinic Administrator** | `admin` | `lloyds2026` | Staff account creation, password resets, facility accreditation, system settings |

### Fast Shift Switch:
- Click **"Switch"** in the sidebar or top navigation bar to change duty officers instantly during shift handovers.
- Clinicians can register new staff accounts anytime under **Staff Management**.

---

## 📋 3. Step-by-Step Daily Patient Journey

```
[ Step 1: Check-In ] ──► [ Step 2: Triage ] ──► [ Step 3: Doctor ] ──► [ Step 4: Pharmacy ]
```

### Step 1: Patient Check-In (Triage Desk)
1. Click the green **"Check-in"** button in the top navigation bar.
2. Enter patient name, age, gender, and village or mine department.
3. The system automatically creates a unique date-stamped ID (e.g. `LMEL-20260906-001`). This ensures patients with similar names are never confused.
4. Click **"Check-in Patient"** to add them to the triage queue.

### Step 2: Vital Signs & Urgency Classification (Nurse)
1. In the **OPD & Triage Queue**, click on the patient.
2. Enter Blood Pressure, Pulse, SpO2, Temperature, Respiration Rate, and Weight.
3. The system highlights abnormal readings (fever, high BP, tachycardia, low oxygen) automatically.
4. Assign Manchester urgency category (*Emergency*, *Urgent*, or *Standard*).
5. The patient moves automatically into the Doctor's consultation waiting list.

### Step 3: Medical Consultation & Electronic Prescription (Doctor)
1. Open the **OPD & Triage Queue** and select the next waiting patient.
2. Review the patient's recorded vitals, chief complaint, and allergy warnings.
3. Enter clinical progress notes, physical exam findings, and diagnosis.
4. Select medications from the Essential Medicines Formulary and specify dosage instructions.
5. Click **"Save & Send to Pharmacy"**. The patient status updates to *At Pharmacy*.

### Step 4: Medication Dispensing & POS Cashiering (Pharmacist)
1. Open the **Dispensing POS** tab and select the patient from the prescription list.
2. Verify medication packages, batch numbers, and expiry dates.
3. Collect the consultation and medication fee in PNG Kina (PGK).
4. Click **"Dispense & Print Receipt"**.
5. The system automatically deducts stock from inventory and prints a bilingual official receipt.

---

## 🛏️ 4. Observation Bays & Emergency Trauma Care

The clinic is equipped with a 10-bed observation and critical care matrix:
- **Beds 1 & 2 (Emergency Resuscitation Bays):** Severe malaria IV artesunate, acute blast/trauma resuscitation.
- **Beds 3 to 6 (Tropical Ward):** Wound care, IV hydration, post-consultation observation, isolation.
- **Beds 7 & 8 (Mine Occupational Health Bays):** Heavy equipment crush injuries, heat stress, occupational spirometry.
- **Bed 9 (Toxicology & Snakebite Bay):** Death Adder / Papuan Taipan 20WBCT venom testing bed.
- **Bed 10 (Procedure Table):** Sterile suture packs and minor surgical procedures.

---

## 💰 5. End-of-Day Shift Closeout Protocol

To prevent pharmaceutical diversion and ensure financial accountability:

1. At the end of the shift, go to **Shift Reconciliation**.
2. Count all physical cash in the clinic safe or cash drawer.
3. Enter the physical cash count into the reconciliation box.
4. Confirm that the system displays **`0.00 BALANCED`**.
5. Enter shift handover notes and click **"Close & Finalize Today's Shift"**.
6. Click **"Print Shift Audit Report"** to print the official A4 Shift Certificate.
7. Have the Supervising Doctor and Shift Pharmacist physically sign the report.

---

## 💾 6. Safe USB Pen Drive Eject

When running the system directly from a USB drive:
1. Complete the End-of-Day shift closeout.
2. Double-click the eject script:
   - **Windows:** `Safe_Pen_Drive_Eject.bat`
   - **Mac:** `Safe_Pen_Drive_Eject.command`
3. This flushes all SQLite database records cleanly to the drive before unplugging, preventing file corruption.

---

## 📶 7. Using Tablets on Clinic Local Wi-Fi

Multiple staff members can work simultaneously across different rooms:
1. Connect all clinic computers and tablets to the same local Wi-Fi router (no internet required).
2. On the main computer running the system, find your IP address (e.g. `192.168.1.50`).
3. On other tablets or laptops, open the browser and enter:
   ```
   http://192.168.1.50:4000
   ```
   *(Use the main computer's actual IP address)*.

---

## 🔒 8. Encrypted Corporate Excel Audit Export

To export monthly or quarterly clinic reports for corporate auditors or medical directors:
1. Open the **Excel Export** page.
2. Click **"Unlock Security Console"** and enter the Master PIN: **`lloyds2026`**.
3. Download the encrypted multi-worksheet Excel workbook.
4. All worksheets are protected against editing, locking stock counts and financial numbers.

---

*Lloyds Metals & Energy Limited — Mining & Occupational Health Division*  
*Concession Operations Base • Papua New Guinea • Ref: PNG-MOH-LMEL-2026*
