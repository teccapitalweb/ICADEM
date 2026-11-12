// Misión 6 · Clínica Veterinaria · "Guardianes del bienestar" — reglas y calificación (módulo puro).
// Igual que los demás juegos: todo lo que decide el resultado vive aquí y este mismo archivo corre
// en el servidor antes de acreditar la recompensa.
//
// El caso: el jugador apoya a la veterinaria en un turno con cuatro pacientes FICTICIOS. Observa a
// cada animal, lo pesa en la báscula, lee su expediente, reconoce signos de alerta, identifica qué
// dominio de su bienestar no se está cubriendo, decide la prioridad y la acción responsable, arma el
// enriquecimiento ambiental del área de observación y orienta a los tutores.
//
// Marco educativo: los cinco dominios del bienestar animal (nutrición, ambiente, salud,
// comportamiento y estado mental). Sin medicamentos ni dosis; no sustituye la consulta veterinaria.

export const MISSION_ID = 'vet-guardianes-bienestar';

export const VET = Object.freeze({ name: 'Dra. Ximena', role: 'Médica veterinaria' });

export const DOMAINS = Object.freeze([
  { id: 'nutricion', name: 'Nutrición', text: 'Agua y alimento adecuados' },
  { id: 'ambiente', name: 'Ambiente', text: 'Espacio, refugio y comodidad' },
  { id: 'salud', name: 'Salud', text: 'Sin enfermedad, dolor ni lesiones' },
  { id: 'comportamiento', name: 'Comportamiento', text: 'Poder expresar conductas propias de su especie' },
  { id: 'mental', name: 'Estado mental', text: 'Más experiencias positivas que miedo o estrés' }
]);
const DOMAIN_IDS = DOMAINS.map(d => d.id);

export const PRIORITIES = Object.freeze([
  { id: 'urgente', name: 'Urgente', text: 'Atención inmediata', rank: 0, hex: 0xe5484d },
  { id: 'hoy', name: 'Hoy', text: 'Consulta en el turno', rank: 1, hex: 0xf2b93b },
  { id: 'rutina', name: 'Rutina', text: 'Revisión programada', rank: 2, hex: 0x3fb27f }
]);

