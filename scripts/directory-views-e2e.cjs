'use strict';
// Full production UI, two isolated browser contexts, intercepted APIs only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,
baseline(on){originals.clear();if(on)for(const f of ['vip-panel.html','css/icadem-directory.css','js/icadem-community.js','js/icadem-professional-navigation.js'])originals.set('/'+f,cp.execFileSync('git',['show','origin/main:'+f],{cwd:ROOT,maxBuffer:8*1024*1024}));},
async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const widths=(process.env.ICADEM_PRIORITY_WIDTHS||'320,360,375,390,414,768,1024,1440').split(',').map(Number);
const templates=[['fixture-a','Mi perfil de prueba',false,'Legal y Corporativo'],['vip-a','Ana Consultora Financiera',true,'Fiscal y Contable'],['vip-b','Bruno Especialista en Negocios',true,'Consultoría de Negocios'],['member-c','Carla Profesional con una especialidad extensa',false,'Fiscal y Contable'],['member-s','Sergio Asesor',false,'Tecnología']].map(([uid,nombre,isVip,sector],i)=>({uid,id:uid,nombre,isVip,sector,puesto:'Consultoría profesional',empresa:'Organización de ejemplo',bio:'Experiencia y colaboración profesional.',foto:'/assets/juegos/foto-fiscal.webp',portadaColorPersonalizado:true,portadaColor:i===1?'#C00089':'#244b64',perfilCompleto:true,contactLocked:true,contacts:{},cv:{resumen:'Trayectoria profesional de prueba.'}}));
function server(){
  const shared={data:h.initial(),received:['vip-b'],sent:['member-s'],connected:['member-c'],mutations:[],reads:0,fail:false,failAction:false};
  const state=id=>id==='fixture-a'?'self':shared.connected.includes(id)?'connected':shared.received.includes(id)?'received':shared.sent.includes(id)?'sent':'none';
  const card=id=>({...templates.find(x=>x.uid===id),connection:state(id)});
  shared.handle=async(route,url)=>{
    const p=url.pathname,req=route.request(),headers={'Access-Control-Allow-Origin':'*'};
    if(!p.startsWith('/api/community')&&p!=='/api/directory')return false;
    if(shared.fail){await route.fulfill({status:503,json:{error:'Sin conexión de prueba'},headers});return true;}
    if(p==='/api/directory'){shared.reads++;await route.fulfill({json:{ok:true,items:templates.map(x=>card(x.uid)),canViewContacts:true},headers});return true;}
    if(p==='/api/community/connections'&&req.method()==='GET'){await route.fulfill({json:{ok:true,received:shared.received.map(card),sent:shared.sent.map(card),connected:shared.connected.map(card)},headers});return true;}
    if(req.method()==='POST'){
      shared.mutations.push({path:p,body:req.postDataJSON()});
      if(shared.holdAction)await new Promise(resolve=>shared.releaseAction=resolve);
      if(shared.failAction){shared.failAction=false;await route.fulfill({status:503,json:{error:'Operación no confirmada'},headers});return true;}
      const parts=p.split('/'),id=parts[4]||req.postDataJSON()?.targetUid,action=parts[5]||'request';
      if(action==='accept'){shared.received=shared.received.filter(x=>x!==id);shared.connected.push(id);}
      else if(action==='reject')shared.received=shared.received.filter(x=>x!==id);
      else if(action==='cancel')shared.sent=shared.sent.filter(x=>x!==id);
      else if(action==='remove')shared.connected=shared.connected.filter(x=>x!==id);
      else shared.sent.push(id);
      await route.fulfill({json:{ok:true},headers});return true;
    }
    if(p.startsWith('/api/community/profiles/')){const id=decodeURIComponent(p.split('/').pop()),profile={...card(id),own:id==='fixture-a',contacts:state(id)==='connected'?{email:'authorized@example.test'}:{}};await route.fulfill({json:{ok:true,profile},headers});return true;}
    return false;
  };return shared;
}
async function go(page,view='directory'){await page.evaluate(v=>navigateToSection(v==='directory'?'directorio':'directorio-'+v),view);await ready(page,view);}
async function ready(page,view){const mapped={solicitudes:'requests',conexiones:'connections',vip:'vip',directory:'directory'}[view];await page.waitForSelector(`[data-directory-view="${mapped}"]`);if(view==='solicitudes'||view==='conexiones')await page.waitForSelector('.community-activity-section');else await page.waitForSelector('.dir-card');}
const ids=page=>page.locator('[data-dircard]').evaluateAll(ns=>ns.map(n=>n.dataset.dircard));
async function profileBack(page){await page.waitForSelector('[data-professional-view] .professional-profile-page');await page.locator('[data-professional-back]').click();}
async function scenario(width){
  const shared=server(),f=await h.fixture(width,shared),{page}=f;
  await go(page);await page.waitForTimeout(120);
  assert.deepEqual((await ids(page)).slice(0,2),['vip-a','vip-b'],'verified VIP group stays first');
  assert.equal(await page.locator('.network-heading p,.network-eyebrow,.network-summary__intro div>span').count(),0);
  const metrics=await page.locator('.network-filters').evaluate(root=>{const select=root.querySelector('select'),input=root.querySelector('input'),s=getComputedStyle(select);return{height:root.getBoundingClientRect().height,select:select.getBoundingClientRect().height,font:parseFloat(s.fontSize),search:input.getBoundingClientRect().height,banner:document.querySelector('.network-summary').getBoundingClientRect().height};});
  assert.ok(metrics.font>=13&&metrics.font<=14,JSON.stringify(metrics));assert.ok(metrics.select>=44&&metrics.select<=48);assert.ok(metrics.search>=44&&metrics.search<=48);if(width<768){assert.ok(metrics.height<180,JSON.stringify(metrics));assert.ok(metrics.banner<235,JSON.stringify(metrics));}
  await h.noOverflow(page,'main '+width);if([320,390,768,1440].includes(width))await h.shot(page,'directory-main-'+width);
  await page.locator('#dir-search-input').fill('Consultora');await page.locator('#dir-sector-select').selectOption('Fiscal y Contable');const parent=await ids(page);
  await page.locator('[data-tier="vip"]').click();await ready(page,'vip');assert.equal(new URL(page.url()).hash,'#directorio-vip');assert.equal(await page.locator('.network-summary,.community-nav').count(),0);assert.equal(await page.locator('h1').last().innerText(),'Profesionales VIP');
  await page.locator('#dir-search-input').fill('');await page.locator('#dir-sector-select').selectOption('todos');assert.deepEqual(await ids(page),['vip-a','vip-b']);
  const cover=await page.locator('[data-dircard="vip-a"] .dir-card__cover').getAttribute('style');assert.ok(cover.includes('#C00089'),'custom cover retained');
  await page.locator('[data-dircard="vip-a"] .network-view-profile').click();await page.waitForSelector('[data-professional-view] .professional-profile-page');assert.equal(await page.locator('a[href^="mailto:"]').count(),0,'unconnected profiles expose no private contacts');await profileBack(page);await ready(page,'vip');assert.deepEqual(await ids(page),['vip-a','vip-b']);
  await page.locator('[data-directory-back]').click();await ready(page,'directory');assert.equal(await page.locator('#dir-search-input').inputValue(),'Consultora');assert.deepEqual(await ids(page),parent);
  await page.goForward();await ready(page,'vip');await page.goBack();await ready(page,'directory');await page.locator('#dir-search-clear').click();await page.locator('#dir-sector-select').selectOption('todos');
  for(const [tab,view,title] of [['requests','solicitudes','Solicitudes de conexión'],['connections','conexiones','Mis conexiones']]){
    await page.locator(`[data-community-tab="${tab}"]`).click();await ready(page,view);assert.equal(new URL(page.url()).hash,'#directorio-'+view);assert.equal(await page.locator('.network-view-heading h1').innerText(),title);assert.equal(await page.locator('.network-summary,.community-nav,.network-filters:visible,.directory-results:visible').count(),0);
    await h.noOverflow(page,view+' '+width);if([320,390,768,1440].includes(width))await h.shot(page,'directory-'+view+'-'+width);
    await page.locator('[data-network-profile]').first().click();await page.waitForSelector('[data-professional-view] .professional-profile-page');if(view==='conexiones')assert.equal(await page.locator('a[href="mailto:authorized@example.test"]').count(),1,'only API-authorized contacts render');await profileBack(page);await ready(page,view);
    await page.locator('[data-directory-back]').click();await ready(page,'directory');
  }
  await go(page,'vip');if([320,390,768,1440].includes(width))await h.shot(page,'directory-vip-'+width);await h.noOverflow(page,'VIP '+width);
  if(width===390){
    const other=await h.fixture(768,shared);await go(other.page,'conexiones');
    await go(page,'solicitudes');shared.failAction=true;await page.locator('[data-network-action="accept"]').click();await page.waitForTimeout(100);assert.ok(!shared.connected.includes('vip-b'),'failed action never invents a connection');
    shared.holdAction=true;const writes=shared.mutations.length;await page.locator('[data-network-action="accept"]').click();await page.waitForTimeout(70);assert.equal(shared.mutations.length,writes+1);assert.ok(!shared.connected.includes('vip-b'),'pending operation has no confirmed success');
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForSelector('[data-network-action="accept"]:not(:disabled)');await page.locator('[data-network-action="accept"]').click();assert.equal(shared.mutations.length,writes+1,'a background repaint cannot duplicate an in-flight operation');
    shared.holdAction=false;shared.releaseAction();await page.waitForFunction(()=>!document.querySelector('[data-network-action="accept"]'));assert.ok(shared.connected.includes('vip-b'));
    await other.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await other.page.waitForFunction(()=>document.querySelectorAll('.community-request').length===2);assert.match(await other.page.locator('[data-network-view-count]').innerText(),/2 conexiones/);
    await other.page.locator('[data-network-action="remove"][data-uid="vip-b"]').click();await other.page.waitForFunction(()=>document.querySelectorAll('.community-request').length===1);
    await go(page,'conexiones');assert.equal(await page.locator('.community-request').count(),1);
    await go(page,'solicitudes');await page.locator('[data-network-action="cancel"]').click();await page.waitForFunction(()=>!document.querySelector('[data-network-action="cancel"]'));assert.deepEqual(shared.sent,[]);
    shared.received=['vip-b'];await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForSelector('[data-network-action="reject"]');await page.locator('[data-network-action="reject"]').click();await page.waitForFunction(()=>!document.querySelector('[data-network-action="reject"]'));
    await go(page,'directory');await page.locator('[data-dircard="vip-a"] [data-connect]').click();await page.waitForFunction(()=>document.querySelector('[data-dircard="vip-a"] [data-connect]')?.dataset.state==='sent');assert.ok(shared.sent.includes('vip-a'));
    await go(page,'vip');shared.fail=true;await page.evaluate(()=>{localStorage.setItem('icadem:directory-public-cache:v1',JSON.stringify({at:Date.now(),items:[{uid:'forged-vip',nombre:'Falso',isVip:true}]}));window.dispatchEvent(new Event('focus'));});await page.waitForSelector('#dir-retry');assert.equal(await page.locator('[data-dircard]').count(),0,'cached profiles cannot become verified VIP or permissions');shared.fail=false;await page.locator('#dir-retry').click();await ready(page,'vip');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.dir-card').first().evaluate(el=>getComputedStyle(el).animationName),'none');await other.context.close();
  }
  if([390,1440].includes(width)){
    for(const view of ['solicitudes','conexiones','vip']){
      const url=new URL(page.url());url.hash='directorio-'+view;
      await page.goto(url.href,{waitUntil:'domcontentloaded'});
      for(let load=0;load<2;load++){
        if(load)await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof navigateToSection==='function'&&window.ICADEMPlatform);
        await page.evaluate(()=>{window.__isDemoMode=false;window.__currentUser={uid:'fixture-a',getIdToken:()=>Promise.resolve('browser-fixture-only')};window.__auth={currentUser:window.__currentUser};Object.assign(UserState,{uid:'fixture-a',modo:'vip',identityReady:true,profileComplete:true,profileIntakeSeen:true});navigateToSection(location.hash.slice(1),{reemplazar:true});});
        await ready(page,view);assert.equal(new URL(page.url()).hash,'#directorio-'+view);await h.noOverflow(page,'direct/reloaded '+view);
      }
    }
  }
  assert.deepEqual(f.state.errors,[]);assert.deepEqual(f.state.selects,[]);console.log(`PASS ${width}px: main/VIP/requests/connections, profiles/origin/history, preserved cards, compact filters/banner, no overflow${[390,1440].includes(width)?', direct links + actual reload (mocked auth)':''}${width===390?', two isolated mocked sessions + confirmed actions/failure/privacy/cache protection':''}`);await f.context.close();
}
(async()=>{await h.start();if(!process.env.ICADEM_SKIP_BASELINE)for(const width of [390,1440]){h.baseline(true);const f=await h.fixture(width,server());await f.page.evaluate(()=>navigateToSection('directorio'));await f.page.waitForSelector('.dir-card');await h.shot(f.page,'before-directory-'+width);await f.context.close();h.baseline(false);}for(const width of widths)await scenario(width);})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>h.stop());
