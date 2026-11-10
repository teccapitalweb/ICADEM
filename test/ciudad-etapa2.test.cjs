'use strict';
// Ciudad ICADEM · pruebas de la etapa 2: cámara, motor de misiones, frases rápidas y servidor de sesiones.
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
  assert.deepEqual(service.record(def.id), { completed: true, bestScore: 100, attempts: 3, lastScore: 85 });
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

test('servidor de sesiones: instancias, visibilidad, validación de movimiento, frases y reconexión', async () => {
  const { Hub, LIMITS } = await load('_ciudad-server/hub.js');
  const { encodeState } = await game('net/network.js');
  let t = 0; const hub = new Hub({ now: () => t, capacity: 3, salt: 'x' });
  const st = (scene, x, z) => encodeState({ scene, x, y: 0, z, yaw: 0, anim: 'idle' });
  const a = hub.join({ uid: 'a', name: ' Ana <b> ' }).player, b = hub.join({ uid: 'b', name: 'Beto' }).player, c = hub.join({ uid: 'c', name: '' }).player;
  assert.equal(a.name, 'Ana b'); assert.equal(c.name, 'Jugador'); assert.notEqual(a.pid, 'a', 'no se expone el uid');
  assert.equal(new Set([a.instance, b.instance, c.instance]).size, 1, 'los jugadores se juntan en la misma instancia');
  const d = hub.join({ uid: 'd', name: 'Dana' }).player;
  assert.notEqual(d.instance, a.instance, 'instancia llena → se abre otra'); assert.equal(hub.stats().instances, 2);

  for (const p of [a, b, c]) assert.equal(hub.state(p, st('plaza', 0, 0)).ok, true);
  hub.state(d, st('plaza', 0, 0));
  assert.deepEqual(hub.snapshotFor(a).map(x => x[0]).sort(), [b.pid, c.pid].sort(), 've a los de su instancia, no a los de otra');
  t += 1000; hub.state(c, st('room', 0, 0));
  assert.deepEqual(hub.snapshotFor(a).map(x => x[0]), [b.pid], 'la habitación es privada');
  assert.deepEqual(hub.snapshotFor(c), [], 'y desde la habitación no se ve a nadie');
  t += 1000; hub.state(b, st('bank', 0, 0));
  assert.deepEqual(hub.snapshotFor(a), [], 'solo se ve a quien está en el mismo escenario');
  t += 1000; hub.state(b, st('plaza', 1, 1)); t += 1000;

  // el servidor manda: movimientos imposibles se rechazan y se corrige al cliente
  t += 100; const tp = hub.state(a, st('plaza', 40, 40));
  assert.equal(tp.ok, false); assert.equal(tp.reason, 'velocidad'); assert.deepEqual(tp.fix.slice(0, 4), ['plaza', 0, 0, 0]);
  assert.equal(hub.state(a, st('plaza', 500, 0)).reason, 'fuera-del-mapa');
  assert.equal(hub.state(a, ['luna', 0, 0, 0, 0, 0]).reason, 'formato');
  assert.equal(hub.state(a, 'basura').ok, false);
  t += 1000; assert.equal(hub.state(a, st('plaza', 5, 0)).ok, true, 'caminar normal sí pasa');

  // frases: lista cerrada, cercanía, ritmo
  assert.equal(hub.say(a, 'insulto libre').ok, false);
  assert.deepEqual(hub.say(a, 'hola').to.map(p => p.pid), [b.pid]);
  hub.say(a, 'hola'); hub.say(a, 'hola');
  assert.equal(hub.say(a, 'hola').reason, 'demasiado-rapido');
  t += 9000; hub.state(b, st('plaza', 1, 1)); t += 500; hub.state(b, st('bank', 0, 0)); t += 500; assert.equal(hub.state(b, st('plaza', 44, 44)).ok, true);
  assert.deepEqual(hub.say(a, 'hola').to, [], 'lejos no llega');
  assert.equal(hub.say(c, 'hola').reason, 'sin-audiencia');

  // reconexión: se conserva el lugar; si no vuelve, se libera
  hub.detach(b); assert.equal(hub.snapshotFor(a).length, 0);
  t += LIMITS.resumeMs - 1; assert.equal(hub.sweep().length, 0);
  const back = hub.join({ uid: 'b', name: 'Beto' });
  assert.equal(back.resumed, true); assert.equal(back.player, b); assert.equal(back.instance, a.instance);
  hub.detach(b); t += LIMITS.resumeMs; assert.deepEqual(hub.sweep().map(p => p.pid), [b.pid]);
  assert.equal(a.instance.players.has(b.pid), false);

  assert.equal(hub.report(a, c.pid, 'prueba').ok, true); assert.equal(hub.report(a, a.pid).ok, false); assert.equal(hub.report(a, 'nadie').ok, false);
  assert.equal(hub.reports.length, 1);
});

