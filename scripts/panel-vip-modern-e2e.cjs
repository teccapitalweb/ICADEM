'use strict';
// Full panel, isolated account/API fixtures. No production request or write.
// Records original geometry before the visual change, then compares every slide.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome',args:['--disable-gpu']});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const OUT=path.resolve(process.argv[3]),MODE=process.argv[4]||'after',engine=process.env.ICADEM_TEST_ENGINE||'chrome';
const all=[];
async function measure(page){return page.evaluate(()=>{const rect=n=>{if(!n||!n.getClientRects().length)return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};},banner=document.getElementById('fomo-banner'),nodes=[...banner.querySelectorAll('strong,#fomo-banner-text > span,#fomo-banner-cta,#fomo-banner-motion')].filter(n=>n.getClientRects().length);return {banner:rect(banner),next:rect(document.querySelector('.app')||document.querySelector('.main')),main:rect(document.querySelector('.main')),cta:rect(document.getElementById('fomo-banner-cta')),pause:rect(document.getElementById('fomo-banner-motion')),title:document.querySelector('#fomo-banner-text strong').textContent,overflow:nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>({id:n.id,tag:n.tagName,scroll:n.scrollWidth,client:n.clientWidth})),documentWidth:document.documentElement.scrollWidth,viewport:innerWidth};});}
async function scenario(width){const f=await h.fixture(width),p=f.page;try{
 await p.evaluate(()=>{window.__vipTicks=[];const real=window.setInterval;window.setInterval=(fn,ms,...args)=>{if(ms===7000)window.__vipTicks.push(fn);return real(fn,ms,...args);};Object.assign(UserState,{modo:'sin-membresia'});window.__applyUserState?.();document.getElementById('fomo-banner').style.display='';document.body.classList.add('has-fomo');IcademVipBanner.update('sin-membresia');});
 await p.locator('#fomo-banner').waitFor({state:'visible'});
 const slides=[];
 for(let n=0;n<3;n++){await p.waitForTimeout(950);const m=await measure(p);assert(m.documentWidth<=m.viewport,'no horizontal page overflow');assert.deepEqual(m.overflow,[],'slide copy fits');slides.push(m);await p.locator('#fomo-banner').screenshot({path:path.join(OUT,`${MODE}-${engine}-${width}-slide-${n+1}.png`)});if(n<2)await p.evaluate(()=>window.__vipTicks.at(-1)());}
 // Pause/resume is an actual user action, and changes its accessible state.
 const motion=p.locator('#fomo-banner-motion');await motion.click();assert.equal(await motion.getAttribute('aria-pressed'),'true');await motion.click();assert.equal(await motion.getAttribute('aria-pressed'),'false');
 await motion.focus();await p.keyboard.press('Space');assert.equal(await motion.getAttribute('aria-pressed'),'true');assert.equal(await motion.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');await p.keyboard.press('Space');assert.equal(await motion.getAttribute('aria-pressed'),'false');
 await p.emulateMedia({reducedMotion:'reduce'});await motion.waitFor({state:'hidden'});assert.equal(await motion.isVisible(),false);await p.emulateMedia({reducedMotion:'no-preference'});
 if(MODE==='after'){const before=JSON.parse(fs.readFileSync(path.join(OUT,`before-${engine}-${width}.json`),'utf8')),placement=r=>r&&({x:r.x,y:r.y,width:r.width});for(let i=0;i<3;i++){assert.deepEqual(slides[i].banner,before.slides[i].banner,'outer ribbon geometry unchanged');assert.deepEqual(placement(slides[i].main),placement(before.slides[i].main),'next panel starts at the exact same position');}assert.deepEqual(slides[0].banner,slides[1].banner,'rotation cannot change size');assert.deepEqual(slides[1].banner,slides[2].banner,'rotation cannot change size');}
 if(MODE==='after'){
  await p.locator('#fomo-banner-cta').click();await p.waitForFunction(()=>location.hash==='#suscripcion');
  await p.evaluate(()=>{UserState.modo='vip';window.__applyUserState();});assert.equal(await p.locator('#fomo-banner').isVisible(),false,'VIP visibility remains owned by the real panel');
  await p.evaluate(()=>{UserState.modo='invitado';window.__applyUserState();});await p.locator('#fomo-banner').waitFor({state:'visible'});assert.equal(await p.locator('#fomo-banner-timer').isVisible(),true,'demo countdown stays visible');
  await p.locator('#fomo-banner-cta').click();await p.waitForURL(/vip-auth\.html\?plan=/);
 }
 const record={width,engine,mode:MODE,slides,production:false,physicalDevice:false,controls:{rotation:true,pause:true,keyboard:true,reducedMotion:true,freeCta:MODE==='after',vipHidden:MODE==='after',demoCountdownAndCta:MODE==='after'}};fs.writeFileSync(path.join(OUT,`${MODE}-${engine}-${width}.json`),JSON.stringify(record,null,2));all.push(record);console.log('PASS VIP STRIP '+MODE+' '+engine+' '+width);
}finally{await f.context.close();}}
(async()=>{fs.mkdirSync(OUT,{recursive:true});try{await h.start();for(const width of [320,390,768,1440])await scenario(width);fs.writeFileSync(path.join(OUT,`${MODE}-${engine}-results.json`),JSON.stringify(all,null,2));}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
