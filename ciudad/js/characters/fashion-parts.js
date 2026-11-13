// Cosmetic geometry only. Every piece follows an existing avatar joint; none
// changes its rig, animation, collision size, movement or gameplay attributes.
import * as THREE from '../three.js';
import { mat as kitMat, mergeStatic } from '../world/kit.js';

const mat = (color, options = {}) => kitMat(color, { ...options, solid: true });
const mesh = (geometry, material, x, y, z, parent) => {
  const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z);
  item.castShadow = true; parent.add(item); return item;
};
const box = (w, h, d, material, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
const sphere = (r, material, x, y, z, parent, segments = 12) => mesh(new THREE.SphereGeometry(r, segments, Math.max(6, segments - 2)), material, x, y, z, parent);
const capsule = (r, length, material, x, y, z, parent, segments = 10) => mesh(new THREE.CapsuleGeometry(r, length, 4, segments), material, x, y, z, parent);
const ring = (r, thickness, material, x, y, z, parent, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(r, thickness, 6, 24, arc), material, x, y, z, parent);
const group = (parent, name) => { const node = new THREE.Group(); node.name = 'fashion-' + name; parent.add(node); return node; };
const finish = node => { mergeStatic(node); return true; };

export function fashionLeg(pivot, side, look, materials) {
  const style = look.bottomStyle;
  if (!['straight', 'cargo', 'flare', 'skirt', 'pleatedSkirt'].includes(style)) return false;
  if (style === 'skirt' || style === 'pleatedSkirt') {
    capsule(0.094, 0.26, materials.skin, 0, -0.23, 0, pivot); return true;
  }
  if (style === 'flare') {
    const profile = [[0.15, -0.43], [0.132, -0.32], [0.089, -0.20], [0.096, -0.045], [0.105, 0.005]].map(p => new THREE.Vector2(...p));
    const geometry = new THREE.LatheGeometry(profile, 16), positions = geometry.attributes.position;
    // Flares widen to the outside. The inner hems remain clear of the other leg
    // without moving the shared leg pivots or changing their animation.
    for (let i = 0; i < positions.count; i++) if (Math.sign(positions.getX(i)) !== side) positions.setX(i, positions.getX(i) * .69);
    geometry.computeVertexNormals(); mesh(geometry, materials.bottom, 0, 0, 0, pivot);
    box(.012, .26, .012, mat(0xc2d2e2), side * .092, -.27, .104, pivot);
  } else {
    mesh(new THREE.CylinderGeometry(style === 'cargo' ? .117 : .105, .102, .43, 12), materials.bottom, 0, -.215, 0, pivot);
    if (style === 'cargo') {
      box(.078, .115, .075, materials.bottom, side * .105, -.21, .012, pivot);
      box(.082, .027, .08, mat(0x626f50), side * .105, -.166, .012, pivot);
      sphere(.009, materials.accent, side * .147, -.17, .045, pivot, 8);
    }
  }
  return true;
}

export function fashionShoes(pivot, look, materials) {
  const style = look.shoeStyle;
  if (!['sneakers', 'chunky', 'boots', 'loafers'].includes(style)) return false;
  const shoe = group(pivot, 'shoes'), sole = mat(style === 'boots' ? 0x27222a : style === 'loafers' ? 0x171622 : 0xfaf7f0);
  const body = capsule(style === 'chunky' ? .109 : .096, style === 'loafers' ? .12 : .15, materials.shoes, 0, style === 'chunky' ? -.42 : -.437, .065, shoe);
  body.rotation.x = Math.PI / 2; body.scale.set(style === 'chunky' ? 1.13 : 1.03, 1, .72);
  const bottom = capsule(style === 'chunky' ? .118 : .104, .16, sole, 0, -.488, .065, shoe);
  bottom.rotation.x = Math.PI / 2; bottom.scale.set(style === 'chunky' ? 1.12 : 1.02, 1, style === 'chunky' ? .42 : .26);
  if (style === 'boots') {
    capsule(.101, .18, materials.shoes, 0, -.305, .008, shoe);
    ring(.101, .014, sole, 0, -.214, .008, shoe).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) box(.021, .10, .018, mat(0xd1b78e), sx * .07, -.292, .088, shoe);
  } else if (style === 'loafers') {
    box(.143, .023, .065, materials.shoes, 0, -.373, .11, shoe);
    const buckle = ring(.024, .007, mat(0xd6b66f, { m: .6, r: .35 }), 0, -.358, .11, shoe); buckle.rotation.x = -Math.PI / 2;
  } else {
    for (const z of [.06, .092, .124]) box(.09, .009, .014, mat(0xd9dce8), 0, -.367, z, shoe);
    for (const sx of [-1, 1]) box(.012, .023, .095, materials.accent, sx * .097, -.42, .07, shoe);
    if (style === 'chunky') for (const z of [-.015, .065, .14]) box(.22, .015, .012, mat(0xd3c9df), 0, -.48, z, shoe);
  }
  return finish(shoe);
}

