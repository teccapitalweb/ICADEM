'use strict';
// Ciudad ICADEM · pruebas de la etapa 2: cámara, motor de misiones y frases rápidas.
// El servidor de sesiones se prueba en ciudad-multijugador.test.cjs y el Tribunal en ciudad-tribunal.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);
const game = relative => load(path.join('ciudad/js', relative));

test('cámara: el brazo nunca cruza un edificio ni el límite de un interior', async () => {
  const { CollisionWorld } = await game('core/collision.js');
  const { ThirdPersonCamera } = await game('core/camera.js');
  const world = new CollisionWorld().addBoxAt(0, -10, 10, 6, 8).addBoxAt(20, 0, 2, 2); // edificio alto y un mueble bajo
  assert.equal(world.segmentHit(0, 0, 0, -20), 0.35, 'choca con la cara del edificio a 7 m de 20');
  assert.equal(world.segmentHit(0, 0, 0, 20), 1, 'camino libre');
  assert.equal(world.segmentHit(15, 0, 25, 0), 1, 'los obstáculos bajos no detienen a la cámara');
  assert.equal(world.segmentHit(0, 0, 0, -20, () => 9), 1, 'por encima del techo sí pasa');

  const fake = { position: { copy() {}, lerp() {} }, lookAt() {} };
  const cam = new ThirdPersonCamera(fake);
  cam.configure({ distance: 7.5, pitch: 0.4, yaw: Math.PI, world });   // cámara del lado del edificio
  cam.snap({ x: 0, y: 0, z: -5 });                                      // jugador a 2 m de la fachada
  assert.ok(cam.armH <= 2 - 0.3 + 1e-9, `no entra al edificio (h=${cam.armH.toFixed(2)})`);
  assert.ok(cam.arm > 7.4, 'en vez de pegarse al avatar, sube conservando la distancia');
  cam.configure({ distance: 7.5, pitch: 0.4, yaw: 0, world });          // del lado libre
  cam.snap({ x: 0, y: 0, z: -5 });
  assert.ok(Math.abs(cam.armH - Math.cos(0.4) * 7.5) < 1e-6, 'sin obstáculo usa toda la distancia');

  const room = new ThirdPersonCamera(fake);
  room.configure({ distance: 6, pitch: 0.5, yaw: Math.PI / 2, box: { minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxY: 5 } });
  for (const x of [-4, 0, 3, 5.5]) {
    room.snap({ x, y: 0, z: 0 });
    assert.ok(room.focus.x + room.armH <= 6 - 0.2 + 1e-9, 'queda dentro del límite del interior');
    assert.ok(room.focus.y + room.armV <= 5 - 0.2 + 1e-9, 'y bajo el techo');
  }
  // al despejarse, la cámara se aleja poco a poco (sin saltos)
  cam.configure({ distance: 7.5, pitch: 0.4, yaw: Math.PI, world }); cam.snap({ x: 0, y: 0, z: -5 });
  const near = cam.armH; cam.yaw = 0; cam.update(1 / 60, { x: 0, y: 0, z: -5 }, { dx: 0, dy: 0 }, 0);
  assert.ok(cam.armH > near && cam.armH < near + 1, 'transición gradual');
});

test('motor de misiones: definición validada, pasos en orden y bitácora reproducible', async () => {
  const { defineMission, MissionRun, MissionRegistry, replay, DIFFICULTY } = await game('missions/engine.js');
  const { BANK_CREDIT_MISSION } = await game('missions/bank-credit-logic.js');
  const def = defineMission(BANK_CREDIT_MISSION);
  assert.equal(def.building, 'banco'); assert.equal(def.passScore, 70);
  assert.throws(() => defineMission({ ...BANK_CREDIT_MISSION, reward: { amount: 500, xp: 1, repeatXp: 1 } }), /entre 10 y 15/, 'la recompensa respeta el rango de su dificultad');
  assert.throws(() => defineMission({ ...BANK_CREDIT_MISSION, difficulty: 'imposible' }));
  assert.throws(() => defineMission({ ...BANK_CREDIT_MISSION, objectives: [] }));
  assert.deepEqual([DIFFICULTY.sencilla.max, DIFFICULTY.intermedia.max, DIFFICULTY.dificil.max], [15, 20, 25]);

  const run = new MissionRun(def);
  // atajos bloqueados: nada se puede hacer fuera de orden
  for (const [type, payload] of [['readDocument', { id: 'flujo' }], ['takeProposal', { id: 'pyme' }], ['simulate', { id: 'pyme' }], ['compare'], ['choose', { id: 'pyme' }], ['justify', { reasons: ['costo'] }], ['inventada']]) assert.equal(run.act(type, payload), false, type + ' antes de tiempo');
  assert.equal(run.log.length, 0);
  assert.equal(run.act('talk'), true); assert.equal(run.current, 'documents');
  run.act('readDocument', { id: 'solicitud' }); assert.equal(run.objectives[1].detail, '1/2');
  run.act('readDocument', { id: 'flujo' });
  assert.equal(run.act('simulate', { id: 'pyme' }), false, 'no se simula una propuesta que no se ha pedido');
  for (const id of ['expres', 'pyme', 'comodo']) run.act('takeProposal', { id });
  assert.equal(run.act('compare'), false, 'el tablero necesita las tres simulaciones');
  for (const id of ['expres', 'pyme', 'comodo']) assert.equal(run.act('simulate', { id }), true);
  assert.equal(run.current, 'compare'); run.act('compare');
  assert.equal(run.act('choose', { id: 'otra' }), false); run.act('choose', { id: 'pyme' });
  assert.equal(run.act('justify', { reasons: ['costo', 'capacidad', 'cuota'] }), false, 'máximo dos razones');
  run.act('justify', { reasons: ['costo', 'capacidad'] });
  assert.equal(run.ready, true); assert.equal(run.current, 'done'); assert.equal(run.evaluate().score, 100);

  const again = replay(def, JSON.parse(JSON.stringify(run.log)));
  assert.equal(again.ok, true); assert.equal(again.result.score, 100);
  const forged = [{ type: 'talk' }, { type: 'choose', payload: { id: 'pyme' } }, { type: 'justify', payload: { reasons: ['costo'] } }];
  assert.equal(replay(def, forged).ok, false, 'una bitácora que se salta pasos se rechaza');
  assert.equal(replay(def, 'no-es-lista').ok, false);

  const registry = new MissionRegistry(); registry.register(def);
  assert.throws(() => registry.register(def), /duplicada/);
  assert.equal(registry.byBuilding('banco').length, 1); assert.equal(registry.get('nada'), null);
});

