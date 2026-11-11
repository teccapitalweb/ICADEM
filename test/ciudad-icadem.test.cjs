'use strict';
// Ciudad ICADEM · pruebas de la lógica del prototipo (Fase 1) y de su aislamiento respecto al panel.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, 'ciudad/js', relative)).href);
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('colisiones: el jugador no atraviesa cajas, círculos ni los límites del escenario', async () => {
  const { CollisionWorld } = await load('core/collision.js');
  const w = new CollisionWorld().setBounds(-10, -10, 10, 10).addBox(-1, -1, 1, 1).addCircle(5, 0, 1);
  let p = w.resolve(1.2, 0, 0.5);
  assert.ok(p.x >= 1.5 - 1e-9, 'debe quedar fuera de la caja');
  p = w.resolve(0.2, 0, 0.5);
  assert.ok(Math.abs(p.x) >= 1.5 - 1e-9 || Math.abs(p.z) >= 1.5 - 1e-9, 'si quedó dentro, sale por un lado');
  p = w.resolve(4.6, 0, 0.5);
  assert.ok(Math.hypot(p.x - 5, p.z) >= 1.5 - 1e-9, 'debe quedar fuera del círculo');
  p = w.resolve(50, -50, 0.5);
  assert.deepEqual(p, { x: 9.5, z: -9.5 });
  assert.equal(w.isFree(-6, 6, 0.5), true);
  assert.equal(w.isFree(0, 0, 0.5), false);
  // esquina: nunca termina dentro de la caja tras varios empujes
  for (let i = 0; i < 200; i++) { const a = i / 200 * Math.PI * 2, q = w.resolve(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.4); assert.ok(Math.max(Math.abs(q.x), Math.abs(q.z)) >= 1 - 1e-9); }
});

test('guardado: valores iniciales, niveles, logros sin duplicar y tolerancia a datos dañados', async () => {
  const { Store, STORE_KEY, levelFromXp, defaultState } = await load('core/store.js');
  const s = new Store(memory());
  assert.deepEqual(s.state.economy, { balance: 0, ledger: [] });
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(80).level, 2);
  assert.equal(levelFromXp(79).level, 1);
  assert.equal(s.addXp(200).leveledUp, true);
  assert.equal(s.unlock('a'), true); assert.equal(s.unlock('a'), false);
  assert.equal(s.visit('banco'), true); assert.equal(s.visit('banco'), false);
  const broken = memory(); broken.setItem(STORE_KEY, '{no es json');
  assert.deepEqual(new Store(broken).state, defaultState());
  const other = memory(); other.setItem(STORE_KEY, JSON.stringify({ version: 99, xp: 5000 }));
  assert.equal(new Store(other).state.xp, 0, 'una versión desconocida no se importa');
  const storage = memory(); const a = new Store(storage); a.addXp(50); a.unlock('x');
  const b = new Store(storage); assert.equal(b.state.xp, 50); assert.deepEqual(b.state.achievements, ['x']);
});

test('economía de prueba: idempotente, validada y aislada de la cartera real', async () => {
  const { Store } = await load('core/store.js');
  const { createEconomy, TestEconomy, IcademWalletEconomy, REWARDS } = await load('economy/economy.js');
  const eco = createEconomy(new Store(memory()), 'test');
  assert.ok(eco instanceof TestEconomy); assert.equal(eco.isTest, true);
  const first = await eco.grant({ key: 'mission:x', amount: 15, reason: 'r' });
  const again = await eco.grant({ key: 'mission:x', amount: 15, reason: 'r' });
  assert.deepEqual([first.granted, first.balance, again.granted, again.duplicate, again.balance], [true, 15, false, true, 15]);
  const parallel = await Promise.all([1, 2, 3, 4].map(() => eco.grant({ key: 'tutorial', amount: 10 })));
  assert.equal(parallel.filter(r => r.granted).length, 1, 'llamadas simultáneas acreditan una sola vez');
  assert.equal(await eco.getBalance(), 25);
  for (const bad of [{ key: '', amount: 5 }, { key: 'a', amount: -5 }, { key: 'b', amount: 0 }, { key: 'c', amount: NaN }, { key: 'd', amount: 9999 }]) {
    assert.equal((await eco.grant(bad)).granted, false);
  }
  assert.equal(await eco.getBalance(), 25);
  assert.equal((await eco.history()).every(e => e.test === true), true);
  assert.throws(() => createEconomy(new Store(memory()), 'real'));
  await assert.rejects(() => new IcademWalletEconomy().grant({ key: 'k', amount: 1 }));
  assert.deepEqual([REWARDS.tutorial.amount, REWARDS['banco-credito-correcto'].amount], [10, 15]);
});