export function fashionTop(torso, look, materials) {
  const style = look.topStyle;
  if (!['tee', 'hoodie', 'denimJacket', 'blazer', 'cropTop'].includes(style)) return false;
  const shirt = group(torso, 'top');
  const chest = capsule(style === 'hoodie' ? .225 : .2, style === 'cropTop' ? .08 : .26, materials.top, 0, style === 'cropTop' ? .435 : .3, 0, shirt, 14);
  chest.scale.set(1.12, 1, .86);
  if (style === 'cropTop') {
    mesh(new THREE.CylinderGeometry(.182, .18, .22, 16), materials.skin, 0, .15, 0, shirt);
    ring(.198, .012, materials.accent, 0, .25, 0, shirt).rotation.x = Math.PI / 2;
    sphere(.018, mat(0xe9c68e, { m: .4, r: .4 }), 0, .405, .18, shirt, 8);
  } else if (style === 'hoodie') {
    const hood = capsule(.187, .15, materials.top, 0, .59, -.095, shirt, 12); hood.scale.set(1.2, 1, .7);
    const hem = ring(.211, .023, materials.top, 0, .035, 0, shirt); hem.rotation.x = Math.PI / 2; hem.scale.set(1.1, .86, 1);
    box(.215, .1, .027, materials.top, 0, .19, .203, shirt);
    for (const sx of [-1, 1]) { box(.012, .14, .012, materials.white, sx * .047, .47, .209, shirt); sphere(.014, materials.accent, sx * .047, .397, .211, shirt, 8); }
  } else if (style === 'denimJacket' || style === 'blazer') {
    box(.18, .38, .026, materials.white, 0, .32, .18, shirt);
    for (const sx of [-1, 1]) {
      const lapel = box(.075, .26, .035, style === 'blazer' ? materials.accent : materials.top, sx * .082, .44, .197, shirt); lapel.rotation.z = sx * .25;
      if (style === 'denimJacket') { box(.092, .09, .023, materials.top, sx * .123, .335, .191, shirt); box(.095, .012, .028, mat(0xc0cfdf), sx * .123, .37, .197, shirt); }
    }
    for (const y of [.2, .29, .38]) sphere(.011, mat(0xd4b576, { m: .45, r: .4 }), .06, y, .208, shirt, 8);
  } else {
    const neck = ring(.106, .016, materials.accent, 0, .592, .008, shirt); neck.rotation.x = Math.PI / 2;
    box(.1, .055, .014, materials.accent, -.09, .40, .181, shirt);
  }
  return finish(shirt);
}

export function fashionSleeve(pivot, look, materials) {
  if (!['tee', 'hoodie', 'denimJacket', 'blazer', 'cropTop'].includes(look.topStyle)) return false;
  if (look.topStyle === 'tee' || look.topStyle === 'cropTop') {
    capsule(.061, .14, materials.skin, 0, -.25, 0, pivot);
    capsule(.079, .07, materials.top, 0, -.055, 0, pivot);
  } else {
    capsule(look.topStyle === 'hoodie' ? .08 : .073, .25, materials.top, 0, -.17, 0, pivot);
    mesh(new THREE.CylinderGeometry(.078, .078, .045, 10), look.topStyle === 'blazer' ? materials.white : materials.accent, 0, -.315, 0, pivot);
  }
  return true;
}

export function fashionSkirt(torso, look, materials) {
  if (!['skirt', 'pleatedSkirt'].includes(look.bottomStyle)) return;
  const skirt = group(torso, 'skirt'), pleated = look.bottomStyle === 'pleatedSkirt';
  const geometry = new THREE.CylinderGeometry(.215, pleated ? .325 : .285, pleated ? .32 : .25, pleated ? 32 : 20, 1);
  if (pleated) {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i), a = Math.atan2(z, x), factor = 1 + .045 * Math.cos(a * 16);
      positions.setX(i, x * factor); positions.setZ(i, z * factor);
    }
    geometry.computeVertexNormals();
  }
  mesh(geometry, materials.bottom, 0, pleated ? -.075 : -.04, 0, skirt);
  const waist = ring(.215, .017, materials.bottom, 0, .06, 0, skirt); waist.rotation.x = Math.PI / 2;
  box(.033, .045, .02, materials.accent, 0, .025, .218, skirt); finish(skirt);
}

