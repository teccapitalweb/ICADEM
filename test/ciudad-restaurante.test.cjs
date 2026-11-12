'use strict';
// Ciudad ICADEM · Restaurante «Cocina contra reloj»: caso, motor, calificación y servidor.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openSession } = require('./helpers/ciudad-server.cjs');
const game = rel => import(pathToFileURL(path.join(__dirname, '..', 'ciudad/js', rel)).href);

function steps(c, plan = {}) {
  const fridge = plan.fridges || Object.fromEntries(c.FRIDGES.map(f => [f.id, f.ok]));
  const boards = plan.boards || Object.fromEntries(c.INGREDIENTS.map(i => [i.id, i.board]));
  const temps = plan.temps || { pollo: 76, pescado: 65 };
  const stations = plan.stations || Object.fromEntries(c.ORDERS.map(o => [o.id, o.station]));
  const wash = plan.washLate ? [] : [['wash']];
  return [['brief'], ...c.ORDERS.map(o => ['readOrder', { id: o.id }]), ...wash,
    ...c.FRIDGES.map(f => ['checkFridge', { id: f.id, ok: fridge[f.id] }]), ['fridgeAction', { id: plan.fridgeAction || 'retirar' }],
    ...c.INGREDIENTS.map(i => ['prep', { id: i.id, board: boards[i.id] }]), ...(plan.washLate ? [['wash']] : []),
    ['allergy', { id: plan.allergy || 'protocolo' }],
    ...Object.entries(temps).map(([id, temp]) => ['cook', { id, temp }]),
    ...c.ORDERS.map(o => ['assign', { id: o.id, station: stations[o.id] }]), ['serve'],
    ['debrief', { reasons: plan.reasons || ['cruzada', 'temperatura'] }]];
}
const play = (run, c, plan) => { for (const [type, p] of steps(c, plan)) assert.equal(run.act(type, p || {}), true, 'paso válido: ' + type); return run; };

test('restaurante: el caso es coherente', async () => {
  const c = await game('missions/kitchen-rush-logic.js');
  assert.equal(c.ORDERS.length, 3);
  assert.equal(c.ORDERS.filter(o => o.allergy).length, 1, 'una mesa con alergia');
  assert.deepEqual(c.FRIDGES.map(f => f.ok), [true, false], 'el refrigerador B falla');
  assert.ok(c.FRIDGES.every(f => f.ok === f.temp <= 4), 'la cadena fría pide 4 °C o menos');
  for (const i of c.INGREDIENTS) assert.ok(c.BOARDS.some(b => b.id === i.board), i.id);
  for (const list of [c.FRIDGE_ACTIONS, c.ALLERGY_OPTIONS]) assert.equal(list.filter(x => x.correct).length, 1);
  assert.equal(c.REASONS.filter(r => r.correct).length, 2);
  assert.ok(c.ingredientById('pollo').cook.min >= 74, 'el pollo pide 74 °C internos');
});

test('restaurante: sin atajos y el servicio perfecto da 100', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/kitchen-rush-logic.js');
  const def = defineMission(c.KITCHEN_RUSH_MISSION), run = new MissionRun(def);
  assert.equal(run.act('readOrder', { id: 'c1' }), false, 'primero se recibe el servicio');
  run.act('brief');
  assert.equal(run.act('prep', { id: 'pollo', board: 'amarilla' }), false, 'no se prepara sin leer comandas ni revisar refrigeradores');
  assert.equal(run.act('cook', { id: 'pollo', temp: 76 }), false, 'no se cocina antes de preparar y atender la alergia');
  assert.equal(run.act('serve'), false, 'no se sirve a medias');
  const perfect = play(new MissionRun(def), c);
  assert.deepEqual([perfect.evaluate().score, perfect.evaluate().passed], [100, true]);
  assert.equal(replay(def, perfect.log).result.score, 100);
  const forged = new MissionRun(def); forged.act('brief');
  assert.equal(forged.act('cook', { id: 'pollo', temp: 500 }), false, 'temperaturas fuera de rango no se aceptan');
});

test('restaurante: cada error pesa lo suyo', async () => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/kitchen-rush-logic.js');
  const def = defineMission(c.KITCHEN_RUSH_MISSION);
  const ev = plan => play(new MissionRun(def), c, plan).evaluate();
  assert.equal(ev({ washLate: true }).breakdown.higiene, 0, 'preparar sin lavarse las manos');
  assert.equal(ev({ fridges: { A: true, B: true }, fridgeAction: 'rapido' }).breakdown.cadena, 5);
  const crossed = ev({ boards: { pollo: 'verde', pescado: 'azul', lechuga: 'verde', col: 'verde', verduras: 'verde' } });
  assert.equal(crossed.breakdown.tablas, 16, 'pollo crudo en la tabla de verduras');
  assert.equal(ev({ allergy: 'quitar' }).breakdown.alergia, 0);
  assert.equal(ev({ temps: { pollo: 65, pescado: 65 } }).breakdown.coccion, 6, 'pollo poco cocido');
  assert.equal(ev({ stations: { c1: 'parrilla', c2: 'plancha', c3: 'parrilla' } }).breakdown.estaciones, 6, 'el bowl sin alérgenos en la parrilla');
  assert.equal(ev({ reasons: ['vista'] }).breakdown.justificacion, 0);
  const bad = ev({ washLate: true, fridges: { A: true, B: true }, fridgeAction: 'rapido', allergy: 'quitar', temps: { pollo: 60, pescado: 50 } });
  assert.equal(bad.passed, false);
});

test('restaurante: recompensa una sola vez y el servidor valida por socket', async t => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/kitchen-rush-logic.js');
  const { REWARDS } = await game('economy/economy.js');
  assert.deepEqual(REWARDS[c.MISSION_ID], { amount: 20, xp: 160, repeatXp: 40 });
  const s = await openSession(t, 'restaurante'); if (!s) return t.skip('npm install en _ciudad-server');
  const run = play(new MissionRun(defineMission(c.KITCHEN_RUSH_MISSION)), c);
  assert.equal((await s.mission(c.MISSION_ID, run.log.filter(e => e.type !== 'allergy'))).ok, false, 'sin atender la alergia no hay recompensa');
  const a = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([a.ok, a.score, a.credits], [true, 100, 20]);
  const b = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([b.ok, b.credits], [true, 0]);
});
