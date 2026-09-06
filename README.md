<div align="center">

# 🏥 Lloyds Medical OS

**A complete, offline-first hospital and clinic management system built for remote worksites, mining concessions, and community health centers.**

Runs 100% locally from any laptop or USB drive — zero cloud, zero internet, and zero external database setup required.

[Quick Start](#-quick-start) • [What It Does](#-what-does-this-program-do) • [Default Logins](#-default-logins) • [Screenshots](#-screenshots) • [Tech Stack](#-tech-stack) • [How Data Is Saved](#-where-is-data-stored)

---

</div>

## 💡 Why Lloyds Medical OS?

Most modern hospital software requires constant high-speed internet, cloud subscriptions, and complicated server setups. In remote mining camps, exploration sites, and rural clinics, internet connectivity frequently drops for days or weeks.

**Lloyds Medical OS solves this problem:**
- **Works 100% Offline:** You can run it on a laptop in the middle of the jungle with no internet connection.
- **Instant Setup:** Just double-click a launcher or run one command — no Docker, MySQL, or cloud needed.
- **Multi-Device over Local Wi-Fi:** Doctors, triage nurses, and pharmacists can all use their own laptops or tablets connected to the same clinic Wi-Fi router, even with no internet access.
- **Zero-Loss Accountability:** All patient records, pharmacy sales, and cash collections are saved to a local database and can be exported as password-protected Excel audit sheets.

---

## ⚡ Quick Start: 3 Easy Steps

Running Lloyds Medical OS on any computer takes **less than 60 seconds** with **zero configuration**:

### 1️⃣ Step 1: Get the Folder
- **Direct Download (Easiest):** Click the green **Code** button at the top of this GitHub page and select **[Download ZIP](https://github.com/kritinrautela/lloyds-medical-os/archive/refs/heads/main.zip)**, then unzip it on your computer.
- **Or via Git:**
  ```bash
  git clone https://github.com/kritinrautela/lloyds-medical-os.git
  cd lloyds-medical-os
  ```

### 2️⃣ Step 2: Double-Click the Launcher
Open the folder and simply double-click the file for your computer:
- **On Windows:** `Start_Hospital_Windows.bat`
- **On Mac:** `Start_Hospital_Mac.command`

> 💡 **Everything is Automatic:** You do not need to install anything beforehand. If your computer doesn't have Node.js or packages installed, the launcher automatically downloads and sets up everything in the background! It also creates a **"Lloyds Medical OS"** shortcut on your Desktop so you can launch it with 1 click anytime.

### 3️⃣ Step 3: Log In & Use
Your web browser will pop open automatically to:  
👉 **`http://localhost:4000`**

Log in using:
- **Username:** `admin` (or `doctor`, `triage_officer`, `pharmacist`)
- **Password:** `lloyds2026`

That's it! You are ready to manage patient check-in, triage, doctor consultations, and pharmacy sales completely offline.

---

### 💻 Developer Option (Terminal)
If you prefer using the terminal:
```bash
npm run setup    # One-click install for server & client
npm start        # Launches production server on http://localhost:4000
# or for active development: npm run dev
```

---

## 🔑 Default Logins

The system comes pre-configured with 4 ready-to-use staff accounts. All accounts use the same password: **`lloyds2026`**

| Role | Username | Password | What this account does |
| :--- | :--- | :--- | :--- |
| **Doctor / Medical Lead** | `doctor` | `lloyds2026` | Patient consultations, diagnoses, electronic prescriptions, inpatient admissions |
| **Triage Nurse** | `triage_officer` | `lloyds2026` | Patient check-in, vital signs intake (BP, pulse, SpO2, temp), urgent triage sorting |
| **Pharmacist** | `pharmacist` | `lloyds2026` | Medication dispensing, inventory stock counts, batch expiry, Kina cash register |
| **Administrator** | `admin` | `lloyds2026` | Manage staff accounts, reset passwords, change clinic settings, purge demo data |

*(You can create new staff accounts or change passwords anytime from the **Staff Management** page).*

---

## 📋 What Does This Program Do?

Lloyds Medical OS provides an end-to-end clinical workflow from the moment a patient walks in until their medicine is dispensed and the day's cash is counted:

```
[ 1. Check-In ] ──► [ 2. Triage & Vitals ] ──► [ 3. Doctor Consult ] ──► [ 4. Pharmacy & POS ] ──► [ 5. Shift Balancing ]
```

### 1. 🗂️ Patient Registry & Unique ID
- Register new patients in 10 seconds.
- Automatically assigns a unique, date-stamped patient code (e.g. `LMEL-20260906-001`) so patients with similar names are never confused.
- Generates printable digital patient passes and complete medical dossiers.

### 2. 🩺 Triage & Live Vital Signs
- Record Blood Pressure, Heart Rate, Oxygen Saturation (SpO2), Core Temperature, and Respiration.
- Automatic urgency flags for fever, hypertension, tachycardia, and low oxygen.
- Real-time telemetry monitor showing clinic status.

### 3. 👨‍⚕️ Doctor Consultation Suite & Clinical Decision Support (CDS)
- **Live Waiting Queue:** Real-time visibility into triaged patients, waiting duration, and triage priority.
- **Automated Hemodynamic CDS:** Real-time calculation of **Shock Index (`HR / SBP`)**, **Mean Arterial Pressure (MAP)**, and **NEWS2 Risk Scoring** bar.
- **Patient Allergy Cross-Check:** Instant pulsing warning banner if a patient has documented sensitivities (e.g. Penicillin, Sulphonamides, Aspirin).
- **1-Click ICD-10 Diagnostic Presets:** Instant diagnostic coding for PNG regional emergencies (*Falciparum Malaria B50.9*, *Snake Venom T63.0*, *Blast Trauma T14.1*, *Heat Exhaustion T67.0*).
- **Rapid Diagnostic Test (RDT) Ordering:** 1-click lab orders for Malaria RDT, 20-Min Whole Blood Clotting Test (20WBCT), Blood Glucose, Dengue NS1, and FBC.
- **Electronic Prescriptions:** Authorize medication orders directly sent to the dispensary.

### 4. 💊 Pharmacy, Stock Control & POS Cashier
- Pre-loaded with essential medicines (antimalarials, CSL antivenom, antibiotics, IV fluids, analgesics).
- Automatic inventory decrement upon prescription dispensation with batch tracking and FEFO expiry guards.
- Point of Sale (POS) cashiering collecting consultation fees & medication costs in PNG Kina (PGK) with A4 itemized tax invoices.

### 5. 🛏️ Inpatient Ward Census & Bed Management (10 Beds)
- Interactive admission & discharge for 10 specialized ward bays (*Emergency Resuscitation, Snakebite Toxicology, Mine OHS, Tropical Medicine, Minor Surgical*).
- Clinical Acuity categorization: *Resuscitation (Acuity 1)*, *High Dependency (Acuity 2)*, *Urgent (Acuity 3)*, *Moderate (Acuity 4)*, and *Stable (Acuity 5)*.
- Live attending doctor tracking, telemetry vitals ticker, and decontamination/sanitization status workflow.

### 6. 💰 End-of-Day Financial Balancing & Shift Handover
- Reconciles total consultation fees + pharmacy sales against physical cash in the clinic safe.
- Enforces zero-variance balancing (`0.00`) before shift closure to prevent theft and drug diversion.
- Shift handover digital logbook passed seamlessly across Day & Night shifts without page reloads.

### 7. ☁️ Offline-First with Hybrid Google Drive & Sheets Sync
- **100% Offline Local SQLite WAL:** Operates uninterrupted with zero internet access.
- **1-Click Google Drive Data Pack:** Download a multi-table bundle (.JSON + multi-sheet CSV tables for Patients, Visits, Pharmacy, Dispensations, Inpatient Beds, and OHS Incidents).
- **Embedded Google Sheets Formulas:** Pre-configured with `=SUM()`, `=COUNTIF()`, and `=AVERAGE()` formulas for instant cloud analytics.
- **Automatic Wi-Fi Detection:** Background auto-sync flushes queued shift records to Google Drive and webhook endpoints the moment clinic Wi-Fi detects an active internet uplink.

### 8. 🔒 Tamper-Proof Black Box & Encrypted Excel
- **Black Box Recorder:** Every admission, prescription dispensation, check-in, and settings modification is recorded in a cryptographically sequenced audit log.
- **AES-256 Encrypted Excel:** Generates corporate-grade, password-protected multi-tab Excel workbooks (decryption PIN: `lloyds2026`).

---

## 📸 Screenshots

| Command Center & Clinical Dashboard | OPD Triage Queue |
| :---: | :---: |
| ![Command Center](docs/assets/command_center_hero_hq.png) | ![OPD Queue](docs/assets/opd_queue_5_patients_1788535530397.png) |

| Pharmacy Formulary & Dispensing POS | End-of-Day Financial Shift Balancing |
| :---: | :---: |
| ![Pharmacy POS](docs/assets/dispense_pos_live.png) | ![Shift Balancing](docs/assets/shift_reconciliation_page_1788530220127.png) |

---

## 📶 Using Tablets & Multiple Computers on Clinic Wi-Fi

You can connect tablets, phones, and secondary laptops in the clinic **without any internet**:

1. Connect the host computer and your tablets to the **same Wi-Fi router** (the router does not need to be plugged into the internet).
2. Find the IP address of the main computer running the system:
   - On Windows: Run `ipconfig` in Command Prompt (e.g. `192.168.1.50`)
   - On Mac: Check System Settings > Wi-Fi Details
3. On your tablets or laptops, open the browser and go to:
   ```
   http://192.168.1.50:4000
   ```
   *(Replace with your computer's actual IP address)*

Now the Triage Nurse, Doctor, and Pharmacist can all work on their own screens simultaneously!

---

## 💾 Where Is Data Stored?

Everything is saved locally on your computer in a single file:
```
server/data/hospital.db
```
- **Engine:** SQLite 3 with Write-Ahead Logging (WAL) enabled.
- **Safety:** Even if the power cuts or the computer abruptly shuts down, your data is safe and will not corrupt.
- **Privacy:** No patient records or financial numbers are ever sent to external cloud servers.
- **Clearing Demo Data:** If you want to wipe sample test data and start fresh for a real clinic, go to **Facility Settings** and click **"Purge Demo Data & Start Clean"**.

---

## 🛠️ Tech Stack

- **Frontend:** [React 18](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), Lucide Icons
- **Backend:** [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/)
- **Database:** [SQLite 3](https://www.sqlite.org/) (WAL mode)
- **Reporting:** `excel4node` (AES-256 encrypted multi-tab Excel workbooks)
- **Printing:** Standard CSS Paged Media for 80mm thermal receipts and A4 audit certificates

---

## 📁 Project Structure

```text
lloyds-medical-os/
├── Start_Hospital_Windows.bat   # 1-Click launcher for Windows
├── Start_Hospital_Mac.command   # 1-Click launcher for Mac
├── Safe_Pen_Drive_Eject.bat     # Flushes database safely before USB removal
├── client/                      # React frontend application
│   ├── src/
│   │   ├── pages/               # Dashboard, Patients, Triage, Pharmacy, POS, Settings
│   │   ├── components/          # Modals, Navbar, Sidebar, Telemetry cards
│   │   └── services/api.js      # Local API connection
├── server/                      # Node.js backend & SQLite database
│   ├── data/hospital.db         # The single SQLite database file holding all data
│   ├── routes/                  # API endpoints (patients, visits, drugs, auth, etc.)
│   └── server.js                # Express web server
└── docs/                        # Complete 20-page executive PDF manual and assets
```

---

## 📖 Full Executive Manual

For formal hospital documentation, clinical protocols, and accreditation details, see:
- 📄 **[Executive Manual (20-Page PDF)](docs/Lloyds_Medical_OS_Executive_Manual.pdf)**
- 🏥 **[Clinical Staff Protocol Guide](README_HOSPITAL_STAFF.md)**
- 💾 **[USB Pen-Drive Quick Instructions](00_START_HERE.txt)**

---

## 🏢 Organization & License

Built for **Lloyds Metals & Energy Limited (LMEL)**  
Occupational Health, Mining Concessions & Community Health Division.  
*All rights reserved.*
