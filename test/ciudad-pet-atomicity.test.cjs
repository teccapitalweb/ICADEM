'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(path.join(__dirname, '..', file)).href);

test('mascota: un accesorio rechazado no expone ni guarda un nombre o equipamiento parcial', async () => {
  const { Profiles, MemoryStorage } = await load('_ciudad-server/profiles.js');
  const db = new Profiles({ storage: new MemoryStorage(), missions: new Map() }), uid = 'qa-pet-atomic';
  const adopted = await db.vivo(uid, 'adopt', { breed: 'mestizo-canela', name: 'Canela', rid: 'qa-pet-atomic-adopt' });
  assert.equal(adopted.ok, true);
  const before = await db.get(uid);
  for (const acc of [{ leash: 'correa-roja' }, { collar: null, leash: 'correa-roja' }, { collar: null, invalidSlot: null }]) {
    const result = await db.vivo(uid, 'pet', { id: adopted.pet.id, name: 'Luna', active: false, acc });
    assert.equal(result.ok, false);
    assert.match(result.reason, /^(no-lo-tienes|no-compatible)$/);
    assert.deepEqual(result.profile, before, 'el rechazo sólo puede devolver el perfil confirmado');
    assert.deepEqual(await db.get(uid), before, 'ni revisión, moneda, mascota ni nombre cambian');
  }
});

test('mascota: validar copia conserva la atomicidad de la regla y permite cambios completos válidos', async () => {
  const { emptyVivo, applyVivo } = await load('ciudad/js/vivo/vivo-rules.js');
  const p = { xp: 0, ...emptyVivo() };
  const adopted = applyVivo(p, 'adopt', { breed: 'mestizo-canela', name: 'Canela', rid: 'qa-pet-pure-adopt' });
  const before = structuredClone(p);
  assert.equal(applyVivo(p, 'pet', { id: adopted.pet.id, name: 'Luna', acc: { collar: null, leash: 'correa-roja' } }).reason, 'no-lo-tienes');
  assert.deepEqual(p, before, 'la regla pura tampoco deja modificaciones parciales');
  assert.equal(applyVivo(p, 'buy', { item: 'correa-roja', rid: 'qa-pet-pure-leash' }).ok, true);
  const result = applyVivo(p, 'pet', { id: adopted.pet.id, name: 'Luna', acc: { collar: null, leash: 'correa-roja' }, active: true });
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(p.pets[0], { id: adopted.pet.id, breed: 'mestizo-canela', name: 'Luna', acc: { leash: 'correa-roja' } });
  assert.equal(p.activePet, adopted.pet.id);
  assert.deepEqual(result.pet, p.pets[0]);
});
