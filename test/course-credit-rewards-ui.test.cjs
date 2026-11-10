'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { browser, flush } = require('./helpers/reward-browser.cjs');
const modules = ['icadem-course-ratings.js', 'icadem-credit-rewards.js'];
const pendingPath = '/api/course-rating-rewards/pending', ratingPath = '/api/course-ratings/course';
const item = { courseId: 'course', courseTitle: 'Curso real', amount: 25 };
const eligible = { summary: {}, mine: null, reward: { eligible: true, amount: 25 } };
async function ready(a, arm = false) {
  a.signin(); if (arm) a.window.ICADEMCreditRewards.arm('course'); await flush();
  a.pending(pendingPath).respond({ items: [item] }); await flush();
}
async function invitation(a) {
  const job = a.jobs.shift(); assert.equal(job.id, 'course-rating');
  const completion = a.window.ICADEMCreditRewards.runInvitation(job.payload); await flush();
  a.pending(ratingPath).respond(eligible); await flush();
  // The existing rating widget independently verifies the saved rating.
  a.pending(ratingPath).respond(eligible); await flush();
  const modal = a.document.querySelector('[data-modal-id="course-rating-reward"]');
  assert.ok(modal); return { completion, modal, widget: modal.querySelector('.rating-reward-dialog__widget'), later: modal.querySelector('.rating-reward-dialog__footer').querySelector('button') };
}

test('the rating invitation waits for the certificate actual removal, including a closing overlay', async () => {
  const a = browser(modules); await ready(a, true); const certificate = new a.Element(); certificate.id = 'splash-completado'; a.document.body.append(certificate);
  a.window.ICADEMCreditRewards.certificateOpened(item, certificate);
  a.mutation(); assert.equal(a.jobs.length, 0);
  certificate.classList.add('is-closing'); a.mutation(); assert.equal(a.jobs.length, 0, 'a closing certificate still owns the screen');
  certificate.remove(); a.mutation(); await flush(); assert.equal(a.jobs.length, 1);
  const view = await invitation(a); assert.equal(a.document.body.style.overflow, 'hidden');
  await view.later.emit('click'); assert.ok(view.modal.isConnected, 'existing Modal close animation must finish first');
  a.runTimers(250); a.mutation(); await view.completion;
  assert.equal(view.modal.isConnected, false); assert.equal(a.document.body.style.overflow, 'auto'); assert.equal(a.releases, 1);
});

test('Ver mi certificado waits for section-ready and the dedicated certificate detail before offering rating', async () => {
  const a = browser(modules); await ready(a, true); const certificate = new a.Element(); certificate.id = 'splash-completado'; a.document.body.append(certificate);
  a.window.ICADEMCreditRewards.certificateOpened(item, certificate);
  const ticket = a.window.ICADEMCreditRewards.certificateViewIntent('course');
  await a.window.emit('icadem:navigation', { section: 'certificados' }); a.location.hash = '#certificados'; certificate.remove(); a.mutation(); await flush();
  assert.equal(a.jobs.length, 0);
  await a.window.emit('icadem:section-ready', { section: 'certificados' });
  a.run("window.certificateDetail=Modal.open({id:'certificate-detail',title:'Mi certificado',body:'Certificado real'});");
  a.window.ICADEMCreditRewards.certificateViewSettled('course', ticket);
  a.pending(pendingPath)?.respond({ items: [item] }); await flush(); a.mutation(); assert.equal(a.jobs.length, 0, 'certificate detail is still on screen');
  a.window.certificateDetail.close(); a.mutation(); assert.equal(a.jobs.length, 0, 'closing detail still blocks another modal');
  a.runTimers(250); a.mutation(); assert.equal(a.jobs.length, 1);
});

test('Ahora no performs no rating write and awards no credits; navigation cannot repeat the same visit offer', async () => {
  const a = browser(modules); await ready(a); const view = await invitation(a);
  await view.later.emit('click'); a.runTimers(250); a.mutation(); await view.completion;
  assert.equal(a.requests.filter(request => request.method === 'PUT').length, 0); assert.equal(a.publications.length, 0);
  await a.window.emit('icadem:navigation', { section: 'cursos' }); await a.window.emit('icadem:section-ready', { section: 'cursos' }); await flush();
  a.pending(pendingPath)?.respond({ items: [item] }); await flush(); a.mutation(); assert.equal(a.jobs.length, 0);
});

test('credit reward acknowledgement, message and onSaved occur only after the successful server write', async () => {
  const a = browser(modules); await ready(a); const view = await invitation(a);
  await view.widget.querySelectorAll('[data-rating]')[0].emit('click');
  const saving = view.widget.querySelector('form').emit('submit'); await flush();
  const write = a.pending(ratingPath, 'PUT'); assert.ok(write); assert.equal(write.body.rating, 1); assert.equal(write.body.review, '');
  assert.equal(a.publications.length, 0); assert.equal(view.widget.dataset.ratingBusy, 'true');
  await view.later.emit('click'); a.runTimers(250); assert.equal(view.modal.isConnected, true, 'cannot dismiss an unacknowledged rating');
  write.respond({ summary: { ratingCount: 1, average: 1 }, mine: { rating: 1, review: '' }, credits: { balance: 125, lifetimeEarned: 125, lifetimeSpent: 0 }, reward: { eligible: false, granted: true, creditedAmount: 25 } }); await saving;
  assert.equal(a.publications.length, 1); assert.equal(a.publications[0][0].balance, 125);
  assert.ok(view.widget.querySelector('.course-rating__state').innerHTML.includes('+25 créditos')); assert.equal(view.later.textContent, 'Listo');
  await view.later.emit('click'); a.runTimers(250); await view.completion;
});

