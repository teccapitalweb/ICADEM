// Ciudad ICADEM 2.0 · juegos de campo de «Mundo vivo» (módulo puro, cliente y servidor).
//
// Se juegan caminando por la ciudad. El SERVIDOR aplica fieldStep con la última posición que él
// mismo aceptó (control de velocidad y de puertas): el navegador no puede «recoger» ni «llegar»
// solo por decirlo. Las preguntas se califican con el banco del servidor.
//   · manzanas    Manzanas perdidas: recoger las manzanas de Doña Rosa y devolvérselas.
//   · guardianes  Guardianes del parque: recoger basura, separarla, reportar lo peligroso y regar.
//   · expedicion  Expedición del conocimiento: pistas, lugares y preguntas para reunir sellos.
import { rng } from './activities.js';
import { QUESTIONS, questionById } from './questions.js';

const shuffle = (list, r) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const near = (p, x, z, r) => Boolean(p) && Math.hypot(p.x - x, p.z - z) <= r + 0.6;

/* ---------------- Manzanas perdidas (plaza) ---------------- */
const APPLE_SPOTS = [[12, 10], [14, 12], [16, 14], [18, 16], [14, 16], [16, 10], [12, 14], [18, 12], [10, 12], [16, 6], [18, 4], [20, 2]];
/* ---------------- Guardianes del parque (park) ---------------- */
export const TRASH = Object.freeze([
  { id: 'cascara', name: 'Cáscara de plátano', icon: '🍌', type: 'organico' }, { id: 'manzana', name: 'Corazón de manzana', icon: '🍎', type: 'organico' },
  { id: 'botella', name: 'Botella de plástico', icon: '🧴', type: 'reciclable' }, { id: 'lata', name: 'Lata de aluminio', icon: '🥫', type: 'reciclable' },
  { id: 'periodico', name: 'Periódico', icon: '📰', type: 'reciclable' }, { id: 'envoltura', name: 'Envoltura de dulce', icon: '🍬', type: 'inorganico' },
  { id: 'popote', name: 'Popote', icon: '🥤', type: 'inorganico' }, { id: 'vidrio', name: 'Vidrio roto', icon: '⚠️', type: 'peligroso', why: 'Puede cortarte. Avisa a un adulto o al guardaparques para que lo retire con protección.' },
  { id: 'pila', name: 'Pila usada', icon: '🔋', type: 'peligroso', why: 'Las pilas contienen sustancias tóxicas: un adulto debe llevarla a un punto de acopio.' }
]);
export const BINS = Object.freeze([
  { id: 'organico', name: 'Orgánico', color: 0x2fa865, x: -8.5, z: 9.6 }, { id: 'reciclable', name: 'Reciclable', color: 0x2f6fd8, x: -6.9, z: 9.6 }, { id: 'inorganico', name: 'Inorgánico', color: 0x8a8f98, x: -5.3, z: 9.6 }
]);
const PARK_SPOTS = [[-9, 2], [-9.5, -6], [-3, -10.5], [3, -10.5], [9.5, -7], [9.5, 6], [-4, 5.5], [4, 6], [-10, -1], [10.2, -1.5]];
const PLANT_SPOTS = [[-10.4, 10.4], [10.4, 10.4], [-10.6, 3.5], [10.6, 2.5]];
/* ---------------- Expedición del conocimiento (varios lugares) ---------------- */
export const STAMPS = Object.freeze([
  { id: 'fuente', scene: 'plaza', x: 0, z: 0, r: 6.2, fx: 0, fz: 5.6, icon: '⛲', name: 'Fuente de la plaza', clue: 'Donde el agua baila y la ciudad se encuentra.' },
  { id: 'dragones', scene: 'plaza', x: -20, z: 0, r: 3.2, fx: -18.2, fz: 1.4, icon: '🐉', name: 'Helipuerto de dragones', clue: 'Desde aquí se despega para ver la ciudad desde el cielo.' },
  { id: 'aguas', scene: 'plaza', x: -17.5, z: 12.5, r: 3.4, fx: -15.9, fz: 14.2, icon: '🥤', name: 'Puesto de aguas frescas', clue: 'Horchata, jamaica y tamarindo te esperan bajo un toldo de rayas.' },
  { id: 'meta', scene: 'park', x: 0, z: 0, r: 3.2, fx: 1.6, fz: 1.6, icon: '🏁', name: 'Meta del Parque de retos', clue: 'Al centro del circuito, donde termina la carrera.' },
  { id: 'observatorio', scene: 'distrito', x: 22, z: 22, r: 5.5, fx: 18.6, fz: 18.4, icon: '🔭', name: 'Observatorio', clue: 'Una cúpula blanca que mira las estrellas.' },
  { id: 'anfiteatro', scene: 'distrito', x: 14, z: 10, r: 6, fx: 17.8, fz: 10, icon: '🎭', name: 'Anfiteatro', clue: 'Gradas en semicírculo para escuchar y presentar.' },
  { id: 'fuente-paseo', scene: 'comercio', x: 0, z: 0, r: 3.4, fx: 0, fz: 2.6, icon: '🛍️', name: 'Fuente del Paseo comercial', clue: 'Una fuente pequeña entre siete tiendas.' },
  { id: 'jardin', scene: 'distrito', x: -16, z: 16, r: 5.5, fx: -13.8, fz: 16, icon: '🦋', name: 'Jardín de mariposas', clue: 'Flores y alas de colores en la esquina verde del Distrito.' }
]);
const EXPEDITION_LEVELS = ['juvenil', 'general'];

