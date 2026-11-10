// Ciudad ICADEM · servidor de sesiones multijugador (WebSocket).
//
// ESTADO: entorno de PRUEBAS. No está desplegado ni conectado a la cartera real de ICADEM.
//
// Identidad: el socket solo acepta boletos firmados (auth.js). Quién puede obtener un boleto:
//   · modo "test"     → emisor de desarrollo POST /dev/ticket, solo desde la misma máquina.
//   · modo "firebase" → POST /ticket con el token de sesión de ICADEM, verificado con las
//                        llaves públicas de Google. Implementado y probado con llaves locales;
//                        falta probarlo contra el proyecto real y desplegarlo.
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Hub, LIMITS } from './hub.js';
import { TicketAuthority, createFirebaseVerifier, googleKeys } from './auth.js';
import { NET_TICK_HZ } from '../ciudad/js/net/network.js';
import { defineMission, replay } from '../ciudad/js/missions/engine.js';
import { BANK_CREDIT_MISSION } from '../ciudad/js/missions/bank-credit-logic.js';
import { COURT_JUDGE_MISSION } from '../ciudad/js/missions/court-judge-logic.js';

const MISSIONS = new Map([defineMission(BANK_CREDIT_MISSION), defineMission(COURT_JUDGE_MISSION)].map(d => [d.id, d]));
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * @param {object} o
 *   authority  TicketAuthority (boletos). Obligatoria la misma instancia para emitir y canjear.
 *   identity   async (tokenDeSesion) → { uid, name } | null   (verificador real; opcional en pruebas)
 *   authorize  async (identidad) → boolean                    (¿puede entrar a Ciudad ICADEM?)
 *   devLogin   habilita el emisor de desarrollo, solo desde la misma máquina
 *   origins    orígenes web permitidos (obligatorio si no es devLogin)
 */
