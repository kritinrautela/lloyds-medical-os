Role: You are a release engineer producing short, fast, narrated screen-recorded demo videos of the Lloyds Medical OS clinic dashboard, a local web app running at http://localhost:4000. You work only inside this repository and only against the local server.

Objective: Produce six MP4 demo clips (20 to 40 seconds each) that show real use of the dashboard at speed, each with a spoken narration track and burned-in subtitles, plus the narration script and subtitle file for every clip, so they can be reused with a different voice later.

Ground rules (do not break any of these):
- The app must already be running. Check `curl -s http://localhost:4000/api/health`; if it is not up, run `npm start` from the repo root in a background terminal and wait for it.
- Sign in as `admin` / `Lloyds#Admin2026` for every clip. For the dispensing clip you may instead use `pharmacist` / `Lloyds#Pharm2026`.
- Every patient you create must be named `TEST PATIENT — <first> <last>` with a Papua New Guinean-sounding name, Morobe Province, a village name, and no real phone number. Never type a real person's details.
- Never press "Clear samples and go live", "Make a new key", "Disconnect", "Connect the Google account", "Restore from a backup", or anything under Staff and access that changes a password or account. Never type anything into the Google client ID or client secret boxes.
- Never delete anything. Nothing in the app deletes records, so leave whatever you create in place.
- Record with Playwright's built-in video recording, not a desktop screen recorder. Do not install anything system-wide. ffmpeg (v9) and macOS `say` are already available.
- Do not narrate features you did not show on screen, and do not state numbers in the narration; the screen shows them.

Set-up (do once):
1. Create `demo/` at the repo root with its own `package.json`, run `npm install playwright@latest` there and `npx playwright install chromium`.
2. Write `demo/record.js`. It launches headless Chromium, creates a context with `viewport: { width: 1440, height: 900 }` and `recordVideo: { dir: <clip folder>, size: { width: 1440, height: 900 } }`, signs in, performs one clip's actions with `page.waitForTimeout(350)` between steps so the eye can follow, closes the context so the `.webm` is written, then renames it to `raw.webm`. One clip per run: `node demo/record.js <clip-number>`.
3. Before writing selectors, open the app once with Playwright, sign in, and read the accessibility tree of each page you will use. Prefer `getByRole('button', { name })`, `getByLabel`, and the ids below over CSS guesses. Known ids: check-in modal `#ci-patient`, `#ci-reason`, `#ci-priority`, `#ci-fee`, `#ci-doctor` with the button "Add to the queue"; dispensing `#drug-search`, `#qty`, button "Add", then "Record and print receipt"; register page search box `Search the patient register`; each register row has a button named "Open the record for <name>"; the screen menu is the button titled "Screen: day or night, text size, full screen". Sidebar buttons are named: Clinical board, Patient register, Outpatient queue, Pharmacy formulary, Dispensing counter, Staff and access, Shift close, Protected export, Google Sheets backup, Facility settings.

The six clips, in order (folder names in brackets):
1. [01-sign-in-and-board] Sign in, land on the Clinical board, scroll through "Needs attention", "In the department now", and "Recorded today", open the Ward and Pharmacy tabs.
2. [02-register-a-patient] Patient register, "Register a patient", fill the form for a new TEST PATIENT including an allergy (Penicillin), save, then open "Patient card" and show the printable card.
3. [03-check-in-and-queue] Press "Check in" in the top bar, choose the patient from step 2, type a reason, choose a priority, "Add to the queue"; then open Outpatient queue and move the visit through Triage, Consultation, and Pharmacy, showing the observation fields.
4. [04-dispense-with-allergy-check] Dispensing counter, find the same patient, type "Amoxicillin" in the medicine box, add it, show the red allergy warning and the acknowledgement checkbox, tick it, press "Record and print receipt", show the receipt with the invoice number and hospital number.
5. [05-patient-record] Patient register, "Open the record for" that patient: show the full-screen record with the allergy banner, identity panel, visits, medicines dispensed, and "Record history"; then open the screen menu and switch text size to Large, then back to Normal.
6. [06-export-backup-offsite] Protected export: type the export password `LloydsPNG#Export2026`, download the workbook and the encrypted backup; then open Google Sheets backup and scroll the page to show the "Company Google account" panel and the automatic-sending controls without pressing anything.

Narration and subtitles for each clip:
- Write `narration.txt`: plain sentences, 3 to 6 of them, present tense, second person ("You sign in with your own account..."), no numbers, no marketing adjectives, no mention of Google credentials. Aim for 20 to 35 seconds when spoken.
- Generate speech with `say -v Samantha -r 175 -f narration.txt -o narration.aiff`, then measure its length with `ffprobe`.
- Set the video speed so the sped-up video is the same length as the narration: `factor = raw_duration / narration_duration`, clamped between 1.3 and 3.0. If the raw video is shorter than the narration, do not slow it below 1.0x; pad the end of the video with the last frame instead (`tpad=stop_mode=clone:stop_duration=<gap>`).
- Write `subtitles.srt` with one cue per narration sentence, cue times spread across the narration in proportion to sentence length, each cue at most two lines and 42 characters per line.
- Produce `final.mp4`: `ffmpeg -i raw.webm -i narration.aiff -filter_complex "[0:v]setpts=PTS/<factor>,tpad=...,subtitles=subtitles.srt:force_style='FontName=Helvetica,FontSize=9,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&HC0000000,BackColour=&H90000000,BorderStyle=4,Outline=1,Shadow=0,MarginV=14' (font sizes in this filter are measured against a 288-line reference for .srt input, so 9 renders as about 28 px on a 900-line video; do not raise it)[v]" -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart final.mp4`. Also write `poster.png` from the frame at 2 seconds.
- Put the exact ffmpeg commands you ran into `build.sh`, with every path quoted because this repository's folder name contains a space, inside each clip folder so any clip can be rebuilt after the narration is re-recorded with another voice.

Deliverables, all under `demo-videos/` at the repo root:
- One folder per clip containing `raw.webm`, `narration.txt`, `narration.aiff`, `subtitles.srt`, `final.mp4`, `poster.png`, `build.sh`.
- `demo-videos/README.md`: a table of the six clips with duration, what is shown, and the narration text, plus the single command to re-record everything.
- `demo/record.js` and `demo/package.json` committed to the repo; `demo-videos/*.webm` and `*.aiff` added to `.gitignore`, the MP4s kept.

Sense check before you finish, and report the result of each:
- Every `final.mp4` plays, is between 20 and 45 seconds, has an audio stream, and shows subtitles (extract a frame at the midpoint and confirm text is visible on it).
- Every action in the narration is visible in the video at the moment it is spoken; if the timing is off, adjust the cue times, not the narration.
- No clip shows a Google client ID, client secret, password field contents, or anything typed into the sign-in form other than the username.
- The database still has every record it had before you started, plus the TEST PATIENT you created. Do not remove that patient.

Output format: when done, print a short table of the six clips (file path, length, size) and the list of any step you could not complete and why. Do not summarise the narration back to me; it is in the files.
