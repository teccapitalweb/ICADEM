'use strict';
// Ciudad ICADEM · misiones EN EQUIPO en navegadores reales conectados al servidor de sesiones
// (modo de prueba local). Dos jugadores arman equipo con la sala de espera real (código,
// roles, listos, iniciar), entran juntos a la Torre y al Tribunal, y cada quien hace SOLO lo
// de su rol. Se comprueba: el servidor sincroniza el intento, rechaza pasos de otro rol, exige
// consenso, sobrevive a una recarga, y al cerrar entrega el resultado a los dos sin duplicar.
//
// Uso:  node scripts/ciudad-equipo-e2e.cjs http://127.0.0.1:8766
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const PORT = 8795;
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-eq-'));
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra)]); console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  →  ' + extra)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await sleep(200); } return false; };

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '_ciudad-server', 'server.js')], { env: { ...process.env, PORT: String(PORT), CIUDAD_AUTH: 'test', NODE_ENV: 'development', CIUDAD_DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/servidor de PRUEBA/.test(String(d))) resolve(child); }); child.stderr.on('data', d => reject(new Error(String(d)))); setTimeout(() => reject(new Error('el servidor no arrancó')), 8000); });
}

(async () => {
  const server = await startServer();
  const browser = await pw.chromium.launch({ args: GL });
  const open = async (uid, name) => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } }); page.errs = [];
    page.on('pageerror', e => page.errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); });
    page.url0 = `${BASE}/ciudad/index.html?autostart=1&debug=1&tutorial=0&scene=plaza&mp=ws://127.0.0.1:${PORT}&uid=${uid}&name=${name}`;
    await page.goto(page.url0);
    await until(() => page.evaluate(() => window.__ciudad && window.__ciudad.api.net.status === 'online'), 30000);
    await page.evaluate(() => { window.__toasts = []; const t = window.__ciudad.api.ui.toast.bind(window.__ciudad.api.ui); window.__ciudad.api.ui.toast = (x, ms) => { window.__toasts.push(x); return t(x, ms); }; });
    return page;
  };
  const closeModal = page => page.evaluate(() => { const bs = [...document.querySelectorAll('#modal-actions button')]; (bs.find(b => /Cerrar|Continuar/.test(b.textContent)) || bs[0])?.click(); });
  const clickId = (page, sel) => page.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel);
  const scene = page => page.evaluate(() => !document.getElementById('fade').classList.contains('is-on') && window.__ciudad.api.sceneName);
  const enter = async (page, spawn, door, target) => {
    await page.evaluate(sp => window.__ciudad.api.travel('plaza', sp), spawn); await until(async () => (await scene(page)) === 'plaza');
    await sleep(1200);
    await page.evaluate(d => { window.__ciudad.api.scene.interactables.find(i => i.id === 'door-' + d).action(); }, door);
    const okEnter = await until(async () => (await scene(page)) === target);
    if (!okEnter) console.log('  diag:', JSON.stringify(await page.evaluate(() => ({ scene: window.__ciudad.api.sceneName, blocking: window.__ciudad.api.ui.isBlocking, modal: !document.getElementById('modal').hidden, dialog: !document.getElementById('dialog').hidden, toasts: window.__toasts.slice(-4) }))));
    return okEnter;
  };
  const dialogs = page => page.evaluate(() => { if (!document.getElementById('dialog').hidden) document.getElementById('dialog-next')?.click(); });
  const act = (page, key, type, payload) => page.evaluate(([k, t, p]) => window.__ciudad.api.missions[k].act(t, p), [key, type, payload]);
  const stateOf = (page, key) => page.evaluate(k => JSON.parse(JSON.stringify(window.__ciudad.api.missions[k].state)), key);

  async function team(a, b, mission, roleA, roleB) {
    await a.evaluate(m => { window.__ciudad.api.social.openLobby(m); }, mission); await sleep(300);
    await clickId(a, '#lobby-create'); await until(() => a.evaluate(() => Boolean(document.querySelector('.lobby__codeview'))));
    const code = await a.evaluate(() => document.querySelector('.lobby__codeview').textContent);
    await b.evaluate(m => { window.__ciudad.api.social.openLobby(m); }, mission); await sleep(300);
    await b.fill('#lobby-code', code); await clickId(b, '#lobby-join');
    await until(() => a.evaluate(() => document.querySelectorAll('.players__row').length === 2));
    await clickId(a, `.lobby__role[data-role="${roleA}"]`); await sleep(300); await clickId(b, `.lobby__role[data-role="${roleB}"]`);
    await until(() => a.evaluate(r => Boolean(document.querySelector(`.lobby__role.is-taken[data-role="${r}"]`)), roleB));
    await clickId(a, '#lobby-ready'); await clickId(b, '#lobby-ready');
    await until(() => a.evaluate(() => [...document.querySelectorAll('.players__row .pill--ok')].length === 2));
    await clickId(a, '#lobby-start');
    return code;
  }

  try {
    const ana = await open('ana', 'Ana'), beto = await open('beto', 'Beto');
    ok('los dos jugadores se conectan al servidor', await ana.evaluate(() => window.__ciudad.api.net.isOnline) && await beto.evaluate(() => window.__ciudad.api.net.isOnline));

    /* ---------------- Torre ICADEM ---------------- */
    const code = await team(ana, beto, 'torre-desafio-equipos', 'finanzas', 'legal');
    ok('[torre] la sala de espera real arma el equipo con código', /^[A-Z2-9]{6}$/.test(code), code);
    const started = await until(async () => (await ana.evaluate(() => window.__ciudad.api.missions.tower.coop?.role)) === 'finanzas' && (await beto.evaluate(() => window.__ciudad.api.missions.tower.coop?.role)) === 'legal');
    ok('[torre] el servidor inicia el intento del equipo y reparte los roles', started);
    await closeModal(ana); await closeModal(beto); await sleep(300);
    ok('[torre] los dos entran a la Torre por la puerta', await enter(ana, 'tower', 'torre', 'tower') && await enter(beto, 'tower', 'torre', 'tower'));
    ok('[torre] dentro de la sala del equipo se ven entre sí', await until(() => ana.evaluate(() => window.__ciudad.api.remotes.map.size === 1) , 8000));
    ok('[torre] el rastreador indica el modo en equipo y el rol', await ana.evaluate(() => document.getElementById('tracker')?.textContent.includes('En equipo · Finanzas')));

    await act(ana, 'tower', 'brief');
    ok('[torre] lo que hace uno aparece en la pantalla del otro', await until(async () => (await stateOf(beto, 'tower')).briefed === true));
    ok('[torre] el presupuesto no lo puede enviar Legal', (await act(beto, 'tower', 'budget', { computers: 'nuevo', contingency: 5 })) === false && await beto.evaluate(() => window.__toasts.some(t => t.includes('le toca a Finanzas'))));
    // aunque el navegador se salte su propia validación, el servidor lo rechaza
    await beto.evaluate(() => window.__ciudad.api.net.coop('act', { type: 'budget', payload: { computers: 'nuevo', contingency: 5 } }));
    ok('[torre] el servidor rechaza el paso de otro rol aunque el navegador lo envíe', await until(() => beto.evaluate(() => window.__toasts.some(t => t.includes('le toca a otro rol')))) && (await stateOf(ana, 'tower')).budget === null);
    await act(ana, 'tower', 'budget', { computers: 'nuevo', contingency: 5 });
    await act(beto, 'tower', 'permits', { ids: ['uso-suelo', 'construccion', 'proteccion-civil'] });
    await until(async () => { const s = await stateOf(beto, 'tower'); return s.budget && s.permits; });
    // recarga a media misión: vuelve con su rol y con lo que ya hizo el equipo
    await beto.goto(beto.url0); await until(() => beto.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline), 30000);
    const back = await until(async () => { const s = await stateOf(beto, 'tower'); return s.budget && s.permits && (await beto.evaluate(() => window.__ciudad.api.missions.tower.coop?.role)) === 'legal'; });
    ok('[torre] al recargar la página recupera el equipo, su rol y el avance', back);
    await beto.evaluate(() => { window.__toasts = []; const t = window.__ciudad.api.ui.toast.bind(window.__ciudad.api.ui); window.__ciudad.api.ui.toast = (x, ms) => { window.__toasts.push(x); return t(x, ms); }; });
    ok('[torre] sin Operaciones ni Comunicación en el equipo, cualquiera cubre esas estaciones', (await act(ana, 'tower', 'schedule', { ids: ['tramites', 'cimentacion', 'estructura', 'instalaciones', 'mobiliario'] })) && (await act(beto, 'tower', 'message', { text: 'claro', channels: ['asamblea', 'carteles'] })));
    await until(async () => (await stateOf(ana, 'tower')).message !== null);
    await act(ana, 'tower', 'approve', {});
    await until(async () => (await stateOf(beto, 'tower')).approvals.length === 1);
    ok('[torre] no se presenta sin la aprobación de todo el equipo', (await act(ana, 'tower', 'present', { reasons: ['especialidad'] })) === false);
    await act(beto, 'tower', 'approve', {});
    await until(async () => (await stateOf(ana, 'tower')).approvals.length === 2);
    await ana.evaluate(() => { const m = window.__ciudad.api.missions.tower; m.act('present', { reasons: ['especialidad', 'dependencias'] }); m.close(); });
    const shown = await until(async () => {
      await dialogs(ana); await dialogs(beto);
      const r = await Promise.all([ana, beto].map(p => p.evaluate(() => { const e = document.querySelector('.result__score b'); return e ? e.textContent + '|' + document.querySelector('.result__rewards').textContent : ''; })));
      return r.every(x => x.startsWith('100|') && x.includes('+20 créditos de prueba'));
    }, 15000);
    ok('[torre] los DOS ven el resultado del servidor: 100 y +20 créditos de prueba', shown, JSON.stringify(await Promise.all([ana, beto].map(p => p.evaluate(() => document.querySelector('.result__rewards')?.textContent)))));
    await closeModal(ana); await closeModal(beto); await sleep(800);
    const bal = await Promise.all([ana, beto].map(p => p.evaluate(() => window.__ciudad.api.store.state.economy.balance)));
    ok('[torre] el saldo de prueba de cada uno lo fija el servidor (+20)', bal.every(x => x >= 20), JSON.stringify(bal));
    ok('[torre] al cerrar, cada quien vuelve al modo individual', await ana.evaluate(() => window.__ciudad.api.missions.tower.coop === null) && await beto.evaluate(() => window.__ciudad.api.missions.tower.coop === null));

    /* ---------------- Tribunal en equipo ---------------- */
    await ana.evaluate(() => { window.__ciudad.api.social.openLobby('tribunal-tu-eres-el-juez'); }); await sleep(400);
    await clickId(ana, '#lobby-switch'); await until(() => ana.evaluate(() => window.__ciudad.api.net.roomState?.mission === 'tribunal-tu-eres-el-juez'));
    await closeModal(ana);
    await ana.evaluate(() => { window.__ciudad.api.social.openLobby('tribunal-tu-eres-el-juez'); }); await beto.evaluate(() => { window.__ciudad.api.social.openLobby('tribunal-tu-eres-el-juez'); }); await sleep(500);
    await clickId(ana, '.lobby__role[data-role="juez"]'); await sleep(300); await clickId(beto, '.lobby__role[data-role="abogadoA"]');
    await until(() => ana.evaluate(() => Boolean(document.querySelector('.lobby__role.is-taken[data-role="abogadoA"]'))));
    await clickId(ana, '#lobby-ready'); await clickId(beto, '#lobby-ready');
    await until(() => ana.evaluate(() => [...document.querySelectorAll('.players__row .pill--ok')].length === 2));
    await clickId(ana, '#lobby-start');
    ok('[tribunal] el mismo equipo cambia de misión e inicia la audiencia', await until(async () => (await ana.evaluate(() => window.__ciudad.api.missions.court.coop?.role)) === 'juez' && (await beto.evaluate(() => window.__ciudad.api.missions.court.coop?.role)) === 'abogadoA'));
    await closeModal(ana); await closeModal(beto); await sleep(300);
    ok('[tribunal] los dos entran a la sala del Tribunal', await enter(ana, 'court', 'tribunal', 'court') && await enter(beto, 'court', 'tribunal', 'court'));
    const J = ana, A = beto, run = async (p, type, payload) => { const r = await act(p, 'court', type, payload); await sleep(120); return r; };
    ok('[tribunal] el abogado no puede pedir el expediente', (await run(A, 'takeCase', { id: 'exp-014' })) === false);
    await run(J, 'takeCase', { id: 'exp-014' }); await until(async () => (await stateOf(A, 'court')).caseId === 'exp-014');
    await run(A, 'readBackground', {});
    await until(async () => (await stateOf(A, 'court')).background === true);
    for (const id of ['contrato', 'inventario', 'cotizacion', 'mensajes', 'fotos']) await run(A, 'examineExhibit', { id });
    await until(async () => (await stateOf(J, 'court')).exhibits.length === 5);
    await run(J, 'openHearing', {}); await until(async () => (await stateOf(A, 'court')).opened);
    ok('[tribunal] el juez no presenta a la actora: lo hace su abogado', (await run(J, 'hearParty', { side: 'actora' })) === false && (await run(A, 'hearParty', { side: 'actora' })) === true);
    await until(async () => (await stateOf(J, 'court')).heard.length === 1);
    await run(J, 'hearParty', { side: 'demandada' }); await until(async () => (await stateOf(A, 'court')).heard.length === 2);
    ok('[tribunal] el abogado no resuelve objeciones', (await run(A, 'ruleObjection', { id: 'sugestiva', ruling: 'ha-lugar' })) === false);
    await run(J, 'ruleObjection', { id: 'sugestiva', ruling: 'ha-lugar' }); await run(J, 'ruleObjection', { id: 'fecha', ruling: 'no-ha-lugar' });
    await until(async () => Object.keys((await stateOf(A, 'court')).objections).length === 2);
    await run(A, 'examineWitness', { id: 'ruben' }); await until(async () => (await stateOf(J, 'court')).examined.length === 1);
    ok('[tribunal] el juez no interroga: pregunta el abogado', (await run(J, 'askWitness', { witness: 'ruben', id: 'r-boiler' })) === false && (await run(A, 'askWitness', { witness: 'ruben', id: 'r-boiler' })) === true);
    await until(async () => (await stateOf(J, 'court')).asked.length === 1);
    await run(J, 'ruleObjection', { id: 'oidas', ruling: 'ha-lugar' }); await until(async () => Object.keys((await stateOf(A, 'court')).objections).length === 3);
    await run(A, 'examineWitness', { id: 'sofia' }); await until(async () => (await stateOf(A, 'court')).examined.length === 2);
    await run(A, 'askWitness', { witness: 'sofia', id: 's-vidrio' }); await until(async () => (await stateOf(J, 'court')).asked.length === 2);
    await run(A, 'confront', { marks: { 'd-ernesto': 'mensajes', 'd-ruben': 'cotizacion', 'd-marta': null, 'd-sofia': null, 'd-edad': null } });
    await until(async () => Boolean((await stateOf(J, 'court')).confronted));
    const exhibits = await J.evaluate(async () => (await import('./js/missions/court-judge-logic.js')).EXHIBITS.map(e => [e.id, e.best]));
    for (const [id, weight] of exhibits) await run(J, 'weigh', { id, weight });
    await until(async () => Object.keys((await stateOf(A, 'court')).weights).length === exhibits.length);
    ok('[tribunal] la sentencia solo la dicta el juez', (await run(A, 'rule', { ruling: 'parcial', grounds: ['vidrio'] })) === false);
    await J.evaluate(() => { const m = window.__ciudad.api.missions.court; m.act('rule', { ruling: 'parcial', grounds: ['vidrio', 'recibido'] }); m.finish(() => ({ rows: [['Audiencia', 100, 100]], heading: 'ok', paragraphs: [] })); });
    const court = await until(async () => {
      await dialogs(J); await dialogs(A);
      const r = await Promise.all([J, A].map(p => p.evaluate(() => document.querySelector('.result__score b')?.textContent + '|' + (document.querySelector('.result__rewards')?.textContent || ''))));
      return r.every(x => x.startsWith('100|') && x.includes('+20 créditos de prueba'));
    }, 15000);
    ok('[tribunal] juez y abogado reciben el resultado del servidor (100, +20)', court, JSON.stringify(await Promise.all([J, A].map(p => p.evaluate(() => document.querySelector('.result__rewards')?.textContent)))));
    await closeModal(J); await closeModal(A); await sleep(600);
    ok('sin errores de JavaScript en ningún navegador', !ana.errs.length && !beto.errs.length, JSON.stringify([...ana.errs, ...beto.errs]).slice(0, 400));
  } catch (e) { ok('el recorrido terminó sin excepciones', false, e.stack || e.message); }
  finally {
    await browser.close(); server.kill();
    const pass = results.filter(r => r[0] === 'PASS').length;
    console.log(`\n${pass}/${results.length} comprobaciones de misiones en equipo`);
    process.exit(pass === results.length ? 0 : 1);
  }
})();