test('a failed rating preserves the selected score and review and never displays a reward or emits saved', async () => {
  const a = browser(modules); await ready(a); const view = await invitation(a);
  await view.widget.querySelectorAll('[data-rating]')[4].emit('click'); view.widget.querySelector('textarea').value = 'Opinión pendiente';
  const saving = view.widget.querySelector('form').emit('submit'); await flush(); a.pending(ratingPath, 'PUT').respond({ error: 'Servicio temporalmente no disponible' }, 503); await saving;
  assert.equal(a.publications.length, 0); assert.equal(view.later.textContent, 'Ahora no · Puedes calificar después');
  assert.equal(view.widget.querySelector('textarea').value, 'Opinión pendiente'); assert.equal(view.widget.querySelector('textarea').disabled, false);
  assert.ok(view.widget.querySelector('.course-rating__state').innerHTML.includes('Servicio temporalmente no disponible'));
});

test('same UID relogin discards queued invitations, certificate intents and late saved acknowledgements', async () => {
  const a = browser(modules); await ready(a); const view = await invitation(a);
  const certificateTicket = a.window.ICADEMCreditRewards.certificateViewIntent('course');
  await view.widget.querySelectorAll('[data-rating]')[2].emit('click'); const saving = view.widget.querySelector('form').emit('submit'); await flush(); const oldWrite = a.pending(ratingPath, 'PUT');
  a.ending(); assert.equal(view.widget.innerHTML, ''); assert.equal(a.window.ICADEMCreditRewards.isCurrent(certificateTicket), false);
  a.signin('a'); await flush(); oldWrite.respond({ summary: {}, mine: { rating: 3 }, credits: { balance: 999 }, reward: { granted: true, creditedAmount: 25 } }); await saving;
  a.runTimers(250); a.mutation(); await view.completion;
  assert.equal(a.publications.length, 0); assert.equal(a.document.body.style.overflow, 'auto');
  a.window.ICADEMCreditRewards.certificateViewSettled('course', certificateTicket); assert.equal(a.window.ICADEMCreditRewards.isCurrent(certificateTicket), false);
  assert.equal(a.document.querySelector('[data-modal-id="course-rating-reward"]'), null);
});

test('a previous-session load cannot resurrect rating controls after same UID user-ready', async () => {
  const a = browser(['icadem-course-ratings.js']); a.signin('a'); const root = new a.Element(); a.document.body.append(root);
  a.window.ICADEMCourseRatings.mount({ container: root, courseId: 'course' }); await flush(); const old = a.pending(ratingPath);
  a.document.dispatchEvent({ type: 'icadem:user-ready' }); old.respond(eligible); await flush(); assert.equal(root.innerHTML, ''); assert.equal(root.querySelector('form'), null);
});

test('a stale queued job and hidden tab cannot open an invitation for the current visit', async () => {
  const a = browser(modules); await ready(a); const old = a.jobs.shift(); a.ending(); a.signin('a'); await flush();
  await a.window.ICADEMCreditRewards.runInvitation(old.payload); assert.equal(a.requests.filter(request => request.path === ratingPath).length, 0);
  a.pending(pendingPath).respond({ items: [item] }); await flush(); a.document.hidden = true;
  const job = a.jobs.shift(); assert.ok(job);
  const run = a.window.ICADEMCreditRewards.runInvitation(job.payload); await flush(); a.pending(ratingPath)?.respond(eligible); await run;
  assert.equal(a.document.querySelector('[data-modal-id="course-rating-reward"]'), null);
});

test('closing a new certificate prioritizes that course over older eligible courses or a previously queued old job', async () => {
  const a = browser(modules); a.signin(); await flush();
  a.pending(pendingPath).respond({ items: [item, { courseId: 'second', courseTitle: 'Curso recién completado', amount: 25 }] }); await flush();
  const old = a.jobs.shift(); assert.equal(old.payload.courseId, 'course');
  const certificate = new a.Element(); certificate.id = 'splash-completado'; a.document.body.append(certificate);
  a.window.ICADEMCreditRewards.certificateOpened({ courseId: 'second' }, certificate);
  await a.window.ICADEMCreditRewards.runInvitation(old.payload); assert.equal(a.jobs.length, 0);
  certificate.remove(); a.mutation(); await flush(); assert.equal(a.jobs.length, 1); assert.equal(a.jobs[0].payload.courseId, 'second');
});

