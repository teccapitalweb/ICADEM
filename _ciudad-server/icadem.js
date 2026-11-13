// Ciudad ICADEM · adaptador de SOLO LECTURA sobre los datos de ICADEM (Firestore) y, opcionalmente,
// guardado del progreso del juego en su propia colección.
//
// Reutiliza lo que ya existe sin tocar el backend ni el Directorio Profesional:
//   · identidad:  los mismos tokens de sesión (Firebase Auth), verificados con firebase-admin,
//                 igual que lo hace icadem-webhook.
//   · acceso:     pueden jugar las cuentas registradas, gratuitas y VIP. Se rechazan las cuentas
//                 deshabilitadas o con la sesión revocada (Firebase Auth) y las que están en proceso de
//                 borrado (`_accountDeletions`, misma regla que el backend, pero sin escribir nada).
//                 La membresía (`miembros/{uid}`, reglas de `membresiaActiva()`) solo se lee para saber
//                 si es VIP; hoy no cambia nada dentro del juego.
//   · conexiones: `professionalConnections` (documentos con `participants` y `status`),
//                 solo las aceptadas. El Directorio se consulta, nunca se modifica.
//   · nombre:     `directorio/{uid}` (nombre personalizado o nombre) y, si no hay, el del token.
//   · progreso:   colección propia `ciudadProfiles/{uid}` (solo si CIUDAD_PROFILES=firestore).
//   · reportes:   colección propia `ciudadReports` (solo si CIUDAD_REPORTS=firestore), para que
//                 moderación los conserve aunque el servicio se reinicie.
//
// Este módulo nunca lee ni escribe `credits`, Stripe, notificaciones, foro ni perfiles.
import { cleanCustom } from '../ciudad/js/progress/rules.js';

const CONNECTIONS = 'professionalConnections', MEMBERS = 'miembros', DIRECTORY = 'directorio', PROFILES = 'ciudadProfiles', DELETIONS = '_accountDeletions', REPORTS = 'ciudadReports';
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
export const ACCESS_MODES = Object.freeze(['open', 'pilot', 'closed']);

export function createIcademServices({ db, auth, admins = [], pilot = [], blocked = [], access = 'pilot', now = Date.now }) {
  if (!ACCESS_MODES.includes(access)) throw new Error('modo de acceso desconocido: ' + access);
  const adminSet = new Set(admins.map(e => String(e).toLowerCase()));
  // open: todas las cuentas registradas · pilot: solo la lista (vacía = abierto) · closed: solo administradores.
  const pilotSet = new Set(access === 'pilot' ? pilot.map(e => String(e).toLowerCase()) : []);
  const blockedSet = new Set(blocked.map(String));

  async function identity(token) {
    // checkRevoked: además de la firma, Firebase confirma que la cuenta no está deshabilitada ni con la sesión revocada.
    let decoded; try { decoded = await auth.verifyIdToken(String(token || ''), true); } catch (_) { return null; }
    if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) return null;
    let name = '';
    try { const d = await db.collection(DIRECTORY).doc(decoded.uid).get(); const data = d.exists ? d.data() || {} : {}; name = cleanName(data.nombrePersonalizado || data.nombre); } catch (_) {}
    // Sin nombre en el Directorio (cuentas gratuitas): solo nombre y primer apellido de la cuenta.
    const fromToken = cleanName(String(decoded.name || '').split(/\s+/).slice(0, 2).join(' '));
    return { uid: decoded.uid, name: name || fromToken || 'Jugador', email: String(decoded.email || '').toLowerCase() };
  }

  /** ¿La cuenta está en proceso de borrado? Lectura de la misma barrera que usa el backend; nunca la modifica. */
  async function beingDeleted(uid) {
    let snap; try { snap = await db.collection(DELETIONS).doc(uid).get(); } catch (_) { return false; }   // sin Firestore manda checkRevoked
    if (!snap.exists) return false;
    const data = snap.data() || {}, started = toDate(data.requestedAt) || toDate(data.updatedAt);
    let created = null; try { created = new Date((await auth.getUser(uid)).metadata.creationTime); } catch (_) { return true; }
    // Una cuenta creada DESPUÉS de iniciar el borrado es nueva (misma regla del backend).
    return !(created && started && !isNaN(created) && created.getTime() > started.getTime());
  }

  async function isVip(who) {
    try { const snap = await db.collection(MEMBERS).doc(who.uid).get(); return snap.exists && membershipActive(snap.data() || {}, now()); } catch (_) { return false; }
  }

  /**
   * ¿Puede entrar? Cuentas registradas gratuitas y VIP. No: bloqueadas por moderación del juego,
   * en proceso de borrado, fuera de la lista en modo piloto o, con el multijugador cerrado
   * (CIUDAD_ACCESS=closed), cualquiera que no sea administrador. Las deshabilitadas o con la sesión
   * revocada ya no pasan de `identity` (checkRevoked).
   */
  async function authorize(who) {
    const admin = Boolean(who.email) && adminSet.has(who.email);
    if (blockedSet.has(who.uid)) return false;
    if (access === 'closed' && !admin) return false;
    if (pilotSet.size && !admin && !pilotSet.has(who.email)) return false;
    if (await beingDeleted(who.uid)) return false;
    who.vip = admin || await isVip(who);
    return true;
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

  /**
   * Progreso del juego en su propia colección. Nunca toca `credits`.
   * Cada guardado verifica en una transacción que nadie más escribió entre la lectura y la escritura
   * (p. ej. dos servidores durante un redespliegue). Si alguien lo hizo, se repite la operación.
   */
  const storage = {
    async load(uid) { const snap = await db.collection(PROFILES).doc(uid).get(); if (!snap.exists) return null; const p = snap.data() || {}; return { ...p, custom: cleanCustom(p.custom) }; },
    async save(uid, profile) {
      const ref = db.collection(PROFILES).doc(uid), data = { ...profile, uid, custom: cleanCustom(profile.custom), updatedAt: now() };
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref), stored = snap.exists ? Number((snap.data() || {}).rev) || 0 : 0;
        if (stored !== profile.rev - 1) throw Object.assign(new Error('el progreso cambió en otro lugar'), { code: 'conflict' });
        tx.set(ref, data);
      });
    }
  };

  /**
   * Reporte de moderación en su propia colección (solo si CIUDAD_REPORTS=firestore). Guarda los uid
   * reales (además de los identificadores públicos) para poder actuar con CIUDAD_BLOCKED_UIDS;
   * nunca guarda correos, nombres ni el contenido de otras colecciones.
   */
  async function saveReport(entry) {
    const e = entry || {};
    await db.collection(REPORTS).add({
      at: Number(e.at) || now(),
      fromUid: String(e.fromUid || ''), targetUid: String(e.targetUid || ''),
      fromPid: String(e.fromPid || ''), targetPid: String(e.targetPid || ''),
      reason: String(e.reason || '').slice(0, 80), instance: String(e.instance || ''),
      savedAt: now()
    });
  }

  return { identity, authorize, connections, storage, saveReport };
}

/** Arranque con firebase-admin a partir del JSON de la cuenta de servicio (la misma del backend). */
export async function connectFirebase(serviceAccountJson) {
  const [{ initializeApp, cert, getApps }, { getFirestore }, { getAuth }] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/firestore'), import('firebase-admin/auth')]);
  const credential = cert(JSON.parse(serviceAccountJson));
  const app = getApps().length ? getApps()[0] : initializeApp({ credential });
  return { db: getFirestore(app), auth: getAuth(app), projectId: JSON.parse(serviceAccountJson).project_id };
}
