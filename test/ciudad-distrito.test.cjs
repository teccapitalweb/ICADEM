'use strict';
// Ciudad ICADEM 1.3 · Distrito del Saber: laberinto, laboratorio, sala de escape y Ruta del explorador.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openServer } = require('./helpers/ciudad-server.cjs');
const root = path.join(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);

test('laberinto: sin abrir las tres puertas en orden no se llega a la salida', async () => {
  const { MAZE } = await load('ciudad/js/edu/district-rules.js');
  const G = MAZE.grid, find = ch => { for (let j = 0; j < G.length; j++) { const i = G[j].indexOf(ch); if (i >= 0) return [i, j]; } };
  const reach = open => { const s = find('S'), seen = new Set([s.join()]), q = [s];
    while (q.length) { const [i, j] = q.shift(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b, c = G[y] && G[y][x]; if (!c || c === '#' || seen.has(x + ',' + y) || ('123'.includes(c) && !open.includes(c))) continue; seen.add(x + ',' + y); q.push([x, y]); } }
    return seen; };
  const near = (ch, seen) => { const [i, j] = find(ch); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => seen.has((i + a) + ',' + (j + b))); };
  assert.equal(reach('').has(find('E').join()), false); assert.ok(near('1', reach('')));
  assert.equal(reach('1').has(find('E').join()), false); assert.ok(near('2', reach('1')));
  assert.equal(reach('12').has(find('E').join()), false); assert.ok(near('3', reach('12')));
  assert.ok(reach('123').has(find('E').join()));
  assert.equal(MAZE.checkpoints.length, 4);
  const { SCENE_RULES } = await load('ciudad/js/net/scenes.js'), b = SCENE_RULES.distrito.bounds;
  for (const [x, z] of MAZE.checkpoints) assert.ok(x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ, 'cada punto queda dentro del distrito');
  const { NET_SCENES } = await load('ciudad/js/net/network.js');
  assert.deepEqual(NET_SCENES.slice(0, 13), ['room', 'plaza', 'bank', 'court', 'market', 'site', 'hospital', 'vet', 'restaurant', 'greenhouse', 'office', 'tower', 'park'], 'los índices de escenas anteriores no cambian');
  assert.equal(NET_SCENES.indexOf('distrito'), 13);
});

test('laboratorio y sala de escape: el servidor regenera la partida y califica la bitácora', async () => {
  const { checkActivity, ACTIVITIES } = await load('ciudad/js/edu/activities.js');
  const { experimentAnswer } = await load('ciudad/js/edu/district-rules.js');
  const lab = ACTIVITIES.laboratorio.build(77, 'avanzado');
  assert.equal(lab.items.length, 8); assert.equal(new Set(lab.items.slice(0, 6).map(i => i.kind)).size, 6, 'variedad: un experimento de cada tipo primero');
  const right = lab.items.map(i => experimentAnswer(i.id).answer);
  assert.deepEqual(checkActivity('laboratorio', 77, 'avanzado', right), { valid: true, score: 100, correct: 8 });
  assert.equal(checkActivity('laboratorio', 77, 'avanzado', right.map((v, k) => k < 2 ? (v + 1) % lab.items[k].options.length : v)).score, 75);
  assert.equal(checkActivity('laboratorio', 77, 'avanzado', right.slice(1)).valid, false, 'bitácora incompleta');
  assert.equal(checkActivity('laboratorio', 77, 'avanzado', right.map(() => 9)).valid, false, 'opciones inexistentes');
  const esc = ACTIVITIES.escape.build(99, 'normal');
  assert.equal(esc.locks.length, 3); assert.equal(new Set(esc.locks.map(l => l.title)).size, 3, 'tres acertijos distintos');
  const solve = esc.locks.map((l, lock) => ({ lock, code: l.code }));
  assert.deepEqual(checkActivity('escape', 99, 'normal', solve), { valid: true, score: 100, wrong: 0, hints: 0 });
  const messy = [{ lock: 0, hint: true }, { lock: 0, code: '0' }, ...solve];
  assert.equal(checkActivity('escape', 99, 'normal', messy).score, 82, 'una pista −8 y un error −10');
  assert.equal(checkActivity('escape', 99, 'normal', solve.slice(0, 2)).valid, false, 'hay que abrir los tres candados');
  assert.equal(checkActivity('escape', 99, 'normal', [solve[1], solve[0], solve[2]]).valid, false, 'en orden');
  for (let s = 1; s < 300; s++) for (const l of ACTIVITIES.escape.build(s, 'normal').locks) assert.match(l.code, /^\d{1,5}$/, 'códigos numéricos que se pueden teclear');
  const { PLAY_GAMES, playAchievements } = await load('ciudad/js/edu/play-rules.js');
  for (const id of ['laboratorio', 'escape', 'laberinto']) assert.ok(PLAY_GAMES.includes(id));
  assert.deepEqual(playAchievements({ act: { laboratorio: { best: 85, done: true }, escape: { best: 60, done: true }, laberinto: { best: 70, done: true } } }).filter(a => ['cientifico', 'escapista', 'laberintista'].includes(a)), ['cientifico', 'escapista', 'laberintista']);
});

