'use strict';
// Real panel chrome with isolated API fixtures. No request reaches production.
// Touch coverage uses Chromium/CDP emulation, not a physical phone or tablet.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const {chromium} = require(process.argv[2] || 'playwright');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv[3];
const BASELINE = process.env.ICADEM_ROUTE_BASELINE === '1';
const widths = (process.env.ICADEM_ROUTE_WIDTHS || '320,360,375,390,414,768,1024,1440').split(',').map(Number);
const shotWidths = [320,390,768,1440];
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const originals = new Map();
if (BASELINE) for (const name of ['vip-panel.html','js/icadem-course-unlocks.js','css/icadem-courses.css']) {
  originals.set('/'+name, cp.execFileSync('git', ['show',(process.env.ICADEM_ROUTE_BASELINE_REF||'HEAD')+':'+name], {cwd:ROOT,maxBuffer:8*1024*1024}));
}
const server = http.createServer((req,res) => {
  const name = decodeURIComponent(new URL(req.url,'http://fixture').pathname);
  const file = path.resolve(ROOT, '.'+name);
  if (!file.startsWith(ROOT+path.sep)) {res.writeHead(403); return res.end();}
  const original = originals.get(name);
  if (original) {res.writeHead(200, {'Content-Type':types[path.extname(file)]}); return res.end(original);}
  fs.readFile(file, (error,body) => {res.writeHead(error?404:200, {'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'missing':body);});
});
const names = ['Impuestos para tu negocio','Finanzas y flujo de efectivo','Nómina para profesionales','Contratos comerciales','Comercio exterior','Planeación fiscal'];
const catalog = names.map((titulo,i) => ({id:'course-'+i,titulo,descripcion:'Formación práctica para tu siguiente paso profesional.',area:i%2?'Finanzas':'Legal',nivel:'Intermedio',instructor:'Equipo ICADEM',orden:i,sessionCount:6,sesiones:Array.from({length:6},(_,n)=>({numero:n+1,titulo:'Clase '+(n+1),accessible:false})),materiales:[],portada:i===5?'':'/assets/juegos/foto-fiscal.webp?original='+i,access:{unlocked:false,daysRemaining:null}}));
const initial = () => ({ok:true,enabled:true,active:true,isAdmin:false,available:2,vipSlots:1,initialChoiceAvailable:true,nextUnlockAt:'2026-11-17T18:00:00Z',selectedCourseIds:[],priorities:[],eligibleCourseIds:catalog.map(c=>c.id),revision:1});
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,OPTIONS'};
// Preserve the existing fallback URL while isolating its response from external services.
const fallbackImage=fs.readFileSync(path.join(ROOT,'assets/juegos/foto-fiscal.webp'));
let browser,base;

async function fixture(width, shared={data:initial()}) {
  const context = await browser.newContext({viewport:{width,height:width<768?844:1000},serviceWorkers:'block',hasTouch:width<1024});
  const page = await context.newPage();
  const state = {shared,requests:[],selects:[],puts:[],errors:[],failPut:false,holdPut:false,heldPut:false,releasePut:null,holdRead:false,heldRead:false,releaseRead:null};
  page.on('pageerror',error => {if (/learning-route|course-unlocks/.test(error.stack||'')) state.errors.push(error.message);});
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), api = url.pathname;
    if (url.origin === base) return route.continue();
    if(url.hostname==='images.unsplash.com' && request.resourceType()==='image')return route.fulfill({contentType:'image/webp',body:fallbackImage});
    if (request.method() === 'OPTIONS') return route.fulfill({status:204,headers:cors});
    if (api.startsWith('/api/')) state.requests.push({path:api,method:request.method()});
    if (api === '/api/courses/unlocks') {
      if (state.holdRead) {const snapshot={...shared.data};state.heldRead=true;await new Promise(resolve=>state.releaseRead=resolve);return route.fulfill({json:snapshot,headers:cors});}
      return route.fulfill({json:shared.data,headers:cors});
    }
    if (api === '/api/courses/unlocks/priorities') {
      assert.equal(request.method(),'PUT');
      const body=request.postDataJSON();state.puts.push(body);
      if (state.holdPut) {state.heldPut=true;await new Promise(resolve=>state.releasePut=resolve);}
      if (state.failPut) {state.failPut=false;return route.fulfill({status:503,json:{ok:false,error:'No hay conexión. Conservamos tu lista para reintentar.'},headers:cors});}
      shared.data={...shared.data,priorities:body.courseIds,revision:shared.data.revision+1};
      return route.fulfill({json:shared.data,headers:cors});
    }
    if (api === '/api/courses/unlocks/select') {state.selects.push(request.postDataJSON());return route.fulfill({status:500,json:{ok:false,error:'Organizar nunca debe seleccionar cursos.'},headers:cors});}
    if (api === '/api/courses/catalog') return route.fulfill({json:{ok:true,courses:catalog,viewer:{defaultPreviewCourseId:'course-0'}},headers:cors});
    if (url.hostname.includes('railway')) return route.fulfill({json:{ok:true,items:[],courses:{},credits:{balance:0},profile:{}},headers:cors});
    return route.abort();
  });
  await page.addInitScript(() => {
    for (const uid of ['demo','fixture-a','fixture-b']) for (const key of ['tour','credit-gift','free-course-offer-seen']) localStorage.setItem(`icadem:experience:v3:${uid}:${key}`,'complete');
  });
  async function boot() {
    if(page.url().startsWith(base)) await page.reload({waitUntil:'domcontentloaded'});
    await page.goto(base+'/vip-panel.html?modo=demo#cursos',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.ICADEMPlatform && window.ICADEMCourseUnlocks && typeof navigateToSection==='function');
    await page.evaluate(() => {
      if (window.ICADEMPush) window.ICADEMPush.revisar=async()=> 'seen';
      window.__isDemoMode=false;
      window.__currentUser={uid:'fixture-a',getIdToken:()=>Promise.resolve('browser-fixture-only')};
      window.__auth={currentUser:window.__currentUser};
      Object.assign(window.UserState,{uid:'fixture-a',modo:'vip',identityReady:true,isAdmin:false,profileComplete:true,profileIntakeSeen:true,displayName:'Estudiante de prueba',freeCourseId:''});
      window.navigateToSection('cursos');
    });
    await page.waitForSelector('.course-unlocks__status');
    await page.waitForFunction(() => document.querySelectorAll('.curso-card').length===6);
    await page.evaluate(() => {
      document.querySelectorAll('.ica-tour-root,.ica-experience,#name-modal').forEach(el=>el.hidden=true);
      document.body.style.overflow='';window.scrollTo(0,0);
    });
  }
  await boot();
  return {context,page,state,boot};
}

async function screenshot(page,name) {
  if (SHOTS) {fs.mkdirSync(SHOTS,{recursive:true});await page.waitForTimeout(240);await page.screenshot({path:path.join(SHOTS,name+'.png'),fullPage:false});}
}
async function noOverflow(page,label) {
  const geometry=await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert.ok(geometry.scroll<=geometry.width+1 && geometry.body<=geometry.width+1,`${label}: ${JSON.stringify(geometry)}`);
}
async function baseline(width) {
  const f=await fixture(width);const {page}=f;
  await noOverflow(page,'baseline '+width);
  if (shotWidths.includes(width)) await screenshot(page,`before-filters-${width}`);
  const metrics=await page.evaluate(()=>({height:document.querySelector('.courses-controls').getBoundingClientRect().height,search:document.querySelector('#cur-search').getBoundingClientRect().height,selectFont:getComputedStyle(document.querySelector('#cur-area')).fontSize}));
  await page.locator('[data-unlock-organize]').click();
  await page.waitForSelector('[data-unlock-pick]');
  for (const id of ['course-0','course-1','course-2','course-3']) await page.locator(`[data-unlock-pick="${id}"]`).click();
  if (shotWidths.includes(width)) await screenshot(page,`before-popup-${width}`);
  console.log(`BASELINE ${width}px ${JSON.stringify(metrics)}`);await f.context.close();
}

// Added independently from production selectors; the module exposes stable data attributes.
async function routeScenario(width) {
  const f=await fixture(width), {page,state}=f, start=JSON.parse(JSON.stringify(state.shared.data));
  const order=()=>page.locator('[data-route-item]').evaluateAll(items=>items.map(item=>item.dataset.routeItem));
  const ready=()=>page.waitForSelector('[data-route-search]');
  const open=async()=>{await page.locator('[data-unlock-organize]').click();await ready();assert.equal(new URL(page.url()).hash,'#ruta-aprendizaje');assert.equal(await page.locator('[data-modal-id="course-unlock-picker"]').count(),0);};
  const act=async(id,action)=>{await page.locator(`[data-route-menu="${id}"]`).click();await page.locator(`[data-route-action="${action}"][data-id="${id}"]`).click();};
  const point=async selector=>{const b=await page.locator(selector).boundingBox();assert.ok(b,selector);return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const filterMetrics=await page.evaluate(()=>{
    const root=document.querySelector('.courses-controls'),search=document.querySelector('#cur-search'),area=document.querySelector('#cur-area'),level=document.querySelector('#cur-level'),tabs=[...document.querySelectorAll('[data-course-filter]')];
    const rect=e=>{const r=e.getBoundingClientRect();return{top:r.top,left:r.left,right:r.right,height:r.height};};
    return{height:root.getBoundingClientRect().height,search:rect(search),area:rect(area),level:rect(level),font:parseFloat(getComputedStyle(area).fontSize),labels:tabs.map(t=>t.dataset.courseFilter),tabRows:new Set(tabs.map(t=>Math.round(t.getBoundingClientRect().top))).size,sorts:[...document.querySelector('#cur-sort').options].map(o=>o.value)};
  });
  await noOverflow(page,'courses '+width);
  assert.ok(filterMetrics.search.height>=44 && filterMetrics.search.height<=49,JSON.stringify(filterMetrics));
  if(width<1024){assert.ok(filterMetrics.font>=13 && filterMetrics.font<=14,JSON.stringify(filterMetrics));assert.equal(filterMetrics.area.top,filterMetrics.level.top,'category and level use one row');assert.ok(filterMetrics.area.right<=filterMetrics.level.left+1,'filters do not overlap');}
  assert.equal(filterMetrics.tabRows,1,'tabs remain horizontally scrollable in one line');
  assert.deepEqual(filterMetrics.labels,['todos','disponibles','progreso','completados','bloqueados','proximamente']);
  assert.deepEqual(filterMetrics.sorts,['proximos','prioridades','nombre','progreso','recientes']);
  if(shotWidths.includes(width))await screenshot(page,`after-filters-${width}`);
  const covers=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.curso-card')].map(card=>[card.dataset.cid,card.querySelector('.curso-card__cover img')?.getAttribute('src')||card.querySelector('img')?.getAttribute('src')])));
  // Keep real courses controls and scroll context while opening the actual button.
  await page.locator('#cur-search').fill('o');await page.waitForTimeout(180);
  await page.locator('#cur-area').selectOption('Legal');await page.locator('#cur-level').selectOption('Intermedio');await page.locator('#cur-sort').selectOption('nombre');
  assert.deepEqual(await page.locator('.curso-card').evaluateAll(cards=>cards.map(card=>card.dataset.cid)),['course-4','course-0','course-2'],'main catalog query, category, level and original name ordering remain reactive');
  await page.evaluate(()=>{document.body.scrollTop=160;window.scrollTo(0,160);});
  const beforeScroll=await page.evaluate(()=>({window:scrollY,body:document.body.scrollTop,main:document.querySelector('main.main').scrollTop}));
  await page.locator('[data-unlock-organize]').evaluate(button=>button.click());await ready();
  assert.equal(new URL(page.url()).hash,'#ruta-aprendizaje');
  assert.equal(await page.locator('[data-modal-id="course-unlock-picker"]').count(),0);
  assert.match(await page.locator('[data-learning-route] h1').innerText(),/Mi ruta de aprendizaje/);
  assert.equal(await page.locator('[data-route-save]').isDisabled(),true);
  await noOverflow(page,'empty route '+width);
  const layout=await page.evaluate(()=>{
    const ex=document.querySelector('.lr-explore').getBoundingClientRect(),list=document.querySelector('.lr-priorities').getBoundingClientRect();
    return{content:document.querySelector('.learning-route').getBoundingClientRect().width,explore:{left:ex.left,top:ex.top,right:ex.right},list:{left:list.left,top:list.top,right:list.right},sticky:getComputedStyle(document.querySelector('.lr-priorities')).position};
  });
  if(layout.content>760){assert.ok(layout.explore.right<=layout.list.left+1,JSON.stringify(layout));assert.equal(layout.sticky,'sticky');}
  else assert.ok(layout.list.top<layout.explore.top,JSON.stringify(layout));
  const routeCovers=await page.locator('[data-route-results] [data-route-cover]').evaluateAll(images=>Object.fromEntries(images.map(img=>[img.dataset.routeCover,img.getAttribute('src')])));
  assert.deepEqual(routeCovers,covers,'each route cover equals the main catalog cover, including the shared fallback');
  const imageStyles=await page.locator('[data-route-results] img').evaluateAll(images=>images.map(img=>({fit:getComputedStyle(img).objectFit,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height,ratio:getComputedStyle(img).aspectRatio,loading:img.loading})));
  imageStyles.forEach(img=>{assert.equal(img.fit,'cover');assert.ok(Math.abs(img.width/img.height-16/9)<.08);assert.equal(img.loading,'lazy');});
  await page.locator('[data-route-results] [data-route-cover="course-5"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-route-results] img')].every(image=>image.complete&&image.naturalWidth>0));
  await page.evaluate(()=>{document.body.scrollTop=0;window.scrollTo(0,0);});
  await page.locator('[data-route-search]').fill('nómina');assert.equal(await page.locator('[data-route-add]').count(),1);
  await page.locator('[data-route-category]').selectOption('Finanzas');assert.equal(await page.locator('[data-route-add]').count(),0);assert.match(await page.locator('[data-route-results]').innerText(),/No encontramos/);
  await page.locator('[data-route-clear]').click();assert.equal(await page.locator('[data-route-add]').count(),6);
  for(const id of ['course-0','course-1','course-2','course-3'])await page.locator(`[data-route-add="${id}"]`).click();
  assert.deepEqual(await order(),['course-0','course-1','course-2','course-3']);assert.equal(await page.locator('[data-route-count]').innerText(),'4');assert.equal(await page.locator('[data-route-add="course-0"]').isDisabled(),true);assert.equal(state.puts.length,0);
  await page.locator('[data-route-menu="course-0"]').click();assert.equal(await page.locator('[data-route-action="up"][data-id="course-0"]').isDisabled(),true);await page.keyboard.press('Escape');
  await page.locator('[data-route-menu="course-3"]').click();assert.equal(await page.locator('[data-route-action="down"][data-id="course-3"]').isDisabled(),true);await page.keyboard.press('Escape');
  await act('course-3','up');assert.deepEqual(await order(),['course-0','course-1','course-3','course-2']);
  await act('course-3','remove');assert.deepEqual(await order(),['course-0','course-1','course-2']);await page.locator('[data-route-add="course-3"]').click();
  await page.locator('[data-route-drag="course-0"]').focus();await page.keyboard.press('Space');await page.keyboard.press('ArrowDown');await page.keyboard.press('Space');assert.deepEqual(await order(),['course-1','course-0','course-2','course-3']);
  // Real mouse input exercises pointer capture and handle-only dragging.
  await page.locator('[data-route-item="course-1"]').scrollIntoViewIfNeeded();
  let from=await point('[data-route-drag="course-1"]'),to=await point('[data-route-item="course-2"]');
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x+7,from.y+7,{steps:3});await page.mouse.move(from.x,to.y,{steps:12});await page.mouse.up();
  assert.deepEqual(await order(),['course-0','course-2','course-1','course-3'],'mouse drag reorders');
  if(width<1024){
    // CDP touchStart/touchMove/touchEnd produce native trusted pointer events.
    const cdp=await f.context.newCDPSession(page);await page.locator('[data-route-item="course-0"]').scrollIntoViewIfNeeded();
    from=await point('[data-route-drag="course-0"]');to=await point('[data-route-item="course-1"]');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});await page.waitForTimeout(190);
    for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x,y:from.y+(to.y-from.y)*step/8}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    assert.deepEqual(await order(),['course-2','course-1','course-0','course-3'],'emulated touch drag reorders');
  }
  await noOverflow(page,'populated route '+width);
  await page.waitForTimeout(240);
  const rows=await page.locator('[data-route-item]').evaluateAll(items=>items.map(item=>{const r=item.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
  rows.forEach((row,i)=>{assert.ok(row.left>=0&&row.right<=width+1,'priority row stays inside viewport');if(i)assert.ok(row.top>=rows[i-1].bottom,'priority rows settle without overlap after movement');});
  const expected=await order();
  const unload=await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});assert.equal(unload,true,'dirty route asks the browser before unload');
  if(shotWidths.includes(width)){await page.evaluate(()=>{document.body.scrollTop=0;window.scrollTo(0,0);});await screenshot(page,`after-route-${width}`);}
  state.failPut=true;await page.locator('[data-route-save]').click();await page.waitForSelector('[data-route-error]:not([hidden])');
  assert.deepEqual(await order(),expected,'server failure preserves draft');assert.deepEqual(state.shared.data.priorities,[]);assert.equal(await page.evaluate(()=>ICADEMLearningRoute.isDirty()),true);
  state.holdPut=true;await page.locator('[data-route-save]').click();await page.waitForFunction(()=>ICADEMLearningRoute.isBusy());
  assert.match(await page.locator('[data-route-save-status]').innerText(),/Guardando/);assert.doesNotMatch(await page.locator('[data-route-save-status]').innerText(),/Todos los cambios guardados/);
  assert.equal(await page.locator('[data-route-back]').isDisabled(),true);
  await page.evaluate(()=>navigateToSection('inicio'));assert.equal(new URL(page.url()).hash,'#ruta-aprendizaje','busy navigation stays on route');
  await page.evaluate(()=>history.back());await page.waitForTimeout(80);assert.equal(new URL(page.url()).hash,'#ruta-aprendizaje','busy Back restores current route');
  assert.equal(await page.locator('[data-route-stay]').count(),0,'busy state does not open a discard prompt');
  assert.ok(state.heldPut);state.releasePut();state.holdPut=false;
  await page.waitForFunction(()=>!ICADEMLearningRoute.isBusy()&&!ICADEMLearningRoute.isDirty());
  assert.match(await page.locator('[data-route-save-status]').innerText(),/Todos los cambios guardados/);assert.deepEqual(state.shared.data.priorities,expected);
  assert.equal(state.shared.data.available,start.available);assert.equal(state.shared.data.vipSlots,start.vipSlots);assert.equal(state.shared.data.initialChoiceAvailable,start.initialChoiceAvailable);assert.deepEqual(state.shared.data.selectedCourseIds,[]);assert.deepEqual(state.selects,[]);
  await page.locator('[data-route-save]').scrollIntoViewIfNeeded();
  const saveBounds=await page.locator('[data-route-save]').boundingBox();assert.ok(saveBounds.x>=0 && saveBounds.x+saveBounds.width<=width+1,'save remains inside viewport');
  const saveClear=await page.locator('[data-route-save]').evaluate(button=>{const r=button.getBoundingClientRect();const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return button===target||button.contains(target);});assert.equal(saveClear,true,'save is not covered by the fixed mobile dock');
  if(shotWidths.includes(width))await screenshot(page,`after-save-${width}`);
  await page.locator('[data-route-back]').click();await page.waitForSelector('#cur-search');await page.waitForTimeout(220);
  assert.equal(await page.locator('#cur-search').inputValue(),'o');assert.equal(await page.locator('#cur-area').inputValue(),'Legal');assert.equal(await page.locator('#cur-level').inputValue(),'Intermedio');assert.equal(await page.locator('#cur-sort').inputValue(),'prioridades','confirmed save activates the current catalog preference while preserving the other controls');
  const returnedScroll=await page.evaluate(()=>{const main=document.querySelector('main.main');return{window:scrollY,body:document.body.scrollTop,main:main.scrollTop,maxWindow:Math.max(0,document.documentElement.scrollHeight-innerHeight),maxBody:Math.max(0,document.body.scrollHeight-document.body.clientHeight),maxMain:Math.max(0,main.scrollHeight-main.clientHeight)};});
  assert.deepEqual({window:returnedScroll.window,body:returnedScroll.body,main:returnedScroll.main},{window:Math.min(beforeScroll.window,returnedScroll.maxWindow),body:Math.min(beforeScroll.body,returnedScroll.maxBody),main:Math.min(beforeScroll.main,returnedScroll.maxMain)},'back restores course scroll, clamped by a shorter filtered page');
  await open();assert.deepEqual(await order(),expected,'fresh GET restores saved order');
  // Browser Back also returns to the retained courses controls.
  await page.evaluate(()=>history.back());await page.waitForSelector('#cur-search');assert.equal(await page.locator('#cur-area').inputValue(),'Legal');
  await open();await page.locator('[data-route-add="course-4"]').click();
  const dirtyURL=page.url();await page.locator('[data-section="inicio"]:visible').first().click();await page.waitForSelector('[data-route-stay]');
  await page.locator('[data-route-stay]').click();await page.waitForSelector('[data-route-stay]',{state:'detached'});assert.equal(page.url(),dirtyURL);assert.ok((await order()).includes('course-4'));
  await page.evaluate(()=>history.back());await page.waitForSelector('[data-route-stay]');await page.locator('[data-route-stay]').click();await page.waitForSelector('[data-route-stay]',{state:'detached'});assert.equal(page.url(),dirtyURL);
  await page.evaluate(()=>history.back());await page.waitForSelector('[data-route-discard]');await page.locator('[data-route-discard]').click();await page.waitForSelector('[data-route-discard]',{state:'detached'});await page.waitForSelector('#cur-search');assert.deepEqual(state.shared.data.priorities,expected);
  await open();assert.deepEqual(await order(),expected,'discard leaves server and next draft unchanged');
  await page.locator('[data-route-add="course-4"]').click();await page.locator('[data-section="inicio"]:visible').first().click();await page.waitForSelector('[data-route-discard]');await page.locator('[data-route-discard]').click();await page.waitForSelector('[data-route-discard]',{state:'detached'});
  await page.waitForFunction(()=>location.hash==='#inicio');assert.deepEqual(state.shared.data.priorities,expected);
  // A fresh browser storage partition is a second-device synchronization fixture.
  if(width===390){
    const second=await fixture(768,state.shared);await second.page.locator('[data-unlock-organize]').click();await second.page.waitForSelector('[data-route-search]');assert.deepEqual(await second.page.locator('[data-route-item]').evaluateAll(items=>items.map(item=>item.dataset.routeItem)),expected,'fresh device fetches server order');await second.context.close();
    await f.boot();await open();assert.deepEqual(await order(),expected,'reload fetches server order');
    await page.locator('[data-route-add="course-4"]').click();state.holdPut=true;await page.locator('[data-route-save]').click();await page.waitForFunction(()=>ICADEMLearningRoute.isBusy());
    await page.evaluate(()=>{document.dispatchEvent(new Event('icadem:session-ending'));window.__currentUser={uid:'fixture-b',getIdToken:()=>Promise.resolve('fixture-b')};window.__auth.currentUser=window.__currentUser;window.UserState.uid='fixture-b';});
    const count=state.puts.length;state.releasePut();state.holdPut=false;await page.waitForTimeout(120);assert.equal(await page.locator('[data-learning-route]').count(),0,'late save cannot repaint another UID');assert.equal(await page.evaluate(()=>ICADEMLearningRoute.isDirty()||ICADEMLearningRoute.isBusy()),false);assert.equal(state.puts.length,count,'stale UI cannot issue another save');
  }
  assert.deepEqual(state.selects,[]);assert.deepEqual(state.errors,[]);
  console.log(`PASS ${width}px: layout/covers/filters, add/remove/menu/keyboard/mouse${width<1024?'/CDP touch':''}, PUT failure+busy+save, Back/return+dirty guards; filters ${filterMetrics.height.toFixed(0)}px/${filterMetrics.font}px`);
  await f.context.close();
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,channel:'chrome'});
  for (const width of widths) await (BASELINE?baseline:routeScenario)(width);
  console.log(`PASS ${widths.length}/${widths.length} ${BASELINE?'baseline captures':'learning-route scenarios'}; all external requests intercepted; touch is emulated.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
