/* ICADEM VIP · Service Worker */
const CACHE = 'icadem-vip-v4';
const SHELL = [
  './vip-panel.html',
  './vip-auth.html',
  './index.html',
  './manifest.json?v=20260815',
  './icon-192.png?v=20260815',
  './icon-512.png?v=20260815',
  './icon-maskable-512.png?v=20260815',
  './apple-touch-icon.png?v=20260815'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
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
  // No cachear datos en vivo (Firebase, Stripe, Railway, Google APIs)
  if (/firebaseio|firestore|googleapis|gstatic|stripe|railway|identitytoolkit/.test(url.host)) return;
  // Documentos: network-first (para recibir cambios al instante)
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req).then((m) => m || caches.match('./vip-panel.html')))
    );
    return;
  }
  // Resto (imágenes, css, etc.): cache-first
  e.respondWith(
    caches.match(req).then((m) => m || fetch(req).then((r) => {
      const copy = r.clone();
      if (r.ok && url.origin === location.origin) caches.open(CACHE).then((c) => c.put(req, copy));
      return r;
    }).catch(() => m))
  );
});
