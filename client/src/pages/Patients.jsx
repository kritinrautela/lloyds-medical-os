import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, ChevronRight, CreditCard, FileCheck, Loader2, Pill as Pill_, Printer, Search, Send, UserPlus, Users, X
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PatientPhotoCapture, { PatientAvatar } from '../components/PatientPhoto';
import ReferralModal from '../components/ReferralModal';
import PrintableReferralLetter from '../components/PrintableReferralLetter';
import PrintableFitnessCertificate from '../components/PrintableFitnessCertificate';
import { REFERRAL_OUTCOMES } from '../lib/publicHealth';
import {
  EmptyState, Metric, MetricStrip, Panel, PanelHead, Pill, SectionTitle, Value, Vital,
  formatDateTime, hasAllergy, scoreVital, systolicOf
} from '../components/ui';

/*
 * The patient register.
 *
 * Two things carry this page. The hospital number, which is one number per
 * person for life and is printed on the card they take away; and the
 * photograph, which is how the counter confirms the person in front of them is
 * the person the record belongs to.
 */

const PROVINCES = [
  'Morobe Province', 'Madang Province', 'Eastern Highlands Province',
  'Western Highlands Province', 'Chimbu (Simbu) Province', 'Enga Province',
  'Southern Highlands Province', 'Hela Province', 'Jiwaka Province',
  'National Capital District', 'Central Province', 'Gulf Province',
  'Milne Bay Province', 'Oro (Northern) Province', 'Western Province',
  'East Sepik Province', 'West Sepik (Sandaun) Province', 'Manus Province',
  'New Ireland Province', 'East New Britain Province', 'West New Britain Province',
  'Autonomous Region of Bougainville'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const EMPTY_FORM = {
  full_name: '',
  age: '',
  gender: 'Male',
  phone: '',
  province: 'Morobe Province',
  district: '',
  address_or_village: '',
  blood_group: '',
  allergies: '',
  emergency_contact: '',
  medical_history: ''
};

export default function Patients({ settings, onCheckInPatient, onDispensePatient, refreshStats }) {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [cardPatient, setCardPatient] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPatients({ q: query, province });
      setPatients(res.patients || []);
    } catch (err) {
      console.error('Load patients failed:', err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [query, province]);

  useEffect(() => {
    const id = setTimeout(load, query ? 220 : 0);
    return () => clearTimeout(id);
  }, [load, query]);

  return (
    <div className="space-y-4">
      <SectionTitle note={`${patients.length} shown${patients.length === 100 ? ', newest 100' : ''}`}>
        Patient register
      </SectionTitle>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input
              className="field pl-9"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, hospital number from the card, village or phone"
              aria-label="Search the patient register"
            />
          </div>

          <select
            className="field w-auto min-w-[12rem]"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            aria-label="Filter by province"
          >
            <option value="">Every province</option>
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <button type="button" className="btn btn-primary" onClick={() => setRegisterOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Register a patient
          </button>
        </div>

        <p className="border-t border-line-soft px-4 py-2 text-2xs leading-relaxed text-ink-3">
          A hospital number can be typed exactly as it is printed, or without the dashes. The last
          digit is a check digit: if it does not match, the number was mistyped and the register
          will not return the wrong patient.
        </p>
      </Panel>

      <Panel>
        <PanelHead
          title="Registered patients"
          note="Newest registration first"
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading the register
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            title={query || province ? 'No patient matches that search' : 'No patients registered yet'}
            detail={
              query || province
                ? 'Check the spelling, or clear the filters to see the whole register.'
                : 'The first patient you register will appear here with a hospital number of their own.'
            }
            action={
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setRegisterOpen(true)}>
                Register a patient
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Hospital number</th>
                  <th className="num">Age</th>
                  <th>Sex</th>
                  <th>Village or address</th>
                  <th>Allergies</th>
                  <th>Registered</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const allergic = hasAllergy(p.allergies);
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <PatientAvatar patient={p} size={34} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{p.full_name}</span>
                            <span className="block truncate text-2xs text-ink-3">
                              <Value>{p.phone}</Value>
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs font-semibold text-ink">
                        <Value>{p.hospital_number}</Value>
                      </td>
                      <td className="num"><Value>{p.age}</Value></td>
                      <td>{p.gender}</td>
                      <td className="max-w-[14rem] truncate">
                        <Value>{p.address_or_village}</Value>
                        <span className="block text-2xs text-ink-3">
                          <Value>{p.province}</Value>
                        </span>
                      </td>
                      <td>
                        {allergic ? (
                          <Pill tone="critical" title={p.allergies}>{p.allergies}</Pill>
                        ) : (
                          <span className="text-2xs text-ink-3">None recorded</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        <Value>{formatDateTime(p.created_at)}</Value>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <span className="inline-flex gap-1.5">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => onCheckInPatient?.(p)}
                          >
                            Check in
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setSelectedId(p.id)}
                            aria-label={`Open the record for ${p.full_name}`}
                          >
                            Record
                            <ChevronRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <RegisterModal
        open={registerOpen}
        currentUser={currentUser}
        onClose={() => setRegisterOpen(false)}
        // Fires the moment the patient exists on the server, not when the
        // dialog is dismissed. A clerk who registers somebody and then closes
        // the dialog must see them in the register straight away, otherwise
        // they assume it failed and register the same person a second time
        // under a second hospital number.
        onSaved={() => {
          load();
          refreshStats?.();
        }}
        onPrintCard={(patient) => {
          setRegisterOpen(false);
          setCardPatient(patient);
        }}
        onOpenExisting={(id) => {
          setRegisterOpen(false);
          setSelectedId(id);
        }}
      />

      <PatientRecord
        patientId={selectedId}
        currentUser={currentUser}
        settings={settings}
        onClose={() => setSelectedId(null)}
        onChanged={load}
        onPrintCard={(p) => setCardPatient(p)}
        onCheckIn={onCheckInPatient}
        onDispense={onDispensePatient}
      />

      <IdCardSheet
        patient={cardPatient}
        settings={settings}
        onClose={() => setCardPatient(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function RegisterModal({ open, currentUser, onClose, onSaved, onPrintCard, onOpenExisting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  // People who may already be on the register under this name. Looked up as
  // the clerk types, because the moment to notice a second record is before
  // the second hospital number exists, not after.
  const [similar, setSimilar] = useState([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError('');
      setCreated(null);
      setSimilar([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || created) return undefined;
    const name = form.full_name.trim();
    if (name.length < 3) { setSimilar([]); return undefined; }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(() => {
      api.findSimilarPatients({ name, age: form.age, village: form.address_or_village })
        .then((res) => { if (!cancelled) setSimilar(res.matches || []); })
        .catch(() => { if (!cancelled) setSimilar([]); })
        .finally(() => { if (!cancelled) setChecking(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, created, form.full_name, form.age, form.address_or_village]);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.age || !form.gender) {
      setError('A record needs at least a name, an age and a sex before it can be opened.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.createPatient({
        ...form,
        age: parseInt(form.age, 10),
        registered_by: currentUser?.full_name || ''
      });
      setCreated(res.patient);
      onSaved?.(res.patient);
    } catch (err) {
      setError(err.message || 'The patient could not be registered.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Register a patient">
      <div className="panel max-h-[92vh] w-full max-w-3xl overflow-y-auto shadow-overlay">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line-soft bg-surface px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {created ? 'Patient registered' : 'Register a patient'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">
              {created
                ? 'Take the photograph now, then print the card for the patient to keep.'
                : 'Only the name, age and sex are required. Everything else can be filled in later.'}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {created ? (
          <div className="space-y-4 px-4 py-4">
            <div className="rounded-md border border-ok-line bg-ok-wash px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-ok">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                {created.full_name} is registered
              </p>
              <p className="mt-1.5 text-xs text-ink-2">Their hospital number, for life:</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-wide text-ink">
                {created.hospital_number}
              </p>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                Write this on the patient's card. Every future visit, prescription and receipt is
                filed against it.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label">Photograph</p>
                <PatientPhotoCapture
                  patient={created}
                  takenBy={currentUser?.full_name}
                  onSaved={(updated) => setCreated(updated)}
                />
              </div>
              <div className="text-xs leading-relaxed text-ink-2">
                <p className="font-semibold text-ink">Why the photograph matters here</p>
                <p className="mt-1.5">
                  Many patients share a name and few carry an identity document. A photograph on the
                  record lets the counter confirm the person in front of them is the person the
                  record belongs to, and stops one card being used by several people to collect
                  medicines.
                </p>
                <p className="mt-2">
                  It is optional. If there is no camera on this machine, or the patient does not want
                  their photograph taken, leave it and the record still works.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
              <button type="button" className="btn" onClick={() => { setCreated(null); setForm(EMPTY_FORM); }}>
                Register another
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onPrintCard(created)}>
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print the patient card
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="p-name">Full name</label>
                <input id="p-name" className="field" value={form.full_name} onChange={set('full_name')} maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="p-age">Age in years</label>
                <input id="p-age" className="field" type="number" min="0" max="130" value={form.age} onChange={set('age')} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="p-gender">Sex</label>
                <select id="p-gender" className="field" value={form.gender} onChange={set('gender')}>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="p-phone">Phone</label>
                <input id="p-phone" className="field" value={form.phone} onChange={set('phone')} placeholder="Leave blank if none" maxLength={40} />
              </div>
              <div>
                <label className="label" htmlFor="p-blood">Blood group</label>
                <select id="p-blood" className="field" value={form.blood_group} onChange={set('blood_group')}>
                  <option value="">Not known</option>
                  {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <p className="mt-1 text-2xs text-ink-3">Leave as not known unless it has been tested.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="p-province">Province</label>
                <select id="p-province" className="field" value={form.province} onChange={set('province')}>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="p-district">District</label>
                <input id="p-district" className="field" value={form.district} onChange={set('district')} maxLength={80} />
              </div>
              <div>
                <label className="label" htmlFor="p-village">Village or address</label>
                <input id="p-village" className="field" value={form.address_or_village} onChange={set('address_or_village')} maxLength={160} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="p-allergies">Known allergies</label>
                <input
                  id="p-allergies"
                  className="field"
                  value={form.allergies}
                  onChange={set('allergies')}
                  placeholder="Leave blank if none are known"
                  maxLength={200}
                />
                <p className="mt-1 text-2xs text-ink-3">
                  Anything typed here is shown in red on the queue and at the dispensing counter.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="p-emergency">Person to contact</label>
                <input id="p-emergency" className="field" value={form.emergency_contact} onChange={set('emergency_contact')} maxLength={160} />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="p-history">Relevant history</label>
              <textarea id="p-history" className="field" rows={3} value={form.medical_history} onChange={set('medical_history')} />
            </div>

            {similar.length > 0 ? (
              <div className="rounded-md border border-warn-line bg-warn-wash p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warn">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Possibly already registered
                </p>
                <p className="mt-0.5 text-2xs leading-relaxed text-ink-2">
                  {similar.length === 1 ? 'One record' : `${similar.length} records`} on the register {similar.length === 1 ? 'looks' : 'look'} like this
                  person. Open one to check before issuing a second number, or register anyway if it is
                  somebody else.
                </p>
                <ul className="mt-2 divide-y divide-warn-line/60">
                  {similar.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-1.5">
                      <div className="min-w-0 text-xs">
                        <p className="truncate font-medium text-ink">
                          {m.full_name}
                          <span className="ml-1.5 font-mono text-2xs text-ink-3">{m.hospital_number}</span>
                        </p>
                        <p className="truncate text-2xs text-ink-3">
                          {[m.age ? `${m.age} years` : null, m.gender, m.address_or_village].filter(Boolean).join(' · ')}
                          {m.why ? ` · ${m.why}` : ''}
                        </p>
                      </div>
                      <button type="button" className="btn btn-sm shrink-0" onClick={() => onOpenExisting?.(m.id)}>
                        Open record
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? (
              <p className="rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3">
              <p className="text-2xs text-ink-3">
                {checking ? 'Checking the register for this name. ' : ''}Recorded against {currentUser?.full_name || 'the signed-in user'}.
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Registering' : similar.length > 0 ? 'Register anyway' : 'Register and issue a number'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/*
 * The patient record, on the whole screen.
 *
 * It used to be a dialog, and a dialog is the wrong shape for a clinical
 * record: it has to hold a photograph, an allergy that must not be missed,
 * every visit with its observations, every medicine handed over and the
 * audit trail of who has touched the file. All of that needs the width of the
 * screen, not a box in the middle of it. So the record takes over the page,
 * with a way back at the top left where every application puts one.
 */
function PatientRecord({ patientId, currentUser, settings, onClose, onChanged, onPrintCard, onCheckIn, onDispense }) {
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [referring, setReferring] = useState(false);
  const [printReferral, setPrintReferral] = useState(null);
  const [certificateVisit, setCertificateVisit] = useState(null);
  const [outcomeError, setOutcomeError] = useState('');

  const reload = useCallback(() => {
    if (!patientId) { setData(null); return; }
    setLoading(true);
    api.getPatient(patientId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => { reload(); }, [reload]);

  // The record's own referral rows carry only the referral. The letter also
  // needs the patient and the observations from the visit, so it is fetched
  // in the joined form the register uses.
  const openLetter = async (r) => {
    try {
      const res = await api.getReferral(r.id);
      setPrintReferral(res.referral || r);
    } catch {
      setPrintReferral(r);
    }
  };

  const recordOutcome = async (referral, outcome) => {
    if (!outcome || outcome === referral.outcome) return;
    setOutcomeError('');
    const note = window.prompt(`Outcome for ${referral.referral_code}: ${outcome}. Add a note if there is one.`, referral.outcome_note || '');
    if (note === null) return;
    try {
      await api.updateReferralOutcome(referral.id, outcome, note);
      reload();
      onChanged?.();
    } catch (err) {
      setOutcomeError(err.message || 'The outcome could not be saved.');
    }
  };

  // Escape goes back, and the page behind does not scroll while the record
  // is open, so the scroll position of the register is where it was left.
  useEffect(() => {
    if (!patientId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [patientId, onClose]);

  if (!patientId) return null;

  const patient = data?.patient;
  const visits = data?.visits || [];
  const dispensations = data?.dispensations || [];
  const history = data?.history || [];
  const referrals = data?.referrals || [];
  const latestVisit = visits[0] || null;
  const canRefer = can?.('queue.consult');
  const canRecordOutcome = can?.('queue.triage');

  // The most recent visit that carries at least one observation.
  const observed = visits.find((v) => v.bp || v.pulse || v.temp || v.spo2 || v.resp_rate || v.weight);
  const openVisit = visits.find((v) => v.status && v.status !== 'Completed' && v.status !== 'Cancelled');
  const collected = dispensations.reduce((sum, d) => sum + (Number(d.paid_amount) || 0), 0);
  const fees = visits.reduce((sum, v) => sum + (Number(v.consultation_fee) || 0), 0);

  return (
    <div className="fixed inset-0 z-40 !mt-0 flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="Patient record">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-2.5 md:px-6">
          <button type="button" className="btn btn-sm shrink-0" onClick={onClose}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Register</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            {patient ? <PatientAvatar patient={patient} size={36} className="hidden shrink-0 sm:block" /> : null}
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-ink">
                {patient?.full_name || 'Patient record'}
              </h1>
              <p className="truncate font-mono text-2xs text-ink-3">
                <Value>{patient?.hospital_number}</Value>
                {patient?.age ? <span className="font-sans"> · {patient.age} years</span> : null}
                {patient?.gender ? <span className="font-sans"> · {patient.gender}</span> : null}
                {openVisit ? <span className="font-sans text-warn"> · In the department now</span> : null}
              </p>
            </div>
          </div>

          {patient ? (
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" className="btn btn-sm hidden md:inline-flex" onClick={() => onPrintCard(patient)}>
                <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                Patient card
              </button>
              {canRefer ? (
                <button type="button" className="btn btn-sm hidden md:inline-flex" onClick={() => setReferring(true)}>
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Refer
                </button>
              ) : null}
              {onDispense ? (
                <button type="button" className="btn btn-sm hidden sm:inline-flex" onClick={() => { onDispense(patient, openVisit); onClose(); }}>
                  <Pill_ className="h-3.5 w-3.5" aria-hidden="true" />
                  Dispense
                </button>
              ) : null}
              {onCheckIn ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => { onCheckIn(patient); onClose(); }}
                  disabled={!!openVisit} title={openVisit ? 'Already checked in today' : undefined}>
                  Check in
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading || !patient ? (
          <div className="flex items-center justify-center gap-2 px-6 py-24 text-sm text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading the record
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
            {hasAllergy(patient.allergies) ? (
              <div className="mb-4 flex items-start gap-3 rounded-md border border-critical-line bg-critical-wash px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-critical">Allergy on record</p>
                  <p className="mt-0.5 text-base font-semibold leading-snug text-critical">{patient.allergies}</p>
                  <p className="mt-0.5 text-2xs text-critical/80">The dispensing counter checks every medicine against this line before it is handed over.</p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              {/* Identity */}
              <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
                <PatientPhotoCapture
                  patient={patient}
                  takenBy={currentUser?.full_name}
                  onSaved={(updated) => {
                    setData((d) => ({ ...d, patient: updated }));
                    onChanged?.();
                  }}
                />

                <Panel>
                  <PanelHead title="Identity" />
                  <dl className="divide-y divide-line-soft text-xs">
                    <Field label="Hospital number"><span className="font-mono">{patient.hospital_number}</span></Field>
                    <Field label="Age">{patient.age ? `${patient.age} years` : null}</Field>
                    <Field label="Sex">{patient.gender}</Field>
                    <Field label="Phone">{patient.phone}</Field>
                    <Field label="Village">{patient.address_or_village}</Field>
                    <Field label="District">{patient.district}</Field>
                    <Field label="Province">{patient.province}</Field>
                    <Field label="Blood group">{patient.blood_group}</Field>
                    <Field label="Emergency contact">{patient.emergency_contact}</Field>
                    <Field label="Registered">{formatDateTime(patient.created_at)}</Field>
                    <Field label="Registered by">{patient.registered_by}</Field>
                    <Field label="Photograph">{patient.photo_taken_at ? `${formatDateTime(patient.photo_taken_at)}${patient.photo_taken_by ? ` by ${patient.photo_taken_by}` : ''}` : null}</Field>
                  </dl>
                </Panel>

                {patient.medical_history ? (
                  <Panel>
                    <PanelHead title="Relevant history" />
                    <p className="px-4 py-3 text-xs leading-relaxed text-ink-2">{patient.medical_history}</p>
                  </Panel>
                ) : null}
              </div>

              {/* Clinical */}
              <div className="min-w-0 space-y-4">
                <MetricStrip columns={4}>
                  <Metric label="Visits" value={visits.length}
                    context={visits[0] ? `Last seen ${visits[0].visit_date}` : 'Never seen'} tint="1" />
                  <Metric label="Medicines handed over" value={dispensations.length}
                    context={dispensations[0] ? `Last ${formatDateTime(dispensations[0].created_at)}` : 'None yet'} tint="2" />
                  <Metric label="Paid at the counter" value={`K ${collected.toFixed(2)}`}
                    context="Pharmacy, all visits" tint="3" />
                  <Metric label="Consultation fees" value={`K ${fees.toFixed(2)}`}
                    context="Recorded at check-in" tint="4" />
                </MetricStrip>

                <Panel>
                  <PanelHead
                    title="Latest observations"
                    note={observed ? `Recorded at the visit of ${observed.visit_date}` : 'No observations have been recorded'}
                  />
                  {observed ? (
                    <div className="grid grid-cols-3 gap-px bg-line-soft sm:grid-cols-6">
                      <Vital label="Blood pressure" value={observed.bp} unit="mmHg"
                        tone={scoreVital('systolic', systolicOf(observed.bp), patient.age).tone} />
                      <Vital label="Pulse" value={observed.pulse} unit="bpm"
                        tone={scoreVital('pulse', observed.pulse, patient.age).tone} />
                      <Vital label="Temperature" value={observed.temp} unit="°C"
                        tone={scoreVital('temp', observed.temp, patient.age).tone} />
                      <Vital label="Breathing" value={observed.resp_rate} unit="/min"
                        tone={scoreVital('resp', observed.resp_rate, patient.age).tone} />
                      <Vital label="Oxygen" value={observed.spo2} unit="%"
                        tone={scoreVital('spo2', observed.spo2, patient.age).tone} />
                      <Vital label="Weight" value={observed.weight} unit="kg" />
                    </div>
                  ) : (
                    <EmptyState title="Nothing measured yet" detail="Observations recorded at triage appear here with the visit they belong to." />
                  )}
                </Panel>

                <Panel>
                  <PanelHead title="Visits" note={`${visits.length} recorded`} />
                  {visits.length === 0 ? (
                    <EmptyState title="This patient has not been seen yet" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Reason</th>
                            <th>Diagnosis</th>
                            <th>Seen by</th>
                            <th>Triage</th>
                            <th className="num">Fee</th>
                            <th>Status</th>
                            <th aria-label="Documents" />
                          </tr>
                        </thead>
                        <tbody>
                          {visits.map((v) => (
                            
                            <React.Fragment key={v.id}>
                              <tr>
                                <td className="whitespace-nowrap">{v.visit_date}<span className="block font-mono text-2xs text-ink-3">{v.visit_code}</span></td>
                                <td className="max-w-[18rem]"><Value>{v.reason}</Value></td>
                                <td className="max-w-[18rem]"><Value>{v.diagnosis}</Value></td>
                                <td className="whitespace-nowrap"><Value>{v.doctor_name}</Value></td>
                                <td><Value>{v.triage_priority}</Value></td>
                                <td className="num">{v.consultation_fee != null ? Number(v.consultation_fee).toFixed(2) : '—'}</td>
                                <td><Pill tone={v.status === 'Completed' ? 'ok' : v.status === 'Cancelled' ? 'neutral' : 'warn'}>{v.status}</Pill></td>
                                <td className="whitespace-nowrap">
                                  {v.fitness_status && v.fitness_status !== 'Not assessed' ? (
                                    <button type="button" className="btn btn-sm" onClick={() => setCertificateVisit(v)}
                                      title="Print the fitness for work certificate">
                                      <FileCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                      Certificate
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                              {v.doctor_notes || v.follow_up_date || (v.rdt_result && v.rdt_result !== 'Not done') || v.notifiable_condition || (v.fitness_status && v.fitness_status !== 'Not assessed') ? (
                                <tr>
                                  <td colSpan={8} className="border-t-0 pt-0 text-2xs leading-relaxed text-ink-2">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                      {v.follow_up_date ? (
                                        <Pill tone="info">Return {v.follow_up_date}{v.follow_up_note ? `: ${v.follow_up_note}` : ''}</Pill>
                                      ) : null}
                                      {v.rdt_result && v.rdt_result !== 'Not done' ? (
                                        <Pill tone={String(v.rdt_result).startsWith('Positive') ? 'warn' : 'neutral'}>Malaria RDT {v.rdt_result}</Pill>
                                      ) : null}
                                      {v.notifiable_condition ? <Pill tone="critical">Reportable: {v.notifiable_condition}</Pill> : null}
                                      {v.fitness_status && v.fitness_status !== 'Not assessed' ? (
                                        <Pill tone={v.fitness_status === 'Fit for full duty' ? 'ok' : v.fitness_status === 'Unfit for work' ? 'critical' : 'warn'}>
                                          {v.fitness_status}{v.fitness_until ? ` until ${v.fitness_until}` : ''}{v.fitness_restrictions ? `: ${v.fitness_restrictions}` : ''}
                                        </Pill>
                                      ) : null}
                                    </span>
                                    {v.doctor_notes ? (
                                      <span className="mt-1 block"><span className="font-semibold text-ink-3">Notes: </span>{v.doctor_notes}</span>
                                    ) : null}
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelHead title="Referrals" note={`${referrals.length} recorded`} />
                  {outcomeError ? (
                    <p className="mx-4 mb-2 rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">{outcomeError}</p>
                  ) : null}
                  {referrals.length === 0 ? (
                    <EmptyState title="This patient has not been referred anywhere"
                      detail={canRefer ? 'Use Refer at the top of the record, or Refer out during a consultation.' : undefined} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>To</th>
                            <th>Reason</th>
                            <th>Urgency</th>
                            <th>Referred by</th>
                            <th>Outcome</th>
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {referrals.map((r) => (
                            <tr key={r.id}>
                              <td className="whitespace-nowrap">{String(r.created_at || '').slice(0, 10)}<span className="block font-mono text-2xs text-ink-3">{r.referral_code}</span></td>
                              <td className="max-w-[16rem]"><Value>{r.referred_to}</Value>{r.department ? <span className="block text-2xs text-ink-3">{r.department}</span> : null}</td>
                              <td className="max-w-[18rem]"><Value>{r.reason}</Value></td>
                              <td><Pill tone={r.urgency === 'Emergency' ? 'critical' : r.urgency === 'Urgent' ? 'warn' : 'neutral'}>{r.urgency}</Pill></td>
                              <td className="whitespace-nowrap"><Value>{r.referred_by}</Value></td>
                              <td>
                                {canRecordOutcome ? (
                                  <select className="field py-1 text-xs" value={r.outcome} aria-label={`Outcome of ${r.referral_code}`}
                                    onChange={(e) => recordOutcome(r, e.target.value)}>
                                    {REFERRAL_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                ) : (
                                  <Pill tone={r.outcome === 'Awaiting outcome' ? 'warn' : r.outcome === 'Died' ? 'critical' : 'ok'}>{r.outcome}</Pill>
                                )}
                                {r.outcome_note ? <span className="block text-2xs text-ink-3">{r.outcome_note}</span> : null}
                              </td>
                              <td className="whitespace-nowrap">
                                <button type="button" className="btn btn-sm" onClick={() => openLetter(r)}>
                                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                                  Letter
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelHead title="Medicines dispensed" note={`${dispensations.length} hand-overs`} />
                  {dispensations.length === 0 ? (
                    <EmptyState title="No medicines have been dispensed to this patient" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>When</th>
                            <th>Invoice</th>
                            <th>Medicines</th>
                            <th>Dispensed by</th>
                            <th>Paid</th>
                            <th className="num">Collected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dispensations.map((d) => (
                            <tr key={d.id}>
                              <td className="whitespace-nowrap"><Value>{formatDateTime(d.created_at)}</Value></td>
                              <td className="whitespace-nowrap font-mono text-xs">{d.invoice_number}</td>
                              <td className="max-w-[22rem]"><Value>{d.drugs_summary}</Value></td>
                              <td className="whitespace-nowrap"><Value>{d.dispensed_by_name}</Value></td>
                              <td className="whitespace-nowrap"><Value>{d.payment_method}</Value>{Number(d.discount) > 0 ? <span className="block text-2xs text-warn">Reduced by {Number(d.discount).toFixed(2)}</span> : null}</td>
                              <td className="num">{Number(d.paid_amount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelHead title="Record history" note="Who has done what on this file, newest first" />
                  {history.length === 0 ? (
                    <EmptyState title="Nothing recorded against this file yet" />
                  ) : (
                    <ol className="divide-y divide-line-soft">
                      {history.map((h) => (
                        <li key={h.id} className="flex gap-3 px-4 py-2">
                          <span className="w-28 shrink-0 whitespace-nowrap text-2xs text-ink-3">{formatDateTime(h.created_at)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="text-xs font-medium text-ink">{h.action_type}</span>
                            <span className="text-xs text-ink-3"> · {h.user_name}{h.user_role ? `, ${h.user_role}` : ''}</span>
                            {h.details ? <span className="block text-2xs leading-relaxed text-ink-2">{h.details}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              </div>
            </div>
          </div>
        )}
      </div>

      {referring && patient ? (
        <ReferralModal
          patient={patient}
          visit={latestVisit}
          onClose={() => setReferring(false)}
          onSaved={() => { reload(); onChanged?.(); }}
          onPrint={(r) => { setReferring(false); setPrintReferral(r); }}
        />
      ) : null}
      {printReferral ? (
        <PrintableReferralLetter referral={printReferral} settings={settings} onClose={() => setPrintReferral(null)} />
      ) : null}
      {certificateVisit && patient ? (
        <PrintableFitnessCertificate visit={certificateVisit} patient={patient} settings={settings}
          onClose={() => setCertificateVisit(null)} />
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 px-3 py-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-ink-2"><Value>{children}</Value></dd>
    </div>
  );
}

// ---------------------------------------------------------------------------

/*
 * The card the patient takes home. Printed on ordinary paper and cut out, it
 * carries the number the clinic will ask for on every future visit, plus the
 * photograph so it cannot easily be used by somebody else.
 */
function IdCardSheet({ patient, settings, onClose }) {
  if (!patient) return null;

  return (
    <div className="printable-modal-overlay scrim" role="dialog" aria-modal="true" aria-label="Patient card">
      <div className="printable-modal-card panel w-full max-w-lg shadow-overlay">
        <div className="no-print flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Patient card</h2>
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print
            </button>
            <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="printable-area px-5 py-5">
          <div className="mx-auto w-full max-w-[420px] rounded-md border border-line p-4">
            <div className="flex items-start justify-between gap-3 border-b border-line-soft pb-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">
                  {settings?.name || 'Lloyds Medical OS'}
                </p>
                <p className="truncate text-2xs text-ink-3">
                  {[settings?.district, settings?.province].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="shrink-0 text-2xs uppercase tracking-wide text-ink-3">Patient card</p>
            </div>

            <div className="mt-3 flex gap-3">
              <PatientAvatar patient={patient} size={84} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ink">{patient.full_name}</p>
                <p className="mt-0.5 text-xs text-ink-2">
                  <Value>{patient.age}</Value> years · {patient.gender}
                </p>
                <p className="mt-2 text-2xs uppercase tracking-wide text-ink-3">Hospital number</p>
                <p className="font-mono text-lg font-semibold tracking-wide text-ink">
                  {patient.hospital_number}
                </p>
              </div>
            </div>

            <dl className="mt-3 space-y-1 border-t border-line-soft pt-2.5 text-2xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Village</dt>
                <dd className="truncate text-ink-2"><Value>{patient.address_or_village}</Value></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Allergies</dt>
                <dd className="truncate font-semibold text-ink-2">
                  {hasAllergy(patient.allergies) ? patient.allergies : 'None recorded'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Clinic phone</dt>
                <dd className="truncate text-ink-2"><Value>{settings?.phone}</Value></dd>
              </div>
            </dl>

            <p className="mt-3 border-t border-line-soft pt-2 text-2xs leading-relaxed text-ink-3">
              Bring this card to every visit. Tell the clerk the number on it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
