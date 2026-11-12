'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { browser, flush } = require('./helpers/reward-browser.cjs');
const batchPath = '/api/course-ratings', coursePath = batchPath + '/course';
const snapshot = (count = 0, average = 0, mine = null) => ({ ok: true, courses: [{ courseId: 'course', ratingCount: count, average, updatedAt: '2026-11-10T12:00:00Z' }], mine: mine ? [{ courseId: 'course', rating: mine }] : [] });
async function ready(data = snapshot()) {
  const app = browser(['icadem-course-ratings.js']); app.signin(); await flush();
  app.pending(batchPath).respond(data); await flush(); return app;
}
async function openWidget(app, subject) {
  const root = new app.Element(); app.document.body.append(root);
  const endpoint = subject === 'lesson' ? '/api/lesson-ratings/course/1' : coursePath;
  app.window.ICADEMCourseRatings.mount({ container: root, courseId: 'course', ...(subject ? { subject, endpoint } : {}) });
  await flush(); app.pending(endpoint).respond({ summary: { ratingCount: 0, average: 0 }, mine: null }); await flush();
  await root.querySelectorAll('[data-rating]')[4].emit('click');
  return { root, endpoint };
}

test('a second device reads the same stored aggregate and personal rating in one authenticated batch', async () => {
  const server = snapshot(3, 4.33, 5);
  const phone = await ready(server), desktop = await ready(server);
  for (const app of [phone, desktop]) {
    const markup = app.window.ICADEMCourseRatings.cardMarkup('course');
    assert.match(markup, /4\.3 \(3 valoraciones\)/); assert.match(markup, /Tu valoración: 5\/5/);
    assert.doesNotMatch(markup, /Sin valoraciones/); assert.equal(app.storage.size, 0);
    assert.equal(app.requests.filter(request => request.path === batchPath).length, 1);
  }
});

test('confirmed zero differs from failed or malformed loading, and failures preserve confirmed figures', async () => {
  const app = await ready(); assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /Sin valoraciones/);
  await app.window.emit('icadem:navigation', { section: 'cursos' }); await flush();
  app.pending(batchPath).respond(snapshot(2, 4.5, 4)); await flush();
  app.document.dispatchEvent({ type: 'visibilitychange' }); await flush();
  app.pending(batchPath).respond({ error: 'No disponible' }, 503); await flush();
  let markup = app.window.ICADEMCourseRatings.cardMarkup('course');
  assert.match(markup, /4\.5 \(2 valoraciones\)/); assert.match(markup, /Tu valoración: 4\/5/); assert.match(markup, /Sin actualizar/);
  assert.doesNotMatch(markup, /Sin valoraciones/);
  const first = browser(['icadem-course-ratings.js']); first.signin(); await flush();
  first.pending(batchPath).respond({ error: 'No disponible' }, 503); await flush();
  markup = first.window.ICADEMCourseRatings.cardMarkup('course');
  assert.match(markup, /Valoraciones no disponibles/); assert.doesNotMatch(markup, /Sin valoraciones/);
  first.window.ICADEMCourseRatings.refreshCatalog(true); await flush();
  first.pending(batchPath).respond({ ok: true, courses: [{ courseId: 'course', ratingCount: 1, average: 99 }], mine: [] }); await flush();
  assert.match(first.window.ICADEMCourseRatings.cardMarkup('course'), /Valoraciones no disponibles/);
});

test('returning to courses before PUT completes still updates the aggregate and saved marker after acknowledgement', async () => {
  const app = await ready(), { root } = await openWidget(app); let saved = 0;
  app.document.addEventListener('icadem:course-rating-saved', () => saved++);
  const saving = root.querySelector('form').emit('submit'); await flush(); root.remove();
  assert.doesNotMatch(app.window.ICADEMCourseRatings.cardMarkup('course'), /Tu valoración/); assert.equal(saved, 0);
  app.pending(coursePath, 'PUT').respond({ summary: { ratingCount: 1, average: 5 }, mine: { rating: 5 } }); await saving;
  assert.equal(saved, 1); assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /Tu valoración: 5\/5/);
  assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /5\.0 \(1 valoración\)/);
  app.pending(batchPath).respond(snapshot(1, 5, 5)); await flush();
  assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /Tu valoración: 5\/5/);
});

test('a failed save cannot mark a course rated or change its aggregate', async () => {
  const app = await ready(), { root } = await openWidget(app); let saved = 0;
  app.document.addEventListener('icadem:course-rating-saved', () => saved++);
  const saving = root.querySelector('form').emit('submit'); await flush();
  app.pending(coursePath, 'PUT').respond({ error: 'Sin conexión' }, 503); await saving;
  assert.equal(saved, 0); assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /Sin valoraciones/);
  assert.doesNotMatch(app.window.ICADEMCourseRatings.cardMarkup('course'), /Tu valoración/);
});

test('a GET begun before a successful save cannot replace its confirmed aggregate with an old zero', async () => {
  const app = await ready(), { root } = await openWidget(app);
  app.window.ICADEMCourseRatings.refreshCatalog(true); await flush(); const old = app.pending(batchPath);
  const saving = root.querySelector('form').emit('submit'); await flush();
  app.pending(coursePath, 'PUT').respond({ summary: { ratingCount: 1, average: 5 }, mine: { rating: 5 } }); await saving;
  old.respond(snapshot()); await flush();
  assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /Tu valoración: 5\/5/);
  assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /5\.0 \(1 valoración\)/);
  assert.ok(app.pending(batchPath), 'a fresh request reconciles the post-save server snapshot');
  app.pending(batchPath).respond(snapshot(1, 5, 5)); await flush();
});

