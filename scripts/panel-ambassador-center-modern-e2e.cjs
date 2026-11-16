'use strict';
// Existing panel and production modules, isolated synthetic API responses.
// No authentication, enrollment, external messages, bank or financial writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const before=process.env.ICADEM_CENTER_BEFORE==='1',OUT=process.argv[3],records=[];
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const original=fs.readFileSync(path.join(__dirname,'ambassadors-light-e2e.cjs'),'utf8');
const a=new Function('h','assert',original.slice(original.indexOf('const CONFIG='),original.indexOf('async function scenario(width)',original.indexOf('async function checkDashboard')))+'return {backend,member,setup,contrast};')(h,assert);
async function inspect(p,width,category,state){
 await p.evaluate(()=>document.querySelectorAll('.toast,.success-toast').forEach(n=>n.remove()));
 const node=p.locator('.av-hero');await node.waitFor();await node.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await p.waitForTimeout(180);
 const r=await node.evaluate(n=>{const box=n.getBoundingClientRect(),after=document.querySelector('.av-kpis').getBoundingClientRect();return{box:{x:box.x,y:box.y,width:box.width,height:box.height},after:{x:after.x,y:after.y,width:after.width},scroll:n.scrollWidth,client:n.clientWidth,zones:n.querySelectorAll(':scope>.av-center-zone').length,controls:[...n.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{text:b.textContent.trim(),height:r.height,width:r.width};}),text:n.textContent};});
 await h.noOverflow(p,'center '+width);assert(r.scroll<=r.client+1,'center internal overflow '+JSON.stringify(r));assert(r.box.width<=width);r.controls.forEach(c=>assert(c.height>=44&&c.width>=44,'touch control '+JSON.stringify(c)));assert(r.after.y>=r.box.y+r.box.height,'summary must follow hero');
 for(const amount of category==='vip'?['$150','$250','$300']:['$100','$200','$250'])assert(r.text.includes(amount),category+' server amount '+amount);
 if(!before){assert.equal(r.zones,3);await a.contrast(node,'center '+category+' '+width);assert(await p.locator('.av-center-title').textContent().then(t=>t.includes('Centro de')));assert.equal(await node.locator('.av-code-actions [data-amb-copy]').count(),2);assert.equal(await node.locator('[data-amb-share]').count(),1);}
 await h.shot(p,(before?'before':'after')+'-center-'+category+'-'+width,'.av-hero');
 records.push({mode:before?'before':'after',engine:process.env.ICADEM_TEST_ENGINE||'chrome',width,category,state,...r});
}
async function run(width){const s=a.backend(),f=await h.fixture(width,s),p=f.page;
 try{for(const category of ['free','vip']){
  await a.setup(f,s,a.member(category));await inspect(p,width,category,'active');
  if(!before&&width===390){
   const buttons=p.locator('.av-hero .av-code-actions [data-amb-copy]');for(let i=0;i<2;i++){await buttons.nth(i).click();assert((await p.evaluate(()=>__testClipboard.at(-1))).includes(i?'https://':'TES-ABCDE'));}
   await p.locator('.av-hero [data-amb-share]').click();assert(await p.evaluate(()=>document.querySelector('[data-amb-sharing]').contains(document.activeElement)),'header opens the existing sharing section');await p.locator('[data-amb-social="native"]').click();await p.waitForFunction(()=>window.__testShares?.length||window.__testOpens?.length);assert((await p.evaluate(()=>JSON.stringify({shares:__testShares,opens:__testOpens}))).includes('TES-ABCDE'));
   await p.locator('[data-amb-presentation]').click();assert(!(await p.locator('.av-hero').textContent()).includes('Persona de prueba protegida'));
   await p.locator('[data-amb-presentation]').click();
   s.member={...s.member,ambassador:{...s.member.ambassador,active:false}};await p.locator('[data-amb-refresh]').click();await p.waitForFunction(()=>document.querySelector('.av-hero')?.textContent.includes('Perfil de embajador en pausa'));assert.equal(await p.locator('.av-hero [data-amb-copy]').count(),2);
   s.member={...a.member(category),benefits:{directCommissionCents:17500,monthlyDiscountCents:27500,annualDiscountCents:32500}};await p.locator('[data-amb-refresh]').click();await p.waitForFunction(()=>document.querySelector('.av-hero')?.textContent.includes('$175'));for(const value of ['$175','$275','$325'])assert((await p.locator('.av-hero').textContent()).includes(value));
  }
 }assert.deepEqual(s.mutations,[],'visual tests cannot write finances');assert.deepEqual(f.state.selects,[]);console.log('PASS center '+width+' '+(before?'before':'after'));}finally{await f.context.close();}}
(async()=>{try{await h.start();for(const width of (process.env.ICADEM_PRIORITY_WIDTHS||'320,390,768,1440').split(',').map(Number))await run(width);if(OUT){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'center-'+(before?'before':'after')+'-metrics.json'),JSON.stringify({backend:false,physicalDevices:false,records},null,2));}}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
