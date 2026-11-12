// Ciudad ICADEM · puente de los retos y minijuegos con el progreso.
// Con conexión, el SERVIDOR decide si la respuesta es correcta y cuánta XP corresponde (y lo
// guarda en el perfil). Sin conexión, se aplican las mismas reglas solo en este dispositivo.
import { questionById } from './questions.js';
import { checkActivity } from './activities.js';
import { emptyPlay, cleanPlay, rewardQuiz, rewardActivity } from './play-rules.js';

export class EduService {
  constructor(api) { this.api = api; this.seq = 0; }

  get online() { return this.api.net && this.api.net.isOnline; }
  #play() { const st = this.api.store.state; st.play = cleanPlay(st.play || emptyPlay()); return st.play; }

  /** Espera la respuesta del servidor a una operación de perfil (con número de solicitud). */
  #ask(op, payload, ms = 6000) {
    const n = ++this.seq, net = this.api.net;
    return new Promise(resolve => {
      const off = net.on('profile', m => { if (m.op === op && m.n === n) { off(); clearTimeout(t); resolve(m); } });
      const t = setTimeout(() => { off(); resolve(null); }, ms);
      net.profile(op, { ...payload, n });
    });
  }

  /** Reto de NPC: devuelve { correct, answer, explain, xp, why, server }. */
  async quiz(questionId, choice) {
    const q = questionById(questionId);
    if (this.online) {
      const r = await this.#ask('quiz', { id: questionId, choice });
      if (r && r.ok) return { correct: r.correct, answer: r.answer, explain: r.explain, xp: r.xp || 0, why: r.why, server: true };
      if (r && !r.ok) return { error: r.reason || 'error' };
      return { error: 'sin-respuesta' };
    }
    const correct = choice === q.answer, g = rewardQuiz(this.#play(), q.id, correct, Date.now());
    if (g.xp) this.api.store.addXp(g.xp); else this.api.store.save();
    return { correct, answer: q.answer, explain: q.explain, xp: g.xp, why: g.why, server: false };
  }

  /** Minijuego con semilla: devuelve { score, xp, bonus, capped, server } o { error }. */
  async activity(id, seed, level, log) {
    if (this.online) {
      const r = await this.#ask('activity', { id, seed, level, log });
      if (r && r.ok) return { score: r.score, xp: r.xp || 0, bonus: r.bonus || 0, capped: r.capped, server: true };
      return { error: (r && r.reason) || 'sin-respuesta' };
    }
    const c = checkActivity(id, seed, level, log);
    if (!c.valid) return { error: 'actividad-invalida' };
    return this.localReward(id, c.score);
  }

  /** XP local (sin conexión) de un minijuego validado en este dispositivo. */
  localReward(id, score) {
    const g = rewardActivity(this.#play(), id, score, Date.now());
    if (g.xp) this.api.store.addXp(g.xp); else this.api.store.save();
    return { score, xp: g.xp, bonus: g.bonus, capped: g.capped, server: false };
  }

  /** Semilla nueva para una partida. */
  seed() { return (crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0; }
}
