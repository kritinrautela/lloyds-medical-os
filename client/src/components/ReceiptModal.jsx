import React, { useState } from 'react';
import { FileText, Receipt, Tags } from 'lucide-react';
import {
  PrintFrame, FacilityHeader, DocMeta, DocFooter, SignatureLine, longDateTime, money
} from './PrintFrame';

/*
 * The receipt the patient takes home. It prints on an A4 sheet or an 80 mm
 * till slip; the content is the same on both, so what the patient carries is
 * what the ledger holds.
 */
export default function ReceiptModal({ isOpen, onClose, data, onPrintLabels }) {
  const [format, setFormat] = useState('a4');
  if (!isOpen || !data) return null;

  const { invoice, items = [], hospital, patient } = data;
  const currency = hospital?.currency_symbol || 'K';
  const thermal = format === 'thermal';

  const number = invoice?.invoice_number || 'Not issued';
  const gross = items.reduce((sum, it) => sum + (parseFloat(it.subtotal) || 0), 0);
  const discount = parseFloat(invoice?.discount) || 0;
  const paid = parseFloat(invoice?.paid_amount ?? invoice?.total_amount ?? gross - discount) || 0;
  const patientName = invoice?.patient_name || patient?.full_name || 'Walk-in';
  const hospitalNumber = patient?.hospital_number || patient?.patient_code || null;

  const controls = (
    <>
    {onPrintLabels ? (
      <button type="button" className="btn btn-sm" onClick={onPrintLabels} title="One label per medicine, for the bag">
        <Tags className="h-3.5 w-3.5" aria-hidden="true" />
        Medicine labels
      </button>
    ) : null}
    <div className="flex rounded-md border border-line bg-subtle p-0.5" role="group" aria-label="Paper size">
      {[['a4', 'A4 sheet', FileText], ['thermal', '80 mm slip', Receipt]].map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          onClick={() => setFormat(key)}
          aria-pressed={format === key}
          className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors ${
            format === key ? 'bg-surface text-ink shadow-panel' : 'text-ink-3 hover:text-ink'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
    </>
  );

  const table = (
    <table className={`doc-table ${thermal ? 'doc-table-plain' : ''}`}>
      <thead>
        <tr>
          <th>Item</th>
          <th className="num">Qty</th>
          {thermal ? null : <th className="num">Unit ({currency})</th>}
          <th className="num">Amount ({currency})</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr><td colSpan={thermal ? 3 : 4} className="text-center text-ink-3">No items on this receipt.</td></tr>
        ) : items.map((item, idx) => (
          <tr key={idx}>
            <td>
              <span className="font-semibold">{item.drug_name}</span>
              {item.instructions ? <span className="block text-2xs text-ink-2">{item.instructions}</span> : null}
              {thermal ? <span className="block text-2xs text-ink-3">{item.quantity} × {money(item.unit_price)}</span> : null}
            </td>
            <td className="num">{item.quantity}</td>
            {thermal ? null : <td className="num">{money(item.unit_price)}</td>}
            <td className="num font-semibold">{money(item.subtotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const totals = (
    <div className={`ml-auto ${thermal ? 'w-full' : 'w-72'} space-y-1 text-xs`}>
      <div className="flex justify-between text-ink-2">
        <span>Items</span>
        <span>{currency} {money(gross)}</span>
      </div>
      {discount > 0 ? (
        <div className="flex justify-between text-ink-2">
          <span>Price reduction{invoice?.discount_reason ? ` (${invoice.discount_reason})` : ''}</span>
          <span>− {currency} {money(discount)}</span>
        </div>
      ) : null}
      <div className="flex justify-between border-t-2 border-ink pt-1.5 text-sm font-bold text-ink">
        <span>Total paid{hospital?.currency_code ? ` (${hospital.currency_code})` : ''}</span>
        <span>{currency} {money(paid)}</span>
      </div>
      <div className="flex justify-between text-2xs text-ink-3">
        <span>Payment</span>
        <span>{invoice?.payment_method || 'Cash'}</span>
      </div>
    </div>
  );

  return (
    <PrintFrame
      title="Receipt"
      subtitle={`${number} · ${patientName}`}
      onClose={onClose}
      printLabel="Print receipt"
      page={thermal ? 'thermal' : 'a4'}
      controls={controls}
    >
      <FacilityHeader settings={hospital} documentTitle="Receipt" reference={number} compact={thermal} />

      {thermal ? (
        <dl className="mt-3 space-y-1 text-2xs">
          {[
            ['Date', longDateTime(invoice?.created_at)],
            ['Patient', patientName],
            ['Hospital no.', hospitalNumber || 'Not registered'],
            ['Served by', invoice?.dispensed_by_name || 'Not recorded']
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-right font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-5">
          <DocMeta
            columns={3}
            items={[
              ['Receipt number', number, true],
              ['Date and time', longDateTime(invoice?.created_at)],
              ['Served by', invoice?.dispensed_by_name],
              ['Patient', patientName],
              ['Hospital number', hospitalNumber || 'Not registered', true],
              ['Payment', invoice?.payment_method || 'Cash']
            ]}
          />
        </div>
      )}

      <div className={thermal ? 'mt-3' : 'mt-5'}>{table}</div>
      <div className={thermal ? 'mt-3' : 'mt-4'}>{totals}</div>

      {hospital?.receipt_footer ? (
        <p className={`${thermal ? 'mt-4 text-center' : 'mt-6'} text-2xs leading-relaxed text-ink-2`}>{hospital.receipt_footer}</p>
      ) : null}

      {thermal ? (
        <p className="mt-4 border-t border-dashed border-line-strong pt-2 text-center text-2xs text-ink-3">
          Keep this slip. Reference {number}.
        </p>
      ) : (
        <>
          <div className="avoid-break mt-10 grid grid-cols-2 gap-10">
            <SignatureLine label="Dispensing officer" name={invoice?.dispensed_by_name} />
            <SignatureLine label="Received by patient or guardian" />
          </div>
          <DocFooter settings={hospital} reference={number} note="Keep this receipt. It is the record of what was paid." />
        </>
      )}
    </PrintFrame>
  );
}
