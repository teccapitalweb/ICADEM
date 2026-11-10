'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-resume-editor.js','utf8'),flush=()=>new Promise(setImmediate),copy=value=>JSON.parse(JSON.stringify(value));
const decode=value=>String(value).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
// A small DOM transport for the editor's actual HTML/forms and real handlers.
// It models tree replacement, input values, bubbling, focus and disabled fields;
// layout and browser-native validation remain part of the separate browser QA.
function app(){
  const documentEvents=new Map(),windowEvents=new Map(),loads=[],saves=[],closed=[],previews=[];let uuid=0;
  const document={activeElement:null,addEventListener(name,fn){if(!documentEvents.has(name))documentEvents.set(name,[]);documentEvents.get(name).push(fn);}};
  class Element{
    constructor(tag='div',attributes={}){this.tagName=tag;this.attributes={...attributes};this.dataset={};this.children=[];this.parentNode=null;this.listeners=new Map();this._value=null;this._text='';this._html='';this.hidden='hidden'in attributes;this.disabled='disabled'in attributes;this.checked='checked'in attributes;this.open='open'in attributes;
      Object.entries(attributes).forEach(([key,value])=>{if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;});
      this.classList={toggle:(name,on)=>{const all=new Set(String(this.attributes.class||'').split(/\s+/));on?all.add(name):all.delete(name);this.attributes.class=[...all].join(' ');},contains:name=>String(this.attributes.class||'').split(/\s+/).includes(name)};
    }
    get isConnected(){return this===document.body||!!this.parentNode?.isConnected;}
    append(node){node.parentNode=this;this.children.push(node);}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}
    replaceChildren(){this.children.forEach(node=>node.parentNode=null);this.children=[];this._text='';this._html='';}
    get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}set textContent(value){this.replaceChildren();this._text=String(value);}
    get innerHTML(){return this._html;}set innerHTML(value){this.replaceChildren();this._html=String(value);const stack=[this],voids=new Set(['input','img','br','hr','meta','link']);
      for(const token of this._html.matchAll(/<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)([^>]*)>|([^<]+)/gi)){
        if(token[1]){if(stack.length>1)stack.pop();continue;}
        if(token[2]){const attributes={};for(const a of token[3].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attributes[a[1]]=decode(a[2]??a[3]??a[4]??'');const node=new Element(token[2],attributes);stack.at(-1).append(node);if(!voids.has(token[2]))stack.push(node);}
        else if(token[4])stack.at(-1)._text+=decode(token[4]);
      }
    }
    get value(){if(this.attributes.type==='color'){const raw=this._value??this.attributes.value;return /^#[a-f0-9]{6}$/i.test(raw)?raw.toLowerCase():'#000000';}if(this._value!==null)return this._value;if(this.tagName==='textarea')return this.textContent;if(this.tagName==='select'){const options=this.querySelectorAll('option');return(options.find(node=>'selected'in node.attributes)||options[0])?.attributes.value||'';}return this.attributes.value||'';}set value(value){this._value=String(value);}
    get name(){return this.attributes.name||'';}get elements(){return{namedItem:name=>this.querySelector('[name="'+name+'"]')};}
    matches(selector){if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));const attr=/^\[([^=\]]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]$/.exec(selector);if(!attr)return this.tagName===selector;const value=attr[1].startsWith('data-')?this.dataset[attr[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:this.attributes[attr[1]],expected=attr[2]??attr[3]??attr[4];return value!==undefined&&(expected===undefined||value===expected);}
    querySelectorAll(selector){const found=[],parts=selector.split(',');function visit(node){for(const child of node.children){if(parts.some(part=>child.matches(part.trim())))found.push(child);visit(child);}}visit(this);return found;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    setAttribute(name,value){this.attributes[name]=String(value);if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}removeAttribute(name){delete this.attributes[name];}
    focus(){if(this.isConnected)document.activeElement=this;}
    addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn);}
    reportValidity(){return true;}
    async emit(name){const event={type:name,target:this,currentTarget:this,preventDefault(){this.defaultPrevented=true;}};for(let node=this;node;node=node.parentNode){event.currentTarget=node;for(const fn of node.listeners.get(name)||[])await fn(event);}return event;}
    async click(){for(let node=this;node;node=node.parentNode)if(node.disabled)return;return this.emit('click');}
  }
  document.body=new Element('body');const root=new Element();document.body.append(root);
  document.createElement=tag=>new Element(tag);document.querySelectorAll=selector=>document.body.querySelectorAll(selector);document.querySelector=selector=>document.body.querySelector(selector);
  const window={UserState:{uid:'owner'},crypto:{randomUUID:()=>`entry-${++uuid}`},ICADEMProfessionalNavigation:{currentProfileId:()=>window.UserState.uid},addEventListener(name,fn){windowEvents.set(name,fn);}};
  const context={window,document,location:{hash:'#directorio-perfil'},Date,Math};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../js/icadem-directory.js','utf8'),context);vm.runInContext(source,context);
  const options={container:root,profile:profile(),load:()=>new Promise((resolve,reject)=>loads.push({resolve,reject})),save:payload=>new Promise((resolve,reject)=>saves.push({payload:copy(payload),resolve,reject})),renderProfile:p=>{previews.push(copy(p));return '<article>Vista profesional</article>';},onClose:p=>closed.push(copy(p))};
  return{root,window,document,loads,saves,closed,previews,options,api:window.ICADEMResumeEditor,form:key=>root.querySelector('[data-cve-form="'+key+'"]'),field:(key,name)=>root.querySelector('[data-cve-form="'+key+'"]').querySelector('[name="'+name+'"]'),async open(p=profile()){options.profile=p;const opening=window.ICADEMResumeEditor.open(options);loads.at(-1).resolve({profile:copy(p)});await opening;},emitDocument(name){for(const fn of documentEvents.get(name)||[])fn({type:name});},emitWindow(name,event={}){return windowEvents.get(name)?.(event);}};
}
function profile(extra={}){return{uid:'owner',own:true,isVip:true,nombre:'Persona',foto:'https://images.test/current.jpg',contacts:{email:'private@test.invalid'},cv:{resumen:'Presentación confirmada',idiomas:[{id:'language',idioma:'Español',nivel:'Nativo'}],experiencia:[{id:'job-1',empresa:'Primera',cargo:'Asesor'},{id:'job-2',empresa:'Segunda',cargo:'Director'}],visibilidad:{sobreMi:'public',experiencia:'public',idiomas:'private'},revisiones:{sobreMi:2,experiencia:3,idiomas:1},estilo:{savedColor:'#316789',color:'#316789',editable:true}},...extra};}
async function input(a,key,name,value){const field=a.field(key,name);field.value=value;await field.emit('input');}

