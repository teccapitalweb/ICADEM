'use strict';
// Ciudad ICADEM · prueba de consolidación de los cuatro juegos en un navegador real.
// Para cada juego: puerta de la plaza → escena → abrir la misión con su diálogo real →
// recorrido perfecto con las MISMAS acciones que el servidor reproduce → pantalla final real →
// créditos de prueba → repetir sin duplicar créditos → salir a la plaza. Cada juego en una
// página nueva y corta (los recorridos largos se traban con el render por software del entorno).
//
// Uso:  node scripts/ciudad-juegos-e2e.cjs http://127.0.0.1:8766   (capturas: SHOTS=carpeta)
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

/** Cada juego: puerta, escena, quién abre la misión, recompensa y el recorrido perfecto (en el navegador). */
const GAMES = [
  { key: 'bank', door: 'banco', spawn: 'bank', scene: 'bank', opener: 'lucia', mission: 'banco-credito-correcto', credits: 15,
    perfect: `const L = await import('./js/missions/bank-credit-logic.js');
      return [['readDocument', { id: 'solicitud' }], ['readDocument', { id: 'flujo' }],
        ...L.PROPOSALS.map(p => ['takeProposal', { id: p.id }]), ...L.PROPOSALS.map(p => ['simulate', { id: p.id }]),
        ['compare'], ['choose', { id: L.bestProposalId() }], ['justify', { reasons: ['costo', 'capacidad'] }]];` },
  { key: 'court', door: 'tribunal', spawn: 'court', scene: 'court', opener: 'clerk', mission: 'tribunal-tu-eres-el-juez', credits: 20,
    perfect: `const c = await import('./js/missions/court-judge-logic.js');
      const steps = [['readBackground'], ...c.EXHIBITS.map(e => ['examineExhibit', { id: e.id }]), ['openHearing'], ['hearParty', { side: 'actora' }], ['hearParty', { side: 'demandada' }],
        ['ruleObjection', { id: 'sugestiva', ruling: 'ha-lugar' }], ['ruleObjection', { id: 'fecha', ruling: 'no-ha-lugar' }], ['examineWitness', { id: 'ruben' }], ['askWitness', { witness: 'ruben', id: 'r-boiler' }],
        ['ruleObjection', { id: 'oidas', ruling: 'ha-lugar' }], ['examineWitness', { id: 'sofia' }], ['askWitness', { witness: 'sofia', id: 's-vidrio' }],
        ['confront', { marks: { 'd-ernesto': 'mensajes', 'd-ruben': 'cotizacion', 'd-marta': null, 'd-sofia': null, 'd-edad': null } }],
        ...c.EXHIBITS.map(e => ['weigh', { id: e.id, weight: e.best }]), ['rule', { ruling: 'parcial', grounds: ['vidrio', 'recibido'] }]];
      return steps;`, needsCase: true },
  { key: 'market', door: 'supermercado', spawn: 'market', scene: 'market', opener: 'ramiro', mission: 'super-rescate-inventario', credits: 20,
    perfect: `const L = await import('./js/missions/market-inventory-logic.js');
      return [['readLedger'], ...L.SHELVES.map(s => ['countShelf', { id: s.id }]),
        ...L.PRODUCTS.flatMap(p => [['inspect', { id: p.id }], ['decide', { id: p.id, action: p.remove ? 'retirar' : 'conservar' }]]),
        ['orderFridge', { order: [...L.BEST_ORDER] }], ...L.SHELVES.map(s => ['adjust', { id: s.id, delta: L.deltaOf(s) }]),
        ['report'], ['justify', { reasons: ['salud', 'peps'] }]];` },
  { key: 'site', door: 'obra', spawn: 'obra', scene: 'site', opener: 'paula', mission: 'obra-inspector-seguridad', credits: 20,
    perfect: `const L = await import('./js/missions/site-inspector-logic.js');
      return [...L.GEAR.map(g => ['equip', { id: g.id }]), ['readPlan'],
        ...L.SPOTS.flatMap(s => [['inspect', { id: s.id }], ['assess', { id: s.id, verdict: s.hazard ? 'riesgo' : 'en-regla' }], ...(s.hazard ? [['measure', { id: s.id, measure: s.measures.find(m => m.correct).id }]] : [])]),
        ['placeSign'], ['stopWork', { id: L.BEST_STOP }], ['report'], ['justify', { reasons: ['inminente', 'epp'] }]];` }
];

