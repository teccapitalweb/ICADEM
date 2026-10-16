/* Contador anónimo de visitas · ICADEM (mismo sistema que Alintec Food)
   - Sin cookies y sin guardar la IP: el servidor solo cuenta visitas y visitantes del día.
   - Una visita por página cada 30 minutos (recargar no infla el número).
   - No cuenta pruebas locales (solo icademx.com) ni a quien activó "No rastrear".
   - En el panel solo se envía cuando hay una sesión iniciada; así el administrador
     ve qué miembros entraron. Las personas sin sesión se cuentan en la página de acceso.
   - Origen de los miembros: se recuerda por qué enlace llegó la persona (p. ej. Facebook).
     Mientras dura la pestaña se guarda en sessionStorage; en el dispositivo solo se conserva
     si aceptó las cookies de medición. Al crear la cuenta, el servidor lo asocia a esa cuenta.
   Uso:  <script src="js/icadem-visitas.js" data-pagina="landing" defer></script>
         (páginas: landing, acceso, panel; el panel detecta solo el modo demo)
*/
(function () {
  'use strict';
  var host = location.hostname;
  if (host !== 'icademx.com' && host !== 'www.icademx.com') return;
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  } catch (e) { /* sin acceso: se sigue */ }

  var URL_API = 'https://icadem-webhook-production.up.railway.app/api/v2/visita';
  var VENTANA_MS = 30 * 60 * 1000;
  var CLAVE_ORIGEN = 'icadem_origen_v1';
  var CLAVE_COOKIES = 'icadem:privacy:consent:v1'; // aviso de privacidad de la guía ICADEM
  var etiqueta = document.currentScript && document.currentScript.getAttribute('data-pagina');
  var params = new URLSearchParams(location.search);
  var pagina = etiqueta === 'panel' && params.get('modo') === 'demo' ? 'demo' : etiqueta;
  if (['landing', 'acceso', 'panel', 'demo'].indexOf(pagina) === -1) return;

  function yaContada() {
    try {
      var antes = Number(sessionStorage.getItem('icadem_vis_' + pagina) || 0);
      return antes && Date.now() - antes < VENTANA_MS;
    } catch (e) { return false; }
  }
  function marcar() {
    try { sessionStorage.setItem('icadem_vis_' + pagina, String(Date.now())); } catch (e) { /* modo privado */ }
  }

  // ── Origen del primer contacto ──
  function medicionAceptada() {
    try { if (localStorage.getItem(CLAVE_COOKIES)) return true; } catch (e) { /* bloqueado */ }
    return /(?:^|;\s*)icadem_privacy_consent=1(?:;|$)/.test(document.cookie || '');
  }
  function leerOrigen() {
    var crudo = null;
    try { crudo = localStorage.getItem(CLAVE_ORIGEN); } catch (e) { /* bloqueado */ }
    if (!crudo) { try { crudo = sessionStorage.getItem(CLAVE_ORIGEN); } catch (e) { /* bloqueado */ } }
    try { var o = JSON.parse(crudo || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
  }
  function guardarOrigen(o) {
    var texto = JSON.stringify(o);
    try { sessionStorage.setItem(CLAVE_ORIGEN, texto); } catch (e) { /* modo privado */ }
    if (medicionAceptada()) { try { localStorage.setItem(CLAVE_ORIGEN, texto); } catch (e) { /* modo privado */ } }
  }
  function capturarOrigen() {
    if (leerOrigen()) return;
    var ref = document.referrer || '';
    var utm = (params.get('utm_source') || '').slice(0, 40);
    // Venir de otra página del propio sitio no es un origen: se espera al primer contacto externo
    var interno = false;
    try { interno = !!ref && /(^|\.)icademx\.com$/i.test(new URL(ref).hostname); } catch (e) { interno = false; }
    if (interno && !utm) return;
    guardarOrigen({ ref: ref.slice(0, 300), utm: utm, ua: (navigator.userAgent || '').slice(0, 300), t: Date.now(), fb: params.has('fbclid'), ig: params.has('igshid') || params.has('igsh') });
  }
  // Si acepta las cookies de medición más tarde, el origen ya capturado pasa a quedarse en el dispositivo
  window.addEventListener('icadem:privacy-consent', function () {
    var o = leerOrigen();
    if (o) { try { localStorage.setItem(CLAVE_ORIGEN, JSON.stringify(o)); } catch (err) { /* modo privado */ } }
  });

  function enviar(token) {
    if (yaContada()) return;
    marcar();
    var cabeceras = { 'Content-Type': 'application/json' };
    if (token) cabeceras.Authorization = 'Bearer ' + token;
    var cuerpo = { pagina: pagina, ref: document.referrer || '', utm: params.get('utm_source') || '' };
    // Facebook e Instagram agregan "fbclid" a los enlaces de sus anuncios: sirve de pista del origen
    if (params.has('fbclid')) cuerpo.fbclid = true;
    // Instagram agrega "igshid" o "igsh" a los enlaces que se comparten desde la app
    if (params.has('igshid') || params.has('igsh')) cuerpo.igshid = true;
    // Solo las visitas con sesión llevan el origen: es lo que se asocia a la cuenta
    if (token) { var origen = leerOrigen(); if (origen) cuerpo.origen = origen; }
    try {
      fetch(URL_API, { method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpo), keepalive: true }).catch(function () {});
    } catch (e) { /* las métricas nunca deben estorbar */ }
  }

  if (pagina !== 'panel') capturarOrigen();

  if (pagina === 'panel') {
    // Espera a que Firebase confirme la sesión (hasta ~12 s) para identificar al miembro
    var intentos = 0;
    var espera = setInterval(function () {
      var usuario = window.__currentUser || (window.__auth && window.__auth.currentUser);
      intentos += 1;
      if (usuario && typeof usuario.getIdToken === 'function') {
        clearInterval(espera);
        usuario.getIdToken().then(enviar, function () { enviar(null); });
      } else if (intentos > 24) {
        clearInterval(espera);
      }
    }, 500);
  } else {
    enviar(null);
  }
})();
