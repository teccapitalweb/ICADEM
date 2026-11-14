// Ciudad ICADEM 2.0 · modelos 3D de mascotas (procedurales, sin archivos externos).
//
// Un mismo esqueleto por especie dibuja todas sus razas con los parámetros de pet-catalog.js.
// Geometrías y materiales se comparten entre todas las mascotas (caché), así diez mascotas en
// pantalla cuestan poco más que una. El modelo mira hacia +Z, igual que los avatares.
//
//   const pet = createPetModel(breedId, acc)
//   pet.group            → THREE.Group para poner en la escena
//   pet.leashAnchor      → Object3D del collar/arnés (para la correa)
//   pet.update(dt, { speed, action, air, t })   action: walk | sit | sleep | jump | dance | stretch | groom | speak | play | eat | wag | fly | perch | fire | land
//   pet.dispose()
import * as THREE from '../three.js';
import { breedById } from './pet-catalog.js';
import { itemById } from '../economy/catalog.js';

/* ---------- cachés compartidos ---------- */
const GEO = {
  sphere: new THREE.SphereGeometry(1, 14, 10), sphereLow: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10), cone: new THREE.ConeGeometry(1, 1, 10), cone4: new THREE.ConeGeometry(1, 1, 4),
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 8), torus: new THREE.TorusGeometry(1, 0.18, 6, 18), halfTorus: new THREE.TorusGeometry(1, 0.16, 5, 12, Math.PI), disk: new THREE.CylinderGeometry(1, 1, 0.1, 12)
};
const wing = (() => {   // ala membranosa de dragón (abanico)
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1, 0.15); s.quadraticCurveTo(0.85, -0.25, 0.95, -0.6); s.quadraticCurveTo(0.6, -0.35, 0.55, -0.7); s.quadraticCurveTo(0.3, -0.35, 0.2, -0.55); s.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g;
})();
for (const g of [...Object.values(GEO), wing]) g.userData.shared = true;   // nadie las libera: las usan todas las mascotas
const MATS = new Map();
function mat(color, { e = 0, r = 0.75, m = 0 } = {}) {
  const key = color + ':' + e + ':' + r + ':' + m;
  let x = MATS.get(key);
  if (!x) { x = new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, emissive: e ? color : 0x000000, emissiveIntensity: e }); x.userData.shared = true; MATS.set(key, x); }
  return x;
}
const EYE = mat(0x15121a, { r: 0.25 }), SHINE = mat(0xffffff, { e: 0.6, r: 0.2 }), NOSE = mat(0x241c1c, { r: 0.35 }), PINK = mat(0xf2a3a8, { r: 0.6 });
const wingMat = new Map();
function wingMaterial(color) { let x = wingMat.get(color); if (!x) { x = new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }); x.userData.shared = true; wingMat.set(color, x); } return x; }

function mesh(geo, material, parent, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
}
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
/** Números pseudoaleatorios estables por raza (las manchas siempre caen en el mismo lugar). */
function seeded(text) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
const lerp = (a, b, k) => a + (b - a) * k;
const damp = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, dt * rate);

