// Ciudad ICADEM · lógica del servidor de sesiones (sin sockets, para poder probarla).
//
// El servidor es la autoridad: decide quién entra, en qué instancia, qué posiciones son
// válidas, quién ve a quién y qué frases se reparten. El cliente solo propone.
import { createHash, randomBytes } from 'node:crypto';
import { decodeState, encodeState, NET_SCENES } from '../ciudad/js/net/network.js';
import { SCENE_RULES, ENTRY_RADIUS, COOP_MISSIONS } from '../ciudad/js/net/scenes.js';
import { phraseById, createRateLimiter, SAY_LIMIT, SAY_RADIUS } from '../ciudad/js/social/phrases.js';
import { coopCan, pendingApprovals } from '../ciudad/js/net/coop.js';
import { ChatGuard } from './chat.js';
import { MissionRun } from '../ciudad/js/missions/engine.js';
import { RACE, TREASURES, TREASURE_RADIUS, treasureRounds, validSeed } from '../ciudad/js/edu/activities.js';
import { MAZE, landmarkById } from '../ciudad/js/edu/district-rules.js';

/** Recorridos validados por posición: puntos en orden y puntuación por tiempo. */
const ROUTES = Object.freeze({ carrera: { ...RACE, par: 30, per: 1.5, away: 'fuera-del-parque' }, laberinto: { ...MAZE, away: 'fuera-del-distrito' } });

/** Equipo libre (sin misión): de 2 a 4 personas, sin roles. */
const TEAM = Object.freeze({ title: 'Equipo', min: 2, max: 4, roles: [], playable: false });
const specOf = room => COOP_MISSIONS[room.mission] || TEAM;

import { FLIGHTS, FLIGHT_TOLERANCE, FLIGHT_COOLDOWN_MS, flightPoint } from '../ciudad/js/vivo/flight.js';

export const LIMITS = Object.freeze({
  capacity: 16,          // jugadores por instancia (objetivo 10–20, sujeto a pruebas de carga)
  maxSpeed: 6.4 * 1.6,   // m/s: velocidad de carrera del juego + tolerancia por latencia
  slack: 1.5,            // m de holgura por irregularidad de la red
  maxGapS: 1.5,          // s: intervalo máximo que se considera entre dos estados seguidos
  resumeMs: 30000,       // tiempo que se guarda el lugar de alguien que perdió la conexión
  nameMax: 28,
  // Topes por tipo de acción (máximo, ventana en ms). Lo que los excede se descarta.
  actions: { s: [25, 1000], report: [5, 60000], room: [12, 60000], verify: [6, 60000], friends: [20, 60000], invite: [6, 60000], profile: [30, 60000], chat: [40, 60000], coop: [40, 10000], code: [10, 60000], quiz: [20, 60000], activity: [20, 60000], play: [40, 60000], vivo: [40, 60000] },
  inviteMs: 60000,       // una invitación sin responder caduca en un minuto
  coopLog: 400,          // acciones máximas de un intento en equipo
  coopPayload: 1500,     // bytes máximos de los datos de una acción en equipo
  codeMs: 30 * 60000,    // vigencia por omisión de un código de invitación (30 min; máximo 2 h)
  codeMaxMs: 2 * 3600000,
  codeUses: 3,           // usos por omisión de un código (máximo 5)
  codesPerPlayer: 3      // códigos activos por persona
});

/** Límites caminables de cada escenario (compartidos con el cliente). */
export const SCENE_BOUNDS = Object.freeze(Object.fromEntries(Object.entries(SCENE_RULES).map(([k, v]) => [k, v.bounds])));
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0/O ni 1/I para dictarlo sin errores

const cleanName = name => String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, LIMITS.nameMax) || 'Jugador';

