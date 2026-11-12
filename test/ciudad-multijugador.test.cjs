'use strict';
// Ciudad ICADEM · servidor de sesiones: identidad firmada, reglas del servidor, salas privadas y socket real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);
const b64 = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

function idTokenFactory(projectId) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  const sign = (claims, header = { alg: 'RS256', kid: 'k1', typ: 'JWT' }, key = privateKey) => { const body = b64(header) + '.' + b64(claims); return body + '.' + crypto.createSign('RSA-SHA256').update(body).sign(key).toString('base64url'); };
  const base = now => ({ iss: 'https://securetoken.google.com/' + projectId, aud: projectId, sub: 'uid-ana', name: 'Ana Torres', iat: Math.floor(now / 1000) - 10, exp: Math.floor(now / 1000) + 3600, auth_time: Math.floor(now / 1000) - 20 });
  return { pem, sign, base, getKeys: async () => ({ k1: pem }) };
}

test('identidad: el token de sesión se verifica con firma, proyecto, emisor y vigencia', async () => {
  const { createFirebaseVerifier } = await load('_ciudad-server/auth.js');
  const now = 1_800_000_000_000, f = idTokenFactory('icadem-pruebas');
  const verify = createFirebaseVerifier({ projectId: 'icadem-pruebas', getKeys: f.getKeys, now: () => now });
  const ok = await verify(f.sign(f.base(now)));
  assert.equal(ok.uid, 'uid-ana'); assert.equal(ok.name, 'Ana Torres');
  const other = idTokenFactory('icadem-pruebas');
  const forged = { ...f.base(now), sub: 'uid-victima' };
  const cases = {
    'otro proyecto': f.sign({ ...f.base(now), aud: 'otro' }), 'otro emisor': f.sign({ ...f.base(now), iss: 'https://ejemplo.test' }),
    vencido: f.sign({ ...f.base(now), exp: Math.floor(now / 1000) - 1 }), 'emitido en el futuro': f.sign({ ...f.base(now), iat: Math.floor(now / 1000) + 600 }),
    'sin usuario': f.sign({ ...f.base(now), sub: '' }), 'firmado con otra llave': other.sign(forged), 'llave desconocida': f.sign(forged, { alg: 'RS256', kid: 'k9' }),
    'alg none': b64({ alg: 'none', kid: 'k1' }) + '.' + b64(forged) + '.', 'HS256 con la llave pública': (() => { const body = b64({ alg: 'HS256', kid: 'k1' }) + '.' + b64(forged); return body + '.' + crypto.createHmac('sha256', f.pem).update(body).digest('base64url'); })(),
    'contenido alterado': (() => { const [h, , s] = f.sign(f.base(now)).split('.'); return [h, b64(forged), s].join('.'); })(), basura: 'no.es.token', vacío: ''
  };
  for (const [name, token] of Object.entries(cases)) assert.equal(await verify(token), null, name);
  assert.equal(await createFirebaseVerifier({ projectId: 'icadem-pruebas', getKeys: async () => { throw new Error('sin red'); } })(f.sign(f.base(Date.now()))), null, 'sin llaves no se confía en nadie');
  assert.throws(() => createFirebaseVerifier({ projectId: '', getKeys: f.getKeys }));
});

test('identidad: los boletos son firmados, breves y de un solo uso', async () => {
  const { TicketAuthority } = await load('_ciudad-server/auth.js');
  let t = 1000; const auth = new TicketAuthority({ secret: 'x'.repeat(32), now: () => t });
  const ticket = auth.issue({ uid: 'uid-ana', name: ' Ana <b>Torres</b> ' });
  assert.deepEqual(auth.redeem(ticket), { uid: 'uid-ana', name: 'Ana bTorres/b' });
  assert.equal(auth.redeem(ticket), null, 'no se puede reutilizar');
  const [body, sig] = auth.issue({ uid: 'uid-ana', name: 'Ana' }).split('.');
  const hacked = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), uid: 'uid-victima' })).toString('base64url');
  assert.equal(auth.redeem(hacked + '.' + sig), null, 'cambiar el usuario invalida la firma');
  assert.equal(new TicketAuthority({ secret: 'y'.repeat(32), now: () => t }).redeem(auth.issue({ uid: 'u', name: 'n' })), null, 'otro secreto no lo acepta');
  const late = auth.issue({ uid: 'u', name: 'n' }); t += 60001; assert.equal(auth.redeem(late), null, 'vence en 60 segundos');
  const resume = auth.issue({ uid: 'u', name: 'n', kind: 'resume' });
  assert.equal(auth.redeem(resume, 'entry'), null, 'un pase de reanudación no sirve como boleto de entrada');
  assert.deepEqual(auth.redeem(resume, 'resume'), { uid: 'u', name: 'n' });
  for (const junk of ['', 'a.b.c', 'solo', null, 'test:ana:Ana']) assert.equal(auth.redeem(junk), null);
  assert.throws(() => new TicketAuthority({ secret: 'corto' })); assert.throws(() => auth.issue({ uid: '', name: 'x' }));
});

