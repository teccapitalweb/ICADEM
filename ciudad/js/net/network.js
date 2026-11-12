// Capa de red de Ciudad ICADEM — preparada para multijugador (Fase 2).
//
// En Fase 1 el juego usa OfflineAdapter: no hay otros jugadores y NO se simulan.
// Lo que sí queda listo desde ahora:
//   · el formato del estado que cada cliente envía (encodeState / decodeState),
//   · el ritmo de envío (NET_TICK_HZ) separado del ritmo de dibujo,
//   · la interfaz que debe cumplir el adaptador real (WebSocket contra un servidor autoritativo).
//
// Diseño previsto del servidor (requiere infraestructura nueva, ver CIUDAD_ICADEM.md):
//   · Servicio Node en Railway con WebSocket, salas de 10 a 20 jugadores por escena.
//   · Entrada autenticada con el ID token de Firebase que ya usa ICADEM.
//   · El servidor valida posición (velocidad máxima), interacciones, resultados y recompensas.

export const NET_TICK_HZ = 10;
// Las animaciones nuevas se agregan SIEMPRE al final: el índice viaja por la red.
export const ANIMS = Object.freeze(['idle', 'walk', 'run', 'jump', 'wave', 'celebrate', 'sit', 'interact', 'beckon', 'clap', 'point', 'help']);
/** Escenarios que existen en la red. La habitación es privada: nunca se comparte con otros jugadores. */
export const NET_SCENES = Object.freeze(['room', 'plaza', 'bank', 'court', 'market', 'site', 'hospital', 'vet', 'restaurant', 'greenhouse']);
export const PRIVATE_SCENES = Object.freeze(['room']);

const q = (v, step) => Math.round(v / step);

/** Estado compacto de un jugador: [escena, x, y, z, rumbo, animación]. */
export function encodeState(s) {
  const anim = Math.max(0, ANIMS.indexOf(s.anim));
  return [String(s.scene || ''), q(s.x, 0.01), q(s.y, 0.01), q(s.z, 0.01), q(((s.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), 0.01), anim];
}

export function decodeState(a) {
  if (!Array.isArray(a) || a.length < 6) return null;
  const nums = a.slice(1, 5).map(Number);
  if (nums.some(n => !Number.isFinite(n))) return null;
  return { scene: String(a[0]), x: nums[0] * 0.01, y: nums[1] * 0.01, z: nums[2] * 0.01, yaw: nums[3] * 0.01, anim: ANIMS[a[5]] || 'idle' };
}

/** Interfaz común de los adaptadores de red. */
export class NetworkAdapter {
  constructor() { this.handlers = { join: new Set(), leave: new Set(), state: new Set(), snap: new Set(), say: new Set(), status: new Set(), fix: new Set(), room: new Set(), profile: new Set(), friends: new Set(), invite: new Set(), invited: new Set(), party: new Set(), look: new Set() }; this.connected = false; }
  get isOnline() { return false; }
  async connect() { this.connected = true; }
  disconnect() { this.connected = false; }
  /** Envía el estado propio (ya codificado). */
  sendState(_encoded) {}
  /** Envía una frase rápida (identificador de la lista cerrada). */
  say(_phraseId) { return false; }
  profile() { return false; }
  friends() { return false; }
  on(event, fn) { this.handlers[event]?.add(fn); return () => this.handlers[event]?.delete(fn); }
  emit(event, payload) { this.handlers[event]?.forEach(fn => fn(payload)); }
}

/** Un solo jugador. No emite jugadores remotos de ningún tipo. */
export class OfflineAdapter extends NetworkAdapter {}

/** Limita el envío de estado al ritmo de red, sin importar los cuadros por segundo. */
export class StateSync {
  constructor(adapter, hz = NET_TICK_HZ) { this.adapter = adapter; this.interval = 1 / hz; this.acc = 0; this.last = null; this.sent = 0; }
  update(dt, getState) {
    this.acc += dt;
    if (this.acc < this.interval) return false;
    this.acc %= this.interval;
    const encoded = encodeState(getState());
    const key = encoded.join(',');
    if (key === this.last) return false;   // sin cambios: no se gasta red
    this.last = key;
    this.adapter.sendState(encoded);
    this.sent++;
    return true;
  }
}
