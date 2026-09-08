import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ArrowRight, Printer, Send, Stethoscope, Ticket, Undo2, UserPlus, X
} from 'lucide-react';
import ReferralModal from '../components/ReferralModal';
import PrintableReferralLetter from '../components/PrintableReferralLetter';
import { FITNESS_STATUSES, RDT_RESULTS, notifiableFor } from '../lib/publicHealth';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PatientAvatar } from '../components/PatientPhoto';
import PrintableOPDRegisterModal from '../components/PrintableOPDRegisterModal';
import QueueTicket from '../components/QueueTicket';
import ReturnSlip from '../components/ReturnSlip';
import { useToast } from '../components/toast';
import {
  allergyState,
  EmptyState,
  ErrorState,
  formatDuration,
  hasAllergy,
  ListSkeleton,
  Metric,
  MetricStrip,
  Panel,
  PanelHead,
  Pill,
  scoreVital,
  SectionTitle,
  systolicOf,
  useEscapeKey,
  useFocusTrap,
  Value,
  Vital
} from '../components/ui';

/*
 * The outpatient queue.
 *
 * This is the screen the clinic actually lives in, so it is built around one
 * question: who is waiting, and who has been waiting too long. Everything else
 * on the page is secondary to that.
 *
 * Waiting times are computed in the browser from the check-in timestamp, which
 * the server stores in UTC, so the figure keeps counting up between refreshes
 * rather than freezing until someone reloads the page.
 */

const STAGES = [
  { key: 'Waiting', label: 'Waiting', tokPisin: 'Wetim' },
  { key: 'Triage / Vitals', label: 'Triage and vitals' },
  { key: 'In Consultation', label: 'With the doctor', tokPisin: 'Wantaim dokta' },
  { key: 'At Pharmacy', label: 'At pharmacy', tokPisin: 'Kisim marasin' },
  { key: 'Completed', label: 'Completed' }
];

const NEXT_STAGE = {
  'Waiting': 'Triage / Vitals',
  'Triage / Vitals': 'In Consultation',
  'In Consultation': 'At Pharmacy',
  'At Pharmacy': 'Completed'
};
const PREVIOUS_STAGE = Object.fromEntries(Object.entries(NEXT_STAGE).map(([from, to]) => [to, from]));
const STAGE_WORD = (stage) => stage === 'Completed' ? 'completed' : stage.replace(' / ', ' and ').toLowerCase();

// Presentations this clinic sees most, kept as one-tap entries so a busy
// clinician is not typing the same diagnosis twenty times a day. Selecting one
// fills the diagnosis field; it never records anything on its own.
const DIAGNOSIS_PRESETS = [
  { code: 'B50.9', label: 'Falciparum malaria', priority: 'Urgent' },
  { code: 'B51.9', label: 'Vivax malaria', priority: 'Urgent' },
  { code: 'T63.0', label: 'Snakebite envenoming', priority: 'Emergency' },
  { code: 'T14.1', label: 'Crush or laceration injury', priority: 'Emergency' },
  { code: 'T67.0', label: 'Heat exhaustion and dehydration', priority: 'Urgent' },
  { code: 'J18.9', label: 'Pneumonia', priority: 'Urgent' },
  { code: 'A09', label: 'Gastroenteritis', priority: 'Standard' },
  { code: 'J06.9', label: 'Upper respiratory infection', priority: 'Standard' },
  { code: 'L02.9', label: 'Skin abscess', priority: 'Standard' },
  { code: 'I10', label: 'Hypertension', priority: 'Standard' },
  { code: 'A15.9', label: 'Suspected tuberculosis', priority: 'Standard' },
  { code: 'K29.7', label: 'Gastritis', priority: 'Standard' }
];

const LAB_TESTS = [
  'Malaria RDT (Pf/Pv)',
  '20 minute whole blood clotting test',
  'Blood glucose',
  'Haemoglobin',
  'Urine dipstick',
  'Sputum for AFB'
];

const PRIORITIES = ['Standard', 'Urgent', 'Emergency'];

