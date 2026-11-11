'use strict';
// Ciudad ICADEM · adaptador de solo lectura sobre los datos de ICADEM (identidad, membresía, conexiones) y guardado del progreso.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);

/** Firestore de mentira con la misma forma que usa el adaptador: collection → doc/where → get/set y transacciones. */
function fakeDb(data) {
  const log = [];
  const ref = (name, id) => ({
    name, id,
    async get() { log.push(['get', name, id]); const d = data[name]?.[id]; return { exists: Boolean(d), data: () => d }; },
    async set(value) { log.push(['set', name, id]); (data[name] ||= {})[id] = JSON.parse(JSON.stringify(value)); }
  });
  const col = name => ({
    doc: id => ref(name, id),
    async add(value) { log.push(['add', name]); const id = 'auto-' + ((data[name] && Object.keys(data[name]).length) || 0); (data[name] ||= {})[id] = JSON.parse(JSON.stringify(value)); return { id }; },
    where: (field, op, value) => ({ async get() { log.push(['query', name, field, op, value]); assert.equal(op, 'array-contains'); return { docs: Object.values(data[name] || {}).filter(d => Array.isArray(d[field]) && d[field].includes(value)).map(d => ({ data: () => d })) }; } })
  });
  const db = { collection: col, log, data, beforeCommit: null,
    // Como Firestore: si otro proceso escribió durante la transacción, la función se vuelve a ejecutar con datos nuevos.
    async runTransaction(fn) { for (;;) { const writes = []; await fn({ get: r => r.get(), set: (r, v) => writes.push([r, v]) }); if (db.beforeCommit) { const hook = db.beforeCommit; db.beforeCommit = null; await hook(); continue; } for (const [r, v] of writes) await r.set(v); return; } } };
  return db;
}

/** Auth de mentira: verifyIdToken respeta checkRevoked (cuentas deshabilitadas o revocadas fallan). */
function fakeAuth(tokens, users = {}) {
  const calls = [];
  return { calls,
    async verifyIdToken(t, checkRevoked) { calls.push(['verify', t, checkRevoked]); const d = tokens[t]; if (!d) throw new Error('invalid'); if (checkRevoked && (users[d.uid]?.disabled || users[d.uid]?.revoked)) throw Object.assign(new Error('revoked'), { code: 'auth/user-disabled' }); return d; },
    async getUser(uid) { if (!users[uid]) throw new Error('not-found'); return { disabled: false, metadata: { creationTime: users[uid].created || '2025-01-01T00:00:00Z' }, ...users[uid] }; } };
}

test('membresía: mismas reglas de vigencia que el backend', async () => {
  const { membershipActive, membershipEnd } = await load('_ciudad-server/icadem.js');
  const now = Date.parse('2026-11-11T12:00:00Z'), day = 86400000;
  assert.equal(membershipActive({ activa: true }, now), true, 'activa sin fecha');
  assert.equal(membershipActive({ activo: true, expiraEn: new Date(now + day).toISOString() }, now), true);
  assert.equal(membershipActive({ activa: true, expiraEn: new Date(now - day).toISOString() }, now), false, 'vencida');
  assert.equal(membershipActive({ activa: false, expiraEn: new Date(now + day).toISOString() }, now), false, 'no marcada activa');
  assert.equal(membershipActive({ activa: true, esRegalo: true, expiraEn: new Date(now - day).toISOString() }, now), false, 'un regalo también vence');
  assert.equal(membershipActive({ activa: true, stripeSubscriptionId: 'sub_1', fechaProximaRenovacion: new Date(now + 10 * day).toISOString(), expiraEn: new Date(now - day).toISOString() }, now), true, 'con Stripe manda la próxima renovación');
  assert.equal(membershipActive({ activa: true, cancelacionProgramada: true, fechaFinAcceso: new Date(now + day).toISOString() }, now), true, 'cancelación programada: hasta el fin pagado');
  assert.equal(membershipActive({ activa: true, cancelacionProgramada: true, fechaFinAcceso: new Date(now - day).toISOString(), adminAccessUntil: new Date(now + day).toISOString() }, now), true, 'acceso extendido por administración');
  assert.equal(membershipActive({ activa: true, expiraEn: { toDate: () => new Date(now + day) } }, now), true, 'fechas de Firestore (Timestamp)');
  assert.equal(membershipEnd({}), null);
});

