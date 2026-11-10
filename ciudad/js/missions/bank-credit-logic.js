// Misión 1 · Banco ICADEM · "El crédito correcto" — reglas y cálculo (módulo puro).
// Aquí vive todo lo que decide el resultado: en Fase 3 este mismo archivo corre en el servidor
// para validar la misión antes de acreditar.

export const MISSION_ID = 'banco-credito-correcto';

export const CLIENT = Object.freeze({
  name: 'Lucía',
  business: 'Panadería La Espiga',
  amount: 120000,
  purpose: 'un horno de convección nuevo',
  income: 48000,
  expenses: 39500,
  maxPayment: 6800
});

/** Las tres propuestas. Datos ficticios, pensados para que cada una "gane" en algo distinto. */
export const PROPOSALS = Object.freeze([
  { id: 'expres', name: 'Crédito Exprés', executive: 'Ejecutivo Bruno', annualRate: 0.38, months: 24, openingFee: 0.03, insurance: 0, perk: 'Respuesta el mismo día' },
  { id: 'pyme', name: 'Crédito PyME', executive: 'Ejecutiva Renata', annualRate: 0.24, months: 24, openingFee: 0.02, insurance: 150, perk: 'Incluye seguro del equipo' },
  { id: 'comodo', name: 'Crédito Cuota Cómoda', executive: 'Ejecutivo Mateo', annualRate: 0.29, months: 48, openingFee: 0, insurance: 0, perk: 'Sin comisión por apertura' }
]);

export const DOCUMENTS = Object.freeze(['solicitud', 'flujo']);

export const REASONS = Object.freeze([
  { id: 'costo', text: 'Es la que menos cuesta en total', correct: true },
  { id: 'capacidad', text: 'La mensualidad cabe en lo que puede pagar', correct: true },
  { id: 'cuota', text: 'Tiene la mensualidad más baja de las tres', correct: false },
  { id: 'rapidez', text: 'Es la que se aprueba más rápido', correct: false },
  { id: 'comision', text: 'No cobra comisión por apertura', correct: false }
]);

const round2 = n => Math.round(n * 100) / 100;

/** Pago fijo mensual de un crédito con tasa anual nominal (sistema francés). */
export function monthlyPayment(principal, annualRate, months) {
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** Desglose de una propuesta para el monto que pide la clienta. */
export function analyze(proposal, amount = CLIENT.amount, maxPayment = CLIENT.maxPayment) {
  const base = monthlyPayment(amount, proposal.annualRate, proposal.months);
  const payment = base + proposal.insurance;
  const fee = amount * proposal.openingFee;
  const totalCost = payment * proposal.months + fee;
  return {
    id: proposal.id,
    payment: round2(payment),
    fee: round2(fee),
    totalCost: round2(totalCost),
    extraCost: round2(totalCost - amount),
    fits: payment <= maxPayment
  };
}

export function analyzeAll() { return PROPOSALS.map(p => analyze(p)); }

/** La mejor opción: la de menor costo total entre las que la clienta sí puede pagar. */
export function bestProposalId() {
  const viable = analyzeAll().filter(a => a.fits).sort((a, b) => a.totalCost - b.totalCost);
  return viable.length ? viable[0].id : null;
}

export function newAttempt() {
  return { talked: false, documents: [], proposals: [], compared: false, choice: null, reasons: [] };
}

/** ¿Qué paso sigue? Sirve para el rastreador de misión y para bloquear atajos. */
export function nextStep(a) {
  if (!a.talked) return 'talk';
  if (DOCUMENTS.some(d => !a.documents.includes(d))) return 'documents';
  if (PROPOSALS.some(p => !a.proposals.includes(p.id))) return 'proposals';
  if (!a.compared) return 'compare';
  if (!a.choice) return 'choose';
  if (!a.reasons.length) return 'justify';
  return 'done';
}

/**
 * Evalúa un intento. No confía en un "marcador": reconstruye el resultado a partir de lo que
 * el jugador realmente hizo. Un intento incompleto no es válido y no da recompensa.
 */
export function evaluate(attempt) {
  const a = { ...newAttempt(), ...attempt };
  const documents = [...new Set(a.documents)].filter(d => DOCUMENTS.includes(d));
  const proposals = [...new Set(a.proposals)].filter(id => PROPOSALS.some(p => p.id === id));
  const reasons = [...new Set(a.reasons)].filter(id => REASONS.some(r => r.id === id));
  const choice = PROPOSALS.some(p => p.id === a.choice) ? a.choice : null;

  const complete = a.talked === true && documents.length === DOCUMENTS.length &&
    proposals.length === PROPOSALS.length && a.compared === true && Boolean(choice) &&
    reasons.length >= 1 && reasons.length <= 2;
  if (!complete) return { valid: false, score: 0, passed: false, best: bestProposalId(), choice, breakdown: null };

  const best = bestProposalId();
  const analysis = analyzeAll();
  const chosen = analysis.find(x => x.id === choice);
  let decision = 0;
  if (choice === best) decision = 60;
  else if (chosen.fits) decision = 25;        // pagable, pero más cara de lo necesario
  else decision = 0;                          // no la puede pagar

  const correctIds = REASONS.filter(r => r.correct).map(r => r.id);
  const hits = reasons.filter(id => correctIds.includes(id)).length;
  const misses = reasons.length - hits;
  const justification = Math.max(0, hits * 15 - misses * 10);

  const research = 10;                        // habló, leyó los dos documentos y vio las tres propuestas
  const score = Math.min(100, decision + justification + research);
  return {
    valid: true, score, passed: score >= 70, best, choice,
    breakdown: { decision, justification, research, hits, misses, chosenFits: chosen.fits }
  };
}

export function money(n) {
  return '$' + Math.round(n).toLocaleString('es-MX');
}
