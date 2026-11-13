// Ciudad ICADEM 2.0 · catálogo de mascotas (módulo puro, compartido por cliente y servidor).
//
// Cada raza describe su forma con parámetros (tamaño, orejas, hocico, cola, pelaje y patrón): un
// solo modelo procedural por especie dibuja todas las razas, así el catálogo crece sin cargar
// archivos nuevos. Las especies silvestres aparecen SOLO como compañeros fantásticos del juego.
//
// Cómo se obtiene cada una: `free` (gratis desde el inicio), `unlock` (por actividades; nunca se
// compra) o `price` (monedas de Ciudad ICADEM, nunca dinero real). Ninguna da ventaja de juego.
import { levelFromXp } from '../core/store.js';
import { playAchievements } from '../edu/play-rules.js';

export const PET_MAX = 16;          // mascotas por cuenta
export const PET_NAME_MIN = 2, PET_NAME_MAX = 16;

export const SPECIES = Object.freeze({
  perro: { name: 'Perros', icon: '🐕', walk: true, kind: 'quad' },
  gato: { name: 'Gatos', icon: '🐈', walk: false, kind: 'quad' },
  ave: { name: 'Aves', icon: '🦜', walk: false, kind: 'bird' },
  fantastico: { name: 'Compañeros fantásticos', icon: '🐉', walk: false, kind: 'fantasy' }
});

const lvl = p => levelFromXp((p && p.xp) || 0).level;
const ach = p => { try { return playAchievements(p && p.play); } catch (_) { return []; } };
const gamesDone = p => Object.values((p && p.play && p.play.act) || {}).filter(a => a && a.done).length;
const missionsDone = p => Object.values((p && p.missions) || {}).filter(m => m && m.completed).length;
const level = n => ({ text: `Llega al nivel ${n}`, test: p => lvl(p) >= n, progress: p => [Math.min(lvl(p), n), n] });
const games = n => ({ text: `Completa ${n} minijuegos distintos`, test: p => gamesDone(p) >= n, progress: p => [Math.min(gamesDone(p), n), n] });
const missions = n => ({ text: `Completa ${n} misiones profesionales`, test: p => missionsDone(p) >= n, progress: p => [Math.min(missionsDone(p), n), n] });
const quiz = n => ({ text: `Responde bien ${n} retos de los personajes`, test: p => ((p && p.play && p.play.quizCorrect) || 0) >= n, progress: p => [Math.min((p && p.play && p.play.quizCorrect) || 0, n), n] });
const discovered = n => ({ text: `Descubre ${n} sitios de la Ruta del explorador`, test: p => ((p && p.discovered) || []).length >= n, progress: p => [Math.min(((p && p.discovered) || []).length, n), n] });
const achievement = (id, title) => ({ text: `Consigue el logro «${title}»`, test: p => ach(p).includes(id), progress: p => [ach(p).includes(id) ? 1 : 0, 1] });

/**
 * Forma de cada raza:
 *  size (escala), legs (largo de patas), body (largo del cuerpo), ears, snout, tail,
 *  coat [principal, secundario], pattern (solid|spots|saddle|mask|tricolor|tabby|points|socks), fluff (0–1).
 *  personality: cómo se comporta (energía y gustos), solo afecta animaciones.
 */
const B = (id, species, name, shape, how) => Object.freeze({ id, species, name, ...shape, ...how });

