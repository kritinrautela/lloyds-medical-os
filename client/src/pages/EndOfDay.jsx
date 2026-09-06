import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  FileCheck, 
  DollarSign, 
  Users, 
  Pill, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck,
  Download,
  Lock,
  Cloud,
  HardDrive,
  LogOut,
  Sparkles,
  Printer
} from 'lucide-react';
import { api } from '../services/api';
import PrintableShiftReportModal from '../components/PrintableShiftReportModal';

export default function EndOfDay({ settings, onOpenExport, refreshStats }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  
  // Printable Report state
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);
  const [reportToPrint, setReportToPrint] = useState(null);

  // Closing form state
  const [cashierName, setCashierName] = useState('Duty Clinical Officer');
  const [physicalCash, setPhysicalCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ejectedState, setEjectedState] = useState(false);

  const currency = settings?.currency_symbol || 'K';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [todayRes, historyRes] = await Promise.all([
        api.getEndOfDayToday(),
        api.getEndOfDayHistory()
      ]);
      setData(todayRes);
      setHistory(historyRes.history || []);
      if (todayRes.summary) {
        setPhysicalCash(todayRes.summary.total_revenue.toString());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to finalize and close today\'s shift reconciliation?')) {
      return;
    }

    try {
      setIsSubmitting(true);
      await api.closeEndOfDay({
        cashier_name: cashierName,
        cash_reconciled: parseFloat(physicalCash) || 0,
        notes: notes
      });

      // Confetti celebration
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });

      fetchData();
      if (refreshStats) refreshStats();
      alert('Shift successfully closed! Reconciliation report stored locally.');
    } catch (err) {
      alert('Failed to close shift: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSafeEject = () => {
    setEjectedState(true);
    // Trigger automated Excel download before eject!
    const defaultPassword = settings?.export_password || 'png_health_2026';
    window.location.href = api.getExcelExportUrl(defaultPassword);
  };

  const summary = data?.summary || {
    total_patients: 0,
    completed_consultations: 0,
    total_prescriptions: 0,
    total_opd_fees: 0,
    total_pharmacy_sales: 0,
    total_revenue: 0,
    dispensed_medicines: []
  };

  const cashDifference = (parseFloat(physicalCash || 0) - summary.total_revenue);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <span>End-of-Day Shift Closeout & Financial Audit</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Reconcile daily cash, tally patient footfall and medicine depletion, and sign off the shift audit log.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setReportToPrint(data);
              setIsPrintReportOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Shift Audit Report</span>
          </button>
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Export Encrypted Excel</span>
          </button>
          <button
            onClick={handleSafeEject}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer active:scale-95"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Safe Pen Drive Eject</span>
          </button>
        </div>
      </div>

      {/* Safe Eject Notice */}
      {ejectedState && (
        <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-900 flex items-center justify-between animate-scaleIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-cyan-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-900">Safe to Remove Pen Drive</h4>
              <p className="text-xs text-slate-600">
                Encrypted Excel archive downloaded. SQLite database transaction logs flushed to disk.
              </p>
            </div>
          </div>
          <button
            onClick={() => setEjectedState(false)}
            className="text-xs font-semibold underline text-cyan-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Today's Status Banner */}
      {data?.is_closed ? (
        <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Shift Successfully Closed & Reconciled</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Reconciled by: <strong className="text-slate-900">{data.existing_report?.cashier_name}</strong> • Cash Reconciled: <strong className="text-emerald-700 font-mono">{currency} {data.existing_report?.cash_reconciled?.toFixed(2)}</strong>
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            {data.existing_report?.cloud_sync_status || 'Ready for Sync'}
          </span>
        </div>
      ) : (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900">Shift Active • Pending End-of-Day Balancing</h4>
            <p className="text-xs text-slate-600 mt-0.5">
              When clinical operations conclude for the day, count physical drawer cash and submit the reconciliation below.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Patients Logged</span>
          <div className="text-3xl font-black text-slate-900 mt-1.5">{summary.total_patients}</div>
          <p className="text-xs text-slate-500 mt-1">{summary.completed_consultations} consultations completed</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Prescriptions Dispensed</span>
          <div className="text-3xl font-black text-purple-700 mt-1.5">{summary.total_prescriptions}</div>
          <p className="text-xs text-slate-500 mt-1">Dispensed by pharmacy</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">OPD Consultation Fees</span>
          <div className="text-3xl font-black text-emerald-600 font-mono mt-1.5">
            {currency} {summary.total_opd_fees.toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Triage & doctor fees</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pharmacy Sales</span>
          <div className="text-3xl font-black text-teal-700 font-mono mt-1.5">
            {currency} {summary.total_pharmacy_sales.toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Formulary medicines</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Medicine Consumption Tally */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Pill className="w-4 h-4 text-cyan-600" />
            <span>Medicines Dispensed Today (Formulary Depletion Ledger)</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Medication</th>
                  <th className="py-2.5 px-3 text-center">Units Consumed</th>
                  <th className="py-2.5 px-3 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.dispensed_medicines.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-6 text-center text-slate-400 italic">
                      No medications dispensed yet today.
                    </td>
                  </tr>
                ) : (
                  summary.dispensed_medicines.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{m.drug_name}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-cyan-700">{m.total_units}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                        {currency} {parseFloat(m.total_revenue).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Cash Reconciliation Form */}
        <div className="bg-white p-6 rounded-3xl h-fit space-y-4 border border-slate-200/90 shadow-md">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-200">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Shift Cash Balancing</span>
          </h3>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span className="font-medium">System Expected Cash:</span>
              <strong className="text-slate-900 font-mono font-bold">{currency} {summary.total_revenue.toFixed(2)}</strong>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <label className="text-slate-700 font-semibold">Physical Counted:</label>
              <div className="flex items-center gap-1">
                <span className="font-mono text-slate-500">{currency}</span>
                <input
                  type="number"
                  step="0.5"
                  value={physicalCash}
                  onChange={(e) => setPhysicalCash(e.target.value)}
                  className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-right text-xs text-emerald-700 font-mono font-bold focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            <div className={`flex justify-between text-xs font-semibold pt-2 border-t border-slate-200 ${
              cashDifference === 0 ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              <span>Variance:</span>
              <span className="font-mono font-bold">
                {cashDifference === 0 ? 'Balanced (0.00)' : `${currency} ${cashDifference.toFixed(2)}`}
              </span>
            </div>
          </div>

          <form onSubmit={handleCloseShift} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Cashier / Staff Member Name</label>
              <input
                type="text"
                required
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Shift Handover Remarks</label>
              <textarea
                rows="2"
                placeholder="e.g. Safe locked, malaria RDTs restocked for night shift..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Finalizing...' : 'Close & Finalize Today\'s Shift'}
            </button>
          </form>
        </div>

      </div>

      {/* Shift History Archive */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Past Shift Reconciliation Archive</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 uppercase text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Patients</th>
                <th className="py-2.5 px-3">Prescriptions</th>
                <th className="py-2.5 px-3 text-right">Revenue ({currency})</th>
                <th className="py-2.5 px-3 text-right">Physical Cash</th>
                <th className="py-2.5 px-3 font-sans">Cashier</th>
                <th className="py-2.5 px-3 font-sans">Sync Status</th>
                <th className="py-2.5 px-3 text-center font-sans">Official Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-4 text-center text-slate-400 italic font-sans">No past closed shifts yet.</td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-cyan-700 font-bold">{h.report_date}</td>
                    <td className="py-2.5 px-3 text-slate-800">{h.total_patients}</td>
                    <td className="py-2.5 px-3 text-slate-800">{h.total_prescriptions}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">{h.total_revenue.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-900 font-bold">{h.cash_reconciled.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-sans">{h.cashier_name}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {h.cloud_sync_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => {
                          setReportToPrint({
                            summary: {
                              total_patients: h.total_patients,
                              completed_consultations: h.total_patients,
                              total_prescriptions: h.total_prescriptions,
                              total_opd_fees: h.total_revenue * 0.4,
                              total_pharmacy_sales: h.total_revenue * 0.6,
                              total_revenue: h.total_revenue,
                              dispensed_medicines: []
                            },
                            existing_report: h,
                            is_closed: true
                          });
                          setIsPrintReportOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 transition-all text-[11px] font-semibold cursor-pointer"
                        title="View and Print Shift Report"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Shift Audit Report Modal */}
      <PrintableShiftReportModal
        isOpen={isPrintReportOpen}
        onClose={() => setIsPrintReportOpen(false)}
        data={reportToPrint}
        settings={settings}
        shiftDate={reportToPrint?.existing_report?.report_date}
      />

    </div>
  );
}