/** Los cuatro pacientes, con su peso en el expediente y el que marca la báscula. */
export const ANIMALS = Object.freeze([
  { id: 'rocky', name: 'Rocky', species: 'Conejo', age: '3 años', priority: 'urgente', domain: 'salud',
    observe: 'Está encorvado en una esquina, con los ojos entrecerrados. No se acerca al heno.',
    owner: 'Desde anoche no come heno y no ha hecho heces. Antes comía todo el día.',
    weightBefore: 2.1, weightNow: 2.0,
    chart: [['Especie', 'Conejo doméstico'], ['Dieta habitual', 'Heno a libre acceso y verduras'], ['Motivo', 'No come y no defeca desde hace 12 horas']],
    findings: [
      { id: 'no-come', text: 'Dejó de comer heno hace 12 horas', alert: true },
      { id: 'sin-heces', text: 'No ha hecho heces', alert: true },
      { id: 'postura', text: 'Postura encorvada y quieto', alert: true },
      { id: 'pelaje', text: 'Pelaje limpio y brillante', alert: false }
    ],
    actions: [
      { id: 'rocky-urg', text: 'Pasarlo de inmediato con la veterinaria: en un conejo, no comer es una urgencia', correct: true },
      { id: 'rocky-esperar', text: 'Esperar a mañana para ver si vuelve a comer', correct: false },
      { id: 'rocky-dulce', text: 'Ofrecerle fruta dulce para que se anime a comer', correct: false }
    ] },
  { id: 'canela', name: 'Canela', species: 'Perra', age: '9 años', priority: 'hoy', domain: 'salud',
    observe: 'Camina bien y mueve la cola, pero se acerca al bebedero una y otra vez.',
    owner: 'Toma muchísima agua, pide salir a orinar a cada rato y la veo más delgada.',
    weightBefore: 18.4, weightNow: 16.1,
    chart: [['Especie', 'Perro mestizo'], ['Última visita', 'Hace un año: sana'], ['Motivo', 'Sed y orina en exceso; pérdida de peso']],
    findings: [
      { id: 'sed', text: 'Bebe mucha más agua que antes', alert: true },
      { id: 'peso', text: 'Bajó más de 2 kg en un año sin dieta', alert: true },
      { id: 'alegre', text: 'Está alerta y mueve la cola', alert: false },
      { id: 'edad', text: 'Tiene 9 años', alert: false }
    ],
    actions: [
      { id: 'canela-hoy', text: 'Consulta con la veterinaria hoy para valoración y estudios', correct: true },
      { id: 'canela-agua', text: 'Quitarle el agua para que orine menos', correct: false },
      { id: 'canela-normal', text: 'Es normal por la edad: no hace falta consulta', correct: false }
    ] },
  { id: 'luna', name: 'Luna', species: 'Gata', age: '2 años', priority: 'hoy', domain: 'ambiente',
    observe: 'Se esconde detrás de la caja de transporte y bufa cuando pasa otro gato cerca.',
    owner: 'Desde que llegó el otro gato orina fuera del arenero. Solo tenemos un arenero y no hay dónde subirse.',
    weightBefore: 4.0, weightNow: 4.0,
    chart: [['Especie', 'Gato doméstico'], ['Vive en', 'Departamento con un segundo gato desde hace un mes'], ['Motivo', 'Orina fuera del arenero; se esconde']],
    findings: [
      { id: 'esconde', text: 'Se esconde y bufa desde que llegó otro gato', alert: true },
      { id: 'arenero', text: 'Orina fuera del arenero (comparten uno solo)', alert: true },
      { id: 'peso-estable', text: 'Su peso no ha cambiado', alert: false },
      { id: 'joven', text: 'Tiene 2 años', alert: false }
    ],
    actions: [
      { id: 'luna-hoy', text: 'Consulta hoy para descartar un problema médico y plan de ambiente: más areneros, alturas y escondites', correct: true },
      { id: 'luna-castigo', text: 'Regañarla cada vez que orine fuera', correct: false },
      { id: 'luna-encierro', text: 'Encerrarla en el baño para que se acostumbre', correct: false }
    ] },
  { id: 'toby', name: 'Toby', species: 'Cachorro', age: '10 semanas', priority: 'rutina', domain: null,
    observe: 'Juega con todo, explora y se acerca a saludar. Come con apetito.',
    owner: 'Viene a su revisión y a preguntar por su calendario de vacunas. Está muy bien.',
    weightBefore: 3.2, weightNow: 3.9,
    chart: [['Especie', 'Perro'], ['Motivo', 'Revisión de cachorro'], ['Desarrollo', 'Aumento de peso esperado para su edad']],
    findings: [
      { id: 'juega', text: 'Juega y explora con curiosidad', alert: false },
      { id: 'sube-peso', text: 'Subió de peso desde su última visita', alert: false },
      { id: 'come', text: 'Come con buen apetito', alert: false },
      { id: 'muerde', text: 'Muerde juguetes todo el tiempo', alert: false }
    ],
    actions: [
      { id: 'toby-rutina', text: 'Revisión de rutina: calendario de vacunas, desparasitación indicada por la veterinaria y socialización', correct: true },
      { id: 'toby-urg', text: 'Pasarlo antes que todos a urgencias', correct: false },
      { id: 'toby-nada', text: 'Mandarlo a casa sin revisión porque se ve sano', correct: false }
    ] }
]);
export const animalById = id => ANIMALS.find(a => a.id === id) || null;
const ANIMAL_IDS = ANIMALS.map(a => a.id);
export const REVIEWS = Object.freeze(['observe', 'weigh', 'chart']);

