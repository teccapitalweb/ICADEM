// Misión 4 · Obra · "Inspector de seguridad" — reglas y calificación (módulo puro).
// Como el Banco, el Tribunal y el Supermercado: aquí vive todo lo que decide el resultado y este
// mismo archivo corre en el servidor antes de acreditar la recompensa.
//
// El caso: la ingeniera residente recibe al jugador como inspector por un día. Hay que ponerse el
// equipo de protección, recorrer la obra con la lista de verificación, calificar cada punto
// (riesgo o en regla), elegir la medida correctiva de cada riesgo, señalizar la excavación,
// detener la actividad más peligrosa y entregar el reporte.
//
// El contenido usa criterios generales de seguridad en obra (EPP, trabajo en altura, excavaciones,
// electricidad temporal). Es un juego educativo: no sustituye la capacitación oficial.

export const MISSION_ID = 'obra-inspector-seguridad';

export const SUPERVISOR = Object.freeze({ name: 'Ing. Paula', role: 'Residente de obra' });

/** Equipo de protección personal que hay que ponerse ANTES de recorrer la obra. */
export const GEAR = Object.freeze([
  { id: 'casco', name: 'Casco' },
  { id: 'chaleco', name: 'Chaleco reflejante' },
  { id: 'botas', name: 'Botas con casquillo' }
]);
const GEAR_IDS = GEAR.map(g => g.id);

/**
 * Los ocho puntos de la lista de verificación. `hazard` indica la condición real del punto;
 * el jugador debe calificarlo igual. Cada riesgo tiene tres medidas posibles y una correcta.
 */
export const SPOTS = Object.freeze([
  { id: 'andamio-sur', name: 'Andamio sur (2º nivel)', area: 'Altura', hazard: true,
    finding: 'Plataforma de trabajo sin barandal ni línea de vida; hay gente trabajando arriba.',
    measures: [
      { id: 'detener-andamio', text: 'Bajar a la gente, detener el trabajo y completar barandales y línea de vida', correct: true },
      { id: 'letrero-andamio', text: 'Colocar un letrero de «precaución» al pie del andamio', correct: false },
      { id: 'avisar-andamio', text: 'Pedirles que tengan cuidado y seguir con el recorrido', correct: false }
    ] },
  { id: 'zanja', name: 'Zanja de cimentación', area: 'Excavación', hazard: true,
    finding: 'Excavación de 2 m sin barrera perimetral ni señalización; el material está al borde.',
    measures: [
      { id: 'barrera-zanja', text: 'Delimitar con barrera, señalizar y retirar el material del borde', correct: true },
      { id: 'tapar-zanja', text: 'Rellenar la zanja de inmediato', correct: false },
      { id: 'cuerda-zanja', text: 'Poner una cuerda baja y continuar', correct: false }
    ] },
  { id: 'cables', name: 'Extensión eléctrica del patio', area: 'Electricidad', hazard: true,
    finding: 'Cable con el forro dañado cruza un charco junto a la mezcladora.',
    measures: [
      { id: 'desenergizar', text: 'Desenergizar, retirar el cable dañado y tender la línea por alto y en seco', correct: true },
      { id: 'cinta-cable', text: 'Envolver el tramo pelado con cinta de aislar', correct: false },
      { id: 'tabla-cable', text: 'Poner una tabla sobre el charco para pisar el cable', correct: false }
    ] },
  { id: 'sin-casco', name: 'Trabajador junto a la mezcladora', area: 'EPP', hazard: true,
    finding: 'Trabaja sin casco debajo de la zona de izaje.',
    measures: [
      { id: 'parar-casco', text: 'Suspender su actividad hasta que use el casco, y avisar a su cabo', correct: true },
      { id: 'anotar-casco', text: 'Anotarlo en el reporte y dejarlo seguir, para no atrasar el colado', correct: false },
      { id: 'regalar-casco', text: 'Decirle que mañana traiga su casco sin falta', correct: false }
    ] },
  { id: 'escalera', name: 'Escalera al primer nivel', area: 'Altura', hazard: true,
    finding: 'Escalera portátil sin amarrar, apoyada casi vertical sobre piso disparejo.',
    measures: [
      { id: 'fijar-escalera', text: 'Amarrarla arriba, apoyarla a 75° (regla 4 a 1) y nivelar la base', correct: true },
      { id: 'sostener-escalera', text: 'Pedir que alguien la sostenga cuando se use', correct: false },
      { id: 'brincar-escalera', text: 'Usarla rápido y con cuidado mientras llega otra', correct: false }
    ] },
  { id: 'extintor', name: 'Extintor del almacén', area: 'Incendio', hazard: false,
    finding: 'Señalizado, a la mano, con presión en verde y carga vigente.' },
  { id: 'andamio-norte', name: 'Andamio norte', area: 'Altura', hazard: false,
    finding: 'Completo: barandales, rodapiés, plataforma firme y accesos despejados.' },
  { id: 'acopio', name: 'Acopio de materiales', area: 'Almacén', hazard: false,
    finding: 'Estibas bajas, amarradas y lejos de los pasos de gente y maquinaria.' }
]);
export const spotById = id => SPOTS.find(s => s.id === id) || null;
export const HAZARDS = Object.freeze(SPOTS.filter(s => s.hazard).map(s => s.id));
export const VERDICTS = Object.freeze(['riesgo', 'en-regla']);

