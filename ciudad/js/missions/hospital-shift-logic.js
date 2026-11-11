// Misión 5 · Hospital ICADEM · "Turno de decisiones" — reglas y calificación (módulo puro).
// Igual que los otros juegos: todo lo que decide el resultado vive aquí y este mismo archivo
// corre en el servidor antes de acreditar la recompensa.
//
// El caso: el jugador entra al turno de urgencias como parte del equipo de enfermería. Recibe
// el turno, revisa a cuatro pacientes FICTICIOS (entrevista, monitor y expediente), marca los
// signos de alarma, les asigna color de triaje, los ordena por prioridad, decide la acción y si
// hace falta pedir apoyo al médico, registra todo en la bitácora y entrega el turno.
//
// Contenido educativo con conceptos generales de triaje (colores rojo, amarillo y verde; signos
// de alarma). No incluye dosis ni tratamientos y no sustituye la capacitación clínica formal.

export const MISSION_ID = 'hospital-turno-decisiones';

export const HEAD_NURSE = Object.freeze({ name: 'Enf. Lupita', role: 'Jefa de enfermería del turno' });
export const DOCTOR = Object.freeze({ name: 'Dr. Salas', role: 'Médico de urgencias' });

/** Colores de triaje: rojo (atención inmediata), amarillo (urgente, pronto), verde (puede esperar). */
export const TRIAGE = Object.freeze([
  { id: 'rojo', name: 'Rojo', text: 'Atención inmediata', rank: 0, hex: 0xe5484d },
  { id: 'amarillo', name: 'Amarillo', text: 'Urgente: atención pronta y vigilancia', rank: 1, hex: 0xf2b93b },
  { id: 'verde', name: 'Verde', text: 'Puede esperar su turno', rank: 2, hex: 0x3fb27f }
]);
const triageById = id => TRIAGE.find(t => t.id === id) || null;

/**
 * Los cuatro pacientes. Cada uno tiene lo que dice (entrevista), su monitor, su expediente,
 * los hallazgos que el jugador puede marcar como alarma (algunos sí lo son y otros no), su color
 * correcto, la acción correcta entre tres y si hay que pedir apoyo al médico de inmediato.
 */
