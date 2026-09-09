# Product

<!-- impeccable:product-schema 1 -->

Written 2026-09-09 from the repository, the seeded database defaults, the staff
operating guide and the working sessions with Kritin. Facts marked *(inferred)*
came from the code and documents rather than a confirmed answer; correct them
here rather than in the design work.

## Platform

web

## Users

- **Clinic staff at a small occupational health centre and community hospital
  run by Lloyds Metals & Energy in Papua New Guinea** (Lae, Morobe Province
  by default; the facility name and location are settings). Four roles sign
  in with their own password: Administrator, Doctor (Chief Medical Officer),
  Senior Triage Nurse, Registered Pharmacist. The same laptop is often shared
  across a shift and handed over by signing in as the next person.
- **Where they are:** an outpatient counter under tropical daylight, a
  pharmacy counter, a ward at night, sometimes a phone or tablet on the
  clinic Wi-Fi. Kritin's brief for the staff: "they are village people" —
  every function must be one obvious action, never a console or a script.
- **Head office** receives encrypted off-site copies; it never uses the
  clinical screens.
- The **waiting room screen** (`/waiting-room`) is read by patients on a
  television: ticket numbers only, no names, no sign-in.

## Product Purpose

Lloyds Medical OS runs an entire clinic from one laptop with no internet: patient
register, outpatient queue with triage and vitals, consultation and clinical
registers, pharmacy formulary and dispensing counter, ward bed board,
occupational-health incidents, shift close (cash reconciliation) and handover,
protected Excel export and off-site copies. The clinical board (Dashboard) is
the screen left open all shift: what needs attention now, who is in the
department, what was recorded today, and the state of stock, cash and copies.

Success is a clinic that keeps working with the power flickering and no
connection for weeks, whose records say who did what, and whose data leaves the
building only encrypted.

## Positioning

Offline-first by construction, not as a degraded mode: SQLite on the local
machine, the app served over the clinic's own Wi-Fi, fonts and assets bundled,
a service worker for tablets. Every figure on screen is read from the local
database; a value the record does not hold prints as a dash, never a plausible
number. Accountability is built in: staff attribution on every action, a
tamper-evident audit trail, server-side allergy refusal at dispensing, and
encrypted copies to USB stick, phone (WhatsApp) or head office with a wrapped
key that travels with them.

## Operating Context

- **Daily flow:** check-in → triage and vitals → consultation → pharmacy and
  point of sale (PNG Kina) → shift close and handover. Ward admissions and
  discharges run beside it. Registers cover referrals, return visits, notifiable
  diseases, fitness for work and the monthly return.
- **Devices:** a ten-year-old laptop is the reference machine; tablets and
  phones join over Wi-Fi with no internet. Text size and day/night theme are
  chosen per device.
- **Light:** day theme for the counter under a bright window; night theme for
  the ward after dark, where a white screen wrecks dark adaptation.
- **Documents:** A4 registers, patient records, itemised receipts (80 mm
  thermal and A4), shift audit, encrypted Excel workbooks. Paper is always the
  day palette.
- **Copies:** nightly encrypted backup, automatic copy to any plugged-in USB
  stick, phone share, head office receiver (Cloudflare worker in
  `offsite/cloudflare-receiver/`, not yet deployed), in-app restore.
- **Sample data:** a fresh install ships training records; the board says so
  until an administrator clears them and goes live.

## Capabilities and Constraints

- React 18, Vite 5, Tailwind 3.4 client; Express and SQLite server; Lucide
  icons. Colour resolves through CSS custom properties so one class renders
  correctly in both themes.
- **No web-font CDN and no remote request of any kind at runtime.** Any font
  must be bundled in the build.
- **Colour means clinical or operational state.** Red, amber and green report
  triage, stock and cash conditions and must keep that meaning in any visual
  world. Identity colour is never placed on a clinical figure.
- Every text pair clears 4.5:1 in both themes; touch targets grow on coarse
  pointers; the whole interface scales with the text-size setting.
- Nothing on screen may be fabricated: no simulated telemetry, no
  environmental readings, no placeholder patients outside the marked sample
  data.
- Terminology: "clinical board" (dashboard), "outpatient queue", "dispensing
  counter", "shift close", "handover", "off-site copies", "protected export",
  Tok Pisin glosses on the queue stages (Wetim, Wantaim dokta, Kisim marasin).
- Sign-in is required for every API read; sessions expire on idle and after a
  restore.

## Brand Commitments

- The product is **Lloyds Medical OS**, for Lloyds Metals & Energy Ltd. The
  official Lloyds Metals mark (black gear badge, red block, "LLOYDS METALS")
  is `client/public/lloyds_metals_logo.png` and stays as the company mark.
- **Kritin's binding visual constraint (2026-09-09): the clinical board and the
  application shell are to be redesigned entirely in a bold blue world**,
  replacing the red-branded interface. All design choices are delegated to
  Claude. Red, amber and green keep their clinical meaning inside that world.
- Voice: plain, direct, written for staff who did not grow up with software.
  Sentences say what happened and what to do; no jargon, no hype.

## Evidence on Hand

- Real seeded facility defaults and role list in `server/db.js`; staff guide
  `README_HOSPITAL_STAFF.md`; product overview `README.md`; executive manual in
  `docs/`.
- Screenshots of the incumbent interface at the repository root (`dash-*.png`,
  `mobile-*.png`, `opd-*.png`).
- No customer testimonials, benchmarks, pricing or deployment claims exist and
  none may be invented.

## Product Principles

1. **Offline is the normal case.** Nothing waits on a network; nothing degrades
   when there is none.
2. **A figure is either recorded or a dash.** Never guessed, never rounded into
   a claim.
3. **Colour is a signal, not decoration.** Red, amber, green are reserved for
   state; identity lives elsewhere.
4. **One obvious action.** A village clinic runs the whole system without a
   manual; every function is a button with a plain name.
5. **The record says who.** Attribution, audit and hand-over are part of every
   workflow, not an admin afterthought.

## Accessibility & Inclusion

Two themes for two light conditions; 4.5:1 text contrast floor in both; whole-
interface text scaling; finger-sized targets on touch devices; reduced-motion
respected; keyboard focus visible everywhere. Staff read English with Tok Pisin
as a first language for many, so copy stays short and concrete.
