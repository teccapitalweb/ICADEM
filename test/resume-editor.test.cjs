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
    constructor(tag='div',attributes={}){this.tagName=tag;this.attributes={...attributes};this.dataset={};this.style={};this.children=[];this.parentNode=null;this.listeners=new Map();this._value=null;this._text='';this._html='';this.hidden='hidden'in attributes;this.disabled='disabled'in attributes;this.checked='checked'in attributes;this.open='open'in attributes;
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
    matches(selector){if(selector.startsWith('#'))return this.attributes.id===selector.slice(1);if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));const compound=/^([\w-]+)(\[.+\])$/.exec(selector);if(compound)return this.tagName===compound[1]&&this.matches(compound[2]);const attr=/^\[([^=\]]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]$/.exec(selector);if(!attr)return this.tagName===selector;const value=attr[1].startsWith('data-')?this.dataset[attr[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:this.attributes[attr[1]],expected=attr[2]??attr[3]??attr[4];return value!==undefined&&(expected===undefined||value===expected);}
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
  const context={window,document,location:{hash:'#directorio-perfil'},Date,Math};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../js/icadem-directory.js','utf8'),context);vm.runInContext(fs.readFileSync(__dirname+'/../js/icadem-cv-languages.js','utf8'),context);vm.runInContext(source,context);
  const options={container:root,profile:profile(),load:()=>new Promise((resolve,reject)=>loads.push({resolve,reject})),save:payload=>new Promise((resolve,reject)=>saves.push({payload:copy(payload),resolve,reject})),renderProfile:p=>{previews.push(copy(p));return '<article>Vista profesional</article>';},onClose:p=>closed.push(copy(p))};
  return{root,window,document,loads,saves,closed,previews,options,api:window.ICADEMResumeEditor,form:key=>root.querySelector('[data-cve-form="'+key+'"]'),field:(key,name)=>root.querySelector('[data-cve-form="'+key+'"]').querySelector('[name="'+name+'"]'),async open(p=profile()){options.profile=p;const opening=window.ICADEMResumeEditor.open(options);loads.at(-1).resolve({profile:copy(p)});await opening;},emitDocument(name){for(const fn of documentEvents.get(name)||[])fn({type:name});},emitWindow(name,event={}){return windowEvents.get(name)?.(event);}};
}
function profile(extra={}){return{uid:'owner',own:true,isVip:true,nombre:'Persona',foto:'https://images.test/current.jpg',contacts:{email:'private@test.invalid'},cv:{resumen:'Presentación confirmada',idiomas:[{id:'language',idioma:'Español',nivel:'Nativo'}],experiencia:[{id:'job-1',empresa:'Primera',cargo:'Asesor'},{id:'job-2',empresa:'Segunda',cargo:'Director'}],visibilidad:{sobreMi:'public',experiencia:'public',idiomas:'private'},revisiones:{sobreMi:2,experiencia:3,idiomas:1},estilo:{savedColor:'#316789',color:'#316789',editable:true}},...extra};}
function sharedProfile(extra={}){return profile({editor:{basicos:{revision:4,conflicts:[],data:{nombre:'María del Carmen Hernández López',authEmail:'access@test.invalid',profesion:'Ingeniera',puesto:'Directora',especialidad:'Desarrollo de software',sector:'Tecnología',empresa:'Empresa original',ubicacion:'Puebla',bio:'Bio breve',areas:'Desarrollo de productos',visible:true}},contactos:{revision:5,conflicts:[],data:{email:'work@test.invalid',whatsapp:'+522381234567',linkedin:'https://linkedin.com/in/persona',instagram:'@persona',web:'https://example.test',facebook:'',contactScopes:{email:'connections',whatsapp:'hidden',linkedin:'vip',instagram:'hidden',web:'vip',facebook:'hidden'}}},apariencia:{revision:6,conflicts:[],data:{foto:'https://images.test/current.jpg',fotoOrigen:'custom',photoVersion:'photo-v1',portadaUrl:'https://images.test/cover.jpg',portadaColor:'#E9BC43',portadaColorPersonalizado:false}}},...extra});}
async function input(a,key,name,value){const field=a.field(key,name);field.value=value;await field.emit('input');}

