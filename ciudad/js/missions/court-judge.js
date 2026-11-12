// Misión 9 · "Tú eres el juez": lo propio de la audiencia (expediente, pruebas, estrado, testigos,
// objeciones, confrontación, valoración y resolución). Estados, rastreador, cierre, recompensa y
// reintento son los mismos del Banco: vienen de MissionController y del motor de misiones.
import { CASE, DOCKET, PARTIES, EXHIBITS, WEIGHTS, WITNESSES, OBJECTIONS, RULINGS, GROUNDS, availableStatements, money } from './court-judge-logic.js';
import { MissionController, h } from './controller.js';

const LAWYER = { actora: 'mena', demandada: 'barrera' };
const BENCH_STEPS = ['abrir', 'partes', 'testigos', 'confrontar', 'valorar', 'resolver'];
const chips = (options, current, onPick) => {
  const row = h('div', 'chips');
  options.forEach(([id, text]) => { const b = h('button', current === id ? 'is-on' : '', text); b.type = 'button'; b.dataset.id = String(id); b.addEventListener('click', () => { row.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); onPick(id); }); row.append(b); });
  return row;
};

export class CourtJudgeMission extends MissionController {
  wants(kind) {
    const s = this.step;
    if (kind === 'clerk') return s === 'expediente' || s === 'antecedentes';
    if (kind === 'evidence') return s === 'pruebas';
    if (kind === 'bench') return BENCH_STEPS.includes(s);
    return false;
  }

  labelFor(kind) {
    if (kind === 'bench' && this.coop && this.coop.role !== 'juez') return `Tu papel en la audiencia · ${this.coopRoleName}`;
    if (kind === 'clerk') return this.state.caseId ? 'Consultar el expediente con la secretaria' : 'Pedir un expediente a la secretaria';
    if (kind === 'evidence') return 'Examinar las pruebas';
    if (kind === 'bench') return this.state.opened ? 'Volver al estrado' : 'Subir al estrado';
    return 'Usar';
  }

