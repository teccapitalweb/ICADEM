'use strict';
// Ciudad ICADEM · Obra «Inspector de seguridad»: reglas del caso y uso del mismo motor.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const game = relative => import(pathToFileURL(path.join(__dirname, '..', 'ciudad/js', relative)).href);

/** Recorrido perfecto, con variantes para medir cada decisión. */
function play(run, c, plan = {}) {
  const verdicts = plan.verdicts || Object.fromEntries(c.SPOTS.map(s => [s.id, s.hazard ? 'riesgo' : 'en-regla']));
  const measures = plan.measures || Object.fromEntries(c.SPOTS.filter(s => s.hazard).map(s => [s.id, s.measures.find(m => m.correct).id]));
  const stop = plan.stop || c.BEST_STOP;
  const reasons = plan.reasons || ['inminente', 'epp'];
  const steps = [['talk'],
    ...c.GEAR.map(g => ['equip', { id: g.id }]),
    ['readPlan'],
    ...c.SPOTS.flatMap(s => [['inspect', { id: s.id }], ['assess', { id: s.id, verdict: verdicts[s.id] }]]),
    ...Object.entries(measures).filter(([id]) => verdicts[id] === 'riesgo').map(([id, m]) => ['measure', { id, measure: m }]),
    ['placeSign'],
    ['stopWork', { id: stop }],
    ['report'], ['justify', { reasons }]];
  for (const [type, payload] of steps) assert.equal(run.act(type, payload || {}), true, 'paso válido: ' + type);
  return run;
}

test('obra: el caso es coherente (5 riesgos, 3 en regla, una medida correcta por riesgo)', async () => {
  const c = await game('missions/site-inspector-logic.js');
  assert.equal(c.SPOTS.length, 8);
  assert.equal(c.HAZARDS.length, 5);
  for (const s of c.SPOTS.filter(x => x.hazard)) {
    assert.equal(s.measures.length, 3, s.id);
    assert.equal(s.measures.filter(m => m.correct).length, 1, s.id + ': una sola medida correcta');
  }
  for (const s of c.SPOTS.filter(x => !x.hazard)) assert.equal(s.measures, undefined, s.id + ': lo que está en regla no pide medidas');
  assert.equal(c.STOP_OPTIONS.filter(o => o.correct).length, 1);
  assert.ok(c.HAZARDS.includes(c.BEST_STOP), 'se detiene una actividad que sí es riesgo');
  assert.ok(c.HAZARDS.includes(c.SIGN_SPOT), 'la señalización va en un riesgo real');
  assert.equal(c.REASONS.filter(r => r.correct).length, 2);
  assert.equal(c.GEAR.length, 3);
});

test('obra: sin EPP no hay recorrido y la partida perfecta da 100', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/site-inspector-logic.js');
  const def = defineMission(c.SITE_INSPECTOR_MISSION);
  const run = new MissionRun(def);
  assert.equal(run.act('equip', { id: 'casco' }), false, 'el EPP se entrega después de presentarse');
  run.act('talk');
  assert.equal(run.act('readPlan'), false, 'el plano exige el EPP completo');
  run.act('equip', { id: 'casco' }); run.act('equip', { id: 'chaleco' });
  assert.equal(run.act('readPlan'), false, 'faltan las botas');
  assert.equal(run.act('inspect', { id: 'zanja' }), false, 'no se inspecciona sin plano');
  run.act('equip', { id: 'botas' }); run.act('readPlan');
  assert.equal(run.act('assess', { id: 'zanja', verdict: 'riesgo' }), false, 'calificar exige inspeccionar primero');
  assert.equal(run.act('placeSign'), false, 'la señal se coloca cuando la zanja ya se marcó como riesgo');
  assert.equal(run.act('stopWork', { id: c.BEST_STOP }), false, 'el paro se decide al terminar el recorrido');
  const fresh = play(new MissionRun(def), c);
  const result = fresh.evaluate();
  assert.deepEqual([result.valid, result.score, result.passed], [true, 100, true]);
  const again = replay(def, fresh.log);
  assert.equal(again.ok, true); assert.equal(again.result.score, 100);
});

