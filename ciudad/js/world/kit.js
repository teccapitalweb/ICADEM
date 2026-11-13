// Kit de construcción: materiales, texturas generadas en lienzo y piezas reutilizables.
// Todo el arte es original y se genera por código (sin recursos de terceros).
import * as THREE from '../three.js';

export const FONT = '"Outfit", "Segoe UI", system-ui, sans-serif';

const MAT_CACHE = new Map();

/**
 * Recorte de obstáculos: lo que queda entre la cámara y el jugador se vuelve translúcido
 * (tramado) dentro de un cono, así un árbol, un muro o una columna nunca tapan al avatar.
 * Se resuelve en el sombreador, sin lanzar rayos, y funciona también con mallas fusionadas.
 * `CUTOUT.player` es la posición del pecho del jugador en espacio de cámara.
 */
export const CUTOUT = { player: { value: new THREE.Vector3(0, 0, -6) }, radius: { value: 1.25 } };
export function withCutout(material) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uCutPlayer = CUTOUT.player;
    shader.uniforms.uCutRadius = CUTOUT.radius;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCutPlayer;\nuniform float uCutRadius;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (uCutRadius > 0.0) {
    vec3 cutF = -vViewPosition;
    float cutT = dot(cutF, uCutPlayer) / dot(uCutPlayer, uCutPlayer);
    float cutN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (cutT > 0.015 && cutT < 0.86) {
      float cutD = length(cutF - uCutPlayer * cutT);
      float cutR = uCutRadius * mix(0.45, 1.0, cutT);
      // centro despejado y borde tramado suave: se ve al avatar y lo que tiene delante
      if (cutD < cutR * (0.55 + 0.45 * cutN)) discard;
    }
    // Lo que queda pegado al lente (postes, faroles, ramas) se desvanece; el piso nunca.
    float camD = length(cutF);
    if (camD < 3.2) {
      vec3 cutFn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
      vec3 cutUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      if (abs(dot(cutFn, cutUp)) < 0.7 && cutN > (camD - 0.7) / 2.5) discard;
    }
  }`);
  };
  material.customProgramCacheKey = () => 'ciudad-cutout';
  return material;
}
/**
 * Material estándar. Los materiales lisos (sin textura) se comparten entre mallas para poder
 * fusionarlas después; usa `own: true` cuando el material se vaya a modificar en tiempo real.
 */
export function mat(color, o = {}) {
  const wrap = o.solid ? m => m : withCutout;   // `solid`: nunca se recorta (avatares)
  const make = () => wrap(new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.82, metalness: o.m ?? 0, flatShading: Boolean(o.flat),
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: o.opacity !== undefined, opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide, map: o.map || null
  }));
  if (o.map || o.own) return make();
  const key = [color, o.r ?? 0.82, o.m ?? 0, o.flat ? 1 : 0, o.e ?? 0, o.ei ?? 1, o.opacity ?? 1, o.side ?? 0, o.solid ? 1 : 0].join('|');
  let m = MAT_CACHE.get(key);
  if (!m) { m = make(); m.userData.shared = true; MAT_CACHE.set(key, m); }
  return m;
}

/**
 * Fusiona las mallas estáticas que comparten material en una sola por material.
 * Reduce drásticamente las llamadas de dibujo (clave para celulares). No toca lo marcado
 * como dinámico, letreros, materiales con textura o transparentes.
 */
export function mergeStatic(root, { deep = true } = {}) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert(), local = new THREE.Matrix4();
  const dynamic = o => { for (let p = o; p && p !== root; p = p.parent) { const u = p.userData; if (u.dynamic || u.spin || u.blink || u.rotate || u.isSign || u.isMarker) return true; } return false; };
  const buckets = new Map();
  const visit = fn => { if (deep) root.traverse(fn); else root.children.forEach(fn); };
  visit(o => {
    if (!o.isMesh || Array.isArray(o.material) || dynamic(o)) return;
    const m = o.material;
    if (!m.isMeshStandardMaterial || !m.userData.shared || m.transparent || m.map || !o.geometry.attributes.normal) return;
    const key = m.uuid + (o.castShadow ? ':c' : ':n') + (o.receiveShadow ? 'r' : 'x');
    (buckets.get(key) || buckets.set(key, []).get(key)).push(o);
  });
  let merged = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const parts = [];
    let total = 0;
    for (const o of list) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(local.multiplyMatrices(inverse, o.matrixWorld));
      parts.push(g); total += g.attributes.position.count;
    }
    const position = new Float32Array(total * 3), normal = new Float32Array(total * 3);
    let offset = 0;
    for (const g of parts) { position.set(g.attributes.position.array, offset); normal.set(g.attributes.normal.array, offset); offset += g.attributes.position.count * 3; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    const mesh = new THREE.Mesh(geo, list[0].material);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    for (const o of list) { o.parent.remove(o); o.geometry.dispose(); }
    root.add(mesh); merged += list.length;
  }
  return merged;
}

function place(mesh, x, y, z, parent, o = {}) {
  mesh.position.set(x, y, z);
  mesh.castShadow = o.cast ?? true;
  mesh.receiveShadow = o.receive ?? true;
  if (o.rx) mesh.rotation.x = o.rx;
  if (o.ry) mesh.rotation.y = o.ry;
  if (o.rz) mesh.rotation.z = o.rz;
  if (parent) parent.add(mesh);
  return mesh;
}

/** Caja apoyada en `y` (base), centrada en x/z. */
export function box(w, h, d, material, x, y, z, parent, o) {
  return place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y + h / 2, z, parent, o);
}
/** Cilindro apoyado en `y` (base). */
export function cyl(rt, rb, h, material, x, y, z, parent, o = {}) {
  return place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20, 1, Boolean(o.open)), material), x, y + h / 2, z, parent, o);
}
export function sph(r, material, x, y, z, parent, o = {}) {
  return place(new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 20, o.rings ?? 14), material), x, y, z, parent, o);
}
export function ico(r, material, x, y, z, parent, o = {}) {
  return place(new THREE.Mesh(new THREE.IcosahedronGeometry(r, o.detail ?? 1), material), x, y, z, parent, o);
}
export function plane(w, h, material, x, y, z, parent, o = {}) {
  return place(new THREE.Mesh(new THREE.PlaneGeometry(w, h), material), x, y, z, parent, { cast: false, ...o });
}
/** Losa con esquinas redondeadas (vista desde arriba), apoyada en `y`. */
export function slab(w, d, h, radius, material, x, y, z, parent, o = {}) {
  const s = new THREE.Shape(), hw = w / 2, hd = d / 2, r = Math.min(radius, hw, hd);
  s.moveTo(-hw + r, -hd); s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r); s.quadraticCurveTo(hw, hd, hw - r, hd); s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r); s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  return place(new THREE.Mesh(g, material), x, y, z, parent, o);
}

/* ---------- texturas en lienzo ---------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function finish(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, colors, n, minR, maxR, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(rnd() * colors.length)];
    g.globalAlpha = 0.25 + rnd() * 0.5;
    g.beginPath(); g.arc(rnd() * w, rnd() * h, minR + rnd() * (maxR - minR), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}
export function grassTexture(rx, ry) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#7cc66b'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, ['#6ab85b', '#8fd47c', '#74c263', '#9bdc88'], 900, 1.5, 5);
  return finish(c, rx, ry);
}
export function pavingTexture(rx, ry, a = '#ecdcc0', b = '#e3d0b0', line = '#cdb894') {
  const [c, g] = canvas(256, 256);
  g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x + y) % 2 ? a : b;
    g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
  }
  g.strokeStyle = line; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  speckle(g, 256, 256, ['#ffffff', line], 120, 0.6, 1.8, 11);
  return finish(c, rx, ry);
}
export function roadTexture(rx, ry) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#5d6577'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, ['#687186', '#535b6c', '#727b90'], 700, 0.8, 2.6, 3);
  return finish(c, rx, ry);
}
export function plankTexture(rx, ry, base = '#c98f56', dark = '#a9713d') {
  const [c, g] = canvas(256, 256);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? base : '#d39b63'; g.fillRect(0, i * 64, 256, 64);
    g.strokeStyle = dark; g.lineWidth = 3; g.strokeRect(-4, i * 64, 264, 64);
    g.beginPath(); g.moveTo(i % 2 ? 90 : 170, i * 64); g.lineTo(i % 2 ? 90 : 170, i * 64 + 64); g.stroke();
    g.globalAlpha = 0.18; g.strokeStyle = '#7d4f25'; g.lineWidth = 1;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(0, i * 64 + 8 + k * 11); g.bezierCurveTo(80, i * 64 + 2 + k * 11, 170, i * 64 + 16 + k * 11, 256, i * 64 + 8 + k * 11); g.stroke(); }
    g.globalAlpha = 1;
  }
  return finish(c, rx, ry);
}
export function checkerTexture(rx, ry, a, b, vein = 'rgba(255,255,255,.35)') {
  const [c, g] = canvas(256, 256);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * 128, y * 128, 128, 128); }
  g.strokeStyle = vein; g.lineWidth = 1.5;
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) { g.beginPath(); const x = rnd() * 256, y = rnd() * 256; g.moveTo(x, y); g.bezierCurveTo(x + 30, y + rnd() * 40, x + 50, y - rnd() * 30, x + 80, y + rnd() * 30); g.stroke(); }
  return finish(c, rx, ry);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Fachada con ventanas pintadas: una sola textura por cara en vez de decenas de mallas. */
export function facadeTexture({ w = 512, h = 512, wall, trim, glass = '#bfe3ff', cols = 4, rows = 3, groundFloor = 0.3, stripe = null, lit = [] }) {
  const [c, g] = canvas(w, h);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, wall); grd.addColorStop(1, shade(wall, -18));
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const top = h * 0.07, usable = h * (1 - groundFloor) - top;
  const cw = w / cols, rh = usable / rows;
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
    const x = i * cw + cw * 0.2, y = top + r * rh + rh * 0.16, ww = cw * 0.6, hh = rh * 0.64;
    g.fillStyle = trim; roundRect(g, x - 5, y - 5, ww + 10, hh + 10, 9); g.fill();
    const on = lit.includes(r * cols + i);
    const gg = g.createLinearGradient(x, y, x + ww, y + hh);
    gg.addColorStop(0, on ? '#fff3c4' : shade(glass, 18)); gg.addColorStop(1, on ? '#ffd774' : shade(glass, -26));
    g.fillStyle = gg; roundRect(g, x, y, ww, hh, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(x + 6, y + hh - 6); g.lineTo(x + ww * 0.45, y + 6); g.lineTo(x + ww * 0.62, y + 6); g.lineTo(x + 6 + ww * 0.18, y + hh - 6); g.closePath(); g.fill();
    g.strokeStyle = trim; g.lineWidth = 4; g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + hh); g.stroke();
  }
  if (stripe) { g.fillStyle = stripe; g.fillRect(0, h * (1 - groundFloor) - 10, w, 14); }
  g.fillStyle = shade(wall, -34); g.fillRect(0, h - 16, w, 16);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, v + amt));
  return '#' + ((1 << 24) + (f(n >> 16) << 16) + (f((n >> 8) & 255) << 8) + f(n & 255)).toString(16).slice(1);
}

/** Letrero plano con texto. Material sin iluminación para que siempre se lea. */
export function sign(text, wM, hM, o = {}) {
  const px = 128, w = Math.round(wM * px), h = Math.round(hM * px);
  const [c, g] = canvas(Math.min(2048, w), Math.min(1024, h));
  const sx = c.width / w; g.scale(sx, sx);
  g.fillStyle = o.bg || '#12325f'; roundRect(g, 0, 0, w, h, o.radius ?? h * 0.22); g.fill();
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = h * 0.07; roundRect(g, h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1, (o.radius ?? h * 0.22) * 0.8); g.stroke(); }
  g.fillStyle = o.fg || '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = o.size ? o.size * px : h * 0.52;
  g.font = `${o.weight || 800} ${size}px ${FONT}`;
  while (g.measureText(text).width > w * 0.86 && size > 10) { size *= 0.94; g.font = `${o.weight || 800} ${size}px ${FONT}`; }
  g.fillText(text, w / 2, o.sub ? h * 0.4 : h * 0.53);
  if (o.sub) { g.font = `600 ${h * 0.2}px ${FONT}`; g.globalAlpha = 0.85; g.fillText(o.sub, w / 2, h * 0.76); g.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
  m.userData.isSign = true;
  return m;
}

/** Punto redondo y suave para partículas (gotas, hojas): sin él se ven como cuadros al acercarse. */
let DOT = null;
export function dotTexture() {
  if (DOT) return DOT;
  const [c, g] = canvas(64, 64), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
  DOT = new THREE.CanvasTexture(c); DOT.colorSpace = THREE.SRGBColorSpace; return DOT;
}

/* ---------- piezas de escenario ---------- */
export function tree(x, z, parent, o = {}) {
  const g = new THREE.Group(), s = o.scale ?? 1;
  const leaf = mat(o.color ?? 0x4fae5a, { flat: true, r: 0.9 }), leaf2 = mat(o.color2 ?? 0x6cc671, { flat: true, r: 0.9 });
  cyl(0.16 * s, 0.24 * s, 1.5 * s, mat(0x8a5a36, { r: 0.95 }), 0, 0, 0, g, { seg: 8 });
  ico(1.15 * s, leaf, 0, 2.2 * s, 0, g);
  ico(0.85 * s, leaf2, 0.55 * s, 2.9 * s, 0.2 * s, g);
  ico(0.8 * s, leaf, -0.5 * s, 2.75 * s, -0.25 * s, g);
  ico(0.6 * s, leaf2, 0.05 * s, 3.45 * s, 0, g);
  g.position.set(x, 0, z); g.rotation.y = (x * 12.9898 + z * 78.233) % 6.28;
  g.userData.sway = { phase: x * 0.7 + z * 0.3, amp: 0.02 };
  parent.add(g);
  return g;
}
export function bush(x, z, parent, color = 0x58b565, s = 1) {
  const g = new THREE.Group(), m = mat(color, { flat: true, r: 0.9 });
  ico(0.55 * s, m, 0, 0.4 * s, 0, g); ico(0.42 * s, m, 0.45 * s, 0.32 * s, 0.1, g); ico(0.4 * s, m, -0.4 * s, 0.3 * s, -0.1, g);
  g.position.set(x, 0, z); parent.add(g); return g;
}
export function flowers(x, z, parent, colors = [0xff6b8b, 0xffd166, 0xffffff, 0xb388ff]) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 0.25 + (i % 3) * 0.28;
    cyl(0.02, 0.02, 0.32, mat(0x3f9a4d), Math.cos(a) * r, 0, Math.sin(a) * r, g, { seg: 5, cast: false });
    sph(0.1, mat(colors[i % colors.length], { r: 0.6 }), Math.cos(a) * r, 0.36, Math.sin(a) * r, g, { seg: 8, rings: 6, cast: false });
  }
  g.position.set(x, 0, z); parent.add(g); return g;
}
export function lamp(x, z, parent) {
  const g = new THREE.Group(), dark = mat(0x263248, { r: 0.5, m: 0.4 });
  cyl(0.16, 0.2, 0.25, dark, 0, 0, 0, g, { seg: 12 });
  cyl(0.055, 0.07, 3.2, dark, 0, 0.25, 0, g, { seg: 10 });
  cyl(0.24, 0.16, 0.12, dark, 0, 3.45, 0, g, { seg: 12 });
  const bulb = sph(0.2, mat(0xfff1c2, { e: 0xffd98a, ei: 1.3, r: 0.4 }), 0, 3.72, 0, g, { cast: false });
  cyl(0.26, 0.05, 0.14, dark, 0, 3.86, 0, g, { seg: 12 });
  g.userData.bulb = bulb;
  g.position.set(x, 0, z); parent.add(g); return g;
}
export function bench(x, z, ry, parent) {
  const g = new THREE.Group(), wood = mat(0xb9793f, { r: 0.8 }), iron = mat(0x2c3a52, { r: 0.5, m: 0.4 });
  for (let i = 0; i < 3; i++) box(1.7, 0.06, 0.15, wood, 0, 0.44, -0.17 + i * 0.17, g);
  for (let i = 0; i < 2; i++) box(1.7, 0.14, 0.05, wood, 0, 0.66 + i * 0.2, -0.3, g, { rx: -0.12 });
  for (const sx of [-0.72, 0.72]) { box(0.07, 0.44, 0.5, iron, sx, 0, 0, g); box(0.07, 0.6, 0.07, iron, sx, 0.4, -0.3, g); }
  g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g); return g;
}
export function cloud(x, y, z, parent, s = 1) {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  for (const [dx, dy, r] of [[0, 0, 3], [3, 0.4, 2.4], [-3, 0.2, 2.2], [1.2, 1.4, 2.1], [-1.4, 1.1, 1.8]]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), m); b.position.set(dx * s, dy * s, 0); b.scale.y = 0.62; g.add(b);
  }
  g.position.set(x, y, z); parent.add(g); return g;
}

/** Cúpula de cielo con degradado: da profundidad sin cargar imágenes. */
export function skyDome(top, horizon, bottom) {
  const geo = new THREE.SphereGeometry(190, 24, 14);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vPos; void main(){ float h = normalize(vPos).y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }'
  });
  const m = new THREE.Mesh(geo, material); m.renderOrder = -1; return m;
}

/** Marcador flotante sobre lo que se puede usar. */
export function marker(color = 0xffc93c) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.35 }));
  m.scale.y = 1.45; g.add(m);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.32; g.add(ring);
  g.userData.isMarker = true;
  return g;
}

export function sunLight(scene, { x = 30, y = 46, z = 22, intensity = 2.3, color = 0xfff1d6, area = 60 } = {}) {
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.position.set(x, y, z);
  sun.userData.wantsShadow = true;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = -area; c.right = area; c.top = area; c.bottom = -area; c.near = 1; c.far = 160;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  return sun;
}
