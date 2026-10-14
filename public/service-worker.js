// public/service-worker.js — Samuhia Desk
//
// BUILD_ID and PRECACHE_ASSETS are stamped at build time by tools/vite-plugin-pwa-sw.ts.
// The placeholders below stay as-is in source (and in `vite dev`, where this file is not registered).
//
// Update policy: a new worker installs in the background and WAITS. It only takes over when the
// app posts SKIP_WAITING after the user taps "Update" (see src/pwa/pwaManager.ts). It never calls
// skipWaiting() on its own, so nobody gets a new version swapped in under them mid-OTP or mid-checkout.
const BUILD_ID = /*__BUILD_ID__*/ 'dev';
const PRECACHE_ASSETS = /*__PRECACHE_ASSETS__*/ [];

const STATIC_CACHE = `desk-static-${BUILD_ID}`; // app shell + hashed build files, replaced per build
const RUNTIME_CACHE = 'desk-runtime-v3';         // icons and other same-origin runtime fetches
const LEGACY_CACHES = ['desk-shell-v2', 'desk-runtime-v2'];

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/manifest-icon-192.maskable.png',
  '/icons/manifest-icon-512.maskable.png',
  '/icons/apple-icon-180.png'
];

// ───────────────────────────── lifecycle ─────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // allSettled: one missing optional file must not abort the whole install
    await Promise.allSettled(
      [...APP_SHELL, ...PRECACHE_ASSETS].map((url) => cache.add(new Request(url, { cache: 'reload' })))
    );
    // No skipWaiting() here on purpose — see the update policy above.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => !keep.has(n) && (n.startsWith('desk-static-') || LEGACY_CACHES.includes(n)))
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_VERSION') {
    event.ports[0] && event.ports[0].postMessage({ buildId: BUILD_ID });
  } else if (data.type === 'CACHE_URLS' && Array.isArray(data.payload)) {
    event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.addAll(data.payload)));
  }
});

// ─────────────────────────────── fetch ───────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  // Cross-origin (Firebase, Paystack, Google sign-in, APIs …) always goes straight to the network.
  if (url.origin !== self.location.origin) return;
  // Firebase Auth helper pages and the worker script itself are never served from cache.
  if (url.pathname.startsWith('/__/') || url.pathname === '/service-worker.js') return;

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(req));
  } else if (url.pathname.startsWith('/assets/')) {
    // Hashed, immutable build files
    event.respondWith(cacheFirst(req, STATIC_CACHE));
  } else if (['image', 'font', 'manifest'].includes(req.destination)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
  }
});

// Navigations: network first so a deploy is seen immediately; the cached shell is the offline fallback.
async function handleNavigation(req) {
  try {
    return await fetch(req);
  } catch (_) {
    const cache = await caches.open(STATIC_CACHE);
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}
