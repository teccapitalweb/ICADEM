// Ciudad ICADEM · identidad del multijugador.
//
// Regla: el servidor de juego NUNCA acepta un identificador escrito por el navegador como
// prueba de quién es alguien. La identidad siempre llega firmada:
//
//   1. El jugador demuestra quién es ante el emisor de boletos con su token de sesión de ICADEM
//      (token de Firebase, verificado criptográficamente aquí con las llaves públicas de Google).
//   2. El emisor le entrega un BOLETO de entrada: corto (60 s), de un solo uso y firmado.
//   3. El socket del juego solo acepta boletos válidos. El nombre visible sale del boleto.
//   4. Para reconectarse se usa un pase de reanudación, también firmado y de un solo uso.
//
// En el entorno de pruebas el paso 1 lo sustituye un emisor de desarrollo (solo en la misma
// máquina); los pasos 2 a 4 son idénticos, así que lo que se prueba es lo que irá a producción.
import { createHmac, createPublicKey, createVerify, randomBytes, timingSafeEqual, X509Certificate } from 'node:crypto';

const b64u = value => Buffer.from(value).toString('base64url');
const json = part => { try { const v = JSON.parse(Buffer.from(String(part), 'base64url').toString('utf8')); return v && typeof v === 'object' ? v : null; } catch (_) { return null; } };
const cleanName = name => String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 28);

/**
 * Verificador de tokens de sesión de Firebase (los que ya usa ICADEM): firma RS256 contra las
 * llaves públicas de Google, proyecto, emisor y vigencia. Sin dependencias externas.
 * `getKeys()` devuelve { kid: PEM } (certificado o llave pública).
 */
export function createFirebaseVerifier({ projectId, getKeys, now = Date.now, skewMs = 60000 }) {
  if (!projectId || typeof getKeys !== 'function') throw new Error('[ciudad] verificador sin proyecto o sin llaves');
  return async function verifyIdToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const header = json(parts[0]), claims = json(parts[1]);
    if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;   // nada de "alg: none" ni HS256
    let pem; try { pem = (await getKeys())[header.kid]; } catch (_) { return null; }
    if (!pem) return null;
    let valid = false;
    try {
      const key = /CERTIFICATE/.test(pem) ? new X509Certificate(pem).publicKey : createPublicKey(pem);
      valid = createVerify('RSA-SHA256').update(parts[0] + '.' + parts[1]).verify(key, Buffer.from(parts[2], 'base64url'));
    } catch (_) { valid = false; }
    if (!valid) return null;
    const t = now() / 1000, skew = skewMs / 1000;
    if (claims.aud !== projectId || claims.iss !== 'https://securetoken.google.com/' + projectId) return null;
    if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) return null;
    if (!(Number(claims.exp) > t) || !(Number(claims.iat) <= t + skew) || (claims.auth_time !== undefined && !(Number(claims.auth_time) <= t + skew))) return null;
    return { uid: claims.sub, name: cleanName(claims.name), claims };
  };
}

/** Descarga y guarda en memoria las llaves públicas de Google (respeta su tiempo de caché). */
export function googleKeys(fetchImpl = globalThis.fetch, url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com') {
  let cache = null, until = 0;
  return async () => {
    if (cache && Date.now() < until) return cache;
    const res = await fetchImpl(url); if (!res.ok) throw new Error('llaves no disponibles');
    const age = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
    cache = await res.json(); until = Date.now() + (age ? Number(age[1]) : 3600) * 1000;
    return cache;
  };
}

/** Emisor y verificador de boletos firmados (HMAC-SHA256), de un solo uso. */
export class TicketAuthority {
  constructor({ secret = randomBytes(32), now = Date.now } = {}) {
    const key = Buffer.isBuffer(secret) ? secret : Buffer.from(String(secret));
    if (key.length < 32) throw new Error('[ciudad] el secreto de boletos debe medir al menos 32 bytes');
    this.key = key; this.now = now; this.used = new Map();   // jti → vencimiento
  }

  #sign(body) { return createHmac('sha256', this.key).update(body).digest(); }

  /** kind: 'entry' (entrada, 60 s) o 'resume' (reanudación, 2 min). */
  issue({ uid, name, kind = 'entry', ttlMs = kind === 'entry' ? 60000 : 120000 }) {
    if (typeof uid !== 'string' || !uid) throw new Error('[ciudad] boleto sin usuario');
    const body = b64u(JSON.stringify({ v: 1, k: kind, uid, name: cleanName(name), exp: this.now() + ttlMs, jti: randomBytes(12).toString('base64url') }));
    return body + '.' + b64u(this.#sign(body));
  }

  /** Devuelve { uid, name } o null. Un boleto usado no vuelve a servir. */
  redeem(token, kind = 'entry') {
    const [body, sig, extra] = String(token || '').split('.');
    if (!body || !sig || extra !== undefined) return null;
    const expected = this.#sign(body); let given; try { given = Buffer.from(sig, 'base64url'); } catch (_) { return null; }
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const p = json(body), t = this.now();
    if (!p || p.v !== 1 || p.k !== kind || typeof p.uid !== 'string' || !p.uid || !(p.exp > t) || typeof p.jti !== 'string') return null;
    for (const [jti, exp] of this.used) if (exp <= t) this.used.delete(jti);
    if (this.used.has(p.jti)) return null;
    this.used.set(p.jti, p.exp);
    return { uid: p.uid, name: cleanName(p.name) };
  }
}