/** Enriquecimiento del área de observación para Luna: se colocan físicamente en el escenario. */
export const ENRICHMENT = Object.freeze([
  { id: 'arenero', name: 'Segundo arenero', good: true },
  { id: 'repisa', name: 'Repisa en alto para subirse', good: true },
  { id: 'escondite', name: 'Caja escondite', good: true },
  { id: 'rascador', name: 'Rascador', good: true },
  { id: 'jaula', name: 'Jaula más pequeña para que se calme', good: false },
  { id: 'hilo', name: 'Juguete con hilo suelto sin supervisión', good: false }
]);

export const REASONS = Object.freeze([
  { id: 'dominios', text: 'El bienestar no es solo salud: también ambiente, nutrición, conducta y estado mental', correct: true },
  { id: 'senales', text: 'Los animales esconden el dolor: los cambios de conducta y de peso son señales a tomar en serio', correct: true },
  { id: 'castigo', text: 'Las conductas indeseadas se corrigen con castigo', correct: false },
  { id: 'edad', text: 'Los cambios en animales mayores son normales y no requieren consulta', correct: false },
  { id: 'humano', text: 'Lo que es bueno para las personas también lo es para los animales', correct: false }
]);

export function newAttempt() {
  return { briefed: false, reviewed: {}, flags: {}, priority: {}, domain: {}, plan: {}, enrichment: [], counseled: false, reasons: [] };
}

const reviewedAll = (a, id) => REVIEWS.every(r => (a.reviewed[id] || []).includes(r));
const assessedAll = a => ANIMAL_IDS.every(id => PRIORITIES.some(p => p.id === a.priority[id]));
const plannedAll = a => ANIMAL_IDS.every(id => typeof a.plan[id] === 'string');
const isFinding = (aid, f) => Boolean(animalById(aid) && animalById(aid).findings.some(x => x.id === f));
const isAction = (aid, x) => Boolean(animalById(aid) && animalById(aid).actions.some(y => y.id === x));
const enrichmentDone = a => a.enrichment.length >= 3;

export function nextStep(a) {
  if (!a.briefed) return 'brief';
  if (!ANIMAL_IDS.every(id => reviewedAll(a, id))) return 'review';
  if (!assessedAll(a)) return 'assess';
  if (!plannedAll(a)) return 'act';
  if (!enrichmentDone(a)) return 'enrich';
  if (!a.counseled) return 'counsel';
  return 'done';
}

export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const complete = a.briefed && ANIMAL_IDS.every(id => reviewedAll(a, id)) && assessedAll(a) && plannedAll(a) && enrichmentDone(a) &&
    a.counseled === true && reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, breakdown: null };

  const priorityHits = ANIMALS.filter(x => a.priority[x.id] === x.priority).length;
  const prioridad = priorityHits * 5;                                                         // 4 × 5 = 20

  let alertas = 0, alertPerfect = 0;
  for (const x of ANIMALS) {
    const marked = new Set(a.flags[x.id] || []), real = new Set(x.findings.filter(f => f.alert).map(f => f.id));
    const errors = [...marked].filter(id => !real.has(id)).length + [...real].filter(id => !marked.has(id)).length;
    if (errors === 0) { alertas += 4; alertPerfect++; } else if (errors === 1) alertas += 2;
  }                                                                                           // 4 × 4 = 16

  const domainHits = ANIMALS.filter(x => (a.domain[x.id] || null) === x.domain).length;
  const dominios = domainHits * 3;                                                            // 4 × 3 = 12

  const actionHits = ANIMALS.filter(x => (x.actions.find(y => y.id === a.plan[x.id]) || {}).correct === true).length;
  const acciones = actionHits * 5;                                                            // 4 × 5 = 20

  const placed = new Set(a.enrichment);
  const goodPlaced = ENRICHMENT.filter(e => e.good && placed.has(e.id)).length, badPlaced = ENRICHMENT.filter(e => !e.good && placed.has(e.id)).length;
  const enriquecimiento = Math.max(0, Math.min(12, goodPlaced * 3 - badPlaced * 6));          // 12

  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length, misses = reasons.length - hits;
  const justificacion = Math.max(0, Math.min(10, hits * 5 - misses * 5));                     // 10

  const research = 10;                                                                         // observó, pesó y leyó a los cuatro
  const score = Math.min(100, prioridad + alertas + dominios + acciones + enriquecimiento + justificacion + research);
  return {
    valid: true, score, passed: score >= 70,
    breakdown: { prioridad, alertas, dominios, acciones, enriquecimiento, justificacion, research, priorityHits, alertPerfect, domainHits, actionHits, goodPlaced, badPlaced, hits, misses }
  };
}

