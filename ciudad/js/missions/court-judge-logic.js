// Misión 9 · Tribunal ICADEM · "Tú eres el juez" — caso, reglas y calificación (módulo puro).
// Caso FICTICIO con fines educativos: enseña a escuchar a las partes, confrontar declaraciones
// con pruebas, resolver objeciones y fundar una resolución. No es asesoría jurídica ni
// reproduce el procedimiento de ningún tribunal real.

export const MISSION_ID = 'tribunal-tu-eres-el-juez';

export const CASE = Object.freeze({
  id: 'exp-014',
  number: 'Expediente 014/2026',
  title: 'Ríos vs. Salgado',
  matter: 'Devolución del depósito de un arrendamiento',
  deposit: 18000,
  provenDamage: 1500,
  claimed: 21400,
  background: [
    'Marta Ríos rentó durante dos años el departamento 3 de la calle Fresno a Ernesto Salgado. Al firmar entregó un depósito de $18,000.',
    'Marta desocupó y entregó las llaves el 31 de mayo de 2026. Pide que se le devuelva el depósito completo.',
    'Ernesto se niega: afirma que recibió el departamento con daños por $21,400 (pintura $9,000, boiler $8,400, vidrio $1,500 y limpieza $2,500), más que el depósito.',
    'Te toca decidir cuánto del depósito debe devolverse. Resuelve con lo que quede probado en la audiencia, no con lo que cada parte afirme.'
  ]
});

/** Otros expedientes del juzgado: aún no se pueden abrir. */
export const DOCKET = Object.freeze([
  { id: CASE.id, number: CASE.number, title: CASE.title, matter: CASE.matter, available: true },
  { id: 'exp-022', number: 'Expediente 022/2026', title: 'Taller Luna vs. Ferretería Ávila', matter: 'Incumplimiento de un contrato de suministro', available: false },
  { id: 'exp-031', number: 'Expediente 031/2026', title: 'Vecinos de Los Cedros vs. Constructora Núñez', matter: 'Daños por una obra colindante', available: false }
]);

export const PARTIES = Object.freeze({
  actora: { side: 'actora', name: 'Marta Ríos', lawyer: 'Lic. Paula Mena', statement: [
    'Señoría, mi representada cumplió su contrato durante dos años y entregó el departamento el 31 de mayo.',
    'Reconocemos un solo daño: el vidrio de la cocina, que se rompió al sacar el refrigerador. Ella misma lo avisó.',
    'Pedimos la devolución del depósito de $18,000. Lo demás que reclama el arrendador es desgaste normal de un departamento habitado.'
  ] },
  demandada: { side: 'demandada', name: 'Ernesto Salgado', lawyer: 'Lic. Hugo Barrera', statement: [
    'Señoría, el día de la entrega mi representado encontró el departamento destrozado.',
    'Paredes manchadas, el boiler inservible, un vidrio roto y suciedad por todas partes. Reparar todo cuesta $21,400.',
    'Como los daños superan el depósito, pedimos que se le absuelva de devolverlo.'
  ] }
});

