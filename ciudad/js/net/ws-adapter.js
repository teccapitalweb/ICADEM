// Adaptador de red real: WebSocket contra el servidor de sesiones (_ciudad-server).
// Se reconecta solo, mide la latencia y entrega al juego lo que el servidor decide.
// Hoy solo se activa en pruebas locales (ver main.js): en producción el juego sigue sin red.
//
// Identidad: el adaptador nunca envía un nombre ni un identificador propios. Presenta un boleto
// firmado que obtiene de `getTicket()` (en producción lo entregará el panel de ICADEM tras validar
// la sesión; en pruebas, el emisor de desarrollo) y, para reconectarse, el pase que le dio el servidor.
import { NetworkAdapter } from './network.js';

// Espera entre reintentos: crece hasta un minuto para no saturar el servidor si está caído.
const BACKOFF = [600, 1200, 2500, 5000, 10000, 20000, 30000, 60000];

export class WsAdapter extends NetworkAdapter {
  /** @param {{url:string, getTicket:() => Promise<string>, avatar?:string, WebSocketImpl?:any}} o */
  constructor(o) {
    super();
    this.url = o.url; this.getTicket = o.getTicket; this.avatar = o.avatar || 'explorador'; this.resumeToken = null; this.roomState = null; this.friendList = []; this.presence = null; this.codes = []; this.invites = [];
    this.WS = o.WebSocketImpl || globalThis.WebSocket;
    this.ws = null; this.pid = null; this.instance = null; this.roster = new Map();
    this.status = 'offline';     // offline → connecting → online → reconnecting → closed
    this.latency = null; this.attempt = 0; this.closedByUs = false; this.timer = null; this.pingTimer = null; this.pingSeq = 0; this.pingAt = new Map();
    this.lastSent = null;
  }

  get isOnline() { return this.status === 'online'; }

  #set(status, detail) { this.status = status; this.emit('status', { status, detail, latency: this.latency, players: this.roster.size + (this.isOnline ? 1 : 0) }); }

