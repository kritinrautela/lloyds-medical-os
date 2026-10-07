import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { useEscapeKey, useFocusTrap } from './ui';

/*
 * The shell every printed document shares.
 *
 * On screen: a control bar that does not print, and a sheet of paper on a
 * desk that does. The paper is always the day palette, whatever theme the
 * screen is in, because that is what will come out of the printer. The
 * facility letterhead is read from settings, so a letter printed in Lae
 * carries the name and address of the clinic in Lae.
 *
 * Seven documents use it: the referral letter, the fitness certificate, the
 * pharmacy receipt, the outpatient register, the shift report, the
 * notifiable disease line list and the monthly return.
 */

const PAGE_RULES = {
  a4: '',
  landscape: '@media print { @page { size: A4 landscape; margin: 10mm 12mm; } }',
  thermal: '@media print { @page { size: 80mm auto; margin: 4mm; } }'
};

/* A sheet keeps its printed proportions on screen. On a phone the desk
   scrolls sideways under it, the way a print preview does, rather than
   reflowing an A4 letter into a column one word wide. */
const PAPER_WIDTH = {
  a4: 'min-w-[640px] max-w-[210mm] px-10 py-10 sm:px-12',
  landscape: 'min-w-[900px] max-w-[297mm] px-10 py-8',
  thermal: 'max-w-[80mm] px-4 py-5'
};

