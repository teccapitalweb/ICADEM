// Ciudad ICADEM 2.0 «Mundo vivo» · reglas de inventario, mascotas, casa y compras.
// Módulo puro: el SERVIDOR lo aplica sobre el perfil guardado; el cliente lo usa solo para mostrar.
//
// Contrato completo en ciudad/MUNDO_VIVO.md. Resumen de los campos nuevos del perfil:
//   coins            monedas del juego (≥ 0)
//   coinbook         { day, today, daily, keys, ledger } (interno: premios ya pagados y movimientos)
//   inv              { idArtículo: cantidad }
//   pets             [{ id, breed, name, acc: { ranura: idArtículo } }]
//   activePet        id de la mascota que acompaña, o null
//   home             { wall, floor, items: [{ item, x, z, r }] }
//   rids             últimos identificadores de compra (para no cobrar dos veces el mismo toque)
import { ITEMS, itemById, STARTER_ITEMS, STARTER_COUNTS, DRINK_PRICE, flavorById, checkDrinkSteps } from '../economy/catalog.js';
import { COINS, emptyCoinbook, cleanCoinbook, earn, spend } from '../economy/coins.js';
import { BREEDS, breedById, breedAvailable, breedCost, PET_MAX, PET_SLOTS, slotFits, shapePetName } from '../pets/pet-catalog.js';
import { DEFAULT_HOME, checkLayout } from '../home/home-rules.js';
import { checkMessage } from '../social/chat-rules.js';
import { levelFromXp } from '../core/store.js';

export const VIVO_VERSION = 1;
export const RID_MAX = 40;

const starterInventory = () => { const inv = {}; for (const id of STARTER_ITEMS) inv[id] = STARTER_COUNTS[id] || 1; return inv; };
const copyHome = h => ({ wall: h.wall, floor: h.floor, items: h.items.map(e => ({ ...e })) });

/** Campos de «Mundo vivo» de una cuenta que nunca los tuvo. */
export function emptyVivo() {
  return { vivo: VIVO_VERSION, coins: COINS.start, coinbook: { ...emptyCoinbook(), keys: ['bienvenida'], ledger: [{ k: 'bienvenida', a: COINS.start, at: 0 }] }, inv: starterInventory(), pets: [], activePet: null, home: copyHome(DEFAULT_HOME), rids: [] };
}

/**
 * Normaliza lo guardado. La primera vez que una cuenta existente abre la economía recibe la
 * bienvenida y sus «créditos de prueba» anteriores pasan a monedas (las claves ya pagadas se
 * conservan, así nada se paga dos veces). `testCredits` queda intacto como historial.
 */
export function cleanVivo(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  if (s.vivo !== VIVO_VERSION) {
    const v = emptyVivo(), legacy = Math.max(0, Math.round(Number(s.testCredits) || 0));
    v.coins += legacy;
    if (legacy) v.coinbook.ledger.push({ k: 'creditos-de-prueba', a: legacy, at: 0 });
    for (const e of Array.isArray(s.testLedger) ? s.testLedger : []) if (e && typeof e.key === 'string' && !v.coinbook.keys.includes(e.key)) v.coinbook.keys.push(e.key.slice(0, 80));
    return v;
  }
  const inv = {};
  if (s.inv && typeof s.inv === 'object') for (const [id, n] of Object.entries(s.inv)) { const def = itemById(id), k = Math.floor(Number(n) || 0); if (def && k > 0) inv[id] = def.stack ? Math.min(k, 99) : Math.min(k, 9); }
  const pets = (Array.isArray(s.pets) ? s.pets : []).filter(x => x && typeof x.id === 'string' && breedById(x.breed)).slice(0, PET_MAX).map(x => {
    const acc = {}; if (x.acc && typeof x.acc === 'object') for (const [slot, id] of Object.entries(x.acc)) { const def = itemById(id); if (PET_SLOTS[slot] && def && def.slot === slot && inv[id] && slotFits(slot, x.breed)) acc[slot] = id; }
    return { id: x.id.slice(0, 12), breed: x.breed, name: shapePetName(x.name) || breedById(x.breed).name.slice(0, 16), acc };
  });
  const home = checkLayout(s.home, inv);
  return {
    vivo: VIVO_VERSION, coins: Math.max(0, Math.round(Number(s.coins) || 0)), coinbook: cleanCoinbook(s.coinbook), inv, pets,
    activePet: pets.some(x => x.id === s.activePet) ? s.activePet : null, home: home.ok ? home.layout : copyHome(DEFAULT_HOME),
    rids: Array.isArray(s.rids) ? s.rids.filter(r => typeof r === 'string').slice(-RID_MAX) : []
  };
}

