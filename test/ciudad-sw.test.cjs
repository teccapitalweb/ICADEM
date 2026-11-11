'use strict';
// Ciudad ICADEM · el service worker no mezcla versiones del juego y no cambia nada fuera de /ciudad/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** Ejecuta sw.js con un `self`, `caches` y `fetch` de mentira y devuelve el manejador de fetch. */
function loadWorker({ online = true, cached = {} } = {}) {
  const handlers = {}, calls = [], stored = new Map(Object.entries(cached));
  const cache = { put: async (req, res) => stored.set(String(req.url || req), res), addAll: async () => {} };
  const ctx = {
    self: { addEventListener: (type, fn) => { handlers[type] = fn; }, skipWaiting() {}, clients: { claim: async () => {} }, registration: {} },
    caches: { open: async () => cache, match: async req => stored.get(String(req.url || req)) || undefined, keys: async () => [], delete: async () => true },
    fetch: async (req, opts) => { calls.push({ url: String(req.url || req), opts: opts || null }); if (!online) throw new Error('sin red'); return { ok: true, clone() { return this; }, body: 'red:' + String(req.url || req) }; },
    location: { origin: 'https://www.icademx.com' }, URL, Promise, console
  };
  ctx.self.location = ctx.location;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), ctx);
  const request = (url, extra = {}) => ({ url, method: 'GET', mode: 'cors', destination: 'script', headers: { has: () => false }, ...extra });
  const dispatch = async req => { let out = null; handlers.fetch({ request: req, respondWith: p => { out = p; } }); return out ? await out : undefined; };
  return { dispatch, request, calls, stored };
}

test('sw: los módulos del juego se piden a la red validando (no se sirven viejos de la caché)', async () => {
  const w = loadWorker({ cached: { 'https://www.icademx.com/ciudad/js/net/network.js': { ok: true, body: 'VIEJO' } } });
  const res = await w.dispatch(w.request('https://www.icademx.com/ciudad/js/net/network.js'));
  assert.equal(res.body, 'red:https://www.icademx.com/ciudad/js/net/network.js', 'con red se usa la versión del servidor, no la de la caché');
  assert.equal(w.calls[0].opts && w.calls[0].opts.cache, 'no-cache', 'valida contra el servidor (evita la caché HTTP de 10 min)');
});

test('sw: sin conexión el juego sigue cargando desde la caché', async () => {
  const w = loadWorker({ online: false, cached: { 'https://www.icademx.com/ciudad/js/net/network.js': { ok: true, body: 'EN-CACHE' } } });
  const res = await w.dispatch(w.request('https://www.icademx.com/ciudad/js/net/network.js'));
  assert.equal(res.body, 'EN-CACHE');
});

test('sw: fuera de /ciudad/ todo sigue igual (cache-first) y se subió la versión de caché', async () => {
  const w = loadWorker({ cached: { 'https://www.icademx.com/css/vip.css': { ok: true, body: 'CSS-CACHE' } } });
  const res = await w.dispatch(w.request('https://www.icademx.com/css/vip.css', { destination: 'style' }));
  assert.equal(res.body, 'CSS-CACHE', 'el resto del panel conserva su estrategia');
  assert.equal(w.calls.length, 0);
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE = 'icadem-vip-v153';/);
  assert.match(sw, /js\/icadem-ciudad\.js\?v=4/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'vip-panel.html'), 'utf8'), /js\/icadem-ciudad\.js\?v=4/);
});
