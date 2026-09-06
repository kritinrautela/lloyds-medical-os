import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Check, Cloud, CloudOff, Copy, ExternalLink, KeyRound, Link2, Loader2, RefreshCw, Unlink } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  EmptyState, Metric, MetricStrip, Panel, PanelHead, Pill, SectionTitle, Value, formatDateTime
} from '../components/ui';

/*
 * The off-site copy.
 *
 * The clinic runs entirely without internet. This page is about the optional
 * second copy: whenever a connection is available, every record and every
 * patient photograph is pushed into a Google Sheet and a Drive folder the
 * company already owns, and a summary is emailed to the administrator.
 *
 * Two honesty rules govern it. Nothing here ever claims a sync happened that
 * did not: a push that cannot reach Google is recorded as queued, not sent,
 * and the local database remains the record of truth either way. And the sync
 * key, which is what stops a stranger writing into the company's sheet, is
 * shown once when it is made and never again.
 */

const STEPS = [
  ['Make a Google Sheet', 'Sign in to the Google account that should hold the records and create an empty spreadsheet.'],
  ['Open Apps Script', 'In that sheet choose Extensions, then Apps Script.'],
  ['Paste the script', 'Copy the script below over everything in Code.gs, then save.'],
  ['Give the script the sync key', 'In Apps Script open Project Settings, add a Script Property named SYNC_KEY, and paste the key made on this page.'],
  ['Deploy it', 'Deploy, then New deployment, then Web app. Execute as Me. Who has access: Anyone.'],
  ['Paste the address back', 'Copy the web app address Google gives you into the box on this page and test it.']
];

const GOOGLE_STEPS = [
  ['Make an OAuth client', 'At console.cloud.google.com make a project, enable the Google Sheets API, Google Drive API and Gmail API, then under Credentials create an OAuth client of type Web application.'],
  ['Give it this address', 'Add http://localhost:4000/api/google/callback as an authorised redirect URI, then copy the client ID and client secret into the boxes on this page.'],
  ['Set it live', 'Under OAuth consent screen choose Internal if the company uses Google Workspace, otherwise External and press Publish. An app left in Testing loses its permission after seven days.'],
  ['Connect on the server', 'On the clinic server itself, open http://localhost:4000, come back to this page and press Connect. Sign in as the company account and allow the three permissions.']
];

const INTERVALS = [
  [5, 'Every 5 minutes'],
  [15, 'Every 15 minutes'],
  [30, 'Every 30 minutes'],
  [60, 'Every hour'],
  [240, 'Every 4 hours'],
  [1440, 'Once a day']
];

