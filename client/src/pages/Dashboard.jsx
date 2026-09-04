import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import LloydsLogo from '../components/LloydsLogo';
import ECGMonitor from '../components/ECGMonitor';
import ActivityBlackBox from '../components/ActivityBlackBox';
import { 
  EmergencyResponseTimer, DailyGoalsTracker, PatientFlowJourney,
  DepartmentPerformance, AlertNotificationCenter, VitalsMonitorGrid,
  WeatherAlertBanner, QuickStatsSummary
} from '../components/DashboardWidgets';
import { 
  Users, Activity, Pill, DollarSign, AlertTriangle, Clock, TrendingUp, 
  CheckCircle2, ChevronRight, Plus, FileSpreadsheet, ArrowUpRight, Sparkles,
  ShieldAlert, Stethoscope, HeartPulse, BedDouble, HardHat, Thermometer,
  ShieldCheck, Lock, MessageSquare, AlertCircle, FileCheck, Check, Send,
  Calendar, Building2, Radio, RefreshCw, Search, Sun, Moon, Zap, 
  ActivitySquare, BarChart3, PieChart, TrendingDown, ArrowUp, ArrowDown,
  Wifi, WifiOff, Eye, Bell, Settings, Layout, Grid, List, MapPin, Crosshair,
  ThermometerSun, Wind, CloudRain as CloudRainIcon, Droplets, Gauge
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';

// Animated Counter Component
function AnimatedCounter({ value, duration = 1000, prefix = '', suffix = '' }) {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);
  const startTime = useRef(null);

  useEffect(() => {
    const numValue = Number(value) || 0;
    startTime.current = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(numValue * eased));
      
      if (progress < 1) {
        countRef.current = requestAnimationFrame(animate);
      }
    };
    
    countRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(countRef.current);
  }, [value, duration]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// Pulse Dot Component
function PulseDot({ color = 'emerald', size = 'sm' }) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };
  const colorClasses = {
    emerald: 'bg-emerald-400',
    red: 'bg-red-400',
    amber: 'bg-amber-400',
    cyan: 'bg-cyan-400',
    purple: 'bg-purple-400'
  };
  
  return (
    <span className="relative flex items-center justify-center">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClasses[color]}`}></span>
      <span className={`relative inline-flex rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}></span>
    </span>
  );
}