test('misión del banco: las cuentas del crédito son correctas', async () => {
  const m = await load('missions/bank-credit-logic.js');
  assert.ok(Math.abs(m.monthlyPayment(120000, 0.24, 24) - 6344.53) < 0.01);
  assert.equal(m.monthlyPayment(1200, 0, 12), 100);
  const byId = Object.fromEntries(m.analyzeAll().map(a => [a.id, a]));
  assert.deepEqual([byId.expres.fits, byId.pyme.fits, byId.comodo.fits], [false, true, true]);
  assert.ok(byId.pyme.totalCost < byId.expres.totalCost && byId.pyme.totalCost < byId.comodo.totalCost);
  assert.ok(byId.comodo.payment < byId.pyme.payment, 'la cuota más baja no es la más barata');
  assert.ok(Math.abs(byId.pyme.totalCost - (6494.53 * 24 + 2400)) < 1);
  assert.equal(m.bestProposalId(), 'pyme');
  assert.ok(m.CLIENT.income - m.CLIENT.expenses > m.CLIENT.maxPayment, 'el tope cabe en lo que le sobra');
});

test('misión del banco: la calificación se reconstruye de lo que hizo el jugador', async () => {
  const m = await load('missions/bank-credit-logic.js');
  const full = { talked: true, documents: ['solicitud', 'flujo'], proposals: ['expres', 'pyme', 'comodo'], simulated: ['expres', 'pyme', 'comodo'], compared: true };
  assert.equal(m.evaluate({ ...full, choice: 'pyme', reasons: ['costo', 'capacidad'] }).score, 100);
  assert.equal(m.evaluate({ ...full, choice: 'pyme', reasons: ['costo'] }).passed, true);
  const cara = m.evaluate({ ...full, choice: 'comodo', reasons: ['cuota'] });
  assert.equal(cara.passed, false); assert.equal(cara.breakdown.decision, 25);
  const impagable = m.evaluate({ ...full, choice: 'expres', reasons: ['rapidez'] });
  assert.equal(impagable.breakdown.decision, 0); assert.equal(impagable.passed, false);
  // intentos incompletos o manipulados no son válidos
  for (const bad of [
    { ...full, choice: 'pyme', reasons: [] },
    { ...full, choice: 'pyme', reasons: ['costo', 'capacidad', 'cuota'] },
    { ...full, documents: ['solicitud'], choice: 'pyme', reasons: ['costo'] },
    { ...full, proposals: ['pyme', 'pyme', 'pyme'], choice: 'pyme', reasons: ['costo'] },
    { ...full, compared: false, choice: 'pyme', reasons: ['costo'] },
    { ...full, simulated: ['pyme'], choice: 'pyme', reasons: ['costo'] },
    { ...full, talked: false, choice: 'pyme', reasons: ['costo'] },
    { ...full, choice: 'inventada', reasons: ['costo'] },
    { choice: 'pyme', reasons: ['costo', 'capacidad'] },
    {}
  ]) assert.equal(m.evaluate(bad).valid, false);
  const steps = []; const a = m.newAttempt();
  steps.push(m.nextStep(a)); a.talked = true; steps.push(m.nextStep(a)); a.documents = ['solicitud', 'flujo']; steps.push(m.nextStep(a));
  a.proposals = ['expres', 'pyme', 'comodo']; steps.push(m.nextStep(a)); a.simulated = ['expres', 'pyme', 'comodo']; steps.push(m.nextStep(a)); a.compared = true; steps.push(m.nextStep(a));
  a.choice = 'pyme'; steps.push(m.nextStep(a)); a.reasons = ['costo']; steps.push(m.nextStep(a));
  assert.deepEqual(steps, ['talk', 'documents', 'proposals', 'simulate', 'compare', 'choose', 'justify', 'done']);
});

