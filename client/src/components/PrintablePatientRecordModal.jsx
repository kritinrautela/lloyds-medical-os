import React from 'react';
import { Printer, X, FileText, User, ShieldAlert, Heart, Calendar, Clock, Pill } from 'lucide-react';

export default function PrintablePatientRecordModal({ isOpen, onClose, data, settings }) {
  if (!isOpen || !data) return null;

  const { patient, visits = [], dispensations = [] } = data;
  const currency = settings?.currency_symbol || 'K';

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
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-white">Patient Medical Record & Clinical History</h3>
              <p className="text-xs text-slate-400 font-mono">Unique ID: {patient.patient_code}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Medical File (A4 / PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area (A4 Portrait Paper) */}
        <div className="printable-area p-8 sm:p-12 bg-white text-slate-900 font-sans leading-normal">
          
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <img src="/lloyds_metals_logo.png" alt="Lloyds Metals" className="h-8 object-contain" />
                  <div className="border-l-2 border-red-600 pl-3">
                    <span className="text-[9px] font-bold tracking-widest text-red-600 uppercase font-mono block">
                      Occupational Health & Community Clinical Services
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
                  <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Document Type</span>
                  <span className="text-xs font-black text-slate-900 tracking-wider font-mono">PATIENT MEDICAL FILE</span>
                </div>
                <p className="text-[11px] text-cyan-900 font-mono pt-1">
                  Unique ID: <strong className="font-bold text-slate-950">{patient.patient_code}</strong>
                </p>
                <p className="text-[10px] text-slate-500">
                  Reg Date: <span className="font-mono">{patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'Active Record'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Patient Demographic Card */}
          <div className="my-5 p-4 bg-slate-50 border border-slate-300 rounded-lg">
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="col-span-2">
                <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Full Patient Name</span>
                <span className="text-sm font-black text-slate-950 uppercase">{patient.full_name}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Age / Gender</span>
                <span className="font-bold text-slate-800">{patient.age} Years / {patient.gender}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Blood Group</span>
                <span className="inline-block px-2 py-0.5 rounded bg-red-100 border border-red-300 font-black text-red-800 font-mono text-[10px]">
                  {patient.blood_group || 'UNTESTED'}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Village / Compound</span>
                <span className="text-slate-800 font-medium">{patient.address_or_village || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Province / District</span>
                <span className="text-slate-800 font-medium">{patient.province || 'Morobe Province'}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Phone Contact</span>
                <span className="font-mono text-slate-800">{patient.phone || 'No phone'}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Emergency Kin</span>
                <span className="text-slate-800 truncate block">{patient.emergency_contact || 'Clinic Dispatch'}</span>
              </div>
            </div>

            {/* Critical Allergy Alert Banner */}
            <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase font-bold text-red-700 font-mono">KNOWN DRUG ALLERGIES:</span>
                <span className="font-bold text-red-900 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {patient.allergies && patient.allergies !== 'None' ? patient.allergies : 'No Known Drug Allergies (NKDA)'}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                Baseline History: <span className="italic text-slate-700">{patient.medical_history || 'None reported'}</span>
              </div>
            </div>
          </div>

          {/* Longitudinal Visits & Clinical Encounters */}
          <div className="mb-6 avoid-break">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-3 flex items-center gap-1.5">
              <span>CLINICAL VISITS & ENCOUNTER TIMELINE ({visits.length} ENCOUNTERS)</span>
            </h3>

            {visits.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-300 rounded">
                No past clinical encounters recorded for this patient.
              </p>
            ) : (
              <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                    <th className="border border-slate-300 p-1.5 text-center">#</th>
                    <th className="border border-slate-300 p-1.5">Date & Code</th>
                    <th className="border border-slate-300 p-1.5 text-center">Priority</th>
                    <th className="border border-slate-300 p-1.5 text-center">Vital Signs</th>
                    <th className="border border-slate-300 p-1.5">Diagnosis & Physician Notes</th>
                    <th className="border border-slate-300 p-1.5 text-right">Fee ({currency})</th>
                    <th className="border border-slate-300 p-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visits.map((v, idx) => (
                    <tr key={v.id || idx} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                      <td className="border border-slate-300 p-1.5 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 p-1.5 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900">{v.visit_date}</div>
                        <div className="text-[9px] text-slate-500">{v.visit_code}</div>
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] uppercase ${
                          v.triage_priority === 'Immediate' ? 'bg-red-100 text-red-800' :
                          v.triage_priority === 'Very Urgent' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {v.triage_priority || 'Standard'}
                        </span>
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center font-mono text-[9px] text-slate-800">
                        {v.bp ? `BP: ${v.bp}` : ''} {v.pulse ? `• HR: ${v.pulse}` : ''} {v.spo2 ? `• ${v.spo2}%` : ''}
                        {!v.bp && !v.pulse && <span className="text-slate-400 italic">-</span>}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-slate-800 max-w-[220px]">
                        <div className="font-semibold text-slate-900">{v.diagnosis || v.reason || 'Consultation'}</div>
                        {v.doctor_notes && <div className="text-[9px] text-slate-600 italic">{v.doctor_notes}</div>}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono font-bold text-slate-900">
                        {parseFloat(v.consultation_fee || 0).toFixed(2)}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center">
                        <span className="text-[8px] uppercase font-bold text-emerald-800">
                          {v.status || 'Completed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pharmacy Prescription History */}
          <div className="mb-6 avoid-break">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-3 flex items-center gap-1.5">
              <span>PHARMACY DISPENSATION HISTORY ({dispensations.length} INVOICES)</span>
            </h3>

            {dispensations.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-300 rounded">
                No pharmacy dispensations recorded for this patient.
              </p>
            ) : (
              <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                    <th className="border border-slate-300 p-1.5">Invoice #</th>
                    <th className="border border-slate-300 p-1.5">Date</th>
                    <th className="border border-slate-300 p-1.5">Prescribed Medicines & Dosages</th>
                    <th className="border border-slate-300 p-1.5 text-right">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dispensations.map((d, idx) => (
                    <tr key={d.id || idx}>
                      <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900">
                        {d.invoice_number}
                      </td>
                      <td className="border border-slate-300 p-1.5 font-mono text-slate-600">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-slate-800 font-medium">
                        {d.drugs_summary || 'Formulary items'}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono font-bold text-slate-900">
                        {parseFloat(d.paid_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Authorization & Certification */}
          <div className="pt-4 border-t-2 border-slate-900 avoid-break">
            <div className="grid grid-cols-2 gap-6 text-center text-xs">
              <div className="border border-slate-300 rounded p-3 bg-white">
                <span className="text-[9px] font-bold uppercase text-slate-600 block">Attending Medical Officer</span>
                <div className="border-t border-slate-400 pt-1 mt-6">
                  <strong className="block text-slate-900 text-xs">
                    {settings?.doctor_in_charge || 'Chief Medical Officer'}
                  </strong>
                  <span className="text-[8px] text-slate-500 block">Clinical Assessment Sign-Off</span>
                </div>
              </div>

              <div className="border-2 border-dashed border-red-300 rounded p-3 bg-red-50/20">
                <span className="text-[9px] font-bold uppercase text-red-800 block">Concession Medical Seal</span>
                <div className="my-auto text-[8px] text-slate-400 italic py-2">Affix Official Stamp Here</div>
                <span className="text-[8px] text-slate-400 font-mono uppercase">Certified Patient Record</span>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[8px] text-slate-400 flex justify-between items-center">
              <span>Lloyds Metals & Energy Ltd Healthcare Operating System</span>
              <span>File Printed: {new Date().toLocaleString()}</span>
              <span>Reg: {settings?.reg_number || 'PNG-MOH-LMEL-2026'}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
