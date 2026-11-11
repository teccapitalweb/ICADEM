'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8').replace(/\r\n/g,'\n');
const platform=fs.readFileSync(__dirname+'/../js/icadem-platform-v2.js','utf8').replace(/\r\n/g,'\n');
const between=(source,start,end)=>{const first=source.indexOf(start),last=source.indexOf(end,first);assert.ok(first>=0&&last>first,'production function boundaries must exist');return source.slice(first,last);};
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function campus(){
  const ids=new Map(),frames=[],timers=[],events=[],opened=[];
  class Node{
    constructor(id){this.id=id;this.style={};this.dataset={};this.listeners={};this.attributes={};this.nodes=[];this.isConnected=true;this.value='';this.hidden=false;this._html='';this.className='';
      this.classList={add:name=>{this.className+=' '+name;},remove:name=>{this.className=this.className.split(' ').filter(x=>x!==name).join(' ');},toggle:(name,on)=>on?this.classList.add(name):this.classList.remove(name),contains:name=>this.className.split(' ').includes(name)};
    }
    set innerHTML(html){
      this._html=String(html);this.nodes=[];
      if(this.id==='dynamic-section'&&this._html.includes('id="cur-list"')){
        for(const id of ['cur-search','cur-search-clear','cur-area','cur-level','cur-sort','cur-result-count','cur-list']){const node=new Node(id);ids.set(id,node);this.nodes.push(node);}
        for(const match of this._html.matchAll(/data-course-filter="([^"]+)"/g)){const node=new Node();node.dataset.courseFilter=match[1];this.nodes.push(node);}
      }
      if(this.id==='cur-list')for(const match of this._html.matchAll(/<article class="([^"]*curso-card[^"]*)" data-cid="([^"]+)"([^>]*)>/g)){const node=new Node();node.className=match[1];node.dataset.cid=match[2];if(match[3].includes('data-catalog-pending'))node.dataset.catalogPending='true';this.nodes.push(node);}
      if(this.id==='home-learning-card'){
        const button=new Node();button.dataset.homeCourse=/data-home-course="([^"]+)"/.exec(this._html)?.[1];this.nodes.push(button);
        const image=new Node();image.className='home-course__image';this.nodes.push(image);
      }
    }
    get innerHTML(){return this._html;}
    querySelectorAll(selector){
      if(selector==='[data-course-filter]')return this.nodes.filter(n=>'courseFilter' in n.dataset);
      if(selector==='.curso-card')return this.nodes.filter(n=>'cid' in n.dataset);
      if(selector==='[data-free-course-cta]')return [];
      return [];
    }
    querySelector(selector){if(selector.startsWith('#'))return ids.get(selector.slice(1))||null;if(selector==='[data-home-course]')return this.nodes.find(n=>'homeCourse' in n.dataset);if(selector==='.home-course__image')return this.nodes.find(n=>n.className==='home-course__image');return null;}
    addEventListener(name,fn){this.listeners[name]=fn;}
    setAttribute(name,value){this.attributes[name]=String(value);}
    focus(){}
    fire(name,extra={}){return this.listeners[name]?.({target:{closest:()=>null},key:'Enter',...extra});}
  }
  for(const id of ['inicio-content','dynamic-section','home-learning-card','bn-stat-cursos'])ids.set(id,new Node(id));
  const progress={course:{clasesVistas:[1],completado:false},next:{clasesVistas:[],completado:false}};
  const courses=[{id:'course',titulo:'Curso en progreso',area:'Legal',nivel:'Intermedio',horas:5,status:'progreso',portada:'/cover.jpg',access:{unlocked:true},sesiones:[{numero:1,accessible:true},{numero:2,accessible:true}]},{id:'next',titulo:'Otro curso',area:'Finanzas',nivel:'Básico',horas:3,portada:'/next.jpg',access:{unlocked:false},sesiones:[{numero:1},{numero:2}]}];
  const location=new URL('https://www.icademx.com/vip-panel.html#inicio');
  const window={__auth:{currentUser:{uid:'test-user'}},UserState:{modo:'vip'},dispatchEvent:event=>events.push(event),scrollTo(){}};
  const context={window,location,cursos:courses,_cursosLoaded:true,FREE_CLASS_COUNT:4,cursosState:{estado:'todos',area:'todas',nivel:'todos',search:'',orden:'proximos'},
    document:{addEventListener(){},getElementById:id=>ids.get(id)||null,querySelectorAll:selector=>selector==='[data-course-filter]'?ids.get('dynamic-section').querySelectorAll(selector):[]},
    history:{pushState(_,__,hash){location.hash=hash;},replaceState(_,__,hash){location.hash=hash;}},
    getProgresoCurso:id=>progress[id]||{clasesVistas:[],completado:false},getPortadaCurso:c=>c.portada,primerCursoGratisId:()=>'',toolEsVIP:()=>true,
    cursoDesbloqueado:(_,c)=>c.access?.unlocked===true,diasParaDesbloquear:(_,c)=>c.access?.unlocked?0:6,
    coverSVG:()=>'/fallback.svg',escapeHtml:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    __guardarContextoAprendizajeVIP:id=>opened.push(id),__seccionesValidasVIP:()=>new Set(['inicio','cursos','curso-detalle']),SECCION_DEFAULT_VIP:'inicio',__seccionActualVIP:'',
    __subirAlInicioVIP(){},sectionPlaceholder:()=>'',setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},clearInterval(){},requestAnimationFrame:fn=>frames.push(fn),
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},console};
  window.history=context.history;window.location=location;
  vm.createContext(context);
  const code=between(panel,'  window.__courseCoverICADEM =',"  document.addEventListener('icadem:course-unlocks-changed'")
    +between(panel,'  function progresoCursoPct(','  // ═══════════════════════════════════════════════════════════════\n  // 🎓 SPLASH')
    +between(panel,'  function actualizarInicioAprendizaje(){','  // ─── Cargar catálogo sanitizado')
    +between(panel,'  let cursosState={','  // ═══════════════════════════════════════════════════════════════════\n  // DETALLE DE CURSO')
    +between(panel,'  function openCursoDetalle(id){','  function renderCursoDetalle(container){')
    +between(panel,'function navigateToSection(section, opciones){','// Cada sección abre arriba.');
  vm.runInContext(code.replace(/\r\n/g,'\n'),context);
  context.Sections={renderers:{cursos:context.renderCursos,'curso-detalle':host=>{host.innerHTML='<h1>Detalle del curso</h1>';}},countdownTimer:null};
  return {context,ids,courses,progress,opened,events,timers,frames,navigate:section=>context.navigateToSection(section),async ready(){await flush();while(frames.length)frames.shift()();}};
}

