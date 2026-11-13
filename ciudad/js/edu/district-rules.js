// Ciudad ICADEM · Distrito del Saber (módulo puro, compartido por el cliente y el servidor).
//
//   · MAZE: el Laberinto del conocimiento. Plano fijo con tres puertas que se abren respondiendo bien.
//     El servidor valida el recorrido con las posiciones que ya comprueba (puertas en orden y salida).
//   · LANDMARKS: la Ruta del explorador. Sitios repartidos por la ciudad; el servidor confirma que la
//     persona está ahí antes de darle la XP (una sola vez por sitio).
//   · LAB y ESCAPE: Laboratorio de experimentos y Sala de escape. Se generan con semilla y el servidor
//     vuelve a generarlos para calificar la bitácora (el navegador no puede decir que ganó).
// Nada de esto da créditos: solo XP del juego con los topes diarios de siempre.

/** Generador pseudoaleatorio con semilla (mulberry32, igual que en activities.js). */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, r) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------------- Laberinto del conocimiento ---------------- */
// '#' seto · '.' camino · 'S' entrada · 'E' salida · '1' '2' '3' puertas del saber (en ese orden).
// Comprobado: sin abrir las tres puertas en orden no se alcanza la salida (test/ciudad-distrito).
const MAZE_GRID = Object.freeze([
  '#####S#####',
  '#.#.....#.#',
  '#...#.#...#',
  '#########1#',
  '#.........#',
  '#2#########',
  '#...#.....#',
  '#.#...#.#.#',
  '#######3###',
  '#...#.....#',
  '#####E#####'
]);
const MAZE_CELL = 2.2, MAZE_CENTER = [-16, -13];
/** Centro (x, z) de la celda (columna i, fila j). La fila 0 es la orilla norte (hacia el anfiteatro). */
export const mazeCell = (i, j) => [MAZE_CENTER[0] + (i - 5) * MAZE_CELL, MAZE_CENTER[1] - (j - 5) * MAZE_CELL];
const cellOf = ch => { for (let j = 0; j < MAZE_GRID.length; j++) { const i = MAZE_GRID[j].indexOf(ch); if (i >= 0) return [i, j]; } return null; };
export const MAZE = Object.freeze({
  scene: 'distrito', grid: MAZE_GRID, cell: MAZE_CELL, center: MAZE_CENTER, radius: 1.5, minSeconds: 25,
  /** Puntuación por tiempo: 100 hasta `par` segundos y luego baja `per` por segundo (mínimo 50). */
  par: 75, per: 0.8,
  start: mazeCell(...cellOf('S')),
  /** Puntos que valida el servidor, en orden: las tres puertas y la salida. [x, z, altura mínima] */
  checkpoints: Object.freeze(['1', '2', '3', 'E'].map(ch => [...mazeCell(...cellOf(ch)), 0]))
});

/* ---------------- Ruta del explorador ---------------- */
export const DISCOVER_XP = 15;
export const LANDMARKS = Object.freeze([
  { id: 'fuente', scene: 'plaza', at: [0, 0], r: 6.2, icon: '⛲', name: 'Fuente de la plaza', hint: 'El corazón de la ciudad.' },
  { id: 'kiosco', scene: 'plaza', at: [35, 9], r: 5.5, icon: '🎪', name: 'Kiosco del Parque del Saber', hint: 'Junto a la Obra, bajo un techo rojo.' },
  { id: 'podio', scene: 'park', at: [0, 0], r: 3.2, icon: '🏁', name: 'Meta del Parque de retos', hint: 'En medio del circuito de obstáculos.' },
  { id: 'anfiteatro', scene: 'distrito', at: [0, 8], r: 6, icon: '🎭', name: 'Anfiteatro del Encuentro', hint: 'Donde la comunidad se reúne en el Distrito del Saber.' },
  { id: 'jardin', scene: 'distrito', at: [-17, 17], r: 5.5, icon: '🦋', name: 'Jardín de mariposas', hint: 'Entre flores, en la esquina verde del distrito.' },
  { id: 'observatorio', scene: 'distrito', at: [17, 17], r: 5.5, icon: '🔭', name: 'Observatorio', hint: 'Una cúpula blanca que mira al cielo.' },
  { id: 'laboratorio', scene: 'distrito', at: [11.5, -4], r: 4, icon: '🧪', name: 'Laboratorio de ciencias', hint: 'Edificio de los experimentos.' },
  { id: 'meta-laberinto', scene: 'distrito', at: MAZE.checkpoints[3].slice(0, 2), r: 2.4, icon: '🌿', name: 'Salida del laberinto', hint: 'Al otro lado de las tres puertas del saber.' }
]);
export const landmarkById = id => LANDMARKS.find(l => l.id === id) || null;

