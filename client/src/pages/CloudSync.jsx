import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, Camera, Check, Cloud, CloudOff, Copy, ExternalLink, KeyRound, Link2, Loader2, RefreshCw, Unlink, Usb
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ConfirmDialog, EmptyState, Metric, MetricStrip, PageSkeleton, Panel, PanelHead, Pill, SectionTitle,
  Value, ageLabel, formatDateTime
} from '../components/ui';

/*
 * Off-site copies.
 *
 * The clinic runs entirely without internet, and the records live on the
 * clinic server. This page is about the second copy that leaves the building,
 * in the order a village clinic can actually manage:
 *
 *   1. A USB stick. Plug one in; the server writes the copy on its own.
 *   2. Head office. Set up by Lloyds at installation; sends itself.
 *   3. The company Google account. One button, pressed once.
 *
 * None of the three needs a Google Cloud project, a script, or a key from
 * the person standing at the desk. The manual script method still exists for
 * Lloyds technicians and is folded away at the bottom.
 *
 * Nothing here ever claims a copy happened that did not: a send that cannot
 * reach its destination is recorded as not sent, and the local database
 * remains the record of truth either way.
 */

const STEPS = [
  ['Make a Google Sheet', 'Sign in to the Google account that should hold the records and create an empty spreadsheet.'],
  ['Open Apps Script', 'In that sheet choose Extensions, then Apps Script.'],
  ['Paste the script', 'Copy the script below over everything in Code.gs, then save.'],
  ['Give the script the sync key', 'In Apps Script open Project Settings, add a Script Property named SYNC_KEY, and paste the key made on this page.'],
  ['Deploy it', 'Deploy, then New deployment, then Web app. Execute as Me. Who has access: Anyone.'],
  ['Paste the address back', 'Copy the web app address Google gives you into the box on this page and test it.']
];

const INTERVALS = [
  [5, 'Every 5 minutes'],
  [15, 'Every 15 minutes'],
  [30, 'Every 30 minutes'],
  [60, 'Every hour'],
  [240, 'Every 4 hours'],
  [1440, 'Once a day']
];

const USB_STEPS = [
  ['Plug a stick into the clinic server', 'Any USB stick. The one in the drawer is fine.'],
  ['Wait for the green tick', 'Within a minute the copy is written. Do not pull the stick out before the tick shows.'],
  ['Take the stick to town', 'Give it to Lloyds or keep it somewhere safe away from the clinic.']
];

