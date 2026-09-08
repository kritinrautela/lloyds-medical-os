import React from 'react';
import { PrintFrame, FacilityHeader, clockOf, longDate } from './PrintFrame';
import { Value } from './ui';

/*
 * The ticket handed over at check-in.
 *
 * A waiting room with a number in every hand is a calmer waiting room: the
 * patient knows they are in the queue, and the nurse can call a number
 * instead of a name across a crowded bench. The triage priority is printed
 * as a word so that somebody moved ahead of the line can be shown why.
 */

const PRIORITY_LABEL = {
  Emergency: 'Emergency',
  Urgent: 'Urgent',
  Standard: 'Standard'
};

/* The visit code ends in the number issued that day; the ticket shows that
   part large when no queue position is supplied. */
function ticketNumberFrom(visit, position) {
  if (position !== null && position !== undefined && position !== '') return String(position);
  const code = String(visit?.visit_code || '');
  const match = code.match(/(\d+)\s*$/);
  return match ? String(parseInt(match[1], 10)) : null;
}

export default function QueueTicket({ isOpen, onClose, settings, visit, position }) {
  if (!isOpen || !visit) return null;

  const number = ticketNumberFrom(visit, position);
  const priority = PRIORITY_LABEL[visit.triage_priority] || 'Standard';
  const checkedIn = clockOf(visit.created_at);
  const day = visit.created_at ? longDate(visit.created_at) : longDate(new Date());

  return (
    <PrintFrame
      title="Queue ticket"
      subtitle={number ? `Number ${number} · ${visit.patient_name || 'Patient'}` : visit.patient_name || 'Patient'}
      onClose={onClose}
      printLabel="Print ticket"
      page="thermal"
    >
      <FacilityHeader settings={settings} documentTitle="Queue ticket" compact />

      <div className="avoid-break mt-3 text-center">
        <p className="text-2xs uppercase tracking-wide text-ink-3">Your number</p>
        <p className="font-mono text-6xl font-bold leading-none tracking-tight text-ink" aria-label={number ? `Number ${number}` : 'No number'}>
          <Value>{number}</Value>
        </p>
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm font-bold leading-tight text-ink"><Value>{visit.patient_name}</Value></p>
        {visit.hospital_number ? <p className="font-mono text-2xs text-ink-2">{visit.hospital_number}</p> : null}
      </div>

      <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 border-t border-line pt-2 text-xs text-ink-2">
        <dt className="text-ink-3">Checked in</dt>
        <dd className="text-ink">{checkedIn ? `${checkedIn}, ${day}` : day}</dd>
        <dt className="text-ink-3">Priority</dt>
        <dd className={`font-semibold ${priority === 'Emergency' ? 'text-critical' : priority === 'Urgent' ? 'text-warn' : 'text-ink'}`}>
          {priority}
        </dd>
      </dl>

      <p className="mt-4 border-t border-line pt-2 text-center text-xs font-semibold leading-snug text-ink">
        Please wait to be called. Emergency and urgent cases are seen first.
      </p>
      <p className="mt-2 text-center font-mono text-2xs text-ink-3"><Value>{visit.visit_code}</Value></p>
    </PrintFrame>
  );
}