test('adaptador: entran cuentas gratuitas y VIP; no las deshabilitadas, en borrado, bloqueadas o fuera del piloto', async () => {
  const { createIcademServices } = await load('_ciudad-server/icadem.js');
  const db = fakeDb({
    miembros: { 'uid-ana': { activa: true, email: 'ana@ejemplo.test' }, 'uid-beto': { activa: true, expiraEn: '2020-01-01' } },
    directorio: { 'uid-ana': { nombre: 'Ana <b>Torres', nombrePersonalizado: 'Ana T.' } },
    _accountDeletions: { 'uid-borrando': { state: 'auth-blocked', requestedAt: '2026-11-10T00:00:00Z' }, 'uid-renacida': { state: 'completed', requestedAt: '2026-01-01T00:00:00Z' } },
    professionalConnections: {
      k1: { participants: ['uid-ana', 'uid-beto'], from: 'uid-ana', to: 'uid-beto', status: 'accepted' },
      k2: { participants: ['uid-ana', 'uid-carla'], from: 'uid-carla', to: 'uid-ana', status: 'pending' },
      k3: { participants: ['uid-dana', 'uid-ana'], from: 'uid-dana', to: 'uid-ana', status: 'accepted' },
      k4: { participants: ['uid-ana', 'uid-eli'], status: 'blocked' },
      k5: { participants: ['uid-beto', 'uid-dana'], status: 'accepted' }
    }
  });
  const tokens = { 'tok-ana': { uid: 'uid-ana', name: 'Ana Torres', email: 'Ana@Ejemplo.test' }, 'tok-beto': { uid: 'uid-beto', name: 'Roberto Carlos Ruiz Pérez', email: 'beto@x.test' },
    'tok-gratis': { uid: 'uid-gratis', name: '', email: 'g@x.test' }, 'tok-off': { uid: 'uid-off', name: 'Off' }, 'tok-borrando': { uid: 'uid-borrando', name: 'B' }, 'tok-renacida': { uid: 'uid-renacida', name: 'R' },
    'tok-admin': { uid: 'uid-admin', name: 'Admin', email: 'admin@icadem.test' }, 'tok-malo': { uid: 'uid-malo', name: 'M', email: 'm@x.test' } };
  const users = { 'uid-off': { disabled: true }, 'uid-borrando': { created: '2024-05-01T00:00:00Z' }, 'uid-renacida': { created: '2026-06-01T00:00:00Z' } };
  const auth = fakeAuth(tokens, users);
  const svc = createIcademServices({ db, auth, admins: ['ADMIN@icadem.test'], blocked: ['uid-malo'] });
  assert.equal(await svc.identity('falso'), null); assert.equal(await svc.identity(''), null);
  assert.ok(auth.calls.every(c => c[2] === true), 'siempre se verifica con checkRevoked');
  assert.deepEqual(await svc.identity('tok-ana'), { uid: 'uid-ana', name: 'Ana T.', email: 'ana@ejemplo.test' }, 'nombre del Directorio (personalizado) y limpio');
  assert.equal((await svc.identity('tok-beto')).name, 'Roberto Carlos', 'sin Directorio: solo dos palabras del nombre de la cuenta');
  assert.equal((await svc.identity('tok-gratis')).name, 'Jugador');
  assert.equal(await svc.identity('tok-off'), null, 'una cuenta deshabilitada no obtiene identidad');
  const ok = async t => svc.authorize(await svc.identity(t));
  const ana = await svc.identity('tok-ana'); assert.equal(await svc.authorize(ana), true); assert.equal(ana.vip, true, 'VIP');
  const beto = await svc.identity('tok-beto'); assert.equal(await svc.authorize(beto), true, 'membresía vencida: juega como gratuito'); assert.equal(beto.vip, false);
  assert.equal(await ok('tok-gratis'), true, 'cuenta registrada sin membresía: juega');
  assert.equal(await ok('tok-borrando'), false, 'cuenta en proceso de borrado');
  assert.equal(await ok('tok-renacida'), true, 'cuenta creada después de un borrado anterior: es nueva');
  assert.equal(await ok('tok-malo'), false, 'bloqueada por moderación del juego');
  assert.equal(await ok('tok-admin'), true);
  // piloto: solo la lista (más administradores)
  const pilot = createIcademServices({ db, auth, admins: ['admin@icadem.test'], pilot: ['ana@ejemplo.test'] });
  assert.equal(await pilot.authorize(await pilot.identity('tok-ana')), true); assert.equal(await pilot.authorize(await pilot.identity('tok-gratis')), false);
  assert.equal(await pilot.authorize(await pilot.identity('tok-admin')), true);
  // conexiones
  assert.deepEqual((await svc.connections('uid-ana')).sort(), ['uid-beto', 'uid-dana'], 'solo aceptadas, en cualquier dirección');
  assert.deepEqual(await svc.connections('uid-carla'), [], 'una solicitud pendiente no es conexión');
  assert.deepEqual(await svc.connections('uid-eli'), []);
  assert.equal(db.log.some(e => e[0] === 'set' && e[1] !== 'ciudadProfiles'), false, 'nunca escribe en colecciones de ICADEM');
  assert.equal(db.log.some(e => /credits|notific|forum|professionalProfiles/.test(e[1])), false, 'nunca lee créditos, notificaciones, foro ni perfiles');
  assert.ok(db.data._accountDeletions['uid-borrando'] && db.data._accountDeletions['uid-renacida'], 'la barrera de borrado se lee, no se archiva ni se borra');
});

