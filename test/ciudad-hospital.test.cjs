'use strict';
// Ciudad ICADEM · Hospital «Turno de decisiones»: reglas del caso, motor compartido y servidor.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const game = relative => import(pathToFileURL(path.join(root, 'ciudad/js', relative)).href);

/** Turno perfecto (con variantes para medir cada decisión). */
function steps(c, plan = {}) {
  const triage = plan.triage || Object.fromEntries(c.PATIENTS.map(p => [p.id, p.triage]));
  const flags = plan.flags || Object.fromEntries(c.PATIENTS.map(p => [p.id, p.findings.filter(f => f.alarm).map(f => f.id)]));
  const order = plan.order || ['aurelio', 'celia', 'joaquin', 'mariana'];
  const action = plan.action || Object.fromEntries(c.PATIENTS.map(p => [p.id, p.actions.find(a => a.correct).id]));
  const support = plan.support || Object.fromEntries(c.PATIENTS.map(p => [p.id, p.support]));
  return [['shift'], ['readBoard'],
    ...c.PATIENTS.flatMap(p => c.REVIEWS.map(what => ['review', { id: p.id, what }])),
    ...c.PATIENTS.map(p => ['assess', { id: p.id, flags: flags[p.id], triage: triage[p.id] }]),
    ['prioritize', { order }],
    ...c.PATIENTS.map(p => ['decide', { id: p.id, action: action[p.id], support: support[p.id] }]),
    ['record'], ['handover', { reasons: plan.reasons || ['gravedad', 'apoyo'] }]];
}
function play(run, c, plan) { for (const [type, payload] of steps(c, plan)) assert.equal(run.act(type, payload || {}), true, 'paso válido: ' + type); return run; }

test('hospital: el caso es coherente y no da indicaciones clínicas', async () => {
  const c = await game('missions/hospital-shift-logic.js');
  assert.equal(c.PATIENTS.length, 4);
  assert.deepEqual(c.PATIENTS.map(p => p.triage).sort(), ['amarillo', 'rojo', 'rojo', 'verde']);
  for (const p of c.PATIENTS) {
    assert.equal(p.actions.filter(a => a.correct).length, 1, p.id + ': una sola acción correcta');
    assert.equal(p.support, p.triage === 'rojo', p.id + ': se pide apoyo inmediato justo en los casos rojos');
    assert.equal(p.findings.some(f => f.alarm), p.triage !== 'verde', p.id + ': solo el caso verde no tiene signos de alarma');
  }
  const text = JSON.stringify(c.PATIENTS);
  assert.doesNotMatch(text, /\bmg\b|miligramo|dosis|tableta|aspirina|paracetamol|ibuprofeno|insulina/i, 'sin fármacos ni dosis: el juego no da instrucciones médicas');
  assert.equal(c.REASONS.filter(r => r.correct).length, 2);
});

test('hospital: el turno exige su orden y el turno perfecto da 100', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/hospital-shift-logic.js');
  const def = defineMission(c.HOSPITAL_SHIFT_MISSION);
  const run = new MissionRun(def);
  assert.equal(run.act('readBoard'), false, 'el pizarrón pide recibir el turno primero');
  run.act('shift'); run.act('readBoard');
  assert.equal(run.act('assess', { id: 'aurelio', flags: [], triage: 'rojo' }), false, 'no se clasifica sin revisar entrevista, monitor y expediente');
  run.act('review', { id: 'aurelio', what: 'talk' }); run.act('review', { id: 'aurelio', what: 'monitor' });
  assert.equal(run.act('assess', { id: 'aurelio', flags: [], triage: 'rojo' }), false, 'falta el expediente');
  run.act('review', { id: 'aurelio', what: 'chart' });
  assert.equal(run.act('assess', { id: 'aurelio', flags: ['inventado'], triage: 'rojo' }), false, 'solo hallazgos reales del paciente');
  assert.equal(run.act('prioritize', { order: ['aurelio', 'celia', 'joaquin', 'mariana'] }), false, 'se ordena cuando todos tienen color');
  assert.equal(run.act('record'), false, 'no hay bitácora sin decisiones');
  const perfect = play(new MissionRun(def), c);
  const r = perfect.evaluate();
  assert.deepEqual([r.valid, r.score, r.passed], [true, 100, true]);
  assert.equal(replay(def, perfect.log).result.score, 100, 'el servidor reproduce la misma calificación');
  // los dos rojos pueden ir en cualquier orden
  assert.equal(play(new MissionRun(def), c, { order: ['celia', 'aurelio', 'joaquin', 'mariana'] }).evaluate().score, 100);
});