export function fashionHair(head, look, materials) {
  const style = look.hairStyle;
  if (!['bob', 'ponytail', 'curly', 'pigtails', 'waves'].includes(style)) return;
  const hair = group(head, 'hair'), hasHat = (look.accessories || []).some(a => ['cap', 'explorerHat', 'toque', 'hardhat', 'spaceHelmet', 'gradCap', 'beanie', 'bucketHat', 'beret', 'fedora', 'cowboyHat'].includes(a));
  if (style === 'bob') {
    capsule(.218, .14, materials.hair, 0, .17, -.08, hair, 12).scale.set(1.15, 1, .68);
    for (const sx of [-1, 1]) capsule(.067, .21, materials.hair, sx * .222, .22, .03, hair);
    for (const x of [-.12, 0, .12]) sphere(.092, materials.hair, x, .446, .17, hair).scale.set(1, .55, .7);
  } else if (style === 'ponytail') {
    sphere(.11, materials.hair, -.035, hasHat ? .41 : .51, -.21, hair, 12);
    const tail = capsule(.093, .34, materials.hair, -.15, .25, -.25, hair, 12); tail.rotation.set(-.23, 0, .25);
    ring(.072, .016, materials.accent, -.055, hasHat ? .37 : .45, -.225, hair).rotation.x = Math.PI / 2;
  } else if (style === 'pigtails') {
    for (const sx of [-1, 1]) {
      capsule(.086, .25, materials.hair, sx * .287, .22, -.06, hair).rotation.z = sx * .32;
      sphere(.047, materials.accent, sx * .274, .355, -.04, hair, 8);
    }
  } else if (style === 'curly') {
    if (!hasHat) sphere(.275, materials.hair, 0, .4, -.02, hair, 14).scale.set(1.06, .65, 1);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, front = Math.cos(a) > .35;
      const y = hasHat ? (front ? .42 : .27) : .40 + (i % 3) * .045;
      sphere(hasHat ? .067 : .085, materials.hair, Math.sin(a) * .225, y, Math.cos(a) * .20 - .02, hair, 8);
    }
    for (const sx of [-1, 1]) for (const y of [.16, .28]) sphere(.07, materials.hair, sx * .245, y, -.055, hair, 8);
  } else {
    capsule(.205, .34, materials.hair, 0, .11, -.13, hair, 12).scale.set(1.1, 1, .65);
    for (const sx of [-1, 1]) mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * .21, .46, .01), new THREE.Vector3(sx * .25, .29, .04),
      new THREE.Vector3(sx * .215, .12, .055), new THREE.Vector3(sx * .27, -.035, .03), new THREE.Vector3(sx * .235, -.16, -.01)
    ]), 18, .055, 8, false), materials.hair, 0, 0, 0, hair);
  }
  finish(hair);
}

