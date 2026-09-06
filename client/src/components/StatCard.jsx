import React from 'react';

export default function StatCard({ 
  title, 
  value, 
  subtext, 
  icon: Icon, 
  color = 'cyan', 
  badge, 
  onClick 
}) {
  const colorMap = {
    cyan: {
      border: 'border-cyan-200/80 hover:border-cyan-400/80',
      iconBg: 'bg-cyan-50 text-cyan-600 border border-cyan-200',
      glow: 'from-cyan-400/15 via-cyan-200/10 to-transparent',
      hoverShadow: 'hover:shadow-md hover:shadow-cyan-500/10'
    },
    emerald: {
      border: 'border-emerald-200/80 hover:border-emerald-400/80',
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
      glow: 'from-emerald-400/15 via-emerald-200/10 to-transparent',
      hoverShadow: 'hover:shadow-md hover:shadow-emerald-500/10'
    },
    amber: {
      border: 'border-amber-200/80 hover:border-amber-400/80',
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-200',
      glow: 'from-amber-400/15 via-amber-200/10 to-transparent',
      hoverShadow: 'hover:shadow-md hover:shadow-amber-500/10'
    },
    rose: {
      border: 'border-rose-200/80 hover:border-rose-400/80',
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-200',
      glow: 'from-rose-400/15 via-rose-200/10 to-transparent',
      hoverShadow: 'hover:shadow-md hover:shadow-rose-500/10'
    },
    purple: {
      border: 'border-purple-200/80 hover:border-purple-400/80',
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-200',
      glow: 'from-purple-400/15 via-purple-200/10 to-transparent',
      hoverShadow: 'hover:shadow-md hover:shadow-purple-500/10'
    },
    red: {
      border: 'border-red-200/80 hover:border-red-400/80',
      iconBg: 'bg-red-50 text-red-600 border border-red-200',
      glow: 'from-red-400/15 via-red-200/10 to-transparent',
      hoverShadow: 'hover:shadow-md hover:shadow-red-500/10'
    }
  };

  const scheme = colorMap[color] || colorMap.cyan;

  return (
    <div 
      onClick={onClick}
      className={`hud-panel p-5 rounded-3xl relative overflow-hidden transition-all duration-300 ${scheme.border} ${scheme.hoverShadow} ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''} group bg-white/95 shadow-sm`}
    >
      {/* Background ambient corner glow */}
      <div className={`absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl ${scheme.glow} rounded-full blur-2xl pointer-events-none -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-500`} />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-display">
            {title}
          </p>
          <h3 className="text-3xl font-display font-black text-slate-900 mt-1.5 tracking-tight">
            {value}
          </h3>
          {subtext && (
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
              {subtext}
            </p>
          )}
        </div>

        <div className={`p-3.5 rounded-2xl ${scheme.iconBg} shadow-2xs group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px] font-medium">{badge.label}</span>
          <span className={`font-mono font-bold text-xs ${badge.colorClass || 'text-cyan-600'}`}>
            {badge.value}
          </span>
        </div>
      )}
    </div>
  );
}
