import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/*
 * Passing messages.
 *
 * A confirmation that something was recorded, with the one action that makes
 * sense straight afterwards: undo it, print it, open it. Good news closes on
 * its own after a few seconds and pauses while the pointer is over it. Bad
 * news stays until it is read and dismissed, because an error nobody saw is
 * an error nobody fixed.
 */
const ToastContext = createContext(null);

const AUTO_CLOSE_MS = 5000;
const MAX_SHOWN = 3;

const TONE = {
  ok: { icon: CheckCircle2, iconClass: 'text-ok', role: 'status' },
  info: { icon: Info, iconClass: 'text-info', role: 'status' },
  warn: { icon: AlertTriangle, iconClass: 'text-warn', role: 'status' },
  critical: { icon: AlertTriangle, iconClass: 'text-critical', role: 'alert' }
};

let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone, title, options = {}) => {
    const id = ++counter;
    const toast = {
      id,
      tone,
      title,
      detail: options.detail || '',
      action: options.action || null,
      sticky: options.sticky ?? tone === 'critical',
      duration: options.duration || AUTO_CLOSE_MS
    };
    setToasts((list) => [...list.slice(-(MAX_SHOWN - 1)), toast]);
    return id;
  }, []);

  const value = useMemo(() => ({
    ok: (title, options) => push('ok', title, options),
    info: (title, options) => push('info', title, options),
    warn: (title, options) => push('warn', title, options),
    error: (title, options) => push('critical', title, options),
    dismiss
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
        aria-label="Notifications"
      >
        {toasts.map((t) => <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }) {
  const tone = TONE[toast.tone] || TONE.info;
  const Icon = tone.icon;
  const timer = useRef(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (toast.sticky || paused) return undefined;
    timer.current = window.setTimeout(onDismiss, toast.duration);
    return () => window.clearTimeout(timer.current);
  }, [toast.sticky, toast.duration, paused, onDismiss]);

  return (
    <div
      role={tone.role}
      className="enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line bg-surface px-3.5 py-3 shadow-overlay"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.iconClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-ink">{toast.title}</p>
        {toast.detail ? <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{toast.detail}</p> : null}
        {toast.action ? (
          <button
            type="button"
            className="btn btn-sm mt-2"
            onClick={() => { toast.action.onClick?.(); onDismiss(); }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button type="button" className="btn btn-sm shrink-0" onClick={onDismiss} aria-label="Dismiss">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** The passing-message channel. Safe to call outside the provider: it does nothing. */
export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx || { ok() {}, info() {}, warn() {}, error() {}, dismiss() {} };
}
