import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BedDouble, Boxes, CalendarClock, CheckCircle2,
  Cloud, CloudOff, CircleSlash, FileSpreadsheet, HardHat, Lock, Package,
  PackageMinus, ScrollText, ShieldAlert, ShieldCheck, Sparkles, Users, Wallet,
  Warehouse
} from 'lucide-react';
import {
  Bar, Donut, EmptyState, Metric, MetricStrip, Panel, PanelHead, Pill, Value,
  Vital, formatDateTime, formatDuration, hasAllergy, scoreVital, systolicOf
} from './ui';

/*
 * Dashboard sections.
 *
 * Every figure rendered here comes from /api/dashboard/stats. Where the
 * database holds no value the component prints an em dash. There are no
 * placeholder patients, no simulated telemetry and no environmental readings
 * the clinic has no instrument to measure.
 */

const QUEUE_STAGES = [
  { key: 'Waiting', label: 'Waiting', tokPisin: 'Wetim' },
  { key: 'Triage / Vitals', label: 'Triage and vitals' },
  { key: 'In Consultation', label: 'With the doctor', tokPisin: 'Wantaim dokta' },
  { key: 'At Pharmacy', label: 'At pharmacy', tokPisin: 'Kisim marasin' },
  { key: 'Completed', label: 'Completed today' }
];

// ---------------------------------------------------------------------------
// Attention board — only ever built from conditions that are actually true
// ---------------------------------------------------------------------------

