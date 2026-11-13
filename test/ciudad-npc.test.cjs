'use strict';
// Ciudad ICADEM · personajes educativos: rodean obstáculos para acercarse, no persiguen sin fin
// y las distancias de acercamiento y desistimiento son coherentes (la causa de la prueba intermitente).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);

test('NPC: rodea una pared o una banca para llegar a platicar, sin atravesarlas', async () => {
  const { Npc } = await load('ciudad/js/characters/npc.js');
  const { CollisionWorld } = await load('ciudad/js/core/collision.js');
  for (const [name, box] of [['pared ancha', [1.5, -2, 2.5, 2]], ['banca', [1.6, -0.6, 2.4, 0.6]]]) {
    const world = new CollisionWorld(); world.addBox(...box);
    const n = new Npc({ look: {}, x: 0, z: 0, route: [[0, 0], [0, 5]] });
    n.approach = { x: 5, z: 0.2, stop: 1.7, collision: world };
    let t = 0, inside = false;
    for (; t < 9 && !n.approach.arrived; t += 1 / 30) {
      n.update(1 / 30, { x: 5, z: 0.2 });
      const p = n.group.position; if (p.x > box[0] && p.x < box[2] && p.z > box[1] && p.z < box[3]) inside = true;
    }
    assert.equal(n.approach.arrived, true, `${name}: llega (t=${t.toFixed(1)}s, pos ${n.group.position.x.toFixed(2)},${n.group.position.z.toFixed(2)})`);
    assert.equal(inside, false, `${name}: nunca atraviesa el obstáculo`);
  }
});

test('NPC: reglas de acercamiento coherentes (no se elige a alguien del que de inmediato desistiría)', async () => {
  const { NPC_RULES } = await load('ciudad/js/edu/npc-quiz.js');
  assert.ok(NPC_RULES.leave > NPC_RULES.reach + 1, 'desiste lejos de donde lo eligió');
  assert.ok(NPC_RULES.giveUp <= 10, 'no persigue indefinidamente');
  assert.ok(NPC_RULES.perNpc >= 120 && NPC_RULES.afterDecline >= 120, 'después de un «Ahora no» deja en paz al jugador');
});