test('servidor: instancias, visibilidad por escenario y validación de movimiento', async () => {
  const { Hub, LIMITS } = await load('_ciudad-server/hub.js');
  const { encodeState } = await load('ciudad/js/net/network.js');
  let t = 0; const hub = new Hub({ now: () => t, capacity: 3, salt: 'x' });
  const st = (scene, x, z) => encodeState({ scene, x, y: 0, z, yaw: 0, anim: 'idle' });
  const a = hub.join({ uid: 'a', name: ' Ana <b> ' }).player, b = hub.join({ uid: 'b', name: 'Beto' }).player, c = hub.join({ uid: 'c', name: '' }).player;
  assert.equal(a.name, 'Ana b'); assert.equal(c.name, 'Jugador'); assert.notEqual(a.pid, 'a', 'no se expone el uid');
  assert.equal(new Set([a.instance, b.instance, c.instance]).size, 1);
  assert.notEqual(hub.join({ uid: 'd', name: 'Dana' }).player.instance, a.instance, 'instancia llena → se abre otra');
  for (const p of [a, b, c]) assert.equal(hub.state(p, st('plaza', 0, 9.5)).ok, true);
  assert.deepEqual(hub.snapshotFor(a).map(x => x[0]).sort(), [b.pid, c.pid].sort());
  t += 1000; assert.equal(hub.state(c, st('room', 0, 0)).ok, true);
  assert.deepEqual(hub.snapshotFor(a).map(x => x[0]), [b.pid], 'la habitación es privada'); assert.deepEqual(hub.snapshotFor(c), []);

  // movimiento: el servidor manda
  t += 100; const tp = hub.state(a, st('plaza', 40, 40));
  assert.equal(tp.reason, 'velocidad'); assert.deepEqual(tp.fix.slice(0, 4), ['plaza', 0, 0, 950]);
  assert.equal(hub.state(a, st('plaza', 500, 0)).reason, 'fuera-del-mapa'); assert.equal(hub.state(a, ['luna', 0, 0, 0, 0, 0]).reason, 'formato'); assert.equal(hub.state(a, 'basura').ok, false);
  t += 1000; assert.equal(hub.state(a, st('plaza', 3, 9.5)).ok, true, 'caminar normal sí pasa');
  t += 60000; assert.equal(hub.state(a, st('plaza', -40, -40)).reason, 'velocidad', 'esperar quieto no da derecho a teletransportarse');
  // cambios de escenario: solo por las puertas
  assert.equal(hub.state(c, st('bank', 0, 3.9)).reason, 'transicion', 'de la habitación no se llega directo al banco');
  t += 500; assert.equal(hub.state(a, st('bank', 8, -6)).reason, 'entrada', 'al banco se entra por su puerta');
  assert.equal(hub.state(a, st('bank', 0, 3.9)).ok, true);
  t += 500; assert.equal(hub.state(a, st('plaza', 44, 44)).reason, 'entrada', 'y se sale frente al edificio');
  assert.equal(hub.state(a, st('plaza', -13, -15.6)).ok, true);
  assert.equal(a.rejected, 7);
  // topes por acción
  let passed = 0; for (let i = 0; i < 60; i++) if (hub.allow(a, 's')) passed++;
  assert.equal(passed, LIMITS.actions.s[0]); t += 1000; assert.equal(hub.allow(a, 's'), true);
  let reports = 0; for (let i = 0; i < 20; i++) if (hub.allow(a, 'report')) reports++; assert.equal(reports, 5);

  // frases: lista cerrada, cercanía, ritmo
  t += 2000; hub.state(b, st('plaza', -12, -14));
  assert.equal(hub.say(a, 'insulto libre').ok, false); assert.deepEqual(hub.say(a, 'hola').to.map(p => p.pid), [b.pid]);
  hub.say(a, 'hola'); hub.say(a, 'hola'); assert.equal(hub.say(a, 'hola').reason, 'demasiado-rapido');
  assert.equal(hub.say(c, 'hola').reason, 'sin-audiencia');

  // reconexión: conserva el lugar; el primer estado tras volver solo se valida contra el mapa
  hub.detach(b); assert.equal(hub.snapshotFor(a).length, 0);
  t += LIMITS.resumeMs - 1; assert.equal(hub.sweep().length, 0);
  const back = hub.join({ uid: 'b', name: 'Beto' }); assert.equal(back.resumed, true); assert.equal(back.player, b);
  assert.equal(hub.state(b, st('plaza', 30, 30)).ok, true, 'pudo caminar mientras no tenía red');
  t += 100; assert.equal(hub.state(b, st('plaza', -30, -30)).reason, 'velocidad', 'pero enseguida vuelve a aplicarse la regla');
  hub.detach(b); t += LIMITS.resumeMs; assert.deepEqual(hub.sweep().map(p => p.pid), [b.pid]);
  assert.equal(hub.report(a, c.pid, 'prueba').ok, true); assert.equal(hub.report(a, a.pid).ok, false); assert.equal(hub.report(a, 'nadie').ok, false);
});

