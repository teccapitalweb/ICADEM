'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-support-admin.js','utf8'),tick=()=>new Promise(setImmediate);
function fixture(){
 const events={},requests=[],timers=new Map(),toasts=[];let timer=0;
 function node(){return{isConnected:true,html:'',hidden:false,attributes:{},set innerHTML(value){this.html=value;},get innerHTML(){return this.html;},replaceChildren(){this.html='';},setAttribute(name,value){this.attributes[name]=value;},querySelector(){return null;},querySelectorAll(){return[];}};}
 const list=node(),thread=node(),badge=node(),count=node(),nodes={'support-admin-list':list,'support-admin-thread':thread,'badge-support':badge,'support-inbox-count':count};
 const document={getElementById:id=>nodes[id]||null};
 const window={_fb:{auth:{currentUser:{uid:'admin-a'}}},__currentAdmin:{uid:'admin-a'},ICADEMSupportUI:{},addEventListener(name,fn){events[name]=fn;}};
 const Pages={_getAuthToken:async()=>'synthetic-token-a',_webhookUrl:'https://support.invalid'};
 const context={window,document,Pages,__seccionActual:'soporte',Intl,Date,Toast:{error:(...args)=>toasts.push(args),success:(...args)=>toasts.push(args)},
  setTimeout(){},setInterval(fn){timers.set(++timer,fn);return timer;},clearInterval(id){timers.delete(id);},fetch:(url,config)=>new Promise(resolve=>requests.push({url,config,finish:data=>resolve({ok:true,json:async()=>data})}))};
 const instrumented=source.replace(/\}\)\(\);\s*$/,'window.__supportAdminAudit={api:api,resetSession:resetSession,loadList:loadList,selectConversation:selectConversation,state:state};})();');
 vm.runInNewContext(instrumented,context);
 return{...context,api:window.__supportAdminAudit,events,requests,timers,toasts,list,thread,badge};
}

test('admin support requests are uncached and an old authenticated response cannot be returned after switching UID',async()=>{
 const a=fixture(),pending=a.api.api('/admin/support/conversations/member-a');await tick();assert.equal(a.requests.length,1);assert.equal(a.requests[0].config.cache,'no-store');assert.equal(a.requests[0].config.headers.Authorization,'Bearer synthetic-token-a');
 a.window._fb.auth.currentUser={uid:'admin-b'};a.events['icadem:admin-identity']();a.requests[0].finish({conversation:{uid:'member-a'},messages:[{text:'Private old conversation'}]});await assert.rejects(pending,/sesión cambió/);assert.equal(a.thread.html,'');assert.equal(a.list.html,'');
});

test('switching the admin identity during token renewal prevents starting the old fetch',async()=>{
 const a=fixture();let token;a.Pages._getAuthToken=()=>new Promise(resolve=>token=resolve);const pending=a.api.api('/admin/support/conversations/member-a/read',{method:'POST',body:'{"messages":[]}'});
 a.window._fb.auth.currentUser={uid:'admin-b'};a.events['icadem:admin-identity']();token('stale-token-a');await assert.rejects(pending,/sesión cambió/);assert.equal(a.requests.length,0);
});

test('a delayed old admin list cannot repopulate private conversations or unread counts in the next identity',async()=>{
 const a=fixture(),pending=a.api.loadList(true);await tick();assert.equal(a.requests.length,1);a.window._fb.auth.currentUser={uid:'admin-b'};a.events['icadem:admin-identity']();
 a.requests[0].finish({conversations:[{uid:'old-member',userName:'Private Member A',lastMessage:'Private preview',unreadAdmin:8}],unread:8});await pending;
 assert.equal(a.api.state.conversations.length,0);assert.equal(a.api.state.selected,null);assert.equal(a.list.html,'');assert.equal(a.thread.html,'');assert.equal(a.badge.hidden,true);assert.equal(a.toasts.length,0);
});

test('admin identity reset clears private visible thread and polling while preserving response-generation protection even for the same UID',async()=>{
 const a=fixture();a.list.html='Old private list';a.thread.html='Old private draft';a.api.state.selected='member-a';a.api.state.conversations=[{uid:'member-a'}];a.api.state.timer=a.setInterval(()=>{});
 const pending=a.api.api('/admin/support/conversations/member-a/messages/message-a',{method:'PATCH',body:'{"message":"Private correction","expectedRevision":0}'});await tick();assert.equal(a.requests[0].config.headers['Content-Type'],'application/json');
 a.api.resetSession();assert.equal(a.thread.html,'');assert.equal(a.list.html,'');assert.equal(a.timers.size,0);assert.equal(a.api.state.selected,null);a.requests[0].finish({ok:true,message:{text:'Private correction'}});await assert.rejects(pending,/sesión cambió/);
});

test('Firebase logout does not fall back to a stale cached __currentAdmin identity',async()=>{
 const a=fixture();a.window._fb.auth.currentUser=null;a.events['icadem:admin-identity']();await assert.rejects(a.api.api('/admin/support/conversations'),/sesión terminó/);assert.equal(a.requests.length,0);assert.equal(a.badge.hidden,true);
});

test('a late conversation detail response cannot overwrite the latest selected member',async()=>{
 const a=fixture(),old=a.api.selectConversation('member-a');await tick();const latest=a.api.selectConversation('member-b');await tick();assert.equal(a.requests.length,2);
 a.requests[0].finish({conversation:{uid:'member-a',userName:'Private A'},messages:[{text:'Old A'}]});await old;assert.equal(a.api.state.selected,'member-b');assert.doesNotMatch(a.thread.html,/Private A|Old A/);
 a.thread.isConnected=false;a.requests[1].finish({conversation:{uid:'member-b',userName:'B'},messages:[]});await latest;assert.equal(a.api.state.selected,'member-b');
});
