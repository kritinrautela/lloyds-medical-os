import React, { useEffect, useRef, useState } from 'react';

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

export function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(String(value).includes('T') ? value : `${value}Z`.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString([], {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

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

export function Pill({ tone = 'neutral', children, title }) {
  return (
    <span className={`pill ${TONES[tone] || TONES.neutral}`} title={title}>
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
