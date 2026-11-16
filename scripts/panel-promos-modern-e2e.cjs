'use strict';
// Actual panel and components, isolated synthetic API responses. No enrollment,
// financial mutation, authenticated production session or physical-device claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const before=process.argv.includes('--before'),OUT=process.argv[3],records=[],ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,originals,async start(){await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
if(before)for(const file of ['vip-panel.html','js/icadem-ambassador-promo.js','css/icadem-ambassador-promo.css','js/icadem-vip-banner.js','css/vip-banner.css','js/icadem-ambassadors-vip.js','css/ambassadors-vip.css'])h.originals.set('/'+file,cp.execFileSync('git',['-c','safe.directory='+ROOT.replace(/\\/g,'/'),'show','83e2d4d:'+file],{cwd:ROOT,maxBuffer:8*1024*1024}));
const original=fs.readFileSync(path.join(__dirname,'ambassadors-light-e2e.cjs'),'utf8');
const a=new Function('h','assert',original.slice(original.indexOf('const CONFIG='),original.indexOf('async function scenario(width)',original.indexOf('async function checkDashboard')))+'return {backend,member,setup,contrast,sharing};')(h,assert);
async function measure(p,id){return p.locator('#'+id).evaluate(n=>{const r=n.getBoundingClientRect(),c=getComputedStyle(n),next=n.nextElementSibling,b=next?.getBoundingClientRect();const clipped=[...n.querySelectorAll('h2,p,button,.amb-promo-caption,.amb-promo-commission-card strong,.amb-modern-savings strong')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>({text:e.textContent,rect:e.getBoundingClientRect()})).filter(e=>e.rect.left<r.left-1||e.rect.right>r.right+1||e.rect.top<r.top-1||e.rect.bottom>r.bottom+1).map(e=>e.text);return{width:r.width,height:r.height,left:r.left,top:r.top+scrollY,marginTop:c.marginTop,marginBottom:c.marginBottom,nextTop:b?b.top+scrollY:null,text:n.innerText,clipped};});}
async function capture(p,id,name){await p.evaluate(()=>document.querySelectorAll('.toast,.success-toast').forEach(n=>n.remove()));await p.locator('#'+id).evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await h.shot(p,(before?'before':'after')+'-'+name,'#'+id);}
async function run(width){const s=a.backend(),f=await h.fixture(width,s),p=f.page;try{
 for(const state of ['free-active','vip-active','free-new','vip-new','free-paused']){
  const category=state.startsWith('vip')?'vip':'free';const data=a.member(category,state.endsWith('new')?{registered:false,ambassador:null}:state.endsWith('paused')?{ambassador:{active:false,code:'TES-ABCDE'}}:{});await a.setup(f,s,data);
  for(const [section,id]of [['inicio','ambassador-home-promo'],['perfil','ambassador-profile-promo']]){
   await p.evaluate(section=>navigateToSection(section),section);await p.evaluate(()=>ICADEMAmbassadorPromo.mountProfile());await p.locator('#'+id).waitFor();await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(80);
   const m=await measure(p,id);records.push({viewport:width,state,id,...m});if(!before){assert.deepEqual(m.clipped,[],state+' '+section+' '+width+' text fits');if(state.endsWith('active')){assert(m.text.includes(category==='vip'?'$150':'$100'));if(section==='perfil')for(const amount of category==='vip'?['$250','$300']:['$200','$250'])assert(m.text.includes(amount));}}if(state.endsWith('active'))await capture(p,id,state+'-'+section+'-'+width);
   await h.noOverflow(p,state+' '+section+' '+width);
   if(!before&&process.argv.includes('--actions')){
    if(section==='inicio'){await p.locator('#'+id+' .amb-promo-primary').click();if(state.endsWith('new')){await p.locator('.amb-promo-dialog').waitFor();await p.getByRole('button',{name:'Cerrar invitación',exact:true}).click();}else await p.locator('#dynamic-section [data-vip-dashboard]').waitFor();}
    else if(state.endsWith('active')){await p.locator('#'+id+' [data-amb-promo="share"]').click();await p.locator('#dynamic-section [data-amb-copy]').first().waitFor();await a.sharing(p);}
    else if(state.endsWith('new')){await p.locator('#'+id+' [data-amb-promo="info"]').first().click();await p.locator('.amb-promo-dialog').waitFor();for(const amount of category==='vip'?['$150','$250','$300']:['$100','$200','$250'])assert((await p.locator('.amb-promo-dialog').innerText()).includes(amount));await p.locator('[data-amb-continue]').click();await p.locator('#dynamic-section [data-amb-enroll]').waitFor();}
    else{await p.locator('#'+id+' [data-amb-promo="panel"]').click();await p.locator('#dynamic-section [data-vip-dashboard]').waitFor();}
   }
  }
 }
 assert.deepEqual(s.mutations,[]);await f.context.close();console.log('PROMOS '+(before?'BEFORE':'AFTER')+' '+width);
}catch(e){await p.screenshot({path:path.join(OUT,'failure-'+width+'.png'),fullPage:true});throw e;}finally{await f.context.close();}}
(async()=>{try{fs.mkdirSync(OUT,{recursive:true});await h.start();for(const width of (process.env.ICADEM_PRIORITY_WIDTHS||'320,390,768,1440').split(',').map(Number))await run(width);fs.writeFileSync(path.join(OUT,before?'before.json':'after.json'),JSON.stringify({before,backend:false,physicalDevices:false,records},null,2));}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
