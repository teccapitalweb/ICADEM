// Guardado del PROTOTIPO. Todo lo que vive aquí son datos de prueba, aislados por dispositivo.
// En Fase 3 este módulo se sustituye por el backend (avatar, inventario, misiones, XP y logros
// deben guardarse en servidor para sincronizar entre dispositivos). No es la fuente de créditos reales.

export const STORE_KEY = 'ciudad-icadem:prototipo:v1';

export const LEVELS = [0, 80, 200, 380, 620, 920, 1300, 1760, 2300, 2920];

export function levelFromXp(xp) {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) level = i + 1;
  const base = LEVELS[level - 1] ?? 0;
  const next = LEVELS[level] ?? null;
  return { level, base, next, progress: next ? (xp - base) / (next - base) : 1 };
}

export function defaultState() {
  return {
    version: 1,
    tutorialDone: false,
    xp: 0,
    avatarId: 'explorador',
    missions: {},        // { [missionId]: { completed, bestScore, attempts } }
    visited: [],         // ids de edificios explorados
    achievements: [],    // ids de logros
    economy: { balance: 0, ledger: [] }, // SOLO créditos de prueba
    settings: { quality: 'auto', sensitivity: 1, invertY: false, muted: [] }
  };
}

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } };
}

export class Store {
  constructor(storage) {
    let s = storage;
    if (!s) { try { s = globalThis.localStorage; s.getItem(STORE_KEY); } catch (_) { s = null; } }
    this.storage = s || memoryStorage();
    this.persistent = Boolean(s);
    this.state = this.#load();
    this.listeners = new Set();
  }

  #load() {
    const base = defaultState();
    try {
      const raw = this.storage.getItem(STORE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      if (!saved || saved.version !== 1) return base;
      return {
        ...base, ...saved,
        missions: { ...saved.missions },
        visited: Array.isArray(saved.visited) ? saved.visited : [],
        achievements: Array.isArray(saved.achievements) ? saved.achievements : [],
        economy: { balance: Number(saved.economy?.balance) || 0, ledger: Array.isArray(saved.economy?.ledger) ? saved.economy.ledger : [] },
        settings: { ...base.settings, ...saved.settings }
      };
    } catch (_) { return base; }
  }

  save() {
    try { this.storage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (_) { /* almacenamiento lleno o bloqueado */ }
    this.listeners.forEach(fn => { try { fn(this.state); } catch (_) {} });
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  addXp(amount) {
    const before = levelFromXp(this.state.xp).level;
    this.state.xp += Math.max(0, Math.round(amount));
    this.save();
    return { leveledUp: levelFromXp(this.state.xp).level > before, level: levelFromXp(this.state.xp).level };
  }

  unlock(achievementId) {
    if (this.state.achievements.includes(achievementId)) return false;
    this.state.achievements.push(achievementId);
    this.save();
    return true;
  }

  visit(buildingId) {
    if (this.state.visited.includes(buildingId)) return false;
    this.state.visited.push(buildingId);
    this.save();
    return true;
  }

  reset() {
    this.state = defaultState();
    try { this.storage.removeItem(STORE_KEY); } catch (_) {}
    this.save();
  }
}
