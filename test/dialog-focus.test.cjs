'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const listeners={},document={activeElement:null,addEventListener:(name,fn)=>listeners[name]=fn};
 function element(name,parent=null,dialog=false){
  const attributes={},e={name,parent,dialog,children:[],tabIndex:0,connected:true,hidden:false};
  if(parent)parent.children.push(e);
  Object.defineProperty(e,'isConnected',{get:()=>e.connected&&(!parent||parent.isConnected)});
  e.contains=other=>other===e||e.children.some(child=>child.contains(other));
  e.getClientRects=()=>e.hidden?[]:[{}];
  e.closest=selector=>selector==='[inert]'?null:e.dialog?e:parent?.closest(selector);
  e.querySelectorAll=()=>e.children.flatMap(child=>[child,...child.querySelectorAll()]).filter(child=>!child.disabled);
  e.querySelector=()=>null;
  e.hasAttribute=key=>key in attributes;
  e.setAttribute=(key,value)=>{attributes[key]=value;if(key==='tabindex')e.tabIndex=Number(value);};
  e.focus=()=>document.activeElement=e;
  return e;
 }
 document.body=element('body');document.activeElement=element('trigger',document.body);
 const window={};vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-dialog-focus.js','utf8'),{window,document,getComputedStyle:()=>({visibility:'visible'})});
 function key(key,shiftKey=false){const event={key,shiftKey,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};listeners.keydown(event);return event;}
 return {document,element,key,focus:window.ICADEMDialogFocus};
}
test('dialogs capture initial focus, wrap Tab in both directions and restore the trigger',()=>{
 const a=setup(),trigger=a.document.activeElement,root=a.element('dialog',a.document.body,true),first=a.element('first',root),last=a.element('last',root);
 a.focus.activate(root,()=>{});assert.equal(a.document.activeElement,first);
 last.focus();assert.equal(a.key('Tab').prevented,true);assert.equal(a.document.activeElement,first);
 assert.equal(a.key('Tab',true).prevented,true);assert.equal(a.document.activeElement,last);
 trigger.focus();a.key('Tab');assert.equal(a.document.activeElement,first);
 root.connected=false;a.document.activeElement=a.document.body;a.focus.release(root);assert.equal(a.document.activeElement,trigger);
});
test('Escape affects only the top dialog and nested closing returns to its parent',()=>{
 const a=setup(),root=a.element('parent',a.document.body,true),button=a.element('parent button',root),child=a.element('child',a.document.body,true);let closed=0;
 a.focus.activate(root,()=>{closed+=100;});a.focus.activate(child,()=>{closed++;a.focus.release(child);});
 assert.equal(a.document.activeElement,child);const event=a.key('Escape');
 assert.equal(closed,1);assert.equal(event.stopped,true);assert.equal(a.document.activeElement,button);
});
test('closing an underlying dialog cannot steal focus from a newer overlay',()=>{
 const a=setup(),root=a.element('old',a.document.body,true),button=a.element('old button',root),child=a.element('new',a.document.body,true),next=a.element('new button',child);
 a.focus.activate(root,()=>{});a.focus.activate(child,()=>{});a.focus.release(root);assert.equal(a.document.activeElement,next);
});
test('a native or separately managed overlay retains its keyboard handling',()=>{
 const a=setup(),root=a.element('custom',a.document.body,true);let closed=false;
 a.focus.activate(root,()=>{closed=true;});const native=a.element('native',a.document.body,true);native.focus();
 assert.equal(a.key('Tab').prevented,undefined);a.key('Escape');assert.equal(closed,false);
});
test('expired demo login action opens login and uses the accessible paywall lifecycle',()=>{
 const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');const start=panel.indexOf('  function showDemoExpiredModal(){');const source=panel.slice(start,panel.indexOf('  // ─── Aplicar candados',start));
 const nodes={},window={location:{}},document={getElementById:id=>nodes[id]||(nodes[id]={})};let shown=0;
 vm.runInNewContext(source+';showDemoExpiredModal();',{document,window,showPaywallModal:()=>shown++,localStorage:{getItem:()=>null}});
 assert.equal(shown,1);nodes['paywall-dismiss'].onclick();assert.equal(window.location.href,'vip-auth.html?tab=login');
});
