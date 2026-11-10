// Edificios de la ciudad. Cada uno tiene identidad propia (paleta, remate y señalización).
// Las ventanas van pintadas en la textura de la fachada para mantener pocas mallas en celular.
import * as THREE from '../three.js';
import { mat, box, cyl, sph, plane, slab, sign, facadeTexture, shade } from './kit.js';

/**
 * Catálogo de edificios. `side` indica hacia dónde mira la fachada:
 *   'S' mira a +Z, 'N' mira a -Z, 'E' mira a +X, 'W' mira a -X (siempre hacia la plaza).
 * status: 'open' (se puede entrar), 'soon' (planeado, aún sin interior).
 */
export const BUILDINGS = [
  { id: 'banco', name: 'Banco ICADEM', mission: 'El crédito correcto', x: -13, z: -28, w: 14, d: 10, h: 8.5, side: 'S', style: 'bank', status: 'open',
    wall: '#f6d77a', trim: '#c9952a', roof: 0xb9822a, signBg: '#7a5410', signFg: '#ffe9a8' },
  { id: 'tribunal', name: 'Tribunal ICADEM', mission: 'Tú eres el juez', x: 13, z: -28, w: 14, d: 10, h: 8.5, side: 'S', style: 'court', status: 'soon',
    wall: '#c79463', trim: '#7d5330', roof: 0x1f3a6e, signBg: '#1f3a6e', signFg: '#ffffff' },
  { id: 'hospital', name: 'Hospital ICADEM', mission: 'Turno de decisiones', x: -31, z: -28, w: 13, d: 10, h: 10, side: 'S', style: 'hospital', status: 'soon',
    wall: '#fbfdfd', trim: '#2bb5a0', roof: 0x2bb5a0, signBg: '#178f7e', signFg: '#ffffff', glass: '#bff1ea' },
  { id: 'torre', name: 'Torre ICADEM', mission: 'Desafío de equipos', x: 31, z: -28, w: 10, d: 10, h: 21, side: 'S', style: 'tower', status: 'soon',
    wall: '#7f8cf5', trim: '#4b55c7', roof: 0x3a43a8, signBg: '#3a43a8', signFg: '#ffffff', glass: '#d8e2ff', rows: 7, cols: 3 },
  { id: 'veterinaria', name: 'Clínica Veterinaria', mission: 'Guardianes del bienestar', x: -31, z: 28, w: 12, d: 9, h: 6.5, side: 'N', style: 'vet', status: 'soon',
    wall: '#bfe8f7', trim: '#3c9fc9', roof: 0xf08aa8, signBg: '#3c9fc9', signFg: '#ffffff' },
  { id: 'casa', name: 'Tu casa', mission: 'Habitación y misiones', x: -13, z: 28, w: 9, d: 8, h: 6, side: 'N', style: 'home', status: 'open',
    wall: '#ffe2c2', trim: '#e86a5c', roof: 0xe86a5c, signBg: '#2f9e8f', signFg: '#ffffff', cols: 3, rows: 2 },
  { id: 'restaurante', name: 'Restaurante', mission: 'Cocina contra reloj', x: 13, z: 28, w: 12, d: 9, h: 6.5, side: 'N', style: 'restaurant', status: 'soon',
    wall: '#fff0d6', trim: '#f08a24', roof: 0xd9452f, signBg: '#d9452f', signFg: '#fff0d6' },
  { id: 'supermercado', name: 'Supermercado', mission: 'Rescate de inventario', x: 31, z: 28, w: 13, d: 10, h: 6.5, side: 'N', style: 'market', status: 'soon',
    wall: '#ff8f6b', trim: '#b8452a', roof: 0x7a2d1a, signBg: '#ffffff', signFg: '#d9452f', cols: 5, rows: 1 },
  { id: 'invernadero', name: 'Invernadero', mission: 'Cultivo inteligente', x: -35, z: -9, w: 10, d: 11, h: 5, side: 'E', style: 'greenhouse', status: 'soon',
    wall: '#bfe9c8', trim: '#3f9a4d', roof: 0x3f9a4d, signBg: '#2f7d3c', signFg: '#ffffff' },
  { id: 'oficina', name: 'Oficina ICADEM', mission: 'El expediente perdido', x: -35, z: 9, w: 10, d: 11, h: 11, side: 'E', style: 'office', status: 'soon',
    wall: '#5ec8e6', trim: '#1d7fa3', roof: 0x12617f, signBg: '#12617f', signFg: '#ffffff', glass: '#e2f8ff', rows: 4, cols: 4 },
  { id: 'obra', name: 'Obra en construcción', mission: 'Inspector de seguridad', x: 35, z: -9, w: 10, d: 11, h: 8, side: 'W', style: 'site', status: 'soon',
    wall: '#c9cdd6', trim: '#f2b93b', roof: 0x8d93a1, signBg: '#f2b93b', signFg: '#1d2433' }
];

