// Misión 9 · "El expediente perdido": lo propio de la Oficina (registro de control en la
// computadora, archiveros con cajones, bandeja del escáner, mesa de trabajo para ordenar y
// revisar, decisión del pago y archivo). Lo común lo hereda de MissionController.
import { MANAGER, FOLIO, DOCS, CABINETS, SPOTS, INDEX_ENTRY, FINDINGS, RESOLUTIONS, REASONS, docById, spotById } from './lost-file-logic.js';
import { MissionController, h } from './controller.js';

const dmy = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

/** Tarjeta de documento: folio, tipo, fecha y sus datos. */
function docCard(d, { compact = false } = {}) {
  const c = h('div', 'docs__paper');
  c.append(h('h4', null, `${d.kind}`), h('p', 'compare__note', `Folio ${d.folio} · ${dmy(d.date)}`));
  if (!compact) { const dl = h('dl'); d.fields.forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v))); c.append(dl); }
  return c;
}

export class LostFileMission extends MissionController {
  get attempt() { return this.state; }

  wants(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'manager') return s === 'brief' || s === 'resolve' || s === 'debrief';
    if (kind === 'index') return s === 'index';
    if (kind === 'spot') { const spots = SPOTS.filter(x => (x.cabinet || 'scan') === id); return s === 'search' && spots.some(x => !a.searched.includes(x.id)) || (s === 'file' && id !== 'scan'); }
    if (kind === 'table') return s === 'order' || s === 'review';
    return false;
  }

  labelFor(kind, id) {
    const s = this.step;
    if (kind === 'manager') return s === 'resolve' ? `Decidir el pago con la ${MANAGER.name}` : s === 'debrief' ? `Cerrar el caso con la ${MANAGER.name}` : `Hablar con la ${MANAGER.name}`;
    if (kind === 'index') return 'Registro de control (computadora)';
    if (kind === 'spot') return id === 'scan' ? 'Bandeja del escáner' : (s === 'file' ? `Archivar aquí · ${CABINETS.find(c => c.id === id).name}` : CABINETS.find(c => c.id === id).name);
    if (kind === 'table') return s === 'review' ? 'Mesa de trabajo · revisar el expediente' : 'Mesa de trabajo · ordenar el expediente';
    return 'Usar';
  }

  talkToManager(npc) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.step;
      npc.talking = true;
      try {
        if (s === 'brief') {
          await ui.dialog({ speaker: `${MANAGER.name} · ${MANAGER.role}`, lines: [
            '¡Qué bueno que llegas! Mañana hay auditoría y no encuentro el expediente de compra EXP-2311.',
            'Son 50 cajas de hojas a Papelería Lumen, y la factura está por pagarse.',
            'Los papeles se movieron entre áreas. No abras cajón por cajón: consulta primero el registro de control en la computadora.',
            'Cuidado con los folios parecidos. Junta solo lo del 2311, ordénalo y revisa que todo cuadre antes de pagar.'
          ] });
          this.act('brief'); this.api.player.emote('wave');
        } else if (s === 'resolve') {
          await this.#resolve();
        } else if (s === 'debrief') {
          await this.debrief();
        } else {
          const hints = { index: 'El registro de control está en la computadora del escritorio.', search: 'Revisa lo que dice el registro: archivero C, «Por archivar» y la bandeja del escáner.', order: 'Lleva todo a la mesa de trabajo y ordénalo.', review: 'En la mesa, compara cantidades y montos entre documentos.', file: 'Archívalo donde corresponde a su folio.' };
          await ui.dialog({ speaker: MANAGER.name, lines: [hints[s] || '¡Gracias por tu ayuda!'] });
        }
      } finally { npc.talking = false; }
    });
  }

  openIndex() {
    return this.guard(async () => {
      const ui = this.api.ui;
      if (!this.attempt.briefed) { await ui.dialog({ speaker: 'Computadora', lines: ['Sistema de control documental. Habla primero con la Lic. Paola.'] }); return; }
      const paper = h('div', 'docs__paper'); paper.append(h('h4', null, `Registro de control · folio ${FOLIO}`));
      const dl = h('dl'); INDEX_ENTRY.forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v))); paper.append(dl);
      const wrap = h('div', 'docs'); wrap.append(paper);
      await ui.modal({ eyebrow: 'Sistema de control documental', title: 'EXP-2311', content: wrap, actions: [{ id: 'ok', label: 'Anotado', primary: true }] });
      if (this.act('index')) ui.toast('Ya sabes dónde buscar. Revisa archiveros y bandeja.');
    });
  }

  /** Abre un archivero (dos cajones) o la bandeja del escáner; en el paso de archivo, archiva. */
  openSpot(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (this.step === 'file' && id !== 'scan') {
        const cab = CABINETS.find(c => c.id === id);
        const r = await ui.modal({ eyebrow: 'Archivo', title: `¿Archivar el EXP-2311 en ${cab.name}?`, content: h('p', 'compare__note', 'Una vez archivado, el registro de control apuntará aquí.'), actions: [{ id: 'back', label: 'Cancelar' }, { id: 'ok', label: 'Archivar aquí', primary: true }] });
        if (r === 'ok' && this.act('file', { cabinet: id })) { this.api.player.emote('interact', 1.2); ui.toast('Expediente archivado. Cierra el caso con la Lic. Paola.'); }
        return;
      }
      const name = id === 'scan' ? 'Bandeja del escáner' : CABINETS.find(c => c.id === id).name;
      if (!a.indexed) { await ui.dialog({ speaker: name, lines: ['Antes de abrir cajones, consulta el registro de control en la computadora.'] }); return; }
      const spots = SPOTS.filter(x => (x.cabinet || 'scan') === id);
      const body = h('div');
      const paint = () => {
        body.replaceChildren();
        spots.forEach(sp => {
          const box = h('div', 'why');
          box.append(h('strong', null, id === 'scan' ? sp.note : `Cajón ${sp.id.slice(1)} · ${sp.note}`));
          if (!a.searched.includes(sp.id)) {
            const b = h('button', 'why__item', '🔎 Abrir y revisar'); b.type = 'button';
            b.addEventListener('click', () => { if (this.act('search', { id: sp.id })) paint(); });
            box.append(b);
          } else if (!sp.docs.length) box.append(h('p', 'compare__note', 'Nada del expediente aquí.'));
          else sp.docs.forEach(did => {
            const d = docById(did), taken = a.taken.includes(did), card = docCard(d);
            const b = h('button', 'why__item' + (taken ? ' is-on' : ''), taken ? '✔ En tu carpeta (devolver)' : 'Tomar para el expediente'); b.type = 'button';
            b.addEventListener('click', () => { if (this.act(taken ? 'putBack' : 'take', { id: did })) paint(); });
            card.append(b); box.append(card);
          });
          body.append(box);
        });
      };
      paint();
      await ui.modal({ eyebrow: 'Búsqueda', title: name, content: body, wide: true, actions: [{ id: 'ok', label: 'Cerrar', primary: true }] });
      const found = DOCS.filter(d => d.belongs && a.taken.includes(d.id)).length, total = DOCS.filter(d => d.belongs).length;
      if (found === total) ui.toast('¡Tienes los cinco documentos! Llévalos a la mesa de trabajo.');
      else ui.toast(`Documentos del 2311 en tu carpeta: ${found} de ${total}.`);
    });
  }

  openTable() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (this.step === 'review') return this.#review();
      if (this.step !== 'order') { await ui.dialog({ speaker: 'Mesa de trabajo', lines: [this.step === 'search' || this.step === 'index' || this.step === 'brief' ? 'Aquí se arma el expediente cuando tengas todos los documentos.' : 'El expediente ya está armado.'] }); return; }
      const seq = [];
      const body = h('div'), pool = h('div', 'pick'), line = h('ol');
      const paint = () => {
        pool.replaceChildren(); line.replaceChildren();
        a.taken.filter(id => !seq.includes(id)).forEach(id => { const d = docById(id); const b = h('button', 'pick__card'); b.type = 'button'; b.append(h('strong', null, d.kind), h('span', null, `Folio ${d.folio} · ${dmy(d.date)}`)); b.addEventListener('click', () => { seq.push(id); paint(); }); pool.append(b); });
        seq.forEach(id => { const d = docById(id); line.append(h('li', null, `${d.kind} · ${dmy(d.date)}`)); });
      };
      paint();
      body.append(h('p', 'compare__note', 'Toca los documentos en el orden en que ocurrieron (del primero al último).'), pool, line);
      const r = await ui.modal({ eyebrow: 'Mesa de trabajo', title: 'Ordena el EXP-2311', content: body, wide: true,
        actions: [{ id: 'reset', label: 'Reiniciar' }, { id: 'ok', label: 'Engargolar', primary: true }],
        validate: x => { if (x === 'reset') { seq.length = 0; paint(); return 'Orden reiniciado.'; } return x === 'ok' && seq.length !== a.taken.length ? 'Coloca todos los documentos de tu carpeta.' : null; } });
      if (r === 'ok' && this.act('order', { ids: [...seq] })) { this.api.player.emote('interact', 1.2); ui.toast('Expediente ordenado. Ahora revisa que todo cuadre.'); await this.#review(); }
    });
  }

  async #review() {
    const ui = this.api.ui, a = this.attempt, picked = new Set(a.flags);
    const body = h('div'), papers = h('div', 'docs');
    a.order.forEach(id => papers.append(docCard(docById(id))));
    const why = h('div', 'why');
    FINDINGS.forEach(f => { const b = h('button', 'why__item' + (picked.has(f.id) ? ' is-on' : ''), f.text); b.type = 'button'; b.addEventListener('click', () => { if (picked.has(f.id)) picked.delete(f.id); else if (picked.size < 3) picked.add(f.id); else { ui.toast('Máximo tres hallazgos.'); return; } b.classList.toggle('is-on', picked.has(f.id)); }); why.append(b); });
    body.append(papers, h('p', 'compare__note', 'Marca lo que NO cuadra (máximo tres).'), why);
    const r = await ui.modal({ eyebrow: 'Revisión del expediente', title: '¿Qué no cuadra?', content: body, wide: true, actions: [{ id: 'back', label: 'Después' }, { id: 'ok', label: 'Registrar hallazgos', primary: true }], validate: x => x === 'ok' && !picked.size ? 'Marca al menos un hallazgo.' : null });
    if (r === 'ok' && this.act('flag', { ids: [...picked] })) ui.toast('Hallazgos registrados. Decide el pago con la Lic. Paola.');
  }

  async #resolve() {
    const ui = this.api.ui; let chosen = null;
    await ui.dialog({ speaker: MANAGER.name, lines: ['Ya vi tus hallazgos. La factura está por pagarse hoy… ¿qué hacemos?'] });
    const list = h('div', 'why');
    const paint = () => { list.replaceChildren(); RESOLUTIONS.forEach(x => { const b = h('button', 'why__item' + (chosen === x.id ? ' is-on' : ''), x.text); b.type = 'button'; b.addEventListener('click', () => { chosen = x.id; paint(); }); list.append(b); }); };
    paint();
    const r = await ui.modal({ eyebrow: 'Decisión', title: 'El pago de la factura 2311', content: list, actions: [{ id: 'ok', label: 'Decidir', primary: true }], validate: x => x === 'ok' && !chosen ? 'Elige una opción.' : null });
    if (r === 'ok' && this.act('resolve', { id: chosen })) ui.toast('Decisión tomada. Ahora archiva el expediente donde corresponde.');
  }

  async debrief() {
    const ui = this.api.ui;
    await ui.dialog({ speaker: MANAGER.name, lines: ['El expediente está listo para la auditoría. ¿Qué aprendiste hoy?'] });
    const why = h('div', 'why'), picked = new Set();
    REASONS.forEach(r => { const b = h('button', 'why__item', r.text); b.type = 'button'; b.addEventListener('click', () => { if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < 2) picked.add(r.id); else { ui.toast('Elige máximo dos.'); return; } b.classList.toggle('is-on', picked.has(r.id)); }); why.append(b); });
    const r = await ui.modal({ eyebrow: 'Cierre del caso', title: '¿Qué hace confiable un expediente?', content: why, hint: 'Elige una o dos ideas.', actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Cerrar caso', primary: true }], validate: x => x === 'ok' && picked.size === 0 ? 'Elige al menos una idea.' : null });
    if (r !== 'ok' || !this.act('debrief', { reasons: [...picked] })) return;
    await this.close();
  }

  async close() {
    const ui = this.api.ui;
    const out = await this.finish(result => {
      const b = result.breakdown;
      return {
        before: () => ui.dialog({ speaker: MANAGER.name, lines: [result.passed ? (result.score === 100 ? '¡Expediente impecable! La auditoría no va a encontrar nada.' : 'Buen trabajo, el expediente está en orden. Hay detalles que pulir.') : 'Así no pasamos la auditoría. Repasemos: folio exacto, orden, y que todo cuadre.'] }),
        rows: [['Búsqueda', b.busqueda, 20], ['Orden cronológico', b.orden, 20], ['Inconsistencias', b.inconsistencias, 20], ['Decisión del pago', b.resolucion, 15], ['Archivo', b.archivo, 10], ['Cierre', b.justificacion, 10], ['Registro de control', b.research, 5]],
        heading: result.passed ? 'Lo que hizo confiable tu expediente' : 'Lo que hay que corregir',
        paragraphs: [
          `${b.decoys ? `Tomaste ${b.decoys} documento(s) de otro folio: 2307, 2331 y 2113 se parecen, pero no son el 2311.` : 'Tomaste solo los documentos del folio 2311.'} ${b.extra ? `Abriste ${b.extra} lugar(es) de más; el registro de control indicaba dónde buscar.` : 'Fuiste directo a donde indicaba el registro.'}`,
          'La factura cobra 50 cajas a un total distinto al autorizado ($14,200 contra $12,400) y almacén solo recibió 40. Lo correcto es retener el pago y pedir una factura corregida; nunca se corrige un documento a mano.'
        ],
        lesson: 'Gestión documental: registrar movimientos, buscar por folio exacto, ordenar cronológicamente y verificar que cada documento respalde al anterior antes de pagar.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Caso reiniciado. Habla otra vez con la Lic. Paola.');
  }
}
