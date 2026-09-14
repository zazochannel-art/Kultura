/*
 * MONEYFLOW service worker.
 *
 * Financial data goes stale the moment it is cached, so nothing that carries a
 * balance is served from the cache while the network is reachable: navigations
 * and API calls are network-first, and the cache exists to keep the app
 * installable and to show an honest "you are offline" page instead of the
 * browser's dinosaur. Static build output, which is immutable by URL, is
 * cache-first.
 */

var CACHE = 'moneyflow-v1';
var OFFLINE_URL = '/offline.html';

var PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return cache.addAll(PRECACHE);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return key === CACHE ? undefined : caches.delete(key);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache anything that talks to the database or the auth session.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(OFFLINE_URL).then(function (cached) {
          return cached || new Response('', { status: 503 });
        });
      })
    );
    return;
  }

  // Build output is content-hashed, so a cache hit can never be the wrong file.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(request, copy);
            });
          }
          return response;
        });
      })
    );
  }
});
