'use strict';
// Ciudad ICADEM · Fase 1.1 en navegadores reales conectados al servidor de sesiones (modo de prueba):
// jugadores en línea, panel social, código de invitación con enlace, privacidad, NPC con preguntas
// validadas por el servidor y un minijuego con XP del servidor.
//
// Uso:  node scripts/ciudad-fase11-e2e.cjs http://127.0.0.1:8766
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const PORT = 8796;
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-f11-'));
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name]); console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  →  ' + String(extra).slice(0, 300))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await sleep(250); } return false; };

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '_ciudad-server', 'server.js')], { env: { ...process.env, PORT: String(PORT), CIUDAD_AUTH: 'test', NODE_ENV: 'development', CIUDAD_DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/servidor de PRUEBA/.test(String(d))) resolve(child); }); child.stderr.on('data', d => reject(new Error(String(d)))); setTimeout(() => reject(new Error('el servidor no arrancó')), 8000); });
}

(async () => {
  const server = await startServer();
  const browser = await pw.chromium.launch({ args: GL });
  const open = async (uid, name, extra = '', vp = { width: 1100, height: 700 }) => {
    const ctx = await browser.newContext({ viewport: vp }), page = await ctx.newPage(); page.errs = []; page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', e => page.errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&tutorial=0&scene=plaza&mp=ws://127.0.0.1:${PORT}&uid=${uid}&name=${name}${extra}`);
    await until(() => page.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline), 40000);
    await page.evaluate(() => { const a = window.__ciudad.api; a.store.state.settings.npcQuiz = false; window.__toasts = []; const t = a.ui.toast.bind(a.ui); a.ui.toast = (x, ms) => { window.__toasts.push(x); return t(x, ms); }; });
    return page;
  };
  const tap = async (page, sel) => { await until(() => page.evaluate(s => Boolean(document.querySelector(s)), sel), 15000); return page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('no existe ' + s); el.click(); }, sel); };
  const close = p => p.evaluate(() => { const bs = [...document.querySelectorAll('#modal-actions button')]; (bs.find(b => /Cerrar|Continuar/.test(b.textContent)) || bs[0])?.click(); });
  const walk = (page, x, z, y = null, step = 0.45) => page.evaluate(async ([x, z, y, step]) => {
    const a = window.__ciudad.api, p = a.player.position;
    for (let i = 0; i < 600; i++) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.2) break; const s = Math.min(d, step); p.x += dx / d * s; p.z += dz / d * s; await new Promise(r => setTimeout(r, 80)); }
    if (y !== null) { p.y = y; a.player.grounded = true; a.player.vy = 0; }
    await new Promise(r => setTimeout(r, 400));
  }, [x, z, y, step]);

  try {
    const ana = await open('ana', 'Ana'), beto = await open('beto', 'Beto');
    ok('el indicador muestra «Jugadores en línea · 2» (cuenta del servidor; los NPC no cuentan)', await until(async () => (await ana.evaluate(() => document.getElementById('net-chip').textContent)) === 'Jugadores en línea · 2' && (await beto.evaluate(() => document.getElementById('net-chip').textContent)) === 'Jugadores en línea · 2'), await ana.evaluate(() => document.getElementById('net-chip').textContent));
    ok('hay NPC caminando, pero no aparecen como jugadores', (await ana.evaluate(() => window.__ciudad.api.scene.npcs.length)) >= 5 && (await ana.evaluate(() => window.__ciudad.api.net.roster.size)) === 1);
    await tap(ana, '#net-chip'); await sleep(500);
    ok('el panel social abre con sus cuatro pestañas y el conteo real', await ana.evaluate(() => [...document.querySelectorAll('.social__tab')].map(b => b.dataset.tab).join() === 'ciudad,amigos,invitaciones,equipo' && document.querySelector('.social__stats b').textContent === '2'));
    await tap(ana, '.social__tab[data-tab="invitaciones"]'); await sleep(300);
    await ana.evaluate(() => { const s = document.getElementById('code-uses'); s.value = '1'; }); await tap(ana, '#code-create');
    ok('se crea un código temporal desde el panel', await until(() => ana.evaluate(() => Boolean(document.querySelector('.code-card')))));
    const code = await ana.evaluate(() => document.querySelector('.code-card').dataset.code);
    await tap(ana, '#code-create'); await until(() => ana.evaluate(() => document.querySelectorAll('.code-card').length === 2));
    await ana.evaluate(c => { [...document.querySelectorAll('.code-card')].find(x => x.dataset.code !== c).querySelector('.code-card__acts button:last-child').click(); }, code);
    ok('un código se puede revocar', await until(() => ana.evaluate(() => document.querySelectorAll('.code-card').length === 1)));
    await close(ana);
    // Beto abre el enlace de invitación: el juego pregunta antes de unirse
    await beto.close(); const beto2 = await open('beto', 'Beto', `&unirme=${code}`);
    ok('el enlace con código pregunta antes de unir', await until(() => beto2.evaluate(() => !document.getElementById('choice')?.hidden && /invitación/i.test(document.querySelector('.choice__text')?.textContent || ''))));
    await tap(beto2, '.choice__opt.is-primary');
    ok('con el código, los dos quedan en el mismo equipo', await until(async () => (await ana.evaluate(() => window.__ciudad.api.net.roomState?.members.length)) === 2 && (await beto2.evaluate(() => window.__ciudad.api.net.roomState?.members.length)) === 2));
    ok('quien invitó recibe el aviso', await until(() => ana.evaluate(() => window.__toasts.some(t => /se unió a tu equipo con tu código/.test(t)))));
    const carla = await open('carla', 'Carla', `&unirme=${code}`);
    await until(() => carla.evaluate(() => !document.getElementById('choice')?.hidden)); await tap(carla, '.choice__opt.is-primary');
    ok('un código de un solo uso ya no sirve', await until(() => carla.evaluate(() => window.__toasts.some(t => /no existe, ya venció o ya se usó/.test(t)))));
    // privacidad
    await tap(ana, '#net-chip'); await sleep(400); await tap(ana, '#privacy-listed'); await sleep(300); await close(ana);
    ok('con la privacidad activa, un desconocido ve «Jugador privado»; el equipo sí ve su nombre', await until(async () => (await carla.evaluate(() => [...window.__ciudad.api.net.roster.values()].map(p => p.name))).includes('Jugador privado') && (await beto2.evaluate(() => [...window.__ciudad.api.net.roster.values()].map(p => p.name))).includes('Ana')));
    const carlaErrs = carla.errs; await carla.context().close();   // libera el render por software para lo que sigue
    // NPC educativo: la respuesta la valida el servidor
    const xp0 = await ana.evaluate(() => window.__ciudad.api.store.state.xp);
    const found0 = await ana.evaluate(() => (window.__ciudad.api.store.state.discovered || []).length);
    // Se camina hacia el personaje (teletransportarse lo corrige el antitrampas del servidor). Los NPC
    // siguen su ruta: si se aleja antes de llegar, desiste (así debe ser) y se intenta otra vez.
    const offered = () => ana.evaluate(() => !document.getElementById('choice')?.hidden && /pregunta/.test(document.querySelector('.choice__text')?.textContent || ''));
    let approached = false, why = '';
    for (let attempt = 0; attempt < 3 && !approached; attempt++) {
      // se espera en el siguiente punto de su ruta (lugar caminable): el personaje viene hacia ahí
      const memo = await ana.evaluate(() => { const n = window.__ciudad.api.scene.npcs.find(x => x.quizName === 'Don Memo'); return n.route[n.leg]; });
      await walk(ana, memo[0], memo[1]);
      await ana.evaluate(() => { const a = window.__ciudad.api; a.store.state.settings.npcQuiz = true; a.npcQuiz.cool = 0; a.npcQuiz.calm = 5; a.npcQuiz.last = new Map(); a.npcQuiz.lastAbort = ''; });
      // El render por software corre en cámara lenta (~1–2 cuadros/s): el personaje puede tardar más de 30 s
      // reales en recorrer su tramo. Se espera mientras siga acercándose (sin desistir), hasta 75 s.
      approached = await until(async () => (await offered()) || (await ana.evaluate(() => Boolean(window.__ciudad.api.npcQuiz.lastAbort))), 75000) && await offered();
      why = await ana.evaluate(() => { const a = window.__ciudad.api, q = a.npcQuiz, me = a.player.position, m = document.getElementById('modal'), c = document.getElementById('choice');
        return JSON.stringify({ abort: q.lastAbort || '', blocking: a.ui.isBlocking, modal: m.hidden ? null : document.getElementById('modal-title').textContent, choice: c && !c.hidden ? document.querySelector('.choice__text').textContent : null,
          cool: +q.cool.toFixed(1), calm: +q.calm.toFixed(1), walker: Boolean(q.walker), busy: q.busy, scene: a.sceneName, games: Boolean(a.games && a.games.active), seat: Boolean(a.player.seat), tut: Boolean(a.tutorial && a.tutorial.active),
          npcs: a.scene.npcs.filter(n => n.quizName).map(n => [n.quizName, +Math.hypot(n.group.position.x - me.x, n.group.position.z - me.z).toFixed(1), n.talking]) }); });
    }
    ok('un NPC educativo se acerca y propone un reto', approached, why + ' errores:' + JSON.stringify(ana.errs.slice(-3)));
    await tap(ana, '.choice__opt.is-primary'); await until(() => ana.evaluate(() => Boolean(document.querySelector('.quiz__q'))));
    const right = await ana.evaluate(async () => { const { QUESTIONS } = await import('./js/edu/questions.js'); const q = QUESTIONS.find(x => x.q === document.querySelector('.quiz__q').textContent); return q.answer; });
    await tap(ana, `.quiz__opt[data-i="${right}"]`);
    ok('al acertar: «¡Felicidades! Has ganado 10 XP» (validado y guardado por el servidor)', await until(async () => /Has ganado 10 XP/.test(await ana.evaluate(() => document.querySelector('.quiz__feedback')?.textContent || '')) && (await ana.evaluate(() => window.__ciudad.api.store.state.xp - 15 * (window.__ciudad.api.store.state.discovered || []).length)) === xp0 - 15 * found0 + 10));   // sin contar la XP de la Ruta del explorador (1.3)
    await close(ana); await ana.evaluate(() => { window.__ciudad.api.store.state.settings.npcQuiz = false; });
    // un error: el navegador manda la elección, el servidor dice cuál era
    const wrong = await ana.evaluate(async () => { const { QUESTIONS } = await import('./js/edu/questions.js'); const q = QUESTIONS.find(x => x.id === 'mex-sat'); return window.__ciudad.api.edu.quiz(q.id, 0); });
    ok('al fallar: sin XP y el servidor indica la respuesta correcta con su explicación', wrong.correct === false && wrong.xp === 0 && wrong.answer === 1 && /Servicio de Administración Tributaria/.test(wrong.explain), JSON.stringify(wrong));
    // minijuego con XP del servidor
    await tap(ana, '#btn-games'); await sleep(400); await tap(ana, '.arcade__card[data-game="idiomas"]'); await sleep(500); await tap(ana, '.choice__opt[data-id="infantil"]'); await sleep(500);
    await until(() => ana.evaluate(() => Boolean(document.querySelector('.lang__prompt'))));
    for (let i = 0; i < 8; i++) { await until(() => ana.evaluate(() => document.querySelectorAll('.quiz__opt:not(.is-right):not(.is-wrong)').length === 3)); await ana.evaluate(async () => { const { VOCAB } = await import('./js/edu/activities.js'); const pr = document.querySelector('.lang__prompt').textContent.replace(/[«»]/g, ''); const w = VOCAB.find(v => v.emoji === pr || v.en === pr); const want = document.querySelector('.lang__prompt').classList.contains('is-emoji') ? w.en : w.es; [...document.querySelectorAll('.quiz__opt')].find(b => b.textContent.slice(1) === want).click(); }); await sleep(900); }
    ok('Aventura de idiomas: el servidor califica 100 y da XP (+bono de primera vez)', await until(() => ana.evaluate(() => /100de 100\+50 XP/.test(document.querySelector('.mg-result')?.textContent || ''))), await ana.evaluate(() => document.querySelector('.mg-result')?.textContent));
    ok('logro educativo «Políglota» desbloqueado por el servidor', await until(() => ana.evaluate(() => window.__ciudad.api.store.state.achievements.includes('poliglota'))));
    await close(ana); await sleep(400);
    // La carrera y la búsqueda del tesoro (validadas por posición) tienen su propia prueba:
    // scripts/ciudad-retos-e2e.cjs (un solo jugador; los recorridos largos agotan el render por software).
    // reconexión: Beto recarga y sigue en el equipo
    await beto2.reload(); await until(() => beto2.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline), 40000);
    ok('al recargar, sigue en su equipo', await until(() => beto2.evaluate(() => window.__ciudad.api.net.roomState?.members.length === 2)));
    ok('sin errores de JavaScript', !ana.errs.length && !beto2.errs.length && !carlaErrs.length, JSON.stringify([...ana.errs, ...beto2.errs, ...carlaErrs]));
  } catch (e) { ok('el recorrido terminó sin excepciones', false, e.stack || e.message); }
  finally {
    await browser.close(); server.kill();
    const pass = results.filter(r => r[0] === 'PASS').length;
    console.log(`\n${pass}/${results.length} comprobaciones de la fase 1.1`);
    process.exit(pass === results.length ? 0 : 1);
  }
})();
