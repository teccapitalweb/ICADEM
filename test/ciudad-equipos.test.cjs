'use strict';
// Ciudad ICADEM · misiones en equipo: el servidor guarda el intento, hace cumplir los roles y el
// consenso, y entrega el resultado a cada integrante sin duplicar recompensas.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openServer } = require('./helpers/ciudad-server.cjs');
const load = rel => import(pathToFileURL(path.join(__dirname, '..', rel)).href);

const TORRE = 'torre-desafio-equipos', TRIBUNAL = 'tribunal-tu-eres-el-juez';
const TOWER_STEPS = [['budget', { computers: 'nuevo', contingency: 5 }, 'finanzas'], ['permits', { ids: ['uso-suelo', 'construccion', 'proteccion-civil'] }, 'legal'],
  ['schedule', { ids: ['tramites', 'cimentacion', 'estructura', 'instalaciones', 'mobiliario'] }, 'operaciones'], ['message', { text: 'claro', channels: ['asamblea', 'carteles'] }, 'comunicacion']];
const COURT_STEPS = [['takeCase', { id: 'exp-014' }, 'juez'], ['readBackground', {}, 'abogadoA'], ...['contrato', 'inventario', 'cotizacion', 'mensajes', 'fotos'].map(id => ['examineExhibit', { id }, 'abogadoB'])];

async function hubWithTeam(mission, roles) {
  const { Hub } = await load('_ciudad-server/hub.js');
  const { defineMission } = await load('ciudad/js/missions/engine.js');
  const defs = { [TORRE]: (await load('ciudad/js/missions/tower-challenge-logic.js')).TOWER_CHALLENGE_MISSION, [TRIBUNAL]: (await load('ciudad/js/missions/court-judge-logic.js')).COURT_JUDGE_MISSION };
  const hub = new Hub({ now: () => 0, salt: 's', missions: new Map([[mission, defineMission(defs[mission])]]) });
  const players = roles.map((r, i) => hub.join({ uid: 'u' + i, name: 'P' + i }).player);
  const room = hub.createRoom(players[0], { mission }).room;
  players.slice(1).forEach(p => hub.joinRoom(p, room.code));
  players.forEach((p, i) => { assert.equal(hub.setRole(p, roles[i]).ok, true); hub.setReady(p, true); });
  return { hub, room, players };
}

test('equipo (Torre): roles, consenso y bitácora del servidor', async () => {
  const { hub, room, players: [fin, leg, ops] } = await hubWithTeam(TORRE, ['finanzas', 'legal', 'operaciones']);
  const outsider = hub.join({ uid: 'x', name: 'X' }).player;
  assert.equal(hub.coopAct(fin, 'brief').reason, 'sin-intento', 'sin iniciar no hay intento');
  assert.equal(hub.startRoom(fin).ok, true); assert.equal(room.status, 'en-curso');
  assert.equal(hub.setRole(leg, 'finanzas').reason, 'en-curso', 'los roles quedan fijos durante el intento');
  assert.equal(hub.joinRoom(outsider, room.code).reason, 'sala-cerrada');
  assert.equal(hub.coopAct(outsider, 'brief').reason, 'sin-intento', 'quien no es del equipo no toca el intento');
  assert.equal(hub.coopAct(fin, 'brief').ok, true);
  assert.equal(hub.coopAct(leg, 'budget', TOWER_STEPS[0][1]).reason, 'no-es-tu-rol', 'el presupuesto le toca a finanzas');
  assert.equal(hub.coopAct(fin, 'budget', { computers: 'nuevo', contingency: 99 }).reason, 'no-procede', 'el motor valida los datos');
  assert.equal(hub.coopAct(fin, 'evaluate').reason, 'accion'); assert.equal(hub.coopAct(fin, 'budget', [1, 2]).reason, 'datos');
  assert.equal(hub.coopAct(fin, 'budget', { computers: 'x'.repeat(2000), contingency: 5 }).reason, 'datos', 'datos enormes se rechazan');
  for (const [type, payload, role] of TOWER_STEPS.slice(0, 3)) assert.equal(hub.coopAct([fin, leg, ops].find((_, i) => ['finanzas', 'legal', 'operaciones'][i] === role), type, payload).ok, true, type);
  assert.equal(hub.coopAct(fin, 'message', TOWER_STEPS[3][1]).ok, true, 'nadie tiene Comunicación: cualquiera del equipo la cubre');
  assert.equal(hub.coopAct(leg, 'approve', { role: 'finanzas' }).ok, true);
  assert.deepEqual(room.session.run.state.approvals, ['legal'], 'el rol de quien aprueba lo pone el servidor, no el navegador');
  assert.equal(hub.coopAct(leg, 'present', { reasons: ['especialidad'] }).reason, 'faltan-aprobaciones');
  assert.equal(hub.coopAct(ops, 'reopen', { id: 'budget' }).ok, true, 'revisión cruzada: se puede pedir rehacer una parte');
  assert.deepEqual(room.session.run.state.approvals, [], 'rehacer borra las aprobaciones');
  assert.equal(hub.coopAct(leg, 'approve').reason, 'no-procede', 'no se aprueba con una estación pendiente');
  assert.equal(hub.coopAct(fin, 'budget', TOWER_STEPS[0][1]).ok, true);
  hub.coopAct(fin, 'approve'); hub.coopAct(leg, 'approve');
  hub.detach(ops);
  const r = hub.coopAct(fin, 'present', { reasons: ['especialidad', 'dependencias'] });
  assert.equal(r.ok, true, 'si alguien se desconecta, el consenso es de los conectados'); assert.equal(r.complete, true);
  assert.equal(r.result.score, 100); assert.equal(room.status, 'espera'); assert.ok([...room.members.values()].every(m => !m.ready));
  assert.equal(hub.coopAct(fin, 'present', { reasons: ['especialidad'] }).reason, 'sin-intento', 'un intento cerrado no admite más acciones');
  const { replay } = await load('ciudad/js/missions/engine.js');
  assert.equal(replay(r.session.run.def, r.session.run.log).result.score, 100, 'la bitácora del equipo se reproduce igual');
  assert.equal(JSON.stringify(hub.coopView(room)).includes('"uid"'), false, 'la vista del intento no expone identificadores internos');
});