function sizeLabel(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CloudSync({ refreshStats }) {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);
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
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const load = useCallback(async () => {
    try {
      const res = await api.getCloudSyncStatus();
      setStatus(res);
      setUrl(res.config?.webhook_url || '');
      setAccount(res.config?.google_account_email || '');
      setAuto(!!(res.config?.sync_enabled && res.config?.auto_sync_on_wifi));
      setInterval_(res.config?.sync_interval_minutes || 15);
      setClientId(res.google?.client_source === 'saved' ? (res.config?.google_client_id || '') : '');
    } catch (err) {
      setMessage({ tone: 'critical', text: err.message || 'The off-site settings could not be read.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The page refreshes itself while it is open, so a stick plugged in at the
  // server, or a send that happens in the background, shows up on its own.
  useEffect(() => {
    const t = window.setInterval(load, 15000);
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
  const off = status?.offsite || {};
  const usb = off.usb || { sticks: [], last: null };
  const office = off.head_office || { configured: false, last: null };
  const hasUrl = !!(config.webhook_url && String(config.webhook_url).startsWith('http'));
  const hasKey = !!config.sync_key_set;
  const scriptReady = hasUrl && hasKey;
  const configured = g.connected || scriptReady;
  const autoRunning = configured && !!(config.sync_enabled && config.auto_sync_on_wifi);
  const onServer = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  const say = (tone, text) => setMessage({ tone, text });

  const usbCopy = async (volume) => {
    setBusy('usb'); setMessage(null);
    try {
      const res = await api.usbCopy(volume);
      say('ok', res.message || 'The copy is on the stick.');
      await load();
      refreshStats?.();
    } catch (err) {
      say('critical', err.message || 'The copy could not be written onto the stick.');
    } finally { setBusy(''); }
  };

  const sendHeadOffice = async () => {
    setBusy('office'); setMessage(null);
    try {
      const res = await api.sendHeadOffice();
      say(res.success ? 'ok' : 'warn', res.message || 'Sent.');
      await load();
      refreshStats?.();
    } catch (err) {
      say('warn', err.message || 'Head office could not be reached.');
      await load();
    } finally { setBusy(''); }
  };

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
      say('ok', 'Saved.');
    } catch (err) {
      say('critical', err.message || 'That could not be saved.');
    } finally { setBusy(''); }
  };

  const makeKey = () => {
    if (hasKey) { setConfirming('key'); return; }
    makeKeyNow();
  };

  const makeKeyNow = async () => {
    setConfirming(null);
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
      // Google's sign-in happens in its own tab; this page refreshes itself,
      // so the connection shows up here when it is done.
      window.open(res.url, '_blank', 'noopener');
      say('ok', 'Google has opened in a new tab. Sign in as the company account and press Allow. This page updates itself when that is done.');
    } catch (err) {
      say('critical', err.message || 'The sign-in could not be started.');
    } finally { setBusy(''); }
  };

  const disconnectGoogle = () => setConfirming('disconnect');

  const disconnectGoogleNow = async () => {
    setConfirming(null);
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
      say('critical', err.message || 'The copy could not be sent.');
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

  if (loading) return <PageSkeleton label="Reading the off-site settings" />;

  const lastStatus = config.last_sync_status;
  const googleTone = !configured ? 'neutral'
    : lastStatus === 'Success' ? 'ok'
    : lastStatus === 'Queued Offline' ? 'warn'
    : lastStatus ? 'critical' : 'neutral';
  const photos = status?.photos || { waiting: 0, total: 0 };
  const intervalLabel = (INTERVALS.find(([m]) => m === (config.sync_interval_minutes || 15)) || [0, `Every ${config.sync_interval_minutes} minutes`])[1];

  const usbLast = usb.last;
  const officeLast = office.last;
  const officeSent = !!(officeLast && officeLast.status === 'Sent');
  const sticks = usb.sticks || [];
  const allSticksDone = sticks.length > 0 && sticks.every((s) => s.has_latest);

  return (
    <div className="space-y-4">
      {confirming === 'key' ? (
        <ConfirmDialog
          title="Make a new key"
          confirmLabel="Make a new key"
          onConfirm={makeKeyNow}
          onCancel={() => setConfirming(null)}
        >
          <p>The Google script stops accepting records until it is given the new key too.</p>
          <p>Make the key, then paste it into the script before the next copy is due.</p>
        </ConfirmDialog>
      ) : null}
      {confirming === 'disconnect' ? (
        <ConfirmDialog
          title="Disconnect the Google account"
          confirmLabel="Disconnect"
          danger
          onConfirm={disconnectGoogleNow}
          onCancel={() => setConfirming(null)}
        >
          <p>The spreadsheet and folder stay in that account, but the clinic stops writing to them.</p>
        </ConfirmDialog>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle note="Three ways a copy of the records leaves the building. None of them is needed for the clinic to run.">
          Off-site copies
        </SectionTitle>
        <div className="flex items-center gap-2">
          <Pill tone={online ? 'ok' : 'neutral'}>
            {online ? 'This computer has internet' : 'No internet'}
          </Pill>
          {configured ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={syncNow} disabled={busy === 'sync'}>
              {busy === 'sync' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Sending</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Send to Google now</>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p role="status" className={`rounded-md border px-3 py-2 text-xs ${
          message.tone === 'ok' ? 'border-ok-line bg-ok-wash text-ok'
          : message.tone === 'warn' ? 'border-warn-line bg-warn-wash text-warn'
          : 'border-critical-line bg-critical-wash text-critical'
        }`}>
          {message.text}
        </p>
      ) : null}

      <MetricStrip columns={4}>
        <Metric
          label="USB stick"
          value={usbLast ? ageLabel(usbLast.at) : sticks.length ? 'Copying' : 'No copy yet'}
          context={usbLast
            ? `${usbLast.label}, ${formatDateTime(usbLast.at)}`
            : sticks.length ? 'A stick is plugged in; the copy is on its way' : 'Plug a stick into the clinic server'}
          tone={usbLast ? 'ok' : 'neutral'}
          tint="1"
          icon={Usb}
        />
        <Metric
          label="Head office"
          value={!office.configured ? 'Not set up' : officeSent ? ageLabel(officeLast.at) : officeLast ? 'Not sent' : 'Waiting'}
          context={!office.configured
            ? 'Lloyds switches this on at installation'
            : officeSent ? `Accepted by ${office.host}, ${formatDateTime(officeLast.at)}`
            : officeLast ? officeLast.message : 'Sends itself when there is internet'}
          tone={!office.configured ? 'neutral' : officeSent ? 'ok' : officeLast ? 'warn' : 'neutral'}
          tint="2"
          icon={Building2}
        />
        <Metric
          label="Google account"
          value={g.connected ? (lastStatus === 'Success' ? 'Up to date' : lastStatus || 'Connected') : g.client_source ? 'Ready' : 'Not set up'}
          context={g.connected
            ? config.last_synced_at ? `Sent ${formatDateTime(config.last_synced_at)}` : 'No copy sent yet'
            : g.client_source ? 'Press the button below once' : 'Lloyds adds this at installation'}
          tone={g.connected ? googleTone : 'neutral'}
          tint="3"
          icon={g.connected ? Cloud : CloudOff}
        />
        <Metric
          label="Photographs waiting"
          value={photos.waiting}
          context={photos.total ? `${photos.total - photos.waiting} of ${photos.total} already in Google Drive` : 'No patient has a photograph yet'}
          tone={photos.waiting > 0 && g.connected ? 'warn' : 'neutral'}
          tint="4"
          icon={Camera}
        />
      </MetricStrip>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Panel>
            <PanelHead title="USB stick" note="The simplest copy. No internet needed.">
              <Pill tone={sticks.length === 0 ? 'neutral' : allSticksDone ? 'ok' : 'info'}>
                {sticks.length === 0 ? 'No stick plugged in' : allSticksDone ? 'Copy is on the stick' : 'Copying'}
              </Pill>
            </PanelHead>

            <ol className="grid divide-y divide-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {USB_STEPS.map(([title, detail], i) => (
                <li key={title} className="flex gap-3 px-4 py-3">
                  <span className="chip chip-brand h-6 w-6 shrink-0 justify-center text-xs font-semibold">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="space-y-3 border-t border-line-soft px-4 py-3">
              {sticks.length === 0 ? (
                <p className="text-xs leading-relaxed text-ink-2">
                  No stick is plugged into the clinic server right now. As soon as one is, the copy is
                  written on its own and a green tick shows here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sticks.map((s) => (
                    <li key={s.path} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${s.has_latest ? 'bg-ok-wash text-ok' : 'bg-info-wash text-info'}`}>
                          {s.has_latest ? <Check className="h-4 w-4" aria-hidden="true" /> : <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{s.label}</p>
                          <p className="text-2xs text-ink-3">
                            {s.has_latest ? 'The latest copy is on this stick. It can be taken out.' : 'Copying now. Leave it in for a minute.'}
                          </p>
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => usbCopy(s.path)} disabled={busy === 'usb'}>
                        {busy === 'usb' ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Copying</>
                        ) : (
                          <><Usb className="h-3.5 w-3.5" aria-hidden="true" /> {s.has_latest ? 'Copy again' : 'Copy now'}</>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {usbLast ? (
                <p className="text-xs leading-relaxed text-ink-2">
                  Last copy: <span className="font-semibold text-ink">{formatDateTime(usbLast.at)}</span> onto
                  the stick <span className="font-semibold text-ink">{usbLast.label}</span>
                  {usbLast.size ? <span className="text-ink-3"> ({sizeLabel(usbLast.size)})</span> : null}.
                </p>
              ) : null}

              <p className="text-2xs leading-relaxed text-ink-3">
                Only the locked copy goes onto the stick, in a folder called "Lloyds Medical OS backups".
                Nothing else on the stick is touched. Nobody can open the copy without the backup
                passphrase set under Facility settings, so a lost stick gives nothing away.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Company Google account" note="Press once. After that it looks after itself.">
              <Pill tone={g.connected ? 'ok' : g.client_source ? 'info' : 'neutral'}>
                {g.connected ? 'Connected' : g.client_source ? 'Ready to connect' : 'Not set up'}
              </Pill>
            </PanelHead>

            {g.connected ? (
              <div className="space-y-3 px-4 py-3">
                <p className="text-xs leading-relaxed text-ink-2">
                  Connected as <span className="font-semibold text-ink">{g.email}</span>
                  {g.connected_at ? <span className="text-ink-3"> since {formatDateTime(g.connected_at)}</span> : null}.
                  The server made a spreadsheet and a photograph folder in that account and writes
                  every record and photograph into them whenever it has internet.
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
            ) : g.client_source ? (
              <div className="space-y-3 px-4 py-3">
                <p className="text-xs leading-relaxed text-ink-2">
                  Sign in once as the company Google account and press Allow. The server then makes a
                  spreadsheet and a photograph folder in that account and keeps them up to date on its
                  own whenever there is internet.
                </p>
                <button type="button" className="btn btn-primary" onClick={connectGoogle}
                  disabled={busy === 'connect' || !onServer}
                  title={!onServer ? 'Do this on the clinic server itself' : undefined}>
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> {busy === 'connect' ? 'Opening Google' : 'Connect the company Google account'}
                </button>
                {!onServer ? (
                  <p className="text-2xs leading-relaxed text-warn">
                    Google only answers the clinic server itself. Sit at that computer, open
                    http://localhost:4000, come to this page and press the button there. Every other
                    computer and tablet benefits once it is done.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 px-4 py-3">
                <p className="text-xs leading-relaxed text-ink-2">
                  Not set up on this server. Lloyds adds the company Google connection at
                  installation; nothing is needed from the clinic. The USB stick works without it.
                </p>
                <details className="group rounded-md border border-line">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-ink-2">
                    For Lloyds technicians: use your own Google client
                  </summary>
                  <div className="grid gap-3 border-t border-line-soft px-3 py-3 sm:grid-cols-2">
                    <p className="text-2xs leading-relaxed text-ink-3 sm:col-span-2">
                      The better place for the client is server/config/install.json, which needs no
                      typing here. Saving one on this page works too: an OAuth client of type Web
                      application with http://localhost:4000/api/google/callback as its redirect URI,
                      from a project with the Sheets and Drive APIs enabled and its consent screen
                      published.
                    </p>
                    <div className="min-w-0">
                      <label className="label" htmlFor="gcid">Client ID</label>
                      <input id="gcid" className="field font-mono text-2xs" value={clientId}
                        onChange={(e) => setClientId(e.target.value)} placeholder="….apps.googleusercontent.com" autoComplete="off" />
                    </div>
                    <div className="min-w-0">
                      <label className="label" htmlFor="gsec">Client secret</label>
                      <input id="gsec" className="field font-mono text-2xs" type="password" value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)} placeholder="GOCSPX-…" autoComplete="off" />
                    </div>
                    <div className="sm:col-span-2">
                      <button type="button" className="btn" onClick={saveCredentials}
                        disabled={busy === 'creds' || !clientId.trim() || !clientSecret.trim()}>
                        {busy === 'creds' ? 'Saving' : 'Save the client details'}
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHead title="Head office" note="Sends itself when there is internet">
              <Pill tone={!office.configured ? 'neutral' : officeSent ? 'ok' : officeLast ? 'warn' : 'info'}>
                {!office.configured ? 'Not set up' : officeSent ? 'Sent' : officeLast ? 'Not sent' : 'Waiting'}
              </Pill>
            </PanelHead>
            <div className="space-y-3 px-4 py-3">
              {office.configured ? (
                <>
                  <p className="text-xs leading-relaxed text-ink-2">
                    Copies go to <span className="font-semibold text-ink">{office.host}</span> for
                    clinic <span className="font-semibold text-ink">{office.clinic_id}</span>. Every
                    night's copy is sent as soon as the server has internet, and tried again every
                    half hour until it gets through.
                  </p>
                  {officeLast ? (
                    <p className="text-2xs leading-relaxed text-ink-3">
                      {officeLast.status} {formatDateTime(officeLast.at)}. {officeLast.message}
                    </p>
                  ) : (
                    <p className="text-2xs leading-relaxed text-ink-3">
                      Nothing sent yet. The first attempt is a few minutes after the server starts.
                    </p>
                  )}
                  <button type="button" className="btn w-full justify-center" onClick={sendHeadOffice} disabled={busy === 'office'}>
                    {busy === 'office' ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Sending</>
                    ) : (
                      <><Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Send to head office now</>
                    )}
                  </button>
                </>
              ) : (
                <p className="text-xs leading-relaxed text-ink-2">
                  Not set up on this server. Lloyds switches this on at installation, after which
                  the copy goes to head office by itself. The clinic does not need to do anything.
                </p>
              )}
            </div>
          </Panel>

          {g.connected ? (
            <Panel>
              <PanelHead title="Sending to Google">
                <Pill tone={autoRunning ? 'ok' : 'neutral'}>{autoRunning ? 'Automatic' : 'By hand only'}</Pill>
              </PanelHead>
              <div className="space-y-3 px-4 py-3">
                <div className="rounded-md border border-line p-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-brand" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                    <span>
                      <span className="block text-xs font-semibold text-ink">Send automatically when there is internet</span>
                      <span className="block text-2xs leading-relaxed text-ink-3">Checks once a minute; sends only when something changed. {autoRunning ? intervalLabel : ''}</span>
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

          <Panel>
            <PanelHead title="What is in a copy" />
            <div className="px-4 py-3">
              <p className="text-xs leading-relaxed text-ink-2">
                The USB and head office copies are the whole database: every patient, visit,
                dispensation, register entry and setting, as one locked file. The Google copy is the
                same records laid out in a spreadsheet, with photographs in a folder beside it.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <details className="panel group">
        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-ink-2">
          For Lloyds technicians: paste a script into a Google Sheet instead
          <span className="ml-2 font-normal text-ink-3">{scriptReady ? 'In use' : 'Not in use'}</span>
        </summary>
        <div className="grid gap-4 border-t border-line-soft p-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-3 lg:col-span-2">
            <ol className="divide-y divide-line-soft rounded-md border border-line">
              {STEPS.map(([title, detail], i) => (
                <li key={title} className="flex gap-3 px-3 py-2.5">
                  <span className="chip chip-brand h-5 w-5 shrink-0 justify-center text-2xs font-semibold">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
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

          <div className="space-y-3">
            <div className="rounded-md border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink">Sync key</p>
                <Pill tone={hasKey ? 'ok' : 'neutral'}>{hasKey ? 'Made' : 'Not made'}</Pill>
              </div>
              {freshKey ? (
                <div className="mb-2 rounded-md border border-warn-line bg-warn-wash p-2.5">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-warn">Shown once. Copy it now.</p>
                  <code className="mt-1 block break-all font-mono text-2xs leading-relaxed text-ink">{freshKey}</code>
                  <button type="button" className="btn btn-sm mt-2" onClick={() => copy('key', freshKey)}>
                    {copied === 'key' ? (<><Check className="h-3 w-3" aria-hidden="true" /> Copied</>) : (<><Copy className="h-3 w-3" aria-hidden="true" /> Copy the key</>)}
                  </button>
                </div>
              ) : hasKey ? (
                <p className="mb-2 text-2xs leading-relaxed text-ink-3">A key is in place. It cannot be shown again; if it is lost, make a new one and give it to the script.</p>
              ) : (
                <p className="mb-2 text-2xs leading-relaxed text-ink-3">The key proves a copy came from this clinic. The same key goes into the script as a property.</p>
              )}
              <button type="button" className="btn btn-sm w-full justify-center" onClick={makeKey} disabled={busy === 'key'}>
                {busy === 'key' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Making</>
                ) : (
                  <><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> {hasKey ? 'Make a new key' : 'Make the key'}</>
                )}
              </button>
            </div>

            <div className="space-y-2.5 rounded-md border border-line p-3">
              <div>
                <label className="label" htmlFor="hook">Web app address from Google</label>
                <input id="hook" className="field font-mono text-2xs" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec" autoComplete="off" />
              </div>
              <div>
                <label className="label" htmlFor="acct">Google account holding the sheet</label>
                <input id="acct" className="field" type="email" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="name@example.com" />
              </div>
              {!g.connected ? (
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-brand" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                  <span className="text-xs text-ink">Send automatically when there is internet</span>
                </label>
              ) : null}
              <div className="flex gap-2">
                <button type="button" className="btn btn-sm flex-1 justify-center" onClick={save} disabled={busy === 'save'}>
                  {busy === 'save' ? 'Saving' : 'Save'}
                </button>
                <button type="button" className="btn btn-sm flex-1 justify-center" onClick={test} disabled={busy === 'test' || !url.trim() || !hasKey}>
                  {busy === 'test' ? 'Testing' : 'Test'}
                </button>
              </div>
              {!hasKey && url.trim() ? (
                <p className="text-2xs text-ink-3">Make the sync key before testing; the script refuses a copy without it.</p>
              ) : null}
            </div>
          </div>
        </div>
      </details>

      <Panel>
        <PanelHead title="What happened" note="Most recent first" />
        {(status?.recent_logs || []).length === 0 ? (
          <EmptyState
            title="No copy has been made yet"
            detail="Every copy onto a stick, to head office or to Google is listed here, whether it worked or not."
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