export function PrintFrame({
  title, subtitle, onClose, printLabel = 'Print', children,
  wide = false, page = 'a4', controls = null
}) {
  useEscapeKey(onClose);
  const cardRef = useRef(null);
  useFocusTrap(cardRef);
  const size = page === 'landscape' || wide ? 'landscape' : page;
  const width = size === 'landscape' ? 'max-w-6xl' : size === 'thermal' ? 'max-w-lg' : 'max-w-4xl';

  return (
    <div
      className="scrim scrim-scroll printable-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {PAGE_RULES[size] ? <style>{PAGE_RULES[size]}</style> : null}
      <div ref={cardRef} tabIndex={-1} className={`printable-modal-card enter w-full ${width} overflow-hidden rounded-lg border border-line bg-surface shadow-overlay outline-none`}>
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div className="min-w-0 flex-1 basis-56">
            <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="truncate text-2xs text-ink-3">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              {printLabel}
            </button>
            <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="print-desk overflow-x-auto p-3 sm:p-6">
          <div className={`printable-area paper mx-auto rounded-sm border border-line shadow-raised ${PAPER_WIDTH[size]} font-sans text-xs leading-normal`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The letterhead: who issued the document, and what the document is. */
export function FacilityHeader({ settings, documentTitle, reference, meta = [], compact = false }) {
  const address = [settings?.address, settings?.district, settings?.province, settings?.country || 'Papua New Guinea']
    .filter(Boolean).join(', ');
  const contact = [
    settings?.phone ? `Phone ${settings.phone}` : null,
    settings?.reg_number ? `Registration ${settings.reg_number}` : null
  ].filter(Boolean).join(' · ');

  if (compact) {
    return (
      <header className="border-b-2 border-ink pb-3 text-center">
        <img src="/lloyds-panguna-logo.png" alt="" className="mx-auto h-7 w-auto object-contain" />
        <p className="mt-1.5 text-sm font-bold leading-tight text-ink">{settings?.name || 'Clinic'}</p>
        {settings?.tagline ? <p className="text-2xs text-ink-2">{settings.tagline}</p> : null}
        <p className="mt-1 text-2xs text-ink-3">{address}</p>
        {contact ? <p className="text-2xs text-ink-3">{contact}</p> : null}
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink">{documentTitle}</p>
        {reference ? <p className="font-mono text-2xs text-ink-2">{reference}</p> : null}
      </header>
    );
  }

  return (
    <header className="border-b-2 border-ink pb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <img src="/lloyds-panguna-logo.png" alt="" className="h-8 w-auto max-w-[220px] object-contain object-left" />
          <p className="mt-2.5 text-base font-bold leading-tight text-ink">{settings?.name || 'Clinic'}</p>
          {settings?.tagline ? <p className="mt-0.5 text-xs leading-snug text-ink-2">{settings.tagline}</p> : null}
          <p className="mt-1.5 text-2xs leading-snug text-ink-3">{address}</p>
          {contact ? <p className="text-2xs leading-snug text-ink-3">{contact}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold uppercase tracking-wide text-ink">{documentTitle}</p>
          {reference ? <p className="mt-0.5 font-mono text-xs text-ink-2">{reference}</p> : null}
          {meta.map(([label, value]) => (
            <p key={label} className="mt-0.5 text-2xs text-ink-3">
              {label} <span className="font-semibold text-ink-2">{value}</span>
            </p>
          ))}
        </div>
      </div>
    </header>
  );
}

/** A numbered section of a longer document. */
export function DocSection({ number, title, children, className = '' }) {
  return (
    <section className={`mt-5 ${className}`}>
      <h3 className="border-b border-line pb-1 text-2xs font-semibold uppercase tracking-wide text-ink-2">
        {number ? `${number}. ` : ''}{title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Label-and-value pairs laid out as a grid, for the top of a document. */
export function DocMeta({ items, columns = 3 }) {
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[columns] || 'grid-cols-2';
  return (
    <dl className={`grid ${cols} gap-x-6 gap-y-2.5`}>
      {items.filter(Boolean).map(([label, value, mono]) => (
        <div key={label} className="min-w-0">
          <dt className="text-2xs uppercase tracking-wide text-ink-3">{label}</dt>
          <dd className={`truncate text-sm font-semibold text-ink ${mono ? 'font-mono' : ''}`}>
            {value === null || value === undefined || value === '' ? <span className="font-normal text-ink-3">Not recorded</span> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A ruled strip of the figures a document summarises. */
export function DocFigures({ items }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded border border-line sm:grid-cols-4">
      {items.map(([label, value, context, tone]) => (
        <div key={label} className="px-3 py-2.5">
          <p className="text-2xs uppercase tracking-wide text-ink-3">{label}</p>
          <p className={`mt-0.5 text-lg font-semibold leading-tight ${tone === 'critical' ? 'text-critical' : tone === 'ok' ? 'text-ok' : 'text-ink'}`}>{value}</p>
          {context ? <p className="text-2xs text-ink-3">{context}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function Row({ label, children, wide = false }) {
  return (
    <div className={`grid gap-3 py-1.5 ${wide ? 'grid-cols-[9rem_1fr]' : 'grid-cols-[8rem_1fr]'} border-b border-dotted border-line text-sm`}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children || <span className="text-ink-3">Not recorded</span>}</dd>
    </div>
  );
}

export function SignatureLine({ label, name, hint }) {
  return (
    <div>
      <div className="h-10 border-b border-ink" />
      <p className="mt-1 text-xs text-ink-2">{label}</p>
      {name ? <p className="text-sm font-semibold text-ink">{name}</p> : null}
      {hint ? <p className="text-2xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** Where the facility stamp goes. A plain box; the stamp supplies the colour. */
export function StampBox({ label = 'Facility stamp' }) {
  return (
    <div className="flex h-[4.5rem] items-end justify-center rounded border border-line-strong px-2 pb-1.5">
      <p className="text-2xs uppercase tracking-wide text-ink-3">{label}</p>
    </div>
  );
}

/** Signature lines and, if wanted, the stamp box, kept together on one page. */
export function SignatureBlock({ lines, stamp = false, className = 'mt-8' }) {
  const cols = lines.length + (stamp ? 1 : 0);
  return (
    <div className={`avoid-break grid gap-8 ${cols >= 3 ? 'grid-cols-3' : 'grid-cols-2'} ${className}`}>
      {lines.map((line) => <SignatureLine key={line.label} {...line} />)}
      {stamp ? <StampBox /> : null}
    </div>
  );
}

/** The last line of every document: who printed it, when, and what it is. */
export function DocFooter({ settings, reference, note = 'Confidential. For facility records.' }) {
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-2 text-2xs text-ink-3">
      <span>{settings?.name || 'Clinic'}{note ? ` · ${note}` : ''}</span>
      <span>Printed {longDateTime(new Date())}{reference ? ` · ${reference}` : ''}</span>
    </footer>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseWhen(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const s = String(value).trim();
  // A date alone is a local calendar day. A date with a time is a database
  // timestamp, which is written in UTC, so it is shifted to the clinic's day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(`${s}T00:00:00`)
    : new Date(s.includes('T') || s.endsWith('Z') ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function longDate(value) {
  if (!value) return '';
  const d = parseWhen(value);
  if (!d) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* "6 Sep 2026, 14:32" cannot be read as any other date. "9/6/2026" is 9 June
   to a Papua New Guinean reader and 6 September to an American one. */
export function longDateTime(value) {
  const d = parseWhen(value);
  if (!d) return 'Not recorded';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

export function clockOf(value) {
  const d = parseWhen(value);
  if (!d) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* The clinic's own calendar day as YYYY-MM-DD. toISOString() gives the UTC
   day, which at two in the morning in Lae is still yesterday. */
export function localDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function money(value) {
  const n = parseFloat(value);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}
