// Ciudad ICADEM 2.0 · Paseo comercial: calle peatonal al este de la plaza con las tiendas de la ciudad.
// Cada tienda tiene escaparate, toldo y un vendedor en el mostrador. Se compra con monedas del juego.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { mat, box, cyl, sph, plane, slab, sign, pavingTexture, grassTexture, tree, bush, flowers, lamp, bench, skyDome, sunLight, mergeStatic } from './kit.js';
import { SHOPS } from '../economy/catalog.js';
import { openShop } from '../ui/vivo-panels.js';

export const COMERCIO_GATE = Object.freeze({ x: 45.2, z: 0, arrival: { x: 41.5, z: 0, yaw: -Math.PI / 2 } });   // en la plaza
const STORES = Object.freeze([
  { shop: 'ropa', x: -12, side: 1, color: 0xe86a5c, awning: 0xffd166, vendor: { skin: 0xd9a37a, hair: 0x3b2416, hairStyle: 'bun', top: 0x8a5fd0, topAccent: 0xffd166, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['glasses'] }, name: 'Valeria', hello: '¡Bienvenida, bienvenido! Tenemos prendas nuevas de la colección Mundo vivo.' },
  { shop: 'zapateria', x: -4, side: 1, color: 0x3a8fd6, awning: 0xffffff, vendor: { skin: 0xf0c7a4, hair: 0x2a1e14, hairStyle: 'side', top: 0x2f9e8f, topAccent: 0xffffff, bottom: 0x3b3f4a, shoes: 0x6b3f2a, accessories: [] }, name: 'Don Julián', hello: 'Pásale: botines, tenis para correr y zapatos para cada ocasión.' },
  { shop: 'accesorios', x: 4, side: 1, color: 0xff7ab8, awning: 0x22345c, vendor: { skin: 0xc98e63, hair: 0x1d140d, hairStyle: 'long', top: 0xffd166, topAccent: 0x22345c, bottom: 0x1d2a40, shoes: 0xf6f4f0, accessories: [] }, name: 'Sofía', hello: 'Lentes, audífonos, sombreros y bolsos. ¡Encuentra tu estilo!' },
  { shop: 'especial', x: 12, side: 1, color: 0x8a5fd0, awning: 0xffd166, vendor: { skin: 0x9a6440, hair: 0x171316, hairStyle: 'short', top: 0x22345c, topAccent: 0xffd166, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['badge'] }, name: 'Tomás', hello: 'Artículos de temporada para ti y tus mascotas.' },
  { shop: 'mascotas', x: -8, side: -1, color: 0x2fa37d, awning: 0xffffff, vendor: { skin: 0xe9b58c, hair: 0x6a4424, hairStyle: 'short', top: 0xffffff, topAccent: 0x2fa37d, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['apron'] }, name: 'Lupita', hello: 'Collares, correas, premios y camitas. ¡Tus compañeros te lo agradecerán!' },
  { shop: 'muebles', x: 0, side: -1, color: 0xc98f56, awning: 0x2f9e8f, vendor: { skin: 0xf6d3b5, hair: 0x4a2f22, hairStyle: 'side', top: 0x3a8fd6, topAccent: 0xffffff, bottom: 0x4b5a7a, shoes: 0x1f1a17, accessories: [] }, name: 'Arturo', hello: 'Todo para decorar tu casa. Lo que compres aparece en «Decorar mi casa».' },
  { shop: 'juguetes', x: 8, side: -1, color: 0xf2b93b, awning: 0xe2483d, vendor: { skin: 0xd9a37a, hair: 0x2d211c, hairStyle: 'ponytail', top: 0xe2483d, topAccent: 0xffd166, bottom: 0x35304b, shoes: 0xeee9f2, accessories: [] }, name: 'Paty', hello: 'Balero, trompo, yoyo, papalote y burbujas: ¡los clásicos de siempre!' }
]);