export function createServer({ port = 0, host = '127.0.0.1', authority = new TicketAuthority(), identity = null, authorize = async () => true, devLogin = false, origins = null, capacity, now = Date.now, log = () => {} } = {}) {
  if (!devLogin && (!origins || !origins.length)) throw new Error('[ciudad] fuera del modo de prueba hay que declarar los orígenes permitidos');
  if (!devLogin && !identity) throw new Error('[ciudad] fuera del modo de prueba hace falta un verificador de identidad');
  const hub = new Hub({ capacity, now });
  const sockets = new Map();   // player → socket
  const originOk = origin => !origins || origins.includes(origin);
  const reply = (res, code, body, origin) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...(origin && originOk(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', vary: 'origin' } : {}) }); res.end(JSON.stringify(body)); };
  const readBody = req => new Promise(resolve => { let data = ''; req.on('data', c => { data += c; if (data.length > 2048) { data = ''; req.destroy(); } }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (_) { resolve(null); } }); req.on('error', () => resolve(null)); });
  const ticketHits = new Map();   // dirección → [marcas de tiempo]: máximo 20 boletos por minuto
  const throttled = ip => { const t = now(), list = (ticketHits.get(ip) || []).filter(x => t - x < 60000); list.push(t); ticketHits.set(ip, list); return list.length > 20; };

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin, ip = req.socket.remoteAddress || '';
    if (req.url === '/health') return reply(res, 200, { ok: true, ...hub.stats() });
    if (req.method === 'OPTIONS') return reply(res, originOk(origin) ? 204 : 403, {}, origin);
    if (req.method === 'POST' && (req.url === '/ticket' || req.url === '/dev/ticket')) {
      if (origin && !originOk(origin)) return reply(res, 403, { error: 'origen' });
      if (throttled(ip)) return reply(res, 429, { error: 'demasiadas-solicitudes' }, origin);
      let who = null;
      if (req.url === '/dev/ticket') {
        // Emisor de desarrollo: sustituye al inicio de sesión real SOLO en pruebas y SOLO en esta máquina.
        if (!devLogin || !LOOPBACK.has(ip)) return reply(res, 404, { error: 'no-disponible' }, origin);
        const body = await readBody(req), uid = body && /^[A-Za-z0-9_-]{1,40}$/.test(String(body.uid || '')) ? String(body.uid) : null;
        if (!uid) return reply(res, 400, { error: 'datos' }, origin);
        who = { uid: 'dev-' + uid, name: String(body.name || '') };
      } else {
        const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '');
        if (!identity || !bearer) return reply(res, 401, { error: 'no-autorizado' }, origin);
        try { who = await identity(bearer[1]); } catch (_) { who = null; }
        if (!who) return reply(res, 401, { error: 'no-autorizado' }, origin);
      }
      let allowed = false; try { allowed = await authorize(who); } catch (_) {}
      if (!allowed) return reply(res, 403, { error: 'sin-acceso' }, origin);
      return reply(res, 200, { ticket: authority.issue({ uid: who.uid, name: who.name || 'Jugador' }), expiresIn: 60 }, origin);
    }
    reply(res, 404, {});
  });
  const wss = new WebSocketServer({ server, maxPayload: 4096, verifyClient: info => originOk(info.origin) });
  const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const toRoom = (room, extra = {}) => { if (!room) return; const view = hub.roomView(room); for (const m of room.members.values()) send(sockets.get(m.player), { t: 'room', room: view, ...extra }); };
  const toInstance = (instance, msg, except) => { for (const p of instance.players.values()) if (p !== except && p.online) send(sockets.get(p), msg); };

  wss.on('connection', ws => {
    let player = null, epoch = 0, alive = true, budget = 0, budgetAt = now(), identityOf = null;
    ws.renew = () => { if (player && identityOf && sockets.get(player) === ws) send(ws, { t: 'resume', token: authority.issue({ ...identityOf, kind: 'resume' }) }); };
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
        // Identidad: boleto de entrada o pase de reanudación, ambos firmados y de un solo uso.
        const who = typeof msg.resume === 'string' ? authority.redeem(msg.resume, 'resume') : authority.redeem(msg.ticket, 'entry');
        if (!who) { send(ws, { t: 'bye', reason: 'no-autorizado' }); return ws.close(4003, 'no-autorizado'); }
        const joined = hub.join({ uid: who.uid, name: who.name, avatar: msg.avatar });
        player = joined.player; epoch = player.epoch; identityOf = who;
        const old = sockets.get(player);
        if (old && old !== ws) { send(old, { t: 'bye', reason: 'sesion-en-otro-lugar' }); old.close(4009, 'sustituida'); }
        sockets.set(player, ws); clearTimeout(helloTimer);
        send(ws, { t: 'welcome', pid: player.pid, name: player.name, instance: player.instance.id, resumed: joined.resumed, capacity: hub.capacity, tick: NET_TICK_HZ,
          resume: authority.issue({ ...who, kind: 'resume' }), roster: hub.roster(player.instance).filter(p => p.pid !== player.pid), room: player.room ? hub.roomView(player.room) : null });
        if (!joined.resumed || !joined.replaced) toInstance(player.instance, { t: 'join', pid: player.pid, name: player.name, avatar: player.avatar }, player);
        if (player.room) toRoom(player.room);
        log('join', player.pid, player.instance.id, joined.resumed ? 'resumed' : 'new');
        return;
      }
      if (player.epoch !== epoch) return;   // esta conexión ya fue sustituida

      if (msg.t !== 'say' && msg.t !== 'ping' && !hub.allow(player, msg.t === 's' ? 's' : msg.t)) return;   // tope por tipo de acción
      if (msg.t === 's') { const r = hub.state(player, msg.s); if (!r.ok && r.fix) send(ws, { t: 'fix', s: r.fix, reason: r.reason }); }
      else if (msg.t === 'say') { const r = hub.say(player, msg.id); if (r.ok) { r.to.forEach(p => send(sockets.get(p), { t: 'say', pid: player.pid, id: msg.id })); send(ws, { t: 'said', id: msg.id }); } else send(ws, { t: 'nosay', reason: r.reason }); }
      else if (msg.t === 'ping') send(ws, { t: 'pong', n: msg.n });
      else if (msg.t === 'report') { const r = hub.report(player, msg.pid, msg.reason); send(ws, { t: 'reported', ok: r.ok }); if (r.ok) log('report', player.pid, '→', msg.pid); }
      else if (msg.t === 'room') {
        const before = player.room;
        const r = msg.op === 'create' ? hub.createRoom(player, { mission: msg.mission }) : msg.op === 'join' ? hub.joinRoom(player, msg.code)
          : msg.op === 'leave' ? { ok: true, room: hub.leaveRoom(player), left: true } : msg.op === 'role' ? hub.setRole(player, msg.role ?? null)
          : msg.op === 'ready' ? hub.setReady(player, msg.ready) : msg.op === 'start' ? hub.startRoom(player) : { ok: false, reason: 'operacion' };
        if (r.left) { send(ws, { t: 'room', room: null, ok: true, op: 'leave' }); toRoom(r.room); }
        else if (!r.ok) send(ws, { t: 'room', room: player.room ? hub.roomView(player.room) : null, ok: false, op: msg.op, reason: r.reason });
        else { if (before && before !== player.room && before.members.size) toRoom(before); toRoom(player.room, { op: msg.op }); }
      }
      else if (msg.t === 'verify') {
        // Validación autoritativa de una misión: reproduce la bitácora. Aún NO acredita nada.
        const def = MISSIONS.get(String(msg.mission)), r = def ? replay(def, msg.log) : null;
        send(ws, { t: 'verified', mission: msg.mission, ok: Boolean(r && r.ok && r.result.valid), score: r && r.ok ? r.result.score : 0, passed: Boolean(r && r.ok && r.result.passed) });
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (!player || player.epoch !== epoch || sockets.get(player) !== ws) return;
      sockets.delete(player); hub.detach(player); if (player.room) toRoom(player.room);
      toInstance(player.instance, { t: 'leave', pid: player.pid, soft: true }, player);
      log('detach', player.pid);
    });
    ws.on('error', () => {});
  });

  // Ritmo del servidor: a cada jugador se le envía solo lo que puede ver.
  const tick = setInterval(() => {
    for (const [p, ws] of sockets) { if (!p.state) continue; send(ws, { t: 'snap', list: hub.snapshotFor(p) }); }
  }, 1000 / NET_TICK_HZ);
  let renewTick = 0;
  const upkeep = setInterval(() => {
    for (const p of [...hub.byUid.values()]) if (!p.online && now() - p.detachedAt >= LIMITS.resumeMs) { const room = p.room; hub.remove(p); toInstance(p.instance, { t: 'leave', pid: p.pid }); if (room && room.members.size) toRoom(room); log('expired', p.pid); }
    if (++renewTick % 12 === 0) wss.clients.forEach(ws => ws.renew && ws.renew());   // pase de reanudación nuevo cada minuto
    wss.clients.forEach(ws => ws.hb && ws.hb());
  }, 5000);

  return {
    hub, wss, server, authority,
    listen: () => new Promise(resolve => server.listen(port, host, () => resolve(server.address().port))),
    close: () => new Promise(resolve => { clearInterval(tick); clearInterval(upkeep); wss.clients.forEach(ws => ws.terminate()); wss.close(() => server.close(() => resolve())); })
  };
}

