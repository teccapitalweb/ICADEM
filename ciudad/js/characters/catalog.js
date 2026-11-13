// Catálogo de personajes de Ciudad ICADEM.
// Todos comparten esqueleto y animaciones (characters/avatar.js); cambian apariencia y accesorios.
// Categorías: `inicial` (gratuitos, para elegir al entrar), `profesion` (los diez originales) y
// `especial` (skins que se desbloquean jugando). Las reglas viven en progress/rules.js y las comprueba
// el servidor. Ninguno da ventaja ni se compra.

export const AVATARS = Object.freeze([
  { id: 'explorador', name: 'Explorador', route: 'Exploración', category: 'inicial', available: true, price: 0,
    look: { skin: 0xf2c29b, hair: 0x4a2f22, hairStyle: 'short', top: 0x2f9e8f, topAccent: 0xffffff, bottom: 0x3b4a6b, shoes: 0xf7f3ea, accessories: ['explorerHat', 'backpack', 'scarf'] } },
  { id: 'ejecutivo', name: 'Ejecutivo', route: 'Administración', category: 'profesion', available: true,
    look: { skin: 0xe9b58c, hair: 0x2b2118, hairStyle: 'side', top: 0x22345c, topAccent: 0xd9a441, bottom: 0x1b2540, shoes: 0x2a1d14, accessories: ['tie', 'lapels'] } },
  { id: 'cientifica', name: 'Científica', route: 'Ciencia', category: 'profesion', available: true,
    look: { skin: 0xc98e63, hair: 0x23180f, hairStyle: 'bun', top: 0xf6f8fb, topAccent: 0x33b6c9, bottom: 0x3a5a78, shoes: 0xffffff, accessories: ['glasses', 'badge'] } },
  { id: 'ingeniero', name: 'Ingeniero', route: 'Ingeniería', category: 'profesion', available: true,
    look: { skin: 0xd9a37a, hair: 0x3a2a1c, hairStyle: 'none', top: 0xf08a24, topAccent: 0xffd23f, bottom: 0x384455, shoes: 0x5a3d22, accessories: ['hardhat', 'badge'] } },
  { id: 'medico', name: 'Médico', route: 'Salud', category: 'profesion', available: true,
    look: { skin: 0xf0c7a4, hair: 0x5a3b22, hairStyle: 'short', top: 0xffffff, topAccent: 0x2bb5a0, bottom: 0x2bb5a0, shoes: 0xffffff, accessories: ['badge', 'stethoscope'] } },
  { id: 'agronomo', name: 'Agrónomo', route: 'Agronomía', category: 'profesion', available: true,
    look: { skin: 0xb9794d, hair: 0x1f150d, hairStyle: 'short', top: 0x6fae45, topAccent: 0xf3e2a9, bottom: 0x6b4a2b, shoes: 0x4c3520, accessories: ['explorerHat'] } },
  { id: 'chef', name: 'Chef', route: 'Gastronomía', category: 'profesion', available: true,
    look: { skin: 0xf2c29b, hair: 0x2c1d12, hairStyle: 'side', top: 0xffffff, topAccent: 0xe8483f, bottom: 0x2d2f3a, shoes: 0x1d1d22, accessories: ['apron', 'toque'] } },
  { id: 'veterinario', name: 'Veterinario', route: 'Veterinaria', category: 'profesion', available: true,
    look: { skin: 0xe0ab85, hair: 0x6a4424, hairStyle: 'long', top: 0x4fb8a8, topAccent: 0xffffff, bottom: 0x3d8f84, shoes: 0xffffff, accessories: ['badge', 'stethoscope'] } },
  { id: 'juez', name: 'Juez', route: 'Justicia', category: 'profesion', available: true,
    look: { skin: 0xd6a57e, hair: 0xc9ccd3, hairStyle: 'side', top: 0x1d2230, topAccent: 0xf4f1e8, bottom: 0x1d2230, shoes: 0x14161c, accessories: ['robe', 'glasses'] } },
  { id: 'embajador', name: 'Embajador ICADEM', route: 'Comunidad', category: 'profesion', available: true,
    look: { skin: 0xc98e63, hair: 0x231a12, hairStyle: 'short', top: 0x1e63c4, topAccent: 0xf2b93b, bottom: 0x123c8a, shoes: 0xffffff, accessories: ['scarf', 'badge'] } },

  /* ---- iniciales gratuitos: se eligen al entrar por primera vez ---- */
  { id: 'exploradora', name: 'Exploradora', route: 'Exploración', category: 'inicial', available: true,
    look: { skin: 0xd9a37a, hair: 0x5a3519, hairStyle: 'long', top: 0xe86a5c, topAccent: 0xfff1d6, bottom: 0x2f4a6b, shoes: 0xf7f3ea, accessories: ['explorerHat', 'backpack', 'scarf'] } },
  { id: 'estudiante', name: 'Estudiante', route: 'Aprendizaje', category: 'inicial', available: true,
    look: { skin: 0xc98e63, hair: 0x1f150d, hairStyle: 'short', top: 0x3a8fd6, topAccent: 0xffffff, bottom: 0x2a3a5c, shoes: 0xffffff, accessories: ['cap', 'backpack'] } },
  { id: 'universitaria', name: 'Universitaria', route: 'Aprendizaje', category: 'inicial', available: true,
    look: { skin: 0xf0c7a4, hair: 0x2a1e14, hairStyle: 'bun', top: 0x8a5fd0, topAccent: 0xf2e6ff, bottom: 0x2d3557, shoes: 0xffffff, accessories: ['glasses', 'backpack'] } },
  { id: 'deportista', name: 'Deportista', route: 'Deporte', category: 'inicial', available: true,
    look: { skin: 0xb9794d, hair: 0x15100b, hairStyle: 'side', top: 0xf2b93b, topAccent: 0x1d2433, bottom: 0x1d2433, shoes: 0xff5a5f, accessories: ['headband'] } },
  { id: 'atleta', name: 'Atleta', route: 'Deporte', category: 'inicial', available: true,
    look: { skin: 0xe0ab85, hair: 0x7a4a26, hairStyle: 'long', top: 0x2f9e8f, topAccent: 0xffffff, bottom: 0x22345c, shoes: 0xffd166, accessories: ['headband'] } },
  { id: 'creativa', name: 'Creativa', route: 'Arte y diseño', category: 'inicial', available: true,
    look: { skin: 0x8d5a3b, hair: 0x15100b, hairStyle: 'bun', top: 0xf08aa8, topAccent: 0xffd166, bottom: 0x3b4a6b, shoes: 0xf7f3ea, accessories: ['scarf'] } },

  /* ---- skins especiales: se desbloquean jugando (requisitos en progress/rules.js) ---- */
  { id: 'astronauta', name: 'Astronauta ICADEM', route: 'Exploración espacial', category: 'especial', available: true,
    look: { skin: 0xe9b58c, hair: 0x2b2118, hairStyle: 'short', top: 0xf4f6fb, topAccent: 0x1e63c4, bottom: 0xe3e8f2, shoes: 0x8d93a1, accessories: ['spaceHelmet', 'badge'] } },
  { id: 'capitana', name: 'Capitana de equipo', route: 'Liderazgo', category: 'especial', available: true,
    look: { skin: 0xc98e63, hair: 0x1d140d, hairStyle: 'long', top: 0x3a43a8, topAccent: 0xffd166, bottom: 0x1d2433, shoes: 0x1d1d22, accessories: ['lapels', 'medal'] } },
  { id: 'guardian', name: 'Guardián de la ciudad', route: 'Las diez misiones', category: 'especial', available: true,
    look: { skin: 0xd6a57e, hair: 0x231a12, hairStyle: 'side', top: 0x1f7a55, topAccent: 0xffd166, bottom: 0x1b2540, shoes: 0x2a1d14, accessories: ['cape', 'badge'] } },
  { id: 'mente-brillante', name: 'Mente brillante', route: 'Retos de conocimiento', category: 'especial', available: true,
    look: { skin: 0xf0c7a4, hair: 0x6a4424, hairStyle: 'bun', top: 0x12325f, topAccent: 0xffd166, bottom: 0x1d2a40, shoes: 0x1d1d22, accessories: ['gradCap', 'glasses'] } },
  { id: 'campeon', name: 'Campeón del parque', route: 'Minijuegos', category: 'especial', available: true,
    look: { skin: 0xb9794d, hair: 0x15100b, hairStyle: 'none', top: 0xe8483f, topAccent: 0xffd166, bottom: 0x1d2433, shoes: 0xffffff, accessories: ['headband', 'medal'] } },
  { id: 'leyenda', name: 'Leyenda ICADEM', route: 'Nivel máximo', category: 'especial', available: true,
    look: { skin: 0xe9b58c, hair: 0x2c1d12, hairStyle: 'short', top: 0x22345c, topAccent: 0xffd166, bottom: 0x123c8a, shoes: 0xffd166, accessories: ['cape', 'laurel', 'medal'] } }
]);