function vitrine(shop) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#dff3ff'); gr.addColorStop(1, '#b9d9f2'); x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
  x.font = '44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const icons = { ropa: ['👕', '👗', '🧥', '👚'], zapateria: ['👟', '👢', '👞', '🩴'], accesorios: ['🕶️', '🎧', '👒', '🎒'], especial: ['✨', '🥳', '🤠', '💐'], mascotas: ['🦮', '🎾', '🧶', '🦴'], muebles: ['🛋️', '🪴', '💡', '🖼️'], juguetes: ['🪀', '🪁', '🌀', '🫧'] }[shop] || ['✨'];
  icons.forEach((ic, i) => x.fillText(ic, 32 + i * 64, 66));
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, 256, 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildComercio(api) {
  const g = new THREE.Group(), col = new CollisionWorld().setBounds(-23.6, -8.6, 23.6, 8.6);
  g.add(skyDome(0x4aa3f5, 0xcdeeff, 0xbfe7c7));
  // suelo: adoquín en la calle, pasto en las orillas
  plane(52, 22, mat(0xffffff, { map: grassTexture(14, 6) }), 0, -0.01, 0, g, { rx: -Math.PI / 2 }).receiveShadow = true;
  plane(48, 11, mat(0xffffff, { map: pavingTexture(16, 4) }), 0, 0.003, 0, g, { rx: -Math.PI / 2 }).receiveShadow = true;
  for (const z of [-5.6, 5.6]) box(48, 0.14, 0.4, mat(0xe9e4da), 0, 0, z, g, { cast: false });
  // tiendas
  const npcs = [], interactables = [];
  for (const st of STORES) {
    const s = SHOPS[st.shop], fz = st.side * 8.2, front = fz - st.side * 1.4, face = st.side > 0 ? Math.PI : 0;
    const b = new THREE.Group(); b.position.set(st.x, 0, fz); b.rotation.y = face; g.add(b);
    box(7.2, 5.2, 2.8, mat(st.color, { r: 0.85 }), 0, 0, 0, b);
    box(7.4, 0.3, 3.0, mat(0xffffff, { r: 0.6 }), 0, 5.2, 0, b);
    plane(4.6, 2.0, new THREE.MeshStandardMaterial({ map: vitrine(st.shop), roughness: 0.25, metalness: 0.1 }), -0.9, 1.75, 1.42, b);
    box(4.8, 0.12, 0.25, mat(0xffffff), -0.9, 0.6, 1.45, b);
    box(1.2, 2.3, 0.08, mat(0x12325f, { r: 0.5 }), 2.4, 0, 1.42, b);
    // toldo a rayas
    for (let i = 0; i < 8; i++) { const a = box(0.9, 0.08, 1.4, mat(i % 2 ? st.awning : st.color, { r: 0.9 }), -3.15 + i * 0.9, 3.25, 2.05, b, { cast: true }); a.rotation.x = 0.32; }
    const sg = sign(s.name.toUpperCase(), 4.6, 0.62, { bg: '#12325f', fg: '#ffd166', sub: s.text }); sg.position.set(0, 4.25, 1.44); b.add(sg);
    // mostrador y vendedor
    slab(2.2, 0.7, 1.0, 0.08, mat(0xf6f1e4), 0, 0, 2.7, b);
    box(2.3, 0.08, 0.8, mat(st.awning === 0xffffff ? st.color : st.awning), 0, 1.0, 2.7, b);
    col.addBox(st.x - 3.7, Math.min(fz - 1.5, fz + st.side * 1.5) - 0.05, st.x + 3.7, Math.max(fz - 1.5, fz + st.side * 1.5));
    col.addBoxAt(st.x, fz - st.side * 2.7, 2.3, 0.8);
    const npc = Object.assign(new Npc({ look: st.vendor, x: st.x, z: fz - st.side * 2.05, yaw: face }), { quizName: st.name });
    npcs.push(npc);
    interactables.push({ id: 'tienda-' + st.shop, x: st.x, y: 1.3, z: front - st.side * 2.6, radius: 2.2, color: 0xffc93c, label: `${s.icon} ${s.name}`, action: () => { api.player.emote('wave', 1); openShop(api, st.shop, { greeting: `${st.name}: «${st.hello}»` }); } });
  }
  // mobiliario urbano
  for (const x of [-18, -16, 16, 18]) for (const z of [-4.4, 4.4]) { lamp(x, z, g); col.addCircle(x, z, 0.25); }
  for (const [x, z, r] of [[-16, 3.6, Math.PI], [16, -3.6, 0]]) { bench(x + 1, z, r, g); col.addCircle(x + 1, z, 0.75); }
  for (const [x, z] of [[-20.5, 7], [20.5, 7], [-20.5, -7], [20.5, -7]]) { tree(x, z, g, { scale: 1 }); col.addCircle(x, z, 0.4); }
  for (const [x, z] of [[-17, -7.2], [17, 7.2], [-1, 6.2]]) flowers(x, z, g);
  // fuente pequeña al centro
  cyl(1.4, 1.5, 0.45, mat(0xe9e4da), 0, 0, 0, g, { seg: 28 }); cyl(1.2, 1.2, 0.05, mat(0x6fc3ff, { r: 0.1 }), 0, 0.42, 0, g, { seg: 28, cast: false }); cyl(0.18, 0.22, 1.1, mat(0xe9e4da), 0, 0.45, 0, g, { seg: 14 }); sph(0.25, mat(0x6fc3ff, { r: 0.1 }), 0, 1.6, 0, g, { seg: 14 });
  col.addCircle(0, 0, 1.55);
  // arco de regreso a la plaza (extremo oeste)
  const arch = new THREE.Group(); arch.position.set(-23.2, 0, 0); g.add(arch);
  for (const s of [-1, 1]) { box(0.5, 4, 0.5, mat(0x12325f), 0, 0, s * 2.6, arch); col.addCircle(-23.2, s * 2.6, 0.35); }
  box(0.5, 0.6, 5.7, mat(0x12325f), 0, 4, 0, arch);
  const as = sign('PLAZA CIUDAD ICADEM', 3.6, 0.5, { bg: '#ffd166', fg: '#12325f' }); as.position.set(0.28, 3.6, 0); as.rotation.y = Math.PI / 2; arch.add(as);
  const welcome = sign('PASEO COMERCIAL', 3.6, 0.5, { bg: '#12325f', fg: '#ffd166', sub: 'Se paga con monedas del juego' }); welcome.position.set(-0.28, 3.6, 0); welcome.rotation.y = -Math.PI / 2; arch.add(welcome);
  g.add(new THREE.HemisphereLight(0xdff1ff, 0x7aa36b, 1.15));
  const sun = sunLight(g, { x: 18, y: 26, z: 14, intensity: 2.0, area: 30 }); sun.target.position.set(0, 0, 0);
  npcs.forEach(n => g.add(n.group));
  mergeStatic(g);
  interactables.push({ id: 'plaza', x: -22.2, y: 1.6, z: 0, radius: 2.6, color: 0x2f9e8f, label: 'Volver a la plaza', action: () => api.travel('plaza', 'comercio') });
  return {
    name: 'comercio', title: 'Paseo comercial', group: g, collision: col, interactables, npcs,
    background: 0x9fd8ff, fog: { color: 0xcfe9ff, near: 40, far: 90 },
    spawns: { default: { x: -16.5, z: 0, yaw: Math.PI / 2 } },   // dentro del radio de entrada (−19, 0) y con el arco detrás de la cámara
    camera: { distance: 6.2, minDistance: 2.5, maxDistance: 9, pitch: 0.42, yaw: 0, box: { minX: -26, maxX: 26, minZ: -11, maxZ: 11, maxY: 14 } },
    update() {}
  };
}
