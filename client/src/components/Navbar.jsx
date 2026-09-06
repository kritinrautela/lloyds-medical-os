import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LloydsLogo from './LloydsLogo';
import { 
  Search, 
  UserCheck, 
  Plus, 
  FileSpreadsheet, 
  Lock, 
  Clock, 
  Stethoscope, 
  Sparkles,
  ShieldAlert,
  ChevronDown,
  LogOut,
  Users,
  ShieldCheck
} from 'lucide-react';

export default function Navbar({ 
  settings, 
  onQuickSearch, 
  onOpenCheckIn, 
  onOpenDispense, 
  onOpenExport,
  onOpenEmergencyAlert
}) {
  const { currentUser, setIsAuthModalOpen } = useAuth();
  const [searchVal, setSearchVal] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onQuickSearch) onQuickSearch(searchVal);
  };

  return (
    <header className="h-16 bg-white/90 backdrop-blur-2xl border-b border-slate-200/90 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.03)] select-none">
      {/* Clinic Name & Concession Details */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <h2 className="text-xs md:text-sm font-extrabold text-slate-900 tracking-wide truncate max-w-xs md:max-w-md flex items-center gap-2">
            <span>{settings?.name || 'Lloyds Metals & Energy Ltd'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          </h2>
          <p className="text-[10px] md:text-[11px] text-slate-500 font-medium">
            {settings?.district || 'Markham Concession'}, {settings?.province || 'Papua New Guinea'}
          </p>
        </div>
      </div>

      {/* Center Search Bar */}
      <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center relative w-72 xl:w-96">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          id="navbar-quick-search"
          type="text"
          value={searchVal}
          onChange={(e) => {
            setSearchVal(e.target.value);
            if (onQuickSearch) onQuickSearch(e.target.value);
          }}
          placeholder="Search patient, village, batch, drug..."
          className="w-full bg-slate-100/90 border border-slate-200 rounded-xl pl-9 pr-10 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 transition-all shadow-inner"
        />
        <span className="absolute right-3 text-[10px] font-mono text-slate-400 pointer-events-none">
          ESC
        </span>
      </form>

      {/* Right Controls, Telemetry & User Menu */}
      <div className="flex items-center gap-2.5">
        {/* Clock & Shift Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-mono shadow-sm">
          <Clock className="w-3.5 h-3.5 text-red-500" />
          <span className="text-slate-900 font-bold">{timeStr}</span>
          <span className="text-slate-500 text-[10px]">({dateStr})</span>
        </div>

        {/* Quick Check-In Button (Green Gradient) */}
        <button
          id="btn-quick-checkin"
          onClick={onOpenCheckIn}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/25 hover:scale-[1.02] active:scale-95 transition-all"
          title="Fast Patient Registration & Triage Check-in"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Check-in</span>
        </button>

        {/* Quick Dispense Button (Cyan Gradient) */}
        <button
          id="btn-quick-dispense"
          onClick={onOpenDispense}
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-cyan-500/25 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <span>Dispense</span>
        </button>

        {/* Locked Excel Export (Read-Only) */}
        <button
          id="btn-navbar-export"
          onClick={onOpenExport}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs shadow-sm transition-all"
          title="Export Password-Protected, Read-Only Audit Excel"
        >
          <Lock className="w-3 h-3 text-red-500" />
          <span>Locked Excel</span>
        </button>

        {/* Active Staff Profile & Switch Shift Menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all text-left shadow-sm"
          >
            <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-sm font-bold text-red-600">
              {currentUser?.avatar || '👨‍⚕️'}
            </div>
            <div className="hidden sm:block text-left pr-1">
              <span className="text-xs font-bold text-slate-900 block leading-tight truncate max-w-[130px]">
                {currentUser?.full_name?.split(' ')[0] || 'Staff'}
              </span>
              <span className="text-[10px] text-red-600 font-semibold block leading-tight font-mono">
                {currentUser?.role?.split(' ')[0] || 'Doctor'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* User Dropdown Menu */}
          {isUserMenuOpen && (
            <div 
              className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
              onMouseLeave={() => setIsUserMenuOpen(false)}
            >
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {currentUser?.full_name}
                </p>
                <p className="text-[11px] text-red-600 font-medium">
                  {currentUser?.role}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  ID: {currentUser?.staff_id} • {currentUser?.department}
                </p>
              </div>

              <div className="py-1 space-y-0.5">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all text-left"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Switch Duty Shift / Staff</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all text-left"
                >
                  <Users className="w-4 h-4 text-cyan-600" />
                  <span>Create / Register Staff</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Log Out / Close Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
