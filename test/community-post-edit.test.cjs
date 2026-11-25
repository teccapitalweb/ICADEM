'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const entire=fs.readFileSync(__dirname+'/../js/icadem-community.js','utf8');
const source=entire.slice(entire.indexOf('/* Text edits use the existing post'));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function post(extra={}){return {id:'own-post',uid:'member-a',texto:'Texto original',imagen:null,createdAtMs:Date.now()-1000,contentRevision:3,...extra};}
function app(initial=post()){
 const events=new Map(),requests=[],saved=[],toasts=[],rows=new Map(),dialogs=[];let data=initial;
 class Node{
  constructor(tag='DIV'){this.tagName=tag.toUpperCase();this.dataset={};this.handlers={};this.attributes={};this.children=[];this.isConnected=true;this.hidden=false;this.value='';this.disabled=false;this.textContent='';}
  addEventListener(name,fn){this.handlers[name]=fn;}setAttribute(name,value){this.attributes[name]=String(value);}appendChild(n){this.children.push(n);n.isConnected=true;return n;}remove(){this.isConnected=false;}
  fire(name,event={}){return this.handlers[name]?.({preventDefault(){event.prevented=true;},...event});}
  focus(){document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;this.fire('close');}
  querySelector(selector){return this.nodes?.[selector]||null;}
  querySelectorAll(selector){if(selector==='[data-post]')return [...rows.values()];if(selector==='[data-post-text-edit]')return [...rows.values()].map(row=>row.header.children.find(n=>n.dataset.postTextEdit)).filter(Boolean);if(selector.startsWith('button'))return Object.values(this.nodes||{}).filter(n=>n.tagName==='BUTTON'&&(!selector.includes(':not')||!n.dataset.save));return[];}
  set innerHTML(value){this.html=value;if(this.tagName!=='DIALOG')return;
   this.nodes={};for(const selector of ['[data-post-edit-text]','#community-edit-count','#community-edit-error','[data-post-edit-comparison]','[data-post-edit-current]','[data-post-edit-cancel]','[data-post-edit-review]','[data-post-edit-accept]','[data-post-edit-save]']){
    const tag=selector.includes('-text]')?'textarea':/(cancel|review|accept|save)/.test(selector)?'button':'div',node=new Node(tag);this.nodes[selector]=node;
    if(selector.includes('save'))node.dataset.save=true;if(/(error|comparison|review)/.test(selector))node.hidden=true;
   }
  }
 }
 const list=new Node(),root=new Node();root.nodes={'#foro-list':list};root.querySelectorAll=selector=>list.querySelectorAll(selector);
 function row(p){const node=new Node();node.dataset.post=p.id;node.header=new Node();node.querySelector=selector=>selector==='.post__header'?node.header:selector==='[data-post-text-edit]'?node.header.children.find(b=>b.isConnected&&b.dataset.postTextEdit):null;rows.set(p.id,node);return node;}
 row(initial);
 const document={activeElement:null,body:new Node('body'),createElement(tag){const n=new Node(tag);if(tag==='dialog')dialogs.push(n);return n;},addEventListener(name,fn){events.set(name,fn);}};
 const window={__currentUser:{uid:'member-a'},ICADEMCommunity:{},ICADEMPlatform:{request(path,options){const req={path,options:options||{}};requests.push(req);return handler(path,options||{});}},Toast:{success:(...args)=>toasts.push(['success',...args]),error:(...args)=>toasts.push(['error',...args])},addEventListener(name,fn){events.set(name,fn);}};
 let handler=async(path,options)=>options.method==='PATCH'?{ok:true,postId:data.id,texto:options.body.texto,contentRevision:options.body.expectedRevision+1,editedAt:new Date().toISOString()}:{ok:true,post:{...data}};
 const context={window,document,Date,Intl,Map,Set,setTimeout(){return 0;},clearTimeout(){}};vm.runInNewContext(source,context);
 const api=window.ICADEMCommunity;api.mountPostEditor(root,patch=>saved.push(patch));api.postRecords([initial],list);
 async function open(id=initial.id){rows.get(id)?.querySelector('[data-post-text-edit]')?.fire('click');await flush();return dialogs.at(-1);}
 return{window,document,api,root,list,rows,requests,saved,toasts,dialogs,row,open,setData(value){data=value;},setHandler(fn){handler=fn;},emit(name,detail){events.get(name)?.({detail});}};
}

