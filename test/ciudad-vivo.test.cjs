'use strict';
// Ciudad ICADEM 2.0 «Mundo vivo» · Entrega A: monedas, inventario, mascotas, casa y aguas frescas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openServer } = require('./helpers/ciudad-server.cjs');
const root = path.join(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);

test('monedas: separadas de la XP, premios únicos una vez y tope diario de práctica', async () => {
  const { COINS, earn, spend, emptyCoinbook, activityCoins } = await load('ciudad/js/economy/coins.js');
  const p = { coins: 0, xp: 500, coinbook: emptyCoinbook() }, day = Date.parse('2026-11-14T18:00:00Z');
  assert.equal(earn(p, 'logro:x', 10, { once: true }, day), 10);
  assert.equal(earn(p, 'logro:x', 10, { once: true }, day), 0, 'un premio único no se paga dos veces');
  let total = 0; for (let i = 0; i < 40; i++) total += earn(p, 'juego:memoria', 10, { capped: true }, day);
  assert.equal(total, COINS.dailyCap, 'la práctica tiene tope diario');
  assert.equal(earn(p, 'juego:memoria', 10, { capped: true }, day + 86400000), 10, 'al día siguiente vuelve');
  assert.equal(earn(p, 'agua', 3, { daily: true }, day), 3); assert.equal(earn(p, 'agua', 3, { daily: true }, day + 1000), 0);
  const before = p.coins; assert.equal(spend(p, 'compra', before + 1, day), false); assert.equal(p.coins, before, 'sin saldo no se cobra nada');
  assert.equal(spend(p, 'compra', 5, day), true); assert.equal(p.xp, 500, 'comprar nunca toca la XP');
  assert.deepEqual([activityCoins(100), activityCoins(45), activityCoins(-3)], [10, 5, 0]);
});

test('catálogos: razas, accesorios por especie, tiendas y casa inicial válida', async () => {
  const { BREEDS, SPECIES, slotFits, PET_SLOTS, breedAvailable, shapePetName } = await load('ciudad/js/pets/pet-catalog.js');
  const { ITEMS, SHOPS, STARTER_ITEMS, checkDrinkSteps, drinkSteps, FLAVORS } = await load('ciudad/js/economy/catalog.js');
  const { DEFAULT_HOME, checkLayout } = await load('ciudad/js/home/home-rules.js');
  const { emptyVivo } = await load('ciudad/js/vivo/vivo-rules.js');
  assert.equal(new Set(BREEDS.map(b => b.id)).size, BREEDS.length, 'ids únicos');
  for (const b of BREEDS) { assert.ok(SPECIES[b.species], b.id); assert.ok(b.free || b.price > 0 || b.unlock, b.id + ' tiene forma de obtenerse'); }
  const count = s => BREEDS.filter(b => b.species === s).length;
  assert.ok(count('perro') >= 12 && count('gato') >= 11 && count('ave') >= 8 && count('fantastico') >= 5, 'variedad inicial por especie');
  assert.ok(BREEDS.filter(b => b.free).length >= 6, 'un jugador nuevo tiene varias mascotas gratis');
  assert.ok(BREEDS.filter(b => b.free).every(b => breedAvailable(b, {})));
  assert.equal(slotFits('leash', 'golden'), true); assert.equal(slotFits('leash', 'siames'), false, 'la correa es para perros');
  assert.equal(slotFits('scarf', 'dragon-pequeno'), false); assert.equal(slotFits('hat', 'perico'), true);
  for (const i of ITEMS) { assert.ok(SHOPS[i.shop], i.id); if (i.slot) assert.ok(PET_SLOTS[i.slot], i.id); assert.ok(Number.isInteger(i.price) && i.price >= 0, i.id); }
  assert.equal(new Set(ITEMS.map(i => i.id)).size, ITEMS.length);
  const inv = emptyVivo().inv; assert.ok(STARTER_ITEMS.every(id => inv[id] >= 1));
  assert.equal(checkLayout(DEFAULT_HOME, inv).ok, true, 'la casa inicial es válida con el inventario inicial');
  assert.equal(shapePetName('  Firulais!! '), 'Firulais'); assert.equal(shapePetName('x'), '');
  for (const f of FLAVORS) assert.equal(checkDrinkSteps(f.id, drinkSteps(f.id)), true, f.id);
  assert.equal(checkDrinkSteps('horchata', ['agua', 'vaso', 'arroz', 'canela', 'azucar', 'hielo', 'servir']), false, 'el orden importa');
  assert.equal(checkDrinkSteps('jamaica', ['vaso', 'agua', 'azucar', 'flor-jamaica', 'hielo', 'servir']), true, 'los ingredientes en cualquier orden');
});

