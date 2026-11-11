// Escenario 5 · Interior del Supermercado (naranjas y verdes), donde ocurre la misión 3:
// «Rescate de inventario». Sigue el mismo patrón que el Banco y el Tribunal.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { NPC_LOOKS } from '../characters/catalog.js';
import { mat, box, cyl, sph, plane, slab, sign, checkerTexture, sunLight, mergeStatic } from './kit.js';

export function buildMarket(api) {
  const g = new THREE.Group();
  const W = 18, D = 14, H = 5.0;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const orange = mat(0xf08a24, { r: 0.6 }), rust = mat(0xb8452a, { r: 0.6 });
  const green = mat(0x3f9a4d, { r: 0.6 }), steel = mat(0xb8c0cc, { m: 0.6, r: 0.35 });
  const wood = mat(0x8a5a36, { r: 0.6 }), woodLight = mat(0xc98f56, { r: 0.6 });

  /* estructura */
  const floor = plane(W, D, mat(0xffffff, { map: checkerTexture(9, 7, '#f7fbf4', '#e2efdd'), r: 0.4, m: 0.05 }), 0, 0, 0, g, { rx: -Math.PI / 2 });
  floor.receiveShadow = true;
  const wall = mat(0xfff3e2, { r: 0.95 }), wall2 = mat(0xfcecd2, { r: 0.95 });
  plane(W, H, wall, 0, H / 2, -D / 2, g);
  plane(W, H, wall, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, wall2, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 });
  plane(D, H, wall2, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  // franja naranja decorativa en los muros
  for (const [w, x, z, ry] of [[W, 0, -D / 2 + 0.02, 0], [D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, -Math.PI / 2]]) {
    plane(w, 0.5, orange, x, 3.6, z, g, { ry, cast: false });
  }

  /* entrada (muro sur, planos de una cara como en el banco) */
  const south = (w, hh, material, x, y, dz) => plane(w, hh, material, x, y, D / 2 - dz, g, { ry: Math.PI });
  south(3.0, 3.4, rust, 0, 1.7, 0.02);
  for (const s of [-1, 1]) {
    south(1.22, 3.1, mat(0x2a1d14, { r: 0.4 }), s * 0.65, 1.55, 0.03);
    south(0.8, 1.5, mat(0xbfe3ff, { r: 0.1, m: 0.6, e: 0x4a7fb0, ei: 0.3 }), s * 0.65, 2.0, 0.04);
  }
  const exitSign = sign('SALIDA', 1.2, 0.34, { bg: '#1f7a55', fg: '#ffffff' }); exitSign.position.set(0, 3.7, D / 2 - 0.06); exitSign.rotation.y = Math.PI; g.add(exitSign);
  const welcome = sign('SUPERMERCADO', 2.6, 0.5, { bg: '#b8452a', fg: '#fff0d6' }); welcome.position.set(0, 4.3, -D / 2 + 0.06); g.add(welcome);

  /* caja de cobro (oriente, cerca de la entrada) */
  const cjx = 5.4, cjz = 4.0;
  box(2.6, 0.95, 1.0, woodLight, cjx, 0, cjz, g); box(2.8, 0.07, 1.2, rust, cjx, 0.95, cjz, g);
  box(0.5, 0.35, 0.35, steel, cjx - 0.7, 1.02, cjz, g);                                 // caja registradora
  plane(0.44, 0.3, new THREE.MeshBasicMaterial({ color: 0x1b6f3e, toneMapped: false }), cjx - 0.7, 1.45, cjz - 0.01, g);
  const cajaSign = sign('CAJA 1', 1.1, 0.3, { bg: '#1f7a55', fg: '#ffffff' }); cajaSign.position.set(cjx, 2.6, cjz); g.add(cajaSign);
  col.addBoxAt(cjx, cjz, 2.8, 1.2);

  /* terminal de inventario (junto a la caja) */
  const tx2 = 7.7, tz2 = 1.8;
  box(1.1, 0.06, 0.6, woodLight, tx2, 1.0, tz2, g); box(0.08, 1.0, 0.5, rust, tx2 - 0.45, 0, tz2, g); box(0.08, 1.0, 0.5, rust, tx2 + 0.45, 0, tz2, g);
  const termMon = box(0.8, 0.5, 0.05, mat(0x10182b, { r: 0.35 }), tx2, 1.3, tz2 - 0.08, g, { rx: -0.1 });
  const termScreen = plane(0.72, 0.42, new THREE.MeshBasicMaterial({ color: 0x1b6fb8, toneMapped: false }), tx2, 1.55, tz2 - 0.045, g, { rx: -0.1 });
  const termSign = sign('INVENTARIO', 1.2, 0.26, { bg: '#12325f', fg: '#ffd166' }); termSign.position.set(tx2, 0.6, tz2 - 0.26); termSign.rotation.y = Math.PI; g.add(termSign);
  col.addBoxAt(tx2, tz2, 1.2, 0.7);

  /* oficina del gerente (poniente, cerca de la entrada): computadora con el inventario */
  const ox = -7.0, oz = 4.3;
  box(1.8, 0.07, 0.9, woodLight, ox, 0.78, oz, g); box(1.7, 0.78, 0.8, wood, ox, 0, oz, g);
  const offMon = box(0.7, 0.45, 0.05, mat(0x10182b, { r: 0.35 }), ox, 1.1, oz + 0.1, g, { ry: Math.PI, rx: 0.1 });
  const offScreen = plane(0.62, 0.38, new THREE.MeshBasicMaterial({ color: 0x24507a, toneMapped: false }), ox, 1.1, oz + 0.14, g, { ry: Math.PI, rx: 0.1 });
  const offSign = sign('OFICINA', 1.2, 0.3, { bg: '#b8452a', fg: '#fff0d6' }); offSign.position.set(ox, 2.5, oz + 0.4); offSign.rotation.y = Math.PI; g.add(offSign);
  col.addBoxAt(ox, oz, 1.9, 1.0);

  /* refrigerador de lácteos (muro norte, poniente) */
  const fx = -5.0, fz = -6.1;
  box(4.2, 2.9, 1.1, steel, fx, 0, fz, g);
  const fridgeGlow = plane(3.7, 2.1, new THREE.MeshBasicMaterial({ color: 0xcfeaff, toneMapped: false, transparent: true, opacity: 0.85 }), fx, 1.55, fz + 0.56, g);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) box(0.3, 0.44, 0.3, mat([0xffffff, 0xfff1c9, 0xdfe9ff][i % 3], { r: 0.8, own: false }), fx - 1.5 + i * 0.6, 0.6 + r * 0.9, fz + 0.3, g, { cast: false });
  const fridgeSign = sign('LÁCTEOS', 1.6, 0.36, { bg: '#1b6fb8', fg: '#ffffff' }); fridgeSign.position.set(fx, 3.25, fz + 0.58); g.add(fridgeSign);
  col.addBoxAt(fx, fz, 4.4, 1.3);

  /* góndola central de abarrotes (dos frentes) */
  const gx = 0.4, gz = -1.6;
  box(5.2, 2.1, 1.3, mat(0xe8edf6, { r: 0.8 }), gx, 0, gz, g);
  for (const sgn of [-1, 1]) for (let r = 0; r < 3; r++) {
    box(5.0, 0.05, 0.12, steel, gx, 0.55 + r * 0.62, gz + sgn * 0.68, g, { cast: false });
    for (let i = 0; i < 8; i++) box(0.34, 0.4, 0.2, mat([0xf2b93b, 0xc23b36, 0x3a5fc4, 0x1f7a6c][((r + i) % 4)], { r: 0.85 }), gx - 2.25 + i * 0.64, 0.6 + r * 0.62, gz + sgn * 0.62, g, { cast: false });
  }
  const gondolaSign = sign('ABARROTES', 1.8, 0.36, { bg: '#f08a24', fg: '#2a1d14' }); gondolaSign.position.set(gx, 2.5, gz); g.add(gondolaSign);
  col.addBoxAt(gx, gz, 5.4, 1.5);

  /* mesa de frutas y verduras (poniente) */
  const frx = -6.8, frz = -1.4;
  box(2.4, 0.8, 1.6, wood, frx, 0, frz, g); box(2.6, 0.07, 1.8, green, frx, 0.8, frz, g);
  for (let i = 0; i < 10; i++) sph(0.14, mat([0xe4572e, 0xf2b93b, 0x58b565, 0xc23b36][i % 4], { r: 0.7 }), frx - 0.9 + (i % 5) * 0.45, 0.98, frz - 0.35 + Math.floor(i / 5) * 0.7, g, { seg: 10, rings: 8 });
  const frutaSign = sign('FRUTAS Y VERDURAS', 2.2, 0.34, { bg: '#2f7d3c', fg: '#ffffff' }); frutaSign.position.set(frx, 2.3, frz); g.add(frutaSign);
  col.addBoxAt(frx, frz, 2.7, 1.9);

  /* mesa de revisión (oriente): los cinco productos apartados */
  const rx = 5.2, rz = -3.4;
  cyl(1.0, 1.0, 0.07, woodLight, rx, 0.82, rz, g, { seg: 28 }); cyl(0.1, 0.13, 0.82, rust, rx, 0, rz, g, { seg: 12 });
  const items = [];
  for (let i = 0; i < 5; i++) {
    const a = i * (Math.PI * 2 / 5);
    const item = box(0.22, 0.3, 0.22, mat([0xffffff, 0x9fb0c8, 0xd9a84a, 0xfff1c9, 0xe8edf6][i], { r: 0.8, own: true }), rx + Math.cos(a) * 0.55, 0.9, rz + Math.sin(a) * 0.55, g, { cast: false });
    items.push(item);
  }
  const revSign = sign('REVISIÓN', 1.3, 0.3, { bg: '#8f2630', fg: '#ffffff' }); revSign.position.set(rx, 2.1, rz); g.add(revSign);
  col.addCircle(rx, rz, 1.05);

  /* luces */
  for (const [x, z] of [[-4.5, 1], [4.5, 1], [0, -4]]) {
    cyl(0.02, 0.02, 0.7, rust, x, H - 0.7, z, g, { seg: 6, cast: false });
    cyl(0.5, 0.26, 0.3, mat(0xfff7e2, { e: 0xffe9b8, ei: 1.3, r: 0.5 }), x, H - 1.0, z, g, { seg: 18, cast: false });
    const pl = new THREE.PointLight(0xfff0cf, 8, 11, 1.7); pl.position.set(x, H - 1.3, z); g.add(pl);
  }
  g.add(new THREE.HemisphereLight(0xfff6e2, 0xc9a06a, 1.0));
  const sun = sunLight(g, { x: -2, y: 12, z: 9, intensity: 1.4, color: 0xfff1d0, area: 13 }); sun.target.position.set(0, 0, 0);

  /* personajes */
  const ramiro = new Npc({ look: NPC_LOOKS.ernesto, x: -3.4, z: 2.6, yaw: Math.PI * 0.85 });
  const empleada = new Npc({ look: NPC_LOOKS.marta, x: -5.4, z: -3.4, yaw: -0.5 });
  const cajera = new Npc({ look: NPC_LOOKS.cajera, x: cjx, z: cjz - 1.4, yaw: Math.PI });
  [ramiro, empleada, cajera].forEach(n => g.add(n.group));
  col.addCircle(-3.4, 2.6, 0.4); col.addCircle(-5.4, -3.4, 0.4); col.addCircle(cjx, cjz - 1.4, 0.4);

  mergeStatic(g);
  const m = api.missions.market;
  const interactables = [
    { id: 'exit', x: 0, y: 2.2, z: D / 2 - 0.5, radius: 1.5, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'market') },
    { id: 'ramiro', x: -3.4, y: 2.05, z: 2.6, radius: 2.2, color: 0xffc93c, label: () => m.labelFor('manager'), highlight: () => m.wants('manager'), action: () => m.talkToManager(ramiro) },
    { id: 'ledger', x: ox, y: 2.0, z: oz - 0.7, radius: 2.0, color: 0x4cc9f0, label: () => m.labelFor('ledger'), highlight: () => m.wants('ledger'), action: () => m.openLedger() },
    { id: 'fridge', x: fx, y: 2.1, z: fz + 1.4, radius: 2.4, color: 0xffc93c, label: () => m.labelFor('fridge'), highlight: () => m.wants('fridge'), action: () => m.openFridge(true) },
    { id: 'count-abarrotes', x: gx, y: 2.0, z: gz + 1.6, radius: 2.4, color: 0xffc93c, label: () => m.labelFor('count', 'abarrotes'), highlight: () => m.wants('count', 'abarrotes'), action: () => m.countShelf('abarrotes') },
    { id: 'count-frutas', x: frx, y: 2.0, z: frz + 1.3, radius: 2.2, color: 0xffc93c, label: () => m.labelFor('count', 'frutas'), highlight: () => m.wants('count', 'frutas'), action: () => m.countShelf('frutas') },
    { id: 'review', x: rx, y: 1.9, z: rz, radius: 2.1, color: 0xff8f7a, label: () => m.labelFor('review'), highlight: () => m.wants('review'), action: () => m.openReview() },
    { id: 'terminal', x: tx2, y: 2.1, z: tz2 + 0.7, radius: 1.9, color: 0x4cc9f0, label: () => m.labelFor('adjust'), highlight: () => m.wants('adjust'), action: () => m.openTerminal() },
    { id: 'empleada', x: -5.4, y: 2.0, z: -3.4, radius: 1.8, color: 0x9fd3ff, label: 'Hablar con la empleada', action: () => api.ui.dialog({ speaker: 'Empleada', lines: ['Yo aparté en la mesa de revisión lo que me dio mala espina.', 'Las fechas no mienten: fíjate bien antes de decidir qué se retira.'] }) },
    { id: 'cajera2', x: cjx, y: 2.0, z: cjz - 1.4, radius: 1.8, color: 0x9fd3ff, label: 'Hablar con la cajera', action: () => api.ui.dialog({ speaker: 'Cajera', lines: ['La terminal de inventario está aquí a un lado.', 'Lo que registres ahí es lo que verá la auditoría: que quede igualito al estante.'] }) }
  ];

  return {
    name: 'market', title: 'Supermercado', group: g, collision: col, interactables, npcs: [ramiro, empleada, cajera],
    background: 0x2a1708, fog: null,
    spawns: { default: { x: 0, z: 3.9, yaw: Math.PI } },
    camera: { distance: 6.2, minDistance: 2.4, maxDistance: 8.5, pitch: 0.46, yaw: 0, box: { minX: -11.5, maxX: 11.5, minZ: -8.5, maxZ: 10.2, maxY: 7.0 } },
    update(dt, t) {
      const wantsFridge = m.wants('fridge');
      fridgeGlow.material.opacity = wantsFridge ? 0.7 + Math.sin(t * 3) * 0.25 : 0.85;
      termScreen.material.color.setHex(m.wants('adjust') ? 0x1f8fe0 : 0x1b4f86);
      offScreen.material.color.setHex(m.wants('ledger') ? 0x2f7dc9 : 0x24507a);
      const lift = m.wants('review') ? Math.abs(Math.sin(t * 3)) * 0.05 : 0;
      items.forEach((it, i) => { it.position.y = 0.9 + (m.wants('review') ? Math.abs(Math.sin(t * 3 + i)) * 0.05 : 0); });
      void lift; void termMon; void offMon;
    }
  };
}
