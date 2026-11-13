// Chat libre de Ciudad ICADEM · reglas puras (las usan el cliente, para avisar antes de enviar,
// y el servidor, que es quien las hace cumplir). Sin dependencias del navegador ni de Node.
//
// Qué hace:
//   · normaliza el texto (sin caracteres de control, espacios repetidos, gritos ni letras estiradas);
//   · rechaza enlaces, correos, teléfonos y la invitación a seguir la plática en otra app
//     (privacidad: nadie debe compartir datos de contacto con desconocidos);
//   · rechaza insultos, contenido sexual, odio y amenazas, incluso escritos con trucos
//     (acentos, números en lugar de letras, letras separadas o pegadas);
//   · tapa groserías leves con •••;
//   · limita la longitud.
// Las sanciones (avisos, restricciones temporales) y el ritmo los lleva el servidor.

export const CHAT_MAX = 140;            // caracteres por mensaje
export const CHAT_HISTORY = 40;         // mensajes que conserva el cliente durante la sesión
export const CHAT_BUBBLE_SECONDS = 6;   // la burbuja de un mensaje libre dura un poco más que una frase rápida

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't' };

/** Palabra → forma comparable: minúsculas, sin acentos, sin números disfrazados y sin letras repetidas. */
export function fold(word) {
  return String(word).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[0134578@$!|+]/g, c => LEET[c]).replace(/ñ/g, 'n').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}

// Se rechazan (y cuentan como aviso). Comparación por palabra completa ya "doblada".
const BLOCK_WORDS = ['puto', 'puta', 'putos', 'putas', 'putita', 'putito', 'putazo', 'pendejo', 'pendeja', 'pendejos', 'pendejas', 'pendejada',
  'cabron', 'cabrona', 'cabrones', 'culero', 'culera', 'culeros', 'verga', 'vergas', 'vergazo', 'chingada', 'chingado', 'chingas', 'chinga', 'chingar',
  'chingate', 'chingues', 'chingon', 'joto', 'jotos', 'maricon', 'maricones', 'marica', 'zorra', 'golfa', 'malparido', 'malparida', 'hijueputa',
  'hdp', 'ptm', 'mamada', 'mamadas', 'idiota', 'idiotas', 'imbecil', 'imbeciles', 'estupido', 'estupida', 'retrasado', 'retrasada', 'subnormal',
  'porno', 'porn', 'xxx', 'nudes', 'coger', 'cogida', 'panocha', 'nalgas', 'tetas', 'chichis',
  'matate', 'muerete', 'nazi', 'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'cunt', 'whore', 'dick', 'pussy', 'niga', 'fag', 'slut', 'kys'].map(fold);
// Raíces inequívocas: se buscan también dentro de palabras pegadas ("eresunpendejo").
const BLOCK_STEMS = ['pendej', 'chingad', 'chingatu', 'hijueput', 'hijodeput', 'putamadre', 'culer', 'maricon', 'fuck'].map(fold);
// Frases (sobre el texto completo ya doblado y sin espacios).
const BLOCK_PHRASES = ['tevoyamatar', 'teamatar', 'tevoyaencontrar', 'sedondevives', 'pasaelpack', 'pasapack', 'mandafotos', 'mandamefotos'].map(fold);
// Groserías leves: no se rechazan, se tapan.
const MASK_WORDS = ['mierda', 'carajo', 'pinche', 'pinches', 'joder', 'jodido', 'jodida', 'alv', 'mames', 'wey', 'guey', 'buey', 'damn', 'crap'].map(fold);
// En la práctica `wey` es coloquial; se tapa solo si va acompañada de otra grosería. (Ver maskLevel.)
const SOFT_MASK = new Set(['wey', 'guey', 'buey'].map(fold));

const LINK = /(https?:|ftp:|www\.|\b[a-z0-9-]{2,}\.(?:com|net|org|mx|io|co|app|xyz|info|biz|me|ly|gg|tv|ru|cn|link|site|online|store|shop|top|club|live|lat|es|us|ai|dev)\b|(?:\(dot\)|\[dot\]|\bpunto)\s*(?:com|net|org|mx)\b)/i;
const EMAIL = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sarroba\s)\s*[a-z0-9.-]+\s*\.\s*[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\s().-]*){10,}/;
const CONTACT_APPS = /\b(whats?app|wsp|wpp|telegram|discord|snapchat|onlyfans|instagram|tiktok|facebook|messenger)\b/i;