  /* ---------- secretaría: elegir expediente y leer antecedentes ---------- */
  talkToClerk(court) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.state;
      court.speaking('clerk', true);
      try {
        if (!s.caseId) {
          await ui.dialog({ speaker: 'Secretaria de acuerdos', lines: ['Buenos días, juez. Estos son los expedientes listos para audiencia.', 'Elija uno y le explico de qué trata.'] });
          const list = h('div', 'docket'); let picked = null;
          DOCKET.forEach(d => {
            const b = h('button', 'docket__item'); b.type = 'button'; b.dataset.id = d.id; b.disabled = !d.available;
            b.append(h('small', null, d.number), h('strong', null, d.title), h('span', null, d.matter), h('em', 'pill ' + (d.available ? 'pill--ok' : 'pill--soon'), d.available ? 'Listo para audiencia' : 'En preparación'));
            b.addEventListener('click', () => { picked = d.id; list.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); });
            list.append(b);
          });
          const r = await ui.modal({ eyebrow: 'Secretaría', title: 'Expedientes del juzgado', content: list, actions: [{ id: 'back', label: 'Ahora no' }, { id: 'ok', label: 'Tomar expediente', primary: true }], validate: id => id === 'ok' && !picked ? 'Elige un expediente.' : null });
          if (r !== 'ok' || !this.act('takeCase', { id: picked })) return;
        }
        const body = h('div', 'brief');
        body.append(h('p', 'brief__matter', CASE.matter));
        CASE.background.forEach(text => body.append(h('p', null, text)));
        const who = h('dl', 'brief__parties');
        who.append(h('dt', null, 'Parte actora'), h('dd', null, `${PARTIES.actora.name} · ${PARTIES.actora.lawyer}`), h('dt', null, 'Parte demandada'), h('dd', null, `${PARTIES.demandada.name} · ${PARTIES.demandada.lawyer}`), h('dt', null, 'Testigos'), h('dd', null, WITNESSES.map(w => w.name).join(' y ')));
        body.append(who, h('p', 'brief__note', 'Caso ficticio con fines educativos.'));
        await ui.modal({ eyebrow: CASE.number, title: CASE.title, content: body, actions: [{ id: 'ok', label: 'Entendido', primary: true }] });
        if (this.act('readBackground')) ui.toast('Las pruebas están en la mesa del centro. Revísalas antes de subir al estrado.');
      } finally { court.speaking('clerk', false); }
    });
  }

  /* ---------- mesa de pruebas ---------- */
  openEvidence() {
    return this.guard(async () => {
      if (!this.state.background) { await this.api.ui.dialog({ speaker: 'Mesa de pruebas', lines: ['Son las pruebas de un expediente. Pídeselo primero a la secretaria.'] }); return; }
      await this.#evidenceViewer();
    });
  }

  async #evidenceViewer() {
    const s = this.state, wrap = h('div', 'docs'), tabs = h('div', 'docs__tabs'), paper = h('div', 'docs__paper');
    const show = id => {
      if (!s.exhibits.includes(id)) this.act('examineExhibit', { id });
      tabs.querySelectorAll('button').forEach(b => { b.classList.toggle('is-on', b.dataset.id === id); if (s.exhibits.includes(b.dataset.id)) b.classList.add('is-read'); });
      const e = EXHIBITS.find(x => x.id === id);
      paper.replaceChildren(h('h4', null, `${e.tag} · ${e.name}`));
      const dl = h('dl'); e.rows.forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v)));
      paper.append(dl, h('p', 'docs__note', `Ofrecida por ${e.offeredBy}.`));
    };
    EXHIBITS.forEach(e => { const b = h('button', null, e.tag); b.type = 'button'; b.dataset.id = e.id; b.title = e.name; b.addEventListener('click', () => show(e.id)); tabs.append(b); });
    wrap.append(tabs, paper); show((EXHIBITS.find(e => !s.exhibits.includes(e.id)) || EXHIBITS[0]).id);
    await this.api.ui.modal({ eyebrow: CASE.number, title: 'Pruebas del expediente', content: wrap, wide: true, actions: [{ id: 'ok', label: 'Cerrar', primary: true }] });
    this.refreshTracker();
  }

  /* ---------- estrado: dirigir la audiencia ---------- */
  takeBench(court) {
    return this.guard(async () => {
      const { ui, player } = this.api, s = this.state;
      if (!s.background || s.exhibits.length < EXHIBITS.length) {
        await ui.dialog({ speaker: 'Oficial de sala', lines: [!s.caseId ? 'Antes de subir al estrado necesita un expediente. Pídalo en la secretaría.' : !s.background ? 'Lea primero los antecedentes con la secretaria.' : `Le faltan pruebas por revisar en la mesa central: lleva ${s.exhibits.length} de ${EXHIBITS.length}.`] });
        return;
      }
      // En equipo solo el juez sube al estrado; los demás participan desde su lugar en la sala.
      if (this.coop && this.coop.role !== 'juez') { try { await this.#hearing(court); } finally { this.api.camera.release(); } return; }
      await ui.fade(true); this.api.sit(court.seat, true); court.benchView(); await ui.fade(false);
      try { await this.#hearing(court); }
      finally {
        if (player.seat === court.seat) { player.seat = null; player.position.set(court.floorSpot.x, 0, court.floorSpot.z); player.yaw = Math.PI; }
        this.api.camera.release();
      }
    });
  }

  /** Acción del motor que dispara cada opción del estrado (para los permisos en equipo). */
  #optionAction(id) {
    const s = this.state;
    if (id === 'abrir') return { type: 'openHearing' };
    if (id.startsWith('parte:')) return { type: 'hearParty', payload: { side: id.slice(6) } };
    if (id.startsWith('testigo:')) {
      const w = WITNESSES.find(x => x.id === id.slice(8));
      if (!s.examined.includes(w.id)) return this.#pendingObjections(w).length ? { type: 'ruleObjection' } : { type: 'examineWitness', payload: { id: w.id } };
      return { type: 'askWitness', payload: { witness: w.id } };
    }
    if (id === 'confrontar') return { type: 'confront' };
    if (id === 'valorar') return { type: 'weigh' };
    if (id === 'resolver') return { type: 'rule' };
    return null;
  }
  #pendingObjections(w) { return [...w.direct, ...w.cross].filter(i => i.objection && !this.state.objections[i.objection]).map(i => OBJECTIONS[i.objection]); }

  async #say(court, name, speaker, lines) {
    court.focus(name); court.speaking(name, true);
    try { await this.api.ui.dialog({ speaker, lines }); } finally { court.speaking(name, false); }
  }

  async #hearing(court) {
    const ui = this.api.ui;
    for (;;) {
      const s = this.state; if (!this.coop || this.coop.role === 'juez') court.benchView(); this.refreshTracker();
      const heardAll = s.heard.length === 2, witnessesDone = this.run.can('confront', { marks: {} }) || Boolean(s.confronted);
      const options = [];
      if (!s.opened) options.push({ id: 'abrir', label: 'Abrir la audiencia', primary: true });
      else {
        for (const side of ['actora', 'demandada']) options.push({ id: 'parte:' + side, label: `Dar la palabra a la parte ${side}`, done: s.heard.includes(side) });
        for (const w of WITNESSES) options.push({ id: 'testigo:' + w.id, label: s.examined.includes(w.id) ? `Hacer más preguntas a ${w.name}` : `Llamar a declarar a ${w.name}`, hint: w.role, disabled: !heardAll, done: s.examined.includes(w.id) && w.questions.some(q => s.asked.includes(q.id)) });
        options.push({ id: 'confrontar', label: 'Confrontar declaraciones con las pruebas', disabled: !witnessesDone, done: Boolean(s.confronted) });
        options.push({ id: 'valorar', label: 'Valorar las pruebas', disabled: !s.confronted, done: EXHIBITS.every(e => s.weights[e.id]) });
        options.push({ id: 'resolver', label: 'Dictar la resolución', disabled: !EXHIBITS.every(e => s.weights[e.id]), primary: EXHIBITS.every(e => s.weights[e.id]) });
        options.push({ id: 'pruebas', label: 'Consultar las pruebas del expediente' });
      }
      // En equipo: lo que le toca a otro rol se ve, pero desactivado y con el nombre de a quién le toca.
      if (this.coop) options.forEach(o => { const need = this.#optionAction(o.id); if (need && !o.disabled && !o.done && !this.coopMay(need.type, need.payload)) { o.disabled = true; o.hint = `Le toca a: ${this.coopWho(need.type, need.payload)}`; o.primary = false; } });
      options.push({ id: 'bajar', label: this.coop && this.coop.role !== 'juez' ? 'Volver a la sala' : 'Bajar del estrado' });
      const pick = await ui.choice({ speaker: this.coop ? `Audiencia en equipo · ${this.coopRoleName}` : 'Estrado del juez', text: s.opened ? 'La audiencia está abierta. ¿Qué sigue?' : `${CASE.number} · ${CASE.title}`, options });
      if (pick === 'bajar') return;
      if (pick === 'pruebas') { await this.#evidenceViewer(); continue; }
      if (pick === 'abrir') {
        if (!this.act('openHearing')) continue;
        court.gavel();
        await this.#say(court, 'clerk', 'Secretaria de acuerdos', [`Se abre la audiencia del ${CASE.number.toLowerCase()}: ${CASE.title}.`, 'Están presentes las dos partes con sus abogados, y los testigos ofrecidos.']);
      } else if (pick.startsWith('parte:')) {
        const side = pick.slice(6), p = PARTIES[side];
        await this.#say(court, LAWYER[side], `${p.lawyer} · por ${p.name}`, p.statement);
        this.act('hearParty', { side });
      } else if (pick.startsWith('testigo:')) await this.#witness(court, WITNESSES.find(w => w.id === pick.slice(8)));
      else if (pick === 'confrontar') await this.#confront();
      else if (pick === 'valorar') await this.#weigh();
      else if (pick === 'resolver') { if (await this.#rule(court)) return; }
    }
  }

  async #witness(court, w) {
    const ui = this.api.ui, s = this.state, first = !s.examined.includes(w.id);
    if (this.coop && first && this.#pendingObjections(w).length && !this.coopMay('ruleObjection')) { ui.toast(`Antes de que declare ${w.name}, el juez debe resolver las objeciones de su interrogatorio.`, 3200); return; }
    if (this.coop && first && !this.#pendingObjections(w).length && !this.coopMay('examineWitness', { id: w.id })) { ui.toast(`Ahora le toca declarar a ${w.name} (rol: ${this.coopWho('examineWitness', { id: w.id })}).`, 3200); return; }
    await court.callWitness(w.id);
    try {
      if (first) {
        await this.#say(court, 'clerk', 'Secretaria de acuerdos', [`Pasa a declarar ${w.name}. Se le recuerda que debe conducirse con verdad.`]);
        for (const item of [...w.direct, ...w.cross]) {
          const lawyer = PARTIES[item.by];
          await this.#say(court, LAWYER[item.by], lawyer.lawyer, [item.q]);
          if (item.objection) {
            const o = OBJECTIONS[item.objection];
            if (!s.objections[o.id]) {
              await this.#say(court, LAWYER[o.by], PARTIES[o.by].lawyer, [o.text]);
              court.benchView();
              const ruling = await ui.choice({ speaker: 'Resuelve la objeción', text: `Pregunta objetada: «${item.q}»`, options: [{ id: 'ha-lugar', label: 'Ha lugar', hint: 'Se admite la objeción: la pregunta se retira' }, { id: 'no-ha-lugar', label: 'No ha lugar', hint: 'La pregunta procede: el testigo debe contestar' }] });
              this.act('ruleObjection', { id: o.id, ruling }); court.gavel();
            }
            if (this.coop && !this.coopMay('examineWitness', { id: w.id })) continue;   // el juez solo resuelve; la declaración la da el testigo
            if (s.objections[o.id] === 'ha-lugar') { await this.#say(court, 'clerk', 'Secretaria de acuerdos', ['Se admite la objeción. La pregunta se retira y no se contesta.']); continue; }
          }
          if (this.coop && !this.coopMay('examineWitness', { id: w.id })) continue;
          await this.#say(court, w.id, w.name, [item.a]);
        }
        if (this.coop && !this.coopMay('examineWitness', { id: w.id })) { ui.toast(`Objeciones resueltas. Ahora declara ${w.name}.`, 3000); return; }
        this.act('examineWitness', { id: w.id });
      }
      if (this.coop && !this.coopMay('askWitness', { witness: w.id })) { ui.toast(`Declaración asentada. Ahora interrogan los abogados.`, 3000); return; }
      for (;;) {
        court.focus(w.id);
        const asked = w.questions.filter(q => s.asked.includes(q.id)).length;
        const pick = await ui.choice({ speaker: `Tus preguntas a ${w.name}`, text: w.role, options: [...w.questions.map(q => ({ id: q.id, label: q.q, done: s.asked.includes(q.id) })), { id: 'fin', label: 'No tengo más preguntas', disabled: asked === 0, hint: asked === 0 ? 'Haz al menos una pregunta' : '' }] });
        if (pick === 'fin') break;
        const q = w.questions.find(x => x.id === pick);
        this.act('askWitness', { witness: w.id, id: q.id });
        await this.#say(court, w.id, w.name, [q.a]);
      }
    } finally { await court.dismissWitness(w.id); }
  }

  async #confront() {
    const ui = this.api.ui, s = this.state, list = availableStatements(s), marks = { ...(s.confronted || {}) };
    const wrap = h('div', 'confront');
    wrap.append(h('p', 'compare__note', 'Para cada declaración indica si alguna prueba la contradice. Marcar una contradicción que no existe resta puntos.'));
    const exOptions = [[null, 'Sin contradicción'], ...EXHIBITS.map(e => [e.id, `${e.tag}: ${e.name}`])];
    list.forEach(st => {
      if (!(st.id in marks)) marks[st.id] = undefined;
      const row = h('div', 'confront__row'); row.dataset.id = st.id;
      row.append(h('small', null, st.who), h('strong', null, st.text), chips(exOptions, marks[st.id], id => { marks[st.id] = id; }));
      wrap.append(row);
    });
    const r = await ui.modal({ eyebrow: 'Confrontación', title: '¿Qué dijeron y qué dicen las pruebas?', content: wrap, wide: true,
      actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Dejar asentado', primary: true }], validate: id => id === 'ok' && list.some(st => marks[st.id] === undefined) ? 'Decide en cada declaración.' : null });
    if (r === 'ok') this.act('confront', { marks: Object.fromEntries(list.map(st => [st.id, marks[st.id] ?? null])) });
  }

  async #weigh() {
    const ui = this.api.ui, s = this.state, picks = { ...s.weights }, wrap = h('div', 'confront');
    wrap.append(h('p', 'compare__note', WEIGHTS.map(w => `${w.name}: ${w.text.toLowerCase()}`).join(' · ') + '.'));
    EXHIBITS.forEach(e => { const row = h('div', 'confront__row'); row.dataset.id = e.id; row.append(h('small', null, `${e.tag} · ofrecida por ${e.offeredBy}`), h('strong', null, e.name), chips(WEIGHTS.map(w => [w.id, w.name]), picks[e.id], id => { picks[e.id] = id; })); wrap.append(row); });
    const r = await ui.modal({ eyebrow: 'Valoración', title: '¿Cuánto vale cada prueba?', content: wrap, wide: true,
      actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Dejar asentado', primary: true }], validate: id => id === 'ok' && EXHIBITS.some(e => !picks[e.id]) ? 'Valora las cinco pruebas.' : null });
    if (r === 'ok') EXHIBITS.forEach(e => this.act('weigh', { id: e.id, weight: picks[e.id] }));
  }

  async #rule(court) {
    const ui = this.api.ui;
    const pick = h('div', 'pick'); let chosen = null;
    RULINGS.forEach(r => { const b = h('button', 'pick__card'); b.type = 'button'; b.dataset.id = r.id; b.append(h('strong', null, r.name), h('span', null, r.text), h('small', null, `El arrendador devuelve ${money(r.amount)}`)); b.addEventListener('click', () => { chosen = r.id; pick.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); }); pick.append(b); });
    const r1 = await ui.modal({ eyebrow: 'Resolución', title: '¿Qué resuelves?', content: pick, actions: [{ id: 'back', label: 'Seguir en audiencia' }, { id: 'ok', label: 'Continuar', primary: true }], validate: id => id === 'ok' && !chosen ? 'Elige una resolución.' : null });
    if (r1 !== 'ok') return false;
    const why = h('div', 'why'), picked = new Set();
    GROUNDS.forEach(gr => { const b = h('button', 'why__item', gr.text); b.type = 'button'; b.dataset.id = gr.id; b.addEventListener('click', () => { if (picked.has(gr.id)) picked.delete(gr.id); else if (picked.size < 3) picked.add(gr.id); else { ui.toast('Elige máximo tres fundamentos.'); return; } b.classList.toggle('is-on', picked.has(gr.id)); }); why.append(b); });
    const r2 = await ui.modal({ eyebrow: 'Funda tu resolución', title: RULINGS.find(r => r.id === chosen).name, content: why,
      actions: [{ id: 'back', label: 'Cambiar resolución' }, { id: 'ok', label: 'Dictar resolución', primary: true }], validate: id => id === 'ok' && picked.size === 0 ? 'Elige de uno a tres fundamentos.' : null });
    if (r2 !== 'ok' || !this.act('rule', { ruling: chosen, grounds: [...picked] })) return false;
    court.gavel();
    await this.#close(court);
    return true;
  }

  async #close(court) {
    const { ui, store } = this.api;
    const out = await this.finish(result => {
      const b = result.breakdown, ruling = RULINGS.find(r => r.id === result.ruling), best = RULINGS.find(r => r.id === result.best);
      const missed = Object.values(OBJECTIONS).filter(o => this.lastObjections[o.id] !== o.ruling);
      return {
        before: () => court ? this.#say(court, 'clerk', 'Secretaria de acuerdos', [`Queda asentada la resolución: ${ruling.text}`, 'Se levanta la audiencia.']) : ui.dialog({ speaker: 'Secretaria de acuerdos', lines: [`Queda asentada la resolución: ${ruling.text}`, 'Se levanta la audiencia.'] }),
        rows: [['Investigación completa', b.research, 10], ['Objeciones', b.objections, 15], ['Contradicciones detectadas', b.contradictions, 20], ['Valoración de pruebas', b.weighing, 20], [`Resolución: ${ruling.name}`, b.decision, 25], ['Fundamentos', b.reasoning, 10]],
        heading: result.ruling === result.best ? 'Por qué era la resolución correcta' : `La resolución mejor fundada: ${best.name.toLowerCase()}`,
        paragraphs: [
          `Solo un daño quedó probado: el vidrio (${money(CASE.provenDamage)}), que la propia actora reconoció. Por eso corresponde devolver ${money(best.amount)} y no el depósito completo.`,
          'El arrendador escribió el día de la entrega «todo en orden salvo el vidrio», y su cotización está fechada 19 días antes de recibir el departamento. Pintura y boiler eran desgaste normal según el contrato y el inventario.',
          ...(missed.length ? ['Objeciones a repasar: ' + missed.map(o => o.why).join(' ')] : []),
          ...(b.falseAlarms ? ['Marcaste contradicciones que no existían: confrontar es comparar lo dicho con lo que consta en una prueba, no desconfiar de todo.'] : [])
        ],
        lesson: 'Un juez resuelve con lo que quedó probado, no con lo que cada parte afirma. Caso ficticio con fines educativos; no es asesoría jurídica.'
      };
    });
    if (out && out.result.passed && store.unlock('toga-y-mazo')) ui.toast('Logro desbloqueado: Toga y mazo');
    if (out && out.action === 'retry') ui.toast('Audiencia reiniciada. Pide de nuevo el expediente a la secretaria.');
  }

  /** Cierre desde fuera del estrado (en equipo, cuando el juez dicta sentencia en otra pantalla). */
  close() { return this.#close(this.api.scene && this.api.scene.court ? this.api.scene.court : null); }

  /** El controlador reinicia el intento al cerrar: se conserva lo resuelto para la retroalimentación. */
  async finish(describe) { this.lastObjections = { ...this.state.objections }; return super.finish(describe); }
}
