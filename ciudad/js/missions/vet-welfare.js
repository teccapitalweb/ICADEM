// Misión 6 · "Guardianes del bienestar": lo propio de la Clínica Veterinaria (observar a cada animal,
// pesarlo en la báscula, leer su expediente, valorarlo, decidir, armar el enriquecimiento y orientar).
// Lo común lo hereda de MissionController; las reglas viven en vet-welfare-logic.js.
import { VET, DOMAINS, PRIORITIES, ANIMALS, REVIEWS, ENRICHMENT, REASONS, animalById } from './vet-welfare-logic.js';
import { MissionController, h } from './controller.js';

const WHAT = { observe: 'Observar', weigh: 'Pesar', chart: 'Expediente' };

export class VetWelfareMission extends MissionController {
  get attempt() { return this.state; }
  reviewed(id, what) { return (this.attempt.reviewed[id] || []).includes(what); }
  reviewedAll(id) { return REVIEWS.every(w => this.reviewed(id, w)); }
  colorOf(id) { const p = PRIORITIES.find(x => x.id === this.attempt.priority[id]); return p ? p.hex : null; }
  /** Animal que está sobre la báscula ahora (para moverlo en la escena). */
  onScale = null;

  wants(kind, id, what) {
    const s = this.step, a = this.attempt;
    if (kind === 'vet') return s === 'brief' || s === 'counsel';
    if (kind === 'animal') return (s === 'review' && !this.reviewed(id, 'observe')) || (s === 'assess' && this.reviewedAll(id) && !a.priority[id]) || (s === 'act' && !a.plan[id]);
    if (kind === 'review') return s === 'review' && !this.reviewed(id, what);
    if (kind === 'scale') return s === 'review' && ANIMALS.some(x => !this.reviewed(x.id, 'weigh'));
    if (kind === 'habitat') return s === 'enrich';
    return false;
  }

  labelFor(kind, id, what) {
    const s = this.step, a = this.attempt, x = id ? animalById(id) : null;
    if (kind === 'vet') return s === 'counsel' ? `Orientar a los tutores con la ${VET.name}` : `Hablar con la ${VET.name}`;
    if (kind === 'animal') {
      if (s === 'act' && !a.plan[id]) return `Decidir qué sigue con ${x.name}`;
      if (this.reviewedAll(id) && !a.priority[id]) return `Valorar a ${x.name}`;
      return `Observar a ${x.name} (${x.species.toLowerCase()})`;
    }
    if (kind === 'review') return `${WHAT[what]} · ${x.name}`;
    if (kind === 'scale') return 'Usar la báscula';
    if (kind === 'habitat') return 'Arreglar el área de observación de Luna';
    return 'Usar';
  }