test('casa: no se sale del espacio, no tapa la puerta, no encima muebles y solo usa lo que tienes', async () => {
  const { checkLayout, HOME } = await load('ciudad/js/home/home-rules.js');
  const inv = { sillon: 1, silla: 2, 'alfombra-redonda': 1, 'cuadro-paisaje': 1 }, L = items => checkLayout({ wall: 'menta', floor: 'talavera', items }, inv);
  assert.equal(L([{ item: 'sillon', x: 3, z: 2, r: 1 }]).ok, true);
  assert.equal(L([{ item: 'sillon', x: 5.9, z: 2, r: 0 }]).reason, 'fuera');
  assert.equal(L([{ item: 'silla', x: 0, z: -4.4, r: 0 }]).reason, 'puerta', 'la entrada queda libre');
  assert.equal(L([{ item: 'silla', x: 1, z: 1 }, { item: 'silla', x: 1.2, z: 1.1 }]).reason, 'encimado');
  assert.equal(L([{ item: 'silla', x: 1, z: 1 }, { item: 'silla', x: 2, z: 1 }, { item: 'silla', x: 3, z: 1 }]).reason, 'no-lo-tienes');
  assert.equal(L([{ item: 'alfombra-redonda', x: 3, z: 2 }, { item: 'sillon', x: 3, z: 2 }]).ok, true, 'las alfombras van debajo');
  const wall = L([{ item: 'cuadro-paisaje', x: 3, z: 4.6 }]); assert.deepEqual([wall.ok, wall.layout.items[0].z, wall.layout.items[0].r], [true, HOME.maxZ, 2], 'el cuadro se ajusta a la pared');
  assert.equal(L([{ item: 'cuadro-paisaje', x: 0.2, z: -4.8 }]).reason, 'puerta');
  assert.equal(L([{ item: 'cama-doble', x: 0, z: 2 }]).reason, 'no-lo-tienes');
  assert.equal(checkLayout({ wall: 'neon', floor: 'talavera', items: [] }, inv).reason, 'formato');
  assert.equal(L(Array.from({ length: 41 }, () => ({ item: 'silla', x: 0, z: 0 }))).reason, 'demasiados');
});

