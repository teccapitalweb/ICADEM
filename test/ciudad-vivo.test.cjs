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
  for (const i of ITEMS) { assert.ok(SHOPS[i.shop], i.id); if (i.kind === 'petAcc') assert.ok(PET_SLOTS[i.slot], i.id); assert.ok(Number.isInteger(i.price) && i.price >= 0, i.id); }
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

test('montura: vuelo panorámico solo desde el helipuerto, sobre la ruta fija y sin servir de atajo', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const { encodeState } = await load('ciudad/js/net/network.js');
  const { FLIGHTS, flightPoint } = await load('ciudad/js/vivo/flight.js');
  const { SCENE_RULES } = await load('ciudad/js/net/scenes.js');
  let clock = 1_000_000; const hub = new Hub({ now: () => clock });
  const ana = hub.join({ uid: 'ana', name: 'Ana' }).player, f = FLIGHTS.plaza;
  const go = (x, y, z) => hub.state(ana, encodeState({ scene: 'plaza', x, y, z, yaw: 0 }));
  // la ruta empieza y termina en el helipuerto, no sale del mapa y vuela por encima de los edificios
  const b = SCENE_RULES.plaza.bounds; let maxStep = 0, prev = flightPoint('plaza', 0);
  for (let i = 1; i <= 400; i++) { const q = flightPoint('plaza', i / 400); assert.ok(q.x > b.minX && q.x < b.maxX && q.z > b.minZ && q.z < b.maxZ); maxStep = Math.max(maxStep, Math.hypot(q.x - prev.x, q.z - prev.z) / (f.seconds / 400)); prev = q; }
  assert.ok(maxStep < 10, 'la velocidad de la ruta cabe en la del juego'); assert.ok(Math.hypot(flightPoint('plaza', 1).x - f.pad.x, flightPoint('plaza', 1).z - f.pad.z) < 0.1);
  go(0, 0, 9); clock += 100;
  assert.equal(hub.startFlight(ana, 'plaza', true).reason, 'lejos', 'hay que estar en el helipuerto');
  for (let x = 0; x >= f.pad.x; x -= 1) { go(x, 0, Math.max(0, 9 + x * 0.45)); clock += 150; }
  go(f.pad.x, 0, 0); clock += 150;
  assert.equal(hub.startFlight(ana, 'plaza', false).reason, 'sin-dragon');
  assert.equal(go(f.pad.x, 12, 0).reason, 'fuera-del-mapa', 'sin vuelo autorizado no se sube');
  clock += 150; go(f.pad.x, 0, 0); clock += 150;
  const start = hub.startFlight(ana, 'plaza', true); assert.deepEqual([start.ok, start.seconds], [true, f.seconds]);
  assert.equal(hub.startFlight(ana, 'plaza', true).ok, false, 'un vuelo a la vez');
  // a lo largo de la ruta se acepta la altura; fuera de ella, no
  let accepted = 0;
  for (let i = 1; i <= 20; i++) { clock += f.seconds * 1000 / 20 * 0.5; const q = flightPoint('plaza', Math.min(1, (clock - ana.flight.start) / ana.flight.ms)); if (go(q.x, q.y, q.z).ok) accepted++; }
  assert.equal(accepted, 20, 'el servidor sigue al dragón por la ruta');
  assert.equal(hub.discover(ana, 'fuente').reason, 'en-vuelo', 'volando no se descubren sitios');
  assert.equal(hub.playStart(ana, 'carrera').reason, 'en-vuelo', 'ni se empiezan minijuegos');
  const k = (clock - ana.flight.start) / ana.flight.ms, q = flightPoint('plaza', k);
  assert.equal(go(q.x + 15, q.y, q.z).reason, 'vuelo', 'salirse de la ruta se rechaza');
  // aterrizaje
  clock = ana.flight.start + ana.flight.ms + 200; const end = flightPoint('plaza', 1);
  assert.equal(go(end.x, 1.4, end.z).ok, true); assert.equal(ana.flight, null, 'al aterrizar termina el vuelo');
  clock += 200; assert.equal(go(end.x, 10, end.z).reason, 'fuera-del-mapa');
  assert.equal(hub.startFlight(ana, 'plaza', true).reason, 'espera', 'hay una pausa entre vuelos');
});

