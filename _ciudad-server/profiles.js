// Ciudad ICADEM · progreso guardado en el servidor, asociado al usuario autenticado.
//
// Nada de lo que hay aquí viene "dictado" por el navegador: el cliente envía ACCIONES
// (la bitácora de una misión, "descubrí este edificio", "quiero este avatar") y el servidor
// decide el resultado con las mismas reglas del juego. XP, logros y recompensas se calculan aquí.
//
// Los créditos que aparecen son DE PRUEBA (testCredits): un contador propio del juego, separado
// de la cartera real de ICADEM, que este servicio no conoce ni toca.
//
// Almacenamiento: interfaz { load(uid), save(uid, perfil) }. Hay dos adaptadores para pruebas
// (memoria y archivo JSON local). El adaptador de la base de datos real queda pendiente de
// autorización: no se escribe en producción desde aquí.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { replay } from '../ciudad/js/missions/engine.js';
import { emptyProfile, cleanCustom, isAvatarUnlocked, deriveAchievements, BUILDING_IDS, VISIT_XP, TUTORIAL_XP, TUTORIAL_CREDITS, PROFILE_VERSION } from '../ciudad/js/progress/rules.js';

export class MemoryStorage {
  constructor() { this.map = new Map(); }
  async load(uid) { const raw = this.map.get(uid); return raw ? JSON.parse(raw) : null; }
  async save(uid, profile) { this.map.set(uid, JSON.stringify(profile)); }
}

/** Un archivo por usuario (nombre = hash del uid). Solo para el entorno de pruebas. */
export class JsonFileStorage {
  constructor(dir) { this.dir = dir; mkdirSync(dir, { recursive: true }); }
  #file(uid) { return path.join(this.dir, createHash('sha256').update(uid).digest('hex').slice(0, 32) + '.json'); }
  async load(uid) { const f = this.#file(uid); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; }
  async save(uid, profile) { writeFileSync(this.#file(uid), JSON.stringify(profile)); }
}

export class Profiles {
  /** missions: Map<id, definición>; rewards: { id: { amount, xp, repeatXp } } */
  constructor({ storage = new MemoryStorage(), missions, rewards = {} }) { this.storage = storage; this.missions = missions; this.rewards = rewards; this.locks = new Map(); }

  /** Las operaciones de un mismo usuario se encadenan: dos dispositivos a la vez no se pisan. */
  #serial(uid, fn) {
    // Si el guardado detecta que otro proceso escribió entre la lectura y la escritura, se repite desde una lectura nueva.
    const run = async () => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (e && e.code === 'conflict' && i < 3) continue; throw e; } } };
    const next = (this.locks.get(uid) || Promise.resolve()).then(run, run); this.locks.set(uid, next.catch(() => {})); return next;
  }

  async #read(uid) {
    const saved = await this.storage.load(uid);
    if (!saved || saved.v !== PROFILE_VERSION) return emptyProfile();
    return { ...emptyProfile(), ...saved, custom: cleanCustom(saved.custom) };
  }
  async #write(uid, p) { p.achievements = deriveAchievements(p); p.rev++; p.updatedAt = Date.now(); await this.storage.save(uid, p); return p; }

  /** Lo que se le entrega al cliente (sin historial interno). */
  view(p) { const { testLedger, ...rest } = p; return { ...rest, testMoves: testLedger.length }; }

  get(uid) { return this.#serial(uid, async () => this.view(await this.#read(uid))); }

  completeMission(uid, missionId, log) {
    return this.#serial(uid, async () => {
      const def = this.missions.get(String(missionId)); if (!def) return { ok: false, reason: 'mision-desconocida' };
      if (!Array.isArray(log) || log.length > 400) return { ok: false, reason: 'bitacora-invalida' };
      const check = replay(def, log);
      if (!check.ok || !check.result.valid) return { ok: false, reason: 'bitacora-invalida' };
      const p = await this.#read(uid), before = p.missions[def.id] || { completed: false, bestScore: 0, attempts: 0 }, result = check.result;
      const reward = this.rewards[def.id] || def.reward, first = result.passed && !before.completed;
      p.missions[def.id] = { completed: before.completed || result.passed, bestScore: Math.max(before.bestScore, result.score), attempts: before.attempts + 1, lastScore: result.score };
      let credits = 0, xp = 0;
      if (result.passed) {
        xp = first ? reward.xp : reward.repeatXp; p.xp += xp;
        const key = 'mission:' + def.id;
        if (!p.testLedger.some(e => e.key === key)) { credits = reward.amount; p.testCredits += credits; p.testLedger.push({ key, amount: credits, at: Date.now() }); }
      }
      return { ok: true, score: result.score, passed: result.passed, credits, xp, profile: this.view(await this.#write(uid, p)) };
    });
  }

  visit(uid, building) {
    return this.#serial(uid, async () => {
      if (!BUILDING_IDS.includes(building)) return { ok: false, reason: 'edificio-desconocido' };
      const p = await this.#read(uid); if (p.visited.includes(building)) return { ok: true, profile: this.view(p) };
      p.visited.push(building); p.xp += VISIT_XP;
      return { ok: true, profile: this.view(await this.#write(uid, p)) };
    });
  }

  tutorial(uid) {
    return this.#serial(uid, async () => {
      const p = await this.#read(uid); if (p.tutorialDone) return { ok: true, profile: this.view(p) };
      p.tutorialDone = true; p.xp += TUTORIAL_XP; p.testCredits += TUTORIAL_CREDITS; p.testLedger.push({ key: 'tutorial', amount: TUTORIAL_CREDITS, at: Date.now() });
      return { ok: true, profile: this.view(await this.#write(uid, p)) };
    });
  }

  setAvatar(uid, avatarId, custom) {
    return this.#serial(uid, async () => {
      const p = await this.#read(uid);
      if (!isAvatarUnlocked(String(avatarId), p)) return { ok: false, reason: 'avatar-bloqueado', profile: this.view(p) };
      p.avatarId = String(avatarId); p.custom = cleanCustom(custom);
      return { ok: true, profile: this.view(await this.#write(uid, p)) };
    });
  }
}