/** Pruebas del expediente. `best` es la valoración más sólida y `fair` una defendible (medio puntaje). */
export const EXHIBITS = Object.freeze([
  { id: 'contrato', tag: 'Prueba 1', name: 'Contrato de arrendamiento', offeredBy: 'ambas partes', best: 'pleno', fair: null,
    rows: [['Firmado por', 'Marta Ríos y Ernesto Salgado'], ['Depósito', '$18,000'], ['Cláusula 8', 'El depósito se devuelve dentro de los 30 días siguientes a la entrega, descontando únicamente los daños comprobados.'], ['Cláusula 9', 'El desgaste por uso normal (pintura, piezas con vida útil agotada) corre a cargo del arrendador.']],
    why: 'Lo firmaron ambas partes y ninguna lo objetó: hace prueba plena de lo pactado.' },
  { id: 'inventario', tag: 'Prueba 2', name: 'Inventario de entrada', offeredBy: 'la actora', best: 'pleno', fair: null,
    rows: [['Fecha', '1 de junio de 2024 (inicio de la renta)'], ['Firmado por', 'Ambas partes'], ['Pintura', 'Con tres años de antigüedad'], ['Boiler', 'En uso desde 2014; enciende con dificultad'], ['Ventanas', 'Completas']],
    why: 'También está firmado por los dos. Prueba que el boiler ya era viejo y que la pintura no era nueva.' },
  { id: 'cotizacion', tag: 'Prueba 3', name: 'Cotización de reparaciones', offeredBy: 'el demandado', best: 'indicio', fair: 'nulo',
    rows: [['Elaborada por', 'Servicios Rubén (Rubén Ortega)'], ['Fecha del documento', '12 de mayo de 2026'], ['Pintura general', '$9,000'], ['Boiler nuevo', '$8,400'], ['Vidrio de cocina', '$1,500'], ['Limpieza profunda', '$2,500'], ['Total', '$21,400']],
    why: 'La hizo una sola de las partes, con un proveedor suyo, y está fechada 19 días ANTES de la entrega. Solo sirve como indicio del precio del vidrio, que otras pruebas confirman.' },
  { id: 'mensajes', tag: 'Prueba 4', name: 'Mensajes entre las partes', offeredBy: 'la actora', best: 'pleno', fair: 'indicio',
    rows: [['Reconocidos por', 'Ambas partes en esta audiencia'], ['30 de mayo · Marta', '«Don Ernesto, se rompió el vidrio de la cocina al sacar el refri. Yo lo pago.»'], ['30 de mayo · Ernesto', '«Está bien, lo vemos en la entrega.»'], ['31 de mayo · Ernesto', '«Recibido el depto. Todo en orden salvo el vidrio.»']],
    why: 'El demandado reconoció que son suyos. Prueban dos cosas: que el vidrio sí se rompió y que el resto se recibió en orden.' },
  { id: 'fotos', tag: 'Prueba 5', name: 'Fotografías del arrendador', offeredBy: 'el demandado', best: 'nulo', fair: 'indicio',
    rows: [['Contenido', 'Paredes manchadas y el boiler desarmado'], ['Fecha en las imágenes', 'No tienen'], ['Fecha de los archivos', '20 de junio de 2026, según la secretaría'], ['Quién tenía el departamento ese día', 'El arrendador, desde hacía tres semanas']],
    why: 'Se tomaron tres semanas después de la entrega, con el departamento ya en manos del arrendador: no prueban cómo estaba el 31 de mayo.' }
]);

export const WEIGHTS = Object.freeze([
  { id: 'pleno', name: 'Prueba plena', text: 'Confiable por sí sola' },
  { id: 'indicio', name: 'Indicio', text: 'Vale solo si otras la confirman' },
  { id: 'nulo', name: 'Sin valor', text: 'No prueba lo que pretende' }
]);

/**
 * Testigos. Cada uno pasa por: interrogatorio de quien lo ofrece, contrainterrogatorio y
 * preguntas del juez. En los dos primeros puede surgir una objeción que el juez debe resolver;
 * si se admite, la pregunta se retira y el testigo no la contesta.
 */
export const WITNESSES = Object.freeze([
  { id: 'ruben', name: 'Rubén Ortega', role: 'Plomero · testigo del demandado', offeredBy: 'demandada',
    direct: [
      { by: 'demandada', q: '¿Usted revisó el departamento?', a: 'Sí. Fui el 31 de mayo, el día que la señora entregó, y ahí mismo anoté todo lo dañado para la cotización.' },
      { by: 'demandada', q: '¿Verdad que la inquilina era una persona descuidada que maltrataba el inmueble?', objection: 'sugestiva', a: 'Pues… sí, era descuidada.' }
    ],
    cross: [
      { by: 'actora', q: '¿En qué fecha elaboró usted la cotización?', objection: 'fecha', a: 'La hice… el 12 de mayo. Don Ernesto me la pidió para ir adelantando.' }
    ],
    questions: [
      { id: 'r-boiler', q: '¿El boiler se descompuso por mal uso?', a: 'No sabría decirle. Ya estaba viejo: tenía como doce años y esos aparatos duran diez.' },
      { id: 'r-relacion', q: '¿Qué relación de trabajo tiene con el señor Salgado?', a: 'Le hago todas las reparaciones de sus departamentos desde hace años.' },
      { id: 'r-entrega', q: '¿Estuvo presente cuando se entregaron las llaves?', a: 'No, a esa hora no estaba. Llegué por la tarde.' }
    ] },
  { id: 'sofia', name: 'Sofía Luna', role: 'Vecina · testigo de la actora', offeredBy: 'actora',
    direct: [
      { by: 'actora', q: '¿Estuvo presente en la entrega del departamento?', a: 'Sí, ayudé a Marta con la mudanza. Don Ernesto recorrió todo, recibió las llaves y dijo que estaba bien, salvo el vidrio.' },
      { by: 'actora', q: '¿Qué le han contado los demás vecinos sobre cómo trata don Ernesto a sus inquilinos?', objection: 'oidas', a: 'Dicen que nunca devuelve los depósitos.' }
    ],
    cross: [
      { by: 'demandada', q: '¿Usted es amiga de la señora Ríos?', a: 'Somos vecinas y nos llevamos bien, sí. Pero estoy contando lo que vi.' }
    ],
    questions: [
      { id: 's-boiler', q: '¿Vio usted en qué estado estaba el boiler?', a: 'No. Al cuarto del boiler no entré.' },
      { id: 's-vidrio', q: '¿Qué sabe del vidrio roto?', a: 'Se rompió al sacar el refrigerador. Marta le escribió a don Ernesto ese mismo día.' },
      { id: 's-paredes', q: '¿Cómo estaban las paredes?', a: 'Normales, con las marcas de los cuadros. Nada fuera de lo común después de dos años.' }
    ] }
]);

