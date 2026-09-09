import React from 'react';
import {
  Activity, ClipboardList, Cloud, CloudOff, FileCheck, FileSpreadsheet, HardDrive,
  LayoutDashboard, Pill, Settings, ShieldCheck, ShoppingCart, Users
} from 'lucide-react';
import { ageLabel } from './ui';
import LloydsLogo from './LloydsLogo';
import { useAuth } from '../context/AuthContext';

/*
 * Primary navigation: the spine of the register.
 *
 * The whole column is bound in the book's deep blue. The company mark sits on
 * a white label pasted to the cover, each section is a line on the spine, and
 * the open section is a tab cut out in the paper colour so it joins the page
 * to its right.
 *
 * The status block at the bottom reports only what is verifiable from this
 * machine: whether the browser has a network connection, and when a copy last
 * left the building. It does not claim encryption the software does not
 * perform.
 */

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Clinical board', icon: LayoutDashboard },
  { id: 'patients', label: 'Patient register', icon: Users, badge: (s) => s?.total_patients },
  { id: 'queue', label: 'Outpatient queue', icon: Activity, badge: (s) => s?.queueMap?.Waiting, badgeTone: 'warn' },
  { id: 'registers', label: 'Clinical registers', icon: ClipboardList,
    badge: (s) => ((s?.follow_ups_overdue || 0) + (s?.follow_ups_due_today || 0) + (s?.open_referrals || 0)) || undefined, badgeTone: 'warn' },
  { id: 'pharmacy', label: 'Pharmacy formulary', icon: Pill, badge: (s) => s?.low_stock_count, badgeTone: 'critical' },
  { id: 'dispense', label: 'Dispensing counter', icon: ShoppingCart },
  { id: 'staff', label: 'Staff and access', icon: ShieldCheck },
  { id: 'end-of-day', label: 'Shift close', icon: FileCheck },
  { id: 'export', label: 'Protected export', icon: FileSpreadsheet },
  { id: 'cloud-sync', label: 'Off-site copies', icon: Cloud },
  { id: 'settings', label: 'Facility settings', icon: Settings }
];

export default function Sidebar({ activeTab, setActiveTab, stats, isOnline, isOpen = false, onClose }) {
  const { currentUser, setIsAuthModalOpen, sections } = useAuth();

  // The server decides which sections this role may open and sends the list at
  // sign-in. Anything not on it is not drawn, so a triage nurse never sees a
  // door marked Facility settings that would only refuse her.
  const allowed = new Set((sections || []).map((section) => section.id));
  const visibleItems = NAV_ITEMS.filter((item) => allowed.has(item.id));
  const sync = stats?.cloudSync;
  const offsite = stats?.offsite;

  // The most recent copy that actually left the building, whichever way it
  // went: a USB stick, head office, or the Google account. A copy older than
  // two days is shown in amber, because that is when someone should act.
  const copies = [
    offsite?.usb_last_at ? { at: offsite.usb_last_at, label: 'USB stick' } : null,
    offsite?.head_office_last_at ? { at: offsite.head_office_last_at, label: 'Head office' } : null,
    sync?.configured && sync.last_successful_sync_at ? { at: sync.last_successful_sync_at, label: 'Google' } : null
  ].filter(Boolean).sort((a, b) => new Date(b.at) - new Date(a.at));
  const latestCopy = copies[0];
  const copyHours = latestCopy ? (Date.now() - new Date(latestCopy.at).getTime()) / 36e5 : null;

  const backupState = !latestCopy
    ? { tone: 'text-spine-ink-2', label: 'No copy yet', icon: CloudOff }
    : copyHours < 48
    ? { tone: 'on-blue-ok', label: `${latestCopy.label} ${ageLabel(latestCopy.at)}`, icon: Cloud }
    : { tone: 'on-blue-warn', label: `${latestCopy.label} ${ageLabel(latestCopy.at)}`, icon: CloudOff };

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
      className={`spine fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 select-none flex-col justify-between transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 ${
        isOpen ? 'translate-x-0 shadow-overlay' : '-translate-x-full'
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pb-3 pt-4">
          <div className="cover-label inline-flex p-1.5">
            <LloydsLogo size="sm" framed={false} />
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-spine-ink-2">
            Papua New Guinea operations
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-spine-ink-2">
            Occupational health centre and community hospital
          </p>
        </div>

        <nav className="pb-2 pl-2 pt-1" aria-label="Primary">
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              const badgeValue = item.badge ? item.badge(stats) : null;
              const countClass =
                item.badgeTone === 'critical'
                  ? 'spine-count spine-count-critical'
                  : item.badgeTone === 'warn'
                  ? 'spine-count spine-count-warn'
                  : 'spine-count';

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    id={`nav-btn-${item.id}`}
                    onClick={() => go(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className="spine-item flex w-full items-center justify-between gap-2 py-2 pl-2.5 pr-3 text-left text-sm font-semibold"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="chip h-7 w-7" aria-hidden="true">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badgeValue ? (
                      <span className={`shrink-0 rounded-[3px] px-1.5 text-2xs font-bold ${countClass}`}>
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

      <div className="space-y-2 border-t border-white/10 bg-black/20 p-3">
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded border border-white/15 bg-white/[0.07] px-3 py-2 text-left transition-colors hover:border-white/40 hover:bg-white/[0.12]"
          title="Hand the machine to another staff member. They sign in with their own password, so the record shows who did what."
        >
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-white">
              {currentUser?.full_name || 'No staff member signed in'}
            </span>
            <span className="mt-0.5 block truncate text-2xs text-spine-ink-2">
              {currentUser?.role || 'Role not set'}
              {currentUser?.staff_id ? ` · ${currentUser.staff_id}` : ''}
            </span>
          </span>
          <span className="shrink-0 text-2xs font-bold uppercase tracking-wide text-white">
            Hand over
          </span>
        </button>

        <dl className="space-y-1.5 px-1 text-2xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="inline-flex items-center gap-1.5 text-spine-ink-2">
              <HardDrive className="h-3 w-3" aria-hidden="true" />
              Records
            </dt>
            <dd className="font-bold text-spine-ink">On this machine</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="inline-flex items-center gap-1.5 text-spine-ink-2">
              <BackupIcon className="h-3 w-3" aria-hidden="true" />
              Off-site copy
            </dt>
            <dd className={`font-bold ${backupState.tone}`}>{backupState.label}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-spine-ink-2">Network</dt>
            <dd className={`font-bold ${isOnline ? 'text-spine-ink' : 'on-blue-warn'}`}>
              {isOnline ? 'Connected' : 'No connection'}
            </dd>
          </div>
        </dl>

        <p className="px-1 text-2xs leading-relaxed text-spine-ink-2">
          The clinic runs with no internet. A connection is only needed to send a copy off-site.
        </p>
      </div>
    </aside>
  );
}
