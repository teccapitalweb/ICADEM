// Ciudad ICADEM · minijuegos rápidos (interfaz). La lógica y la calificación viven en
// activities.js y las valida el servidor: aquí solo se dibuja, se juega y se envía lo que hizo
// el jugador. Ninguno da créditos: solo XP con topes diarios.
import * as THREE from '../three.js';
import { ACTIVITIES, RACE, TREASURES, TREASURE_RADIUS, treasureRounds, SORT_THEMES } from './activities.js';
import { ACTIVITY_DAILY_XP } from './play-rules.js';
import { QUESTIONS, questionById } from './questions.js';
import { CHOICE_GAMES, FIELD_IDS } from './vivo-games.js';
import { h } from '../missions/controller.js';
import { encodeState } from '../net/network.js';
import { SCENE_RULES } from '../net/scenes.js';

export const GAME_LIST = Object.freeze([
  { id: 'carrera', icon: '🏃', title: 'Carrera del Saber', text: 'Salta plataformas, esquiva barras y abre las barreras respondiendo bien. Hay pistas y puedes reintentar.', place: 'park' },
  { id: 'memoria', icon: '🧠', title: 'Memoria ICADEM', text: 'Relaciona cada herramienta con su profesión.', levels: [['facil', 'Fácil · 4 pares'], ['medio', 'Medio · 6 pares'], ['dificil', 'Difícil · 8 pares']] },
  { id: 'matematicas', icon: '➗', title: 'Matemáticas contra reloj', text: '10 operaciones en 90 segundos.', levels: [['infantil', 'Sumas y restas'], ['juvenil', 'Tablas y divisiones'], ['general', 'Porcentajes y combinadas']] },
  { id: 'idiomas', icon: '🌎', title: 'Aventura de idiomas', text: 'Palabras e imágenes en inglés y saludos de otros idiomas.', levels: [['infantil', 'Primeras palabras'], ['general', 'Viajero']] },
  { id: 'tesoro', icon: '🗝️', title: 'Búsqueda del tesoro', text: 'Sigue las pistas y encuentra objetos de cada profesión en la plaza.', place: 'plaza' },
  { id: 'clasificacion', icon: '🗂️', title: 'Clasificación inteligente', text: 'Ordena cada objeto en su categoría.', levels: Object.entries(SORT_THEMES).map(([id, t]) => [id, t.title]) },
  { id: 'laberinto', icon: '🌿', title: 'Laberinto del conocimiento', text: 'Cruza el laberinto del Distrito del Saber abriendo tres puertas con tus respuestas.', place: 'distrito' },
  { id: 'laboratorio', icon: '🧪', title: 'Laboratorio de experimentos', text: 'Predice qué pasa con densidad, circuitos, pH, imanes y más.', levels: [['basico', 'Básico · 5 experimentos'], ['avanzado', 'Avanzado · 8 experimentos']] },
  { id: 'escape', icon: '🔐', title: 'Sala de escape', text: 'Resuelve tres acertijos de lógica y cálculo para abrir los candados.', levels: [['normal', '3 candados']] },
  // Mundo vivo (2.0)
  { id: 'manzanas', icon: '🍎', title: 'Manzanas perdidas', text: 'A Doña Rosa se le rompió la bolsa: recoge sus manzanas en la plaza sin pisar los charcos y devuélveselas.', place: 'plaza', vivo: true },
  { id: 'heroes', icon: '🦸', title: 'Héroes de la ciudad', text: 'Situaciones reales para ayudar con respeto y con seguridad.', vivo: true },
  { id: 'rescate', icon: '🚑', title: 'Rescate responsable', text: 'Qué hacer si alguien se desvanece: seguridad, pedir ayuda al 911 y esperar sin moverle.', vivo: true },
  { id: 'guardianes', icon: '🌳', title: 'Guardianes del parque', text: 'Recoge y separa la basura del Parque de retos, reporta lo peligroso y riega las plantas.', place: 'park', vivo: true },
  { id: 'veterinarios', icon: '🐶', title: 'Veterinarios por un día', text: 'Comida adecuada, agua, limpieza y saber cuándo hace falta el veterinario.', vivo: true },
  { id: 'mercado', icon: '🧺', title: 'Mercado justo', text: 'Atiende un puesto: suma, da el cambio y resuelve con honestidad.', levels: [['basico', 'Básico · 2 productos'], ['avanzado', 'Avanzado · 3 productos']], vivo: true },
  { id: 'agua', icon: '💧', title: 'Amigos del agua', text: 'Fugas, llaves abiertas, riego y acertijos para cuidar el agua.', vivo: true },
  { id: 'emociones', icon: '💛', title: 'Aventura de las emociones', text: 'Historias de convivencia con varias respuestas posibles y por qué.', vivo: true },
  { id: 'expedicion', icon: '🧭', title: 'Expedición del conocimiento', text: 'Sigue las pistas por la plaza, el parque, el Distrito y el Paseo: responde y reúne 4 sellos.', place: 'plaza', vivo: true }
]);