/** Objeciones. `ruling` es la decisión correcta: 'ha-lugar' (se admite) o 'no-ha-lugar'. */
export const OBJECTIONS = Object.freeze({
  sugestiva: { id: 'sugestiva', by: 'actora', text: '¡Objeción! La pregunta es sugestiva y le pide al testigo una opinión, no un hecho.', ruling: 'ha-lugar',
    why: 'La pregunta ya traía la respuesta («¿verdad que…?») y pedía calificar a una persona. Un testigo declara hechos que le constan.' },
  fecha: { id: 'fecha', by: 'demandada', text: 'Objeción, señoría: la fecha de un presupuesto es irrelevante.', ruling: 'no-ha-lugar',
    why: 'La fecha es central: si la cotización se hizo antes de la entrega, no pudo basarse en lo que se encontró ese día.' },
  oidas: { id: 'oidas', by: 'demandada', text: '¡Objeción! La testigo no puede declarar sobre lo que le contaron otras personas.', ruling: 'ha-lugar',
    why: 'Es un testimonio de oídas: no le consta. Además, el trato a otros inquilinos no es materia de este juicio.' }
});

/** Declaraciones que el juez puede confrontar con una prueba. `exhibit` = la que la contradice (o null). */
export const STATEMENTS = Object.freeze([
  { id: 'd-ernesto', who: 'Lic. Barrera, por Ernesto Salgado', text: '«El día de la entrega encontró el departamento destrozado.»', exhibit: 'mensajes',
    why: 'Ese mismo día Ernesto escribió: «Todo en orden salvo el vidrio».' },
  { id: 'd-ruben', who: 'Rubén Ortega', text: '«Fui el 31 de mayo y ahí anoté lo dañado para la cotización.»', exhibit: 'cotizacion',
    why: 'La cotización está fechada el 12 de mayo, 19 días antes de la entrega.' },
  { id: 'd-marta', who: 'Lic. Mena, por Marta Ríos', text: '«Reconocemos un solo daño: el vidrio de la cocina.»', exhibit: null,
    why: 'Coincide con los mensajes: no hay contradicción.' },
  { id: 'd-sofia', who: 'Sofía Luna', text: '«Don Ernesto recorrió todo y dijo que estaba bien, salvo el vidrio.»', exhibit: null,
    why: 'Coincide con el mensaje del 31 de mayo: no hay contradicción.' },
  { id: 'd-edad', who: 'Rubén Ortega', text: '«El boiler ya estaba viejo.»', exhibit: null,
    why: 'Coincide con el inventario de entrada (en uso desde 2014): no hay contradicción.', requires: 'r-boiler' }
]);

export const RULINGS = Object.freeze([
  { id: 'total', name: 'Devolver el depósito completo', amount: CASE.deposit, text: 'Condenar al arrendador a devolver $18,000.' },
  { id: 'parcial', name: 'Devolver el depósito menos el vidrio', amount: CASE.deposit - CASE.provenDamage, text: 'Condenar al arrendador a devolver $16,500: el depósito menos el único daño probado.' },
  { id: 'absolver', name: 'Absolver al arrendador', amount: 0, text: 'Declarar que los daños superan el depósito y que no debe devolver nada.' }
]);
export const BEST_RULING = 'parcial';

export const GROUNDS = Object.freeze([
  { id: 'vidrio', text: 'El daño al vidrio está probado: la propia actora lo reconoció.', correct: true },
  { id: 'recibido', text: 'El demandado recibió el departamento «en orden salvo el vidrio», según sus propios mensajes.', correct: true },
  { id: 'desgaste', text: 'Pintura y boiler son desgaste normal a cargo del arrendador (cláusula 9 e inventario).', correct: true },
  { id: 'cotizacion', text: 'La cotización demuestra daños por $21,400.', correct: false },
  { id: 'fotos', text: 'Las fotografías prueban el estado del departamento al entregarlo.', correct: false },
  { id: 'amistad', text: 'La testigo es vecina de la actora, así que nada de lo que dijo tiene valor.', correct: false }
]);

