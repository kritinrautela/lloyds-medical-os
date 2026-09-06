import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, Lock, LogOut, Maximize2, Menu, Minimize2, Moon, Plus, Search, Sun, SunMoon, UserCog
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ACCENT_OPTIONS, TEXT_OPTIONS, THEME_OPTIONS, useTheme } from '../context/ThemeContext';

/*
 * Top bar. Identity on the left, the two actions the front desk uses all day
 * in the middle, and the shift controls on the right.
 */

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden text-right xl:block">
      <p className="font-mono text-sm font-semibold leading-tight text-ink">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-2xs leading-tight text-ink-3">
        {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
      </p>
    </div>
  );
}

/*
 * Full screen. The browser's own bars are the one thing on a clinic screen
 * that carries no clinical information, so on a tablet or a reception monitor
 * the interface can take the whole panel. Hidden where the browser does not
 * allow it (an installed home-screen app is already full screen).
 */
function useFullscreen() {
  const supported = typeof document !== 'undefined'
    && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const [active, setActive] = useState(() => !!(document.fullscreenElement || document.webkitFullscreenElement));

  useEffect(() => {
    const sync = () => setActive(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggle = () => {
    const el = document.documentElement;
    if (active) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  };

  return { supported, active, toggle };
}

function ThemeControl() {
  const { theme, preference, setPreference, accent, setAccent, textSize, setTextSize } = useTheme();
  const fullscreen = useFullscreen();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    // Escape closes it too. A menu that only shuts by hitting the same button
    // again strands anyone who opened it by accident.
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const Icon = preference === 'auto' ? SunMoon : theme === 'dark' ? Moon : Sun;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Screen: day or night, text size, full screen"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden md:inline">
          {THEME_OPTIONS.find((o) => o.value === preference)?.label}
        </span>
      </button>

      {open ? (
        <div className="panel absolute right-0 z-50 mt-1.5 w-60 p-1 shadow-overlay" role="menu">
          <p className="px-2.5 py-1.5 text-2xs leading-relaxed text-ink-3">
            Day is easier to read under a bright window. Night stops the screen glaring on the ward.
          </p>
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === option.value}
              onClick={() => setPreference(option.value)}
              className={`flex w-full flex-col items-start rounded px-2.5 py-1.5 text-left transition-colors ${
                preference === option.value ? 'bg-brand-wash' : 'hover:bg-subtle'
              }`}
            >
              <span className="text-xs font-semibold text-ink">{option.label}</span>
              <span className="text-2xs text-ink-3">{option.detail}</span>
            </button>
          ))}

          <div className="mt-1 border-t border-line-soft pt-2">
            <p className="px-2.5 pb-1.5 text-2xs leading-relaxed text-ink-3">
              Text size on this device. Everything scales together, so nothing clips.
            </p>
            <div className="flex gap-1 px-2.5 pb-1" role="radiogroup" aria-label="Text size">
              {TEXT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={textSize === option.value}
                  title={option.detail}
                  onClick={() => setTextSize(option.value)}
                  className={`flex-1 rounded border px-2 py-1.5 text-center text-xs font-semibold transition-colors ${
                    textSize === option.value ? 'border-brand bg-brand-wash text-ink' : 'border-line text-ink-2 hover:bg-subtle'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {fullscreen.supported ? (
            <div className="mt-1 border-t border-line-soft pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => { fullscreen.toggle(); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs font-medium text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
              >
                {fullscreen.active
                  ? <Minimize2 className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                  : <Maximize2 className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />}
                {fullscreen.active ? 'Leave full screen' : 'Use the whole screen'}
              </button>
            </div>
          ) : null}

          <div className="mt-1 border-t border-line-soft pt-2">
            <p className="px-2.5 pb-1.5 text-2xs leading-relaxed text-ink-3">
              Facility colour. Applies to navigation and buttons only, so it never changes what a
              red or amber reading means.
            </p>
            <div className="flex gap-1.5 px-2.5 pb-1">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={accent === option.value}
                  onClick={() => setAccent(option.value)}
                  className={`h-7 w-7 rounded-md border-2 transition-transform hover:scale-105 ${
                    accent === option.value ? 'border-ink' : 'border-line'
                  }`}
                  style={{ backgroundColor: option.swatch }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar({
  onOpenNav,
  settings,
  onQuickSearch,
  onOpenCheckIn,
  onOpenDispense,
  onOpenExport
}) {
  const { currentUser, setIsAuthModalOpen, logout, can } = useAuth();
  const [searchVal, setSearchVal] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const submitSearch = (e) => {
    e.preventDefault();
    onQuickSearch?.(searchVal);
  };

  return (
    <header className="identity-band sticky top-0 z-20 flex h-14 select-none items-center justify-between gap-3 border-b border-line bg-surface px-4 md:px-6">
      {/* The way into the navigation on a phone or narrow tablet. On a laptop
          the navigation is always on screen, so this button is not shown. */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open the navigation"
        aria-controls="primary-navigation"
        className="btn btn-sm shrink-0 lg:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="hidden w-56 min-w-0 shrink-0 lg:block">
        <p className="truncate text-sm font-semibold text-ink">
          {settings?.name || 'Lloyds Medical OS'}
        </p>
        <p className="truncate text-2xs text-ink-3">
          {[settings?.district, settings?.province, settings?.country].filter(Boolean).join(' · ')}
        </p>
      </div>

      <form onSubmit={submitSearch} className="relative mx-2 hidden min-w-0 flex-1 lg:flex">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          id="navbar-quick-search"
          type="search"
          value={searchVal}
          onChange={(e) => { setSearchVal(e.target.value); onQuickSearch?.(e.target.value); }}
          placeholder="Search by patient name, record number or village"
          className="field pl-9"
          aria-label="Search patients"
        />
      </form>

      <div className="flex shrink-0 items-center gap-2">
        <Clock />

        {/* The shortcuts follow the same permissions as the navigation. A
            button that would only produce a refusal is not offered. */}
        {can('queue.checkIn') ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={onOpenCheckIn}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Check in</span>
          </button>
        ) : null}

        {can('dispense.sell') ? (
          <button type="button" className="btn btn-sm hidden xl:inline-flex" onClick={onOpenDispense}>
            Dispense
          </button>
        ) : null}

        {can('export.download') ? (
        <button
          type="button"
          className="btn btn-sm hidden lg:inline-flex"
          onClick={onOpenExport}
          title="Download the password-protected audit workbook"
        >
          <Lock className="h-3 w-3 text-ink-3" aria-hidden="true" />
          <span className="hidden 2xl:inline">Protected export</span>
          <span className="2xl:hidden">Export</span>
        </button>
        ) : null}

        <ThemeControl />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="hidden max-w-[9rem] truncate sm:inline">
              {currentUser?.full_name?.split(' ')[0] || 'Staff'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
          </button>

          {menuOpen ? (
            <div className="panel absolute right-0 z-50 mt-1.5 w-64 shadow-overlay" role="menu">
              <div className="border-b border-line-soft px-3 py-2.5">
                <p className="truncate text-xs font-semibold text-ink">
                  {currentUser?.full_name || 'No staff member signed in'}
                </p>
                <p className="text-2xs text-ink-2">{currentUser?.role || 'Role not set'}</p>
                <p className="mt-0.5 truncate font-mono text-2xs text-ink-3">
                  {currentUser?.staff_id || '—'}
                  {currentUser?.department ? ` · ${currentUser.department}` : ''}
                </p>
              </div>
              <div className="p-1">
                <MenuItem
                  icon={UserCog}
                  label="Hand over to another staff member"
                  onClick={() => { setMenuOpen(false); setIsAuthModalOpen(true); }}
                />
                <MenuItem
                  icon={LogOut}
                  label="Sign out"
                  onClick={() => { setMenuOpen(false); logout(); }}
                />
              </div>
              <p className="border-t border-line-soft px-3 py-2 text-2xs leading-relaxed text-ink-3">
                Everything recorded from this device is recorded under the name above. Hand over at
                the end of your shift so the next person's work is not recorded as yours.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs font-medium text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
    >
      <Icon className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
      {label}
    </button>
  );
}
