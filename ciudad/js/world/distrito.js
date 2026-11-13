// Escenario 14 · Distrito del Saber (al sur de la plaza, versión 1.3).
// Un barrio para explorar, aprender y convivir:
//   · Laberinto del conocimiento (setos con tres puertas que se abren respondiendo bien).
//   · Laboratorio de ciencias y Sala de escape (minijuegos validados por el servidor).
//   · Anfiteatro del Encuentro (punto de reunión con gradas para sentarse).
//   · Jardín de mariposas y Observatorio con telescopio.
// Todo lo estático se fusiona (mergeStatic); lo que se mueve es poco y barato.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { NPC_LOOKS } from '../characters/catalog.js';
import { MAZE, mazeCell } from '../edu/district-rules.js';
import { mat, box, cyl, sph, plane, slab, sign, grassTexture, pavingTexture, tree, bush, flowers, lamp, bench, cloud, skyDome, sunLight, mergeStatic } from './kit.js';

const S = 30;
export const DISTRICT_ARRIVAL = Object.freeze({ x: 0, z: 24, yaw: Math.PI });
const STAGE = { x: 14, z: 6 };
const LAB = { x: 18, z: -4, w: 10, d: 10, h: 6.5 };
const ESC = { x: 18, z: -19, w: 10, d: 9, h: 5.5 };
const OBS = { x: 22, z: 22 };
const GARDEN = { x: -16, z: 16 };
const FACTS = [
  'La luz del Sol tarda unos 8 minutos en llegar a la Tierra.',
  'La Luna se aleja de la Tierra unos 3.8 cm cada año.',
  'Júpiter es tan grande que dentro cabrían más de mil Tierras.',
  'Las estrellas parecen titilar porque su luz atraviesa el aire en movimiento de la atmósfera.',
  'Un día en Venus dura más que su año: gira muy despacio.',
  'La Vía Láctea tiene entre 100 000 y 400 000 millones de estrellas.'
];