test('servidor: salas privadas con código, roles únicos y separación entre salas', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const { encodeState } = await load('ciudad/js/net/network.js');
  const M = 'tribunal-tu-eres-el-juez';
  let t = 0; const hub = new Hub({ now: () => t, salt: 'x' });
  const st = (scene, x, z) => encodeState({ scene, x, y: 0, z, yaw: 0, anim: 'idle' });
  const [a, b, c, d, e, f] = ['a', 'b', 'c', 'd', 'e', 'f'].map(uid => hub.join({ uid, name: uid.toUpperCase() }).player);
  assert.equal(hub.createRoom(a, { mission: 'banco-credito-correcto' }).reason, 'mision-sin-cooperativo');
  const room = hub.createRoom(a, { mission: M }).room;
  assert.match(room.code, /^[A-HJ-NP-Z2-9]{6}$/); assert.equal(room.host, a.pid);
  assert.equal(hub.joinRoom(b, 'ZZZZZZ').reason, 'codigo-invalido'); assert.equal(hub.joinRoom(b, '').reason, 'codigo-invalido');
  assert.equal(hub.joinRoom(b, room.code.toLowerCase()).ok, true, 'el código no distingue mayúsculas');
  assert.equal(hub.setRole(c, 'juez').reason, 'sin-sala', 'quien no está en la sala no puede tocarla');
  assert.equal(hub.setRole(a, 'presidente').reason, 'rol-desconocido');
  assert.equal(hub.setRole(a, 'juez').ok, true); assert.equal(hub.setRole(b, 'juez').reason, 'rol-ocupado');
  assert.equal(hub.setReady(b, true).reason, 'elige-un-rol');
  assert.equal(hub.startRoom(b).reason, 'solo-anfitrion');
  assert.equal(hub.startRoom(a).reason, 'no-todos-listos');
  hub.setRole(b, 'abogadoA'); hub.setReady(a, true); hub.setReady(b, true);
  assert.equal(hub.startRoom(a).reason, 'cooperativo-en-desarrollo', 'la sala se valida completa, pero sin la definición de la misión en el servidor no se inicia');
  assert.equal(room.status, 'espera');
  hub.setRole(a, 'testigo'); assert.equal(hub.setReady(a, true).ok, true); assert.equal(hub.startRoom(a).reason, 'falta-juez');
  const solo = hub.createRoom(c, { mission: M }).room; hub.setRole(c, 'juez'); hub.setReady(c, true); assert.equal(hub.startRoom(c).reason, 'faltan-jugadores');
  hub.joinRoom(d, room.code); hub.joinRoom(e, room.code); assert.equal(hub.joinRoom(f, room.code).reason, 'sala-llena');
  assert.deepEqual(hub.roomView(room).members.map(m => [m.name, m.role, m.ready]), [['A', 'testigo', true], ['B', 'abogadoA', true], ['D', null, false], ['E', null, false]]);
  assert.equal(JSON.stringify(hub.roomView(room)).includes('"uid"'), false, 'la vista de la sala no expone identificadores internos');

  // separación: en el Tribunal solo se ven quienes comparten sala
  for (const p of [a, b, c, f]) { hub.state(p, st('plaza', 13, -15.6)); t += 200; assert.equal(hub.state(p, st('court', 0, 5.6)).ok, true); }
  assert.deepEqual(hub.snapshotFor(a).map(x => x[0]), [b.pid], 'misma sala');
  assert.deepEqual(hub.snapshotFor(c), [], 'otra sala no ve a nadie'); assert.deepEqual(hub.snapshotFor(f), [], 'sin sala tampoco');
  assert.deepEqual(hub.say(a, 'hola').to.map(p => p.pid), [b.pid], 'las frases tampoco cruzan de sala');
  // salir: se libera el rol, cambia el anfitrión y la sala vacía desaparece
  assert.equal(hub.leaveRoom(a), room); assert.equal(room.host, b.pid); assert.equal(hub.setRole(d, 'testigo').ok, true);
  assert.deepEqual(hub.snapshotFor(a), [], 'al salir de la sala deja de ver a sus miembros');
  assert.equal(hub.leaveRoom(c), null); assert.equal(hub.rooms.has(solo.id), false); assert.equal(hub.joinRoom(f, solo.code).reason, 'codigo-invalido');
  hub.remove(b); assert.equal(room.members.has(b.pid), false); assert.equal(room.host, d.pid, 'si el anfitrión se va, la sala no queda huérfana');
});

