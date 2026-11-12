'use strict';
// Ciudad ICADEM · Fase 1.1: presencia real, privacidad, códigos de invitación, retos de NPC,
// minijuegos con semilla y minijuegos validados por posición.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openServer } = require('./helpers/ciudad-server.cjs');
const load = rel => import(pathToFileURL(path.join(__dirname, '..', rel)).href);

test('presencia: cuenta solo sesiones reales conectadas y expira a los desconectados', async () => {
  const { Hub, LIMITS } = await load('_ciudad-server/hub.js');
  let t = 0; const hub = new Hub({ now: () => t, salt: 's', capacity: 2 });
  const [a, b, c] = ['a', 'b', 'c'].map(u => hub.join({ uid: u, name: u.toUpperCase() }).player);
  assert.deepEqual(hub.presence(a), { city: 3, instance: 2 }, 'tres en la ciudad, dos en la instancia de A (capacidad 2)');
  assert.deepEqual(hub.presence(c), { city: 3, instance: 1 });
  hub.detach(b); assert.equal(hub.presence(a).city, 2, 'quien perdió la conexión ya no cuenta');
  t += LIMITS.resumeMs; hub.sweep(); assert.equal(hub.byUid.has('b'), false, 'y su lugar expira');
  assert.deepEqual(hub.roster(a.instance, a), [], 'la lista no incluye a uno mismo ni a desconectados');
});

test('privacidad: quien no quiere aparecer se muestra como «Jugador privado» salvo para sus conexiones y su equipo', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const hub = new Hub({ now: () => 0, salt: 's' });
  const [ana, beto, caro] = ['ana', 'beto', 'caro'].map(u => hub.join({ uid: u, name: u }).player);
  ana.listed = false;
  assert.equal(hub.nameFor(beto, ana), 'Jugador privado');
  assert.equal(hub.nameFor(ana, ana), 'ana');
  ana.friends = new Set(['caro']); caro.friends = new Set(['ana']);
  assert.equal(hub.nameFor(caro, ana), 'ana', 'una conexión mutua sí ve su nombre');
  hub.createRoom(ana, { mission: null }); const code = hub.createCode(ana, {}).code; hub.redeemCode(beto, code);
  assert.equal(hub.nameFor(beto, ana), 'ana', 'su equipo también');
  assert.equal(JSON.stringify(hub.roster(ana.instance, beto)).includes('"uid"'), false);
});

test('códigos de invitación: vencen, tienen usos, se revocan y no cruzan equipos llenos', async () => {
  const { Hub, LIMITS } = await load('_ciudad-server/hub.js');
  let t = 0; const hub = new Hub({ now: () => t, salt: 's', capacity: 3 });
  const ps = ['a', 'b', 'c', 'd', 'e', 'f'].map(u => hub.join({ uid: u, name: u }).player), [a, b, c, d, e, f] = ps;
  hub.capacity = 10;   // dos instancias ya formadas; ahora hay lugar para mudarse
  const r = hub.createCode(a, { uses: 2, minutes: 10 });
  assert.equal(r.ok, true); assert.match(r.code, /^[A-HJ-NP-Z2-9]{8}$/); assert.ok(a.room, 'si no tenía equipo, se crea uno');
  assert.equal(hub.redeemCode(a, r.code).reason, 'es-tu-codigo');
  assert.equal(hub.redeemCode(b, 'XXXXXXXX').reason, 'codigo-invalido');
  assert.notEqual(f.instance, a.instance); const ok = hub.redeemCode(f, r.code.toLowerCase()); assert.equal(ok.ok, true);
  assert.equal(f.instance, a.instance, 'quien canjea pasa a la instancia de quien invitó'); assert.ok(ok.moved);
  assert.equal(hub.redeemCode(c, r.code).ok, true); assert.equal(hub.redeemCode(d, r.code).reason, 'codigo-invalido', 'agotó sus dos usos');
  const r2 = hub.createCode(a, { minutes: 10 }); t += 10 * 60000 + 1;
  assert.equal(hub.redeemCode(d, r2.code).reason, 'codigo-invalido', 'venció');
  const r3 = hub.createCode(a, {}); assert.equal(hub.revokeCode(b, r3.code).reason, 'codigo-invalido', 'solo quien lo creó lo revoca');
  assert.equal(hub.revokeCode(a, r3.code).ok, true); assert.equal(hub.redeemCode(d, r3.code).reason, 'codigo-invalido');
  const r4 = hub.createCode(a, {}); assert.equal(hub.redeemCode(d, r4.code).ok, true); assert.equal(hub.createCode(a, {}).reason, 'equipo-lleno');
  for (let i = 0; i < 3; i++) hub.createCode(e, {}); assert.equal(hub.createCode(e, {}).reason, 'demasiados-codigos');
  assert.equal(LIMITS.codeMaxMs, 2 * 3600000); const long = hub.createCode(b, { minutes: 9999 });
  assert.ok(hub.codesOf(b).find(x => x.code === long.code).expiresIn <= 7200, 'la vigencia tiene tope de 2 horas');
});