test('actual Inicio -> Cursos -> Inicio navigation keeps the resume banner exclusive to Inicio and preserves its progress and button',async()=>{
  const f=campus(),original=plain(f.progress);f.navigate('inicio');await f.ready();
  const home=f.ids.get('home-learning-card'),initial=home.innerHTML;
  assert.match(initial,/CONTINÚA APRENDIENDO/);assert.match(initial,/aria-valuenow="50"/);assert.match(initial,/Continuar mi curso/);
  home.querySelector('[data-home-course]').fire('click');await f.ready();assert.deepEqual(f.opened,['course']);assert.equal(f.context.location.hash,'#curso-detalle');
  f.navigate('cursos');await f.ready();
  assert.equal(f.ids.get('inicio-content').style.display,'none');assert.equal(f.ids.get('dynamic-section').style.display,'');
  assert.doesNotMatch(f.ids.get('dynamic-section').innerHTML,/home-course|CONTINÚA APRENDIENDO|Continuar mi curso/);
  assert.doesNotMatch(f.ids.get('cur-list').innerHTML,/home-course|CONTINÚA APRENDIENDO|Continuar mi curso/);
  assert.equal(f.ids.get('cur-list').querySelectorAll('.curso-card').length,2);
  f.ids.get('cur-list').querySelectorAll('.curso-card')[0].fire('click');await f.ready();assert.deepEqual(f.opened,['course','course']);
  f.navigate('inicio');await f.ready();assert.equal(f.ids.get('inicio-content').style.display,'');assert.equal(f.ids.get('dynamic-section').style.display,'none');
  assert.equal(home.innerHTML,initial,'Inicio markup, metadata and progress remain identical');assert.deepEqual(plain(f.progress),original);
});

