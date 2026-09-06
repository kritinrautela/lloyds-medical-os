const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:4000';
const REPO_ROOT = path.resolve(__dirname, '..');
const DEMO_VIDEOS_DIR = path.resolve(REPO_ROOT, 'demo-videos');
const FFMPEG_BIN = path.resolve(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg');

// Narration text for each clip (plain sentences, present tense, second person, no numbers, no marketing adjectives)
const NARRATIONS = {
  1: [
    "You sign in with your clinic account to open the clinical board.",
    "The overview highlights patients who need immediate attention and those currently in the department.",
    "As the shift progresses, recorded consultations and discharges appear in the daily ledger.",
    "You switch to the ward view to check bed occupancy and patient placements.",
    "The pharmacy board gives an instant count of stocked medications and items running low."
  ],
  2: [
    "You open the patient register to enrol a person presenting to the clinic.",
    "You enter their full name, age, home village, and province.",
    "Any known allergy is recorded here so that every department sees it.",
    "Once saved, the system assigns a permanent hospital number for life.",
    "You open the printable patient card to hand to the patient for their visits.",
    "Every patient record is stored safely in the clinic database, ready for immediate access during care."
  ],
  3: [
    "From the top bar, you check a patient into the outpatient queue.",
    "You select the patient, state the presenting complaint, and assign a triage priority.",
    "In the outpatient queue, clinicians monitor waiting times and open visits.",
    "You record triage observations including blood pressure, pulse, and temperature.",
    "The visit moves forward through consultation to pharmacy as care is delivered."
  ],
  4: [
    "At the dispensing counter, you select the patient from the queue or register.",
    "You search for the prescribed medication and specify the quantity to hand over.",
    "Because the patient has a penicillin allergy, a red safety alert warns against dispensing.",
    "After consulting the clinician, you confirm the clinical check and acknowledge the decision.",
    "You complete the dispensing to update stock and generate an official receipt."
  ],
  5: [
    "You open the patient register and bring up the complete clinical file.",
    "An allergy alert remains prominent across the top of the record.",
    "You review the patient identity panel, past consultations, and dispensed medications.",
    "The audit log tracks every entry recorded under the attending clinician.",
    "From the screen menu, you can enlarge the display for bedside care and return to normal view."
  ],
  6: [
    "You open protected export to create offline copies of clinic records.",
    "Entering the facility export password unlocks an encrypted audit workbook.",
    "You can also download a full encrypted database archive for safe storage.",
    "In Google Sheets backup, automated replication settings keep an offsite record.",
    "Scheduled synchronization runs quietly in the background whenever a network is connected."
  ]
};

const CLIPS = {
  1: {
    id: 1,
    name: '01-sign-in-and-board',
    desc: 'Sign in, land on the Clinical board, scroll sections, open Ward and Pharmacy tabs',
    run: runClip1
  },
  2: {
    id: 2,
    name: '02-register-a-patient',
    desc: 'Patient register, register a new test patient with Penicillin allergy, view printable card',
    run: runClip2
  },
  3: {
    id: 3,
    name: '03-check-in-and-queue',
    desc: 'Check in the test patient, move visit through OPD queue stages and show observations',
    run: runClip3
  },
  4: {
    id: 4,
    name: '04-dispense-with-allergy-check',
    desc: 'Dispensing counter, prescribe Amoxicillin, show allergy warning, acknowledge and print receipt',
    run: runClip4
  },
  5: {
    id: 5,
    name: '05-patient-record',
    desc: 'Patient register, open full record with allergy banner and history, switch text size',
    run: runClip5
  },
  6: {
    id: 6,
    name: '06-export-backup-offsite',
    desc: 'Protected export with password, download workbook and backup, inspect Google Sheets backup',
    run: runClip6
  }
};

async function createRecordedPage(clipDir) {
  fs.mkdirSync(clipDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: clipDir,
      size: { width: 1440, height: 900 }
    }
  });

  const page = await context.newPage();
  return { browser, context, page };
}

async function finalizeRecording(context, page, clipDir) {
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const videoPath = await video.path();
    const targetPath = path.join(clipDir, 'raw.webm');
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(videoPath, targetPath);
    console.log(`Saved raw video to: ${targetPath}`);
  }
}