export const buildingById = id => BUILDINGS.find(b => b.id === id);

const ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

/** Punto frente a la puerta, a `dist` metros de la fachada, en coordenadas del mundo. */
export function doorPoint(b, dist = 1.6) {
  const off = b.d / 2 + dist;
  if (b.side === 'S') return { x: b.x, z: b.z + off, yaw: Math.PI };
  if (b.side === 'N') return { x: b.x, z: b.z - off, yaw: 0 };
  if (b.side === 'E') return { x: b.x + off, z: b.z, yaw: -Math.PI / 2 };
  return { x: b.x - off, z: b.z, yaw: Math.PI / 2 };
}
/** Huella en el mundo (para colisiones y mapa). */
export function footprint(b) {
  const turned = b.side === 'E' || b.side === 'W';
  return { w: turned ? b.d : b.w, d: turned ? b.w : b.d };
}

function facadeMaterials(b) {
  const wall = b.wall, glass = b.glass || '#bfe3ff';
  const lit = b.style === 'tower' ? [2, 4, 7, 9, 12, 16, 19] : [];
  const front = facadeTexture({ wall, trim: b.trim, glass, cols: b.cols || 4, rows: b.rows || 2, groundFloor: 0.4, stripe: b.trim, lit });
  const sideT = facadeTexture({ wall, trim: b.trim, glass, cols: Math.max(2, (b.cols || 4) - 1), rows: b.rows || 2, groundFloor: 0.18, lit });
  const f = mat(0xffffff, { map: front, r: 0.85 }), s = mat(0xffffff, { map: sideT, r: 0.85 }), top = mat(b.roof, { r: 0.9 });
  // orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z
  return [s, s, top, top, f, s];
}

