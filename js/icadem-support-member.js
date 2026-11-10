/* Private support presentation. Existing authenticated API and polling are retained. */
(function(){
  'use strict';
  var poll=null,view=null,lastRoot=null,sessionGeneration=0,sessionUid='',ui=window.ICADEMSupportUI;
  function currentUid(){return window.__auth?.currentUser?.uid||'';}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  async function request(path,options){
    var user=window.__auth&&window.__auth.currentUser;
    if(!user||window.__sessionEnding)throw new Error('Tu sesión terminó. Vuelve a ingresar.');
    var uid=user.uid,generation=sessionGeneration;
    function assertSession(){if(window.__sessionEnding||generation!==sessionGeneration||currentUid()!==uid)throw Object.assign(new Error('Tu sesión cambió. Vuelve a ingresar.'),{code:'session-ended'});}
    var config=Object.assign({},options||{}),token=await user.getIdToken();
    assertSession();
    config.cache='no-store';
    config.headers=Object.assign({Authorization:'Bearer '+token},config.headers||{});
    if(config.body)config.headers['Content-Type']='application/json';
    var response=await fetch((window.WEBHOOK_URL||'https://icadem-webhook-production.up.railway.app')+path,config),data=await response.json().catch(function(){return{};});
    assertSession();
    if(!response.ok)throw new Error(data.error||'No pudimos conectar con soporte');
    return data;
  }
  function fmt(value,dayOnly){
    if(!value)return dayOnly?'Conversación':'';
    var date=new Date(value);if(Number.isNaN(date.getTime()))return'';
    if(dayOnly)return date.toDateString()===new Date().toDateString()?'Hoy':new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric'}).format(date);
    return new Intl.DateTimeFormat('es-MX',{hour:'numeric',minute:'2-digit'}).format(date);
  }
  function messagesHtml(messages){
    if(!messages?.length)return '<div class="support-empty"><div class="sp-empty-art">'+ui.icon('chat')+'</div><span class="sp-eyebrow">TU ESPACIO DE ATENCIÓN</span><strong>¿En qué podemos ayudarte?</strong><p>Elige el tema de tu consulta y escribe al equipo ICADEM. Tu conversación se conservará aquí.</p><span class="sp-empty-private">'+ui.icon('shield')+'Una conversación privada</span></div>';
    var lastDay='';return messages.map(function(message){
      var day=message.createdAt?new Date(message.createdAt).toDateString():'sin-fecha',divider=day!==lastDay?'<div class="support-day" data-support-key="day-'+esc(day)+'"><span>'+esc(fmt(message.createdAt,true))+'</span></div>':'';lastDay=day;
      return divider+'<div class="support-message '+(message.sender==='member'?'is-member':'is-admin')+'" data-support-key="message-'+esc(message.id)+'" data-support-message><div class="support-bubble"><div class="support-bubble__sender">'+(message.sender==='member'?'Tú':'Equipo ICADEM')+'</div><div class="support-bubble__text">'+esc(message.text||'')+'</div><time class="support-bubble__time" datetime="'+esc(message.createdAt||'')+'">'+esc(fmt(message.createdAt,false))+'</time></div></div>';
    }).join('');
  }
  async function load(silent){
    var current=view;if(!current||current.loading||!current.root.isConnected)return;current.loading=true;
    var box=current.root.querySelector('#support-messages'),revision=current.picker.revision();
    try{
      var data=await request('/support/me');if(view!==current||!current.root.isConnected)return;
      ui.syncMessages(box,messagesHtml(data.messages||[]),current.firstPaint);current.firstPaint=false;
      ui.setCaseStatus(current.root,data.conversation);current.picker.set(data.conversation?.topic||'membresia',revision);
      var dot=document.getElementById('support-unread-dot');if(dot)dot.hidden=true;
    }catch(error){
      if(!silent&&view===current&&current.firstPaint){box.innerHTML='<div class="support-empty"><div class="sp-empty-art">'+ui.icon('help')+'</div><strong>No pudimos abrir la conversación</strong><p>Revisa tu conexión o vuelve a iniciar sesión. Tu historial se conserva.</p><button type="button" class="sp-retry" data-support-retry>Volver a intentar</button></div>';box.querySelector('[data-support-retry]')?.addEventListener('click',function(){load(false);});}
    }finally{current.loading=false;}
  }
  async function refreshBadge(){try{var data=await request('/support/me?peek=1'),dot=document.getElementById('support-unread-dot');if(dot)dot.hidden=!(data.conversation&&data.conversation.unreadUser>0);}catch(_){}}
  function beginPoll(){clearInterval(poll);if(!currentUid()||window.__sessionEnding)return;poll=setInterval(function(){if(document.visibilityState==='hidden')return;if(location.hash.replace(/^#/,'')==='soporte')load(true);else refreshBadge();},20000);}
  function resetSession(){
    sessionGeneration++;clearInterval(poll);poll=null;
    if(view?.root?.querySelector('[data-support-premium]'))view.root.replaceChildren();
    view=null;sessionUid='';var dot=document.getElementById('support-unread-dot');if(dot)dot.hidden=true;
  }
  function ready(){
    var uid=currentUid();if(!uid||window.__sessionEnding)return;
    if(sessionUid!==uid){resetSession();sessionUid=uid;if(lastRoot?.isConnected&&location.hash.replace(/^#/,'')==='soporte')Sections.renderers.soporte(lastRoot);}
    refreshBadge();beginPoll();
  }
  Sections.renderers.soporte=function(root){
    root.innerHTML='<div class="support-page sp-premium" data-support-premium>'+ui.hero(false)+'<div class="support-layout"><details class="support-info sp-case" open><summary><span><span class="sp-eyebrow">TU SOLICITUD</span><strong>Detalles de tu consulta</strong></span>'+ui.icon('arrow')+'</summary><div class="sp-case__body">'+ui.categoriesMarkup()+'<section class="sp-case-status"><span>Estado del caso</span><strong class="sp-case-state" data-support-case-state data-state="loading">Cargando estado…</strong></section><div class="sp-case-note">'+ui.icon('book')+'<div><strong>Seguimiento en el mismo lugar</strong><p>Tu historial se conserva para continuar donde lo dejaste.</p></div></div><div class="sp-case-note">'+ui.icon('shield')+'<div><strong>Conversación privada</strong><p>Solo tú y el equipo de administración pueden consultar este espacio.</p></div></div></div></details><section class="support-thread" aria-label="Conversación de soporte"><header class="support-thread__head"><div class="support-thread__identity"><div class="support-thread__avatar">'+ui.icon('headset')+'</div><div><strong>Equipo ICADEM</strong><span>Administración de membresías</span></div></div><span class="sp-case-state" data-support-case-state data-state="loading">Cargando…</span></header><div class="sp-message-stage"><div class="support-messages" id="support-messages" role="log" tabindex="0" aria-label="Historial de la conversación" aria-live="polite" aria-relevant="additions" aria-atomic="false"><div class="support-loading"><span class="sp-loading-mark">'+ui.icon('chat')+'</span><p>Cargando tu conversación…</p></div></div><button class="sp-new-messages" data-support-new type="button" hidden>Nuevos mensajes '+ui.icon('arrow')+'</button></div>'+ui.composerMarkup(false)+'</section></div></div>';
    var current={root:root,loading:false,firstPaint:true,picker:null};view=current;lastRoot=root;sessionUid=currentUid();
    current.picker=ui.bindCategories(root,function(topic){return request('/support/me',{method:'PATCH',body:JSON.stringify({topic:topic})});});
    if(root.querySelector('[data-support-premium]').getBoundingClientRect().width<=720)root.querySelector('.sp-case').open=false;
    ui.bindThread(root);
    ui.bindComposer(root.querySelector('#support-form'),{topic:current.picker.value,send:function(body){return request('/support/me/messages',{method:'POST',body:JSON.stringify(body)});},sent:function(){return load(true);}});
    load(false);beginPoll();
  };
  document.getElementById('btn-private-support')?.addEventListener('click',function(){navigateToSection('soporte');});
  document.addEventListener('icadem:user-ready',ready);
  document.addEventListener('icadem:identity-ready',ready);
  document.addEventListener('icadem:session-exit-failed',ready);
  document.addEventListener('icadem:session-ending',resetSession);
  document.addEventListener('icadem:session-ended',resetSession);
  function refreshVisible(){if(document.visibilityState==='hidden'||!currentUid()||window.__sessionEnding)return;if(location.hash.replace(/^#/,'')==='soporte')load(true);else refreshBadge();}
  document.addEventListener('visibilitychange',refreshVisible);
  window.addEventListener('online',refreshVisible);
  setTimeout(ready,2200);
})();