test('section saving waits for the server, sends only that section and preserves drafts in other sections',async()=>{
  const a=app();await a.open();await input(a,'sobreMi','resumen','Mi nueva presentación');await input(a,'habilidades','herramientas','Excel\nPower BI');
  const submitted=a.form('sobreMi').emit('submit');await flush();assert.equal(a.saves.length,1);assert.deepEqual(Object.keys(a.saves[0].payload).sort(),['data','revision','section','visibility']);
  assert.equal(a.saves[0].payload.section,'sobreMi');assert.equal(a.saves[0].payload.revision,2);assert.equal(a.saves[0].payload.data.resumen,'Mi nueva presentación');assert.match(a.form('sobreMi').querySelector('[data-cve-section-status]').textContent,/Guardando/);
  await input(a,'habilidades','competencias','Trabajo en equipo');assert.equal(a.closed.length,0);
  const confirmed=profile();confirmed.cv.resumen='Mi nueva presentación';confirmed.cv.revisiones.sobreMi=3;a.saves[0].resolve({profile:confirmed});await submitted;
  assert.match(a.form('sobreMi').querySelector('[data-cve-section-status]').textContent,/confirmados/);assert.equal(a.field('habilidades','herramientas').value,'Excel\nPower BI');assert.equal(a.field('habilidades','competencias').value,'Trabajo en equipo');assert.equal(a.api.isDirty(),true);
});

