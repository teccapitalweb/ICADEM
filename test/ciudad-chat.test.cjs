'use strict';
// Ciudad ICADEM · chat libre: reglas compartidas, moderación del servidor, hub y socket real.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openServer } = require('./helpers/ciudad-server.cjs');
const root = path.join(__dirname, '..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);

test('reglas: limpia el texto, tapa groserías leves y rechaza lo que rompe las normas', async () => {
  const { checkMessage, CHAT_MAX, CHAT_REASONS } = await load('ciudad/js/social/chat-rules.js');
  const ok = t => { const r = checkMessage(t); assert.equal(r.ok, true, t); return r.text; };
  const no = (t, reason) => { const r = checkMessage(t); assert.equal(r.ok, false, t); assert.equal(r.reason, reason, t); assert.ok(CHAT_REASONS[reason]); return r; };
  assert.equal(ok('  Hola,   ¿jugamos la carrera?  '), 'Hola, ¿jugamos la carrera?');
  assert.equal(ok('holaaaaaaaa'), 'holaaa', 'letras estiradas');
  assert.equal(ok('HOLA A TODOS COMO ESTAN'), 'Hola a todos como estan', 'sin gritos');
  assert.equal(ok('qué pinche calor'), 'qué ••• calor');
  assert.equal(ok('qué onda wey'), 'qué onda wey', 'coloquial suelto se respeta');
  assert.equal(ok('<b>hola</b>'), 'bhola/b', 'sin etiquetas');
  for (const t of ['me da vergüenza', 'Voy a Nigeria', 'el fagot suena bien', 'pera y manzana', 'saluda a tu madre', 'enséñame la misión', 'nos vemos el 13 11 2026', 'hola. es tarde']) ok(t);
  for (const t of ['eres un pendejo', 'p u t o', 'eres un p3nd3j0', 'ERESUNPENDEJO', 'te voy a matar', 'f.u.c.k you']) assert.equal(no(t, 'lenguaje').strike, true);
  for (const t of ['visita www.ejemplo.com', 'mira ejemplo.com', 'escríbeme a ana@correo.com', 'https://x.y', 'ejemplo punto com']) no(t, 'enlace');
  for (const t of ['mi cel 222 123 4567', 'pásame tu whatsapp', 'búscame en instagram']) no(t, 'contacto');
  no('spam spam spam spam spam', 'spam'); no('   ', 'vacio'); no('abc '.repeat(40), 'muy-largo');
  assert.equal(checkMessage(42).ok, false);
  assert.equal(checkMessage('hola‮qué tal').text, 'hola qué tal', 'sin caracteres de control ni de dirección');
});

test('moderación: ritmo, repetidos, avisos con restricción creciente y reportes con evidencia del servidor', async () => {
  const { ChatGuard, CHAT_LIMITS } = await load('_ciudad-server/chat.js');
  let t = 1e6; const g = new ChatGuard({ now: () => t });
  assert.equal(g.check('a', 'hola').ok, true);
  assert.equal(g.check('a', 'hola').reason, 'repetido');
  t += CHAT_LIMITS.repeatMs; assert.equal(g.check('a', 'hola').ok, true, 'después de un rato sí se puede repetir');
  t += 20000; for (let i = 0; i < 4; i++) assert.equal(g.check('a', 'mensaje ' + 'abcd'[i]).ok, true);
  assert.equal(g.check('a', 'uno más').reason, 'demasiado-rapido');
  // tres faltas → 5 min; las siguientes tres → 30 min
  t += 60000; assert.equal(g.check('b', 'idiota').reason, 'lenguaje'); g.check('b', 'eres un pendejo');
  const third = g.check('b', 'www.spam.com'); assert.equal(third.restrictedMs, 5 * 60000);
  assert.equal(g.check('b', 'perdón').reason, 'restringido'); assert.ok(g.restricted('b') > 0);
  t += 5 * 60000; assert.equal(g.check('b', 'perdón').ok, true, 'la restricción vence');
  g.check('b', 'idiota'); g.check('b', 'idiota'); assert.equal(g.check('b', 'idiota').restrictedMs, 30 * 60000, 'reincidir pesa más');
  // reportes: la evidencia es lo que registró el servidor; tres personas distintas pausan el chat
  t += 31 * 60000; const sent = g.check('c', 'mensaje molesto').msg;
  const r1 = g.report('c', 'x', sent.id); assert.equal(r1.message.text, 'mensaje molesto'); assert.equal(r1.restricted, false);
  assert.equal(g.report('c', 'x', sent.id).restricted, false, 'la misma persona no cuenta dos veces');
  g.report('c', 'y'); assert.equal(g.report('c', 'z').restricted, true); assert.equal(g.check('c', 'hola de nuevo').reason, 'restringido');
  assert.equal(g.report('c', 'w', 999).message, null, 'un id inventado no fabrica evidencia');
});

test('hub: solo adultos con chat activo, misma instancia y escenario, respeta bloqueos; menores nunca', async () => {
  const { Hub } = await load('_ciudad-server/hub.js');
  const hub = new Hub();
  const at = (p, x, z, scene = 'plaza') => { p.state = { scene, x, y: 0, z, yaw: 0 }; };
  const ana = hub.join({ uid: 'ana', name: 'Ana' }).player, beto = hub.join({ uid: 'beto', name: 'Beto' }).player, carla = hub.join({ uid: 'carla', name: 'Carla' }).player;
  const kid = hub.join({ uid: 'mama~k1', name: 'Sofi', minor: true, guardian: 'mama' }).player;
  at(ana, 0, 0); at(beto, 3, 0); at(carla, 40, 40); at(kid, 1, 0);
  assert.equal(hub.chat(ana, 'hola').reason, 'activa-chat', 'sin aceptar las normas no escribe');
  const adult = { adultAt: 1, off: false, blocked: [] };
  [ana, beto, carla].forEach(p => hub.setChat(p, adult)); hub.setChat(kid, adult);
  assert.equal(kid.chat.ok, false, 'un perfil infantil nunca tiene chat libre aunque reciba un estado de adulto');
  assert.equal(hub.chat(kid, 'hola').reason, 'no-permitido');
  const r = hub.chat(ana, 'hola a todos');
  assert.deepEqual(r.to.map(x => [x.player.name, x.near]), [['Beto', true], ['Carla', false]], 'la instancia lo recibe; la burbuja solo cerca; el menor no');
  hub.setChat(carla, { adultAt: 1, off: true, blocked: [] }); assert.deepEqual(hub.chat(ana, 'segundo').to.map(x => x.player.name), ['Beto'], 'quien pausó su chat no recibe');
  hub.setChat(beto, { adultAt: 1, off: false, blocked: [{ uid: 'ana', name: 'Ana' }] });
  assert.deepEqual(hub.chat(ana, 'tercero').to, [], 'un bloqueo corta los mensajes');
  hub.setChat(beto, adult); hub.setChat(ana, { adultAt: 1, off: false, blocked: [{ uid: 'beto', name: 'Beto' }] });
  assert.deepEqual(hub.chat(beto, 'cuarto').to, [], 'en ambos sentidos');
  assert.equal(hub.say(beto, 'hola').to.length, 0, 'y también las frases rápidas');
  hub.setChat(ana, adult); at(beto, 0, 0, 'bank'); assert.deepEqual(hub.chat(ana, 'quinto').to, [], 'otro escenario no lo oye');
  at(ana, 0, 0, 'room'); assert.equal(hub.chat(ana, 'sexto').reason, 'sin-audiencia');
  assert.equal(hub.chatTarget(ana, kid.pid), null, 'no se puede apuntar a un menor');
});

test('socket real: dos jugadores conversan; aceptación, autor del servidor, bloqueo persistente, pausa y reporte', async t => {
  const srv = await openServer(t); if (!srv) return t.skip('npm install en _ciudad-server');
  const { encodeState } = await load('ciudad/js/net/network.js');
  const place = (ws, x, z) => ws.tell({ t: 's', s: encodeState({ scene: 'plaza', x, y: 0, z, yaw: 0 }) });
  const ana = await srv.client('ana'), beto = await srv.client('beto');
  assert.deepEqual(ana.welcome.chat, { enabled: true });
  assert.deepEqual(ana.welcome.profile.chat, { enabled: false, accepted: false, off: false, blocked: [] });
  place(ana, 0, 5); place(beto, 2, 5); await new Promise(r => setTimeout(r, 120));
  ana.tell({ t: 'chat', op: 'send', text: 'hola' }); assert.equal((await ana.wait('chat', m => m.op === 'send')).reason, 'activa-chat');
  ana.tell({ t: 'chat', op: 'accept', adult: true }); assert.equal((await ana.wait('chat', m => m.op === 'accept')).ok, false, 'hay que confirmar edad Y normas');
  for (const ws of [ana, beto]) { ws.tell({ t: 'chat', op: 'accept', adult: true, rules: true }); const a = await ws.wait('chat', m => m.op === 'accept'); assert.equal(a.profile.chat.enabled, true); }
  ana.tell({ t: 'chat', op: 'send', text: 'Hola Beto, ¿vamos al banco?', pid: beto.welcome.pid, name: 'Administrador' });
  const got = await beto.wait('chat', m => m.op === 'msg');
  assert.deepEqual([got.pid, got.name, got.text, got.near], [ana.welcome.pid, 'ana', 'Hola Beto, ¿vamos al banco?', true], 'el autor lo pone el servidor, no el cliente');
  const mine = await ana.wait('chat', m => m.op === 'send'); assert.deepEqual([mine.ok, mine.heard], [true, 1]);
  ana.tell({ t: 'chat', op: 'send', text: 'mira www.ejemplo.com' }); assert.equal((await ana.wait('chat', m => m.op === 'send')).reason, 'enlace');
  // reporte de un mensaje concreto: queda con la evidencia del servidor
  beto.tell({ t: 'report', pid: ana.welcome.pid, reason: 'chat', mid: got.id }); assert.equal((await beto.wait('reported')).ok, true);
  // bloqueo: se guarda en la cuenta, sobrevive a reconectarse y corta los mensajes
  beto.tell({ t: 'chat', op: 'block', pid: ana.welcome.pid }); const blk = await beto.wait('chat', m => m.op === 'block');
  assert.deepEqual(blk.profile.chat.blocked.map(b => b.name), ['ana']); assert.equal(JSON.stringify(blk.profile).includes('"uid"'), false, 'el navegador nunca recibe uids');
  const beto2 = await srv.client('beto'); place(beto2, 2, 5); await new Promise(r => setTimeout(r, 120));
  assert.equal(beto2.welcome.profile.chat.blocked.length, 1, 'el bloqueo sigue en otro dispositivo');
  ana.tell({ t: 'chat', op: 'send', text: '¿sigues ahí?' }); assert.equal((await ana.wait('chat', m => m.op === 'send')).heard, 0);
  beto2.tell({ t: 'chat', op: 'unblock', key: beto2.welcome.profile.chat.blocked[0].key }); assert.deepEqual((await beto2.wait('chat', m => m.op === 'unblock')).profile.chat.blocked, []);
  ana.tell({ t: 'chat', op: 'send', text: 'ya me oyes' }); assert.equal((await beto2.wait('chat', m => m.op === 'msg')).text, 'ya me oyes'); assert.equal((await ana.wait('chat', m => m.op === 'send')).heard, 1);
  // pausa (privacidad): deja de recibir y de enviar hasta reanudar
  beto2.tell({ t: 'chat', op: 'pause', off: true }); assert.equal((await beto2.wait('chat', m => m.op === 'pause')).profile.chat.enabled, false);
  ana.tell({ t: 'chat', op: 'send', text: 'hola otra vez' }); assert.equal((await ana.wait('chat', m => m.op === 'send' && m.ok)).heard, 0);
  beto2.tell({ t: 'chat', op: 'pause', off: false }); await beto2.wait('chat', m => m.op === 'pause');
  // spam: ráfaga limitada por el servidor
  const results = []; for (let i = 0; i < 6; i++) ana.tell({ t: 'chat', op: 'send', text: 'ráfaga ' + 'abcdef'[i] });
  for (let i = 0; i < 6; i++) results.push((await ana.wait('chat', m => m.op === 'send')).reason || 'ok');
  assert.ok(results.includes('demasiado-rapido'), 'el servidor frena la ráfaga: ' + results.join(','));
});

test('socket real: chat apagado con CIUDAD_CHAT=off y perfiles infantiles sin chat libre', async t => {
  const off = await openServer(t, { chat: false }); if (!off) return t.skip('npm install en _ciudad-server');
  const a = await off.client('ana'); assert.deepEqual(a.welcome.chat, { enabled: false });
  a.tell({ t: 'chat', op: 'accept', adult: true, rules: true }); assert.equal((await a.wait('chat')).reason, 'chat-desactivado');
  const on = await openServer(t, { family: true });
  const mama = await on.client('mama');
  mama.tell({ t: 'profile', op: 'family', action: 'add', alias: 'Sofi', band: '6-8', consent: true });
  const kidId = (await mama.wait('profile', m => m.op === 'family')).family[0].id;
  const ticket = (await (await on.post('/dev/ticket', { uid: 'mama', name: 'mama' })).json()).ticket;
  const sofi = await on.client('x', { ticket, kid: kidId });
  assert.deepEqual(sofi.welcome.chat, { enabled: false }, 'el perfil infantil no ve el chat libre');
  sofi.tell({ t: 'chat', op: 'accept', adult: true, rules: true }); assert.equal((await sofi.wait('chat')).reason, 'no-permitido', 'ni puede activarlo declarando ser adulto');
  sofi.tell({ t: 'chat', op: 'send', text: 'hola' }); assert.equal((await sofi.wait('chat')).reason, 'no-permitido');
});
