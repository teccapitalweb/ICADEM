#!/usr/bin/env node
'use strict';
// Ciudad ICADEM · comprobación de un servidor de sesiones DESPLEGADO, sin sesión y sin tocar datos.
// Verifica que esté vivo y que rechace todo lo que debe rechazar. La parte positiva (que un miembro
// real sí obtiene boleto) se hace desde el panel: ICADEMCiudad.probe('https://servidor').
//   node scripts/ciudad-server-check.cjs https://servidor.up.railway.app https://www.icademx.com
const [,, base, origin = 'https://www.icademx.com'] = process.argv;
if (!base) { console.error('Uso: node scripts/ciudad-server-check.cjs https://servidor [origen]'); process.exit(2); }
const url = base.replace(/\/$/, ''), results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra)]);
const post = (path, headers = {}, body) => fetch(url + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
(async () => {
  const health = await fetch(url + '/health').then(r => r.json()).catch(e => ({ error: e.message }));
  ok('el servidor responde /health', health.ok === true, JSON.stringify(health));
  ok('/health no expone a los jugadores (solo conteos)', health.ok === true && Object.keys(health).every(k => ['ok', 'instances', 'players', 'rooms', 'reports'].includes(k)), Object.keys(health).join());
  ok('sin token de sesión no hay boleto (401)', (await post('/ticket')).status === 401);
  ok('con un token inventado no hay boleto (401)', (await post('/ticket', { authorization: 'Bearer eyJhbGciOiJub25lIn0.e30.' })).status === 401);
  ok('el emisor de desarrollo no existe en producción (404)', (await post('/dev/ticket', {}, { uid: 'x', name: 'X' })).status === 404);
  ok('las conexiones de prueba no existen en producción (404)', (await post('/dev/connect', {}, { a: 'x', b: 'y' })).status === 404);
  ok('un origen ajeno es rechazado (403)', (await fetch(url + '/ticket', { method: 'POST', headers: { origin: 'https://otro.sitio' } })).status === 403);
  const pre = await fetch(url + '/ticket', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' } });
  ok('el panel puede llamar al servidor (CORS)', pre.status === 204 && pre.headers.get('access-control-allow-origin') === origin && /authorization/i.test(pre.headers.get('access-control-allow-headers') || ''), pre.status + ' ' + pre.headers.get('access-control-allow-origin'));
  let ws; try { const { WebSocket: W } = require('ws'); ws = W; } catch (_) { try { ws = require('/opt/npm-tools/node_modules/ws'); } catch (_) {} }
  if (ws) {
    const open = (hello, org = origin) => new Promise(resolve => { const s = new ws(url.replace(/^http/, 'ws'), { origin: org }); let out = null; s.on('message', m => { out = JSON.parse(m.toString()); }); s.on('open', () => s.send(JSON.stringify(hello))); s.on('close', () => resolve(out)); s.on('error', () => resolve(out || { error: 'connect' })); setTimeout(() => { s.terminate(); }, 6000); });
    ok('el socket rechaza identidades escritas por el cliente', (await open({ t: 'hello', token: 'test:a:A', uid: 'a', name: 'A' }))?.reason === 'no-autorizado');
    ok('el socket rechaza un boleto inventado', (await open({ t: 'hello', ticket: 'abc.def' }))?.reason === 'no-autorizado');
    ok('el socket rechaza un origen ajeno', (await open({ t: 'hello' }, 'https://otro.sitio'))?.t !== 'welcome');
  }
  console.log(results.map(r => r[0] + '  ' + r[1] + (r[2] ? '  → ' + r[2] : '')).join('\n'));
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones del servidor`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('La comprobación se interrumpió:', e.message); process.exit(2); });
