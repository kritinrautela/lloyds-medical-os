import React from 'react';
import { Printer, X, Users, Activity, FileText, CheckCircle2 } from 'lucide-react';

export default function PrintableOPDRegisterModal({ isOpen, onClose, visits = [], settings }) {
  if (!isOpen) return null;

  const currency = settings?.currency_symbol || 'K';
  const todayStr = new Date().toISOString().split('T')[0];

  const handlePrint = () => {
    window.print();
  };

  const totalPatients = visits.length;
  const completedCount = visits.filter(v => v.status === 'Completed').length;
  const emergencyCount = visits.filter(v => v.triage_priority === 'Immediate' || v.triage_priority === 'Very Urgent').length;
  const totalFees = visits.reduce((acc, v) => acc + (parseFloat(v.consultation_fee) || 0), 0);

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="printable-modal-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 pb-12 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="printable-modal-card relative w-full max-w-5xl bg-[#091528] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-4">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-white">Daily OPD Patient Register & Clinical Census</h3>
              <p className="text-xs text-slate-400">Institutional health ministry format (A4 Landscape Print / PDF)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print OPD Register (A4 / PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="printable-area p-8 sm:p-10 bg-white text-slate-900 font-sans leading-normal">
          
          {/* Official Letterhead Header */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <img 
                    src="/lloyds_metals_logo.png" 
                    alt="Lloyds Metals" 
                    className="h-8 object-contain"
                  />
                  <div className="border-l-2 border-red-600 pl-3">
                    <span className="text-[9px] font-bold tracking-widest text-red-600 uppercase font-mono block">
                      Occupational Health & Outpatient Department
                    </span>
                    <h1 className="text-base font-black text-slate-950 tracking-tight leading-none uppercase">
                      {settings?.name || 'LLOYDS METALS & ENERGY LTD'}
                    </h1>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 font-medium pt-1">
                  {settings?.tagline || 'Community Health Centre & Emergency Trauma Post — Papua New Guinea'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {settings?.address || 'Mining Concession Base'} | {settings?.district || 'Lae Urban'}, {settings?.province || 'Morobe Province'}
                </p>
              </div>

              <div className="text-right space-y-1">
                <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Document Title</span>
                  <span className="text-xs font-black text-slate-900 tracking-wider font-mono">OPD CLINICAL REGISTER</span>
                </div>
                <p className="text-[10px] text-slate-600 font-mono pt-1">
                  Register Date: <strong>{todayStr}</strong>
                </p>
                <p className="text-[10px] text-slate-500">
                  Reg No: <strong>{settings?.reg_number || 'PNG-MOH-LMEL-2026'}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="my-4 p-3 bg-slate-50 border border-slate-300 rounded-lg grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Patients</span>
              <span className="text-sm font-black text-slate-900">{totalPatients}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Discharged / Completed</span>
              <span className="text-sm font-black text-emerald-800">{completedCount}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Immediate / High Risk</span>
              <span className="text-sm font-black text-red-700">{emergencyCount}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Consultation Fees</span>
              <span className="text-sm font-black text-slate-950 font-mono">{currency} {totalFees.toFixed(2)}</span>
            </div>
          </div>

          {/* Patient Register Table */}
          <div className="mb-6">
            <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                  <th className="border border-slate-300 p-1.5 text-center">#</th>
                  <th className="border border-slate-300 p-1.5">Time</th>
                  <th className="border border-slate-300 p-1.5">Patient ID & Name</th>
                  <th className="border border-slate-300 p-1.5 text-center">Age / Sex</th>
                  <th className="border border-slate-300 p-1.5 text-center">Triage Priority</th>
                  <th className="border border-slate-300 p-1.5 text-center">Vital Signs</th>
                  <th className="border border-slate-300 p-1.5">Diagnosis / Chief Complaint</th>
                  <th className="border border-slate-300 p-1.5 text-right">Fee ({currency})</th>
                  <th className="border border-slate-300 p-1.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visits.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-4 text-center text-slate-500 italic">
                      No patients registered in today's OPD log book yet.
                    </td>
                  </tr>
                ) : (
                  visits.map((v, idx) => (
                    <tr key={v.id || idx} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                      <td className="border border-slate-300 p-1.5 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 p-1.5 font-mono text-slate-700 whitespace-nowrap">
                        {v.visit_time || '08:00'}
                      </td>
                      <td className="border border-slate-300 p-1.5">
                        <div className="font-bold text-slate-900">{v.patient_name}</div>
                        <div className="font-mono text-[9px] text-slate-500">{v.patient_code}</div>
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center text-slate-700 whitespace-nowrap">
                        {v.age}y / {v.gender ? v.gender.charAt(0) : '-'}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] uppercase ${
                          v.triage_priority === 'Immediate' ? 'bg-red-100 text-red-800' :
                          v.triage_priority === 'Very Urgent' ? 'bg-amber-100 text-amber-800' :
                          v.triage_priority === 'Urgent' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {v.triage_priority || 'Standard'}
                        </span>
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center font-mono text-[9px] text-slate-800">
                        {v.bp ? `BP: ${v.bp}` : ''} {v.pulse ? `• HR: ${v.pulse}` : ''} {v.spo2 ? `• SpO2: ${v.spo2}%` : ''}
                        {!v.bp && !v.pulse && <span className="text-slate-400 italic">Not recorded</span>}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-slate-800 max-w-[200px]">
                        <div className="font-semibold">{v.diagnosis || v.chief_complaint || 'General Clinical Review'}</div>
                        {v.doctor_notes && <div className="text-[8px] text-slate-500 italic truncate">{v.doctor_notes}</div>}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {parseFloat(v.consultation_fee || 0).toFixed(2)}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center whitespace-nowrap">
                        <span className={`font-semibold text-[8px] uppercase ${
                          v.status === 'Completed' ? 'text-emerald-700 font-bold' : 'text-slate-600'
                        }`}>
                          {v.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Authorization Footer */}
          <div className="pt-4 border-t-2 border-slate-900 avoid-break">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              
              <div className="flex flex-col justify-between h-24 border border-slate-300 rounded p-2 bg-white">
                <span className="text-[9px] font-bold uppercase text-slate-600 block">Triage Nurse / Intake Officer</span>
                <div className="border-t border-slate-400 pt-1 mt-auto">
                  <span className="text-[9px] text-slate-500 block">Signature & Staff ID</span>
                </div>
              </div>

              <div className="flex flex-col justify-between h-24 border border-slate-300 rounded p-2 bg-white">
                <span className="text-[9px] font-bold uppercase text-slate-600 block">Attending Medical Officer</span>
                <div className="border-t border-slate-400 pt-1 mt-auto">
                  <strong className="block text-slate-900 text-xs">
                    {settings?.doctor_in_charge || 'Medical Officer'}
                  </strong>
                  <span className="text-[9px] text-slate-500 block">Signature & Stamp</span>
                </div>
              </div>

              <div className="flex flex-col justify-between h-24 border-2 border-dashed border-red-300 rounded p-2 bg-red-50/20">
                <span className="text-[9px] font-bold uppercase text-red-800 block">Hospital Seal</span>
                <div className="my-auto text-[8px] text-slate-400 italic">Official Lloyds Clinical Stamp</div>
              </div>

            </div>

            <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[8px] text-slate-400 flex justify-between items-center">
              <span>Lloyds Metals & Energy Ltd • Rural Health Care Initiative</span>
              <span>Printed: {new Date().toLocaleString()}</span>
              <span>Confidential Patient Record • For Hospital Records Only</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
