// Misión 8 · Invernadero · "Cultivo inteligente" — reglas y calificación (módulo puro).
// Todo lo que decide el resultado vive aquí y este mismo archivo corre en el servidor.
//
// El caso: un invernadero de jitomate en fructificación. El agrónomo te deja a cargo del turno:
// consultar la ficha del cultivo, leer los sensores, diagnosticar cada lectura, ajustar el clima
// (ventilas y malla sombra), corregir la solución nutritiva (CE y pH), regar por zona según la
// humedad del sustrato y decidir el manejo integrado de plagas a partir de las trampas.
//
// Los ajustes de clima y nutrición se califican con el mismo modelo que el jugador ve en pantalla
// (projectClimate / projectSolution): el servidor recalcula el resultado con los valores elegidos.
// Valores de referencia simplificados con fines educativos.

export const MISSION_ID = 'invernadero-cultivo-inteligente';
export const AGRONOMIST = Object.freeze({ name: 'Ing. Tomás', role: 'Agrónomo' });

/** Ficha del cultivo: rangos objetivo (jitomate en fructificación). */
export const CHART = Object.freeze({
  temp: { name: 'Temperatura del aire', unit: '°C', min: 20, max: 26 },
  hr: { name: 'Humedad relativa', unit: '%', min: 60, max: 80 },
  ce: { name: 'Conductividad (CE) de la solución', unit: 'mS/cm', min: 2.0, max: 3.0 },
  ph: { name: 'pH de la solución', unit: '', min: 5.5, max: 6.5 },
  soil: { name: 'Humedad del sustrato', unit: '%', min: 35, max: 60 },
  light: { name: 'Luz que pasa la malla', unit: '%', min: 50, max: 100 }
});
export const THRESHOLDS = Object.freeze({ moscaBlanca: 20, trips: 10 });

/** Sensores del invernadero y su lectura actual. */
export const SENSORS = Object.freeze([
  { id: 'temp', value: 31, level: 'alto' },
  { id: 'hr', value: 88, level: 'alto' },
  { id: 'ce', value: 1.2, level: 'bajo' },
  { id: 'ph', value: 6.0, level: 'ok' }
]);
export const LEVELS = Object.freeze([{ id: 'bajo', name: 'Bajo' }, { id: 'ok', name: 'En rango' }, { id: 'alto', name: 'Alto' }]);
export const sensorById = id => SENSORS.find(s => s.id === id) || null;

/** Modelo de clima: ventilas (0–100 %) y malla sombra (0–80 %). */
export function projectClimate(vent, shade) {
  const temp = Math.round((31 - 0.07 * vent - 0.06 * shade) * 10) / 10;
  const hr = Math.round(88 - 0.3 * vent);
  const light = 100 - shade;
  return { temp, hr, light };
}
/** Modelo de la solución: litros de concentrado nutritivo (0–20) y mL de ácido (0–40). */
export function projectSolution(nutrient, acid) {
  const ce = Math.round((1.2 + 0.1 * nutrient) * 100) / 100;
  const ph = Math.round((6.0 + 0.03 * nutrient - 0.04 * acid) * 100) / 100;
  return { ce, ph };
}
const inRange = (v, r) => v >= r.min && v <= r.max;

/** Camas de cultivo con su sensor de humedad de sustrato. */
export const BEDS = Object.freeze([
  { id: 'A', soil: 18, correct: 'regar' },
  { id: 'B', soil: 46, correct: 'mantener' },
  { id: 'C', soil: 74, correct: 'suspender' }
]);
export const IRRIGATION = Object.freeze([
  { id: 'regar', name: 'Regar' }, { id: 'mantener', name: 'Mantener el programa' }, { id: 'suspender', name: 'Suspender el riego y revisar el drenaje' }
]);

/** Trampas cromáticas amarillas (insectos atrapados en la semana). */
export const TRAPS = Object.freeze([
  { id: 'T1', bed: 'A', moscaBlanca: 4, trips: 2 },
  { id: 'T2', bed: 'B', moscaBlanca: 28, trips: 3 },
  { id: 'T3', bed: 'C', moscaBlanca: 6, trips: 1 }
]);
export const PEST_ACTIONS = Object.freeze([
  { id: 'biologico', text: 'Liberar enemigos naturales (Encarsia) en esa zona y retirar las hojas más afectadas', correct: true },
  { id: 'fumigar-todo', text: 'Fumigar todo el invernadero con insecticida, por si acaso', correct: false },
  { id: 'esperar', text: 'No hacer nada hasta ver daño en los frutos', correct: false }
]);
export const PEST_ZONE = 'B';

export const REASONS = Object.freeze([
  { id: 'medir', text: 'Las decisiones se toman con lecturas de sensores y la ficha del cultivo, no a ojo', correct: true },
  { id: 'umbral', text: 'En el manejo integrado se actúa al superar un umbral y con la medida menos dañina', correct: true },
  { id: 'mas-agua', text: 'Regar más siempre es mejor para la planta', correct: false },
  { id: 'mas-fertilizante', text: 'Entre más fertilizante, más producción', correct: false },
  { id: 'fumigar', text: 'Fumigar de forma preventiva evita cualquier plaga', correct: false }
]);

export function newAttempt() {
  return { briefed: false, chart: false, read: [], diagnosis: {}, climate: null, solution: null, irrigation: {}, traps: [], pest: null, reasons: [] };
}

const SENSOR_IDS = SENSORS.map(s => s.id), BED_IDS = BEDS.map(b => b.id), TRAP_IDS = TRAPS.map(t => t.id);
const diagDone = a => SENSOR_IDS.every(id => LEVELS.some(l => l.id === a.diagnosis[id]));
const irrDone = a => BED_IDS.every(id => IRRIGATION.some(x => x.id === a.irrigation[id]));
const num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

