'use strict';
// Ciudad ICADEM · recorrido perfecto de cada juego, compartido por las pruebas en navegador.
// `perfect` corre DENTRO de la página y devuelve las acciones del motor (las mismas que el
// servidor reproduce antes de acreditar). `talkAction` es la acción con la que se abre la misión.

/** Cada juego: puerta, escena, quién abre la misión, recompensa y el recorrido perfecto (en el navegador). */
const GAMES = [
  { key: 'bank', door: 'banco', spawn: 'bank', scene: 'bank', opener: 'lucia', mission: 'banco-credito-correcto', credits: 15,
    perfect: `const L = await import('./js/missions/bank-credit-logic.js');
      return [['readDocument', { id: 'solicitud' }], ['readDocument', { id: 'flujo' }],
        ...L.PROPOSALS.map(p => ['takeProposal', { id: p.id }]), ...L.PROPOSALS.map(p => ['simulate', { id: p.id }]),
        ['compare'], ['choose', { id: L.bestProposalId() }], ['justify', { reasons: ['costo', 'capacidad'] }]];` },
  { key: 'court', door: 'tribunal', spawn: 'court', scene: 'court', opener: 'clerk', mission: 'tribunal-tu-eres-el-juez', credits: 20,
    perfect: `const c = await import('./js/missions/court-judge-logic.js');
      const steps = [['readBackground'], ...c.EXHIBITS.map(e => ['examineExhibit', { id: e.id }]), ['openHearing'], ['hearParty', { side: 'actora' }], ['hearParty', { side: 'demandada' }],
        ['ruleObjection', { id: 'sugestiva', ruling: 'ha-lugar' }], ['ruleObjection', { id: 'fecha', ruling: 'no-ha-lugar' }], ['examineWitness', { id: 'ruben' }], ['askWitness', { witness: 'ruben', id: 'r-boiler' }],
        ['ruleObjection', { id: 'oidas', ruling: 'ha-lugar' }], ['examineWitness', { id: 'sofia' }], ['askWitness', { witness: 'sofia', id: 's-vidrio' }],
        ['confront', { marks: { 'd-ernesto': 'mensajes', 'd-ruben': 'cotizacion', 'd-marta': null, 'd-sofia': null, 'd-edad': null } }],
        ...c.EXHIBITS.map(e => ['weigh', { id: e.id, weight: e.best }]), ['rule', { ruling: 'parcial', grounds: ['vidrio', 'recibido'] }]];
      return steps;`, needsCase: true },
  { key: 'market', door: 'supermercado', spawn: 'market', scene: 'market', opener: 'ramiro', mission: 'super-rescate-inventario', credits: 20,
    perfect: `const L = await import('./js/missions/market-inventory-logic.js');
      return [['readLedger'], ...L.SHELVES.map(s => ['countShelf', { id: s.id }]),
        ...L.PRODUCTS.flatMap(p => [['inspect', { id: p.id }], ['decide', { id: p.id, action: p.remove ? 'retirar' : 'conservar' }]]),
        ['orderFridge', { order: [...L.BEST_ORDER] }], ...L.SHELVES.map(s => ['adjust', { id: s.id, delta: L.deltaOf(s) }]),
        ['report'], ['justify', { reasons: ['salud', 'peps'] }]];` },
  { key: 'site', door: 'obra', spawn: 'obra', scene: 'site', opener: 'paula', mission: 'obra-inspector-seguridad', credits: 20,
    perfect: `const L = await import('./js/missions/site-inspector-logic.js');
      return [...L.GEAR.map(g => ['equip', { id: g.id }]), ['readPlan'],
        ...L.SPOTS.flatMap(s => [['inspect', { id: s.id }], ['assess', { id: s.id, verdict: s.hazard ? 'riesgo' : 'en-regla' }], ...(s.hazard ? [['measure', { id: s.id, measure: s.measures.find(m => m.correct).id }]] : [])]),
        ['placeSign'], ['stopWork', { id: L.BEST_STOP }], ['report'], ['justify', { reasons: ['inminente', 'epp'] }]];` },
  { key: 'hospital', door: 'hospital', spawn: 'hospital', scene: 'hospital', opener: 'lupita', mission: 'hospital-turno-decisiones', credits: 20, talkAction: 'shift',
    perfect: `const L = await import('./js/missions/hospital-shift-logic.js');
      return [['readBoard'], ...L.PATIENTS.flatMap(p => L.REVIEWS.map(what => ['review', { id: p.id, what }])),
        ...L.PATIENTS.map(p => ['assess', { id: p.id, flags: p.findings.filter(f => f.alarm).map(f => f.id), triage: p.triage }]),
        ['prioritize', { order: ['aurelio', 'celia', 'joaquin', 'mariana'] }],
        ...L.PATIENTS.map(p => ['decide', { id: p.id, action: p.actions.find(a => a.correct).id, support: p.support }]),
        ['record'], ['handover', { reasons: ['gravedad', 'apoyo'] }]];` },
  { key: 'vet', door: 'veterinaria', spawn: 'vet', scene: 'vet', opener: 'xime', mission: 'vet-guardianes-bienestar', credits: 20, talkAction: 'brief',
    perfect: `const L = await import('./js/missions/vet-welfare-logic.js');
      return [...L.ANIMALS.flatMap(x => L.REVIEWS.map(what => ['review', { id: x.id, what }])),
        ...L.ANIMALS.map(x => ['assess', { id: x.id, flags: x.findings.filter(f => f.alert).map(f => f.id), priority: x.priority, domain: x.domain }]),
        ...L.ANIMALS.map(x => ['decide', { id: x.id, action: x.actions.find(y => y.correct).id }]),
        ...['arenero', 'repisa', 'escondite', 'rascador'].map(id => ['place', { id }]), ['counsel', { reasons: ['dominios', 'senales'] }]];` },
  { key: 'restaurant', door: 'restaurante', spawn: 'restaurant', scene: 'restaurant', opener: 'rosario', mission: 'restaurante-cocina-contra-reloj', credits: 20, talkAction: 'brief',
    perfect: `const L = await import('./js/missions/kitchen-rush-logic.js');
      return [...L.ORDERS.map(o => ['readOrder', { id: o.id }]), ['wash'], ...L.FRIDGES.map(f => ['checkFridge', { id: f.id, ok: f.ok }]), ['fridgeAction', { id: 'retirar' }],
        ...L.INGREDIENTS.map(i => ['prep', { id: i.id, board: i.board }]), ['allergy', { id: 'protocolo' }], ['cook', { id: 'pollo', temp: 76 }], ['cook', { id: 'pescado', temp: 65 }],
        ...L.ORDERS.map(o => ['assign', { id: o.id, station: o.station }]), ['serve'], ['debrief', { reasons: ['cruzada', 'temperatura'] }]];` },
  { key: 'greenhouse', door: 'invernadero', spawn: 'greenhouse', scene: 'greenhouse', opener: 'tomas', mission: 'invernadero-cultivo-inteligente', credits: 20, talkAction: 'brief',
    perfect: `const L = await import('./js/missions/greenhouse-logic.js');
      return [['readChart'], ...L.SENSORS.flatMap(s => [['readSensor', { id: s.id }], ['diagnose', { id: s.id, level: s.level }]]), ['climate', { vent: 60, shade: 40 }], ['solution', { nutrient: 12, acid: 0 }],
        ...L.BEDS.map(b => ['irrigate', { id: b.id, action: b.correct }]), ...L.TRAPS.map(t => ['inspectTrap', { id: t.id }]), ['pest', { zone: 'B', action: 'biologico' }], ['debrief', { reasons: ['medir', 'umbral'] }]];` },
  { key: 'office', door: 'oficina', spawn: 'office', scene: 'office', opener: 'paola', mission: 'oficina-expediente-perdido', credits: 20, talkAction: 'brief',
    perfect: `const L = await import('./js/missions/lost-file-logic.js');
      return [['index'], ...L.NEEDED_SPOTS.map(id => ['search', { id }]), ...L.CHRONO.map(id => ['take', { id }]), ['order', { ids: [...L.CHRONO] }],
        ['flag', { ids: ['monto', 'cantidad'] }], ['resolve', { id: 'retener' }], ['file', { cabinet: 'C' }], ['debrief', { reasons: ['trazabilidad', 'no-alterar'] }]];` },
  { key: 'tower', door: 'torre', spawn: 'tower', scene: 'tower', opener: 'elena', mission: 'torre-desafio-equipos', credits: 20, talkAction: 'brief',
    perfect: `return [['budget', { computers: 'nuevo', contingency: 5 }], ['permits', { ids: ['uso-suelo', 'construccion', 'proteccion-civil'] }], ['schedule', { ids: ['tramites', 'cimentacion', 'estructura', 'instalaciones', 'mobiliario'] }],
        ['message', { text: 'claro', channels: ['asamblea', 'carteles'] }], ['approve', { role: 'individual' }], ['present', { reasons: ['especialidad', 'dependencias'] }]];` }
];

module.exports = { GAMES };
