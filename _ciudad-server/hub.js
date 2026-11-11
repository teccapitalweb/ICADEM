// Ciudad ICADEM · lógica del servidor de sesiones (sin sockets, para poder probarla).
//
// El servidor es la autoridad: decide quién entra, en qué instancia, qué posiciones son
// válidas, quién ve a quién y qué frases se reparten. El cliente solo propone.
import { createHash, randomBytes } from 'node:crypto';
import { decodeState, encodeState, NET_SCENES } from '../ciudad/js/net/network.js';
import { SCENE_RULES, ENTRY_RADIUS, COOP_MISSIONS } from '../ciudad/js/net/scenes.js';
import { phraseById, createRateLimiter, SAY_LIMIT, SAY_RADIUS } from '../ciudad/js/social/phrases.js';

/** Equipo libre (sin misión): de 2 a 4 personas, sin roles. */
const TEAM = Object.freeze({ title: 'Equipo', min: 2, max: 4, roles: [], playable: false });
const specOf = room => COOP_MISSIONS[room.mission] || TEAM;

export const LIMITS = Object.freeze({
  capacity: 16,          // jugadores por instancia (objetivo 10–20, sujeto a pruebas de carga)
  maxSpeed: 6.4 * 1.6,   // m/s: velocidad de carrera del juego + tolerancia por latencia
  slack: 1.5,            // m de holgura por irregularidad de la red
  maxGapS: 1.5,          // s: intervalo máximo que se considera entre dos estados seguidos
  resumeMs: 30000,       // tiempo que se guarda el lugar de alguien que perdió la conexión
  nameMax: 28,
  // Topes por tipo de acción (máximo, ventana en ms). Lo que los excede se descarta.
  actions: { s: [25, 1000], report: [5, 60000], room: [12, 60000], verify: [6, 60000], friends: [20, 60000], invite: [6, 60000], profile: [30, 60000] },
  inviteMs: 60000        // una invitación sin responder caduca en un minuto
});

/** Límites caminables de cada escenario (compartidos con el cliente). */
export const SCENE_BOUNDS = Object.freeze(Object.fromEntries(Object.entries(SCENE_RULES).map(([k, v]) => [k, v.bounds])));
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0/O ni 1/I para dictarlo sin errores

const cleanName = name => String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, LIMITS.nameMax) || 'Jugador';

export class Hub {
  /** connections: async uid → uids con los que tiene una conexión AUTORIZADA en ICADEM (la fuente es el backend, nunca el navegador). */
  constructor({ now = Date.now, capacity = LIMITS.capacity, salt = randomBytes(8).toString('hex'), connections = async () => [] } = {}) {
    this.now = now; this.capacity = capacity; this.salt = salt; this.connections = connections; this.invites = new Map(); this.inviteSeq = 0;
    this.instances = new Map();   // id → { id, players: Map<pid, player> }
    this.byUid = new Map();       // uid → player
    this.reports = [];
    this.rooms = new Map();       // id → sala privada (sala de espera cooperativa)
    this.codes = new Map();       // código de invitación → sala
    this.seq = 0; this.roomSeq = 0;
  }

  /** Identificador público y estable de un usuario (no revela su uid). */
  publicId(uid) { return createHash('sha256').update(this.salt + ':' + uid).digest('hex').slice(0, 10); }