/* ---------- cuadrúpedos: perros, gatos y fantásticos de cuatro patas ---------- */
/** Forma base de los compañeros fantásticos de cuatro patas (la raza puede sobrescribirla). */
const FORM_SHAPE = { fox: { ears: 'erect', snout: 'long', pattern: 'mask', legs: 0.95 }, wolf: { ears: 'erect', snout: 'long', tail: 'plume', pattern: 'mask', legs: 1.05, body: 1.05 }, lion: { ears: 'catSmall', snout: 'mid', tail: 'pom', pattern: 'solid', body: 1.05 } };
function buildQuad(breed, parts) {
  const b = { ...(FORM_SHAPE[breed.form] || {}), ...breed }; if (b.form === 'wolf' && !b.eyes) b.eyes = b.glow;
  const s = b.size, cat = b.species === 'gato', form = b.form || null;
  const R = 0.15 * s * (cat ? 0.82 : 1), L = 0.62 * s * (b.body || 1) * (cat ? 0.9 : 1), leg = 0.3 * s * (b.legs || 1) * (cat ? 0.95 : 1);
  const [c0, c1] = b.coat, main = mat(c0, { r: 0.8 - (b.fluff || 0) * 0.15 }), sec = mat(c1, { r: 0.8 }), rand = seeded(b.id);
  const glow = b.glow ? mat(b.glow, { e: 0.9, r: 0.4 }) : null;
  const root = new THREE.Group(), rig = pivot(root, 0, leg + R * 0.75, 0);
  parts.rig = rig; parts.baseY = leg + R * 0.75; parts.leg = leg; parts.R = R; parts.L = L;
  // cuerpo
  const fluff = 1 + (b.fluff || 0) * 0.12;
  const pTip = { mask: sec, socks: main, tricolor: main, points: main };
  const body = mesh(GEO.sphere, main, rig, 0, 0, 0, R * fluff, R * 0.95 * fluff, L / 2);
  mesh(GEO.sphere, b.pattern === 'mask' || b.pattern === 'socks' || b.pattern === 'tricolor' ? sec : main, rig, 0, -R * 0.05, L * 0.3, R * 0.9 * fluff, R * 0.92 * fluff, R * 1.05);   // pecho
  if (b.pattern === 'saddle') mesh(GEO.sphere, sec, rig, 0, R * 0.32, -L * 0.05, R * 0.92, R * 0.66, L * 0.42);
  if (b.pattern === 'tricolor') { mesh(GEO.sphere, mat(0x1d1b1d), rig, 0, R * 0.38, -L * 0.08, R * 0.82, R * 0.55, L * 0.34); mesh(GEO.sphere, sec, rig, R * 0.35, R * 0.15, L * 0.18, R * 0.6, R * 0.6, R * 0.7); }
  if (b.pattern === 'spots') for (let i = 0; i < 9; i++) { const a = rand() * Math.PI * 1.2 - 0.1, zz = (rand() - 0.5) * L * 0.8; mesh(GEO.sphereLow, sec, rig, Math.cos(a) * R * 0.93 * (rand() < 0.5 ? -1 : 1), Math.sin(a) * R * 0.9, zz, R * 0.2, R * 0.08, R * 0.2).lookAt(0, 0, zz); }
  if (b.pattern === 'tabby') for (let i = 0; i < 5; i++) mesh(GEO.halfTorus, sec, rig, 0, R * 0.02, -L * 0.32 + i * L * 0.15, R * 0.93 * fluff, R * 0.9 * fluff, R * 0.45);
  if (form === 'wolf') for (let i = 0; i < 9; i++) { const a = rand() * 2.4 - 1.2; mesh(GEO.sphereLow, glow, rig, Math.sin(a) * R * 0.96, Math.cos(a) * R * 0.9, (rand() - 0.5) * L * 0.8, R * 0.1); }
    if (b.fluff >= 0.8) mesh(GEO.sphere, main, rig, 0, R * 0.3, L * 0.4, R * 0.82, R * 0.76, R * 0.55);   // collar de pelo
  // cabeza
  const neck = pivot(rig, 0, R * 0.55, L * 0.45); parts.neck = neck;
  const H = R * (cat ? 1.05 : 0.88) * (b.snout === 'flat' ? 1.1 : 1), head = pivot(neck, 0, R * 0.5, R * 0.35); parts.head = head;
  mesh(GEO.sphere, main, head, 0, 0, 0, H, H * 0.95, H);
  if (b.fluff >= 0.95) mesh(GEO.sphere, main, head, 0, H * 0.75, -H * 0.1, H * 0.85, H * 0.6, H * 0.85);   // copete del poodle
  const snoutLen = { long: 0.95, mid: 0.7, short: 0.42, flat: 0.18, cat: 0.3 }[b.snout] || 0.6;
  const muzzleMat = b.pattern === 'mask' || b.pattern === 'tricolor' || b.pattern === 'socks' || b.pattern === 'points' ? (b.pattern === 'points' ? sec : sec) : main;
  if (b.id === 'husky') mesh(GEO.sphere, mat(c0), head, 0, H * 0.32, H * 0.2, H * 0.9, H * 0.55, H * 0.82);   // capa oscura sobre la frente
  if (form === 'lion') { mesh(GEO.sphere, sec, head, 0, H * 0.05, -H * 0.35, H * 1.45, H * 1.4, H * 1.0); mesh(GEO.torus, sec, head, 0, 0, H * 0.1, H * 1.12, H * 1.12, H * 1.6); }   // melena
  const muzzle = mesh(GEO.sphere, muzzleMat, head, 0, -H * 0.28, H * (0.55 + snoutLen * 0.35), H * (cat ? 0.42 : 0.5), H * 0.38, H * (0.25 + snoutLen * 0.55));
  if (b.snout === 'flat' && !cat) mesh(GEO.sphere, mat(0x2b2422), head, 0, -H * 0.26, muzzle.position.z + H * 0.02, muzzle.scale.x * 1.05, muzzle.scale.y * 1.05, muzzle.scale.z * 1.05);   // hocico oscuro (pug, bulldog)
  mesh(GEO.sphere, NOSE, head, 0, -H * 0.18, muzzle.position.z + muzzle.scale.z * 0.92, H * (cat ? 0.09 : 0.14), H * 0.1, H * 0.1);
  if (cat) mesh(GEO.sphereLow, PINK, head, 0, -H * 0.2, muzzle.position.z + muzzle.scale.z * 0.95, H * 0.07, H * 0.05, H * 0.05);
  const jaw = pivot(head, 0, -H * 0.42, H * 0.45); parts.jaw = jaw;
  mesh(GEO.sphere, PINK, jaw, 0, 0, H * 0.15, H * 0.22, H * 0.06, H * 0.25).visible = !cat;
  // ojos
  const irisMat = b.eyes ? mat(b.eyes, { e: 0.25, r: 0.3 }) : EYE;
  parts.eyes = [-1, 1].map(side => {
    const e = pivot(head, side * H * 0.42, H * 0.18, H * 0.8);
    mesh(GEO.sphere, irisMat, e, 0, 0, 0, H * (cat ? 0.19 : 0.15)); mesh(GEO.sphere, EYE, e, 0, 0, H * 0.08, H * (cat ? 0.09 : 0.1), H * (cat ? 0.16 : 0.1), H * 0.06);
    mesh(GEO.sphereLow, SHINE, e, side * -H * 0.04, H * 0.06, H * 0.13, H * 0.045); return e;
  });
  // orejas (pivote en la base para moverlas)
  const earMat = b.pattern === 'points' || b.pattern === 'tricolor' ? sec : (b.pattern === 'mask' && b.species === 'perro' && b.ears !== 'drop' ? main : main);
  parts.ears = [-1, 1].map(side => {
    const p = pivot(head, side * H * 0.55, H * 0.55, -H * 0.05), t = b.ears;
    if (t === 'erect' || t === 'cat' || t === 'catBig' || t === 'catSmall' || t === 'catTufted' || t === 'bat') {
      const k = { erect: 0.55, bat: 0.75, cat: 0.5, catBig: 0.68, catSmall: 0.32, catTufted: 0.58 }[t], w = t === 'bat' ? 0.4 : 0.3;
      const e = mesh(GEO.cone4, earMat, p, 0, H * k * 0.5, 0, H * w, H * k, H * w * 0.55); e.rotation.z = -side * (t === 'bat' ? 0.45 : 0.18);
      mesh(GEO.cone4, PINK, p, 0, H * k * 0.45, H * 0.04, H * w * 0.55, H * k * 0.75, H * w * 0.2).rotation.z = e.rotation.z;
      if (t === 'catTufted') mesh(GEO.cone, earMat, p, -side * H * 0.08, H * k * 1.05, 0, H * 0.05, H * 0.25, H * 0.05);
    } else if (t === 'semi') { const e = mesh(GEO.sphere, earMat, p, side * H * 0.05, H * 0.2, 0, H * 0.18, H * 0.32, H * 0.1); e.rotation.z = side * 0.4; mesh(GEO.sphere, earMat, p, side * H * 0.12, H * 0.42, H * 0.12, H * 0.14, H * 0.12, H * 0.1); }
    else if (t === 'button') mesh(GEO.sphere, mat(0x241e1c), p, side * H * 0.08, H * 0.05, H * 0.12, H * 0.2, H * 0.14, H * 0.08);
    else { const long = t === 'long' ? 1.5 : 1; p.position.set(side * H * 0.8, H * 0.38, -H * 0.05); const e = mesh(GEO.sphere, earMat, p, side * H * 0.06, -H * 0.36 * long, 0, H * 0.16, H * 0.46 * long, H * 0.3); e.rotation.z = side * 0.18; if (b.fluff >= 0.6) e.scale.x *= 1.35; }
    return p;
  });
  // cola (cadena de pivotes)
  const tail = pivot(rig, 0, R * 0.45, -L * 0.48); parts.tail = tail;
  const tipMat = b.pattern === 'points' || b.pattern === 'tricolor' ? sec : b.pattern === 'mask' && b.id === 'husky' ? sec : main;
  const tt = b.tail || 'whip';
  if (form === 'fox') for (let i = 0; i < (b.tails || 1); i++) { const tp = pivot(tail, (i - ((b.tails || 1) - 1) / 2) * R * 0.35, 0, 0); tp.rotation.set(-0.6, (i - 1) * 0.35, 0); mesh(GEO.sphere, main, tp, 0, 0, -L * 0.3, R * 0.38, R * 0.38, L * 0.32); mesh(GEO.sphere, glow, tp, 0, 0, -L * 0.6, R * 0.25, R * 0.25, R * 0.32); }
  else if (tt === 'stub') mesh(GEO.sphere, main, tail, 0, 0, 0, R * 0.22);
  else if (tt === 'curl') { const c = mesh(GEO.torus, main, tail, 0, R * 0.35, -R * 0.1, R * 0.38, R * 0.38, R * 0.55 * (1 + b.fluff)); c.rotation.y = Math.PI / 2; }
  else {
    const segs = tt === 'cat' || tt === 'catFluffy' ? 4 : 3, thick = { plume: 0.36, otter: 0.32, catFluffy: 0.42, pom: 0.13, whip: 0.18, cat: 0.22 }[tt] || 0.18, len = (tt.startsWith('cat') ? 0.95 : 0.6) * L / segs;
    let p = tail; parts.tailSegs = [];
    for (let i = 0; i < segs; i++) { const q = pivot(p, 0, 0, i ? -len : 0); q.rotation.x = i ? (tt.startsWith('cat') ? -0.28 : 0.12) : (tt === 'otter' ? 0.2 : tt.startsWith('cat') ? 0.95 : 0.7); mesh(GEO.sphere, i === segs - 1 ? tipMat : main, q, 0, 0, -len * 0.5, R * thick * (1 - i * 0.1), R * thick * (1 - i * 0.1), len * 0.66); parts.tailSegs.push(q); p = q; }
    if (tt === 'pom') mesh(GEO.sphere, main, p, 0, 0, -len, R * 0.3);
  }
  // patas: pivote en cadera/hombro
  const legMat = b.pattern === 'socks' ? sec : main, pawMat = b.pattern === 'socks' || b.pattern === 'points' || b.pattern === 'tricolor' ? sec : main;
  parts.legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const p = pivot(rig, sx * R * 0.55, -R * 0.25, sz * L * 0.32), w = R * (cat ? 0.28 : 0.3) * (b.fluff >= 0.95 ? 0.8 : 1);
    mesh(GEO.capsule, b.pattern === 'socks' ? main : legMat, p, 0, -leg * 0.4, 0, w, leg * 0.5, w);
    mesh(GEO.sphere, pawMat, p, 0, -leg + R * 0.05, w * 0.4, w * 1.15, w * 0.75, w * 1.35);
    if (b.fluff >= 0.95) mesh(GEO.sphere, main, p, 0, -leg * 0.75, 0, w * 1.6);
    return p;
  });
  // ancla de collar (cuello)
  const collar = pivot(neck, 0, R * 0.25, R * 0.12); parts.collar = collar; parts.collarR = R * 0.62;
  parts.chest = pivot(rig, 0, 0, L * 0.28); parts.chestR = R * 1.02;
  parts.headTop = pivot(head, 0, H * 0.92, -H * 0.05); parts.H = H;
  if (form === 'dragon') parts.wings = [];
  return root;
}

