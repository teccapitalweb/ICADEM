// Capa social: frases rápidas con gesto, burbujas sobre los avatares, nombres de los jugadores
// reales conectados, indicador de conexión y lista de jugadores con silenciar y reportar.
// No hay texto libre: solo la lista cerrada de social/phrases.js.
import * as THREE from '../three.js';
import { PHRASES, phraseById, createRateLimiter, SAY_RADIUS, BUBBLE_SECONDS } from '../social/phrases.js';
import { COOP_MISSIONS } from '../net/scenes.js';
import { SCENE_TITLES } from '../world/places.js';

const FRIEND_ERRORS = { 'no-es-conexion': 'Solo puedes invitar a tus conexiones de ICADEM.', 'no-disponible': 'Esa persona ya no está en la ciudad.', 'ya-en-tu-equipo': 'Ya está en tu equipo.', 'equipo-lleno': 'El equipo ya tiene 4 personas.', 'ya-invitado': 'Ya le enviaste una invitación; espera su respuesta.', 'invitacion-vencida': 'La invitación ya venció.', 'instancia-llena': 'Su ciudad está llena por ahora.', 'demasiadas-invitaciones': 'Espera un momento antes de invitar otra vez.' };
/** Enlace para unirse con un código: abre el panel de ICADEM (pide iniciar sesión) y de ahí la ciudad. */
const inviteLink = code => `${location.origin}/vip-panel.html?ciudad=${code}`;
const placeText = scene => scene && SCENE_TITLES[scene] ? (scene === 'plaza' ? 'En la plaza' : `En ${SCENE_TITLES[scene]}`) : null;
const CODE_ERRORS = { 'codigo-invalido': 'Ese código no existe, ya venció o ya se usó.', 'es-tu-codigo': 'Ese código es tuyo: compártelo con quien quieras invitar.', 'no-disponible': 'Quien te invitó ya no está en la ciudad.', 'sala-cerrada': 'Ese equipo está jugando una misión; inténtalo al terminar.', 'equipo-lleno': 'El equipo ya está completo.', 'instancia-llena': 'La ciudad de quien te invitó está llena por ahora.', 'demasiados-codigos': 'Ya tienes 3 códigos activos. Revoca uno para crear otro.', 'en-curso': 'Tu equipo está en una misión; crea el código al terminar.' };
const ROOM_ERRORS = { 'sin-mision': 'Elige primero una misión en equipo (Tribunal o Torre ICADEM).', 'en-curso': 'El equipo ya está jugando una misión.', 'codigo-invalido': 'Ese código no corresponde a ninguna sala.', 'sala-llena': 'La sala ya está completa.', 'sala-cerrada': 'Esa sala ya no admite jugadores.', 'rol-ocupado': 'Ese rol ya lo tomó otro jugador.', 'elige-un-rol': 'Primero elige un rol.', 'solo-anfitrion': 'Solo quien creó la sala puede iniciar.', 'faltan-jugadores': 'Se necesitan al menos dos jugadores.', 'falta-juez': 'Alguien debe tomar el rol de juez.', 'no-todos-listos': 'Todos deben elegir rol y marcarse listos.', 'cooperativo-en-desarrollo': 'Esta misión todavía no se puede jugar en equipo; por ahora se juega en modo individual.' };

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const v = new THREE.Vector3();

