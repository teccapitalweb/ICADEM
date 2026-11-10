'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-ambassadors.js','utf8');
function extract(name){
  const marker=new RegExp('  (?:async )?function '+name+'\\(').exec(source);assert(marker,'missing '+name);
  const tail=source.slice(marker.index+marker[0].length),next=/\n  (?:async )?function /.exec(tail);
  return source.slice(marker.index,next?marker.index+marker[0].length+next.index:source.length);
}
function fixture(options={}){
  const downloads=[],requests=[],messages=[],modals=[],urls=[],timers=[];
  const window={__currentUser:{uid:'alice',async getIdToken(){return 'test-owner-token';}},
    Toast:Object.fromEntries(['info','error'].map(type=>[type,(title,message)=>messages.push({type,title,message})])),
    Modal:{open(config){modals.push(config);}}};
  const document={body:{appendChild(link){downloads.push(link);}},createElement(){return {click(){this.clicked=true;},remove(){this.removed=true;}};}};
  const context={window,document,Intl,Date,presentationMode:false,
    URL:{createObjectURL(blob){urls.push(blob);return 'blob:private-receipt';},revokeObjectURL(url){urls.push(url);}},
    async fetch(url,config){requests.push({url,config});return options.response?options.response():{ok:true,async blob(){return {type:'application/pdf'};}};},
    setTimeout(fn){timers.push(fn);},
  };
  vm.runInNewContext(['esc','money','date','toast','statusLabel','withdrawalsMarkup','showNotificationTarget','openReceipt'].map(extract).join('\n'),context);
  return {context,window,downloads,requests,messages,modals,urls,timers};
}

test('withdrawal history presents server payment state and escaped reference without exposing raw receipt URLs',()=>{
  const ui=fixture(),items=[{id:'request-1',amountCents:75000,status:'paid',bank:'Banco de prueba',bankLast4:'0563',bankReference:'<b>REF & 123</b>',requestedAt:'2026-11-09',paidAt:'2026-11-09',hasReceipt:true,receiptUrl:'https://legacy-private.invalid/token-secret'}];
  const html=ui.context.withdrawalsMarkup(items);
  assert.match(html,/\$750 · Pagada/);assert.match(html,/data-withdrawal-id="request-1"/);
  assert.match(html,/•••• 0563/);assert.match(html,/Referencia: &lt;b&gt;REF &amp; 123&lt;\/b&gt;/);
  assert.match(html,/data-amb-receipt="request-1"/);
  assert.doesNotMatch(html,/href=|token-secret|legacy-private|<b>REF/);
  ui.context.presentationMode=true;const presentation=ui.context.withdrawalsMarkup(items);
  assert.doesNotMatch(presentation,/0563|Banco de prueba|REF|data-amb-receipt/);
  assert.match(presentation,/\$750 · Pagada/);
});

test('receipt download uses authenticated owner endpoint, private blob and transient object URL',async()=>{
  const ui=fixture(),button={dataset:{ambReceipt:'request-1'},textContent:'Comprobante'};
  const pending=ui.context.openReceipt(button);assert.equal(button.disabled,true);await pending;
  assert.match(ui.requests[0].url,/\/api\/ambassadors\/withdrawals\/request-1\/receipt$/);
  assert.equal(ui.requests[0].config.headers.Authorization,'Bearer test-owner-token');
  assert.equal(ui.requests[0].config.cache,'no-store');
  assert.equal(ui.downloads.length,1);assert.equal(ui.downloads[0].href,'blob:private-receipt');
  assert.equal(ui.downloads[0].download,'comprobante-request-1.pdf');assert.equal(ui.downloads[0].clicked,true);
  assert.equal(ui.downloads[0].removed,true);assert.equal(button.disabled,false);assert.equal(button.textContent,'Comprobante');
  ui.timers[0]();assert.equal(ui.urls.at(-1),'blob:private-receipt');
});

test('receipt arriving after account change or session ending never opens or creates a download URL',async()=>{
  for(const ending of [false,true]){
    let resolveBlob;const blob=new Promise(resolve=>{resolveBlob=resolve;});
    const ui=fixture({response:()=>({ok:true,blob:()=>blob})}),button={dataset:{ambReceipt:'request-1'}};
    const pending=ui.context.openReceipt(button);await new Promise(resolve=>setImmediate(resolve));
    if(ending)ui.window.__sessionEnding=true;else ui.window.__currentUser={uid:'bob'};
    resolveBlob({type:'application/pdf'});await pending;
    assert.equal(ui.downloads.length,0);assert.equal(ui.urls.length,0);assert.equal(button.disabled,false);
  }
});

test('unauthenticated, duplicate and failed receipt requests cannot launch a download',async()=>{
  const ui=fixture({response:()=>({ok:false,async json(){return {error:'Comprobante no disponible'};}})}),button={dataset:{ambReceipt:'request-1'}};
  ui.window.__currentUser=null;await ui.context.openReceipt(button);assert.equal(ui.requests.length,0);
  ui.window.__currentUser={uid:'alice',async getIdToken(){return 'token';}};
  button.disabled=true;await ui.context.openReceipt(button);assert.equal(ui.requests.length,0);
  button.disabled=false;await ui.context.openReceipt(button);
  assert.equal(ui.requests.length,1);assert.equal(ui.downloads.length,0);assert.match(ui.messages[0].message,/no disponible/);
});

test('withdrawal notification highlights only its exact saved request and never an arbitrary row',()=>{
  const ui=fixture(),calls=[],nodes=['request-1','request-2'].map(id=>({dataset:{withdrawalId:id},style:{},scrollIntoView(){calls.push('scroll-'+id);},focus(){calls.push('focus-'+id);}})),root={querySelectorAll(){return nodes;}};
  ui.context.showNotificationTarget(root,{}, {withdrawalId:'request-2'});
  assert.deepEqual(calls,['scroll-request-2','focus-request-2']);assert.equal(nodes[1].style.outline,'2px solid #15976c');
  ui.context.showNotificationTarget(root,{}, {withdrawalId:'missing'});
  assert.equal(calls.length,2);assert.match(ui.messages[0].message,/no está en el historial/);
});

test('commission target opens the exact current server record beyond visible chart rows and shows no invented missing movement',()=>{
  const ui=fixture(),commissions=Array.from({length:30},(_,i)=>({id:'commission-'+i,commissionCents:i===29?15000:10000,status:i===29?'reversed':'pending',plan:'mensual',paidAt:'2026-11-09',releaseAt:'2026-11-16'}));
  ui.context.showNotificationTarget({}, {commissions}, {commissionId:'commission-29'});
  assert.equal(ui.modals.length,1);assert.match(ui.modals[0].body,/\$150 MXN/);assert.match(ui.modals[0].body,/Revertida/);assert.match(ui.modals[0].body,/commission-29/);
  ui.context.showNotificationTarget({}, {commissions}, {commissionId:'nonexistent'});
  assert.equal(ui.modals.length,1);assert.match(ui.messages[0].message,/no está en el historial/);
});
