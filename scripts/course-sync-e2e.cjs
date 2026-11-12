'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,initial,catalog,cards,badges,routeOrder,open,act,save,back,
async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,channel:'chrome'});},async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
async function sync(page){await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>!document.querySelector('[data-course-sync]:not([hidden])'));}
(async()=>{
  await h.start();const shared={data:{...h.initial(),priorities:['course-0','course-2','course-4']}};
  const a=await h.fixture(1440,shared),b=await h.fixture(390,shared),initial=structuredClone(shared.data);
  await a.page.locator('#cur-sort').selectOption('prioridades');await b.page.locator('#cur-sort').selectOption('prioridades');
  await h.open(a.page);await h.act(a.page,'course-4','up');await h.save(a.page);await h.back(a.page);
  const savedA=[...shared.data.priorities];await b.page.evaluate(()=>navigateToSection('cursos-bloqueados'));await sync(b.page);
  assert.deepEqual((await h.cards(b.page)).slice(0,3),savedA,'B reads A through the actual focus/refresh handlers');
  await b.page.locator('[data-courses-back]').click();await b.page.waitForSelector('[data-course-view="todos"]');
  await h.open(b.page);await h.act(b.page,'course-4','up');await h.save(b.page);await h.back(b.page);const savedB=[...shared.data.priorities];
  await sync(a.page);assert.deepEqual(await h.badges(a.page),Object.fromEntries(savedB.map((id,i)=>[id,i+1])));
  await a.boot();await b.boot();for(const f of [a,b])assert.deepEqual(await h.badges(f.page),Object.fromEntries(savedB.map((id,i)=>[id,i+1])));
  // A dirty draft never disappears when another session commits a newer revision.
  await h.open(a.page);await h.act(a.page,'course-0','up');const draft=await h.routeOrder(a.page);
  await h.open(b.page);await h.act(b.page,'course-2','up');await h.save(b.page);await sync(a.page);
  assert.deepEqual(await h.routeOrder(a.page),draft);assert.equal(await a.page.locator('[data-route-save]').isDisabled(),true);assert.match(await a.page.locator('[data-route-error]').innerText(),/otra sesión/);assert.equal(await a.page.locator('[data-route-reload]').isVisible(),true);
  await a.page.locator('[data-route-reload]').click();await a.page.locator('[data-route-discard]').click();await a.page.waitForFunction(()=>!ICADEMLearningRoute.isDirty());assert.deepEqual(await h.routeOrder(a.page),shared.data.priorities);await h.back(a.page);await h.back(b.page);
  // Canonical progress arrives from the server; forged local progress never grants academic completion.
  shared.progress={'course-6':{completedLessons:[1,2,3],courseCompleted:false}};
  for(const f of [a,b]){await f.page.evaluate(()=>localStorage.setItem('icadem_progress_fixture-a',JSON.stringify({'course-0':{clasesVistas:[1,2,3,4,5,6],completado:true}})));await sync(f.page);assert.match(await f.page.locator('[data-cid="course-6"] .curso-card__progress').innerText(),/50/);assert.match(await f.page.locator('[data-cid="course-0"] .curso-card__state').innerText(),/Bloqueado/);}
  shared.handle=async(route,url)=>{if(url.pathname==='/api/courses/catalog'){await route.fulfill({status:503,json:{error:'Sin conexión de prueba'},headers:{'Access-Control-Allow-Origin':'*'}});return true;}return false;};
  await a.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await a.page.waitForFunction(()=>document.querySelector('[data-course-sync]')?.textContent.includes('última información'));assert.equal(await a.page.locator('[data-course-sync]').isVisible(),true);
  delete shared.handle;await sync(a.page);assert.equal(await a.page.locator('[data-course-sync]').isVisible(),false);
  for(const key of ['available','vipSlots','initialChoiceAvailable','selectedCourseIds'])assert.deepEqual(shared.data[key],initial[key]);
  assert.deepEqual(a.state.selects,[]);assert.deepEqual(b.state.selects,[]);assert.deepEqual(a.state.errors,[]);assert.deepEqual(b.state.errors,[]);
  await a.context.close();await b.context.close();console.log('PASS two independent MOCKED sessions: A→B/B→A priorities, reloads, focus refresh, proactive conflict retains draft, canonical progress, forged storage rejected, stale warning/recovery, no academic rights consumed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>h.stop());
