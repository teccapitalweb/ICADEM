// Misión 1 · "El crédito correcto": controla el flujo dentro del banco.
// Las reglas y la calificación viven en bank-credit-logic.js (módulo puro, el que irá al servidor).
import { MISSION_ID, CLIENT, PROPOSALS, REASONS, DOCUMENTS, analyze, analyzeAll, evaluate, newAttempt, nextStep, money } from './bank-credit-logic.js';
import { REWARDS } from '../economy/economy.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const pct = n => (n * 100).toFixed(0) + '%';

const STEPS = [
  ['talk', 'Habla con Lucía, la clienta'],
  ['documents', 'Revisa sus documentos en la mesa'],
  ['proposals', 'Pide las tres propuestas a los ejecutivos'],
  ['compare', 'Compara tasas y costos en el tablero'],
  ['choose', 'Recomiéndale una opción a Lucía'],
  ['justify', 'Justifica tu decisión']
];

export class BankCreditMission {
  constructor(api) {
    this.api = api;
    this.id = MISSION_ID;
    this.attempt = newAttempt();
    this.active = false;
    this.busy = false;
  }

  get record() { return this.api.store.state.missions[this.id] || { completed: false, bestScore: 0, attempts: 0 }; }
  get step() { return nextStep(this.attempt); }

  /** Se llama al entrar al banco. */
  enter() { this.active = true; this.refreshTracker(); }
  leave() { this.active = false; this.api.ui.setTracker(null); }

  refreshTracker() {
    if (!this.active) return;
    const current = this.step, order = STEPS.map(s => s[0]), idx = order.indexOf(current);
    const a = this.attempt;
    const detail = { documents: `${a.documents.length}/${DOCUMENTS.length}`, proposals: `${a.proposals.length}/${PROPOSALS.length}` };
    this.api.ui.setTracker({
      title: 'El crédito correcto', badge: this.record.completed ? 'Repetición · solo XP' : `+${REWARDS[this.id].amount} créditos de prueba`,
      steps: STEPS.map(([id, text], i) => ({ text, done: idx === -1 || i < idx, active: i === idx, detail: i === idx ? detail[id] : null }))
    });
  }

