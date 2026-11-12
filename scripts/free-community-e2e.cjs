'use strict';
// Real panel code, synthetic HTTP/Firestore snapshots only. Never reaches production.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,noOverflow,shot,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=process.env.ICADEM_TEST_ENGINE==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
function backend(){
 const s={data:h.initial(),actors:new Map(),posts:[],comments:{},receipts:new Map(),events:[],postCalls:[],failPost:false,holdPost:false,release:null,next:0};
 const headers={'Access-Control-Allow-Origin':'*'};const actor=page=>s.actors.get(page)||{uid:'fixture-a',vip:false};
 const identity=uid=>({uid,nombre:uid==='fixture-a'?'Profesional gratuito':'Profesional VIP de prueba',iniciales:'PP',foto:'/assets/juegos/foto-fiscal.webp',photoVersion:'1'});
 s.broadcast=async()=>{for(const p of s.actors.keys())if(!p.isClosed())await p.evaluate(data=>window.__emitCommunity?.(data),{posts:s.posts,comments:s.comments});};
 s.notify=(uid,id,tipo,pid,cid)=>{if(!s.events.some(n=>n.id==='personal-'+id)){const at=Date.now();s.events.push({owner:uid,id:'personal-'+id,serverId:id,source:'personal',personal:true,tipo,titulo:'Nueva interacción',descripcion:'Actividad en Comunidad ICADEM',icono:'i-messages',color:'#315b63',createdAtMs:at,expiresAtMs:at+15*86400000,read:false,seen:false,target:{section:'foro',postId:pid,...(cid?{commentId:cid}:{})}});}};
 s.handle=async(route,url)=>{
  const req=route.request(),p=url.pathname,a=actor(req.frame().page()),body=req.method()==='POST'?req.postDataJSON():null;
  if(p==='/api/community/authors'){const ids=decodeURIComponent(url.searchParams.get('uids')||'').split(',');await route.fulfill({json:{ok:true,authors:ids.map(identity)},headers});return true;}
  if(p==='/api/notifications'){await route.fulfill({json:{ok:true,items:s.events.filter(n=>n.owner===a.uid),serverNowMs:Date.now(),retentionDays:15,preferences:{forumActivity:true,forumNews:false},forumAvailable:true},headers});return true;}
  if(p.startsWith('/api/notifications/')){for(const item of body?.items||[]){const n=s.events.find(n=>n.owner===a.uid&&n.serverId===item.id);if(n){if(p.endsWith('/seen'))n.seen=true;else if(p.endsWith('/read')){n.read=true;n.seen=true;}else if(p.endsWith('/dismiss'))s.events=s.events.filter(x=>x!==n);}}await route.fulfill({json:{ok:true},headers});return true;}
  if(p==='/api/forum/posts'&&body){
   s.postCalls.push(structuredClone(body));if(s.holdPost)await new Promise(resolve=>s.release=resolve);
   if(s.failPost){s.failPost=false;await route.fulfill({status:503,json:{error:'No se confirmó la publicación'},headers});return true;}
   const key=a.uid+':'+body.requestId;let id=s.receipts.get(key);if(!id){id='real-post-'+ ++s.next;s.receipts.set(key,id);s.posts.unshift({...identity(a.uid),id,texto:body.texto,imagen:body.imagen,esVip:a.vip,esAdmin:false,createdAtMs:Date.now(),likes:0,likedBy:{},comentariosCount:0});}
   await route.fulfill({status:201,json:{ok:true,postId:id},headers});await s.broadcast();return true;
  }
  const m=p.match(/^\/api\/forum\/posts\/([A-Za-z0-9_-]+)(?:\/(like|comments))?$/);
  if(m){const post=s.posts.find(n=>n.id===m[1]);if(!post){await route.fulfill({status:404,json:{error:'Publicación no disponible'},headers});return true;}
   if(req.method()==='GET'){await route.fulfill({json:{ok:true,post:{...post,likedBy:post.likedBy[a.uid]?{[a.uid]:true}:{}}},headers});return true;}
   if(m[2]==='like'){const changed=post.likedBy[a.uid]!==body.liked;if(body.liked)post.likedBy[a.uid]=true;else delete post.likedBy[a.uid];post.likes=Object.values(post.likedBy).filter(Boolean).length;if(changed&&body.liked&&post.uid!==a.uid)s.notify(post.uid,'reaction-'+post.id+'-'+a.uid,'forum_reaction',post.id);await route.fulfill({json:{ok:true,liked:body.liked,likes:post.likes},headers});await s.broadcast();return true;}
   if(m[2]==='comments'){const key=post.id+':'+a.uid+':'+body.requestId;let cid=s.receipts.get(key);if(!cid){cid='comment-'+ ++s.next;s.receipts.set(key,cid);(s.comments[post.id]||=[]).push({...identity(a.uid),id:cid,texto:body.texto,createdAtMs:Date.now(),esVip:a.vip,esAdmin:false});post.comentariosCount=s.comments[post.id].length;if(post.uid!==a.uid)s.notify(post.uid,cid,'forum_comment',post.id,cid);}await route.fulfill({status:201,json:{ok:true,commentId:cid},headers});await s.broadcast();return true;}
  }
  if(p.startsWith('/api/community/profiles/')){const uid=p.split('/').pop();await route.fulfill({json:{ok:true,profile:{...identity(uid),own:uid===a.uid,isVip:false,connection:uid===a.uid?'self':'none',cv:{resumen:'Perfil de prueba'}}},headers});return true;}
  if(p==='/api/community/connections'){await route.fulfill({json:{ok:true,received:[],sent:[],connected:[]},headers});return true;}
  return false;
 };return s;
}
async function setup(f,s,{uid,vip}){
 s.actors.set(f.page,{uid,vip});await f.page.evaluate(({uid,vip})=>{
  window.__currentUser={uid,getIdToken:()=>Promise.resolve('synthetic-session-only')};window.__auth={currentUser:window.__currentUser};Object.assign(window.UserState,{uid,modo:vip?'vip':'free',isAdmin:false,identityReady:true});
  const listeners=new Set();let data={posts:[],comments:{}};
  const emitEntry=entry=>{const records=entry.path==='posts'?data.posts:(data.comments[entry.path.split('/')[1]]||[]);const docs=records.map(item=>({id:item.id,data:()=>({...item,createdAt:{toDate:()=>new Date(item.createdAtMs)}})}));entry.next({empty:!docs.length,docs,forEach:fn=>docs.forEach(fn)});};const emit=()=>{for(const entry of [...listeners])emitEntry(entry);};
  window.__emitCommunity=value=>{data=value;emit();};
  window.__fs={db:{},collection:(_db,...parts)=>({path:parts.join('/')}),query:ref=>ref,orderBy:()=>null,limit:()=>null,onSnapshot(ref,next){const entry={path:ref.path,next};listeners.add(entry);queueMicrotask(()=>emitEntry(entry));return()=>listeners.delete(entry);}};
  navigateToSection('foro');ICADEMNotifications.start();
 },{uid,vip});await s.broadcast();await f.page.waitForSelector('#foro-text');
}
async function syncNotices(f){await f.page.evaluate(()=>ICADEMNotifications.sync());await f.page.waitForTimeout(70);}
async function scenario(width){
 const s=backend(),free=await h.fixture(width,s),p=free.page;await setup(free,s,{uid:'fixture-a',vip:false});
 assert.equal(await p.getByRole('heading',{name:'Comunidad ICADEM',exact:true}).count(),1);assert.equal(await p.locator('.foro-paywall').count(),0);assert.equal(await p.locator('#foro-add-img').isVisible(),true);
 await p.locator('#foro-text').fill('Aportación gratuita con imagen');const image=fs.readFileSync(path.join(__dirname,'../assets/juegos/foto-fiscal.webp'));await p.locator('#foro-file').setInputFiles({name:'example.webp',mimeType:'image/webp',buffer:image});await p.waitForFunction(()=>document.getElementById('foro-img-preview').style.display==='block'&&!document.getElementById('foro-publicar').disabled);
 s.failPost=true;await p.locator('#foro-publicar').click();await p.waitForFunction(()=>!document.getElementById('foro-publicar').disabled);assert.equal(s.posts.length,0);assert.equal(await p.locator('#foro-text').inputValue(),'Aportación gratuita con imagen');assert.equal(await p.locator('#foro-img-preview').isVisible(),true);
 s.holdPost=true;await p.locator('#foro-publicar').click();for(let n=0;n<100&&!s.release;n++)await p.waitForTimeout(20);assert(s.release);assert.equal(await p.locator('#foro-publicar').isDisabled(),true);assert.equal(s.posts.length,0,'no success before backend acknowledgment');s.holdPost=false;s.release();await p.waitForSelector('[data-post="real-post-1"]');
 assert.equal(s.postCalls[0].requestId,s.postCalls[1].requestId,'failed request retries retain operation identity');assert(s.posts[0].imagen.startsWith('data:image/jpeg;base64,'));assert.equal(s.posts[0].uid,'fixture-a');assert.equal(s.posts[0].esVip,false);assert.equal(await p.locator('[data-post="real-post-1"] .post__role').textContent(),'Miembro');assert.equal(await p.locator('#foro-text').inputValue(),'');
 const other=await h.fixture(width<768?1440:390,s);await setup(other,s,{uid:'fixture-b',vip:false});await other.page.waitForSelector('[data-post="real-post-1"]');await other.page.locator('[data-like="real-post-1"]').click();await other.page.waitForFunction(()=>document.querySelector('[data-like="real-post-1"]').getAttribute('aria-pressed')==='true');assert.equal(s.posts[0].likes,1);assert.equal(await p.locator('[data-like="real-post-1"] span').innerText(),'1');
 await other.page.locator('[data-toggle-com="real-post-1"]').click();await other.page.locator('#cominput-real-post-1').fill('Comentario de otra cuenta gratuita');await other.page.locator('[data-com-send="real-post-1"]').click();for(let n=0;n<100&&s.posts[0].comentariosCount!==1;n++)await other.page.waitForTimeout(20);assert.equal(s.posts[0].comentariosCount,1);await other.page.waitForTimeout(80);if(!await other.page.locator('#cominput-real-post-1').isVisible())await other.page.locator('[data-toggle-com="real-post-1"]').click();await other.page.getByText('Comentario de otra cuenta gratuita',{exact:true}).waitFor();await syncNotices(free);assert.equal(s.events.filter(n=>n.owner==='fixture-a').length,2);assert.equal(await p.locator('#btn-notif .notif-count').innerText(),'2');
 await p.evaluate(()=>navigateToSection('cursos'));await p.evaluate(()=>navigateToSection('foro'));await s.broadcast();await p.waitForSelector('[data-post="real-post-1"]');assert.equal(await p.locator('[data-like="real-post-1"] span').innerText(),'1');assert.equal(s.posts.length,1);assert.equal(s.comments['real-post-1'].length,1);
 await p.locator('[data-foro-author="fixture-a"]').first().click();await p.waitForSelector('[data-professional-view]');assert.equal(new URL(p.url()).searchParams.get('profesional'),'fixture-a');await p.goBack();await p.waitForSelector('#foro-text');await s.broadcast();
 await h.noOverflow(p,'free community '+width);await h.shot(p,'community-free-'+width);
 await setup(other,s,{uid:'fixture-b',vip:true});await other.page.locator('#foro-text').fill('Aportación VIP');await other.page.locator('#foro-publicar').click();await other.page.waitForSelector('[data-post="real-post-3"]');assert.equal(s.posts[0].esVip,true);assert.equal(await other.page.locator('[data-post="real-post-3"] .post__role').innerText(),'VIP');assert.equal(s.posts.some(n=>n.id==='real-post-1'),true,'existing publication remains');
 await free.context.close();await other.context.close();console.log('PASS free/community/VIP '+width+' '+(process.env.ICADEM_TEST_ENGINE||'chrome'));
}
(async()=>{try{await h.start();for(const width of (process.env.ICADEM_PRIORITY_WIDTHS||'390,1440').split(',').map(Number))await scenario(width);}finally{await h.stop();}})().catch(error=>{console.error(error);process.exitCode=1;});
