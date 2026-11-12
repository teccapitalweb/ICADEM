// Escenario 8 · Clínica Veterinaria (azul cielo y rosa), misión 6: «Guardianes del bienestar».
// Recepción, mesa de exploración con báscula, consultorio, área de observación con cristal y
// cuatro pacientes animados. Lo que el jugador coloca en el área de Luna aparece en la escena.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { ANIMALS, ENRICHMENT } from '../missions/vet-welfare-logic.js';
import { mat, box, cyl, sph, plane, slab, sign, checkerTexture, sunLight, mergeStatic } from './kit.js';

/** Animal low-poly con partes animables (cabeza, cola, orejas). */
function makeAnimal(kind, body, accent) {
  const g = new THREE.Group(); g.userData.dynamic = true;
  const B = mat(body, { r: 0.8, own: true }), A = mat(accent, { r: 0.8 }), dark = mat(0x1d1a17, { r: 0.6 }), pink = mat(0xf2a7b5, { r: 0.7 });
  const parts = { kind };
  if (kind === 'rabbit') {
    sph(0.26, B, 0, 0.24, 0, g, { seg: 10, rings: 8 }).scale.set(1, 0.85, 1.25);
    const head = new THREE.Group(); head.position.set(0, 0.42, 0.28); g.add(head); parts.head = head;
    sph(0.16, B, 0, 0, 0, head, { seg: 10, rings: 8 });
    for (const s of [-1, 1]) { const ear = box(0.06, 0.32, 0.04, B, s * 0.06, 0.12, -0.02, head, { cast: false }); ear.rotation.z = s * 0.15; box(0.03, 0.22, 0.01, pink, s * 0.06, 0.16, 0.0, head, { cast: false }).rotation.z = s * 0.15; }
    for (const s of [-1, 1]) sph(0.025, dark, s * 0.08, 0.04, 0.12, head, { seg: 6, rings: 4 });
    sph(0.07, A, 0, 0.22, -0.32, g, { seg: 8, rings: 6 });
  } else {
    const dog = kind === 'dog' || kind === 'puppy', s0 = kind === 'puppy' ? 0.62 : kind === 'cat' ? 0.7 : 1;
    const torso = box(0.32 * s0, 0.3 * s0, 0.7 * s0, B, 0, 0.32 * s0, 0, g); void torso;
    for (const [x, z] of [[-0.11, 0.24], [0.11, 0.24], [-0.11, -0.24], [0.11, -0.24]]) box(0.09 * s0, 0.32 * s0, 0.09 * s0, B, x * s0, 0, z * s0, g);
    const head = new THREE.Group(); head.position.set(0, 0.55 * s0, 0.38 * s0); g.add(head); parts.head = head;
    box(0.28 * s0, 0.26 * s0, 0.26 * s0, B, 0, 0, 0, head);
    if (dog) { box(0.16 * s0, 0.13 * s0, 0.16 * s0, A, 0, -0.05 * s0, 0.18 * s0, head); for (const s of [-1, 1]) box(0.07 * s0, 0.16 * s0, 0.12 * s0, A, s * 0.15 * s0, 0.02 * s0, -0.02 * s0, head); }
    else for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06 * s0, 0.12 * s0, 4), B); ear.position.set(s * 0.09 * s0, 0.17 * s0, 0); head.add(ear); }
    for (const s of [-1, 1]) sph(0.03 * s0, dark, s * 0.07 * s0, 0.04 * s0, 0.13 * s0, head, { seg: 6, rings: 4 });
    sph(0.035 * s0, dark, 0, -0.02 * s0, dog ? 0.27 * s0 : 0.14 * s0, head, { seg: 6, rings: 4 });
    const tail = new THREE.Group(); tail.position.set(0, 0.42 * s0, -0.36 * s0); g.add(tail); parts.tail = tail;
    box(0.06 * s0, 0.06 * s0, (kind === 'cat' ? 0.42 : 0.26) * s0, kind === 'cat' ? B : A, 0, 0.06 * s0, -0.12 * s0, tail, { rx: kind === 'cat' ? -0.9 : -0.6 });
  }
  g.userData.parts = parts;
  return g;
}