/* ---------- aves ---------- */
function buildBird(b, parts) {
  const s = b.size, R = 0.15 * s, [c0, c1] = b.coat, main = mat(c0, { r: 0.6 }), sec = mat(c1, { r: 0.6 }), acc = mat(b.accent, { r: 0.6 }), beakM = mat(b.beak, { r: 0.4 });
  const root = new THREE.Group(), rig = pivot(root, 0, R * 1.4, 0); parts.rig = rig; parts.baseY = R * 1.4; parts.R = R;
  mesh(GEO.sphere, main, rig, 0, 0, 0, R, R * 1.05, R * 1.35);
  mesh(GEO.sphere, b.owl || b.eagle ? sec : sec, rig, 0, -R * 0.15, R * 0.45, R * 0.82, R * 0.85, R * 0.9);   // pecho
  const head = pivot(rig, 0, R * 0.95, R * 0.55); parts.head = head; parts.neck = head;
  const H = R * (b.owl ? 0.95 : 0.72);
  mesh(GEO.sphere, b.eagle ? mat(0xfaf8f2) : (b.owl ? main : (b.id === 'ninfa' ? sec : main)), head, 0, 0, 0, H);
  if (b.owl) mesh(GEO.sphere, sec, head, 0, -H * 0.05, H * 0.45, H * 0.85, H * 0.8, H * 0.55);
  if (b.id === 'ninfa') mesh(GEO.sphere, mat(0xff8f6b), head, H * 0.62, -H * 0.15, H * 0.35, H * 0.25, H * 0.25, H * 0.12).position.x *= 1;
  const bl = b.bigBeak ? 1.9 : b.owl ? 0.35 : b.eagle ? 0.6 : 0.5;
  const beak = mesh(GEO.cone, beakM, head, 0, -H * (b.eagle ? 0.12 : 0.1), H * (0.85 + bl * 0.4), H * (b.bigBeak ? 0.38 : 0.26), H * bl, H * (b.bigBeak ? 0.42 : 0.28)); beak.rotation.x = Math.PI / 2 + (b.eagle ? 0.35 : 0.15);
  parts.eyes = [-1, 1].map(side => { const e = pivot(head, side * H * (b.owl ? 0.38 : 0.55), H * 0.15, H * (b.owl ? 0.7 : 0.55)); if (b.owl) mesh(GEO.sphere, mat(0xffd23f, { e: 0.3 }), e, 0, 0, 0, H * 0.26); mesh(GEO.sphere, EYE, e, 0, 0, H * 0.05, H * (b.owl ? 0.17 : 0.16)); mesh(GEO.sphereLow, SHINE, e, -side * H * 0.04, H * 0.05, H * 0.17, H * 0.05); return e; });
  if (b.crest) for (let i = 0; i < 3; i++) { const c = mesh(GEO.cone, sec, head, 0, H * (0.95 + i * 0.12), -H * (0.1 + i * 0.12), H * 0.08, H * 0.8, H * 0.08); c.rotation.x = -0.6 - i * 0.15; }
  if (b.owl) [-1, 1].forEach(side => { const t = mesh(GEO.cone4, main, head, side * H * 0.55, H * 0.85, 0, H * 0.18, H * 0.45, H * 0.1); t.rotation.z = -side * 0.35; });
  parts.wings = [-1, 1].map(side => { const p = pivot(rig, side * R * 0.82, R * 0.3, R * 0.05); mesh(GEO.sphere, acc, p, side * R * 0.08, -R * 0.2, -R * 0.35, R * 0.16, R * 0.62 * b.wings, R * 1.05 * b.wings); return p; });
  const tail = pivot(rig, 0, R * 0.05, -R * 1.2); parts.tail = tail;
  const tlen = b.tailLong ? 2.6 : 1.1; const t = mesh(GEO.cone4, b.tailLong ? acc : main, tail, 0, 0, -R * tlen * 0.5, R * 0.45, R * tlen, R * 0.12); t.rotation.x = -Math.PI / 2 - 0.2;
  parts.legs = [-1, 1].map(side => { const p = pivot(rig, side * R * 0.35, -R * 0.75, R * 0.1); mesh(GEO.cyl, beakM, p, 0, -R * 0.3, 0, R * 0.07, R * 0.6, R * 0.07); mesh(GEO.sphereLow, beakM, p, 0, -R * 0.62, R * 0.12, R * 0.16, R * 0.05, R * 0.22); return p; });
  parts.collar = pivot(head, 0, -H * 0.85, 0); parts.collarR = H * 0.6;
  parts.headTop = pivot(head, 0, H * 0.95, 0); parts.H = H; parts.chest = pivot(rig, 0, 0, 0); parts.chestR = R;
  parts.bird = true;
  return root;
}

