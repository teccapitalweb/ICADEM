// Misión 5 · "Turno de decisiones": lo propio del Hospital (recibir turno, pizarrón, entrevista,
// monitor y expediente junto a cada cama, triaje, priorización, plan, bitácora y entrega).
// Lo común lo hereda de MissionController; las reglas viven en hospital-shift-logic.js.
import { HEAD_NURSE, DOCTOR, TRIAGE, PATIENTS, REVIEWS, REASONS, patientById } from './hospital-shift-logic.js';
import { MissionController, h } from './controller.js';

const WHAT = { talk: 'Entrevista', monitor: 'Monitor', chart: 'Expediente' };

export class HospitalShiftMission extends MissionController {
  get attempt() { return this.state; }
  reviewed(id, what) { return (this.attempt.reviewed[id] || []).includes(what); }
  reviewedAll(id) { return REVIEWS.every(w => this.reviewed(id, w)); }
  /** Color asignado (para pintar la pulsera/luz sobre la cama). */
  colorOf(id) { const t = TRIAGE.find(x => x.id === this.attempt.triage[id]); return t ? t.hex : null; }

  wants(kind, id, what) {
    const s = this.step, a = this.attempt;
    if (kind === 'nurse') return s === 'shift' || s === 'handover';
    if (kind === 'board') return s === 'board' || s === 'order';
    if (kind === 'review') return s === 'review' && !this.reviewed(id, what);
    if (kind === 'patient') return (s === 'review' && !this.reviewed(id, 'talk')) || (s === 'triage' && this.reviewedAll(id) && !a.triage[id]) || (s === 'act' && !a.plan[id]);
    if (kind === 'record') return s === 'record';
    return false;
  }

  labelFor(kind, id, what) {
    const s = this.step, a = this.attempt, p = id ? patientById(id) : null;
    if (kind === 'nurse') return s === 'handover' ? `Entregar el turno a la ${HEAD_NURSE.name}` : `Recibir turno con la ${HEAD_NURSE.name}`;
    if (kind === 'board') return s === 'order' ? 'Ordenar pacientes por prioridad' : 'Consultar el pizarrón de pacientes';
    if (kind === 'review') return `${WHAT[what]} · ${p.name}`;
    if (kind === 'patient') {
      if (s === 'act' && !a.plan[id]) return `Atender a ${p.name}`;
      if (this.reviewedAll(id) && !a.triage[id]) return `Valorar a ${p.name} (triaje)`;
      return `Hablar con ${p.name}`;
    }
    if (kind === 'record') return 'Registrar decisiones en la bitácora';
    if (kind === 'doctor') return `Hablar con el ${DOCTOR.name}`;
    return 'Usar';
  }

