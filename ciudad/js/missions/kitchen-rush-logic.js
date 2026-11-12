// Misión 7 · Restaurante · "Cocina contra reloj" — reglas y calificación (módulo puro).
// Todo lo que decide el resultado vive aquí y este mismo archivo corre en el servidor.
//
// El caso: llega el servicio de la comida y el chef te pone al frente de tres comandas. Hay que
// leerlas, lavarse las manos, revisar la cadena fría (un refrigerador falla), preparar cada
// ingrediente en la tabla del color correcto, atender una alergia, cocinar a la temperatura
// interna segura, repartir las comandas entre estaciones y sacar el servicio.
//
// El reloj del servicio marca el ritmo en pantalla, pero la calificación premia las decisiones:
// el tiempo medido en el navegador no se puede validar en el servidor. Criterios generales de
// inocuidad alimentaria con fines educativos.

export const MISSION_ID = 'restaurante-cocina-contra-reloj';
export const CHEF = Object.freeze({ name: 'Chef Rosario', role: 'Jefa de cocina' });

export const ORDERS = Object.freeze([
  { id: 'c1', table: 'Mesa 4', dish: 'Ensalada con pollo a la parrilla', ingredients: ['pollo', 'lechuga'], station: 'parrilla', allergy: null },
  { id: 'c2', table: 'Mesa 2', dish: 'Tacos de pescado', ingredients: ['pescado', 'col'], station: 'plancha', allergy: null },
  { id: 'c3', table: 'Mesa 7', dish: 'Bowl de verduras y arroz', ingredients: ['verduras'], station: 'fria', allergy: 'cacahuate' }
]);
export const orderById = id => ORDERS.find(o => o.id === id) || null;

export const STATIONS = Object.freeze([
  { id: 'parrilla', name: 'Parrilla' }, { id: 'plancha', name: 'Plancha' }, { id: 'fria', name: 'Estación fría (limpia y separada)' }
]);

/** Refrigeradores: el B está fuera de temperatura (la cadena fría pide 4 °C o menos). */
export const FRIDGES = Object.freeze([
  { id: 'A', name: 'Refrigerador A · lácteos y verduras', temp: 3, ok: true },
  { id: 'B', name: 'Refrigerador B · carnes y pescados', temp: 9, ok: false }
]);
export const FRIDGE_ACTIONS = Object.freeze([
  { id: 'retirar', text: 'Retirar lo que estuvo en B, reportarlo y usar el lote del congelador', correct: true },
  { id: 'rapido', text: 'Usar primero lo de B para que no se desperdicie', correct: false },
  { id: 'cocer-mas', text: 'Usarlo, pero cocinarlo de más para compensar', correct: false }
]);

/** Código de color de tablas para evitar contaminación cruzada. */
export const BOARDS = Object.freeze([
  { id: 'roja', name: 'Roja · carne cruda', hex: 0xd9453f },
  { id: 'amarilla', name: 'Amarilla · aves crudas', hex: 0xf2b93b },
  { id: 'azul', name: 'Azul · pescados y mariscos', hex: 0x3a7bd5 },
  { id: 'verde', name: 'Verde · frutas y verduras', hex: 0x3fb27f },
  { id: 'blanca', name: 'Blanca · pan y lácteos', hex: 0xf4f4f4 }
]);
export const INGREDIENTS = Object.freeze([
  { id: 'pollo', name: 'Pechuga de pollo cruda', board: 'amarilla', cook: { min: 74, max: 82 } },
  { id: 'pescado', name: 'Filete de pescado crudo', board: 'azul', cook: { min: 63, max: 70 } },
  { id: 'lechuga', name: 'Lechuga', board: 'verde' },
  { id: 'col', name: 'Col morada', board: 'verde' },
  { id: 'verduras', name: 'Verduras para el bowl', board: 'verde' }
]);
export const ingredientById = id => INGREDIENTS.find(i => i.id === id) || null;
const ING_IDS = INGREDIENTS.map(i => i.id), COOKED = INGREDIENTS.filter(i => i.cook).map(i => i.id);

