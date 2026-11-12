// Misión 9 · Oficina ICADEM · "El expediente perdido" — reglas y calificación (módulo puro).
// Todo lo que decide el resultado vive aquí y este mismo archivo corre en el servidor.
//
// El caso: mañana hay auditoría y el expediente de compra EXP-2311 (50 cajas de hojas a
// Papelería Lumen) está regado por la oficina. Hay que consultar el registro de control, buscar
// en archiveros y bandejas, tomar solo los documentos de ese folio (hay folios parecidos),
// ordenarlos, detectar las inconsistencias, decidir qué hacer con el pago y archivarlo bien.

export const MISSION_ID = 'oficina-expediente-perdido';
export const MANAGER = Object.freeze({ name: 'Lic. Paola', role: 'Coordinadora administrativa' });
export const FOLIO = '2311';

/** Documentos que aparecen en la oficina (los del expediente y los parecidos). */
export const DOCS = Object.freeze([
  { id: 'sol', folio: '2311', kind: 'Solicitud de compra', date: '2025-09-01', fields: [['Área', 'Administración'], ['Artículo', 'Hojas carta'], ['Cantidad', '50 cajas'], ['Firma', 'Jefa de área']], belongs: true, rank: 1 },
  { id: 'cot', folio: '2311', kind: 'Cotización · Papelería Lumen', date: '2025-09-03', fields: [['Cantidad', '50 cajas'], ['Precio unitario', '$248'], ['Total', '$12,400'], ['Vigencia', '15 días']], belongs: true, rank: 2 },
  { id: 'oc', folio: '2311', kind: 'Orden de compra', date: '2025-09-05', fields: [['Proveedor', 'Papelería Lumen'], ['Cantidad', '50 cajas'], ['Total autorizado', '$12,400'], ['Firma', 'Dirección']], belongs: true, rank: 3 },
  { id: 'rec', folio: '2311', kind: 'Acta de recepción · Almacén', date: '2025-09-10', fields: [['Proveedor', 'Papelería Lumen'], ['Cantidad recibida', '40 cajas'], ['Observación', 'Entrega parcial'], ['Firma', 'Almacén']], belongs: true, rank: 4 },
  { id: 'fac', folio: '2311', kind: 'Factura · Papelería Lumen', date: '2025-09-12', fields: [['Cantidad', '50 cajas'], ['Total', '$14,200'], ['Referencia', 'OC 2311'], ['Estado', 'Pendiente de pago']], belongs: true, rank: 5 },
  { id: 'x1', folio: '2307', kind: 'Factura · Papelería Lumen', date: '2025-08-28', fields: [['Cantidad', '20 cajas'], ['Total', '$4,960'], ['Referencia', 'OC 2307'], ['Estado', 'Pagada']], belongs: false },
  { id: 'x2', folio: '2331', kind: 'Orden de compra', date: '2025-09-06', fields: [['Proveedor', 'Cafetería Andén'], ['Cantidad', '12 paquetes'], ['Total autorizado', '$1,860'], ['Firma', 'Dirección']], belongs: false },
  { id: 'x3', folio: '2113', kind: 'Solicitud de compra', date: '2025-09-01', fields: [['Área', 'Mantenimiento'], ['Artículo', 'Focos LED'], ['Cantidad', '30 piezas'], ['Firma', 'Jefe de área']], belongs: false }
]);
export const docById = id => DOCS.find(d => d.id === id) || null;
const TRUE_IDS = DOCS.filter(d => d.belongs).map(d => d.id), ALL_IDS = DOCS.map(d => d.id);
export const CHRONO = Object.freeze(DOCS.filter(d => d.belongs).sort((a, b) => a.rank - b.rank).map(d => d.id));