export const VET_WELFARE_MISSION = {
  id: MISSION_ID,
  building: 'veterinaria',
  title: 'Guardianes del bienestar',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newAttempt,
  evaluate,
  objectives: [
    { id: 'brief', text: 'Habla con la Dra. Ximena en recepción', done: s => s.briefed },
    { id: 'review', text: 'Observa, pesa y lee el expediente de cada paciente', done: s => ANIMAL_IDS.every(id => reviewedAll(s, id)), detail: s => `${ANIMAL_IDS.filter(id => reviewedAll(s, id)).length}/${ANIMAL_IDS.length}` },
    { id: 'assess', text: 'Marca signos de alerta, dominio afectado y prioridad', done: assessedAll, detail: s => `${ANIMAL_IDS.filter(id => s.priority[id]).length}/${ANIMAL_IDS.length}` },
    { id: 'act', text: 'Elige la acción responsable para cada paciente', done: plannedAll, detail: s => `${ANIMAL_IDS.filter(id => s.plan[id]).length}/${ANIMAL_IDS.length}` },
    { id: 'enrich', text: 'Arma el enriquecimiento del área de observación', done: enrichmentDone, detail: s => `${s.enrichment.length}/3` },
    { id: 'counsel', text: 'Orienta a los tutores con la Dra. Ximena', done: s => s.counseled }
  ],
  actions: {
    brief: { apply: s => { s.briefed = true; } },
    review: {
      when: (s, p) => s.briefed && Boolean(animalById(p.id)) && REVIEWS.includes(p.what),
      apply: (s, p) => { const l = s.reviewed[p.id] || (s.reviewed[p.id] = []); if (!l.includes(p.what)) l.push(p.what); }
    },
    assess: {
      when: (s, p) => reviewedAll(s, p.id) && PRIORITIES.some(x => x.id === p.priority) && Array.isArray(p.flags) && p.flags.every(f => isFinding(p.id, f)) && (p.domain === null || DOMAIN_IDS.includes(p.domain)),
      apply: (s, p) => { s.flags[p.id] = [...new Set(p.flags)]; s.priority[p.id] = p.priority; s.domain[p.id] = p.domain; }
    },
    decide: { when: (s, p) => assessedAll(s) && isAction(p.id, p.action), apply: (s, p) => { s.plan[p.id] = p.action; } },
    place: {
      when: (s, p) => plannedAll(s) && ENRICHMENT.some(e => e.id === p.id) && !s.enrichment.includes(p.id) && s.enrichment.length < 4,
      apply: (s, p) => { s.enrichment.push(p.id); }
    },
    remove: { when: (s, p) => s.enrichment.includes(p.id) && !s.counseled, apply: (s, p) => { s.enrichment = s.enrichment.filter(x => x !== p.id); } },
    counsel: {
      when: (s, p) => nextStep(s) === 'counsel' && Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.length <= 2 && p.reasons.every(id => REASONS.some(r => r.id === id)),
      apply: (s, p) => { s.counseled = true; s.reasons = [...new Set(p.reasons)]; }
    }
  }
};
