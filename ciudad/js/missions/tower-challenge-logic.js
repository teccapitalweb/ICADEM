// Misión 10 · Torre ICADEM · "Desafío de equipos" — reglas y calificación (módulo puro).
// Todo lo que decide el resultado vive aquí y este mismo archivo corre en el servidor.
//
// El caso: el consejo de la ciudad pide un plan para abrir un centro comunitario. Cuatro
// estaciones de especialidad (finanzas, legal, operaciones y comunicación) arman cada una su
// parte; después el equipo revisa el plan integrado en el tablero central (cualquiera puede
// pedir que se rehaga una parte), lo aprueba y lo presenta.
//
// Se juega solo (una persona pasa por las cuatro estaciones) o en equipo de 2 a 4 personas.
// En equipo, el servidor guarda el intento, hace cumplir los roles (cada estación la resuelve
// quien tiene ese rol) y exige la aprobación de todos antes de presentar.

export const MISSION_ID = 'torre-desafio-equipos';
export const COACH = Object.freeze({ name: 'Mtra. Elena', role: 'Coordinadora de retos' });

export const STATIONS = Object.freeze([
  { id: 'budget', role: 'finanzas', name: 'Finanzas · Presupuesto', color: 0x2f9e8f },
  { id: 'permits', role: 'legal', name: 'Legal · Permisos', color: 0x3a5fc4 },
  { id: 'schedule', role: 'operaciones', name: 'Operaciones · Calendario', color: 0xf28c28 },
  { id: 'message', role: 'comunicacion', name: 'Comunicación · Aviso a vecinos', color: 0xd9456f }
]);
export const stationById = id => STATIONS.find(s => s.id === id) || null;
const STATION_IDS = STATIONS.map(s => s.id);

/* Finanzas: el presupuesto autorizado y los costos (miles de pesos). */
export const BUDGET = Object.freeze({ limit: 900, minContingency: 5, items: [['Obra y adecuaciones', 520], ['Mobiliario', 140], ['Señalización', 30]],
  computers: [{ id: 'nuevo', name: 'Equipo de cómputo nuevo', cost: 160 }, { id: 'reacondicionado', name: 'Equipo reacondicionado con garantía', cost: 90 }] });
export function budgetTotal(computers, contingency) {
  const pc = BUDGET.computers.find(c => c.id === computers);
  if (!pc || !Number.isFinite(contingency)) return null;
  const base = BUDGET.items.reduce((s, [, v]) => s + v, 0) + pc.cost;
  return Math.round(base * (1 + contingency / 100) * 10) / 10;
}

/* Legal: trámites para abrir un centro comunitario. */
export const PERMITS = Object.freeze([
  { id: 'uso-suelo', name: 'Constancia de uso de suelo', needed: true },
  { id: 'construccion', name: 'Licencia de construcción', needed: true },
  { id: 'proteccion-civil', name: 'Dictamen de protección civil', needed: true },
  { id: 'alcohol', name: 'Permiso de venta de bebidas alcohólicas', needed: false },
  { id: 'marca', name: 'Registro de marca', needed: false },
  { id: 'conducir', name: 'Licencia de conducir del director', needed: false }
]);

/* Operaciones: tareas con dependencias (el orden correcto es único). */
export const TASKS = Object.freeze([
  { id: 'tramites', name: 'Tramitar permisos', rank: 1 },
  { id: 'cimentacion', name: 'Cimentación', rank: 2 },
  { id: 'estructura', name: 'Estructura y muros', rank: 3 },
  { id: 'instalaciones', name: 'Instalaciones eléctricas e hidráulicas', rank: 4 },
  { id: 'mobiliario', name: 'Mobiliario y equipo', rank: 5 }
]);
export const TASK_ORDER = Object.freeze([...TASKS].sort((a, b) => a.rank - b.rank).map(t => t.id));

/* Comunicación: el aviso a los vecinos y por dónde se da. */
export const MESSAGES = Object.freeze([
  { id: 'claro', text: 'Habrá obra de lunes a viernes de 8 a 17 h durante 4 meses. Cerraremos medio carril la primera semana. Dudas: módulo de atención en la plaza.', correct: true },
  { id: 'vago', text: '¡Se viene algo grande para la colonia! Pronto les contamos más.', correct: false },
  { id: 'tecnico', text: 'Se ejecutarán trabajos conforme a la licencia LC-2311 con afectación vial parcial según dictamen.', correct: false }
]);
export const CHANNELS = Object.freeze([
  { id: 'asamblea', name: 'Asamblea vecinal informativa', good: true },
  { id: 'carteles', name: 'Carteles en la colonia y en la obra', good: true },
  { id: 'ninguno', name: 'No avisar para evitar quejas', good: false },
  { id: 'rumor', name: 'Que se enteren por los trabajadores', good: false }
]);

export const REASONS = Object.freeze([
  { id: 'especialidad', text: 'Cada quien aporta su especialidad y revisa el trabajo de los demás', correct: true },
  { id: 'dependencias', text: 'Las decisiones de un área afectan a las otras: el plan se revisa completo', correct: true },
  { id: 'jefe', text: 'Es más rápido que una sola persona decida todo', correct: false },
  { id: 'silencio', text: 'Si veo un error en la parte de otro, mejor no digo nada', correct: false }
]);

export function newAttempt() {
  return { briefed: false, budget: null, permits: null, schedule: null, message: null, approvals: [], reopened: 0, presented: false, reasons: [] };
}

