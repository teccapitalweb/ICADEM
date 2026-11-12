// Ciudad ICADEM · perfiles infantiles supervisados (reglas compartidas; módulo puro).
//
// ESTADO: implementado y APAGADO. Solo se activa con CIUDAD_FAMILY=on en el servidor, después de
// la revisión de privacidad y consentimiento (aviso de privacidad para menores y consentimiento de
// madre, padre o tutor, conforme a la LFPDPPP). Mientras esté apagado, el servidor rechaza crear
// perfiles infantiles y entrar con ellos, y el juego solo informa que está en preparación.
//
// Lo que se guarda de un perfil infantil es lo mínimo: un alias, un avatar, un rango de edad y la
// fecha del consentimiento. Nunca nombre real, correo, escuela ni ubicación.

export const FAMILY_MAX = 4;
export const AGE_BANDS = Object.freeze([['6-8', '6 a 8 años'], ['9-12', '9 a 12 años'], ['13-17', '13 a 17 años']]);
/** Misiones profesionales adecuadas para perfiles infantiles (además de minijuegos y retos). */
export const KID_MISSIONS = Object.freeze(['super-rescate-inventario', 'vet-guardianes-bienestar', 'invernadero-cultivo-inteligente', 'restaurante-cocina-contra-reloj']);
export const KID_SCENES = Object.freeze(['room', 'plaza', 'park', 'market', 'vet', 'greenhouse', 'restaurant']);

/** Alias visible: 2–16 letras, números o espacios; sin correos, teléfonos ni enlaces. */
export function cleanAlias(alias) {
  const a = String(alias || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (a.length < 2 || a.length > 16) return null;
  if (!/^[\p{L}\p{N} ]+$/u.test(a)) return null;
  if (/\d{5,}/.test(a.replace(/\s/g, ''))) return null;   // parece un teléfono o un número de cuenta
  return a;
}
export const kidKey = (uid, id) => `${uid}~${id}`;
