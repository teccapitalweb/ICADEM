// Ciudad ICADEM 2.0 · objetos que el avatar sostiene durante una animación (vaso, juguetes, pelota).
// Solo decoración: aparecen mientras dura la animación y se retiran al terminar.
import * as THREE from '../three.js';

const M = new Map();
const mat = (color, extra = {}) => { const k = color + JSON.stringify(extra); let m = M.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra }); m.userData.shared = true; M.set(k, m); } return m; };
const G = { sphere: new THREE.SphereGeometry(1, 12, 10), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cone: new THREE.ConeGeometry(1, 1, 14), torus: new THREE.TorusGeometry(1, 0.2, 6, 18) };
for (const g of Object.values(G)) g.userData.shared = true;
const part = (geo, m, parent, x, y, z, sx, sy = sx, sz = sx) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; };
const line = (parent, color) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color })); l.frustumCulled = false; parent.add(l); return l; };
const setLine = (l, a, b) => { const p = l.geometry.attributes.position.array; p.set([a.x, a.y, a.z, b.x, b.y, b.z]); l.geometry.attributes.position.needsUpdate = true; };

/** Emotes que usan un objeto, y el objeto de cada uno. `hand` = mano derecha del avatar; `root` = el avatar. */
export const PROP_EMOTES = Object.freeze(['drink', 'throw', 'balero', 'yoyo', 'trompo', 'papalote', 'burbujas']);

export function makeProp(kind, hand, root, color) {
  const g = new THREE.Group(); g.userData.dynamic = true; const disposables = [];
  let update = () => {};
  if (kind === 'drink') {
    hand.add(g); g.position.set(0, -0.05, 0.06);
    part(G.cyl, mat(0xffffff, { transparent: true, opacity: 0.55 }), g, 0, 0, 0, 0.045, 0.13, 0.045);
    part(G.cyl, mat(color || 0xa3123a), g, 0, -0.012, 0, 0.04, 0.1, 0.04);
    part(G.cyl, mat(0xff4fa3), g, 0.02, 0.09, 0, 0.006, 0.12, 0.006).rotation.z = 0.25;   // popote
  } else if (kind === 'throw') {
    hand.add(g); part(G.sphere, mat(0xd9ff3d), g, 0, -0.05, 0.05, 0.075);
  } else if (kind === 'balero') {
    hand.add(g); part(G.cyl, mat(0xc98f56), g, 0, 0.02, 0.06, 0.018, 0.22, 0.018);
    const ball = part(G.sphere, mat(color || 0xe2483d), root, 0, 1.4, 0.4, 0.07); const l = line(root, 0xf2f2f2);
    const a = new THREE.Vector3(), w = new THREE.Vector3();
    update = t => { g.getWorldPosition(w); root.worldToLocal(w); const k = Math.abs(Math.sin(t * 3.2)); ball.position.set(w.x + Math.sin(t * 6.4) * 0.12, w.y - 0.32 + k * 0.42, w.z + 0.05); a.copy(ball.position); setLine(l, w, a); };
    disposables.push(ball, l);
  } else if (kind === 'yoyo') {
    hand.add(g);
    const yo = new THREE.Group(); root.add(yo); part(G.cyl, mat(color || 0x2fa865), yo, 0, 0, 0, 0.055, 0.03, 0.055).rotation.z = Math.PI / 2;
    const l = line(root, 0xffffff), w = new THREE.Vector3();
    update = t => { g.getWorldPosition(w); root.worldToLocal(w); const k = (Math.sin(t * 4) + 1) / 2; yo.position.set(w.x, w.y - 0.05 - k * 0.55, w.z + 0.04); yo.rotation.x = t * 20; setLine(l, w, yo.position); };
    disposables.push(yo, l);
  } else if (kind === 'trompo') {
    const top = new THREE.Group(); root.add(top); top.position.set(0, 0, 0.75);
    part(G.cone, mat(color || 0x2f6fd8), top, 0, 0.07, 0, 0.07, 0.12, 0.07).rotation.x = Math.PI;
    part(G.sphere, mat(0xffd166), top, 0, 0.13, 0, 0.065, 0.04, 0.065);
    update = t => { top.rotation.y = t * 30; top.rotation.z = Math.sin(t * 2) * 0.08; };
    disposables.push(top);
  } else if (kind === 'papalote') {
    hand.add(g);
    const kite = new THREE.Group(); root.add(kite);
    const sh = new THREE.Shape(); sh.moveTo(0, 0.4); sh.lineTo(0.28, 0); sh.lineTo(0, -0.45); sh.lineTo(-0.28, 0); sh.lineTo(0, 0.4);
    const geo = new THREE.ShapeGeometry(sh); const kmat = new THREE.MeshStandardMaterial({ color: color || 0xff7ab8, side: THREE.DoubleSide, roughness: 0.7 });
    kite.add(new THREE.Mesh(geo, kmat));
    for (let i = 0; i < 4; i++) part(G.sphere, mat([0xffd166, 0x7fd1ff, 0x8fd16b, 0xffffff][i]), kite, Math.sin(i) * 0.05, -0.5 - i * 0.14, 0, 0.035);
    const l = line(root, 0xffffff), w = new THREE.Vector3();
    update = t => { kite.position.set(Math.sin(t * 0.9) * 0.6, 4.2 + Math.sin(t * 1.3) * 0.3, 2.6); kite.rotation.z = Math.sin(t * 1.7) * 0.25; g.getWorldPosition(w); root.worldToLocal(w); setLine(l, w, kite.position); };
    disposables.push(kite, l); g.userData.extra = [geo, kmat];
  } else if (kind === 'burbujas') {
    hand.add(g); part(G.torus, mat(0x9fd8ff), g, 0, 0.02, 0.07, 0.045);
    const bm = new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.2 });
    const bubbles = Array.from({ length: 10 }, (_, i) => { const b = new THREE.Mesh(G.sphere, bm); b.userData.k = i / 10; root.add(b); return b; });
    const w = new THREE.Vector3();
    update = t => { g.getWorldPosition(w); root.worldToLocal(w); bubbles.forEach((b, i) => { const k = (b.userData.k + t * 0.25) % 1; b.position.set(w.x + Math.sin(i * 2.1 + t) * 0.4 * k, w.y + k * 1.6, w.z + 0.2 + k * 0.9); b.scale.setScalar(0.03 + 0.05 * Math.sin(k * Math.PI)); }); };
    disposables.push(...bubbles); g.userData.extra = [bm];
  }
  return {
    update,
    dispose() {
      g.parent?.remove(g);
      for (const d of disposables) { d.parent?.remove(d); if (d.isLine) { d.geometry.dispose(); d.material.dispose(); } }
      for (const x of g.userData.extra || []) x.dispose?.();
    }
  };
}