export const BREEDS = Object.freeze([
  // ---------- perros ----------
  B('mestizo-canela', 'perro', 'Mestizo canela', { size: 0.95, legs: 1, body: 1, ears: 'drop', snout: 'mid', tail: 'whip', coat: [0xc98a4b, 0xf3dcb8], pattern: 'mask', fluff: 0.2, personality: 'juguetón' }, { free: true }),
  B('mestizo-manchas', 'perro', 'Mestizo de manchas', { size: 0.9, legs: 0.95, body: 1, ears: 'semi', snout: 'mid', tail: 'whip', coat: [0xf4efe6, 0x3b2c24], pattern: 'spots', fluff: 0.15, personality: 'curioso' }, { free: true }),
  B('mestizo-negro', 'perro', 'Mestizo negro', { size: 1, legs: 1.05, body: 1.05, ears: 'erect', snout: 'long', tail: 'plume', coat: [0x262021, 0xb67b45], pattern: 'socks', fluff: 0.3, personality: 'leal' }, { free: true }),
  B('golden', 'perro', 'Golden retriever', { size: 1.15, legs: 1.05, body: 1.1, ears: 'drop', snout: 'long', tail: 'plume', coat: [0xd9a149, 0xe9c27c], pattern: 'solid', fluff: 0.7, personality: 'cariñoso' }, { unlock: level(3) }),
  B('labrador', 'perro', 'Labrador', { size: 1.1, legs: 1, body: 1.1, ears: 'drop', snout: 'long', tail: 'otter', coat: [0x3a2a21, 0x4a372b], pattern: 'solid', fluff: 0.1, personality: 'juguetón' }, { price: 120 }),
  B('husky', 'perro', 'Husky', { size: 1.1, legs: 1.05, body: 1.05, ears: 'erect', snout: 'long', tail: 'curl', coat: [0x5c6470, 0xf2f2f2], pattern: 'mask', fluff: 0.75, personality: 'aventurero', eyes: 0x6fb6ff }, { unlock: games(3) }),
  B('pug', 'perro', 'Pug', { size: 0.7, legs: 0.75, body: 0.85, ears: 'button', snout: 'flat', tail: 'curl', coat: [0xe3c79b, 0x2b2422], pattern: 'mask', fluff: 0.1, personality: 'dormilón' }, { price: 150 }),
  B('chihuahua', 'perro', 'Chihuahua', { size: 0.55, legs: 0.9, body: 0.8, ears: 'bat', snout: 'short', tail: 'whip', coat: [0xd7a46a, 0xf6e3c7], pattern: 'mask', fluff: 0.05, personality: 'valiente' }, { price: 120 }),
  B('corgi', 'perro', 'Corgi', { size: 0.85, legs: 0.55, body: 1.2, ears: 'erect', snout: 'mid', tail: 'stub', coat: [0xd98d3e, 0xffffff], pattern: 'socks', fluff: 0.4, personality: 'alegre' }, { unlock: discovered(6) }),
  B('pastor-aleman', 'perro', 'Pastor alemán', { size: 1.2, legs: 1.1, body: 1.15, ears: 'erect', snout: 'long', tail: 'plume', coat: [0xa86a35, 0x231c19], pattern: 'saddle', fluff: 0.35, personality: 'protector' }, { price: 180 }),
  B('dalmata', 'perro', 'Dálmata', { size: 1.1, legs: 1.15, body: 1.05, ears: 'drop', snout: 'long', tail: 'whip', coat: [0xffffff, 0x1d1b1d], pattern: 'spots', fluff: 0.05, personality: 'enérgico' }, { price: 180 }),
  B('bulldog-frances', 'perro', 'Bulldog francés', { size: 0.75, legs: 0.7, body: 0.9, ears: 'bat', snout: 'flat', tail: 'stub', coat: [0x8c8a8f, 0xf2efe9], pattern: 'mask', fluff: 0.05, personality: 'tranquilo' }, { price: 150 }),
  B('beagle', 'perro', 'Beagle', { size: 0.85, legs: 0.85, body: 1, ears: 'long', snout: 'mid', tail: 'whip', coat: [0xffffff, 0x9a5b2c], pattern: 'tricolor', fluff: 0.1, personality: 'olfateador' }, { unlock: missions(2) }),
  B('poodle', 'perro', 'Poodle', { size: 0.85, legs: 1.05, body: 0.9, ears: 'long', snout: 'long', tail: 'pom', coat: [0xf7f0e8, 0xf7f0e8], pattern: 'solid', fluff: 1, personality: 'elegante' }, { price: 150 }),
  // ---------- gatos ----------
  B('atigrado', 'gato', 'Gato atigrado', { size: 0.6, legs: 1, body: 1, ears: 'cat', snout: 'cat', tail: 'cat', coat: [0x9d7650, 0x4c3626], pattern: 'tabby', fluff: 0.2, personality: 'curioso' }, { free: true }),
  B('gato-negro', 'gato', 'Gato negro', { size: 0.6, legs: 1, body: 1, ears: 'cat', snout: 'cat', tail: 'cat', coat: [0x1e1b20, 0x2a2630], pattern: 'solid', fluff: 0.15, personality: 'misterioso', eyes: 0xf5d547 }, { free: true }),
  B('gato-blanco', 'gato', 'Gato blanco', { size: 0.6, legs: 1, body: 1, ears: 'cat', snout: 'cat', tail: 'cat', coat: [0xf6f4f1, 0xf2c9c4], pattern: 'solid', fluff: 0.3, personality: 'tranquilo', eyes: 0x7dc4ff }, { price: 100 }),
  B('gato-naranja', 'gato', 'Gato naranja', { size: 0.62, legs: 1, body: 1.05, ears: 'cat', snout: 'cat', tail: 'cat', coat: [0xe58a37, 0xf6c88f], pattern: 'tabby', fluff: 0.2, personality: 'glotón' }, { price: 100 }),
  B('tricolor', 'gato', 'Gata tricolor', { size: 0.58, legs: 1, body: 1, ears: 'cat', snout: 'cat', tail: 'cat', coat: [0xffffff, 0xd9853b], pattern: 'tricolor', fluff: 0.2, personality: 'independiente' }, { price: 120 }),
  B('mestizo-gris', 'gato', 'Gato mestizo gris', { size: 0.6, legs: 1, body: 1, ears: 'cat', snout: 'cat', tail: 'cat', coat: [0x8d929b, 0xf1f1f1], pattern: 'socks', fluff: 0.25, personality: 'juguetón' }, { unlock: level(2) }),
  B('siames', 'gato', 'Siamés', { size: 0.6, legs: 1.1, body: 1.05, ears: 'catBig', snout: 'cat', tail: 'cat', coat: [0xf1e3cc, 0x4a3426], pattern: 'points', fluff: 0.05, personality: 'conversador', eyes: 0x5ea8ff }, { unlock: level(4) }),
  B('persa', 'gato', 'Persa', { size: 0.65, legs: 0.8, body: 0.95, ears: 'catSmall', snout: 'flat', tail: 'catFluffy', coat: [0xf3ead9, 0xe0d0b6], pattern: 'solid', fluff: 1, personality: 'dormilón' }, { price: 150 }),
  B('maine-coon', 'gato', 'Maine Coon', { size: 0.8, legs: 1.05, body: 1.15, ears: 'catTufted', snout: 'cat', tail: 'catFluffy', coat: [0x7a5a3e, 0x3b2a1f], pattern: 'tabby', fluff: 0.85, personality: 'gentil' }, { price: 180 }),
  B('bengali', 'gato', 'Bengalí', { size: 0.65, legs: 1.1, body: 1.1, ears: 'cat', snout: 'cat', tail: 'cat', coat: [0xd9a55a, 0x3a2416], pattern: 'spots', fluff: 0.05, personality: 'atlético', eyes: 0x9bd36a }, { price: 200 }),
  B('british', 'gato', 'British Shorthair', { size: 0.7, legs: 0.9, body: 1, ears: 'catSmall', snout: 'cat', tail: 'cat', coat: [0x7f8a9a, 0x7f8a9a], pattern: 'solid', fluff: 0.45, personality: 'sereno', eyes: 0xf0a640 }, { price: 150 }),
  // ---------- aves ----------
  B('perico', 'ave', 'Perico australiano', { size: 0.5, coat: [0x7ccf4a, 0xf6e04a], accent: 0x2b6dd6, beak: 0xf2c46b, crest: false, wings: 1, personality: 'parlanchín' }, { free: true }),
  B('canario', 'ave', 'Canario', { size: 0.45, coat: [0xffd93d, 0xffe98a], accent: 0xf5b72a, beak: 0xf2a96b, crest: false, wings: 0.9, personality: 'cantor' }, { free: true }),
  B('agapornis', 'ave', 'Agapornis', { size: 0.5, coat: [0x48b85a, 0xff7a4d], accent: 0x2f8a66, beak: 0xe24a3b, crest: false, wings: 1, personality: 'cariñoso' }, { price: 100 }),
  B('ninfa', 'ave', 'Ninfa (cacatúa)', { size: 0.55, coat: [0xa7a9ad, 0xf9e46b], accent: 0xff8f6b, beak: 0x8c8f96, crest: true, wings: 1.05, personality: 'silbador' }, { price: 100 }),
  B('guacamaya', 'ave', 'Guacamaya', { size: 0.8, coat: [0xd8302f, 0xf7c934], accent: 0x2f6fd8, beak: 0xefe6d3, crest: false, wings: 1.3, tailLong: true, personality: 'llamativa' }, { unlock: quiz(20) }),
  B('tucan', 'ave', 'Tucán estilizado', { size: 0.7, coat: [0x1c1b20, 0xfff3c2], accent: 0x3ca3d8, beak: 0xff9a1f, bigBeak: true, crest: false, wings: 1.1, personality: 'bromista' }, { price: 220 }),
  B('lechuza', 'ave', 'Lechuza especial', { size: 0.7, coat: [0xd9b98c, 0xfff6e6], accent: 0x8a6440, beak: 0xd8c7a3, owl: true, crest: false, wings: 1.2, personality: 'sabia' }, { unlock: achievement('mente-curiosa', 'Mente curiosa') }),
  B('aguila', 'ave', 'Águila especial', { size: 0.95, coat: [0x5a3b26, 0xf7f3ec], accent: 0x3b2618, beak: 0xf2bf2f, eagle: true, crest: false, wings: 1.5, personality: 'majestuosa' }, { price: 350, unlock: level(6) }),
  // ---------- compañeros fantásticos ----------
  B('dragon-pequeno', 'fantastico', 'Dragoncito', { size: 0.6, form: 'dragon', coat: [0x3fb68b, 0xf7d36b], accent: 0x2a7f8f, wings: 1, glow: 0xffb347, personality: 'travieso' }, { unlock: level(5) }),
  B('dragon-lunar', 'fantastico', 'Dragoncito lunar', { size: 0.6, form: 'dragon', coat: [0x7c6bd6, 0xd9d2ff], accent: 0x4a3fa0, wings: 1, glow: 0x9fd8ff, personality: 'soñador' }, { price: 300 }),
  B('dragon-grande', 'fantastico', 'Gran dragón de viaje', { size: 1.9, form: 'dragon', coat: [0xd9603b, 0xffd27a], accent: 0x8a2f2a, wings: 1.6, glow: 0xffb347, mount: true, personality: 'noble' }, { price: 600, unlock: level(8) }),
  B('zorro-fantastico', 'fantastico', 'Zorro de aurora', { size: 0.75, form: 'fox', coat: [0xf08a3c, 0xffffff], accent: 0x8e6bff, glow: 0xb59bff, tails: 3, personality: 'astuto' }, { unlock: missions(4) }),
  B('lobo-fantastico', 'fantastico', 'Lobo de estrellas', { size: 1.05, form: 'wolf', coat: [0x3d4a6b, 0xd6e2ff], accent: 0x7fd1ff, glow: 0x9fe6ff, personality: 'guardián' }, { unlock: level(7) }),
  B('leon-fantastico', 'fantastico', 'León de luz', { size: 1.1, form: 'lion', coat: [0xe6b45a, 0xb8642f], accent: 0xffe08a, glow: 0xfff0a8, personality: 'valiente' }, { price: 400, unlock: level(7) })
]);
export const breedById = id => BREEDS.find(b => b.id === id) || null;
export const SPECIES_OF = id => (breedById(id) || {}).species || null;

