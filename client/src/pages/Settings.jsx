import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, Lock } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Panel, PanelHead, Pill, SectionTitle } from '../components/ui';

/*
 * Facility settings.
 *
 * Everything the clinic can change about itself lives here, and nothing that
 * belongs to a patient does. Two controls on this page are different in kind
 * from the rest and are treated that way: the export password, which is the
 * only lock on records leaving the building, and the go-live reset, which
 * deletes every clinical record on the machine.
 */

const FIELDS = [
  { key: 'name', label: 'Facility name', width: 'full' },
  { key: 'tagline', label: 'What it is called underneath', width: 'full' },
  { key: 'address', label: 'Address', width: 'full' },
  { key: 'district', label: 'District' },
  { key: 'province', label: 'Province' },
  { key: 'country', label: 'Country' },
  { key: 'phone', label: 'Telephone' },
  { key: 'email', label: 'Email' },
  { key: 'reg_number', label: 'Registration number' },
  { key: 'doctor_in_charge', label: 'Doctor in charge' },
  { key: 'currency_symbol', label: 'Currency symbol' },
  { key: 'currency_code', label: 'Currency code' },
  { key: 'receipt_footer', label: 'Line printed at the foot of every receipt', width: 'full' }
];

export default function Settings({ settings, refreshStats }) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Administrator';

  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!settings) return;
    const next = {};
    FIELDS.forEach((f) => { next[f.key] = settings[f.key] ?? ''; });
    next.default_consultation_fee = settings.default_consultation_fee ?? 0;
    next.admin_email = settings.admin_email ?? '';
    setForm(next);
  }, [settings]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const say = (tone, text) => setMessage({ tone, text });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.updateSettings({
        ...form,
        default_consultation_fee: Number(form.default_consultation_fee) || 0,
        changed_by: currentUser?.full_name || ''
      });
      await refreshStats?.();
      say('ok', 'Saved.');
    } catch (err) {
      say('critical', err.message || 'The settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const currency = settings?.currency_symbol || 'K';

  return (
    <div className="space-y-4">
      <SectionTitle note="What this clinic is called, what it charges, and how its records are locked">
        Facility settings
      </SectionTitle>

      {message ? (
        <p className={`rounded-md border px-3 py-2 text-xs ${
          message.tone === 'ok'
            ? 'border-ok-line bg-ok-wash text-ok'
            : 'border-critical-line bg-critical-wash text-critical'
        }`}>
          {message.text}
        </p>
      ) : null}

      {!isAdmin ? (
        <p className="flex items-center gap-2 rounded-md border border-line bg-subtle px-3 py-2.5 text-xs text-ink-2">
          <Lock className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
          Signed in as {currentUser?.role || 'staff'}. These settings can be read but only an
          administrator can change them.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={save} className="lg:col-span-2">
        <Panel>
          <PanelHead title="This facility" note="Appears on receipts, printed registers and exports" />
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.width === 'full' ? 'sm:col-span-2' : ''}>
                <label className="label" htmlFor={`set-${f.key}`}>{f.label}</label>
                <input
                  id={`set-${f.key}`}
                  className="field"
                  value={form[f.key] ?? ''}
                  onChange={set(f.key)}
                  disabled={!isAdmin}
                  maxLength={200}
                />
              </div>
            ))}
          </div>

          <PanelHead title="Money" note="What the clinic charges by default" />
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="set-fee">Standard consultation fee ({currency})</label>
              <input
                id="set-fee"
                className="field font-mono"
                type="number"
                min="0"
                step="0.01"
                value={form.default_consultation_fee ?? 0}
                onChange={set('default_consultation_fee')}
                disabled={!isAdmin}
              />
              <p className="mt-1 text-2xs leading-relaxed text-ink-3">
                Filled in on every new consultation. A clinician can change it for one visit, and
                that change is recorded.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="set-admin-email">Where reports are sent</label>
              <input
                id="set-admin-email"
                className="field"
                type="email"
                value={form.admin_email ?? ''}
                onChange={set('admin_email')}
                disabled={!isAdmin}
                placeholder="admin@example.com"
              />
              <p className="mt-1 text-2xs leading-relaxed text-ink-3">
                Used by the Google Sheets backup to email the day's summary when a connection is
                available. Left empty, no email is sent.
              </p>
            </div>
          </div>

          {isAdmin ? (
            <div className="flex justify-end border-t border-line-soft px-4 py-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving</>
                ) : (
                  <><Check className="h-4 w-4" aria-hidden="true" /> Save these settings</>
                )}
              </button>
            </div>
          ) : null}
        </Panel>
        </form>

        <div className="space-y-4">
          <ExportPasswordPanel settings={settings} isAdmin={isAdmin} currentUser={currentUser} onSaved={refreshStats} />
          <GoLivePanel settings={settings} isAdmin={isAdmin} currentUser={currentUser} onDone={refreshStats} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ExportPasswordPanel({ settings, isAdmin, currentUser, onSaved }) {
  const isSet = !!settings?.export_password_set;
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const submit = async () => {
    setNote(null);
    if (next.length < 8) { setNote({ tone: 'critical', text: 'Use at least eight characters.' }); return; }
    if (next !== confirm) { setNote({ tone: 'critical', text: 'The two passwords do not match.' }); return; }

    setBusy(true);
    try {
      await api.updateSettings({ export_password: next, changed_by: currentUser?.full_name || '' });
      setNext('');
      setConfirm('');
      await onSaved?.();
      setNote({ tone: 'ok', text: 'The export password has been changed. Workbooks exported from now on need the new one; older files keep the password they were made with.' });
    } catch (err) {
      setNote({ tone: 'critical', text: err.message || 'The password could not be changed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHead title="Export password">
        <Pill tone={isSet ? 'ok' : 'critical'}>{isSet ? 'Set' : 'Not set'}</Pill>
      </PanelHead>
      <div className="space-y-3 px-4 py-3">
        <p className="text-xs leading-relaxed text-ink-2">
          This one password does three things: it encrypts the records workbook, it is asked for
          before any export is allowed, and it is asked for before records can be cleared. It is
          stored on this clinic's server and is never sent to a browser.
        </p>

        {!isSet ? (
          <p className="flex items-start gap-1.5 rounded-md border border-critical-line bg-critical-wash px-3 py-2 text-2xs leading-relaxed text-critical">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Until this is set, records cannot be exported at all.
          </p>
        ) : null}

        {isAdmin ? (
          // Its own form, separate from the facility-details form. Enter now
          // submits the password rather than doing nothing, and the browser
          // stops warning that a password field is loose on the page.
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="space-y-3"
          >
            <div>
              <label className="label" htmlFor="pw-new">{isSet ? 'New password' : 'Choose a password'}</label>
              <input id="pw-new" className="field" type="password" value={next}
                onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <label className="label" htmlFor="pw-confirm">Type it again</label>
              <input id="pw-confirm" className="field" type="password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>

            {note ? (
              <p className={`rounded border px-3 py-2 text-2xs leading-relaxed ${
                note.tone === 'ok' ? 'border-ok-line bg-ok-wash text-ok' : 'border-critical-line bg-critical-wash text-critical'
              }`}>
                {note.text}
              </p>
            ) : null}

            <button type="submit" className="btn w-full justify-center" disabled={busy}>
              {busy ? 'Changing' : isSet ? 'Change the password' : 'Set the password'}
            </button>
            <p className="text-2xs leading-relaxed text-ink-3">
              A change is recorded against {currentUser?.full_name || 'the signed-in user'}. Write the
              password down somewhere safe: nobody, including this system, can recover it.
            </p>
          </form>
        ) : (
          <p className="text-2xs text-ink-3">Only an administrator can change it.</p>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function GoLivePanel({ settings, isAdmin, currentUser, onDone }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const liveSince = settings?.live_since;

  const run = async () => {
    setNote(null);
    setBusy(true);
    try {
      const res = await api.resetRecords(password, currentUser?.full_name || '');
      setNote({ tone: 'ok', text: res.message || 'The clinic is now live on an empty register.' });
      setPassword('');
      setTyped('');
      setOpen(false);
      await onDone?.();
    } catch (err) {
      setNote({ tone: 'critical', text: err.message || 'Nothing was cleared.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHead title="Going live">
        {liveSince ? <Pill tone="ok">Live</Pill> : <Pill tone="warn">Sample records present</Pill>}
      </PanelHead>
      <div className="space-y-3 px-4 py-3">
        {liveSince ? (
          <p className="text-xs leading-relaxed text-ink-2">
            This clinic went live on {String(liveSince).slice(0, 10)}. Everything in the system since
            then is a real record.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-ink-2">
            This installation still holds the sample patients, visits and sales it was set up with,
            for practice and training. Clear them on the clinic's first real day so nothing invented
            is ever mistaken for a real patient.
          </p>
        )}

        {note ? (
          <p className={`rounded border px-3 py-2 text-2xs leading-relaxed ${
            note.tone === 'ok' ? 'border-ok-line bg-ok-wash text-ok' : 'border-critical-line bg-critical-wash text-critical'
          }`}>
            {note.text}
          </p>
        ) : null}

        {!isAdmin ? (
          <p className="text-2xs text-ink-3">Only an administrator can clear records.</p>
        ) : !open ? (
          <button type="button" className="btn w-full justify-center" onClick={() => setOpen(true)}>
            Clear the sample records and go live
          </button>
        ) : (
          // A form so the password field is not loose on the page, but it
          // deliberately does nothing on Enter: clearing every record is not an
          // action anyone should be able to trigger with a stray keystroke.
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-2.5 rounded-md border border-critical-line bg-critical-wash px-3 py-3"
          >
            <p className="text-xs font-semibold text-critical">
              This deletes every patient, visit, sale, photograph and shift report on this machine.
            </p>
            <p className="text-2xs leading-relaxed text-critical">
              Medicines, staff accounts and these settings are kept. It cannot be undone. Take a
              database backup first if there is anything here worth keeping.
            </p>

            <div>
              <label className="label" htmlFor="reset-pw">Facility export password</label>
              <input id="reset-pw" className="field" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="reset-confirm">Type CLEAR to confirm</label>
              <input id="reset-confirm" className="field font-mono" value={typed}
                onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>

            <div className="flex gap-2">
              <button type="button" className="btn flex-1 justify-center"
                onClick={() => { setOpen(false); setPassword(''); setTyped(''); }}>
                Keep everything
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1 justify-center"
                onClick={run}
                disabled={busy || typed !== 'CLEAR' || !password}
              >
                {busy ? 'Clearing' : 'Clear it all'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}