test('reglas de Mundo vivo: compras idempotentes, adopción, accesorios, comida y aguas frescas', async () => {
  const v = await load('ciudad/js/vivo/vivo-rules.js');
  const { DRINK_PRICE, drinkSteps } = await load('ciudad/js/economy/catalog.js');
  const p = { xp: 0, play: {}, missions: {}, discovered: [], ...v.emptyVivo() }, now = Date.parse('2026-11-14T18:00:00Z');
  assert.equal(p.coins, 100);
  const b1 = v.applyVivo(p, 'buy', { item: 'correa-roja', rid: 'compra-0001' }, { now });
  assert.deepEqual([b1.ok, b1.spent, p.coins, p.inv['correa-roja']], [true, 25, 75, 1]);
  assert.equal(v.applyVivo(p, 'buy', { item: 'correa-roja', rid: 'compra-0001' }, { now }).duplicate, true, 'el mismo toque no cobra dos veces');
  assert.equal(p.coins, 75);
  assert.equal(v.applyVivo(p, 'buy', { item: 'correa-roja', rid: 'compra-0002' }, { now }).reason, 'ya-lo-tienes');
  assert.equal(v.applyVivo(p, 'buy', { item: 'collar-basico', rid: 'compra-0003' }, { now }).reason, 'no-se-vende');
  assert.equal(v.applyVivo(p, 'buy', { item: 'inventado', rid: 'compra-0004' }, { now }).reason, 'no-existe');
  assert.equal(v.applyVivo(p, 'buy', { item: 'cama-doble', rid: 'compra-0005' }, { now }).reason, 'sin-monedas');
  const g = v.applyVivo(p, 'buy', { item: 'premio-galleta', qty: 3, rid: 'compra-0006' }, { now }); assert.deepEqual([g.ok, p.inv['premio-galleta'], p.coins], [true, 3, 60]);
  assert.equal(v.applyVivo(p, 'buy', { item: 'premio-galleta', qty: 50, rid: 'compra-0007' }, { now }).reason, 'cantidad');
  // adopción
  assert.equal(v.applyVivo(p, 'adopt', { breed: 'golden', name: 'Sol', rid: 'adopta-001' }, { now }).reason, 'bloqueado', 'el golden se gana con nivel 3');
  assert.equal(v.applyVivo(p, 'adopt', { breed: 'mestizo-canela', name: 'idiota', rid: 'adopta-002' }, { now }).reason, 'nombre', 'el nombre pasa por el filtro del chat');
  const a = v.applyVivo(p, 'adopt', { breed: 'mestizo-canela', name: 'Canelita', rid: 'adopta-003' }, { now });
  assert.deepEqual([a.ok, a.pet.name, a.pet.acc.collar, p.activePet, a.spent], [true, 'Canelita', 'collar-basico', a.pet.id, 0]);
  assert.equal(v.applyVivo(p, 'adopt', { breed: 'mestizo-canela', name: 'Otra', rid: 'adopta-004' }, { now }).reason, 'ya-adoptada');
  const cat = v.applyVivo(p, 'adopt', { breed: 'atigrado', name: 'Michi', rid: 'adopta-005' }, { now });
  assert.equal(p.activePet, a.pet.id, 'adoptar otra no cambia la que acompaña');
  // accesorios
  assert.equal(v.applyVivo(p, 'pet', { id: cat.pet.id, acc: { leash: 'correa-roja' } }).reason, 'no-compatible', 'los gatos no usan correa');
  assert.equal(v.applyVivo(p, 'pet', { id: a.pet.id, acc: { leash: 'correa-azul' } }).reason, 'no-lo-tienes');
  assert.equal(v.applyVivo(p, 'pet', { id: a.pet.id, acc: { leash: 'correa-roja', harness: null }, name: 'Canela' }).ok, true);
  assert.deepEqual([p.pets[0].acc.leash, p.pets[0].name], ['correa-roja', 'Canela']);
  assert.equal(v.applyVivo(p, 'pet', { id: cat.pet.id, active: true }).ok, true); assert.equal(p.activePet, cat.pet.id);
  assert.equal(v.applyVivo(p, 'rest', {}).ok, true); assert.equal(p.activePet, null, 'todas se quedan en casa');
  assert.equal(v.applyVivo(p, 'pet', { id: 'm99', active: true }).reason, 'sin-mascota');
  // comida: croquetas gratis; los premios se gastan y deben ser para esa especie
  const f1 = v.applyVivo(p, 'feed', { pet: a.pet.id, food: 'premio-galleta' }, { now });
  assert.deepEqual([f1.ok, f1.coins, p.inv['premio-galleta']], [true, 2, 2]);
  assert.equal(v.applyVivo(p, 'feed', { pet: a.pet.id }, { now: now + 1000 }).coins, 0, 'cuidar paga una vez al día');
  assert.equal(v.applyVivo(p, 'feed', { pet: cat.pet.id, food: 'premio-galleta' }, { now }).reason, 'comida');
  // aguas frescas: preparar bien paga poco una vez al día; pedirla cuesta
  const before = p.coins;
  assert.equal(v.applyVivo(p, 'drink', { flavor: 'jamaica', mode: 'self', steps: ['vaso', 'servir'], rid: 'agua-0001' }, { now }).reason, 'receta');
  const d1 = v.applyVivo(p, 'drink', { flavor: 'jamaica', mode: 'self', steps: drinkSteps('jamaica'), rid: 'agua-0002' }, { now });
  const d2 = v.applyVivo(p, 'drink', { flavor: 'mango', mode: 'self', steps: drinkSteps('mango'), rid: 'agua-0003' }, { now });
  assert.deepEqual([d1.coins, d2.coins, p.coins], [3, 0, before + 3]);
  const d3 = v.applyVivo(p, 'drink', { flavor: 'horchata', mode: 'buy', rid: 'agua-0004' }, { now }); assert.deepEqual([d3.ok, p.coins], [true, before + 3 - DRINK_PRICE]);
  assert.equal(v.applyVivo(p, 'despegar', {}).reason, 'operacion');
  // vista: sin claves internas
  const view = v.vivoView(p); assert.equal('rids' in view || 'keys' in view.coinbook, false);
});

