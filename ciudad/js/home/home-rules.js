// Ciudad ICADEM 2.0 · reglas de la casa personalizable (módulo puro, cliente y servidor).
//
// «Mi casa» es un escenario privado (sala de 12 × 10 m) al que se entra desde la habitación.
// Esta es la PRIMERA etapa de vivienda: colores, pisos y muebles dentro del espacio propio.
// No hay mercado inmobiliario, terrenos, vehículos comerciales ni pagos (eso sería Ciudad ICADEM Living).
//
// Una distribución es { wall, floor, items: [{ item, x, z, r }] } con r = cuartos de vuelta (0–3).
// El servidor la valida completa antes de guardarla; el cliente usa las mismas reglas para avisar.
import { itemById } from '../economy/catalog.js';

export const HOME = Object.freeze({
  minX: -6, maxX: 6, minZ: -5, maxZ: 5,         // paredes interiores
  margin: 0.12,                                  // separación mínima de los muebles a la pared
  door: { x: 0, z: -5, width: 1.4 },             // puerta a la habitación (pared norte)
  clear: { minX: -1.3, maxX: 1.3, minZ: -5, maxZ: -2.9 },   // frente a la puerta: siempre libre
  maxItems: 40, maxRugs: 3, grid: 0.05
});
export const WALL_COLORS = Object.freeze([
  { id: 'crema', name: 'Crema', color: 0xfde9c9 }, { id: 'menta', name: 'Menta', color: 0xcdeee2 }, { id: 'cielo', name: 'Cielo', color: 0xcfe6fb },
  { id: 'lavanda', name: 'Lavanda', color: 0xe3d9f6 }, { id: 'durazno', name: 'Durazno', color: 0xffd9c2 }, { id: 'olivo', name: 'Olivo', color: 0xdfe5c4 },
  { id: 'rosa-mexicano', name: 'Rosa mexicano', color: 0xf6b6cf }, { id: 'azul-anil', name: 'Azul añil', color: 0x9cb4e6 }
]);
export const FLOORS = Object.freeze([
  { id: 'madera-clara', name: 'Madera clara', color: 0xe2b98a, pattern: 'planks' }, { id: 'madera-oscura', name: 'Madera oscura', color: 0x8a5a36, pattern: 'planks' },
  { id: 'loseta', name: 'Loseta', color: 0xe9e4da, pattern: 'tiles' }, { id: 'barro', name: 'Barro cocido', color: 0xc1693f, pattern: 'tiles' },
  { id: 'talavera', name: 'Talavera', color: 0x2f5fb3, pattern: 'talavera' }, { id: 'alfombrado', name: 'Alfombrado azul', color: 0x5d7fb8, pattern: 'carpet' }
]);

/** Distribución inicial gratuita (usa los artículos de regalo). */
export const DEFAULT_HOME = Object.freeze({
  wall: 'crema', floor: 'madera-clara',
  items: Object.freeze([
    { item: 'cama-sencilla', x: -4.8, z: 3.75, r: 0 }, { item: 'sillon', x: 2.2, z: 1.4, r: 2 }, { item: 'mesa-centro', x: 2.2, z: 0.2, r: 0 },
    { item: 'silla', x: -3.2, z: -3.6, r: 0 }, { item: 'silla', x: -2.4, z: -3.6, r: 0 }, { item: 'lampara-pie', x: 5.5, z: 4.5, r: 0 },
    { item: 'planta-maceta', x: 5.5, z: -4.5, r: 0 }, { item: 'alfombra-redonda', x: 2.2, z: 0.6, r: 0 },
    { item: 'cama-mascota', x: -5.3, z: 0.4, r: 0 }, { item: 'comedero', x: -5.5, z: -1.0, r: 0 }, { item: 'bebedero', x: -5.5, z: -1.6, r: 0 }
  ].map(Object.freeze))
});

const snap = v => Math.round(v / HOME.grid) * HOME.grid;
const round2 = v => Math.round(v * 100) / 100;
/** Huella (rectángulo) de un mueble ya girado. */
export function footprint(entry) {
  const def = itemById(entry.item); if (!def || !def.size) return null;
  const [w, d] = entry.r % 2 ? [def.size[1], def.size[0]] : def.size;
  return { minX: entry.x - w / 2, maxX: entry.x + w / 2, minZ: entry.z - d / 2, maxZ: entry.z + d / 2, layer: def.layer, def };
}
const overlap = (a, b, eps = 0.01) => a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps;

