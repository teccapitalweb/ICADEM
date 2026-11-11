'use strict';
// Real panel/browser regression with isolated API fixtures. Never calls production services.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require(process.argv[2] || 'playwright');
const ROOT = path.resolve(__dirname,'..'), SHOTS = process.argv[3];
const widths = process.env.ICADEM_UNLOCK_WIDTHS ? process.env.ICADEM_UNLOCK_WIDTHS.split(',').map(Number) : [320,360,375,390,414,768,1024,1440];
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://local').pathname);const file=path.resolve(ROOT,'.'+name);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(error,content)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'missing':content);});});
const names=['Impuestos para tu negocio','Finanzas y flujo de efectivo','Nómina para profesionales','Contratos comerciales','Comercio exterior','Planeación fiscal'];
const catalog=names.map((titulo,i)=>({id:'course-'+i,titulo,descripcion:'Formación práctica para tu siguiente paso profesional.',area:i%2?'Finanzas':'Legal',nivel:'Intermedio',instructor:'Equipo ICADEM',orden:i,sessionCount:6,sesiones:Array.from({length:6},(_,n)=>({numero:n+1,titulo:'Clase '+(n+1),accessible:false})),materiales:[],portada:'/assets/juegos/foto-fiscal.webp',access:{unlocked:false,daysRemaining:null}}));
const initial=()=>({ok:true,enabled:true,active:true,isAdmin:false,available:2,vipSlots:1,initialChoiceAvailable:true,nextUnlockAt:'2026-11-17T18:00:00Z',selectedCourseIds:[],priorities:[],eligibleCourseIds:catalog.map(c=>c.id),revision:1});
let browser;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,channel:'chrome'});
  let total=0;
  for(const width of widths){
    const ctx=await browser.newContext({viewport:{width,height:width<768?844:1000},serviceWorkers:'block'});
    const page=await ctx.newPage(); let data=initial(), mutations=[], failure=false,conflict=false,hold=false,release=null,readHeld=false;
    const errors=[];page.on('pageerror',error=>{if(/course-unlock|unlocks/.test(error.stack||''))errors.push(error.message);});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());if(url.origin===base)return route.continue();
      const api=url.pathname;
      if(api==='/api/courses/unlocks' && hold){const snapshot={...data};readHeld=true;await new Promise(r=>release=r);return route.fulfill({json:snapshot,headers:{'Access-Control-Allow-Origin':'*'}});}
      if(api==='/api/courses/unlocks')return route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
      if(api==='/api/courses/unlocks/select'){
        const body=route.request().postDataJSON();mutations.push(body);
        if(conflict){conflict=false;return route.fulfill({status:409,json:{ok:false,error:'Tus desbloqueos cambiaron. Revisa tu selección.'},headers:{'Access-Control-Allow-Origin':'*'}});}
        if(failure){failure=false;return route.fulfill({status:503,json:{ok:false,error:'No hay conexión. Inténtalo nuevamente.'},headers:{'Access-Control-Allow-Origin':'*'}});}
        data={...data,available:data.available-body.courseIds.length,vipSlots:Math.max(0,data.vipSlots-Math.max(0,body.courseIds.length-(data.initialChoiceAvailable?1:0))),initialChoiceAvailable:false,selectedCourseIds:[...data.selectedCourseIds,...body.courseIds],eligibleCourseIds:data.eligibleCourseIds.filter(id=>!body.courseIds.includes(id)),revision:data.revision+1,freeCourseId:data.freeCourseId||body.courseIds[0]};
        return route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
      }
      if(api==='/api/courses/unlocks/priorities'){const body=route.request().postDataJSON();data={...data,priorities:body.courseIds,revision:data.revision+1};return route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});}
      if(api==='/api/courses/catalog')return route.fulfill({json:{ok:true,courses:catalog.map(c=>data.selectedCourseIds.includes(c.id)?{...c,access:{unlocked:true},sesiones:c.sesiones.map(s=>({...s,accessible:true}))}:c),viewer:{defaultPreviewCourseId:'course-0'}},headers:{'Access-Control-Allow-Origin':'*'}});
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,OPTIONS'}});
      if(url.hostname.includes('railway'))return route.fulfill({json:{ok:true,items:[],courses:{},credits:{balance:0},profile:{}},headers:{'Access-Control-Allow-Origin':'*'}});
      return route.abort();
    });
    await page.addInitScript(()=>{for(const uid of ['demo','fixture-a','fixture-b'])for(const key of ['tour','credit-gift','free-course-offer-seen'])localStorage.setItem(`icadem:experience:v3:${uid}:${key}`,'complete');});
    await page.goto(base+'/vip-panel.html?modo=demo#cursos',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ICADEMPlatform && window.ICADEMCourseUnlocks && typeof navigateToSection==='function');
    // Other onboarding modules have separate real-service journeys outside this fixture.
    await page.evaluate(()=>{if(window.ICADEMPush)window.ICADEMPush.revisar=async()=> 'seen';});
    await page.evaluate(()=>{window.__isDemoMode=false;window.__currentUser={uid:'fixture-a',getIdToken:()=>Promise.resolve('browser-fixture-only')};window.__auth={currentUser:window.__currentUser};Object.assign(window.UserState,{uid:'fixture-a',modo:'vip',identityReady:true,isAdmin:false,profileComplete:true,profileIntakeSeen:true,displayName:'Estudiante de prueba',freeCourseId:''});window.navigateToSection('cursos');});
    await page.waitForSelector('.course-unlocks__status');
    await page.waitForFunction(()=>document.querySelectorAll('.curso-card').length===6);
    await page.evaluate(()=>{document.querySelectorAll('.ica-tour-root,.ica-experience,#name-modal').forEach(el=>el.hidden=true);document.body.style.overflow='';window.scrollTo(0,0);});
    assert.match(await page.locator('.course-unlocks__status').innerText(),/2 cursos por elegir/);
    const geometry=await page.evaluate(()=>{const card=document.querySelector('.course-unlocks'),r=card.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,card:r.width,right:r.right,left:r.left,filters:!!document.querySelector('#cur-search'),cards:document.querySelectorAll('.curso-card').length};});
    assert.equal(geometry.overflow,false,`panel overflow at ${width}: ${JSON.stringify(geometry)}`);assert.ok(geometry.right<=width+1 && geometry.left>=0);assert.equal(geometry.cards,6);assert.ok(geometry.filters);
    if(SHOTS&&[320,390,768,1440].includes(width)){fs.mkdirSync(SHOTS,{recursive:true});await page.screenshot({path:path.join(SHOTS,`mis-desbloqueos-${width}.png`),fullPage:false});}
    await page.locator('[data-unlock-choose]').click();
    await page.waitForSelector('[data-unlock-pick]');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`selector overflow at ${width}`);
    await page.locator('[data-unlock-search]').fill('Nómina');assert.equal(await page.locator('[data-unlock-pick]').count(),1);
    await page.locator('[data-unlock-search]').fill('');
    await page.locator('[data-unlock-category]').selectOption('Finanzas');assert.equal(await page.locator('[data-unlock-pick]').count(),3);await page.locator('[data-unlock-category]').selectOption('');
    await page.locator('[data-unlock-pick="course-4"]').click();await page.locator('[data-unlock-pick="course-5"]').click();assert.ok(await page.locator('[data-unlock-pick="course-0"]').isDisabled());
    await page.locator('[data-unlock-submit]').click();assert.match(await page.locator('.course-unlock-picker__summary').innerText(),/Vas a desbloquear 2 cursos/);assert.equal(mutations.length,0);
    if(SHOTS&&[390,1440].includes(width))await page.screenshot({path:path.join(SHOTS,`selector-${width}.png`)});
    failure=true;await page.locator('[data-unlock-submit]').click();await page.waitForSelector('[data-unlock-error]:not([hidden])');assert.equal(data.available,2);assert.equal(mutations.length,1);
    await page.locator('[data-unlock-submit]').click();await page.waitForSelector('[data-modal-id="course-unlock-picker"]',{state:'detached'});assert.equal(data.available,0);assert.equal(mutations[0].requestId,mutations[1].requestId);
    await page.waitForFunction(()=>document.querySelector('.course-unlocks__status')?.textContent.includes('próximo desbloqueo'));
    await page.waitForFunction(()=>document.querySelector('.curso-card[data-cid="course-4"]')?.classList.contains('curso-card--locked')===false);
    await page.locator('[data-unlock-organize]').click();await page.waitForSelector('[data-unlock-pick]');
    for(const id of ['course-0','course-1','course-2','course-3'])await page.locator(`[data-unlock-pick="${id}"]`).click();
    assert.equal(await page.locator('.course-unlock-order li').count(),4);await page.locator('[data-order-up="course-3"]').click();assert.match(await page.locator('.course-unlock-order li').nth(2).innerText(),/Contratos/);
    await page.locator('[data-unlock-submit]').click();await page.waitForSelector('[data-modal-id="course-unlock-picker"]',{state:'detached'});assert.equal(data.priorities.length,4);assert.equal(data.available,0);
    await page.locator('[data-unlock-organize]').click();await page.waitForSelector('[data-unlock-pick]');for(const id of [...data.priorities])await page.locator(`[data-order-remove="${id}"]`).click();await page.locator('[data-unlock-cancel]').click();await page.waitForSelector('[data-modal-id="course-unlock-picker"]',{state:'detached'});assert.equal(data.priorities.length,4,'cancel must retain priorities');
    // Existing search and filters continue to operate beside the new card.
    await page.locator('#cur-search').fill('Planeación');await page.waitForTimeout(160);assert.equal(await page.locator('.curso-card').count(),1);await page.locator('#cur-search-clear').click();await page.waitForFunction(()=>document.querySelectorAll('.curso-card').length===6);
    if(width===390){
      const newest={...data};data={...initial(),available:99,revision:1};await page.evaluate(()=>window.ICADEMCourseUnlocks.refresh());assert.match(await page.locator('.course-unlocks__status').innerText(),/próximo desbloqueo/,'old revisions cannot restore spent balance');data=newest;
      data={...newest,active:false,vipSlots:3,available:0,revision:20};await page.evaluate(()=>window.ICADEMCourseUnlocks.refresh());assert.match(await page.locator('.course-unlocks__copy').innerText(),/Reactiva VIP/);assert.equal(await page.locator('[data-unlock-choose]').count(),0);
      data={...initial(),active:false,available:0,vipSlots:0,initialChoiceAvailable:true,revision:21};await page.evaluate(()=>{window.UserState.modo='sin-membresia';window.UserState.freeCourseId='';return window.ICADEMCourseUnlocks.refresh();});assert.match(await page.locator('.course-unlocks__copy').innerText(),/Elige un curso gratuito/);
      await page.evaluate(()=>{window.UserState.freeCourseId='course-1';return window.ICADEMCourseUnlocks.refresh();});assert.match(await page.locator('.course-unlocks__copy').innerText(),/conserva su acceso parcial/);
      data={...initial(),revision:22};await page.evaluate(()=>{window.UserState.modo='vip';return window.ICADEMCourseUnlocks.refresh();});
      data={...data,isAdmin:true,revision:23};await page.evaluate(()=>window.ICADEMCourseUnlocks.refresh());assert.match(await page.locator('.course-unlocks__status').innerText(),/acceso a todos los cursos/);assert.equal(await page.locator('[data-unlock-choose]').count(),0);assert.equal(await page.locator('[data-unlock-explore]').count(),1);
      data={...initial(),revision:24};await page.evaluate(()=>window.ICADEMCourseUnlocks.refresh());
      await page.locator('[data-unlock-choose]').click();await page.waitForSelector('[data-unlock-pick]');await page.locator('[data-unlock-pick="course-1"]').click();await page.locator('[data-unlock-cancel]').click();await page.waitForSelector('[data-modal-id="course-unlock-picker"]',{state:'detached'});assert.equal(data.available,2,'choosing later must retain both rights');
      await page.locator('[data-unlock-choose]').click();await page.waitForSelector('[data-unlock-pick]');await page.locator('[data-unlock-pick="course-1"]').click();await page.locator('[data-unlock-submit]').click();conflict=true;data={...data,available:0,revision:25};await page.locator('[data-unlock-submit]').click();await page.waitForSelector('[data-unlock-error]:not([hidden])');assert.equal(await page.locator('[data-unlock-submit]').isDisabled(),true,'conflict refresh must remove unavailable rights');await page.locator('[data-unlock-cancel]').click();await page.waitForSelector('[data-modal-id="course-unlock-picker"]',{state:'detached'});data={...initial(),revision:26};await page.evaluate(()=>window.ICADEMCourseUnlocks.refresh());
      const source=fs.readFileSync(path.join(ROOT,'vip-panel.html'),'utf8');const welcome=source.slice(source.indexOf('window.__showWelcomeSplash = function(opts) {'),source.indexOf('window.__resetPassword = async'));
      await page.evaluate(code=>{(new Function(code))();window.__showWelcomeSplash({plan:'mensual'});},welcome);
      assert.equal(await page.locator('.splash-film__dot').count(),7);assert.equal(await page.locator('#splash-choose-courses').isVisible(),false);await page.locator('.splash-film__dot').nth(6).click();assert.equal(await page.locator('#splash-choose-courses').isVisible(),true);await page.locator('#splash-choose-courses').click();await page.waitForSelector('#splash-bienvenida',{state:'detached'});assert.equal(await page.locator('[data-modal-id="course-unlock-picker"]').count(),0,'welcome leads to the card without automatically opening a selector');assert.equal(data.available,2);
      // A late response from another account must never repaint this account.
      await page.waitForTimeout(500);await page.evaluate(()=>window.ICADEMCourseUnlocks.refresh());hold=true;await page.evaluate(()=>void window.ICADEMCourseUnlocks.refresh().catch(()=>{}));for(let tries=0;!readHeld&&tries<200;tries++)await new Promise(r=>setTimeout(r,10));assert.ok(readHeld,'fixture must hold a fresh request');
      await page.evaluate(()=>{document.dispatchEvent(new Event('icadem:session-ending'));window.__currentUser={uid:'fixture-b',getIdToken:()=>Promise.resolve('fixture-b')};window.__auth.currentUser=window.__currentUser;window.UserState.uid='fixture-b';});release();hold=false;await page.waitForTimeout(60);assert.equal(await page.locator('[data-course-unlocks]').isVisible(),false);
    }
    assert.deepEqual(errors,[]);total++;console.log(`PASS ${width}px: card, existing catalog/search, selector, confirmation, failure/retry, priorities and cancel`);
    await ctx.close();
  }
  console.log(`PASS ${total}/${widths.length} responsive browser scenarios; all production requests intercepted.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
