'use strict';
// Full panel, router and academic refresh cycle. Every API is intercepted;
// no student account, academic right or production data is mutated.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=process.argv[3],BASELINE=process.env.ICADEM_NAV_BASELINE==='1';
let source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
source=source.replace("if(api==='/api/courses/unlocks'){","if(shared.control && await shared.control(route,url,state))return;\n    if(api==='/api/courses/unlocks'){");
const bootWait="await page.waitForFunction(()=>!document.querySelector('[data-course-sync]:not([hidden])')&&document.getElementById('cur-list')?.getAttribute('aria-busy')!=='true');";
source=source.replace(bootWait,`try{${bootWait}}catch(error){console.error('BOOT DIAGNOSTIC',JSON.stringify({counts:shared.counts,dom:await page.evaluate(()=>({url:location.href,visibility:document.visibilityState,online:navigator.onLine,uid:window.__auth?.currentUser?.uid,ending:window.__sessionEnding,cards:document.querySelectorAll('.curso-card').length,status:Array.from(document.querySelectorAll('[data-course-sync]')).map(n=>({text:n.textContent,hidden:n.hidden,phase:n.dataset.courseSyncPhase,title:n.title})),busy:document.getElementById('cur-list')?.getAttribute('aria-busy')}))}));if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await page.screenshot({path:path.join(SHOTS,'boot-error-'+width+'.png')});}throw error;}`);
if(BASELINE)source=source.replace('const types=',`for(const file of ['vip-panel.html','js/icadem-platform-v2.js','js/icadem-course-sync.js','js/icadem-course-unlocks.js','css/icadem-courses.css'])originals.set('/'+file,cp.execFileSync('git',['-c','safe.directory='+ROOT.replace(/\\\\/g,'/'),'show','38482b4:'+file],{cwd:ROOT,maxBuffer:8*1024*1024}));\nconst types=`);
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,catalog,cards,badges,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const widths=(process.env.ICADEM_PRIORITY_WIDTHS||'320,390,768,1440').split(',').map(Number),records=[];
const cors={'Access-Control-Allow-Origin':'*'};
function backend(){
 const s={uid:'fixture-a',identityRevision:0,data:{...h.initial(),priorities:['course-4','course-0','course-2']},catalog:structuredClone(h.catalog),progress:{'course-6':{completedLessons:[1],courseCompleted:false}},counts:{},hold:false,held:[],catalogFail:false};
 s.control=async(route,url)=>{
   const p=url.pathname;if(!['/api/courses/catalog','/api/courses/unlocks','/api/identity/sync','/api/learning/progress'].includes(p))return false;
   s.counts[p]=(s.counts[p]||0)+1;
   let json=p==='/api/courses/catalog'?{ok:true,courses:structuredClone(s.catalog),viewer:{defaultPreviewCourseId:'course-0'}}:p==='/api/courses/unlocks'?structuredClone(s.data):p==='/api/learning/progress'?{ok:true,courses:structuredClone(s.progress),credits:{balance:0}}:{ok:true,profile:{uid:s.uid,displayName:'Estudiante de prueba'+(s.identityRevision?' '+s.identityRevision:''),freeCourseId:'',profileComplete:true,profileIntakeSeen:true},membership:{active:true}};
   const fail=p==='/api/courses/catalog'&&s.catalogFail;
   if(s.hold){await new Promise(resolve=>s.held.push({path:p,release:resolve}));}
   await route.fulfill({status:fail?503:200,json:fail?{error:'Fallo controlado de catálogo'}:json,headers:cors});return true;
 };
 s.release=()=>{s.hold=false;for(const entry of s.held.splice(0))entry.release();};return s;
}
async function settled(p){await p.waitForFunction(()=>!document.querySelector('[data-course-sync]:not([hidden])')&&!document.querySelector('.courses-skeleton')&&document.querySelector('#cur-list')?.getAttribute('aria-busy')!=='true');await p.waitForTimeout(100);}
async function startProbe(p){
 await p.evaluate(()=>{
   window.__stableCourseProbe?.observer?.disconnect();
   const root=document.querySelector('[data-course-view]'),list=document.getElementById('cur-list'),refs=Array.from(list.querySelectorAll('.curso-card'));
   const sample=()=>{if(!root.isConnected||!list.isConnected)return null;const r=root.getBoundingClientRect(),grid=list.getBoundingClientRect(),first=list.querySelector('.curso-card')?.getBoundingClientRect();return {y:grid.top-r.top,height:grid.height,first:first?{x:first.left-r.left,y:first.top-r.top,width:first.width,height:first.height}:null,count:list.querySelectorAll('.curso-card').length,pendingVisible:!!document.querySelector('[data-course-sync]:not([hidden])')};};
   const probe=window.__stableCourseProbe={refs,markup:list.__courseMarkup,frames:[sample()],removedCards:0,replacedShell:false,active:true};
   probe.observer=new MutationObserver(ms=>{for(const m of ms)for(const n of m.removedNodes)if(n.nodeType===1)probe.removedCards+=(n.matches?.('.curso-card')?1:n.querySelectorAll?.('.curso-card')?.length||0);});
   probe.observer.observe(list,{childList:true,subtree:true});
   const frame=()=>{if(!probe.active)return;const next=sample();if(next)probe.frames.push(next);else probe.replacedShell=true;requestAnimationFrame(frame);};requestAnimationFrame(frame);
 });
}
async function stopProbe(p){return p.evaluate(()=>{const v=window.__stableCourseProbe;v.active=false;v.observer.disconnect();const before=String(v.markup||''),after=String(document.getElementById('cur-list')?.__courseMarkup||'');let at=0;while(at<Math.min(before.length,after.length)&&before[at]===after[at])at++;const markupDiff=before===after?null:{at,before:before.slice(Math.max(0,at-100),at+200),after:after.slice(Math.max(0,at-100),at+200)};return {frames:v.frames,removedCards:v.removedCards,replacedShell:v.replacedShell,markupDiff,sameNodes:v.refs.every(n=>n.isConnected&&n===document.querySelector('.curso-card[data-cid="'+CSS.escape(n.dataset.cid)+'"]'))};});}
function span(samples,key){const ns=samples.map(s=>key(s)).filter(Number.isFinite);return ns.length?Math.max(...ns)-Math.min(...ns):Infinity;}
async function cycle(f,s,slow){
 const p=f.page;await p.evaluate(()=>navigateToSection('inicio'));await p.waitForSelector('#inicio-content');
 const before={...s.counts};s.hold=slow;
 await p.evaluate(()=>navigateToSection('cursos'));await p.waitForSelector('#cur-list .curso-card');await startProbe(p);
 if(slow){await p.waitForFunction(()=>document.querySelector('[data-course-sync]:not([hidden])'));if(!BASELINE)assert.equal(await p.locator('#cur-list').getAttribute('aria-busy'),'true','the cached view is explicitly being revalidated');await p.waitForTimeout(120);if(OUT)await h.shot(p,(BASELINE?'before':'after')+'-pending-'+f.width);s.release();}
 await settled(p);const result=await stopProbe(p),counts=Object.fromEntries(Object.entries(s.counts).map(([k,v])=>[k,v-(before[k]||0)]));
 const geometry={listShift:span(result.frames,x=>x.y),cardShift:span(result.frames,x=>x.first?.y),cardHeightShift:span(result.frames,x=>x.first?.height),listHeightShift:span(result.frames,x=>x.height)};
 const pendingVisibleFrames=result.frames.filter(n=>n.pendingVisible).length;
 if(!BASELINE){for(const [key,value]of Object.entries(geometry))assert(value<=1.1,key+' during '+(slow?'slow':'fast')+' refresh '+f.width+': '+value);assert.equal(result.removedCards,0,'unchanged confirmation must not replace card nodes');assert.equal(result.sameNodes,true,'same cards remain mounted through refresh');assert.equal(result.replacedShell,false,'same course shell remains mounted');assert.equal(counts['/api/courses/catalog'],1,'one catalog request per navigation refresh');assert.equal(counts['/api/courses/unlocks'],1,'mount joins the same unlock refresh');if(!slow)assert.equal(pendingVisibleFrames,0,'fast refresh never flashes a loading label');else assert(pendingVisibleFrames>0,'slow refresh shows a non-definitive status');}
 assert.equal(await p.locator('#cur-area').inputValue(),'Fiscal');assert.equal(await p.locator('#cur-sort').inputValue(),'prioridades');assert.equal(await p.locator('#cur-search').inputValue(),'profesionales');assert.deepEqual(await h.cards(p),['course-4']);
 return {slow,...geometry,pendingVisibleFrames,removedCards:result.removedCards,sameNodes:result.sameNodes,replacedShell:result.replacedShell,requests:counts};
}
async function scenario(width){
 const s=backend(),f=await h.fixture(width,s);f.width=width;const p=f.page;await settled(p);
 // Warm canonical progress and identity before measuring navigation, so a real
 // data change is not confused with unnecessary redraws of identical data.
 await p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await settled(p);
 await p.locator('#cur-sort').selectOption('prioridades');await p.locator('#cur-area').selectOption('Fiscal');await p.locator('#cur-search').fill('profesionales');await p.waitForTimeout(120);
 const cycles=[];for(const slow of [false,true,false,true])cycles.push(await cycle(f,s,slow));
 let rapidReturn=null;
 if(BASELINE){assert(cycles.some(c=>c.listShift>1.1||c.removedCards>0||c.replacedShell),'baseline must reproduce the reported layout/redraw regression');}
 else{
   await h.noOverflow(p,'stable course navigation '+width);
   if(width===390){
     // Return while the previous refresh is still in flight. This exercises
     // cached summary paint whose priority hint awaits that same catalog read.
     const countsBefore={...s.counts};s.hold=true;const flight=p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await p.waitForFunction(()=>document.querySelector('#cur-list')?.getAttribute('aria-busy')==='true');
     for(let n=0;n<100&&!s.held.some(x=>x.path==='/api/courses/catalog');n++)await p.waitForTimeout(10);assert(s.held.some(x=>x.path==='/api/courses/catalog'));
     await p.evaluate(()=>navigateToSection('inicio'));await p.evaluate(()=>navigateToSection('cursos'));await p.waitForSelector('#cur-list .curso-card');await startProbe(p);
     const before=await p.locator('.course-unlocks').boundingBox(),hintHidden=await p.locator('[data-unlock-priority]').getAttribute('hidden');await p.waitForTimeout(240);if(OUT)await h.shot(p,'after-rapid-return-pending-'+width);s.release();await flight;await settled(p);
     const probe=await stopProbe(p),after=await p.locator('.course-unlocks').boundingBox();rapidReturn={listShift:span(probe.frames,x=>x.y),cardShift:span(probe.frames,x=>x.first?.y),headerHeightBefore:before.height,headerHeightAfter:after.height,initialHintHidden:hintHidden!==null,removedCards:probe.removedCards,catalogRequests:(s.counts['/api/courses/catalog']||0)-(countsBefore['/api/courses/catalog']||0),unlockRequests:(s.counts['/api/courses/unlocks']||0)-(countsBefore['/api/courses/unlocks']||0)};
     console.log('RAPID RETURN '+JSON.stringify(rapidReturn));assert(rapidReturn.listShift<=1.1&&rapidReturn.cardShift<=1.1,'a rapid return during an in-flight read does not shift cards');assert.equal(rapidReturn.catalogRequests,1);assert.equal(rapidReturn.unlockRequests,1);assert.equal(probe.sameNodes,true);assert.equal(probe.removedCards,0);
   }
   if(width===390){
     // A same-account identity update can overlap the catalog refresh. It may
     // refresh personal text, but must join that catalog request and keep cards.
     s.identityRevision++;s.hold=true;const before=s.counts['/api/courses/catalog']||0;await startProbe(p);const identity=p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await p.waitForFunction(()=>document.querySelector('[data-course-sync]:not([hidden])'));s.release();await identity;await settled(p);const probe=await stopProbe(p);assert.equal((s.counts['/api/courses/catalog']||0)-before,1,'overlapping identity/catalog refresh shares one GET');if(!probe.sameNodes)console.error('IDENTITY PROBE',JSON.stringify({removedCards:probe.removedCards,replacedShell:probe.replacedShell,markupDiff:probe.markupDiff}));assert.equal(probe.sameNodes,true,'personal identity update does not replace course cards');assert.equal(probe.removedCards,0);
     // A confirmed operation is different from passive revalidation: a read
     // already in flight may predate the write and cannot satisfy its reload.
     const saved=structuredClone(s.catalog),reads=s.counts['/api/courses/catalog']||0;s.hold=true;const previous=p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await p.waitForFunction(()=>document.querySelector('[data-course-sync]:not([hidden])'));assert(s.held.some(x=>x.path==='/api/courses/catalog'));s.catalog=s.catalog.map(c=>c.id==='course-0'?{...c,access:{...c.access,unlocked:true}}:c);const afterWrite=p.evaluate(()=>__reloadCourseCatalog().then(()=>true));await p.waitForTimeout(20);s.release();await Promise.all([previous,afterWrite]);const confirmed=await p.evaluate(async()=>{const rows=await __getCourseUnlockCatalog();return rows.find(c=>c.id==='course-0')?.access?.unlocked;});assert.equal(confirmed,true,'post-write reload reads the new canonical rights');assert.equal((s.counts['/api/courses/catalog']||0)-reads,2,'a post-write reload gets one new response after the pre-write read');s.catalog=saved;await p.evaluate(()=>__reloadCourseCatalog());
   }
   // A failed revalidation retains the catalog geometry but labels it as old.
   await startProbe(p);s.catalogFail=true;await p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await p.waitForFunction(()=>document.querySelector('[data-course-sync]')?.textContent.includes('última información'));
   const stale=await stopProbe(p);assert(span(stale.frames,x=>x.y)<=1.1,'stale warning does not displace the catalog');assert.equal(stale.sameNodes,true);assert.equal(stale.removedCards,0);assert.equal(await p.locator('[data-course-sync]').isVisible(),true);s.catalogFail=false;await p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await settled(p);
   // A slow old response can finish in Inicio, but may not render a course view there.
   s.hold=true;const late=p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await p.waitForFunction(()=>document.querySelector('[data-course-sync]:not([hidden])'));await p.evaluate(()=>navigateToSection('inicio'));s.release();await late;assert.equal(new URL(p.url()).hash,'#inicio');assert.equal(await p.locator('[data-course-view]').isVisible(),false,'late refresh cannot reveal the hidden course section over Inicio');
   await p.evaluate(()=>navigateToSection('cursos'));await settled(p);assert.equal(await p.locator('#cur-search').inputValue(),'profesionales');
   // An actual access change is applied after confirmation, not masked by a
   // presentation cache; the background refresh is visibly non-definitive.
   await p.locator('#cur-search-clear').click();await p.locator('#cur-area').selectOption('todas');assert.match(await p.locator('[data-cid="course-1"] [data-course-details]').innerText(),/Iniciar/);
   s.catalog=s.catalog.map(c=>c.id==='course-1'?{...c,access:{...c.access,unlocked:false},sesiones:c.sesiones.map(x=>({...x,accessible:false}))}:c);s.hold=true;const revoke=p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await p.waitForFunction(()=>document.querySelector('[data-course-sync]:not([hidden])'));assert.match(await p.locator('[data-course-sync]').innerText(),/Actualizando/);s.release();await revoke;await settled(p);assert.match(await p.locator('[data-cid="course-1"] [data-course-details]').innerText(),/Ver detalles/);
   // No academic mutation is introduced by navigation, filtering or refresh.
   assert.deepEqual(f.state.selects,[]);assert.deepEqual(f.state.puts,[]);assert.deepEqual(s.data.selectedCourseIds,['course-1','course-6']);assert.deepEqual(s.data.priorities,['course-4','course-0','course-2']);
   if(OUT){await p.locator('[data-course-view]').evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'}));await h.shot(p,'after-ready-'+width);}
   if(width===390){
     // Let the previous account's requests finish after replacing its session.
     s.hold=true;const old=p.evaluate(()=>ICADEMPlatform.refreshCriticalData());await p.waitForFunction(()=>document.querySelector('[data-course-sync]:not([hidden])'));s.uid='fixture-b';s.data={...h.initial(),selectedCourseIds:[],priorities:[],eligibleCourseIds:[]};s.catalog=structuredClone(h.catalog.filter(c=>c.id==='course-3'));s.progress={};
     await p.evaluate(()=>{document.dispatchEvent(new Event('icadem:session-ending'));window.__currentUser={uid:'fixture-b',getIdToken:()=>Promise.resolve('browser-fixture-only-b')};window.__auth.currentUser=window.__currentUser;Object.assign(UserState,{uid:'fixture-b',modo:'vip'});document.dispatchEvent(new CustomEvent('icadem:user-ready',{detail:{uid:'fixture-b'}}));navigateToSection('cursos');});
     s.release();await old;await p.waitForFunction(()=>document.querySelectorAll('.curso-card').length===1&&document.querySelector('.curso-card[data-cid="course-3"]'));await settled(p);assert.deepEqual(await h.cards(p),['course-3']);assert.deepEqual(await h.badges(p),{});assert.equal(await p.locator('[data-unlock-priority]:visible').count(),0,'late old-account priorities are never restored');
   }
 }
 records.push({width,engine:process.env.ICADEM_TEST_ENGINE||'chrome',baseline:BASELINE,cycles,rapidReturn});console.log('PASS stable navigation '+width+' '+(process.env.ICADEM_TEST_ENGINE||'chrome')+' '+JSON.stringify(cycles));await f.context.close();
}
(async()=>{try{await h.start();for(const width of widths)await scenario(width);if(OUT){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'navigation-metrics.json'),JSON.stringify(records,null,2));}}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
