// Ciudad ICADEM · lógica del servidor de sesiones (sin sockets, para poder probarla).
//
// El servidor es la autoridad: decide quién entra, en qué instancia, qué posiciones son
// válidas, quién ve a quién y qué frases se reparten. El cliente solo propone.
import { createHash, randomBytes } from 'node:crypto';
import { decodeState, encodeState, NET_SCENES, PRIVATE_SCENES } from '../ciudad/js/net/network.js';
import { phraseById, createRateLimiter, SAY_LIMIT, SAY_RADIUS } from '../ciudad/js/social/phrases.js';

export const LIMITS = Object.freeze({
  capacity: 16,          // jugadores por instancia (objetivo 10–20, sujeto a pruebas de carga)
  maxSpeed: 6.4 * 1.6,   // m/s: velocidad de carrera del juego + tolerancia por latencia
  maxStep: 14,           // m: salto máximo entre dos estados seguidos dentro del mismo escenario
  resumeMs: 30000,       // tiempo que se guarda el lugar de alguien que perdió la conexión
  nameMax: 28
});

/** Límites caminables de cada escenario (los mismos del cliente, con un pequeño margen). */
export const SCENE_BOUNDS = Object.freeze({
  room: { minX: -5, maxX: 5, minZ: -4.6, maxZ: 4.6 },
  plaza: { minX: -47, maxX: 47, minZ: -47, maxZ: 47 },
  bank: { minX: -9.6, maxX: 9.6, minZ: -7.6, maxZ: 7.6 }
});

const cleanName = name => String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, LIMITS.nameMax) || 'Jugador';

export class Hub {
  constructor({ now = Date.now, capacity = LIMITS.capacity, salt = randomBytes(8).toString('hex') } = {}) {
    this.now = now; this.capacity = capacity; this.salt = salt;
    this.instances = new Map();   // id → { id, players: Map<pid, player> }
    this.byUid = new Map();       // uid → player
    this.reports = [];
    this.seq = 0;
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
      existing.online = true; existing.detachedAt = 0; existing.name = cleanName(name); existing.epoch++;
      return { ok: true, player: existing, instance: existing.instance, resumed: true, replaced };
    }
    const instance = this.#pick();
    const player = {
      uid, pid: this.publicId(uid), name: cleanName(name), avatar: String(avatar).slice(0, 24), instance,
      online: true, detachedAt: 0, epoch: 1, state: null, stateAt: 0, rejected: 0,
      allowSay: createRateLimiter(SAY_LIMIT)
    };
    instance.players.set(player.pid, player); this.byUid.set(uid, player);
    return { ok: true, player, instance, resumed: false, replaced: false };
  }

  /** Se perdió la conexión: se conserva el lugar un rato para que pueda volver. */
  detach(player) { player.online = false; player.detachedAt = this.now(); }

  remove(player) {
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
   * Estado propuesto por un cliente. Si es imposible (fuera del mapa, teletransporte, velocidad
   * irreal) se rechaza y se devuelve el último estado válido para corregir al cliente.
   */
  state(player, encoded) {
    const s = decodeState(encoded), t = this.now();
    const reject = reason => { player.rejected++; return { ok: false, reason, fix: player.state ? encodeState(player.state) : null }; };
    if (!s || !NET_SCENES.includes(s.scene)) return reject('formato');
    const b = SCENE_BOUNDS[s.scene];
    if (s.x < b.minX || s.x > b.maxX || s.z < b.minZ || s.z > b.maxZ || s.y < -0.5 || s.y > 6) return reject('fuera-del-mapa');
    const prev = player.state;
    if (prev && prev.scene === s.scene) {
      const dist = Math.hypot(s.x - prev.x, s.z - prev.z), dt = Math.max(0.05, (t - player.stateAt) / 1000);
      if (dist > LIMITS.maxStep || dist / dt > LIMITS.maxSpeed) return reject('velocidad');
    }
    player.state = s; player.stateAt = t;
    return { ok: true };
  }

  /** ¿`viewer` puede ver a `other`? Mismo escenario compartido de la misma instancia. */
  visible(viewer, other) {
    return viewer !== other && other.online && other.state && viewer.state &&
      viewer.instance === other.instance && viewer.state.scene === other.state.scene &&
      !PRIVATE_SCENES.includes(other.state.scene);
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
    if (!player.state || PRIVATE_SCENES.includes(player.state.scene)) return { ok: false, reason: 'sin-audiencia' };
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

  roster(instance) { return [...instance.players.values()].filter(p => p.online).map(p => ({ pid: p.pid, name: p.name, avatar: p.avatar })); }

  stats() { return { instances: this.instances.size, players: [...this.byUid.values()].filter(p => p.online).length, reports: this.reports.length }; }
}
