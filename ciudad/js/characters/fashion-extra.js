// Ciudad ICADEM 2.0 · colección de ropa «Mundo vivo» (geometría cosmética).
//
// Mismas reglas que fashion-parts.js (de Codex): cada pieza cuelga de una articulación existente del
// avatar (pierna, torso, brazo o cabeza) y no cambia el esqueleto, las animaciones, el tamaño de
// colisión ni nada del juego. Este archivo solo agrega formas nuevas; las 40 piezas anteriores siguen
// en fashion-parts.js sin cambios.
import * as THREE from '../three.js';
import { mat as kitMat, mergeStatic } from '../world/kit.js';

const mat = (color, options = {}) => kitMat(color, { ...options, solid: true });
const mesh = (geometry, material, x, y, z, parent) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
const box = (w, h, d, material, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
const sphere = (r, material, x, y, z, parent, s = 12) => mesh(new THREE.SphereGeometry(r, s, Math.max(6, s - 2)), material, x, y, z, parent);
const capsule = (r, l, material, x, y, z, parent, s = 10) => mesh(new THREE.CapsuleGeometry(r, l, 4, s), material, x, y, z, parent);
const cyl = (rt, rb, h, material, x, y, z, parent, s = 14) => mesh(new THREE.CylinderGeometry(rt, rb, h, s), material, x, y, z, parent);
const ring = (r, t, material, x, y, z, parent, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(r, t, 6, 22, arc), material, x, y, z, parent);
const group = (parent, name) => { const g = new THREE.Group(); g.name = 'fashion2-' + name; parent.add(g); return g; };
const finish = g => { mergeStatic(g); return true; };

export const EXTRA_TOPS = ['shirt', 'blouse', 'sweater', 'sportJacket', 'tank', 'printTee'];
export const EXTRA_BOTTOMS = ['shorts', 'bermuda', 'capri', 'joggers', 'wideJeans', 'longSkirt', 'denimSkirt'];
export const EXTRA_SHOES = ['sandals', 'ankleBoots', 'runners', 'oxfords'];
export const EXTRA_HATS = ['sportCap', 'sunHat', 'strawHat'];
export const EXTRA_BAGS = ['miniBackpack', 'fannyPack'];
export const EXTRA_HAIR = ['braid', 'afro'];
const SKIRTS = ['longSkirt', 'denimSkirt'];

/* ---------------- piernas (pivote en la cadera, la pierna mide ~0.46) ---------------- */
export function extraLeg(pivot, side, look, M) {
  const s = look.bottomStyle; if (!EXTRA_BOTTOMS.includes(s)) return false;
  if (SKIRTS.includes(s)) { capsule(0.094, 0.26, M.skin, 0, -0.23, 0, pivot); return true; }   // la falda va en el torso
  const cut = { shorts: 0.15, bermuda: 0.25, capri: 0.33 }[s];
  if (cut) {
    cyl(0.112, s === 'shorts' ? 0.118 : 0.108, cut, M.bottom, 0, -cut / 2 + 0.01, 0, pivot);
    ring(s === 'shorts' ? 0.116 : 0.107, 0.012, s === 'shorts' ? M.accent : M.bottom, 0, -cut + 0.012, 0, pivot).rotation.x = Math.PI / 2;
    capsule(0.088, 0.36 - cut, M.skin, 0, -(cut + 0.42) / 2 + 0.02, 0, pivot);
    if (s === 'bermuda') box(0.07, 0.08, 0.06, M.bottom, side * 0.1, -0.13, 0.02, pivot);
    if (s === 'capri') box(0.012, cut * 0.8, 0.012, mat(0xd7dce6), side * 0.106, -cut / 2, 0.02, pivot);
    return true;
  }
  if (s === 'joggers') {
    cyl(0.112, 0.09, 0.40, M.bottom, 0, -0.2, 0, pivot);
    ring(0.088, 0.02, M.accent, 0, -0.405, 0, pivot).rotation.x = Math.PI / 2;
    box(0.014, 0.36, 0.02, mat(0xffffff), side * 0.108, -0.2, 0, pivot);   // franja deportiva
    return true;
  }
  // wideJeans: mezclilla de corte ancho, con costura y valenciana doblada
  cyl(0.108, 0.142, 0.43, M.bottom, 0, -0.215, 0, pivot);
  ring(0.142, 0.02, mat(0x9fb6d3), 0, -0.4, 0, pivot).rotation.x = Math.PI / 2;
  box(0.01, 0.4, 0.01, mat(0xe0b35a), side * 0.118, -0.21, 0.04, pivot);
  return true;
}

/* ---------------- falda (en el torso, a la altura de la cintura) ---------------- */
export function extraSkirt(torso, look, M) {
  const s = look.bottomStyle; if (!SKIRTS.includes(s)) return;
  const g = group(torso, 'skirt');
  if (s === 'longSkirt') {
    const geo = new THREE.CylinderGeometry(0.215, 0.34, 0.5, 26, 3), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < 0) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x), f = 1 + 0.05 * Math.sin(a * 7) * (-y / 0.25); pos.setX(i, x * f); pos.setZ(i, z * f); } }
    geo.computeVertexNormals(); mesh(geo, M.bottom, 0, -0.18, 0, g);
    ring(0.216, 0.018, M.accent, 0, 0.06, 0, g).rotation.x = Math.PI / 2;
  } else {
    mesh(new THREE.CylinderGeometry(0.215, 0.27, 0.24, 18), M.bottom, 0, -0.04, 0, g);
    ring(0.216, 0.016, M.bottom, 0, 0.065, 0, g).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) box(0.075, 0.06, 0.012, M.bottom, sx * 0.1, 0.0, 0.226, g);
    box(0.01, 0.2, 0.012, mat(0xe0b35a), 0, -0.04, 0.24, g);   // costura frontal
  }
  finish(g);
}

