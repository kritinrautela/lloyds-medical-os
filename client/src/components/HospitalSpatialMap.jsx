import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Users, 
  Stethoscope, 
  HeartPulse, 
  Pill, 
  FlaskConical, 
  HardHat, 
  ShieldAlert, 
  BedDouble, 
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export default function HospitalSpatialMap({ stats, onSelectStation }) {
  const [activeZone, setActiveZone] = useState('emergency');

  const zones = [
    {
      id: 'emergency',
      name: 'Emergency & Trauma Bay',
      subtext: 'Crash Bed 1 & 2 • Antivenom Refrigerator',
      lead: 'Chief Medical Officer',
      activeCount: '2 Patients',
      status: 'Critical Alert',
      color: 'red',
      icon: ShieldAlert,
      details: 'Equipped with defibrillator, suction, oxygen manifold, and CSL Polyvalent Taipan/Death Adder antivenom at 3.8°C.'
    },
    {
      id: 'triage',
      name: 'Triage & Waiting Pavilion',
      subtext: 'Manchester Acuity Triage Desk',
      lead: 'Senior Triage Nurse',
      activeCount: `${stats?.today_visitors || 5} Queued`,
      status: 'Active Flow',
      color: 'amber',
      icon: HeartPulse,
      details: 'Continuous screening of SpO2, blood pressure, fever, and pediatric hydration. Direct queue dispatch to doctor.'
    },
    {
      id: 'consult',
      name: 'Doctor Consultation Room 1',
      subtext: 'Clinical Examination & Prescriptions',
      lead: 'Chief Medical Officer',
      activeCount: '1 In Consult',
      status: 'Occupied',
      color: 'emerald',
      icon: Stethoscope,
      details: 'Diagnostic review, malaria Coartem protocol initiation, minor trauma evaluation, and fit-for-work certification.'
    },
    {
      id: 'pharmacy',
      name: 'Pharmacy & Drug Vault',
      subtext: 'Dispensing POS & Dangerous Drugs',
      lead: 'Registered Chief Pharmacist',
      activeCount: '1 At Counter',
      status: 'Dispensing',
      color: 'cyan',
      icon: Pill,
      details: 'PNG Essential Medicines formulary, digital receipt issuance, batch/lot expiry tracking, and anti-pilferage locked inventory.'
    },
    {
      id: 'lab',
      name: 'Diagnostic Pathology Lab',
      subtext: 'Rapid Malaria RDT & Whole Blood Clotting',
      lead: 'Pathology Technician',
      activeCount: '3 Tests Done',
      status: 'RDT Operational',
      color: 'purple',
      icon: FlaskConical,
      details: 'Malaria Pf/Pv antigen test cassette station, 20-minute whole blood clotting test (20WBCT), glucometer, and urinalysis.'
    },
    {
      id: 'ward',
      name: 'Inpatient Observation Ward',
      subtext: 'Beds 1 to 10 • Step-Down Monitoring',
      lead: 'Duty Clinical Team',
      activeCount: `${stats?.occupied_beds || 4} / 10 Beds`,
      status: '40% Load',
      color: 'blue',
      icon: BedDouble,
      details: '10 observation beds including pediatric dehydration rehydration, tropical malaria monitoring, and surgical recovery.'
    },
    {
      id: 'ohs',
      name: 'Mine Occupational Health Station',
      subtext: 'Conveyor Pit 3 & Haul Road Clinic',
      lead: 'HSE Mine Safety Officer',
      activeCount: '0 LTI',
      status: 'WBGT 32.4°C',
      color: 'rose',
      icon: HardHat,
      details: 'Mine site zero harm surveillance, audiometry booth, spirometry dust checks, and hydration enforcement stations.'
    }
  ];

  const selectedData = zones.find(z => z.id === activeZone) || zones[0];

  const handleZoneClick = (zId) => {
    setActiveZone(zId);
    sounds.playClick();
    if (onSelectStation) onSelectStation(zId);
  };

  return (
    <div className="bg-[#0B1528] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-red-500" />
            <span>Interactive Hospital Spatial Concession Map (Markham Valley Facility)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any station to inspect live clinical activities, assigned medical officers, and patient occupancy.
          </p>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 flex items-center gap-2 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>LIVE SPATIAL TELEMETRY</span>
        </span>
      </div>

      {/* Spatial Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {zones.map((zone) => {
          const Icon = zone.icon;
          const isSelected = activeZone === zone.id;

          const colorStyles = {
            red: isSelected ? 'border-red-500 bg-red-950/40 shadow-lg shadow-red-950/40' : 'border-slate-800 bg-[#070D18] hover:border-red-500/50',
            amber: isSelected ? 'border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-950/40' : 'border-slate-800 bg-[#070D18] hover:border-amber-500/50',
            emerald: isSelected ? 'border-emerald-500 bg-emerald-950/40 shadow-lg shadow-emerald-950/40' : 'border-slate-800 bg-[#070D18] hover:border-emerald-500/50',
            cyan: isSelected ? 'border-cyan-500 bg-cyan-950/40 shadow-lg shadow-cyan-950/40' : 'border-slate-800 bg-[#070D18] hover:border-cyan-500/50',
            purple: isSelected ? 'border-purple-500 bg-purple-950/40 shadow-lg shadow-purple-950/40' : 'border-slate-800 bg-[#070D18] hover:border-purple-500/50',
            blue: isSelected ? 'border-blue-500 bg-blue-950/40 shadow-lg shadow-blue-950/40' : 'border-slate-800 bg-[#070D18] hover:border-blue-500/50',
            rose: isSelected ? 'border-rose-500 bg-rose-950/40 shadow-lg shadow-rose-950/40' : 'border-slate-800 bg-[#070D18] hover:border-rose-500/50'
          };

          const iconColors = {
            red: 'text-red-400 bg-red-600/20',
            amber: 'text-amber-400 bg-amber-600/20',
            emerald: 'text-emerald-400 bg-emerald-600/20',
            cyan: 'text-cyan-400 bg-cyan-600/20',
            purple: 'text-purple-400 bg-purple-600/20',
            blue: 'text-blue-400 bg-blue-600/20',
            rose: 'text-rose-400 bg-rose-600/20'
          };

          return (
            <button
              key={zone.id}
              onClick={() => handleZoneClick(zone.id)}
              className={`p-4 rounded-xl border text-left transition-all group flex flex-col justify-between ${
                colorStyles[zone.color]
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${iconColors[zone.color]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                    {zone.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">
                    {zone.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                    {zone.activeCount}
                  </p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80 mt-2.5 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Station Lead</span>
                <span className="font-semibold text-slate-300 truncate max-w-[110px]">{zone.lead}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Station Deep Dive Inspector */}
      <div className="p-4 rounded-xl bg-[#070D18] border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-white">{selectedData.name}</h4>
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                {selectedData.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              {selectedData.details}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Station Personnel</span>
          <span className="text-xs font-bold text-red-400">{selectedData.lead}</span>
        </div>
      </div>
    </div>
  );
}