  talkToNurse(npc) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.step;
      npc.talking = true;
      try {
        if (s === 'shift') {
          await ui.dialog({ speaker: `${HEAD_NURSE.name} · ${HEAD_NURSE.role}`, lines: [
            '¡Llegaste justo! Te entrego el turno de urgencias: hay cuatro pacientes esperando.',
            'Aquí no se atiende por orden de llegada: se atiende por gravedad. Para eso es el triaje.',
            'Revisa a cada uno: platica con él, mira su monitor y lee su expediente. Luego decides.',
            `Si algo te prende un foco rojo, no esperes: el ${DOCTOR.name} está en urgencias. Empieza por el pizarrón.`
          ] });
          this.act('shift');
          this.api.player.emote('wave');
        } else if (s === 'handover') {
          await this.handover();
        } else {
          const hints = {
            board: 'El pizarrón de pacientes está junto a la recepción.',
            review: 'Revisa a los cuatro: entrevista, monitor y expediente de cada cama.',
            triage: 'Ya tienes la información: valora a cada paciente y dale su color.',
            order: 'Ahora ordénalos en el pizarrón: ¿a quién se atiende primero?',
            act: 'Ve con cada paciente y decide qué sigue con él. Y si hace falta, pide apoyo.',
            record: 'Registra todo en la bitácora de la estación de enfermería: lo que no se escribe, no se hizo.'
          };
          await ui.dialog({ speaker: HEAD_NURSE.name, lines: [hints[s] || 'Vas muy bien.'] });
        }
      } finally { npc.talking = false; }
    });
  }

  openBoard() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.shift) { await ui.dialog({ speaker: 'Pizarrón de pacientes', lines: ['El pizarrón del turno. Recibe primero el turno con la jefa de enfermería.'] }); return; }
      if (this.step === 'order') return void await this.#orderPatients();
      const wrap = h('div', 'docs'), paper = h('div', 'docs__paper');
      paper.append(h('h4', null, 'Pacientes del turno · por orden de llegada'));
      const dl = h('dl');
      PATIENTS.slice().reverse().forEach(p => {
        const t = TRIAGE.find(x => x.id === a.triage[p.id]);
        dl.append(h('dt', null, `${p.bed} · ${p.name}, ${p.age} años`), h('dd', null, t ? `Triaje: ${t.name}` : (this.reviewedAll(p.id) ? 'Revisado · falta triaje' : 'Sin revisar')));
      });
      paper.append(dl, h('p', 'docs__note', 'Llegaron en este orden, pero no es el orden en que se atienden. Revisa a cada uno en su cama.'));
      wrap.append(paper);
      await ui.modal({ eyebrow: 'Recepción', title: 'Pizarrón de pacientes', content: wrap, actions: [{ id: 'ok', label: 'A revisar pacientes', primary: true }] });
      if (this.act('readBoard')) ui.toast('Empieza la ronda: entrevista, monitor y expediente de cada paciente.');
    });
  }

  async #orderPatients() {
    const ui = this.api.ui, a = this.attempt;
    const order = [];
    const wrap = h('div', 'pick');
    const paint = () => {
      wrap.replaceChildren();
      PATIENTS.forEach(p => {
        const at = order.indexOf(p.id), t = TRIAGE.find(x => x.id === a.triage[p.id]);
        const b = h('button', 'pick__card' + (at >= 0 ? ' is-on' : '')); b.type = 'button';
        b.append(h('strong', null, (at >= 0 ? `${at + 1}º · ` : '') + p.name), h('span', null, `${p.bed} · triaje ${t ? t.name.toLowerCase() : '—'}`));
        b.addEventListener('click', () => { const i = order.indexOf(p.id); if (i >= 0) order.splice(i, 1); else order.push(p.id); paint(); });
        wrap.append(b);
      });
    };
    paint();
    const body = h('div'); body.append(h('p', 'docs__note', 'Toca a los pacientes en el orden en que deben ser atendidos: PRIMERO el más urgente.'), wrap);
    const r = await ui.modal({ eyebrow: 'Pizarrón de pacientes', title: 'Prioridad de atención', content: body,
      actions: [{ id: 'back', label: 'Después' }, { id: 'ok', label: 'Fijar prioridad', primary: true }],
      validate: id => id === 'ok' && order.length !== PATIENTS.length ? 'Ordena a los cuatro pacientes.' : null });
    if (r === 'ok' && this.act('prioritize', { order: [...order] })) ui.toast('Prioridad fijada. Ve con cada paciente y decide qué sigue.');
  }

  /** Revisión física junto a la cama: monitor y expediente son objetos aparte del paciente. */
  review(id, what, npc) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, p = patientById(id);
      if (!a.board) { await ui.dialog({ speaker: p.bed, lines: [a.shift ? 'Consulta primero el pizarrón de pacientes.' : 'Recibe primero el turno con la jefa de enfermería.'] }); return; }
      if (what === 'talk') {
        if (npc) npc.talking = true;
        try { await ui.dialog({ speaker: `${p.name}, ${p.age} años`, lines: p.says }); } finally { if (npc) npc.talking = false; }
      } else if (what === 'monitor') {
        const v = p.vitals, mon = h('div', 'sim');
        const grid = h('dl', 'sim__totals');
        [['Frecuencia cardiaca', `${v.fc} lpm`], ['Presión arterial', `${v.ta} mmHg`], ['Frecuencia respiratoria', `${v.fr} rpm`], ['Saturación de oxígeno', `${v.sat} %`], ['Temperatura', `${v.temp} °C`]]
          .forEach(([k, val]) => grid.append(h('dt', null, k), h('dd', null, val)));
        mon.append(grid, h('p', 'compare__note', 'Valores ficticios con fines educativos.'));
        await ui.modal({ eyebrow: `Monitor · ${p.bed}`, title: p.name, content: mon, actions: [{ id: 'ok', label: 'Anotado', primary: true }] });
      } else {
        const paper = h('div', 'docs__paper'); paper.append(h('h4', null, `Expediente · ${p.name}, ${p.age} años`));
        const dl = h('dl'); p.chart.forEach(([k, val]) => dl.append(h('dt', null, k), h('dd', null, val))); paper.append(dl, h('p', 'docs__note', 'Expediente ficticio con fines educativos.'));
        const wrap = h('div', 'docs'); wrap.append(paper);
        await ui.modal({ eyebrow: `Expediente · ${p.bed}`, title: p.name, content: wrap, actions: [{ id: 'ok', label: 'Cerrar expediente', primary: true }] });
      }
      const first = !this.reviewed(id, what);
      if (this.act('review', { id, what }) && first && this.reviewedAll(id)) ui.toast(`${p.name}: ya tienes la información. Valóralo junto a su cama.`);
    });
  }

  /** Al paciente: hablar (si falta), valorar (triaje) o decidir la acción, según el momento del turno. */
  attend(id, npc) {
    const a = this.attempt;
    if (!this.reviewedAll(id) || !a.board) return this.review(id, 'talk', npc);
    if (!a.triage[id] || this.step === 'triage') return this.#assess(id);
    if (this.step === 'act' || a.plan[id]) return this.#decide(id, npc);
    return this.review(id, 'talk', npc);
  }

  #assess(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, p = patientById(id);
      const flags = new Set(a.flags[id] || []);
      let color = a.triage[id] || null;
      const body = h('div');
      const fl = h('div', 'why');
      p.findings.forEach(f => {
        const b = h('button', 'why__item' + (flags.has(f.id) ? ' is-on' : ''), (flags.has(f.id) ? '⚠ ' : '') + f.text); b.type = 'button';
        b.addEventListener('click', () => { if (flags.has(f.id)) flags.delete(f.id); else flags.add(f.id); b.classList.toggle('is-on', flags.has(f.id)); b.textContent = (flags.has(f.id) ? '⚠ ' : '') + f.text; });
        fl.append(b);
      });
      const tr = h('div', 'pick');
      const paintT = () => { tr.replaceChildren(); TRIAGE.forEach(t => { const b = h('button', 'pick__card' + (color === t.id ? ' is-on' : '')); b.type = 'button'; b.style.borderLeft = `8px solid #${t.hex.toString(16).padStart(6, '0')}`; b.append(h('strong', null, t.name), h('span', null, t.text)); b.addEventListener('click', () => { color = t.id; paintT(); }); tr.append(b); }); };
      paintT();
      body.append(h('p', 'docs__note', 'Marca los hallazgos que son SIGNOS DE ALARMA (puede no haber ninguno).'), fl, h('p', 'docs__note', 'Asigna su color de triaje:'), tr);
      const r = await ui.modal({ eyebrow: `Valoración · ${p.bed}`, title: `${p.name}, ${p.age} años`, content: body, wide: true,
        actions: [{ id: 'back', label: 'Después' }, { id: 'ok', label: 'Registrar valoración', primary: true }],
        validate: x => x === 'ok' && !color ? 'Asigna un color de triaje.' : null });
      if (r !== 'ok') return;
      if (this.act('assess', { id, flags: [...flags], triage: color })) {
        const t = TRIAGE.find(x => x.id === color);
        ui.toast(`${p.name}: triaje ${t.name.toLowerCase()}.` + (PATIENTS.every(x => this.attempt.triage[x.id]) ? ' Ahora ordénalos en el pizarrón.' : ''));
      }
    });
  }

  #decide(id, npc) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, p = patientById(id);
      if (npc) npc.talking = true;
      try {
        let action = a.plan[id] ? a.plan[id].action : null, support = a.plan[id] ? a.plan[id].support : null;
        const list = h('div', 'why');
        const paintA = () => { list.replaceChildren(); p.actions.forEach(x => { const b = h('button', 'why__item' + (action === x.id ? ' is-on' : ''), x.text); b.type = 'button'; b.addEventListener('click', () => { action = x.id; paintA(); }); list.append(b); }); };
        paintA();
        const sup = h('div', 'pick');
        const paintS = () => { sup.replaceChildren(); [[true, `Pedir apoyo inmediato al ${DOCTOR.name}`], [false, 'No hace falta apoyo inmediato']].forEach(([v, label]) => { const b = h('button', 'pick__card' + (support === v ? ' is-on' : '')); b.type = 'button'; b.append(h('strong', null, label)); b.addEventListener('click', () => { support = v; paintS(); }); sup.append(b); }); };
        paintS();
        const body = h('div'); body.append(h('p', 'docs__note', '¿Qué sigue con este paciente?'), list, h('p', 'docs__note', '¿Pides apoyo al médico ahora?'), sup);
        const r = await ui.modal({ eyebrow: `Atención · ${p.bed}`, title: p.name, content: body, wide: true,
          actions: [{ id: 'back', label: 'Después' }, { id: 'ok', label: 'Confirmar decisión', primary: true }],
          validate: x => x === 'ok' && (!action || support === null) ? 'Elige la acción y si pides apoyo.' : null });
        if (r !== 'ok') return;
        if (this.act('decide', { id, action, support })) {
          if (support) { this.api.ui.toast(`${DOCTOR.name} va en camino con ${p.name}.`); this.api.scene && this.api.scene.callDoctor && this.api.scene.callDoctor(id); }
          else ui.toast(`Decisión registrada para ${p.name}.`);
          if (this.step === 'record') ui.toast('Decisiones completas. Regístralas en la bitácora.');
        }
      } finally { if (npc) npc.talking = false; }
    });
  }

  openRecord() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (this.step !== 'record') {
        await ui.dialog({ speaker: 'Bitácora de enfermería', lines: [a.recorded ? 'Las decisiones del turno ya están registradas.' : 'Aquí se registran las decisiones del turno, cuando todas estén tomadas.'] });
        return;
      }
      const paper = h('div', 'docs__paper'); paper.append(h('h4', null, 'Bitácora del turno'));
      const dl = h('dl');
      (a.order || []).forEach((id, i) => {
        const p = patientById(id), t = TRIAGE.find(x => x.id === a.triage[id]), act = p.actions.find(x => x.id === a.plan[id].action);
        dl.append(h('dt', null, `${i + 1}º · ${p.name} · ${t.name}`), h('dd', null, act.text + (a.plan[id].support ? ' · apoyo médico solicitado' : '')));
      });
      paper.append(dl, h('p', 'docs__note', 'Lo que no se registra, no se hizo. Revisa antes de firmar.'));
      const wrap = h('div', 'docs'); wrap.append(paper);
      const r = await ui.modal({ eyebrow: 'Estación de enfermería', title: 'Registrar decisiones', content: wrap, wide: true,
        actions: [{ id: 'back', label: 'Revisar algo más' }, { id: 'ok', label: 'Firmar bitácora', primary: true }] });
      if (r === 'ok' && this.act('record')) ui.toast('Bitácora firmada. Entrega el turno a la jefa de enfermería.');
    });
  }

  async handover() {
    const ui = this.api.ui;
    await ui.dialog({ speaker: HEAD_NURSE.name, lines: ['Recibo el turno. Antes de irte: ¿en qué te basaste para decidir?'] });
    const why = h('div', 'why'), picked = new Set();
    REASONS.forEach(r => {
      const b = h('button', 'why__item', r.text); b.type = 'button';
      b.addEventListener('click', () => { if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < 2) picked.add(r.id); else { ui.toast('Elige máximo dos razones.'); return; } b.classList.toggle('is-on', picked.has(r.id)); });
      why.append(b);
    });
    const r = await ui.modal({ eyebrow: 'Entrega de turno', title: '¿En qué te basaste?', content: why, hint: 'Elige una o dos razones.',
      actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Entregar turno', primary: true }],
      validate: x => x === 'ok' && picked.size === 0 ? 'Elige al menos una razón.' : null });
    if (r !== 'ok' || !this.act('handover', { reasons: [...picked] })) return;
    await this.close();
  }

  async close() {
    const ui = this.api.ui;
    const out = await this.finish(result => {
      const b = result.breakdown;
      const lupita = result.passed
        ? (result.score === 100 ? 'Turno impecable. Los dos casos graves se atendieron a tiempo y todo quedó escrito.' : 'Buen turno. Hubo detalles, pero lo grave se atendió primero.')
        : 'Repasemos: en urgencias se atiende por gravedad, se pide apoyo ante signos de alarma y todo se registra.';
      return {
        before: () => ui.dialog({ speaker: HEAD_NURSE.name, lines: [lupita] }),
        rows: [['Triaje', b.triaje, 24], ['Signos de alarma', b.alarmas, 16], ['Prioridad', b.orden, 12], ['Acciones', b.acciones, 20], ['Apoyo médico', b.apoyo, 8], ['Justificación', b.justificacion, 10], ['Ronda completa y bitácora', b.research, 10]],
        heading: result.passed ? 'Lo que salió bien en el turno' : 'Lo que hay que repasar',
        paragraphs: [
          `Clasificaste bien a ${b.triageHits} de 4 pacientes. Don Aurelio (dolor opresivo con sudoración) y Doña Celia (habla y fuerza alteradas de golpe) eran rojos: en ambos el tiempo importa y se pide apoyo de inmediato.`,
          'Joaquín tiene fiebre alta pero responde y se hidrata: amarillo, con vigilancia. Mariana se queja más, pero camina y no tiene signos de alarma: verde, en su turno.'
        ],
        lesson: 'Triaje es decidir por gravedad, no por orden de llegada ni por quién se queja más. Juego con casos ficticios: no sustituye la capacitación clínica ni da indicaciones médicas.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Turno reiniciado. Recíbelo otra vez con la jefa de enfermería.');
  }
}
