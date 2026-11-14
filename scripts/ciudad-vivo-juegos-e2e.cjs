'use strict';
// Ciudad ICADEM 2.0 · los diez juegos de «Mundo vivo» contra el servidor de sesiones (modo de prueba):
// actividades de elección calificadas por el servidor, juegos de campo con posiciones validadas
// (manzanas, guardianes, expedición por varios escenarios) y la Carrera del Saber con sus barreras.
//
// Uso:  node scripts/ciudad-vivo-juegos-e2e.cjs http://127.0.0.1:8769 [carpeta-de-capturas]
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8769').replace(/\/$/, '');
const SHOTS = process.argv[3] || null;
const PORT = Number(process.env.MP_PORT || 8799);
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-juegos2-'));
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
// Camina como un jugador: busca una ruta libre en la rejilla de colisiones (BFS) y la sigue paso a paso.
const walk = (page, x, z, step = 0.3) => page.evaluate(async ([x, z, step]) => {
  const a = window.__ciudad.api, p = a.player.position, c = a.scene.collision;
  const plats = (a.scene.platforms || []).filter(q => q.top > 0.3);   // las plataformas altas son muro
  const pud = ((a.vivoGames && a.vivoGames.objs) || []).filter(o => o.userData.puddle).map(o => [o.position.x, o.position.z]);   // rodear los charcos, como un jugador
  const S = 0.3, R = 0.42, N = 280, o = N / 2, toI = v => Math.round(v / S) + o, key = (i, j) => i * N + j;
  const from = [toI(p.x), toI(p.z)], prev = new Int32Array(N * N).fill(-1), q = [from]; prev[key(...from)] = key(...from);
  let goal = null, best = Infinity;
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h], d = Math.hypot((i - o) * S - x, (j - o) * S - z);
    if (d < best) { best = d; goal = [i, j]; } if (d < 0.2) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const u = i + di, v = j + dj; if (u < 0 || v < 0 || u >= N || v >= N || prev[key(u, v)] !== -1) continue;
      const wx = (u - o) * S, wz = (v - o) * S;
      if (!c.isFree(wx, wz, R) || plats.some(q => Math.abs(wx - q.x) < q.w / 2 + R && Math.abs(wz - q.z) < q.d / 2 + R) || pud.some(([px, pz]) => Math.hypot(px - wx, pz - wz) < 1.3)) { prev[key(u, v)] = -2; continue; }
      prev[key(u, v)] = key(i, j); q.push([u, v]);
    }
  }
  const path = []; for (let k = key(...goal); ; k = prev[k]) { path.unshift([(Math.floor(k / N) - o) * S, (k % N - o) * S]); if (prev[k] === k) break; }
  path.push([x, z]);
  // Avanza por la ruta a velocidad de caminata según el tiempo real (con SwiftShader cada cuadro tarda mucho).
  let k = 1, t = performance.now();
  while (k < path.length) {
    await new Promise(r => setTimeout(r, 80));
    const now = performance.now(); let budget = Math.min(step * 12, 4.2 * (now - t) / 1000); t = now;
    while (budget > 0 && k < path.length) { const [tx, tz] = path[k], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d <= budget) { p.x = tx; p.z = tz; budget -= d; k++; } else { p.x += dx / d * budget; p.z += dz / d * budget; budget = 0; } if (d > 0.01) a.player.yaw = Math.atan2(dx, dz); }
  }
  await new Promise(r => setTimeout(r, 300));
}, [x, z, step]);
const choose = (page, re) => page.evaluate(src => { const r = new RegExp(src); const b = [...document.querySelectorAll('#choice .choice__opt')].find(x => r.test(x.textContent) && !x.disabled); if (b) b.click(); return Boolean(b); }, re.source);
const interact = (page, id) => page.evaluate(id => { const it = window.__ciudad.api.scene.interactables.find(x => x.id === id); if (!it) return false; it.action(); return true; }, id);
const resultScore = page => page.evaluate(() => { const m = document.getElementById('modal'); if (m.hidden) return null; const t = document.getElementById('modal-body').textContent; const n = document.querySelector('#modal .result__score b'); return n ? { score: Number(n.textContent), text: t } : null; });
const dialogThrough = page => until(async () => { if (await page.evaluate(() => document.getElementById('dialog').hidden)) return true; await page.evaluate(() => document.getElementById('dialog-next')?.click()); return false; }, 15000);
const closeModal = page => page.evaluate(() => document.getElementById('modal-x')?.click());
/** Responde una actividad de elección: `pickFor(task)` decide el índice; vuelve cuando se cierra. */
const playChoice = async (page, id, level, plan) => {
  await page.evaluate(([id, level]) => { window.__ciudad.api.vivoGames.choice(id, level); }, [id, level]); await sleep(700);
  for (let guard = 0; guard < 40; guard++) {
    const step = await page.evaluate(plan => {
      const vg = window.__ciudad.api.vivoGames, c = vg.current.content, box = document.querySelector('.vg__task'); if (!box) return 'fin';
      const t = Number(document.querySelector('.vg__progress').textContent.split(' ')[0]) - 1, task = c.tasks[t], opts = [...box.querySelectorAll('.vg__opt')];
      if (opts.some(o => o.disabled)) { box.querySelector('.btn--primary').click(); return 'siguiente'; }
      window.__errs = window.__errs || {}; const wantWrong = plan.wrongAt === t && !window.__errs[t];
      let idx = task.options.findIndex(o => o.value === 2); if (wantWrong) { idx = task.options.findIndex(o => o.value < 2); window.__errs[t] = true; }
      opts[idx].click(); return 'respondida';
    }, plan);
    if (step === 'fin') break; await sleep(250);
  }
};

