// Escenario 13 · Parque de retos (al sur de la plaza). Minijuego A: «Carrera del conocimiento».
// Circuito con plataformas para saltar, barras giratorias para esquivar y siete puntos de control.
// El servidor valida cada punto con la posición (y la altura) que ya comprobó de cada jugador.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { RACE } from '../edu/activities.js';
import { mat, box, cyl, slab, plane, sign, grassTexture, pavingTexture, tree, bush, flowers, sunLight, skyDome, cloud, mergeStatic } from './kit.js';

/** Plataformas del circuito: { x, z, w, d, top } (las usa la física del jugador). */
export const PARK_PLATFORMS = Object.freeze([
  { x: -3, z: 6, w: 1.8, d: 1.8, top: 0.5 }, { x: -6, z: 3, w: 2.6, d: 2.6, top: 0.9 },
  { x: -4.2, z: -7.2, w: 1.8, d: 1.8, top: 0.55 }, { x: -2, z: -8.5, w: 1.6, d: 1.6, top: 1.0 }, { x: 0, z: -8.5, w: 2.6, d: 2.6, top: 1.5 },
  { x: 7.6, z: 0.2, w: 1.8, d: 1.8, top: 0.6 }, { x: 6, z: 3.4, w: 2.6, d: 2.6, top: 1.2 },
  { x: 0, z: 0, w: 3.2, d: 3.2, top: 0.4 }
]);
/** Barras giratorias: { x, z, len, speed } — tocan a quien va por el suelo y lo empujan. */
const SWEEPERS = [{ x: -7.4, z: -0.6, len: 2.8, speed: 1.5 }, { x: 4.4, z: -6.6, len: 3.0, speed: -1.7 }];
const COLORS = [0xff6b6b, 0xffd166, 0x4cc9f0, 0x7bd389, 0xb388ff, 0xff9f43, 0x2f9e8f, 0xf2b93b];