test('an active identity photo change updates future previews without replacing forms, publishing, or changing another account',async()=>{
 const a=app();await a.open();await input(a,'sobreMi','resumen','Borrador que debe conservarse');const form=a.form('sobreMi');
 a.api.syncPhoto({uid:'owner',photoURL:'https://lh3.googleusercontent.com/updated',photoVersion:'v2',photoSource:'google'});
 assert.equal(a.form('sobreMi'),form);assert.equal(a.field('sobreMi','resumen').value,'Borrador que debe conservarse');assert.equal(a.saves.length,0);
 await a.root.querySelector('[data-cve-preview]').click();assert.equal(a.previews.at(-1).foto,'https://lh3.googleusercontent.com/updated');assert.equal(a.previews.at(-1).photoVersion,'v2');
 a.api.syncPhoto({uid:'another-account',photoURL:'https://images.test/foreign'});await a.root.querySelector('[data-cve-return]').click();await a.root.querySelector('[data-cve-preview]').click();assert.equal(a.previews.at(-1).foto,'https://lh3.googleusercontent.com/updated');
});

test('a CV save started before a new identity photo confirmation cannot restore the old photo in its delayed acknowledgement',async()=>{
 const a=app();await a.open();await input(a,'sobreMi','resumen','Cambio confirmado');const saving=a.form('sobreMi').emit('submit');await flush();
 a.api.syncPhoto({uid:'owner',photoURL:'https://lh3.googleusercontent.com/new-during-save',photoVersion:'v3',photoSource:'google'});
 const ack=profile();ack.cv.resumen='Cambio confirmado';ack.cv.revisiones.sobreMi=3;a.saves[0].resolve({profile:ack});await saving;
 await a.root.querySelector('[data-cve-preview]').click();assert.equal(a.previews.at(-1).foto,'https://lh3.googleusercontent.com/new-during-save');assert.equal(a.previews.at(-1).photoVersion,'v3');assert.equal(a.previews.at(-1).cv.resumen,'Cambio confirmado');
});

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
  const a=app();await a.open();await input(a,'sobreMi','resumen','Dato privado pendiente');const submitted=a.form('sobreMi').emit('submit');await flush();a.window.UserState.uid='other-account';a.emitDocument('icadem:user-ready');assert.equal(a.root.children.length,0);
  a.saves[0].resolve({profile:profile()});await submitted;assert.equal(a.root.children.length,0);assert.equal(a.closed.length,0);assert.equal(a.api.isDirty(),false);
});

test('a repeated ready event for the same account preserves an editor during loading and after unsaved edits',async()=>{
 const a=app(),p=sharedProfile(),opening=a.api.open(a.options);assert.match(a.root.textContent,/Cargando tu perfil profesional/);const loading=a.root.querySelector('[role="status"]');a.emitDocument('icadem:user-ready');assert.equal(a.root.querySelector('[role="status"]'),loading);assert.equal(a.api.isOpen(),true);a.loads[0].resolve({profile:p});await opening;await input(a,'basicos','empresa','Borrador protegido');const form=a.form('basicos');a.emitDocument('icadem:user-ready');assert.equal(a.form('basicos'),form);assert.equal(a.field('basicos','empresa').value,'Borrador protegido');assert.equal(a.api.isDirty(),true);assert.equal(a.saves.length,0);
 a.emitDocument('icadem:session-ending');assert.equal(a.root.children.length,0);assert.equal(a.api.isOpen(),false);
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
  assert.equal(a.form('experiencia').querySelector('[name="fin"]').value,'');assert.equal(a.form('idiomas').querySelector('[name="nivel"]').value,'');
  const draft=a.previews.at(-1);assert.equal(draft.cv.experiencia[0].id,'legacy-job');assert.equal(draft.cv.experiencia[0].periodo,'2020–actualidad');assert.equal(draft.cv.formacion[0].periodo,'2017');assert.equal(JSON.stringify(p),original);
  await input(a,'sobreMi','resumen','Solo esta sección cambia');assert.equal(a.api.isDirty(),true);await a.form('sobreMi').querySelector('[data-cve-cancel]').click();assert.equal(a.api.isDirty(),false);
  await a.root.querySelector('[data-cve-back]').click();assert.equal(a.closed.length,1);assert.equal(a.api.isOpen(),false);assert.equal(a.saves.length,0);
});