export const FIELD_GAMES = Object.freeze({
  manzanas: { id: 'manzanas', title: 'Manzanas perdidas', scene: 'plaza', npc: { x: 14, z: 8.2, name: 'Doña Rosa' }, pick: 1.3, par: 75, per: 0.6, minSeconds: 15 },
  guardianes: { id: 'guardianes', title: 'Guardianes del parque', scene: 'park', pick: 1.3, bin: 1.4, par: 150, per: 0.3, minSeconds: 25, ranger: { x: -2.5, z: 10.4, name: 'Guardaparques Nico' } },
  expedicion: { id: 'expedicion', title: 'Expedición del conocimiento', scene: 'plaza', par: 420, per: 0.08, minSeconds: 40, finish: { scene: 'plaza', x: 0, z: 0, r: 6.2 } }
});

/** Datos de la partida (los mismos en cliente y servidor para una semilla). */
export function fieldStart(id, seed) {
  const r = rng(seed);
  if (id === 'manzanas') return { apples: shuffle(APPLE_SPOTS, r).slice(0, 7).map(([x, z], i) => ({ id: 'a' + i, x, z })) };
  if (id === 'guardianes') {
    const spots = shuffle(PARK_SPOTS, r), safe = shuffle(TRASH.filter(t => t.type !== 'peligroso'), r).slice(0, 5), bad = shuffle(TRASH.filter(t => t.type === 'peligroso'), r).slice(0, 1);
    return { items: [...safe, ...bad].map((t, i) => ({ id: 'i' + i, kind: t.id, x: spots[i][0], z: spots[i][1] })), plants: shuffle(PLANT_SPOTS, r).slice(0, 2).map(([x, z], i) => ({ id: 'p' + i, x, z })) };
  }
  if (id === 'expedicion') {
    const stamps = shuffle(STAMPS, r).slice(0, 4).map(s => s.id), pool = shuffle(QUESTIONS.filter(q => EXPEDITION_LEVELS.includes(q.level)), r).map(q => q.id);
    return { stamps, questions: Object.fromEntries(stamps.map((s, i) => [s, pool.slice(i * 3, i * 3 + 3)])) };
  }
  return null;
}
export function fieldState(id) {
  if (id === 'manzanas') return { phase: 'hablar', got: [], pen: 0 };
  if (id === 'guardianes') return { carry: null, binned: [], reported: [], watered: [], pen: 0 };
  if (id === 'expedicion') return { got: [], tries: {}, pen: 0 };
  return null;
}

/**
 * Aplica una acción. `where(scene)` devuelve la posición aceptada del jugador en ese escenario (o null).
 * Acciones: manzanas → talk, pick {id}, deliver · guardianes → pick {id}, bin {bin}, report {id}, water {id}
 * · expedicion → stamp {id, choice}, finish. Devuelve { ok, reason?, st, done?, ...datos }.
 */
