// Ciudad ICADEM · servidor de sesiones multijugador (WebSocket).
//
// ESTADO: probado solo en local con economía de prueba. NO está desplegado ni conectado a la
// cartera real de ICADEM. Para producción falta: verificador de tokens de Firebase, despliegue
// (Railway) y pruebas de carga. Ver CIUDAD_ICADEM.md.
//
//   CIUDAD_AUTH=test   → acepta tokens de prueba "test:<uid>:<nombre>" (solo desarrollo).
//   CIUDAD_AUTH=firebase → exige un verificador real; sin él, el servidor se niega a arrancar.
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Hub, LIMITS } from './hub.js';
import { NET_TICK_HZ } from '../ciudad/js/net/network.js';
import { defineMission, replay } from '../ciudad/js/missions/engine.js';
import { BANK_CREDIT_MISSION } from '../ciudad/js/missions/bank-credit-logic.js';

const MISSIONS = new Map([defineMission(BANK_CREDIT_MISSION)].map(d => [d.id, d]));

/** Verificador de identidad. En modo prueba el nombre va en el token; en producción saldrá del token de Firebase. */
export function testVerifier(token) {
  const m = /^test:([A-Za-z0-9_-]{1,40}):(.{1,40})$/.exec(String(token || ''));
  return m ? { uid: 'test-' + m[1], name: m[2] } : null;
}

export function createServer({ port = 0, host = '127.0.0.1', verify = testVerifier, origins = null, capacity, now = Date.now, log = () => {} } = {}) {
  const hub = new Hub({ capacity, now });
  const sockets = new Map();   // player → socket
  const server = http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, ...hub.stats() })); return; }
    res.writeHead(404); res.end();
  });
  const wss = new WebSocketServer({ server, maxPayload: 4096, verifyClient: info => !origins || origins.includes(info.origin) });
  const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const toInstance = (instance, msg, except) => { for (const p of instance.players.values()) if (p !== except && p.online) send(sockets.get(p), msg); };

  wss.on('connection', ws => {
    let player = null, epoch = 0, alive = true, budget = 0, budgetAt = now();
    const helloTimer = setTimeout(() => { if (!player) ws.close(4001, 'sin-identificar'); }, 5000);
    ws.on('pong', () => { alive = true; });
    ws.hb = () => { if (!alive) return ws.terminate(); alive = false; try { ws.ping(); } catch (_) {} };

    ws.on('message', async raw => {
      // Tope de mensajes por conexión: 40 por segundo (el juego envía 10 estados por segundo).
      const t = now(); if (t - budgetAt >= 1000) { budgetAt = t; budget = 0; }
      if (++budget > 40) return ws.close(4008, 'demasiados-mensajes');
      let msg; try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
      if (!msg || typeof msg.t !== 'string') return;

      if (!player) {
        if (msg.t !== 'hello') return;
        let identity = null; try { identity = await verify(msg.token); } catch (_) {}
        if (!identity) { send(ws, { t: 'bye', reason: 'no-autorizado' }); return ws.close(4003, 'no-autorizado'); }
        const joined = hub.join({ uid: identity.uid, name: identity.name, avatar: msg.avatar });
        player = joined.player; epoch = player.epoch;
        const old = sockets.get(player);
        if (old && old !== ws) { send(old, { t: 'bye', reason: 'sesion-en-otro-lugar' }); old.close(4009, 'sustituida'); }
        sockets.set(player, ws); clearTimeout(helloTimer);
        send(ws, { t: 'welcome', pid: player.pid, name: player.name, instance: player.instance.id, resumed: joined.resumed, capacity: hub.capacity, tick: NET_TICK_HZ, roster: hub.roster(player.instance).filter(p => p.pid !== player.pid) });
        if (!joined.resumed || !joined.replaced) toInstance(player.instance, { t: 'join', pid: player.pid, name: player.name, avatar: player.avatar }, player);
        log('join', player.pid, player.instance.id, joined.resumed ? 'resumed' : 'new');
        return;
      }
      if (player.epoch !== epoch) return;   // esta conexión ya fue sustituida

      if (msg.t === 's') { const r = hub.state(player, msg.s); if (!r.ok && r.fix) send(ws, { t: 'fix', s: r.fix, reason: r.reason }); }
      else if (msg.t === 'say') { const r = hub.say(player, msg.id); if (r.ok) { r.to.forEach(p => send(sockets.get(p), { t: 'say', pid: player.pid, id: msg.id })); send(ws, { t: 'said', id: msg.id }); } else send(ws, { t: 'nosay', reason: r.reason }); }
      else if (msg.t === 'ping') send(ws, { t: 'pong', n: msg.n });
      else if (msg.t === 'report') { const r = hub.report(player, msg.pid, msg.reason); send(ws, { t: 'reported', ok: r.ok }); if (r.ok) log('report', player.pid, '→', msg.pid); }
      else if (msg.t === 'verify') {
        // Validación autoritativa de una misión: reproduce la bitácora. Aún NO acredita nada.
        const def = MISSIONS.get(String(msg.mission)), r = def ? replay(def, msg.log) : null;
        send(ws, { t: 'verified', mission: msg.mission, ok: Boolean(r && r.ok && r.result.valid), score: r && r.ok ? r.result.score : 0, passed: Boolean(r && r.ok && r.result.passed) });
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (!player || player.epoch !== epoch || sockets.get(player) !== ws) return;
      sockets.delete(player); hub.detach(player);
      toInstance(player.instance, { t: 'leave', pid: player.pid, soft: true }, player);
      log('detach', player.pid);
    });
    ws.on('error', () => {});
  });

  // Ritmo del servidor: a cada jugador se le envía solo lo que puede ver.
  const tick = setInterval(() => {
    for (const [p, ws] of sockets) { if (!p.state) continue; send(ws, { t: 'snap', list: hub.snapshotFor(p) }); }
  }, 1000 / NET_TICK_HZ);
  const upkeep = setInterval(() => {
    for (const p of hub.sweep()) { toInstance(p.instance, { t: 'leave', pid: p.pid }); log('expired', p.pid); }
    wss.clients.forEach(ws => ws.hb && ws.hb());
  }, 5000);

  return {
    hub, wss, server,
    listen: () => new Promise(resolve => server.listen(port, host, () => resolve(server.address().port))),
    close: () => new Promise(resolve => { clearInterval(tick); clearInterval(upkeep); wss.clients.forEach(ws => ws.terminate()); wss.close(() => server.close(() => resolve())); })
  };
}

// Arranque directo: node _ciudad-server/server.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.env.CIUDAD_AUTH || 'test';
  if (mode !== 'test') { console.error('[ciudad] CIUDAD_AUTH=' + mode + ' requiere un verificador de tokens que aún no está implementado. No se arranca.'); process.exit(1); }
  if (process.env.NODE_ENV === 'production') { console.error('[ciudad] El modo de prueba no se ejecuta en producción.'); process.exit(1); }
  const origins = process.env.CIUDAD_ORIGINS ? process.env.CIUDAD_ORIGINS.split(',') : null;
  const app = createServer({ port: Number(process.env.PORT || 8787), host: process.env.HOST || '127.0.0.1', origins, log: (...a) => console.log('[ciudad]', ...a) });
  app.listen().then(port => console.log(`[ciudad] servidor de PRUEBA en ws://127.0.0.1:${port} · capacidad ${LIMITS.capacity} por instancia`));
}
