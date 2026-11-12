'use strict';
// Full panel with isolated API responses. No production requests or student writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {chromium,webkit}=require(process.argv[2]||'playwright');
const ROOT=path.resolve(__dirname,'..'),SHOTS=process.argv[3],BASELINE=process.env.ICADEM_PRIORITY_BASELINE==='1';
const widths=(process.env.ICADEM_PRIORITY_WIDTHS||'320,360,375,390,414,768,1024,1440').split(',').map(Number),shotWidths=[320,390,768,1440];
const originals=new Map();
if(BASELINE)for(const file of ['vip-panel.html','js/icadem-course-unlocks.js','css/icadem-course-unlocks.css'])originals.set('/'+file,cp.execFileSync('git',['-c','safe.directory='+ROOT.replace(/\\/g,'/'),'show',(process.env.ICADEM_PRIORITY_BASELINE_REF||'HEAD')+':'+file],{cwd:ROOT,maxBuffer:8*1024*1024}));
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://fixture').pathname),file=path.resolve(ROOT,'.'+name);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}if(originals.has(name)){res.writeHead(200,{'Content-Type':types[path.extname(file)]});return res.end(originals.get(name));}fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'missing':body);});});
const names=['Contratos inmobiliarios y derecho civil','Derecho fiscal aplicado','Derecho notarial y registral','Finanzas y flujo de efectivo','Nómina para profesionales con casos de cálculo y obligaciones patronales','Planeación financiera','Auditoría para profesionales','Formación que todavía se prepara'];
const catalog=names.map((titulo,i)=>({id:'course-'+i,titulo,descripcion:'Formación práctica para tu siguiente paso profesional.',area:i%3===0?'Legal':i%3===1?'Fiscal':'Finanzas',nivel:i%2?'Avanzado':'Intermedio',instructor:'Equipo ICADEM',orden:i+1,sessionCount:6,sesiones:Array.from({length:6},(_,n)=>({numero:n+1,titulo:'Clase '+(n+1),accessible:[1,6].includes(i)})),materiales:[],portada:'/assets/juegos/foto-fiscal.webp?original='+i,access:{unlocked:[1,6].includes(i),daysRemaining:i===7?12:null},marcarProximamente:i===7}));
const initial=()=>({ok:true,enabled:true,active:true,isAdmin:false,available:0,vipSlots:0,initialChoiceAvailable:false,nextUnlockAt:'2026-11-17T18:00:00Z',selectedCourseIds:['course-1','course-6'],priorities:[],eligibleCourseIds:['course-0','course-2','course-3','course-4','course-5'],revision:1});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,OPTIONS'};
const fallbackImage=fs.readFileSync(path.join(ROOT,'assets/juegos/foto-fiscal.webp'));let browser,base;
async function fixture(width,shared={data:initial()}){
  const context=await browser.newContext({viewport:{width,height:width<768?844:1000},serviceWorkers:'block',hasTouch:width<1024,...(process.env.ICADEM_TEST_ANDROID==='1'&&process.env.ICADEM_TEST_ENGINE!=='webkit'&&width<768?{isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36'}:{}),...(process.env.ICADEM_TEST_ENGINE==='webkit'&&width<768?{isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}:{})}),page=await context.newPage();
  const state={shared,reads:0,puts:[],selects:[],errors:[],failPut:false,conflictPut:false,holdPut:false,heldPut:false,releasePut:null,holdRead:false,heldRead:false,releaseRead:null};
  page.on('pageerror',error=>{if(/learning-route|course-unlocks/.test(error.stack||''))state.errors.push(error.message);});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),api=url.pathname;
    if(url.origin===base)return route.continue();
    if(url.hostname==='images.unsplash.com'&&req.resourceType()==='image')return route.fulfill({contentType:'image/webp',body:fallbackImage});
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    if(api==='/api/courses/unlocks'){
      state.reads++;
      if(state.holdRead){const snapshot=structuredClone(shared.data);state.heldRead=true;await new Promise(resolve=>state.releaseRead=resolve);return route.fulfill({json:snapshot,headers:cors});}
      return route.fulfill({json:shared.data,headers:cors});
    }
    if(api==='/api/courses/unlocks/priorities'){
      const body=req.postDataJSON();state.puts.push(body);assert.equal(req.method(),'PUT');
      if(state.holdPut){state.heldPut=true;await new Promise(resolve=>state.releasePut=resolve);}
      if(state.failPut){state.failPut=false;return route.fulfill({status:503,json:{ok:false,error:'No hay conexión. Tu borrador se conserva.'},headers:cors});}
      if(state.conflictPut||Number.isInteger(body.expectedRevision)&&body.expectedRevision!==shared.data.revision){state.conflictPut=false;return route.fulfill({status:409,json:{ok:false,code:'priorities-conflict',error:'Tu lista cambió en otro dispositivo. Revisa la versión actual antes de guardar.'},headers:cors});}
      shared.data={...shared.data,priorities:[...body.courseIds],revision:shared.data.revision+1};return route.fulfill({json:shared.data,headers:cors});
    }
    if(api==='/api/courses/unlocks/select'){state.selects.push(req.postDataJSON());return route.fulfill({status:500,json:{ok:false,error:'Organizar no debe seleccionar cursos.'},headers:cors});}
    if(api==='/api/identity/sync')return route.fulfill({json:{ok:true,profile:{uid:'fixture-a',freeCourseId:shared.freeCourseId||''},membership:{active:true}},headers:cors});
    if(shared.handle && await shared.handle(route,url))return;
    if(api==='/api/courses/catalog')return route.fulfill({json:{ok:true,courses:shared.catalog||catalog,viewer:{defaultPreviewCourseId:'course-0'}},headers:cors});
    if(url.hostname.includes('railway'))return route.fulfill({json:{ok:true,items:[],courses:shared.progress||{'course-6':{completedLessons:[1],courseCompleted:false}},credits:{balance:0},profile:{}},headers:cors});
    return route.abort();
  });
  await page.addInitScript(()=>{for(const uid of ['demo','fixture-a','fixture-b'])for(const key of ['tour','credit-gift','free-course-offer-seen'])localStorage.setItem(`icadem:experience:v3:${uid}:${key}`,'complete');});
  async function boot(){
    const previousOrder=new URL(page.url()).searchParams.get('ordenCursos');
    if(page.url().startsWith(base))await page.reload({waitUntil:'domcontentloaded'});
    await page.goto(base+'/vip-panel.html?modo=demo'+(previousOrder?'&ordenCursos='+encodeURIComponent(previousOrder):'')+'#cursos',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ICADEMPlatform&&window.ICADEMCourseUnlocks&&typeof navigateToSection==='function');
    await page.evaluate(()=>{if(window.ICADEMPush)window.ICADEMPush.revisar=async()=>'seen';window.__isDemoMode=false;window.__currentUser={uid:'fixture-a',getIdToken:()=>Promise.resolve('browser-fixture-only')};window.__auth={currentUser:window.__currentUser};Object.assign(window.UserState,{uid:'fixture-a',modo:'vip',identityReady:true,isAdmin:false,profileComplete:true,profileIntakeSeen:true,displayName:'Estudiante de prueba',freeCourseId:''});window.__serverProgressOwner='fixture-a';window.__serverCourseProgress={'course-6':{clasesVistas:[1],completado:false}};window.navigateToSection('cursos');});
    await page.waitForSelector('.course-unlocks__status');await page.waitForFunction(()=>document.querySelectorAll('.curso-card').length===8);await page.waitForFunction(()=>!document.querySelector('[data-course-sync]:not([hidden])'));
    await page.evaluate(()=>{document.querySelectorAll('.ica-tour-root,.ica-experience,#name-modal').forEach(el=>el.hidden=true);document.body.style.overflow='';window.scrollTo(0,0);});
  }
  await boot();return{context,page,state,boot};
}
const cards=page=>page.locator('.curso-card').evaluateAll(nodes=>nodes.map(node=>node.dataset.cid));
const pendingCards=async page=>(await cards(page)).filter(id=>!['course-1','course-6'].includes(id));
const badges=page=>page.locator('[data-course-priority]').evaluateAll(nodes=>Object.fromEntries(nodes.filter(node=>node.closest('[data-cid]')).map(node=>[node.closest('[data-cid]').dataset.cid,Number(node.dataset.coursePriority)])));
const routeOrder=page=>page.locator('[data-route-item]').evaluateAll(nodes=>nodes.map(node=>node.dataset.routeItem));
async function setSummary(f,change){f.state.shared.data={...f.state.shared.data,...change,revision:f.state.shared.data.revision+1};await f.page.evaluate(()=>ICADEMCourseUnlocks.refresh());await f.page.waitForTimeout(100);}
async function noOverflow(page,label){const g=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(g.doc<=g.width+1&&g.body<=g.width+1,label+': '+JSON.stringify(g));}
async function shot(page,name,selector){if(!SHOTS)return;fs.mkdirSync(SHOTS,{recursive:true});await page.waitForTimeout(240);if(selector)await page.locator(selector).screenshot({path:path.join(SHOTS,name+'.png')});else await page.screenshot({path:path.join(SHOTS,name+'.png'),fullPage:false});}
async function open(page){await page.locator('[data-unlock-organize]').click();await page.waitForSelector('[data-route-search]');}
async function act(page,id,action){await page.locator(`[data-route-menu="${id}"]`).click();await page.locator(`[data-route-action="${action}"][data-id="${id}"]`).click();}
async function save(page){await page.locator('[data-route-save]').click();await page.waitForFunction(()=>!ICADEMLearningRoute.isBusy()&&!ICADEMLearningRoute.isDirty());}
async function back(page){await page.locator('[data-route-back]').click();await page.waitForSelector('#cur-sort');}
async function scenario(width){
  const f=await fixture(width),{page,state}=f,start=structuredClone(state.shared.data);
  const prefix=BASELINE?'before':'after';
  if(BASELINE){await setSummary(f,{priorities:['course-0','course-2','course-4']});if(shotWidths.includes(width)){await shot(page,`${prefix}-compact-${width}`,'[data-course-unlocks]');await page.locator('.curso-card[data-cid="course-0"]').scrollIntoViewIfNeeded();await shot(page,`${prefix}-catalog-${width}`);}await f.context.close();return;}
  assert.deepEqual(await page.locator('#cur-sort option').evaluateAll(nodes=>nodes.map(n=>n.value)),['proximos','prioridades','nombre','progreso','recientes']);
  assert.equal(await page.locator('[data-unlock-priority]:visible').count(),0);assert.deepEqual(await badges(page),{});
  const standard=await cards(page);await page.locator('#cur-sort').selectOption('prioridades');assert.deepEqual(await cards(page),standard,'no list uses the standard order');
  // Details is a real, enabled action independently of the academic access state.
  for(const [id,label] of [['course-0','Ver detalles'],['course-1','Iniciar curso'],['course-6','Continuar'],['course-7','Ver detalles']]){
    const button=page.locator(`.curso-card[data-cid="${id}"] [data-course-details]`);
    assert.equal(await button.isEnabled(),true);assert.match(await button.innerText(),new RegExp(label));
    const contrast=await button.evaluate(el=>{const style=getComputedStyle(el),lum=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(n=>{const v=Number(n)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const a=lum(style.color),b=lum(style.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
    assert.ok(contrast>=4.5,'enabled course action has readable contrast: '+contrast);
  }
  const action=page.locator('.curso-card[data-cid="course-0"] [data-course-details]');
  await page.mouse.move(0,0);await page.waitForTimeout(240);
  const normalColor=await action.evaluate(el=>getComputedStyle(el).backgroundColor);
  await page.locator('.curso-card[data-cid="course-0"] .curso-card__title').hover();await page.waitForTimeout(240);
  assert.equal(await action.evaluate(el=>getComputedStyle(el).backgroundColor),normalColor,'hovering the card does not imply another button state');
  await action.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>location.hash==='#curso-detalle');
  await page.evaluate(()=>navigateToSection('cursos'));await page.waitForSelector('#cur-sort');
  // Component-only states; the server refresh is verified separately.
  await page.waitForFunction(()=>!document.querySelector('[data-course-sync]:not([hidden])'));
  await page.evaluate(async()=>{const list=await __getCourseUnlockCatalog();list.find(c=>c.id==='course-1').status='completado';list.find(c=>c.id==='course-7').catalogPending=true;Sections.renderers.cursos(document.getElementById('dynamic-section'));});
  assert.match(await page.locator('.curso-card[data-cid="course-1"] [data-course-details]').innerText(),/Revisar curso/);
  assert.equal(await page.locator('.curso-card[data-cid="course-1"] [data-course-details]').isEnabled(),true);
  assert.equal(await page.locator('.curso-card[data-cid="course-7"] [data-course-details]').isDisabled(),true);
  assert.match(await page.locator('.curso-card[data-cid="course-7"] [data-course-details]').getAttribute('title'),/recuperando/);
  await noOverflow(page,'pending course controls '+width);
  await page.evaluate(async()=>{const list=await __getCourseUnlockCatalog();delete list.find(c=>c.id==='course-1').status;delete list.find(c=>c.id==='course-7').catalogPending;navigateToSection('cursos');});
  await page.locator('#cur-sort').selectOption('prioridades');
  const covers=await page.locator('.curso-card').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.cid,node.querySelector('.curso-card__cover img').getAttribute('src')])));
  for(const list of [['course-4'],['course-4','course-0','course-2'],['course-4','course-0','course-2','course-5','course-3']]){
    await setSummary(f,{priorities:list});const expected=Object.fromEntries(list.map((id,index)=>[id,index+1]));assert.deepEqual(await badges(page),expected);assert.deepEqual((await pendingCards(page)).slice(0,list.length),list,'catalog immediately reflects new confirmed order');assert.equal(await page.locator('[data-unlock-priority]').getAttribute('data-priority-course'),list[0]);
    if(list.length===5){await f.boot();assert.equal(await page.locator('#cur-sort').inputValue(),'prioridades');assert.deepEqual((await pendingCards(page)).slice(0,5),list,'five saved priorities follow the open group in the LARGE catalog after reload');}
    assert.match(await page.locator('[data-unlock-priority]').innerText(),/Primero en tu lista/);assert.ok((await page.locator('[data-unlock-priority]').getAttribute('title')).includes(names[4]));
  }
  const raw=['removed','course-1','course-4','course-2','course-6'];await setSummary(f,{priorities:raw});
  assert.equal((await badges(page))['course-4'],3);assert.equal(await page.locator('[data-unlock-priority]').getAttribute('data-priority-course'),'course-4');assert.deepEqual(state.shared.data.priorities,raw);assert.equal(state.puts.length,0);
  await page.locator('#cur-area').selectOption('Fiscal');assert.deepEqual(await cards(page),['course-1','course-4','course-7']);assert.equal((await badges(page))['course-4'],3);
  await page.locator('#cur-search').fill('nómina');await page.waitForTimeout(150);assert.deepEqual(await cards(page),['course-4']);assert.equal((await badges(page))['course-4'],3);
  await page.locator('#cur-search-clear').click();await page.locator('#cur-area').selectOption('todas');
  await page.locator('[data-course-filter="bloqueados"]').click();await page.waitForSelector('[data-course-view="bloqueados"]');const locked=await cards(page);assert.ok(locked.includes('course-4'));assert.ok(!locked.includes('course-1')&&!locked.includes('course-6'));assert.equal((await badges(page))['course-4'],3);
  await page.locator('[data-courses-back]').click();await page.waitForSelector('[data-course-view="todos"]');
  await page.locator('[data-course-filter="disponibles"]').click();await page.waitForSelector('[data-course-view="disponibles"]');assert.ok((await cards(page)).includes('course-1'));
  await page.locator('[data-courses-back]').click();await page.waitForSelector('[data-course-view="todos"]');
  await page.locator('[data-course-filter="progreso"]').click();await page.waitForSelector('[data-course-view="progreso"]');assert.deepEqual(await cards(page),['course-6']);
  await page.locator('[data-courses-back]').click();await page.waitForSelector('[data-course-view="todos"]');
  await setSummary(f,{priorities:['course-0','course-2','course-4']});
  if(shotWidths.includes(width)){
    await shot(page,`${prefix}-compact-${width}`,'[data-course-unlocks]');
    await page.locator('.curso-card[data-cid="course-0"]').scrollIntoViewIfNeeded();await shot(page,`${prefix}-catalog-${width}`);
    await page.locator('.curso-card[data-cid="course-0"] [data-course-priority]').evaluate(badge=>badge.scrollIntoView({block:'center',behavior:'instant'}));
    const actionClear=await page.locator('[data-unlock-organize-course="course-0"]').evaluate(button=>{const r=button.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return button===target||button.contains(target);});
    assert.equal(actionClear,true,'priority and Organizar remain reachable above the fixed dock');
    await shot(page,`${prefix}-priority-card-${width}`);
  }
  await noOverflow(page,'catalog '+width);
  const geometry=await page.locator('[data-course-priority]').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),card=node.closest('.curso-card').getBoundingClientRect();return{left:r.left,right:r.right,cardLeft:card.left,cardRight:card.right,font:parseFloat(getComputedStyle(node).fontSize),height:r.height};}));
  geometry.forEach(g=>{assert.ok(g.left>=g.cardLeft&&g.right<=g.cardRight);assert.ok(g.font>=10&&g.font<=14);assert.ok(g.height<=38);});
  await setSummary(f,{available:2,vipSlots:2});assert.ok(await page.locator('[data-unlock-select-course="course-0"]').count());assert.ok(await page.locator('[data-unlock-organize-course="course-0"]').count());assert.equal((await badges(page))['course-0'],1);
  await setSummary(f,{available:0,vipSlots:0});
  await page.locator('#cur-sort').selectOption('nombre');
  await open(page);await act(page,'course-4','up');await act(page,'course-0','remove');await page.locator('[data-route-add="course-3"]').click();const draft=await routeOrder(page);assert.deepEqual(draft,['course-4','course-2','course-3']);
  state.failPut=true;await page.locator('[data-route-save]').click();await page.waitForSelector('[data-route-error]:not([hidden])');assert.deepEqual(state.shared.data.priorities,['course-0','course-2','course-4']);assert.deepEqual(await routeOrder(page),draft);
  assert.equal(await page.evaluate(()=>localStorage.getItem('icadem:catalog-sort:v1:fixture-a')),'nombre','failed save must not change the catalog preference');
  await save(page);await back(page);assert.equal(await page.locator('#cur-sort').inputValue(),'prioridades');assert.deepEqual((await pendingCards(page)).slice(0,3),draft);assert.deepEqual(await badges(page),{'course-4':1,'course-2':2,'course-3':3});assert.equal(await page.locator('[data-unlock-priority]').getAttribute('data-priority-course'),'course-4');
  assert.deepEqual(await page.locator('.curso-card').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.cid,node.querySelector('.curso-card__cover img').getAttribute('src')]))),covers,'covers are unchanged by priority updates');
  await f.boot();assert.equal(await page.locator('#cur-sort').inputValue(),'prioridades','reload retains the main catalog criterion without selecting it again');assert.deepEqual((await pendingCards(page)).slice(0,3),draft,'reload reads server order');
  await page.locator('#cur-sort').selectOption('nombre');
  await page.evaluate(()=>{navigateToSection('inicio');navigateToSection('cursos');});
  assert.equal(await page.locator('#cur-sort').inputValue(),'nombre','menu respects the manually selected preference');
  await f.boot();assert.equal(await page.locator('#cur-sort').inputValue(),'nombre','manual preference survives reload');
  await page.locator('#cur-sort').selectOption('prioridades');
  if(width===390){
    const other=await fixture(768,state.shared);await other.page.locator('#cur-sort').selectOption('prioridades');assert.deepEqual((await pendingCards(other.page)).slice(0,3),draft,'fresh browser/device context reads same server order');
    await open(page);await act(page,'course-3','up');const localDraft=await routeOrder(page);
    await open(other.page);await act(other.page,'course-4','down');await save(other.page);const remote=structuredClone(state.shared.data.priorities),writesBefore=state.puts.length;
    await page.locator('[data-route-save]').click();await page.waitForSelector('[data-route-error]:not([hidden])');assert.deepEqual(state.shared.data.priorities,remote,'stale editor cannot overwrite another device');assert.deepEqual(await routeOrder(page),localDraft,'conflict retains local draft');assert.ok(state.puts.length<=writesBefore+1);
    assert.equal(await page.locator('[data-route-save]').isDisabled(),true,'conflict cannot silently retry with a newer revision');assert.equal(await page.locator('[data-route-reload]').isVisible(),true);
    const readsBefore=state.reads;await page.locator('[data-route-reload]').click();await page.waitForSelector('[data-route-stay]');await page.locator('[data-route-stay]').click();await page.waitForSelector('[data-route-stay]',{state:'detached'});assert.deepEqual(await routeOrder(page),localDraft);assert.equal(state.reads,readsBefore,'cancel keeps draft without fetching a replacement');
    await page.locator('[data-route-reload]').click();await page.waitForSelector('[data-route-discard]');await page.locator('[data-route-discard]').click();await page.waitForSelector('[data-route-discard]',{state:'detached'});await page.waitForFunction(()=>!ICADEMLearningRoute.isDirty()&&!ICADEMLearningRoute.isBusy());assert.deepEqual(await routeOrder(page),remote,'explicit reload adopts the confirmed remote order');assert.ok(state.reads>readsBefore);await back(page);await other.context.close();
    await setSummary(f,{priorities:['course-5','course-0'],available:0});assert.deepEqual((await pendingCards(page)).slice(0,2),['course-5','course-0']);
    await open(page);await act(page,'course-0','up');const confirmedOrder=await routeOrder(page);
    state.holdRead=true;const held=page.evaluate(()=>ICADEMCourseUnlocks.refresh());await page.waitForTimeout(80);assert.ok(state.heldRead);
    await page.locator('[data-route-save]').click();await page.waitForFunction(expected=>JSON.stringify(ICADEMCourseUnlocks.getPriorities())===JSON.stringify(expected),confirmedOrder);
    assert.deepEqual(state.shared.data.priorities,confirmedOrder,'PUT is confirmed while the older GET is still pending');
    state.releaseRead();state.holdRead=false;await held;await page.waitForFunction(()=>!ICADEMLearningRoute.isBusy()&&!ICADEMLearningRoute.isDirty());
    assert.deepEqual(await page.evaluate(()=>ICADEMCourseUnlocks.getPriorities()),confirmedOrder,'late lower-revision GET cannot resurrect old priorities');await back(page);assert.deepEqual((await pendingCards(page)).slice(0,2),confirmedOrder);
    await page.evaluate(()=>{document.dispatchEvent(new Event('icadem:session-ending'));window.__currentUser={uid:'fixture-b',getIdToken:()=>Promise.resolve('fixture-b')};window.__auth.currentUser=window.__currentUser;window.UserState.uid='fixture-b';});assert.deepEqual(await badges(page),{});assert.deepEqual(await page.evaluate(()=>ICADEMCourseUnlocks.getPriorities()),[]);
  }
  assert.equal(state.shared.data.available,start.available);assert.equal(state.shared.data.vipSlots,start.vipSlots);assert.deepEqual(state.shared.data.selectedCourseIds,start.selectedCourseIds);assert.deepEqual(state.selects,[]);assert.deepEqual(state.errors,[]);
  console.log(`PASS ${width}px: 0/1/3/5 priorities; original numbers, open courses first, 5 sorts, filters/access/progress, save/error/reload${width===390?', second context + concurrent conflict + session reset':''}; no selects or rights consumed`);await f.context.close();
}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({headless:true,channel:'chrome'});for(const width of widths)await scenario(width);console.log(`PASS ${widths.length}/${widths.length} ${BASELINE?'baseline captures':'priority scenarios'}; APIs isolated; devices emulated.`);})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
