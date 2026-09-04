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
      border: 'border-cyan-500/20 hover:border-cyan-500/50',
      iconBg: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      glow: 'from-cyan-500/15 via-cyan-500/5 to-transparent',
      hoverShadow: 'hover:shadow-glow-cyan'
    },
    emerald: {
      border: 'border-emerald-500/20 hover:border-emerald-500/50',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      glow: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      hoverShadow: 'hover:shadow-glow-emerald'
    },
    amber: {
      border: 'border-amber-500/20 hover:border-amber-500/50',
      iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      glow: 'from-amber-500/15 via-amber-500/5 to-transparent',
      hoverShadow: 'hover:shadow-glow-amber'
    },
    rose: {
      border: 'border-rose-500/20 hover:border-rose-500/50',
      iconBg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      glow: 'from-rose-500/15 via-rose-500/5 to-transparent',
      hoverShadow: 'hover:shadow-glow-rose'
    },
    purple: {
      border: 'border-purple-500/20 hover:border-purple-500/50',
      iconBg: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      glow: 'from-purple-500/15 via-purple-500/5 to-transparent',
      hoverShadow: 'hover:shadow-glow-purple'
    }
  };

  const scheme = colorMap[color] || colorMap.cyan;

  return (
    <div 
      onClick={onClick}
      className={`glass-panel p-5 rounded-3xl relative overflow-hidden transition-all duration-300 ${scheme.border} ${scheme.hoverShadow} ${onClick ? 'cursor-pointer hover:-translate-y-1.5' : ''} group`}
    >
      {/* Background ambient corner glow */}
      <div className={`absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl ${scheme.glow} rounded-full blur-3xl pointer-events-none -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-500`} />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-display">
            {title}
          </p>
          <h3 className="text-3xl font-display font-extrabold text-white mt-1.5 tracking-tight">
            {value}
          </h3>
          {subtext && (
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {subtext}
            </p>
          )}
        </div>

        <div className={`p-3.5 rounded-2xl ${scheme.iconBg} shadow-inner group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">{badge.label}</span>
          <span className={`font-mono font-bold text-xs ${badge.colorClass || 'text-cyan-400'}`}>
            {badge.value}
          </span>
        </div>
      )}
    </div>
  );
}
