/* ICADEM VIP · Service Worker */
const CACHE = 'icadem-vip-v183';
const SHELL = [
  './vip-panel.html',
  './js/icadem-session.js?v=3',
  './js/icadem-course-ratings.js?v=7',
  './js/icadem-credit-rewards.js?v=1',
  './js/icadem-commission-conversion.js?v=1',
  './js/icadem-lesson-notes.js?v=1',
  './css/icadem-credit-rewards.css?v=1',
  './css/icadem-commission-conversion.css?v=1',
  './js/icadem-dialog-focus.js?v=1',
  './css/icadem-session.css?v=2',
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
  './js/icadem-platform-v2.js?v=55',
  './js/icadem-course-unlocks.js?v=7',
  './css/icadem-course-unlocks.css?v=4',
  './css/icadem-contacts.css?v=1',
  './js/icadem-learning-route.js?v=4',
  './js/icadem-learning-navigation.js?v=3',
  './js/icadem-course-sync.js?v=2',
  './css/icadem-learning-route.css?v=2',
  './js/icadem-resource-viewer.js?v=1',
  './js/icadem-push.js?v=4',
  './js/icadem-ambassadors-vip.js?v=4',
  './js/icadem-ambassadors.js?v=17',
  './css/ambassadors.css?v=8',
  './css/ambassadors-vip.css?v=4',
  './css/icadem-ambassador-promo.css?v=11',
  './js/icadem-ambassador-promo.js?v=12',
  './js/icadem-referral.js?v=2',
  './css/icadem-games-v4.css?v=12',
  './css/panel-minimal.css?v=31',
  './css/vip-banner.css?v=3',
  './css/icadem-home.css?v=8',
  './css/icadem-courses.css?v=13',
  './css/icadem-live.css?v=2',
  './css/icadem-tools.css?v=2',
  './css/icadem-support-premium.css?v=2',
  './js/icadem-support-ui.js?v=2',
  './js/icadem-support-member.js?v=4',
  './css/icadem-credits.css?v=2',
  './css/icadem-directory.css?v=3',
  './js/icadem-directory.js?v=2',
  './js/icadem-community.js?v=12',
  './js/icadem-professional-navigation.js?v=9',
  './js/icadem-forum-authors.js?v=1',
  './js/icadem-cv-languages.js?v=1',
  './js/icadem-professional-profile.js?v=7',
  './css/icadem-professional-profile.css?v=4',
  './css/icadem-professional-activity.css?v=3',
  './js/icadem-professional-activity.js?v=3',
  './js/icadem-professional-network.js?v=3',
  './css/icadem-professional-network.css?v=3',
  './js/icadem-post-style.js?v=2',
  './css/icadem-post-style.css?v=3',
  './js/icadem-resume-editor.js?v=4',
  './css/icadem-resume-editor.css?v=3',
  './js/icadem-notifications.js?v=3',
  './css/icadem-community.css?v=1',
  './css/icadem-course-detail.css?v=4',
  './assets/credit-coin.svg',
  './js/icadem-home.js?v=3',
  './js/icadem-vip-banner.js?v=2',
  './assets/logo/icadem-wordmark.png?v=1',
  './js/icadem-onboarding.js?v=23',
  './css/icadem-ciudad.css?v=1',
  './js/icadem-ciudad.js?v=16'
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
  // Protected APIs stay server-authoritative, even behind a future same-origin alias.
  if(req.headers.has('Authorization')||/^\/(?:api|admin|membership|stripe|webhook)(?:\/|$)/.test(url.pathname))return;
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
  // Ciudad ICADEM: sus módulos no llevan versión en el nombre; se piden a la red validando con el
  // servidor (no-cache) para no mezclar archivos de dos versiones del juego. Sin red, la caché.
  if (url.origin === location.origin && url.pathname.includes('/ciudad/')) {
    // Un error momentáneo del servidor (5xx) no debe dejar el juego a medio cargar: se reintenta sin caché
    // y, si sigue fallando, se usa la copia guardada (si la hay).
    const keep = (r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; };
    const retry = (r) => !(r.status >= 500) ? r : fetch(req, { cache: 'reload' }).then((r2) => !(r2.status >= 500) ? r2 : caches.match(req).then((m) => m || r2));
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(retry).then(keep).catch(() => caches.match(req)));
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
