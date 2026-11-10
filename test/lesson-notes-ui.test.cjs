'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { browser, flush } = require('./helpers/reward-browser.cjs');
const path = '/api/learning/notes/course/1', draftKey = 'icadem:notes-draft:a:course:1';
function notes(a, root) {
  const container = root || new a.Element();
  if (!root) {
    for (let i = 0; i < 2; i++) { const field = new a.Element('textarea'); field.dataset.lessonNotes = ''; container.append(field); }
    const state = new a.Element(); state.dataset.notesState = ''; container.append(state); a.document.body.append(container);
  }
  const instance = a.window.ICADEMLessonNotes.mount({ container, courseId: 'course', lessonNumber: 1 });
  return { container, instance, fields: container.querySelectorAll('[data-lesson-notes]'), state: container.querySelector('[data-notes-state]') };
}
async function loaded(text = 'Versión guardada', revision = 1) {
  const a = browser(['icadem-lesson-notes.js']); a.signin(); const view = notes(a); await flush(); a.pending(path).respond({ note: { text, revision } }); await flush(); return { a, view };
}
async function type(a, view, text, index = 0) { view.fields[index].value = text; await view.fields[index].emit('input'); a.runTimers(700); await flush(); }

test('notes show the confirmed server version, synchronize both controls and do not reassign unchanged text on refresh', async () => {
  const { a, view } = await loaded();
  assert.deepEqual(view.fields.map(field => field.value), ['Versión guardada', 'Versión guardada']); assert.ok(view.fields.every(field => !field.disabled));
  const writes = view.fields.map(field => field.valueWrites); await a.window.emit('online'); await a.document.emit('visibilitychange'); await flush();
  assert.equal(a.requests.filter(request => !request.done).length, 1, 'overlapping refresh must share the existing read');
  a.pending(path).respond({ note: { text: 'Versión guardada', revision: 1 } }); await flush(); assert.deepEqual(view.fields.map(field => field.valueWrites), writes, 'unchanged server data must preserve cursor/selection');
  await type(a, view, 'Desde el segundo campo', 1); assert.equal(view.fields[0].value, 'Desde el segundo campo');
  assert.equal(a.pending(path, 'PUT').body.text, 'Desde el segundo campo');
});

test('failed note saves keep the draft and stable request ID; success is announced only after server acknowledgement', async () => {
  const { a, view } = await loaded(); await type(a, view, 'Nota pendiente'); const first = a.pending(path, 'PUT');
  assert.ok(view.state.textContent.includes('Guardando')); assert.ok(!view.state.textContent.includes('Guardado en tu cuenta')); assert.equal(JSON.parse(a.storage.get(draftKey)).text, 'Nota pendiente');
  first.reject(Error('Sin conexión')); await flush(); assert.ok(view.state.textContent.includes('Borrador pendiente')); assert.equal(view.fields[0].value, 'Nota pendiente');
  view.state.querySelector('button').emit('click'); await flush(); const retry = a.pending(path, 'PUT');
  assert.equal(retry.body.requestId, first.body.requestId); assert.equal(retry.body.baseRevision, 1);
  retry.respond({ note: { text: 'Nota pendiente', revision: 2 } }); await flush();
  assert.ok(view.state.textContent.includes('Guardado en tu cuenta')); assert.equal(a.storage.has(draftKey), false); assert.equal(view.instance.isDirty(), false);
});

test('conflicting notes preserve the local draft, load the other device version and require an explicit recovery before overwriting', async () => {
  const { a, view } = await loaded(); await type(a, view, 'Mi borrador'); const previous = a.pending(path, 'PUT');
  previous.respond({ code: 'note-conflict', error: 'La nota cambió', note: { text: 'Otro dispositivo', revision: 2 } }, 409); await flush();
  assert.equal(view.fields[0].value, 'Mi borrador'); assert.ok(view.state.textContent.includes('Tu borrador está protegido')); assert.equal(JSON.parse(a.storage.get(draftKey)).text, 'Mi borrador');
  await a.window.emit('online'); await flush(); assert.equal(a.requests.filter(request => request.method === 'PUT').length, 1, 'conflict never retries an overwrite automatically');
  view.state.querySelector('button').emit('click'); await flush(); a.pending(path, 'GET').respond({ note: { text: 'Otro dispositivo', revision: 2 } }); await flush();
  assert.equal(view.fields[0].value, 'Otro dispositivo'); assert.ok(view.state.textContent.includes('borrador pendiente')); assert.equal(a.requests.filter(request => request.method === 'PUT').length, 1);
  view.state.querySelector('button').emit('click'); await flush(); const recovered = a.pending(path, 'PUT');
  assert.equal(recovered.body.text, 'Mi borrador'); assert.equal(recovered.body.baseRevision, 2); assert.notEqual(recovered.body.requestId, previous.body.requestId);
  recovered.respond({ note: { text: 'Mi borrador', revision: 3 } }); await flush(); assert.equal(view.instance.isDirty(), false);
});

