// Misión 7 · "Cocina contra reloj": lo propio del Restaurante (comandas en el riel, lavamanos,
// termómetros de los refrigeradores, tablas de colores, protocolo de alérgenos, termómetro de
// cocción en parrilla y plancha, estaciones y pase). Lo común lo hereda de MissionController.
import { CHEF, ORDERS, STATIONS, FRIDGES, FRIDGE_ACTIONS, BOARDS, INGREDIENTS, ALLERGY_OPTIONS, REASONS, orderById, ingredientById } from './kitchen-rush-logic.js';
import { MissionController, h } from './controller.js';

const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class KitchenRushMission extends MissionController {
  get attempt() { return this.state; }
  clockStart = null;
  #timer = null;

  enter() { super.enter(); this.#timer = setInterval(() => this.refreshTracker(), 1000); }
  leave() { clearInterval(this.#timer); super.leave(); }
  restart() { this.clockStart = null; super.restart(); }
  /** El reloj del servicio (marca el ritmo; no cuenta para la calificación). */
  get clock() { return this.clockStart ? (performance.now() - this.clockStart) / 1000 : 0; }
  refreshTracker() {
    super.refreshTracker();
    if (!this.active || !this.clockStart || this.state.served) return;
    const t = document.getElementById('tracker-title');
    if (t) t.textContent = `${this.def.title} · ⏱ ${mmss(this.clock)}`;
  }

  wants(kind, id) {
    const s = this.step, a = this.attempt;
    if (kind === 'chef') return s === 'brief' || s === 'debrief';
    if (kind === 'rail') return s === 'orders';
    if (kind === 'sink') return s === 'wash';
    if (kind === 'fridge') return s === 'fridges' && typeof a.fridges[id] !== 'boolean';
    if (kind === 'prep') return s === 'prep';
    if (kind === 'allergy') return s === 'allergy';
    if (kind === 'cook') return s === 'cook' && !Number.isFinite(a.cooked[id]);
    if (kind === 'pass') return s === 'stations' || s === 'serve';
    return false;
  }

  labelFor(kind, id) {
    const s = this.step;
    if (kind === 'chef') return s === 'debrief' ? `Comentar el servicio con la ${CHEF.name}` : `Hablar con la ${CHEF.name}`;
    if (kind === 'rail') return 'Leer las comandas';
    if (kind === 'sink') return this.attempt.washed ? 'Lavamanos' : 'Lavarte las manos';
    if (kind === 'fridge') return `Revisar el termómetro · Refrigerador ${id}`;
    if (kind === 'prep') return 'Preparar en las tablas de colores';
    if (kind === 'allergy') return 'Estación fría · protocolo de alérgenos';
    if (kind === 'cook') return id === 'pollo' ? 'Parrilla · cocinar el pollo' : 'Plancha · cocinar el pescado';
    if (kind === 'pass') return s === 'serve' ? 'Sacar el servicio por el pase' : 'Pase · repartir comandas entre estaciones';
    return 'Usar';
  }

  talkToChef(npc) {
    return this.guard(async () => {
      const ui = this.api.ui, s = this.step;
      npc.talking = true;
      try {
        if (s === 'brief') {
          await ui.dialog({ speaker: `${CHEF.name} · ${CHEF.role}`, lines: [
            '¡Entra el servicio de la comida! Hoy te toca llevar tres comandas.',
            'En mi cocina, primero la seguridad: manos limpias, cadena fría, tablas separadas y temperaturas correctas.',
            'Y ojo con la mesa 7: tiene alergia. Una traza basta para hacer daño.',
            'Las comandas están en el riel del pase. El reloj corre… ¡a trabajar!'
          ] });
          this.act('brief'); this.clockStart = performance.now();
          this.api.player.emote('wave');
        } else if (s === 'debrief') {
          await this.debrief();
        } else {
          const hints = { orders: 'Lee las tres comandas del riel.', wash: 'Antes de tocar cualquier alimento: manos. El lavamanos está a la izquierda.', fridges: 'Revisa los termómetros de los dos refrigeradores.', prep: 'A preparar: cada ingrediente en su tabla de color.', allergy: 'La mesa 7 tiene alergia al cacahuate: ve a la estación fría.', cook: 'Pollo a la parrilla, pescado a la plancha. Usa el termómetro.', stations: 'Reparte las comandas entre las estaciones en el pase.', serve: '¡Saca el servicio!' };
          await ui.dialog({ speaker: CHEF.name, lines: [hints[s] || '¡Vamos bien!'] });
        }
      } finally { npc.talking = false; }
    });
  }

  readRail() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (!a.briefed) { await ui.dialog({ speaker: 'Riel de comandas', lines: ['Aquí cuelgan las comandas. Habla primero con la chef.'] }); return; }
      const paper = h('div', 'docs__paper'); paper.append(h('h4', null, 'Comandas del servicio'));
      const dl = h('dl');
      ORDERS.forEach(o => { dl.append(h('dt', null, `${o.table} · ${o.dish}`), h('dd', null, o.ingredients.map(i => ingredientById(i).name).join(', ') + (o.allergy ? ` · ⚠ ALERGIA: ${o.allergy.toUpperCase()}` : ''))); this.act('readOrder', { id: o.id }); });
      paper.append(dl); const wrap = h('div', 'docs'); wrap.append(paper);
      await ui.modal({ eyebrow: 'Riel del pase', title: 'Tres comandas', content: wrap, actions: [{ id: 'ok', label: 'Entendido', primary: true }] });
      ui.toast('Comandas leídas. Antes de tocar comida: lávate las manos.');
    });
  }

  wash() {
    return this.guard(async () => {
      const ui = this.api.ui;
      if (!this.attempt.briefed) { await ui.dialog({ speaker: 'Lavamanos', lines: ['Lavamanos de la cocina.'] }); return; }
      if (this.attempt.washed) { ui.toast('Ya te lavaste las manos.'); return; }
      this.api.player.emote('interact', 1.6);
      await ui.dialog({ speaker: 'Lavamanos', lines: ['Agua, jabón, 20 segundos tallando entre los dedos y bajo las uñas, enjuague y toalla desechable.'] });
      if (this.act('wash')) ui.toast('Manos limpias. Ahora revisa los refrigeradores.');
    });
  }

  checkFridge(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, f = FRIDGES.find(x => x.id === id);
      if (!a.briefed) { await ui.dialog({ speaker: f.name, lines: ['Habla primero con la chef.'] }); return; }
      let verdict = typeof a.fridges[id] === 'boolean' ? a.fridges[id] : null;
      const pick = h('div', 'pick');
      const paint = () => { pick.replaceChildren(); [[true, 'En temperatura segura'], [false, 'Fuera de temperatura']].forEach(([v, t]) => { const b = h('button', 'pick__card' + (verdict === v ? ' is-on' : '')); b.type = 'button'; b.append(h('strong', null, t)); b.addEventListener('click', () => { verdict = v; paint(); }); pick.append(b); }); };
      paint();
      const body = h('div'); body.append(h('div', 'sim__big'), pick);
      body.firstChild.append(h('span', null, 'Termómetro'), h('b', null, `${f.temp} °C`));
      const r = await ui.modal({ eyebrow: 'Cadena fría', title: f.name, content: body, actions: [{ id: 'ok', label: 'Registrar', primary: true }], validate: x => x === 'ok' && verdict === null ? 'Decide si está en temperatura.' : null });
      if (r !== 'ok' || !this.act('checkFridge', { id, ok: verdict })) return;
      if (FRIDGES.every(x => typeof a.fridges[x.id] === 'boolean') && !a.fridgeAction) await this.#fridgeAction();
    });
  }

  async #fridgeAction() {
    const ui = this.api.ui; let chosen = null;
    const list = h('div', 'why');
    const paint = () => { list.replaceChildren(); FRIDGE_ACTIONS.forEach(x => { const b = h('button', 'why__item' + (chosen === x.id ? ' is-on' : ''), x.text); b.type = 'button'; b.addEventListener('click', () => { chosen = x.id; paint(); }); list.append(b); }); };
    paint();
    const r = await ui.modal({ eyebrow: 'Cadena fría', title: 'El refrigerador B marca 9 °C. ¿Qué haces con su contenido?', content: list, actions: [{ id: 'ok', label: 'Decidir', primary: true }], validate: x => x === 'ok' && !chosen ? 'Elige una opción.' : null });
    if (r === 'ok' && this.act('fridgeAction', { id: chosen })) ui.toast('Cadena fría revisada. A preparar en las tablas.');
  }

  openPrep() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (a.read.length < ORDERS.length || !FRIDGES.every(x => typeof a.fridges[x.id] === 'boolean') || !a.fridgeAction) { await ui.dialog({ speaker: 'Mesa de preparación', lines: ['Primero lee las comandas y revisa los refrigeradores: así sabes qué preparar y con qué.'] }); return; }
      const body = h('div');
      body.append(h('p', 'docs__note', 'Elige la tabla de cada ingrediente. El color evita la contaminación cruzada.'));
      INGREDIENTS.forEach(i => {
        const row = h('div', 'why'); row.append(h('strong', null, i.name));
        const paint = () => { row.querySelectorAll('button').forEach(b => b.remove()); BOARDS.forEach(bd => { const b = h('button', 'why__item' + (a.prep[i.id] === bd.id ? ' is-on' : ''), bd.name); b.type = 'button'; b.style.borderLeft = `8px solid #${bd.hex.toString(16).padStart(6, '0')}`; b.addEventListener('click', () => { if (this.act('prep', { id: i.id, board: bd.id })) paint(); }); row.append(b); }); };
        paint(); body.append(row);
      });
      if (!a.washed) body.prepend(h('p', 'docs__note', '⚠ No te has lavado las manos.'));
      await ui.modal({ eyebrow: 'Mesa de preparación', title: 'Tablas de colores', content: body, wide: true, actions: [{ id: 'ok', label: 'Listo', primary: true }],
        validate: () => INGREDIENTS.every(i => a.prep[i.id]) ? null : 'Falta preparar algún ingrediente.' });
      ui.toast('Ingredientes listos. Atiende la alergia de la mesa 7.');
    });
  }

  openAllergy() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt; let chosen = a.allergy;
      if (!INGREDIENTS.every(i => a.prep[i.id])) { await ui.dialog({ speaker: 'Estación fría', lines: ['Aquí se arma la comanda de la mesa 7. Primero prepara los ingredientes.'] }); return; }
      const list = h('div', 'why');
      const paint = () => { list.replaceChildren(); ALLERGY_OPTIONS.forEach(x => { const b = h('button', 'why__item' + (chosen === x.id ? ' is-on' : ''), x.text); b.type = 'button'; b.addEventListener('click', () => { chosen = x.id; paint(); }); list.append(b); }); };
      paint();
      const r = await ui.modal({ eyebrow: 'Mesa 7 · alergia al cacahuate', title: 'Protocolo de alérgenos', content: list, actions: [{ id: 'ok', label: 'Aplicar', primary: true }], validate: x => x === 'ok' && !chosen ? 'Elige cómo la preparas.' : null });
      if (r === 'ok' && this.act('allergy', { id: chosen })) ui.toast('Mesa 7 protegida. A cocinar con termómetro.');
    });
  }

  cook(id) {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt, i = ingredientById(id);
      if (!a.allergy) { await ui.dialog({ speaker: id === 'pollo' ? 'Parrilla' : 'Plancha', lines: ['Aún no es momento de cocinar: termina la preparación y la alergia.'] }); return; }
      let temp = a.cooked[id] || 60;
      const body = h('div', 'sim'), big = h('div', 'sim__big'), val = h('b', null, `${temp} °C`);
      big.append(h('span', null, 'Temperatura interna al retirar'), val);
      const range = document.createElement('input'); range.type = 'range'; range.min = '50'; range.max = '95'; range.step = '1'; range.value = String(temp); range.style.width = '100%';
      range.addEventListener('input', () => { temp = Number(range.value); val.textContent = `${temp} °C`; });
      body.append(big, range, h('p', 'compare__note', 'Mide en la parte más gruesa. Ni crudo por dentro ni seco de más.'));
      const r = await ui.modal({ eyebrow: id === 'pollo' ? 'Parrilla' : 'Plancha', title: i.name, content: body, actions: [{ id: 'ok', label: 'Retirar del fuego', primary: true }] });
      if (r === 'ok' && this.act('cook', { id, temp })) { this.api.player.emote('interact', 1.2); ui.toast(`${i.name}: ${temp} °C.`); }
    });
  }

  openPass() {
    return this.guard(async () => {
      const ui = this.api.ui, a = this.attempt;
      if (this.step === 'serve') {
        if (this.act('serve')) { ui.toast(`¡Servicio fuera en ${mmss(this.clock)}!`, 3200); this.api.player.emote('celebrate', 2); }
        return;
      }
      if (!INGREDIENTS.every(i => !i.cook || Number.isFinite(a.cooked[i.id]))) { await ui.dialog({ speaker: 'Pase', lines: ['Aquí salen los platos. Primero cocina lo que falta.'] }); return; }
      const body = h('div');
      ORDERS.forEach(o => {
        const row = h('div', 'why'); row.append(h('strong', null, `${o.table} · ${o.dish}`));
        const paint = () => { row.querySelectorAll('button').forEach(b => b.remove()); STATIONS.forEach(st => { const b = h('button', 'why__item' + (a.stations[o.id] === st.id ? ' is-on' : ''), st.name); b.type = 'button'; b.addEventListener('click', () => { if (this.act('assign', { id: o.id, station: st.id })) paint(); }); row.append(b); }); };
        paint(); body.append(row);
      });
      await ui.modal({ eyebrow: 'Pase', title: 'Coordina las estaciones', content: body, wide: true, actions: [{ id: 'ok', label: 'Listo', primary: true }],
        validate: () => ORDERS.every(o => a.stations[o.id]) ? null : 'Asigna las tres comandas.' });
      ui.toast('Estaciones listas. ¡Saca el servicio por el pase!');
    });
  }

  async debrief() {
    const ui = this.api.ui;
    await ui.dialog({ speaker: CHEF.name, lines: [`Servicio fuera en ${mmss(this.clock)}. Ahora dime: ¿qué fue lo más importante hoy?`] });
    const why = h('div', 'why'), picked = new Set();
    REASONS.forEach(r => { const b = h('button', 'why__item', r.text); b.type = 'button'; b.addEventListener('click', () => { if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < 2) picked.add(r.id); else { ui.toast('Elige máximo dos.'); return; } b.classList.toggle('is-on', picked.has(r.id)); }); why.append(b); });
    const r = await ui.modal({ eyebrow: 'Cierre del servicio', title: '¿Qué fue lo más importante?', content: why, hint: 'Elige una o dos ideas.', actions: [{ id: 'back', label: 'Todavía no' }, { id: 'ok', label: 'Cerrar servicio', primary: true }], validate: x => x === 'ok' && picked.size === 0 ? 'Elige al menos una idea.' : null });
    if (r !== 'ok' || !this.act('debrief', { reasons: [...picked] })) return;
    await this.close();
  }

  async close() {
    const ui = this.api.ui, time = mmss(this.clock);
    const out = await this.finish(result => {
      const b = result.breakdown;
      return {
        before: () => ui.dialog({ speaker: CHEF.name, lines: [result.passed ? (result.score === 100 ? `¡Cocina impecable y servicio en ${time}! Así se trabaja.` : 'Buen servicio. Hubo detalles, pero nadie se enfermó hoy.') : 'Así no sale nada de mi cocina. Repasemos: limpieza, frío, tablas y temperatura.'] }),
        rows: [['Higiene', b.higiene, 8], ['Cadena fría', b.cadena, 16], ['Tablas de colores', b.tablas, 20], ['Alérgenos', b.alergia, 14], ['Cocción', b.coccion, 12], ['Estaciones', b.estaciones, 10], ['Cierre', b.justificacion, 10], ['Comandas y revisión', b.research, 10]],
        heading: result.passed ? 'Lo que hizo segura tu cocina' : 'Lo que hay que corregir',
        paragraphs: [
          `El refrigerador B estaba a 9 °C: arriba de 4 °C los microorganismos se multiplican, así que lo seguro era retirar su contenido. Tablas correctas: ${b.boardHits} de ${INGREDIENTS.length}.`,
          `Pollo hasta 74 °C y pescado hasta 63 °C de temperatura interna. Para la mesa 7, un plato «sin cacahuate» no basta: se limpia todo y se prepara aparte. Tiempo del servicio: ${time} (marca el ritmo; no cuenta en la calificación).`
        ],
        lesson: 'Inocuidad: manos limpias, cadena fría, separar crudo de listo para comer, cocinar a temperatura segura y proteger a quien tiene alergias.'
      };
    });
    if (out && out.action === 'retry') ui.toast('Servicio reiniciado. Habla otra vez con la chef.');
  }
}