export const AVATAR_CATEGORIES = Object.freeze([
  { id: 'inicial', name: 'Iniciales', text: 'Gratuitos para todos' },
  { id: 'profesion', name: 'Profesiones', text: 'Se desbloquean jugando' },
  { id: 'especial', name: 'Especiales', text: 'Skins de logros y retos' }
]);

export function avatarById(id) { return AVATARS.find(a => a.id === id) || AVATARS[0]; }

/** Apariencias de los personajes del escenario (no son jugadores ni se presentan como tales). */
export const NPC_LOOKS = Object.freeze({
  lucia: { skin: 0xd9a37a, hair: 0x3b2416, hairStyle: 'bun', top: 0xe86a5c, topAccent: 0xfff6e0, bottom: 0x4b5a7a, shoes: 0xf2e6d0, accessories: ['apron'] },
  bruno: { skin: 0xf0c7a4, hair: 0x2a1e14, hairStyle: 'side', top: 0xc23b36, topAccent: 0xffd166, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['tie', 'lapels', 'badge'] },
  renata: { skin: 0xc98e63, hair: 0x1d140d, hairStyle: 'long', top: 0x1f7a6c, topAccent: 0xffd166, bottom: 0x1d2a40, shoes: 0x1f1a17, accessories: ['lapels', 'badge', 'glasses'] },
  mateo: { skin: 0xe9b58c, hair: 0x6b4a2b, hairStyle: 'short', top: 0x3a5fc4, topAccent: 0xffd166, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['tie', 'badge'] },
  cajera: { skin: 0xf2c29b, hair: 0x7a4a26, hairStyle: 'bun', top: 0xf2b93b, topAccent: 0x123c8a, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['badge'] },
  guardia: { skin: 0xb9794d, hair: 0x15100b, hairStyle: 'none', top: 0x2b3a55, topAccent: 0x2b3a55, bottom: 0x1c2638, shoes: 0x111418, accessories: ['cap', 'badge'] },
  vecina: { skin: 0xe0ab85, hair: 0x8a5a2c, hairStyle: 'long', top: 0xb56bd6, topAccent: 0xffffff, bottom: 0x4a4f7a, shoes: 0xffffff, accessories: [] },
  vecino: { skin: 0xc98e63, hair: 0x241810, hairStyle: 'short', top: 0xf08a24, topAccent: 0xffffff, bottom: 0x2f4a3c, shoes: 0xf2f2f2, accessories: ['glasses'] },
  secretaria: { skin: 0xe0ab85, hair: 0x2a1e14, hairStyle: 'bun', top: 0x12325f, topAccent: 0xffd166, bottom: 0x1d2a40, shoes: 0x1f1a17, accessories: ['lapels', 'badge', 'glasses'] },
  mena: { skin: 0xc98e63, hair: 0x1d140d, hairStyle: 'long', top: 0x8f2630, topAccent: 0xffffff, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['lapels'] },
  marta: { skin: 0xf0c7a4, hair: 0x6b4a2b, hairStyle: 'bun', top: 0x58b565, topAccent: 0xffffff, bottom: 0x4b5a7a, shoes: 0xf2e6d0, accessories: [] },
  barrera: { skin: 0xe9b58c, hair: 0x3a3a3a, hairStyle: 'side', top: 0x27304a, topAccent: 0x9fb0c8, bottom: 0x1c2638, shoes: 0x111418, accessories: ['tie', 'lapels', 'glasses'] },
  ernesto: { skin: 0xd9a37a, hair: 0x8d8d8d, hairStyle: 'short', top: 0xc9a66b, topAccent: 0xffffff, bottom: 0x4a3a2a, shoes: 0x3a2618, accessories: ['glasses'] },
  ruben: { skin: 0xb9794d, hair: 0x15100b, hairStyle: 'short', top: 0x33a6d8, topAccent: 0xffd23f, bottom: 0x2a3550, shoes: 0x3a2618, accessories: ['cap'] },
  sofia: { skin: 0xe0ab85, hair: 0x8a3a2c, hairStyle: 'long', top: 0xb56bd6, topAccent: 0xffffff, bottom: 0x4a4f7a, shoes: 0xffffff, accessories: ['scarf'] },
  repartidor: { skin: 0xf0c7a4, hair: 0x3a2618, hairStyle: 'none', top: 0x33a6d8, topAccent: 0xffd23f, bottom: 0x2a3550, shoes: 0xf2f2f2, accessories: ['cap', 'backpack'] }
});