(async () => {
  const server = await startServer();
  const browser = await pw.chromium.launch({ args: GL });
  const ctx = await browser.newContext({ viewport: { width: 860, height: 560 } }), ana = await ctx.newPage(); ana.errs = []; ana.setDefaultTimeout(15000); ana.setDefaultNavigationTimeout(60000);
  ana.on('pageerror', e => ana.errs.push(e.message));
  await ana.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&scene=plaza&avatar=0&tutorial=0&mp=ws://127.0.0.1:${PORT}&uid=ana&name=Ana`);
  await until(() => ana.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline && window.__ciudad.api.store.state.vivo), 40000);
  await ana.evaluate(() => { const a = window.__ciudad.api; a.engine.renderer.setPixelRatio(0.5); a.store.state.settings.npcQuiz = false; });
  const coins = () => ana.evaluate(() => window.__ciudad.api.store.state.vivo.coins);
  try {
    ok('el menú de juegos tiene los diez juegos de Mundo vivo (la Carrera del Saber evoluciona la carrera)', await ana.evaluate(async () => { const { GAME_LIST } = await import('./js/edu/games.js'); const ids = GAME_LIST.map(g => g.id); return ['carrera', 'manzanas', 'heroes', 'rescate', 'guardianes', 'veterinarios', 'mercado', 'agua', 'emociones', 'expedicion'].every(id => ids.includes(id)) && GAME_LIST.find(g => g.id === 'carrera').title === 'Carrera del Saber'; }));
    /* ---------- actividades de elección ---------- */
    let c0 = await coins();
    await playChoice(ana, 'heroes', 'normal', {});
    ok('Héroes de la ciudad: el servidor califica 100 y da XP y monedas', await until(async () => { const r = await resultScore(ana); return r && r.score === 100 && /XP/.test(r.text) && /monedas/.test(r.text); }));
    await shot(ana, '20-resultado-heroes'); await closeModal(ana); await sleep(300);
    ok('las monedas del juego subieron en la cuenta', (await coins()) > c0);
    await playChoice(ana, 'rescate', 'normal', { wrongAt: 2 });
    ok('Rescate responsable: un error se explica, se reintenta y resta 10 (90)', await until(async () => { const r = await resultScore(ana); return r && r.score === 90 && /Cruz Roja/.test(r.text); }));
    await closeModal(ana); await sleep(300);
    for (const [id, level] of [['veterinarios', 'normal'], ['mercado', 'avanzado'], ['agua', 'normal'], ['emociones', 'normal']]) {
      await playChoice(ana, id, level, {});
      ok(`${id}: completo y calificado por el servidor`, await until(async () => { const r = await resultScore(ana); return r && r.score === 100; }));
      if (id === 'veterinarios') await shot(ana, '21-resultado-veterinarios');
      await closeModal(ana); await sleep(300);
    }
    // captura de una pregunta en curso
    await ana.evaluate(() => { window.__ciudad.api.vivoGames.choice('emociones', 'normal'); }); await sleep(700);
    await ana.evaluate(() => document.querySelector('.vg__opt').click()); await sleep(300); await shot(ana, '22-emociones'); await closeModal(ana); await sleep(400);
    /* ---------- Manzanas perdidas ---------- */
    await ana.evaluate(() => { window.__ciudad.api.vivoGames.field('manzanas', 4); }); await sleep(1500);
    ok('Manzanas perdidas: empieza con el servidor', await until(() => ana.evaluate(() => window.__ciudad.api.vivoGames.active)));
    await walk(ana, 12, 8.2); await interact(ana, 'vg-rosa'); await sleep(600);
    await dialogThrough(ana);
    ok('hablar con Doña Rosa: aparecen sus manzanas', await until(() => ana.evaluate(() => window.__ciudad.api.vivoGames.run && window.__ciudad.api.vivoGames.run.st.phase === 'recoger'), 15000));
    await shot(ana, '23-manzanas');
    const apples = await ana.evaluate(() => window.__ciudad.api.vivoGames.run.data.apples);
    for (const a of apples) { await walk(ana, a.x, a.z); await until(() => ana.evaluate(id => window.__ciudad.api.vivoGames.run.st.got.includes(id), a.id), 6000); }
    ok('recoger las siete manzanas caminando (cada una la valida el servidor)', await ana.evaluate(() => window.__ciudad.api.vivoGames.run.st.got.length === 7));
    await walk(ana, 13, 8.2); await interact(ana, 'vg-entregar');
    ok('entregarlas a Doña Rosa: resultado con XP', await until(async () => { const r = await resultScore(ana); return r && r.score >= 40; }, 15000));
    await closeModal(ana); await sleep(300);
    /* ---------- Guardianes del parque ---------- */
    await ana.evaluate(() => { window.__ciudad.api.vivoGames.field('guardianes', 11); });
    ok('Guardianes del parque: te lleva al parque y empieza', await until(() => ana.evaluate(() => window.__ciudad.api.sceneName === 'park' && window.__ciudad.api.vivoGames.active), 30000));
    await sleep(1200); await shot(ana, '24-guardianes');
    const g = await ana.evaluate(async () => { const F = await import('./js/edu/field-games.js'); const run = window.__ciudad.api.vivoGames.run; return { items: run.data.items.map(i => ({ ...i, type: F.TRASH.find(t => t.id === i.kind).type })), plants: run.data.plants, bins: F.BINS }; });
    for (const it of g.items) {
      await walk(ana, it.x, it.z + 0.6); await interact(ana, 'vg-' + it.id); await sleep(500);
      await choose(ana, it.type === 'peligroso' ? /avisar al guardaparques/ : /Recogerlo/); await sleep(900);
      if (it.type !== 'peligroso') { const b = g.bins.find(x => x.id === it.type); await walk(ana, b.x, b.z + 1.0); await interact(ana, 'vg-bote-' + b.id); await sleep(900); }
    }
    ok('separar la basura en su bote y reportar lo peligroso sin tocarlo', await ana.evaluate(() => { const st = window.__ciudad.api.vivoGames.run && window.__ciudad.api.vivoGames.run.st; return st && st.binned.length === 5 && st.reported.length === 1 && st.pen === 0; }), await ana.evaluate(() => JSON.stringify(window.__ciudad.api.vivoGames.run && window.__ciudad.api.vivoGames.run.st)));
    for (const p of g.plants) { await walk(ana, p.x * 0.9, p.z * 0.9); await interact(ana, 'vg-' + p.id); await sleep(900); }
    ok('regar las plantas termina el juego: resultado con XP', await until(async () => { const r = await resultScore(ana); return r && r.score >= 40; }, 15000));
    await closeModal(ana); await sleep(300);
    /* ---------- Carrera del Saber ---------- */
    await ana.evaluate(() => { window.__ciudad.api.games.raceStartUI(); }); await sleep(400);
    await until(async () => { if (await ana.evaluate(() => document.getElementById('dialog').hidden)) return true; await ana.evaluate(() => document.getElementById('dialog-next')?.click()); return false; }, 15000);
    ok('la carrera empieza con barreras de pregunta', await until(() => ana.evaluate(() => window.__ciudad.api.games.race && window.__ciudad.api.games.race.quiz && Object.keys(window.__ciudad.api.games.race.quiz).length === 2), 15000), await ana.evaluate(() => JSON.stringify(window.__ciudad.api.games.race)));
    const cps = await ana.evaluate(async () => (await import('./js/edu/activities.js')).RACE.checkpoints);
    const answerBarrier = () => ana.evaluate(async () => { const { QUESTIONS } = await import('./js/edu/questions.js'); const box = document.getElementById('choice'); if (!box || box.hidden) return false; const text = box.querySelector('.choice__text').textContent, q = QUESTIONS.find(x => text.includes(x.q)); if (!q) return false; const b = box.querySelector(`.choice__opt[data-id="${q.answer}"]`); if (b) b.click(); return Boolean(b); });
    let shotBarrier = false;
    for (let i = 0; i < cps.length; i++) {
      const [x, z, y] = cps[i];
      await ana.evaluate(async ([x, z, y]) => {
        const a = window.__ciudad.api, p = a.player.position;
        for (let k = 0; k < 600; k++) { if (!document.getElementById('choice').hidden) break; const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.2) break; if (y != null && d < 2.8) { p.y = y; a.player.grounded = true; a.player.vy = 0; } const s = Math.min(d, 0.3); p.x += dx / d * s; p.z += dz / d * s; await new Promise(r => setTimeout(r, 80)); }
        if (y != null) { p.y = y; a.player.grounded = true; a.player.vy = 0; }
        await new Promise(r => setTimeout(r, 400));
      }, [x, z, y == null ? null : y]);
      for (let tries = 0; tries < 40; tries++) {
        if (await ana.evaluate(i => !window.__ciudad.api.games.race || window.__ciudad.api.games.race.next > i, i)) break;
        if (await ana.evaluate(() => !document.getElementById('choice').hidden)) { if (!shotBarrier) { await shot(ana, '25-barrera'); shotBarrier = true; } await answerBarrier(); await sleep(900);
          await ana.evaluate(async ([x, z, y]) => { const a = window.__ciudad.api, p = a.player.position; for (let k = 0; k < 200; k++) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.2) break; const s = Math.min(d, 0.3); p.x += dx / d * s; p.z += dz / d * s; await new Promise(r => setTimeout(r, 80)); } if (y != null) { p.y = y; a.player.grounded = true; } }, [x, z, y == null ? null : y]); }
        await sleep(300);
      }
    }
    ok('Carrera del Saber: barreras abiertas con la respuesta correcta y meta validada por el servidor', await until(async () => { const r = await ana.evaluate(() => { const c = window.__ciudad.api.store.state.play.act.carrera; return c && c.done; }); return r; }, 20000), await ana.evaluate(() => JSON.stringify(window.__ciudad.api.games.race)));
    ok('apareció la barrera con pregunta y se respondió en el juego', shotBarrier);
    await until(async () => { await ana.evaluate(() => { const bs = [...document.querySelectorAll('#modal-actions button')]; (bs.find(b => /Cerrar|Continuar/.test(b.textContent)) || bs[0])?.click(); }); await sleep(300); return ana.evaluate(() => document.getElementById('modal').hidden); }, 8000);
    /* ---------- Expedición del conocimiento ---------- */
    await ana.evaluate(() => window.__ciudad.api.games.goTo('plaza')); await until(() => ana.evaluate(() => window.__ciudad.api.sceneName === 'plaza'), 30000); await sleep(1500);
    await walk(ana, 0, 6);
    await ana.evaluate(() => { window.__ciudad.api.vivoGames.field('expedicion', 21); }); await sleep(1200);
    await dialogThrough(ana);
    ok('Expedición: empieza con cuatro pistas', await until(() => ana.evaluate(() => window.__ciudad.api.vivoGames.run && window.__ciudad.api.vivoGames.run.data.stamps.length === 4), 10000));
    const stamps = await ana.evaluate(async () => { const F = await import('./js/edu/field-games.js'); return window.__ciudad.api.vivoGames.run.data.stamps.map(id => F.STAMPS.find(s => s.id === id)); });
    for (const s of stamps) {
      if (await ana.evaluate(() => window.__ciudad.api.sceneName) !== s.scene) { await ana.evaluate(sc => window.__ciudad.api.games.goTo(sc), s.scene); await until(() => ana.evaluate(sc => window.__ciudad.api.sceneName === sc, s.scene), 30000); await sleep(1500); }
      await walk(ana, s.fx, s.fz + (s.fz > 0 ? -0.8 : 0.8));
      for (let t = 0; t < 4; t++) {
        if (await ana.evaluate(id => window.__ciudad.api.vivoGames.run && window.__ciudad.api.vivoGames.run.st.got.includes(id), s.id)) break;
        if (await ana.evaluate(() => document.getElementById('choice').hidden)) { await interact(ana, 'vg-sello-' + s.id); await sleep(600); }
        await until(() => ana.evaluate(() => !document.getElementById('choice').hidden), 5000);
        await answerBarrier(); await sleep(1500);
      }
    }
    ok('cuatro sellos en distintos escenarios, cada uno validado por lugar y respuesta', await ana.evaluate(() => window.__ciudad.api.vivoGames.run && window.__ciudad.api.vivoGames.run.st.got.length === 4), await ana.evaluate(() => JSON.stringify(window.__ciudad.api.vivoGames.run && window.__ciudad.api.vivoGames.run.st)));
    if (await ana.evaluate(() => window.__ciudad.api.sceneName) !== 'plaza') { await ana.evaluate(() => window.__ciudad.api.games.goTo('plaza')); await until(() => ana.evaluate(() => window.__ciudad.api.sceneName === 'plaza'), 30000); await sleep(1500); }
    await walk(ana, 0, 6); await interact(ana, 'vg-meta');
    ok('volver a la fuente termina la expedición', await until(async () => { const r = await resultScore(ana); return r && r.score >= 40; }, 15000));
    await shot(ana, '26-expedicion'); await closeModal(ana);
    ok('logros de Mundo vivo calculados por el servidor', await until(() => ana.evaluate(() => ['buen-vecino', 'rescatista-responsable', 'guardian-del-planeta', 'amigo-de-los-animales', 'comerciante-justo', 'corazon-empatico', 'expedicionario'].every(a => window.__ciudad.api.store.state.achievements.includes(a))), 8000), await ana.evaluate(() => window.__ciudad.api.store.state.achievements.join(',')));
    ok('sin errores de JavaScript', ana.errs.length === 0, ana.errs.join(' | '));
  } catch (e) { ok('la prueba terminó sin excepciones', false, e.stack); }
  finally {
    await browser.close(); server.kill();
    const fails = results.filter(r => r[0] === 'FAIL').length;
    console.log(`\n${results.length - fails}/${results.length} comprobaciones correctas`);
    process.exit(fails ? 1 : 0);
  }
})();
