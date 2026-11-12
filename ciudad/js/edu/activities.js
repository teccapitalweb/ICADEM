// Ciudad ICADEM · minijuegos rápidos (módulo puro: contenido, generación y calificación).
// Cada partida se genera con una semilla; el servidor vuelve a generarla con la misma semilla y
// reproduce lo que hizo el jugador. Así la respuesta correcta la determina el servidor y el
// navegador no puede «decir» que ganó. Carrera y Búsqueda del tesoro se validan además con las
// posiciones que el servidor ya comprueba (ver POSITIONAL).

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, r) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (list, n, r) => shuffle(list, r).slice(0, n);
export const validSeed = s => Number.isInteger(s) && s >= 0 && s <= 0xFFFFFFFF;

/* ---------------- B · Memoria ICADEM ---------------- */
export const MEMORY_PAIRS = Object.freeze([
  ['🩺', 'Estetoscopio', 'Medicina'], ['⚖️', 'Balanza', 'Juez'], ['🌱', 'Semilla', 'Agronomía'], ['⛑️', 'Casco', 'Construcción'],
  ['🍳', 'Sartén', 'Gastronomía'], ['🐾', 'Huella', 'Veterinaria'], ['🧮', 'Ábaco', 'Contaduría'], ['💻', 'Laptop', 'Programación'],
  ['🔬', 'Microscopio', 'Ciencia'], ['📚', 'Libros', 'Docencia'], ['🚒', 'Camión de bomberos', 'Protección civil'], ['✈️', 'Avión', 'Aviación']
]);
const MEMORY_LEVELS = { facil: 4, medio: 6, dificil: 8 };
const memory = {
  id: 'memoria', title: 'Memoria ICADEM', levels: Object.keys(MEMORY_LEVELS),
  build(seed, level) {
    const r = rng(seed), pairs = pick(MEMORY_PAIRS.map((p, i) => i), MEMORY_LEVELS[level], r);
    const cards = shuffle(pairs.flatMap(p => [{ pair: p, side: 0 }, { pair: p, side: 1 }]), r);
    return { pairs: pairs.length, cards: cards.map(c => ({ ...c, icon: MEMORY_PAIRS[c.pair][0], label: c.side ? MEMORY_PAIRS[c.pair][2] : MEMORY_PAIRS[c.pair][1] })) };
  },
  /** log: índices de cartas volteadas, de dos en dos. */
  play(content, log) {
    if (!Array.isArray(log) || log.length % 2 || log.length > 160) return { valid: false };
    const matched = new Set(); let turns = 0;
    for (let i = 0; i < log.length; i += 2) {
      const a = log[i], b = log[i + 1];
      if (![a, b].every(x => Number.isInteger(x) && x >= 0 && x < content.cards.length) || a === b || matched.has(a) || matched.has(b)) return { valid: false };
      turns++;
      if (content.cards[a].pair === content.cards[b].pair) { matched.add(a); matched.add(b); }
    }
    if (matched.size !== content.cards.length) return { valid: false };
    const extra = turns - content.pairs;
    return { valid: true, score: Math.max(40, 100 - Math.max(0, extra - Math.floor(content.pairs / 2)) * 6), turns };
  }
};