test('one editor contains twelve sections and changing profession never submits a position, biography or CV summary',async()=>{
  const a=app(),p=sharedProfile();a.options.saveShared=a.options.save;await a.open(p);
  assert.equal(a.root.querySelectorAll('[data-cve-section]').length,12);assert.match(a.root.querySelector('h1').textContent,/Editar mi perfil profesional/);assert.equal(a.api.isDirty(),false);
  await input(a,'basicos','profesion','Consultora');await input(a,'sobreMi','resumen','Resumen aún pendiente');const submit=a.form('basicos').emit('submit');await flush();
  assert.deepEqual(a.saves[0].payload,{section:'basicos',revision:4,data:{profesion:'Consultora'}});
  const confirmed=copy(p);confirmed.editor.basicos.data.profesion='Consultora';confirmed.editor.basicos.revision++;a.saves[0].resolve({profile:confirmed});await submit;
  assert.equal(a.field('basicos','puesto').value,'Directora');assert.equal(a.field('basicos','bio').value,'Bio breve');assert.equal(a.field('sobreMi','resumen').value,'Resumen aún pendiente');assert.equal(a.api.isDirty(),true);
});

function languageRow(a,index=0){return a.form('idiomas').querySelectorAll('[data-cve-row]')[index];}
async function languageInput(a,index,name,value,change=false){const el=languageRow(a,index).querySelector('[name="'+name+'"]');el.value=value;await el.emit('input');if(change)await el.emit('change');}

test('language editor keeps legacy MCER/native records and unknown language names without defaulting blank levels',async()=>{
 const a=app(),p=profile();p.cv.idiomas=[{id:'en',idioma:'Inglés',nivel:'B2'},{id:'fr',idioma:'Francés',nivel:'A1'},{id:'custom',idioma:'Lengua de señas mexicana',nivel:'Nativo'},{id:'review',idioma:'Idioma anterior',nivel:'Avanzado'}];const before=JSON.stringify(p);await a.open(p);
 assert.equal(languageRow(a,0).querySelector('[name="sistema"]').value,'mcer');assert.equal(languageRow(a,1).querySelector('[name="nivel"]').value,'A1');
 assert.equal(languageRow(a,2).querySelector('[name="languageChoice"]').value,'__other');assert.equal(languageRow(a,2).querySelector('[name="idioma"]').value,'Lengua de señas mexicana');assert.equal(languageRow(a,2).querySelector('[name="sistema"]').value,'nativo');
 assert.equal(languageRow(a,3).querySelector('[name="nivel"]').value,'Avanzado');assert.equal(languageRow(a,3).querySelector('[data-cve-language-review]').hidden,false);
 assert.equal(a.api.isDirty(),false);assert.equal(JSON.stringify(p),before);assert.equal(a.saves.length,0);
});

test('Mandarin HSK selection stays independent of MCER and preserves every other language until explicit saving',async()=>{
 const a=app(),p=profile();p.cv.idiomas=[{id:'mandarin',idioma:'Chino mandarín',nivel:'HSK 1',sistema:'hsk'},{id:'english',idioma:'Inglés',nivel:'B2'}];await a.open(p);
 const originalOther=JSON.stringify(a.options.profile.cv.idiomas[1]);await languageInput(a,0,'sistema','mcer',true);
 assert.equal(languageRow(a).querySelector('[name="nivel"]').value,'HSK 1');assert.match(languageRow(a).querySelector('[data-cve-language-review]').textContent,/no se convierte automáticamente/);await a.form('idiomas').emit('submit');assert.equal(a.saves.length,0);
 await languageInput(a,0,'nivel','C1');const submit=a.form('idiomas').emit('submit');await flush();assert.equal(a.saves[0].payload.data[0].nivel,'C1');assert.equal(a.saves[0].payload.data[0].sistema,'mcer');assert.equal(a.saves[0].payload.data[1].nivel,'B2');assert.equal(JSON.stringify(a.options.profile.cv.idiomas[1]),originalOther);
 const ack=copy(p);ack.cv.idiomas=a.saves[0].payload.data;ack.cv.revisiones.idiomas=2;a.saves[0].resolve({profile:ack});await submit;assert.match(a.form('idiomas').querySelector('[data-cve-section-status]').textContent,/confirmados/);
});

