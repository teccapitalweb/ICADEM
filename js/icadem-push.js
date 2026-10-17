/* ICADEM · Notificaciones push en el teléfono o la computadora del miembro.
   Los avisos y promociones (por ejemplo, los correos de la campaña VIP o los
   créditos de regalo) llegan también a la bandeja de notificaciones, como los
   de cualquier app, aunque el panel esté cerrado.
   - Android / computadora: basta con aceptar el permiso.
   - iPhone / iPad: primero hay que agregar ICADEM a la pantalla de inicio
     (Compartir → Agregar a inicio) y abrirlo desde ese ícono. */
(function () {
  'use strict';

  var API = 'https://icadem-webhook-production.up.railway.app';
  var DISMISS_KEY = 'icadem:push:dismissed';
  var SYNC_KEY = 'icadem:push:synced';
  var soportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var instalada = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

  function leer(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  function b64aBytes(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function request(path, body) {
    if (!window.ICADEMPlatform || !window.ICADEMPlatform.request) return Promise.reject(new Error('Sesión no lista'));
    return window.ICADEMPlatform.request(path, { method: 'POST', body: body });
  }

  async function suscribir() {
    var reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      var r = await fetch(API + '/api/push/key', { cache: 'no-store' });
      var j = await r.json();
      if (!r.ok || !j.publicKey) throw new Error(j.error || 'Las notificaciones no están disponibles por ahora.');
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(j.publicKey) });
    }
    await request('/api/push/subscribe', { subscription: sub.toJSON() });
    guardar(SYNC_KEY, String(Date.now()));
    return sub;
  }

  async function activar() {
    if (!soportado) throw new Error(esIOS && !instalada ? 'En iPhone primero agrega ICADEM a tu pantalla de inicio.' : 'Tu navegador no permite notificaciones.');
    var permiso = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permiso !== 'granted') throw new Error('Las notificaciones quedaron bloqueadas. Puedes activarlas en los ajustes del navegador.');
    await suscribir();
    return true;
  }

  function estilos() {
    if (document.getElementById('icp-styles')) return;
    var s = document.createElement('style');
    s.id = 'icp-styles';
    s.textContent = '.icp{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translate(-50%,24px);z-index:9200;width:min(440px,calc(100% - 24px));box-sizing:border-box;display:grid;grid-template-columns:44px 1fr;gap:12px;padding:16px;border-radius:18px;background:#0f1e33;color:#eaf2ff;box-shadow:0 18px 50px rgba(5,15,35,.35);border:1px solid rgba(255,255,255,.1);opacity:0;transition:.3s cubic-bezier(.2,.8,.25,1);font-family:Inter,system-ui,sans-serif}' +
      '.icp.is-open{opacity:1;transform:translate(-50%,0)}' +
      '.icp__ic{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#f4c64d,#c98a12);font-size:22px}' +
      '.icp strong{display:block;font:800 14.5px/1.3 "Plus Jakarta Sans",Inter,sans-serif;margin-bottom:3px}.icp p{margin:0;font-size:12.5px;line-height:1.5;color:#b9c8dc}' +
      '.icp__acts{grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end;margin-top:2px}' +
      '.icp__acts button{height:36px;padding:0 14px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#cfdcef;font:700 12.5px Inter,sans-serif;cursor:pointer}' +
      '.icp__acts button[data-icp-yes]{background:#f4c64d;border-color:#f4c64d;color:#1a1204}' +
      '@media(min-width:900px){.icp{bottom:24px;left:auto;right:24px;transform:translateY(24px)}.icp.is-open{transform:none}}';
    document.head.appendChild(s);
  }

  function tarjeta(modo) {
    if (document.querySelector('.icp')) return;
    estilos();
    var el = document.createElement('div');
    el.className = 'icp';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Notificaciones de ICADEM');
    el.innerHTML = modo === 'ios'
      ? '<span class="icp__ic">🔔</span><div><strong>Recibe los avisos de ICADEM en tu iPhone</strong><p>Toca <b>Compartir</b> y luego <b>"Agregar a inicio"</b>. Abre ICADEM desde ese ícono y activa las notificaciones para no perderte promociones ni créditos de regalo.</p></div><div class="icp__acts"><button type="button" data-icp-no>Entendido</button></div>'
      : '<span class="icp__ic">🔔</span><div><strong>¿Te avisamos de promociones y novedades?</strong><p>Recibe en tu teléfono los beneficios especiales, créditos de regalo y avisos de ICADEM, aunque no tengas el panel abierto.</p></div><div class="icp__acts"><button type="button" data-icp-no>Ahora no</button><button type="button" data-icp-yes>Activar avisos</button></div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-open'); });
    function cerrar() { el.classList.remove('is-open'); setTimeout(function () { el.remove(); }, 320); }
    el.querySelector('[data-icp-no]').addEventListener('click', function () { guardar(DISMISS_KEY, String(Date.now())); cerrar(); });
    var yes = el.querySelector('[data-icp-yes]');
    if (yes) yes.addEventListener('click', function () {
      yes.disabled = true; yes.textContent = 'Activando…';
      activar().then(function () {
        cerrar();
        if (window.Toast) Toast.success('¡Avisos activados!', 'Te llegarán las novedades de ICADEM a este dispositivo.');
      }).catch(function (e) {
        guardar(DISMISS_KEY, String(Date.now()));
        cerrar();
        if (window.Toast) Toast.info('No se activaron los avisos', e.message);
      });
    });
  }

  function hayVentanaAbierta() {
    return document.querySelector('.modal-backdrop.is-open, .cc-overlay, .rv, .onb-overlay, [data-onboarding-open]');
  }

  function revisar() {
    if (window.__isDemoMode || !window.__currentUser) return;
    if (soportado && Notification.permission === 'granted') {
      // Ya aceptó: se mantiene la suscripción al día (una vez al día basta)
      if (Date.now() - Number(leer(SYNC_KEY) || 0) > 24 * 3600 * 1000) suscribir().catch(function () {});
      return;
    }
    var antes = Number(leer(DISMISS_KEY) || 0);
    if (Date.now() - antes < 7 * 24 * 3600 * 1000) return;
    var modo = soportado && Notification.permission === 'default' ? 'normal' : (esIOS && !instalada ? 'ios' : '');
    if (!modo) return;
    var intentos = 0;
    (function esperar() {
      if (hayVentanaAbierta() && intentos++ < 30) { setTimeout(esperar, 2000); return; }
      tarjeta(modo);
    })();
  }

  document.addEventListener('icadem:user-ready', function () { setTimeout(revisar, 6000); });
  if (window.__currentUser) setTimeout(revisar, 6000);

  window.ICADEMPush = { activar: activar, soportado: soportado };
})();