test('red: formato de estado listo para multijugador y sin jugadores simulados', async () => {
  const { encodeState, decodeState, OfflineAdapter, StateSync, NET_TICK_HZ } = await load('net/network.js');
  const s = { scene: 'plaza', x: 12.345, y: 0.5, z: -7.891, yaw: -1, anim: 'run' };
  const d = decodeState(JSON.parse(JSON.stringify(encodeState(s))));
  assert.equal(d.scene, 'plaza'); assert.equal(d.anim, 'run');
  assert.ok(Math.abs(d.x - s.x) < 0.006 && Math.abs(d.z - s.z) < 0.006);
  assert.ok(d.yaw >= 0 && d.yaw < Math.PI * 2);
  assert.equal(decodeState(['plaza', 'x', 0, 0, 0, 0]), null); assert.equal(decodeState(null), null);
  const adapter = new OfflineAdapter(); const sent = []; adapter.sendState = e => sent.push(e);
  let joins = 0; adapter.on('join', () => joins++); await adapter.connect();
  assert.equal(adapter.isOnline, false);
  const sync = new StateSync(adapter); let x = 0;
  for (let i = 0; i < 120; i++) { x += 0.05; sync.update(1 / 60, () => ({ ...s, x })); }
  assert.ok(sent.length >= NET_TICK_HZ * 2 - 2 && sent.length <= NET_TICK_HZ * 2 + 1, `2 s a ${NET_TICK_HZ} Hz, se enviaron ${sent.length}`);
  for (let i = 0; i < 12; i++) sync.update(1 / 60, () => ({ ...s, x })); // se envía la última posición
  const before = sent.length;
  for (let i = 0; i < 120; i++) sync.update(1 / 60, () => ({ ...s, x }));
  assert.equal(sent.length, before, 'quieto no envía nada');
  assert.equal(joins, 0, 'sin conexión no aparecen jugadores');
});

test('contenido: 10 avatares (solo el Explorador disponible) y 11 edificios con puerta accesible', async () => {
  const { AVATARS, avatarById } = await load('characters/catalog.js');
  assert.equal(AVATARS.length, 10); assert.equal(new Set(AVATARS.map(a => a.id)).size, 10);
  assert.equal(AVATARS.filter(a => a.available).length, 10, 'los diez comparten esqueleto y se pueden usar al desbloquearlos');
  assert.equal(avatarById('no-existe').id, 'explorador');
  const { BUILDINGS, doorPoint, footprint } = await load('world/buildings.js');
  assert.equal(BUILDINGS.length, 11);
  assert.deepEqual(BUILDINGS.filter(b => b.status === 'open').map(b => b.id).sort(), ['banco', 'casa', 'tribunal']);
  for (const b of BUILDINGS) {
    const p = doorPoint(b, 2), f = footprint(b);
    assert.ok(Math.abs(p.x - b.x) > f.w / 2 || Math.abs(p.z - b.z) > f.d / 2, b.id + ': la puerta queda fuera del edificio');
    assert.ok(Math.abs(p.x) < 46 && Math.abs(p.z) < 46, b.id + ': dentro de los límites');
    assert.ok(Math.hypot(p.x, p.z) < Math.hypot(b.x, b.z), b.id + ': la fachada mira hacia la plaza');
    for (const o of BUILDINGS) if (o !== b) { const g = footprint(o); assert.ok(Math.abs(b.x - o.x) >= (f.w + g.w) / 2 || Math.abs(b.z - o.z) >= (f.d + g.d) / 2, `${b.id} se encima con ${o.id}`); }
  }
});

