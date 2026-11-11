// Misión 1 · "El crédito correcto": lo propio de este juego dentro del banco (diálogos,
// documentos, simulador, tablero y recomendación). Lo común —estados, rastreador, cierre,
// recompensa y reintento— lo hereda de MissionController y del motor de misiones.
// Las reglas y la calificación viven en bank-credit-logic.js (módulo puro, el que irá al servidor).
import { CLIENT, PROPOSALS, REASONS, DOCUMENTS, analyze, analyzeAll, money } from './bank-credit-logic.js';
import { MissionController, h } from './controller.js';

const pct = n => (n * 100).toFixed(0) + '%';

export class BankCreditMission extends MissionController {
  /** Estado del intento (lo que el jugador ya hizo). */
  get attempt() { return this.state; }

  /** ¿Este objeto es el siguiente paso? Sirve para resaltar marcadores. */
  wants(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'client') return s === 'talk' || s === 'choose' || s === 'justify';
    if (kind === 'documents') return s === 'documents';
    if (kind === 'proposal') return s === 'proposals' && !a.proposals.includes(id);
    if (kind === 'simulator') return s === 'simulate';
    if (kind === 'compare') return s === 'compare';
    return false;
  }

  labelFor(kind, id) {
    const s = this.step;
    if (kind === 'client') return s === 'talk' ? 'Hablar con Lucía' : (s === 'choose' || s === 'justify') ? 'Dar tu recomendación a Lucía' : 'Hablar con Lucía';
    if (kind === 'documents') return 'Revisar los documentos';
    if (kind === 'proposal') { const p = PROPOSALS.find(x => x.id === id); return `Pedir propuesta: ${p.name}`; }
    if (kind === 'simulator') return 'Usar la computadora · simulador de crédito';
    if (kind === 'compare') return 'Usar el tablero comparativo';
    return 'Usar';
  }

  talkToClient(npc) {
    return this.guard(async () => {
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
          this.act('talk');
          this.api.player.emote('wave');
        } else if (s === 'choose' || s === 'justify') {
          await this.recommend();
        } else {
          const hints = {
            documents: 'Mis documentos están en la mesa redonda, aquí junto. Ahí viene cuánto gano y cuánto gasto.',
            proposals: 'Los ejecutivos están en los escritorios del otro lado. Pídeles a los tres su propuesta, por favor.',
            simulate: 'Las hojas no dicen cuánto pagaría al mes. Hay una computadora con el simulador de crédito junto a la entrada: calcula ahí las tres.',
            compare: 'Hay un tablero comparativo en el centro del banco. Ahí puedes ver las tres propuestas lado a lado.'
          };
          await ui.dialog({ speaker: 'Lucía', lines: [hints[s] || 'Gracias por ayudarme.'] });
        }
      } finally { npc.talking = false; }
    });
  }

  openDocuments() {
    return this.guard(async () => {
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
        this.run.act('readDocument', { id });
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
    return this.guard(async () => {
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
      card.append(dl, h('p', 'proposal__note', 'La mensualidad y el costo total no vienen en la hoja: se calculan en la computadora del simulador de crédito.'));
      await ui.modal({ eyebrow: p.executive, title: p.name, content: card, actions: [{ id: 'ok', label: 'Guardar propuesta', primary: true }] });
      if (!a.proposals.includes(id) && this.act('takeProposal', { id })) ui.toast(a.proposals.length === PROPOSALS.length ? 'Ya tienes las tres. Calcúlalas en la computadora del simulador.' : `Propuesta guardada (${a.proposals.length} de ${PROPOSALS.length}).`);
    });
  }

  /** Computadora del banco: el jugador corre cada propuesta en el simulador de crédito. */
  openSimulator() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.proposals.length) {
        await ui.dialog({ speaker: 'Simulador de crédito', lines: [a.talked ? 'No hay propuestas cargadas. Pide la suya a cada ejecutivo y vuelve para calcularlas.' : 'Sistema del banco. Para usarlo necesitas las propuestas de un cliente.'] });
        return;
      }
      const wrap = h('div', 'sim'), tabs = h('div', 'sim__tabs'), sheet = h('div', 'sim__sheet'), out = h('div', 'sim__out');
      let current = (PROPOSALS.find(p => a.proposals.includes(p.id) && !a.simulated.includes(p.id)) || PROPOSALS.find(p => a.proposals.includes(p.id))).id;
      const paint = () => tabs.querySelectorAll('button').forEach(b => { b.classList.toggle('is-on', b.dataset.id === current); b.classList.toggle('is-done', a.simulated.includes(b.dataset.id)); });
      const showResult = (p, animate) => {
        const x = analyze(p), top = Math.max(x.payment, CLIENT.maxPayment) * 1.12;
        out.replaceChildren();
        const big = h('div', 'sim__big'); const num = h('b', null, money(animate ? 0 : x.payment)); big.append(h('span', null, 'Mensualidad'), num, h('span', 'pill ' + (x.fits ? 'pill--ok' : 'pill--bad'), x.fits ? 'Cabe en su presupuesto' : 'No le alcanza'));
        const bar = h('div', 'sim__bar'), fill = h('i', x.fits ? 'is-ok' : 'is-bad'), limit = h('em', null, 'Tope ' + money(CLIENT.maxPayment));
        limit.style.left = (CLIENT.maxPayment / top * 100) + '%'; bar.append(fill, limit);
        const dl = h('dl', 'sim__totals');
        [['Total a pagar', money(x.totalCost)], ['Costo del crédito', money(x.extraCost)], ['Comisión por apertura', x.fee ? money(x.fee) : 'Sin comisión']].forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v)));
        out.append(big, bar, dl);
        if (!animate) { fill.style.width = (x.payment / top * 100) + '%'; return; }
        const t0 = performance.now(), tick = now => { const k = Math.min(1, (now - t0) / 650), e = 1 - Math.pow(1 - k, 3); num.textContent = money(x.payment * e); fill.style.width = (x.payment / top * 100 * e) + '%'; if (k < 1 && num.isConnected) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      };
      const show = id => {
        current = id; paint();
        const p = PROPOSALS.find(x => x.id === id);
        sheet.replaceChildren(h('h4', null, p.name));
        const dl = h('dl');
        [['Monto', money(CLIENT.amount)], ['Tasa anual', pct(p.annualRate)], ['Plazo', p.months + ' meses'], ['Comisión', p.openingFee ? pct(p.openingFee) : '0%'], ['Seguro mensual', p.insurance ? money(p.insurance) : '—']].forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v)));
        const run = h('button', 'btn btn--primary sim__run', a.simulated.includes(id) ? 'Volver a calcular' : 'Calcular'); run.type = 'button';
        run.addEventListener('click', () => {
          const first = !a.simulated.includes(id);
          if (!this.act('simulate', { id })) return;
          run.textContent = 'Volver a calcular'; paint(); showResult(p, true);
          if (first && a.simulated.length === PROPOSALS.length) ui.toast('Las tres quedaron calculadas. Míralas juntas en el tablero comparativo.');
        });
        sheet.append(dl, run);
        if (a.simulated.includes(id)) showResult(p, false);
        else out.replaceChildren(h('p', 'sim__empty', 'Presiona «Calcular» para obtener la mensualidad y el costo total de esta propuesta.'));
      };
      PROPOSALS.forEach(p => {
        const b = h('button', null, p.name); b.type = 'button'; b.dataset.id = p.id;
        if (a.proposals.includes(p.id)) b.addEventListener('click', () => show(p.id)); else { b.disabled = true; b.title = 'Aún no tienes esta propuesta'; }
        tabs.append(b);
      });
      const body = h('div', 'sim__body'); body.append(sheet, out);
      wrap.append(tabs, body, h('p', 'compare__note', `Lucía pide ${money(CLIENT.amount)} y puede pagar hasta ${money(CLIENT.maxPayment)} al mes. Calcula las tres propuestas para poder compararlas.`)); show(current);
      await ui.modal({ eyebrow: 'Computadora del banco', title: 'Simulador de crédito', content: wrap, wide: true, actions: [{ id: 'ok', label: 'Cerrar', primary: true }] });
    });
  }

  openComparison() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (a.simulated.length < PROPOSALS.length) {
        await ui.dialog({ speaker: 'Tablero comparativo', lines: [a.proposals.length < PROPOSALS.length
          ? `Faltan propuestas: llevas ${a.proposals.length} de ${PROPOSALS.length}. Pídelas a los ejecutivos.`
          : `El tablero muestra lo que calcules en la computadora del simulador. Llevas ${a.simulated.length} de ${PROPOSALS.length}.`] });
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
      if (this.act('compare')) ui.toast('Ve con Lucía y dale tu recomendación.');
    });
  }

  async recommend() {
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
    this.act('choose', { id: chosen });
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
    if (r2 !== 'ok') { this.act('unchoose'); return; }
    if (!this.act('justify', { reasons: [...picked] })) return;
    await this.close();
  }

  /** Cierre: la parte común la hace el controlador base; aquí va la explicación de este caso. */
  async close() {
    const ui = this.api.ui;
    const out = await this.finish(result => {
      const best = PROPOSALS.find(p => p.id === result.best), chosen = PROPOSALS.find(p => p.id === result.choice);
      const data = analyzeAll(), bx = data.find(d => d.id === best.id), cx = data.find(d => d.id === chosen.id);
      const ex = data.find(d => d.id === 'expres'), co = data.find(d => d.id === 'comodo'), b = result.breakdown;
      const lucia = result.choice === result.best
        ? '¡Justo lo que necesitaba! Me alcanza cada mes y no pago de más. Muchas gracias.'
        : cx.fits ? 'Mmm… sí puedo pagarla, pero voy a terminar pagando bastante más. Ojalá hubiera una mejor.' : 'Uy, esa mensualidad no me alcanza. Me voy a atrasar con los pagos…';
      return {
        before: () => ui.dialog({ speaker: 'Lucía', lines: [lucia] }),
        rows: [[`Decisión: ${chosen.name}`, b.decision, 60], ['Justificación', b.justification, 30], ['Investigación completa', b.research, 10]],
        heading: result.choice === result.best ? 'Por qué era la mejor' : `La mejor era ${best.name}`,
        paragraphs: [
          `${best.name} deja la mensualidad en ${money(bx.payment)}, dentro del tope de ${money(CLIENT.maxPayment)}, y es la que menos cuesta en total: ${money(bx.totalCost)}.`,
          `Crédito Exprés pide ${money(ex.payment)} al mes: no le alcanza. Cuota Cómoda baja la mensualidad a ${money(co.payment)}, pero al durar 48 meses cuesta ${money(co.totalCost - bx.totalCost)} más que la mejor opción.`
        ],
        lesson: 'La mensualidad más baja no siempre es el crédito más barato: hay que ver el costo total y que el pago quepa en el presupuesto.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Misión reiniciada. Habla otra vez con Lucía.');
  }
}
