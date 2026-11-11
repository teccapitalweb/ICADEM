// Escenario 7 · Interior del Hospital ICADEM (blancos y verde clínico), misión 5:
// «Turno de decisiones». Recepción, área de triaje, observación, consultorio y urgencias.
// Cada cama tiene paciente, monitor (con trazo animado), expediente al pie y una luz de triaje
// que toma el color que el jugador asigna: la priorización se ve en el propio hospital.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { PATIENTS } from '../missions/hospital-shift-logic.js';
import { mat, box, cyl, sph, plane, slab, sign, checkerTexture, sunLight, mergeStatic } from './kit.js';

const LOOKS = {
  lupita: { skin: 0xd9a37a, hair: 0x2a1e14, hairStyle: 'bun', top: 0x2bb5a0, topAccent: 0xffffff, bottom: 0x2bb5a0, shoes: 0xffffff, accessories: ['badge'] },
  salas: { skin: 0xe9b58c, hair: 0x3a3a3a, hairStyle: 'side', top: 0xffffff, topAccent: 0x2b6cb0, bottom: 0x2b6cb0, shoes: 0xffffff, accessories: ['badge', 'glasses', 'lapels'] },
  camillero: { skin: 0xb9794d, hair: 0x15100b, hairStyle: 'short', top: 0x7fb3e6, topAccent: 0xffffff, bottom: 0x7fb3e6, shoes: 0xffffff, accessories: [] },
  aurelio: { skin: 0xd9a37a, hair: 0x9a9a9a, hairStyle: 'short', top: 0xbfd8ef, topAccent: 0xffffff, bottom: 0x4a5568, shoes: 0x3a2618, accessories: [] },
  celia: { skin: 0xf0c7a4, hair: 0xd8d8d8, hairStyle: 'bun', top: 0xbfd8ef, topAccent: 0xffffff, bottom: 0x6b5a7a, shoes: 0xf2e6d0, accessories: ['glasses'] },
  joaquin: { skin: 0xc98e63, hair: 0x241810, hairStyle: 'short', top: 0xf2b93b, topAccent: 0x3a5fc4, bottom: 0x3a5fc4, shoes: 0xffffff, accessories: [] },
  mariana: { skin: 0xe0ab85, hair: 0x6b4a2b, hairStyle: 'long', top: 0xe5484d, topAccent: 0xffffff, bottom: 0x1d2a40, shoes: 0xffffff, accessories: [] },
  nieto: { skin: 0xf0c7a4, hair: 0x6b4a2b, hairStyle: 'side', top: 0x58b565, topAccent: 0xffffff, bottom: 0x27304a, shoes: 0xffffff, accessories: [] },
  mama: { skin: 0xc98e63, hair: 0x1d140d, hairStyle: 'long', top: 0xb56bd6, topAccent: 0xffffff, bottom: 0x4a4f7a, shoes: 0xffffff, accessories: [] }
};

