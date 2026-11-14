'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');

// Small DOM fixture: executes the actual panel, its event listeners and real
// message validator without a WebGL world, network credentials or clock sleeps.
class Element {
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.listeners=new Map();this.attributes={};this.dataset={};this.hidden=false;this.value='';this._text='';this._classes=new Set();this.styles={};this.style={setProperty:(k,v)=>{this.styles[k]=v;}};this.classList={contains:k=>this._classes.has(k),add:k=>this._classes.add(k),remove:k=>this._classes.delete(k),toggle:(k,v)=>{const on=v===undefined?!this._classes.has(k):v;on?this._classes.add(k):this._classes.delete(k);return on;}};}
  set className(s){this._classes=new Set(s.split(/\s+/).filter(Boolean));}get className(){return [...this._classes].join(' ');}
  set textContent(s){this._text=String(s);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  emit(type,extra={}){const e={type,target:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},...extra};for(const fn of this.listeners.get(type)||[])fn(e);return e;}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}click(){this.emit('click');}
  closest(selector){if(selector==='button')return this.tagName==='BUTTON'?this:this.parentElement?.closest(selector)||null;return null;}
  focus(){if(this.doc.activeElement===this)return;this.doc.activeElement?.blur();this.doc.activeElement=this;this.emit('focus');}
  blur(){if(this.doc.activeElement!==this)return;this.doc.activeElement=this.doc.body;this.emit('blur');}
}
async function fixture(run,{touch=true,available=true}={}){
 const saved={document:global.document,window:global.window,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};
 const doc=new Element('document');doc.doc=doc;doc.body=new Element('body',doc);doc.documentElement=new Element('html',doc);doc.activeElement=doc.body;
 const hud=new Element('div',doc);doc.createElement=tag=>new Element(tag,doc);doc.getElementById=id=>id==='hud'?hud:null;
 const win=new Element('window',doc),vv=new Element('viewport',doc);Object.assign(vv,{height:844,offsetTop:0});Object.assign(win,{innerHeight:844,visualViewport:vv});
 const timers=new Map();let timerId=0;global.document=doc;global.window=win;global.setTimeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;};global.clearTimeout=id=>timers.delete(id);
 const handlers=new Map(),sent=[],toasts=[],bubbles=[];
 const net={isOnline:true,chatAvailable:available,roster:new Map(),on(e,fn){if(!handlers.has(e))handlers.set(e,[]);handlers.get(e).push(fn);},chat(op,payload){sent.push({op,...payload});return true;}};
 const fire=(type,message)=>{for(const fn of handlers.get(type)||[])fn(message);};
 const api={net,input:{touch,keys:new Set(['up'])},ui:{isBlocking:false,toast:text=>toasts.push(text)},store:{state:{settings:{}},save(){}}};
 try{const {ChatPanel}=await import(pathToFileURL(path.join(__dirname,'../ciudad/js/ui/chat.js')).href);const panel=new ChatPanel(api,{muted:[],say(){},bubble:(...args)=>bubbles.push(args)});fire('profile',{profile:{chat:{enabled:true,accepted:true,off:false,blocked:[]}}});await run({panel,api,net,fire,sent,toasts,bubbles,doc,vv,timers,hud});}finally{Object.assign(global,saved);}
}
const acknowledge=(f,n,text='Mensaje autorizado')=>f.fire('chat',{op:'send',n,ok:true,id:100+n,text,at:1e6,heard:1});

test('touch chat closes outside and with its clear button, keeps draft/history, and ignores inside taps or another modal',()=>fixture(f=>{
 const {panel:p,doc,api}=f;p.toggle(true);p.input.value='Borrador sin enviar';p.input.focus();
 doc.emit('pointerdown',{target:p.input});assert.equal(p.open,true,'inside tap cannot dismiss');doc.emit('pointerdown',{target:p.menuBtn});assert.equal(p.open,true);
 api.ui.isBlocking=true;doc.emit('pointerdown',{target:doc.body});assert.equal(p.open,true,'the separate options modal owns its outside taps');api.ui.isBlocking=false;
 doc.emit('pointerdown',{target:doc.body});assert.equal(p.open,false);assert.equal(p.input.value,'Borrador sin enviar');assert.notEqual(doc.activeElement,p.input);
 p.toggle(true);f.fire('chat',{op:'msg',id:2,pid:'peer',name:'Ana',text:'Hola',at:1e6});const close=p.box.children[0].children.at(-1);assert.equal(close.getAttribute('aria-label'),'Cerrar chat');close.click();p.toggle(true);assert.equal(p.log[0].text,'Hola');assert.equal(p.input.value,'Borrador sin enviar');
 p.input.focus();p.input.emit('keydown',{key:'Escape'});assert.equal(p.open,false);assert.equal(p.input.value,'Borrador sin enviar');
}));