test('public preview includes unsaved public drafts, hides private sections and contacts, and performs no write',async()=>{
  const a=app();await a.open();await input(a,'sobreMi','resumen','Texto solo de borrador');await a.root.querySelector('[data-cve-preview]').click();
  assert.equal(a.root.querySelector('h1').attributes.tabindex,'-1');assert.ok(a.document.activeElement===a.root.querySelector('h1'));
  const preview=a.previews.at(-1);assert.equal(preview.cv.resumen,'Texto solo de borrador');assert.equal(preview.cv.idiomas,undefined);assert.equal(preview.cv.enlaces,undefined);assert.deepEqual(preview.contacts,{});assert.equal(preview.own,false);assert.equal(a.saves.length,0);assert.equal(a.closed.length,0);
  await a.root.querySelector('[data-cve-return]').click();assert.equal(a.field('sobreMi','resumen').value,'Texto solo de borrador');assert.equal(a.api.isDirty(),true);
});

test('409 conflicts keep the draft and reloading that section preserves every other draft and obtains the new revision',async()=>{
  const a=app();await a.open();await input(a,'sobreMi','resumen','Mi borrador');await input(a,'habilidades','herramientas','Excel');const submitted=a.form('sobreMi').emit('submit');await flush();a.saves[0].reject(Object.assign(new Error('conflict'),{status:409}));await submitted;
  assert.equal(a.field('sobreMi','resumen').value,'Mi borrador');assert.match(a.form('sobreMi').querySelector('[data-cve-section-status]').textContent,/otra sesión/);assert.equal(a.form('sobreMi').querySelector('[data-cve-reload]').hidden,false);
  const reload=a.form('sobreMi').querySelector('[data-cve-reload]').click();await flush();const latest=profile();latest.cv.resumen='Versión de otro dispositivo';latest.cv.revisiones.sobreMi=8;a.loads.at(-1).resolve({profile:latest});await reload;
  assert.equal(a.field('sobreMi','resumen').value,'Versión de otro dispositivo');assert.equal(a.field('habilidades','herramientas').value,'Excel');const retry=a.form('sobreMi').emit('submit');await flush();assert.equal(a.saves.at(-1).payload.revision,8);a.saves.at(-1).resolve({profile:latest});await retry;
});

test('failure preserves input and selection and never announces a successful save',async()=>{
  const a=app();await a.open();await input(a,'sobreMi','resumen','Borrador en móvil');a.field('sobreMi','visibility').value='connections';await a.field('sobreMi','visibility').emit('input');
  const submitted=a.form('sobreMi').emit('submit');await flush();a.saves[0].reject(new Error('Sin conexión'));await submitted;
  assert.equal(a.field('sobreMi','resumen').value,'Borrador en móvil');assert.equal(a.field('sobreMi','visibility').value,'connections');assert.match(a.form('sobreMi').querySelector('[data-cve-section-status]').textContent,/Sin conexión/);assert.doesNotMatch(a.form('sobreMi').querySelector('[data-cve-section-status]').textContent,/confirmados/);
});

