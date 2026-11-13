'use strict';
// Real panel, isolated API responses. No enrollment, messages or financial writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const baseline=process.env.ICADEM_YELLOW_BASELINE==='1',results=[],OUT=process.argv[3];
let source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
if(baseline)source=source.replace('const types=',`for(const file of ['css/ambassadors-vip.css','css/icadem-ambassador-promo.css'])originals.set('/'+file,cp.execFileSync('git',['-c','safe.directory='+ROOT.split(path.sep).join('/'),'show','38482b4:'+file],{cwd:ROOT,maxBuffer:8*1024*1024}));\nconst types=`);
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const original=fs.readFileSync(path.join(__dirname,'ambassadors-light-e2e.cjs'),'utf8');
const a=new Function('h','assert',original.slice(original.indexOf('const CONFIG='),original.indexOf('async function scenario(width)',original.indexOf('async function checkDashboard')))+'return {backend,member,setup,contrast,sharing};')(h,assert);
async function check(p,selector,label){const node=p.locator(selector);await node.waitFor({state:'visible'});const m=await node.evaluate(n=>{const c=getComputedStyle(n),r=n.getBoundingClientRect();return{height:r.height,width:r.width,background:c.backgroundColor,backgroundImage:c.backgroundImage};});
 if(!baseline){assert.equal(m.background,'rgb(246, 196, 69)',label+' uses the former yellow');await a.contrast(node,label);await h.noOverflow(p,label);}
 return m;
}
async function shot(p,name,selector){await p.evaluate(()=>document.querySelectorAll('.toast,.success-toast').forEach(n=>n.remove()));await p.locator(selector).evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await h.shot(p,name,selector);}
async function scenario(width){const s=a.backend(),f=await h.fixture(width,s),p=f.page,record={width,engine:process.env.ICADEM_TEST_ENGINE||'chrome',baseline};
 await a.setup(f,s,a.member('vip'));record.vip=await check(p,'.av-hero','VIP hero');const text=await p.locator('.av-hero').innerText();for(const value of ['$150','$250','$300','TES-ABCDE','Perfil de embajador activo','Membresía VIP vigente'])assert(text.includes(value),'retains '+value);
 if(!baseline){assert.equal(await p.locator('.av-code-card [data-amb-copy]').count(),2);assert.equal(await p.locator('.av-code-card [data-amb-share]').count(),1);const rects=await p.locator('.av-code-card button').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));rects.forEach(height=>assert(height>=44,'44px code actions'));}
 await shot(p,'vip-hero-'+width,'.av-hero');
 if(!baseline&&width===390)await a.sharing(p);
 await p.evaluate(()=>navigateToSection('inicio'));await p.evaluate(()=>ICADEMAmbassadorPromo.mountProfile());record.home=await check(p,'#ambassador-home-promo','home promo');await shot(p,'home-promo-'+width,'#ambassador-home-promo');
 await p.evaluate(()=>navigateToSection('perfil'));await p.evaluate(()=>ICADEMAmbassadorPromo.mountProfile());record.profile=await check(p,'#ambassador-profile-promo','profile promo');await shot(p,'profile-promo-'+width,'#ambassador-profile-promo');
 if(!baseline){
   assert.match(await p.locator('#ambassador-profile-promo').innerText(),/\$150/);await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>document.documentElement.dataset.theme='night');await check(p,'#ambassador-profile-promo','night profile');await p.evaluate(()=>navigateToSection('inicio'));await p.evaluate(()=>ICADEMAmbassadorPromo.mountProfile());await check(p,'#ambassador-home-promo','night home');await a.setup(f,s,a.member('vip'));await check(p,'.av-hero','night VIP');if(width===390)await shot(p,'vip-night-'+width,'.av-hero');
   await p.evaluate(()=>document.documentElement.dataset.theme='day');await a.setup(f,s,a.member('free'));record.free=await check(p,'.av-hero','free hero');for(const value of ['$100','$200','$250'])assert((await p.locator('.av-hero').innerText()).includes(value));
   await p.evaluate(()=>navigateToSection('perfil'));await p.evaluate(()=>ICADEMAmbassadorPromo.mountProfile());await check(p,'#ambassador-profile-promo','free profile');assert.match(await p.locator('#ambassador-profile-promo').innerText(),/\$100/);assert.deepEqual(s.mutations,[],'no financial or enrollment operations');assert.deepEqual(f.state.selects,[]);
 }
 results.push(record);console.log('PASS '+JSON.stringify(record));await f.context.close();
}
(async()=>{try{await h.start();for(const width of (process.env.ICADEM_PRIORITY_WIDTHS||'320,390,768,1440').split(',').map(Number))await scenario(width);if(OUT){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'metrics.json'),JSON.stringify(results,null,2));}}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
