import React, { useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Plus, 
  Send, 
  User,
  Building2,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { sounds } from '../utils/soundEffects';

export default function ActivityBlackBox({ activities = [], onLogNewActivity }) {
  const { currentUser } = useAuth();
  const [filterStation, setFilterStation] = useState('All');
  const [searchVal, setSearchVal] = useState('');
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickAction, setQuickAction] = useState('Clinical Observation');
  const [quickLocation, setQuickLocation] = useState('Triage Station');
  const [quickDetails, setQuickDetails] = useState('');
  const [quickPatient, setQuickPatient] = useState('');
  const [quickSeverity, setQuickSeverity] = useState('Info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredLogs = activities.filter(log => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchVal.toLowerCase()) ||
      log.patient_name?.toLowerCase().includes(searchVal.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchVal.toLowerCase()) ||
      log.action_type?.toLowerCase().includes(searchVal.toLowerCase());
    const matchesStation = filterStation === 'All' || log.location?.toLowerCase().includes(filterStation.toLowerCase());
    return matchesSearch && matchesStation;
  });

  const handleQuickLogSubmit = async (e) => {
    e.preventDefault();
    if (!quickDetails.trim()) return;

    setIsSubmitting(true);
    try {
      await api.request ? api.request('/dashboard/activities', {
        method: 'POST',
        body: JSON.stringify({
          action_type: quickAction,
          user_name: currentUser?.full_name || 'Chief Medical Officer',
          user_role: currentUser?.role || 'Medical Officer',
          patient_name: quickPatient.trim() || null,
          location: quickLocation,
          details: quickDetails.trim(),
          severity: quickSeverity
        })
      }) : fetch('/api/dashboard/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: quickAction,
          user_name: currentUser?.full_name || 'Chief Medical Officer',
          user_role: currentUser?.role || 'Medical Officer',
          patient_name: quickPatient.trim() || null,
          location: quickLocation,
          details: quickDetails.trim(),
          severity: quickSeverity
        })
      });

      sounds.playSuccessChime();
      setQuickDetails('');
      setQuickPatient('');
      setIsQuickLogOpen(false);
      if (onLogNewActivity) onLogNewActivity();
      else window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'Emergency':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/80 border border-red-800 text-red-300 animate-pulse">EMERGENCY</span>;
      case 'Warning':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 border border-amber-800 text-amber-300">ALERT</span>;
      case 'Success':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 border border-emerald-800 text-emerald-300">VERIFIED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">TELEMETRY</span>;
    }
  };

  return (
    <div className="bg-[#0B1528] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-500" />
              <span>Hospital Action Black Box & Telemetry Recorder</span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time chronological log of medical procedures, drug dispensations, RDT tests, and staff actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQuickLogOpen(!isQuickLogOpen)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs shadow-md shadow-red-950/40 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Record Action</span>
          </button>
        </div>
      </div>

      {/* Quick Action Input Form (Collapsible) */}
      {isQuickLogOpen && (
        <form onSubmit={handleQuickLogSubmit} className="p-4 rounded-xl bg-[#070D18] border border-slate-700/80 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">
              Log Clinical Action as <span className="text-red-400">{currentUser?.full_name}</span> ({currentUser?.role})
            </span>
            <button
              type="button"
              onClick={() => setIsQuickLogOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Action Type</label>
              <select
                value={quickAction}
                onChange={(e) => setQuickAction(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="Clinical Observation">Clinical Observation</option>
                <option value="Emergency Admission">Emergency Admission</option>
                <option value="Malaria RDT Performed">Malaria RDT Performed</option>
                <option value="Medication Dispensed">Medication Dispensed</option>
                <option value="Antivenom Inspection">Antivenom Inspection</option>
                <option value="OHS Inspection">OHS Inspection</option>
                <option value="Bed Sanitization">Bed Sanitization</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Station Location</label>
              <select
                value={quickLocation}
                onChange={(e) => setQuickLocation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="Emergency Crash Bay 1">Emergency Crash Bay 1</option>
                <option value="Triage Station">Triage Station</option>
                <option value="Doctor Consult 1">Doctor Consult 1</option>
                <option value="Pharmacy POS Counter">Pharmacy POS Counter</option>
                <option value="Pathology Lab">Pathology Lab</option>
                <option value="Tropical Ward Beds">Tropical Ward Beds</option>
                <option value="Conveyor Pit 3 OHS">Conveyor Pit 3 OHS</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Patient Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Gari Kila"
                value={quickPatient}
                onChange={(e) => setQuickPatient(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Event Telemetry Details</label>
            <input
              type="text"
              required
              placeholder="Clinical observation, drug administered, or action summary..."
              value={quickDetails}
              onChange={(e) => setQuickDetails(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">Severity:</span>
              {['Info', 'Success', 'Warning', 'Emergency'].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setQuickSeverity(s)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    quickSeverity === s ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow"
            >
              <Send className="w-3 h-3" />
              <span>{isSubmitting ? 'Recording...' : 'Save to Black Box'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, staff, patient..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full bg-[#070D18] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 text-xs">
          {['All', 'Emergency', 'Triage', 'Pharmacy', 'Lab', 'Ward', 'OHS'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStation(st)}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                filterStation === st
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline Stream */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className="p-3.5 rounded-xl bg-[#070D18] border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {getSeverityBadge(log.severity)}
                <span className="font-bold text-white">{log.action_type}</span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-500" />
                  <span>{log.location}</span>
                </span>
                {log.patient_name && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/50">
                    Patient: {log.patient_name}
                  </span>
                )}
              </div>

              <p className="text-slate-300 leading-relaxed text-[11px] pl-1">
                {log.details}
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-slate-800/60 pt-2 sm:pt-0">
              <span className="font-semibold text-slate-300 block text-xs">
                {log.user_name}
              </span>
              <span className="text-[10px] text-red-400 font-mono block">
                {log.user_role}
              </span>
              <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1 sm:justify-end mt-0.5">
                <Clock className="w-3 h-3" />
                <span>{log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
