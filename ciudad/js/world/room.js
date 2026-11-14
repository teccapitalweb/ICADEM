// Escenario 1 · Habitación del jugador: el punto de partida de Ciudad ICADEM.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { mat, box, cyl, sph, plane, slab, sign, plankTexture, bush, sunLight, mergeStatic } from './kit.js';

export function buildRoom(api) {
  const g = new THREE.Group();
  const col = new CollisionWorld().setBounds(-4.5, -4, 4.5, 4);
  const W = 9, D = 8, H = 3.3;

  /* estructura: paredes de una sola cara, así la cámara puede salir del cuarto sin tapar la vista */
  const floor = plane(W, D, mat(0xffffff, { map: plankTexture(3, 3), r: 0.7 }), 0, 0, 0, g, { rx: -Math.PI / 2 });
  floor.receiveShadow = true;
  const wallA = mat(0xfde9c9, { r: 0.95 }), wallB = mat(0xf7dcb4, { r: 0.95 }), base = mat(0xffffff, { r: 0.6 });
  plane(W, H, wallA, 0, H / 2, -D / 2, g);
  plane(W, H, wallA, 0, H / 2, D / 2, g, { ry: Math.PI });
  plane(D, H, wallB, -W / 2, H / 2, 0, g, { ry: Math.PI / 2 });
  plane(D, H, wallB, W / 2, H / 2, 0, g, { ry: -Math.PI / 2 });
  box(W, 0.14, 0.05, base, 0, 0, -D / 2 + 0.025, g, { cast: false });
  box(0.05, 0.14, D, base, -W / 2 + 0.025, 0, 0, g, { cast: false });
  box(0.05, 0.14, D, base, W / 2 - 0.025, 0, 0, g, { cast: false });
  // franja decorativa
  box(W, 0.08, 0.03, mat(0x2f9e8f), 0, 2.35, -D / 2 + 0.02, g, { cast: false });

  /* ventana con vista */
  const winX = -2.6;
  box(2.1, 1.5, 0.08, mat(0xffffff, { r: 0.5 }), winX, 1.15, -D / 2 + 0.04, g, { cast: false });
  const skyTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#6db8ff'); gr.addColorStop(0.7, '#c9ecff'); gr.addColorStop(1, '#9bd68a');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 192);
    x.fillStyle = '#fff'; for (const [cx, cy, r] of [[60, 50, 18], [82, 46, 22], [104, 52, 16], [190, 70, 14], [208, 66, 18]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    x.fillStyle = '#f2b93b'; x.fillRect(150, 120, 38, 72); x.fillStyle = '#e86a5c'; x.fillRect(40, 132, 44, 60); x.fillStyle = '#4fb8a8'; x.fillRect(96, 110, 34, 82);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  plane(1.9, 1.3, new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false }), winX, 1.8, -D / 2 + 0.085, g);
  box(0.05, 1.3, 0.04, mat(0xffffff), winX, 1.15, -D / 2 + 0.1, g, { cast: false });
  box(1.9, 0.05, 0.04, mat(0xffffff), winX, 1.78, -D / 2 + 0.1, g, { cast: false });
  box(2.3, 0.07, 0.22, mat(0xffffff), winX, 1.08, -D / 2 + 0.12, g);
  for (const s of [-1, 1]) box(0.34, 1.75, 0.06, mat(0x2f9e8f, { r: 0.9 }), winX + s * 1.2, 1.0, -D / 2 + 0.13, g);
  box(2.9, 0.07, 0.07, mat(0x8a5a36), winX, 2.78, -D / 2 + 0.13, g, { cast: false });

  /* cama */
  const bed = new THREE.Group(); bed.position.set(-3.2, 0, 2.0); g.add(bed);
  slab(2.0, 2.9, 0.34, 0.14, mat(0xc98f56), 0, 0.06, 0, bed);
  slab(1.86, 2.76, 0.24, 0.2, mat(0xffffff, { r: 0.9 }), 0, 0.4, 0, bed);
  slab(1.9, 1.9, 0.1, 0.2, mat(0x3f7fd9, { r: 0.95 }), 0, 0.6, 0.42, bed);
  box(1.9, 0.12, 0.3, mat(0xf2b93b, { r: 0.95 }), 0, 0.6, -0.42, bed);
  slab(0.8, 0.5, 0.16, 0.16, mat(0xffffff, { r: 0.95 }), -0.42, 0.62, -1.02, bed);
  slab(0.8, 0.5, 0.16, 0.16, mat(0xffe2a8, { r: 0.95 }), 0.42, 0.62, -1.02, bed);
  slab(2.1, 0.16, 1.15, 0.08, mat(0xb9793f), 0, 0, -1.48, bed);
  col.addBoxAt(-3.2, 2.0, 2.0, 2.9);
  // buró y lámpara
  box(0.6, 0.55, 0.5, mat(0xc98f56), -1.75, 0, 3.4, g);
  box(0.5, 0.03, 0.02, mat(0x8a5a36), -1.75, 0.3, 3.14, g, { cast: false });
  cyl(0.07, 0.11, 0.3, mat(0xffffff), -1.75, 0.55, 3.4, g, { seg: 12 });
  cyl(0.14, 0.22, 0.26, mat(0xffe2a8, { e: 0xffc76b, ei: 0.9, r: 0.6 }), -1.75, 0.85, 3.4, g, { seg: 16, cast: false });
  col.addBoxAt(-1.75, 3.4, 0.6, 0.5);

  /* escritorio de misiones */
  const dx = 0.2, dz = -3.45;
  box(2.0, 0.07, 0.85, mat(0xd9a066, { r: 0.6 }), dx, 0.76, dz, g);
  for (const [lx, lz] of [[-0.9, -0.34], [0.9, -0.34], [-0.9, 0.34], [0.9, 0.34]]) box(0.07, 0.76, 0.07, mat(0x8a5a36), dx + lx, 0, dz + lz, g);
  box(0.62, 0.03, 0.42, mat(0xdfe4ee, { m: 0.4, r: 0.4 }), dx - 0.3, 0.83, dz + 0.06, g);
  const screen = box(0.62, 0.42, 0.03, mat(0x16213a, { r: 0.4, own: true }), dx - 0.3, 0.86, dz - 0.16, g, { rx: -0.2 });
  plane(0.56, 0.36, new THREE.MeshBasicMaterial({ color: 0x4cc9f0, toneMapped: false }), dx - 0.3, 1.07, dz - 0.135, g, { rx: -0.2 });
  cyl(0.06, 0.05, 0.12, mat(0xe86a5c), dx + 0.55, 0.83, dz + 0.1, g, { seg: 12 });
  box(0.3, 0.04, 0.22, mat(0xf2b93b), dx + 0.6, 0.83, dz - 0.18, g, { ry: 0.3 });
  // corcho con misiones
  box(1.9, 1.0, 0.05, mat(0xc99a5b, { r: 1 }), dx, 1.45, -D / 2 + 0.03, g, { cast: false });
  const s1 = sign('MISIONES', 1.1, 0.26, { bg: '#12325f', fg: '#ffd166' }); s1.position.set(dx, 2.26, -D / 2 + 0.07); g.add(s1);
  for (const [nx, ny, c, r] of [[-0.6, 1.95, 0xffe08a, 0.08], [0, 2.0, 0x9be7c4, -0.05], [0.6, 1.93, 0xffb3a7, 0.06], [-0.3, 1.63, 0xb8d8ff, -0.07], [0.35, 1.62, 0xffe08a, 0.04]]) {
    plane(0.42, 0.3, mat(c, { r: 1 }), dx + nx, ny, -D / 2 + 0.065, g, { rz: r });
    sph(0.022, mat(0xe8483f), dx + nx, ny + 0.12, -D / 2 + 0.08, g, { seg: 8, rings: 6, cast: false });
  }
  // silla
  slab(0.5, 0.5, 0.08, 0.1, mat(0x2f9e8f), dx - 0.2, 0.45, dz + 0.85, g);
  cyl(0.04, 0.04, 0.45, mat(0x263248, { m: 0.4 }), dx - 0.2, 0, dz + 0.85, g, { seg: 10 });
  cyl(0.24, 0.26, 0.04, mat(0x263248, { m: 0.4 }), dx - 0.2, 0, dz + 0.85, g, { seg: 14 });
  slab(0.5, 0.08, 0.55, 0.04, mat(0x2f9e8f), dx - 0.2, 0.5, dz + 1.1, g);
  col.addBoxAt(dx, dz, 2.0, 0.9); col.addCircle(dx - 0.2, dz + 0.9, 0.3);

  /* armario de skins */
  const wx = 3.95, wz = -1.4;
  box(1.0, 2.4, 1.9, mat(0xb9793f, { r: 0.7 }), wx, 0, wz, g);
  for (const s of [-1, 1]) {
    box(0.04, 2.15, 0.86, mat(0xd9a066, { r: 0.6 }), wx - 0.5, 0.12, wz + s * 0.45, g, { cast: false });
    cyl(0.03, 0.03, 0.22, mat(0xffd166, { m: 0.6, r: 0.3 }), wx - 0.55, 1.1, wz + s * 0.08, g, { seg: 8 });
  }
  box(1.1, 0.08, 2.0, mat(0x8a5a36), wx, 2.4, wz, g);
  col.addBoxAt(wx, wz, 1.0, 1.9);

  /* espejo */
  const mz = 1.5;
  box(0.07, 2.1, 1.15, mat(0xffd166, { m: 0.5, r: 0.35 }), W / 2 - 0.04, 0.25, mz, g);
  const glass = plane(0.98, 1.92, new THREE.MeshStandardMaterial({ color: 0xcfe9ff, roughness: 0.08, metalness: 0.9, emissive: 0x6fb6e8, emissiveIntensity: 0.28 }), W / 2 - 0.085, 1.3, mz, g, { ry: -Math.PI / 2 });
  for (let i = 0; i < 3; i++) plane(0.06, 1.2 - i * 0.3, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }), W / 2 - 0.09, 1.3 + i * 0.1, mz - 0.25 + i * 0.16, g, { ry: -Math.PI / 2, rx: 0.5 });

  /* panel de logros */
  const az = -0.9;
  box(0.06, 1.25, 1.7, mat(0x12325f, { r: 0.6 }), -W / 2 + 0.03, 1.2, az, g, { cast: false });
  const s2 = sign('LOGROS', 0.95, 0.24, { bg: '#f2b93b', fg: '#12325f' }); s2.position.set(-W / 2 + 0.07, 2.25, az); s2.rotation.y = Math.PI / 2; g.add(s2);
  box(0.26, 0.05, 1.5, mat(0xd9a066), -W / 2 + 0.16, 1.32, az, g);
  box(0.26, 0.05, 1.5, mat(0xd9a066), -W / 2 + 0.16, 1.82, az, g);
  const trophies = [];
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Group(); t.userData.dynamic = true; t.position.set(-W / 2 + 0.17, i < 2 ? 1.37 : 1.87, az - 0.5 + (i % 2) * 0.95 + (i > 1 ? 0.05 : 0)); g.add(t);
    cyl(0.07, 0.09, 0.04, mat(0x263248), 0, 0, 0, t, { seg: 12 });
    cyl(0.02, 0.02, 0.08, mat(0xffd166, { m: 0.7, r: 0.3 }), 0, 0.04, 0, t, { seg: 8 });
    cyl(0.085, 0.045, 0.13, mat(0xffd166, { m: 0.7, r: 0.3 }), 0, 0.12, 0, t, { seg: 14 });
    trophies.push(t);
  }
  box(1.0, 0.5, 1.5, mat(0xc98f56), -W / 2 + 0.5, 0, az, g);
  col.addBoxAt(-W / 2 + 0.5, az, 1.0, 1.5);

  /* tapete, planta, cuadro */
  const rug = cyl(1.7, 1.7, 0.025, mat(0xf2b93b, { r: 1 }), 0.4, 0.001, 0.4, g, { seg: 40, cast: false });
  cyl(1.3, 1.3, 0.03, mat(0xfff3d6, { r: 1 }), 0.4, 0.002, 0.4, g, { seg: 40, cast: false });
  cyl(0.85, 0.85, 0.035, mat(0x2f9e8f, { r: 1 }), 0.4, 0.003, 0.4, g, { seg: 40, cast: false });
  cyl(0.3, 0.22, 0.42, mat(0xe86a5c), 3.9, 0, 3.4, g, { seg: 16 });
  bush(3.9, 3.4, g, 0x4fae5a, 0.95).position.y = 0.42;
  col.addCircle(3.9, 3.4, 0.4);
  plane(0.9, 0.7, mat(0xffffff), 1.3, 1.95, D / 2 - 0.03, g, { ry: Math.PI });
  plane(0.78, 0.58, mat(0x4cc9f0, { r: 1 }), 1.3, 1.95, D / 2 - 0.04, g, { ry: Math.PI });

  /* puerta a la ciudad */
  const px = 2.9;
  box(1.28, 2.3, 0.1, mat(0xffffff, { r: 0.5 }), px, 0, -D / 2 + 0.05, g, { cast: false });
  const door = box(1.08, 2.14, 0.08, mat(0xe86a5c, { r: 0.55, own: true }), px, 0, -D / 2 + 0.09, g, { cast: false });
  for (const y of [0.3, 1.2]) box(0.76, 0.7, 0.03, mat(0xf08a7c, { r: 0.55 }), px, y, -D / 2 + 0.135, g, { cast: false });
  sph(0.06, mat(0xffd166, { m: 0.7, r: 0.25 }), px + 0.4, 1.05, -D / 2 + 0.17, g, { seg: 12 });
  const s3 = sign('CIUDAD', 0.9, 0.24, { bg: '#2f9e8f', fg: '#ffffff' }); s3.position.set(px, 2.52, -D / 2 + 0.07); g.add(s3);
  slab(1.3, 0.7, 0.03, 0.1, mat(0x2f9e8f, { r: 1 }), px, 0.002, -D / 2 + 0.75, g, { cast: false });

  /* puerta interior a «Mi casa» (Mundo vivo) en la pared sur */
  const hx = -0.35;
  box(1.2, 2.3, 0.08, mat(0xffffff, { r: 0.5 }), hx, 0, D / 2 - 0.04, g, { cast: false });
  const homeDoor = box(1.0, 2.14, 0.06, mat(0xf2b93b, { r: 0.55, own: true }), hx, 0, D / 2 - 0.08, g, { cast: false });
  sph(0.055, mat(0x8a5a36), hx - 0.36, 1.05, D / 2 - 0.13, g, { seg: 10 });
  const s4 = sign('MI CASA', 0.9, 0.24, { bg: '#f2b93b', fg: '#12325f' }); s4.position.set(hx, 2.48, D / 2 - 0.07); s4.rotation.y = Math.PI; g.add(s4);

  /* luces */
  g.add(new THREE.HemisphereLight(0xfff4de, 0xb98a5a, 1.25));
  const sun = sunLight(g, { x: -5, y: 9, z: 6, intensity: 1.7, color: 0xfff0d0, area: 9 });
  sun.target.position.set(0, 0, 0);
  const warm = new THREE.PointLight(0xffc76b, 6, 6, 1.8); warm.position.set(-1.75, 1.25, 3.4); g.add(warm);

  mergeStatic(g);

  const interactables = [
    { id: 'door', x: px, y: 1.2, z: -D / 2 + 0.6, radius: 1.5, label: 'Salir a la ciudad', color: 0x2f9e8f, action: () => api.travel('plaza', 'home') },
    { id: 'desk', x: dx, y: 1.3, z: dz + 0.9, radius: 1.6, label: 'Ver misiones', color: 0xffc93c, action: () => api.ui.openMissions() },
    { id: 'wardrobe', x: wx - 0.9, y: 1.4, z: wz, radius: 1.5, label: 'Abrir vestidor', action: () => api.ui.openWardrobe() },
    { id: 'mirror', x: W / 2 - 0.9, y: 1.4, z: mz, radius: 1.4, label: 'Mirarte al espejo', action: () => api.mirror(new THREE.Vector3(W / 2 - 0.25, 1.35, mz), { x: W / 2 - 2.6, z: mz }) },
    { id: 'achievements', x: -W / 2 + 1.3, y: 1.5, z: az, radius: 1.5, label: 'Ver logros', action: () => api.ui.openPassport('logros') },
    { id: 'bed', x: -1.9, y: 0.9, z: 2.0, radius: 1.3, label: 'Descansar', action: () => api.sit({ x: -2.35, z: 2.3, yaw: Math.PI / 2, seatY: 0.34 }) },
    { id: 'casa', x: hx, y: 1.2, z: D / 2 - 0.7, radius: 1.3, label: 'Ir a Mi casa', color: 0xf2b93b, action: () => api.travel('casa', 'default') }
  ];

  return {
    name: 'room', title: 'Tu habitación', group: g, collision: col, interactables, npcs: [],
    background: 0x2a2233, fog: null,
    spawns: { default: { x: 0.4, z: 1.4, yaw: Math.PI }, door: { x: px, z: -D / 2 + 1.3, yaw: 0 }, casa: { x: hx, z: D / 2 - 1.3, yaw: Math.PI } },
    camera: { distance: 5.2, minDistance: 2.2, maxDistance: 6.5, pitch: 0.5, yaw: 0, box: { minX: -6.3, maxX: 6.3, minZ: -5.6, maxZ: 6.6, maxY: 5.2 } },
    update(dt, t) {
      trophies.forEach((tr, i) => { tr.visible = api.store.state.achievements.length > i; });
      glass.material.emissiveIntensity = 0.26 + Math.sin(t * 1.4) * 0.04;
      door.material.emissive.setHex(0x331511); door.material.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.3;
      homeDoor.material.emissive.setHex(0x332611); homeDoor.material.emissiveIntensity = 0.35 + Math.sin(t * 2.2 + 1) * 0.25;
      screen.material.emissiveIntensity = 1;
    }
  };
}
