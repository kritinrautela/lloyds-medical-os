import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Camera, Check, Cloud, CloudOff, Copy, ExternalLink, KeyRound, Link2, Loader2, RefreshCw,
  ShieldCheck, Smartphone, Unlink, Usb
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ConfirmDialog, EmptyState, PageSkeleton, Panel, PanelHead, Pill, SectionTitle, Value, ageLabel, formatDateTime
} from '../components/ui';

/*
 * Off-site copies.
 *
 * The clinic runs entirely without internet, and the records live on the
 * clinic server. This page is about the second copy that leaves the building,
 * in the order a village clinic can actually manage:
 *
 *   A USB stick.      Plug one in; the server writes the copy on its own.
 *   A phone.          Press one button; WhatsApp carries it to town.
 *   Head office.      Set up by Lloyds at installation; sends itself.
 *   The company Google account.  One button, pressed once.
 *
 * None of the four needs a Google Cloud project, a script, or a key from the
 * person standing at the desk. The manual script method still exists for
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

const PHONE_STEPS = [
  ['Open this page on your phone', 'On the clinic Wi-Fi, the same way you open the system every day.'],
  ['Press Send the copy', 'Choose WhatsApp and send it to Lloyds.'],
  ['Carry on with your day', 'WhatsApp waits for signal and sends it when you reach town.']
];

const LOG_ROWS = 8;

function sizeLabel(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Whether this device can hand a file to another app. True on a phone or
// tablet; false on the clinic desktop, where the button saves the file instead.
function canShareFiles() {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] });
  } catch (err) {
    return false;
  }
}

function Steps({ steps, size = 'md' }) {
  const big = size === 'lg';
  return (
    <ol className="grid divide-y divide-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {steps.map(([title, detail], i) => (
        <li key={title} className="flex gap-3 px-4 py-3">
          <span className={`chip chip-brand shrink-0 justify-center font-semibold ${big ? 'h-7 w-7 text-sm' : 'h-6 w-6 text-xs'}`}>{i + 1}</span>
          <div className="min-w-0">
            <p className={`font-semibold text-ink ${big ? 'text-sm' : 'text-xs'}`}>{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RouteHead({ icon: Icon, tint, title, note, children }) {
  return (
    <header className="flex flex-wrap items-start gap-3 border-b border-line-soft px-4 py-3">
      <span className={`chip chip-${tint} h-9 w-9`} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <h2 className="panel-title">{title}</h2>
        <p className="panel-note mt-0.5">{note}</p>
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </header>
  );
}

function Tick({ done, replayKey }) {
  return (
    <span
      key={replayKey}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
        done ? 'tick-in bg-ok-wash text-ok ring-1 ring-ok-line' : 'bg-info-wash text-info'
      }`}
      aria-hidden="true"
    >
      {done ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <Loader2 className="h-5 w-5 animate-spin" />}
    </span>
  );
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
  const [allLogs, setAllLogs] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const phoneShare = useMemo(canShareFiles, []);
  // A touch screen is a phone or tablet in this clinic; the desk computer is not.
  const handheld = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches, []);

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
  const phoneTo = off.phone?.to || '';
  const hasUrl = !!(config.webhook_url && String(config.webhook_url).startsWith('http'));
  const hasKey = !!config.sync_key_set;
  const scriptReady = hasUrl && hasKey;
  const configured = g.connected || scriptReady;
  const autoRunning = configured && !!(config.sync_enabled && config.auto_sync_on_wifi);
  const onServer = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  const say = (tone, text) => setMessage({ tone, text });

  const saveBlob = (blob, name) => {
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10000);
  };

  const sendFromPhone = async () => {
    setBusy('phone'); setMessage(null);
    try {
      const { blob, name } = await api.fetchLatestBackup();
      if (phoneShare) {
        let file = new File([blob], name, { type: 'application/octet-stream' });
        // Android only hands over files of a few familiar kinds, so the same
        // bytes go out under a .txt name there. The restore reads them as they are.
        if (!navigator.canShare({ files: [file] })) {
          file = new File([blob], `${name}.txt`, { type: 'text/plain' });
        }
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Clinic records copy',
              text: `Locked copy of the clinic records, ${name}. Please keep it safe.`
            });
            say('ok', 'Handed to the app you chose. If WhatsApp shows a clock next to it, it will send as soon as there is signal.');
            await load();
            return;
          } catch (err) {
            if (err && err.name === 'AbortError') {
              say('warn', 'Nothing was sent. Press the button again and choose WhatsApp.');
              return;
            }
            // Any other refusal falls through to a plain save.
          }
        }
      }
      saveBlob(blob, name);
      say('ok', `Saved ${name} to this device. Attach it to a WhatsApp or email message to Lloyds${phoneTo ? ` on ${phoneTo}` : ''}.`);
      await load();
    } catch (err) {
      say('critical', err.message || 'The copy could not be fetched.');
    } finally { setBusy(''); }
  };

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
  const usbLast = usb.last;
  const officeLast = office.last;
  const officeSent = !!(officeLast && officeLast.status === 'Sent');
  const sticks = usb.sticks || [];
  const allSticksDone = sticks.length > 0 && sticks.every((s) => s.has_latest);
  const intervalLabel = (INTERVALS.find(([m]) => m === (config.sync_interval_minutes || 15)) || [0, `Every ${config.sync_interval_minutes} minutes`])[1];

  // The most recent copy that actually left the building, whichever way it went.
  const copies = [
    usbLast ? { at: usbLast.at, how: `on the stick ${usbLast.label}` } : null,
    officeSent ? { at: officeLast.at, how: `to head office at ${office.host}` } : null,
    g.connected && lastStatus === 'Success' && config.last_synced_at ? { at: config.last_synced_at, how: `to the Google account ${g.email}` } : null
  ].filter(Boolean).sort((a, b) => new Date(b.at) - new Date(a.at));
  const latest = copies[0];
  const latestHours = latest ? (Date.now() - new Date(latest.at).getTime()) / 36e5 : null;
  const bandTone = !latest ? 'neutral' : latestHours < 48 ? 'ok' : 'warn';

  const logs = status?.recent_logs || [];
  const shownLogs = allLogs ? logs : logs.slice(0, LOG_ROWS);

  const usbCard = (
    <Panel key="usb">
      <RouteHead icon={Usb} tint="1" title="USB stick" note="The simplest copy. No internet needed.">
        <Pill tone={sticks.length === 0 ? 'neutral' : allSticksDone ? 'ok' : 'info'}>
          {sticks.length === 0 ? 'No stick plugged in' : allSticksDone ? 'Copy is on the stick' : 'Copying'}
        </Pill>
      </RouteHead>
      <Steps steps={USB_STEPS} />
      <div className="space-y-3 border-t border-line-soft px-4 py-3">
        {sticks.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-line-strong px-3 py-3">
            <span className="chip chip-1 h-9 w-9" aria-hidden="true"><Usb className="h-4 w-4" /></span>
            <p className="text-xs leading-relaxed text-ink-2">
              No stick is plugged into the clinic server right now. As soon as one is, the copy is
              written on its own and a green tick shows here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sticks.map((s) => (
              <li key={s.path} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-subtle px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Tick done={s.has_latest} replayKey={usbLast ? usbLast.file : 'none'} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{s.label}</p>
                    <p className="text-xs text-ink-3">
                      {s.has_latest ? 'The latest copy is on this stick. It can be taken out.' : 'Copying now. Leave it in for a minute.'}
                    </p>
                  </div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => usbCopy(s.path)} disabled={busy === 'usb'}>
                  {busy === 'usb' ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Copying</>
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {s.has_latest ? 'Copy again' : 'Copy now'}</>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs leading-relaxed text-ink-3">
          {usbLast ? (
            <>Last copy <span className="font-medium text-ink-2">{formatDateTime(usbLast.at)}</span> onto <span className="font-medium text-ink-2">{usbLast.label}</span>{usbLast.size ? ` (${sizeLabel(usbLast.size)})` : ''}. </>
          ) : null}
          Only the locked copy goes onto the stick, in its own folder. Nothing else on the stick is touched, and a lost stick gives nothing away.
        </p>
      </div>
    </Panel>
  );

  const phoneCard = (
    <Panel key="phone">
      <RouteHead icon={Smartphone} tint="2" title="Your phone" note="WhatsApp carries it to town for you.">
        <Pill tone={phoneShare ? 'info' : 'neutral'}>{handheld && phoneShare ? 'Ready on this phone' : phoneShare ? 'Works from here too' : 'Use a phone'}</Pill>
      </RouteHead>
      <Steps steps={PHONE_STEPS} />
      <div className="space-y-3 border-t border-line-soft px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            className="btn btn-primary h-11 w-full justify-center px-5 text-sm sm:w-auto sm:flex-none"
            onClick={sendFromPhone}
            disabled={busy === 'phone'}
          >
            {busy === 'phone' ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Getting the copy</>
            ) : (
              <><Smartphone className="h-4 w-4" aria-hidden="true" /> {phoneShare ? 'Send the copy' : 'Save the copy'}</>
            )}
          </button>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-2">
            {phoneTo ? (
              <>Send it to Lloyds on WhatsApp: <span className="whitespace-nowrap font-semibold text-ink">{phoneTo}</span>.</>
            ) : (
              <>Send it to the Lloyds WhatsApp number.</>
            )}
            {' '}The file is locked; it gives nothing away on the way.
          </p>
        </div>
        {!phoneShare ? (
          <p className="text-xs leading-relaxed text-ink-3">
            This computer has no share sheet, so the button saves the file instead. Attach it to an
            email or a WhatsApp Web message to Lloyds, or open this page on a phone for the one-press version.
          </p>
        ) : null}
      </div>
    </Panel>
  );

  const officeCard = (
    <Panel key="office">
      <RouteHead icon={Building2} tint="3" title="Head office" note="Sends itself whenever there is internet.">
        <Pill tone={!office.configured ? 'neutral' : officeSent ? 'ok' : officeLast ? 'warn' : 'info'}>
          {!office.configured ? 'Not set up' : officeSent ? 'Sent' : officeLast ? 'Not sent' : 'Waiting'}
        </Pill>
      </RouteHead>
      <div className="space-y-3 px-4 py-3">
        {office.configured ? (
          <>
            <div className="flex items-center gap-3">
              <Tick done={officeSent} replayKey={officeLast ? officeLast.at : 'none'} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {officeSent ? `Accepted ${ageLabel(officeLast.at)}` : officeLast ? 'The last send did not get through' : 'Waiting for the first send'}
                </p>
                <p className="text-xs text-ink-3">
                  {officeLast ? `${formatDateTime(officeLast.at)}. ${officeLast.message}` : 'The first attempt is a few minutes after the server starts.'}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-ink-3">
              Copies go to <span className="font-medium text-ink-2">{office.host}</span> for clinic{' '}
              <span className="font-medium text-ink-2">{office.clinic_id}</span>. Every night's copy is sent as soon as the
              server has internet, and tried again every half hour until it gets through.
            </p>
            <button type="button" className="btn" onClick={sendHeadOffice} disabled={busy === 'office'}>
              {busy === 'office' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Sending</>
              ) : (
                <><Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Send to head office now</>
              )}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-line-strong px-3 py-3">
            <span className="chip chip-3 h-9 w-9" aria-hidden="true"><Building2 className="h-4 w-4" /></span>
            <p className="text-xs leading-relaxed text-ink-2">
              Not set up on this server. Lloyds switches this on at installation, after which the copy
              goes to head office by itself. The clinic does not need to do anything.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );

  const googleCard = (
    <Panel key="google">
      <RouteHead icon={g.connected ? Cloud : CloudOff} tint="4" title="Company Google account" note="Press once. After that it looks after itself.">
        <Pill tone={g.connected ? 'ok' : g.client_source ? 'info' : 'neutral'}>
          {g.connected ? 'Connected' : g.client_source ? 'Ready to connect' : 'Not set up'}
        </Pill>
      </RouteHead>

      {g.connected ? (
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Tick done={lastStatus === 'Success'} replayKey={config.last_synced_at || 'none'} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {lastStatus === 'Success' && config.last_synced_at ? `Up to date, sent ${ageLabel(config.last_synced_at)}` : lastStatus || 'Connected'}
              </p>
              <p className="truncate text-xs text-ink-3">
                {g.email}{g.connected_at ? `, connected ${formatDateTime(g.connected_at)}` : ''}
              </p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-ink-3">
            The server made a spreadsheet and a photograph folder in that account and writes every
            record and photograph into them whenever it has internet.
            {status?.photos?.waiting ? ` ${status.photos.waiting} photograph${status.photos.waiting === 1 ? '' : 's'} waiting to go.` : ''}
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
          <div className="rounded-md border border-line p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-brand" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              <span>
                <span className="block text-xs font-semibold text-ink">Send automatically when there is internet</span>
                <span className="block text-2xs leading-relaxed text-ink-3">Checks once a minute; sends only when something changed.{autoRunning ? ` ${intervalLabel}.` : ''}</span>
              </span>
            </label>
            <div className={`mt-2.5 flex flex-wrap items-end gap-2 ${auto ? '' : 'opacity-50'}`}>
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor="interval-g">No more often than</label>
                <select id="interval-g" className="field" value={interval} onChange={(e) => setInterval_(parseInt(e.target.value, 10))} disabled={!auto}>
                  {INTERVALS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
                </select>
              </div>
              <button type="button" className="btn" onClick={save} disabled={busy === 'save'}>
                {busy === 'save' ? 'Saving' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : g.client_source ? (
        <div className="space-y-3 px-4 py-3">
          <p className="text-xs leading-relaxed text-ink-2">
            Sign in once as the company Google account and press Allow. The server then makes a
            spreadsheet and a photograph folder in that account and keeps them up to date on its own
            whenever there is internet.
          </p>
          <button type="button" className="btn btn-primary" onClick={connectGoogle}
            disabled={busy === 'connect' || !onServer}
            title={!onServer ? 'Do this on the clinic server itself' : undefined}>
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> {busy === 'connect' ? 'Opening Google' : 'Connect the company Google account'}
          </button>
          {!onServer ? (
            <p className="text-xs leading-relaxed text-warn">
              Google only answers the clinic server itself. Sit at that computer, open
              http://localhost:4000, come to this page and press the button there. Every other
              computer and tablet benefits once it is done.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-3 rounded-md border border-dashed border-line-strong px-3 py-3">
            <span className="chip chip-4 h-9 w-9" aria-hidden="true"><CloudOff className="h-4 w-4" /></span>
            <p className="text-xs leading-relaxed text-ink-2">
              Not set up on this server. Lloyds adds the company Google connection at installation;
              nothing is needed from the clinic. The stick and the phone work without it.
            </p>
          </div>
          <details className="group rounded-md border border-line">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-ink-2">
              For Lloyds technicians: use your own Google client
            </summary>
            <div className="grid gap-3 border-t border-line-soft px-3 py-3 sm:grid-cols-2">
              <p className="text-2xs leading-relaxed text-ink-3 sm:col-span-2">
                The better place for the client is server/config/install.json, which needs no typing
                here. Saving one on this page works too: an OAuth client of type Web application with
                http://localhost:4000/api/google/callback as its redirect URI, from a project with the
                Sheets and Drive APIs enabled and its consent screen published.
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
  );

  // On a phone the phone route comes first; at the desk the stick does.
  const cards = handheld ? [phoneCard, usbCard, officeCard, googleCard] : [usbCard, phoneCard, officeCard, googleCard];

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
        <SectionTitle note="Four ways a copy of the records leaves the building. None of them is needed for the clinic to run.">
          Off-site copies
        </SectionTitle>
        <div className="flex items-center gap-2">
          <Pill tone={online ? 'ok' : 'neutral'}>
            {online ? 'This computer has internet' : 'No internet'}
          </Pill>
          {configured ? (
            <button type="button" className="btn btn-sm" onClick={syncNow} disabled={busy === 'sync'}>
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

      <Panel>
        <div className="flex flex-wrap items-center gap-4 px-4 py-4">
          <span className={`chip chip-${bandTone === 'neutral' ? 'brand' : bandTone} h-12 w-12 rounded-xl`} aria-hidden="true">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-balance text-lg font-semibold leading-tight text-ink">
              {latest ? (
                <>A copy left the building <span className={bandTone === 'ok' ? 'text-ok' : 'text-warn'}>{ageLabel(latest.at)}</span></>
              ) : (
                <>No copy has left the building yet</>
              )}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              {latest
                ? `${formatDateTime(latest.at)}, ${latest.how}. ${latestHours >= 48 ? 'That is more than two days ago; plug in a stick or send it from a phone today.' : 'The records on this computer are safe if anything happens to it.'}`
                : 'Plug a stick into the clinic server, or press Send the copy on a phone. Either takes a minute.'}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:flex sm:flex-wrap sm:gap-x-5">
            {[
              ['Stick', usbLast ? ageLabel(usbLast.at) : 'never', !!usbLast],
              ['Head office', !office.configured ? 'not set up' : officeSent ? ageLabel(officeLast.at) : 'not yet', officeSent],
              ['Google', !g.connected ? 'not set up' : lastStatus === 'Success' && config.last_synced_at ? ageLabel(config.last_synced_at) : 'not yet', g.connected && lastStatus === 'Success']
            ].map(([label, value, good]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dt className="text-ink-3">{label}</dt>
                <dd className={`font-semibold ${good ? 'text-ok' : 'text-ink-2'}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {cards}
      </div>

      <p className="px-1 text-xs leading-relaxed text-ink-3">
        Every copy is the whole database as one locked file: every patient, visit, dispensation,
        register entry and setting. Nobody can open it without the backup passphrase set under
        Facility settings. The Google copy is the same records laid out in a spreadsheet, with
        photographs in a folder beside it.
      </p>

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
        <PanelHead title="What happened" note="Most recent first">
          {logs.length > LOG_ROWS ? (
            <button type="button" className="btn btn-sm" onClick={() => setAllLogs((v) => !v)}>
              {allLogs ? `Show the last ${LOG_ROWS}` : `Show all ${logs.length}`}
            </button>
          ) : null}
        </PanelHead>
        {logs.length === 0 ? (
          <EmptyState
            title="No copy has been made yet"
            detail="Every copy onto a stick, to a phone, to head office or to Google is listed here, whether it worked or not."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table md:min-w-[760px]">
              <thead>
                <tr><th>When</th><th>Kind</th><th>Result</th><th className="num hidden md:table-cell">Records</th><th className="hidden md:table-cell">Detail</th></tr>
              </thead>
              <tbody>
                {shownLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">{formatDateTime(log.synced_at || log.created_at)}</td>
                    <td className="whitespace-nowrap">{log.sync_type}</td>
                    <td>
                      <Pill tone={
                        log.status === 'Success' ? 'ok'
                        : log.status === 'Queued Offline' ? 'warn'
                        : log.status === 'Refused' || log.status === 'Failed' ? 'critical' : 'neutral'
                      }>
                        {log.status}
                      </Pill>
                    </td>
                    <td className="num hidden md:table-cell">{log.records_count}</td>
                    <td className="hidden text-2xs leading-relaxed text-ink-3 md:table-cell"><Value>{log.message}</Value></td>
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
