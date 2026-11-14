// Finite cosmetic options shared by the wardrobe, profile validator and renderer.
// No renderer, economy, progression, storage or network dependency belongs here.
const options = list => Object.freeze(list.map(option => Object.freeze(option)));

export const TOP_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'tee', name: 'Playera casual', color: 0xf7f5ee },
  { id: 'hoodie', name: 'Sudadera urbana', color: 0x8a5fd0 },
  { id: 'denimJacket', name: 'Chamarra denim', color: 0x4f78a9 },
  { id: 'blazer', name: 'Blazer moderno', color: 0x374560 },
  { id: 'cropTop', name: 'Top Y2K', color: 0xd888af },
  // colección Mundo vivo (2.0)
  { id: 'printTee', name: 'Playera estampada', color: 0x2f3e66 },
  { id: 'shirt', name: 'Camisa con cuello', color: 0x9cc3e6 },
  { id: 'blouse', name: 'Blusa con volantes', color: 0xf4c7d6 },
  { id: 'sweater', name: 'Suéter tejido', color: 0xc7704a },
  { id: 'sportJacket', name: 'Chamarra deportiva', color: 0x2fa37d },
  { id: 'tank', name: 'Top de tirantes', color: 0xffd166 }
]);
export const BOTTOM_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'straight', name: 'Pantalón recto', color: 0x4272a0 },
  { id: 'cargo', name: 'Pantalón cargo', color: 0x7f8b66 },
  { id: 'flare', name: 'Acampanado Y2K', color: 0x4b6f96 },
  { id: 'skirt', name: 'Falda moderna', color: 0x35304b },
  { id: 'pleatedSkirt', name: 'Falda plisada', color: 0x645a87 },
  { id: 'shorts', name: 'Shorts', color: 0x5b7fa6 },
  { id: 'bermuda', name: 'Bermuda', color: 0xb8a27a },
  { id: 'capri', name: 'Pantalón capri', color: 0x384a6d },
  { id: 'joggers', name: 'Pantalón deportivo', color: 0x3b3f4a },
  { id: 'wideJeans', name: 'Mezclilla de corte ancho', color: 0x5d82b3 },
  { id: 'longSkirt', name: 'Falda larga', color: 0x8a5fd0 },
  { id: 'denimSkirt', name: 'Falda de mezclilla', color: 0x4f78a9 }
]);
export const SHOE_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'sneakers', name: 'Tenis urbanos', color: 0xf6f4f0 },
  { id: 'chunky', name: 'Tenis chunky', color: 0xeee9f2 },
  { id: 'boots', name: 'Botas modernas', color: 0x563a2f },
  { id: 'loafers', name: 'Mocasines', color: 0x282637 },
  { id: 'sandals', name: 'Sandalias', color: 0xc98a4b },
  { id: 'ankleBoots', name: 'Botines', color: 0x6b3f2a },
  { id: 'runners', name: 'Tenis para correr', color: 0x3a3f8f },
  { id: 'oxfords', name: 'Zapatos casuales', color: 0x7a4b2e }
]);
export const BAG_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'none', name: 'Sin bolso ni mochila' },
  { id: 'handbag', name: 'Bolso de mano' },
  { id: 'tote', name: 'Bolso tote' },
  { id: 'crossbody', name: 'Bolso cruzado' },
  { id: 'miniBackpack', name: 'Mochila pequeña' },
  { id: 'fannyPack', name: 'Cangurera' }
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
  { id: 'cowboyHat', name: 'Sombrero vaquero' },
  { id: 'sportCap', name: 'Gorra deportiva' },
  { id: 'sunHat', name: 'Sombrero de ala ancha' },
  { id: 'strawHat', name: 'Sombrero de palma' }
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
  { id: 'waves', name: 'Ondas largas' },
  { id: 'braid', name: 'Trenza' },
  { id: 'afro', name: 'Afro con volumen' }
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
export const GLASSES_OPTIONS = options([
  { id: 'base', name: 'Del personaje' },
  { id: 'round', name: 'Lentes redondos' },
  { id: 'sun', name: 'Lentes de sol' },
  { id: 'party', name: 'Lentes de fiesta' }
]);
export const BRACELET_OPTIONS = options([
  { id: 'base', name: 'Sin pulsera' },
  { id: 'beads', name: 'Pulsera de cuentas' },
  { id: 'bangle', name: 'Brazalete dorado' }
]);
export const HEADPHONE_OPTIONS = options([
  { id: 'base', name: 'Sin audífonos' },
  { id: 'over', name: 'Audífonos de diadema' },
  { id: 'sport', name: 'Audífonos deportivos' }
]);
export const COSMETIC_OPTIONS = Object.freeze({
  top: TOP_OPTIONS, bottom: BOTTOM_OPTIONS, shoes: SHOE_OPTIONS, bag: BAG_OPTIONS,
  hairStyle: HAIR_STYLE_OPTIONS, hairColor: HAIR_COLORS, necklace: NECKLACE_OPTIONS,
  glasses: GLASSES_OPTIONS, bracelet: BRACELET_OPTIONS, headphones: HEADPHONE_OPTIONS
});
export const HAT_ACCESSORIES = Object.freeze([
  'cap', 'explorerHat', 'toque', 'hardhat', 'spaceHelmet', 'gradCap', 'laurel', 'headband',
  'beanie', 'bucketHat', 'beret', 'fedora', 'cowboyHat', 'sportCap', 'sunHat', 'strawHat'
]);