const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Games {
  constructor(api) {
    this.api = api; this.race = null; this.hunt = null; this.objs = []; this.pending = false;
    api.net.on('play', m => this.#onPlay(m));
  }

  /** Un minijuego de exploración está en curso (los NPC no interrumpen). */
  get active() { return Boolean(this.race || this.hunt || (this.api.district && this.api.district.active) || (this.api.vivoGames && this.api.vivoGames.active)); }
  get raceNext() { return this.race ? this.race.next : -1; }

  #stats(id) { const a = (this.api.store.state.play && this.api.store.state.play.act && this.api.store.state.play.act[id]) || null; return a || { best: 0, dayXp: 0, plays: 0, done: false }; }

  /* ---------------- menú ---------------- */
  open() {
    const api = this.api; if (api.ui.isBlocking) return;
    const grid = h('div', 'arcade');
    GAME_LIST.forEach(gm => {
      const st = this.#stats(gm.id), b = h('button', 'arcade__card'); b.type = 'button'; b.dataset.game = gm.id;
      const top = h('div', 'arcade__top'); top.append(h('span', 'arcade__icon', gm.icon), h('span', 'arcade__best', st.best ? `Mejor: ${st.best}` : 'Nuevo'));
      b.append(top, h('strong', null, gm.title), h('span', null, gm.text), h('small', null, `XP de hoy: ${st.dayXp || 0}/${ACTIVITY_DAILY_XP}${st.done ? '' : ' · +20 al completarlo'}`));
      b.addEventListener('click', () => { document.querySelector('#modal-actions button')?.click(); setTimeout(() => this.launch(gm.id), 80); });
      grid.append(b);
    });
    return api.ui.modal({ eyebrow: 'Ciudad ICADEM', title: 'Minijuegos', content: grid, wide: true, hint: 'Solo dan XP del juego (con tope diario). No dan créditos.' });
  }

  /** Récord antes de jugar (para celebrar uno nuevo; el récord real lo guarda el servidor). */
  #mark(id) { (this.prevBest ||= {})[id] = this.#stats(id).best || 0; }

  /**
   * Lleva a un escenario respetando las conexiones que valida el servidor: desde la habitación o un
   * edificio no se puede saltar directo al Parque o al Distrito; primero se pasa por la plaza, frente a
   * la puerta correspondiente (así el servidor acepta el cambio y los demás te ven donde estás).
   */
  async goTo(scene) {
    const api = this.api, here = api.sceneName;
    if (here === scene) return;
    const rules = SCENE_RULES[here];
    if (here !== 'plaza' && !(rules && rules.links.includes(scene))) { await api.travel('plaza', scene); await new Promise(r => setTimeout(r, 450)); }
    await api.travel(scene, 'default');
  }

  /** Para otros controladores (Distrito del Saber): récord previo y ventana de resultado. */
  mark(id) { this.#mark(id); }
  result(id, r) { return this.#result(GAME_LIST.find(g => g.id === id), r); }

  async launch(id) {
    const api = this.api, gm = GAME_LIST.find(g => g.id === id);
    this.#mark(id);
    if (id === 'laberinto') { if (api.sceneName !== 'distrito') { api.ui.toast('Te llevamos al Distrito del Saber. El laberinto empieza en el letrero verde.', 3200); this.goTo('distrito'); } else api.district.mazeStart(); return; }
    if (id === 'carrera') { if (api.sceneName !== 'park') { api.ui.toast('Te llevamos al Parque de retos. Habla con el letrero de salida para empezar.', 3200); this.goTo('park'); } else this.raceStartUI(); return; }
    if (id === 'tesoro') { if (api.sceneName !== 'plaza') { await api.travel('plaza', 'home'); } return this.huntStart(); }
    // Mundo vivo (2.0): juegos de campo y actividades de elección
    if (FIELD_IDS.includes(id)) return api.vivoGames.field(id);
    if (CHOICE_GAMES.includes(id) && !gm.levels) return api.vivoGames.choice(id, 'normal');
    const level = await api.ui.choice({ speaker: gm.title, text: 'Elige la dificultad', options: [...gm.levels.map(([lid, label], i) => ({ id: lid, label, primary: i === 0 })), { id: 'x', label: 'Cancelar' }] });
    if (!level || level === 'x') return;
    const seed = api.edu.seed(), content = ACTIVITIES[id].build(seed, level);
    if (CHOICE_GAMES.includes(id)) return api.vivoGames.choice(id, level);
    const log = await ({ memoria: () => this.#memory(content), matematicas: () => this.#math(content, seed, level), idiomas: () => this.#languages(content), clasificacion: () => this.#sorting(content, level), laboratorio: () => api.district.lab(content), escape: () => api.district.escape(content) })[id]();
    if (!log) return;
    const r = await api.edu.activity(id, seed, level, log);
    await this.#result(gm, r);
  }

  async #result(gm, r) {
    const api = this.api;
    if (r.error) { api.ui.toast('No se pudo validar la partida con el servidor. Intenta de nuevo.', 3000); return; }
    const box = h('div', 'mg-result'), score = h('div', 'result__score'), num = h('b', null, '0'); score.append(num, h('span', null, 'de 100'));
    const earned = r.score >= 90 ? 3 : r.score >= 60 ? 2 : 1, stars = h('div', 'mg-result__stars');
    for (let i = 0; i < 3; i++) { const st = h('i', i < earned ? 'is-on' : '', i < earned ? '★' : '☆'); st.style.animationDelay = `${0.25 + i * 0.18}s`; stars.append(st); }
    // marcador que sube hasta el resultado (solo presentación: el puntaje ya lo validó el servidor)
    const t0 = performance.now(), tick = () => { const k = Math.min(1, (performance.now() - t0) / 800), v = Math.round(r.score * (1 - Math.pow(1 - k, 3))); num.textContent = String(v); score.style.setProperty('--p', String(v)); if (k < 1 && num.isConnected !== false) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const prev = this.prevBest && this.prevBest[gm.id];
    if (prev !== undefined && r.score > prev && prev > 0) box.append(h('div', 'mg-result__record', `¡Nuevo récord personal! Antes: ${prev}`));
    if (this.prevBest) this.prevBest[gm.id] = Math.max(prev || 0, r.score);
    const xp = h('div', 'result__rewards'); xp.append(h('span', 'pill pill--blue', r.xp ? `+${r.xp} XP` : 'Sin XP esta vez'));
    if (r.bonus) xp.append(h('span', 'pill pill--gold', '¡Primera vez completado! +20 XP'));
    if (r.coins) xp.append(h('span', 'pill pill--gold', `+${r.coins} monedas`));
    if (r.source) box.append(h('p', 'note', r.source));
    box.append(stars, score, xp);
    if (!r.xp && r.capped !== undefined) box.append(h('p', 'players__note', 'Llegaste al tope de XP de este minijuego por hoy. ¡Puedes seguir jugando por diversión!'));
    if (!r.server) box.append(h('p', 'players__note', 'Sin conexión: la XP se guardó solo en este dispositivo.'));
    if (r.xp) api.player.emote('celebrate', 1.8);
    api.ui.refreshHud();
    const again = await api.ui.modal({ eyebrow: gm.title, title: r.score >= 90 ? '¡Excelente!' : r.score >= 60 ? '¡Muy bien!' : '¡Buen intento!', content: box, actions: [{ id: 'menu', label: 'Más minijuegos' }, { id: 'ok', label: 'Continuar', primary: true }] });
    if (again === 'menu') setTimeout(() => this.open(), 60);
  }

  /* ---------------- B · Memoria ---------------- */
  #memory(content) {
    const api = this.api, log = [], grid = h('div', 'memory memory--' + content.cards.length), info = h('div', 'mg-bar');
    let open = [], matched = new Set(), turns = 0, t0 = performance.now(), lock = false, finished = null;
    const moves = h('b', null, '0'), clock = h('b', null, '0:00'); info.append(h('span', null, 'Turnos '), moves, h('span', null, ' · Tiempo '), clock);
    const timer = setInterval(() => { clock.textContent = mmss((performance.now() - t0) / 1000); }, 500);
    content.cards.forEach((c, i) => {
      const b = h('button', 'memory__card'); b.type = 'button'; b.dataset.i = String(i); b.setAttribute('aria-label', 'Carta');
      const back = h('span', 'memory__back', '?'), face = h('span', 'memory__face'); face.append(h('i', null, c.icon), h('small', null, c.label));
      b.append(back, face);
      b.addEventListener('click', () => {
        if (lock || matched.has(i) || open.includes(i)) return;
        b.classList.add('is-up'); b.setAttribute('aria-label', c.label); open.push(i); log.push(i);
        if (open.length < 2) return;
        turns++; moves.textContent = String(turns);
        const [a, z] = open, ca = content.cards[a], cz = content.cards[z];
        if (ca.pair === cz.pair) { matched.add(a); matched.add(z); open = []; [a, z].forEach(k => grid.children[k].classList.add('is-match')); if (matched.size === content.cards.length) finished = setTimeout(() => document.querySelector('#modal-actions .btn--primary')?.click(), 700); }
        else { lock = true; setTimeout(() => { [a, z].forEach(k => grid.children[k].classList.remove('is-up')); open = []; lock = false; }, 800); }
      });
      grid.append(b);
    });
    const wrap = h('div', 'mg'); wrap.append(info, grid, h('p', 'players__note', 'Encuentra cada herramienta con su profesión. Menos turnos = más puntos.'));
    return api.ui.modal({ eyebrow: 'Memoria ICADEM', title: 'Encuentra las parejas', content: wrap, wide: true, actions: [{ id: 'quit', label: 'Salir' }, { id: 'ok', label: 'Terminar', primary: true }],
      validate: x => x === 'ok' && matched.size !== content.cards.length ? 'Aún faltan parejas.' : null })
      .then(r => { clearInterval(timer); clearTimeout(finished); return r === 'ok' ? log : null; });
  }

  /* ---------------- C · Matemáticas contra reloj ---------------- */
  #math(content, seed, level) {
    const api = this.api, LIMIT = 90, answers = [], right = ACTIVITIES.matematicas.solve(seed, level);
    const wrap = h('div', 'mg'), bar = h('div', 'timebar'), fill = h('i'); bar.append(fill);
    const count = h('small', 'mg-bar'), q = h('p', 'math__q'), opts = h('div', 'math__opts'), fb = h('div', 'math__fb');
    wrap.append(bar, count, q, opts, fb);
    const t0 = performance.now(); let done = false, timer, streak = 0;
    const show = () => {
      const i = answers.length; if (i >= 10) { finish(); return; }
      const p = content.problems[i]; count.textContent = `Operación ${i + 1} de 10 · correctas ${answers.filter((v, k) => v === right[k]).length}`;
      q.textContent = `${p.text} = ?`; opts.replaceChildren();
      p.options.forEach(v => { const b = h('button', 'math__opt', String(v)); b.type = 'button'; b.addEventListener('click', () => { if (done) return; answers.push(v); const ok = v === right[i]; streak = ok ? streak + 1 : 0; fb.textContent = ok ? (streak >= 3 ? `🔥 ¡Racha de ${streak}!` : '✔ ¡Bien!') : `✘ Era ${right[i]}`; fb.className = 'math__fb ' + (ok ? 'is-good' : 'is-bad') + (streak >= 3 ? ' is-streak' : ''); show(); }); opts.append(b); });
    };
    const finish = () => { if (done) return; done = true; clearInterval(timer); document.querySelector('#modal-actions .btn--primary')?.click(); };
    timer = setInterval(() => {
      const left = Math.max(0, LIMIT - (performance.now() - t0) / 1000); fill.style.width = `${left / LIMIT * 100}%`; fill.classList.toggle('is-low', left < 15);
      if (left <= 0) { while (answers.length < 10) { const k = answers.length; answers.push(content.problems[k].options.find(v => v !== right[k])); } finish(); }
    }, 200);
    show();
    return api.ui.modal({ eyebrow: 'Matemáticas contra reloj', title: 'Resuelve antes de que se acabe el tiempo', content: wrap, wide: true, actions: [{ id: 'quit', label: 'Salir' }, { id: 'ok', label: 'Ver resultado', primary: true }],
      validate: x => x === 'ok' && answers.length < 10 ? 'Responde las 10 operaciones (o espera a que acabe el tiempo).' : null })
      .then(r => { clearInterval(timer); done = true; return r === 'ok' ? answers.slice(0, 10) : null; });
  }

  /* ---------------- D · Aventura de idiomas ---------------- */
  #languages(content) {
    const api = this.api, answers = [], wrap = h('div', 'mg'), count = h('small', 'mg-bar'), prompt = h('div', 'lang__prompt'), hint = h('p', 'lang__hint'), opts = h('div', 'quiz__opts'), fb = h('div', 'math__fb');
    wrap.append(count, prompt, hint, opts, fb, h('p', 'players__note', 'Sin audio por ahora: solo se agregarán pronunciaciones con grabaciones autorizadas.'));
    let wait = false;
    const show = () => {
      const i = answers.length; if (i >= content.rounds.length) { document.querySelector('#modal-actions .btn--primary')?.click(); return; }
      const r = content.rounds[i]; count.textContent = `Ronda ${i + 1} de ${content.rounds.length}`;
      prompt.textContent = r.kind === 'imagen' ? r.prompt : `«${r.prompt}»`; prompt.className = 'lang__prompt' + (r.kind === 'imagen' ? ' is-emoji' : '');
      hint.textContent = r.hint; opts.replaceChildren();
      r.options.forEach((o, k) => { const b = h('button', 'quiz__opt'); b.type = 'button'; b.append(h('b', null, 'ABC'[k]), h('span', null, o)); b.addEventListener('click', () => {
        if (wait) return; wait = true; answers.push(o); const ok = o === r.answer;
        b.classList.add(ok ? 'is-right' : 'is-wrong'); if (!ok) [...opts.children].find(x => x.textContent.slice(1) === r.answer)?.classList.add('is-right');
        fb.textContent = ok ? '✔ ¡Correcto!' : `✘ Es «${r.answer}»`; fb.className = 'math__fb ' + (ok ? 'is-good' : 'is-bad');
        setTimeout(() => { wait = false; fb.textContent = ''; show(); }, ok ? 650 : 1300);
      }); opts.append(b); });
    };
    show();
    return api.ui.modal({ eyebrow: 'Aventura de idiomas', title: 'Palabras del mundo', content: wrap, wide: true, actions: [{ id: 'quit', label: 'Salir' }, { id: 'ok', label: 'Ver resultado', primary: true }],
      validate: x => x === 'ok' && answers.length < content.rounds.length ? 'Termina todas las rondas.' : null }).then(r => r === 'ok' ? answers : null);
  }

  /* ---------------- F · Clasificación inteligente ---------------- */
  #sorting(content, level) {
    const api = this.api, theme = SORT_THEMES[level], log = [], wrap = h('div', 'mg'), count = h('small', 'mg-bar'), item = h('div', 'sort__item'), bins = h('div', 'sort__bins'), fb = h('div', 'math__fb');
    wrap.append(count, item, bins, fb);
    let wait = false;
    const show = () => {
      const i = log.length; if (i >= content.items.length) { document.querySelector('#modal-actions .btn--primary')?.click(); return; }
      count.textContent = `${content.title} · objeto ${i + 1} de ${content.items.length}`; item.textContent = content.items[i].label;
      item.classList.remove('is-in'); void item.offsetWidth; item.classList.add('is-in');
    };
    content.bins.forEach(([id, label]) => { const b = h('button', 'sort__bin', label); b.type = 'button'; b.dataset.bin = id; b.addEventListener('click', () => {
      if (wait || log.length >= content.items.length) return; wait = true;
      const it = content.items[log.length], right = theme.items[it.id][1]; log.push({ id: it.id, bin: id });
      const ok = right === id; fb.textContent = ok ? '✔ ¡Bien clasificado!' : `✘ Va en «${content.bins.find(x => x[0] === right)[1]}»`; fb.className = 'math__fb ' + (ok ? 'is-good' : 'is-bad');
      b.classList.add(ok ? 'is-good' : 'is-bad'); setTimeout(() => { b.classList.remove('is-good', 'is-bad'); wait = false; fb.textContent = ''; show(); }, ok ? 550 : 1200);
    }); bins.append(b); });
    show();
    return api.ui.modal({ eyebrow: 'Clasificación inteligente', title: '¿Dónde va cada cosa?', content: wrap, wide: true, actions: [{ id: 'quit', label: 'Salir' }, { id: 'ok', label: 'Ver resultado', primary: true }],
      validate: x => x === 'ok' && log.length < content.items.length ? 'Clasifica todos los objetos.' : null }).then(r => r === 'ok' ? log : null);
  }

  /* ---------------- A · Carrera del conocimiento ---------------- */
  raceLabel() { return this.race ? `Carrera en curso · punto ${this.race.next + 1} de ${RACE.checkpoints.length}` : 'Carrera del Saber · empezar'; }

  async raceStartUI() {
    const api = this.api; if (!this.race) this.#mark('carrera');
    if (this.race) { const q = await api.ui.choice({ speaker: 'Carrera del Saber', text: '¿Abandonar la carrera?', options: [{ id: 'si', label: 'Abandonar' }, { id: 'no', label: 'Seguir corriendo', primary: true }] }); if (q === 'si') this.raceQuit(); return; }
    await api.ui.dialog({ speaker: 'Carrera del Saber', lines: ['Pasa por los 7 arcos en orden. Los que están sobre plataformas se alcanzan saltando (Espacio o el botón de salto).', 'Los arcos 2 y 5 son barreras del saber: se abren respondiendo bien (puedes pedir una pista).', 'Cuidado con las barras rojas: si te alcanzan, te empujan. ¡La meta está en el centro!'] });
    this.race = { next: 0, t0: performance.now(), bumps: 0, server: this.api.net.isOnline };
    if (this.race.server) { this.pending = true; this.#play('start', { game: 'carrera' }); }
    this.#raceHud();
  }

  /**
   * Envío al servidor de carrera/tesoro. Antes se manda la posición actual: quieto (p. ej. leyendo el
   * diálogo) el cliente no envía estado y el servidor la daría por vieja; el servidor sigue validándola
   * con su control de velocidad. Cada mensaje dice su juego para que la respuesta se reconozca.
   */
  #play(op, payload) {
    const api = this.api, net = api.net, last = net.lastSent, p = api.player.position;
    if (last) { const now = encodeState({ scene: api.sceneName, x: p.x, y: p.y, z: p.z, yaw: api.player.yaw || 0 }); now[5] = last[5]; net.sendState(now); }
    net.play(op, payload);
  }

  raceBump() { if (this.race) this.race.bumps++; }
  raceQuit(silent) { if (!this.race) return; if (this.race.server) this.api.net.play('quit', {}); this.race = null; this.pending = false; this.api.ui.setTracker(null); if (!silent) this.api.ui.toast('Carrera abandonada.', 2000); }

  #raceHud() {
    if (!this.race) return;
    const s = (performance.now() - this.race.t0) / 1000;
    this.api.ui.setTracker({ title: `Carrera · ${mmss(s)}`, badge: 'Minijuego · XP', steps: RACE.checkpoints.map((_, i) => ({ text: i === 0 ? 'Salida' : i === RACE.checkpoints.length - 1 ? 'Meta' : `Arco ${i}`, done: i < this.race.next, active: i === this.race.next })) });
  }

  /* ---------------- E · Búsqueda del tesoro ---------------- */
  async huntStart() {
    const api = this.api; if (this.hunt) return; this.#mark('tesoro');
    await api.ui.dialog({ speaker: 'Búsqueda del tesoro', lines: ['Hay objetos de distintas profesiones escondidos por la plaza. Sigue las pistas del panel.', 'Son tres rondas: 2, 3 y 5 tesoros. Acércate a cada uno para recogerlo.'] });
    const seed = api.edu.seed();
    this.hunt = { seed, rounds: treasureRounds(seed), round: 0, found: [], t0: performance.now(), server: api.net.isOnline };
    if (this.hunt.server) { this.pending = true; this.#play('start', { game: 'tesoro', seed }); }
    this.#huntRender();
  }
  huntQuit() { if (!this.hunt) return; if (this.hunt.server) this.api.net.play('quit', {}); this.hunt = null; this.pending = false; this.#clearObjs(); this.api.ui.setTracker(null); }

  #clearObjs() { this.objs.forEach(o => { o.parent?.remove(o); o.traverse(x => { if (x.isMesh) { x.geometry.dispose(); x.material.map?.dispose(); x.material.dispose(); } }); }); this.objs = []; }

  #huntRender() {
    const api = this.api, H = this.hunt; this.#clearObjs(); if (!H || api.sceneName !== 'plaza') return;
    const ids = H.rounds[H.round];
    for (const id of ids) {
      if (H.found.includes(id)) continue;
      const t = TREASURES.find(x => x.id === id), c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); g.font = '92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t.icon, 64, 70);
      const tex = new THREE.CanvasTexture(c), spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      spr.scale.set(1.1, 1.1, 1); const grp = new THREE.Group(); grp.position.set(t.at[0], 0, t.at[1]); grp.userData = { id, dynamic: true };
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.7, side: THREE.DoubleSide, toneMapped: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.04; spr.position.y = 1.1; grp.add(spr, glow); api.scene.group.add(grp); this.objs.push(grp);
    }
    api.ui.setTracker({ title: `Búsqueda del tesoro · ronda ${H.round + 1} de 3`, badge: 'Minijuego · XP', steps: ids.map(id => { const t = TREASURES.find(x => x.id === id); return { text: H.found.includes(id) ? `${t.icon} ${t.name}` : `Pista: ${t.clue}`, done: H.found.includes(id), active: !H.found.includes(id) }; }) });
  }

  /* ---------------- respuestas del servidor y cuadro a cuadro ---------------- */
  #onPlay(m) {
    const api = this.api; this.pending = false;
    if ((m.op === 'answer' || m.op === 'hint') && this.waitBarrier) { const w = this.waitBarrier; this.waitBarrier = null; w(m); return; }
    if (m.game === 'carrera' && m.op === 'start' && m.ok && this.race) { this.race.quiz = m.quiz || {}; this.race.open = {}; }
    if (m.ok === false && m.reason === 'barrera' && this.race) { this.#barrier(m.i, m.q); return; }
    if (m.ok === false) {
      this.waitUntil = performance.now() + 900;   // no se reintenta en cada cuadro
      const why = { lejos: 'El servidor aún no te ve en ese punto: acércate un poco más.', 'fuera-de-orden': 'Ese no es el siguiente arco.', imposible: 'Demasiado rápido para ser real: la carrera no cuenta.', 'fuera-del-parque': 'La carrera se juega dentro del Parque de retos.', 'fuera-del-distrito': 'El laberinto se juega en el Distrito del Saber.', 'fuera-de-la-plaza': 'La búsqueda se juega en la plaza.', 'sin-partida': 'La partida ya terminó.' }[m.reason];
      if (m.reason === 'imposible' || m.reason === 'sin-partida' || m.op === 'start') { this.raceQuit(true); this.huntQuit(); }
      if (why) api.ui.toast(why, 2600); return;
    }
    if (m.game === 'carrera' && this.race && m.op === 'check') { if (m.done) this.#raceDone(m.score, m.seconds, true); else { this.race.next = m.next; api.ui.toast(`Arco ${m.next - 1 || 'de salida'} ✔`, 1200); this.#raceHud(); } }
    if (m.game === 'tesoro' && this.hunt && m.op === 'check') { if (m.done) this.#huntDone(m.score, true); else { this.#found(m.found); if (m.round !== undefined && m.round !== this.hunt.round) { this.hunt.round = m.round; this.hunt.found = []; api.ui.toast(`¡Ronda completa! Ronda ${m.round + 1} de 3`, 2400); } this.#huntRender(); } }
  }

  /** Barrera de la Carrera del Saber: pregunta con pista y reintento; el servidor decide si abre. */
  async #barrier(i, qid, removed = []) {
    if (this.asking || !this.race) return; this.asking = true;
    const api = this.api, qn = questionById(qid); if (!qn) { this.asking = false; return; }
    const ask = (op, payload) => new Promise(res => { if (!this.race.server) return res(null); this.waitBarrier = res; api.net.play(op, payload); setTimeout(() => { if (this.waitBarrier === res) { this.waitBarrier = null; res({ ok: false, reason: 'sin-respuesta' }); } }, 8000); });
    const opts = qn.options.map((t, k) => ({ id: String(k), label: t, disabled: removed.includes(k) }));
    const pick = await api.ui.choice({ speaker: `Barrera del saber · arco ${i}`, text: qn.q, options: [...opts, { id: 'pista', label: 'Pedir una pista', hint: 'Quita una opción equivocada (−3 puntos)', disabled: removed.length > 0 }] });
    this.asking = false; if (!this.race) return;
    if (pick === 'pista') { const r = this.race.server ? await ask('hint', { i }) : { ok: true, remove: qn.options.findIndex((_, k) => k !== qn.answer) }; return this.#barrier(i, qid, r && r.ok ? [r.remove] : []); }
    const choice = Number(pick), r = this.race.server ? await ask('answer', { i, choice }) : (choice === qn.answer ? { ok: true, open: true, explain: qn.explain } : { ok: false, reason: 'incorrecta', explain: qn.explain, q: QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)].id });
    if (!this.race) return;
    if (r && r.ok && r.open) {
      this.race.open[i] = true; api.player.emote('celebrate', 1); api.ui.toast('¡Barrera abierta! ' + (r.explain || ''), 2600);
      this.waitUntil = 0; if (this.race.server) { this.pending = true; this.#play('check', { game: 'carrera', i }); }
      return;
    }
    if (r && r.reason === 'incorrecta') { api.ui.toast('Esa no era. ' + (r.explain || '') + ' Aquí va otra pregunta (−5).', 3600); setTimeout(() => this.#barrier(i, r.q), 900); return; }
    api.ui.toast('No se pudo revisar tu respuesta. Acércate al arco para intentarlo de nuevo.', 2800); this.waitUntil = performance.now() + 1500;
  }

  #found(id) { const t = TREASURES.find(x => x.id === id); if (!t || this.hunt.found.includes(id)) return; this.hunt.found.push(id); this.api.ui.toast(`¡Encontraste: ${t.icon} ${t.name}!`, 1800); this.api.player.emote('celebrate', 1.2); }

  async #raceDone(score, seconds, server) {
    const api = this.api; this.race = null; api.ui.setTracker(null);
    let r;
    if (server) r = await new Promise(res => { const off = api.net.on('profile', m => { if (m.op === 'activity' && m.id === 'carrera') { off(); res({ score: m.score, xp: m.xp || 0, bonus: m.bonus || 0, capped: m.capped, server: true }); } }); setTimeout(() => { off(); res({ score, xp: 0, server: true }); }, 5000); });
    else r = api.edu.localReward('carrera', score);
    api.ui.toast(`¡Meta! Tiempo: ${mmss(seconds)}`, 2400);
    await this.#result(GAME_LIST[0], r);
  }

  async #huntDone(score, server) {
    const api = this.api; this.hunt = null; this.#clearObjs(); api.ui.setTracker(null);
    let r;
    if (server) r = await new Promise(res => { const off = api.net.on('profile', m => { if (m.op === 'activity' && m.id === 'tesoro') { off(); res({ score: m.score, xp: m.xp || 0, bonus: m.bonus || 0, capped: m.capped, server: true }); } }); setTimeout(() => { off(); res({ score, xp: 0, server: true }); }, 5000); });
    else r = api.edu.localReward('tesoro', score);
    await this.#result(GAME_LIST[4], r);
  }

  /** Cada cuadro: llegar a un arco o tocar un tesoro (el servidor confirma con su propia posición). */
  update(dt, t) {
    const api = this.api, p = api.player.position;
    if (this.race) {
      if (api.sceneName !== 'park') { this.raceQuit(true); return; }
      this.hudTick = (this.hudTick || 0) + dt; if (this.hudTick > 0.5) { this.hudTick = 0; this.#raceHud(); }
      const cp = RACE.checkpoints[this.race.next];
      if (cp && !this.pending && performance.now() > (this.waitUntil || 0) && Math.hypot(p.x - cp[0], p.z - cp[1]) <= RACE.radius - 0.2 && p.y >= (cp[2] || 0) - 0.3) {
        if (this.race.server) { this.pending = true; setTimeout(() => this.#play('check', { game: 'carrera', i: this.race?.next }), 150); }
        else if ([2, 5].includes(this.race.next) && !(this.race.open || {})[this.race.next]) { this.race.open = this.race.open || {}; const pool = QUESTIONS.filter(q => q.level !== 'infantil'); this.waitUntil = performance.now() + 1500; this.#barrier(this.race.next, pool[Math.floor(Math.random() * pool.length)].id); }
        else { this.race.next++; if (this.race.next >= RACE.checkpoints.length) { const s = (performance.now() - this.race.t0) / 1000; this.#raceDone(Math.max(50, Math.min(100, Math.round(100 - Math.max(0, s - 30) * 1.5))), s, false); } else this.#raceHud(); }
      }
    }
    if (this.hunt) {
      if (api.sceneName !== 'plaza') { this.huntQuit(); api.ui.toast('Búsqueda del tesoro pausada: regresa a la plaza para empezar otra.', 2600); return; }
      this.objs.forEach((o, i) => { o.children[0].position.y = 1.1 + Math.sin(t * 2.4 + i) * 0.12; o.children[1].rotation.z = t; });
      const ids = this.hunt.rounds[this.hunt.round];
      for (const id of ids) {
        if (this.hunt.found.includes(id) || this.pending || performance.now() < (this.waitUntil || 0)) continue;
        const tr = TREASURES.find(x => x.id === id);
        if (Math.hypot(p.x - tr.at[0], p.z - tr.at[1]) > TREASURE_RADIUS - 0.2) continue;
        if (this.hunt.server) { this.pending = true; setTimeout(() => this.#play('check', { game: 'tesoro', id }), 150); }
        else {
          this.#found(id);
          if (ids.every(x => this.hunt.found.includes(x))) { this.hunt.round++; this.hunt.found = []; if (this.hunt.round >= 3) { const s = (performance.now() - this.hunt.t0) / 1000; this.#huntDone(Math.max(60, Math.min(100, Math.round(100 - Math.max(0, s - 240) / 6))), false); return; } this.api.ui.toast(`¡Ronda completa! Ronda ${this.hunt.round + 1} de 3`, 2400); }
          this.#huntRender();
        }
      }
    }
  }
}
