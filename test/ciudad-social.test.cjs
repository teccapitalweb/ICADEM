'use strict';
// Ciudad ICADEM · progreso en servidor, avatares y equipamiento, amigos, invitaciones y equipos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);

const BANK_LOG = (choice = 'pyme', reasons = ['costo', 'capacidad']) => [{ type: 'talk' }, ...['solicitud', 'flujo'].map(id => ({ type: 'readDocument', payload: { id } })), ...['expres', 'pyme', 'comodo'].flatMap(id => [{ type: 'takeProposal', payload: { id } }, { type: 'simulate', payload: { id } }]), { type: 'compare' }, { type: 'choose', payload: { id: choice } }, { type: 'justify', payload: { reasons } }];

async function makeProfiles(storage) {
  const { Profiles } = await load('_ciudad-server/profiles.js');
  const { defineMission } = await load('ciudad/js/missions/engine.js');
  const { BANK_CREDIT_MISSION } = await load('ciudad/js/missions/bank-credit-logic.js');
  const { COURT_JUDGE_MISSION } = await load('ciudad/js/missions/court-judge-logic.js');
  const { REWARDS } = await load('ciudad/js/economy/economy.js');
  return new Profiles({ storage, rewards: REWARDS, missions: new Map([BANK_CREDIT_MISSION, COURT_JUDGE_MISSION].map(d => [d.id, defineMission(d)])) });
}

test('avatares: diez con un mismo esqueleto, desbloqueo por juego y equipamiento solo estético', async () => {
  const { AVATARS } = await load('ciudad/js/characters/catalog.js');
  const r = await load('ciudad/js/progress/rules.js');
  assert.deepEqual(AVATARS.map(a => a.name), ['Explorador', 'Ejecutivo', 'Científica', 'Ingeniero', 'Médico', 'Agrónomo', 'Chef', 'Veterinario', 'Juez', 'Embajador ICADEM']);
  assert.deepEqual(Object.keys(r.AVATAR_UNLOCKS).sort(), AVATARS.map(a => a.id).sort());
  assert.equal(new Set(AVATARS.map(a => JSON.stringify([a.look.top, a.look.accessories]))).size, 10, 'cada avatar se distingue');
  const fresh = r.emptyProfile();
  assert.deepEqual(AVATARS.filter(a => r.isAvatarUnlocked(a.id, fresh)).map(a => a.id), ['explorador'], 'al empezar solo el gratuito');
  assert.equal(r.isAvatarUnlocked('ejecutivo', { ...fresh, missions: { [r.MISSION_BANK]: { completed: true, bestScore: 85 } } }), true);
  assert.equal(r.isAvatarUnlocked('juez', { ...fresh, missions: { [r.MISSION_BANK]: { completed: true } } }), false);
  assert.equal(r.isAvatarUnlocked('cientifica', { ...fresh, xp: 80 }), true); assert.equal(r.isAvatarUnlocked('veterinario', { ...fresh, xp: 919 }), false);
  assert.equal(r.isAvatarUnlocked('agronomo', { ...fresh, visited: [...r.BUILDING_IDS] }), true);
  assert.equal(r.isAvatarUnlocked('embajador', { ...fresh, missions: { a: { bestScore: 95 }, b: { bestScore: 90 } } }), true);
  assert.equal(r.isAvatarUnlocked('inventado', fresh), false);
  const chef = AVATARS.find(a => a.id === 'chef').look, styled = r.applyCustom(chef, { outfit: 'uva', hat: 'cap' });
  assert.equal(styled.top, 0x8a5fd0); assert.ok(styled.accessories.includes('cap') && !styled.accessories.includes('toque') && styled.accessories.includes('apron'));
  assert.deepEqual(chef.accessories, ['apron', 'toque'], 'el catálogo no se modifica');
  assert.deepEqual(r.cleanCustom({ outfit: '<script>', hat: 'corona', extra: 1 }), { outfit: 'base', hat: 'base' });
});