/** Lo que ve el cliente (sin claves internas ni identificadores de compra). */
export function vivoView(p) {
  const w = p.coinbook || emptyCoinbook();
  return { coins: p.coins, inv: { ...p.inv }, pets: p.pets.map(x => ({ id: x.id, breed: x.breed, name: x.name, acc: { ...x.acc } })), activePet: p.activePet, home: copyHome(p.home),
    coinbook: { today: w.today, cap: COINS.dailyCap, recent: w.ledger.slice(-12).reverse().map(e => ({ k: e.k, a: e.a, at: e.at })) } };
}

/** Nombre de mascota aceptable: forma válida y sin lenguaje bloqueado (mismo filtro del chat). */
export function petName(raw) {
  const s = shapePetName(raw); if (!s) return '';
  const r = checkMessage(s); return r.ok && r.text === s ? s : '';
}

export const VIVO_REASONS = Object.freeze({
  operacion: 'Esa acción no existe.', repetida: 'Esa compra ya se registró.', 'no-existe': 'Ese artículo no existe.', 'no-se-vende': 'Ese artículo no está a la venta.',
  bloqueado: 'Todavía no cumples el requisito.', 'ya-lo-tienes': 'Ya tienes ese artículo.', 'sin-monedas': 'No te alcanzan las monedas.', cantidad: 'Cantidad no válida.',
  'raza-desconocida': 'Esa mascota no existe.', 'ya-adoptada': 'Ya tienes esa mascota.', 'coleccion-llena': `Tu colección ya tiene ${PET_MAX} mascotas.`, nombre: 'Elige otro nombre (2 a 16 letras o números).',
  'sin-mascota': 'Esa mascota no es tuya.', 'no-compatible': 'Ese accesorio no le queda a esa especie.', 'no-lo-tienes': 'No tienes ese artículo.',
  'sabor-desconocido': 'Ese sabor no está en el menú.', receta: 'La preparación no siguió los pasos.', comida: 'Esa comida no es para esa mascota.'
});

const remember = (p, rid) => { if (rid) { p.rids.push(rid); if (p.rids.length > RID_MAX) p.rids.splice(0, p.rids.length - RID_MAX); } };
const nextPetId = p => { let n = 1; const used = new Set(p.pets.map(x => x.id)); while (used.has('m' + n)) n++; return 'm' + n; };

/**
 * Aplica una acción sobre el perfil (lo modifica). Devuelve { ok, reason?, changed, ...datos }.
 * `rid` (identificador de la petición) hace idempotentes las compras y adopciones: el mismo rid
 * repetido no cobra dos veces y responde duplicate:true.
 */
