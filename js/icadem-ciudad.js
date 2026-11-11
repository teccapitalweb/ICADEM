/* ICADEM · pestaña "Ciudad ICADEM".
   El juego vive aislado en /ciudad/ (su propio HTML, CSS y módulos). Este archivo solo monta la
   portada dentro del panel y abre el juego en un marco a pantalla completa. No toca créditos,
   membresías ni ningún otro módulo del panel. */
(function () {
  'use strict';

  var GAME_URL = 'ciudad/index.html?v=2';
  var stage = null;
  var previousOverflow = '';
  var lastFocus = null;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function playerName() {
    var state = window.UserState || {};
    var name = String(state.displayName || '').trim();
    if (!name || /^invitado$/i.test(name)) return '';
    return name.split(/\s+/).slice(0, 2).join(' ');
  }

  function onMessage(event) {
    if (event.origin !== window.location.origin || !stage) return;
    var frame = stage.querySelector('iframe');
    if (!frame || event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === 'ciudad:ready') {
      stage.classList.add('is-ready');
      // Solo se comparte el nombre visible. El juego no recibe token, correo ni saldo.
      frame.contentWindow.postMessage({ type: 'ciudad:identity', name: playerName() }, window.location.origin);
    } else if (event.data.type === 'ciudad:net?') {
      // Multijugador: solo si administración configuró el servidor. El juego recibe la dirección, nunca la sesión.
      frame.contentWindow.postMessage({ type: 'ciudad:net', ws: serverUrl() ? serverUrl().replace(/^http/, 'ws') : null }, window.location.origin);
    } else if (event.data.type === 'ciudad:ticket?') {
      requestTicket().then(function (ticket) { if (stage) frame.contentWindow.postMessage({ type: 'ciudad:ticket', n: event.data.n, ticket: ticket }, window.location.origin); });
    } else if (event.data.type === 'ciudad:exit') {
      close();
    }
  }

  /** Dirección del servidor de sesiones. Mientras no se configure, el juego sigue sin red. */
  // Servidor de sesiones (multijugador). Vacío = el juego corre sin red. Se llena cuando el
  // servidor esté desplegado y su autenticación comprobada (CIUDAD_ICADEM.md, sección 11).
  var CIUDAD_SERVER_URL = '';
  function serverUrl() {
    var url = String(window.ICADEM_CIUDAD_SERVER || CIUDAD_SERVER_URL || '');
    return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) ? url : '';
  }

  /**
   * Comprobación de un servidor ANTES de activarlo: no abre el juego ni guarda nada. Devuelve qué
   * respondió el servidor a una solicitud de boleto con la sesión actual (sin mostrar el boleto).
   * Uso desde la consola del panel: ICADEMCiudad.probe('https://servidor').then(console.log)
   */
  function probe(url) {
    var server = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(String(url || '')) ? String(url) : '';
    var user = window.__auth && window.__auth.currentUser;
    if (!server) return Promise.resolve({ ok: false, step: 'url', detail: 'La dirección debe ser https.' });
    if (!user || typeof user.getIdToken !== 'function') return Promise.resolve({ ok: false, step: 'sesion', detail: 'No hay sesión iniciada.' });
    var out = { server: server };
    return fetch(server + '/health').then(function (r) { return r.json(); }).then(function (h) { out.health = h; return user.getIdToken(); })
      .then(function (idToken) { return fetch(server + '/ticket', { method: 'POST', headers: { Authorization: 'Bearer ' + idToken } }); })
      .then(function (res) { out.ticketStatus = res.status; return res.json().catch(function () { return {}; }); })
      .then(function (body) { out.ticket = typeof body.ticket === 'string' ? 'recibido (' + body.ticket.length + ' caracteres)' : (body.error || 'no'); out.ok = out.ticketStatus === 200; return out; })
      .catch(function (e) { out.ok = false; out.error = String(e && e.message || e); return out; });
  }

  /**
   * Pide un boleto de entrada para el usuario con sesión iniciada. El token de sesión viaja solo
   * del panel al servidor de boletos; al juego se le entrega únicamente el boleto (60 s, un uso).
   */
  function requestTicket() {
    var server = serverUrl(), user = window.__auth && window.__auth.currentUser;
    if (!server || !user || typeof user.getIdToken !== 'function') return Promise.resolve(null);
    return user.getIdToken().then(function (idToken) {
      return fetch(server + '/ticket', { method: 'POST', headers: { Authorization: 'Bearer ' + idToken } });
    }).then(function (res) { return res.ok ? res.json() : null; }).then(function (body) { return body && typeof body.ticket === 'string' ? body.ticket : null; }).catch(function () { return null; });
  }

  function onKey(event) {
    if (event.key === 'Escape' && stage && document.activeElement && !stage.contains(document.activeElement)) close();
  }

  function open() {
    if (stage) return;
    lastFocus = document.activeElement;
    stage = el('div', 'ciudad-stage');
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-label', 'Ciudad ICADEM');
    var frame = document.createElement('iframe');
    frame.src = GAME_URL;
    frame.title = 'Ciudad ICADEM';
    frame.setAttribute('allow', 'fullscreen; gamepad');
    frame.setAttribute('allowfullscreen', '');
    var exit = el('button', 'ciudad-stage__exit', 'Salir');
    exit.type = 'button';
    exit.setAttribute('aria-label', 'Salir de Ciudad ICADEM');
    exit.addEventListener('click', close);
    stage.append(frame, exit);
    document.body.appendChild(stage);
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('message', onMessage);
    document.addEventListener('keydown', onKey);
    frame.addEventListener('load', function () { try { frame.contentWindow.focus(); } catch (_) {} });
  }

  function close() {
    if (!stage) return;
    window.removeEventListener('message', onMessage);
    document.removeEventListener('keydown', onKey);
    stage.remove();
    stage = null;
    document.body.style.overflow = previousOverflow;
    if (lastFocus && typeof lastFocus.focus === 'function') { try { lastFocus.focus(); } catch (_) {} }
  }

  function card(title, items) {
    var box = el('section', 'ciudad-card');
    box.appendChild(el('h3', null, title));
    var list = el('ul');
    items.forEach(function (text) { list.appendChild(el('li', null, text)); });
    box.appendChild(list);
    return box;
  }

  function mount(container) {
    var root = el('div', 'fade-up ciudad-home');

    var hero = el('div', 'sec-hero');
    hero.appendChild(el('span', 'sec-hero__eyebrow', 'Mundo 3D'));
    hero.appendChild(el('h1', 'sec-hero__title', 'Ciudad ICADEM'));
    hero.appendChild(el('p', 'sec-hero__sub', 'Recorre una ciudad en 3D con tu avatar, entra al Banco ICADEM y resuelve tu primera misión.'));

    var cover = el('section', 'ciudad-cover');
    var img = document.createElement('img');
    img.src = 'assets/ciudad/portada.webp?v=1';
    img.alt = 'Vista de la plaza de Ciudad ICADEM con el avatar Explorador frente a la fuente y el Banco ICADEM';
    img.width = 1280; img.height = 720; img.decoding = 'async';
    var veil = el('div', 'ciudad-cover__veil');
    veil.appendChild(el('span', 'ciudad-cover__badge', 'Prototipo · Fase 1'));
    veil.appendChild(el('strong', null, 'Tu habitación, la plaza y la primera misión ya son jugables'));
    var play = el('button', 'btn btn--primary ciudad-cover__play', 'Entrar a Ciudad ICADEM');
    play.type = 'button';
    play.id = 'ciudad-play';
    play.addEventListener('click', open);
    veil.appendChild(play);
    cover.append(img, veil);

    var grid = el('div', 'ciudad-grid');
    grid.appendChild(card('Qué puedes hacer hoy', [
      'Controlar a tu avatar Explorador en tercera persona.',
      'Salir de tu habitación y recorrer la plaza con sus once edificios.',
      'Entrar al Banco ICADEM y jugar la misión «El crédito correcto».',
      'Usar el mapa, marcar destinos y llenar tu pasaporte.'
    ]));
    grid.appendChild(card('Controles', [
      'Computadora: W A S D para moverte, mouse para la cámara, E para interactuar, Espacio para saltar y M para el mapa.',
      'Celular: arrastra a la izquierda para moverte y a la derecha para mirar. Los botones aparecen en pantalla.',
      'En celular se juega mejor con el teléfono en horizontal.'
    ]));
    grid.appendChild(card('Sobre este prototipo', [
      'Los créditos del juego son de prueba: no suman ni restan a tu cartera ICADEM.',
      'Tu avance se guarda por ahora solo en este dispositivo.',
      'Todavía no hay otros jugadores conectados: el multijugador llega en la siguiente fase.',
      'Las otras nueve misiones ya tienen su edificio y se activarán una por una.'
    ]));

    root.append(hero, cover, grid);
    container.replaceChildren(root);
  }

  // Si el usuario cambia de sección (o cierra sesión) con el juego abierto, se cierra.
  window.addEventListener('icadem:navigation', function (event) {
    if (stage && event.detail && event.detail.section !== 'ciudad') close();
  });

  window.ICADEMCiudad = { mount: mount, open: open, close: close, isOpen: function () { return Boolean(stage); }, probe: probe };
})();