test('typing during a save keeps the newer text and sends it against the newly confirmed revision', async () => {
  const { a, view } = await loaded(); await type(a, view, 'Primera edición'); const first = a.pending(path, 'PUT');
  await type(a, view, 'Segunda edición'); assert.equal(a.requests.filter(request => request.method === 'PUT').length, 1);
  first.respond({ note: { text: 'Primera edición', revision: 2 } }); await flush(); const second = a.pending(path, 'PUT');
  assert.equal(view.fields[0].value, 'Segunda edición'); assert.equal(second.body.text, 'Segunda edición'); assert.equal(second.body.baseRevision, 2); assert.notEqual(second.body.requestId, first.body.requestId);
  second.respond({ note: { text: 'Segunda edición', revision: 3 } }); await flush(); assert.equal(a.storage.has(draftKey), false); assert.equal(view.instance.isDirty(), false);
});

test('navigation preserves a deferred draft, and remount never silently replaces the confirmed server version', async () => {
  const { a, view } = await loaded(); view.fields[0].value = 'Borrador antes de salir'; await view.fields[0].emit('input');
  await a.window.emit('icadem:navigation', { section: 'cursos' }); a.runTimers(700); await flush(); assert.equal(a.requests.filter(request => request.method === 'PUT').length, 0);
  const restored = notes(a, view.container); await flush(); a.pending(path).respond({ note: { text: 'Cambió en otra computadora', revision: 2 } }); await flush();
  assert.equal(restored.fields[0].value, 'Cambió en otra computadora'); assert.ok(restored.state.textContent.includes('borrador pendiente'));
  restored.state.querySelector('button').emit('click'); await flush(); const write = a.pending(path, 'PUT'); assert.equal(write.body.text, 'Borrador antes de salir'); assert.equal(write.body.baseRevision, 2);
});

test('a late read or write cannot repaint notes after ending a session and returning with the same UID', async () => {
  const { a, view } = await loaded(); await type(a, view, 'Borrador de la sesión anterior'); const old = a.pending(path, 'PUT');
  a.ending(); assert.equal(view.fields[0].value, ''); assert.equal(view.fields[0].disabled, true); a.signin('a');
  const next = notes(a, view.container); await flush(); a.pending(path, 'GET').respond({ note: { text: 'Versión nueva', revision: 5 } }); await flush();
  old.respond({ note: { text: 'Respuesta antigua', revision: 2 } }); await flush();
  assert.equal(next.fields[0].value, 'Versión nueva'); assert.ok(next.state.textContent.includes('borrador pendiente')); assert.equal(next.instance.isDirty(), false);
  assert.equal(JSON.parse(a.storage.get(draftKey)).text, 'Borrador de la sesión anterior');
});

test('a failed initial load keeps an existing draft and prevents writing before the server revision is known', async () => {
  const a = browser(['icadem-lesson-notes.js']); a.signin(); a.storage.set(draftKey, JSON.stringify({ text: 'Borrador local', baseRevision: 3 }));
  const view = notes(a); await flush(); a.pending(path).reject(Error('Sin red')); await flush();
  assert.ok(view.fields.every(field => field.disabled)); assert.ok(view.state.textContent.includes('Tu borrador se conserva')); assert.equal(a.requests.filter(request => request.method === 'PUT').length, 0);
  view.state.querySelector('button').emit('click'); await flush(); a.pending(path).respond({ note: { text: 'Confirmado', revision: 4 } }); await flush();
  assert.equal(view.fields[0].value, 'Confirmado'); assert.ok(view.state.textContent.includes('borrador pendiente')); assert.equal(a.storage.has(draftKey), true);
});

test('remounting the same fields disposes old input listeners and a previously accepted ambiguous write does not leave a pending draft', async () => {
  const { a, view } = await loaded(); const next = notes(a, view.container); await flush(); a.pending(path).respond({ note: { text: 'Versión guardada', revision: 1 } }); await flush();
  assert.equal(next.fields[0].listeners.get('input').size, 1);
  await type(a, next, 'Texto que ya llegó'); const write = a.pending(path, 'PUT'); write.reject(Error('Respuesta perdida')); await flush();
  await a.window.emit('icadem:navigation', { section: 'cursos' });
  const returned = notes(a, view.container); await flush(); a.pending(path, 'GET').respond({ note: { text: 'Texto que ya llegó', revision: 2 } }); await flush();
  assert.equal(returned.fields[0].value, 'Texto que ya llegó'); assert.equal(a.storage.has(draftKey), false); assert.ok(returned.state.textContent.includes('Guardado en tu cuenta'));
});
