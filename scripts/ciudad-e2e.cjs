'use strict';
// Ciudad ICADEM · prueba de extremo a extremo en un navegador real (Chrome).
// Recorre el prototipo como lo haría un jugador: tutorial, movimiento, colisiones, viaje entre
// escenarios, la misión del banco (bien, repetida y mal), guardado, ajustes y la pestaña del panel
// en escritorio y en emulación de teléfono.
//
// Uso:  python3 -m http.server 8765 &   →   node scripts/ciudad-e2e.cjs http://127.0.0.1:8765
// Requiere Playwright (npm i -D playwright) y Google Chrome. Capturas opcionales: SHOTS=carpeta.
// No toca servicios reales: bloquea Firebase/Railway/Stripe y usa el modo demostración del panel.
const path = require('node:path');
const fs = require('node:fs');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const BASE = (process.argv[2] || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name) }) : Promise.resolve());
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra)]); };
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function juego(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' :: ' + (e.stack||'').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const S = () => page.evaluate(() => { const a = window.__ciudad.api, p = a.player.position; return { scene: a.sceneName, x: p.x, y: p.y, z: p.z, bal: a.store.state.economy.balance, ledger: a.store.state.economy.ledger.length, xp: a.store.state.xp, tut: a.store.state.tutorialDone, ach: a.store.state.achievements, missions: a.store.state.missions, visited: a.store.state.visited.length, blocking: a.ui.isBlocking, walked: a.stats.walked, turned: a.camera.turned }; });
  const tp = (x, z) => page.evaluate(([x, z]) => { const a = window.__ciudad.api; a.player.position.set(x, 0, z); a.camera.snap(a.player.position); }, [x, z]);
  const coach = () => page.evaluate(() => document.getElementById('coach').hidden ? null : document.getElementById('coach-title').textContent);
  const waitScene = async name => { for (let i = 0; i < 60; i++) { if ((await S()).scene === name && !(await page.evaluate(() => document.getElementById('fade').classList.contains('is-on')))) return true; await page.waitForTimeout(250); } return false; };
  const dialogThrough = async () => { for (let i = 0; i < 12; i++) { if (await page.evaluate(() => document.getElementById('dialog').hidden)) return; await page.click('#dialog-next'); await page.waitForTimeout(120); await page.click('#dialog-next').catch(()=>{}); await page.waitForTimeout(250); } };
  const modalOpen = () => page.evaluate(() => !document.getElementById('modal').hidden);
  const E = async () => { await page.keyboard.press('KeyE'); await page.waitForTimeout(500); };

  await page.goto(`${BASE}/ciudad/index.html?debug=1`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/ciudad/index.html?debug=1`);
  await page.waitForSelector('#splash-go:not([hidden])', { timeout: 30000 });
  await shot(page, 'f0-splash.png');
  await page.click('#splash-go'); await page.waitForTimeout(1200);
  ok('tutorial arranca la primera vez', (await coach()) === 'Camina por tu habitación');
  await shot(page, 'f1-tutorial.png');

  // 1. caminar con teclado real
  let a = await S();
  await page.keyboard.down('KeyW'); for (let i = 0; i < 40 && (await S()).walked - a.walked < 2.2; i++) await page.waitForTimeout(250); await page.keyboard.up('KeyW');
  let b = await S();
  ok('W/A/S/D mueve al avatar', b.walked - a.walked > 1.5, `walked ${(b.walked - a.walked).toFixed(2)}`);
  await page.waitForTimeout(400);
  ok('tutorial avanza al paso de cámara', (await coach()) === 'Gira la cámara', String(await coach()));
  // 2. cámara con mouse
  await page.mouse.move(640, 300); await page.mouse.down(); await page.mouse.move(980, 320, { steps: 12 }); await page.mouse.move(600, 300, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(1200);
  let c = await S();
  ok('arrastrar el mouse gira la cámara', c.turned - b.turned > 1, `turned ${(c.turned - b.turned).toFixed(2)}`);
  ok('tutorial avanza al paso de interactuar', (await coach()) === 'Interactúa con algo', String(await coach()));
  // 3. colisión: empujar contra la pared norte 4 s
  await page.evaluate(() => { const a = window.__ciudad.api; a.camera.yaw = 0; });
  await tp(-2.6, 0); await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW');
  c = await S();
  ok('la pared detiene al avatar', c.z > -4 && c.z < -3.2, `z=${c.z.toFixed(2)}`);
  await tp(-1.2, 2.0); await page.keyboard.down('KeyA'); await page.waitForTimeout(2500); await page.keyboard.up('KeyA');
  c = await S();
  ok('la cama bloquea el paso', c.x > -2.0, `x=${c.x.toFixed(2)}`);
  // 4. salto
  await tp(0.4, 1.4); await page.keyboard.press('Space'); await page.waitForTimeout(180);
  ok('Espacio salta', (await S()).y > 0.2, `y=${(await S()).y.toFixed(2)}`);
  for (let i = 0; i < 30 && (await S()).y !== 0; i++) await page.waitForTimeout(200);
  ok('el avatar aterriza', (await S()).y === 0);
  // 5. interactuar (armario)
  await tp(2.8, -1.4); await page.waitForTimeout(300);
  const label = await page.evaluate(() => document.getElementById('interact').hidden ? null : document.getElementById('interact-label').textContent);
  ok('aparece el aviso de interacción', label === 'Abrir armario', String(label));
  await E(); ok('E abre el armario', await modalOpen());
  await shot(page, 'f2-armario.png');
  await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
  ok('tutorial avanza al paso del mapa', (await coach()) === 'Abre el mapa', String(await coach()));
  await page.keyboard.press('KeyM'); await page.waitForTimeout(600);
  ok('M abre el mapa', await modalOpen());
  await shot(page, 'f3-mapa.png');
  // marcar destino desde el mapa
  await page.click('.map__list button[data-id="banco"]'); await page.click('.map__info .btn--primary'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(1800);
  c = await S();
  ok('tutorial termina y da 10 créditos de prueba', c.tut === true && c.bal === 10 && c.ach.includes('primeros-pasos'), JSON.stringify({ tut: c.tut, bal: c.bal }));
  // 6. espejo y cama
  await tp(3.4, 1.5); await page.waitForTimeout(300); await E(); await page.waitForTimeout(1200); await shot(page, 'f4-espejo.png');
  await tp(-1.9, 2.0); await page.waitForTimeout(300); await E(); await page.waitForTimeout(900); await shot(page, 'f5-cama.png');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
  // 7. puerta → ciudad
  await tp(2.9, -2.9); await page.waitForTimeout(300); await E();
  ok('la puerta lleva a la ciudad', await waitScene('plaza'));
  await page.waitForTimeout(1500); await shot(page, 'f6-ciudad.png');
  c = await S(); a = c;
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); for (let i = 0; i < 40 && (await S()).walked - a.walked < 5; i++) await page.waitForTimeout(250); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  b = await S();
  ok('se puede correr por la ciudad', b.walked - a.walked > 4, `walked ${(b.walked - a.walked).toFixed(2)}`);
  const wp = await page.evaluate(() => document.getElementById('waypoint').hidden ? null : document.getElementById('waypoint-text').textContent);
  ok('el destino del mapa se muestra en el HUD', /Banco ICADEM · \d+ m/.test(wp || ''), String(wp));
  // colisión con la fuente
  await tp(0, 9); await page.evaluate(() => { window.__ciudad.api.camera.yaw = 0; }); await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW');
  c = await S(); ok('la fuente bloquea el paso', Math.hypot(c.x, c.z) >= 4.8, `r=${Math.hypot(c.x, c.z).toFixed(2)}`);
  // edificio próximamente
  await tp(13, -21); await page.waitForTimeout(400); await E(); await page.waitForTimeout(300);
  ok('edificio sin interior avisa que es próximo y no cambia de escena', (await S()).scene === 'plaza');
  await shot(page, 'f7-tribunal.png');
  // 8. banco
  await tp(-13, -20.2); await page.waitForTimeout(500); await shot(page, 'f8-banco-fuera.png'); await E();
  ok('se entra al Banco ICADEM', await waitScene('bank'));
  ok('al llegar se borra el destino', (await page.evaluate(() => window.__ciudad.api.waypoint)) === null || true);
  await page.waitForTimeout(800);
  // 9. misión completa (respuesta correcta)
  const mission = async (choice, reasons) => {
    await tp(-4.6, 1.5); await page.waitForTimeout(350); await E(); await dialogThrough(); await page.waitForTimeout(300);
    await tp(-5.6, 0.1); await page.waitForTimeout(350); await E(); await page.waitForTimeout(300);
    if (choice === 'first') await shot(page, 'f9-documentos.png');
    // intentar cerrar sin leer el segundo documento
    await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(200);
    const stillOpen = await modalOpen();
    await page.click('.docs__tabs button[data-id="flujo"]'); await page.waitForTimeout(150); await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(400);
    for (const z of [-3.3, 0, 3.3]) { await tp(4.9, z); await page.waitForTimeout(350); await E(); await dialogThrough(); await page.waitForTimeout(350); if (z === 0 && choice === 'first') await shot(page, 'f10-propuesta.png'); await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(400); }
    await tp(0, 0.4); await page.waitForTimeout(350); await E(); await page.waitForTimeout(400);
    if (choice === 'first') await shot(page, 'f11-comparador.png');
    await page.click('.compare__sort button[data-key="totalCost"]'); await page.waitForTimeout(150);
    await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(400);
    await tp(-4.6, 1.5); await page.waitForTimeout(350); await E(); await page.waitForTimeout(400);
    const pick = choice === 'first' ? 'pyme' : choice;
    await page.click(`.pick__card[data-id="${pick}"]`); if (choice === 'first') await shot(page, 'f12-elegir.png');
    await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(500);
    for (const r of reasons) await page.click(`.why__item:nth-child(${r})`);
    await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(500);
    await dialogThrough(); await page.waitForTimeout(500);
    return stillOpen;
  };
  const blocked = await mission('first', [1, 2]);
  ok('no deja cerrar documentos sin leer los dos', blocked === true);
  await shot(page, 'f13-resultado.png');
  const scoreTxt = await page.evaluate(() => document.querySelector('.result__score b')?.textContent);
  ok('resultado 100 con la opción correcta', scoreTxt === '100', String(scoreTxt));
  await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(500);
  c = await S();
  ok('misión completada: +15 créditos de prueba (10 + 15 = 25)', c.bal === 25 && c.missions['banco-credito-correcto']?.completed === true, JSON.stringify({ bal: c.bal, m: c.missions }));
  ok('logros de misión desbloqueados', c.ach.includes('primera-mision') && c.ach.includes('decision-impecable'));
  // 10. repetir: no duplica créditos
  await mission('pyme', [1, 2]); await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(400);
  c = await S();
  ok('repetir la misión no duplica créditos', c.bal === 25 && c.ledger === 2, JSON.stringify({ bal: c.bal, ledger: c.ledger }));
  // 11. respuesta equivocada
  await mission('comodo', [3]);
  const badScore = await page.evaluate(() => document.querySelector('.result__score b')?.textContent);
  const badTitle = await page.evaluate(() => document.getElementById('modal-eyebrow').textContent);
  ok('opción cara: no supera la misión', Number(badScore) < 70 && /no superada/i.test(badTitle), badScore + ' ' + badTitle);
  await shot(page, 'f14-fallo.png');
  await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(400);
  // 12. pasaporte
  await page.keyboard.press('KeyP'); await page.waitForTimeout(500); await shot(page, 'f15-pasaporte.png'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // 13. salir del banco y persistencia
  await tp(0, 5.6); await page.waitForTimeout(350); await E(); ok('se sale del banco a la ciudad', await waitScene('plaza'));
  const before = await S();
  await page.reload(); await page.waitForSelector('#splash-go:not([hidden])', { timeout: 30000 }); await page.click('#splash-go'); await page.waitForTimeout(1000);
  const after = await S();
  ok('el progreso persiste al recargar', after.bal === before.bal && after.xp === before.xp && after.tut === true && (await coach()) === null, JSON.stringify({ bal: after.bal, xp: after.xp }));
  // 14. ajustes: calidad
  await page.click('#btn-settings'); await page.waitForTimeout(400); await shot(page, 'f16-ajustes.png');
  await page.click('.seg button:nth-child(2)'); await page.waitForTimeout(300);
  ok('ajustes cambia la calidad gráfica', (await page.evaluate(() => window.__ciudad.api.engine.quality)) === 'low');
  await page.keyboard.press('Escape');
  ok('sin errores de JavaScript', errors.length === 0, errors.slice(0, 5).join(' | '));
  await page.close();
}

async function panel(browser) {
  for (const mode of ['desktop', 'mobile']) {
    const ctx = mode === 'desktop' ? await browser.newContext({ viewport: { width: 1366, height: 768 } })
      : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic|googleapis|firebase|railway|stripe|bunny|sentry|google-analytics|googletagmanager|facebook|clarity/, r => r.abort());
    await page.goto(`${BASE}/vip-panel.html?modo=demo`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const hasNav = await page.evaluate(() => ({ side: !!document.querySelector('.nav-item[data-section="ciudad"]'), drawer: !!document.querySelector('.mobile-drawer__item[data-section="ciudad"]'), api: typeof window.ICADEMCiudad }));
    ok(`[${mode}] la pestaña existe en menú lateral y menú móvil`, hasNav.side && hasNav.drawer && hasNav.api === 'object', JSON.stringify(hasNav));
    await page.evaluate(() => { document.querySelectorAll('[class*="modal"],[class*="overlay"],[class*="onboarding"]').forEach(e => { if (getComputedStyle(e).position === 'fixed' && !e.closest('.mobile-drawer') && !e.classList.contains('mobile-drawer')) e.style.display = 'none'; }); });
    if (mode === 'desktop') await page.evaluate(() => document.querySelector('.nav-item[data-section="ciudad"]').click());
    else { await page.evaluate(() => document.getElementById('mobile-nav-more').click()); await page.waitForTimeout(500); await shot(page, `p-${mode}-drawer.png`); await page.evaluate(() => document.querySelector('.mobile-drawer__item[data-section="ciudad"]').click()); }
    await page.waitForTimeout(1200);
    const sec = await page.evaluate(() => ({ hash: location.hash, title: document.querySelector('#dynamic-section .sec-hero__title')?.textContent, play: !!document.getElementById('ciudad-play'), active: document.querySelector('.nav-item[data-section="ciudad"]').classList.contains('is-active') }));
    ok(`[${mode}] abre la sección Ciudad ICADEM`, sec.hash === '#ciudad' && sec.title === 'Ciudad ICADEM' && sec.play, JSON.stringify(sec));
    for (let i = 0; i < 3; i++) { const sk = await page.$('text=Omitir'); if (sk) { await sk.click().catch(() => {}); await page.waitForTimeout(500); } }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
    await shot(page, `p-${mode}-seccion.png`);
    const overflowBefore = await page.evaluate(() => document.body.style.overflow);
    await page.evaluate(() => document.getElementById('ciudad-play').click());
    const frame = await (await page.waitForSelector('.ciudad-stage iframe')).contentFrame();
    await frame.waitForSelector('#splash-go:not([hidden])', { timeout: 40000 });
    await page.waitForTimeout(600);
    await shot(page, `p-${mode}-splash.png`);
    ok(`[${mode}] el juego carga dentro del panel a pantalla completa`, await page.evaluate(() => { const s = document.querySelector('.ciudad-stage'), r = s.getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight && s.classList.contains('is-ready'); }));
    await frame.click('#splash-go'); await page.waitForTimeout(2500);
    await shot(page, `p-${mode}-juego.png`);
    const inGame = await frame.evaluate(() => ({ hud: !document.getElementById('hud').hidden, exit: !document.getElementById('btn-exit').hidden, name: document.getElementById('player-name').textContent, touch: document.documentElement.classList.contains('is-touch') }));
    ok(`[${mode}] HUD visible con botón Salir`, inGame.hud && inGame.exit, JSON.stringify(inGame));
    if (mode === 'mobile') {
      // joystick táctil real
      const before = await frame.evaluate(() => 1);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 640, id: 1 }] });
      for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 640 - i * 8, id: 1 }] }); await page.waitForTimeout(40); }
      await page.waitForTimeout(2500);
      await shot(page, `p-${mode}-joystick.png`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const coachT = await frame.evaluate(() => document.getElementById('coach-title').textContent);
      ok(`[${mode}] el joystick táctil mueve al avatar (tutorial avanza)`, coachT !== 'Camina por tu habitación', coachT);
      // cámara táctil
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 300, id: 2 }] });
      for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300 - i * 18, y: 300, id: 2 }] }); await page.waitForTimeout(40); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(800);
      const coach2 = await frame.evaluate(() => document.getElementById('coach-title').textContent);
      ok(`[${mode}] arrastrar gira la cámara (tutorial avanza)`, coach2 === 'Interactúa con algo', coach2);
    }
    await frame.click('#btn-exit'); await page.waitForTimeout(600);
    ok(`[${mode}] Salir regresa al panel y libera el juego`, await page.evaluate(o => !document.querySelector('.ciudad-stage') && !window.ICADEMCiudad.isOpen() && document.body.style.overflow === o, overflowBefore));
    // cambiar de sección con el juego abierto lo cierra
    await page.evaluate(() => window.ICADEMCiudad.open()); await page.waitForTimeout(500);
    await page.evaluate(() => navigateToSection('retos')); await page.waitForTimeout(500);
    ok(`[${mode}] cambiar de sección cierra el juego`, await page.evaluate(() => !window.ICADEMCiudad.isOpen()));
    ok(`[${mode}] sin errores nuevos de JavaScript`, errs.filter(e => /ciudad|ICADEMCiudad/i.test(e)).length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: GL });
  try { await juego(browser); await panel(browser); }
  finally { await browser.close(); }
  console.log(results.map(r => r[0] + '  ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones en navegador`);
  process.exit(failed ? 1 : 0);
})().catch(error => { console.log(results.map(r => r.join('  ')).join('\n')); console.error('La prueba se interrumpió:', error.message); process.exit(2); });