test('hub: el laberinto se valida con posiciones y la Ruta del explorador exige estar en el sitio', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const { MAZE, LANDMARKS } = await load('ciudad/js/edu/district-rules.js');
  let t = 1e6; const hub = new Hub({ now: () => t });
  const p = hub.join({ uid: 'ana', name: 'Ana' }).player;
  const at = (scene, x, z) => { p.state = { scene, x, y: 0, z, yaw: 0 }; p.stateAt = t; };
  at('plaza', 0, 0); assert.equal(hub.playStart(p, 'laberinto').reason, 'fuera-del-distrito');
  at('distrito', ...MAZE.start); assert.equal(hub.playStart(p, 'laberinto').ok, true);
  at('distrito', ...MAZE.checkpoints[1].slice(0, 2)); assert.equal(hub.playCheck(p, { i: 1 }).reason, 'fuera-de-orden', 'las puertas van en orden');
  at('distrito', 0, 0); assert.equal(hub.playCheck(p, { i: 0 }).reason, 'lejos');
  let r;
  for (let i = 0; i < 4; i++) { t += 12000; at('distrito', ...MAZE.checkpoints[i].slice(0, 2)); r = hub.playCheck(p, { i }); }
  assert.deepEqual([r.done, r.game, r.score], [true, 'laberinto', 100]);
  hub.playStart(p, 'laberinto'); for (let i = 0; i < 4; i++) { t += 2000; at('distrito', ...MAZE.checkpoints[i].slice(0, 2)); r = hub.playCheck(p, { i }); }
  assert.equal(r.reason, 'imposible', 'demasiado rápido no cuenta');
  // carrera intacta
  at('park', 0, 10); assert.equal(hub.playStart(p, 'carrera').ok, true); hub.playQuit(p);
  const lm = LANDMARKS.find(l => l.id === 'observatorio');
  at('distrito', 0, 0); assert.equal(hub.discover(p, 'observatorio').reason, 'lejos');
  at('plaza', ...lm.at); assert.equal(hub.discover(p, 'observatorio').reason, 'lejos', 'otro escenario no cuenta');
  at('distrito', ...lm.at); assert.deepEqual(hub.discover(p, 'observatorio'), { ok: true, id: 'observatorio' });
  assert.equal(hub.discover(p, 'inventado').reason, 'sitio-desconocido');
});

test('socket real: descubrir sitios da XP una sola vez, va a la cuenta y el laberinto acredita XP', async t => {
  const srv = await openServer(t); if (!srv) return t.skip('npm install en _ciudad-server');
  const { encodeState } = await load('ciudad/js/net/network.js');
  const { LANDMARKS, DISCOVER_XP } = await load('ciudad/js/edu/district-rules.js');
  const ana = await srv.client('ana');
  assert.deepEqual(ana.welcome.profile.discovered, []);
  const go = (scene, x, z) => ana.tell({ t: 's', s: encodeState({ scene, x, y: 0, z, yaw: 0 }) });
  go('plaza', 0, 0); await new Promise(r => setTimeout(r, 80));
  ana.tell({ t: 'play', op: 'discover', id: 'fuente' }); const d1 = await ana.wait('play', m => m.op === 'discover');
  assert.deepEqual([d1.ok, d1.xp, d1.profile.discovered], [true, DISCOVER_XP, ['fuente']]);
  ana.tell({ t: 'play', op: 'discover', id: 'fuente' }); assert.equal((await ana.wait('play', m => m.op === 'discover')).xp, 0, 'una sola vez');
  ana.tell({ t: 'play', op: 'discover', id: 'kiosco' }); assert.equal((await ana.wait('play', m => m.op === 'discover')).reason, 'lejos', 'hay que estar ahí');
  ana.tell({ t: 'profile', op: 'get' }); const pr = (await ana.wait('profile', m => m.op === 'get')).profile;
  assert.equal(pr.xp, DISCOVER_XP); assert.equal(LANDMARKS.length, 8);
});