/** Limpieza sin juicio: control, espacios, letras estiradas y mayúsculas sostenidas. */
export function normalizeText(raw) {
  let t = String(raw ?? '').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/(.)\1{3,}/gu, '$1$1$1');   // «holaaaaaa» → «holaaa»
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
  if (letters.length > 10 && letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length / letters.length > 0.7) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}

const tokens = text => text.split(/[^\p{L}\p{N}@$!|+]+/u).filter(Boolean);

/** Palabras formadas por letras sueltas («p u t o» → «puto»). */
function joinedSingles(list) {
  const out = []; let run = '';
  for (const w of list) { if (w.length === 1) run += w; else { if (run.length > 2) out.push(run); run = ''; } }
  if (run.length > 2) out.push(run);
  return out;
}

/**
 * Revisa un mensaje. Devuelve:
 *   { ok: true, text, key }            → se puede enviar (text ya limpio; key sirve para detectar repeticiones)
 *   { ok: false, reason, strike }      → se rechaza; strike=true si cuenta como falta a las normas
 */
export function checkMessage(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'formato', strike: false };
  if (raw.length > CHAT_MAX * 4) return { ok: false, reason: 'muy-largo', strike: false };
  const text = normalizeText(raw);
  if (!text) return { ok: false, reason: 'vacio', strike: false };
  if (text.length > CHAT_MAX) return { ok: false, reason: 'muy-largo', strike: false };
  if (LINK.test(text) || EMAIL.test(text)) return { ok: false, reason: 'enlace', strike: true };
  if (PHONE.test(text) || CONTACT_APPS.test(text)) return { ok: false, reason: 'contacto', strike: true };
  const list = tokens(text), folded = list.map(fold), all = folded.concat(joinedSingles(list).map(fold)), flat = fold(text);
  if (all.some(w => BLOCK_WORDS.includes(w)) || BLOCK_STEMS.some(s => flat.includes(s)) || BLOCK_PHRASES.some(p => flat.includes(p))) return { ok: false, reason: 'lenguaje', strike: true };
  // Una misma palabra repetida muchas veces es relleno.
  const counts = new Map(); for (const w of folded) if (w) counts.set(w, (counts.get(w) || 0) + 1);
  if ([...counts.values()].some(n => n >= 5)) return { ok: false, reason: 'spam', strike: false };
  const hard = folded.some(w => MASK_WORDS.includes(w) && !SOFT_MASK.has(w));
  const clean = text.replace(/[\p{L}\p{N}@$!|+]+/gu, w => { const f = fold(w); return MASK_WORDS.includes(f) && (!SOFT_MASK.has(f) || hard) ? '•••' : w; });
  return { ok: true, text: clean, key: flat };
}

/** Texto para el usuario cuando el servidor (o el cliente) rechaza un mensaje. */
export const CHAT_REASONS = Object.freeze({
  'vacio': 'Escribe algo antes de enviar.',
  'muy-largo': `Máximo ${CHAT_MAX} caracteres por mensaje.`,
  'formato': 'No se pudo enviar el mensaje.',
  'enlace': 'Por seguridad no se permiten enlaces ni correos en el chat.',
  'contacto': 'Por privacidad no se comparten teléfonos ni otras apps en el chat.',
  'lenguaje': 'Ese mensaje no cumple las normas del chat. Mantén un trato respetuoso.',
  'spam': 'Evita repetir la misma palabra muchas veces.',
  'repetido': 'Ya enviaste ese mensaje. Espera un poco antes de repetirlo.',
  'demasiado-rapido': 'Vas muy rápido. Espera unos segundos.',
  'restringido': 'Tu chat está pausado temporalmente por incumplir las normas.',
  'activa-chat': 'Activa el chat para escribir mensajes.',
  'no-permitido': 'El chat libre no está disponible para este perfil.',
  'sin-audiencia': 'Aquí no hay nadie más. Sal a la ciudad para conversar.',
  'chat-desactivado': 'El chat libre está desactivado por ahora. Puedes usar las frases rápidas.'
});

/** Normas que la persona acepta (una vez, queda guardado en su cuenta). */
export const CHAT_RULES = Object.freeze([
  'Trato respetuoso: sin insultos, acoso, odio ni contenido sexual.',
  'Sin enlaces, correos, teléfonos ni invitaciones a otras apps.',
  'No compartas datos personales ni pidas los de otras personas.',
  'Puedes silenciar, bloquear o reportar a quien no respete las normas.'
]);
