'use strict';
// Ciudad ICADEM · Tribunal «Tú eres el juez»: reglas del caso y uso del MISMO motor que el Banco.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const game = relative => import(pathToFileURL(path.join(__dirname, '..', 'ciudad/js', relative)).href);

const PERFECT = c => ({
  objections: { sugestiva: 'ha-lugar', fecha: 'no-ha-lugar', oidas: 'ha-lugar' },
  marks: { 'd-ernesto': 'mensajes', 'd-ruben': 'cotizacion', 'd-marta': null, 'd-sofia': null, 'd-edad': null },
  weights: Object.fromEntries(c.EXHIBITS.map(e => [e.id, e.best])), ruling: 'parcial', grounds: ['vidrio', 'recibido']
});
function play(run, c, plan) {
  const steps = [['takeCase', { id: 'exp-014' }], ['readBackground'], ...c.EXHIBITS.map(e => ['examineExhibit', { id: e.id }]), ['openHearing'], ['hearParty', { side: 'actora' }], ['hearParty', { side: 'demandada' }],
    ['ruleObjection', { id: 'sugestiva', ruling: plan.objections.sugestiva }], ['ruleObjection', { id: 'fecha', ruling: plan.objections.fecha }], ['examineWitness', { id: 'ruben' }], ['askWitness', { witness: 'ruben', id: 'r-boiler' }],
    ['ruleObjection', { id: 'oidas', ruling: plan.objections.oidas }], ['examineWitness', { id: 'sofia' }], ['askWitness', { witness: 'sofia', id: 's-vidrio' }],
    ['confront', { marks: plan.marks }], ...Object.entries(plan.weights).map(([id, weight]) => ['weigh', { id, weight }]), ['rule', { ruling: plan.ruling, grounds: plan.grounds }]];
  for (const [type, payload] of steps) assert.equal(run.act(type, payload), true, 'paso válido: ' + type);
  return run;
}

test('tribunal: el caso es coherente y la mejor resolución sale de las pruebas', async () => {
  const c = await game('missions/court-judge-logic.js');
  assert.equal(c.CASE.deposit - c.CASE.provenDamage, 16500);
  assert.equal(c.RULINGS.find(r => r.id === c.BEST_RULING).amount, 16500);
  assert.equal(c.DOCKET.filter(d => d.available).length, 1, 'un expediente jugable; los otros se anuncian como en preparación');
  assert.equal(c.EXHIBITS.length, 5); assert.equal(c.WITNESSES.length, 2); assert.equal(Object.keys(c.OBJECTIONS).length, 3);
  const quote = c.EXHIBITS.find(e => e.id === 'cotizacion').rows.reduce((sum, [k, v]) => /^(Pintura|Boiler|Vidrio|Limpieza)/.test(k) ? sum + Number(v.replace(/\D/g, '')) : sum, 0);
  assert.equal(quote, c.CASE.claimed, 'la cotización suma lo que reclama el demandado');
  for (const st of c.STATEMENTS) if (st.exhibit) assert.ok(c.EXHIBITS.some(e => e.id === st.exhibit));
  assert.equal(c.STATEMENTS.filter(s => s.exhibit).length, 2, 'dos contradicciones reales y tres declaraciones consistentes');
  for (const w of c.WITNESSES) for (const item of [...w.direct, ...w.cross]) if (item.objection) assert.ok(c.OBJECTIONS[item.objection], item.objection);
  assert.equal(c.GROUNDS.filter(g => g.correct).length, 3);
});

