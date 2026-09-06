import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Clock, 
  CheckCircle2, 
  Stethoscope, 
  Pill, 
  AlertCircle, 
  ChevronRight, 
  Thermometer, 
  Heart, 
  Wind, 
  Plus, 
  X,
  FileEdit,
  ShoppingCart,
  Printer,
  ShieldAlert,
  FlaskConical,
  Gauge,
  AlertTriangle,
  Zap,
  BedDouble
} from 'lucide-react';
import { api } from '../services/api';
import PrintableOPDRegisterModal from '../components/PrintableOPDRegisterModal';

const ICD10_PRESETS = [
  { code: 'B50.9', label: 'Falciparum Malaria', defaultPriority: 'Urgent' },
  { code: 'T63.0', label: 'Snake Venom Toxicity (20WBCT)', defaultPriority: 'Emergency' },
  { code: 'T14.1', label: 'Blast / Crush Laceration', defaultPriority: 'Emergency' },
  { code: 'T67.0', label: 'Heat Exhaustion / Dehydration', defaultPriority: 'Urgent' },
  { code: 'I10', label: 'Essential Hypertension', defaultPriority: 'Standard' },
  { code: 'J06.9', label: 'Acute Upper Resp Infection', defaultPriority: 'Standard' },
  { code: 'K29.7', label: 'Acute Gastritis / Dyspepsia', defaultPriority: 'Standard' }
];

const RAPID_LAB_TESTS = [
  'Malaria RDT (Pf/Pv)',
  '20WBCT Snakebite Venom Clotting Test',
  'Blood Glucose (Rapid)',
  'Dengue NS1 Ag',
  'Urine Dipstick Panel',
  'Full Blood Count (FBC)'
];