test('motor de misiones: recompensa una sola vez, reintentos y registro', async () => {
  const { defineMission, MissionRegistry, MissionService } = await game('missions/engine.js');
  const { BANK_CREDIT_MISSION } = await game('missions/bank-credit-logic.js');
  const { Store } = await game('core/store.js');
  const { TestEconomy, REWARDS } = await game('economy/economy.js');
  const m = new Map(), storage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  const store = new Store(storage), economy = new TestEconomy(store);
  const registry = new MissionRegistry(); const def = registry.register(defineMission(BANK_CREDIT_MISSION));
  const service = new MissionService({ registry, economy, rewards: REWARDS, progress: { get: id => store.state.missions[id], set: (id, r) => { store.state.missions[id] = r; store.save(); }, addXp: xp => store.addXp(xp) } });
  const play = (choice, reasons) => { const run = service.start(def.id); run.act('talk'); ['solicitud', 'flujo'].forEach(id => run.act('readDocument', { id })); ['expres', 'pyme', 'comodo'].forEach(id => { run.act('takeProposal', { id }); run.act('simulate', { id }); }); run.act('compare'); run.act('choose', { id: choice }); run.act('justify', { reasons }); return run; };

  const half = service.start(def.id); half.act('talk');
  assert.deepEqual(await service.complete(half), { ok: false, reason: 'incomplete', result: half.evaluate() });
  assert.equal(service.record(def.id).attempts, 0, 'un intento incompleto no cuenta');

  const bad = await service.complete(play('expres', ['rapidez']));
  assert.equal(bad.ok, true); assert.equal(bad.result.passed, false); assert.equal(bad.credits, 0); assert.equal(await economy.getBalance(), 0);
  const good = play('pyme', ['costo', 'capacidad']);
  const first = await service.complete(good);
  assert.equal(first.credits, 15); assert.equal(first.xp, 120); assert.equal(first.firstPass, true);
  assert.deepEqual(await service.complete(good), { ok: false, reason: 'closed' }, 'un intento cerrado no se puede cerrar dos veces');
  const second = await service.complete(play('pyme', ['costo']));
  assert.equal(second.credits, 0, 'repetir no vuelve a dar créditos'); assert.equal(second.xp, 30); assert.equal(second.duplicate, true);
  assert.equal(await economy.getBalance(), 15);
  const { record: rec } = { record: service.record(def.id) };
  assert.match(rec.repeatDay, /^\d{4}-\d{2}-\d{2}$/, 'la XP de práctica guarda el día');
  assert.deepEqual({ ...rec, repeatDay: undefined }, { completed: true, bestScore: 100, attempts: 3, lastScore: 85, repeatDay: undefined });
  const third = await service.complete(play('pyme', ['costo', 'capacidad']));
  assert.equal(third.xp, 0, 'la XP de práctica se da una vez al día por misión'); assert.equal(third.credits, 0);
  // manipular el estado sin pasar por las acciones no sirve: se evalúa la bitácora, no el estado
  const cheat = service.start(def.id); Object.assign(cheat.state, good.state);
  assert.equal((await service.complete(cheat)).ok, false);
  // los importes son configurables desde fuera de la definición
  assert.equal(new MissionService({ registry, economy, progress: {}, rewards: { [def.id]: { amount: 12, xp: 1, repeatXp: 1 } } }).rewardFor(def.id).amount, 12);
});

test('frases rápidas: lista cerrada y límite de envío', async () => {
  const { PHRASES, phraseById, createRateLimiter, SAY_LIMIT } = await game('social/phrases.js');
  const { ANIMS } = await game('net/network.js');
  assert.deepEqual(PHRASES.map(p => p.text), ['¡Hola!', '¿Jugamos?', 'Ven conmigo.', '¡Buen trabajo!', 'Necesito ayuda.', 'Vamos al siguiente reto.']);
  for (const p of PHRASES) assert.ok(ANIMS.includes(p.emote), p.emote + ' viaja por la red');
  assert.equal(phraseById('<script>'), null);
  assert.deepEqual(ANIMS.slice(0, 8), ['idle', 'walk', 'run', 'jump', 'wave', 'celebrate', 'sit', 'interact'], 'los índices anteriores no cambian');
  const allow = createRateLimiter(); let sent = 0;
  for (let i = 0; i < 10; i++) if (allow(1000 + i * 100)) sent++;
  assert.equal(sent, SAY_LIMIT.max);
  assert.equal(allow(1000 + SAY_LIMIT.windowMs), true, 'al pasar la ventana se puede volver a enviar');
});