/* ---------------- C · Matemáticas contra reloj ---------------- */
const MATH_LEVELS = ['infantil', 'juvenil', 'general'];
function mathProblem(level, r, i) {
  const n = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  if (level === 'infantil') { if (r() < 0.5 || i < 3) { const a = n(1, 10 + i), b = n(1, 9); return { text: `${a} + ${b}`, value: a + b }; } const a = n(6, 20), b = n(1, a); return { text: `${a} − ${b}`, value: a - b }; }
  if (level === 'juvenil') { if (r() < 0.6) { const a = n(2, i < 5 ? 6 : 10), b = n(2, 10); return { text: `${a} × ${b}`, value: a * b }; } const b = n(2, 9), v = n(2, 10); return { text: `${b * v} ÷ ${b}`, value: v }; }
  const kind = r();
  if (kind < 0.4) { const pct = [10, 20, 25, 50][n(0, 3)], base = pct === 25 ? n(2, 20) * 4 : n(2, 30) * 10; return { text: `${pct} % de ${base}`, value: base * pct / 100 }; }
  if (kind < 0.75) { const a = n(3, 12), b = n(3, 12), c = n(2, 30); return { text: `${a} × ${b} + ${c}`, value: a * b + c }; }
  const a = n(20, 99), b = n(11, 60); return { text: `${a} + ${b} − ${Math.min(a, 15)}`, value: a + b - Math.min(a, 15) };
}
const math = {
  id: 'matematicas', title: 'Matemáticas contra reloj', levels: MATH_LEVELS, rounds: 10,
  build(seed, level) {
    const r = rng(seed);
    return { problems: Array.from({ length: 10 }, (_, i) => {
      const p = mathProblem(level, r, i), set = new Set([p.value]);
      for (const d of shuffle([1, -1, 2, -2, 10, -10, 5], r)) { if (set.size >= 4) break; if (p.value + d >= 0) set.add(p.value + d); }
      return { text: p.text, options: shuffle([...set], r) };
    }) };
  },
  solve(seed, level) { const r = rng(seed); return Array.from({ length: 10 }, (_, i) => { const p = mathProblem(level, r, i); const set = new Set([p.value]); for (const d of shuffle([1, -1, 2, -2, 10, -10, 5], r)) { if (set.size >= 4) break; if (p.value + d >= 0) set.add(p.value + d); } shuffle([...set], r); return p.value; }); },
  /** log: el valor elegido en cada una de las 10 operaciones, en orden. */
  play(content, log, seed, level) {
    if (!Array.isArray(log) || log.length !== 10) return { valid: false };
    const right = math.solve(seed, level);
    if (!log.every((v, i) => content.problems[i].options.includes(v))) return { valid: false };
    const correct = log.filter((v, i) => v === right[i]).length;
    return { valid: true, score: correct * 10, correct };
  }
};

/* ---------------- D · Aventura de idiomas ---------------- */
export const VOCAB = Object.freeze([
  { emoji: '🐶', es: 'perro', en: 'dog', level: 'infantil' }, { emoji: '🐱', es: 'gato', en: 'cat', level: 'infantil' }, { emoji: '🍎', es: 'manzana', en: 'apple', level: 'infantil' },
  { emoji: '🏠', es: 'casa', en: 'house', level: 'infantil' }, { emoji: '☀️', es: 'sol', en: 'sun', level: 'infantil' }, { emoji: '📖', es: 'libro', en: 'book', level: 'infantil' },
  { emoji: '🚗', es: 'coche', en: 'car', level: 'infantil' }, { emoji: '🌳', es: 'árbol', en: 'tree', level: 'infantil' }, { emoji: '🐟', es: 'pez', en: 'fish', level: 'infantil' },
  { emoji: '🥛', es: 'leche', en: 'milk', level: 'infantil' }, { emoji: '🏥', es: 'hospital', en: 'hospital', level: 'general' }, { emoji: '🏦', es: 'banco', en: 'bank', level: 'general' },
  { emoji: '🍽️', es: 'restaurante', en: 'restaurant', level: 'general' }, { emoji: '📚', es: 'biblioteca', en: 'library', level: 'general' }, { emoji: '🌧️', es: 'lluvia', en: 'rain', level: 'general' },
  { emoji: '🧑‍🏫', es: 'maestra', en: 'teacher', level: 'general' }, { emoji: '🔑', es: 'llave', en: 'key', level: 'general' }, { emoji: '⏰', es: 'reloj', en: 'clock', level: 'general' }
]);
export const PHRASES_I18N = Object.freeze([
  { text: 'Good morning', es: 'Buenos días', lang: 'inglés' }, { text: 'Thank you', es: 'Gracias', lang: 'inglés' }, { text: 'See you later', es: 'Hasta luego', lang: 'inglés' },
  { text: 'Bonjour', es: 'Buenos días', lang: 'francés' }, { text: 'Merci', es: 'Gracias', lang: 'francés' }, { text: 'Obrigado', es: 'Gracias', lang: 'portugués' },
  { text: 'Por favor → Please', es: 'Por favor', lang: 'inglés' }, { text: 'Ciao', es: 'Hola / adiós', lang: 'italiano' }
]);
const LANG_LEVELS = ['infantil', 'general'];
const languages = {
  id: 'idiomas', title: 'Aventura de idiomas', levels: LANG_LEVELS, rounds: 8,
  build(seed, level) {
    const r = rng(seed), pool = VOCAB.filter(v => level === 'general' || v.level === 'infantil');
    const words = pick(pool, level === 'general' ? 6 : 8, r), rounds = [];
    words.forEach((w, i) => {
      const others = pick(pool.filter(x => x !== w), 2, r);
      if (i % 2 === 0) rounds.push({ kind: 'imagen', prompt: w.emoji, hint: '¿Cómo se dice en inglés?', options: shuffle([w.en, ...others.map(o => o.en)], r), answer: w.en });
      else rounds.push({ kind: 'significado', prompt: w.en, hint: '¿Qué significa?', options: shuffle([w.es, ...others.map(o => o.es)], r), answer: w.es, emoji: w.emoji });
    });
    if (level === 'general') for (const ph of pick(PHRASES_I18N.filter(p => !p.text.includes('→')), 2, r)) {
      const wrong = pick([...new Set(PHRASES_I18N.map(x => x.es))].filter(x => x !== ph.es), 2, r);
      rounds.push({ kind: 'frase', prompt: ph.text, hint: `Expresión en ${ph.lang}. ¿Qué significa?`, options: shuffle([ph.es, ...wrong], r), answer: ph.es });
    }
    return { rounds };
  },
  play(content, log) {
    if (!Array.isArray(log) || log.length !== content.rounds.length) return { valid: false };
    if (!log.every((v, i) => content.rounds[i].options.includes(v))) return { valid: false };
    const correct = log.filter((v, i) => v === content.rounds[i].answer).length;
    return { valid: true, score: Math.round(correct / content.rounds.length * 100), correct };
  }
};

