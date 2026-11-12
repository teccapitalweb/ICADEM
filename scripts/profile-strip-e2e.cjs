'use strict';
// Production panel, synthetic authenticated API fixtures, isolated browser contexts.
// This does not create/read real people's connections or change production data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'professional-network-e2e.cjs'),'utf8');
const {h,server,openProfile,openNetwork,rowReady,row,refresh}=new Function('require','__dirname','process',source.slice(0,source.lastIndexOf('async function scenario(width)'))+'\nreturn {h,server,openProfile,openNetwork,rowReady,row,refresh};')(require,__dirname,process);
const widths=(process.env.ICADEM_PRIORITY_WIDTHS||'320,390,768,1440').split(',').map(Number);
const strip=p=>p.locator('[data-profile-network]');
const cvMarkup=p=>p.locator('.pp-layout').evaluate(n=>{const copy=n.cloneNode(true);copy.querySelector('[data-profile-section="contact"]')?.remove();return copy.innerHTML;});
async function ready(p,count,photos=Math.min(count,3)){
 await strip(p).waitFor();
 await p.waitForFunction(({count,photos})=>{const n=document.querySelector('[data-profile-network]');return n&&new RegExp('(^|\\D)'+count+'\\s+conexi').test(n.innerText)&&n.querySelectorAll('.network-stack img').length===photos;},{count,photos});
 assert.equal(await p.locator('[data-profile-network]').count(),1,'exactly one social strip');
 assert.match(await strip(p).innerText(),/Red profesional/);
 await p.evaluate(()=>document.activeElement?.blur?.());
}
async function geometry(p,width,count){
 const g=await strip(p).evaluate(n=>{
  const r=x=>{const b=x.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,b:b.bottom,right:b.right};};
  return{strip:r(n),name:r(document.querySelector('.pp-identity-copy')),avatar:r(document.querySelector('.pp-avatar')),footer:r(document.querySelector('.pp-hero-footer')),imgs:[...n.querySelectorAll('.network-photo')].map(r)};
 });
 const overlap=(a,b)=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.b-1&&a.b>b.y+1;
 assert(!overlap(g.strip,g.name)&&!overlap(g.strip,g.avatar),'strip avoids principal identity and photo');
 assert(g.strip.b<=g.footer.y+1,'strip avoids action controls');
 assert(g.strip.x>=0&&g.strip.right<=width+1,'strip is not clipped');
 assert.equal(g.imgs.length,Math.min(count,3),'only up to 3 real connections');
 g.imgs.forEach((a,i)=>{assert(Math.abs(a.w-a.h)<=1&&a.w>=24&&a.w<=44,'circular compact thumbnails');if(i)assert(a.x<g.imgs[i-1].right&&a.x>g.imgs[i-1].x,'connection thumbnails overlap');});
}
async function actionGeometry(p,width,connected){
 const actions=p.locator('.pp-actions');await actions.scrollIntoViewIfNeeded();
 const g=await actions.evaluate(n=>[...n.children].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),split=[];let text;while(text=walker.nextNode()){for(const word of text.textContent.matchAll(/\S+/g)){const range=document.createRange();range.setStart(text,word.index);range.setEnd(text,word.index+word[0].length);if(range.getClientRects().length>1)split.push(word[0]);}}return{tag:el.tagName,text:el.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,scroll:el.scrollWidth,client:el.clientWidth,display:s.display,split};}).filter(x=>x.display!=='none'));
 const activity=g.find(x=>/Ver actividad/.test(x.text));assert(activity);
 assert.equal(g.find(x=>/Conectados/.test(x.text))?.tag,connected?'SPAN':undefined,'connected is a status, not an action');
 const connect=g.find(x=>x.text==='Conectar');
 if(!connected){assert(connect);assert(connect.x<activity.x,'connect precedes activity');assert(Math.abs(connect.y-activity.y)<2,'connect and activity share a compact row');}
 for(const item of g){assert(item.x>=0&&item.right<=width+1);assert(item.scroll<=item.client+1,'no clipped action text: '+item.text);assert.deepEqual(item.split,[],'no action word split across lines: '+item.text);if(item.tag==='BUTTON')assert(item.h>=42,'comfortable touch target');}
 assert(activity.h<=64,'activity is not an oversized full-width block');
}
async function scenario(width){
 const s=server(),raw=s.handle;
 s.handle=async(route,url)=>{
  if(url.searchParams.get('preview')==='1'&&url.pathname.endsWith('/network')){
   const owner=decodeURIComponent(url.pathname.split('/')[4]);
   if(s.summaryFailure===owner){await route.fulfill({status:503,json:{error:'No pudimos consultar la red.'},headers:{'Access-Control-Allow-Origin':'*'}});return true;}
   if(s.heldFailure===owner){s.failedHeld=true;await new Promise(resolve=>s.releaseFailure=resolve);await route.fulfill({status:403,json:{error:'Red no disponible.'},headers:{'Access-Control-Allow-Origin':'*'}});return true;}
  }
  return raw(route,url);
 };
 const f=await h.fixture(width,s),p=f.page,errors=[];p.on('pageerror',e=>{if(/professional-network|professional-navigation|professional-profile|icadem-community/.test(e.stack||''))errors.push(e.message);});
 for(const [uid,total] of [['empty',0],['private',1],['single',1],['owner',6]]){
  await openProfile(p,uid);await ready(p,total);await geometry(p,width,total);await h.noOverflow(p,'profile strip '+width+' '+uid);
  assert.doesNotMatch(await strip(p).innerText(),/Tu red es privada/,'all visible profiles use the new connection policy');
  if([390,1440].includes(width))await h.shot(p,'profile-strip-'+uid+'-'+width,'.pp-hero');
 }
 await openNetwork(p,'fixture-a','mutual');await rowReady(p,'owner');assert.equal(await p.locator('[data-network-tab]').count(),1);assert.equal(await p.locator('[data-network-tab="mutual"]').count(),0);assert.equal(await p.locator('[data-network-privacy]').count(),0);assert.equal(new URL(p.url()).searchParams.get('red'),'connections');await h.noOverflow(p,'own network '+width);if([390,1440].includes(width))await h.shot(p,'profile-own-network-'+width);
 await openProfile(p,'other');await ready(p,1);await actionGeometry(p,width,false);await h.shot(p,'profile-actions-none-'+width,'.pp-hero');
 await openProfile(p,'owner');await ready(p,6);await actionGeometry(p,width,true);await h.shot(p,'profile-actions-connected-'+width,'.pp-hero');assert.doesNotMatch(await strip(p).innerText(),/Tu red es privada/);
 const photos=await strip(p).locator('img').evaluateAll(ns=>ns.map(n=>n.currentSrc||n.src));for(const uid of ['fixture-a','extra','mutual'])assert(photos.some(src=>src.includes('photo='+uid)),'preview uses the server-projected accepted profile '+uid);
 const cover=await p.locator('.pp-cover').getAttribute('style'),cv=await cvMarkup(p);
 await strip(p).click();await rowReady(p,'other');assert.equal(await p.locator('[data-network-tab]').count(),2);assert.equal(await p.locator('[data-network-row]').count(),6);assert.equal(await p.locator('[data-network-row="hidden"]').count(),0);assert.equal(await p.locator('[data-network-privacy]').count(),0);
 for(const [uid,label] of [['other',/Conectar/],['sent',/Pendiente/],['received',/Aceptar/],['mutual',/Conectados/]])assert.match(await row(p,uid).innerText(),label);
 await p.locator('[data-network-tab="mutual"]').click();await rowReady(p,'mutual');assert.deepEqual(await p.locator('[data-network-row]').evaluateAll(ns=>ns.map(n=>n.dataset.networkRow)),['mutual']);
 await p.locator('[data-network-tab="connections"]').click();await rowReady(p,'other');await h.noOverflow(p,'network '+width);await h.shot(p,'profile-full-network-'+width);
 const button=row(p,'other').locator('[data-connect]');s.holdAction=true;await button.click();while(!s.releaseAction)await p.waitForTimeout(10);assert.equal(await button.isDisabled(),true);assert.doesNotMatch(await row(p,'other').innerText(),/Pendiente/,'request is not confirmed early');s.holdAction=false;s.releaseAction();await p.waitForFunction(()=>/Pendiente/.test(document.querySelector('[data-network-row="other"]')?.innerText||''));
 await p.locator('[data-network-owner-back]').click();await p.waitForSelector('.professional-profile-page');await ready(p,6);assert.equal(await p.locator('.pp-cover').getAttribute('style'),cover);assert.equal(await cvMarkup(p),cv,'CV content unaffected');
 if(width===390){
  const other=await h.fixture(1440,s);await openProfile(other.page,'owner');await ready(other.page,6);
  const acceptedOwner=['fixture-a','owner'].sort().join('|');s.accepted.delete(acceptedOwner);
  for(const page of [p,other.page]){await refresh(page);await page.waitForSelector('.pp-actions [data-connect="owner"]');assert.match(await page.locator('.pp-actions').innerText(),/Conectar/);assert.equal(await cvMarkup(page),cv);assert.equal(await page.locator('[data-profile-section="contact"]').count(),0,'revoked relationship also revokes connection-only contacts');}
  s.accepted.add(acceptedOwner);
  for(const page of [p,other.page]){await refresh(page);await page.waitForSelector('.pp-actions .pp-connected');await ready(page,6);}
  s.shares.owner=false;
  for(const page of [p,other.page]){await refresh(page);await ready(page,6);assert.equal(await strip(page).locator('img').count(),3,'legacy private preferences no longer hide accepted connections');}
  s.shares.owner=true;s.accepted.delete(['owner','extra'].sort().join('|'));
  for(const page of [p,other.page]){await refresh(page);await ready(page,5);}
  s.photos.mutual='/missing-real-photo.jpg';
  for(const page of [p,other.page]){await refresh(page);await page.waitForFunction(()=>[...document.querySelectorAll('[data-profile-network] .network-photo')].some(n=>n.textContent==='Br'));assert.equal(await strip(page).locator('.network-photo').count(),3,'broken real photo keeps actual profile initials, not invented profile');}
  s.photos.mutual='/assets/juegos/foto-fiscal.webp?photo=updated';
  for(const page of [p,other.page]){await refresh(page);await page.waitForFunction(()=>[...document.querySelectorAll('[data-profile-network] img')].some(n=>n.src.includes('photo=updated')));}
  await other.context.close();
  s.summaryFailure='owner';await refresh(p);await p.waitForFunction(()=>document.querySelector('[data-profile-network]')?.innerText.includes('No pudimos cargar'));
  assert.equal(await strip(p).locator('img').count(),0,'failed permission/read clears old thumbnails');assert.doesNotMatch(await strip(p).innerText(),/5 conexiones/,'old count is not presented as current');
  s.summaryFailure=null;await refresh(p);await ready(p,5);
  s.heldFailure='owner';await refresh(p);for(let n=0;n<100&&!s.failedHeld;n++)await p.waitForTimeout(20);assert(s.failedHeld);
  await openProfile(p,'empty');await ready(p,0);s.heldFailure=null;s.releaseFailure();await p.waitForTimeout(100);await ready(p,0);assert.equal(new URL(p.url()).searchParams.get('profesional'),'empty','stale failure cannot alter newly opened profile');
  // Refresh remains live after normal navigation's cleanup and reflects remote changes.
  await openProfile(p,'empty');await ready(p,0);s.accepted.add(['empty','mutual'].sort().join('|'));await refresh(p);await ready(p,1);
  await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>document.documentElement.dataset.theme='night');await h.noOverflow(p,'night profile '+width);await h.shot(p,'profile-strip-night-'+width,'.pp-hero');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(f.state.selects,[],'profile/network never consumes academic slots');console.log('PASS profile strip '+width+' '+(process.env.ICADEM_TEST_ENGINE||'chrome'));await f.context.close();
}
(async()=>{try{await h.start();for(const width of widths)await scenario(width);}finally{await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
