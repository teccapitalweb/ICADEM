'use strict';
// Ciudad ICADEM · perfiles infantiles supervisados (apagados por omisión).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openServer } = require('./helpers/ciudad-server.cjs');
const load = rel => import(pathToFileURL(path.join(__dirname, '..', rel)).href);

test('familia: alias seguro y datos mínimos', async () => {
  const { cleanAlias, AGE_BANDS, KID_MISSIONS, KID_SCENES } = await load('ciudad/js/edu/family.js');
  assert.equal(cleanAlias('  Sofi  '), 'Sofi'); assert.equal(cleanAlias('Leo 2'), 'Leo 2');
  for (const bad of ['a', 'x'.repeat(17), 'ana@correo.com', 'tel 5512345678', 'http://x', '<b>', '']) assert.equal(cleanAlias(bad), null, bad);
  assert.deepEqual(AGE_BANDS.map(b => b[0]), ['6-8', '9-12', '13-17']);
  assert.ok(KID_MISSIONS.length >= 3 && KID_SCENES.includes('park'));
});

test('familia (hub): un perfil infantil solo existe para su familia', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const hub = new Hub({ now: () => 0, salt: 's' });
  const mama = hub.join({ uid: 'mama', name: 'Mamá' }).player, kid = hub.join({ uid: 'mama~k1', name: 'Sofi', minor: true, guardian: 'mama' }).player;
  const extrano = hub.join({ uid: 'x', name: 'Extraño' }).player, otroKid = hub.join({ uid: 'x~k9', name: 'Leo', minor: true, guardian: 'x' }).player;
  const at = (p, x) => { p.state = { scene: 'plaza', x, y: 0, z: 9, yaw: 0, anim: 'idle' }; };
  [mama, kid, extrano, otroKid].forEach((p, i) => at(p, i));
  assert.equal(hub.visible(extrano, kid), false, 'un adulto desconocido no ve al menor');
  assert.equal(hub.visible(kid, extrano), false, 'ni el menor a él');
  assert.equal(hub.visible(otroKid, kid), false, 'ni otros menores');
  assert.equal(hub.visible(mama, kid), false, 'fuera de su equipo familiar, nadie lo ve');
  assert.equal(hub.roster(extrano.instance, extrano).some(p => p.name === 'Sofi'), false, 'no aparece en listas');
  assert.equal(hub.createCode(kid, {}).reason, 'no-permitido', 'un menor no genera códigos');
  assert.equal(hub.createRoom(kid, { mission: null }).reason, 'no-permitido');
  assert.equal(hub.invite(kid, extrano.pid).reason, 'no-permitido');
  assert.deepEqual(hub.friendsView(kid), []);
  const ajeno = hub.createCode(extrano, {}).code;
  assert.equal(hub.redeemCode(kid, ajeno).reason, 'no-permitido', 'un menor no entra con el código de un desconocido');
  const propio = hub.createCode(mama, {}).code;
  assert.equal(hub.redeemCode(kid, propio).ok, true, 'sí con el de su adulto responsable');
  assert.equal(hub.visible(mama, kid), true); assert.equal(hub.visible(kid, mama), true, 'dentro del equipo familiar se ven');
  assert.equal(hub.redeemCode(extrano, hub.createCode(mama, {}).code).reason, 'no-permitido', 'un desconocido no entra a un equipo con menores');
  assert.equal(hub.joinRoom(extrano, mama.room.code).reason, 'no-permitido');
  const say = hub.say(kid, 'hola'); assert.deepEqual(say.ok ? say.to.map(p => p.name) : [], ['Mamá'], 'las frases del menor solo llegan a su familia');
});

test('familia (socket real): apagada por omisión; activa, exige consentimiento y aísla al menor', async t => {
  const off = await openServer(t); if (!off) return t.skip('npm install en _ciudad-server');
  const a = await off.client('mama');
  a.tell({ t: 'profile', op: 'family', action: 'add', alias: 'Sofi', band: '6-8', consent: true });
  assert.equal((await a.wait('profile', m => m.op === 'family')).reason, 'familia-desactivada');
  assert.deepEqual(a.welcome.family, { enabled: false, kind: 'adulto' });
  const tk = (await (await off.post('/dev/ticket', { uid: 'mama', name: 'mama' })).json()).ticket;
  const kidTry = await off.client('x', { ticket: tk, kid: 'k1' }).catch(() => null);
  assert.equal(kidTry, null, 'sin modo familiar no se entra como perfil infantil');

  const on = await openServer(t, { family: true });
  const mama = await on.client('mama');
  mama.tell({ t: 'profile', op: 'family', action: 'add', alias: 'Sofi', band: '6-8' });
  assert.equal((await mama.wait('profile', m => m.op === 'family')).reason, 'falta-consentimiento');
  mama.tell({ t: 'profile', op: 'family', action: 'add', alias: 'sofi@correo.com', band: '6-8', consent: true });
  assert.equal((await mama.wait('profile', m => m.op === 'family')).reason, 'alias-invalido');
  mama.tell({ t: 'profile', op: 'family', action: 'add', alias: 'Sofi', band: '6-8', consent: true });
  const fam = await mama.wait('profile', m => m.op === 'family'); assert.equal(fam.ok, true); const kidId = fam.family[0].id;
  assert.equal(JSON.stringify(fam.family).includes('consentAt'), false);
  const ticket = (await (await on.post('/dev/ticket', { uid: 'mama', name: 'mama' })).json()).ticket;
  const sofi = await on.client('ignorado', { ticket, kid: kidId });
  assert.equal(sofi.welcome.name, 'Sofi'); assert.deepEqual(sofi.welcome.family, { enabled: true, kind: 'infantil' });
  assert.deepEqual(sofi.welcome.friends, []);
  const extrano = await on.client('extrano');
  assert.equal(extrano.welcome.roster.some(p => p.name === 'Sofi'), false, 'el desconocido no la ve en la lista');
  sofi.tell({ t: 'friends', op: 'invite', pid: extrano.welcome.pid }); assert.equal((await sofi.wait('friends')).ok, false);
  sofi.tell({ t: 'profile', op: 'family', action: 'list' }); assert.equal((await sofi.wait('profile', m => m.op === 'family')).reason, 'no-permitido');
  // misiones: solo las adecuadas y sin créditos
  sofi.tell({ t: 'profile', op: 'mission', mission: 'banco-credito-correcto', log: [] }); assert.equal((await sofi.wait('profile', m => m.op === 'mission')).reason, 'mision-no-disponible');
  const { ACTIVITIES } = await load('ciudad/js/edu/activities.js');
  const c = ACTIVITIES.matematicas, right = c.solve(3, 'infantil');
  sofi.tell({ t: 'profile', op: 'activity', id: 'matematicas', seed: 3, level: 'infantil', log: right });
  const r = await sofi.wait('profile', m => m.op === 'activity'); assert.deepEqual([r.ok, r.score], [true, 100]); assert.equal(r.profile.testCredits, 0);
  mama.tell({ t: 'profile', op: 'get' }); const mp = await mama.wait('profile', m => m.op === 'get');
  assert.equal(mp.profile.xp, 0, 'el progreso infantil es independiente del adulto');
});
