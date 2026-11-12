// Controlador base de una misión dentro de su escenario 3D.
// Une el motor (engine.js) con el juego: rastreador en pantalla, resaltado de objetos, cierre,
// retroalimentación, recompensa y reintento. Cada juego hereda de aquí y solo aporta lo propio:
// sus diálogos, sus interacciones con el escenario y la explicación del resultado.

import { replay } from './engine.js';
import { COOP_MISSIONS, coopCan, allowedRoles, pendingApprovals, roleName } from '../net/coop.js';

const sameEntry = (x, y) => x.type === y.type && JSON.stringify(x.payload || {}) === JSON.stringify(y.payload || {});
const isPrefix = (a, b) => a.length <= b.length && a.every((e, i) => sameEntry(e, b[i]));

export const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export class MissionController {
  constructor(api, def) {
    this.api = api;
    this.def = def;
    this.id = def.id;
    this.run = api.missionService.start(def.id);
    this.active = false;
    this.busy = false;
    this.coop = null;   // modalidad en equipo: { session, role, online, finishing, result }
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
      badge: this.coop ? `En equipo · ${this.coopRoleName}` : this.record.completed ? 'Repetición · solo XP' : `+${reward.amount} créditos de prueba`,
      steps: this.run.objectives.map(o => ({ text: o.text, done: o.done, active: o.active, detail: o.detail }))
    });
  }

  /** Evita que dos interacciones se encimen y refresca el rastreador al terminar. */
  async guard(fn) {
    if (this.busy) return;
    this.busy = true;
    try { await fn(); } finally { this.busy = false; this.refreshTracker(); }
  }

  /**
   * Acción del jugador sobre la misión. Devuelve false si no procede en este momento.
   * En equipo: se avisa si el paso le toca a otro rol, se aplica en el espejo local para que la
   * pantalla responda al instante y se envía al servidor, que es quien la valida y la reparte.
   */
  act(type, payload = {}) {
    if (this.coop) {
      const spec = COOP_MISSIONS[this.id];
      if (!coopCan(spec, type, payload, this.coop.role, this.coop.online)) { this.api.ui.toast(`Este paso le toca a ${this.coopWho(type, payload)}.`, 2800); return false; }
      if (spec.consensus && type === spec.consensus.approve) payload = { role: this.coop.role };
      if (spec.consensus && type === spec.consensus.final && this.coopPending().length) return false;
      if (!this.run.act(type, payload)) return false;
      this.api.net.coop('act', { type, payload });
      clearTimeout(this.coop.check); this.coop.check = setTimeout(() => this.coop && this.api.net.coop('sync'), 3000);
      this.refreshTracker();
      return true;
    }
    const ok = this.run.act(type, payload); if (ok) this.refreshTracker(); return ok;
  }

  /* ---------- modalidad en equipo ---------- */

  get coopRoleName() { return this.coop ? roleName(this.id, this.coop.role) : ''; }
  coopRoleNameOf(role) { return roleName(this.id, role); }
  /** ¿Puede este jugador hacer la acción en equipo? (sin equipo: siempre) */
  coopMay(type, payload = {}) { return !this.coop || coopCan(COOP_MISSIONS[this.id], type, payload, this.coop.role, this.coop.online); }
  /** Nombre de quién debe hacer la acción. */
  coopWho(type, payload = {}) { const roles = allowedRoles(COOP_MISSIONS[this.id], type, payload); return Array.isArray(roles) ? roles.map(r => roleName(this.id, r)).join(' o ') : 'otro integrante'; }
  /** Roles conectados que aún no aprueban (consenso antes del paso final). */
  coopPending() { return this.coop ? pendingApprovals(COOP_MISSIONS[this.id], this.state, this.coop.online) : []; }

  /** El servidor inició (o reanudó) el intento del equipo: el espejo local se reconstruye de su bitácora. */
  joinCoop(view, role) {
    const fresh = !this.coop || this.coop.session !== view.session;
    if (fresh) { this.run = this.service.start(this.id); this.coop = { session: view.session, role, online: view.online || [], finishing: false, result: null, waiters: [] }; }
    this.syncCoop(view);
    return fresh;
  }

  /** Aplica la bitácora que manda el servidor sin perder las referencias al estado en pantalla. */
  syncCoop(view) {
    if (!this.coop || view.session !== this.coop.session) return;
    clearTimeout(this.coop.check);
    this.coop.online = view.online || this.coop.online;
    const log = Array.isArray(view.log) ? view.log : [], local = this.run.log;
    let rebuild = false;
    if (isPrefix(local, log)) { for (const e of log.slice(local.length)) if (!this.run.act(e.type, e.payload || {})) { rebuild = true; break; } }
    else if (!(isPrefix(log, local) && view.op !== 'rejected')) rebuild = true;
    if (rebuild) {
      const r = replay(this.def, log), st = this.run.state;
      for (const k of Object.keys(st)) delete st[k];
      Object.assign(st, r.run.state); this.run.log = r.run.log.slice(); this.run.status = 'active';
    }
    this.refreshTracker();
  }

  /** Resultado que el servidor guardó para este jugador al cerrar el intento del equipo. */
  coopDone(msg) {
    if (!this.coop || msg.session !== this.coop.session) return;
    this.coop.result = msg; this.coop.waiters.splice(0).forEach(fn => fn(msg));
  }
  #coopResult(ms = 6000) {
    const c = this.coop; if (!c) return Promise.resolve(null); if (c.result) return Promise.resolve(c.result);
    return new Promise(resolve => { const t = setTimeout(() => resolve(null), ms); c.waiters.push(m => { clearTimeout(t); resolve(m); }); });
  }

  /** Terminó la sesión de equipo (salió de la sala o se cerró): se vuelve al modo individual. */
  leaveCoop() { if (!this.coop) return; clearTimeout(this.coop.check); this.coop = null; this.restart(); }

  /** Otro integrante cerró el intento: se muestra el resultado en cuanto la pantalla esté libre. */
  closeFromTeam() {
    if (!this.coop || this.coop.finishing) return;
    const tryClose = () => { if (!this.coop || this.coop.finishing) return; if (this.busy || this.api.ui.isBlocking) return void setTimeout(tryClose, 400); this.guard(() => this.close()); };
    tryClose();
  }

  /**
   * Cierra el intento: valida, registra, entrega recompensa y muestra la retroalimentación.
   * `describe(result)` devuelve { before?, rows, heading, paragraphs, lesson } para la pantalla final.
   */
  async finish(describe) {
    const { ui, store } = this.api;
    const log = this.run.log;
    let out;
    if (this.coop) {
      // En equipo el servidor ya validó y guardó el resultado de cada integrante: aquí solo se muestra.
      this.coop.finishing = true;
      const check = replay(this.def, log);
      if (!check.ok || !check.result.valid) { this.coop.finishing = false; ui.toast('Faltan pasos de la misión.'); return null; }
      this.run.status = 'finished';
      const server = await this.#coopResult();
      out = { ok: true, result: check.result, credits: server && server.ok ? server.credits || 0 : 0, xp: server && server.ok ? server.xp || 0 : 0, team: true, confirmed: Boolean(server && server.ok) };
    } else {
      out = await this.service.complete(this.run);
      if (!out.ok) { ui.toast('Faltan pasos de la misión.'); return null; }
      // Con conexión, el servidor vuelve a validar la bitácora y es él quien guarda el progreso.
      if (this.api.net.isOnline) this.api.net.profile('mission', { mission: this.id, log });
    }
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
    if (out.team && !out.confirmed) rewards.append(h('span', 'pill pill--soon', 'El servidor está registrando el resultado del equipo'));
    else if (result.passed) rewards.append(h('span', 'pill pill--gold', credits ? `+${credits} créditos de prueba` : 'Créditos ya entregados antes'), h('span', 'pill pill--blue', `+${xp} XP`));
    else rewards.append(h('span', 'pill pill--bad', `Necesitas ${this.def.passScore} puntos para completar la misión`));
    body.append(score, list, why, rewards);

    const action = await ui.modal({
      eyebrow: result.passed ? 'Misión completada' : 'Misión no superada',
      title: result.passed ? this.def.title : 'Vuelve a intentarlo', content: body, wide: true,
      actions: [{ id: 'retry', label: 'Repetir misión' }, { id: 'ok', label: 'Continuar', primary: true }]
    });
    if (this.coop) this.leaveCoop(); else this.restart();
    ui.refreshHud();
    return { ...out, action };
  }
}
