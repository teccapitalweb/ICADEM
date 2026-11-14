// Reglas del progreso del jugador, compartidas por el cliente y el servidor (módulo puro).
// El servidor es quien las aplica de verdad; el cliente solo las usa para mostrar qué falta.
import { LANDMARKS } from '../edu/district-rules.js';
import { levelFromXp } from '../core/store.js';
import { emptyPlay, playAchievements } from '../edu/play-rules.js';
import { HAT_OPTIONS, HAT_ACCESSORIES, COSMETIC_OPTIONS, HAIR_COLORS } from './appearance-catalog.js';
import { emptyVivo } from '../vivo/vivo-rules.js';
export * from './appearance-catalog.js';

export const PROFILE_VERSION = 1;
export const VISIT_XP = 10, TUTORIAL_XP = 40, TUTORIAL_CREDITS = 10;
export const BUILDING_IDS = Object.freeze(['banco', 'tribunal', 'hospital', 'torre', 'veterinaria', 'casa', 'restaurante', 'supermercado', 'invernadero', 'oficina', 'obra']);
export const MISSION_BANK = 'banco-credito-correcto', MISSION_COURT = 'tribunal-tu-eres-el-juez';

/** Colores de equipamiento (playera/saco). Solo estética: ninguno da ventaja. */
export const OUTFIT_COLORS = Object.freeze([
  { id: 'base', name: 'Original', color: null }, { id: 'coral', name: 'Coral', color: 0xe86a5c }, { id: 'sol', name: 'Sol', color: 0xf2b93b },
  { id: 'menta', name: 'Menta', color: 0x2f9e8f }, { id: 'cielo', name: 'Cielo', color: 0x3a8fd6 }, { id: 'uva', name: 'Uva', color: 0x8a5fd0 }, { id: 'noche', name: 'Noche', color: 0x22345c }
]);
/** Tono de piel: elección libre y gratuita para cualquier personaje. */
export const SKIN_TONES = Object.freeze([
  { id: 'base', name: 'Del personaje', color: null }, { id: 't1', name: 'Clara', color: 0xf6d3b5 }, { id: 't2', name: 'Media clara', color: 0xe9b58c },
  { id: 't3', name: 'Media', color: 0xc98e63 }, { id: 't4', name: 'Morena', color: 0x9a6440 }, { id: 't5', name: 'Oscura', color: 0x6b4129 }
]);

/** Las diez misiones profesionales (para requisitos como «completa las diez»). */
export const MISSION_IDS = Object.freeze(['banco-credito-correcto', 'tribunal-tu-eres-el-juez', 'super-rescate-inventario', 'obra-inspector-seguridad', 'hospital-turno-decisiones',
  'vet-guardianes-bienestar', 'restaurante-cocina-contra-reloj', 'invernadero-cultivo-inteligente', 'oficina-expediente-perdido', 'torre-desafio-equipos']);

const lvl = p => levelFromXp(p.xp || 0).level;
const doneCount = p => MISSION_IDS.filter(id => p.missions && p.missions[id] && p.missions[id].completed).length;
const playAch = p => playAchievements(p.play);
const level = n => ({ text: `Llega al nivel ${n}`, test: p => lvl(p) >= n, progress: p => [Math.min(lvl(p), n), n] });
const mission = (id, title, place) => ({ text: `Completa «${title}» en ${place}`, test: p => Boolean(p.missions && p.missions[id] && p.missions[id].completed), progress: p => [p.missions && p.missions[id] && p.missions[id].completed ? 1 : 0, 1] });
const FREE = Object.freeze({ text: 'Gratuito', test: () => true, progress: () => [1, 1] });

/**
 * Cómo se consigue cada personaje. Ninguno se compra con dinero ni da ventaja. El servidor aplica
 * estas mismas reglas antes de aceptar un cambio de avatar: el navegador no puede desbloquearlos.
 * `progress(p)` → [actual, meta] para mostrar cuánto falta.
 */
