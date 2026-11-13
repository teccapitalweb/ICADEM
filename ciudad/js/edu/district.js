// Ciudad ICADEM · Distrito del Saber (interfaz y controlador, versión 1.3).
//   · Laberinto del conocimiento: recorrido validado por el servidor con posiciones (como la carrera).
//     Cada puerta se abre respondiendo bien una pregunta; equivocarse solo cuesta tiempo.
//   · Laboratorio de experimentos y Sala de escape: se juegan en ventana y los califica el servidor
//     regenerando la partida con la misma semilla (activities.js → district-rules.js).
//   · Ruta del explorador: sitios repartidos por la ciudad con un destello; al llegar, el servidor
//     confirma la posición y da XP una sola vez por sitio.
import * as THREE from '../three.js';
import { MAZE, LANDMARKS, DISCOVER_XP, experimentAnswer } from './district-rules.js';
import { QUESTIONS, LEVELS_FOR } from './questions.js';
import { encodeState } from '../net/network.js';
import { h } from '../missions/controller.js';
import { dotTexture } from '../world/kit.js';

const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ART = { densidad: ['🥛', '⬇️', '⬆️'], circuito: ['🔋', '💡', '🔌'], ph: ['🧪', '🍋', '🫧'], estado: ['🌡️', '🧊', '♨️'], color: ['🎨', '🖌️', '🌈'], iman: ['🧲', '🔩', '📎'] };
const KIND_TITLE = { densidad: '¿Flota o se hunde?', circuito: 'Circuitos eléctricos', ph: 'Ácidos y bases', estado: 'Estados de la materia', color: 'Mezcla de colores', iman: 'Magnetismo' };

