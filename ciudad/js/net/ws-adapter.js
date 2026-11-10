// Adaptador de red real: WebSocket contra el servidor de sesiones (_ciudad-server).
// Se reconecta solo, mide la latencia y entrega al juego lo que el servidor decide.
// Hoy solo se activa en pruebas locales (ver main.js): en producción el juego sigue sin red.
import { NetworkAdapter } from './network.js';

const BACKOFF = [600, 1200, 2500, 5000, 8000];

export class WsAdapter extends NetworkAdapter {
  /** @param {{url:string, token:string, avatar?:string, WebSocketImpl?:any}} o */
  constructor(o) {
    super();
    this.url = o.url; this.token = o.token; this.avatar = o.avatar || 'explorador';
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
    let ws;
    try { ws = new this.WS(this.url); } catch (_) { return this.#retry(); }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token: this.token, avatar: this.avatar }));
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
        this.pid = m.pid; this.instance = m.instance; this.attempt = 0; this.roster.clear();
        (m.roster || []).forEach(p => this.roster.set(p.pid, p));
        this.#set('online', { resumed: m.resumed });
        (m.roster || []).forEach(p => this.emit('join', p));
        if (this.lastSent) this.#send({ t: 's', s: this.lastSent });   // al volver, el servidor recupera dónde estamos
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.#ping(), 4000); this.#ping();
        break;
      case 'join': this.roster.set(m.pid, { pid: m.pid, name: m.name, avatar: m.avatar }); this.emit('join', this.roster.get(m.pid)); this.#set('online'); break;
      case 'leave': if (!m.soft) this.roster.delete(m.pid); this.emit('leave', { pid: m.pid, soft: Boolean(m.soft) }); this.#set('online'); break;
      case 'snap': this.emit('snap', m.list || []); break;
      case 'say': this.emit('say', { pid: m.pid, id: m.id }); break;
      case 'fix': this.emit('fix', m); break;
      case 'pong': { const at = this.pingAt.get(m.n); if (at) { this.pingAt.delete(m.n); this.latency = Math.round(performance.now() - at); this.#set('online'); } break; }
      case 'bye': this.status = 'closed'; this.emit('status', { status: 'closed', detail: m.reason }); break;
    }
  }

  #send(msg) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(msg)); return true; } return false; }
  #ping() { const n = ++this.pingSeq; this.pingAt.set(n, performance.now()); if (this.pingAt.size > 8) this.pingAt.delete(this.pingAt.keys().next().value); this.#send({ t: 'ping', n }); }

  sendState(encoded) { this.lastSent = encoded; this.#send({ t: 's', s: encoded }); }
  say(phraseId) { return this.#send({ t: 'say', id: phraseId }); }
  report(pid, reason) { return this.#send({ t: 'report', pid, reason }); }
  nameOf(pid) { return this.roster.get(pid)?.name || 'Jugador'; }

  disconnect() { this.closedByUs = true; clearTimeout(this.timer); clearInterval(this.pingTimer); this.status = 'offline'; try { this.ws?.close(); } catch (_) {} this.ws = null; super.disconnect(); }
}
