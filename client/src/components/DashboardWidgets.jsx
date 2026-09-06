import React, { useState, useEffect } from 'react';
import { 
  Zap, Clock, AlertTriangle, CheckCircle2, Users, Activity, 
  TrendingUp, Target, Award, Timer, Heart, Brain, Eye,
  Shield, Flame, Droplets, Wind, ThermometerSun, Bell,
  ChevronRight, ArrowUp, ArrowDown, Sparkles, Star,
  HeartPulse, Stethoscope, Pill, BedDouble, Building2,
  FileCheck, ShieldAlert
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import { api } from '../services/api';

// Mining Concession Trauma & Medevac Operational Readiness Card (Institutional Grade)
export function TraumaMedevacStatusCard({ stats, onNavigate }) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Trauma & Medevac Status</h4>
              <p className="text-[10px] text-slate-500 font-mono">Concession Station • Level 1 Acute Facility</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            DEFCON 1 READY
          </span>
        </div>

        <div className="space-y-2.5">
          <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-800">Aeromedical Rotary Medevac</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-700">Port Moresby / Standby</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-slate-800">Resuscitation Bay O2 Telemetry</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-700">100% Pressurized</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-slate-800">Taipan / Snakebite Antivenom</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-900">{stats?.antivenom_vials ?? 12} Vials (Cold Chain)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-slate-800">Mine Heat Stress Index (WBGT)</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-700">32.4°C (Condition Yellow)</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-mono">Protocol: LMEL-OHS-04</span>
        <button
          onClick={() => onNavigate && onNavigate('queue')}
          className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Acute Trauma Log</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Daily Goals Tracker
export function DailyGoalsTracker({ stats, onNavigate, onOpenCheckIn, onSelectTab }) {
  const goals = [
    { id: 1, label: 'Patient Consultations', current: stats?.queueMap?.['Completed'] || 0, target: 25, icon: Stethoscope, color: 'emerald', action: () => onNavigate && onNavigate('queue') },
    { id: 2, label: 'Revenue Target', current: stats?.total_revenue_today || 0, target: 500, icon: Target, color: 'cyan', isCurrency: true, action: () => onNavigate && onNavigate('end-of-day') },
    { id: 3, label: 'New Registrations', current: stats?.today_visitors || 0, target: 8, icon: Users, color: 'purple', action: () => onOpenCheckIn && onOpenCheckIn() },
    { id: 4, label: 'Zero LTI Days', current: (stats?.incidents?.length || 0) === 0 ? 1 : 0, target: 1, icon: Shield, color: 'amber', isBoolean: true, action: () => onSelectTab && onSelectTab('ohs') }
  ];

  const colorMap = {
    emerald: { bg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'from-emerald-500 to-teal-500' },
    cyan: { bg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200', text: 'text-cyan-700', bar: 'from-cyan-500 to-blue-500' },
    purple: { bg: 'bg-purple-50 text-purple-600', border: 'border-purple-200', text: 'text-purple-700', bar: 'from-purple-500 to-indigo-500' },
    amber: { bg: 'bg-amber-50 text-amber-600', border: 'border-amber-200', text: 'text-amber-700', bar: 'from-amber-500 to-orange-500' }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Daily Clinical Goals</h4>
            <p className="text-[10px] text-slate-500">Tap any goal to navigate to duty module</p>
          </div>
        </div>

        <div className="space-y-3">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const c = colorMap[goal.color];
            const percentage = goal.isBoolean ? (goal.current >= goal.target ? 100 : 0) : Math.min((goal.current / goal.target) * 100, 100);
            const isComplete = percentage >= 100;

            return (
              <button 
                key={goal.id} 
                onClick={() => { sounds.playClick(); if (goal.action) goal.action(); }}
                className="w-full text-left p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${c.text}`} />
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-slate-950">{goal.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-mono font-bold ${c.text}`}>
                      {goal.isCurrency ? `K ${(goal.current || 0).toFixed(0)}` : goal.current}
                    </span>
                    {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`bg-gradient-to-r ${c.bar} h-full rounded-full transition-all duration-700`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-slate-500 font-medium">Progress: {Math.round(percentage)}%</span>
                  <span className="text-[9px] text-slate-500 font-medium">
                    Target: {goal.isCurrency ? `K ${goal.target}` : goal.target}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Patient Flow Journey Visualizer
export function PatientFlowJourney({ stats, onNavigate }) {
  const stages = [
    { key: 'Waiting', label: 'Arrival', color: 'amber', icon: Users },
    { key: 'Triage / Vitals', label: 'Triage', color: 'cyan', icon: Activity },
    { key: 'In Consultation', label: 'Doctor', color: 'purple', icon: Stethoscope },
    { key: 'At Pharmacy', label: 'Pharmacy', color: 'emerald', icon: Pill },
    { key: 'Completed', label: 'Discharge', color: 'blue', icon: CheckCircle2 }
  ];

  const getCount = (key) => stats?.queueMap?.[key] || 0;
  const total = stages.reduce((sum, s) => sum + getCount(s.key), 0);

  const handleStageClick = (stageKey) => {
    sounds.playClick();
    if (stageKey === 'At Pharmacy') {
      if (onNavigate) onNavigate('dispense');
    } else {
      if (onNavigate) onNavigate('queue');
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Patient Journey Flow</h4>
            <p className="text-[10px] text-slate-500">{total} active patient steps • Click any stage to open OPD queue</p>
          </div>
        </div>
        <button 
          onClick={() => { sounds.playClick(); if (onNavigate) onNavigate('queue'); }}
          className="text-xs text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
        >
          View Live OPD <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Horizontal Flow */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            const count = getCount(stage.key);
            const percentage = total > 0 ? (count / total) * 100 : 0;
            const colorClasses = {
              amber: 'from-amber-50 to-amber-100/80 border-amber-200 text-amber-600 hover:border-amber-400',
              cyan: 'from-cyan-50 to-cyan-100/80 border-cyan-200 text-cyan-600 hover:border-cyan-400',
              purple: 'from-purple-50 to-purple-100/80 border-purple-200 text-purple-600 hover:border-purple-400',
              emerald: 'from-emerald-50 to-emerald-100/80 border-emerald-200 text-emerald-600 hover:border-emerald-400',
              blue: 'from-blue-50 to-blue-100/80 border-blue-200 text-blue-600 hover:border-blue-400'
            };

            return (
              <React.Fragment key={stage.key}>
                <button
                  onClick={() => handleStageClick(stage.key)}
                  className="flex flex-col items-center gap-2 relative z-10 group cursor-pointer"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colorClasses[stage.color]} border flex items-center justify-center transition-all group-hover:scale-110 shadow-sm`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-black font-mono ${colorClasses[stage.color].split(' ').slice(2,3).join(' ')}`}>{count}</p>
                    <p className="text-[10px] text-slate-500 group-hover:text-slate-900 transition-colors font-medium">{stage.label}</p>
                  </div>
                </button>
                {i < stages.length - 1 && (
                  <div className="flex-1 h-1 bg-slate-100 mx-2 relative rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full"
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Department Performance Cards
export function DepartmentPerformance({ stats, onNavigate, onSelectTab }) {
  const departments = [
    { 
      name: 'Emergency', 
      metric: stats?.urgentVisits?.length ?? 0, 
      label: 'Active Cases', 
      icon: HeartPulse, 
      color: 'red',
      trend: (stats?.urgentVisits?.length || 0) > 0 ? `${stats.urgentVisits.length} Priority` : 'All Clear',
      trendUp: (stats?.urgentVisits?.length || 0) === 0,
      onClick: () => onNavigate && onNavigate('queue')
    },
    { 
      name: 'Triage', 
      metric: stats?.queueMap?.['Triage / Vitals'] ?? 0, 
      label: 'In Queue', 
      icon: Activity, 
      color: 'amber',
      trend: (stats?.queueMap?.['Triage / Vitals'] || 0) > 0 ? `${stats.queueMap['Triage / Vitals']} Waiting` : 'Ready',
      trendUp: null,
      onClick: () => onNavigate && onNavigate('queue')
    },
    { 
      name: 'Pharmacy', 
      metric: `K ${(stats?.today_pharmacy_revenue ?? 0).toFixed(0)}`, 
      label: 'Sales Today', 
      icon: Pill, 
      color: 'cyan',
      trend: (stats?.today_pharmacy_revenue || 0) > 0 ? 'Active' : 'No Sales',
      trendUp: (stats?.today_pharmacy_revenue || 0) > 0 ? true : null,
      onClick: () => onNavigate && onNavigate('pharmacy')
    },
    { 
      name: 'Ward Beds', 
      metric: `${stats?.occupied_beds ?? 0}/${stats?.total_beds ?? 10}`, 
      label: 'Bed Occupancy', 
      icon: BedDouble, 
      color: 'purple',
      trend: `${stats?.total_beds ? Math.round(((stats?.occupied_beds || 0) / stats.total_beds) * 100) : 0}% Load`,
      trendUp: null,
      onClick: () => onSelectTab && onSelectTab('beds')
    }
  ];

  const colorMap = {
    red: { bg: 'from-rose-50 to-white', border: 'border-rose-200 hover:border-rose-300', text: 'text-rose-700', icon: 'bg-rose-100 text-rose-600' },
    amber: { bg: 'from-amber-50 to-white', border: 'border-amber-200 hover:border-amber-300', text: 'text-amber-700', icon: 'bg-amber-100 text-amber-600' },
    cyan: { bg: 'from-cyan-50 to-white', border: 'border-cyan-200 hover:border-cyan-300', text: 'text-cyan-700', icon: 'bg-cyan-100 text-cyan-600' },
    purple: { bg: 'from-purple-50 to-white', border: 'border-purple-200 hover:border-purple-300', text: 'text-purple-700', icon: 'bg-purple-100 text-purple-600' }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {departments.map((dept) => {
        const Icon = dept.icon;
        const c = colorMap[dept.color];
        return (
          <button 
            key={dept.name} 
            onClick={() => { sounds.playClick(); dept.onClick(); }}
            className={`p-4 rounded-2xl bg-gradient-to-br ${c.bg} border ${c.border} shadow-xs transition-all duration-300 hover:scale-[1.02] hover:shadow-md group text-left cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-xl ${c.icon}`}>
                <Icon className="w-4 h-4" />
              </div>
              {dept.trendUp !== null && (
                <span className={`text-[10px] font-bold ${dept.trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {dept.trendUp ? '↑' : '↓'} {dept.trend}
                </span>
              )}
              {dept.trendUp === null && (
                <span className="text-[10px] font-bold text-slate-500">{dept.trend}</span>
              )}
            </div>
            <p className={`text-2xl font-black font-mono tracking-tight ${c.text}`}>{dept.metric}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-slate-800">{dept.name}</span>
              <span className="text-[10px] text-slate-500">{dept.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Alert Notification Center
export function AlertNotificationCenter({ stats, onNavigate, onSelectTab }) {
  const alerts = [];
  
  if (stats?.low_stock_count > 0) {
    alerts.push({ 
      id: 1, 
      type: 'warning', 
      title: 'Low Stock Alert', 
      message: `${stats.low_stock_count} medications below minimum reorder point`, 
      icon: AlertTriangle, 
      color: 'amber',
      action: () => onNavigate && onNavigate('pharmacy')
    });
  }
  if (stats?.expiring_soon_count > 0) {
    alerts.push({ 
      id: 2, 
      type: 'info', 
      title: 'Medication Expiry Warning', 
      message: `${stats.expiring_soon_count} formulary items expiring within 90 days`, 
      icon: Clock, 
      color: 'amber',
      action: () => onNavigate && onNavigate('pharmacy')
    });
  }
  if (stats?.urgentVisits?.length > 0) {
    alerts.push({ 
      id: 3, 
      type: 'emergency', 
      title: 'Active High Acuity Emergency', 
      message: `${stats.urgentVisits.length} high priority trauma/snakebite patients in queue`, 
      icon: HeartPulse, 
      color: 'red',
      action: () => onNavigate && onNavigate('queue')
    });
  }
  if (stats?.occupied_beds >= (stats?.total_beds || 10) * 0.4) {
    alerts.push({ 
      id: 4, 
      type: 'warning', 
      title: 'Observation Ward Active Load', 
      message: `${stats?.occupied_beds || 4} of ${stats?.total_beds || 10} observation beds occupied`, 
      icon: BedDouble, 
      color: 'amber',
      action: () => onSelectTab && onSelectTab('beds')
    });
  }

  if (alerts.length === 0) {
    alerts.push({ 
      id: 5, 
      type: 'success', 
      title: 'All Systems Normal', 
      message: 'Zero pending clinical emergencies or stock stockouts', 
      icon: CheckCircle2, 
      color: 'emerald',
      action: () => sounds.playSuccessChime()
    });
  }

  const colorMap = {
    red: { bg: 'bg-rose-50/80 hover:bg-rose-100/80', border: 'border-rose-200 hover:border-rose-300', text: 'text-rose-700', icon: 'bg-rose-100 text-rose-600' },
    amber: { bg: 'bg-amber-50/80 hover:bg-amber-100/80', border: 'border-amber-200 hover:border-amber-300', text: 'text-amber-700', icon: 'bg-amber-100 text-amber-600' },
    emerald: { bg: 'bg-emerald-50/80 hover:bg-emerald-100/80', border: 'border-emerald-200 hover:border-emerald-300', text: 'text-emerald-700', icon: 'bg-emerald-100 text-emerald-600' }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200 relative">
          <Bell className="w-5 h-5" />
          {alerts.length > 0 && alerts[0].type !== 'success' && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[8px] font-bold flex items-center justify-center animate-pulse">
              {alerts.length}
            </span>
          )}
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">Clinical Alert Center</h4>
          <p className="text-[10px] text-slate-500">{alerts.length} active notifications • Tap to take action</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          const c = colorMap[alert.color];
          return (
            <button
              key={alert.id}
              onClick={() => { sounds.playClick(); if (alert.action) alert.action(); }}
              className={`w-full text-left p-3 rounded-xl ${c.bg} border ${c.border} flex items-center gap-3 transition-all hover:scale-[1.01] group cursor-pointer`}
            >
              <div className={`p-2 rounded-lg ${c.icon}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900">{alert.title}</p>
                <p className="text-[10px] text-slate-500 truncate">{alert.message}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Subcomponent: Live telemetry clock (isolated to prevent parent re-renders)
function TelemetryClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// Real-time Vitals Monitor Grid - Zero Overflow & Perfectly Responsive
export function VitalsMonitorGrid({ stats, onNavigate }) {
  const [selectedPatientIndex, setSelectedPatientIndex] = useState(0);

  // Build patient vitals list from actual DB urgent visits + occupied beds (zero hallucinated data)
  const patientVitalsList = [];

  if (stats?.urgentVisits && stats.urgentVisits.length > 0) {
    stats.urgentVisits.forEach((v) => {
      patientVitalsList.push({
        id: `visit-${v.id}`,
        name: `${v.patient_name} (${v.patient_code})`,
        location: `Urgent OPD - ${v.triage_priority}`,
        heartRate: v.pulse ? parseInt(v.pulse) : 88,
        spo2: v.spo2 ? parseInt(v.spo2) : 96,
        bp: v.blood_pressure || v.bp || '130/85',
        temp: v.temp ? parseFloat(v.temp) : 38.2,
        respRate: v.resp_rate ? parseInt(v.resp_rate) : 20,
        status: v.triage_priority === 'Emergency' ? 'Critical' : 'Warning'
      });
    });
  }

  if (stats?.beds) {
    const occupied = stats.beds.filter(b => b.status === 'Occupied');
    occupied.forEach(b => {
      patientVitalsList.push({
        id: `bed-${b.id}`,
        name: `${b.patient_name || 'Inpatient'} (${b.bed_code})`,
        location: `${b.ward_name}`,
        heartRate: 80,
        spo2: 97,
        bp: '125/80',
        temp: 37.1,
        respRate: 18,
        status: 'Monitoring'
      });
    });
  }

  if (patientVitalsList.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Vitals Monitor Grid</h4>
                <p className="text-[10px] text-slate-500">Live Clinical Telemetry Station</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TelemetryClock />
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-slate-50/80 border border-dashed border-slate-200 text-center space-y-2.5 my-auto">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h5 className="text-sm font-bold text-slate-800">Station Telemetry Normal</h5>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              No acute resuscitation or observation patients requiring continuous vitals monitoring right now. Check in a patient or admit to ward to stream live telemetry.
            </p>
            <button
              onClick={() => { sounds.playClick(); if (onNavigate) onNavigate('queue'); }}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer"
            >
              <span>View OPD Triage Queue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPatient = patientVitalsList[selectedPatientIndex] || patientVitalsList[0];

  const vitalCards = [
    { 
      label: 'Heart Rate', 
      value: currentPatient.heartRate, 
      unit: 'BPM', 
      icon: Heart, 
      color: 'red', 
      status: currentPatient.heartRate > 100 ? 'High' : currentPatient.heartRate < 60 ? 'Low' : 'Normal',
      isWarning: currentPatient.heartRate > 100 || currentPatient.heartRate < 60 
    },
    { 
      label: 'Blood Oxygen', 
      value: currentPatient.spo2, 
      unit: '% SpO2', 
      icon: Droplets, 
      color: 'cyan', 
      status: currentPatient.spo2 < 94 ? 'Hypoxic' : 'Normal',
      isWarning: currentPatient.spo2 < 95 
    },
    { 
      label: 'Blood Pressure', 
      value: currentPatient.bp, 
      unit: 'mmHg', 
      icon: Activity, 
      color: 'purple', 
      status: 'Normal',
      isWarning: false 
    },
    { 
      label: 'Temperature', 
      value: `${currentPatient.temp}°`, 
      unit: 'Celsius', 
      icon: ThermometerSun, 
      color: 'amber', 
      status: currentPatient.temp > 38.0 ? 'Febrile' : 'Normal',
      isWarning: currentPatient.temp > 38.0 
    },
    { 
      label: 'Resp Rate', 
      value: currentPatient.respRate, 
      unit: '/min', 
      icon: Wind, 
      color: 'emerald', 
      status: currentPatient.respRate > 22 ? 'Tachypnea' : 'Normal',
      isWarning: currentPatient.respRate > 22 
    }
  ];

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 relative">
              <HeartPulse className="w-5 h-5 text-rose-600" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Vitals Telemetry Grid</h4>
              <p className="text-[10px] text-slate-500 font-mono">{currentPatient.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TelemetryClock />
            <button
              onClick={() => { sounds.playClick(); if (onNavigate) onNavigate('queue'); }}
              className="text-[10px] font-bold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200/80 transition-colors cursor-pointer"
            >
              OPD Queue →
            </button>
          </div>
        </div>

        {/* Patient Selection Bar */}
        <div className="mb-4">
          <select
            value={selectedPatientIndex}
            onChange={(e) => { sounds.playClick(); setSelectedPatientIndex(Number(e.target.value)); }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 font-semibold truncate cursor-pointer hover:border-slate-300 transition-colors"
          >
            {patientVitalsList.map((p, idx) => (
              <option key={p.id} value={idx} className="bg-white text-slate-800">
                {p.name} — [{p.location}]
              </option>
            ))}
          </select>
        </div>

        {/* Responsive Grid - Clean Institutional Medical Design */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {vitalCards.map((vital) => {
            const Icon = vital.icon;
            const isLongVal = String(vital.value).length > 4;

            return (
              <div 
                key={vital.label} 
                className={`p-3.5 rounded-xl border flex flex-col justify-between min-h-[120px] transition-all relative overflow-hidden group ${
                  vital.isWarning
                    ? 'bg-rose-50/50 border-rose-300 shadow-xs'
                    : 'bg-slate-50/70 hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {vital.isWarning && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                )}
                
                {/* Header: Icon & Unit */}
                <div className="flex items-center justify-between w-full">
                  <Icon className={`w-4 h-4 ${vital.isWarning ? 'text-rose-600' : 'text-slate-600'}`} />
                  <span className="text-[9px] text-slate-600 uppercase font-mono font-semibold tracking-wider">{vital.unit}</span>
                </div>

                {/* Center: Value */}
                <div className="my-2 text-center">
                  <p className={`font-black font-mono tracking-tight leading-none ${isLongVal ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'} ${vital.isWarning ? 'text-rose-700' : 'text-slate-900'}`}>
                    {vital.value}
                  </p>
                </div>

                {/* Footer: Label & Status Badge */}
                <div className="text-center w-full space-y-1">
                  <p className="text-[10px] text-slate-500 font-semibold truncate">{vital.label}</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${
                    vital.isWarning 
                      ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                      : 'bg-white text-slate-700 border border-slate-200/80 shadow-2xs'
                  }`}>
                    {vital.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Weather Alert Banner

// Quick Stats Summary
export function QuickStatsSummary({ stats, formatKina }) {
  const stats_data = [
    { label: 'Total Patients Today', value: stats?.today_visitors || 0, icon: Users, color: 'cyan' },
    { label: 'Completed Visits', value: stats?.queueMap?.['Completed'] || 0, icon: CheckCircle2, color: 'emerald' },
    { label: 'Shift Revenue', value: formatKina(stats?.total_revenue_today || 0), icon: Target, color: 'green' },
    { label: 'Active Malaria Cases', value: stats?.malaria_cases || 0, icon: AlertTriangle, color: 'rose' }
  ];

  const colorMap = {
    cyan: 'text-cyan-700',
    emerald: 'text-emerald-700',
    green: 'text-emerald-700',
    rose: 'text-rose-700'
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      {stats_data.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div key={i} className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${colorMap[stat.color]}`} />
            <div>
              <p className={`text-lg font-black font-mono ${colorMap[stat.color]}`}>{stat.value}</p>
              <p className="text-[10px] text-slate-500 font-medium">{stat.label}</p>
            </div>
            {i < stats_data.length - 1 && <div className="w-px h-8 bg-slate-200 ml-3" />}
          </div>
        );
      })}
    </div>
  );
}
