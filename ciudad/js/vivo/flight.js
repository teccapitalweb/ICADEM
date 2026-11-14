// Ciudad ICADEM 2.0 · vuelo controlado en el Gran dragón de viaje (módulo puro, cliente y servidor).
//
// Primera etapa de monturas: un vuelo PANORÁMICO por una ruta fija que despega y aterriza en el
// mismo Helipuerto de dragones. No hay vuelo libre: así no se atraviesan edificios, no se sale del
// mapa y no sirve de atajo para misiones ni minijuegos. El servidor comprueba en cada estado que
// el jugador va sobre la ruta en el momento que corresponde.
export const MOUNT_BREED = 'dragon-grande';

export const FLIGHTS = Object.freeze({
  plaza: Object.freeze({ id: 'plaza', scene: 'plaza', title: 'Vuelo panorámico sobre la plaza', pad: Object.freeze({ x: -20, z: 0, r: 3 }), seconds: 26, cruise: 16, radius: 20, bulge: 6 })
});
export const FLIGHT_TOLERANCE = 7;      // metros de diferencia aceptados entre la ruta y la posición recibida
export const FLIGHT_COOLDOWN_MS = 8000; // pausa entre vuelos

const smooth = k => { const x = Math.max(0, Math.min(1, k)); return x * x * (3 - 2 * x); };

/** Punto de la ruta en la fracción k (0 → despegue, 1 → aterrizaje). */
export function flightPoint(id, k) {
  const f = FLIGHTS[id]; if (!f) return null;
  const t = Math.max(0, Math.min(1, k)), a = Math.PI + t * Math.PI * 2, r = f.radius + f.bulge * Math.sin(Math.PI * t);
  const lift = Math.min(smooth(t / 0.18), smooth((1 - t) / 0.18));
  const y = lift * (f.cruise + Math.sin(t * Math.PI * 4) * 1.2);
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };   // empieza y termina en el helipuerto (−radio, 0)
}
/** Hacia dónde mira el dragón en la fracción k (dirección del avance). */
export function flightYaw(id, k) {
  const a = flightPoint(id, Math.max(0, k - 0.004)), b = flightPoint(id, Math.min(1, k + 0.004));
  return Math.atan2(b.x - a.x, b.z - a.z);
}
