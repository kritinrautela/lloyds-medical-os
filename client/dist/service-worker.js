/*
 * The service worker exists so the clinic app opens on an Android tablet the
 * way an installed application does, and keeps opening when the Wi-Fi drops.
 *
 * What it caches is deliberately narrow: the application itself — the HTML,
 * the JavaScript, the stylesheet, the icons. It NEVER caches an API response.
 *
 * That restraint is the whole point. A cached patient list would be a list of
 * patients as they were at some unknown moment in the past, shown with no
 * indication that it is stale, to somebody deciding what medicine to hand over.
 * A clinical system that quietly shows old data is more dangerous than one that
 * says it cannot reach the server, so this one says it cannot reach the server.
 */

const CACHE = 'lloyds-clinic-shell-v1';

// Only the shell. Hashed build assets are added as they are requested.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Clinical data always comes from the server or not at all. It is never
  // served from this cache, and a failure is allowed to be a failure so the
  // interface can say plainly that it could not reach the clinic server.
  if (url.pathname.startsWith('/api/')) return;

  // A navigation is served from the network when there is one, and falls back
  // to the cached shell so the app still opens on a tablet with no signal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // Build assets are content-hashed, so a cached copy is always the right one.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
