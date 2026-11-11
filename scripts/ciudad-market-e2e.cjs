'use strict';
// Ciudad ICADEM · prueba en navegador real del Supermercado («Rescate de inventario»).
// Uso:  node scripts/ciudad-market-e2e.cjs http://127.0.0.1:8766   (capturas: SHOTS=carpeta)
const path = require('node:path');
const fs = require('node:fs');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw;
const BASE = (process.argv[2] || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra)]); if (process.env.VERBOSE) console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  →  ' + extra)); };
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];

(async () => {
  const browser = await (process.env.CHROMIUM ? chromium.launch({ args: GL }) : chromium.launch({ channel: 'chrome', args: GL }).catch(() => chromium.launch({ args: GL })));
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = name => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name) }) : Promise.resolve());
  const api = fn => page.evaluate(fn);
  const dialogThrough = async () => { for (let i = 0; i < 14; i++) { if (await api(() => document.getElementById('dialog').hidden)) return; await page.click('#dialog-next').catch(() => {}); await page.waitForTimeout(220); } };
  const waitScene = async name => { for (let i = 0; i < 60; i++) { if ((await api(() => window.__ciudad.api.sceneName)) === name && !(await api(() => document.getElementById('fade').classList.contains('is-on')))) return true; await page.waitForTimeout(250); } return false; };

  console.log('paso: goto 1');
  await page.goto(`${BASE}/ciudad/index.html?debug=1`);
  console.log('paso: clear');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/ciudad/index.html?debug=1`);
  console.log('paso: goto 2 listo');
  await page.waitForSelector('#splash-go:not([hidden])', { timeout: 30000 });
  console.log('paso: splash visible');
  await page.click('#splash-go'); await page.waitForTimeout(1500);
  await page.click('#coach a, #coach button', { timeout: 2000 }).catch(() => {});
  await api(() => { const a = window.__ciudad.api; a.store.state.tutorialDone = true; a.store.save(); });
  console.log('paso: tutorial saltado');

  // 1. la puerta de la plaza lleva al supermercado
  await api(() => window.__ciudad.api.travel('plaza', 'market'));
  ok('se llega a la plaza frente al supermercado', await waitScene('plaza'));
  const door = await api(() => {
    const a = window.__ciudad.api;
    const d = a.scene.interactables.find(i => i.id === 'door-supermercado');
    return d ? (typeof d.label === 'function' ? d.label() : d.label) : null;
  });
  ok('la puerta anuncia el supermercado abierto', door === 'Entrar al Supermercado', String(door));
  await api(() => { window.__ciudad.api.scene.interactables.find(i => i.id === 'door-supermercado').action(); return true; });
  ok('se entra al supermercado', await waitScene('market'));
  await shot('m1-interior.png');

  // 2. hablar con don Ramiro (como jugador: acercarse y usar la interacción)
  // Dispara la interacción sin esperar su promesa: los diálogos se avanzan con dialogThrough.
  const act = id => api(`{ window.__ciudad.api.scene.interactables.find(i => i.id === '${id}').action(); true }`);
  await act('ramiro'); await page.waitForTimeout(400); await dialogThrough();
  ok('don Ramiro abre la misión', await api(() => window.__ciudad.api.missions.market.attempt.talked === true));

  // 3. oficina: inventario del sistema (modal real)
  await act('ledger'); await page.waitForTimeout(600);
  ok('la oficina muestra el inventario del sistema', await api(() => !document.getElementById('modal').hidden));
  await shot('m2-ledger.png');
  await page.evaluate(() => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => x.textContent.includes('Anotado')); b && b.click(); });
  await page.waitForTimeout(400);
  ok('el sistema queda anotado', await api(() => window.__ciudad.api.missions.market.attempt.ledger === true));

  // 4. el resto de la misión con las mismas acciones que validará el servidor
  const played = await api(async () => {
    const m = window.__ciudad.api.missions.market;
    const L = await import('./js/missions/market-inventory-logic.js');
    const steps = [
      ...L.SHELVES.map(s => ['countShelf', { id: s.id }]),
      ...L.PRODUCTS.flatMap(p => [['inspect', { id: p.id }], ['decide', { id: p.id, action: p.remove ? 'retirar' : 'conservar' }]]),
      ['orderFridge', { order: [...L.BEST_ORDER] }],
      ...L.SHELVES.map(s => ['adjust', { id: s.id, delta: L.deltaOf(s) }])
    ];
    for (const [type, payload] of steps) if (!m.act(type, payload)) return 'falló: ' + type;
    return m.step;
  });
  ok('la misión acepta el recorrido completo y pide el reporte', played === 'report', String(played));

  // 5. entregar el reporte con don Ramiro: justificación y pantalla de resultado
  await act('ramiro'); await page.waitForTimeout(400); await dialogThrough(); await page.waitForTimeout(500);
  const picked = await api(() => {
    const btns = [...document.querySelectorAll('#modal .why__item')];
    if (btns.length < 5) return 'sin opciones';
    btns[0].click(); btns[1].click();
    return btns.length;
  });
  ok('el reporte ofrece las razones', picked === 5, String(picked));
  await shot('m3-razones.png');
  await page.evaluate(() => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => x.textContent.includes('Entregar')); b && b.click(); });
  await page.waitForTimeout(900); await dialogThrough(); await page.waitForTimeout(600);
  const result = await api(() => {
    const score = document.querySelector('#modal .result__score b');
    return { open: !document.getElementById('modal').hidden, score: score ? score.textContent : null };
  });
  ok('la pantalla final da 100 con la partida perfecta', result.open && result.score === '100', JSON.stringify(result));
  await shot('m4-resultado.png');
  await page.evaluate(() => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => x.textContent.includes('Continuar')); b && b.click(); });
  await page.waitForTimeout(600);
  const after = await api(() => { const s = window.__ciudad.api.store.state; return { credits: s.economy.balance, done: Boolean(s.missions['super-rescate-inventario'] && s.missions['super-rescate-inventario'].completed) }; });
  ok('acredita 20 créditos de prueba y registra la misión', after.done && after.credits >= 20, JSON.stringify(after));

  // 6. salir a la ciudad y sin errores de JavaScript
  await act('exit');
  ok('la salida regresa a la plaza', await waitScene('plaza'));
  ok('sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  let fails = 0;
  for (const [st, name, extra] of results) { if (st === 'FAIL') fails++; console.log(`${st}  ${name}${extra ? '  →  ' + extra : ''}`); }
  console.log(`\n${results.length - fails}/${results.length} comprobaciones del supermercado`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('La prueba se interrumpió: ' + e.message); process.exit(1); });