/** La actividad que debe DETENERSE de inmediato: riesgo grave e inminente (caída de altura). */
export const STOP_OPTIONS = Object.freeze([
  { id: 'andamio-sur', text: 'El trabajo en el andamio sur (altura sin protección, con gente arriba)', correct: true },
  { id: 'zanja', text: 'Los trabajos cerca de la zanja', correct: false },
  { id: 'mezcladora', text: 'El colado de la mezcladora', correct: false }
]);
export const BEST_STOP = 'andamio-sur';

/** La señalización virtual se coloca en la excavación: es el riesgo que la pide de inmediato. */
export const SIGN_SPOT = 'zanja';

export const REASONS = Object.freeze([
  { id: 'inminente', text: 'Un riesgo grave e inminente se detiene antes de corregirse', correct: true },
  { id: 'epp', text: 'Sin equipo de protección completo no se entra ni se trabaja', correct: true },
  { id: 'avance', text: 'La obra no debe atrasarse por detalles de seguridad menores', correct: false },
  { id: 'experiencia', text: 'Los trabajadores con experiencia no necesitan tanta protección', correct: false },
  { id: 'papel', text: 'Lo importante es que el reporte se vea completo para la constructora', correct: false }
]);

export function newAttempt() {
  return { talked: false, plan: false, gear: [], inspected: [], verdicts: {}, measures: {}, signed: false, stop: null, reported: false, reasons: [] };
}

const gearAll = a => GEAR_IDS.every(id => a.gear.includes(id));
const assessedAll = a => SPOTS.every(s => VERDICTS.includes(a.verdicts[s.id]));
const measuredAll = a => HAZARDS.every(id => a.verdicts[id] !== 'riesgo' || typeof a.measures[id] === 'string');
const isMeasure = (spotId, id) => { const s = spotById(spotId); return Boolean(s && s.hazard && s.measures.some(m => m.id === id)); };

export function nextStep(a) {
  if (!a.talked) return 'talk';
  if (!gearAll(a)) return 'gear';
  if (!a.plan) return 'plan';
  if (!assessedAll(a)) return 'inspect';
  if (!measuredAll(a)) return 'measures';
  if (!a.signed) return 'sign';
  if (!a.stop) return 'stop';
  if (!a.reported) return 'report';
  if (!a.reasons.length) return 'justify';
  return 'done';
}