export const ALLERGY_OPTIONS = Object.freeze([
  { id: 'protocolo', text: 'Lavar y desinfectar estación y utensilios, revisar etiquetas y preparar aparte', correct: true },
  { id: 'quitar', text: 'Prepararlo normal y retirar los cacahuates al final', correct: false },
  { id: 'avisar', text: 'Avisar al cliente que no se puede garantizar nada y servirlo igual', correct: false }
]);

export const REASONS = Object.freeze([
  { id: 'cruzada', text: 'Separar tablas, utensilios y estaciones evita la contaminación cruzada', correct: true },
  { id: 'temperatura', text: 'La temperatura (cadena fría y cocción interna) es la que hace seguro un alimento', correct: true },
  { id: 'vista', text: 'Si un alimento se ve y huele bien, es seguro', correct: false },
  { id: 'rapidez', text: 'En hora pico la rapidez es más importante que los protocolos', correct: false },
  { id: 'alergia-poco', text: 'Una traza de alérgeno no hace daño', correct: false }
]);

export function newAttempt() {
  return { briefed: false, read: [], washed: false, prepsBeforeWash: 0, fridges: {}, fridgeAction: null, prep: {}, allergy: null, cooked: {}, stations: {}, served: false, reasons: [] };
}

const ORDER_IDS = ORDERS.map(o => o.id), FRIDGE_IDS = FRIDGES.map(f => f.id);
const fridgesDone = a => FRIDGE_IDS.every(id => typeof a.fridges[id] === 'boolean') && Boolean(a.fridgeAction);
const prepDone = a => ING_IDS.every(id => BOARDS.some(b => b.id === a.prep[id]));
const cookDone = a => COOKED.every(id => Number.isFinite(a.cooked[id]));
const stationsDone = a => ORDER_IDS.every(id => STATIONS.some(s => s.id === a.stations[id]));

export function nextStep(a) {
  if (!a.briefed) return 'brief';
  if (a.read.length < ORDER_IDS.length) return 'orders';
  if (!a.washed) return 'wash';
  if (!fridgesDone(a)) return 'fridges';
  if (!prepDone(a)) return 'prep';
  if (!a.allergy) return 'allergy';
  if (!cookDone(a)) return 'cook';
  if (!stationsDone(a)) return 'stations';
  if (!a.served) return 'serve';
  if (!a.reasons.length) return 'debrief';
  return 'done';
}

export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const complete = a.briefed && a.read.length === ORDER_IDS.length && a.washed && fridgesDone(a) && prepDone(a) && Boolean(a.allergy) &&
    cookDone(a) && stationsDone(a) && a.served === true && reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, breakdown: null };

  const higiene = a.prepsBeforeWash === 0 ? 8 : 0;                                                       // 8
  const fridgeHits = FRIDGES.filter(f => a.fridges[f.id] === f.ok).length;
  const cadena = fridgeHits * 5 + ((FRIDGE_ACTIONS.find(x => x.id === a.fridgeAction) || {}).correct ? 6 : 0); // 16
  const boardHits = INGREDIENTS.filter(i => a.prep[i.id] === i.board).length;
  const tablas = boardHits * 4;                                                                          // 20
  const alergia = (ALLERGY_OPTIONS.find(x => x.id === a.allergy) || {}).correct ? 14 : 0;                // 14
  const cookHits = INGREDIENTS.filter(i => i.cook && a.cooked[i.id] >= i.cook.min && a.cooked[i.id] <= i.cook.max).length;
  const coccion = cookHits * 6;                                                                          // 12
  const stationHits = ORDERS.filter(o => a.stations[o.id] === o.station).length;
  const estaciones = [0, 3, 6, 10][stationHits];                                                         // 10
  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length, misses = reasons.length - hits;
  const justificacion = Math.max(0, Math.min(10, hits * 5 - misses * 5));                                // 10
  const research = 10;                                                                                   // leyó las comandas y revisó los refrigeradores
  const score = Math.min(100, higiene + cadena + tablas + alergia + coccion + estaciones + justificacion + research);
  return { valid: true, score, passed: score >= 70,
    breakdown: { higiene, cadena, tablas, alergia, coccion, estaciones, justificacion, research, fridgeHits, boardHits, cookHits, stationHits, hits, misses } };
}