/* ---------------- Laboratorio de experimentos ---------------- */
// Cada experimento: el jugador prepara o predice y luego ve el resultado (animado en la interfaz).
// [tipo, montaje, opciones, índice correcto, explicación]
const EXPERIMENTS = Object.freeze([
  ['densidad', 'Un corcho en un vaso con agua', ['Flota', 'Se hunde'], 0, 'El corcho es menos denso que el agua.'],
  ['densidad', 'Una piedra en un vaso con agua', ['Flota', 'Se hunde'], 1, 'La piedra es más densa que el agua.'],
  ['densidad', 'Un huevo en agua con mucha sal', ['Flota', 'Se hunde'], 0, 'La sal hace el agua más densa que el huevo.'],
  ['densidad', 'Un cubo de hielo en agua', ['Flota', 'Se hunde'], 0, 'El agua congelada ocupa más espacio: es menos densa.'],
  ['densidad', 'Un clavo de hierro en agua', ['Flota', 'Se hunde'], 1, 'El hierro es mucho más denso que el agua.'],
  ['circuito', 'Pila, cables y foco conectados en círculo cerrado', ['Enciende', 'No enciende'], 0, 'Con el circuito cerrado la corriente puede circular.'],
  ['circuito', 'Pila y foco con un cable suelto', ['Enciende', 'No enciende'], 1, 'Un circuito abierto no deja pasar la corriente.'],
  ['circuito', 'Circuito cerrado con un palito de madera en medio', ['Enciende', 'No enciende'], 1, 'La madera es aislante.'],
  ['circuito', 'Circuito cerrado con un clip de metal en medio', ['Enciende', 'No enciende'], 0, 'El metal es conductor.'],
  ['ph', 'Jugo de limón con indicador de col morada', ['Rojo o rosa (ácido)', 'Morado (neutro)', 'Verde (básico)'], 0, 'El limón es ácido.'],
  ['ph', 'Agua de la llave con indicador de col morada', ['Rojo o rosa (ácido)', 'Morado (neutro)', 'Verde (básico)'], 1, 'El agua es casi neutra.'],
  ['ph', 'Bicarbonato disuelto con indicador de col morada', ['Rojo o rosa (ácido)', 'Morado (neutro)', 'Verde (básico)'], 2, 'El bicarbonato es una base.'],
  ['ph', 'Vinagre con indicador de col morada', ['Rojo o rosa (ácido)', 'Morado (neutro)', 'Verde (básico)'], 0, 'El vinagre contiene ácido acético.'],
  ['estado', 'Agua calentada hasta 100 °C al nivel del mar', ['Se congela', 'Hierve y se vuelve vapor', 'No cambia'], 1, 'A 100 °C el agua hierve.'],
  ['estado', 'Agua en el congelador a −5 °C', ['Se congela', 'Hierve y se vuelve vapor', 'No cambia'], 0, 'Bajo 0 °C el agua se vuelve hielo.'],
  ['estado', 'Chocolate al sol de mediodía', ['Se derrite', 'Se congela', 'Se evapora'], 0, 'El calor funde la grasa del chocolate.'],
  ['color', 'Pintura azul + pintura amarilla', ['Verde', 'Naranja', 'Morado'], 0, 'Azul y amarillo forman verde.'],
  ['color', 'Pintura roja + pintura amarilla', ['Verde', 'Naranja', 'Morado'], 1, 'Rojo y amarillo forman naranja.'],
  ['color', 'Pintura roja + pintura azul', ['Verde', 'Naranja', 'Morado'], 2, 'Rojo y azul forman morado.'],
  ['iman', 'Un imán junto a un clavo de hierro', ['Lo atrae', 'No lo atrae'], 0, 'El hierro es magnético.'],
  ['iman', 'Un imán junto a una hoja de papel', ['Lo atrae', 'No lo atrae'], 1, 'El papel no es magnético.'],
  ['iman', 'Un imán junto a un vaso de vidrio', ['Lo atrae', 'No lo atrae'], 1, 'El vidrio no es magnético.'],
  ['iman', 'Un imán junto a unas tijeras de acero', ['Lo atrae', 'No lo atrae'], 0, 'El acero contiene hierro.']
]);
const LAB_LEVELS = { basico: 5, avanzado: 8 };
const lab = {
  id: 'laboratorio', title: 'Laboratorio de experimentos', levels: Object.keys(LAB_LEVELS),
  build(seed, level) {
    const r = rng(seed), n = LAB_LEVELS[level];
    // Variedad: primero un experimento de cada tipo, luego el resto al azar.
    const order = shuffle(EXPERIMENTS.map((_, i) => i), r), kinds = new Set(), first = [], rest = [];
    for (const i of order) (kinds.has(EXPERIMENTS[i][0]) ? rest : (kinds.add(EXPERIMENTS[i][0]), first)).push(i);
    const items = [...first, ...rest].slice(0, n).map(i => { const [kind, setup, options] = EXPERIMENTS[i]; return { id: i, kind, setup, options }; });
    return { items };
  },
  /** log: índice elegido en cada experimento, en orden. */
  play(content, log) {
    if (!Array.isArray(log) || log.length !== content.items.length) return { valid: false };
    let correct = 0;
    for (let k = 0; k < log.length; k++) { const e = EXPERIMENTS[content.items[k].id], v = log[k]; if (!Number.isInteger(v) || v < 0 || v >= e[2].length) return { valid: false }; if (v === e[3]) correct++; }
    return { valid: true, score: Math.round(correct / log.length * 100), correct };
  }
};
/** Resultado de un experimento (para la animación y la explicación en la interfaz). */
export const experimentAnswer = id => EXPERIMENTS[id] ? { answer: EXPERIMENTS[id][3], explain: EXPERIMENTS[id][4] } : null;

