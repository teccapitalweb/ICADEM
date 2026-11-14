// Ciudad ICADEM 2.0 · tiendas y artículos (módulo puro, compartido por cliente y servidor).
//
// Todo se paga con MONEDAS DE CIUDAD ICADEM: un recurso del juego, separado de la XP y sin ninguna
// relación con la cartera, los créditos de membresía, las comisiones ni Stripe. No hay compras con
// dinero real, ni cajas de botín, ni comercio entre jugadores. Ningún artículo da ventaja de juego.
//
// Campos de un artículo:
//   id, name, kind, shop, price (0 = no se vende), icon
//   kind: furniture | petAcc | toy | petToy | food | treat | drink | wear
//   stack: consumible que se acumula (comida, bebidas); los demás se tienen una sola vez
//   slot/species: accesorios de mascota (ver pets/pet-catalog.js)
//   size [ancho, fondo] en metros y layer (floor | rug | wall | pet): muebles de la casa
//   color/design: datos para dibujarlo
//   unlock { level }: requisito adicional para poder comprarlo
const I = (id, name, kind, shop, price, extra = {}) => Object.freeze({ id, name, kind, shop, price, ...extra });

export const SHOPS = Object.freeze({
  ropa: { name: 'Boutique ICADEM', icon: '👕', text: 'Prendas para tu avatar.' },
  zapateria: { name: 'Zapatería', icon: '👟', text: 'Calzado para cada ocasión.' },
  accesorios: { name: 'Accesorios', icon: '🕶️', text: 'Gorras, lentes, bolsos y más.' },
  mascotas: { name: 'Tienda de mascotas', icon: '🐾', text: 'Collares, correas, premios y juguetes para tus compañeros.' },
  muebles: { name: 'Muebles y decoración', icon: '🛋️', text: 'Todo para tu casa.' },
  juguetes: { name: 'Juguetería', icon: '🪀', text: 'Juguetes tradicionales y de exterior.' },
  aguas: { name: 'Aguas frescas', icon: '🥤', text: 'Horchata, jamaica, limón y más.' },
  especial: { name: 'Artículos especiales', icon: '✨', text: 'Piezas de temporada y de colección.' }
});

const LEASH_COLORS = [['roja', 'Roja', 0xe2483d, 25], ['azul', 'Azul', 0x2f6fd8, 25], ['verde', 'Verde', 0x2fa865, 25], ['morada', 'Morada', 0x8a5fd0, 25], ['reflejante', 'Reflejante', 0xd9ff3d, 40], ['arcoiris', 'Arcoíris', 0xff7ab8, 60]];