/* ---------- dragones ---------- */
function buildDragon(b, parts) {
  const s = b.size, R = 0.17 * s, L = 0.75 * s, leg = 0.2 * s, [c0, c1] = b.coat, main = mat(c0, { r: 0.55 }), belly = mat(c1, { r: 0.6 }), acc = mat(b.accent, { r: 0.5 }), glow = mat(b.glow, { e: 1, r: 0.3 });
  const root = new THREE.Group(), rig = pivot(root, 0, leg + R * 0.7, 0); parts.rig = rig; parts.baseY = leg + R * 0.7; parts.R = R; parts.L = L; parts.leg = leg;
  mesh(GEO.sphere, main, rig, 0, 0, 0, R, R * 0.92, L / 2);
  mesh(GEO.sphere, belly, rig, 0, -R * 0.3, L * 0.08, R * 0.82, R * 0.6, L * 0.38);
  for (let i = 0; i < 5; i++) mesh(GEO.cone4, acc, rig, 0, R * 0.9, L * 0.3 - i * L * 0.16, R * 0.12, R * 0.35, R * 0.18);   // crestas del lomo
  const neck = pivot(rig, 0, R * 0.5, L * 0.42); neck.rotation.x = 0.5; parts.neck = neck;
  mesh(GEO.capsule, main, neck, 0, R * 0.35, 0, R * 0.42, R * 0.6, R * 0.42);
  const head = pivot(neck, 0, R * 0.95, R * 0.1); head.rotation.x = -0.5; parts.head = head;
  const H = R * 0.75;
  mesh(GEO.sphere, main, head, 0, 0, 0, H, H * 0.85, H * 1.05);
  mesh(GEO.sphere, main, head, 0, -H * 0.25, H * 0.85, H * 0.62, H * 0.45, H * 0.75);
  [-1, 1].forEach(side => { mesh(GEO.sphereLow, NOSE, head, side * H * 0.22, -H * 0.12, H * 1.48, H * 0.07); const h = mesh(GEO.cone, belly, head, side * H * 0.45, H * 0.75, -H * 0.4, H * 0.14, H * 0.8, H * 0.14); h.rotation.x = -0.7; h.rotation.z = -side * 0.2; });
  parts.jaw = pivot(head, 0, -H * 0.55, H * 0.5); mesh(GEO.sphere, belly, parts.jaw, 0, 0, H * 0.3, H * 0.5, H * 0.18, H * 0.6);
  parts.eyes = [-1, 1].map(side => { const e = pivot(head, side * H * 0.5, H * 0.25, H * 0.55); mesh(GEO.sphere, mat(b.glow, { e: 0.6 }), e, 0, 0, 0, H * 0.2); mesh(GEO.sphere, EYE, e, 0, 0, H * 0.1, H * 0.08, H * 0.16, H * 0.05); mesh(GEO.sphereLow, SHINE, e, -side * H * 0.04, H * 0.07, H * 0.16, H * 0.04); return e; });
  parts.ears = [];
  const tail = pivot(rig, 0, R * 0.2, -L * 0.45); parts.tail = tail; parts.tailSegs = [];
  let p = tail; for (let i = 0; i < 4; i++) { const q = pivot(p, 0, 0, i ? -L * 0.2 : 0); q.rotation.x = i ? 0.12 : -0.15; mesh(GEO.sphere, main, q, 0, 0, -L * 0.1, R * (0.42 - i * 0.08), R * (0.42 - i * 0.08), L * 0.13); parts.tailSegs.push(q); p = q; }
  mesh(GEO.cone4, glow, p, 0, 0, -L * 0.22, R * 0.25, R * 0.4, R * 0.1).rotation.x = -Math.PI / 2;
  parts.legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const q = pivot(rig, sx * R * 0.6, -R * 0.35, sz * L * 0.28); mesh(GEO.capsule, main, q, 0, -leg * 0.35, 0, R * 0.25, leg * 0.45, R * 0.25); mesh(GEO.sphere, belly, q, 0, -leg + R * 0.05, R * 0.1, R * 0.3, R * 0.18, R * 0.38); return q; });
  const wm = wingMaterial(b.accent);
  parts.wings = [-1, 1].map(side => { const q = pivot(rig, side * R * 0.6, R * 0.75, L * 0.12); const w = new THREE.Mesh(wing, wm); w.scale.set(side * L * 0.9 * b.wings, 1, L * 0.8 * b.wings); w.castShadow = true; q.add(w); mesh(GEO.cyl, acc, q, side * L * 0.45 * b.wings, 0, 0, R * 0.07, L * 0.9 * b.wings, R * 0.07).rotation.z = Math.PI / 2; return q; });
  parts.collar = pivot(neck, 0, R * 0.55, 0); parts.collarR = R * 0.5;
  parts.headTop = pivot(head, 0, H * 0.85, -H * 0.2); parts.H = H; parts.chest = pivot(rig, 0, 0, L * 0.28); parts.chestR = R;
  parts.mouth = pivot(head, 0, -H * 0.2, H * 1.6);
  parts.dragon = true;
  return root;
}

