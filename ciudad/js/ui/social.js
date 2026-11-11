// Capa social: frases rápidas con gesto, burbujas sobre los avatares, nombres de los jugadores
// reales conectados, indicador de conexión y lista de jugadores con silenciar y reportar.
// No hay texto libre: solo la lista cerrada de social/phrases.js.
import * as THREE from '../three.js';
import { PHRASES, phraseById, createRateLimiter, SAY_RADIUS, BUBBLE_SECONDS } from '../social/phrases.js';
import { COOP_MISSIONS } from '../net/scenes.js';

const FRIEND_ERRORS = { 'no-es-conexion': 'Solo puedes invitar a tus conexiones de ICADEM.', 'no-disponible': 'Esa persona ya no está en la ciudad.', 'ya-en-tu-equipo': 'Ya está en tu equipo.', 'equipo-lleno': 'El equipo ya tiene 4 personas.', 'ya-invitado': 'Ya le enviaste una invitación; espera su respuesta.', 'invitacion-vencida': 'La invitación ya venció.', 'instancia-llena': 'Su ciudad está llena por ahora.', 'demasiadas-invitaciones': 'Espera un momento antes de invitar otra vez.' };
const PLACES = { plaza: 'En la plaza', bank: 'En el Banco', court: 'En el Tribunal' };
const ROOM_ERRORS = { 'sin-mision': 'Elige primero una misión en equipo (por ahora, en el Tribunal).', 'codigo-invalido': 'Ese código no corresponde a ninguna sala.', 'sala-llena': 'La sala ya está completa.', 'sala-cerrada': 'Esa sala ya no admite jugadores.', 'rol-ocupado': 'Ese rol ya lo tomó otro jugador.', 'elige-un-rol': 'Primero elige un rol.', 'solo-anfitrion': 'Solo quien creó la sala puede iniciar.', 'faltan-jugadores': 'Se necesitan al menos dos jugadores.', 'falta-juez': 'Alguien debe tomar el rol de juez.', 'no-todos-listos': 'Todos deben elegir rol y marcarse listos.', 'cooperativo-en-desarrollo': 'La sala está completa. La audiencia en equipo todavía está en desarrollo: por ahora se juega en modo individual.' };

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
    api.net.on('friends', m => { if (m.ok === false) api.ui.toast(FRIEND_ERRORS[m.reason] || 'No se pudo completar.', 3200); else if (m.op === 'invite') api.ui.toast('Invitación enviada.', 2200); this.friendsRender?.(); });
    api.net.on('invited', m => api.ui.toast(m.accepted ? `${m.name} aceptó tu invitación.` : `${m.name} no puede jugar ahora.`, 3200));
    api.net.on('invite', async m => {
      // La invitación llega del servidor (que ya comprobó que son conexiones). Aquí solo se responde.
      const pick = await api.ui.choice({ speaker: 'Invitación a jugar', text: `${m.from.name} te invita a su equipo.`, options: [{ id: 'si', label: 'Aceptar', hint: 'Entrarás a su misma ciudad', primary: true }, { id: 'no', label: 'Ahora no' }] });
      api.net.friends('answer', { id: m.id, accept: pick === 'si' });
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
    const others = this.api.net.roster ? this.api.net.roster.size : 0;
    this.chip.textContent = online ? `En línea · ${others + 1} ${others ? 'jugadores' : 'jugador'}${s.latency != null ? ` · ${s.latency} ms` : ''}`
      : s.status === 'closed' ? (s.detail === 'sesion-en-otro-lugar' ? 'Sesión abierta en otro dispositivo' : 'Sin conexión') : s.status === 'connecting' ? 'Conectando…' : 'Reconectando…';
    if (s.status !== this.lastStatus) {
      if (this.lastStatus === 'online' && s.status === 'reconnecting') this.api.ui.toast('Se perdió la conexión. Reconectando…', 2600);
      if (this.lastStatus === 'reconnecting' && online) this.api.ui.toast('Conexión recuperada.', 2200);
      this.lastStatus = s.status;
    }
  }

  /** Lista de jugadores de la instancia, con silenciar y reportar. */
  openPlayers() {
    const api = this.api, net = api.net, wrap = h('div', 'players');
    const row = (name, note) => { const r = h('div', 'players__row'); const who = h('div', 'players__who'); who.append(h('strong', null, name)); if (note) who.append(h('small', null, note)); r.append(who); return r; };
    wrap.append(row(api.playerName, 'Tú'));
    const list = [...(net.roster ? net.roster.values() : [])];
    for (const p of list) {
      const r = row(p.name, this.muted.includes(p.pid) ? 'Silenciado' : 'Jugador conectado');
      const mute = h('button', 'btn', this.muted.includes(p.pid) ? 'Quitar silencio' : 'Silenciar'); mute.type = 'button';
      mute.addEventListener('click', () => {
        const s = api.store.state.settings, set = new Set(s.muted || []);
        if (set.has(p.pid)) set.delete(p.pid); else { set.add(p.pid); this.#clear(p.pid); }
        s.muted = [...set]; api.store.save();
        mute.textContent = set.has(p.pid) ? 'Quitar silencio' : 'Silenciar'; r.querySelector('small').textContent = set.has(p.pid) ? 'Silenciado' : 'Jugador conectado';
      });
      const rep = h('button', 'btn', 'Reportar'); rep.type = 'button';
      rep.addEventListener('click', () => { if (net.report && net.report(p.pid, 'conducta')) { rep.disabled = true; rep.textContent = 'Reportado'; api.ui.toast('Reporte enviado a moderación.'); } });
      r.append(mute, rep); wrap.append(r);
    }
    if (!list.length) wrap.append(h('p', 'players__empty', 'Por ahora no hay otros jugadores en tu instancia.'));
    wrap.append(h('p', 'players__note', 'Aquí solo aparecen personas reales conectadas. Entre jugadores solo se pueden enviar frases predefinidas.'));
    return api.ui.modal({ eyebrow: net.instance ? 'Instancia ' + net.instance : 'Jugadores', title: 'Jugadores conectados', content: wrap });
  }

  /** Amigos (conexiones autorizadas que están en la ciudad) y equipo de 2 a 4. */
  openFriends() {
    const api = this.api, net = api.net, wrap = h('div', 'lobby');
    const render = () => {
      wrap.replaceChildren();
      const room = net.roomState, list = net.friendList || [];
      wrap.append(h('h4', 'lobby__title', 'Conexiones en la ciudad'));
      if (!list.length) wrap.append(h('p', 'players__empty', 'Ninguna de tus conexiones de ICADEM está en la ciudad en este momento.'));
      const rows = h('div', 'players');
      list.forEach(f => {
        const row = h('div', 'players__row'), who = h('div', 'players__who'); row.dataset.pid = f.pid;
        who.append(h('strong', null, f.name), h('small', null, f.inMyTeam ? 'En tu equipo' : f.busy ? 'En otro equipo' : PLACES[f.place] || 'En su habitación')); row.append(who);
        if (f.inMyTeam) row.append(h('span', 'pill pill--ok', 'Equipo'));
        else { const b = h('button', 'btn btn--primary', 'Invitar'); b.type = 'button'; b.addEventListener('click', () => { b.disabled = true; net.friends('invite', { pid: f.pid }); }); row.append(b); }
        rows.append(row);
      });
      wrap.append(rows);
      wrap.append(h('h4', 'lobby__title', 'Tu equipo'));
      if (!room) wrap.append(h('p', 'players__empty', 'Aún no tienes equipo. Invita a una conexión para formar uno de 2 a 4 personas.'));
      else {
        const team = h('div', 'players');
        room.members.forEach(m => { const row = h('div', 'players__row'), who = h('div', 'players__who'); who.append(h('strong', null, m.pid === net.pid ? `${m.name} (tú)` : m.name), h('small', null, (room.host === m.pid ? 'Anfitrión' : 'Integrante') + (m.online ? '' : ' · reconectando'))); row.append(who); team.append(row); });
        const acts = h('div', 'lobby__acts');
        if (room.host === net.pid) { const rally = h('button', 'btn btn--primary', 'Reunir al equipo en la plaza'); rally.type = 'button'; rally.id = 'team-rally'; rally.addEventListener('click', () => net.rally()); acts.append(rally); }
        const leave = h('button', 'btn', 'Salir del equipo'); leave.type = 'button'; leave.id = 'team-leave'; leave.addEventListener('click', () => net.room('leave')); acts.append(leave);
        wrap.append(team, h('p', 'players__note', `${room.members.length} de 4 integrantes. En el Tribunal, tu equipo comparte la sala.`), acts);
      }
      const refresh = h('button', 'btn', 'Actualizar lista'); refresh.type = 'button'; refresh.id = 'friends-refresh'; refresh.addEventListener('click', () => net.friends('list')); wrap.append(refresh);
    };
    this.friendsRender = render; const off = net.on('room', () => this.friendsRender?.()); render(); net.friends('list');
    return api.ui.modal({ eyebrow: 'Jugar con otros', title: 'Amigos y equipo', content: wrap, onClose: () => { this.friendsRender = null; off(); } });
  }

  /**
   * Sala de espera de la audiencia en equipo. Todo lo decide el servidor (códigos, roles,
   * quién es anfitrión); esta pantalla solo muestra el estado y envía solicitudes.
   */
  openLobby(missionId = 'tribunal-tu-eres-el-juez') {
    const api = this.api, net = api.net, spec = COOP_MISSIONS[missionId], wrap = h('div', 'lobby');
    const roleName = id => (spec.roles.find(r => r.id === id) || {}).name || 'Sin rol';
    const render = () => {
      wrap.replaceChildren();
      wrap.append(h('p', 'lobby__status', 'En desarrollo: aquí se arma el equipo y se reparten los roles. La audiencia en equipo aún no se puede jugar; la misión individual sí.'));
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
      if (room.host === net.pid) { const start = h('button', 'btn btn--primary', 'Iniciar audiencia'); start.type = 'button'; start.id = 'lobby-start'; start.addEventListener('click', () => net.room('start')); acts.append(start); }
      wrap.append(acts);
    };
    this.lobbyRender = render; render();
    return api.ui.modal({ eyebrow: 'Audiencia en equipo', title: 'Sala de espera · ' + spec.title, content: wrap, onClose: () => { this.lobbyRender = null; } });
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
