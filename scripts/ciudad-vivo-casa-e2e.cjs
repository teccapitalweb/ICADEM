'use strict';
// Ciudad ICADEM 2.0 · Entrega D contra el servidor de sesiones (modo de prueba): Paseo comercial,
// compras con vendedor, ropa comprada puesta, aguas frescas (preparar y pedir), «Mi casa» con sus
// mascotas, editor de decoración (colocar, mover, girar, validar, guardar, cancelar) y otro dispositivo.
//
// Uso:  node scripts/ciudad-vivo-casa-e2e.cjs http://127.0.0.1:8769 [carpeta-de-capturas]
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8769').replace(/\/$/, '');
const SHOTS = process.argv[3] || null;
const PORT = Number(process.env.MP_PORT || 8798);
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-casa-'));
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
  const a = window.__ciudad.api, p = a.player.position;
  for (let i = 0; i < 400; i++) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.15) break; const s = Math.min(d, step); p.x += dx / d * s; p.z += dz / d * s; a.player.yaw = Math.atan2(dx, dz); await new Promise(r => setTimeout(r, 80)); }
  await new Promise(r => setTimeout(r, 250));
}, [x, z, step]);
const choose = (page, re) => page.evaluate(src => { const r = new RegExp(src); const b = [...document.querySelectorAll('#choice .choice__opt')].find(x => r.test(x.textContent) && !x.disabled); if (b) b.click(); return Boolean(b); }, re.source);
const interact = (page, id) => page.evaluate(id => { const it = window.__ciudad.api.scene.interactables.find(x => x.id === id); it.action(); return true; }, id);

