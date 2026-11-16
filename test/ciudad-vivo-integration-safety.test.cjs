'use strict';
// Regresiones de integración: estos casos fallaban en el main de PR #75.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openServer } = require('./helpers/ciudad-server.cjs');
const root = path.resolve(__dirname, '..');
const load = p => import(pathToFileURL(path.join(root, p)).href);
async function fixture() {
  const { Profiles, MemoryStorage } = await load('_ciudad-server/profiles.js');
  return new Profiles({ storage: new MemoryStorage(), missions: new Map() });
}
const layout = (home, wall) => ({ ...home, wall, items: home.items.map(e => ({ ...e })) });

test('vivienda CAS: un borrador obsoleto nunca sobrescribe la última casa confirmada', async () => {
  const db = await fixture(), uid = 'qa-home-conflict';
  const a = await db.get(uid), b = await db.get(uid);
  const first = await db.vivo(uid, 'home', { layout: layout(a.home, 'menta'), expectedHomeRevision: a.homeRev });
  assert.equal(first.ok, true);
  assert.equal(first.profile.homeRev, a.homeRev + 1);
  const stale = await db.vivo(uid, 'home', { layout: layout(b.home, 'cielo'), expectedHomeRevision: b.homeRev });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'casa-conflicto');
  assert.deepEqual(stale.profile.home, first.profile.home);
  assert.equal(stale.profile.homeRev, first.profile.homeRev);
  assert.equal(stale.profile.rev, first.profile.rev);
  assert.deepEqual((await db.get(uid)).home, first.profile.home);
});

test('vivienda CAS: dos guardados simultáneos del mismo borrador no se pisan', async () => {
  const db = await fixture(), uid = 'qa-home-simultaneous', before = await db.get(uid);
  const calls = await Promise.all(['menta', 'cielo'].map(wall => db.vivo(uid, 'home', {
    layout: layout(before.home, wall), expectedHomeRevision: before.homeRev
  })));
  assert.equal(calls.filter(r => r.ok).length, 1);
  assert.equal(calls.filter(r => r.reason === 'casa-conflicto').length, 1);
  const saved = await db.get(uid);
  assert.equal(saved.homeRev, before.homeRev + 1);
  assert.equal(saved.rev, before.rev + 1);
  assert.equal(saved.home.wall, calls.find(r => r.ok).profile.home.wall);
});

test('vivienda CAS: dos instancias reevalúan revisión al reintentar una transacción en conflicto (adaptador emulado)', async () => {
  const { Profiles, MemoryStorage } = await load('_ciudad-server/profiles.js');
  // Mismo contrato de revisión que el adaptador Firestore; no se conecta a Firebase.
  class CasStorage extends MemoryStorage {
    async save(uid, profile) {
      const stored = this.map.has(uid) ? JSON.parse(this.map.get(uid)).rev : 0;
      if (stored !== profile.rev - 1) throw Object.assign(new Error('conflicto de prueba'), { code: 'conflict' });
      await super.save(uid, profile);
    }
  }
  const storage = new CasStorage(), uid = 'qa-home-independent-processes';
  const a = new Profiles({ storage, missions: new Map() }), b = new Profiles({ storage, missions: new Map() });
  const initial = await a.get(uid);
  const saved = await Promise.all([a, b].map((db, i) => db.vivo(uid, 'home', {
    expectedHomeRevision: initial.homeRev, layout: layout(initial.home, i ? 'cielo' : 'menta')
  })));
  assert.equal(saved.filter(r => r.ok).length, 1);
  assert.equal(saved.filter(r => r.reason === 'casa-conflicto').length, 1);
  assert.equal((await a.get(uid)).homeRev, 1);
});

test('vivienda CAS: una compra o mascota no invalida la revisión de la vivienda', async () => {
  const db = await fixture(), uid = 'qa-home-independent', before = await db.get(uid);
  const bought = await db.vivo(uid, 'buy', { item: 'premio-galleta', rid: 'qa-home-buy-0001' });
  assert.equal(bought.ok, true);
  assert.equal(bought.profile.homeRev, before.homeRev);
  const saved = await db.vivo(uid, 'home', { layout: layout(before.home, 'lavanda'), expectedHomeRevision: before.homeRev });
  assert.equal(saved.ok, true);
  assert.equal(saved.profile.inv['premio-galleta'], 1);
  assert.equal(saved.profile.coins, bought.profile.coins);
});

test('vivienda CAS: perfiles previos usan revisión cero; clientes sin revisión no escriben', async () => {
  const { Profiles, MemoryStorage } = await load('_ciudad-server/profiles.js');
  const storage = new MemoryStorage(), db = new Profiles({ storage, missions: new Map() }), uid = 'qa-home-legacy';
  const old = await db.get(uid); delete old.homeRev;
  await storage.save(uid, old);
  const current = await db.get(uid);
  assert.equal(current.homeRev, 0);
  for (const invalid of [undefined, null, -1, '0', 0.5, NaN]) {
    const denied = await db.vivo(uid, 'home', { layout: layout(current.home, 'cielo'), expectedHomeRevision: invalid });
    assert.equal(denied.reason, 'casa-conflicto');
    assert.equal(denied.profile.rev, current.rev);
  }
  assert.equal((await db.vivo(uid, 'home', { layout: layout(current.home, 'cielo'), expectedHomeRevision: 0 })).ok, true);
});