export function AttentionBoard({ stats, onNavigate, onSelectSection }) {
  const items = [];

  const emergencies = (stats?.urgentVisits || []).filter((v) => v.triage_priority === 'Emergency');
  if (emergencies.length > 0) {
    items.push({
      id: 'emergency',
      tone: 'critical',
      icon: ShieldAlert,
      title: `${emergencies.length} emergency ${emergencies.length === 1 ? 'patient' : 'patients'} in the queue`,
      detail: emergencies.map((v) => v.patient_name).join(', '),
      action: 'Open queue',
      onAction: () => onNavigate('queue')
    });
  }

  const urgent = (stats?.urgentVisits || []).filter((v) => v.triage_priority === 'Urgent');
  if (urgent.length > 0) {
    items.push({
      id: 'urgent',
      tone: 'warn',
      icon: AlertTriangle,
      title: `${urgent.length} urgent ${urgent.length === 1 ? 'patient' : 'patients'} waiting`,
      detail: urgent.map((v) => `${v.patient_name} (${formatDuration(v.waiting_minutes) || '—'})`).join(', '),
      action: 'Open queue',
      onAction: () => onNavigate('queue')
    });
  }

  if (stats?.out_of_stock_count > 0) {
    const names = (stats.lowStockDrugs || [])
      .filter((d) => d.stock_quantity <= 0)
      .map((d) => d.name)
      .slice(0, 4)
      .join(', ');
    items.push({
      id: 'stockout',
      tone: 'critical',
      icon: Package,
      title: `${stats.out_of_stock_count} ${stats.out_of_stock_count === 1 ? 'medicine is' : 'medicines are'} out of stock`,
      detail: names,
      action: 'Open formulary',
      onAction: () => onNavigate('pharmacy')
    });
  }

  if (stats?.expired_count > 0) {
    items.push({
      id: 'expired',
      tone: 'critical',
      icon: Package,
      title: `${stats.expired_count} stocked ${stats.expired_count === 1 ? 'item is' : 'items are'} past their expiry date`,
      detail: 'Expired stock must be quarantined before the next dispensing round.',
      action: 'Open formulary',
      onAction: () => onNavigate('pharmacy')
    });
  }

  const lowOnly = (stats?.low_stock_count || 0) - (stats?.out_of_stock_count || 0);
  if (lowOnly > 0) {
    items.push({
      id: 'lowstock',
      tone: 'warn',
      icon: Package,
      title: `${lowOnly} ${lowOnly === 1 ? 'medicine is' : 'medicines are'} below the reorder level`,
      detail: (stats.lowStockDrugs || [])
        .filter((d) => d.stock_quantity > 0)
        .slice(0, 4)
        .map((d) => `${d.name} (${d.stock_quantity} left)`)
        .join(', '),
      action: 'Open formulary',
      onAction: () => onNavigate('pharmacy')
    });
  }

  const overdueReturns = stats?.follow_ups_overdue || 0;
  const dueReturns = stats?.follow_ups_due_today || 0;
  if (overdueReturns + dueReturns > 0) {
    const names = (stats.followUpsDue || []).slice(0, 4).map((f) => `${f.patient_name} (${f.follow_up_date})`).join(', ');
    items.push({
      id: 'returns',
      tone: overdueReturns > 0 ? 'warn' : 'neutral',
      icon: CalendarClock,
      title: overdueReturns > 0
        ? `${overdueReturns} ${overdueReturns === 1 ? 'patient is' : 'patients are'} overdue to return${dueReturns ? `, ${dueReturns} due today` : ''}`
        : `${dueReturns} ${dueReturns === 1 ? 'patient is' : 'patients are'} due back today`,
      detail: names,
      action: 'Open returns',
      onAction: () => onNavigate('registers', 'returns')
    });
  }

  const openReferrals = stats?.openReferrals || [];
  if (openReferrals.length > 0) {
    const stale = openReferrals.filter((r) => r.days_open >= 7).length;
    items.push({
      id: 'referrals',
      tone: stale > 0 || openReferrals.some((r) => r.urgency === 'Emergency') ? 'warn' : 'neutral',
      icon: ShieldAlert,
      title: `${openReferrals.length} ${openReferrals.length === 1 ? 'referral is' : 'referrals are'} awaiting an outcome${stale ? `, ${stale} open a week or more` : ''}`,
      detail: openReferrals.slice(0, 4).map((r) => `${r.patient_name} to ${r.referred_to}`).join(', '),
      action: 'Open referrals',
      onAction: () => onNavigate('registers', 'referrals')
    });
  }

  if ((stats?.notifiable_today || 0) > 0) {
    items.push({
      id: 'notifiable',
      tone: 'warn',
      icon: ShieldAlert,
      title: `${stats.notifiable_today} reportable ${stats.notifiable_today === 1 ? 'diagnosis' : 'diagnoses'} recorded today`,
      detail: 'On the notifiable line list. Urgent conditions should be phoned through to the provincial health office.',
      action: 'Open line list',
      onAction: () => onNavigate('registers', 'notifiable')
    });
  }

  const unreconciled = stats?.unreconciledDays || [];
  if (unreconciled.length > 0) {
    items.push({
      id: 'reconcile',
      tone: 'warn',
      icon: Wallet,
      title: `${unreconciled.length} trading ${unreconciled.length === 1 ? 'day has' : 'days have'} no shift close on record`,
      detail: unreconciled.slice(0, 5).map((d) => d.day).join(', '),
      action: 'Open shift close',
      onAction: () => onNavigate('end-of-day')
    });
  }

  const flagged = stats?.flaggedDispensations || [];
  if (flagged.length > 0) {
    items.push({
      id: 'flagged',
      tone: 'warn',
      icon: Lock,
      title: `${flagged.length} pharmacy ${flagged.length === 1 ? 'transaction' : 'transactions'} discounted or unpaid today`,
      detail: 'Each one needs a reason recorded before the shift is closed.',
      action: 'Review controls',
      onAction: () => onSelectSection('controls')
    });
  }

  const longest = stats?.longest_wait_minutes;
  if (typeof longest === 'number' && longest >= 90) {
    items.push({
      id: 'wait',
      tone: 'warn',
      icon: Users,
      title: `Longest wait is now ${formatDuration(longest)}`,
      detail: 'A patient has been in the department longer than an hour and a half.',
      action: 'Open queue',
      onAction: () => onNavigate('queue')
    });
  }

  if (items.length === 0) {
    return (
      <Panel>
        <div className="flex items-center gap-2.5 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
          <p className="text-sm text-ink-2">
            Nothing outstanding. No emergency patients, no stockouts and no unreconciled shifts.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHead
        title="Needs attention"
        note={`${items.length} ${items.length === 1 ? 'item' : 'items'}, ordered by clinical urgency`}
      />
      <ul className="divide-y divide-line-soft">
        {items.map((item) => {
          const Icon = item.icon;
          const accent = item.tone === 'critical' ? 'text-critical' : item.tone === 'neutral' ? 'text-ink-3' : 'text-warn';
          return (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                {item.detail ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{item.detail}</p>
                ) : null}
              </div>
              <button type="button" className="btn btn-sm shrink-0" onClick={item.onAction}>
                {item.action}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Patient flow
// ---------------------------------------------------------------------------

export function PatientFlow({ stats, onNavigate }) {
  const queue = stats?.queueMap || {};
  const waits = stats?.stageWait || {};

  return (
    <Panel>
      <PanelHead title="Patient flow today" note="Counts and the longest time anyone has been at that stage">
        <button type="button" className="btn btn-sm" onClick={() => onNavigate('queue')}>
          Open queue
        </button>
      </PanelHead>
      <table className="data-table">
        <thead>
          <tr>
            <th>Stage</th>
            <th className="num">Patients</th>
            <th className="num">Longest wait</th>
          </tr>
        </thead>
        <tbody>
          {QUEUE_STAGES.map((stage) => {
            const count = queue[stage.key] || 0;
            const wait = waits[stage.key];
            const tone = typeof wait === 'number' && wait >= 90 ? 'warn' : 'neutral';
            return (
              <tr key={stage.key}>
                <td>
                  <span className="font-medium text-ink">{stage.label}</span>
                  {stage.tokPisin ? (
                    <span className="ml-2 text-2xs text-ink-3">{stage.tokPisin}</span>
                  ) : null}
                </td>
                <td className="num font-semibold text-ink">{count}</td>
                <td className="num">
                  {stage.key === 'Completed' ? (
                    <span className="unrecorded">—</span>
                  ) : count === 0 ? (
                    <span className="unrecorded">—</span>
                  ) : tone === 'warn' ? (
                    <span className="text-warn font-semibold">{formatDuration(wait)}</span>
                  ) : (
                    <Value>{formatDuration(wait)}</Value>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <footer className="border-t border-line-soft px-4 py-2.5 text-xs text-ink-3">
        {/* With nothing to average, the sentence says so on its own. Printing a
            dash and then the same thing in words read as "— — no visit". */}
        {stats?.average_turnaround_minutes === null || stats?.average_turnaround_minutes === undefined ? (
          'No visit has been completed yet today, so there is no average time to show.'
        ) : (
          <>
            Average time from arrival to completion today:{' '}
            <span className="font-semibold text-ink-2">
              <Value>{formatDuration(stats.average_turnaround_minutes)}</Value>
            </span>
          </>
        )}
      </footer>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Priority patients, with the observations that were actually recorded
// ---------------------------------------------------------------------------

export function PriorityPatients({ stats, onNavigate }) {
  const patients = stats?.urgentVisits || [];

  return (
    <Panel>
      <PanelHead
        title="Priority patients"
        note="Emergency and urgent triage categories still open. Observations shown are the ones recorded at triage."
      >
        <button type="button" className="btn btn-sm" onClick={() => onNavigate('queue')}>
          Open queue
        </button>
      </PanelHead>

      {patients.length === 0 ? (
        <EmptyState
          title="No emergency or urgent patients right now"
          detail="Patients appear here as soon as triage assigns them an urgent or emergency category."
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {patients.map((v) => {
            const systolic = systolicOf(v.bp);
            const isEmergency = v.triage_priority === 'Emergency';
            const paediatric = typeof v.age === 'number' && v.age < 12;
            const noObs = !v.bp && !v.pulse && !v.spo2 && !v.temp && !v.resp_rate;

            return (
              <li key={v.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={isEmergency ? 'critical' : 'warn'}>{v.triage_priority}</Pill>
                      <span className="text-sm font-semibold text-ink">{v.patient_name}</span>
                      <span className="text-xs text-ink-3">
                        <Value>{v.age}</Value>
                        {v.age ? 'y' : ''} · <Value>{v.gender}</Value> · {v.patient_code}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-2">
                      <Value>{v.reason || v.diagnosis}</Value>
                    </p>
                    {hasAllergy(v.allergies) ? (
                      <p className="mt-1 text-xs font-semibold text-critical">Allergies: {v.allergies}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <Pill tone="neutral">{v.status}</Pill>
                    <p className="mt-1 text-2xs text-ink-3">
                      In department <Value>{formatDuration(v.waiting_minutes)}</Value>
                    </p>
                  </div>
                </div>

                {noObs ? (
                  <p className="mt-2.5 rounded border border-line bg-subtle px-3 py-2 text-xs text-ink-3">
                    No observations recorded for this visit yet.
                  </p>
                ) : (
                  <div className="mt-2.5 grid grid-cols-3 gap-x-4 gap-y-2 rounded border border-line bg-subtle px-3 py-2 sm:grid-cols-5">
                    <Vital
                      label="BP"
                      value={v.bp}
                      unit="mmHg"
                      tone={scoreVital('systolic', systolic, v.age).tone}
                    />
                    <Vital label="Pulse" value={v.pulse} unit="bpm" tone={scoreVital('pulse', v.pulse, v.age).tone} />
                    <Vital label="SpO₂" value={v.spo2} unit="%" tone={scoreVital('spo2', v.spo2, v.age).tone} />
                    <Vital label="Temp" value={v.temp} unit="°C" tone={scoreVital('temp', v.temp, v.age).tone} />
                    <Vital label="Resp" value={v.resp_rate} unit="/min" tone={scoreVital('resp', v.resp_rate, v.age).tone} />
                  </div>
                )}

                {paediatric && !noObs ? (
                  <p className="mt-1.5 text-2xs text-ink-3">
                    Paediatric patient — observations are shown as recorded but not scored, because adult
                    early-warning ranges do not apply.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Ward
// ---------------------------------------------------------------------------

export function WardBoard({ stats, onAdmit, onDischarge }) {
  const beds = stats?.beds || [];
  const occupied = stats?.occupied_beds || 0;
  const available = stats?.available_beds || 0;
  const other = beds.length - occupied - available;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <Panel className="flex items-center px-5 py-4">
          <Donut
            value={occupied}
            max={beds.length}
            label="of the ward is occupied"
            tone={beds.length && occupied / beds.length >= 0.85 ? 'warn' : 'neutral'}
          />
        </Panel>

        <MetricStrip columns={3}>
          <Metric
            label="Beds occupied"
            value={occupied}
            context={`of ${beds.length} in the facility`}
            tint="4"
            icon={BedDouble}
          />
          <Metric
            label="Ready for admission"
            value={available}
            context="Cleaned and available"
            tone={available === 0 ? 'warn' : 'neutral'}
            tint="6"
            icon={CheckCircle2}
          />
          <Metric
            label="Off the board"
            value={other}
            context="Cleaning, isolation or maintenance"
            tint="5"
            icon={CircleSlash}
          />
        </MetricStrip>
      </div>

      {beds.length === 0 ? (
        <Panel>
          <EmptyState title="No beds configured" detail="Add ward beds to the database to use the bed board." />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {beds.map((bed) => {
            const isOccupied = bed.status === 'Occupied';
            const isAvailable = bed.status === 'Available';
            const tone = isOccupied ? 'critical' : isAvailable ? 'ok' : 'warn';

            return (
              <Panel key={bed.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2 border-b border-line-soft px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-ink">{bed.bed_code}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-ink">{bed.ward_name}</p>
                    <p className="text-xs text-ink-3">{bed.bed_type}</p>
                  </div>
                  <Pill tone={tone}>{bed.status}</Pill>
                </div>

                <div className="flex-1 px-4 py-3">
                  {isOccupied ? (
                    <dl className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Patient</dt>
                        <dd className="truncate text-right font-semibold text-ink">
                          <Value>{bed.patient_name}</Value>
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Record</dt>
                        <dd className="font-mono text-right text-ink-2"><Value>{bed.patient_code}</Value></dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Acuity</dt>
                        <dd className="text-right text-ink-2"><Value>{bed.acuity_level}</Value></dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Diagnosis</dt>
                        <dd className="text-right text-ink-2"><Value>{bed.diagnosis}</Value></dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Admitted</dt>
                        <dd className="text-right text-ink-2"><Value>{formatDateTime(bed.admission_date)}</Value></dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Attending</dt>
                        <dd className="truncate text-right text-ink-2"><Value>{bed.attending_doctor}</Value></dd>
                      </div>
                      {bed.vitals_ticker ? (
                        <div className="pt-1">
                          <dt className="text-ink-3">Observations at admission</dt>
                          <dd className="mt-0.5 font-mono text-2xs text-ink-2">{bed.vitals_ticker}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-xs leading-relaxed text-ink-3">
                      <Value>{bed.notes}</Value>
                    </p>
                  )}
                </div>

                <div className="border-t border-line-soft px-4 py-2.5">
                  <button
                    type="button"
                    className={`btn btn-sm w-full ${isOccupied ? '' : 'btn-primary'}`}
                    onClick={() => (isOccupied ? onDischarge(bed) : onAdmit(bed))}
                  >
                    {isOccupied ? 'Discharge patient' : 'Admit patient'}
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pharmacy and supply
// ---------------------------------------------------------------------------

export function PharmacyBoard({ stats, money, onNavigate }) {
  const low = stats?.lowStockDrugs || [];
  const expiring = stats?.expiringDrugs || [];
  const topMedicines = stats?.topMedicines || [];
  const maxDispensed = Math.max(...topMedicines.map((m) => m.total_dispensed), 1);

  return (
    <div className="space-y-4">
      <MetricStrip columns={5}>
        <Metric
          label="Out of stock"
          value={stats?.out_of_stock_count ?? 0}
          context="Nothing left on the shelf"
          tone={(stats?.out_of_stock_count || 0) > 0 ? 'critical' : 'neutral'}
          tint="3"
          icon={PackageMinus}
        />
        <Metric
          label="Below reorder level"
          value={stats?.low_stock_count ?? 0}
          context="At or under the minimum"
          tone={(stats?.low_stock_count || 0) > 0 ? 'warn' : 'neutral'}
          tint="3"
          icon={Package}
        />
        <Metric
          label="Expiring within 90 days"
          value={stats?.expiring_soon_count ?? 0}
          context={`${stats?.expired_count ?? 0} already past expiry`}
          tone={(stats?.expired_count || 0) > 0 ? 'critical' : (stats?.expiring_soon_count || 0) > 0 ? 'warn' : 'neutral'}
          tint="3"
          icon={CalendarClock}
        />
        <Metric label="Items dispensed today" value={stats?.items_dispensed_today ?? 0} context="Units across all transactions" tint="6" icon={Boxes} />
        <Metric label="Stock at cost" value={money(stats?.formulary_value ?? 0)} context="Whole formulary valuation" tint="5" icon={Warehouse} />
      </MetricStrip>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHead title="Stock below reorder level" note="Lowest cover first">
            <button type="button" className="btn btn-sm" onClick={() => onNavigate('pharmacy')}>
              Open formulary
            </button>
          </PanelHead>
          {low.length === 0 ? (
            <EmptyState title="Every medicine is above its reorder level" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th className="num">In stock</th>
                    <th className="num">Minimum</th>
                  </tr>
                </thead>
                <tbody>
                  {low.slice(0, 12).map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium text-ink">{d.name}</td>
                      <td>{d.category}</td>
                      <td className="num">
                        <span className={d.stock_quantity <= 0 ? 'font-semibold text-critical' : 'font-semibold text-warn'}>
                          {d.stock_quantity}
                        </span>
                      </td>
                      <td className="num">{d.min_stock_alert}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Expiry watch" note="Stocked items expiring within 90 days" />
          {expiring.length === 0 ? (
            <EmptyState title="No stocked item expires in the next 90 days" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th className="num">Units</th>
                    <th className="num">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.slice(0, 12).map((d) => {
                    const expired = d.days_to_expiry < 0;
                    return (
                      <tr key={d.id}>
                        <td className="font-medium text-ink">{d.name}</td>
                        <td className="font-mono text-xs"><Value>{d.batch_number}</Value></td>
                        <td className="num">{d.stock_quantity}</td>
                        <td className="num">
                          <span className={expired ? 'font-semibold text-critical' : 'font-semibold text-warn'}>
                            {expired
                              ? `${Math.abs(d.days_to_expiry)}d ago`
                              : `${d.days_to_expiry}d`}
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
      </div>

      <Panel>
        <PanelHead title="Most dispensed medicines" note="All time, by units leaving the pharmacy" />
        {topMedicines.length === 0 ? (
          <EmptyState title="Nothing has been dispensed yet" />
        ) : (
          <ul className="divide-y divide-line-soft">
            {topMedicines.map((m) => (
              <li key={m.drug_name} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-ink">{m.drug_name}</span>
                  <span className="shrink-0 text-sm font-semibold text-ink">{m.total_dispensed} units</span>
                </div>
                <div className="mt-1.5">
                  <Bar value={m.total_dispensed} max={maxDispensed} tone="info" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls: accountability for stock and cash
// ---------------------------------------------------------------------------

export function ControlsBoard({ stats, money, onNavigate }) {
  const byStaff = stats?.dispensingByStaff || [];
  const flagged = stats?.flaggedDispensations || [];
  const eod = stats?.endOfDayToday;
  const sync = stats?.cloudSync;
  const presence = stats?.staffPresence || [];
  const unreconciled = stats?.unreconciledDays || [];

  const discountRate =
    stats?.gross_sales_today > 0
      ? (stats.discount_total_today / stats.gross_sales_today) * 100
      : null;

  return (
    <div className="space-y-4">
      <MetricStrip columns={5}>
        <Metric
          label="Collected today"
          value={money(stats?.total_revenue_today ?? 0)}
          context="Consultation fees plus pharmacy sales"
          tint="5"
          icon={Wallet}
        />
        <Metric
          label="Discounts given"
          value={money(stats?.discount_total_today ?? 0)}
          context={
            discountRate === null
              ? 'No sales recorded today'
              : `${discountRate.toFixed(1)}% of gross pharmacy sales`
          }
          tone={discountRate !== null && discountRate > 10 ? 'warn' : 'neutral'}
          tint="3"
          icon={Sparkles}
        />
        <Metric
          label="Flagged transactions"
          value={flagged.length}
          context="Discounted or nothing collected"
          tone={flagged.length > 0 ? 'warn' : 'neutral'}
          tint="4"
          icon={AlertTriangle}
        />
        <Metric
          label="Shift close filed"
          value={eod ? 'Yes' : 'No'}
          context={eod ? `Counted by ${eod.cashier_name || 'unnamed'}` : 'Cash has not been counted yet today'}
          tone={eod ? 'ok' : 'warn'}
          tint="6"
          icon={ShieldCheck}
        />
        <Metric
          label="Audit entries today"
          value={stats?.audit_events_today ?? 0}
          context="Actions written to the permanent log"
          tint="1"
          icon={ScrollText}
        />
      </MetricStrip>

      <Panel>
        <PanelHead
          title="Pharmacy transactions by staff member, today"
          note="Every dispensation is attributed to the person signed in at the counter"
        />
        {byStaff.length === 0 ? (
          <EmptyState title="No medicines have been dispensed today" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th className="num">Transactions</th>
                  <th className="num">Collected</th>
                  <th className="num">Discount given</th>
                  <th className="num">Discounted</th>
                  <th className="num">Nothing collected</th>
                </tr>
              </thead>
              <tbody>
                {byStaff.map((row) => {
                  const unattributed = row.staff_name === 'Unattributed';
                  return (
                    <tr key={`${row.staff_name}-${row.staff_role}`}>
                      <td>
                        <span className={unattributed ? 'font-medium text-warn' : 'font-medium text-ink'}>
                          {row.staff_name}
                        </span>
                        {row.staff_role ? (
                          <span className="ml-2 text-2xs text-ink-3">{row.staff_role}</span>
                        ) : null}
                        {unattributed ? (
                          <p className="mt-0.5 text-2xs text-ink-3">
                            Recorded before staff attribution was switched on.
                          </p>
                        ) : null}
                      </td>
                      <td className="num">{row.transactions}</td>
                      <td className="num font-semibold text-ink">{money(row.collected)}</td>
                      <td className="num">
                        <span className={row.discount_given > 0 ? 'font-semibold text-warn' : ''}>
                          {money(row.discount_given)}
                        </span>
                      </td>
                      <td className="num">{row.discounted_transactions}</td>
                      <td className="num">
                        <span className={row.zero_paid_transactions > 0 ? 'font-semibold text-warn' : ''}>
                          {row.zero_paid_transactions}
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHead
            title="Transactions to review at shift close"
            note="Money was discounted, or none was collected"
          />
          {flagged.length === 0 ? (
            <EmptyState title="Every transaction today was collected in full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Patient</th>
                    <th>Dispensed by</th>
                    <th className="num">Gross</th>
                    <th className="num">Discount</th>
                    <th className="num">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.invoice_number}</td>
                      <td className="text-ink">{row.patient_name}</td>
                      <td><Value>{row.dispensed_by_name}</Value></td>
                      <td className="num">{money(row.total_amount)}</td>
                      <td className="num font-semibold text-warn">{money(row.discount)}</td>
                      <td className="num">
                        <span className={row.paid_amount === 0 ? 'font-semibold text-critical' : ''}>
                          {money(row.paid_amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Records and backup" note="What is protected, and when it was last saved" />
          <dl className="divide-y divide-line-soft text-sm">
            <ControlRow
              icon={Lock}
              label="Audit workbook encryption"
              tone={stats?.exportProtected ? 'ok' : 'critical'}
              status={stats?.exportProtected ? 'Password set' : 'No password set'}
              detail={
                stats?.exportProtected
                  ? 'The exported workbook is encrypted and its sheets are locked against editing. The password is held on the server and is never sent to a browser.'
                  : 'Set an export password under Facility Settings. Without it the audit workbook can be edited by anyone who receives it.'
              }
            />
            <ControlRow
              icon={FileSpreadsheet}
              label="Last export"
              tone="neutral"
              status={stats?.lastExport ? formatDateTime(stats.lastExport.created_at) : 'Never'}
              detail={
                stats?.lastExport
                  ? `${stats.lastExport.action_type} by ${stats.lastExport.user_name}.`
                  : 'No protected export has been taken from this database yet.'
              }
            />
            <ControlRow
              icon={sync?.configured ? Cloud : CloudOff}
              label="Google Sheets replication"
              tone={
                !sync
                  ? 'neutral'
                  : !sync.configured
                  ? 'warn'
                  : sync.last_sync_status === 'Success'
                  ? 'ok'
                  : 'warn'
              }
              status={!sync ? 'Unknown' : !sync.configured ? 'Not configured' : sync.last_sync_status}
              detail={
                !sync
                  ? 'Sync configuration could not be read.'
                  : !sync.configured
                  ? 'Add the Apps Script web app URL under Cloud Sync. Until then nothing leaves this machine.'
                  : sync.last_successful_sync_at
                  ? `Last successful upload ${formatDateTime(sync.last_successful_sync_at)}. ${sync.records_synced_count} records sent in total.`
                  : 'Configured, but no upload has succeeded yet.'
              }
            />
            <ControlRow
              icon={Wallet}
              label="Cash reconciliation"
              tone={unreconciled.length > 0 ? 'warn' : eod ? 'ok' : 'neutral'}
              status={
                unreconciled.length > 0
                  ? `${unreconciled.length} day${unreconciled.length === 1 ? '' : 's'} outstanding`
                  : eod
                  ? 'Today is closed'
                  : 'Today still open'
              }
              detail={
                unreconciled.length > 0
                  ? `No shift close on record for: ${unreconciled.slice(0, 6).map((d) => d.day).join(', ')}.`
                  : eod
                  ? `Counted ${money(eod.cash_reconciled)} against ${money(eod.total_revenue)} recorded.`
                  : 'The shift has not been closed yet today.'
              }
              action={
                <button type="button" className="btn btn-sm" onClick={() => onNavigate('end-of-day')}>
                  Open shift close
                </button>
              }
            />
          </dl>
        </Panel>
      </div>

      <Panel>
        <PanelHead
          title="Who is on the system"
          note="A member of staff counts as on the system if their device has checked in within the last five minutes"
        />
        {presence.length === 0 ? (
          <EmptyState title="No staff accounts found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Role</th>
                  <th>Account</th>
                  <th>Last active</th>
                  <th>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {presence.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-ink">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${u.online ? 'bg-ok' : 'bg-line-strong'}`}
                          aria-hidden="true"
                        />
                        {u.full_name}
                      </span>
                      <span className="ml-2 font-mono text-2xs text-ink-3">{u.staff_id}</span>
                    </td>
                    <td>{u.role}</td>
                    <td>
                      <Pill tone={u.account_status === 'Active' ? 'neutral' : 'warn'}>
                        {u.account_status || 'Unknown'}
                      </Pill>
                    </td>
                    <td>
                      {u.online ? (
                        <span className="font-semibold text-ok">On the system now</span>
                      ) : u.last_seen ? (
                        formatDateTime(u.last_seen)
                      ) : (
                        <span className="unrecorded">Never</span>
                      )}
                    </td>
                    <td><Value>{formatDateTime(u.last_login)}</Value></td>
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

function ControlRow({ icon: Icon, label, status, detail, tone, action }) {
  const toneClass = {
    ok: 'text-ok',
    warn: 'text-warn',
    critical: 'text-critical',
    neutral: 'text-ink-2'
  }[tone];

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-sm font-semibold text-ink">{label}</dt>
          <dd className={`text-xs font-semibold ${toneClass}`}>{status}</dd>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{detail}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trends and surveillance
// ---------------------------------------------------------------------------

export function TrendsBoard({ stats, money }) {
  const trend = stats?.footfallTrend || [];
  const maxTrend = Math.max(...trend.map((d) => d.count), 1);
  const diagnoses = stats?.topDiagnoses || [];
  const maxDiag = Math.max(...diagnoses.map((d) => d.count), 1);

  // Grouped on the server across every visit in the window, so this is not
  // limited to whatever happens to be in the top-diagnoses list.
  const surveillance = stats?.conditionGroups || [];
  const surveillanceDays = stats?.conditionGroupsWindowDays ?? 30;
  const surveillanceVisits = stats?.conditionGroupsVisitsConsidered ?? 0;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead title="Attendance over the last seven days" note="Recorded visits per day" />
        {trend.length === 0 ? (
          <EmptyState title="No visits recorded in the last seven days" />
        ) : (
          <div className="px-4 py-4">
            <div className="flex h-40 items-end gap-2">
              {trend.map((day) => {
                const isToday = day.visit_date === new Date().toISOString().split('T')[0];
                const height = Math.max(4, (day.count / maxTrend) * 100);
                return (
                  <div key={day.visit_date} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-xs font-semibold text-ink">{day.count}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-t ${isToday ? 'bg-info' : 'bg-line-strong'}`}
                        style={{ height: `${height}%` }}
                        title={`${day.visit_date}: ${day.count} visits`}
                      />
                    </div>
                    <span className={`text-2xs ${isToday ? 'font-semibold text-info' : 'text-ink-3'}`}>
                      {new Date(`${day.visit_date}T00:00:00`).toLocaleDateString([], { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHead title="Most recorded diagnoses" note="All visits with a diagnosis entered" />
          {diagnoses.length === 0 ? (
            <EmptyState title="No diagnoses recorded yet" />
          ) : (
            <ul className="divide-y divide-line-soft">
              {diagnoses.map((d) => (
                <li key={d.diagnosis} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-ink">{d.diagnosis}</span>
                    <span className="shrink-0 text-sm font-semibold text-ink">{d.count}</span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={d.count} max={maxDiag} tone="neutral" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHead
            title="Condition groups"
            note={`Visits in the last ${surveillanceDays} days, grouped by presentation`}
          />
          {surveillance.length === 0 ? (
            <EmptyState
              title="No visits match the tracked condition groups yet"
              detail={`${surveillanceVisits} visits in the last ${surveillanceDays} days were checked against the diagnosis and presenting reason.`}
            />
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Condition group</th>
                    <th className="num">Visits</th>
                    <th className="num">Share of visits</th>
                  </tr>
                </thead>
                <tbody>
                  {surveillance.map((row) => (
                    <tr key={row.label}>
                      <td className="text-ink">{row.label}</td>
                      <td className="num font-semibold text-ink">{row.visits}</td>
                      <td className="num">
                        {surveillanceVisits > 0
                          ? `${((row.visits / surveillanceVisits) * 100).toFixed(1)}%`
                          : '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <footer className="border-t border-line-soft px-4 py-2.5 text-2xs leading-relaxed text-ink-3">
                Each visit is counted once, matched against the diagnosis and presenting reason a clinician
                entered. These are records of what was written down, not laboratory-confirmed cases. A visit
                with no diagnosis recorded appears in no group.
              </footer>
            </>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Revenue recorded" note="Kina collected against work done" />
        <dl className="divide-y divide-line-soft text-sm">
          <RevenueRow label="Consultation fees today" value={money(stats?.today_opd_fees ?? 0)} />
          <RevenueRow label="Pharmacy sales today" value={money(stats?.today_pharmacy_revenue ?? 0)} />
          <RevenueRow label="Total collected today" value={money(stats?.total_revenue_today ?? 0)} strong />
          <RevenueRow label="Pharmacy sales, all time" value={money(stats?.total_pharmacy_revenue ?? 0)} />
        </dl>
      </Panel>
    </div>
  );
}

function RevenueRow({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className={strong ? 'font-semibold text-ink' : 'text-ink-2'}>{label}</dt>
      <dd className={`font-semibold ${strong ? 'text-base text-ink' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Occupational health
// ---------------------------------------------------------------------------

export function SafetyBoard({ stats }) {
  const incidents = stats?.incidents || [];

  return (
    <div className="space-y-4">
      <MetricStrip columns={3}>
        <Metric
          label="Incidents in the last 30 days"
          value={stats?.incidents_30d ?? 0}
          context="Recorded in the occupational health register"
          tone={(stats?.incidents_30d || 0) > 0 ? 'warn' : 'ok'}
          tint="4"
          icon={HardHat}
        />
        <Metric
          label="Days since the last incident"
          value={stats?.days_since_last_incident}
          context={
            stats?.days_since_last_incident === null
              ? 'No incident has ever been recorded'
              : 'Counted from the most recent recorded incident date'
          }
        />
        <Metric
          label="Workers not on full duty"
          value={stats?.open_restricted_duty ?? 0}
          context="Restricted, off-duty or under evaluation"
          tone={(stats?.open_restricted_duty || 0) > 0 ? 'warn' : 'neutral'}
        />
      </MetricStrip>

      <Panel>
        <PanelHead title="Occupational health register" note="Most recent incidents first" />
        {incidents.length === 0 ? (
          <EmptyState
            title="No occupational incidents recorded"
            detail="Workplace injuries and illnesses entered against a worker appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Worker</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Classification</th>
                  <th>Date</th>
                  <th>Fitness for work</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => {
                  const restricted =
                    inc.fit_for_work_status && inc.fit_for_work_status !== 'Fit for Full Duty';
                  return (
                    <tr key={inc.id}>
                      <td className="font-mono text-xs">{inc.incident_code}</td>
                      <td className="font-medium text-ink">
                        {inc.patient_name}
                        {inc.employee_id ? (
                          <span className="ml-2 font-mono text-2xs text-ink-3">{inc.employee_id}</span>
                        ) : null}
                      </td>
                      <td>{inc.department}</td>
                      <td>{inc.incident_type}</td>
                      <td>{inc.severity}</td>
                      <td>{inc.incident_date}</td>
                      <td>
                        <Pill tone={restricted ? 'warn' : 'ok'}>
                          <Value>{inc.fit_for_work_status}</Value>
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shift handover
// ---------------------------------------------------------------------------

export function HandoverBoard({ stats, onAddNote }) {
  const notes = stats?.shiftNotes || [];

  return (
    <Panel>
      <PanelHead
        title="Shift handover log"
        note="What the outgoing shift needs the incoming shift to know"
      >
        <button type="button" className="btn btn-sm btn-primary" onClick={onAddNote}>
          Record a note
        </button>
      </PanelHead>

      {notes.length === 0 ? (
        <EmptyState
          title="No handover notes recorded"
          detail="Notes written here are kept permanently and appear to whoever takes the next shift."
          action={
            <button type="button" className="btn btn-sm btn-primary" onClick={onAddNote}>
              Record the first note
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {notes.map((n) => {
            const tone =
              n.priority === 'Critical Emergency'
                ? 'critical'
                : n.priority === 'Clinical Alert'
                ? 'warn'
                : 'neutral';
            return (
              <li key={n.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={tone}>{n.priority}</Pill>
                      <span className="text-2xs text-ink-3">{n.shift_type}</span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-semibold text-ink">{n.title}</h3>
                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-2">{n.note_content}</p>
                  </div>
                  <div className="shrink-0 text-right text-2xs text-ink-3">
                    <p className="font-semibold text-ink-2">{n.author_name}</p>
                    <p>{n.author_role}</p>
                    <p className="mt-0.5"><Value>{formatDateTime(n.created_at)}</Value></p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

const SEVERITY_TONE = {
  Emergency: 'critical',
  Warning: 'warn',
  Success: 'ok',
  Info: 'neutral'
};

export function AuditBoard({ stats }) {
  const [filter, setFilter] = useState('all');
  const activities = stats?.activities || [];

  const filtered = useMemo(() => {
    if (filter === 'all') return activities;
    if (filter === 'attention') {
      return activities.filter((a) => a.severity === 'Emergency' || a.severity === 'Warning');
    }
    return activities.filter((a) => a.action_type === filter);
  }, [activities, filter]);

  const actionTypes = useMemo(
    () => Array.from(new Set(activities.map((a) => a.action_type))).sort(),
    [activities]
  );

  return (
    <Panel>
      <PanelHead
        title="Audit trail"
        note="Every recorded action, in the order it happened. Entries are appended and never edited."
      >
        <select
          className="field h-7 w-auto text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter the audit trail"
        >
          <option value="all">All entries</option>
          <option value="attention">Needs attention</option>
          {actionTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </PanelHead>

      {filtered.length === 0 ? (
        <EmptyState title="No entries match this filter" />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Staff member</th>
                <th>Patient</th>
                <th>Location</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap font-mono text-xs">
                    <Value>{formatDateTime(a.created_at)}</Value>
                  </td>
                  <td>
                    <Pill tone={SEVERITY_TONE[a.severity] || 'neutral'}>{a.action_type}</Pill>
                  </td>
                  <td className="whitespace-nowrap text-ink">{a.user_name}</td>
                  <td className="whitespace-nowrap"><Value>{a.patient_name}</Value></td>
                  <td className="whitespace-nowrap">{a.location}</td>
                  <td className="min-w-[22rem] text-xs">{a.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
