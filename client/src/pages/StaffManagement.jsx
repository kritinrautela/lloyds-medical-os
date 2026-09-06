import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Search, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  EmptyState, Metric, MetricStrip, Panel, PanelHead, Pill, SectionTitle, Value, formatDateTime
} from '../components/ui';

/*
 * Staff accounts and who is signed in.
 *
 * Two rules hold this page together, and both are enforced on the server rather
 * than merely hidden in this interface: only an active administrator can create,
 * disable or delete an account, and every one of those actions is recorded with
 * the name of the administrator who took it.
 *
 * Presence is honest about what it knows. A member of staff is shown as working
 * now only while their browser has checked in within the last few minutes;
 * otherwise the page says when they were last seen, or that they have never
 * signed in, rather than implying they are away.
 */

const ROLES = [
  'Administrator',
  'Chief Medical Officer',
  'Doctor',
  'Senior Triage Nurse',
  'Triage Nurse',
  'Registered Pharmacist',
  'Pathology Technician',
  'HSE Safety Officer',
  'Reception'
];

const ROLE_TINT = {
  'Administrator': 'chip-brand',
  'Chief Medical Officer': 'chip-1',
  'Doctor': 'chip-1',
  'Senior Triage Nurse': 'chip-2',
  'Triage Nurse': 'chip-2',
  'Registered Pharmacist': 'chip-3',
  'Pathology Technician': 'chip-4',
  'HSE Safety Officer': 'chip-5',
  'Reception': 'chip-6'
};

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function StaffManagement() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Administrator';

  const [users, setUsers] = useState([]);
  const [presence, setPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [acting, setActing] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      const [staff, stats] = await Promise.all([api.getStaffUsers(), api.getDashboardStats()]);
      setUsers(staff.users || []);
      setPresence(stats.stats?.staff_presence || []);
    } catch (err) {
      setMessage({ tone: 'critical', text: err.message || 'Staff accounts could not be loaded.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Presence goes stale quickly, so it is refreshed on its own short cycle.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const stats = await api.getDashboardStats();
        setPresence(stats.stats?.staff_presence || []);
      } catch { /* a failed refresh leaves the last known state on screen */ }
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const presenceById = useMemo(() => {
    const map = new Map();
    presence.forEach((p) => map.set(p.id, p));
    return map;
  }, [presence]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.full_name, u.username, u.role, u.staff_id, u.department]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [users, query]);

  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === 'Active').length,
    admins: users.filter((u) => u.role === 'Administrator' && u.status === 'Active').length,
    online: presence.filter((p) => p.online).length
  }), [users, presence]);

  const act = async (fn, successText) => {
    setMessage(null);
    try {
      await fn();
      await load();
      setMessage({ tone: 'ok', text: successText });
    } catch (err) {
      setMessage({ tone: 'critical', text: err.message || 'That could not be done.' });
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle note="Who can use this system, and who is using it now">
          Staff and access
        </SectionTitle>
        {isAdmin ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Create an account
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`rounded-md border px-3 py-2 text-xs ${
          message.tone === 'ok' ? 'border-ok-line bg-ok-wash text-ok' : 'border-critical-line bg-critical-wash text-critical'
        }`}>
          {message.text}
        </p>
      ) : null}

      {!isAdmin ? (
        <p className="flex items-center gap-2 rounded-md border border-line bg-subtle px-3 py-2.5 text-xs text-ink-2">
          <Lock className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
          Signed in as {currentUser?.role || 'staff'}. Accounts can be seen but only an administrator
          can create, disable or remove one.
        </p>
      ) : null}

      <MetricStrip columns={4}>
        <Metric label="Working now" value={counts.online} context="Checked in within the last few minutes" tint="1" />
        <Metric label="Active accounts" value={counts.active} context={`of ${counts.total} in total`} tint="2" />
        <Metric label="Administrators" value={counts.admins}
          context={counts.admins === 1 ? 'Only one. Consider a second.' : 'Can change settings and accounts'}
          tone={counts.admins === 1 ? 'warn' : 'neutral'} tint="3" />
        <Metric label="Disabled" value={counts.total - counts.active} context="Cannot sign in" tint="4" />
      </MetricStrip>

      <Panel>
        <PanelHead title="Accounts" note={`${shown.length} shown`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input
              className="field h-7 w-56 pl-8 text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, username or role"
              aria-label="Search staff"
            />
          </div>
        </PanelHead>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading accounts
          </div>
        ) : shown.length === 0 ? (
          <EmptyState title="No accounts match" detail="Clear the search to see everyone." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {shown.map((u) => {
              const p = presenceById.get(u.id);
              const disabled = u.status !== 'Active';
              const isSelf = u.id === currentUser?.id;
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative">
                      <span className={`chip ${ROLE_TINT[u.role] || 'chip-brand'} h-9 w-9 justify-center text-2xs font-semibold ${disabled ? 'opacity-40' : ''}`}>
                        {initials(u.full_name)}
                      </span>
                      {p?.online ? (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ok"
                          aria-label="Working now"
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        <span className={disabled ? 'line-through opacity-60' : ''}>{u.full_name}</span>
                        {isSelf ? <Pill tone="info">You</Pill> : null}
                        {disabled ? <Pill tone="critical">Disabled</Pill> : null}
                        {u.role === 'Administrator' ? <Pill tone="warn">Administrator</Pill> : null}
                      </p>
                      <p className="mt-0.5 text-2xs text-ink-3">
                        {u.role} · <span className="font-mono">@{u.username}</span>
                        {u.staff_id ? <> · <span className="font-mono">{u.staff_id}</span></> : null}
                      </p>
                      <p className="mt-0.5 text-2xs text-ink-3">
                        {p?.online
                          ? 'Working now'
                          : p?.last_seen
                          ? `Last seen ${formatDateTime(p.last_seen)}`
                          : u.last_login
                          ? `Last signed in ${formatDateTime(u.last_login)}`
                          : 'Has never signed in'}
                      </p>
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <button type="button" className="btn btn-sm"
                        onClick={() => setActing({ kind: 'password', user: u })}>
                        Change password
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={isSelf}
                        title={isSelf ? 'You cannot disable your own account' : undefined}
                        onClick={() => act(
                          () => api.toggleStaffStatus(u.id, currentUser.id),
                          `${u.full_name} has been ${disabled ? 'enabled' : 'disabled'}.`
                        )}
                      >
                        {disabled ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${u.full_name}`}
                        disabled={isSelf}
                        className="rounded p-1.5 text-ink-3 transition-colors hover:bg-critical-wash hover:text-critical disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => setActing({ kind: 'delete', user: u })}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHead title="What each role can do" />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Administrator', 'Everything, including creating accounts, changing prices and settings, setting the export password, and clearing records.'],
            ['Clinical staff', 'Register patients, run the queue, record observations and diagnoses, dispense medicine and change stock.'],
            ['Everyone', 'Every action is recorded with the name of whoever took it. Nobody, including administrators, can dispense, discount or change stock without leaving a record.']
          ].map(([who, what]) => (
            <div key={who} className="rounded-md border border-line bg-subtle px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <ShieldCheck className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                {who}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-3">{what}</p>
            </div>
          ))}
        </div>
      </Panel>

      {addOpen ? (
        <AccountModal
          currentUser={currentUser}
          onClose={() => setAddOpen(false)}
          onSaved={async (text) => { setAddOpen(false); await load(); setMessage({ tone: 'ok', text }); }}
        />
      ) : null}

      {acting?.kind === 'password' ? (
        <PasswordModal
          user={acting.user}
          currentUser={currentUser}
          onClose={() => setActing(null)}
          onSaved={(text) => { setActing(null); setMessage({ tone: 'ok', text }); }}
        />
      ) : null}

      {acting?.kind === 'delete' ? (
        <ConfirmDelete
          user={acting.user}
          onCancel={() => setActing(null)}
          onConfirm={() => act(
            () => api.deleteStaffUser(acting.user.id, currentUser.id),
            `${acting.user.full_name}'s account has been removed. Their past records keep their name.`
          )}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AccountModal({ currentUser, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: '', username: '', password: '', confirm: '',
    role: 'Triage Nurse', email: '', department: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim()) { setError('Enter the person’s full name.'); return; }
    if (!/^[a-z0-9._-]{3,}$/i.test(form.username.trim())) {
      setError('The username needs at least three characters, and no spaces.');
      return;
    }
    if (form.password.length < 8) { setError('Use a password of at least eight characters.'); return; }
    if (form.password !== form.confirm) { setError('The two passwords do not match.'); return; }

    setBusy(true);
    try {
      await api.register({
        full_name: form.full_name.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        email: form.email.trim(),
        department: form.department.trim(),
        created_by_user_id: currentUser?.id,
        created_by: currentUser?.full_name
      });
      onSaved(`An account has been created for ${form.full_name.trim()}.`);
    } catch (err) {
      setError(err.message || 'The account could not be created.');
      setBusy(false);
    }
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Create an account">
      <form onSubmit={submit} className="panel max-h-[92vh] w-full max-w-lg overflow-y-auto shadow-overlay">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Create a staff account</h2>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-name">Full name *</label>
            <input id="s-name" className="field" value={form.full_name} onChange={set('full_name')} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="s-user">Username *</label>
            <input id="s-user" className="field font-mono" value={form.username} onChange={set('username')}
              autoComplete="off" maxLength={40} />
          </div>
          <div>
            <label className="label" htmlFor="s-role">Role *</label>
            <select id="s-role" className="field" value={form.role} onChange={set('role')}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-pass">Password *</label>
            <input id="s-pass" className="field" type="password" value={form.password}
              onChange={set('password')} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="s-confirm">Type it again *</label>
            <input id="s-confirm" className="field" type="password" value={form.confirm}
              onChange={set('confirm')} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="s-email">Email</label>
            <input id="s-email" className="field" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label" htmlFor="s-dept">Department</label>
            <input id="s-dept" className="field" value={form.department} onChange={set('department')} maxLength={80} />
          </div>

          {form.role === 'Administrator' ? (
            <p className="sm:col-span-2 rounded-md border border-warn-line bg-warn-wash px-3 py-2 text-2xs leading-relaxed text-warn">
              An administrator can change prices, settings and the export password, create other
              administrators, and clear every record on this machine. Give this role only to someone
              who should be able to do all of that.
            </p>
          ) : null}

          {error ? (
            <p className="sm:col-span-2 rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">
              {error}
            </p>
          ) : null}

          <p className="sm:col-span-2 text-2xs leading-relaxed text-ink-3">
            Created by {currentUser?.full_name || 'the signed-in administrator'} and recorded. Give
            the person their password in person — it is never shown again.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-line-soft px-4 py-3">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating' : 'Create the account'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PasswordModal({ user, currentUser, onClose, onSaved }) {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (next.length < 8) { setError('Use at least eight characters.'); return; }
    if (next !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.resetStaffPassword(user.id, next, currentUser.id);
      onSaved(`The password for ${user.full_name} has been changed. Tell them in person.`);
    } catch (err) {
      setError(err.message || 'The password could not be changed.');
      setBusy(false);
    }
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Change a password">
      <div className="panel w-full max-w-sm shadow-overlay">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Change password</h2>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-xs text-ink-2">For {user.full_name} (@{user.username}).</p>
          <div>
            <label className="label" htmlFor="np">New password</label>
            <input id="np" className="field" type="password" value={next}
              onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="np2">Type it again</label>
            <input id="np2" className="field" type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {error ? (
            <p className="rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">{error}</p>
          ) : null}
          <p className="text-2xs leading-relaxed text-ink-3">
            Recorded against {currentUser?.full_name}. The password is not shown again after this.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Changing' : 'Change it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ConfirmDelete({ user, onCancel, onConfirm }) {
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Remove an account">
      <div className="panel w-full max-w-sm shadow-overlay">
        <div className="border-b border-line-soft px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Remove this account</h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-xs leading-relaxed text-ink-2">
            {user.full_name} will no longer be able to sign in. Everything they already recorded
            keeps their name against it, so the history stays complete.
          </p>
          <p className="text-2xs leading-relaxed text-ink-3">
            If they are only away for a while, disable the account instead — it can be enabled again.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onCancel}>Keep it</button>
            <button type="button" className="btn btn-primary" onClick={onConfirm}>Remove it</button>
          </div>
        </div>
      </div>
    </div>
  );
}
