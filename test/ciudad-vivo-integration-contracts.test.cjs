'use strict';
// Contratos de PR #75: servidor y persistencia reales en localhost, sin GPU ni credenciales.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openServer } = require('./helpers/ciudad-server.cjs');
const root = path.resolve(__dirname, '..');
const load = p => import(pathToFileURL(path.join(root, p)).href);
async function profiles() {
  const { Profiles, MemoryStorage } = await load('_ciudad-server/profiles.js');
  const storage = new MemoryStorage();
  return { storage, db: new Profiles({ storage, missions: new Map() }) };
}
async function request(ws, op, payload = {}, n = 1) {
  ws.tell({ t: 'vivo', op, ...payload, n });
  return ws.wait('vivo', m => m.n === n && m.op === op);
}

test('autoridad: precio, prendas de pago y rechazo no mutan inventario ni XP', async () => {
  const { db } = await profiles(), uid = 'qa-contract-clothes';
  const before = await db.get(uid);
  const denied = await db.setAvatar(uid, 'explorador', { top: 'shirt' }, { customVersion: 2 });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'prenda-bloqueada');
  assert.equal(denied.profile.rev, before.rev);
  assert.deepEqual(denied.profile.inv, before.inv);
  const buy = await db.vivo(uid, 'buy', { item: 'ropa-shirt', qty: 1, price: -999, coins: 999999, rid: 'qa-shirt-0001' });
  assert.equal(buy.ok, true);
  assert.equal(buy.spent, 40, 'la entrada manipulada no decide el precio');
  assert.equal(buy.profile.coins, before.coins - 40);
  assert.equal(buy.profile.xp, before.xp);
  assert.equal(buy.profile.testCredits, before.testCredits);
  const worn = await db.setAvatar(uid, 'explorador', { top: 'shirt' }, { customVersion: 2 });
  assert.equal(worn.ok, true);
  assert.equal(worn.profile.custom.top, 'shirt');
  const snapshot = await db.get(uid);
  const noMoney = await db.vivo(uid, 'buy', { item: 'cama-doble', rid: 'qa-nomoney-0001' });
  assert.equal(noMoney.reason, 'sin-monedas');
  assert.deepEqual(await db.get(uid), snapshot, 'un rechazo no cobra, concede artículos ni incrementa rev');
});

test('serialización: dos compras simultáneas conservan saldo e inventario; mismo rid cobra una vez', async () => {
  const { db } = await profiles(), uid = 'qa-contract-concurrent';
  const before = await db.get(uid);
  const results = await Promise.all([
    db.vivo(uid, 'buy', { item: 'premio-galleta', qty: 2, rid: 'qa-concurrent-01' }),
    db.vivo(uid, 'buy', { item: 'premio-galleta', qty: 3, rid: 'qa-concurrent-02' })
  ]);
  assert.ok(results.every(r => r.ok));
  const after = await db.get(uid);
  assert.equal(after.inv['premio-galleta'], 5);
  assert.equal(after.coins, before.coins - 25);
  assert.equal(after.rev, before.rev + 2);
  const same = await Promise.all(Array.from({ length: 5 }, () => db.vivo(uid, 'buy', { item: 'premio-pescado', rid: 'qa-same-rid-0001' })));
  assert.equal(same.filter(r => r.changed).length, 1);
  assert.equal(same.filter(r => r.duplicate).length, 4);
  const final = await db.get(uid);
  assert.equal(final.coins, after.coins - 5);
  assert.equal(final.inv['premio-pescado'], 1);
  assert.equal(final.rev, after.rev + 1);
});

test('reenvío exacto: compra, adopción y agua confirmadas sobreviven otra instancia de Profiles', async () => {
  const { db, storage } = await profiles(), uid = 'qa-contract-replay';
  const { Profiles } = await load('_ciudad-server/profiles.js');
  const calls = [
    ['buy', { item: 'premio-galleta', qty: 2, rid: 'qa-replay-buy-0001' }],
    ['adopt', { breed: 'mestizo-canela', name: 'Canela', rid: 'qa-replay-adopt-0001' }],
    ['drink', { flavor: 'horchata', mode: 'buy', rid: 'qa-replay-drink-0001' }]
  ];
  for (const [op, args] of calls) assert.equal((await db.vivo(uid, op, args)).ok, true);
  const saved = await db.get(uid);
  const another = new Profiles({ storage, missions: new Map() });
  for (const [op, args] of calls) {
    const replay = await another.vivo(uid, op, args);
    assert.equal(replay.ok, true);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.changed, false);
  }
  assert.deepEqual(await another.get(uid), saved);
  assert.equal(saved.coins, 85);
  assert.equal(saved.pets.length, 1);
  assert.equal(saved.pets[0].name, 'Canela');
  assert.equal('rids' in saved, false, 'la vista no expone el registro interno');
});

test('persistencia: un UID recupera muebles y mascota; otro UID no recibe sus bienes', async () => {
  const { db, storage } = await profiles(), uid = 'qa-contract-private';
  const { Profiles } = await load('_ciudad-server/profiles.js');
  const adopted = await db.vivo(uid, 'adopt', { breed: 'mestizo-negro', name: 'Nube', rid: 'qa-private-adopt' });
  assert.equal(adopted.ok, true);
  const home = await db.vivo(uid, 'home', { expectedHomeRevision: adopted.profile.homeRev, layout: { wall: 'cielo', floor: 'talavera', items: [{ item: 'sillon', x: 3, z: 2, r: 1 }] } });
  assert.equal(home.ok, true);
  const another = new Profiles({ storage, missions: new Map() });
  const restored = await another.get(uid);
  assert.deepEqual(restored.home, home.profile.home);
  assert.equal(restored.pets[0].name, 'Nube');
  assert.equal(restored.rev, home.profile.rev);
  const outsider = await another.get('qa-contract-outsider');
  assert.equal(outsider.pets.length, 0);
  assert.equal(outsider.home.wall, 'crema');
});

