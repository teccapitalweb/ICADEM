// Escenario 10 · Invernadero (arco de cristal y acero verde), misión 8: «Cultivo inteligente».
// Tres camas de jitomate con sensor de sustrato y válvula, sensores de clima, tablero de clima
// que abre las ventilas del techo y despliega la malla sombra, tanque de fertirriego con CE y pH,
// trampas amarillas y caja de control biológico. Lo que el jugador decide cambia la escena.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { BEDS, TRAPS, SENSORS, CHART, PEST_ZONE } from '../missions/greenhouse-logic.js';
import { mat, box, cyl, sph, ico, plane, sign, grassTexture, sunLight, mergeStatic } from './kit.js';

const BED_X = { A: -5, B: 0, C: 5 };
const TRAP_AISLE = { T1: -7.5, T2: -2.5, T3: 7.5 };   // desde qué pasillo se revisa cada trampa

/** Mata de jitomate low-poly (tutor, follaje y frutos). */
function tomato(x, z, parent, k) {
  cyl(0.02, 0.02, 1.6, mat(0x8a6a3c, { r: 0.9 }), x, 0.5, z, parent, { seg: 5, cast: false });
  k = Math.abs(Math.round(k));
  const leaf = mat([0x3f9a3a, 0x4caf50, 0x2f8a3a][k % 3], { r: 0.85, flat: true });
  for (let i = 0; i < 3; i++) ico(0.26 - i * 0.04, leaf, x + Math.sin(k + i) * 0.06, 0.85 + i * 0.42, z + Math.cos(k * 2 + i) * 0.06, parent, { detail: 0 });
  const fruit = [mat(0xe0352b, { r: 0.45 }), mat(0xf28c28, { r: 0.5 }), mat(0x8bc34a, { r: 0.6 })];
  for (let i = 0; i < 3; i++) sph(0.07, fruit[(k + i) % 3], x + Math.cos(k * 3 + i * 2.1) * 0.2, 0.8 + i * 0.3, z + Math.sin(k * 3 + i * 2.1) * 0.2, parent, { seg: 8, rings: 6, cast: false });
}

