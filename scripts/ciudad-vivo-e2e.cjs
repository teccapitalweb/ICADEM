'use strict';
// Ciudad ICADEM 2.0 · Mundo vivo contra el servidor de sesiones (modo de prueba):
// adopción desde el panel, accesorios, paseo con correa visible para otro jugador, pelota,
// reacciones, compras en la tienda y datos que viajan con la cuenta a otro dispositivo.
//
// Uso:  node scripts/ciudad-vivo-e2e.cjs http://127.0.0.1:8769 [carpeta-de-capturas]
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8769').replace(/\/$/, '');
const SHOTS = process.argv[3] || null;
const PORT = Number(process.env.MP_PORT || 8797);
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-vivo-'));
// Perfil de prueba con el Gran dragón ya adoptado (solo en la carpeta temporal del servidor de pruebas).
fs.writeFileSync(path.join(DATA, require('node:crypto').createHash('sha256').update('dev-dani').digest('hex').slice(0, 32) + '.json'), JSON.stringify({
  v: 1, rev: 1, xp: 3000, missions: {}, visited: [], discovered: [], tutorialDone: true, achievements: [], avatarId: 'explorador', avatarChosen: true, custom: {}, testCredits: 0, testLedger: [], play: {}, privacy: { listed: true },
  vivo: 1, coins: 40, coinbook: { keys: ['bienvenida'] }, inv: { 'collar-basico': 1 }, pets: [{ id: 'm1', breed: 'dragon-grande', name: 'Fuego', acc: { collar: 'collar-basico' } }], activePet: 'm1', home: null, rids: []
}));
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name]); console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  →  ' + String(extra).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await sleep(250); } return false; };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '_ciudad-server', 'server.js')], { env: { ...process.env, PORT: String(PORT), CIUDAD_AUTH: 'test', NODE_ENV: 'development', CIUDAD_DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.logs = ''; child.stdout.on('data', d => { child.logs += d; }); child.stderr.on('data', d => { child.logs += d; });
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/servidor de PRUEBA/.test(String(d))) resolve(child); }); child.stderr.on('data', d => reject(new Error(String(d)))); setTimeout(() => reject(new Error('el servidor no arrancó')), 8000); });
}
const walk = (page, x, z, step = 0.45) => page.evaluate(async ([x, z, step]) => {
  const p = window.__ciudad.api.player.position;
  for (let i = 0; i < 400; i++) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.15) break; const s = Math.min(d, step); p.x += dx / d * s; p.z += dz / d * s; window.__ciudad.api.player.yaw = Math.atan2(dx, dz); window.__ciudad.api.player.speed = 4; await new Promise(r => setTimeout(r, 80)); }
  window.__ciudad.api.player.speed = 0; await new Promise(r => setTimeout(r, 250));
}, [x, z, step]);
const click = (page, text) => page.evaluate(t => { const b = [...document.querySelectorAll('#modal button, #more-menu button')].find(x => x.textContent.trim().startsWith(t) && !x.disabled); if (b) b.click(); return Boolean(b); }, text);