export const AVATAR_UNLOCKS = Object.freeze({
  // iniciales
  explorador: FREE, exploradora: FREE, estudiante: FREE, universitaria: FREE, deportista: FREE, atleta: FREE, creativa: FREE,
  // profesiones (los diez originales: mismos requisitos de siempre)
  ejecutivo: mission(MISSION_BANK, 'El crédito correcto', 'el Banco'),
  juez: mission(MISSION_COURT, 'Tú eres el juez', 'el Tribunal'),
  cientifica: level(2), ingeniero: level(3), medico: level(4), chef: level(5), veterinario: level(6),
  agronomo: { text: 'Descubre los 11 edificios de la ciudad', test: p => BUILDING_IDS.every(id => p.visited.includes(id)), progress: p => [BUILDING_IDS.filter(id => p.visited.includes(id)).length, BUILDING_IDS.length] },
  embajador: { text: 'Obtén 90 puntos o más en dos misiones', test: p => Object.values(p.missions).filter(m => (m.bestScore || 0) >= 90).length >= 2, progress: p => [Math.min(2, Object.values(p.missions).filter(m => (m.bestScore || 0) >= 90).length), 2] },
  // especiales
  astronauta: level(8),
  capitana: mission('torre-desafio-equipos', 'Desafío de equipos', 'la Torre'),
  guardian: { text: 'Completa las diez misiones profesionales', test: p => doneCount(p) === MISSION_IDS.length, progress: p => [doneCount(p), MISSION_IDS.length] },
  'mente-brillante': { text: 'Responde bien 20 retos de los personajes de la ciudad', test: p => ((p.play && p.play.quizCorrect) || 0) >= 20, progress: p => [Math.min(20, (p.play && p.play.quizCorrect) || 0), 20] },
  campeon: { text: 'Consigue los logros «Atleta ICADEM» y «Cazatesoros»', test: p => ['atleta-icadem', 'cazatesoros'].every(a => playAch(p).includes(a)), progress: p => [['atleta-icadem', 'cazatesoros'].filter(a => playAch(p).includes(a)).length, 2] },
  leyenda: level(10)
});
export const unlockProgress = (id, profile) => { const u = AVATAR_UNLOCKS[id]; if (!u) return [0, 1]; try { return u.progress(profile); } catch (_) { return [0, 1]; } };
export const isAvatarUnlocked = (id, profile) => Boolean(AVATAR_UNLOCKS[id]?.test(profile));

export function cleanCustom(custom) {
  const c = custom && typeof custom === 'object' ? custom : {};
  const clean = { outfit: OUTFIT_COLORS.some(o => o.id === c.outfit) ? c.outfit : 'base', hat: HAT_OPTIONS.some(o => o.id === c.hat) ? c.hat : 'base', tone: SKIN_TONES.some(o => o.id === c.tone) ? c.tone : 'base' };
  for (const [key, options] of Object.entries(COSMETIC_OPTIONS)) {
    if (c[key] !== 'base' && options.some(o => o.id === c[key])) clean[key] = c[key];
  }
  return clean;
}

/** Apariencia final = avatar base + equipamiento elegido. */
export function applyCustom(look, custom) {
  const c = cleanCustom(custom), out = { ...look, accessories: [...(look.accessories || [])] };
  const outfit = OUTFIT_COLORS.find(o => o.id === c.outfit);
  if (outfit.color !== null) out.top = outfit.color;
  const tone = SKIN_TONES.find(o => o.id === c.tone); if (tone && tone.color !== null) out.skin = tone.color;
  if (c.hat !== 'base') { out.accessories = out.accessories.filter(a => !HAT_ACCESSORIES.includes(a)); if (c.hat !== 'none') out.accessories.push(c.hat); }
  if (c.top) {
    out.topStyle = c.top;
    if (c.outfit === 'base') out.top = COSMETIC_OPTIONS.top.find(o => o.id === c.top).color;
    out.accessories = out.accessories.filter(a => !['scarf', 'tie', 'lapels', 'robe', 'apron', 'badge', 'stethoscope'].includes(a));
  }
  if (c.bottom) { out.bottomStyle = c.bottom; out.bottom = COSMETIC_OPTIONS.bottom.find(o => o.id === c.bottom).color; }
  if (c.shoes) { out.shoeStyle = c.shoes; out.shoes = COSMETIC_OPTIONS.shoes.find(o => o.id === c.shoes).color; }
  if (c.bag) { out.bagStyle = c.bag; out.accessories = out.accessories.filter(a => a !== 'backpack'); }
  if (c.hairStyle) out.hairStyle = c.hairStyle;
  if (c.hairColor) out.hair = HAIR_COLORS.find(o => o.id === c.hairColor).color;
  if (c.necklace) { out.necklaceStyle = c.necklace; out.accessories = out.accessories.filter(a => !['scarf', 'medal'].includes(a)); }
  if (c.glasses) { out.glassesStyle = c.glasses; out.accessories = out.accessories.filter(a => a !== 'glasses'); }
  if (c.bracelet) out.braceletStyle = c.bracelet;
  if (c.headphones) out.headphonesStyle = c.headphones;
  return out;
}

/** Logros que se derivan del progreso (el servidor los calcula; no se aceptan del cliente). */
export function deriveAchievements(p) {
  const list = [], done = Object.values(p.missions).filter(m => m.completed);
  if (p.tutorialDone) list.push('primeros-pasos');
  if (done.length) list.push('primera-mision');
  if (Object.values(p.missions).some(m => m.bestScore === 100)) list.push('decision-impecable');
  if (p.missions[MISSION_COURT]?.completed) list.push('toga-y-mazo');
  if (BUILDING_IDS.every(id => p.visited.includes(id))) list.push('explorador-urbano');
  if (LANDMARKS.every(l => (p.discovered || []).includes(l.id))) list.push('trotamundos');
  list.push(...playAchievements(p.play));
  return list;
}

export function emptyProfile() {
  return { v: PROFILE_VERSION, rev: 0, xp: 0, missions: {}, visited: [], discovered: [], tutorialDone: false, achievements: [], avatarId: 'explorador', avatarChosen: false, custom: cleanCustom(null), testCredits: 0, testLedger: [], play: emptyPlay(), privacy: { listed: true }, ...emptyVivo() };
}