export function fieldStep(id, data, st, action, where) {
  const g = FIELD_GAMES[id], a = action || {};
  if (id === 'manzanas') {
    const p = where('plaza');
    if (a.type === 'talk') { if (!near(p, g.npc.x, g.npc.z, 2.2)) return { ok: false, reason: 'lejos' }; if (st.phase === 'hablar') st.phase = 'recoger'; return { ok: true, st }; }
    if (st.phase === 'hablar') return { ok: false, reason: 'habla-primero' };
    if (a.type === 'pick') { const ap = data.apples.find(x => x.id === a.id); if (!ap || st.got.includes(ap.id)) return { ok: false, reason: 'no-esta' }; if (!near(p, ap.x, ap.z, g.pick)) return { ok: false, reason: 'lejos' }; st.got.push(ap.id); if (st.got.length === data.apples.length) st.phase = 'entregar'; return { ok: true, st, got: ap.id }; }
    if (a.type === 'slip') { if (st.got.length) { st.got.pop(); st.pen += 3; st.phase = 'recoger'; } return { ok: true, st }; }   // un charco: se cae una manzana (solo te afecta a ti)
    if (a.type === 'deliver') { if (st.phase !== 'entregar') return { ok: false, reason: 'faltan' }; if (!near(p, g.npc.x, g.npc.z, 2.2)) return { ok: false, reason: 'lejos' }; return { ok: true, st, done: true }; }
    return { ok: false, reason: 'accion' };
  }
  if (id === 'guardianes') {
    const p = where('park');
    if (a.type === 'pick') {
      const it = data.items.find(x => x.id === a.id), t = it && TRASH.find(x => x.id === it.kind);
      if (!it || st.binned.includes(it.id) || st.reported.includes(it.id)) return { ok: false, reason: 'no-esta' };
      if (!near(p, it.x, it.z, g.pick)) return { ok: false, reason: 'lejos' };
      if (t.type === 'peligroso') { st.pen += 10; return { ok: false, reason: 'peligroso', why: t.why, st }; }
      if (st.carry) return { ok: false, reason: 'manos-llenas' };
      st.carry = it.id; return { ok: true, st, carry: it.id };
    }
    if (a.type === 'bin') {
      const b = BINS.find(x => x.id === a.bin); if (!b) return { ok: false, reason: 'accion' };
      if (!st.carry) return { ok: false, reason: 'sin-basura' };
      if (!near(p, b.x, b.z, g.bin)) return { ok: false, reason: 'lejos' };
      const it = data.items.find(x => x.id === st.carry), t = TRASH.find(x => x.id === it.kind);
      if (t.type !== b.id) { st.pen += 6; return { ok: false, reason: 'otro-bote', type: t.type, st }; }
      st.binned.push(it.id); st.carry = null;
    } else if (a.type === 'report') {
      const it = data.items.find(x => x.id === a.id), t = it && TRASH.find(x => x.id === it.kind);
      if (!it || st.reported.includes(it.id)) return { ok: false, reason: 'no-esta' };
      if (!near(p, it.x, it.z, 2.4)) return { ok: false, reason: 'lejos' };
      if (t.type !== 'peligroso') { st.pen += 3; return { ok: false, reason: 'no-es-peligroso', st }; }
      st.reported.push(it.id);
    } else if (a.type === 'water') {
      const pl = data.plants.find(x => x.id === a.id); if (!pl || st.watered.includes(pl.id)) return { ok: false, reason: 'no-esta' };
      if (!near(p, pl.x, pl.z, 1.8)) return { ok: false, reason: 'lejos' };
      st.watered.push(pl.id);
    } else return { ok: false, reason: 'accion' };
    const safe = data.items.filter(x => TRASH.find(t => t.id === x.kind).type !== 'peligroso'), bad = data.items.filter(x => !safe.includes(x));
    const done = safe.every(x => st.binned.includes(x.id)) && bad.every(x => st.reported.includes(x.id)) && data.plants.every(x => st.watered.includes(x.id));
    return { ok: true, st, done };
  }
  if (id === 'expedicion') {
    if (a.type === 'stamp') {
      const s = STAMPS.find(x => x.id === a.id); if (!s || !data.stamps.includes(s.id)) return { ok: false, reason: 'no-esta' };
      if (st.got.includes(s.id)) return { ok: false, reason: 'ya-sellado' };
      if (!near(where(s.scene), s.x, s.z, s.r)) return { ok: false, reason: 'lejos' };
      const tries = st.tries[s.id] || 0, q = questionById(data.questions[s.id][Math.min(tries, data.questions[s.id].length - 1)]);
      if (!q || !Number.isInteger(a.choice) || a.choice !== q.answer) { st.tries[s.id] = tries + 1; st.pen += 6; return { ok: false, reason: 'incorrecta', explain: q && q.explain, st }; }
      st.got.push(s.id); return { ok: true, st, stamp: s.id, explain: q.explain };
    }
    if (a.type === 'finish') {
      if (st.got.length < data.stamps.length) return { ok: false, reason: 'faltan' };
      const f = g.finish; if (!near(where(f.scene), f.x, f.z, f.r)) return { ok: false, reason: 'lejos' };
      return { ok: true, st, done: true };
    }
    return { ok: false, reason: 'accion' };
  }
  return { ok: false, reason: 'juego-desconocido' };
}
/** Pregunta que toca en un sello (según los intentos). */
export const stampQuestion = (data, st, id) => { const list = data.questions[id] || []; return questionById(list[Math.min(st.tries[id] || 0, list.length - 1)]); };
/** Puntaje final: 100 menos penalizaciones y tiempo de más (mínimo 40). */
export function fieldScore(id, seconds, st) {
  const g = FIELD_GAMES[id];
  return Math.max(40, Math.min(100, Math.round(100 - st.pen - Math.max(0, seconds - g.par) * g.per)));
}
