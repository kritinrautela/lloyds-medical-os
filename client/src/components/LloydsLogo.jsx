import React from 'react';

/**
 * Official Lloyds Metals Brand Logo Component
 * Matches https://lloyds.in/ and the official company identity:
 * - Left: Black badge with white industrial gear / spoked wheel emblem
 * - Right: Bold red (#E31E24) block with solid black typography "LLOYDS METALS"
 * - Subtitle: Papua New Guinea Operations
 */
export default function LloydsLogo({ 
  size = 'md', 
  showSubtitle = false, 
  subtitle = 'Papua New Guinea Operations',
  className = '',
  mode = 'auto' // 'auto', 'image', 'svg'
}) {
  const heightClasses = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
    xl: 'h-16'
  };

  const hClass = heightClasses[size] || 'h-10';

  return (
    <div className={`inline-flex flex-col items-start ${className}`}>
      <div className={`flex items-stretch rounded-sm overflow-hidden shadow-sm border border-slate-900/60 ${hClass}`}>
        {/* Real PNG Asset from official upload */}
        <img 
          src="/lloyds_metals_logo.png" 
          alt="Lloyds Metals" 
          className="h-full w-auto object-contain block select-none"
          onError={(e) => {
            // Fallback to crisp SVG if image fails to load
            e.target.style.display = 'none';
            if (e.target.nextSibling) {
              e.target.nextSibling.style.display = 'flex';
            }
          }}
        />

        {/* Vector SVG High-Res Fallback */}
        <div className="hidden items-stretch h-full">
          {/* Black Square with Wheel Emblem */}
          <div className="bg-[#141414] aspect-square h-full flex items-center justify-center p-1 border-r border-black/40">
            <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
              {/* Outer wheel ring */}
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" />
              {/* Inner ring */}
              <circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" strokeWidth="5" />
              {/* Center hub */}
              <circle cx="50" cy="50" r="10" fill="currentColor" />
              {/* Spokes */}
              <line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" strokeWidth="6" />
              <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="5" />
              <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="5" />
              <line x1="20" y1="80" x2="80" y2="20" stroke="currentColor" strokeWidth="5" />
            </svg>
          </div>

          {/* Red Rectangle with LLOYDS METALS in Bold Black */}
          <div className="bg-[#E31E24] px-3 flex items-center justify-center">
            <span className="font-extrabold tracking-tight text-black text-sm md:text-base uppercase font-sans whitespace-nowrap">
              LLOYDS METALS
            </span>
          </div>
        </div>
      </div>

      {showSubtitle && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 font-mono">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
