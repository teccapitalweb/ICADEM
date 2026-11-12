// Escenario 9 · Cocina del Restaurante (acero, rojo y crema), misión 7: «Cocina contra reloj».
// Lavamanos, refrigeradores con termómetro, almacén, mesa con tablas de colores, parrilla y plancha,
// estación fría de alérgenos y pase con el riel de comandas. Lo que el jugador prepara y cocina
// aparece en la mesa y en el fuego.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { BOARDS, INGREDIENTS, ORDERS } from '../missions/kitchen-rush-logic.js';
import { mat, box, cyl, sph, plane, sign, checkerTexture, sunLight, mergeStatic } from './kit.js';

const FOOD = { pollo: 0xf1d2a8, pescado: 0xe8eef5, lechuga: 0x7fcf5a, col: 0x8e44ad, verduras: 0xf28c28 };

export function buildRestaurant(api) {
  const g = new THREE.Group();
  const W = 18, D = 14, H = 4.4;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const steel = mat(0xc4ccd6, { m: 0.7, r: 0.28 }), steelD = mat(0x8a93a3, { m: 0.7, r: 0.3 }), red = mat(0xd9452f, { r: 0.6 }), cream = mat(0xfff0d6, { r: 0.9 });

  /* estructura: piso antiderrapante y azulejo */
  const floor = plane(W, D, mat(0xffffff, { map: checkerTexture(12, 9, '#e9e4dc', '#d8d2c8', 'rgba(0,0,0,.06)'), r: 0.6 }), 0, 0, 0, g, { rx: -Math.PI / 2 });
  floor.receiveShadow = true;
  const tile = mat(0xffffff, { map: checkerTexture(20, 6, '#ffffff', '#eef1f4', 'rgba(0,0,0,.05)'), r: 0.5 });
  plane(W, H, tile, 0, H / 2, -D / 2, g); plane(W, H, cream, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, tile, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 }); plane(D, H, tile, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  for (const [w, x, z, ry] of [[W, 0, -D / 2 + 0.02, 0], [D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, -Math.PI / 2]]) plane(w, 0.25, red, x, 2.4, z, g, { ry, cast: false });

  /* entrada desde el comedor (el piso del comedor se ve detrás de la cámara) */
  plane(W + 8, 7, mat(0x6b4429, { r: 0.75 }), 0, -0.01, D / 2 + 3.5, g, { rx: -Math.PI / 2 });
  const south = (w, hh, material, x, y, dz) => plane(w, hh, material, x, y, D / 2 - dz, g, { ry: Math.PI });
  south(2.6, 3.0, red, -3, 1.5, 0.02);
  for (const s of [-1, 1]) south(1.1, 2.7, mat(0x3a2618, { r: 0.6 }), -3 + s * 0.6, 1.35, 0.03);
  const exitSign = sign('AL COMEDOR · SALIDA', 2.0, 0.34, { bg: '#1f7a55', fg: '#ffffff' }); exitSign.position.set(-3, 3.3, D / 2 - 0.06); exitSign.rotation.y = Math.PI; g.add(exitSign);

  /* pase con riel de comandas (sureste) */
  const px = 4.4, pz = 4.6;
  box(5.0, 1.0, 0.9, steel, px, 0, pz, g); box(5.2, 0.06, 1.1, steelD, px, 1.0, pz, g);
  box(5.0, 0.06, 0.06, steelD, px, 2.05, pz - 0.3, g, { cast: false });   // riel
  const tickets = ORDERS.map((o, i) => { const t = plane(0.32, 0.42, new THREE.MeshBasicMaterial({ color: o.allergy ? 0xffe0e0 : 0xffffff, toneMapped: false, side: THREE.DoubleSide }), px - 1.6 + i * 0.7, 1.8, pz - 0.31, g); t.userData.dynamic = true; return t; });
  for (const x of [px - 1.6, px, px + 1.6]) { cyl(0.18, 0.14, 0.2, mat(0xffd98a, { e: 0xff8a3c, ei: 1.2 }), x, 2.3, pz, g, { seg: 10, cast: false }); }
  const plates = ORDERS.map((o, i) => { const p = cyl(0.26, 0.22, 0.05, mat(0xffffff, { r: 0.4, own: true }), px - 1.6 + i * 1.6, 1.06, pz + 0.05, g, { seg: 16 }); p.visible = false; p.userData.dynamic = true; return p; });
  const passSign = sign('PASE', 1.2, 0.34, { bg: '#d9452f', fg: '#fff0d6' }); passSign.position.set(px, 2.75, pz - 0.2); g.add(passSign);
  col.addBoxAt(px, pz, 5.2, 1.1);

  /* lavamanos (poniente) */
  const lx = -W / 2 + 0.45, lz = 2.6;
  box(0.7, 0.9, 0.6, steel, lx, 0, lz, g); box(0.5, 0.18, 0.4, steelD, lx, 0.9, lz, g); cyl(0.02, 0.02, 0.35, steelD, lx - 0.2, 1.08, lz, g, { seg: 6 });
  box(0.05, 0.4, 0.3, mat(0x58b565), lx - 0.33, 1.3, lz - 0.45, g, { cast: false });   // jabón
  const washSign = sign('LAVADO DE MANOS', 1.6, 0.3, { bg: '#3a7bd5', fg: '#ffffff' }); washSign.position.set(lx - 0.38, 2.0, lz); washSign.rotation.y = Math.PI / 2; g.add(washSign);
  col.addBoxAt(lx, lz, 0.8, 0.7);

  /* refrigeradores con termómetro (noroeste) */
  const fridges = {};
  for (const [id, x, temp, ok] of [['A', -7.2, 3, true], ['B', -5.2, 9, false]]) {
    box(1.7, 2.4, 0.9, steel, x, 0, -D / 2 + 0.5, g);
    box(0.06, 1.6, 0.06, steelD, x + 0.65, 0.5, -D / 2 + 0.97, g, { cast: false });
    const screen = plane(0.5, 0.26, new THREE.MeshBasicMaterial({ color: ok ? 0x1f8f5e : 0xb3261e, toneMapped: false }), x, 2.0, -D / 2 + 0.96, g);
    screen.userData.dynamic = true;
    const tsign = sign(`${id} · ${temp} °C`, 0.9, 0.24, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', radius: 0 }); tsign.position.set(x, 2.0, -D / 2 + 0.97); g.add(tsign);
    fridges[id] = { screen, ok };
    col.addBoxAt(x, -D / 2 + 0.5, 1.8, 1.0);
  }
  const frSign = sign('REFRIGERACIÓN', 1.8, 0.32, { bg: '#2b3a55', fg: '#ffffff' }); frSign.position.set(-6.2, 2.75, -D / 2 + 0.05); g.add(frSign);

  /* almacén (norte) */
  for (let r = 0; r < 3; r++) {
    box(2.6, 0.05, 0.6, steel, -1.4, 0.5 + r * 0.7, -D / 2 + 0.35, g, { cast: false });
    for (let i = 0; i < 5; i++) box(0.36, 0.42, 0.36, mat([0xf2b93b, 0xd9452f, 0x58b565, 0xfff0d6, 0x8a5a36][(r + i) % 5], { r: 0.8 }), -2.4 + i * 0.5, 0.55 + r * 0.7, -D / 2 + 0.35, g, { cast: false });
  }
  for (const x of [-2.7, -0.1]) box(0.06, 2.2, 0.06, steelD, x, 0, -D / 2 + 0.35, g, { cast: false });
  col.addBoxAt(-1.4, -D / 2 + 0.35, 2.7, 0.7);
  const almSign = sign('ALMACÉN', 1.3, 0.3, { bg: '#8a5a36', fg: '#ffffff' }); almSign.position.set(-1.4, 2.75, -D / 2 + 0.05); g.add(almSign);

  /* mesa de preparación con las tablas de colores (centro) */
  const mx = -2.6, mz = 0.2;
  box(4.4, 0.92, 1.3, steel, mx, 0, mz, g); box(4.6, 0.05, 1.5, steelD, mx, 0.92, mz, g);
  const boardPos = {};
  BOARDS.forEach((b, i) => { const x = mx - 1.8 + i * 0.9; box(0.7, 0.04, 0.45, mat(b.hex, { r: 0.7 }), x, 0.97, mz, g, { cast: false }); boardPos[b.id] = [x, mz]; });
  col.addBoxAt(mx, mz, 4.6, 1.5);
  const prepSign = sign('PREPARACIÓN · TABLAS DE COLORES', 2.8, 0.32, { bg: '#2b3a55', fg: '#ffd166' }); prepSign.position.set(mx, 2.3, mz); g.add(prepSign);
  const food = {};
  for (const i of INGREDIENTS) { const f = (i.id === 'pescado' ? box(0.4, 0.06, 0.18, mat(FOOD[i.id], { r: 0.6 }), 0, 0, 0, g, { cast: false }) : i.id === 'pollo' ? box(0.3, 0.08, 0.22, mat(FOOD[i.id], { r: 0.6 }), 0, 0, 0, g, { cast: false }) : sph(0.12, mat(FOOD[i.id], { r: 0.7 }), 0, 0, 0, g, { seg: 8, rings: 6 })); f.visible = false; f.userData.dynamic = true; food[i.id] = f; }

  /* parrilla y plancha con flamas (noreste) */
  const grill = { pollo: [4.0, -D / 2 + 0.7], pescado: [6.8, -D / 2 + 0.7] };
  const flames = [];
  for (const [id, [x, z]] of Object.entries(grill)) {
    box(2.2, 0.9, 1.1, steelD, x, 0, z, g); box(2.3, 0.05, 1.2, mat(0x2a2f3a, { r: 0.5 }), x, 0.9, z, g);
    for (let i = 0; i < 4; i++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 6), new THREE.MeshBasicMaterial({ color: 0xff8a3c, toneMapped: false, transparent: true, opacity: 0.85 })); fl.position.set(x - 0.75 + i * 0.5, 1.02, z); fl.userData.dynamic = true; g.add(fl); flames.push(fl); }
    box(2.3, 0.6, 0.9, steel, x, 2.6, z - 0.1, g, { cast: false });   // campana
    col.addBoxAt(x, z, 2.3, 1.2);
    const s = sign(id === 'pollo' ? 'PARRILLA' : 'PLANCHA', 1.2, 0.3, { bg: '#d9452f', fg: '#fff0d6' }); s.position.set(x, 2.45, z + 0.36); g.add(s);
  }
  const thermometer = box(0.04, 0.3, 0.04, mat(0xe5484d, { e: 0xe5484d, ei: 0.4 }), 0, 0, 0, g, { cast: false }); thermometer.visible = false; thermometer.userData.dynamic = true;

  /* estación fría de alérgenos (este) */
  const fx = W / 2 - 0.7, fz = -0.8;
  box(1.1, 0.92, 2.6, mat(0xffffff, { r: 0.4 }), fx, 0, fz, g); box(1.2, 0.05, 2.7, mat(0x3fb27f, { r: 0.6 }), fx, 0.92, fz, g);
  const allSign = sign('ESTACIÓN FRÍA · ALÉRGENOS', 2.4, 0.32, { bg: '#3fb27f', fg: '#ffffff' }); allSign.position.set(fx - 0.6, 2.2, fz); allSign.rotation.y = -Math.PI / 2; g.add(allSign);
  const shield = sph(0.14, new THREE.MeshStandardMaterial({ color: 0x9aa7b8, emissive: 0x000000 }), fx, 1.3, fz, g, { seg: 10, rings: 8 }); shield.userData.dynamic = true;
  col.addBoxAt(fx, fz, 1.2, 2.7);

  /* luces */
  for (const [x, z] of [[-4, 0], [3, 0], [-3, -4.5], [5, -3.5], [4, 3]]) {
    box(1.4, 0.05, 0.36, mat(0xffffff, { e: 0xfff6e6, ei: 1.3, r: 0.5 }), x, H - 0.05, z, g, { cast: false });
    const pl = new THREE.PointLight(0xfff3dc, 6, 9, 1.7); pl.position.set(x, H - 0.4, z); g.add(pl);
  }
  g.add(new THREE.HemisphereLight(0xfffaf0, 0xc9b8a0, 1.05));
  const sun = sunLight(g, { x: -3, y: 12, z: 9, intensity: 1.15, color: 0xfff6e8, area: 13 }); sun.target.position.set(0, 0, 0);

  /* equipo de cocina */
  const chefLook = { skin: 0xd9a37a, hair: 0x2a1e14, hairStyle: 'bun', top: 0xffffff, topAccent: 0xd9452f, bottom: 0x27304a, shoes: 0x1d2433, accessories: ['cap'] };
  const rosario = new Npc({ look: chefLook, x: px - 1.2, z: pz - 1.1, yaw: Math.PI });
  const cooks = [
    new Npc({ look: { ...chefLook, skin: 0xb9794d, hairStyle: 'short', hair: 0x15100b, topAccent: 0x2b3a55 }, route: [[1.2, -3.8], [1.2, 2.4], [-5.8, 2.4], [-5.8, -3.8]], speed: 1.6, pause: 0.6 }),
    new Npc({ look: { ...chefLook, skin: 0xf0c7a4, hair: 0x6b4a2b, hairStyle: 'long', topAccent: 0xf2b93b }, x: 5.4, z: -3.5, yaw: Math.PI })
  ];
  [rosario, ...cooks].forEach(n => g.add(n.group));
  col.addCircle(px - 1.2, pz - 1.1, 0.4); col.addCircle(5.4, -3.5, 0.35);

  mergeStatic(g);
  const m = api.missions.restaurant;
  const interactables = [
    { id: 'exit', x: -3, y: 2.1, z: D / 2 - 0.6, radius: 1.6, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'restaurant') },
    { id: 'rosario', x: px - 1.2, y: 2.0, z: pz - 1.1, radius: 1.8, color: 0xffc93c, label: () => m.labelFor('chef'), highlight: () => m.wants('chef'), action: () => m.talkToChef(rosario) },
    { id: 'rail', x: px + 0.6, y: 2.0, z: pz - 1.0, radius: 1.5, color: 0x4cc9f0, label: () => m.labelFor('rail'), highlight: () => m.wants('rail'), action: () => m.readRail() },
    { id: 'pass', x: px + 2.0, y: 1.6, z: pz - 1.0, radius: 1.5, color: 0xffc93c, label: () => m.labelFor('pass'), highlight: () => m.wants('pass'), action: () => m.openPass() },
    { id: 'sink', x: lx + 0.9, y: 1.5, z: lz, radius: 1.5, color: 0x4cc9f0, label: () => m.labelFor('sink'), highlight: () => m.wants('sink'), action: () => m.wash() },
    { id: 'fridge-A', x: -7.2, y: 1.8, z: -D / 2 + 1.7, radius: 1.3, color: 0x5dff9e, label: () => m.labelFor('fridge', 'A'), highlight: () => m.wants('fridge', 'A'), action: () => m.checkFridge('A') },
    { id: 'fridge-B', x: -5.2, y: 1.8, z: -D / 2 + 1.7, radius: 1.3, color: 0xff8f7a, label: () => m.labelFor('fridge', 'B'), highlight: () => m.wants('fridge', 'B'), action: () => m.checkFridge('B') },
    { id: 'prep', x: mx, y: 1.6, z: mz + 1.4, radius: 2.0, color: 0xffc93c, label: () => m.labelFor('prep'), highlight: () => m.wants('prep'), action: () => m.openPrep() },
    { id: 'allergy', x: fx - 1.4, y: 1.6, z: fz, radius: 1.6, color: 0x3fb27f, label: () => m.labelFor('allergy'), highlight: () => m.wants('allergy'), action: () => m.openAllergy() },
    ...Object.entries(grill).map(([id, [x, z]]) => ({ id: 'cook-' + id, x, y: 1.6, z: z + 1.3, radius: 1.4, color: 0xff8a3c, label: () => m.labelFor('cook', id), highlight: () => m.wants('cook', id), action: () => m.cook(id) }))
  ];

  return {
    name: 'restaurant', title: 'Restaurante', group: g, collision: col, interactables, npcs: [rosario, ...cooks],
    background: 0x2a1408, fog: null,
    spawns: { default: { x: -3, z: 5.4, yaw: Math.PI } },
    camera: { distance: 6.2, minDistance: 2.4, maxDistance: 8.4, pitch: 0.5, yaw: 0, box: { minX: -11, maxX: 11, minZ: -8.5, maxZ: 10, maxY: 6.4 } },
    update(dt, t) {
      const a = m.attempt;
      flames.forEach((f, i) => { f.scale.y = 0.7 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.6; f.material.opacity = 0.65 + Math.sin(t * 11 + i) * 0.2; });
      fridges.B.screen.material.color.setHex(Math.sin(t * 5) > 0 ? 0xb3261e : 0x6b1410);
      tickets.forEach((tk, i) => { tk.rotation.z = Math.sin(t * 2 + i) * 0.06; tk.material.color.setHex(a.read.includes(ORDERS[i].id) ? 0xfff6c8 : (ORDERS[i].allergy ? 0xffe0e0 : 0xffffff)); });
      for (const i of INGREDIENTS) {
        const f = food[i.id];
        if (Number.isFinite(a.cooked[i.id])) { const [x, z] = grill[i.id]; f.visible = true; f.position.set(x, 1.0 + Math.abs(Math.sin(t * 6)) * 0.01, z); }
        else if (a.prep[i.id]) { const [x, z] = boardPos[a.prep[i.id]]; const k = INGREDIENTS.filter(j => a.prep[j.id] === a.prep[i.id]).indexOf(i); f.visible = true; f.position.set(x - 0.15 + k * 0.15, 1.05, z); }
        else f.visible = false;
      }
      shield.material.color.setHex(a.allergy ? 0x3fb27f : 0x9aa7b8); shield.material.emissive.setHex(a.allergy ? 0x1f7a55 : 0x000000);
      plates.forEach(p => { p.visible = a.served; });
    }
  };
}
