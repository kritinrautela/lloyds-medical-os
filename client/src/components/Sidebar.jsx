import React from 'react';
import LloydsLogo from './LloydsLogo';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Activity, 
  Pill, 
  ShoppingCart, 
  FileCheck, 
  FileSpreadsheet, 
  Cloud, 
  Settings, 
  HardDrive,
  WifiOff,
  Wifi,
  ShieldCheck,
  UserCheck,
  Sparkles,
  BedDouble,
  ShieldAlert
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, stats, isOnline }) {
  const { currentUser, setIsAuthModalOpen } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'patients', label: 'Patient Registry', icon: Users, badge: stats?.total_patients },
    { 
      id: 'queue', 
      label: 'OPD & Triage Queue', 
      icon: Activity, 
      badge: stats?.today_visitors > 0 ? `${stats?.today_visitors} Active` : null,
      badgeClass: 'bg-amber-500 text-slate-950 shadow-sm'
    },
    { 
      id: 'pharmacy', 
      label: 'Pharmacy Formulary', 
      icon: Pill, 
      badge: stats?.low_stock_count > 0 ? `${stats.low_stock_count} Low` : null,
      badgeClass: 'bg-rose-500 text-white shadow-sm'
    },
    { id: 'dispense', label: 'Dispensing POS', icon: ShoppingCart },
    { id: 'staff', label: 'Staff & Access Control', icon: ShieldCheck },
    { id: 'end-of-day', label: 'Shift Reconciliation', icon: FileCheck },
    { id: 'export', label: 'Locked Excel (Read-Only)', icon: FileSpreadsheet, highlight: true },
    { id: 'cloud-sync', label: 'Google Cloud Sync', icon: Cloud },
    { id: 'settings', label: 'Facility Settings', icon: Settings },
  ];

  return (
    <aside className="w-72 bg-[#060C18] border-r border-slate-800/80 backdrop-blur-2xl flex flex-col justify-between h-screen sticky top-0 select-none z-30 shadow-2xl">
      <div>
        {/* Official Lloyds Metals Brand Header */}
        <div className="p-4 border-b border-slate-800/80 bg-gradient-to-b from-red-950/20 via-transparent to-transparent">
          <div className="flex flex-col gap-2">
            <LloydsLogo size="md" showSubtitle={true} subtitle="PNG Mining Operations" />
            <p className="text-[11px] font-medium text-slate-400 mt-0.5 tracking-wide">
              Occupational Health & Community Hospital
            </p>
          </div>

          {/* Offline / Online Engine Pill */}
          <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className="text-slate-300 font-semibold text-[11px] tracking-wide">
                {isOnline ? 'Wi-Fi Replicated' : '100% Offline SQLite'}
              </span>
            </div>
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-270px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600/30 via-red-700/20 to-transparent text-white border border-red-500/50 shadow-md shadow-red-950/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg transition-colors ${
                    isActive ? 'bg-red-600/30 text-red-400' : 'text-slate-400 group-hover:text-red-400 group-hover:bg-slate-800'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`font-semibold tracking-wide ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                    item.badgeClass || (isActive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400')
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Shift Worker & System Status */}
      <div className="p-3 border-t border-slate-800 bg-[#040812] text-xs space-y-2.5">
        {/* Active Staff Card (Clickable to switch shift) */}
        <div 
          onClick={() => setIsAuthModalOpen(true)}
          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-red-500/60 transition-all cursor-pointer group flex items-center justify-between"
          title="Click to Switch Duty Shift or Staff Member"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-sm font-bold text-red-300 shrink-0">
              {currentUser?.avatar || '👨‍⚕️'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">
                {currentUser?.full_name || 'Staff Member'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {currentUser?.staff_id || 'LMEL-MED'} • {currentUser?.role || 'Medical Officer'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60 shrink-0">
            Switch
          </span>
        </div>

        {/* System & Encryption Tag */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-slate-300">USB Pen-Drive Protected</span>
          </div>
          <span className="text-red-400 font-mono text-[10px] font-bold">AES LOCKED</span>
        </div>
      </div>
    </aside>
  );
}