test('only the current author receives text editing while the existing15-day publication is active, without VIP checks',()=>{
 const a=app(),foreign=post({id:'foreign',uid:'another-member'}),expired=post({id:'expired',createdAtMs:Date.now()-15*86400000-1});a.row(foreign);a.row(expired);a.api.postRecords([post(),foreign,expired],a.list);
 assert.equal(a.rows.get('own-post').header.children.length,1);assert.equal(a.rows.get('foreign').header.children.length,0);assert.equal(a.rows.get('expired').header.children.length,0);assert.equal(a.requests.length,0);
 a.window.__currentUser={uid:'admin-b'};a.emit('icadem:user-ready');assert.equal(a.saved.length,0);
});

test('opening fetches the original real post before editing, and save patches only text with its current content revision',async()=>{
 const original=post({imagen:'https://images.test/image.jpg',style:{accent:'mint'},likes:7,comentariosCount:4});const a=app(original),node=await a.open();
 assert.equal(a.requests[0].path,'/api/forum/posts/own-post');assert.equal(a.requests[0].options.method,undefined);assert.equal(a.document.activeElement,node.nodes['[data-post-edit-text]']);
 const text=node.nodes['[data-post-edit-text]'],save=node.nodes['[data-post-edit-save]'];assert.equal(save.disabled,true);text.value='Corrección segura';text.fire('input');assert.equal(save.disabled,false);await save.fire('click');
 assert.deepEqual(JSON.parse(JSON.stringify(a.requests[1].options)),{method:'PATCH',body:{texto:'Corrección segura',expectedRevision:3}});assert.equal(a.saved.length,1);assert.equal(a.saved[0].contentRevision,4);assert.equal(a.saved[0].texto,'Corrección segura');assert.equal(original.texto,'Texto original');assert.equal(original.likes,7);assert.equal(original.comentariosCount,4);assert.equal(original.style.accent,'mint');assert.equal(original.imagen,'https://images.test/image.jpg');assert.equal(node.isConnected,false);
});

test('repeated activation while the original post is loading shares one request instead of opening duplicate editors',async()=>{
 const a=app();let resolve;a.setHandler(()=>new Promise(r=>resolve=r));const first=a.open(),second=a.open();await flush();assert.equal(a.requests.length,1);resolve({ok:true,post:post()});await Promise.all([first,second]);assert.equal(a.dialogs.length,1);assert.equal(a.dialogs[0].open,true);
});

test('an error keeps the edit draft and baseline revision, permits retry and never confirms a failed save',async()=>{
 const a=app(),node=await a.open(),text=node.nodes['[data-post-edit-text]'],save=node.nodes['[data-post-edit-save]'];text.value='Borrador preservado';text.fire('input');a.setHandler(async()=>{throw Error('Sin conexión');});await save.fire('click');
 assert.equal(text.value,'Borrador preservado');assert.equal(node.isConnected,true);assert.equal(save.disabled,false);assert.equal(a.saved.length,0);assert.equal(a.toasts.length,0);assert.equal(node.nodes['#community-edit-error'].hidden,false);
 a.setHandler(async(path,options)=>({ok:true,postId:'own-post',texto:options.body.texto,contentRevision:4,editedAt:new Date().toISOString()}));await save.fire('click');assert.equal(a.requests.at(-1).options.body.expectedRevision,3);assert.equal(a.saved.length,1);
});