test('list entries can be added, reordered and removed as drafts without writing until confirmed',async()=>{
  const a=app();await a.open();await a.form('experiencia').querySelector('[data-cve-add]').click();let rows=a.form('experiencia').querySelectorAll('[data-cve-row]');assert.equal(rows.length,3);rows[2].querySelector('[name="empresa"]').value='Tercera';await rows[2].querySelector('[name="empresa"]').emit('input');
  await rows[2].querySelector('[data-cve-move="-1"]').click();rows=a.form('experiencia').querySelectorAll('[data-cve-row]');assert.equal(rows[1].querySelector('[name="empresa"]').value,'Tercera');await rows[0].querySelector('[data-cve-remove]').click();
  assert.equal(a.form('experiencia').querySelectorAll('[data-cve-row]').length,2);assert.equal(a.saves.length,0);const submitted=a.form('experiencia').emit('submit');await flush();assert.deepEqual(a.saves[0].payload.data.map(row=>row.empresa),['Tercera','Segunda']);a.saves[0].resolve({profile:profile()});await submitted;
});

test('session changes clear the editor and a late successful response cannot restore private drafts',async()=>{
  const a=app();await a.open();await input(a,'sobreMi','resumen','Dato privado pendiente');const submitted=a.form('sobreMi').emit('submit');await flush();a.emitDocument('icadem:user-ready');assert.equal(a.root.children.length,0);
  a.saves[0].resolve({profile:profile()});await submitted;assert.equal(a.root.children.length,0);assert.equal(a.closed.length,0);assert.equal(a.api.isDirty(),false);
});

test('a structural edit during a pending save cannot replace the active form or hide a later error',async()=>{
  const a=app();await a.open();await input(a,'sobreMi','resumen','Mi borrador');const form=a.form('sobreMi'),submitted=form.emit('submit');await flush();
  await a.form('experiencia').querySelector('[data-cve-add]').click();assert.ok(a.form('sobreMi')===form,'the pending form must remain mounted');assert.equal(form.isConnected,true);
  a.saves[0].reject(new Error('No se guardó'));await submitted;assert.match(a.form('sobreMi').querySelector('[data-cve-section-status]').textContent,/No se guardó/);assert.equal(a.field('sobreMi','resumen').value,'Mi borrador');
});

test('a conflict reload cannot replace an owner profile with data for another account',async()=>{
  const a=app();await a.open();await input(a,'sobreMi','resumen','Borrador dueño');const submitted=a.form('sobreMi').emit('submit');await flush();a.saves[0].reject(Object.assign(new Error('conflict'),{status:409}));await submitted;
  const reload=a.form('sobreMi').querySelector('[data-cve-reload]').click();await flush();a.loads.at(-1).resolve({profile:profile({uid:'other',own:false,cv:{resumen:'Perfil ajeno'}})});await reload;
  assert.equal(a.field('sobreMi','resumen').value,'Borrador dueño');assert.doesNotMatch(a.root.textContent,/Perfil ajeno/);assert.match(a.root.querySelector('[data-cve-status]').textContent,/confirmar/);
});

test('a failed initial load remains safely retryable and beforeunload does not inspect incomplete drafts',async()=>{
  const a=app(),opening=a.api.open(a.options);a.loads[0].reject(new Error('Servicio no disponible'));await opening;
  assert.equal(a.api.isOpen(a.root),true);assert.equal(a.api.isDirty(),false);assert.doesNotThrow(()=>a.emitWindow('beforeunload',{preventDefault(){throw Error('no draft exists');}}));
  await a.root.querySelector('[data-cve-retry]').click();await flush();a.loads.at(-1).resolve({profile:profile()});await flush();assert.equal(a.field('sobreMi','resumen').value,'Presentación confirmada');
});

