import React from 'react';
import {
  PrintFrame, FacilityHeader, DocSection, DocFigures, DocFooter, SignatureBlock, localDateKey, longDate, money
} from './PrintFrame';

/*
 * The shift report the duty officer signs at the end of the day. Every figure
 * on it is read from the day's records; the only thing typed by hand is the
 * cash actually counted in the drawer, and the variance between that and what
 * the system expected is printed in full, balanced or not.
 */
export default function PrintableShiftReportModal({ isOpen, onClose, data, settings, shiftDate }) {
  if (!isOpen || !data) return null;

  const { summary = {}, existing_report: report = {}, is_closed: closed = false } = data;
  const currency = settings?.currency_symbol || 'K';
  const date = shiftDate || report?.report_date || localDateKey();
  const reference = `LMEL-EOD-${date.replace(/-/g, '')}`;
  const officer = report?.cashier_name || null;
  const notes = (report?.notes || '').trim();

  const expected = Number(summary.total_revenue) || 0;
  const counted = report?.cash_reconciled !== undefined && report?.cash_reconciled !== null
    ? Number(report.cash_reconciled) || 0
    : null;
  const variance = counted === null ? null : counted - expected;
  const varianceTone = variance === null ? 'neutral' : Math.abs(variance) < 0.005 ? 'ok' : 'critical';
  const medicines = summary.dispensed_medicines || [];

  return (
    <PrintFrame title="Shift report" subtitle={`${longDate(date)} · ${reference}`} onClose={onClose} printLabel="Print report">
      <FacilityHeader
        settings={settings}
        documentTitle="End of shift report"
        reference={reference}
        meta={[
          ['Shift date', longDate(date)],
          ['Duty officer', officer || 'Not recorded'],
          ['Status', closed ? 'Shift closed' : 'Shift still open']
        ]}
      />

      <DocSection number="1" title="Activity">
        <DocFigures items={[
          ['Patients seen', Number(summary.total_patients) || 0, 'Checked in today'],
          ['Consultations', Number(summary.completed_consultations) || 0, 'Completed by a clinician'],
          ['Prescriptions', Number(summary.total_prescriptions) || 0, 'Dispensed at the pharmacy'],
          ['Revenue recorded', `${currency} ${money(expected)}`, 'Fees and sales together']
        ]} />
      </DocSection>

      <DocSection number="2" title="Cash reconciliation" className="avoid-break">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>What it covers</th>
              <th className="num">Amount ({currency})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold">Consultation fees</td>
              <td className="text-ink-2">Outpatient consultations and triage</td>
              <td className="num">{money(summary.total_opd_fees)}</td>
            </tr>
            <tr>
              <td className="font-semibold">Pharmacy sales</td>
              <td className="text-ink-2">Medicines and consumables dispensed</td>
              <td className="num">{money(summary.total_pharmacy_sales)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Expected from the records</td>
              <td className="num">{money(expected)}</td>
            </tr>
            <tr>
              <td colSpan={2}>Cash counted in the drawer</td>
              <td className="num">{counted === null ? <span className="font-normal text-ink-3">Not counted</span> : money(counted)}</td>
            </tr>
            <tr>
              <td colSpan={2}>Variance</td>
              <td className={`num ${varianceTone === 'ok' ? 'text-ok' : varianceTone === 'critical' ? 'text-critical' : ''}`}>
                {variance === null ? <span className="font-normal text-ink-3">Not counted</span>
                  : varianceTone === 'ok' ? 'Balanced'
                    : `${variance > 0 ? '+' : '−'} ${money(Math.abs(variance))}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </DocSection>

      <DocSection number="3" title="Medicines dispensed">
        {medicines.length === 0 ? (
          <p className="rounded border border-dashed border-line-strong px-3 py-3 text-center text-xs text-ink-3">
            No medicines were dispensed during this shift.
          </p>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Medicine</th>
                <th className="num">Units</th>
                <th className="num">Sales ({currency})</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((m, idx) => (
                <tr key={`${m.drug_name}-${idx}`}>
                  <td className="text-ink-3">{idx + 1}</td>
                  <td className="font-semibold">{m.drug_name}</td>
                  <td className="num">{m.total_units}</td>
                  <td className="num">{money(m.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DocSection>

      <DocSection number="4" title="Handover notes" className="avoid-break">
        {notes ? (
          <p className="whitespace-pre-wrap rounded border border-line bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink">{notes}</p>
        ) : (
          <p className="text-xs text-ink-3">No handover notes were recorded for this shift.</p>
        )}
      </DocSection>

      <SignatureBlock
        className="mt-10"
        stamp
        lines={[
          { label: 'Duty officer', name: officer, hint: 'Signature and date' },
          { label: 'Supervising medical officer', name: settings?.doctor_in_charge, hint: 'Signature and date' }
        ]}
      />

      <DocFooter settings={settings} reference={reference} />
    </PrintFrame>
  );
}