test('ropa 2.0: 31 piezas nuevas con forma propia; las de pago se compran antes de usarlas (lo aplica el servidor)', async () => {
  const { COSMETIC_OPTIONS, HAT_OPTIONS, applyCustom, cleanCustom } = await load('ciudad/js/progress/rules.js');
  const { createAvatar } = await load('ciudad/js/characters/avatar.js');
  const { avatarById } = await load('ciudad/js/characters/catalog.js');
  const { ITEMS, lockedWear } = await load('ciudad/js/economy/catalog.js');
  const { Profiles, MemoryStorage } = await load('_ciudad-server/profiles.js');
  const fresh = { top: ['printTee', 'shirt', 'blouse', 'sweater', 'sportJacket', 'tank'], bottom: ['shorts', 'bermuda', 'capri', 'joggers', 'wideJeans', 'longSkirt', 'denimSkirt'], shoes: ['sandals', 'ankleBoots', 'runners', 'oxfords'],
    hat: ['sportCap', 'sunHat', 'strawHat'], bag: ['miniBackpack', 'fannyPack'], hairStyle: ['braid', 'afro'], glasses: ['round', 'sun', 'party'], bracelet: ['beads', 'bangle'], headphones: ['over', 'sport'] };
  assert.equal(Object.values(fresh).flat().length, 31);
  const base = createAvatar(applyCustom(avatarById('explorador').look, {})); let baseMeshes = 0; base.group.traverse(o => { if (o.isMesh) baseMeshes++; });
  for (const [slot, ids] of Object.entries(fresh)) for (const id of ids) {
    const list = slot === 'hat' ? HAT_OPTIONS : COSMETIC_OPTIONS[slot]; assert.ok(list.some(o => o.id === id), slot + ':' + id + ' está en el catálogo');
    assert.equal(cleanCustom({ [slot]: id })[slot], id, 'el servidor lo acepta como valor válido');
    const a = createAvatar(applyCustom(avatarById('explorador').look, { [slot]: id })); let verts = 0;
    a.group.traverse(o => { if (o.isMesh) { const arr = o.geometry.attributes.position.array; verts += arr.length; assert.ok(Array.from(arr).every(Number.isFinite), slot + ':' + id); } });
    assert.ok(verts > 0); assert.ok(a.hand && a.perch, 'el esqueleto no cambia');
  }
  const priced = ITEMS.filter(i => i.kind === 'wear'); assert.ok(priced.length >= 20 && priced.every(i => i.price > 0));
  assert.deepEqual(lockedWear({ top: 'printTee', bottom: 'shorts' }, {}), [], 'hay prendas nuevas gratis');
  assert.deepEqual(lockedWear({ top: 'shirt' }, {}), ['top']);
  const profiles = new Profiles({ storage: new MemoryStorage(), missions: new Map() });
  assert.equal((await profiles.setAvatar('lu', 'explorador', { top: 'shirt' }, { customVersion: 2 })).reason, 'prenda-bloqueada', 'sin comprarla no se puede usar');
  assert.equal((await profiles.setAvatar('lu', 'explorador', { top: 'printTee', shoes: 'sandals' }, { customVersion: 2 })).ok, true);
  const buy = await profiles.vivo('lu', 'buy', { item: 'ropa-shirt', rid: 'ropa-compra-1' }); assert.deepEqual([buy.ok, buy.spent], [true, 40]);
  const worn = await profiles.setAvatar('lu', 'explorador', { top: 'shirt', glasses: 'round' }, { customVersion: 2 });
  assert.deepEqual([worn.ok, worn.profile.custom.top, worn.profile.custom.glasses], [true, 'shirt', 'round']);
  assert.equal((await profiles.vivo('lu', 'buy', { item: 'ropa-shirt', rid: 'ropa-compra-2' })).reason, 'ya-lo-tienes');
  assert.equal(base.group.children.length > 0 && baseMeshes > 0, true);
});

test('escenarios nuevos: Paseo comercial y «Mi casa» en el grafo de viajes, con índices de red estables', async () => {
  const { SCENE_RULES, ENTRY_RADIUS } = await load('ciudad/js/net/scenes.js');
  const { NET_SCENES } = await load('ciudad/js/net/network.js');
  assert.deepEqual(NET_SCENES.slice(0, 14), ['room', 'plaza', 'bank', 'court', 'market', 'site', 'hospital', 'vet', 'restaurant', 'greenhouse', 'office', 'tower', 'park', 'distrito'], 'los índices anteriores no cambian');
  assert.deepEqual(NET_SCENES.slice(14), ['comercio', 'casa']);
  for (const [name, r] of Object.entries(SCENE_RULES)) for (const to of r.links) assert.ok(SCENE_RULES[to].links.includes(name), `${name} ↔ ${to}`);
  assert.equal(SCENE_RULES.casa.privacy, 'private', 'nadie más ve tu casa');
  assert.deepEqual(SCENE_RULES.casa.links, ['room']);
  const { COMERCIO_GATE } = await load('ciudad/js/world/comercio.js');
  assert.ok(SCENE_RULES.plaza.entries.some(([x, z]) => Math.hypot(x - COMERCIO_GATE.arrival.x, z - COMERCIO_GATE.arrival.z) <= ENTRY_RADIUS), 'la llegada a la plaza desde el Paseo es una entrada válida');
  const { HOME } = await load('ciudad/js/home/home-rules.js'), b = SCENE_RULES.casa.bounds;
  assert.deepEqual([b.minX, b.maxX, b.minZ, b.maxZ], [HOME.minX, HOME.maxX, HOME.minZ, HOME.maxZ], 'el servidor y el editor usan el mismo espacio');
});