export const ITEMS = Object.freeze([
  /* ---------- casa (muebles; los de precio 0 se regalan al empezar) ---------- */
  I('cama-sencilla', 'Cama sencilla', 'furniture', 'muebles', 0, { icon: '🛏️', size: [1.2, 2.1], layer: 'floor', color: 0x3f7fd9 }),
  I('cama-doble', 'Cama matrimonial', 'furniture', 'muebles', 140, { icon: '🛏️', size: [1.7, 2.2], layer: 'floor', color: 0xe86a5c }),
  I('sillon', 'Sillón', 'furniture', 'muebles', 0, { icon: '🛋️', size: [1.0, 0.9], layer: 'floor', color: 0x2f9e8f }),
  I('sofa', 'Sofá de tres plazas', 'furniture', 'muebles', 120, { icon: '🛋️', size: [2.2, 0.95], layer: 'floor', color: 0x8a5fd0 }),
  I('mesa-centro', 'Mesa de centro', 'furniture', 'muebles', 0, { icon: '🪑', size: [1.1, 0.7], layer: 'floor', color: 0xc98f56 }),
  I('comedor', 'Mesa de comedor', 'furniture', 'muebles', 90, { icon: '🍽️', size: [1.6, 0.9], layer: 'floor', color: 0xb9793f }),
  I('silla', 'Silla', 'furniture', 'muebles', 0, { icon: '🪑', size: [0.5, 0.5], layer: 'floor', color: 0x2f9e8f }),
  I('escritorio', 'Escritorio', 'furniture', 'muebles', 70, { icon: '🖥️', size: [1.4, 0.7], layer: 'floor', color: 0xd9a066 }),
  I('lampara-pie', 'Lámpara de pie', 'furniture', 'muebles', 0, { icon: '💡', size: [0.45, 0.45], layer: 'floor', color: 0xffe2a8, light: true }),
  I('lampara-luna', 'Lámpara luna', 'furniture', 'muebles', 60, { icon: '🌙', size: [0.5, 0.5], layer: 'floor', color: 0xfff3c2, light: true }),
  I('planta-maceta', 'Planta en maceta', 'furniture', 'muebles', 0, { icon: '🪴', size: [0.5, 0.5], layer: 'floor', color: 0x4fae5a }),
  I('planta-grande', 'Palmera de interior', 'furniture', 'muebles', 45, { icon: '🌴', size: [0.7, 0.7], layer: 'floor', color: 0x2f8a46 }),
  I('cactus', 'Cactus en maceta de barro', 'furniture', 'muebles', 30, { icon: '🌵', size: [0.4, 0.4], layer: 'floor', color: 0x4f9a52 }),
  I('estante', 'Estante', 'furniture', 'muebles', 50, { icon: '📚', size: [1.0, 0.4], layer: 'floor', color: 0xb9793f }),
  I('librero', 'Librero alto', 'furniture', 'muebles', 85, { icon: '📚', size: [1.2, 0.45], layer: 'floor', color: 0x8a5a36 }),
  I('baul-juguetes', 'Baúl de juguetes', 'furniture', 'muebles', 40, { icon: '🧸', size: [0.9, 0.55], layer: 'floor', color: 0xf2b93b }),
  I('alfombra-redonda', 'Alfombra redonda', 'furniture', 'muebles', 0, { icon: '🟠', size: [2.0, 2.0], layer: 'rug', color: 0xf2b93b }),
  I('alfombra-sarape', 'Alfombra de sarape', 'furniture', 'muebles', 55, { icon: '🟥', size: [2.4, 1.6], layer: 'rug', color: 0xe2483d, design: 'sarape' }),
  I('cuadro-paisaje', 'Cuadro de paisaje', 'furniture', 'muebles', 35, { icon: '🖼️', size: [1.0, 0.1], layer: 'wall', color: 0x4cc9f0, design: 'paisaje' }),
  I('cuadro-papel-picado', 'Papel picado enmarcado', 'furniture', 'muebles', 35, { icon: '🎏', size: [1.0, 0.1], layer: 'wall', color: 0xff7ab8, design: 'picado' }),
  I('cuadro-estrellas', 'Cuadro de estrellas', 'furniture', 'muebles', 35, { icon: '✨', size: [0.8, 0.1], layer: 'wall', color: 0x22345c, design: 'estrellas' }),
  // espacio de mascotas (se colocan en la casa; las mascotas los usan)
  I('cama-mascota', 'Camita para mascota', 'furniture', 'mascotas', 0, { icon: '🧺', size: [0.8, 0.8], layer: 'pet', color: 0x3a8fd6, petUse: 'sleep' }),
  I('cama-mascota-nube', 'Camita nube', 'furniture', 'mascotas', 45, { icon: '☁️', size: [0.9, 0.9], layer: 'pet', color: 0xeef3ff, petUse: 'sleep' }),
  I('comedero', 'Comedero', 'furniture', 'mascotas', 0, { icon: '🥣', size: [0.45, 0.45], layer: 'pet', color: 0xe86a5c, petUse: 'eat' }),
  I('bebedero', 'Bebedero', 'furniture', 'mascotas', 0, { icon: '💧', size: [0.45, 0.45], layer: 'pet', color: 0x3a8fd6, petUse: 'drink' }),
  I('percha-ave', 'Percha para aves', 'furniture', 'mascotas', 40, { icon: '🪶', size: [0.6, 0.6], layer: 'pet', color: 0xb9793f, petUse: 'perch' }),
  I('rascador', 'Rascador para gatos', 'furniture', 'mascotas', 50, { icon: '🐈', size: [0.6, 0.6], layer: 'pet', color: 0xd9b98c, petUse: 'scratch' }),

  /* ---------- accesorios de mascota (no se gastan; sirven para todas las compatibles) ---------- */
  I('collar-basico', 'Collar básico', 'petAcc', 'mascotas', 0, { icon: '⭕', slot: 'collar', color: 0xe2483d }),
  I('collar-estrellas', 'Collar de estrellas', 'petAcc', 'mascotas', 30, { icon: '⭐', slot: 'collar', color: 0x22345c, design: 'estrellas' }),
  I('collar-flores', 'Collar de flores', 'petAcc', 'mascotas', 30, { icon: '🌸', slot: 'collar', color: 0xff8fb8, design: 'flores' }),
  I('correa-basica', 'Correa básica', 'petAcc', 'mascotas', 0, { icon: '🦮', slot: 'leash', color: 0x2f9e8f }),
  ...LEASH_COLORS.map(([c, n, color, price]) => I('correa-' + c, 'Correa ' + n.toLowerCase(), 'petAcc', 'mascotas', price, { icon: '🦮', slot: 'leash', color, design: c === 'arcoiris' ? 'arcoiris' : c === 'reflejante' ? 'reflejante' : null })),
  I('arnes-deportivo', 'Arnés deportivo', 'petAcc', 'mascotas', 40, { icon: '🦺', slot: 'harness', color: 0x3a8fd6 }),
  I('arnes-acolchado', 'Arnés acolchado', 'petAcc', 'mascotas', 45, { icon: '🦺', slot: 'harness', color: 0xe86a5c }),
  I('placa-hueso', 'Placa de hueso', 'petAcc', 'mascotas', 20, { icon: '🦴', slot: 'tag', color: 0xffd166 }),
  I('placa-corazon', 'Placa de corazón', 'petAcc', 'mascotas', 20, { icon: '❤️', slot: 'tag', color: 0xe2483d }),
  I('panuelo-rojo', 'Pañuelo rojo', 'petAcc', 'mascotas', 25, { icon: '🧣', slot: 'scarf', color: 0xd8302f }),
  I('panuelo-azul', 'Pañuelo azul', 'petAcc', 'mascotas', 25, { icon: '🧣', slot: 'scarf', color: 0x2f6fd8 }),
  I('panuelo-tricolor', 'Pañuelo tricolor', 'petAcc', 'mascotas', 35, { icon: '🧣', slot: 'scarf', color: 0x2fa865, design: 'tricolor' }),
  I('sueter-tejido', 'Suéter tejido', 'petAcc', 'mascotas', 50, { icon: '🧶', slot: 'outfit', color: 0xc9473c }),
  I('impermeable', 'Impermeable amarillo', 'petAcc', 'mascotas', 50, { icon: '🧥', slot: 'outfit', color: 0xffd23f }),
  I('gorrito-fiesta', 'Gorrito de fiesta', 'petAcc', 'especial', 30, { icon: '🥳', slot: 'hat', color: 0x8a5fd0 }),
  I('sombrerito-charro', 'Sombrerito de charro', 'petAcc', 'especial', 45, { icon: '🤠', slot: 'hat', color: 0x2b2422 }),
  I('corona-flores', 'Corona de flores', 'petAcc', 'especial', 40, { icon: '💐', slot: 'hat', color: 0xff8fb8 }),

  /* ---------- juguetes de mascota ---------- */
  I('pelota', 'Pelota', 'petToy', 'mascotas', 0, { icon: '🎾', color: 0xd9ff3d, species: ['perro', 'fantastico'] }),
  I('frisbee', 'Disco volador', 'petToy', 'mascotas', 30, { icon: '🥏', color: 0xe86a5c, species: ['perro'] }),
  I('raton-juguete', 'Ratón de juguete', 'petToy', 'mascotas', 20, { icon: '🐭', color: 0x9aa0a8, species: ['gato'] }),
  I('estambre', 'Bola de estambre', 'petToy', 'mascotas', 20, { icon: '🧶', color: 0xff7ab8, species: ['gato'] }),
  I('campanita', 'Campanita', 'petToy', 'mascotas', 20, { icon: '🔔', color: 0xffd166, species: ['ave'] }),

  /* ---------- comida (consumible). Las croquetas son gratis y no se acaban ---------- */
  I('premio-galleta', 'Galleta para perro', 'treat', 'mascotas', 5, { icon: '🍪', stack: true, species: ['perro', 'fantastico'] }),
  I('premio-pescado', 'Bocadito de pescado', 'treat', 'mascotas', 5, { icon: '🐟', stack: true, species: ['gato'] }),
  I('premio-semillas', 'Mezcla de semillas', 'treat', 'mascotas', 5, { icon: '🌻', stack: true, species: ['ave'] }),
  I('premio-fruta', 'Fruta picada', 'treat', 'mascotas', 5, { icon: '🍓', stack: true, species: ['ave', 'fantastico'] }),

  /* ---------- ropa del avatar (colección Mundo vivo). Las piezas sin artículo son gratis ---------- */
  ...[['top', 'shirt', 'Camisa con cuello', 40, '👔'], ['top', 'blouse', 'Blusa con volantes', 40, '👚'], ['top', 'sweater', 'Suéter tejido', 45, '🧶'], ['top', 'sportJacket', 'Chamarra deportiva', 60, '🧥'], ['top', 'tank', 'Top de tirantes', 30, '🎽'],
    ['bottom', 'bermuda', 'Bermuda', 30, '🩳'], ['bottom', 'capri', 'Pantalón capri', 30, '👖'], ['bottom', 'joggers', 'Pantalón deportivo', 35, '👖'], ['bottom', 'wideJeans', 'Mezclilla de corte ancho', 50, '👖'], ['bottom', 'longSkirt', 'Falda larga', 45, '👗'], ['bottom', 'denimSkirt', 'Falda de mezclilla', 40, '👗']
  ].map(([slot, option, name, price, icon]) => I('ropa-' + option, name, 'wear', 'ropa', price, { slot, option, icon })),
  ...[['shoes', 'ankleBoots', 'Botines', 55, '👢'], ['shoes', 'runners', 'Tenis para correr', 60, '👟'], ['shoes', 'oxfords', 'Zapatos casuales', 45, '👞']].map(([slot, option, name, price, icon]) => I('calzado-' + option, name, 'wear', 'zapateria', price, { slot, option, icon })),
  ...[['hat', 'sunHat', 'Sombrero de ala ancha', 35, '👒'], ['hat', 'strawHat', 'Sombrero de palma', 40, '🤠'], ['bag', 'miniBackpack', 'Mochila pequeña', 45, '🎒'], ['bag', 'fannyPack', 'Cangurera', 30, '👝'],
    ['glasses', 'sun', 'Lentes de sol', 35, '🕶️'], ['glasses', 'party', 'Lentes de fiesta', 40, '🥳'], ['bracelet', 'bangle', 'Brazalete dorado', 30, '📿'], ['headphones', 'over', 'Audífonos de diadema', 50, '🎧'], ['headphones', 'sport', 'Audífonos deportivos', 50, '🎧']
  ].map(([slot, option, name, price, icon]) => I('accesorio-' + option, name, 'wear', 'accesorios', price, { slot, option, icon })),

  /* ---------- juguetes tradicionales para el avatar (animación al usarlos) ---------- */
  I('balero', 'Balero', 'toy', 'juguetes', 25, { icon: '🪀', color: 0xe2483d, use: 'balero' }),
  I('trompo', 'Trompo', 'toy', 'juguetes', 25, { icon: '🌀', color: 0x2f6fd8, use: 'trompo' }),
  I('yoyo', 'Yoyo', 'toy', 'juguetes', 20, { icon: '🪀', color: 0x2fa865, use: 'yoyo' }),
  I('papalote', 'Papalote', 'toy', 'juguetes', 40, { icon: '🪁', color: 0xff7ab8, use: 'papalote' }),
  I('burbujas', 'Burbujas de jabón', 'toy', 'juguetes', 15, { icon: '🫧', color: 0x9fd8ff, use: 'burbujas' })
]);
export const itemById = id => ITEMS.find(i => i.id === id) || null;
export const itemsOfShop = shop => ITEMS.filter(i => i.shop === shop && i.price > 0);

