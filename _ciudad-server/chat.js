// Ciudad ICADEM · moderación del chat libre en el servidor (sin sockets, para poder probarla).
//
// El servidor es la autoridad del chat: el autor de cada mensaje sale de la sesión autenticada
// (nadie puede escribir en nombre de otro), el texto pasa por las reglas compartidas
// (ciudad/js/social/chat-rules.js) y aquí se llevan el ritmo, las repeticiones, los avisos y las
// restricciones temporales. Todo es por cuenta (uid), así que reconectarse no borra una sanción.
import { checkMessage } from '../ciudad/js/social/chat-rules.js';
import { createRateLimiter } from '../ciudad/js/social/phrases.js';

export const CHAT_LIMITS = Object.freeze({
  burst: { max: 4, windowMs: 10000 },    // ráfaga: 4 mensajes cada 10 s
  minute: { max: 15, windowMs: 60000 },  // sostenido: 15 por minuto
  repeatMs: 45000,                        // el mismo mensaje no se repite antes de 45 s
  strikeWindowMs: 10 * 60000,             // avisos que cuentan: los de los últimos 10 min
  strikesToRestrict: 3,                   // 3 avisos → restricción temporal
  restrictMs: [5 * 60000, 30 * 60000, 2 * 3600000],   // 5 min, luego 30 min, luego 2 h
  reportWindowMs: 30 * 60000,             // reportes de personas distintas en 30 min…
  reportsToRestrict: 3,                   // …3 reportes → pausa preventiva mientras se revisa
  reportRestrictMs: 15 * 60000,
  recent: 8,                              // mensajes recientes que se conservan como evidencia
  idleMs: 6 * 3600000                     // se olvida a quien lleva 6 h sin escribir y sin sanción
});

export class ChatGuard {
  constructor({ now = Date.now } = {}) { this.now = now; this.users = new Map(); this.seq = 0; }

  #user(uid) {
    let u = this.users.get(uid);
    if (!u) { u = { burst: createRateLimiter(CHAT_LIMITS.burst), minute: createRateLimiter(CHAT_LIMITS.minute), strikes: [], level: 0, until: 0, recent: [], reporters: new Map(), seen: 0, fast: 0 }; this.users.set(uid, u); }
    u.seen = this.now();
    return u;
  }

  /** Milisegundos que le quedan de restricción (0 si puede escribir). */
  restricted(uid) { const u = this.users.get(uid); return u ? Math.max(0, u.until - this.now()) : 0; }

  #strike(u, t) {
    u.strikes = u.strikes.filter(s => t - s < CHAT_LIMITS.strikeWindowMs); u.strikes.push(t);
    if (u.strikes.length < CHAT_LIMITS.strikesToRestrict) return 0;
    const ms = CHAT_LIMITS.restrictMs[Math.min(u.level, CHAT_LIMITS.restrictMs.length - 1)];
    u.until = Math.max(u.until, t + ms); u.level++; u.strikes = [];
    return ms;
  }

  /**
   * Revisa un mensaje propuesto. { ok, msg:{id,text,at} } o { ok:false, reason, wait?, restrictedMs? }.
   * Los rechazos por contenido cuentan como aviso; al tercero, el chat se pausa un tiempo.
   */
  check(uid, raw) {
    const t = this.now(), u = this.#user(uid);
    if (u.until > t) return { ok: false, reason: 'restringido', wait: Math.ceil((u.until - t) / 1000) };
    const c = checkMessage(raw);
    if (!c.ok) {
      const ms = c.strike ? this.#strike(u, t) : 0;
      return { ok: false, reason: c.reason, strikes: u.strikes.length, ...(ms ? { restrictedMs: ms, wait: Math.ceil(ms / 1000) } : {}) };
    }
    if (u.recent.some(m => m.key === c.key && t - m.at < CHAT_LIMITS.repeatMs)) return { ok: false, reason: 'repetido' };
    if (!u.burst(t) || !u.minute(t)) {
      // Insistir en saturar el chat también es una falta (uno de cada cinco intentos de más).
      const ms = ++u.fast % 5 === 0 ? this.#strike(u, t) : 0;
      return { ok: false, reason: 'demasiado-rapido', ...(ms ? { restrictedMs: ms, wait: Math.ceil(ms / 1000) } : {}) };
    }
    const msg = { id: ++this.seq, text: c.text, key: c.key, at: t };
    u.recent.push(msg); if (u.recent.length > CHAT_LIMITS.recent) u.recent.shift();
    return { ok: true, msg: { id: msg.id, text: msg.text, at: msg.at } };
  }

  /**
   * Reporte contra `targetUid`. La evidencia sale de lo que el SERVIDOR registró (el mensaje
   * reportado y los últimos del autor), nunca de un texto enviado por quien reporta.
   * Tres personas distintas en 30 min pausan el chat del reportado mientras se revisa.
   */
  report(targetUid, reporterUid, messageId = null) {
    const t = this.now(), u = this.#user(targetUid);
    for (const [k, at] of u.reporters) if (t - at > CHAT_LIMITS.reportWindowMs) u.reporters.delete(k);
    u.reporters.set(reporterUid, t);
    const id = Number(messageId) || null;
    const message = id ? u.recent.find(m => m.id === id) : null;
    let restricted = false;
    if (u.reporters.size >= CHAT_LIMITS.reportsToRestrict && u.until <= t) { u.until = t + CHAT_LIMITS.reportRestrictMs; u.reporters.clear(); restricted = true; }
    return { message: message ? { id: message.id, text: message.text, at: message.at } : null, recent: u.recent.slice(-3).map(m => ({ id: m.id, text: m.text, at: m.at })), restricted };
  }

  /** Limpieza periódica: se olvida a quien no tiene sanción vigente y lleva mucho sin escribir. */
  sweep() { const t = this.now(); for (const [uid, u] of this.users) if (u.until <= t && t - u.seen > CHAT_LIMITS.idleMs) this.users.delete(uid); }
}