const ids = list => list.map(x => x.id);
const EXHIBIT_IDS = ids(EXHIBITS), WITNESS_IDS = ids(WITNESSES), OBJECTION_IDS = Object.keys(OBJECTIONS), SIDES = Object.keys(PARTIES);
const all = (have, need) => need.every(id => have.includes(id));
const witness = id => WITNESSES.find(w => w.id === id);
const objectionsOf = w => [...w.direct, ...w.cross].filter(x => x.objection).map(x => x.objection);

export function newHearing() {
  return { caseId: null, background: false, exhibits: [], opened: false, heard: [], examined: [], asked: [], objections: {}, confronted: null, weights: {}, ruling: null, grounds: [] };
}

/** Declaraciones disponibles para confrontar según lo que el juez realmente escuchó. */
export function availableStatements(s) { return STATEMENTS.filter(x => !x.requires || s.asked.includes(x.requires)); }

/**
 * Califica la audiencia a partir de lo que el juez hizo. 100 puntos:
 *   investigación 10 · objeciones 15 · contradicciones 20 · valoración 20 · resolución 25 · fundamentos 10
 */
export function evaluate(state) {
  const s = { ...newHearing(), ...state };
  const exhibits = [...new Set(s.exhibits)].filter(id => EXHIBIT_IDS.includes(id));
  const heard = [...new Set(s.heard)].filter(id => SIDES.includes(id));
  const examined = [...new Set(s.examined)].filter(id => WITNESS_IDS.includes(id));
  const asked = [...new Set(s.asked)];
  const grounds = [...new Set(s.grounds)].filter(id => GROUNDS.some(g => g.id === id));
  const ruling = RULINGS.some(r => r.id === s.ruling) ? s.ruling : null;
  const objections = s.objections && typeof s.objections === 'object' ? s.objections : {};
  const weights = s.weights && typeof s.weights === 'object' ? s.weights : {};
  const confronted = s.confronted && typeof s.confronted === 'object' ? s.confronted : null;

  const complete = s.caseId === CASE.id && s.background === true && exhibits.length === EXHIBITS.length && s.opened === true &&
    heard.length === SIDES.length && examined.length === WITNESSES.length &&
    WITNESSES.every(w => w.questions.some(q => asked.includes(q.id))) &&
    OBJECTION_IDS.every(id => ['ha-lugar', 'no-ha-lugar'].includes(objections[id])) &&
    Boolean(confronted) && EXHIBIT_IDS.every(id => WEIGHTS.some(w => w.id === weights[id])) &&
    Boolean(ruling) && grounds.length >= 1 && grounds.length <= 3;
  if (!complete) return { valid: false, score: 0, passed: false, ruling, breakdown: null };

  const objectionHits = OBJECTION_IDS.filter(id => objections[id] === OBJECTIONS[id].ruling).length;
  let found = 0, falseAlarms = 0;
  for (const st of STATEMENTS) {
    const marked = confronted[st.id] || null;
    if (st.exhibit && marked === st.exhibit) found++;
    else if (marked && marked !== st.exhibit) falseAlarms++;
  }
  const contradictions = Math.max(0, found * 10 - falseAlarms * 5);
  let weighing = 0;
  for (const e of EXHIBITS) weighing += weights[e.id] === e.best ? 4 : weights[e.id] === e.fair ? 2 : 0;
  const decision = ruling === BEST_RULING ? 25 : ruling === 'total' ? 10 : 0;
  const hits = grounds.filter(id => GROUNDS.find(g => g.id === id).correct).length, misses = grounds.length - hits;
  const reasoning = Math.max(0, Math.min(10, hits * 5 - misses * 5));
  const score = 10 + objectionHits * 5 + contradictions + weighing + decision + reasoning;
  return {
    valid: true, score, passed: score >= 70, ruling, best: BEST_RULING,
    breakdown: { research: 10, objections: objectionHits * 5, objectionHits, contradictions, found, falseAlarms, weighing, decision, reasoning, hits, misses }
  };
}

export const money = n => '$' + Math.round(n).toLocaleString('es-MX');