/** Lo que recibe cada cuenta al empezar (gratis). */
export const STARTER_ITEMS = Object.freeze(ITEMS.filter(i => i.price === 0).map(i => i.id));
export const STARTER_COUNTS = Object.freeze({ silla: 2 });

/* ---------- aguas frescas ---------- */
export const DRINK_PRICE = 5;
/** Receta: los pasos que el jugador hace en orden. El servidor comprueba la secuencia. */
export const FLAVORS = Object.freeze([
  { id: 'horchata', name: 'Horchata', color: 0xf3ead8, icon: '🥛', ingredients: ['arroz', 'canela', 'azucar'] },
  { id: 'jamaica', name: 'Jamaica', color: 0xa3123a, icon: '🌺', ingredients: ['flor-jamaica', 'azucar'] },
  { id: 'limon', name: 'Limón', color: 0xc8e86b, icon: '🍋', ingredients: ['limon', 'azucar'] },
  { id: 'tamarindo', name: 'Tamarindo', color: 0x8a5a2b, icon: '🟤', ingredients: ['tamarindo', 'azucar'] },
  { id: 'sandia', name: 'Sandía', color: 0xff5d6c, icon: '🍉', ingredients: ['sandia'] },
  { id: 'mango', name: 'Mango', color: 0xffb22e, icon: '🥭', ingredients: ['mango', 'limon'] }
]);
export const INGREDIENTS = Object.freeze({
  arroz: 'Arroz remojado', canela: 'Canela', azucar: 'Un poco de azúcar', 'flor-jamaica': 'Flor de jamaica', limon: 'Limón', tamarindo: 'Pulpa de tamarindo', sandia: 'Sandía', mango: 'Mango', hielo: 'Hielo'
});
export const flavorById = id => FLAVORS.find(f => f.id === id) || null;
/** Secuencia completa de «Prepara tu agua»: vaso → agua → ingredientes (en cualquier orden) → hielo → servir. */
export function drinkSteps(flavor) { const f = flavorById(flavor); return f ? ['vaso', 'agua', ...f.ingredients, 'hielo', 'servir'] : null; }
export function checkDrinkSteps(flavor, steps) {
  const want = drinkSteps(flavor); if (!want || !Array.isArray(steps) || steps.length !== want.length) return false;
  if (steps.some(s => typeof s !== 'string')) return false;
  const mid = want.slice(2, -2), got = steps.slice(2, -2);
  return steps[0] === 'vaso' && steps[1] === 'agua' && steps[steps.length - 2] === 'hielo' && steps[steps.length - 1] === 'servir'
    && got.length === mid.length && [...got].sort().join() === [...mid].sort().join();
}

/* ---------- ropa con precio ---------- */
/** Artículo que hay que tener para usar una prenda (null = la prenda es gratis). */
export const wearItemFor = (slot, option) => ITEMS.find(i => i.kind === 'wear' && i.slot === slot && i.option === option) || null;
/** Ranuras del equipamiento con una prenda de pago que la cuenta no tiene. */
export function lockedWear(custom, inv = {}) {
  const out = []; for (const [slot, option] of Object.entries(custom || {})) { const it = wearItemFor(slot, option); if (it && !(inv && inv[it.id])) out.push(slot); }
  return out;
}
