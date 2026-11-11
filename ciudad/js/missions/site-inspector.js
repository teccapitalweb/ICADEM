// Misión 4 · "Inspector de seguridad": lo propio de la obra (EPP, plano, recorrido punto por
// punto, medidas, señalización, paro y reporte). Lo común lo hereda de MissionController.
// Las reglas y la calificación viven en site-inspector-logic.js (módulo puro, el del servidor).
import { SUPERVISOR, GEAR, SPOTS, STOP_OPTIONS, REASONS, SIGN_SPOT, BEST_STOP, spotById } from './site-inspector-logic.js';
import { MissionController, h } from './controller.js';

export class SiteInspectorMission extends MissionController {
  get attempt() { return this.state; }

  wants(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'supervisor') return s === 'talk' || s === 'stop' || s === 'report' || s === 'justify';
    if (kind === 'gear') return s === 'gear';
    if (kind === 'plan') return s === 'plan';
    if (kind === 'spot') return s === 'inspect' && !a.verdicts[id];
    if (kind === 'sign') return s === 'sign' || (a.verdicts[SIGN_SPOT] === 'riesgo' && !a.signed);
    return false;
  }

  labelFor(kind, id) {
    const s = this.step;
    if (kind === 'supervisor') return s === 'talk' ? 'Presentarte con la Ing. Paula' : (s === 'stop' || s === 'report' || s === 'justify') ? 'Entregar tu reporte a la Ing. Paula' : 'Hablar con la Ing. Paula';
    if (kind === 'gear') return 'Equiparte en la caseta (EPP)';
    if (kind === 'plan') return 'Consultar el plano y la lista';
    if (kind === 'spot') { const sp = spotById(id); const v = this.attempt.verdicts[id]; return v ? `${sp.name} · ${v === 'riesgo' ? 'RIESGO' : 'en regla'}` : `Inspeccionar: ${sp.name}`; }
    if (kind === 'sign') return this.attempt.signed ? 'Señalización colocada' : 'Colocar señalización en la zanja';
    return 'Usar';
  }

  talkToSupervisor(npc) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.step;
      npc.talking = true;
      try {
        if (s === 'talk') {
          await ui.dialog({ speaker: `${SUPERVISOR.name} · ${SUPERVISOR.role}`, lines: [
            'Bienvenido. Hoy tú eres el inspector de seguridad de esta obra.',
            'Regla número uno: nadie entra al patio sin su equipo de protección. Pasa a la caseta por el tuyo.',
            'Luego toma el plano con la lista de verificación: son ocho puntos. Ni uno de más, ni uno de menos.',
            'Lo que encuentres mal, se corrige; y si algo es grave, se detiene. Aquí nadie se juega la vida por avanzar más rápido.'
          ] });
          this.act('talk');
          this.api.player.emote('wave');
        } else if (s === 'stop' || s === 'report' || s === 'justify') {
          await this.deliverReport(npc);
        } else {
          const hints = {
            gear: 'Sin casco, chaleco y botas no hay recorrido. La caseta está junto a la entrada.',
            plan: 'El plano está en el tablero, junto a la caseta. Ahí viene tu lista de verificación.',
            inspect: 'Recorre los ocho puntos de la lista y califícalos: riesgo o en regla. Acércate a cada uno.',
            measures: 'Ya calificaste todo. A cada riesgo asígnale su medida correctiva, en el mismo punto.',
            sign: 'La zanja no puede quedarse abierta sin aviso: colócale la señalización.'
          };
          await ui.dialog({ speaker: SUPERVISOR.name, lines: [hints[s] || 'Sigue con el recorrido, inspector.'] });
        }
      } finally { npc.talking = false; }
    });
  }

  openGear() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.talked) { await ui.dialog({ speaker: 'Caseta de obra', lines: ['Equipo de protección del personal. Preséntate primero con la residente.'] }); return; }
      const wrap = h('div', 'why');
      const paint = () => {
        wrap.replaceChildren();
        GEAR.forEach(g => {
          const on = a.gear.includes(g.id);
          const b = h('button', 'why__item' + (on ? ' is-on' : ''), (on ? '✓ ' : '') + g.name + (on ? ' · puesto' : ' · ponértelo'));
          b.type = 'button';
          b.addEventListener('click', () => { if (this.act('equip', { id: g.id })) paint(); });
          wrap.append(b);
        });
      };
      paint();
      const body = h('div');
      body.append(h('p', 'docs__note', 'El equipo de protección personal va SIEMPRE antes de pisar el patio. Tócalo para ponértelo.'), wrap);
      await ui.modal({ eyebrow: 'Caseta de obra', title: 'Equipo de protección personal', content: body,
        actions: [{ id: 'ok', label: 'Listo', primary: true }],
        validate: () => GEAR.every(g => a.gear.includes(g.id)) ? null : 'Te falta ponerte parte del equipo.' });
      ui.toast('Equipo completo. Ahora el plano del tablero.');
    });
  }

  openPlan() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.talked) { await ui.dialog({ speaker: 'Tablero de obra', lines: ['El plano de la obra. Preséntate primero con la residente.'] }); return; }
      if (!GEAR.every(g => a.gear.includes(g.id))) { await ui.dialog({ speaker: 'Tablero de obra', lines: ['Primero el equipo de protección: la caseta está aquí junto.'] }); return; }
      const wrap = h('div', 'docs');
      const paper = h('div', 'docs__paper');
      paper.append(h('h4', null, 'Lista de verificación · 8 puntos'));
      const dl = h('dl');
      SPOTS.forEach(sp => {
        const v = a.verdicts[sp.id];
        dl.append(h('dt', null, `${sp.area} · ${sp.name}`), h('dd', null, v ? (v === 'riesgo' ? '⚠ Riesgo' + (a.measures[sp.id] ? ' · medida asignada' : ' · falta medida') : '✓ En regla') : 'Pendiente'));
      });
      paper.append(dl, h('p', 'docs__note', 'Recorre la obra y califica cada punto en el lugar. Lo que marques como riesgo pedirá su medida correctiva.'));
      wrap.append(paper);
      await ui.modal({ eyebrow: 'Tablero de obra', title: 'Plano y lista de verificación', content: wrap, actions: [{ id: 'ok', label: 'Comenzar recorrido', primary: true }] });
      if (this.act('readPlan')) ui.toast('Lista en mano. Inspecciona los ocho puntos.');
    });
  }

  inspectSpot(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, sp = spotById(id);
      if (!a.plan) { await ui.dialog({ speaker: sp.name, lines: [a.talked ? 'Antes de calificar, toma el plano con la lista de verificación del tablero.' : 'Preséntate primero con la residente.'] }); return; }
      this.act('inspect', { id });
      const card = h('div', 'proposal');
      card.append(h('div', 'proposal__perk', sp.area));
      card.append(h('p', null, sp.finding));
      let verdict = a.verdicts[id] || null;
      const pick = h('div', 'why');
      const paintV = () => {
        pick.replaceChildren();
        [['riesgo', '⚠ Es un riesgo'], ['en-regla', '✓ Está en regla']].forEach(([v, label]) => {
          const b = h('button', 'why__item' + (verdict === v ? ' is-on' : ''), label); b.type = 'button';
          b.addEventListener('click', () => { verdict = v; paintV(); });
          pick.append(b);
        });
      };
      paintV();
      card.append(pick);
      const r = await ui.modal({ eyebrow: 'Punto de inspección', title: sp.name, content: card,
        actions: [{ id: 'back', label: 'Verlo después' }, { id: 'ok', label: 'Calificar', primary: true }],
        validate: x => x === 'ok' && !verdict ? 'Decide: ¿riesgo o en regla?' : null });
      if (r !== 'ok') return;
      if (!this.act('assess', { id, verdict })) return;
      if (verdict === 'riesgo') await this.chooseMeasure(sp);
      else ui.toast(`${sp.name}: en regla.`);
    });
  }

  async chooseMeasure(sp) {
    const ui = this.api.ui, a = this.attempt;
    let chosen = a.measures[sp.id] || null;
    const list = h('div', 'why');
    const paint = () => {
      list.replaceChildren();
      sp.measures.forEach(m => {
        const b = h('button', 'why__item' + (chosen === m.id ? ' is-on' : ''), m.text); b.type = 'button';
        b.addEventListener('click', () => { chosen = m.id; paint(); });
        list.append(b);
      });
    };
    paint();
    const body = h('div');
    body.append(h('p', 'docs__note', 'Marcaste un riesgo. ¿Qué medida correctiva ordenas?'), list);
    const r = await ui.modal({ eyebrow: sp.name, title: 'Medida correctiva', content: body,
      actions: [{ id: 'ok', label: 'Ordenar la medida', primary: true }],
      validate: x => x === 'ok' && !chosen ? 'Elige una medida.' : null });
    if (r === 'ok' && this.act('measure', { id: sp.id, measure: chosen })) {
      ui.toast(sp.id === SIGN_SPOT && !a.signed ? 'Medida ordenada. Ahora coloca la señalización de la zanja.' : 'Medida ordenada.');
    }
  }

  placeSign() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (a.signed) { await ui.dialog({ speaker: 'Zanja de cimentación', lines: ['La señalización ya está colocada: conos, cinta y aviso de excavación.'] }); return; }
      if (a.verdicts[SIGN_SPOT] !== 'riesgo') { await ui.dialog({ speaker: 'Zanja de cimentación', lines: ['Primero inspecciona y califica la zanja con tu lista.'] }); return; }
      if (this.act('placeSign')) {
        this.api.player.emote('celebrate', 1.6);
        ui.toast('Señalización colocada: conos, cinta y aviso de excavación.');
      }
    });
  }

  async deliverReport(npc) {
    const ui = this.api.ui, a = this.attempt;
    // 1) qué se detiene de inmediato
    if (this.step === 'stop') {
      await ui.dialog({ speaker: SUPERVISOR.name, lines: ['Terminaste el recorrido. Dime, inspector: ¿qué actividad detenemos AHORA MISMO?'] });
      let chosen = null;
      const list = h('div', 'why');
      const paint = () => {
        list.replaceChildren();
        STOP_OPTIONS.forEach(o => {
          const b = h('button', 'why__item' + (chosen === o.id ? ' is-on' : ''), o.text); b.type = 'button';
          b.addEventListener('click', () => { chosen = o.id; paint(); });
          list.append(b);
        });
      };
      paint();
      const r = await ui.modal({ eyebrow: 'Decisión del inspector', title: '¿Qué se detiene de inmediato?', content: list,
        actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Detener esa actividad', primary: true }],
        validate: x => x === 'ok' && !chosen ? 'Elige una actividad.' : null });
      if (r !== 'ok' || !this.act('stopWork', { id: chosen })) return;
    }
    // 2) reporte y justificación
    if (this.step === 'report' && !this.act('report')) return;
    await ui.dialog({ speaker: SUPERVISOR.name, lines: ['Queda asentado en bitácora. Última pregunta: ¿en qué te basaste?'] });
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
      validate: x => x === 'ok' && picked.size === 0 ? 'Elige al menos una razón.' : null });
    if (r2 !== 'ok') return;
    if (!this.act('justify', { reasons: [...picked] })) return;
    await this.close();
  }

  async close() {
    const ui = this.api.ui;
    const out = await this.finish(result => {
      const b = result.breakdown;
      const paula = result.passed
        ? (result.score === 100 ? 'Impecable, inspector. Con recorridos así, esta obra llega completa a la entrega… y la gente completa a su casa.' : 'Buen recorrido. Hubo detalles, pero lo grave quedó detenido y por escrito.')
        : 'Así no, inspector. Repasemos la lista: lo grave se detiene, lo inseguro se corrige y todo se reporta.';
      return {
        before: () => ui.dialog({ speaker: SUPERVISOR.name, lines: [paula] }),
        rows: [['Identificación de riesgos', b.identificacion, 40], ['Medidas correctivas', b.medidas, 30], ['Paro de la actividad crítica', b.paro, 10], ['Justificación', b.justificacion, 10], ['EPP, plano y señalización', b.research, 10]],
        heading: result.passed ? 'Lo que salvó el recorrido' : 'Lo que hay que corregir',
        paragraphs: [
          `Calificaste bien ${b.assessHits} de ${SPOTS.length} puntos y acertaste ${b.measureHits} de 5 medidas. La actividad que se detenía de inmediato era el andamio sur: altura sin protección y con gente arriba.`,
          'Un letrero no sustituye un barandal, la cinta de aislar no arregla un cable dañado y la experiencia no reemplaza al casco: las medidas correctivas atacan la causa, no la apariencia.'
        ],
        lesson: 'En obra, el orden es siempre el mismo: lo grave se detiene, lo inseguro se corrige, todo se señaliza y se reporta. Este juego no sustituye la capacitación oficial en seguridad.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Misión reiniciada. Preséntate otra vez con la Ing. Paula.');
  }
}