/* ---------------- calzado (en la pierna, el pie está en y ≈ −0.45) ---------------- */
export function extraShoes(pivot, look, M) {
  const s = look.shoeStyle; if (!EXTRA_SHOES.includes(s)) return false;
  const g = group(pivot, 'shoes');
  if (s === 'sandals') {
    const foot = capsule(0.072, 0.14, M.skin, 0, -0.44, 0.06, g); foot.rotation.x = Math.PI / 2; foot.scale.set(1, 1, 0.7);
    const sole = capsule(0.09, 0.16, mat(0x8a5a36), 0, -0.49, 0.06, g); sole.rotation.x = Math.PI / 2; sole.scale.set(1.05, 1, 0.2);
    for (const z of [0.0, 0.11]) box(0.15, 0.022, 0.03, M.shoes, 0, -0.455, z, g);
    ring(0.07, 0.012, M.shoes, 0, -0.43, -0.03, g).rotation.x = Math.PI / 2;
  } else if (s === 'ankleBoots') {
    const body = capsule(0.1, 0.15, M.shoes, 0, -0.44, 0.065, g); body.rotation.x = Math.PI / 2; body.scale.set(1.04, 1, 0.75);
    capsule(0.103, 0.1, M.shoes, 0, -0.35, 0.01, g);
    box(0.09, 0.07, 0.07, mat(0x2a2024), 0, -0.47, -0.04, g);   // tacón bajo
    box(0.01, 0.12, 0.02, mat(0xd9b06a, { m: 0.5 }), 0.1, -0.35, 0.03, g);   // cierre lateral
  } else if (s === 'runners') {
    const body = capsule(0.098, 0.15, M.shoes, 0, -0.432, 0.065, g); body.rotation.x = Math.PI / 2; body.scale.set(1.04, 1, 0.74);
    const sole = capsule(0.11, 0.17, mat(0xffffff), 0, -0.49, 0.065, g); sole.rotation.x = Math.PI / 2; sole.scale.set(1.08, 1, 0.34);
    for (const sx of [-1, 1]) { const st = box(0.012, 0.03, 0.12, mat(0xff7a3d), sx * 0.1, -0.43, 0.06, g); st.rotation.x = 0.35; }
    box(0.1, 0.03, 0.05, mat(0x3a8fd6), 0, -0.505, 0.0, g);   // cámara de aire
  } else {
    const body = capsule(0.092, 0.13, M.shoes, 0, -0.44, 0.065, g); body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 0.64);
    box(0.16, 0.02, 0.24, mat(0x1d1b22), 0, -0.488, 0.065, g);
    sphere(0.075, M.shoes, 0, -0.445, 0.15, g).scale.set(1.1, 0.6, 0.9);   // puntera
    for (const z of [0.04, 0.075]) box(0.07, 0.008, 0.01, mat(0xe6e0d4), 0, -0.4, z, g);
  }
  return finish(g);
}