test('one pending send keeps its draft, hides keyboard, waits for authoritative ACK and can send-and-close without losing history',()=>fixture(f=>{
 const p=f.panel;p.toggle(true);p.input.value='  Hola ciudad  ';p.input.focus();p.form.emit('submit');
 assert.equal(f.sent.length,1);assert.equal(p.input.value,'  Hola ciudad  ');assert.equal(p.log.length,0,'no optimistic own message');assert.equal(p.send.disabled,true);assert.equal(p.form.getAttribute('aria-busy'),'true');assert.equal(p.notice.textContent,'Enviando…');assert.notEqual(f.doc.activeElement,p.input,'mobile keyboard receives blur');
 p.submit();assert.equal(f.sent.length,1,'double click/Enter cannot send again');acknowledge(f,f.sent[0].n,'Hola ciudad');
 assert.equal(p.input.value,'');assert.equal(p.log.length,1);assert.equal(p.log[0].text,'Hola ciudad');assert.equal(p.send.disabled,false);assert.equal(p.open,false,'closes only after positive server ACK');assert(f.toasts.some(t=>/Mensaje enviado/.test(t)));
 p.toggle(true);assert.equal(p.list.children[0].children[1].textContent,'Hola ciudad');acknowledge(f,f.sent[0].n,'Hola ciudad');assert.equal(p.log.length,1,'duplicate confirmation is not a second row');
}));

test('validation, disconnected send and server rejection preserve text and expose clear delivery errors',()=>fixture(f=>{
 const p=f.panel;p.toggle(true);p.input.value='Visita www.ejemplo.com';p.submit();assert.equal(f.sent.length,0);assert.match(p.notice.textContent,/enlaces/);assert.equal(p.input.value,'Visita www.ejemplo.com');
 p.input.value='Hola';f.net.chat=()=>false;p.submit();assert.equal(p.pending.size,0);assert.equal(p.input.value,'Hola');assert.match(p.notice.textContent,/Sin conexión/);assert.equal(p.send.disabled,false);
 f.net.chat=(op,x)=>{f.sent.push({op,...x});return true;};p.submit();f.fire('chat',{op:'send',n:f.sent[0].n,ok:false,reason:'restringido',wait:120});
 assert.equal(p.input.value,'Hola','even a restricted draft is not discarded');assert.equal(p.log.length,0);assert.equal(p.open,true);assert.match(p.notice.textContent,/2 min/);assert.equal(p.sending,false);
}));

test('a newer draft and a reopened sheet cannot be erased or closed by an earlier acknowledgement',()=>fixture(f=>{
 const p=f.panel;p.toggle(true);p.input.value='Primero';p.submit();p.input.value='Otro borrador';p.input.emit('input');acknowledge(f,f.sent[0].n,'Primero');assert.equal(p.input.value,'Otro borrador');assert.equal(p.open,true);
 p.input.value='Segundo';p.submit();const n=f.sent.at(-1).n;p.toggle(false);p.toggle(true);acknowledge(f,n,'Segundo');assert.equal(p.open,true,'late ACK must not close a sheet reopened by the user');assert.equal(p.input.value,'');
 p.after.checked=false;p.input.value='Tercero';p.submit();acknowledge(f,f.sent.at(-1).n,'Tercero');assert.equal(p.open,true,'the user may keep the panel open after sending');
}));

test('disconnect or missing ACK never retries automatically, keeps the draft, and can settle a late confirmation once',()=>fixture(f=>{
 const p=f.panel;p.toggle(true);p.input.value='Mensaje pendiente';p.submit();const n=f.sent[0].n;
 f.net.isOnline=false;f.fire('status',{status:'reconnecting'});assert.equal(p.sending,false);assert.equal(p.input.value,'Mensaje pendiente');assert.equal(p.log.length,0);assert.equal(f.sent.length,1);
 f.net.isOnline=true;f.fire('status',{status:'online'});p.toggle(true);acknowledge(f,n,'Mensaje pendiente');assert.equal(p.input.value,'');assert.equal(p.log.filter(e=>e.mine).length,1);
 p.toggle(true);p.input.value='Sin confirmación';p.submit();const timer=[...f.timers.values()].find(t=>t.ms===12000);assert(timer);timer.fn();assert.equal(p.sending,false);assert.equal(p.send.disabled,false);assert.equal(p.input.value,'Sin confirmación');assert.match(p.notice.textContent,/Revisa el historial/);assert.equal(f.sent.length,2);acknowledge(f,f.sent.at(-1).n,'Sin confirmación');assert.equal(p.log.filter(e=>e.mine).length,2);
}));

