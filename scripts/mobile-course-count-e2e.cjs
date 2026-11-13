'use strict';
// Full panel and native controls; isolated responses, never production writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=process.argv[3],baseline=process.env.ICADEM_COUNT_BASELINE==='1';
let source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
source=source.replace("if(api==='/api/courses/unlocks'){","if(shared.control && await shared.control(route,url))return;\n    if(api==='/api/courses/unlocks'){");
source=source.replace("document.querySelectorAll('.curso-card').length===8","document.querySelectorAll('.curso-card').length===32");
if(baseline)source=source.replace('const types=',`for(const file of ['css/icadem-courses.css','js/icadem-platform-v2.js'])originals.set('/'+file,cp.execFileSync('git',['-c','safe.directory='+ROOT.replace(/\\\\/g,'/'),'show','493c7eb:'+file],{cwd:ROOT,maxBuffer:8*1024*1024}));\nconst types=`);
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,catalog,cards,badges,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const widths=(process.env.ICADEM_PRIORITY_WIDTHS||'320,360,375,390,414,430,768,1440').split(',').map(Number),records=[];
function backend(){
 const s={data:{...h.initial(),priorities:['course-4','course-0','course-2']},catalog:Array.from({length:32},(_,i)=>({...structuredClone(h.catalog[i%8]),id:'course-'+i,orden:i+1,titulo:h.catalog[i%8].titulo+(i>=8?' · '+i:'')})),counts:{},holdAcademic:false,holdWallet:false,held:[],fail:false};
 s.control=async(route,url)=>{
  const p=url.pathname,academic=['/api/identity/sync','/api/learning/progress','/api/courses/catalog','/api/courses/unlocks'].includes(p),wallet=p==='/api/credits/wallet';
  if(!academic&&!wallet)return false;s.counts[p]=(s.counts[p]||0)+1;
  const json=p==='/api/courses/catalog'?{ok:true,courses:structuredClone(s.catalog),viewer:{defaultPreviewCourseId:'course-0'}}:p==='/api/courses/unlocks'?structuredClone(s.data):p==='/api/identity/sync'?{ok:true,profile:{uid:'fixture-a',displayName:'Estudiante de prueba',freeCourseId:'',profileComplete:true,profileIntakeSeen:true},membership:{active:true}}:p==='/api/learning/progress'?{ok:true,courses:{'course-6':{completedLessons:[1],courseCompleted:false}},credits:{balance:0}}:{ok:true,wallet:{balance:0},credits:{balance:0}};
  const fail=p==='/api/courses/catalog'&&s.fail;
  if(academic&&s.holdAcademic||wallet&&s.holdWallet)await new Promise(resolve=>s.held.push({path:p,release:resolve}));
  await route.fulfill({status:fail?503:200,json:fail?{error:'Fallo académico controlado'}:json,headers:{'Access-Control-Allow-Origin':'*'}});return true;
 };
 s.release=type=>{if(type==='wallet')s.holdWallet=false;else s.holdAcademic=false;const take=s.held.filter(x=>(x.path==='/api/credits/wallet')===(type==='wallet'));s.held=s.held.filter(x=>!take.includes(x));for(const x of take)x.release();};return s;
}
async function ready(p){await p.waitForFunction(()=>!document.querySelector('[data-course-sync]:not([hidden])')&&document.querySelector('#cur-list')?.getAttribute('aria-busy')!=='true');}
async function geometry(p){return p.locator('.courses-controls').evaluate(root=>{
 const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};},count=root.querySelector('.courses-results-count'),range=document.createRange();range.selectNodeContents(count);
 return {root:rect(root),count:rect(count),glyphs:Array.from(range.getClientRects(),r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})),sort:rect(root.querySelector('#cur-sort')),text:count.textContent,whiteSpace:getComputedStyle(count).whiteSpace};
});}
function contained(g,label){for(const r of [g.count,...g.glyphs])assert(r.left>=g.root.left+2&&r.right<=g.root.right-2,label+': counter text inside filter card '+JSON.stringify(g));assert(g.glyphs.every(r=>r.left>=g.count.left-1&&r.right<=g.count.right+1),label+': text fits its own row');assert(g.glyphs.every(r=>r.bottom<=g.sort.top||r.top>=g.sort.bottom||r.right<=g.sort.left||r.left>=g.sort.right),label+': counter does not overlap sorting');}
async function scenario(width){
 const s=backend(),f=await h.fixture(width,s),p=f.page;await ready(p);await p.locator('.courses-controls').scrollIntoViewIfNeeded();
 const record={width,engine:process.env.ICADEM_TEST_ENGINE||'chrome',baseline,normal:await geometry(p)};assert.equal(record.normal.text,'32 de 32 cursos');
 if(baseline){
  console.log('BASELINE '+JSON.stringify(record));
  record.overflow=record.normal.glyphs.some(r=>r.right>record.normal.count.right+1);assert(record.overflow,'baseline must reproduce actual text overflowing its allocated row, not just a narrow DOM box');
  if(OUT)await h.shot(p,'before-mobile-count-'+width,'.courses-controls');
  await p.addStyleTag({content:'.courses-results-count{font-size:20px!important;line-height:1.4!important}'});record.enlarged=await geometry(p);assert(record.enlarged.glyphs.some(r=>r.right>record.enlarged.root.right),'enlarged text reproduces overflow beyond the card');
 }else{
  contained(record.normal,'normal '+width);await h.noOverflow(p,'mobile count '+width);
  const targets=await p.locator('.courses-controls input,.courses-controls select,.courses-filter-chip').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).map(n=>({id:n.id,height:n.getBoundingClientRect().height})));for(const x of targets)assert(x.height>=43.5,'touch target '+JSON.stringify(x));
  const orders=await p.locator('#cur-sort option').evaluateAll(ns=>ns.map(n=>n.value));
  for(const order of orders){await p.locator('#cur-sort').selectOption(order);contained(await geometry(p),'sort '+order+' '+width);}
  await p.locator('#cur-sort').selectOption('proximos');const original=await h.cards(p),badges=await h.badges(p);
  await p.locator('#cur-search').fill('no matching course');await p.waitForFunction(()=>document.querySelector('.courses-results-count')?.textContent==='0 de 32 cursos');contained(await geometry(p),'zero '+width);
  await p.locator('#cur-search-clear').click();await p.locator('#cur-area').selectOption('Fiscal');contained(await geometry(p),'category '+width);await p.locator('#cur-area').selectOption('todas');await p.locator('#cur-level').selectOption('Avanzado');contained(await geometry(p),'level '+width);await p.locator('#cur-level').selectOption('todos');
  await p.locator('[data-course-filter="bloqueados"]').click();await p.locator('[data-courses-back]').click();await ready(p);assert.deepEqual(await h.cards(p),original);assert.deepEqual(await h.badges(p),badges);
  await p.locator('[data-course-filter="todos"]').scrollIntoViewIfNeeded();await p.locator('.courses-controls').scrollIntoViewIfNeeded();if(OUT)await h.shot(p,'after-mobile-count-'+width,'.courses-controls');
  // Simulate enlarged OS/browser text without disabling zoom or clipping text.
  const large=await p.addStyleTag({content:'.courses-results-count{font-size:20px!important;line-height:1.4!important}'});record.enlarged=await geometry(p);contained(record.enlarged,'200% counter text '+width);await h.noOverflow(p,'enlarged counter '+width);await large.evaluate(n=>n.remove());
  if(width===390){
   await p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await ready(p);
   const start=await p.locator('#cur-list').boundingBox(),before={...s.counts};s.holdAcademic=true;s.holdWallet=true;
   await p.evaluate(()=>{window.__countRefreshDone=false;window.__countRefresh=ICADEMPlatform.refreshCriticalData().then(()=>{window.__countRefreshDone=true;});});
   await p.waitForFunction(()=>document.querySelector('[data-course-sync]:not([hidden])')?.textContent==='Actualizando…');record.pending=await geometry(p);contained(record.pending,'academic pending');
   assert.equal(await p.locator('#cur-list').getAttribute('aria-busy'),'true');s.release('academic');await ready(p);
   assert.equal(await p.evaluate(()=>window.__countRefreshDone),false,'independent wallet read is still pending');assert(s.held.some(x=>x.path==='/api/credits/wallet'));
   const end=await p.locator('#cur-list').boundingBox();record.pendingListShift=Math.abs(start.y-end.y);assert(record.pendingListShift<=1.1,'status never shifts the catalog');
   for(const api of ['/api/courses/catalog','/api/courses/unlocks','/api/identity/sync','/api/learning/progress'])assert.equal(s.counts[api]-(before[api]||0),1,'one read '+api);
   s.release('wallet');await p.evaluate(()=>window.__countRefresh);assert.equal(await p.locator('[data-course-sync]').isVisible(),false);
   s.holdWallet=true;s.fail=true;await p.evaluate(()=>{window.__countRefresh=ICADEMPlatform.refreshCriticalData();});
   await p.waitForFunction(()=>document.querySelector('[data-course-sync]:not([hidden])')?.dataset.courseSyncPhase==='stale');contained(await geometry(p),'stale');assert.equal(await p.locator('#cur-list').getAttribute('aria-busy'),'false');s.release('wallet');await p.evaluate(()=>window.__countRefresh);s.fail=false;await p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await ready(p);
   await f.boot();assert.equal(await p.locator('#cur-sort').inputValue(),'proximos');assert.deepEqual(await h.cards(p),original);contained(await geometry(p),'reload');
  }
  assert.deepEqual(f.state.selects,[]);assert.deepEqual(f.state.puts,[]);assert.deepEqual(s.data.priorities,['course-4','course-0','course-2']);assert.equal(s.data.available,0);
 }
 records.push(record);console.log('PASS '+JSON.stringify(record));await f.context.close();
}
(async()=>{try{await h.start();for(const width of widths)await scenario(width);if(OUT){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'mobile-count-metrics.json'),JSON.stringify(records,null,2));}}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