/* ---------- accesorios sobre el modelo ---------- */
function dressPet(parts, acc = {}) {
  const items = {}; for (const [slot, id] of Object.entries(acc || {})) { const d = itemById(id); if (d && d.slot === slot) items[slot] = d; }
  const R = parts.collarR || 0.1;
  const neckRing = (d, r, thick = 1, parent = parts.collar) => { const t = mesh(GEO.torus, mat(d.color, { r: 0.5 }), parent, 0, 0, 0, r, r, r * thick); t.rotation.x = Math.PI / 2 - 0.3; return t; };
  if (items.collar) {
    neckRing(items.collar, R);
    if (items.collar.design === 'estrellas') for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mesh(GEO.sphereLow, mat(0xffd166, { e: 0.4 }), parts.collar, Math.cos(a) * R, Math.sin(a) * R * 0.3, Math.sin(a) * R, R * 0.12); }
    if (items.collar.design === 'flores') for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; mesh(GEO.sphereLow, mat(i % 2 ? 0xffffff : 0xff8fb8), parts.collar, Math.cos(a) * R, Math.sin(a) * R * 0.3, Math.sin(a) * R, R * 0.18); }
  }
  if (items.tag) { const t = mesh(GEO.disk, mat(items.tag.color, { m: 0.6, r: 0.3 }), parts.collar, 0, -R * 0.65, R * 0.95, R * 0.28, R * 0.28, R * 0.28); t.rotation.x = Math.PI / 2; }
  if (items.harness && parts.chest) {
    const h = mesh(GEO.torus, mat(items.harness.color, { r: 0.6 }), parts.chest, 0, 0, 0, parts.chestR, parts.chestR * 0.98, parts.chestR * 1.4); h.rotation.x = 0;
    mesh(GEO.sphere, mat(items.harness.color, { r: 0.6 }), parts.chest, 0, parts.chestR * 0.92, -parts.chestR * 0.3, parts.chestR * 0.35, parts.chestR * 0.12, parts.chestR * 0.6);
  }
  if (items.scarf) { const sc = mesh(GEO.cone4, mat(items.scarf.color, { r: 0.8 }), parts.collar, 0, -R * 0.55, R * 0.75, R * 0.85, R * 1.4, R * 0.3); sc.rotation.x = Math.PI + 0.35; if (items.scarf.design === 'tricolor') { mesh(GEO.cone4, mat(0xffffff), parts.collar, 0, -R * 0.65, R * 0.85, R * 0.45, R * 0.8, R * 0.32).rotation.x = Math.PI + 0.35; } }
  if (items.outfit && parts.rig && parts.L) { const o = mesh(GEO.sphere, mat(items.outfit.color, { r: 0.85 }), parts.rig, 0, parts.R * 0.08, parts.L * 0.05, parts.R * 1.1, parts.R * 1.02, parts.L * 0.36); if (items.outfit.id === 'sueter-tejido') for (let i = 0; i < 3; i++) mesh(GEO.torus, mat(0xffffff), parts.rig, 0, parts.R * 0.08, -parts.L * 0.12 + i * parts.L * 0.12, parts.R * 1.06, parts.R * 1.0, parts.R * 0.3); }
  if (items.hat && parts.headTop) {
    const H = parts.H, d = items.hat;
    if (d.id === 'gorrito-fiesta') { mesh(GEO.cone, mat(d.color), parts.headTop, 0, H * 0.35, 0, H * 0.32, H * 0.75, H * 0.32); mesh(GEO.sphereLow, mat(0xffd166), parts.headTop, 0, H * 0.75, 0, H * 0.1); }
    else if (d.id === 'sombrerito-charro') { mesh(GEO.disk, mat(d.color), parts.headTop, 0, H * 0.05, 0, H * 0.75, H * 0.4, H * 0.75); mesh(GEO.cyl, mat(d.color), parts.headTop, 0, H * 0.22, 0, H * 0.3, H * 0.32, H * 0.3); mesh(GEO.torus, mat(0xd9a441, { m: 0.5 }), parts.headTop, 0, H * 0.08, 0, H * 0.55, H * 0.55, H * 0.25).rotation.x = Math.PI / 2; }
    else if (d.id === 'corona-flores') for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; mesh(GEO.sphereLow, mat([0xff8fb8, 0xffd166, 0xffffff, 0x8fd16b][i % 4]), parts.headTop, Math.cos(a) * H * 0.42, 0, Math.sin(a) * H * 0.42, H * 0.12); }
  }
  // ancla de correa: encima del arnés si lo hay; si no, del collar
  const anchor = new THREE.Object3D();
  if (items.harness && parts.chest) { anchor.position.set(0, parts.chestR * 1.05, -parts.chestR * 0.2); parts.chest.add(anchor); } else { anchor.position.set(0, R * 0.9, -R * 0.2); parts.collar.add(anchor); }
  parts.leashAnchor = anchor;
  return items;
}

