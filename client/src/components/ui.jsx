import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

/*
 * Shared interface primitives.
 *
 * Two conventions run through this file and the rest of the dashboard:
 *
 *  1. A value the database does not hold renders as an em dash. Nothing here
 *     substitutes a plausible-looking default for a missing measurement.
 *  2. Colour is reserved for clinical and operational state. Structure is
 *     always neutral, so an amber or red element on screen always means
 *     something needs attention.
 */

/** Renders a value, or an em dash when the record has none. */
export function Value({ children, suffix }) {
  const empty =
    children === null ||
    children === undefined ||
    children === '' ||
    (typeof children === 'number' && Number.isNaN(children));

  if (empty) return <span className="unrecorded" title="Not recorded">—</span>;
  return (
    <>
      {children}
      {suffix ? <span className="text-ink-3">{suffix}</span> : null}
    </>
  );
}

/** Minutes as a short duration, e.g. 84 -> "1h 24m". */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return null;
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function formatClock(value) {
  if (!value) return null;
  const d = new Date(String(value).includes('T') ? value : `${value}Z`.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Day first, month as a word, 24-hour clock: "07 Sep, 00:10". The year is
 * added only when it is not the current one. Numeric-only dates are avoided
 * because 07/09 reads two ways; this form reads one way on every device.
 */
export function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(String(value).includes('T') ? value : `${value}Z`.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  const thisYear = d.getFullYear() === new Date().getFullYear();
  const day = `${pad2(d.getDate())} ${MONTHS[d.getMonth()]}${thisYear ? '' : ` ${d.getFullYear()}`}`;
  return `${day}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Day first with the year, no time: "07 Sep 2026". */
export function formatDate(value) {
  if (!value) return null;
  const d = new Date(String(value).includes('T') ? value : `${value}Z`.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');

export function Panel({ children, className = '', as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`panel ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function PanelHead({ title, note, children }) {
  return (
    <header className="panel-head flex-wrap">
      {/* The title keeps a readable width; when the controls no longer fit
          beside it, they drop under it instead of crushing it. */}
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="panel-title truncate">{title}</h2>
        {note ? <p className="panel-note mt-0.5">{note}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

const TONES = {
  neutral: 'pill-neutral',
  ok: 'pill-ok',
  info: 'pill-info',
  warn: 'pill-warn',
  critical: 'pill-critical'
};

export function Pill({ tone = 'neutral', children, title, className = '' }) {
  return (
    <span className={`pill ${TONES[tone] || TONES.neutral} ${className}`} title={title}>
      {children}
    </span>
  );
}

/**
 * Counts up to a whole number when it first appears. Purely a reading aid: it
 * draws the eye to the figure that changed since the last refresh. It is
 * skipped entirely for anyone who has asked their system to reduce motion, and
 * for anything that is not a plain integer.
 */
export function AnimatedNumber({ value }) {
  const numeric = typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
  const [shown, setShown] = useState(numeric ? value : null);
  const frame = useRef(null);

  useEffect(() => {
    if (!numeric) return undefined;
    const reduce = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || value === 0 || Math.abs(value) > 100000) {
      setShown(value);
      return undefined;
    }

    const from = 0;
    const start = performance.now();
    const duration = 420;

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [value, numeric]);

  if (!numeric) return <Value>{value}</Value>;
  return <>{shown}</>;
}

/**
 * A single measured figure. `context` is the denominator or comparison that
 * makes the number readable — a bare number on a clinical board is a number
 * nobody can act on. `tint` names the department the figure belongs to and
 * colours only the icon; `tone` reports clinical state and colours the figure.
 */
export function Metric({ label, value, unit, context, tone = 'neutral', tint, icon: Icon, onClick }) {
  const toneText = {
    neutral: 'text-ink',
    ok: 'text-ok',
    warn: 'text-warn',
    critical: 'text-critical',
    info: 'text-info'
  }[tone];

  const chipClass = tone === 'critical' || tone === 'warn'
    ? `chip chip-${tone}`
    : `chip chip-${tint || 'brand'}`;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
        {Icon ? (
          <span className={chipClass} aria-hidden="true">
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <p className={`mt-1.5 text-[26px] leading-none font-semibold ${toneText}`}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : <Value>{value}</Value>}
        {unit && value !== null && value !== undefined ? (
          <span className="ml-1 text-sm font-medium text-ink-3">{unit}</span>
        ) : null}
      </p>
      <p className="mt-1.5 truncate text-xs text-ink-3" title={context || undefined}>
        {context || '\u00a0'}
      </p>
    </>
  );

  const chipVar = tint ? `chip-${tint}` : '';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`metric-cell ${chipVar} w-full px-4 py-3.5 text-left hover:bg-subtle`}
      >
        {body}
      </button>
    );
  }

  return <div className={`metric-cell ${chipVar} px-4 py-3.5`}>{body}</div>;
}

/** A ruled strip of metrics — one object, not a row of floating cards. */
export function MetricStrip({ children, columns = 6 }) {
  const cols = {
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-3 lg:grid-cols-5',
    6: 'sm:grid-cols-3 lg:grid-cols-6'
  }[columns];

  return (
    <div className={`panel grid grid-cols-2 ${cols} divide-x divide-y sm:divide-y-0 divide-line-soft overflow-hidden`}>
      {children}
    </div>
  );
}

/**
 * A column heading that sorts the table. The arrow shows the current order;
 * aria-sort tells a screen reader the same thing.
 */
export function SortableTh({ label, sortKey, sort, dir, onSort, className = '' }) {
  const active = sort === sortKey;
  const next = active && dir === 'asc' ? 'desc' : 'asc';
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded-sm font-[inherit] uppercase tracking-[inherit] transition-colors hover:text-ink ${active ? 'text-ink' : ''}`}
        onClick={() => onSort(sortKey, next)}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? '' : 'opacity-50'}`} aria-hidden="true" />
      </button>
    </th>
  );
}

/**
 * Bottom-of-table paging: what is on screen out of how many, a page size to
 * choose, and previous/next. Rows that never load are rows nobody has to scroll past.
 */
export function Pagination({ total, limit, offset, onChange, sizes = [25, 50, 100], noun = 'rows' }) {
  if (!total) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-2.5">
      <p className="text-2xs text-ink-3">
        Showing <span className="font-semibold text-ink-2">{from}–{to}</span> of <span className="font-semibold text-ink-2">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-2xs text-ink-3">
          Per page
          <select
            className="field h-7 w-auto py-0 text-xs"
            value={limit}
            onChange={(e) => onChange({ limit: Number(e.target.value), offset: 0 })}
          >
            {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-sm" disabled={!canPrev} onClick={() => onChange({ limit, offset: Math.max(0, offset - limit) })} aria-label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-sm" disabled={!canNext} onClick={() => onChange({ limit, offset: offset + limit })} aria-label="Next page">
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Hours since a timestamp, or null when it cannot be read. */
export function hoursSince(value) {
  if (!value) return null;
  const d = new Date(String(value).includes('T') ? value : `${value}Z`.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3600000;
}

/** "2 h ago", "3 d ago", "just now". */
export function ageLabel(value) {
  const h = hoursSince(value);
  if (h === null) return null;
  if (h < 1) return 'just now';
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/**
 * A failure that blocks a list is shown in the list's place, with a way to
 * try again, rather than as a passing toast the user may not see.
 */
export function ErrorState({ title = 'This could not be read', detail, onRetry, retryLabel = 'Try again' }) {
  return (
    <div role="alert" className="m-4 rounded-md border border-critical-line bg-critical-wash px-5 py-6 text-center">
      <p className="text-sm font-semibold text-critical">{title}</p>
      {detail ? <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-2">{detail}</p> : null}
      {onRetry ? (
        <div className="mt-3">
          <button type="button" className="btn btn-sm" onClick={onRetry}>{retryLabel}</button>
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, detail, action }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink-2">{title}</p>
      {detail ? <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-3">{detail}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/**
 * Horizontal bar sized against the largest value in the set. Used only where
 * the bar carries a real comparison, never as decoration.
 */
export function Bar({ value, max, tone = 'info' }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const fill = {
    info: 'from-info/70 to-info',
    ok: 'from-ok/70 to-ok',
    warn: 'from-warn/70 to-warn',
    critical: 'from-critical/70 to-critical',
    neutral: 'from-line-strong to-ink-3'
  }[tone];

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft" role="presentation">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${fill} transition-[width] duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clinical scoring
// ---------------------------------------------------------------------------

/**
 * Flags an adult observation against the standard early-warning bands used in
 * general triage. Paediatric ranges differ substantially, so patients under 12
 * are deliberately not scored rather than scored wrongly.
 */
export function scoreVital(kind, raw, age) {
  if (raw === null || raw === undefined || raw === '') return { tone: 'neutral', scored: false };
  if (typeof age === 'number' && age < 12) return { tone: 'neutral', scored: false, paediatric: true };

  const num = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
  if (Number.isNaN(num)) return { tone: 'neutral', scored: false };

  switch (kind) {
    case 'pulse':
      if (num < 40 || num > 130) return { tone: 'critical', scored: true };
      if (num < 51 || num > 110) return { tone: 'warn', scored: true };
      return { tone: 'ok', scored: true };
    case 'spo2':
      if (num < 92) return { tone: 'critical', scored: true };
      if (num < 95) return { tone: 'warn', scored: true };
      return { tone: 'ok', scored: true };
    case 'temp':
      if (num >= 39 || num < 35) return { tone: 'critical', scored: true };
      if (num >= 38) return { tone: 'warn', scored: true };
      return { tone: 'ok', scored: true };
    case 'resp':
      if (num < 9 || num > 24) return { tone: 'critical', scored: true };
      if (num > 20) return { tone: 'warn', scored: true };
      return { tone: 'ok', scored: true };
    case 'systolic':
      if (num < 91 || num > 200) return { tone: 'critical', scored: true };
      if (num > 160) return { tone: 'warn', scored: true };
      return { tone: 'ok', scored: true };
    default:
      return { tone: 'neutral', scored: false };
  }
}

export function systolicOf(bp) {
  if (!bp) return null;
  const match = String(bp).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  return match ? parseInt(match[1], 10) : null;
}

/** One observation cell: the recorded value, tinted only when it is abnormal. */
export function Vital({ label, value, unit, tone = 'neutral' }) {
  const colour = {
    neutral: 'text-ink-2',
    ok: 'text-ink',
    warn: 'text-warn',
    critical: 'text-critical'
  }[tone];

  return (
    <div className="min-w-0">
      <p className="text-2xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`text-sm font-semibold ${colour}`}>
        <Value>{value}</Value>
        {unit && value ? <span className="ml-0.5 text-2xs font-normal text-ink-3">{unit}</span> : null}
      </p>
    </div>
  );
}

/**
 * Occupancy ring. Reads as a proportion at a glance from across a room, which
 * a number alone does not, and still prints the exact figure in the middle.
 */
export function Donut({ value, max, label, tone = 'neutral', size = 92 }) {
  const safeMax = max > 0 ? max : 0;
  const pct = safeMax > 0 ? Math.min(1, value / safeMax) : 0;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const colour = {
    neutral: 'stroke-info',
    ok: 'stroke-ok',
    warn: 'stroke-warn',
    critical: 'stroke-critical'
  }[tone];

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value} of ${max}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          className="stroke-line-soft" strokeWidth={stroke} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          className={`${colour} transition-[stroke-dashoffset] duration-700 ease-out`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%" y="50%" dy="0.35em" textAnchor="middle"
          className="fill-ink text-[17px] font-semibold"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {safeMax > 0 ? `${Math.round(pct * 100)}%` : '\u2014'}
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{value} of {max}</p>
        <p className="text-xs text-ink-3">{label}</p>
      </div>
    </div>
  );
}

/** A quiet heading above a group of panels. */
export function SectionTitle({ children, note }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">{children}</h2>
      {note ? <p className="text-2xs text-ink-3">{note}</p> : null}
    </div>
  );
}

/*
 * Whether an allergy field actually records an allergy.
 *
 * Staff write "None", "None known", "Nil", "NKA" and half a dozen other ways of
 * saying the same thing. Treating any non-empty string as an allergy paints a
 * red warning on patients who have none, and a red warning that is usually
 * wrong is a red warning nobody reads.
 */
const NO_ALLERGY = /^(none|none known|no known allergies|nka|nkda|nil|nil known|n\/a|na|unknown|not known)[.\s]*$/i;

export function hasAllergy(value) {
  return !!value && !NO_ALLERGY.test(String(value).trim());
}

/**
 * "Nobody has asked" and "asked, and there are none" are different facts and
 * must never collapse into one line. Returns 'unknown', 'none' or 'allergy'.
 */
export function allergyState(value) {
  const text = String(value || '').trim();
  if (!text || /^(unknown|not known)[.\s]*$/i.test(text)) return 'unknown';
  if (NO_ALLERGY.test(text)) return 'none';
  return 'allergy';
}

// ---------------------------------------------------------------------------
// Loading placeholders
// ---------------------------------------------------------------------------

/** A block the shape of the text it stands in for while the record loads. */
export function Skeleton({ className = '' }) {
  return <span className={`skeleton block ${className}`} aria-hidden="true" />;
}

/**
 * Rows of a data table before the data arrives. The columns are already in
 * place, so the page does not jump when the rows fill in.
 */
export function TableSkeleton({ rows = 6, columns = 5, label = 'Loading' }) {
  const widths = ['w-40', 'w-24', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20'];
  return (
    <div role="status" aria-live="polite" className="px-4 py-1">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line-soft py-3.5 last:border-b-0" aria-hidden="true">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={`h-3 ${c === columns - 1 ? 'ml-auto w-16' : widths[c % widths.length]}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Rows of a people list, each with the disc where the avatar will sit. */
export function ListSkeleton({ rows = 4, label = 'Loading' }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 border-b border-line-soft px-4 py-3.5 last:border-b-0" aria-hidden="true">
          <Skeleton className="h-11 w-11 shrink-0 !rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-44 max-w-full" />
            <Skeleton className="h-2.5 w-64 max-w-full" />
          </div>
          <Skeleton className="hidden h-7 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** A block of panels before the page has read anything. */
export function PageSkeleton({ label = 'Loading' }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <div className="panel grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2.5 px-4 py-4">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        ))}
      </div>
      <div className="panel" aria-hidden="true">
        <div className="panel-head"><Skeleton className="h-3 w-32" /></div>
        <TableSkeleton rows={5} columns={4} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

/*
 * Escape closes the topmost open dialog and only that one. Dialogs stack, a
 * referral letter over a consultation over the queue, and a single key press
 * must not collapse the lot.
 */
const escapeStack = [];

export function useEscapeKey(onClose, active = true) {
  const handler = useRef(onClose);
  handler.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    const entry = {};
    escapeStack.push(entry);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (escapeStack[escapeStack.length - 1] !== entry) return;
      e.preventDefault();
      handler.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = escapeStack.indexOf(entry);
      if (i >= 0) escapeStack.splice(i, 1);
    };
  }, [active]);
}

const DIALOG_WIDTH = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl'
};

/**
 * The one dialog shell. A titled panel over the scrim, with a close button,
 * an optional footer row for its actions, and Escape wired to close.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside a dialog while it is open and hands it back to
 * the control that opened it when it closes. Tab from the last control wraps
 * to the first. Without this a keyboard user can tab behind the scrim into a
 * page they cannot see.
 */
export function useFocusTrap(ref, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const opener = document.activeElement;
    const focusables = () => Array.from(node.querySelectorAll(FOCUSABLE))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);

    const frame = window.requestAnimationFrame(() => {
      if (node.contains(document.activeElement)) return;
      const preferred = node.querySelector('[autofocus]');
      const target = preferred || focusables()[0] || node;
      if (typeof target.focus === 'function') target.focus({ preventScroll: true });
    });

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKey);

    return () => {
      window.cancelAnimationFrame(frame);
      node.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [ref, active]);
}

export function Dialog({ title, note, onClose, children, footer, size = 'md', label, className = '', bodyClassName = 'px-4 py-4' }) {
  useEscapeKey(onClose);
  const panelRef = useRef(null);
  useFocusTrap(panelRef);
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={label || title}>
      <div ref={panelRef} tabIndex={-1} className={`panel enter flex max-h-[92vh] w-full flex-col shadow-overlay outline-none ${DIALOG_WIDTH[size] || DIALOG_WIDTH.md} ${className}`}>
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {note ? <p className="mt-0.5 text-2xs text-ink-3">{note}</p> : null}
          </div>
          {onClose ? (
            <button type="button" className="btn btn-sm shrink-0" onClick={onClose} aria-label="Close">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A yes-or-no question before something that cannot be undone. The confirm
 * button says what will happen, never "OK".
 */
export function ConfirmDialog({
  title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = false, busy = false, onConfirm, onCancel
}) {
  return (
    <Dialog
      title={title}
      onClose={busy ? null : onCancel}
      size="sm"
      footer={(
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Working' : confirmLabel}
          </button>
        </>
      )}
    >
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </Dialog>
  );
}

/**
 * Asks for a line of text, in place of the browser's prompt box, which cannot
 * be styled, cannot be read by a screen reader as part of the page, and does
 * not show on some tablets at all.
 */
export function NoteDialog({
  title, note, label = 'Note', placeholder = '', initialValue = '',
  confirmLabel = 'Save', busy = false, error = '', onSubmit, onCancel, rows = 3
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <Dialog title={title} note={note} onClose={busy ? null : onCancel} size="md" bodyClassName="">
      <form
        onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit(value.trim()); }}
        className="flex flex-col"
      >
        <div className="px-4 py-4">
          <label className="label" htmlFor="note-dialog-field">{label}</label>
          <textarea
            id="note-dialog-field"
            className="field"
            rows={rows}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          {error ? <p className="mt-2 text-xs text-critical">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-4 py-3">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : confirmLabel}</button>
        </div>
      </form>
    </Dialog>
  );
}
