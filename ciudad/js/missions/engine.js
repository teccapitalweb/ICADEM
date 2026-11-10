// Motor de misiones de Ciudad ICADEM — módulo puro (sin DOM ni Three.js).
//
// Una misión se declara una sola vez (identificador, edificio, dificultad, objetivos, acciones
// permitidas, evaluación y recompensa) y el motor se encarga de lo común a los diez juegos:
// estados, orden de los pasos, bitácora de acciones, reintentos, registro de finalización y
// recompensa sin duplicados.
//
// Regla de seguridad: el resultado NUNCA se toma de un marcador del navegador. Se reconstruye
// reproduciendo la bitácora de acciones (`replay`). Este mismo archivo es el que debe ejecutar
// el servidor antes de acreditar créditos reales.

/** Rango de créditos permitido por dificultad (configurable desde administración más adelante). */
export const DIFFICULTY = Object.freeze({
  sencilla: { label: 'Sencilla', min: 10, max: 15 },
  intermedia: { label: 'Intermedia', min: 20, max: 20 },
  dificil: { label: 'Difícil', min: 25, max: 25 }
});

const fail = message => { throw new Error('[misiones] ' + message); };

/** Valida y congela la definición de una misión. */
export function defineMission(def) {
  for (const key of ['id', 'building', 'title', 'difficulty', 'objectives', 'actions', 'newState', 'evaluate', 'reward']) {
    if (def[key] === undefined || def[key] === null) fail(`a la misión ${def.id || '(sin id)'} le falta "${key}"`);
  }
  const level = DIFFICULTY[def.difficulty] || fail(`dificultad desconocida: ${def.difficulty}`);
  if (!Array.isArray(def.objectives) || !def.objectives.length) fail(`${def.id}: necesita al menos un objetivo`);
  const seen = new Set();
  for (const o of def.objectives) {
    if (!o.id || !o.text || typeof o.done !== 'function') fail(`${def.id}: objetivo mal definido`);
    if (seen.has(o.id)) fail(`${def.id}: objetivo repetido "${o.id}"`);
    seen.add(o.id);
  }
  for (const [name, action] of Object.entries(def.actions)) if (typeof action.apply !== 'function') fail(`${def.id}: la acción "${name}" no tiene apply()`);
  const { amount, xp, repeatXp } = def.reward;
  if (!Number.isInteger(amount) || amount < level.min || amount > level.max) fail(`${def.id}: una misión ${level.label.toLowerCase()} entrega entre ${level.min} y ${level.max} créditos`);
  if (!Number.isInteger(xp) || xp < 0 || !Number.isInteger(repeatXp) || repeatXp < 0) fail(`${def.id}: XP inválida`);
  return Object.freeze({ passScore: 70, cooperative: false, ...def });
}

/** Un intento en curso de una misión. */
export class MissionRun {
  constructor(def) {
    this.def = def;
    this.state = def.newState();
    this.log = [];
    this.status = 'active';   // active → finished
  }

  /** ¿La acción está permitida en este momento? (bloquea atajos y pasos fuera de orden) */
  can(type, payload = {}) {
    const action = this.def.actions[type];
    return this.status === 'active' && Boolean(action) && (!action.when || action.when(this.state, payload) === true);
  }

  /** Ejecuta una acción del jugador. Devuelve false si no procede (y no cambia nada). */
  act(type, payload = {}) {
    if (!this.can(type, payload)) return false;
    this.def.actions[type].apply(this.state, payload);
    this.log.push({ type, payload: { ...payload } });
    return true;
  }

  /** Objetivos con su estado: el primero sin cumplir es el activo. */
  get objectives() {
    let found = false;
    return this.def.objectives.map(o => {
      const done = o.done(this.state) === true;
      const active = !done && !found;
      if (active) found = true;
      return { id: o.id, text: o.text, done, active, detail: active && o.detail ? o.detail(this.state) : null };
    });
  }

  /** Identificador del objetivo activo, o 'done' si ya no falta ninguno. */
  get current() { const o = this.objectives.find(x => x.active); return o ? o.id : 'done'; }
  get ready() { return this.objectives.every(o => o.done); }
  evaluate() { return this.def.evaluate(this.state); }
}

/**
 * Reproduce una bitácora desde cero. Es la validación que corre antes de dar una recompensa:
 * si alguna acción no era válida en ese punto, el intento se rechaza.
 */
export function replay(def, log) {
  const run = new MissionRun(def);
  if (!Array.isArray(log)) return { ok: false, at: 0, run };
  for (let i = 0; i < log.length; i++) {
    const entry = log[i] || {};
    if (!run.act(entry.type, entry.payload || {})) return { ok: false, at: i, run };
  }
  return { ok: true, run, result: run.evaluate() };
}

/** Catálogo de misiones disponibles. */
export class MissionRegistry {
  constructor() { this.map = new Map(); }
  register(def) { if (this.map.has(def.id)) fail(`misión duplicada: ${def.id}`); this.map.set(def.id, def); return def; }
  get(id) { return this.map.get(id) || null; }
  list() { return [...this.map.values()]; }
  byBuilding(building) { return this.list().filter(d => d.building === building); }
}

const EMPTY_RECORD = Object.freeze({ completed: false, bestScore: 0, attempts: 0 });

/**
 * Servicio de misiones: inicia intentos, valida el cierre, guarda el registro y entrega la
 * recompensa una sola vez.
 *
 *  progress: { get(id), set(id, record), addXp(n) }   → hoy guarda en el dispositivo; el mismo
 *            contrato lo cumplirá el adaptador del backend (progreso entre dispositivos).
 *  economy:  { grant({ key, amount, reason }) }       → economía de prueba o cartera real.
 *  rewards:  { [missionId]: { amount, xp, repeatXp } } → importes configurables; si no hay
 *            entrada para una misión se usa la recompensa de su definición.
 */
export class MissionService {
  constructor({ registry, progress, economy, rewards = {} }) {
    this.registry = registry; this.progress = progress; this.economy = economy; this.rewards = rewards;
  }

  rewardFor(id) { const def = this.registry.get(id); return this.rewards[id] || (def ? def.reward : null); }
  record(id) { return { ...EMPTY_RECORD, ...(this.progress.get(id) || {}) }; }
  start(id) { const def = this.registry.get(id); if (!def) fail(`misión desconocida: ${id}`); return new MissionRun(def); }

  async complete(run) {
    if (run.status !== 'active') return { ok: false, reason: 'closed' };
    const check = replay(run.def, run.log);
    if (!check.ok) return { ok: false, reason: 'invalid-log' };
    const result = check.result;
    if (!result.valid) return { ok: false, reason: 'incomplete', result };
    run.status = 'finished';

    const id = run.def.id, before = this.record(id), reward = this.rewardFor(id);
    const firstPass = result.passed && !before.completed;
    const record = {
      completed: before.completed || result.passed,
      bestScore: Math.max(before.bestScore || 0, result.score),
      attempts: (before.attempts || 0) + 1,
      lastScore: result.score
    };
    this.progress.set(id, record);

    let credits = 0, xp = 0, duplicate = false;
    if (result.passed) {
      // Llave estable por misión: aunque el cierre se dispare dos veces, solo acredita una.
      const grant = await this.economy.grant({ key: 'mission:' + id, amount: reward.amount, reason: 'Misión: ' + run.def.title });
      credits = grant.granted ? grant.amount : 0;
      duplicate = Boolean(grant.duplicate);
      xp = firstPass ? reward.xp : reward.repeatXp;
      if (xp) this.progress.addXp(xp);
    }
    return { ok: true, result, record, firstPass, credits, xp, duplicate };
  }
}
