import React from 'react';
import {
  PrintFrame, FacilityHeader, DocFigures, DocFooter, SignatureBlock, longDate, clockOf, localDateKey, money
} from './PrintFrame';

/*
 * The day's outpatient register, one line per attendance, in the order the
 * patients arrived. It is the paper copy the health office asks for and the
 * one that survives a power cut.
 */
function priorityTone(priority) {
  if (priority === 'Emergency') return 'pill pill-critical';
  if (priority === 'Urgent') return 'pill pill-warn';
  return 'pill pill-neutral';
}

function observations(v) {
  return [
    v.bp ? `BP ${v.bp}` : null,
    v.pulse ? `P ${v.pulse}` : null,
    v.temp ? `T ${v.temp}°` : null,
    v.spo2 ? `SpO₂ ${v.spo2}%` : null
  ].filter(Boolean).join(' · ');
}

export default function PrintableOPDRegisterModal({ isOpen, onClose, visits = [], settings }) {
  if (!isOpen) return null;

  const currency = settings?.currency_symbol || 'K';
  const today = localDateKey();
  const reference = `OPD-${today.replace(/-/g, '')}`;

  const completed = visits.filter((v) => v.status === 'Completed').length;
  const priority = visits.filter((v) => v.triage_priority === 'Emergency' || v.triage_priority === 'Urgent').length;
  const fees = visits.reduce((sum, v) => sum + (parseFloat(v.consultation_fee) || 0), 0);

  return (
    <PrintFrame title="Outpatient register" subtitle={longDate(today)} onClose={onClose} printLabel="Print register" page="landscape">
      <FacilityHeader
        settings={settings}
        documentTitle="Outpatient register"
        reference={reference}
        meta={[['Date', longDate(today)], ['Attendances', String(visits.length)]]}
      />

      <div className="mt-4">
        <DocFigures items={[
          ['Attendances', visits.length, 'Checked in today'],
          ['Completed', completed, 'Seen and closed'],
          ['Emergency or urgent', priority, 'Triaged above standard', priority ? 'critical' : undefined],
          ['Consultation fees', `${currency} ${money(fees)}`, 'Recorded today']
        ]} />
      </div>

      <table className="doc-table mt-4">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>Time</th>
            <th>Patient</th>
            <th>Age · Sex</th>
            <th>Priority</th>
            <th>Observations</th>
            <th>Diagnosis or reason</th>
            <th className="num">Fee ({currency})</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {visits.length === 0 ? (
            <tr><td colSpan={9} className="py-4 text-center text-ink-3">No patients have been checked in today.</td></tr>
          ) : visits.map((v, idx) => {
            const obs = observations(v);
            return (
              <tr key={v.id || idx}>
                <td className="text-ink-3">{idx + 1}</td>
                <td className="whitespace-nowrap font-mono">{v.visit_time || clockOf(v.created_at) || '—'}</td>
                <td>
                  <span className="font-semibold">{v.patient_name}</span>
                  <span className="block font-mono text-2xs text-ink-3">{v.hospital_number || v.patient_code || 'No number'}</span>
                </td>
                <td className="whitespace-nowrap">{v.age ?? '—'}{v.age ? 'y' : ''} · {v.gender ? String(v.gender).charAt(0) : '—'}</td>
                <td><span className={priorityTone(v.triage_priority)}>{v.triage_priority || 'Standard'}</span></td>
                <td className="whitespace-nowrap font-mono text-2xs">{obs || <span className="font-sans text-ink-3">Not recorded</span>}</td>
                <td className="max-w-[16rem]">
                  <span className="font-semibold">{v.diagnosis || v.reason || <span className="font-normal text-ink-3">Not recorded</span>}</span>
                  {v.doctor_notes ? <span className="block truncate text-2xs text-ink-2">{v.doctor_notes}</span> : null}
                </td>
                <td className="num">{money(v.consultation_fee)}</td>
                <td className={`whitespace-nowrap ${v.status === 'Completed' ? 'font-semibold text-ok' : 'text-ink-2'}`}>{v.status || 'Waiting'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <SignatureBlock
        className="mt-10"
        stamp
        lines={[
          { label: 'Triage nurse or intake officer', hint: 'Signature and staff number' },
          { label: 'Medical officer', name: settings?.doctor_in_charge, hint: 'Signature and date' }
        ]}
      />

      <DocFooter settings={settings} reference={reference} />
    </PrintFrame>
  );
}
