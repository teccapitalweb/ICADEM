'use strict';
// Production UI, synthetic notices, isolated browser contexts; all remote traffic intercepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
function server(){
 const shared={data:h.initial(),items:[],preferences:{forumActivity:true,forumNews:false},writes:[],reads:0,fail:false,hold:false,release:null};
 shared.add=(id,extra={})=>{const at=Date.now()-1000;shared.items.unshift({id:'personal-'+id,serverId:id,source:'personal',personal:true,tipo:'connection_request',titulo:'Nueva solicitud de conexión',descripcion:'Un profesional quiere conectar contigo.',icono:'i-users',color:'#0B2F73',createdAtMs:at,expiresAtMs:at+15*86400000,read:false,seen:false,target:{section:'directorio',view:'requests',profileUid:'colleague'},...extra});};
 shared.handle=async(route,url)=>{
  const p=url.pathname,req=route.request(),headers={'Access-Control-Allow-Origin':'*'};
  if(p==='/api/notifications'){
   shared.reads++;if(shared.fail){await route.fulfill({status:503,json:{error:'No disponible'},headers});return true;}
   await route.fulfill({json:{ok:true,items:shared.items,preferences:shared.preferences,forumAvailable:true,serverNowMs:Date.now(),retentionDays:15},headers});return true;
  }
  if(p.startsWith('/api/notifications/')){
   const body=req.postDataJSON();shared.writes.push({path:p,body});
   if(shared.hold)await new Promise(resolve=>shared.release=resolve);
   if(shared.fail){await route.fulfill({status:503,json:{error:'No confirmado'},headers});return true;}
   if(p.endsWith('/preferences'))Object.assign(shared.preferences,body);
   else for(const item of body.items){const n=shared.items.find(n=>n.source===item.source&&n.serverId===item.id);if(!n)continue;
    if(p.endsWith('/dismiss'))shared.items=shared.items.filter(x=>x!==n);
    else if(p.endsWith('/seen'))n.seen=true;else{n.read=true;n.seen=true;}}
   await route.fulfill({json:{ok:true,preferences:shared.preferences},headers});return true;
  }
  if(p.startsWith('/api/community/connections')){await route.fulfill({json:{ok:true,received:[],sent:[],connected:[],canRequest:true},headers});return true;}
  if(p==='/api/forum/posts/forum-post'){
   await route.fulfill(shared.missingPost?{status:404,json:{error:'Esta publicación ya no está disponible o expiró.'},headers}:{json:{ok:true,post:{id:'forum-post',uid:'colleague',nombre:'Profesional de prueba',texto:'Publicación específica de prueba',createdAtMs:Date.now()-1000,likedBy:{},likes:1,comentariosCount:0}},headers});return true;
  }
  return false;
 };return shared;
}
const count=page=>page.locator('#btn-notif .notif-count');
async function start(f){await f.page.evaluate(()=>ICADEMNotifications.start());await f.page.waitForFunction(()=>__notifsState.loaded&&!__notifsState.error);}
async function sync(f){const before=f.state.shared.reads;await f.page.evaluate(()=>ICADEMNotifications.sync());for(let i=0;i<100&&f.state.shared.reads<=before;i++)await f.page.waitForTimeout(20);assert(f.state.shared.reads>before);const expected=f.state.shared.items.map(n=>[n.id,n.seen,n.read]).sort();await f.page.waitForFunction(expected=>JSON.stringify(ICADEMNotifications.visibleItems().map(n=>[n.id,n.seen,n.read]).sort())===JSON.stringify(expected),expected);}
async function scenario(width){
 const s=server(),f=await h.fixture(width,s),p=f.page;await start(f);
 assert.equal(await count(p).isVisible(),false);s.add('one');await sync(f);await count(p).waitFor({state:'visible'});assert.equal(await count(p).innerText(),'1');
 const buttonBefore=await p.locator('#btn-notif').boundingBox();s.add('two');s.add('three');await sync(f);assert.equal(await count(p).innerText(),'3');assert.deepEqual(await p.locator('#btn-notif').boundingBox(),buttonBefore);
 const badge=await count(p).boundingBox(),button=await p.locator('#btn-notif').boundingBox();assert(badge.x>=button.x&&badge.y>=button.y&&badge.x+badge.width<=button.x+button.width+1);assert.equal(await p.locator('#btn-notif').getAttribute('aria-label'),'Notificaciones: 3 nuevas');
 await h.shot(p,'notifications-badge-'+width);
 s.hold=true;await p.locator('#btn-notif').click();await p.waitForFunction(()=>document.getElementById('notif-dropdown')?.querySelectorAll('[data-notif-id]').length===3);
 await p.waitForTimeout(100);assert.equal(await count(p).isVisible(),true,'pending acknowledgment does not hide badge');assert(s.release);s.hold=false;s.release();
 await count(p).waitFor({state:'hidden'});assert.equal(s.items.filter(n=>n.read).length,0,'opening preserves unread history');assert.equal(await p.locator('.notif-item').count(),3);
 s.add('later');await sync(f);assert.equal(await count(p).innerText(),'1','new arrival while open remains unseen');assert.equal(s.items.find(n=>n.serverId==='later').seen,false);
 await h.shot(p,'notifications-open-'+width);await h.noOverflow(p,'notifications '+width);
 await p.locator('#btn-notif').click();await p.locator('#btn-notif').click();await count(p).waitFor({state:'hidden'});
 await p.locator('summary').click();await p.locator('[data-notif-pref="forumNews"]').click();await p.waitForFunction(()=>__notifsState.preferences.forumNews===true);
 assert(s.preferences.forumNews);await p.locator('#btn-notif').click();
 const other=await h.fixture(width<768?1440:390,s);await start(other);assert.equal(await count(other.page).isVisible(),false,'separate context uses persisted seen state');assert.equal(await other.page.evaluate(()=>__notifsState.preferences.forumNews),true);
 s.add('cross-device');await sync(f);await sync(other);assert.equal(await count(p).innerText(),'1');assert.equal(await count(other.page).innerText(),'1');
 await other.page.locator('#btn-notif').click();await count(other.page).waitFor({state:'hidden'});await sync(f);assert.equal(await count(p).isVisible(),false);
 await f.boot();await start(f);assert.equal(await count(p).isVisible(),false,'reload reads persisted state');assert.equal(s.items.every(n=>!n.read),true);
 await p.locator('#btn-notif').click();await p.locator('[data-notif-id="personal-one"]').click();assert.equal(new URL(p.url()).hash,'#directorio-solicitudes');await p.waitForTimeout(80);assert.equal(s.items.find(n=>n.serverId==='one').read,true,'explicit destination click marks read');
 await p.goBack();await p.waitForTimeout(80);
 s.add('forum',{tipo:'forum_reaction',titulo:'Nueva reacción en tu publicación',target:{section:'foro',postId:'forum-post'}});await sync(f);await p.locator('#btn-notif').click();await p.locator('[data-notif-id="personal-forum"]').click();await p.waitForSelector('.post.is-notification-target');assert.equal(new URL(p.url()).searchParams.get('publicacion'),'forum-post');assert.match(await p.locator('.post.is-notification-target').innerText(),/Publicación específica/);
 await p.goBack();await p.waitForTimeout(80);s.missingPost=true;await p.locator('#btn-notif').click();await p.locator('[data-notif-id="personal-forum"]').click();await p.getByText('Esta publicación ya no está disponible o expiró.',{exact:true}).waitFor();
 await p.locator('#btn-notif').click();await p.locator('[data-notif-id="personal-later"] .notif-del-btn').click();await p.waitForFunction(()=>!ICADEMNotifications.visibleItems().some(n=>n.serverId==='later'));assert(!s.items.some(n=>n.serverId==='later'));await sync(other);assert(!await other.page.evaluate(()=>ICADEMNotifications.visibleItems().some(n=>n.serverId==='later')));
 await p.locator('#btn-notif').click();s.items=[];for(let i=0;i<105;i++)s.add('many-'+i);await sync(f);assert.equal(await count(p).innerText(),'99+');await h.shot(p,'notifications-99plus-'+width);
 await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await count(p).evaluate(n=>getComputedStyle(n).animationName),'none');
 s.fail=true;await p.locator('#btn-notif').click();await p.waitForTimeout(120);assert.equal(await count(p).innerText(),'99+');assert.equal(s.items.some(n=>n.seen),false,'failed load never acknowledges unseen rows');s.fail=false;
 await p.locator('#btn-notif').click();await sync(f);await p.locator('#btn-notif').focus();await p.keyboard.press('Enter');await count(p).waitFor({state:'hidden'});assert.equal(s.items.length,105);
 await p.locator('#notif-read-all').click();await p.waitForFunction(()=>ICADEMNotifications.visibleItems().every(n=>n.read));assert.equal(s.items.length,105,'read all preserves history');await p.keyboard.press('Escape');assert.equal(await p.locator('#notif-dropdown').count(),0);assert.equal(await p.locator('#btn-notif').evaluate(n=>n===document.activeElement),true);
 s.add('dark');await sync(f);await p.evaluate(()=>document.documentElement.dataset.theme='night');await h.shot(p,'notifications-dark-'+width);await p.locator('#btn-notif').click();await count(p).waitFor({state:'hidden'});await h.noOverflow(p,'dark notifications '+width);await h.shot(p,'notifications-dark-open-'+width);
 await f.context.close();await other.context.close();console.log('PASS notifications '+width+' '+(process.env.ICADEM_TEST_ENGINE||'chrome'));
}
(async()=>{try{await h.start();for(const width of (process.env.ICADEM_PRIORITY_WIDTHS||'390,768,1440').split(',').map(Number))await scenario(width);}finally{await h.stop();}})().catch(error=>{console.error(error);process.exitCode=1;});