test('tribunal: la audiencia exige su orden y la calificación responde a cada decisión', async () => {
  const { defineMission, MissionRun, replay } = await game('missions/engine.js');
  const c = await game('missions/court-judge-logic.js');
  const def = defineMission(c.COURT_JUDGE_MISSION);
  assert.equal(def.difficulty, 'intermedia'); assert.equal(def.reward.amount, 20);
  const run = new MissionRun(def);
  for (const [type, payload] of [['openHearing'], ['hearParty', { side: 'actora' }], ['examineWitness', { id: 'ruben' }], ['rule', { ruling: 'parcial', grounds: ['vidrio'] }], ['takeCase', { id: 'exp-022' }], ['weigh', { id: 'contrato', weight: 'pleno' }]]) assert.equal(run.act(type, payload), false, type + ' fuera de orden');
  run.act('takeCase', { id: 'exp-014' }); run.act('readBackground'); assert.equal(run.act('openHearing'), false, 'no se abre sin revisar las pruebas');
  c.EXHIBITS.forEach(e => run.act('examineExhibit', { id: e.id })); run.act('openHearing');
  assert.equal(run.act('ruleObjection', { id: 'sugestiva', ruling: 'ha-lugar' }), false, 'primero se escucha a las partes');
  run.act('hearParty', { side: 'actora' }); run.act('hearParty', { side: 'demandada' });
  assert.equal(run.act('examineWitness', { id: 'ruben' }), false, 'el testigo no termina con objeciones sin resolver');
  assert.equal(run.act('ruleObjection', { id: 'sugestiva', ruling: 'quizá' }), false);
  run.act('ruleObjection', { id: 'sugestiva', ruling: 'ha-lugar' });
  assert.equal(run.act('ruleObjection', { id: 'sugestiva', ruling: 'no-ha-lugar' }), false, 'una objeción resuelta no se cambia');
  assert.equal(run.current, 'testigos');

  const score = plan => { const r = play(new MissionRun(def), c, plan).evaluate(); assert.equal(r.valid, true); return r; };
  const perfect = PERFECT(c);
  assert.equal(score(perfect).score, 100);
  assert.equal(score({ ...perfect, ruling: 'total' }).score, 85, 'devolver todo ignora el daño probado: pasa, pero no es la mejor');
  const absolve = score({ ...perfect, ruling: 'absolver', grounds: ['cotizacion', 'fotos'] });
  assert.equal(absolve.score, 65); assert.equal(absolve.passed, false, 'absolver contra las pruebas no supera la misión');
  assert.equal(score({ ...perfect, objections: { sugestiva: 'no-ha-lugar', fecha: 'ha-lugar', oidas: 'no-ha-lugar' } }).breakdown.objections, 0);
  const paranoid = score({ ...perfect, marks: { 'd-ernesto': 'mensajes', 'd-ruben': 'fotos', 'd-marta': 'contrato', 'd-sofia': 'fotos', 'd-edad': null } });
  assert.deepEqual([paranoid.breakdown.found, paranoid.breakdown.falseAlarms, paranoid.breakdown.contradictions], [1, 3, 0], 'inventar contradicciones resta');
  assert.equal(score({ ...perfect, weights: { contrato: 'pleno', inventario: 'pleno', cotizacion: 'nulo', mensajes: 'indicio', fotos: 'indicio' } }).breakdown.weighing, 14, 'una valoración defendible vale la mitad');
  assert.equal(score({ ...perfect, grounds: ['vidrio', 'amistad'] }).breakdown.reasoning, 0);

  const full = play(new MissionRun(def), c, perfect);
  assert.equal(replay(def, JSON.parse(JSON.stringify(full.log))).result.score, 100);
  assert.equal(replay(def, full.log.filter(e => e.type !== 'confront')).ok, false, 'no se valora ni se resuelve sin confrontar');
  for (const bad of [{}, { ...full.state, ruling: 'inventada' }, { ...full.state, weights: {} }, { ...full.state, objections: { sugestiva: 'ha-lugar' } }, { ...full.state, grounds: [] }]) assert.equal(c.evaluate(bad).valid, false);
  // una declaración que el juez no escuchó no se puede confrontar
  const deaf = new MissionRun(def); play(deaf, c, { ...perfect }); const s2 = c.newHearing(); assert.equal(c.availableStatements(s2).some(x => x.id === 'd-edad'), false);
});

test('motor compartido: Banco y Tribunal usan el mismo servicio, registro y recompensa única', async () => {
  const { defineMission, MissionRegistry, MissionService } = await game('missions/engine.js');
  const { BANK_CREDIT_MISSION } = await game('missions/bank-credit-logic.js');
  const c = await game('missions/court-judge-logic.js');
  const { Store } = await game('core/store.js');
  const { TestEconomy, REWARDS } = await game('economy/economy.js');
  const m = new Map(), store = new Store({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }), economy = new TestEconomy(store);
  const registry = new MissionRegistry(); const bank = registry.register(defineMission(BANK_CREDIT_MISSION)), court = registry.register(defineMission(c.COURT_JUDGE_MISSION));
  const service = new MissionService({ registry, economy, rewards: REWARDS, progress: { get: id => store.state.missions[id], set: (id, r) => { store.state.missions[id] = r; store.save(); }, addXp: xp => store.addXp(xp) } });
  assert.deepEqual(registry.list().map(d => [d.building, d.difficulty, service.rewardFor(d.id).amount]), [['banco', 'sencilla', 15], ['tribunal', 'intermedia', 20]]);
  for (const def of [bank, court]) for (const key of ['objectives', 'actions', 'newState', 'evaluate', 'reward', 'passScore']) assert.ok(def[key] !== undefined, `${def.id} cumple el contrato del motor (${key})`);

  const first = await service.complete(play(service.start(court.id), c, PERFECT(c)));
  assert.deepEqual([first.ok, first.credits, first.xp, first.firstPass], [true, 20, 160, true]);
  const again = await service.complete(play(service.start(court.id), c, PERFECT(c)));
  assert.deepEqual([again.credits, again.xp, again.duplicate], [0, 40, true], 'repetir el Tribunal no duplica créditos');
  const b = service.start(bank.id); b.act('talk'); ['solicitud', 'flujo'].forEach(id => b.act('readDocument', { id })); ['expres', 'pyme', 'comodo'].forEach(id => { b.act('takeProposal', { id }); b.act('simulate', { id }); }); b.act('compare'); b.act('choose', { id: 'pyme' }); b.act('justify', { reasons: ['costo', 'capacidad'] });
  assert.equal((await service.complete(b)).credits, 15, 'el Banco sigue funcionando en el mismo servicio');
  assert.equal(await economy.getBalance(), 35);
  assert.deepEqual((await economy.history()).map(e => e.key).sort(), ['mission:banco-credito-correcto', 'mission:tribunal-tu-eres-el-juez'], 'una entrada por misión en el historial de prueba');
  assert.deepEqual(Object.keys(store.state.missions).sort(), [bank.id, court.id].sort(), 'un solo registro de finalización para ambos juegos');
  assert.equal(service.record(court.id).attempts, 2);
  // el estado de una misión no contamina a la otra
  assert.equal((await service.complete(Object.assign(service.start(court.id), { log: b.log }))).ok, false);
});