/* ---------- efecto de fuego mágico del dragón (solo visual) ---------- */
function flameFx(parent, color) {
  const g = new THREE.Group(); g.visible = false; parent.add(g);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
  const puffs = Array.from({ length: 8 }, (_, i) => { const p = new THREE.Mesh(GEO.sphereLow, m); p.userData.k = i / 8; g.add(p); return p; });
  return { group: g, update(t, size) { puffs.forEach(p => { const k = (p.userData.k + t * 1.8) % 1; p.position.set(Math.sin(k * 13) * 0.04 * size, Math.cos(k * 9) * 0.03 * size, k * 0.9 * size); p.scale.setScalar((0.05 + k * 0.16) * size); }); m.opacity = 0.75; }, dispose() { m.dispose(); } };
}

/** Crea el modelo de una raza con sus accesorios. */
export function createPetModel(breedId, acc = {}) {
  const b = breedById(breedId); if (!b) throw new Error('raza desconocida: ' + breedId);
  const parts = {};
  const group = b.species === 'ave' ? buildBird(b, parts) : b.form === 'dragon' ? buildDragon(b, parts) : buildQuad(b, parts);
  group.userData.dynamic = true; group.userData.pet = b.id;
  dressPet(parts, acc);
  const fire = parts.dragon ? flameFx(parts.mouth, b.glow) : null;
  const pose = { lean: 0, y: 0, roll: 0, legs: [0, 0, 0, 0], headX: 0, headY: 0, tail: 0, ear: 0, wing: 0, eyes: 1, jaw: 0, spin: 0 };
  let time = Math.random() * 10, gait = 0, blink = 2 + Math.random() * 3;

  function update(dt, { speed = 0, action = null, air = 0, t = 0 } = {}) {
    time += dt; const run = Math.min(1, speed / 4.5);
    gait += dt * (speed > 0.05 ? (parts.bird ? 10 : 5 + speed * 2.6) : 0);
    blink -= dt; const blinking = blink < 0.12; if (blink < 0) blink = 2.5 + Math.random() * 3.5;
    const T = { lean: 0, y: 0, roll: 0, legs: [0, 0, 0, 0], headX: Math.sin(time * 0.6) * 0.06, headY: Math.sin(time * 0.37) * 0.15, tail: Math.sin(time * 2) * 0.2, ear: 0, wing: 0, eyes: blinking ? 0.1 : 1, jaw: 0, spin: 0 };
    const sw = Math.sin(gait) * (0.35 + run * 0.45);
    if (parts.bird) {
      const flying = action === 'fly' || air > 0.15;
      if (flying) { T.wing = 0.85 + Math.sin(time * 22) * 0.7; T.lean = 0.25; T.legs = [-0.6, -0.6]; T.tail = 0.15; }
      else if (action === 'land') { T.wing = 0.6 + Math.sin(time * 14) * 0.35; }
      else if (speed > 0.05) { T.y = Math.abs(Math.sin(gait)) * 0.02; T.legs = [sw, -sw]; }
      if (action === 'dance') { T.spin = time * 6; T.wing = 0.7 + Math.sin(time * 18) * 0.4; T.y = Math.abs(Math.sin(time * 9)) * 0.06; }
      if (action === 'speak') { T.headX = Math.sin(time * 14) * 0.2; T.wing = Math.abs(Math.sin(time * 8)) * 0.3; }
      if (action === 'sleep') { T.eyes = 0.1; T.headX = 0.45; T.wing = 0; }
      if (action === 'eat') T.headX = 0.5 + Math.sin(time * 12) * 0.2;
    } else {
      // patas: diagonales en fase (trote)
      if (speed > 0.05) { T.legs = [sw, -sw, -sw, sw]; T.y = Math.abs(Math.sin(gait * 2)) * 0.025 * (1 + run); T.lean = run * 0.08; T.tail = Math.sin(time * 9) * 0.45; T.ear = run * -0.3; }
      if (action === 'sit') { T.lean = -0.42; T.y = -parts.leg * 0.32; T.legs = [0.42, 0.42, -1.05, -1.05]; T.headX = 0.25; T.tail = 0.1; }
      if (action === 'sleep') { T.y = -parts.leg * 0.92; T.legs = [-1.35, -1.35, 1.35, 1.35]; T.headX = 0.5; T.headY = 0.4; T.eyes = 0.08; T.tail = 0.6; T.roll = 0.08; }
      if (action === 'wag') { T.tail = Math.sin(time * 16) * 0.75; T.headX = -0.15; T.ear = 0.15; }
      if (action === 'jump') { const k = Math.abs(Math.sin(time * 7)); T.y = k * 0.22; T.legs = [-0.6 * k, -0.6 * k, 0.6 * k, 0.6 * k]; T.tail = Math.sin(time * 16) * 0.8; }
      if (action === 'dance') { T.spin = time * 5; T.y = Math.abs(Math.sin(time * 10)) * 0.12; T.lean = -0.35; T.legs = [-0.9 + Math.sin(time * 12) * 0.4, -0.9 - Math.sin(time * 12) * 0.4, -0.4, -0.4]; T.tail = Math.sin(time * 18) * 0.8; }
      if (action === 'stretch') { const k = (Math.sin(time * 1.4) + 1) / 2; T.lean = 0.3 * k; T.y = -parts.leg * 0.3 * k; T.legs = [-0.9 * k, -0.9 * k, 0.15, 0.15]; T.tail = 0.6; T.eyes = 0.3; }
      if (action === 'groom') { T.lean = -0.4; T.y = -parts.leg * 0.3; T.legs = [-1.1 + Math.sin(time * 8) * 0.2, 0.3, -1.3, -1.3]; T.headX = 0.55; T.headY = -0.45; T.eyes = 0.3; }
      if (action === 'speak') { T.jaw = Math.abs(Math.sin(time * 14)) * 0.4; T.headX = -0.2 + Math.sin(time * 14) * 0.05; }
      if (action === 'play') { T.lean = 0.35; T.y = -parts.leg * 0.25; T.legs = [-1.0, -1.0, 0.1, 0.1]; T.tail = Math.sin(time * 14) * 0.8; T.headX = 0.1; }
      if (action === 'eat') { T.lean = 0.25; T.headX = 0.75 + Math.sin(time * 10) * 0.08; T.jaw = Math.abs(Math.sin(time * 10)) * 0.3; T.tail = Math.sin(time * 10) * 0.5; }
      if (parts.dragon) {
        const hover = action === 'fly' || air > 0.15;
        T.wing = hover ? -0.35 + Math.sin(time * 9) * 0.75 : -1.15 + Math.sin(time * 1.2) * 0.06;
        if (hover) { T.legs = [-0.5, -0.5, 0.5, 0.5]; T.lean = 0.1; }
        if (action === 'fire') { T.jaw = 0.45; T.headX = -0.15; T.wing = -0.6 + Math.sin(time * 6) * 0.2; }
        if (action === 'dance') T.wing = Math.sin(time * 12) * 0.8;
      }
    }
    if (action === 'sleep' && parts.bird) T.y = -parts.baseY * 0.15;
    const k = Math.min(1, dt * 12);
    for (const key of ['lean', 'y', 'roll', 'headX', 'headY', 'tail', 'ear', 'wing', 'jaw']) pose[key] += (T[key] - pose[key]) * k;
    pose.legs = pose.legs.map((v, i) => v + ((T.legs[i] || 0) - v) * k);
    pose.eyes += (T.eyes - pose.eyes) * Math.min(1, dt * 25);
    // aplicar
    parts.rig.position.y = parts.baseY + pose.y; parts.rig.rotation.x = pose.lean; parts.rig.rotation.z = pose.roll;
    parts.rig.rotation.y = T.spin ? T.spin % (Math.PI * 2) : damp(parts.rig.rotation.y % (Math.PI * 2), 0, 6, dt);
    parts.head.rotation.x = pose.headX + (parts.dragon ? -0.5 : 0); parts.head.rotation.y = pose.headY;
    (parts.legs || []).forEach((l, i) => { l.rotation.x = pose.legs[i] || 0; });
    if (parts.tail) { parts.tail.rotation.y = pose.tail; if (parts.tailSegs) parts.tailSegs.forEach((q, i) => { q.rotation.y = i ? pose.tail * 0.35 : 0; }); }
    (parts.ears || []).forEach((e, i) => { e.rotation.x = pose.ear; e.rotation.z = (i ? -1 : 1) * Math.sin(time * 0.9 + i) * 0.04; });
    (parts.eyes || []).forEach(e => { e.scale.y = Math.max(0.08, pose.eyes); });
    if (parts.jaw) parts.jaw.rotation.x = pose.jaw;
    if (parts.wings) parts.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * pose.wing; });
    if (fire) { const on = action === 'fire'; fire.group.visible = on; if (on) fire.update(time, parts.R * 4); }
  }

  function dispose() {
    group.traverse(o => { if (o.isMesh && o.material && !o.material.userData.shared) o.material.dispose(); });   // geometrías y materiales son compartidos
    fire?.dispose();
  }
  return { group, breed: b, leashAnchor: parts.leashAnchor, head: parts.head, update, dispose, height: (parts.baseY || 0.3) + (parts.R || 0.1) * 2.2 };
}