test('desktop keeps keyboard workflow; composition does not send and unavailable sessions cannot send',async()=>{
 await fixture(f=>{const p=f.panel;p.input.value='Mensaje';p.focus();assert.equal(f.doc.activeElement,p.input);p.input.emit('compositionstart');p.submit();assert.equal(f.sent.length,0);p.input.emit('compositionend');p.submit();assert.equal(f.sent.length,1);acknowledge(f,f.sent[0].n,'Mensaje');assert.equal(p.box.hidden,false);assert.equal(f.doc.activeElement,p.input);assert.equal(p.afterLabel.hidden,true);p.input.emit('keydown',{key:'Escape'});assert.notEqual(f.doc.activeElement,p.input);},{touch:false});
 await fixture(f=>{const p=f.panel;p.input.value='No disponible';p.submit();assert.equal(f.sent.length,0);assert.equal(p.box.hidden,true);assert.equal(p.fab.hidden,true);},{available:false});
});

test('visual viewport resize updates sheet bounds without moving, sending or clearing its draft',()=>fixture(f=>{
 const p=f.panel;p.toggle(true);p.input.value='Teclado abierto';f.vv.height=365;f.vv.offsetTop=32;f.vv.emit('resize');assert.equal(p.box.styles['--chat-viewport-height'],'365px');assert.equal(p.box.styles['--chat-viewport-top'],'32px');assert.equal(p.box.classList.contains('is-viewport-compact'),true);assert.equal(p.box.classList.contains('is-viewport-tight'),false);f.vv.height=260;f.vv.emit('resize');assert.equal(p.box.classList.contains('is-viewport-tight'),true);assert.equal(p.input.value,'Teclado abierto');assert.equal(f.sent.length,0);
}));

test('a late older ACK cannot replace the delivery error or draft of a newer submission',()=>fixture(f=>{
 const p=f.panel;p.toggle(true);p.input.value='Primero incierto';p.submit();const first=f.sent[0].n;[...f.timers.values()].find(t=>t.ms===12000).fn();
 p.input.value='Segundo rechazado';p.submit();const second=f.sent.at(-1).n;f.fire('chat',{op:'send',n:second,ok:false,reason:'demasiado-rapido'});const error=p.notice.textContent;
 acknowledge(f,first,'Primero incierto');assert.equal(p.notice.textContent,error);assert.equal(p.notice.dataset.state,'error');assert.equal(p.input.value,'Segundo rechazado');assert.equal(p.open,true);assert.equal(p.log.filter(e=>e.mine).length,1);
}));

test('closing while sending still receives a clear success notice after confirmation',()=>fixture(f=>{
 const p=f.panel;p.toggle(true);p.input.value='Lo cierro mientras envía';p.submit();p.toggle(false);acknowledge(f,f.sent[0].n,'Lo cierro mientras envía');assert.equal(p.open,false);assert(f.toasts.some(t=>/Mensaje enviado/.test(t)));p.toggle(true);assert.equal(p.log[0].text,'Lo cierro mientras envía');
}));

test('Enter/Space on chat buttons preserve native actions and never reach world shortcuts',()=>fixture(f=>{
 const p=f.panel;let world=0;const simulate=(node,key)=>{const host=node===p.fab?p.fab:p.box,e=host.emit('keydown',{target:node,key,code:key===' '?'Space':'Enter'});if(!e.propagationStopped){world++;e.preventDefault();}if(!e.defaultPrevented)node.click();return e;};
 let e=simulate(p.fab,'Enter');assert.equal(e.defaultPrevented,undefined);assert.equal(p.open,true);assert.equal(world,0);
 p.input.value='Con teclado';e=simulate(p.send,'Enter');assert.equal(e.defaultPrevented,undefined);if(!e.defaultPrevented)p.form.emit('submit');assert.equal(f.sent.length,1);assert.equal(world,0);acknowledge(f,f.sent[0].n,'Con teclado');p.toggle(true);
 const close=p.box.children[0].children.at(-1);simulate(close,' ');assert.equal(p.open,false);assert.equal(world,0);
}));