test('servidor (socket real): solo entra quien trae un boleto firmado; reconexión y salas por red', async t => {
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return t.skip('npm install en _ciudad-server para esta prueba');
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await load('_ciudad-server/server.js');
  const { TicketAuthority, createFirebaseVerifier } = await load('_ciudad-server/auth.js');
  const { encodeState } = await load('ciudad/js/net/network.js');
  const f = idTokenFactory('icadem-pruebas'), ORIGIN = 'http://ok.test';
  assert.throws(() => createServer({ devLogin: false }), /orígenes/); assert.throws(() => createServer({ devLogin: false, origins: [ORIGIN] }), /verificador/);
  const app = createServer({ devLogin: true, origins: [ORIGIN], identity: createFirebaseVerifier({ projectId: 'icadem-pruebas', getKeys: f.getKeys }), authorize: async who => who.uid !== 'uid-vetado' });
  const port = await app.listen(), http = 'http://127.0.0.1:' + port; t.after(() => app.close());
  const post = (url, body, headers = {}) => fetch(http + url, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body || {}) });
  const devTicket = async (uid, name) => (await (await post('/dev/ticket', { uid, name })).json()).ticket;
  const client = (hello, origin = ORIGIN) => new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port, { origin }), inbox = []; ws.on('message', m => inbox.push(JSON.parse(m.toString())));
    ws.wait = (type, ms = 3000, pred = () => true) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type && pred(m)); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error('sin ' + type)); setTimeout(poll, 15); })(); });
    ws.tell = msg => ws.send(JSON.stringify(msg));
    ws.on('open', () => { if (hello) ws.tell({ t: 'hello', ...hello }); resolve(ws); }); ws.on('error', reject);
  });

  // quién puede obtener un boleto
  assert.equal((await post('/ticket', {})).status, 401, 'sin token de sesión no hay boleto');
  assert.equal((await post('/ticket', {}, { authorization: 'Bearer falso' })).status, 401);
  assert.equal((await post('/ticket', {}, { authorization: 'Bearer ' + f.sign({ ...f.base(Date.now()), aud: 'otro' }) })).status, 401);
  assert.equal((await post('/ticket', {}, { authorization: 'Bearer ' + f.sign({ ...f.base(Date.now()), sub: 'uid-vetado' }) })).status, 403, 'identidad válida pero sin acceso al juego');
  const real = await post('/ticket', {}, { authorization: 'Bearer ' + f.sign(f.base(Date.now())) });
  assert.equal(real.status, 200); const realTicket = (await real.json()).ticket;
  assert.equal((await post('/dev/ticket', { uid: 'x', name: 'X' }, { origin: 'http://otro.sitio' })).status, 403, 'origen no permitido');
  assert.equal((await post('/dev/ticket', { uid: '../x', name: 'X' })).status, 400);
  await assert.rejects(client({ ticket: await devTicket('x', 'X') }, 'http://otro.sitio'), 'el socket también exige el origen');

  // el socket no acepta identificadores escritos por el navegador
  for (const hello of [{ token: 'test:ana:Ana' }, { uid: 'uid-ana', name: 'Ana' }, { ticket: 'inventado.firma' }, { ticket: new TicketAuthority().issue({ uid: 'uid-ana', name: 'Ana' }) }, { resume: realTicket }]) {
    const ws = await client(hello); assert.equal((await ws.wait('bye')).reason, 'no-autorizado', JSON.stringify(hello).slice(0, 40)); ws.terminate();
  }
  const ana = await client({ ticket: realTicket, name: 'Soy Otra Persona', uid: 'uid-victima' }), wa = await ana.wait('welcome');
  assert.equal(wa.name, 'Ana Torres', 'el nombre sale del boleto, no de lo que diga el cliente');
  const replay = await client({ ticket: realTicket }); assert.equal((await replay.wait('bye')).reason, 'no-autorizado', 'un boleto robado ya usado no sirve'); replay.terminate();

  const beto = await client({ ticket: await devTicket('beto', 'Beto') }), wb = await beto.wait('welcome');
  assert.equal(wa.instance, wb.instance); assert.deepEqual(wb.roster.map(p => p.name), ['Ana Torres']); assert.equal((await ana.wait('join')).name, 'Beto');
  const st = (scene, x, z, anim = 'idle') => ({ t: 's', s: encodeState({ scene, x, y: 0, z, yaw: 1, anim }) });
  ana.tell(st('plaza', 1, 9.5)); beto.tell(st('plaza', 3, 9.5, 'wave'));
  let snap; for (let i = 0; i < 20; i++) { snap = await ana.wait('snap'); if (snap.list.length) break; }
  assert.deepEqual(snap.list, [[wb.pid, ['plaza', 300, 0, 950, 100, 4]]]);
  beto.tell({ t: 'say', id: 'hola' }); assert.deepEqual(await ana.wait('say'), { t: 'say', pid: wb.pid, id: 'hola' });
  beto.tell({ t: 'say', id: 'texto libre' }); assert.equal((await beto.wait('nosay')).reason, 'frase-desconocida');
  ana.tell(st('plaza', 45, 45, 'run')); assert.equal((await ana.wait('fix')).reason, 'velocidad');
  ana.tell(st('court', 0, 0)); assert.equal((await ana.wait('fix')).reason, 'entrada');
  ana.tell({ t: 'verify', mission: 'tribunal-tu-eres-el-juez', log: [{ type: 'takeCase', payload: { id: 'exp-014' } }, { type: 'rule', payload: { ruling: 'parcial', grounds: ['vidrio'] } }] });
  assert.equal((await ana.wait('verified')).ok, false, 'el servidor reproduce la bitácora del Tribunal y rechaza la que se salta la audiencia');

  // sala de espera por red
  ana.tell({ t: 'room', op: 'create', mission: 'tribunal-tu-eres-el-juez' }); const created = await ana.wait('room');
  assert.equal(created.room.members.length, 1); const code = created.room.code;
  beto.tell({ t: 'room', op: 'role', role: 'juez' }); assert.equal((await beto.wait('room')).reason, 'sin-sala');
  beto.tell({ t: 'room', op: 'join', code: 'AAAAAA' }); assert.equal((await beto.wait('room')).reason, 'codigo-invalido');
  beto.tell({ t: 'room', op: 'join', code }); assert.equal((await beto.wait('room')).room.members.length, 2); assert.equal((await ana.wait('room')).room.members.length, 2);
  ana.tell({ t: 'room', op: 'role', role: 'juez' }); await ana.wait('room'); await beto.wait('room');
  beto.tell({ t: 'room', op: 'role', role: 'juez' }); assert.equal((await beto.wait('room', 3000, m => m.ok === false)).reason, 'rol-ocupado');
  beto.tell({ t: 'room', op: 'role', role: 'abogadoA' }); beto.tell({ t: 'room', op: 'ready', ready: true }); ana.tell({ t: 'room', op: 'ready', ready: true });
  await ana.wait('room', 3000, m => m.room && m.room.members.every(x => x.ready));
  beto.tell({ t: 'room', op: 'start' }); assert.equal((await beto.wait('room', 3000, m => m.ok === false)).reason, 'solo-anfitrion');
  ana.tell({ t: 'room', op: 'start' }); const started = await ana.wait('coop', 3000, m => m.op === 'start');
  assert.deepEqual([started.mission, started.log.length, started.done], ['tribunal-tu-eres-el-juez', 0, false], 'el intento del equipo lo abre y lo guarda el servidor');
  assert.equal((await beto.wait('coop', 3000, m => m.op === 'start')).session, started.session);

  // reconexión con el pase firmado: recupera lugar y sala; el pase no se reutiliza
  beto.terminate(); assert.equal((await ana.wait('leave')).soft, true);
  const beto2 = await client({ resume: wb.resume }), w2 = await beto2.wait('welcome');
  assert.deepEqual([w2.resumed, w2.pid, w2.instance, w2.room.code], [true, wb.pid, wa.instance, code]);
  assert.notEqual(w2.resume, wb.resume, 'cada conexión recibe un pase nuevo');
  const stale = await client({ resume: wb.resume }); assert.equal((await stale.wait('bye')).reason, 'no-autorizado'); stale.terminate();
  // la misma cuenta en otro lugar sustituye a la sesión anterior
  const beto3 = await client({ ticket: await devTicket('beto', 'Beto') }); await beto3.wait('welcome');
  assert.equal((await beto2.wait('bye')).reason, 'sesion-en-otro-lugar');
  const health = await (await fetch(http + '/health')).json();
  assert.deepEqual([health.ok, health.players, health.rooms], [true, 2, 1]);
  [ana, beto3].forEach(ws => ws.terminate());

  // sin modo de desarrollo, el emisor de pruebas no existe
  const prod = createServer({ devLogin: false, origins: [ORIGIN], identity: async () => null }); const p2 = await prod.listen();
  assert.equal((await fetch(`http://127.0.0.1:${p2}/dev/ticket`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{"uid":"x","name":"X"}' })).status, 404);
  await prod.close();
});

test('red: las entradas de cada escenario coinciden con las puertas del juego', async () => {
  const { SCENE_RULES, COOP_MISSIONS } = await load('ciudad/js/net/scenes.js');
  const { BUILDINGS, doorPoint } = await load('ciudad/js/world/buildings.js');
  const { NET_SCENES } = await load('ciudad/js/net/network.js');
  assert.deepEqual(Object.keys(SCENE_RULES).sort(), [...NET_SCENES].sort());
  const near = (p, list) => list.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 0.2);
  for (const [id, dist] of [['casa', 6.2], ['banco', 7.4], ['tribunal', 7.4]]) assert.ok(near(doorPoint(BUILDINGS.find(b => b.id === id), dist), SCENE_RULES.plaza.entries), id);
  for (const [scene, rule] of Object.entries(SCENE_RULES)) for (const to of rule.links) assert.ok(SCENE_RULES[to].links.includes(scene), `${scene} ↔ ${to}`);
  assert.deepEqual([SCENE_RULES.room.privacy, SCENE_RULES.court.privacy, SCENE_RULES.plaza.privacy], ['private', 'party', 'public']);
  assert.deepEqual(COOP_MISSIONS['tribunal-tu-eres-el-juez'].roles.map(r => r.name), ['Juez', 'Abogado de la actora', 'Abogado del demandado', 'Testigo']);
  assert.deepEqual(COOP_MISSIONS['torre-desafio-equipos'].roles.map(r => r.id), ['finanzas', 'legal', 'operaciones', 'comunicacion']);
});