async function signIn(page, username = 'admin', password = 'Lloyds#Admin2026') {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const userField = page.locator('#login-user');
  if (await userField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await userField.click();
    await userField.fill('');
    await userField.type(username, { delay: 40 });
    await page.waitForTimeout(350);

    const passField = page.locator('#login-pass');
    await passField.click();
    await passField.fill('');
    await passField.type(password, { delay: 20 });
    await page.waitForTimeout(350);

    await page.locator('button[type="submit"]:has-text("Sign in")').click();
    await page.waitForTimeout(800);
  }

  await page.waitForSelector('#primary-navigation', { timeout: 8000 });
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// CLIP 1: Sign in and Clinical Board
// ---------------------------------------------------------------------------
async function runClip1(clipDir) {
  const { browser, context, page } = await createRecordedPage(clipDir);
  try {
    console.log('[Clip 1] Signing in...');
    await signIn(page, 'admin', 'Lloyds#Admin2026');

    // Land on clinical board
    await page.locator('#nav-btn-dashboard').click();
    await page.waitForTimeout(1500);

    // Scroll through "Needs attention"
    console.log('[Clip 1] Scrolling to Needs attention...');
    await page.evaluate(() => {
      window.scrollBy({ top: 380, behavior: 'smooth' });
    });
    await page.waitForTimeout(2800);

    // Scroll through "In the department now"
    console.log('[Clip 1] Scrolling to In the department now...');
    await page.evaluate(() => {
      window.scrollBy({ top: 420, behavior: 'smooth' });
    });
    await page.waitForTimeout(3000);

    // Scroll through "Recorded today"
    console.log('[Clip 1] Scrolling to Recorded today...');
    await page.evaluate(() => {
      window.scrollBy({ top: 450, behavior: 'smooth' });
    });
    await page.waitForTimeout(3000);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1500);

    // Open the Ward tab
    console.log('[Clip 1] Opening Ward tab...');
    await page.locator('button:has-text("Ward")').first().click();
    await page.waitForTimeout(3500);

    // Open Pharmacy tab
    console.log('[Clip 1] Opening Pharmacy tab...');
    await page.locator('button:has-text("Pharmacy")').first().click();
    await page.waitForTimeout(3500);

    await page.waitForTimeout(1000);
  } finally {
    await finalizeRecording(context, page, clipDir);
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// CLIP 2: Register a Patient
// ---------------------------------------------------------------------------
async function runClip2(clipDir) {
  const { browser, context, page } = await createRecordedPage(clipDir);
  try {
    console.log('[Clip 2] Signing in...');
    await signIn(page, 'admin', 'Lloyds#Admin2026');

    console.log('[Clip 2] Opening Patient register...');
    await page.locator('#nav-btn-patients').click();
    await page.waitForTimeout(1200);

    console.log('[Clip 2] Clicking Register a patient...');
    await page.locator('button:has-text("Register a patient")').first().click();
    await page.waitForTimeout(1000);

    const patientName = 'TEST PATIENT — Maloni Golu';
    console.log(`[Clip 2] Registering ${patientName}...`);
    await page.locator('#p-name').fill(patientName);
    await page.waitForTimeout(400);

    await page.locator('#p-age').fill('34');
    await page.waitForTimeout(400);

    await page.locator('#p-gender').selectOption('Male');
    await page.waitForTimeout(400);

    await page.locator('#p-province').selectOption('Morobe Province');
    await page.waitForTimeout(400);

    await page.locator('#p-district').fill('Huon Gulf');
    await page.waitForTimeout(400);

    await page.locator('#p-village').fill('Gabensis Village');
    await page.waitForTimeout(400);

    await page.locator('#p-allergies').fill('Penicillin');
    await page.waitForTimeout(400);

    await page.locator('#p-emergency').fill('Brother — Gabensis Village (no phone)');
    await page.waitForTimeout(800);

    console.log('[Clip 2] Submitting registration...');
    await page.locator('button[type="submit"]:has-text("Register and issue a number")').click();
    await page.waitForTimeout(2500);

    console.log('[Clip 2] Opening Printable patient card...');
    await page.locator('button:has-text("Print the patient card")').click();
    await page.waitForTimeout(4500);

    await page.waitForTimeout(1000);
  } finally {
    await finalizeRecording(context, page, clipDir);
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// CLIP 3: Check-in and Outpatient Queue
// ---------------------------------------------------------------------------
async function runClip3(clipDir) {
  const { browser, context, page } = await createRecordedPage(clipDir);
  try {
    console.log('[Clip 3] Signing in...');
    await signIn(page, 'admin', 'Lloyds#Admin2026');

    console.log('[Clip 3] Clicking Check in in top bar...');
    await page.locator('header button:has-text("Check in")').click();
    await page.waitForTimeout(1000);

    console.log('[Clip 3] Selecting patient in dropdown...');
    const select = page.locator('#ci-patient');
    const options = await select.locator('option').allTextContents();
    const targetOption = options.find(t => t.includes('Maloni Golu')) || options.find(t => t.includes('TEST PATIENT'));
    if (targetOption) {
      await select.selectOption({ label: targetOption });
    }
    await page.waitForTimeout(600);

    await page.locator('#ci-reason').fill('Fever, dry cough and body chills for three days');
    await page.waitForTimeout(500);

    await page.locator('#ci-priority').selectOption('Standard');
    await page.waitForTimeout(500);

    console.log('[Clip 3] Adding to queue...');
    await page.locator('button:has-text("Add to the queue")').click();
    await page.waitForTimeout(1500);

    console.log('[Clip 3] Navigating to Outpatient queue...');
    await page.locator('#nav-btn-queue').click();
    await page.waitForTimeout(1500);

    const row = page.locator('li:has-text("Maloni Golu"), li:has-text("TEST PATIENT")').first();
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    console.log('[Clip 3] Opening vitals / notes modal...');
    const vitalsBtn = row.locator('button:has-text("Record vitals"), button:has-text("Open notes")').first();
    await vitalsBtn.click();
    await page.waitForTimeout(1000);

    console.log('[Clip 3] Recording clinical observations...');
    const bpInput = page.locator('#obs-bp');
    if (await bpInput.isVisible().catch(() => false)) await bpInput.fill('120/80');
    await page.waitForTimeout(300);

    const pulseInput = page.locator('#obs-pulse');
    if (await pulseInput.isVisible().catch(() => false)) await pulseInput.fill('78');
    await page.waitForTimeout(300);

    const spo2Input = page.locator('#obs-spo2');
    if (await spo2Input.isVisible().catch(() => false)) await spo2Input.fill('98');
    await page.waitForTimeout(300);

    const tempInput = page.locator('#obs-temp');
    if (await tempInput.isVisible().catch(() => false)) await tempInput.fill('38.4');
    await page.waitForTimeout(300);

    const respInput = page.locator('#obs-resp');
    if (await respInput.isVisible().catch(() => false)) await respInput.fill('18');
    await page.waitForTimeout(300);

    const weightInput = page.locator('#obs-weight');
    if (await weightInput.isVisible().catch(() => false)) await weightInput.fill('68');
    await page.waitForTimeout(600);

    // Click preset diagnosis
    const diagPreset = page.locator('button:has-text("Upper respiratory infection")').first();
    if (await diagPreset.isVisible().catch(() => false)) {
      await diagPreset.click();
      await page.waitForTimeout(500);
    }

    // Save vitals
    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();
    await page.waitForTimeout(1500);

    // Advance to Triage
    console.log('[Clip 3] Moving visit to Triage...');
    const sendBtn1 = row.locator('button:has-text("Send to triage and vitals"), button:has-text("Send to")').first();
    if (await sendBtn1.isVisible().catch(() => false)) {
      await sendBtn1.click();
      await page.waitForTimeout(1500);
    }

    // Advance to Consultation
    console.log('[Clip 3] Moving visit to Consultation...');
    const sendBtn2 = row.locator('button:has-text("Send to with the doctor"), button:has-text("Send to")').first();
    if (await sendBtn2.isVisible().catch(() => false)) {
      await sendBtn2.click();
      await page.waitForTimeout(1500);
    }

    // Advance to Pharmacy
    console.log('[Clip 3] Moving visit to Pharmacy...');
    const sendBtn3 = row.locator('button:has-text("Send to at pharmacy"), button:has-text("Send to")').first();
    if (await sendBtn3.isVisible().catch(() => false)) {
      await sendBtn3.click();
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(1200);
  } finally {
    await finalizeRecording(context, page, clipDir);
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// CLIP 4: Dispense with Allergy Check
// ---------------------------------------------------------------------------
async function runClip4(clipDir) {
  const { browser, context, page } = await createRecordedPage(clipDir);
  try {
    console.log('[Clip 4] Signing in as pharmacist...');
    await signIn(page, 'pharmacist', 'Lloyds#Pharm2026');

    console.log('[Clip 4] Opening Dispensing counter...');
    await page.locator('#nav-btn-dispense').click();
    await page.waitForTimeout(1200);

    console.log('[Clip 4] Finding patient...');
    const patientSearch = page.locator('#patient-search');
    await patientSearch.fill('Maloni');
    await page.waitForTimeout(700);

    const patientChoice = page.locator('button:has-text("Maloni Golu"), button:has-text("TEST PATIENT")').first();
    await patientChoice.click();
    await page.waitForTimeout(1000);

    console.log('[Clip 4] Searching for Amoxicillin...');
    const drugSearch = page.locator('#drug-search');
    await drugSearch.fill('Amoxicillin');
    await page.waitForTimeout(700);

    const drugChoice = page.locator('button:has-text("Amoxicillin")').first();
    await drugChoice.click();
    await page.waitForTimeout(500);

    await page.locator('#qty').fill('1');
    await page.waitForTimeout(400);

    console.log('[Clip 4] Adding to cart...');
    await page.locator('button:has-text("Add")').click();
    await page.waitForTimeout(1500);

    console.log('[Clip 4] Showing allergy warning...');
    await page.waitForSelector('text=Check this against the allergy record', { timeout: 5000 });
    await page.waitForTimeout(2500);

    console.log('[Clip 4] Acknowledging allergy warning...');
    const ackCheckbox = page.locator('input[type="checkbox"]');
    await ackCheckbox.check();
    await page.waitForTimeout(1200);

    console.log('[Clip 4] Recording and printing receipt...');
    await page.locator('button:has-text("Record and print receipt")').click();
    await page.waitForTimeout(2000);

    console.log('[Clip 4] Showing Official Medical Receipt...');
    await page.waitForSelector('text=Official Medical Receipt', { timeout: 5000 });
    await page.waitForTimeout(4000);

    await page.waitForTimeout(1000);
  } finally {
    await finalizeRecording(context, page, clipDir);
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// CLIP 5: Patient Record and Text Size
// ---------------------------------------------------------------------------
async function runClip5(clipDir) {
  const { browser, context, page } = await createRecordedPage(clipDir);
  try {
    console.log('[Clip 5] Signing in...');
    await signIn(page, 'admin', 'Lloyds#Admin2026');

    console.log('[Clip 5] Opening Patient register...');
    await page.locator('#nav-btn-patients').click();
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[placeholder*="Search the patient register"], input[placeholder*="Name, hospital number"]').first();
    await searchInput.fill('Maloni');
    await page.waitForTimeout(700);

    console.log('[Clip 5] Opening patient full record...');
    const recordBtn = page.locator('button[aria-label*="Open the record for"]').first();
    await recordBtn.click();
    await page.waitForTimeout(1500);

    console.log('[Clip 5] Inspecting record sections...');
    await page.waitForSelector('text=Allergy on record', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Scroll down inside record dialog to show visits, medicines, history
    await page.evaluate(() => {
      const scrollable = document.querySelector('div[role="dialog"] .overflow-y-auto') || window;
      scrollable.scrollBy({ top: 400, behavior: 'smooth' });
    });
    await page.waitForTimeout(2500);

    await page.evaluate(() => {
      const scrollable = document.querySelector('div[role="dialog"] .overflow-y-auto') || window;
      scrollable.scrollBy({ top: 450, behavior: 'smooth' });
    });
    await page.waitForTimeout(2500);

    // Scroll back to top
    await page.evaluate(() => {
      const scrollable = document.querySelector('div[role="dialog"] .overflow-y-auto') || window;
      scrollable.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(1200);

    console.log('[Clip 5] Returning to register via Escape...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    console.log('[Clip 5] Opening screen menu in top bar...');
    const screenMenuBtn = page.locator('button[title="Screen: day or night, text size, full screen"]');
    await screenMenuBtn.click();
    await page.waitForTimeout(1000);

    console.log('[Clip 5] Switching text size to Large...');
    await page.getByRole('radio', { name: 'Large', exact: true }).click();
    await page.waitForTimeout(2500);

    console.log('[Clip 5] Switching text size to Normal...');
    await page.getByRole('radio', { name: 'Normal', exact: true }).click();
    await page.waitForTimeout(2500);

    await screenMenuBtn.click();
    await page.waitForTimeout(800);
  } finally {
    await finalizeRecording(context, page, clipDir);
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// CLIP 6: Protected Export and Google Sheets Backup
// ---------------------------------------------------------------------------
async function runClip6(clipDir) {
  const { browser, context, page } = await createRecordedPage(clipDir);
  try {
    console.log('[Clip 6] Signing in...');
    await signIn(page, 'admin', 'Lloyds#Admin2026');

    console.log('[Clip 6] Navigating to Protected export...');
    await page.locator('#nav-btn-export').click();
    await page.waitForTimeout(1200);

    console.log('[Clip 6] Entering facility export password...');
    const exportPass = page.locator('#export-password');
    await exportPass.fill('LloydsPNG#Export2026');
    await page.waitForTimeout(500);

    console.log('[Clip 6] Downloading records workbook...');
    await page.locator('button:has-text("Download the workbook")').click();
    await page.waitForTimeout(2500);

    await exportPass.fill('LloydsPNG#Export2026');
    await page.waitForTimeout(500);

    console.log('[Clip 6] Downloading encrypted backup...');
    await page.locator('button:has-text("Download an encrypted backup")').click();
    await page.waitForTimeout(3000);

    console.log('[Clip 6] Opening Google Sheets backup...');
    await page.locator('#nav-btn-cloud-sync').click();
    await page.waitForTimeout(1500);

    console.log('[Clip 6] Scrolling to Company Google account & auto-sending controls...');
    await page.evaluate(() => {
      window.scrollBy({ top: 380, behavior: 'smooth' });
    });
    await page.waitForTimeout(2800);

    await page.evaluate(() => {
      window.scrollBy({ top: 400, behavior: 'smooth' });
    });
    await page.waitForTimeout(3200);

    await page.waitForTimeout(1000);
  } finally {
    await finalizeRecording(context, page, clipDir);
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Subtitle and Audio Builder
// ---------------------------------------------------------------------------
function formatSrtTime(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const ms = Math.floor((totalSec % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function wrapSubtitleText(text, maxChars = 42) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';

  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) {
    // Merge into 2 lines if possible
    const mid = Math.ceil(lines.length / 2);
    return [lines.slice(0, mid).join(' '), lines.slice(mid).join(' ')].join('\n');
  }
  return lines.join('\n');
}

function buildClipAudioAndVideo(clipId) {
  const clip = CLIPS[clipId];
  const clipDir = path.join(DEMO_VIDEOS_DIR, clip.name);
  const sentences = NARRATIONS[clipId];

  console.log(`\n----------------------------------------`);
  console.log(`Processing media for Clip ${clipId}: ${clip.name}`);
  console.log(`----------------------------------------`);

  // 1. Write narration.txt
  const narrationTxtPath = path.join(clipDir, 'narration.txt');
  fs.writeFileSync(narrationTxtPath, sentences.join('\n\n') + '\n', 'utf8');

  // 2. Generate speech narration.aiff with say
  const narrationAiffPath = path.join(clipDir, 'narration.aiff');
  execSync(`say -v Samantha -r 175 -f "${narrationTxtPath}" -o "${narrationAiffPath}"`);

  // 3. Measure narration duration with ffprobe
  const narrationDurStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${narrationAiffPath}"`
  ).toString().trim();
  const narrationDur = parseFloat(narrationDurStr);
  console.log(`Narration audio duration: ${narrationDur.toFixed(2)}s`);

  // 4. Measure raw video duration
  const rawWebmPath = path.join(clipDir, 'raw.webm');
  if (!fs.existsSync(rawWebmPath)) {
    throw new Error(`Raw video not found: ${rawWebmPath}. Run recording first.`);
  }
  const rawDurStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${rawWebmPath}"`
  ).toString().trim();
  const rawDur = parseFloat(rawDurStr);
  console.log(`Raw video duration: ${rawDur.toFixed(2)}s`);

  // 5. Generate subtitles.srt
  // Distribute cues proportionally to sentence length
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
  const srtCues = [];
  let currentStart = 0.0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const sentenceShare = s.length / totalChars;
    const sentenceDur = narrationDur * sentenceShare;
    const currentEnd = (i === sentences.length - 1) ? narrationDur : currentStart + sentenceDur;

    const wrappedText = wrapSubtitleText(s, 42);
    srtCues.push(`${i + 1}\n${formatSrtTime(currentStart)} --> ${formatSrtTime(currentEnd)}\n${wrappedText}\n`);
    currentStart = currentEnd;
  }

  const subtitlesSrtPath = path.join(clipDir, 'subtitles.srt');
  fs.writeFileSync(subtitlesSrtPath, srtCues.join('\n'), 'utf8');
  console.log(`Generated subtitles: ${subtitlesSrtPath}`);

  // 6. Compute speedup factor clamped between 1.3 and 3.0
  let factor = rawDur / narrationDur;
  let padDuration = 0.0;

  if (factor < 1.0) {
    factor = 1.0;
    padDuration = narrationDur - rawDur;
  } else if (factor < 1.3) {
    // If between 1.0 and 1.3, set factor to 1.3 and pad video
    factor = 1.3;
    const newVideoDur = rawDur / factor;
    if (newVideoDur < narrationDur) {
      padDuration = narrationDur - newVideoDur;
    }
  } else if (factor > 3.0) {
    factor = 3.0;
  }
  console.log(`Speedup factor: ${factor.toFixed(3)}x, Pad duration: ${padDuration.toFixed(2)}s`);

  // 7. Video filter graph
  let filterGraph = `[0:v]setpts=PTS/${factor.toFixed(4)}`;
  if (padDuration > 0.05) {
    filterGraph += `,tpad=stop_mode=clone:stop_duration=${padDuration.toFixed(3)}`;
  }
  // Subtitle filter
  filterGraph += `,subtitles='${subtitlesSrtPath}':force_style='FontName=Helvetica,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,Outline=1,MarginV=36'[v]`;

  const finalMp4Path = path.join(clipDir, 'final.mp4');
  if (fs.existsSync(finalMp4Path)) fs.unlinkSync(finalMp4Path);

  const ffmpegCmd = `"${FFMPEG_BIN}" -y -i "${rawWebmPath}" -i "${narrationAiffPath}" -filter_complex "${filterGraph}" -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${finalMp4Path}"`;
  execSync(ffmpegCmd);
  console.log(`Produced final video: ${finalMp4Path}`);

  // 8. Generate poster.png from frame at 2 seconds
  const posterPath = path.join(clipDir, 'poster.png');
  const posterCmd = `"${FFMPEG_BIN}" -y -ss 00:00:02.000 -i "${finalMp4Path}" -vframes 1 -q:v 2 "${posterPath}"`;
  execSync(posterCmd);
  console.log(`Generated poster image: ${posterPath}`);

  // 9. Write build.sh in the clip directory
  const buildShPath = path.join(clipDir, 'build.sh');
  const buildScript = `#!/usr/bin/env bash
set -euo pipefail

# Rebuild final.mp4 from raw.webm, narration.aiff and subtitles.srt
FFMPEG="${FFMPEG_BIN}"
if [ ! -f "$FFMPEG" ]; then
  FFMPEG=$(which ffmpeg)
fi

echo "Rebuilding final.mp4 using $FFMPEG..."
$FFMPEG -y -i raw.webm -i narration.aiff -filter_complex "${filterGraph}" -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart final.mp4
$FFMPEG -y -ss 00:00:02.000 -i final.mp4 -vframes 1 -q:v 2 poster.png
echo "Build complete."
`;
  fs.writeFileSync(buildShPath, buildScript, { mode: 0o755 });
  console.log(`Wrote build script: ${buildShPath}`);
}

// ---------------------------------------------------------------------------
// README Generator
// ---------------------------------------------------------------------------
function generateReadme() {
  const readmePath = path.join(DEMO_VIDEOS_DIR, 'README.md');
  const rows = [];

  for (let i = 1; i <= 6; i++) {
    const clip = CLIPS[i];
    const clipDir = path.join(DEMO_VIDEOS_DIR, clip.name);
    const finalMp4 = path.join(clipDir, 'final.mp4');

    let durationStr = 'N/A';
    let sizeStr = 'N/A';

    if (fs.existsSync(finalMp4)) {
      const stats = fs.statSync(finalMp4);
      sizeStr = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
      try {
        const dur = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalMp4}"`
        ).toString().trim();
        durationStr = `${parseFloat(dur).toFixed(1)}s`;
      } catch (err) {
        // ignore
      }
    }

    const narration = NARRATIONS[i].join(' ');
    rows.push(`| **${clip.name}** | \`${durationStr}\` | \`${sizeStr}\` | ${clip.desc} | ${narration} |`);
  }

  const content = `# Lloyds Medical OS — Demo Video Suite

Official screen-recorded walkthrough clips of the Lloyds Medical OS clinic management system running against the local server. Each clip features high-speed screen interaction, spoken narration (macOS Samantha voice, 175 wpm), and burned-in accessible subtitles.

## Clips Catalog

| Clip | Duration | File Size | What is Shown | Narration Text |
| :--- | :--- | :--- | :--- | :--- |
${rows.join('\n')}

## Directory Structure

Each clip folder under \`demo-videos/\` contains:
- \`raw.webm\` — High-resolution Playwright screen capture (1440×900 viewport).
- \`narration.txt\` — Narration script in second person, present tense.
- \`narration.aiff\` — Generated speech audio.
- \`subtitles.srt\` — Accurate time-coded subtitles with line-length constraints.
- \`final.mp4\` — Production MP4 with sped-up video, synchronized audio, and burned-in subtitles.
- \`poster.png\` — Video poster thumbnail captured at the 2-second mark.
- \`build.sh\` — Standalone script to re-encode \`final.mp4\` with alternative voiceovers.

## How to Re-Record Everything

To re-record and re-encode all clips in sequence:

\`\`\`bash
# Ensure clinic server is active
curl -s http://localhost:4000/api/health

# Run full demo recording and processing suite
node demo/record.js all
\`\`\`

To re-record or re-build an individual clip:

\`\`\`bash
node demo/record.js 1   # Re-records and encodes clip 1
\`\`\`
`;

  fs.writeFileSync(readmePath, content, 'utf8');
  console.log(`Generated README at: ${readmePath}`);
}

// ---------------------------------------------------------------------------
// CLI Runner
// ---------------------------------------------------------------------------
async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node demo/record.js <clip-number | all | process>');
    console.log('Available clips:');
    for (const [id, c] of Object.entries(CLIPS)) {
      console.log(`  ${id}: ${c.name} — ${c.desc}`);
    }
    process.exit(1);
  }

  if (arg.toLowerCase() === 'process') {
    // Re-process all audio/video without re-recording
    for (let i = 1; i <= 6; i++) {
      buildClipAudioAndVideo(i);
    }
    generateReadme();
    return;
  }

  const clipsToRun = arg.toLowerCase() === 'all'
    ? Object.keys(CLIPS).map(Number)
    : [parseInt(arg, 10)];

  for (const id of clipsToRun) {
    const clip = CLIPS[id];
    if (!clip) {
      console.error(`Unknown clip: ${id}`);
      process.exit(1);
    }
    const clipDir = path.join(DEMO_VIDEOS_DIR, clip.name);
    console.log(`\n========================================`);
    console.log(`Recording Clip ${id}: ${clip.name}`);
    console.log(`========================================`);
    await clip.run(clipDir);

    // Build audio, subtitles, and final mp4
    buildClipAudioAndVideo(id);
  }

  generateReadme();
  console.log('\nAll operations completed successfully.');
}

main().catch((err) => {
  console.error('Recording error:', err);
  process.exit(1);
});
