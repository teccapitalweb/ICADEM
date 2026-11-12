// Ciudad ICADEM · reglas de la modalidad en equipo (módulo puro, lo usan el servidor y el cliente).
// El servidor es la autoridad: guarda el intento del equipo, valida cada acción con el mismo
// motor de misiones y con estos permisos por rol. El cliente las usa solo para avisar antes.
import { COOP_MISSIONS } from './scenes.js';

/** Roles que pueden hacer la acción: '*' (cualquiera), una lista o null (no procede en equipo). */
export function allowedRoles(spec, type, payload = {}) {
  const rule = spec && spec.permissions ? spec.permissions[type] : undefined;
  if (rule === '*') return '*';
  if (Array.isArray(rule)) return rule;
  if (rule && typeof rule === 'object' && rule.key) return rule.map[String(payload && payload[rule.key])] || null;
  return null;
}

/**
 * ¿Puede este rol hacer la acción? `onlineRoles`: roles de los integrantes conectados.
 * Si nadie conectado tiene el rol al que le toca, cualquiera del equipo puede cubrirlo.
 */
export function coopCan(spec, type, payload, role, onlineRoles = []) {
  const roles = allowedRoles(spec, type, payload);
  if (!roles) return false;
  if (roles === '*' || roles.includes(role)) return true;
  return !roles.some(r => onlineRoles.includes(r));
}

/** ¿Falta que alguien apruebe antes del paso final? Devuelve los roles pendientes. */
export function pendingApprovals(spec, state, onlineRoles = []) {
  if (!spec || !spec.consensus) return [];
  const approved = (state && state.approvals) || [];
  return onlineRoles.filter(r => !approved.includes(r));
}

export const roleName = (missionId, role) => ((COOP_MISSIONS[missionId] || { roles: [] }).roles.find(r => r.id === role) || {}).name || role;
export { COOP_MISSIONS };
