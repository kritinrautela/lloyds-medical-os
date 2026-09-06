import React, { useEffect, useRef, useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/*
 * Signing in.
 *
 * This is a gate, not a chooser. There is no list of staff to pick from: a list
 * would tell anyone standing at the machine exactly which usernames exist, and
 * the previous version let you become any of them without a password.
 */
export default function AuthModal({ facilityName }) {
  const { login, loading, currentUser, isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const mustSignIn = !currentUser;
  const open = mustSignIn || isAuthModalOpen;

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    const res = await login(username.trim(), password);
    if (res.success) {
      setUsername('');
      setPassword('');
    } else {
      setPassword('');
      setError(res.message || 'That username and password were not accepted.');
    }
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Sign in">
      <form onSubmit={submit} className="panel w-full max-w-sm shadow-overlay">
        <div className="identity-band" />
        <div className="px-5 py-5">
          <h1 className="text-base font-semibold text-ink">
            {facilityName || 'Lloyds Medical OS'}
          </h1>
          <p className="mt-0.5 text-xs text-ink-3">
            Sign in to begin. Everything you record is kept under your name.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="login-user">Username</label>
              <input
                id="login-user"
                ref={inputRef}
                className="field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="label" htmlFor="login-pass">Password</label>
              <input
                id="login-pass"
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <p className="rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn btn-primary btn-lg w-full justify-center" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Signing in</>
              ) : (
                <><LogIn className="h-4 w-4" aria-hidden="true" /> Sign in</>
              )}
            </button>

            {!mustSignIn ? (
              <button
                type="button"
                className="btn w-full justify-center"
                onClick={() => { setIsAuthModalOpen(false); setError(''); setPassword(''); }}
              >
                Stay signed in as {currentUser.full_name}
              </button>
            ) : null}
          </div>

          <p className="mt-4 text-2xs leading-relaxed text-ink-3">
            If you have forgotten your password, an administrator can set a new one for you. Nobody,
            including this system, can read your existing password.
          </p>
        </div>
      </form>
    </div>
  );
}
