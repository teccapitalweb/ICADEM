// Ciudad ICADEM 2.0 · muebles de la casa en 3D (procedurales).
// Cada mueble se construye centrado en su huella (catalog.js → size) y con el frente hacia +Z.
// Las piezas se fusionan por material (mergeStatic), así una casa llena sigue siendo ligera.
import * as THREE from '../three.js';
import { mat, box, cyl, sph, slab, bush, mergeStatic } from '../world/kit.js';
import { itemById } from '../economy/catalog.js';

const WOOD = 0xc98f56, DARK = 0x8a5a36, WHITE = 0xffffff, METAL = 0x5d6675;
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

const BUILD = {
  'cama-sencilla'(g, d) { slab(1.2, 2.1, 0.32, 0.1, mat(WOOD), 0, 0.05, 0, g); slab(1.1, 1.98, 0.2, 0.16, mat(WHITE, { r: 0.9 }), 0, 0.37, 0, g); slab(1.14, 1.3, 0.08, 0.16, mat(d.color, { r: 0.95 }), 0, 0.56, 0.3, g); slab(0.7, 0.42, 0.14, 0.14, mat(WHITE, { r: 0.95 }), 0, 0.58, -0.72, g); box(1.24, 0.9, 0.12, mat(DARK), 0, 0, -1.02, g); },
  'cama-doble'(g, d) { slab(1.7, 2.2, 0.32, 0.1, mat(DARK), 0, 0.05, 0, g); slab(1.6, 2.06, 0.22, 0.16, mat(WHITE, { r: 0.9 }), 0, 0.37, 0, g); slab(1.64, 1.35, 0.08, 0.16, mat(d.color, { r: 0.95 }), 0, 0.58, 0.32, g); for (const x of [-0.4, 0.4]) slab(0.62, 0.42, 0.14, 0.14, mat(0xffe2a8, { r: 0.95 }), x, 0.6, -0.76, g); box(1.76, 1.1, 0.14, mat(DARK), 0, 0, -1.06, g); },
  sillon(g, d) { slab(1.0, 0.9, 0.42, 0.14, mat(d.color, { r: 0.9 }), 0, 0.05, 0.05, g); slab(1.0, 0.28, 0.72, 0.12, mat(d.color, { r: 0.9 }), 0, 0.05, -0.31, g); for (const x of [-0.44, 0.44]) slab(0.14, 0.86, 0.6, 0.06, mat(d.color, { r: 0.9 }), x, 0.05, 0, g); slab(0.72, 0.6, 0.12, 0.12, mat(0xf5f0e6, { r: 0.95 }), 0, 0.47, 0.08, g); },
  sofa(g, d) { slab(2.2, 0.95, 0.42, 0.14, mat(d.color, { r: 0.9 }), 0, 0.05, 0.05, g); slab(2.2, 0.3, 0.76, 0.12, mat(d.color, { r: 0.9 }), 0, 0.05, -0.32, g); for (const x of [-1.03, 1.03]) slab(0.16, 0.9, 0.62, 0.06, mat(d.color, { r: 0.9 }), x, 0.05, 0, g); for (const x of [-0.6, 0, 0.6]) slab(0.6, 0.62, 0.12, 0.12, mat(0xf5f0e6, { r: 0.95 }), x, 0.47, 0.08, g); for (const x of [-0.65, 0.65]) slab(0.42, 0.16, 0.38, 0.08, mat(0xffd166, { r: 0.95 }), x, 0.55, -0.15, g); },
  'mesa-centro'(g, d) { slab(1.1, 0.7, 0.06, 0.08, mat(d.color, { r: 0.6 }), 0, 0.38, 0, g); for (const [x, z] of [[-0.46, -0.26], [0.46, -0.26], [-0.46, 0.26], [0.46, 0.26]]) cyl(0.03, 0.025, 0.38, mat(DARK), x, 0, z, g, { seg: 8 }); box(0.3, 0.05, 0.2, mat(0xe86a5c), 0.15, 0.44, 0.05, g); cyl(0.05, 0.05, 0.12, mat(0x3a8fd6), -0.25, 0.44, -0.05, g, { seg: 10 }); },
  comedor(g, d) { slab(1.6, 0.9, 0.06, 0.06, mat(d.color, { r: 0.6 }), 0, 0.74, 0, g); for (const [x, z] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) box(0.06, 0.74, 0.06, mat(DARK), x, 0, z, g); cyl(0.13, 0.1, 0.05, mat(WHITE), 0, 0.8, 0, g, { seg: 16 }); for (const x of [-0.05, 0.05]) sph(0.06, mat([0xff7a3d, 0x8fd16b][x > 0 ? 1 : 0]), x, 0.88, 0, g, { seg: 10, rings: 8 }); },
  silla(g, d) { slab(0.46, 0.46, 0.06, 0.06, mat(d.color, { r: 0.8 }), 0, 0.44, 0.02, g); for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.2], [0.19, 0.2]]) box(0.04, 0.44, 0.04, mat(DARK), x, 0, z, g); slab(0.46, 0.06, 0.48, 0.03, mat(d.color, { r: 0.8 }), 0, 0.5, -0.2, g); },
  escritorio(g, d) { slab(1.4, 0.7, 0.06, 0.04, mat(d.color, { r: 0.6 }), 0, 0.74, 0, g); box(0.42, 0.7, 0.62, mat(DARK), 0.46, 0.04, 0, g); for (const x of [-0.64]) for (const z of [-0.3, 0.3]) box(0.05, 0.74, 0.05, mat(DARK), x, 0, z, g); box(0.5, 0.32, 0.03, mat(0x16213a), -0.15, 0.82, -0.2, g); box(0.44, 0.26, 0.01, mat(0x4cc9f0, { e: 0x4cc9f0, ei: 0.5 }), -0.15, 0.85, -0.18, g); box(0.4, 0.02, 0.15, mat(0xdfe4ee), -0.15, 0.8, 0.08, g); },
  'lampara-pie'(g, d) { cyl(0.16, 0.18, 0.04, mat(METAL, { m: 0.4 }), 0, 0, 0, g, { seg: 16 }); cyl(0.02, 0.02, 1.35, mat(METAL, { m: 0.4 }), 0, 0.04, 0, g, { seg: 8 }); cyl(0.14, 0.22, 0.26, mat(d.color, { e: 0xffc76b, ei: 0.85, r: 0.6 }), 0, 1.35, 0, g, { seg: 16 }); },
  'lampara-luna'(g, d) { cyl(0.18, 0.2, 0.06, mat(WOOD), 0, 0, 0, g, { seg: 16 }); sph(0.22, mat(d.color, { e: 0xfff3c2, ei: 0.9, r: 0.5 }), 0, 0.3, 0, g, { seg: 18, rings: 12 }); for (let i = 0; i < 4; i++) sph(0.035, mat(0xe8dcb0), Math.cos(i * 1.7) * 0.12, 0.3 + Math.sin(i * 2.3) * 0.12, 0.19, g, { seg: 8, rings: 6 }); },
  'planta-maceta'(g, d) { cyl(0.2, 0.15, 0.32, mat(0xe86a5c), 0, 0, 0, g, { seg: 16 }); bush(0, 0, g, d.color, 0.55).position.y = 0.32; },
  'planta-grande'(g, d) { cyl(0.26, 0.2, 0.42, mat(0xf2e3c9), 0, 0, 0, g, { seg: 16 }); cyl(0.04, 0.06, 1.2, mat(0x8a6a3f), 0, 0.42, 0, g, { seg: 8 }); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, leaf = box(0.12, 0.02, 0.7, mat(d.color), Math.cos(a) * 0.28, 1.55, Math.sin(a) * 0.28, g); leaf.rotation.set(0.6 * Math.sin(a), -a + Math.PI / 2, 0.6 * Math.cos(a)); } },
  cactus(g, d) { cyl(0.16, 0.12, 0.22, mat(0xc1693f), 0, 0, 0, g, { seg: 14 }); cyl(0.09, 0.1, 0.5, mat(d.color), 0, 0.22, 0, g, { seg: 10 }); sph(0.09, mat(d.color), 0, 0.72, 0, g, { seg: 10, rings: 8 }); for (const s of [-1, 1]) { cyl(0.05, 0.05, 0.18, mat(d.color), s * 0.13, 0.4, 0, g, { seg: 8 }); sph(0.05, mat(d.color), s * 0.13, 0.58, 0, g, { seg: 8, rings: 6 }); } sph(0.04, mat(0xff7ab8), 0, 0.82, 0, g, { seg: 8, rings: 6 }); },
  estante(g, d) { for (const y of [0, 0.42, 0.84]) box(1.0, 0.04, 0.38, mat(d.color), 0, y, 0, g); for (const x of [-0.48, 0.48]) box(0.04, 0.9, 0.38, mat(DARK), x, 0, 0, g); const cols = [0xe86a5c, 0x3a8fd6, 0xf2b93b, 0x2f9e8f, 0x8a5fd0]; for (let i = 0; i < 5; i++) box(0.08, 0.3, 0.26, mat(cols[i]), -0.35 + i * 0.1, 0.46, 0, g); cyl(0.07, 0.06, 0.16, mat(0xffffff), 0.3, 0.04, 0, g, { seg: 10 }); },
  librero(g, d) { box(1.2, 1.9, 0.45, mat(d.color), 0, 0, 0, g); const cols = [0xe86a5c, 0x3a8fd6, 0xf2b93b, 0x2f9e8f, 0x8a5fd0, 0xff8fb8]; for (const y of [0.15, 0.6, 1.05, 1.5]) { box(1.08, 0.36, 0.02, mat(0x5a3a22), 0, y, 0.22, g); for (let i = 0; i < 8; i++) box(0.1, 0.28 + (i % 3) * 0.03, 0.04, mat(cols[(i + y * 10) % 6 | 0]), -0.45 + i * 0.13, y + 0.02, 0.22, g); } },
  'baul-juguetes'(g, d) { slab(0.9, 0.55, 0.42, 0.06, mat(d.color), 0, 0, 0, g); slab(0.94, 0.58, 0.08, 0.06, mat(0xe86a5c), 0, 0.42, 0, g); sph(0.11, mat(0x3a8fd6), -0.2, 0.55, 0.05, g, { seg: 12, rings: 8 }); box(0.16, 0.16, 0.16, mat(0x8fd16b), 0.18, 0.5, -0.05, g, { ry: 0.4 }); },
  'alfombra-redonda'(g, d) { cyl(1.0, 1.0, 0.02, mat(d.color, { r: 1 }), 0, 0.001, 0, g, { seg: 40, cast: false }); cyl(0.74, 0.74, 0.024, mat(0xfff3d6, { r: 1 }), 0, 0.002, 0, g, { seg: 40, cast: false }); cyl(0.44, 0.44, 0.028, mat(0x2f9e8f, { r: 1 }), 0, 0.003, 0, g, { seg: 40, cast: false }); },
  'alfombra-sarape'(g) { const tex = canvasTex(256, 160, (x, w, h) => { const cols = ['#e2483d', '#f2b93b', '#2f9e8f', '#8a5fd0', '#ffffff', '#3a8fd6', '#ff7ab8']; for (let i = 0; i < 26; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * w / 26, 0, w / 26 + 1, h); } }); const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }); const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 1.6), m); p.position.y = 0.011; p.receiveShadow = true; g.add(p); },
  'cama-mascota'(g, d) { cyl(0.4, 0.4, 0.14, mat(d.color, { r: 0.9 }), 0, 0, 0, g, { seg: 24 }); cyl(0.3, 0.3, 0.06, mat(0xf5f0e6, { r: 0.95 }), 0, 0.12, 0, g, { seg: 20 }); },
  'cama-mascota-nube'(g, d) { for (const [x, z, r] of [[0, 0, 0.32], [0.22, 0.1, 0.24], [-0.22, 0.1, 0.24], [0.12, -0.2, 0.22], [-0.14, -0.2, 0.22]]) sph(r, mat(d.color, { r: 0.95 }), x, 0.1, z, g, { seg: 14, rings: 10 }).scale.y = 0.45; cyl(0.24, 0.24, 0.04, mat(0xc6d7ff), 0, 0.16, 0, g, { seg: 18 }); },
  comedero(g, d) { cyl(0.16, 0.13, 0.08, mat(d.color, { r: 0.4 }), 0, 0, 0, g, { seg: 18 }); cyl(0.12, 0.12, 0.02, mat(0xb07a3f, { r: 0.9 }), 0, 0.07, 0, g, { seg: 16 }); },
  bebedero(g, d) { cyl(0.16, 0.13, 0.08, mat(d.color, { r: 0.4 }), 0, 0, 0, g, { seg: 18 }); cyl(0.12, 0.12, 0.02, mat(0x7fd1ff, { r: 0.1, m: 0.2 }), 0, 0.07, 0, g, { seg: 16 }); },
  'percha-ave'(g, d) { cyl(0.22, 0.24, 0.05, mat(DARK), 0, 0, 0, g, { seg: 16 }); cyl(0.025, 0.025, 1.1, mat(d.color), 0, 0.05, 0, g, { seg: 8 }); box(0.5, 0.04, 0.04, mat(d.color), 0, 1.12, 0, g); box(0.34, 0.03, 0.03, mat(d.color), 0, 0.75, 0, g, { ry: Math.PI / 2 }); cyl(0.06, 0.05, 0.05, mat(0xe86a5c), 0.2, 1.16, 0, g, { seg: 10 }); },
  rascador(g, d) { slab(0.6, 0.6, 0.06, 0.06, mat(0xf5f0e6), 0, 0, 0, g); cyl(0.08, 0.08, 0.7, mat(d.color, { r: 1 }), 0, 0.06, 0, g, { seg: 12 }); slab(0.42, 0.42, 0.06, 0.06, mat(0xf5f0e6), 0, 0.76, 0, g); sph(0.05, mat(0xff7ab8), 0.15, 0.6, 0.1, g, { seg: 8, rings: 6 }); }
};
const PICTURES = { paisaje: (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7cc7ff'); gr.addColorStop(1, '#d9f2ff'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#5bb36b'; x.beginPath(); x.moveTo(0, h); x.lineTo(w * 0.3, h * 0.45); x.lineTo(w * 0.55, h * 0.8); x.lineTo(w * 0.8, h * 0.35); x.lineTo(w, h); x.fill(); x.fillStyle = '#ffd166'; x.beginPath(); x.arc(w * 0.8, h * 0.2, h * 0.1, 0, 7); x.fill(); },
  picado: (x, w, h) => { const cols = ['#ff4fa3', '#ffd166', '#2f9e8f', '#3a8fd6', '#8a5fd0']; x.fillStyle = '#fff6e0'; x.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { x.fillStyle = cols[i]; x.fillRect(i * w / 5 + 4, 10, w / 5 - 8, h - 20); x.fillStyle = '#fff6e0'; for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * w / 5 + w / 10, 30 + j * (h - 50) / 3, 7, 0, 7); x.fill(); } } },
  estrellas: (x, w, h) => { x.fillStyle = '#22345c'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd166'; for (let i = 0; i < 18; i++) { x.beginPath(); x.arc((i * 53) % w, (i * 37) % h, 2 + (i % 3), 0, 7); x.fill(); } x.fillStyle = '#fff3c2'; x.beginPath(); x.arc(w * 0.7, h * 0.35, h * 0.16, 0, 7); x.fill(); } };

/** Mueble listo para colocar (grupo con la huella centrada en el origen). */
export function buildFurniture(id) {
  const d = itemById(id); const g = new THREE.Group(); g.userData.item = id;
  if (!d) return g;
  if (d.layer === 'wall') {
    // cuadro: el grupo queda en la pared; el lienzo mira hacia el interior (+Z local)
    const [w] = d.size, h = w * 0.72;
    box(w + 0.08, h + 0.08, 0.04, mat(DARK), 0, 1.45 - (h + 0.08) / 2, 0.02, g);
    const tex = canvasTex(256, 184, PICTURES[d.design] || PICTURES.paisaje);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); pic.position.set(0, 1.45, 0.045); g.add(pic);
  } else (BUILD[id] || ((gg) => box(...d.size.slice(0, 1), 0.5, d.size[1], mat(d.color), 0, 0, 0, gg)))(g, d);
  mergeStatic(g);
  return g;
}

/** Libera un mueble (texturas y materiales propios; los compartidos se quedan). */
export function disposeFurniture(g) {
  g.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); const m = o.material; if (m && !m.userData.shared) { m.map?.dispose(); m.dispose(); } });
}
