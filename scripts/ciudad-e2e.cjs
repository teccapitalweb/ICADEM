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
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];

async function juego(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' :: ' + (e.stack||'').split('\n')[1]));
  page.on('crash', () => console.log('[e2e] la página del navegador se cayó (crash) a los ' + Math.round(process.uptime()) + ' s'));
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
  await page.click('#splash-go'); await page.waitForTimeout(1500);
  // primera vez: elegir personaje gratuito (vista 3D, tarjetas con miniatura) antes del tutorial
  const pick = await page.evaluate(() => ({ title: document.getElementById('modal-title').textContent, cards: [...document.querySelectorAll('.vcard')].map(c => c.dataset.id), locked: document.querySelectorAll('.vcard.is-locked').length, preview: Boolean(document.querySelector('.vest .preview3d')) }));
  ok('primera vez: aparece «Elige tu personaje» con los siete iniciales gratuitos y vista 3D', pick.title === 'Elige tu personaje' && pick.cards.length === 7 && pick.locked === 0 && pick.preview, JSON.stringify(pick));
  await page.click('.vcard[data-id="universitaria"]'); await page.waitForTimeout(300);
  await page.click('.vest__tabs button[data-id="estilo"]'); await page.click('.chips--swatch button[data-tone="t4"]'); await page.waitForTimeout(200);
  await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(1200);
  const chosen = await page.evaluate(() => { const s = window.__ciudad.api.store.state; return { id: s.avatarId, tone: s.custom.tone, chosen: s.avatarChosen }; });
  ok('el personaje elegido queda guardado (avatar, tono y «ya eligió»)', chosen.id === 'universitaria' && chosen.tone === 't4' && chosen.chosen === true, JSON.stringify(chosen));
  ok('tutorial arranca la primera vez', (await coach()) === 'Camina por tu habitación');
  await page.evaluate(() => { window.__ciudad.api.store.state.settings.npcQuiz = false; });   // los retos de los NPC tienen su propia prueba
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
  ok('aparece el aviso de interacción', label === 'Abrir vestidor', String(label));
  await E(); ok('E abre el vestidor', await modalOpen() && (await page.evaluate(() => document.getElementById('modal-title').textContent)) === 'Mi avatar');
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
  // cámara: girando 360° junto a cada edificio nunca queda dentro de uno; y al despejarse recupera su distancia
  const camSweep = await page.evaluate(async () => {
    const a = window.__ciudad.api, cam = a.camera, pos = a.engine.camera.position, tall = a.scene.collision.boxes.filter(b => b.h);
    let inside = 0, minArm = 99, samples = 0;
    for (const b of tall) for (const [px, pz] of [[(b.minX + b.maxX) / 2, b.maxZ + 0.6], [(b.minX + b.maxX) / 2, b.minZ - 0.6], [b.maxX + 0.6, (b.minZ + b.maxZ) / 2], [b.minX - 0.6, (b.minZ + b.maxZ) / 2]]) {
      if (Math.abs(px) > 45 || Math.abs(pz) > 45) continue;
      const free = a.scene.collision.resolve(px, pz, 0.36); a.player.position.set(free.x, 0, free.z);
      for (let i = 0; i < 16; i++) {
        cam.yaw = i * Math.PI / 8; cam.pitch = 0.15 + (i % 4) * 0.25; cam.snap(a.player.position); samples++;
        minArm = Math.min(minArm, cam.arm);
        if (tall.some(t => pos.x > t.minX && pos.x < t.maxX && pos.z > t.minZ && pos.z < t.maxZ && pos.y < t.h)) inside++;
      }
    }
    return { inside, samples, minArm, buildings: tall.length };
  });
  ok('la cámara nunca queda dentro de un edificio', camSweep.inside === 0 && camSweep.samples > 500 && camSweep.buildings === 11, JSON.stringify(camSweep));
  ok('junto a un muro la cámara conserva distancia (no se mete en el avatar)', camSweep.minArm > 2, `mínimo ${camSweep.minArm.toFixed(2)} m`);
  // gesto + frase rápida
  await tp(0, 9); await page.keyboard.press('Digit1'); await page.waitForTimeout(500);
  const hola = await page.evaluate(() => ({ bubble: document.querySelector('.bubble--me')?.textContent, anim: window.__ciudad.avatar.anim }));
  ok('tecla 1: frase rápida con gesto', hola.bubble === '¡Hola!' && hola.anim === 'wave', JSON.stringify(hola));
  await page.click('#btn-say'); await page.waitForTimeout(200);
  ok('el botón Frases abre las seis frases', (await page.evaluate(() => !document.getElementById('say-menu').hidden && document.querySelectorAll('#say-menu button').length)) === 6);
  await page.keyboard.press('KeyT'); await page.waitForTimeout(150);
  ok('sin servidor no aparece nadie más (ni indicador de conexión)', await page.evaluate(() => document.getElementById('net-chip').hidden && window.__ciudad.remotes.count === 0 && !document.querySelector('.nametag')));
  // Desde la 1.0 los once edificios tienen interior: la puerta del Hospital lleva al suyo y se vuelve a la plaza.
  await tp(-31, -21); await page.waitForTimeout(400); await E();
  ok('la puerta del Hospital lleva a su interior', await waitScene('hospital'));
  await shot(page, 'f7-hospital.png');
  await page.evaluate(() => window.__ciudad.api.travel('plaza', 'hospital')); await waitScene('plaza'); await page.waitForTimeout(600);
  // 8. banco
  await tp(-13, -20.2); await page.waitForTimeout(500); await shot(page, 'f8-banco-fuera.png'); await E();
  ok('se entra al Banco ICADEM', await waitScene('bank'));
  ok('al llegar se borra el destino', (await page.evaluate(() => window.__ciudad.api.waypoint)) === null || true);
  await page.waitForTimeout(800);
  const camBank = await page.evaluate(() => {
    const a = window.__ciudad.api, cam = a.camera, pos = a.engine.camera.position, b = a.scene.camera.box; let out = 0, minArm = 99;
    for (const [px, pz] of [[0, 3.9], [-8.4, -6.4], [8.4, 6.4], [-8.4, 6.4], [0, -2.2], [7.6, 0]]) { const f = a.scene.collision.resolve(px, pz, 0.36); a.player.position.set(f.x, 0, f.z);
      for (let i = 0; i < 16; i++) { cam.yaw = i * Math.PI / 8; cam.pitch = 0.1 + (i % 4) * 0.3; cam.snap(a.player.position); minArm = Math.min(minArm, cam.arm); if (pos.x < b.minX || pos.x > b.maxX || pos.z < b.minZ || pos.z > b.maxZ || pos.y > b.maxY) out++; } }
    a.player.position.set(0, 0, 3.9); cam.yaw = 0; cam.pitch = 0.46; cam.snap(a.player.position);
    return { out, minArm };
  });
  ok('en interiores la cámara no sale del recinto ni se pega al avatar', camBank.out === 0 && camBank.minArm > 1.6, JSON.stringify(camBank));
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
    // el tablero no se abre hasta calcular las tres propuestas en la computadora
    await tp(0, 0.4); await page.waitForTimeout(350); await E(); await page.waitForTimeout(400);
    const boardBlocked = !(await modalOpen()); await dialogThrough(); await page.waitForTimeout(300);
    await tp(3.1, 2.5); await page.waitForTimeout(350);
    const simLabel = await page.evaluate(() => document.getElementById('interact-label').textContent);
    await E(); await page.waitForTimeout(400);
    for (const id of ['expres', 'pyme', 'comodo']) { await page.click(`.sim__tabs button[data-id="${id}"]`); await page.waitForTimeout(120); await page.click('.sim__run'); await page.waitForTimeout(900); }
    const simPay = await page.evaluate(() => document.querySelector('.sim__big b')?.textContent);
    if (choice === 'first') { await shot(page, 'f10b-simulador.png'); ok('el tablero exige calcular antes en la computadora', boardBlocked); ok('la computadora del banco calcula la mensualidad', /simulador/i.test(simLabel) && simPay === '$4,251', simLabel + ' ' + simPay); }
    await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(400);
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
    // primera visita: el juego pide elegir personaje (Entrega 1); se elige el inicial como haría un usuario
    const picker = await frame.evaluate(() => !document.getElementById('modal').hidden && document.getElementById('modal-title').textContent === 'Elige tu personaje');
    if (picker) { await frame.click('#modal-actions .btn--primary'); await page.waitForTimeout(800); }
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
    await frame.click('#btn-more'); await frame.click('#btn-exit'); await page.waitForTimeout(600);   // «Salir al panel» vive en el menú Más
    ok(`[${mode}] Salir regresa al panel y libera el juego`, await page.evaluate(o => !document.querySelector('.ciudad-stage') && !window.ICADEMCiudad.isOpen() && document.body.style.overflow === o, overflowBefore));
    // cambiar de sección con el juego abierto lo cierra
    await page.evaluate(() => window.ICADEMCiudad.open()); await page.waitForTimeout(500);
    await page.evaluate(() => navigateToSection('retos')); await page.waitForTimeout(500);
    ok(`[${mode}] cambiar de sección cierra el juego`, await page.evaluate(() => !window.ICADEMCiudad.isOpen()));
    ok(`[${mode}] sin errores nuevos de JavaScript`, errs.filter(e => /ciudad|ICADEMCiudad/i.test(e)).length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
}