/** Definición para el motor de misiones: mismo contrato que el Banco, mecánica distinta. */
export const COURT_JUDGE_MISSION = {
  id: MISSION_ID,
  building: 'tribunal',
  title: 'Tú eres el juez',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newHearing,
  evaluate,
  objectives: [
    { id: 'expediente', text: 'Pide un expediente a la secretaria', done: s => s.caseId === CASE.id },
    { id: 'antecedentes', text: 'Lee los antecedentes del caso', done: s => s.background },
    { id: 'pruebas', text: 'Examina las pruebas en la mesa', done: s => all(s.exhibits, EXHIBIT_IDS), detail: s => `${s.exhibits.length}/${EXHIBITS.length}` },
    { id: 'abrir', text: 'Sube al estrado y abre la audiencia', done: s => s.opened },
    { id: 'partes', text: 'Escucha a las dos partes', done: s => all(s.heard, SIDES), detail: s => `${s.heard.length}/${SIDES.length}` },
    { id: 'testigos', text: 'Interroga a los testigos y resuelve las objeciones', done: s => all(s.examined, WITNESS_IDS) && WITNESSES.every(w => w.questions.some(q => s.asked.includes(q.id))), detail: s => `${s.examined.filter(id => witness(id).questions.some(q => s.asked.includes(q.id))).length}/${WITNESSES.length}` },
    { id: 'confrontar', text: 'Confronta las declaraciones con las pruebas', done: s => Boolean(s.confronted) },
    { id: 'valorar', text: 'Valora cada prueba', done: s => EXHIBIT_IDS.every(id => s.weights[id]), detail: s => `${EXHIBIT_IDS.filter(id => s.weights[id]).length}/${EXHIBITS.length}` },
    { id: 'resolver', text: 'Dicta tu resolución y fúndala', done: s => Boolean(s.ruling) && s.grounds.length > 0 }
  ],
  actions: {
    takeCase: { when: (s, p) => !s.caseId && DOCKET.some(d => d.id === p.id && d.available), apply: (s, p) => { s.caseId = p.id; } },
    readBackground: { when: s => Boolean(s.caseId), apply: s => { s.background = true; } },
    examineExhibit: { when: (s, p) => s.background && EXHIBIT_IDS.includes(p.id), apply: (s, p) => { if (!s.exhibits.includes(p.id)) s.exhibits.push(p.id); } },
    openHearing: { when: s => s.background && all(s.exhibits, EXHIBIT_IDS) && !s.opened, apply: s => { s.opened = true; } },
    hearParty: { when: (s, p) => s.opened && SIDES.includes(p.side), apply: (s, p) => { if (!s.heard.includes(p.side)) s.heard.push(p.side); } },
    // Un testigo se desahoga completo: sus objeciones se resuelven dentro del interrogatorio.
    ruleObjection: { when: (s, p) => all(s.heard, SIDES) && OBJECTION_IDS.includes(p.id) && !s.objections[p.id] && ['ha-lugar', 'no-ha-lugar'].includes(p.ruling), apply: (s, p) => { s.objections[p.id] = p.ruling; } },
    examineWitness: { when: (s, p) => all(s.heard, SIDES) && WITNESS_IDS.includes(p.id) && objectionsOf(witness(p.id)).every(o => s.objections[o]), apply: (s, p) => { if (!s.examined.includes(p.id)) s.examined.push(p.id); } },
    askWitness: { when: (s, p) => s.examined.includes(p.witness) && witness(p.witness).questions.some(q => q.id === p.id), apply: (s, p) => { if (!s.asked.includes(p.id)) s.asked.push(p.id); } },
    confront: {
      when: (s, p) => all(s.examined, WITNESS_IDS) && WITNESSES.every(w => w.questions.some(q => s.asked.includes(q.id))) && p.marks && typeof p.marks === 'object' &&
        Object.entries(p.marks).every(([st, ex]) => availableStatements(s).some(x => x.id === st) && (ex === null || EXHIBIT_IDS.includes(ex))),
      apply: (s, p) => { s.confronted = { ...p.marks }; }
    },
    weigh: { when: (s, p) => Boolean(s.confronted) && EXHIBIT_IDS.includes(p.id) && WEIGHTS.some(w => w.id === p.weight), apply: (s, p) => { s.weights[p.id] = p.weight; } },
    rule: {
      when: (s, p) => EXHIBIT_IDS.every(id => s.weights[id]) && RULINGS.some(r => r.id === p.ruling) && Array.isArray(p.grounds) && p.grounds.length >= 1 && p.grounds.length <= 3 && p.grounds.every(id => GROUNDS.some(g => g.id === id)),
      apply: (s, p) => { s.ruling = p.ruling; s.grounds = [...new Set(p.grounds)]; }
    }
  }
};