/* ---------------- parte de arriba (torso; el pecho está en y ≈ 0.30) ---------------- */
export function extraTop(torso, look, M) {
  const s = look.topStyle; if (!EXTRA_TOPS.includes(s)) return false;
  const g = group(torso, 'top');
  const chest = capsule(s === 'sweater' ? 0.212 : 0.2, s === 'tank' ? 0.22 : 0.26, s === 'tank' ? M.top : M.top, 0, 0.3, 0, g, 14); chest.scale.set(1.12, 1, 0.86);
  if (s === 'shirt') {
    for (const sx of [-1, 1]) { const c = box(0.09, 0.05, 0.08, M.white, sx * 0.06, 0.58, 0.14, g); c.rotation.set(0.5, 0, sx * 0.5); }
    box(0.026, 0.42, 0.012, M.accent, 0, 0.32, 0.183, g);
    for (const y of [0.18, 0.27, 0.36, 0.45]) sphere(0.01, M.white, 0, y, 0.19, g, 6);
    box(0.07, 0.07, 0.012, M.accent, 0.1, 0.42, 0.178, g);   // bolsillo
  } else if (s === 'blouse') {
    const ruffle = new THREE.CylinderGeometry(0.22, 0.27, 0.09, 28, 1, true), p = ruffle.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), f = 1 + 0.06 * Math.cos(a * 12); p.setX(i, x * f); p.setZ(i, z * f); }
    ruffle.computeVertexNormals(); mesh(ruffle, M.top, 0, 0.05, 0, g);
    ring(0.11, 0.014, M.accent, 0, 0.58, 0.02, g).rotation.x = Math.PI / 2;
    sphere(0.03, M.accent, 0, 0.5, 0.19, g, 8).scale.set(1.6, 0.8, 0.5);   // moño
  } else if (s === 'sweater') {
    ring(0.212, 0.03, M.accent, 0, 0.06, 0, g).rotation.x = Math.PI / 2;
    ring(0.115, 0.03, M.accent, 0, 0.58, 0.01, g).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) sphere(0.02, M.accent, sx * 0.07, 0.15 + i * 0.075, 0.2 - Math.abs(i - 2) * 0.004, g, 6).scale.set(1, 1.3, 0.6);   // trenzado
  } else if (s === 'sportJacket') {
    box(0.016, 0.44, 0.012, mat(0xd9dce8, { m: 0.5 }), 0, 0.31, 0.186, g);   // cierre
    ring(0.12, 0.035, M.top, 0, 0.58, 0, g).rotation.x = Math.PI / 2;   // cuello alto
    for (const sx of [-1, 1]) box(0.022, 0.4, 0.04, M.white, sx * 0.205, 0.3, 0.06, g);   // franjas laterales
    ring(0.212, 0.022, M.accent, 0, 0.06, 0, g).rotation.x = Math.PI / 2;
  } else if (s === 'tank') {
    for (const sx of [-1, 1]) { capsule(0.016, 0.12, M.top, sx * 0.1, 0.56, 0.0, g); }
    mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), M.skin, 0, 0.45, 0, g).scale.set(1.12, 1, 0.86);   // hombros descubiertos
  } else {
    // printTee: playera con estampado original (estrella de Ciudad ICADEM)
    ring(0.106, 0.016, M.accent, 0, 0.592, 0.008, g).rotation.x = Math.PI / 2;
    const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.035 : 0.08; (i ? star.lineTo : star.moveTo).call(star, Math.cos(a) * r, Math.sin(a) * r); }
    mesh(new THREE.ShapeGeometry(star), mat(0xffd166), 0, 0.36, 0.188, g);
  }
  return finish(g);
}
export function extraSleeve(pivot, look, M) {
  const s = look.topStyle; if (!EXTRA_TOPS.includes(s)) return false;
  if (s === 'tank') { capsule(0.064, 0.25, M.skin, 0, -0.17, 0, pivot); return true; }
  if (s === 'printTee') { capsule(0.061, 0.14, M.skin, 0, -0.25, 0, pivot); capsule(0.079, 0.07, M.top, 0, -0.055, 0, pivot); return true; }
  if (s === 'blouse') { sphere(0.095, M.top, 0, -0.05, 0, pivot).scale.set(1, 0.9, 1); capsule(0.06, 0.16, M.skin, 0, -0.23, 0, pivot); ring(0.07, 0.014, M.accent, 0, -0.12, 0, pivot).rotation.x = Math.PI / 2; return true; }
  capsule(s === 'sweater' ? 0.08 : 0.073, 0.25, M.top, 0, -0.17, 0, pivot);
  cyl(0.078, 0.078, 0.045, s === 'shirt' ? M.white : M.accent, 0, -0.315, 0, pivot, 10);
  if (s === 'sportJacket') box(0.016, 0.24, 0.03, M.white, 0.07, -0.17, 0, pivot);
  return true;
}

