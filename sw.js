// Kultura service worker.
// Strategy: network-first for everything same-origin (the app must never be
// stale), falling back to the last cached copy when offline. Bump the cache
// version to invalidate old entries after a deploy.
const CACHE = 'kultura-v2';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './i18n.js',
  './vendor/supabase-js.mjs',
  './manifest.json',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
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
  // Never intercept API traffic (Supabase, fonts, etc.) — only same-origin GET.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) =>
          hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
        )
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