// Arranque directo: node _ciudad-server/server.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.env.CIUDAD_AUTH || 'test', print = (...a) => console.log('[ciudad]', ...a);
  const origins = process.env.CIUDAD_ORIGINS ? process.env.CIUDAD_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : null;
  let options;
  if (mode === 'test') {
    if (process.env.NODE_ENV === 'production') { console.error('[ciudad] El modo de prueba no se ejecuta en producción.'); process.exit(1); }
    options = { host: '127.0.0.1', devLogin: true, origins };   // en pruebas solo escucha en esta máquina
  } else if (mode === 'firebase') {
    const projectId = process.env.CIUDAD_FIREBASE_PROJECT, secret = process.env.CIUDAD_TICKET_SECRET || '';
    if (!projectId || secret.length < 32 || !origins) { console.error('[ciudad] Faltan CIUDAD_FIREBASE_PROJECT, CIUDAD_TICKET_SECRET (32+ caracteres) o CIUDAD_ORIGINS. No se arranca.'); process.exit(1); }
    options = { host: process.env.HOST || '0.0.0.0', devLogin: false, origins, authority: new TicketAuthority({ secret }), identity: createFirebaseVerifier({ projectId, getKeys: googleKeys() }) };
  } else { console.error('[ciudad] CIUDAD_AUTH desconocido: ' + mode); process.exit(1); }
  const app = createServer({ port: Number(process.env.PORT || 8787), log: print, ...options });
  app.listen().then(port => print(`servidor de ${mode === 'test' ? 'PRUEBA' : 'sesiones'} en el puerto ${port} · capacidad ${LIMITS.capacity} por instancia · identidad: ${mode}`));
}