test('banco de preguntas: completo, correcto en su forma y con fuente en lo que depende de reglas vigentes', async () => {
  const { QUESTIONS, CATEGORIES, LEVELS } = await load('ciudad/js/edu/questions.js');
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(!ids.has(q.id), 'id repetido ' + q.id); ids.add(q.id);
    assert.ok(CATEGORIES[q.cat] && LEVELS[q.level], q.id);
    assert.ok(q.options.length >= 3 && q.options.length <= 4 && new Set(q.options).size === q.options.length, q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id);
    assert.ok(q.explain && q.explain.length > 8, q.id);
    if (q.volatile) assert.ok(q.source && /^\d{4}-\d{2}$/.test(q.reviewed), q.id + ': lo vigente lleva fuente y fecha de revisión');
    assert.doesNotMatch(q.q, /tu nombre|tu edad|dónde vives|tu escuela|tu correo|tu teléfono/i, 'no se piden datos personales');
  }
  for (const c of Object.keys(CATEGORIES)) assert.ok(QUESTIONS.filter(q => q.cat === c).length >= 5, 'categoría con pocas preguntas: ' + c);
  assert.ok(QUESTIONS.filter(q => q.level === 'infantil').length >= 15);
  const sat = QUESTIONS.find(q => q.id === 'mex-sat'); assert.equal(sat.options[sat.answer], 'Servicio de Administración Tributaria');
});

test('XP de retos y minijuegos: tope diario, sin repetir la misma pregunta y bono único', async () => {
  const { emptyPlay, rewardQuiz, rewardActivity, QUIZ_DAILY, playAchievements } = await load('ciudad/js/edu/play-rules.js');
  const play = emptyPlay(), day = Date.parse('2026-11-12T18:00:00Z');
  assert.equal(rewardQuiz(play, 'q1', false, day).xp, 0);
  assert.equal(rewardQuiz(play, 'q1', true, day).xp, 10);
  assert.equal(rewardQuiz(play, 'q1', true, day).why, 'repetida', 'contestar otra vez la misma pregunta no da XP');
  for (let i = 2; i <= QUIZ_DAILY; i++) rewardQuiz(play, 'q' + i, true, day);
  assert.equal(rewardQuiz(play, 'q99', true, day).why, 'tope-diario');
  assert.equal(rewardQuiz(play, 'q99', true, day + 86400000).xp, 10, 'al día siguiente vuelve a contar');
  assert.equal(rewardQuiz(play, 'q1', true, day + 3 * 86400000).xp, 0, 'la misma pregunta espera 7 días');
  assert.equal(rewardQuiz(play, 'q1', true, day + 8 * 86400000).xp, 10);
  const g1 = rewardActivity(play, 'memoria', 100, day); assert.deepEqual([g1.xp, g1.bonus], [50, 20]);
  const g2 = rewardActivity(play, 'memoria', 100, day); assert.deepEqual([g2.xp, g2.bonus], [30, 0]);
  assert.equal(rewardActivity(play, 'memoria', 100, day).xp, 0, 'tope diario por minijuego (60 XP)');
  assert.ok(playAchievements(play).includes('mente-curiosa') && playAchievements(play).includes('memoria-de-oro'));
});

