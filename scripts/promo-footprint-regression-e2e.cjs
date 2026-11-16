'use strict';
// Full panel + actual sizing helper; account/API responses are isolated fixtures.
// Checks node/focus/scroll preservation, width-only invalidation and clipping.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[3]),records=[];
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,async start(){await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome',args:['--disable-gpu']});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const original=fs.readFileSync(path.join(__dirname,'ambassadors-light-e2e.cjs'),'utf8');
const a=new Function('h','assert',original.slice(original.indexOf('const CONFIG='),original.indexOf('async function scenario(width)',original.indexOf('async function checkDashboard')))+'return {backend,member,setup};')(h,assert);
const baselines=(process.argv[4]||'').split(',').filter(Boolean).flatMap(f=>JSON.parse(fs.readFileSync(path.resolve(f),'utf8')).records);
async function state(p,id){return p.locator('#'+id).evaluate(n=>{const r=n.getBoundingClientRect();const clipped=[...n.querySelectorAll('h2,p,strong,small,button')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return{text:e.textContent.trim().slice(0,70),top:b.top-r.top,bottom:b.bottom-r.bottom,left:b.left-r.left,right:b.right-r.right};}).filter(e=>e.top<-.2||e.bottom>.2||e.left<-.2||e.right>.2);return{height:r.height,width:r.width,clipped,modern:n.hasAttribute('data-amb-modern'),text:n.textContent.trim()};});}
async function route(p,section){await p.evaluate(x=>navigateToSection(x),section);await p.evaluate(()=>ICADEMAmbassadorPromo.mountProfile());await p.locator(section==='inicio'?'#ambassador-home-promo':'#ambassador-profile-promo').waitFor();await p.waitForTimeout(60);}
async function run(){const s=a.backend(),f=await h.fixture(390,s),p=f.page,errors=[];p.on('pageerror',e=>{if(/ResizeObserver|footprint/.test(e.message+' '+e.stack))errors.push(e.message);});try{
 const data=a.member('free');await a.setup(f,s,data);await route(p,'perfil');
 await p.evaluate(()=>{window.__measureCount=0;const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(...args){if(this.id==='ambassador-profile-promo'&&!this.hasAttribute('data-amb-modern'))window.__measureCount++;return rect.apply(this,args);};const root=document.getElementById('ambassador-profile-promo'),b=root.querySelector('button');window.__heldRoot=root;window.__heldButton=b;window.__customHits=0;b.addEventListener('footprint-check',()=>window.__customHits++);b.focus({preventScroll:true});});
 const cache=await p.evaluate(data=>{const root=window.__heldRoot,b=window.__heldButton,before=window.__measureCount;for(let i=0;i<10;i++)ICADEMPromoFootprint.apply(root,data,'profile');b.dispatchEvent(new Event('footprint-check'));return{measurements:window.__measureCount-before,same:root.querySelector('button')===b,focused:document.activeElement===b,hits:window.__customHits};},data);
 assert.deepEqual(cache,{measurements:0,same:true,focused:true,hits:1});records.push({name:'cached-apply',...cache});
 const projection=await p.evaluate(data=>{const forbidden=()=>{throw new Error('Private data read for geometry');};for(const key of ['uid','code','summary','bank'])Object.defineProperty(data,key,{get:forbidden});Object.defineProperty(data.ambassador,'code',{get:forbidden});const before=__measureCount;ICADEMPromoFootprint.apply(__heldRoot,data,'profile');return{measurements:__measureCount-before,focused:document.activeElement===__heldButton};},data);
 assert.deepEqual(projection,{measurements:0,focused:true});records.push({name:'public-data-only',...projection});
 await p.evaluate(()=>document.fonts.dispatchEvent(new Event('loadingdone')));await p.waitForTimeout(120);
 assert(await p.evaluate(()=>document.getElementById('ambassador-profile-promo').querySelector('button')===__heldButton&&document.activeElement===__heldButton));
 const afterFonts=await p.evaluate(()=>__measureCount);assert(afterFonts>0,'font event invalidates sizing cache');await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__measureCount),afterFonts,'no observer-measurement feedback loop');records.push({name:'font-invalidation',measurements:afterFonts,nodeAndFocusPreserved:true});
 for(const width of [375,844,1024,390]){
  await p.setViewportSize({width,height:width===844?390:844});await p.waitForTimeout(120);
  const m=await state(p,'ambassador-profile-promo'),before=baselines.find(r=>r.viewport===width&&r.state==='free-active'&&r.id==='ambassador-profile-promo');
  if(before)assert(Math.abs(m.height-before.height)<.02,'matches original profile at '+width+' '+JSON.stringify({actual:m.height,expected:before.height}));
  assert.deepEqual(m.clipped,[],'profile content fits '+width+' '+JSON.stringify(m.clipped));assert(m.modern);assert(await p.evaluate(()=>document.getElementById('ambassador-profile-promo').querySelector('button')===__heldButton&&document.activeElement===__heldButton));records.push({name:'resize-profile',viewport:width,...m});
  await p.screenshot({path:path.join(OUT,'profile-'+width+'.png'),animations:'disabled'});
 }
 // Hidden route -> resize -> visible must be sized before its first visible paint.
 await route(p,'inicio');await p.setViewportSize({width:1024,height:844});await p.waitForTimeout(70);await route(p,'perfil');const visible=await state(p,'ambassador-profile-promo');const target=baselines.find(r=>r.viewport===1024&&r.state==='free-active'&&r.id==='ambassador-profile-promo');assert(target&&Math.abs(visible.height-target.height)<.02);assert.deepEqual(visible.clipped,[]);records.push({name:'hidden-route-recovery',height:visible.height});
 // Presentation does not add nodes, handlers, program requests or private data.
 assert.equal(await p.evaluate(()=>document.querySelectorAll('#ambassador-profile-promo .amb-promo-copy h2').length),1);assert(await p.locator('#ambassador-profile-promo h2').innerText().then(t=>t.includes('Comparte')));assert.deepEqual(s.mutations,[]);await p.waitForTimeout(150);assert.deepEqual(errors,[]);records.push({name:'no-observer-errors-or-mutations',errors:errors.length,mutations:s.mutations.length});
 }finally{await f.context.close();}}
(async()=>{fs.mkdirSync(OUT,{recursive:true});try{await h.start();await run();fs.writeFileSync(path.join(OUT,'regression.json'),JSON.stringify({backend:false,physicalDevices:false,records},null,2));console.log('PASS footprint '+records.length+' cases');}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
