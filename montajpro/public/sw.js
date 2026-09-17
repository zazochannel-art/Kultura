/*
 * Service worker MontajPro.
 *
 * Scopul e simplu: aplicația trebuie să pornească și fără semnal, pentru că se
 * folosește pe șantier. Datele sunt oricum în IndexedDB — aici ținem doar
 * „carcasa” aplicației (HTML, JS, CSS, iconițe).
 *
 * Strategii:
 *   - navigări: rețea întâi, cu revenire la cache și, în ultimă instanță, la
 *     pagina /offline.html;
 *   - fișiere /_next/static: cache întâi (au hash în nume, nu se schimbă);
 *   - restul GET-urilor de pe același domeniu: cache cu reîmprospătare în
 *     fundal.
 *
 * Cererile către Supabase nu sunt atinse: sincronizarea își face treaba singură.
 */

const VERSION = 'montajpro-v2';
const SHELL_CACHE = VERSION + '-shell';
const ASSET_CACHE = VERSION + '-assets';
const OFFLINE_URL = '/offline.html';

const SHELL_FILES = [
  // Ecranul principal este pus în cache din start: dacă utilizatorul deschide
  // offline o adresă nevizitată, are de unde reporni aplicația.
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.indexOf(VERSION) !== 0)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.indexOf('/_next/static/') === 0 ||
    url.pathname.indexOf('/icons/') === 0 ||
    /\.(css|js|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigările: rețea întâi, ca utilizatorul să vadă mereu ultima versiune.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