test('hospital: cada error pesa lo suyo', async () => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/hospital-shift-logic.js');
  const def = defineMission(c.HOSPITAL_SHIFT_MISSION);
  // por orden de llegada (el verde primero): pierde el orden
  const r1 = play(new MissionRun(def), c, { order: ['mariana', 'joaquin', 'aurelio', 'celia'] }).evaluate();
  assert.equal(r1.breakdown.orden, 0);
  // quejarse no es gravedad: Mariana en rojo y Doña Celia en verde
  const r2 = play(new MissionRun(def), c, { triage: { aurelio: 'rojo', celia: 'verde', joaquin: 'amarillo', mariana: 'rojo' } }).evaluate();
  assert.equal(r2.breakdown.triaje, 12);
  // no pedir apoyo con Don Aurelio
  const r3 = play(new MissionRun(def), c, { support: { aurelio: false, celia: true, joaquin: false, mariana: false } }).evaluate();
  assert.equal(r3.breakdown.apoyo, 6);
  // marcar la edad como alarma (sesgo) cuesta media alarma
  const flags = Object.fromEntries(c.PATIENTS.map(p => [p.id, p.findings.filter(f => f.alarm).map(f => f.id)]));
  const r4 = play(new MissionRun(def), c, { flags: { ...flags, celia: [...flags.celia, 'edad'] } }).evaluate();
  assert.equal(r4.breakdown.alarmas, 14);
  // «esperar a ver si mejora» con Doña Celia
  const r5 = play(new MissionRun(def), c, { action: { ...Object.fromEntries(c.PATIENTS.map(p => [p.id, p.actions.find(a => a.correct).id])), celia: 'obs-celia' } }).evaluate();
  assert.equal(r5.breakdown.acciones, 15);
  // razones equivocadas
  assert.equal(play(new MissionRun(def), c, { reasons: ['llegada'] }).evaluate().breakdown.justificacion, 0);
});

test('hospital: recompensa idempotente con el mismo servicio de misiones', async () => {
  const { defineMission, MissionRegistry, MissionService } = await game('missions/engine.js');
  const c = await game('missions/hospital-shift-logic.js');
  const { REWARDS } = await game('economy/economy.js');
  assert.deepEqual(REWARDS[c.MISSION_ID], { amount: 20, xp: 160, repeatXp: 40 });
  const registry = new MissionRegistry(); registry.register(defineMission(c.HOSPITAL_SHIFT_MISSION));
  const saved = new Map(); const grants = [];
  const service = new MissionService({ registry, rewards: REWARDS,
    progress: { get: id => saved.get(id), set: (id, r) => saved.set(id, r), addXp: () => {} },
    economy: { grant: async ({ key, amount }) => { const dup = grants.includes(key); if (!dup) grants.push(key); return { granted: !dup, duplicate: dup, amount }; } } });
  const r1 = await service.complete(play(service.start(c.MISSION_ID), c));
  assert.deepEqual([r1.credits, r1.xp], [20, 160]);
  const r2 = await service.complete(play(service.start(c.MISSION_ID), c));
  assert.deepEqual([r2.credits, r2.xp], [0, 40]);
});

test('hospital: escena en red y validación por socket real en el servidor', async t => {
  const { SCENE_RULES } = await game('net/scenes.js');
  const { NET_SCENES } = await game('net/network.js');
  assert.ok(NET_SCENES.includes('hospital'));
  assert.deepEqual(SCENE_RULES.hospital.links, ['plaza']);
  assert.ok(SCENE_RULES.plaza.links.includes('hospital'));
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return t.skip('npm install en _ciudad-server');
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await import(pathToFileURL(path.join(root, '_ciudad-server/server.js')).href);
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/hospital-shift-logic.js');
  const app = createServer({ devLogin: true }); const port = await app.listen(); t.after(() => app.close());
  const ticket = (await (await fetch(`http://127.0.0.1:${port}/dev/ticket`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"uid":"enf","name":"Enfermera"}' })).json()).ticket;
  const ws = new WebSocket('ws://127.0.0.1:' + port), inbox = [];
  ws.on('message', m => inbox.push(JSON.parse(m.toString())));
  const wait = type => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > 3000) return rej(new Error('sin ' + type)); setTimeout(poll, 20); })(); });
  await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'hello', ticket })); await wait('welcome');
  const tell = m => { ws.send(JSON.stringify(m)); return wait('profile'); };
  const run = play(new MissionRun(defineMission(c.HOSPITAL_SHIFT_MISSION)), c);
  const skipped = run.log.filter(e => !(e.type === 'review' && e.payload.what === 'chart'));
  assert.equal((await tell({ t: 'profile', op: 'mission', mission: c.MISSION_ID, log: skipped })).ok, false, 'sin expedientes revisados no hay recompensa');
  const ok1 = await tell({ t: 'profile', op: 'mission', mission: c.MISSION_ID, log: run.log });
  assert.deepEqual([ok1.ok, ok1.score, ok1.credits], [true, 100, 20]);
  const ok2 = await tell({ t: 'profile', op: 'mission', mission: c.MISSION_ID, log: run.log });
  assert.deepEqual([ok2.ok, ok2.credits], [true, 0]);
  ws.close();
});
