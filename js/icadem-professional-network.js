/* Member-visible network projection. Accepted relationships remain server-owned. */
(function(){
 'use strict';var current=null,summary=null,timer;
 const nav=()=>window.ICADEMProfessionalNavigation,viewer=()=>window.__currentUser?.uid||window.UserState?.uid||'';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=n=>'<svg class="ic" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
 function photo(p){let src='';try{const u=new URL(p.foto,location.href);if(p.foto&&['https:','http:'].includes(u.protocol))src=window.__avatarSrc?.(u.href,p.photoVersion)||u.href;}catch(_){}
  return '<span class="network-photo">'+(src?'<img src="'+esc(src)+'" alt="" data-initials="'+esc(p.iniciales||'MI')+'" decoding="async" referrerpolicy="no-referrer">':esc(p.iniciales||'MI'))+'</span>';}
 const api=(p,options)=>window.ICADEMPlatform.request('/api/community'+p,options);
 const alive=c=>current===c&&c.viewer===viewer()&&c.root.isConnected&&!window.__sessionEnding;
 function checked(data,owner){if(!data?.ok||data.profile?.uid!==owner||!Array.isArray(data.items)||!Array.isArray(data.preview)||!Number.isSafeInteger(data.visibleCount)||!Number.isSafeInteger(data.mutualCount))throw Error('No pudimos confirmar la red de este perfil.');return data;}
 function wirePhotos(root){root.querySelectorAll('.network-photo img').forEach(img=>img.addEventListener('error',()=>{const node=img.parentElement;if(node)node.textContent=img.dataset.initials||'MI';},{once:true}));}
 function summaryAlive(c){return summary===c&&c.slot.isConnected&&viewer()===c.viewer&&!window.__sessionEnding;}
 function paintSummary(c,data){
  const peers=data?[...new Map(data.preview.map(p=>[p.uid,p])).values()].slice(0,3):[];
  c.slot.innerHTML='<button type="button" class="profile-network-strip" data-profile-network><span class="network-stack" aria-hidden="true">'+(peers.length?peers.map(photo).join(''):'<span class="network-empty-icon">'+icon('users')+'</span>')+'</span><span class="network-strip-copy"><strong>Red profesional</strong><small>'+(data?data.visibleCount+' '+(data.visibleCount===1?'conexión':'conexiones'):'No pudimos cargar las conexiones')+'</small></span>'+icon('arrow-right')+'</button>';
  c.slot.hidden=false;wirePhotos(c.slot);c.slot.querySelector('button').addEventListener('click',()=>nav().openNetwork(c.owner));
 }
 async function loadSummary(c){
  if(!summaryAlive(c))return;if(c.busy){c.queued=true;return;}c.busy=true;
  try{const data=checked(await api('/profiles/'+encodeURIComponent(c.owner)+'/network?preview=1'),c.owner);
   if(!summaryAlive(c))return;paintSummary(c,data);
  }catch(_){if(summaryAlive(c))paintSummary(c,null);}
  finally{c.busy=false;if(summaryAlive(c)&&c.queued){c.queued=false;loadSummary(c);}}
 }
 async function mountSummary(slot,profile){
  if(!slot||!nav()?.validUid(profile.uid))return;
  const same=summary?.slot===slot&&summary.owner===profile.uid&&summary.viewer===viewer();
  const c=same?summary:{slot,owner:profile.uid,viewer:viewer(),busy:false,queued:false};summary=c;
  if(!current){clearInterval(timer);timer=setInterval(refresh,30000);}
  return loadSummary(c);
 }
 function actions(row,c){const id=esc(row.uid);if(row.uid===c.viewer||row.connection==='self')return '<span class="network-row-state">Tú</span>';
  if(row.connection==='connected')return '<span class="network-row-state network-row-state--connected">'+icon('check')+'Conectados</span>';
  if(row.connection==='sent')return '<span class="network-row-state">Pendiente</span><button data-network-action="cancel" data-uid="'+id+'" class="network-row-secondary">Cancelar</button>';
  if(row.connection==='received')return '<button data-network-action="accept" data-uid="'+id+'" class="network-row-primary">Aceptar</button><button data-network-action="reject" data-uid="'+id+'" class="network-row-secondary">Rechazar</button>';
  return row.connection==='none'?'<button data-connect="'+id+'" data-uid="'+id+'" class="network-row-primary">'+icon('users')+'Conectar</button>':'';
 }
 function paint(c,restore){
  if(!alive(c))return;
  const data=c.data,list=c.root.querySelector('[data-network-list]'),focused=list.querySelector(':focus'),focusUid=focused?.dataset.uid,focusAction=focused?.dataset.networkAction;
  c.root.querySelector('[data-network-owner]').textContent=data.profile.nombre||'Profesional ICADEM';
  c.root.querySelectorAll('[data-network-tab]').forEach(b=>{const selected=b.dataset.networkTab===c.tab;b.setAttribute('aria-selected',String(selected));b.classList.toggle('is-active',selected);b.querySelector('span').textContent=String(b.dataset.networkTab==='mutual'?data.mutualCount:data.visibleCount);});
  list.innerHTML=c.items.length?c.items.map(p=>'<article class="network-person" data-network-row="'+esc(p.uid)+'"><button class="network-person-profile" data-network-profile="'+esc(p.uid)+'">'+photo(p)+'<span><strong>'+esc(p.nombre)+'</strong>'+(p.profesion||p.puesto?'<small>'+esc(p.profesion||p.puesto)+'</small>':'')+'</span></button><div class="network-person-actions">'+actions(p,c)+'</div></article>').join(''):'<p class="network-empty" role="status">'+(c.tab==='mutual'?'Todavía no tienen conexiones en común':c.owner===c.viewer?'Todavía no tienes conexiones':'Este profesional todavía no tiene conexiones')+'</p>';
  wirePhotos(list);
  list.querySelectorAll('[data-network-profile]').forEach(b=>b.addEventListener('click',()=>nav().openNetworkProfile(b.dataset.networkProfile)));
  list.querySelectorAll('[data-connect],[data-network-action]').forEach(b=>b.addEventListener('click',()=>act(c,b,b.dataset.networkAction||'request')));
  c.root.querySelector('[data-network-more]').hidden=!c.cursor;
  if(restore)nav().networkReady(c.root);
  if(focusUid){const buttons=[...list.querySelectorAll('[data-uid]')];buttons.find(b=>b.dataset.uid===focusUid&&(b.dataset.networkAction||'request')===(focusAction||'request'))?.focus({preventScroll:true});}
 }
 function message(c,text,error){const node=c.root.querySelector('[data-network-status]');node.textContent=text||'';node.hidden=!text;node.setAttribute('role',error?'alert':'status');}
 async function load(more){const c=current;if(!c||!alive(c))return;if(c.busy){if(!more)c.queued=true;return;}c.busy=true;const version=c.version;
  c.root.querySelector('[data-network-more]').disabled=true;
  try{let d=checked(await api('/profiles/'+encodeURIComponent(c.owner)+'/network?tab='+c.tab+(more&&c.cursor?'&cursor='+encodeURIComponent(c.cursor):'')),c.owner),items=more?c.items.concat(d.items):d.items,cursor=d.nextCursor;
   if(!more)for(let i=1;i<c.pages&&cursor;i++){const next=checked(await api('/profiles/'+encodeURIComponent(c.owner)+'/network?tab='+c.tab+'&cursor='+encodeURIComponent(cursor)),c.owner);items=items.concat(next.items);cursor=next.nextCursor;}
   if(!alive(c))return;if(version!==c.version){c.queued=true;return;}c.data=d;c.items=[...new Map(items.map(p=>[p.uid,p])).values()];c.cursor=cursor;if(more)c.pages++;
   const state=history.state?.icademNetwork;if(state?.owner===c.owner&&state.viewer===c.viewer)history.replaceState({...history.state,icademNetwork:{...state,pages:c.pages}},'',location.href);
   message(c,'');c.root.querySelector('[data-network-retry]').hidden=true;paint(c,true);
  }catch(error){if(!alive(c))return;if([400,401,403,404,410].includes(error.status)||!c.data){c.items=[];c.cursor=null;c.data=null;c.root.querySelector('[data-network-list]').replaceChildren();c.root.querySelector('[data-network-owner]').textContent='';c.root.querySelectorAll('[data-network-tab] span').forEach(n=>n.textContent='—');c.root.querySelector('[data-network-more]').hidden=true;}
   message(c,[401,403,404,410].includes(error.status)?'Esta red no está disponible para tu cuenta.':'No pudimos actualizar la red. Reintenta para consultar los datos actuales.',true);c.root.querySelector('[data-network-retry]').hidden=false;
  }finally{if(alive(c)){c.busy=false;c.root.querySelector('[data-network-more]').disabled=false;c.root.querySelector('[data-network-list]').removeAttribute('aria-busy');if(c.queued){c.queued=false;load(false);}}}
 }
 async function act(c,button,action){const uid=button.dataset.uid;if(!alive(c)||c.pending.has(uid))return;c.pending.add(uid);const label=button.innerHTML;button.disabled=true;button.textContent='Guardando…';
  try{const result=await api('/connections'+(action==='request'?'':'/'+encodeURIComponent(uid)+'/'+action),{method:'POST',body:action==='request'?{targetUid:uid}:{}});if(!alive(c))return;if(result?.ok!==true)throw Error('El servidor no confirmó la solicitud.');c.version++;await load(false);if(alive(c))window.Toast?.success?.(action==='request'?'Solicitud enviada':action==='accept'?'Conexión aceptada':'Solicitud actualizada','');}
  catch(error){if(alive(c))window.Toast?.error?.('No se pudo guardar',error.message||'Reintenta cuando tengas conexión.');}
  finally{c.pending.delete(uid);if(button.isConnected){button.disabled=false;button.innerHTML=label;}}
 }
 function cleanup(){clearInterval(timer);current=null;summary=null;}
 function render(root){cleanup();window.ICADEMCommunity?.cleanup();const owner=nav().currentProfileId(),own=owner===viewer(),tab=own?'connections':nav().networkTab();
  root.innerHTML='<section class="professional-network" data-professional-network><nav class="professional-profile-toolbar"><button data-network-owner-back>'+icon('arrow-left')+'Volver al perfil</button></nav><header class="network-heading"><span>DIRECTORIO PROFESIONAL</span><h1 tabindex="-1">Red profesional</h1><p data-network-owner></p></header><div class="network-tabs'+(own?' network-tabs--own':'')+'" role="tablist" aria-label="Explorar la red"><button role="tab" data-network-tab="connections">Conexiones <span>0</span></button>'+(own?'':'<button role="tab" data-network-tab="mutual">En común <span>0</span></button>')+'</div><p data-network-status role="status">Cargando conexiones…</p><button class="community-secondary" data-network-retry hidden>Reintentar</button><div class="network-list" data-network-list role="tabpanel" aria-busy="true"></div><button class="community-secondary" data-network-more hidden>Ver más conexiones</button></section>';
  root.querySelector('[data-network-owner-back]').addEventListener('click',()=>nav().networkOwnerBack());
  if(!nav().validUid(owner)){root.querySelector('[data-network-status]').textContent='Este enlace no identifica un perfil válido.';return;}
  const saved=history.state?.icademNetwork;current={root,owner,viewer:viewer(),tab,data:null,items:[],cursor:null,pages:saved?.owner===owner&&saved.viewer===viewer()&&Number.isInteger(saved.pages)?Math.max(1,Math.min(20,saved.pages)):1,busy:false,pending:new Set(),version:0,queued:false};
  root.querySelector('[data-network-retry]').addEventListener('click',()=>load(false));root.querySelector('[data-network-more]').addEventListener('click',()=>load(true));
  const tabs=[...root.querySelectorAll('[data-network-tab]')];tabs.forEach((b,i)=>{b.addEventListener('click',()=>window.navigateToSection('directorio-red',{profileUid:owner,networkTab:b.dataset.networkTab,reemplazar:true}));b.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+1)%tabs.length].focus();}});});
  root.querySelector('h1').focus({preventScroll:true});load(false);timer=setInterval(refresh,30000);
 }
 function refresh(){if(document.visibilityState==='hidden')return;if(current)load(false);else if(summary?.slot.isConnected&&summary.viewer===viewer())loadSummary(summary);}
 window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);document.addEventListener('icadem:identity-ready',refresh);
 window.addEventListener('icadem:navigation',event=>{if(event.detail?.section!=='directorio-red')cleanup();});
 document.addEventListener('icadem:session-ending',()=>{if(current)current.root.replaceChildren();if(summary)summary.slot.replaceChildren();cleanup();});
 document.addEventListener('icadem:user-ready',()=>{if(current&&current.viewer!==viewer()){current.root.replaceChildren();cleanup();}if(summary&&summary.viewer!==viewer()){summary.slot.replaceChildren();summary=null;}});
 window.ICADEMProfessionalNetwork={render,mountSummary,refresh,cleanup};
})();
