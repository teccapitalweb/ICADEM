// Ciudad ICADEM · tabla única de lugares jugables: qué edificio de la plaza lleva a qué escenario,
// con qué título se anuncia y dónde reaparece el jugador al salir. Antes estaba repetida en la plaza,
// en main.js (fundido y reunión de equipo) y en las pruebas; aquí vive una sola vez.
//
//   scene    nombre del escenario (el mismo que usa la red: NET_SCENES / SCENE_RULES)
//   building id del edificio en BUILDINGS (su puerta en la plaza)
//   spawn    clave del punto de llegada en la plaza al salir del edificio
//   arrival  punto de llegada propio cuando el de la puerta no sirve (toldo, vegetación); si no hay,
//            se usa el frente de la puerta a 7.4 m. Debe coincidir con SCENE_RULES.plaza.entries.
//   yaw      hacia dónde mira el jugador al llegar (por defecto, de espaldas a la puerta).
export const PLACES = Object.freeze([
  { scene: 'bank', building: 'banco', title: 'Banco ICADEM', spawn: 'bank' },
  { scene: 'court', building: 'tribunal', title: 'Tribunal ICADEM', spawn: 'court' },
  { scene: 'market', building: 'supermercado', title: 'Supermercado', spawn: 'market', arrival: { x: 31, z: 13.6 } },
  { scene: 'site', building: 'obra', title: 'Obra en construcción', spawn: 'obra', arrival: { x: 22.1, z: -3.6 }, yaw: Math.PI / 2 },
  { scene: 'hospital', building: 'hospital', title: 'Hospital ICADEM', spawn: 'hospital' },
  { scene: 'vet', building: 'veterinaria', title: 'Clínica Veterinaria', spawn: 'vet' },
  { scene: 'restaurant', building: 'restaurante', title: 'Restaurante', spawn: 'restaurant' },
  { scene: 'greenhouse', building: 'invernadero', title: 'Invernadero', spawn: 'greenhouse' },
  { scene: 'office', building: 'oficina', title: 'Oficina ICADEM', spawn: 'office' },
  { scene: 'tower', building: 'torre', title: 'Torre ICADEM', spawn: 'tower' }
]);

export const placeByScene = scene => PLACES.find(p => p.scene === scene) || null;
export const placeByBuilding = id => PLACES.find(p => p.building === id) || null;

/** Títulos de todos los escenarios (incluye los que no son edificios). */
export const SCENE_TITLES = Object.freeze({ room: 'Tu habitación', plaza: 'Ciudad ICADEM', park: 'Parque de retos', ...Object.fromEntries(PLACES.map(p => [p.scene, p.title])) });