test('diez juegos (2.0): las seis actividades se regeneran con la semilla y el servidor califica la bitácora', async () => {
  const { ACTIVITIES, checkActivity } = await load('ciudad/js/edu/activities.js');
  const { VIVO_ACTIVITIES } = await load('ciudad/js/edu/vivo-activities.js');
  assert.deepEqual(Object.keys(VIVO_ACTIVITIES), ['heroes', 'rescate', 'veterinarios', 'mercado', 'agua', 'emociones']);
  for (const [id, a] of Object.entries(VIVO_ACTIVITIES)) for (const level of a.levels) for (const seed of [1, 99, 123456]) {
    const c = a.build(seed, level), again = a.build(seed, level);
    assert.deepEqual(c, again, id + ': misma semilla, misma partida');
    for (const t of c.tasks) { assert.ok(t.options.length >= 3 && t.options.some(o => o.value === 2), id + ': hay una mejor opción'); for (const o of t.options) assert.ok(o.feedback && o.feedback.length > 10, id + ': cada opción se explica'); }
    const best = c.tasks.map((t, i) => ({ t: i, c: t.options.findIndex(o => o.value === 2) }));
    assert.equal(checkActivity(id, seed, level, best).score, 100, id + ': respuestas mejores = 100');
    const worst = c.tasks.map((t, i) => ({ t: i, c: t.options.findIndex(o => o.value === 0) })).filter(e => e.c >= 0);
    if (!c.tasks.some(t => t.retry) && worst.length === c.tasks.length) assert.ok(checkActivity(id, seed, level, worst).score < 50, id + ': responder mal da poco');
    assert.equal(checkActivity(id, seed, level, best.slice(1)).valid, false, id + ': una bitácora incompleta o fuera de orden no cuenta');
    assert.equal(checkActivity(id, seed, level, best.slice(0, -1)).valid, false);
  }
  // rescate: hay que llegar a la acción segura en cada paso; cada error cuesta y se explica
  const r = VIVO_ACTIVITIES.rescate.build(7, 'normal');
  assert.ok(r.tasks.every(t => t.retry)); assert.match(r.source, /Cruz Roja/);
  assert.ok(r.tasks.some(t => t.options.some(o => o.value === 2 && /911/.test(o.text))), 'pedir ayuda al 911');
  assert.ok(r.tasks.some(t => t.options.some(o => o.value === 2 && /No la muevo/.test(o.text))), 'no mover a una persona inconsciente');
  assert.ok(r.tasks.some(t => t.options.some(o => o.value === 0 && /Lo levanto/.test(o.text))), 'levantarla de inmediato es incorrecto');
  const withErrors = []; r.tasks.forEach((t, i) => { withErrors.push({ t: i, c: t.options.findIndex(o => o.value === 0) }); withErrors.push({ t: i, c: t.options.findIndex(o => o.value === 2) }); });
  assert.equal(checkActivity('rescate', 7, 'normal', withErrors).score, 40);
  // mercado: las cuentas de la opción correcta son exactas
  const m = VIVO_ACTIVITIES.mercado.build(5, 'avanzado'); for (const t of m.tasks.filter(t => /cuánto/i.test(t.title))) { const good = t.options.find(o => o.value === 2); assert.match(t.text, /\$\d/); assert.ok(good); }
  for (const id of Object.keys(VIVO_ACTIVITIES)) assert.ok(ACTIVITIES[id], id + ' está en el registro del servidor');
});

