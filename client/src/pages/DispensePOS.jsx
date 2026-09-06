import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ReceiptModal from '../components/ReceiptModal';
import { PatientAvatar } from '../components/PatientPhoto';
import { EmptyState, Panel, PanelHead, Pill, SectionTitle, Value, hasAllergy } from '../components/ui';

/*
 * The pharmacy counter.
 *
 * Two things drive this screen beyond the transaction itself.
 *
 * Safety: the patient's recorded allergies are matched against every drug put
 * in the basket, and a match is shown loudly before anything is dispensed. The
 * match is a plain substring test on the recorded text, so it is a prompt to
 * check, never a clearance — an empty allergy field means nothing was recorded,
 * not that the patient has no allergies.
 *
 * Accountability: every dispensation is recorded against the signed-in member
 * of staff, and a reduced price cannot be recorded without a stated reason.
 * These controls apply to everyone equally and are visible on screen so staff
 * can see exactly what is written down in their name.
 */

const PAYMENT_METHODS = [
  'Cash (Kina)',
  'Card / EFTPOS',
  'Government / Free Clinic Waiver',
  'Employer / Company Account'
];

const DISCOUNT_REASONS = [
  'Company employee entitlement',
  'Health department waiver',
  'Patient unable to pay — approved',
  'Price correction',
  'Other (write it in the notes)'
];

/*
 * A recorded allergy is usually written as a class ("penicillin", "sulfa"),
 * and the medicine on the shelf is a member of that class with a different
 * name ("Amoxicillin"). A plain word match lets that pair straight through,
 * which is the single most common way a drug allergy is repeated in a clinic.
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

const norm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ').trim();

/**
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

// Some medicines are entered with the strength already in the name
// ("Paracetamol 500mg") and some are not, so printing both fields side by side
// gives "Paracetamol 500mg 500mg". Show the strength only when the name does
// not already say it.
function extraStrength(name, strength) {
  if (!strength) return null;
  const said = String(name || '').toLowerCase().replace(/\s+/g, '');
  return said.includes(String(strength).toLowerCase().replace(/\s+/g, '')) ? null : strength;
}

/*
 * A batch past its expiry date is refused here, before the pharmacist has
 * typed a quantity, and again on the server, which is the check that counts.
 * A batch inside its last month is allowed but flagged, so the pharmacist can
 * choose it deliberately and see it on the shelf tomorrow.
 */
