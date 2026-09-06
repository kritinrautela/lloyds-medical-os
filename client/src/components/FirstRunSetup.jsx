import React, { useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LloydsLogo from './LloydsLogo';

/*
 * The first screen a brand new installation shows.
 *
 * The software used to arrive with six staff accounts that all shared one
 * password, and that password was written in the source code. Anyone who could
 * read the repository could sign in to any clinic as its administrator. So it
 * now arrives with no accounts at all: the person setting it up creates the
 * administrator account here and chooses its password themselves, and the
 * server only permits this while the staff list is empty.
 */
export default function FirstRunSetup({ facilityName }) {
  const { completeSetup, loading } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    password: '',
    confirm: ''
  });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim()) return setError('Type the name of the person who will hold this account.');
    if (!form.username.trim()) return setError('Choose a username for signing in.');
    if (form.password.length < 8) return setError('Choose a password of at least 8 characters.');
    if (form.password !== form.confirm) return setError('The two passwords are not the same.');

    const res = await completeSetup({
      full_name: form.full_name.trim(),
      username: form.username.trim().toLowerCase(),
      password: form.password,
      role: 'Administrator'
    });
    if (!res.success) setError(res.message || 'The account could not be created.');
  };

  return (
    <div className="w-full max-w-md px-4">
      <div className="mb-6 text-center">
        <LloydsLogo size="md" />
        <h1 className="mt-4 text-lg font-semibold text-ink">Set up this clinic system</h1>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          {facilityName || 'This installation'} has no staff accounts yet. Create the administrator
          account now. It is the account that will create every other one.
        </p>
      </div>

      <form onSubmit={submit} className="panel space-y-3 p-4">
        <div>
          <label className="label" htmlFor="setup-name">Full name</label>
          <input id="setup-name" className="field" value={form.full_name} onChange={set('full_name')}
            placeholder="The name that will appear on every record" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="setup-username">Username</label>
          <input id="setup-username" className="field" value={form.username} onChange={set('username')}
            placeholder="Short, no spaces" autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="setup-password">Password</label>
          <input id="setup-password" className="field" type="password" value={form.password}
            onChange={set('password')} autoComplete="new-password" />
          <p className="mt-1 text-2xs text-ink-3">At least 8 characters.</p>
        </div>
        <div>
          <label className="label" htmlFor="setup-confirm">Type the password again</label>
          <input id="setup-confirm" className="field" type="password" value={form.confirm}
            onChange={set('confirm')} autoComplete="new-password" />
        </div>

        {error ? (
          <p className="flex items-start gap-1.5 rounded-md border border-critical-line bg-critical-wash px-3 py-2 text-2xs leading-relaxed text-critical">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Creating</>
          ) : (
            <><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Create the administrator account</>
          )}
        </button>

        <p className="text-2xs leading-relaxed text-ink-3">
          Write this password down and keep it somewhere safe. Nobody, including this system, can
          read it back or recover it.
        </p>
      </form>
    </div>
  );
}