test('adaptador: el progreso se guarda en ciudadProfiles con control de escrituras simultáneas', async () => {
  const { createIcademServices } = await load('_ciudad-server/icadem.js');
  const { Profiles } = await load('_ciudad-server/profiles.js');
  const db = fakeDb({ miembros: { 'uid-ana': { activa: true } } });
  const svc = createIcademServices({ db, auth: fakeAuth({}) });
  const profiles = new Profiles({ storage: svc.storage, missions: new Map() });
  await profiles.visit('uid-ana', 'banco');
  assert.deepEqual([db.data.ciudadProfiles['uid-ana'].xp, db.data.ciudadProfiles['uid-ana'].rev, db.data.ciudadProfiles['uid-ana'].uid], [10, 1, 'uid-ana']);
  // otro proceso escribe entre la lectura y la escritura → se detecta y se repite desde una lectura nueva
  db.beforeCommit = async () => { db.data.ciudadProfiles['uid-ana'] = { ...db.data.ciudadProfiles['uid-ana'], rev: 2, xp: 50, visited: ['banco', 'tribunal'] }; };
  const r = await profiles.visit('uid-ana', 'hospital');
  assert.deepEqual([r.profile.xp, r.profile.rev, r.profile.visited], [60, 3, ['banco', 'tribunal', 'hospital']], 'no se pierde lo que escribió el otro proceso');
  await assert.rejects(svc.storage.save('uid-ana', { v: 1, rev: 2, xp: 1 }), /cambió en otro lugar/, 'una escritura con versión vieja se rechaza');
  assert.equal(db.data.ciudadProfiles['uid-ana'].xp, 60);
  assert.deepEqual(Object.keys(db.data.miembros['uid-ana']), ['activa'], 'miembros no se tocó');
});

test('adaptador: el servidor de sesiones usa el adaptador para boletos, amigos y perfil', async t => {
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return t.skip('npm install en _ciudad-server');
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await load('_ciudad-server/server.js');
  const { createIcademServices } = await load('_ciudad-server/icadem.js');
  const db = fakeDb({ miembros: { 'uid-ana': { activa: true } }, directorio: { 'uid-ana': { nombre: 'Ana Torres' } },
    professionalConnections: { k1: { participants: ['uid-ana', 'uid-beto'], status: 'accepted' } } });
  const tokens = { A: { uid: 'uid-ana' }, B: { uid: 'uid-beto', name: 'Beto Ruiz' }, C: { uid: 'uid-carla', name: 'Carla' } };
  const svc = createIcademServices({ db, auth: fakeAuth(tokens, { 'uid-carla': { disabled: true } }) });
  const ORIGIN = 'https://www.icademx.com';
  const app = createServer({ devLogin: false, origins: [ORIGIN], identity: svc.identity, authorize: svc.authorize, connections: svc.connections, storage: svc.storage, maxPlayers: 2 });
  const port = await app.listen(), http = 'http://127.0.0.1:' + port; t.after(() => app.close());
  const ticket = token => fetch(http + '/ticket', { method: 'POST', headers: { origin: ORIGIN, authorization: 'Bearer ' + token } });
  assert.equal((await ticket('C')).status, 401, 'cuenta deshabilitada: no hay boleto');
  assert.equal((await ticket('X')).status, 401);
  const connect = async token => { const { ticket: tk } = await (await ticket(token)).json(); const ws = new WebSocket('ws://127.0.0.1:' + port, { origin: ORIGIN }), inbox = []; ws.on('message', m => inbox.push(JSON.parse(m.toString())));
    ws.wait = (type, pred = () => true) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type && pred(m)); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > 3000) return rej(new Error('sin ' + type)); setTimeout(poll, 15); })(); });
    await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'hello', ticket: tk })); ws.welcome = await ws.wait('welcome'); return ws; };
  const ana = await connect('A'), beto = await connect('B');   // Beto no tiene membresía: juega igual
  assert.equal(ana.welcome.name, 'Ana Torres', 'nombre del Directorio');
  await ana.wait('join');
  ana.send(JSON.stringify({ t: 'friends', op: 'list' })); assert.deepEqual((await ana.wait('friends', m => m.op === 'list')).list.map(f => f.name), ['Beto Ruiz'], 'la conexión aceptada del Directorio aparece como amigo');
  ana.send(JSON.stringify({ t: 'profile', op: 'visit', id: 'banco' })); assert.equal((await ana.wait('profile')).profile.xp, 10);
  assert.equal(db.data.ciudadProfiles['uid-ana'].xp, 10, 'el progreso quedó en ciudadProfiles');
  assert.deepEqual(Object.keys(db.data.miembros['uid-ana']), ['activa'], 'miembros no se tocó');
  // tope global: con 2 conectados, un tercero recibe 503 (ciudad llena)
  tokens.D = { uid: 'uid-dana', name: 'Dana' };
  assert.equal((await ticket('D')).status, 503, 'ciudad llena');
  [ana, beto].forEach(ws => ws.terminate());
});

