'use strict';
// Ciudad ICADEM · ayudante de pruebas: abre el servidor de sesiones real (modo de prueba) y un
// socket identificado con boleto de desarrollo, para enviar bitácoras de misión como un cliente.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..', '..');

async function openSession(t, uid = 'jugador') {
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return null;
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await import(pathToFileURL(path.join(root, '_ciudad-server/server.js')).href);
  const app = createServer({ devLogin: true }); const port = await app.listen(); t.after(() => app.close());
  const ticket = (await (await fetch(`http://127.0.0.1:${port}/dev/ticket`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, name: uid }) })).json()).ticket;
  const ws = new WebSocket('ws://127.0.0.1:' + port), inbox = [];
  ws.on('message', m => inbox.push(JSON.parse(m.toString())));
  const wait = type => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > 3000) return rej(new Error('sin ' + type)); setTimeout(poll, 20); })(); });
  await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'hello', ticket })); await wait('welcome');
  t.after(() => ws.close());
  return { mission: (mission, log) => { ws.send(JSON.stringify({ t: 'profile', op: 'mission', mission, log })); return wait('profile'); }, ws, wait, port };
}

/** Servidor real con varios jugadores identificados (para pruebas de equipos). */
async function openServer(t, options = {}) {
  if (!fs.existsSync(path.join(root, '_ciudad-server/node_modules/ws'))) return null;
  const WebSocket = require(path.join(root, '_ciudad-server/node_modules/ws'));
  const { createServer } = await import(pathToFileURL(path.join(root, '_ciudad-server/server.js')).href);
  const app = createServer({ devLogin: true, ...options }); const port = await app.listen(); t.after(() => app.close());
  const http = `http://127.0.0.1:${port}`;
  const post = (url, body) => fetch(http + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  async function client(uid, hello = null) {
    const ws = new WebSocket('ws://127.0.0.1:' + port), inbox = [];
    ws.on('message', m => inbox.push(JSON.parse(m.toString())));
    ws.wait = (type, pred = () => true, ms = 3000) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = inbox.findIndex(m => m.t === type && pred(m)); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error('sin ' + type)); setTimeout(poll, 15); })(); });
    ws.tell = msg => ws.send(JSON.stringify(msg));
    ws.drain = () => inbox.splice(0);
    await new Promise(r => ws.on('open', r));
    const ticket = hello ? null : (await (await post('/dev/ticket', { uid, name: uid })).json()).ticket;
    ws.tell({ t: 'hello', ...(hello || { ticket }) }); ws.welcome = await ws.wait('welcome');
    t.after(() => ws.terminate());
    return ws;
  }
  return { app, port, client, post };
}

module.exports = { openSession, openServer, root };
