/* ICADEM · Notificaciones push en el teléfono o la computadora del miembro.
   Los avisos y promociones (los correos de la campaña VIP, los créditos de
   regalo y las notificaciones que publica el admin) llegan también a la
   bandeja de notificaciones, como los de cualquier app, aunque el panel esté
   cerrado.
   - A cada cuenta (las que ya existen y las nuevas) se le pregunta una vez
     con una ventana que solo se cierra contestando "Sí" o "No".
   - En "Mi perfil → Notificaciones" hay un interruptor para activarlas o
     desactivarlas cuando quiera.
   - iPhone / iPad: primero hay que agregar ICADEM a la pantalla de inicio
     (Compartir → Agregar a inicio) y abrirlo desde ese ícono. */
(function () {
  'use strict';

  var API = 'https://icadem-webhook-production.up.railway.app';
  var SYNC_KEY = 'icadem:push:synced';
  var soportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var instalada = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

  function leer(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function uid() { return (window.__currentUser && window.__currentUser.uid) || ''; }
  function claveRespuesta() { return 'icadem:push:respuesta:' + uid(); }

  function b64aBytes(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function request(path, body) {
    if (!window.ICADEMPlatform || !window.ICADEMPlatform.request) return Promise.reject(new Error('Tu sesión aún no está lista.'));
    return window.ICADEMPlatform.request(path, { method: 'POST', body: body });
  }

  async function registro() {
    var reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function suscribir() {
    var reg = await registro();
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
    if (!soportado) throw new Error(esIOS && !instalada ? 'En iPhone primero agrega ICADEM a tu pantalla de inicio y ábrelo desde ese ícono.' : 'Este navegador no permite notificaciones.');
    var permiso = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permiso !== 'granted') throw new Error('Las notificaciones quedaron bloqueadas en el navegador. Puedes permitirlas en los ajustes del sitio.');
    await suscribir();
    guardar(claveRespuesta(), 'si');
    return true;
  }

  async function desactivar() {
    guardar(claveRespuesta(), 'no');
    if (!soportado) return;
    var reg = await navigator.serviceWorker.getRegistration();
    var sub = reg && await reg.pushManager.getSubscription();
    if (!sub) return;
    var endpoint = sub.endpoint;
    await sub.unsubscribe().catch(function () {});
    await request('/api/push/unsubscribe', { endpoint: endpoint }).catch(function () {});
  }

  async function activo() {
    if (!soportado || Notification.permission !== 'granted') return false;
    var reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg && await reg.pushManager.getSubscription());
  }

  function estilos() {
    if (document.getElementById('icp-styles')) return;
    var s = document.createElement('style');
    s.id = 'icp-styles';
    s.textContent = [
      '.icp-ov{position:fixed;inset:0;z-index:9400;display:grid;place-items:center;padding:16px;background:rgba(6,14,28,.62);backdrop-filter:blur(4px);opacity:0;transition:opacity .25s ease;font-family:Inter,system-ui,sans-serif}',
      '.icp-ov.is-open{opacity:1}',
      '.icp{width:min(430px,100%);box-sizing:border-box;padding:26px 22px 20px;border-radius:22px;background:#0f1e33;color:#eaf2ff;box-shadow:0 30px 80px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.1);text-align:center;transform:translateY(14px) scale(.98);transition:transform .3s cubic-bezier(.2,.8,.25,1)}',
      '.icp-ov.is-open .icp{transform:none}',
      '.icp__ic{width:64px;height:64px;margin:0 auto 14px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(135deg,#f4c64d,#c98a12);font-size:32px;box-shadow:0 12px 30px rgba(201,138,18,.35)}',
      '.icp h2{margin:0 0 8px;font:800 19px/1.3 "Plus Jakarta Sans",Inter,sans-serif;color:#fff}',
      '.icp p{margin:0 auto;max-width:340px;font-size:13.5px;line-height:1.55;color:#b9c8dc}',
      '.icp ol{margin:14px 0 0;padding:0 0 0 20px;text-align:left;font-size:13.5px;line-height:1.6;color:#d6e2f2}',
      '.icp__acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}',
      '.icp__acts button{height:46px;border-radius:13px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#d6e2f2;font:700 14px Inter,sans-serif;cursor:pointer}',
      '.icp__acts button[data-icp-yes]{background:#f4c64d;border-color:#f4c64d;color:#1a1204}',
      '.icp__acts--one{grid-template-columns:1fr}',
      '.icp__note{display:block;margin-top:12px;font-size:11.5px;color:#8ea2bd}',
      '.icp-switch{position:relative;display:inline-flex;align-items:center;gap:10px;cursor:pointer;font:600 12.5px Inter,sans-serif;color:var(--text-2,#536176)}',
      '.icp-switch input{position:absolute;opacity:0;pointer-events:none}',
      '.icp-switch i{position:relative;width:42px;height:24px;border-radius:999px;background:color-mix(in srgb,var(--text-3,#94a3b8) 45%,transparent);transition:background .2s;flex:none}',
      '.icp-switch i::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}',
      '.icp-switch input:checked + i{background:#34D399}.icp-switch input:checked + i::after{transform:translateX(18px)}',
      '.icp-switch input:disabled + i{opacity:.5}.icp-switch input:focus-visible + i{outline:3px solid color-mix(in srgb,#34D399 45%,transparent);outline-offset:2px}',
      '.icp-hint{display:block;margin-top:6px;font-size:11.5px;line-height:1.5;color:var(--text-3,#78859a);font-weight:500;text-transform:none;letter-spacing:0}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // Ventana que solo se cierra contestando "Sí" o "No"
  function preguntar() {
    if (document.querySelector('.icp-ov')) return;
    estilos();
    var iosSinInstalar = esIOS && !instalada;
    var ov = document.createElement('div');
    ov.className = 'icp-ov';
    ov.setAttribute('role', 'alertdialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'icp-title');
    ov.innerHTML = '<div class="icp"><div class="icp__ic">🔔</div>' +
      '<h2 id="icp-title">¿Quieres recibir avisos de ICADEM?</h2>' +
      '<p>Te llegarán a la bandeja de notificaciones de tu teléfono los beneficios especiales, créditos de regalo y novedades, aunque no tengas el panel abierto.</p>' +
      '<div class="icp__acts"><button type="button" data-icp-no>No, gracias</button><button type="button" data-icp-yes>Sí, activar</button></div>' +
      '<span class="icp__note">Puedes cambiarlo cuando quieras en Mi perfil → Notificaciones.</span></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('is-open'); });
    var card = ov.querySelector('.icp');
    function cerrar() { ov.classList.remove('is-open'); setTimeout(function () { ov.remove(); }, 260); }
    ov.querySelector('[data-icp-no]').addEventListener('click', function () { guardar(claveRespuesta(), 'no'); cerrar(); });
    ov.querySelector('[data-icp-yes]').addEventListener('click', function () {
      if (iosSinInstalar) {
        guardar(claveRespuesta(), 'pendiente-ios');
        card.innerHTML = '<div class="icp__ic">📲</div><h2>Un paso más en tu iPhone</h2><p>Apple solo permite avisos desde la app en tu pantalla de inicio:</p>' +
          '<ol><li>Toca <b>Compartir</b> (el cuadro con la flecha ↑).</li><li>Elige <b>"Agregar a inicio"</b>.</li><li>Abre ICADEM desde ese ícono y toca <b>"Sí, activar"</b>.</li></ol>' +
          '<div class="icp__acts icp__acts--one"><button type="button" data-icp-yes>Entendido</button></div>';
        card.querySelector('[data-icp-yes]').addEventListener('click', cerrar);
        return;
      }
      var btn = ov.querySelector('[data-icp-yes]');
      btn.disabled = true; btn.textContent = 'Activando…';
      activar().then(function () {
        cerrar();
        if (window.Toast) Toast.success('¡Avisos activados!', 'Te llegarán las novedades de ICADEM a este dispositivo.');
      }).catch(function (e) {
        guardar(claveRespuesta(), 'no');
        cerrar();
        if (window.Toast) Toast.info('No se activaron los avisos', e.message);
      });
    });
  }

  function hayVentanaAbierta() {
    return document.querySelector('.modal-backdrop.is-open, .cc-overlay, .rv, .onb-overlay, [data-onboarding-open]');
  }

  function revisar() {
    if (window.__isDemoMode || !uid()) return;
    if (soportado && Notification.permission === 'granted') {
      // Ya aceptó: se mantiene la suscripción al día (una vez al día basta)
      if (leer(claveRespuesta()) !== 'no' && Date.now() - Number(leer(SYNC_KEY) || 0) > 24 * 3600 * 1000) suscribir().catch(function () {});
      return;
    }
    var respuesta = leer(claveRespuesta());
    // Ya contestó (en iPhone se vuelve a preguntar cuando abra la app instalada)
    if (respuesta === 'si' || respuesta === 'no') return;
    if (respuesta === 'pendiente-ios' && !(esIOS && instalada)) return;
    if (soportado && Notification.permission === 'denied') return;
    if (!soportado && !esIOS) return;
    var intentos = 0;
    (function esperar() {
      if (hayVentanaAbierta() && intentos++ < 60) { setTimeout(esperar, 2000); return; }
      preguntar();
    })();
  }

  // Interruptor de "Mi perfil → Notificaciones"
  async function montarInterruptor(container) {
    var card = Array.prototype.slice.call(container.querySelectorAll('.perfil-card')).find(function (c) {
      var t = c.querySelector('.perfil-card__title');
      return t && /notificaciones/i.test(t.textContent);
    });
    if (!card || card.querySelector('[data-push-row]')) return;
    estilos();
    var row = document.createElement('div');
    row.className = 'perfil-field';
    row.setAttribute('data-push-row', '');
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    row.innerHTML = '<span class="perfil-field__lbl" style="flex:1;min-width:0">Avisos en este teléfono<span class="icp-hint" data-push-hint>Promociones, créditos de regalo y novedades en tu bandeja de notificaciones.</span></span>' +
      '<label class="icp-switch"><span data-push-label>Desactivado</span><input type="checkbox" data-push-toggle aria-label="Avisos en este teléfono"><i></i></label>';
    card.querySelector('.perfil-card__title').insertAdjacentElement('afterend', row);
    var input = row.querySelector('[data-push-toggle]');
    var label = row.querySelector('[data-push-label]');
    var hint = row.querySelector('[data-push-hint]');
    function pintar(on) { input.checked = on; label.textContent = on ? 'Activado' : 'Desactivado'; label.style.color = on ? 'var(--success,#34D399)' : ''; }
    var bloqueado = false;
    if (esIOS && !instalada) {
      bloqueado = true;
      hint.innerHTML = 'En iPhone: toca <b>Compartir → "Agregar a inicio"</b>, abre ICADEM desde ese ícono y activa aquí los avisos.';
    } else if (!soportado) {
      bloqueado = true;
      hint.textContent = 'Este navegador no permite notificaciones. Prueba con Chrome, Edge o Safari actualizado.';
    } else if (Notification.permission === 'denied') {
      bloqueado = true;
      hint.textContent = 'Las bloqueaste en el navegador. Permítelas en los ajustes del sitio (el candado junto a la dirección) y vuelve aquí.';
    }
    input.disabled = bloqueado;
    pintar(await activo().catch(function () { return false; }));
    input.addEventListener('change', function () {
      var quiere = input.checked;
      input.disabled = true;
      (quiere ? activar() : desactivar()).then(function () {
        pintar(quiere);
        if (window.Toast) Toast.success(quiere ? 'Avisos activados' : 'Avisos desactivados', quiere ? 'Te llegarán a este dispositivo.' : 'Ya no recibirás avisos en este dispositivo.');
      }).catch(function (e) {
        pintar(false);
        if (window.Toast) Toast.info('No se pudo cambiar', e.message);
      }).finally(function () { input.disabled = false; });
    });
  }

  document.addEventListener('icadem:user-ready', function () { setTimeout(revisar, 4000); });
  if (uid()) setTimeout(revisar, 4000);

  window.ICADEMPush = { activar: activar, desactivar: desactivar, activo: activo, montarInterruptor: montarInterruptor, soportado: soportado };
})();