const stationsDone = s => STATION_IDS.every(id => s[id]);
const ROLE_RE = /^[a-z]{3,16}$/;

export function nextStep(a) {
  if (!a.briefed) return 'brief';
  if (!stationsDone(a)) return 'stations';
  if (!a.approvals.length) return 'review';
  if (!a.presented) return 'present';
  return 'done';
}

export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const complete = a.briefed && stationsDone(a) && a.approvals.length > 0 && a.presented && reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, breakdown: null };

  const total = budgetTotal(a.budget.computers, a.budget.contingency);
  const presupuesto = total > BUDGET.limit ? 0 : a.budget.contingency >= BUDGET.minContingency ? 20 : 8;     // 20
  const okPermits = a.permits.filter(id => (PERMITS.find(p => p.id === id) || {}).needed).length, badPermits = a.permits.length - okPermits;
  const permisos = Math.max(0, Math.min(20, okPermits * 7 - badPermits * 7));                                 // 20
  let pairs = 0; for (let i = 0; i + 1 < TASK_ORDER.length; i++) if (a.schedule.indexOf(TASK_ORDER[i]) + 1 === a.schedule.indexOf(TASK_ORDER[i + 1])) pairs++;
  const calendario = pairs * 5;                                                                              // 20
  const msgOk = (MESSAGES.find(m => m.id === a.message.text) || {}).correct;
  const goodCh = a.message.channels.filter(id => (CHANNELS.find(c => c.id === id) || {}).good).length, badCh = a.message.channels.length - goodCh;
  const comunicacion = (msgOk ? 10 : 0) + Math.max(0, goodCh * 5 - badCh * 5);                               // 20
  const coordinacion = 10;                                                                                   // revisaron y aprobaron el plan integrado
  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length, misses = reasons.length - hits;
  const justificacion = Math.max(0, Math.min(10, hits * 5 - misses * 5));                                   // 10
  const score = Math.min(100, presupuesto + permisos + calendario + comunicacion + coordinacion + justificacion);
  return { valid: true, score, passed: score >= 70,
    breakdown: { presupuesto, permisos, calendario, comunicacion, coordinacion, justificacion, total, okPermits, badPermits, pairs, goodCh, badCh, hits, misses, approvals: a.approvals.length, reopened: a.reopened } };
}

export const TOWER_CHALLENGE_MISSION = {
  id: MISSION_ID,
  building: 'torre',
  title: 'Desafío de equipos',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newAttempt,
  evaluate,
  objectives: [
    { id: 'brief', text: 'Recibe el reto con la Mtra. Elena', done: s => s.briefed },
    { id: 'stations', text: 'Resuelve las cuatro estaciones', done: stationsDone, detail: s => `${STATION_IDS.filter(id => s[id]).length}/${STATION_IDS.length}` },
    { id: 'review', text: 'Revisa y aprueba el plan en el tablero', done: s => s.approvals.length > 0 },
    { id: 'present', text: 'Presenta el plan al consejo', done: s => s.presented }
  ],
  actions: {
    brief: { apply: s => { s.briefed = true; } },
    budget: {
      when: (s, p) => s.briefed && !s.budget && budgetTotal(p.computers, p.contingency) !== null && p.contingency >= 0 && p.contingency <= 15,
      apply: (s, p) => { s.budget = { computers: p.computers, contingency: Math.round(p.contingency) }; }
    },
    permits: {
      when: (s, p) => s.briefed && !s.permits && Array.isArray(p.ids) && p.ids.length >= 1 && p.ids.length <= 4 && new Set(p.ids).size === p.ids.length && p.ids.every(id => PERMITS.some(x => x.id === id)),
      apply: (s, p) => { s.permits = [...p.ids]; }
    },
    schedule: {
      when: (s, p) => s.briefed && !s.schedule && Array.isArray(p.ids) && p.ids.length === TASKS.length && new Set(p.ids).size === TASKS.length && p.ids.every(id => TASKS.some(t => t.id === id)),
      apply: (s, p) => { s.schedule = [...p.ids]; }
    },
    message: {
      when: (s, p) => s.briefed && !s.message && MESSAGES.some(m => m.id === p.text) && Array.isArray(p.channels) && p.channels.length >= 1 && p.channels.length <= 2 && new Set(p.channels).size === p.channels.length && p.channels.every(id => CHANNELS.some(c => c.id === id)),
      apply: (s, p) => { s.message = { text: p.text, channels: [...p.channels] }; }
    },
    // Revisión cruzada: cualquiera puede pedir que se rehaga una estación antes de presentar.
    reopen: { when: (s, p) => stationsDone(s) && !s.presented && STATION_IDS.includes(p.id) && s.reopened < 4, apply: (s, p) => { s[p.id] = null; s.approvals = []; s.reopened++; } },
    approve: { when: (s, p) => stationsDone(s) && !s.presented && typeof p.role === 'string' && ROLE_RE.test(p.role), apply: (s, p) => { if (!s.approvals.includes(p.role)) s.approvals.push(p.role); } },
    present: {
      when: (s, p) => s.approvals.length > 0 && !s.presented && Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.length <= 2 && p.reasons.every(id => REASONS.some(r => r.id === id)),
      apply: (s, p) => { s.presented = true; s.reasons = [...new Set(p.reasons)]; }
    }
  }
};
