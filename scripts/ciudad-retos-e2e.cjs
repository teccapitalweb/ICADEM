'use strict';
// Ciudad ICADEM · Carrera del conocimiento y Búsqueda del tesoro contra el servidor de sesiones
// (modo de prueba), con un solo jugador en un navegador real.
// - Ambos arrancan aunque el jugador haya estado quieto más de 2.5 s (p. ej. leyendo el diálogo).
// - Cada arco / tesoro lo confirma el servidor con la posición que él mismo validó; solo cuentan
//   sus respuestas reales (no el texto de una pantalla anterior).
// - La XP queda guardada por el servidor bajo «carrera» y «tesoro».
//
// Uso:  node scripts/ciudad-retos-e2e.cjs http://127.0.0.1:8766
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const PORT = Number(process.env.MP_PORT || 8797);
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-retos-'));
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
  const page = await (await browser.newContext({ viewport: { width: 320, height: 240 } })).newPage();
  page.errs = []; page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', e => page.errs.push(e.message)); page.on('crash', () => console.log('[retos] la pestaña se cayó (render)'));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // Caminar (teletransportarse lo corrige el antitrampas del servidor): pasos cortos y constantes.
  const walk = (x, z, y = null, step = 0.3) => ev(async ([x, z, y, step]) => {
    const a = window.__ciudad.api, p = a.player.position;
    // Un arco sobre plataforma se alcanza saltando: al acercarse se sube a su altura (como el salto real).
    for (let i = 0; i < 600; i++) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.2) break; if (y !== null && d < 2.8) { p.y = y; a.player.grounded = true; a.player.vy = 0; } const s = Math.min(d, step); p.x += dx / d * s; p.z += dz / d * s; await new Promise(r => setTimeout(r, 80)); }
    if (y !== null) { p.y = y; a.player.grounded = true; a.player.vy = 0; }
    await new Promise(r => setTimeout(r, 400));
  }, [x, z, y, step]);
  const dialogThrough = () => until(async () => { if (await ev(() => document.getElementById('dialog').hidden)) return true; await ev(() => document.getElementById('dialog-next')?.click()); return false; }, 15000);
  const closeModal = () => until(async () => { await ev(() => { const bs = [...document.querySelectorAll('#modal-actions button')]; (bs.find(b => /Cerrar|Continuar/.test(b.textContent)) || bs[0])?.click(); }); await sleep(300); return ev(() => document.getElementById('modal').hidden && !window.__ciudad.api.ui.isBlocking); });
  const goTo = (scene, run) => until(() => ev(([scene, run]) => { const a = window.__ciudad.api; if (a.sceneName === scene && !document.getElementById('fade').classList.contains('is-on')) return true; if (a.sceneName !== scene && !document.getElementById('fade').classList.contains('is-on')) (new Function('a', run))(a); return false; }, [scene, run]), 30000);

  try {
    await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&tutorial=0&scene=plaza&mp=ws://127.0.0.1:${PORT}&uid=rita&name=Rita`);
    ok('se conecta al servidor de prueba', await until(() => ev(() => window.__ciudad && window.__ciudad.api.net.isOnline), 40000));
    await ev(() => { const a = window.__ciudad.api; a.store.state.settings.npcQuiz = false; window.__plays = []; a.net.on('play', m => window.__plays.push(m)); window.__fixes = []; a.net.on('fix', m => window.__fixes.push(m.reason + '@' + JSON.stringify(m.s) + '#' + Math.round(performance.now()))); });

    /* ---------------- Carrera del conocimiento ---------------- */
    ok('la puerta de la plaza lleva al Parque de retos', await goTo('park', "a.scene.interactables.find(i => i.id === 'park')?.action()"), await ev(() => window.__ciudad.api.sceneName));
    await sleep(3500);                                    // quieto, como quien lee el diálogo
    await ev(() => { window.__ciudad.api.games.raceStartUI(); }); await sleep(400); await dialogThrough();
    ok('la carrera arranca aunque el jugador haya estado quieto', await until(() => ev(() => window.__plays.some(m => m.op === 'start' && m.game === 'carrera' && m.ok) && window.__ciudad.api.games.race && !window.__ciudad.api.games.pending)), await ev(() => JSON.stringify(window.__plays)));
    const RACE = await ev(async () => JSON.parse(JSON.stringify((await import('./js/edu/activities.js')).RACE)));
    for (const [k, [x, z, y]] of RACE.checkpoints.entries()) { await walk(x, z, y || null); await until(() => ev(i => !window.__ciudad.api.games.race || window.__ciudad.api.games.race.next > i, k), 6000); }
    ok('el servidor confirmó los 7 arcos en orden y la meta', await until(() => ev(() => window.__plays.filter(m => m.op === 'check' && m.game === 'carrera' && m.ok).length === 7 && window.__plays.some(m => m.done && m.game === 'carrera')), 15000), await ev(async () => { let n = 0; const t0 = performance.now(); await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); const a = window.__ciudad.api; return JSON.stringify({ plays: window.__plays.slice(-3), fixes: window.__fixes, fps: n / 2, pos: a.player.position, next: a.games.race && a.games.race.next }); }));
    ok('la XP de la carrera la guarda el servidor bajo «carrera» y se muestra el resultado', await until(() => ev(() => { const c = window.__ciudad.api.store.state.play.act.carrera; return Boolean(c && c.best >= 50 && c.done) && /de 100\+\d+ XP/.test(document.querySelector('.mg-result')?.textContent || ''); }), 8000), await ev(() => JSON.stringify(window.__ciudad.api.store.state.play.act)));
    await closeModal();

    /* ---------------- Búsqueda del tesoro ---------------- */
    ok('de regreso en la plaza', await goTo('plaza', "a.travel('plaza', 'park')"));
    await ev(() => { window.__plays = []; }); await sleep(3500);
    await ev(() => { window.__ciudad.api.games.huntStart(); }); await sleep(400); await dialogThrough();
    ok('la búsqueda del tesoro arranca aunque el jugador haya estado quieto', await until(() => ev(() => window.__plays.some(m => m.op === 'start' && m.game === 'tesoro' && m.ok) && window.__ciudad.api.games.hunt && !window.__ciudad.api.games.pending)), await ev(() => JSON.stringify({ plays: window.__plays, fixes: window.__fixes, scene: window.__ciudad.api.sceneName, pos: window.__ciudad.api.player.position })));
    const TREASURES = await ev(async () => JSON.parse(JSON.stringify((await import('./js/edu/activities.js')).TREASURES)));
    for (let round = 0; round < 3; round++) {
      const ids = await ev(() => { const h = window.__ciudad.api.games.hunt; return h ? h.rounds[h.round].filter(id => !h.found.includes(id)) : []; });
      for (const id of ids) { const t = TREASURES.find(x => x.id === id); await walk(t.at[0], t.at[1], null, 0.45); await until(() => ev(i => { const h = window.__ciudad.api.games.hunt; return !h || h.found.includes(i); }, id), 6000); }
      await sleep(600);
    }
    ok('el servidor confirmó los 10 tesoros', await until(() => ev(() => window.__plays.filter(m => m.op === 'check' && m.game === 'tesoro' && m.ok).length === 10 && window.__plays.some(m => m.done && m.game === 'tesoro')), 12000), await ev(() => JSON.stringify(window.__plays.slice(-3))));
    ok('la XP de la búsqueda la guarda el servidor bajo «tesoro»', await until(() => ev(() => Boolean(window.__ciudad.api.store.state.play.act.tesoro?.done) && /de 100\+\d+ XP/.test(document.querySelector('.mg-result')?.textContent || '')), 8000), await ev(() => JSON.stringify(window.__ciudad.api.store.state.play.act)));
    ok('ninguna XP quedó en un juego sin nombre', await ev(() => !Object.keys(window.__ciudad.api.store.state.play.act).some(k => !['memoria', 'matematicas', 'idiomas', 'clasificacion', 'carrera', 'tesoro'].includes(k))));
    ok('sin errores de JavaScript', !page.errs.length, JSON.stringify(page.errs));
  } catch (e) { ok('el recorrido terminó sin excepciones', false, e.stack || e.message); }
  finally {
    await browser.close(); server.kill();
    const pass = results.filter(r => r[0] === 'PASS').length;
    console.log(`\n${pass}/${results.length} comprobaciones de carrera y tesoro`);
    process.exit(pass === results.length ? 0 : 1);
  }
})();
