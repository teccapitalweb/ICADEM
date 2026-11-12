// Reglas de los escenarios en red, compartidas por el cliente y el servidor (módulo puro).
//   bounds:  zona caminable (con un pequeño margen)
//   entries: puntos por los que se puede llegar desde otro escenario (null = cualquiera)
//   links:   escenarios a los que se puede pasar directamente
//   privacy: 'private' nadie más te ve · 'party' solo tu sala de espera · 'public' tu instancia
export const SCENE_RULES = Object.freeze({
  room: { bounds: { minX: -5, maxX: 5, minZ: -4.6, maxZ: 4.6 }, entries: null, links: ['plaza'], privacy: 'private' },
  plaza: { bounds: { minX: -47, maxX: 47, minZ: -47, maxZ: 47 }, entries: [[0, 9.5], [-13, 17.8], [-13, -15.6], [13, -15.6], [31, 13.6], [22.1, -3.6], [-31, -15.6], [-31, 16.1], [13, 16.1]], links: ['room', 'bank', 'court', 'market', 'site', 'hospital', 'vet', 'restaurant'], privacy: 'public' },
  bank: { bounds: { minX: -9.6, maxX: 9.6, minZ: -7.6, maxZ: 7.6 }, entries: [[0, 3.9]], links: ['plaza'], privacy: 'public' },
  court: { bounds: { minX: -10.6, maxX: 10.6, minZ: -8.6, maxZ: 8.6 }, entries: [[0, 5.6]], links: ['plaza'], privacy: 'party' },
  market: { bounds: { minX: -9.6, maxX: 9.6, minZ: -7.6, maxZ: 7.6 }, entries: [[0, 3.9]], links: ['plaza'], privacy: 'public' },
  site: { bounds: { minX: -12.6, maxX: 12.6, minZ: -9.6, maxZ: 9.6 }, entries: [[0, 8.4]], links: ['plaza'], privacy: 'public' },
  hospital: { bounds: { minX: -9.6, maxX: 9.6, minZ: -7.6, maxZ: 7.6 }, entries: [[0, 5.9]], links: ['plaza'], privacy: 'public' },
  vet: { bounds: { minX: -8.6, maxX: 8.6, minZ: -6.6, maxZ: 6.6 }, entries: [[0, 5.4]], links: ['plaza'], privacy: 'public' },
  restaurant: { bounds: { minX: -8.6, maxX: 8.6, minZ: -6.6, maxZ: 6.6 }, entries: [[-3, 5.4]], links: ['plaza'], privacy: 'public' }
});
export const ENTRY_RADIUS = 4;

/** Misiones con modalidad cooperativa y sus roles. La audiencia cooperativa aún no está activa. */
export const COOP_MISSIONS = Object.freeze({
  'tribunal-tu-eres-el-juez': { title: 'Tú eres el juez', scene: 'court', min: 2, max: 4, playable: false,
    roles: [{ id: 'juez', name: 'Juez', required: true }, { id: 'abogadoA', name: 'Abogado A' }, { id: 'abogadoB', name: 'Abogado B' }, { id: 'testigo', name: 'Testigo' }] }
});