export function nextStep(a) {
  if (!a.briefed) return 'brief';
  if (!a.chart) return 'chart';
  if (!diagDone(a)) return 'sensors';
  if (!a.climate) return 'climate';
  if (!a.solution) return 'solution';
  if (!irrDone(a)) return 'irrigation';
  if (a.traps.length < TRAP_IDS.length) return 'traps';
  if (!a.pest) return 'pest';
  if (!a.reasons.length) return 'debrief';
  return 'done';
}

export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const complete = a.briefed && a.chart && diagDone(a) && Boolean(a.climate) && Boolean(a.solution) && irrDone(a) &&
    a.traps.length === TRAP_IDS.length && Boolean(a.pest) && reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, breakdown: null };

  const diagHits = SENSORS.filter(s => a.diagnosis[s.id] === s.level).length;
  const diagnostico = diagHits * 5;                                                                  // 20
  const c = projectClimate(a.climate.vent, a.climate.shade);
  const clima = (inRange(c.temp, CHART.temp) ? 8 : 0) + (inRange(c.hr, CHART.hr) ? 8 : 0) + (inRange(c.light, CHART.light) ? 4 : 0); // 20
  const s = projectSolution(a.solution.nutrient, a.solution.acid);
  const nutricion = (inRange(s.ce, CHART.ce) ? 8 : 0) + (inRange(s.ph, CHART.ph) ? 4 : 0);           // 12
  const bedHits = BEDS.filter(b => a.irrigation[b.id] === b.correct).length;
  const riego = bedHits * 6;                                                                          // 18
  const mip = (a.pest.zone === PEST_ZONE ? 8 : 0) + ((PEST_ACTIONS.find(x => x.id === a.pest.action) || {}).correct ? 12 : 0); // 20
  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length, misses = reasons.length - hits;
  const justificacion = Math.max(0, Math.min(10, hits * 5 - misses * 5));                            // 10
  const score = Math.min(100, diagnostico + clima + nutricion + riego + mip + justificacion);
  return { valid: true, score, passed: score >= 70,
    breakdown: { diagnostico, clima, nutricion, riego, mip, justificacion, diagHits, bedHits, climate: c, solution: s, hits, misses } };
}

export const GREENHOUSE_MISSION = {
  id: MISSION_ID,
  building: 'invernadero',
  title: 'Cultivo inteligente',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newAttempt,
  evaluate,
  objectives: [
    { id: 'brief', text: 'Recibe el turno con el Ing. Tomás', done: s => s.briefed },
    { id: 'chart', text: 'Consulta la ficha del cultivo', done: s => s.chart },
    { id: 'sensors', text: 'Lee y diagnostica los sensores', done: diagDone, detail: s => `${SENSOR_IDS.filter(id => s.diagnosis[id]).length}/${SENSOR_IDS.length}` },
    { id: 'climate', text: 'Ajusta ventilas y malla sombra', done: s => Boolean(s.climate) },
    { id: 'solution', text: 'Corrige la solución nutritiva', done: s => Boolean(s.solution) },
    { id: 'irrigation', text: 'Decide el riego de cada cama', done: irrDone, detail: s => `${BED_IDS.filter(id => s.irrigation[id]).length}/${BED_IDS.length}` },
    { id: 'traps', text: 'Revisa las trampas amarillas', done: s => s.traps.length === TRAP_IDS.length, detail: s => `${s.traps.length}/${TRAP_IDS.length}` },
    { id: 'pest', text: 'Decide el manejo de la plaga', done: s => Boolean(s.pest) },
    { id: 'debrief', text: 'Comenta el turno con el agrónomo', done: s => s.reasons.length > 0 }
  ],
  actions: {
    brief: { apply: s => { s.briefed = true; } },
    readChart: { when: s => s.briefed, apply: s => { s.chart = true; } },
    readSensor: { when: (s, p) => s.chart && SENSOR_IDS.includes(p.id), apply: (s, p) => { if (!s.read.includes(p.id)) s.read.push(p.id); } },
    diagnose: { when: (s, p) => s.read.includes(p.id) && LEVELS.some(l => l.id === p.level), apply: (s, p) => { s.diagnosis[p.id] = p.level; } },
    climate: { when: (s, p) => diagDone(s) && num(p.vent, 0, 100) && num(p.shade, 0, 80), apply: (s, p) => { s.climate = { vent: Math.round(p.vent), shade: Math.round(p.shade) }; } },
    solution: { when: (s, p) => Boolean(s.climate) && num(p.nutrient, 0, 20) && num(p.acid, 0, 40), apply: (s, p) => { s.solution = { nutrient: Math.round(p.nutrient * 10) / 10, acid: Math.round(p.acid) }; } },
    irrigate: { when: (s, p) => Boolean(s.solution) && BED_IDS.includes(p.id) && IRRIGATION.some(x => x.id === p.action), apply: (s, p) => { s.irrigation[p.id] = p.action; } },
    inspectTrap: { when: (s, p) => irrDone(s) && TRAP_IDS.includes(p.id), apply: (s, p) => { if (!s.traps.includes(p.id)) s.traps.push(p.id); } },
    pest: {
      when: (s, p) => s.traps.length === TRAP_IDS.length && BED_IDS.includes(p.zone) && PEST_ACTIONS.some(x => x.id === p.action),
      apply: (s, p) => { s.pest = { zone: p.zone, action: p.action }; }
    },
    debrief: {
      when: (s, p) => Boolean(s.pest) && Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.length <= 2 && p.reasons.every(id => REASONS.some(r => r.id === id)),
      apply: (s, p) => { s.reasons = [...new Set(p.reasons)]; }
    }
  }
};
