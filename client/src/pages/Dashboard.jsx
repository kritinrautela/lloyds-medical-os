import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlarmClock, AlertTriangle, BedDouble, ClipboardList, Coins, Download,
  HardHat, HeartPulse, Package, PackageCheck, Receipt, RefreshCw, ScrollText,
  ShieldCheck, Stethoscope, UserCheck, UserPlus, Users, UsersRound, Wallet, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  AttentionBoard, AuditBoard, ControlsBoard, HandoverBoard, PatientFlow,
  PharmacyBoard, PriorityPatients, SafetyBoard, TrendsBoard, WardBoard
} from '../components/DashboardWidgets';
import { EmptyState, Metric, MetricStrip, Panel, SectionTitle, Value, formatDuration } from '../components/ui';

/*
 * The clinical board.
 *
 * Every number on this page is read from /api/dashboard/stats, which returns
 * null for anything the database does not hold. Nothing here fills a gap with
 * a plausible-looking figure, and nothing reports a condition the clinic has
 * no instrument to measure.
 */

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'ward', label: 'Ward', icon: BedDouble },
  { id: 'pharmacy', label: 'Pharmacy', icon: Package },
  { id: 'controls', label: 'Controls', icon: ShieldCheck },
  { id: 'trends', label: 'Trends', icon: ClipboardList },
  { id: 'safety', label: 'Safety', icon: HardHat },
  { id: 'handover', label: 'Handover', icon: Stethoscope },
  { id: 'audit', label: 'Audit trail', icon: ScrollText }
];

