import React from 'react';
import { PrintFrame, FacilityHeader, longDate, longDateTime } from './PrintFrame';
import { Value } from './ui';

/*
 * The slip a patient takes home when they are asked to come back.
 *
 * It is printed on the 80 mm slip printer at the end of a consultation. The
 * date is written out with its weekday because "15/09" is read two ways and
 * a missed return visit is the commonest way a treatment fails. The slip
 * also tells the patient what to bring, so the next visit starts from the
 * record rather than from memory.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* A return date is a calendar day, so it is read as a local day and never
   shifted by the time zone the way a timestamp would be. */
function weekdayLongDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${WEEKDAYS[d.getDay()]}, ${longDate(d)}`;
}

export default function ReturnSlip({ isOpen, onClose, settings, patient, visit, returnDate, note, issuedBy }) {
  if (!isOpen) return null;

  const patientName = patient?.full_name || visit?.patient_name || 'Patient';
  const hospitalNumber = patient?.hospital_number || patient?.patient_code || visit?.hospital_number || null;
  const when = weekdayLongDate(returnDate);
  const reference = visit?.visit_code || null;
  const issuedOn = longDateTime(visit?.created_at || new Date());

  return (
    <PrintFrame
      title="Return visit slip"
      subtitle={when ? `Back on ${when}` : 'No return date set'}
      onClose={onClose}
      printLabel="Print slip"
      page="thermal"
    >
      <FacilityHeader settings={settings} documentTitle="Please come back" compact />

      <div className="mt-3 text-center">
        <p className="text-sm font-bold leading-tight text-ink">{patientName}</p>
        <p className="font-mono text-2xs text-ink-2"><Value>{hospitalNumber}</Value></p>
      </div>

      <div className="avoid-break mt-4 rounded border-2 border-ink px-3 py-3 text-center">
        <p className="text-2xs uppercase tracking-wide text-ink-3">Come back on</p>
        <p className="mt-1 text-base font-bold leading-snug text-ink">
          {when || <span className="font-normal text-ink-3">Date to be confirmed by the clinic</span>}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-2">Please bring</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink">
          <li>Your hospital number card</li>
          <li>Any medicines you are taking</li>
          <li>This slip</li>
        </ul>
      </div>

      {note && String(note).trim() ? (
        <div className="mt-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-2">From the clinician</p>
          <p className="mt-1 text-xs leading-snug text-ink">{note}</p>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 border-t border-line pt-2 text-2xs text-ink-2">
        <dt className="text-ink-3">Visit</dt>
        <dd className="font-mono"><Value>{reference}</Value></dd>
        <dt className="text-ink-3">Issued</dt>
        <dd>{issuedOn}</dd>
        <dt className="text-ink-3">Issued by</dt>
        <dd><Value>{issuedBy}</Value></dd>
      </dl>

      <p className="mt-4 border-t border-line pt-2 text-center text-xs font-semibold leading-snug text-ink">
        If you feel worse before then, come in straight away.
      </p>
      {settings?.phone ? <p className="mt-1 text-center text-2xs text-ink-3">Phone {settings.phone}</p> : null}
    </PrintFrame>
  );
}
