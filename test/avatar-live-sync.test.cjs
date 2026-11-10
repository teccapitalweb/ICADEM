'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
const community=fs.readFileSync(__dirname+'/../js/icadem-community.js','utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('the actual forum composer uses the current Google photo version while independent uploaded URLs stay intact',()=>{
 const window={location:{origin:'https://www.icademx.com'},UserState:{photoURL:'https://lh3.googleusercontent.com/current-photo',photoVersion:'provider-updated'}};
 const context={window,URL,avatarCacheVersion:'stale-version',escapeHtml:escape,miColor:'#244b64',ini:'QA'};
 const start=html.indexOf('window.__avatarSrc = function('),end=html.indexOf('\n};',start)+3;
 vm.runInNewContext(html.slice(start,end),context);
 const line=html.split('\n').find(line=>line.includes('<div class="foro-composer__avatar${'));
 let markup=vm.runInNewContext('`'+line.trim()+'`',context);
 assert.match(markup,/current-photo\?icadem_avatar=provider-updated/);assert.doesNotMatch(markup,/stale-version/);
 window.UserState.photoURL='https://images.test/uploaded-independent.webp';markup=vm.runInNewContext('`'+line.trim()+'`',context);
 assert.match(markup,/src="https:\/\/images.test\/uploaded-independent.webp"/);assert.doesNotMatch(markup,/icadem_avatar/);
});
function photoHandler(){
 const avatar={innerHTML:'old-photo'},draft={value:'Unsaved CV draft'},syncs=[];
 const node={dataset:{profileUid:'owner'},querySelectorAll:selector=>selector==='.pp-avatar'?[avatar]:[]};
 Object.defineProperty(node,'innerHTML',{set(){throw Error('The CV may not be rebuilt to update its photograph');}});
 const window={UserState:{uid:'owner',iniciales:'QA'},ICADEMResumeEditor:{syncPhoto:profile=>syncs.push(profile)},__avatarSrc:(url,version)=>url+'?photo-version='+version};
 const context={kind:'profile',viewer:'owner',root:{isConnected:true,querySelector:()=>node}};
 const start=community.indexOf('  function syncOwnProfilePhoto(event){'),end=community.indexOf("  document.addEventListener('icadem:identity-ready',syncOwnProfilePhoto);",start);
 const handler=vm.runInNewContext('('+community.slice(start,end).trim()+')',{window,context,esc:escape,safeUrl:url=>/^https:\/\//.test(url||'')?url:''});
 return{window,context,node,avatar,draft,syncs,handler};
}
test('late Google identity confirmation refreshes only the owner photo and leaves CV drafts and foreign profiles intact',()=>{
 const a=photoHandler();const profile={uid:'owner',photoURL:'https://lh3.googleusercontent.com/new',photoVersion:'v2',photoSource:'google'};
 a.handler({detail:{profile}});assert.match(a.avatar.innerHTML,/new\?photo-version=v2/);assert.equal(a.draft.value,'Unsaved CV draft');assert.equal(a.syncs.length,1);
 a.node.dataset.profileUid='other-professional';a.avatar.innerHTML='Foreign avatar';a.handler({detail:{profile}});assert.equal(a.avatar.innerHTML,'Foreign avatar');
 a.node.dataset.profileUid='owner';a.handler({detail:{profile:{...profile,uid:'another-account'}}});assert.equal(a.avatar.innerHTML,'Foreign avatar');
 a.window.__sessionEnding=true;a.handler({detail:{profile}});assert.equal(a.avatar.innerHTML,'Foreign avatar');
});
test('an explicit empty current photo clears the previous image without restoring a historical avatar',()=>{
 const a=photoHandler();a.handler({detail:{profile:{uid:'owner',photoURL:'',photoVersion:'v3',photoSource:'default'}}});assert.doesNotMatch(a.avatar.innerHTML,/<img/);assert.match(a.avatar.innerHTML,/QA/);
});
