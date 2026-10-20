/* ICADEM VIP · Service Worker */
const CACHE = 'icadem-vip-v91';
const SHELL = [
  './vip-panel.html',
  './vip-auth.html',
  './index.html',
  './manifest.json?v=20260817-login',
  './icon-192.png?v=20260815',
  './icon-512.png?v=20260815',
  './icon-maskable-512.png?v=20260815',
  './apple-touch-icon.png?v=20260815',
  './css/platform-v2.css?v=11',
  './css/auth-minimal.css?v=8',
  './js/icadem-mascots.js?v=1',
  './js/icadem-analytics.js?v=4',
  './assistant/icadem-assistant.css?v=1',
  './assistant/icadem-assistant-config.js?v=1',
  './assistant/icadem-assistant-knowledge.js?v=1',
  './assistant/icadem-assistant.js?v=2',
  './assistant/assets/icadem-guide.png',
  './assistant/assets/icadem-guide-blink.png',
  './privacidad.html',
  './js/icadem-platform-v2.js?v=44',
  './js/icadem-resource-viewer.js?v=1',
  './js/icadem-push.js?v=3',
  './css/icadem-games-v4.css?v=11',
  './css/panel-minimal.css?v=31',
  './assets/logo/icadem-wordmark.png?v=1',
  './js/icadem-onboarding.js?v=18'
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
      }).catch(() => caches.match(req).then((m) => m || caches.match('./vip-auth.html')))
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

// ── Notificaciones push (avisos y promociones de ICADEM en la bandeja del teléfono) ──
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'ICADEM';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: './icon-192.png?v=20260815',
    badge: './icon-192.png?v=20260815',
    tag: data.tag || 'icadem',
    renotify: true,
    data: { url: data.url || './vip-panel.html' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './vip-panel.html', self.location.href).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.navigate(target).then((c) => (c || client).focus()).catch(() => client.focus());
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
