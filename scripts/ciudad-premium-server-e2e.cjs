'use strict';
// Real LOCAL WebSocket server + file storage. The browser uses the complete game/UI.
// One 3D world at a time; the second player is a Node socket observer, not another renderer.
// No Railway, Firebase, production account, real credit wallet or external request is used.
// Usage: node scripts/ciudad-premium-server-e2e.cjs http://127.0.0.1:STATIC_PORT [playwrightModule] [outputDirectory]
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..'),BASE=(process.argv[2]||'http://127.0.0.1:59562').replace(/\/$/,''),OUT=process.argv[4];
const pw=require(process.argv[3]||path.resolve(ROOT,'../unlocks-ui-tools/node_modules/playwright'));
const {WebSocket}=require(require.resolve('ws',{paths:[path.join(ROOT,'_ciudad-server')]}));
const GL=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'];
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'ciudad-premium-server-'));
const UID='avatar-ui-pilot',SERVER_UID='dev-'+UID,records=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label,timeout=30000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{if(await check())return;}catch(error){last=error;}await delay(150);}throw new Error(label+(last?' — '+last.message:''));}
function pass(name,details){records.push({name,pass:true,...(details?{details}:{})});console.log('PASS '+name+(details?' '+JSON.stringify(details):''));}
const appearance=p=>({avatar:p.avatarId,chosen:p.avatarChosen,custom:{...p.custom},xp:p.xp,testCredits:p.testCredits,missions:structuredClone(p.missions)});
let app,browser,context,page,observer,createServer,JsonFileStorage,port;

async function localServer(){app=createServer({host:'127.0.0.1',port:0,devLogin:true,storage:new JsonFileStorage(DATA),maxPlayers:8});port=await app.listen();return port;}
async function observe(uid,name){
 const response=await fetch('http://127.0.0.1:'+port+'/dev/ticket',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uid,name})});assert.equal(response.status,200);
 const {ticket}=await response.json(),socket=new WebSocket('ws://127.0.0.1:'+port,{origin:new URL(BASE).origin}),messages=[],roster=new Map();let welcomed=false;
 socket.on('message',raw=>{let m;try{m=JSON.parse(String(raw));}catch(_){return;}messages.push(m);if(m.t==='welcome'){welcomed=true;for(const p of m.roster||[])roster.set(p.pid,p);}if(m.t==='join')roster.set(m.pid,m);if(m.t==='look')roster.set(m.pid,{...roster.get(m.pid),...m});if(m.t==='leave'&&!m.soft)roster.delete(m.pid);});socket.on('error',()=>{});
 socket.on('open',()=>socket.send(JSON.stringify({t:'hello',ticket})));
 await until(()=>welcomed,'Node observer receives an authenticated welcome');return {socket,messages,roster};
}
async function openGame(){
 context=await browser.newContext({viewport:{width:640,height:680},serviceWorkers:'block'});page=await context.newPage();page.errs=[];
 page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>page.errs.push(e.message));
 const allowed=new Set([new URL(BASE).origin,'http://127.0.0.1:'+port]);
 await context.route('**/*',route=>allowed.has(new URL(route.request().url()).origin)?route.continue():route.abort());
 const url=new URL(BASE+'/ciudad/index.html');for(const [key,value]of Object.entries({autostart:'1',debug:'1',scene:'plaza',mp:'ws://127.0.0.1:'+port,uid:UID,name:'Ana UI'}))url.searchParams.set(key,value);
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__ciudad?.api?.net?.isOnline&&window.__ciudad.api.store.state.synced);
 // Keep the actual renderer and preview; pause the full world while operating its modal.
 await page.evaluate(()=>{const a=window.__ciudad.api;a.engine.renderer.setPixelRatio(.25);a.engine.stop();a.store.state.settings.npcQuiz=false;window.__avatarServerReplies=[];a.net.on('profile',m=>{if(m.op==='avatar')window.__avatarServerReplies.push({ok:m.ok,reason:m.reason,avatar:m.profile?.avatarId,rev:m.profile?.rev});});});
 await page.waitForFunction(()=>document.getElementById('splash').hidden);
 return page;
}
async function retireGame(){
 if(!context)return;const previous=context;context=null;
 if(page&&!page.isClosed()){
  // Closing the modal disposes its preview targets before the world renderer is released.
  await page.evaluate(()=>{const a=window.__ciudad?.api;if(!a)return;if(!document.getElementById('modal').hidden)document.getElementById('modal-x').click();a.engine.stop();a.net.disconnect();a.engine.renderer.dispose();});
  await page.goto('about:blank',{waitUntil:'domcontentloaded',timeout:15000});
 }
 await previous.close();page=null;
}
async function shot(name){if(!OUT)return;fs.mkdirSync(OUT,{recursive:true});await page.screenshot({path:path.join(OUT,name+'.png'),timeout:20000});}

