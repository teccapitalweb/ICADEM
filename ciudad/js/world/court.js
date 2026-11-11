// Escenario 4 · Tribunal ICADEM: sala de audiencias (maderas, azul y dorado) de la misión 9.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { NPC_LOOKS } from '../characters/catalog.js';
import { mat, box, cyl, sph, plane, slab, sign, plankTexture, sunLight, mergeStatic } from './kit.js';

export function buildCourt(api) {
  const g = new THREE.Group();
  const W = 20, D = 16, H = 6.2;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const wood = mat(0x7a4a2b, { r: 0.55 }), woodDark = mat(0x5a3520, { r: 0.6 }), woodLight = mat(0xb9824f, { r: 0.55 });
  const navy = mat(0x12325f, { r: 0.6 }), gold = mat(0xffd166, { m: 0.75, r: 0.28 }), goldDark = mat(0xc9952a, { m: 0.6, r: 0.35 });
  const cream = mat(0xf4ead8, { r: 0.95 }), white = mat(0xffffff, { r: 0.6 }), leather = mat(0x1e3f2f, { r: 0.5 });

  /* estructura */
  const floor = plane(W, D, mat(0xffffff, { map: plankTexture(7, 5, '#b98557', '#9a6a40'), r: 0.5 }), 0, 0, 0, g, { rx: -Math.PI / 2 }); floor.receiveShadow = true;
  plane(W, H, cream, 0, H / 2, -D / 2, g);
  plane(W, H, cream, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, cream, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 });
  plane(D, H, cream, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  // lambrín de madera y cornisa
  for (const [w, d, x, z] of [[W, 0.1, 0, -D / 2 + 0.05], [0.1, D, -W / 2 + 0.05, 0], [0.1, D, W / 2 - 0.05, 0]]) {
    box(w, 1.5, d, wood, x, 0, z, g, { cast: false }); box(w, 0.1, d * 1.6, goldDark, x, 1.5, z, g, { cast: false }); box(w, 0.2, d * 1.8, woodDark, x, H - 0.55, z, g, { cast: false });
  }
  // ventanales luminosos en los muros laterales
  const glow = new THREE.MeshBasicMaterial({ color: 0xdff1ff, toneMapped: false });
  for (const s of [-1, 1]) for (const z of [-4.2, 0, 4.2]) {
    plane(1.7, 2.9, glow, s * (W / 2 - 0.02), 3.55, z, g, { ry: -s * Math.PI / 2 });
    box(0.12, 3.1, 0.12, woodDark, s * (W / 2 - 0.08), 2.0, z - 0.95, g, { cast: false }); box(0.12, 3.1, 0.12, woodDark, s * (W / 2 - 0.08), 2.0, z + 0.95, g, { cast: false });
    box(0.12, 0.12, 2.0, woodDark, s * (W / 2 - 0.08), 5.0, z, g, { cast: false }); box(0.1, 0.06, 1.9, woodDark, s * (W / 2 - 0.08), 3.5, z, g, { cast: false });
  }
  // columnas en las esquinas
  for (const [x, z] of [[-9.2, 7.2], [9.2, 7.2], [-9.2, -7.2], [9.2, -7.2]]) { cyl(0.5, 0.5, 0.3, white, x, 0, z, g, { seg: 16 }); cyl(0.34, 0.38, H - 0.9, white, x, 0.3, z, g, { seg: 16 }); cyl(0.5, 0.38, 0.35, gold, x, H - 0.65, z, g, { seg: 16 }); col.addCircle(x, z, 0.52); }
  // alfombra del pasillo y de la zona de litigio
  plane(2.2, 10.6, mat(0x8f2630, { r: 0.95 }), 0, 0.012, 2.6, g, { rx: -Math.PI / 2, cast: false });
  plane(2.5, 10.9, mat(0xc9952a, { r: 0.9 }), 0, 0.008, 2.6, g, { rx: -Math.PI / 2, cast: false });
  plane(11, 3.2, mat(0x1b3f73, { r: 0.95 }), 0, 0.01, -2.6, g, { rx: -Math.PI / 2, cast: false });

  /* estrado del juez */
  box(13, 0.4, 3.4, woodDark, 0, 0, -6.2, g); box(13.2, 0.06, 3.6, goldDark, 0, 0.4, -6.2, g, { cast: false });
  box(5.4, 1.2, 0.9, wood, 0, 0.4, -5.3, g); box(5.7, 0.08, 1.1, woodLight, 0, 1.6, -5.3, g);
  box(4.6, 0.7, 0.05, woodDark, 0, 0.65, -4.83, g, { cast: false });
  const plate = sign('JUEZ', 1.3, 0.34, { bg: '#12325f', fg: '#ffd166' }); plate.position.set(0, 1.0, -4.79); g.add(plate);
  slab(1.0, 0.9, 0.12, 0.1, leather, 0, 0.85, -6.5, g); slab(1.0, 0.14, 1.7, 0.1, leather, 0, 0.9, -7.0, g); box(1.1, 0.08, 0.16, goldDark, 0, 2.6, -7.0, g, { cast: false });
  // mazo (se anima al dictar la resolución), libros y lámpara de escritorio
  const gavel = new THREE.Group(); gavel.userData.dynamic = true; gavel.position.set(1.15, 1.66, -5.25);
  cyl(0.07, 0.07, 0.22, woodDark, 0, 0.2, 0, gavel, { seg: 10 }).rotation.z = Math.PI / 2; cyl(0.02, 0.02, 0.36, woodLight, 0, 0, 0, gavel, { seg: 8 });
  g.add(gavel); cyl(0.13, 0.15, 0.04, woodDark, 1.15, 1.64, -5.0, g, { seg: 14 });
  box(0.34, 0.07, 0.24, mat(0x8f2630), -1.5, 1.64, -5.3, g); box(0.32, 0.07, 0.22, navy, -1.5, 1.71, -5.3, g); box(0.5, 0.012, 0.36, white, 0, 1.645, -5.25, g, { cast: false });
  col.addBoxAt(0, -6.2, 13, 3.4);
  // emblema: balanza dorada, letrero y estandartes
  const em = new THREE.Group(); em.position.set(0, 4.25, -7.9); g.add(em);
  cyl(1.05, 1.05, 0.08, navy, 0, 0, 0, em, { seg: 36, cast: false }).rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 40), gold); em.add(rim);
  box(0.06, 1.15, 0.06, gold, 0, -0.62, 0.08, em, { cast: false }); box(1.3, 0.06, 0.06, gold, 0, 0.42, 0.08, em, { cast: false }); box(0.5, 0.06, 0.1, gold, 0, -0.66, 0.08, em, { cast: false });
  for (const s of [-1, 1]) { box(0.02, 0.42, 0.02, gold, s * 0.6, -0.02, 0.08, em, { cast: false }); cyl(0.26, 0.16, 0.09, gold, s * 0.6, -0.1, 0.08, em, { seg: 16, cast: false }); }
  const title = sign('TRIBUNAL ICADEM', 4.6, 0.5, { bg: 'rgba(0,0,0,0)', fg: '#5a3520', radius: 0 }); title.position.set(0, 2.72, -7.93); g.add(title);
  for (const s of [-1, 1]) { box(0.06, 3.0, 0.06, goldDark, s * 3.6, 1.6, -7.8, g, { cast: false }); box(0.9, 2.2, 0.04, navy, s * 3.6, 2.2, -7.74, g, { cast: false }); box(0.9, 0.22, 0.05, gold, s * 3.6, 2.5, -7.73, g, { cast: false }); box(0.3, 0.3, 0.05, gold, s * 3.6, 3.3, -7.73, g, { cast: false }); }

  /* estrado de testigos (poniente) */
  const wx = -5.6, wz = -3.3;
  box(2.0, 0.2, 1.8, woodDark, wx, 0, wz, g); box(2.0, 0.95, 0.1, wood, wx, 0.2, wz + 0.85, g); box(0.1, 0.95, 1.8, wood, wx - 0.95, 0.2, wz, g); box(0.1, 0.95, 1.8, wood, wx + 0.95, 0.2, wz, g);
  box(2.1, 0.07, 0.2, woodLight, wx, 1.15, wz + 0.85, g, { cast: false });
  slab(0.6, 0.6, 0.1, 0.1, leather, wx, 0.62, wz - 0.2, g); slab(0.6, 0.1, 0.8, 0.05, leather, wx, 0.7, wz - 0.52, g);
  const wsign = sign('TESTIGO', 1.4, 0.3, { bg: '#12325f', fg: '#ffd166' }); wsign.position.set(wx, 0.7, wz + 0.91); g.add(wsign);
  cyl(0.02, 0.02, 0.3, mat(0x263248, { m: 0.4 }), wx + 0.5, 1.18, wz + 0.85, g, { seg: 6, cast: false }); sph(0.05, mat(0x263248, { m: 0.4 }), wx + 0.5, 1.5, wz + 0.85, g, { seg: 8, rings: 6 });
  col.addBoxAt(wx, wz, 2.1, 1.9);

  /* secretaría (oriente): escritorio con expedientes */
  const cx = 5.6, cz = -3.3;
  box(2.4, 0.07, 1.1, woodLight, cx, 0.8, cz, g); box(2.3, 0.8, 1.0, wood, cx, 0, cz, g);
  const colors = [0xe86a5c, 0x2f9e8f, 0xf2b93b, 0x3a5fc4, 0x8f2630];
  for (let i = 0; i < 5; i++) box(0.36, 0.05, 0.5, mat(colors[i], { r: 0.8 }), cx + 0.75, 0.88 + i * 0.052, cz + 0.05, g, { ry: (i % 2 ? 0.12 : -0.08), cast: false });
  const folder = box(0.4, 0.04, 0.54, mat(0xffd166, { r: 0.7, e: 0x5a4010, ei: 0.2, own: true }), cx - 0.15, 0.89, cz + 0.18, g, { ry: 0.15, cast: false });
  box(0.5, 0.34, 0.04, mat(0x10182b, { r: 0.35 }), cx - 0.75, 0.98, cz - 0.2, g, { ry: 0.4 }); cyl(0.03, 0.03, 0.12, mat(0x263248), cx - 0.75, 0.87, cz - 0.2, g, { seg: 8 });
  const csign = sign('SECRETARÍA', 1.9, 0.3, { bg: '#12325f', fg: '#ffd166' }); csign.position.set(cx, 0.45, cz + 0.52); g.add(csign);
  col.addBoxAt(cx, cz - 0.4, 2.5, 2.0);

  /* mesa de pruebas (al centro, frente al estrado) */
  const ex = 0, ez = -2.9;
  box(2.6, 0.07, 1.0, woodLight, ex, 0.84, ez, g); for (const [dx, dz] of [[-1.15, -0.38], [1.15, -0.38], [-1.15, 0.38], [1.15, 0.38]]) box(0.09, 0.84, 0.09, woodDark, ex + dx, 0, ez + dz, g);
  const items = [
    box(0.32, 0.014, 0.44, mat(0xffffff, { r: 0.9, own: true }), ex - 0.95, 0.915, ez, g, { ry: 0.12, cast: false }),
    box(0.32, 0.014, 0.44, mat(0xeaf4ff, { r: 0.9, own: true }), ex - 0.48, 0.915, ez + 0.04, g, { ry: -0.1, cast: false }),
    box(0.32, 0.014, 0.44, mat(0xfff3c4, { r: 0.9, own: true }), ex, 0.915, ez - 0.02, g, { ry: 0.06, cast: false }),
    box(0.16, 0.02, 0.3, mat(0x16213a, { r: 0.3, e: 0x4cc9f0, ei: 0.5, own: true }), ex + 0.45, 0.915, ez + 0.02, g, { ry: -0.25, cast: false }),
    box(0.3, 0.012, 0.22, mat(0x9fb0c8, { r: 0.6, own: true }), ex + 0.92, 0.915, ez, g, { ry: 0.2, cast: false })
  ];
  box(0.26, 0.012, 0.18, mat(0xc98f56, { r: 0.7 }), ex + 0.98, 0.928, ez + 0.06, g, { ry: -0.15, cast: false });
  const esign = sign('PRUEBAS', 1.3, 0.26, { bg: '#8f2630', fg: '#ffffff' }); esign.position.set(ex, 0.62, ez + 0.51); g.add(esign);
  col.addBoxAt(ex, ez, 2.7, 1.1);

  /* mesas de las partes */
  const tableZ = 0.9, seats = {};
  for (const [side, tx, text] of [['actora', -3.9, 'PARTE ACTORA'], ['demandada', 3.9, 'PARTE DEMANDADA']]) {
    box(3.2, 0.07, 1.0, woodLight, tx, 0.8, tableZ, g); box(3.0, 0.8, 0.08, wood, tx, 0, tableZ - 0.42, g); for (const dx of [-1.45, 1.45]) box(0.08, 0.8, 0.9, wood, tx + dx, 0, tableZ, g);
    const sg = sign(text, 2.4, 0.3, { bg: '#12325f', fg: '#ffffff' }); sg.position.set(tx, 0.45, tableZ - 0.47); sg.rotation.y = Math.PI; g.add(sg);
    box(0.34, 0.03, 0.26, mat(0x8f2630), tx - 0.4, 0.87, tableZ, g, { ry: 0.2, cast: false }); box(0.3, 0.012, 0.4, white, tx + 0.5, 0.875, tableZ, g, { ry: -0.15, cast: false });
    for (const dx of [-0.75, 0.75]) { slab(0.56, 0.56, 0.1, 0.1, navy, tx + dx, 0.42, tableZ + 0.95, g); slab(0.56, 0.1, 0.7, 0.05, navy, tx + dx, 0.5, tableZ + 1.25, g); }
    col.addBoxAt(tx, tableZ + 0.45, 3.3, 2.0);
    seats[side] = [{ x: tx - 0.75, z: tableZ + 0.95 }, { x: tx + 0.75, z: tableZ + 0.95 }];
  }

  /* barandilla y bancas del público */
  for (const s of [-1, 1]) {
    box(8.3, 0.08, 0.14, woodLight, s * 5.35, 0.98, 3.5, g); box(8.3, 0.08, 0.1, woodDark, s * 5.35, 0.12, 3.5, g, { cast: false });
    for (let i = 0; i < 9; i++) box(0.09, 0.98, 0.09, wood, s * (1.25 + i * 1.02), 0, 3.5, g);
    cyl(0.1, 0.1, 1.1, woodDark, s * 1.2, 0, 3.5, g, { seg: 10 }); sph(0.12, gold, s * 1.2, 1.15, 3.5, g, { seg: 10, rings: 8 });
    col.addBoxAt(s * 5.35, 3.5, 8.4, 0.3);
    for (const z of [4.9, 6.3]) {
      box(6.2, 0.1, 0.6, wood, s * 5.1, 0.45, z, g); box(6.2, 0.6, 0.1, wood, s * 5.1, 0.5, z + 0.3, g); for (const dx of [-3, 0, 3]) box(0.1, 0.45, 0.55, woodDark, s * 5.1 + dx, 0, z, g);
      col.addBoxAt(s * 5.1, z + 0.05, 6.3, 0.8);
    }
  }
  // tablero de la sala cooperativa (junto a la entrada)
  const kx = 8.2, kz = 7.3;
  box(1.9, 1.3, 0.1, mat(0x16213a, { r: 0.4 }), kx, 1.2, kz + 0.5, g); box(2.0, 0.08, 0.14, goldDark, kx, 2.5, kz + 0.5, g, { cast: false });
  const coopFace = plane(1.7, 1.1, new THREE.MeshBasicMaterial({ color: 0x1b447d, toneMapped: false }), kx, 1.85, kz + 0.44, g, { ry: Math.PI });
  const coopSign = sign('AUDIENCIA EN EQUIPO', 1.6, 0.26, { bg: 'rgba(0,0,0,0)', fg: '#ffd166', radius: 0 }); coopSign.position.set(kx, 2.1, kz + 0.43); coopSign.rotation.y = Math.PI; g.add(coopSign);
  const coopSub = sign('Sala de espera', 1.2, 0.2, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', radius: 0 }); coopSub.position.set(kx, 1.7, kz + 0.43); coopSub.rotation.y = Math.PI; g.add(coopSub);
  // puerta de salida
  // (planos de una cara: la cámara puede quedar detrás del muro sur sin que la puerta estorbe)
  plane(2.6, 3.2, woodDark, 0, 1.6, D / 2 - 0.02, g, { ry: Math.PI, cast: false });
  for (const s of [-1, 1]) { plane(1.15, 2.9, wood, s * 0.62, 1.55, D / 2 - 0.04, g, { ry: Math.PI, cast: false }); sph(0.07, gold, s * 0.12, 1.4, D / 2 - 0.1, g, { seg: 8, rings: 6 }); }
  const exitSign = sign('SALIDA', 1.2, 0.28, { bg: '#2f9e8f', fg: '#ffffff' }); exitSign.position.set(0, 3.5, D / 2 - 0.12); exitSign.rotation.y = Math.PI; g.add(exitSign);

  /* luces: candiles y luz de ventanales */
  for (const [x, z] of [[-4.5, 2.5], [4.5, 2.5], [0, -3.2]]) {
    cyl(0.02, 0.02, 0.9, goldDark, x, H - 0.9, z, g, { seg: 6, cast: false });
    cyl(0.55, 0.3, 0.3, mat(0xfff3c4, { e: 0xffd98a, ei: 1.5, r: 0.5 }), x, H - 1.2, z, g, { seg: 18, cast: false });
    const pl = new THREE.PointLight(0xffe2a8, 10, 12, 1.7); pl.position.set(x, H - 1.5, z); g.add(pl);
  }
  g.add(new THREE.HemisphereLight(0xfff6e6, 0x8a6a48, 1.05));
  const sun = sunLight(g, { x: 6, y: 13, z: 8, intensity: 1.4, color: 0xfff1d8, area: 14 }); sun.target.position.set(0, 0, 0);

  /* personajes (NPC del caso: no son jugadores) */
  const seated = (look, x, z, yaw, seatY = 0.22) => new Npc({ look, x, z, yaw, sitting: true, seatY });
  const cast = {
    clerk: seated(NPC_LOOKS.secretaria, cx, cz - 0.95, 0, 0.25),
    mena: seated(NPC_LOOKS.mena, seats.actora[1].x, seats.actora[1].z, Math.PI), marta: seated(NPC_LOOKS.marta, seats.actora[0].x, seats.actora[0].z, Math.PI),
    barrera: seated(NPC_LOOKS.barrera, seats.demandada[0].x, seats.demandada[0].z, Math.PI), ernesto: seated(NPC_LOOKS.ernesto, seats.demandada[1].x, seats.demandada[1].z, Math.PI),
    ruben: seated(NPC_LOOKS.ruben, -3.4, 4.9, Math.PI, 0.3), sofia: seated(NPC_LOOKS.sofia, 3.4, 4.9, Math.PI, 0.3),
    publicoA: seated(NPC_LOOKS.vecino, -6.6, 6.3, Math.PI, 0.3), publicoB: seated(NPC_LOOKS.vecina, 6.2, 6.3, Math.PI, 0.3),
    guard: new Npc({ look: NPC_LOOKS.guardia, x: -2.6, z: 7.0, yaw: Math.PI })
  };
  Object.values(cast).forEach(n => g.add(n.group));
  col.addCircle(-2.6, 7.0, 0.4);
  const home = { ruben: { x: -3.4, z: 4.9, y: 0.3, yaw: Math.PI }, sofia: { x: 3.4, z: 4.9, y: 0.3, yaw: Math.PI } };
  const stand = { x: wx, z: wz - 0.2, y: 0.42, yaw: 0.55 };
  const put = (npc, s) => { npc.group.position.set(s.x, s.y, s.z); npc.baseYaw = npc.yaw = s.yaw; npc.group.rotation.y = s.yaw; };

  mergeStatic(g);
  const m = api.missions.court;
  const benchSpot = { x: 0, z: -6.45, yaw: 0, seatY: 0.62 }, floorSpot = { x: 3.4, z: -3.9 };
  const tmp = new THREE.Vector3();
  const court = {
    cast, seat: benchSpot, floorSpot,
    /** Encuadra la cámara en quien habla. */
    focus(name) {
      const n = cast[name]; if (!n) return;
      const p = n.group.position, fx = Math.sin(n.yaw), fz = Math.cos(n.yaw);
      api.camera.frame(tmp.set(p.x + fx * 3.0 + fz * 0.9, 1.75, p.z + fz * 3.0 - fx * 0.9).clone(), new THREE.Vector3(p.x, 1.2 + (p.y || 0) * 0.6, p.z), 900);
    },
    /** Vista desde el estrado: el juez de espaldas y toda la sala. */
    benchView() { api.camera.frame(new THREE.Vector3(1.6, 3.5, -7.5), new THREE.Vector3(0, 1.0, 0.6), 900); },
    async callWitness(id) { await api.ui.fade(true); put(cast[id], stand); await api.ui.fade(false); },
    async dismissWitness(id) { await api.ui.fade(true); put(cast[id], home[id]); await api.ui.fade(false); },
    speaking(name, on) { if (cast[name]) cast[name].talking = on; },
    gavel() { gavelT = 0.9; }
  };
  let gavelT = 0;

  const interactables = [
    { id: 'exit', x: 0, y: 2.3, z: D / 2 - 0.6, radius: 1.6, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'court') },
    { id: 'clerk', x: cx, y: 2.0, z: cz + 1.0, radius: 2.0, color: 0xffc93c, label: () => m.labelFor('clerk'), highlight: () => m.wants('clerk'), action: () => m.talkToClerk(court) },
    { id: 'evidence', x: ex, y: 1.6, z: ez + 0.95, radius: 1.9, color: 0xffc93c, label: () => m.labelFor('evidence'), highlight: () => m.wants('evidence'), action: () => m.openEvidence() },
    { id: 'bench', x: floorSpot.x, y: 2.2, z: floorSpot.z, radius: 1.9, color: 0xffc93c, label: () => m.labelFor('bench'), highlight: () => m.wants('bench'), action: () => m.takeBench(court) },
    { id: 'coop', x: kx, y: 2.9, z: kz - 0.5, radius: 1.8, color: 0x4cc9f0, label: 'Audiencia en equipo · sala de espera', action: () => api.social.openLobby() },
    { id: 'guard', x: -2.6, y: 2.05, z: 7.0, radius: 1.6, color: 0x9fd3ff, label: 'Hablar con el oficial', action: () => api.ui.dialog({ speaker: 'Oficial de sala', lines: ['Bienvenido al Tribunal ICADEM. Hoy usted preside la audiencia.', 'Pida el expediente en la secretaría, revise las pruebas de la mesa central y suba al estrado cuando esté listo.'] }) }
  ];

  return {
    name: 'court', title: 'Tribunal ICADEM', group: g, collision: col, interactables, npcs: Object.values(cast), court,
    background: 0x2a1c12, fog: null,
    spawns: { default: { x: 0, z: 5.6, yaw: Math.PI } },
    camera: { distance: 6.4, minDistance: 2.4, maxDistance: 9, pitch: 0.46, yaw: 0, box: { minX: -12.5, maxX: 12.5, minZ: -9.6, maxZ: 11.2, maxY: 8.2 } },
    update(dt, t) {
      folder.position.y = 0.89 + (m.wants('clerk') ? Math.abs(Math.sin(t * 3)) * 0.05 : 0);
      const ev = m.wants('evidence'); items.forEach((it, i) => { it.position.y = 0.915 + (ev ? Math.abs(Math.sin(t * 3 + i * 0.7)) * 0.035 : 0); });
      coopFace.material.color.setHex(api.net.isOnline ? 0x1f7a55 : 0x1b447d);
      if (gavelT > 0) { gavelT -= dt; gavel.rotation.x = -Math.abs(Math.sin(gavelT * 11)) * 0.9; } else gavel.rotation.x = 0;
    }
  };
}
