// Ciudad ICADEM · NPC educativos: algunos personajes que caminan por la plaza se acercan de vez
// en cuando a proponer un reto rápido. Reglas de convivencia:
//   · nunca interrumpen una misión, un diálogo, un menú, las frases rápidas ni un minijuego;
//   · solo se acercan a quien va caminando tranquilo o está quieto, sin perseguirlo: si se aleja,
//     el personaje desiste y vuelve a su ruta;
//   · se puede rechazar; después de cada reto (o de un «Ahora no») hay una pausa larga;
//   · no piden datos personales: solo hacen preguntas del banco revisado (questions.js).
// La respuesta correcta y la XP las decide el servidor (EduService).
import { QUESTIONS, CATEGORIES, LEVELS_FOR, questionById } from './questions.js';
import { h } from '../missions/controller.js';

const GREETINGS = ['¡Hola!', '¡Buen día!', '¿Qué tal?', '¡Bienvenido a la ciudad!', '¡Hola, colega!'];

export const NPC_RULES = Object.freeze({
  firstDelay: 25,       // s en la plaza antes del primer acercamiento
  afterQuiz: 90,        // s entre un reto y el siguiente
  afterDecline: 180,    // s después de un «Ahora no»
  perNpc: 300,          // s antes de que el MISMO personaje vuelva a acercarse
  reach: 9,             // m: solo se acercan personajes cercanos
  giveUp: 9,            // s máximos de acercamiento (no persiguen al jugador)
  leave: 12,            // m: si el jugador se aleja más, el personaje desiste (siempre mayor que `reach`)
  greetRange: 3.4,      // m: al pasar junto a un personaje, saluda
  greetEvery: 45,       // s antes de que el mismo personaje vuelva a saludar
  greetGap: 7,          // s mínimos entre dos saludos de cualquier personaje
  stop: 1.7             // m: distancia de plática
});

export class NpcQuiz {
  constructor(api) {
    this.api = api; this.cool = NPC_RULES.firstDelay; this.calm = 0; this.walker = null; this.last = new Map(); this.busy = false; this.asked = [];
    this.greeted = new Map();
  }

  /** Burbuja y gesto de un personaje (saludo, despedida o reacción). */
  say(npc, text, emote = 'wave', seconds = 3.2) {
    npc.avatar.playEmote?.(emote, Math.min(2, seconds * 0.6));
    const p = npc.group.position;
    this.api.social?.bubble('npc:' + (npc.quizName || npc.group.id), text, seconds, () => ({ x: p.x, y: p.y + 2.25, z: p.z }), 'bubble--npc');
  }

  /** Saludo al pasar: corto, de vez en cuando y sin detener a nadie. */
  #greet(scene, me) {
    const now = performance.now() / 1000;
    if (now - (this.lastGreet || -1e9) < NPC_RULES.greetGap) return;
    const n = (scene.npcs || []).find(x => x.quizName && !x.talking && !x.approach && now - (this.greeted.get(x) || -1e9) > NPC_RULES.greetEvery && Math.hypot(x.group.position.x - me.x, x.group.position.z - me.z) < NPC_RULES.greetRange);
    if (!n) return;
    this.greeted.set(n, now); this.lastGreet = now;
    this.say(n, GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  }

  get enabled() { return this.api.store.state.settings.npcQuiz !== false; }

