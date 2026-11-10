// Catálogo de los 10 avatares de Ciudad ICADEM.
// Fase 1: solo el Explorador está disponible y es el que se juega. Los demás quedan definidos
// (nombre, ruta y apariencia base) para la tienda e inventario de la Fase 4; ninguno da ventaja jugable.

export const AVATARS = Object.freeze([
  { id: 'explorador', name: 'Explorador', route: 'Exploración', available: true, price: 0,
    look: { skin: 0xf2c29b, hair: 0x4a2f22, hairStyle: 'short', top: 0x2f9e8f, topAccent: 0xffffff, bottom: 0x3b4a6b, shoes: 0xf7f3ea, accessories: ['explorerHat', 'backpack', 'scarf'] } },
  { id: 'ejecutivo', name: 'Ejecutivo', route: 'Administración', available: false,
    look: { skin: 0xe9b58c, hair: 0x2b2118, hairStyle: 'side', top: 0x22345c, topAccent: 0xd9a441, bottom: 0x1b2540, shoes: 0x2a1d14, accessories: ['tie', 'lapels'] } },
  { id: 'cientifica', name: 'Científica', route: 'Ciencia', available: false,
    look: { skin: 0xc98e63, hair: 0x23180f, hairStyle: 'bun', top: 0xf6f8fb, topAccent: 0x33b6c9, bottom: 0x3a5a78, shoes: 0xffffff, accessories: ['glasses', 'badge'] } },
  { id: 'ingeniero', name: 'Ingeniero', route: 'Ingeniería', available: false,
    look: { skin: 0xd9a37a, hair: 0x3a2a1c, hairStyle: 'none', top: 0xf08a24, topAccent: 0xffd23f, bottom: 0x384455, shoes: 0x5a3d22, accessories: ['cap', 'badge'] } },
  { id: 'medico', name: 'Médico', route: 'Salud', available: false,
    look: { skin: 0xf0c7a4, hair: 0x5a3b22, hairStyle: 'short', top: 0xffffff, topAccent: 0x2bb5a0, bottom: 0x2bb5a0, shoes: 0xffffff, accessories: ['badge'] } },
  { id: 'agronomo', name: 'Agrónomo', route: 'Agronomía', available: false,
    look: { skin: 0xb9794d, hair: 0x1f150d, hairStyle: 'short', top: 0x6fae45, topAccent: 0xf3e2a9, bottom: 0x6b4a2b, shoes: 0x4c3520, accessories: ['explorerHat'] } },
  { id: 'chef', name: 'Chef', route: 'Gastronomía', available: false,
    look: { skin: 0xf2c29b, hair: 0x2c1d12, hairStyle: 'side', top: 0xffffff, topAccent: 0xe8483f, bottom: 0x2d2f3a, shoes: 0x1d1d22, accessories: ['apron'] } },
  { id: 'veterinario', name: 'Veterinario', route: 'Veterinaria', available: false,
    look: { skin: 0xe0ab85, hair: 0x6a4424, hairStyle: 'long', top: 0x4fb8a8, topAccent: 0xffffff, bottom: 0x3d8f84, shoes: 0xffffff, accessories: ['badge'] } },
  { id: 'juez', name: 'Juez', route: 'Justicia', available: false,
    look: { skin: 0xd6a57e, hair: 0xc9ccd3, hairStyle: 'side', top: 0x1d2230, topAccent: 0xf4f1e8, bottom: 0x1d2230, shoes: 0x14161c, accessories: ['lapels', 'glasses'] } },
  { id: 'embajador', name: 'Embajador ICADEM', route: 'Comunidad', available: false,
    look: { skin: 0xc98e63, hair: 0x231a12, hairStyle: 'short', top: 0x1e63c4, topAccent: 0xf2b93b, bottom: 0x123c8a, shoes: 0xffffff, accessories: ['scarf', 'badge'] } }
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
  repartidor: { skin: 0xf0c7a4, hair: 0x3a2618, hairStyle: 'none', top: 0x33a6d8, topAccent: 0xffd23f, bottom: 0x2a3550, shoes: 0xf2f2f2, accessories: ['cap', 'backpack'] }
});