export default function OPDQueue({ settings, onOpenCheckIn, onOpenDispenseForPatient, refreshStats }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [isPrintRegisterOpen, setIsPrintRegisterOpen] = useState(false);
  
  // Vitals & Consultation Modal
  const [editingVisit, setEditingVisit] = useState(null);
  const [selectedLabOrders, setSelectedLabOrders] = useState([]);
  const [vitalsData, setVitalsData] = useState({
    bp: '',
    pulse: '',
    temp: '',
    resp_rate: '',
    spo2: '',
    weight: '',
    diagnosis: '',
    doctor_notes: '',
    triage_priority: 'Standard',
    consultation_fee: 15.0
  });

  const currency = settings?.currency_symbol || 'K';

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.getTodayVisits();
      setVisits(res.visits || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleStatusChange = async (visitId, newStatus) => {
    try {
      await api.updateVisitStatus(visitId, newStatus);
      fetchQueue();
      if (refreshStats) refreshStats();
    } catch (err) {
      alert(err.message);
    }
  };

  const openVitalsModal = (visit) => {
    setEditingVisit(visit);
    setSelectedLabOrders([]);
    setVitalsData({
      bp: visit.bp || '',
      pulse: visit.pulse || '',
      temp: visit.temp || '',
      resp_rate: visit.resp_rate || '',
      spo2: visit.spo2 || '',
      weight: visit.weight || '',
      diagnosis: visit.diagnosis || '',
      doctor_notes: visit.doctor_notes || '',
      triage_priority: visit.triage_priority || 'Standard',
      consultation_fee: visit.consultation_fee || 15.0
    });
  };

  const toggleLabOrder = (lab) => {
    setSelectedLabOrders(prev => 
      prev.includes(lab) ? prev.filter(l => l !== lab) : [...prev, lab]
    );
  };

  const applyIcdPreset = (preset) => {
    setVitalsData(prev => ({
      ...prev,
      diagnosis: `${preset.code} ${preset.label}`,
      triage_priority: prev.triage_priority === 'Emergency' ? 'Emergency' : preset.defaultPriority
    }));
  };

  const handleVitalsSubmit = async (e, proceedToPharmacy = false) => {
    e.preventDefault();
    try {
      const payload = {
        ...vitalsData,
        doctor_notes: selectedLabOrders.length > 0
          ? `${vitalsData.doctor_notes || ''}\n[DIAGNOSTIC ORDERS: ${selectedLabOrders.join(', ')}]`.trim()
          : vitalsData.doctor_notes
      };
      await api.updateVisitVitals(editingVisit.id, payload);
      if (proceedToPharmacy) {
        await api.updateVisitStatus(editingVisit.id, 'At Pharmacy');
      }
      setEditingVisit(null);
      fetchQueue();
      if (refreshStats) refreshStats();

      if (proceedToPharmacy) {
        onOpenDispenseForPatient({
          id: editingVisit.patient_id,
          full_name: editingVisit.patient_name,
          visit_id: editingVisit.id
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredVisits = visits.filter(v => {
    if (statusFilter === 'All') return true;
    return v.status === statusFilter;
  });

  const priorityBadge = (priority) => {
    if (priority === 'Emergency') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white animate-pulse">EMERGENCY</span>;
    }
    if (priority === 'Urgent') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">URGENT</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">Standard</span>;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-600" />
            <span>Today's OPD Queue & Clinical Triage</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time outpatient tracker: record clinical vitals, diagnose conditions, and advance triage flow.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPrintRegisterOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-semibold transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Print today's OPD register and clinical log"
          >
            <Printer className="w-4 h-4" />
            <span>Print Daily Register</span>
          </button>
          <button
            onClick={onOpenCheckIn}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Check-in Patient</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['All', 'Waiting', 'Triage / Vitals', 'In Consultation', 'At Pharmacy', 'Completed'].map((tab) => {
          const count = tab === 'All' ? visits.length : visits.filter(v => v.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                statusFilter === tab
                  ? 'bg-cyan-50 text-cyan-700 border border-cyan-300 font-bold shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${statusFilter === tab ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Visit #</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Chief Complaint / Notes</th>
                <th className="py-3 px-4">Vitals Summary</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">Loading today's queue...</td>
                </tr>
              ) : filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    No patients currently in this stage.
                  </td>
                </tr>
              ) : (
                filteredVisits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-600">
                      {v.visit_code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{v.patient_name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{v.age} Yrs • {v.gender} • <span className="text-cyan-700 font-semibold">{v.patient_code}</span></div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-800 font-medium">{v.reason}</p>
                      {v.diagnosis && (
                        <p className="text-emerald-700 text-[11px] font-bold mt-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">Dx: {v.diagnosis}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {v.bp || v.temp || v.pulse || v.spo2 ? (
                        <div className="space-y-0.5 text-slate-700">
                          {v.bp && <div>BP: {v.bp}</div>}
                          {v.temp && <div>Temp: {v.temp}</div>}
                          {v.spo2 && <div>SpO2: <span className="text-cyan-700 font-bold">{v.spo2}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No vitals recorded</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {priorityBadge(v.triage_priority)}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={v.status}
                        onChange={(e) => handleStatusChange(v.id, e.target.value)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1 border focus:outline-none transition-colors ${
                          v.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : v.status === 'At Pharmacy'
                            ? 'bg-purple-50 text-purple-700 border-purple-300'
                            : v.status === 'In Consultation'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="Waiting">Waiting</option>
                        <option value="Triage / Vitals">Triage / Vitals</option>
                        <option value="In Consultation">In Consultation</option>
                        <option value="At Pharmacy">At Pharmacy</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Record Vitals / Consult */}
                        <button
                          onClick={() => openVitalsModal(v)}
                          title="Record Vitals & Diagnosis"
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span>Vitals / Notes</span>
                        </button>
                        {/* Go to Dispensing */}
                        {v.status !== 'Completed' && (
                          <button
                            onClick={() => onOpenDispenseForPatient({ id: v.patient_id, full_name: v.patient_name, visit_id: v.id })}
                            title="Dispense Medications"
                            className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vitals & Clinical Examination Modal */}
      {editingVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden my-8 animate-scaleIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <span className="text-[10px] font-mono text-cyan-600 font-bold uppercase tracking-wider">Clinical Examination & CDS Suite</span>
                <h3 className="text-base font-bold text-slate-900">{editingVisit.patient_name}</h3>
                <p className="text-xs text-slate-500">Code: <span className="font-mono font-bold">{editingVisit.patient_code}</span> • Reason: {editingVisit.reason}</p>
              </div>
              <button onClick={() => setEditingVisit(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* PATIENT ALLERGY SAFETY CROSS-CHECK */}
            {editingVisit.allergies && editingVisit.allergies.toLowerCase() !== 'none' && editingVisit.allergies.toLowerCase() !== 'nil' && (
              <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 animate-pulse">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">Clinical Allergy Alert</h4>
                  <p className="text-xs text-rose-700 font-medium mt-0.5">
                    Patient has documented drug sensitivity: <strong className="underline">{editingVisit.allergies}</strong>. Verify all prescriptions prior to pharmacy dispensation.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={(e) => handleVitalsSubmit(e, false)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Vitals Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Vital Signs (Triage Intake)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">Live CDS Telemetry Active</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">Blood Pressure</label>
                    <input
                      type="text"
                      placeholder="e.g. 120/80"
                      value={vitalsData.bp}
                      onChange={(e) => setVitalsData({ ...vitalsData, bp: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">Pulse Rate (BPM)</label>
                    <input
                      type="text"
                      placeholder="e.g. 84"
                      value={vitalsData.pulse}
                      onChange={(e) => setVitalsData({ ...vitalsData, pulse: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">Body Temp (°C)</label>
                    <input
                      type="text"
                      placeholder="e.g. 38.6"
                      value={vitalsData.temp}
                      onChange={(e) => setVitalsData({ ...vitalsData, temp: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">Oxygen Sat (SpO2)</label>
                    <input
                      type="text"
                      placeholder="e.g. 98"
                      value={vitalsData.spo2}
                      onChange={(e) => setVitalsData({ ...vitalsData, spo2: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">Resp. Rate (/min)</label>
                    <input
                      type="text"
                      placeholder="e.g. 18"
                      value={vitalsData.resp_rate}
                      onChange={(e) => setVitalsData({ ...vitalsData, resp_rate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">Weight (kg)</label>
                    <input
                      type="text"
                      placeholder="e.g. 68"
                      value={vitalsData.weight}
                      onChange={(e) => setVitalsData({ ...vitalsData, weight: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono"
                    />
                  </div>
                </div>

                {/* CLINICAL DECISION SUPPORT (CDS) CALCULATIONS BAR */}
                {(() => {
                  const sbp = parseFloat((vitalsData.bp || '').split('/')[0]) || 0;
                  const dbp = parseFloat((vitalsData.bp || '').split('/')[1]) || 0;
                  const hr = parseFloat(vitalsData.pulse) || 0;
                  const temp = parseFloat(vitalsData.temp) || 0;
                  const spo2 = parseFloat(vitalsData.spo2) || 0;

                  const shockIndex = (sbp > 0 && hr > 0) ? (hr / sbp).toFixed(2) : null;
                  const isShockElevated = shockIndex && parseFloat(shockIndex) > 0.9;

                  const mapValue = (sbp > 0 && dbp > 0) ? Math.round((2 * dbp + sbp) / 3) : null;
                  const isMapLow = mapValue && mapValue < 65;

                  let news2 = 0;
                  if (hr) {
                    if (hr <= 40 || hr >= 131) news2 += 3;
                    else if (hr >= 111) news2 += 2;
                    else if (hr >= 91) news2 += 1;
                  }
                  if (temp) {
                    if (temp <= 35.0 || temp >= 39.1) news2 += 3;
                    else if (temp <= 36.0 || temp >= 38.1) news2 += 1;
                  }
                  if (spo2) {
                    if (spo2 <= 91) news2 += 3;
                    else if (spo2 <= 93) news2 += 2;
                    else if (spo2 <= 95) news2 += 1;
                  }

                  return (
                    <div className="mt-3 p-3 rounded-2xl bg-slate-100/90 border border-slate-200 grid grid-cols-3 gap-2 text-center">
                      <div className={`p-2 rounded-xl border ${isShockElevated ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-white border-slate-200 text-slate-800'}`}>
                        <span className="block text-[9px] font-mono uppercase text-slate-500 font-bold">Shock Index (HR/SBP)</span>
                        <span className="text-xs font-black">{shockIndex ? `${shockIndex}` : '—'}</span>
                        <span className="block text-[9px] font-semibold mt-0.5">{isShockElevated ? '⚠️ High Risk' : 'Normal (<0.9)'}</span>
                      </div>
                      <div className={`p-2 rounded-xl border ${isMapLow ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-white border-slate-200 text-slate-800'}`}>
                        <span className="block text-[9px] font-mono uppercase text-slate-500 font-bold">MAP (Perfusion)</span>
                        <span className="text-xs font-black">{mapValue ? `${mapValue} mmHg` : '—'}</span>
                        <span className="block text-[9px] font-semibold mt-0.5">{isMapLow ? '⚠️ Hypotension' : 'Adequate (≥65)'}</span>
                      </div>
                      <div className={`p-2 rounded-xl border ${news2 >= 4 ? 'bg-rose-50 border-rose-300 text-rose-800' : news2 >= 2 ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-800'}`}>
                        <span className="block text-[9px] font-mono uppercase text-slate-500 font-bold">NEWS2 Score</span>
                        <span className="text-xs font-black">{news2}</span>
                        <span className="block text-[9px] font-semibold mt-0.5">{news2 >= 4 ? '🔴 High Risk' : news2 >= 2 ? '🟡 Medium' : '🟢 Low Risk'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Diagnosis & Notes with ICD-10 Chips */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Clinical Diagnosis (PNG Protocol)</label>
                    <span className="text-[10px] text-slate-400 font-mono">1-Click ICD-10 Presets</span>
                  </div>

                  {/* 1-Click ICD-10 Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ICD10_PRESETS.map((preset) => (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => applyIcdPreset(preset)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 border border-slate-200 text-[10px] font-bold text-slate-700 transition-all cursor-pointer"
                      >
                        +{preset.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="e.g. B50.9 Plasmodium falciparum Malaria / Acute Bronchitis"
                    value={vitalsData.diagnosis}
                    onChange={(e) => setVitalsData({ ...vitalsData, diagnosis: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-medium"
                  />
                </div>

                {/* DIAGNOSTIC LAB ORDERS CHECKLIST */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                    <span>Diagnostic Lab & Rapid Test Orders</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    {RAPID_LAB_TESTS.map((lab) => {
                      const isChecked = selectedLabOrders.includes(lab);
                      return (
                        <button
                          key={lab}
                          type="button"
                          onClick={() => toggleLabOrder(lab)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-left transition-all flex items-center gap-2 border ${
                            isChecked
                              ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-purple-200'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold ${isChecked ? 'bg-purple-600 text-white' : 'border border-slate-300'}`}>
                            {isChecked ? '✓' : ''}
                          </span>
                          <span className="truncate">{lab}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor Clinical Observations & Notes</label>
                  <textarea
                    rows="3"
                    placeholder="Physical exam findings, medication recommendations..."
                    value={vitalsData.doctor_notes}
                    onChange={(e) => setVitalsData({ ...vitalsData, doctor_notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Triage Priority</label>
                    <select
                      value={vitalsData.triage_priority}
                      onChange={(e) => setVitalsData({ ...vitalsData, triage_priority: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    >
                      <option value="Standard">Standard (Green)</option>
                      <option value="Urgent">Urgent (Yellow)</option>
                      <option value="Emergency">Emergency (Red)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Consultation Fee ({currency})</label>
                    <input
                      type="number"
                      step="0.5"
                      value={vitalsData.consultation_fee}
                      onChange={(e) => setVitalsData({ ...vitalsData, consultation_fee: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingVisit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors"
                >
                  Save Vitals & Notes
                </button>
                <button
                  type="button"
                  onClick={(e) => handleVitalsSubmit(e, true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Save & Send to Pharmacy</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Daily OPD Register Modal */}
      <PrintableOPDRegisterModal
        isOpen={isPrintRegisterOpen}
        onClose={() => setIsPrintRegisterOpen(false)}
        visits={visits}
        settings={settings}
      />

    </div>
  );
}
