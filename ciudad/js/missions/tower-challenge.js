// Misión 10 · "Desafío de equipos": lo propio de la Torre ICADEM (cuatro estaciones de
// especialidad, tablero del plan integrado con revisión cruzada y aprobación, y presentación).
// Se juega solo o en equipo: en equipo, cada estación la resuelve quien tiene ese rol y el
// intento lo guarda el servidor (MissionController se encarga del canal).
import { COACH, STATIONS, BUDGET, PERMITS, TASKS, MESSAGES, CHANNELS, REASONS, budgetTotal, stationById } from './tower-challenge-logic.js';
import { MissionController, h } from './controller.js';

const money = k => `$${(k * 1000).toLocaleString('es-MX')}`;

export class TowerChallengeMission extends MissionController {
  get attempt() { return this.state; }

  /** ¿Esta estación le toca a quien juega? (solo: siempre; en equipo: según el rol). */
  mine(id) { return !this.coop || this.coopMay(id); }

  wants(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'coach') return s === 'brief' || (s === 'present' && this.coopMay('present'));
    if (kind === 'station') return s === 'stations' && !a[id] && this.mine(id);
    if (kind === 'board') return s === 'review' || (s === 'present' && this.coop && !a.approvals.includes(this.coop.role));
    return false;
  }

  labelFor(kind, id) {
    const s = this.step;
    if (kind === 'coach') return s === 'present' ? `Presentar el plan con la ${COACH.name}` : `Hablar con la ${COACH.name}`;
    if (kind === 'station') { const st = stationById(id); return this.coop && !this.mine(id) ? `${st.name} · le toca a otro rol` : st.name; }
    if (kind === 'board') return 'Tablero del plan integrado';
    return 'Usar';
  }

  talkToCoach(npc) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.step;
      npc.talking = true;
      try {
        if (s === 'brief') {
          await ui.dialog({ speaker: `${COACH.name} · ${COACH.role}`, lines: [
            '¡Bienvenidos al piso de retos de la Torre ICADEM!',
            'El consejo de la ciudad quiere abrir un centro comunitario y nos pidió el plan: presupuesto, permisos, calendario y aviso a los vecinos.',
            this.coop ? 'Cada quien resuelve la estación de su rol. Después revisen juntos el tablero: si algo no cuadra, pidan que se rehaga.' : 'Hoy vas solo: pasa por las cuatro estaciones y luego revisa el plan completo en el tablero.',
            'Cuando todos aprueben el plan, vengan conmigo a presentarlo.'
          ] });
          this.act('brief'); this.api.player.emote('wave');
        } else if (s === 'present') {
          await this.present();
        } else {
          const hints = { stations: this.coop ? `Tu rol es ${this.coopRoleName}. Ve a tu estación.` : 'Te faltan estaciones por resolver.', review: 'Revisen el tablero del centro y apruébenlo.' };
          await ui.dialog({ speaker: COACH.name, lines: [hints[s] || '¡Excelente trabajo en equipo!'] });
        }
      } finally { npc.talking = false; }
    });
  }

  openStation(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, st = stationById(id);
      if (!a.briefed) { await ui.dialog({ speaker: st.name, lines: [`Primero recibe el reto con la ${COACH.name}.`] }); return; }
      if (a[id]) { await ui.dialog({ speaker: st.name, lines: ['Esta estación ya está resuelta. Su resultado está en el tablero del centro.'] }); return; }
      if (!this.mine(id)) { await ui.dialog({ speaker: st.name, lines: [`Esta estación le toca a ${this.coopWho(id)}. Puedes revisar su resultado en el tablero.`] }); return; }
      if (id === 'budget') return this.#budget();
      if (id === 'permits') return this.#permits();
      if (id === 'schedule') return this.#schedule();
      return this.#message();
    });
  }

  async #budget() {
    const ui = this.api.ui; let pc = null, cont = 0;
    const body = h('div', 'sim'), pick = h('div', 'pick'), out = h('div', 'sim__big'), lab = h('p', 'compare__note');
    const items = h('div', 'docs__paper'); const dl = h('dl'); BUDGET.items.forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, money(v)))); items.append(h('h4', null, `Presupuesto autorizado: ${money(BUDGET.limit)}`), dl);
    const range = document.createElement('input'); Object.assign(range, { type: 'range', min: '0', max: '15', step: '1', value: '0' }); range.style.width = '100%';
    const paint = () => {
      pick.replaceChildren(); BUDGET.computers.forEach(c => { const b = h('button', 'pick__card' + (pc === c.id ? ' is-on' : '')); b.type = 'button'; b.append(h('strong', null, c.name), h('span', null, money(c.cost))); b.addEventListener('click', () => { pc = c.id; paint(); }); pick.append(b); });
      lab.textContent = `Fondo de contingencia: ${cont}% (mínimo recomendado ${BUDGET.minContingency}%)`;
      const total = pc ? budgetTotal(pc, cont) : null; out.replaceChildren(h('span', null, 'Total del plan'), h('b', null, total === null ? '—' : `${money(total)} ${total <= BUDGET.limit ? '✅' : '⚠️ excede'}`));
    };
    range.addEventListener('input', () => { cont = Number(range.value); paint(); });
    paint(); body.append(items, pick, lab, range, out, h('p', 'compare__note', 'La contingencia cubre imprevistos de la obra. Sin ella, cualquier sorpresa detiene el proyecto.'));
    const r = await ui.modal({ eyebrow: 'Estación de Finanzas', title: 'Arma el presupuesto', content: body, wide: true, actions: [{ id: 'back', label: 'Cerrar' }, { id: 'ok', label: 'Enviar al tablero', primary: true }], validate: x => x === 'ok' && !pc ? 'Elige el equipo de cómputo.' : null });
    if (r === 'ok' && this.act('budget', { computers: pc, contingency: cont })) this.#posted('Presupuesto');
  }

  async #permits() {
    const ui = this.api.ui, picked = new Set(), why = h('div', 'why');
    PERMITS.forEach(p => { const b = h('button', 'why__item', p.name); b.type = 'button'; b.addEventListener('click', () => { if (picked.has(p.id)) picked.delete(p.id); else if (picked.size < 4) picked.add(p.id); else { ui.toast('Máximo cuatro trámites.'); return; } b.classList.toggle('is-on', picked.has(p.id)); }); why.append(b); });
    const body = h('div'); body.append(h('p', 'compare__note', 'Un centro comunitario: edificio nuevo de dos niveles, con salones y sala de cómputo. Sin venta de alimentos ni bebidas.'), why);
    const r = await ui.modal({ eyebrow: 'Estación Legal', title: '¿Qué trámites se necesitan?', content: body, actions: [{ id: 'back', label: 'Cerrar' }, { id: 'ok', label: 'Enviar al tablero', primary: true }], validate: x => x === 'ok' && !picked.size ? 'Elige al menos un trámite.' : null });
    if (r === 'ok' && this.act('permits', { ids: [...picked] })) this.#posted('Permisos');
  }

  async #schedule() {
    const ui = this.api.ui, seq = [], pool = h('div', 'pick'), line = h('ol'), body = h('div');
    const paint = () => {
      pool.replaceChildren(); line.replaceChildren();
      TASKS.filter(t => !seq.includes(t.id)).forEach(t => { const b = h('button', 'pick__card'); b.type = 'button'; b.append(h('strong', null, t.name)); b.addEventListener('click', () => { seq.push(t.id); paint(); }); pool.append(b); });
      seq.forEach(id => line.append(h('li', null, TASKS.find(t => t.id === id).name)));
    };
    paint(); body.append(h('p', 'compare__note', 'Toca las tareas en el orden en que deben hacerse: algunas no pueden empezar sin que termine otra.'), pool, line);
    const r = await ui.modal({ eyebrow: 'Estación de Operaciones', title: 'Arma el calendario', content: body, wide: true,
      actions: [{ id: 'reset', label: 'Reiniciar' }, { id: 'ok', label: 'Enviar al tablero', primary: true }],
      validate: x => { if (x === 'reset') { seq.length = 0; paint(); return 'Calendario reiniciado.'; } return x === 'ok' && seq.length !== TASKS.length ? 'Ordena las cinco tareas.' : null; } });
    if (r === 'ok' && this.act('schedule', { ids: [...seq] })) this.#posted('Calendario');
  }

  async #message() {
    const ui = this.api.ui; let text = null; const ch = new Set();
    const msgs = h('div', 'why'), chans = h('div', 'pick'), body = h('div');
    const paint = () => {
      msgs.replaceChildren(); MESSAGES.forEach(m => { const b = h('button', 'why__item' + (text === m.id ? ' is-on' : ''), m.text); b.type = 'button'; b.addEventListener('click', () => { text = m.id; paint(); }); msgs.append(b); });
      chans.replaceChildren(); CHANNELS.forEach(c => { const b = h('button', 'pick__card' + (ch.has(c.id) ? ' is-on' : '')); b.type = 'button'; b.append(h('strong', null, c.name)); b.addEventListener('click', () => { if (ch.has(c.id)) ch.delete(c.id); else if (ch.size < 2) ch.add(c.id); else { ui.toast('Elige máximo dos canales.'); return; } paint(); }); chans.append(b); });
    };
    paint(); body.append(h('p', 'compare__note', 'Elige el aviso para los vecinos:'), msgs, h('p', 'compare__note', '¿Por dónde lo darás? (máximo dos)'), chans);
    const r = await ui.modal({ eyebrow: 'Estación de Comunicación', title: 'Aviso a los vecinos', content: body, wide: true, actions: [{ id: 'back', label: 'Cerrar' }, { id: 'ok', label: 'Enviar al tablero', primary: true }], validate: x => x === 'ok' && (!text || !ch.size) ? 'Elige el aviso y al menos un canal.' : null });
    if (r === 'ok' && this.act('message', { text, channels: [...ch] })) this.#posted('Aviso a vecinos');
  }

  #posted(what) {
    const left = STATIONS.filter(s => !this.attempt[s.id]).length;
    this.api.ui.toast(left ? `${what} enviado al tablero. Faltan ${left} estaciones.` : `${what} enviado. ¡Plan completo! Revísenlo en el tablero.`);
    this.api.player.emote('interact', 1.2);
  }

  /** Resumen legible de cada estación para el tablero. */
  summary(id) {
    const a = this.attempt;
    if (!a[id]) return 'Pendiente';
    if (id === 'budget') { const t = budgetTotal(a.budget.computers, a.budget.contingency); return `${BUDGET.computers.find(c => c.id === a.budget.computers).name} · contingencia ${a.budget.contingency}% · total ${money(t)} de ${money(BUDGET.limit)}`; }
    if (id === 'permits') return a.permits.map(p => PERMITS.find(x => x.id === p).name).join(' · ');
    if (id === 'schedule') return a.schedule.map((t, i) => `${i + 1}. ${TASKS.find(x => x.id === t).name}`).join('  ');
    return `«${MESSAGES.find(m => m.id === a.message.text).text}» · ${a.message.channels.map(c => CHANNELS.find(x => x.id === c).name).join(' y ')}`;
  }

  openBoard() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.briefed) { await ui.dialog({ speaker: 'Tablero del plan', lines: [`Aquí se arma el plan. Primero recibe el reto con la ${COACH.name}.`] }); return; }
      const ready = STATIONS.every(s => a[s.id]);
      const body = h('div'), papers = h('div', 'docs');
      STATIONS.forEach(s => {
        const p = h('div', 'docs__paper'); p.append(h('h4', null, `${a[s.id] ? '✅' : '⏳'} ${s.name}`), h('p', 'compare__note', this.summary(s.id)));
        if (ready && !a.presented) { const b = h('button', 'why__item', 'Pedir que se rehaga'); b.type = 'button'; b.addEventListener('click', () => { if (this.act('reopen', { id: s.id })) { ui.toast(`Se pidió rehacer: ${s.name}.`); document.querySelector('#modal-actions button')?.click(); } }); p.append(b); }
        papers.append(p);
      });
      body.append(papers);
      if (this.coop) body.append(h('p', 'compare__note', `Aprobaciones: ${a.approvals.length ? a.approvals.map(r => this.coopRoleNameOf(r)).join(', ') : 'ninguna todavía'}`));
      if (!ready) { body.append(h('p', 'compare__note', 'El plan estará listo para revisión cuando las cuatro estaciones envíen su parte.')); await ui.modal({ eyebrow: 'Tablero del plan integrado', title: 'Centro comunitario', content: body, wide: true }); return; }
      const mineApproved = this.coop ? a.approvals.includes(this.coop.role) : a.approvals.length > 0;
      const r = await ui.modal({ eyebrow: 'Tablero del plan integrado', title: 'Revisen el plan completo', content: body, wide: true, hint: 'Si algo no cuadra, pidan rehacer esa parte antes de aprobar.',
        actions: [{ id: 'back', label: 'Cerrar' }, ...(mineApproved ? [] : [{ id: 'ok', label: 'Aprobar el plan', primary: true }])] });
      if (r !== 'ok' || !this.act('approve', { role: this.coop ? this.coop.role : 'individual' })) return;
      const waiting = this.coopPending();
      ui.toast(waiting.length ? `Aprobaste. Falta que aprueben: ${waiting.map(r2 => this.coopRoleNameOf(r2)).join(', ')}.` : `Plan aprobado. Preséntenlo con la ${COACH.name}.`, 3200);
    });
  }

  async present() {
    const ui = this.api.ui, waiting = this.coopPending();
    if (waiting.length) { await ui.dialog({ speaker: COACH.name, lines: [`Todavía falta que aprueben: ${waiting.map(r => this.coopRoleNameOf(r)).join(', ')}.`] }); return; }
    await ui.dialog({ speaker: COACH.name, lines: ['El consejo está listo. Antes de presentar: ¿qué hizo funcionar a su equipo?'] });
    const why = h('div', 'why'), picked = new Set();
    REASONS.forEach(r => { const b = h('button', 'why__item', r.text); b.type = 'button'; b.addEventListener('click', () => { if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < 2) picked.add(r.id); else { ui.toast('Elige máximo dos.'); return; } b.classList.toggle('is-on', picked.has(r.id)); }); why.append(b); });
    const r = await ui.modal({ eyebrow: 'Presentación al consejo', title: '¿Qué hizo funcionar al equipo?', content: why, hint: 'Elige una o dos ideas.', actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Presentar el plan', primary: true }], validate: x => x === 'ok' && picked.size === 0 ? 'Elige al menos una idea.' : null });
    if (r !== 'ok' || !this.act('present', { reasons: [...picked] })) return;
    await this.close();
  }

  async close() {
    const ui = this.api.ui;
    const out = await this.finish(result => {
      const b = result.breakdown;
      return {
        before: () => ui.dialog({ speaker: COACH.name, lines: [result.passed ? (result.score === 100 ? '¡El consejo aprobó el plan por unanimidad! Así trabaja un equipo.' : 'El consejo aprobó el plan con observaciones. ¡Buen trabajo!') : 'El consejo pidió rehacer el plan. Revisemos qué no cuadró.'] }),
        rows: [['Presupuesto', b.presupuesto, 20], ['Permisos', b.permisos, 20], ['Calendario', b.calendario, 20], ['Comunicación', b.comunicacion, 20], ['Coordinación', b.coordinacion, 10], ['Cierre', b.justificacion, 10]],
        heading: result.passed ? 'Lo que hizo sólido su plan' : 'Lo que hay que corregir',
        paragraphs: [
          `Total del presupuesto: ${money(b.total)} de ${money(BUDGET.limit)}${b.total > BUDGET.limit ? ' (se excedió)' : ''}. Permisos correctos: ${b.okPermits} de 3${b.badPermits ? `, con ${b.badPermits} innecesario(s)` : ''}. El calendario tuvo ${b.pairs} de 4 pasos en el orden correcto.`,
          `Un buen aviso dice qué, cuándo, cuánto dura y dónde preguntar. ${b.reopened ? `El equipo pidió rehacer ${b.reopened} parte(s): la revisión cruzada sirve.` : 'Revisar el plan completo antes de presentarlo evita que un error de un área afecte a todas.'}`
        ],
        lesson: 'Trabajo en equipo: dividir por especialidad, integrar las partes, revisar el trabajo de los demás y decidir por consenso.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Reto reiniciado. Habla otra vez con la Mtra. Elena.');
  }
}
