# Lloyds Medical OS — Demo Video Suite

Official screen-recorded walkthrough clips of the Lloyds Medical OS clinic management system running against the local server. Each clip features high-speed screen interaction, spoken narration (macOS Samantha voice, 175 wpm), and burned-in accessible subtitles.

## Clips Catalog

| Clip | Duration | File Size | What is Shown | Narration Text |
| :--- | :--- | :--- | :--- | :--- |
| **01-sign-in-and-board** | `22.2s` | `2.58 MB` | Sign in, land on the Clinical board, scroll sections, open Ward and Pharmacy tabs | You sign in with your clinic account to open the clinical board. The overview highlights patients who need immediate attention and those currently in the department. As the shift progresses, recorded consultations and discharges appear in the daily ledger. You switch to the ward view to check bed occupancy and patient placements. The pharmacy board gives an instant count of stocked medications and items running low. |
| **02-register-a-patient** | `25.2s` | `2.18 MB` | Patient register, register a new test patient with Penicillin allergy, view printable card | You open the patient register to enrol a person presenting to the clinic. You enter their full name, age, home village, and province. Any known allergy is recorded here so that every department sees it. Once saved, the system assigns a permanent hospital number for life. You open the printable patient card to hand to the patient for their visits. Every patient record is stored safely in the clinic database, ready for immediate access during care. |
| **03-check-in-and-queue** | `22.3s` | `1.70 MB` | Check in the test patient, move visit through OPD queue stages and show observations | From the top bar, you check a patient into the outpatient queue. You select the patient, state the presenting complaint, and assign a triage priority. In the outpatient queue, clinicians monitor waiting times and open visits. You record triage observations including blood pressure, pulse, and temperature. The visit moves forward through consultation to pharmacy as care is delivered. |
| **04-dispense-with-allergy-check** | `23.0s` | `1.56 MB` | Dispensing counter, prescribe Amoxicillin, show allergy warning, acknowledge and print receipt | At the dispensing counter, you select the patient from the queue or register. You search for the prescribed medication and specify the quantity to hand over. Because the patient has a penicillin allergy, a red safety alert warns against dispensing. After consulting the clinician, you confirm the clinical check and acknowledge the decision. You complete the dispensing to update stock and generate an official receipt. |
| **05-patient-record** | `22.1s` | `2.15 MB` | Patient register, open full record with allergy banner and history, switch text size | You open the patient register and bring up the complete clinical file. An allergy alert remains prominent across the top of the record. You review the patient identity panel, past consultations, and dispensed medications. The audit log tracks every entry recorded under the attending clinician. From the screen menu, you can enlarge the display for bedside care and return to normal view. |
| **06-export-backup-offsite** | `22.9s` | `2.47 MB` | Protected export with password, download workbook and backup, inspect Google Sheets backup | You open protected export to create offline copies of clinic records. Entering the facility export password unlocks an encrypted audit workbook. You can also download a full encrypted database archive for safe storage. In Google Sheets backup, automated replication settings keep an offsite record. Scheduled synchronization runs quietly in the background whenever a network is connected. |

## Directory Structure

Each clip folder under `demo-videos/` contains:
- `raw.webm` — High-resolution Playwright screen capture (1440×900 viewport).
- `narration.txt` — Narration script in second person, present tense.
- `narration.aiff` — Generated speech audio.
- `subtitles.srt` — Accurate time-coded subtitles with line-length constraints.
- `final.mp4` — Production MP4 with sped-up video, synchronized audio, and burned-in subtitles.
- `poster.png` — Video poster thumbnail captured at the 2-second mark.
- `build.sh` — Standalone script to re-encode `final.mp4` with alternative voiceovers.

## How to Re-Record Everything

To re-record and re-encode all clips in sequence:

```bash
# Ensure clinic server is active
curl -s http://localhost:4000/api/health

# Run full demo recording and processing suite
node demo/record.js all
```

To re-record or re-build an individual clip:

```bash
node demo/record.js 1   # Re-records and encodes clip 1
```
