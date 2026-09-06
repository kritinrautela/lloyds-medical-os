/*
 * Who is allowed to do what.
 *
 * This file is the only place roles are defined. The clinic runs on shared
 * machines: one computer at reception, one at the pharmacy counter, one in the
 * consulting room. Anyone can walk up to any of them, so the question the
 * software has to answer all day is not "is this a member of staff" but "is it
 * this member of staff, and is this their job".
 *
 * A matching copy lives at client/src/lib/permissions.js. The client copy
 * decides what to draw. This one decides what is allowed. They are kept the
 * same for the sake of a coherent interface, but only this one is enforcement:
 * a request that reaches the server without the right capability is refused
 * whatever the screen happened to be showing.
 */

const ROLES = [
  'Administrator',
  'Chief Medical Officer',
  'Doctor',
  'Senior Triage Nurse',
  'Triage Nurse',
  'Registered Pharmacist',
  'Pathology Technician',
  'HSE Safety Officer',
  'Reception'
];

// The navigation sections, in the order they appear down the side of the
// screen. `capability` is what a role needs to hold to be shown the section at
// all; being shown it is not the same as being allowed to act inside it.
const SECTIONS = [
  { id: 'dashboard', capability: 'view.dashboard', label: 'Clinical board' },
  { id: 'patients', capability: 'view.patients', label: 'Patient register' },
  { id: 'queue', capability: 'view.queue', label: 'Outpatient queue' },
  { id: 'registers', capability: 'view.registers', label: 'Clinical registers' },
  { id: 'pharmacy', capability: 'view.pharmacy', label: 'Pharmacy formulary' },
  { id: 'dispense', capability: 'view.dispense', label: 'Dispensing counter' },
  { id: 'staff', capability: 'view.staff', label: 'Staff and access' },
  { id: 'end-of-day', capability: 'view.endOfDay', label: 'Shift close' },
  { id: 'export', capability: 'view.export', label: 'Protected export' },
  { id: 'cloud-sync', capability: 'view.cloudSync', label: 'Google Sheets backup' },
  { id: 'settings', capability: 'view.settings', label: 'Facility settings' }
];

// Everything a person can be permitted to do, with wording aimed at the person
// who will read it in a refusal message rather than at a programmer.
const CAPABILITIES = {
  'view.dashboard': 'See the clinical board',
  'view.patients': 'Open the patient register',
  'view.queue': 'Open the outpatient queue',
  'view.registers': 'Open the clinical registers',
  'view.pharmacy': 'Open the pharmacy formulary',
  'view.dispense': 'Open the dispensing counter',
  'view.staff': 'Open staff and access',
  'view.endOfDay': 'Open the shift close',
  'view.export': 'Open the protected export',
  'view.cloudSync': 'Open the Google Sheets backup',
  'view.settings': 'Open the facility settings',

  'patients.register': 'Register a new patient',
  'patients.edit': 'Change a patient record',
  'patients.photo': 'Take or replace a patient photograph',

  'queue.checkIn': 'Check a patient in',
  'queue.triage': 'Record triage and observations',
  'queue.consult': 'Record a consultation and diagnosis',

  'beds.manage': 'Admit a patient to a bed or discharge them',
  'notes.write': 'Write a shift handover note',

  'pharmacy.addDrug': 'Add a medicine to the formulary',
  'pharmacy.adjustStock': 'Change the stock count of a medicine',
  'pharmacy.removeDrug': 'Remove a medicine from the formulary',

  'dispense.sell': 'Dispense medicines and take payment',
  'dispense.discount': 'Reduce a price or record an unpaid sale',

  'endOfDay.close': 'Close the shift and count the drawer',

  'export.download': 'Download the protected records workbook',

  'settings.edit': 'Change the facility details',
  'settings.exportPassword': 'Set the export password',
  'settings.clearRecords': 'Clear the records and go live',

  'staff.manage': 'Create, disable and reset staff accounts',
  'cloudSync.configure': 'Set up the Google Sheets backup'
};

const ALL_CAPABILITIES = Object.keys(CAPABILITIES);