(async()=>{
 try{
  ({createServer}=await import(pathToFileURL(path.join(ROOT,'_ciudad-server/server.js')).href));({JsonFileStorage}=await import(pathToFileURL(path.join(ROOT,'_ciudad-server/profiles.js')).href));
  await localServer();browser=await pw.chromium.launch({channel:'chrome',headless:true,args:GL});
  await openGame();await page.locator('.vest.is-first .vcard').first().waitFor();assert.equal(await page.locator('.vcard').count(),7);assert.equal(await page.locator('.vcard.is-locked').count(),0);pass('Local authenticated first entry exposes only seven free characters');
  await page.locator('.vcard[data-id="creativa"]').click();await page.locator('#modal-actions .btn--primary').click();await page.locator('#modal').waitFor({state:'hidden'});
  await until(async()=>{const p=await app.profiles.get(SERVER_UID);return p.avatarId==='creativa'&&p.avatarChosen;},'server persists the UI character choice');const saved=appearance(await app.profiles.get(SERVER_UID));pass('Character selected through UI is persisted by the real local server',saved);
  observer=await observe('avatar-ui-observer','Beto socket');await until(()=>[...observer.roster.values()].some(p=>p.name==='Ana UI'&&p.avatar==='creativa'),'observer sees the chosen character');pass('Independent Node WebSocket observer receives the real roster appearance');
  const repliesBefore=await page.evaluate(()=>window.__avatarServerReplies.length);
  await page.evaluate(()=>{const a=window.__ciudad.api;a.store.state.xp=99999;a.setAvatar('leyenda',a.store.state.custom);});   // manipulación por el camino real del cliente (desde #70 las respuestas sin número de solicitud se ignoran)
  await page.waitForFunction(before=>window.__avatarServerReplies.slice(before).some(m=>m.ok===false&&m.reason==='avatar-bloqueado'),repliesBefore);
  await page.waitForFunction(()=>window.__ciudad.api.store.state.avatarId==='creativa'&&window.__ciudad.api.store.state.xp<99999);
  const rejected=appearance(await app.profiles.get(SERVER_UID));assert.deepEqual(rejected,saved);assert([...observer.roster.values()].some(p=>p.name==='Ana UI'&&p.avatar==='creativa'));pass('Manipulated client XP cannot equip a locked skin; server and observer retain the allowed appearance');
  await page.evaluate(()=>{window.__ciudad.api.ui.openWardrobe();});await page.locator('#modal:not([hidden]) .vest--studio').waitFor();
  await page.locator('.vest__cats button').nth(2).click();assert.equal(await page.locator('.vcard.is-locked').count(),6);await page.locator('.vcard[data-id="leyenda"]').click();assert.match(await page.locator('.vest__status').innerText(),/Llega al nivel 10/);assert.equal(await page.locator('#modal-actions [data-action="equip"]').isEnabled(),false);pass('Locked skins remain previewable with authoritative requirements and no enabled equip action');
  await page.locator('.vest__tabs button[data-id="estilo"]').click();
  for(const [key,id]of [['outfit','sol'],['hat','cap'],['tone','t5']]){
   await page.locator('[data-'+key+'="'+id+'"]').click();await page.locator('#modal-actions [data-action="equip"]').click();await until(async()=>(await app.profiles.get(SERVER_UID)).custom[key]===id,'server confirms UI style '+key);await page.waitForFunction(({key,id})=>window.__ciudad.api.store.state.custom[key]===id,{key,id});
  }
  const styled=appearance(await app.profiles.get(SERVER_UID));assert.deepEqual(styled.custom,{outfit:'sol',hat:'cap',tone:'t5'});assert.equal(styled.xp,saved.xp);assert.equal(styled.testCredits,saved.testCredits);assert.deepEqual(styled.missions,saved.missions);pass('Real server confirms UI outfit, hat and tone without changing XP, missions or test credits',styled);
  await until(()=>[...observer.roster.values()].some(p=>p.name==='Ana UI'&&p.avatar==='creativa'&&p.custom?.outfit==='sol'&&p.custom?.hat==='cap'&&p.custom?.tone==='t5'),'observer sees the saved style');pass('Independent socket receives the confirmed appearance update');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.vest__style img')).every(n=>n.src.startsWith('data:image/')&&n.complete&&n.naturalWidth>0));await shot('local-server-avatar-style');assert.deepEqual(page.errs,[]);pass('No JavaScript errors while using the real local server');
  await retireGame();observer.socket.terminate();observer=null;await app.close();app=null;
  // Restart with a new Profiles/Hub and a new file-storage adapter. This ensures the
  // next session is recovered from disk, not the browser or a process memory copy.
  await localServer();assert.deepEqual(appearance(await app.profiles.get(SERVER_UID)),styled);pass('A restarted local server recovers the same persisted file profile');
  await openGame();await page.waitForFunction(()=>window.__ciudad.api.store.state.avatarChosen===true);assert.equal(await page.locator('.vest.is-first:visible').count(),0,'fresh browser context does not repeat first-time selection');
  const fresh=await page.evaluate(()=>{const s=window.__ciudad.api.store.state;return {avatar:s.avatarId,custom:{...s.custom},xp:s.xp,testCredits:s.economy.balance};});assert.equal(fresh.avatar,styled.avatar);assert.deepEqual(fresh.custom,styled.custom);assert.equal(fresh.xp,styled.xp);assert.equal(fresh.testCredits,styled.testCredits);assert.deepEqual(page.errs,[]);pass('A second independent browser context recovers appearance without a repeated picker',fresh);
  await page.evaluate(()=>{window.__ciudad.api.ui.openWardrobe();});await page.locator('#modal:not([hidden]) .vest--studio').waitFor();assert.match(await page.locator('.vest__name').innerText(),/Creativa/);assert.equal(await page.locator('.vcard.is-worn').getAttribute('data-id'),'creativa');await shot('local-server-restored-avatar');pass('Reopened Avatar Studio marks the persisted character as equipped');
  if(OUT){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'ciudad-premium-server-metrics.json'),JSON.stringify({mode:'real-local-server-json-storage',production:false,one3DWorldAtATime:true,observer:'Node WebSocket; no second rendered world',records},null,2));}
 }finally{
  await retireGame();observer?.socket.terminate();await browser?.close();await app?.close();
  // Only the newly-created synthetic storage directory is removed. Never a repository/user directory.
  const tempRoot=path.resolve(os.tmpdir()),target=path.resolve(DATA);assert(target.startsWith(tempRoot+path.sep)&&path.basename(target).startsWith('ciudad-premium-server-'));
  for(const name of fs.readdirSync(target)){const file=path.join(target,name);assert(fs.statSync(file).isFile());fs.unlinkSync(file);}fs.rmdirSync(target);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
