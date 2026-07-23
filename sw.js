/*
 * Copyright (c) 2026 HSG Attorneys Incorporated. All rights reserved.
 * Part of HSG Calculator. Unauthorised copying, modification or distribution is prohibited.
 */
/* sw.js — service worker for offline use.
   Bump CACHE when you change files so phones pick up the new version. */
const CACHE = 'hsg-property-v16';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/tariffs.js',
  './js/sharecard.js',
  './tariffs.json',
  './assets/hsg-logo.png',
  './assets/brand/emblem-mask.png',
  './icon/favicon.svg',
  './icon/icon-192.png',
  './icon/icon-512.png',
  './icon/icon-maskable-512.png',
  './icon/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Don't fail the whole install if one optional asset is missing.
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never cache the confidential portal/admin pages — always hit the network so a
  // shared device can't serve a stale or another user's authenticated view.
  if (sameOrigin && url.pathname.includes('/portal/')) return;

  if (sameOrigin) {
    // NETWORK-FIRST for our own HTML/CSS/JS so updated code AND fee tables always
    // reach users when online; fall back to the cache when offline.
    e.respondWith(
      fetch(req).then((res) => {
        // Only cache genuine successes — never poison the cache with a 404/500.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match(req).then((hit) =>
          hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
        )
      )
    );
    return;
  }

  // Cross-origin (e.g. Google Fonts): cache-first.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        // Only cache real, readable successes: skip opaque (status 0) and errors,
        // so a captive-portal/MITM/transient bad body can't be pinned forever.
        if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit)
    )
  );
});