test('aislamiento: el juego no llama servicios de ICADEM ni toca créditos reales', () => {
  const files = walk(path.join(root, 'ciudad/js')).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 18, 'el juego está repartido en módulos, no en un archivo gigante');
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8'), name = path.relative(root, file);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // El único módulo que abre una conexión es el adaptador multijugador, y solo en pruebas locales.
    if (!/net[\\/]ws-adapter\.js$/.test(file)) assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, name + ' no debe hacer llamadas de red');
    else { assert.doesNotMatch(code, /XMLHttpRequest|sendBeacon|EventSource/, name + ' solo puede usar el socket del juego'); assert.deepEqual(code.match(/\bfetch\s*\([^,]*/g), ["fetch(http + '/dev/ticket'"], 'la única petición es al emisor de boletos del entorno de pruebas'); }
    assert.doesNotMatch(code, /firebase|firestore|railway\.app|Authorization|getIdToken|ICADEMPlatform|UserState/i, name + ' no debe tocar la sesión ni los servicios del panel');
    if (!/core[\\/]store\.js$/.test(file)) assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB/, name + ': solo store.js guarda datos');
    assert.ok(src.length < 40000, name + ' es demasiado grande para un solo módulo');
  }
  const main = read('ciudad/js/main.js');
  assert.match(main, /const mpUrl = LOCAL \? params\.get\('mp'\) : null;/, 'el multijugador solo se activa en pruebas locales');
  assert.match(main, /127\\\.0\\\.0\\\.1\|localhost/, 'y solo contra un servidor en la misma máquina');
  const html = read('ciudad/index.html');
  assert.match(html, /créditos de prueba/); assert.match(html, /Prototipo · Fase 1/);
  assert.doesNotMatch(html, /firebase|railway|stripe/i);
});

test('panel: la pestaña Ciudad ICADEM se integra con cambios mínimos', () => {
  const panel = read('vip-panel.html'), bridge = read('js/icadem-ciudad.js'), sw = read('sw.js');
  assert.match(panel, /class="nav-item" data-section="ciudad"[^>]*>[\s\S]{0,120}?Ciudad ICADEM/);
  assert.match(panel, /class="mobile-drawer__item" data-section="ciudad"[^>]*>[\s\S]{0,120}?Ciudad ICADEM/);
  assert.match(panel, /ciudad:\(c\)=>window\.ICADEMCiudad\.mount\(c\)/);
  assert.match(panel, /<symbol id="i-city"/);
  assert.match(panel, /css\/icadem-ciudad\.css\?v=\d+/); assert.match(panel, /js\/icadem-ciudad\.js\?v=\d+/);
  assert.doesNotMatch(panel, /mobile-nav__item[^>]+data-section="ciudad"/, 'la barra inferior conserva sus cuatro destinos');
  assert.match(sw, /icadem-ciudad\.js\?v=\d+/); assert.match(sw, /icadem-ciudad\.css\?v=\d+/);
  const code = bridge.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /ICADEMPlatform|credits|localStorage/, 'el puente no toca créditos ni guarda datos');
  assert.deepEqual([...new Set(code.match(/\bfetch\s*\([^,)]*/g))].sort(), ["fetch(server + '/health'", "fetch(server + '/ticket'"].sort(), 'el puente solo habla con el servidor de sesiones configurado');
  assert.match(code, /var CIUDAD_SERVER_URL = '';/, 'el servidor de sesiones sigue apagado en el puente');
  assert.match(code, /\/\^https:\\\/\\\/\[a-z0-9\.-\]\+\(:\\d\+\)\?\$\/i\.test\(url\)/, 'el servidor debe ser https y venir de la configuración del panel');
  for (const m of code.match(/postMessage\(\{[^}]*\}/g)) assert.doesNotMatch(m, /idToken|Authorization|email|uid/, 'al juego nunca se le entrega la sesión: ' + m);
  assert.doesNotMatch(read('vip-panel.html') + read('js/icadem-platform-v2.js'), /ICADEM_CIUDAD_SERVER/, 'el multijugador sigue apagado en producción: nadie configura el servidor');
  assert.match(code, /event\.origin !== window\.location\.origin/, 'solo acepta mensajes del mismo origen');
  assert.match(code, /event\.source !== frame\.contentWindow/, 'solo acepta mensajes del propio juego');
  assert.match(code, /postMessage\(\{ type: 'ciudad:identity', name: playerName\(\) \}, window\.location\.origin\)/, 'solo comparte el nombre visible');
  assert.ok(fs.existsSync(path.join(root, 'assets/ciudad/portada.webp')));
  assert.ok(fs.existsSync(path.join(root, 'ciudad/lib/three.module.min.js')));
});