function expiryState(drug) {
  if (!drug?.expiry_date) return { expired: false, soon: false, label: '' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(drug.expiry_date); expiry.setHours(0, 0, 0, 0);
  if (Number.isNaN(expiry.getTime())) return { expired: false, soon: false, label: '' };
  const days = Math.round((expiry - today) / 86400000);
  const label = expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return { expired: days < 0, soon: days >= 0 && days <= 30, days, label };
}

export default function DispensePOS({ settings, preSelectedPatient, refreshStats }) {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [allergyChecked, setAllergyChecked] = useState(false);

  const [patient, setPatient] = useState(null);
  const [walkInName, setWalkInName] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [visitId, setVisitId] = useState(null);

  const [cart, setCart] = useState([]);
  const [drugQuery, setDrugQuery] = useState('');
  const [qty, setQty] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [pickedDrug, setPickedDrug] = useState(null);

  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState(null);

  const qtyRef = useRef(null);
  const currency = settings?.currency_symbol || 'K';

  useEffect(() => {
    (async () => {
      try {
        const [p, d] = await Promise.all([api.getPatients(), api.getDrugs()]);
        setPatients(p.patients || []);
        setDrugs(d.drugs || []);
      } catch (err) {
        setError(err.message || 'The formulary could not be loaded.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!preSelectedPatient) return;
    setPatient(preSelectedPatient);
    setWalkInName('');
    setVisitId(preSelectedPatient.visit_id || null);
  }, [preSelectedPatient]);

  // The full patient record carries the allergy field; a patient handed over
  // from the queue may only carry a name and an id.
  const patientRecord = useMemo(
    () => (patient?.id ? patients.find((p) => p.id === patient.id) || patient : patient),
    [patient, patients]
  );

  const patientMatches = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return patients
      .filter((p) =>
        [p.full_name, p.hospital_number, p.patient_code, p.phone]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [patients, patientQuery]);

  const drugMatches = useMemo(() => {
    const q = drugQuery.trim().toLowerCase();
    if (!q) return [];
    return drugs
      .filter((d) => `${d.name} ${d.generic_name || ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [drugs, drugQuery]);

  const subtotal = cart.reduce((acc, i) => acc + i.subtotal, 0);
  const discountValue = Math.min(Math.max(0, parseFloat(discount) || 0), subtotal);
  const total = Math.max(0, subtotal - discountValue);

  const conflicts = useMemo(() => {
    if (!patientRecord?.allergies) return [];
    return cart
      .map((item) => ({ item, words: allergyConflicts(patientRecord.allergies, item.name) }))
      .filter((c) => c.words.length > 0);
  }, [cart, patientRecord]);

  const conflictKey = conflicts.map((c) => c.item.drug_id).join(',');
  useEffect(() => { setAllergyChecked(false); }, [conflictKey]);

  const chooseDrug = (drug) => {
    setPickedDrug(drug);
    setDrugQuery(drug.name);
    setQty(1);
    window.requestAnimationFrame(() => qtyRef.current?.focus());
  };

  const addToCart = () => {
    setError('');
    if (!pickedDrug) { setError('Choose a medicine from the formulary first.'); return; }
    const shelf = expiryState(pickedDrug);
    if (shelf.expired) {
      setError(`${pickedDrug.name} (batch ${pickedDrug.batch_number || 'unrecorded'}) expired on ${shelf.label} and cannot be handed over. Remove it from the shelf and record the new batch in the formulary.`);
      return;
    }
    const amount = parseInt(qty, 10);
    if (!amount || amount < 1) { setError('Enter how many units are being handed over.'); return; }

    const existing = cart.find((c) => c.drug_id === pickedDrug.id);
    const already = existing ? existing.quantity : 0;
    if (already + amount > pickedDrug.stock_quantity) {
      setError(`Only ${pickedDrug.stock_quantity} units of ${pickedDrug.name} are in stock.`);
      return;
    }

    const next = existing
      ? cart.map((c) =>
          c.drug_id === pickedDrug.id
            ? {
                ...c,
                quantity: c.quantity + amount,
                subtotal: (c.quantity + amount) * c.unit_price,
                instructions: instructions.trim() || c.instructions
              }
            : c
        )
      : [
          ...cart,
          {
            drug_id: pickedDrug.id,
            name: pickedDrug.name,
            strength: pickedDrug.strength,
            dosage_form: pickedDrug.dosage_form,
            quantity: amount,
            unit_price: pickedDrug.unit_price,
            subtotal: amount * pickedDrug.unit_price,
            instructions: instructions.trim(),
            stock_quantity: pickedDrug.stock_quantity
          }
        ];

    setCart(next);
    setPickedDrug(null);
    setDrugQuery('');
    setQty(1);
    setInstructions('');
  };

  const complete = async () => {
    setError('');
    const name = patientRecord?.full_name || walkInName.trim();
    if (!name) { setError('Choose a registered patient, or write the name of the walk-in.'); return; }
    if (cart.length === 0) { setError('Nothing has been added to hand over yet.'); return; }
    if (discountValue > 0 && !discountReason) {
      setError('A reduced price needs a reason before it can be recorded.');
      return;
    }
    if (conflicts.length > 0 && !allergyChecked) {
      setError('A medicine on this list matches the allergy record. Confirm it has been checked before recording.');
      return;
    }

    // The override is written into the record itself, so the audit trail shows
    // that the warning was seen and by whom, not just that the sale went through.
    const allergyNote = conflicts.length > 0
      ? `Allergy warning acknowledged by ${currentUser?.full_name || 'staff'}: ${conflicts
          .map((c) => `${c.item.name} vs "${c.words.join(', ')}"`)
          .join('; ')}.`
      : '';
    const recordedNotes = [allergyNote, notes].filter(Boolean).join(' ');

    setSubmitting(true);
    try {
      const res = await api.dispenseMedications({
        patient_id: patientRecord?.id || null,
        patient_name: name,
        visit_id: visitId,
        items: cart.map((i) => ({
          drug_id: i.drug_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          instructions: i.instructions
        })),
        discount: discountValue,
        discount_reason: discountValue > 0 ? discountReason : '',
        discount_authorised_by: discountValue > 0 ? currentUser?.full_name || '' : '',
        paid_amount: total,
        payment_method: paymentMethod,
        pharmacist_notes: recordedNotes,
        dispensed_by_user_id: currentUser?.id || null,
        dispensed_by_name: currentUser?.full_name || null,
        dispensed_by_role: currentUser?.role || null
      });

      setReceipt({ invoice: res.invoice, items: res.items, hospital: res.hospital, patient: patientRecord });
      setCart([]);
      setDiscount('');
      setDiscountReason('');
      setNotes('');
      setPatient(null);
      setWalkInName('');
      setVisitId(null);

      const fresh = await api.getDrugs();
      setDrugs(fresh.drugs || []);
      refreshStats?.();
    } catch (err) {
      setError(err.message || 'The dispensation could not be recorded. Nothing was taken from stock.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-ink-3">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Opening the pharmacy counter
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle note="Stock is taken down and a receipt is produced when the hand-over is recorded">
        Pharmacy counter
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* 1 — who it is for */}
          <Panel>
            <PanelHead title="Who is this for" note="Step 1 of 3" />
            <div className="space-y-3 px-4 py-3">
              {patientRecord ? (
                <div className="flex items-start justify-between gap-3 rounded-md border border-line bg-subtle px-3 py-2.5">
                  <div className="flex gap-3">
                    <PatientAvatar patient={patientRecord} size={40} />
                    <div>
                      <p className="text-sm font-semibold text-ink">{patientRecord.full_name}</p>
                      <p className="mt-0.5 text-2xs text-ink-3">
                        <span className="font-mono"><Value>{patientRecord.hospital_number}</Value></span>
                        {' · '}<Value>{patientRecord.age}</Value>{patientRecord.age ? 'y' : ''}
                        {patientRecord.gender ? ` · ${patientRecord.gender}` : ''}
                      </p>
                      <p className="mt-1 text-xs">
                        {hasAllergy(patientRecord.allergies) ? (
                          <span className="font-semibold text-critical">Allergies: {patientRecord.allergies}</span>
                        ) : (
                          <span className="text-ink-3">No allergies recorded. Ask the patient before dispensing.</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {visitId ? <Pill tone="info">From today's queue</Pill> : null}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => { setPatient(null); setVisitId(null); }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label" htmlFor="patient-search">Find a registered patient</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                      <input
                        id="patient-search"
                        className="field pl-8"
                        value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                        placeholder="Name, hospital number or phone"
                        autoComplete="off"
                      />
                    </div>
                    {patientMatches.length > 0 ? (
                      <ul className="mt-1.5 divide-y divide-line-soft overflow-hidden rounded-md border border-line">
                        {patientMatches.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-subtle"
                              onClick={() => { setPatient(p); setPatientQuery(''); setWalkInName(''); }}
                            >
                              <PatientAvatar patient={p} size={28} />
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-ink">{p.full_name}</span>
                                <span className="block font-mono text-2xs text-ink-3"><Value>{p.hospital_number}</Value></span>
                              </span>
                              {hasAllergy(p.allergies) ? <Pill tone="critical">Allergy</Pill> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div>
                    <label className="label" htmlFor="walkin">Or a walk-in who is not registered</label>
                    <input
                      id="walkin"
                      className="field"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      placeholder="Full name"
                      maxLength={120}
                    />
                    <p className="mt-1 text-2xs text-ink-3">
                      A walk-in has no record, so no allergy check can be made. Register the patient
                      instead whenever there is time.
                    </p>
                  </div>
                </>
              )}
            </div>
          </Panel>

          {/* 2 — what is being handed over */}
          <Panel>
            <PanelHead title="What is being handed over" note="Step 2 of 3" />
            <div className="space-y-3 px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <label className="label" htmlFor="drug-search">Medicine</label>
                  <input
                    id="drug-search"
                    className="field"
                    value={drugQuery}
                    onChange={(e) => { setDrugQuery(e.target.value); setPickedDrug(null); }}
                    placeholder="Start typing a name"
                    autoComplete="off"
                  />
                </div>
                <div className="w-full sm:w-24">
                  <label className="label" htmlFor="qty">How many</label>
                  <input
                    id="qty"
                    ref={qtyRef}
                    className="field text-right font-mono"
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <button type="button" className="btn btn-primary" onClick={addToCart}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add
                  </button>
                </div>
              </div>

              {!pickedDrug && drugMatches.length > 0 ? (
                <ul className="divide-y divide-line-soft overflow-hidden rounded-md border border-line">
                  {drugMatches.map((d) => {
                    const out = d.stock_quantity <= 0;
                    const low = !out && d.reorder_level != null && d.stock_quantity <= d.reorder_level;
                    const shelf = expiryState(d);
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          disabled={out || shelf.expired}
                          onClick={() => chooseDrug(d)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-ink">
                              {d.name}{extraStrength(d.name, d.strength) ? <> <span className="font-normal text-ink-3">{extraStrength(d.name, d.strength)}</span></> : null}
                            </span>
                            <span className="block text-2xs text-ink-3">
                              {d.dosage_form}
                              {d.batch_number ? <> · batch {d.batch_number}</> : null}
                              {shelf.label ? <> · {shelf.expired ? 'expired' : 'expires'} {shelf.label}</> : null}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                            {shelf.expired ? <Pill tone="critical">Expired</Pill> : shelf.soon ? <Pill tone="warn">{shelf.days === 0 ? 'Expires today' : `${shelf.days} days left`}</Pill> : null}
                            {out ? <Pill tone="critical">Out of stock</Pill> : low ? <Pill tone="warn">{d.stock_quantity} left</Pill> : <span className="text-2xs text-ink-3">{d.stock_quantity} in stock</span>}
                            <span className="font-mono text-xs font-semibold text-ink">{currency} {d.unit_price.toFixed(2)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {pickedDrug ? (
                <div>
                  {(() => {
                    const shelf = expiryState(pickedDrug);
                    return (
                      <p className={`mb-3 flex items-center gap-2 text-2xs ${shelf.soon ? 'text-warn' : 'text-ink-3'}`}>
                        <span className="font-semibold text-ink-2">{pickedDrug.name}</span>
                        {pickedDrug.batch_number ? <span>batch {pickedDrug.batch_number}</span> : <span>no batch recorded</span>}
                        {shelf.label ? <span>expires {shelf.label}{shelf.soon ? ` — ${shelf.days === 0 ? 'today' : `${shelf.days} days`}` : ''}</span> : <span>no expiry recorded</span>}
                      </p>
                    );
                  })()}
                  <label className="label" htmlFor="instructions">How the patient should take it</label>
                  <input
                    id="instructions"
                    className="field"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. one tablet twice a day after food, for three days"
                    maxLength={200}
                  />
                  <p className="mt-1 text-2xs text-ink-3">
                    This is printed on the receipt the patient takes home. Left empty, the receipt
                    shows no instruction rather than a generic one.
                  </p>
                </div>
              ) : null}
            </div>

            {cart.length === 0 ? (
              <EmptyState
                title="Nothing added yet"
                detail="Search for a medicine above and add it. Stock is only taken down when the hand-over is recorded."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit</th>
                      <th className="num">Amount</th>
                      <th aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.drug_id}>
                        <td>
                          <span className="block font-medium text-ink">
                            {item.name}{extraStrength(item.name, item.strength) ? <> <span className="font-normal text-ink-3">{extraStrength(item.name, item.strength)}</span></> : null}
                          </span>
                          <span className="block text-2xs text-ink-3">
                            <Value>{item.instructions}</Value>
                          </span>
                        </td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{currency} {item.unit_price.toFixed(2)}</td>
                        <td className="num font-semibold text-ink">{currency} {item.subtotal.toFixed(2)}</td>
                        <td className="num">
                          <button
                            type="button"
                            aria-label={`Remove ${item.name}`}
                            className="rounded p-1 text-ink-3 transition-colors hover:bg-critical-wash hover:text-critical"
                            onClick={() => setCart(cart.filter((c) => c.drug_id !== item.drug_id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* 3 — payment */}
        <Panel className="h-fit lg:sticky lg:top-4">
          <PanelHead title="Payment" note="Step 3 of 3" />
          <div className="space-y-3 px-4 py-3">
            {conflicts.length > 0 ? (
              <div className="rounded-md border border-critical-line bg-critical-wash px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-critical">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Check this against the allergy record
                </p>
                <ul className="mt-1 space-y-0.5 text-2xs text-critical">
                  {conflicts.map((c) => (
                    <li key={c.item.drug_id}>
                      {c.item.name} matches "{c.words.join(', ')}" in this patient's recorded allergies.
                    </li>
                  ))}
                </ul>
                <label className="mt-2 flex items-start gap-2 text-2xs leading-relaxed text-ink">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={allergyChecked}
                    onChange={(e) => setAllergyChecked(e.target.checked)}
                  />
                  <span>
                    I have checked this with the patient or the prescribing clinician and it is
                    to be handed over. My name is recorded against this decision.
                  </span>
                </label>
              </div>
            ) : null}

            <dl className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-ink-2">Items</dt>
                <dd className="font-mono text-ink">{currency} {subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-2">
                  <label htmlFor="discount">Reduction</label>
                </dt>
                <dd>
                  <input
                    id="discount"
                    className="field h-7 w-24 text-right font-mono text-xs"
                    type="number"
                    min="0"
                    step="0.5"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0.00"
                  />
                </dd>
              </div>
            </dl>

            {discountValue > 0 ? (
              <div className="rounded-md border border-warn-line bg-warn-wash px-3 py-2">
                <label className="label" htmlFor="discount-reason">Why is the price reduced</label>
                <select
                  id="discount-reason"
                  className="field h-8 text-xs"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                >
                  <option value="">Choose a reason</option>
                  {DISCOUNT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="mt-1.5 text-2xs text-warn">
                  Recorded against {currentUser?.full_name || 'the signed-in user'} and listed in the
                  shift report.
                </p>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between border-t border-line pt-2.5">
              <span className="text-sm font-semibold text-ink">To collect</span>
              <span className="font-mono text-xl font-semibold text-ink">{currency} {total.toFixed(2)}</span>
            </div>

            <div>
              <label className="label" htmlFor="method">How it is being paid</label>
              <select id="method" className="field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="pharm-notes">Notes</label>
              <textarea id="pharm-notes" className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error ? (
              <p className="rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">{error}</p>
            ) : null}

            <button
              type="button"
              className="btn btn-primary btn-lg w-full justify-center"
              onClick={complete}
              disabled={submitting || cart.length === 0 || (conflicts.length > 0 && !allergyChecked)}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Recording</>
              ) : (
                <><Printer className="h-4 w-4" aria-hidden="true" /> Record and print receipt</>
              )}
            </button>

            <p className="text-center text-2xs leading-relaxed text-ink-3">
              Recorded against {currentUser?.full_name || 'the signed-in user'}. Stock is taken down
              at the same moment.
            </p>
          </div>
        </Panel>
      </div>

      <ReceiptModal isOpen={!!receipt} onClose={() => setReceipt(null)} data={receipt} />
    </div>
  );
}
