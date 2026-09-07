import React, { useEffect, useRef, useState } from 'react';
import { HardDrive, Loader2, LogIn, ShieldCheck, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LloydsLogo from './LloydsLogo';
import { APP_VERSION } from '../version';

/*
 * Signing in.
 *
 * This is a gate, not a chooser. There is no list of staff to pick from: a list
 * would tell anyone standing at the machine exactly which usernames exist, and
 * the previous version let you become any of them without a password.
 *
 * It appears in two places. When nobody is signed in it is the whole page, so
 * no patient name is readable behind it. When someone is signed in and another
 * member of staff wants to take over the machine it is a small panel over the
 * dashboard, and the person already signed in can decline.
 */

const PROMISES = [
  {
    icon: HardDrive,
    title: 'Records stay on this machine',
    text: 'Patients, visits and the pharmacy ledger live on this computer. Nothing is sent anywhere unless a copy is deliberately made.'
  },
  {
    icon: WifiOff,
    title: 'Works with no internet',
    text: 'The clinic keeps running when the connection drops. A connection is only needed to send a copy off-site.'
  },
  {
    icon: ShieldCheck,
    title: 'Every entry carries a name',
    text: 'A diagnosis, a medicine handed over, a price reduced: each is recorded against whoever was signed in.'
  }
];

function SignInForm({ error, loading, username, password, setUsername, setPassword, onSubmit, inputRef, footer }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
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

      {footer}
    </form>
  );
}

export default function AuthModal({ facilityName, facility }) {
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

  const forgot = (
    <p className="text-2xs leading-relaxed text-ink-3">
      If you have forgotten your password, an administrator can set a new one for you. Nobody,
      including this system, can read your existing password.
    </p>
  );

  const formProps = { error, loading, username, password, setUsername, setPassword, onSubmit: submit, inputRef };

  if (!mustSignIn) {
    return (
      <div className="scrim" role="dialog" aria-modal="true" aria-label="Sign in">
        <div className="panel w-full max-w-sm shadow-overlay">
          <div className="identity-band" />
          <div className="px-5 py-5">
            <h1 className="text-base font-semibold text-ink">Sign in as someone else</h1>
            <p className="mt-0.5 text-xs text-ink-3">
              {currentUser.full_name} stays responsible for everything recorded until you do.
            </p>
            <div className="mt-4">
              <SignInForm
                {...formProps}
                footer={(
                  <>
                    <button
                      type="button"
                      className="btn w-full justify-center"
                      onClick={() => { setIsAuthModalOpen(false); setError(''); setPassword(''); }}
                    >
                      Stay signed in as {currentUser.full_name}
                    </button>
                    <div className="pt-1">{forgot}</div>
                  </>
                )}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const name = facility?.name || facilityName || 'Lloyds Medical OS';
  const place = [facility?.district, facility?.province, facility?.country].filter(Boolean).join(' · ');

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="identity-band relative flex flex-col justify-between border-b border-line-soft px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-12">
        <LloydsLogo size="lg" showSubtitle subtitle="Papua New Guinea operations" />

        <div className="my-10 max-w-lg lg:my-0">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{name}</h1>
          {facility?.tagline ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{facility.tagline}</p>
          ) : null}
          {place ? <p className="mt-1 text-xs text-ink-3">{place}</p> : null}

          <dl className="mt-8 space-y-5">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-brand">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div>
                  <dt className="text-sm font-semibold text-ink">{title}</dt>
                  <dd className="mt-0.5 max-w-md text-xs leading-relaxed text-ink-2">{text}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-2xs text-ink-3">
          Lloyds Medical OS · version {APP_VERSION}
          {facility?.doctor_in_charge ? ` · Doctor in charge: ${facility.doctor_in_charge}` : ''}
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="panel w-full max-w-sm shadow-overlay">
          <div className="px-5 py-5">
            <h2 className="text-base font-semibold text-ink">Sign in</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              Use your own account. Everything you record today is kept under your name.
            </p>
            <div className="mt-4">
              <SignInForm {...formProps} footer={<div className="pt-1">{forgot}</div>} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
