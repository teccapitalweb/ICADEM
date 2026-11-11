const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.ICADEM_PLAYWRIGHT_MODULE || 'playwright');
const source = fs.readFileSync(path.join(__dirname,'../js/icadem-learning-route.js'),'utf8');
const css = fs.readFileSync(path.join(__dirname,'../css/icadem-learning-route.css'),'utf8');
let browser;
test.before(async () => { browser = await chromium.launch({headless:true,...(process.env.ICADEM_BROWSER_PATH ? {executablePath:process.env.ICADEM_BROWSER_PATH} : {channel:'chrome'})}); });
test.after(async () => { await browser?.close(); });
async function fixture(options = {}) {
  const page = await browser.newPage({viewport:{width:1100,height:850}});
  await page.setContent('<!doctype html><html><head></head><body style="font-family:Arial;margin:20px;background:#f6f8fb"><main id="route"></main></body></html>');
  await page.addStyleTag({content:css});
  await page.evaluate(options => {
    const image = 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#d5e4ef"/></svg>');
    window.__currentUser = {uid:'student-a'}; window.calls = []; window.toasts = [];
    window.summary = {ok:true,enabled:true,active:true,available:3,revision:5,eligibleCourseIds:['one','two','three'],priorities:['one','two']};
    window.__getCourseUnlockCatalog = async () => [{id:'one',titulo:'Curso Uno',area:'Ciencias',portada:image},{id:'two',titulo:'Curso Dos',area:'Salud',portada:image},{id:'three',titulo:'Curso Tres',area:'Salud',portada:image}];
    window.__courseCoverICADEM = item => item.portada;
    window.ICADEMCourseUnlocks = {refresh:async () => { window.calls.push({path:'/api/courses/unlocks'}); if(options.delayLoad) return new Promise(resolve => window.finishLoad = resolve); return structuredClone(window.summary); }};
    window.ICADEMPlatform = {request:async (url,config) => { window.calls.push({path:url,...config}); if(window.failSave) throw new Error('Sin conexión. Tu borrador sigue aquí.'); if(window.delaySave) return new Promise(resolve => window.finishSave = resolve); window.summary = {...window.summary,priorities:[...config.body.courseIds],revision:window.summary.revision+1}; return structuredClone(window.summary); }};
    window.Toast = {success:(...args) => window.toasts.push(args),info:() => {}};
    window.Modal = {open:config => { const element = document.createElement('div'); element.dataset.fakeDialog = ''; element.append(config.body,config.footer); document.body.append(element); const close = () => { element.remove(); config.onClose?.(); }; return {close}; }};
  },options);
  await page.addScriptTag({content:source});
  if (!options.delayLoad) await page.evaluate(() => window.ICADEMLearningRoute.render(document.getElementById('route')));
  return page;
}
const order = page => page.locator('[data-route-item]').evaluateAll(rows => rows.map(row => row.dataset.routeItem));
test('ordering writes only priorities, preserves rights and waits for server confirmation',async () => {
  const page = await fixture();
  try {
    await page.click('[data-route-add="three"]');
    await page.evaluate(() => {window.delaySave = true;});
    await page.click('[data-route-save]');
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isBusy()),true);
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.requestLeave(() => {})),false);
    assert.equal(await page.evaluate(() => window.toasts.length),0);
    await page.evaluate(() => {window.summary = {...window.summary,priorities:['one','two','three'],revision:6}; window.finishSave(structuredClone(window.summary));});
    await page.waitForFunction(() => !window.ICADEMLearningRoute.isBusy());
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isDirty()),false);
    assert.equal(await page.evaluate(() => window.summary.available),3);
    const calls = await page.evaluate(() => window.calls);
    const writes = calls.filter(call => call.method);
    assert.deepEqual(writes,[{path:'/api/courses/unlocks/priorities',method:'PUT',body:{courseIds:['one','two','three']}}]);
    assert.equal(await page.evaluate(() => window.toasts.length),1);
  } finally { await page.close(); }
});
test('failed saving retains the draft and explicit discard is required before leaving',async () => {
  const page = await fixture();
  try {
    await page.click('[data-route-add="three"]');
    await page.evaluate(() => {window.failSave = true;});
    await page.click('[data-route-save]');
    await page.waitForFunction(() => !window.ICADEMLearningRoute.isBusy());
    assert.deepEqual(await order(page),['one','two','three']);
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isDirty()),true);
    assert.equal(await page.locator('[data-route-error]').isVisible(),true);
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.requestLeave(() => window.didLeave = true)),false);
    assert.equal(await page.evaluate(() => Boolean(window.didLeave)),false);
    await page.click('[data-route-stay]');
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isDirty()),true);
    await page.evaluate(() => window.ICADEMLearningRoute.requestLeave(() => window.didLeave = true));
    await page.click('[data-route-discard]');
    assert.equal(await page.evaluate(() => window.didLeave),true);
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isDirty()),false);
  } finally { await page.close(); }
});
test('keyboard and menu offer the same order changes without unlocking courses',async () => {
  const page = await fixture();
  try {
    await page.locator('[data-route-drag="two"]').focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Space');
    assert.deepEqual(await order(page),['two','one']);
    await page.click('[data-route-menu="two"]'); await page.click('[data-route-action="down"][data-id="two"]');
    assert.deepEqual(await order(page),['one','two']);
    await page.click('[data-route-menu="one"]'); await page.click('[data-route-action="remove"][data-id="one"]');
    assert.deepEqual(await order(page),['two']);
    assert.equal(await page.evaluate(() => window.calls.some(call => call.method)),false);
  } finally { await page.close(); }
});
test('a late loading reply is discarded even when the same uid signs back in',async () => {
  const page = await fixture({delayLoad:true});
  try {
    await page.evaluate(() => {window.loading = window.ICADEMLearningRoute.render(document.getElementById('route'));});
    await page.waitForFunction(() => Boolean(window.finishLoad));
    await page.evaluate(async () => {document.dispatchEvent(new Event('icadem:session-ending')); window.__currentUser = {uid:'student-a'}; window.finishLoad(structuredClone(window.summary)); await window.loading;});
    assert.equal(await page.locator('[data-learning-route]').count(),0);
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isDirty()),false);
  } finally { await page.close(); }
});
test('the initial course creates only a draft and saved ordering survives a fresh render',async () => {
  const page = await fixture();
  try {
    await page.evaluate(async () => {window.ICADEMLearningRoute.setInitialCourse('three'); await window.ICADEMLearningRoute.render(document.getElementById('route'));});
    assert.deepEqual(await order(page),['one','two','three']);
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isDirty()),true);
    assert.equal(await page.evaluate(() => window.calls.some(call => call.method)),false);
    await page.click('[data-route-save]'); await page.waitForFunction(() => !window.ICADEMLearningRoute.isBusy());
    await page.evaluate(async () => {window.ICADEMLearningRoute.reset(); await window.ICADEMLearningRoute.render(document.getElementById('route'));});
    assert.deepEqual(await order(page),['one','two','three']);
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isDirty()),false);
  } finally { await page.close(); }
});
test('removing the last newly added course keeps keyboard focus on an available action',async () => {
  const page = await fixture();
  try {
    await page.evaluate(async () => {window.summary.priorities = []; await window.ICADEMLearningRoute.render(document.getElementById('route'));});
    await page.click('[data-route-add="one"]'); await page.click('[data-route-menu="one"]'); await page.click('[data-route-action="remove"][data-id="one"]');
    assert.equal(await page.evaluate(() => window.ICADEMLearningRoute.isDirty()),false);
    assert.equal(await page.locator('[data-route-save]').isDisabled(),true);
    assert.equal(await page.evaluate(() => document.activeElement.matches('[data-route-add]:not(:disabled),[data-route-search]')),true);
  } finally { await page.close(); }
});