/* ---------------- cabello ---------------- */
export function extraHair(head, look, M) {
  const s = look.hairStyle; if (!EXTRA_HAIR.includes(s)) return;
  const g = group(head, 'hair');
  if (s === 'afro') { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; sphere(0.12, M.hair, Math.sin(a) * 0.25, 0.42 + (i % 2) * 0.05, Math.cos(a) * 0.22 - 0.04, g, 8); } sphere(0.3, M.hair, 0, 0.47, -0.04, g, 12).scale.set(1.05, 0.75, 1); }
  else { let y = 0.3, z = -0.27; for (let i = 0; i < 6; i++) { sphere(0.068 - i * 0.004, M.hair, (i % 2 ? 0.015 : -0.015), y, z, g, 8); y -= 0.085; z -= 0.012; } sphere(0.03, M.accent, 0, y + 0.03, z, g, 8); }
  finish(g);
}

/* ---------------- sombreros, bolsos, lentes, pulseras y audífonos ---------------- */
export function extraAccessories({ head, torso, arms, look, materials: M, accessories }) {
  const any = EXTRA_HATS.some(h => accessories.has(h)) || EXTRA_BAGS.includes(look.bagStyle) || look.glassesStyle || look.braceletStyle || look.headphonesStyle;
  if (!any) return;
  if (accessories.has('sportCap')) { const g = group(head, 'hat'), c = mat(0x2f6fd8); mesh(new THREE.SphereGeometry(0.286, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), c, 0, 0.32, 0, g); const v = box(0.3, 0.02, 0.22, c, 0, 0.35, 0.3, g); v.rotation.x = 0.12; sphere(0.025, mat(0xffffff), 0, 0.61, 0, g, 8); box(0.12, 0.08, 0.01, mat(0xffffff), 0, 0.47, 0.27, g); finish(g); }
  if (accessories.has('sunHat')) { const g = group(head, 'hat'), c = mat(0xf3e2c0); cyl(0.5, 0.52, 0.025, c, 0, 0.42, 0, g, 28); cyl(0.2, 0.25, 0.17, c, 0, 0.52, 0, g, 20); ring(0.235, 0.025, mat(0xe86a5c), 0, 0.47, 0, g).rotation.x = Math.PI / 2; finish(g); }
  if (accessories.has('strawHat')) { const g = group(head, 'hat'), c = mat(0xd9b46a, { r: 0.95 }); cyl(0.44, 0.46, 0.03, c, 0, 0.43, 0, g, 26); for (let i = 0; i < 4; i++) ring(0.27 + i * 0.045, 0.006, mat(0xb48c46), 0, 0.447, 0, g).rotation.x = Math.PI / 2; cyl(0.19, 0.24, 0.2, c, 0, 0.54, 0, g, 18); ring(0.23, 0.022, mat(0xc0392b), 0, 0.48, 0, g).rotation.x = Math.PI / 2; finish(g); }
  if (look.bagStyle === 'miniBackpack') { const g = group(torso, 'bag'), c = mat(0xff8f6b); const b = capsule(0.13, 0.12, c, 0, 0.3, -0.25, g); b.scale.set(1.15, 1, 0.7); box(0.16, 0.1, 0.05, mat(0xffd166), 0, 0.22, -0.33, g); for (const sx of [-1, 1]) { const st = box(0.03, 0.42, 0.02, c, sx * 0.13, 0.32, 0.05, g); st.rotation.x = 0.12; } finish(g); }
  if (look.bagStyle === 'fannyPack') { const g = group(torso, 'bag'), c = mat(0x22345c); const b = capsule(0.06, 0.14, c, 0.05, 0.06, 0.22, g); b.rotation.z = Math.PI / 2; b.scale.z = 0.8; ring(0.215, 0.012, mat(0x1d1b22), 0, 0.07, 0, g).rotation.x = Math.PI / 2; box(0.1, 0.01, 0.012, mat(0xd9dce8, { m: 0.5 }), 0.05, 0.08, 0.27, g); finish(g); }
  if (look.glassesStyle) {
    const g = group(head, 'glasses'), st = look.glassesStyle, frame = mat(st === 'sun' ? 0x1d1b22 : st === 'party' ? 0xff4fa3 : 0x8a5a36, { m: 0.2, r: 0.4 });
    for (const sx of [-1, 1]) {
      if (st === 'party') { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.03 : 0.068; (i ? sh.lineTo : sh.moveTo).call(sh, Math.cos(a) * r, Math.sin(a) * r); } mesh(new THREE.ShapeGeometry(sh), frame, sx * 0.097, 0.285, 0.26, g); }
      else { ring(st === 'sun' ? 0.062 : 0.058, 0.011, frame, sx * 0.097, 0.285, 0.252, g); if (st === 'sun') { const lens = mesh(new THREE.CircleGeometry(0.06, 16), mat(0x24324a, { r: 0.2, m: 0.3 }), sx * 0.097, 0.285, 0.255, g); lens.castShadow = false; } }
      box(0.02, 0.012, 0.22, frame, sx * 0.165, 0.29, 0.14, g);
    }
    box(0.05, 0.01, 0.01, frame, 0, 0.29, 0.255, g); finish(g);
  }
  if (look.braceletStyle) for (const arm of [arms[1]]) {
    const g = group(arm, 'bracelet');
    if (look.braceletStyle === 'beads') for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; sphere(0.017, mat([0xff7a8a, 0x7fd1ff, 0xffd166][i % 3]), Math.cos(a) * 0.07, -0.33, Math.sin(a) * 0.07, g, 6); }
    else ring(0.07, 0.013, mat(0xdab765, { m: 0.6, r: 0.3 }), 0, -0.33, 0, g).rotation.x = Math.PI / 2;
    finish(g);
  }
  if (look.headphonesStyle) {
    const g = group(head, 'headphones'), c = mat(look.headphonesStyle === 'sport' ? 0xff7a3d : 0x2a2f3a, { r: 0.4 });
    ring(0.29, 0.02, c, 0, 0.25, 0, g, Math.PI);   // diadema: medio aro sobre la cabeza, de oreja a oreja
    for (const sx of [-1, 1]) { const cup = cyl(0.075, 0.075, 0.05, c, sx * 0.285, 0.25, 0, g, 16); cup.rotation.z = Math.PI / 2; cyl(0.05, 0.05, 0.02, mat(0xffffff), sx * 0.31, 0.25, 0, g, 12).rotation.z = Math.PI / 2; }
    finish(g);
  }
}
