import React from 'react';
import { Printer, X } from 'lucide-react';

/*
 * The shell every printed document shares: a control bar that does not print,
 * and an A4 area that does. The facility header is read from settings, so a
 * letter printed in Lae carries the name and address of the clinic in Lae.
 */
export function PrintFrame({ title, subtitle, onClose, printLabel = 'Print', children, wide = false }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="printable-modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0f172a]/40 p-4 pt-6 pb-12 backdrop-blur-xs"
    >
      <div className={`printable-modal-card relative my-4 w-full ${wide ? 'max-w-5xl' : 'max-w-3xl'} overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl`}>
        <div className="no-print flex items-center justify-between gap-3 border-b border-[#e2e8f0] bg-[#f8fafc]/90 px-5 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[#0f172a]">{title}</h3>
            {subtitle ? <p className="truncate text-xs text-[#64748b]">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0f172a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#334155]"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              {printLabel}
            </button>
            <button type="button" onClick={onClose} aria-label="Close"
              className="rounded-lg p-2 text-[#94a3b8] hover:bg-[#e2e8f0]/60 hover:text-[#334155]">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="printable-area bg-white p-8 font-sans leading-normal text-[#0f172a] sm:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}

export function FacilityHeader({ settings, documentTitle, reference }) {
  return (
    <div className="border-b-2 border-[#0f172a] pb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <img src="/lloyds_metals_logo.png" alt="" className="h-7 object-contain" />
            <div className="border-l-2 border-[#dc2626] pl-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#dc2626]">{documentTitle}</p>
              <p className="text-base font-bold leading-tight text-[#0f172a]">{settings?.name || 'Clinic'}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#475569]">
            {[settings?.address, settings?.district, settings?.province, settings?.country || 'Papua New Guinea'].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-[#475569]">
            {settings?.phone ? `Phone ${settings.phone}` : null}
            {settings?.phone && settings?.reg_number ? ' · ' : null}
            {settings?.reg_number ? `Registration ${settings.reg_number}` : null}
          </p>
        </div>
        {reference ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Reference</p>
            <p className="font-mono text-sm font-bold text-[#0f172a]">{reference}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Row({ label, children, wide = false }) {
  return (
    <div className={`grid gap-3 py-1.5 ${wide ? 'grid-cols-[9rem_1fr]' : 'grid-cols-[8rem_1fr]'} border-b border-dotted border-[#e2e8f0] text-sm`}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{label}</dt>
      <dd className="min-w-0 break-words text-[#0f172a]">{children || <span className="text-[#94a3b8]">Not recorded</span>}</dd>
    </div>
  );
}

export function SignatureLine({ label, name }) {
  return (
    <div>
      <div className="h-10 border-b border-[#0f172a]" />
      <p className="mt-1 text-xs text-[#475569]">{label}</p>
      {name ? <p className="text-sm font-semibold text-[#0f172a]">{name}</p> : null}
    </div>
  );
}

export function longDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  // A date alone is a local calendar day. A date with a time is a database
  // timestamp, which is written in UTC, so it is shifted to the clinic's day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(`${s}T00:00:00`)
    : new Date(s.includes('T') || s.endsWith('Z') ? s : `${s.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
