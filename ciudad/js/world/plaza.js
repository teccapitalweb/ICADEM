// Escenario 2 · La ciudad: plaza central, calles, parques y los edificios de las diez misiones.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { NPC_LOOKS } from '../characters/catalog.js';
import { KID_SCENES } from '../edu/family.js';
import { mat, box, cyl, sph, plane, slab, sign, grassTexture, pavingTexture, roadTexture, tree, bush, flowers, lamp, bench, cloud, skyDome, sunLight, mergeStatic, dotTexture } from './kit.js';
import { BUILDINGS, buildBuilding, doorPoint, footprint } from './buildings.js';
import { PLACES, placeByBuilding } from './places.js';
import { FLIGHTS } from '../vivo/flight.js';

/** Puntos de llegada a la plaza al salir de un edificio, cuando el de la puerta no deja ver bien
 *  (toldo del supermercado) o cae sobre vegetación (obra). Deben coincidir con SCENE_RULES.plaza.entries. */
/** Entrada al Parque de retos (minijuegos), al final de la avenida sur. */
export const PARK_GATE = Object.freeze({ x: 0, z: 38.5, arrival: { x: 0, z: 34.5, yaw: Math.PI } });
/** Portal del Distrito del Saber, al final de la calle sur (versión 1.3). */
export const DISTRICT_GATE = Object.freeze({ x: 0, z: -38.5, arrival: { x: 0, z: -34.5, yaw: 0 } });
export const ARRIVALS = Object.freeze(Object.fromEntries(PLACES.filter(p => p.arrival).map(p => [p.spawn, p.arrival])));
/** Punto de llegada de cada lugar al salir de su edificio. */
export function arrivalOf(place) { const b = BUILDINGS.find(x => x.id === place.building), d = doorPoint(b, 7.4); const at = place.arrival || d; return { x: at.x, z: at.z, yaw: place.yaw ?? d.yaw + Math.PI }; }
/** Ambulancia estacionada frente al hospital (sin árboles alrededor). */
const AMBULANCE = (() => { const p = doorPoint(BUILDINGS.find(b => b.id === 'hospital'), 4.2); return { x: p.x + 4.6, z: p.z + 0.6 }; })();

const HALF = 48;

