// Kultura service worker.
// Strategy: stale-while-revalidate for same-origin GETs. The app shell is
// served from cache immediately (instant startup), while a fresh copy is
// fetched in the background and used on the next load. Bump the cache version
// to force a clean refresh after a deploy.
const CACHE = 'kultura-v5';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './utils.js',
  './i18n.js',
  './vendor/supabase-js.mjs',
  './manifest.json',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/fonts/fonts.css',
  './vendor/fonts/inter-400.woff2',
  './vendor/fonts/inter-500.woff2',
  './vendor/fonts/inter-600.woff2',
  './vendor/fonts/inter-700.woff2',
  './vendor/fonts/inter-800.woff2',
  './vendor/fonts/inter-900.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    // Precache best-effort: a single missing asset must not abort the install.
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never intercept API traffic (Supabase, etc.) — only same-origin GET.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Stale-while-revalidate: answer instantly from cache, refresh in the
  // background for next time. Falls back to the network (then the cached
  // shell) when there's no cached copy yet.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const network = fetch(e.request)
          .then((res) => {
            if (res && res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => null);
        return (
          cached ||
          network.then((res) =>
            res || (e.request.mode === 'navigate' ? cache.match('./index.html') : Response.error())
          )
        );
      })
    )
  );
});

// ----- WEB PUSH -----
// Show the notification pushed by the send-push Edge Function.
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {}
  const title = data.title || 'Kultura';
  const options = {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: data.tag || 'kultura-push',
    data: { url: data.url || './index.html' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab (or open one) when a notification is tapped.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