/** Evalúa un intento reconstruido desde la bitácora (mismas reglas en cliente y servidor). */
export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const complete = a.talked === true && gearAll(a) && a.plan === true && assessedAll(a) && measuredAll(a) &&
    a.signed === true && STOP_OPTIONS.some(o => o.id === a.stop) && a.reported === true && reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, breakdown: null };

  const assessHits = SPOTS.filter(s => a.verdicts[s.id] === (s.hazard ? 'riesgo' : 'en-regla')).length;
  const identificacion = assessHits * 5;                                                 // 8 × 5 = 40

  // Medidas: solo cuentan las de los riesgos que el jugador marcó como riesgo (6 c/u, máx. 30).
  const measureHits = HAZARDS.filter(id => a.verdicts[id] === 'riesgo' &&
    (spotById(id).measures.find(m => m.id === a.measures[id]) || {}).correct === true).length;
  const medidas = measureHits * 6;

  const paro = a.stop === BEST_STOP ? 10 : 0;

  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length;
  const misses = reasons.length - hits;
  const justificacion = Math.max(0, Math.min(10, hits * 5 - misses * 5));

  const research = 10;                                                                   // EPP completo, plano y señalización
  const score = Math.min(100, identificacion + medidas + paro + justificacion + research);
  return {
    valid: true, score, passed: score >= 70,
    breakdown: { identificacion, medidas, paro, justificacion, research, assessHits, measureHits, hits, misses }
  };
}

export const SITE_INSPECTOR_MISSION = {
  id: MISSION_ID,
  building: 'obra',
  title: 'Inspector de seguridad',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newAttempt,
  evaluate,
  objectives: [
    { id: 'talk', text: 'Preséntate con la ingeniera residente', done: s => s.talked },
    { id: 'gear', text: 'Ponte el equipo de protección en la caseta', done: gearAll, detail: s => `${s.gear.length}/${GEAR.length}` },
    { id: 'plan', text: 'Consulta el plano y la lista de verificación', done: s => s.plan },
    { id: 'inspect', text: 'Inspecciona los ocho puntos de la obra', done: assessedAll, detail: s => `${SPOTS.filter(x => VERDICTS.includes(s.verdicts[x.id])).length}/${SPOTS.length}` },
    { id: 'measures', text: 'Elige la medida correctiva de cada riesgo', done: s => assessedAll(s) && measuredAll(s) },
    { id: 'sign', text: 'Coloca la señalización en la excavación', done: s => s.signed },
    { id: 'stop', text: 'Decide qué actividad se detiene de inmediato', done: s => Boolean(s.stop) },
    { id: 'report', text: 'Entrega tu reporte a la ingeniera', done: s => s.reported },
    { id: 'justify', text: 'Justifica tus decisiones', done: s => s.reasons.length > 0 }
  ],
  actions: {
    talk: { apply: s => { s.talked = true; } },
    equip: { when: (s, p) => s.talked && GEAR_IDS.includes(p.id), apply: (s, p) => { if (!s.gear.includes(p.id)) s.gear.push(p.id); } },
    readPlan: { when: s => s.talked && gearAll(s), apply: s => { s.plan = true; } },
    inspect: { when: (s, p) => s.plan && Boolean(spotById(p.id)), apply: (s, p) => { if (!s.inspected.includes(p.id)) s.inspected.push(p.id); } },
    assess: {
      when: (s, p) => s.inspected.includes(p.id) && VERDICTS.includes(p.verdict),
      apply: (s, p) => { s.verdicts[p.id] = p.verdict; if (p.verdict !== 'riesgo') delete s.measures[p.id]; }
    },
    measure: {
      when: (s, p) => s.verdicts[p.id] === 'riesgo' && isMeasure(p.id, p.measure),
      apply: (s, p) => { s.measures[p.id] = p.measure; }
    },
    placeSign: { when: s => s.verdicts[SIGN_SPOT] === 'riesgo', apply: s => { s.signed = true; } },
    stopWork: { when: (s, p) => assessedAll(s) && measuredAll(s) && STOP_OPTIONS.some(o => o.id === p.id), apply: (s, p) => { s.stop = p.id; } },
    report: { when: s => nextStep(s) === 'report', apply: s => { s.reported = true; } },
    justify: {
      when: (s, p) => s.reported && Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.length <= 2 && p.reasons.every(id => REASONS.some(r => r.id === id)),
      apply: (s, p) => { s.reasons = [...new Set(p.reasons)]; }
    }
  }
};