test('existing catalog search, progress filtering, locked state and keyboard entry still use the actual course renderers',async()=>{
  const f=campus(),original=plain(f.progress);f.navigate('cursos');await f.ready();
  const all=f.ids.get('cur-list').innerHTML;assert.match(all,/Continuar/);assert.match(all,/Se desbloquea en 6 días/);assert.match(all,/Ver detalles/);
  const filters=f.ids.get('dynamic-section').querySelectorAll('[data-course-filter]');filters.find(n=>n.dataset.courseFilter==='progreso').fire('click');
  assert.equal(f.ids.get('cur-list').querySelectorAll('.curso-card').length,1);f.ids.get('cur-list').querySelectorAll('.curso-card')[0].fire('keydown');await f.ready();assert.deepEqual(f.opened,['course']);
  f.navigate('cursos');await f.ready();f.ids.get('dynamic-section').querySelectorAll('[data-course-filter]').find(n=>n.dataset.courseFilter==='todos').fire('click');
  const search=f.ids.get('cur-search');search.value='Otro';search.fire('input');while(f.timers.length)f.timers.shift()();
  assert.equal(f.ids.get('cur-list').querySelectorAll('.curso-card').length,1);assert.equal(f.ids.get('cur-list').querySelectorAll('.curso-card')[0].dataset.cid,'next');
  assert.deepEqual(plain(f.progress),original);
});

function retos(status,rejected=false){
  const classes=new Set(),requests=[],published=[];
  const node=()=>({hidden:true,textContent:'',innerHTML:'',disabled:false,attributes:{},classList:{contains:()=>false,toggle(){}},setAttribute(k,v){this.attributes[k]=v;},replaceChildren(n){this.textContent=n.textContent;}});
  const access=node(),note=node(),state=node(),cta=node(),card=node();card.dataset={retoKey:'daily'};card.classList={toggle:(name,on)=>{card[name]=on;}};card.querySelector=s=>s==='[data-card-state]'?state:s==='.retos-tile__cta'?cta:null;
  const root={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},querySelector:s=>s==='[data-retos-access]'?access:s==='[data-retos-access-note]'?note:null,querySelectorAll:()=>[card]};
  const scope={uid:'test-user',generation:1},window={UserState:{credits:{balance:2080}},__icademJuegosPreload:[]};
  const context={window,document:{createTextNode:text=>({textContent:text})},platformSession:()=>scope,currentPlatformSession:()=>true,beginCreditRead:()=>({scope}),
    request:async path=>{requests.push(path);if(rejected)throw Error('offline');return status;},publishCredits:(value,meta)=>published.push({value,meta}),PRO_TYPES:['one','two','three','four','five','six','seven'],RETO_CREDITS:30};
  vm.createContext(context);vm.runInContext(between(platform,'  async function mountRetosStatus(target) {','  async function mountRanking(target) {'),context);
  return {root,access,note,state,cta,card,classes,requests,published,run:()=>context.mountRetosStatus(root)};
}
for(const [trial,visible,expected] of [['vip',false,''],['available',true,'1 partida gratis'],['active',true,'Termina tu partida gratis'],['used',true,'Ya usaste tu partida gratis']])test('Retos '+trial+': empty VIP note disappears while genuine trial information stays functional',async()=>{
  const data={trial,balance:2080,used:[],dailyUsedToday:trial==='used'},f=retos(data);await f.run();
  assert.deepEqual(f.requests,['/api/retos/status']);assert.equal(f.note.hidden,!visible);assert.equal(f.classes.has('has-access-note'),visible);
  assert.ok(expected?f.note.textContent.includes(expected):f.note.textContent==='');assert.equal(f.published[0].value.balance,2080);
  assert.equal(f.cta.disabled,trial==='used');assert.deepEqual(plain(data),{trial,balance:2080,used:[],dailyUsedToday:trial==='used'});
});
test('Retos load failure preserves initial hidden note and reports unavailable state without claiming a reward',async()=>{
  const f=retos({},true);await f.run();assert.equal(f.note.hidden,true);assert.equal(f.access.textContent,'Estado no disponible');assert.equal(f.published.length,0);assert.equal(f.cta.disabled,false);
});