test('obra: cada error pesa lo suyo', async () => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/site-inspector-logic.js');
  const def = defineMission(c.SITE_INSPECTOR_MISSION);
  // marcar todo como riesgo: pierde los 3 puntos en regla (40 → 25)
  const todoRiesgo = Object.fromEntries(c.SPOTS.map(s => [s.id, 'riesgo']));
  const medidasTodo = Object.fromEntries(c.SPOTS.filter(s => s.hazard).map(s => [s.id, s.measures.find(m => m.correct).id]));
  const r1 = play(new MissionRun(def), c, { verdicts: todoRiesgo, measures: medidasTodo }).evaluate();
  assert.equal(r1.breakdown.identificacion, 25);
  // medidas tibias (letrero en vez de parar el andamio) no suman
  const tibias = { ...medidasTodo, 'andamio-sur': 'letrero-andamio' };
  delete tibias.extintor; delete tibias['andamio-norte']; delete tibias.acopio;
  const r2 = play(new MissionRun(def), c, { measures: { ...Object.fromEntries(c.SPOTS.filter(s => s.hazard).map(s => [s.id, s.measures.find(m => m.correct).id])), 'andamio-sur': 'letrero-andamio' } }).evaluate();
  assert.equal(r2.breakdown.medidas, 24, 'cuatro medidas correctas de cinco');
  // detener la actividad equivocada cuesta el paro
  const r3 = play(new MissionRun(def), c, { stop: 'mezcladora' }).evaluate();
  assert.equal(r3.breakdown.paro, 0);
  // razones equivocadas restan
  const r4 = play(new MissionRun(def), c, { reasons: ['inminente', 'avance'] }).evaluate();
  assert.equal(r4.breakdown.justificacion, 0);
  // incompleto no vale
  const run = new MissionRun(def); run.act('talk');
  assert.deepEqual(run.evaluate(), { valid: false, score: 0, passed: false, breakdown: null });
});

test('obra: recompensa idempotente con el mismo servicio de misiones', async () => {
  const { defineMission, MissionRegistry, MissionService } = await game('missions/engine.js');
  const c = await game('missions/site-inspector-logic.js');
  const { REWARDS } = await game('economy/economy.js');
  assert.deepEqual(REWARDS[c.MISSION_ID], { amount: 20, xp: 160, repeatXp: 40 });
  const registry = new MissionRegistry(); registry.register(defineMission(c.SITE_INSPECTOR_MISSION));
  const saved = new Map(); const grants = [];
  const service = new MissionService({
    registry, rewards: REWARDS,
    progress: { get: id => saved.get(id), set: (id, r) => saved.set(id, r), addXp: () => {} },
    economy: { grant: async ({ key, amount }) => { const dup = grants.includes(key); if (!dup) grants.push(key); return { granted: !dup, duplicate: dup, amount }; } }
  });
  const r1 = await service.complete(play(service.start(c.MISSION_ID), c));
  assert.deepEqual([r1.ok, r1.credits, r1.xp], [true, 20, 160]);
  const r2 = await service.complete(play(service.start(c.MISSION_ID), c));
  assert.deepEqual([r2.credits, r2.xp], [0, 40], 'repetir no duplica créditos');
});

test('obra: la escena en red existe y el servidor valida esta misión', async () => {
  const { SCENE_RULES } = await game('net/scenes.js');
  const { NET_SCENES } = await game('net/network.js');
  assert.ok(NET_SCENES.includes('site'));
  assert.deepEqual(SCENE_RULES.site.links, ['plaza']);
  assert.ok(SCENE_RULES.plaza.links.includes('site'));
  const server = require('node:fs').readFileSync(path.join(__dirname, '..', '_ciudad-server/server.js'), 'utf8');
  assert.match(server, /SITE_INSPECTOR_MISSION/);
});

