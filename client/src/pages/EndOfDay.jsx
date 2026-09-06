import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Printer } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PrintableShiftReportModal from '../components/PrintableShiftReportModal';
import {
  EmptyState, Metric, MetricStrip, Panel, PanelHead, Pill, SectionTitle, Value, formatDateTime
} from '../components/ui';

/*
 * Closing the day.
 *
 * The shape of this page follows what a supervisor has to be able to answer at
 * the end of a shift: what came in, what is in the drawer, and what left the
 * shelf for less than it was worth. The counted cash is typed in by hand and is
 * never pre-filled with the expected figure — a drawer nobody counted must not
 * be able to produce a perfect reconciliation.
 */

export default function EndOfDay({ settings, refreshStats }) {
  const { currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [printing, setPrinting] = useState(null);

  const currency = settings?.currency_symbol || 'K';

  const load = useCallback(async () => {
    try {
      const [today, past] = await Promise.all([api.getEndOfDayToday(), api.getEndOfDayHistory()]);
      setData(today);
      setHistory(past.history || []);
    } catch (err) {
      setMessage({ tone: 'critical', text: err.message || 'The shift summary could not be loaded.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const expected = s?.total_revenue || 0;
  const countedNumber = counted === '' ? null : parseFloat(counted);
  const variance = countedNumber === null || Number.isNaN(countedNumber) ? null : countedNumber - expected;

  const exceptions = useMemo(() => {
    if (!s) return { reduced: [], movements: [], unattributed: 0 };
    return {
      reduced: s.reduced_sales || [],
      movements: s.stock_movements || [],
      unattributed: s.unattributed_dispensations || 0
    };
  }, [s]);

  const close = async () => {
    setMessage(null);
    if (countedNumber === null || Number.isNaN(countedNumber)) {
      setMessage({ tone: 'critical', text: 'Count the cash in the drawer and enter the amount.' });
      return;
    }
    setBusy(true);
    try {
      const res = await api.closeEndOfDay({
        cashier_name: currentUser?.full_name || '',
        cash_reconciled: countedNumber,
        notes
      });
      setMessage({ tone: res.variance && Math.abs(res.variance) >= 0.005 ? 'warn' : 'ok', text: res.message });
      setCounted('');
      setNotes('');
      await load();
      refreshStats?.();
    } catch (err) {
      setMessage({ tone: 'critical', text: err.message || 'The shift could not be closed.' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-ink-3">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Adding up the day
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle note={data?.report_date}>Shift close</SectionTitle>
        <div className="flex items-center gap-2">
          {data?.is_closed ? <Pill tone="ok">Closed for today</Pill> : <Pill tone="warn">Still open</Pill>}
          {data?.is_closed && data?.existing_report ? (
            <button type="button" className="btn btn-sm" onClick={() => setPrinting(data.existing_report)}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print today's report
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className={`rounded-md border px-3 py-2 text-xs ${
          message.tone === 'ok' ? 'border-ok-line bg-ok-wash text-ok'
          : message.tone === 'warn' ? 'border-warn-line bg-warn-wash text-warn'
          : 'border-critical-line bg-critical-wash text-critical'
        }`}>
          {message.text}
        </p>
      ) : null}

      <MetricStrip columns={5}>
        <Metric label="Patients seen" value={s?.total_patients || 0} context="Checked in today" tint="1" />
        <Metric label="Consultations finished" value={s?.completed_consultations || 0} context="Reached the end of the queue" tint="2" />
        <Metric label="Medicines handed over" value={s?.total_prescriptions || 0} context="Separate dispensing records" tint="3" />
        <Metric label={`Consultation fees (${currency})`} value={(s?.total_opd_fees || 0).toFixed(2)} context="Recorded against visits" tint="4" />
        <Metric label={`Pharmacy takings (${currency})`} value={(s?.total_pharmacy_sales || 0).toFixed(2)} context="Collected at the counter" tint="5" />
      </MetricStrip>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            title="Worth a second look"
            note="Medicine that left for less than its price, and stock that moved with no patient"
          />
          {exceptions.unattributed > 0 ? (
            <p className="border-b border-critical-line bg-critical-wash px-4 py-2 text-xs text-critical">
              {exceptions.unattributed} dispensing record{exceptions.unattributed === 1 ? '' : 's'} today
              carr{exceptions.unattributed === 1 ? 'ies' : 'y'} no name. Every hand-over should be
              recorded by a signed-in member of staff.
            </p>
          ) : null}

          {exceptions.reduced.length === 0 && exceptions.movements.length === 0 ? (
            <EmptyState
              title="Nothing stands out"
              detail="Every medicine handed over today was recorded at its full price by a named member of staff, and no stock moved outside a dispensation."
            />
          ) : (
            <div className="space-y-4 px-4 py-3">
              {exceptions.reduced.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-3">
                    Reduced or unpaid ({exceptions.reduced.length})
                  </p>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Patient</th>
                          <th className="num">Value</th>
                          <th className="num">Reduced</th>
                          <th className="num">Collected</th>
                          <th>Reason given</th>
                          <th>Recorded by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exceptions.reduced.map((r) => (
                          <tr key={r.invoice_number}>
                            <td className="font-mono text-2xs">{r.invoice_number}</td>
                            <td>{r.patient_name}</td>
                            <td className="num">{(r.total_amount || 0).toFixed(2)}</td>
                            <td className="num text-warn">{(r.discount || 0).toFixed(2)}</td>
                            <td className={`num ${Number(r.paid_amount) === 0 ? 'text-critical font-semibold' : ''}`}>
                              {(r.paid_amount || 0).toFixed(2)}
                            </td>
                            <td className={r.discount > 0 && !r.discount_reason ? 'text-critical' : ''}>
                              <Value>{r.discount_reason}</Value>
                            </td>
                            <td className={r.dispensed_by_name ? '' : 'text-critical'}>
                              <Value>{r.dispensed_by_name}</Value>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {exceptions.movements.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-3">
                    Stock moved outside a dispensation ({exceptions.movements.length})
                  </p>
                  <ul className="divide-y divide-line-soft rounded-md border border-line">
                    {exceptions.movements.map((m, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink">{m.action_type}</p>
                          <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">{m.details}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-2xs text-ink-2">{m.user_name}</p>
                          <p className="text-2xs text-ink-3">{formatDateTime(m.created_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel className="h-fit">
          <PanelHead title="Count the drawer" />
          <div className="space-y-3 px-4 py-3">
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-ink-2">Consultation fees</dt>
                <dd className="font-mono text-ink">{currency} {(s?.total_opd_fees || 0).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Pharmacy takings</dt>
                <dd className="font-mono text-ink">{currency} {(s?.total_pharmacy_sales || 0).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
                <dt className="text-ink">Expected in the drawer</dt>
                <dd className="font-mono text-ink">{currency} {expected.toFixed(2)}</dd>
              </div>
            </dl>

            <div>
              <label className="label" htmlFor="counted">Counted in the drawer ({currency})</label>
              <input
                id="counted"
                className="field font-mono text-right"
                type="number"
                min="0"
                step="0.05"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="Count it first"
                disabled={data?.is_closed}
              />
              <p className="mt-1 text-2xs leading-relaxed text-ink-3">
                This is left empty on purpose. Count the money before typing anything here.
              </p>
            </div>

            {variance !== null ? (
              <div className={`rounded-md border px-3 py-2 ${
                Math.abs(variance) < 0.005 ? 'border-ok-line bg-ok-wash'
                : 'border-warn-line bg-warn-wash'
              }`}>
                <p className={`flex items-center gap-1.5 text-xs font-semibold ${
                  Math.abs(variance) < 0.005 ? 'text-ok' : 'text-warn'
                }`}>
                  {Math.abs(variance) < 0.005 ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> The drawer balances</>
                  ) : (
                    <><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      {variance > 0 ? 'Over' : 'Short'} by {currency} {Math.abs(variance).toFixed(2)}
                    </>
                  )}
                </p>
                {Math.abs(variance) >= 0.005 ? (
                  <p className="mt-1 text-2xs leading-relaxed text-warn">
                    A difference is not by itself a problem, but it is recorded. Write what you think
                    happened in the note below.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="label" htmlFor="shift-notes">Note for the record</label>
              <textarea
                id="shift-notes"
                className="field"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={data?.is_closed}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary w-full justify-center"
              onClick={close}
              disabled={busy || data?.is_closed}
            >
              {busy ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Closing</>
              ) : data?.is_closed ? 'Already closed today' : 'Close the shift'}
            </button>

            <p className="text-2xs leading-relaxed text-ink-3">
              Closed by {currentUser?.full_name || 'the signed-in user'}. Closing again on the same
              day replaces the figures and is recorded.
            </p>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Medicines handed over today" note={`${(s?.dispensed_medicines || []).length} kinds`} />
        {(s?.dispensed_medicines || []).length === 0 ? (
          <EmptyState title="Nothing dispensed yet today" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Medicine</th><th className="num">Units</th><th className="num">Value ({currency})</th></tr>
              </thead>
              <tbody>
                {s.dispensed_medicines.map((m) => (
                  <tr key={m.drug_name}>
                    <td>{m.drug_name}</td>
                    <td className="num">{m.total_units}</td>
                    <td className="num">{(m.total_revenue || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHead title="Previous days" note={`${history.length} closed shifts`} />
        {history.length === 0 ? (
          <EmptyState title="No shift has been closed yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th className="num">Patients</th>
                  <th className="num">Expected ({currency})</th>
                  <th className="num">Counted ({currency})</th>
                  <th className="num">Difference</th>
                  <th>Closed by</th><th aria-label="Print" />
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const diff = (h.cash_reconciled || 0) - (h.total_revenue || 0);
                  return (
                    <tr key={h.report_date}>
                      <td className="font-mono text-2xs">{h.report_date}</td>
                      <td className="num">{h.total_patients}</td>
                      <td className="num">{(h.total_revenue || 0).toFixed(2)}</td>
                      <td className="num">{(h.cash_reconciled || 0).toFixed(2)}</td>
                      <td className={`num ${Math.abs(diff) < 0.005 ? '' : 'font-semibold text-warn'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                      </td>
                      <td><Value>{h.cashier_name}</Value></td>
                      <td className="num">
                        <button type="button" className="btn btn-sm" onClick={() => setPrinting(h)}>
                          <Printer className="h-3 w-3" aria-hidden="true" />
                          Print
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <PrintableShiftReportModal
        isOpen={!!printing}
        onClose={() => setPrinting(null)}
        settings={settings}
        shiftDate={printing?.report_date}
        data={printing ? {
          is_closed: true,
          existing_report: printing,
          summary: {
            total_patients: printing.total_patients,
            completed_consultations: printing.total_consultations,
            total_prescriptions: printing.total_prescriptions,
            total_opd_fees: printing.total_opd_fees,
            total_pharmacy_sales: printing.total_pharmacy_sales,
            total_revenue: printing.total_revenue,
            // The per-medicine breakdown is only held for the current day, so a
            // reprint of an older shift shows the totals without it rather than
            // showing today's medicines against yesterday's date.
            dispensed_medicines: printing.report_date === data?.report_date
              ? (s?.dispensed_medicines || [])
              : []
          }
        } : null}
      />
    </div>
  );
}