test('minijuegos con semilla: la misma semilla da la misma partida y la calificación sale de la bitácora', async () => {
  const { ACTIVITIES, checkActivity, SORT_THEMES } = await load('ciudad/js/edu/activities.js');
  // Memoria: jugar perfecto conociendo la partida
  const mem = ACTIVITIES.memoria.build(1234, 'medio'); assert.equal(mem.cards.length, 12);
  assert.deepEqual(ACTIVITIES.memoria.build(1234, 'medio'), mem, 'determinista');
  const byPair = {}; mem.cards.forEach((c, i) => (byPair[c.pair] = byPair[c.pair] || []).push(i));
  const perfect = Object.values(byPair).flat();
  assert.equal(checkActivity('memoria', 1234, 'medio', perfect).score, 100);
  assert.equal(checkActivity('memoria', 1234, 'medio', perfect.slice(0, 4)).valid, false, 'sin terminar no vale');
  assert.equal(checkActivity('memoria', 1234, 'medio', [0, 0, ...perfect]).valid, false, 'la misma carta dos veces no vale');
  // Matemáticas: el servidor calcula las respuestas
  for (const level of ACTIVITIES.matematicas.levels) {
    const m = ACTIVITIES.matematicas.build(77, level), right = ACTIVITIES.matematicas.solve(77, level);
    m.problems.forEach((p, i) => assert.ok(p.options.includes(right[i]) && p.options.length >= 3, level + ' ' + p.text));
    const evalText = t => Function('return ' + t.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/(\d+) % de (\d+)/, '($1/100*$2)'))();
    m.problems.forEach((p, i) => assert.equal(evalText(p.text), right[i], 'la respuesta es la operación: ' + p.text));
    assert.equal(checkActivity('matematicas', 77, level, right).score, 100);
    assert.equal(checkActivity('matematicas', 77, level, right.map((v, i) => i < 5 ? m.problems[i].options.find(o => o !== v) : v)).score, 50);
    assert.equal(checkActivity('matematicas', 77, level, right.map(() => -999)).valid, false, 'solo se aceptan opciones mostradas');
  }
  // Idiomas y clasificación
  const lang = ACTIVITIES.idiomas.build(5, 'general'); assert.equal(checkActivity('idiomas', 5, 'general', lang.rounds.map(r => r.answer)).score, 100);
  const sort = ACTIVITIES.clasificacion.build(9, 'reciclaje');
  assert.equal(checkActivity('clasificacion', 9, 'reciclaje', sort.items.map(i => ({ id: i.id, bin: SORT_THEMES.reciclaje.items[i.id][1] }))).score, 100);
  assert.equal(checkActivity('clasificacion', 9, 'reciclaje', sort.items.map(i => ({ id: i.id, bin: 'organico' }))).valid, true);
  assert.equal(checkActivity('memoria', -1, 'medio', perfect).valid, false); assert.equal(checkActivity('memoria', 1, 'imposible', perfect).valid, false);
});

