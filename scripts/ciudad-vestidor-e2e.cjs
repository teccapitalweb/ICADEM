'use strict';
// Ciudad ICADEM · Vestidor y skins contra el servidor de sesiones (modo de prueba), con dos jugadores:
// selección inicial gratuita, skins bloqueadas que el servidor rechaza aunque se manipule el navegador,
// el otro jugador ve el cambio, y la elección se conserva al reconectar (otro dispositivo).
//
// Uso:  node scripts/ciudad-vestidor-e2e.cjs http://127.0.0.1:8766
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const PORT = Number(process.env.MP_PORT || 8798);
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-vest-'));
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name]); console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  →  ' + String(extra).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await sleep(250); } return false; };

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '_ciudad-server', 'server.js')], { env: { ...process.env, PORT: String(PORT), CIUDAD_AUTH: 'test', NODE_ENV: 'development', CIUDAD_DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/servidor de PRUEBA/.test(String(d))) resolve(child); }); child.stderr.on('data', d => reject(new Error(String(d)))); setTimeout(() => reject(new Error('el servidor no arrancó')), 8000); });
}

(async () => {
  const server = await startServer();
  const browser = await pw.chromium.launch({ args: GL });
  const open = async (uid, name, extra = '') => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 420 } }), page = await ctx.newPage(); page.errs = []; page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', e => page.errs.push(e.message));
    await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&scene=plaza&mp=ws://127.0.0.1:${PORT}&uid=${uid}&name=${name}${extra}`);
    await until(() => page.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline), 40000);
    await page.evaluate(() => { const a = window.__ciudad.api; a.engine.renderer.setPixelRatio(0.6); a.store.state.settings.npcQuiz = false; });   // render por software: menos carga
    return page;
  };
  // lo que el otro jugador tiene de Ana: su ficha en la sala y el personaje 3D que dibuja
  const remoteLook = (page, who) => page.evaluate(n => { const c = window.__ciudad; const p = [...c.api.net.roster.values()].find(x => x.name === n); if (!p) return null; const r = c.remotes.map.get(p.pid); return { avatar: p.avatar, custom: p.custom, drawn: Boolean(r), skin: r ? r.avatar.look.skin : null }; }, who);
  try {
    // Ana entra por primera vez: el servidor dice que aún no elige personaje → aparece la selección
    const ana = await open('ana', 'Ana');
    ok('primera vez con servidor: aparece «Elige tu personaje» (solo iniciales gratuitos)', await until(() => ana.evaluate(() => document.getElementById('modal-title').textContent === 'Elige tu personaje' && document.querySelectorAll('.vcard').length === 7)));
    await ana.evaluate(() => document.querySelector('.vcard[data-id="creativa"]').click()); await sleep(200);
    await ana.evaluate(() => document.querySelector('#modal-actions .btn--primary').click());
    ok('la elección la guarda el servidor (avatar y «ya eligió»)', await until(() => ana.evaluate(() => { const s = window.__ciudad.api.store.state; return s.avatarId === 'creativa' && s.avatarChosen === true; })));
    await ana.evaluate(() => { const c = window.__ciudad; c.api.store.state.tutorialDone = true; document.getElementById('coach').hidden = true; c.tutorial && c.tutorial.stop && c.tutorial.stop(); });

    const beto = await open('beto', 'Beto', '&avatar=0&tutorial=0');
    ok('el otro jugador ve a Ana con su personaje', await until(async () => (await remoteLook(beto, 'Ana'))?.avatar === 'creativa'), JSON.stringify(await remoteLook(beto, 'Ana')));

    // manipular el navegador para ponerse una skin especial bloqueada: el servidor la rechaza
    await ana.evaluate(() => { const a = window.__ciudad.api; a.store.state.xp = 99999; a.net.profile('avatar', { id: 'leyenda', custom: a.store.state.custom }); });
    ok('una skin especial bloqueada no se desbloquea manipulando el navegador', await until(() => ana.evaluate(() => window.__ciudad.api.store.state.avatarId === 'creativa' && window.__ciudad.api.store.state.xp < 99999)), await ana.evaluate(() => JSON.stringify([window.__ciudad.api.store.state.avatarId, window.__ciudad.api.store.state.xp])));
    ok('Beto sigue viendo a Ana con su personaje permitido', (await remoteLook(beto, 'Ana'))?.avatar === 'creativa');

    // estilo gratuito (misma vía que usa el vestidor): el servidor lo guarda y Beto lo ve
    await ana.evaluate(() => { const a = window.__ciudad.api; a.setAvatar(a.store.state.avatarId, { ...a.store.state.custom, tone: 't5', outfit: 'cielo' }); });
    ok('tono y atuendo guardados por el servidor', await until(() => ana.evaluate(() => { const c = window.__ciudad.api.store.state.custom; return c.tone === 't5' && c.outfit === 'cielo' && window.__ciudad.api.store.state.synced; })));
    ok('Beto ve el nuevo estilo de Ana (y su personaje 3D usa el tono elegido)', await until(async () => { const r = await remoteLook(beto, 'Ana'); return r && r.custom && r.custom.tone === 't5' && r.custom.outfit === 'cielo' && r.drawn && r.skin === 0x6b4129; }), JSON.stringify(await remoteLook(beto, 'Ana')));
    const betoErrs = beto.errs; await beto.context().close();   // el render por software no aguanta dos mundos más el vestidor
    // vestidor: requisitos reales de las skins bloqueadas y cambio de atuendo desde la interfaz
    await ana.evaluate(() => window.__ciudad.api.ui.openWardrobe()); await until(() => ana.evaluate(() => document.getElementById('modal-title').textContent === 'Mi avatar'));
    const locked = await ana.evaluate(() => { [...document.querySelectorAll('.vest__cats button')][2].click(); return [...document.querySelectorAll('.vcard.is-locked small')].map(s => s.textContent); });
    ok('las skins especiales bloqueadas muestran requisitos reales', locked.length === 6 && locked.includes('Llega al nivel 10') && locked.includes('Completa las diez misiones profesionales'), JSON.stringify(locked));
    await ana.evaluate(() => document.querySelector('.vest__tabs button[data-id="estilo"]').click()); await sleep(300);
    await ana.evaluate(() => document.querySelector('.chips--swatch button[data-outfit="sol"]').click());
    ok('desde el vestidor: el atuendo se guarda en la cuenta', await until(() => ana.evaluate(() => window.__ciudad.api.store.state.custom.outfit === 'sol')));
    await ana.evaluate(() => document.getElementById('modal-x').click());
    beto.errs = betoErrs;

    // otro dispositivo: misma cuenta, sin datos locales → recibe el personaje y no vuelve a preguntar
    await ana.context().close();
    const ana2 = await open('ana', 'Ana');
    await sleep(2500);
    const again = await ana2.evaluate(() => ({ id: window.__ciudad.api.store.state.avatarId, custom: window.__ciudad.api.store.state.custom, asked: document.getElementById('modal-title').textContent === 'Elige tu personaje' && !document.getElementById('modal').hidden }));
    ok('otro dispositivo: mismo personaje y estilo, sin volver a preguntar', again.id === 'creativa' && again.custom.tone === 't5' && again.custom.outfit === 'sol' && !again.asked, JSON.stringify(again));
    ok('sin errores de JavaScript', !ana2.errs.length && !beto.errs.length, JSON.stringify([...ana2.errs, ...beto.errs]));
  } catch (e) { ok('el recorrido terminó sin excepciones', false, e.stack || e.message); }
  finally {
    await browser.close(); server.kill();
    const pass = results.filter(r => r[0] === 'PASS').length;
    console.log(`\n${pass}/${results.length} comprobaciones del vestidor`);
    process.exit(pass === results.length ? 0 : 1);
  }
})();
