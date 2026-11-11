// Misión 3 · "Rescate de inventario": lo propio del Supermercado (diálogos, conteos, mesa de
// revisión, refrigerador PEPS y terminal de ajustes). Lo común lo hereda de MissionController.
// Las reglas y la calificación viven en market-inventory-logic.js (módulo puro, el del servidor).
import { TODAY, MANAGER, SHELVES, PRODUCTS, LOTS, REASONS, BEST_ORDER, shelfById, productById, deltaOf } from './market-inventory-logic.js';
import { MissionController, h } from './controller.js';

export class MarketInventoryMission extends MissionController {
  get attempt() { return this.state; }

  wants(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'manager') return s === 'talk' || s === 'report' || s === 'justify';
    if (kind === 'ledger') return s === 'ledger';
    if (kind === 'count') return s === 'count' && !a.counted[id];
    if (kind === 'review') return s === 'review';
    if (kind === 'fridge') return s === 'fridge' || (s === 'count' && !a.counted.lacteos);
    if (kind === 'adjust') return s === 'adjust';
    return false;
  }

  labelFor(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'manager') return s === 'talk' ? 'Hablar con don Ramiro' : (s === 'report' || s === 'justify') ? 'Entregar tu reporte a don Ramiro' : 'Hablar con don Ramiro';
    if (kind === 'ledger') return 'Consultar el inventario del sistema';
    if (kind === 'count') return `Contar: ${shelfById(id).name}`;
    if (kind === 'review') return 'Revisar los productos apartados';
    if (kind === 'fridge') return !a.counted.lacteos ? 'Contar: Refrigerador de lácteos' : 'Acomodar los lotes (PEPS)';
    if (kind === 'adjust') return 'Registrar ajustes en la terminal';
    return 'Usar';
  }

  talkToManager(npc) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.step;
      npc.talking = true;
      try {
        if (s === 'talk') {
          await ui.dialog({ speaker: `${MANAGER.name} · ${MANAGER.role}`, lines: [
            `Qué bueno que llegas. La auditoría viene ${MANAGER.audit} y el inventario no cuadra.`,
            'Necesito que el sistema diga la verdad: ni una pieza de más, ni una de menos.',
            'Empieza en la oficina: ahí está la computadora con el inventario del sistema.',
            `Hoy es ${TODAY}. Lo que ya no se pueda vender, fuera; y el refrigerador, acomodado como debe ser.`
          ] });
          this.act('talk');
          this.api.player.emote('wave');
        } else if (s === 'report' || s === 'justify') {
          await this.deliverReport(npc);
        } else {
          const hints = {
            ledger: 'Primero ve a la oficina y revisa qué dice el sistema de cada estante.',
            count: 'Cuenta los tres estantes: el refrigerador, la góndola de abarrotes y la mesa de frutas.',
            review: 'En la mesa de revisión hay productos apartados. Decide cuáles se retiran y cuáles se quedan.',
            fridge: 'Acomoda los lotes de leche del refrigerador: ya sabes, lo que caduca primero va al frente.',
            adjust: 'Registra lo que contaste en la terminal, junto a la caja. El sistema debe quedar igualito a la realidad.'
          };
          await ui.dialog({ speaker: MANAGER.name, lines: [hints[s] || 'Gracias por la ayuda.'] });
        }
      } finally { npc.talking = false; }
    });
  }

  openLedger() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.talked) { await ui.dialog({ speaker: 'Computadora de la oficina', lines: ['Sistema de inventario. Habla primero con el gerente para saber qué necesita.'] }); return; }
      const wrap = h('div', 'docs');
      const paper = h('div', 'docs__paper');
      paper.append(h('h4', null, 'Inventario según el sistema'));
      const dl = h('dl');
      SHELVES.forEach(s => dl.append(h('dt', null, s.name), h('dd', null, `${s.system} ${s.unit}`)));
      paper.append(dl, h('p', 'docs__note', 'Esto es lo que el sistema CREE que hay. Tu trabajo es contar lo que de verdad hay en cada estante y registrar la diferencia.'));
      wrap.append(paper);
      await ui.modal({ eyebrow: 'Oficina del gerente', title: 'Inventario del sistema', content: wrap, actions: [{ id: 'ok', label: 'Anotado', primary: true }] });
      if (this.act('readLedger')) ui.toast('Ya sabes qué dice el sistema. Ahora cuenta los estantes.');
    });
  }

  countShelf(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, s = shelfById(id);
      if (!a.ledger) { await ui.dialog({ speaker: s.name, lines: [a.talked ? 'Antes de contar, revisa en la oficina qué dice el sistema: así sabrás contra qué comparar.' : 'Habla primero con el gerente.'] }); return; }
      const again = a.counted[id];
      if (!this.act('countShelf', { id })) return;
      const diff = deltaOf(s);
      await ui.dialog({ speaker: s.name, lines: [
        `Cuentas con calma: ${s.real} ${s.unit}.`,
        diff === 0 ? `El sistema decía ${s.system}. ¡Coincide!` : `El sistema decía ${s.system}: ${diff < 0 ? 'faltan ' + (-diff) : 'sobran ' + diff} ${s.unit}.`
      ] });
      if (!again) ui.toast(SHELVES.every(x => a.counted[x.id]) ? 'Los tres estantes contados. Sigue con la mesa de revisión.' : 'Conteo anotado.');
    });
  }

  openReview() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.talked) { await ui.dialog({ speaker: 'Mesa de revisión', lines: ['Productos apartados por la empleada. Habla primero con el gerente.'] }); return; }
      const wrap = h('div', 'pick pick--list');
      const paint = () => {
        wrap.replaceChildren();
        PRODUCTS.forEach(p => {
          const card = h('div', 'pick__card pick__card--row');
          const info = h('div');
          info.append(h('strong', null, p.name));
          info.append(h('span', null, a.inspected.includes(p.id) ? p.detail : 'Sin revisar · tócalo para ver su estado'));
          const btns = h('div', 'pick__actions');
          if (a.inspected.includes(p.id)) {
            for (const action of ['retirar', 'conservar']) {
              const b = h('button', 'btn' + (a.decisions[p.id] === action ? ' btn--primary' : ''), action === 'retirar' ? 'Retirar' : 'Conservar');
              b.type = 'button';
              b.addEventListener('click', () => { if (this.act('decide', { id: p.id, action })) paint(); });
              btns.append(b);
            }
          } else {
            const b = h('button', 'btn', 'Revisar'); b.type = 'button';
            b.addEventListener('click', () => { if (this.act('inspect', { id: p.id })) paint(); });
            btns.append(b);
          }
          card.append(info, btns); wrap.append(card);
        });
      };
      paint();
      const body = h('div');
      body.append(h('p', 'docs__note', `Hoy es ${TODAY}. Revisa cada producto y decide: ¿se retira de la venta o se conserva?`), wrap);
      await ui.modal({ eyebrow: 'Mesa de revisión', title: 'Productos apartados', content: body, wide: true,
        actions: [{ id: 'ok', label: 'Listo', primary: true }],
        validate: () => PRODUCTS.every(p => a.decisions[p.id]) ? null : 'Falta decidir qué hacer con algún producto.' });
      ui.toast('Decisiones tomadas. Sigue con el refrigerador.');
    });
  }

  openFridge(countFirst) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.counted.lacteos) { await this.#countInline('lacteos', ui, a); return void (countFirst && this.refreshTracker()); }
      const order = [];
      const wrap = h('div', 'pick');
      const note = h('p', 'docs__note', 'Toca los lotes en el orden en que deben quedar: PRIMERO el que va al frente (el que debe venderse antes).');
      const paint = () => {
        wrap.replaceChildren();
        LOTS.forEach(l => {
          const at = order.indexOf(l.id);
          const b = h('button', 'pick__card' + (at >= 0 ? ' is-on' : ''));
          b.type = 'button';
          b.append(h('strong', null, (at >= 0 ? `${at + 1}º · ` : '') + l.name), h('span', null, 'Caduca el ' + l.expiry));
          b.addEventListener('click', () => { const i = order.indexOf(l.id); if (i >= 0) order.splice(i, 1); else order.push(l.id); paint(); });
          wrap.append(b);
        });
      };
      paint();
      const body = h('div'); body.append(note, wrap);
      const r = await ui.modal({ eyebrow: 'Refrigerador de lácteos', title: 'Acomoda los lotes (PEPS)', content: body,
        actions: [{ id: 'back', label: 'Después' }, { id: 'ok', label: 'Así se quedan', primary: true }],
        validate: id => id === 'ok' && order.length !== LOTS.length ? 'Ordena los tres lotes.' : null });
      if (r !== 'ok') return;
      if (this.act('orderFridge', { order: [...order] })) ui.toast('Refrigerador acomodado. Ahora registra los ajustes en la terminal.');
    });
  }

  async #countInline(id, ui, a) {
    const s = shelfById(id);
    if (!a.ledger) { await ui.dialog({ speaker: s.name, lines: [a.talked ? 'Antes de contar, revisa en la oficina qué dice el sistema.' : 'Habla primero con el gerente.'] }); return; }
    if (!this.act('countShelf', { id })) return;
    const diff = deltaOf(s);
    await ui.dialog({ speaker: s.name, lines: [`Cuentas con calma: ${s.real} ${s.unit}.`, diff === 0 ? `El sistema decía ${s.system}. ¡Coincide!` : `El sistema decía ${s.system}: ${diff < 0 ? 'faltan ' + (-diff) : 'sobran ' + diff} ${s.unit}.`, 'Los lotes se ven revueltos: acomódalos cuando puedas.'] });
  }

  openTerminal() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      const counted = SHELVES.filter(s => a.counted[s.id]);
      if (!counted.length) { await ui.dialog({ speaker: 'Terminal de inventario', lines: [a.ledger ? 'Aquí se registran los ajustes, pero primero cuenta los estantes.' : 'Terminal del sistema. Empieza por la oficina del gerente.'] }); return; }
      const wrap = h('div', 'docs');
      const paper = h('div', 'docs__paper');
      paper.append(h('h4', null, 'Ajuste de inventario'), h('p', 'docs__note', 'Para cada estante, registra la diferencia entre lo contado y lo que decía el sistema.'));
      const paint = () => {
        paper.querySelectorAll('.why').forEach(e => e.remove());
        counted.forEach(s => {
          const row = h('div', 'why');
          row.append(h('strong', null, s.name + ` · sistema: ${s.system} ${s.unit}`));
          const real = deltaOf(s);
          const options = [...new Set([real, 0, -real, real - 2])].filter(d => Number.isInteger(d)).sort((a1, b1) => a1 - b1);
          options.forEach(delta => {
            const label = delta === 0 ? 'Coincide (ajuste 0)' : delta < 0 ? `Faltan ${-delta} (ajustar a ${s.system + delta})` : `Sobran ${delta} (ajustar a ${s.system + delta})`;
            const b = h('button', 'why__item' + (a.adjusted[s.id] === delta ? ' is-on' : ''), label);
            b.type = 'button';
            b.addEventListener('click', () => { if (this.act('adjust', { id: s.id, delta })) paint(); });
            row.append(b);
          });
          paper.append(row);
        });
      };
      paint();
      wrap.append(paper);
      await ui.modal({ eyebrow: 'Terminal junto a la caja', title: 'Registrar ajustes', content: wrap, wide: true,
        actions: [{ id: 'ok', label: 'Guardar registro', primary: true }],
        validate: () => SHELVES.every(s => Number.isInteger(a.adjusted[s.id])) ? (counted.length === SHELVES.length ? null : 'Aún falta contar un estante.') : 'Falta registrar algún estante.' });
      ui.toast('Ajustes registrados. Entrega tu reporte a don Ramiro.');
    });
  }

  async deliverReport(npc) {
    const ui = this.api.ui, a = this.attempt;
    if (this.step === 'report' && !this.act('report')) return;
    await ui.dialog({ speaker: MANAGER.name, lines: ['A ver, cuéntame: ¿por qué tomaste esas decisiones?'] });
    const why = h('div', 'why');
    const picked = new Set(a.reasons);
    REASONS.forEach(r => {
      const b = h('button', 'why__item' + (picked.has(r.id) ? ' is-on' : ''), r.text); b.type = 'button';
      b.addEventListener('click', () => {
        if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < 2) picked.add(r.id); else { ui.toast('Elige máximo dos razones.'); return; }
        b.classList.toggle('is-on', picked.has(r.id));
      });
      why.append(b);
    });
    const r2 = await ui.modal({ eyebrow: 'Tu reporte', title: '¿En qué te basaste?', content: why, hint: 'Elige una o dos razones.',
      actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Entregar reporte', primary: true }],
      validate: id => id === 'ok' && picked.size === 0 ? 'Elige al menos una razón.' : null });
    if (r2 !== 'ok') return;
    if (!this.act('justify', { reasons: [...picked] })) return;
    await this.close();
  }

  async close() {
    const ui = this.api.ui;
    const out = await this.finish(result => {
      const b = result.breakdown;
      const ramiro = result.passed
        ? (result.score === 100 ? '¡Impecable! Con este inventario, la auditoría va a ser un trámite. Gracias.' : 'Buen trabajo. Quedaron un par de detalles, pero el inventario ya dice la verdad.')
        : 'Mmm… así no pasamos la auditoría. Repasemos qué se retira, qué va al frente y qué se registra.';
      return {
        before: () => ui.dialog({ speaker: MANAGER.name, lines: [ramiro] }),
        rows: [['Mesa de revisión', b.retiro, 30], ['Acomodo PEPS', b.peps, 20], ['Ajustes de inventario', b.ajustes, 30], ['Justificación', b.justificacion, 10], ['Investigación completa', b.research, 10]],
        heading: result.passed ? 'Lo que salvó el inventario' : 'Lo que hay que corregir',
        paragraphs: [
          `Se retiran los productos caducados o dañados (${b.removalHits} de ${PRODUCTS.length} decisiones correctas); lo que está por caducar no se tira: se vende primero.`,
          `PEPS: al frente va el lote que caduca primero (${LOTS.find(l => l.id === BEST_ORDER[0]).name}). Y el ajuste registra la diferencia real de cada estante (${b.deltaHits} de ${SHELVES.length} correctos).`
        ],
        lesson: 'Un inventario sirve cuando dice la verdad: lo vencido fuera, lo próximo al frente y el sistema igualito al estante.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Misión reiniciada. Habla otra vez con don Ramiro.');
  }
}
