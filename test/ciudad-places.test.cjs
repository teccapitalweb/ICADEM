'use strict';
// Ciudad ICADEM · cada edificio abierto tiene escenario en red, puerta y punto de llegada coherentes.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = rel => import(pathToFileURL(path.join(__dirname, '..', rel)).href);

test('lugares: todo edificio abierto es jugable en red, con entrada y salida registradas en el servidor', async () => {
  const { PLACES } = await load('ciudad/js/world/places.js');
  const { BUILDINGS, doorPoint } = await load('ciudad/js/world/buildings.js');
  const { SCENE_RULES, ENTRY_RADIUS } = await load('ciudad/js/net/scenes.js');
  const { NET_SCENES } = await load('ciudad/js/net/network.js');
  const open = BUILDINGS.filter(b => b.status === 'open' && b.id !== 'casa');
  assert.ok(open.length >= 5);
  for (const b of open) {
    const place = PLACES.find(p => p.building === b.id);
    assert.ok(place, `${b.id}: tiene lugar en places.js`);
    assert.ok(NET_SCENES.includes(place.scene), `${place.scene}: está en NET_SCENES`);
    const rule = SCENE_RULES[place.scene];
    assert.ok(rule, `${place.scene}: tiene reglas de red`);
    assert.deepEqual(rule.links, ['plaza'], `${place.scene}: solo se conecta con la plaza`);
    assert.ok(SCENE_RULES.plaza.links.includes(place.scene), `plaza → ${place.scene}`);
    const at = place.arrival || doorPoint(b, 7.4);
    assert.ok(SCENE_RULES.plaza.entries.some(([x, z]) => Math.hypot(at.x - x, at.z - z) < 0.2), `${place.scene}: su punto de llegada está en las entradas de la plaza`);
    assert.ok(rule.entries.every(([x, z]) => x >= rule.bounds.minX && x <= rule.bounds.maxX && z >= rule.bounds.minZ && z <= rule.bounds.maxZ), `${place.scene}: su entrada está dentro de sus límites`);
    void ENTRY_RADIUS;
  }
  // y ningún edificio «próximamente» tiene escena en red a medias
  for (const b of BUILDINGS.filter(x => x.status === 'soon')) {
    const place = PLACES.find(p => p.building === b.id);
    assert.ok(!place || !SCENE_RULES[place.scene], `${b.id}: no tiene escena en red mientras está cerrado`);
  }
});