/** Pared en la que va un cuadro: la más cercana. Devuelve la posición ajustada a esa pared. */
export function wallSnap(x, z) {
  const d = [['N', Math.abs(z - HOME.minZ)], ['S', Math.abs(z - HOME.maxZ)], ['W', Math.abs(x - HOME.minX)], ['E', Math.abs(x - HOME.maxX)]].sort((a, b) => a[1] - b[1])[0][0];
  if (d === 'N') return { x, z: HOME.minZ, r: 0, side: 'N' };
  if (d === 'S') return { x, z: HOME.maxZ, r: 2, side: 'S' };
  if (d === 'W') return { x: HOME.minX, z, r: 1, side: 'W' };
  return { x: HOME.maxX, z, r: 3, side: 'E' };
}

/**
 * Valida una distribución contra el inventario. Devuelve { ok, layout } o { ok:false, reason, index }.
 * Motivos: formato, demasiados, no-es-mueble, no-lo-tienes, fuera, puerta, encimado, alfombras.
 */
export function checkLayout(raw, inventory = {}) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return { ok: false, reason: 'formato' };
  const wall = WALL_COLORS.some(w => w.id === raw.wall) ? raw.wall : null, floor = FLOORS.some(f => f.id === raw.floor) ? raw.floor : null;
  if (!wall || !floor) return { ok: false, reason: 'formato' };
  if (raw.items.length > HOME.maxItems) return { ok: false, reason: 'demasiados' };
  const used = {}, placed = [], items = [];
  let rugs = 0;
  for (let i = 0; i < raw.items.length; i++) {
    const src = raw.items[i];
    if (!src || typeof src.item !== 'string' || !Number.isFinite(src.x) || !Number.isFinite(src.z)) return { ok: false, reason: 'formato', index: i };
    const def = itemById(src.item); if (!def || def.kind !== 'furniture') return { ok: false, reason: 'no-es-mueble', index: i };
    used[def.id] = (used[def.id] || 0) + 1;
    if (used[def.id] > (Number(inventory[def.id]) || 0)) return { ok: false, reason: 'no-lo-tienes', index: i };
    let e = { item: def.id, x: round2(snap(src.x)), z: round2(snap(src.z)), r: ((Math.round(Number(src.r) || 0) % 4) + 4) % 4 };
    if (def.layer === 'wall') { const w = wallSnap(e.x, e.z); e = { item: def.id, x: round2(w.x), z: round2(w.z), r: w.r }; }
    const f = footprint(e), m = def.layer === 'wall' ? 0 : HOME.margin;
    if (def.layer === 'wall') {
      // a lo largo de la pared, dentro de sus extremos y sin tapar la puerta
      const along = e.r % 2 ? [e.z - def.size[0] / 2, e.z + def.size[0] / 2, HOME.minZ, HOME.maxZ] : [e.x - def.size[0] / 2, e.x + def.size[0] / 2, HOME.minX, HOME.maxX];
      if (along[0] < along[2] + 0.2 || along[1] > along[3] - 0.2) return { ok: false, reason: 'fuera', index: i };
      if (e.r === 0 && Math.abs(e.x - HOME.door.x) < HOME.door.width / 2 + def.size[0] / 2 + 0.1) return { ok: false, reason: 'puerta', index: i };
      const seg = e.r % 2 ? { minX: e.x - 0.05, maxX: e.x + 0.05, minZ: along[0], maxZ: along[1] } : { minX: along[0], maxX: along[1], minZ: e.z - 0.05, maxZ: e.z + 0.05 };
      if (placed.some(p => p.layer === 'wall' && overlap(p, seg))) return { ok: false, reason: 'encimado', index: i };
      placed.push({ ...seg, layer: 'wall' }); items.push(e); continue;
    }
    if (f.minX < HOME.minX + m || f.maxX > HOME.maxX - m || f.minZ < HOME.minZ + m || f.maxZ > HOME.maxZ - m) return { ok: false, reason: 'fuera', index: i };
    if (def.layer === 'rug') { if (++rugs > HOME.maxRugs) return { ok: false, reason: 'alfombras', index: i }; items.push(e); continue; }
    if (overlap(f, HOME.clear)) return { ok: false, reason: 'puerta', index: i };
    if (placed.some(p => p.layer !== 'wall' && overlap(p, f))) return { ok: false, reason: 'encimado', index: i };
    placed.push(f); items.push(e);
  }
  return { ok: true, layout: { wall, floor, items } };
}

export const HOME_REASONS = Object.freeze({
  formato: 'La distribución no es válida.', demasiados: `Caben hasta ${HOME.maxItems} objetos en la casa.`, 'no-es-mueble': 'Ese objeto no se puede colocar en la casa.',
  'no-lo-tienes': 'Colocaste más piezas de las que tienes.', fuera: 'Ese mueble queda fuera del espacio de la casa.', puerta: 'La entrada debe quedar libre.',
  encimado: 'Dos muebles quedaron encimados.', alfombras: `Caben hasta ${HOME.maxRugs} alfombras.`
});