test('servidor: un fallo de la base no lo tumba, y los topes por dirección usan la IP real de Railway', async t => {
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return t.skip('npm install en _ciudad-server');
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await load('_ciudad-server/server.js');
  let failing = true;
  const storage = { async load() { if (failing) throw Object.assign(new Error('quota'), { code: 'resource-exhausted' }); return null; }, async save() {} };
  const logs = [];
  const app = createServer({ devLogin: true, storage, maxConnsPerIp: 2, trustProxy: true, log: (...a) => logs.push(a.join(' ')) });
  const port = await app.listen(), http = 'http://127.0.0.1:' + port; t.after(() => app.close());
  const ticket = async uid => (await (await fetch(http + '/dev/ticket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, name: uid }) })).json()).ticket;
  const open = (headers = {}) => new Promise(resolve => { const ws = new WebSocket('ws://127.0.0.1:' + port, { headers }); ws.on('open', () => resolve(ws)); ws.on('unexpected-response', (_, res) => resolve({ refused: res.statusCode })); ws.on('error', () => resolve({ refused: 'error' })); });
  const first = msg => new Promise(resolve => { msg.ws.on('message', m => resolve(JSON.parse(m.toString()))); });
  // la base falla al entrar: se responde "no disponible" y el proceso sigue vivo
  const a = await open({ 'x-real-ip': '203.0.113.1' }); const reply = first({ ws: a }); a.send(JSON.stringify({ t: 'hello', ticket: await ticket('ana') }));
  assert.equal((await reply).reason, 'no-disponible');
  assert.ok(logs.some(l => /error .*resource-exhausted/.test(l)), 'el error queda en el registro');
  assert.equal((await (await fetch(http + '/health')).json()).ok, true, 'el servidor sigue respondiendo');
  failing = false;
  // tope por dirección real: 2 sockets por X-Real-IP; otra dirección sí puede
  const s1 = await open({ 'x-real-ip': '198.51.100.7' }), s2 = await open({ 'x-real-ip': '198.51.100.7' }), s3 = await open({ 'x-real-ip': '198.51.100.7' }), other = await open({ 'x-real-ip': '198.51.100.8' });
  assert.ok(s1.send && s2.send, 'dos conexiones desde la misma dirección');
  assert.equal(s3.refused, 401, 'la tercera desde la misma dirección se rechaza');
  assert.ok(other.send, 'otra dirección entra');
  [a, s1, s2, other].forEach(ws => ws.terminate && ws.terminate());
});

test('reportes: saveReport escribe solo en ciudadReports, con uids y motivo recortado', async () => {
  const { createIcademServices } = await load('_ciudad-server/icadem.js');
  const db = fakeDb({});
  const icadem = createIcademServices({ db, auth: fakeAuth({}), now: () => 1700 });
  await icadem.saveReport({ at: 5, fromUid: 'uid-ana', targetUid: 'uid-beto', fromPid: 'p1', targetPid: 'p2', reason: 'x'.repeat(200), instance: 'plaza-1' });
  const guardados = Object.values(db.data.ciudadReports || {});
  assert.equal(guardados.length, 1);
  const r = guardados[0];
  assert.deepEqual([r.fromUid, r.targetUid, r.fromPid, r.targetPid, r.instance, r.at, r.savedAt], ['uid-ana', 'uid-beto', 'p1', 'p2', 'plaza-1', 5, 1700]);
  assert.equal(r.reason.length, 80);
  assert.deepEqual(Object.keys(db.data), ['ciudadReports'], 'no toca ninguna otra colección');
});

test('reportes: un fallo al persistir no rompe el reporte y el hub sigue', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const recibidos = [];
  const hub = new Hub({ onReport: async entry => { recibidos.push(entry); throw new Error('firestore caído'); } });
  const a = hub.join({ uid: 'uid-a', name: 'Ana' }).player, b = hub.join({ uid: 'uid-b', name: 'Beto' }).player;
  assert.equal(hub.report(a, b.pid, 'conducta').ok, true);
  await new Promise(r => setImmediate(r));
  assert.equal(recibidos.length, 1);
  assert.deepEqual([recibidos[0].fromUid, recibidos[0].targetUid], ['uid-a', 'uid-b']);
  assert.equal(recibidos[0].fromPid, a.pid);
  assert.equal(hub.reports.length, 1, 'el reporte queda también en memoria');
});
