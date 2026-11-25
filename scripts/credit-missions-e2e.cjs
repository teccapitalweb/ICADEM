'use strict';

// Run against the actual panel and stylesheet with isolated synthetic accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const fixtureFile = path.join(__dirname, 'course-priorities-e2e.cjs');
const source = fs.readFileSync(fixtureFile, 'utf8');
const harness = new Function('require', '__dirname', 'process', source.slice(0, source.indexOf('async function scenario(width)')) + `
return {fixture,initial,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require, __dirname, process);

const missionData = [
  { id:'professional-card', title:'Completa tu tarjeta profesional', amount:15, description:'Agrega tu nombre profesional, área y presentación.', status:'available' },
  { id:'professional-cv', title:'Completa tu CV', amount:10, description:'Agrega formación, experiencia o un proyecto.', status:'completed' },
  { id:'forum-reply', title:'Comenta en Comunidad', amount:3, description:'Comenta una publicación de otra persona. Hasta dos hilos por semana.', status:'available', progress:{current:1,total:2} },
  { id:'first-connection', title:'Tu primera conexión aceptada', amount:5, description:'Se acredita una sola vez, cuando la otra persona acepte.', status:'pending' },
  { id:'referral-activation', title:'Invita a alguien a aprender', amount:10, description:'El invitado verifica su correo y aprueba su primera actividad.', status:'limited', progress:{current:2,total:2} },
  { id:'referral-email', title:'Verifica tu correo', amount:0, description:'Completa este paso para activar tu invitación.', status:'available' },
  { id:'referral-first-activity', title:'Aprueba tu primera actividad', amount:0, description:'Abre un curso para empezar.', status:'available' }
];

const movements = [
  { id:'first-profile', label:'Tarjeta completada', amount:15, direction:'earn', detail:'Tu perfil profesional', createdAt:'2026-11-25T15:30:00Z' },
  { id:'historic', label:'Regalo de bienvenida', amount:200, direction:'earn', detail:'Regalo anterior', createdAt:'2026-11-12T12:00:00Z' },
  { id:'book', label:'Canje de referencia', amount:-800, direction:'spend', detail:'Referencia profesional', createdAt:'2026-11-26T06:05:00Z' },
  { id:'comment', label:'Comentario en Comunidad', amount:3, direction:'earn', detail:'Participación en otro hilo', createdAt:'2026-11-26T04:59:00Z' },
  { id:'material', label:'Canje de material', amount:-100, direction:'spend', detail:'Material profesional', createdAt:'2026-11-25T16:30:00Z' },
  { id:'course', label:'Curso terminado', amount:20, direction:'earn', detail:'Clase de gestión', createdAt:'2026-11-24T18:35:00Z' }
];

async function checkRoute(page, section) {
  await page.waitForFunction(selected => location.hash === '#' + selected, section);
  const wallet = page.locator('#dynamic-section [data-credit-wallet-page]');
  await wallet.getByRole('heading', {level:1}).waitFor();
  assert.equal(await wallet.locator('nav a[aria-current="page"]').getAttribute('href'), '#' + section);
  assert.equal(await page.locator('.credit-wallet-modal,[aria-modal="true"][aria-labelledby="credit-wallet-title"]').count(), 0);
  return wallet;
}

async function checkMovementOrder(wallet, expected) {
  const actual = await wallet.locator('.credit-wallet-page__row').allTextContents();
  assert.equal(actual.length, expected.length);
  expected.forEach((label, index) => assert.ok(actual[index].includes(label), JSON.stringify(actual)));
}

function visit(page, hash) {
  return page.evaluate(section => { window.location.hash = section; }, hash);
}

async function waitForFixture(predicate, message) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (predicate()) return;
    await delay(50);
  }
  assert.fail(message);
}

async function checkControls(locator) {
  const sizes = await locator.evaluateAll(buttons => buttons.map(button => {
    const box = button.getBoundingClientRect();
    return { width:box.width, height:box.height, label:button.textContent.trim() };
  }));
  assert.ok(sizes.length > 0);
  for (const size of sizes) assert.ok(size.width >= 44 && size.height >= 44, JSON.stringify(size));
}

async function scenario(width) {
  const calls = { reads:0, reconciles:0 };
  let libraryRequested = false;
  let completeLibrary;
  let holdWallet = false;
  let completeWallet;
  let failWalletOnce = false;
  let verified = false;
  const shared = { data:harness.initial(), async handle(route, url) {
    const headers = {'Access-Control-Allow-Origin':'*'};
    if (url.pathname === '/api/credits/missions/reconcile') {
      assert.equal(route.request().method(), 'POST');
      assert.deepEqual(route.request().postDataJSON(), {});
      ++calls.reconciles;
      verified = calls.reconciles >= 2;
      await route.fulfill({ json:{ok:true}, headers });
      return true;
    }
    if (url.pathname === '/api/credits/wallet') {
      assert.equal(route.request().method(), 'GET');
      assert.equal(route.request().headers().authorization, 'Bearer browser-fixture-only');
      ++calls.reads;
      if (holdWallet) await new Promise(resolve => { completeWallet = resolve; });
      if (failWalletOnce) {
        failWalletOnce = false;
        await route.fulfill({ status:503, json:{ok:false, error:'Temporalmente no disponible'}, headers });
        return true;
      }
      const missions = missionData.map(mission => verified && mission.id === 'referral-email' ? {...mission,status:'completed'} : mission);
      await route.fulfill({ json:{
        ok:true, credits:{balance:137,lifetimeEarned:1037,lifetimeSpent:900}, missions,
        earnRules:[
          {id:'welcome',label:'Regalo de bienvenida',amount:100,note:'Un primer material para cuentas nuevas.'},
          {id:'course-completion',label:'Completa un curso',amount:20,note:'Tu avance se verifica al completar las actividades.'},
          {id:'course-rating',label:'Califica un curso completado',amount:5,note:'Todas las puntuaciones cuentan igual.'}
        ],
        destinations:[
          {label:'Materiales profesionales',description:'100 créditos por recurso.',section:'materiales',available:true},
          {label:'Biblioteca profesional',description:'Referencias profesionales.',section:'libros',available:true}
        ],
        recentMovements:movements
      }, headers });
      return true;
    }
    if (url.pathname === '/api/library' && width === 390) {
      await new Promise(resolve => { libraryRequested = true; completeLibrary = resolve; });
      await route.fulfill({ json:{ok:true, catalog:[], balance:137, redeemedBookIds:[]}, headers });
      return true;
    }
    return false;
  } };
  const { context, page } = await harness.fixture(width, shared);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const reconciliation = page.waitForResponse(response => response.url().endsWith('/api/credits/missions/reconcile') && response.request().method() === 'POST');
    await page.evaluate(() => {
      window.__verificationSent = 0;
      window.__mailConfirmed = false;
      window.ICADEMEmailVerification = {
        send: async () => { window.__verificationSent++; },
        refresh: async () => window.__mailConfirmed
      };
      window.navigateToSection('inicio');
    });
    await reconciliation;
    const home = page.locator('[data-credit-missions-home]');
    await home.getByRole('heading', { name:'Misiones de ICADEM' }).waitFor();
    assert.equal(await home.locator('li').count(), 3);
    assert.equal(calls.reconciles, 1);
    await checkControls(home.locator('button,a'));
    await harness.noOverflow(page, 'Inicio');
    await harness.shot(page, `inicio-${width}`, '[data-credit-missions-home]');
    if (width === 390) {
      await home.locator('[data-credit-wallet-open="misiones"]').click();
      const invitedWallet = await checkRoute(page, 'cartera-misiones');
      await invitedWallet.getByRole('button', {name:'Enviar enlace'}).waitFor();
      await page.goBack();
      await page.waitForFunction(() => location.hash === '#inicio');
    }
    const launch = home.locator('header [data-credit-wallet-open]');
    await launch.focus();
    await page.keyboard.press('Enter');
    const wallet = await checkRoute(page, 'cartera');
    const balance = wallet.locator('[data-credit-balance]').first();
    await balance.getByText('137', {exact:true}).or(balance.filter({hasText:'137'})).first().waitFor();
    await page.waitForFunction(() => document.activeElement?.id === 'credit-wallet-title');
    await checkControls(wallet.locator('nav a'));
    await harness.noOverflow(page, 'Cartera');
    assert.ok(await wallet.locator('.credit-wallet-page__row').count() <= 4);
    await harness.shot(page, `cartera-${width}`);

    await wallet.locator('nav a[href="#cartera-movimientos"]').click();
    await checkRoute(page, 'cartera-movimientos');
    await wallet.locator('.credit-wallet-page__row').first().waitFor();
    await checkMovementOrder(wallet, ['Canje de referencia','Comentario en Comunidad','Canje de material','Tarjeta completada','Curso terminado','Regalo de bienvenida']);
    assert.equal(await wallet.locator('.credit-wallet-page__date').count(), 4, 'the Mexico City midnight controls each date group');
    await checkControls(wallet.locator('[data-wallet-filter]'));
    const spend = wallet.locator('[data-wallet-filter="spend"]');
    const earn = wallet.locator('[data-wallet-filter="earn"]');
    const all = wallet.locator('[data-wallet-filter="all"]');
    await spend.click();
    assert.equal(await spend.getAttribute('aria-pressed'), 'true');
    await checkMovementOrder(wallet, ['Canje de referencia','Canje de material']);
    await earn.focus();
    await page.keyboard.press('Enter');
    assert.equal(await earn.getAttribute('aria-pressed'), 'true');
    await checkMovementOrder(wallet, ['Comentario en Comunidad','Tarjeta completada','Curso terminado','Regalo de bienvenida']);
    await all.click();
    await wallet.getByText('Regalo de bienvenida', {exact:true}).waitFor();
    assert.match(await wallet.locator('.credit-wallet-page__row').last().innerText(), /\+200/);
    await harness.noOverflow(page, 'Movimientos');
    await harness.shot(page, `movimientos-${width}`);
    await page.goBack();
    await checkRoute(page, 'cartera');
    await page.goForward();
    await checkRoute(page, 'cartera-movimientos');

    await wallet.locator('nav a[href="#cartera-misiones"]').click();
    await checkRoute(page, 'cartera-misiones');
    await wallet.getByText('Comenta en Comunidad', {exact:true}).waitFor();
    await wallet.getByText(/\+100/).first().waitFor();
    assert.equal(await wallet.locator('.credit-mission').count(), 7);
    assert.equal(await wallet.locator('.credit-mission--completed button,.credit-mission--limited button').count(), 0);
    assert.equal(await wallet.getByRole('progressbar', { name:'Comentarios premiados esta semana' }).getAttribute('value'), '1');
    assert.equal(await wallet.getByRole('progressbar', { name:'Invitados premiados este mes' }).getAttribute('value'), '2');
    await checkControls(wallet.locator('.credit-mission button'));
    const overflow = await wallet.evaluate(e => ({scroll:e.scrollWidth,client:e.clientWidth}));
    assert.ok(overflow.scroll <= overflow.client + 1, JSON.stringify(overflow));
    assert.equal(calls.reconciles, 1);
    await harness.shot(page, `misiones-${width}`);
    await harness.noOverflow(page, 'Misiones');

    if (width === 390) {
      await wallet.getByRole('button', {name:'Enviar enlace'}).click();
      await wallet.getByText('Enlace enviado.', {exact:false}).waitFor();
      assert.equal(await page.evaluate(() => window.__verificationSent), 1);
      await wallet.getByRole('button', {name:'Ya verifiqué'}).click();
      await wallet.getByText('El correo sigue pendiente.', {exact:false}).waitFor();
      assert.equal(calls.reconciles, 1);
      await page.evaluate(() => { window.__mailConfirmed = true; });
      await wallet.getByRole('button', {name:'Ya verifiqué'}).click();
      await wallet.locator('.credit-mission--completed').getByText('Verifica tu correo').waitFor();
      await wallet.getByText('Correo verificado.', {exact:false}).waitFor();
      assert.equal(calls.reconciles, 2);
    }
    await wallet.getByRole('button', { name:'Ir a Comunidad' }).or(wallet.getByRole('link', { name:'Ir a Comunidad' })).click();
    await page.waitForFunction(() => location.hash === '#foro');
    await wallet.waitFor({state:'detached'});
    await page.goBack();
    await checkRoute(page, 'cartera-misiones');
    await wallet.locator('nav a[href="#cartera-canjes"]').click();
    await checkRoute(page, 'cartera-canjes');
    await wallet.getByText('Materiales profesionales', {exact:true}).waitFor();
    await harness.noOverflow(page, 'Canjes');
    if (width === 1440) {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'night'; });
      await wallet.locator('nav a[href="#cartera-movimientos"]').click();
      await checkRoute(page, 'cartera-movimientos');
      await wallet.locator('.credit-wallet-page__row').first().waitFor();
      await harness.noOverflow(page, 'Movimientos en modo noche');
      await harness.shot(page, `movimientos-noche-${width}`);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'day'; });
    }

    if (width === 390) {
      await visit(page, 'retos');
      await harness.shot(page, `retos-cartera-${width}`, '.credit-wallet-card');
      await page.locator('.credit-wallet-card [data-credit-wallet-open]').click();
      await checkRoute(page, 'cartera');
      assert.equal(await wallet.locator('.credit-wallet-page__back').getAttribute('href'), '#retos');
      await wallet.locator('.credit-wallet-page__back').click();
      await page.waitForFunction(() => location.hash === '#retos');
      await visit(page, 'cartera-canjes');
      await checkRoute(page, 'cartera-canjes');
      await wallet.locator('.credit-wallet-destinations a[href="#libros"]').click();
      await page.waitForFunction(() => location.hash === '#libros');
      const libraryTrigger = page.locator('.library-balance [data-credit-wallet-open]');
      await libraryTrigger.waitFor();
      await waitForFixture(() => libraryRequested, 'library response is still pending at navigation');
      await libraryTrigger.click();
      await checkRoute(page, 'cartera-movimientos');
      const libraryResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/library');
      completeLibrary();
      await libraryResponse;
      await page.waitForTimeout(150);
      assert.equal(await wallet.isVisible(), true, 'a late catalog response cannot replace the wallet');
      assert.equal(await page.locator('.library-page').count(), 0);
      await wallet.locator('nav a[href="#cartera-canjes"]').click();
      await checkRoute(page, 'cartera-canjes');
      await wallet.locator('.credit-wallet-destinations a[href="#materiales"]').click();
      await page.waitForFunction(() => location.hash === '#materiales');
      await page.locator('.materials-wallet [data-credit-wallet-open]').click();
      await checkRoute(page, 'cartera-movimientos');
      assert.equal(await wallet.locator('.credit-wallet-page__back').getAttribute('href'), '#materiales');
      await wallet.locator('.credit-wallet-page__back').click();
      await page.waitForFunction(() => location.hash === '#materiales');
      await visit(page, 'cartera');
      await checkRoute(page, 'cartera');
      await visit(page, 'cartera-movimientos');
      await checkRoute(page, 'cartera-movimientos');
      await harness.noOverflow(page, 'Enlace directo');

      holdWallet = true;
      const pendingWallet = page.waitForRequest(request => new URL(request.url()).pathname === '/api/credits/wallet' && request.method() === 'GET');
      await page.evaluate(() => { window.ICADEMPlatform.loadCreditWallet(true).catch(() => {}); });
      await pendingWallet;
      await waitForFixture(() => Boolean(completeWallet), 'wallet response is still pending at account exit');
      await page.evaluate(() => {
        window.__sessionEnding = true;
        document.dispatchEvent(new CustomEvent('icadem:session-ending'));
      });
      await wallet.waitFor({state:'detached'});
      const walletResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/credits/wallet');
      holdWallet = false;
      completeWallet();
      await walletResponse;
      await page.waitForTimeout(150);
      assert.equal(await wallet.count(), 0, 'wallet details from a terminated session must never repaint');
    }
    if (width === 1440) {
      await visit(page, 'retos');
      await harness.shot(page, `retos-cartera-${width}`, '.credit-wallet-card');
    }
    if (width === 320) {
      await visit(page, 'retos');
      const teaser = page.locator('.credit-wallet-card [data-credit-wallet-open]');
      await teaser.waitFor();
      failWalletOnce = true;
      await teaser.click();
      await checkRoute(page, 'cartera');
      await wallet.getByText('No pudimos cargar tu cartera.').waitFor();
      await wallet.getByRole('button', {name:'Reintentar'}).click();
      await wallet.locator('[data-credit-balance]').waitFor();
      await page.waitForFunction(() => document.activeElement?.id === 'credit-wallet-title');
      assert.equal(await wallet.locator('[data-wallet-content][aria-busy]').count(), 0);
    }
    assert.deepEqual(errors, []);
    console.log(process.env.ICADEM_TEST_ENGINE || 'chrome', width, 'Rutas, foco, historial cronológico, filtros, misiones, canjes y reconciliación verificados');
  } finally {
    completeLibrary?.();
    completeWallet?.();
    await context.close();
  }
}

(async () => {
  try {
    await harness.start();
    for (const width of (process.env.ICADEM_PRIORITY_WIDTHS || '320,390,768,1440').split(',').map(Number)) await scenario(width);
  } finally {
    await harness.stop();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
