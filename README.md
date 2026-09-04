# Lloyds Medical Operating System (LMOS-PNG)
### Occupational Health & Community Hospital Platform — Papua New Guinea Concessions
**Lloyds Metals & Energy Limited** • *Document Ref: LMEL-TECH-2026-V2.6 | Concession Ref: PNG-MOH-LMEL-2026*

---

## Executive Overview
The **Lloyds Medical Operating System (LMOS-PNG)** is an institutional, 100% offline-first clinical operating system designed specifically for remote mining concessions, exploration camps, community health centres, and rural emergency trauma stations.

### Core Strategic Advantages:
1. **100% Offline-First Architecture**: Operates directly off a portable USB flash drive with embedded SQLite. Zero external database servers and zero internet required.
2. **Psychologically Intuitive UI**: Designed with high-contrast HUD telemetry, live CRT-style ECG waveforms, and large, color-coded visual buttons so community health workers and local staff can operate the system with minimal technical training.
3. **Strict Financial & Pharmaceutical Control**: Daily drawer cash balancing against system revenues, automated variance calculation (`0.00 BALANCED`), real-time stock depletion for PNG essential medicines, and tamper-proof AES-encrypted Excel archives protected by a hidden Admin PIN console.
4. **Institutional Printable Documentation**: High-fidelity CSS print engine generating official A4 and 80mm thermal receipts, patient identification badges with scannable QR codes, daily OPD patient census registers, and triple-signed end-of-day clinical audit reports.
5. **Hybrid Cloud & Wi-Fi Sync**: Automatically queues all clinical records offline and replicates to corporate Google Sheets whenever camp Wi-Fi or a smartphone hotspot is detected.

---

## Quick Start Guide (Zero to Running in 60 Seconds)

### Method 1: 1-Click Launch from USB Pen Drive
1. Insert the USB pen drive into any laptop or PC at the clinic.
2. Open the drive:
   - **On Windows**: Double-click `Start_Hospital_Windows.bat`
   - **On macOS**: Double-click `Start_Hospital_Mac.command`
3. A terminal window will open and launch the local engine.
4. Open Google Chrome or any browser at: **`http://localhost:4000`**
5. The complete Lloyds Medical Command Center will load immediately. Zero internet is needed!

### Method 2: Clinic Multi-Device Wi-Fi (LAN Mode)
1. Connect the host clinic laptop to the local clinic Wi-Fi router (broadband internet is NOT required).
2. Start the server on the host laptop. Note the LAN address displayed (e.g. `http://10.130.98.192:4000`).
3. Any tablet, doctor laptop, or pharmacy computer connected to that local Wi-Fi can open that address in their browser to access the live clinic database simultaneously.

---

## Master Credentials & Access Keys

| Account / Role | Username | Default Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Master Admin Console** | `admin` | `lloyds2026` | Full system control, staff management, password changes, and hospital settings. |
| **Hidden Excel Admin PIN** | *(Unlock PIN)* | `lloyds2026` | Reveals export password and unlocks encrypted Excel archives. |
| **Supervising Medical Officer**| `doctor` | `lloyds2026` | OPD diagnosis, clinical prescriptions, notes, and audit sign-offs. |
| **Senior Triage Nurse** | `triage_officer` | `lloyds2026` | Patient check-in, vitals logging, emergency timers, and queue updates. |

---

## Daily Clinic Workflow (Standard Operating Procedure)

1. **Morning Shift Start**: Power on clinic PC, run launcher, log in, and verify pharmacy stock levels.
2. **Patient Intake & Triage**: Click **Quick Check-in**, log vital signs (BP, Pulse, SpO2, Temp), assign Manchester priority (Immediate / Urgent / Standard).
3. **Doctor Consultation**: Open **OPD Queue**, review vitals, document diagnosis, and click **Save & Send to Pharmacy**.
4. **Pharmacy Dispensation**: Open **Dispense POS**, dispense prescribed medicines, collect fees, and print official medical receipt.
5. **Evening Shift Closeout & Financial Audit**:
   - Open **End-of-Day** tab.
   - Count physical drawer cash and enter count.
   - Verify variance shows **`0.00 (BALANCED)`**.
   - Enter handover notes and click **Close & Finalize Today's Shift**.
   - Click **Print Shift Audit Report**, sign with Supervising Medical Officer, and affix official clinic stamp.
   - Click **Safe Pen Drive Eject** to download encrypted backup and safely remove the drive.

---

## Executive Manual & Documentation

- **Executive PDF Manual (4.5 MB, Full Color with Screenshots)**: [`docs/Lloyds_Medical_OS_Executive_Manual.pdf`](file:///Users/kritin/LLOYDS%20SERVER%20/docs/Lloyds_Medical_OS_Executive_Manual.pdf)
- **Editable Word Manual**: [`docs/Lloyds_Medical_OS_Executive_Manual.docx`](file:///Users/kritin/LLOYDS%20SERVER%20/docs/Lloyds_Medical_OS_Executive_Manual.docx)
- **Web Executive Briefing**: [`docs/Executive_Report_Lloyds_Medical_OS.html`](file:///Users/kritin/LLOYDS%20SERVER%20/docs/Executive_Report_Lloyds_Medical_OS.html)

---
*Lloyds Metals & Energy Limited • Mining & Occupational Health Division • Papua New Guinea*