  talkToVet(npc) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.step;
      npc.talking = true;
      try {
        if (s === 'brief') {
          await ui.dialog({ speaker: `${VET.name} · ${VET.role}`, lines: [
            '¡Qué bueno que llegas! Hoy tenemos cuatro pacientes y necesito otros ojos.',
            'Recuerda: un animal no nos dice qué le pasa. Hay que observarlo, pesarlo y leer su historia.',
            'Piensa en su bienestar completo: nutrición, ambiente, salud, conducta y cómo se siente.',
            'La báscula está junto a la mesa de exploración. Empieza cuando quieras.'
          ] });
          this.act('brief');
          this.api.player.emote('wave');
        } else if (s === 'counsel') {
          await this.counsel();
        } else {
          const hints = {
            review: 'Revisa a los cuatro: obsérvalos, pésalos en la báscula y lee su expediente.',
            assess: 'Ya tienes la información: valora a cada uno junto a su lugar.',
            act: 'Decide qué sigue con cada paciente. Piensa en qué es urgente y qué puede esperar.',
            enrich: 'Luna necesita un ambiente distinto. Arregla el área de observación con lo que le ayude.'
          };
          await ui.dialog({ speaker: VET.name, lines: [hints[s] || 'Vas muy bien.'] });
        }
      } finally { npc.talking = false; }
    });
  }

  /** Junto al animal: observar (si falta), valorar o decidir, según el momento del turno. */
  attend(id, npc) {
    const a = this.attempt;
    if (!a.briefed || !this.reviewedAll(id)) return this.review(id, 'observe', npc);
    if (!a.priority[id] || this.step === 'assess') return this.#assess(id);
    return this.#decide(id);
  }

  review(id, what, npc) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, x = animalById(id);
      if (!a.briefed) { await ui.dialog({ speaker: x.name, lines: ['(Te mira con curiosidad.) Habla primero con la veterinaria.'] }); return; }
      if (what === 'observe') {
        if (npc) npc.talking = true;
        try { await ui.dialog({ speaker: `${x.name} · ${x.species}, ${x.age}`, lines: [x.observe, 'Su tutor comenta: ' + x.owner] }); }
        finally { if (npc) npc.talking = false; }
      } else {
        const paper = h('div', 'docs__paper'); paper.append(h('h4', null, `Expediente · ${x.name}`));
        const dl = h('dl'); x.chart.forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v)));
        dl.append(h('dt', null, 'Peso en su última visita'), h('dd', null, x.weightBefore.toFixed(1) + ' kg'));
        paper.append(dl, h('p', 'docs__note', 'Caso ficticio con fines educativos.'));
        const wrap = h('div', 'docs'); wrap.append(paper);
        await ui.modal({ eyebrow: 'Expedientes', title: x.name, content: wrap, actions: [{ id: 'ok', label: 'Cerrar expediente', primary: true }] });
      }
      const first = !this.reviewed(id, what);
      if (this.act('review', { id, what }) && first && this.reviewedAll(id)) ui.toast(`${x.name}: ya tienes la información. Valóralo junto a su lugar.`);
    });
  }

  /** La báscula: el jugador elige a quién subir; el animal se mueve a la báscula y se compara el peso. */
  useScale() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.briefed) { await ui.dialog({ speaker: 'Báscula', lines: ['Báscula de la clínica. Habla primero con la veterinaria.'] }); return; }
      let chosen = ANIMALS.find(x => !this.reviewed(x.id, 'weigh'))?.id || ANIMALS[0].id;
      const pick = h('div', 'pick');
      const paint = () => { pick.replaceChildren(); ANIMALS.forEach(x => { const b = h('button', 'pick__card' + (chosen === x.id ? ' is-on' : '')); b.type = 'button'; b.append(h('strong', null, x.name + (this.reviewed(x.id, 'weigh') ? ' · pesado' : '')), h('span', null, x.species)); b.addEventListener('click', () => { chosen = x.id; paint(); }); pick.append(b); }); };
      paint();
      const r = await ui.modal({ eyebrow: 'Báscula', title: '¿A quién subes a la báscula?', content: pick, actions: [{ id: 'back', label: 'Cerrar' }, { id: 'ok', label: 'Pesar', primary: true }] });
      if (r !== 'ok') return;
      const x = animalById(chosen);
      this.onScale = chosen; await new Promise(res => setTimeout(res, 700));
      const diff = x.weightNow - x.weightBefore, pct = Math.round(diff / x.weightBefore * 100);
      const out = h('div', 'sim'), dl = h('dl', 'sim__totals');
      [['Peso hoy', x.weightNow.toFixed(1) + ' kg'], ['Peso anterior', x.weightBefore.toFixed(1) + ' kg'], ['Cambio', (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' kg (' + (pct >= 0 ? '+' : '') + pct + ' %)']]
        .forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v)));
      out.append(dl, h('p', 'compare__note', x.id === 'toby' ? 'Un cachorro debe subir de peso: es parte de su desarrollo.' : 'Compara contra su expediente: ¿el cambio es esperado?'));
      await ui.modal({ eyebrow: 'Báscula', title: `${x.name} · ${x.weightNow.toFixed(1)} kg`, content: out, actions: [{ id: 'ok', label: 'Anotado', primary: true }] });
      this.onScale = null;
      const first = !this.reviewed(chosen, 'weigh');
      if (this.act('review', { id: chosen, what: 'weigh' }) && first && this.reviewedAll(chosen)) ui.toast(`${x.name}: ya tienes la información. Valóralo junto a su lugar.`);
    });
  }

  #assess(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, x = animalById(id);
      const flags = new Set(a.flags[id] || []); let prio = a.priority[id] || null; let dom = a.domain[id] === undefined ? undefined : a.domain[id];
      const fl = h('div', 'why');
      x.findings.forEach(f => { const b = h('button', 'why__item' + (flags.has(f.id) ? ' is-on' : ''), (flags.has(f.id) ? '⚠ ' : '') + f.text); b.type = 'button'; b.addEventListener('click', () => { if (flags.has(f.id)) flags.delete(f.id); else flags.add(f.id); b.classList.toggle('is-on', flags.has(f.id)); b.textContent = (flags.has(f.id) ? '⚠ ' : '') + f.text; }); fl.append(b); });
      const dm = h('div', 'pick');
      const paintD = () => { dm.replaceChildren(); [...DOMAINS, { id: null, name: 'Ninguno: su bienestar está cubierto', text: '' }].forEach(d => { const b = h('button', 'pick__card' + (dom === d.id ? ' is-on' : '')); b.type = 'button'; b.append(h('strong', null, d.name), h('span', null, d.text)); b.addEventListener('click', () => { dom = d.id; paintD(); }); dm.append(b); }); };
      paintD();
      const pr = h('div', 'pick');
      const paintP = () => { pr.replaceChildren(); PRIORITIES.forEach(p => { const b = h('button', 'pick__card' + (prio === p.id ? ' is-on' : '')); b.type = 'button'; b.style.borderLeft = `8px solid #${p.hex.toString(16).padStart(6, '0')}`; b.append(h('strong', null, p.name), h('span', null, p.text)); b.addEventListener('click', () => { prio = p.id; paintP(); }); pr.append(b); }); };
      paintP();
      const body = h('div');
      body.append(h('p', 'docs__note', 'Marca los SIGNOS DE ALERTA (puede no haber ninguno):'), fl, h('p', 'docs__note', '¿Qué dominio de su bienestar es el más afectado?'), dm, h('p', 'docs__note', 'Prioridad:'), pr);
      const r = await ui.modal({ eyebrow: `Valoración · ${x.species}`, title: `${x.name}, ${x.age}`, content: body, wide: true,
        actions: [{ id: 'back', label: 'Después' }, { id: 'ok', label: 'Registrar valoración', primary: true }],
        validate: v => v === 'ok' && (!prio || dom === undefined) ? 'Elige el dominio y la prioridad.' : null });
      if (r !== 'ok') return;
      if (this.act('assess', { id, flags: [...flags], priority: prio, domain: dom })) ui.toast(`${x.name}: prioridad ${PRIORITIES.find(p => p.id === prio).name.toLowerCase()}.`);
    });
  }

  #decide(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, x = animalById(id);
      let action = a.plan[id] || null;
      const list = h('div', 'why');
      const paint = () => { list.replaceChildren(); x.actions.forEach(y => { const b = h('button', 'why__item' + (action === y.id ? ' is-on' : ''), y.text); b.type = 'button'; b.addEventListener('click', () => { action = y.id; paint(); }); list.append(b); }); };
      paint();
      const r = await ui.modal({ eyebrow: `Plan · ${x.species}`, title: x.name, content: list,
        actions: [{ id: 'back', label: 'Después' }, { id: 'ok', label: 'Confirmar', primary: true }], validate: v => v === 'ok' && !action ? 'Elige una acción.' : null });
      if (r === 'ok' && this.act('decide', { id, action })) ui.toast(this.step === 'enrich' ? 'Planes listos. Ahora arregla el área de observación de Luna.' : `Plan registrado para ${x.name}.`);
    });
  }

  /** Área de observación: colocar o quitar objetos (aparecen en la escena). */
  openHabitat() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (this.step !== 'enrich' && !a.enrichment.length) { await ui.dialog({ speaker: 'Área de observación', lines: ['Aquí se adapta el espacio de los pacientes. Primero decide el plan de cada uno.'] }); return; }
      const list = h('div', 'why');
      const paint = () => { list.replaceChildren(); ENRICHMENT.forEach(e => { const on = a.enrichment.includes(e.id); const b = h('button', 'why__item' + (on ? ' is-on' : ''), (on ? '✓ ' : '') + e.name); b.type = 'button'; b.addEventListener('click', () => { if (on) this.act('remove', { id: e.id }); else if (!this.act('place', { id: e.id })) ui.toast('Máximo cuatro objetos: el espacio también cuenta.'); paint(); }); list.append(b); }); };
      paint();
      const body = h('div'); body.append(h('p', 'docs__note', 'Luna convive con otro gato y está estresada. Coloca lo que la ayude (de 3 a 4 objetos). Lo que pongas aparece en el área.'), list);
      await ui.modal({ eyebrow: 'Área de observación', title: 'Ambiente para Luna', content: body, wide: true,
        actions: [{ id: 'ok', label: 'Listo', primary: true }], validate: () => a.enrichment.length >= 3 ? null : 'Coloca al menos tres objetos.' });
      if (this.step === 'counsel') ui.toast('Área lista. Orienta a los tutores con la veterinaria.');
    });
  }

  async counsel() {
    const ui = this.api.ui;
    await ui.dialog({ speaker: VET.name, lines: ['Los tutores esperan. ¿Qué les explicamos? Elige la idea clave de hoy.'] });
    const why = h('div', 'why'), picked = new Set();
    REASONS.forEach(r => { const b = h('button', 'why__item', r.text); b.type = 'button'; b.addEventListener('click', () => { if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < 2) picked.add(r.id); else { ui.toast('Elige máximo dos.'); return; } b.classList.toggle('is-on', picked.has(r.id)); }); why.append(b); });
    const r = await ui.modal({ eyebrow: 'Orientación a tutores', title: '¿Qué les explicas?', content: why, hint: 'Elige una o dos ideas.',
      actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Orientar', primary: true }], validate: v => v === 'ok' && picked.size === 0 ? 'Elige al menos una idea.' : null });
    if (r !== 'ok' || !this.act('counsel', { reasons: [...picked] })) return;
    await this.close();
  }

  async close() {
    const ui = this.api.ui;
    const out = await this.finish(result => {
      const b = result.breakdown;
      return {
        before: () => ui.dialog({ speaker: VET.name, lines: [result.passed ? (result.score === 100 ? '¡Turno de diez! Rocky ya está en atención y Luna tiene un espacio a su medida.' : 'Buen turno. Lo urgente se atendió primero.') : 'Repasemos: en animales, los cambios de conducta y de peso son la forma en que nos avisan.'] }),
        rows: [['Prioridad', b.prioridad, 20], ['Signos de alerta', b.alertas, 16], ['Dominios del bienestar', b.dominios, 12], ['Acciones', b.acciones, 20], ['Enriquecimiento', b.enriquecimiento, 12], ['Orientación', b.justificacion, 10], ['Revisión completa', b.research, 10]],
        heading: result.passed ? 'Lo que salió bien' : 'Lo que hay que repasar',
        paragraphs: [
          `Rocky era urgente: un conejo que deja de comer y de defecar no puede esperar. Canela (sed, orina y pérdida de peso) necesitaba consulta hoy. Acertaste ${b.priorityHits} de 4 prioridades.`,
          `Luna no tenía un problema de «mala conducta» sino de ambiente: más areneros, alturas y escondites. Colocaste ${b.goodPlaced} objetos que ayudan${b.badPlaced ? ` y ${b.badPlaced} que la estresan más` : ''}.`
        ],
        lesson: 'El bienestar animal tiene cinco dominios: nutrición, ambiente, salud, comportamiento y estado mental. Casos ficticios: no sustituye la consulta veterinaria.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Turno reiniciado. Habla otra vez con la veterinaria.');
  }
}
