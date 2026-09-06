import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, X, ShieldAlert, Award, FileText, CreditCard } from 'lucide-react';

export default function PatientCardModal({ isOpen, onClose, patient, hospital }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [cardMode, setCardMode] = useState('print'); // 'print' or 'preview'

  useEffect(() => {
    if (patient) {
      const qrPayload = JSON.stringify({
        code: patient.patient_code,
        name: patient.full_name,
        blood: patient.blood_group || 'Unknown',
        allergies: patient.allergies || 'None',
        clinic: hospital?.name || 'Lloyds Metals Clinic'
      });
      QRCode.toDataURL(qrPayload, { 
        width: 160, 
        margin: 1, 
        color: { dark: '#000000', light: '#FFFFFF' } 
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error(err));
    }
  }, [patient, hospital]);

  if (!isOpen || !patient) return null;

  return (
    <div className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="printable-modal-card relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6">
        
        {/* Actions Bar (Hidden on Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90">
          <div>
            <span className="text-sm font-display font-black text-slate-900 block">Patient Digital Health Card</span>
            <span className="text-xs text-slate-500 font-mono">{patient.patient_code}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setCardMode('print')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  cardMode === 'print' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paper Badge</span>
              </button>
              <button
                type="button"
                onClick={() => setCardMode('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  cardMode === 'preview' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>OLED Card</span>
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-display font-bold text-xs shadow-md shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Card</span>
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="printable-area p-8 flex flex-col items-center justify-center bg-white text-slate-900 font-sans">
          
          {cardMode === 'preview' ? (
            /* Digital HUD Card Preview */
            <div className="w-[380px] h-[230px] rounded-2xl bg-gradient-to-tr from-[#08172E] via-[#0F2744] to-[#163761] border border-cyan-500/40 p-4 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-28 h-28 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
                <img src="/lloyds_metals_logo.png" alt="Lloyds Metals" className="h-5 w-auto object-contain" />
                <span className="text-[9px] font-mono font-bold text-red-400 uppercase tracking-widest px-2 py-0.5 rounded bg-red-950/60 border border-red-800/60">
                  PNG CLINIC ID
                </span>
              </div>

              <div className="flex items-center justify-between my-auto py-1">
                <div className="space-y-1 pr-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Patient Code</div>
                  <div className="text-sm font-mono font-bold text-cyan-300">{patient.patient_code}</div>
                  <div className="text-sm font-bold text-white leading-tight mt-1">{patient.full_name}</div>
                  <div className="text-[11px] text-slate-300">
                    {patient.age} Yrs • {patient.gender} • <span className="text-emerald-400 font-semibold">{patient.blood_group || 'N/A'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                    {patient.address_or_village ? `${patient.address_or_village}, ` : ''}{patient.province || 'PNG'}
                  </div>
                </div>

                <div className="bg-white p-1 rounded-xl shadow-md shrink-0">
                  {qrDataUrl && <img src={qrDataUrl} alt="Patient QR" className="w-20 h-20" />}
                </div>
              </div>

              <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[9px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  <span>Allergies: <strong className="text-slate-200">{patient.allergies || 'None'}</strong></span>
                </span>
                <span className="font-mono text-cyan-400">Emerg: {patient.emergency_contact?.slice(0, 14) || 'Clinic'}</span>
              </div>
            </div>
          ) : (
            /* Institutional Paper Badge & A4 Medical Card (Crisp High-Contrast Print) */
            <div className="w-full max-w-[440px] border-2 border-dashed border-slate-400 p-2 rounded-xl bg-slate-50/50">
              <div className="text-[9px] text-center text-slate-400 font-mono uppercase pb-1 no-print">
                ✂ Cut along dashed border for standard pocket badge size (95mm × 65mm)
              </div>

              <div className="w-full bg-white border-2 border-slate-900 rounded-lg p-4 text-slate-900 shadow-sm flex flex-col justify-between">
                
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/lloyds_metals_logo.png" alt="Lloyds Metals" className="h-6 object-contain" />
                    <div>
                      <span className="text-[8px] font-black uppercase text-red-600 block leading-none">LLOYDS METALS & ENERGY</span>
                      <span className="text-[7px] text-slate-600 font-bold block uppercase">OCCUPATIONAL HEALTH CENTRE</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 border border-slate-900 rounded bg-slate-100 uppercase">
                      OFFICIAL HEALTH PASS
                    </span>
                  </div>
                </div>

                {/* Patient Body */}
                <div className="grid grid-cols-3 gap-2 py-3 items-center">
                  <div className="col-span-2 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">Patient Name:</span>
                    <h3 className="text-base font-black text-slate-950 uppercase leading-none">{patient.full_name}</h3>
                    
                    <div className="grid grid-cols-2 gap-1 pt-1 text-[10px]">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[8px] uppercase">ID Number:</span>
                        <strong className="font-mono text-slate-900">{patient.patient_code}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[8px] uppercase">Age / Gender:</span>
                        <span className="font-semibold text-slate-800">{patient.age} Yrs / {patient.gender}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 pt-0.5 text-[10px]">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[8px] uppercase">Blood Group:</span>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 border border-red-300 font-black text-red-800 font-mono text-[10px]">
                          {patient.blood_group || 'UNTESTED'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[8px] uppercase">Village / District:</span>
                        <span className="text-slate-700 font-medium truncate block text-[9px]">
                          {patient.address_or_village || patient.district || 'Concession'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* High Clarity QR Code */}
                  <div className="flex flex-col items-center justify-center p-1 border border-slate-300 rounded bg-white">
                    {qrDataUrl && <img src={qrDataUrl} alt="Patient QR" className="w-24 h-24 object-contain" />}
                    <span className="text-[7px] font-mono text-slate-500 uppercase mt-0.5">Scan For History</span>
                  </div>
                </div>

                {/* Critical Alert & Emergency Bar */}
                <div className="pt-2 border-t border-slate-300 space-y-1 text-[9px]">
                  <div className="p-1.5 rounded bg-amber-50 border border-amber-300 flex items-start gap-1.5">
                    <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-900 uppercase text-[8px]">Allergies & Medical Alerts: </strong>
                      <span className="text-amber-800 font-semibold">{patient.allergies || 'None Known'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[8px] text-slate-600 pt-1">
                    <span>Emergency Contact: <strong className="text-slate-900">{patient.emergency_contact || 'Clinic Dispatch'}</strong></span>
                    <span className="font-mono">Reg: {hospital?.reg_number || 'LMEL-PNG'}</span>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