/** Archiveros y bandejas: dónde quedó cada cosa. */
export const CABINETS = Object.freeze([
  { id: 'A', name: 'Archivero A · Recursos humanos' },
  { id: 'B', name: 'Archivero B · Contabilidad 2200–2299' },
  { id: 'C', name: 'Archivero C · Compras 2300–2399' },
  { id: 'D', name: 'Archivero D · Por archivar' }
]);
export const SPOTS = Object.freeze([
  { id: 'A1', cabinet: 'A', docs: [], note: 'Expedientes del personal' },
  { id: 'A2', cabinet: 'A', docs: [], note: 'Constancias y vacaciones' },
  { id: 'B1', cabinet: 'B', docs: [], note: 'Pólizas contables' },
  { id: 'B2', cabinet: 'B', docs: [], note: 'Estados de cuenta' },
  { id: 'C1', cabinet: 'C', docs: ['sol', 'cot', 'x1'], note: 'Compras 2300–2349' },
  { id: 'C2', cabinet: 'C', docs: ['oc', 'x2'], note: 'Compras 2350–2399 (¡y algo más!)' },
  { id: 'D1', cabinet: 'D', docs: ['rec', 'x3'], note: 'Entregas de almacén' },
  { id: 'D2', cabinet: 'D', docs: [], note: 'Correspondencia' },
  { id: 'scan', cabinet: null, docs: ['fac'], note: 'Bandeja del escáner' }
]);
export const spotById = id => SPOTS.find(s => s.id === id) || null;
const SPOT_IDS = SPOTS.map(s => s.id);
export const NEEDED_SPOTS = Object.freeze(SPOTS.filter(s => s.docs.some(d => TRUE_IDS.includes(d))).map(s => s.id));
const spotOf = docId => SPOTS.find(s => s.docs.includes(docId));

/** Lo que dice el registro de control (la pista para no abrir todo). */
export const INDEX_ENTRY = Object.freeze([
  ['Expediente', 'EXP-2311 · Hojas carta · Papelería Lumen'],
  ['Ubicación', 'Archivero C · Compras 2300–2399'],
  ['Movimiento 10/09', 'Almacén envió el acta de recepción a «Por archivar» (archivero D, cajón de entregas)'],
  ['Movimiento 12/09', 'Factura recibida y escaneada; quedó en la bandeja del escáner']
]);

export const FINDINGS = Object.freeze([
  { id: 'monto', text: 'La factura cobra $14,200 y la orden de compra autorizó $12,400', correct: true },
  { id: 'cantidad', text: 'Almacén recibió 40 cajas, pero la factura cobra 50', correct: true },
  { id: 'fechas', text: 'La cotización tiene fecha posterior a la solicitud', correct: false },
  { id: 'proveedor', text: 'La factura es de un proveedor distinto al de la orden de compra', correct: false },
  { id: 'firma', text: 'La orden de compra no está autorizada', correct: false }
]);
export const RESOLUTIONS = Object.freeze([
  { id: 'retener', text: 'Retener el pago y pedir al proveedor una factura corregida por lo recibido (40 cajas a $248)', correct: true },
  { id: 'pagar', text: 'Pagar la factura como viene para no atrasar al proveedor', correct: false },
  { id: 'corregir', text: 'Corregir a mano el total en la factura y pagar', correct: false },
  { id: 'cancelar', text: 'Cancelar toda la compra y devolver las 40 cajas', correct: false }
]);
export const REASONS = Object.freeze([
  { id: 'trazabilidad', text: 'Cada documento respalda al anterior: solicitud, cotización, orden, recepción y factura', correct: true },
  { id: 'no-alterar', text: 'Un documento con error no se corrige a mano: se pide al emisor que lo corrija', correct: true },
  { id: 'rapidez', text: 'Lo importante es pagar rápido; los papeles se arreglan después', correct: false },
  { id: 'memoria', text: 'Si recuerdo dónde guardé algo, no hace falta registrarlo', correct: false },
  { id: 'parecido', text: 'Un folio parecido sirve si el proveedor es el mismo', correct: false }
]);

export function newAttempt() {
  return { briefed: false, indexed: false, searched: [], taken: [], order: [], flags: [], resolution: null, filed: null, reasons: [] };
}

const allFound = a => TRUE_IDS.every(id => a.taken.includes(id));
const ordered = a => a.order.length > 0;

export function nextStep(a) {
  if (!a.briefed) return 'brief';
  if (!a.indexed) return 'index';
  if (!allFound(a)) return 'search';
  if (!ordered(a)) return 'order';
  if (!a.flags.length) return 'review';
  if (!a.resolution) return 'resolve';
  if (!a.filed) return 'file';
  if (!a.reasons.length) return 'debrief';
  return 'done';
}

