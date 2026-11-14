// Ciudad ICADEM 2.0 · juegos de «Mundo vivo» en el cliente.
//   · Actividades de elección (Héroes, Rescate, Veterinarios, Mercado, Agua, Emociones): ventana con
//     retroalimentación por opción; el servidor reproduce la bitácora y da XP y monedas.
//   · Juegos de campo (Manzanas, Guardianes, Expedición): objetos 3D en el escenario; cada acción la
//     valida el servidor con la posición que él aceptó.
import * as THREE from '../three.js';
import { ACTIVITIES } from './activities.js';
import { FIELD_GAMES, TRASH, BINS, STAMPS, fieldStart, fieldState, fieldStep, fieldScore, stampQuestion } from './field-games.js';
import { Npc } from '../characters/npc.js';
import { NPC_LOOKS } from '../characters/catalog.js';
import { mat, sph, cyl, box, sign } from '../world/kit.js';
import { PetPreview } from '../pets/pet-preview.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
export const CHOICE_GAMES = ['heroes', 'rescate', 'veterinarios', 'mercado', 'agua', 'emociones'];
export const FIELD_IDS = ['manzanas', 'guardianes', 'expedicion'];
const VERDICT = ['Mejor no', 'Está bien, y se puede mejorar', '¡Muy bien!'];
const REASONS = { lejos: 'Acércate un poco más.', 'habla-primero': 'Primero habla con Doña Rosa.', faltan: 'Todavía faltan cosas por hacer.', 'manos-llenas': 'Lleva primero lo que traes al bote correcto.', 'sin-basura': 'No llevas nada que tirar.', 'ya-sellado': 'Ese sello ya es tuyo.', 'sin-partida': 'La partida ya terminó.', imposible: 'Demasiado rápido para ser real: la partida no cuenta.' };