// A visit row carries the patient's photo columns alongside its own id. The
// avatar addresses photos by patient id, so reshape rather than passing the
// visit straight through: v.id is the visit, not the person.
function patientOf(visit) {
  return {
    id: visit.patient_id,
    full_name: visit.patient_name,
    hospital_number: visit.hospital_number,
    allergies: visit.allergies,
    photo_path: visit.photo_path,
    photo_taken_at: visit.photo_taken_at
  };
}

function minutesSince(iso) {
  if (!iso) return null;
  const stamp = new Date(String(iso).includes('T') ? iso : `${iso}Z`.replace(' ', 'T'));
  if (Number.isNaN(stamp.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - stamp.getTime()) / 60000));
}

export default function OPDQueue({ settings, onOpenCheckIn, onOpenDispenseForPatient, refreshStats, refreshKey = 0 }) {
  const { currentUser } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // While the queue cannot be read, a zero on a tile would be a false reading.
  const unavailable = Boolean(loadError) && visits.length === 0;
  const [stage, setStage] = useState('Open');
  const [consultVisit, setConsultVisit] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [ticketVisit, setTicketVisit] = useState(null);
  const [slip, setSlip] = useState(null);
  const toast = useToast();
  const [, setTick] = useState(0);

  const currency = settings?.currency_symbol || 'K';

  const load = useCallback(async () => {
    try {
      const res = await api.getTodayVisits();
      setVisits(res.visits || []);
      setLoadError('');
    } catch (err) {
      console.error('Load queue failed:', err);
      setLoadError(err.message || 'The server did not answer.');
    } finally {
      setLoading(false);
    }
  }, []);

  // A check-in made from the top bar while this page is open bumps
  // refreshKey, so the new patient appears without waiting for the timer.
  useEffect(() => { load(); }, [load, refreshKey]);

  // One timer drives both the live wait counters and a quiet reload, so a
  // second clinician moving a patient on another device shows up here.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    const reload = setInterval(load, 60000);
    return () => { clearInterval(id); clearInterval(reload); };
  }, [load]);

  const counts = useMemo(() => {
    const map = {};
    STAGES.forEach((s) => { map[s.key] = 0; });
    visits.forEach((v) => { map[v.status] = (map[v.status] || 0) + 1; });
    return map;
  }, [visits]);

  const openVisits = useMemo(() => visits.filter((v) => v.status !== 'Completed'), [visits]);

  const longestWait = useMemo(() => {
    const waits = openVisits.map((v) => minutesSince(v.created_at)).filter((m) => m !== null);
    return waits.length ? Math.max(...waits) : null;
  }, [openVisits]);

  const shown = useMemo(() => {
    if (stage === 'Open') return openVisits;
    if (stage === 'All') return visits;
    return visits.filter((v) => v.status === stage);
  }, [visits, openVisits, stage]);

  /*
   * Moving a patient is one tap, so a wrong tap has to be one tap to undo.
   * The confirmation names the patient and the stage, and offers the way back
   * for a few seconds; after that the row's own "back" control does the same.
   */
  const move = async (visit, to, { undoable = true } = {}) => {
    const mover = currentUser?.full_name || '';
    try {
      await api.updateVisitStatus(visit.id, to, mover);
      await load();
      refreshStats?.();
      const title = to === 'Completed'
        ? `${visit.patient_name} marked as completed`
        : `${visit.patient_name} sent to ${STAGE_WORD(to)}`;
      toast.ok(title, undoable ? {
        action: {
          label: 'Undo',
          onClick: () => move(visit, visit.status, { undoable: false })
        }
      } : { detail: `Back in ${STAGE_WORD(to)}.` });
    } catch (err) {
      toast.error(`${visit.patient_name} could not be moved`, { detail: err.message || 'The clinic server did not answer.' });
    }
  };

  const advance = (visit) => {
    const next = NEXT_STAGE[visit.status];
    if (next) move(visit, next);
  };

  const sendBack = (visit) => {
    const previous = PREVIOUS_STAGE[visit.status];
    if (previous) move(visit, previous);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle note={`${openVisits.length} still open of ${visits.length} today`}>
          Outpatient queue
        </SectionTitle>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm" onClick={() => setRegisterOpen(true)}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print today's register
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onOpenCheckIn}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Check in a patient
          </button>
        </div>
      </div>

      <MetricStrip columns={5}>
        {STAGES.map((s, i) => (
          <Metric
            key={s.key}
            label={s.tokPisin ? `${s.label} · ${s.tokPisin}` : s.label}
            value={unavailable ? '—' : counts[s.key] || 0}
            context={
              s.key === 'Waiting' && longestWait !== null
                ? `Longest wait ${formatDuration(longestWait)}`
                : s.key === 'Completed'
                ? 'Closed today'
                : 'Patients at this stage'
            }
            tone={s.key === 'Waiting' && (counts.Waiting || 0) > 10 ? 'warn' : 'neutral'}
            tint={String((i % 6) + 1)}
            onClick={() => setStage(s.key)}
          />
        ))}
      </MetricStrip>

      <Panel>
        <PanelHead title="Queue" note="Emergency first, then urgent, then in order of arrival">
          <select
            className="field h-7 w-auto text-xs"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            aria-label="Filter the queue by stage"
          >
            <option value="Open">Still open</option>
            <option value="All">Everyone today</option>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </PanelHead>

        {loadError && visits.length > 0 ? (
          <p role="status" className="border-b border-warn-line bg-warn-wash px-4 py-2 text-2xs text-ink-2">
            The last refresh failed, so this list may be a minute behind. It will try again shortly.
          </p>
        ) : null}

        {loading ? (
          <ListSkeleton rows={4} label="Reading the queue" />
        ) : loadError && visits.length === 0 ? (
          <ErrorState
            title="The queue could not be read"
            detail="The server did not answer. Check that it is running and that this device is on the clinic network."
            onRetry={() => { setLoading(true); load(); }}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title={stage === 'Open' ? 'Nobody is waiting' : 'No patients at this stage'}
            detail="Patients appear here the moment they are checked in at reception."
            action={
              <button type="button" className="btn btn-sm btn-primary" onClick={onOpenCheckIn}>
                Check in a patient
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {shown.map((v) => (
              <QueueRow
                key={v.id}
                visit={v}
                currency={currency}
                onAdvance={() => advance(v)}
                onBack={() => sendBack(v)}
                onConsult={() => setConsultVisit(v)}
                onTicket={() => setTicketVisit(v)}
              />
            ))}
          </ul>
        )}
      </Panel>

      <ConsultationModal
        visit={consultVisit}
        settings={settings}
        currentUser={currentUser}
        onClose={() => setConsultVisit(null)}
        onSaved={async (goToPharmacy, saved) => {
          const visit = consultVisit;
          setConsultVisit(null);
          await load();
          refreshStats?.();
          if (visit) {
            const returnDate = saved?.follow_up_date || '';
            toast.ok(`Consultation saved for ${visit.patient_name}`, {
              detail: returnDate ? `Return visit on ${returnDate}.` : '',
              action: returnDate ? {
                label: 'Print return slip',
                onClick: () => setSlip({ visit: { ...visit, ...saved }, returnDate, note: saved?.follow_up_note || '' })
              } : null
            });
          }
          if (goToPharmacy && visit) {
            onOpenDispenseForPatient?.({
              id: visit.patient_id,
              full_name: visit.patient_name,
              visit_id: visit.id
            });
          }
        }}
      />

      <PrintableOPDRegisterModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        visits={visits}
        settings={settings}
      />

      <QueueTicket
        isOpen={Boolean(ticketVisit)}
        onClose={() => setTicketVisit(null)}
        settings={settings}
        visit={ticketVisit}
      />

      <ReturnSlip
        isOpen={Boolean(slip)}
        onClose={() => setSlip(null)}
        settings={settings}
        patient={slip ? patientOf(slip.visit) : null}
        visit={slip?.visit}
        returnDate={slip?.returnDate}
        note={slip?.note}
        issuedBy={currentUser?.full_name || ''}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function QueueRow({ visit, currency, onAdvance, onBack, onConsult, onTicket }) {
  const waited = minutesSince(visit.created_at);
  const emergency = visit.triage_priority === 'Emergency';
  const urgent = visit.triage_priority === 'Urgent';
  const done = visit.status === 'Completed';
  const allergic = hasAllergy(visit.allergies);
  const nextStage = NEXT_STAGE[visit.status];
  const previousStage = PREVIOUS_STAGE[visit.status];

  const hasObs = visit.bp || visit.pulse || visit.temp || visit.spo2 || visit.resp_rate;
  const waitTone = done ? 'neutral' : waited >= 120 ? 'critical' : waited >= 60 ? 'warn' : 'neutral';

  return (
    <li className={`px-4 py-3 ${emergency && !done ? 'bg-critical-wash' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <PatientAvatar patient={patientOf(visit)} size={44} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{visit.patient_name}</span>
              {emergency ? <Pill tone="critical">Emergency</Pill> : null}
              {urgent ? <Pill tone="warn">Urgent</Pill> : null}
              <Pill tone={done ? 'ok' : 'neutral'}>{visit.status}</Pill>
            </div>
            <p className="mt-0.5 text-2xs text-ink-3">
              <span className="font-mono"><Value>{visit.hospital_number}</Value></span>
              {' · '}<Value>{visit.age}</Value>{visit.age ? 'y' : ''}
              {' · '}{visit.gender}
              {' · '}<span className="font-mono">{visit.visit_code}</span>
            </p>
            <p className="mt-1 max-w-2xl text-xs text-ink-2">
              <Value>{visit.diagnosis || visit.reason}</Value>
            </p>
            {allergic ? (
              <p className="mt-1 text-xs font-semibold text-critical">Allergies: {visit.allergies}</p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-4">
          <div className="text-left sm:text-right">
            <p className="text-2xs uppercase tracking-wide text-ink-3">
              {done ? 'Seen in' : 'Waiting'}
            </p>
            <p className={`text-sm font-semibold ${
              waitTone === 'critical' ? 'text-critical' : waitTone === 'warn' ? 'text-warn' : 'text-ink'
            }`}>
              <Value>{formatDuration(waited)}</Value>
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={onTicket} aria-label={`Print queue ticket for ${visit.patient_name}`} title="Print queue ticket">
              <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {previousStage ? (
              <button type="button" className="btn btn-sm" onClick={onBack} aria-label={`Send ${visit.patient_name} back to ${STAGE_WORD(previousStage)}`} title={`Back to ${STAGE_WORD(previousStage)}`}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" className="btn btn-sm" onClick={onConsult}>
              <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
              {hasObs ? 'Open notes' : 'Record vitals'}
            </button>
            {nextStage ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={onAdvance}>
                {nextStage === 'Completed' ? 'Complete' : `Send to ${nextStage.replace(' / ', ' and ').toLowerCase()}`}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {hasObs ? (
        <div className="mt-2.5 grid grid-cols-3 gap-x-4 gap-y-2 rounded border border-line bg-subtle px-3 py-2 sm:grid-cols-6">
          <Vital label="BP" value={visit.bp} unit="mmHg" tone={scoreVital('systolic', systolicOf(visit.bp), visit.age).tone} />
          <Vital label="Pulse" value={visit.pulse} unit="bpm" tone={scoreVital('pulse', visit.pulse, visit.age).tone} />
          <Vital label="SpO₂" value={visit.spo2} unit="%" tone={scoreVital('spo2', visit.spo2, visit.age).tone} />
          <Vital label="Temp" value={visit.temp} unit="°C" tone={scoreVital('temp', visit.temp, visit.age).tone} />
          <Vital label="Resp" value={visit.resp_rate} unit="/min" tone={scoreVital('resp', visit.resp_rate, visit.age).tone} />
          <Vital label="Weight" value={visit.weight} unit="kg" />
        </div>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------

function ConsultationModal({ visit, settings, currentUser, onClose, onSaved }) {
  const scrimRef = useRef(null);
  useFocusTrap(scrimRef);
  const [form, setForm] = useState(null);
  const [labs, setLabs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [referring, setReferring] = useState(false);
  const [printReferral, setPrintReferral] = useState(null);
  const [referred, setReferred] = useState(null);

  useEffect(() => {
    if (!visit) { setForm(null); return; }
    setLabs([]);
    setError('');
    setForm({
      bp: visit.bp || '',
      pulse: visit.pulse || '',
      temp: visit.temp || '',
      resp_rate: visit.resp_rate || '',
      spo2: visit.spo2 || '',
      weight: visit.weight || '',
      diagnosis: visit.diagnosis || '',
      doctor_notes: visit.doctor_notes || '',
      triage_priority: visit.triage_priority || 'Standard',
      rdt_result: visit.rdt_result || 'Not done',
      follow_up_date: visit.follow_up_date || '',
      follow_up_note: visit.follow_up_note || '',
      fitness_status: visit.fitness_status || 'Not assessed',
      fitness_restrictions: visit.fitness_restrictions || '',
      fitness_until: visit.fitness_until || '',
      // The fee comes from facility settings. It used to be fixed in the
      // browser, which meant the clinic could not change its own price.
      consultation_fee:
        visit.consultation_fee != null
          ? visit.consultation_fee
          : (settings?.default_consultation_fee ?? 0)
    });
  }, [visit, settings]);

  useEscapeKey(onClose, !!visit);

  if (!visit || !form) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const currency = settings?.currency_symbol || 'K';

  const submit = async (goToPharmacy) => {
    setSaving(true);
    setError('');
    try {
      const notes = labs.length
        ? `${form.doctor_notes || ''}\nTests requested: ${labs.join(', ')}.`.trim()
        : form.doctor_notes;

      await api.updateVisitVitals(visit.id, {
        ...form,
        consultation_fee: Number(form.consultation_fee) || 0,
        doctor_notes: notes,
        doctor_name: currentUser?.full_name || ''
      });

      if (goToPharmacy) {
        await api.updateVisitStatus(visit.id, 'At Pharmacy', currentUser?.full_name || '');
      }
      onSaved(goToPharmacy, { ...form, doctor_notes: notes });
    } catch (err) {
      setError(err.message || 'The consultation could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const allergic = hasAllergy(visit.allergies);

  // Said before saving, so the clinician knows the diagnosis will go on the
  // reportable line list. The server makes the same decision when it saves.
  const reportable = notifiableFor(form.diagnosis);
  const rdtPositive = String(form.rdt_result || '').startsWith('Positive');
  const reportableLabel = reportable === 'Malaria, confirmed'
    ? (form.rdt_result === 'Negative' ? null : rdtPositive ? 'Malaria, confirmed' : 'Malaria, clinical diagnosis (not test-confirmed)')
    : reportable;

  // Saving the consultation first means the referral letter carries what was
  // just typed, not what was on the record before the doctor sat down.
  const openReferral = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateVisitVitals(visit.id, {
        ...form,
        consultation_fee: Number(form.consultation_fee) || 0,
        doctor_name: currentUser?.full_name || ''
      });
      setReferring(true);
    } catch (err) {
      setError(err.message || 'The consultation could not be saved before referring.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={scrimRef} tabIndex={-1} className="scrim outline-none" role="dialog" aria-modal="true" aria-label="Consultation">
      {referring ? (
        <ReferralModal
          patient={patientOf(visit)}
          visit={{ ...visit, ...form }}
          onClose={() => setReferring(false)}
          onSaved={(r) => setReferred(r)}
          onPrint={(r) => { setReferring(false); setPrintReferral(r); }}
        />
      ) : null}
      {printReferral ? (
        <PrintableReferralLetter referral={printReferral} settings={settings} onClose={() => setPrintReferral(null)} />
      ) : null}
      <div className="panel max-h-[92vh] w-full max-w-3xl overflow-y-auto shadow-overlay">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line-soft bg-surface px-4 py-3">
          <div className="flex min-w-0 gap-3">
            <PatientAvatar patient={patientOf(visit)} size={40} />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-ink">{visit.patient_name}</h2>
              <p className="mt-0.5 text-2xs text-ink-3">
                <span className="font-mono"><Value>{visit.hospital_number}</Value></span>
                {' · '}<Value>{visit.age}</Value>{visit.age ? 'y' : ''} · {visit.gender}
                {visit.blood_group ? ` · ${visit.blood_group}` : ''}
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {allergic ? (
            <p className="rounded-md border border-critical-line bg-critical-wash px-3 py-2 text-sm font-semibold text-critical">
              Allergies on record: {visit.allergies}
            </p>
          ) : allergyState(visit.allergies) === 'none' ? (
            <p className="rounded-md border border-ok-line bg-ok-wash px-3 py-2 text-xs text-ink-2">
              <span className="font-semibold text-ink">No known allergies.</span> Recorded as asked and clear.
            </p>
          ) : (
            <p className="rounded-md border border-line bg-subtle px-3 py-2 text-xs text-ink-2">
              <span className="font-semibold text-ink">Allergies: not yet asked.</span> Ask before prescribing and add them to the patient record.
            </p>
          )}

          <div>
            <p className="label">Observations</p>
            <p className="mb-2 text-2xs text-ink-3">
              Leave a box empty if the measurement was not taken. An empty box records nothing; it
              does not record a normal reading.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Obs id="bp" label="BP" hint="120/80" value={form.bp} onChange={set('bp')} numeric={false}
                tone={scoreVital('systolic', systolicOf(form.bp), visit.age).tone} />
              <Obs id="pulse" label="Pulse" hint="bpm" value={form.pulse} onChange={set('pulse')}
                tone={scoreVital('pulse', form.pulse, visit.age).tone} />
              <Obs id="spo2" label="SpO₂" hint="%" value={form.spo2} onChange={set('spo2')}
                tone={scoreVital('spo2', form.spo2, visit.age).tone} />
              <Obs id="temp" label="Temp" hint="°C" value={form.temp} onChange={set('temp')}
                tone={scoreVital('temp', form.temp, visit.age).tone} />
              <Obs id="resp" label="Resp" hint="/min" value={form.resp_rate} onChange={set('resp_rate')}
                tone={scoreVital('resp', form.resp_rate, visit.age).tone} />
              <Obs id="weight" label="Weight" hint="kg" value={form.weight} onChange={set('weight')} />
            </div>
            {typeof visit.age === 'number' && visit.age < 12 ? (
              <p className="mt-2 text-2xs text-ink-3">
                This patient is under 12. Observations are recorded but not scored against adult
                early-warning ranges, which do not apply to children.
              </p>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="diagnosis">Diagnosis</label>
            <input
              id="diagnosis"
              className="field"
              value={form.diagnosis}
              onChange={set('diagnosis')}
              placeholder="Type it, or choose one below"
              maxLength={200}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DIAGNOSIS_PRESETS.map((preset) => (
                <button
                  key={preset.code}
                  type="button"
                  className="rounded border border-line bg-surface px-2 py-1 text-2xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                  onClick={() => setForm((f) => ({
                    ...f,
                    diagnosis: `${preset.code} ${preset.label}`,
                    triage_priority: f.triage_priority === 'Emergency' ? 'Emergency' : preset.priority
                  }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {reportableLabel ? (
            <p className="rounded-md border border-warn-line bg-warn-wash px-3 py-2 text-xs text-warn">
              <span className="font-semibold">Reportable: {reportableLabel}.</span> This diagnosis goes on the
              notifiable line list under Clinical registers. Urgent conditions should also be phoned through to the
              provincial health office.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="rdt">Malaria rapid test</label>
              <select id="rdt" className="field" value={form.rdt_result} onChange={set('rdt_result')}>
                {RDT_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <p className="mt-1 text-2xs text-ink-3">Recorded here so the month's positivity rate is counted, not guessed.</p>
            </div>
            <div>
              <label className="label" htmlFor="follow-up">Return on</label>
              <input id="follow-up" className="field" type="date" value={form.follow_up_date} onChange={set('follow_up_date')} />
              <p className="mt-1 text-2xs text-ink-3">Leave empty if no return is needed.</p>
            </div>
            <div>
              <label className="label" htmlFor="follow-up-note">Reason for return</label>
              <input id="follow-up-note" className="field" value={form.follow_up_note} onChange={set('follow_up_note')}
                placeholder="Repeat test, wound check, review" maxLength={120} />
            </div>
          </div>

          <div>
            <p className="label">Tests requested</p>
            <div className="flex flex-wrap gap-1.5">
              {LAB_TESTS.map((test) => {
                const on = labs.includes(test);
                return (
                  <button
                    key={test}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setLabs((l) => (on ? l.filter((x) => x !== test) : [...l, test]))}
                    className={`rounded border px-2 py-1 text-2xs font-medium transition-colors ${
                      on
                        ? 'border-info-line bg-info-wash text-info'
                        : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {test}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-2xs text-ink-3">
              Requested tests are appended to the consultation note. Results are entered when they
              come back; nothing is recorded as a result here.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="notes">Consultation note</label>
            <textarea
              id="notes"
              className="field"
              rows={4}
              value={form.doctor_notes}
              onChange={set('doctor_notes')}
            />
          </div>

          <div className="rounded-md border border-line-soft bg-subtle/60 p-3">
            <p className="label">Fitness for work</p>
            <p className="mb-2 text-2xs text-ink-3">
              For mine site workers. A decision here can be printed as a certificate from the patient record; it
              never shows the diagnosis.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="fitness">Decision</label>
                <select id="fitness" className="field" value={form.fitness_status} onChange={set('fitness_status')}>
                  {FITNESS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="fitness-until">Applies until</label>
                <input id="fitness-until" className="field" type="date" value={form.fitness_until} onChange={set('fitness_until')}
                  disabled={form.fitness_status === 'Not assessed' || form.fitness_status === 'Fit for full duty'} />
              </div>
              <div>
                <label className="label" htmlFor="fitness-restrictions">Restrictions</label>
                <input id="fitness-restrictions" className="field" value={form.fitness_restrictions} onChange={set('fitness_restrictions')}
                  placeholder="No heights, light duties, no driving" maxLength={200}
                  disabled={form.fitness_status === 'Not assessed'} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="priority">Triage priority</label>
              <select id="priority" className="field" value={form.triage_priority} onChange={set('triage_priority')}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fee">Consultation fee ({currency})</label>
              <input
                id="fee"
                className="field"
                type="number"
                min="0"
                step="0.01"
                value={form.consultation_fee}
                onChange={set('consultation_fee')}
              />
              <p className="mt-1 text-2xs text-ink-3">
                The default comes from Facility settings. Change it here only for this visit.
              </p>
            </div>
          </div>

          {error ? (
            <p className="rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-3">
            <p className="text-2xs text-ink-3">
              Recorded against {currentUser?.full_name || 'the signed-in user'}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="button" className="btn" onClick={openReferral} disabled={saving}
                title="Saves the consultation, then opens the referral">
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                {referred ? `Referred ${referred.referral_code}` : 'Refer out'}
              </button>
              <button type="button" className="btn" onClick={() => submit(false)} disabled={saving}>
                {saving ? 'Saving' : 'Save'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => submit(true)} disabled={saving}>
                Save and send to pharmacy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Adult reference ranges shown beside each observation. They match the bands
 * that scoreVital() uses, so the tint on the box and the text agree.
 */
const OBS_RANGES = {
  bp: 'Adult reference: systolic 91 to 160 mmHg',
  pulse: 'Adult reference: 51 to 110 beats per minute',
  spo2: 'Adult reference: 95% or above',
  temp: 'Adult reference: 35.0 to 37.9 °C',
  resp: 'Adult reference: 9 to 20 breaths per minute'
};

const OBS_TINT = {
  critical: 'border-critical-line bg-critical-wash',
  warn: 'border-warn-line bg-warn-wash',
  ok: '',
  neutral: ''
};

/**
 * One observation box. The whole field tints when the value sits outside the
 * adult range, the way OpenMRS and Cerner flag abnormal vitals, and the tint
 * lifts while the clinician is typing so it never fights the caret.
 */
function Obs({ id, label, hint, value, onChange, tone = 'neutral', numeric = true }) {
  const [focused, setFocused] = useState(false);
  const abnormal = tone === 'critical' || tone === 'warn';
  const tint = focused ? '' : OBS_TINT[tone] || '';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="label" htmlFor={`obs-${id}`}>{label}</label>
        {abnormal && !focused ? (
          <span
            className={`text-2xs font-semibold ${tone === 'critical' ? 'text-critical' : 'text-warn'}`}
            title="Abnormal value"
          >
            {tone === 'critical' ? 'Out of range' : 'Watch'}
          </span>
        ) : null}
      </div>
      <input
        id={`obs-${id}`}
        className={`field ${tint}`}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={hint}
        maxLength={20}
        inputMode={numeric ? 'decimal' : 'text'}
        title={OBS_RANGES[id] || undefined}
        aria-invalid={tone === 'critical' ? true : undefined}
      />
    </div>
  );
}
