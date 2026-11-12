// Escenario 12 · Torre ICADEM, piso 21 (índigo y cristal), misión 10: «Desafío de equipos».
// Sala de retos con vista a la ciudad, cuatro estaciones de especialidad con pantallas que se
// encienden al completarse, tablero central del plan integrado con luces de aprobación,
// coordinadora y elevadores. En equipo, los integrantes se ven entre sí (privacidad de sala).
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { STATIONS } from '../missions/tower-challenge-logic.js';
import { mat, box, cyl, ico, plane, slab, sign, checkerTexture, sunLight, mergeStatic } from './kit.js';

const SPOT = { budget: [-5.6, -3.6], permits: [5.6, -3.6], schedule: [-5.6, 2.0], message: [5.6, 2.0] };

export function buildTower(api) {
  const g = new THREE.Group();
  const W = 18, D = 14, H = 4.6;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const indigo = mat(0x3a43a8, { r: 0.55 }), dark = mat(0x1d2433, { r: 0.5 }), white = mat(0xf6f7fb, { r: 0.6 }), steel = mat(0xc4ccd6, { m: 0.6, r: 0.3 });

  /* estructura: piso pulido, muros y ventanal al norte */
  const floor = plane(W, D, mat(0xffffff, { map: checkerTexture(9, 7, '#e9ebf5', '#dfe2f0', 'rgba(255,255,255,.4)'), r: 0.3 }), 0, 0, 0, g, { rx: -Math.PI / 2 }); floor.receiveShadow = true;
  plane(W + 8, 7, mat(0x2b3150, { r: 0.8 }), 0, -0.01, D / 2 + 3.5, g, { rx: -Math.PI / 2 });
  const wallM = mat(0xeef0f8, { r: 0.9 });
  plane(W, H, wallM, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, wallM, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 }); plane(D, H, wallM, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  for (const [w, x, z, ry] of [[D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, -Math.PI / 2], [W, 0, D / 2 - 0.02, Math.PI]]) plane(w, 0.18, indigo, x, 0.09, z, g, { ry, cast: false });
  // ventanal con el horizonte de la ciudad
  const sky = plane(W, H, new THREE.MeshBasicMaterial({ color: 0x9fd0ff, toneMapped: false }), 0, H / 2, -D / 2 - 6, g); sky.userData.dynamic = true;
  for (let i = 0; i < 16; i++) { const bw = 1.2 + (i * 7 % 5) * 0.4, bh = 1.0 + (i * 13 % 7) * 0.45; box(bw, bh, 0.6, mat([0x7f8cf5, 0x5ec8e6, 0xa8b4c8, 0x8fd4a8][i % 4], { r: 0.8 }), -9 + i * 1.2, -0.2, -D / 2 - 4 - (i % 3), g, { cast: false }); }
  box(W + 6, 0.2, 6, mat(0x58b565, { r: 1 }), 0, -0.5, -D / 2 - 4, g, { cast: false });
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.3, depthWrite: false });
  const pane = plane(W, H, glass, 0, H / 2, -D / 2, g); pane.userData.dynamic = true;
  for (let i = 0; i <= 6; i++) box(0.12, H, 0.12, dark, -W / 2 + i * (W / 6), 0, -D / 2, g, { cast: false });
  box(W, 0.15, 0.2, dark, 0, H - 0.15, -D / 2, g, { cast: false }); box(W, 0.4, 0.3, dark, 0, 0, -D / 2 + 0.1, g, { cast: false });
  const title = sign('TORRE ICADEM · PISO 21 · SALA DE RETOS', 5.4, 0.46, { bg: '#3a43a8', fg: '#ffd166' }); title.position.set(0, 3.9, D / 2 - 0.06); title.rotation.y = Math.PI; g.add(title);

  /* elevadores (salida) */
  for (const s of [-1, 1]) {
    const x = s * 2.2;
    plane(1.7, 2.7, mat(0xa8b4c8, { m: 0.7, r: 0.25 }), x, 1.35, D / 2 - 0.03, g, { ry: Math.PI });
    box(1.9, 0.12, 0.08, dark, x, 2.7, D / 2 - 0.05, g, { cast: false });
    const ind = sign('▲ 21', 0.6, 0.24, { bg: '#1d2433', fg: '#5dff9e' }); ind.position.set(x, 3.0, D / 2 - 0.07); ind.rotation.y = Math.PI; g.add(ind);
  }
  const exitSign = sign('ELEVADORES · SALIDA', 2.0, 0.32, { bg: '#1f7a55', fg: '#ffffff' }); exitSign.position.set(0, 3.35, D / 2 - 0.07); exitSign.rotation.y = Math.PI; g.add(exitSign);

  /* estaciones de especialidad */
  const screens = {}, rings = {};
  for (const st of STATIONS) {
    const [x, z] = SPOT[st.id], hex = '#' + st.color.toString(16).padStart(6, '0');
    slab(2.8, 1.4, 0.9, 0.35, white, x, 0, z, g);
    box(2.9, 0.06, 1.5, mat(st.color, { r: 0.5 }), x, 0.9, z, g, { cast: false });
    const scr = plane(1.9, 1.1, new THREE.MeshBasicMaterial({ color: 0x1d2433, toneMapped: false }), x, 1.75, z - 0.45, g); scr.userData.dynamic = true; screens[st.id] = scr;
    box(2.1, 1.3, 0.06, dark, x, 1.1, z - 0.5, g, { cast: false });
    const lab = sign(st.name.toUpperCase(), 2.6, 0.34, { bg: hex, fg: '#ffffff' }); lab.position.set(x, 2.65, z - 0.45); g.add(lab);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.35, 32), new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.35, toneMapped: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.02, z + 1.5); ring.userData.dynamic = true; g.add(ring); rings[st.id] = ring;
    col.addBoxAt(x, z, 2.9, 1.5);
  }

  /* tablero central del plan integrado */
  const bx = 0, bz = -1.0;
  cyl(1.6, 1.8, 0.8, indigo, bx, 0, bz, g, { seg: 24 });
  const holo = new THREE.Group(); holo.position.set(bx, 1.0, bz); holo.userData.dynamic = true; g.add(holo);
  const panels = {};
  STATIONS.forEach((st, i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ color: 0x2b3150, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }));
    const ang = i * Math.PI / 2; p.position.set(Math.sin(ang) * 0.9, 0.9, Math.cos(ang) * 0.9); p.rotation.y = ang; holo.add(p); panels[st.id] = p;
  });
  const core = ico(0.32, new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa53c, emissiveIntensity: 0.6, flatShading: true }), 0, 0.9, 0, holo, { detail: 0 }); core.userData.dynamic = true;
  const lights = [0, 1, 2, 3].map(i => { const l = sph4(i); return l; });
  function sph4(i) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3a4060, toneMapped: false })); m.position.set(-0.45 + i * 0.3, 0.82, bz + 1.62); m.userData.dynamic = true; g.add(m); return m; }
  const bsign = sign('PLAN INTEGRADO', 1.8, 0.3, { bg: '#3a43a8', fg: '#ffffff' }); bsign.position.set(bx, 2.75, bz); g.add(bsign);
  col.addCircle(bx, bz, 1.8);

  /* ambiente: sillones, plantas, luz */
  for (const [x, z, ry] of [[-7.6, 5.4, Math.PI / 2], [7.6, 5.4, -Math.PI / 2]]) { const s = slab(1.8, 0.8, 0.45, 0.3, mat(0xd9456f, { r: 0.8 }), x, 0, z, g); s.rotation.y = ry; col.addBoxAt(x, z, 0.9, 1.9); }
  for (const [x, z] of [[-8.2, -6.2], [8.2, -6.2], [-8.2, 0], [8.2, 0]]) { cyl(0.3, 0.24, 0.55, white, x, 0, z, g, { seg: 10 }); ico(0.52, mat(0x3f9a3a, { flat: true }), x, 1.0, z, g, { detail: 0 }); col.addCircle(x, z, 0.38); }
  for (const [x, z] of [[-5, -3], [5, -3], [-5, 2.5], [5, 2.5], [0, 4.4], [0, -1]]) {
    box(1.4, 0.05, 1.4, mat(0xffffff, { e: 0xf0f2ff, ei: 1.2, r: 0.5 }), x, H - 0.05, z, g, { cast: false });
    const pl = new THREE.PointLight(0xf3f0ff, 5, 9, 1.7); pl.position.set(x, H - 0.4, z); g.add(pl);
  }
  plane(W, D, mat(0xf6f7fb, { r: 0.9 }), 0, H, 0, g, { rx: Math.PI / 2 });
  g.add(new THREE.HemisphereLight(0xf2f4ff, 0xb9bfd8, 1.1));
  const sun = sunLight(g, { x: 3, y: 14, z: -10, intensity: 1.3, color: 0xfff3d6, area: 14 }); sun.target.position.set(0, 0, 0);

  const elena = new Npc({ look: { skin: 0xc98e63, hair: 0x23180f, hairStyle: 'bun', top: 0x3a43a8, topAccent: 0xffd166, bottom: 0x1d2a40, shoes: 0x1f1a17, accessories: ['lapels', 'badge'] }, x: 0, z: 3.2, yaw: 0 });
  const visitors = [new Npc({ look: { skin: 0xf0c7a4, hair: 0x6b4a2b, hairStyle: 'short', top: 0x2f9e8f, topAccent: 0xffffff, bottom: 0x27304a, shoes: 0x1f1a17, accessories: ['badge'] }, route: [[-3.2, 5.6], [3.2, 5.6], [3.2, 4.8], [-3.2, 4.8]], speed: 0.9, pause: 2.2 })];
  [elena, ...visitors].forEach(n => g.add(n.group));
  col.addCircle(0, 3.2, 0.4);

  /* módulo de equipos (sala de espera) */
  const kx = 4.8, kz = 5.4;
  box(0.7, 1.1, 0.5, indigo, kx, 0, kz, g); box(0.62, 0.42, 0.05, dark, kx, 1.15, kz - 0.1, g, { cast: false });
  const ksign = sign('EQUIPOS', 1.0, 0.28, { bg: '#ffd166', fg: '#3a43a8' }); ksign.position.set(kx, 1.95, kz - 0.26); ksign.rotation.y = Math.PI; g.add(ksign);
  col.addBoxAt(kx, kz, 0.8, 0.6);

  mergeStatic(g);
  const m = api.missions.tower;
  const interactables = [
    { id: 'exit', x: 0, y: 2.1, z: D / 2 - 0.6, radius: 1.8, color: 0x2f9e8f, label: 'Bajar a la ciudad', action: () => api.travel('plaza', 'tower') },
    { id: 'elena', x: 0, y: 2.0, z: 4.3, radius: 1.5, color: 0xffc93c, label: () => m.labelFor('coach'), highlight: () => m.wants('coach'), action: () => m.talkToCoach(elena) },
    { id: 'team', x: kx - 1.0, y: 1.8, z: kz - 0.6, radius: 1.2, color: 0x4cc9f0, label: () => m.coop ? `En equipo · ${m.coopRoleName}` : 'Jugar en equipo · sala de espera', action: () => api.social.openLobby('torre-desafio-equipos') },
    { id: 'board', x: bx, y: 2.0, z: bz + 2.2, radius: 1.3, color: 0xffc93c, label: () => m.labelFor('board'), highlight: () => m.wants('board'), action: () => m.openBoard() },
    ...STATIONS.map(st => { const [x, z] = SPOT[st.id]; return { id: 'st-' + st.id, x, y: 1.8, z: z + 1.5, radius: 1.3, color: st.color, label: () => m.labelFor('station', st.id), highlight: () => m.wants('station', st.id), action: () => m.openStation(st.id) }; })
  ];

  return {
    name: 'tower', title: 'Torre ICADEM', group: g, collision: col, interactables, npcs: [elena, ...visitors],
    background: 0x2b3150, fog: null,
    spawns: { default: { x: 0, z: 5.4, yaw: Math.PI } },
    camera: { distance: 6.4, minDistance: 2.4, maxDistance: 8.8, pitch: 0.5, yaw: 0, box: { minX: -8.6, maxX: 8.6, minZ: -6.4, maxZ: 10, maxY: 4.3 } },
    update(dt, t) {
      const a = m.attempt;
      holo.rotation.y += dt * 0.35; core.rotation.x += dt * 0.6; core.position.y = 0.9 + Math.sin(t * 2) * 0.06;
      for (const st of STATIONS) {
        const done = Boolean(a[st.id]), mine = m.wants('station', st.id);
        screens[st.id].material.color.setHex(done ? 0x1f7a55 : mine ? (Math.sin(t * 4) > 0 ? st.color : 0x1d2433) : 0x1d2433);
        panels[st.id].material.color.setHex(done ? st.color : 0x2b3150);
        rings[st.id].material.opacity = mine ? 0.45 + Math.sin(t * 4) * 0.3 : done ? 0.15 : 0.3;
      }
      lights.forEach((l, i) => l.material.color.setHex(i < a.approvals.length ? 0x5dff9e : 0x3a4060));
      core.material.emissiveIntensity = a.presented ? 1.6 : a.approvals.length ? 1.0 : 0.5;
    }
  };
}