test('a revision conflict preserves the draft and requires comparing/accepting the current version before another save',async()=>{
 const a=app(),node=await a.open(),text=node.nodes['[data-post-edit-text]'],save=node.nodes['[data-post-edit-save]'];text.value='Mi edición local';text.fire('input');
 a.setHandler(async()=>{throw Object.assign(Error('Conflicto'),{status:409});});await save.fire('click');assert.equal(save.disabled,true);assert.equal(text.value,'Mi edición local');assert.equal(node.nodes['[data-post-edit-review]'].hidden,false);assert.equal(a.saved.length,0);
 a.setHandler(async()=>({ok:true,post:post({texto:'Versión de otra sesión',contentRevision:5})}));await node.nodes['[data-post-edit-review]'].fire('click');assert.equal(text.value,'Mi edición local');assert.equal(node.nodes['[data-post-edit-current]'].textContent,'Versión de otra sesión');assert.equal(save.disabled,true);
 node.nodes['[data-post-edit-accept]'].fire('click');assert.equal(save.disabled,false);assert.equal(text.value,'Mi edición local');a.setHandler(async(path,options)=>({ok:true,postId:'own-post',texto:options.body.texto,contentRevision:6,editedAt:new Date().toISOString()}));await save.fire('click');assert.equal(a.requests.at(-1).options.body.expectedRevision,5);assert.equal(a.saved.length,1);
});

test('a session change or leaving Community cannot expose a delayed old post or confirm its delayed save',async()=>{
 for(const stage of ['open','save']){
  const a=app();let resolve;a.setHandler(()=>new Promise(r=>resolve=r));
  if(stage==='open'){const opening=a.open();await flush();a.window.__currentUser={uid:'new-account'};a.emit('icadem:session-ending');resolve({ok:true,post:post()});await opening;assert.equal(a.dialogs.length,0);}
  else{a.setHandler(async()=>({ok:true,post:post()}));const node=await a.open();node.nodes['[data-post-edit-text]'].value='Texto privado';node.nodes['[data-post-edit-text]'].fire('input');a.setHandler(()=>new Promise(r=>resolve=r));const saving=node.nodes['[data-post-edit-save]'].fire('click');a.emit('icadem:navigation',{section:'inicio'});resolve({ok:true,postId:'own-post',texto:'Texto privado',contentRevision:4,editedAt:new Date().toISOString()});await saving;assert.equal(a.saved.length,0);assert.equal(node.isConnected,false);}
 }
});

test('a late expired/foreign exact post cannot open the editor even when the visible record previously looked editable',async()=>{
 for(const changed of [post({uid:'someone-else'}),post({createdAtMs:Date.now()-15*86400000-1})]){const a=app();a.setData(changed);await a.open();assert.equal(a.dialogs.length,0);assert.equal(a.requests.length,1);assert.equal(a.toasts[0][0],'error');}
});

test('the editor permits clearing image-post text but rejects empty text-only posts and overlong manipulated input',async()=>{
 for(const image of [null,'https://images.test/photo.jpg']){const a=app(post({imagen:image})),node=await a.open(),text=node.nodes['[data-post-edit-text]'],save=node.nodes['[data-post-edit-save]'];text.value='';text.fire('input');assert.equal(save.disabled,!image);text.value='x'.repeat(1501);text.fire('input');assert.equal(save.disabled,true);assert.equal(node.nodes['#community-edit-count'].textContent,'1501 / 1500');}
});

test('professional activity marks only confirmed valid edit timestamps while preserving the original publication date',()=>{
 const activity=fs.readFileSync(__dirname+'/../js/icadem-professional-activity.js','utf8');const helpers=activity.slice(activity.indexOf('  function date('),activity.indexOf('  function status('));const ctx={Intl,Date,esc:v=>String(v).replace(/&/g,'&amp;')};vm.runInNewContext(helpers,ctx);
 assert.equal(ctx.edited({}), '');assert.equal(ctx.edited({editedAt:'invalid'}),'');assert.match(ctx.edited({editedAt:'2026-11-25T19:00:00Z'}),/activity-edited[^>]*.*Editado/);assert.match(activity,/new Date\(item\.createdAtMs\)\.toISOString\(\)/);
});