test('VIP style choices preview independently from the directory cover, and free profiles keep their saved preference read-only',async()=>{
  const a=app();await a.open(profile({portadaColor:'#316789'}));const style=a.form('estilo');await style.querySelector('[data-cve-swatch="#E9BC43"]').click();
  assert.equal(a.form('estilo').querySelector('[data-cve-color]').value,'#e9bc43');assert.equal(a.previews.at(-1).cv.estilo.color,'#E9BC43');assert.equal(a.previews.at(-1).portadaColor,'#316789');assert.equal(a.saves.length,0);
  await a.form('estilo').querySelector('[data-cve-reset]').click();const submitted=a.form('estilo').emit('submit');await flush();assert.equal(a.saves[0].payload.section,'estilo');assert.equal(a.saves[0].payload.data.reset,true);assert.equal(a.saves[0].payload.data.color,'#244b64');a.saves[0].resolve({profile:profile()});await submitted;
  const b=app(),free=profile({isVip:false});free.cv.estilo.editable=false;await b.open(free);assert.equal(b.form('estilo').querySelector('fieldset').disabled,true);await b.form('estilo').querySelector('[data-cve-swatch="#E9BC43"]').click();assert.equal(b.saves.length,0);assert.equal(b.previews.at(-1).cv.estilo.color,'#244B64');assert.equal(b.field('sobreMi','resumen').disabled,false);
});

test('cancel is scoped to one draft, and leaving requires an explicit discard without publishing',async()=>{
  const a=app();await a.open();await input(a,'sobreMi','resumen','Texto pendiente');await input(a,'habilidades','herramientas','Excel');await a.form('sobreMi').querySelector('[data-cve-cancel]').click();
  assert.equal(a.field('sobreMi','resumen').value,'Presentación confirmada');assert.equal(a.field('habilidades','herramientas').value,'Excel');await a.root.querySelector('[data-cve-back]').click();assert.equal(a.root.querySelector('[data-cve-leave]').hidden,false);assert.equal(a.closed.length,0);
  await a.root.querySelector('[data-cve-stay]').click();assert.equal(a.root.querySelector('[data-cve-leave]').hidden,true);await a.root.querySelector('[data-cve-back]').click();await a.root.querySelector('[data-cve-discard]').click();assert.equal(a.closed.length,1);assert.equal(a.saves.length,0);assert.equal(a.api.isOpen(),false);
});

test('the actual community refresh and an earlier in-flight profile read cannot replace an open editor draft',async()=>{
  for(const rejected of[false,true]){
    const a=app();a.root.dataset.profileUid='owner';let resolve,reject,reads=0,paints=0;
    const community=fs.readFileSync(__dirname+'/../js/icadem-community.js','utf8'),loadStart=community.indexOf('  async function loadProfile('),loadEnd=community.indexOf('  function openCardEditor(',loadStart),refreshStart=community.indexOf('  function refreshCurrentProfile(){'),refreshEnd=community.indexOf('  async function copyProfileLink(',refreshStart);
    const context={window:a.window,document:a.document,generation:1,context:{kind:'profile',viewer:'owner',root:{isConnected:true,querySelector:()=>a.root}},api:()=>{reads++;return new Promise((yes,no)=>{resolve=yes;reject=no;});},paintProfile(){paints++;},esc:value=>value};
    vm.createContext(context);vm.runInContext(community.slice(loadStart,loadEnd)+community.slice(refreshStart,refreshEnd),context);
    const earlier=context.loadProfile(a.root,'owner');await a.open();await input(a,'sobreMi','resumen','Borrador que debe sobrevivir');context.refreshCurrentProfile();assert.equal(reads,1);
    rejected?reject(new Error('Error de lectura tardío')):resolve({profile:profile()});await earlier;
    assert.equal(paints,0);assert.equal(a.field('sobreMi','resumen').value,'Borrador que debe sobrevivir');assert.equal(a.api.isOpen(a.root),true);
  }
});

test('legacy skills remain editable when the modern field is absent, while an intentional modern empty array stays empty',async()=>{
  const legacy=profile();legacy.cv.habilidades=['Argumentación','Excel'];const a=app();await a.open(legacy);assert.equal(a.field('habilidades','habilidadesTecnicas').value,'Argumentación\nExcel');
  const modern=profile();modern.cv.habilidades=['Dato anterior'];modern.cv.habilidadesTecnicas=[];const b=app();await b.open(modern);assert.equal(b.field('habilidades','habilidadesTecnicas').value,'');
});

