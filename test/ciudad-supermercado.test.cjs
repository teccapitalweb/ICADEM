'use strict';
// Ciudad ICADEM · Supermercado «Rescate de inventario»: reglas del caso y uso del mismo motor.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const game = relative => import(pathToFileURL(path.join(__dirname, '..', 'ciudad/js', relative)).href);

/** Partida perfecta: decide bien los 5 productos, PEPS exacto y ajustes correctos. */
function play(run, c, plan = {}) {
  const decisions = plan.decisions || Object.fromEntries(c.PRODUCTS.map(p => [p.id, p.remove ? 'retirar' : 'conservar']));
  const order = plan.order || [...c.BEST_ORDER];
  const deltas = plan.deltas || Object.fromEntries(c.SHELVES.map(s => [s.id, c.deltaOf(s)]));
  const reasons = plan.reasons || ['salud', 'peps'];
  const steps = [['talk'], ['readLedger'],
    ...c.SHELVES.map(s => ['countShelf', { id: s.id }]),
    ...c.PRODUCTS.flatMap(p => [['inspect', { id: p.id }], ['decide', { id: p.id, action: decisions[p.id] }]]),
    ['orderFridge', { order }],
    ...c.SHELVES.map(s => ['adjust', { id: s.id, delta: deltas[s.id] }]),
    ['report'], ['justify', { reasons }]];
  for (const [type, payload] of steps) assert.equal(run.act(type, payload || {}), true, 'paso válido: ' + type);
  return run;
}

test('supermercado: el caso es coherente (fechas, deltas y PEPS salen de los datos)', async () => {
  const c = await game('missions/market-inventory-logic.js');
  assert.equal(c.SHELVES.length, 3);
  assert.deepEqual(c.SHELVES.map(c.deltaOf), [-3, 0, -3]);
  assert.equal(c.PRODUCTS.length, 5);
  assert.equal(c.PRODUCTS.filter(p => p.remove).length, 2, 'se retiran el caducado y el dañado, nada más');
  const porCaducar = c.PRODUCTS.find(p => p.id === 'pan');
  assert.equal(porCaducar.remove, false, 'lo que está por caducar se vende primero, no se tira');
  // PEPS: el orden correcto va del lote que caduca primero al que caduca al último
  const day = e => { const [d, , mes] = e.split(' '); return (mes === 'marzo' ? 300 : 400) + Number(d); };
  const sorted = [...c.LOTS].sort((a, b) => day(a.expiry) - day(b.expiry)).map(l => l.id);
  assert.deepEqual([...c.BEST_ORDER], sorted);
  assert.equal(c.REASONS.filter(r => r.correct).length, 2);
});

test('supermercado: la misión exige su orden y la partida perfecta da 100', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/market-inventory-logic.js');
  const def = defineMission(c.MARKET_INVENTORY_MISSION);
  const run = new MissionRun(def);
  // sin atajos: nada procede antes de su momento
  assert.equal(run.act('readLedger'), false, 'la oficina pide hablar primero con el gerente');
  assert.equal(run.act('countShelf', { id: 'lacteos' }), false, 'contar exige haber visto el sistema');
  assert.equal(run.act('decide', { id: 'leche', action: 'retirar' }), false, 'decidir exige revisar el producto');
  assert.equal(run.act('report'), false, 'no hay reporte sin terminar el trabajo');
  play(run, c);
  const result = run.evaluate();
  assert.deepEqual([result.valid, result.score, result.passed], [true, 100, true]);
  // y la bitácora completa se reproduce en el servidor con el mismo resultado
  const again = replay(def, run.log);
  assert.equal(again.ok, true);
  assert.equal(again.result.score, 100);
});

test('supermercado: cada error pesa lo suyo y un intento incompleto no vale', async () => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/market-inventory-logic.js');
  const def = defineMission(c.MARKET_INVENTORY_MISSION);
  // conservar lo caducado y tirar lo bueno cuesta la mesa de revisión
  const malas = Object.fromEntries(c.PRODUCTS.map(p => [p.id, p.remove ? 'conservar' : 'retirar']));
  const r1 = play(new MissionRun(def), c, { decisions: malas }).evaluate();
  assert.equal(r1.breakdown.retiro, 0);
  assert.equal(r1.score, 70, 'aun así puede pasar raspado si todo lo demás es perfecto');
  // PEPS al revés: solo cuenta si el urgente va al frente
  const r2 = play(new MissionRun(def), c, { order: ['c', 'a', 'b'] }).evaluate();
  assert.equal(r2.breakdown.peps, 0);
  const r3 = play(new MissionRun(def), c, { order: ['b', 'c', 'a'] }).evaluate();
  assert.equal(r3.breakdown.peps, 10, 'el urgente al frente vale la mitad');
  // ajustes equivocados (decir que coincide cuando faltan piezas)
  const r4 = play(new MissionRun(def), c, { deltas: { lacteos: 0, abarrotes: 0, frutas: 0 } }).evaluate();
  assert.equal(r4.breakdown.ajustes, 10, 'solo abarrotes coincidía de verdad');
  // razones equivocadas restan
  const r5 = play(new MissionRun(def), c, { reasons: ['salud', 'lleno'] }).evaluate();
  assert.equal(r5.breakdown.justificacion, 0);
  // incompleto: sin reporte no hay calificación
  const run = new MissionRun(def);
  run.act('talk'); run.act('readLedger');
  assert.deepEqual(run.evaluate(), { valid: false, score: 0, passed: false, breakdown: null });
});

test('supermercado: recompensa idempotente y registrada igual que las otras misiones', async () => {
  const { defineMission, MissionRegistry, MissionService, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/market-inventory-logic.js');
  const { REWARDS } = await game('economy/economy.js');
  assert.deepEqual(REWARDS[c.MISSION_ID], { amount: 20, xp: 160, repeatXp: 40 }, 'misión intermedia: 20 créditos de prueba');
  const registry = new MissionRegistry(); registry.register(defineMission(c.MARKET_INVENTORY_MISSION));
  const saved = new Map(); let xp = 0; const grants = [];
  const service = new MissionService({
    registry, rewards: REWARDS,
    progress: { get: id => saved.get(id), set: (id, r) => saved.set(id, r), addXp: n => { xp += n; } },
    economy: { grant: async ({ key, amount }) => { const dup = grants.includes(key); if (!dup) grants.push(key); return { granted: !dup, duplicate: dup, amount }; } }
  });
  const r1 = await service.complete(play(service.start(c.MISSION_ID), c));
  assert.deepEqual([r1.ok, r1.result.passed, r1.credits, r1.xp, r1.firstPass], [true, true, 20, 160, true]);
  const r2 = await service.complete(play(service.start(c.MISSION_ID), c));
  assert.deepEqual([r2.credits, r2.xp], [0, 40], 'repetir no duplica créditos y da la XP de repetición');
  assert.equal(saved.get(c.MISSION_ID).attempts, 2);
});

test('supermercado: la escena en red existe y el servidor valida esta misión', async () => {
  const { SCENE_RULES } = await game('net/scenes.js');
  const { NET_SCENES } = await game('net/network.js');
  assert.ok(NET_SCENES.includes('market'));
  assert.deepEqual(SCENE_RULES.market.links, ['plaza']);
  assert.ok(SCENE_RULES.plaza.links.includes('market'));
  assert.equal(SCENE_RULES.market.privacy, 'public');
  const server = require('node:fs').readFileSync(path.join(__dirname, '..', '_ciudad-server/server.js'), 'utf8');
  assert.match(server, /MARKET_INVENTORY_MISSION/, 'el servidor reproduce también esta bitácora antes de acreditar');
});