export function buildPlaza(api) {
  const g = new THREE.Group();
  const col = new CollisionWorld().setBounds(-HALF + 2, -HALF + 2, HALF - 2, HALF - 2);
  const animated = { clouds: [], trees: [], spin: [], blink: [], rotate: [], water: null, drops: null };

  /* suelo */
  const ground = plane(HALF * 2 + 60, HALF * 2 + 60, mat(0xffffff, { map: grassTexture(46, 46), r: 1 }), 0, 0, 0, g, { rx: -Math.PI / 2 });
  ground.receiveShadow = true;
  const roadM = mat(0xffffff, { map: roadTexture(2, 30), r: 0.95 }), roadM2 = mat(0xffffff, { map: roadTexture(30, 2), r: 0.95 });
  plane(7, HALF * 2, roadM, 0, 0.02, 0, g, { rx: -Math.PI / 2 });
  plane(HALF * 2, 7, roadM2, 0, 0.021, 0, g, { rx: -Math.PI / 2 });
  const dashM = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  for (let i = -HALF + 3; i < HALF; i += 4) { if (Math.abs(i) < 17) continue; plane(0.22, 1.8, dashM, 0, 0.03, i, g, { rx: -Math.PI / 2 }); plane(1.8, 0.22, dashM, i, 0.03, 0, g, { rx: -Math.PI / 2 }); }
  // banquetas frente a los edificios
  const walk = (w, d, x, z) => plane(w, d, mat(0xffffff, { map: pavingTexture(w / 3, d / 3), r: 0.9 }), x, 0.025, z, g, { rx: -Math.PI / 2 });
  walk(88, 5, 0, -20.5); walk(88, 5, 0, 20.5); walk(5, 36, -26.5, 0); walk(5, 36, 26.5, 0);
  for (const b of BUILDINGS) { const p = doorPoint(b, 0.2), f = footprint(b); const horizontal = b.side === 'E' || b.side === 'W'; walk(horizontal ? 6 : 4, horizontal ? 4 : 6, horizontal ? (p.x + (b.side === 'E' ? 2.6 : -2.6)) : p.x, horizontal ? p.z : (p.z + (b.side === 'S' ? 2.6 : -2.6))); void f; }

  /* plaza central */
  const plazaM = mat(0xffffff, { map: pavingTexture(9, 9, '#f4e3c3', '#ecd7b0', '#d6bf94'), r: 0.85 });
  cyl(15, 15, 0.14, plazaM, 0, 0, 0, g, { seg: 56, cast: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(10.2, 11, 56), mat(0xe86a5c, { r: 0.9 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(14.2, 15, 56), mat(0x2f9e8f, { r: 0.9 })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.15; g.add(ring2);
  // fuente
  const stone = mat(0xf3eee2, { r: 0.8 }), stone2 = mat(0xd9d2c0, { r: 0.85 });
  cyl(4.2, 4.4, 0.7, stone2, 0, 0.14, 0, g, { seg: 40 });
  cyl(3.8, 3.8, 0.12, mat(0x6fd3f2, { r: 0.12, m: 0.3, opacity: 0.86 }), 0, 0.74, 0, g, { seg: 40, cast: false });
  animated.water = g.children[g.children.length - 1];
  cyl(0.7, 0.9, 1.6, stone, 0, 0.7, 0, g, { seg: 18 });
  cyl(1.9, 0.6, 0.35, stone, 0, 2.3, 0, g, { seg: 28 });
  cyl(1.7, 1.7, 0.08, mat(0x6fd3f2, { r: 0.12, m: 0.3, opacity: 0.86 }), 0, 2.6, 0, g, { seg: 28, cast: false });
  cyl(0.28, 0.4, 1.3, stone, 0, 2.65, 0, g, { seg: 14 });
  sph(0.42, mat(0xffd166, { m: 0.7, r: 0.25, e: 0x8a6510, ei: 0.25 }), 0, 4.25, 0, g);
  col.addCircle(0, 0, 4.5);
  // gotas de la fuente
  const dropGeo = new THREE.BufferGeometry(), N = 140, pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seed[i * 3] = Math.random() * 6.28; seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = 0.6 + Math.random() * 0.9; }
  dropGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const drops = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0xdff6ff, size: 0.16, map: dotTexture(), alphaTest: 0.05, transparent: true, opacity: 0.9, depthWrite: false }));
  drops.frustumCulled = false; g.add(drops); animated.drops = { mesh: drops, seed, N };
  // bancas, faroles y jardineras alrededor de la plaza
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8, r = 12.4;
    bench(Math.cos(a) * r, Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a)), g); col.addCircle(Math.cos(a) * r, Math.sin(a) * r, 0.75);
    const l = lamp(Math.cos(a + 0.25) * 13.6, Math.sin(a + 0.25) * 13.6, g); col.addCircle(l.position.x, l.position.z, 0.25);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, r = 8;
    cyl(1.5, 1.3, 0.55, stone2, Math.cos(a) * r, 0.14, Math.sin(a) * r, g, { seg: 20 });
    flowers(Math.cos(a) * r, Math.sin(a) * r, g).position.y = 0.66;
    bush(Math.cos(a) * r, Math.sin(a) * r, g, 0x58b565, 0.8).position.y = 0.62;
    col.addCircle(Math.cos(a) * r, Math.sin(a) * r, 1.55);
  }
  // letrero de bienvenida
  const arch = new THREE.Group(); arch.position.set(0, 0, 17.4); g.add(arch);
  for (const s of [-1, 1]) { cyl(0.22, 0.26, 4.4, mat(0x12325f, { r: 0.6 }), s * 4.6, 0, 0, arch, { seg: 12 }); col.addCircle(s * 4.6, 17.4, 0.4); }
  box(10, 1.25, 0.3, mat(0x12325f, { r: 0.6 }), 0, 3.9, 0, arch);
  for (const rz of [0, Math.PI]) { const sg = sign('CIUDAD ICADEM', 9.2, 1.0, { bg: '#12325f', fg: '#ffd166' }); sg.position.set(0, 4.52, rz ? -0.16 : 0.16); sg.rotation.y = rz; arch.add(sg); }

  /* edificios */
  for (const b of BUILDINGS) {
    const bg = buildBuilding(b, g), f = footprint(b);
    if (b.style === 'bank' || b.style === 'court') col.addBoxAt(b.x, b.z + 0.9, f.w + 0.6, f.d + 2.2, b.h); else col.addBoxAt(b.x, b.z, f.w + 0.5, f.d + 0.5, b.h);
    bg.traverse(o => { if (o.userData.spin) animated.spin.push(o); if (o.userData.blink) animated.blink.push(o); if (o.userData.rotate) animated.rotate.push(o); });
  }
  // parque con kiosco en el lote libre
  const kx = 35, kz = 9;
  cyl(3.6, 3.8, 0.4, stone2, kx, 0, kz, g, { seg: 8 });
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cyl(0.1, 0.1, 2.6, mat(0xffffff), kx + Math.cos(a) * 3.2, 0.4, kz + Math.sin(a) * 3.2, g, { seg: 8 }); }
  const kroof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 1.9, 8), mat(0xe86a5c, { r: 0.8 })); kroof.position.set(kx, 3.95, kz); kroof.castShadow = true; g.add(kroof);
  sph(0.25, mat(0xffd166, { m: 0.7, r: 0.3 }), kx, 5.05, kz, g);
  const ks = sign('PARQUE DEL SABER', 3.6, 0.6, { bg: '#2f9e8f', fg: '#ffffff' }); ks.position.set(kx - 3.9, 2.4, kz); ks.rotation.y = -Math.PI / 2; g.add(ks);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.39; if (Math.abs(Math.cos(a) + 1) < 0.2) continue; col.addCircle(kx + Math.cos(a) * 3.5, kz + Math.sin(a) * 3.5, 0.5); }

  /* vegetación */
  const spots = [];
  const rnd = (() => { let s = 21; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (const [x0, z0, x1, z1] of [[5, 5, 22, 16], [-22, 5, -5, 16], [5, -16, 22, -5], [-22, -16, -5, -5]]) {
    for (let i = 0; i < 7; i++) spots.push([x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)]);
  }
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283, r = HALF - 2.5 + rnd() * 3; spots.push([Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02]); }
  for (const [x, z] of [[-22, -21.5], [-4.5, -22], [4.5, -22], [22, -22], [-22, 22], [-4.5, 22], [4.5, 22], [22, 22], [-27, -17], [-27, 17], [27, -17], [27, 17]]) spots.push([x, z]);
  // Nada de árboles sobre los puntos de llegada frente a cada puerta (ahí aparecen los jugadores).
  const arrivals = [...BUILDINGS.map(b => doorPoint(b, 7.4)), ...Object.values(ARRIVALS), PARK_GATE.arrival, { x: PARK_GATE.x, z: PARK_GATE.z }, DISTRICT_GATE.arrival, { x: DISTRICT_GATE.x, z: DISTRICT_GATE.z }];
  for (const [x, z] of spots) {
    if (Math.hypot(x, z) < 16.5 || (Math.abs(x) < 4.5 || Math.abs(z) < 4.5)) continue;
    if (arrivals.some(p => Math.hypot(x - p.x, z - p.z) < 3.2)) continue;
    if (Math.hypot(x - AMBULANCE.x, z - AMBULANCE.z) < 3.6) continue;   // lugar de la ambulancia
    const t = tree(x, z, g, { scale: 0.85 + rnd() * 0.55, color: [0x4fae5a, 0x3f9a4d, 0x58b565][Math.floor(rnd() * 3)], color2: [0x6cc671, 0x7fd486, 0x8bd97a][Math.floor(rnd() * 3)] });
    animated.trees.push(t); col.addCircle(x, z, 0.4);
  }
  for (let i = 0; i < 26; i++) { const x = (rnd() - 0.5) * 40, z = (rnd() - 0.5) * 30; if (Math.hypot(x, z) < 16.5 || Math.abs(x) < 5 || Math.abs(z) < 5 || Math.abs(z) > 17) continue; (i % 2 ? flowers(x, z, g) : bush(x, z, g, 0x58b565, 0.7 + rnd() * 0.4)); }
  for (const [x, z] of [[-4.2, -9], [4.2, -9], [-4.2, 9], [4.2, 9], [-9, -4.2], [9, -4.2], [-9, 4.2], [9, 4.2], [-4.2, -30], [4.2, -30], [-4.2, 30], [4.2, 30], [-30, -4.2], [30, -4.2], [-30, 4.2], [30, 4.2], [-19, -18.6], [19, -18.6], [-19, 18.6], [19, 18.6]]) {
    if (Math.hypot(x, z) < 15.5) continue; const l = lamp(x, z, g); col.addCircle(x, z, 0.25);
  }

  /* ambiente: banderines, jardineras, mobiliario y vida (todo ligero: casi todo se fusiona) */
  const flagM = [0xe86a5c, 0xffd166, 0x2f9e8f, 0x3a8fd6, 0xb56bd6, 0xffffff].map(c => mat(c, { r: 0.9, side: THREE.DoubleSide }));
  const flagGeo = new THREE.BufferGeometry(); flagGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.17, 0, 0, 0.17, 0, 0, 0, -0.36, 0]), 3)); flagGeo.computeVertexNormals();
  const cord = mat(0x4a3a2a, { r: 1 });
  for (let i = 0; i < 8; i++) {
    const a0 = i * Math.PI / 4 + Math.PI / 8 + 0.25, a1 = a0 + Math.PI / 4, x0 = Math.cos(a0) * 13.6, z0 = Math.sin(a0) * 13.6, x1 = Math.cos(a1) * 13.6, z1 = Math.sin(a1) * 13.6;
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let k = 0; k < 9; k++) {
      const t = (k + 0.5) / 9, sag = Math.sin(t * Math.PI) * 0.45, f = new THREE.Mesh(flagGeo, flagM[(i + k) % flagM.length]);
      f.position.set(x0 + (x1 - x0) * t, 3.55 - sag, z0 + (z1 - z0) * t); f.rotation.y = yaw + Math.PI / 2; f.castShadow = false; g.add(f);
      if (k < 8) { const t2 = (k + 1.5) / 9, sag2 = Math.sin(t2 * Math.PI) * 0.45, seg = box(0.015, 0.015, len / 9 + 0.02, cord, x0 + (x1 - x0) * (t + t2) / 2, 3.55 - (sag + sag2) / 2, z0 + (z1 - z0) * (t + t2) / 2, g, { ry: yaw, cast: false }); seg.rotation.x = Math.atan2(sag2 - sag, len / 9); }
    }
  }
  // jardineras con flores y botes de basura al borde de las banquetas (fuera de los pasos)
  for (const [x, z] of [[-9, -17.2], [9, -17.2], [-9, 17.2], [9, 17.2], [-23.4, -9], [-23.4, 9], [23.4, -9], [23.4, 9]]) {
    box(1.5, 0.5, 0.7, mat(0xe6dccb, { r: 0.9 }), x, 0, z, g); box(1.36, 0.08, 0.56, mat(0x5a3d22, { r: 1 }), x, 0.46, z, g, { cast: false });
    flowers(x - 0.35, z, g).position.y = 0.5; flowers(x + 0.35, z, g, [0xffffff, 0xff8fb1, 0xffd166]).position.y = 0.5; col.addBoxAt(x, z, 1.6, 0.8);
  }
  for (const [x, z] of [[-6, -17.4], [6, 17.4], [-23.6, -4.6], [23.6, 4.6]]) { cyl(0.26, 0.22, 0.75, mat(0x2f9e8f, { r: 0.7 }), x, 0, z, g, { seg: 12 }); cyl(0.29, 0.29, 0.06, mat(0x12325f, { r: 0.6 }), x, 0.75, z, g, { seg: 12, cast: false }); col.addCircle(x, z, 0.32); }
  // carrito de aguas frescas junto a la plaza
  const cart = new THREE.Group(); cart.position.set(-17.5, 0, 12.5); cart.rotation.y = 0.6; g.add(cart);
  box(2.0, 0.9, 1.0, mat(0xfff0d6, { r: 0.8 }), 0, 0.45, 0, cart); box(2.1, 0.08, 1.1, mat(0xe86a5c, { r: 0.8 }), 0, 1.35, 0, cart);
  for (const sx of [-0.9, 0.9]) { cyl(0.03, 0.03, 1.2, mat(0x8a5a36), sx, 1.35, 0.45, cart, { seg: 6 }); cyl(0.03, 0.03, 1.2, mat(0x8a5a36), sx, 1.35, -0.45, cart, { seg: 6 }); }
  for (let i = 0; i < 4; i++) box(0.55, 0.06, 1.3, mat(i % 2 ? 0xffffff : 0xe86a5c, { r: 0.9 }), -0.825 + i * 0.55, 2.55, 0, cart, { cast: i === 0 });
  for (const [dx, c] of [[-0.6, 0xff8fb1], [0, 0xfff3a8], [0.6, 0xb7e08a]]) { cyl(0.17, 0.15, 0.4, mat(c, { r: 0.2, opacity: 0.85 }), dx, 1.39, 0.1, cart, { seg: 14, cast: false }); cyl(0.18, 0.18, 0.03, mat(0xffffff), dx, 1.79, 0.1, cart, { seg: 14, cast: false }); }
  for (const sx of [-0.7, 0.7]) { const w = cyl(0.3, 0.3, 0.08, mat(0x3a2a1c), sx, 0.3, 0.55, cart, { seg: 14 }); w.rotation.x = Math.PI / 2; }
  const cs = sign('AGUAS FRESCAS', 1.8, 0.3, { bg: '#2f9e8f', fg: '#ffffff' }); cs.position.set(0, 0.95, 0.51); cart.add(cs);
  col.addCircle(-17.5, 12.5, 1.3);
  // aves que sobrevuelan la plaza y hojas que flotan (dinámicos, muy baratos)
  const birdGeo = new THREE.BufferGeometry(); birdGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.16, 0, 0, -0.16, 0.42, 0.05, 0]), 3)); birdGeo.computeVertexNormals();
  const birdM = new THREE.MeshBasicMaterial({ color: 0x2a3550, side: THREE.DoubleSide });
  animated.birds = Array.from({ length: 7 }, (_, i) => { const b = new THREE.Group(); b.userData.dynamic = true; const l = new THREE.Mesh(birdGeo, birdM), r = new THREE.Mesh(birdGeo, birdM); r.scale.x = -1; b.add(l, r); g.add(b); return { b, l, r, radius: 16 + (i % 3) * 7, h: 15 + (i % 4) * 2.2, speed: 0.16 + (i % 3) * 0.035, phase: i * 0.9 }; });
  const leafN = 60, leafPos = new Float32Array(leafN * 3), leafSeed = Array.from({ length: leafN }, () => [(Math.random() - 0.5) * 70, Math.random() * 9 + 1, (Math.random() - 0.5) * 70, Math.random() * 6.28]);
  const leafGeo = new THREE.BufferGeometry(); leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
  const leaves = new THREE.Points(leafGeo, new THREE.PointsMaterial({ color: 0xfff1b8, size: 0.13, map: dotTexture(), alphaTest: 0.05, transparent: true, opacity: 0.75, depthWrite: false })); leaves.frustumCulled = false; g.add(leaves); animated.leaves = { leaves, leafSeed, leafN };

  /* fondo: colinas y cielo */
  const hillM = [mat(0x8fd08a, { flat: true, r: 1 }), mat(0x79c2a0, { flat: true, r: 1 }), mat(0x9bd6b0, { flat: true, r: 1 })];
  for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283 + 0.1, r = 86 + (i % 3) * 14; const h = new THREE.Mesh(new THREE.ConeGeometry(20 + (i % 4) * 7, 14 + (i % 5) * 6, 7), hillM[i % 3]); h.position.set(Math.cos(a) * r, 4 + (i % 5) * 2, Math.sin(a) * r); h.rotation.y = i; g.add(h); }
  g.add(skyDome(0x4aa3f5, 0xcdeeff, 0xbfe7c7));
  for (let i = 0; i < 9; i++) animated.clouds.push(cloud(-110 + i * 28, 34 + (i % 3) * 7, -70 + (i % 4) * 42, g, 1 + (i % 3) * 0.4));
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff3bf, fog: false })); sunDisc.position.set(90, 95, 60); g.add(sunDisc);

  /* luces */
  g.add(new THREE.HemisphereLight(0xdff1ff, 0x8fbf7a, 1.15));
  const sun = sunLight(g, { x: 34, y: 52, z: 26, intensity: 2.5, area: 46 });
  /* portal del Parque de retos */
  {
    const gx = PARK_GATE.x, gz = PARK_GATE.z, teal = mat(0x2f9e8f, { r: 0.5 }), sunM = mat(0xffd166, { r: 0.5 });
    for (const s2 of [-1, 1]) { box(0.5, 3.6, 0.5, teal, gx + s2 * 2.4, 0, gz, g); sph(0.38, sunM, gx + s2 * 2.4, 3.8, gz, g, { seg: 12, rings: 8 }); col.addCircle(gx + s2 * 2.4, gz, 0.4); }
    box(5.4, 0.6, 0.45, teal, gx, 3.3, gz, g);
    const ps = sign('PARQUE DE RETOS', 3.6, 0.55, { bg: '#ffd166', fg: '#0f1f3d', sub: 'Minijuegos' }); ps.position.set(gx, 3.6, gz - 0.26); ps.rotation.y = Math.PI; g.add(ps);
  }
  /* portal del Distrito del Saber (calle sur) */
  {
    const gx = DISTRICT_GATE.x, gz = DISTRICT_GATE.z, violet = mat(0x7c5cc4, { r: 0.5 }), sunM = mat(0xffd166, { r: 0.5 });
    for (const s2 of [-1, 1]) { box(0.5, 3.8, 0.5, violet, gx + s2 * 2.6, 0, gz, g); sph(0.38, sunM, gx + s2 * 2.6, 4.0, gz, g, { seg: 12, rings: 8 }); col.addCircle(gx + s2 * 2.6, gz, 0.4); }
    box(5.8, 0.6, 0.45, violet, gx, 3.5, gz, g);
    const ds = sign('DISTRITO DEL SABER', 3.8, 0.55, { bg: '#ffd166', fg: '#2a1c55', sub: 'Laberinto · Laboratorio · Escape' }); ds.position.set(gx, 3.8, gz + 0.26); g.add(ds);
  }
  /* Helipuerto de dragones (Mundo vivo): despegue y aterrizaje del vuelo panorámico */
  {
    const P = FLIGHTS.plaza.pad, gold = mat(0xffd166, { r: 0.45, m: 0.2 });
    cyl(P.r, P.r, 0.06, mat(0x2a3f6b, { r: 0.85 }), P.x, 0.01, P.z, g, { seg: 40, cast: false });
    cyl(P.r - 0.35, P.r - 0.35, 0.07, mat(0x3a5a96, { r: 0.85 }), P.x, 0.012, P.z, g, { seg: 40, cast: false });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(0.18, 0.04, 0.7, gold, P.x + Math.cos(a) * (P.r - 0.2), 0.05, P.z + Math.sin(a) * (P.r - 0.2), g, { ry: -a + Math.PI / 2, cast: false }); }
    for (const s2 of [-1, 1]) { cyl(0.12, 0.14, 2.6, mat(0x12325f, { r: 0.6 }), P.x + 0.4, 0, P.z + s2 * (P.r + 0.35), g, { seg: 10 }); sph(0.2, mat(0xffb347, { e: 0xffb347, ei: 0.8 }), P.x + 0.4, 2.7, P.z + s2 * (P.r + 0.35), g, { seg: 12, rings: 8 }); col.addCircle(P.x + 0.4, P.z + s2 * (P.r + 0.35), 0.2); }
    const hs = sign('HELIPUERTO DE DRAGONES', 3.4, 0.5, { bg: '#2a3f6b', fg: '#ffd166', sub: 'Vuelo panorámico' }); hs.position.set(P.x - 0.2, 2.25, P.z + P.r + 0.35); hs.rotation.y = Math.PI / 2; g.add(hs);
  }
  const mergedCount = mergeStatic(g);

  /* personajes del escenario (NPC, sin nombre de jugador) */
  // Los que tienen `quizName` son NPC educativos: de vez en cuando se acercan a proponer un reto (edu/npc-quiz.js).
  const named = (npc, quizName) => Object.assign(npc, { quizName });
  const npcs = [
    named(new Npc({ look: NPC_LOOKS.vecina, route: [[-20, -20.5], [20, -20.5], [26.5, -14], [26.5, 14], [20, 20.5], [-20, 20.5], [-26.5, 14], [-26.5, -14]], speed: 1.25, pause: 1.2 }), 'Doña Rosa'),
    named(new Npc({ look: NPC_LOOKS.vecino, route: [[13, 13], [13, -13], [-13, -13], [-13, 13]], speed: 1.1, pause: 2.2 }), 'Don Memo'),
    new Npc({ look: NPC_LOOKS.repartidor, route: [[24, 20.5], [-24, 20.5], [-26.5, 0], [-24, -20.5], [24, -20.5], [26.5, 0]], speed: 1.9, pause: 0.8 }),
    named(new Npc({ look: { skin: 0xc98e63, hair: 0x2a1e14, hairStyle: 'bun', top: 0x8a5fd0, topAccent: 0xffd166, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['glasses', 'badge'] }, route: [[-13, 6], [-6, 13], [6, 13], [13, 6], [13, -6], [6, -13], [-6, -13], [-13, -6]], speed: 1.0, pause: 2.6 }), 'Profa. Lupita'),
    named(new Npc({ look: { skin: 0xe9b58c, hair: 0x15100b, hairStyle: 'short', top: 0x2f9e8f, topAccent: 0xffffff, bottom: 0x3a5a78, shoes: 0x5a3d22, accessories: ['cap'] }, route: [[20, -20.5], [26.5, -9], [26.5, 9], [20, 20.5]], speed: 1.15, pause: 2.0 }), 'Ing. Saúl'),
    new Npc({ look: NPC_LOOKS.guardia, x: -9.6, z: -20.6, yaw: 0.3 })
  ];
  npcs.forEach(n => g.add(n.group));

  /* ambulancia estacionada frente al hospital, con torreta intermitente */
  {
    const amb = new THREE.Group(); amb.position.set(AMBULANCE.x, 0, AMBULANCE.z); amb.rotation.y = Math.PI / 2; g.add(amb);
    const whiteA = mat(0xffffff, { r: 0.45 }), redA = mat(0xe5484d, { r: 0.6 }), glassA = mat(0x9fd3ff, { r: 0.1, m: 0.4 });
    box(1.8, 1.6, 3.2, whiteA, 0, 0.45, -0.3, amb); box(1.8, 1.05, 1.4, whiteA, 0, 0.45, 1.9, amb);
    box(1.6, 0.55, 0.05, glassA, 0, 1.0, 2.62, amb, { cast: false });
    box(1.84, 0.22, 4.6, redA, 0, 0.95, 0.4, amb, { cast: false });
    box(0.06, 0.55, 0.55, redA, 0.93, 1.45, -0.3, amb, { cast: false }); box(0.55, 0.06, 0.55, redA, 0.93, 1.45, -0.3, amb, { cast: false, rx: Math.PI / 2 });
    for (const [x, z] of [[-0.85, 1.6], [0.85, 1.6], [-0.85, -1.2], [0.85, -1.2]]) cyl(0.36, 0.36, 0.26, mat(0x1d2433, { r: 0.9 }), x, 0.36, z, amb, { seg: 14, rz: Math.PI / 2 });
    for (const s of [-0.45, 0.45]) { const l = box(0.38, 0.16, 0.3, mat(s < 0 ? 0xff5a5f : 0x4c9bff, { e: s < 0 ? 0xff5a5f : 0x4c9bff, ei: 1.6, own: true }), s, 2.08, 0.9, amb, { cast: false }); l.userData.blink = true; animated.blink.push(l); }
    col.addBoxAt(amb.position.x, amb.position.z, 4.8, 2.0);
  }

  /* interacciones: una por puerta */
  const interactables = BUILDINGS.map(b => {
    const p = doorPoint(b, 1.3);
    const open = b.status === 'open';
    return {
      id: 'door-' + b.id, x: p.x, y: 1.6, z: p.z, radius: 3, color: open ? 0xffc93c : 0x9fb0c8,
      label: b.id === 'casa' ? 'Entrar a tu casa' : open ? 'Entrar al ' + b.name : b.name + ' · próximamente',
      action: () => {
        if (b.id === 'casa') return api.travel('room', 'door');
        const place = placeByBuilding(b.id);
        if (open && place && api.store.state.profileKind === 'infantil' && !KID_SCENES.includes(place.scene)) return api.ui.toast('Este edificio es para personas adultas. Prueba el Parque de retos, el Supermercado, la Veterinaria, el Invernadero o el Restaurante.', 4200);
        if (open && place) return api.travel(place.scene, 'default');
        api.ui.toast(`${b.name}: la misión «${b.mission}» llega en una fase posterior.`);
      }
    };
  });
  interactables.push({ id: 'park', x: PARK_GATE.x, y: 1.8, z: PARK_GATE.z - 1.2, radius: 2.6, color: 0xffd166, label: 'Entrar al Parque de retos', action: () => api.travel('park', 'default') });
  interactables.push({ id: 'distrito', x: DISTRICT_GATE.x, y: 1.8, z: DISTRICT_GATE.z + 1.2, radius: 2.6, color: 0xb388ff, label: 'Entrar al Distrito del Saber', action: () => api.travel('distrito', 'default') });
  interactables.push({ id: 'dragones', x: FLIGHTS.plaza.pad.x, y: 1.6, z: FLIGHTS.plaza.pad.z, radius: FLIGHTS.plaza.pad.r + 0.6, color: 0xffb347, label: 'Volar en dragón', action: () => api.mounts.open() });
  interactables.push({ id: 'guard', x: -9.6, y: 1.8, z: -20.6, radius: 2.2, color: 0x9fd3ff, label: 'Hablar con el guardia',
    action: () => api.ui.dialog({ speaker: 'Guardia del banco', lines: ['¡Buen día! El Banco ICADEM está abierto.', 'Adentro hay una clienta que necesita ayuda para elegir su crédito. Pasa por la puerta principal.'] }) });

  const landmarks = BUILDINGS.map(b => { const p = doorPoint(b, 2.2), f = footprint(b); return { id: b.id, name: b.name, mission: b.mission, status: b.status, x: b.x, z: b.z, w: f.w, d: f.d, doorX: p.x, doorZ: p.z, color: b.wall }; });

  const home = doorPoint(BUILDINGS.find(b => b.id === 'casa'), 6.2);
  return {
    name: 'plaza', title: 'Ciudad ICADEM', group: g, collision: col, interactables, npcs, landmarks, half: HALF,
    background: 0xcdeeff, fog: { color: 0xcfeeff, near: 70, far: 190 },
    spawns: { default: { x: 0, z: 9.5, yaw: Math.PI }, park: PARK_GATE.arrival, distrito: DISTRICT_GATE.arrival, home: { x: home.x, z: home.z, yaw: Math.PI }, ...Object.fromEntries(PLACES.map(p => [p.spawn, arrivalOf(p)])) },
    camera: { distance: 7.5, minDistance: 2.6, maxDistance: 13, pitch: 0.4, box: null },
    sun, mergedCount,
    update(dt, t, playerPos) {
      for (const c of animated.clouds) { c.position.x += dt * 1.1; if (c.position.x > 130) c.position.x = -130; }
      for (const o of animated.spin) o.rotation.z = t * 0.8;
      for (const o of animated.blink) o.material.emissiveIntensity = Math.sin(t * 3) > 0.2 ? 1.8 : 0.15;
      for (const o of animated.rotate) o.rotation.y = Math.sin(t * o.userData.rotate) * 1.1;
      animated.water.position.y = 0.8 + Math.sin(t * 1.7) * 0.015;
      const d = animated.drops, arr = d.mesh.geometry.attributes.position.array;
      for (let i = 0; i < d.N; i++) {
        const a = d.seed[i * 3], life = (d.seed[i * 3 + 1] + t * d.seed[i * 3 + 2] * 0.55) % 1, r = life * 3.1;
        arr[i * 3] = Math.cos(a) * r; arr[i * 3 + 2] = Math.sin(a) * r; arr[i * 3 + 1] = 4.2 + life * 2.2 - life * life * 5.4;
      }
      d.mesh.geometry.attributes.position.needsUpdate = true;
      for (const o of animated.birds) { const a = t * o.speed + o.phase; o.b.position.set(Math.cos(a) * o.radius, o.h + Math.sin(a * 2.3) * 0.8, Math.sin(a) * o.radius); o.b.rotation.y = -a; const flap = Math.sin(t * 9 + o.phase) * 0.7; o.l.rotation.z = flap; o.r.rotation.z = -flap; }
      const lf = animated.leaves, la = lf.leaves.geometry.attributes.position.array;
      for (let i = 0; i < lf.leafN; i++) { const sd = lf.leafSeed[i]; la[i * 3] = sd[0] + Math.sin(t * 0.3 + sd[3]) * 1.6; la[i * 3 + 1] = 0.6 + ((sd[1] - t * 0.22 + 400) % 9); la[i * 3 + 2] = sd[2] + Math.cos(t * 0.25 + sd[3]) * 1.6; }
      lf.leaves.geometry.attributes.position.needsUpdate = true;
      if (playerPos) { sun.position.set(playerPos.x + 34, 52, playerPos.z + 26); sun.target.position.set(playerPos.x, 0, playerPos.z); }
    }
  };
}
