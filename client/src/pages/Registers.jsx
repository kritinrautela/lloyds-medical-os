import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, FileBarChart, Loader2, Printer, Send, ShieldAlert, UserCheck
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  EmptyState, Metric, MetricStrip, Panel, PanelHead, Pill, SectionTitle, Value, formatDateTime
} from '../components/ui';
import { REFERRAL_OUTCOMES } from '../lib/publicHealth';
import PrintableReferralLetter from '../components/PrintableReferralLetter';
import { PrintFrame, FacilityHeader, longDate } from '../components/PrintFrame';

/*
 * Clinical registers.
 *
 * Four lists a clinic in this district has to keep and could not keep on the
 * queue screen: who is due back, who has been sent away and not yet accounted
 * for, which diagnoses must be reported to the provincial health office, and
 * the month's figures in the shape the health information return asks for.
 * Every figure is read from the records; nothing is estimated.
 */

const TABS = [
  { id: 'returns', label: 'Returns due', icon: CalendarClock },
  { id: 'referrals', label: 'Referrals', icon: Send },
  { id: 'notifiable', label: 'Reportable diseases', icon: ShieldAlert },
  { id: 'monthly', label: 'Monthly return', icon: FileBarChart }
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function thisMonth() {
  return today().slice(0, 7);
}
function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Registers({ settings, onCheckInPatient, initialTab = 'returns' }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  return (
    <div className="space-y-4">
      <SectionTitle note="Returns, referrals, reportable diseases and the monthly return, read from the records">
        Clinical registers
      </SectionTitle>

      <nav className="panel flex overflow-x-auto" aria-label="Register">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                on ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              <t.icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === 'returns' ? <ReturnsDue onCheckInPatient={onCheckInPatient} /> : null}
      {tab === 'referrals' ? <ReferralsRegister settings={settings} /> : null}
      {tab === 'notifiable' ? <NotifiableRegister settings={settings} /> : null}
      {tab === 'monthly' ? <MonthlyReturn settings={settings} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------- returns due

function ReturnsDue({ onCheckInPatient }) {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getFollowUps(days)
      .then((res) => setRows(res.followUps || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [days]);

  const overdue = rows.filter((r) => r.state === 'Overdue').length;
  const dueToday = rows.filter((r) => r.state === 'Due today').length;

  return (
    <div className="space-y-4">
      <MetricStrip columns={3}>
        <Metric label="Overdue" value={overdue} tone={overdue ? 'critical' : 'neutral'} context="Return date passed, not seen since" />
        <Metric label="Due today" value={dueToday} tone={dueToday ? 'warn' : 'neutral'} context="Asked to come back today" />
        <Metric label="Coming up" value={rows.length - overdue - dueToday} context={`Within the next ${days} days`} tint="1" />
      </MetricStrip>

      <Panel>
        <PanelHead title="Patients asked to return" note="Set at consultation. A patient drops off the list when they attend again.">
          <select className="field w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="How far ahead to look">
            <option value={0}>Due and overdue only</option>
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
          </select>
        </PanelHead>
        {loading ? <Loading /> : rows.length === 0 ? (
          <EmptyState title="Nobody is due back" detail="Return dates set at consultation appear here, overdue first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return date</th><th>Patient</th><th>Reason for return</th><th>Last diagnosis</th><th>Seen by</th><th>Contact</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <span className="block">{r.follow_up_date}</span>
                      <Pill tone={r.state === 'Overdue' ? 'critical' : r.state === 'Due today' ? 'warn' : 'neutral'}>
                        {r.state === 'Overdue' ? `${Math.abs(r.days_until)} ${Math.abs(r.days_until) === 1 ? 'day' : 'days'} overdue` : r.state}
                      </Pill>
                    </td>
                    <td>
                      <span className="block font-medium text-ink">{r.patient_name}</span>
                      <span className="block font-mono text-2xs text-ink-3">{r.hospital_number} · {r.age}y {r.gender}</span>
                    </td>
                    <td className="max-w-[16rem]"><Value>{r.follow_up_note}</Value></td>
                    <td className="max-w-[14rem]"><Value>{r.diagnosis}</Value></td>
                    <td className="whitespace-nowrap"><Value>{r.doctor_name}</Value></td>
                    <td className="whitespace-nowrap text-xs"><Value>{r.phone}</Value><span className="block text-2xs text-ink-3"><Value>{r.address_or_village}</Value></span></td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" className="btn btn-sm" onClick={() => onCheckInPatient?.({ id: r.patient_id, full_name: r.patient_name, hospital_number: r.hospital_number })}>
                        <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> Check in
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
  );
}

// ------------------------------------------------------------------ referrals

function ReferralsRegister({ settings }) {
  const { currentUser, can } = useAuth();
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getReferrals({ status })
      .then((res) => setRows(res.referrals || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const setOutcome = async (r, outcome) => {
    if (outcome === r.outcome) return;
    const note = outcome === 'Awaiting outcome' ? '' : window.prompt(`Outcome for ${r.patient_name}: ${outcome}. Add a note (optional).`, r.outcome_note || '');
    if (note === null) return;
    setBusy(r.id);
    setError('');
    try {
      await api.updateReferralOutcome(r.id, outcome, note);
      load();
    } catch (err) {
      setError(err.message || 'The outcome could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const canClose = typeof can === 'function' ? can('queue.triage') : true;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead title="Referrals" note="Made at consultation or from the patient record. Open until an outcome is recorded.">
          <select className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Which referrals to show">
            <option value="open">Awaiting an outcome</option>
            <option value="closed">Outcome recorded</option>
            <option value="all">All referrals</option>
          </select>
        </PanelHead>
        {error ? <p className="border-b border-critical-line bg-critical-wash px-4 py-2 text-xs text-critical">{error}</p> : null}
        {loading ? <Loading /> : rows.length === 0 ? (
          <EmptyState title={status === 'open' ? 'No referral is waiting for an outcome' : 'No referrals to show'}
            detail="A referral is made from the consultation screen or the patient record." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Referred</th><th>Patient</th><th>Sent to</th><th>Reason</th><th>By</th><th>Outcome</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <span className="block">{formatDateTime(r.created_at)}</span>
                      <span className="block font-mono text-2xs text-ink-3">{r.referral_code}</span>
                      <Pill tone={r.urgency === 'Emergency' ? 'critical' : r.urgency === 'Urgent' ? 'warn' : 'neutral'}>{r.urgency}</Pill>
                    </td>
                    <td>
                      <span className="block font-medium text-ink">{r.patient_name}</span>
                      <span className="block font-mono text-2xs text-ink-3">{r.hospital_number} · {r.age}y {r.gender}</span>
                    </td>
                    <td className="max-w-[14rem]">{r.referred_to}{r.department ? <span className="block text-2xs text-ink-3">{r.department}</span> : null}</td>
                    <td className="max-w-[18rem] text-xs">{r.reason}</td>
                    <td className="whitespace-nowrap"><Value>{r.referred_by}</Value></td>
                    <td className="whitespace-nowrap">
                      {canClose ? (
                        <select className="field w-auto" value={r.outcome} disabled={busy === r.id}
                          onChange={(e) => setOutcome(r, e.target.value)} aria-label={`Outcome for ${r.patient_name}`}>
                          {REFERRAL_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : <Pill tone={r.outcome === 'Awaiting outcome' ? 'warn' : 'ok'}>{r.outcome}</Pill>}
                      {r.outcome_by ? <span className="block text-2xs text-ink-3">{r.outcome_by}, {formatDateTime(r.outcome_at)}</span> : null}
                      {r.outcome_note ? <span className="block max-w-[14rem] text-2xs text-ink-2">{r.outcome_note}</span> : null}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" className="btn btn-sm" onClick={() => setPrinting(r)}>
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Letter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {printing ? <PrintableReferralLetter referral={printing} settings={settings} onClose={() => setPrinting(null)} /> : null}
      <p className="text-2xs text-ink-3">Signed in as {currentUser?.full_name}. Outcomes are recorded against your name.</p>
    </div>
  );
}

// ------------------------------------------------------------ notifiable list

function NotifiableRegister({ settings }) {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getNotifiableCases(from, to)
      .then((res) => setRows(res.cases || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  const byCondition = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[r.notifiable_condition] = (m[r.notifiable_condition] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const table = (
    <table className="data-table">
      <thead>
        <tr><th>Date</th><th>Condition</th><th>Patient</th><th>Age / sex</th><th>Village</th><th>Diagnosis as written</th><th>Test</th><th>Seen by</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap">{r.visit_date}<span className="block font-mono text-2xs text-ink-3">{r.visit_code}</span></td>
            <td className="font-medium text-ink">{r.notifiable_condition}</td>
            <td>{r.patient_name}<span className="block font-mono text-2xs text-ink-3">{r.hospital_number}</span></td>
            <td className="whitespace-nowrap">{r.age}y {r.gender}</td>
            <td className="text-xs"><Value>{r.address_or_village}</Value>{r.district ? <span className="block text-2xs text-ink-3">{r.district}</span> : null}</td>
            <td className="max-w-[14rem] text-xs"><Value>{r.diagnosis}</Value></td>
            <td className="whitespace-nowrap text-xs"><Value>{r.rdt_result && r.rdt_result !== 'Not done' ? r.rdt_result : null}</Value></td>
            <td className="whitespace-nowrap"><Value>{r.doctor_name}</Value></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead title="Reportable diseases line list" note="Diagnoses that match the notifiable list, flagged from the clinician's own words at consultation">
          <label className="text-2xs text-ink-3" htmlFor="nl-from">From</label>
          <input id="nl-from" type="date" className="field w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="text-2xs text-ink-3" htmlFor="nl-to">To</label>
          <input id="nl-to" type="date" className="field w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="btn btn-sm" onClick={() => setPrinting(true)} disabled={rows.length === 0}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print line list
          </button>
        </PanelHead>
        {byCondition.length ? (
          <div className="flex flex-wrap gap-1.5 border-b border-line-soft px-4 py-2">
            {byCondition.map(([c, n]) => <Pill key={c} tone={n ? 'warn' : 'neutral'}>{c}: {n}</Pill>)}
          </div>
        ) : null}
        {loading ? <Loading /> : rows.length === 0 ? (
          <EmptyState title="No reportable diagnosis in this period"
            detail="A case appears here when a diagnosis recorded at consultation matches the notifiable list. Malaria is listed as confirmed only with a positive test." />
        ) : <div className="overflow-x-auto">{table}</div>}
        <p className="border-t border-line-soft px-4 py-2 text-2xs leading-relaxed text-ink-3">
          The list of conditions is this clinic's working list. The provincial health office confirms
          what must be reported and how soon; an urgent condition should be phoned through, not held for
          the monthly return.
        </p>
      </Panel>

      {printing ? (
        <PrintFrame title="Reportable diseases line list" subtitle={`${from} to ${to}`} onClose={() => setPrinting(false)} printLabel="Print" wide>
          <FacilityHeader settings={settings} documentTitle="Notifiable disease line list" reference={`${from} to ${to}`} />
          <p className="mt-4 text-sm text-[#334155]">
            {rows.length} {rows.length === 1 ? 'case' : 'cases'} recorded between {longDate(from)} and {longDate(to)}. Reported by {settings?.name || 'the clinic'}.
          </p>
          <div className="mt-3 text-xs [&_table]:w-full [&_td]:border-b [&_td]:border-[#e2e8f0] [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:border-[#0f172a] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
            {table}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-10">
            <div><div className="h-10 border-b border-[#0f172a]" /><p className="mt-1 text-xs text-[#475569]">Officer in charge</p></div>
            <div><div className="h-10 border-b border-[#0f172a]" /><p className="mt-1 text-xs text-[#475569]">Date sent to the provincial health office</p></div>
          </div>
        </PrintFrame>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------- monthly return

function MonthlyReturn({ settings }) {
  const [month, setMonth] = useState(thisMonth());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    setLoading(true);
    setError('');
    api.getMonthlyReport(month)
      .then(setReport)
      .catch((err) => { setReport(null); setError(err.message || 'The report could not be read.'); })
      .finally(() => setLoading(false));
  }, [month]);

  const monthLabel = /^\d{4}-\d{2}$/.test(month)
    ? new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : month;
  const currency = settings?.currency_symbol || 'K';

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead title={`Monthly return, ${monthLabel}`} note="Attendances, diagnoses, tests, referrals and money, counted from the records for the month">
          <input type="month" className="field w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
          <button type="button" className="btn btn-sm" onClick={() => setPrinting(true)} disabled={!report}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print the return
          </button>
        </PanelHead>
        {error ? <p className="px-4 py-3 text-xs text-critical">{error}</p> : null}
        {loading ? <Loading /> : report ? <MonthlySheet report={report} currency={currency} /> : null}
      </Panel>

      {printing && report ? (
        <PrintFrame title={`Monthly return, ${monthLabel}`} onClose={() => setPrinting(false)} printLabel="Print" wide>
          <FacilityHeader settings={settings} documentTitle="Monthly health return" reference={monthLabel} />
          <p className="mt-3 text-xs text-[#475569]">
            Period {longDate(report.from)} to {longDate(report.to)}. Prepared {new Date(report.generated_at).toLocaleString('en-GB')} from the clinic records.
            {settings?.doctor_in_charge ? ` Officer in charge: ${settings.doctor_in_charge}.` : ''}
          </p>
          <div className="mt-3 text-xs [&_.metric-cell]:border [&_.metric-cell]:border-[#e2e8f0] [&_table]:w-full [&_td]:border-b [&_td]:border-[#e2e8f0] [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:border-[#0f172a] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
            <MonthlySheet report={report} currency={currency} print />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-10">
            <div><div className="h-10 border-b border-[#0f172a]" /><p className="mt-1 text-xs text-[#475569]">Prepared by</p></div>
            <div><div className="h-10 border-b border-[#0f172a]" /><p className="mt-1 text-xs text-[#475569]">Officer in charge</p></div>
          </div>
        </PrintFrame>
      ) : null}
    </div>
  );
}

function MonthlySheet({ report, currency, print = false }) {
  const a = report.attendances;
  const m = report.malaria;
  const cell = print ? 'px-3 py-2' : 'px-4 py-3.5';
  const Block = ({ title, children }) => (
    <section className={print ? 'mt-4 break-inside-avoid' : 'border-t border-line-soft'}>
      <h3 className={`${print ? 'mb-1 text-xs font-bold uppercase tracking-wide text-[#0f172a]' : 'px-4 pt-3 text-2xs font-semibold uppercase tracking-wide text-ink-3'}`}>{title}</h3>
      {children}
    </section>
  );
  const Num = ({ children }) => <td className="num tabular-nums">{children}</td>;

  return (
    <div>
      <div className={`grid grid-cols-2 gap-px bg-line-soft sm:grid-cols-4 lg:grid-cols-6 ${print ? 'gap-2 bg-transparent' : ''}`}>
        {[
          ['Attendances', a.total, 'Visits recorded'],
          ['Patients seen', a.distinct_patients, 'Different people'],
          ['New registrations', a.new_patients, 'First registered this month'],
          ['Emergency', a.emergency, 'Triaged emergency'],
          ['Referred out', report.referrals.total, `${report.referrals.awaiting} awaiting outcome`],
          ['Reportable cases', report.notifiable.reduce((s, n) => s + n.cases, 0), 'On the line list']
        ].map(([label, value, context]) => (
          <div key={label} className={`metric-cell bg-surface ${cell}`}>
            <p className="text-2xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">{value}</p>
            <p className="text-2xs text-ink-3">{context}</p>
          </div>
        ))}
      </div>

      <Block title="Attendances by sex and age">
        <table className="data-table">
          <thead><tr><th>Age band</th><th className="num">Male</th><th className="num">Female</th><th className="num">Total</th></tr></thead>
          <tbody>
            {a.by_age_band.map((b) => (
              <tr key={b.band}><td>{b.band}</td><Num>{b.Male}</Num><Num>{b.Female}</Num><Num>{b.total}</Num></tr>
            ))}
            <tr className="font-semibold"><td>All ages</td><Num>{a.by_sex.Male}</Num><Num>{a.by_sex.Female}</Num><Num>{a.total}</Num></tr>
          </tbody>
        </table>
      </Block>

      <div className={print ? '' : 'grid lg:grid-cols-2'}>
        <Block title="Diagnoses recorded, most frequent first">
          {report.diagnoses.length === 0 ? <p className="px-4 py-3 text-xs text-ink-3">No diagnosis was recorded this month.</p> : (
            <table className="data-table">
              <thead><tr><th>Diagnosis as written</th><th className="num">Cases</th></tr></thead>
              <tbody>{report.diagnoses.map((d) => <tr key={d.diagnosis}><td>{d.diagnosis}</td><Num>{d.cases}</Num></tr>)}</tbody>
            </table>
          )}
        </Block>
        <Block title="Reportable conditions">
          {report.notifiable.length === 0 ? <p className="px-4 py-3 text-xs text-ink-3">No reportable condition was flagged this month.</p> : (
            <table className="data-table">
              <thead><tr><th>Condition</th><th className="num">Cases</th></tr></thead>
              <tbody>{report.notifiable.map((n) => <tr key={n.condition}><td>{n.condition}</td><Num>{n.cases}</Num></tr>)}</tbody>
            </table>
          )}
        </Block>
      </div>

      <div className={print ? '' : 'grid lg:grid-cols-3'}>
        <Block title="Malaria testing">
          <table className="data-table">
            <tbody>
              <tr><td>Rapid tests done</td><Num>{m.done}</Num></tr>
              <tr><td>Positive, any species</td><Num>{m.positive}</Num></tr>
              <tr><td>P. falciparum</td><Num>{m.falciparum}</Num></tr>
              <tr><td>P. vivax</td><Num>{m.vivax}</Num></tr>
              <tr><td>Mixed</td><Num>{m.mixed}</Num></tr>
              <tr><td>Negative</td><Num>{m.negative}</Num></tr>
              <tr><td>Positivity rate</td><Num>{m.done ? `${Math.round((m.positive / m.done) * 100)}%` : '—'}</Num></tr>
            </tbody>
          </table>
        </Block>
        <Block title="Referrals">
          <table className="data-table">
            <tbody>
              <tr><td>Referred out</td><Num>{report.referrals.total}</Num></tr>
              <tr><td>Emergency referrals</td><Num>{report.referrals.emergency}</Num></tr>
              <tr><td>Awaiting outcome</td><Num>{report.referrals.awaiting}</Num></tr>
              <tr><td>Did not attend</td><Num>{report.referrals.did_not_attend}</Num></tr>
              <tr><td>Died</td><Num>{report.referrals.died}</Num></tr>
              {report.referrals.destinations.map((d) => <tr key={d.referred_to}><td className="pl-6 text-ink-2">{d.referred_to}</td><Num>{d.n}</Num></tr>)}
            </tbody>
          </table>
        </Block>
        <Block title="Fitness for work and injuries">
          <table className="data-table">
            <tbody>
              <tr><td>Fitness assessments</td><Num>{report.fitness.assessed}</Num></tr>
              <tr><td>Fit for full duty</td><Num>{report.fitness.fit}</Num></tr>
              <tr><td>Fit with restrictions</td><Num>{report.fitness.restricted}</Num></tr>
              <tr><td>Unfit for work</td><Num>{report.fitness.unfit}</Num></tr>
              {report.incidents.map((i) => <tr key={i.severity}><td>Incidents: {i.severity}</td><Num>{i.n}</Num></tr>)}
              {report.incidents.length === 0 ? <tr><td>Workplace incidents</td><Num>0</Num></tr> : null}
              <tr><td>Return visits set</td><Num>{a.follow_ups_set}</Num></tr>
            </tbody>
          </table>
        </Block>
      </div>

      <div className={print ? '' : 'grid lg:grid-cols-2'}>
        <Block title="Medicines dispensed, by quantity">
          {report.topMedicines.length === 0 ? <p className="px-4 py-3 text-xs text-ink-3">Nothing was dispensed this month.</p> : (
            <table className="data-table">
              <thead><tr><th>Medicine</th><th className="num">Units</th><th className="num">Hand-overs</th></tr></thead>
              <tbody>{report.topMedicines.map((d) => <tr key={d.drug_name}><td>{d.drug_name}</td><Num>{d.quantity}</Num><Num>{d.hand_overs}</Num></tr>)}</tbody>
            </table>
          )}
        </Block>
        <Block title="Money and shift closes">
          <table className="data-table">
            <tbody>
              <tr><td>Consultation fees recorded</td><Num>{currency} {report.money.fees.toFixed(2)}</Num></tr>
              <tr><td>Pharmacy collected</td><Num>{currency} {report.money.pharmacy.toFixed(2)}</Num></tr>
              <tr><td>Price reductions given</td><Num>{currency} {report.money.reductions.toFixed(2)}</Num></tr>
              <tr><td>Medicine hand-overs</td><Num>{report.money.hand_overs}</Num></tr>
              <tr><td>Items dispensed</td><Num>{report.money.items}</Num></tr>
              <tr><td>Trading days with attendances</td><Num>{report.trading_days}</Num></tr>
              <tr><td>Shift closes filed</td><Num>{report.shift_closes}</Num></tr>
            </tbody>
          </table>
        </Block>
      </div>
      <p className={`${print ? 'mt-4' : 'px-4 py-3'} text-2xs leading-relaxed text-ink-3`}>
        A blank or dash means nothing was recorded, not zero. Diagnoses are counted as the clinician wrote
        them, so the same condition spelt two ways appears twice.
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-ink-3">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Reading the records
    </div>
  );
}