test('equipo (Tribunal): cada rol hace su parte de la audiencia', async () => {
  const { hub, room, players: [juez, actora, demandada, testigo] } = await hubWithTeam(TRIBUNAL, ['juez', 'abogadoA', 'abogadoB', 'testigo']);
  const by = { juez, abogadoA: actora, abogadoB: demandada, testigo };
  assert.equal(hub.startRoom(juez).ok, true);
  assert.equal(hub.coopAct(testigo, 'takeCase', { id: 'exp-014' }).reason, 'no-es-tu-rol', 'solo el juez pide el expediente');
  for (const [type, payload, role] of COURT_STEPS) assert.equal(hub.coopAct(by[role], type, payload).ok, true, type);
  assert.equal(hub.coopAct(demandada, 'openHearing').reason, 'no-es-tu-rol');
  assert.equal(hub.coopAct(juez, 'openHearing').ok, true);
  assert.equal(hub.coopAct(demandada, 'hearParty', { side: 'actora' }).reason, 'no-es-tu-rol', 'cada abogado presenta a su parte');
  assert.equal(hub.coopAct(actora, 'hearParty', { side: 'actora' }).ok, true); assert.equal(hub.coopAct(demandada, 'hearParty', { side: 'demandada' }).ok, true);
  assert.equal(hub.coopAct(actora, 'ruleObjection', { id: 'sugestiva', ruling: 'ha-lugar' }).reason, 'no-es-tu-rol', 'las objeciones las resuelve el juez');
  hub.coopAct(juez, 'ruleObjection', { id: 'sugestiva', ruling: 'ha-lugar' }); hub.coopAct(juez, 'ruleObjection', { id: 'fecha', ruling: 'no-ha-lugar' });
  assert.equal(hub.coopAct(juez, 'examineWitness', { id: 'ruben' }).reason, 'no-es-tu-rol', 'el testigo sube al estrado');
  assert.equal(hub.coopAct(testigo, 'examineWitness', { id: 'ruben' }).ok, true);
  assert.equal(hub.coopAct(testigo, 'askWitness', { witness: 'ruben', id: 'r-boiler' }).reason, 'no-es-tu-rol', 'las preguntas las hacen los abogados');
  assert.equal(hub.coopAct(actora, 'askWitness', { witness: 'ruben', id: 'r-boiler' }).ok, true);
  hub.coopAct(juez, 'ruleObjection', { id: 'oidas', ruling: 'ha-lugar' }); hub.coopAct(testigo, 'examineWitness', { id: 'sofia' }); hub.coopAct(demandada, 'askWitness', { witness: 'sofia', id: 's-vidrio' });
  assert.equal(hub.coopAct(demandada, 'confront', { marks: { 'd-ernesto': 'mensajes', 'd-ruben': 'cotizacion', 'd-marta': null, 'd-sofia': null, 'd-edad': null } }).ok, true);
  const { EXHIBITS } = await load('ciudad/js/missions/court-judge-logic.js');
  for (const e of EXHIBITS) assert.equal(hub.coopAct(juez, 'weigh', { id: e.id, weight: e.best }).ok, true);
  assert.equal(hub.coopAct(actora, 'rule', { ruling: 'parcial', grounds: ['vidrio'] }).reason, 'no-es-tu-rol', 'la sentencia es del juez');
  const r = hub.coopAct(juez, 'rule', { ruling: 'parcial', grounds: ['vidrio', 'recibido'] });
  assert.equal(r.complete, true); assert.equal(r.result.score, 100); assert.equal(room.status, 'espera');
});

