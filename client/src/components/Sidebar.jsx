import React from 'react';
import {
  Activity, ClipboardList, Cloud, CloudOff, FileCheck, FileSpreadsheet, HardDrive,
  LayoutDashboard, Pill, Settings, ShieldCheck, ShoppingCart, Users
} from 'lucide-react';
import LloydsLogo from './LloydsLogo';
import { useAuth } from '../context/AuthContext';

/*
 * Primary navigation.
 *
 * The status block at the top and bottom reports only what is verifiable from
 * this machine: whether the browser has a network connection, and whether a
 * replication endpoint has been configured and has actually succeeded. It does
 * not claim encryption the software does not perform.
 */

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Clinical board', icon: LayoutDashboard, tint: 'brand' },
  { id: 'patients', label: 'Patient register', icon: Users, tint: '1', badge: (s) => s?.total_patients },
  { id: 'queue', label: 'Outpatient queue', icon: Activity, tint: '2', badge: (s) => s?.queueMap?.Waiting, badgeTone: 'warn' },
  { id: 'registers', label: 'Clinical registers', icon: ClipboardList, tint: '2',
    badge: (s) => ((s?.follow_ups_overdue || 0) + (s?.follow_ups_due_today || 0) + (s?.open_referrals || 0)) || undefined, badgeTone: 'warn' },
  { id: 'pharmacy', label: 'Pharmacy formulary', icon: Pill, tint: '3', badge: (s) => s?.low_stock_count, badgeTone: 'critical' },
  { id: 'dispense', label: 'Dispensing counter', icon: ShoppingCart, tint: '3' },
  { id: 'staff', label: 'Staff and access', icon: ShieldCheck, tint: '5' },
  { id: 'end-of-day', label: 'Shift close', icon: FileCheck, tint: '5' },
  { id: 'export', label: 'Protected export', icon: FileSpreadsheet, tint: '6' },
  { id: 'cloud-sync', label: 'Google Sheets backup', icon: Cloud, tint: '6' },
  { id: 'settings', label: 'Facility settings', icon: Settings, tint: '4' }
];

export default function Sidebar({ activeTab, setActiveTab, stats, isOnline, isOpen = false, onClose }) {
  const { currentUser, setIsAuthModalOpen, sections } = useAuth();

  // The server decides which sections this role may open and sends the list at
  // sign-in. Anything not on it is not drawn, so a triage nurse never sees a
  // door marked Facility settings that would only refuse her.
  const allowed = new Set((sections || []).map((section) => section.id));
  const visibleItems = NAV_ITEMS.filter((item) => allowed.has(item.id));
  const sync = stats?.cloudSync;

  const backupState = !sync || !sync.configured
    ? { tone: 'text-ink-3', label: 'Backup not configured', icon: CloudOff }
    : sync.last_sync_status === 'Success'
    ? { tone: 'text-ok', label: 'Backup up to date', icon: Cloud }
    : { tone: 'text-warn', label: `Backup ${sync.last_sync_status.toLowerCase()}`, icon: CloudOff };

  const BackupIcon = backupState.icon;

  // Choosing a section closes the drawer on a small screen. On a laptop the
  // drawer is not a drawer at all, so closing it there costs nothing.
  const go = (id) => {
    setActiveTab(id);
    onClose?.();
  };

  // On a laptop the navigation is simply always there. On a phone or a narrow
  // tablet it slides in over the page instead: a permanent 256px column left
  // the clinical content 124px wide, which is not usable.
  return (
    <aside
      id="primary-navigation"
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 select-none flex-col justify-between border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 ${
        isOpen ? 'translate-x-0 shadow-overlay' : '-translate-x-full'
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="identity-rule" aria-hidden="true" />
        <div className="identity-band border-b border-line-soft px-4 py-4">
          <LloydsLogo size="sm" showSubtitle subtitle="Papua New Guinea operations" />
          <p className="mt-2 text-2xs leading-relaxed text-ink-3">
            Occupational health centre and community hospital
          </p>
        </div>

        <nav className="p-2" aria-label="Primary">
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              const badgeValue = item.badge ? item.badge(stats) : null;
              const badgeToneClass =
                item.badgeTone === 'critical'
                  ? 'bg-critical-wash text-critical border-critical-line'
                  : item.badgeTone === 'warn'
                  ? 'bg-warn-wash text-warn border-warn-line'
                  : 'bg-subtle text-ink-2 border-line';

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    id={`nav-btn-${item.id}`}
                    onClick={() => go(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-brand-wash font-semibold text-ink'
                        : 'font-medium text-ink-2 hover:bg-subtle hover:text-ink'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className={`chip chip-${item.tint} h-7 w-7`} aria-hidden="true">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badgeValue ? (
                      <span className={`shrink-0 rounded border px-1.5 text-2xs font-semibold ${badgeToneClass}`}>
                        {badgeValue}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="space-y-2 border-t border-line-soft bg-subtle p-3">
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          className="panel flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:border-line-strong"
          title="Hand the machine to another staff member. They sign in with their own password, so the record shows who did what."
        >
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-ink">
              {currentUser?.full_name || 'No staff member signed in'}
            </span>
            <span className="mt-0.5 block truncate text-2xs text-ink-3">
              {currentUser?.role || 'Role not set'}
              {currentUser?.staff_id ? ` · ${currentUser.staff_id}` : ''}
            </span>
          </span>
          <span className="shrink-0 text-2xs font-semibold uppercase tracking-wide text-brand">
            Hand over
          </span>
        </button>

        <dl className="space-y-1.5 px-1 text-2xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="inline-flex items-center gap-1.5 text-ink-3">
              <HardDrive className="h-3 w-3" aria-hidden="true" />
              Records
            </dt>
            <dd className="font-semibold text-ink-2">On this machine</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="inline-flex items-center gap-1.5 text-ink-3">
              <BackupIcon className="h-3 w-3" aria-hidden="true" />
              Off-site copy
            </dt>
            <dd className={`font-semibold ${backupState.tone}`}>{backupState.label}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-3">Network</dt>
            <dd className={`font-semibold ${isOnline ? 'text-ink-2' : 'text-warn'}`}>
              {isOnline ? 'Connected' : 'No connection'}
            </dd>
          </div>
        </dl>

        <p className="px-1 text-2xs leading-relaxed text-ink-3">
          The clinic runs with no internet. A connection is only needed to send a copy off-site.
        </p>
      </div>
    </aside>
  );
}