/** ¿Se puede adoptar esta raza con el progreso actual? (el precio se cobra aparte). */
export function breedAvailable(breed, profile) {
  const b = typeof breed === 'string' ? breedById(breed) : breed; if (!b) return false;
  if (b.free) return true;
  if (b.unlock && !b.unlock.test(profile)) return false;
  return Boolean(b.unlock || b.price > 0);
}
export const breedCost = breed => { const b = typeof breed === 'string' ? breedById(breed) : breed; return b && !b.free ? Math.max(0, b.price || 0) : 0; };
export function breedRequirement(breed, profile) {
  const b = typeof breed === 'string' ? breedById(breed) : breed; if (!b) return null;
  if (b.free) return { text: 'Gratis', met: true, progress: [1, 1] };
  if (!b.unlock) return { text: `${b.price} monedas`, met: true, progress: [1, 1] };
  let progress = [0, 1]; try { progress = b.unlock.progress(profile); } catch (_) {}
  return { text: b.unlock.text + (b.price ? ` · ${b.price} monedas` : ''), met: b.unlock.test(profile), progress };
}

/**
 * Ranuras de accesorios y qué especies las usan. Un accesorio comprado sirve para todas las
 * mascotas compatibles de la cuenta (no se gasta). La correa solo se usa con perros (paseo).
 */