export function buildBuilding(b, parent) {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.z); g.rotation.y = ROT[b.side];
  parent.add(g);
  const { w, d, h } = b, front = d / 2;
  const trim = mat(parseInt(b.trim.slice(1), 16), { r: 0.7 }), roofM = mat(b.roof, { r: 0.85 });
  const white = mat(0xffffff, { r: 0.6 }), dark = mat(0x1d2433, { r: 0.5 });

  if (b.style !== 'greenhouse' && b.style !== 'site') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facadeMaterials(b));
    body.position.y = h / 2 + 0.3; body.castShadow = true; body.receiveShadow = true; g.add(body);
    box(w + 0.5, 0.3, d + 0.5, mat(parseInt(shade(b.wall, -40).slice(1), 16), { r: 0.9 }), 0, 0, 0, g);
    box(w + 0.6, 0.35, d + 0.6, trim, 0, h + 0.3, 0, g);
  }

  /* puerta común */
  const doorW = b.style === 'bank' ? 2.6 : 2.0, doorH = b.style === 'bank' ? 3.4 : 2.7;
  if (b.style !== 'site' && b.style !== 'greenhouse') {
    box(doorW + 0.5, doorH + 0.3, 0.2, trim, 0, 0.3, front + 0.02, g);
    const doorMat = mat(b.status === 'open' ? 0x2a1d14 : 0x39445a, { r: 0.4, m: 0.2 });
    for (const s of [-1, 1]) {
      box(doorW / 2 - 0.05, doorH, 0.1, doorMat, s * doorW / 4, 0.3, front + 0.1, g);
      box(doorW / 2 - 0.5, doorH * 0.5, 0.04, mat(0xbfe3ff, { r: 0.1, m: 0.6, e: 0x4a7fb0, ei: 0.25 }), s * doorW / 4, 0.3 + doorH * 0.38, front + 0.16, g, { cast: false });
      cyl(0.035, 0.035, 0.5, mat(0xffd166, { m: 0.7, r: 0.3 }), s * 0.14, 1.3, front + 0.2, g, { seg: 8 });
    }
    slab(doorW + 1.6, 1.5, 0.08, 0.2, mat(0xd9452f, { r: 1 }), 0, 0.3, front + 0.85, g, { cast: false });
  }

  /* remates por estilo */
  if (b.style === 'bank') {
    for (let i = 0; i < 3; i++) box(w + 1.2 - i * 0.5, 0.2, 2.6 - i * 0.6, white, 0, i * 0.2 - 0.1, front + 1.3 - i * 0.3, g);
    for (const x of [-5.4, -3.2, 3.2, 5.4]) {
      cyl(0.42, 0.42, 0.25, white, x, 0.5, front + 1.4, g, { seg: 16 });
      cyl(0.33, 0.36, h - 1.0, white, x, 0.75, front + 1.4, g, { seg: 16 });
      cyl(0.46, 0.36, 0.3, mat(0xffd166, { m: 0.6, r: 0.35 }), x, h - 0.25, front + 1.4, g, { seg: 16 });
    }
    box(w + 0.8, 0.5, 2.9, white, 0, h + 0.05, front + 0.85, g);
    const tri = new THREE.Shape(); tri.moveTo(-w / 2 - 0.4, 0); tri.lineTo(w / 2 + 0.4, 0); tri.lineTo(0, 2.6); tri.closePath();
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 2.9, bevelEnabled: false }), mat(0xf6d77a, { r: 0.8 }));
    ped.position.set(0, h + 0.55, front - 0.6); ped.castShadow = true; g.add(ped);
    const coin = cyl(0.85, 0.85, 0.16, mat(0xffd166, { m: 0.75, r: 0.25, e: 0x8a6510, ei: 0.3 }), 0, h + 1.35, front + 2.34, g, { seg: 28, rx: Math.PI / 2 });
    coin.userData.spin = true;
    const dollar = sign('$', 0.9, 0.9, { bg: 'rgba(0,0,0,0)', fg: '#8a6510', radius: 0 }); dollar.position.set(0, h + 1.43, front + 2.43); g.add(dollar);
  }
  if (b.style === 'court') {
    for (let i = 0; i < 3; i++) box(w + 1.0 - i * 0.5, 0.2, 2.4 - i * 0.6, mat(0xe6dccb), 0, i * 0.2 - 0.1, front + 1.2 - i * 0.3, g);
    for (const x of [-5.2, -2.6, 2.6, 5.2]) cyl(0.3, 0.34, h - 0.5, mat(0x8a5a36, { r: 0.7 }), x, 0.5, front + 1.2, g, { seg: 14 });
    box(w + 0.6, 0.6, 2.6, roofM, 0, h, front + 0.7, g);
    const dome = sph(3.1, roofM, 0, h + 0.6, 0, g, { seg: 26, rings: 16 }); dome.scale.y = 0.72;
    cyl(0.12, 0.12, 1.4, mat(0xffd166, { m: 0.7, r: 0.3 }), 0, h + 2.7, 0, g, { seg: 8 });
    sph(0.26, mat(0xffd166, { m: 0.7, r: 0.3 }), 0, h + 4.2, 0, g);
  }
  if (b.style === 'hospital') {
    box(4.6, 0.3, 2.4, roofM, 0, 3.4, front + 1.2, g);
    for (const x of [-2, 2]) cyl(0.13, 0.13, 3.1, white, x, 0.3, front + 2.1, g, { seg: 10 });
    const crossM = mat(0xff5a5f, { e: 0xff5a5f, ei: 0.5, r: 0.5 });
    box(0.6, 2.0, 0.25, crossM, 0, h - 2.6, front + 0.14, g); box(2.0, 0.6, 0.25, crossM, 0, h - 1.9, front + 0.14, g);
    box(3.2, 0.25, 3.2, white, 3.6, h + 0.65, -1.5, g); const hp = sign('H', 1.6, 1.6, { bg: '#2bb5a0', fg: '#ffffff', radius: 100 }); hp.rotation.x = -Math.PI / 2; hp.position.set(3.6, h + 0.92, -1.5); g.add(hp);
  }
  if (b.style === 'tower') {
    box(w - 2.4, 3.2, d - 2.4, mat(0x5a66e0, { r: 0.6 }), 0, h + 0.65, 0, g);
    cyl(0.12, 0.2, 4.5, white, 0, h + 3.85, 0, g, { seg: 10 });
    const beacon = sph(0.32, mat(0xff5a5f, { e: 0xff5a5f, ei: 1.6, own: true }), 0, h + 8.5, 0, g, { cast: false }); beacon.userData.blink = true;
    box(w + 0.8, 0.5, 2.2, roofM, 0, 3.5, front + 1.1, g);
  }
  if (b.style === 'vet') {
    box(w + 0.4, 0.4, 2.0, roofM, 0, 3.3, front + 0.9, g, { rx: 0.14 });
    const paw = sign('●', 1.5, 1.5, { bg: '#ffffff', fg: '#f08aa8', radius: 100 }); paw.position.set(-w / 2 + 1.6, h - 1.2, front + 0.04); g.add(paw);
    const roofShape = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.2, 2.6, 4), roofM); roofShape.position.y = h + 1.95; roofShape.rotation.y = Math.PI / 4; roofShape.scale.z = d / w; roofShape.castShadow = true; g.add(roofShape);
  }
  if (b.style === 'home') {
    const rs = new THREE.Shape(); rs.moveTo(-w / 2 - 0.6, 0); rs.lineTo(w / 2 + 0.6, 0); rs.lineTo(0, 3.2); rs.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: d + 1.0, bevelEnabled: false }), roofM);
    roof.position.set(0, h + 0.6, -d / 2 - 0.5); roof.castShadow = true; g.add(roof);
    box(0.9, 2.2, 0.9, mat(0xc9553f), w / 2 - 1.6, h + 1.0, -1, g);
    box(3.2, 0.25, 1.6, roofM, 0, 3.2, front + 0.75, g, { rx: 0.2 });
    for (const x of [-1.4, 1.4]) cyl(0.09, 0.09, 2.9, white, x, 0.3, front + 1.35, g, { seg: 8 });
  }
  if (b.style === 'restaurant') {
    for (let i = 0; i < 6; i++) box((w + 0.4) / 6, 0.14, 2.3, mat(i % 2 ? 0xffffff : 0xd9452f, { r: 0.9 }), -w / 2 - 0.2 + (i + 0.5) * (w + 0.4) / 6, 3.35, front + 1.05, g, { rx: 0.2 });
    for (const x of [-3.4, 3.4]) {
      cyl(0.6, 0.6, 0.06, white, x, 0.9, front + 2.4, g, { seg: 18 }); cyl(0.06, 0.06, 0.6, dark, x, 0.3, front + 2.4, g, { seg: 8 });
      for (const s of [-1, 1]) { cyl(0.22, 0.22, 0.06, mat(0xf08a24), x + s * 0.85, 0.72, front + 2.4, g, { seg: 12 }); cyl(0.04, 0.04, 0.42, dark, x + s * 0.85, 0.3, front + 2.4, g, { seg: 6 }); }
    }
    cyl(0.5, 0.5, 1.1, white, w / 2 - 1.6, h + 0.65, -1, g, { seg: 14 }); sph(0.62, white, w / 2 - 1.6, h + 1.85, -1, g);
  }
  if (b.style === 'market') {
    box(w + 0.6, 1.5, 0.4, mat(0xffffff, { r: 0.7 }), 0, h - 0.4, front + 0.2, g);
    box(w + 0.8, 0.3, 2.4, roofM, 0, 3.4, front + 1.1, g);
    for (const [x, c] of [[-4.6, 0xf2b93b], [-3.5, 0x6fae45], [3.5, 0xe86a5c], [4.6, 0xf08a24]]) { box(0.9, 0.7, 0.9, mat(0xc98f56), x, 0.3, front + 1.3, g); for (let i = 0; i < 4; i++) sph(0.2, mat(c, { r: 0.6 }), x - 0.2 + (i % 2) * 0.4, 1.15, front + 1.1 + Math.floor(i / 2) * 0.4, g, { seg: 10, rings: 8 }); }
  }
  if (b.style === 'office') {
    box(w + 0.8, 0.5, 2.2, roofM, 0, 3.5, front + 1.1, g);
    box(w - 3, 1.4, d - 3, mat(0x1d7fa3, { r: 0.6 }), 0, h + 0.65, 0, g);
    for (const x of [-3, 3]) cyl(0.4, 0.4, 0.5, mat(0xdfe4ee, { m: 0.5, r: 0.4 }), x, h + 0.65, -2.5, g, { seg: 12 });
  }
  if (b.style === 'greenhouse') {
    box(w, 0.6, d, mat(0x8a5a36, { r: 0.9 }), 0, 0, 0, g);
    const glassM = new THREE.MeshStandardMaterial({ color: 0xd6f5e0, transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0.2, side: THREE.DoubleSide });
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, d, 24, 1, false, -Math.PI / 2, Math.PI), glassM);
    arch.rotation.x = Math.PI / 2; arch.position.y = 0.6; arch.castShadow = false; g.add(arch);
    for (let i = 0; i <= 4; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.07, 6, 24, Math.PI), trim); rib.position.set(0, 0.6, -d / 2 + i * d / 4); g.add(rib); }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const px = -2.8 + c * 2.8, pz = -3.4 + r * 3.2; box(1.5, 0.35, 1.9, mat(0x6b4a2b), px, 0.6, pz, g); for (let k = 0; k < 4; k++) sph(0.34, mat([0x4fae5a, 0x6cc671, 0x3f9a4d][(r + c + k) % 3], { flat: true }), px - 0.4 + (k % 2) * 0.8, 1.2, pz - 0.5 + Math.floor(k / 2) * 1.0, g, { seg: 7, rings: 5 }); }
    box(2.4, 2.8, 0.2, trim, 0, 0.6, front + 0.02, g); box(2.0, 2.5, 0.12, mat(0xbfe9c8, { r: 0.2, m: 0.3 }), 0, 0.6, front + 0.1, g);
  }
  if (b.style === 'site') {
    const conc = mat(0xc9cdd6, { r: 0.95 }), steel = mat(0xf2b93b, { r: 0.5, m: 0.3 });
    box(w, 0.4, d, conc, 0, 0, 0, g);
    for (let f = 0; f < 2; f++) { box(w - 1, 0.3, d - 1, conc, 0, 3.4 + f * 3.2, 0, g); for (const x of [-w / 2 + 0.9, 0, w / 2 - 0.9]) for (const z of [-d / 2 + 0.9, d / 2 - 0.9]) box(0.5, 3.2, 0.5, conc, x, 0.4 + f * 3.2, z, g); }
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) for (let y = 0; y < 3; y++) { box(0.08, 2.2, 0.08, steel, x, 0.4 + y * 2.2, front + 0.5, g); box(w - 0.6, 0.08, 0.6, mat(0xb9793f), 0, 0.4 + (y + 1) * 2.2 - 0.1, front + 0.5, g); }
    const crane = new THREE.Group(); crane.position.set(w / 2 - 1.2, 0.4, -d / 2 + 1.4); g.add(crane);
    box(1.4, 0.5, 1.4, conc, 0, 0, 0, crane); box(0.5, 15, 0.5, steel, 0, 0.5, 0, crane);
    const jib = new THREE.Group(); jib.position.y = 15.5; crane.add(jib); jib.userData.rotate = 0.12;
    box(0.4, 0.4, 13, steel, 0, 0, 4, jib); box(0.9, 0.9, 1.6, mat(0x8d93a1), 0, -0.2, -2.6, jib); box(1.1, 1.1, 1.1, mat(0x2a3550), 0, 0.4, 0, jib);
    cyl(0.03, 0.03, 5, dark, 0, -5, 8.5, jib, { seg: 6 }); box(0.9, 0.7, 0.9, mat(0xd9452f), 0, -5.7, 8.5, jib);
    for (const x of [-3, 0, 3]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 10), mat(0xf08a24)); cone.position.set(x, 0.3, front + 2.2); cone.castShadow = true; g.add(cone); }
    for (let i = 0; i < 5; i++) box(w / 5 - 0.1, 0.9, 0.08, mat(i % 2 ? 0xf2b93b : 0x1d2433), -w / 2 + (i + 0.5) * w / 5, 0.25, front + 1.5, g);
  }

  /* letrero */
  const sg = sign(b.name.toUpperCase(), Math.min(w - 1, 8.4), 1.15, { bg: b.signBg, fg: b.signFg, border: b.signFg });
  const signY = b.style === 'bank' ? h - 1.3 : b.style === 'tower' ? 5.0 : b.style === 'site' ? 3.0 : b.style === 'greenhouse' ? 4.3 : Math.min(h - 0.4, 4.6);
  sg.position.set(0, signY, front + (b.style === 'bank' ? 0.2 : b.style === 'site' ? 1.0 : b.style === 'greenhouse' ? 0.3 : 0.24));
  if (['restaurant', 'tower', 'office', 'market', 'home', 'vet', 'hospital'].includes(b.style)) sg.position.y = Math.max(signY, 4.25);
  if (b.style === 'market') sg.position.set(0, h - 0.35 + 0.75, front + 0.42);
  g.add(sg);
  if (b.status === 'soon') { const soon = sign('PRÓXIMAMENTE', 2.6, 0.5, { bg: '#1d2433', fg: '#ffd166' }); soon.position.set(0, 2.5, front + (b.style === 'site' ? 1.56 : b.style === 'greenhouse' ? 0.2 : 0.3)); if (b.style === 'site') soon.position.y = 1.5; g.add(soon); }

  g.userData.building = b;
  return g;
}