export const KITCHEN_RUSH_MISSION = {
  id: MISSION_ID,
  building: 'restaurante',
  title: 'Cocina contra reloj',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newAttempt,
  evaluate,
  objectives: [
    { id: 'brief', text: 'Recibe el servicio con la Chef Rosario', done: s => s.briefed },
    { id: 'orders', text: 'Lee las comandas del riel', done: s => s.read.length === ORDER_IDS.length, detail: s => `${s.read.length}/${ORDER_IDS.length}` },
    { id: 'wash', text: 'Lávate las manos', done: s => s.washed },
    { id: 'fridges', text: 'Revisa la temperatura de los refrigeradores', done: fridgesDone },
    { id: 'prep', text: 'Prepara cada ingrediente en su tabla', done: prepDone, detail: s => `${ING_IDS.filter(id => s.prep[id]).length}/${ING_IDS.length}` },
    { id: 'allergy', text: 'Atiende la alergia de la mesa 7', done: s => Boolean(s.allergy) },
    { id: 'cook', text: 'Cocina a la temperatura interna segura', done: cookDone, detail: s => `${COOKED.filter(id => Number.isFinite(s.cooked[id])).length}/${COOKED.length}` },
    { id: 'stations', text: 'Reparte las comandas entre estaciones', done: stationsDone },
    { id: 'serve', text: 'Saca el servicio por el pase', done: s => s.served },
    { id: 'debrief', text: 'Comenta el servicio con la chef', done: s => s.reasons.length > 0 }
  ],
  actions: {
    brief: { apply: s => { s.briefed = true; } },
    readOrder: { when: (s, p) => s.briefed && Boolean(orderById(p.id)), apply: (s, p) => { if (!s.read.includes(p.id)) s.read.push(p.id); } },
    wash: { when: s => s.briefed, apply: s => { s.washed = true; } },
    checkFridge: { when: (s, p) => s.briefed && FRIDGE_IDS.includes(p.id) && typeof p.ok === 'boolean', apply: (s, p) => { s.fridges[p.id] = p.ok; } },
    fridgeAction: { when: (s, p) => FRIDGE_IDS.every(id => typeof s.fridges[id] === 'boolean') && FRIDGE_ACTIONS.some(x => x.id === p.id), apply: (s, p) => { s.fridgeAction = p.id; } },
    prep: {
      when: (s, p) => fridgesDone(s) && s.read.length === ORDER_IDS.length && Boolean(ingredientById(p.id)) && BOARDS.some(b => b.id === p.board),
      apply: (s, p) => { if (!s.washed) s.prepsBeforeWash++; s.prep[p.id] = p.board; }
    },
    allergy: { when: (s, p) => prepDone(s) && ALLERGY_OPTIONS.some(x => x.id === p.id), apply: (s, p) => { s.allergy = p.id; } },
    cook: {
      when: (s, p) => Boolean(s.allergy) && COOKED.includes(p.id) && Number.isFinite(p.temp) && p.temp >= 40 && p.temp <= 100,
      apply: (s, p) => { s.cooked[p.id] = Math.round(p.temp); }
    },
    assign: { when: (s, p) => cookDone(s) && Boolean(orderById(p.id)) && STATIONS.some(x => x.id === p.station), apply: (s, p) => { s.stations[p.id] = p.station; } },
    serve: { when: s => nextStep(s) === 'serve', apply: s => { s.served = true; } },
    debrief: {
      when: (s, p) => s.served && Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.length <= 2 && p.reasons.every(id => REASONS.some(r => r.id === id)),
      apply: (s, p) => { s.reasons = [...new Set(p.reasons)]; }
    }
  }
};
