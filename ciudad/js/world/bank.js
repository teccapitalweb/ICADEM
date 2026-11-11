// Escenario 3 · Interior del Banco ICADEM (amarillos y dorados), donde ocurre la misión 1.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { NPC_LOOKS } from '../characters/catalog.js';
import { PROPOSALS } from '../missions/bank-credit-logic.js';
import { mat, box, cyl, sph, plane, slab, sign, checkerTexture, bush, sunLight, mergeStatic } from './kit.js';

export function buildBank(api) {
  const g = new THREE.Group();
  const W = 18, D = 14, H = 5.2;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const gold = mat(0xffd166, { m: 0.75, r: 0.28 }), goldDark = mat(0xc9952a, { m: 0.6, r: 0.35 });
  const white = mat(0xffffff, { r: 0.55 }), navy = mat(0x12325f, { r: 0.6 }), wood = mat(0x8a5a36, { r: 0.6 }), woodLight = mat(0xc98f56, { r: 0.6 });

  /* estructura */
  const floor = plane(W, D, mat(0xffffff, { map: checkerTexture(9, 7, '#fff6dc', '#f3deaa'), r: 0.35, m: 0.1 }), 0, 0, 0, g, { rx: -Math.PI / 2 });
  floor.receiveShadow = true;
  const wall = mat(0xfff0c2, { r: 0.95 }), wall2 = mat(0xfbe5a6, { r: 0.95 });
  plane(W, H, wall, 0, H / 2, -D / 2, g);
  plane(W, H, wall, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, wall2, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 });
  plane(D, H, wall2, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  // zócalo y cornisa dorados
  for (const [w, d, x, z] of [[W, 0.08, 0, -D / 2 + 0.04], [0.08, D, -W / 2 + 0.04, 0], [0.08, D, W / 2 - 0.04, 0]]) {
    box(w, 0.9, d, mat(0xf3deaa, { r: 0.8 }), x, 0, z, g, { cast: false });
    box(w, 0.1, d * 1.4, goldDark, x, 0.9, z, g, { cast: false });
    box(w, 0.16, d * 1.6, goldDark, x, H - 0.5, z, g, { cast: false });
  }
  // columnas
  for (const [x, z] of [[-8.3, 6.3], [8.3, 6.3], [-8.3, -6.3], [8.3, -6.3]]) {
    cyl(0.5, 0.5, 0.3, white, x, 0, z, g, { seg: 18 }); cyl(0.36, 0.4, H - 0.9, white, x, 0.3, z, g, { seg: 18 }); cyl(0.52, 0.4, 0.35, gold, x, H - 0.65, z, g, { seg: 18 });
    col.addCircle(x, z, 0.52);
  }
  // Todo lo que va en el muro sur son planos de una cara: la cámara suele quedar detrás de ese muro.
  const south = (w, hh, material, x, y, dz) => plane(w, hh, material, x, y, D / 2 - dz, g, { ry: Math.PI });
  for (const x of [-6.4, 6.4]) {
    south(2.5, 2.4, white, x, 3.1, 0.02);
    south(2.2, 2.1, new THREE.MeshBasicMaterial({ color: 0xd9f1ff, toneMapped: false }), x, 3.1, 0.03);
    south(0.06, 2.1, white, x, 3.1, 0.04);
    south(2.2, 0.06, white, x, 3.1, 0.04);
  }

  /* entrada */
  south(3.0, 3.5, goldDark, 0, 1.75, 0.02);
  for (const s of [-1, 1]) {
    south(1.22, 3.2, mat(0x2a1d14, { r: 0.4 }), s * 0.65, 1.6, 0.03);
    south(0.8, 1.5, mat(0xbfe3ff, { r: 0.1, m: 0.6, e: 0x4a7fb0, ei: 0.3 }), s * 0.65, 2.1, 0.04);
    south(0.06, 0.6, gold, s * 0.12, 1.5, 0.05);
  }
  const exitSign = sign('SALIDA', 1.2, 0.34, { bg: '#1f7a55', fg: '#ffffff' }); exitSign.position.set(0, 3.85, D / 2 - 0.06); exitSign.rotation.y = Math.PI; g.add(exitSign);
  slab(3.4, 1.6, 0.03, 0.2, mat(0x12325f, { r: 1 }), 0, 0.002, D / 2 - 1.0, g, { cast: false });

  /* alfombra central */
  slab(6.4, 5.2, 0.03, 0.5, mat(0x12325f, { r: 1 }), 0, 0.003, 1.2, g, { cast: false });
  slab(5.8, 4.6, 0.035, 0.45, mat(0xf2b93b, { r: 1 }), 0, 0.004, 1.2, g, { cast: false });
  slab(5.2, 4.0, 0.04, 0.4, mat(0x1b447d, { r: 1 }), 0, 0.005, 1.2, g, { cast: false });

  /* mostrador de cajas y bóveda */
  const cz = -4.5;
  box(10.4, 1.1, 0.9, woodLight, 0, 0, cz, g); box(10.6, 0.08, 1.1, gold, 0, 1.1, cz, g);
  box(10.4, 0.5, 0.06, navy, 0, 0.3, cz + 0.47, g, { cast: false });
  for (let i = 0; i < 5; i++) box(0.08, 1.5, 0.08, gold, -5.2 + i * 2.6, 1.18, cz, g);
  for (let i = 0; i < 4; i++) plane(2.5, 1.4, new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.4, side: THREE.DoubleSide }), -3.9 + i * 2.6, 1.9, cz, g);
  box(10.6, 0.1, 0.2, gold, 0, 2.62, cz, g);
  const cajas = sign('CAJAS', 2.0, 0.5, { bg: '#12325f', fg: '#ffd166' }); cajas.position.set(-3.9, 3.05, cz + 0.12); g.add(cajas);
  col.addBoxAt(0, cz, 10.6, 1.1);
  // bóveda al fondo
  const vault = new THREE.Group(); vault.position.set(0, 2.15, -D / 2 + 0.12); g.add(vault);
  cyl(1.75, 1.75, 0.22, mat(0x8a93a3, { m: 0.8, r: 0.3 }), 0, 0, 0, vault, { seg: 36, rx: Math.PI / 2 }).position.y = 0;
  cyl(1.45, 1.45, 0.3, mat(0xb8c0cc, { m: 0.85, r: 0.25 }), 0, 0, 0.06, vault, { seg: 36, rx: Math.PI / 2 }).position.y = 0;
  const wheel = new THREE.Group(); wheel.userData.dynamic = true; wheel.position.z = 0.26; vault.add(wheel);
  const tor = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 10, 28), gold); wheel.add(tor);
  for (let i = 0; i < 4; i++) { const sp = box(1.1, 0.07, 0.07, gold, 0, 0, 0, wheel, { rz: i * Math.PI / 4 }); sp.position.y = 0; }
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; sph(0.07, gold, Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0.2, vault, { seg: 8, rings: 6 }); }
  // filas
  for (const x of [-3.2, -1.1, 1.1, 3.2]) { cyl(0.06, 0.16, 1.0, gold, x, 0, -2.9, g, { seg: 10 }); sph(0.09, gold, x, 1.04, -2.9, g, { seg: 10, rings: 8 }); col.addCircle(x, -2.9, 0.18); }
  for (const x of [-2.15, 2.15]) box(2.0, 0.05, 0.05, mat(0xb4322f, { r: 0.9 }), x, 0.88, -2.9, g, { cast: false });

  /* sala de espera (poniente) */
  slab(1.0, 3.6, 0.42, 0.25, mat(0x1b447d, { r: 0.9 }), -8.2, 0.12, 2.6, g);
  slab(0.36, 3.6, 0.7, 0.16, mat(0x12325f, { r: 0.9 }), -8.62, 0.42, 2.6, g);
  for (const z of [1.3, 2.6, 3.9]) slab(0.6, 0.8, 0.12, 0.2, mat(0xf2b93b, { r: 0.95 }), -8.15, 0.55, z, g);
  col.addBoxAt(-8.3, 2.6, 1.4, 3.7);
  cyl(0.3, 0.24, 0.5, gold, -8.2, 0, 4.9, g, { seg: 16 }); bush(-8.2, 4.9, g, 0x3f9a4d, 1.1).position.y = 0.5; col.addCircle(-8.2, 4.9, 0.5);
  cyl(0.3, 0.24, 0.5, gold, 8.2, 0, 5.0, g, { seg: 16 }); bush(8.2, 5.0, g, 0x3f9a4d, 1.1).position.y = 0.5; col.addCircle(8.2, 5.0, 0.5);
  // mesa de documentos
  const tx = -5.6, tz = -1.4;
  cyl(0.9, 0.9, 0.07, woodLight, tx, 0.82, tz, g, { seg: 28 }); cyl(0.09, 0.12, 0.82, gold, tx, 0, tz, g, { seg: 12 }); cyl(0.5, 0.55, 0.05, gold, tx, 0, tz, g, { seg: 20 });
  const paperA = box(0.42, 0.012, 0.56, mat(0xffffff, { r: 0.9, own: true }), tx - 0.3, 0.895, tz + 0.05, g, { ry: 0.25, cast: false });
  const paperB = box(0.42, 0.012, 0.56, mat(0xeaf4ff, { r: 0.9, own: true }), tx + 0.3, 0.895, tz - 0.05, g, { ry: -0.2, cast: false });
  box(0.3, 0.04, 0.4, mat(0xe86a5c, { r: 0.8 }), tx, 0.9, tz - 0.5, g, { ry: 0.6 });
  col.addCircle(tx, tz, 0.95);

  /* escritorios de ejecutivos (oriente) */
  const execZ = [-3.3, 0, 3.3], execs = [];
  PROPOSALS.forEach((p, i) => {
    const z = execZ[i], x = 6.4;
    box(1.0, 0.07, 2.0, woodLight, x, 0.78, z, g); box(0.9, 0.78, 1.9, wood, x + 0.02, 0, z, g);
    box(0.06, 0.45, 2.0, navy, x - 0.5, 0.3, z, g, { cast: false });
    // pantalla con la propuesta
    box(0.5, 0.36, 0.04, mat(0x16213a, { r: 0.4 }), x + 0.15, 0.95, z - 0.55, g, { ry: Math.PI / 2 - 0.5 });
    cyl(0.03, 0.03, 0.12, mat(0x263248), x + 0.15, 0.85, z - 0.55, g, { seg: 8 });
    const tablet = box(0.5, 0.02, 0.36, mat(0x16213a, { r: 0.3, e: 0x4cc9f0, ei: 0.5, own: true }), x - 0.22, 0.86, z + 0.1, g, { cast: false });
    const plate = sign(p.name.toUpperCase(), 1.7, 0.34, { bg: '#12325f', fg: '#ffd166' }); plate.position.set(x - 0.54, 0.52, z); plate.rotation.y = -Math.PI / 2; g.add(plate);
    slab(0.6, 0.6, 0.1, 0.12, navy, x + 1.25, 0.42, z, g); slab(0.1, 0.6, 0.7, 0.05, navy, x + 1.55, 0.5, z, g); cyl(0.05, 0.05, 0.42, mat(0x263248, { m: 0.4 }), x + 1.25, 0, z, g, { seg: 8 });
    col.addBoxAt(x + 0.5, z, 2.2, 2.1);
    const npc = new Npc({ look: NPC_LOOKS[['bruno', 'renata', 'mateo'][i]], x: x + 1.2, z, yaw: -Math.PI / 2, sitting: true, seatY: 0.25 });
    g.add(npc.group); execs.push({ npc, tablet, id: p.id });
  });

  /* tablero comparativo (centro) */
  const bz = -1.2;
  cyl(0.35, 0.45, 0.08, goldDark, 0, 0, bz, g, { seg: 20 }); cyl(0.07, 0.07, 1.0, goldDark, 0, 0.08, bz, g, { seg: 10 });
  const board = box(2.3, 1.35, 0.1, mat(0x16213a, { r: 0.4, own: true }), 0, 1.05, bz, g, { rx: -0.12 });
  const boardFace = plane(2.1, 1.16, new THREE.MeshBasicMaterial({ color: 0x1b447d, toneMapped: false }), 0, 1.74, bz + 0.065, g, { rx: -0.12 });
  const boardSign = sign('COMPARADOR', 1.7, 0.3, { bg: 'rgba(0,0,0,0)', fg: '#ffd166', radius: 0 }); boardSign.position.set(0, 1.75, bz + 0.075); boardSign.rotation.x = -0.12; g.add(boardSign);
  col.addBoxAt(0, bz, 2.3, 0.5);

  /* computadora del simulador de crédito (junto a la entrada, mirando hacia quien llega) */
  const kx = 3.1, kz = 1.3;
  box(1.5, 0.06, 0.7, woodLight, kx, 1.0, kz, g); box(0.08, 1.0, 0.6, navy, kx - 0.62, 0, kz, g); box(0.08, 1.0, 0.6, navy, kx + 0.62, 0, kz, g);
  box(1.3, 0.5, 0.04, navy, kx, 0.4, kz - 0.28, g, { cast: false });
  cyl(0.16, 0.2, 0.03, mat(0x263248, { m: 0.4 }), kx, 1.06, kz - 0.1, g, { seg: 16 }); cyl(0.03, 0.03, 0.22, mat(0x263248, { m: 0.4 }), kx, 1.08, kz - 0.1, g, { seg: 8 });
  const monitor = box(0.92, 0.56, 0.05, mat(0x10182b, { r: 0.35 }), kx, 1.28, kz - 0.1, g, { rx: -0.1 });
  const screen = plane(0.84, 0.48, new THREE.MeshBasicMaterial({ color: 0x1b6fb8, toneMapped: false }), kx, 1.56, kz - 0.062, g, { rx: -0.1 });
  const screenText = sign('SIMULADOR', 0.5, 0.11, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', radius: 0 }); screenText.position.set(kx, 1.66, kz - 0.05); screenText.rotation.x = -0.1; g.add(screenText);
  const bars = [0.5, 0.36, 0.62].map((w, i) => { const b = plane(w * 0.6, 0.05, new THREE.MeshBasicMaterial({ color: [0xffd166, 0x6fe0b5, 0xff8f7a][i], toneMapped: false }), kx - 0.39 + w * 0.3, 1.52 - i * 0.085, kz - 0.058 + i * 0.0085, g, { rx: -0.1 }); b.userData.dynamic = true; return b; });
  box(0.5, 0.025, 0.17, mat(0x263248, { r: 0.5 }), kx - 0.08, 1.06, kz + 0.17, g, { cast: false }); box(0.08, 0.025, 0.12, mat(0x263248, { r: 0.5 }), kx + 0.34, 1.06, kz + 0.17, g, { cast: false });
  const kioskSign = sign('SIMULADOR', 1.3, 0.26, { bg: '#12325f', fg: '#ffd166' }); kioskSign.position.set(kx, 0.62, kz - 0.305); kioskSign.rotation.y = Math.PI; g.add(kioskSign);
  col.addBoxAt(kx, kz, 1.6, 0.8);

  /* lámparas */
  const lampsG = new THREE.Group(); g.add(lampsG);
  for (const [x, z] of [[-4.5, 1], [4.5, 1], [0, -3]]) {
    cyl(0.02, 0.02, 0.8, goldDark, x, H - 0.8, z, lampsG, { seg: 6, cast: false });
    const sh = cyl(0.5, 0.26, 0.34, mat(0xfff3c4, { e: 0xffd98a, ei: 1.4, r: 0.5 }), x, H - 1.14, z, lampsG, { seg: 20, cast: false });
    const pl = new THREE.PointLight(0xffe2a8, 9, 11, 1.7); pl.position.set(x, H - 1.4, z); g.add(pl); void sh;
  }
  g.add(new THREE.HemisphereLight(0xfff6dc, 0xd9a84a, 1.0));
  const sun = sunLight(g, { x: 2, y: 12, z: 9, intensity: 1.5, color: 0xfff1d0, area: 13 }); sun.target.position.set(0, 0, 0);

  /* personajes */
  const lucia = new Npc({ look: NPC_LOOKS.lucia, x: -5.9, z: 1.5, yaw: Math.PI / 2 });
  const cajera1 = new Npc({ look: NPC_LOOKS.cajera, x: -2.6, z: -5.5, yaw: 0, seatY: 0.22 });
  const cajera2 = new Npc({ look: { ...NPC_LOOKS.cajera, hair: 0x231a12, hairStyle: 'short', skin: 0xc98e63 }, x: 2.6, z: -5.5, yaw: 0, seatY: 0.22 });
  const guardia = new Npc({ look: NPC_LOOKS.guardia, x: 3.4, z: 5.4, yaw: Math.PI });
  [lucia, cajera1, cajera2, guardia].forEach(n => g.add(n.group));
  col.addCircle(-5.9, 1.5, 0.4); col.addCircle(3.4, 5.4, 0.4);
  const npcs = [lucia, cajera1, cajera2, guardia, ...execs.map(e => e.npc)];

  mergeStatic(g);
  const m = api.missions.bank;
  const interactables = [
    { id: 'exit', x: 0, y: 2.2, z: D / 2 - 0.5, radius: 1.5, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'bank') },
    { id: 'lucia', x: -5.9, y: 2.05, z: 1.5, radius: 2.2, color: 0xffc93c, label: () => m.labelFor('client'), highlight: () => m.wants('client'), action: () => m.talkToClient(lucia) },
    { id: 'documents', x: tx, y: 1.5, z: tz, radius: 2.0, color: 0xffc93c, label: () => m.labelFor('documents'), highlight: () => m.wants('documents'), action: () => m.openDocuments() },
    ...execs.map((e, i) => ({ id: 'exec-' + e.id, x: 5.5, y: 1.9, z: execZ[i], radius: 1.9, color: 0xffc93c, label: () => m.labelFor('proposal', e.id), highlight: () => m.wants('proposal', e.id), action: () => m.openProposal(e.id, e.npc) })),
    { id: 'simulator', x: kx, y: 2.25, z: kz + 0.75, radius: 1.8, color: 0x4cc9f0, label: () => m.labelFor('simulator'), highlight: () => m.wants('simulator'), action: () => m.openSimulator() },
    { id: 'board', x: 0, y: 2.6, z: bz + 0.9, radius: 2.0, color: 0xffc93c, label: () => m.labelFor('compare'), highlight: () => m.wants('compare'), action: () => m.openComparison() },
    { id: 'guard', x: 3.4, y: 2.05, z: 5.4, radius: 1.6, color: 0x9fd3ff, label: 'Hablar con el guardia', action: () => api.ui.dialog({ speaker: 'Guardia', lines: ['Bienvenido al Banco ICADEM.', 'La señora Lucía está en la sala de espera, a tu izquierda. Los ejecutivos atienden en los escritorios de la derecha.'] }) },
    { id: 'teller', x: -2.6, y: 2.2, z: -3.6, radius: 1.7, color: 0x9fd3ff, label: 'Hablar con la cajera', action: () => api.ui.dialog({ speaker: 'Cajera', lines: ['En cajas recibimos depósitos y pagos.', 'Para créditos, pasa con los ejecutivos: cada uno ofrece un producto distinto. Conviene comparar los tres antes de decidir.'] }) }
  ];

  return {
    name: 'bank', title: 'Banco ICADEM', group: g, collision: col, interactables, npcs,
    background: 0x33290f, fog: null,
    spawns: { default: { x: 0, z: 3.9, yaw: Math.PI } },
    camera: { distance: 6.2, minDistance: 2.4, maxDistance: 8.5, pitch: 0.46, yaw: 0, box: { minX: -11.5, maxX: 11.5, minZ: -8.5, maxZ: 10.2, maxY: 7.5 } },
    update(dt, t) {
      wheel.rotation.z = Math.sin(t * 0.5) * 0.25;
      const sim = m.wants('simulator');
      screen.material.color.setHex(sim ? 0x1f8fe0 : 0x1b4f86);
      bars.forEach((b, i) => { b.scale.x = 0.55 + 0.45 * Math.abs(Math.sin(t * (sim ? 2.2 : 0.7) + i * 1.3)); });
      const ready = m.wants('compare');
      boardFace.material.color.setHex(ready ? 0x1f7a55 : 0x1b447d);
      board.material.emissive.setHex(ready ? 0x0f3d2a : 0x000000);
      paperA.position.y = 0.895 + (m.wants('documents') ? Math.abs(Math.sin(t * 3)) * 0.04 : 0);
      paperB.position.y = 0.895 + (m.wants('documents') ? Math.abs(Math.cos(t * 3)) * 0.04 : 0);
      execs.forEach(e => { e.tablet.material.emissiveIntensity = m.wants('proposal', e.id) ? 0.7 + Math.sin(t * 4) * 0.4 : 0.25; });
    }
  };
}