test('progreso en servidor: el cliente manda acciones y el servidor calcula XP, logros y recompensas de prueba', async () => {
  const profiles = await makeProfiles();
  const r = await load('ciudad/js/progress/rules.js');
  assert.deepEqual(await profiles.get('ana'), { ...r.emptyProfile(), testLedger: undefined, testMoves: 0 }.testLedger === undefined && { v: 1, rev: 0, xp: 0, missions: {}, visited: [], tutorialDone: false, achievements: [], avatarId: 'explorador', custom: { outfit: 'base', hat: 'base' }, testCredits: 0, testMoves: 0 });
  assert.equal((await profiles.completeMission('ana', r.MISSION_BANK, [{ type: 'talk' }, { type: 'justify', payload: { reasons: ['costo'] } }])).reason, 'bitacora-invalida', 'una bitácora que se salta pasos no cuenta');
  assert.equal((await profiles.completeMission('ana', 'inventada', [])).reason, 'mision-desconocida');
  assert.equal((await profiles.completeMission('ana', r.MISSION_BANK, 'x')).ok, false);
  assert.equal((await profiles.setAvatar('ana', 'ejecutivo')).reason, 'avatar-bloqueado');
  const bad = await profiles.completeMission('ana', r.MISSION_BANK, BANK_LOG('expres', ['rapidez']));
  assert.deepEqual([bad.ok, bad.passed, bad.credits, bad.xp], [true, false, 0, 0]);
  const win = await profiles.completeMission('ana', r.MISSION_BANK, BANK_LOG());
  assert.deepEqual([win.score, win.credits, win.xp, win.profile.testCredits, win.profile.xp], [100, 15, 120, 15, 120]);
  assert.deepEqual(win.profile.achievements, ['primera-mision', 'decision-impecable'], 'los logros los deriva el servidor');
  const again = await profiles.completeMission('ana', r.MISSION_BANK, BANK_LOG());
  assert.deepEqual([again.credits, again.xp, again.profile.testCredits, again.profile.missions[r.MISSION_BANK].attempts], [0, 30, 15, 3], 'repetir no duplica créditos de prueba');
  // dos dispositivos cerrando la misma misión a la vez: sigue habiendo una sola recompensa
  const twin = await makeProfiles();
  const both = await Promise.all([twin.completeMission('beto', r.MISSION_BANK, BANK_LOG()), twin.completeMission('beto', r.MISSION_BANK, BANK_LOG())]);
  assert.deepEqual(both.map(x => x.credits).sort(), [0, 15]); assert.equal((await twin.get('beto')).testCredits, 15);
  assert.equal((await profiles.setAvatar('ana', 'ejecutivo', { outfit: 'coral', hat: 'trampa' })).profile.custom.hat, 'base');
  assert.equal((await profiles.visit('ana', 'luna')).ok, false);
  const v1 = await profiles.visit('ana', 'banco'), v2 = await profiles.visit('ana', 'banco');
  assert.equal(v2.profile.xp - (v1.profile.xp - 10), 10, 'un edificio da XP una sola vez');
  const t1 = await profiles.tutorial('ana'), t2 = await profiles.tutorial('ana');
  assert.deepEqual([t1.profile.testCredits, t2.profile.testCredits, t2.profile.rev], [25, 25, t1.profile.rev]);
  assert.equal(JSON.stringify(await profiles.get('ana')).includes('testLedger'), false);
  assert.equal((await profiles.get('otra')).xp, 0, 'cada usuario tiene su propio progreso');
});

test('progreso en servidor: sobrevive a un reinicio y no toca la cartera real', async () => {
  const { JsonFileStorage } = await load('_ciudad-server/profiles.js');
  const r = await load('ciudad/js/progress/rules.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciudad-'));
  const a = await makeProfiles(new JsonFileStorage(dir));
  await a.completeMission('uid-ana', r.MISSION_BANK, BANK_LOG()); await a.setAvatar('uid-ana', 'ejecutivo', { outfit: 'sol', hat: 'none' });
  const b = await makeProfiles(new JsonFileStorage(dir)), p = await b.get('uid-ana');   // "otro dispositivo" tras reiniciar el servidor
  assert.deepEqual([p.xp, p.avatarId, p.custom.outfit, p.missions[r.MISSION_BANK].completed, p.testCredits], [120, 'ejecutivo', 'sol', true, 15]);
  assert.equal(fs.readdirSync(dir).some(f => f.includes('uid-ana')), false, 'el nombre del archivo no expone al usuario');
  fs.rmSync(dir, { recursive: true, force: true });
  for (const file of ['_ciudad-server/profiles.js', '_ciudad-server/server.js', '_ciudad-server/hub.js']) assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\s*\/\/.*$/gm, ''), /credits\/|\/api\/credits|firestore|stripe|wallet/i, file + ' no conoce la cartera real');
});

