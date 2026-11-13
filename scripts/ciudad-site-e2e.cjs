'use strict';
// Ciudad ICADEM · prueba en navegador real de la Obra («Inspector de seguridad»).
// Uso:  node scripts/ciudad-site-e2e.cjs http://127.0.0.1:8766   (capturas: SHOTS=carpeta)
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
  const act = id => api(`{ window.__ciudad.api.scene.interactables.find(i => i.id === '${id}').action(); true }`);
  const dialogThrough = async () => { for (let i = 0; i < 14; i++) { if (await api(() => document.getElementById('dialog').hidden)) return; await page.click('#dialog-next').catch(() => {}); await page.waitForTimeout(220); } };
  const clickModal = text => page.evaluate(t => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => x.textContent.includes(t)); if (b) { b.click(); return true; } return false; }, text);
  const waitScene = async name => { for (let i = 0; i < 60; i++) { if ((await api(() => window.__ciudad.api.sceneName)) === name && !(await api(() => document.getElementById('fade').classList.contains('is-on')))) return true; await page.waitForTimeout(250); } return false; };

  await page.goto(`${BASE}/ciudad/index.html?debug=1`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/ciudad/index.html?debug=1&avatar=0`);   // sin la selección inicial de personaje (se prueba en ciudad-e2e)
  await page.waitForSelector('#splash-go:not([hidden])', { timeout: 30000 });
  await page.click('#splash-go'); await page.waitForTimeout(1500);
  await api(() => { const a = window.__ciudad.api; a.store.state.tutorialDone = true; a.store.save(); });

  // 1. puerta de la plaza
  await api(() => window.__ciudad.api.travel('plaza', 'obra'));
  ok('se llega a la plaza frente a la obra', await waitScene('plaza'));
  const door = await api(() => { const d = window.__ciudad.api.scene.interactables.find(i => i.id === 'door-obra'); return d ? (typeof d.label === 'function' ? d.label() : d.label) : null; });
  ok('la puerta anuncia la obra abierta', door === 'Entrar al Obra en construcción' || /Entrar/.test(String(door)), String(door));
  await api(() => { window.__ciudad.api.scene.interactables.find(i => i.id === 'door-obra').action(); return true; });
  ok('se entra a la obra', await waitScene('site'));
  await shot('o1-obra.png');

  // 2. presentación, EPP y plano con la interfaz real
  await act('paula'); await page.waitForTimeout(400); await dialogThrough();
  ok('la ingeniera abre la misión', await api(() => window.__ciudad.api.missions.site.attempt.talked === true));
  const planBefore = await api(() => { window.__ciudad.api.missions.site.openPlan(); return true; });
  await page.waitForTimeout(600); await dialogThrough(); void planBefore;
  ok('el plano exige el EPP primero', await api(() => window.__ciudad.api.missions.site.attempt.plan === false));
  await act('gear'); await page.waitForTimeout(600);
  const geared = await page.evaluate(() => { const bs = [...document.querySelectorAll('#modal .why__item')]; bs.forEach(b => b.click()); return bs.length; });
  ok('la caseta entrega las tres piezas de EPP', geared === 3, String(geared));
  await clickModal('Listo'); await page.waitForTimeout(400);
  await act('plan'); await page.waitForTimeout(600);
  ok('el tablero muestra la lista de 8 puntos', await api(() => document.querySelectorAll('#modal dt').length === 8));
  await shot('o2-plano.png');
  await clickModal('Comenzar'); await page.waitForTimeout(400);

  // 3. un punto completo con la interfaz: andamio sur → riesgo → medida correcta
  await act('spot-andamio-sur'); await page.waitForTimeout(600);
  await page.evaluate(() => { [...document.querySelectorAll('#modal .why__item')].find(b => b.textContent.includes('riesgo')).click(); });
  await clickModal('Calificar'); await page.waitForTimeout(600);
  const measure = await page.evaluate(() => { const b = [...document.querySelectorAll('#modal .why__item')].find(x => x.textContent.includes('detener el trabajo')); if (b) { b.click(); return true; } return false; });
  ok('al marcar riesgo se piden medidas correctivas', measure === true);
  await clickModal('Ordenar'); await page.waitForTimeout(400);
  ok('la medida queda registrada', await api(() => window.__ciudad.api.missions.site.attempt.measures['andamio-sur'] === 'detener-andamio'));

  // 4. el resto del recorrido con las mismas acciones que validará el servidor
  const played = await api(async () => {
    const m = window.__ciudad.api.missions.site;
    const L = await import('./js/missions/site-inspector-logic.js');
    for (const sp of L.SPOTS) {
      if (sp.id === 'andamio-sur') continue;
      if (!m.act('inspect', { id: sp.id })) return 'falló inspect ' + sp.id;
      if (!m.act('assess', { id: sp.id, verdict: sp.hazard ? 'riesgo' : 'en-regla' })) return 'falló assess ' + sp.id;
      if (sp.hazard && !m.act('measure', { id: sp.id, measure: sp.measures.find(x => x.correct).id })) return 'falló measure ' + sp.id;
    }
    return m.step;
  });
  ok('el recorrido completo deja pendiente la señalización', played === 'sign', String(played));

  // 5. señalización física: los conos aparecen en la escena
  const conesBefore = await api(() => { let v = null; window.__ciudad.api.scene.group.traverse(o => {}); return window.__ciudad.api.missions.site.attempt.signed; });
  await act('sign-zanja'); await page.waitForTimeout(500);
  ok('la señalización se coloca en la zanja', (await api(() => window.__ciudad.api.missions.site.attempt.signed)) === true && conesBefore === false);
  await shot('o3-senalizacion.png');

  // 6. paro de actividad, reporte y resultado
  await act('paula'); await page.waitForTimeout(400); await dialogThrough(); await page.waitForTimeout(500);
  const stopPicked = await page.evaluate(() => { const b = [...document.querySelectorAll('#modal .why__item')].find(x => x.textContent.includes('andamio sur')); if (b) { b.click(); return true; } return false; });
  ok('la ingeniera pregunta qué se detiene', stopPicked === true);
  await clickModal('Detener'); await page.waitForTimeout(600); await dialogThrough(); await page.waitForTimeout(400);
  await page.evaluate(() => { const bs = [...document.querySelectorAll('#modal .why__item')]; bs[0] && bs[0].click(); bs[1] && bs[1].click(); });
  await clickModal('Entregar'); await page.waitForTimeout(900); await dialogThrough(); await page.waitForTimeout(600);
  const result = await api(() => { const s = document.querySelector('#modal .result__score b'); return { open: !document.getElementById('modal').hidden, score: s ? s.textContent : null }; });
  ok('la pantalla final da 100 con el recorrido perfecto', result.open && result.score === '100', JSON.stringify(result));
  await shot('o4-resultado.png');
  await clickModal('Continuar'); await page.waitForTimeout(600);
  const after = await api(() => { const s = window.__ciudad.api.store.state; return { credits: s.economy.balance, done: Boolean(s.missions['obra-inspector-seguridad'] && s.missions['obra-inspector-seguridad'].completed) }; });
  ok('acredita 20 créditos de prueba y registra la misión', after.done && after.credits >= 20, JSON.stringify(after));

  // 7. salida y sin errores
  await act('exit');
  ok('la salida regresa a la plaza', await waitScene('plaza'));
  ok('sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  let fails = 0;
  for (const [st, name, extra] of results) { if (st === 'FAIL') fails++; console.log(`${st}  ${name}${extra ? '  →  ' + extra : ''}`); }
  console.log(`\n${results.length - fails}/${results.length} comprobaciones de la obra`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('La prueba se interrumpió: ' + e.message); process.exit(1); });
