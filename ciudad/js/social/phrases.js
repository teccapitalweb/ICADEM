// Frases rápidas: lista cerrada, sin texto libre. Desde la versión 1.2 son un complemento del
// chat libre (social/chat-rules.js + _ciudad-server/chat.js) y la ÚNICA forma de comunicarse para
// los perfiles infantiles y para quien no activó o pausó el chat. Módulo puro: cliente y servidor.

export const PHRASES = Object.freeze([
  { id: 'hola', text: '¡Hola!', emote: 'wave' },
  { id: 'jugamos', text: '¿Jugamos?', emote: 'celebrate' },
  { id: 'ven', text: 'Ven conmigo.', emote: 'beckon' },
  { id: 'bien', text: '¡Buen trabajo!', emote: 'clap' },
  { id: 'ayuda', text: 'Necesito ayuda.', emote: 'help' },
  { id: 'reto', text: 'Vamos al siguiente reto.', emote: 'point' }
]);

export const phraseById = id => PHRASES.find(p => p.id === id) || null;

/** Límite de mensajes: como máximo `max` frases cada `windowMs`. */
export const SAY_LIMIT = Object.freeze({ max: 3, windowMs: 8000 });
/** Las burbujas solo las ven quienes están cerca (metros) y en el mismo escenario. */
export const SAY_RADIUS = 30;
export const BUBBLE_SECONDS = 4.5;

/** Control de ritmo reutilizable (cliente para avisar, servidor para hacer cumplir). */
export function createRateLimiter({ max, windowMs } = SAY_LIMIT) {
  const stamps = [];
  return function allow(now) {
    while (stamps.length && now - stamps[0] >= windowMs) stamps.shift();
    if (stamps.length >= max) return false;
    stamps.push(now);
    return true;
  };
}
