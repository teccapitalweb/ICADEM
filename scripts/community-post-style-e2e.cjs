'use strict';
// Production panel, synthetic intercepted APIs/snapshots and isolated contexts.
// No production authentication or student writes occur in this script.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const PALETTE=[['default','Predeterminado','#DCE5E5'],['gold','Dorado','#C5A15B'],['blue','Azul','#78A6BE'],['mint','Menta','#8AB9AC'],['lavender','Lavanda','#ADA0C6'],['coral','Coral','#D8A293']].map(([key,label,color])=>({key,label,color}));
const rgb=color=>'rgb('+color.slice(1).match(/../g).map(x=>parseInt(x,16)).join(', ')+')';
const DAYS=15*86400000;
function backend(){
 const s={data:h.initial(),actors:new Map(),posts:[],privateStyles:new Map(),comments:{},receipts:new Map(),postCalls:[],patchCalls:[],events:[],next:0,failPost:false,holdPost:false,releasePost:null,failPatch:false,holdPatch:false,releasePatch:null,holdStyleRead:false,styleReads:[]};
 const identity=uid=>({uid,nombre:'Profesional '+uid,iniciales:'PP',foto:'/assets/juegos/foto-fiscal.webp',photoVersion:'1'});
 const role=page=>s.actors.get(page)||{uid:'fixture-a',vip:false,admin:false};
 const profile=(uid,a)=>({...identity(uid),own:uid===a.uid,isVip:[...s.actors.values()].some(v=>v.uid===uid&&v.vip),puesto:'Consultoría profesional',profesion:'Especialista en finanzas',connection:uid===a.uid?'self':'none',cv:{resumen:'Perfil original de prueba'}});
 const headers={'Access-Control-Allow-Origin':'*'};
 const goodAccent=key=>PALETTE.some(x=>x.key===key);
 s.style=id=>s.privateStyles.get(id)||{style:{accent:'default'},styleRevision:0};
 s.seed=(id,uid,extra={})=>{const {untrusted,...fields}=extra,post={...identity(uid),id,texto:'Contenido original '+id,imagen:null,esVip:true,esAdmin:false,createdAtMs:Date.now()-1000,likes:2,likedBy:{'another-user':true,'one-more-user':true},comentariosCount:0,...fields};if(fields.style&&!untrusted)s.privateStyles.set(id,{style:structuredClone(fields.style),styleRevision:fields.styleRevision||0});s.posts.push(post);return post;};
 s.broadcast=async()=>{for(const p of s.actors.keys())if(!p.isClosed())await p.evaluate(data=>window.__emitStyleCommunity?.(data),{posts:s.posts,comments:s.comments});};
 s.handle=async(route,url)=>{
  const req=route.request(),p=url.pathname,a=role(req.frame().page()),body=['POST','PATCH'].includes(req.method())?req.postDataJSON():null;
  if(p==='/api/forum/style-capabilities'){await route.fulfill({json:{ok:true,canCustomize:a.vip,isVip:a.vip,isAdmin:a.admin,palette:PALETTE},headers});return true;}
  if(p==='/api/forum/post-styles/read'){
   if(s.holdStyleRead)await new Promise(resolve=>s.styleReads.push(resolve));
   const ids=body?.postIds||[],items=ids.filter(id=>s.posts.some(post=>post.id===id&&post.createdAtMs+DAYS>Date.now())).map(postId=>({postId,...s.style(postId)}));await route.fulfill({json:{ok:true,items},headers});return true;
  }
  if(p==='/api/community/authors'){const ids=(url.searchParams.get('uids')||'').split(',');await route.fulfill({json:{ok:true,authors:ids.map(identity)},headers});return true;}
  if(p==='/api/notifications'){await route.fulfill({json:{ok:true,items:[],serverNowMs:Date.now(),retentionDays:15,preferences:{forumActivity:true,forumNews:false},forumAvailable:true},headers});return true;}
  if(p.startsWith('/api/notifications/')){await route.fulfill({json:{ok:true},headers});return true;}
  if(p==='/api/forum/posts'&&body){
   s.postCalls.push(structuredClone(body));if(s.holdPost)await new Promise(resolve=>s.releasePost=resolve);
   if(s.failPost){s.failPost=false;await route.fulfill({status:503,json:{error:'No se confirmó la publicación'},headers});return true;}
   const accent=body.style?.accent||'default';if(!goodAccent(accent)||!a.vip&&accent!=='default'){await route.fulfill({status:403,json:{error:'La personalización requiere una membresía VIP activa.'},headers});return true;}
   const key=a.uid+':'+body.requestId;let id=s.receipts.get(key);if(!id){id='style-post-'+ ++s.next;s.receipts.set(key,id);s.privateStyles.set(id,{style:{accent},styleRevision:0});s.posts.unshift({...identity(a.uid),id,texto:body.texto,imagen:body.imagen,esVip:a.vip,esAdmin:a.admin,createdAtMs:Date.now(),likes:0,likedBy:{},comentariosCount:0,styleRevision:0});}
   await route.fulfill({status:201,json:{ok:true,postId:id},headers});await s.broadcast();return true;
  }
  const match=p.match(/^\/api\/forum\/posts\/([A-Za-z0-9_-]+)(?:\/(style|like|comments))?$/);
  if(match){const post=s.posts.find(x=>x.id===match[1]);if(!post||post.createdAtMs+DAYS<=Date.now()){await route.fulfill({status:404,json:{error:'Publicación no disponible o expirada.'},headers});return true;}
   if(req.method()==='GET'){if(s.holdExact===post.id)await new Promise(resolve=>s.releaseExact=resolve);await route.fulfill({json:{ok:true,post:{...post,...s.style(post.id),likedBy:post.likedBy[a.uid]?{[a.uid]:true}:{}}},headers});return true;}
   if(match[2]==='style'){
    s.patchCalls.push({actor:structuredClone(a),id:post.id,body:structuredClone(body)});if(s.holdPatch)await new Promise(resolve=>s.releasePatch=resolve);
    if(s.failPatch){s.failPatch=false;await route.fulfill({status:503,json:{error:'No se pudo guardar el estilo.'},headers});return true;}
    if(!a.vip||post.uid!==a.uid){await route.fulfill({status:403,json:{error:'Solo el autor con VIP activo puede editar el estilo.'},headers});return true;}
    if(!goodAccent(body.accent)){await route.fulfill({status:400,json:{error:'Color inválido.'},headers});return true;}
    if(body.expectedRevision!==s.style(post.id).styleRevision){await route.fulfill({status:409,json:{error:'El estilo cambió en otra sesión. Actualiza antes de guardar.'},headers});return true;}
    const revision=s.style(post.id).styleRevision+1;s.privateStyles.set(post.id,{style:{accent:body.accent},styleRevision:revision});post.styleRevision=revision;
    await route.fulfill({json:{ok:true,postId:post.id,...s.style(post.id)},headers});await s.broadcast();return true;
   }
   if(match[2]==='like'){if(body.liked)post.likedBy[a.uid]=true;else delete post.likedBy[a.uid];post.likes=Object.values(post.likedBy).filter(Boolean).length;await route.fulfill({json:{ok:true,liked:body.liked,likes:post.likes},headers});await s.broadcast();return true;}
   if(match[2]==='comments'){const cid='comment-'+ ++s.next;(s.comments[post.id]||=[]).push({...identity(a.uid),id:cid,texto:body.texto,createdAtMs:Date.now(),esVip:a.vip,esAdmin:a.admin});post.comentariosCount=s.comments[post.id].length;await route.fulfill({status:201,json:{ok:true,commentId:cid},headers});await s.broadcast();return true;}
  }
  const activity=p.match(/^\/api\/community\/profiles\/([^/]+)\/activity$/);
  if(activity){const owner=decodeURIComponent(activity[1]),at=Date.now();await route.fulfill({json:{ok:true,profile:profile(owner,a),items:s.posts.filter(x=>x.uid===owner&&x.createdAtMs+DAYS>at).map(x=>({...x,...s.style(x.id),expiresAtMs:x.createdAtMs+DAYS})),nextCursor:null,serverNowMs:at,canPublish:true},headers});return true;}
  if(p.startsWith('/api/community/profiles/')){const uid=p.split('/').pop();await route.fulfill({json:{ok:true,profile:profile(uid,a)},headers});return true;}
  if(p==='/api/community/connections'){await route.fulfill({json:{ok:true,received:[],sent:[],connected:[]},headers});return true;}
  return false;
 };return s;
}
async function setup(f,s,actor){
 s.actors.set(f.page,actor);await f.page.evaluate(({uid,vip,admin})=>{
  window.__currentUser={uid,getIdToken:()=>Promise.resolve('synthetic-style-session-only')};window.__auth={currentUser:window.__currentUser};Object.assign(window.UserState,{uid,modo:vip||admin?'vip':'free',isAdmin:admin,identityReady:true,displayName:'Profesional '+uid});window.__isDemoMode=false;
  const listeners=new Set();let data={posts:[],comments:{}};
  const emitEntry=entry=>{const records=entry.path==='posts'?data.posts:(data.comments[entry.path.split('/')[1]]||[]),docs=records.map(x=>({id:x.id,data:()=>({...x,createdAt:{toDate:()=>new Date(x.createdAtMs)}})}));entry.next({empty:!docs.length,docs,forEach:fn=>docs.forEach(fn)});};
  window.__emitStyleCommunity=value=>{data=value;for(const entry of [...listeners])emitEntry(entry);};
  window.__fs={db:{},collection:(_db,...parts)=>({path:parts.join('/')}),query:ref=>ref,orderBy:()=>null,limit:()=>null,onSnapshot(ref,next){const entry={path:ref.path,next};listeners.add(entry);queueMicrotask(()=>emitEntry(entry));return()=>listeners.delete(entry);}};
  navigateToSection('foro');window.dispatchEvent(new Event('focus'));
 },actor);await s.broadcast();await f.page.waitForSelector('#foro-text');
}
const row=(p,id)=>p.locator(`[data-post="${id}"]`);
const composer=p=>p.locator('.foro-composer');
async function waitPalette(p){const picker=composer(p).locator('[data-post-style-picker]');await picker.waitFor();if(!await picker.evaluate(n=>n.open))await picker.locator('summary').click();}
async function select(p,key,scope){await (scope||composer(p)).locator(`[role="radio"][data-post-accent="${key}"]`).click();}
const border=node=>node.evaluate(n=>getComputedStyle(n).borderTopColor);
async function centeredShot(p,name,selector){await p.waitForTimeout(160);await p.locator(selector).evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await h.shot(p,name,selector);}
async function expectBorder(node,key){await node.page().waitForFunction(({selector,color})=>{const n=document.querySelector(selector);return n&&getComputedStyle(n).borderTopColor===color;},{selector:await node.evaluate(n=>n.matches('[data-post]')?'[data-post="'+n.dataset.post+'"]':n.matches('[data-activity-post]')?'[data-activity-post="'+n.dataset.activityPost+'"]':'[data-post-style-preview]'),color:rgb(PALETTE.find(x=>x.key===key).color)});}
async function scenario(width){
 const s=backend();s.seed('legacy-post','fixture-a');s.seed('foreign-vip','foreign',{style:{accent:'lavender'},styleRevision:2});s.seed('expired-post','fixture-a',{createdAtMs:Date.now()-DAYS-1000,style:{accent:'gold'},styleRevision:1});s.seed('forged-root','admin-without-vip',{style:{accent:'coral'},styleRevision:999,untrusted:true,esVip:false});const sourceCount=s.posts.length;s.holdStyleRead=width===390;
 const f=await h.fixture(width,s),p=f.page;await setup(f,s,{uid:'fixture-a',vip:true,admin:false});await waitPalette(p);
 if(width===390){await row(p,'forged-root').waitFor();assert.equal(await row(p,'forged-root').getAttribute('data-post-accent'),'default','raw root style cannot paint while server metadata is pending');s.holdStyleRead=false;s.styleReads.splice(0).forEach(resolve=>resolve());}
 await p.waitForTimeout(90);assert.equal(await row(p,'forged-root').getAttribute('data-post-accent'),'default','administrator-created root CSS fields are not an entitlement');
 const palette=composer(p).locator('[data-post-style-picker]'),preview=composer(p).locator('[data-post-style-preview]');assert.equal(await palette.locator('[role=radio]').count(),6);
 const originalEditor=await composer(p).boundingBox();for(const key of ['gold','blue','mint','lavender','coral','default']){await select(p,key);await expectBorder(preview,key);assert.equal(await preview.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)','day preview remains white');assert.equal(await palette.locator(`[role=radio][data-post-accent="${key}"]`).getAttribute('aria-checked'),'true');}
 if(width===390){await palette.locator('[role=radio][data-post-accent="gold"]').focus();await p.keyboard.press('ArrowRight');await expectBorder(preview,'blue');await p.keyboard.press('Home');await expectBorder(preview,'default');await p.keyboard.press('End');await expectBorder(preview,'coral');}
 const editor=await composer(p).boundingBox();assert.equal(editor.width,originalEditor.width);await h.noOverflow(p,'style palette '+width);
 assert.equal(await row(p,'expired-post').count(),0,'expired styled posts are not resurrected');
 await p.locator('#foro-text').fill('Contenido VIP que permanece intacto');await select(p,'gold');s.failPost=true;await p.locator('#foro-publicar').click();await p.waitForFunction(()=>!document.getElementById('foro-publicar').disabled);assert.equal(s.posts.length,sourceCount);assert.equal(await p.locator('#foro-text').inputValue(),'Contenido VIP que permanece intacto');await expectBorder(preview,'gold');
 s.holdPost=true;await p.locator('#foro-publicar').click();for(let n=0;n<100&&!s.releasePost;n++)await p.waitForTimeout(20);assert(s.releasePost);assert.equal(await p.locator('#foro-publicar').isDisabled(),true);assert.equal(s.posts.length,sourceCount);s.holdPost=false;s.releasePost();await row(p,'style-post-1').waitFor();await expectBorder(row(p,'style-post-1'),'gold');assert.equal(s.postCalls[0].requestId,s.postCalls[1].requestId);assert.equal(s.postCalls[1].style.accent,'gold');
 assert.equal(await row(p,'foreign-vip').locator('[data-post-style-edit]').count(),0,'other authors cannot edit style');
 assert.equal(await row(p,'legacy-post').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
 const stored=s.posts.find(x=>x.id==='style-post-1'),before=structuredClone(stored);await p.locator(`[data-toggle-com="${stored.id}"]`).click();await p.locator('#cominput-'+stored.id).fill('Borrador de comentario que debe conservarse');await row(p,stored.id).locator('[data-post-style-edit]').click();
 let editorPane=p.locator('.post-style-dialog');await editorPane.waitFor();await select(p,'coral',editorPane);if([320,390,768,1440].includes(width))await h.shot(p,'community-style-dialog-'+width,'.post-style-dialog');s.failPatch=true;await editorPane.locator('[data-post-style-save]').click();await p.waitForFunction(()=>!document.querySelector('.post-style-dialog [data-post-style-save]').disabled);assert.equal(s.style(stored.id).style.accent,'gold');await expectBorder(row(p,stored.id),'gold');
 s.holdPatch=true;await editorPane.locator('[data-post-style-save]').click();for(let n=0;n<100&&!s.releasePatch;n++)await p.waitForTimeout(20);assert(s.releasePatch);assert.equal(s.style(stored.id).style.accent,'gold');await expectBorder(row(p,stored.id),'gold');s.holdPatch=false;s.releasePatch();await expectBorder(row(p,stored.id),'coral');assert.equal(s.style(stored.id).styleRevision,1);
 assert.deepEqual({...stored,styleRevision:before.styleRevision},before,'style edit changes neither content, source timestamp, image nor interaction counters');assert.equal(s.events.length,0,'style editing creates no interaction notifications');
 assert.equal(await p.locator('#cominput-'+stored.id).inputValue(),'Borrador de comentario que debe conservarse','style snapshot refresh preserves an open unsent comment');assert.equal(await p.locator('#cominput-'+stored.id).isVisible(),true);
 const other=await h.fixture(width<768?1440:390,s);await setup(other,s,{uid:'fixture-a',vip:true,admin:false});await waitPalette(other.page);await expectBorder(row(other.page,stored.id),'coral');
 if(width===390){await row(p,stored.id).locator('[data-post-style-edit]').click();await p.locator('.post-style-dialog').waitFor();await select(p,'mint',p.locator('.post-style-dialog'));}
 await row(other.page,stored.id).locator('[data-post-style-edit]').click();await other.page.locator('.post-style-dialog').waitFor();await select(other.page,'blue',other.page.locator('.post-style-dialog'));await other.page.locator('.post-style-dialog [data-post-style-save]').click();await expectBorder(row(p,stored.id),'blue');assert.equal(s.style(stored.id).styleRevision,2);assert.equal(stored.createdAtMs,before.createdAtMs);assert.equal(stored.texto,before.texto);
 if(width===390){await p.locator('.post-style-dialog [data-post-style-save]').click();await p.locator('.post-style-dialog [role=alert]').waitFor({state:'visible'});assert.equal(s.style(stored.id).style.accent,'blue');assert.equal(await p.locator('.post-style-dialog [data-post-style-save]').isDisabled(),true,'conflict cannot silently overwrite another session');await p.locator('[data-post-style-cancel]').click();}
 assert.equal(await p.locator('#cominput-'+stored.id).inputValue(),'Borrador de comentario que debe conservarse','another session changing only style preserves the local comment draft');assert.equal(s.comments[stored.id],undefined);
 stored.style={accent:'coral'};stored.styleRevision=999;await s.broadcast();await p.waitForTimeout(100);await expectBorder(row(p,stored.id),'blue');await expectBorder(row(other.page,stored.id),'blue');assert.equal(s.style(stored.id).styleRevision,2,'forged root style/revision cannot replace authoritative server-only style');
 await f.boot();await setup(f,s,{uid:'fixture-a',vip:true,admin:false});await waitPalette(p);await expectBorder(row(p,stored.id),'blue');
 if(width===390){s.holdExact=stored.id;await row(p,stored.id).locator('[data-post-style-edit]').click();for(let n=0;n<100&&!s.releaseExact;n++)await p.waitForTimeout(20);assert(s.releaseExact);await p.evaluate(()=>navigateToSection('directorio-actividad',{profileUid:'fixture-a'}));await p.locator('[data-professional-activity]').waitFor();s.holdExact=null;s.releaseExact();await p.waitForTimeout(100);assert.equal(await p.locator('.post-style-dialog').count(),0,'a late editor GET cannot open a modal after leaving the community');}
 await p.evaluate(()=>navigateToSection('directorio-actividad',{profileUid:'fixture-a'}));await p.locator(`[data-activity-post="${stored.id}"]`).waitFor();await expectBorder(p.locator(`[data-activity-post="${stored.id}"]`),'blue');await p.locator(`[data-activity-post="${stored.id}"] [data-activity-open]`).click();await p.locator('.post.is-notification-target').waitFor();await expectBorder(row(p,stored.id),'blue');
 await h.noOverflow(p,'persisted post style '+width);if([320,390,768,1440].includes(width))await centeredShot(p,'community-style-published-'+width,`[data-post="${stored.id}"]`);
 await setup(f,s,{uid:'fixture-a',vip:false,admin:true});await p.waitForTimeout(90);assert.equal(await composer(p).locator('[data-post-style-picker]').count(),0,'administrator without active VIP does not receive style entitlement');assert.equal(await row(p,stored.id).locator('[data-post-style-edit]').count(),0);await expectBorder(row(p,stored.id),'blue','existing style survives membership expiry');assert.equal(await p.locator('#foro-publicar').isVisible(),true);
 await setup(other,s,{uid:'free-user',vip:false,admin:false});await other.page.waitForTimeout(90);assert.equal(await composer(other.page).locator('[data-post-style-picker]').count(),0);assert.equal(await row(other.page,stored.id).locator('[data-post-style-edit]').count(),0);await other.page.locator('#foro-text').fill('Publicación gratuita predeterminada');await other.page.locator('#foro-publicar').click();await row(other.page,'style-post-2').waitFor();assert.equal(s.style('style-post-2').style.accent,'default');
 await other.page.locator(`[data-like="${stored.id}"]`).click();await other.page.waitForFunction(id=>document.querySelector(`[data-like="${id}"]`).getAttribute('aria-pressed')==='true',stored.id);await other.page.locator(`[data-toggle-com="${stored.id}"]`).click();await other.page.locator('#cominput-'+stored.id).fill('Comentario gratuito conservado');await other.page.locator(`[data-com-send="${stored.id}"]`).click();for(let n=0;n<100&&stored.comentariosCount!==1;n++)await other.page.waitForTimeout(20);assert.equal(stored.comentariosCount,1);
 await setup(f,s,{uid:'fixture-a',vip:true,admin:true});await waitPalette(p);await p.locator('#foro-text').fill('Vista previa VIP');await select(p,'lavender');await expectBorder(composer(p).locator('[data-post-style-preview]'),'lavender');if([320,390,768,1440].includes(width))await centeredShot(p,'community-style-preview-'+width,'.foro-composer');await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>document.documentElement.dataset.theme='night');await h.noOverflow(p,'dark post style '+width);if([320,390,768,1440].includes(width))await centeredShot(p,'community-style-preview-night-'+width,'.foro-composer');
 const controls=await palette.locator('[role=radio]').evaluateAll(ns=>ns.map(n=>({name:n.getAttribute('aria-label')||n.title||n.textContent,pressed:n.getAttribute('aria-checked'),r:{left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,height:n.getBoundingClientRect().height}})));for(const c of controls){assert(c.name.trim());assert(['true','false'].includes(c.pressed));assert(c.r.left>=0&&c.r.right<=width+1);assert(c.r.height>=24);}
 await f.context.close();await other.context.close();console.log('PASS post-style '+width+' '+(process.env.ICADEM_TEST_ENGINE||'chrome'));
}
(async()=>{try{await h.start();for(const width of (process.env.ICADEM_PRIORITY_WIDTHS||'320,360,375,390,414,768,1024,1440').split(',').map(Number))await scenario(width);}finally{await h.stop();}})().catch(error=>{console.error(error);process.exitCode=1;});