test('new languages offer HSK 1 to 9 for Mandarin, manual names, native and no formal evaluation without certification requirements',async()=>{
 const a=app();await a.open();await a.form('idiomas').querySelector('[data-cve-add]').click();await languageInput(a,1,'languageChoice','Chino mandarín',true);await languageInput(a,1,'sistema','hsk',true);
 const levels=languageRow(a,1).querySelector('[name="nivel"]').querySelectorAll('option').map(x=>x.value);assert.deepEqual(levels,['','HSK 1','HSK 2','HSK 3','HSK 4','HSK 5','HSK 6','HSK 7','HSK 8','HSK 9']);assert.equal(languageRow(a,1).querySelector('[name="nivel"]').value,'');await languageInput(a,1,'nivel','HSK 9');
 await languageInput(a,1,'languageChoice','__other',true);await languageInput(a,1,'idioma','Lengua de señas mexicana',true);assert.equal(languageRow(a,1).querySelector('[name="nivel"]').value,'HSK 9');assert.match(languageRow(a,1).querySelector('[data-cve-language-review]').textContent,/HSK corresponde/);
 await languageInput(a,1,'sistema','sin_evaluacion',true);const submit=a.form('idiomas').emit('submit');await flush();assert.equal(a.saves[0].payload.data[1].idioma,'Lengua de señas mexicana');assert.equal(a.saves[0].payload.data[1].nivel,'');assert.equal(a.saves[0].payload.data[1].acreditacion,'');a.saves[0].resolve({profile:profile()});await submit;
});

test('declared certification metadata is optional and survives toggling accreditation and month/full-date loads',async()=>{
 const a=app(),p=profile();p.cv.idiomas=[{id:'en',idioma:'Inglés',nivel:'B2',sistema:'mcer',acreditacion:'certificacion',organismo:'Organismo de prueba',fecha:'2025-01-19',resultado:'Resultado declarado'},{id:'fr',idioma:'Francés',nivel:'A1',sistema:'mcer',acreditacion:'certificacion',fecha:'2025-02'}];await a.open(p);
 assert.equal(languageRow(a).querySelector('[name="fecha"]').attributes.type,'date');assert.equal(languageRow(a,1).querySelector('[name="fecha"]').attributes.type,'month');
 await languageInput(a,0,'acreditacion','estimado',true);assert.equal(languageRow(a).querySelector('[name="organismo"]').attributes.type,'hidden');assert.equal(languageRow(a).querySelector('[name="fecha"]').value,'2025-01-19');
 await languageInput(a,0,'acreditacion','certificacion',true);assert.equal(languageRow(a).querySelector('[name="organismo"]').value,'Organismo de prueba');assert.equal(languageRow(a).querySelector('[name="fecha"]').value,'2025-01-19');assert.equal(languageRow(a).querySelector('[name="resultado"]').value,'Resultado declarado');
 await languageInput(a,0,'organismo','');await languageInput(a,0,'fecha','');await languageInput(a,0,'resultado','');const submit=a.form('idiomas').emit('submit');await flush();assert.equal(a.saves[0].payload.data[0].acreditacion,'certificacion');assert.equal(a.saves[0].payload.data[0].organismo,'');a.saves[0].resolve({profile:p});await submit;
});

test('skills parse every supported line separator independently, retain commas inside skills and save all three arrays',async()=>{
 const a=app();await a.open();const sample='  Desarrollo web asistido por IA\rDiseño de interfaces de usuario\u2028Automatización de procesos\u2029Ingeniería de prompts\r\n \nDesarrollo web asistido por IA\nContabilidad, nómina y RH ';
 for(const field of ['habilidadesTecnicas','herramientas','competencias'])await input(a,'habilidades',field,sample);
 assert.equal(a.field('habilidades','habilidadesTecnicas').attributes.maxlength,undefined);const submit=a.form('habilidades').emit('submit');await flush();
 for(const field of ['habilidadesTecnicas','herramientas','competencias'])assert.deepEqual(a.saves[0].payload.data[field],['Desarrollo web asistido por IA','Diseño de interfaces de usuario','Automatización de procesos','Ingeniería de prompts','Contabilidad, nómina y RH']);
 const ack=profile();Object.assign(ack.cv,a.saves[0].payload.data);a.saves[0].resolve({profile:ack});await submit;assert.equal(a.field('habilidades','habilidadesTecnicas').value.split('\n').length,5);
});