export const PET_SLOTS = Object.freeze({
  collar: { name: 'Collar', species: ['perro', 'gato', 'fantastico'] },
  harness: { name: 'Arnés', species: ['perro'] },
  leash: { name: 'Correa', species: ['perro'] },
  tag: { name: 'Placa', species: ['perro', 'gato'] },
  scarf: { name: 'Pañuelo', species: ['perro', 'gato', 'fantastico'] },
  outfit: { name: 'Ropa ligera', species: ['perro', 'gato'] },
  hat: { name: 'Festivo', species: ['perro', 'gato', 'ave', 'fantastico'] }
});
/** Formas de los fantásticos que pueden usar cada ranura (los dragones no usan pañuelo). */
export const FANTASY_SLOTS = Object.freeze({ dragon: ['collar', 'hat'], fox: ['collar', 'scarf', 'hat'], wolf: ['collar', 'scarf', 'hat'], lion: ['collar', 'scarf', 'hat'] });
export function slotFits(slot, breed) {
  const b = typeof breed === 'string' ? breedById(breed) : breed; const s = PET_SLOTS[slot];
  if (!b || !s || !s.species.includes(b.species)) return false;
  return b.species !== 'fantastico' || (FANTASY_SLOTS[b.form] || []).includes(slot);
}

/** Escenarios donde una mascota puede acompañar al jugador. En los demás espera en casa. */
export const PET_SCENES = Object.freeze(['room', 'casa', 'plaza', 'park', 'distrito', 'vet']);
/** Escenarios con paseo con correa (calles y parques). */
export const WALK_SCENES = Object.freeze(['plaza', 'park', 'distrito']);

/** Nombre de mascota: letras, números y espacios; 2 a 16 caracteres. El filtro de palabras lo aplica vivo-rules. */
export function shapePetName(raw) {
  const s = String(raw == null ? '' : raw).normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
  return s.length >= PET_NAME_MIN && s.length <= PET_NAME_MAX ? s : '';
}
