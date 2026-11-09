
/* ══════════════════════ BUZÓN PRIVADO ══════════════════════ */
(function(){
  var poll = null, loading = false, firstPaint = true, topicSaving = false, savedTopic = 'membresia', topicRevision = 0;
  function esc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g,function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }); }
  function supportToken(){
    var user = window.__auth && window.__auth.currentUser;
    if (!user) return Promise.reject(new Error(window.__isDemoMode ? 'El buzón privado está disponible al ingresar con una cuenta real.' : 'Tu sesión terminó. Vuelve a ingresar.'));
    return user.getIdToken();
  }
  async function request(path, options){
    var token = await supportToken();
    var config = Object.assign({}, options || {});
    config.headers = Object.assign({ Authorization:'Bearer ' + token }, config.headers || {});
    if (config.body && !config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
    var response = await fetch((window.WEBHOOK_URL || 'https://icadem-webhook-production.up.railway.app') + path, config);
    var data = await response.json().catch(function(){ return {}; });
    if (!response.ok) throw new Error(data.error || 'No pudimos conectar con soporte');
    return data;
  }
  function fmt(value, dayOnly){
    if (!value) return dayOnly ? 'Conversación' : '';
    var date = new Date(value); if (Number.isNaN(date.getTime())) return '';
    if (dayOnly) return date.toDateString() === new Date().toDateString() ? 'Hoy' : new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long'}).format(date);
    return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(date);
  }
  function messagesHtml(messages){
    if (!messages || !messages.length) return '<div class="support-empty"><div class="support-empty__icon"><svg class="ic"><use href="#i-messages"/></svg></div><strong>Inicia una conversación privada</strong><p>Cuéntanos qué ocurrió. Tu mensaje solo será visible para ti y el equipo que administra ICADEM.</p></div>';
    var lastDay='';
    return messages.map(function(message){
      var dayKey=message.createdAt ? new Date(message.createdAt).toDateString() : 'sin-fecha';
      var divider=dayKey!==lastDay?'<div class="support-day">'+esc(fmt(message.createdAt,true))+'</div>':''; lastDay=dayKey;
      var mine=message.sender==='member';
      return divider+'<div class="support-message '+(mine?'is-member':'is-admin')+'"><div class="support-bubble"><div class="support-bubble__sender">'+(mine?'Tú':'Equipo ICADEM')+'</div><div class="support-bubble__text">'+esc(message.text||'')+'</div><div class="support-bubble__time">'+esc(fmt(message.createdAt,false))+'</div></div></div>';
    }).join('');
  }
  async function load(silent){
    if (loading) return; loading=true;
    var box=document.getElementById('support-messages'); if(!box){loading=false;return;}
    var nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<90;
    try{
      var revision=topicRevision,data=await request('/support/me'); if(document.getElementById('support-messages')!==box)return;
      window.ICADEMSupportUI.syncMessages(box,messagesHtml(data.messages||[]),firstPaint);
      var status=document.getElementById('support-status'), closed=data.conversation&&data.conversation.status==='closed';
      if(status){status.className='support-status'+(closed?' is-closed':'');status.textContent=!data.conversation?'Sin consulta':closed?'Resuelto':'En seguimiento';}
      var topic=document.getElementById('support-topic'); if(topic&&data.conversation&&!topicSaving&&revision===topicRevision){savedTopic=data.conversation.topic||'otro';topic.value=savedTopic;}
      var dot=document.getElementById('support-unread-dot'); if(dot)dot.hidden=true;
      if(firstPaint||nearBottom)requestAnimationFrame(function(){box.scrollTop=box.scrollHeight;}); firstPaint=false;
    }catch(error){if(!silent)box.innerHTML='<div class="support-empty"><div class="support-empty__icon"><svg class="ic"><use href="#i-alert-circle"/></svg></div><strong>No pudimos abrir el buzón</strong><p>'+'No pudimos conectar con soporte. Inténtalo de nuevo; tu historial se conserva.'+'</p></div>';}
    finally{loading=false;}
  }
  async function refreshBadge(){
    try{var data=await request('/support/me?peek=1');var dot=document.getElementById('support-unread-dot');if(dot)dot.hidden=!(data.conversation&&data.conversation.unreadUser>0);}catch(_){}
  }
  function beginPoll(){clearInterval(poll);poll=setInterval(function(){if(location.hash.replace(/^#/,'')==='soporte')load(true);else refreshBadge();},20000);}
  Sections.renderers.soporte=function(root){
    firstPaint=true;savedTopic='membresia';topicSaving=false;
    root.innerHTML='<div class="support-page"><section class="support-hero"><div class="support-hero__copy"><div class="support-hero__eyebrow">Atención personal</div><h1>Soporte privado</h1><p>Habla directamente con el equipo ICADEM sobre tu membresía, cobros, acceso o cursos. Esta conversación pertenece únicamente a tu cuenta.</p></div><div class="support-privacy"><svg class="ic"><use href="#i-shield-check"/></svg>Solo tú y administración</div></section><div class="support-layout"><details class="support-info" open><summary>Detalles de tu consulta</summary><div class="support-info__content"><label for="support-topic">¿Sobre qué necesitas ayuda?</label><select class="support-topic" id="support-topic" aria-label="Tema de la conversación"><option value="membresia">Mi membresía</option><option value="cobros">Cobros y pagos</option><option value="cuenta">Acceso a mi cuenta</option><option value="cursos">Cursos y materiales</option><option value="otro">Otro tema</option></select><p class="support-topic-feedback" id="support-topic-feedback" role="status"></p><div class="support-info__note"><strong>Seguimiento en el mismo lugar</strong><p>Conservamos el historial para que no tengas que explicar el problema nuevamente.</p></div><div class="support-info__note"><strong>Conversación privada</strong><p>Ningún otro miembro puede leer tus mensajes ni nuestras respuestas.</p></div></div></details><section class="support-thread" aria-label="Conversación de soporte"><header class="support-thread__head"><div class="support-thread__identity"><div class="support-thread__avatar"><svg class="ic"><use href="#i-messages"/></svg></div><div><strong>Equipo ICADEM</strong><span>Administración de membresías</span></div></div><span class="support-status" id="support-status">En seguimiento</span></header><div class="support-messages" id="support-messages" aria-live="polite"><div class="support-loading"><span class="spin"></span></div></div><form class="support-composer" id="support-form"><div class="support-composer__row"><textarea id="support-message" maxlength="3000" rows="1" placeholder="Escribe tu mensaje…" aria-label="Mensaje para soporte" required></textarea><button class="support-send" id="support-send" type="submit" aria-label="Enviar mensaje"><svg class="ic"><use href="#i-send"/></svg></button></div><div class="support-composer__hint"><span>No compartas contraseñas ni datos completos de tu tarjeta.</span><span id="support-count" data-support-count>0 / 3000</span></div></form></section></div></div>';
    var topic=document.getElementById('support-topic'),topicFeedback=document.getElementById('support-topic-feedback');
    if(window.matchMedia('(max-width: 900px)').matches)root.querySelector('.support-info').open=false;
    topic.addEventListener('change',async function(){
      if(topicSaving)return;topicRevision++;topicSaving=true;topic.disabled=true;topicFeedback.textContent='Guardando tema…';
      try{var result=await request('/support/me',{method:'PATCH',body:JSON.stringify({topic:topic.value})});if(document.getElementById('support-topic')!==topic)return;savedTopic=result.topic;topicFeedback.textContent='Tema guardado. Administración verá esta categoría.';}
      catch(error){topic.value=savedTopic;topicFeedback.textContent='No pudimos guardar el tema. Inténtalo de nuevo.';}
      finally{topicSaving=false;topic.disabled=false;}
    });
    window.ICADEMSupportUI.bindComposer(document.getElementById('support-form'),{
      topic:function(){return savedTopic;},
      send:function(body){return request('/support/me/messages',{method:'POST',body:JSON.stringify(body)});},
      sent:function(){return load(true);}
    });
    load(false);beginPoll();
  };
  document.getElementById('btn-private-support')?.addEventListener('click',function(){navigateToSection('soporte');});
  document.addEventListener('icadem:identity-ready',function(){refreshBadge();beginPoll();});
  setTimeout(function(){refreshBadge();beginPoll();},2200);
})();
