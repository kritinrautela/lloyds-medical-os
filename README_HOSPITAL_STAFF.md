# LLOYDS METALS & ENERGY LTD (PNG OPERATIONS)
### Clinical Operating Manual, Staff Account Guide & USB Pen-Drive Protocol

---

## 🏥 1. System Overview & Offline Portability
This hospital management and pharmacy operating system is tailored specifically for **Lloyds Metals & Energy Ltd** remote mining operations and community clinics in **Papua New Guinea (Morobe Concession / Markham Valley)**.

- **100% Offline-First**: Runs locally on any Windows PC or Mac directly from a USB flash drive (pen-drive) without requiring internet or Wi-Fi.
- **Embedded SQLite Database**: All patient records, clinical notes, rapid test results, and pharmacy transactions persist in `server/data/hospital.db` on the flash drive.
- **Official Lloyds Metals Branding**: Integrates the official corporate identity (`https://lloyds.in/`): black spoked-wheel emblem alongside the vibrant red (`#E31E24`) rectangular banner with bold black lettering `LLOYDS METALS`.

---

## 🚀 2. Quick Launch Guide (Double-Click Execution)

### On Windows:
1. Plug in your USB Pen Drive.
2. Double-click:
   ```cmd
   Start_Hospital_Windows.bat
   ```
3. The server starts and launches your default browser at: `http://localhost:4000`

### On macOS:
1. Double-click:
   ```bash
   Start_Hospital_Mac.command
   ```

---

## 👥 3. Staff Accounts & Role-Based Access Control (RBAC)
The system features end-to-end user authentication with SHA-256 offline hashing:

### Default Clinical Accounts (Default Password: `lloyds2026`):
| Username | Full Name | Role | Staff ID | Department |
| :--- | :--- | :--- | :--- | :--- |
| `doctor` | Chief Medical Officer | Chief Medical Officer | `LMEL-DOC-002` | Emergency & Tropical Medicine |
| `nurse` | Senior Triage Nurse | Senior Triage Nurse | `LMEL-NUR-003` | Outpatient & Acute Triage |
| `pharmacist` | Registered Chief Pharmacist | Registered Pharmacist | `LMEL-PHM-004` | Pharmacy & Medical Depot |
| `labtech` | Pathology & RDT Specialist | Pathology Technician | `LMEL-LAB-005` | Diagnostic Laboratory |
| `safety` | HSE Mine Health Officer | HSE Safety Officer | `LMEL-HSE-006` | Mine Occupational Safety |
| `admin` | Hospital Operations Director | Administrator | `LMEL-ADM-001` | Clinical Governance & Admin |

### Psychological 1-Click Shift Handover (Designed for Village Staff):
- Click **"Switch"** in the sidebar or top navigation bar to open the **Staff Access & Shift Portal**.
- Village health workers and shift workers can switch duty with **1 tap** on their role card without typing complex credentials.
- Clinical leads can register new staff anytime via the **"➕ New Staff Account"** tab or the **"Staff & Access Control"** page.

---

## 🔒 4. Anti-Theft & Read-Only Password-Protected Excel Audit
To eliminate medication diversion, black-market drug resale (Coartem, antibiotics, painkillers), and falsification of records:

1. **Dual-Layer Excel Security**:
   - **Layer 1: AES Compound Password Encryption**: The file cannot be opened without the facility security password (Default: `png_health_2026`).
   - **Layer 2: Worksheet Read-Only Cell Locking (`sheetProtection`)**: Every single sheet (*Executive KPIs, Observation Beds, Patients, Visits, Drug Inventory, Sales Ledger, Mine OHS*) has OpenXML cell protection enabled. **Staff can view all numbers and verify inventory, but CANNOT edit, alter, or delete rows.**
2. **Anti-Theft Hidden Password Console**:
   - The master password is **hidden from regular staff** in the UI so they cannot tamper with stock data or falsify drug sales.
   - Staff can download the encrypted workbook with a single click.
   - Only supervisors and administrators with the **Admin PIN** (`lloyds2026`) can unlock the security console to view or manage the master decryption key.
3. **Cryptographic Anti-Tampering Fingerprint**:
   - Each export generates a live SHA-256 digital checksum embedded in the header, locking the exact stock count and revenue snapshot.

---

## 🛏️ 5. Observation Bay & Inpatient Bed Management (10 Beds)
- **Bed 1**: Emergency Resuscitation Bay (Crash Bed — Severe Malaria / Artesunate IV)
- **Bed 2**: Emergency Resuscitation Bay (Acute Trauma / Suction ready)
- **Bed 3**: Tropical Ward (Step-Down Observation — Laceration & Wound Care)
- **Bed 4**: Tropical Ward (Pediatric & Dehydration — Oral Rehydration Therapy)
- **Bed 5**: Tropical Ward (Observation — Cleaned & Ready)
- **Bed 6**: Tropical Ward (Isolation / Vector-borne Sanitization)
- **Bed 7**: Mine OHS Bay (Industrial Trauma / Heat Stress — IV Hartmanns)
- **Bed 8**: Mine OHS Bay (Audiometry & Spirometry Station)
- **Bed 9**: Toxicology Bay (Taipan / Death Adder Snakebite — 20WBCT Venom Bed)
- **Bed 10**: Minor Surgical Procedure Table (Sterile Suture Pack)

---

## 📼 6. Live "Black Box" Action Recorder & 2D Spatial Map
- **Black Box Recorder**: Every clinical action, consultation, drug dispensation, triage assessment, and bed admission is logged to a tamper-evident audit stream showing timestamps, staff roles, and severity flags.
- **2D Spatial Concession Map**: Interactive visual floorplan of the 7 clinical departments (Emergency Bay, Triage Pavilion, Doctor Consult 1, Pharmacy & Vault, Pathology Lab, Inpatient Ward Beds, Mine OHS Unit) displaying live occupancy and active duty officers.

---

## ☁️ 7. Google Cloud & Google Sheets Auto-Replication
1. Go to **"Google Cloud Sync"**.
2. Sign in with the clinic Google account and enter your Google Sheet ID.
3. In remote bush camps with zero connectivity, data logs locally into SQLite.
4. Once the laptop detects Wi-Fi or mobile hotspot, the **Auto-Sync Engine** replicates records to Google Sheets with pre-generated calculation formulas (`SUM`, `COUNTIF`, `AVERAGE`, `IF` stock alerts).

---

## 💰 8. End-of-Day Shift Closeout & Safe Pen-Drive Eject
1. Go to **"Shift Reconciliation"**.
2. Tally physical PNG Kina cash against system revenue.
3. Enter counted cash, notes, and click **"Close & Finalize Today's Shift"**.
4. Click **"Safe Pen Drive Eject"** — SQLite caches flush cleanly to disk, generating an automated encrypted Excel backup before USB removal.