  #pick() {
    // Se llena primero la instancia con más gente que aún tenga lugar: los jugadores se encuentran.
    let best = null;
    for (const inst of this.instances.values()) if (inst.players.size < this.capacity && (!best || inst.players.size > best.players.size)) best = inst;
    if (!best) { best = { id: 'ciudad-' + (++this.seq), players: new Map() }; this.instances.set(best.id, best); }
    return best;
  }

  /**
   * Entrada de un usuario ya autenticado. Una sola sesión por usuario: si vuelve a entrar
   * (otra pestaña o reconexión) recupera su lugar y la conexión anterior queda sustituida.
   */
  join({ uid, name, avatar = 'explorador' }) {
    const existing = this.byUid.get(uid);
    if (existing) {
      const replaced = existing.online;
      existing.online = true; existing.detachedAt = 0; existing.name = cleanName(name); existing.epoch++; existing.fresh = true;
      return { ok: true, player: existing, instance: existing.instance, resumed: true, replaced };
    }
    const instance = this.#pick();
    const player = {
      uid, pid: this.publicId(uid), name: cleanName(name), avatar: String(avatar).slice(0, 24), instance,
      online: true, detachedAt: 0, epoch: 1, state: null, stateAt: 0, rejected: 0, fresh: true, room: null, friends: new Set(), custom: null,
      allowSay: createRateLimiter(SAY_LIMIT),
      limits: Object.fromEntries(Object.entries(LIMITS.actions).map(([k, [max, windowMs]]) => [k, createRateLimiter({ max, windowMs })]))
    };
    instance.players.set(player.pid, player); this.byUid.set(uid, player);
    return { ok: true, player, instance, resumed: false, replaced: false };
  }

  /** Se perdió la conexión: se conserva el lugar un rato para que pueda volver. */
  detach(player) { player.online = false; player.detachedAt = this.now(); }

  /** ¿Le queda margen para esta acción? Cada tipo de mensaje tiene su propio tope. */
  allow(player, action) { const l = player.limits[action]; return l ? l(this.now()) : true; }

  remove(player) {
    this.leaveRoom(player);
    player.instance.players.delete(player.pid); this.byUid.delete(player.uid);
    if (!player.instance.players.size) this.instances.delete(player.instance.id);
  }

  /** Libera los lugares de quienes no regresaron a tiempo. Devuelve a quiénes se quitó. */
  sweep() {
    const gone = [], t = this.now();
    for (const p of this.byUid.values()) if (!p.online && t - p.detachedAt >= LIMITS.resumeMs) gone.push(p);
    gone.forEach(p => this.remove(p));
    return gone;
  }

  /**
   * Estado propuesto por un cliente. Se rechaza lo imposible: fuera del mapa, más rápido de lo
   * que el juego permite, o un cambio de escenario que no pase por una puerta. Al rechazar se
   * devuelve el último estado válido para corregir al cliente.
   */
  state(player, encoded) {
    const s = decodeState(encoded), t = this.now();
    const reject = reason => { player.rejected++; return { ok: false, reason, fix: player.state ? encodeState(player.state) : null }; };
    if (!s || !NET_SCENES.includes(s.scene)) return reject('formato');
    const rule = SCENE_RULES[s.scene], b = rule.bounds;
    if (s.x < b.minX || s.x > b.maxX || s.z < b.minZ || s.z > b.maxZ || s.y < -0.5 || s.y > 6) return reject('fuera-del-mapa');
    const prev = player.state;
    // El primer estado de cada conexión solo se valida contra el mapa: pudo moverse sin red.
    if (prev && !player.fresh) {
      if (prev.scene === s.scene) {
        // El tiempo que cuenta tiene tope: quedarse quieto un minuto no "acumula" derecho a teletransportarse.
        const dist = Math.hypot(s.x - prev.x, s.z - prev.z), dt = Math.min(LIMITS.maxGapS, Math.max(0.05, (t - player.stateAt) / 1000));
        if (dist > LIMITS.maxSpeed * dt + LIMITS.slack) return reject('velocidad');
      } else {
        if (!SCENE_RULES[prev.scene].links.includes(s.scene)) return reject('transicion');
        if (rule.entries && !rule.entries.some(([x, z]) => Math.hypot(s.x - x, s.z - z) <= ENTRY_RADIUS)) return reject('entrada');
      }
    }
    player.state = s; player.stateAt = t; player.fresh = false;
    return { ok: true };
  }

  /**
   * ¿`viewer` puede ver a `other`? Misma instancia y mismo escenario, y además:
   *   · escenario privado (habitación): nadie;
   *   · escenario de sala (tribunal): solo quienes comparten la misma sala privada.
   */
  visible(viewer, other) {
    if (viewer === other || !other.online || !other.state || !viewer.state) return false;
    if (viewer.instance !== other.instance || viewer.state.scene !== other.state.scene) return false;
    const privacy = SCENE_RULES[other.state.scene].privacy;
    if (privacy === 'private') return false;
    if (privacy === 'party') return Boolean(viewer.room) && viewer.room === other.room;
    return true;
  }

  /** Fotografía de lo que ve un jugador: [[pid, estado], ...]. */
  snapshotFor(viewer) {
    const list = [];
    for (const other of viewer.instance.players.values()) if (this.visible(viewer, other)) list.push([other.pid, encodeState(other.state)]);
    return list;
  }

  /** Frase rápida: valida la lista cerrada y el ritmo, y devuelve quién debe recibirla. */
  say(player, phraseId) {
    if (!phraseById(phraseId)) return { ok: false, reason: 'frase-desconocida' };
    if (!player.state || SCENE_RULES[player.state.scene].privacy === 'private') return { ok: false, reason: 'sin-audiencia' };
    if (!player.allowSay(this.now())) return { ok: false, reason: 'demasiado-rapido' };
    const to = [];
    for (const other of player.instance.players.values()) {
      if (!this.visible(other, player)) continue;
      if (Math.hypot(other.state.x - player.state.x, other.state.z - player.state.z) <= SAY_RADIUS) to.push(other);
    }
    return { ok: true, to };
  }

  /** Reporte de un jugador hacia otro. Se guarda para moderación (máx. 500 en memoria). */
  report(player, targetPid, reason) {
    const target = player.instance.players.get(String(targetPid));
    if (!target || target === player) return { ok: false };
    this.reports.push({ at: this.now(), from: player.pid, target: target.pid, reason: String(reason || '').slice(0, 80), instance: player.instance.id });
    if (this.reports.length > 500) this.reports.shift();
    return { ok: true };
  }

  /* ---------- salas privadas (sala de espera cooperativa) ---------- */

  roomView(room) {
    return { id: room.id, code: room.code, mission: room.mission, host: room.host, status: room.status,
      members: [...room.members.entries()].map(([pid, m]) => ({ pid, name: m.player.name, role: m.role, ready: m.ready, online: m.player.online })) };
  }

  createRoom(player, { mission } = {}) {
    if (mission !== null && mission !== undefined && !COOP_MISSIONS[mission]) return { ok: false, reason: 'mision-sin-cooperativo' };
    mission = mission ?? null;
    // Un equipo ya formado puede elegir misión sin deshacerse: lo decide su anfitrión.
    if (player.room && mission) { const r = player.room; if (r.host !== player.pid) return { ok: false, reason: 'solo-anfitrion' }; if (r.members.size > COOP_MISSIONS[mission].max) return { ok: false, reason: 'sala-llena' }; r.mission = mission; for (const m of r.members.values()) { m.role = null; m.ready = false; } return { ok: true, room: r }; }
    this.leaveRoom(player);
    let code; do { code = Array.from(randomBytes(6), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''); } while (this.codes.has(code));
    const room = { id: 'sala-' + (++this.roomSeq), code, mission, host: player.pid, status: 'espera', members: new Map([[player.pid, { player, role: null, ready: false }]]) };
    this.rooms.set(room.id, room); this.codes.set(code, room); player.room = room;
    return { ok: true, room };
  }

  /** Solo se entra con el código de invitación; quien no lo tiene no puede ver ni tocar la sala. */
  joinRoom(player, code) {
    const room = this.codes.get(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (!room) return { ok: false, reason: 'codigo-invalido' };
    if (room.members.has(player.pid)) return { ok: true, room };
    if (room.members.size >= specOf(room).max) return { ok: false, reason: 'sala-llena' };
    if (room.status !== 'espera') return { ok: false, reason: 'sala-cerrada' };
    this.leaveRoom(player);
    room.members.set(player.pid, { player, role: null, ready: false }); player.room = room;
    return { ok: true, room };
  }

  /** Devuelve la sala que quedó (para avisar a los demás) o null si se disolvió. */
  leaveRoom(player) {
    const room = player.room; if (!room) return null;
    room.members.delete(player.pid); player.room = null;
    if (!room.members.size) { this.rooms.delete(room.id); this.codes.delete(room.code); return null; }
    if (room.host === player.pid) room.host = room.members.keys().next().value;
    return room;
  }

  setRole(player, role) {
    const room = player.room; if (!room) return { ok: false, reason: 'sin-sala' };
    const me = room.members.get(player.pid);
    if (role === null || role === '') { me.role = null; me.ready = false; return { ok: true, room }; }
    if (!specOf(room).roles.some(r => r.id === role)) return { ok: false, reason: 'rol-desconocido' };
    for (const [pid, m] of room.members) if (pid !== player.pid && m.role === role) return { ok: false, reason: 'rol-ocupado' };
    me.role = role; me.ready = false;
    return { ok: true, room };
  }

  setReady(player, ready) {
    const room = player.room; if (!room) return { ok: false, reason: 'sin-sala' };
    const me = room.members.get(player.pid);
    if (ready && !me.role) return { ok: false, reason: 'elige-un-rol' };
    me.ready = Boolean(ready);
    return { ok: true, room };
  }

  /** Valida que la sala esté completa. La audiencia cooperativa todavía no se puede iniciar. */
  startRoom(player) {
    const room = player.room; if (!room) return { ok: false, reason: 'sin-sala' };
    const spec = specOf(room), members = [...room.members.values()];
    if (room.host !== player.pid) return { ok: false, reason: 'solo-anfitrion' };
    if (!room.mission) return { ok: false, reason: 'sin-mision' };
    if (members.length < spec.min) return { ok: false, reason: 'faltan-jugadores' };
    for (const r of spec.roles) if (r.required && !members.some(m => m.role === r.id)) return { ok: false, reason: 'falta-' + r.id };
    if (members.some(m => !m.role || !m.ready)) return { ok: false, reason: 'no-todos-listos' };
    if (!spec.playable) return { ok: false, reason: 'cooperativo-en-desarrollo', room };
    room.status = 'en-curso';
    return { ok: true, room };
  }

  /* ---------- amigos, invitaciones y equipos ---------- */

  /** Carga las conexiones autorizadas del jugador desde el backend. */
  async loadFriends(player) { try { player.friends = new Set((await this.connections(player.uid)) || []); } catch (_) { player.friends = new Set(); } return player.friends; }

  #friend(player, pid) { for (const uid of player.friends) { const o = this.byUid.get(uid); if (o && o.pid === pid && o.friends.has(player.uid)) return o; } return null; }

  /** Conexiones mutuas que están ahora mismo en Ciudad ICADEM. De los demás jugadores no se revela nada. */
  friendsView(player) {
    const list = [];
    for (const uid of player.friends) {
      const o = this.byUid.get(uid); if (!o || !o.online || !o.friends.has(player.uid)) continue;
      const privacy = o.state ? SCENE_RULES[o.state.scene].privacy : 'private';
      list.push({ pid: o.pid, name: o.name, place: privacy === 'private' ? null : o.state.scene, sameInstance: o.instance === player.instance, inMyTeam: Boolean(player.room) && o.room === player.room, busy: Boolean(o.room) && o.room !== player.room });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  invite(from, toPid) {
    const to = this.#friend(from, String(toPid)); if (!to) return { ok: false, reason: 'no-es-conexion' };
    if (!to.online) return { ok: false, reason: 'no-disponible' };
    if (from.room && to.room === from.room) return { ok: false, reason: 'ya-en-tu-equipo' };
    if (from.room && from.room.members.size >= specOf(from.room).max) return { ok: false, reason: 'equipo-lleno' };
    const t = this.now(); for (const [id, i] of this.invites) if (i.exp <= t) this.invites.delete(id);
    for (const i of this.invites.values()) if (i.from === from && i.to === to) return { ok: false, reason: 'ya-invitado' };
    const invite = { id: 'inv-' + (++this.inviteSeq) + '-' + randomBytes(4).toString('hex'), from, to, exp: t + LIMITS.inviteMs };
    this.invites.set(invite.id, invite);
    return { ok: true, invite };
  }

  /** Respuesta del invitado. Al aceptar quedan en el mismo equipo y en la misma instancia. */
  answer(to, inviteId, accept) {
    const invite = this.invites.get(String(inviteId));
    if (!invite || invite.to !== to || invite.exp <= this.now()) return { ok: false, reason: 'invitacion-vencida' };
    this.invites.delete(invite.id);
    const from = invite.from;
    if (!accept) return { ok: true, accepted: false, from };
    if (!from.online || this.byUid.get(from.uid) !== from) return { ok: false, reason: 'no-disponible' };
    if (!from.room) this.createRoom(from, { mission: null });
    const room = from.room;
    if (room.members.size >= specOf(room).max) return { ok: false, reason: 'equipo-lleno' };
    let moved = null;
    if (to.instance !== from.instance) {
      if (from.instance.players.size >= this.capacity) return { ok: false, reason: 'instancia-llena' };
      moved = { from: to.instance, to: from.instance };
      to.instance.players.delete(to.pid); if (!to.instance.players.size) this.instances.delete(to.instance.id);
      from.instance.players.set(to.pid, to); to.instance = from.instance;
    }
    const left = this.leaveRoom(to);
    room.members.set(to.pid, { player: to, role: null, ready: false }); to.room = room;
    return { ok: true, accepted: true, from, room, moved, left };
  }

  /** El anfitrión reúne al equipo en la plaza (por ejemplo, al terminar una misión). */
  rally(player) {
    const room = player.room; if (!room) return { ok: false, reason: 'sin-sala' };
    if (room.host !== player.pid) return { ok: false, reason: 'solo-anfitrion' };
    return { ok: true, to: [...room.members.values()].map(m => m.player).filter(p => p.online) };
  }

  roster(instance) { return [...instance.players.values()].filter(p => p.online).map(p => ({ pid: p.pid, name: p.name, avatar: p.avatar, custom: p.custom })); }

  stats() { return { instances: this.instances.size, players: [...this.byUid.values()].filter(p => p.online).length, rooms: this.rooms.size, reports: this.reports.length }; }
}
