// Personaje estilizado original de Ciudad ICADEM: un solo esqueleto para todos los avatares
// y NPC, con animaciones por código (parado, caminar, correr, saltar, saludar, celebrar,
// sentarse e interactuar). Mira hacia +Z.
import * as THREE from '../three.js';
import { mat as kitMat, mergeStatic } from '../world/kit.js';
import { fashionLeg, fashionShoes, fashionTop, fashionSleeve, fashionSkirt, fashionHair, fashionAccessories } from './fashion-parts.js';
import { makeProp, PROP_EMOTES } from './props.js';
import { extraLeg, extraShoes, extraTop, extraSleeve, extraSkirt, extraHair, extraAccessories, EXTRA_HATS } from './fashion-extra.js';

// Los personajes nunca se recortan con el efecto de obstáculos translúcidos.
const mat = (color, o = {}) => kitMat(color, { ...o, solid: true });

const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

function part(geo, material, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false;
  parent.add(m); return m;
}

export function createAvatar(look = {}) {
  const L = {
    skin: 0xf2c29b, hair: 0x4a2f22, hairStyle: 'short', top: 0x2f80ed, topAccent: 0xffffff, bottom: 0x2a3a5c,
    shoes: 0xfafafa, accessories: [], scale: 1, ...look
  };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const M = {
    skin: mat(L.skin, { r: 0.7 }), hair: mat(L.hair, { r: 0.85 }), top: mat(L.top, { r: 0.75 }),
    accent: mat(L.topAccent, { r: 0.7 }), bottom: mat(L.bottom, { r: 0.8 }), shoes: mat(L.shoes, { r: 0.6 }),
    dark: mat(0x1d2433, { r: 0.5 }), white: mat(0xffffff, { r: 0.4 })
  };

  /* piernas */
  const legs = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.115, 0.52, 0); body.add(pivot);
    if (!fashionLeg(pivot, side, L, M) && !extraLeg(pivot, side, L, M)) part(new THREE.CapsuleGeometry(0.1, 0.26, 4, 10), M.bottom, 0, -0.23, 0, pivot);
    if (!fashionShoes(pivot, L, M) && !extraShoes(pivot, L, M)) {
      const shoe = part(new THREE.CapsuleGeometry(0.095, 0.13, 4, 8), M.shoes, 0, -0.455, 0.06, pivot);
      shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.05, 1, 0.82);
    }
    return pivot;
  });

  /* torso */
  const torso = new THREE.Group(); torso.position.set(0, 0.52, 0); body.add(torso);
  if (!fashionTop(torso, L, M) && !extraTop(torso, L, M)) {
    const chest = part(new THREE.CapsuleGeometry(0.2, 0.26, 6, 14), M.top, 0, 0.3, 0, torso);
    chest.scale.set(1.12, 1, 0.86);
  }
  const belt = part(new THREE.CylinderGeometry(0.212, 0.205, 0.07, 16), M.bottom, 0, 0.06, 0, torso);
  belt.scale.set(1.1, 1, 0.86);
  fashionSkirt(torso, L, M); extraSkirt(torso, L, M);

  /* brazos: el pivote está en el hombro */
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.285, 0.5, 0); torso.add(pivot);
    if (!fashionSleeve(pivot, L, M) && !extraSleeve(pivot, L, M)) part(new THREE.CapsuleGeometry(0.068, 0.25, 4, 8), M.top, 0, -0.17, 0, pivot);
    part(new THREE.SphereGeometry(0.078, 12, 10), M.skin, 0, -0.39, 0, pivot);
    return pivot;
  });

  /* cabeza */
  const head = new THREE.Group(); head.position.set(0, 0.63, 0); torso.add(head);
  part(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 10), M.skin, 0, 0.02, 0, head);
  const skull = part(new THREE.SphereGeometry(0.265, 24, 18), M.skin, 0, 0.27, 0, head);
  skull.scale.set(1, 0.96, 0.98);
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.052, 10, 8), M.skin, s * 0.26, 0.25, 0, head);
  const eyes = [-1, 1].map(s => {
    const e = part(new THREE.SphereGeometry(0.036, 12, 10), M.dark, s * 0.095, 0.285, 0.238, head);
    e.scale.set(1, 1.25, 0.6); e.castShadow = false; e.userData.dynamic = true;
    const shine = part(new THREE.SphereGeometry(0.011, 6, 6), M.white, s * 0.095 + 0.012, 0.3, 0.262, head); shine.castShadow = false;
    return e;
  });
  const smile = part(new THREE.TorusGeometry(0.062, 0.011, 6, 14, Math.PI), M.dark, 0, 0.2, 0.243, head);
  smile.rotation.z = Math.PI; smile.rotation.x = -0.12; smile.castShadow = false;
  for (const s of [-1, 1]) {
    const cheek = part(new THREE.CircleGeometry(0.036, 12), new THREE.MeshBasicMaterial({ color: 0xff9a8b, transparent: true, opacity: 0.55 }), s * 0.165, 0.2, 0.21, head);
    cheek.rotation.y = s * 0.62; cheek.castShadow = false;
  }

  /* cabello */
  if (L.hairStyle !== 'none') {
    const tucked = (L.accessories || []).some(a => ['beanie', 'bucketHat', 'beret', 'fedora', 'cowboyHat', ...EXTRA_HATS].includes(a));
    const cap = part(new THREE.SphereGeometry(0.278, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), M.hair, 0, 0.285, -0.012, head);
    cap.rotation.x = -0.32;
    if (L.hairStyle === 'bun') part(new THREE.SphereGeometry(tucked ? .085 : 0.11, 12, 10), M.hair, 0, tucked ? .39 : 0.52, tucked ? -.24 : -0.14, head);
    if (L.hairStyle === 'long') { const back = part(new THREE.CapsuleGeometry(0.2, 0.2, 4, 12), M.hair, 0, 0.14, -0.13, head); back.scale.set(1.12, 1, 0.62); }
    if (L.hairStyle === 'short') { const fr = part(new THREE.SphereGeometry(0.12, 12, 8), M.hair, 0.09, tucked ? .32 : 0.47, tucked ? .20 : 0.16, head); fr.scale.set(1.5, tucked ? .3 : 0.6, 0.9); }
    if (L.hairStyle === 'side') { const fr = part(new THREE.SphereGeometry(0.13, 12, 8), M.hair, -0.1, tucked ? .32 : 0.46, tucked ? .19 : 0.15, head); fr.scale.set(1.6, tucked ? .3 : 0.62, 0.9); }
  }
  fashionHair(head, L, M); extraHair(head, L, M);

  /* accesorios */
  const acc = new Set(L.accessories);
  if (acc.has('explorerHat')) {
    const felt = mat(0xc99a52, { r: 0.9 });
    const brim = part(new THREE.CylinderGeometry(0.42, 0.44, 0.035, 24), felt, 0, 0.47, 0, head); brim.rotation.x = -0.06;
    part(new THREE.CylinderGeometry(0.2, 0.26, 0.19, 20), felt, 0, 0.57, -0.01, head);
    part(new THREE.CylinderGeometry(0.265, 0.265, 0.045, 20), mat(0x1f4f8f), 0, 0.5, -0.005, head);
  }
  if (acc.has('backpack')) {
    const bag = mat(0xf2a33a, { r: 0.8 });
    const pack = part(new THREE.CapsuleGeometry(0.15, 0.16, 4, 10), bag, 0, 0.32, -0.22, torso); pack.scale.set(1.2, 1, 0.75);
    part(new THREE.BoxGeometry(0.2, 0.1, 0.05), mat(0xd9862a), 0, 0.26, -0.33, torso);
    for (const s of [-1, 1]) { const strap = part(new THREE.BoxGeometry(0.045, 0.36, 0.025), mat(0xd9862a), s * 0.13, 0.36, 0.165, torso); strap.rotation.x = 0.1; }
  }
  if (acc.has('scarf')) {
    const sc = part(new THREE.TorusGeometry(0.115, 0.045, 8, 16), mat(0xe8483f, { r: 0.8 }), 0, 0.6, 0.01, torso); sc.rotation.x = Math.PI / 2 + 0.2;
    const tail = part(new THREE.BoxGeometry(0.08, 0.16, 0.03), mat(0xe8483f, { r: 0.8 }), 0.09, 0.5, 0.17, torso); tail.rotation.z = -0.25;
  }
  if (acc.has('tie')) {
    part(new THREE.BoxGeometry(0.16, 0.2, 0.02), M.white, 0, 0.47, 0.168, torso);
    const tie = part(new THREE.BoxGeometry(0.055, 0.24, 0.025), M.accent, 0, 0.4, 0.18, torso); tie.rotation.x = 0.06;
  }
  if (acc.has('lapels')) for (const s of [-1, 1]) { const lp = part(new THREE.BoxGeometry(0.07, 0.26, 0.02), M.accent, s * 0.085, 0.42, 0.172, torso); lp.rotation.z = s * 0.3; }
  if (acc.has('badge')) part(new THREE.BoxGeometry(0.07, 0.09, 0.015), mat(0xffd166, { m: 0.5, r: 0.35 }), 0.11, 0.36, 0.175, torso);
  if (acc.has('glasses')) for (const s of [-1, 1]) { const gl = part(new THREE.TorusGeometry(0.058, 0.011, 6, 16), M.dark, s * 0.097, 0.285, 0.245, head); gl.castShadow = false; }
  if (acc.has('apron')) { const ap = part(new THREE.BoxGeometry(0.3, 0.36, 0.02), mat(0xfff6e0), 0, 0.22, 0.175, torso); ap.castShadow = false; }
  if (acc.has('toque')) {
    part(new THREE.CylinderGeometry(0.2, 0.21, 0.1, 18), M.white, 0, 0.45, 0, head);
    part(new THREE.CylinderGeometry(0.24, 0.2, 0.2, 18), M.white, 0, 0.6, 0, head); part(new THREE.SphereGeometry(0.235, 16, 10), M.white, 0, 0.7, 0, head).scale.y = 0.45;
  }
  if (acc.has('hardhat')) {
    part(new THREE.SphereGeometry(0.29, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0xffd23f, { r: 0.45 }), 0, 0.29, 0, head);
    part(new THREE.CylinderGeometry(0.33, 0.33, 0.025, 20), mat(0xffd23f, { r: 0.45 }), 0, 0.31, 0.03, head); part(new THREE.BoxGeometry(0.06, 0.05, 0.5), mat(0xf2b93b, { r: 0.45 }), 0, 0.56, 0, head);
  }
  if (acc.has('stethoscope')) {
    const st = part(new THREE.TorusGeometry(0.13, 0.014, 6, 18, Math.PI * 1.25), M.dark, 0, 0.56, 0.07, torso); st.rotation.set(Math.PI / 2 - 0.5, 0, Math.PI * 0.875); st.castShadow = false;
    part(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 12), mat(0xc8d0dc, { m: 0.6, r: 0.3 }), 0.07, 0.36, 0.178, torso).rotation.x = Math.PI / 2;
  }
  if (acc.has('robe')) {
    part(new THREE.BoxGeometry(0.38, 0.5, 0.03), M.dark, 0, 0.2, 0.172, torso).castShadow = false; part(new THREE.BoxGeometry(0.1, 0.16, 0.02), M.white, 0, 0.5, 0.19, torso).castShadow = false;
  }
  // Piezas de las skins especiales (solo apariencia: ninguna cambia el tamaño de colisión ni la velocidad).
  const gold = mat(0xffd166, { m: 0.6, r: 0.3 });
  if (acc.has('headband')) { const hb = part(new THREE.TorusGeometry(0.262, 0.03, 8, 24), M.accent, 0, 0.4, 0, head); hb.rotation.x = Math.PI / 2; hb.castShadow = false; }
  if (acc.has('spaceHelmet')) {
    const glass = kitMat(0xcfe8ff, { r: 0.05, m: 0.3, opacity: 0.32, solid: true, own: true }); glass.depthWrite = false;
    const dome = part(new THREE.SphereGeometry(0.4, 22, 16), glass, 0, 0.3, 0.02, head); dome.castShadow = false; dome.renderOrder = 2;
    const ring = part(new THREE.TorusGeometry(0.21, 0.05, 8, 22), mat(0xdfe4ee, { m: 0.5, r: 0.35 }), 0, 0.64, 0, torso); ring.rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(0.14, 0.1, 0.03), mat(0x1e63c4, { r: 0.5 }), -0.1, 0.42, 0.172, torso);
  }
  if (acc.has('cape')) {
    const cape = part(new THREE.BoxGeometry(0.44, 0.66, 0.03), M.accent, 0, 0.27, -0.19, torso); cape.rotation.x = 0.12;
    part(new THREE.BoxGeometry(0.46, 0.06, 0.06), gold, 0, 0.6, -0.15, torso);
  }
  if (acc.has('gradCap')) {
    part(new THREE.CylinderGeometry(0.24, 0.25, 0.12, 18), M.dark, 0, 0.46, 0, head);
    const board = part(new THREE.BoxGeometry(0.56, 0.035, 0.56), M.dark, 0, 0.55, 0, head); board.rotation.y = Math.PI / 4;
    part(new THREE.BoxGeometry(0.02, 0.18, 0.02), gold, 0.22, 0.46, 0.0, head);
  }
  if (acc.has('medal')) {
    for (const sx of [-1, 1]) { const rb = part(new THREE.BoxGeometry(0.04, 0.2, 0.012), mat(0x1e63c4, { r: 0.6 }), sx * 0.045, 0.47, 0.178, torso); rb.rotation.z = sx * 0.35; rb.castShadow = false; }
    const md = part(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 18), gold, 0, 0.35, 0.186, torso); md.rotation.x = Math.PI / 2;
  }
  if (acc.has('laurel')) { const lr = part(new THREE.TorusGeometry(0.255, 0.028, 6, 22, Math.PI * 1.6), mat(0xd9b44a, { m: 0.55, r: 0.35 }), 0, 0.46, 0, head); lr.rotation.set(Math.PI / 2, 0, Math.PI * 0.7); lr.castShadow = false; }

  if (acc.has('cap')) {
    part(new THREE.SphereGeometry(0.283, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), M.accent, 0, 0.3, 0, head);
    const visor = part(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), M.accent, 0, 0.36, 0.2, head); visor.rotation.y = Math.PI / 2;
  }
  fashionAccessories({ head, torso, arms, look: L, materials: M, accessories: acc });
  extraAccessories({ head, torso, arms, look: L, materials: M, accessories: acc });

  // Menos mallas por personaje: cada articulación fusiona sus piezas del mismo material.
  for (const joint of [head, torso, ...arms, ...legs]) mergeStatic(joint, { deep: false });

  root.scale.setScalar(L.scale);

  /* ---------- animación ---------- */
  const pose = { legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: 0.08, armRz: -0.08, lean: 0, bodyY: 0, headX: 0, headY: 0, squash: 1, bank: 0 };
  const state = { phase: 0, time: Math.random() * 10, emote: null, emoteTime: 0, anim: 'idle', blink: 2 + Math.random() * 3, lookYaw: 0, prevYaw: null, turn: 0, idle: 0 };
  /* Mundo vivo: mano derecha (correa) y hombro izquierdo (donde se posan las aves). Solo puntos de referencia. */
  const handR = new THREE.Object3D(); handR.position.set(0, -0.43, 0.03); arms[1].add(handR);
  const perch = new THREE.Object3D(); perch.position.set(-0.2, 0.66, -0.02); torso.add(perch);

  let prop = null, propKind = null;
  /** Objeto en la mano mientras dura la animación (vaso, balero, papalote…). */
  function setProp(kind, color) { if (kind === propKind && prop) return; prop?.dispose(); prop = null; propKind = kind; if (kind) prop = makeProp(kind, handR, root, color); }
  function playEmote(name, seconds = 1.6, color) { state.emote = name; state.emoteTime = seconds; setProp(PROP_EMOTES.includes(name) ? name : null, color); }

  /**
   * @param {number} dt
   * @param {{speed?:number, grounded?:boolean, sitting?:boolean, lookYaw?:number}} s
   */
  function update(dt, s = {}) {
    const speed = s.speed || 0, grounded = s.grounded !== false, moving = speed > 0.25;
    state.time += dt;
    if (state.emoteTime > 0) { state.emoteTime -= dt; if (state.emoteTime <= 0) { state.emote = null; setProp(null); } }
    // Mezcla continua caminar↔correr y paso ligado a la distancia recorrida (los pies no patinan).
    const runMix = Math.min(1, Math.max(0, (speed - 3.7) / 1.9)), running = runMix > 0.5;
    if (moving && grounded) state.phase += dt * speed * (3.15 - 0.8 * runMix);
    if (state.wasGrounded === false && grounded) state.land = 0.2;
    state.wasGrounded = grounded;
    if (state.land > 0) state.land -= dt;

    // Giro del cuerpo (lo fija quien mueve al personaje): sirve para inclinarse en las curvas.
    const yaw = root.rotation.y;
    if (state.prevYaw !== null && dt > 0) { let dy = (yaw - state.prevYaw) % (Math.PI * 2); if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2; state.turn += (dy / dt - state.turn) * Math.min(1, dt * 8); }
    state.prevYaw = yaw;
    state.idle = moving || !grounded || s.sitting || state.emote ? 0 : state.idle + dt;
    const T = { legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: 0.08, armRz: -0.08, lean: 0, bodyY: 0, headX: 0, headY: s.lookYaw || 0, squash: 1, bank: 0 };
    let anim = 'idle';
    if (s.sitting) {
      anim = 'sit'; T.legL = T.legR = -1.48; T.bodyY = -0.3; T.armLx = T.armRx = -0.5; T.lean = -0.06;
    } else if (!grounded) {
      anim = 'jump'; T.legL = 0.55; T.legR = -0.4; T.armLz = 1.5; T.armRz = -1.5; T.armLx = T.armRx = -0.4; T.lean = 0.1;
    } else if (moving) {
      anim = running ? 'run' : 'walk';
      const start = Math.min(1, speed / 2.2), a = (0.66 + 0.39 * runMix) * start, sw = Math.sin(state.phase);
      T.legL = sw * a; T.legR = -sw * a;
      T.armLx = -sw * a * (0.85 + 0.25 * runMix); T.armRx = sw * a * (0.85 + 0.25 * runMix);
      T.armLz = 0.1 + 0.12 * runMix; T.armRz = -0.1 - 0.12 * runMix;
      T.lean = 0.07 + 0.19 * runMix;
      T.bodyY = Math.abs(Math.cos(state.phase)) * (0.035 + 0.035 * runMix) * start;
      T.bank = Math.max(-0.2, Math.min(0.2, -state.turn * 0.055 * Math.min(1, speed / 3)));   // se inclina hacia la curva
      T.headY += Math.max(-0.3, Math.min(0.3, state.turn * 0.09));                              // y mira hacia donde gira
    } else {
      const b = Math.sin(state.time * 2.1);
      T.bodyY = b * 0.012; T.armLz = 0.1 + b * 0.025; T.armRz = -0.1 - b * 0.025; T.headX = Math.sin(state.time * 0.7) * 0.04;
      // quieto un rato: cambia el peso de pierna y mira alrededor con calma
      const mix = Math.min(1, Math.max(0, (state.idle - 4) / 2));
      if (mix && s.lookYaw === undefined) { T.headY += Math.sin(state.time * 0.42) * 0.42 * mix; T.bank = Math.sin(state.time * 0.33) * 0.03 * mix; T.legL += Math.max(0, Math.sin(state.time * 0.33)) * 0.08 * mix; }
    }
    // paseando con correa: el brazo derecho sostiene la correa un poco al frente
    if (state.hold && !s.sitting && grounded && !state.emote) { T.armRx = -0.42 + Math.sin(state.time * 2.4) * 0.04 + (moving ? T.armRx * 0.15 : 0); T.armRz = -0.16; }
    // Mundo vivo: cuidar a la mascota, lanzar, beber y jugar con juguetes tradicionales
    const e = state.emote, tt = state.time;
    if (e === 'petting') { T.bodyY = -0.3; T.legL = -1.2; T.legR = 0.3; T.lean += 0.36; T.armRx = -0.75 + Math.sin(tt * 7) * 0.18; T.armRz = -0.1; T.headX = 0.3; }
    else if (e === 'throw') { const back = state.emoteTime > 0.42; T.armRx = back ? 1.1 : -1.7; T.armRz = -0.2; T.lean += back ? -0.06 : 0.14; T.legL = back ? 0.2 : -0.25; }
    else if (e === 'drink') { T.armRx = -1.8; T.armRz = 0.5; T.headX = -0.18; }
    else if (e === 'balero') { T.armRx = -1.15 + Math.max(0, Math.sin(tt * 6.4)) * 0.25; T.armRz = -0.12; T.headX = 0.12; }
    else if (e === 'yoyo') { T.armRx = -0.95 + Math.sin(tt * 8) * 0.12; T.armRz = -0.1; T.headX = 0.18; }
    else if (e === 'trompo') { T.bodyY = -0.12; T.lean += 0.22; T.armRx = -0.55; T.armLx = -0.4; T.headX = 0.38; }
    else if (e === 'papalote') { T.armRx = -2.45 + Math.sin(tt * 1.3) * 0.12; T.armRz = -0.25; T.headX = -0.42; }
    else if (e === 'burbujas') { T.armRx = -1.8; T.armRz = 0.45; T.headX = -0.05; T.bodyY += Math.sin(tt * 2) * 0.01; }
    if (['petting', 'throw', 'drink', 'balero', 'yoyo', 'trompo', 'papalote', 'burbujas'].includes(e)) anim = e;
    prop?.update(tt);
    if (state.emote === 'wave') {
      anim = 'wave'; T.armRz = -2.55 + Math.sin(state.time * 11) * 0.32; T.armRx = 0; T.headY += 0.12;
    } else if (state.emote === 'celebrate') {
      anim = 'celebrate'; const hop = Math.abs(Math.sin(state.time * 7.5));
      T.armLz = 2.6 + Math.sin(state.time * 15) * 0.18; T.armRz = -2.6 - Math.sin(state.time * 15) * 0.18;
      T.bodyY = hop * 0.22; T.legL = hop * 0.25; T.legR = -hop * 0.15; T.squash = 1 + hop * 0.03;
    } else if (state.emote === 'interact') {
      anim = 'interact'; T.armRx = -1.25; T.armRz = -0.1; T.lean += 0.1;
    } else if (state.emote === 'beckon') {
      anim = 'beckon'; T.armRx = -1.35 + Math.sin(state.time * 9) * 0.45; T.armRz = -0.18; T.headY += 0.1;
    } else if (state.emote === 'clap') {
      anim = 'clap'; const c = Math.abs(Math.sin(state.time * 12));
      T.armLx = T.armRx = -1.2; T.armLz = -0.28 + c * 0.42; T.armRz = 0.28 - c * 0.42; T.bodyY += c * 0.02;
    } else if (state.emote === 'point') {
      anim = 'point'; T.armRx = -1.52; T.armRz = -0.05; T.lean += 0.06;
    } else if (state.emote === 'help') {
      anim = 'help'; const w = Math.sin(state.time * 9) * 0.3;
      T.armLz = 2.5 + w; T.armRz = -2.5 + w; T.bodyY += Math.abs(Math.sin(state.time * 4.5)) * 0.05;
    } else if (state.emote === 'talk') {
      T.armRx = -0.55 + Math.sin(state.time * 6) * 0.2; T.armRz = -0.25; T.headX = Math.sin(state.time * 5) * 0.05;
    }
    if (state.land > 0 && grounded) { const k = state.land / 0.2; T.bodyY -= 0.09 * k; T.squash = 1 - 0.07 * k; T.legL += 0.25 * k; T.legR += 0.25 * k; }
    state.anim = anim;

    const r = anim === 'jump' ? 9 : 14;
    for (const k in T) pose[k] = damp(pose[k], T[k], r, dt);
    legs[0].rotation.x = pose.legL; legs[1].rotation.x = pose.legR;
    arms[0].rotation.x = pose.armLx; arms[1].rotation.x = pose.armRx;
    arms[0].rotation.z = -pose.armLz; arms[1].rotation.z = -pose.armRz;
    torso.rotation.x = pose.lean;
    body.position.y = pose.bodyY;
    body.scale.y = pose.squash;
    body.rotation.z = pose.bank;
    head.rotation.x = pose.headX - pose.lean * 0.6;
    head.rotation.y = pose.headY;
    if (s.sitting) { torso.rotation.x = pose.lean; }

    state.blink -= dt;
    const closed = state.blink < 0.11;
    for (const e of eyes) e.scale.y = closed ? 0.15 : 1.25;
    if (state.blink <= 0) state.blink = 2.4 + Math.random() * 3.2;
  }

  return { group: root, update, playEmote, hand: handR, perch, setHold(on) { state.hold = Boolean(on); }, get anim() { return state.anim; }, get emote() { return state.emote; }, get emoteTime() { return state.emoteTime; }, head, look: L, height: 1.72 * L.scale };
}