test('WebSocket real: otra sesión guarda; al reconectar el borrador viejo es rechazado', async t => {
  const srv = await openServer(t); assert.ok(srv, 'instalar dependencias del servidor');
  const a = await srv.client('qa-home-two-sessions'), draft = a.welcome.profile;
  const b = await srv.client('qa-home-two-sessions');
  b.tell({ t: 'vivo', op: 'home', n: 1, layout: layout(b.welcome.profile.home, 'menta'), expectedHomeRevision: b.welcome.profile.homeRev });
  const saved = await b.wait('vivo', m => m.n === 1);
  assert.equal(saved.ok, true);
  const again = await srv.client('qa-home-two-sessions');
  assert.equal(again.welcome.profile.home.wall, 'menta');
  again.tell({ t: 'vivo', op: 'home', n: 2, layout: layout(draft.home, 'cielo'), expectedHomeRevision: draft.homeRev });
  const stale = await again.wait('vivo', m => m.n === 2);
  assert.equal(stale.reason, 'casa-conflicto');
  assert.equal(stale.profile.home.wall, 'menta');
  assert.equal(stale.profile.homeRev, saved.profile.homeRev);
});

async function lostConfirmation(op, payload) {
  const db = await fixture(), { VivoService } = await load('ciudad/js/vivo/vivo-service.js');
  let loseNext = true;
  const sent = [], api = { store: { state: {} }, net: { on() {}, async vivo(action, args) {
    sent.push(structuredClone({ op: action, ...args }));
    const real = await db.vivo('qa-client-recovery', action, args);
    if (loseNext) { loseNext = false; return { ok: false, reason: 'sin-respuesta' }; }
    return real;
  } } };
  const client = new VivoService(api);
  const call = () => op === 'buy' ? client.buy(payload.item, payload.qty) : op === 'adopt' ? client.adopt(payload.breed, payload.name) : client.drink(payload.flavor, payload.mode, payload.steps);
  assert.equal((await call()).reason, 'sin-respuesta');
  const committed = await db.get('qa-client-recovery');
  const retry = await call();
  assert.equal(retry.ok, true);
  assert.equal(retry.duplicate, true, 'el reintento pregunta por la solicitud original');
  assert.deepEqual(sent[1], sent[0]);
  assert.deepEqual(await db.get('qa-client-recovery'), committed, 'sin segundo cobro ni nuevo inventario');
  return { client, db, sent, committed, call };
}

test('recuperación cliente + Profiles real: consumible, adopción y agua conservan rid al reintentar', async () => {
  await lostConfirmation('buy', { item: 'premio-galleta', qty: 2 });
  await lostConfirmation('adopt', { breed: 'mestizo-canela', name: 'Canela' });
  await lostConfirmation('drink', { flavor: 'jamaica', mode: 'buy' });
});

test('recuperación cliente: resolver la duda libera la siguiente compra deliberada', async () => {
  const f = await lostConfirmation('buy', { item: 'premio-galleta', qty: 1 });
  const next = await f.call();
  assert.equal(next.ok, true);
  assert.notEqual(f.sent[2].rid, f.sent[1].rid);
  assert.equal(next.profile.coins, f.committed.coins - 5);
  assert.equal(next.profile.inv['premio-galleta'], 2);
});

test('recuperación cliente: no cambia silenciosamente los datos de una solicitud pendiente', async () => {
  const { VivoService } = await load('ciudad/js/vivo/vivo-service.js');
  const sent = [], client = new VivoService({ store: { state: {} }, net: { on() {}, async vivo(op, args) { sent.push({ op, ...args }); return { ok: false, reason: 'sin-respuesta' }; } } });
  await client.buy('premio-galleta', 1);
  const different = await client.buy('premio-galleta', 3);
  assert.equal(different.reason, 'pendiente-confirmacion');
  assert.equal(sent.length, 1, 'no se envía una compra ambigua de otra cantidad');
});

test('recuperación cliente: sin conexión no borra una solicitud anterior no confirmada', async () => {
  const { VivoService } = await load('ciudad/js/vivo/vivo-service.js');
  const sent = [], reasons = ['sin-respuesta', 'sin-conexion', null];
  const client = new VivoService({ store: { state: {} }, net: { on() {}, async vivo(op, args) { sent.push({ op, ...args }); const reason = reasons.shift(); return reason ? { ok: false, reason } : { ok: true, duplicate: true }; } } });
  await client.buy('premio-galleta'); await client.buy('premio-galleta');
  assert.equal((await client.buy('premio-galleta')).duplicate, true);
  assert.equal(new Set(sent.map(s => s.rid)).size, 1);
});

test('recuperación cliente: reabrir un panel recupera la intención exacta sin recordar sus datos', async () => {
  const db = await fixture(), { VivoService } = await load('ciudad/js/vivo/vivo-service.js');
  let lose = true;
  const client = new VivoService({ store: { state: {} }, net: { on() {}, async vivo(op, payload) {
    const r = await db.vivo('qa-reopen-panel', op, payload);
    if (lose) { lose = false; return { ok: false, reason: 'sin-respuesta' }; }
    return r;
  } } });
  await client.buy('premio-galleta', 3);
  const pending = client.pendingTransactions();
  assert.equal(pending.length, 1);
  assert.deepEqual(pending[0].payload, { item: 'premio-galleta', qty: 3 });
  assert.equal('rid' in pending[0].payload, false);
  pending[0].payload.qty = 10;
  assert.equal(client.pendingTransactions()[0].payload.qty, 3, 'los metadatos expuestos no alteran el intento original');
  const recovered = await client.retryTransaction(pending[0].key);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.duplicate, true);
  assert.equal(recovered.profile.coins, 85);
  assert.equal(recovered.profile.inv['premio-galleta'], 3);
  assert.deepEqual(client.pendingTransactions(), []);
  assert.equal((await client.retryTransaction(pending[0].key)).reason, 'sin-pendiente');
});
