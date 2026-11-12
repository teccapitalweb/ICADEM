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
import { questionById } from '../ciudad/js/edu/questions.js';
import { FAMILY_MAX, AGE_BANDS, KID_MISSIONS, cleanAlias } from '../ciudad/js/edu/family.js';
import { checkActivity, ACTIVITIES } from '../ciudad/js/edu/activities.js';
import { cleanPlay, rewardQuiz, rewardActivity } from '../ciudad/js/edu/play-rules.js';
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
    return { ...emptyProfile(), ...saved, custom: cleanCustom(saved.custom), play: cleanPlay(saved.play), privacy: { listed: !(saved.privacy && saved.privacy.listed === false) } };
  }
  async #write(uid, p) { p.achievements = deriveAchievements(p); p.rev++; p.updatedAt = Date.now(); await this.storage.save(uid, p); return p; }

  /** Lo que se le entrega al cliente (sin historial interno). */
  view(p) { const { testLedger, ...rest } = p; return { ...rest, testMoves: testLedger.length }; }

  get(uid) { return this.#serial(uid, async () => this.view(await this.#read(uid))); }

  completeMission(uid, missionId, log, { minor = false } = {}) {
    return this.#serial(uid, async () => {
      const def = this.missions.get(String(missionId)); if (!def) return { ok: false, reason: 'mision-desconocida' };
      if (minor && !KID_MISSIONS.includes(def.id)) return { ok: false, reason: 'mision-no-disponible' };
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
        if (!minor && !p.testLedger.some(e => e.key === key)) { credits = reward.amount; p.testCredits += credits; p.testLedger.push({ key, amount: credits, at: Date.now() }); }
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

  /**
   * Reto de un NPC: la respuesta correcta sale del banco del servidor, no del navegador. Da XP con
   * límites (tope diario y una vez por pregunta cada 7 días). Nunca toca créditos.
   */
  answerQuiz(uid, questionId, choice, now = Date.now()) {
    return this.#serial(uid, async () => {
      const qn = questionById(String(questionId || ''));
      if (!qn || !Number.isInteger(choice) || choice < 0 || choice >= qn.options.length) return { ok: false, reason: 'pregunta-invalida' };
      const p = await this.#read(uid), correct = choice === qn.answer, r = rewardQuiz(p.play, qn.id, correct, now);
      p.xp += r.xp;
      return { ok: true, correct, answer: qn.answer, explain: qn.explain, xp: r.xp, why: r.why, profile: this.view(await this.#write(uid, p)) };
    });
  }

  /** Minijuego con semilla: el servidor regenera la partida y reproduce la bitácora. */
  playActivity(uid, id, seed, level, log, now = Date.now()) {
    return this.#serial(uid, async () => {
      if (!ACTIVITIES[id] || !Array.isArray(log) || log.length > 200) return { ok: false, reason: 'actividad-invalida' };
      const r = checkActivity(id, seed, level, log);
      if (!r.valid) return { ok: false, reason: 'actividad-invalida' };
      const p = await this.#read(uid), g = rewardActivity(p.play, id, r.score, now);
      p.xp += g.xp;
      return { ok: true, score: r.score, xp: g.xp, bonus: g.bonus, capped: g.capped, profile: this.view(await this.#write(uid, p)) };
    });
  }

  /** Minijuegos validados por posición (carrera, tesoro): el hub ya comprobó el recorrido. */
  grantPositional(uid, id, score, now = Date.now()) {
    return this.#serial(uid, async () => {
      const p = await this.#read(uid), g = rewardActivity(p.play, id, Math.max(0, Math.min(100, Math.round(score))), now);
      p.xp += g.xp;
      return { ok: true, score, xp: g.xp, bonus: g.bonus, capped: g.capped, profile: this.view(await this.#write(uid, p)) };
    });
  }

  /** Privacidad: aparecer o no con el nombre propio en las listas de jugadores. */
  setPrivacy(uid, listed) {
    return this.#serial(uid, async () => {
      const p = await this.#read(uid); p.privacy = { listed: listed !== false };
      return { ok: true, profile: this.view(await this.#write(uid, p)) };
    });
  }

  /* ---------- familia (solo cuando el modo familiar está activo) ---------- */
  familyList(uid) { return this.#serial(uid, async () => ({ ok: true, family: ((await this.#read(uid)).family || []).map(k => ({ id: k.id, alias: k.alias, avatarId: k.avatarId, band: k.band })) })); }

  /** Alta de un perfil infantil: exige el consentimiento explícito del adulto responsable. */
  familyAdd(uid, { alias, avatarId, band, consent } = {}, now = Date.now()) {
    return this.#serial(uid, async () => {
      if (consent !== true) return { ok: false, reason: 'falta-consentimiento' };
      const name = cleanAlias(alias); if (!name) return { ok: false, reason: 'alias-invalido' };
      if (!AGE_BANDS.some(([b]) => b === band)) return { ok: false, reason: 'edad-invalida' };
      const p = await this.#read(uid), list = p.family || [];
      if (list.length >= FAMILY_MAX) return { ok: false, reason: 'familia-llena' };
      if (list.some(k => k.alias.toLowerCase() === name.toLowerCase())) return { ok: false, reason: 'alias-repetido' };
      const id = 'k' + createHash('sha256').update(uid + ':' + name + ':' + now).digest('hex').slice(0, 8);
      p.family = [...list, { id, alias: name, avatarId: isAvatarUnlocked(String(avatarId), emptyProfile()) ? String(avatarId) : 'explorador', band, consentAt: now }];
      await this.#write(uid, p);
      return { ok: true, family: p.family.map(k => ({ id: k.id, alias: k.alias, avatarId: k.avatarId, band: k.band })) };
    });
  }

  familyRemove(uid, id) {
    return this.#serial(uid, async () => {
      const p = await this.#read(uid); p.family = (p.family || []).filter(k => k.id !== id);
      await this.#write(uid, p);
      return { ok: true, family: p.family.map(k => ({ id: k.id, alias: k.alias, avatarId: k.avatarId, band: k.band })) };
    });
  }

  /** Perfil infantil de un adulto (para entrar con él). */
  async kidOf(uid, id) { const p = await this.#serial(uid, () => this.#read(uid)); return (p.family || []).find(k => k.id === id) || null; }

  setAvatar(uid, avatarId, custom) {
    return this.#serial(uid, async () => {
      const p = await this.#read(uid);
      if (!isAvatarUnlocked(String(avatarId), p)) return { ok: false, reason: 'avatar-bloqueado', profile: this.view(p) };
      p.avatarId = String(avatarId); p.custom = cleanCustom(custom);
      return { ok: true, profile: this.view(await this.#write(uid, p)) };
    });
  }
}