export function buildVet(api) {
  const g = new THREE.Group();
  const W = 18, D = 14, H = 4.6;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const sky = mat(0x3c9fc9, { r: 0.6 }), rose = mat(0xf08aa8, { r: 0.6 }), white = mat(0xffffff, { r: 0.55 }), steel = mat(0xc4ccd6, { m: 0.6, r: 0.3 });

  /* estructura */
  const floor = plane(W, D, mat(0xffffff, { map: checkerTexture(9, 7, '#f3fbff', '#dff0f8', 'rgba(255,255,255,.5)'), r: 0.35 }), 0, 0, 0, g, { rx: -Math.PI / 2 });
  floor.receiveShadow = true;
  const wallM = mat(0xf2fbff, { r: 0.95 }), wall2 = mat(0xe4f4fb, { r: 0.95 });
  plane(W, H, wallM, 0, H / 2, -D / 2, g); plane(W, H, wallM, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, wall2, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 }); plane(D, H, wall2, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  for (const [w, x, z, ry] of [[W, 0, -D / 2 + 0.02, 0], [D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, -Math.PI / 2]]) plane(w, 0.28, rose, x, 1.0, z, g, { ry, cast: false });
  // huellitas en el piso que guían a la báscula
  for (let i = 0; i < 6; i++) { const paw = slab(0.22, 0.26, 0.01, 0.1, mat(0x3c9fc9, { r: 0.8 }), -0.6 + (i % 2) * 0.35, 0.005, 4.6 - i * 0.75, g, { cast: false }); void paw; }

  /* entrada */
  const south = (w, hh, material, x, y, dz) => plane(w, hh, material, x, y, D / 2 - dz, g, { ry: Math.PI });
  south(3.0, 3.1, sky, 0, 1.55, 0.02);
  for (const s of [-1, 1]) south(1.2, 2.8, mat(0xcdeefa, { r: 0.1, m: 0.4, e: 0x3c8fb0, ei: 0.25 }), s * 0.65, 1.4, 0.03);
  const exitSign = sign('SALIDA', 1.2, 0.34, { bg: '#1f7a55', fg: '#ffffff' }); exitSign.position.set(0, 3.4, D / 2 - 0.06); exitSign.rotation.y = Math.PI; g.add(exitSign);

  /* recepción (poniente-sur) */
  const rx = -5.4, rz = 4.4;
  box(3.4, 1.05, 0.9, white, rx, 0, rz, g); box(3.6, 0.08, 1.1, sky, rx, 1.05, rz, g);
  const recSign = sign('RECEPCIÓN', 1.8, 0.36, { bg: '#3c9fc9', fg: '#ffffff' }); recSign.position.set(rx, 2.7, rz - 0.2); g.add(recSign);
  col.addBoxAt(rx, rz, 3.6, 1.1);
  for (let i = 0; i < 3; i++) { slab(0.55, 0.55, 0.1, 0.1, rose, -8.4 + i * 0.7, 0.42, 6.6, g); slab(0.55, 0.1, 0.5, 0.05, rose, -8.4 + i * 0.7, 0.5, 6.9, g); }
  col.addBoxAt(-7.7, 6.7, 2.3, 0.8);
  // costales de alimento y vitrina
  for (let i = 0; i < 3; i++) box(0.5, 0.75, 0.32, mat([0xf2b93b, 0x58b565, 0xf08aa8][i], { r: 0.8 }), -8.4 + i * 0.6, 0, 2.6, g);
  col.addBoxAt(-7.8, 2.6, 1.9, 0.5);

  /* mesa de exploración y báscula (centro) */
  const tx = 0.6, tz = 0.4;
  box(1.8, 0.08, 0.9, steel, tx, 0.9, tz, g); cyl(0.08, 0.1, 0.9, steel, tx, 0, tz, g, { seg: 10 }); cyl(0.4, 0.45, 0.06, steel, tx, 0, tz, g, { seg: 16 });
  col.addBoxAt(tx, tz, 1.9, 1.0);
  const scx = 2.6, scz = 1.6;
  box(1.0, 0.12, 0.8, mat(0x2b3a55, { r: 0.6 }), scx, 0, scz, g);
  box(0.12, 1.0, 0.12, steel, scx + 0.44, 0.12, scz - 0.34, g);
  const scaleScreen = plane(0.36, 0.2, new THREE.MeshBasicMaterial({ color: 0x0b3a2b, toneMapped: false }), scx + 0.44, 1.18, scz - 0.27, g);
  scaleScreen.userData.dynamic = true;
  const scaleSign = sign('BÁSCULA', 1.0, 0.26, { bg: '#2b3a55', fg: '#ffffff' }); scaleSign.position.set(scx + 0.44, 1.45, scz - 0.27); g.add(scaleSign);
  col.addBoxAt(scx, scz, 1.0, 0.8);

  /* expedientes: archivero de la recepción */
  const ax = -8.55, az = -0.4;
  box(0.6, 1.3, 0.9, mat(0x9fb0c8, { m: 0.3, r: 0.5 }), ax, 0, az, g);
  for (let i = 0; i < 3; i++) box(0.02, 0.02, 0.8, mat(0x2b3a55), ax + 0.31, 0.35 + i * 0.4, az, g, { cast: false });
  const expSign = sign('EXPEDIENTES', 1.4, 0.28, { bg: '#f08aa8', fg: '#ffffff' }); expSign.position.set(ax + 0.31, 1.65, az); expSign.rotation.y = Math.PI / 2; g.add(expSign);
  col.addBoxAt(ax, az, 0.7, 1.0);

  /* lugares de los pacientes (muro norte) con su luz de prioridad */
  const spots = { rocky: [-5.6, -4.6], canela: [-1.6, -4.8], toby: [2.4, -4.6] };
  const lamps = {};
  // corral de Rocky
  box(2.0, 0.5, 0.06, mat(0xe7d3a8, { r: 0.8 }), -5.6, 0, -3.6, g); for (const dx of [-1, 1]) box(0.06, 0.5, 1.8, mat(0xe7d3a8, { r: 0.8 }), -5.6 + dx, 0, -4.5, g);
  slab(1.9, 1.7, 0.03, 0.2, mat(0xd8c08a, { r: 1 }), -5.6, 0.006, -4.5, g, { cast: false });
  box(0.5, 0.25, 0.3, mat(0x8fbf5a, { r: 0.9 }), -5.0, 0, -5.1, g);   // heno
  col.addBoxAt(-5.6, -4.5, 2.1, 1.9);
  // tapete de Canela
  slab(1.8, 1.2, 0.04, 0.3, mat(0x3c9fc9, { r: 1 }), -1.6, 0.006, -4.8, g, { cast: false });
  cyl(0.18, 0.15, 0.1, steel, -0.6, 0, -5.4, g, { seg: 12 });   // bebedero
  col.addBoxAt(-1.6, -4.8, 1.8, 1.2);
  // corralito de Toby
  for (const [w, d, x, z] of [[1.8, 0.05, 2.4, -3.8], [0.05, 1.8, 1.5, -4.7], [0.05, 1.8, 3.3, -4.7]]) box(w, 0.45, d, mat(0xf2b93b, { r: 0.7 }), x, 0, z, g, { cast: false });
  sph(0.12, mat(0xe5484d, { r: 0.6 }), 2.9, 0.12, -5.0, g, { seg: 8, rings: 6 });   // pelota
  col.addBoxAt(2.4, -4.7, 1.9, 1.9);
  for (const [id, [x, z]] of Object.entries(spots)) {
    const lamp = sph(0.12, new THREE.MeshStandardMaterial({ color: 0x9aa7b8, emissive: 0x000000, roughness: 0.4 }), x, 2.3, -D / 2 + 0.4, g, { seg: 10, rings: 8 });
    lamp.userData.dynamic = true; lamps[id] = lamp; void z;
  }
  const consSign = sign('CONSULTORIO · PACIENTES', 2.6, 0.36, { bg: '#3c9fc9', fg: '#ffffff' }); consSign.position.set(-1.6, 3.4, -D / 2 + 0.06); g.add(consSign);

  /* área de observación (oriente) con cristal, para Luna */
  const ox = 6.6, oz = -2.0;
  box(0.08, 2.4, 6.0, mat(0xd5ecf6, { r: 0.9 }), ox - 2.2, 0, oz, g, { cast: false });
  plane(4.0, 1.2, new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide }), ox - 2.16, 1.6, oz - 0.6, g, { ry: Math.PI / 2 });
  col.addBoxAt(ox - 2.2, oz - 1.6, 0.15, 2.8); col.addBoxAt(ox - 2.2, oz + 2.4, 0.15, 1.2);
  slab(4.0, 5.6, 0.02, 0.2, mat(0xfbe3ea, { r: 0.9 }), ox, 0.006, oz, g, { cast: false });
  const obsSign = sign('ÁREA DE OBSERVACIÓN', 2.4, 0.34, { bg: '#f08aa8', fg: '#ffffff' }); obsSign.position.set(ox - 2.14, 2.7, oz); obsSign.rotation.y = -Math.PI / 2; g.add(obsSign);
  // objetos de enriquecimiento (aparecen al colocarlos)
  const items = {};
  const add = (id, build) => { const it = new THREE.Group(); it.visible = false; it.userData.dynamic = true; build(it); g.add(it); items[id] = it; };
  add('arenero', it => { box(0.7, 0.18, 0.5, mat(0x7fb3e6, { r: 0.6 }), ox + 1.3, 0, oz + 2.0, it); box(0.62, 0.05, 0.42, mat(0xe7d3a8, { r: 1 }), ox + 1.3, 0.14, oz + 2.0, it, { cast: false }); });
  add('repisa', it => { box(0.9, 0.08, 0.4, mat(0x8a5a36, { r: 0.6 }), ox + 1.75, 1.3, oz - 1.5, it); box(0.06, 0.4, 0.06, mat(0x8a5a36), ox + 1.75, 0.92, oz - 1.5, it); });
  add('escondite', it => { box(0.6, 0.45, 0.5, mat(0xc98f56, { r: 0.8 }), ox + 1.4, 0, oz - 0.2, it); plane(0.3, 0.25, mat(0x2a1d14), ox + 1.1, 0.18, oz - 0.2, it, { ry: -Math.PI / 2 }); });
  add('rascador', it => { cyl(0.3, 0.3, 0.06, mat(0xe7d3a8), ox + 0.2, 0, oz + 2.2, it, { seg: 12 }); cyl(0.08, 0.08, 1.0, mat(0xd8c08a, { r: 1 }), ox + 0.2, 0.06, oz + 2.2, it, { seg: 8 }); box(0.4, 0.06, 0.4, mat(0xf08aa8), ox + 0.2, 1.06, oz + 2.2, it); });
  add('jaula', it => { for (const [x, z] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]) box(0.03, 0.5, 0.03, steel, ox - 0.5 + x, 0, oz + 1.6 + z, it); box(0.66, 0.03, 0.56, steel, ox - 0.5, 0.5, oz + 1.6, it); });
  add('hilo', it => { sph(0.1, mat(0xe5484d), ox - 0.3, 0.1, oz - 1.6, it, { seg: 8, rings: 6 }); cyl(0.005, 0.005, 1.2, mat(0xe5484d), ox - 0.3, 0.1, oz - 1.0, it, { seg: 4, rx: Math.PI / 2 }); });
  const lunaLamp = sph(0.12, new THREE.MeshStandardMaterial({ color: 0x9aa7b8, emissive: 0x000000, roughness: 0.4 }), ox + 1.9, 2.3, oz + 0.6, g, { seg: 10, rings: 8 }); lunaLamp.userData.dynamic = true; lamps.luna = lunaLamp;

  /* luces */
  for (const [x, z] of [[-4.5, 1.5], [3, 1.5], [-2, -3.5], [6.5, -2]]) {
    box(1.5, 0.06, 0.4, mat(0xffffff, { e: 0xeaf8ff, ei: 1.2, r: 0.5 }), x, H - 0.05, z, g, { cast: false });
    const pl = new THREE.PointLight(0xf3fbff, 6, 10, 1.7); pl.position.set(x, H - 0.4, z); g.add(pl);
  }
  g.add(new THREE.HemisphereLight(0xf6fcff, 0xd6c3c8, 1.1));
  const sun = sunLight(g, { x: -3, y: 12, z: 9, intensity: 1.2, color: 0xffffff, area: 13 }); sun.target.position.set(0, 0, 0);

  /* personas y animales */
  const xime = new Npc({ look: { skin: 0xc98e63, hair: 0x1d140d, hairStyle: 'long', top: 0x3c9fc9, topAccent: 0xffffff, bottom: 0x3c9fc9, shoes: 0xffffff, accessories: ['badge', 'glasses'] }, x: rx, z: rz - 1.0, yaw: Math.PI });
  const owners = [
    new Npc({ look: { skin: 0xe9b58c, hair: 0x6b4a2b, hairStyle: 'short', top: 0x58b565, topAccent: 0xffffff, bottom: 0x27304a, shoes: 0xffffff, accessories: [] }, x: -4.0, z: -3.2, yaw: 2.6 }),
    new Npc({ look: { skin: 0xd9a37a, hair: 0x9a9a9a, hairStyle: 'bun', top: 0xb56bd6, topAccent: 0xffffff, bottom: 0x4a4f7a, shoes: 0xffffff, accessories: ['glasses'] }, x: -0.2, z: -3.4, yaw: 2.8 }),
    new Npc({ look: { skin: 0xf0c7a4, hair: 0x2a1e14, hairStyle: 'side', top: 0xf2b93b, topAccent: 0xffffff, bottom: 0x2a3550, shoes: 0xffffff, accessories: [] }, x: 4.0, z: -3.0, yaw: -2.6 }),
    new Npc({ look: { skin: 0xc98e63, hair: 0x241810, hairStyle: 'long', top: 0xe5484d, topAccent: 0xffffff, bottom: 0x27304a, shoes: 0xffffff, accessories: [] }, x: 3.4, z: 3.6, yaw: 0.6 })
  ];
  const npcs = [xime, ...owners]; npcs.forEach(n => g.add(n.group));
  col.addCircle(rx, rz - 1.0, 0.4); for (const o of owners) col.addCircle(o.group.position.x, o.group.position.z, 0.35);
  const animals = {
    rocky: makeAnimal('rabbit', 0xd9cbb5, 0xffffff),
    canela: makeAnimal('dog', 0xc98f56, 0x8a5a36),
    toby: makeAnimal('puppy', 0xf2e6d0, 0x3a2618),
    luna: makeAnimal('cat', 0x4a4f5a, 0xffffff)
  };
  const home = { rocky: [-5.6, -4.4, 0.4], canela: [-1.6, -4.7, 0.3], toby: [2.4, -4.6, -0.3], luna: [ox + 1.2, oz + 0.8, -2.2] };
  for (const [id, a] of Object.entries(animals)) { const [x, z, yaw] = home[id]; a.position.set(x, 0, z); a.rotation.y = yaw; g.add(a); }

  mergeStatic(g);
  const m = api.missions.vet;
  const interactables = [
    { id: 'exit', x: 0, y: 2.1, z: D / 2 - 0.6, radius: 1.6, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'vet') },
    { id: 'xime', x: rx, y: 2.0, z: rz - 1.0, radius: 2.0, color: 0xffc93c, label: () => m.labelFor('vet'), highlight: () => m.wants('vet'), action: () => m.talkToVet(xime) },
    { id: 'scale', x: scx, y: 1.6, z: scz + 0.8, radius: 1.6, color: 0x5dff9e, label: () => m.labelFor('scale'), highlight: () => m.wants('scale'), action: () => m.useScale() },
    { id: 'habitat', x: ox - 1.4, y: 1.6, z: oz + 2.2, radius: 1.8, color: 0xff8f7a, label: () => m.labelFor('habitat'), highlight: () => m.wants('habitat'), action: () => m.openHabitat() },
    ...ANIMALS.flatMap(x => {
      const [hx, hz] = home[x.id], front = x.id === 'luna' ? [ox - 1.4, oz + 0.4] : [hx, hz + 1.7];
      const chart = x.id === 'luna' ? [ox - 1.4, oz - 1.0] : [hx + 0.9, hz + 1.7];
      return [
        { id: 'an-' + x.id, x: front[0], y: 1.5, z: front[1], radius: 1.3, color: 0xffc93c, label: () => m.labelFor('animal', x.id), highlight: () => m.wants('animal', x.id), action: () => m.attend(x.id, null) },
        { id: 'chart-' + x.id, x: chart[0], y: 1.3, z: chart[1], radius: 1.1, color: 0x4cc9f0, label: () => m.labelFor('review', x.id, 'chart'), highlight: () => m.wants('review', x.id, 'chart'), action: () => m.review(x.id, 'chart') }
      ];
    })
  ];

  return {
    name: 'vet', title: 'Clínica Veterinaria', group: g, collision: col, interactables, npcs,
    background: 0x16313f, fog: null,
    spawns: { default: { x: 0, z: 5.4, yaw: Math.PI } },
    camera: { distance: 6.3, minDistance: 2.4, maxDistance: 8.6, pitch: 0.48, yaw: 0, box: { minX: -11, maxX: 11, minZ: -8.5, maxZ: 10, maxY: 6.6 } },
    update(dt, t) {
      for (const [id, a] of Object.entries(animals)) {
        const p = a.userData.parts, i = id.length;
        if (p.tail) p.tail.rotation.y = Math.sin(t * (id === 'toby' ? 12 : id === 'luna' ? 1.4 : 7)) * (id === 'luna' ? 0.25 : 0.5);
        if (p.head) { p.head.rotation.y = Math.sin(t * 0.7 + i) * 0.35; p.head.rotation.x = id === 'rocky' ? 0.25 : Math.sin(t * 0.9 + i) * 0.08; }
        const [hx, hz] = home[id];
        const target = m.onScale === id ? [scx, scz] : [hx, hz];
        a.position.x += (target[0] - a.position.x) * Math.min(1, dt * 4); a.position.z += (target[1] - a.position.z) * Math.min(1, dt * 4);
        a.position.y = m.onScale === id ? 0.12 : (id === 'toby' ? Math.abs(Math.sin(t * 5)) * 0.06 : 0);
        const hex = m.colorOf(id);
        if (hex !== null) { lamps[id].material.color.setHex(hex); lamps[id].material.emissive.setHex(hex); lamps[id].material.emissiveIntensity = 0.6 + Math.sin(t * 4 + i) * 0.3; }
      }
      for (const e of ENRICHMENT) items[e.id].visible = m.attempt.enrichment.includes(e.id);
      scaleScreen.material.color.setHex(m.onScale ? 0x1f8f5e : 0x0b3a2b);
    }
  };
}
