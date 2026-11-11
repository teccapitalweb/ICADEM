// Misión 3 · Supermercado · "Rescate de inventario" — reglas y calificación (módulo puro).
// Igual que el Banco y el Tribunal: aquí vive todo lo que decide el resultado, sin DOM ni
// Three.js, y este mismo archivo corre en el servidor antes de acreditar la recompensa.
//
// El caso: mañana hay auditoría. Don Ramiro, el gerente, necesita que el inventario diga la
// verdad: contar los estantes, retirar lo que ya no se puede vender, acomodar el refrigerador
// con PEPS (primeras entradas, primeras salidas) y registrar los ajustes en el sistema.

export const MISSION_ID = 'super-rescate-inventario';

/** Fecha "de hoy" dentro del juego: todas las caducidades se leen contra este día. */
export const TODAY = '15 de marzo';

export const MANAGER = Object.freeze({ name: 'Don Ramiro', role: 'Gerente', audit: 'mañana a primera hora' });

/** Los tres estantes: lo que dice el sistema contra lo que de verdad hay. */
export const SHELVES = Object.freeze([
  { id: 'lacteos', name: 'Refrigerador de lácteos', unit: 'piezas', system: 24, real: 21 },
  { id: 'abarrotes', name: 'Góndola de abarrotes', unit: 'piezas', system: 36, real: 36 },
  { id: 'frutas', name: 'Mesa de frutas y verduras', unit: 'kilos', system: 18, real: 15 }
]);
export const shelfById = id => SHELVES.find(s => s.id === id) || null;
/** El ajuste correcto de un estante: lo contado menos lo que decía el sistema. */
export const deltaOf = shelf => shelf.real - shelf.system;

/** Mesa de revisión: cinco productos apartados por la empleada. `remove` es la decisión correcta. */
export const PRODUCTS = Object.freeze([
  { id: 'leche', name: 'Leche entera 1 L', detail: 'Caducó el 12 de marzo', remove: true,
    why: 'Caducó hace tres días: se retira de la venta, sin excepción.' },
  { id: 'atun', name: 'Lata de atún', detail: 'Abollada y con fuga', remove: true,
    why: 'Una lata con fuga pudo contaminarse: se retira aunque la fecha esté vigente.' },
  { id: 'pan', name: 'Pan de caja', detail: 'Caduca el 16 de marzo', remove: false,
    why: 'Aún es seguro: se acomoda al frente y se promueve para venderse hoy.' },
  { id: 'yogur', name: 'Yogur natural', detail: 'Caduca el 28 de marzo', remove: false,
    why: 'Está en buen estado y con fecha amplia: se queda a la venta.' },
  { id: 'arroz', name: 'Arroz 1 kg', detail: 'Consumo preferente: octubre', remove: false,
    why: 'Los secos duran meses: basta revisar que el empaque esté íntegro.' }
]);
export const productById = id => PRODUCTS.find(p => p.id === id) || null;
export const DECISIONS = Object.freeze(['retirar', 'conservar']);

/** Lotes de leche del refrigerador. PEPS: al frente va el que caduca primero. */
export const LOTS = Object.freeze([
  { id: 'a', name: 'Lote A', expiry: '20 de marzo' },
  { id: 'b', name: 'Lote B', expiry: '16 de marzo' },
  { id: 'c', name: 'Lote C', expiry: '2 de abril' }
]);
export const BEST_ORDER = Object.freeze(['b', 'a', 'c']);
const LOT_IDS = LOTS.map(l => l.id);
const isLotOrder = order => Array.isArray(order) && order.length === LOT_IDS.length &&
  [...order].sort().join() === [...LOT_IDS].sort().join();

export const REASONS = Object.freeze([
  { id: 'salud', text: 'Vender productos caducados o dañados pone en riesgo al cliente', correct: true },
  { id: 'peps', text: 'Lo que caduca primero se acomoda al frente para venderse primero', correct: true },
  { id: 'lleno', text: 'Un estante bien lleno vende más, aunque algo esté vencido', correct: false },
  { id: 'rapido', text: 'Conviene retirar todo lo dudoso sin revisarlo: es más rápido', correct: false },
  { id: 'bodega', text: 'Lo caducado se guarda en bodega por si alguien lo pide después', correct: false }
]);

export function newAttempt() {
  return { talked: false, ledger: false, counted: {}, inspected: [], decisions: {}, fridge: null, adjusted: {}, reported: false, reasons: [] };
}

const countedAll = a => SHELVES.every(s => a.counted[s.id] === true);
const decidedAll = a => PRODUCTS.every(p => DECISIONS.includes(a.decisions[p.id]));
const adjustedAll = a => SHELVES.every(s => Number.isInteger(a.adjusted[s.id]));