  /** ¿El jugador está ocupado? (misión, diálogo, menú, frases, minijuego, asiento o carrera) */
  #playerBusy() {
    const api = this.api, sayMenu = document.getElementById('say-menu');
    return api.ui.isBlocking || this.busy || (sayMenu && !sayMenu.hidden) || api.player.seat || (api.games && api.games.active) || (api.tutorial && api.tutorial.active);
  }

  reset() { this.#abort(); this.cool = Math.max(this.cool, NPC_RULES.firstDelay); this.calm = 0; }

  #abort() { if (this.walker) { this.walker.npc.approach = null; this.walker = null; } }

  update(dt) {
    const api = this.api;
    if ((api.sceneName !== 'plaza' && api.sceneName !== 'distrito') || !this.enabled) { this.#abort(); return; }
    const scene = api.scene, me = api.player.position, speed = Math.hypot(api.player.vx || 0, api.player.vz || 0);
    this.calm = speed < 3 ? this.calm + dt : 0;
    if (this.walker) return this.#approaching(dt, scene, me);
    if (!this.#playerBusy()) this.#greet(scene, me);
    this.cool -= dt;
    if (this.cool > 0 || this.calm < 1.5 || this.#playerBusy()) return;
    const now = performance.now() / 1000;
    const npc = (scene.npcs || []).filter(n => n.route && n.quizName && !n.talking && now - (this.last.get(n) || -1e9) > NPC_RULES.perNpc)
      .map(n => ({ n, d: Math.hypot(n.group.position.x - me.x, n.group.position.z - me.z) }))
      .filter(x => x.d < NPC_RULES.reach && x.d > 2.5).sort((a, b) => a.d - b.d)[0];
    if (!npc) { this.cool = 4; return; }
    this.walker = { npc: npc.n, t: 0 };
    npc.n.approach = { x: me.x, z: me.z, stop: NPC_RULES.stop, collision: scene.collision };
  }

  #approaching(dt, scene, me) {
    const w = this.walker, a = w.npc.approach, np = w.npc.group.position;
    w.t += dt; a.x = me.x; a.z = me.z;
    const d = Math.hypot(np.x - me.x, np.z - me.z);
    const why = this.#playerBusy() ? 'ocupado' : d > NPC_RULES.leave ? 'lejos' : w.t > NPC_RULES.giveUp ? 'tiempo' : (!a.arrived && (a.stuck || 0) > 1.6) ? 'sin-camino' : null;
    if (why) {
      this.lastAbort = why;
      // Desiste sin insistir: el jugador se fue, se ocupó o no hay camino.
      if (why === 'lejos' || why === 'tiempo') this.say(w.npc, 'Será en otra ocasión. ¡Hasta luego!', 'wave', 2.6);
      this.last.set(w.npc, performance.now() / 1000); this.#abort(); this.cool = 30; return;
    }
    if (a.arrived) { this.last.set(w.npc, performance.now() / 1000); this.#offer(w.npc); this.walker = null; }
  }

  async #offer(npc) {
    const api = this.api; this.busy = true; npc.talking = true;
    try {
      this.say(npc, `¡Hola! Soy ${npc.quizName}.`, 'wave', 2.4);
      const pick = await api.ui.choice({ speaker: npc.quizName, text: '¡Hola! ¿Te puedo hacer una pregunta?', options: [{ id: 'si', label: 'Aceptar reto', hint: 'Pregunta rápida · hasta 10 XP', primary: true }, { id: 'no', label: 'Ahora no' }] });
      if (pick !== 'si') { this.cool = NPC_RULES.afterDecline; this.say(npc, '¡Está bien! Que tengas buen paseo.', 'wave', 2.8); return; }
      const r = await this.ask(npc.quizName);
      // reacción a la respuesta y despedida
      if (r && r.correct) this.say(npc, r.xp ? '¡Excelente! Sabes mucho.' : '¡Correcto! Bien hecho.', 'clap', 3);
      else if (r) this.say(npc, '¡Casi! La próxima seguro aciertas.', 'wave', 3);
      else this.say(npc, '¡Hasta luego!', 'wave', 2.4);
      this.cool = NPC_RULES.afterQuiz;
    } finally { npc.talking = false; npc.approach = null; this.busy = false; }
  }

  /** Elige una pregunta del nivel del perfil, prefiriendo las que no ha contestado esta semana. */
  pickQuestion() {
    const seen = (this.api.store.state.play && this.api.store.state.play.quizSeen) || {};
    const levels = LEVELS_FOR[this.api.store.state.profileKind === 'infantil' ? 'infantil' : 'adulto'];
    const pool = QUESTIONS.filter(q => levels.includes(q.level) && !this.asked.includes(q.id));
    const fresh = pool.filter(q => !seen[q.id]), list = fresh.length ? fresh : pool.length ? pool : QUESTIONS.filter(q => levels.includes(q.level));
    const q = list[Math.floor(Math.random() * list.length)];
    this.asked = [...this.asked.slice(-20), q.id];
    return q;
  }

  /** Tarjeta de pregunta: opciones grandes (fáciles de tocar), la respuesta la confirma el servidor. */
  async ask(speaker = 'Reto rápido', question = null) {
    const api = this.api, q = question || this.pickQuestion();
    const card = h('div', 'quiz'), opts = h('div', 'quiz__opts'), feedback = h('div', 'quiz__feedback'); feedback.hidden = true; feedback.setAttribute('role', 'status');
    const head = h('div', 'quiz__head'); head.append(h('span', 'quiz__chip', CATEGORIES[q.cat]), h('span', 'quiz__speaker', speaker));
    card.append(head, h('p', 'quiz__q', q.q), opts, feedback);
    let answered = false, result = null;
    q.options.forEach((text, i) => {
      const b = h('button', 'quiz__opt'); b.type = 'button'; b.dataset.i = String(i);
      b.append(h('b', null, 'ABCD'[i]), h('span', null, text));
      b.addEventListener('click', async () => {
        if (answered) return; answered = true;
        opts.querySelectorAll('button').forEach(o => { o.disabled = true; }); b.classList.add('is-picked');
        const r = await api.edu.quiz(q.id, i);
        if (r.error) { answered = false; opts.querySelectorAll('button').forEach(o => { o.disabled = false; }); b.classList.remove('is-picked'); api.ui.toast('No se pudo validar la respuesta. Intenta de nuevo.', 2600); return; }
        result = r; opts.querySelectorAll('button').forEach(o => o.classList.toggle('is-right', Number(o.dataset.i) === r.answer));
        if (!r.correct) b.classList.add('is-wrong');
        feedback.hidden = false; feedback.className = 'quiz__feedback ' + (r.correct ? 'is-good' : 'is-bad');
        const title = r.correct ? (r.xp ? `¡Felicidades! Has ganado ${r.xp} XP` : '¡Correcto!') : 'Buen intento';
        const note = r.correct ? (r.why === 'repetida' ? 'Ya ganaste XP con esta pregunta esta semana.' : r.why === 'tope-diario' ? 'Llegaste al tope de retos con XP de hoy. ¡Mañana hay más!' : r.explain || questionById(q.id).explain) : `${r.explain || q.explain} ¡Sigue aprendiendo!`;
        feedback.replaceChildren(h('strong', null, title), h('p', null, note));
        if (r.xp) { const chip = h('span', 'xp-pop', `+${r.xp} XP`); card.append(chip); api.player.emote('celebrate', 1.6); api.ui.refreshHud(); }
      });
      opts.append(b);
    });
    await api.ui.modal({ eyebrow: 'Reto rápido', title: 'Pregunta', content: card, actions: [{ id: 'ok', label: 'Continuar', primary: true }], validate: () => answered ? null : 'Elige una respuesta.' });
    return result;
  }
}
