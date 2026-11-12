/* A projection of existing posts, never a second feed or browser-owned record. */
(function(){
  'use strict';
  var context=null,epoch=0,timer=null,expiryTimer=null;
  var RETENTION=15*86400000;
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function icon(name){return '<svg class="ic" aria-hidden="true"><use href="#i-'+name+'"/></svg>';}
  function url(value,image){
    if(image&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value||''))return value;
    try{var u=new URL(value,location.href);return value&&['https:','http:'].includes(u.protocol)?u.href:'';}catch(_){return '';}
  }
  function viewer(){return window.__currentUser?.uid||window.UserState?.uid||'';}
  function active(c){return context===c&&c.viewer===viewer()&&c.root.isConnected&&!window.__sessionEnding;}
  function now(c){return c.clock?c.clock.server+Math.max(0,performance.now()-c.clock.received):Infinity;}
  function photo(profile){var src=url(profile.foto);if(src)src=window.__avatarSrc?.(src,profile.photoVersion)||src;return '<span class="activity-avatar">'+(src?'<img src="'+esc(src)+'" alt="" decoding="async" referrerpolicy="no-referrer">':esc(profile.iniciales||'MI'))+'</span>';}
  function date(ms){return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(ms);}
  function status(c,text,error){var node=c.root.querySelector('[data-activity-status]');node.textContent=text||'';node.hidden=!text;node.setAttribute('role',error?'alert':'status');}
  function paint(c,restore){
    if(!active(c))return;
    var focusPost=c.root.contains(document.activeElement)?document.activeElement.dataset.activityOpen:null;
    c.items=c.items.filter(item=>item.expiresAtMs>now(c));
    var p=c.profile,identity=c.root.querySelector('[data-activity-identity]');
    identity.innerHTML=photo(p)+'<div><strong>'+esc(p.nombre||'Profesional ICADEM')+'</strong>'+(p.profesion||p.puesto?'<p>'+esc(p.profesion||p.puesto)+'</p>':'')+'</div>'+(p.isVip?'<span class="activity-vip">'+icon('crown')+'VIP</span>':'');
    var list=c.root.querySelector('[data-activity-list]');
    list.innerHTML=c.items.length?c.items.map(item=>{
      var image=url(item.imagen,true);
      return '<article class="activity-card '+(p.isVip?'activity-card--vip':'')+'" data-activity-post="'+esc(item.id)+'"><header>'+photo(p)+'<div><strong>'+esc(p.nombre)+'</strong><time datetime="'+new Date(item.createdAtMs).toISOString()+'">'+esc(date(item.createdAtMs))+'</time></div>'+(p.isVip?'<span class="activity-vip">'+icon('crown')+'VIP</span>':'')+'</header>'+
        (item.texto?'<p class="activity-text">'+esc(item.texto)+'</p>':'')+(image?'<div class="activity-image"><img src="'+esc(image)+'" alt="Imagen compartida por '+esc(p.nombre)+'" loading="lazy" decoding="async"></div>':'')+
        '<footer><div class="activity-counts" aria-label="Interacciones de la publicación"><span>'+icon('heart')+item.likes+' <span>reacciones</span></span><span>'+icon('messages')+item.comentariosCount+' <span>comentarios</span></span></div><button type="button" data-activity-open="'+esc(item.id)+'">Ver publicación'+icon('arrow-right')+'</button></footer></article>';
    }).join(''):'<div class="activity-empty" role="status">'+icon('messages')+'<h2>Sin publicaciones recientes</h2><p>Este profesional todavía no tiene publicaciones visibles en la comunidad.</p>'+(p.own&&c.canPublish?'<button class="community-primary" data-activity-compose>Crear una publicación</button>':'')+'</div>';
    list.querySelectorAll('[data-activity-open]').forEach(button=>button.addEventListener('click',()=>window.ICADEMProfessionalNavigation.openActivityPost(button.dataset.activityOpen)));
    list.querySelector('[data-activity-compose]')?.addEventListener('click',()=>window.navigateToSection('foro',{activityPost:true}));
    var more=c.root.querySelector('[data-activity-more]');more.hidden=!c.cursor;more.disabled=c.busy;
    clearTimeout(expiryTimer);
    if(c.items.length)expiryTimer=setTimeout(()=>paint(c,false),Math.max(1,Math.min(...c.items.map(item=>item.expiresAtMs))-now(c)));
    if(restore)window.ICADEMProfessionalNavigation?.activityReady(c.root);
    if(focusPost)list.querySelector('[data-activity-open="'+CSS.escape(focusPost)+'"]')?.focus({preventScroll:true});
  }
  async function page(c,cursor){
    var response=await window.ICADEMPlatform.request('/api/community/profiles/'+encodeURIComponent(c.owner)+'/activity'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
    response.received=performance.now();
    if(!response?.ok||response.profile?.uid!==c.owner||!Array.isArray(response.items)||!Number.isFinite(response.serverNowMs))throw Error('No pudimos confirmar la actividad de este profesional.');
    response.items=response.items.filter(item=>/^[A-Za-z0-9_-]{1,180}$/.test(item.id||'')&&item.uid===c.owner&&Number.isFinite(item.createdAtMs)&&item.createdAtMs<=response.serverNowMs&&item.expiresAtMs===item.createdAtMs+RETENTION&&item.expiresAtMs>response.serverNowMs).map(item=>({...item,likes:Math.max(0,Math.floor(Number(item.likes)||0)),comentariosCount:Math.max(0,Math.floor(Number(item.comentariosCount)||0))}));
    return response;
  }
  async function load(more){
    var c=context;if(!c||!active(c)||c.busy)return;
    c.busy=true;var button=c.root.querySelector('[data-activity-more]');button.disabled=true;
    try{
      var response=await page(c,more?c.cursor:null),items=more?c.items.concat(response.items):response.items,cursor=response.nextCursor;
      if(!more)for(var index=1;index<c.pages&&cursor;index++){var next=await page(c,cursor);items=items.concat(next.items);cursor=next.nextCursor;}
      if(!active(c))return;
      c.clock={server:response.serverNowMs,received:response.received};c.profile=response.profile;c.canPublish=response.canPublish===true;
      c.items=[...new Map(items.map(item=>[item.id,item])).values()];c.cursor=cursor||null;if(more)c.pages++;
      var navigation=history.state?.icademActivity;
      if(navigation?.owner===c.owner&&navigation.viewer===c.viewer)history.replaceState({...history.state,icademActivity:{...navigation,pages:c.pages}},'',location.href);
      c.root.querySelector('[data-activity-list]').removeAttribute('aria-busy');status(c,'');paint(c,true);
      c.root.querySelector('[data-activity-retry]').hidden=true;
    }catch(error){
      if(!active(c))return;
      var unavailable=[400,403,404,410].includes(error.status);
      if(unavailable||!c.profile){c.root.querySelector('[data-activity-list]').replaceChildren();c.root.querySelector('[data-activity-identity]').replaceChildren();c.items=[];c.cursor=null;clearTimeout(expiryTimer);}
      status(c,unavailable?'La actividad de este perfil no está disponible para tu cuenta.':c.profile?'No pudimos actualizar la actividad. Reintenta para consultar la versión actual.':'No pudimos cargar la actividad. Revisa tu conexión e inténtalo de nuevo.',true);
      c.root.querySelector('[data-activity-retry]').hidden=false;
    }finally{if(active(c)){c.busy=false;button.disabled=false;button.hidden=!c.cursor;}}
  }
  function cleanup(){epoch++;clearInterval(timer);clearTimeout(expiryTimer);context=null;}
  function render(root){
    cleanup();window.ICADEMCommunity?.cleanup();
    var owner=window.ICADEMProfessionalNavigation.currentProfileId();
    root.innerHTML='<section class="professional-activity" data-professional-activity><nav class="professional-profile-toolbar" aria-label="Navegación de la actividad"><button type="button" data-activity-back>'+icon('arrow-left')+'Volver al perfil profesional</button></nav><header class="activity-heading"><span class="activity-eyebrow">COMUNIDAD ICADEM</span><h1 tabindex="-1">Actividad profesional</h1><p>Publicaciones y aportaciones compartidas en ICADEM</p><div class="activity-identity" data-activity-identity></div></header><p data-activity-status role="status">Cargando publicaciones recientes…</p><button type="button" class="community-secondary" data-activity-retry hidden>Reintentar</button><div class="activity-list" data-activity-list aria-busy="true"></div><button type="button" class="activity-more" data-activity-more hidden>Ver más publicaciones</button></section>';
    root.querySelector('[data-activity-back]').addEventListener('click',()=>window.ICADEMProfessionalNavigation.backToProfile());
    if(!window.ICADEMProfessionalNavigation.validUid(owner)){root.querySelector('[data-activity-status]').textContent='Este enlace no identifica un perfil válido.';return;}
    var saved=history.state?.icademActivity,previousPages=saved?.owner===owner&&saved.viewer===viewer()&&Number.isInteger(saved.pages)?Math.max(1,Math.min(20,saved.pages)):1;
    context={root,owner,viewer:viewer(),pages:previousPages,items:[],cursor:null,busy:false,clock:null};
    root.querySelector('[data-activity-more]').addEventListener('click',()=>load(true));root.querySelector('[data-activity-retry]').addEventListener('click',()=>load(false));
    root.querySelector('h1').focus({preventScroll:true});load(false);
    timer=setInterval(refresh,30000);
  }
  function refresh(){if(context&&document.visibilityState!=='hidden')load(false);}
  window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  document.addEventListener('visibilitychange',refresh);document.addEventListener('icadem:identity-ready',refresh);
  window.addEventListener('icadem:navigation',event=>{if(event.detail?.section!=='directorio-actividad')cleanup();});
  document.addEventListener('icadem:session-ending',()=>{if(context)context.root.replaceChildren();cleanup();});
  document.addEventListener('icadem:user-ready',()=>{if(context&&context.viewer!==viewer()){context.root.replaceChildren();cleanup();}});
  window.ICADEMProfessionalActivity={render,refresh,cleanup};
})();