/** ¿Qué paso sigue? Para el rastreador y las pistas del gerente. */
export function nextStep(a) {
  if (!a.talked) return 'talk';
  if (!a.ledger) return 'ledger';
  if (!countedAll(a)) return 'count';
  if (!decidedAll(a)) return 'review';
  if (!isLotOrder(a.fridge)) return 'fridge';
  if (!adjustedAll(a)) return 'adjust';
  if (!a.reported) return 'report';
  if (!a.reasons.length) return 'justify';
  return 'done';
}

/**
 * Evalúa un intento reconstruido desde la bitácora. Nada se toma de un marcador del navegador:
 * un intento incompleto no vale y cada decisión correcta suma lo suyo.
 */
export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const complete = a.talked === true && a.ledger === true && countedAll(a) && decidedAll(a) &&
    isLotOrder(a.fridge) && adjustedAll(a) && a.reported === true && reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, breakdown: null };

  const removalHits = PRODUCTS.filter(p => a.decisions[p.id] === (p.remove ? 'retirar' : 'conservar')).length;
  const retiro = removalHits * 6;                                                     // 5 × 6 = 30

  let peps = 0;
  if (a.fridge.join() === BEST_ORDER.join()) peps = 20;
  else if (a.fridge[0] === BEST_ORDER[0]) peps = 10;                                  // al menos el urgente va al frente

  const deltaHits = SHELVES.filter(s => a.adjusted[s.id] === deltaOf(s)).length;
  const ajustes = deltaHits * 10;                                                     // 3 × 10 = 30

  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length;
  const misses = reasons.length - hits;
  const justificacion = Math.max(0, Math.min(10, hits * 5 - misses * 5));

  const research = 10;                                                                // habló, leyó el sistema y contó todo
  const score = Math.min(100, retiro + peps + ajustes + justificacion + research);
  return {
    valid: true, score, passed: score >= 70,
    breakdown: { retiro, peps, ajustes, justificacion, research, removalHits, deltaHits, hits, misses }
  };
}

/** Definición para el motor de misiones: cada acción declara cuándo procede (sin atajos). */
export const MARKET_INVENTORY_MISSION = {
  id: MISSION_ID,
  building: 'supermercado',
  title: 'Rescate de inventario',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newAttempt,
  evaluate,
  objectives: [
    { id: 'talk', text: 'Habla con don Ramiro, el gerente', done: s => s.talked },
    { id: 'ledger', text: 'Consulta el inventario del sistema en la oficina', done: s => s.ledger },
    { id: 'count', text: 'Cuenta los tres estantes', done: countedAll, detail: s => `${SHELVES.filter(x => s.counted[x.id]).length}/${SHELVES.length}` },
    { id: 'review', text: 'Decide qué hacer con los productos apartados', done: decidedAll, detail: s => `${PRODUCTS.filter(p => DECISIONS.includes(s.decisions[p.id])).length}/${PRODUCTS.length}` },
    { id: 'fridge', text: 'Acomoda los lotes del refrigerador (PEPS)', done: s => isLotOrder(s.fridge) },
    { id: 'adjust', text: 'Registra los ajustes en la terminal', done: adjustedAll, detail: s => `${SHELVES.filter(x => Number.isInteger(s.adjusted[x.id])).length}/${SHELVES.length}` },
    { id: 'report', text: 'Entrega tu reporte a don Ramiro', done: s => s.reported },
    { id: 'justify', text: 'Justifica tus decisiones', done: s => s.reasons.length > 0 }
  ],
  actions: {
    talk: { apply: s => { s.talked = true; } },
    readLedger: { when: s => s.talked, apply: s => { s.ledger = true; } },
    countShelf: { when: (s, p) => s.ledger && Boolean(shelfById(p.id)), apply: (s, p) => { s.counted[p.id] = true; } },
    inspect: { when: (s, p) => s.talked && Boolean(productById(p.id)), apply: (s, p) => { if (!s.inspected.includes(p.id)) s.inspected.push(p.id); } },
    decide: {
      when: (s, p) => s.inspected.includes(p.id) && DECISIONS.includes(p.action),
      apply: (s, p) => { s.decisions[p.id] = p.action; }
    },
    orderFridge: { when: (s, p) => s.counted.lacteos === true && isLotOrder(p.order), apply: (s, p) => { s.fridge = [...p.order]; } },
    adjust: { when: (s, p) => s.counted[p.id] === true && Number.isInteger(p.delta), apply: (s, p) => { s.adjusted[p.id] = p.delta; } },
    report: { when: s => nextStep(s) === 'report', apply: s => { s.reported = true; } },
    justify: {
      when: (s, p) => s.reported && Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.length <= 2 && p.reasons.every(id => REASONS.some(r => r.id === id)),
      apply: (s, p) => { s.reasons = [...new Set(p.reasons)]; }
    }
  }
};
