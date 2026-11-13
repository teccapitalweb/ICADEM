'use strict';
// Actual panel and router; all API responses synthetic. No student data is written.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=process.argv[3],baseline=process.env.ICADEM_COMPACT_BASELINE==='1';
let source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
if(baseline)source=source.replace('const types=',`for(const file of ['vip-panel.html','js/icadem-course-unlocks.js','css/icadem-course-unlocks.css','css/icadem-courses.css','js/icadem-professional-activity.js','css/icadem-professional-activity.css'])originals.set('/'+file,cp.execFileSync('git',['-c','safe.directory='+ROOT.replace(/\\\\/g,'/'),'show','5ea3d11:'+file],{cwd:ROOT,maxBuffer:8*1024*1024}));\nconst types=`);
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,getBase:()=>base,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const activitySource=fs.readFileSync(path.join(__dirname,'professional-activity-e2e.cjs'),'utf8');
const a=new Function('h','assert',activitySource.slice(activitySource.indexOf('const templates='),activitySource.indexOf('async function scenario(width)',activitySource.indexOf('const templates=')))+'return {server,openActivity,readyPost};')(h,assert);
const widths=(process.env.ICADEM_PRIORITY_WIDTHS||'320,390,768,1440').split(',').map(Number),metrics=[];
async function top(p,selector){await p.locator(selector).evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'}));await p.waitForTimeout(200);}
async function measure(p,selector){return p.locator(selector).evaluate(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top};});}
async function targets(p,selector){const values=await p.locator(selector).evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {label:n.getAttribute('aria-label')||n.textContent||n.id,width:r.width,height:r.height};}));for(const g of values)assert(g.height>=43.5,'comfortable touch target '+JSON.stringify(g));}
async function scenario(width){
 const s=a.server();s.data.priorities=['course-4','course-0','course-2'];const f=await h.fixture(width,s),p=f.page;
 const record={width,engine:process.env.ICADEM_TEST_ENGINE||'chrome',baseline};
 await top(p,'[data-course-unlocks]');record.unlocks=await measure(p,'[data-course-unlocks]');record.filters=await measure(p,'.courses-controls');
 await h.shot(p,'courses-'+width);await h.noOverflow(p,'course controls '+width);
 if(!baseline){
   assert.equal(await p.locator('[data-unlock-choose]:disabled').count(),0,'no large disabled choosing action');
   assert.equal(await p.locator('[data-unlock-priority]').getAttribute('data-priority-course'),'course-4');
   await targets(p,'.course-unlocks button,.courses-controls input,.courses-controls select,.courses-filter-chip');
   for(const [title,change] of [['available',{available:2,vipSlots:2}],['initial',{available:1,vipSlots:0,initialChoiceAvailable:true}],['all-selected',{available:0,vipSlots:0,initialChoiceAvailable:false,eligibleCourseIds:[],nextUnlockAt:null}],['waiting',{available:0,vipSlots:0,eligibleCourseIds:['course-0','course-2','course-3','course-4','course-5'],nextUnlockAt:'2026-11-17T18:00:00Z'}]]){
     s.data={...s.data,...change,revision:s.data.revision+1};await p.evaluate(()=>ICADEMCourseUnlocks.refresh());await p.waitForTimeout(100);await h.noOverflow(p,'unlocks '+title+' '+width);if(width===390){await top(p,'[data-course-unlocks]');await h.shot(p,'courses-'+title+'-'+width);}
   }
   await p.locator('#cur-sort').selectOption('prioridades');const ids=await p.locator('.curso-card').evaluateAll(ns=>ns.map(n=>n.dataset.cid));assert.deepEqual(ids.filter(id=>s.data.priorities.includes(id)),s.data.priorities);
   await p.locator('#cur-area').selectOption('Fiscal');await p.locator('#cur-search').fill('nómina');await p.waitForTimeout(140);assert.deepEqual(await p.locator('.curso-card').evaluateAll(ns=>ns.map(n=>n.dataset.cid)),['course-4']);await p.locator('#cur-search-clear').click();await p.locator('#cur-area').selectOption('todas');await p.locator('#cur-level').selectOption('Avanzado');await p.locator('#cur-level').selectOption('todos');
   for(const view of ['disponibles','progreso','bloqueados','completados','proximamente']){const b=p.locator('[data-course-filter="'+view+'"]');if(!await b.count())continue;await b.click();await p.locator('[data-courses-back]').waitFor();await p.locator('[data-courses-back]').click();}
   assert.deepEqual(s.data.priorities,['course-4','course-0','course-2']);assert.deepEqual(f.state.selects,[]);assert.deepEqual(f.state.puts,[]);
 }
 await p.evaluate(()=>navigateToSection('canal'));await p.locator('.wa-hero').waitFor();await top(p,'#dynamic-section');record.channel=await measure(p,'.wa-hero');record.benefits=await measure(p,'.wa-stats');await h.shot(p,'contacts-'+width);await h.noOverflow(p,'contacts '+width);
 record.destinations=await p.evaluate(()=>({channel:ICADEM_CONTACT.canal,support:ICADEM_CONTACT.waLink(ICADEM_CONTACT.msgSoporte()),instagram:ICADEM_CONTACT.instagram,facebook:ICADEM_CONTACT.facebook,share:ICADEM_CONTACT.shareInvitacion}));
 if(!baseline){
   assert.match(await p.locator('#dynamic-section h1').innerText(),/Contactos ICADEM/);assert.equal(await p.locator('.mobile-drawer #drawer-whatsapp-support').count(),0);assert.equal(await p.locator('a[data-section="canal"]').filter({hasText:'Contactos ICADEM'}).count(),2);
   assert.equal(await p.locator('.wa-hero').evaluate(n=>getComputedStyle(n).marginTop),'0px','no inherited dashboard spacing before the compact channel');
   assert.equal(await p.locator('#btn-wa-support').count(),1);assert.equal(await p.locator('.social-card').count(),3);assert.equal(await p.locator('.wa-stat').count(),3);
   if(width<768){await p.locator('#mobile-nav-more').click();await p.locator('#mobile-drawer[aria-hidden="false"]').waitFor();const drawer=p.locator('#mobile-drawer');assert.doesNotMatch(await drawer.innerText(),/Soporte por WhatsApp/);assert.match(await drawer.innerText(),/Soporte privado/);const contact=drawer.getByRole('link',{name:'Contactos ICADEM',exact:true});await contact.scrollIntoViewIfNeeded();await h.shot(p,'mobile-menu-'+width);await contact.click();await p.waitForFunction(()=>document.getElementById('mobile-drawer').getAttribute('aria-hidden')==='true');assert.equal(new URL(p.url()).hash,'#canal');}
   await targets(p,'#btn-wa-canal-open,#btn-wa-canal-share,#btn-wa-support,.social-grid a');
   // Stub only final OS/external opening; exercise the existing delegated handlers.
   await p.evaluate(()=>{window.__openedLinks=[];window.open=(url,target,features)=>{window.__openedLinks.push({url:String(url),target,features});return null;};});
   for(const [selector,key] of [['#btn-wa-canal-open','channel'],['#btn-wa-support','support'],['#btn-wa-canal-share','share']]){await p.locator(selector).click();const opened=await p.evaluate(()=>window.__openedLinks.at(-1));assert(opened?.url,'handler opens '+selector);if(key!=='share')assert.equal(opened.url,record.destinations[key]);else assert.match(opened.url,/^https:\/\/wa\.me\/\?text=/);}
   assert.equal(await p.locator('a[href="'+record.destinations.instagram+'"]').count(),1);assert.equal(await p.locator('a[href="'+record.destinations.facebook+'"]').count(),1);
   await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>document.documentElement.dataset.theme='night');await h.noOverflow(p,'contacts night '+width);await top(p,'#dynamic-section');if([390,1440].includes(width))await h.shot(p,'contacts-night-'+width);await p.evaluate(()=>document.documentElement.dataset.theme='day');
 }
 await p.waitForFunction(()=>!document.querySelector('.toast'));
 await a.openActivity(p,'author');await a.readyPost(p,'post-new');await top(p,'[data-activity-post]');record.activity=await measure(p,'[data-activity-post]');await p.locator('.activity-counts').first().scrollIntoViewIfNeeded();
 if(!baseline){const clear=await p.locator('.activity-counts').first().evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===n||n.contains(hit);});assert(clear,'publication footer remains reachable above the fixed dock');}
 await h.shot(p,'activity-'+width);await h.noOverflow(p,'activity '+width);
 if(!baseline){
   assert.equal(await p.getByRole('button',{name:'Ver publicación'}).count(),0);const link=p.locator('[data-activity-post="post-new"] [data-activity-open]');await link.focus();await p.keyboard.press('Enter');await p.locator('.post.is-notification-target').waitFor();assert.equal(new URL(p.url()).searchParams.get('publicacion'),'post-new');await p.locator('[data-forum-back-activity]').click();await a.readyPost(p,'post-new');await p.locator('[data-activity-post="post-new"] .activity-text').click();await p.locator('.post.is-notification-target').waitFor();await p.goBack();await a.readyPost(p,'post-new');await p.locator('[data-activity-back]').click();await p.locator('.professional-profile-page').waitFor();assert.deepEqual(s.mutations,[]);assert.deepEqual(f.state.selects,[]);
 }
 metrics.push(record);console.log('PASS '+JSON.stringify(record));await f.context.close();
}
(async()=>{try{await h.start();for(const width of widths)await scenario(width);if(OUT){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'metrics.json'),JSON.stringify(metrics,null,2));}}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
