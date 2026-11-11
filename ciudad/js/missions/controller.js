// Controlador base de una misión dentro de su escenario 3D.
// Une el motor (engine.js) con el juego: rastreador en pantalla, resaltado de objetos, cierre,
// retroalimentación, recompensa y reintento. Cada juego hereda de aquí y solo aporta lo propio:
// sus diálogos, sus interacciones con el escenario y la explicación del resultado.

export const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export class MissionController {
  constructor(api, def) {
    this.api = api;
    this.def = def;
    this.id = def.id;
    this.run = api.missionService.start(def.id);
    this.active = false;
    this.busy = false;
  }

  get service() { return this.api.missionService; }
  get record() { return this.service.record(this.id); }
  get state() { return this.run.state; }
  get step() { return this.run.current; }

  /** Se llaman al entrar y al salir del edificio. El intento en curso se conserva. */
  enter() { this.active = true; this.refreshTracker(); }
  leave() { this.active = false; this.api.ui.setTracker(null); }

  restart() { this.run = this.service.start(this.id); this.refreshTracker(); }

  refreshTracker() {
    if (!this.active) return;
    const reward = this.service.rewardFor(this.id);
    this.api.ui.setTracker({
      title: this.def.title,
      badge: this.record.completed ? 'Repetición · solo XP' : `+${reward.amount} créditos de prueba`,
      steps: this.run.objectives.map(o => ({ text: o.text, done: o.done, active: o.active, detail: o.detail }))
    });
  }

  /** Evita que dos interacciones se encimen y refresca el rastreador al terminar. */
  async guard(fn) {
    if (this.busy) return;
    this.busy = true;
    try { await fn(); } finally { this.busy = false; this.refreshTracker(); }
  }

  /** Acción del jugador sobre la misión. Devuelve false si no procede en este momento. */
  act(type, payload) { const ok = this.run.act(type, payload); if (ok) this.refreshTracker(); return ok; }

  /**
   * Cierra el intento: valida, registra, entrega recompensa y muestra la retroalimentación.
   * `describe(result)` devuelve { before?, rows, heading, paragraphs, lesson } para la pantalla final.
   */
  async finish(describe) {
    const { ui, store } = this.api;
    const log = this.run.log;
    const out = await this.service.complete(this.run);
    if (!out.ok) { ui.toast('Faltan pasos de la misión.'); return null; }
    // Con conexión, el servidor vuelve a validar la bitácora y es él quien guarda el progreso.
    if (this.api.net.isOnline) this.api.net.profile('mission', { mission: this.id, log });
    const { result, credits, xp } = out;
    if (result.passed) {
      if (store.unlock('primera-mision')) ui.toast('Logro desbloqueado: Primera misión');
      if (result.score === 100 && store.unlock('decision-impecable')) ui.toast('Logro desbloqueado: Decisión impecable');
      this.api.player.emote('celebrate', 2.4);
    }
    const view = describe(result);
    if (view.before) await view.before();

    const body = h('div', 'result');
    const score = h('div', 'result__score'); score.append(h('b', null, String(result.score)), h('span', null, 'de 100'));
    const list = h('ul', 'result__list');
    view.rows.forEach(([text, value, max]) => { const li = h('li'); li.append(h('span', null, text), h('b', null, `${value}/${max}`)); list.append(li); });
    const why = h('div', 'result__why');
    why.append(h('h4', null, view.heading));
    view.paragraphs.forEach(text => why.append(h('p', null, text)));
    if (view.lesson) why.append(h('p', 'result__lesson', view.lesson));
    const rewards = h('div', 'result__rewards');
    if (result.passed) rewards.append(h('span', 'pill pill--gold', credits ? `+${credits} créditos de prueba` : 'Créditos ya entregados antes'), h('span', 'pill pill--blue', `+${xp} XP`));
    else rewards.append(h('span', 'pill pill--bad', `Necesitas ${this.def.passScore} puntos para completar la misión`));
    body.append(score, list, why, rewards);

    const action = await ui.modal({
      eyebrow: result.passed ? 'Misión completada' : 'Misión no superada',
      title: result.passed ? this.def.title : 'Vuelve a intentarlo', content: body, wide: true,
      actions: [{ id: 'retry', label: 'Repetir misión' }, { id: 'ok', label: 'Continuar', primary: true }]
    });
    this.restart();
    ui.refreshHud();
    return { ...out, action };
  }
}
