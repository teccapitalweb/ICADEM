#!/usr/bin/env node
'use strict';
// Ciudad ICADEM · prueba multijugador de extremo a extremo con DOS navegadores reales
// (una computadora y un celular) contra el servidor de sesiones de prueba.
//
//   cd _ciudad-server && npm install        (una vez)
//   node scripts/ciudad-mp-e2e.cjs http://127.0.0.1:8765     (con el sitio servido en local)
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium, devices } = pw;

const BASE = (process.argv[2] || 'http://127.0.0.1:8765').replace(/\/$/, '');
const PORT = Number(process.env.MP_PORT || 8791);
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra)]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '_ciudad-server', 'server.js')], { env: { ...process.env, PORT: String(PORT), CIUDAD_AUTH: 'test', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/servidor de PRUEBA/.test(String(d))) resolve(child); }); child.stderr.on('data', d => reject(new Error(String(d)))); setTimeout(() => reject(new Error('el servidor no arrancó')), 8000); });
}
const stop = child => new Promise(r => { child.once('exit', r); child.kill('SIGKILL'); });

(async () => {
  let server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const open = async (uid, name, options) => {
      const ctx = await browser.newContext(options), page = await ctx.newPage(); page.errs = [];
      page.on('pageerror', e => page.errs.push(e.message));
      await page.goto(`${BASE}/ciudad/index.html?autostart=1&debug=1&tutorial=0&scene=plaza&mp=ws://127.0.0.1:${PORT}&uid=${uid}&name=${encodeURIComponent(name)}`);
      return page;
    };
    const A = await open('ana', 'Ana Torres', { viewport: { width: 960, height: 540 } });
    const B = await open('beto', 'Beto Ruiz', { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
    const until = async (page, fn, arg, tries = 120) => { for (let i = 0; i < tries; i++) { try { if (await page.evaluate(fn, arg)) return true; } catch (_) {} await sleep(500); } return false; };
    const seesOther = () => window.__ciudad && window.__ciudad.api.net.status === 'online' && window.__ciudad.remotes.count === 1;
    ok('los dos jugadores se conectan y se ven (computadora + celular)', (await until(A, seesOther)) && (await until(B, seesOther)));
    const view = page => page.evaluate(() => { const c = window.__ciudad, a = c.api, r = [...c.remotes.map.values()][0]; return { me: a.net.pid, inst: a.net.instance, roster: [...a.net.roster.values()].map(x => x.name), tags: [...document.querySelectorAll('.nametag')].map(e => e.textContent), chip: document.getElementById('net-chip').textContent, remote: r ? { pid: r.pid, x: r.x, z: r.z, anim: r.avatar.anim } : null, self: { x: a.player.position.x, z: a.player.position.z } }; });
    let va = await view(A), vb = await view(B);
    ok('misma instancia y nombres reales de cada quien', va.inst === vb.inst && va.roster.join() === 'Beto Ruiz' && vb.roster.join() === 'Ana Torres' && va.tags.join() === 'Beto Ruiz' && vb.tags.join() === 'Ana Torres', JSON.stringify({ va, vb }));
    ok('el indicador muestra 2 jugadores', /2 jugadores/.test(va.chip) && /2 jugadores/.test(vb.chip), va.chip + ' | ' + vb.chip);

    // movimiento sincronizado: Ana camina con el teclado; Beto la ve en el mismo lugar
    await A.evaluate(() => { const a = window.__ciudad.api; a.camera.yaw = Math.PI / 2; });
    const start = (await view(A)).self;
    await A.keyboard.down('KeyW'); let sawWalk = false;
    for (let i = 0; i < 40; i++) { await sleep(250); const v = await view(B); if (v.remote && (v.remote.anim === 'walk' || v.remote.anim === 'run')) sawWalk = true; const s = (await view(A)).self; if (Math.hypot(s.x - start.x, s.z - start.z) > 4) break; }
    await A.keyboard.up('KeyW'); await sleep(1800);
    va = await view(A); vb = await view(B);
    const gap = Math.hypot(vb.remote.x - va.self.x, vb.remote.z - va.self.z), moved = Math.hypot(va.self.x - start.x, va.self.z - start.z);
    ok('el movimiento de un jugador se ve en la pantalla del otro', moved > 3 && gap < 0.4, `caminó ${moved.toFixed(2)} m, diferencia ${gap.toFixed(2)} m`);
    ok('la animación de caminar también se sincroniza', sawWalk && vb.remote.anim === 'idle', vb.remote.anim);

    // frase rápida con gesto, de celular a computadora
    await B.evaluate(() => { const a = window.__ciudad.api, r = [...window.__ciudad.remotes.map.values()][0]; a.player.position.set(r.x + 1.6, 0, r.z + 1.2); });
    await sleep(900);
    await B.tap('#btn-say'); await sleep(250); await B.tap('#say-menu button[data-id="jugamos"]');
    ok('la frase rápida aparece como burbuja sobre el avatar del otro jugador', await until(A, () => [...document.querySelectorAll('.bubble:not(.bubble--me)')].some(e => e.textContent === '¿Jugamos?'), null, 16));
    ok('y el gesto viaja con ella', await until(A, () => [...window.__ciudad.remotes.map.values()][0].avatar.anim === 'celebrate', null, 10));
    await A.evaluate(() => { const a = window.__ciudad.api, r = [...window.__ciudad.remotes.map.values()][0]; a.camera.yaw = Math.atan2(a.player.position.x - r.x, a.player.position.z - r.z) + 0.5; a.camera.pitch = 0.35; a.camera.distance = 5; a.camera.snap(a.player.position); });
    await sleep(500); if (SHOTS) { await A.screenshot({ path: path.join(SHOTS, 'mp-computadora.png') }); await B.screenshot({ path: path.join(SHOTS, 'mp-celular.png') }); }
    // límite de mensajes
    for (let i = 0; i < 5; i++) { await A.keyboard.press('Digit1'); await sleep(120); }
    ok('límite de frases: avisa en vez de inundar', await until(A, () => [...document.querySelectorAll('#toasts > *')].some(e => /Espera un momento/.test(e.textContent)), null, 6));
    // silenciar
    await A.evaluate(() => { const a = window.__ciudad.api; a.store.state.settings.muted = [[...a.net.roster.keys()][0]]; document.querySelectorAll('.bubble:not(.bubble--me)').forEach(e => e.remove()); window.__ciudad.social.bubbles.forEach((v, k) => { if (k !== 'me') window.__ciudad.social.bubbles.delete(k); }); });
    await sleep(8200); await B.tap('#btn-say'); await sleep(250); await B.tap('#say-menu button[data-id="hola"]'); await sleep(1500);
    ok('silenciar a un jugador oculta sus frases', await A.evaluate(() => document.querySelectorAll('.bubble:not(.bubble--me)').length === 0));
    await A.evaluate(() => { window.__ciudad.api.store.state.settings.muted = []; });

    // la habitación es privada
    await B.evaluate(() => window.__ciudad.api.travel('room'));
    ok('quien entra a su habitación deja de verse en la ciudad', await until(A, () => window.__ciudad.remotes.count === 0 && !document.querySelector('.nametag'), null, 30));
    ok('y desde la habitación no se ve a nadie', await B.evaluate(() => window.__ciudad.api.sceneName === 'room' && window.__ciudad.remotes.count === 0));
    await B.evaluate(() => window.__ciudad.api.travel('plaza', 'home'));
    ok('al volver a la ciudad se reencuentran', (await until(A, seesOther, null, 40)) && (await until(B, seesOther, null, 40)));

    // reconexión: se cae el servidor y vuelve
    await stop(server);
    ok('si se pierde la conexión el juego lo avisa y no muestra jugadores fantasma', (await until(A, () => window.__ciudad.api.net.status === 'reconnecting' && window.__ciudad.remotes.count === 0 && /Reconectando/.test(document.getElementById('net-chip').textContent), null, 30)));
    ok('sin conexión se puede seguir jugando', await A.evaluate(() => !window.__ciudad.api.ui.isBlocking && window.__ciudad.api.input.enabled));
    server = await startServer();
    ok('al volver el servidor, ambos se reconectan solos y se vuelven a ver', (await until(A, seesOther, null, 60)) && (await until(B, seesOther, null, 60)));
    ok('sin errores de JavaScript en ninguno de los dos', A.errs.length === 0 && B.errs.length === 0, [...A.errs, ...B.errs].slice(0, 4).join(' | '));
  } finally { await browser.close(); await stop(server).catch(() => {}); }
  console.log(results.map(r => r[0] + '  ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones multijugador`);
  process.exit(failed ? 1 : 0);
})().catch(error => { console.log(results.map(r => r.join('  ')).join('\n')); console.error('La prueba se interrumpió:', error.message); process.exit(2); });