test('skills enforce 60 characters per individual line and 40 per category without losing raw invalid input',async()=>{
 const a=app();await a.open();const long='Primera válida\n  '+'x'.repeat(61)+'  \nTercera válida';await input(a,'habilidades','herramientas',long);await a.form('habilidades').emit('submit');assert.equal(a.saves.length,0);assert.equal(a.field('habilidades','herramientas').value,long);assert.match(a.form('habilidades').querySelector('[data-cve-section-status]').textContent,/Herramientas y software: la línea 2.*60/);
 const maximum=Array.from({length:40},(_,i)=>String(i).padStart(2,'0')+'x'.repeat(58)).join('\n');await input(a,'habilidades','herramientas',maximum);assert.equal(a.form('habilidades').querySelector('[data-cve-section-status]').textContent,'');const submit=a.form('habilidades').emit('submit');await flush();assert.equal(a.saves[0].payload.data.herramientas.length,40);assert.ok(a.saves[0].payload.data.herramientas.every(x=>x.length===60));a.saves[0].reject(new Error('Error del servidor'));await submit;assert.equal(a.field('habilidades','herramientas').value,maximum);assert.match(a.form('habilidades').querySelector('[data-cve-section-status]').textContent,/Error del servidor/);
 const over=Array.from({length:41},(_,i)=>'Habilidad '+i).join('\n');await input(a,'habilidades','competencias',over);await a.form('habilidades').emit('submit');assert.equal(a.saves.length,1);assert.equal(a.field('habilidades','competencias').value,over);assert.match(a.form('habilidades').querySelector('[data-cve-section-status]').textContent,/Competencias profesionales.*40/);
});

test('inconsistent saved native/unassessed rows require an explicit change; choosing those systems from MCER still saves their stated meaning',async()=>{
 for(const sistema of ['nativo','sin_evaluacion']){
  const a=app(),p=profile();p.cv.idiomas=[{id:'legacy',idioma:'Inglés',sistema,nivel:'B2',requiereRevision:true}];await a.open(p);
  await a.form('idiomas').emit('submit');assert.equal(a.saves.length,0);assert.match(a.form('idiomas').querySelector('[data-cve-section-status]').textContent,/nivel anterior.*B2/);assert.equal(languageRow(a).querySelector('[name="nivel"]').value,'B2');
  await languageInput(a,0,'sistema','mcer',true);await languageInput(a,0,'sistema',sistema,true);assert.equal(languageRow(a).querySelector('[data-cve-language-review]').hidden,true);assert.equal(languageRow(a).querySelector('[name="nivel"]').value,'B2');
  const submit=a.form('idiomas').emit('submit');await flush();assert.equal(a.saves[0].payload.data[0].nivel,sistema==='nativo'?'Nativo':'');assert.equal(a.saves[0].payload.data[0].requiereRevision,undefined);a.saves[0].resolve({profile:p});await submit;
 }
});

test('professional editor preserves divergent historical versions until the owner explicitly selects a version',async()=>{
 const a=app(),p=sharedProfile();p.editor.basicos.conflicts=[{campo:'profesion',directorio:'Ingeniera',curriculum:'Arquitecta'}];p.cv.profesion='Arquitecta';a.options.saveShared=a.options.save;await a.open(p);
 assert.match(a.form('basicos').textContent,/Ingeniera/);assert.match(a.form('basicos').textContent,/Arquitecta/);assert.equal(a.api.isDirty(),false);
 await input(a,'basicos','empresa','Otra empresa');let submit=a.form('basicos').emit('submit');await flush();assert.deepEqual(a.saves[0].payload,{section:'basicos',revision:4,data:{empresa:'Otra empresa'}});let confirmed=copy(p);confirmed.editor.basicos.data.empresa='Otra empresa';confirmed.editor.basicos.revision++;a.saves[0].resolve({profile:confirmed});await submit;
 await input(a,'basicos','profesion','Investigadora');await a.form('basicos').emit('submit');assert.equal(a.saves.length,1);assert.equal(a.field('basicos','profesion').value,'Investigadora');assert.match(a.form('basicos').querySelector('[data-cve-section-status]').textContent,/dos versiones/);
 const resolve=a.form('basicos').querySelector('[data-cve-resolve="profesion"]');resolve.value='curriculum';await resolve.emit('change');assert.equal(a.field('basicos','profesion').value,'Arquitecta');submit=a.form('basicos').emit('submit');await flush();assert.deepEqual(a.saves[1].payload,{section:'basicos',revision:5,data:{profesion:'Arquitecta'},resoluciones:{profesion:'curriculum'}});confirmed=copy(confirmed);confirmed.editor.basicos.data.profesion='Arquitecta';confirmed.editor.basicos.conflicts=[];confirmed.editor.basicos.revision++;a.saves[1].resolve({profile:confirmed});await submit;assert.equal(a.api.isDirty(),false);
});

