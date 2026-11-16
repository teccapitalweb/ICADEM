'use strict';
// Real local WebSocket server, temporary MemoryStorage accounts and actual UI.
// Software-rendered previews; background world loop/auto-rotation paused only
// in this test's HTTP responses. No production credentials or physical devices.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..'),pw=require(process.argv[2]),OUT=path.resolve(process.argv[3]);
const records=[],fatal=[],sockets=[],sizes=[{width:390,height:844},{width:320,height:740},{width:768,height:1024},{width:1440,height:1000}];
const wait=ms=>new Promise(r=>setTimeout(r,ms)),load=file=>import(pathToFileURL(path.join(ROOT,file)).href);
let app,browser,context,page,base,port,storage;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const staticServer=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname,file=path.resolve(ROOT,'.'+name);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});if(!err&&name==='/ciudad/js/main.js')data=Buffer.from(data.toString().replace('  engine.start();','  engine.renderer.setPixelRatio(.25); // UI test: world paused before first frame.'));if(!err&&name==='/ciudad/js/ui/preview.js')data=Buffer.from(data.toString()+'\nconst qaShow=AvatarPreview.prototype.show;AvatarPreview.prototype.start=function(){};AvatarPreview.prototype.show=function(look){qaShow.call(this,look);this.avatar.group.rotation.y=.45;this.draw();};\n');res.end(err?'missing':data);});});
async function open(size,uid='premium-ui',scene='plaza'){
 context=await browser.newContext({viewport:size,hasTouch:size.width<1024,isMobile:size.width<600,serviceWorkers:'block',reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>{fatal.push(e.message);console.error(e.stack);});
 await context.route('**/*',r=>[base,'http://127.0.0.1:'+port].includes(new URL(r.request().url()).origin)?r.continue():r.abort());
 await page.goto(`${base}/ciudad/index.html?debug=1&autostart=1&tutorial=0&avatar=0&uid=${uid}&name=Premium&scene=${scene}&mp=ws://127.0.0.1:${port}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__ciudad?.api.net.isOnline&&window.__ciudad.api.store.state.vivo&&document.getElementById('splash').hidden);
 await page.evaluate(()=>{const a=window.__ciudad.api;a.engine.stop();a.store.state.settings.npcQuiz=false;});
}
async function retire(){if(!context)return;await page.evaluate(()=>{const a=window.__ciudad?.api;a?.engine.stop();a?.net.disconnect();if(!document.getElementById('modal').hidden)document.getElementById('modal-x').click();a?.engine.renderer.dispose();});await context.close();context=null;}
async function modalClose(){if(await page.locator('#modal').isVisible()){
 // Exercise a real pointer gesture. The software GPU can delay successive RAFs
 // used by locator's stability heuristic; verify geometry and the hit target.
 const b=await page.locator('#modal-x').boundingBox();assert(b&&b.width>=44&&b.height>=44);
 const point={x:b.x+b.width/2,y:b.y+b.height/2};assert(await page.evaluate(p=>document.getElementById('modal-x').contains(document.elementFromPoint(p.x,p.y)),point),'close button is the actual pointer target');
 if(page.viewportSize().width<1024)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
 await page.locator('#modal').waitFor({state:'hidden'});
}}
async function action(expression,arg){await page.evaluate(expression,arg);try{await page.locator('#modal:not([hidden])').waitFor();}catch(error){console.error(await page.evaluate(()=>({dialog:document.getElementById('dialog').textContent,dialogHidden:document.getElementById('dialog').hidden,blocking:window.__ciudad.api.ui.isBlocking,modal:document.getElementById('modal-body').textContent})));throw error;}}
async function checkLayout(name){
 if(name==='studio')await page.waitForFunction(()=>[...document.querySelectorAll('.vest img')].every(i=>Boolean(i.getAttribute('src'))),null,{timeout:60000});
 await wait(80);
 const r=await page.evaluate(()=>{const card=document.querySelector('#modal:not([hidden]) .modal__card')||document.querySelector('.hed'),body=document.getElementById('modal-body'),b=card.getBoundingClientRect();return{width:innerWidth,height:innerHeight,doc:document.documentElement.scrollWidth,box:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},body:body?.clientWidth,scroll:body?.scrollWidth,targets:[...card.querySelectorAll('button,input,select,summary')].filter(n=>n.getClientRects().length&&!n.closest('[hidden]')&&!n.disabled).map(n=>{const b=n.getBoundingClientRect();return{text:n.getAttribute('aria-label')||n.textContent.trim(),w:b.width,h:b.height};})};});
 await page.screenshot({path:path.join(OUT,name+'-'+r.width+'.png'),animations:'disabled'});
 assert(r.doc<=r.width+1,name+' document overflow '+JSON.stringify(r));assert(r.box.left>=-1&&r.box.right<=r.width+1&&r.box.top>=-1&&r.box.bottom<=r.height+1,name+' bounds '+JSON.stringify(r.box));
 if(!name.startsWith('home'))assert(r.scroll<=r.body+1,name+' body overflow '+JSON.stringify(r));
 for(const t of r.targets)assert(t.w>=43.5&&t.h>=43.5,name+' touch target '+JSON.stringify(t));
 await page.screenshot({path:path.join(OUT,name+'-'+r.width+'.png'),animations:'disabled'});records.push({name,...r});
}
async function seed(uid){const p=await app.profiles.get('dev-'+uid);p.avatarChosen=true;p.avatarId='universitaria';p.tutorialDone=true;p.xp=6500;p.coins=10000;p.chat={adultAt:Date.now(),off:false,blocked:[]};await storage.save('dev-'+uid,p);}
async function profile(){return app.profiles.get('dev-premium-ui');}
async function sendPosition(){await page.evaluate(async()=>{const a=window.__ciudad.api,p=a.player.position,{encodeState}=await import('./js/net/network.js');a.net.sendState(encodeState({scene:a.sceneName,x:p.x,y:p.y,z:p.z,yaw:a.player.yaw||0,anim:'idle'}));});await wait(80);}
async function actualFlows(){
 console.log('REAL PETS');await action(()=>{window.__ciudad.api.actions.pets('adoptar');});
 await page.locator('.vp__breeds .vp__card').filter({hasText:'Mestizo negro'}).click();await page.getByLabel('Nombre de la nueva mascota',{exact:true}).fill('Luna');
 await page.getByRole('button',{name:'Adoptar gratis',exact:true}).click();await page.waitForFunction(()=>window.__ciudad.api.vivo.state.pets.some(p=>p.name==='Luna'));
 const beforeAcc=await profile();await page.locator('.vp__slot').filter({hasText:'Correa'}).getByRole('button',{name:'Correa básica',exact:true}).click();assert.deepEqual((await profile()).pets[0].acc,beforeAcc.pets[0].acc,'accessory preview does not save');
 await page.getByRole('button',{name:'Guardar accesorios',exact:true}).click();await page.waitForFunction(()=>window.__ciudad.api.vivo.activePet?.acc.leash==='correa-basica');
 await page.getByRole('button',{name:'Salir a pasear con correa',exact:true}).click();await page.waitForFunction(()=>window.__ciudad.api.vivo.leash);await checkLayout('pet-owned');await modalClose();
 console.log('REAL SHOP');await action(()=>{window.__ciudad.api.actions.shop('ropa');});
 const item=await page.evaluate(()=>window.__ciudad.api.vivo.shop('ropa').find(i=>!i.owned&&i.affordable));assert(item);
 const coins=(await profile()).coins;
 await page.locator('.vp__product').filter({hasText:item.name}).getByRole('button',{name:'Comprar',exact:true}).click();assert.equal((await profile()).coins,coins,'opening a confirmation never charges');
 await page.locator('.vp__block').getByRole('button',{name:/Confirmar ·/}).click();await page.waitForFunction(id=>Boolean(window.__ciudad.api.vivo.state.inv[id]),item.id);assert.equal((await profile()).coins,coins-item.price);await checkLayout('shop-purchased');await modalClose();
 await action(()=>{window.__ciudad.api.actions.inventory();});assert(await page.locator('.vp__inventoryrow').filter({hasText:item.name}).count());await checkLayout('inventory-confirmed');await modalClose();
 // Accepted chat in the local test server; no production identity is involved.
 await sendPosition();await page.evaluate(()=>window.__ciudad.api.chat.toggle(true));await page.locator('#chat-input').fill('Prueba local de integración');await page.locator('.chat__send').click();await page.waitForFunction(()=>document.querySelector('.chat__notice').textContent.includes('enviado'));
 assert(await page.locator('.chat__log').textContent().then(t=>t.includes('Prueba local de integración')));await page.evaluate(()=>{const c=window.__ciudad.api.chat;c.toggle(true);c.input.value='Borrador para después del juego';c.input.focus();});
 // Three actual field-game starts and tracker changes; normal server authority.
 console.log('REAL FIELD HUD');for(const id of ['manzanas','guardianes','expedicion']){
  const {FIELD_GAMES}=await load('ciudad/js/edu/field-games.js');
  if(FIELD_GAMES?.[id])await page.evaluate(scene=>window.__ciudad.api.games.goTo(scene),FIELD_GAMES[id].scene);
  await sendPosition();await page.evaluate(id=>{window.__ciudad.api.vivoGames.field(id);},id);await page.waitForFunction(id=>window.__ciudad.api.vivoGames.run?.id===id,id);
  assert.equal(await page.locator('#chat').isVisible(),false);assert.equal(await page.locator('#btn-chat').isVisible(),false);assert.equal(await page.locator('#tracker').isVisible(),true);
  assert.equal(await page.locator('#chat-input').inputValue(),'Borrador para después del juego');
  await page.screenshot({path:path.join(OUT,'field-'+id+'.png'),animations:'disabled'});
  await page.evaluate(()=>{window.__ciudad.api.vivoGames.quit(true);});for(let i=0;i<32&&await page.locator('#dialog').isVisible();i++)await page.locator('#dialog-next').click();await modalClose();
 }
 await page.evaluate(()=>window.__ciudad.api.chat.toggle(true));assert.equal(await page.locator('#chat-input').inputValue(),'Borrador para después del juego');await page.evaluate(()=>window.__ciudad.api.chat.toggle(false));
 // Complete each of the six choice games using its actual generated tasks/UI.
 for(const id of ['heroes','rescate','veterinarios','mercado','agua','emociones']){
  console.log('REAL GAME '+id);const previous=(await profile()).play.act[id]?.plays||0;
  const difficulty=await page.evaluate(async id=>{const {GAME_LIST}=await import('./js/edu/games.js');const level=GAME_LIST.find(g=>g.id===id).levels?.[0]?.[0];window.__ciudad.api.games.launch(id);return level;},id);
  if(difficulty)await page.locator('#choice .choice__opt').first().click();await page.locator('.vg').waitFor();
  await checkLayout('game-'+id);
  const total=await page.evaluate(()=>window.__ciudad.api.vivoGames.current.content.tasks.length);
  for(let t=0;t<total;t++){
   const c=await page.evaluate(t=>{const opts=window.__ciudad.api.vivoGames.current.content.tasks[t].options;return opts.findIndex(o=>o.value===Math.max(...opts.map(x=>x.value)));},t);
   await page.locator('.vg__opts button').nth(c).click();await page.locator('.vg__task > .btn--primary').click();
  }
  for(let n=0;n<80&&((await profile()).play.act[id]?.plays||0)===previous;n++)await wait(100);
  assert.equal((await profile()).play.act[id].plays,previous+1,id+' stored server progress');await page.locator('#modal:not([hidden])').waitFor();await modalClose();
 }
 console.log('REAL HOME');await page.evaluate(async()=>{await window.__ciudad.api.travel('casa','door');});await page.waitForFunction(()=>window.__ciudad.api.sceneName==='casa');
 await page.evaluate(()=>window.__ciudad.api.homeEditor.open());await page.locator('.hed').waitFor();await checkLayout('home-editor');
 const beforeHome=await profile();await page.locator('.hed__looks summary').click();await page.locator('[data-home-focus="Paredes-menta"]').click();
 await page.locator('[data-home-focus="save"]').click();await page.locator('.hed').waitFor({state:'hidden'});assert.equal((await profile()).home.wall,'menta');assert.equal((await profile()).homeRev,beforeHome.homeRev+1);
 console.log('REAL AGUAS');await page.evaluate(async()=>{const {openAguas}=await import('./js/ui/aguas.js');openAguas(window.__ciudad.api);});
 await page.locator('#choice .choice__opt').filter({hasText:'Pedirle un agua'}).click();await page.locator('#choice .choice__opt').filter({hasText:'Horchata'}).click();const beforeDrink=(await profile()).coins;await page.locator('#choice .choice__opt').filter({hasText:'Sí, por favor'}).click();
 for(let n=0;n<80&&(await profile()).coins===beforeDrink;n++)await wait(100);assert.equal((await profile()).coins,beforeDrink-5);
 records.push({name:'real-confirmed-flows',adoption:true,accessories:true,leash:true,purchase:true,inventory:true,localChat:true,fieldHud:3,choiceGames:6,homeSaved:true});
}

(async()=>{fs.mkdirSync(OUT,{recursive:true});const {createServer}=await load('_ciudad-server/server.js'),{MemoryStorage}=await load('_ciudad-server/profiles.js');storage=new MemoryStorage();app=createServer({devLogin:true,storage,chat:true});port=await app.listen();await seed('premium-ui');await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+staticServer.address().port;
 try{browser=await pw.chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  await open(sizes[0]);await actualFlows();await retire();
  // Independent browser contexts read the same persisted local-server account.
  for(const size of sizes){
   console.log('RESPONSIVE '+size.width);await open(size);assert.equal(await page.evaluate(()=>window.__ciudad.api.vivo.state.home.wall),'menta');assert.equal(await page.evaluate(()=>window.__ciudad.api.vivo.state.pets[0].name),'Luna');
   for(const [name,openPanel]of [['pets',()=>{window.__ciudad.api.actions.pets();}],['shop',()=>{window.__ciudad.api.actions.shop('mascotas');}],['inventory',()=>{window.__ciudad.api.actions.inventory();}],['studio',()=>{window.__ciudad.api.ui.openWardrobe({tab:'accesorios'});}],['map',()=>{window.__ciudad.api.ui.openMap();}],['passport',()=>{window.__ciudad.api.ui.openPassport();}],['games',()=>{window.__ciudad.api.games.open();}]]){await action(openPanel);await checkLayout(name);await modalClose();}
   await retire();
  }
 }finally{await retire();for(const s of sockets)s.terminate();await browser?.close();await app?.close();staticServer.close();fs.writeFileSync(path.join(OUT,'integrated-browser.json'),JSON.stringify({mode:'local-real-websocket-ui',temporaryProfiles:true,physicalDevices:false,productionWrites:false,records,fatal},null,2));}
 assert.deepEqual(fatal,[]);console.log(JSON.stringify({checks:records.length,fatal}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