/* ---------------- Sala de escape ---------------- */
// Tres candados. Cada uno tiene una pista que se resuelve con lógica o cálculo y da un código numérico.
function escapePuzzle(type, r) {
  const n = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  if (type === 'patas') {
    const a = n(2, 5), b = n(2, 6), c = n(1, 4);
    return { title: 'El acuario y el corral', clue: `En el laboratorio viven ${a} arañas, ${b} gatos y ${c} ${c === 1 ? 'gallina' : 'gallinas'}. El código es el total de patas.`, hint: 'Araña: 8 patas · gato: 4 · gallina: 2.', code: String(a * 8 + b * 4 + c * 2) };
  }
  if (type === 'serie') {
    const kind = n(0, 2), s = n(2, 5), d = n(3, 9);
    const seq = kind === 0 ? [0, 1, 2, 3, 4].map(k => s + k * d) : kind === 1 ? [0, 1, 2, 3, 4].map(k => s * 2 ** k) : [0, 1, 2, 3, 4].map(k => s + k * k);
    const next = kind === 0 ? s + 5 * d : kind === 1 ? s * 32 : s + 25;
    return { title: 'La pizarra', clue: `Alguien dejó una serie en la pizarra: ${seq.join(', ')}, … El código es el número que sigue.`, hint: kind === 0 ? 'Fíjate cuánto aumenta cada vez.' : kind === 1 ? 'Cada número es el doble del anterior.' : 'Las diferencias crecen de 2 en 2.', code: String(next) };
  }
  if (type === 'reloj') {
    const h = n(8, 15), m = [0, 10, 15, 20, 30, 40, 45][n(0, 6)], dur = [25, 35, 40, 50, 55, 70, 85][n(0, 6)];
    const end = h * 60 + m + dur, hh = Math.floor(end / 60), mm = end % 60;
    return { title: 'El reloj de la sala', clue: `La junta empezó a las ${h}:${String(m).padStart(2, '0')} y duró ${dur} minutos. El código es la hora en que terminó (formato 24 h, sin los dos puntos).`, hint: 'Suma los minutos; cada 60 minutos es una hora más.', code: `${hh}${String(mm).padStart(2, '0')}` };
  }
  if (type === 'area') {
    const w = n(3, 12), l = n(4, 15);
    return { title: 'El plano del piso', clue: `El salón mide ${w} m de ancho por ${l} m de largo. El código es su área en metros cuadrados.`, hint: 'Área = ancho × largo.', code: String(w * l) };
  }
  // letras: A=1, B=2…; el código es la suma de las letras de una palabra corta
  const words = ['SOL', 'MAR', 'LUZ', 'PAN', 'RED', 'OLA', 'FARO', 'RIO'], w = words[n(0, words.length - 1)];
  const sum = [...w].reduce((s, ch) => s + (ch.charCodeAt(0) - 64), 0);
  return { title: 'El abecedario', clue: `Cada letra vale su lugar en el alfabeto (A = 1, B = 2, …, sin la Ñ). El código es la suma de las letras de «${w}».`, hint: `${[...w].join(' + ')} → busca el número de cada letra.`, code: String(sum) };
}
const ESCAPE_TYPES = ['patas', 'serie', 'reloj', 'area', 'letras'];
const escape = {
  id: 'escape', title: 'Sala de escape', levels: ['normal'],
  build(seed) {
    const r = rng(seed), types = shuffle(ESCAPE_TYPES, r).slice(0, 3);
    return { locks: types.map(t => escapePuzzle(t, r)) };
  },
  /**
   * log: intentos en orden: { lock, code } o { lock, hint: true }. Los candados se abren en orden;
   * cada intento equivocado resta 10 y cada pista 8 (mínimo 40). Hay que abrir los tres.
   */
  play(content, log) {
    if (!Array.isArray(log) || log.length > 60) return { valid: false };
    let lock = 0, wrong = 0, hints = 0;
    for (const e of log) {
      if (!e || e.lock !== lock || lock >= content.locks.length) return { valid: false };
      if (e.hint === true) { hints++; continue; }
      const code = String(e.code ?? '').replace(/\D/g, '').slice(0, 6);
      if (code === content.locks[lock].code) lock++; else wrong++;
    }
    if (lock !== content.locks.length) return { valid: false };
    return { valid: true, score: Math.max(40, 100 - wrong * 10 - hints * 8), wrong, hints };
  }
};

export const DISTRICT_ACTIVITIES = Object.freeze({ laboratorio: lab, escape });