export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const complete = a.briefed && a.indexed && allFound(a) && ordered(a) && a.flags.length > 0 && Boolean(a.resolution) && Boolean(a.filed) &&
    reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, breakdown: null };

  const decoys = a.taken.filter(id => !TRUE_IDS.includes(id)).length;
  const extra = a.searched.filter(id => !NEEDED_SPOTS.includes(id)).length;
  const busqueda = Math.max(0, 20 - decoys * 5 - extra * 2);                                          // 20
  const seq = a.order.filter(id => TRUE_IDS.includes(id));
  let pairs = 0; for (let i = 0; i + 1 < CHRONO.length; i++) if (seq.indexOf(CHRONO[i]) >= 0 && seq.indexOf(CHRONO[i]) + 1 === seq.indexOf(CHRONO[i + 1])) pairs++;
  const orden = pairs * 5;                                                                             // 20
  const flagHits = a.flags.filter(id => (FINDINGS.find(f => f.id === id) || {}).correct).length, flagMiss = a.flags.length - flagHits;
  const inconsistencias = Math.max(0, flagHits * 10 - flagMiss * 5);                                    // 20
  const resolucion = (RESOLUTIONS.find(r => r.id === a.resolution) || {}).correct ? 15 : 0;            // 15
  const archivo = a.filed === 'C' ? 10 : 0;                                                            // 10
  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length, misses = reasons.length - hits;
  const justificacion = Math.max(0, Math.min(10, hits * 5 - misses * 5));                             // 10
  const research = 5;                                                                                  // consultó el registro de control
  const score = Math.min(100, busqueda + orden + inconsistencias + resolucion + archivo + justificacion + research);
  return { valid: true, score, passed: score >= 70,
    breakdown: { busqueda, orden, inconsistencias, resolucion, archivo, justificacion, research, decoys, extra, pairs, flagHits, flagMiss, hits, misses } };
}

export const LOST_FILE_MISSION = {
  id: MISSION_ID,
  building: 'oficina',
  title: 'El expediente perdido',
  difficulty: 'intermedia',
  reward: { amount: 20, xp: 160, repeatXp: 40 },
  newState: newAttempt,
  evaluate,
  objectives: [
    { id: 'brief', text: 'Habla con la Lic. Paola', done: s => s.briefed },
    { id: 'index', text: 'Consulta el registro de control', done: s => s.indexed },
    { id: 'search', text: 'Encuentra los documentos del EXP-2311', done: allFound, detail: s => `${TRUE_IDS.filter(id => s.taken.includes(id)).length}/${TRUE_IDS.length}` },
    { id: 'order', text: 'Ordena el expediente en la mesa', done: ordered },
    { id: 'review', text: 'Marca las inconsistencias', done: s => s.flags.length > 0 },
    { id: 'resolve', text: 'Decide qué hacer con el pago', done: s => Boolean(s.resolution) },
    { id: 'file', text: 'Archiva el expediente en su lugar', done: s => Boolean(s.filed) },
    { id: 'debrief', text: 'Cierra el caso con la Lic. Paola', done: s => s.reasons.length > 0 }
  ],
  actions: {
    brief: { apply: s => { s.briefed = true; } },
    index: { when: s => s.briefed, apply: s => { s.indexed = true; } },
    search: { when: (s, p) => s.indexed && SPOT_IDS.includes(p.id), apply: (s, p) => { if (!s.searched.includes(p.id)) s.searched.push(p.id); } },
    take: {
      when: (s, p) => ALL_IDS.includes(p.id) && !s.taken.includes(p.id) && s.searched.includes(spotOf(p.id).id) && !ordered(s),
      apply: (s, p) => { s.taken.push(p.id); }
    },
    putBack: { when: (s, p) => s.taken.includes(p.id) && !ordered(s), apply: (s, p) => { s.taken = s.taken.filter(id => id !== p.id); } },
    order: {
      when: (s, p) => allFound(s) && Array.isArray(p.ids) && p.ids.length === s.taken.length && new Set(p.ids).size === p.ids.length && p.ids.every(id => s.taken.includes(id)),
      apply: (s, p) => { s.order = [...p.ids]; }
    },
    flag: {
      when: (s, p) => ordered(s) && Array.isArray(p.ids) && p.ids.length >= 1 && p.ids.length <= 3 && p.ids.every(id => FINDINGS.some(f => f.id === id)),
      apply: (s, p) => { s.flags = [...new Set(p.ids)]; }
    },
    resolve: { when: (s, p) => s.flags.length > 0 && RESOLUTIONS.some(r => r.id === p.id), apply: (s, p) => { s.resolution = p.id; } },
    file: { when: (s, p) => Boolean(s.resolution) && CABINETS.some(c => c.id === p.cabinet), apply: (s, p) => { s.filed = p.cabinet; } },
    debrief: {
      when: (s, p) => Boolean(s.filed) && Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.length <= 2 && p.reasons.every(id => REASONS.some(r => r.id === id)),
      apply: (s, p) => { s.reasons = [...new Set(p.reasons)]; }
    }
  }
};