export function fashionAccessories({ head, torso, arms, look, materials, accessories }) {
  if (!['beanie', 'bucketHat', 'beret', 'fedora', 'cowboyHat'].some(id => accessories.has(id)) && !['handbag', 'tote', 'crossbody'].includes(look.bagStyle) && !['goldChain', 'pearls', 'heart'].includes(look.necklaceStyle)) return;
  const gold = mat(0xdab765, { m: .55, r: .34 });
  if (accessories.has('beanie')) {
    const hat = group(head, 'hat'), knit = mat(0x8662b8);
    mesh(new THREE.SphereGeometry(.286, 18, 10, 0, Math.PI * 2, 0, Math.PI * .5), knit, 0, .33, 0, hat);
    ring(.267, .038, knit, 0, .365, 0, hat).rotation.x = Math.PI / 2;
    sphere(.064, knit, 0, .66, 0, hat, 10); finish(hat);
  }
  if (accessories.has('bucketHat')) {
    const hat = group(head, 'hat'), fabric = mat(0x8abcb1);
    mesh(new THREE.CylinderGeometry(.218, .272, .20, 20), fabric, 0, .50, 0, hat);
    mesh(new THREE.CylinderGeometry(.292, .375, .074, 22), fabric, 0, .365, 0, hat);
    ring(.262, .012, mat(0xd7eee4), 0, .433, 0, hat).rotation.x = Math.PI / 2; finish(hat);
  }
  if (accessories.has('beret')) {
    const hat = group(head, 'hat'), felt = mat(0xc4708f);
    const dome = sphere(.30, felt, -.035, .51, 0, hat, 18); dome.scale.set(1.12, .39, 1); dome.rotation.z = -.17;
    ring(.25, .027, felt, 0, .42, 0, hat).rotation.x = Math.PI / 2;
    box(.025, .055, .025, felt, -.04, .638, 0, hat); finish(hat);
  }
  if (accessories.has('fedora')) {
    const hat = group(head, 'hat'), felt = mat(0xe4d0a7);
    mesh(new THREE.CylinderGeometry(.20, .252, .18, 18), felt, 0, .55, 0, hat).scale.set(1, 1, .86);
    mesh(new THREE.CylinderGeometry(.40, .415, .035, 24), felt, 0, .43, 0, hat).scale.z = .87;
    mesh(new THREE.CylinderGeometry(.249, .26, .039, 18), materials.dark, 0, .485, 0, hat).scale.z = .86; finish(hat);
  }
  if (accessories.has('cowboyHat')) {
    const hat = group(head, 'hat'), felt = mat(0xa56c46), brim = new THREE.CylinderGeometry(.43, .45, .035, 24), positions = brim.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getY(i) + Math.pow(Math.abs(positions.getX(i)) / .45, 3) * .10);
    brim.computeVertexNormals(); mesh(brim, felt, 0, .425, 0, hat).scale.z = .82;
    mesh(new THREE.CylinderGeometry(.20, .24, .24, 18), felt, 0, .56, 0, hat).scale.set(1.15, 1, .83);
    mesh(new THREE.CylinderGeometry(.239, .25, .04, 18), gold, 0, .485, 0, hat).scale.set(1.15, 1, .83); finish(hat);
  }
  if (look.bagStyle === 'handbag' || look.bagStyle === 'tote') {
    const tote = look.bagStyle === 'tote', bag = group(arms[0], 'bag'), fabric = mat(tote ? 0xe6d5b6 : 0xd28aa2), handles = mat(tote ? 0x9a704e : 0xa86480);
    const handle = ring(tote ? .073 : .077, .012, handles, -.105, -.455, .025, bag); handle.scale.set(1, 1.1, 1);
    if (tote) {
      box(.23, .26, .105, fabric, -.105, -.65, .025, bag);
      for (const x of [-.17, -.105, -.04]) box(.012, .06 + (x === -.105 ? .035 : 0), .014, gold, x, -.65, .085, bag);
      box(.21, .012, .014, handles, -.105, -.76, .084, bag);
    } else {
      const body = capsule(.085, .105, fabric, -.105, -.61, .025, bag); body.rotation.z = Math.PI / 2; body.scale.z = .66;
      box(.22, .055, .014, handles, -.105, -.555, .086, bag);
      box(.032, .025, .019, gold, -.105, -.566, .096, bag);
      box(.14, .008, .014, mat(0xe9bbcc), -.105, -.66, .088, bag);
    }
    finish(bag);
  }
  if (look.bagStyle === 'crossbody') {
    const bag = group(torso, 'bag'), leather = mat(0xa7724f), strap = mat(0x664931);
    box(.031, .66, .018, strap, .023, .31, .205, bag).rotation.z = .70;
    const body = capsule(.083, .105, leather, .293, .035, .115, bag); body.rotation.z = Math.PI / 2; body.scale.z = .72;
    box(.20, .055, .019, leather, .293, .09, .178, bag);
    box(.034, .03, .02, gold, .293, .071, .191, bag); finish(bag);
  }
  if (['goldChain', 'pearls', 'heart'].includes(look.necklaceStyle)) {
    const necklace = group(torso, 'necklace');
    if (look.necklaceStyle === 'pearls') {
      for (let i = 0; i < 11; i++) { const a = i / 10 * Math.PI; sphere(.02, mat(0xfff4df, { r: .3 }), Math.cos(a) * .135, .53 - Math.sin(a) * .115, .217, necklace, 8); }
    } else {
      const chain = ring(.126, .012, gold, 0, .53, .216, necklace, Math.PI); chain.rotation.z = Math.PI;
      if (look.necklaceStyle === 'heart') {
        const heart = new THREE.Shape(); heart.moveTo(0, -.045); heart.bezierCurveTo(-.095, .015, -.06, .085, 0, .035); heart.bezierCurveTo(.06, .085, .095, .015, 0, -.045);
        const pendant = mesh(new THREE.ExtrudeGeometry(heart, { depth: .012, bevelEnabled: true, bevelSize: .003, bevelThickness: .003, bevelSegments: 1, steps: 1, curveSegments: 8 }), mat(0xd789a3, { m: .15, r: .4 }), 0, .37, .222, necklace); pendant.scale.setScalar(.65);
        ring(.018, .006, gold, 0, .405, .225, necklace);
      }
    }
    finish(necklace);
  }
}