export function applyVivo(p, op, args = {}, { now = Date.now() } = {}) {
  const a = args && typeof args === 'object' ? args : {};
  const rid = typeof a.rid === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(a.rid) ? a.rid : null;
  if ((op === 'buy' || op === 'adopt' || op === 'drink') && rid && p.rids.includes(rid)) return { ok: true, duplicate: true, changed: false };

  if (op === 'buy') {
    const def = itemById(String(a.item || '')); if (!def) return { ok: false, reason: 'no-existe' };
    if (!(def.price > 0)) return { ok: false, reason: 'no-se-vende' };
    if (def.unlock && def.unlock.level && levelFromXp(p.xp || 0).level < def.unlock.level) return { ok: false, reason: 'bloqueado' };
    const qty = def.stack ? Math.floor(Number(a.qty) || 1) : 1;
    if (qty < 1 || qty > 10) return { ok: false, reason: 'cantidad' };
    const have = p.inv[def.id] || 0;
    if (!def.stack && def.kind !== 'furniture' && have >= 1) return { ok: false, reason: 'ya-lo-tienes' };
    if (have + qty > (def.stack ? 99 : 9)) return { ok: false, reason: 'cantidad' };
    if (!spend(p, 'compra:' + def.id, def.price * qty, now)) return { ok: false, reason: 'sin-monedas' };
    p.inv[def.id] = have + qty; remember(p, rid);
    return { ok: true, changed: true, item: def.id, qty, spent: def.price * qty };
  }

  if (op === 'adopt') {
    const b = breedById(String(a.breed || '')); if (!b) return { ok: false, reason: 'raza-desconocida' };
    if (p.pets.some(x => x.breed === b.id)) return { ok: false, reason: 'ya-adoptada' };
    if (p.pets.length >= PET_MAX) return { ok: false, reason: 'coleccion-llena' };
    if (!breedAvailable(b, p)) return { ok: false, reason: 'bloqueado' };
    const name = petName(a.name || b.name.split(' ')[0]); if (!name) return { ok: false, reason: 'nombre' };
    const cost = breedCost(b);
    if (cost && !spend(p, 'adopcion:' + b.id, cost, now)) return { ok: false, reason: 'sin-monedas' };
    const acc = {};
    if (slotFits('collar', b) && p.inv['collar-basico']) acc.collar = 'collar-basico';
    const pet = { id: nextPetId(p), breed: b.id, name, acc };
    p.pets.push(pet); if (!p.activePet) p.activePet = pet.id; remember(p, rid);
    return { ok: true, changed: true, pet: { ...pet, acc: { ...acc } }, spent: cost };
  }

  if (op === 'pet') {
    const pet = p.pets.find(x => x.id === a.id); if (!pet) return { ok: false, reason: 'sin-mascota' };
    if (a.name !== undefined) { const n = petName(a.name); if (!n) return { ok: false, reason: 'nombre' }; pet.name = n; }
    if (a.acc && typeof a.acc === 'object') for (const [slot, id] of Object.entries(a.acc)) {
      if (!PET_SLOTS[slot]) return { ok: false, reason: 'no-compatible' };
      if (id === null || id === '') { delete pet.acc[slot]; continue; }
      const def = itemById(String(id));
      if (!def || def.slot !== slot || !slotFits(slot, pet.breed)) return { ok: false, reason: 'no-compatible' };
      if (!p.inv[def.id]) return { ok: false, reason: 'no-lo-tienes' };
      pet.acc[slot] = def.id;
    }
    if (a.active === true) p.activePet = pet.id;
    if (a.active === false && p.activePet === pet.id) p.activePet = null;
    return { ok: true, changed: true, pet: { ...pet, acc: { ...pet.acc } } };
  }

  if (op === 'rest') { p.activePet = null; return { ok: true, changed: true }; }   // todas se quedan en casa

  if (op === 'home') {
    const r = checkLayout(a.layout, p.inv); if (!r.ok) return { ok: false, reason: 'casa-' + r.reason, index: r.index };
    p.home = r.layout; return { ok: true, changed: true };
  }

  if (op === 'feed') {
    const pet = p.pets.find(x => x.id === a.pet); if (!pet) return { ok: false, reason: 'sin-mascota' };
    const food = String(a.food || 'croquetas'), species = breedById(pet.breed).species;
    if (food !== 'croquetas') {
      const def = itemById(food); if (!def || def.kind !== 'treat') return { ok: false, reason: 'comida' };
      if (!def.species.includes(species)) return { ok: false, reason: 'comida' };
      if (!p.inv[def.id]) return { ok: false, reason: 'no-lo-tienes' };
      p.inv[def.id]--; if (!p.inv[def.id]) delete p.inv[def.id];
    }
    const coins = earn(p, 'cuidado-mascota', COINS.petCare, { daily: true }, now);
    return { ok: true, changed: true, food, treat: food !== 'croquetas', coins };
  }

  if (op === 'drink') {
    const f = flavorById(String(a.flavor || '')); if (!f) return { ok: false, reason: 'sabor-desconocido' };
    if (a.mode === 'buy') {
      if (!spend(p, 'agua:' + f.id, DRINK_PRICE, now)) return { ok: false, reason: 'sin-monedas' };
      remember(p, rid); return { ok: true, changed: true, flavor: f.id, mode: 'buy', spent: DRINK_PRICE, coins: 0 };
    }
    if (!checkDrinkSteps(f.id, a.steps)) return { ok: false, reason: 'receta' };
    remember(p, rid);
    const coins = earn(p, 'agua-preparada', COINS.drink, { daily: true }, now);
    return { ok: true, changed: true, flavor: f.id, mode: 'self', coins };
  }

  return { ok: false, reason: 'operacion' };
}

export const VIVO_OPS = Object.freeze(['buy', 'adopt', 'pet', 'rest', 'home', 'feed', 'drink']);
export { ITEMS, BREEDS };