test('carrera y tesoro: el servidor solo acepta puntos donde de verdad estuvo el jugador', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const { RACE, TREASURES, treasureRounds } = await load('ciudad/js/edu/activities.js');
  let t = 0; const hub = new Hub({ now: () => t, salt: 's' });
  const p = hub.join({ uid: 'a', name: 'A' }).player;
  const at = (scene, x, z, y = 0) => { p.state = { scene, x, y, z, yaw: 0, anim: 'run' }; p.stateAt = t; };
  at('plaza', 0, 9); assert.equal(hub.playStart(p, 'carrera').reason, 'fuera-del-parque');
  at('park', 0, 8); assert.equal(hub.playStart(p, 'carrera').ok, true);
  assert.equal(hub.playCheck(p, { i: 1 }).reason, 'fuera-de-orden');
  t += 500; at('park', 0, 8); assert.equal(hub.playCheck(p, { i: 0 }).next, 1);
  t += 500; at('park', 20, 20); assert.equal(hub.playCheck(p, { i: 1 }).reason, 'lejos', 'decir que llegó no basta');
  t += 500; at('park', -6, 3, 0); assert.equal(hub.playCheck(p, { i: 1 }).reason, 'lejos', 'el arco sobre la plataforma exige estar arriba');
  let last; for (let i = 1; i < RACE.checkpoints.length; i++) { t += 3000; at('park', ...RACE.checkpoints[i]); last = hub.playCheck(p, { i }); assert.equal(last.ok, true, 'punto ' + i); }
  assert.equal(last.done, true); assert.ok(last.score >= 50 && last.score <= 100); assert.equal(last.game, 'carrera', 'el juego lo dice el servidor');
  t += 1000; at('park', 0, 8); hub.playStart(p, 'carrera'); for (let i = 0; i < RACE.checkpoints.length; i++) { t += 100; at('park', ...RACE.checkpoints[i]); last = hub.playCheck(p, { i }); }
  assert.equal(last.reason, 'imposible', 'demasiado rápido para ser real');
  at('plaza', 0, 9); const s = hub.playStart(p, 'tesoro', 42); assert.deepEqual(s.items, treasureRounds(42)[0]);
  const first = TREASURES.find(x => x.id === s.items[0]);
  assert.equal(hub.playCheck(p, { id: first.id }).reason, 'lejos');
  const other = TREASURES.find(x => !treasureRounds(42)[0].includes(x.id)); t += 100; at('plaza', ...other.at); assert.equal(hub.playCheck(p, { id: other.id }).reason, 'no-es-de-esta-ronda');
  for (const round of treasureRounds(42)) for (const id of round) { t += 4000; at('plaza', ...TREASURES.find(x => x.id === id).at); last = hub.playCheck(p, { id }); assert.equal(last.ok, true, id); }
  assert.equal(last.done, true); assert.equal(last.game, 'tesoro');
  t += 10000; assert.equal(hub.playCheck(p, { id: first.id }).reason, 'sin-partida');
});

test('apertura: XP de práctica una vez al día por misión, sin tocar la XP de primera vez ni duplicar créditos', async () => {
  const { Profiles, MemoryStorage } = await load('_ciudad-server/profiles.js');
  const { defineMission } = await load('ciudad/js/missions/engine.js');
  const { BANK_CREDIT_MISSION, PROPOSALS, bestProposalId } = await load('ciudad/js/missions/bank-credit-logic.js');
  const { REWARDS } = await load('ciudad/js/economy/economy.js');
  const def = defineMission(BANK_CREDIT_MISSION), storage = new MemoryStorage();
  const profiles = new Profiles({ storage, missions: new Map([[def.id, def]]), rewards: REWARDS });
  const log = [['talk'], ['readDocument', { id: 'solicitud' }], ['readDocument', { id: 'flujo' }], ...PROPOSALS.map(p => ['takeProposal', { id: p.id }]), ...PROPOSALS.map(p => ['simulate', { id: p.id }]),
    ['compare'], ['choose', { id: bestProposalId() }], ['justify', { reasons: ['costo', 'capacidad'] }]].map(([type, payload]) => ({ type, payload: payload || {} }));
  const day1 = Date.parse('2026-11-12T18:00:00Z'), day2 = day1 + 86400000;
  const run = now => profiles.completeMission('u1', def.id, log, { now });
  const a = await run(day1), b = await run(day1 + 1000), c = await run(day1 + 2000), d = await run(day2);
  assert.deepEqual([a.xp, a.credits], [120, 15], 'primera vez: XP completa y créditos de prueba');
  assert.deepEqual([b.xp, b.credits], [30, 0], 'repetir: XP de práctica, sin créditos');
  assert.deepEqual([c.xp, c.credits], [0, 0], 'el mismo día ya no suma');
  assert.deepEqual([d.xp, d.credits], [30, 0], 'al día siguiente vuelve la XP de práctica');
  assert.equal(d.profile.xp, 180); assert.equal(d.profile.testCredits, 15); assert.equal(d.profile.missions[def.id].attempts, 4);
  // muchas repeticiones el mismo día no inflan la XP
  for (let i = 0; i < 20; i++) await run(day2 + 5000 + i);
  assert.equal((await profiles.get('u1')).xp, 180);
});

