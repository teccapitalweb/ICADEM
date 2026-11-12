'use strict';
// Ciudad ICADEM · Torre «Desafío de equipos» (modo individual): caso, motor, calificación y servidor.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openSession } = require('./helpers/ciudad-server.cjs');
const game = rel => import(pathToFileURL(path.join(__dirname, '..', 'ciudad/js', rel)).href);

function steps(plan = {}) {
  return [['brief'], ['budget', plan.budget || { computers: 'nuevo', contingency: 5 }], ['permits', { ids: plan.permits || ['uso-suelo', 'construccion', 'proteccion-civil'] }],
    ['schedule', { ids: plan.schedule || ['tramites', 'cimentacion', 'estructura', 'instalaciones', 'mobiliario'] }], ['message', plan.message || { text: 'claro', channels: ['asamblea', 'carteles'] }],
    ['approve', { role: 'individual' }], ['present', { reasons: plan.reasons || ['especialidad', 'dependencias'] }]];
}
const play = (run, plan) => { for (const [type, p] of steps(plan)) assert.equal(run.act(type, p || {}), true, 'paso válido: ' + type); return run; };

test('torre: el caso es coherente', async () => {
  const c = await game('missions/tower-challenge-logic.js');
  assert.ok(c.budgetTotal('nuevo', 5) <= c.BUDGET.limit && c.budgetTotal('nuevo', 6) > c.BUDGET.limit, 'con equipo nuevo, 5% es el máximo que cabe');
  assert.ok(c.budgetTotal('reacondicionado', 15) <= c.BUDGET.limit, 'el equipo reacondicionado deja más margen');
  assert.ok(c.budgetTotal('nuevo', 10) > c.BUDGET.limit);
  assert.equal(c.PERMITS.filter(p => p.needed).length, 3); assert.equal(c.MESSAGES.filter(m => m.correct).length, 1);
  assert.deepEqual(c.STATIONS.map(s => s.role), ['finanzas', 'legal', 'operaciones', 'comunicacion']);
  const { COOP_MISSIONS } = await game('net/scenes.js');
  const spec = COOP_MISSIONS[c.MISSION_ID];
  for (const s of c.STATIONS) assert.deepEqual(spec.permissions[s.id], [s.role], s.id + ' le toca a su rol');
  assert.ok(spec.roles.every(r => c.STATIONS.some(s => s.role === r.id)));
});

test('torre: sin atajos y el plan perfecto da 100', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/tower-challenge-logic.js');
  const def = defineMission(c.TOWER_CHALLENGE_MISSION), run = new MissionRun(def);
  assert.equal(run.act('budget', { computers: 'nuevo', contingency: 5 }), false, 'primero el reto');
  run.act('brief');
  assert.equal(run.act('approve', { role: 'individual' }), false, 'no se aprueba un plan incompleto');
  assert.equal(run.act('budget', { computers: 'nuevo', contingency: 50 }), false);
  run.act('budget', { computers: 'nuevo', contingency: 5 });
  assert.equal(run.act('budget', { computers: 'nuevo', contingency: 4 }), false, 'una estación enviada solo se cambia pidiendo rehacerla');
  assert.equal(run.act('approve', { role: 'ROL INVENTADO' }), false);
  const perfect = play(new MissionRun(def));
  assert.deepEqual([perfect.evaluate().score, perfect.evaluate().passed], [100, true]);
  assert.equal(replay(def, perfect.log).result.score, 100);
  const p2 = new MissionRun(def); for (const [t, p] of steps().slice(0, 6)) p2.act(t, p || {});
  assert.equal(p2.act('reopen', { id: 'budget' }), true); assert.deepEqual(p2.state.approvals, []);
  assert.equal(p2.act('budget', { computers: 'reacondicionado', contingency: 10 }), true); p2.act('approve', { role: 'individual' }); p2.act('present', { reasons: ['especialidad'] });
  assert.equal(p2.evaluate().breakdown.presupuesto, 20);
});

test('torre: cada error pesa lo suyo', async () => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/tower-challenge-logic.js');
  const def = defineMission(c.TOWER_CHALLENGE_MISSION);
  const ev = plan => play(new MissionRun(def), plan).evaluate();
  assert.equal(ev({ budget: { computers: 'nuevo', contingency: 10 } }).breakdown.presupuesto, 0, 'se excede el presupuesto');
  assert.equal(ev({ budget: { computers: 'nuevo', contingency: 0 } }).breakdown.presupuesto, 8, 'cabe, pero sin contingencia');
  assert.equal(ev({ permits: ['uso-suelo', 'construccion', 'alcohol'] }).breakdown.permisos, 7);
  assert.equal(ev({ schedule: ['cimentacion', 'tramites', 'estructura', 'instalaciones', 'mobiliario'] }).breakdown.calendario, 10, 'sin permisos no se empieza la obra');
  assert.equal(ev({ message: { text: 'vago', channels: ['ninguno'] } }).breakdown.comunicacion, 0);
  assert.equal(ev({ message: { text: 'claro', channels: ['asamblea', 'rumor'] } }).breakdown.comunicacion, 10);
  assert.equal(ev({ reasons: ['jefe'] }).breakdown.justificacion, 0);
  assert.equal(ev({ budget: { computers: 'nuevo', contingency: 10 }, permits: ['alcohol', 'marca'], message: { text: 'vago', channels: ['ninguno'] } }).passed, false);
});

test('torre: recompensa una sola vez y el servidor valida por socket', async t => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/tower-challenge-logic.js');
  const { REWARDS } = await game('economy/economy.js');
  assert.deepEqual(REWARDS[c.MISSION_ID], { amount: 20, xp: 160, repeatXp: 40 });
  const s = await openSession(t, 'torre'); if (!s) return t.skip('npm install en _ciudad-server');
  const run = play(new MissionRun(defineMission(c.TOWER_CHALLENGE_MISSION)));
  assert.equal((await s.mission(c.MISSION_ID, run.log.filter(e => e.type !== 'approve'))).ok, false, 'sin aprobar no se presenta');
  const a = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([a.ok, a.score, a.credits], [true, 100, 20]);
  const b = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([b.ok, b.credits], [true, 0]);
});
