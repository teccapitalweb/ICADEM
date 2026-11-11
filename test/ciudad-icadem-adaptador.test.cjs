'use strict';
// Ciudad ICADEM · adaptador de solo lectura sobre los datos de ICADEM (identidad, membresía, conexiones) y guardado del progreso.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);

/** Firestore de mentira con la misma forma que usa el adaptador: collection → doc/where → get/set. */
function fakeDb(data) {
  const log = [];
  const col = name => ({
    doc: id => ({
      async get() { log.push(['get', name, id]); const d = data[name]?.[id]; return { exists: Boolean(d), data: () => d }; },
      async set(value) { log.push(['set', name, id]); (data[name] ||= {})[id] = JSON.parse(JSON.stringify(value)); }
    }),
    where: (field, op, value) => ({ async get() { log.push(['query', name, field, op, value]); assert.equal(op, 'array-contains'); return { docs: Object.values(data[name] || {}).filter(d => Array.isArray(d[field]) && d[field].includes(value)).map(d => ({ data: () => d })) }; } })
  });
  return { collection: col, log, data };
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

test('adaptador: identidad por token verificado, acceso por membresía y conexiones aceptadas de solo lectura', async () => {
  const { createIcademServices } = await load('_ciudad-server/icadem.js');
  const db = fakeDb({
    miembros: { 'uid-ana': { activa: true, email: 'ana@ejemplo.test' }, 'uid-beto': { activa: true, expiraEn: '2020-01-01' }, 'uid-dana': { activo: true } },
    directorio: { 'uid-ana': { nombre: 'Ana <b>Torres', nombrePersonalizado: 'Ana T.' } },
    professionalConnections: {
      k1: { participants: ['uid-ana', 'uid-beto'], from: 'uid-ana', to: 'uid-beto', status: 'accepted' },
      k2: { participants: ['uid-ana', 'uid-carla'], from: 'uid-carla', to: 'uid-ana', status: 'pending' },
      k3: { participants: ['uid-dana', 'uid-ana'], from: 'uid-dana', to: 'uid-ana', status: 'accepted' },
      k4: { participants: ['uid-ana', 'uid-eli'], status: 'blocked' },
      k5: { participants: ['uid-beto', 'uid-dana'], status: 'accepted' }
    }
  });
  const tokens = { 'tok-ana': { uid: 'uid-ana', name: 'Ana Torres', email: 'Ana@Ejemplo.test' }, 'tok-beto': { uid: 'uid-beto', name: '' }, 'tok-nadie': { uid: 'uid-nadie', name: 'Nadie' }, 'tok-admin': { uid: 'uid-admin', name: 'Admin', email: 'admin@icadem.test' } };
  const auth = { async verifyIdToken(t) { if (!tokens[t]) throw new Error('invalid'); return tokens[t]; } };
  const svc = createIcademServices({ db, auth, admins: ['ADMIN@icadem.test'] });
  assert.equal(await svc.identity('falso'), null); assert.equal(await svc.identity(''), null);
  assert.deepEqual(await svc.identity('tok-ana'), { uid: 'uid-ana', name: 'Ana T.', email: 'ana@ejemplo.test' }, 'el nombre sale del Directorio (personalizado) y se limpia');
  assert.equal((await svc.identity('tok-beto')).name, 'Miembro', 'sin nombre en ningún lado');
  assert.equal(await svc.authorize(await svc.identity('tok-ana')), true);
  assert.equal(await svc.authorize(await svc.identity('tok-beto')), false, 'membresía vencida');
  assert.equal(await svc.authorize(await svc.identity('tok-nadie')), false, 'no es miembro');
  assert.equal(await svc.authorize(await svc.identity('tok-admin')), true, 'administrador del panel');
  assert.deepEqual((await svc.connections('uid-ana')).sort(), ['uid-beto', 'uid-dana'], 'solo aceptadas, en cualquier dirección');
  assert.deepEqual(await svc.connections('uid-carla'), [], 'una solicitud pendiente no es conexión');
  assert.deepEqual(await svc.connections('uid-eli'), []);
  assert.equal(db.log.some(e => e[0] === 'set' && e[1] !== 'ciudadProfiles'), false, 'nunca escribe en colecciones de ICADEM');
  assert.equal(db.log.some(e => /credits|notific|forum|professionalProfiles/.test(e[1])), false, 'nunca lee créditos, notificaciones, foro ni perfiles');
  // progreso en su propia colección
  await svc.storage.save('uid-ana', { v: 1, rev: 3, xp: 120, custom: { outfit: 'coral', hat: 'trampa' } });
  const back = await svc.storage.load('uid-ana');
  assert.deepEqual([back.xp, back.custom, typeof back.updatedAt], [120, { outfit: 'coral', hat: 'base' }, 'number']);
  assert.equal(await svc.storage.load('uid-nadie'), null);
  assert.ok(db.data.ciudadProfiles['uid-ana'] && !db.data.miembros['uid-ana'].xp, 'el progreso vive aparte de la membresía');
});

test('adaptador: el servidor de sesiones usa el adaptador para boletos, amigos y perfil', async t => {
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return t.skip('npm install en _ciudad-server');
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await load('_ciudad-server/server.js');
  const { createIcademServices } = await load('_ciudad-server/icadem.js');
  const db = fakeDb({ miembros: { 'uid-ana': { activa: true }, 'uid-beto': { activa: true }, 'uid-carla': { activa: false } }, directorio: { 'uid-ana': { nombre: 'Ana Torres' } },
    professionalConnections: { k1: { participants: ['uid-ana', 'uid-beto'], status: 'accepted' } } });
  const tokens = { A: { uid: 'uid-ana' }, B: { uid: 'uid-beto', name: 'Beto Ruiz' }, C: { uid: 'uid-carla', name: 'Carla' } };
  const svc = createIcademServices({ db, auth: { async verifyIdToken(t) { if (!tokens[t]) throw new Error('x'); return tokens[t]; } } });
  const ORIGIN = 'https://www.icademx.com';
  const app = createServer({ devLogin: false, origins: [ORIGIN], identity: svc.identity, authorize: svc.authorize, connections: svc.connections, storage: svc.storage });
  const port = await app.listen(), http = 'http://127.0.0.1:' + port; t.after(() => app.close());
  const ticket = token => fetch(http + '/ticket', { method: 'POST', headers: { origin: ORIGIN, authorization: 'Bearer ' + token } });
  assert.equal((await ticket('C')).status, 403, 'sin membresía activa no hay boleto');
  assert.equal((await ticket('X')).status, 401);
  const connect = async token => { const { ticket: tk } = await (await ticket(token)).json(); const ws = new WebSocket('ws://127.0.0.1:' + port, { origin: ORIGIN }), inbox = []; ws.on('message', m => inbox.push(JSON.parse(m.toString())));
    ws.wait = (type, pred = () => true) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type && pred(m)); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > 3000) return rej(new Error('sin ' + type)); setTimeout(poll, 15); })(); });
    await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'hello', ticket: tk })); ws.welcome = await ws.wait('welcome'); return ws; };
  const ana = await connect('A'), beto = await connect('B');
  assert.equal(ana.welcome.name, 'Ana Torres', 'nombre del Directorio');
  await ana.wait('join');
  ana.send(JSON.stringify({ t: 'friends', op: 'list' })); assert.deepEqual((await ana.wait('friends', m => m.op === 'list')).list.map(f => f.name), ['Beto Ruiz'], 'la conexión aceptada del Directorio aparece como amigo');
  ana.send(JSON.stringify({ t: 'profile', op: 'visit', id: 'banco' })); assert.equal((await ana.wait('profile')).profile.xp, 10);
  assert.equal(db.data.ciudadProfiles['uid-ana'].xp, 10, 'el progreso quedó en ciudadProfiles');
  assert.deepEqual(Object.keys(db.data.miembros['uid-ana']), ['activa'], 'miembros no se tocó');
  [ana, beto].forEach(ws => ws.terminate());
});