export class District {
  constructor(api) {
    this.api = api; this.run = null; this.pending = false; this.discovering = new Set(); this.markers = []; this.markerScene = null; this.cool = 0;
    api.net.on('play', m => this.#onPlay(m));
  }

  get active() { return Boolean(this.run); }
  #maze() { return this.api.sceneName === 'distrito' && this.api.scene && this.api.scene.maze; }

  /* ---------------- cartelera ---------------- */
  board() {
    const st = this.api.store.state, found = (st.discovered || []).length, act = (st.play && st.play.act) || {};
    const best = id => act[id] && act[id].best ? `mejor puntaje ${act[id].best}` : 'aún sin jugar';
    return this.api.ui.dialog({ speaker: 'Retos del distrito', lines: [
      `Laberinto del conocimiento: cruza las 3 puertas del saber (${best('laberinto')}).`,
      `Laboratorio de experimentos: predice qué pasa en cada experimento (${best('laboratorio')}).`,
      `Sala de escape: abre los 3 candados con lógica y cálculo (${best('escape')}).`,
      `Ruta del explorador: llevas ${found} de ${LANDMARKS.length} sitios. Busca los destellos dorados por la ciudad.`
    ] });
  }

  /** Laboratorio y Sala de escape usan el mismo flujo que los demás minijuegos (nivel → juego → servidor). */
  play(id) { return this.api.games.launch(id); }

  /* ---------------- Laboratorio de experimentos (ventana) ---------------- */
  lab(content) {
    const api = this.api, log = [], wrap = h('div', 'mg lab'), count = h('small', 'mg-bar'), stage = h('div', 'lab__stage'), q = h('p', 'lab__setup'), opts = h('div', 'lab__opts'), fb = h('div', 'lab__fb'), next = h('button', 'btn btn--primary lab__next', 'Siguiente experimento');
    next.type = 'button'; next.hidden = true; wrap.append(count, stage, q, opts, fb, next);
    const show = () => {
      const i = log.length;
      if (i >= content.items.length) { document.querySelector('#modal-actions .btn--primary')?.click(); return; }
      const it = content.items[i], art = ART[it.kind] || ['🔬', '⚗️', '✨'];
      count.textContent = `Experimento ${i + 1} de ${content.items.length} · ${KIND_TITLE[it.kind] || 'Ciencia'} · aciertos ${log.filter((v, k) => v === experimentAnswer(content.items[k].id).answer).length}`;
      stage.className = 'lab__stage is-' + it.kind; stage.replaceChildren(...art.map((a, k) => h('span', 'lab__art lab__art--' + k, a)));
      q.textContent = it.setup + ' — ¿qué crees que pasará?'; fb.textContent = ''; fb.className = 'lab__fb'; next.hidden = true; opts.replaceChildren();
      it.options.forEach((label, v) => {
        const b = h('button', 'lab__opt', label); b.type = 'button';
        b.addEventListener('click', () => {
          if (log.length !== i) return; log.push(v);
          const ans = experimentAnswer(it.id), ok = v === ans.answer;
          opts.querySelectorAll('button').forEach((o, k) => { o.disabled = true; o.classList.toggle('is-right', k === ans.answer); });
          if (!ok) b.classList.add('is-wrong');
          stage.classList.add('is-run', ok ? 'is-ok' : 'is-ko');   // la «reacción» del experimento
          fb.className = 'lab__fb ' + (ok ? 'is-good' : 'is-bad'); fb.replaceChildren(h('strong', null, ok ? '¡Bien predicho!' : 'Resultado distinto'), h('span', null, ` ${it.options[ans.answer]}. ${ans.explain}`));
          next.textContent = log.length >= content.items.length ? 'Ver resultado' : 'Siguiente experimento'; next.hidden = false; next.focus({ preventScroll: true });
        });
        opts.append(b);
      });
    };
    next.addEventListener('click', show);
    show();
    return api.ui.modal({ eyebrow: 'Laboratorio de ciencias', title: 'Laboratorio de experimentos', content: wrap, wide: true, actions: [{ id: 'quit', label: 'Salir' }, { id: 'ok', label: 'Terminar', primary: true }],
      validate: id => id === 'ok' && log.length < content.items.length ? 'Termina todos los experimentos o elige Salir.' : null }).then(r => r === 'ok' ? log : null);
  }

  /* ---------------- Sala de escape (ventana) ---------------- */
  escape(content) {
    const api = this.api, log = []; let lock = 0;
    const wrap = h('div', 'mg esc'), locks = h('div', 'esc__locks'), card = h('div', 'esc__card'), tt = h('h4', 'esc__title'), clue = h('p', 'esc__clue'), hint = h('p', 'esc__hint');
    const form = h('form', 'esc__form'), input = h('input', 'esc__input'), open = h('button', 'btn btn--primary', 'Abrir'), help = h('button', 'btn', 'Pedir pista');
    input.type = 'text'; input.inputMode = 'numeric'; input.maxLength = 6; input.autocomplete = 'off'; input.setAttribute('aria-label', 'Código del candado'); open.type = 'submit'; help.type = 'button';
    form.append(input, open, help); card.append(tt, clue, hint, form); wrap.append(locks, card);
    const paint = () => {
      locks.replaceChildren(...content.locks.map((l, k) => { const el = h('div', 'esc__lock' + (k < lock ? ' is-open' : k === lock ? ' is-now' : ''), k < lock ? '🔓' : '🔒'); el.append(h('small', null, `Candado ${k + 1}`)); return el; }));
      if (lock >= content.locks.length) { card.replaceChildren(h('p', 'esc__win', '🚪 ¡La puerta se abrió! Saliste de la sala.')); setTimeout(() => document.querySelector('#modal-actions .btn--primary')?.click(), 1100); return; }
      const l = content.locks[lock]; tt.textContent = l.title; clue.textContent = l.clue; hint.textContent = ''; input.value = ''; setTimeout(() => input.focus({ preventScroll: true }), 50);
    };
    form.addEventListener('submit', e => {
      e.preventDefault(); const code = input.value.replace(/\D/g, ''); if (!code || lock >= content.locks.length) return;
      log.push({ lock, code });
      if (code === content.locks[lock].code) { lock++; api.player.emote('celebrate', 1); paint(); }
      else { card.classList.remove('is-shake'); void card.offsetWidth; card.classList.add('is-shake'); api.ui.toast('Ese código no abre el candado (−10). Revisa la pista.', 2000); input.select(); }
    });
    help.addEventListener('click', () => { if (lock >= content.locks.length || hint.textContent) return; log.push({ lock, hint: true }); hint.textContent = '💡 ' + content.locks[lock].hint + ' (−8)'; });
    input.addEventListener('keydown', e => e.stopPropagation());
    paint();
    return api.ui.modal({ eyebrow: 'Sala de escape', title: 'Abre los tres candados', content: wrap, wide: true, actions: [{ id: 'quit', label: 'Salir' }, { id: 'ok', label: 'Terminar', primary: true }],
      validate: id => id === 'ok' && lock < content.locks.length ? 'Aún hay candados cerrados. Puedes salir y volver a intentarlo.' : null }).then(r => r === 'ok' ? log : null);
  }

  /* ---------------- Laberinto del conocimiento ---------------- */
  mazeLabel() { return this.run ? `Laberinto · puerta ${Math.min(this.run.next + 1, 3)} de 3` : 'Laberinto del conocimiento · empezar'; }

  async mazeStart() {
    const api = this.api;
    if (this.run) { const q = await api.ui.choice({ speaker: 'Laberinto del conocimiento', text: '¿Abandonar el recorrido?', options: [{ id: 'si', label: 'Abandonar' }, { id: 'no', label: 'Seguir', primary: true }] }); if (q === 'si') this.mazeQuit(); return; }
    if (api.sceneName !== 'distrito') { api.ui.toast('El laberinto está en el Distrito del Saber, al sur de la plaza.', 3000); return; }
    api.games.mark?.('laberinto');
    await api.ui.dialog({ speaker: 'Laberinto del conocimiento', lines: ['Encuentra el camino entre los setos. Tres puertas del saber bloquean el paso: acércate y responde bien para abrirlas.', 'Si te equivocas, la puerta sigue cerrada y te hace otra pregunta. ¡La salida está al otro lado!'] });
    this.#maze()?.reset();
    this.run = { next: 0, opened: 0, t0: performance.now(), server: api.net.isOnline };
    if (this.run.server) { this.pending = true; this.#send('start', { game: 'laberinto' }); }
    this.#hud();
  }

  mazeQuit(silent) { if (!this.run) return; if (this.run.server) this.api.net.play('quit', {}); this.run = null; this.pending = false; this.#maze()?.reset(); this.api.ui.setTracker(null); if (!silent) this.api.ui.toast('Recorrido abandonado.', 2000); }

  async gate(n) {
    const api = this.api, run = this.run;
    if (!run) return api.ui.toast('Empieza en la entrada del laberinto para abrir las puertas del saber.', 2600);
    if (n < run.opened) return;
    if (n > run.opened) return api.ui.toast(`Primero abre la puerta ${run.opened + 1}.`, 2000);
    if (performance.now() < this.cool) return api.ui.toast('Piensa un momento antes de intentar otra vez…', 1500);
    const levels = LEVELS_FOR[api.store.state.profileKind === 'infantil' ? 'infantil' : 'adulto'], pool = QUESTIONS.filter(q => levels.includes(q.level));
    const q = pool[Math.floor(Math.random() * pool.length)];
    const pick = await api.ui.choice({ speaker: `Puerta ${n + 1} del saber`, text: q.q, options: q.options.map((label, i) => ({ id: String(i), label })) });
    if (!this.run || pick === null || pick === undefined) return;
    if (Number(pick) === q.answer) { run.opened = n + 1; this.#maze()?.setGate(n, true); api.player.emote('celebrate', 1); api.ui.toast(`¡Correcto! Se abrió la puerta ${n + 1}. Cruza para seguir.`, 2200); }
    else { this.cool = performance.now() + 3000; api.ui.toast(`No es correcto: era «${q.options[q.answer]}». La puerta sigue cerrada; inténtalo con otra pregunta.`, 3200); }
    this.#hud();
  }

  #hud() {
    if (!this.run) return;
    const s = (performance.now() - this.run.t0) / 1000;
    this.api.ui.setTracker({ title: `Laberinto · ${mmss(s)}`, badge: 'Minijuego · XP', steps: ['Puerta 1', 'Puerta 2', 'Puerta 3', 'Salida'].map((text, i) => ({ text, done: i < this.run.next, active: i === this.run.next })) });
  }

  /** Envío al servidor: antes se manda la posición actual (quieto, el cliente no envía estado). */
  #send(op, payload) {
    const api = this.api, net = api.net, last = net.lastSent, p = api.player.position;
    if (last) { const now = encodeState({ scene: api.sceneName, x: p.x, y: p.y, z: p.z, yaw: api.player.yaw || 0 }); now[5] = last[5]; net.sendState(now); }
    net.play(op, payload);
  }

  async #mazeDone(score, seconds, server) {
    const api = this.api; this.run = null; api.ui.setTracker(null);
    let r;
    if (server) r = await new Promise(res => { const off = api.net.on('profile', m => { if (m.op === 'activity' && m.id === 'laberinto') { off(); res({ score: m.score, xp: m.xp || 0, bonus: m.bonus || 0, capped: m.capped, server: true }); } }); setTimeout(() => { off(); res({ score, xp: 0, server: true }); }, 5000); });
    else r = api.edu.localReward('laberinto', score);
    api.ui.toast(`¡Saliste del laberinto! Tiempo: ${mmss(seconds)}`, 2400);
    setTimeout(() => this.#maze()?.reset(), 1500);
    await api.games.result('laberinto', r);
  }

  #onPlay(m) {
    const api = this.api;
    if (m.op === 'discover') {
      if (m.profile) api.applyProfile(m.profile);   // el sitio queda en la cuenta (y deja de pedirse)
      if (m.ok === false && m.reason === 'lejos') this.retryAt = performance.now() + 4000;
      this.discovering.delete(m.id);
      if (m.ok && m.xp) { const l = LANDMARKS.find(x => x.id === m.id); api.ui.toast(`🧭 ¡Descubriste ${l ? l.icon + ' ' + l.name : 'un sitio'}! +${m.xp} XP`, 3000); api.player.emote('celebrate', 1.2); this.markerScene = null; }
      return;
    }
    if (m.game !== 'laberinto' || !this.run) return;
    this.pending = false;
    if (m.ok === false) { this.waitUntil = performance.now() + 900; if (m.op === 'start' || m.reason === 'imposible' || m.reason === 'sin-partida') this.mazeQuit(true); return; }
    if (m.op === 'check') { if (m.done) this.#mazeDone(m.score, m.seconds, true); else { this.run.next = m.next; this.#hud(); } }
  }

  /* ---------------- Ruta del explorador: destellos y descubrimiento ---------------- */
  #markers() {
    const api = this.api, scene = api.scene; this.markers.forEach(mk => mk.parent && mk.parent.remove(mk)); this.markers = [];
    this.markerScene = api.sceneName; if (!scene) return;
    const found = api.store.state.discovered || [];
    for (const l of LANDMARKS) {
      if (l.scene !== api.sceneName || found.includes(l.id)) continue;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffd166, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set(l.at[0], 3.2, l.at[1]); s.scale.set(1.1, 1.1, 1); s.userData.id = l.id; scene.group.add(s); this.markers.push(s);
    }
  }

  update(dt, t) {
    const api = this.api, p = api.player.position;
    if (this.markerScene !== api.sceneName) this.#markers();
    for (let k = 0; k < this.markers.length; k++) { const s = this.markers[k], b = 1 + Math.sin(t * 3 + k) * 0.18; s.scale.set(b, b, 1); s.position.y = 3.1 + Math.sin(t * 1.6 + k) * 0.25; }
    // descubrir: el servidor confirma con su propia posición
    const found = api.store.state.discovered || [];
    for (const l of LANDMARKS) {
      if (l.scene !== api.sceneName || found.includes(l.id) || this.discovering.has(l.id)) continue;
      if (Math.hypot(p.x - l.at[0], p.z - l.at[1]) > l.r - 0.4) continue;
      if (api.net.isOnline) { if (performance.now() < (this.retryAt || 0)) continue; this.discovering.add(l.id); setTimeout(() => this.#send('discover', { id: l.id }), 120); setTimeout(() => this.discovering.delete(l.id), 8000); }
      else { api.store.state.discovered = [...found, l.id]; api.store.addXp(DISCOVER_XP); api.ui.toast(`🧭 ¡Descubriste ${l.icon} ${l.name}! +${DISCOVER_XP} XP`, 3000); this.markerScene = null; }
    }
    // laberinto
    if (this.run) {
      if (api.sceneName !== 'distrito') { this.mazeQuit(true); return; }
      this.hudTick = (this.hudTick || 0) + dt; if (this.hudTick > 0.5) { this.hudTick = 0; this.#hud(); }
      const i = this.run.next, cp = MAZE.checkpoints[i];
      if (!cp || this.pending || performance.now() < (this.waitUntil || 0) || (i < 3 && this.run.opened <= i)) return;   // la puerta i debe estar abierta (la salida, i = 3, no tiene puerta)
      if (Math.hypot(p.x - cp[0], p.z - cp[1]) > MAZE.radius - 0.2) return;
      if (this.run.server) { this.pending = true; setTimeout(() => this.#send('check', { game: 'laberinto', i: this.run?.next }), 150); }
      else { this.run.next++; if (this.run.next >= MAZE.checkpoints.length) { const s = (performance.now() - this.run.t0) / 1000; this.#mazeDone(Math.max(50, Math.min(100, Math.round(100 - Math.max(0, s - MAZE.par) * MAZE.per))), s, false); } else this.#hud(); }
    }
  }
}