export function buildGreenhouse(api) {
  const g = new THREE.Group();
  const W = 18, D = 14, H = 5;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const green = mat(0x2f8a5a, { m: 0.4, r: 0.4 }), white = mat(0xf6f8f6, { r: 0.6 }), steel = mat(0xc4ccd6, { m: 0.6, r: 0.3 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0xd6f5e0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });

  /* exterior y piso */
  const outside = plane(70, 70, mat(0xffffff, { map: grassTexture(14, 14), r: 1 }), 0, -0.03, 0, g, { rx: -Math.PI / 2 }); outside.receiveShadow = true;
  const floor = plane(W, D, mat(0xd9cdb4, { r: 0.95 }), 0, 0, 0, g, { rx: -Math.PI / 2 }); floor.receiveShadow = true;
  for (const x of [-7.5, -2.5, 2.5, 7.5]) plane(1.2, D - 0.4, mat(0xbfb6a3, { r: 0.9 }), x, 0.005, 0, g, { rx: -Math.PI / 2 });   // pasillos

  /* arco de cristal con costillas de acero */
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, D, 32, 1, true, -Math.PI / 2, Math.PI), glassM);
  arch.rotation.x = Math.PI / 2; arch.scale.set(1, 1, H / (W / 2)); arch.userData.dynamic = true; g.add(arch);
  for (let i = 0; i <= 7; i++) {
    const z = -D / 2 + i * (D / 7);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(W / 2, 0.06, 5, 32, Math.PI), green);
    rib.position.set(0, 0, z); rib.scale.set(1, H / (W / 2), 1); g.add(rib);
  }
  box(0.12, 0.12, D, green, 0, H - 0.08, 0, g, { cast: false });
  for (const z of [-D / 2, D / 2]) {
    const end = new THREE.Mesh(new THREE.CircleGeometry(W / 2, 32, 0, Math.PI), glassM); end.scale.set(1, H / (W / 2), 1); end.position.set(0, 0, z); end.userData.dynamic = true; g.add(end);
  }
  for (const s of [-1, 1]) box(0.25, 0.6, D, green, s * (W / 2 - 0.12), 0, 0, g);   // muretes
  box(W, 0.6, 0.25, green, 0, 0, -D / 2 + 0.12, g);
  for (const sx of [-1, 1]) box(W / 2 - 1.6, 0.6, 0.25, green, sx * (1.6 + W / 2) / 2, 0, D / 2 - 0.12, g);

  /* entrada */
  for (const s of [-1, 1]) box(0.14, 2.8, 0.14, green, s * 1.6, 0, D / 2 - 0.1, g);
  box(3.34, 0.14, 0.14, green, 0, 2.8, D / 2 - 0.1, g);
  const exitSign = sign('SALIDA', 1.2, 0.34, { bg: '#1f7a55', fg: '#ffffff' }); exitSign.position.set(0, 3.25, D / 2 - 0.16); exitSign.rotation.y = Math.PI; g.add(exitSign);
  const title = sign('INVERNADERO ICADEM · JITOMATE', 4.2, 0.5, { bg: '#2f8a5a', fg: '#ffffff' }); title.position.set(0, 3.9, -D / 2 + 0.3); g.add(title);

  /* ventilas cenitales (se abren según el tablero) */
  const vents = [];
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group(); pivot.position.set(0, H - 0.05, -4.5 + i * 3); pivot.userData.dynamic = true; g.add(pivot);
    box(2.2, 0.04, 1.6, mat(0xbfe9cf, { r: 0.1, opacity: 0.55 }), 1.1, 0, 0, pivot, { cast: false });
    vents.push(pivot);
  }
  /* malla sombra */
  const shadeM = new THREE.MeshStandardMaterial({ color: 0x1d2a20, transparent: true, opacity: 0, roughness: 1, side: THREE.DoubleSide, depthWrite: false });
  const shadeNet = plane(W - 3, D - 0.6, shadeM, 0, H - 1.1, 0, g, { rx: -Math.PI / 2 }); shadeNet.userData.dynamic = true;

  /* camas de cultivo */
  const soil = {}, puddle = {}, drips = {}, whiteflies = [], helpers = [];
  for (const b of BEDS) {
    const x = BED_X[b.id];
    box(1.7, 0.5, 7.2, mat(0x8a6a3c, { r: 0.9 }), x, 0, -1.6, g);
    const sm = mat(b.soil < 30 ? 0xb08a5c : b.soil > 65 ? 0x4a3524 : 0x6b4a2e, { r: 1, own: true });
    soil[b.id] = plane(1.5, 7.0, sm, x, 0.51, -1.6, g, { rx: -Math.PI / 2 }); soil[b.id].userData.dynamic = true;
    if (b.soil > 65) { const p = plane(1.2, 2.2, mat(0x6fa8c9, { r: 0.1, m: 0.2, opacity: 0.7, own: true }), x, 0.52, -0.2, g, { rx: -Math.PI / 2 }); p.userData.dynamic = true; puddle[b.id] = p; }
    for (let i = 0; i < 6; i++) tomato(x + (i % 2 ? 0.35 : -0.35), -4.6 + i * 1.2, g, i + x);
    // sensor de sustrato con pantalla de color
    cyl(0.03, 0.03, 0.8, steel, x + 0.6, 0.5, 1.4, g, { seg: 6, cast: false });
    const scr = sign(`${b.soil}%`, 0.42, 0.22, { bg: b.soil < 35 ? '#c0392b' : b.soil > 60 ? '#2f6db5' : '#2f8a5a', fg: '#ffffff' }); scr.position.set(x + 0.6, 1.42, 1.42); g.add(scr);
    // válvula de riego
    cyl(0.07, 0.07, 0.7, mat(0x3a7bd5, { m: 0.4, r: 0.4 }), x - 0.5, 0, 2.3, g, { seg: 8 });
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 14), mat(0xd9452f, { r: 0.5 })); wheel.position.set(x - 0.5, 0.78, 2.3); wheel.userData.dynamic = true; g.add(wheel);
    const bs = sign(`CAMA ${b.id}`, 0.9, 0.3, { bg: '#2f8a5a', fg: '#ffffff' }); bs.position.set(x, 0.85, 2.03); bs.rotation.y = 0; g.add(bs);
    // goteo (visible cuando se riega)
    const dr = []; for (let i = 0; i < 8; i++) { const d = sph(0.035, new THREE.MeshBasicMaterial({ color: 0x7fc8ff }), x + (i % 2 ? 0.35 : -0.35), 1.2, -4.6 + (i >> 1) * 2.0, g, { seg: 5, rings: 4, cast: false }); d.visible = false; d.userData.dynamic = true; dr.push(d); }
    drips[b.id] = { list: dr, wheel };
    col.addBoxAt(x, -1.6, 1.8, 7.3);
  }
  // mosca blanca sobre la cama B y enemigos naturales (aparecen al liberar)
  for (let i = 0; i < 14; i++) { const f = sph(0.03, new THREE.MeshBasicMaterial({ color: 0xffffff }), BED_X[PEST_ZONE], 1.4, -1.6, g, { seg: 4, rings: 3, cast: false }); f.userData.dynamic = true; f.userData.phase = i * 0.7; whiteflies.push(f); }
  for (let i = 0; i < 10; i++) { const f = sph(0.035, new THREE.MeshBasicMaterial({ color: 0xf2b93b }), BED_X[PEST_ZONE], 1.4, -1.6, g, { seg: 4, rings: 3, cast: false }); f.visible = false; f.userData.dynamic = true; f.userData.phase = i * 0.9; helpers.push(f); }

  /* trampas amarillas */
  const traps = {};
  for (const t of TRAPS) {
    const x = BED_X[t.bed];
    cyl(0.015, 0.015, 1.1, steel, x, 1.0, -1.0, g, { seg: 4, cast: false });
    const card = box(0.34, 0.46, 0.02, mat(0xffe03a, { r: 0.6, e: 0x6a5a00, ei: 0.3, own: true }), x, 1.75, -1.0, g, { cast: false }); card.userData.dynamic = true;
    for (let i = 0; i < Math.min(12, Math.round(t.moscaBlanca / 2.5)); i++) box(0.025, 0.025, 0.005, mat(0x333333), x - 0.12 + (i % 4) * 0.08, 1.85 + Math.floor(i / 4) * 0.1, -0.985, g, { cast: false });
    traps[t.id] = card;
  }

  /* sensores de clima (abrigo meteorológico) */
  const sensorSpots = { temp: [-2.5, -5.0], hr: [2.5, -5.0], ce: [4.6, -5.9], ph: [7.9, -5.9] };
  for (const id of ['temp', 'hr']) {
    const [x, z] = sensorSpots[id];
    cyl(0.04, 0.04, 1.5, steel, x, 0, z, g, { seg: 6 });
    for (let i = 0; i < 4; i++) cyl(0.2 - i * 0.02, 0.2 - i * 0.02, 0.05, white, x, 1.5 + i * 0.08, z, g, { seg: 10, cast: false });
    col.addCircle(x, z, 0.25);
  }
  for (const s of SENSORS) {
    const [x, z] = sensorSpots[s.id], r = CHART[s.id];
    const scr = sign(`${s.value}${r.unit === '%' ? '%' : r.unit ? ' ' + r.unit : ''}`, 1.3, 0.55, { bg: '#12325f', fg: s.level === 'ok' ? '#7dffb0' : '#ffd166', sub: r.name.split(' ')[0].toUpperCase() });
    scr.position.set(x, 2.3, z + 0.02); g.add(scr);
  }

  /* fertirriego: tanque, dosificador */
  const tx = 6.2, tz = -6.1;
  cyl(0.8, 0.8, 1.5, mat(0xe8eef5, { r: 0.4, side: THREE.DoubleSide }), tx, 0, tz, g, { seg: 18, open: true });
  const liquid = cyl(0.76, 0.76, 0.04, mat(0x6fbf73, { r: 0.2, own: true }), tx, 1.22, tz, g, { seg: 18, cast: false }); liquid.userData.dynamic = true;
  box(0.6, 1.4, 0.4, mat(0x2b3a55, { r: 0.5 }), tx - 1.6, 0, tz - 0.2, g); box(0.6, 1.4, 0.4, mat(0x2b3a55, { r: 0.5 }), tx + 1.7, 0, tz - 0.2, g);
  box(0.5, 0.7, 0.4, mat(0xf2b93b, { r: 0.6 }), tx + 0.9, 0, tz + 0.6, g); box(0.4, 0.5, 0.35, mat(0xd9452f, { r: 0.6 }), tx + 1.4, 0, tz + 0.7, g);
  const fsign = sign('FERTIRRIEGO', 1.6, 0.32, { bg: '#2b3a55', fg: '#ffd166' }); fsign.position.set(tx, 2.75, tz - 0.2); g.add(fsign);
  col.addCircle(tx, tz, 0.9); col.addBoxAt(tx - 1.6, tz - 0.2, 0.7, 0.5); col.addBoxAt(tx + 1.7, tz - 0.2, 0.7, 0.5); col.addBoxAt(tx + 1.15, tz + 0.65, 1.0, 0.5);

  /* tablero de clima (poniente) y ventiladores */
  const cx = -W / 2 + 0.55, cz = -4.4;
  box(0.3, 1.6, 1.4, mat(0x2b3a55, { r: 0.5 }), cx, 0.4, cz, g);
  const panel = plane(1.2, 1.0, new THREE.MeshBasicMaterial({ color: 0x0d3b2a, toneMapped: false }), cx + 0.16, 1.4, cz, g, { ry: Math.PI / 2 }); panel.userData.dynamic = true;
  const csign = sign('TABLERO DE CLIMA', 1.6, 0.3, { bg: '#2f8a5a', fg: '#ffffff' }); csign.position.set(cx + 0.17, 2.3, cz); csign.rotation.y = Math.PI / 2; g.add(csign);
  col.addBoxAt(cx, cz, 0.4, 1.5);
  const fans = [];
  for (const z of [-3, 1]) { const f = new THREE.Group(); f.position.set(W / 2 - 0.3, 2.2, z); f.userData.dynamic = true; g.add(f); box(0.08, 0.9, 0.9, steel, 0, -0.45, 0, f, { cast: false }); for (let i = 0; i < 4; i++) box(0.04, 0.38, 0.1, mat(0x9aa7b8), -0.06, 0, 0, f, { cast: false }).rotation.x = i * Math.PI / 2; fans.push(f); }

  /* pizarrón con la ficha y caja de control biológico */
  const bx = -5, bz = D / 2 - 0.5;
  box(2.2, 1.3, 0.1, mat(0x1f5a3c, { r: 0.9 }), bx, 0.9, bz, g);
  const board = sign('FICHA DEL CULTIVO', 2.0, 0.34, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', radius: 0 }); board.position.set(bx, 1.95, bz - 0.06); board.rotation.y = Math.PI; g.add(board);
  for (let i = 0; i < 4; i++) box(1.6 - i * 0.2, 0.03, 0.01, white, bx, 1.2 + i * 0.16, bz - 0.06, g, { cast: false });
  col.addBoxAt(bx, bz, 2.3, 0.3);
  const px = -7.6, pz = 3.6;
  box(1.0, 0.8, 0.7, mat(0xffffff, { r: 0.5 }), px, 0, pz, g); box(1.05, 0.08, 0.75, mat(0xf2b93b, { r: 0.5 }), px, 0.8, pz, g);
  const psign = sign('CONTROL BIOLÓGICO', 1.6, 0.3, { bg: '#f2b93b', fg: '#2b3a55' }); psign.position.set(px, 1.55, pz); g.add(psign);
  col.addBoxAt(px, pz, 1.1, 0.8);

  /* luz */
  g.add(new THREE.HemisphereLight(0xeaf8ff, 0x9fbf7a, 1.3));
  const sun = sunLight(g, { x: 6, y: 16, z: 8, intensity: 1.9, color: 0xfff3d6, area: 16 }); sun.target.position.set(0, 0, 0);

  /* agrónomo y ayudante */
  const tomas = new Npc({ look: { skin: 0xc98e63, hair: 0x2a1e14, hairStyle: 'short', top: 0x2f8a5a, topAccent: 0xf2b93b, bottom: 0x5a4a32, shoes: 0x5a3d22, accessories: ['cap', 'badge'] }, x: 2.4, z: 4.2, yaw: Math.PI });
  const helper = new Npc({ look: { skin: 0xf0c7a4, hair: 0x6b4a2b, hairStyle: 'long', top: 0xffffff, topAccent: 0x2f8a5a, bottom: 0x3a5a78, shoes: 0x5a3d22, accessories: [] }, route: [[-7.4, -5.2], [-7.4, 1.8], [7.4, 1.8], [7.4, -4.0]], speed: 1.1, pause: 1.6 });
  [tomas, helper].forEach(n => g.add(n.group));
  col.addCircle(2.4, 4.2, 0.4);

  mergeStatic(g);
  const m = api.missions.greenhouse;
  const interactables = [
    { id: 'exit', x: 0, y: 2.1, z: D / 2 - 0.6, radius: 1.6, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'greenhouse') },
    { id: 'tomas', x: 2.4, y: 2.0, z: 4.2, radius: 1.8, color: 0xffc93c, label: () => m.labelFor('agro'), highlight: () => m.wants('agro'), action: () => m.talkToAgro(tomas) },
    { id: 'chart', x: bx, y: 1.8, z: bz - 1.0, radius: 1.5, color: 0x4cc9f0, label: () => m.labelFor('chart'), highlight: () => m.wants('chart'), action: () => m.readChart() },
    ...SENSORS.map(s => { const [x, z] = sensorSpots[s.id]; return { id: 'sensor-' + s.id, x, y: 2.0, z: z + 0.9, radius: 1.2, color: 0x4cc9f0, label: () => m.labelFor('sensor', s.id), highlight: () => m.wants('sensor', s.id), action: () => m.readSensor(s.id) }; }),
    { id: 'climate', x: cx + 1.1, y: 1.8, z: cz, radius: 1.4, color: 0xffc93c, label: () => m.labelFor('climate'), highlight: () => m.wants('climate'), action: () => m.openClimate() },
    { id: 'solution', x: tx, y: 1.8, z: tz + 1.4, radius: 1.2, color: 0xffc93c, label: () => m.labelFor('solution'), highlight: () => m.wants('solution'), action: () => m.openSolution() },
    ...BEDS.map(b => ({ id: 'bed-' + b.id, x: BED_X[b.id] - 0.5, y: 1.4, z: 3.0, radius: 1.2, color: 0x4cc9f0, label: () => m.labelFor('bed', b.id), highlight: () => m.wants('bed', b.id), action: () => m.openBed(b.id) })),
    ...TRAPS.map(t => ({ id: 'trap-' + t.id, x: TRAP_AISLE[t.id], y: 1.8, z: -1.0, radius: 1.4, color: 0xffe03a, label: () => m.labelFor('trap', t.id), highlight: () => m.wants('trap', t.id), action: () => m.inspectTrap(t.id) })),
    { id: 'pest', x: px + 1.1, y: 1.4, z: pz, radius: 1.3, color: 0xf2b93b, label: () => m.labelFor('pest'), highlight: () => m.wants('pest'), action: () => m.openPest() }
  ];

  const dryColor = new THREE.Color(0xb08a5c), wetColor = new THREE.Color(0x6b4a2e), mudColor = new THREE.Color(0x4a3524);
  return {
    name: 'greenhouse', title: 'Invernadero', group: g, collision: col, interactables, npcs: [tomas, helper],
    background: 0xbfe6ff, fog: null,
    spawns: { default: { x: 0, z: 5.4, yaw: Math.PI } },
    camera: { distance: 6.4, minDistance: 2.4, maxDistance: 8.8, pitch: 0.5, yaw: 0, box: { minX: -8, maxX: 8, minZ: -6.2, maxZ: 10.5, maxY: 6.8 } },
    update(dt, t) {
      const a = m.attempt, clim = a.climate || { vent: 20, shade: 0 };
      vents.forEach(v => { v.rotation.z += ((clim.vent / 100) * 0.9 - v.rotation.z) * Math.min(1, dt * 2); });
      shadeM.opacity += ((clim.shade / 80) * 0.55 - shadeM.opacity) * Math.min(1, dt * 2);
      fans.forEach(f => { f.rotation.x += dt * (2 + clim.vent * 0.12); });
      for (const b of BEDS) {
        const act = a.irrigation[b.id], d = drips[b.id];
        d.list.forEach((p, i) => { p.visible = act === 'regar'; if (p.visible) p.position.y = 1.2 - ((t * 1.5 + i * 0.37) % 1) * 0.65; });
        if (act) d.wheel.rotation.z += dt * (act === 'regar' ? 4 : 0);
        const target = act === 'regar' ? wetColor : act === 'suspender' ? wetColor : (b.soil < 30 ? dryColor : b.soil > 65 ? mudColor : wetColor);
        soil[b.id].material.color.lerp(target, Math.min(1, dt * 0.8));
        if (puddle[b.id]) { const s = act === 'suspender' ? Math.max(0.01, puddle[b.id].scale.x - dt * 0.4) : 1; puddle[b.id].scale.set(s, s, 1); puddle[b.id].visible = s > 0.02; }
      }
      const treated = a.pest && a.pest.zone === PEST_ZONE && a.pest.action === 'biologico';
      whiteflies.forEach((f, i) => { const k = t * 1.6 + f.userData.phase; f.visible = !treated; f.position.set(BED_X[PEST_ZONE] + Math.sin(k) * 0.7, 1.3 + Math.sin(k * 2.3) * 0.35, -1.6 + Math.cos(k * 0.8) * 2.6 + (i % 3) * 0.3); });
      helpers.forEach(f => { const k = t * 1.2 + f.userData.phase; f.visible = Boolean(treated); f.position.set(BED_X[PEST_ZONE] + Math.cos(k) * 0.6, 1.5 + Math.sin(k * 1.7) * 0.3, -1.6 + Math.sin(k * 0.6) * 2.8); });
      for (const tr of TRAPS) traps[tr.id].material.emissiveIntensity = a.traps.includes(tr.id) ? 0.15 : 0.35 + Math.sin(t * 3) * 0.15;
      if (a.solution) liquid.material.color.setHex(0x3f9a6a);
      panel.material.color.setHex(a.climate ? 0x1f7a55 : (Math.sin(t * 4) > 0 ? 0x0d3b2a : 0x14543c));
    }
  };
}