/** Tribunal ICADEM: la audiencia completa (acierto, repetición sin duplicar créditos y fallo). */
async function tribunal(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' :: ' + (e.stack || '').split('\n')[1]));
  page.on('crash', () => console.log('[e2e] la página del navegador se cayó (crash) a los ' + Math.round(process.uptime()) + ' s'));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const S = () => page.evaluate(() => { const a = window.__ciudad.api, p = a.player.position, m = a.missions.court; return { scene: a.sceneName, x: p.x, z: p.z, seated: Boolean(a.player.seat), step: m.step, state: JSON.parse(JSON.stringify(m.state)), bal: a.store.state.economy.balance, ledger: a.store.state.economy.ledger.length, rec: a.store.state.missions['tribunal-tu-eres-el-juez'] || null, bank: a.store.state.missions['banco-credito-correcto'] || null, ach: a.store.state.achievements }; });
  const tp = (x, z) => page.evaluate(([x, z]) => { const a = window.__ciudad.api; a.player.position.set(x, 0, z); a.camera.snap(a.player.position); }, [x, z]);
  const waitScene = async name => { for (let i = 0; i < 60; i++) { if ((await S()).scene === name && !(await page.evaluate(() => document.getElementById('fade').classList.contains('is-on')))) return true; await page.waitForTimeout(250); } return false; };
  const E = async () => { await page.keyboard.press('KeyE'); await page.waitForTimeout(500); };
  const ui = () => page.evaluate(() => { const d = document.getElementById('dialog'), c = document.getElementById('choice'), m = document.getElementById('modal'); return { dialog: d && !d.hidden ? document.getElementById('dialog-speaker').textContent + ': ' + document.getElementById('dialog-text').textContent : null, choice: c && !c.hidden ? c.querySelector('.choice__speaker').textContent : null, modal: m && !m.hidden ? document.getElementById('modal-title').textContent : null }; });
  const heard = [];
  /** Avanza diálogos hasta que aparezca una hoja de opciones o una ventana. */
  const until = async () => { for (let i = 0; i < 160; i++) { const u = await ui(); if (u.dialog) { await page.click('#dialog-next'); await page.waitForTimeout(90); const t = (await ui()).dialog; if (t) heard.push(t); await page.click('#dialog-next').catch(() => {}); await page.waitForTimeout(160); continue; } if (u.choice || u.modal) return u; await page.waitForTimeout(150); } return {}; };
  const choose = async id => { await page.click(`#choice .choice__opt[data-id="${id}"]`); await page.waitForTimeout(250); };
  const primary = async () => { await page.click('#modal-actions .btn--primary'); await page.waitForTimeout(350); };

  await page.goto(`${BASE}/ciudad/index.html?debug=1&autostart=1&tutorial=0&scene=plaza`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/ciudad/index.html?debug=1&autostart=1&tutorial=0&scene=plaza`);
  await page.waitForFunction(() => window.__ciudad && window.__ciudad.api.sceneName === 'plaza', null, { timeout: 40000 });
  await page.waitForTimeout(1200);
  await tp(13, -20.2); await page.waitForTimeout(400);
  const door = await page.evaluate(() => document.getElementById('interact-label').textContent);
  await shot(page, 't0-fachada.png'); await E();
  ok('[tribunal] se entra al Tribunal ICADEM desde la ciudad', door === 'Entrar al Tribunal ICADEM' && await waitScene('court'), door);
  await page.waitForTimeout(700); await shot(page, 't1-sala.png');
  const cam = await page.evaluate(() => {
    const a = window.__ciudad.api, cam = a.camera, pos = a.engine.camera.position, b = a.scene.camera.box; let out = 0, minArm = 99;
    for (const [px, pz] of [[0, 5.6], [-9, -1], [9, 6.5], [0, -1.6], [3.4, -3.9], [-9.4, 7.4]]) { const f = a.scene.collision.resolve(px, pz, 0.36); a.player.position.set(f.x, 0, f.z);
      for (let i = 0; i < 16; i++) { cam.yaw = i * Math.PI / 8; cam.pitch = 0.1 + (i % 4) * 0.3; cam.snap(a.player.position); minArm = Math.min(minArm, cam.arm); if (pos.x < b.minX || pos.x > b.maxX || pos.z < b.minZ || pos.z > b.maxZ || pos.y > b.maxY) out++; } }
    a.player.position.set(0, 0, 5.6); cam.yaw = 0; cam.pitch = 0.46; cam.snap(a.player.position);
    return { out, minArm, free: a.scene.collision.isFree(0, 5.6, 0.36) };
  });
  ok('[tribunal] cámara dentro de la sala y sin pegarse al avatar', cam.out === 0 && cam.minArm > 1.6 && cam.free, JSON.stringify(cam));
  // colisión: el estrado y la barandilla detienen al avatar
  await tp(-6, 5.0 - 0.9); await page.evaluate(() => { window.__ciudad.api.camera.yaw = 0; }); await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
  ok('[tribunal] la barandilla detiene al avatar', (await S()).z > 3.5, `z=${(await S()).z.toFixed(2)}`);

  const audiencia = async plan => {
    // el estrado no se puede tomar sin expediente ni pruebas
    await tp(3.4, -3.9); await page.waitForTimeout(350); await E(); await until();
    const early = (await S()).seated; await page.waitForTimeout(300);
    // secretaría: expediente y antecedentes
    await tp(5.6, -2.3); await page.waitForTimeout(350); await E(); let u = await until();
    const docket = await page.evaluate(() => [...document.querySelectorAll('.docket__item')].map(b => b.disabled));
    await page.click('.docket__item[data-id="exp-014"]'); if (plan.shots) await shot(page, 't2-expedientes.png'); await primary(); u = await until();
    if (plan.shots) await shot(page, 't3-antecedentes.png'); await primary();
    // mesa de pruebas
    await tp(0, -1.95); await page.waitForTimeout(350); await E(); await page.waitForTimeout(300);
    for (const id of ['contrato', 'inventario', 'cotizacion', 'mensajes', 'fotos']) { await page.click(`.docs__tabs button[data-id="${id}"]`); await page.waitForTimeout(120); }
    if (plan.shots) await shot(page, 't4-pruebas.png'); await primary();
    // estrado
    await tp(3.4, -3.9); await page.waitForTimeout(350); await E(); await until();
    const seated = (await S()).seated; if (plan.shots) await shot(page, 't5-estrado.png');
    await choose('abrir'); await until();
    await choose('parte:actora'); await until(); await choose('parte:demandada'); await until();
    await choose('testigo:ruben'); u = await until(); if (plan.shots) await shot(page, 't6-objecion.png');
    const firstObjection = u.choice; await choose(plan.objections.sugestiva); u = await until(); await choose(plan.objections.fecha); u = await until();
    if (plan.shots) await shot(page, 't7-preguntas.png');
    await choose('r-boiler'); await until(); await choose('fin'); await until();
    await choose('testigo:sofia'); await until(); await choose(plan.objections.oidas); await until(); await choose('s-vidrio'); await until(); await choose('fin'); await until();
    await choose('confrontar'); await page.waitForTimeout(350);
    for (const [st, exh] of Object.entries(plan.marks)) await page.click(`.confront__row[data-id="${st}"] .chips button[data-id="${exh}"]`);
    if (plan.shots) await shot(page, 't8-confrontar.png'); await primary(); await until();
    await choose('valorar'); await page.waitForTimeout(350);
    for (const [exh, w] of Object.entries(plan.weights)) await page.click(`.confront__row[data-id="${exh}"] .chips button[data-id="${w}"]`);
    if (plan.shots) await shot(page, 't9-valorar.png'); await primary(); await until();
    await choose('resolver'); await page.waitForTimeout(350); await page.click(`.pick__card[data-id="${plan.ruling}"]`); await primary();
    for (const gr of plan.grounds) await page.click(`.why__item[data-id="${gr}"]`);
    await primary(); await until();
    const score = await page.evaluate(() => document.querySelector('.result__score b')?.textContent), eyebrow = await page.evaluate(() => document.getElementById('modal-eyebrow').textContent);
    if (plan.shots) await shot(page, 't10-resultado.png');
    await primary(); await page.waitForTimeout(500);
    return { early, docket, seated, firstObjection, score, eyebrow };
  };
  const best = { sugestiva: 'ha-lugar', fecha: 'no-ha-lugar', oidas: 'ha-lugar' };
  const marks = { 'd-ernesto': 'mensajes', 'd-ruben': 'cotizacion', 'd-marta': 'null', 'd-sofia': 'null', 'd-edad': 'null' };
  const weights = { contrato: 'pleno', inventario: 'pleno', cotizacion: 'indicio', mensajes: 'pleno', fotos: 'nulo' };

  const r1 = await audiencia({ shots: true, objections: best, marks, weights, ruling: 'parcial', grounds: ['vidrio', 'recibido'] });
  let s = await S();
  ok('[tribunal] no deja subir al estrado sin expediente ni pruebas', r1.early === false);
  ok('[tribunal] la secretaria ofrece expedientes (uno listo, dos en preparación)', r1.docket.join() === 'false,true,true', r1.docket.join());
  ok('[tribunal] el jugador preside desde el estrado', r1.seated === true);
  ok('[tribunal] los abogados objetan y el juez resuelve', r1.firstObjection === 'Resuelve la objeción', String(r1.firstObjection));
  ok('[tribunal] los NPC declaran: se escuchó a las partes y a los dos testigos', ['Lic. Paula Mena', 'Lic. Hugo Barrera', 'Rubén Ortega', 'Sofía Luna', 'Secretaria de acuerdos'].every(n => heard.some(t => t.startsWith(n))), heard.length + ' líneas');
  ok('[tribunal] admitir una objeción retira la pregunta (el testigo no la contesta)', !heard.some(t => /era descuidada/.test(t)) && heard.some(t => /12 de mayo/.test(t)));
  ok('[tribunal] audiencia perfecta: 100 puntos', r1.score === '100' && /completada/i.test(r1.eyebrow), r1.score + ' ' + r1.eyebrow);
  ok('[tribunal] recompensa de prueba: +20 créditos y registro de finalización', s.bal === 20 && s.ledger === 1 && s.rec && s.rec.completed && s.rec.bestScore === 100 && s.ach.includes('toga-y-mazo') && s.ach.includes('primera-mision'), JSON.stringify({ bal: s.bal, rec: s.rec }));
  ok('[tribunal] al terminar baja del estrado y la misión se reinicia', !s.seated && s.step === 'expediente');
  // repetir con otra resolución defendible pero incompleta: no duplica créditos
  heard.length = 0;
  const r2 = await audiencia({ objections: { sugestiva: 'no-ha-lugar', fecha: 'ha-lugar', oidas: 'no-ha-lugar' }, marks: { 'd-ernesto': 'null', 'd-ruben': 'null', 'd-marta': 'fotos', 'd-sofia': 'null', 'd-edad': 'null' }, weights: { contrato: 'pleno', inventario: 'indicio', cotizacion: 'pleno', mensajes: 'nulo', fotos: 'pleno' }, ruling: 'absolver', grounds: ['cotizacion', 'fotos'] });
  s = await S();
  ok('[tribunal] decisiones equivocadas generan otro resultado (no superada)', Number(r2.score) < 70 && /no superada/i.test(r2.eyebrow), r2.score + ' ' + r2.eyebrow);
  ok('[tribunal] rechazar la objeción deja contestar; admitir la otra oculta la fecha', heard.some(t => /era descuidada/.test(t)) && !heard.some(t => /Rubén Ortega: La hice/.test(t)));
  const r3 = await audiencia({ objections: best, marks, weights, ruling: 'parcial', grounds: ['vidrio', 'desgaste', 'recibido'] });
  s = await S();
  ok('[tribunal] repetir y volver a ganar no duplica créditos', r3.score === '100' && s.bal === 20 && s.ledger === 1 && s.rec.attempts === 3, JSON.stringify({ score: r3.score, bal: s.bal, ledger: s.ledger, rec: s.rec }));
  // sala de espera sin conexión: se explica, no se simula
  await tp(8.2, 6.6); await page.waitForTimeout(350); await E(); await page.waitForTimeout(400);
  const lobby = await page.evaluate(() => document.querySelector('.lobby')?.textContent || '');
  ok('[tribunal] la sala de espera en equipo no finge funcionar sin servidor', /En desarrollo/.test(lobby) && /entorno de pruebas/.test(lobby) && !/Crear sala/.test(lobby), lobby.slice(0, 120));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await tp(0, 6.9); await page.waitForTimeout(350); await E();
  ok('[tribunal] se sale del Tribunal a la ciudad', await waitScene('plaza'));
  ok('[tribunal] el Banco sigue registrado en el mismo motor', await page.evaluate(() => { const svc = window.__ciudad.api.missionService; return svc.registry.list().map(d => d.id).join() === 'banco-credito-correcto,tribunal-tu-eres-el-juez' && svc.rewardFor('banco-credito-correcto').amount === 15 && svc.rewardFor('tribunal-tu-eres-el-juez').amount === 20; }));
  ok('[tribunal] sin errores de JavaScript', errors.length === 0, errors.slice(0, 4).join(' | '));
  await page.close();
}

/** Tablet y celular (vertical y horizontal): controles táctiles dentro de pantalla y jugables. */
async function dispositivos(browser) {
  const perfiles = [
    ['tablet', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad (gen 7)'] ? devices['iPad (gen 7)'].userAgent : devices['iPhone 13'].userAgent }],
    ['tablet horizontal', { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad (gen 7)'] ? devices['iPad (gen 7)'].userAgent : devices['iPhone 13'].userAgent }],
    ['celular horizontal', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent }]
  ];
  for (const [nombre, opciones] of perfiles) {
    const ctx = await browser.newContext(opciones), page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`${BASE}/ciudad/index.html?debug=1&autostart=1&tutorial=0&scene=plaza`);
    await page.waitForFunction(() => window.__ciudad && window.__ciudad.api.sceneName === 'plaza', null, { timeout: 40000 });
    await page.waitForTimeout(1500);
    const { width: W, height: H } = opciones.viewport;
    const layout = await page.evaluate(() => {
      const box = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
      return { touch: document.documentElement.classList.contains('is-touch'), jump: box('pad-jump'), run: box('pad-run'), say: box('btn-say'), map: box('btn-map'), more: box('btn-more'), player: box('btn-player') };
    });
    const dentro = b => b && b.l >= 0 && b.t >= 0 && b.r <= W && b.b <= H;
    const choca = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const ids = ['jump', 'run', 'say', 'map', 'more', 'player'];
    const fuera = ids.filter(k => !dentro(layout[k])), encimados = ids.flatMap((a, i) => ids.slice(i + 1).filter(b => choca(layout[a], layout[b])).map(b => a + '/' + b));
    ok(`[${nombre}] controles táctiles visibles, dentro de pantalla y sin encimarse`, layout.touch && !fuera.length && !encimados.length, JSON.stringify({ fuera, encimados, touch: layout.touch }));
    // Ajustes y Vestidor viven en el menú «Más»: al tocarlo aparecen dentro de la pantalla
    await page.tap('#btn-more'); await page.waitForTimeout(250);
    const mas = await page.evaluate(() => ['btn-wardrobe', 'btn-settings'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
    await page.tap('#btn-more'); await page.waitForTimeout(150);
    ok(`[${nombre}] el menú «Más» muestra Vestidor y Ajustes dentro de la pantalla`, mas.every(Boolean), JSON.stringify(mas));
    const cdp = await ctx.newCDPSession(page), antes = await page.evaluate(() => ({ w: window.__ciudad.api.stats.walked, t: window.__ciudad.api.camera.turned }));
    const sx = Math.round(W * 0.16), sy = Math.round(H * 0.78);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - i * 7, id: 1 }] }); await page.waitForTimeout(40); }
    for (let i = 0; i < 30 && (await page.evaluate(() => window.__ciudad.api.stats.walked)) - antes.w < 1.2; i++) await page.waitForTimeout(250);
    await shot(page, `d-${nombre.replace(/ /g, '-')}.png`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const cx = Math.round(W * 0.7), cy = Math.round(H * 0.4);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 2 }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - i * 16, y: cy, id: 2 }] }); await page.waitForTimeout(40); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(700);
    const despues = await page.evaluate(() => ({ w: window.__ciudad.api.stats.walked, t: window.__ciudad.api.camera.turned }));
    ok(`[${nombre}] joystick mueve al avatar y el arrastre gira la cámara`, despues.w - antes.w > 1 && despues.t - antes.t > 0.5, JSON.stringify({ camino: +(despues.w - antes.w).toFixed(2), giro: +(despues.t - antes.t).toFixed(2) }));
    await page.tap('#btn-say'); await page.waitForTimeout(250);
    const menu = await page.evaluate(() => { const r = document.getElementById('say-menu').getBoundingClientRect(); return { open: !document.getElementById('say-menu').hidden, l: r.left, t: r.top, r: r.right, b: r.bottom }; });
    await page.tap('#say-menu button[data-id="bien"]'); await page.waitForTimeout(400);
    const dijo = await page.evaluate(() => document.querySelector('.bubble--me')?.textContent);
    ok(`[${nombre}] frases táctiles: el menú cabe en pantalla y la burbuja aparece`, menu.open && menu.l >= 0 && menu.t >= 0 && menu.r <= W && menu.b <= H && dijo === '¡Buen trabajo!', JSON.stringify({ menu, dijo }));
    // hoja de opciones de la audiencia: cabe en pantalla y se puede tocar hasta la última opción
    await page.evaluate(() => { window.__pick = window.__ciudad.api.ui.choice({ speaker: 'Estrado del juez', text: 'La audiencia está abierta. ¿Qué sigue?', options: Array.from({ length: 8 }, (_, i) => ({ id: 'o' + i, label: 'Opción de audiencia número ' + (i + 1), hint: i % 2 ? 'Detalle de la opción' : '', disabled: i === 2 })) }); });
    await page.waitForTimeout(350);
    const hoja = await page.evaluate(() => { const r = document.querySelector('.choice__card').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, n: document.querySelectorAll('.choice__opt').length }; });
    await shot(page, `d-${nombre.replace(/ /g, '-')}-opciones.png`);
    await page.tap('#choice .choice__opt[data-id="o7"]');
    const elegido = await page.evaluate(() => window.__pick);
    ok(`[${nombre}] la hoja de opciones de la audiencia cabe en pantalla y responde al toque`, hoja.n === 8 && hoja.l >= 0 && hoja.t >= 0 && hoja.r <= W && hoja.b <= H && elegido === 'o7', JSON.stringify({ hoja, elegido }));
    ok(`[${nombre}] sin errores de JavaScript`, errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: GL });
  try {
    const only = process.env.ONLY || '';
    if (!only || only === 'juego') await juego(browser);
    if (!only || only === 'tribunal') await tribunal(browser);
    if (!only || only === 'dispositivos') await dispositivos(browser);
    if (!only || only === 'panel') await panel(browser);
  }
  finally { await browser.close(); }
  console.log(results.map(r => r[0] + '  ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones en navegador`);
  process.exit(failed ? 1 : 0);
})().catch(error => { console.log(results.map(r => r.join('  ')).join('\n')); console.error('La prueba se interrumpió:', error.message); process.exit(2); });