test('public preview removes contact URLs hidden in certificate identifiers and leaves ordinary identifiers intact',async()=>{
  const a=app(),p=profile();p.cv.visibilidad.certificaciones='public';p.cv.certificaciones=[{id:'cert-1',nombre:'Certificación propia',identificador:'https://private.test/verify/token',url:'https://private.test/cert'},{id:'cert-2',nombre:'Certificación sin enlace',identificador:'ABC-2026'}];
  await a.open(p);await a.root.querySelector('[data-cve-preview]').click();const preview=a.previews.at(-1);
  assert.equal(preview.cv.certificaciones[0].url,undefined);assert.equal(preview.cv.certificaciones[0].identificador,undefined);assert.equal(preview.cv.certificaciones[1].identificador,'ABC-2026');assert.equal(a.saves.length,0);
});

test('existing custom select text keeps its label and value through unrelated saves without altering other option lists',async()=>{
  const a=app(),p=profile();p.cv.formacion=[{id:'edu-1',institucion:'Universidad',titulo:'Licenciatura',estado:'Concluido'},{id:'edu-2',institucion:'Otra universidad',titulo:'Maestría',estado:'Finalizado'}];
  await a.open(p);let rows=a.form('formacion').querySelectorAll('[data-cve-row]'),selected=rows[0].querySelector('[name="estado"]');
  assert.equal(selected.value,'Concluido');assert.equal(selected.querySelector('[value="Concluido"]').textContent,'Concluido');assert.equal(rows[1].querySelector('[name="estado"]').querySelector('[value="Concluido"]'),null);
  await input(a,'sobreMi','resumen','Presentación actualizada');const submitted=a.form('sobreMi').emit('submit');await flush();const confirmed=copy(p);confirmed.cv.resumen='Presentación actualizada';confirmed.cv.revisiones.sobreMi=3;a.saves[0].resolve({profile:confirmed});await submitted;
  selected=a.form('formacion').querySelector('[data-cve-row]').querySelector('[name="estado"]');assert.equal(selected.value,'Concluido');
  const education=a.form('formacion').emit('submit');await flush();assert.equal(a.saves[1].payload.data[0].estado,'Concluido');assert.equal(a.saves[1].payload.data[1].estado,'Finalizado');a.saves[1].resolve({profile:confirmed});await education;
});

test('untouched legacy rows and uppercase colors normalize consistently without a false draft or leave warning',async()=>{
  const a=app(),p=profile();p.cv.experiencia=[{id:'legacy-job',empresa:'ICADEM',cargo:'Consultor',periodo:'2020–actualidad',actual:true,fin:'2026-01'}];p.cv.formacion=[{id:'legacy-education',institucion:'Escuela',titulo:'Diplomado',estado:'Concluido',periodo:'2017'}];p.cv.idiomas=[{id:'legacy-language',idioma:'Español'}];p.cv.estilo={color:'#E9BC43',savedColor:'#E9BC43',editable:true};
  const original=JSON.stringify(p);await a.open(p);assert.equal(a.api.isDirty(),false);assert.equal(a.form('estilo').querySelector('[data-cve-color]').value,'#e9bc43');
  assert.equal(a.form('experiencia').querySelector('[name="fin"]').value,'');assert.equal(a.form('idiomas').querySelector('[name="nivel"]').value,'A1');
  const draft=a.previews.at(-1);assert.equal(draft.cv.experiencia[0].id,'legacy-job');assert.equal(draft.cv.experiencia[0].periodo,'2020–actualidad');assert.equal(draft.cv.formacion[0].periodo,'2017');assert.equal(JSON.stringify(p),original);
  await input(a,'sobreMi','resumen','Solo esta sección cambia');assert.equal(a.api.isDirty(),true);await a.form('sobreMi').querySelector('[data-cve-cancel]').click();assert.equal(a.api.isDirty(),false);
  await a.root.querySelector('[data-cve-back]').click();assert.equal(a.closed.length,1);assert.equal(a.api.isOpen(),false);assert.equal(a.saves.length,0);
});

