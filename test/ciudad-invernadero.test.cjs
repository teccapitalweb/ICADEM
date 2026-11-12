'use strict';
// Ciudad ICADEM · Invernadero «Cultivo inteligente»: caso, modelos, calificación y servidor.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openSession } = require('./helpers/ciudad-server.cjs');
const game = rel => import(pathToFileURL(path.join(__dirname, '..', 'ciudad/js', rel)).href);

function steps(c, plan = {}) {
  const diag = plan.diagnosis || Object.fromEntries(c.SENSORS.map(s => [s.id, s.level]));
  const irr = plan.irrigation || Object.fromEntries(c.BEDS.map(b => [b.id, b.correct]));
  return [['brief'], ['readChart'], ...c.SENSORS.flatMap(s => [['readSensor', { id: s.id }], ['diagnose', { id: s.id, level: diag[s.id] }]]),
    ['climate', plan.climate || { vent: 60, shade: 40 }], ['solution', plan.solution || { nutrient: 12, acid: 0 }],
    ...c.BEDS.map(b => ['irrigate', { id: b.id, action: irr[b.id] }]), ...c.TRAPS.map(t => ['inspectTrap', { id: t.id }]),
    ['pest', plan.pest || { zone: 'B', action: 'biologico' }], ['debrief', { reasons: plan.reasons || ['medir', 'umbral'] }]];
}
const play = (run, c, plan) => { for (const [type, p] of steps(c, plan)) assert.equal(run.act(type, p || {}), true, 'paso válido: ' + type); return run; };
const inR = (v, r) => v >= r.min && v <= r.max;

test('invernadero: el caso es coherente con la ficha del cultivo', async () => {
  const c = await game('missions/greenhouse-logic.js');
  for (const s of c.SENSORS) { const r = c.CHART[s.id]; assert.equal(s.level, s.value < r.min ? 'bajo' : s.value > r.max ? 'alto' : 'ok', s.id); }
  for (const b of c.BEDS) assert.equal(b.correct, b.soil < c.CHART.soil.min ? 'regar' : b.soil > c.CHART.soil.max ? 'suspender' : 'mantener', b.id);
  const over = c.TRAPS.filter(t => t.moscaBlanca > c.THRESHOLDS.moscaBlanca || t.trips > c.THRESHOLDS.trips);
  assert.deepEqual(over.map(t => t.bed), [c.PEST_ZONE], 'solo una trampa pasa el umbral');
  assert.equal(c.PEST_ACTIONS.filter(x => x.correct).length, 1);
  // el estado inicial está fuera de rango y sí hay una combinación que lo corrige
  const now = c.projectClimate(0, 0); assert.ok(!inR(now.temp, c.CHART.temp));
  const fix = c.projectClimate(60, 40); assert.ok(inR(fix.temp, c.CHART.temp) && inR(fix.hr, c.CHART.hr) && inR(fix.light, c.CHART.light));
  assert.ok(!inR(c.projectClimate(100, 0).hr, c.CHART.hr), 'ventilar al máximo reseca el aire');
  assert.ok(!inR(c.projectClimate(60, 80).light, c.CHART.light), 'demasiada malla deja sin luz');
  const sol = c.projectSolution(12, 0); assert.ok(inR(sol.ce, c.CHART.ce) && inR(sol.ph, c.CHART.ph));
  assert.ok(!inR(c.projectSolution(20, 0).ce, c.CHART.ce), 'más fertilizante no es mejor');
});

test('invernadero: sin atajos y el turno perfecto da 100', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/greenhouse-logic.js');
  const def = defineMission(c.GREENHOUSE_MISSION), run = new MissionRun(def);
  assert.equal(run.act('readChart'), false, 'primero se habla con el agrónomo');
  run.act('brief');
  assert.equal(run.act('readSensor', { id: 'temp' }), false, 'primero la ficha del cultivo');
  run.act('readChart');
  assert.equal(run.act('diagnose', { id: 'temp', level: 'alto' }), false, 'no se diagnostica sin leer el sensor');
  assert.equal(run.act('climate', { vent: 60, shade: 40 }), false, 'no se ajusta sin diagnosticar');
  const perfect = play(new MissionRun(def), c);
  assert.deepEqual([perfect.evaluate().score, perfect.evaluate().passed], [100, true]);
  assert.equal(replay(def, perfect.log).result.score, 100);
  const r = new MissionRun(def); for (const [t, p] of steps(c).slice(0, 10)) r.act(t, p || {});
  assert.equal(r.act('climate', { vent: 500, shade: 40 }), false, 'valores fuera del tablero no se aceptan');
});

test('invernadero: cada error pesa lo suyo', async () => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/greenhouse-logic.js');
  const def = defineMission(c.GREENHOUSE_MISSION);
  const ev = plan => play(new MissionRun(def), c, plan).evaluate();
  assert.equal(ev({ diagnosis: { temp: 'alto', hr: 'ok', ce: 'bajo', ph: 'ok' } }).breakdown.diagnostico, 15);
  assert.equal(ev({ climate: { vent: 100, shade: 0 } }).breakdown.clima, 12, 'temperatura bien, pero aire reseco');
  assert.equal(ev({ climate: { vent: 0, shade: 0 } }).breakdown.clima, 4, 'sin ventilar sigue caliente y húmedo');
  assert.equal(ev({ solution: { nutrient: 20, acid: 0 } }).breakdown.nutricion, 0, 'exceso de fertilizante');
  assert.equal(ev({ irrigation: { A: 'regar', B: 'regar', C: 'regar' } }).breakdown.riego, 6, 'regar todo encharca');
  assert.equal(ev({ pest: { zone: 'B', action: 'fumigar-todo' } }).breakdown.mip, 8);
  assert.equal(ev({ pest: { zone: 'A', action: 'biologico' } }).breakdown.mip, 12);
  assert.equal(ev({ reasons: ['mas-agua'] }).breakdown.justificacion, 0);
  assert.equal(ev({ climate: { vent: 0, shade: 0 }, solution: { nutrient: 20, acid: 0 }, irrigation: { A: 'regar', B: 'regar', C: 'regar' }, pest: { zone: 'C', action: 'fumigar-todo' } }).passed, false);
});

test('invernadero: recompensa una sola vez y el servidor recalcula los ajustes', async t => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/greenhouse-logic.js');
  const { REWARDS } = await game('economy/economy.js');
  assert.deepEqual(REWARDS[c.MISSION_ID], { amount: 20, xp: 160, repeatXp: 40 });
  const s = await openSession(t, 'invernadero'); if (!s) return t.skip('npm install en _ciudad-server');
  const def = defineMission(c.GREENHOUSE_MISSION);
  const bad = play(new MissionRun(def), c, { climate: { vent: 0, shade: 0 }, solution: { nutrient: 20, acid: 0 }, irrigation: { A: 'regar', B: 'regar', C: 'regar' }, pest: { zone: 'C', action: 'fumigar-todo' } });
  const r0 = await s.mission(c.MISSION_ID, bad.log); assert.equal(r0.credits || 0, 0, 'reprobado no da créditos');
  const run = play(new MissionRun(def), c);
  const a = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([a.ok, a.score, a.credits], [true, 100, 20]);
  const b = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([b.ok, b.credits], [true, 0]);
});