async function play(browser, G) {
  const tag = `[${G.key}]`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const api = fn => page.evaluate(fn);
  const act = id => api(`{ window.__ciudad.api.scene.interactables.find(i => i.id === '${id}').action(); true }`);
  const dialogThrough = async () => { for (let i = 0; i < 16; i++) { if (await api(() => document.getElementById('dialog').hidden)) return; await page.click('#dialog-next').catch(() => {}); await page.waitForTimeout(200); } };
  const waitScene = async name => { for (let i = 0; i < 60; i++) { if ((await api(() => window.__ciudad.api.sceneName)) === name && !(await api(() => document.getElementById('fade').classList.contains('is-on')))) return true; await page.waitForTimeout(250); } return false; };
  const clickModal = text => page.evaluate(t => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => x.textContent.includes(t)); if (b) { b.click(); return true; } return false; }, text);

  await page.goto(`${BASE}/ciudad/index.html?debug=1`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/ciudad/index.html?debug=1`);
  await page.waitForSelector('#splash-go:not([hidden])', { timeout: 30000 });
  await page.click('#splash-go'); await page.waitForTimeout(1500);
  await api(() => { const a = window.__ciudad.api; a.store.state.tutorialDone = true; a.store.save(); document.getElementById('coach').hidden = true; });

  // puerta → escena
  await page.evaluate(sp => window.__ciudad.api.travel('plaza', sp), G.spawn);
  ok(`${tag} llegada a la plaza frente a la puerta`, await waitScene('plaza'));
  const arrival = await page.evaluate(door => {
    const a = window.__ciudad.api, p = a.player.position, d = a.scene.interactables.find(i => i.id === 'door-' + door);
    return { d: d ? Math.hypot(d.x - p.x, d.z - p.z) : 99, free: a.scene.collision.resolve(p.x, p.z, 0.35) };
  }, G.door);
  ok(`${tag} el punto de llegada está libre y cerca de la puerta`, arrival.d < 9 && Math.hypot(arrival.free.x - (await api(() => window.__ciudad.api.player.position.x)), arrival.free.z - (await api(() => window.__ciudad.api.player.position.z))) < 0.05, JSON.stringify(arrival));
  await page.evaluate(door => { window.__ciudad.api.scene.interactables.find(i => i.id === 'door-' + door).action(); return true; }, G.door);
  ok(`${tag} se entra al edificio`, await waitScene(G.scene));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `j-${G.key}.png`) });

  // abrir la misión con el diálogo real
  await act(G.opener); await page.waitForTimeout(500);
  if (G.needsCase) {
    // El Tribunal abre con la secretaria: elige el expediente jugable en su ventana
    await dialogThrough();
    await page.evaluate(() => { const b = document.querySelector('.docket__item[data-id="exp-014"]'); b && b.click(); });
    await page.evaluate(() => { const b = document.querySelector('#modal-actions .btn--primary'); b && b.click(); });
    await page.waitForTimeout(500);
  }
  await dialogThrough();
  await page.evaluate(() => { const b = document.querySelector('#modal-actions .btn--primary'); b && !document.getElementById('modal').hidden && b.click(); });
  await page.waitForTimeout(400); await dialogThrough();

  // recorrido perfecto con las mismas acciones que valida el servidor
  const played = await page.evaluate(async ({ key, perfect, needsCase }) => {
    const m = window.__ciudad.api.missions[key];
    if (needsCase && !m.state.caseId) { if (!m.run.act('takeCase', { id: 'exp-014' })) return 'no abrió el expediente'; }
    if (!needsCase && m.step === 'talk' && !m.run.act('talk')) return 'no abrió la misión';
    const steps = await (new Function(`return (async () => { ${perfect} })();`))();
    for (const [type, payload] of steps) if (!m.run.act(type, payload || {})) return 'falló: ' + type;
    return m.run.ready ? 'listo' : 'incompleto: ' + m.step;
  }, G);
  ok(`${tag} el motor acepta el recorrido completo`, played === 'listo', played);

  // pantalla final real (la del controlador común)
  const closing = page.evaluate(key => { const m = window.__ciudad.api.missions[key]; m.finish(() => ({ rows: [['Prueba', 100, 100]], heading: 'ok', paragraphs: [] })); return true; }, G.key);
  await closing; await page.waitForTimeout(900);
  const res = await api(() => { const s = document.querySelector('#modal .result__score b'); return { open: !document.getElementById('modal').hidden, score: s ? s.textContent : null }; });
  ok(`${tag} la pantalla final da 100`, res.open && res.score === '100', JSON.stringify(res));
  await clickModal('Continuar'); await page.waitForTimeout(500);
  const after1 = await page.evaluate(id => { const s = window.__ciudad.api.store.state; return { bal: s.economy.balance, done: Boolean(s.missions[id] && s.missions[id].completed) }; }, G.mission);
  ok(`${tag} acredita ${G.credits} créditos de prueba una vez`, after1.done && after1.bal === G.credits, JSON.stringify(after1));

  // repetir: la recompensa no se duplica
  const second = await page.evaluate(async ({ key, perfect, needsCase }) => {
    const m = window.__ciudad.api.missions[key];
    if (needsCase) m.run.act('takeCase', { id: 'exp-014' }); else m.run.act('talk');
    const steps = await (new Function(`return (async () => { ${perfect} })();`))();
    for (const [type, payload] of steps) m.run.act(type, payload || {});
    const out = await m.service.complete(m.run);
    m.restart();
    return { credits: out.credits, xp: out.xp, bal: window.__ciudad.api.store.state.economy.balance };
  }, G);
  ok(`${tag} repetir no duplica créditos`, second.credits === 0 && second.bal === G.credits && second.xp > 0, JSON.stringify(second));

  // salida
  await act('exit');
  ok(`${tag} la salida regresa a la plaza`, await waitScene('plaza'));
  ok(`${tag} sin errores de JavaScript`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: GL }).catch(() => chromium.launch({ args: GL }));
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const G of GAMES) if (!only || only.includes(G.key)) {
    try { await play(browser, G); } catch (e) { ok(`[${G.key}] la prueba terminó sin interrumpirse`, false, e.message.split('\n')[0]); }
  }
  await browser.close();
  let fails = 0;
  for (const [st, name, extra] of results) { if (st === 'FAIL') fails++; console.log(`${st}  ${name}${extra ? '  →  ' + extra : ''}`); }
  console.log(`\n${results.length - fails}/${results.length} comprobaciones de los juegos`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('La prueba se interrumpió: ' + e.message); process.exit(1); });