  async connect() { this.closedByUs = false; this.#open(); }

  #open() {
    clearTimeout(this.timer);
    this.#set(this.attempt ? 'reconnecting' : 'connecting');
    this.#connect().catch(error => {
      if (error && error.code === 'sin-acceso') { this.status = 'closed'; this.emit('status', { status: 'closed', detail: 'sin-acceso' }); return; }   // sin acceso: el juego sigue sin red
      if (error && error.code === 'ciudad-llena') this.attempt = Math.max(this.attempt, BACKOFF.length - 1);
      this.#retry();
    });
  }

  async #connect() {
    // Credencial de un solo uso: primero el pase de reanudación; si no hay, un boleto nuevo.
    const hello = { t: 'hello' };
    if (this.resumeToken) { hello.resume = this.resumeToken; this.resumeToken = null; } else hello.ticket = await this.getTicket();
    if (this.closedByUs) return;
    const ws = new this.WS(this.url);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(hello));
    ws.onmessage = e => { let m; try { m = JSON.parse(typeof e.data === 'string' ? e.data : String(e.data)); } catch (_) { return; } this.#handle(m); };
    ws.onclose = () => { if (this.ws !== ws) return; this.ws = null; clearInterval(this.pingTimer); const had = [...this.roster.keys()]; this.roster.clear(); had.forEach(pid => this.emit('leave', { pid })); if (this.closedByUs || this.status === 'closed') return; this.#retry(); };
    ws.onerror = () => {};
  }

  #retry() {
    const wait = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)]; this.attempt++;
    this.#set('reconnecting');
    this.timer = setTimeout(() => this.#open(), wait);
  }

  #handle(m) {
    switch (m.t) {
      case 'welcome':
        this.pid = m.pid; this.instance = m.instance; this.attempt = 0; this.roster.clear(); this.resumeToken = m.resume || null; this.name = m.name;
        this.roomState = m.room || null; this.emit('room', { room: this.roomState });
        this.friendList = m.friends || []; this.presence = m.presence || null; this.codes = m.codes || []; if (m.presence) this.emit('presence', this.presence); if (m.profile) this.emit('profile', { op: 'get', ok: true, profile: m.profile });
        (m.roster || []).forEach(p => this.roster.set(p.pid, p));
        this.#set('online', { resumed: m.resumed });
        (m.roster || []).forEach(p => this.emit('join', p));
        if (this.lastSent) this.#send({ t: 's', s: this.lastSent });   // al volver, el servidor recupera dónde estamos
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.#ping(), 4000); this.#ping();
        break;
      case 'join': this.roster.set(m.pid, { pid: m.pid, name: m.name, avatar: m.avatar, custom: m.custom }); this.emit('join', this.roster.get(m.pid)); this.#set('online'); break;
      case 'leave': if (!m.soft) this.roster.delete(m.pid); this.emit('leave', { pid: m.pid, soft: Boolean(m.soft) }); this.#set('online'); break;
      case 'snap': this.emit('snap', m.list || []); break;
      case 'say': this.emit('say', { pid: m.pid, id: m.id }); break;
      case 'fix': this.emit('fix', m); break;
      case 'pong': { const at = this.pingAt.get(m.n); if (at) { this.pingAt.delete(m.n); this.latency = Math.round(performance.now() - at); this.#set('online'); } break; }
      case 'resume': this.resumeToken = m.token; break;
      case 'profile': this.emit('profile', m); break;
      case 'friends': if (m.list) this.friendList = m.list; this.emit('friends', m); break;
      case 'invite': this.invites = this.invites.filter(i => i.id !== m.id && i.exp > Date.now()).concat([{ id: m.id, from: m.from, exp: Date.now() + (m.expiresIn || 60) * 1000 }]); this.emit('invite', m); break;
      case 'invited': if (m.codes) this.codes = m.codes; this.emit('invited', m); break;
      case 'party': this.emit('party', m); break;
      case 'look': { const r = this.roster.get(m.pid); if (r) { r.avatar = m.avatar; r.custom = m.custom; } this.emit('look', m); break; }
      // Cambio de instancia (al aceptar una invitación): la lista de jugadores se reemplaza.
      case 'instance': { const had = [...this.roster.keys()]; this.roster.clear(); had.forEach(pid => this.emit('leave', { pid })); this.instance = m.instance; (m.roster || []).forEach(p => { this.roster.set(p.pid, p); this.emit('join', p); }); this.#set('online'); break; }
      case 'room': this.roomState = m.room || null; this.emit('room', m); break;
      case 'coop': this.emit('coop', m); break;
      case 'presence': this.presence = { city: m.city, instance: m.instance }; this.emit('presence', this.presence); this.#set('online'); break;
      case 'name': { const r = this.roster.get(m.pid); if (r) r.name = m.name; this.emit('name', m); break; }
      case 'code': if (m.codes) this.codes = m.codes; this.emit('code', m); break;
      case 'play': this.emit('play', m); break;
      // Un pase vencido no es definitivo: se reintenta con un boleto nuevo. Lo demás sí cierra.
      case 'bye':
        if (m.reason === 'no-autorizado' && this.attempt < 3) break;                                                       // pase vencido: se pide boleto nuevo
        if (m.reason === 'ciudad-llena' || m.reason === 'no-disponible') { this.attempt = Math.max(this.attempt, BACKOFF.length - 2); break; }   // se reintenta más tarde
        this.status = 'closed'; this.emit('status', { status: 'closed', detail: m.reason }); break;
    }
  }

  #send(msg) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(msg)); return true; } return false; }
  #ping() { const n = ++this.pingSeq; this.pingAt.set(n, performance.now()); if (this.pingAt.size > 8) this.pingAt.delete(this.pingAt.keys().next().value); this.#send({ t: 'ping', n }); }

  sendState(encoded) { this.lastSent = encoded; this.#send({ t: 's', s: encoded }); }
  say(phraseId) { return this.#send({ t: 'say', id: phraseId }); }
  report(pid, reason) { return this.#send({ t: 'report', pid, reason }); }
  /** Sala de espera: op = create | join | leave | role | ready | start. El servidor decide. */
  room(op, payload = {}) { return this.#send({ t: 'room', op, ...payload }); }
  /** Progreso en servidor: op = get | mission | visit | tutorial | avatar. */
  profile(op, payload = {}) { return this.#send({ t: 'profile', op, ...payload }); }
  /** Amigos: op = list | invite | answer. */
  friends(op, payload = {}) { return this.#send({ t: 'friends', op, ...payload }); }
  rally() { return this.#send({ t: 'party', op: 'rally' }); }
  coop(op, payload = {}) { return this.#send({ t: 'coop', op, ...payload }); }
  code(op, payload = {}) { return this.#send({ t: 'code', op, ...payload }); }
  play(op, payload = {}) { return this.#send({ t: 'play', op, ...payload }); }
  /** Respuesta a una invitación de una conexión: se quita de la lista de pendientes. */
  answerInvite(id, accept) { this.invites = this.invites.filter(i => i.id !== id); return this.friends('answer', { id, accept }); }
  nameOf(pid) { return this.roster.get(pid)?.name || 'Jugador'; }

  disconnect() { this.closedByUs = true; clearTimeout(this.timer); clearInterval(this.pingTimer); this.status = 'offline'; try { this.ws?.close(); } catch (_) {} this.ws = null; super.disconnect(); }
}

/**
 * Emisor de boletos del ENTORNO DE PRUEBAS: pide un boleto al emisor de desarrollo del servidor
 * (solo existe en modo de prueba y solo responde a la misma máquina). No se usa en producción.
 */
export function devTicketProvider(wsUrl, uid, name) {
  const http = wsUrl.replace(/^ws/, 'http').replace(/\/$/, '');
  return async () => {
    const res = await fetch(http + '/dev/ticket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, name }) });
    if (!res.ok) throw new Error('sin boleto');
    return (await res.json()).ticket;
  };
}

/** Pregunta al panel (ventana que contiene al juego) si hay servidor de sesiones configurado. */
export function askPanelForServer(timeoutMs = 700) {
  return new Promise(resolve => {
    if (window.parent === window) return resolve(null);
    const done = url => { removeEventListener('message', on); clearTimeout(timer); resolve(typeof url === 'string' && /^wss:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) ? url : null); };
    const on = e => { if (e.origin === location.origin && e.source === window.parent && e.data && e.data.type === 'ciudad:net') done(e.data.ws); };
    const timer = setTimeout(() => done(null), timeoutMs);
    addEventListener('message', on); window.parent.postMessage({ type: 'ciudad:net?' }, location.origin);
  });
}

/** Boletos en producción: los pide el panel con la sesión del usuario y se los pasa al juego. */
export function panelTicketProvider() {
  let n = 0;
  return () => new Promise((resolve, reject) => {
    const id = ++n, timer = setTimeout(() => { removeEventListener('message', on); reject(new Error('sin boleto')); }, 10000);
    const on = e => {
      if (e.origin !== location.origin || e.source !== window.parent || !e.data || e.data.type !== 'ciudad:ticket' || e.data.n !== id) return;
      removeEventListener('message', on); clearTimeout(timer);
      if (typeof e.data.ticket === 'string' && e.data.ticket) resolve(e.data.ticket); else reject(Object.assign(new Error('sin boleto'), { code: e.data.denied || null }));
    };
    addEventListener('message', on); window.parent.postMessage({ type: 'ciudad:ticket?', n: id }, location.origin);
  });
}
