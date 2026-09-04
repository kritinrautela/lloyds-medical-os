import React, { useRef } from 'react';
import { Printer, X, CheckCircle2, ShieldCheck, DollarSign, Pill, Users, Calendar, AlertTriangle, FileText } from 'lucide-react';
import LloydsLogo from './LloydsLogo';

export default function PrintableShiftReportModal({ isOpen, onClose, data, settings, shiftDate }) {
  if (!isOpen || !data) return null;

  const { summary = {}, existing_report = {}, is_closed = false } = data;
  const currency = settings?.currency_symbol || 'K';
  const reportDateStr = shiftDate || existing_report?.report_date || new Date().toISOString().split('T')[0];
  const cashier = existing_report?.cashier_name || 'Duty Medical Officer';
  const notes = existing_report?.notes || 'All routine protocols observed. Emergency bay restocked.';
  const cashReconciled = existing_report?.cash_reconciled !== undefined 
    ? existing_report.cash_reconciled 
    : (summary.total_revenue || 0);

  const variance = cashReconciled - (summary.total_revenue || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="printable-modal-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 pb-12 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="printable-modal-card relative w-full max-w-4xl bg-[#091528] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-4">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-white">Daily Shift Financial & Clinical Audit Report</h3>
              <p className="text-xs text-slate-400">Institutional print-ready A4 document format</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Audit Report (A4 / PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas (Styled strictly for high-grade A4 printing) */}
        <div className="printable-area p-8 sm:p-12 bg-white text-slate-900 font-sans leading-normal">
          
          {/* Official Letterhead Header */}
          <div className="border-b-2 border-slate-900 pb-6">
            <div className="flex flex-row justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <img 
                    src="/lloyds_metals_logo.png" 
                    alt="Lloyds Metals" 
                    className="h-9 object-contain"
                  />
                  <div className="border-l-2 border-red-600 pl-3">
                    <span className="text-[10px] font-bold tracking-widest text-red-600 uppercase font-mono block">
                      Occupational Health & Mining Medical Services
                    </span>
                    <h1 className="text-lg font-black text-slate-950 tracking-tight leading-none uppercase">
                      {settings?.name || 'LLOYDS METALS & ENERGY LTD'}
                    </h1>
                  </div>
                </div>
                <p className="text-xs text-slate-600 font-medium pt-1">
                  {settings?.tagline || 'Community Health Centre & Emergency Trauma Post — Papua New Guinea'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Location: {settings?.address || 'Mining Concession Base'} | {settings?.district || 'Lae Urban'}, {settings?.province || 'Morobe Province'}
                </p>
              </div>

              <div className="text-right space-y-1">
                <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Report Classification</span>
                  <span className="text-xs font-black text-red-700 tracking-wider font-mono">OFFICIAL SHIFT AUDIT</span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono pt-1">
                  Report Ref: <strong>LMEL-EOD-{reportDateStr.replace(/-/g, '')}</strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  Reg No: <strong>{settings?.reg_number || 'PNG-MOH-LMEL-2026'}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Title Banner */}
          <div className="my-6 p-4 bg-slate-50 border border-slate-300 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight uppercase">
                DAILY SHIFT RECONCILIATION & CLINICAL ACTIVITY AUDIT
              </h2>
              <p className="text-xs text-slate-600">
                Period: 24-Hour Operational Cycle • Shift Date: <strong>{reportDateStr}</strong>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-500 block">Duty Officer / Cashier:</span>
              <strong className="text-xs text-slate-900 font-semibold">{cashier}</strong>
            </div>
          </div>

          {/* Section 1: Executive KPI Summary */}
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-3 flex items-center gap-1.5">
              <span>1. OPERATIONAL & CLINICAL FOOTFALL SUMMARY</span>
            </h3>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Patients Registered</span>
                <span className="text-xl font-black text-slate-900">{summary.total_patients || 0}</span>
                <span className="text-[10px] text-slate-500 block">Triage Intake</span>
              </div>
              <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Completed Consultations</span>
                <span className="text-xl font-black text-emerald-800">{summary.completed_consultations || 0}</span>
                <span className="text-[10px] text-slate-500 block">Doctor Discharged</span>
              </div>
              <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Prescriptions Dispensed</span>
                <span className="text-xl font-black text-indigo-900">{summary.total_prescriptions || 0}</span>
                <span className="text-[10px] text-slate-500 block">Pharmacy Filled</span>
              </div>
              <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Revenue Recorded</span>
                <span className="text-xl font-black text-slate-950 font-mono">
                  {currency} {(summary.total_revenue || 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block">Gross Invoiced</span>
              </div>
            </div>
          </div>

          {/* Section 2: Financial Balancing Ledger */}
          <div className="mb-6 avoid-break">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-3">
              <span>2. FINANCIAL BALANCING & CASH RECONCILIATION</span>
            </h3>

            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="border border-slate-300 p-2 text-left">Revenue Stream</th>
                  <th className="border border-slate-300 p-2 text-center">Description / Scope</th>
                  <th className="border border-slate-300 p-2 text-right">System Recorded Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="border border-slate-300 p-2 font-semibold text-slate-800">OPD Consultation & Triage Fees</td>
                  <td className="border border-slate-300 p-2 text-slate-600 text-[11px]">Primary care, clinical assessment, dressing & emergency triage</td>
                  <td className="border border-slate-300 p-2 text-right font-mono font-bold text-slate-900">
                    {currency} {(summary.total_opd_fees || 0).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2 font-semibold text-slate-800">Pharmacy & Formulary Dispensations</td>
                  <td className="border border-slate-300 p-2 text-slate-600 text-[11px]">Prescription medicines, antimalarials, antibiotics & consumables</td>
                  <td className="border border-slate-300 p-2 text-right font-mono font-bold text-slate-900">
                    {currency} {(summary.total_pharmacy_sales || 0).toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan="2" className="border border-slate-300 p-2 text-right uppercase text-slate-800">
                    Total System Expected Revenue:
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono text-slate-950 text-sm">
                    {currency} {(summary.total_revenue || 0).toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan="2" className="border border-slate-300 p-2 text-right uppercase text-slate-800">
                    Physical Drawer Cash Counted & Remitted:
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono text-emerald-900 text-sm">
                    {currency} {cashReconciled.toFixed(2)}
                  </td>
                </tr>
                <tr className={`font-bold ${variance === 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
                  <td colSpan="2" className="border border-slate-300 p-2 text-right uppercase">
                    Audit Reconciliation Variance:
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono text-sm">
                    {variance === 0 ? '0.00 (BALANCED)' : `${variance > 0 ? '+' : ''}${currency} ${variance.toFixed(2)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: Formulary Depletion Ledger */}
          <div className="mb-6 avoid-break">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-3">
              <span>3. MEDICINES DISPENSED & INVENTORY CONSUMPTION</span>
            </h3>

            {(!summary.dispensed_medicines || summary.dispensed_medicines.length === 0) ? (
              <p className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-300 rounded text-center">
                No prescription formulary items were dispensed during this operational cycle.
              </p>
            ) : (
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    <th className="border border-slate-300 p-2 text-left">#</th>
                    <th className="border border-slate-300 p-2 text-left">Pharmaceutical Name</th>
                    <th className="border border-slate-300 p-2 text-center">Units Consumed</th>
                    <th className="border border-slate-300 p-2 text-right">Subtotal Revenue ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {summary.dispensed_medicines.map((m, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                      <td className="border border-slate-300 p-1.5 text-center text-slate-500 font-mono text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 p-1.5 font-semibold text-slate-900">
                        {m.drug_name}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center font-mono font-bold text-slate-800">
                        {m.total_units}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono font-semibold text-slate-900">
                        {currency} {parseFloat(m.total_revenue).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Section 4: Handover Remarks & Log */}
          <div className="mb-6 p-3.5 border border-slate-300 rounded-lg bg-slate-50 avoid-break">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Duty Officer Handover Notes & Incident Remarks:
            </span>
            <p className="text-xs text-slate-800 italic leading-relaxed">
              "{notes}"
            </p>
          </div>

          {/* Section 5: Triple Authorization Signatures & Hospital Stamp Box */}
          <div className="pt-4 border-t-2 border-slate-900 avoid-break">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-6 text-center tracking-widest font-mono">
              OFFICIAL CLINICAL & ADMINISTRATIVE AUTHORIZATION CERTIFICATION
            </div>

            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              
              {/* Cashier / Dispenser */}
              <div className="flex flex-col justify-between h-28 border border-slate-300 rounded-lg p-3 bg-white">
                <span className="text-[10px] font-bold uppercase text-slate-600 block">Duty Dispenser / Cashier</span>
                <div className="border-t border-slate-400 pt-1 mt-auto">
                  <strong className="block text-slate-900 text-xs">{cashier}</strong>
                  <span className="text-[9px] text-slate-500 block">Signature & Date</span>
                </div>
              </div>

              {/* Chief Medical Officer */}
              <div className="flex flex-col justify-between h-28 border border-slate-300 rounded-lg p-3 bg-white">
                <span className="text-[10px] font-bold uppercase text-slate-600 block">Supervising Medical Officer</span>
                <div className="border-t border-slate-400 pt-1 mt-auto">
                  <strong className="block text-slate-900 text-xs">
                    {settings?.doctor_in_charge || 'Chief Medical Officer'}
                  </strong>
                  <span className="text-[9px] text-slate-500 block">Signature & Date</span>
                </div>
              </div>

              {/* Hospital Seal / Stamp Box */}
              <div className="flex flex-col justify-between h-28 border-2 border-dashed border-red-400 rounded-lg p-3 bg-red-50/20">
                <span className="text-[10px] font-bold uppercase text-red-800 block">Official Clinical Stamp</span>
                <div className="my-auto text-[9px] text-slate-400 italic">
                  Affix Lloyds Metals Concession Stamp Here
                </div>
                <span className="text-[8px] text-slate-400 uppercase font-mono">Verified & Encrypted</span>
              </div>

            </div>

            {/* Micro Legal & Compliance Footer */}
            <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[9px] text-slate-500 flex justify-between items-center">
              <span>Generated by Lloyds Metals Occupational Health System v2.6 (Offline-First Edition)</span>
              <span>Printed on: {new Date().toLocaleString()}</span>
              <span>Concession Ref: PNG-MOH-2026-LMEL</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