// A registered nurse and a doctor do the same work at the queue; a pharmacist
// and a doctor do not. The grouping below follows what each person actually
// does in a district clinic, not a corporate hierarchy: seniority earns extra
// authority over money and stock, not extra clinical scope.
const CLINICAL_VIEW = ['view.dashboard', 'view.patients', 'view.queue', 'view.registers'];
const FRONT_DESK = ['patients.register', 'patients.edit', 'patients.photo', 'queue.checkIn'];

const ROLE_CAPABILITIES = {
  Administrator: ALL_CAPABILITIES,

  'Chief Medical Officer': [
    ...CLINICAL_VIEW,
    'view.pharmacy', 'view.dispense', 'view.endOfDay',
    ...FRONT_DESK,
    'queue.triage', 'queue.consult',
    'beds.manage', 'notes.write',
    'pharmacy.adjustStock',
    'dispense.sell', 'dispense.discount',
    'endOfDay.close'
  ],

  Doctor: [
    ...CLINICAL_VIEW,
    ...FRONT_DESK,
    'queue.triage', 'queue.consult',
    'beds.manage', 'notes.write',
    // A doctor may waive a fee for a patient who cannot pay. The reason and
    // their name are recorded against it either way.
    'dispense.discount'
  ],

  'Senior Triage Nurse': [
    ...CLINICAL_VIEW,
    ...FRONT_DESK,
    'queue.triage', 'queue.consult',
    'beds.manage', 'notes.write'
  ],

  'Triage Nurse': [
    'view.patients', 'view.queue', 'view.registers',
    ...FRONT_DESK,
    'queue.triage',
    'beds.manage', 'notes.write'
  ],

  'Registered Pharmacist': [
    'view.dashboard', 'view.patients', 'view.pharmacy', 'view.dispense', 'view.endOfDay',
    'pharmacy.addDrug', 'pharmacy.adjustStock',
    'dispense.sell',
    'endOfDay.close',
    'notes.write'
  ],

  'Pathology Technician': [
    'view.patients', 'view.queue', 'view.registers',
    'queue.triage',
    'notes.write'
  ],

  'HSE Safety Officer': [
    'view.dashboard', 'view.patients', 'view.registers'
  ],

  Reception: [
    'view.patients', 'view.queue',
    ...FRONT_DESK
  ]
};

// Where each role lands when they sign in. A pharmacist who has to click past
// a board of ward statistics to reach the counter will stop reading the board.
const ROLE_LANDING = {
  Administrator: 'dashboard',
  'Chief Medical Officer': 'dashboard',
  Doctor: 'queue',
  'Senior Triage Nurse': 'queue',
  'Triage Nurse': 'queue',
  'Registered Pharmacist': 'dispense',
  'Pathology Technician': 'queue',
  'HSE Safety Officer': 'dashboard',
  Reception: 'patients'
};

function capabilitiesFor(role) {
  return ROLE_CAPABILITIES[role] || [];
}

function roleCan(role, capability) {
  return capabilitiesFor(role).includes(capability);
}

/** True when the signed-in user holds the capability. A missing user holds none. */
function can(user, capability) {
  if (!user || user.status !== 'Active') return false;
  return roleCan(user.role, capability);
}

function sectionsFor(role) {
  return SECTIONS.filter((section) => roleCan(role, section.capability));
}

/** The first screen this role should see, falling back to whatever they can open. */
function landingFor(role) {
  const preferred = ROLE_LANDING[role];
  const allowed = sectionsFor(role);
  if (preferred && allowed.some((s) => s.id === preferred)) return preferred;
  return allowed.length ? allowed[0].id : null;
}

/** Wording for a refusal, so the message names the job rather than a code. */
function describe(capability) {
  return CAPABILITIES[capability] || capability;
}

module.exports = {
  ROLES,
  SECTIONS,
  CAPABILITIES,
  ALL_CAPABILITIES,
  ROLE_CAPABILITIES,
  ROLE_LANDING,
  capabilitiesFor,
  roleCan,
  can,
  sectionsFor,
  landingFor,
  describe
};