test('apertura: Carrera y Tesoro solo acreditan a su propio juego y el progreso descarta nombres inventados', async () => {
  const { Profiles, MemoryStorage } = await load('_ciudad-server/profiles.js');
  const { cleanPlay, PLAY_GAMES } = await load('ciudad/js/edu/play-rules.js');
  const profiles = new Profiles({ storage: new MemoryStorage(), missions: new Map(), rewards: {} });
  assert.equal((await profiles.grantPositional('u1', 'memoria', 100)).ok, false, 'un juego con semilla no se acredita por posición');
  assert.equal((await profiles.grantPositional('u1', 'inventado', 100)).ok, false);
  assert.equal((await profiles.grantPositional('u1', 'undefined', 100)).ok, false);
  const r = await profiles.grantPositional('u1', 'carrera', 100); assert.deepEqual([r.ok, r.xp], [true, 50]);
  assert.deepEqual(PLAY_GAMES, ['memoria', 'matematicas', 'idiomas', 'clasificacion', 'carrera', 'tesoro']);
  assert.deepEqual(Object.keys(cleanPlay({ act: { carrera: { best: 1 }, x1: { best: 1 }, undefined: { best: 1 } } }).act), ['carrera']);
});

test('servidor (socket real): presencia, código de invitación, reto de NPC y minijuego con XP sin duplicar', async t => {
  const s = await openServer(t); if (!s) return t.skip('npm install en _ciudad-server');
  const { QUESTIONS } = await load('ciudad/js/edu/questions.js');
  const { ACTIVITIES } = await load('ciudad/js/edu/activities.js');
  const ana = await s.client('ana'), beto = await s.client('beto');
  assert.deepEqual(beto.welcome.presence, { city: 2, instance: 2 });
  ana.tell({ t: 'code', op: 'create', uses: 1 }); const made = await ana.wait('code', m => m.op === 'create');
  assert.equal(made.ok, true); assert.equal(made.codes.length, 1);
  beto.tell({ t: 'code', op: 'redeem', code: made.code }); const red = await beto.wait('code', m => m.op === 'redeem');
  assert.deepEqual([red.ok, red.host], [true, 'ana']); assert.equal((await ana.wait('invited')).byCode, true);
  const carla = await s.client('carla'); carla.tell({ t: 'code', op: 'redeem', code: made.code });
  assert.equal((await carla.wait('code', m => m.op === 'redeem')).reason, 'codigo-invalido', 'era de un solo uso');
  // privacidad
  ana.tell({ t: 'profile', op: 'privacy', listed: false }); await ana.wait('profile', m => m.op === 'privacy');
  assert.equal((await carla.wait('name')).name, 'Jugador privado');
  // reto de NPC: el servidor decide
  const q = QUESTIONS.find(x => x.id === 'mex-sat');
  ana.tell({ t: 'profile', op: 'quiz', id: q.id, choice: 0 }); const wrong = await ana.wait('profile', m => m.op === 'quiz');
  assert.deepEqual([wrong.correct, wrong.xp, wrong.answer], [false, 0, 1]);
  ana.tell({ t: 'profile', op: 'quiz', id: q.id, choice: 1 }); const right = await ana.wait('profile', m => m.op === 'quiz');
  assert.deepEqual([right.correct, right.xp], [true, 10]);
  ana.tell({ t: 'profile', op: 'quiz', id: q.id, choice: 1 }); assert.equal((await ana.wait('profile', m => m.op === 'quiz')).xp, 0, 'sin XP repetida');
  ana.tell({ t: 'profile', op: 'quiz', id: 'no-existe', choice: 0 }); assert.equal((await ana.wait('profile', m => m.op === 'quiz')).ok, false);
  // minijuego
  const lang = ACTIVITIES.idiomas.build(99, 'infantil');
  ana.tell({ t: 'profile', op: 'activity', id: 'idiomas', seed: 99, level: 'infantil', log: lang.rounds.map(r => r.answer) });
  const act = await ana.wait('profile', m => m.op === 'activity'); assert.deepEqual([act.ok, act.score, act.xp], [true, 100, 50]);
  assert.ok(act.profile.achievements.includes('poliglota')); assert.equal(act.profile.testCredits, 0, 'los minijuegos nunca dan créditos');
  ana.tell({ t: 'profile', op: 'activity', id: 'idiomas', seed: 99, level: 'infantil', log: lang.rounds.map(() => 'xyz') });
  assert.equal((await ana.wait('profile', m => m.op === 'activity')).ok, false, 'respuestas inventadas no valen');
});