test('amigos y equipos: solo conexiones mutuas, invitación con respuesta, misma instancia, 2 a 4', async () => {
  const { Hub, LIMITS } = await load('_ciudad-server/hub.js');
  const { encodeState } = await load('ciudad/js/net/network.js');
  const links = { a: ['b', 'c', 'e', 'f', 'g', 'x'], b: ['a'], c: ['a'], e: ['a'], f: ['a'], g: ['a'], d: ['a'] };   // d dice conocer a "a", pero "a" no a d
  let t = 0; const hub = new Hub({ now: () => t, capacity: 3, salt: 'x', connections: async uid => links[uid] || [] });
  const P = {}; for (const uid of ['a', 'b', 'd', 'c', 'e', 'f', 'g']) { P[uid] = hub.join({ uid, name: uid.toUpperCase() }).player; await hub.loadFriends(P[uid]); }
  const { a, b, c, d, e, f, g } = P;
  assert.notEqual(c.instance, a.instance, 'c quedó en otra ciudad (la primera se llenó)');
  hub.state(b, encodeState({ scene: 'plaza', x: 0, y: 0, z: 9.5, yaw: 0, anim: 'idle' }));
  assert.deepEqual(hub.friendsView(a).map(x => [x.name, x.place, x.sameInstance]), [['B', 'plaza', true], ['C', null, false], ['E', null, false], ['F', null, false], ['G', null, false]], 'solo conexiones mutuas que están en la ciudad');
  assert.deepEqual(hub.friendsView(d), [], 'una conexión no correspondida no revela nada');
  assert.equal(hub.invite(d, a.pid).reason, 'no-es-conexion'); assert.equal(hub.invite(a, d.pid).reason, 'no-es-conexion'); assert.equal(hub.invite(a, 'quien-sea').reason, 'no-es-conexion');
  const i1 = hub.invite(a, b.pid).invite; assert.equal(hub.invite(a, b.pid).reason, 'ya-invitado');
  assert.equal(hub.answer(c, i1.id, true).reason, 'invitacion-vencida', 'nadie más puede responder una invitación ajena');
  assert.deepEqual([hub.answer(b, i1.id, false).accepted, a.room], [false, null]);
  assert.equal(hub.answer(b, i1.id, true).reason, 'invitacion-vencida', 'una invitación se responde una vez');
  const i2 = hub.invite(a, b.pid).invite; t += LIMITS.inviteMs; assert.equal(hub.answer(b, i2.id, true).reason, 'invitacion-vencida', 'caduca al minuto');
  const ok = hub.answer(b, hub.invite(a, b.pid).invite.id, true);
  assert.deepEqual([ok.accepted, ok.room.mission, ok.room.host, ok.room.members.size, ok.moved], [true, null, a.pid, 2, null]);
  assert.equal(hub.invite(a, b.pid).reason, 'ya-en-tu-equipo');
  // aceptar desde otra ciudad: entra a la del anfitrión si hay lugar
  assert.equal(hub.answer(c, hub.invite(a, c.pid).invite.id, true).reason, 'instancia-llena');
  hub.remove(d);
  const moved = hub.answer(c, hub.invite(a, c.pid).invite.id, true);
  assert.equal(c.instance, a.instance); assert.ok(moved.moved); assert.equal(a.room.members.size, 3);
  // el equipo elige misión sin deshacerse, y solo su anfitrión
  assert.equal(hub.createRoom(b, { mission: 'tribunal-tu-eres-el-juez' }).reason, 'solo-anfitrion');
  assert.equal(hub.startRoom(a).reason, 'sin-mision');
  const room = hub.createRoom(a, { mission: 'tribunal-tu-eres-el-juez' }).room; assert.equal(room.members.size, 3); assert.equal(hub.setRole(c, 'testigo').ok, true);
  assert.equal(hub.rally(b).reason, 'solo-anfitrion'); assert.deepEqual(hub.rally(a).to.map(p => p.name).sort(), ['A', 'B', 'C']);
  // tope de 4 integrantes
  hub.capacity = 9; assert.equal(hub.answer(e, hub.invite(a, e.pid).invite.id, true).accepted, true); assert.equal(room.members.size, 4);
  assert.equal(hub.invite(a, f.pid).reason, 'equipo-lleno');
  hub.leaveRoom(e); const late = hub.invite(a, f.pid).invite, late2 = hub.invite(a, g.pid).invite;
  assert.equal(hub.answer(f, late.id, true).accepted, true); assert.equal(hub.answer(g, late2.id, true).reason, 'equipo-lleno', 'aunque la invitación sea válida, no entran cinco');
  let n = 0; for (let i = 0; i < 20; i++) if (hub.allow(a, 'invite')) n++; assert.equal(n, 6, 'tope de invitaciones por minuto');
});

