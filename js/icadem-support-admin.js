
/* ══════════════════════ BUZÓN PRIVADO · ADMIN ══════════════ */
(function(){
  var state={conversations:[],selected:null,filter:'open',search:'',timer:null,request:0};
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  async function api(path,options){
    var token=await Pages._getAuthToken(),config=Object.assign({},options||{});
    config.headers=Object.assign({Authorization:'Bearer '+token},config.headers||{});
    if(config.body&&!config.headers['Content-Type'])config.headers['Content-Type']='application/json';
    var response=await fetch(Pages._webhookUrl+path,config),data=await response.json().catch(function(){return{};});
    if(!response.ok)throw new Error(data.error||'No se pudo consultar el buzón'); return data;
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
  function renderMessages(messages){if(!messages||!messages.length)return'<div class="support-admin-thread__empty"><div class="support-admin-thread__empty-icon"><svg class="ic"><use href="#i-mail"/></svg></div><strong>Sin mensajes todavía</strong></div>';var lastDay='';return messages.map(function(message){var admin=message.sender==='admin',day=message.createdAt?new Date(message.createdAt).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}):'',divider=day&&day!==lastDay?'<div class="support-day">'+esc(day)+'</div>':'';lastDay=day;return divider+'<div class="support-admin-message '+(admin?'is-admin':'is-member')+'"><div class="support-admin-bubble"><div class="support-admin-bubble__name">'+(admin?'Administración ICADEM':'Miembro')+'</div><div class="support-admin-bubble__text">'+esc(message.text||'')+'</div><div class="support-admin-bubble__time">'+esc(fmt(message.createdAt))+'</div></div></div>';}).join('');}
  function renderDetail(data){
    var root=document.getElementById('support-admin-thread');if(!root)return;var conversation=data.conversation,closed=conversation.status==='closed';
    root.innerHTML='<header class="support-admin-thread__head"><div class="support-admin-thread__person"><strong>'+esc(conversation.userName||'Miembro ICADEM')+'</strong><a href="mailto:'+encodeURIComponent(conversation.userEmail||'')+'">'+esc(conversation.userEmail||conversation.uid)+'</a></div><div class="support-admin-thread__actions"><span class="support-state-tag '+(closed?'is-closed':'')+'">'+topic(conversation.topic)+' · '+(closed?'Resuelto':'Abierto')+'</span><button class="support-resolution '+(closed?'is-reopen':'')+'" id="support-resolution" data-status="'+(closed?'open':'closed')+'" type="button">'+(closed?'Reabrir':'Marcar resuelto')+'</button></div></header><div class="support-admin-messages" id="support-admin-messages" aria-live="polite">'+renderMessages(data.messages||[])+'</div><form class="support-admin-composer" id="support-admin-form"><div class="support-admin-composer__row"><textarea id="support-admin-message" aria-label="Respuesta al miembro" maxlength="3000" rows="1" placeholder="Responder a '+esc(conversation.userName||'este miembro')+'…" required></textarea><button class="support-admin-send" id="support-admin-send" type="submit" aria-label="Enviar respuesta"><svg class="ic"><use href="#i-send"/></svg></button></div><div class="support-admin-composer__hint">La respuesta solo será visible para este miembro y los administradores.<span data-support-count>0 / 3000</span></div></form>';
    var messages=document.getElementById('support-admin-messages');messages.scrollTop=messages.scrollHeight;
    var uid=conversation.uid;
    window.ICADEMSupportUI.bindComposer(document.getElementById('support-admin-form'),{
      send:function(body){return api('/admin/support/conversations/'+encodeURIComponent(uid)+'/messages',{method:'POST',body:JSON.stringify(body)});},
      sent:async function(){if(state.selected===uid)await selectConversation(uid,true);await loadList(true);}
    });
    document.getElementById('support-resolution').addEventListener('click',function(event){setStatus(event.currentTarget.dataset.status);});

  }
  async function selectConversation(uid,silent){
    state.selected=uid;var ticket=++state.request;renderList();var root=document.getElementById('support-admin-thread');
    if(root&&!silent)root.innerHTML='<div class="support-admin-thread__empty"><div class="spin"></div><p>Cargando conversación…</p></div>';
    try{
      var data=await api('/admin/support/conversations/'+encodeURIComponent(uid));
      if(state.selected!==uid||ticket!==state.request||!root||!root.isConnected)return;
      if(silent&&root.querySelector('#support-admin-form')){
        window.ICADEMSupportUI.syncMessages(root.querySelector('#support-admin-messages'),renderMessages(data.messages||[]));
        var closed=data.conversation.status==='closed',tag=root.querySelector('.support-state-tag'),resolution=root.querySelector('#support-resolution');
        tag.textContent=topic(data.conversation.topic)+' · '+(closed?'Resuelto':'Abierto');tag.classList.toggle('is-closed',closed);
        resolution.textContent=closed?'Reabrir':'Marcar resuelto';resolution.dataset.status=closed?'open':'closed';
      }else renderDetail(data);
      var item=state.conversations.find(function(row){return row.uid===uid;});if(item)item.unreadAdmin=0;renderList();
      var badge=document.getElementById('badge-support');if(badge)badge.hidden=!state.conversations.some(function(row){return row.unreadAdmin>0;});
    }catch(error){if(!silent)Toast.error('No se pudo abrir la conversación','Inténtalo de nuevo. Tu historial se conserva.');}
  }
  async function setStatus(status){if(!state.selected)return;try{await api('/admin/support/conversations/'+encodeURIComponent(state.selected),{method:'PATCH',body:JSON.stringify({status:status})});await loadList(true);await selectConversation(state.selected,true);Toast.success(status==='closed'?'Conversación resuelta':'Conversación reabierta',status==='closed'?'El historial se conserva.':'Ya puedes continuar respondiendo.');}catch(error){Toast.error('No se pudo actualizar','Inténtalo de nuevo. El historial se conserva.');}}
  function pollInbox(){loadList(true);if(typeof __seccionActual!=='undefined'&&__seccionActual==='soporte'&&state.selected)selectConversation(state.selected,true);}
  Pages.soporte=function(p){
    state.filter='open';state.search='';state.forceDetail=true;
    p.innerHTML='<div class="support-admin fade-up"><section class="support-admin__hero"><div><div class="support-admin__eyebrow">Atención a miembros</div><h1>Buzón privado</h1><p>Recibe solicitudes, responde y conserva cada seguimiento en un espacio seguro.</p></div><div class="support-admin__privacy"><svg class="ic"><use href="#i-shield-check"/></svg>Acceso restringido</div></section><div class="support-console"><aside class="support-inbox"><div class="support-inbox__tools"><div class="support-inbox__title">Conversaciones <span class="support-inbox__privacy">Privado</span></div><label class="support-search"><svg class="ic"><use href="#i-search"/></svg><input id="support-admin-search" type="search" placeholder="Buscar miembro, tema o mensaje"></label><div class="support-filters"><button class="support-filter is-active" data-support-filter="open">Pendientes</button><button class="support-filter" data-support-filter="all">Todas</button><button class="support-filter" data-support-filter="closed">Resueltas</button></div></div><div class="support-conversation-list" id="support-admin-list"><div class="support-inbox-empty"><div class="spin"></div><p>Cargando conversaciones…</p></div></div></aside><section class="support-admin-thread" id="support-admin-thread"><div class="support-admin-thread__empty"><div class="support-admin-thread__empty-card"><div class="support-admin-thread__empty-icon"><svg class="ic"><use href="#i-mail"/></svg></div><strong>Tu espacio de atención privada</strong><p>Selecciona una conversación para consultar el historial y responder sin salir del panel.</p><div class="support-empty-flow"><div class="support-empty-step" style="--step-color:#377dff"><span>1</span><strong>Recibe</strong><small>El mensaje llega ligado a la cuenta correcta.</small></div><div class="support-empty-step" style="--step-color:#10a66a"><span>2</span><strong>Responde</strong><small>La respuesta solo la ve ese miembro.</small></div><div class="support-empty-step" style="--step-color:#8b5cf6"><span>3</span><strong>Resuelve</strong><small>Conserva el historial para futuros seguimientos.</small></div></div></div></div></section></div></div>';
    document.getElementById('support-admin-search').addEventListener('input',function(event){state.search=event.target.value;renderList();});p.querySelectorAll('[data-support-filter]').forEach(function(button){button.addEventListener('click',function(){state.filter=button.dataset.supportFilter;p.querySelectorAll('[data-support-filter]').forEach(function(item){item.classList.toggle('is-active',item===button);});renderList();});});loadList(false);clearInterval(state.timer);state.timer=setInterval(pollInbox,20000);
  };
  window.addEventListener('adminready',function(){loadList(true);clearInterval(state.timer);state.timer=setInterval(pollInbox,20000);});
  if(window.__currentAdmin)setTimeout(function(){loadList(true);},500);
})();