export const PATIENTS = Object.freeze([
  { id: 'aurelio', name: 'Don Aurelio', age: 62, bed: 'Urgencias 1', triage: 'rojo', support: true,
    says: ['Me aprieta el pecho desde hace media hora… como si me sentaran encima.', 'Se me va hacia el brazo izquierdo y estoy sudando frío.'],
    vitals: { fc: 112, ta: '150/95', fr: 22, sat: 94, temp: 36.6 },
    chart: [['Antecedentes', 'Hipertensión; fumador por 30 años'], ['Motivo de consulta', 'Dolor en el pecho de inicio súbito'], ['Llegó', 'Caminando, acompañado por su hija']],
    findings: [
      { id: 'dolor-opresivo', text: 'Dolor opresivo en el pecho que se extiende al brazo', alarm: true },
      { id: 'sudoracion', text: 'Sudoración fría', alarm: true },
      { id: 'acompanado', text: 'Llegó caminando y acompañado', alarm: false },
      { id: 'temp-normal', text: 'Temperatura de 36.6 °C', alarm: false }
    ],
    actions: [
      { id: 'urg-aurelio', text: 'Pasarlo de inmediato a urgencias con monitoreo continuo y avisar al médico', correct: true },
      { id: 'sala-aurelio', text: 'Que espere en la sala hasta que se desocupe un consultorio', correct: false },
      { id: 'casa-aurelio', text: 'Recomendarle reposo en casa y volver si sigue el dolor', correct: false }
    ] },
  { id: 'celia', name: 'Doña Celia', age: 78, bed: 'Urgencias 2', triage: 'rojo', support: true,
    says: ['(Su nieto responde) Hace una hora empezó a hablar raro y no puede levantar bien el brazo derecho.', '(Doña Celia) Me siento… rara. No me salen las palabras.'],
    vitals: { fc: 88, ta: '178/100', fr: 18, sat: 96, temp: 36.4 },
    chart: [['Antecedentes', 'Diabetes; hipertensión'], ['Motivo de consulta', 'Cambio súbito al hablar y debilidad de un brazo'], ['Inicio', 'Hace 1 hora (el nieto sabe la hora exacta)']],
    findings: [
      { id: 'habla', text: 'Dificultad súbita para hablar', alarm: true },
      { id: 'debilidad', text: 'Debilidad de un brazo de inicio súbito', alarm: true },
      { id: 'edad', text: 'Tiene 78 años', alarm: false },
      { id: 'sat-normal', text: 'Saturación de oxígeno de 96 %', alarm: false }
    ],
    actions: [
      { id: 'urg-celia', text: 'Pasarla de inmediato a urgencias, anotar la hora de inicio y avisar al médico', correct: true },
      { id: 'obs-celia', text: 'Dejarla en observación a ver si mejora sola en unas horas', correct: false },
      { id: 'agua-celia', text: 'Darle agua y algo dulce por si es la azúcar, y esperar', correct: false }
    ] },
  { id: 'joaquin', name: 'Joaquín', age: 7, bed: 'Observación', triage: 'amarillo', support: false,
    says: ['(Su mamá) Tiene fiebre desde ayer y hoy come poco.', '(Joaquín) Me duele la cabeza… pero sí quiero ver caricaturas.'],
    vitals: { fc: 118, ta: '100/65', fr: 24, sat: 98, temp: 39.2 },
    chart: [['Antecedentes', 'Sin enfermedades previas; vacunas al día'], ['Motivo de consulta', 'Fiebre de dos días'], ['Hidratación', 'Orina normal según su mamá; toma líquidos']],
    findings: [
      { id: 'fiebre-alta', text: 'Fiebre de 39.2 °C', alarm: true },
      { id: 'responde', text: 'Está despierto, responde y juega', alarm: false },
      { id: 'liquidos', text: 'Toma líquidos y orina normal', alarm: false },
      { id: 'cabeza', text: 'Dolor de cabeza leve con la fiebre', alarm: false }
    ],
    actions: [
      { id: 'obs-joaquin', text: 'Observación con vigilancia de signos y valoración médica pronta', correct: true },
      { id: 'choque-joaquin', text: 'Activar a todo el equipo de urgencias de inmediato', correct: false },
      { id: 'casa-joaquin', text: 'Mandarlo a casa sin valoración porque se ve bien', correct: false }
    ] },
  { id: 'mariana', name: 'Mariana', age: 24, bed: 'Consultorio 2', triage: 'verde', support: false,
    says: ['Me doblé el tobillo bajando una banqueta jugando fut.', 'Me duele, pero sí puedo apoyar y caminar.'],
    vitals: { fc: 84, ta: '118/76', fr: 16, sat: 99, temp: 36.5 },
    chart: [['Antecedentes', 'Sana'], ['Motivo de consulta', 'Torcedura de tobillo hace 2 horas'], ['Exploración rápida', 'Inflamación leve; mueve los dedos; buena coloración']],
    findings: [
      { id: 'inflamacion', text: 'Inflamación leve del tobillo', alarm: false },
      { id: 'camina', text: 'Puede apoyar y caminar', alarm: false },
      { id: 'dedos', text: 'Mueve los dedos y tiene buena coloración', alarm: false },
      { id: 'dolor-tobillo', text: 'Dolor al mover el tobillo', alarm: false }
    ],
    actions: [
      { id: 'cons-mariana', text: 'Consultorio en su turno, para valoración médica de la torcedura', correct: true },
      { id: 'urg-mariana', text: 'Pasarla antes que todos a urgencias', correct: false },
      { id: 'alta-mariana', text: 'Darla de alta sin que la vea nadie', correct: false }
    ] }
]);
export const patientById = id => PATIENTS.find(p => p.id === id) || null;
const PATIENT_IDS = PATIENTS.map(p => p.id);
export const REVIEWS = Object.freeze(['talk', 'monitor', 'chart']);

