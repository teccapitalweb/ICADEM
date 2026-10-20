/* Métricas ICADEM (mismo modelo que IMFRA y Synova).
   Una sesión por pestaña, sin cookies de terceros ni IP: cada minuto visible
   se envía un pulso con la sección actual. Al cambiar de sección, ocultar la
   pestaña o salir se manda el tiempo pendiente. También se recuerda de dónde
   llegó el visitante (Facebook, Instagram, WhatsApp, Google, campaña utm) para
   saber qué canal trae más gente. Los administradores no se cuentan. */
(function () {
  'use strict';
  var API = 'https://icadem-webhook-production.up.railway.app';
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname.endsWith('.localhost');
  var IDLE = 30 * 60 * 1000;
  var TOUCH_DAYS = 30;
  var OWN = /(^|\.)icademx\.com$/i;
  var path = location.pathname;
  var area = /vip-panel/.test(path) ? 'panel' : /vip-auth/.test(path) ? 'auth' : 'web';
  if (/vip-admin/.test(path)) return;

  function randomId() {
    return (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)).toLowerCase();
  }
  function stored(store, key) {
    try { var v = store.getItem(key); if (!v) { v = randomId(); store.setItem(key, v); } return v; } catch (_) { return randomId(); }
  }
  function sessionId() {
    var key = 'icadem:analytics:sid:' + area;
    try {
      var at = Number(sessionStorage.getItem(key + ':at') || 0);
      if (at && Date.now() - at > IDLE) sessionStorage.removeItem(key);
      sessionStorage.setItem(key + ':at', String(Date.now()));
    } catch (_) {}
    return stored(sessionStorage, key);
  }

  // Origen del visitante: el último canal externo (o campaña utm) en 30 días.
  var touch = (function () {
    var key = 'icadem:analytics:touch';
    var params = new URLSearchParams(location.search);
    var utm = (params.get('utm_source') || params.get('fbclid') && 'facebook' || params.get('gclid') && 'google' || '').toLowerCase().slice(0, 40);
    var camp = (params.get('utm_campaign') || '').toLowerCase().slice(0, 60);
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (_) { ref = ''; }
    if (OWN.test(ref)) ref = '';
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { saved = null; }
    if (saved && Date.now() - (saved.at || 0) > TOUCH_DAYS * 86400000) saved = null;
    if (utm || ref) {
      saved = { utm: utm, camp: camp, ref: ref, at: Date.now() };
      try { localStorage.setItem(key, JSON.stringify(saved)); } catch (_) {}
    }
    return saved || { utm: '', camp: '', ref: '' };
  })();
  var pwa = false;
  try { pwa = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (_) {}
  var touchScreen = (navigator.maxTouchPoints || 0) > 1;

  function section() {
    if (area === 'panel') {
      var s = '';
      try { s = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (_) { s = ''; }
      return s || 'inicio';
    }
    if (area === 'auth') return 'acceso';
    var page = path.replace(/^\/+|\.html$/g, '').replace(/\//g, '-');
    return !page || page === 'index' ? 'inicio' : page;
  }
  function item() {
    return area === 'panel' && /^(curso-detalle|clase-detalle)$/.test(currentSection) ? String(window.__cursoActualId || '') : '';
  }

  var visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
  var pending = 0;
  var currentSection = section();
  var currentItem = item();
  var cachedToken = '';
  var firstBeat = true;
  var sending = false;

  function warmToken(attempts) {
    if (area !== 'panel' || cachedToken) return;
    var user = window.__currentUser;
    if (user && user.getIdToken) { user.getIdToken().then(function (t) { if (t) cachedToken = t; }).catch(function () {}); return; }
    if (attempts > 0) setTimeout(function () { warmToken(attempts - 1); }, 250);
  }
  function collect() {
    if (visibleSince) {
      pending += (performance.now() - visibleSince) / 1000;
      visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
    }
  }
  async function send(final) {
    collect();
    var delta = Math.round(pending);
    if (delta < 1 && !final) return;
    if (sending && !final) { pending += delta; return; }
    pending = 0;
    var body = JSON.stringify({
      sid: sessionId(), vid: stored(localStorage, 'icadem:analytics:vid'), area: area,
      section: currentSection, item: currentItem, delta: delta,
      ref: touch.ref, utm: touch.utm, camp: touch.camp, pwa: pwa, touch: touchScreen,
      first: firstBeat
    });
    var url = (window.WEBHOOK_URL || API) + '/analytics/beat';
    try {
      sending = !final;
      var token = '';
      if (area === 'panel') {
        if (!final && window.__currentUser && window.__currentUser.getIdToken) {
          token = await window.__currentUser.getIdToken();
          if (token) cachedToken = token;
        } else token = cachedToken;
      }
      if (final && !token && navigator.sendBeacon) { navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' })); return; }
      await fetch(url, {
        method: 'POST', keepalive: true, body: body,
        headers: token ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } : { 'Content-Type': 'text/plain' }
      });
      firstBeat = false;
    } catch (_) { pending += delta; /* una señal perdida no afecta al usuario */ }
    finally { sending = false; }
  }
  function move() {
    if (area !== 'panel') return;
    var next = section();
    var nextItem;
    // El curso abierto se fija al navegar; se lee después de cambiar la sección.
    setTimeout(function () {
      nextItem = /^(curso-detalle|clase-detalle)$/.test(next) ? String(window.__cursoActualId || '') : '';
      if (next === currentSection && nextItem === currentItem) return;
      void send(false);
      currentSection = next;
      currentItem = nextItem;
    }, 0);
  }

  if (!LOCAL || window.__ICADEM_ANALYTICS_TEST) {
    warmToken(40);
    setTimeout(function () { currentItem = item(); void send(false); }, 4000);
    // Diez minutos conservan una medición útil sin consumir una lectura y una
    // escritura por minuto por cada pestaña abierta.
    setInterval(function () { if (document.visibilityState === 'visible') void send(false); }, 600000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { void send(true); }
      else visibleSince = performance.now();
    });
    window.addEventListener('pagehide', function () { void send(true); });
    window.addEventListener('hashchange', move);
    window.addEventListener('popstate', move);
    window.addEventListener('icadem:navigation', move);
  }
  window.__icademAnalytics = { flush: function () { return send(false); } };
})();
