
/* ══════════════════════ BUZÓN PRIVADO · ADMIN ══════════════ */
(function(){
  var ui=window.ICADEMSupportUI,tools=window.ICADEMSupportMessages;
  var state={conversations:[],selected:null,filter:'open',search:'',timer:null,request:0,generation:0,sessionUid:'',messageTools:null};
  function currentUid(){return window._fb?.auth?(window._fb.auth.currentUser?.uid||''):(window.__currentAdmin?.uid||'');}
  function resetSession(){state.generation++;state.request++;clearInterval(state.timer);state.timer=null;state.messageTools?.dispose();state.messageTools=null;state.selected=null;state.conversations=[];state.sessionUid=currentUid();document.getElementById('support-admin-thread')?.replaceChildren();document.getElementById('support-admin-list')?.replaceChildren();var badge=document.getElementById('badge-support');if(badge)badge.hidden=true;}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  async function api(path,options){
    var uid=currentUid(),generation=state.generation;if(!uid)throw new Error('Tu sesión terminó. Vuelve a ingresar.');
    function assertSession(){if(currentUid()!==uid||state.generation!==generation)throw new Error('Tu sesión cambió. Vuelve a ingresar.');}
    var token=await Pages._getAuthToken(),config=Object.assign({},options||{});assertSession();config.cache='no-store';
    config.headers=Object.assign({Authorization:'Bearer '+token},config.headers||{});
    if(config.body&&!config.headers['Content-Type'])config.headers['Content-Type']='application/json';
    var response=await fetch(Pages._webhookUrl+path,config),data=await response.json().catch(function(){return{};});
    assertSession();if(!response.ok)throw Object.assign(new Error(data.error||'No se pudo consultar el buzón'),{status:response.status,code:data.code,data:data}); return data;
  }
  function fmt(value){if(!value)return'';var date=new Date(value);if(Number.isNaN(date.getTime()))return'';var same=date.toDateString()===new Date().toDateString();return new Intl.DateTimeFormat('es-MX',same?{hour:'numeric',minute:'2-digit'}:{day:'numeric',month:'short'}).format(date);}
  function topic(value){return({membresia:'Membresía',cobros:'Cobros',cuenta:'Cuenta',cursos:'Cursos',otro:'Otro'})[value]||'Otro';}
  function initials(name,email){var p=String(name||email||'?').split(/[\s@.]+/).filter(Boolean);return((p[0]||'?')[0]+(p[1]||'')).slice(0,2).toUpperCase();}
  function filtered(){var q=state.search.trim().toLowerCase();return state.conversations.filter(function(item){if(state.filter!=='all'&&item.status!==state.filter)return false;return!q||[item.userName,item.userEmail,item.lastMessage,topic(item.topic)].join(' ').toLowerCase().includes(q);});}
  function renderList(){
    var list=document.getElementById('support-admin-list');if(!list)return;var rows=filtered(),count=document.getElementById('support-inbox-count');if(count)count.textContent=String(rows.length);
    if(!rows.length){list.innerHTML='<div class="support-inbox-empty"><div class="support-inbox-empty__icon"><svg class="ic"><use href="#i-mail"/></svg></div><strong>'+(state.filter==='open'?'Bandeja al día':'Sin resultados')+'</strong><p>'+(state.filter==='open'?'Los nuevos mensajes de los miembros aparecerán aquí.':'Prueba con otra búsqueda o cambia el filtro.')+'</p></div>';return;}
    list.innerHTML=rows.map(function(item){return'<button class="support-conversation-item '+(state.selected===item.uid?'is-active':'')+'" type="button" data-support-uid="'+esc(item.uid)+'"><span class="support-conversation-item__avatar">'+esc(initials(item.userName,item.userEmail))+'</span><span class="support-conversation-item__body"><span class="support-conversation-item__top"><strong>'+esc(item.userName||'Miembro ICADEM')+'</strong><span class="support-conversation-item__time">'+esc(fmt(item.updatedAt))+'</span></span><span class="support-conversation-item__preview">'+esc(item.lastSender==='member'?'Mensaje del miembro':item.lastSender==='admin'?'Respuesta de administración':'Sin mensajes')+'</span><span class="support-conversation-item__meta"><span class="support-topic-tag">'+esc(topic(item.topic))+'</span><span class="support-state-tag '+(item.status==='closed'?'is-closed':'')+'">'+(item.status==='closed'?'Resuelto':'Abierto')+'</span></span></span>'+(item.unreadAdmin?'<span class="support-unread-count">'+Math.min(99,item.unreadAdmin)+'</span>':'<span></span>')+'</button>';}).join('');
    list.querySelectorAll('[data-support-uid]').forEach(function(button){button.addEventListener('click',function(){selectConversation(button.dataset.supportUid);});});
  }
  async function loadList(silent){
    try{var data=await api('/admin/support/conversations');state.conversations=data.conversations||[];var badge=document.getElementById('badge-support');if(badge){var unread=Number(data.unread)||0;badge.hidden=unread<1;badge.setAttribute('aria-label',unread?'Hay mensajes pendientes':'Sin mensajes pendientes');}if(document.getElementById('support-admin-list')){renderList();if(state.selected&&state.forceDetail){state.forceDetail=false;selectConversation(state.selected);}else if(!state.selected&&state.conversations.length){var preferred=state.conversations.find(function(item){return item.unreadAdmin>0;})||state.conversations.find(function(item){return item.status==='open';})||state.conversations[0];if(preferred)selectConversation(preferred.uid);}}}
    catch(error){if(!silent&&document.getElementById('support-admin-list'))Toast.error('No se pudo cargar el buzón','Revisa tu conexión y vuelve a intentarlo.');}
  }
  function renderMessages(messages){
    if(!messages?.length)return '<div class="support-empty"><div class="sp-empty-art">'+ui.icon('chat')+'</div><strong>Sin mensajes todavía</strong><p>El tema de la consulta está disponible. Los mensajes aparecerán en este espacio.</p></div>';
    var lastDay='';return messages.map(function(message){
      var day=message.createdAt?new Date(message.createdAt).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}):'',divider=day&&day!==lastDay?'<div class="support-day" data-support-key="day-'+esc(day)+'"><span>'+esc(day)+'</span></div>':'';lastDay=day;
      var time=message.createdAt?new Intl.DateTimeFormat('es-MX',{hour:'numeric',minute:'2-digit'}).format(new Date(message.createdAt)):'';
      var mine=message.sender==='admin';
      return divider+'<div class="support-admin-message '+(mine?'is-admin':'is-member')+'" data-support-key="message-'+esc(message.id)+'" data-support-message tabindex="-1"'+(tools?tools.attributes(message,mine):'')+'><div class="support-admin-bubble"><div class="support-admin-bubble__name">'+(mine?'Administración ICADEM':'Miembro')+'</div><div class="support-admin-bubble__text">'+esc(message.withdrawn===true?'Mensaje retirado':message.text||'')+'</div>'+(tools?tools.meta(message,mine,time):'<time class="support-admin-bubble__time" datetime="'+esc(message.createdAt||'')+'">'+esc(time)+'</time>')+'</div></div>';
    }).join('');
  }
  function renderDetail(data){
    var root=document.getElementById('support-admin-thread');if(!root)return;state.messageTools?.dispose();var conversation=data.conversation,closed=conversation.status==='closed';
    root.innerHTML='<header class="support-admin-thread__head"><div class="support-thread__avatar">'+ui.icon('chat')+'</div><div class="support-admin-thread__person"><strong>'+esc(conversation.userName||'Miembro ICADEM')+'</strong><a href="mailto:'+encodeURIComponent(conversation.userEmail||'')+'">'+esc(conversation.userEmail||conversation.uid)+'</a></div><div class="support-admin-thread__actions"><span class="support-state-tag '+(closed?'is-closed':'')+'">'+topic(conversation.topic)+' · '+(closed?'Resuelto':'Abierto')+'</span><button class="support-resolution '+(closed?'is-reopen':'')+'" id="support-resolution" data-status="'+(closed?'open':'closed')+'" type="button">'+(closed?'Reabrir':'Marcar resuelto')+'</button></div></header><div class="sp-message-stage"><div class="support-admin-messages" id="support-admin-messages" role="log" tabindex="0" aria-label="Historial de la conversación" aria-live="polite" aria-relevant="additions" aria-atomic="false">'+renderMessages(data.messages||[])+'</div><button class="sp-new-messages" type="button" data-support-new hidden>Nuevos mensajes '+ui.icon('arrow')+'</button></div>'+ui.composerMarkup(true);
    var messages=document.getElementById('support-admin-messages');messages.scrollTop=messages.scrollHeight;var uid=conversation.uid;ui.bindThread(root);
    var actor=currentUid();state.messageTools=tools?.bind(root,{box:'#support-admin-messages',active:function(){return actor===currentUid()&&state.selected===uid&&typeof __seccionActual!=='undefined'&&__seccionActual==='soporte';},edit:function(id,body){return api('/admin/support/conversations/'+encodeURIComponent(uid)+'/messages/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(body)});},visibility:function(id,body){return api('/admin/support/conversations/'+encodeURIComponent(uid)+'/messages/'+encodeURIComponent(id)+'/visibility',{method:'PATCH',body:JSON.stringify(body)});},read:function(body){return api('/admin/support/conversations/'+encodeURIComponent(uid)+'/read',{method:'POST',body:JSON.stringify(body)});},readResult:function(result){var item=state.conversations.find(function(row){return row.uid===uid;});if(item&&result.conversation)item.unreadAdmin=result.conversation.unreadAdmin;renderList();var badge=document.getElementById('badge-support');if(badge)badge.hidden=!state.conversations.some(function(row){return row.unreadAdmin>0;});},refresh:function(){return selectConversation(uid,true);}});state.messageTools?.update(data.messages||[]);
    ui.bindComposer(document.getElementById('support-admin-form'),{
      send:function(body){return api('/admin/support/conversations/'+encodeURIComponent(uid)+'/messages',{method:'POST',body:JSON.stringify(body)});},
      sent:async function(){if(state.selected===uid)await selectConversation(uid,true);await loadList(true);}
    });
    document.getElementById('support-resolution').addEventListener('click',function(event){setStatus(event.currentTarget.dataset.status);});
  }
  async function selectConversation(uid,silent){
    state.selected=uid;var ticket=++state.request;renderList();var root=document.getElementById('support-admin-thread');
    if(root&&!silent){state.messageTools?.dispose();state.messageTools=null;root.innerHTML='<div class="support-admin-thread__empty"><div class="spin"></div><p>Cargando conversación…</p></div>';}
    try{
      var data=await api('/admin/support/conversations/'+encodeURIComponent(uid));
      if(state.selected!==uid||ticket!==state.request||!root||!root.isConnected)return;
      if(silent&&root.querySelector('#support-admin-form')){
        var messages=state.messageTools?state.messageTools.reconcile(data.messages||[]):data.messages||[];
        window.ICADEMSupportUI.syncMessages(root.querySelector('#support-admin-messages'),renderMessages(messages));state.messageTools?.update(messages);
        var closed=data.conversation.status==='closed',tag=root.querySelector('.support-state-tag'),resolution=root.querySelector('#support-resolution');
        tag.textContent=topic(data.conversation.topic)+' · '+(closed?'Resuelto':'Abierto');tag.classList.toggle('is-closed',closed);
        resolution.textContent=closed?'Reabrir':'Marcar resuelto';resolution.dataset.status=closed?'open':'closed';
      }else renderDetail(data);
      var item=state.conversations.find(function(row){return row.uid===uid;});if(item)item.unreadAdmin=Number(data.conversation.unreadAdmin)||0;renderList();
      var badge=document.getElementById('badge-support');if(badge)badge.hidden=!state.conversations.some(function(row){return row.unreadAdmin>0;});
    }catch(error){if(!silent)Toast.error('No se pudo abrir la conversación','Inténtalo de nuevo. Tu historial se conserva.');}
  }
  async function setStatus(status){if(!state.selected)return;try{await api('/admin/support/conversations/'+encodeURIComponent(state.selected),{method:'PATCH',body:JSON.stringify({status:status})});await loadList(true);await selectConversation(state.selected,true);Toast.success(status==='closed'?'Conversación resuelta':'Conversación reabierta',status==='closed'?'El historial se conserva.':'Ya puedes continuar respondiendo.');}catch(error){Toast.error('No se pudo actualizar','Inténtalo de nuevo. El historial se conserva.');}}
  function pollInbox(){loadList(true);if(typeof __seccionActual!=='undefined'&&__seccionActual==='soporte'&&state.selected)selectConversation(state.selected,true);}
  Pages.soporte=function(p){
    state.messageTools?.dispose();state.messageTools=null;
    state.filter='open';state.search='';state.forceDetail=true;
    p.innerHTML='<div class="support-admin sp-premium" data-support-premium>'+ui.hero(true)+'<div class="support-console"><details class="support-inbox" open><summary class="sp-inbox-summary"><span>Conversaciones</span><span id="support-inbox-count">…</span>'+ui.icon('arrow')+'</summary><div class="sp-inbox-inner"><div class="support-inbox__tools"><label class="support-search"><svg class="ic"><use href="#i-search"/></svg><input id="support-admin-search" aria-label="Buscar conversaciones" type="search" placeholder="Buscar miembro, tema o mensaje"></label><div class="support-filters"><button class="support-filter is-active" data-support-filter="open">Pendientes</button><button class="support-filter" data-support-filter="all">Todas</button><button class="support-filter" data-support-filter="closed">Resueltas</button></div></div><div class="support-conversation-list" id="support-admin-list"><div class="support-inbox-empty"><div class="spin"></div><p>Cargando conversaciones…</p></div></div></div></details><section class="support-admin-thread" id="support-admin-thread"><div class="support-admin-thread__empty"><div class="support-admin-thread__empty-card"><div class="support-admin-thread__empty-icon"><svg class="ic"><use href="#i-mail"/></svg></div><strong>Tu espacio de atención privada</strong><p>Selecciona una conversación para consultar el historial y responder sin salir del panel.</p><div class="support-empty-flow"><div class="support-empty-step" style="--step-color:#377dff"><span>1</span><strong>Recibe</strong><small>El mensaje llega ligado a la cuenta correcta.</small></div><div class="support-empty-step" style="--step-color:#10a66a"><span>2</span><strong>Responde</strong><small>La respuesta solo la ve ese miembro.</small></div><div class="support-empty-step" style="--step-color:#8b5cf6"><span>3</span><strong>Resuelve</strong><small>Conserva el historial para futuros seguimientos.</small></div></div></div></div></section></div></div>';
    if(p.querySelector('[data-support-premium]').getBoundingClientRect().width<=720)p.querySelector('.support-inbox').open=false;
    document.getElementById('support-admin-search').addEventListener('input',function(event){state.search=event.target.value;renderList();});p.querySelectorAll('[data-support-filter]').forEach(function(button){button.addEventListener('click',function(){state.filter=button.dataset.supportFilter;p.querySelectorAll('[data-support-filter]').forEach(function(item){item.classList.toggle('is-active',item===button);});renderList();});});loadList(false);clearInterval(state.timer);state.timer=setInterval(pollInbox,20000);
  };
  window.addEventListener('icadem:admin-identity',function(){if(state.sessionUid!==currentUid())resetSession();});
  window.addEventListener('adminready',function(){if(state.sessionUid!==currentUid())resetSession();loadList(true);clearInterval(state.timer);state.timer=setInterval(pollInbox,20000);});
  if(window.__currentAdmin){state.sessionUid=currentUid();setTimeout(function(){loadList(true);},500);}
})();