test('contact privacy and optional clearing use their own revision without sending the access email or unrelated fields',async()=>{
 const a=app(),p=sharedProfile();a.options.saveShared=a.options.save;await a.open(p);const original=JSON.stringify(p);
 assert.match(a.form('basicos').textContent,/Correo de acceso/);assert.equal(a.form('basicos').querySelector('[readonly]').value,'access@test.invalid');
 await input(a,'contactos','email','');await input(a,'contactos','scope-whatsapp','connections');await input(a,'basicos','bio','Otra bio pendiente');const submit=a.form('contactos').emit('submit');await flush();
 assert.deepEqual(a.saves[0].payload,{section:'contactos',revision:5,data:{email:'',contactScopes:{...p.editor.contactos.data.contactScopes,whatsapp:'connections'}}});assert.equal(JSON.stringify(p),original);
 const confirmed=copy(p);confirmed.editor.contactos.data.email='';confirmed.editor.contactos.data.contactScopes.whatsapp='connections';confirmed.editor.contactos.revision++;a.saves[0].resolve({profile:confirmed});await submit;assert.equal(a.field('basicos','bio').value,'Otra bio pendiente');assert.equal(a.field('contactos','email').value,'');
});

test('legacy long identity data remain intact when another field is saved and overlength new input reports an error without deleting text',async()=>{
 const a=app(),p=sharedProfile();p.editor.basicos.data.nombre='N'.repeat(95);p.editor.basicos.data.profesion='P'.repeat(115);p.cv.resumen='R'.repeat(2200);p.cv.presentacion='T'.repeat(1500);p.cv.objetivo='O'.repeat(900);a.options.saveShared=a.options.save;await a.open(p);assert.equal(a.api.isDirty(),false);assert.equal(a.field('basicos','nombre').value.length,95);assert.equal(a.field('basicos','profesion').attributes.maxlength,'120');assert.equal(a.field('sobreMi','resumen').attributes.maxlength,'2400');assert.equal(a.field('sobreMi','presentacion').attributes.maxlength,'1600');assert.equal(a.field('sobreMi','objetivo').attributes.maxlength,'1000');
 await input(a,'basicos','empresa','Nueva empresa');const submit=a.form('basicos').emit('submit');await flush();assert.deepEqual(a.saves[0].payload.data,{empresa:'Nueva empresa'});const confirmed=copy(p);confirmed.editor.basicos.data.empresa='Nueva empresa';a.saves[0].resolve({profile:confirmed});await submit;assert.equal(a.field('basicos','nombre').value.length,95);
 await input(a,'basicos','profesion','X'.repeat(121));await a.form('basicos').emit('submit');assert.equal(a.saves.length,1);assert.equal(a.field('basicos','profesion').value.length,121);assert.match(a.form('basicos').querySelector('[data-cve-section-status]').textContent,/120 caracteres/);
});

test('focusSection reuses the current editor and the navigation guard requires a real discard before continuing',async()=>{
 const a=app();a.options.section='contactos';await a.open(sharedProfile());assert.equal(a.root.querySelector('[data-cve-section="contactos"]').open,true);await input(a,'sobreMi','resumen','No perder este borrador');const originalForm=a.form('sobreMi');assert.equal(a.api.focusSection('apariencia'),true);assert.equal(a.form('sobreMi'),originalForm);assert.equal(a.field('sobreMi','resumen').value,'No perder este borrador');assert.equal(a.root.querySelector('[data-cve-section="apariencia"]').open,true);
 let continued=0;assert.equal(a.api.requestLeave(()=>continued++),false);assert.equal(continued,0);await a.root.querySelector('[data-cve-stay]').click();assert.equal(a.api.isOpen(),true);assert.equal(a.field('sobreMi','resumen').value,'No perder este borrador');assert.equal(continued,0);assert.equal(a.api.requestLeave(()=>continued++),false);await a.root.querySelector('[data-cve-discard]').click();assert.equal(continued,1);assert.equal(a.api.isOpen(),false);assert.equal(a.saves.length,0);
 const fresh=app();await fresh.open(sharedProfile());assert.equal(fresh.api.requestLeave(()=>continued++),true);assert.equal(continued,1,'the caller owns navigation when true is returned');
});

