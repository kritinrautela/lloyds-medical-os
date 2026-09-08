import React, { lazy } from 'react';

/*
 * React.lazy remembers a failed import for good: once a chunk could not be
 * fetched, every later render throws the same error even after the network
 * is back. Each screen therefore renders through a thin wrapper that can be
 * handed a fresh lazy component, so "Try again" genuinely tries again.
 *
 * A first failure is retried once on its own after a short pause, which
 * covers the Wi-Fi blip that lasts a second. Only a second failure reaches
 * the error boundary.
 */
const registry = [];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * The browser remembers a module that failed to fetch for the life of the
 * page, so a plain second import() of it fails at once without touching the
 * network. The retry asks for the same file under a fresh query string, which
 * the browser treats as a new module; the build's content hash keeps it the
 * right file, and its shared imports resolve to the copies already loaded.
 */
function importAfresh(error) {
  const match = /(https?:\/\/[^\s'"?]+\.(?:jsx|tsx|m?js|ts))(\?[^\s'"]*)?/.exec(String(error && error.message));
  if (!match) throw error;
  const url = match[1] + (match[2] ? match[2] + '&' : '?') + 'retry=' + Date.now();
  return import(/* @vite-ignore */ url);
}

function attempt(entry) {
  return entry.loader()
    .catch((error) => wait(800).then(() => importAfresh(error)))
    .catch((error) => {
      entry.failed = true;
      throw error;
    });
}

export function screen(loader) {
  const entry = { loader, failed: false, Component: null };
  entry.Component = lazy(() => attempt(entry));
  registry.push(entry);
  function Screen(props) {
    const Current = entry.Component;
    return <Current {...props} />;
  }
  return Screen;
}

// Gives every screen that failed to load a fresh start. Screens that loaded
// fine are left alone, so nothing on the desk flickers.
export function resetFailedScreens() {
  registry.forEach((entry) => {
    if (!entry.failed) return;
    entry.failed = false;
    entry.Component = lazy(() => attempt(entry));
  });
}

/*
 * Once the desk is open, the other screens are fetched quietly in the
 * background so the service worker has every one of them cached. A tablet
 * that later loses the Wi-Fi can still open the queue or the register it has
 * never visited, and the second visit to any screen is instant.
 */
export function warmScreens() {
  const run = () => registry.forEach((entry) => entry.loader().catch(() => {}));
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 8000 });
  else window.setTimeout(run, 3000);
}
