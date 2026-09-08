import React, { useState } from 'react';
import { Tag } from 'lucide-react';
import { PrintFrame, longDate, longDateTime, money } from './PrintFrame';
import { Value } from './ui';

/*
 * The label that goes on each medicine before it is handed over.
 *
 * One label per line on the receipt, printed on the 80 mm slip printer and
 * cut along the dashed rule. The patient's name and number are on every
 * label so a bag of three medicines cannot be mixed up between patients, and
 * the instructions are set large because they are read at home, often by
 * lamplight, by someone who was not in the consultation.
 */

/* What one of a medicine is called, from its dosage form. The stock keeps
   "Tablet"; the label says "20 tablets". */
const UNIT_BY_FORM = [
  [/tablet|tab\b/i, 'tablet'],
  [/capsule|cap\b/i, 'capsule'],
  [/sachet/i, 'sachet'],
  [/suppositor/i, 'suppository'],
  [/pessar/i, 'pessary'],
  [/lozenge/i, 'lozenge'],
  [/inhaler|puffer/i, 'inhaler'],
  [/ampoule|amp\b/i, 'ampoule'],
  [/vial|injection|inj\b/i, 'vial'],
  [/cream|ointment|gel|paste/i, 'tube'],
  [/syrup|suspension|solution|elixir|mixture|drops|liquid|bottle/i, 'bottle'],
  [/patch/i, 'patch']
];

function unitFor(dosageForm, quantity) {
  const form = String(dosageForm || '');
  const match = UNIT_BY_FORM.find(([re]) => re.test(form));
  const noun = match ? match[1] : 'unit';
  const n = parseInt(quantity, 10);
  if (n === 1) return noun;
  if (noun === 'suppository' || noun === 'pessary') return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export default function PrescriptionLabels({ isOpen, onClose, data, dispenser }) {
  const [showPrice, setShowPrice] = useState(false);
  if (!isOpen || !data) return null;

  const { invoice, items = [], patient, hospital } = data;
  const currency = hospital?.currency_symbol || 'K';
  const patientName = invoice?.patient_name || patient?.full_name || 'Walk-in';
  const hospitalNumber = patient?.hospital_number || patient?.patient_code || null;
  const dispensedBy = dispenser || invoice?.dispensed_by || null;
  const dispensedOn = invoice?.created_at ? longDate(invoice.created_at) : longDate(new Date());
  const reference = invoice?.invoice_number || null;
  const contact = [hospital?.name || 'Clinic', hospital?.phone ? `Phone ${hospital.phone}` : null]
    .filter(Boolean).join(' · ');

  const controls = (
    <button
      type="button"
      className="btn btn-sm"
      aria-pressed={showPrice}
      onClick={() => setShowPrice((v) => !v)}
      title="Show or hide the price on each label"
    >
      <Tag className="h-3.5 w-3.5" aria-hidden="true" />
      {showPrice ? 'Price shown' : 'Price hidden'}
    </button>
  );

  return (
    <PrintFrame
      title="Medicine labels"
      subtitle={`${items.length} label${items.length === 1 ? '' : 's'}${reference ? ` · ${reference}` : ''}`}
      onClose={onClose}
      printLabel="Print labels"
      page="thermal"
      controls={controls}
    >
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-3">There are no items to label on this receipt.</p>
      ) : items.map((item, idx) => {
        const quantity = parseInt(item.quantity, 10);
        const strengthAndForm = [item.strength, item.dosage_form].filter(Boolean).join(' · ');
        return (
          <React.Fragment key={item.id || idx}>
            {idx > 0 ? (
              <div className="my-4 flex items-center gap-2" aria-hidden="true">
                <div className="h-0 flex-1 border-t border-dashed border-ink-3" />
                <span className="text-2xs uppercase tracking-wide text-ink-3">cut</span>
                <div className="h-0 flex-1 border-t border-dashed border-ink-3" />
              </div>
            ) : null}

            <section className="avoid-break" aria-label={`Label ${idx + 1} of ${items.length}`}>
              <p className="text-2xs text-ink-3">{contact}</p>

              <p className="mt-2 text-sm font-bold leading-tight text-ink">{patientName}</p>
              <p className="font-mono text-2xs text-ink-2"><Value>{hospitalNumber}</Value></p>

              <p className="mt-3 text-lg font-bold leading-tight text-ink">{item.drug_name || 'Medicine'}</p>
              {strengthAndForm ? <p className="text-xs text-ink-2">{strengthAndForm}</p> : null}
              <p className="mt-1 text-sm font-semibold text-ink">
                {Number.isFinite(quantity) ? `${quantity} ${unitFor(item.dosage_form, quantity)}` : <Value>{null}</Value>}
                {showPrice ? <span className="font-normal text-ink-2"> · {currency} {money(item.subtotal)}</span> : null}
              </p>

              <p className="mt-2 rounded border border-ink px-2.5 py-2 text-base font-semibold leading-snug text-ink">
                {item.instructions && String(item.instructions).trim()
                  ? item.instructions
                  : 'Take as directed by the clinician.'}
              </p>

              <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 text-2xs text-ink-2">
                <dt className="text-ink-3">Dispensed</dt>
                <dd>{dispensedOn}</dd>
                <dt className="text-ink-3">By</dt>
                <dd><Value>{dispensedBy}</Value></dd>
                <dt className="text-ink-3">Batch</dt>
                <dd className="font-mono"><Value>{item.batch_number}</Value></dd>
                <dt className="text-ink-3">Expires</dt>
                <dd className="font-mono">{item.expiry_date ? longDate(item.expiry_date) : <Value>{null}</Value>}</dd>
              </dl>

              <p className="mt-2 border-t border-line pt-1.5 text-2xs leading-snug text-ink-2">
                Keep out of reach of children. Finish the course unless told otherwise.
              </p>
              {reference ? (
                <p className="mt-0.5 font-mono text-2xs text-ink-3">{reference} · {longDateTime(invoice?.created_at || new Date())}</p>
              ) : null}
            </section>
          </React.Fragment>
        );
      })}
    </PrintFrame>
  );
}