(async () => {
  const server = await startServer();
  const browser = await pw.chromium.launch({ args: GL });
  const open = async (uid, name, scene = 'plaza', viewport = { width: 820, height: 520 }) => {
    const ctx = await browser.newContext({ viewport }), page = await ctx.newPage(); page.errs = []; page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', e => page.errs.push(e.message));
    await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&scene=${scene}&avatar=0&tutorial=0&mp=ws://127.0.0.1:${PORT}&uid=${uid}&name=${name}`);
    await until(() => page.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline && window.__ciudad.api.store.state.vivo), 40000);
    await page.evaluate(() => { const a = window.__ciudad.api; a.engine.renderer.setPixelRatio(0.5); a.store.state.settings.npcQuiz = false; });
    return page;
  };
  try {
    const ana = await open('ana', 'Ana');
    ok('el perfil trae Mundo vivo: 100 monedas de bienvenida y la casa inicial', await ana.evaluate(() => { const v = window.__ciudad.api.store.state.vivo; return v.coins === 100 && v.home.items.length > 5 && v.pets.length === 0; }));
    ok('el HUD muestra las monedas del juego', await ana.evaluate(() => document.getElementById('credits-value').textContent === '100' && /monedas/.test(document.querySelector('.credits').textContent)));
    // panel de mascotas desde el menú «Más»
    await ana.evaluate(() => document.getElementById('btn-more').click()); await sleep(200);
    ok('el menú «Más» tiene Mis mascotas y Mi inventario', await click(ana, 'Mis mascotas'));
    await until(() => ana.evaluate(() => !document.getElementById('modal').hidden && /Mis mascotas/.test(document.getElementById('modal-title').textContent)));
    await click(ana, 'Ver mascotas para adoptar'); await sleep(400);
    ok('el catálogo de adopción muestra perros con vista previa 3D', await ana.evaluate(() => document.querySelectorAll('.vp__card').length >= 12 && document.querySelector('.vp__stage canvas') !== null));
    await ana.evaluate(() => { const c = [...document.querySelectorAll('.vp__card')].find(x => /Mestizo negro/.test(x.textContent)); c.click(); });
    await sleep(300);
    await ana.evaluate(() => { const i = document.querySelector('.vp__block input'); i.value = 'Luna'; });
    await shot(ana, '01-adopcion');
    await ana.evaluate(() => document.querySelector('.vp__block .btn--primary').click());
    ok('adoptar una mascota gratis desde el panel', await until(() => ana.evaluate(() => { const v = window.__ciudad.api.store.state.vivo; return v.pets.length === 1 && v.pets[0].name === 'Luna' && v.activePet === v.pets[0].id; })));
    ok('la mascota aparece junto al jugador en la plaza', await until(() => ana.evaluate(() => { const c = window.__ciudad.api.pets.companion; return c && c.visible && c.pos.distanceTo(window.__ciudad.api.player.position) < 4; })));
    // correa: equipar la básica y salir a pasear
    await until(() => ana.evaluate(() => /Correa/.test(document.getElementById('modal-body').textContent)));
    await ana.evaluate(() => { const b = [...document.querySelectorAll('.vp__slot')].find(s => /Correa/.test(s.textContent)).querySelectorAll('button')[1]; b.click(); });
    ok('equipar la correa básica (la valida el servidor)', await until(() => ana.evaluate(() => window.__ciudad.api.store.state.vivo.pets[0].acc.leash === 'correa-basica')));
    await sleep(300); await click(ana, 'Salir a pasear');
    ok('paseo con correa: la correa une al perro con la mano del avatar', await until(() => ana.evaluate(() => { const c = window.__ciudad.api.pets.companion; return window.__ciudad.api.vivo.leash && c.leashed && c.leash && c.leash.visible; })));
    await ana.evaluate(() => document.getElementById('modal-x').click());
    // segundo jugador ve mascota y correa
    const beto = await open('beto', 'Beto');
    await walk(beto, 2, 3);
    ok('otro jugador ve a la mascota de Ana con su correa', await until(() => beto.evaluate(() => { const r = [...window.__ciudad.remotes.map.values()][0]; return r && r.pet && r.pet.breed.id === 'mestizo-negro' && r.pet.leashed; }), 25000), await beto.evaluate(() => [...window.__ciudad.remotes.map.values()].map(r => Boolean(r.pet))));
    // la mascota sigue sin atravesar edificios y la correa nunca se estira de más
    await walk(ana, 0, -12); await walk(ana, 8, -12);
    const d = await ana.evaluate(() => { const c = window.__ciudad.api.pets.companion; return c.pos.distanceTo(window.__ciudad.api.player.position); });
    ok('caminando, el perro sigue al jugador dentro del largo de la correa', d <= 2.3, d);
    await sleep(600); await shot(ana, '02-paseo'); await shot(beto, '03-paseo-visto-por-otro');
    const betoErrs = beto.errs; await beto.context().close();   // libera el render por software (es lento con dos ventanas)
    console.log('      (render por software: ' + await ana.evaluate(() => window.__ciudad.api.engine.fps) + ' cuadros por segundo; el tiempo de juego avanza más lento que el reloj)');
    // pelota: va por ella y la trae
    await ana.evaluate(() => window.__ciudad.api.vivo.walk(false)); await sleep(400);
    ok('lanzar la pelota', await ana.evaluate(() => window.__ciudad.api.pets.throwBall()));
    ok('el perro trae la pelota de regreso', await until(() => ana.evaluate(() => !window.__ciudad.api.pets.companion.ball), 45000), await ana.evaluate(() => { const c = window.__ciudad.api.pets.companion, b = c.ball; return JSON.stringify({ state: b && b.state, t: b && b.t, to: b && b.to, pet: c.pos, stuck: c.stuckT, owner: window.__ciudad.api.player.position }); }));
    // comida y reacción
    const feed = await ana.evaluate(async () => { const a = window.__ciudad.api; const r = await a.vivo.feed(a.vivo.activePet.id, 'croquetas'); a.pets.react('food'); return [r.ok, r.coins, a.pets.companion.action]; });
    ok('darle de comer: monedas por cuidarle (una vez al día) y baile de felicidad', feed[0] && feed[1] === 2 && feed[2] === 'eat', feed);
    // tienda
    const buy = await ana.evaluate(async () => { const a = window.__ciudad.api, before = [a.store.state.vivo.coins, a.store.state.xp]; const r = await a.vivo.buy('correa-arcoiris'); return [r.ok, r.spent, before[0] - a.store.state.vivo.coins, before[1] - a.store.state.xp]; });
    ok('comprar en la tienda descuenta monedas, nunca XP', JSON.stringify(buy) === JSON.stringify([true, 60, 60, 0]), JSON.stringify(buy));
    const coinsNow = await ana.evaluate(() => window.__ciudad.api.store.state.vivo.coins);
    await ana.evaluate(() => { window.__ciudad.api.actions.shop('mascotas'); }); await sleep(500);
    ok('la tienda de mascotas muestra precios y lo que ya tienes', await ana.evaluate(() => /Ya lo tienes/.test(document.getElementById('modal-body').textContent) && document.querySelectorAll('.vp__product').length > 10));
    await shot(ana, '04-tienda'); await ana.evaluate(() => document.getElementById('modal-x').click());
    // aves: vuelan a un lado y se posan en el hombro
    await ana.evaluate(async () => { const a = window.__ciudad.api; const r = await a.vivo.adopt('perico', 'Kiwi'); await a.vivo.setPet(r.pet.id, { active: true }); });
    ok('el perico vuela junto al jugador', await until(() => ana.evaluate(() => { const c = window.__ciudad.api.pets.companion; return c && c.kind === 'bird' && c.air > 1.2; })));
    ok('y se posa en su hombro cuando se queda quieto', await until(() => ana.evaluate(() => window.__ciudad.api.pets.companion.perched), 30000));
    await sleep(800); await shot(ana, '05-perico-en-el-hombro');
    // montura: vuelo panorámico en el Gran dragón desde el helipuerto; Ana ve a Dani volar
    await walk(ana, -6, 6);   // Ana mira desde el suelo, cerca del helipuerto
    const dani = await open('dani', 'Dani'); let daniErrs = [];
    ok('el Gran dragón acompaña caminando (espera afuera de los interiores)', await until(() => dani.evaluate(() => { const c = window.__ciudad.api.pets.companion; return c && c.kind === 'bigdragon' && c.visible; })));
    await walk(dani, -14, 4); await walk(dani, -19, 0.5);
    await dani.evaluate(() => { const n = window.__ciudad.api.net, orig = n.profile.bind(n); window.__visitsInFlight = 0; n.profile = (op, p) => { if (op === 'visit' && window.__ciudad.api.mounts.active) window.__visitsInFlight++; return orig(op, p); }; });
    await dani.evaluate(() => { window.__ciudad.api.mounts.open(); }); await sleep(600);
    await dani.evaluate(() => { const b = [...document.querySelectorAll('#choice .choice__opt')].find(x => /Despegar/.test(x.textContent)); b && b.click(); });
    ok('despegar desde el helipuerto (lo autoriza el servidor)', await until(() => dani.evaluate(() => Boolean(window.__ciudad.api.mounts.active))), await dani.evaluate(() => [window.__ciudad.api.player.position.x, window.__ciudad.api.player.position.z]));
    ok('en el aire, por encima de los edificios', await until(() => dani.evaluate(() => window.__ciudad.api.player.position.y > 12), 30000));
    ok('otro jugador ve a Dani montado en el dragón', await until(() => ana.evaluate(() => [...window.__ciudad.remotes.map.values()].some(r => r.mount && r.y > 8)), 30000));
    await shot(dani, '07-vuelo'); await shot(ana, '08-vuelo-visto-desde-el-suelo');
    const fixes = await dani.evaluate(() => { let n = 0; window.__ciudad.api.net.on('fix', () => n++); return new Promise(r => setTimeout(() => r(n), 3000)); });
    ok('el servidor acepta cada posición del vuelo (sin correcciones)', fixes === 0, fixes);
    ok('aterriza en el mismo helipuerto', await until(() => dani.evaluate(() => { const a = window.__ciudad.api, p = a.player.position; return !a.mounts.active && p.y < 0.1 && Math.hypot(p.x + 20, p.z) < 4; }), 60000));
    ok('volando no se descubren edificios ni se gana XP de exploración', await dani.evaluate(() => window.__visitsInFlight === 0));
    ok('al aterrizar el control vuelve al jugador', await dani.evaluate(() => window.__ciudad.api.input.enabled !== false));
    daniErrs = dani.errs; await dani.context().close();
    // interiores: en la habitación la mascota acompaña; el paseo con correa no
    await ana.evaluate(() => window.__ciudad.api.travel('room', 'door')); await sleep(1500);
    ok('en la habitación la mascota sigue acompañando', await ana.evaluate(() => window.__ciudad.api.pets.companion.visible));
    // otro dispositivo
    const ana2 = await open('ana', 'Ana', 'room', { width: 390, height: 760 });
    ok('en otro dispositivo están las mismas mascotas, monedas e inventario', await ana2.evaluate(() => { const v = window.__ciudad.api.store.state.vivo; return v.pets.length === 2 && v.inv['correa-arcoiris'] === 1; }) && coinsNow === await ana2.evaluate(() => window.__ciudad.api.store.state.vivo.coins));
    await ana2.evaluate(() => { window.__ciudad.api.actions.pets(); }); await sleep(800); await shot(ana2, '06-mascotas-movil');
    ok('el panel de mascotas cabe en un teléfono (emulado)', await ana2.evaluate(() => { const m = document.querySelector('#modal .modal__card').getBoundingClientRect(); return m.width <= 390 && m.left >= 0; }));
    const errs = [...ana.errs, ...betoErrs, ...daniErrs, ...ana2.errs];
    ok('sin errores de JavaScript', errs.length === 0, errs.join(' | '));
  } catch (e) { ok('la prueba terminó sin excepciones', false, e.stack); }
  finally {
    await browser.close(); server.kill();
    const fails = results.filter(r => r[0] === 'FAIL').length;
    console.log(`\n${results.length - fails}/${results.length} comprobaciones correctas`);
    process.exit(fails ? 1 : 0);
  }
})();
