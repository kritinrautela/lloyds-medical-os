/*
 * Public health rules shared by the consultation, the registers and the
 * monthly return.
 *
 * NOTIFIABLE lists the conditions a clinic in Papua New Guinea is expected to
 * report to the provincial health office. The names and match words are a
 * working list for this clinic, not a legal text: the provincial office
 * confirms what must be reported and how quickly. A diagnosis is flagged only
 * when the clinician's own words match one of the terms below; nothing is ever
 * added to a record by inference.
 *
 * A copy of the same list lives in client/src/lib/publicHealth.js so the
 * consultation screen can warn before the record is saved. Keep them the same.
 */

const NOTIFIABLE = [
  { condition: 'Acute flaccid paralysis (suspected polio)', match: ['flaccid paralysis', 'afp', 'polio'] },
  { condition: 'Measles', match: ['measles'] },
  { condition: 'Cholera', match: ['cholera'] },
  { condition: 'Acute watery diarrhoea', match: ['acute watery diarrhoea', 'acute watery diarrhea', 'awd'] },
  { condition: 'Dengue', match: ['dengue'] },
  { condition: 'Malaria, confirmed', match: ['falciparum', 'vivax', 'plasmodium', 'b50', 'b51', 'b52', 'b53', 'malaria'] },
  { condition: 'Tuberculosis', match: ['tuberculosis', 'ptb', 'a15', 'a16', ' tb', 'tb '] },
  { condition: 'Leprosy', match: ['leprosy', 'hansen'] },
  { condition: 'Meningitis', match: ['meningitis', 'meningococc'] },
  { condition: 'Neonatal tetanus', match: ['neonatal tetanus'] },
  { condition: 'Tetanus', match: ['tetanus'] },
  { condition: 'Pertussis (whooping cough)', match: ['pertussis', 'whooping'] },
  { condition: 'Typhoid fever', match: ['typhoid', 'enteric fever'] },
  { condition: 'Severe acute respiratory infection', match: ['sari', 'severe acute respiratory'] },
  { condition: 'Influenza-like illness', match: ['influenza', 'ili '] },
  { condition: 'COVID-19', match: ['covid', 'sars-cov'] },
  { condition: 'Yaws', match: ['yaws'] },
  { condition: 'Rabies exposure or animal bite', match: ['rabies', 'dog bite', 'animal bite'] },
  { condition: 'Snakebite envenoming', match: ['snakebite', 'snake bite', 'envenom', 't63'] },
  { condition: 'Acute jaundice syndrome', match: ['acute jaundice', 'hepatitis a', 'hepatitis e'] },
  { condition: 'HIV, newly diagnosed', match: ['hiv positive', 'new hiv', 'hiv diagnos'] },
  { condition: 'Sexually transmitted infection', match: ['syphilis', 'gonorrh', 'chlamydia'] },
  { condition: 'Maternal death', match: ['maternal death'] }
];

// Age bands used on the monthly return. They follow the bands most health
// information returns in the country ask for.
const AGE_BANDS = [
  { label: 'Under 1', min: 0, max: 0 },
  { label: '1 to 4', min: 1, max: 4 },
  { label: '5 to 14', min: 5, max: 14 },
  { label: '15 to 49', min: 15, max: 49 },
  { label: '50 and over', min: 50, max: 1000 }
];

const RDT_RESULTS = [
  'Not done',
  'Negative',
  'Positive, P. falciparum',
  'Positive, P. vivax',
  'Positive, mixed',
  'Invalid, repeat'
];

const FITNESS_STATUSES = [
  'Not assessed',
  'Fit for full duty',
  'Fit with restrictions',
  'Unfit for work'
];

function normalise(text) {
  return ` ${String(text || '').toLowerCase().replace(/[^a-z0-9.\-]+/g, ' ')} `;
}

/** The notifiable condition a diagnosis matches, or null when it matches none. */
function notifiableFor(diagnosis) {
  const text = normalise(diagnosis);
  if (text.trim() === '') return null;
  for (const entry of NOTIFIABLE) {
    if (entry.match.some((term) => text.includes(term.toLowerCase()))) return entry.condition;
  }
  return null;
}

function ageBandOf(age) {
  const n = Number(age);
  if (!Number.isFinite(n) || n < 0) return 'Not recorded';
  const band = AGE_BANDS.find((b) => n >= b.min && n <= b.max);
  return band ? band.label : 'Not recorded';
}

module.exports = { NOTIFIABLE, AGE_BANDS, RDT_RESULTS, FITNESS_STATUSES, notifiableFor, ageBandOf };
