// Escenario 11 · Oficina ICADEM (azul marino y madera clara), misión 9: «El expediente perdido».
// Cuatro archiveros con cajones que se abren al revisarlos, computadora con el registro de
// control, copiadora con su bandeja, mesa de trabajo donde el expediente se arma y se ordena,
// y el equipo de la oficina trabajando. Lo que el jugador toma y archiva aparece en la escena.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { CABINETS, SPOTS, DOCS } from '../missions/lost-file-logic.js';
import { mat, box, cyl, ico, plane, sign, plankTexture, sunLight, mergeStatic } from './kit.js';

const CAB_X = { A: -6, B: -2, C: 2, D: 6 };
const DOC_COLOR = { sol: 0xffffff, cot: 0xfff3c4, oc: 0xd8ecff, rec: 0xdff5e1, fac: 0xffe0e0, x1: 0xffe0e0, x2: 0xd8ecff, x3: 0xffffff };

export function buildOffice(api) {
  const g = new THREE.Group();
  const W = 18, D = 14, H = 4.2;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const navy = mat(0x1f3a68, { r: 0.6 }), wood = mat(0xd9b48a, { r: 0.7 }), woodD = mat(0xa9713d, { r: 0.75 }), grey = mat(0x8a93a3, { m: 0.4, r: 0.4 }), white = mat(0xf7f8fa, { r: 0.6 }), dark = mat(0x1d2433, { r: 0.5 });

  /* estructura */
  const floor = plane(W, D, mat(0xffffff, { map: plankTexture(8, 6, '#d9b48a', '#c99f72'), r: 0.7 }), 0, 0, 0, g, { rx: -Math.PI / 2 }); floor.receiveShadow = true;
  plane(9, 6, mat(0x3a5a8c, { r: 1 }), 0, 0.006, -0.6, g, { rx: -Math.PI / 2, cast: false });   // alfombra
  const wallM = mat(0xf2f4f8, { r: 0.95 });
  plane(W, H, wallM, 0, H / 2, -D / 2, g); plane(W, H, wallM, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, wallM, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 }); plane(D, H, wallM, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  for (const [w, x, z, ry] of [[W, 0, -D / 2 + 0.02, 0], [D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, -Math.PI / 2], [W, 0, D / 2 - 0.02, Math.PI]]) plane(w, 0.9, navy, x, 0.45, z, g, { ry, cast: false });
  // ventanas con la ciudad
  for (const z of [-3.5, 1.5]) for (const s of [-1, 1]) {
    const win = plane(2.6, 1.6, new THREE.MeshBasicMaterial({ color: 0xbfe6ff, toneMapped: false }), s * (W / 2 - 0.03), 2.3, z, g, { ry: -s * Math.PI / 2 }); win.userData.dynamic = true;
    for (let i = 0; i < 4; i++) box(0.02, 0.5 + (i * 37 % 5) * 0.18, 0.4, mat(0x7f8cf5, { r: 0.8 }), s * (W / 2 - 0.05), 1.5, z - 0.9 + i * 0.6, g, { cast: false });
    box(0.06, 0.08, 2.7, white, s * (W / 2 - 0.06), 1.46, z, g, { cast: false }); box(0.06, 0.08, 2.7, white, s * (W / 2 - 0.06), 3.1, z, g, { cast: false });
  }

  /* entrada (el pasillo se ve detrás de la cámara) */
  plane(W + 8, 7, mat(0xc9ced8, { r: 0.8 }), 0, -0.01, D / 2 + 3.5, g, { rx: -Math.PI / 2 });
  const south = (w, hh, material, x, y) => plane(w, hh, material, x, y, D / 2 - 0.03, g, { ry: Math.PI });
  south(2.8, 3.0, navy, 0, 1.5); for (const s of [-1, 1]) south(1.15, 2.7, mat(0xcfe3f5, { r: 0.1, m: 0.4, e: 0x3c6fb0, ei: 0.2 }), s * 0.62, 1.35);
  const exitSign = sign('SALIDA', 1.2, 0.34, { bg: '#1f7a55', fg: '#ffffff' }); exitSign.position.set(0, 3.3, D / 2 - 0.06); exitSign.rotation.y = Math.PI; g.add(exitSign);
  const title = sign('OFICINA ICADEM · ADMINISTRACIÓN', 4.4, 0.5, { bg: '#1f3a68', fg: '#ffd166' }); title.position.set(0, 3.55, -D / 2 + 0.05); g.add(title);

  /* archiveros con dos cajones (se abren al revisarlos) */
  const drawers = {};
  for (const c of CABINETS) {
    const x = CAB_X[c.id], z = -D / 2 + 0.45;
    box(1.2, 1.5, 0.8, grey, x, 0, z, g);
    const lab = sign(`ARCHIVERO ${c.id}`, 1.1, 0.26, { bg: '#1f3a68', fg: '#ffffff' }); lab.position.set(x, 1.72, z + 0.41); g.add(lab);
    const sub = sign(c.name.split('· ')[1], 1.15, 0.2, { bg: 'rgba(0,0,0,0)', fg: '#1f3a68', radius: 0, weight: 700 }); sub.position.set(x, 2.0, z + 0.41); g.add(sub);
    SPOTS.filter(sp => sp.cabinet === c.id).forEach((sp, i) => {
      const dr = new THREE.Group(); dr.position.set(x, 0.95 - i * 0.6, z + 0.4); dr.userData.dynamic = true; g.add(dr);
      box(1.06, 0.5, 0.06, mat(0x9aa4b4, { m: 0.4, r: 0.35 }), 0, -0.25, 0, dr);
      box(0.3, 0.05, 0.05, dark, 0, -0.08, 0.05, dr, { cast: false });
      box(0.96, 0.4, 0.6, mat(0x6c7586, { r: 0.6 }), 0, -0.22, -0.32, dr, { cast: false });
      for (let k = 0; k < 4; k++) box(0.9, 0.3, 0.02, mat([0xf2b93b, 0xd8ecff, 0xffffff, 0x9fd5a8][k], { r: 0.8 }), 0, -0.12, -0.5 + k * 0.08, dr, { cast: false });
      drawers[sp.id] = dr;
    });
    const folder = box(0.5, 0.06, 0.36, mat(0x3a7bd5, { r: 0.6, e: 0x1f3a68, ei: 0.4 }), x, 1.5, z + 0.1, g, { cast: false }); folder.visible = false; folder.userData.dynamic = true;
    drawers['folder-' + c.id] = folder;
    col.addBoxAt(x, z, 1.3, 0.9);
  }

  /* copiadora con bandeja (oriente) */
  const sx = W / 2 - 0.75, sz = -1.6;
  box(1.0, 1.0, 0.9, white, sx, 0, sz, g); box(1.0, 0.18, 0.9, mat(0xc4ccd6, { r: 0.4 }), sx, 1.0, sz, g);
  box(0.06, 0.1, 0.5, dark, sx - 0.52, 1.0, sz, g, { cast: false });
  const tray = box(0.4, 0.04, 0.32, mat(0xe8eef5, { r: 0.4 }), sx - 0.6, 0.7, sz, g, { cast: false }); void tray;
  const scanSheet = box(0.28, 0.02, 0.22, mat(DOC_COLOR.fac, { r: 0.8 }), sx - 0.6, 0.73, sz, g, { cast: false }); scanSheet.userData.dynamic = true;
  const scanLight = box(0.7, 0.02, 0.06, new THREE.MeshBasicMaterial({ color: 0x5dff9e, toneMapped: false }), sx, 1.19, sz, g, { cast: false }); scanLight.userData.dynamic = true;
  const ssign = sign('ESCÁNER · COPIADORA', 1.6, 0.28, { bg: '#1f3a68', fg: '#ffffff' }); ssign.position.set(sx - 0.47, 2.0, sz); ssign.rotation.y = -Math.PI / 2; g.add(ssign);
  col.addBoxAt(sx, sz, 1.1, 1.0);

  /* computadora con el registro de control */
  const cx = -3.6, cz = 3.4;
  box(2.0, 0.75, 0.9, wood, cx, 0, cz, g); box(2.0, 0.05, 0.9, woodD, cx, 0.75, cz, g);
  box(0.7, 0.45, 0.05, dark, cx, 0.95, cz - 0.15, g); box(0.1, 0.2, 0.1, dark, cx, 0.78, cz - 0.15, g, { cast: false });
  const screen = plane(0.62, 0.38, new THREE.MeshBasicMaterial({ color: 0x2b6cb0, toneMapped: false }), cx, 1.18, cz - 0.12, g, { ry: Math.PI }); screen.userData.dynamic = true;
  box(0.5, 0.03, 0.18, mat(0x2a2f3a), cx, 0.8, cz + 0.15, g, { cast: false });
  const isign = sign('REGISTRO DE CONTROL', 1.6, 0.28, { bg: '#2b6cb0', fg: '#ffffff' }); isign.position.set(cx, 1.75, cz - 0.2); isign.rotation.y = Math.PI; g.add(isign);
  col.addBoxAt(cx, cz, 2.1, 1.0);

  /* escritorio de la coordinadora */
  const px = 3.6, pz = 3.4;
  box(2.2, 0.75, 0.9, wood, px, 0, pz, g); box(2.2, 0.05, 0.9, woodD, px, 0.75, pz, g);
  box(0.6, 0.38, 0.05, dark, px - 0.5, 0.8, pz - 0.2, g, { cast: false });
  for (let i = 0; i < 3; i++) box(0.3, 0.04, 0.22, mat(0xffffff, { r: 0.8 }), px + 0.5, 0.8 + i * 0.04, pz, g, { cast: false });
  const nsign = sign('COORDINACIÓN', 1.4, 0.28, { bg: '#1f3a68', fg: '#ffd166' }); nsign.position.set(px, 1.55, pz + 0.47); nsign.rotation.y = Math.PI; g.add(nsign);
  col.addBoxAt(px, pz, 2.3, 1.0);

  /* mesa de trabajo: el expediente se arma aquí */
  const tx = 0, tz = -1.6;
  box(3.6, 0.78, 1.6, wood, tx, 0, tz, g); box(3.7, 0.05, 1.7, woodD, tx, 0.78, tz, g);
  const tsign = sign('MESA DE TRABAJO', 1.6, 0.28, { bg: '#1f3a68', fg: '#ffffff' }); tsign.position.set(tx, 1.9, tz); g.add(tsign);
  col.addBoxAt(tx, tz, 3.8, 1.8);
  const cards = {}, flagsM = {};
  DOCS.forEach((d, i) => {
    const c = box(0.36, 0.015, 0.48, mat(DOC_COLOR[d.id], { r: 0.8, own: true }), 0, 0, 0, g, { cast: false }); c.visible = false; c.userData.dynamic = true; c.userData.pile = [tx - 1.2 + (i % 4) * 0.25 + (i % 2) * 0.05, tz - 0.3 + Math.floor(i / 4) * 0.5, (i * 0.37) % 0.6 - 0.3];
    cards[d.id] = c;
  });
  for (const id of ['oc', 'rec', 'fac']) { const f = box(0.12, 0.01, 0.12, mat(0xe5484d, { e: 0xe5484d, ei: 0.5 }), 0, 0, 0, g, { cast: false }); f.visible = false; f.userData.dynamic = true; flagsM[id] = f; }
  const binder = box(0.5, 0.12, 0.62, mat(0x1f3a68, { r: 0.6 }), tx + 1.45, 0.83, tz, g, { cast: false }); binder.visible = false; binder.userData.dynamic = true;

  /* equipo de trabajo y ambiente */
  const desks = [[-6.6, 0.4], [-6.6, -2.6], [6.4, 1.8]];
  for (const [x, z] of desks) {
    box(1.6, 0.75, 0.8, wood, x, 0, z, g); box(1.6, 0.05, 0.8, woodD, x, 0.75, z, g);
    box(0.55, 0.35, 0.04, dark, x, 0.8, z - 0.25, g, { cast: false });
    box(0.5, 0.45, 0.5, navy, x, 0, z + 0.75, g, { cast: false });
    col.addBoxAt(x, z, 1.7, 0.9);
  }
  for (const [x, z] of [[-8.3, 5.9], [8.3, 5.9], [-8.3, -6.2], [8.3, -6.3]]) { cyl(0.28, 0.22, 0.5, mat(0xf7f8fa, { r: 0.5 }), x, 0, z, g, { seg: 10 }); ico(0.48, mat(0x3f9a3a, { flat: true }), x, 0.95, z, g, { detail: 0 }); col.addCircle(x, z, 0.35); }
  cyl(0.18, 0.18, 1.1, mat(0x9fd5ff, { r: 0.2, opacity: 0.8 }), 8.2, 0, 4.4, g, { seg: 12 }); col.addCircle(8.2, 4.4, 0.3);
  const clock = cyl(0.3, 0.3, 0.04, white, -1, 3.0, -D / 2 + 0.03, g, { seg: 20, rx: Math.PI / 2 }); void clock;
  const hand = box(0.02, 0.22, 0.01, dark, -1, 3.0, -D / 2 + 0.06, g, { cast: false }); hand.userData.dynamic = true; hand.geometry.translate(0, 0.11, 0);
  for (const [x, z] of [[-4, -1.6], [4, -1.6], [-4, 3], [4, 3], [0, 3.6]]) {
    box(1.4, 0.05, 0.4, mat(0xffffff, { e: 0xfff6e6, ei: 1.2, r: 0.5 }), x, H - 0.05, z, g, { cast: false });
    const pl = new THREE.PointLight(0xfff3dc, 5, 9, 1.7); pl.position.set(x, H - 0.4, z); g.add(pl);
  }
  g.add(new THREE.HemisphereLight(0xf6f9ff, 0xcab89a, 1.05));
  const sun = sunLight(g, { x: -4, y: 12, z: 8, intensity: 1.1, color: 0xfff6e8, area: 13 }); sun.target.position.set(0, 0, 0);

  const paola = new Npc({ look: { skin: 0xd9a37a, hair: 0x2a1e14, hairStyle: 'bun', top: 0x1f3a68, topAccent: 0xffd166, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['lapels', 'badge', 'glasses'] }, x: px, z: pz - 1.0, yaw: 0 });
  const staff = [
    new Npc({ look: { skin: 0xf0c7a4, hair: 0x6b4a2b, hairStyle: 'short', top: 0x3a5fc4, topAccent: 0xffffff, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['tie'] }, x: -6.6, z: 1.15, yaw: Math.PI, sitting: true, seatY: 0.45 }),
    new Npc({ look: { skin: 0xc98e63, hair: 0x1d140d, hairStyle: 'long', top: 0x1f7a6c, topAccent: 0xffd166, bottom: 0x1d2a40, shoes: 0x1f1a17, accessories: ['badge'] }, x: -6.6, z: -1.85, yaw: Math.PI, sitting: true, seatY: 0.45 }),
    new Npc({ look: { skin: 0xe9b58c, hair: 0x9a9a9a, hairStyle: 'side', top: 0xf2b93b, topAccent: 0x1f3a68, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['glasses'] }, route: [[7.2, -3.6], [7.2, 4.4], [5.0, 5.4], [-1.5, 5.6], [-7.2, 4.6]], speed: 1.1, pause: 1.4 })
  ];
  [paola, ...staff].forEach(n => g.add(n.group));
  col.addCircle(px, pz - 1.0, 0.4);

  mergeStatic(g);
  const m = api.missions.office;
  const interactables = [
    { id: 'exit', x: 0, y: 2.1, z: D / 2 - 0.6, radius: 1.6, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'office') },
    { id: 'paola', x: px, y: 2.0, z: pz + 1.3, radius: 1.6, color: 0xffc93c, label: () => m.labelFor('manager'), highlight: () => m.wants('manager'), action: () => m.talkToManager(paola) },
    { id: 'index', x: cx, y: 1.8, z: cz + 1.2, radius: 1.4, color: 0x4cc9f0, label: () => m.labelFor('index'), highlight: () => m.wants('index'), action: () => m.openIndex() },
    ...CABINETS.map(c => ({ id: 'cab-' + c.id, x: CAB_X[c.id], y: 1.8, z: -D / 2 + 1.7, radius: 1.3, color: 0x4cc9f0, label: () => m.labelFor('spot', c.id), highlight: () => m.wants('spot', c.id), action: () => m.openSpot(c.id) })),
    { id: 'scan', x: sx - 1.3, y: 1.5, z: sz, radius: 1.3, color: 0x4cc9f0, label: () => m.labelFor('spot', 'scan'), highlight: () => m.wants('spot', 'scan'), action: () => m.openSpot('scan') },
    { id: 'table', x: tx, y: 1.6, z: tz + 1.6, radius: 1.8, color: 0xffc93c, label: () => m.labelFor('table'), highlight: () => m.wants('table'), action: () => m.openTable() }
  ];

  return {
    name: 'office', title: 'Oficina ICADEM', group: g, collision: col, interactables, npcs: [paola, ...staff],
    background: 0x1a2438, fog: null,
    spawns: { default: { x: 0, z: 5.4, yaw: Math.PI } },
    camera: { distance: 6.2, minDistance: 2.4, maxDistance: 8.6, pitch: 0.5, yaw: 0, box: { minX: -8.6, maxX: 8.6, minZ: -6.6, maxZ: 10, maxY: 6.2 } },
    update(dt, t) {
      const a = m.attempt;
      for (const sp of SPOTS) { const dr = drawers[sp.id]; if (!dr) continue; const open = a.searched.includes(sp.id) ? 0.45 : 0; dr.position.z += ((-D / 2 + 0.85 + open) - dr.position.z) * Math.min(1, dt * 4); }
      for (const c of CABINETS) drawers['folder-' + c.id].visible = a.filed === c.id;
      scanSheet.visible = !a.taken.includes('fac');
      scanLight.position.x = sx - 0.3 + Math.sin(t * 2) * 0.3;
      screen.material.color.setHex(a.indexed ? 0x1f7a55 : (Math.sin(t * 3) > 0 ? 0x2b6cb0 : 0x1f4f8a));
      hand.rotation.z = -t * 0.2;
      const ordered = a.order.length > 0 && !a.filed;
      DOCS.forEach(d => {
        const c = cards[d.id], i = a.order.indexOf(d.id);
        c.visible = a.taken.includes(d.id) && !a.filed;
        if (!c.visible) return;
        if (ordered && i >= 0) { c.position.set(tx - 1.4 + i * 0.45, 0.84, tz + 0.2); c.rotation.y = 0; }
        else { const [x, z, r] = c.userData.pile; c.position.set(x, 0.84 + DOCS.indexOf(d) * 0.002, z); c.rotation.y = r; }
      });
      const fl = { oc: a.flags.includes('monto'), fac: a.flags.includes('monto') || a.flags.includes('cantidad'), rec: a.flags.includes('cantidad') };
      for (const id of Object.keys(flagsM)) { const f = flagsM[id], c = cards[id]; f.visible = fl[id] && c.visible; if (f.visible) f.position.set(c.position.x + 0.1, 0.86, c.position.z - 0.15); }
      binder.visible = Boolean(a.resolution) && !a.filed;
    }
  };
}