export const REASONS = Object.freeze([
  { id: 'gravedad', text: 'Se atiende primero a quien está más grave, no a quien llegó primero', correct: true },
  { id: 'apoyo', text: 'Ante signos de alarma se pide apoyo de inmediato: no se espera a que empeore', correct: true },
  { id: 'llegada', text: 'El orden de llegada es lo más justo para decidir quién pasa', correct: false },
  { id: 'queja', text: 'Quien más se queja es quien está más grave', correct: false },
  { id: 'edad', text: 'Las personas mayores siempre pasan primero, sin importar los síntomas', correct: false }
]);

export function newAttempt() {
  return { shift: false, board: false, reviewed: {}, flags: {}, triage: {}, order: null, plan: {}, recorded: false, handover: false, reasons: [] };
}

const reviewedAll = (a, id) => REVIEWS.every(r => (a.reviewed[id] || []).includes(r));
const assessedAll = a => PATIENT_IDS.every(id => Boolean(triageById(a.triage[id])));
const isOrder = order => Array.isArray(order) && order.length === PATIENT_IDS.length && [...order].sort().join() === [...PATIENT_IDS].sort().join();
const plannedAll = a => PATIENT_IDS.every(id => a.plan[id] && typeof a.plan[id].action === 'string' && typeof a.plan[id].support === 'boolean');
const isAction = (pid, id) => Boolean(patientById(pid) && patientById(pid).actions.some(x => x.id === id));
const isFinding = (pid, id) => Boolean(patientById(pid) && patientById(pid).findings.some(f => f.id === id));

export function nextStep(a) {
  if (!a.shift) return 'shift';
  if (!a.board) return 'board';
  if (!PATIENT_IDS.every(id => reviewedAll(a, id))) return 'review';
  if (!assessedAll(a)) return 'triage';
  if (!isOrder(a.order)) return 'order';
  if (!plannedAll(a)) return 'act';
  if (!a.recorded) return 'record';
  if (!a.handover) return 'handover';
  return 'done';
}

/** El orden correcto agrupa por gravedad: primero los rojos (en cualquier orden), luego amarillo y verde. */
export function orderScore(order) {
  if (!isOrder(order)) return 0;
  const ranks = order.map(id => triageById(patientById(id).triage).rank);
  let inversions = 0;
  for (let i = 0; i < ranks.length; i++) for (let j = i + 1; j < ranks.length; j++) if (ranks[i] > ranks[j]) inversions++;
  return inversions === 0 ? 12 : inversions === 1 ? 6 : 0;
}

export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const complete = a.shift && a.board && PATIENT_IDS.every(id => reviewedAll(a, id)) && assessedAll(a) && isOrder(a.order) &&
    plannedAll(a) && a.recorded === true && a.handover === true && reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, breakdown: null };

  const triageHits = PATIENTS.filter(p => a.triage[p.id] === p.triage).length;
  const triaje = triageHits * 6;                                                              // 4 × 6 = 24

  // Signos de alarma: por paciente, 4 puntos si marcó exactamente los de alarma; 2 si le faltó o sobró uno.
  let alarmas = 0, alarmPerfect = 0;
  for (const p of PATIENTS) {
    const marked = new Set(a.flags[p.id] || []), real = new Set(p.findings.filter(f => f.alarm).map(f => f.id));
    const errors = [...marked].filter(id => !real.has(id)).length + [...real].filter(id => !marked.has(id)).length;
    if (errors === 0) { alarmas += 4; alarmPerfect++; } else if (errors === 1) alarmas += 2;
  }                                                                                          // 4 × 4 = 16

  const orden = orderScore(a.order);                                                         // 12

  const actionHits = PATIENTS.filter(p => (p.actions.find(x => x.id === a.plan[p.id].action) || {}).correct === true).length;
  const acciones = actionHits * 5;                                                           // 4 × 5 = 20

  const supportHits = PATIENTS.filter(p => a.plan[p.id].support === p.support).length;
  const apoyo = supportHits * 2;                                                             // 4 × 2 = 8

  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length;
  const misses = reasons.length - hits;
  const justificacion = Math.max(0, Math.min(10, hits * 5 - misses * 5));                     // 10

  const research = 10;                                                                       // revisó a todos y registró
  const score = Math.min(100, triaje + alarmas + orden + acciones + apoyo + justificacion + research);
  return {
    valid: true, score, passed: score >= 70,
    breakdown: { triaje, alarmas, orden, acciones, apoyo, justificacion, research, triageHits, alarmPerfect, actionHits, supportHits, hits, misses }
  };
}