export function buildPark(api) {
  const g = new THREE.Group(), S = 12;
  const col = new CollisionWorld().setBounds(-S + 0.4, -S + 0.4, S - 0.4, S - 0.4);
  g.add(skyDome(0x4aa3f5, 0xcdeeff, 0xbfe7c7));
  for (let i = 0; i < 5; i++) cloud(-40 + i * 20, 26 + (i % 2) * 6, -30 + (i % 3) * 20, g, 1.1);
  const ground = plane(60, 60, mat(0xffffff, { map: grassTexture(12, 12), r: 1 }), 0, 0, 0, g, { rx: -Math.PI / 2 }); ground.receiveShadow = true;
  // camino del circuito
  const path = mat(0xffffff, { map: pavingTexture(3, 3, '#f3e2c2', '#ead3ab', '#d9c093'), r: 0.9 });
  const segs = RACE.checkpoints.concat([RACE.checkpoints[0]]);
  for (let i = 0; i + 1 < segs.length - 1; i++) {
    const [ax, az] = segs[i], [bx, bz] = segs[i + 1], len = Math.hypot(bx - ax, bz - az);
    const m = plane(2.2, len + 2.2, path, (ax + bx) / 2, 0.01, (az + bz) / 2, g, { rx: -Math.PI / 2 }); m.rotation.z = -Math.atan2(bx - ax, bz - az); m.receiveShadow = true;
  }
  // cerca y entrada
  const fence = mat(0xffffff, { r: 0.7 });
  for (let i = -S; i <= S; i += 2) for (const [x, z] of [[i, -S], [-S, i], [S, i]]) box(0.12, 0.8, 0.12, fence, x, 0, z, g, { cast: false });
  for (const [x, z, w, d] of [[0, -S, 2 * S, 0.08], [-S, 0, 0.08, 2 * S], [S, 0, 0.08, 2 * S]]) box(w, 0.08, d, fence, x, 0.62, z, g, { cast: false });
  for (const s of [-1, 1]) { box(0.16, 3.4, 0.16, mat(0x2f9e8f), s * 2.8, 0, S, g); box(S - 2.8, 0.08, 0.08, fence, s * (S + 2.8) / 2, 0.62, S, g, { cast: false }); }
  box(5.76, 0.22, 0.16, mat(0x2f9e8f), 0, 3.3, S, g, { cast: false });
  const title = sign('PARQUE DE RETOS', 3.0, 0.46, { bg: '#ffd166', fg: '#0f1f3d' }); title.position.set(0, 3.82, S - 0.05); title.rotation.y = Math.PI; g.add(title);

  // plataformas de colores
  PARK_PLATFORMS.forEach((p, i) => {
    slab(p.w, p.d, p.top, 0.25, mat(COLORS[i % COLORS.length], { r: 0.55 }), p.x, 0, p.z, g);
    box(p.w + 0.08, 0.06, p.d + 0.08, mat(0xffffff, { r: 0.5 }), p.x, p.top - 0.03, p.z, g, { cast: false });
  });
  // barras giratorias
  const sweepers = SWEEPERS.map(sw => {
    cyl(0.35, 0.45, 0.6, mat(0x1d2433, { r: 0.5 }), sw.x, 0, sw.z, g, { seg: 12 });
    const arm = new THREE.Group(); arm.position.set(sw.x, 0.55, sw.z); arm.userData.dynamic = true; g.add(arm);
    const bar = box(sw.len * 2, 0.22, 0.22, mat(0xff6b6b, { r: 0.4, own: true }), 0, -0.11, 0, arm); bar.userData.dynamic = true;
    for (const s of [-1, 1]) box(0.3, 0.3, 0.3, mat(0xffd166), s * sw.len, -0.15, 0, arm);
    col.addCircle(sw.x, sw.z, 0.45);
    return { ...sw, arm, angle: 0 };
  });
  // puntos de control: arcos con número; el siguiente brilla
  const gates = RACE.checkpoints.map(([x, z, y], i) => {
    const grp = new THREE.Group(); grp.position.set(x, y || 0, z); grp.userData.dynamic = true; g.add(grp);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, toneMapped: false }));
    ring.position.y = 1.35; grp.add(ring);
    const num = sign(i === RACE.checkpoints.length - 1 ? 'META' : i === 0 ? 'SALIDA' : String(i), i === 0 || i === RACE.checkpoints.length - 1 ? 1.2 : 0.6, 0.42, { bg: '#0f1f3d', fg: '#ffd166' });
    num.position.y = 2.75; grp.add(num);
    // Carrera del Saber: barrera con pregunta en los arcos 2 y 5 (se abre con una respuesta correcta)
    let barrier = null;
    if (i === 2 || i === 5) {
      barrier = new THREE.Group(); barrier.position.y = 1.35; grp.add(barrier);
      barrier.add(new THREE.Mesh(new THREE.CircleGeometry(1.08, 32), new THREE.MeshBasicMaterial({ color: 0x8a5fd0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })));
      const qs = sign('?', 0.6, 0.6, { bg: '#ffd166', fg: '#2a1c55', radius: 0.3 }); qs.position.z = 0.02; barrier.add(qs);
      const qb = sign('?', 0.6, 0.6, { bg: '#ffd166', fg: '#2a1c55', radius: 0.3 }); qb.position.z = -0.02; qb.rotation.y = Math.PI; barrier.add(qb);
      barrier.visible = false;
    }
    return { grp, ring, num, barrier };
  });
  // árboles, arbustos y flores alrededor
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 9], [10, 9], [-10.4, 0], [10.4, -3]]) { tree(x, z, g); col.addCircle(x, z, 0.6); }
  for (const [x, z] of [[-3, 10], [3, 10], [-9, 5], [9, -9], [-8, -10]]) bush(x, z, g, 0x58b565, 1);
  for (const [x, z] of [[-4.5, 10.4], [4.5, 10.4], [9.5, 6], [-9.5, -6]]) flowers(x, z, g);
  // banderines de colores en la cerca del fondo
  for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 3), mat(COLORS[i % COLORS.length], { r: 0.6 })); f.rotation.x = Math.PI; f.position.set(-S + 1 + i * 2, 1.1, -S); g.add(f); }

  g.add(new THREE.HemisphereLight(0xdff1ff, 0x8fbf7a, 1.15));
  sunLight(g, { x: 14, y: 26, z: 10, intensity: 2.2, area: 18 });
  mergeStatic(g);

  const games = () => api.games;
  const interactables = [
    { id: 'exit', x: 0, y: 2.1, z: S - 1.2, radius: 1.8, color: 0x2f9e8f, label: 'Volver a la plaza', action: () => { games()?.raceQuit(true); api.travel('plaza', 'park'); } },
    { id: 'start', x: 2.4, y: 1.6, z: 9.2, radius: 1.6, color: 0xffd166, label: () => games()?.raceLabel() || 'Carrera del conocimiento', action: () => games()?.raceStartUI() }
  ];

  return {
    name: 'park', title: 'Parque de retos', group: g, collision: col, interactables, npcs: [], platforms: PARK_PLATFORMS,
    background: 0x9fd3ff, fog: null,
    spawns: { default: { x: 0, z: 10.2, yaw: Math.PI } },
    camera: { distance: 7.2, minDistance: 3, maxDistance: 10, pitch: 0.5, yaw: 0, box: { minX: -14, maxX: 14, minZ: -14, maxZ: 17, maxY: 12 } },
    /** Barreras de la Carrera del Saber: cerradas mientras haya carrera y no se hayan respondido. */
    barrierOpen(i) { const b = gates[i] && gates[i].barrier; return !b || !b.visible; },
    update(dt, t, p) {
      const next = games()?.raceNext ?? -1, open = games()?.race?.open || {}, racing = next >= 0;
      gates.forEach((gt, i) => { if (!gt.barrier) return; const closed = racing && !open[i]; if (closed) { gt.barrier.visible = true; gt.barrier.scale.setScalar(1); } else if (gt.barrier.visible) { gt.barrier.scale.multiplyScalar(0.85); gt.barrier.position.y += dt * 2; if (gt.barrier.scale.x < 0.05) { gt.barrier.visible = false; gt.barrier.position.y = 1.35; } } });
      gates.forEach((gt, i) => { const on = i === next; gt.ring.material.color.setHex(on ? 0xffd166 : i < next ? 0x7bd389 : 0xffffff); gt.ring.material.opacity = on ? 0.95 : 0.45; gt.ring.rotation.y = t * (on ? 1.8 : 0.4); gt.ring.scale.setScalar(on ? 1 + Math.sin(t * 5) * 0.05 : 1); });
      // barras: giran y empujan a quien las toca por el suelo
      for (const sw of sweepers) {
        sw.angle += sw.speed * dt; sw.arm.rotation.y = sw.angle;
        if (!p || p.y > 0.95) continue;
        const ax = Math.cos(sw.angle), az = -Math.sin(sw.angle), rx = p.x - sw.x, rz = p.z - sw.z;
        const along = Math.max(-sw.len, Math.min(sw.len, rx * ax + rz * az)), cx = sw.x + ax * along, cz = sw.z + az * along, d = Math.hypot(p.x - cx, p.z - cz);
        if (d < 0.55 && Math.abs(along) > 0.4) {
          const pl = api.player, nx = (p.x - cx) / (d || 1), nz = (p.z - cz) / (d || 1);
          pl.vx = nx * 5.5; pl.vz = nz * 5.5; pl.vy = 3.6; pl.grounded = false; p.x += nx * 0.2; p.z += nz * 0.2;
          games()?.raceBump();
        }
      }
    }
  };
}