test('the actual new-editor basic bridge submits only basic fields and contacts while preserving the expanded curriculum',async()=>{
  const a=app(),community=fs.readFileSync(__dirname+'/../js/icadem-community.js','utf8'),modalCalls=[],patches=[];let bridge;
  a.window.ICADEMResumeEditor={open:options=>{bridge=options;}};
  const modal={open(config){modalCalls.push(config);a.document.body.append(config.body);return{close(){config.body.remove();config.onClose?.();}};}};
  const ctx={window:a.window,document:a.document,generation:1,context:{kind:'profile',root:{querySelector:()=>a.root},modal},profileMarkup:()=>'',loadProfile(){},openCardEditor(){},wire(){},notify(){},api(path,options){return new Promise((resolve,reject)=>patches.push({path,options:copy(options),resolve,reject}));}};
  vm.createContext(ctx);const start=community.indexOf('  var fieldSequence = 0;'),end=community.indexOf('  function forumState(',start);vm.runInContext(community.slice(community.indexOf('  var names = {'),community.indexOf('  function icon('))+community.slice(start,end),ctx);
  const p=profile();p.contactScopes={whatsapp:'vip',email:'vip',linkedin:'connections',instagram:'hidden',facebook:'hidden',web:'vip'};p.cv.experiencia[0]={...p.cv.experiencia[0],inicio:'2020-01',fin:'',actual:true,logros:'Logros ampliados'};p.cv.formacion=[{id:'education',titulo:'Licenciatura',inicio:'2015-01',fin:'2019-01',estado:'Concluido',descripcion:'Formación ampliada'}];p.cv.habilidadesTecnicas=['Excel'];p.cv.proyectos=[{id:'project',nombre:'Proyecto real'}];p.cv.certificaciones=[{id:'certificate',nombre:'Certificación declarada'}];
  const protectedFields=['resumen','habilidadesTecnicas','experiencia','formacion','idiomas','proyectos','certificaciones','estilo'],before=Object.fromEntries(protectedFields.map(key=>[key,copy(p.cv[key])]));
  ctx.editCv(p);assert.ok(bridge);bridge.onBasic(p);const form=modalCalls.at(-1).body;assert.equal(modalCalls.at(-1).title,'Datos básicos y contactos');
  for(const field of['resumen','habilidades'])assert.equal(form.elements.namedItem(field),null);assert.equal(form.querySelector('[data-editor-experiencia]'),null);assert.equal(form.querySelector('[data-editor-formacion]'),null);
  form.elements.namedItem('profesion').value='Consultora';form.elements.namedItem('facebook').value='https://www.facebook.com/mi-perfil';form.elements.namedItem('scope-email').value='hidden';const submit=form.emit('submit');await flush();
  assert.equal(patches[0].path,'/profile');assert.equal(patches[0].options.method,'PATCH');const payload=patches[0].options.body;
  assert.deepEqual(Object.keys(payload).sort(),['areas','ciudad','contactScopes','especialidad','facebook','profesion']);for(const key of['resumen','habilidades','experiencia','formacion','estilo'])assert.equal(Object.hasOwn(payload,key),false);
  const confirmed=copy(p);for(const key of['profesion','especialidad','ciudad','areas'])confirmed.cv[key]=payload[key];confirmed.contactScopes=payload.contactScopes;confirmed.contacts.facebook=payload.facebook;patches[0].resolve({profile:confirmed});await submit;
  for(const key of protectedFields)assert.deepEqual(confirmed.cv[key],before[key]);
  delete a.window.ICADEMResumeEditor;ctx.editCv(p);const fallback=modalCalls.at(-1).body;assert.ok(fallback.elements.namedItem('resumen'));assert.ok(fallback.elements.namedItem('habilidades'));assert.ok(fallback.querySelector('[data-editor-experiencia]'));assert.ok(fallback.querySelector('[data-editor-formacion]'));
});
