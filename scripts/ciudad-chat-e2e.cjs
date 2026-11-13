'use strict';
// Ciudad ICADEM · chat libre de punta a punta contra el servidor de sesiones (modo de prueba):
// Ana en computadora y Beto en celular (emulado). Activación con mayoría de edad y normas,
// mensajes en tiempo real, burbujas, filtro, ritmo, silenciar, bloquear, reportar y reconexión.
//
// Uso:  node scripts/ciudad-chat-e2e.cjs http://127.0.0.1:8766
// Nota: el celular es EMULADO (Chromium con pantalla táctil y viewport de teléfono), no un equipo físico.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const PORT = Number(process.env.MP_PORT || 8797);
const DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ciudad-chat-'));
const LOG = process.env.E2E_LOG || null;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name]); const line = (cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  →  ' + String(extra).slice(0, 400)); console.log(line); if (LOG) fs.appendFileSync(LOG, line + '\n'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await sleep(200); } return false; };

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '_ciudad-server', 'server.js')], { env: { ...process.env, PORT: String(PORT), CIUDAD_AUTH: 'test', NODE_ENV: 'development', CIUDAD_DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.logs = ''; child.stdout.on('data', d => { child.logs += d; });
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/servidor de PRUEBA/.test(String(d))) resolve(child); }); child.stderr.on('data', d => reject(new Error(String(d)))); setTimeout(() => reject(new Error('el servidor no arrancó')), 8000); });
}