test('socket real: el progreso sigue al usuario entre conexiones y la apariencia la dicta el servidor', async t => {
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return t.skip('npm install en _ciudad-server para esta prueba');
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await load('_ciudad-server/server.js');
  const { encodeState } = await load('ciudad/js/net/network.js');
  const app = createServer({ devLogin: true }); const port = await app.listen(), http = 'http://127.0.0.1:' + port; t.after(() => app.close());
  const post = (url, body) => fetch(http + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const connect = async (uid, name, extra = {}) => { const ws = new WebSocket('ws://127.0.0.1:' + port), inbox = []; ws.on('message', m => inbox.push(JSON.parse(m.toString())));
    ws.wait = (type, pred = () => true, ms = 3000) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type && pred(m)); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error('sin ' + type)); setTimeout(poll, 15); })(); });
    ws.tell = m => ws.send(JSON.stringify(m)); await new Promise(r => ws.on('open', r)); ws.tell({ t: 'hello', ticket: (await post('/dev/ticket', { uid, name })).ticket, ...extra }); ws.welcome = await ws.wait('welcome'); return ws; };
  await post('/dev/connect', { a: 'ana', b: 'beto' });
  const ana = await connect('ana', 'Ana', { avatar: 'embajador' });
  assert.equal(ana.welcome.profile.avatarId, 'explorador', 'el avatar que anuncie el cliente se ignora');
  ana.tell({ t: 'profile', op: 'avatar', id: 'juez' }); assert.equal((await ana.wait('profile')).reason, 'avatar-bloqueado');
  ana.tell({ t: 'profile', op: 'mission', mission: 'banco-credito-correcto', log: BANK_LOG() });
  const done = await ana.wait('profile'); assert.deepEqual([done.ok, done.score, done.credits, done.profile.xp], [true, 100, 15, 120]);
  ana.tell({ t: 'profile', op: 'mission', mission: 'banco-credito-correcto', log: [{ type: 'talk' }] }); assert.equal((await ana.wait('profile')).ok, false);
  const beto = await connect('beto', 'Beto'); await ana.wait('join');
  ana.tell({ t: 'profile', op: 'avatar', id: 'ejecutivo', custom: { outfit: 'coral', hat: 'cap' } }); assert.equal((await ana.wait('profile')).profile.avatarId, 'ejecutivo');
  assert.deepEqual(await beto.wait('look'), { t: 'look', pid: ana.welcome.pid, avatar: 'ejecutivo', custom: { outfit: 'coral', hat: 'cap' } }, 'los demás ven el cambio de apariencia');
  // otro dispositivo de la misma cuenta: mismo progreso; la sesión anterior se cierra
  const ana2 = await connect('ana', 'Ana'); assert.equal((await ana.wait('bye')).reason, 'sesion-en-otro-lugar');
  assert.deepEqual([ana2.welcome.profile.xp, ana2.welcome.profile.avatarId, ana2.welcome.profile.missions['banco-credito-correcto'].completed, ana2.welcome.profile.testCredits], [120, 'ejecutivo', true, 15]);
  // amigos e invitación por red
  assert.deepEqual(ana2.welcome.friends.map(f => f.name), ['Beto']);
  const carla = await connect('carla', 'Carla'); assert.deepEqual(carla.welcome.friends, []);
  carla.tell({ t: 'friends', op: 'invite', pid: ana2.welcome.pid }); assert.equal((await carla.wait('friends')).reason, 'no-es-conexion');
  ana2.tell({ t: 'friends', op: 'invite', pid: beto.welcome.pid }); const inv = await beto.wait('invite'); assert.equal(inv.from.name, 'Ana');
  carla.tell({ t: 'friends', op: 'answer', id: inv.id, accept: true }); assert.equal((await carla.wait('friends')).reason, 'invitacion-vencida');
  beto.tell({ t: 'friends', op: 'answer', id: inv.id, accept: true });
  assert.equal((await ana2.wait('invited')).accepted, true);
  const team = await ana2.wait('room', m => m.room && m.room.members.length === 2); assert.deepEqual([team.room.mission, team.room.host], [null, ana2.welcome.pid]);
  beto.tell({ t: 'party', op: 'rally' }); assert.equal((await beto.wait('room', m => m.ok === false)).reason, 'solo-anfitrion');
  ana2.tell({ t: 'party', op: 'rally' }); assert.deepEqual(await beto.wait('party'), { t: 'party', op: 'rally', scene: 'plaza', by: 'Ana' });
  void encodeState; [ana2, beto, carla].forEach(ws => ws.terminate());
});