  /** ¿Este objeto es el siguiente paso? Sirve para resaltar marcadores. */
  wants(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'client') return s === 'talk' || s === 'choose' || s === 'justify';
    if (kind === 'documents') return s === 'documents';
    if (kind === 'proposal') return s === 'proposals' && !a.proposals.includes(id);
    if (kind === 'compare') return s === 'compare';
    return false;
  }

  labelFor(kind, id) {
    const s = this.step;
    if (kind === 'client') return s === 'talk' ? 'Hablar con Lucía' : (s === 'choose' || s === 'justify') ? 'Dar tu recomendación a Lucía' : 'Hablar con Lucía';
    if (kind === 'documents') return 'Revisar los documentos';
    if (kind === 'proposal') { const p = PROPOSALS.find(x => x.id === id); return `Pedir propuesta: ${p.name}`; }
    if (kind === 'compare') return 'Usar el tablero comparativo';
    return 'Usar';
  }

  async #guard(fn) {
    if (this.busy) return;
    this.busy = true;
    try { await fn(); } finally { this.busy = false; this.refreshTracker(); }
  }

  talkToClient(npc) {
    return this.#guard(async () => {
      const ui = this.api.ui, a = this.attempt, s = this.step;
      npc.talking = true;
      try {
        if (s === 'talk') {
          await ui.dialog({ speaker: 'Lucía · Panadería La Espiga', lines: [
            '¡Hola! Qué bueno que alguien me ayuda. Mi horno ya no da para más y quiero comprar uno de convección.',
            `Necesito ${money(CLIENT.amount)}. Tres ejecutivos me ofrecieron créditos distintos y no sé cuál me conviene.`,
            `Ya hice mis cuentas: puedo pagar hasta ${money(CLIENT.maxPayment)} al mes sin apretar el negocio. Y, si se puede, no quiero pagar de más.`,
            'Mis papeles están en la mesa redonda. ¿Me ayudas a revisar todo y me dices cuál elegir?'
          ] });
          a.talked = true;
          this.api.player.emote('wave');
        } else if (s === 'choose' || s === 'justify') {
          await this.#recommend();
        } else {
          const hints = {
            documents: 'Mis documentos están en la mesa redonda, aquí junto. Ahí viene cuánto gano y cuánto gasto.',
            proposals: 'Los ejecutivos están en los escritorios del otro lado. Pídeles a los tres su propuesta, por favor.',
            compare: 'Hay un tablero comparativo en el centro del banco. Ahí puedes poner las tres propuestas lado a lado.'
          };
          await ui.dialog({ speaker: 'Lucía', lines: [hints[s] || 'Gracias por ayudarme.'] });
        }
      } finally { npc.talking = false; }
    });
  }

  openDocuments() {
    return this.#guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.talked) { await ui.dialog({ speaker: 'Expediente', lines: ['Son los papeles de una clienta. Primero habla con ella para saber qué necesita.'] }); return; }
      const libre = CLIENT.income - CLIENT.expenses;
      const docs = {
        solicitud: { title: 'Solicitud de crédito', rows: [['Solicitante', 'Lucía · Panadería La Espiga'], ['Monto solicitado', money(CLIENT.amount)], ['Destino', 'Horno de convección nuevo'], ['Antigüedad del negocio', '6 años'], ['Historial de pagos', 'Sin atrasos']] },
        flujo: { title: 'Flujo mensual del negocio', rows: [['Ingresos promedio', money(CLIENT.income)], ['Gastos fijos y variables', money(CLIENT.expenses)], ['Disponible al mes', money(libre)], ['Tope que se fijó para el crédito', money(CLIENT.maxPayment)]],
          note: `Le sobran ${money(libre)} al mes, pero no quiere comprometerlo todo: dejó ${money(libre - CLIENT.maxPayment)} de colchón para imprevistos.` }
      };
      const wrap = h('div', 'docs');
      const tabs = h('div', 'docs__tabs'), paper = h('div', 'docs__paper');
      const show = id => {
        if (!a.documents.includes(id)) a.documents.push(id);
        tabs.querySelectorAll('button').forEach(b => { b.classList.toggle('is-on', b.dataset.id === id); if (a.documents.includes(b.dataset.id)) b.classList.add('is-read'); });
        const d = docs[id]; paper.replaceChildren(h('h4', null, d.title));
        const dl = h('dl'); d.rows.forEach(([k, v]) => { dl.append(h('dt', null, k), h('dd', null, v)); }); paper.append(dl);
        if (d.note) paper.append(h('p', 'docs__note', d.note));
        this.refreshTracker();
      };
      for (const id of DOCUMENTS) { const b = h('button', null, docs[id].title); b.type = 'button'; b.dataset.id = id; b.addEventListener('click', () => show(id)); tabs.append(b); }
      wrap.append(tabs, paper); show(DOCUMENTS[0]);
      await ui.modal({ eyebrow: 'Expediente de la clienta', title: 'Documentos de Lucía', content: wrap, actions: [{ id: 'ok', label: 'Cerrar', primary: true }],
        validate: () => DOCUMENTS.every(d => a.documents.includes(d)) ? null : 'Te falta abrir el otro documento.' });
    });
  }

  openProposal(id, npc) {
    return this.#guard(async () => {
      const ui = this.api.ui, a = this.attempt, p = PROPOSALS.find(x => x.id === id);
      if (!a.talked) { await ui.dialog({ speaker: p.executive, lines: ['¡Bienvenido! ¿Vienes por un crédito? Si es para la señora de la sala de espera, platica primero con ella.'] }); return; }
      npc.talking = true;
      try {
        await ui.dialog({ speaker: p.executive, lines: [{
          expres: 'Con el Crédito Exprés la señora Lucía tiene su dinero hoy mismo. Sin tanto trámite.',
          pyme: 'El Crédito PyME está pensado para negocios como la panadería. Incluye el seguro del equipo.',
          comodo: 'Con Cuota Cómoda paga poquito cada mes y sin comisión por apertura. Muy relajado.'
        }[id], 'Aquí tienes la propuesta por escrito.'] });
      } finally { npc.talking = false; }
      const card = h('div', 'proposal');
      card.append(h('div', 'proposal__perk', p.perk));
      const dl = h('dl');
      [['Monto', money(CLIENT.amount)], ['Tasa de interés anual', pct(p.annualRate)], ['Plazo', p.months + ' meses'],
        ['Comisión por apertura', p.openingFee ? `${pct(p.openingFee)} (${money(CLIENT.amount * p.openingFee)})` : 'Sin comisión'],
        ['Seguro', p.insurance ? `${money(p.insurance)} al mes` : 'No incluye']].forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v)));
      card.append(dl, h('p', 'proposal__note', 'La mensualidad y el costo total no vienen en la hoja: se calculan en el tablero comparativo.'));
      await ui.modal({ eyebrow: p.executive, title: p.name, content: card, actions: [{ id: 'ok', label: 'Guardar propuesta', primary: true }] });
      if (!a.proposals.includes(id)) { a.proposals.push(id); ui.toast(`Propuesta guardada (${a.proposals.length} de ${PROPOSALS.length}).`); }
    });
  }

  openComparison() {
    return this.#guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (a.proposals.length < PROPOSALS.length) {
        await ui.dialog({ speaker: 'Tablero comparativo', lines: [`Faltan propuestas por cargar: llevas ${a.proposals.length} de ${PROPOSALS.length}. Pídelas a los ejecutivos.`] });
        return;
      }
      const data = analyzeAll();
      const wrap = h('div', 'compare');
      const sort = h('div', 'compare__sort'); sort.append(h('span', null, 'Ordenar por'));
      const table = h('div', 'compare__table');
      const render = key => {
        sort.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.key === key));
        const rows = PROPOSALS.map(p => ({ p, x: data.find(d => d.id === p.id) })).sort((m, n) => key === 'rate' ? m.p.annualRate - n.p.annualRate : m.x[key] - n.x[key]);
        table.replaceChildren();
        const head = h('div', 'compare__row compare__row--head'); ['Crédito', 'Tasa anual', 'Plazo', 'Mensualidad', 'Costo total', '¿Le alcanza?'].forEach(t => head.append(h('span', null, t))); table.append(head);
        rows.forEach(({ p, x }) => {
          const r = h('div', 'compare__row');
          r.append(h('strong', null, p.name), h('span', null, pct(p.annualRate)), h('span', null, p.months + ' meses'), h('span', null, money(x.payment)), h('span', null, money(x.totalCost)));
          const fit = h('span', 'pill ' + (x.fits ? 'pill--ok' : 'pill--bad'), x.fits ? 'Sí' : 'No'); r.append(fit); table.append(r);
        });
      };
      [['payment', 'Mensualidad'], ['totalCost', 'Costo total'], ['rate', 'Tasa']].forEach(([k, t]) => { const b = h('button', null, t); b.type = 'button'; b.dataset.key = k; b.addEventListener('click', () => render(k)); sort.append(b); });
      wrap.append(sort, table, h('p', 'compare__note', `Lucía pide ${money(CLIENT.amount)} y puede pagar hasta ${money(CLIENT.maxPayment)} al mes. El costo total suma todas las mensualidades, el seguro y la comisión.`));
      render('payment');
      await ui.modal({ eyebrow: 'Tablero comparativo', title: 'Las tres propuestas, lado a lado', content: wrap, wide: true, actions: [{ id: 'ok', label: 'Ya tengo mi decisión', primary: true }] });
      a.compared = true;
      ui.toast('Ve con Lucía y dale tu recomendación.');
    });
  }

  async #recommend() {
    const ui = this.api.ui, a = this.attempt;
    // 1) elegir
    const pick = h('div', 'pick');
    let chosen = a.choice;
    PROPOSALS.forEach(p => {
      const x = analyze(p);
      const b = h('button', 'pick__card'); b.type = 'button'; b.dataset.id = p.id;
      b.append(h('strong', null, p.name), h('span', null, `${money(x.payment)} al mes · ${p.months} meses`), h('small', null, `Costo total ${money(x.totalCost)}`));
      b.addEventListener('click', () => { chosen = p.id; pick.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); });
      if (chosen === p.id) b.classList.add('is-on');
      pick.append(b);
    });
    const r1 = await ui.modal({ eyebrow: 'Tu recomendación', title: '¿Qué crédito le conviene a Lucía?', content: pick,
      actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Recomendar', primary: true }], validate: id => id === 'ok' && !chosen ? 'Elige una de las tres opciones.' : null });
    if (r1 !== 'ok') return;
    a.choice = chosen;
    this.refreshTracker();
    // 2) justificar
    const why = h('div', 'why');
    const picked = new Set();
    REASONS.forEach(r => {
      const b = h('button', 'why__item', r.text); b.type = 'button';
      b.addEventListener('click', () => {
        if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < 2) picked.add(r.id); else { ui.toast('Elige máximo dos razones.'); return; }
        b.classList.toggle('is-on', picked.has(r.id));
      });
      why.append(b);
    });
    const name = PROPOSALS.find(p => p.id === chosen).name;
    const r2 = await ui.modal({ eyebrow: 'Justifica tu decisión', title: `¿Por qué ${name}?`, content: why, hint: 'Elige una o dos razones.',
      actions: [{ id: 'back', label: 'Cambiar de opción' }, { id: 'ok', label: 'Confirmar', primary: true }], validate: id => id === 'ok' && picked.size === 0 ? 'Elige al menos una razón.' : null });
    if (r2 !== 'ok') { a.choice = null; return; }
    a.reasons = [...picked];
    await this.#finish();
  }

  async #finish() {
    const { ui, store, economy } = this.api;
    const result = evaluate(this.attempt);
    if (!result.valid) { ui.toast('Faltan pasos de la misión.'); return; }
    const before = this.record, reward = REWARDS[this.id];
    const firstPass = result.passed && !before.completed;
    store.state.missions[this.id] = { completed: before.completed || result.passed, bestScore: Math.max(before.bestScore || 0, result.score), attempts: (before.attempts || 0) + 1 };
    store.save();
    let credits = 0, xp = 0;
    if (result.passed) {
      // La llave es estable: aunque esto se ejecute dos veces, solo acredita una.
      const grant = await economy.grant({ key: 'mission:' + this.id, amount: reward.amount, reason: 'Misión: El crédito correcto' });
      credits = grant.granted ? grant.amount : 0;
      xp = firstPass ? reward.xp : reward.repeatXp;
      store.addXp(xp);
      if (store.unlock('primera-mision')) ui.toast('Logro desbloqueado: Primera misión');
      if (result.score === 100 && store.unlock('decision-impecable')) ui.toast('Logro desbloqueado: Decisión impecable');
      this.api.player.emote('celebrate', 2.4);
    }
    const best = PROPOSALS.find(p => p.id === result.best), chosen = PROPOSALS.find(p => p.id === result.choice);
    const data = analyzeAll(), bx = data.find(d => d.id === best.id), cx = data.find(d => d.id === chosen.id);
    const lucia = result.choice === result.best
      ? '¡Justo lo que necesitaba! Me alcanza cada mes y no pago de más. Muchas gracias.'
      : cx.fits ? 'Mmm… sí puedo pagarla, pero voy a terminar pagando bastante más. Ojalá hubiera una mejor.' : 'Uy, esa mensualidad no me alcanza. Me voy a atrasar con los pagos…';
    await ui.dialog({ speaker: 'Lucía', lines: [lucia] });

    const body = h('div', 'result');
    const score = h('div', 'result__score'); score.append(h('b', null, String(result.score)), h('span', null, 'de 100'));
    const list = h('ul', 'result__list');
    const b = result.breakdown;
    [[`Decisión: ${chosen.name}`, b.decision, 60], ['Justificación', b.justification, 30], ['Investigación completa', b.research, 10]].forEach(([t, v, max]) => { const li = h('li'); li.append(h('span', null, t), h('b', null, `${v}/${max}`)); list.append(li); });
    const why = h('div', 'result__why');
    why.append(h('h4', null, result.choice === result.best ? 'Por qué era la mejor' : `La mejor era ${best.name}`));
    why.append(h('p', null, `${best.name} deja la mensualidad en ${money(bx.payment)}, dentro del tope de ${money(CLIENT.maxPayment)}, y es la que menos cuesta en total: ${money(bx.totalCost)}.`));
    const ex = data.find(d => d.id === 'expres'), co = data.find(d => d.id === 'comodo');
    why.append(h('p', null, `Crédito Exprés pide ${money(ex.payment)} al mes: no le alcanza. Cuota Cómoda baja la mensualidad a ${money(co.payment)}, pero al durar 48 meses cuesta ${money(co.totalCost - bx.totalCost)} más que la mejor opción.`));
    why.append(h('p', 'result__lesson', 'La mensualidad más baja no siempre es el crédito más barato: hay que ver el costo total y que el pago quepa en el presupuesto.'));
    const rewards = h('div', 'result__rewards');
    if (result.passed) {
      rewards.append(h('span', 'pill pill--gold', credits ? `+${credits} créditos de prueba` : 'Créditos ya entregados antes'), h('span', 'pill pill--blue', `+${xp} XP`));
    } else rewards.append(h('span', 'pill pill--bad', 'Necesitas 70 puntos para completar la misión'));
    body.append(score, list, why, rewards);
    const action = await ui.modal({ eyebrow: result.passed ? 'Misión completada' : 'Misión no superada', title: result.passed ? 'El crédito correcto' : 'Vuelve a intentarlo', content: body, wide: true,
      actions: [{ id: 'retry', label: 'Repetir misión' }, { id: 'ok', label: 'Continuar', primary: true }] });
    this.attempt = newAttempt();
    ui.refreshHud();
    if (action === 'retry') ui.toast('Misión reiniciada. Habla otra vez con Lucía.');
  }
}