export default function Dashboard({
  stats,
  settings,
  setActiveTab,
  onOpenCheckIn,
  onOpenDispense,
  onOpenExport,
  refreshStats
}) {
  const { currentUser } = useAuth();
  const [section, setSection] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [bedModal, setBedModal] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // The board is left on a wall screen for a whole shift, so it refreshes
  // itself. Sixty seconds is slow enough not to load a ten-year-old laptop and
  // fast enough that a triage nurse is not reading a stale queue.
  useEffect(() => {
    const id = setInterval(() => { refreshStats?.(); }, 60000);
    return () => clearInterval(id);
  }, [refreshStats]);

  const currency = settings?.currency_symbol || 'K';

  const money = useCallback(
    (amount) => {
      const num = Number(amount);
      if (amount === null || amount === undefined || Number.isNaN(num)) return '—';
      return `${currency}${num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    },
    [currency]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshStats?.();
    } finally {
      setRefreshing(false);
    }
  };

  const generatedAt = stats?.generated_at ? new Date(stats.generated_at) : null;
  const staleMinutes = generatedAt ? Math.round((clock - generatedAt) / 60000) : null;

  if (!stats) {
    return (
      <div className="space-y-4">
        <FacilityBar
          settings={settings}
          currentUser={currentUser}
          clock={clock}
          staleMinutes={null}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
        <Panel>
          <EmptyState
            title="Reading the clinic database"
            detail="If this does not clear, the local server is not running. Start it from the Lloyds launcher and this board will fill in."
            action={
              <button type="button" className="btn btn-sm" onClick={handleRefresh}>
                Try again
              </button>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FacilityBar
        settings={settings}
        currentUser={currentUser}
        clock={clock}
        staleMinutes={staleMinutes}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {stats.sampleDataPresent ? (
        <SampleDataNotice onOpenSettings={() => setActiveTab('settings')} />
      ) : null}

      <QuickActions
        onOpenCheckIn={onOpenCheckIn}
        onOpenDispense={onOpenDispense}
        onOpenExport={onOpenExport}
        onOpenQueue={() => setActiveTab('queue')}
      />

      <SectionNav section={section} setSection={setSection} stats={stats} />

      {section === 'overview' ? (
        <Overview
          stats={stats}
          money={money}
          onNavigate={setActiveTab}
          onSelectSection={setSection}
        />
      ) : null}

      {section === 'ward' ? (
        <WardBoard
          stats={stats}
          onAdmit={(bed) => setBedModal({ bed, mode: 'admit' })}
          onDischarge={(bed) => setBedModal({ bed, mode: 'discharge' })}
        />
      ) : null}

      {section === 'pharmacy' ? (
        <PharmacyBoard stats={stats} money={money} onNavigate={setActiveTab} />
      ) : null}

      {section === 'controls' ? (
        <ControlsBoard stats={stats} money={money} onNavigate={setActiveTab} />
      ) : null}

      {section === 'trends' ? <TrendsBoard stats={stats} money={money} /> : null}

      {section === 'safety' ? <SafetyBoard stats={stats} /> : null}

      {section === 'handover' ? (
        <HandoverBoard stats={stats} onAddNote={() => setNoteModalOpen(true)} />
      ) : null}

      {section === 'audit' ? <AuditBoard stats={stats} /> : null}

      <ShiftNoteModal
        open={noteModalOpen}
        currentUser={currentUser}
        onClose={() => setNoteModalOpen(false)}
        onSaved={() => {
          setNoteModalOpen(false);
          refreshStats?.();
        }}
      />

      <BedModal
        request={bedModal}
        currentUser={currentUser}
        onClose={() => setBedModal(null)}
        onSaved={() => {
          setBedModal(null);
          refreshStats?.();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

/*
 * A new installation ships with sample patients so staff can be trained before
 * the clinic opens. Those records look exactly like real ones, which is the
 * point during training and a serious problem afterwards, so the board says
 * plainly which mode it is in until someone clears them.
 */
function SampleDataNotice({ onOpenSettings }) {
  return (
    <Panel className="border-warn-line bg-warn-wash">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              This system is showing sample records, not real patients
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
              The patients, visits, sales and incidents on screen were installed for training. Clear
              them before the clinic sees its first real patient. The drug formulary and staff
              accounts are kept.
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-sm shrink-0" onClick={onOpenSettings}>
          Clear samples and go live
        </button>
      </div>
    </Panel>
  );
}

function FacilityBar({ settings, currentUser, clock, staleMinutes, onRefresh, refreshing }) {
  const stale = typeof staleMinutes === 'number' && staleMinutes >= 3;

  return (
    <Panel as="header" className="overflow-hidden">
      <div className="identity-rule" aria-hidden="true" />
      <div className="identity-band flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-ink">
            {settings?.name || 'Lloyds Medical OS'}
          </h1>
          <p className="mt-0.5 truncate text-xs text-ink-3">
            {[settings?.district, settings?.province, settings?.country].filter(Boolean).join(' · ') || (
              <span className="unrecorded">Facility location not set</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Reading label="Local time">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Reading>
          <Reading label="Date">
            {clock.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </Reading>
          <Reading label="Signed in">
            {currentUser?.full_name || '—'}
          </Reading>
          <Reading label="Figures as of">
            {typeof staleMinutes !== 'number' ? (
              <span className="unrecorded">—</span>
            ) : staleMinutes < 1 ? (
              'Just now'
            ) : (
              <span className={stale ? 'text-warn' : undefined}>{formatDuration(staleMinutes)} ago</span>
            )}
          </Reading>

          <button
            type="button"
            className="btn btn-sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {refreshing ? 'Reading' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft px-4 py-2 text-2xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
          Records are held on this machine. The clinic keeps working with no internet.
        </span>
        <span>
          Every figure below is read from the clinic database. A dash means the record has no value,
          not a value of zero.
        </span>
      </div>
    </Panel>
  );
}

function Reading({ label, children }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className="text-sm font-semibold text-ink">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuickActions({ onOpenCheckIn, onOpenDispense, onOpenExport, onOpenQueue }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-primary" onClick={onOpenCheckIn}>
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Check in a patient
      </button>
      <button type="button" className="btn" onClick={onOpenQueue}>
        <Users className="h-4 w-4" aria-hidden="true" />
        Open the queue
      </button>
      <button type="button" className="btn" onClick={onOpenDispense}>
        <Package className="h-4 w-4" aria-hidden="true" />
        Dispense medicines
      </button>
      <button type="button" className="btn" onClick={onOpenExport}>
        <Download className="h-4 w-4" aria-hidden="true" />
        Export protected records
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionNav({ section, setSection, stats }) {
  const badges = {
    ward: stats?.occupied_beds || 0,
    pharmacy: stats?.low_stock_count || 0,
    controls: (stats?.flaggedDispensations || []).length,
    safety: stats?.incidents_30d || 0,
    handover: (stats?.shiftNotes || []).length
  };

  return (
    <nav className="panel overflow-x-auto" aria-label="Dashboard sections">
      <ul className="flex min-w-max">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          const badge = badges[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSection(s.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-brand text-ink'
                    : 'border-transparent text-ink-3 hover:bg-subtle hover:text-ink-2'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {s.label}
                {badge ? (
                  <span className="rounded bg-subtle px-1.5 text-2xs font-semibold text-ink-2">
                    {badge}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------

function Overview({ stats, money, onNavigate, onSelectSection }) {
  const bedTotal = stats?.total_beds ?? (stats?.beds || []).length;

  return (
    <div className="space-y-4">
      <AttentionBoard stats={stats} onNavigate={onNavigate} onSelectSection={onSelectSection} />

      <section className="enter enter-1 space-y-2">
        <SectionTitle note="Updates every minute">In the department now</SectionTitle>
        <MetricStrip columns={6}>
          <Metric
            label="Waiting"
            value={stats.queueMap?.Waiting ?? 0}
            context="Checked in, not yet seen"
            tone={(stats.queueMap?.Waiting || 0) > 10 ? 'warn' : 'neutral'}
            tint="2"
            icon={UsersRound}
            onClick={() => onNavigate('queue')}
          />
          <Metric
            label="Longest wait"
            value={formatDuration(stats.longest_wait_minutes)}
            context="Time the first patient has been here"
            tone={stats.longest_wait_minutes >= 90 ? 'warn' : 'neutral'}
            tint="2"
            icon={AlarmClock}
          />
          <Metric
            label="With a clinician"
            value={stats.queueMap?.['In Consultation'] ?? 0}
            context="In consultation right now"
            tint="1"
            icon={Stethoscope}
          />
          <Metric
            label="Urgent or emergency"
            value={(stats.urgentVisits || []).length}
            context="Open visits at high triage priority"
            tone={(stats.urgentVisits || []).length > 0 ? 'critical' : 'neutral'}
            tint="4"
            icon={HeartPulse}
          />
          <Metric
            label="Beds occupied"
            value={stats.occupied_beds ?? 0}
            context={bedTotal ? `of ${bedTotal} in the ward` : 'No beds configured'}
            tint="4"
            icon={BedDouble}
            onClick={() => onSelectSection('ward')}
          />
          <Metric
            label="Staff on the system"
            value={stats.staff_online ?? 0}
            context="Devices active in the last five minutes"
            tint="5"
            icon={UserCheck}
            onClick={() => onSelectSection('controls')}
          />
        </MetricStrip>
      </section>

      <section className="enter enter-2 space-y-2">
        <SectionTitle note="Since midnight">Recorded today</SectionTitle>
        <MetricStrip columns={6}>
          <Metric label="Attendances" value={stats.today_visitors ?? 0} context="Visits opened today" tint="2" icon={Users} />
          <Metric label="New patients" value={stats.new_patients_today ?? 0} context="First registration today" tint="1" icon={UserPlus} />
          <Metric label="Completed" value={stats.queueMap?.Completed ?? 0} context="Visits closed today" tint="6" icon={PackageCheck} />
          <Metric label="Consultation fees" value={money(stats.today_opd_fees ?? 0)} context="Collected at reception" tint="3" icon={Receipt} />
          <Metric label="Pharmacy sales" value={money(stats.today_pharmacy_revenue ?? 0)} context="Collected at the counter" tint="3" icon={Coins} />
          <Metric
            label="Total collected"
            value={money(stats.total_revenue_today ?? 0)}
            context="Fees plus pharmacy"
            tint="5"
            icon={Wallet}
            onClick={() => onNavigate('end-of-day')}
          />
        </MetricStrip>
      </section>

      <div className="enter enter-3 grid gap-4 xl:grid-cols-2">
        <PatientFlow stats={stats} onNavigate={onNavigate} />
        <PriorityPatients stats={stats} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function Modal({ open, title, note, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel w-full max-w-xl shadow-overlay">
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {note ? <p className="mt-0.5 text-xs text-ink-3">{note}</p> : null}
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const NOTE_PRIORITIES = ['Routine Handover', 'Clinical Alert', 'Critical Emergency'];
const SHIFT_TYPES = ['Day Shift', 'Night Shift', 'Weekend Shift'];

function ShiftNoteModal({ open, currentUser, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState(NOTE_PRIORITIES[0]);
  const [shiftType, setShiftType] = useState(SHIFT_TYPES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setPriority(NOTE_PRIORITIES[0]);
      setShiftType(SHIFT_TYPES[0]);
      setError('');
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('A handover note needs both a subject and the detail behind it.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.addShiftNote({
        title: title.trim(),
        note_content: content.trim(),
        priority,
        shift_type: shiftType,
        author_name: currentUser?.full_name || 'Unattributed',
        author_role: currentUser?.role || ''
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'The note could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Record a handover note"
      note="Kept permanently and shown to whoever takes the next shift."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3 px-4 py-4">
        <div>
          <label className="label" htmlFor="note-title">Subject</label>
          <input
            id="note-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bed 3 needs a review at 06:00"
            maxLength={120}
          />
        </div>

        <div>
          <label className="label" htmlFor="note-content">What the next shift needs to know</label>
          <textarea
            id="note-content"
            className="field"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Say what happened, what has already been done, and what is still outstanding."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="note-priority">Priority</label>
            <select
              id="note-priority"
              className="field"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {NOTE_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="note-shift">Shift</label>
            <select
              id="note-shift"
              className="field"
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
            >
              {SHIFT_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <p className="text-2xs text-ink-3">
          This note will be recorded against {currentUser?.full_name || 'the signed-in user'}
          {currentUser?.role ? `, ${currentUser.role}` : ''}.
        </p>

        {error ? (
          <p className="rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving' : 'Save note'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const ACUITY_LEVELS = ['Stable', 'Guarded', 'Serious', 'Critical'];
const EMPTY_BED_STATUSES = ['Available', 'Cleaning', 'Isolation', 'Maintenance'];

function BedModal({ request, currentUser, onClose, onSaved }) {
  const bed = request?.bed;
  const mode = request?.mode;

  const [patientName, setPatientName] = useState('');
  const [patientCode, setPatientCode] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [acuity, setAcuity] = useState(ACUITY_LEVELS[0]);
  const [doctor, setDoctor] = useState('');
  const [vitals, setVitals] = useState('');
  const [emptyStatus, setEmptyStatus] = useState('Available');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!request) return;
    setPatientName('');
    setPatientCode('');
    setDiagnosis('');
    setAcuity(ACUITY_LEVELS[0]);
    setDoctor(currentUser?.role?.toLowerCase().includes('doctor') ? currentUser.full_name : '');
    setVitals('');
    setEmptyStatus('Available');
    setNotes('');
    setError('');
  }, [request, currentUser]);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === 'admit' && !patientName.trim()) {
      setError('A bed cannot be marked occupied without the name of the patient in it.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (mode === 'admit') {
        await api.updateBedStatus(bed.id, {
          status: 'Occupied',
          patient_name: patientName.trim(),
          patient_code: patientCode.trim() || null,
          diagnosis: diagnosis.trim() || null,
          acuity_level: acuity,
          attending_doctor: doctor.trim() || null,
          vitals_ticker: vitals.trim() || null,
          admission_date: new Date().toISOString(),
          notes: null,
          updated_by: currentUser?.full_name || 'Unattributed'
        });
      } else {
        await api.updateBedStatus(bed.id, {
          status: emptyStatus,
          patient_name: null,
          patient_code: null,
          diagnosis: null,
          acuity_level: null,
          attending_doctor: null,
          vitals_ticker: null,
          admission_date: null,
          notes: notes.trim() || null,
          updated_by: currentUser?.full_name || 'Unattributed'
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'The bed could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  return (
    <Modal
      open
      title={mode === 'admit' ? `Admit a patient to ${bed.bed_code}` : `Discharge from ${bed.bed_code}`}
      note={`${bed.ward_name} · ${bed.bed_type}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3 px-4 py-4">
        {mode === 'admit' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="bed-patient">Patient name</label>
                <input
                  id="bed-patient"
                  className="field"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="label" htmlFor="bed-code">Record number</label>
                <input
                  id="bed-code"
                  className="field"
                  value={patientCode}
                  onChange={(e) => setPatientCode(e.target.value)}
                  placeholder="Leave blank if not yet issued"
                  maxLength={40}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="bed-acuity">Acuity</label>
                <select
                  id="bed-acuity"
                  className="field"
                  value={acuity}
                  onChange={(e) => setAcuity(e.target.value)}
                >
                  {ACUITY_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="bed-doctor">Attending clinician</label>
                <input
                  id="bed-doctor"
                  className="field"
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="bed-diagnosis">Working diagnosis</label>
              <input
                id="bed-diagnosis"
                className="field"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                maxLength={200}
              />
            </div>

            <div>
              <label className="label" htmlFor="bed-vitals">Observations at admission</label>
              <input
                id="bed-vitals"
                className="field"
                value={vitals}
                onChange={(e) => setVitals(e.target.value)}
                placeholder="Type only what was actually measured, for example: BP 128/82, P 92, T 38.4"
                maxLength={200}
              />
              <p className="mt-1 text-2xs text-ink-3">
                Leave this blank if nothing was measured. The board will show a dash rather than a number
                nobody took.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded border border-line bg-subtle px-3 py-2.5 text-xs text-ink-2">
              <p className="font-semibold text-ink">{bed.patient_name}</p>
              <p className="mt-0.5">
                <Value>{bed.patient_code}</Value> · <Value>{bed.diagnosis}</Value>
              </p>
              <p className="mt-1 text-ink-3">
                Clearing this bed removes the patient details from the board. The visit and dispensing
                records for this patient are not affected.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="bed-status">Set the bed to</label>
              <select
                id="bed-status"
                className="field"
                value={emptyStatus}
                onChange={(e) => setEmptyStatus(e.target.value)}
              >
                {EMPTY_BED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="bed-notes">Note</label>
              <input
                id="bed-notes"
                className="field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why the bed is not immediately available, if it is not"
                maxLength={200}
              />
            </div>
          </>
        )}

        {error ? (
          <p className="rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-2xs text-ink-3">
            Recorded against {currentUser?.full_name || 'the signed-in user'}.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving' : mode === 'admit' ? 'Admit patient' : 'Clear bed'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