test('migración: los créditos de prueba pasan una vez a monedas sin volver a pagar lo ya pagado', async () => {
  const v = await load('ciudad/js/vivo/vivo-rules.js');
  const { earn } = await load('ciudad/js/economy/coins.js');
  const old = { testCredits: 35, testLedger: [{ key: 'tutorial', amount: 10 }, { key: 'mission:banco-credito-correcto', amount: 15 }] };
  const p = { ...old, ...v.cleanVivo(old) };
  assert.equal(p.coins, 100 + 35);
  assert.equal(earn(p, 'mission:banco-credito-correcto', 15, { once: true }), 0, 'la misión ya pagada no se paga otra vez');
  assert.equal(earn(p, 'tutorial', 10, { once: true }), 0);
  const again = v.cleanVivo({ ...p }); assert.equal(again.coins, p.coins, 'la conversión ocurre una sola vez');
  // datos manipulados al guardar se depuran al leer
  const dirty = v.cleanVivo({ ...p, coins: -50, inv: { 'cama-doble': 3, falso: 9, 'premio-galleta': 500 }, pets: [{ id: 'm1', breed: 'unicornio-falso' }, { id: 'm2', breed: 'pug', name: '<b>x</b>', acc: { leash: 'correa-roja' } }], activePet: 'm1' });
  assert.deepEqual([dirty.coins, dirty.inv.falso, dirty.inv['premio-galleta'], dirty.pets.length, dirty.pets[0].acc.leash, dirty.activePet], [0, undefined, 99, 1, undefined, null]);
});

