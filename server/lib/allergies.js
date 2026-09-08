/*
 * The allergy check the server runs before a hand-over is recorded.
 *
 * The counter screen runs the same check as the pharmacist builds the list,
 * so the warning appears before anything is typed. This copy is the one that
 * counts: a request that bypasses the screen, or a screen that has fallen
 * behind this list, still cannot record a medicine against a written allergy
 * without saying that the warning was seen.
 *
 * Each entry lists what a member of staff writes on the left and the name
 * stems of the medicines it covers on the right. The list is deliberately
 * short and readable; it is a safety net under a human check, not a formulary.
 */
const ALLERGY_CLASSES = [
  { written: ['penicillin', 'penicillins', 'pcn'],
    covers: ['penicillin', 'cillin', 'amoxicillin', 'amoxycillin', 'ampicillin', 'flucloxacillin',
             'cloxacillin', 'augmentin', 'amoxiclav', 'co-amoxiclav', 'piperacillin', 'tazocin'] },
  { written: ['sulfa', 'sulpha', 'sulfonamide', 'sulphonamide', 'cotrimoxazole', 'co-trimoxazole', 'bactrim', 'septrin'],
    covers: ['sulfa', 'sulpha', 'sulfamethoxazole', 'sulphamethoxazole', 'cotrimoxazole', 'co-trimoxazole',
             'trimethoprim', 'bactrim', 'septrin', 'sulfadoxine', 'fansidar'] },
  { written: ['nsaid', 'nsaids', 'aspirin', 'ibuprofen', 'anti-inflammatory'],
    covers: ['ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'indomethacin', 'ketorolac', 'meloxicam', 'nsaid'] },
  { written: ['cephalosporin', 'cephalosporins'],
    covers: ['cef', 'ceph'] },
  { written: ['tetracycline', 'tetracyclines'],
    covers: ['tetracycline', 'doxycycline', 'minocycline'] },
  { written: ['quinolone', 'fluoroquinolone', 'ciprofloxacin'],
    covers: ['floxacin'] },
  { written: ['macrolide', 'erythromycin'],
    covers: ['erythromycin', 'azithromycin', 'clarithromycin'] }
];

// "None", "nil", "NKDA" and the like record that the question was asked and
// there is nothing to warn about.
const NO_ALLERGY = /^(none|nil|nkda|nka|no known( drug)? allerg(y|ies)|no|nothing known|not known|unknown|n\/a|-)\.?$/i;

const norm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ').trim();

function hasAllergy(value) {
  return !!value && !NO_ALLERGY.test(String(value).trim());
}

/*
 * The parts of the allergy text that this medicine matches, by name or by
 * class. An empty list means no match was found, which is not the same as the
 * medicine being safe: the allergy field may be incomplete.
 */
function allergyConflicts(allergies, drugName) {
  if (!hasAllergy(allergies) || !drugName) return [];
  const drug = norm(drugName);
  const parts = String(allergies)
    .split(/[,;/]+|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const hits = [];
  for (const part of parts) {
    const written = norm(part);
    if (!written) continue;
    if (written.length >= 4 && drug.includes(written)) { hits.push(part); continue; }
    const cls = ALLERGY_CLASSES.find((c) => c.written.some((w) => written.includes(w)));
    if (cls && cls.covers.some((stem) => drug.includes(stem))) hits.push(part);
  }
  return hits;
}

module.exports = { ALLERGY_CLASSES, hasAllergy, allergyConflicts };
