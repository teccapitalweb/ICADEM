'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Use the actual panel with the existing isolated browser/API fixture.
const fixturePath = path.join(__dirname, 'course-priorities-e2e.cjs');
const source = fs.readFileSync(fixturePath, 'utf8');
const harness = new Function('require', '__dirname', 'process', source.slice(0, source.indexOf('async function scenario(width)')) + `
return {fixture,initial,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require, __dirname, process);

const mission = { id:'forum-reply', title:'Comenta en Comunidad', amount:3, section:'foro', status:'available',
  description:'Comparte una idea en una publicación de otro miembro.' };
const cors = { 'Access-Control-Allow-Origin':'*' };
const root = '/api/credits/mission-invitation';

async function scenario(width, channel) {
  let claims = 0;
  let staleSuggestion = channel === 'inline';
  let dismissed = false;
  let emailEnabled = false;
  const captured = [];
  const shared = {
    data:harness.initial(),
    async handle(route, url) {
      const json = body => route.fulfill({ json:body, headers:cors });
      const request = route.request();
      switch (url.pathname) {
        case '/api/credits/wallet':
          await json({ok:true, credits:{balance:122}, missions:[mission], recentMovements:[]});
          return true;
        case root:
          await json({ok:true, invitation: claims || dismissed ? null : {
            mission: staleSuggestion ? {...mission, id:'professional-card', title:'Completa tu tarjeta', amount:15} : mission,
            channel
          }, emailReminderEnabled:emailEnabled});
          return true;
        case root + '/exposure':
          assert.equal(request.method(), 'POST');
          if (staleSuggestion) {
            assert.deepEqual(request.postDataJSON(), {missionId:'professional-card',channel});
            staleSuggestion = false;
            await json({ok:true,claimed:false});
            return true;
          }
          assert.deepEqual(request.postDataJSON(), {missionId:mission.id,channel});
          claims++;
          await json({ok:true,claimed:claims === 1});
          return true;
        case root + '/dismiss':
          dismissed = true;
          await json({ok:true});
          return true;
        case root + '/email-preference':
          emailEnabled = request.postDataJSON().enabled;
          captured.push(emailEnabled);
          await json({ok:true,emailReminderEnabled:emailEnabled});
          return true;
        default: return false;
      }
    }
  };
  const { context, page } = await harness.fixture(width, shared);
  try {
    await page.evaluate(() => {
      const blocker = document.createElement('dialog');
      blocker.id = 'fixture-mission-blocker';
      blocker.innerHTML = '<button type="button">Aviso en curso</button>';
      document.body.append(blocker);
      blocker.showModal();
      navigateToSection('inicio');
    });
    const home = page.locator('[data-credit-missions-home]');
    // The panel also resets scroll after the navigation paint.
    await page.waitForTimeout(160);
    await home.scrollIntoViewIfNeeded();
    const invitation = page.locator('.mission-invitation');
    await page.waitForTimeout(250);
    assert.equal(claims, 0, 'Exposure waits while an existing dialog has focus');
    assert.equal(await invitation.count(), 0);
    assert.equal(await page.locator('dialog[open]').count(), 1);
    assert.equal(await page.locator('#fixture-mission-blocker button').evaluate(node => node === document.activeElement), true);
    if (channel === 'inline') {
      await home.evaluate(node => {
        const replacement = node.cloneNode(true);
        replacement.style.marginTop = '110vh';
        node.replaceWith(replacement);
        window.dispatchEvent(new CustomEvent('icadem:section-ready', {detail:{section:'inicio'}}));
      });
    }
    await page.evaluate(() => {
      const blocker = document.getElementById('fixture-mission-blocker');
      blocker.close();
      blocker.remove();
      document.querySelector('[data-credit-missions-home] [data-credit-wallet-open]').focus({ preventScroll:true });
    });
    await home.scrollIntoViewIfNeeded();
    await invitation.waitFor();
    assert.equal(await invitation.evaluate(node => node.tagName), 'ASIDE');
    assert.equal(await invitation.getAttribute('data-mission-invitation-id'), mission.id);
    assert.equal(await page.locator('dialog[open]').count(), 0, 'Both cohorts render in the page');
    assert.equal(await home.locator('[data-credit-wallet-open]').first().evaluate(node => node === document.activeElement), true, 'The invitation preserves focus');
    assert.equal(await home.locator(`[data-credit-mission="${mission.id}"]`).count(), 0, 'Home presents the mission once');
    assert.match(await invitation.innerText(), /Comenta en Comunidad[\s\S]*\+3 créditos/);
    await harness.noOverflow(page, `${channel} ${width}`);
    const controls = await invitation.locator('button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    assert.ok(controls.every(height => height >= 44), 'Touch controls are at least 44px');
    if (process.argv[3]) await harness.shot(page, channel + '-' + width, '.mission-invitation');
    if (channel === 'popup') {
      const sent = page.waitForResponse(response => new URL(response.url()).pathname === root + '/dismiss');
      await invitation.getByRole('button',{name:'Ahora no'}).press('Enter');
      await sent;
      await invitation.waitFor({state:'detached'});
      await home.locator(`[data-credit-mission="${mission.id}"]`).waitFor();
      assert.equal(await home.locator('[data-credit-wallet-open]').first().evaluate(node => node === document.activeElement), true, 'Dismissal returns focus to the wallet link');
      assert.equal(dismissed,true);
    } else {
      await invitation.getByRole('button',{name:'Ir a Comunidad'}).click();
      await page.waitForFunction(() => location.hash === '#foro');
      await invitation.waitFor({state:'detached'});
      assert.equal(dismissed,false);
    }
    await page.evaluate(() => navigateToSection('perfil'));
    const toggle = page.locator('[data-mission-email-toggle]');
    await page.waitForFunction(() => !document.querySelector('[data-mission-email-toggle]').disabled);
    assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('[data-mission-email-toggle]').getAttribute('aria-pressed') === 'true');
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('[data-mission-email-toggle]').getAttribute('aria-pressed') === 'false');
    assert.deepEqual(captured,[true,false]);
    await page.evaluate(() => navigateToSection('inicio'));
    await home.scrollIntoViewIfNeeded();
    assert.equal(await invitation.count(),0);
    assert.equal(claims,1,'The same account only reserves one exposure');
    console.log(`${process.env.ICADEM_TEST_ENGINE || 'chrome'} ${width} ${channel} passed`);
  } catch (error) {
    const panelState = await page.evaluate(() => ({
      section: location.hash, focused: document.hasFocus(), visibility: document.visibilityState,
      active: document.activeElement?.outerHTML.slice(0, 160),
      home: document.querySelector('[data-credit-missions-home]')?.getBoundingClientRect().toJSON(),
      openDialogs: Array.from(document.querySelectorAll('dialog[open]'), node => node.id || node.className)
    })).catch(() => null);
    console.error('Mission invitation fixture', {channel, width, claims, panelState});
    throw error;
  } finally { await context.close(); }
}

(async () => {
  try { await harness.start(); await scenario(390,'popup'); await scenario(1440,'inline'); }
  finally { await harness.stop(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
