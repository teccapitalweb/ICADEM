// Escenario 6 · La obra en construcción (patio a cielo abierto), donde ocurre la misión 4:
// «Inspector de seguridad». Mismo patrón que el resto de interiores, pero en exterior.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { Npc } from '../characters/npc.js';
import { NPC_LOOKS } from '../characters/catalog.js';
import { SIGN_SPOT } from '../missions/site-inspector-logic.js';
import { mat, box, cyl, plane, slab, sign, pavingTexture, sunLight, mergeStatic } from './kit.js';

export function buildSite(api) {
  const g = new THREE.Group();
  const W = 26, D = 20;
  const col = new CollisionWorld().setBounds(-W / 2, -D / 2, W / 2, D / 2);
  const amber = mat(0xf2b93b, { r: 0.8 }), steelD = mat(0x6b7280, { m: 0.55, r: 0.4 });
  const wood = mat(0x8a5a36, { r: 0.7 }), woodLight = mat(0xc98f56, { r: 0.7 });
  const concrete = mat(0xb9bdc4, { r: 0.9 }), dirt = mat(0x9a7247, { r: 1 });

  /* suelo de tierra compactada con rodadas */
  const floor = plane(W, D, mat(0xffffff, { map: pavingTexture(10, 8, '#b08a5c', '#a37c4e', '#8f6a40'), r: 0.95 }), 0, 0, 0, g, { rx: -Math.PI / 2 });
  floor.receiveShadow = true;

  /* barda perimetral con franjas de precaución */
  const fence = (w, x, z, ry = 0) => {
    box(w, 2.2, 0.12, mat(0xd8dde4, { r: 0.9 }), x, 0, z, g, { ry, cast: false });
    box(w, 0.3, 0.14, amber, x, 1.55, z, g, { ry, cast: false });
  };
  fence(W, 0, -D / 2 + 0.06); fence(W / 2 - 2.2, -W / 4 - 1.1, D / 2 - 0.06); fence(W / 2 - 2.2, W / 4 + 1.1, D / 2 - 0.06);
  fence(D, -W / 2 + 0.06, 0, Math.PI / 2); fence(D, W / 2 - 0.06, 0, Math.PI / 2);
  // portón sur
  for (const s of [-1, 1]) box(0.3, 2.6, 0.3, steelD, s * 2.2, 0, D / 2 - 0.15, g);
  const gateSign = sign('OBRA · SOLO PERSONAL CON EPP', 4.0, 0.5, { bg: '#f2b93b', fg: '#1d2433' }); gateSign.position.set(0, 2.5, D / 2 - 0.2); gateSign.rotation.y = Math.PI; g.add(gateSign);

  /* caseta de obra (oriente, junto a la entrada): EPP y oficina */
  const cx = 9.5, cz = 6.3;
  box(3.4, 2.5, 2.4, mat(0x2b6cb0, { r: 0.8 }), cx, 0, cz, g);
  box(3.6, 0.18, 2.6, mat(0x1d4e85, { r: 0.8 }), cx, 2.5, cz, g, { cast: false });
  plane(0.9, 1.6, mat(0x17324f, { r: 0.6 }), cx - 1.2, 0.8, cz - 1.21, g, { ry: Math.PI });
  const casetaSign = sign('CASETA · EPP', 1.8, 0.36, { bg: '#ffffff', fg: '#1d4e85' }); casetaSign.position.set(cx, 2.15, cz - 1.25); casetaSign.rotation.y = Math.PI; g.add(casetaSign);
  col.addBoxAt(cx, cz, 3.6, 2.6);
  // perchero de EPP al costado
  const px = 7.2, pz = 6.3;
  box(0.1, 1.9, 1.4, wood, px, 0, pz, g);
  for (const [dy, c] of [[1.6, 0xf2b93b], [1.1, 0xff8f2b], [0.5, 0x2a2f3a]]) box(0.26, 0.3, 0.34, mat(c, { r: 0.7 }), px - 0.12, dy, pz - 0.35 + (1.6 - dy) * 0.45, g, { cast: false });
  col.addBoxAt(px, pz, 0.5, 1.5);

  /* tablero con el plano (frente a la caseta) */
  const bx = 9.5, bz = 3.6;
  for (const s of [-1, 1]) box(0.12, 1.9, 0.12, wood, bx + s * 0.95, 0, bz, g);
  const planBoard = box(2.1, 1.2, 0.08, woodLight, bx, 1.15, bz, g);
  const planFace = plane(1.9, 1.0, new THREE.MeshBasicMaterial({ color: 0xeef4ff, toneMapped: false }), bx, 1.75, bz - 0.05, g, { ry: Math.PI });
  const planSign = sign('PLANO · LISTA', 1.4, 0.26, { bg: '#1d4e85', fg: '#ffffff' }); planSign.position.set(bx, 0.55, bz - 0.08); planSign.rotation.y = Math.PI; g.add(planSign);
  col.addBoxAt(bx, bz, 2.2, 0.3);

  /* estructura en construcción (poniente): columnas y dos losas */
  const sxc = -7, szc = -4.6;
  for (const ix of [-3.3, 0, 3.3]) for (const iz of [-2.2, 2.2]) { box(0.45, 3.0, 0.45, concrete, sxc + ix, 0, szc + iz, g); col.addBoxAt(sxc + ix, szc + iz, 0.6, 0.6); }
  box(8.4, 0.3, 6.0, concrete, sxc, 3.0, szc, g, { cast: false });
  for (const ix of [-3.3, 0]) box(0.45, 2.4, 0.45, concrete, sxc + ix, 3.3, szc - 2.2, g, { cast: false });
  // varillas asomando
  for (let i = 0; i < 6; i++) cyl(0.025, 0.025, 0.9, mat(0x7a4a26, { m: 0.5, r: 0.5 }), sxc + 3.3 + (i % 3) * 0.14, 3.3, szc + 2.2 - Math.floor(i / 3) * 0.14, g, { seg: 6, cast: false });

  /* andamio SUR (defectuoso: plataforma sin barandal, con trabajador arriba) */
  const a1x = -7, a1z = -0.6;
  const scaffold = (x, z, withRails) => {
    for (const sx of [-1.1, 1.1]) for (const sz of [-0.55, 0.55]) box(0.09, 2.3, 0.09, amber, x + sx, 0, z + sz, g);
    for (const dy of [1.05, 2.2]) for (const sz of [-0.55, 0.55]) box(2.3, 0.07, 0.07, amber, x, dy, z + sz, g, { cast: false });
    box(2.5, 0.08, 1.25, woodLight, x, 2.3, z, g);
    if (withRails) {
      for (const sz of [-0.6, 0.6]) box(2.5, 0.06, 0.06, amber, x, 3.3, z + sz, g, { cast: false });
      for (const sx of [-1.2, 1.2]) box(0.06, 1.0, 1.25, amber, x + sx, 2.38, z, g, { cast: false });
      box(2.5, 0.18, 0.04, wood, x, 2.38, z - 0.62, g, { cast: false });
    }
    col.addBoxAt(x, z, 2.6, 1.4);
  };
  scaffold(a1x, a1z, false);
  // cubeta y herramienta en la plataforma insegura
  cyl(0.14, 0.11, 0.22, mat(0xd94f3d, { r: 0.7 }), a1x - 0.7, 2.38, a1z + 0.2, g, { seg: 10, cast: false });

  /* andamio NORTE (completo, en regla) */
  const a2x = 0.8, a2z = -7.6;
  scaffold(a2x, a2z, true);

  /* zanja de cimentación (oriente): recorte oscuro, montones de tierra y tablón */
  const zx = 7.6, zz = -3.8;
  slab(4.6, 2.3, 0.06, 0.1, mat(0x241709, { r: 1 }), zx, 0.012, zz, g, { cast: false });
  slab(4.2, 1.9, 0.05, 0.1, mat(0x120b04, { r: 1 }), zx, 0.02, zz, g, { cast: false });
  for (const [mx, mz, s] of [[zx - 2.9, zz + 0.4, 1.1], [zx + 2.8, zz - 0.5, 0.9], [zx + 0.4, zz + 1.7, 0.8]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.75 * s, 0.7 * s, 8), dirt); m.position.set(mx, 0.34 * s, mz); m.castShadow = true; g.add(m); col.addCircle(mx, mz, 0.7 * s);
  }
  box(2.6, 0.06, 0.4, woodLight, zx, 0.05, zz, g, { ry: 0.25, cast: false });
  col.addBoxAt(zx, zz, 4.0, 1.7);


  /* mezcladora, charco y extensión dañada (centro) */
  const mx2 = 1.4, mz2 = 1.6;
  box(1.1, 0.5, 1.1, steelD, mx2, 0, mz2, g);
  const drum = cyl(0.55, 0.4, 1.0, mat(0xff8f2b, { m: 0.3, r: 0.5 }), mx2, 0.75, mz2, g, { seg: 14, rx: 0.9 });
  drum.userData.dynamic = true;
  cyl(0.2, 0.2, 0.08, steelD, mx2 - 0.5, 0.4, mz2 + 0.5, g, { seg: 10 });
  col.addBoxAt(mx2, mz2, 1.4, 1.4);
  slab(1.9, 1.3, 0.02, 0.5, mat(0x5a7e9e, { r: 0.08, m: 0.55, e: 0x2a4a66, ei: 0.25 }), mx2 + 1.9, 0.012, mz2 + 1.1, g, { cast: false });
  // cable de la caseta a la mezcladora, cruzando el charco
  const cableMat = mat(0xd9452f, { r: 0.6 });
  for (const [x1, z1, x2, z2] of [[cx - 1.8, cz, 5.2, 4.2], [5.2, 4.2, mx2 + 1.9, mz2 + 1.1], [mx2 + 1.9, mz2 + 1.1, mx2 + 0.6, mz2 + 0.4]]) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const c = box(len, 0.045, 0.045, cableMat, (x1 + x2) / 2, 0.035, (z1 + z2) / 2, g, { cast: false });
    c.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  }

  /* escalera mal apoyada contra la estructura */
  const lx = -3.2, lz = -2.0;
  const ladder = new THREE.Group(); ladder.position.set(lx, 0, lz); ladder.rotation.x = -0.12; g.add(ladder);
  for (const s of [-0.28, 0.28]) box(0.07, 3.1, 0.07, amber, s, 1.55 - 1.55, 0, ladder);
  for (let i = 0; i < 6; i++) box(0.56, 0.05, 0.05, amber, 0, 0.35 + i * 0.5, 0, ladder, { cast: false });
  col.addCircle(lx, lz, 0.45);

  /* extintor y acopio de materiales */
  const ex = 11.2, ez = 4.6;
  box(0.26, 0.5, 0.2, mat(0xd9452f, { r: 0.5 }), ex, 0.85, ez, g, { cast: false });
  const extSign = sign('EXTINTOR', 0.9, 0.24, { bg: '#d9452f', fg: '#ffffff' }); extSign.position.set(ex, 1.55, ez - 0.12); extSign.rotation.y = Math.PI; g.add(extSign);
  const ax = -9.6, az = 6.4;
  for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) box(1.1, 0.28, 0.75, [wood, woodLight][(r + i) % 2], ax - 1.2 + i * 1.2, r * 0.3, az, g);
  for (const s of [-1, 1]) box(0.05, 0.62, 0.8, amber, ax + s * 1.75, 0, az, g, { cast: false });
  col.addBoxAt(ax, az, 3.9, 1.0);
  // tabiques sueltos
  for (let i = 0; i < 4; i++) box(0.35, 0.18, 0.2, mat(0xc96f4a, { r: 0.9 }), -11.3 + (i % 2) * 0.4, (i > 1 ? 0.2 : 0), 3.9, g, { cast: false });

  /* grúa torre (esquina nororiente) con pluma que gira, dentro de un área restringida */
  const kx = 11.0, kz = -7.6;
  box(1.6, 0.4, 1.6, concrete, kx, 0, kz, g);
  for (let i = 0; i < 9; i++) {
    const y = 0.4 + i * 1.3;
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) box(0.08, 1.3, 0.08, amber, kx + dx, y, kz + dz, g, { cast: false });
    box(0.78, 0.06, 0.06, amber, kx, y + 0.65, kz - 0.35, g, { cast: false, rz: i % 2 ? 0.9 : -0.9 });
  }
  const crane = new THREE.Group(); crane.position.set(kx, 12.1, kz); crane.userData.dynamic = true; g.add(crane);
  box(0.9, 0.9, 0.9, mat(0xffd166, { r: 0.6 }), 0, 0, 0, crane);                                        // cabina
  box(13, 0.32, 0.32, amber, -4.2, 0.6, 0, crane, { cast: false });                                     // pluma
  box(3.4, 0.3, 0.3, amber, 2.6, 0.6, 0, crane, { cast: false });                                       // contrapluma
  box(1.2, 0.9, 0.8, concrete, 3.6, 0.1, 0, crane, { cast: false });                                    // contrapeso
  cyl(0.02, 0.02, 7.2, steelD, -8.6, -6.4, 0, crane, { seg: 4, cast: false });                          // cable
  box(0.8, 0.12, 0.8, woodLight, -8.6, -6.6, 0, crane, { cast: false });                                // carga
  col.addBoxAt(kx, kz, 1.8, 1.8);
  for (const [x1, z1, x2, z2] of [[kx - 2.2, kz - 1.8, kx + 1.6, kz - 1.8], [kx - 2.2, kz + 2.2, kx + 1.6, kz + 2.2], [kx - 2.2, kz - 1.8, kx - 2.2, kz + 2.2]]) {
    const len = Math.hypot(x2 - x1, z2 - z1), t = box(len, 0.08, 0.03, mat(0xd94f3d, { r: 0.7 }), (x1 + x2) / 2, 0.9, (z1 + z2) / 2, g, { cast: false });
    t.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  }
  for (const [x, z] of [[kx - 2.2, kz - 1.8], [kx - 2.2, kz + 2.2], [kx + 1.6, kz + 2.2]]) cyl(0.05, 0.08, 0.95, steelD, x, 0, z, g, { seg: 6 });
  col.addBoxAt(kx - 0.3, kz + 0.2, 3.9, 4.1);
  const restricted = sign('ÁREA RESTRINGIDA · IZAJE', 2.4, 0.36, { bg: '#d94f3d', fg: '#ffffff' }); restricted.position.set(kx - 2.25, 1.35, kz + 0.2); restricted.rotation.y = -Math.PI / 2; g.add(restricted);

  /* retroexcavadora estacionada junto al andamio norte */
  const rx3 = 4.6, rz3 = -7.6;
  const backhoe = new THREE.Group(); backhoe.position.set(rx3, 0, rz3); backhoe.rotation.y = -0.35; g.add(backhoe);
  box(2.6, 0.7, 1.4, mat(0xf2b93b, { r: 0.55 }), 0, 0.55, 0, backhoe);
  box(1.1, 1.1, 1.2, mat(0xf2b93b, { r: 0.55 }), -0.5, 1.25, 0, backhoe);
  box(1.0, 0.8, 1.22, mat(0x9fd3ff, { r: 0.1, m: 0.4 }), -0.5, 1.4, 0, backhoe, { cast: false });
  for (const [x, z, r] of [[-0.85, 0.72, 0.5], [-0.85, -0.72, 0.5], [0.9, 0.72, 0.36], [0.9, -0.72, 0.36]]) cyl(r, r, 0.3, mat(0x1d2433, { r: 0.9 }), x, r, z, backhoe, { seg: 14, rx: Math.PI / 2 });
  box(1.3, 0.18, 0.22, mat(0x8a93a3, { m: 0.5, r: 0.4 }), 1.9, 0.85, 0, backhoe, { rz: -0.35 });       // brazo
  box(1.2, 0.18, 0.22, mat(0x8a93a3, { m: 0.5, r: 0.4 }), 2.6, 0.45, 0, backhoe, { rz: 1.0 });
  box(0.55, 0.4, 0.7, mat(0x6b7280, { m: 0.5 }), 2.9, 0.05, 0, backhoe);                                 // cucharón
  box(1.3, 0.35, 1.5, mat(0x6b7280, { m: 0.5 }), -1.6, 0.25, 0, backhoe, { cast: false });               // pala frontal
  col.addBoxAt(rx3 + 0.3, rz3, 4.6, 2.0);

  /* carretilla con arena (herramienta) */
  const wb = new THREE.Group(); wb.position.set(-5.4, 0, 5.0); wb.rotation.y = 0.5; g.add(wb);
  box(0.9, 0.35, 0.6, mat(0x2f9e8f, { m: 0.3, r: 0.5 }), 0, 0.42, 0, wb);
  box(0.8, 0.12, 0.5, dirt, 0, 0.62, 0, wb, { cast: false });
  cyl(0.18, 0.18, 0.08, mat(0x1d2433), 0.55, 0.18, 0, wb, { seg: 12, rx: Math.PI / 2 });
  for (const s of [-0.22, 0.22]) box(0.9, 0.05, 0.05, wood, -0.55, 0.5, s, wb, { cast: false });
  col.addCircle(-5.4, 5.0, 0.55);

  /* luces de exterior */
  g.add(new THREE.HemisphereLight(0xeaf4ff, 0xb08a5c, 1.15));
  const sun = sunLight(g, { x: -14, y: 24, z: 12, intensity: 1.8, color: 0xfff1d0, area: 24 }); sun.target.position.set(0, 0, 0);

  /* personajes */
  const paula = new Npc({ look: { skin: 0xd9a37a, hair: 0x2a1e14, hairStyle: 'bun', top: 0xffffff, topAccent: 0xff8f2b, bottom: 0x27304a, shoes: 0x3a2618, accessories: ['cap', 'badge', 'glasses'] }, x: 4.2, z: 5.6, yaw: Math.PI * 0.9 });
  const sinCasco = new Npc({ look: { skin: 0xc98e63, hair: 0x241810, hairStyle: 'short', top: 0x58b565, topAccent: 0xffffff, bottom: 0x4a5568, shoes: 0x3a2618, accessories: [] }, x: 3.0, z: 0.6, yaw: -0.8 });
  const arriba = new Npc({ look: { skin: 0xe9b58c, hair: 0x15100b, hairStyle: 'none', top: 0xff8f2b, topAccent: 0xffffff, bottom: 0x2a3550, shoes: 0x3a2618, accessories: ['cap'] }, x: a1x + 0.3, z: a1z, seatY: 2.38, yaw: 0.6 });
  const rondin = new Npc({ look: { ...NPC_LOOKS.repartidor, top: 0xf2b93b }, route: [[-2, 7.2], [-10.8, 7.4], [-11.2, 0.6], [-2.4, 3.4]], speed: 1.5, pause: 1.0 });
  [paula, sinCasco, arriba, rondin].forEach(n => g.add(n.group));
  col.addCircle(4.2, 5.6, 0.4); col.addCircle(3.0, 0.6, 0.4);

  mergeStatic(g);
  // señalización virtual (aparece cuando el jugador la coloca)
  const signage = new THREE.Group(); signage.visible = false; g.add(signage);
  const coneAt = (x, z) => { const c = new THREE.Group(); c.position.set(x, 0, z); cyl(0.16, 0.2, 0.06, mat(0xff5a2b, { r: 0.7 }), 0, 0, 0, c, { seg: 10 }); const k = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 10), mat(0xff5a2b, { r: 0.7 })); k.position.y = 0.26; c.add(k); const ring = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.12, 10), mat(0xffffff, { r: 0.7 })); ring.position.y = 0.3; c.add(ring); signage.add(c); };
  [[zx - 2.6, zz - 1.3], [zx, zz - 1.4], [zx + 2.6, zz - 1.3], [zx - 2.6, zz + 1.2], [zx + 2.6, zz + 1.2]].forEach(([x, z]) => coneAt(x, z));
  for (const [x1, z1, x2, z2] of [[zx - 2.6, zz - 1.3, zx + 2.6, zz - 1.3], [zx - 2.6, zz + 1.2, zx + 2.6, zz + 1.2]]) {
    const tape = box(Math.hypot(x2 - x1, z2 - z1), 0.07, 0.02, mat(0xf2b93b, { r: 0.8, e: 0xf2b93b, ei: 0.25 }), (x1 + x2) / 2, 0.42, (z1 + z2) / 2, signage, { cast: false }); void tape;
  }
  const zanjaSign = sign('EXCAVACIÓN PROFUNDA', 1.9, 0.34, { bg: '#f2b93b', fg: '#1d2433' }); zanjaSign.position.set(zx, 0.95, zz - 1.45); zanjaSign.rotation.y = Math.PI; signage.add(zanjaSign);
  const m = api.missions.site;
  const spotPoint = { 'andamio-sur': [a1x, a1z + 1.3], zanja: [zx, zz + 2.0], cables: [mx2 + 1.9, mz2 + 2.2], 'sin-casco': [3.0, 0.6], escalera: [lx + 0.9, lz + 0.6], extintor: [ex, ez - 0.9], 'andamio-norte': [a2x, a2z + 1.5], acopio: [ax, az - 1.2] };
  const interactables = [
    { id: 'exit', x: 0, y: 2.2, z: D / 2 - 0.6, radius: 1.8, color: 0x2f9e8f, label: 'Salir a la ciudad', action: () => api.travel('plaza', 'obra') },
    { id: 'paula', x: 4.2, y: 2.05, z: 5.6, radius: 2.2, color: 0xffc93c, label: () => m.labelFor('supervisor'), highlight: () => m.wants('supervisor'), action: () => m.talkToSupervisor(paula) },
    { id: 'gear', x: px, y: 2.0, z: pz - 0.9, radius: 2.0, color: 0x4cc9f0, label: () => m.labelFor('gear'), highlight: () => m.wants('gear'), action: () => m.openGear() },
    { id: 'plan', x: bx, y: 2.2, z: bz - 0.8, radius: 2.0, color: 0x4cc9f0, label: () => m.labelFor('plan'), highlight: () => m.wants('plan'), action: () => m.openPlan() },
    ...Object.entries(spotPoint).map(([id, [x, z]]) => ({
      id: 'spot-' + id, x, y: 1.9, z, radius: 2.1, color: 0xffc93c,
      label: () => m.labelFor('spot', id), highlight: () => m.wants('spot', id), action: () => m.inspectSpot(id)
    })),
    { id: 'sign-zanja', x: zx - 3.4, y: 1.7, z: zz + 1.6, radius: 1.9, color: 0xff8f7a, label: () => m.labelFor('sign'), highlight: () => m.wants('sign'), action: () => m.placeSign() },
    { id: 'rondin', x: -6, y: 2.0, z: 7.2, radius: 0.1, color: 0x9fd3ff, label: 'Trabajador de ronda', action: () => api.ui.dialog({ speaker: 'Trabajador', lines: ['¿Inspección? Qué bueno: esa zanja lleva días abierta y sin un solo cono.'] }) }
  ];

  return {
    name: 'site', title: 'Obra en construcción', group: g, collision: col, interactables,
    npcs: [paula, sinCasco, arriba, rondin],
    background: 0x79b4e6, fog: null,
    spawns: { default: { x: 0, z: 8.4, yaw: Math.PI } },
    camera: { distance: 7.0, minDistance: 2.6, maxDistance: 10.5, pitch: 0.46, yaw: 0, box: { minX: -15, maxX: 15, minZ: -11.5, maxZ: 13.5, maxY: 9.5 } },
    update(dt, t) {
      drum.rotation.y += dt * 1.6;
      crane.rotation.y = Math.sin(t * 0.12) * 0.9;
      signage.visible = Boolean(m.attempt.signed);
      planFace.material.color.setHex(m.wants('plan') ? 0xdcecff : 0xeef4ff);
      planBoard.position.y = 1.15 + (m.wants('plan') ? Math.sin(t * 3) * 0.015 : 0);
    }
  };
}