export class Social {
  constructor(api, remotes) {
    this.api = api; this.remotes = remotes; this.allow = createRateLimiter();
    this.bubbles = new Map();   // clave ('me' o pid) → { el, left }
    this.tags = new Map();      // pid → elemento con el nombre
    const hud = document.getElementById('hud');
    this.layer = h('div', 'social-layer'); this.layer.setAttribute('aria-hidden', 'true');
    this.button = h('button', 'say-btn'); this.button.type = 'button'; this.button.id = 'btn-say'; this.button.setAttribute('aria-label', 'Frases y gestos'); this.button.setAttribute('aria-expanded', 'false');
    this.button.append(h('span', 'say-btn__icon', '💬'), h('span', 'say-btn__text', 'Frases'), h('kbd', null, 'T'));
    this.menu = h('div', 'say-menu'); this.menu.id = 'say-menu'; this.menu.hidden = true;
    PHRASES.forEach((p, i) => { const b = h('button', null); b.type = 'button'; b.dataset.id = p.id; b.append(h('kbd', null, String(i + 1)), h('span', null, p.text)); b.addEventListener('click', () => { this.say(p.id); this.toggle(false); }); this.menu.append(b); });
    this.chip = h('button', 'net-chip'); this.chip.type = 'button'; this.chip.id = 'net-chip'; this.chip.hidden = true;
    this.chip.addEventListener('click', () => this.openPlayers());
    this.friendsBtn = h('button', 'say-btn friends-btn'); this.friendsBtn.type = 'button'; this.friendsBtn.id = 'btn-friends'; this.friendsBtn.hidden = true; this.friendsBtn.setAttribute('aria-label', 'Amigos y equipo');
    this.friendsBtn.append(h('span', 'say-btn__icon', '👥'), h('span', 'say-btn__text', 'Amigos')); this.friendsBtn.addEventListener('click', () => this.openFriends());
    this.button.addEventListener('click', () => this.toggle());
    hud.append(this.layer, this.button, this.menu, this.chip, this.friendsBtn);
    this.live = h('div', 'sr-only'); this.live.setAttribute('aria-live', 'polite'); hud.append(this.live);

    api.net.on('say', ({ pid, id }) => { if (this.muted.includes(pid)) return; const p = phraseById(id); if (p) { this.#bubble(pid, p.text); this.live.textContent = `${api.net.nameOf(pid)}: ${p.text}`; } });
    api.net.on('status', s => this.#status(s));
    api.net.on('presence', () => this.#status({ status: api.net.status, latency: api.net.latency }));
    api.net.on('name', ({ pid, name }) => { const t = this.tags.get(pid); if (t) t.textContent = name; });
    api.net.on('code', m => {
      if (m.ok === false) api.ui.toast(CODE_ERRORS[m.reason] || 'No se pudo usar el código.', 3600);
      else if (m.op === 'create') api.ui.toast('Código creado. Compártelo solo con quien quieras invitar.', 3000);
      else if (m.op === 'revoke') api.ui.toast('Código revocado.', 2200);
      else if (m.op === 'redeem') { api.ui.toast(`Te uniste al equipo de ${m.host}.`, 3200); if (api.sceneName !== 'plaza' && !api.ui.isBlocking) api.travel('plaza', 'home'); }
      this.socialRender?.();
    });
    api.net.on('friends', m => { if (m.ok === false) api.ui.toast(FRIEND_ERRORS[m.reason] || 'No se pudo completar.', 3200); else if (m.op === 'invite') api.ui.toast('Invitación enviada.', 2200); this.socialRender?.(); });
    api.net.on('invited', m => api.ui.toast(m.byCode ? `${m.name} se unió a tu equipo con tu código.` : m.accepted ? `${m.name} aceptó tu invitación.` : `${m.name} no puede jugar ahora.`, 3200));
    api.net.on('invite', async m => {
      // La invitación llega del servidor (que ya comprobó que son conexiones). Aquí solo se responde.
      // Si está en una misión, un diálogo o un menú, no se le interrumpe: queda pendiente en el panel.
      if (api.ui.isBlocking) { api.ui.toast(`${m.from.name} te invitó a su equipo. Revísalo en Jugadores en línea → Invitaciones.`, 4200); this.socialRender?.(); return; }
      const pick = await api.ui.choice({ speaker: 'Invitación a jugar', text: `${m.from.name} te invita a su equipo.`, options: [{ id: 'si', label: 'Aceptar', hint: 'Entrarás a su misma ciudad', primary: true }, { id: 'no', label: 'Ahora no' }] });
      api.net.answerInvite(m.id, pick === 'si');
    });
    api.net.on('leave', ({ pid }) => { this.#clear(pid); });
    api.net.on('join', p => { if (api.net.isOnline && this.announce) api.ui.toast(`${p.name} entró a la ciudad.`, 2200); });
    api.net.on('room', m => { if (m && m.ok === false && m.reason) api.ui.toast(ROOM_ERRORS[m.reason] || 'No se pudo completar la acción.', 3600); else if (m && m.reason === 'cooperativo-en-desarrollo') api.ui.toast(ROOM_ERRORS[m.reason], 4200); this.lobbyRender?.(); });
    this.announce = false; setTimeout(() => { this.announce = true; }, 2500);
  }

  get muted() { return this.api.store.state.settings.muted || []; }

  toggle(force) { const open = force ?? this.menu.hidden; this.menu.hidden = !open; this.button.setAttribute('aria-expanded', String(open)); }

  /** Frase por número (teclas 1–6). */
  sayIndex(i) { const p = PHRASES[i]; if (p) this.say(p.id); }

  say(id) {
    const p = phraseById(id), api = this.api; if (!p || api.ui.isBlocking) return false;
    if (!this.allow(performance.now())) { api.ui.toast('Espera un momento antes de enviar otra frase.', 1800); return false; }
    api.player.emote(p.emote, 1.9);
    this.#bubble('me', p.text);
    api.net.say(id);   // sin conexión no hace nada: la burbuja solo la ves tú
    return true;
  }

  #bubble(key, text) {
    let b = this.bubbles.get(key);
    if (!b) { b = { el: h('div', 'bubble' + (key === 'me' ? ' bubble--me' : '')), left: 0 }; this.layer.append(b.el); this.bubbles.set(key, b); }
    b.el.textContent = text; b.left = BUBBLE_SECONDS; b.el.classList.remove('is-in'); void b.el.offsetWidth; b.el.classList.add('is-in');
  }

  #clear(pid) { const b = this.bubbles.get(pid); if (b) { b.el.remove(); this.bubbles.delete(pid); } const t = this.tags.get(pid); if (t) { t.remove(); this.tags.delete(pid); } }

  #status(s) {
    const online = s.status === 'online';
    // Sin acceso al multijugador (o sin servidor): el juego es de un jugador y no se muestra nada de red.
    if (s.status === 'closed' && s.detail === 'sin-acceso') { this.chip.hidden = true; this.friendsBtn.hidden = true; this.lastStatus = s.status; return; }
    this.chip.hidden = false; this.friendsBtn.hidden = !online;
    this.chip.className = 'net-chip is-' + s.status;
    // El número lo da el servidor (sesiones reales conectadas en toda la ciudad); los NPC no cuentan.
    const pr = this.api.net.presence, count = pr ? pr.city : (this.api.net.roster ? this.api.net.roster.size : 0) + 1;
    this.chip.title = s.latency != null ? `Latencia ${s.latency} ms` : '';
    this.chip.textContent = online ? `Jugadores en línea · ${count}`
      : s.status === 'closed' ? (s.detail === 'sesion-en-otro-lugar' ? 'Sesión abierta en otro dispositivo' : 'Sin conexión') : s.status === 'connecting' ? 'Conectando…' : 'Reconectando…';
    if (s.status !== this.lastStatus) {
      if (this.lastStatus === 'online' && s.status === 'reconnecting') this.api.ui.toast('Se perdió la conexión. Reconectando…', 2600);
      if (this.lastStatus === 'reconnecting' && online) this.api.ui.toast('Conexión recuperada.', 2200);
      this.lastStatus = s.status;
    }
  }

  openPlayers() { return this.openSocial('ciudad'); }
  openFriends() { return this.openSocial('amigos'); }

  /**
   * Panel social: jugadores reales en línea (los cuenta el servidor; los NPC no cuentan), amigos,
   * invitaciones (de conexiones y con código temporal) y equipo. Sin chat libre.
   */
  openSocial(tab = 'ciudad') {
    const api = this.api, net = api.net, wrap = h('div', 'lobby social');
    let current = tab;
    const TABS = [['ciudad', 'En la ciudad'], ['amigos', 'Amigos'], ['invitaciones', 'Invitaciones'], ['equipo', 'Mi equipo']];
    const render = () => {
      wrap.replaceChildren();
      const pr = net.presence, stats = h('div', 'social__stats');
      const stat = (v, t) => { const d = h('div'); d.append(h('b', null, String(v)), h('span', null, t)); return d; };
      stats.append(stat(pr ? pr.city : (net.isOnline ? (net.roster?.size || 0) + 1 : 1), 'en línea en la ciudad'), stat(pr ? pr.instance : (net.roster?.size || 0) + 1, 'en tu instancia'), stat((net.friendList || []).length, 'amigos conectados'));
      const pending = (net.invites || []).filter(i => i.exp > Date.now()).length;
      const tabs = h('div', 'social__tabs'); tabs.setAttribute('role', 'tablist');
      TABS.forEach(([id, label]) => { const b = h('button', 'social__tab' + (current === id ? ' is-on' : ''), label); b.type = 'button'; b.dataset.tab = id; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(current === id)); if (id === 'invitaciones' && pending) b.append(h('i', 'social__badge', String(pending))); b.addEventListener('click', () => { current = id; render(); }); tabs.append(b); });
      wrap.append(stats, tabs);
      if (!net.isOnline) { wrap.append(h('p', 'players__empty', 'Sin conexión con el servidor multijugador: el juego sigue en modo individual.')); return; }
      const body = h('div', 'social__body'); wrap.append(body);
      ({ ciudad: () => this.#tabCity(body), amigos: () => this.#tabFriends(body), invitaciones: () => this.#tabInvites(body, render), equipo: () => this.#tabTeam(body) })[current]();
      const priv = h('label', 'social__privacy'), box = document.createElement('input'); box.type = 'checkbox'; box.id = 'privacy-listed';
      box.checked = api.store.state.privacyListed !== false;
      box.addEventListener('change', () => { api.store.state.privacyListed = box.checked; api.store.save(); net.profile('privacy', { listed: box.checked }); api.ui.toast(box.checked ? 'Apareces con tu nombre en las listas.' : 'En las listas aparecerás como «Jugador privado» (tus conexiones y tu equipo sí ven tu nombre).', 3600); });
      priv.append(box, h('span', null, 'Mostrar mi nombre a otros jugadores'));
      wrap.append(priv);
    };
    this.socialRender = render;
    const offs = ['room', 'presence', 'friends', 'invite', 'code', 'invited', 'join', 'leave'].map(e => net.on(e, () => this.socialRender?.()));
    render(); if (net.isOnline) { net.friends('list'); net.code('list'); }
    return api.ui.modal({ eyebrow: 'Ciudad ICADEM', title: 'Jugadores en línea', content: wrap, wide: true, onClose: () => { this.socialRender = null; offs.forEach(f => f()); } });
  }

  #playerRow(name, note) { const r = h('div', 'players__row'), who = h('div', 'players__who'); who.append(h('strong', null, name)); if (note) who.append(h('small', null, note)); r.append(who); return r; }

  #tabCity(body) {
    const api = this.api, net = api.net, list = [...(net.roster ? net.roster.values() : [])];
    const rows = h('div', 'players');
    rows.append(this.#playerRow(api.playerName, 'Tú'));
    for (const p of list) {
      const r = this.#playerRow(p.name, this.muted.includes(p.pid) ? 'Silenciado' : 'Jugador conectado');
      const mute = h('button', 'btn', this.muted.includes(p.pid) ? 'Quitar silencio' : 'Silenciar'); mute.type = 'button';
      mute.addEventListener('click', () => {
        const s = api.store.state.settings, set = new Set(s.muted || []);
        if (set.has(p.pid)) set.delete(p.pid); else { set.add(p.pid); this.#clear(p.pid); }
        s.muted = [...set]; api.store.save();
        mute.textContent = set.has(p.pid) ? 'Quitar silencio' : 'Silenciar'; r.querySelector('small').textContent = set.has(p.pid) ? 'Silenciado' : 'Jugador conectado';
      });
      const rep = h('button', 'btn', 'Reportar'); rep.type = 'button';
      rep.addEventListener('click', () => { if (net.report && net.report(p.pid, 'conducta')) { rep.disabled = true; rep.textContent = 'Reportado'; api.ui.toast('Reporte enviado a moderación.'); } });
      r.append(mute, rep); rows.append(r);
    }
    body.append(rows);
    if (!list.length) body.append(h('p', 'players__empty', 'Por ahora no hay otros jugadores en tu instancia.'));
    body.append(h('p', 'players__note', 'Solo aparecen personas reales conectadas (los personajes de la ciudad no cuentan). Entre jugadores solo hay frases predefinidas; no existe chat libre ni mensajes privados.'));
  }

  #tabFriends(body) {
    const net = this.api.net, room = net.roomState, list = net.friendList || [];
    body.append(h('h4', 'lobby__title', 'Conexiones en la ciudad'));
    if (!list.length) body.append(h('p', 'players__empty', 'Ninguna de tus conexiones de ICADEM está en la ciudad en este momento. También puedes invitar con un código temporal (pestaña Invitaciones).'));
    const rows = h('div', 'players');
    list.forEach(f => {
      const row = h('div', 'players__row'), who = h('div', 'players__who'); row.dataset.pid = f.pid;
      who.append(h('strong', null, f.name), h('small', null, f.inMyTeam ? 'En tu equipo' : f.busy ? 'En otro equipo' : placeText(f.place) || 'En su habitación')); row.append(who);
      if (f.inMyTeam) row.append(h('span', 'pill pill--ok', 'Equipo'));
      else { const b = h('button', 'btn btn--primary', 'Invitar'); b.type = 'button'; b.addEventListener('click', () => { b.disabled = true; net.friends('invite', { pid: f.pid }); }); row.append(b); }
      rows.append(row);
    });
    body.append(rows);
    if (room) this.#teamList(body, room);
    const refresh = h('button', 'btn', 'Actualizar lista'); refresh.type = 'button'; refresh.id = 'friends-refresh'; refresh.addEventListener('click', () => net.friends('list')); body.append(refresh);
  }

  #tabInvites(body, render) {
    const api = this.api, net = api.net;
    // recibidas (de conexiones): aceptar o rechazar
    const pending = (net.invites || []).filter(i => i.exp > Date.now());
    body.append(h('h4', 'lobby__title', 'Invitaciones recibidas'));
    if (!pending.length) body.append(h('p', 'players__empty', 'No tienes invitaciones pendientes.'));
    const rows = h('div', 'players');
    pending.forEach(i => {
      const row = this.#playerRow(i.from.name, `Te invita a su equipo · vence en ${Math.max(1, Math.round((i.exp - Date.now()) / 1000))} s`);
      const yes = h('button', 'btn btn--primary', 'Aceptar'), no = h('button', 'btn', 'Rechazar'); yes.type = no.type = 'button';
      yes.addEventListener('click', () => { net.answerInvite(i.id, true); render(); }); no.addEventListener('click', () => { net.answerInvite(i.id, false); render(); });
      row.append(yes, no); rows.append(row);
    });
    body.append(rows);
    // código temporal propio
    body.append(h('h4', 'lobby__title', 'Invitar con un código temporal'));
    body.append(h('p', 'players__note', 'Para familiares o amigos con cuenta de ICADEM autorizada. El código no da acceso a ninguna cuenta: quien lo use entra con su propia sesión. Vence solo, tiene usos limitados y puedes revocarlo.'));
    const codes = net.codes || [];
    codes.forEach(c => {
      const card = h('div', 'code-card'); card.dataset.code = c.code;
      const big = h('strong', 'code-card__code', c.code.slice(0, 4) + '-' + c.code.slice(4));
      const meta = h('small', null, `${c.usesLeft} ${c.usesLeft === 1 ? 'uso' : 'usos'} · vence en ${Math.max(1, Math.round(c.expiresIn / 60))} min`);
      const copy = h('button', 'btn', 'Copiar enlace'); copy.type = 'button';
      copy.addEventListener('click', () => { const link = inviteLink(c.code); (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => api.ui.toast('Enlace copiado. Quien lo abra necesita su propia cuenta autorizada.', 3400), () => api.ui.toast(link, 6000)); });
      const revoke = h('button', 'btn', 'Revocar'); revoke.type = 'button'; revoke.addEventListener('click', () => net.code('revoke', { code: c.code }));
      const acts = h('div', 'code-card__acts'); acts.append(copy, revoke);
      card.append(big, meta, acts); body.append(card);
    });
    const make = h('div', 'lobby__join');
    const uses = document.createElement('select'); uses.id = 'code-uses'; [['1', '1 uso'], ['3', '3 usos'], ['5', '5 usos']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === '3') o.selected = true; uses.append(o); });
    const mins = document.createElement('select'); mins.id = 'code-minutes'; [['15', '15 min'], ['30', '30 min'], ['60', '1 hora'], ['120', '2 horas']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === '30') o.selected = true; mins.append(o); });
    const gen = h('button', 'btn btn--primary', 'Crear código'); gen.type = 'button'; gen.id = 'code-create'; gen.disabled = codes.length >= 3;
    gen.addEventListener('click', () => net.code('create', { uses: Number(uses.value), minutes: Number(mins.value) }));
    make.append(uses, mins, gen); body.append(make);
    // canjear un código
    body.append(h('h4', 'lobby__title', '¿Te pasaron un código?'));
    const row = h('div', 'lobby__join'), input = h('input', 'lobby__code'); input.id = 'code-redeem'; input.maxLength = 9; input.placeholder = 'XXXX-XXXX'; input.autocomplete = 'off'; input.setAttribute('aria-label', 'Código de invitación');
    const join = h('button', 'btn', 'Unirme'); join.type = 'button'; join.id = 'code-join'; join.addEventListener('click', () => { if (input.value.trim()) net.code('redeem', { code: input.value.trim() }); });
    row.append(input, join); body.append(row);
  }

  #teamList(body, room) {
    const net = this.api.net;
    body.append(h('h4', 'lobby__title', 'Tu equipo'));
    const team = h('div', 'players');
    room.members.forEach(m => { const row = h('div', 'players__row'), who = h('div', 'players__who'); who.append(h('strong', null, m.pid === net.pid ? `${m.name} (tú)` : m.name), h('small', null, (room.host === m.pid ? 'Anfitrión' : 'Integrante') + (m.online ? '' : ' · reconectando'))); row.append(who); team.append(row); });
    const acts = h('div', 'lobby__acts');
    if (room.host === net.pid) { const rally = h('button', 'btn btn--primary', 'Reunir al equipo en la plaza'); rally.type = 'button'; rally.id = 'team-rally'; rally.addEventListener('click', () => net.rally()); acts.append(rally); }
    const leave = h('button', 'btn', 'Salir del equipo'); leave.type = 'button'; leave.id = 'team-leave'; leave.addEventListener('click', () => net.room('leave')); acts.append(leave);
    body.append(team, h('p', 'players__note', `${room.members.length} de 4 integrantes.`), acts);
  }