test('WebSocket real: reintentar misma petición tras reconectar recupera sin cobrar dos veces', async t => {
  const srv = await openServer(t);
  assert.ok(srv, 'instalar dependencias de _ciudad-server antes de ejecutar esta prueba');
  const a = await srv.client('qa-ws-recovery');
  const payload = { item: 'premio-galleta', qty: 2, rid: 'qa-ws-buy-recovery' };
  const committed = await request(a, 'buy', payload);
  assert.equal(committed.ok, true);
  // Se descarta la confirmación a nivel de aplicación: no se crea una segunda compra.
  a.terminate();
  const b = await srv.client('qa-ws-recovery');
  assert.equal(b.welcome.profile.coins, 90);
  assert.equal(b.welcome.profile.inv['premio-galleta'], 2);
  const replay = await request(b, 'buy', payload, 2);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.profile.coins, 90);
  assert.equal(replay.profile.inv['premio-galleta'], 2);
});

test('WebSocket real: una segunda sesión sustituye la anterior y lee perfil confirmado', async t => {
  const srv = await openServer(t);
  assert.ok(srv, 'dependencias del servidor requeridas');
  const a = await srv.client('qa-ws-sessions');
  const adopted = await request(a, 'adopt', { breed: 'mestizo-canela', name: 'Moka', rid: 'qa-ws-sessions-adopt' });
  assert.equal(adopted.ok, true);
  const b = await srv.client('qa-ws-sessions');
  const bye = await a.wait('bye');
  assert.equal(bye.reason, 'sesion-en-otro-lugar');
  assert.equal(b.welcome.profile.pets[0].name, 'Moka');
  assert.equal(b.welcome.profile.rev, adopted.profile.rev);
  const changed = await request(b, 'pet', { id: adopted.pet.id, name: 'Nube' }, 2);
  assert.equal(changed.ok, true);
  const again = await srv.client('qa-ws-sessions');
  assert.equal(again.welcome.profile.pets[0].name, 'Nube');
  assert.ok(again.welcome.profile.rev > adopted.profile.rev);
});

test('WebSocket real: avatar manipulado no usa ropa de tienda sin comprarla', async t => {
  const srv = await openServer(t);
  assert.ok(srv, 'dependencias del servidor requeridas');
  const a = await srv.client('qa-ws-unowned');
  a.tell({ t: 'profile', op: 'avatar', id: 'explorador', custom: { top: 'shirt' }, customVersion: 2 });
  const denied = await a.wait('profile', m => m.op === 'avatar');
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'prenda-bloqueada');
  const buy = await request(a, 'buy', { item: 'ropa-shirt', rid: 'qa-ws-shirt-0001', uid: 'qa-ws-other-user', price: 0 });
  assert.equal(buy.spent, 40);
  const other = await srv.client('qa-ws-other-user');
  assert.equal(other.welcome.profile.coins, 100);
  assert.equal(other.welcome.profile.inv['ropa-shirt'], undefined, 'el UID enviado por el navegador no dirige la escritura');
  a.tell({ t: 'profile', op: 'avatar', id: 'explorador', custom: { top: 'shirt' }, customVersion: 2 });
  const allowed = await a.wait('profile', m => m.op === 'avatar');
  assert.equal(allowed.ok, true);
  assert.equal(allowed.profile.custom.top, 'shirt');
});

test('WebSocket real: las seis actividades 2.0 califican bitácoras y recuperan progreso confirmado', async t => {
  const srv = await openServer(t); assert.ok(srv, 'dependencias del servidor requeridas');
  const { VIVO_ACTIVITIES } = await load('ciudad/js/edu/vivo-activities.js');
  const a = await srv.client('qa-ws-choice-games');
  let last = a.welcome.profile, n = 0;
  for (const [id, definition] of Object.entries(VIVO_ACTIVITIES)) {
    const seed = 1337, level = definition.levels[0], content = definition.build(seed, level);
    const log = content.tasks.map((task, i) => ({ t: i, c: task.options.findIndex(o => o.value === 2) }));
    a.tell({ t: 'profile', op: 'activity', id, seed, level, log, n: ++n, score: 999999, xp: 999999, coins: 999999 });
    const real = await a.wait('profile', m => m.op === 'activity' && m.n === n);
    assert.equal(real.ok, true, id);
    assert.equal(real.score, 100, id + ': el servidor calcula el resultado');
    assert.ok(real.xp < 999999 && real.coins < 999999);
    assert.equal(real.profile.play.act[id].best, 100);
    assert.equal(real.profile.play.act[id].plays, 1);
    last = real.profile;
  }
  a.tell({ t: 'profile', op: 'activity', id: 'heroes', seed: 1337, level: 'normal', log: [], n: ++n });
  assert.equal((await a.wait('profile', m => m.n === n)).reason, 'actividad-invalida');
  const b = await srv.client('qa-ws-choice-games');
  assert.deepEqual(b.welcome.profile.play, last.play);
  assert.equal(b.welcome.profile.xp, last.xp);
  assert.equal(b.welcome.profile.coins, last.coins);
  for (const id of ['carrera', 'manzanas', 'guardianes', 'expedicion']) {
    b.tell({ t: 'profile', op: 'activity', id, seed: 1337, level: 'normal', log: [], n: ++n, score: 100 });
    const forged = await b.wait('profile', m => m.n === n);
    assert.equal(forged.ok, false, id + ': el navegador no concede un juego de campo por activity');
    assert.equal(forged.reason, 'actividad-invalida');
  }
});
