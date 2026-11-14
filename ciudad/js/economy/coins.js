// Ciudad ICADEM 2.0 · monedas del juego (módulo puro; las aplica el servidor).
//
// Dos sistemas independientes:
//   · XP: sube de nivel y desbloquea logros. Comprar NUNCA descuenta XP.
//   · Monedas de Ciudad ICADEM: sirven solo para objetos del juego. No se convierten a dinero, no se
//     transfieren entre jugadores y no tienen relación con la cartera, los créditos de membresía, las
//     comisiones ni Stripe.
//
// Cada premio tiene una CLAVE: los premios únicos (primera misión, un logro, un sitio descubierto)
// no se pagan dos veces aunque el cliente repita el mensaje. Los premios de práctica (minijuegos,
// retos) tienen un tope diario común para que repetir no genere monedas sin límite.
import { dayKey } from '../edu/play-rules.js';

export const COINS = Object.freeze({
  start: 100,           // regalo de bienvenida al abrir la economía (una vez por cuenta)
  dailyCap: 150,        // tope diario de monedas de práctica (minijuegos, retos, repeticiones)
  quiz: 2,              // reto de un personaje que dio XP
  activityMax: 10,      // por partida (puntaje / 10)
  activityFirst: 15,    // primera vez que se completa un minijuego
  missionRepeat: 4,     // repetir una misión aprobada (una vez al día por misión, junto con su XP)
  discover: 5,          // sitio de la Ruta del explorador (una vez)
  achievement: 10,      // logro nuevo (una vez por logro)
  drink: 3,             // preparar bien un agua fresca (una vez al día)
  petCare: 2,           // dar de comer a una mascota (una vez al día por cuenta)
  ledger: 40,           // movimientos recientes que se guardan
  keys: 600             // claves de premios únicos que se recuerdan
});

export function emptyCoinbook() { return { day: '', today: 0, daily: {}, keys: [], ledger: [] }; }

export function cleanCoinbook(w) {
  const s = w && typeof w === 'object' ? w : {};
  const daily = {}; if (s.daily && typeof s.daily === 'object') for (const [k, v] of Object.entries(s.daily)) if (typeof v === 'string') daily[k.slice(0, 64)] = v.slice(0, 10);
  return {
    day: typeof s.day === 'string' ? s.day.slice(0, 10) : '', today: Math.max(0, Number(s.today) || 0), daily,
    keys: Array.isArray(s.keys) ? s.keys.filter(k => typeof k === 'string').map(k => k.slice(0, 80)).slice(-COINS.keys) : [],
    ledger: Array.isArray(s.ledger) ? s.ledger.filter(e => e && typeof e.k === 'string').map(e => ({ k: e.k.slice(0, 80), a: Math.round(Number(e.a) || 0), at: Number(e.at) || 0 })).slice(-COINS.ledger) : []
  };
}

function roll(w, now) { const d = dayKey(now); if (w.day !== d) { w.day = d; w.today = 0; } }
function log(p, k, a, now) { p.coinbook.ledger.push({ k, a, at: now }); if (p.coinbook.ledger.length > COINS.ledger) p.coinbook.ledger.splice(0, p.coinbook.ledger.length - COINS.ledger); }

/**
 * Acredita monedas. Opciones:
 *   once: la clave se paga una sola vez en la vida de la cuenta
 *   daily: la clave se paga una vez al día
 *   capped: cuenta para el tope diario de práctica
 * Devuelve las monedas acreditadas (0 si ya se pagó o se llegó al tope).
 */
export function earn(p, key, amount, { once = false, daily = false, capped = false } = {}, now = Date.now()) {
  const w = p.coinbook; roll(w, now);
  let n = Math.max(0, Math.round(Number(amount) || 0)); if (!n || !key) return 0;
  if (once && w.keys.includes(key)) return 0;
  if (daily && w.daily[key] === w.day) return 0;
  if (capped) n = Math.min(n, Math.max(0, COINS.dailyCap - w.today));
  if (!n) return 0;
  if (once) { w.keys.push(key); if (w.keys.length > COINS.keys) w.keys.splice(0, w.keys.length - COINS.keys); }
  if (daily) { w.daily[key] = w.day; const ks = Object.keys(w.daily); if (ks.length > 120) for (const k of ks) if (w.daily[k] !== w.day) delete w.daily[k]; }
  if (capped) w.today += n;
  p.coins += n; log(p, key, n, now);
  return n;
}

/** Cobra monedas. Devuelve false (sin cambios) si no alcanzan. */
export function spend(p, key, amount, now = Date.now()) {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  if (!Number.isFinite(p.coins) || p.coins < n) return false;
  p.coins -= n; if (n) log(p, key, -n, now);
  return true;
}

/** Monedas por un minijuego validado (puntaje 0–100); el bono de primera vez es aparte. */
export const activityCoins = score => Math.min(COINS.activityMax, Math.max(0, Math.round((Number(score) || 0) / 10)));