test('a freshly completed course waits for pending reconciliation and does not fall back to an older course', async () => {
  const a = browser(modules); a.signin(); a.window.ICADEMCreditRewards.arm('second'); await flush(); a.pending(pendingPath).respond({ items: [item] }); await flush();
  const certificate = new a.Element(); certificate.id = 'splash-completado'; a.document.body.append(certificate); a.window.ICADEMCreditRewards.certificateOpened({ courseId: 'second' }, certificate);
  certificate.remove(); a.mutation(); await flush(); a.pending(pendingPath).respond({ items: [item] }); await flush(); assert.equal(a.jobs.length, 0);
  a.document.emit('icadem:progress-ready'); await flush(); a.pending(pendingPath).respond({ items: [item, { courseId: 'second', courseTitle: 'Segundo curso', amount: 25 }] }); await flush();
  assert.equal(a.jobs.length, 1); assert.equal(a.jobs[0].payload.courseId, 'second');
});

test('many historic eligible courses produce one invitation per navigation context, without cascading after Ahora no', async () => {
  const a = browser(modules); a.signin(); await flush();
  const items = [item, { courseId: 'second', amount: 25 }, { courseId: 'third', amount: 25 }];
  a.pending(pendingPath).respond({ items }); await flush(); const view = await invitation(a);
  await view.later.emit('click'); a.runTimers(250); a.mutation(); await view.completion; assert.equal(a.jobs.length, 0);
  a.document.emit('icadem:progress-ready'); await flush(); a.pending(pendingPath).respond({ items }); await flush(); a.mutation(); assert.equal(a.jobs.length, 0);
  await a.window.emit('icadem:navigation', { section: 'cursos' }); await a.window.emit('icadem:section-ready', { section: 'cursos' }); await flush(); a.pending(pendingPath).respond({ items }); await flush();
  assert.equal(a.jobs.length, 1); assert.equal(a.jobs[0].payload.courseId, 'second');
});

test('a rating saved after leaving the course confirms the current wallet without publishing a detached old snapshot', async () => {
  const a = browser(['icadem-course-ratings.js']); a.signin(); const root = new a.Element(); a.document.body.append(root); let refreshes = 0;
  a.window.ICADEMPlatform.loadCreditWallet = async force => { assert.equal(force, true); refreshes++; };
  a.window.ICADEMCourseRatings.mount({ container: root, courseId: 'course' }); await flush(); a.pending(ratingPath).respond(eligible); await flush();
  await root.querySelectorAll('[data-rating]')[4].emit('click'); const save = root.querySelector('form').emit('submit'); await flush(); root.remove();
  a.pending(ratingPath, 'PUT').respond({ summary: {}, mine: { rating: 5 }, credits: { balance: 100 }, reward: { granted: true, creditedAmount: 25 } }); await save;
  assert.equal(a.publications.length, 0); assert.equal(refreshes, 1);
});

function installActualCertificateHook(a) {
  const panel = fs.readFileSync(__dirname + '/../vip-panel.html', 'utf8');
  const start = panel.indexOf("splash.querySelector('#splash-ver-cert').addEventListener('click'");
  const end = panel.indexOf('\n    });', start) + '\n    });'.length;
  assert.ok(start > 0 && end > start);
  const splash = new a.Element(); splash.id = 'splash-completado'; const button = new a.Element('button'); button.id = 'splash-ver-cert'; splash.append(button); a.document.body.append(splash);
  a.window.testSplash = splash; a.window.certificateOpenCount = 0;
  a.window.navigateToSection = section => { a.location.hash = '#' + section; a.window.dispatchEvent({ type: 'icadem:navigation', detail: { section } }); };
  a.run("var splash=window.testSplash,curso={id:'course'},certObj={id:'course'};function openCertDetalleReal(){window.certificateOpenCount++;window.detail=Modal.open({id:'certificate-real-detail',title:'Certificado',body:'Certificado real'});}" + panel.slice(start, end));
  a.window.ICADEMCreditRewards.certificateOpened(item, splash);
  return { splash, button };
}

test('the actual HTML Ver certificado hook opens detail only after the destination is ready, then waits for detail close', async () => {
  const a = browser(modules); await ready(a, true); const hook = installActualCertificateHook(a);
  await hook.button.emit('click'); a.mutation(); await flush(); assert.equal(a.window.certificateOpenCount, 0); assert.equal(a.jobs.length, 0);
  await a.window.emit('icadem:section-ready', { section: 'certificados' }); await flush();
  assert.equal(a.window.certificateOpenCount, 1); a.pending(pendingPath)?.respond({ items: [item] }); await flush(); a.mutation(); assert.equal(a.jobs.length, 0);
  a.window.detail.close(); a.runTimers(250); a.mutation(); assert.equal(a.jobs.length, 1);
});

test('the actual HTML certificate hook cannot open a previous session certificate after same UID relogin', async () => {
  const a = browser(modules); await ready(a, true); const hook = installActualCertificateHook(a);
  await hook.button.emit('click'); a.mutation(); a.ending(); a.signin('a'); await flush();
  await a.window.emit('icadem:section-ready', { section: 'certificados' }); assert.equal(a.window.certificateOpenCount, 0);
});