export class Hub {
  /** connections: async uid → uids con los que tiene una conexión AUTORIZADA en ICADEM (la fuente es el backend, nunca el navegador). */
  constructor({ now = Date.now, capacity = LIMITS.capacity, salt = randomBytes(8).toString('hex'), connections = async () => [], onReport = null, missions = new Map() } = {}) {
    this.missions = missions; this.sessionSeq = 0;
    this.now = now; this.capacity = capacity; this.salt = salt; this.connections = connections; this.onReport = onReport; this.invites = new Map(); this.inviteSeq = 0;
    this.instances = new Map();   // id → { id, players: Map<pid, player> }
    this.byUid = new Map();       // uid → player
    this.reports = [];
    this.rooms = new Map();       // id → sala privada (sala de espera cooperativa)
    this.codes = new Map();       // código de invitación → sala
    this.seq = 0; this.roomSeq = 0;
    this.joinCodes = new Map();   // código temporal de invitación → { code, owner, room, uses, max, exp }
    this.chatGuard = new ChatGuard({ now: this.now });
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
  /* ---------- perfiles infantiles supervisados (modo familiar; apagado salvo CIUDAD_FAMILY=on) ---------- */

  /** ¿Son de la misma familia? (el perfil infantil y su adulto responsable, o perfiles infantiles del mismo adulto) */
  family(a, b) { return (a.minor ? a.guardian : a.uid) === (b.minor ? b.guardian : b.uid); }
  /** Un perfil infantil solo existe para su familia: nadie más lo ve, lo lista ni le habla. */
  sees(viewer, other) { return !(viewer.minor || other.minor) || this.family(viewer, other); }

  join({ uid, name, avatar = 'explorador', minor = false, guardian = null }) {
    const existing = this.byUid.get(uid);
    if (existing) {
      const replaced = existing.online;
      existing.online = true; existing.detachedAt = 0; existing.name = cleanName(name); existing.epoch++; existing.fresh = true;
      return { ok: true, player: existing, instance: existing.instance, resumed: true, replaced };
    }
    const instance = this.#pick();
    const player = {
      minor: Boolean(minor), guardian: minor ? guardian : null,
      uid, pid: this.publicId(uid), name: cleanName(name), avatar: String(avatar).slice(0, 24), instance,
      online: true, detachedAt: 0, epoch: 1, state: null, stateAt: 0, rejected: 0, fresh: true, room: null, friends: new Set(), custom: null, pet: null, listed: true,
      chat: { ok: false, blocked: new Set() },
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
    this.chatGuard.sweep();
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
    if (s.x < b.minX || s.x > b.maxX || s.z < b.minZ || s.z > b.maxZ || s.y < -0.5 || s.y > 30) return reject('fuera-del-mapa');
    const prev = player.state;
    // Vuelo en dragón autorizado: la posición debe ir sobre la ruta fija, en el momento que corresponde.
    const fl = player.flight;
    if (fl) {
      const f = FLIGHTS[fl.id], k = (t - fl.start) / fl.ms;
      if (k <= 1.15 && s.scene === f.scene) {
        const at = flightPoint(fl.id, Math.min(1, Math.max(0, k)));
        // tolerancia: la ruta en el instante del servidor o un poco antes (latencia del cliente)
        const near = [0, -0.02, -0.04].some(dk => { const q = flightPoint(fl.id, Math.min(1, Math.max(0, k + dk))); return Math.hypot(s.x - q.x, s.z - q.z) <= FLIGHT_TOLERANCE; });
        if (!near || s.y > f.cruise + 5) return reject('vuelo');
        player.state = s; player.stateAt = t; player.fresh = false;
        if (k >= 1 && s.y < 3 && Math.hypot(s.x - f.pad.x, s.z - f.pad.z) <= f.pad.r + 2.5) player.flight = null;   // aterrizó
        return { ok: true };
      }
      player.flight = null;
    }
    if (s.y > 6) return reject('fuera-del-mapa');
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
    // Perfiles infantiles: solo los ve su familia, y únicamente dentro de su propio equipo familiar.
    if ((viewer.minor || other.minor) && !(this.family(viewer, other) && viewer.room && viewer.room === other.room)) return false;
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
      if (!this.visible(other, player) || this.blockedPair(player, other)) continue;
      if (Math.hypot(other.state.x - player.state.x, other.state.z - player.state.z) <= SAY_RADIUS) to.push(other);
    }
    return { ok: true, to };
  }

  /* ---------- chat libre (solo cuentas adultas que aceptaron las normas) ---------- */

  /** Estado del chat de un jugador, a partir de lo guardado en su cuenta (profiles.chatState). */
  setChat(player, state, enabled = true) {
    player.chat = { ok: Boolean(enabled && !player.minor && state && state.adultAt && !state.off), blocked: new Set(((state && state.blocked) || []).map(b => b.uid)) };
  }

  /** ¿Alguno de los dos bloqueó al otro? Un bloqueo corta los mensajes en ambos sentidos. */
  blockedPair(a, b) { return Boolean((a.chat && a.chat.blocked.has(b.uid)) || (b.chat && b.chat.blocked.has(a.uid))); }

  /**
   * Mensaje libre. El autor es la sesión (no lo que diga el cliente). Lo reciben quienes comparten
   * instancia y escenario y además pueden verse (mismas reglas que las posiciones), tienen el chat
   * activo y no se bloquearon. `near` indica si está lo bastante cerca para ver la burbuja.
   * Los perfiles infantiles nunca envían ni reciben texto libre.
   */
  chat(player, raw) {
    if (player.minor) return { ok: false, reason: 'no-permitido' };
    if (!player.chat || !player.chat.ok) return { ok: false, reason: 'activa-chat' };
    if (!player.state || SCENE_RULES[player.state.scene].privacy === 'private') return { ok: false, reason: 'sin-audiencia' };
    const r = this.chatGuard.check(player.uid, raw);
    if (!r.ok) return r;
    const to = [];
    for (const other of player.instance.players.values()) {
      if (other === player || other.minor || !other.chat || !other.chat.ok || !this.visible(other, player) || this.blockedPair(player, other)) continue;
      to.push({ player: other, near: Math.hypot(other.state.x - player.state.x, other.state.z - player.state.z) <= SAY_RADIUS });
    }
    return { ok: true, msg: r.msg, to };
  }

  /** Bloqueo desde la ciudad: el destino se identifica por su pid público dentro de la misma instancia. */
  chatTarget(player, pid) { const t = player.instance.players.get(String(pid)); return t && t !== player && !t.minor ? t : null; }

  /** Reporte de un jugador hacia otro. Se guarda para moderación (máx. 500 en memoria) y, si hay
   *  un destino externo (onReport), también ahí; un fallo al persistir nunca rompe el reporte. */
  report(player, targetPid, reason, messageId = null) {
    const target = player.instance.players.get(String(targetPid));
    if (!target || target === player) return { ok: false };
    // Si el reporte es por el chat, se adjunta lo que el servidor registró de esa persona.
    const evidence = this.chatGuard.report(target.uid, player.uid, messageId);
    const entry = { at: this.now(), from: player.pid, target: target.pid, reason: String(reason || '').slice(0, 80), instance: player.instance.id,
      ...(evidence.message || evidence.recent.length ? { chat: { message: evidence.message, recent: evidence.recent } } : {}), ...(evidence.restricted ? { autoPause: true } : {}) };
    this.reports.push(entry);
    if (this.reports.length > 500) this.reports.shift();
    if (this.onReport) { try { Promise.resolve(this.onReport({ ...entry, fromPid: player.pid, targetPid: target.pid, fromUid: player.uid, targetUid: target.uid })).catch(() => {}); } catch (_) {} }
    return { ok: true };
  }

  /* ---------- salas privadas (sala de espera cooperativa) ---------- */

  roomView(room) {
    return { id: room.id, code: room.code, mission: room.mission, host: room.host, status: room.status, session: room.session && !room.session.done ? room.session.id : null,
      members: [...room.members.entries()].map(([pid, m]) => ({ pid, name: m.player.name, role: m.role, ready: m.ready, online: m.player.online })) };
  }

  createRoom(player, { mission } = {}) {
    if (player.minor) return { ok: false, reason: 'no-permitido' };
    if (mission !== null && mission !== undefined && !COOP_MISSIONS[mission]) return { ok: false, reason: 'mision-sin-cooperativo' };
    mission = mission ?? null;
    // Un equipo ya formado puede elegir misión sin deshacerse: lo decide su anfitrión.
    if (player.room && mission) { const r = player.room; if (r.host !== player.pid) return { ok: false, reason: 'solo-anfitrion' }; if (r.status === 'en-curso') return { ok: false, reason: 'en-curso' }; if (r.members.size > COOP_MISSIONS[mission].max) return { ok: false, reason: 'sala-llena' }; r.mission = mission; for (const m of r.members.values()) { m.role = null; m.ready = false; } return { ok: true, room: r }; }
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
    if ([...room.members.values()].some(m => !this.sees(player, m.player))) return { ok: false, reason: 'no-permitido' };
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
    if (room.status === 'en-curso') return { ok: false, reason: 'en-curso' };
    if (role === null || role === '') { me.role = null; me.ready = false; return { ok: true, room }; }
    if (!specOf(room).roles.some(r => r.id === role)) return { ok: false, reason: 'rol-desconocido' };
    for (const [pid, m] of room.members) if (pid !== player.pid && m.role === role) return { ok: false, reason: 'rol-ocupado' };
    me.role = role; me.ready = false;
    return { ok: true, room };
  }

  setReady(player, ready) {
    const room = player.room; if (!room) return { ok: false, reason: 'sin-sala' };
    const me = room.members.get(player.pid);
    if (room.status === 'en-curso') return { ok: false, reason: 'en-curso' };
    if (ready && !me.role) return { ok: false, reason: 'elige-un-rol' };
    me.ready = Boolean(ready);
    return { ok: true, room };
  }

  /** Valida que la sala esté completa e inicia el intento del equipo, que guarda el servidor. */
  startRoom(player) {
    const room = player.room; if (!room) return { ok: false, reason: 'sin-sala' };
    if (room.status === 'en-curso') return { ok: false, reason: 'en-curso' };
    const spec = specOf(room), members = [...room.members.values()];
    if (room.host !== player.pid) return { ok: false, reason: 'solo-anfitrion' };
    if (!room.mission) return { ok: false, reason: 'sin-mision' };
    if (members.length < spec.min) return { ok: false, reason: 'faltan-jugadores' };
    for (const r of spec.roles) if (r.required && !members.some(m => m.role === r.id)) return { ok: false, reason: 'falta-' + r.id };
    if (members.some(m => !m.role || !m.ready)) return { ok: false, reason: 'no-todos-listos' };
    if (!spec.playable) return { ok: false, reason: 'cooperativo-en-desarrollo', room };
    const def = this.missions.get(room.mission); if (!def) return { ok: false, reason: 'cooperativo-en-desarrollo', room };
    room.status = 'en-curso';
    room.session = { id: ++this.sessionSeq, mission: room.mission, run: new MissionRun(def), done: false, last: null };
    return { ok: true, room };
  }

  /* ---------- intento en equipo (lo guarda y valida el servidor) ---------- */

  onlineRoles(room) { return [...room.members.values()].filter(m => m.player.online && m.role).map(m => m.role); }

  /** Lo que todos los integrantes necesitan para reconstruir el intento: la bitácora validada. */
  coopView(room) {
    const s = room && room.session; if (!s) return null;
    return { session: s.id, mission: s.mission, log: s.run.log, done: s.done, last: s.last, roles: Object.fromEntries([...room.members.entries()].map(([pid, m]) => [pid, m.role])), online: this.onlineRoles(room) };
  }

  /**
   * Acción de un integrante sobre el intento del equipo. Se valida: que haya un intento en
   * curso, que la acción le toque a su rol, el consenso antes del paso final y las reglas del
   * motor. Lo que no procede se rechaza sin cambiar nada.
   */
  coopAct(player, type, payload) {
    const room = player.room, sess = room && room.session;
    if (!sess || sess.done || room.status !== 'en-curso') return { ok: false, reason: 'sin-intento' };
    const spec = specOf(room), me = room.members.get(player.pid);
    if (typeof type !== 'string' || !spec.permissions || !Object.prototype.hasOwnProperty.call(spec.permissions, type)) return { ok: false, reason: 'accion' };
    if (payload === null || payload === undefined) payload = {};
    if (typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, reason: 'datos' };
    let size = 0; try { size = JSON.stringify(payload).length; } catch (_) { return { ok: false, reason: 'datos' }; }
    if (size > LIMITS.coopPayload) return { ok: false, reason: 'datos' };
    payload = JSON.parse(JSON.stringify(payload));
    const online = this.onlineRoles(room);
    if (!coopCan(spec, type, payload, me.role, online)) return { ok: false, reason: 'no-es-tu-rol' };
    if (spec.consensus && type === spec.consensus.approve) payload = { role: me.role };   // el rol lo pone el servidor
    if (spec.consensus && type === spec.consensus.final && pendingApprovals(spec, sess.run.state, online).length) return { ok: false, reason: 'faltan-aprobaciones' };
    if (sess.run.log.length >= LIMITS.coopLog) return { ok: false, reason: 'bitacora-llena' };
    if (!sess.run.act(type, payload)) return { ok: false, reason: 'no-procede' };
    sess.last = { pid: player.pid, name: player.name, role: me.role, type };
    const result = sess.run.evaluate();
    if (result.valid) { sess.done = true; room.status = 'espera'; for (const m of room.members.values()) m.ready = false; }
    return { ok: true, room, session: sess, complete: result.valid, result };
  }

  /* ---------- amigos, invitaciones y equipos ---------- */

  /** Carga las conexiones autorizadas del jugador desde el backend. */
  async loadFriends(player) { try { player.friends = new Set((await this.connections(player.uid)) || []); } catch (_) { player.friends = new Set(); } return player.friends; }

  #friend(player, pid) { for (const uid of player.friends) { const o = this.byUid.get(uid); if (o && o.pid === pid && o.friends.has(player.uid)) return o; } return null; }

  /** Conexiones mutuas que están ahora mismo en Ciudad ICADEM. De los demás jugadores no se revela nada. */
  friendsView(player) {
    if (player.minor) return [];   // un perfil infantil no tiene conexiones profesionales
    const list = [];
    for (const uid of player.friends) {
      const o = this.byUid.get(uid); if (!o || !o.online || !o.friends.has(player.uid)) continue;
      const privacy = o.state ? SCENE_RULES[o.state.scene].privacy : 'private';
      list.push({ pid: o.pid, name: o.name, place: privacy === 'private' ? null : o.state.scene, sameInstance: o.instance === player.instance, inMyTeam: Boolean(player.room) && o.room === player.room, busy: Boolean(o.room) && o.room !== player.room });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  invite(from, toPid) {
    if (from.minor) return { ok: false, reason: 'no-permitido' };
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

  /** Nombre que ve `viewer`: quien eligió no aparecer en listas se muestra como «Jugador privado», salvo para sus conexiones mutuas. */
  nameFor(viewer, p) {
    if (!viewer || viewer === p || p.listed !== false) return p.name;
    if (viewer.friends.has(p.uid) && p.friends.has(viewer.uid)) return p.name;
    if (viewer.room && viewer.room === p.room) return p.name;
    return 'Jugador privado';
  }

  /** Jugadores reales conectados en la instancia (sin NPC), con el nombre que le corresponde ver a `viewer`. */
  roster(instance, viewer = null) { return [...instance.players.values()].filter(p => p.online && p !== viewer && (!viewer ? !p.minor : this.sees(viewer, p))).map(p => ({ pid: p.pid, name: this.nameFor(viewer, p), avatar: p.avatar, custom: p.custom, pet: p.pet })); }

  /** Presencia controlada por el servidor: solo cuenta sesiones conectadas (las desconectadas expiran en `resumeMs`). */
  presence(player) {
    let city = 0; for (const p of this.byUid.values()) if (p.online) city++;
    let instance = 0; for (const p of player.instance.players.values()) if (p.online) instance++;
    return { city, instance };
  }

  /* ---------- códigos temporales de invitación ---------- */

  #sweepCodes() { const t = this.now(); for (const [k, c] of this.joinCodes) if (c.exp <= t || c.uses >= c.max || !c.owner.room || c.owner.room !== c.room || !this.byUid.has(c.owner.uid)) this.joinCodes.delete(k); }
  codesOf(player) { this.#sweepCodes(); const t = this.now(); return [...this.joinCodes.values()].filter(c => c.owner === player).map(c => ({ code: c.code, usesLeft: c.max - c.uses, expiresIn: Math.max(0, Math.round((c.exp - t) / 1000)), mission: c.room.mission })); }

  /**
   * Crea un código para unirse al equipo de quien lo genera (si no tiene equipo, se crea uno).
   * El código no da acceso a ninguna cuenta: solo sirve a alguien que ya entró con su propia sesión
   * autorizada (piloto incluido). Vence, tiene usos limitados y se puede revocar.
   */
  createCode(player, { uses, minutes } = {}) {
    this.#sweepCodes();
    if (player.minor) return { ok: false, reason: 'no-permitido' };
    if ([...this.joinCodes.values()].filter(c => c.owner === player).length >= LIMITS.codesPerPlayer) return { ok: false, reason: 'demasiados-codigos' };
    if (!player.room) this.createRoom(player, { mission: null });
    const room = player.room;
    if (room.status === 'en-curso') return { ok: false, reason: 'en-curso' };
    if (room.members.size >= specOf(room).max) return { ok: false, reason: 'equipo-lleno' };
    const max = Math.min(5, Math.max(1, Math.round(Number(uses) || LIMITS.codeUses)));
    const ms = Math.min(LIMITS.codeMaxMs, Math.max(5 * 60000, (Number(minutes) || LIMITS.codeMs / 60000) * 60000));
    let code; do { code = Array.from(randomBytes(8), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''); } while (this.joinCodes.has(code) || this.codes.has(code));
    const entry = { code, owner: player, room, uses: 0, max, exp: this.now() + ms };
    this.joinCodes.set(code, entry);
    return { ok: true, code, room };
  }

  revokeCode(player, code) {
    const c = this.joinCodes.get(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (!c || c.owner !== player) return { ok: false, reason: 'codigo-invalido' };
    this.joinCodes.delete(c.code); return { ok: true };
  }

  /** Canjear un código: queda en el equipo (y en la misma instancia) de quien invitó. */
  redeemCode(player, code) {
    this.#sweepCodes();
    const c = this.joinCodes.get(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (!c) return { ok: false, reason: 'codigo-invalido' };
    const owner = c.owner, room = c.room;
    if (owner === player) return { ok: false, reason: 'es-tu-codigo' };
    if (!this.sees(player, owner) || [...room.members.values()].some(m => !this.sees(player, m.player))) return { ok: false, reason: 'no-permitido' };
    if (room.members.has(player.pid)) return { ok: true, room, owner, already: true };
    if (!owner.online) return { ok: false, reason: 'no-disponible' };
    if (room.status === 'en-curso') return { ok: false, reason: 'sala-cerrada' };
    if (room.members.size >= specOf(room).max) return { ok: false, reason: 'equipo-lleno' };
    let moved = null;
    if (player.instance !== owner.instance) {
      if (owner.instance.players.size >= this.capacity) return { ok: false, reason: 'instancia-llena' };
      moved = { from: player.instance, to: owner.instance };
      player.instance.players.delete(player.pid); if (!player.instance.players.size) this.instances.delete(player.instance.id);
      owner.instance.players.set(player.pid, player); player.instance = owner.instance;
    }
    const left = this.leaveRoom(player);
    room.members.set(player.pid, { player, role: null, ready: false }); player.room = room;
    c.uses++; if (c.uses >= c.max) this.joinCodes.delete(c.code);
    return { ok: true, room, owner, moved, left };
  }

  /* ---------- minijuegos validados por posición (carrera y búsqueda del tesoro) ---------- */

  /** Posición validada del jugador (la que el servidor ya aceptó), si es reciente. */
  #where(player, scene) { const st = player.state; return st && st.scene === scene && this.now() - player.stateAt < 2500 ? st : null; }

  playStart(player, game, seed) {
    if (this.flying(player)) return { ok: false, reason: 'en-vuelo' };   // la montura no sirve de atajo
    const route = ROUTES[game];
    if (route) { if (!this.#where(player, route.scene)) return { ok: false, reason: route.away }; player.play = { game, next: 0, at: this.now() }; return { ok: true, next: 0 }; }
    if (game === 'tesoro') {
      if (!validSeed(seed)) return { ok: false, reason: 'datos' };
      if (!this.#where(player, 'plaza')) return { ok: false, reason: 'fuera-de-la-plaza' };
      player.play = { game, rounds: treasureRounds(seed), round: 0, found: [], at: this.now() }; return { ok: true, round: 0, items: player.play.rounds[0] };
    }
    return { ok: false, reason: 'juego-desconocido' };
  }

  /**
   * Punto de control o tesoro: procede solo si la ÚLTIMA posición que el servidor aceptó (con su
   * control de velocidad y de puertas) está junto al punto. El navegador no puede «llegar» por decirlo.
   */
  playCheck(player, payload = {}) {
    if (this.flying(player)) return { ok: false, reason: 'en-vuelo' };
    const run = player.play; if (!run) return { ok: false, reason: 'sin-partida' };
    const route = ROUTES[run.game];
    if (route) {
      const st = this.#where(player, route.scene), i = payload.i, cp = route.checkpoints[run.next];
      if (!st) return { ok: false, reason: route.away };
      if (i !== run.next || !cp) return { ok: false, reason: 'fuera-de-orden' };
      if (Math.hypot(st.x - cp[0], st.z - cp[1]) > route.radius + 0.6 || st.y < (cp[2] || 0) - 0.35) return { ok: false, reason: 'lejos' };
      run.next++;
      if (run.next < route.checkpoints.length) return { ok: true, next: run.next };
      const seconds = (this.now() - run.at) / 1000; player.play = null;
      if (seconds < route.minSeconds) return { ok: false, reason: 'imposible' };
      return { ok: true, done: true, game: run.game, seconds: Math.round(seconds), score: Math.max(50, Math.min(100, Math.round(100 - Math.max(0, seconds - route.par) * route.per))) };
    }
    const st = this.#where(player, 'plaza'), t = TREASURES.find(x => x.id === payload.id), round = run.rounds[run.round];
    if (!st) return { ok: false, reason: 'fuera-de-la-plaza' };
    if (!t || !round.includes(t.id) || run.found.includes(t.id)) return { ok: false, reason: 'no-es-de-esta-ronda' };
    if (Math.hypot(st.x - t.at[0], st.z - t.at[1]) > TREASURE_RADIUS + 0.6) return { ok: false, reason: 'lejos' };
    run.found.push(t.id);
    if (round.every(id => run.found.includes(id))) {
      run.round++;
      if (run.round >= run.rounds.length) { const seconds = (this.now() - run.at) / 1000; player.play = null; return { ok: true, done: true, game: 'tesoro', seconds: Math.round(seconds), score: Math.max(60, Math.min(100, Math.round(100 - Math.max(0, seconds - 240) / 6))) }; }
      return { ok: true, found: t.id, round: run.round, items: run.rounds[run.round] };
    }
    return { ok: true, found: t.id, round: run.round };
  }

  playQuit(player) { player.play = null; return { ok: true }; }

  /** Ruta del explorador: el sitio cuenta solo si la última posición aceptada está ahí. */
  discover(player, id) {
    if (this.flying(player)) return { ok: false, reason: 'en-vuelo' };
    const l = landmarkById(String(id)); if (!l) return { ok: false, reason: 'sitio-desconocido' };
    const st = this.#where(player, l.scene);
    if (!st || Math.hypot(st.x - l.at[0], st.z - l.at[1]) > l.r + 0.6) return { ok: false, reason: 'lejos' };
    return { ok: true, id: l.id };
  }

  /**
   * Vuelo panorámico en el Gran dragón de viaje. Solo desde el helipuerto, sin partidas ni misiones en
   * curso y con una pausa entre vuelos. Durante el vuelo no se descubren sitios ni se juega.
   */
  startFlight(player, id, hasDragon) {
    const f = FLIGHTS[id], t = this.now();
    if (!f) return { ok: false, reason: 'ruta' };
    if (!hasDragon) return { ok: false, reason: 'sin-dragon' };
    if (player.flight && t - player.flight.start < player.flight.ms * 1.15) return { ok: false, reason: 'en-vuelo' };
    if (player.play || (player.room && player.room.session && !player.room.session.done)) return { ok: false, reason: 'ocupado' };
    if (player.lastFlight && t - player.lastFlight < f.seconds * 1000 + FLIGHT_COOLDOWN_MS) return { ok: false, reason: 'espera' };
    const st = this.#where(player, f.scene); if (!st || Math.hypot(st.x - f.pad.x, st.z - f.pad.z) > f.pad.r + 1.6) return { ok: false, reason: 'lejos' };
    player.flight = { id, start: t, ms: f.seconds * 1000 }; player.lastFlight = t;
    return { ok: true, route: id, seconds: f.seconds };
  }
  flying(player) { return Boolean(player.flight && this.now() - player.flight.start < player.flight.ms * 1.15); }

  stats() { return { instances: this.instances.size, players: [...this.byUid.values()].filter(p => p.online).length, rooms: this.rooms.size, reports: this.reports.length }; }
}