/* ---------------- F · Clasificación inteligente ---------------- */
export const SORT_THEMES = Object.freeze({
  reciclaje: { title: 'Reciclaje', bins: [['organico', '🍂 Orgánico'], ['reciclable', '♻️ Reciclable'], ['sanitario', '🚫 No reciclable']],
    items: [['🍌 Cáscara de plátano', 'organico'], ['🥚 Cascarón de huevo', 'organico'], ['🍂 Hojas secas', 'organico'], ['☕ Restos de café', 'organico'],
      ['🧴 Botella de plástico limpia', 'reciclable'], ['📰 Periódico', 'reciclable'], ['🥫 Lata de aluminio', 'reciclable'], ['📦 Caja de cartón', 'reciclable'],
      ['🧻 Servilleta usada', 'sanitario'], ['🩹 Curita usada', 'sanitario'], ['🍬 Envoltura metalizada de dulce', 'sanitario']] },
  alimentos: { title: 'Alimentos', bins: [['frutas', '🥕 Frutas y verduras'], ['cereales', '🌾 Cereales'], ['leguminosas', '🫘 Leguminosas'], ['animal', '🥚 Origen animal']],
    items: [['🍎 Manzana', 'frutas'], ['🥦 Brócoli', 'frutas'], ['🥕 Zanahoria', 'frutas'], ['🌽 Tortilla de maíz', 'cereales'], ['🍚 Arroz', 'cereales'], ['🍞 Pan integral', 'cereales'],
      ['🫘 Frijoles', 'leguminosas'], ['🟤 Lentejas', 'leguminosas'], ['🟡 Garbanzos', 'leguminosas'], ['🥛 Leche', 'animal'], ['🍳 Huevo', 'animal'], ['🐟 Pescado', 'animal']] },
  animales: { title: 'Animales', bins: [['mamifero', '🐄 Mamífero'], ['ave', '🐦 Ave'], ['reptil', '🦎 Reptil'], ['pez', '🐟 Pez']],
    items: [['🐬 Delfín', 'mamifero'], ['🦇 Murciélago', 'mamifero'], ['🐄 Vaca', 'mamifero'], ['🦉 Búho', 'ave'], ['🐧 Pingüino', 'ave'], ['🦜 Guacamaya', 'ave'],
      ['🐢 Tortuga', 'reptil'], ['🐊 Cocodrilo', 'reptil'], ['🦎 Iguana', 'reptil'], ['🦈 Tiburón', 'pez'], ['🐠 Pez payaso', 'pez'], ['🐡 Pez globo', 'pez']] },
  herramientas: { title: 'Herramientas y profesiones', bins: [['salud', '🩺 Salud'], ['obra', '⛑️ Construcción'], ['cocina', '🍳 Cocina']],
    items: [['🩺 Estetoscopio', 'salud'], ['🌡️ Termómetro clínico', 'salud'], ['💉 Jeringa', 'salud'], ['🔨 Martillo', 'obra'], ['📏 Flexómetro', 'obra'], ['⛑️ Casco', 'obra'], ['🪣 Cubeta de mezcla', 'obra'],
      ['🔪 Cuchillo de chef', 'cocina'], ['🥄 Cucharón', 'cocina'], ['🍳 Sartén', 'cocina']] }
});
const sorting = {
  id: 'clasificacion', title: 'Clasificación inteligente', levels: Object.keys(SORT_THEMES), rounds: 8,
  build(seed, level) {
    const r = rng(seed), theme = SORT_THEMES[level];
    return { theme: level, title: theme.title, bins: theme.bins, items: pick(theme.items.map(([label, bin], i) => ({ id: i, label, bin })), 8, r).map(({ id, label }) => ({ id, label })) };
  },
  /** log: [{ id, bin }] — cada objeto se coloca una vez. */
  play(content, log, seed, level) {
    if (!Array.isArray(log) || log.length !== content.items.length) return { valid: false };
    const theme = SORT_THEMES[level], ids = new Set(content.items.map(i => i.id)), seen = new Set();
    for (const e of log) if (!e || !ids.has(e.id) || seen.has(e.id) || !theme.bins.some(([b]) => b === e.bin)) return { valid: false }; else seen.add(e.id);
    const correct = log.filter(e => theme.items[e.id][1] === e.bin).length;
    return { valid: true, score: Math.round(correct / content.items.length * 100), correct };
  }
};