test('socket real: compras, adopción y casa van a la cuenta; los demás ven la mascota y la correa', async t => {
  const srv = await openServer(t); if (!srv) return t.skip('npm install en _ciudad-server');
  const { encodeState } = await load('ciudad/js/net/network.js');
  const ana = await srv.client('ana-vivo'), beto = await srv.client('beto-vivo');
  assert.equal(ana.welcome.profile.coins, 100); assert.equal('coinbook' in ana.welcome.profile && 'keys' in ana.welcome.profile.coinbook, false);
  for (const [c, x] of [[ana, 0], [beto, 2]]) c.tell({ t: 's', s: encodeState({ scene: 'plaza', x, y: 0, z: 0, yaw: 0 }) });
  await new Promise(r => setTimeout(r, 80));
  const ask = async (c, msg) => { c.tell({ t: 'vivo', ...msg }); return c.wait('vivo', m => m.op === msg.op); };
  const buy = await ask(ana, { op: 'buy', item: 'correa-arcoiris', rid: 'sock-compra-1' });
  assert.deepEqual([buy.ok, buy.spent, buy.profile.coins, buy.profile.inv['correa-arcoiris']], [true, 60, 40, 1]);
  assert.equal((await ask(ana, { op: 'buy', item: 'correa-arcoiris', rid: 'sock-compra-1' })).duplicate, true);
  const adopt = await ask(ana, { op: 'adopt', breed: 'mestizo-negro', name: 'Luna', rid: 'sock-adopta-1' });
  assert.equal(adopt.ok, true);
  const seen = await beto.wait('pet', m => m.pid === ana.welcome.pid);
  assert.deepEqual([seen.pet.breed, 'name' in seen.pet, seen.pet.leash], ['mestizo-negro', false, false], 'los demás ven la raza y los accesorios, no el nombre');
  assert.equal((await ask(ana, { op: 'walk', leash: true })).leash, false, 'sin correa equipada no hay paseo');
  await ask(ana, { op: 'pet', id: adopt.pet.id, acc: { leash: 'correa-arcoiris' } }); await beto.wait('pet');
  assert.equal((await ask(ana, { op: 'walk', leash: true })).leash, true);
  const walk = await beto.wait('pet', m => m.pet && m.pet.leash); assert.equal(walk.pet.acc.leash, 'correa-arcoiris');
  const home = await ask(ana, { op: 'home', layout: { wall: 'lavanda', floor: 'talavera', items: [{ item: 'sillon', x: 3, z: 2, r: 1 }] } });
  assert.deepEqual([home.ok, home.profile.home.wall, home.profile.home.items.length], [true, 'lavanda', 1]);
  assert.equal((await ask(ana, { op: 'home', layout: { wall: 'lavanda', floor: 'talavera', items: [{ item: 'cama-doble', x: 0, z: 2 }] } })).reason, 'casa-no-lo-tienes');
  assert.equal((await ask(ana, { op: 'inventar' })).reason, 'operacion');
  // otro dispositivo: todo viene de la cuenta; quien llega después ve la mascota en la lista
  const ana2 = await srv.client('ana-vivo');
  assert.deepEqual([ana2.welcome.profile.coins, ana2.welcome.profile.pets[0].name, ana2.welcome.profile.home.wall], [40, 'Luna', 'lavanda']);
  const caro = await srv.client('caro-vivo'); caro.tell({ t: 's', s: encodeState({ scene: 'plaza', x: 1, y: 0, z: 1, yaw: 0 }) });
  const inRoster = caro.welcome.roster.find(p => p.pid === ana.welcome.pid); assert.equal(inRoster.pet.breed, 'mestizo-negro');
});

test('socket real: los perfiles infantiles no usan Mundo vivo y el servidor no conoce la cartera real', async t => {
  for (const file of ['ciudad/js/vivo/vivo-rules.js', 'ciudad/js/economy/coins.js', 'ciudad/js/economy/catalog.js', '_ciudad-server/profiles.js', '_ciudad-server/server.js'])
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\s*\/\/.*$/gm, ''), /\/api\/credits|stripe|wallet|monedero|comision/i, file);
  const srv = await openServer(t, { family: true }); if (!srv) return t.skip('npm install en _ciudad-server');
  const papa = await srv.client('papa-vivo');
  papa.tell({ t: 'profile', op: 'family', action: 'add', alias: 'Peque', avatarId: 'explorador', band: '6-8', consent: true });
  const fam = await papa.wait('profile', m => m.op === 'family'); assert.equal(fam.ok, true);
  const ticket = (await (await srv.post('/dev/ticket', { uid: 'papa-vivo', name: 'papa' })).json()).ticket;
  const kid = await srv.client('x', { ticket, kid: fam.family[0].id }); assert.equal(kid.welcome.family.kind, 'infantil');
  assert.equal(kid.welcome.roster.length >= 0 && papa.welcome.roster.every(p => !p.pet), true);
  kid.tell({ t: 'vivo', op: 'buy', item: 'pelota', rid: 'kid-compra-1', n: 1 });
  assert.equal((await kid.wait('vivo')).reason, 'no-disponible');
});
