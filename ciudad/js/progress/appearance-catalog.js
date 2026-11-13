// Finite cosmetic options shared by the wardrobe, profile validator and renderer.
// No renderer, economy, progression, storage or network dependency belongs here.
const options = list => Object.freeze(list.map(option => Object.freeze(option)));

export const TOP_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'tee', name: 'Playera casual', color: 0xf7f5ee },
  { id: 'hoodie', name: 'Sudadera urbana', color: 0x8a5fd0 },
  { id: 'denimJacket', name: 'Chamarra denim', color: 0x4f78a9 },
  { id: 'blazer', name: 'Blazer moderno', color: 0x374560 },
  { id: 'cropTop', name: 'Top Y2K', color: 0xd888af }
]);
export const BOTTOM_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'straight', name: 'Pantalón recto', color: 0x4272a0 },
  { id: 'cargo', name: 'Pantalón cargo', color: 0x7f8b66 },
  { id: 'flare', name: 'Acampanado Y2K', color: 0x4b6f96 },
  { id: 'skirt', name: 'Falda moderna', color: 0x35304b },
  { id: 'pleatedSkirt', name: 'Falda plisada', color: 0x645a87 }
]);
export const SHOE_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'sneakers', name: 'Tenis urbanos', color: 0xf6f4f0 },
  { id: 'chunky', name: 'Tenis chunky', color: 0xeee9f2 },
  { id: 'boots', name: 'Botas modernas', color: 0x563a2f },
  { id: 'loafers', name: 'Mocasines', color: 0x282637 }
]);
export const BAG_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'none', name: 'Sin bolso ni mochila' },
  { id: 'handbag', name: 'Bolso de mano' },
  { id: 'tote', name: 'Bolso tote' },
  { id: 'crossbody', name: 'Bolso cruzado' }
]);
export const LEGACY_HAT_IDS = Object.freeze(['base', 'none', 'cap', 'explorerHat']);
export const HAT_OPTIONS = options([
  { id: 'base', name: 'El del avatar' },
  { id: 'none', name: 'Sin sombrero' },
  { id: 'cap', name: 'Gorra' },
  { id: 'explorerHat', name: 'Sombrero' },
  { id: 'beanie', name: 'Gorro tejido' },
  { id: 'bucketHat', name: 'Sombrero bucket' },
  { id: 'beret', name: 'Boina' },
  { id: 'fedora', name: 'Sombrero fedora' },
  { id: 'cowboyHat', name: 'Sombrero vaquero' }
]);
export const HAIR_STYLE_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'short', name: 'Corto clásico' },
  { id: 'side', name: 'Corto de lado' },
  { id: 'long', name: 'Largo liso' },
  { id: 'bun', name: 'Moño alto' },
  { id: 'none', name: 'Sin cabello' },
  { id: 'bob', name: 'Peluca bob' },
  { id: 'ponytail', name: 'Coleta alta' },
  { id: 'curly', name: 'Rizos con volumen' },
  { id: 'pigtails', name: 'Dos coletas' },
  { id: 'waves', name: 'Ondas largas' }
]);
export const HAIR_COLORS = options([
  { id: 'base', name: 'Del personaje', color: null },
  { id: 'negro', name: 'Negro', color: 0x171316 },
  { id: 'espresso', name: 'Espresso', color: 0x2d211c },
  { id: 'castano', name: 'Castaño', color: 0x6a4424 },
  { id: 'rubio', name: 'Rubio miel', color: 0xd5a251 },
  { id: 'cobrizo', name: 'Cobrizo', color: 0xb95f35 },
  { id: 'plateado', name: 'Plateado', color: 0xbfc5d2 },
  { id: 'rosa', name: 'Rosa pastel', color: 0xe88db4 },
  { id: 'lavanda', name: 'Lavanda', color: 0x9473c6 },
  { id: 'azul', name: 'Azul', color: 0x4b86c9 },
  { id: 'menta', name: 'Menta', color: 0x61b4a4 }
]);
export const NECKLACE_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'none', name: 'Sin collar' },
  { id: 'goldChain', name: 'Cadena dorada' },
  { id: 'pearls', name: 'Collar de perlas' },
  { id: 'heart', name: 'Collar corazón' }
]);

// New fields are optional. A missing field or "base" inherits the original avatar
// and is omitted when saved, preserving the exact three-key legacy profile shape.
export const COSMETIC_OPTIONS = Object.freeze({
  top: TOP_OPTIONS, bottom: BOTTOM_OPTIONS, shoes: SHOE_OPTIONS, bag: BAG_OPTIONS,
  hairStyle: HAIR_STYLE_OPTIONS, hairColor: HAIR_COLORS, necklace: NECKLACE_OPTIONS
});
export const HAT_ACCESSORIES = Object.freeze([
  'cap', 'explorerHat', 'toque', 'hardhat', 'spaceHelmet', 'gradCap', 'laurel', 'headband',
  'beanie', 'bucketHat', 'beret', 'fedora', 'cowboyHat'
]);
