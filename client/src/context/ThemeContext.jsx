import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/*
 * Theme.
 *
 * The same screen is read at an outpatient counter in tropical daylight and on
 * a ward at three in the morning. "Day" is the default because that is where
 * most of the workload sits and a dark screen behaves like a mirror under a
 * bright window. "Night" exists so the ward screen stops being the brightest
 * object in an unlit room. "Auto" follows whatever the laptop is set to.
 *
 * The choice is stored on the device, not on the server, so each machine in the
 * clinic keeps its own setting. A shared reception laptop can stay on day while
 * the ward tablet stays on night.
 */

const STORAGE_KEY = 'lloyds_theme_preference';
const ACCENT_KEY = 'lloyds_theme_accent';
const TEXT_KEY = 'lloyds_text_size';
const ThemeContext = createContext(null);

export const THEME_OPTIONS = [
  { value: 'light', label: 'Day', detail: 'Built for daylight at the counter' },
  { value: 'dark', label: 'Night', detail: 'Built for the ward after dark' },
  { value: 'auto', label: 'Auto', detail: 'Follows the device setting' }
];

/*
 * The accent carries the facility's identity. It is applied to navigation, the
 * header band and the primary button, and never to a panel reporting a
 * clinical figure, so changing it cannot change what a colour means on a chart.
 */
export const ACCENT_OPTIONS = [
  { value: 'lloyds', label: 'Lloyds red', swatch: '#C8102E' },
  { value: 'ocean', label: 'Clinical blue', swatch: '#155CA8' },
  { value: 'teal', label: 'Deep teal', swatch: '#0C6A64' },
  { value: 'graphite', label: 'Graphite', swatch: '#334152' }
];

/*
 * Text size. A reception laptop is read from arm's length; a ward tablet is
 * read at the foot of a bed by somebody who left their glasses at the desk.
 * The whole interface scales together so nothing overlaps or clips.
 */
export const TEXT_OPTIONS = [
  { value: 'normal', label: 'Normal', detail: 'Fits the most on screen' },
  { value: 'large', label: 'Large', detail: 'Easier from arm\'s length' },
  { value: 'larger', label: 'Largest', detail: 'For a tablet at the bedside' }
];

function readStoredTextSize() {
  try {
    const saved = localStorage.getItem(TEXT_KEY);
    if (TEXT_OPTIONS.some((o) => o.value === saved)) return saved;
  } catch (err) {
    // Fall through to normal.
  }
  return 'normal';
}

function readStoredPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  } catch (err) {
    // Private browsing or a locked-down profile. Fall through to the default.
  }
  return 'light';
}

function readStoredAccent() {
  try {
    const saved = localStorage.getItem(ACCENT_KEY);
    if (ACCENT_OPTIONS.some((o) => o.value === saved)) return saved;
  } catch (err) {
    // Fall through to the brand default.
  }
  return 'lloyds';
}

function systemPrefersDark() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStoredPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [accent, setAccentState] = useState(readStoredAccent);
  const [textSize, setTextSizeState] = useState(readStoredTextSize);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => setSystemDark(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  const theme = preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.textsize = textSize;
  }, [textSize]);

  const setTextSize = useCallback((next) => {
    setTextSizeState(next);
    try {
      localStorage.setItem(TEXT_KEY, next);
    } catch (err) {
      // Applies for this session even if it cannot be saved.
    }
  }, []);

  const setAccent = useCallback((next) => {
    setAccentState(next);
    try {
      localStorage.setItem(ACCENT_KEY, next);
    } catch (err) {
      // The accent still applies for this session even if it cannot be saved.
    }
  }, []);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      // The setting still applies for this session even if it cannot be saved.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark');
  }, [setPreference, theme]);

  const value = useMemo(
    () => ({ theme, preference, setPreference, toggleTheme, accent, setAccent, textSize, setTextSize }),
    [theme, preference, setPreference, toggleTheme, accent, setAccent, textSize, setTextSize]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return context;
}