test('logout and same UID login clear personal data and ignore previous-session batch and save responses', async () => {
  const app = await ready(snapshot(2, 4, 4)), { root } = await openWidget(app); let saved = 0;
  app.document.addEventListener('icadem:course-rating-saved', () => saved++);
  app.window.ICADEMCourseRatings.refreshCatalog(true); await flush(); const oldBatch = app.pending(batchPath);
  const saving = root.querySelector('form').emit('submit'); await flush(); const oldSave = app.pending(coursePath, 'PUT');
  app.ending(); app.signin('a'); await flush();
  assert.doesNotMatch(app.window.ICADEMCourseRatings.cardMarkup('course'), /Tu valoración/);
  oldBatch.respond(snapshot(99, 5, 5)); oldSave.respond({ summary: { ratingCount: 99, average: 5 }, mine: { rating: 5 } }); await saving; await flush();
  assert.equal(saved, 0); assert.doesNotMatch(app.window.ICADEMCourseRatings.cardMarkup('course'), /99|Tu valoración/);
  app.pending(batchPath).respond(snapshot(2, 4, 4)); await flush();
  assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /Tu valoración: 4\/5/);
});

test('a lesson rating remains separate from the overall course rating and its credit reward', async () => {
  const app = await ready(), { root, endpoint } = await openWidget(app, 'lesson'); let subject;
  app.document.addEventListener('icadem:course-rating-saved', event => subject = event.detail.subject);
  const saving = root.querySelector('form').emit('submit'); await flush();
  app.pending(endpoint, 'PUT').respond({ summary: { ratingCount: 1, average: 5 }, mine: { rating: 5 } }); await saving;
  assert.equal(subject, 'lesson'); assert.match(app.window.ICADEMCourseRatings.cardMarkup('course'), /Sin valoraciones/);
  assert.doesNotMatch(app.window.ICADEMCourseRatings.cardMarkup('course'), /Tu valoración/);
  assert.equal(app.requests.filter(request => request.path === batchPath).length, 1);
});

test('an unavailable rating form never presents an unverified zero as a real summary', async () => {
  const app = await ready(); const root = new app.Element(); app.document.body.append(root);
  app.window.ICADEMCourseRatings.mount({ container: root, courseId: 'course' }); await flush();
  app.pending(coursePath).respond({ error: 'Servicio no disponible' }, 503); await flush();
  assert.match(root.innerHTML, /Valoraciones no disponibles/);
  assert.doesNotMatch(root.innerHTML, /<small>0 valoraciones<\/small>/);
});

test('the actual catalog listener updates only rating markup and retains cards, covers, action focus and list position', async () => {
  const app = await ready();
  const list = new app.Element(); list.id = 'cur-list'; list.scrollTop = 123; app.document.body.append(list);
  const card = new app.Element('article'); card.dataset.cid = 'course'; list.append(card);
  const image = new app.Element('img'), button = new app.Element('button'), rating = new app.Element();
  rating.className = 'curso-card__rating'; card.append(image, button, rating); app.document.activeElement = button;
  Object.defineProperty(list, 'innerHTML', { set() { throw new Error('The catalog must not be rebuilt for a rating refresh'); } });
  Object.defineProperty(card, 'innerHTML', { set() { throw new Error('The course card must not be rebuilt for a rating refresh'); } });
  let markup = '', writes = 0;
  Object.defineProperty(rating, 'outerHTML', { get() { return markup; }, set(value) { markup = value; writes++; } });
  const panel = fs.readFileSync(__dirname + '/../vip-panel.html', 'utf8');
  const start = panel.indexOf("  document.addEventListener('icadem:course-ratings-updated',");
  const end = panel.indexOf("  document.addEventListener('icadem:identity-ready',", start);
  assert.ok(start > 0 && end > start);
  app.run(panel.slice(panel.indexOf('  const vistasCursos='),panel.indexOf('  function renderVistaCursosActual(')));
  app.run(panel.slice(start, end));
  app.window.ICADEMCourseRatings.refreshCatalog(true); await flush();
  app.pending(batchPath).respond(snapshot(3, 4.33, 5)); await flush();
  assert.match(markup, /4\.3 \(3 valoraciones\)/); assert.match(markup, /Tu valoración: 5\/5/);
  assert.equal(writes, 2); assert.equal(list.children[0], card); assert.equal(card.children[0], image); assert.equal(card.children[1], button);
  assert.equal(button.isConnected, true); assert.equal(app.document.activeElement, button); assert.equal(list.scrollTop, 123);
  app.document.dispatchEvent({ type: 'icadem:course-ratings-updated' }); assert.equal(writes, 2, 'unchanged markup requires no DOM write');
});

test('demo cards explain rating availability without making requests or displaying an endless loader or fabricated zero', async () => {
  const app = browser(['icadem-course-ratings.js']); app.window.__isDemoMode = true; app.signin(); await flush();
  app.window.ICADEMCourseRatings.refreshCatalog(true); await flush();
  const markup = app.window.ICADEMCourseRatings.cardMarkup('course');
  assert.match(markup, /Valoraciones disponibles al iniciar sesión/); assert.doesNotMatch(markup, /Cargando|Sin valoraciones/);
  assert.equal(app.requests.filter(request => request.path === batchPath).length, 0);
});