test('equipo (Tribunal): con dos personas, el juez cubre los roles que faltan', async () => {
  const { hub, players: [juez, abogado] } = await hubWithTeam(TRIBUNAL, ['juez', 'abogadoA']);
  hub.startRoom(juez); hub.coopAct(juez, 'takeCase', { id: 'exp-014' }); hub.coopAct(juez, 'readBackground');
  for (const id of ['contrato', 'inventario', 'cotizacion', 'mensajes', 'fotos']) hub.coopAct(abogado, 'examineExhibit', { id });
  hub.coopAct(juez, 'openHearing');
  assert.equal(hub.coopAct(juez, 'hearParty', { side: 'actora' }).reason, 'no-es-tu-rol', 'la actora tiene abogado conectado');
  assert.equal(hub.coopAct(juez, 'hearParty', { side: 'demandada' }).ok, true, 'el demandado no tiene abogado: lo cubre el equipo');
});

test('equipo (socket real): estado compartido, reconexión y recompensa sin duplicar', async t => {
  const s = await openServer(t); if (!s) return t.skip('npm install en _ciudad-server');
  const ana = await s.client('ana'), beto = await s.client('beto');
  ana.tell({ t: 'room', op: 'create', mission: TORRE }); const code = (await ana.wait('room', m => m.room)).room.code;
  beto.tell({ t: 'room', op: 'join', code }); await beto.wait('room', m => m.room && m.room.members.length === 2);
  ana.tell({ t: 'room', op: 'role', role: 'finanzas' }); beto.tell({ t: 'room', op: 'role', role: 'legal' });
  await ana.wait('room', m => m.room && m.room.members.every(x => x.role));
  ana.tell({ t: 'room', op: 'ready', ready: true }); beto.tell({ t: 'room', op: 'ready', ready: true });
  await ana.wait('room', m => m.room && m.room.members.every(x => x.ready));
  ana.tell({ t: 'room', op: 'start' }); const start = await beto.wait('coop', m => m.op === 'start');
  assert.deepEqual([start.mission, start.log.length, start.online.sort()], [TORRE, 0, ['finanzas', 'legal']]);

  const act = (ws, type, payload) => ws.tell({ t: 'coop', op: 'act', type, payload });
  act(beto, 'brief'); assert.equal((await ana.wait('coop', m => m.op === 'state')).last.name, 'beto', 'todos ven quién hizo qué');
  act(beto, 'budget', TOWER_STEPS[0][1]); const no = await beto.wait('coop', m => m.op === 'rejected');
  assert.deepEqual([no.reason, no.log.length], ['no-es-tu-rol', 1], 'el rechazo trae la bitácora real para corregir al cliente');
  act(ana, 'budget', TOWER_STEPS[0][1]); act(beto, 'permits', TOWER_STEPS[1][1]); act(ana, 'schedule', TOWER_STEPS[2][1]);
  await ana.wait('coop', m => m.op === 'state' && m.log.length === 4);

  // beto pierde la conexión y vuelve: recupera sala e intento
  beto.terminate();
  const beto2 = await s.client('beto2', { resume: beto.welcome.resume });
  assert.equal(beto2.welcome.room.session, start.session);
  const sync = await beto2.wait('coop', m => m.op === 'sync'); assert.equal(sync.log.length, 4);
  act(beto2, 'message', TOWER_STEPS[3][1]); await ana.wait('coop', m => m.op === 'state' && m.log.length === 5);
  act(ana, 'approve'); act(ana, 'present', { reasons: ['especialidad'] });
  assert.equal((await ana.wait('coop', m => m.op === 'rejected')).reason, 'faltan-aprobaciones');
  act(beto2, 'approve'); await ana.wait('coop', m => m.op === 'state' && m.log.length === 7);
  act(ana, 'present', { reasons: ['especialidad', 'dependencias'] });
  const [da, db] = [await ana.wait('coop', m => m.op === 'done'), await beto2.wait('coop', m => m.op === 'done')];
  assert.deepEqual([da.score, da.credits, db.score, db.credits], [100, 20, 100, 20], 'cada integrante recibe su resultado del servidor');
  const pa = await ana.wait('profile', m => m.op === 'mission'); assert.equal(pa.profile.missions[TORRE].completed, true);

  // otra vuelta en equipo, o la misión individual: ya no se acreditan créditos otra vez
  ana.drain(); beto2.drain();
  ana.tell({ t: 'room', op: 'ready', ready: true }); beto2.tell({ t: 'room', op: 'ready', ready: true }); await ana.wait('room', m => m.room && m.room.members.every(x => x.ready));
  ana.tell({ t: 'room', op: 'start' }); await ana.wait('coop', m => m.op === 'start');
  const fullLog = [['brief'], ...TOWER_STEPS, ['approve', { role: 'finanzas' }], ['present', { reasons: ['especialidad'] }]].map(([type, payload]) => ({ type, payload: payload || {} }));
  ana.tell({ t: 'profile', op: 'mission', mission: TORRE, log: fullLog }); const solo = await ana.wait('profile', m => m.op === 'mission');
  assert.deepEqual([solo.ok, solo.credits], [true, 0], 'la versión individual no vuelve a pagar');
});