(async () => {
  const server = await startServer();
  const browser = await pw.chromium.launch({ args: GL });
  const open = async (uid, name, mobile) => {
    const ctx = await browser.newContext(mobile ? { viewport: { width: 412, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 1000, height: 620 } });
    const page = await ctx.newPage(); page.errs = []; page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', e => page.errs.push(e.message));
    await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&scene=plaza&avatar=0&tutorial=0&mp=ws://127.0.0.1:${PORT}&uid=${uid}&name=${name}`);
    await until(() => page.evaluate(() => window.__ciudad && window.__ciudad.api.net.isOnline), 40000);
    await page.evaluate(() => { const a = window.__ciudad.api; a.engine.renderer.setPixelRatio(0.5); a.store.state.settings.npcQuiz = false; });
    return page;
  };
  const rows = page => page.evaluate(() => [...document.querySelectorAll('#chat .chat__row:not(.is-system) .chat__text')].map(e => e.textContent));
  const toast = (page, re) => until(() => page.evaluate(src => [...document.querySelectorAll('#toasts *')].some(t => new RegExp(src).test(t.textContent)), re.source), 6000);
  const accept = async page => {
    await page.click('.chat__gate .btn');
    await until(() => page.evaluate(() => document.getElementById('modal-title').textContent === 'Activar chat libre'));
    await page.click('#modal-actions .btn--primary');
    const blocked = await page.evaluate(() => /Marca las dos casillas/.test(document.getElementById('modal-hint').textContent));
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/chat-terms.png' });
    await page.click('label:has(#chat-adult)'); await page.click('label:has(#chat-rules)'); await page.click('#modal-actions .btn--primary');
    return blocked && await until(() => page.evaluate(() => !document.querySelector('#chat .chat__form').hidden));
  };
  try {
    const ana = await open('ana', 'Ana', false);
    ok('computadora: ventana de chat visible con la invitación a activarlo', await until(() => ana.evaluate(() => !document.getElementById('chat').hidden && !document.querySelector('.chat__gate').hidden && /mayores de 18/.test(document.querySelector('.chat__gate').textContent))));
    ok('las frases rápidas siguen disponibles en la ventana', await ana.evaluate(() => document.querySelectorAll('.chat__quick button').length === 6 && !document.getElementById('btn-say').hidden));
    ok('activar exige confirmar mayoría de edad y normas (se guarda en la cuenta)', await accept(ana));

    const beto = await open('beto', 'Beto', true);
    ok('celular: botón de chat sin la ventana abierta (no tapa joystick ni botones)', await until(() => beto.evaluate(() => !document.getElementById('btn-chat').hidden && document.getElementById('chat').hidden)));
    const fabBox = await beto.evaluate(() => { const r = document.getElementById('btn-chat').getBoundingClientRect(), s = document.getElementById('stick').getBoundingClientRect(); return { fab: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight }; });
    ok('celular: el botón queda dentro de la pantalla', fabBox.fab[0] >= 0 && fabBox.fab[2] <= fabBox.vw && fabBox.fab[3] <= fabBox.vh, JSON.stringify(fabBox));
    await beto.tap('#btn-chat');
    ok('celular: el panel se abre arriba (mitad superior de la pantalla)', await until(() => beto.evaluate(() => { const c = document.getElementById('chat'); if (c.hidden || !c.classList.contains('is-sheet')) return false; const r = c.getBoundingClientRect(); return r.top < innerHeight * 0.2 && r.bottom < innerHeight * 0.66 && r.left >= 0 && r.right <= innerWidth; })));
    ok('celular: activar el chat', await accept(beto));

    // ambos en la plaza, cerca (posición validada por el servidor)
    const near = page => page.evaluate(() => { const a = window.__ciudad.api; a.player.position.set(2, 0, 4); });
    await near(ana); await near(beto); await sleep(900);

    // Ana escribe en computadora: Enter envía
    await ana.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(150);
    await ana.keyboard.press('KeyC'); await sleep(250);
    ok('C lleva el foco a la caja de texto', await ana.evaluate(() => document.activeElement && document.activeElement.id === 'chat-input'));
    await ana.keyboard.type('Hola Beto, ¿vamos al mapa?'); await ana.keyboard.press('Enter');
    ok('escribir no activa atajos del juego (la M no abre el mapa)', await ana.evaluate(() => document.getElementById('modal').hidden));
    ok('Beto recibe el mensaje de Ana en tiempo real', await until(async () => (await rows(beto)).includes('Hola Beto, ¿vamos al mapa?')), JSON.stringify(await rows(beto)));
    ok('aparece la burbuja sobre el avatar de Ana en la pantalla de Beto', await until(() => beto.evaluate(() => [...document.querySelectorAll('.bubble')].some(b => b.textContent === 'Hola Beto, ¿vamos al mapa?' && b.style.display !== 'none'))));
    ok('Ana ve su propio mensaje y su burbuja', (await rows(ana)).includes('Hola Beto, ¿vamos al mapa?') && await ana.evaluate(() => !!document.querySelector('.bubble--me')));
    await ana.keyboard.press('Escape');
    ok('Esc devuelve el control al juego', await ana.evaluate(() => document.activeElement.id !== 'chat-input'));

    // Beto responde desde el celular
    await beto.tap('#chat-input'); await beto.keyboard.type('¡Claro! Voy para allá'); await beto.tap('.chat__send');
    ok('Ana recibe el mensaje enviado desde el celular', await until(async () => (await rows(ana)).includes('¡Claro! Voy para allá')));
    ok('el nombre del autor lo pone el servidor', await ana.evaluate(() => [...document.querySelectorAll('#chat .chat__row')].some(r => /^beto$/i.test(r.querySelector('.chat__who')?.textContent || '') && /Voy para allá/.test(r.textContent))));

    // filtro y ritmo
    await ana.fill('#chat-input', 'entra a www.ejemplo.com'); await ana.press('#chat-input', 'Enter');
    ok('un enlace se rechaza con aviso claro', await toast(ana, /no se permiten enlaces/));
    await ana.evaluate(() => { const n = window.__ciudad.api.net; for (let i = 0; i < 6; i++) n.chat('send', { text: 'mensaje rápido ' + 'abcdef'[i], n: 900 + i }); });
    ok('el servidor frena una ráfaga (anti-spam)', await toast(ana, /Vas muy rápido/));
    await ana.evaluate(() => window.__ciudad.api.net.chat('send', { text: 'eres un pendejo', n: 990 }));
    ok('lenguaje abusivo rechazado por el servidor aunque se salte el aviso del navegador', await toast(ana, /no cumple las normas/));
    await sleep(800);
    ok('Beto no recibió el enlace ni el insulto', !(await rows(beto)).some(t => /ejemplo|pendejo/.test(t)), JSON.stringify(await rows(beto)));

    // reportar y bloquear desde el nombre en el chat (Beto)
    const pickFromName = async (opt) => {
      await beto.evaluate(() => [...document.querySelectorAll('#chat button.chat__who')].pop().click());
      await until(() => beto.evaluate(() => !document.getElementById('choice').hidden));
      await beto.evaluate(o => [...document.querySelectorAll('#choice .choice__opt')].find(b => b.dataset.id === o).click(), opt);
    };
    await pickFromName('report');
    ok('reportar un mensaje', await toast(beto, /Reporte enviado/));
    ok('el servidor registra el reporte del mensaje', await until(() => /report .* chat mensaje/.test(server.logs)), server.logs.slice(-400));
    await sleep(2500);   // ritmo del servidor (4 mensajes cada 10 s) tras la ráfaga
    await pickFromName('block');
    ok('bloquear: aviso y se quitan sus mensajes', await toast(beto, /Persona bloqueada/) && !(await rows(beto)).some(t => /vamos al mapa/.test(t)));
    await sleep(6000);
    await ana.fill('#chat-input', 'Beto, ¿me lees?'); await ana.press('#chat-input', 'Enter');
    ok('tras el bloqueo, Beto ya no recibe a Ana (y Ana sabe que nadie la leyó)', await until(() => ana.evaluate(() => /Nadie más te lee/.test(document.getElementById('chat').textContent))) && !(await rows(beto)).includes('Beto, ¿me lees?'));
    // desbloquear desde ⋯ (en el celular)
    await beto.tap('#chat .chat__icon'); await until(() => beto.evaluate(() => document.getElementById('modal-title').textContent === 'Opciones del chat'));
    await beto.evaluate(() => [...document.querySelectorAll('#modal-body .btn')].find(b => b.textContent === 'Desbloquear').click());
    await beto.evaluate(() => document.querySelector('#modal-actions .btn--primary').click());
    ok('desbloquear desde las opciones del chat', await toast(beto, /Desbloqueo hecho/));
    await sleep(1200);
    await ana.fill('#chat-input', 'Ahora sí, hola'); await ana.press('#chat-input', 'Enter');
    ok('después de desbloquear vuelve a recibir', await until(async () => (await rows(beto)).includes('Ahora sí, hola')));

    // silenciar (solo en este dispositivo)
    await pickFromName('mute');
    await sleep(1500); await ana.fill('#chat-input', 'mensaje para silenciado'); await ana.press('#chat-input', 'Enter'); await sleep(1500);
    ok('silenciar oculta sus mensajes en este dispositivo', !(await rows(beto)).includes('mensaje para silenciado'));
    await beto.evaluate(() => { const s = window.__ciudad.api.store.state.settings; s.muted = []; });

    // reconexión: se cae la red de Ana y vuelve sola; el chat sigue activo (está en la cuenta)
    await ana.evaluate(() => window.__ciudad.api.net.ws.close());
    ok('reconexión automática', await until(() => ana.evaluate(() => window.__ciudad.api.net.isOnline && !document.querySelector('#chat .chat__form').hidden), 25000));
    await sleep(6000); await near(ana); await sleep(600);
    await ana.fill('#chat-input', 'De vuelta en línea'); await ana.press('#chat-input', 'Enter');
    ok('tras reconectar se puede seguir conversando', await until(async () => (await rows(beto)).includes('De vuelta en línea')));
    ok('sin errores de JavaScript', !ana.errs.length && !beto.errs.length, JSON.stringify([...ana.errs, ...beto.errs]));
    if (process.env.SHOTS) { await ana.screenshot({ path: process.env.SHOTS + '/chat-pc.png' }); await beto.screenshot({ path: process.env.SHOTS + '/chat-movil.png' }); }
  } catch (e) { ok('la prueba terminó sin excepciones', false, e && e.stack); }
  finally { await browser.close().catch(() => {}); server.kill(); }
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones correctas`);
  process.exit(failed ? 1 : 0);
})();