  #tabTeam(body) {
    const api = this.api, net = api.net, room = net.roomState;
    if (!room) { body.append(h('p', 'players__empty', 'Aún no tienes equipo. Invita a una conexión (Amigos) o crea un código temporal (Invitaciones).')); return; }
    this.#teamList(body, room);
    body.append(h('h4', 'lobby__title', 'Jugar una misión en equipo'));
    const pick = h('div', 'pick');
    Object.entries(COOP_MISSIONS).forEach(([id, spec]) => {
      const b = h('button', 'pick__card' + (room.mission === id ? ' is-on' : '')); b.type = 'button'; b.dataset.mission = id;
      b.append(h('strong', null, spec.title), h('span', null, `${spec.min}–${spec.max} personas · ${spec.roles.map(r => r.name).join(', ')}`));
      b.addEventListener('click', () => { document.querySelector('#modal-actions button')?.click(); setTimeout(() => this.openLobby(id), 60); });
      pick.append(b);
    });
    body.append(pick, h('p', 'players__note', 'Abre la sala de espera para repartir roles. El servidor guarda el intento del equipo.'));
  }


  /**
   * Sala de espera de la audiencia en equipo. Todo lo decide el servidor (códigos, roles,
   * quién es anfitrión); esta pantalla solo muestra el estado y envía solicitudes.
   */
  openLobby(missionId = 'tribunal-tu-eres-el-juez') {
    if (!COOP_MISSIONS[missionId]) missionId = 'tribunal-tu-eres-el-juez';
    const api = this.api, net = api.net, spec = COOP_MISSIONS[missionId], wrap = h('div', 'lobby');
    const roleName = id => (spec.roles.find(r => r.id === id) || {}).name || 'Sin rol';
    const render = () => {
      wrap.replaceChildren();
      wrap.append(h('p', 'lobby__status', spec.playable
        ? `Equipos de ${spec.min} a ${spec.max} personas. Cada quien elige un rol y se marca listo; el anfitrión inicia. El servidor guarda el intento del equipo y revisa que cada paso lo haga el rol que corresponde.`
        : 'En desarrollo: aquí se arma el equipo y se reparten los roles. Esta misión aún no se juega en equipo; la versión individual sí.'));
      if (!net.isOnline) { wrap.append(h('p', 'players__empty', 'La sala de espera necesita conexión con el servidor multijugador, que por ahora solo existe en el entorno de pruebas.')); return; }
      const room = net.roomState;
      if (!room) {
        const create = h('button', 'btn btn--primary', 'Crear sala'); create.type = 'button'; create.id = 'lobby-create'; create.addEventListener('click', () => net.room('create', { mission: missionId }));
        const code = h('input', 'lobby__code'); code.id = 'lobby-code'; code.maxLength = 6; code.placeholder = 'CÓDIGO'; code.autocomplete = 'off'; code.setAttribute('aria-label', 'Código de la sala');
        const join = h('button', 'btn', 'Unirme'); join.type = 'button'; join.id = 'lobby-join'; join.addEventListener('click', () => { if (code.value.trim()) net.room('join', { code: code.value.trim() }); });
        const row = h('div', 'lobby__join'); row.append(code, join);
        wrap.append(create, h('p', 'players__note', 'O entra a la sala de un compañero con su código de invitación:'), row);
        return;
      }
      if (room.mission !== missionId) {
        const other = COOP_MISSIONS[room.mission];
        wrap.append(h('p', 'players__note', other ? `Tu equipo está preparado para «${other.title}».` : 'Tu equipo todavía no tiene misión.'));
        if (room.host === net.pid && room.status !== 'en-curso') { const sw = h('button', 'btn btn--primary', `Cambiar a «${spec.title}»`); sw.type = 'button'; sw.id = 'lobby-switch'; sw.addEventListener('click', () => net.room('create', { mission: missionId })); wrap.append(sw); }
        else if (room.host !== net.pid) wrap.append(h('p', 'players__note', 'Solo el anfitrión puede cambiar la misión del equipo.'));
        const leave0 = h('button', 'btn', 'Salir del equipo'); leave0.type = 'button'; leave0.addEventListener('click', () => net.room('leave')); wrap.append(leave0);
        return;
      }
      if (room.status === 'en-curso') wrap.append(h('p', 'lobby__status', '🟢 Misión en curso. Ve a tu estación o a tu lugar en la sala.'));
      const me = room.members.find(m => m.pid === net.pid) || {}, head = h('div', 'lobby__head');
      head.append(h('span', null, 'Código de invitación'), h('strong', 'lobby__codeview', room.code)); wrap.append(head);
      const roles = h('div', 'lobby__roles');
      spec.roles.forEach(r => {
        const owner = room.members.find(m => m.role === r.id), b = h('button', 'lobby__role' + (owner ? ' is-taken' : '') + (me.role === r.id ? ' is-mine' : '')); b.type = 'button'; b.dataset.role = r.id;
        b.append(h('strong', null, r.name), h('small', null, owner ? (owner.pid === net.pid ? 'Tú' : owner.name) : 'Libre')); b.disabled = Boolean(owner) && owner.pid !== net.pid;
        b.addEventListener('click', () => net.room('role', { role: me.role === r.id ? null : r.id })); roles.append(b);
      });
      wrap.append(roles);
      const list = h('div', 'players');
      room.members.forEach(m => { const row = h('div', 'players__row'), who = h('div', 'players__who'); who.append(h('strong', null, m.pid === net.pid ? `${m.name} (tú)` : m.name), h('small', null, `${roleName(m.role)}${room.host === m.pid ? ' · anfitrión' : ''}${m.online ? '' : ' · reconectando'}`)); row.append(who, h('span', 'pill ' + (m.ready ? 'pill--ok' : 'pill--soon'), m.ready ? 'Listo' : 'En espera')); list.append(row); });
      wrap.append(list);
      const acts = h('div', 'lobby__acts');
      const ready = h('button', 'btn', me.ready ? 'Ya no estoy listo' : 'Estoy listo'); ready.type = 'button'; ready.id = 'lobby-ready'; ready.addEventListener('click', () => net.room('ready', { ready: !me.ready }));
      const leave = h('button', 'btn', 'Salir de la sala'); leave.type = 'button'; leave.id = 'lobby-leave'; leave.addEventListener('click', () => net.room('leave'));
      acts.append(ready, leave);
      if (room.host === net.pid && room.status !== 'en-curso') { const start = h('button', 'btn btn--primary', `Iniciar ${spec.action || 'misión'}`); start.type = 'button'; start.id = 'lobby-start'; start.addEventListener('click', () => net.room('start')); acts.append(start); }
      wrap.append(acts);
    };
    this.lobbyRender = render; render();
    return api.ui.modal({ eyebrow: 'Misión en equipo', title: 'Sala de espera · ' + spec.title, content: wrap, onClose: () => { this.lobbyRender = null; } });
  }

  #project(x, y, z, el) {
    const cam = this.api.engine.camera;
    v.set(x, y, z);
    const dist = v.distanceTo(cam.position);
    v.project(cam);
    const show = v.z > -1 && v.z < 1 && dist < SAY_RADIUS + 6;
    el.style.display = show ? '' : 'none';
    if (show) el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(1)}px)`;
  }

  update(dt) {
    const api = this.api, p = api.player.position;
    // nombres de los jugadores remotos visibles
    for (const pid of this.tags.keys()) if (!this.remotes.head(pid)) this.#clear(pid);
    for (const r of this.remotes.map.values()) {
      let tag = this.tags.get(r.pid);
      if (!tag) { tag = h('div', 'nametag', api.net.nameOf(r.pid)); this.layer.append(tag); this.tags.set(r.pid, tag); }
      const head = this.remotes.head(r.pid); this.#project(head.x, head.y, head.z, tag);
    }
    for (const [key, b] of this.bubbles) {
      b.left -= dt;
      if (b.left <= 0) { b.el.remove(); this.bubbles.delete(key); continue; }
      b.el.classList.toggle('is-out', b.left < 0.4);
      const head = key === 'me' ? { x: p.x, y: p.y + 2.2, z: p.z } : this.remotes.head(key);
      if (!head) { b.el.style.display = 'none'; continue; }
      this.#project(head.x, head.y + (key === 'me' ? 0 : 0.34), head.z, b.el);
    }
  }
}
