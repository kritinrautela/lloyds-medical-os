import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, DatabaseBackup, KeyRound, Loader2, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './toast';
import {
  ConfirmDialog, EmptyState, ErrorState, formatDateTime, ListSkeleton, Metric, MetricStrip, Panel, PanelHead, Pill, Value
} from './ui';

/*
 * What protects the records, in plain words, and the three things an
 * administrator can do about it from here: end a session on a device that
 * should not have one, sign everybody out at once, and keep the encrypted
 * backups going. Everything shown is read from the server; nothing here is
 * a promise the interface makes on its own.
 */
export default function SecurityPanel({ settings, isAdmin }) {
  const { currentUser, logout } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSecurityStatus();
      setStatus(res);
      setError('');
    } catch (err) {
      setError(err.message || 'The server did not answer.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const endSession = async (session) => {
    setEnding(session.id);
    try {
      await api.endSession(session.id);
      toast.ok(`Signed out ${session.user_name}`, { detail: session.device ? `On ${deviceLabel(session.device)}.` : '' });
      if (session.current) { await logout(); return; }
      await load();
    } catch (err) {
      toast.error('That session could not be ended', { detail: err.message || '' });
    } finally {
      setEnding(null);
    }
  };

  const signOutEverywhere = async () => {
    setConfirmAll(false);
    try {
      await api.logoutAll();
    } catch (err) {
      toast.error('Could not sign out everywhere', { detail: err.message || '' });
      return;
    }
    await logout();
  };

  const backupNow = async () => {
    setBackingUp(true);
    try {
      const res = await api.runBackup();
      toast.ok('Backup written', { detail: res?.file?.name ? `${res.file.name} (${sizeOf(res.file.size)})` : '' });
      await load();
    } catch (err) {
      toast.error('The backup failed', { detail: err.message || 'Nothing was written.' });
    } finally {
      setBackingUp(false);
    }
  };

  const sessions = status?.sessions || [];
  const SHOWN = 6;
  const shownSessions = showAllSessions ? sessions : sessions.slice(0, SHOWN);
  const backups = status?.backups || null;
  const signins = status?.signins || {};
  const lastBackupHours = backups?.last_at ? (Date.now() - new Date(backups.last_at.includes('T') ? backups.last_at : `${backups.last_at}Z`).getTime()) / 3600000 : null;
  const backupTone = !backups?.last_at ? 'critical' : lastBackupHours > 48 ? 'critical' : lastBackupHours > 26 ? 'warn' : 'ok';
  const backupWord = !backups?.last_at ? 'No backup yet' : lastBackupHours > 48 ? 'Overdue' : lastBackupHours > 26 ? 'Due' : 'Up to date';

  return (
    <Panel>
      <PanelHead title="Security" note="How records are protected on this server, and who is signed in">
        <Pill tone={status?.https?.available ? 'ok' : 'neutral'}>
          {status?.https?.available ? `HTTPS on ${status.https.port}` : 'HTTP on the clinic network'}
        </Pill>
      </PanelHead>

      {loading && !status ? (
        <ListSkeleton rows={4} label="Reading the security status" />
      ) : error && !status ? (
        <ErrorState title="The security status could not be read" detail={error} onRetry={load} />
      ) : (
        <div className="divide-y divide-line-soft">
          <MetricStrip>
            <Metric label="Failed sign-ins, 24 h" value={signins.failed_24h ?? '—'} tone={signins.failed_24h > 10 ? 'warn' : 'neutral'} />
            <Metric label="Accounts locked, 24 h" value={signins.locked_24h ?? '—'} tone={signins.locked_24h > 0 ? 'warn' : 'neutral'} />
            <Metric label="Throttled addresses, 24 h" value={signins.throttled_24h ?? '—'} tone={signins.throttled_24h > 0 ? 'critical' : 'neutral'} />
            <Metric label="Signed-in devices" value={sessions.length} />
          </MetricStrip>

          <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-xs sm:grid-cols-2">
            <Fact icon={ShieldCheck} label="Passwords" text={`Hashed with ${status?.password_hashing || 'scrypt'} on the server. Five wrong attempts lock an account for fifteen minutes; thirty from one address are refused for fifteen minutes.`} />
            <Fact icon={MonitorSmartphone} label="Sessions" text={`A signed-in device is signed out after ${status?.session?.idle_minutes ?? 15} idle minutes with a one-minute warning, and in any case after ${status?.session?.hours ?? 16} hours.`} />
            <Fact icon={KeyRound} label="On the wire" text="Every page and every request carries the security headers a browser needs to refuse framing, script injection and cross-site reads. Records are never cached by the browser." />
            <Fact icon={DatabaseBackup} label="Backups" text="An encrypted copy of the whole database is written every night at 23:45 and kept for fourteen days, with one a month kept for a year. Only the backup key or the passphrase can open it." />
          </dl>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-1">
              <h3 className="text-xs font-semibold text-ink">Signed-in devices</h3>
              <button type="button" className="btn btn-sm" onClick={() => setConfirmAll(true)}>
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign out everywhere
              </button>
            </div>
            {sessions.length === 0 ? (
              <EmptyState title="No sessions to show" />
            ) : (
              <ul className="divide-y divide-line-soft" aria-label="Signed-in devices">
                {shownSessions.map((sn) => (
                  <li key={sn.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {sn.user_name}
                        <span className="ml-1.5 text-2xs font-normal text-ink-3">{sn.role}{sn.staff_id ? ` · ${sn.staff_id}` : ''}</span>
                        {sn.current ? <Pill tone="info" className="ml-2">This device</Pill> : null}
                      </p>
                      <p className="text-2xs text-ink-3" title={sn.device || undefined}>
                        <Value>{deviceLabel(sn.device)}</Value>
                        {' · '}last seen <Value>{formatDateTime(sn.last_seen)}</Value>
                        {' · '}signed in <Value>{formatDateTime(sn.created_at)}</Value>
                      </p>
                    </div>
                    {isAdmin || sn.current ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={ending === sn.id}
                        onClick={() => endSession(sn)}
                        aria-label={`Sign out ${sn.user_name}${sn.device ? ` on ${sn.device}` : ''}`}
                      >
                        {ending === sn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                        {sn.current ? 'Sign out' : 'End session'}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {sessions.length > SHOWN ? (
              <div className="px-4 py-2">
                <button type="button" className="btn btn-sm" onClick={() => setShowAllSessions((v) => !v)}>
                  {showAllSessions ? 'Show fewer' : `Show all ${sessions.length}`}
                </button>
              </div>
            ) : null}
          </div>

          {isAdmin && backups ? (
            <BackupSection
              backups={backups}
              tone={backupTone}
              word={backupWord}
              busy={backingUp}
              onBackupNow={backupNow}
              onPassphraseSet={load}
              currentUser={currentUser}
            />
          ) : null}
        </div>
      )}

      {confirmAll ? (
        <ConfirmDialog
          title="Sign out of every device?"
          confirmLabel="Sign out everywhere"
          danger
          onCancel={() => setConfirmAll(false)}
          onConfirm={signOutEverywhere}
        >
          <p className="text-sm text-ink-2">
            Every session for <span className="font-semibold text-ink">{currentUser?.full_name}</span> ends now, including this one.
            Anyone using your account on another phone or computer is signed out and needs the password to get back in.
          </p>
        </ConfirmDialog>
      ) : null}
    </Panel>
  );
}

function Fact({ icon: Icon, label, text }) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
      <div>
        <dt className="font-semibold text-ink">{label}</dt>
        <dd className="mt-0.5 leading-relaxed text-ink-2">{text}</dd>
      </div>
    </div>
  );
}

function BackupSection({ backups, tone, word, busy, onBackupNow, onPassphraseSet }) {
  const toast = useToast();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setNote(null);
    if (passphrase.length < 12) { setNote('Use at least twelve characters. A short sentence you will remember is ideal.'); return; }
    if (passphrase !== confirm) { setNote('The two entries do not match.'); return; }
    setSaving(true);
    try {
      await api.setBackupPassphrase(passphrase);
      setPassphrase('');
      setConfirm('');
      toast.ok('Backup passphrase set', { detail: 'Write it down and keep it away from this computer. Without it, or the key file, a backup cannot be opened elsewhere.' });
      await onPassphraseSet?.();
    } catch (err) {
      setNote(err.message || 'The passphrase could not be set.');
    } finally {
      setSaving(false);
    }
  };

  const files = backups.files || [];

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-ink">
            Encrypted backups
            <Pill tone={tone} className="ml-2">{word}</Pill>
          </h3>
          <p className="mt-0.5 text-2xs text-ink-3">
            {backups.last_at ? <>Last written <Value>{formatDateTime(backups.last_at)}</Value> · {backups.count} kept</> : 'No backup has been written on this server yet.'}
            {backups.passphrase_set_at ? <> · passphrase set <Value>{formatDateTime(backups.passphrase_set_at)}</Value></> : null}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-primary" onClick={onBackupNow} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <DatabaseBackup className="h-3.5 w-3.5" aria-hidden="true" />}
          {busy ? 'Writing' : 'Back up now'}
        </button>
      </div>

      {!backups.passphrase_set_at ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-md border border-warn-line bg-warn-wash px-3 py-2 text-2xs leading-relaxed text-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Backups are encrypted with a key file on this computer only. Set a passphrase so a backup can be restored on a replacement machine if this one is lost or stolen.
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="bk-pass">{backups.passphrase_set_at ? 'New passphrase' : 'Backup passphrase'}</label>
          <input id="bk-pass" className="field" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="bk-confirm">Type it again</label>
          <input id="bk-confirm" className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <button type="submit" className="btn justify-center" disabled={saving}>
          {saving ? 'Saving' : backups.passphrase_set_at ? 'Change' : 'Set'}
        </button>
      </form>
      {note ? <p className="mt-2 rounded border border-critical-line bg-critical-wash px-3 py-2 text-2xs text-critical">{note}</p> : null}

      {backups.passphrase_set_at ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-subtle px-3 py-2">
          <p className="text-2xs leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Key file.</span> Every stick copy carries it. Save it with copies that travelled by phone or to head office; it opens nothing without the passphrase.
          </p>
          <a className="btn btn-sm" href={api.getBackupKeyUrl()} download="backup.key.wrapped">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Save the key file
          </a>
        </div>
      ) : null}

      {files.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-2xs font-semibold text-ink-2">Files kept on this server ({files.length})</summary>
          <ul className="mt-1.5 divide-y divide-line-soft rounded border border-line">
            {files.slice(0, 20).map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 px-3 py-1.5 text-2xs">
                <span className="truncate font-mono text-ink-2">{f.name}</span>
                <span className="shrink-0 text-ink-3">{sizeOf(f.size)} · {formatDateTime(f.at)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-2xs text-ink-3">
            Kept in the server's data folder. To bring one back, on this computer or a replacement, use "Bring records back from a copy" under Protected export. On a replacement computer it also needs the key file below and the passphrase.
          </p>
        </details>
      ) : null}
    </div>
  );
}

/*
 * A browser's own description of itself is a paragraph of version numbers.
 * The person reading the list wants "Chrome on Windows" or "Safari on an
 * iPhone", so that is what is shown; the full string stays in the title.
 */
export function deviceLabel(ua) {
  const u = String(ua || '');
  if (!u) return null;
  if (/^curl\//i.test(u)) return 'Command line (curl)';
  if (/^node$|^node\//i.test(u) || /undici/i.test(u)) return 'Script (Node)';
  const browser = /Edg\//.test(u) ? 'Edge'
    : /OPR\//.test(u) ? 'Opera'
    : /SamsungBrowser/.test(u) ? 'Samsung Internet'
    : /Firefox\//.test(u) ? 'Firefox'
    : /Chrome\//.test(u) ? 'Chrome'
    : /Safari\//.test(u) && /Version\//.test(u) ? 'Safari'
    : 'Browser';
  const device = /iPhone/.test(u) ? 'an iPhone'
    : /iPad/.test(u) || (/Macintosh/.test(u) && /Mobile/.test(u)) ? 'an iPad'
    : /Android/.test(u) ? (/Mobile/.test(u) ? 'an Android phone' : 'an Android tablet')
    : /Windows/.test(u) ? 'Windows'
    : /Macintosh/.test(u) ? 'a Mac'
    : /CrOS/.test(u) ? 'a Chromebook'
    : /Linux/.test(u) ? 'Linux'
    : null;
  return device ? `${browser} on ${device}` : browser;
}

function sizeOf(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
