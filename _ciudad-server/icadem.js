// Ciudad ICADEM · adaptador de SOLO LECTURA sobre los datos de ICADEM (Firestore) y, opcionalmente,
// guardado del progreso del juego en su propia colección.
//
// Reutiliza lo que ya existe sin tocar el backend ni el Directorio Profesional:
//   · identidad:  los mismos tokens de sesión (Firebase Auth), verificados con firebase-admin,
//                 igual que lo hace icadem-webhook.
//   · acceso:     la membresía activa se lee de `miembros/{uid}` con las mismas reglas que
//                 `membresiaActiva()` del backend (copiadas aquí para no depender de su código).
//   · conexiones: `professionalConnections` (documentos con `participants` y `status`),
//                 solo las aceptadas. El Directorio se consulta, nunca se modifica.
//   · nombre:     `directorio/{uid}` (nombre personalizado o nombre) y, si no hay, el del token.
//   · progreso:   colección propia `ciudadProfiles/{uid}` (solo si CIUDAD_PROFILES=firestore).
//
// Este módulo nunca lee ni escribe `credits`, Stripe, notificaciones, foro ni perfiles.
import { cleanCustom } from '../ciudad/js/progress/rules.js';

const CONNECTIONS = 'professionalConnections', MEMBERS = 'miembros', DIRECTORY = 'directorio', PROFILES = 'ciudadProfiles';
const toDate = v => (v && typeof v.toDate === 'function') ? v.toDate() : v ? new Date(v) : null;
const later = (a, b) => { const da = toDate(a), db = toDate(b); if (da && isNaN(da)) return db && !isNaN(db) ? db : null; if (db && isNaN(db)) return da; return !da ? db : !db ? da : (db > da ? db : da); };

/** Fin de vigencia de una membresía: misma lógica que `fechaVigenciaMembresia` del backend. */
export function membershipEnd(m = {}) {
  if (m.cancelacionProgramada === true) return later(m.fechaFinAcceso || m.fechaProximaRenovacion || m.expiraEn, m.adminAccessUntil);
  if (m.stripeSubscriptionId) return later(m.fechaProximaRenovacion || m.expiraEn, m.adminAccessUntil);
  return later(m.expiraEn || m.fechaFinAcceso || m.fechaProximaRenovacion, m.adminAccessUntil);
}

/** ¿La membresía está activa? Misma regla que `membresiaActiva` del backend. */
export function membershipActive(m = {}, now = Date.now()) {
  const marked = m.activa === true || m.activo === true, end = membershipEnd(m);
  return marked && (!end || isNaN(end) || end.getTime() > now);
}

const cleanName = name => String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 28);

/**
 * Servicios de ICADEM para el servidor del juego. `db` es un Firestore (real o de prueba) y
 * `auth` un Auth de firebase-admin (o cualquier objeto con `verifyIdToken`).
 */
export function createIcademServices({ db, auth, admins = [], now = Date.now }) {
  const adminSet = new Set(admins.map(e => String(e).toLowerCase()));

  async function identity(token) {
    let decoded; try { decoded = await auth.verifyIdToken(String(token || '')); } catch (_) { return null; }
    if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) return null;
    let name = '';
    try { const d = await db.collection(DIRECTORY).doc(decoded.uid).get(); const data = d.exists ? d.data() || {} : {}; name = cleanName(data.nombrePersonalizado || data.nombre); } catch (_) {}
    return { uid: decoded.uid, name: name || cleanName(decoded.name) || 'Miembro', email: String(decoded.email || '').toLowerCase() };
  }

  /** Puede entrar quien tiene membresía activa (o es administrador del panel). */
  async function authorize(who) {
    if (who.email && adminSet.has(who.email)) return true;
    const snap = await db.collection(MEMBERS).doc(who.uid).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    return membershipActive(data, now()) || adminSet.has(String(data.email || '').toLowerCase());
  }

  /** Conexiones aceptadas del Directorio: solo los identificadores de la otra persona. */
  async function connections(uid) {
    const snap = await db.collection(CONNECTIONS).where('participants', 'array-contains', uid).get();
    const out = [];
    for (const doc of snap.docs) {
      const rel = doc.data() || {};
      if (rel.status !== 'accepted' || !Array.isArray(rel.participants)) continue;
      const other = rel.participants.find(p => p !== uid);
      if (typeof other === 'string' && other) out.push(other);
    }
    return out;
  }

  /** Progreso del juego en su propia colección. Nunca toca `credits`. */
  const storage = {
    async load(uid) { const snap = await db.collection(PROFILES).doc(uid).get(); if (!snap.exists) return null; const p = snap.data() || {}; return { ...p, custom: cleanCustom(p.custom) }; },
    async save(uid, profile) { await db.collection(PROFILES).doc(uid).set({ ...profile, custom: cleanCustom(profile.custom), updatedAt: now() }); }
  };

  return { identity, authorize, connections, storage };
}

/** Arranque con firebase-admin a partir del JSON de la cuenta de servicio (la misma del backend). */
export async function connectFirebase(serviceAccountJson, { storageBucket } = {}) {
  const [{ initializeApp, cert, getApps }, { getFirestore }, { getAuth }] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/firestore'), import('firebase-admin/auth')]);
  const credential = cert(JSON.parse(serviceAccountJson));
  const app = getApps().length ? getApps()[0] : initializeApp({ credential, ...(storageBucket ? { storageBucket } : {}) });
  return { db: getFirestore(app), auth: getAuth(app), projectId: JSON.parse(serviceAccountJson).project_id };
}