test('photo upload remains a draft until its own confirmed save and survives a CV save without changing Google preferences',async()=>{
 const a=app(),p=sharedProfile(),image='data:image/jpeg;base64,aGVsbG8=';a.options.saveShared=a.options.save;a.options.preparePhoto=async()=>image;await a.open(p);await input(a,'sobreMi','resumen','Mi resumen pendiente');const file=a.form('apariencia').querySelector('[data-cve-photo-file]');file.files=[{type:'image/jpeg',size:10}];await file.emit('change');assert.equal(a.saves.length,0);assert.equal(a.api.isDirty(),true);assert.match(a.form('apariencia').querySelector('[data-cve-section-status]').textContent,/preparada/);
 const submit=a.form('apariencia').emit('submit');await flush();assert.deepEqual(a.saves[0].payload,{section:'apariencia',revision:6,data:{avatarDataUrl:image}});assert.match(a.field('sobreMi','resumen').value,/pendiente/);assert.equal(a.api.requestLeave(()=>{}),false,'pending saves block navigation');const confirmed=copy(p);confirmed.foto='https://images.test/uploaded.jpg';confirmed.editor.apariencia.data.foto=confirmed.foto;confirmed.editor.apariencia.revision++;a.saves[0].resolve({profile:confirmed});await submit;assert.equal(a.field('sobreMi','resumen').value,'Mi resumen pendiente');
 await a.root.querySelector('[data-cve-preview]').click();assert.equal(a.previews.at(-1).foto,confirmed.foto);assert.equal(a.previews.at(-1).editor,undefined);assert.equal(a.previews.at(-1).authEmail,undefined);
});

test('Google is an explicit immediate action which refreshes the appearance revision and preserves all other drafts',async()=>{
 const a=app(),p=sharedProfile();let called=0;const google=copy(p);google.foto='https://lh3.googleusercontent.com/new';google.photoSource='google';google.editor.apariencia.data.foto=google.foto;google.editor.apariencia.data.fotoOrigen='google';google.editor.apariencia.revision=8;a.options.syncGoogle=async()=>{called++;return{profile:google};};a.options.saveShared=a.options.save;await a.open(p);
 await input(a,'basicos','empresa','Empresa pendiente');await input(a,'sobreMi','resumen','Resumen pendiente');let color=a.form('apariencia').querySelector('#dirf-cover-color');color.value='#123456';await color.emit('input');await a.form('apariencia').querySelector('[data-cve-photo-google]').click();assert.equal(called,0);assert.equal(a.form('apariencia').querySelector('[data-cve-google-confirm]').hidden,false);await a.form('apariencia').querySelector('[data-cve-google-no]').click();assert.equal(called,0);await a.form('apariencia').querySelector('[data-cve-photo-google]').click();await a.form('apariencia').querySelector('[data-cve-google-yes]').click();assert.equal(called,1);assert.equal(a.field('basicos','empresa').value,'Empresa pendiente');assert.equal(a.field('sobreMi','resumen').value,'Resumen pendiente');assert.equal(a.form('apariencia').querySelector('#dirf-cover-color').value,'#123456');assert.equal(a.saves.length,0);
 const submit=a.form('apariencia').emit('submit');await flush();assert.deepEqual(a.saves[0].payload,{section:'apariencia',revision:8,data:{portadaColor:'#123456'}});a.saves[0].resolve({profile:google});await submit;
});

