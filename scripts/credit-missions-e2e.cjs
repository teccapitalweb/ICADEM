'use strict';

// Run against the actual panel and stylesheet with isolated synthetic accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fixtureFile = path.join(__dirname, 'course-priorities-e2e.cjs');
const source = fs.readFileSync(fixtureFile, 'utf8');
const harness = new Function('require', '__dirname', 'process', source.slice(0, source.indexOf('async function scenario(width)')) + `
return {fixture,initial,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require, __dirname, process);

const missionData = [
  { id:'professional-card', title:'Completa tu tarjeta profesional', amount:15, description:'Agrega tu nombre profesional, área y presentación.', status:'available' },
  { id:'professional-cv', title:'Completa tu CV', amount:10, description:'Agrega formación, experiencia o un proyecto.', status:'completed' },
  { id:'forum-reply', title:'Responde una pregunta en Comunidad', amount:3, description:'Una recompensa por conversación. Hasta dos por semana.', status:'available', progress:{current:1,total:2} },
  { id:'first-connection', title:'Tu primera conexión aceptada', amount:5, description:'Se acredita una sola vez, cuando la otra persona acepte.', status:'pending' },
  { id:'referral-activation', title:'Invita a alguien a aprender', amount:10, description:'El invitado verifica su correo y aprueba su primera actividad.', status:'limited', progress:{current:2,total:2} },
  { id:'referral-email', title:'Verifica tu correo', amount:0, description:'Completa este paso para activar tu invitación.', status:'available' },
  { id:'referral-first-activity', title:'Aprueba tu primera actividad', amount:0, description:'Abre un curso para empezar.', status:'available' }
];

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
  let verified = false;
  const shared = { data:harness.initial(), async handle(route, url) {
    if (url.pathname === '/api/credits/missions/reconcile') {
      assert.equal(route.request().method(), 'POST');
      assert.deepEqual(route.request().postDataJSON(), {});
      ++calls.reconciles;
      verified = calls.reconciles >= 2;
      await route.fulfill({ json:{ok:true}, headers:{'Access-Control-Allow-Origin':'*'} });
      return true;
    }
    if (url.pathname === '/api/credits/wallet') {
      assert.equal(route.request().method(), 'GET');
      ++calls.reads;
      const missions = missionData.map(mission => verified && mission.id === 'referral-email' ? {...mission,status:'completed'} : mission);
      await route.fulfill({ json:{
        ok:true, credits:{balance:137,lifetimeEarned:237,lifetimeSpent:100}, missions,
        earnRules:[
          {id:'welcome',label:'Regalo de bienvenida',amount:100,note:'Un primer material para cuentas nuevas.'},
          {id:'course-completion',label:'Completa un curso',amount:20,note:'Tu avance se verifica al completar las actividades.'},
          {id:'course-rating',label:'Califica un curso completado',amount:5,note:'Todas las puntuaciones cuentan igual.'}
        ],
        destinations:[{label:'Materiales profesionales',description:'100 créditos por recurso.',section:'materiales',available:true}],
        recentMovements:[{label:'Regalo de bienvenida',amount:200,detail:'Regalo anterior',createdAt:'2026-11-12'}]
      }, headers:{'Access-Control-Allow-Origin':'*'} });
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
    await checkControls(home.locator('button'));
    await harness.noOverflow(page, 'Inicio');
    await harness.shot(page, `inicio-${width}`, '[data-credit-missions-home]');
    const launch = home.getByRole('button', { name:'Ver mi cartera' });
    await launch.focus();
    await page.keyboard.press('Enter');
    const wallet = page.getByRole('dialog', { name:'Tu cartera profesional' });
    await wallet.getByRole('heading', { name:'Misiones para sumar créditos' }).waitFor();
    assert.equal(await wallet.locator('.credit-vault [data-credit-balance]').innerText(), '137');
    assert.match(await wallet.locator('.credit-wallet-panel--earn').innerText(), /\+100/);
    assert.match(await wallet.locator('.credit-wallet-panel--history').innerText(), /\+200/);
    assert.equal(await wallet.locator('.credit-mission').count(), 7);
    assert.equal(await wallet.locator('.credit-mission--completed button,.credit-mission--limited button').count(), 0);
    assert.equal(await wallet.getByRole('progressbar', { name:'Respuestas premiadas esta semana' }).getAttribute('value'), '1');
    assert.equal(await wallet.getByRole('progressbar', { name:'Invitados premiados este mes' }).getAttribute('value'), '2');
    await checkControls(wallet.locator('.credit-mission button'));
    const overflow = await wallet.locator('.credit-wallet-modal__body').evaluate(e => ({scroll:e.scrollWidth,client:e.clientWidth}));
    assert.ok(overflow.scroll <= overflow.client + 1, JSON.stringify(overflow));
    assert.equal(calls.reconciles, 1);
    await wallet.locator('.credit-wallet-missions').evaluate(e => e.scrollIntoView({ block:'start' }));
    await harness.shot(page, `cartera-${width}`);
    await harness.noOverflow(page, 'Cartera');

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
    await page.keyboard.press('Escape');
    await wallet.waitFor({state:'detached'});
    assert.equal(await launch.evaluate(e => e === document.activeElement), true);
    await launch.click();
    await wallet.getByRole('button', { name:'Ir a Comunidad' }).click();
    await page.waitForFunction(() => location.hash === '#foro');
    await wallet.waitFor({state:'detached'});
    assert.deepEqual(errors, []);
    console.log(process.env.ICADEM_TEST_ENGINE || 'chrome', width, 'Inicio, cartera, foco, destinos, límites y reconciliación correctos');
  } finally {
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
