'use strict';
// Reuse the isolated full-panel fixture; no requests reach production.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'course-priorities-e2e.cjs'),'utf8');
const h=new Function('require','__dirname','process',source.slice(0,source.indexOf('async function scenario(width)'))+`
return {fixture,setSummary,cards,badges,noOverflow,shot,catalog,
async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,channel:'chrome'});},
async stop(){await browser?.close();server.close();}};`)(require,__dirname,process);
const views=[['disponibles','Cursos disponibles',['course-1']],['progreso','Cursos en progreso',['course-6']],['completados','Cursos completados',[]],['bloqueados','Cursos bloqueados',['course-0','course-2','course-3','course-4','course-5']],['proximamente','Próximos cursos',['course-7']],['regalo','Curso de regalo',[]]];
const widths=(process.env.ICADEM_PRIORITY_WIDTHS||'320,360,375,390,414,768,1024,1440').split(',').map(Number);
async function ready(page,state){await page.waitForSelector(`[data-course-view="${state}"]`);await page.waitForFunction(()=>!document.querySelector('.courses-skeleton'));await page.waitForFunction(()=>!document.querySelector('[data-course-sync]:not([hidden])'));}
async function go(page,state){await page.evaluate(state=>navigateToSection(state==='todos'?'cursos':'cursos-'+state),state);await ready(page,state);}
async function main(){
  await h.start();
  for(const width of widths){
    const f=await h.fixture(width),{page,state}=f,original=structuredClone(state.shared.data);
    await h.setSummary(f,{priorities:['course-4','course-0','course-2']});
    await page.locator('#cur-sort').selectOption('prioridades');
    assert.deepEqual((await h.cards(page)).slice(0,5),['course-6','course-1','course-4','course-0','course-2']);
    assert.deepEqual(await h.badges(page),{'course-4':1,'course-0':2,'course-2':3});
    assert.equal(await page.locator('.courses-library-head__eyebrow').count(),0);
    const covers=await page.locator('.curso-card').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.cid,n.querySelector('img').getAttribute('src')])));
    // A selected free course controls the existing gift tab, independently of VIP access.
    f.state.shared.freeCourseId='course-0';await page.evaluate(()=>{UserState.freeCourseId='course-0';navigateToSection('cursos');});
    for(const [view,title,expected] of views){
      await page.locator(`[data-course-filter="${view}"]`).click();await ready(page,view);
      assert.equal(new URL(page.url()).hash,'#cursos-'+view);
      assert.equal(await page.locator('.courses-view-head h1').innerText(),title);
      assert.equal(await page.locator('[data-course-unlocks],.courses-library-head,.courses-status-filters,.courses-library-head__count').count(),0);
      assert.deepEqual((await h.cards(page)).sort(),expected.slice().sort());
      assert.match(await page.locator('#cur-result-count').innerText(),new RegExp('^'+expected.length+' curso'));
      if(!expected.length)assert.ok(await page.locator('.courses-empty h3').innerText());
      const cardCovers=await page.locator('.curso-card').evaluateAll(nodes=>nodes.map(n=>[n.dataset.cid,n.querySelector('img').getAttribute('src')]));
      for(const [id,cover] of cardCovers)assert.equal(cover,covers[id]);
      assert.ok(await page.locator('[data-section="cursos"].is-active').count(),'main navigation remains active');
      await h.noOverflow(page,view+' '+width);
      const back=page.locator('[data-courses-back]');assert.ok((await back.boundingBox()).height>=44);
      if([320,390,768,1440].includes(width)&&['progreso','completados','bloqueados'].includes(view))await h.shot(page,`view-${view}-${width}`);
      await back.click();await ready(page,'todos');assert.equal(await page.locator('#cur-sort').inputValue(),'prioridades');
      if(view==='disponibles'){
        await page.goForward();await ready(page,view);await page.locator('[data-courses-back]').click();await ready(page,'todos');
      }
    }
    // Search/filter state belongs to the parent view, not to the child edits.
    await page.locator('#cur-search').fill('Derecho');await page.waitForTimeout(120);
    await page.locator('#cur-area').selectOption('Fiscal');await page.locator('#cur-level').selectOption('Avanzado');
    const parent=await h.cards(page);await page.locator('[data-course-filter="bloqueados"]').click();await ready(page,'bloqueados');
    await page.locator('#cur-search').fill('imposible');await page.waitForTimeout(120);
    await page.locator('[data-clear-course-filters]').click();assert.equal(new URL(page.url()).hash,'#cursos-bloqueados');assert.ok((await h.cards(page)).length>0);
    await page.locator('[data-courses-back]').click();await ready(page,'todos');
    assert.equal(await page.locator('#cur-search').inputValue(),'Derecho');assert.equal(await page.locator('#cur-area').inputValue(),'Fiscal');assert.equal(await page.locator('#cur-level').inputValue(),'Avanzado');assert.deepEqual(await h.cards(page),parent);
    await page.locator('#cur-search-clear').click();await page.locator('#cur-area').selectOption('todas');await page.locator('#cur-level').selectOption('todos');
    // Live catalog state updates use the same access/progress classifier in every view.
    state.shared.catalog=structuredClone(h.catalog);const serverCourse=state.shared.catalog.find(c=>c.id==='course-4');serverCourse.access.unlocked=true;serverCourse.access.daysRemaining=0;serverCourse.sesiones.forEach(s=>s.accessible=true);state.shared.progress={'course-6':{completedLessons:[1],courseCompleted:false},'course-1':{completedLessons:[1,2,3,4,5,6],courseCompleted:true}};
    await page.evaluate(async()=>{const courses=await __getCourseUnlockCatalog();const c=courses.find(c=>c.id==='course-4');c.access.unlocked=true;c.access.daysRemaining=0;c.sesiones.forEach(s=>s.accessible=true);courses.find(c=>c.id==='course-1').status='completado';navigateToSection('cursos');});
    assert.deepEqual((await h.cards(page)).slice(0,3),['course-6','course-1','course-4']);assert.equal((await h.badges(page))['course-4'],1);
    await go(page,'completados');await page.waitForFunction(()=>document.querySelector('.curso-card[data-cid="course-1"]'));assert.deepEqual(await h.cards(page),['course-1']);assert.match(await page.locator('[data-course-details]').innerText(),/Revisar curso/);
    await go(page,'progreso');assert.match(await page.locator('[data-course-details]').innerText(),/Continuar/);assert.match(await page.locator('.curso-card__progress').innerText(),/17|1 de 6/);
    await go(page,'disponibles');assert.deepEqual(await h.cards(page),['course-4']);
    // Gift uses the existing non-VIP classification; the view itself grants no access.
    await page.evaluate(()=>{UserState.modo='free';navigateToSection('cursos-regalo');});await ready(page,'regalo');assert.deepEqual(await h.cards(page),['course-0']);
    await page.evaluate(()=>{UserState.modo='vip';navigateToSection('cursos');});await ready(page,'todos');
    // Recreate the app at a direct hash and restore ONLY the fixture's identity, never a real token.
    if(width===390||width===1440){
      for(const [view] of views){
        const url=new URL(page.url());url.hash='cursos-'+view;
        await page.goto(url.href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof navigateToSection==='function'&&window.ICADEMCourseUnlocks);
        await page.evaluate(()=>{window.__isDemoMode=false;window.__currentUser={uid:'fixture-a',getIdToken:()=>Promise.resolve('browser-fixture-only')};window.__auth={currentUser:window.__currentUser};Object.assign(UserState,{uid:'fixture-a',modo:'vip',identityReady:true,isAdmin:false,freeCourseId:''});navigateToSection(location.hash.slice(1),{reemplazar:true});});
        await ready(page,view);assert.equal(new URL(page.url()).hash,'#cursos-'+view);await h.noOverflow(page,'direct/reloaded '+view);
      }
      await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.courses-page--premium').evaluate(el=>getComputedStyle(el).animationName),'none');
    }
    assert.equal(state.shared.data.available,original.available);assert.deepEqual(state.shared.data.selectedCourseIds,original.selectedCourseIds);assert.deepEqual(state.shared.data.priorities,['course-4','course-0','course-2']);assert.deepEqual(state.puts,[]);assert.deepEqual(state.selects,[]);assert.deepEqual(state.errors,[]);
    console.log(`PASS ${width}px: six child views, return/history, parent filters, exact groups/ranks, original covers, category updates/empty states, no overflow or academic writes`);
    await f.context.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>h.stop());