export const HOSPITAL_SHIFT_MISSION = {
  id: MISSION_ID,
  building: 'hospital',
  title: 'Turno de decisiones',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newAttempt,
  evaluate,
  objectives: [
    { id: 'shift', text: 'Recibe el turno con la jefa de enfermería', done: s => s.shift },
    { id: 'board', text: 'Consulta el pizarrón de pacientes', done: s => s.board },
    { id: 'review', text: 'Revisa a cada paciente: entrevista, monitor y expediente', done: s => PATIENT_IDS.every(id => reviewedAll(s, id)), detail: s => `${PATIENT_IDS.filter(id => reviewedAll(s, id)).length}/${PATIENT_IDS.length}` },
    { id: 'triage', text: 'Marca signos de alarma y asigna color de triaje', done: assessedAll, detail: s => `${PATIENT_IDS.filter(id => triageById(s.triage[id])).length}/${PATIENT_IDS.length}` },
    { id: 'order', text: 'Ordena a los pacientes por prioridad en el pizarrón', done: s => isOrder(s.order) },
    { id: 'act', text: 'Decide la acción de cada paciente y si pides apoyo', done: plannedAll, detail: s => `${PATIENT_IDS.filter(id => s.plan[id]).length}/${PATIENT_IDS.length}` },
    { id: 'record', text: 'Registra tus decisiones en la bitácora', done: s => s.recorded },
    { id: 'handover', text: 'Entrega el turno a la jefa de enfermería', done: s => s.handover }
  ],
  actions: {
    shift: { apply: s => { s.shift = true; } },
    readBoard: { when: s => s.shift, apply: s => { s.board = true; } },
    review: {
      when: (s, p) => s.board && Boolean(patientById(p.id)) && REVIEWS.includes(p.what),
      apply: (s, p) => { const list = s.reviewed[p.id] || (s.reviewed[p.id] = []); if (!list.includes(p.what)) list.push(p.what); }
    },
    assess: {
      when: (s, p) => reviewedAll(s, p.id) && Boolean(triageById(p.triage)) && Array.isArray(p.flags) && p.flags.every(f => isFinding(p.id, f)),
      apply: (s, p) => { s.flags[p.id] = [...new Set(p.flags)]; s.triage[p.id] = p.triage; }
    },
    prioritize: { when: (s, p) => assessedAll(s) && isOrder(p.order), apply: (s, p) => { s.order = [...p.order]; } },
    decide: {
      when: (s, p) => isOrder(s.order) && isAction(p.id, p.action) && typeof p.support === 'boolean',
      apply: (s, p) => { s.plan[p.id] = { action: p.action, support: p.support }; }
    },
    record: { when: s => nextStep(s) === 'record', apply: s => { s.recorded = true; } },
    handover: {
      when: (s, p) => s.recorded && Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.length <= 2 && p.reasons.every(id => REASONS.some(r => r.id === id)),
      apply: (s, p) => { s.handover = true; s.reasons = [...new Set(p.reasons)]; }
    }
  }
};