test('servidor real: valida por socket las bitácoras de Supermercado y Obra y no duplica recompensas', async t => {
  const fs = require('node:fs');
  const root = path.join(__dirname, '..');
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return t.skip('npm install en _ciudad-server para esta prueba');
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await import(pathToFileURL(path.join(root, '_ciudad-server/server.js')).href);
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const market = await game('missions/market-inventory-logic.js');
  const site = await game('missions/site-inspector-logic.js');
  const app = createServer({ devLogin: true }); const port = await app.listen(); t.after(() => app.close());
  const ticket = (await (await fetch(`http://127.0.0.1:${port}/dev/ticket`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"uid":"insp","name":"Inspector"}' })).json()).ticket;
  const ws = new WebSocket('ws://127.0.0.1:' + port), inbox = [];
  ws.on('message', m => inbox.push(JSON.parse(m.toString())));
  const wait = type => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > 3000) return rej(new Error('sin ' + type)); setTimeout(poll, 20); })(); });
  await new Promise(r => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'hello', ticket })); await wait('welcome');
  const tell = m => { ws.send(JSON.stringify(m)); return wait('profile'); };

  // Supermercado: bitácora perfecta → 100, 20 créditos; repetir → 0 créditos; bitácora incompleta → rechazada
  const mRun = new MissionRun(defineMission(market.MARKET_INVENTORY_MISSION));
  for (const [type, payload] of [['talk'], ['readLedger'], ...market.SHELVES.map(s => ['countShelf', { id: s.id }]),
    ...market.PRODUCTS.flatMap(p => [['inspect', { id: p.id }], ['decide', { id: p.id, action: p.remove ? 'retirar' : 'conservar' }]]),
    ['orderFridge', { order: [...market.BEST_ORDER] }], ...market.SHELVES.map(s => ['adjust', { id: s.id, delta: market.deltaOf(s) }]), ['report'], ['justify', { reasons: ['salud', 'peps'] }]]) mRun.act(type, payload || {});
  const m1 = await tell({ t: 'profile', op: 'mission', mission: market.MISSION_ID, log: mRun.log });
  assert.deepEqual([m1.ok, m1.score, m1.credits], [true, 100, 20]);
  const m2 = await tell({ t: 'profile', op: 'mission', mission: market.MISSION_ID, log: mRun.log });
  assert.deepEqual([m2.ok, m2.credits], [true, 0], 'repetir no duplica');
  const m3 = await tell({ t: 'profile', op: 'mission', mission: market.MISSION_ID, log: [{ type: 'talk' }, { type: 'report' }] });
  assert.equal(m3.ok, false, 'el servidor rechaza una bitácora con atajos');

  // Obra: un cliente no puede saltarse el EPP aunque mande el resto perfecto
  const sRun = new MissionRun(defineMission(site.SITE_INSPECTOR_MISSION));
  const steps = [['talk'], ...site.GEAR.map(g => ['equip', { id: g.id }]), ['readPlan'],
    ...site.SPOTS.flatMap(s => [['inspect', { id: s.id }], ['assess', { id: s.id, verdict: s.hazard ? 'riesgo' : 'en-regla' }], ...(s.hazard ? [['measure', { id: s.id, measure: s.measures.find(x => x.correct).id }]] : [])]),
    ['placeSign'], ['stopWork', { id: site.BEST_STOP }], ['report'], ['justify', { reasons: ['inminente', 'epp'] }]];
  for (const [type, payload] of steps) sRun.act(type, payload || {});
  const forged = sRun.log.filter(e => e.type !== 'equip');
  const s0 = await tell({ t: 'profile', op: 'mission', mission: site.MISSION_ID, log: forged });
  assert.equal(s0.ok, false, 'sin EPP en la bitácora no hay recompensa');
  const s1 = await tell({ t: 'profile', op: 'mission', mission: site.MISSION_ID, log: sRun.log });
  assert.deepEqual([s1.ok, s1.score, s1.credits, s1.profile.testCredits, s1.profile.coins - m2.profile.coins], [true, 100, 20, 0, 20], 'las monedas del juego suben una vez (los créditos de prueba quedan como historial)');
  const s2 = await tell({ t: 'profile', op: 'mission', mission: site.MISSION_ID, log: sRun.log });
  assert.deepEqual([s2.credits, s2.profile.coins - s1.profile.coins <= 4], [0, true], 'repetir solo da monedas de práctica');
  ws.close();
});
