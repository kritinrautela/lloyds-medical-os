/*
 * Copy of server/lib/publicHealth.js for the browser. The server's list is the
 * one that decides what is written to a record; this copy only lets the
 * consultation screen say, before saving, that a diagnosis will be flagged.
 */

export const NOTIFIABLE = [
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

export const RDT_RESULTS = [
  'Not done',
  'Negative',
  'Positive, P. falciparum',
  'Positive, P. vivax',
  'Positive, mixed',
  'Invalid, repeat'
];

export const FITNESS_STATUSES = [
  'Not assessed',
  'Fit for full duty',
  'Fit with restrictions',
  'Unfit for work'
];

export const REFERRAL_DESTINATIONS = [
  'Angau Memorial Provincial Hospital, Lae',
  'Port Moresby General Hospital',
  'Lae district health centre',
  'Private specialist, Lae',
  'Other facility'
];

export const REFERRAL_URGENCY = ['Routine', 'Urgent', 'Emergency'];
export const REFERRAL_TRANSPORT = ['Company vehicle', 'Ambulance', 'Own transport', 'Public motor vehicle', 'Air'];
export const REFERRAL_OUTCOMES = ['Awaiting outcome', 'Seen and returned', 'Admitted', 'Did not attend', 'Transferred elsewhere', 'Died'];

function normalise(text) {
  return ` ${String(text || '').toLowerCase().replace(/[^a-z0-9.\-]+/g, ' ')} `;
}

export function notifiableFor(diagnosis) {
  const text = normalise(diagnosis);
  if (text.trim() === '') return null;
  for (const entry of NOTIFIABLE) {
    if (entry.match.some((term) => text.includes(term.toLowerCase()))) return entry.condition;
  }
  return null;
}