test('juegos de campo (2.0): manzanas, guardianes y expedición validados con posiciones en el servidor', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const { FIELD_GAMES, fieldStart, STAMPS, BINS, TRASH, stampQuestion } = await load('ciudad/js/edu/field-games.js');
  const { questionById } = await load('ciudad/js/edu/questions.js');
  let t = 0; const hub = new Hub({ now: () => t, salt: 's' }), p = hub.join({ uid: 'a', name: 'A' }).player;
  const at = (scene, x, z) => { p.state = { scene, x, y: 0, z, yaw: 0, anim: 'run' }; p.stateAt = t; };
  const act = action => hub.playCheck(p, { action });
  // Manzanas perdidas
  at('park', 0, 0); assert.equal(hub.playStart(p, 'manzanas', 4).reason, 'lejos', 'se juega en la plaza');
  at('plaza', 14, 9); const s = hub.playStart(p, 'manzanas', 4); assert.deepEqual(s.data, fieldStart('manzanas', 4));
  assert.equal(act({ type: 'pick', id: s.data.apples[0].id }).reason, 'habla-primero');
  assert.equal(act({ type: 'talk' }).ok, true);
  assert.equal(act({ type: 'pick', id: s.data.apples[0].id }).reason, 'lejos', 'hay que llegar a la manzana');
  for (const a of s.data.apples) { t += 2500; at('plaza', a.x, a.z); assert.equal(act({ type: 'pick', id: a.id }).ok, true); }
  assert.equal(act({ type: 'deliver' }).reason, 'lejos');
  t += 3000; at('plaza', FIELD_GAMES.manzanas.npc.x, FIELD_GAMES.manzanas.npc.z); const d = act({ type: 'deliver' });
  assert.deepEqual([d.done, d.game], [true, 'manzanas']); assert.ok(d.score >= 40 && d.score <= 100);
  // Guardianes del parque
  at('park', 0, 8); const g = hub.playStart(p, 'guardianes', 11), data = g.data;
  const kind = it => TRASH.find(x => x.id === it.kind), safe = data.items.filter(it => kind(it).type !== 'peligroso'), bad = data.items.filter(it => kind(it).type === 'peligroso');
  assert.equal(bad.length, 1);
  t += 2000; at('park', bad[0].x, bad[0].z); const touch = act({ type: 'pick', id: bad[0].id }); assert.deepEqual([touch.ok, touch.reason], [false, 'peligroso'], 'lo peligroso no se toca'); assert.ok(touch.why.length > 10);
  assert.equal(act({ type: 'report', id: bad[0].id }).ok, true, 'se avisa a un adulto');
  for (const it of safe) {
    t += 2000; at('park', it.x, it.z); assert.equal(act({ type: 'pick', id: it.id }).ok, true);
    const wrong = BINS.find(b => b.id !== kind(it).type); t += 2000; at('park', wrong.x, wrong.z); assert.equal(act({ type: 'bin', bin: wrong.id }).reason, 'otro-bote');
    const right = BINS.find(b => b.id === kind(it).type); t += 1500; at('park', right.x, right.z); assert.equal(act({ type: 'bin', bin: right.id }).ok, true);
  }
  let last; for (const pl of data.plants) { t += 2500; at('park', pl.x, pl.z); last = act({ type: 'water', id: pl.id }); }
  assert.deepEqual([last.done, last.game], [true, 'guardianes']); assert.ok(last.score < 100, 'tocar lo peligroso y equivocarse de bote resta');
  // Expedición del conocimiento (varios escenarios)
  at('plaza', 0, 4); const e = hub.playStart(p, 'expedicion', 21), ed = e.data;
  assert.equal(ed.stamps.length, 4); assert.ok(ed.stamps.every(id => STAMPS.some(x => x.id === id)));
  const st = { tries: {} };
  for (const id of ed.stamps) {
    const sp = STAMPS.find(x => x.id === id), q1 = questionById(ed.questions[id][0]);
    t += 20000; at(sp.scene, sp.x + 0.5, sp.z);
    const wrong = act({ type: 'stamp', id, choice: (q1.answer + 1) % q1.options.length }); assert.equal(wrong.reason, 'incorrecta');
    st.tries[id] = 1; const q2 = stampQuestion(ed, st, id);
    assert.equal(act({ type: 'stamp', id, choice: q2.answer }).ok, true, 'con la respuesta correcta en el lugar, el sello es tuyo');
  }
  at('park', 0, 0); assert.equal(act({ type: 'finish' }).reason, 'lejos', 'se termina en la fuente');
  t += 30000; at('plaza', 0, 3); const fin = act({ type: 'finish' }); assert.deepEqual([fin.done, fin.game], [true, 'expedicion']);
  // demasiado rápido no cuenta
  at('plaza', 14, 9); const q = hub.playStart(p, 'manzanas', 4); act({ type: 'talk' }); for (const a of q.data.apples) { t += 100; at('plaza', a.x, a.z); act({ type: 'pick', id: a.id }); }
  t += 100; at('plaza', FIELD_GAMES.manzanas.npc.x, FIELD_GAMES.manzanas.npc.z); assert.equal(act({ type: 'deliver' }).reason, 'imposible');
});
