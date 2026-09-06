import React, { useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LloydsLogo from './LloydsLogo';

/*
 * Shown when the password in use was chosen by somebody else.
 *
 * That happens in two ways: an administrator has just created the account, or
 * an administrator has just reset it. In both cases a second person knows the
 * password, so nothing recorded under this name would be evidence that this
 * person did it. The system therefore goes no further until the holder has
 * chosen a password only they know.
 *
 * It also catches every account still on the password this software used to
 * ship with, which was the same for every clinic and published with the source.
 */
export default function ChangePasswordGate() {
  const { currentUser, changeOwnPassword, logout, loading } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (next.length < 8) return setError('Choose a password of at least 8 characters.');
    if (next !== confirm) return setError('The two new passwords are not the same.');
    if (next === current) return setError('The new password must be different from the current one.');

    const res = await changeOwnPassword(current, next);
    if (!res.success) setError(res.message || 'The password could not be changed.');
  };

  return (
    <div className="w-full max-w-md px-4">
      <div className="mb-6 text-center">
        <LloydsLogo size="md" />
        <h1 className="mt-4 text-lg font-semibold text-ink">Choose your own password</h1>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          {currentUser?.full_name}, the password on this account was set by somebody else, so it is
          not yet proof of who you are. Choose one only you know before you start work.
        </p>
      </div>

      <form onSubmit={submit} className="panel space-y-3 p-4">
        <div>
          <label className="label" htmlFor="cp-current">The password you signed in with</label>
          <input id="cp-current" className="field" type="password" value={current}
            onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="cp-new">Your new password</label>
          <input id="cp-new" className="field" type="password" value={next}
            onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <p className="mt-1 text-2xs text-ink-3">At least 8 characters.</p>
        </div>
        <div>
          <label className="label" htmlFor="cp-confirm">Type the new password again</label>
          <input id="cp-confirm" className="field" type="password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>

        {error ? (
          <p className="flex items-start gap-1.5 rounded-md border border-critical-line bg-critical-wash px-3 py-2 text-2xs leading-relaxed text-critical">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving</>
          ) : (
            <><KeyRound className="h-4 w-4" aria-hidden="true" /> Set my password</>
          )}
        </button>

        <p className="text-2xs leading-relaxed text-ink-3">
          Every other device signed in as you will be signed out. Nobody, including this system, can
          read your password back, so keep a note of it somewhere safe.
        </p>

        <button type="button" onClick={logout}
          className="btn w-full justify-center text-ink-2">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out instead
        </button>
      </form>
    </div>
  );
}
