'use strict';
// Ciudad ICADEM · Oficina «El expediente perdido»: caso, motor, calificación y servidor.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openSession } = require('./helpers/ciudad-server.cjs');
const game = rel => import(pathToFileURL(path.join(__dirname, '..', 'ciudad/js', rel)).href);

function steps(c, plan = {}) {
  const searched = plan.searched || c.NEEDED_SPOTS;
  const taken = plan.taken || c.DOCS.filter(d => d.belongs).map(d => d.id);
  const order = plan.order || [...c.CHRONO, ...taken.filter(id => !c.CHRONO.includes(id))];
  return [['brief'], ['index'], ...searched.map(id => ['search', { id }]), ...taken.map(id => ['take', { id }]),
    ['order', { ids: order }], ['flag', { ids: plan.flags || ['monto', 'cantidad'] }], ['resolve', { id: plan.resolution || 'retener' }],
    ['file', { cabinet: plan.cabinet || 'C' }], ['debrief', { reasons: plan.reasons || ['trazabilidad', 'no-alterar'] }]];
}
const play = (run, c, plan) => { for (const [type, p] of steps(c, plan)) assert.equal(run.act(type, p || {}), true, 'paso válido: ' + type + ' ' + JSON.stringify(p)); return run; };

test('oficina: el caso es coherente', async () => {
  const c = await game('missions/lost-file-logic.js');
  const mine = c.DOCS.filter(d => d.belongs);
  assert.equal(mine.length, 5); assert.ok(mine.every(d => d.folio === c.FOLIO));
  assert.ok(c.DOCS.filter(d => !d.belongs).every(d => d.folio !== c.FOLIO), 'los parecidos tienen otro folio');
  assert.deepEqual(c.CHRONO, [...mine].sort((a, b) => a.date.localeCompare(b.date)).map(d => d.id), 'el orden cronológico coincide con las fechas');
  for (const d of c.DOCS) assert.equal(c.SPOTS.filter(s => s.docs.includes(d.id)).length, 1, d.id + ' está en un solo lugar');
  assert.deepEqual([...c.NEEDED_SPOTS].sort(), ['C1', 'C2', 'D1', 'scan']);
  const val = (id, k) => c.docById(id).fields.find(f => f[0] === k)[1];
  assert.notEqual(val('fac', 'Total'), val('oc', 'Total autorizado'), 'el monto no cuadra');
  assert.notEqual(val('rec', 'Cantidad recibida'), val('fac', 'Cantidad'), 'la cantidad no cuadra');
  assert.equal(c.RESOLUTIONS.filter(r => r.correct).length, 1);
});

test('oficina: sin atajos y el caso perfecto da 100', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/lost-file-logic.js');
  const def = defineMission(c.LOST_FILE_MISSION), run = new MissionRun(def);
  run.act('brief');
  assert.equal(run.act('search', { id: 'C1' }), false, 'primero el registro de control');
  run.act('index');
  assert.equal(run.act('take', { id: 'sol' }), false, 'no se toma de un cajón sin abrirlo');
  run.act('search', { id: 'C1' }); assert.equal(run.act('take', { id: 'sol' }), true);
  assert.equal(run.act('order', { ids: ['sol'] }), false, 'no se ordena sin tener los cinco');
  assert.equal(run.act('take', { id: 'fac' }), false, 'la factura está en la bandeja del escáner');
  const perfect = play(new MissionRun(def), c);
  assert.deepEqual([perfect.evaluate().score, perfect.evaluate().passed], [100, true]);
  assert.equal(replay(def, perfect.log).result.score, 100);
});

test('oficina: cada error pesa lo suyo', async () => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/lost-file-logic.js');
  const def = defineMission(c.LOST_FILE_MISSION);
  const ev = plan => play(new MissionRun(def), c, plan).evaluate();
  assert.equal(ev({ searched: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'scan'] }).breakdown.busqueda, 10, 'abrir todo sin consultar el registro');
  const greedy = ev({ searched: ['C1', 'C2', 'D1', 'scan'], taken: ['sol', 'cot', 'oc', 'rec', 'fac', 'x1', 'x3'] });
  assert.equal(greedy.breakdown.busqueda, 10, 'tomar folios parecidos');
  assert.equal(ev({ order: ['cot', 'sol', 'oc', 'rec', 'fac'] }).breakdown.orden, 10, 'dos pares fuera de lugar');
  assert.equal(ev({ order: ['sol', 'cot', 'oc', 'fac', 'rec'] }).breakdown.orden, 10);
  assert.equal(ev({ order: ['fac', 'rec', 'oc', 'cot', 'sol'] }).breakdown.orden, 0);
  assert.equal(ev({ flags: ['monto', 'fechas'] }).breakdown.inconsistencias, 5);
  assert.equal(ev({ resolution: 'corregir' }).breakdown.resolucion, 0, 'no se altera un documento');
  assert.equal(ev({ cabinet: 'D' }).breakdown.archivo, 0);
  assert.equal(ev({ reasons: ['rapidez'] }).breakdown.justificacion, 0);
  assert.equal(ev({ flags: ['fechas', 'firma'], resolution: 'pagar', cabinet: 'D', order: ['fac', 'rec', 'oc', 'cot', 'sol'] }).passed, false);
});

test('oficina: recompensa una sola vez y el servidor valida por socket', async t => {
  const { defineMission, MissionRun } = await game('missions/engine.js');
  const c = await game('missions/lost-file-logic.js');
  const { REWARDS } = await game('economy/economy.js');
  assert.deepEqual(REWARDS[c.MISSION_ID], { amount: 20, xp: 160, repeatXp: 40 });
  const s = await openSession(t, 'oficina'); if (!s) return t.skip('npm install en _ciudad-server');
  const run = play(new MissionRun(defineMission(c.LOST_FILE_MISSION)), c);
  assert.equal((await s.mission(c.MISSION_ID, run.log.filter(e => !(e.type === 'search' && e.payload.id === 'scan')))).ok, false, 'no se puede tomar la factura sin revisar la bandeja');
  const a = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([a.ok, a.score, a.credits], [true, 100, 20]);
  const b = await s.mission(c.MISSION_ID, run.log); assert.deepEqual([b.ok, b.credits], [true, 0]);
});
