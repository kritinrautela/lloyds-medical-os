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

// Both are filled in by the build (see vite.config.js). The cache name
// changes with every build, so a new version never mixes with the last.
const BUILD = '9a9f881e9a5b';
const CACHE = `lloyds-clinic-${BUILD}`;

// The shell, plus every file of this build so a tablet is complete from the
// first open rather than only after each screen has been visited once.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
const PRECACHE = ["/assets/CloudSync-CBqUasPi.js","/assets/Dashboard-D-6JjoJj.js","/assets/DispensePOS-C6CfiWr9.js","/assets/EndOfDay-DAPy0jHS.js","/assets/ExcelExport-CQ5495Ep.js","/assets/OPDQueue-B_cral9B.js","/assets/Patients-Be7vW_8i.js","/assets/Pharmacy-BN427tuJ.js","/assets/PrescriptionLabels-C8HEKYMC.js","/assets/PrintFrame-Cc6Vz9b7.js","/assets/PrintableReferralLetter-B6Ekrpyx.js","/assets/QueueTicket-Ciel3ZC5.js","/assets/Registers-DhM846cv.js","/assets/ReturnSlip-Y8Z0Ar7p.js","/assets/Settings-BaK_7L_9.js","/assets/StaffManagement-zq2kmwWt.js","/assets/WaitingRoom-CndPIOT7.js","/assets/icons-Cj-YZm-r.js","/assets/index-DkQUqn4g.js","/assets/index-edbHEm9z.css","/assets/react-DFxuOQef.js"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(
        SHELL.concat(PRECACHE).map((file) => cache.add(file).catch(() => undefined))
      ))
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
  // Matching ignores any Vary header the server may add, since a same-origin
  // script fetch carries an Origin header that would otherwise never match.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => {
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