test('cover removal is retained across a redraw and free accounts retain their photo tools without VIP cover controls',async()=>{
 const a=app(),p=sharedProfile();a.options.saveShared=a.options.save;await a.open(p);await a.form('apariencia').querySelector('[data-cover-remove]').click();await a.form('experiencia').querySelector('[data-cve-add]').click();assert.equal(a.form('apariencia').querySelector('[data-cover-image]').hidden,true);const submit=a.form('apariencia').emit('submit');await flush();assert.deepEqual(a.saves[0].payload,{section:'apariencia',revision:6,data:{removeCover:true}});const confirmed=copy(p);confirmed.editor.apariencia.data.portadaUrl='';a.saves[0].resolve({profile:confirmed});await submit;
 const free=app();await free.open(sharedProfile({isVip:false}));assert.ok(free.form('apariencia').querySelector('[data-cve-photo-pick]'));assert.equal(free.form('apariencia').querySelector('[data-cover-pick]'),null);assert.match(free.form('apariencia').textContent,/membresía VIP/);assert.equal(free.api.isDirty(),false);
});

test('an invalid untouched legacy contact never blocks another contact, while a rejected edited contact preserves its draft',async()=>{
 const a=app(),p=sharedProfile();p.editor.contactos.data.email='correo histórico inválido';p.editor.contactos.data.linkedin='linkedin.com/antiguo';a.options.saveShared=a.options.save;await a.open(p);
 const form=a.form('contactos');assert.equal(form.noValidate,true);assert.equal(Object.hasOwn(form.attributes,'novalidate'),true);form.reportValidity=()=>{throw Error('untouched legacy controls must not be revalidated globally');};
 await input(a,'contactos','whatsapp','+522381111111');let submit=form.emit('submit');await flush();assert.deepEqual(a.saves[0].payload,{section:'contactos',revision:5,data:{whatsapp:'+522381111111'}});const confirmed=copy(p);confirmed.editor.contactos.data.whatsapp='+522381111111';confirmed.editor.contactos.revision++;a.saves[0].resolve({profile:confirmed});await submit;assert.equal(a.field('contactos','email').value,'correo histórico inválido');assert.equal(a.field('contactos','linkedin').value,'linkedin.com/antiguo');
 await input(a,'contactos','email','nuevo correo inválido');submit=a.form('contactos').emit('submit');await flush();assert.deepEqual(a.saves[1].payload,{section:'contactos',revision:6,data:{email:'nuevo correo inválido'}});a.saves[1].reject(Object.assign(Error('Escribe un correo profesional válido.'),{status:400}));await submit;assert.equal(a.field('contactos','email').value,'nuevo correo inválido');assert.match(a.form('contactos').querySelector('[data-cve-section-status]').textContent,/correo profesional válido/);assert.equal(a.api.isDirty(),true);
});

test('opening a section from the public preview restores its draft and focuses its accessible summary',async()=>{
 const a=app();await a.open(sharedProfile());await input(a,'basicos','empresa','Empresa en borrador');await a.root.querySelector('[data-cve-preview]').click();assert.equal(a.root.querySelector('[data-cve-form="basicos"]'),null);assert.equal(a.api.focusSection('basicos'),true);const section=a.root.querySelector('[data-cve-section="basicos"]');assert.equal(section.open,true);assert.equal(a.document.activeElement,section.querySelector('summary'));assert.equal(a.field('basicos','empresa').value,'Empresa en borrador');assert.equal(a.saves.length,0);
});

test('sector is a free industry field which preserves previous values and never changes the professional specialty',async()=>{
 const a=app(),p=sharedProfile();p.editor.basicos.data.sector='Fiscal y Contable';a.options.saveShared=a.options.save;await a.open(p);const sector=a.field('basicos','sector');assert.equal(sector.tagName,'input');assert.equal(sector.attributes.type,'text');assert.equal(sector.attributes.maxlength,'80');assert.equal(sector.value,'Fiscal y Contable');assert.match(a.form('basicos').textContent,/Sector o industria/);assert.equal(a.api.isDirty(),false);
 await input(a,'basicos','sector','Industria farmacéutica');const submit=a.form('basicos').emit('submit');await flush();assert.deepEqual(a.saves[0].payload,{section:'basicos',revision:4,data:{sector:'Industria farmacéutica'}});const confirmed=copy(p);confirmed.editor.basicos.data.sector='Industria farmacéutica';confirmed.editor.basicos.revision++;a.saves[0].resolve({profile:confirmed});await submit;assert.equal(a.field('basicos','sector').value,'Industria farmacéutica');assert.equal(a.field('basicos','especialidad').value,'Desarrollo de software');assert.equal(a.api.isDirty(),false);
});