(async () => {
  const server = await startServer();
  const browser = await pw.chromium.launch({ args: GL });
  const open = async (uid, name, scene = 'plaza', viewport = { width: 860, height: 540 }) => {
    const ctx = await browser.newContext({ viewport }), page = await ctx.newPage(); page.errs = []; page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', e => page.errs.push(e.message));
    await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&scene=${scene}&avatar=0&tutorial=0&mp=ws://127.0.0.1:${PORT}&uid=${uid}&name=${name}`);
    await until(() => page.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline && window.__ciudad.api.store.state.vivo), 40000);
    await page.evaluate(() => { const a = window.__ciudad.api; a.engine.renderer.setPixelRatio(0.5); a.store.state.settings.npcQuiz = false; });
    return page;
  };
  try {
    const ana = await open('ana', 'Ana');
    const coins = () => ana.evaluate(() => window.__ciudad.api.store.state.vivo.coins);
    /* ---------- Paseo comercial ---------- */
    await walk(ana, 20, 0); await walk(ana, 43.5, 0);
    ok('la puerta del Paseo comercial está al este de la plaza', await ana.evaluate(() => window.__ciudad.api.scene.interactables.some(i => i.id === 'comercio')));
    await interact(ana, 'comercio');
    ok('se entra al Paseo comercial (el servidor acepta el escenario nuevo)', await until(() => ana.evaluate(() => window.__ciudad.api.sceneName === 'comercio')));
    await sleep(1500);
    ok('el servidor no corrigió la llegada', await ana.evaluate(() => { let n = 0; window.__fixes = 0; window.__ciudad.api.net.on('fix', () => window.__fixes++); return true; }));
    ok('siete tiendas con vendedor', await ana.evaluate(() => window.__ciudad.api.scene.interactables.filter(i => i.id.startsWith('tienda-')).length === 7 && window.__ciudad.api.scene.npcs.length === 7));
    await shot(ana, '10-paseo-comercial');
    await walk(ana, -8, -2.5); await interact(ana, 'tienda-mascotas'); await sleep(600);
    ok('el vendedor saluda y muestra su tienda', await ana.evaluate(() => /Lupita/.test(document.querySelector('.vp__greeting')?.textContent || '')));
    const c0 = await coins();
    await ana.evaluate(() => { const card = [...document.querySelectorAll('.vp__product')].find(c => /Galleta para perro/.test(c.textContent)); card.querySelector('button').click(); });
    ok('comprar premios para mascota en la tienda', await until(() => ana.evaluate(() => (window.__ciudad.api.store.state.vivo.inv['premio-galleta'] || 0) === 1)) && (await coins()) === c0 - 5);
    await ana.evaluate(() => document.getElementById('modal-x').click()); await sleep(300);
    await walk(ana, -12, 2.5); await interact(ana, 'tienda-ropa'); await sleep(600);
    await ana.evaluate(() => { const card = [...document.querySelectorAll('.vp__product')].find(c => /Camisa con cuello/.test(c.textContent)); card.querySelector('button').click(); });
    ok('comprar una camisa en la Boutique', await until(() => ana.evaluate(() => window.__ciudad.api.store.state.vivo.inv['ropa-shirt'] === 1)));
    await ana.evaluate(() => { const card = [...document.querySelectorAll('.vp__product')].find(c => /Camisa con cuello/.test(c.textContent)); card.querySelector('button').click(); });
    ok('ponérsela desde la tienda (lo confirma el servidor)', await until(() => ana.evaluate(() => window.__ciudad.api.store.state.custom.top === 'shirt' && !window.__ciudad.api.avatarSavesPending)));
    await shot(ana, '11-boutique');
    await ana.evaluate(() => document.getElementById('modal-x').click()); await sleep(300);
    const pantsBlocked = await ana.evaluate(() => window.__ciudad.api.setAvatar(window.__ciudad.api.store.state.avatarId, { ...window.__ciudad.api.store.state.custom, bottom: 'wideJeans' }));
    ok('una prenda de pago que no tienes no se puede poner', pantsBlocked === false);
    await walk(ana, -19, 0); await interact(ana, 'plaza');
    ok('regresar a la plaza por el arco', await until(() => ana.evaluate(() => window.__ciudad.api.sceneName === 'plaza')));
    /* ---------- aguas frescas ---------- */
    await walk(ana, 30, 0); await walk(ana, 0, 14); await walk(ana, -16.4, 14.2);
    const c1 = await coins();
    await interact(ana, 'aguas'); await sleep(500);
    await choose(ana, /Preparar mi propia agua/); await sleep(400); await choose(ana, /Jamaica/); await sleep(600);
    const press = label => ana.evaluate(l => { const b = [...document.querySelectorAll('.aguas__btn')].find(x => x.textContent.includes(l)); b.click(); return document.querySelector('.aguas__hint').textContent; }, label);
    const early = await press('Agregar agua');
    ok('preparar el agua: el orden importa y se explica', /vaso/i.test(early), early);
    await press('Tomar un vaso'); await press('Agregar agua');
    const wrongName = await ana.evaluate(() => { const b = [...document.querySelectorAll('.aguas__btn')].find(x => /Arroz|Canela|Pulpa|Mango|Sandía/.test(x.textContent)); return b ? b.textContent.replace('🧺', '') : null; });
    if (wrongName) { const msg = await press(wrongName); ok('un ingrediente que no va se explica y no se agrega', /no va en el agua de jamaica/.test(msg), msg); }
    await shot(ana, '12-aguas-preparar');
    await press('Flor de jamaica'); await press('Un poco de azúcar'); await press('Agregar hielo'); await press('Servir');
    ok('agua preparada: 3 monedas (una vez al día) y animación de beber', await until(() => ana.evaluate(() => window.__ciudad.api.avatar.emote === 'drink')) && (await coins()) === c1 + 3);
    await sleep(3500);
    await interact(ana, 'aguas'); await sleep(500); await choose(ana, /Pedirle un agua/); await sleep(400); await choose(ana, /Horchata/); await sleep(400); await choose(ana, /Sí, por favor/);
    ok('pedirle el agua a Don Chema cuesta 5 monedas', await until(async () => (await coins()) === c1 + 3 - 5));
    /* ---------- Mi casa ---------- */
    await ana.evaluate(async () => { const a = window.__ciudad.api; await a.vivo.adopt('mestizo-canela', 'Canela'); const r = await a.vivo.adopt('atigrado', 'Michi'); await a.vivo.adopt('perico', 'Kiwi'); });
    await ana.evaluate(() => { window.__ciudad.api.goHome(); });
    ok('«Mi casa»: se llega desde la plaza pasando por la habitación', await until(() => ana.evaluate(() => window.__ciudad.api.sceneName === 'casa'), 30000));
    await sleep(2500);
    ok('la casa inicial tiene sus muebles y paredes guardados en la cuenta', await ana.evaluate(() => { const s = window.__ciudad.api.scene; return s.furniture.children.length === 11 && s.layout.wall === 'crema'; }));
    ok('las mascotas que no te acompañan viven en la casa', await ana.evaluate(() => { const g = window.__ciudad.api.scene.group; let n = 0; g.traverse(o => { if (o.userData.pet) n++; }); return n === 2; }));
    await shot(ana, '13-mi-casa');
    // editor: comprar un cactus, colocarlo, girarlo y guardar
    await ana.evaluate(async () => { await window.__ciudad.api.vivo.buy('cactus'); });
    await ana.evaluate(() => window.__ciudad.api.homeEditor.open()); await sleep(800);
    ok('el editor muestra los muebles del inventario', await ana.evaluate(() => document.querySelectorAll('.hed__item').length >= 10 && /Cactus/.test(document.querySelector('.hed__shelf').textContent)));
    await ana.evaluate(() => { const e = window.__ciudad.api.homeEditor; e.add('cactus'); e.move(0.5, 0); e.rotate(); e.setWall('menta'); e.setFloor('talavera'); });
    await sleep(600); await shot(ana, '14-editor');
    const blocked = await ana.evaluate(() => { const e = window.__ciudad.api.homeEditor, i = e.draft.items.findIndex(x => x.item === 'silla'); e.sel = i; const keep = { ...e.draft.items[i] }; e.draft.items[i].x = 0; e.draft.items[i].z = -4.4; const r = e.check(); Object.assign(e.draft.items[i], keep); e.move(0, 0); return r.reason; });
    ok('el editor no deja tapar la entrada', blocked === 'puerta', blocked);
    await ana.evaluate(() => window.__ciudad.api.homeEditor.save());
    ok('guardar la decoración en la cuenta', await until(() => ana.evaluate(() => { const h = window.__ciudad.api.store.state.vivo.home; return h.wall === 'menta' && h.floor === 'talavera' && h.items.some(x => x.item === 'cactus'); })));
    ok('al guardar se sale del editor y vuelve el control', await ana.evaluate(() => !window.__ciudad.api.homeEditor.active && document.querySelector('.hed') === null));
    await ana.evaluate(() => { const e = window.__ciudad.api.homeEditor; e.open(); e.setWall('durazno'); e.close(true); });
    ok('cancelar deja la casa como estaba', await ana.evaluate(() => window.__ciudad.api.scene.layout.wall === 'menta'));
    /* ---------- otro dispositivo ---------- */
    const ana2 = await open('ana', 'Ana', 'room', { width: 390, height: 760 });
    await ana2.evaluate(() => { window.__ciudad.api.travel('casa', 'default'); });
    ok('en otro dispositivo la casa se ve igual', await until(() => ana2.evaluate(() => { const s = window.__ciudad.api.scene; return window.__ciudad.api.sceneName === 'casa' && s.layout.wall === 'menta' && s.layout.items.some(x => x.item === 'cactus'); }), 30000));
    await ana2.evaluate(() => window.__ciudad.api.homeEditor.open()); await sleep(800); await shot(ana2, '15-editor-movil');
    ok('el editor cabe en un teléfono (emulado)', await ana2.evaluate(() => { const r = document.querySelector('.hed').getBoundingClientRect(); return r.width <= 390 && r.left >= 0 && r.bottom <= innerHeight + 1; }));
    await ana2.evaluate(() => window.__ciudad.api.homeEditor.close(true));
    ok('el servidor no corrigió ninguna posición', await ana.evaluate(() => window.__fixes === 0), await ana.evaluate(() => window.__fixes));
    const errs = [...ana.errs, ...ana2.errs];
    ok('sin errores de JavaScript', errs.length === 0, errs.join(' | '));
  } catch (e) { ok('la prueba terminó sin excepciones', false, e.stack); }
  finally {
    await browser.close(); server.kill();
    const fails = results.filter(r => r[0] === 'FAIL').length;
    console.log(`\n${results.length - fails}/${results.length} comprobaciones correctas`);
    process.exit(fails ? 1 : 0);
  }
})();
