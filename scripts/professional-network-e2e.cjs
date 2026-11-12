'use strict';
// Full production UI, isolated browser contexts and synthetic intercepted APIs only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,getBase:()=>base,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const widths=(process.env.ICADEM_PRIORITY_WIDTHS||'320,360,375,390,414,768,1024,1440').split(',').map(Number);
const viewer='fixture-a',pair=(a,b)=>[a,b].sort().join('|');
const templates=[['fixture-a','Mi perfil de prueba',true],['owner','Ana Consultora Financiera',true],['mutual','Bruno Especialista',false],['other','Carla Asesora',false],['received','David Consultor',true],['sent','Elena Profesional',false],['extra','Fernando Profesional',false],['private','Gloria Profesional',true],['single','Hugo Profesional',false],['empty','Inés Profesional',false],['hidden','Perfil no visible',false]].map(([uid,nombre,isVip])=>({uid,id:uid,nombre,isVip,puesto:'Consultoría profesional',profesion:'Especialista en finanzas',empresa:'Organización de prueba',sector:'Fiscal y Contable',foto:'/assets/juegos/foto-fiscal.webp?photo='+uid,photoVersion:1,portadaColorPersonalizado:true,portadaColor:'#244b64',perfilCompleto:true,contacts:{},cv:{resumen:'Trayectoria profesional que debe permanecer intacta.',experiencia:[{cargo:'Especialista',empresa:'Entidad de ejemplo'}],formacion:[{titulo:'Formación profesional',institucion:'Institución de ejemplo'}],estilo:{color:'#51988a'}}}));
function server(){
 const accepted=new Set([pair(viewer,'owner'),pair(viewer,'mutual'),...['mutual','other','received','sent','extra','hidden'].map(id=>pair('owner',id)),pair('single','mutual'),pair('private','mutual')]);
 const s={data:h.initial(),accepted,requests:new Map([[pair(viewer,'received'),'received'],[pair(viewer,'sent'),viewer]]),shares:Object.fromEntries(templates.map(p=>[p.uid,!['fixture-a','private'].includes(p.uid)])),revisions:{},hidden:new Set(['hidden']),photos:{},mutations:[],privacyWrites:[],reads:[],failAction:false,holdAction:false,holdOwner:null,held:false};
 const graph=uid=>[...s.accepted].filter(edge=>edge.split('|').includes(uid)).map(edge=>edge.split('|').find(id=>id!==uid));
 const relationship=uid=>uid===viewer?'self':s.accepted.has(pair(viewer,uid))?'connected':s.requests.has(pair(viewer,uid))?(s.requests.get(pair(viewer,uid))===viewer?'sent':'received'):'none';
 const identity=uid=>{const p=templates.find(p=>p.uid===uid);return p?{uid,nombre:p.nombre,foto:s.photos[uid]||p.foto,iniciales:p.nombre.slice(0,2),photoVersion:s.photos[uid]?2:1,puesto:p.puesto,profesion:p.profesion,isVip:p.isVip,own:uid===viewer}:null;};
 const profile=uid=>({...templates.find(p=>p.uid===uid),...identity(uid),connection:relationship(uid),contacts:relationship(uid)==='connected'?{email:'authorized@example.test'}:{}});
 const visible=uid=>graph(uid).filter(other=>!s.hidden.has(other)).sort();
 s.handle=async(route,url)=>{
  const p=url.pathname,req=route.request(),headers={'Access-Control-Allow-Origin':'*'};
  if(p==='/api/community/network/privacy'){
    if(req.method()==='PATCH'){
      const body=req.postDataJSON();s.privacyWrites.push(body);
      if(body.shareNetwork===false){await route.fulfill({status:409,json:{error:'Las conexiones aceptadas son visibles dentro de ICADEM.'},headers});return true;}
    }
    await route.fulfill({json:{ok:true,privacy:{shareNetwork:true,revision:0,editable:false,visibility:'members'}},headers});return true;
  }
  const network=p.match(/^\/api\/community\/profiles\/([^/]+)\/network$/);
  if(network){
    const uid=decodeURIComponent(network[1]),tab=url.searchParams.get('tab')||'connections';s.reads.push({uid,tab});
    if(s.holdOwner===uid){s.held=true;await new Promise(resolve=>s.releaseOwner=resolve);}
    if(s.hidden.has(uid)||!identity(uid)){await route.fulfill({status:404,json:{error:'Perfil no disponible.'},headers});return true;}
    const ids=visible(uid),mutual=uid===viewer?[]:ids.filter(id=>id!==viewer&&id!==uid&&graph(viewer).includes(id)),chosen=tab==='mutual'&&uid!==viewer?mutual:ids;
    await route.fulfill({json:{ok:true,profile:identity(uid),items:chosen.map(id=>({...identity(id),connection:relationship(id)})),visibleCount:ids.length,mutualCount:mutual.length,preview:ids.slice(0,5).map(identity),nextCursor:null,visibility:'members'},headers});return true;
  }
  if(p==='/api/directory'){await route.fulfill({json:{ok:true,items:templates.filter(p=>!s.hidden.has(p.uid)).map(p=>profile(p.uid)),canViewContacts:true},headers});return true;}
  if(p==='/api/community/connections'&&req.method()==='GET'){
    await route.fulfill({json:{ok:true,connected:graph(viewer).filter(id=>!s.hidden.has(id)).map(profile),sent:[...s.requests].filter(([,from])=>from===viewer).map(([edge])=>profile(edge.split('|').find(id=>id!==viewer))),received:[...s.requests].filter(([,from])=>from!==viewer).map(([edge])=>profile(edge.split('|').find(id=>id!==viewer)))},headers});return true;
  }
  if(p.startsWith('/api/community/connections')&&req.method()==='POST'){
    const body=req.postDataJSON(),parts=p.split('/'),uid=parts[4]||body.targetUid,action=parts[5]||'request';s.mutations.push({uid,action,body,path:p});
    if(s.holdAction)await new Promise(resolve=>s.releaseAction=resolve);
    if(s.failAction){s.failAction=false;await route.fulfill({status:503,json:{error:'La solicitud no fue confirmada.'},headers});return true;}
    if(action==='request')s.requests.set(pair(viewer,uid),viewer);else if(action==='cancel'||action==='reject')s.requests.delete(pair(viewer,uid));else if(action==='accept'){s.requests.delete(pair(viewer,uid));s.accepted.add(pair(viewer,uid));}else if(action==='remove')s.accepted.delete(pair(viewer,uid));
    await route.fulfill({json:{ok:true},headers});return true;
  }
  const activity=p.match(/^\/api\/community\/profiles\/([^/]+)\/activity$/);
  if(activity){const uid=activity[1],at=Date.now();await route.fulfill({json:{ok:true,profile:profile(uid),items:[{id:'activity-original',uid,texto:'Publicación original conservada.',imagen:'',likes:1,comentariosCount:2,createdAtMs:at-1000,expiresAtMs:at-1000+15*86400000}],nextCursor:null,serverNowMs:at,canPublish:true},headers});return true;}
  if(p.startsWith('/api/community/profiles/')){const uid=decodeURIComponent(p.split('/').pop());await route.fulfill(s.hidden.has(uid)||!identity(uid)?{status:404,json:{error:'Perfil no disponible.'},headers}:{json:{ok:true,profile:profile(uid)},headers});return true;}
  if(p==='/api/community/authors'){await route.fulfill({json:{ok:true,authors:templates.map(p=>identity(p.uid))},headers});return true;}
  return false;
 };return s;
}
async function openProfile(p,uid){await p.evaluate(uid=>navigateToSection('directorio-perfil',{profileUid:uid}),uid);await p.waitForSelector('.professional-profile-page');assert.equal(new URL(p.url()).searchParams.get('profesional'),uid);}
async function openNetwork(p,uid,tab='connections'){await p.evaluate(({uid,tab})=>navigateToSection('directorio-red',{profileUid:uid,networkTab:tab}),{uid,tab});await p.waitForSelector('[data-professional-network]');await p.waitForFunction(()=>!document.querySelector('[data-professional-network] [aria-busy="true"]'));assert.equal(new URL(p.url()).hash,'#directorio-red');assert.equal(new URL(p.url()).searchParams.get('profesional'),uid);}
async function rowReady(p,uid){await p.waitForSelector(`[data-network-row="${uid}"]`);}
const row=(p,uid)=>p.locator(`[data-network-row="${uid}"]`);
async function refresh(p){await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForTimeout(100);}
async function authAfterDirect(p){await p.waitForFunction(()=>window.ICADEMPlatform&&typeof navigateToSection==='function');await p.evaluate(()=>{window.__isDemoMode=false;window.__currentUser={uid:'fixture-a',getIdToken:()=>Promise.resolve('browser-fixture-only')};window.__auth={currentUser:window.__currentUser};Object.assign(UserState,{uid:'fixture-a',modo:'vip',identityReady:true,profileComplete:true,profileIntakeSeen:true,isAdmin:false});navigateToSection(location.hash.slice(1),{reemplazar:true});document.querySelectorAll('.ica-tour-root,.ica-experience,#name-modal').forEach(n=>n.hidden=true);});}
async function scenario(width){
 const s=server(),f=await h.fixture(width,s),p=f.page,errors=[];p.on('pageerror',e=>{if(/professional-network|professional-navigation|professional-profile|icadem-community/.test(e.stack||''))errors.push(e.message);});
 for(const [uid,total] of [['private',1],['empty',0],['single',1],['owner',6]]){
   await openProfile(p,uid);await p.waitForTimeout(90);const strip=p.locator('[data-profile-network]');
   if(total===0){await strip.waitFor();assert.equal(await strip.locator('img').count(),0,'empty strip never invents peers');assert.match(await strip.innerText(),/0|Sin conexiones|Red profesional|Mi red/i);}
   else{
     await strip.waitFor();assert.match(await strip.innerText(),new RegExp(String(total)));
     const geometry=await strip.evaluate(n=>{const rect=x=>{const r=x.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};},imgs=[...n.querySelectorAll('img')].map(i=>{const r=i.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});return{a:rect(n),identity:rect(document.querySelector('.pp-identity-copy')),avatar:rect(document.querySelector('.pp-avatar')),imgs};});
     const overlaps=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
     assert(!overlaps(geometry.a,geometry.identity)&&!overlaps(geometry.a,geometry.avatar),'strip never overlaps main identity/avatar');assert(geometry.a.left>=-1&&geometry.a.right<=width+1);assert.equal(geometry.imgs.length,Math.min(total,3));
     geometry.imgs.forEach((g,i)=>{assert(g.width>=20&&g.width<=44&&Math.abs(g.width-g.height)<=1);if(i)assert(g.x<geometry.imgs[i-1].x+geometry.imgs[i-1].width,'thumbnails overlap one another only');});
   }
 }
 await openProfile(p,'owner');const cv=await p.locator('.pp-layout').innerHTML(),cover=await p.locator('.pp-cover').getAttribute('style');
 if([320,390,768,1440].includes(width))await h.shot(p,'network-profile-strip-'+width,'.pp-hero');
 await p.locator('[data-profile-network]').click();await rowReady(p,'other');assert.match(await p.locator('[data-professional-network]').innerText(),/Red profesional/);assert.equal(await p.locator('[data-network-tab]').count(),2);assert.equal(await p.locator('[data-network-row]').count(),6);assert.equal(await p.locator('[data-network-row="hidden"]').count(),0);assert.equal(await p.locator('[data-professional-network] a[href^="mailto:"]').count(),0);assert.equal(await p.locator('[data-network-privacy]').count(),0);assert.doesNotMatch(await p.locator('[data-professional-network]').innerText(),/Tu red es privada|Compartir mi red/);
 assert.match(await row(p,'other').innerText(),/Conectar/);assert.match(await row(p,'sent').innerText(),/Pendiente|Solicitud/);assert.match(await row(p,'received').innerText(),/Aceptar|Solicitud/);assert.match(await row(p,'mutual').innerText(),/Conectados/);
 await p.locator('[data-network-tab="mutual"]').click();await rowReady(p,'mutual');assert.deepEqual(await p.locator('[data-network-row]').evaluateAll(ns=>ns.map(n=>n.dataset.networkRow)),['mutual']);assert.equal(await p.locator(`[data-network-row="${viewer}"]`).count(),0);
 await p.locator('[data-network-tab="connections"]').click();await rowReady(p,'other');await h.noOverflow(p,'network '+width);if([320,390,768,1440].includes(width))await h.shot(p,'professional-network-'+width);
 const lastButton=p.locator('[data-network-row] button').last();await lastButton.evaluate(button=>button.scrollIntoView({block:'center',behavior:'instant'}));assert.equal(await lastButton.evaluate(button=>{const r=button.getBoundingClientRect(),point=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return point===button||button.contains(point);}),true,'last row action remains reachable above fixed mobile navigation');
 const action=row(p,'other').locator('[data-connect]');s.holdAction=true;const before=s.mutations.length;await action.click();await p.waitForTimeout(50);assert.equal(s.mutations.length,before+1);assert.equal(await action.isDisabled(),true);assert.doesNotMatch(await row(p,'other').innerText(),/Pendiente/,'no success before backend acknowledgment');s.holdAction=false;s.releaseAction();await p.waitForFunction(()=>/Pendiente|Solicitud/.test(document.querySelector('[data-network-row="other"]')?.innerText||''));assert.equal(s.mutations.length,before+1);
 if(width===390){
   const fail=row(p,'extra').locator('[data-connect]');s.failAction=true;await fail.click();await p.waitForTimeout(100);assert(!s.requests.has(pair(viewer,'extra')));assert.match(await row(p,'extra').innerText(),/Conectar/,'backend rejection retains none state');
   const received=row(p,'received').locator('[data-network-action="accept"]');await received.click();await p.waitForFunction(()=>/Conectados/.test(document.querySelector('[data-network-row="received"]')?.innerText||''));assert(s.accepted.has(pair(viewer,'received')));
 }
 // Opening a row must return to its source network and preserve owner/tab.
 await p.locator('[data-network-tab="mutual"]').click();await rowReady(p,'mutual');
 const profileLink=row(p,'mutual').locator('[data-network-profile],[data-network-row-profile],a').first();await profileLink.click();await p.waitForSelector('.professional-profile-page');assert.equal(new URL(p.url()).searchParams.get('profesional'),'mutual');
 if(width===390){
   await p.locator('[data-profile-network]').click();await rowReady(p,'owner');assert.equal(new URL(p.url()).searchParams.get('profesional'),'mutual');
   await row(p,'owner').locator('[data-network-profile],[data-network-row-profile],a').first().click();await p.waitForSelector('.professional-profile-page');assert.equal(new URL(p.url()).searchParams.get('profesional'),'owner');
   await p.locator('[data-professional-back]').click();await rowReady(p,'owner');assert.equal(new URL(p.url()).searchParams.get('profesional'),'mutual');
   await p.locator('[data-network-owner-back]').click();await p.waitForSelector('.professional-profile-page');assert.equal(new URL(p.url()).searchParams.get('profesional'),'mutual');
 }
 await p.locator('[data-professional-back]').click();await rowReady(p,'mutual');assert.equal(new URL(p.url()).searchParams.get('profesional'),'owner');assert.equal(new URL(p.url()).searchParams.get('red'),'mutual','nested profile return preserves source network tab');
 await p.locator('[data-network-owner-back]').click();await p.waitForSelector('.professional-profile-page');assert.equal(new URL(p.url()).searchParams.get('profesional'),'owner');assert.equal(await p.locator('.pp-layout').innerHTML(),cv);assert.equal(await p.locator('.pp-cover').getAttribute('style'),cover);
 await p.locator('[data-profile-activity]').click();await p.waitForSelector('[data-activity-post="activity-original"]');await p.locator('[data-activity-back]').click();await p.waitForSelector('.professional-profile-page');
 await openNetwork(p,'private');await rowReady(p,'mutual');assert.equal(await p.locator('[data-network-row]').count(),1,'legacy private settings do not hide a nonfriend network');
 await p.locator('[data-network-tab="mutual"]').click();await rowReady(p,'mutual');
 await openNetwork(p,'empty');assert.equal(await p.locator('[data-network-row]').count(),0);await p.locator('[data-network-tab="mutual"]').click();await p.getByText('Todavía no tienen conexiones en común',{exact:true}).waitFor();
 await openNetwork(p,viewer);assert.equal(await p.locator('[data-network-privacy]').count(),0);assert.equal(await p.locator('[data-network-tab="mutual"]').count(),0);assert.equal(await p.locator('[data-network-tab]').count(),1);assert.equal(await p.locator(`[data-network-row="${viewer}"]`).count(),0,'own rows cannot connect to self');
 await openNetwork(p,viewer,'mutual');assert.equal(new URL(p.url()).searchParams.get('red'),'connections','own mutual links normalize to connections');assert.equal(await p.locator('[data-network-tab="mutual"]').count(),0);await rowReady(p,'owner');
 if([390,1440].includes(width))await h.shot(p,'professional-network-own-'+width);
 if(width===390){
   const other=await h.fixture(1440,s);await openNetwork(other.page,viewer);
   s.requests.set(pair(viewer,'extra'),'extra');
   for(const page of [p,other.page]){await page.evaluate(()=>navigateToSection('directorio-solicitudes'));await page.locator('[data-network-action="accept"][data-uid="extra"]').waitFor();}
   await p.locator('[data-network-action="accept"][data-uid="extra"]').click();for(let n=0;n<100&&!s.accepted.has(pair(viewer,'extra'));n++)await p.waitForTimeout(20);assert(s.accepted.has(pair(viewer,'extra')));
   await refresh(other.page);await other.page.locator('[data-network-action="accept"][data-uid="extra"]').waitFor({state:'detached'});
   for(const page of [p,other.page]){await openNetwork(page,viewer);await rowReady(page,'extra');}
   for(const page of [p,other.page]){assert.equal(await page.locator('[data-network-privacy]').count(),0);assert.equal(await page.locator('[data-network-tab="mutual"]').count(),0);}assert.equal(s.shares[viewer],false,'the policy does not rewrite legacy preferences');
   s.accepted.add(pair(viewer,'extra'));await refresh(p);await refresh(other.page);await rowReady(p,'extra');await rowReady(other.page,'extra');s.photos.extra='/assets/juegos/foto-fiscal.webp?photo=fresh';await refresh(p);await refresh(other.page);for(const page of [p,other.page])await page.waitForFunction(()=>document.querySelector('[data-network-row="extra"] img')?.src.includes('photo=fresh'));
   s.accepted.delete(pair(viewer,'extra'));await refresh(p);await refresh(other.page);for(const page of [p,other.page])await page.locator('[data-network-row="extra"]').waitFor({state:'detached'});await other.context.close();
   s.holdOwner='owner';s.held=false;await p.evaluate(()=>navigateToSection('directorio-red',{profileUid:'owner'}));for(let n=0;n<100&&!s.held;n++)await p.waitForTimeout(20);assert(s.held);await openNetwork(p,'empty');s.holdOwner=null;s.releaseOwner();await p.waitForTimeout(80);assert.equal(await p.locator('[data-network-row]').count(),0,'late owner response cannot overwrite new owner');assert.equal(new URL(p.url()).searchParams.get('profesional'),'empty');
 }
 if([390,1440].includes(width)){
   await p.goto(h.getBase()+'/vip-panel.html?modo=demo&profesional='+viewer+'&red=mutual#directorio-red',{waitUntil:'domcontentloaded'});await authAfterDirect(p);await rowReady(p,'owner');assert.equal(new URL(p.url()).searchParams.get('red'),'connections');assert.equal(await p.locator('[data-network-tab]').count(),1);assert.equal(await p.locator('[data-network-tab="mutual"]').count(),0);assert.equal(await p.locator('[data-network-privacy]').count(),0);
   await p.reload({waitUntil:'domcontentloaded'});await authAfterDirect(p);await rowReady(p,'owner');assert.equal(new URL(p.url()).searchParams.get('red'),'connections');assert.equal(await p.locator('[data-network-tab]').count(),1,'reload never restores own mutual tab');
   await p.goto(h.getBase()+'/vip-panel.html?modo=demo&profesional=owner&red=mutual#directorio-red',{waitUntil:'domcontentloaded'});await authAfterDirect(p);await rowReady(p,'mutual');assert.equal(await p.locator('[data-network-row]').count(),s.accepted.has(pair(viewer,'received'))?2:1);await p.reload({waitUntil:'domcontentloaded'});await authAfterDirect(p);await rowReady(p,'mutual');
   await p.locator('[data-network-tab="connections"]').focus();await p.keyboard.press('Enter');await rowReady(p,'other');await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>document.documentElement.dataset.theme='night');await h.noOverflow(p,'network night '+width);await h.shot(p,'professional-network-night-'+width);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(f.state.selects,[]);assert.deepEqual(s.privacyWrites,[],'new UI never writes obsolete sharing preferences');console.log('PASS professional network '+width+' '+(process.env.ICADEM_TEST_ENGINE||'chrome'));await f.context.close();
}
(async()=>{try{await h.start();for(const width of widths)await scenario(width);}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
