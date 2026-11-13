'use strict';
// Ciudad ICADEM 1.3 · Distrito del Saber contra el servidor de sesiones (modo de prueba):
// portal desde la plaza, laberinto con las tres puertas respondidas en la interfaz y validado por
// posición, laboratorio y sala de escape calificados por el servidor, Ruta del explorador y un
// segundo jugador que ve a Ana dentro del distrito.
//
// Uso:  node scripts/ciudad-distrito-e2e.cjs http://127.0.0.1:8767
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8767').replace(/\/$/, '');
const PORT = Number(process.env.MP_PORT || 8796);
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-dist-'));
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name]); console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  →  ' + String(extra).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await sleep(250); } return false; };

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '_ciudad-server', 'server.js')], { env: { ...process.env, PORT: String(PORT), CIUDAD_AUTH: 'test', NODE_ENV: 'development', CIUDAD_DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.logs = ''; child.stdout.on('data', d => { child.logs += d; }); child.stderr.on('data', d => { child.logs += d; });
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/servidor de PRUEBA/.test(String(d))) resolve(child); }); child.stderr.on('data', d => reject(new Error(String(d)))); setTimeout(() => reject(new Error('el servidor no arrancó')), 8000); });
}
// caminar (el antitrampas del servidor corrige los saltos de posición)
const walk = (page, x, z, step = 0.45) => page.evaluate(async ([x, z, step]) => {
  const p = window.__ciudad.api.player.position;
  for (let i = 0; i < 400; i++) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.15) break; const s = Math.min(d, step); p.x += dx / d * s; p.z += dz / d * s; await new Promise(r => setTimeout(r, 80)); }
  await new Promise(r => setTimeout(r, 250));
}, [x, z, step]);

