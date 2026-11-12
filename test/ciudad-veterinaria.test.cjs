'use strict';
// Ciudad ICADEM · Clínica Veterinaria «Guardianes del bienestar»: caso, motor, calificación y servidor.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openSession } = require('./helpers/ciudad-server.cjs');
const game = rel => import(pathToFileURL(path.join(__dirname, '..', 'ciudad/js', rel)).href);

function steps(c, plan = {}) {
  const prio = plan.priority || Object.fromEntries(c.ANIMALS.map(x => [x.id, x.priority]));
  const dom = plan.domain || Object.fromEntries(c.ANIMALS.map(x => [x.id, x.domain]));
  const flags = plan.flags || Object.fromEntries(c.ANIMALS.map(x => [x.id, x.findings.filter(f => f.alert).map(f => f.id)]));
  const act = plan.action || Object.fromEntries(c.ANIMALS.map(x => [x.id, x.actions.find(y => y.correct).id]));
  const enr = plan.enrichment || ['arenero', 'repisa', 'escondite', 'rascador'];
  return [['brief'], ...c.ANIMALS.flatMap(x => c.REVIEWS.map(what => ['review', { id: x.id, what }])),
    ...c.ANIMALS.map(x => ['assess', { id: x.id, flags: flags[x.id], priority: prio[x.id], domain: dom[x.id] }]),
    ...c.ANIMALS.map(x => ['decide', { id: x.id, action: act[x.id] }]),
    ...enr.map(id => ['place', { id }]), ['counsel', { reasons: plan.reasons || ['dominios', 'senales'] }]];
}
const play = (run, c, plan) => { for (const [type, p] of steps(c, plan)) assert.equal(run.act(type, p || {}), true, 'paso válido: ' + type); return run; };

test('veterinaria: el caso es coherente y no da indicaciones médicas', async () => {
  const c = await game('missions/vet-welfare-logic.js');
  assert.equal(c.ANIMALS.length, 4);
  assert.deepEqual(c.ANIMALS.map(x => x.priority).sort(), ['hoy', 'hoy', 'rutina', 'urgente']);
  for (const x of c.ANIMALS) {
    assert.equal(x.actions.filter(y => y.correct).length, 1, x.id);
    assert.equal(x.findings.some(f => f.alert), x.priority !== 'rutina', x.id + ': solo el de rutina no tiene alertas');
    assert.equal(x.domain === null, x.priority === 'rutina', x.id + ': el de rutina tiene su bienestar cubierto');
  }
  assert.ok(c.animalById('canela').weightNow < c.animalById('canela').weightBefore, 'la báscula revela la pérdida de peso de Canela');
  assert.ok(c.animalById('toby').weightNow > c.animalById('toby').weightBefore, 'el cachorro sube de peso, como se espera');
  assert.doesNotMatch(JSON.stringify(c.ANIMALS), /\bmg\b|dosis|tableta|antibi[oó]tico|analg[eé]sico|meloxicam|insulina/i);
  assert.equal(c.ENRICHMENT.filter(e => e.good).length, 4);
});

test('veterinaria: sin atajos y la partida perfecta da 100', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/vet-welfare-logic.js');
  const def = defineMission(c.VET_WELFARE_MISSION), run = new MissionRun(def);
  assert.equal(run.act('review', { id: 'rocky', what: 'observe' }), false, 'primero se habla con la veterinaria');
  run.act('brief'); run.act('review', { id: 'rocky', what: 'observe' });
  assert.equal(run.act('assess', { id: 'rocky', flags: [], priority: 'urgente', domain: 'salud' }), false, 'no se valora sin pesar ni leer el expediente');
  assert.equal(run.act('place', { id: 'arenero' }), false, 'el enriquecimiento va después de los planes');
  const perfect = play(new MissionRun(def), c);
  assert.deepEqual([perfect.evaluate().score, perfect.evaluate().passed], [100, true]);
  assert.equal(replay(def, perfect.log).result.score, 100);
});

test('veterinaria: cada error pesa lo suyo', async () => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/vet-welfare-logic.js');
  const def = defineMission(c.VET_WELFARE_MISSION);
  const r1 = play(new MissionRun(def), c, { priority: { rocky: 'hoy', canela: 'hoy', luna: 'hoy', toby: 'rutina' } }).evaluate();
  assert.equal(r1.breakdown.prioridad, 15, 'Rocky esperando es un error');
  const r2 = play(new MissionRun(def), c, { domain: { rocky: 'salud', canela: 'salud', luna: 'comportamiento', toby: null } }).evaluate();
  assert.equal(r2.breakdown.dominios, 9, 'lo de Luna es de ambiente, no de «mala conducta»');
  const r3 = play(new MissionRun(def), c, { enrichment: ['arenero', 'repisa', 'jaula'] }).evaluate();
  assert.equal(r3.breakdown.enriquecimiento, 0, 'una jaula más pequeña la estresa más');
  const r4 = play(new MissionRun(def), c, { action: { rocky: 'rocky-esperar', canela: 'canela-hoy', luna: 'luna-castigo', toby: 'toby-rutina' } }).evaluate();
  assert.equal(r4.breakdown.acciones, 10);
  assert.equal(play(new MissionRun(def), c, { reasons: ['castigo'] }).evaluate().breakdown.justificacion, 0);
});

test('veterinaria: recompensa una sola vez y el servidor valida por socket', async t => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/vet-welfare-logic.js');
  const { REWARDS } = await game('economy/economy.js');
  assert.deepEqual(REWARDS[c.MISSION_ID], { amount: 20, xp: 160, repeatXp: 40 });
  const s = await openSession(t, 'vet'); if (!s) return t.skip('npm install en _ciudad-server');
  const run = play(new MissionRun(defineMission(c.VET_WELFARE_MISSION)), c);
  assert.equal((await s.mission(c.MISSION_ID, run.log.filter(e => e.payload.what !== 'weigh'))).ok, false, 'sin pesar a los pacientes no hay recompensa');
  const a = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([a.ok, a.score, a.credits], [true, 100, 20]);
  const b = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([b.ok, b.credits], [true, 0]);
});