test('servidor de sesiones (WebSocket real): dos clientes se ven, se hablan y se reconectan', async t => {
  let WebSocket;
  try { WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws')); } catch (_) { try { WebSocket = require('/opt/npm-tools/node_modules/ws'); } catch (_) { return t.skip('ws no está instalado (npm install en _ciudad-server)'); } }
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return t.skip('npm install en _ciudad-server para esta prueba');
  const { createServer, testVerifier } = await load('_ciudad-server/server.js');
  const { encodeState } = await game('net/network.js');
  assert.equal(testVerifier('otra-cosa'), null); assert.deepEqual(testVerifier('test:ana:Ana T'), { uid: 'test-ana', name: 'Ana T' });
  const app = createServer({ origins: ['http://ok.test'] }); const port = await app.listen();
  t.after(() => app.close());
  const client = (token, origin = 'http://ok.test') => new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port, { origin }), inbox = [];
    ws.inbox = inbox; ws.on('message', m => inbox.push(JSON.parse(m.toString())));
    ws.wait = (type, ms = 3000) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error('sin ' + type)); setTimeout(poll, 15); })(); });
    ws.on('open', () => { if (token) ws.send(JSON.stringify({ t: 'hello', token })); resolve(ws); }); ws.on('error', reject);
  });
  await assert.rejects(client('test:x:X', 'http://otro.sitio'), 'origen no permitido');
  const intruso = await client('token-falso'); assert.equal((await intruso.wait('bye')).reason, 'no-autorizado');

  const ana = await client('test:ana:Ana'), wa = await ana.wait('welcome');
  const beto = await client('test:beto:Beto'), wb = await beto.wait('welcome');
  assert.equal(wa.instance, wb.instance); assert.deepEqual(wb.roster.map(p => p.name), ['Ana']); assert.equal((await ana.wait('join')).name, 'Beto');
  const st = (x, z, anim = 'idle') => ({ t: 's', s: encodeState({ scene: 'plaza', x, y: 0, z, yaw: 1, anim }) });
  ana.send(JSON.stringify(st(1, 2))); beto.send(JSON.stringify(st(3, 4, 'wave')));
  let snap; for (let i = 0; i < 20; i++) { snap = await ana.wait('snap'); if (snap.list.length) break; }
  assert.deepEqual(snap.list, [[wb.pid, ['plaza', 300, 0, 400, 100, 4]]], 'Ana recibe la posición y animación reales de Beto');
  beto.send(JSON.stringify({ t: 'say', id: 'hola' })); assert.deepEqual(await ana.wait('say'), { t: 'say', pid: wb.pid, id: 'hola' });
  beto.send(JSON.stringify({ t: 'say', id: 'texto libre' })); assert.equal((await beto.wait('nosay')).reason, 'frase-desconocida');
  ana.send(JSON.stringify({ t: 's', s: encodeState({ scene: 'plaza', x: 45, y: 0, z: 45, yaw: 0, anim: 'run' }) }));
  assert.equal((await ana.wait('fix')).reason, 'velocidad');
  ana.send(JSON.stringify({ t: 'ping', n: 7 })); assert.equal((await ana.wait('pong')).n, 7);
  ana.send(JSON.stringify({ t: 'verify', mission: 'banco-credito-correcto', log: [{ type: 'talk' }, { type: 'choose', payload: { id: 'pyme' } }] }));
  assert.equal((await ana.wait('verified')).ok, false, 'el servidor reproduce la bitácora y rechaza la que se salta pasos');

  // reconexión: Beto se cae y vuelve; recupera su lugar
  beto.terminate(); assert.equal((await ana.wait('leave')).soft, true);
  const beto2 = await client('test:beto:Beto'); const w2 = await beto2.wait('welcome');
  assert.equal(w2.resumed, true); assert.equal(w2.pid, wb.pid); assert.equal(w2.instance, wa.instance);
  // misma cuenta en otra pestaña: la sesión anterior se cierra
  const beto3 = await client('test:beto:Beto'); await beto3.wait('welcome');
  assert.equal((await beto2.wait('bye')).reason, 'sesion-en-otro-lugar');
  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.ok, true); assert.equal(health.players, 2);
  [intruso, ana, beto3].forEach(ws => ws.terminate());
});
