import React, { useRef, useState } from 'react';
import {
  AlertTriangle, Database, Download, FileSpreadsheet, KeyRound, Loader2, Lock, Upload
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog, Panel, PanelHead, Pill, SectionTitle } from '../components/ui';

/*
 * Taking records off this machine.
 *
 * The export password lives on the server and is never sent to a browser, so
 * the operator types it here and the server checks it. A wrong attempt is
 * recorded, not merely rejected: the point of the password is less to stop a
 * download than to make sure every download has a name against it.
 *
 * Nothing on this page claims a protection the file does not have. What the
 * workbook can and cannot guarantee is written on its first sheet as well.
 */

const SHEETS = [
  ['About this export', 'What the file is, how it is protected, and the totals'],
  ['Patients', 'Every registered patient, with hospital numbers'],
  ['Outpatient visits', 'Every attendance, observations, diagnosis and fee'],
  ['Medicine store', 'Stock, prices, batches and expiry dates'],
  ['Dispensing ledger', 'Every hand-over, what was collected, and who recorded it'],
  ['Beds', 'Bed occupancy at the moment of export'],
  ['Workplace health', 'Incidents recorded for mine site workers'],
  ['Activity record', 'What was done in the system, by whom']
];

export default function ExcelExport({ settings }) {
  const { currentUser, signOutIdle } = useAuth();
  const isAdmin = currentUser?.role === 'Administrator';
  const passwordSet = !!settings?.export_password_set;

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);
  // Bringing records back: the chosen files wait behind a confirmation.
  const [restoreFiles, setRestoreFiles] = useState(null);
  const [restorePass, setRestorePass] = useState('');
  const [restoreResult, setRestoreResult] = useState(null);

  const say = (tone, text) => setMessage({ tone, text });

  /*
   * The download is fetched rather than opened in a new tab, because a refusal
   * comes back as JSON with a status code. Opening a tab would show the operator
   * a page of raw JSON instead of a readable message.
   */
  const downloadWorkbook = async () => {
    setMessage(null);
    if (!password.trim()) { say('critical', 'Type the facility export password.'); return; }

    setBusy('excel');
    try {
      const res = await fetch(api.getExcelExportUrl(password, currentUser?.full_name || ''));
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        say('critical', detail.message || 'The export was refused.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Lloyds_records_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPassword('');
      say('ok', 'The workbook has been downloaded. It opens with the same export password.');
    } catch (err) {
      say('critical', err.message || 'The workbook could not be produced.');
    } finally {
      setBusy('');
    }
  };

  const downloadDatabase = async () => {
    setMessage(null);
    if (!password.trim()) { say('critical', 'Type the facility export password. The backup is encrypted with it.'); return; }
    setBusy('backup');
    try {
      const res = await fetch(api.getDbBackupUrl(password));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `The backup could not be produced (HTTP ${res.status}).`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clinic_backup_${new Date().toISOString().slice(0, 10)}.lloydsbackup`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPassword('');
      say('ok', 'The backup has been downloaded. It is encrypted with the export password; without it the file is unreadable.');
    } catch (err) {
      say('critical', err.message || 'The backup could not be produced.');
    } finally {
      setBusy('');
    }
  };

  /*
   * The picker accepts more than one file so the key file can be chosen in the
   * same go. Whichever is the copy becomes the copy; a backup.key.wrapped
   * beside it is the key.
   */
  const chooseFiles = (list) => {
    const files = Array.from(list || []);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length === 0) return;
    const key = files.find((f) => /\.wrapped$/i.test(f.name)) || null;
    const copy = files.find((f) => !/\.wrapped$/i.test(f.name)) || null;
    if (!copy) { say('critical', 'Pick the copy itself, the file ending in .db.enc or .lloydsbackup. The key file goes with it, not instead of it.'); return; }
    setMessage(null);
    setRestoreFiles({ copy, key });
  };

  const restore = async () => {
    if (!restoreFiles) return;
    setBusy('restore');
    setMessage(null);
    try {
      const res = await api.restoreDb(restoreFiles.copy, restorePass.trim(), restoreFiles.key);
      setRestoreFiles(null);
      setRestorePass('');
      if (res.signed_out) {
        // The copy predates this sign-in, so it is not in there. Go to the
        // sign-in screen now, with the result written on it, rather than
        // letting the next request bounce there with nothing to show.
        await signOutIdle(res.message);
        return;
      }
      setRestoreResult(res);
    } catch (err) {
      setRestoreFiles(null);
      say('critical', err.message || 'The copy could not be brought back. Nothing was changed.');
    } finally {
      setBusy('');
    }
  };

  const copyDate = (name) => {
    const m = /(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(name || '');
    if (!m) return null;
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      <SectionTitle note="Records leave this machine only as an encrypted workbook or a database file">
        Protected export
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

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Panel className="lg:col-span-2">
          <PanelHead title="Records workbook" note="Excel, encrypted, every sheet read-only" />
          <div className="space-y-3 px-4 py-3">
            {!passwordSet ? (
              <div className="rounded-md border border-critical-line bg-critical-wash px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-critical">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  No export password has been set
                </p>
                <p className="mt-1 text-2xs leading-relaxed text-critical">
                  Without one the workbook cannot be encrypted, so exporting is refused. An
                  administrator sets the password in Facility settings.
                </p>
              </div>
            ) : null}

            <form
              onSubmit={(e) => { e.preventDefault(); downloadWorkbook(); }}
              className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
            >
              <div>
                <label className="label" htmlFor="export-password">Facility export password</label>
                <input
                  id="export-password"
                  className="field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Type the password"
                  autoComplete="off"
                  disabled={!passwordSet}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!passwordSet || busy === 'excel'}
              >
                {busy === 'excel' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Building</>
                ) : (
                  <><FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Download the workbook</>
                )}
              </button>
            </form>

            <p className="text-2xs leading-relaxed text-ink-3">
              The password is held on this clinic's server and never sent to a browser, so it cannot
              be read out of this page. Both a successful download and a wrong password are recorded
              against {currentUser?.full_name || 'the signed-in user'} in the activity record.
            </p>

            <div className="rounded-md border border-line bg-subtle px-3 py-2.5">
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-3">
                What the workbook contains
              </p>
              <ul className="mt-1.5 space-y-1">
                {SHEETS.map(([name, detail]) => (
                  <li key={name} className="text-xs">
                    <span className="font-medium text-ink">{name}</span>
                    <span className="text-ink-3"> — {detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHead title="What the protection does" />
            <dl className="space-y-2.5 px-4 py-3 text-xs">
              <div>
                <dt className="font-semibold text-ink">Opening the file</dt>
                <dd className="mt-0.5 leading-relaxed text-ink-2">
                  Encrypted with the export password using Excel's own document encryption. Without
                  the password it will not open.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Editing the sheets</dt>
                <dd className="mt-0.5 leading-relaxed text-ink-2">
                  Every sheet is marked read-only, which stops editing when the file is opened
                  normally. It is a deterrent, not an unbreakable seal — someone who knows the
                  password and is determined enough can remove it.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Checking a copy</dt>
                <dd className="mt-0.5 leading-relaxed text-ink-2">
                  Each sheet carries a checksum of the records behind it, so two copies that should
                  match can be shown to match.
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <PanelHead title="Database file">
              {isAdmin ? <Pill tone="warn">Administrators</Pill> : <Pill tone="neutral">Administrators only</Pill>}
            </PanelHead>
            <div className="space-y-3 px-4 py-3">
              <p className="text-xs leading-relaxed text-ink-2">
                A copy of the whole clinic database, for keeping on a USB drive. It is
                <span className="font-semibold text-ink"> encrypted with the export password</span>{' '}
                typed above, so a lost drive gives away nothing.
              </p>

              {isAdmin ? (
                <button type="button" className="btn w-full justify-center" onClick={downloadDatabase}
                  disabled={busy === 'backup' || !passwordSet}>
                  {busy === 'backup' ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Encrypting</>
                  ) : (
                    <><Download className="h-3.5 w-3.5" aria-hidden="true" /> Download an encrypted backup</>
                  )}
                </button>
              ) : (
                <p className="flex items-center gap-1.5 rounded border border-line bg-subtle px-3 py-2 text-2xs text-ink-3">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Signed in as {currentUser?.role || 'staff'}. Only an administrator can copy or
                  replace the database.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Bring records back from a copy" note="From a stick, a phone, head office or a backup made here" />
            <div className="space-y-3 px-4 py-3">
              {restoreResult ? (
                <div className="rounded-md border border-ok-line bg-ok-wash px-3 py-2.5 text-xs leading-relaxed text-ok">
                  <p className="font-semibold">The records are back.</p>
                  <p className="mt-0.5">{restoreResult.message}</p>
                  <p className="mt-1 text-2xs">The records that were here before are kept beside the database as {restoreResult.previous_copy}.</p>
                </div>
              ) : null}

              <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-ink-2">
                <li>Plug in the stick, or save the file the phone or head office sent.</li>
                <li>Press the button and pick the newest copy, the file ending in .db.enc.</li>
                <li>On a different computer from the one that made it, pick backup.key.wrapped from the same folder as well, and type the backup passphrase.</li>
              </ol>

              {isAdmin ? (
                <>
                  <div>
                    <label className="label" htmlFor="restore-pass">Backup passphrase, if this is a different computer</label>
                    <input
                      id="restore-pass"
                      className="field"
                      type="password"
                      value={restorePass}
                      onChange={(e) => setRestorePass(e.target.value)}
                      autoComplete="off"
                      placeholder="Leave empty on the computer that made the copy"
                    />
                  </div>
                  <input
                    ref={fileRef}
                    id="restore-file"
                    type="file"
                    accept=".db.enc,.enc,.lloydsbackup,.db,.wrapped,.txt"
                    multiple
                    className="hidden"
                    onChange={(e) => chooseFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    className="btn w-full justify-center"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy === 'restore'}
                  >
                    {busy === 'restore' ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Bringing the records back</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5" aria-hidden="true" /> Choose the copy</>
                    )}
                  </button>
                  <p className="text-2xs leading-relaxed text-ink-3">
                    Nothing is thrown away. The records on this computer are put aside under a dated
                    name first, so bringing back the wrong copy can be undone by Lloyds.
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-1.5 rounded border border-line bg-subtle px-3 py-2 text-2xs text-ink-3">
                  <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Only an administrator can bring records back.
                </p>
              )}
            </div>
          </Panel>

          {restoreFiles ? (
            <ConfirmDialog
              title="Replace the records on this computer?"
              confirmLabel="Bring the records back"
              cancelLabel="Keep what is here"
              danger
              busy={busy === 'restore'}
              onConfirm={restore}
              onCancel={() => setRestoreFiles(null)}
            >
              <p className="text-sm text-ink-2">
                Everything on this computer will be replaced with the copy{' '}
                <span className="font-semibold text-ink">{restoreFiles.copy.name}</span>
                {copyDate(restoreFiles.copy.name) ? <> made on <span className="font-semibold text-ink">{copyDate(restoreFiles.copy.name)}</span></> : null}.
                {restoreFiles.key ? ' The key file beside it will be used.' : ''}
              </p>
              <p className="mt-2 text-xs text-ink-3">
                Anything recorded here since that copy was made will not be in it. The current records are kept aside, not deleted. Everyone else is signed out afterwards.
              </p>
            </ConfirmDialog>
          ) : null}
        </div>
      </div>

      <Panel>
        <PanelHead title="Where the records live" />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
          {[
            [Database, 'On this machine', 'The clinic database sits on this computer. It works with no internet at all.'],
            [FileSpreadsheet, 'In the workbook', 'An encrypted point-in-time copy, for sharing with head office or an auditor.'],
            [Upload, 'Off-site', 'A USB stick, head office or the company Google account keeps a copy away from this machine. See Off-site copies.']
          ].map(([Icon, title, detail]) => (
            <div key={title} className="rounded-md border border-line bg-subtle px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Icon className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                {title}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-3">{detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
