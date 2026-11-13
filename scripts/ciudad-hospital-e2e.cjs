'use strict';
// Ciudad ICADEM · prueba en navegador real del Hospital («Turno de decisiones») usando la interfaz:
// recibir turno, pizarrón, monitor, expediente, valoración con luz de triaje, prioridad en el
// pizarrón, decisión con apoyo (el doctor acude), bitácora, entrega de turno y evaluación.
// Uso:  node scripts/ciudad-hospital-e2e.cjs http://127.0.0.1:8766   (capturas: SHOTS=carpeta)
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
  const browser = await chromium.launch({ channel: 'chrome', args: GL }).catch(() => chromium.launch({ args: GL }));
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = name => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name) }) : Promise.resolve());
  const api = fn => page.evaluate(fn);
  const act = id => api(`{ window.__ciudad.api.scene.interactables.find(i => i.id === '${id}').action(); true }`);
  const dialogThrough = async () => { for (let i = 0; i < 16; i++) { if (await api(() => document.getElementById('dialog').hidden)) return; await page.click('#dialog-next').catch(() => {}); await page.waitForTimeout(200); } };
  const clickModal = text => page.evaluate(t => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => x.textContent.includes(t)); if (b) { b.click(); return true; } return false; }, text);
  const modalOpen = () => api(() => !document.getElementById('modal').hidden);
  const waitScene = async name => { for (let i = 0; i < 60; i++) { if ((await api(() => window.__ciudad.api.sceneName)) === name && !(await api(() => document.getElementById('fade').classList.contains('is-on')))) return true; await page.waitForTimeout(250); } return false; };
  const M = fn => page.evaluate(`(() => { const m = window.__ciudad.api.missions.hospital; return (${fn})(m); })()`);

  await page.goto(`${BASE}/ciudad/index.html?debug=1`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/ciudad/index.html?debug=1&avatar=0`);   // sin la selección inicial de personaje (se prueba en ciudad-e2e)
  await page.waitForSelector('#splash-go:not([hidden])', { timeout: 30000 });
  await page.click('#splash-go'); await page.waitForTimeout(1500);
  await api(() => { const a = window.__ciudad.api; a.store.state.tutorialDone = true; a.store.save(); document.getElementById('coach').hidden = true; });
  await api(() => window.__ciudad.api.travel('plaza', 'hospital'));
  await waitScene('plaza');
  const door = await api(() => { const d = window.__ciudad.api.scene.interactables.find(i => i.id === 'door-hospital'); return typeof d.label === 'function' ? d.label() : d.label; });
  ok('la puerta anuncia el hospital abierto', /Entrar/.test(door), door);
  await api(() => { window.__ciudad.api.scene.interactables.find(i => i.id === 'door-hospital').action(); return true; });
  ok('se entra al hospital', await waitScene('hospital'));

  // 1. recibir el turno y el pizarrón
  await act('lupita'); await page.waitForTimeout(400); await dialogThrough();
  ok('la jefa de enfermería entrega el turno', await M('m => m.attempt.shift'));
  await act('board'); await page.waitForTimeout(500);
  ok('el pizarrón lista a los cuatro pacientes', await api(() => document.querySelectorAll('#modal dt').length === 4));
  await shot('h1-pizarron.png');
  await clickModal('revisar'); await page.waitForTimeout(400);

  // 2. ronda de Don Aurelio con la interfaz: entrevista, monitor y expediente
  await act('pt-aurelio'); await page.waitForTimeout(400); await dialogThrough();
  await act('mon-aurelio'); await page.waitForTimeout(500);
  const vitals = await api(() => [...document.querySelectorAll('#modal dd')].map(d => d.textContent));
  ok('el monitor muestra los signos vitales', vitals.length === 5 && vitals[0] === '112 lpm', JSON.stringify(vitals));
  await shot('h2-monitor.png');
  await clickModal('Anotado'); await page.waitForTimeout(300);
  await act('chart-aurelio'); await page.waitForTimeout(500);
  ok('el expediente se abre al pie de la cama', await modalOpen());
  await clickModal('Cerrar'); await page.waitForTimeout(400);
  ok('la ronda de Don Aurelio queda completa', await M('m => m.reviewedAll("aurelio")'));

  // 3. valoración con la interfaz: signos de alarma + color rojo → la luz de la cama se pinta
  await act('pt-aurelio'); await page.waitForTimeout(500);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('#modal .why__item')) if (/opresivo|Sudoración/.test(b.textContent)) b.click();
    [...document.querySelectorAll('#modal .pick__card')].find(b => b.textContent.startsWith('Rojo')).click();
  });
  await shot('h3-valoracion.png');
  await clickModal('Registrar'); await page.waitForTimeout(600);
  const lamp = await api(() => window.__ciudad.api.missions.hospital.colorOf('aurelio'));
  ok('el triaje rojo queda registrado y la luz de la cama cambia', lamp === 0xe5484d, String(lamp));

  // 4. el resto de la ronda y el triaje con las mismas acciones que valida el servidor
  const rest = await page.evaluate(async () => {
    const m = window.__ciudad.api.missions.hospital;
    const L = await import('./js/missions/hospital-shift-logic.js');
    for (const p of L.PATIENTS) {
      if (p.id === 'aurelio') continue;
      for (const what of L.REVIEWS) if (!m.act('review', { id: p.id, what })) return 'review ' + p.id;
      if (!m.act('assess', { id: p.id, flags: p.findings.filter(f => f.alarm).map(f => f.id), triage: p.triage })) return 'assess ' + p.id;
    }
    return m.step;
  });
  ok('con los cuatro valorados el turno pide ordenar', rest === 'order', rest);
  await page.waitForTimeout(500); await shot('h4-luces.png');

  // 5. prioridad en el pizarrón con la interfaz (rojos, amarillo, verde)
  await act('board'); await page.waitForTimeout(500);
  await page.evaluate(() => { for (const n of ['Don Aurelio', 'Doña Celia', 'Joaquín', 'Mariana']) [...document.querySelectorAll('#modal .pick__card')].find(b => b.textContent.includes(n)).click(); });
  await clickModal('Fijar'); await page.waitForTimeout(500);
  ok('la prioridad queda fijada', await M('m => (m.attempt.order || []).join() === "aurelio,celia,joaquin,mariana"'));

  // 6. decisión con apoyo para Don Aurelio: el doctor acude a la cama
  const before = await api(() => { const p = window.__ciudad.api.scene.npcs[1].group.position; return [p.x, p.z]; });
  await act('pt-aurelio'); await page.waitForTimeout(500);
  await page.evaluate(() => {
    [...document.querySelectorAll('#modal .why__item')].find(b => b.textContent.includes('de inmediato a urgencias')).click();
    [...document.querySelectorAll('#modal .pick__card')].find(b => b.textContent.includes('Pedir apoyo')).click();
  });
  await clickModal('Confirmar'); await page.waitForTimeout(4500);
  const after = await api(() => { const p = window.__ciudad.api.scene.npcs[1].group.position; return [p.x, p.z]; });
  ok('al pedir apoyo, el Dr. Salas camina hacia la cama', Math.hypot(after[0] - before[0], after[1] - before[1]) > 1.0, JSON.stringify({ before, after }));
  await shot('h5-apoyo.png');
  const decided = await page.evaluate(async () => {
    const m = window.__ciudad.api.missions.hospital;
    const L = await import('./js/missions/hospital-shift-logic.js');
    for (const p of L.PATIENTS) if (p.id !== 'aurelio' && !m.act('decide', { id: p.id, action: p.actions.find(a => a.correct).id, support: p.support })) return 'decide ' + p.id;
    return m.step;
  });
  ok('con las cuatro decisiones el turno pide la bitácora', decided === 'record', decided);

  // 7. bitácora, entrega y evaluación final
  await act('record'); await page.waitForTimeout(500);
  ok('la bitácora resume las cuatro decisiones en orden', await api(() => document.querySelectorAll('#modal dt').length === 4));
  await clickModal('Firmar'); await page.waitForTimeout(400);
  await act('lupita'); await page.waitForTimeout(400); await dialogThrough(); await page.waitForTimeout(400);
  await page.evaluate(() => { const bs = [...document.querySelectorAll('#modal .why__item')]; bs[0].click(); bs[1].click(); });
  await clickModal('Entregar'); await page.waitForTimeout(900); await dialogThrough(); await page.waitForTimeout(600);
  const result = await api(() => { const s = document.querySelector('#modal .result__score b'); return { open: !document.getElementById('modal').hidden, score: s ? s.textContent : null }; });
  ok('la evaluación final da 100 con el turno perfecto', result.open && result.score === '100', JSON.stringify(result));
  await shot('h6-resultado.png');
  await clickModal('Continuar'); await page.waitForTimeout(500);
  const bal = await api(() => window.__ciudad.api.store.state.economy.balance);
  ok('acredita 20 créditos de prueba', bal === 20, String(bal));
  await act('exit');
  ok('la salida regresa a la plaza', await waitScene('plaza'));
  ok('sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  let fails = 0;
  for (const [st, name, extra] of results) { if (st === 'FAIL') fails++; console.log(`${st}  ${name}${extra ? '  →  ' + extra : ''}`); }
  console.log(`\n${results.length - fails}/${results.length} comprobaciones del hospital`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('La prueba se interrumpió: ' + e.message); process.exit(1); });