export class VivoGames {
  constructor(api) {
    this.api = api; this.run = null; this.objs = []; this.its = []; this.waiting = null;
    api.net.on('play', m => { if (this.waiting && (m.op === 'start' || m.op === 'check') && FIELD_IDS.includes(m.game)) { const w = this.waiting; this.waiting = null; w(m); } });
    api.events.on('scene', () => this.#render());
    // con conexión, el resultado llega con el perfil (XP y monedas los decide el servidor)
    api.net.on('profile', m => { if (m.op === 'activity' && FIELD_IDS.includes(m.id) && m.ok) api.games.result(m.id, { score: m.score, xp: m.xp || 0, coins: m.coins || 0, bonus: m.bonus || 0, server: true }); });
  }
  get active() { return Boolean(this.run); }

  /* ================= actividades de elección ================= */
  async choice(id, level = 'normal') {
    const api = this.api, a = ACTIVITIES[id], seed = Math.floor(Math.random() * 0xFFFFFFFF), content = a.build(seed, level), log = [];
    this.current = { id, content };   // para depurar y para las pruebas automáticas
    const wrap = h('div', 'vg'), stage = h('div', 'vg__stage'), body = h('div', 'vg__body'), bar = h('div', 'vg__progress');
    let preview = null; if (id === 'veterinarios') try { preview = new PetPreview(api.engine.renderer, { width: 220, height: 170 }); stage.append(preview.canvas); preview.start(); } catch (_) { preview = null; }
    if (content.case) body.append(h('p', 'vg__case', content.case.intro));
    wrap.append(bar, stage, body);
    let t = 0;
    const show = () => {
      const task = content.tasks[t]; body.querySelectorAll('.vg__task').forEach(n => n.remove());
      bar.textContent = `${t + 1} de ${content.tasks.length}`; bar.style.setProperty('--p', Math.round(100 * t / content.tasks.length) + '%');
      if (preview && task.breed) preview.show(task.breed, {}); stage.hidden = !(preview && task.breed);
      const box = h('div', 'vg__task'); box.append(h('h4', null, task.title), h('p', null, task.text));
      const opts = h('div', 'vg__opts'), fb = h('p', 'vg__fb');
      task.options.forEach((o, c) => { const b = h('button', 'vg__opt', o.text); b.type = 'button'; b.addEventListener('click', () => {
        log.push({ t, c }); opts.querySelectorAll('button').forEach(x => { x.disabled = true; }); b.classList.add('is-v' + o.value);
        fb.textContent = `${VERDICT[o.value]}: ${o.feedback}`; fb.className = 'vg__fb is-v' + o.value;
        const next = h('button', 'btn btn--primary', task.retry && o.value < 2 ? 'Intentar de nuevo' : t + 1 < content.tasks.length ? 'Siguiente' : 'Ver resultado'); next.type = 'button';
        next.addEventListener('click', () => { if (task.retry && o.value < 2) return show(); t++; if (t < content.tasks.length) show(); else finish(); });
        box.append(next); next.focus();
      }); opts.append(b); });
      box.append(opts, fb); body.append(box);
    };
    let done = false;
    const finish = async () => {
      if (done) return; done = true; document.getElementById('modal-x')?.click();
      const r = await api.edu.activity(id, seed, level, log);
      api.events.emit('vivo-game', id);
      api.games.result(id, r.error ? { score: 0, error: r.error } : { ...r, source: content.source });
    };
    show();
    return api.ui.modal({ eyebrow: 'Mundo vivo · minijuego', title: a.title, content: wrap, wide: true, actions: [{ id: 'x', label: 'Salir' }], onClose: () => preview?.stop() });
  }

  /* ================= juegos de campo ================= */
  async field(id, forcedSeed) {
    const api = this.api, g = FIELD_GAMES[id];
    if (this.run) return api.ui.toast('Termina primero el juego en curso.', 2400);
    if (api.sceneName !== g.scene) { api.ui.toast(`Te llevamos a ${g.scene === 'park' ? 'el Parque de retos' : 'la plaza'} para empezar.`, 2800); await api.games.goTo(g.scene); await new Promise(r => setTimeout(r, 900)); }
    const seed = Number.isInteger(forcedSeed) ? forcedSeed : Math.floor(Math.random() * 0xFFFFFFFF), online = api.net.isOnline;
    let data = fieldStart(id, seed);
    if (online) { this.#fresh(); const r = await this.#ask('start', { game: id, seed }); if (!r.ok) return api.ui.toast(REASONS[r.reason] || 'No se pudo empezar el juego.', 2800); data = r.data; }
    this.run = { id, data, st: fieldState(id), online, t0: performance.now(), busy: false };
    if (id === 'manzanas') api.ui.toast('Doña Rosa necesita ayuda: ve a hablar con ella (está junto al camino del este).', 3600);
    if (id === 'guardianes') api.ui.toast('Recoge la basura y llévala al bote correcto. Si algo es peligroso, ¡no lo toques: avisa!', 4200);
    if (id === 'expedicion') this.#clues();
    this.#render(); this.#hud();
  }
  quit(silent) { if (!this.run) return; if (this.run.online) this.api.net.play('quit', {}); this.run = null; this.#clear(); this.api.ui.setTracker(null); if (!silent) this.api.ui.toast('Juego abandonado.', 2000); }

  #fresh() { if (this.api.net.lastSent) this.api.net.sendState(this.api.net.lastSent); }
  #ask(op, payload) { return new Promise(res => { this.waiting = res; this.api.net.play(op, payload); setTimeout(() => { if (this.waiting === res) { this.waiting = null; res({ ok: false, reason: 'sin-respuesta' }); } }, 8000); }); }

  /** Una acción del juego: con conexión la decide el servidor; sin ella, las mismas reglas aquí. */
  async act(action) {
    const run = this.run; if (!run || run.busy) return null; run.busy = true;
    let r;
    if (run.online) { this.#fresh(); r = await this.#ask('check', { game: run.id, action }); }
    else { const p = this.api.player.position, scene = this.api.sceneName; r = fieldStep(run.id, run.data, run.st, action, s => (s === scene ? { x: p.x, z: p.z } : null)); if (r.done) r = { ...r, score: fieldScore(run.id, (performance.now() - run.t0) / 1000, r.st) }; }
    run.busy = false; if (!this.run) return r;
    if (r.st) run.st = r.st;
    if (r.done) { this.#done(r); return r; }
    this.#render(); this.#hud();
    return r;
  }

  async #done(r) {
    const api = this.api, id = this.run.id, online = this.run.online; this.run = null; this.#clear(); api.ui.setTracker(null);
    api.player.emote('celebrate', 1.4); api.events.emit('vivo-game', id);
    if (online) return;   // el servidor manda el perfil con XP y monedas (Games muestra el resultado)
    api.games.result(id, api.edu.localReward(id, r.score));
  }

  /* ---------- objetos en el escenario ---------- */
  #clear() { for (const o of this.objs) o.parent?.remove(o); this.objs = []; const s = this.api.scene; if (s) s.interactables = s.interactables.filter(i => !String(i.id).startsWith('vg-')); this.its = []; }
  #add(o) { this.api.scene.group.add(o); this.objs.push(o); return o; }
  #it(it) { this.api.scene.interactables.push({ ...it, id: 'vg-' + it.id }); }
  #render() {
    this.#clear(); const run = this.run, api = this.api; if (!run || !api.scene) return;
    const scene = api.sceneName, d = run.data, st = run.st, g = FIELD_GAMES[run.id];
    if (run.id === 'manzanas' && scene === 'plaza') {
      const npc = new Npc({ look: NPC_LOOKS.vecina, x: g.npc.x, z: g.npc.z, yaw: -Math.PI / 2 }); this.#add(npc.group); npc.update?.(0.016, api.player.position);
      if (st.phase === 'hablar') this.#it({ id: 'rosa', x: g.npc.x, y: 1.6, z: g.npc.z, radius: 2.2, label: 'Hablar con Doña Rosa', action: async () => { await api.ui.dialog?.({ speaker: 'Doña Rosa', lines: ['¡Ay, se me rompió la bolsa y se regaron mis manzanas!', '¿Me ayudas a recogerlas? Cuidado con los charcos: si pisas uno, se te cae una.'] }); this.act({ type: 'talk' }); } });
      else {
        for (const a of d.apples) if (!st.got.includes(a.id)) { const m = sph(0.16, mat(0xd8302f, { r: 0.45 }), a.x, 0.16, a.z, null); const leaf = box(0.06, 0.02, 0.12, mat(0x3f9a4d), 0, 0.17, 0.03, m); leaf.rotation.y = 0.6; m.userData.apple = a.id; this.#add(m); }
        for (const [x, z] of this.#puddles(d)) { const pd = cyl(0.8, 0.8, 0.02, mat(0x6fb6e8, { r: 0.1, m: 0.2 }), x, 0.01, z, null, { seg: 20, cast: false }); pd.userData.puddle = true; this.#add(pd); }
        if (st.phase === 'entregar') this.#it({ id: 'entregar', x: g.npc.x, y: 1.6, z: g.npc.z, radius: 2.2, label: 'Entregar las manzanas a Doña Rosa', action: () => this.act({ type: 'deliver' }) });
      }
    }
    if (run.id === 'guardianes' && scene === 'park') {
      for (const b of BINS) { const grp = new THREE.Group(); grp.position.set(b.x, 0, b.z); cyl(0.32, 0.28, 0.85, mat(b.color, { r: 0.6 }), 0, 0, 0, grp, { seg: 16 }); const sg = sign(b.name.toUpperCase(), 1.2, 0.3, { bg: '#ffffff', fg: '#12325f' }); sg.position.set(0, 1.25, 0); grp.add(sg); this.#add(grp); }
      for (const it of d.items) {
        if (st.binned.includes(it.id) || st.reported.includes(it.id) || st.carry === it.id) continue;
        const t = TRASH.find(x => x.id === it.kind), grp = new THREE.Group(); grp.position.set(it.x, 0, it.z);
        const sg = sign(t.icon, 0.5, 0.5, { bg: t.type === 'peligroso' ? '#ffe2a8' : '#ffffff', fg: '#12325f', radius: 0.25 }); sg.position.y = 0.55; sg.userData.billboard = true; grp.add(sg);
        cyl(0.22, 0.25, 0.08, mat(t.type === 'peligroso' ? 0xb8c7d6 : 0x9a7b5a, { r: 0.8 }), 0, 0, 0, grp, { seg: 10 }); this.#add(grp);
        this.#it({ id: it.id, x: it.x, y: 1, z: it.z, radius: 1.7, label: `${t.icon} ${t.name}`, action: () => this.#trash(it, t) });
      }
      for (const p of d.plants) if (!st.watered.includes(p.id)) { const pl = sph(0.35, mat(0x9bb56b, { flat: true }), p.x, 0.35, p.z, null); this.#add(pl); this.#it({ id: p.id, x: p.x, y: 1, z: p.z, radius: 2, label: '💧 Regar la planta', action: () => this.act({ type: 'water', id: p.id }) }); }
      if (st.carry) for (const b of BINS) this.#it({ id: 'bote-' + b.id, x: b.x, y: 1.2, z: b.z, radius: 1.5, label: `Tirar en ${b.name}`, action: () => this.#bin(b) });
    }
    if (run.id === 'expedicion') {
      for (const id of d.stamps) {
        const s = STAMPS.find(x => x.id === id); if (s.scene !== scene) continue;
        const done = st.got.includes(id), grp = new THREE.Group(); grp.position.set(s.fx, 0, s.fz);
        cyl(0.05, 0.05, 2.2, mat(0x12325f), 0, 0, 0, grp, { seg: 8 }); const flag = sign(done ? '✔' : s.icon, 0.7, 0.5, { bg: done ? '#7bd389' : '#ffd166', fg: '#12325f' }); flag.position.set(0.38, 1.9, 0); grp.add(flag); this.#add(grp);
        if (!done) this.#it({ id: 'sello-' + id, x: s.fx, y: 1.4, z: s.fz, radius: 2.4, label: `📜 Sello: ${s.name}`, action: () => this.#stamp(s) });
      }
      if (scene === 'plaza' && st.got.length === d.stamps.length) this.#it({ id: 'meta', x: 0, y: 1.6, z: 6, radius: 3.5, label: '🏆 Terminar la expedición', action: () => this.act({ type: 'finish' }) });
    }
  }
  #puddles(d) { return d.apples.slice(0, 3).map((a, i) => [a.x + (i % 2 ? 1.6 : -1.6), a.z + (i % 2 ? -1.2 : 1.4)]); }
  async #trash(it, t) {
    const api = this.api, pick = await api.ui.choice({ speaker: 'Guardianes del parque', text: `${t.icon} ${t.name}. ¿Qué haces?`, options: [{ id: 'pick', label: 'Recogerlo para tirarlo en su bote' }, { id: 'report', label: 'No tocarlo y avisar al guardaparques' }, { id: 'x', label: 'Dejarlo por ahora' }] });
    if (pick === 'x') return;
    const r = await this.act({ type: pick, id: it.id });
    if (!r) return;
    if (r.reason === 'peligroso') api.ui.toast(`¡Cuidado! ${r.why} (−10)`, 4200);
    else if (r.reason === 'no-es-peligroso') api.ui.toast('Eso no es peligroso: puedes recogerlo y tirarlo en su bote (−3).', 3200);
    else if (r.ok && pick === 'report') api.ui.toast('Bien hecho: el guardaparques lo retirará con protección.', 3000);
    else if (r.ok) api.ui.toast(`Llevas: ${t.name}. ¿En qué bote va?`, 2600);
    else api.ui.toast(REASONS[r.reason] || 'No se pudo.', 2400);
  }
  async #bin(b) {
    const r = await this.act({ type: 'bin', bin: b.id }); if (!r) return;
    if (r.reason === 'otro-bote') this.api.ui.toast(`Ese no es su bote: va en ${BINS.find(x => x.id === r.type).name} (−6). Inténtalo otra vez.`, 3400);
    else if (r.ok && !r.done) this.api.ui.toast(`¡En ${b.name}! Muy bien.`, 1800);
  }
  async #stamp(s) {
    const api = this.api, run = this.run, q = stampQuestion(run.data, run.st, s.id); if (!q) return;
    const pick = await api.ui.choice({ speaker: `Sello: ${s.name}`, text: q.q, options: [...q.options.map((t, k) => ({ id: String(k), label: t })), { id: 'x', label: 'Ahora no' }] });
    if (pick === 'x') return;
    const r = await this.act({ type: 'stamp', id: s.id, choice: Number(pick) }); if (!r) return;
    if (r.ok) api.ui.toast(`¡Sello conseguido! ${r.explain || ''}`, 3200);
    else if (r.reason === 'incorrecta') api.ui.toast(`No es correcta (−6). ${r.explain || ''} Inténtalo con otra pregunta.`, 4000);
    else api.ui.toast(REASONS[r.reason] || 'No se pudo.', 2400);
  }
  #clues() { const d = this.run.data; this.api.ui.dialog?.({ speaker: 'Expedición del conocimiento', lines: ['Reúne 4 sellos siguiendo las pistas. En cada lugar responde una pregunta.', ...d.stamps.map((id, i) => `Pista ${i + 1}: ${STAMPS.find(s => s.id === id).clue}`), 'Al final vuelve a la fuente de la plaza.'] }); }
  #hud() {
    const run = this.run; if (!run) return; const st = run.st, d = run.data, g = FIELD_GAMES[run.id];
    const steps = run.id === 'manzanas' ? [{ text: 'Hablar con Doña Rosa', done: st.phase !== 'hablar' }, { text: `Manzanas: ${st.got.length} de ${d.apples.length}`, done: st.got.length === d.apples.length, active: st.phase === 'recoger' }, { text: 'Entregarlas', active: st.phase === 'entregar' }]
      : run.id === 'guardianes' ? [{ text: `Basura en su bote: ${st.binned.length} de ${d.items.filter(x => TRASH.find(t => t.id === x.kind).type !== 'peligroso').length}`, active: true }, { text: `Peligros reportados: ${st.reported.length} de ${d.items.filter(x => TRASH.find(t => t.id === x.kind).type === 'peligroso').length}` }, { text: `Plantas regadas: ${st.watered.length} de ${d.plants.length}` }, ...(st.carry ? [{ text: `Llevas: ${TRASH.find(t => t.id === d.items.find(x => x.id === st.carry).kind).name}`, active: true }] : [])]
      : [...d.stamps.map(id => ({ text: STAMPS.find(s => s.id === id).name, done: st.got.includes(id) })), { text: 'Volver a la fuente', active: st.got.length === d.stamps.length }];
    this.api.ui.setTracker({ title: g.title, badge: 'Mundo vivo · XP y monedas', steps });
  }

  update(dt) {
    const run = this.run, api = this.api; if (!run || run.busy) return;
    const p = api.player.position;
    if (run.id === 'manzanas' && api.sceneName === 'plaza' && run.st.phase !== 'hablar') {
      for (const o of this.objs) if (o.userData.apple && Math.hypot(o.position.x - p.x, o.position.z - p.z) < FIELD_GAMES.manzanas.pick - 0.25) { this.act({ type: 'pick', id: o.userData.apple }); return; }
      const inPuddle = this.objs.some(o => o.userData.puddle && Math.hypot(o.position.x - p.x, o.position.z - p.z) < 0.7);
      if (inPuddle && !run.wet && run.st.got.length) { run.wet = true; api.ui.toast('¡Splash! Se te cayó una manzana. Rodea los charcos (−3).', 2600); this.act({ type: 'slip' }); } else if (!inPuddle) run.wet = false;
    }
    for (const o of this.objs) if (o.userData.apple) o.rotation.y += dt;
  }
}
