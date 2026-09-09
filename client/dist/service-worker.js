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
const BUILD = '8d8b58eaa58b';
const CACHE = `lloyds-clinic-${BUILD}`;

// The shell, plus every file of this build so a tablet is complete from the
// first open rather than only after each screen has been visited once.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
const PRECACHE = ["/assets/CloudSync-BVu20ep0.js","/assets/Dashboard-kG0ZY2EE.js","/assets/DispensePOS-Bf8yWEB9.js","/assets/EndOfDay-CRTE-kWr.js","/assets/ExcelExport-Bh-fqzYY.js","/assets/OPDQueue-Dznlnk0j.js","/assets/Patients-BGaib7dk.js","/assets/Pharmacy-CHThIZhq.js","/assets/PrescriptionLabels-3UhKTFpK.js","/assets/PrintFrame-Dj3rmUh9.js","/assets/PrintableReferralLetter-CdqzbL8m.js","/assets/QueueTicket-B4EeKi33.js","/assets/Registers-DXGFrDOn.js","/assets/ReturnSlip-BG9QXTDn.js","/assets/Settings-BKcVzTum.js","/assets/StaffManagement-T-wjYaNZ.js","/assets/WaitingRoom-Dab93p2s.js","/assets/archivo-latin-ext-wght-normal-C4zznr8T.woff2","/assets/archivo-latin-wght-normal-E0tuGl4L.woff2","/assets/archivo-vietnamese-wght-normal-XAtsl5Q_.woff2","/assets/icons-hphYEHg6.js","/assets/index-CkDxaTuU.css","/assets/index-ZUVBESQ1.js","/assets/react-B5ooVc94.js"];

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