export function buildDistrito(api) {
  const g = new THREE.Group();
  const col = new CollisionWorld().setBounds(-S + 0.6, -S + 0.6, S - 0.6, S - 0.6);
  const dyn = { butterflies: [], telescope: null, gates: [], clouds: [], banners: [] };

  /* cielo, suelo y caminos (paleta propia: lila y verde azulado) */
  g.add(skyDome(0x6aa8f0, 0xdfeeff, 0xc9e8cf));
  for (let i = 0; i < 6; i++) dyn.clouds.push(cloud(-60 + i * 24, 30 + (i % 3) * 6, -40 + (i % 3) * 30, g, 1.1 + (i % 2) * 0.3));
  plane(S * 2 + 40, S * 2 + 40, mat(0xffffff, { map: grassTexture(18, 18), r: 1 }), 0, 0, 0, g, { rx: -Math.PI / 2 }).receiveShadow = true;
  const lilac = mat(0xffffff, { map: pavingTexture(2, 14, '#e7defa', '#ddd2f4', '#c7b8e8'), r: 0.9 }), lilac2 = mat(0xffffff, { map: pavingTexture(10, 2, '#e7defa', '#ddd2f4', '#c7b8e8'), r: 0.9 });
  plane(6, S * 2 - 4, lilac, 0, 0.02, 1, g, { rx: -Math.PI / 2 }).receiveShadow = true;            // avenida norte–sur
  plane(26, 4.5, lilac2, 9, 0.021, -11.5, g, { rx: -Math.PI / 2 }).receiveShadow = true;           // hacia laboratorio y sala de escape
  plane(9, 3, lilac2, 7.5, 0.022, 6.6, g, { rx: -Math.PI / 2 }).receiveShadow = true;             // hacia el anfiteatro (entra por el costado del escenario)
  plane(14, 4, lilac2, -8, 0.023, 13, g, { rx: -Math.PI / 2 }).receiveShadow = true;              // hacia el jardín
  plane(4, 6, lilac2, -16, 0.024, 2.6, g, { rx: -Math.PI / 2 }).receiveShadow = true;              // entrada del laberinto
  plane(18, 4, lilac2, -9, 0.025, 1, g, { rx: -Math.PI / 2 }).receiveShadow = true;

  /* entrada desde la plaza */
  const teal = mat(0x2f9e8f, { r: 0.5 }), sunM = mat(0xffd166, { r: 0.5 }), violet = mat(0x7c5cc4, { r: 0.6 });
  for (const s of [-1, 1]) { box(0.6, 5.6, 0.6, violet, s * 3.4, 0, 28.2, g); sph(0.42, sunM, s * 3.4, 5.85, 28.2, g); col.addCircle(s * 3.4, 28.2, 0.5); }
  box(7.4, 0.7, 0.5, violet, 0, 5.2, 28.2, g);
  const title = sign('DISTRITO DEL SABER', 4.6, 0.62, { bg: '#ffd166', fg: '#2a1c55', sub: 'Explora · Aprende · Convive' }); title.position.set(0, 5.6, 27.9); title.rotation.y = Math.PI; g.add(title);
  // cerca perimetral baja (marca el borde sin encerrar la vista)
  const fence = mat(0xffffff, { r: 0.7 });
  for (const [x, z, w, d] of [[0, -S + 0.3, 2 * S, 0.12], [-S + 0.3, 0, 0.12, 2 * S], [S - 0.3, 0, 0.12, 2 * S], [-16.7, S - 0.3, 26.6, 0.12], [16.7, S - 0.3, 26.6, 0.12]]) box(w, 0.1, d, fence, x, 0.7, z, g, { cast: false });

  /* Laberinto del conocimiento: setos fusionados por tramos, tres puertas y la meta */
  const hedge = mat(0x3f8f4e, { flat: true, r: 0.95 }), hedgeTop = mat(0x58b565, { flat: true, r: 0.9 }), HH = 2.3, C = MAZE.cell;
  MAZE.grid.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      if (row[i] !== '#') { i++; continue; }
      let k = i; while (k + 1 < row.length && row[k + 1] === '#') k++;
      const [x0, z] = mazeCell(i, j), [x1] = mazeCell(k, j), cx = (x0 + x1) / 2, w = (k - i + 1) * C;
      box(w, HH, C, hedge, cx, 0, z, g); box(w + 0.1, 0.18, C + 0.1, hedgeTop, cx, HH, z, g, { cast: false });
      col.addBoxAt(cx, z, w, C, HH);
      i = k + 1;
    }
  });
  const [sx, sz] = MAZE.start, [ex, ez] = MAZE.checkpoints[3];
  const ms = sign('LABERINTO DEL CONOCIMIENTO', 3.8, 0.55, { bg: '#2f9e8f', fg: '#ffffff', sub: '3 puertas · responde para abrir' }); ms.position.set(sx, 3.15, sz + C / 2 + 0.05); ms.rotation.y = 0; g.add(ms);
  for (const s of [-1, 1]) { box(0.3, 3.1, 0.3, teal, sx + s * C / 2, 0, sz + C / 2, g); }
  // meta: arco dorado al salir
  for (const s of [-1, 1]) box(0.32, 3, 0.32, sunM, ex + s * C / 2, 0, ez - C / 2, g);
  box(C + 0.4, 0.4, 0.4, sunM, ex, 2.9, ez - C / 2, g);
  // puertas del saber (dinámicas: se abren al responder bien)
  ['1', '2', '3'].forEach((ch, n) => {
    const [gx, gz] = MAZE.checkpoints[n];
    const j = MAZE.grid.findIndex(r => r.includes(ch)), i = MAZE.grid[j].indexOf(ch);
    const vertical = MAZE.grid[j][i - 1] === '#' && MAZE.grid[j][i + 1] === '#';   // la puerta corta un pasillo norte–sur
    const grp = new THREE.Group(); grp.position.set(gx, 0, gz); grp.userData.dynamic = true; g.add(grp);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(vertical ? C : 0.25, 2.1, vertical ? 0.25 : C), new THREE.MeshStandardMaterial({ color: 0x9b7bff, emissive: 0x6d4fd8, emissiveIntensity: 0.6, transparent: true, opacity: 0.55 }));
    wall.position.y = 1.05; grp.add(wall);
    const tag = sign(`PUERTA ${n + 1} · ?`, 1.5, 0.42, { bg: '#2a1c55', fg: '#ffd166' }); tag.position.set(0, 2.55, 0); if (!vertical) tag.rotation.y = Math.PI / 2; grp.add(tag);
    const boxRef = { minX: gx - (vertical ? C / 2 : 0.3), minZ: gz - (vertical ? 0.3 : C / 2), maxX: gx + (vertical ? C / 2 : 0.3), maxZ: gz + (vertical ? 0.3 : C / 2), h: 2.1 };
    col.boxes.push(boxRef);
    dyn.gates.push({ grp, wall, tag, box: boxRef, open: false, x: gx, z: gz });
  });

  /* Laboratorio de ciencias */
  const labWall = mat(0xf4f7ff, { r: 0.8 }), glass = mat(0x9fd6ff, { r: 0.15, m: 0.2 }), roofM = mat(0x2f9e8f, { r: 0.6 });
  box(LAB.w, LAB.h, LAB.d, labWall, LAB.x, 0, LAB.z, g); box(LAB.w + 0.6, 0.35, LAB.d + 0.6, roofM, LAB.x, LAB.h, LAB.z, g);
  for (let k = -1; k <= 1; k++) box(0.1, 1.6, 2.2, glass, LAB.x - LAB.w / 2 - 0.02, 2.6, LAB.z + k * 3, g, { cast: false });
  box(0.12, 2.6, 1.8, mat(0x1d4f7a, { r: 0.4 }), LAB.x - LAB.w / 2 - 0.03, 0, LAB.z, g, { cast: false });   // puerta
  for (let k = 0; k < 3; k++) box(2.4, 0.08, 1.4, mat(0x1d3557, { r: 0.3, m: 0.5 }), LAB.x - 2.5 + k * 2.6, LAB.h + 0.55, LAB.z + 1.5, g, { cast: false, rx: -0.35 });   // paneles solares
  const ls = sign('LABORATORIO DE CIENCIAS', 4.2, 0.6, { bg: '#2f9e8f', fg: '#ffffff', sub: 'Experimentos' }); ls.position.set(LAB.x - LAB.w / 2 - 0.06, 4.6, LAB.z); ls.rotation.y = -Math.PI / 2; g.add(ls);
  // matraces gigantes en la entrada
  for (const [dz, c] of [[-3.2, 0x7bd389], [3.2, 0xff6b9d]]) { cyl(0.25, 0.9, 1.3, mat(0xe8f4ff, { r: 0.1 }), LAB.x - LAB.w / 2 - 1.3, 0, LAB.z + dz, g, { seg: 14 }); sph(0.62, mat(c, { e: c, ei: 0.25, r: 0.3 }), LAB.x - LAB.w / 2 - 1.3, 0.55, LAB.z + dz, g); col.addCircle(LAB.x - LAB.w / 2 - 1.3, LAB.z + dz, 0.9); }
  col.addBoxAt(LAB.x, LAB.z, LAB.w + 0.4, LAB.d + 0.4, LAB.h);

  /* Sala de escape */
  const escWall = mat(0x3b2a6b, { r: 0.8 }), gold = mat(0xffd166, { m: 0.6, r: 0.35 });
  box(ESC.w, ESC.h, ESC.d, escWall, ESC.x, 0, ESC.z, g); box(ESC.w + 0.5, 0.3, ESC.d + 0.5, mat(0x241845), ESC.x, ESC.h, ESC.z, g);
  box(0.12, 2.6, 1.8, mat(0x120c24, { r: 0.4 }), ESC.x - ESC.w / 2 - 0.03, 0, ESC.z, g, { cast: false });
  const lockX = ESC.x - ESC.w / 2 - 0.15;
  box(0.2, 1.1, 1.3, gold, lockX, 3.4, ESC.z, g, { cast: false });
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 8, 20, Math.PI), gold); shackle.position.set(lockX, 4.5, ESC.z); shackle.rotation.y = Math.PI / 2; g.add(shackle);
  const es = sign('SALA DE ESCAPE', 3.4, 0.58, { bg: '#ffd166', fg: '#2a1c55', sub: '3 candados · ¿podrás salir?' }); es.position.set(ESC.x - ESC.w / 2 - 0.06, 2.75, ESC.z - 2.9); es.rotation.y = -Math.PI / 2; g.add(es);
  col.addBoxAt(ESC.x, ESC.z, ESC.w + 0.4, ESC.d + 0.4, ESC.h);

  /* Anfiteatro del Encuentro: escenario y tres gradas en semicírculo */
  slab(7, 3.4, 0.55, 0.3, mat(0xc7b8e8, { r: 0.8 }), STAGE.x, 0, STAGE.z, g);
  box(7.4, 3.2, 0.4, violet, STAGE.x, 0, STAGE.z - 1.9, g); col.addBoxAt(STAGE.x, STAGE.z - 1.9, 7.4, 0.4, 3.2);
  const as = sign('ANFITEATRO DEL ENCUENTRO', 4.4, 0.55, { bg: '#2a1c55', fg: '#ffd166', sub: 'Punto de reunión' }); as.position.set(STAGE.x, 2.5, STAGE.z - 1.66); g.add(as);
  const tiers = [[5.2, 0.42], [6.6, 0.84], [8.0, 1.26]], seatM = [mat(0xf2e6d0, { r: 0.85 }), mat(0xe8d8bc, { r: 0.85 }), mat(0xddcaa8, { r: 0.85 })], seats = [];
  tiers.forEach(([rad, top], k) => {
    for (let a = 25; a <= 155; a += 13) {
      const t = a * Math.PI / 180, x = STAGE.x + Math.cos(t) * rad, z = STAGE.z + Math.sin(t) * rad;
      const b = box(1.5, top, 1.15, seatM[k], x, 0, z, g); b.rotation.y = -t + Math.PI / 2;
      if (k === 0 && (a === 64 || a === 116)) seats.push({ x, z, yaw: Math.atan2(STAGE.x - x, STAGE.z - z), seatY: top });
      if (k === 2) col.addCircle(x, z, 0.6);
    }
  });

  /* Jardín de mariposas */
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 2.6 + (i % 3) * 1.4; flowers(GARDEN.x + Math.cos(a) * r, GARDEN.z + Math.sin(a) * r, g, [[0xff6b8b, 0xffd166, 0xffffff], [0xb388ff, 0xff9f43, 0xffffff], [0x4cc9f0, 0xffd166, 0xff6b8b]][i % 3]); }
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { bush(GARDEN.x + dx, GARDEN.z + dz, g, 0x58b565, 1.2); col.addCircle(GARDEN.x + dx, GARDEN.z + dz, 0.8); }
  const perg = mat(0xffffff, { r: 0.7 });
  for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) { box(0.22, 2.6, 0.22, perg, GARDEN.x + dx, 0, GARDEN.z + dz, g); col.addCircle(GARDEN.x + dx, GARDEN.z + dz, 0.25); }
  for (let k = -2; k <= 2; k++) box(4.2, 0.12, 0.16, perg, GARDEN.x, 2.6, GARDEN.z + k * 0.9, g, { cast: false });
  bench(GARDEN.x, GARDEN.z - 3.2, 0, g);
  const gs = sign('JARDÍN DE MARIPOSAS', 2.8, 0.45, { bg: '#7bd389', fg: '#173d22' }); gs.position.set(GARDEN.x + 4.6, 1.6, GARDEN.z - 4.6); gs.rotation.y = Math.PI * 0.75; g.add(gs);
  const wingColors = [0xff9f43, 0xb388ff, 0x4cc9f0, 0xffd166, 0xff6b8b];
  for (let i = 0; i < 12; i++) {
    const bf = new THREE.Group(); bf.userData.dynamic = true;
    const wm = new THREE.MeshBasicMaterial({ color: wingColors[i % wingColors.length], side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.22), wm); w.position.x = s * 0.14; bf.add(w); }
    g.add(bf); dyn.butterflies.push({ bf, phase: i * 1.7, r: 1.5 + (i % 4) * 1.1, h: 0.8 + (i % 3) * 0.5, speed: 0.4 + (i % 5) * 0.08 });
  }

  /* Observatorio con telescopio */
  cyl(3.4, 3.6, 3.2, mat(0xf4f7ff, { r: 0.8 }), OBS.x, 0, OBS.z, g, { seg: 20 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.45, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xdfe6f3, { m: 0.4, r: 0.35 })); dome.position.set(OBS.x, 3.2, OBS.z); dome.castShadow = true; g.add(dome);
  box(0.8, 3.4, 1.4, mat(0x1d3557, { r: 0.5 }), OBS.x, 3.2, OBS.z, g, { cast: false, rx: 0 });
  col.addCircle(OBS.x, OBS.z, 3.7);
  const tele = new THREE.Group(); tele.position.set(OBS.x - 4.6, 0, OBS.z - 3.2); tele.userData.dynamic = true; g.add(tele);
  cyl(0.06, 0.08, 1.2, mat(0x2b2f3a), 0, 0, 0, tele, { seg: 8 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.5, 12), mat(0xffffff, { m: 0.3, r: 0.4 })); tube.position.y = 1.4; tube.rotation.x = 0.9; tele.add(tube); dyn.telescope = tele;
  col.addCircle(OBS.x - 4.6, OBS.z - 3.2, 0.35);
  const os = sign('OBSERVATORIO', 2.6, 0.48, { bg: '#1d3557', fg: '#ffffff' }); os.position.set(OBS.x - 2.6, 2.4, OBS.z - 2.6); os.rotation.y = Math.PI + Math.PI / 4; g.add(os);

  /* Árbol del saber en el cruce, cartelera, faroles, banderines y vegetación */
  tree(-6.5, 6.5, g, { scale: 1.7, color: 0x3f9a4d, color2: 0x8bd97a }); col.addCircle(-6.5, 6.5, 0.7);
  for (const [x, z, ry] of [[-6.5, 3.4, 0], [-9.5, 6.5, Math.PI / 2], [-3.4, 9, Math.PI]]) bench(x, z, ry, g);
  box(3.2, 2.2, 0.2, mat(0x2a1c55, { r: 0.6 }), 4.6, 0.6, 22, g); const bs = sign('RETOS DEL DISTRITO', 2.8, 0.5, { bg: '#ffd166', fg: '#2a1c55', sub: 'Laberinto · Laboratorio · Escape' }); bs.position.set(4.6, 2.2, 22.14); g.add(bs);
  for (const s of [-1, 1]) box(0.14, 0.6, 0.14, mat(0x2a1c55), 4.6 + s * 1.4, 0, 22, g, { cast: false });
  col.addBoxAt(4.6, 22, 3.2, 0.4, 2.8);
  for (const z of [20, 12, 4, -6, -16, -24]) for (const s of [-1, 1]) { lamp(s * 3.6, z, g); col.addCircle(s * 3.6, z, 0.25); }
  const flagC = [0xff6b6b, 0xffd166, 0x4cc9f0, 0x7bd389, 0xb388ff];
  for (let i = 0; i < 10; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 3), mat(flagC[i % 5], { r: 0.6 })); f.rotation.x = Math.PI; f.position.set(-3.1 + i * 0.7, 4.85, 28.2); g.add(f); }
  for (const [x, z, s] of [[-26, 26, 1.2], [26, 6, 1], [-24, 6, 1.1], [8, 25, 0.9], [-8, 25, 0.9], [26, -27, 1], [6, -27, 1.1], [-2, -27, 1], [10, 18, 0.9], [-26, -27.5, 1]]) { tree(x, z, g, { scale: s }); col.addCircle(x, z, 0.5); }
  for (const [x, z] of [[6, 16], [-4.5, 17], [24, -11], [9, -24], [-2, -18], [24, 12]]) bush(x, z, g, 0x58b565, 1);

  g.add(new THREE.HemisphereLight(0xe6efff, 0x9ec58a, 1.15));
  const sun = sunLight(g, { x: 26, y: 46, z: 20, intensity: 2.4, area: 34 });
  const mergedCount = mergeStatic(g);

  /* personajes del distrito: una científica y un estudiante que pasean; uno se acerca con retos */
  const named = (npc, quizName) => Object.assign(npc, { quizName });
  const npcs = [
    named(new Npc({ look: { skin: 0xd9a37a, hair: 0x2a1e14, hairStyle: 'bun', top: 0xffffff, topAccent: 0x2f9e8f, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['glasses', 'badge'] }, route: [[2, 18], [2, -8], [9, -11], [9, -11.5], [2, -8], [-2, 4], [-12, 13]], speed: 1.05, pause: 2.4 }), 'Dra. Elena'),
    new Npc({ look: NPC_LOOKS.vecino, route: [[-2, 22], [-2, -20], [7, -12], [-2, -20]], speed: 1.35, pause: 1.6 }),
    new Npc({ look: { skin: 0xf0c7a4, hair: 0x6b3f1f, hairStyle: 'long', top: 0xb388ff, topAccent: 0xffffff, bottom: 0x3a5a78, shoes: 0xf2e6d0, accessories: [] }, x: STAGE.x - 1.2, z: STAGE.z + 0.2, yaw: 0.3 })
  ];
  npcs.forEach(n => g.add(n.group));

  const district = () => api.district;
  const interactables = [
    { id: 'exit', x: 0, y: 2, z: 27, radius: 2.6, color: 0x2f9e8f, label: 'Volver a la plaza', action: () => { district()?.mazeQuit(true); api.travel('plaza', 'distrito'); } },
    { id: 'board', x: 4.6, y: 1.7, z: 22.9, radius: 2, color: 0xffd166, label: 'Retos del distrito', action: () => district()?.board() },
    { id: 'maze', x: sx, y: 1.6, z: sz + C / 2 + 1.1, radius: 2, color: 0x7bd389, label: () => district()?.mazeLabel() || 'Laberinto del conocimiento', action: () => district()?.mazeStart() },
    ...dyn.gates.map((gt, n) => ({ id: 'gate' + n, x: gt.x, y: 1.4, z: gt.z, radius: 2, color: 0x9b7bff, label: () => gt.open ? `Puerta ${n + 1} abierta` : `Puerta ${n + 1} · responde para abrir`, action: () => district()?.gate(n) })),
    { id: 'lab', x: LAB.x - LAB.w / 2 - 0.6, y: 1.6, z: LAB.z, radius: 2.2, color: 0x7bd389, label: 'Entrar al Laboratorio de experimentos', action: () => district()?.play('laboratorio') },
    { id: 'escape', x: ESC.x - ESC.w / 2 - 0.6, y: 1.6, z: ESC.z, radius: 2.2, color: 0xffd166, label: 'Entrar a la Sala de escape', action: () => district()?.play('escape') },
    { id: 'telescope', x: OBS.x - 4.6, y: 1.5, z: OBS.z - 2.2, radius: 1.8, color: 0x9fd3ff, label: 'Mirar por el telescopio', action: () => api.ui.dialog({ speaker: 'Observatorio', lines: [FACTS[Math.floor(Math.random() * FACTS.length)], 'Vuelve otro día: el cielo siempre tiene algo nuevo.'] }) },
    ...seats.map((st, n) => ({ id: 'seat' + n, x: st.x, y: 1, z: st.z, radius: 1.3, color: 0xffd166, label: 'Sentarse en las gradas', action: () => api.sit(st) }))
  ];

  return {
    name: 'distrito', title: 'Distrito del Saber', group: g, collision: col, interactables, npcs,
    background: 0xdfeeff, fog: { color: 0xdfeeff, near: 55, far: 140 },
    spawns: { default: DISTRICT_ARRIVAL },
    camera: { distance: 7.6, minDistance: 2.6, maxDistance: 12, pitch: 0.46, box: null },
    sun, mergedCount,
    /** Puertas del laberinto (las abre o cierra el controlador del distrito). */
    maze: {
      gates: dyn.gates,
      setGate(n, open) {
        const gt = dyn.gates[n]; if (!gt || gt.open === open) return;
        gt.open = open; gt.wall.visible = !open;
        const i = col.boxes.indexOf(gt.box); if (open && i >= 0) col.boxes.splice(i, 1); else if (!open && i < 0) col.boxes.push(gt.box);
      },
      reset() { dyn.gates.forEach((_, n) => this.setGate(n, false)); }
    },
    update(dt, t) {
      for (const c of dyn.clouds) { c.position.x += dt * 0.9; if (c.position.x > 90) c.position.x = -90; }
      for (const b of dyn.butterflies) {
        const a = t * b.speed + b.phase; b.bf.position.set(GARDEN.x + Math.cos(a) * b.r, b.h + Math.sin(t * 2 + b.phase) * 0.25, GARDEN.z + Math.sin(a * 1.3) * b.r);
        b.bf.rotation.y = -a; const flap = Math.sin(t * 16 + b.phase) * 0.9; b.bf.children[0].rotation.y = flap; b.bf.children[1].rotation.y = -flap;
      }
      if (dyn.telescope) dyn.telescope.rotation.y = Math.sin(t * 0.15) * 0.8;
      for (const gt of dyn.gates) if (!gt.open) { gt.wall.material.emissiveIntensity = 0.45 + Math.sin(t * 2.4) * 0.2; }
    }
  };
}
