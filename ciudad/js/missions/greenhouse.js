// Misión 8 · "Cultivo inteligente": lo propio del Invernadero (ficha del cultivo, sensores,
// tablero de clima con proyección en vivo, dosificador de la solución nutritiva, válvulas de
// riego por cama y trampas amarillas). Lo común lo hereda de MissionController.
import { AGRONOMIST, CHART, THRESHOLDS, SENSORS, LEVELS, BEDS, IRRIGATION, TRAPS, PEST_ACTIONS, REASONS, sensorById, projectClimate, projectSolution } from './greenhouse-logic.js';
import { MissionController, h } from './controller.js';

const fmt = (v, unit) => `${v}${unit ? (unit === '%' ? '%' : ' ' + unit) : ''}`;
const range = r => `${r.min}–${r.max}${r.unit ? (r.unit === '%' ? '%' : ' ' + r.unit) : ''}`;

export class GreenhouseMission extends MissionController {
  get attempt() { return this.state; }

  wants(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'agro') return s === 'brief' || s === 'debrief';
    if (kind === 'chart') return s === 'chart';
    if (kind === 'sensor') return s === 'sensors' && !a.diagnosis[id];
    if (kind === 'climate') return s === 'climate';
    if (kind === 'solution') return s === 'solution';
    if (kind === 'bed') return s === 'irrigation' && !a.irrigation[id];
    if (kind === 'trap') return s === 'traps' && !a.traps.includes(id);
    if (kind === 'pest') return s === 'pest';
    return false;
  }

  labelFor(kind, id) {
    const s = this.step;
    if (kind === 'agro') return s === 'debrief' ? `Comentar el turno con el ${AGRONOMIST.name}` : `Hablar con el ${AGRONOMIST.name}`;
    if (kind === 'chart') return 'Leer la ficha del cultivo';
    if (kind === 'sensor') return `Sensor · ${CHART[id].name}`;
    if (kind === 'climate') return 'Tablero de clima · ventilas y malla';
    if (kind === 'solution') return 'Dosificador · solución nutritiva';
    if (kind === 'bed') return `Válvula de riego · cama ${id}`;
    if (kind === 'trap') return `Trampa amarilla ${id}`;
    if (kind === 'pest') return 'Caja de control biológico';
    return 'Usar';
  }

  /** ¿Puede ya tocar este equipo? Si no, explica qué falta. */
  async #notYet(speaker, need) {
    const order = ['brief', 'chart', 'sensors', 'climate', 'solution', 'irrigation', 'traps', 'pest', 'debrief', 'done'];
    if (order.indexOf(this.step) >= order.indexOf(need)) return false;
    const msg = { chart: 'Habla primero con el agrónomo.', sensors: 'Antes de medir, consulta la ficha del cultivo en el pizarrón.', climate: 'Primero lee y diagnostica los cuatro sensores.', solution: 'Primero ajusta el clima en el tablero.', irrigation: 'Primero corrige la solución nutritiva en el dosificador.', traps: 'Primero decide el riego de las tres camas.', pest: 'Primero revisa las tres trampas amarillas.' };
    await this.api.ui.dialog({ speaker, lines: [msg[need] || 'Todavía no.'] });
    return true;
  }

  talkToAgro(npc) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.step;
      npc.talking = true;
      try {
        if (s === 'brief') {
          await ui.dialog({ speaker: `${AGRONOMIST.name} · ${AGRONOMIST.role}`, lines: [
            '¡Bienvenido al invernadero! Este jitomate está dando fruto y hoy te dejo el turno.',
            'Aquí no se adivina: hay sensores de clima, de la solución nutritiva y de humedad en cada cama.',
            'Consulta la ficha del cultivo en el pizarrón, lee los sensores y ajusta lo que haga falta.',
            'Al final revisa las trampas amarillas. Si hay plaga, actúa con cabeza: lo menos dañino primero.'
          ] });
          this.act('brief'); this.api.player.emote('wave');
        } else if (s === 'debrief') {
          await this.debrief();
        } else {
          const hints = { chart: 'La ficha está en el pizarrón verde, junto a la entrada.', sensors: 'Los cuatro sensores tienen pantalla: temperatura, humedad, CE y pH.', climate: 'El tablero de clima mueve ventilas y malla sombra. Mira la proyección antes de aplicar.', solution: 'El dosificador corrige la solución: concentrado sube la CE; el ácido baja el pH.', irrigation: 'Cada cama tiene su sensor de sustrato y su válvula.', traps: 'Las trampas amarillas cuelgan sobre cada cama.', pest: 'Si una trampa pasa el umbral, ve a la caja de control biológico.' };
          await ui.dialog({ speaker: AGRONOMIST.name, lines: [hints[s] || '¡Vamos bien!'] });
        }
      } finally { npc.talking = false; }
    });
  }

  readChart() {
    return this.guard(async () => {
      const ui = this.api.ui;
      if (await this.#notYet('Ficha del cultivo', 'chart')) return;
      const paper = h('div', 'docs__paper'); paper.append(h('h4', null, 'Jitomate · etapa de fructificación'));
      const dl = h('dl');
      Object.values(CHART).forEach(r => dl.append(h('dt', null, r.name), h('dd', null, range(r))));
      dl.append(h('dt', null, 'Umbral de acción · mosca blanca'), h('dd', null, `más de ${THRESHOLDS.moscaBlanca} por trampa a la semana`));
      dl.append(h('dt', null, 'Umbral de acción · trips'), h('dd', null, `más de ${THRESHOLDS.trips} por trampa a la semana`));
      paper.append(dl); const wrap = h('div', 'docs'); wrap.append(paper);
      await ui.modal({ eyebrow: 'Pizarrón del invernadero', title: 'Ficha del cultivo', content: wrap, actions: [{ id: 'ok', label: 'Entendido', primary: true }] });
      if (this.act('readChart')) ui.toast('Ficha consultada. Ahora lee los sensores.');
    });
  }

  readSensor(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, sen = sensorById(id), r = CHART[id];
      if (await this.#notYet(r.name, 'sensors')) return;
      this.act('readSensor', { id });
      let level = a.diagnosis[id] || null;
      const pick = h('div', 'pick');
      const paint = () => { pick.replaceChildren(); LEVELS.forEach(l => { const b = h('button', 'pick__card' + (level === l.id ? ' is-on' : '')); b.type = 'button'; b.append(h('strong', null, l.name)); b.addEventListener('click', () => { level = l.id; paint(); }); pick.append(b); }); };
      paint();
      const body = h('div'), big = h('div', 'sim__big');
      big.append(h('span', null, 'Lectura actual'), h('b', null, fmt(sen.value, r.unit)));
      body.append(big, h('p', 'compare__note', 'Compárala con la ficha del cultivo.'), pick);
      const res = await ui.modal({ eyebrow: 'Sensor', title: r.name, content: body, actions: [{ id: 'ok', label: 'Registrar diagnóstico', primary: true }], validate: x => x === 'ok' && !level ? 'Elige un diagnóstico.' : null });
      if (res === 'ok' && this.act('diagnose', { id, level })) {
        const left = SENSORS.filter(x => !a.diagnosis[x.id]).length;
        ui.toast(left ? `Diagnóstico registrado. Faltan ${left}.` : 'Sensores diagnosticados. Ajusta el clima en el tablero.');
      }
    });
  }

  /** Simulador con dos perillas y proyección en vivo (el servidor recalcula con el mismo modelo). */
  async #simulator({ eyebrow, title, knobs, project, rows, note }) {
    const ui = this.api.ui, vals = Object.fromEntries(knobs.map(k => [k.id, k.value]));
    const body = h('div', 'sim'), out = h('div');
    const paint = () => {
      const p = project(vals); out.replaceChildren();
      rows.forEach(([key, r]) => { const v = p[key], ok = v >= r.min && v <= r.max; const big = h('div', 'sim__big'); big.append(h('span', null, `${r.name} (objetivo ${range(r)})`), h('b', null, `${fmt(v, r.unit)} ${ok ? '✅' : '⚠️'}`)); out.append(big); });
    };
    knobs.forEach(k => {
      const lab = h('p', 'compare__note'), input = document.createElement('input');
      Object.assign(input, { type: 'range', min: String(k.min), max: String(k.max), step: String(k.step), value: String(k.value) }); input.style.width = '100%';
      const label = () => { lab.textContent = `${k.name}: ${vals[k.id]}${k.unit}`; };
      input.addEventListener('input', () => { vals[k.id] = Number(input.value); label(); paint(); });
      label(); body.append(lab, input);
    });
    paint(); body.append(out); if (note) body.append(h('p', 'compare__note', note));
    const r = await ui.modal({ eyebrow, title, content: body, actions: [{ id: 'back', label: 'Cerrar' }, { id: 'ok', label: 'Aplicar', primary: true }] });
    return r === 'ok' ? vals : null;
  }

  openClimate() {
    return this.guard(async () => {
      if (await this.#notYet('Tablero de clima', 'climate')) return;
      const cur = this.attempt.climate || { vent: 20, shade: 0 };
      const v = await this.#simulator({ eyebrow: 'Tablero de clima', title: 'Ventilas y malla sombra',
        knobs: [{ id: 'vent', name: 'Apertura de ventilas', unit: '%', min: 0, max: 100, step: 5, value: cur.vent }, { id: 'shade', name: 'Malla sombra', unit: '%', min: 0, max: 80, step: 5, value: cur.shade }],
        project: x => projectClimate(x.vent, x.shade), rows: [['temp', CHART.temp], ['hr', CHART.hr], ['light', CHART.light]],
        note: 'Ventilar enfría y seca el aire; la malla enfría, pero quita luz a la planta.' });
      if (v && this.act('climate', v)) this.api.ui.toast('Clima ajustado. Ahora la solución nutritiva.');
    });
  }

  openSolution() {
    return this.guard(async () => {
      if (await this.#notYet('Dosificador', 'solution')) return;
      const cur = this.attempt.solution || { nutrient: 0, acid: 0 };
      const v = await this.#simulator({ eyebrow: 'Dosificador de fertirriego', title: 'Solución nutritiva',
        knobs: [{ id: 'nutrient', name: 'Concentrado nutritivo', unit: ' L', min: 0, max: 20, step: 1, value: cur.nutrient }, { id: 'acid', name: 'Ácido para corregir pH', unit: ' mL', min: 0, max: 40, step: 2, value: cur.acid }],
        project: x => projectSolution(x.nutrient, x.acid), rows: [['ce', CHART.ce], ['ph', CHART.ph]],
        note: 'El concentrado sube la CE (y un poco el pH). El ácido baja el pH. Nunca mezcles concentrados sin diluir.' });
      if (v && this.act('solution', v)) this.api.ui.toast('Solución corregida. Revisa el riego de cada cama.');
    });
  }

  openBed(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, bed = BEDS.find(b => b.id === id);
      if (await this.#notYet(`Cama ${id}`, 'irrigation')) return;
      let chosen = a.irrigation[id] || null;
      const list = h('div', 'why');
      const paint = () => { list.replaceChildren(); IRRIGATION.forEach(x => { const b = h('button', 'why__item' + (chosen === x.id ? ' is-on' : ''), x.name); b.type = 'button'; b.addEventListener('click', () => { chosen = x.id; paint(); }); list.append(b); }); };
      paint();
      const body = h('div'), big = h('div', 'sim__big');
      big.append(h('span', null, 'Humedad del sustrato'), h('b', null, `${bed.soil}%`));
      body.append(big, list);
      const r = await ui.modal({ eyebrow: `Cama ${id} · válvula de riego`, title: '¿Qué haces con el riego?', content: body, actions: [{ id: 'ok', label: 'Aplicar', primary: true }], validate: x => x === 'ok' && !chosen ? 'Elige una opción.' : null });
      if (r === 'ok' && this.act('irrigate', { id, action: chosen })) {
        const left = BEDS.filter(b => !a.irrigation[b.id]).length;
        ui.toast(left ? `Cama ${id} lista. Faltan ${left}.` : 'Riego decidido. Revisa las trampas amarillas.');
      }
    });
  }

  inspectTrap(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, t = TRAPS.find(x => x.id === id);
      if (await this.#notYet(`Trampa ${id}`, 'traps')) return;
      this.api.player.emote('interact', 1.2);
      await ui.dialog({ speaker: `Trampa amarilla ${id} · cama ${t.bed}`, lines: [`Cuentas los insectos pegados esta semana: mosca blanca ${t.moscaBlanca}, trips ${t.trips}.`] });
      if (this.act('inspectTrap', { id })) {
        const left = TRAPS.filter(x => !a.traps.includes(x.id)).length;
        ui.toast(left ? `Trampa ${id} revisada. Faltan ${left}.` : 'Trampas revisadas. Decide el manejo en la caja de control biológico.');
      }
    });
  }

  openPest() {
    return this.guard(async () => {
      const ui = this.api.ui;
      if (await this.#notYet('Control biológico', 'pest')) return;
      let zone = null, action = null;
      const zones = h('div', 'pick'), acts = h('div', 'why');
      const paint = () => {
        zones.replaceChildren(); BEDS.forEach(b => { const t = TRAPS.find(x => x.bed === b.id); const btn = h('button', 'pick__card' + (zone === b.id ? ' is-on' : '')); btn.type = 'button'; btn.append(h('strong', null, `Cama ${b.id}`), h('span', null, `Trampa ${t.id}: mosca blanca ${t.moscaBlanca} · trips ${t.trips}`)); btn.addEventListener('click', () => { zone = b.id; paint(); }); zones.append(btn); });
        acts.replaceChildren(); PEST_ACTIONS.forEach(x => { const b = h('button', 'why__item' + (action === x.id ? ' is-on' : ''), x.text); b.type = 'button'; b.addEventListener('click', () => { action = x.id; paint(); }); acts.append(b); });
      };
      paint();
      const body = h('div'); body.append(h('p', 'compare__note', `Umbral: mosca blanca más de ${THRESHOLDS.moscaBlanca} · trips más de ${THRESHOLDS.trips} por trampa.`), zones, acts);
      const r = await ui.modal({ eyebrow: 'Manejo integrado de plagas', title: '¿Dónde y cómo actúas?', content: body, wide: true, actions: [{ id: 'ok', label: 'Aplicar', primary: true }], validate: x => x === 'ok' && (!zone || !action) ? 'Elige la cama y la medida.' : null });
      if (r === 'ok' && this.act('pest', { zone, action })) ui.toast('Decisión registrada. Comenta el turno con el agrónomo.');
    });
  }

  async debrief() {
    const ui = this.api.ui;
    await ui.dialog({ speaker: AGRONOMIST.name, lines: ['Buen turno. Antes de irte: ¿qué te llevas de hoy?'] });
    const why = h('div', 'why'), picked = new Set();
    REASONS.forEach(r => { const b = h('button', 'why__item', r.text); b.type = 'button'; b.addEventListener('click', () => { if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < 2) picked.add(r.id); else { ui.toast('Elige máximo dos.'); return; } b.classList.toggle('is-on', picked.has(r.id)); }); why.append(b); });
    const r = await ui.modal({ eyebrow: 'Cierre del turno', title: '¿Qué guía un cultivo inteligente?', content: why, hint: 'Elige una o dos ideas.', actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Cerrar turno', primary: true }], validate: x => x === 'ok' && picked.size === 0 ? 'Elige al menos una idea.' : null });
    if (r !== 'ok' || !this.act('debrief', { reasons: [...picked] })) return;
    await this.close();
  }

  async close() {
    const ui = this.api.ui;
    const out = await this.finish(result => {
      const b = result.breakdown, c = b.climate, s = b.solution;
      return {
        before: () => ui.dialog({ speaker: AGRONOMIST.name, lines: [result.passed ? (result.score === 100 ? '¡Turno de libro! El cultivo quedó en rango y sin químicos de más.' : 'Buen turno. Hay detalles que pulir, pero el cultivo está bien.') : 'Así el cultivo sufre. Repasemos: medir, comparar con la ficha y actuar con cabeza.'] }),
        rows: [['Diagnóstico de sensores', b.diagnostico, 20], ['Clima', b.clima, 20], ['Solución nutritiva', b.nutricion, 12], ['Riego por cama', b.riego, 18], ['Manejo de plagas', b.mip, 20], ['Cierre', b.justificacion, 10]],
        heading: result.passed ? 'Lo que hizo inteligente tu turno' : 'Lo que hay que corregir',
        paragraphs: [
          `Tu clima quedó en ${c.temp} °C, ${c.hr}% de humedad y ${c.light}% de luz; la solución en CE ${s.ce} mS/cm y pH ${s.ph}. Ventilar baja temperatura y humedad (menos hongos); la malla enfría, pero quita luz.`,
          `Riego correcto en ${b.bedHits} de ${BEDS.length} camas: la cama A estaba seca, la C encharcada (riesgo de raíz asfixiada). Solo la trampa de la cama B pasó el umbral de mosca blanca: ahí se liberan enemigos naturales, sin fumigar todo.`
        ],
        lesson: 'Agricultura de precisión: medir, comparar con la ficha del cultivo, ajustar lo justo y manejar plagas con umbrales y control biológico.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Turno reiniciado. Habla otra vez con el agrónomo.');
  }
}