export const ACTIVITIES = Object.freeze({ memoria: memory, matematicas: math, idiomas: languages, clasificacion: sorting });

/** Validación completa de una partida (la usa el servidor): semilla, nivel y bitácora. */
export function checkActivity(id, seed, level, log) {
  const a = ACTIVITIES[id];
  if (!a || !validSeed(seed) || !a.levels.includes(level)) return { valid: false };
  return a.play(a.build(seed, level), log, seed, level);
}

/* ---------------- A · Carrera y E · Búsqueda del tesoro (validadas por posición) ---------------- */
/** Puntos de control del circuito del Parque de retos (escena `park`), en orden. */
/** [x, z, altura mínima]: los que van sobre plataforma exigen estar arriba (el servidor ve la altura). */
export const RACE = Object.freeze({ scene: 'park', radius: 2.4, minSeconds: 12, checkpoints: [[0, 8, 0], [-6, 3, 0.9], [-7, -4, 0], [0, -8.5, 1.5], [7, -4, 0], [6, 3.4, 1.2], [0, 0, 0.4]] });

/** Tesoros en la plaza: cada uno junto a un edificio, con una pista de su profesión. */
export const TREASURES = Object.freeze([
  { id: 'estetoscopio', icon: '🩺', name: 'Estetoscopio', clue: 'Búscalo donde atienden a los pacientes.', at: [-27.5, -19.5] },
  { id: 'mazo', icon: '⚖️', name: 'Mazo de juez', clue: 'Cerca de donde se dictan sentencias.', at: [17.5, -19.0] },
  { id: 'calculadora', icon: '🧮', name: 'Calculadora', clue: 'Junto al lugar donde se piden créditos.', at: [-8.5, -19.0] },
  { id: 'huella', icon: '🐾', name: 'Collar de mascota', clue: 'Cerca de la clínica de los animales.', at: [-27.5, 19.5] },
  { id: 'cucharon', icon: '🥄', name: 'Cucharón', clue: 'Donde huele a comida recién hecha.', at: [17.5, 19.5] },
  { id: 'semilla', icon: '🌱', name: 'Bolsa de semillas', clue: 'Donde crecen los jitomates bajo cristal.', at: [-24.5, -12.5] },
  { id: 'casco', icon: '⛑️', name: 'Casco de obra', clue: 'Donde se construye algo nuevo.', at: [24.5, -12.5] },
  { id: 'carpeta', icon: '📁', name: 'Carpeta perdida', clue: 'Cerca de los archiveros de la oficina.', at: [-24.5, 12.5] },
  { id: 'carrito', icon: '🛒', name: 'Ticket de compra', clue: 'Junto al lugar de los anaqueles.', at: [26.5, 17.0] },
  { id: 'llave', icon: '🔑', name: 'Llave de la torre', clue: 'Al pie del edificio más alto.', at: [26.5, -17.0] }
]);
export const TREASURE_RADIUS = 2.2;
/** Rondas de dificultad creciente: 2, 3 y 5 tesoros distintos (elegidos con la semilla). */
export function treasureRounds(seed) {
  const r = rng(seed), all = shuffle(TREASURES.map(t => t.id), r);
  return [all.slice(0, 2), all.slice(2, 5), all.slice(5, 10)];
}
