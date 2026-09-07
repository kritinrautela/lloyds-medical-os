import React, { useRef, useState } from 'react';
import {
  AlertTriangle, Database, Download, FileSpreadsheet, Loader2, Lock, Upload
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Panel, PanelHead, Pill, SectionTitle } from '../components/ui';

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
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Administrator';
  const passwordSet = !!settings?.export_password_set;

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

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

  const restore = async (file) => {
    if (!file) return;
    if (!password.trim() && file.name.endsWith('.lloydsbackup')) {
      say('critical', 'Type the export password the backup was made with, then choose the file again.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBusy('restore');
    setMessage(null);
    try {
      const res = await api.restoreDb(file, password);
      if (res.success) setPassword('');
      say(res.success ? 'ok' : 'critical', res.message || 'Restore finished.');
    } catch (err) {
      say('critical', err.message || 'The database could not be restored.');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
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

      <div className="grid gap-4 lg:grid-cols-3">
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
                typed above, so a lost drive gives away nothing. Restoring replaces everything
                currently on this machine and needs the same password.
              </p>

              {isAdmin ? (
                <>
                  <button type="button" className="btn w-full justify-center" onClick={downloadDatabase}
                    disabled={busy === 'backup' || !passwordSet}>
                    {busy === 'backup' ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Encrypting</>
                    ) : (
                      <><Download className="h-3.5 w-3.5" aria-hidden="true" /> Download an encrypted backup</>
                    )}
                  </button>

                  <div>
                    <input
                      ref={fileRef}
                      id="restore-file"
                      type="file"
                      accept=".lloydsbackup,.db"
                      className="hidden"
                      onChange={(e) => restore(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      className="btn w-full justify-center"
                      onClick={() => fileRef.current?.click()}
                      disabled={busy === 'restore'}
                    >
                      {busy === 'restore' ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Restoring</>
                      ) : (
                        <><Upload className="h-3.5 w-3.5" aria-hidden="true" /> Restore from a backup</>
                      )}
                    </button>
                    <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                      The current database is copied aside first, so a restore from the wrong file
                      can be undone. The server must be restarted afterwards.
                    </p>
                  </div>
                </>
              ) : (
                <p className="flex items-center gap-1.5 rounded border border-line bg-subtle px-3 py-2 text-2xs text-ink-3">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Signed in as {currentUser?.role || 'staff'}. Only an administrator can copy or
                  replace the database.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHead title="Where the records live" />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
          {[
            [Database, 'On this machine', 'The clinic database sits on this computer. It works with no internet at all.'],
            [FileSpreadsheet, 'In the workbook', 'An encrypted point-in-time copy, for sharing with head office or an auditor.'],
            [Upload, 'Off-site', 'Google Sheets backup keeps a copy off this machine when a connection is available.']
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