// Glass Card Component
function GlassCard({ children, className = '', hover = true, glow = false, glowColor = 'red' }) {
  const glowClasses = {
    red: 'hover:border-red-500/40 hover:shadow-red-950/40',
    cyan: 'hover:border-cyan-500/40 hover:shadow-cyan-950/40',
    emerald: 'hover:border-emerald-500/40 hover:shadow-emerald-950/40',
    amber: 'hover:border-amber-500/40 hover:shadow-amber-950/40',
    purple: 'hover:border-purple-500/40 hover:shadow-purple-950/40'
  };
  
  return (
    <div className={`
      hud-panel 
      ${hover ? `hud-panel-hover ${glow ? glowClasses[glowColor] : ''}` : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

// Modern Stat Card
function StatCard({ icon: Icon, label, value, subtext, color, trend, trendValue, format = false }) {
  const colorMap = {
    cyan: { bg: 'from-cyan-500/15 via-[#0A1628] to-[#060D18]', text: 'text-cyan-400', border: 'border-cyan-500/30', accent: 'border-t-cyan-500', glow: 'shadow-cyan-500/20' },
    amber: { bg: 'from-amber-500/15 via-[#0A1628] to-[#060D18]', text: 'text-amber-400', border: 'border-amber-500/30', accent: 'border-t-amber-500', glow: 'shadow-amber-500/20' },
    emerald: { bg: 'from-emerald-500/15 via-[#0A1628] to-[#060D18]', text: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'border-t-emerald-500', glow: 'shadow-emerald-500/20' },
    green: { bg: 'from-emerald-500/15 via-[#0A1628] to-[#060D18]', text: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'border-t-emerald-500', glow: 'shadow-emerald-500/20' },
    purple: { bg: 'from-purple-500/15 via-[#0A1628] to-[#060D18]', text: 'text-purple-400', border: 'border-purple-500/30', accent: 'border-t-purple-500', glow: 'shadow-purple-500/20' },
    rose: { bg: 'from-rose-500/15 via-[#0A1628] to-[#060D18]', text: 'text-rose-400', border: 'border-rose-500/30', accent: 'border-t-rose-500', glow: 'shadow-rose-500/20' },
    red: { bg: 'from-red-500/15 via-[#0A1628] to-[#060D18]', text: 'text-red-400', border: 'border-red-500/30', accent: 'border-t-red-500', glow: 'shadow-red-500/20' }
  };
  
  const c = colorMap[color] || colorMap.cyan;
  
  return (
    <div className={`
      relative overflow-hidden 
      bg-gradient-to-br ${c.bg}
      backdrop-blur-xl 
      border border-white/10 ${c.accent} border-t-2
      rounded-2xl 
      p-5 
      transition-all duration-300 
      hover:scale-[1.02] 
      hover:shadow-2xl ${c.glow}
      group
    `}>
      {/* Subtle specular corner accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full pointer-events-none`} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl bg-black/40 border border-white/10 shadow-inner group-hover:border-white/20 transition-colors`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${trend === 'up' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
              {trend === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className={`text-3xl font-black ${c.text} font-mono tracking-tight`}>
            {format ? value : <AnimatedCounter value={value} />}
          </p>
          {subtext && <p className="text-[11px] text-slate-400 font-medium">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

// Live Clock Component
function LiveClock() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-2xl font-black text-white font-mono tracking-wider">
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest">
          {time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

// Weather Widget (Simulated for PNG Mine Site)
function WeatherWidget() {
  const [weather] = useState({
    temp: 32,
    humidity: 78,
    condition: 'Partly Cloudy',
    wind: '12 km/h',
    wbgt: 32.4,
    uv: 'Very High'
  });
  
  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ThermometerSun className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-white">Site Conditions</span>
        <PulseDot color="amber" size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 rounded-xl bg-black/20">
          <p className="text-2xl font-black text-amber-400 font-mono">{weather.temp}°</p>
          <p className="text-[9px] text-slate-400 uppercase">Temperature</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-black/20">
          <p className="text-2xl font-black text-cyan-400 font-mono">{weather.humidity}%</p>
          <p className="text-[9px] text-slate-400 uppercase">Humidity</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-black/20">
          <p className="text-lg font-black text-emerald-400 font-mono">{weather.wbgt}°C</p>
          <p className="text-[9px] text-slate-400 uppercase">WBGT Index</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-black/20">
          <p className="text-lg font-black text-rose-400 font-mono">{weather.wind}</p>
          <p className="text-[9px] text-slate-400 uppercase">Wind Speed</p>
        </div>
      </div>
    </div>
  );
}

// System Status Bar
function SystemStatusBar({ isOnline, autoRefreshEnabled, refreshCountdown, lastRefresh, onToggleRefresh, onRefresh }) {
  return (
    <div className="flex items-center gap-4 text-[10px]">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 border border-white/5">
        <PulseDot color={isOnline ? 'emerald' : 'amber'} size="sm" />
        <span className={`font-semibold ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
          {isOnline ? 'LIVE' : 'OFFLINE'}
        </span>
        {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-amber-400" />}
      </div>
      
      <button
        onClick={onToggleRefresh}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
          autoRefreshEnabled 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
        }`}
      >
        <RefreshCw className={`w-3 h-3 ${autoRefreshEnabled ? 'animate-spin' : ''}`} />
        <span className="font-semibold">{autoRefreshEnabled ? `${refreshCountdown}s` : 'PAUSED'}</span>
      </button>
      
      <button
        onClick={onRefresh}
        className="p-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        title="Manual Refresh"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
      
      <div className="text-slate-500">
        Updated {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
}

export default function Dashboard({ 
  stats, settings, setActiveTab, onOpenCheckIn, onOpenDispense, onOpenExport, refreshStats 
}) {
  const { currentUser, setIsAuthModalOpen } = useAuth();
  const [selectedDashboardTab, setSelectedDashboardTab] = useState('overview');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNotePriority, setNewNotePriority] = useState('Standard');
  const [newNoteCategory, setNewNoteCategory] = useState('Clinical Telemetry');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(30);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const currencySymbol = settings?.currency_symbol || 'K';
  const currencyCode = settings?.currency_code || 'PGK';
  const formatKina = (val) => `${currencySymbol} ${(Number(val) || 0).toFixed(2)}`;

  // Auto-refresh
  const handleRefresh = useCallback(() => {
    if (refreshStats) {
      refreshStats();
      setLastRefresh(new Date());
      setRefreshCountdown(30);
    }
  }, [refreshStats]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) { handleRefresh(); return 30; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownInterval);
  }, [autoRefreshEnabled, handleRefresh]);

  // Online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Patient search
  useEffect(() => {
    if (patientSearchQuery.length < 2) { setSearchResults([]); return; }
    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await api.searchPatients(patientSearchQuery);
        setSearchResults(response.patients?.slice(0, 5) || []);
      } catch (err) { console.error('Search error:', err); }
      finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(searchTimeout);
  }, [patientSearchQuery]);

  const getCurrentShift = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) {
      return { name: 'Day Shift', time: '06:00 - 18:00', progress: ((hour - 6) / 12) * 100, icon: Sun, color: 'amber' };
    }
    return { name: 'Night Shift', time: '18:00 - 06:00', progress: ((hour - 18) / 12) * 100, icon: Moon, color: 'blue' };
  };

  const currentShift = getCurrentShift();
  const ShiftIcon = currentShift.icon;

  const handleTabChange = (tabId) => {
    setSelectedDashboardTab(tabId);
    sounds.playClick();
  };

  const handleAddShiftNote = async (e) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    setIsSubmittingNote(true);
    try {
      await api.addShiftNote({
        shift_type: 'Day Shift (06:00 - 18:00)',
        author_name: currentUser?.full_name || 'Duty Medical Officer',
        author_role: currentUser?.role || 'Medical Staff',
        priority: newNotePriority,
        category: newNoteCategory,
        title: newNoteTitle.trim(),
        note_content: newNoteContent.trim()
      });
      sounds.playSuccessChime();
      setNewNoteTitle('');
      setNewNoteContent('');
      setIsNoteModalOpen(false);
      window.location.reload();
    } catch (err) { console.error('Failed to add shift note:', err); }
    finally { setIsSubmittingNote(false); }
  };

  const handleBedStatusToggle = async (bed) => {
    const newStatus = bed.status === 'Occupied' ? 'Available' : 'Occupied';
    sounds.playClick();
    try {
      await api.updateBedStatus(bed.id, {
        status: newStatus,
        patient_name: newStatus === 'Occupied' ? 'Emergency Admitted Patient' : null,
        patient_code: newStatus === 'Occupied' ? 'PAT-EMERG-09' : null,
        acuity_level: newStatus === 'Occupied' ? 'Urgent (Acuity 3)' : null,
        diagnosis: newStatus === 'Occupied' ? 'Observation Under Triage Protocol' : null,
        attending_doctor: currentUser?.full_name || 'Chief Medical Officer',
        vitals_ticker: newStatus === 'Occupied' ? 'BP: 120/80 | HR: 80 | SpO2: 98%' : 'Ready for Admission',
        notes: newStatus === 'Occupied' ? 'Admitted from triage queue.' : 'Bed cleaned and sanitized.'
      });
      sounds.playSuccessChime();
      window.location.reload();
    } catch (e) { console.error(e); }
  };

  // Quick Actions Data
  const quickActions = [
    { id: 'checkin', label: 'Check-In Patient', sub: 'New OPD / Vitals', icon: Plus, color: 'emerald', onClick: onOpenCheckIn },
    { id: 'emergency', label: 'EMERGENCY ALERT', sub: 'Snakebite / Trauma', icon: ShieldAlert, color: 'red', onClick: () => { sounds.playEmergencyAlert(); setActiveTab('queue'); }, pulse: true },
    { id: 'pharmacy', label: 'Pharmacy POS', sub: 'Dispense Medicine', icon: Pill, color: 'cyan', onClick: onOpenDispense },
    { id: 'vitals', label: 'Triage & Vitals', sub: 'Manchester Protocol', icon: HeartPulse, color: 'purple', onClick: () => setActiveTab('queue') },
    { id: 'beds', label: 'Ward & Beds', sub: '10 Hospital Beds', icon: BedDouble, color: 'amber', onClick: () => handleTabChange('beds') },
    { id: 'blackbox', label: 'Black Box', sub: 'Action Recording', icon: Radio, color: 'blue', onClick: () => handleTabChange('blackbox') },
  ];

  const actionColors = {
    emerald: 'from-emerald-500/15 via-[#0C1B2E] to-[#070E1A] border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-emerald-950/50',
    red: 'from-red-500/15 via-[#0C1B2E] to-[#070E1A] border-red-500/30 hover:border-red-400/60 hover:shadow-red-950/50',
    cyan: 'from-cyan-500/15 via-[#0C1B2E] to-[#070E1A] border-cyan-500/30 hover:border-cyan-400/60 hover:shadow-cyan-950/50',
    purple: 'from-purple-500/15 via-[#0C1B2E] to-[#070E1A] border-purple-500/30 hover:border-purple-400/60 hover:shadow-purple-950/50',
    amber: 'from-amber-500/15 via-[#0C1B2E] to-[#070E1A] border-amber-500/30 hover:border-amber-400/60 hover:shadow-amber-950/50',
    blue: 'from-blue-500/15 via-[#0C1B2E] to-[#070E1A] border-blue-500/30 hover:border-blue-400/60 hover:shadow-blue-950/50'
  };

  const actionIconBg = {
    emerald: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white shadow-inner',
    red: 'bg-red-500/20 text-red-400 border border-red-500/30 group-hover:bg-red-600 group-hover:text-white shadow-inner',
    cyan: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-white shadow-inner',
    purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30 group-hover:bg-purple-500 group-hover:text-white shadow-inner',
    amber: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-white shadow-inner',
    blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white shadow-inner'
  };

  const tabItems = [
    { id: 'overview', label: 'Command Stream', icon: Activity },
    { id: 'beds', label: 'Ward (10 Beds)', icon: BedDouble },
    { id: 'blackbox', label: 'Black Box', icon: Radio },
    { id: 'ohs', label: 'Mine OHS', icon: HardHat },
    { id: 'handover', label: 'Shift Handover', icon: MessageSquare },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ECG MONITOR */}
      <ECGMonitor bpm={74} spo2={98} bp="120/80" />

      {/* TOP BAR: SHIFT + SEARCH + CLOCK + STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Shift Timeline */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${currentShift.color === 'amber' ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
                <ShiftIcon className={`w-4 h-4 ${currentShift.color === 'amber' ? 'text-amber-400' : 'text-blue-400'}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{currentShift.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{currentShift.time}</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400">{Math.round(currentShift.progress)}%</span>
          </div>
          <div className="w-full bg-black/30 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                currentShift.color === 'amber' 
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500' 
                  : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500'
              }`}
              style={{ width: `${Math.min(currentShift.progress, 100)}%` }}
            />
          </div>
        </GlassCard>

        {/* Quick Patient Search */}
        <GlassCard className="p-4 relative">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white">Patient Lookup</span>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Name, code, or phone..."
              value={patientSearchQuery}
              onChange={(e) => setPatientSearchQuery(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            />
            {isSearching && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-full mt-2 bg-[#0B1528] border border-white/10 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto backdrop-blur-xl">
              {searchResults.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => { sounds.playClick(); setActiveTab('patients'); setPatientSearchQuery(''); setSearchResults([]); }}
                  className="w-full p-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{patient.full_name}</p>
                      <p className="text-[10px] text-slate-400">{patient.patient_code} • {patient.age}y, {patient.gender}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Live Clock */}
        <GlassCard className="p-4 flex items-center justify-center">
          <LiveClock />
        </GlassCard>

        {/* System Status */}
        <GlassCard className="p-4">
          <SystemStatusBar 
            isOnline={isOnline} 
            autoRefreshEnabled={autoRefreshEnabled}
            refreshCountdown={refreshCountdown}
            lastRefresh={lastRefresh}
            onToggleRefresh={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            onRefresh={handleRefresh}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => { sounds.playClick(); setIsAuthModalOpen(true); }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <span className="text-sm">{currentUser?.avatar || '👨‍⚕️'}</span>
              <div className="text-left">
                <span className="block text-[10px] text-slate-400 uppercase">Shift</span>
                <span className="block text-[11px] font-bold text-white">{currentUser?.role?.split(' ')[0] || 'Doctor'}</span>
              </div>
            </button>
            <button
              onClick={() => { sounds.playClick(); onOpenExport(); }}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white transition-all shadow-lg shadow-red-950/50 hover:shadow-red-500/30"
              title="Download Locked Excel"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </GlassCard>
      </div>

      {/* HERO SECTION */}
      <GlassCard className="p-6 md:p-8 relative overflow-hidden" glow glowColor="red">
        {/* Animated background orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-mono text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-950/50">
                  LLOYDS PNG
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Morobe Mining Concession
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <PulseDot color="emerald" size="sm" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">System Active</span>
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Hospital & Clinical <span className="bg-gradient-to-r from-red-500 via-rose-500 to-red-400 bg-clip-text text-transparent">Command Center</span>
              </h1>

              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                <span className="text-red-400 font-bold">Bikpela Moning (Welcome):</span> Active duty session led by{' '}
                <span className="text-white font-bold">{currentUser?.full_name || 'Chief Medical Officer'}</span> ({currentUser?.role || 'Medical Lead'}). 
                Operating 100% offline with password-protected, read-only audit controls.
              </p>
            </div>

            {/* Weather Widget (Desktop) */}
            <div className="hidden xl:block">
              <WeatherWidget />
            </div>
          </div>

          {/* Quick Action Launchpad */}
          <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => { sounds.playClick(); action.onClick(); }}
                  className={`p-4 rounded-xl bg-gradient-to-b ${actionColors[action.color]} border transition-all duration-300 hover:scale-[1.03] hover:shadow-xl group text-left`}
                >
                  <div className={`w-10 h-10 rounded-xl ${actionIconBg[action.color]} flex items-center justify-center mb-3 transition-all ${action.pulse ? 'animate-pulse' : ''}`}>
                    <Icon className="w-5 h-5 stroke-[2]" />
                  </div>
                  <p className="text-xs font-bold text-white group-hover:text-white/90 transition-colors leading-tight">
                    {action.label}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{action.sub}</p>
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* WEATHER ALERT BANNER */}
      <WeatherAlertBanner />

      {/* MAIN METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Today's Census" value={stats?.today_visitors || 0} subtext="Active OPD Flow" color="cyan" trend="up" trendValue="+12%" />
        <StatCard icon={AlertTriangle} label="High Acuity" value={stats?.urgentVisits?.length || 0} subtext="Emergency & Urgent" color="amber" />
        <StatCard icon={Stethoscope} label="Consultations" value={stats?.queueMap?.['Completed'] || 0} subtext="Avg: 14 mins" color="emerald" trend="up" trendValue="+8%" />
        <StatCard icon={DollarSign} label="Total Revenue" value={formatKina(stats?.total_revenue_today || 0)} subtext={`${currencyCode} Combined`} color="green" format />
        <StatCard icon={BedDouble} label="Beds Occupied" value={`${stats?.occupied_beds || 4}/${stats?.total_beds || 10}`} subtext={`${stats?.total_beds ? Math.round(((stats?.occupied_beds || 0) / stats.total_beds) * 100) : 0}% Load`} color="purple" format />
        <StatCard icon={HeartPulse} label="Malaria Cases" value={stats?.malaria_cases || 3} subtext="Coartem Protocol" color="rose" />
      </div>

      {/* PATIENT FLOW JOURNEY */}
      <PatientFlowJourney stats={stats} onNavigate={setActiveTab} />

      {/* DEPARTMENT PERFORMANCE */}
      <DepartmentPerformance stats={stats} onNavigate={setActiveTab} onSelectTab={setSelectedDashboardTab} />

      {/* VITALS MONITOR (2 COLS) + EMERGENCY RESPONSE TIMER (1 COL) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VitalsMonitorGrid stats={stats} onNavigate={setActiveTab} />
        </div>
        <div className="lg:col-span-1">
          <EmergencyResponseTimer onLogEvent={handleRefresh} />
        </div>
      </div>

      {/* DAILY CLINICAL GOALS (1 COL) + ALERTS & SUMMARY (2 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <DailyGoalsTracker 
            stats={stats} 
            onNavigate={setActiveTab} 
            onOpenCheckIn={onOpenCheckIn} 
            onSelectTab={setSelectedDashboardTab} 
          />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <AlertNotificationCenter 
            stats={stats} 
            onNavigate={setActiveTab} 
            onSelectTab={setSelectedDashboardTab} 
          />
          <QuickStatsSummary stats={stats} formatKina={formatKina} />
        </div>
      </div>

      {/* FOOTFALL TREND + REVENUE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day Footfall Trend */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">7-Day Patient Footfall</h3>
                <p className="text-[10px] text-slate-400">Weekly trend analysis</p>
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between h-40 gap-3">
            {(stats?.footfallTrend || []).map((day, i) => {
              const maxCount = Math.max(...(stats?.footfallTrend || []).map(d => d.count), 1);
              const heightPercent = (day.count / maxCount) * 100;
              const isToday = day.visit_date === new Date().toISOString().split('T')[0];
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className={`text-[11px] font-mono font-bold transition-all ${isToday ? 'text-cyan-400 scale-110' : 'text-slate-400 group-hover:text-white'}`}>
                    {day.count}
                  </span>
                  <div className="w-full relative">
                    <div 
                      className={`w-full rounded-xl transition-all duration-700 ease-out ${
                        isToday 
                          ? 'bg-gradient-to-t from-cyan-600 via-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/30' 
                          : 'bg-gradient-to-t from-slate-700 via-slate-600 to-slate-500 group-hover:from-slate-600 group-hover:via-slate-500 group-hover:to-slate-400'
                      }`}
                      style={{ height: `${Math.max(heightPercent, 12)}%`, minHeight: '8px' }}
                    />
                  </div>
                  <span className={`text-[10px] font-semibold ${isToday ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {new Date(day.visit_date).toLocaleDateString('en', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
            {(!stats?.footfallTrend || stats.footfallTrend.length === 0) && (
              <div className="flex-1 h-full flex items-center justify-center text-slate-500 text-xs">No trend data</div>
            )}
          </div>
        </GlassCard>

        {/* Revenue Breakdown */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20">
                <PieChart className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Revenue Breakdown</h3>
                <p className="text-[10px] text-slate-400">Today's financial overview</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-5">
            {/* Pharmacy Revenue */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-400" />
                  <span className="text-xs text-slate-300 font-semibold">Pharmacy Sales</span>
                </div>
                <span className="text-sm font-mono font-bold text-green-400">{formatKina(stats?.today_pharmacy_revenue || 0)}</span>
              </div>
              <div className="w-full bg-black/30 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-green-500 to-emerald-400 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${stats?.total_revenue_today ? ((stats?.today_pharmacy_revenue || 0) / stats.total_revenue_today) * 100 : 100}%` }}
                />
              </div>
            </div>

            {/* OPD Fees */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />
                  <span className="text-xs text-slate-300 font-semibold">OPD Consultation Fees</span>
                </div>
                <span className="text-sm font-mono font-bold text-cyan-400">{formatKina(stats?.today_opd_fees || 0)}</span>
              </div>
              <div className="w-full bg-black/30 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-400 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${stats?.total_revenue_today ? ((stats?.today_opd_fees || 0) / stats.total_revenue_today) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Total */}
            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Total Today</span>
                <span className="text-2xl font-black text-white font-mono bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">{formatKina(stats?.total_revenue_today || 0)}</span>
              </div>
            </div>

            {/* All-Time */}
            <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-400">All-Time Pharmacy Revenue</span>
              </div>
              <span className="text-sm font-mono font-bold text-emerald-400">{formatKina(stats?.total_pharmacy_revenue || 0)}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* TOP MEDICINES + MEDICATION ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Dispensed Medicines */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Pill className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Top Dispensed Medicines</h3>
                <p className="text-[10px] text-slate-400">Most prescribed formulations</p>
              </div>
            </div>
            <button onClick={() => setActiveTab('pharmacy')} className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {(stats?.topMedicines || []).map((med, i) => {
              const maxDispensed = Math.max(...(stats?.topMedicines || []).map(m => m.total_dispensed), 1);
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-[11px] font-black text-purple-400 group-hover:bg-purple-500/20 transition-all">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-white font-semibold truncate">{med.drug_name}</span>
                      <span className="text-[11px] font-mono font-bold text-purple-400 ml-2">{med.total_dispensed} units</span>
                    </div>
                    <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-400 h-full rounded-full transition-all duration-700"
                        style={{ width: `${(med.total_dispensed / maxDispensed) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {(!stats?.topMedicines || stats.topMedicines.length === 0) && (
              <p className="text-xs text-slate-500 text-center py-6">No dispensation data yet</p>
            )}
          </div>
        </GlassCard>

        {/* Medication Alerts */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Bell className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Medication Alerts</h3>
                <p className="text-[10px] text-slate-400">Inventory health monitoring</p>
              </div>
            </div>
            {stats?.expiring_soon_count > 0 && (
              <span className="text-[10px] font-bold text-amber-400 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                {stats.expiring_soon_count} Expiring Soon
              </span>
            )}
          </div>
          
          <div className="space-y-4">
            {/* Low Stock */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-red-600/5 border border-red-500/20 hover:border-red-500/40 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Low Stock Alert</p>
                    <p className="text-[10px] text-slate-400">Below minimum stock level</p>
                  </div>
                </div>
                <span className="text-2xl font-black text-red-400 font-mono">{stats?.low_stock_count || 0}</span>
              </div>
            </div>

            {/* Expiring Soon */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-600/5 border border-amber-500/20 hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Expiring Within 90 Days</p>
                    <p className="text-[10px] text-slate-400">Requires reorder or redistribution</p>
                  </div>
                </div>
                <span className="text-2xl font-black text-amber-400 font-mono">{stats?.expiring_soon_count || 0}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setActiveTab('pharmacy')}
                className="py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-xs font-bold text-cyan-400 transition-all flex items-center justify-center gap-2"
              >
                <Pill className="w-4 h-4" />
                Pharmacy Formulary
              </button>
              <button
                onClick={() => setActiveTab('end-of-day')}
                className="py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-xs font-bold text-amber-400 transition-all flex items-center justify-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                End-of-Day
              </button>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex gap-2 p-1.5 bg-[#070D18]/90 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-x-auto shadow-xl">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedDashboardTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-gradient-to-r from-red-600 via-red-500 to-rose-600 text-white shadow-lg shadow-red-950/60 border border-red-400/40 glow-lloyds-red'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {selectedDashboardTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Live Triage Queue */}
            <GlassCard className="p-6" glow glowColor="emerald">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <PulseDot color="emerald" size="md" />
                  <h2 className="text-base font-bold text-white">Live OPD Patient Flow & Manchester Triage</h2>
                </div>
                <button onClick={() => setActiveTab('queue')} className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors">
                  Open Full Queue <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Triage Stages */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Waiting', key: 'Waiting', color: 'amber' },
                  { label: 'Triage', key: 'Triage / Vitals', color: 'cyan' },
                  { label: 'Consult', key: 'In Consultation', color: 'purple' },
                  { label: 'Pharmacy', key: 'At Pharmacy', color: 'emerald' },
                  { label: 'Done', key: 'Completed', color: 'slate' }
                ].map((stage) => (
                  <div key={stage.key} className="text-center p-3 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase block mb-1">{stage.label}</span>
                    <span className={`text-xl font-black font-mono ${
                      stage.color === 'amber' ? 'text-amber-400' :
                      stage.color === 'cyan' ? 'text-cyan-400' :
                      stage.color === 'purple' ? 'text-purple-400' :
                      stage.color === 'emerald' ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      {stats?.queueMap?.[stage.key] || 0}
                    </span>
                  </div>
                ))}
              </div>

              {/* Urgent Cases */}
              {stats?.urgentVisits && stats.urgentVisits.length > 0 && (
                <div className="mt-5 space-y-3">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 animate-pulse" />
                    High Priority Cases Under Active Care
                  </span>
                  {stats.urgentVisits.map((v) => (
                    <div key={v.id} className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-red-600/5 border border-red-500/20 flex items-center justify-between gap-4 hover:border-red-500/40 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 font-black font-mono text-xs">
                          {v.triage_priority}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{v.patient_name} <span className="text-slate-400 font-normal">({v.age}y, {v.gender})</span></p>
                          <p className="text-[11px] text-slate-300 mt-0.5">{v.reason || v.diagnosis || 'Clinical presentation'}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-black/30 text-slate-300 border border-white/5 block">{v.status}</span>
                        {v.temp && <span className="text-[10px] font-mono text-slate-400 mt-1 block">{v.temp}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Disease Surveillance */}
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <HeartPulse className="w-5 h-5 text-red-400" />
                  <h2 className="text-base font-bold text-white">PNG Tropical Disease Surveillance</h2>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  Morobe Province Vector Monitor
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: 'Malaria RDT Positivity', value: '60%', detail: '(3 / 5 Tested)', badge: 'Pf Dominant', badgeColor: 'rose', progress: 60, progressColor: 'from-rose-500 to-rose-400', note: 'Coartem & Artesunate 1st-line protocol active.' },
                  { title: 'Snakebite & Antivenom', value: '6 Vials', detail: 'Polyvalent', badge: 'Prepped', badgeColor: 'emerald', progress: 75, progressColor: 'from-emerald-500 to-emerald-400', note: 'CSL Seqirus Taipan/Death Adder at 3.8°C cold chain.' },
                  { title: 'Mine OHS Zero Harm', value: '100%', detail: 'Fit for Work', badge: '0 LTI', badgeColor: 'emerald', progress: 100, progressColor: 'from-emerald-500 to-emerald-400', note: 'Hydration rotation enforced at Pit 3 (WBGT 32°C).' }
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-3 hover:border-white/10 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">{item.title}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        item.badgeColor === 'rose' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>{item.badge}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-mono text-white">{item.value}</span>
                      <span className="text-xs text-slate-400">{item.detail}</span>
                    </div>
                    <div className="w-full bg-black/30 h-2 rounded-full overflow-hidden">
                      <div className={`bg-gradient-to-r ${item.progressColor} h-full rounded-full`} style={{ width: `${item.progress}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400">{item.note}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Anti-Theft Controls */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-white">Anti-Theft & Drug Audit</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                All medication dispensations digitally logged with <span className="text-red-400 font-bold">read-only worksheet protection</span>.
              </p>
              <div className="space-y-2">
                {[
                  { label: 'AES Encryption', value: 'ACTIVE', color: 'emerald' },
                  { label: 'Sheet Cell Locking', value: 'READ-ONLY', color: 'emerald' },
                  { label: 'Pharmacist Audit Log', value: 'RECORDED', color: 'cyan' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-[11px] text-slate-400 font-mono">{item.label}</span>
                    <span className={`text-[11px] font-bold ${item.color === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Critical Stock */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Pill className="w-4 h-4 text-rose-400" />
                  Critical Stock
                </h3>
                <span className="text-[10px] font-bold text-rose-400 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  {stats?.low_stock_count || 2} Low
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Salbutamol Inhaler 100mcg', category: 'Respiratory', stock: 14, min: 25 },
                  { name: 'Ciprofloxacin 500mg', category: 'Antibiotic', stock: 18, min: 30 }
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-rose-400 block">{item.stock} left</span>
                      <span className="text-[9px] text-slate-500">Min: {item.min}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setActiveTab('pharmacy')} className="w-full mt-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-cyan-400 transition-all">
                View Full Formulary
              </button>
            </GlassCard>

            {/* Top Diagnoses */}
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-cyan-400" />
                Top Clinical Diagnoses
              </h3>
              <div className="space-y-2">
                {(stats?.topDiagnoses || [
                  { diagnosis: 'Acute Falciparum Malaria', count: 3 },
                  { diagnosis: 'Bronchial Asthma Exacerbation', count: 1 },
                  { diagnosis: 'Clean Incised Wound / Trauma', count: 1 },
                  { diagnosis: 'Acute Gastroenteritis / Dehydration', count: 1 }
                ]).map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded-lg transition-all">
                    <span className="text-slate-300 font-medium truncate max-w-[180px]">{d.diagnosis}</span>
                    <span className="font-mono font-bold text-cyan-400 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20">{d.count}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* TAB 2: OBSERVATION WARD */}
      {selectedDashboardTab === 'beds' && (
        <div className="space-y-4">
          <GlassCard className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <BedDouble className="w-5 h-5 text-red-500" />
                Hospital Inpatient & Observation Bay (10 Beds)
              </h2>
              <p className="text-xs text-slate-400 mt-1">Emergency resuscitation, tropical medicine observation, snakebite venom monitoring, and mine injury stabilization.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">6 Available</span>
              <span className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs">4 Occupied</span>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(stats?.beds || []).map((bed) => {
              const isOccupied = bed.status === 'Occupied';
              const isCleaning = bed.status === 'Cleaning / Sanitizing';
              return (
                <div key={bed.id} className={`p-5 rounded-2xl border transition-all duration-300 ${
                  isOccupied 
                    ? 'border-red-500/30 bg-gradient-to-b from-red-500/10 to-black/20 shadow-lg shadow-red-950/20 hover:shadow-red-500/20' 
                    : isCleaning
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-white/5 bg-black/20 hover:border-white/10 hover:bg-white/5'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono font-black text-red-400 block">{bed.bed_code}</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{bed.ward_name}</h4>
                        <p className="text-[11px] text-slate-400">{bed.bed_type}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        isOccupied ? 'bg-red-600 text-white shadow-sm' 
                        : isCleaning ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>{bed.status}</span>
                    </div>

                    {isOccupied ? (
                      <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{bed.patient_name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{bed.patient_code}</span>
                        </div>
                        <p className="text-xs text-amber-300 font-medium">{bed.diagnosis}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{bed.vitals_ticker}</p>
                        <p className="text-[10px] text-slate-500 mt-1 italic">Attending: {bed.attending_doctor}</p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-black/10 border border-white/5 text-xs text-slate-500 italic">
                        {bed.notes || 'Bed sanitized, fresh linen, ready for immediate clinical admission.'}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">{isOccupied ? bed.acuity_level : 'Status: Ready'}</span>
                    <button onClick={() => handleBedStatusToggle(bed)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isOccupied 
                        ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30'
                        : 'bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30'
                    }`}>
                      {isOccupied ? 'Discharge' : 'Admit'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: BLACK BOX */}
      {selectedDashboardTab === 'blackbox' && (
        <ActivityBlackBox activities={stats?.activities || []} onLogNewActivity={() => window.location.reload()} />
      )}

      {/* TAB 5: MINE OHS */}
      {selectedDashboardTab === 'ohs' && (
        <div className="space-y-6">
          <GlassCard className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-400" />
                Mine Site Occupational Health & Safety (OHS)
              </h2>
              <p className="text-xs text-slate-400 mt-1">Zero Harm monitoring, heat stress WBGT index, pit/plant incident registries, and fit-for-work certification.</p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white">
              Concession: Markham Valley Open Pit & Processing Plant
            </span>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Thermometer, label: 'Heat Stress (WBGT)', value: '32.4°C', badge: 'Condition Yellow', color: 'amber', note: 'Mandatory 15-min hydration break enforced for all conveyor belt & pit operations.' },
              { icon: ShieldCheck, label: 'Lost Time Injuries (LTI)', value: '0 Days Lost', badge: 'Zero Harm', color: 'emerald', note: 'Zero disabling injuries recorded this month across drilling, haulage, and ore crushing.' },
              { icon: CheckCircle2, label: 'Fit-for-Work Pass Rate', value: '98.2%', badge: 'Active Screening', color: 'cyan', note: 'Audiometry, visual acuity, blood pressure, and random breathalyzer screenings clear.' }
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="p-5 rounded-2xl bg-black/20 border border-white/5 space-y-3 hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">{item.label}</span>
                    <Icon className={`w-4 h-4 ${item.color === 'amber' ? 'text-amber-400' : item.color === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`} />
                  </div>
                  <div className={`text-3xl font-black font-mono ${item.color === 'amber' ? 'text-amber-400' : item.color === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                    {item.value}
                    <span className="text-xs text-slate-400 font-normal ml-2">{item.badge}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.note}</p>
                </div>
              );
            })}
          </div>

          {/* Incidents Table */}
          <GlassCard className="p-6">
            <h3 className="text-base font-bold text-white mb-4">Recent Mining Health & First Aid Incidents</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-300 uppercase tracking-wider font-semibold border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">Incident #</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4">Fit for Work</th>
                    <th className="py-3 px-4">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                  {(stats?.incidents || []).map((inc) => (
                    <tr key={inc.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-red-400">{inc.incident_code}</td>
                      <td className="py-3 px-4 font-bold text-white">{inc.patient_name} ({inc.employee_id})</td>
                      <td className="py-3 px-4">{inc.department}</td>
                      <td className="py-3 px-4">{inc.incident_type}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold ${inc.severity.includes('Treatment') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-slate-300 border border-white/5'}`}>
                          {inc.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-400">{inc.fit_for_work_status}</td>
                      <td className="py-3 px-4 text-slate-400 italic max-w-xs truncate">{inc.doctor_recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 6: SHIFT HANDOVER */}
      {selectedDashboardTab === 'handover' && (
        <div className="space-y-6">
          <GlassCard className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                Clinical Shift Handover & Emergency Alert Log
              </h2>
              <p className="text-xs text-slate-400 mt-1">Official clinical handover notes between Day Shift (06:00 - 18:00) and Night Shift (18:00 - 06:00).</p>
            </div>
            <button onClick={() => { sounds.playClick(); setIsNoteModalOpen(true); }} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-950/50 hover:shadow-red-500/30 transition-all">
              <Plus className="w-4 h-4" />
              + Record Handover Note
            </button>
          </GlassCard>

          <div className="space-y-3">
            {(stats?.shiftNotes || []).map((n) => {
              const isCritical = n.priority === 'Critical Emergency';
              const isAlert = n.priority === 'Clinical Alert';
              return (
                <div key={n.id} className={`p-5 rounded-2xl border transition-all ${
                  isCritical ? 'bg-gradient-to-r from-red-500/10 to-red-600/5 border-red-500/30 shadow-lg shadow-red-950/20' 
                  : isAlert ? 'bg-gradient-to-r from-amber-500/10 to-amber-600/5 border-amber-500/30'
                  : 'bg-black/20 border-white/5 hover:border-white/10'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isCritical ? 'bg-red-600 text-white animate-pulse' 
                          : isAlert ? 'bg-amber-500 text-slate-950'
                          : 'bg-white/10 text-slate-300 border border-white/5'
                        }`}>{n.priority}</span>
                        <span className="text-xs font-mono font-semibold text-slate-400">{n.shift_type}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{n.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">{n.note_content}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-300">{n.author_name}</p>
                      <p className="text-[10px] text-red-400 font-mono">{n.author_role}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SHIFT NOTE MODAL */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0B1528] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-black/30 border-b border-white/5 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/20 text-red-400 rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Log Clinical Shift Handover Note</h3>
                  <p className="text-xs text-slate-400">Recorded by {currentUser?.full_name}</p>
                </div>
              </div>
              <button onClick={() => setIsNoteModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">✕</button>
            </div>

            <form onSubmit={handleAddShiftNote} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Note Title *</label>
                <input type="text" required placeholder="e.g. Taipan Antivenom Stock Status" value={newNoteTitle} onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Priority Level</label>
                  <select value={newNotePriority} onChange={(e) => setNewNotePriority(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all">
                    <option value="Standard">Standard</option>
                    <option value="Clinical Alert">Clinical Alert</option>
                    <option value="Critical Emergency">Critical Emergency</option>
                    <option value="Medication Stock">Medication Stock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Category</label>
                  <select value={newNoteCategory} onChange={(e) => setNewNoteCategory(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all">
                    <option value="Clinical Telemetry">Clinical Telemetry</option>
                    <option value="Malaria Surveillance">Malaria Surveillance</option>
                    <option value="Medication Stock">Medication Stock</option>
                    <option value="Mine Safety Incident">Mine Safety Incident</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Clinical Handover Details *</label>
                <textarea required rows={4} placeholder="Detailed notes for incoming shift medical officers..." value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all" />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsNoteModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-sm font-semibold transition-all">Cancel</button>
                <button type="submit" disabled={isSubmittingNote} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-950/50 disabled:opacity-50 transition-all">
                  {isSubmittingNote ? 'Recording...' : 'Submit Handover Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