export default function CloudSync({ settings, refreshStats }) {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [account, setAccount] = useState('');
  const [auto, setAuto] = useState(false);
  const [interval, setInterval_] = useState(15);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [script, setScript] = useState('');
  const [copied, setCopied] = useState('');
  const [freshKey, setFreshKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showScript, setShowScript] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const load = useCallback(async () => {
    try {
      const res = await api.getCloudSyncStatus();
      setStatus(res);
      setUrl(res.config?.webhook_url || '');
      setAccount(res.config?.google_account_email || '');
      setAuto(!!(res.config?.sync_enabled && res.config?.auto_sync_on_wifi));
      setInterval_(res.config?.sync_interval_minutes || 15);
      setClientId(res.config?.google_client_id || '');
    } catch (err) {
      setMessage({ tone: 'critical', text: err.message || 'The backup settings could not be read.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The status refreshes itself while the page is open, so an automatic send
  // that happens in the background shows up without a reload.
  useEffect(() => {
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const config = status?.config || {};
  const g = status?.google || {};
  const hasUrl = !!(config.webhook_url && String(config.webhook_url).startsWith('http'));
  const hasKey = !!config.sync_key_set;
  const scriptReady = hasUrl && hasKey;
  const configured = g.connected || scriptReady;
  const autoRunning = configured && !!(config.sync_enabled && config.auto_sync_on_wifi);
  const onServer = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  const say = (tone, text) => setMessage({ tone, text });

  const save = async () => {
    setBusy('save'); setMessage(null);
    try {
      await api.updateCloudSyncConfig({
        webhook_url: url.trim(),
        sync_enabled: auto,
        auto_sync_on_wifi: auto,
        sync_interval_minutes: interval
      });
      if (account.trim() && account.trim() !== (config.google_account_email || '')) {
        await api.googleAuthSignIn({ email: account.trim(), signed_in_by: currentUser?.full_name || '' });
      }
      await load();
      say('ok', 'Saved. Test the connection before relying on it.');
    } catch (err) {
      say('critical', err.message || 'That could not be saved.');
    } finally { setBusy(''); }
  };

  const makeKey = async () => {
    if (hasKey && !window.confirm(
      'Making a new key stops the Google script accepting records until it is given the new key too. Continue?'
    )) return;
    setBusy('key'); setMessage(null);
    try {
      const res = await api.generateSyncKey();
      setFreshKey(res.sync_key || '');
      await load();
      say('ok', res.message || 'A new key has been made.');
    } catch (err) {
      say('critical', err.message || 'The key could not be made.');
    } finally { setBusy(''); }
  };

  const saveCredentials = async () => {
    setBusy('creds'); setMessage(null);
    try {
      const res = await api.saveGoogleCredentials(clientId.trim(), clientSecret.trim());
      setClientSecret('');
      await load();
      say('ok', res.message || 'Saved.');
    } catch (err) {
      say('critical', err.message || 'The client details could not be saved.');
    } finally { setBusy(''); }
  };

  const connectGoogle = async () => {
    setBusy('connect'); setMessage(null);
    try {
      const res = await api.startGoogleConnect();
      // Google's sign-in happens in its own tab; this page refreshes itself
      // every half minute, so the connection shows up when it is done.
      window.open(res.url, '_blank', 'noopener');
      say('ok', 'Google has opened in a new tab. Sign in as the company account and allow the permissions; this page updates itself when that is done.');
    } catch (err) {
      say('critical', err.message || 'The sign-in could not be started.');
    } finally { setBusy(''); }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm('Disconnect the Google account? The spreadsheet and folder stay in that account, but the clinic stops writing to them.')) return;
    setBusy('disconnect'); setMessage(null);
    try {
      const res = await api.disconnectGoogle();
      await load();
      say('ok', res.message || 'Disconnected.');
    } catch (err) {
      say('critical', err.message || 'The account could not be disconnected.');
    } finally { setBusy(''); }
  };

  const test = async () => {
    setBusy('test'); setMessage(null);
    try {
      const res = await api.testCloudSync(url.trim());
      say(res.success ? 'ok' : 'critical', res.message);
      await load();
    } catch (err) {
      say('critical', err.message || 'The test could not be completed.');
    } finally { setBusy(''); }
  };

  const syncNow = async () => {
    setBusy('sync'); setMessage(null);
    try {
      const res = await api.triggerCloudSync(true);
      say(res.success ? 'ok' : 'warn', res.message);
      await load();
      refreshStats?.();
    } catch (err) {
      say('critical', err.message || 'The backup could not be sent.');
    } finally { setBusy(''); }
  };

  const loadScript = async () => {
    if (script) return;
    setBusy('script');
    try {
      const res = await api.getAppsScript();
      setScript(res.script || '');
    } catch (err) {
      say('critical', err.message || 'The script could not be loaded.');
    } finally { setBusy(''); }
  };

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2500);
    } catch {
      say('warn', 'It could not be copied automatically. Select it and copy by hand.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-ink-3">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Reading the backup settings
      </div>
    );
  }

  const lastStatus = config.last_sync_status;
  const statusTone = !configured ? 'neutral'
    : lastStatus === 'Success' ? 'ok'
    : lastStatus === 'Queued Offline' ? 'warn'
    : lastStatus ? 'critical' : 'neutral';
  const photos = status?.photos || { waiting: 0, total: 0 };
  const intervalLabel = (INTERVALS.find(([m]) => m === (config.sync_interval_minutes || 15)) || [0, `Every ${config.sync_interval_minutes} minutes`])[1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle note="An optional second copy of the records and photographs, kept in the company's Google account">
          Off-site copy
        </SectionTitle>
        <div className="flex items-center gap-2">
          <Pill tone={online ? 'ok' : 'neutral'}>
            {online ? 'This computer has a connection' : 'No connection'}
          </Pill>
          {configured ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={syncNow} disabled={busy === 'sync'}>
              {busy === 'sync' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Sending</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Send a copy now</>
              )}
            </button>
          ) : null}
        </div>
      </div>

      <p className="rounded-md border border-line bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-2">
        The clinic works with no internet at all. Nothing on this page is needed for patients to be
        seen, medicine to be dispensed, or records to be kept. When a connection is available the
        server sends a copy of everything, including patient photographs, to the company's Google
        Sheet and Drive folder on its own.
      </p>

      {message ? (
        <p className={`rounded-md border px-3 py-2 text-xs ${
          message.tone === 'ok' ? 'border-ok-line bg-ok-wash text-ok'
          : message.tone === 'warn' ? 'border-warn-line bg-warn-wash text-warn'
          : 'border-critical-line bg-critical-wash text-critical'
        }`}>
          {message.text}
        </p>
      ) : null}

      <MetricStrip columns={4}>
        <Metric
          label="Last copy"
          value={configured ? (lastStatus || 'Never sent') : 'Not set up'}
          context={config.last_synced_at ? `Sent ${formatDateTime(config.last_synced_at)}${g.connected ? ' to the Google account' : ''}` : 'No copy has been sent yet'}
          tone={statusTone}
          tint="1"
          icon={configured ? Cloud : CloudOff}
        />
        <Metric
          label="Automatic sending"
          value={autoRunning ? 'On' : 'Off'}
          context={autoRunning
            ? `${intervalLabel}, only when something has changed`
            : configured ? 'Copies go only when someone presses Send' : 'Finish setting up first'}
          tone={autoRunning ? 'ok' : 'neutral'}
          tint="2"
        />
        <Metric
          label="Photographs waiting"
          value={photos.waiting}
          context={photos.total ? `${photos.total - photos.waiting} of ${photos.total} already in Drive` : 'No patient has a photograph yet'}
          tone={photos.waiting > 0 ? 'warn' : 'neutral'}
          tint="3"
          icon={Camera}
        />
        <Metric
          label="Shift reports waiting"
          value={status?.pending_sync_count || 0}
          context="Closed days not yet copied off"
          tone={(status?.pending_sync_count || 0) > 2 ? 'warn' : 'neutral'}
          tint="4"
        />
      </MetricStrip>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Panel>
            <PanelHead title="Company Google account" note="The simple way: sign in once, everything else is automatic">
              <Pill tone={g.connected ? 'ok' : g.credentials_set ? 'warn' : 'neutral'}>
                {g.connected ? 'Connected' : g.credentials_set ? 'Ready to connect' : 'Not connected'}
              </Pill>
            </PanelHead>

            {g.connected ? (
              <div className="space-y-3 px-4 py-3">
                <p className="text-xs leading-relaxed text-ink-2">
                  Connected as <span className="font-semibold text-ink">{g.email}</span>
                  {g.connected_at ? <span className="text-ink-3"> since {formatDateTime(g.connected_at)}</span> : null}.
                  The server made a spreadsheet and a photograph folder in that account and writes
                  every record and photograph into them whenever it has a connection. The daily
                  summary is emailed from the same account.
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.sheet_url ? (
                    <a href={g.sheet_url} target="_blank" rel="noreferrer" className="btn btn-sm">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open the spreadsheet
                    </a>
                  ) : null}
                  {g.folder_url ? (
                    <a href={g.folder_url} target="_blank" rel="noreferrer" className="btn btn-sm">
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Open the photograph folder
                    </a>
                  ) : null}
                  <button type="button" className="btn btn-sm text-critical" onClick={disconnectGoogle} disabled={busy === 'disconnect'}>
                    <Unlink className="h-3.5 w-3.5" aria-hidden="true" /> {busy === 'disconnect' ? 'Disconnecting' : 'Disconnect'}
                  </button>
                </div>
                <p className="text-2xs leading-relaxed text-ink-3">
                  The permission reaches only the files this system created, never the rest of the
                  company's Drive. It can be withdrawn here, or at myaccount.google.com/permissions.
                </p>
              </div>
            ) : (
              <>
                <ol className="divide-y divide-line-soft">
                  {GOOGLE_STEPS.map(([title, detail], i) => (
                    <li key={title} className="flex gap-3 px-4 py-2.5">
                      <span className="chip chip-brand h-5 w-5 shrink-0 justify-center text-2xs font-semibold">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink">{title}</p>
                        <p className="mt-0.5 break-words text-2xs leading-relaxed text-ink-3">{detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="grid gap-3 border-t border-line-soft px-4 py-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="label" htmlFor="gcid">Client ID</label>
                    <input id="gcid" className="field font-mono text-2xs" value={clientId}
                      onChange={(e) => setClientId(e.target.value)} placeholder="….apps.googleusercontent.com" autoComplete="off" />
                  </div>
                  <div className="min-w-0">
                    <label className="label" htmlFor="gsec">Client secret</label>
                    <input id="gsec" className="field font-mono text-2xs" type="password" value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder={g.credentials_set ? 'Saved. Type again only to replace it.' : 'GOCSPX-…'} autoComplete="off" />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button type="button" className="btn" onClick={saveCredentials}
                      disabled={busy === 'creds' || !clientId.trim() || (!clientSecret.trim() && !g.credentials_set)}>
                      {busy === 'creds' ? 'Saving' : 'Save the client details'}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={connectGoogle}
                      disabled={busy === 'connect' || !g.credentials_set || !onServer}
                      title={!onServer ? 'Open http://localhost:4000 on the clinic server to do this step' : undefined}>
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> {busy === 'connect' ? 'Opening Google' : 'Connect the Google account'}
                    </button>
                  </div>
                  {!onServer ? (
                    <p className="text-2xs leading-relaxed text-warn sm:col-span-2">
                      Google only sends the sign-in answer back to the clinic server itself. Do this
                      step on that computer, at http://localhost:4000. Every other computer and tablet
                      benefits once it is done.
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </Panel>

          <Panel>
            <PanelHead title="Or paste a script into a sheet" note="The manual method. Works without a Google Cloud project.">
              <button type="button" className="btn btn-sm" onClick={() => setShowScript((v) => !v)}>
                {showScript ? 'Hide' : 'Show the steps'}
              </button>
            </PanelHead>
            {showScript ? (
              <>
                <ol className="divide-y divide-line-soft">
                  {STEPS.map(([title, detail], i) => (
                    <li key={title} className="flex gap-3 px-4 py-2.5">
                      <span className="chip chip-brand h-5 w-5 shrink-0 justify-center text-2xs font-semibold">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink">{title}</p>
                        <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">{detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="border-t border-line-soft px-4 py-3">
                  {!script ? (
                    <button type="button" className="btn btn-sm" onClick={loadScript} disabled={busy === 'script'}>
                      {busy === 'script' ? 'Loading' : 'Show the script to paste'}
                    </button>
                  ) : (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Paste this into Code.gs</p>
                        <button type="button" className="btn btn-sm" onClick={() => copy('script', script)}>
                          {copied === 'script' ? (<><Check className="h-3 w-3" aria-hidden="true" /> Copied</>) : (<><Copy className="h-3 w-3" aria-hidden="true" /> Copy it</>)}
                        </button>
                      </div>
                      <pre className="max-h-72 overflow-auto rounded-md border border-line bg-subtle p-3 text-2xs leading-relaxed text-ink-2"><code>{script}</code></pre>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-4">
          {g.connected ? (
            <Panel>
              <PanelHead title="Sending">
                <Pill tone="ok">Google account</Pill>
              </PanelHead>
              <div className="space-y-3 px-4 py-3">
                <div className="rounded-md border border-line p-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-brand" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                    <span>
                      <span className="block text-xs font-semibold text-ink">Send automatically when connected</span>
                      <span className="block text-2xs leading-relaxed text-ink-3">Checks for a connection once a minute; sends only when something changed.</span>
                    </span>
                  </label>
                  <div className={`mt-2.5 ${auto ? '' : 'opacity-50'}`}>
                    <label className="label" htmlFor="interval-g">No more often than</label>
                    <select id="interval-g" className="field" value={interval} onChange={(e) => setInterval_(parseInt(e.target.value, 10))} disabled={!auto}>
                      {INTERVALS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
                    </select>
                  </div>
                </div>
                <button type="button" className="btn w-full justify-center" onClick={save} disabled={busy === 'save'}>
                  {busy === 'save' ? 'Saving' : 'Save'}
                </button>
              </div>
            </Panel>
          ) : null}

          <Panel className={g.connected ? 'opacity-60' : ''}>
            <PanelHead title="Sync key" note={g.connected ? 'Only for the paste-a-script method' : undefined}>
              <Pill tone={hasKey ? 'ok' : 'warn'}>{hasKey ? 'Made' : 'Not made'}</Pill>
            </PanelHead>
            <div className="space-y-3 px-4 py-3">
              <p className="text-xs leading-relaxed text-ink-2">
                The key is what proves to Google that a copy came from this clinic and not from a
                stranger who found the address. The same key goes into the script as a property.
              </p>

              {freshKey ? (
                <div className="rounded-md border border-warn-line bg-warn-wash p-3">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-warn">
                    Shown once. Copy it now.
                  </p>
                  <code className="mt-1.5 block break-all font-mono text-2xs leading-relaxed text-ink">
                    {freshKey}
                  </code>
                  <button type="button" className="btn btn-sm mt-2" onClick={() => copy('key', freshKey)}>
                    {copied === 'key' ? (
                      <><Check className="h-3 w-3" aria-hidden="true" /> Copied</>
                    ) : (
                      <><Copy className="h-3 w-3" aria-hidden="true" /> Copy the key</>
                    )}
                  </button>
                </div>
              ) : hasKey ? (
                <p className="text-2xs leading-relaxed text-ink-3">
                  A key is in place. It cannot be shown again; if it has been lost, make a new one
                  and give it to the script.
                </p>
              ) : null}

              <button type="button" className="btn w-full justify-center" onClick={makeKey} disabled={busy === 'key'}>
                {busy === 'key' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Making</>
                ) : (
                  <><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> {hasKey ? 'Make a new key' : 'Make the key'}</>
                )}
              </button>
            </div>
          </Panel>

          <Panel className={g.connected ? 'opacity-60' : ''}>
            <PanelHead title={g.connected ? 'Script address (not in use)' : 'Where copies are sent'}>
              <Pill tone={scriptReady ? 'ok' : 'warn'}>{scriptReady ? 'Set up' : hasUrl ? 'Key missing' : 'Not set up'}</Pill>
            </PanelHead>
            <div className="space-y-3 px-4 py-3">
              <div>
                <label className="label" htmlFor="hook">Web app address from Google</label>
                <input
                  id="hook"
                  className="field font-mono text-2xs"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label" htmlFor="acct">Google account holding the sheet</label>
                <input
                  id="acct"
                  className="field"
                  type="email"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="name@example.com"
                />
                <p className="mt-1 text-2xs leading-relaxed text-ink-3">
                  Recorded so it is clear whose account holds the records. This system never holds a
                  Google password and has no access to that account.
                </p>
              </div>

              <div className="rounded-md border border-line p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 accent-brand"
                    checked={auto}
                    onChange={(e) => setAuto(e.target.checked)}
                  />
                  <span>
                    <span className="block text-xs font-semibold text-ink">Send automatically when connected</span>
                    <span className="block text-2xs leading-relaxed text-ink-3">
                      The server checks for a connection once a minute and sends only when a record
                      or photograph has changed since the last copy.
                    </span>
                  </span>
                </label>
                <div className={`mt-2.5 ${auto ? '' : 'opacity-50'}`}>
                  <label className="label" htmlFor="interval">No more often than</label>
                  <select
                    id="interval"
                    className="field"
                    value={interval}
                    onChange={(e) => setInterval_(parseInt(e.target.value, 10))}
                    disabled={!auto}
                  >
                    {INTERVALS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
                  </select>
                </div>
              </div>

              {config.drive_folder_url ? (
                <a
                  href={config.drive_folder_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Open the photograph folder in Drive
                </a>
              ) : null}

              <div className="flex gap-2">
                <button type="button" className="btn flex-1 justify-center" onClick={save} disabled={busy === 'save'}>
                  {busy === 'save' ? 'Saving' : 'Save'}
                </button>
                <button type="button" className="btn flex-1 justify-center" onClick={test}
                  disabled={busy === 'test' || !url.trim() || !hasKey}>
                  {busy === 'test' ? 'Testing' : 'Test the connection'}
                </button>
              </div>
              {!hasKey && url.trim() ? (
                <p className="text-2xs text-ink-3">Make the sync key before testing; the script refuses a copy without it.</p>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Daily email" />
            <div className="px-4 py-3">
              {settings?.admin_email ? (
                <p className="text-xs leading-relaxed text-ink-2">
                  Once a day, when a copy is sent successfully, a summary of the day's figures is
                  emailed to <span className="font-medium text-ink">{settings.admin_email}</span> by
                  the Google script. It reports only what was actually recorded, including a drawer
                  that did not balance.
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-ink-2">
                  No address has been set, so no email is sent. Add one under Facility settings and
                  the daily summary will go out with the next successful copy.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHead title="What happened" note="Most recent first" />
        {(status?.recent_logs || []).length === 0 ? (
          <EmptyState
            title="No copy has been attempted yet"
            detail="Once a Google account is connected, or a script address saved and tested, every attempt is listed here, whether it succeeded or not."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>When</th><th>Kind</th><th>Result</th><th className="num">Records</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {status.recent_logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">{formatDateTime(log.synced_at || log.created_at)}</td>
                    <td>{log.sync_type}</td>
                    <td>
                      <Pill tone={
                        log.status === 'Success' ? 'ok'
                        : log.status === 'Queued Offline' ? 'warn'
                        : log.status === 'Refused' || log.status === 'Failed' ? 'critical' : 'neutral'
                      }>
                        {log.status}
                      </Pill>
                    </td>
                    <td className="num">{log.records_count}</td>
                    <td className="text-2xs leading-relaxed text-ink-3"><Value>{log.message}</Value></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