(async () => {
  const server = await startServer();
  const browser = await pw.chromium.launch({ args: GL });
  const open = async (uid, name, scene = 'plaza') => {
    const ctx = await browser.newContext({ viewport: { width: 760, height: 480 } }), page = await ctx.newPage(); page.errs = []; page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', e => page.errs.push(e.message));
    await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&scene=${scene}&avatar=0&tutorial=0&mp=ws://127.0.0.1:${PORT}&uid=${uid}&name=${name}`);
    await until(() => page.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline), 40000);
    await page.evaluate(() => { const a = window.__ciudad.api; a.engine.renderer.setPixelRatio(0.45); a.store.state.settings.npcQuiz = false; });
    return page;
  };
  const answerChoice = page => page.evaluate(async () => {
    const { QUESTIONS } = await import('./js/edu/questions.js');
    const text = document.querySelector('#choice .choice__text').textContent, q = QUESTIONS.find(x => x.q === text);
    [...document.querySelectorAll('#choice .choice__opt')][q.answer].click(); return true;
  });
  try {
    const ana = await open('ana', 'Ana');
    // portal desde la plaza (calle sur)
    await walk(ana, 0, -20); await walk(ana, 0, -36.5);
    ok('el portal del Distrito del Saber está en la calle sur', await until(() => ana.evaluate(() => /Distrito del Saber/.test(document.getElementById('interact')?.textContent || document.body.textContent))), '');
    await ana.evaluate(() => window.__ciudad.api.travel('distrito', 'default'));
    ok('se llega al Distrito del Saber (el servidor acepta la escena nueva)', await until(() => ana.evaluate(() => window.__ciudad.api.sceneName === 'distrito')));
    await sleep(800);
    const beto = await open('beto', 'Beto', 'plaza');
    await beto.evaluate(() => window.__ciudad.api.travel('distrito', 'default'));
    ok('otro jugador ve a Ana dentro del distrito', await until(async () => (await beto.evaluate(() => window.__ciudad.api.sceneName === 'distrito' && window.__ciudad.remotes.map.size === 1)), 25000), await beto.evaluate(() => [window.__ciudad.api.sceneName, window.__ciudad.remotes.map.size]));
    const betoErrs = beto.errs; await beto.context().close();   // libera el render por software

    // Ruta del explorador: el anfiteatro se descubre al llegar (lo confirma el servidor)
    await walk(ana, 0, 6.6); await walk(ana, 10.5, 6.6);
    ok('Ruta del explorador: descubrir el anfiteatro da XP y queda en la cuenta', await until(() => ana.evaluate(() => (window.__ciudad.api.store.state.discovered || []).includes('anfiteatro') && window.__ciudad.api.store.state.synced)), await ana.evaluate(() => JSON.stringify({ pos: window.__ciudad.api.player.position.toArray().map(v => +v.toFixed(1)), d: window.__ciudad.api.store.state.discovered, dis: [...window.__ciudad.api.district.discovering] })));

    // Laberinto: entrada, tres puertas respondidas en la interfaz, salida
    const { maze, path: route } = await ana.evaluate(async () => {
      const { MAZE, mazeCell } = await import('./js/edu/district-rules.js'), G = MAZE.grid;
      const find = ch => { for (let j = 0; j < G.length; j++) { const i = G[j].indexOf(ch); if (i >= 0) return [i, j]; } };
      const [si, sj] = find('S'), [ei, ej] = find('E'), prev = new Map([[si + ',' + sj, null]]), q = [[si, sj]];
      while (q.length) { const [i, j] = q.shift(); if (i === ei && j === ej) break; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b, c = G[y] && G[y][x]; if (!c || c === '#' || prev.has(x + ',' + y)) continue; prev.set(x + ',' + y, [i, j]); q.push([x, y]); } }
      const out = []; for (let k = ei + ',' + ej; k; ) { const [i, j] = k.split(',').map(Number); out.unshift({ at: mazeCell(i, j), ch: G[j][i] }); const pv = prev.get(k); k = pv ? pv.join(',') : null; }
      return { maze: MAZE.start, path: out };
    });
    await walk(ana, 0, 6.6); await walk(ana, 0, 1); await walk(ana, maze[0], 1); await walk(ana, maze[0], maze[1] + 3.2);
    await ana.evaluate(() => { window.__ciudad.api.district.mazeStart(); });
    await until(() => ana.evaluate(() => !document.getElementById('dialog').hidden));
    for (let k = 0; k < 10 && await ana.evaluate(() => !document.getElementById('dialog').hidden); k++) { await ana.evaluate(() => document.getElementById('dialog-next').click()); await sleep(250); }
    ok('el laberinto empieza y el servidor abre la partida', await until(() => ana.evaluate(() => window.__ciudad.api.district.run && !window.__ciudad.api.district.pending)), await ana.evaluate(() => JSON.stringify({ run: window.__ciudad.api.district.run, pending: window.__ciudad.api.district.pending, dlg: !document.getElementById('dialog').hidden, pos: window.__ciudad.api.player.position.toArray().map(v => +v.toFixed(1)) })));
    let gatesOk = 0;
    for (const step of route) {
      if ('123'.includes(step.ch)) {
        const n = Number(step.ch) - 1;
        for (let tries = 0; tries < 4; tries++) {
          await ana.evaluate(n => { window.__ciudad.api.district.gate(n); }, n);
          if (!(await until(() => ana.evaluate(() => !document.getElementById('choice')?.hidden), 5000))) break;
          await answerChoice(ana); await sleep(400);
          if (await ana.evaluate(n => window.__ciudad.api.district.run.opened > n, n)) { gatesOk++; break; }
        }
      }
      await walk(ana, step.at[0], step.at[1]);
    }
    ok('las tres puertas se abren respondiendo bien en la interfaz', gatesOk === 3, gatesOk);
    ok('al cruzar la salida el servidor valida el recorrido y acredita XP', await until(() => ana.evaluate(() => document.getElementById('modal-eyebrow').textContent === 'Laberinto del conocimiento' && /XP/.test(document.getElementById('modal-body').textContent)), 25000),
      await ana.evaluate(() => [window.__ciudad.api.district.run, document.getElementById('modal-eyebrow').textContent]));
    await ana.evaluate(() => document.querySelector('#modal-actions .btn--primary')?.click()); await sleep(400);
    ok('el laberinto queda en el progreso del servidor', await until(() => ana.evaluate(() => (window.__ciudad.api.store.state.play.act.laberinto || {}).done === true)));

    // Laboratorio (respuestas correctas) y Sala de escape (códigos correctos): califica el servidor
    await ana.evaluate(() => { window.__ciudad.api.games.launch('laboratorio'); });
    await until(() => ana.evaluate(() => !document.getElementById('choice').hidden)); await ana.evaluate(() => document.querySelector('#choice .choice__opt.is-primary').click());
    await until(() => ana.evaluate(() => !!document.querySelector('.lab__opt')));
    for (let k = 0; k < 5; k++) {
      await ana.evaluate(() => { window.__labSetup = document.querySelector('.lab__setup').textContent.split(' — ')[0]; });
      const idx = await ana.evaluate(async () => { const src = await (await fetch('./js/edu/district-rules.js')).text(); const re = /\['(\w+)', '([^']+)', \[[^\]]+\], (\d)/g; let m; while ((m = re.exec(src))) if (m[2] === window.__labSetup) return Number(m[3]); return 0; });
      await ana.evaluate(i => document.querySelectorAll('.lab__opt')[i].click(), idx); await sleep(250);
      await ana.evaluate(() => document.querySelector('.lab__next').click()); await sleep(250);
    }
    ok('Laboratorio: 100 puntos calificados por el servidor', await until(() => ana.evaluate(() => document.getElementById('modal-eyebrow').textContent === 'Laboratorio de experimentos' && document.querySelector('.result__score b')?.textContent === '100'), 20000));
    await ana.evaluate(() => document.querySelector('#modal-actions .btn--primary')?.click()); await sleep(400);
    await ana.evaluate(() => { window.__ciudad.api.games.launch('escape'); });
    await until(() => ana.evaluate(() => !document.getElementById('choice').hidden)); await ana.evaluate(() => document.querySelector('#choice .choice__opt.is-primary').click());
    await until(() => ana.evaluate(() => !!document.querySelector('.esc__input')));
    await ana.fill('.esc__input', '0'); await ana.click('.esc__form .btn--primary'); await sleep(200);   // un intento equivocado (−10)
    for (let k = 0; k < 3; k++) {
      const solved = await ana.evaluate(() => { const clue = document.querySelector('.esc__clue').textContent; let m;
        if ((m = clue.match(/viven (\d+) arañas, (\d+) gatos y (\d+) gallinas?/))) return String(m[1] * 8 + m[2] * 4 + m[3] * 2);
        if ((m = clue.match(/serie en la pizarra: ([\d, ]+), …/))) { const s = m[1].split(',').map(Number), d1 = s[1] - s[0], d2 = s[2] - s[1]; return String(d1 === d2 ? s[4] + d1 : s[1] === s[0] * 2 ? s[4] * 2 : s[4] + (s[4] - s[3]) + 2); }
        if ((m = clue.match(/a las (\d+):(\d+) y duró (\d+) minutos/))) { const e = Number(m[1]) * 60 + Number(m[2]) + Number(m[3]); return `${Math.floor(e / 60)}${String(e % 60).padStart(2, '0')}`; }
        if ((m = clue.match(/mide (\d+) m de ancho por (\d+) m/))) return String(m[1] * m[2]);
        if ((m = clue.match(/letras de «(\w+)»/))) return String([...m[1]].reduce((s, ch) => s + ch.charCodeAt(0) - 64, 0));
        return '0'; });
      await ana.fill('.esc__input', solved); await ana.click('.esc__form .btn--primary'); await sleep(300);
    }
    ok('Sala de escape: tres candados y 90 puntos (un error) calificados por el servidor', await until(() => ana.evaluate(() => document.getElementById('modal-eyebrow').textContent === 'Sala de escape' && document.querySelector('.result__score b')?.textContent === '90'), 20000),
      await ana.evaluate(() => [document.getElementById('modal-eyebrow').textContent, document.querySelector('.result__score b')?.textContent]));
    await ana.evaluate(() => document.querySelector('#modal-actions .btn--primary')?.click()); await sleep(300);
    ok('los juegos nuevos aparecen en el menú de minijuegos', await ana.evaluate(async () => { const { GAME_LIST } = await import('./js/edu/games.js'); return ['laberinto', 'laboratorio', 'escape'].every(id => GAME_LIST.some(g => g.id === id)); }));
    ok('sin errores de JavaScript', !ana.errs.length && !betoErrs.length, JSON.stringify([...ana.errs, ...betoErrs]));
  } catch (e) { ok('la prueba terminó sin excepciones', false, e && e.stack); }
  finally { await browser.close().catch(() => {}); server.kill(); }
  const failed = results.filter(r => r[0] === 'FAIL').length;
  if (failed && process.env.VERBOSE) console.log(server.logs.split('\n').slice(-25).join('\n'));
  console.log(`\n${results.length - failed}/${results.length} comprobaciones del Distrito del Saber`);
  process.exit(failed ? 1 : 0);
})();