export function buildHospital(api) {
  const g = new THREE.Group();
  const W = 20, D = 16, H = 4.6;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const teal = mat(0x2bb5a0, { r: 0.6 }), white = mat(0xffffff, { r: 0.55 }), steel = mat(0xc4ccd6, { m: 0.6, r: 0.3 });
  const mint = mat(0xe6f6f2, { r: 0.9 }), red = mat(0xe5484d, { r: 0.7 }), navy = mat(0x12325f, { r: 0.6 });

  /* estructura */
  const floor = plane(W, D, mat(0xffffff, { map: checkerTexture(10, 8, '#f6fbfa', '#e3f1ee', 'rgba(255,255,255,.5)'), r: 0.3, m: 0.05 }), 0, 0, 0, g, { rx: -Math.PI / 2 });
  floor.receiveShadow = true;
  const wallM = mat(0xf4fbf9, { r: 0.95 }), wall2 = mat(0xe8f5f2, { r: 0.95 });
  plane(W, H, wallM, 0, H / 2, -D / 2, g);
  plane(W, H, wallM, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, wall2, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 });
  plane(D, H, wall2, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  // franja guía en el piso (verde) de la entrada al triaje y a urgencias (roja)
  slab(0.35, 6.2, 0.01, 0.1, teal, -1.2, 0.006, 3.6, g, { cast: false });
  slab(0.35, 8.0, 0.01, 0.1, red, 1.2, 0.006, 1.0, g, { cast: false });
  // zona de urgencias con piso distinto
  slab(9.2, 5.6, 0.015, 0.2, mat(0xfbe9e9, { r: 0.6 }), 5.2, 0.004, -5.0, g, { cast: false });
  for (const [w, x, z, ry] of [[W, 0, -D / 2 + 0.02, 0], [D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, -Math.PI / 2]]) plane(w, 0.3, teal, x, 1.0, z, g, { ry, cast: false });

  /* entrada (muro sur, planos de una cara) */
  const south = (w, hh, material, x, y, dz) => plane(w, hh, material, x, y, D / 2 - dz, g, { ry: Math.PI });
  south(3.2, 3.2, teal, 0, 1.6, 0.02);
  for (const s of [-1, 1]) south(1.3, 2.9, mat(0xbfe9e2, { r: 0.1, m: 0.4, e: 0x3f8f84, ei: 0.25 }), s * 0.7, 1.45, 0.03);
  const exitSign = sign('SALIDA', 1.2, 0.34, { bg: '#1f7a55', fg: '#ffffff' }); exitSign.position.set(0, 3.5, D / 2 - 0.06); exitSign.rotation.y = Math.PI; g.add(exitSign);

  /* recepción (poniente-sur) con la jefa de enfermería */
  const rx = -5.6, rz = 4.6;
  box(3.6, 1.05, 0.9, white, rx, 0, rz, g); box(3.8, 0.08, 1.1, teal, rx, 1.05, rz, g);
  box(3.6, 0.35, 0.05, teal, rx, 0.45, rz + 0.46, g, { cast: false });
  const recSign = sign('RECEPCIÓN', 1.8, 0.36, { bg: '#2bb5a0', fg: '#ffffff' }); recSign.position.set(rx, 2.8, rz - 0.2); g.add(recSign);
  col.addBoxAt(rx, rz, 3.8, 1.1);
  // pizarrón de pacientes (muro poniente)
  const bx = -W / 2 + 0.08, bz = 1.6;
  box(0.08, 1.5, 2.6, navy, bx, 1.1, bz, g);
  const boardFace = plane(2.4, 1.3, new THREE.MeshBasicMaterial({ color: 0xf4fbff, toneMapped: false }), bx + 0.06, 1.85, bz, g, { ry: Math.PI / 2 });
  const boardSign = sign('PACIENTES DEL TURNO', 2.2, 0.28, { bg: '#12325f', fg: '#ffffff' }); boardSign.position.set(bx + 0.08, 2.75, bz); boardSign.rotation.y = Math.PI / 2; g.add(boardSign);
  const boardDots = PATIENTS.map((p, i) => { const d = plane(0.22, 0.22, new THREE.MeshBasicMaterial({ color: 0x9aa7b8, toneMapped: false }), bx + 0.07, 2.3 - i * 0.3, bz - 0.9, g, { ry: Math.PI / 2 }); d.userData.dynamic = true; return d; });
  // sala de espera
  for (let i = 0; i < 4; i++) { slab(0.55, 0.55, 0.1, 0.1, teal, -8.6 + i * 0.7, 0.42, 6.9, g); slab(0.55, 0.1, 0.5, 0.05, teal, -8.6 + i * 0.7, 0.5, 7.2, g); }
  col.addBoxAt(-7.55, 7.0, 3.0, 0.8);

  /* área de triaje (centro): silla, carrito de signos vitales y letrero */
  const trx = -1.0, trz = 1.6;
  slab(0.7, 0.7, 0.12, 0.1, mat(0x3f8f84, { r: 0.7 }), trx, 0.45, trz, g); slab(0.7, 0.12, 0.7, 0.06, mat(0x3f8f84, { r: 0.7 }), trx, 0.55, trz - 0.32, g);
  box(0.5, 0.9, 0.4, steel, trx + 0.9, 0, trz, g); box(0.42, 0.3, 0.05, mat(0x10182b, { r: 0.35 }), trx + 0.9, 1.0, trz, g);
  const triSign = sign('TRIAJE', 1.3, 0.34, { bg: '#f2b93b', fg: '#1d2433' }); triSign.position.set(trx + 0.2, 2.4, trz); g.add(triSign);
  col.addBoxAt(trx + 0.4, trz, 1.7, 0.9);

  /* estación de enfermería con la bitácora (oriente-sur) */
  const sx = 6.0, sz = 4.4;
  box(3.0, 1.0, 1.0, white, sx, 0, sz, g); box(3.2, 0.07, 1.2, teal, sx, 1.0, sz, g);
  const pc = box(0.8, 0.5, 0.05, mat(0x10182b, { r: 0.35 }), sx + 0.5, 1.33, sz - 0.1, g, { rx: -0.08 });
  const pcScreen = plane(0.72, 0.42, new THREE.MeshBasicMaterial({ color: 0x1f7a6c, toneMapped: false }), sx + 0.5, 1.33, sz - 0.07, g, { rx: -0.08 });
  pcScreen.userData.dynamic = true; void pc;
  const stSign = sign('ENFERMERÍA · BITÁCORA', 2.3, 0.34, { bg: '#12325f', fg: '#ffffff' }); stSign.position.set(sx, 2.7, sz - 0.2); g.add(stSign);
  col.addBoxAt(sx, sz, 3.2, 1.2);

  /* camas: cabecera contra el muro, monitor al lado, expediente al pie y luz de triaje */
  const beds = {};
  const bed = (id, x, z, yaw = 0, zone = 0xe8f5f2) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = yaw; g.add(b);
    box(1.0, 0.45, 2.0, steel, 0, 0, 0, b);
    box(0.95, 0.14, 1.95, mat(0xffffff, { r: 0.8 }), 0, 0.45, 0, b, { cast: false });
    box(0.95, 0.12, 0.6, mat(zone, { r: 0.8 }), 0, 0.5, 0.6, b, { cast: false });
    slab(0.6, 0.35, 0.12, 0.1, mat(0xffffff, { r: 0.9 }), 0, 0.6, -0.72, b, { cast: false });
    box(1.0, 0.7, 0.06, steel, 0, 0.45, -1.0, b, { cast: false });
    // monitor en un poste
    cyl(0.03, 0.03, 1.5, steel, 0.8, 0, -0.75, b, { seg: 8, cast: false });
    box(0.5, 0.36, 0.08, mat(0x10182b, { r: 0.35 }), 0.8, 1.5, -0.75, b, { cast: false });
    const screen = plane(0.44, 0.3, new THREE.MeshBasicMaterial({ color: 0x062018, toneMapped: false }), 0.8, 1.68, -0.705, b);
    const blip = plane(0.06, 0.05, new THREE.MeshBasicMaterial({ color: 0x5dff9e, toneMapped: false }), 0.6, 1.7, -0.7, b);
    screen.userData.dynamic = blip.userData.dynamic = true;
    // expediente al pie
    box(0.32, 0.42, 0.03, mat(0x8a5a36, { r: 0.6 }), 0, 0.85, 1.03, b, { cast: false });
    box(0.26, 0.32, 0.01, mat(0xffffff, { r: 0.9 }), 0, 0.86, 1.05, b, { cast: false });
    // luz de triaje sobre la cabecera
    const lamp = sph(0.13, new THREE.MeshStandardMaterial({ color: 0x9aa7b8, emissive: 0x000000, roughness: 0.4 }), 0, 1.95, -0.95, b, { seg: 12, rings: 10 });
    lamp.userData.dynamic = true;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20), new THREE.MeshBasicMaterial({ color: 0x9aa7b8, toneMapped: false, transparent: true, opacity: 0.0 }));
    halo.position.set(0, 1.95, -0.95); halo.userData.dynamic = true; b.add(halo);
    b.updateMatrixWorld(true);
    const world = (lx, lz) => { const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(b.matrixWorld); return [v.x, v.z]; };
    col.addCircle(...world(0, 0.4), 0.75); col.addCircle(...world(0, -0.45), 0.75);
    beds[id] = { group: b, screen, blip, lamp, halo, monitor: world(1.25, -0.4), chart: world(0, 1.5), side: world(-1.05, 0.1) };
    return beds[id];
  };

  /* urgencias (nororiente): dos camas, rótulo y carro rojo */
  bed('aurelio', 3.4, -5.7, 0, 0xfbd5d5); bed('celia', 6.8, -5.7, 0, 0xfbd5d5);
  const urgSign = sign('URGENCIAS', 2.0, 0.42, { bg: '#e5484d', fg: '#ffffff' }); urgSign.position.set(5.1, 3.5, -D / 2 + 0.06); g.add(urgSign);
  box(0.7, 1.0, 0.5, red, 9.1, 0, -6.6, g); for (let i = 0; i < 3; i++) box(0.62, 0.04, 0.45, mat(0xffffff, { r: 0.6 }), 9.1, 0.3 + i * 0.3, -6.33, g, { cast: false });
  col.addBoxAt(9.1, -6.6, 0.8, 0.6);

  /* observación (norponiente) con cortinas */
  bed('joaquin', -4.6, -5.7, 0, 0xfff1c9);
  const curtain = mat(0x9fd8cf, { r: 0.9, own: true });
  for (const dx of [-1.25, 1.25]) { box(0.04, 2.1, 2.6, curtain, -4.6 + dx, 0.15, -5.6, g, { cast: false }); col.addBoxAt(-4.6 + dx, -5.6, 0.12, 2.6); }
  box(2.6, 0.04, 0.04, steel, -4.6, 2.35, -4.3, g, { cast: false });
  const obsSign = sign('OBSERVACIÓN', 2.0, 0.36, { bg: '#2bb5a0', fg: '#ffffff' }); obsSign.position.set(-4.6, 3.5, -D / 2 + 0.06); g.add(obsSign);

  /* consultorio 2 (poniente) con mampara */
  const cx = -7.6, cz = -1.6;
  box(0.1, 2.4, 3.2, mat(0xd5ece8, { r: 0.9 }), cx + 1.9, 0, cz, g); col.addBoxAt(cx + 1.9, cz - 0.6, 0.15, 2.0);
  box(1.2, 0.75, 0.7, white, cx - 0.6, 0, cz - 1.0, g); col.addBoxAt(cx - 0.6, cz - 1.0, 1.25, 0.75);
  slab(0.5, 0.5, 0.1, 0.1, teal, cx + 0.6, 0.42, cz + 0.2, g);
  const conSign = sign('CONSULTORIO 2', 1.8, 0.32, { bg: '#2bb5a0', fg: '#ffffff' }); conSign.position.set(cx + 1.96, 2.1, cz + 0.6); conSign.rotation.y = Math.PI / 2; g.add(conSign);
  // monitor y expediente del consultorio (no hay cama: Mariana está sentada)
  box(0.5, 0.9, 0.4, steel, cx + 0.6, 0, cz - 1.0, g);
  const mScreen = plane(0.42, 0.28, new THREE.MeshBasicMaterial({ color: 0x062018, toneMapped: false }), cx + 0.6, 1.12, cz - 0.78, g);
  const mBlip = plane(0.06, 0.05, new THREE.MeshBasicMaterial({ color: 0x5dff9e, toneMapped: false }), cx + 0.42, 1.14, cz - 0.77, g);
  mScreen.userData.dynamic = mBlip.userData.dynamic = true;
  const mLamp = sph(0.13, new THREE.MeshStandardMaterial({ color: 0x9aa7b8, emissive: 0x000000, roughness: 0.4 }), cx + 0.6, 2.3, cz - 0.3, g, { seg: 12, rings: 10 }); mLamp.userData.dynamic = true;
  const mHalo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20), new THREE.MeshBasicMaterial({ color: 0x9aa7b8, toneMapped: false, transparent: true, opacity: 0 })); mHalo.position.set(cx + 0.6, 2.3, cz - 0.3); mHalo.userData.dynamic = true; g.add(mHalo);
  beds.mariana = { screen: mScreen, blip: mBlip, lamp: mLamp, halo: mHalo, monitor: [cx + 1.1, cz - 0.4], chart: [cx - 0.6, cz - 0.3], side: [cx + 0.6, cz + 0.9] };

  /* plantas y luces */
  for (const [x, z] of [[-9.2, 5.6], [9.2, 6.6]]) { cyl(0.28, 0.22, 0.5, teal, x, 0, z, g, { seg: 12 }); sph(0.5, mat(0x3f9a4d, { r: 0.8 }), x, 0.95, z, g, { seg: 10, rings: 8 }); col.addCircle(x, z, 0.4); }
  for (const [x, z] of [[-4.5, 2], [4.5, 2], [-4.5, -4], [4.5, -4]]) {
    box(1.6, 0.06, 0.4, mat(0xffffff, { e: 0xeafff9, ei: 1.2, r: 0.5 }), x, H - 0.05, z, g, { cast: false });
    const pl = new THREE.PointLight(0xf3fffb, 6, 10, 1.7); pl.position.set(x, H - 0.4, z); g.add(pl);
  }
  g.add(new THREE.HemisphereLight(0xf6fffd, 0xbfd8d2, 1.1));
  const sun = sunLight(g, { x: -3, y: 12, z: 9, intensity: 1.2, color: 0xffffff, area: 14 }); sun.target.position.set(0, 0, 0);

  /* personas */
  const lupita = new Npc({ look: LOOKS.lupita, x: rx, z: rz - 1.0, yaw: Math.PI });
  const salas = new Npc({ look: LOOKS.salas, x: 7.6, z: -1.6, yaw: Math.PI * 0.8 });
  const camillero = new Npc({ look: LOOKS.camillero, route: [[2.4, 6.2], [2.4, -2.4], [-2.8, -2.4], [-2.8, 6.2]], speed: 1.2, pause: 1.4 });
  const patients = {
    aurelio: new Npc({ look: LOOKS.aurelio, x: 3.4, z: -5.4, yaw: 0, sitting: true, seatY: 0.55 }),
    celia: new Npc({ look: LOOKS.celia, x: 6.8, z: -5.4, yaw: 0, sitting: true, seatY: 0.55 }),
    joaquin: new Npc({ look: LOOKS.joaquin, x: -4.6, z: -5.4, yaw: 0, sitting: true, seatY: 0.55 }),
    mariana: new Npc({ look: LOOKS.mariana, x: cx + 0.6, z: cz + 0.2, yaw: 0, sitting: true, seatY: 0.45 })
  };
  const family = [new Npc({ look: LOOKS.nieto, x: 7.9, z: -4.6, yaw: -0.6 }), new Npc({ look: LOOKS.mama, x: -3.6, z: -4.4, yaw: 0.6 })];
  const npcs = [lupita, salas, camillero, ...Object.values(patients), ...family];
  npcs.forEach(n => g.add(n.group));
  col.addCircle(rx, rz - 1.0, 0.4); col.addCircle(7.9, -4.6, 0.35); col.addCircle(-3.6, -4.4, 0.35);

  mergeStatic(g);
  const m = api.missions.hospital;
  const interactables = [
    { id: 'exit', x: 0, y: 2.1, z: D / 2 - 0.6, radius: 1.6, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'hospital') },
    { id: 'lupita', x: rx, y: 2.0, z: rz - 1.0, radius: 2.0, color: 0xffc93c, label: () => m.labelFor('nurse'), highlight: () => m.wants('nurse'), action: () => m.talkToNurse(lupita) },
    { id: 'board', x: bx + 1.0, y: 2.0, z: bz, radius: 1.9, color: 0x4cc9f0, label: () => m.labelFor('board'), highlight: () => m.wants('board'), action: () => m.openBoard() },
    { id: 'record', x: sx, y: 2.0, z: sz - 1.0, radius: 1.7, color: 0x4cc9f0, label: () => m.labelFor('record'), highlight: () => m.wants('record'), action: () => m.openRecord() },
    { id: 'salas', x: 7.6, y: 2.0, z: -1.6, radius: 1.5, color: 0x9fd3ff, label: () => m.labelFor('doctor'), action: () => api.ui.dialog({ speaker: 'Dr. Salas', lines: ['Si ves un signo de alarma, avísame de inmediato: prefiero diez avisos de más que uno tarde.'] }) },
    ...PATIENTS.flatMap(p => {
      const b = beds[p.id], n = patients[p.id];
      return [
        { id: 'pt-' + p.id, x: b.side[0], y: 1.8, z: b.side[1], radius: 1.35, color: 0xffc93c, label: () => m.labelFor('patient', p.id), highlight: () => m.wants('patient', p.id), action: () => m.attend(p.id, n) },
        { id: 'mon-' + p.id, x: b.monitor[0], y: 1.9, z: b.monitor[1], radius: 1.2, color: 0x5dff9e, label: () => m.labelFor('review', p.id, 'monitor'), highlight: () => m.wants('review', p.id, 'monitor'), action: () => m.review(p.id, 'monitor') },
        { id: 'chart-' + p.id, x: b.chart[0], y: 1.4, z: b.chart[1], radius: 1.2, color: 0x4cc9f0, label: () => m.labelFor('review', p.id, 'chart'), highlight: () => m.wants('review', p.id, 'chart'), action: () => m.review(p.id, 'chart') }
      ];
    })
  ];

  // El doctor acude a la cama cuando se le pide apoyo.
  let doctorTarget = null;
  const scene = {
    name: 'hospital', title: 'Hospital ICADEM', group: g, collision: col, interactables, npcs,
    background: 0x1c3a36, fog: null,
    spawns: { default: { x: 0, z: 5.9, yaw: Math.PI } },
    camera: { distance: 6.4, minDistance: 2.4, maxDistance: 8.8, pitch: 0.48, yaw: 0, box: { minX: -12, maxX: 12, minZ: -9.5, maxZ: 11, maxY: 6.6 } },
    callDoctor(id) { const b = beds[id]; if (b) doctorTarget = { x: b.side[0] + 0.9, z: b.side[1] + 0.6 }; },
    update(dt, t) {
      const a = m.attempt;
      PATIENTS.forEach((p, i) => {
        const b = beds[p.id], hex = m.colorOf(p.id);
        b.blip.position.x = (b.blip.userData.x0 ??= b.blip.position.x) + ((t * 0.35 + i * 0.2) % 1) * 0.36;
        b.blip.scale.y = 1 + Math.max(0, Math.sin(t * (p.vitals.fc / 9))) * 2.2;
        b.screen.material.color.setHex(m.wants('review', p.id, 'monitor') ? 0x0b3a2b : 0x062018);
        if (hex !== null) {
          b.lamp.material.color.setHex(hex); b.lamp.material.emissive.setHex(hex); b.lamp.material.emissiveIntensity = 0.6 + Math.sin(t * 4 + i) * 0.3;
          b.halo.material.color.setHex(hex); b.halo.material.opacity = 0.5 + Math.sin(t * 4 + i) * 0.3;
          boardDots[i].material.color.setHex(hex);
        }
      });
      boardFace.material.color.setHex(m.wants('board') ? 0xdff3ff : 0xf4fbff);
      pcScreen.material.color.setHex(m.wants('record') ? 0x2fae98 : 0x1f7a6c);
      if (doctorTarget) {
        const p = salas.group.position, dx = doctorTarget.x - p.x, dz = doctorTarget.z - p.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { const step = Math.min(d, dt * 2.4); p.x += dx / d * step; p.z += dz / d * step; salas.group.rotation.y = Math.atan2(dx, dz); }
        else doctorTarget = null;
      }
      void a;
    }
  };
  return scene;
}
