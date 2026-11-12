// Reglas del progreso del jugador, compartidas por el cliente y el servidor (módulo puro).
// El servidor es quien las aplica de verdad; el cliente solo las usa para mostrar qué falta.
import { levelFromXp } from '../core/store.js';
import { emptyPlay, playAchievements } from '../edu/play-rules.js';

export const PROFILE_VERSION = 1;
export const VISIT_XP = 10, TUTORIAL_XP = 40, TUTORIAL_CREDITS = 10;
export const BUILDING_IDS = Object.freeze(['banco', 'tribunal', 'hospital', 'torre', 'veterinaria', 'casa', 'restaurante', 'supermercado', 'invernadero', 'oficina', 'obra']);
export const MISSION_BANK = 'banco-credito-correcto', MISSION_COURT = 'tribunal-tu-eres-el-juez';

/** Colores de equipamiento (playera/saco). Solo estética: ninguno da ventaja. */
export const OUTFIT_COLORS = Object.freeze([
  { id: 'base', name: 'Original', color: null }, { id: 'coral', name: 'Coral', color: 0xe86a5c }, { id: 'sol', name: 'Sol', color: 0xf2b93b },
  { id: 'menta', name: 'Menta', color: 0x2f9e8f }, { id: 'cielo', name: 'Cielo', color: 0x3a8fd6 }, { id: 'uva', name: 'Uva', color: 0x8a5fd0 }, { id: 'noche', name: 'Noche', color: 0x22345c }
]);
export const HAT_OPTIONS = Object.freeze([{ id: 'base', name: 'El del avatar' }, { id: 'none', name: 'Sin sombrero' }, { id: 'cap', name: 'Gorra' }, { id: 'explorerHat', name: 'Sombrero' }]);

/** Cómo se consigue cada avatar. Ninguno se compra con dinero ni da ventaja. */
export const AVATAR_UNLOCKS = Object.freeze({
  explorador: { text: 'Gratuito', test: () => true },
  ejecutivo: { text: 'Completa «El crédito correcto» en el Banco', test: p => Boolean(p.missions[MISSION_BANK]?.completed) },
  juez: { text: 'Completa «Tú eres el juez» en el Tribunal', test: p => Boolean(p.missions[MISSION_COURT]?.completed) },
  cientifica: { text: 'Llega al nivel 2', test: p => levelFromXp(p.xp).level >= 2 },
  ingeniero: { text: 'Llega al nivel 3', test: p => levelFromXp(p.xp).level >= 3 },
  agronomo: { text: 'Descubre los 11 edificios de la ciudad', test: p => BUILDING_IDS.every(id => p.visited.includes(id)) },
  medico: { text: 'Llega al nivel 4', test: p => levelFromXp(p.xp).level >= 4 },
  chef: { text: 'Llega al nivel 5', test: p => levelFromXp(p.xp).level >= 5 },
  veterinario: { text: 'Llega al nivel 6', test: p => levelFromXp(p.xp).level >= 6 },
  embajador: { text: 'Obtén 90 puntos o más en dos misiones', test: p => Object.values(p.missions).filter(m => (m.bestScore || 0) >= 90).length >= 2 }
});
export const isAvatarUnlocked = (id, profile) => Boolean(AVATAR_UNLOCKS[id]?.test(profile));

export function cleanCustom(custom) {
  const c = custom && typeof custom === 'object' ? custom : {};
  return { outfit: OUTFIT_COLORS.some(o => o.id === c.outfit) ? c.outfit : 'base', hat: HAT_OPTIONS.some(o => o.id === c.hat) ? c.hat : 'base' };
}

/** Apariencia final = avatar base + equipamiento elegido. */
export function applyCustom(look, custom) {
  const c = cleanCustom(custom), out = { ...look, accessories: [...look.accessories] };
  const outfit = OUTFIT_COLORS.find(o => o.id === c.outfit);
  if (outfit.color !== null) out.top = outfit.color;
  if (c.hat !== 'base') { out.accessories = out.accessories.filter(a => !['cap', 'explorerHat', 'toque', 'hardhat'].includes(a)); if (c.hat !== 'none') out.accessories.push(c.hat); }
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
  list.push(...playAchievements(p.play));
  return list;
}

export function emptyProfile() {
  return { v: PROFILE_VERSION, rev: 0, xp: 0, missions: {}, visited: [], tutorialDone: false, achievements: [], avatarId: 'explorador', custom: cleanCustom(null), testCredits: 0, testLedger: [], play: emptyPlay(), privacy: { listed: true } };
}
