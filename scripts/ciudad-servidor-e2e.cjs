'use strict';
// Ciudad ICADEM · los juegos completados en un navegador real CONECTADO al servidor de
// sesiones (el mismo código que se desplegará en Railway, en modo de prueba local).
// Comprueba, por cada juego: se entra por la puerta (el servidor acepta la transición), se
// completa con las acciones reales, el SERVIDOR reproduce la bitácora y acredita; el perfil
// que devuelve el servidor es el que muestra el juego. Después: reconectar conserva todo
// (persistencia), repetir no duplica y una bitácora falsificada no acredita.
//
// Uso:  node scripts/ciudad-servidor-e2e.cjs http://127.0.0.1:8766
//       (requiere `npm install` en _ciudad-server; el servidor se arranca solo)
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw;
const ALL = require('./ciudad-games-plan.cjs').GAMES;
// ONLY=bank,court sirve para probar el cliente publicado hoy (solo dos juegos) contra el servidor nuevo.
const GAMES = process.env.ONLY ? ALL.filter(g => process.env.ONLY.split(',').includes(g.key)) : ALL;
const BASE = (process.argv[2] || 'http://127.0.0.1:8765').replace(/\/$/, '');
const PORT = 8793;
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-srv-'));
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra)]); if (process.env.VERBOSE) console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  →  ' + extra)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '_ciudad-server', 'server.js')], { env: { ...process.env, PORT: String(PORT), CIUDAD_AUTH: 'test', NODE_ENV: 'development', CIUDAD_DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.log = [];
  child.stdout.on('data', d => child.log.push(String(d)));
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/servidor de PRUEBA/.test(String(d))) resolve(child); }); child.stderr.on('data', d => reject(new Error(String(d)))); setTimeout(() => reject(new Error('el servidor no arrancó')), 8000); });
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', args: GL }).catch(() => chromium.launch({ args: GL }));
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.errs = [];
    page.on('pageerror', e => page.errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&tutorial=0&scene=plaza&mp=ws://127.0.0.1:${PORT}&uid=piloto&name=Piloto`);
    for (let i = 0; i < 60; i++) { if (await page.evaluate(() => window.__ciudad && window.__ciudad.api.net.status === 'online').catch(() => false)) break; await sleep(500); }
    return page;
  };
  const waitScene = async (page, name) => { for (let i = 0; i < 60; i++) { if ((await page.evaluate(() => window.__ciudad.api.sceneName)) === name && !(await page.evaluate(() => document.getElementById('fade').classList.contains('is-on')))) return true; await sleep(250); } return false; };
  // Respuesta del servidor a la misión: se escucha el evento 'profile' del adaptador de red.
  const listen = page => page.evaluate(() => { window.__srv = []; window.__fix = window.__fix || []; window.__ciudad.api.net.on('fix', m => window.__fix.push(m.reason)); window.__ciudad.api.net.on('profile', m => window.__srv.push({ op: m.op, ok: m.ok, mission: m.mission, credits: m.credits, score: m.score, reason: m.reason, coins: m.profile && m.profile.coins, testCredits: m.profile && m.profile.testCredits })); });

  try {
    let page = await open();
    ok('el juego se conecta al servidor de sesiones', await page.evaluate(() => window.__ciudad.api.net.status === 'online'));
    await listen(page);
    let expected = 0, lastCoins = null;   // créditos de prueba (historial) y monedas del juego que confirma el servidor
    for (const G of GAMES) {
      const tag = `[${G.key}]`;
      // entrar como jugador: plaza frente a la puerta → puerta → escena (el servidor valida la transición)
      // Atajo de la prueba: saltar por la plaza a la siguiente puerta. El antitrampas del servidor lo
      // corrige (es un teletransporte) y eso NO cuenta; lo que se mide empieza en la puerta.
      await page.evaluate(sp => window.__ciudad.api.travel('plaza', sp), G.spawn); await waitScene(page, 'plaza'); await sleep(1800);
      await page.evaluate(() => { window.__fix.length = 0; });
      await page.evaluate(door => { window.__ciudad.api.scene.interactables.find(i => i.id === 'door-' + door).action(); return true; }, G.door);
      await waitScene(page, G.scene); await sleep(900);
      // el servidor no debe haber rechazado la entrada (si la rechaza, corrige la posición con 'fix')
      // completar con las acciones reales y cerrar con el controlador común (envía la bitácora al servidor)
      const played = await page.evaluate(async ({ key, perfect, needsCase, talkAction }) => {
        const m = window.__ciudad.api.missions[key];
        if (needsCase) { if (!m.run.act('takeCase', { id: 'exp-014' })) return 'no abrió el expediente'; }
        else if (!m.run.act(talkAction || 'talk')) return 'no abrió la misión';
        const steps = await (new Function(`return (async () => { ${perfect} })();`))();
        for (const [type, payload] of steps) if (!m.run.act(type, payload || {})) return 'falló: ' + type;
        m.finish(() => ({ rows: [['Prueba', 100, 100]], heading: 'ok', paragraphs: [] }));
        return 'listo';
      }, G);
      let reply = null;
      for (let i = 0; i < 40 && !reply; i++) { await sleep(250); reply = await page.evaluate(id => window.__srv.find(r => r.op === 'mission' && r.mission === id), G.mission); }
      expected += G.credits;
      ok(`${tag} el servidor reconoce la misión y la acredita (${G.credits} créditos de prueba)`, played === 'listo' && reply && reply.ok && reply.score === 100 && reply.credits === G.credits, JSON.stringify({ played, reply }));
      await page.evaluate(() => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => x.textContent.includes('Continuar')); b && b.click(); });
      await sleep(500);
      const shown = await page.evaluate(() => window.__ciudad.api.store.state.economy.balance); if (reply) lastCoins = reply.coins;
      // Ciudad 2.0: el HUD muestra las MONEDAS del juego que guarda el servidor; los créditos de prueba quedan como historial.
      ok(`${tag} el saldo que muestra el juego es el del servidor (monedas)`, reply && Number.isFinite(reply.coins) && shown === reply.coins, JSON.stringify({ shown, server: reply && reply.coins }));
      await page.evaluate(() => { window.__ciudad.api.scene.interactables.find(i => i.id === 'exit').action(); return true; });
      await waitScene(page, 'plaza'); await sleep(1200);
      const fixes = await page.evaluate(() => window.__fix.slice());
      ok(`${tag} el servidor acepta la entrada por la puerta, el juego y la salida (ningún estado rechazado)`, fixes.length === 0, JSON.stringify(fixes));
    }
    ok(`sin errores de JavaScript durante los ${GAMES.length} juegos`, page.errs.length === 0, page.errs.slice(0, 3).join(' | '));
    await page.close();

    // persistencia: otra conexión de la misma cuenta recibe el perfil del servidor
    page = await open(); await listen(page);
    const st = await page.evaluate(ids => { const s = window.__ciudad.api.store.state; return { bal: s.economy.balance, done: ids.filter(id => s.missions[id] && s.missions[id].completed).length }; }, GAMES.map(g => g.mission));
    ok(`al reconectar, el servidor devuelve los ${GAMES.length} juegos completados y las ${lastCoins} monedas`, st.bal === lastCoins && st.done === GAMES.length, JSON.stringify(st));

    // repetir un juego no duplica créditos en el servidor
    const H = GAMES[GAMES.length - 1];
    await page.evaluate(sp => window.__ciudad.api.travel('plaza', sp), H.spawn); await waitScene(page, 'plaza'); await sleep(600);
    await page.evaluate(door => { window.__ciudad.api.scene.interactables.find(i => i.id === 'door-' + door).action(); return true; }, H.door); await waitScene(page, H.scene); await sleep(800);
    await page.evaluate(async ({ key, perfect, talkAction, needsCase }) => {
      const m = window.__ciudad.api.missions[key]; if (needsCase) m.run.act('takeCase', { id: 'exp-014' }); else m.run.act(talkAction || 'talk');
      const steps = await (new Function(`return (async () => { ${perfect} })();`))();
      for (const [type, payload] of steps) m.run.act(type, payload || {});
      m.finish(() => ({ rows: [['Prueba', 100, 100]], heading: 'ok', paragraphs: [] }));
    }, H);
    let again = null; for (let i = 0; i < 40 && !again; i++) { await sleep(250); again = await page.evaluate(() => window.__srv.find(r => r.op === 'mission')); }
    ok(`repetir ${H.key}: el servidor da 0 créditos y como mucho el premio pequeño de repetición (4 monedas)`, again && again.ok && again.credits === 0 && again.coins >= lastCoins && again.coins <= lastCoins + 4, JSON.stringify({ again, lastCoins }));

    // una bitácora falsificada desde la consola no acredita
    await page.evaluate(() => { window.__srv.length = 0; window.__ciudad.api.net.profile('mission', { mission: 'banco-credito-correcto', log: [{ type: 'talk' }, { type: 'choose', payload: { id: 'pyme' } }] }); });
    let forged = null; for (let i = 0; i < 20 && !forged; i++) { await sleep(250); forged = await page.evaluate(() => window.__srv.find(r => r.op === 'mission')); }
    ok('una bitácora falsificada enviada desde el navegador se rechaza', forged && forged.ok === false, JSON.stringify(forged));
    await page.close();
  } finally {
    await browser.close();
    await new Promise(r => { server.once('exit', r); server.kill('SIGKILL'); });
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  let fails = 0;
  for (const [st, name, extra] of results) { if (st === 'FAIL') fails++; console.log(`${st}  ${name}${extra ? '  →  ' + extra : ''}`); }
  console.log(`\n${results.length - fails}/${results.length} comprobaciones contra el servidor`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('La prueba se interrumpió: ' + e.message); process.exit(1); });
