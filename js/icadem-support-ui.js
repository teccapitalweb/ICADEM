/* Shared presentation and retry safety; conversations remain server-authorized. */
(function(){
  'use strict';
  var topics=[['membresia','Mi membresía','crown'],['cobros','Cobros y pagos','card'],['cuenta','Acceso a mi cuenta','key'],['cursos','Cursos y materiales','book'],['otro','Otro tema','help']];
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  function icon(name){var paths={headset:'M4 13v-2a8 8 0 0 1 16 0v2 M4 12H3v6h4v-6H4z M20 12h1v6h-4v-6h3z M18 18v2h-6',shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z m-4 9 3 3 5-6',crown:'m3 6 4 4 5-6 5 6 4-4-2 13H5L3 6z',card:'M3 5h18v14H3z M3 10h18 M6 15h4',key:'M14 10a5 5 0 1 0-4 4l-7 7H1v-3l7-7 M13 6h.01',book:'M12 5v15 M12 5C7 2 2 4 2 4v15s5-2 10 1c5-3 10-1 10-1V4s-5-2-10 1z',help:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',send:'m3 10 18-7-7 18-3-8-8-3z M11 13 21 3',check:'m5 12 4 4 10-10',chat:'M3 4h18v13H9l-6 4V4z M7 9h10 M7 12h6',arrow:'M12 4v16 m-6-6 6 6 6-6'};return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"> <path d="'+(paths[name]||paths.chat)+'"/></svg>';}
  function hero(admin){return '<section class="support-hero sp-hero"><div class="sp-hero__symbol">'+icon('headset')+'</div><div class="sp-hero__copy"><span class="sp-eyebrow">'+(admin?'CENTRO DE ATENCIÓN · ADMINISTRACIÓN':'ICADEM · ATENCIÓN PERSONALIZADA')+'</span><h1>'+(admin?'Buzón privado':'Soporte privado')+'</h1><p>'+(admin?'Responde, acompaña y conserva cada seguimiento en un espacio seguro.':'Estamos aquí para ayudarte con tu membresía, cobros, acceso o cursos.')+'</p></div><div class="sp-hero__privacy">'+icon('shield')+'<span>'+(admin?'Acceso de administración':'Solo tú y administración')+'</span></div></section>';}
  function categoriesMarkup(){return '<fieldset class="sp-topics" data-support-topics disabled><legend>¿Sobre qué necesitas ayuda?</legend><div class="sp-topics__grid">'+topics.map(function(t){return '<label class="sp-topic"><input type="radio" name="support-topic-choice" value="'+t[0]+'" '+(t[0]==='membresia'?'checked':'')+'><span class="sp-topic__surface"><span class="sp-topic__icon">'+icon(t[2])+'</span><span class="sp-topic__check">'+icon('check')+'</span><span class="sp-topic__label">'+t[1]+'</span></span></label>';}).join('')+'</div></fieldset><div class="sp-topic-selection"><span>Tema seleccionado</span><strong data-support-topic-label>Mi membresía</strong></div><p class="support-topic-feedback" data-support-topic-feedback role="status" aria-live="polite"></p>';}
  function bindCategories(root,save){
    var field=root.querySelector('[data-support-topics]'),radios=Array.from(field.querySelectorAll('input')),label=root.querySelector('[data-support-topic-label]'),feedback=root.querySelector('[data-support-topic-feedback]'),value='membresia',saving=false,revision=0;
    function paint(next){radios.forEach(function(r){r.checked=r.value===next;});label.textContent=(topics.find(function(t){return t[0]===next;})||topics[4])[1];}
    radios.forEach(function(radio){radio.addEventListener('change',async function(){
      if(saving||!radio.checked)return;var requested=radio.value;if(requested===value)return;
      saving=true;revision++;field.disabled=true;field.setAttribute('aria-busy','true');feedback.className='support-topic-feedback';feedback.textContent='Guardando tema…';
      try{var result=await save(requested);if(!field.isConnected)return;value=result.topic;paint(value);feedback.textContent='Tema guardado. Administración verá esta categoría.';feedback.className='support-topic-feedback is-saved';}
      catch(error){paint(value);feedback.textContent='No pudimos guardar el tema. Se conserva la categoría anterior; vuelve a intentarlo.';feedback.className='support-topic-feedback is-error';}
      finally{saving=false;field.disabled=false;field.removeAttribute('aria-busy');}
    });});
    return{value:function(){return value;},revision:function(){return revision;},set:function(next,expected){if(saving||(expected!==undefined&&expected!==revision))return;value=topics.some(function(t){return t[0]===next;})?next:'membresia';paint(value);field.disabled=false;}};
  }
  function setCaseStatus(root,conversation){var kind=!conversation?'new':conversation.status==='closed'?'closed':'open',text=kind==='new'?'Sin consulta':kind==='closed'?'Resuelto':'En seguimiento';root.querySelectorAll('[data-support-case-state]').forEach(function(node){node.textContent=text;node.dataset.state=kind;});}
  function composerMarkup(admin){var prefix=admin?'support-admin':'support';return '<form class="'+prefix+'-composer sp-composer" id="'+prefix+'-form"><label class="sp-composer__label" for="'+prefix+'-message">'+(admin?'Tu respuesta':'Tu mensaje')+'</label><div class="sp-composer__row"><textarea id="'+prefix+'-message" maxlength="3000" rows="1" placeholder="'+(admin?'Escribe tu respuesta…':'Escribe tu mensaje…')+'" aria-label="'+(admin?'Respuesta al miembro':'Mensaje para soporte')+'" required></textarea><button class="'+prefix+'-send sp-send" id="'+prefix+'-send" type="submit" aria-label="'+(admin?'Enviar respuesta':'Enviar mensaje')+'">'+icon('send')+'</button></div><div class="sp-composer__footer"><span>'+icon('shield')+(admin?'Solo este miembro y administración pueden ver la respuesta.':'No compartas contraseñas ni datos completos de tu tarjeta.')+'</span><span class="sp-counter" data-support-count>0 / 3000</span></div></form>';}
  var focusedText=null,threadFits=new Map();
  function resizeThreads(){threadFits.forEach(function(fit,thread){if(thread.isConnected)fit();else threadFits.delete(thread);});}
  window.addEventListener?.('resize',resizeThreads,{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',function(){
    resizeThreads();
    if(!focusedText?.isConnected)return;
    var thread=focusedText.closest('.support-thread,.support-admin-thread');
    if(thread){thread.style.minHeight='240px';thread.style.maxHeight=Math.max(240,window.visualViewport.height-24)+'px';}
    focusedText.closest('form')?.scrollIntoView({block:'end'});
  });
  function syncMessages(box,html,force){
    if(!box||box.innerHTML===html)return;
    var follow=force||box.scrollHeight-box.scrollTop-box.clientHeight<90,top=box.scrollTop;
    var template=document.createElement('template'),added=false;template.innerHTML=html;
    if(template.content&&box.children){
      var old=new Map(Array.from(box.children).map(function(node){return[node.getAttribute('data-support-key'),node];})),keep=new Set();
      Array.from(template.content.children).forEach(function(next,index){
        var key=next.getAttribute('data-support-key'),existing=key&&old.get(key),node=existing&&existing.outerHTML===next.outerHTML?existing:next;
        if(!existing&&next.matches('[data-support-message]')){added=true;if(!force&&!window.matchMedia?.('(prefers-reduced-motion:reduce)').matches){node.classList.add('sp-message-new');node.addEventListener('animationend',function(){node.classList.remove('sp-message-new');},{once:true});}}
        keep.add(node);if(box.children[index]!==node)box.insertBefore(node,box.children[index]||null);
      });
      Array.from(box.children).forEach(function(node){if(!keep.has(node))node.remove();});
    }else box.innerHTML=html;
    if(follow)box.scrollTop=box.scrollHeight;else box.scrollTop=top;
    var notice=box.closest?.('.support-thread,.support-admin-thread')?.querySelector('[data-support-new]');if(notice&&(follow||added))notice.hidden=Boolean(follow);
  }
  function bindThread(root){
    var box=root.querySelector('.support-messages,.support-admin-messages'),button=root.querySelector('[data-support-new]');if(!box||!button)return;
    var thread=box.closest('.support-thread,.support-admin-thread');
    function fit(){
      if(!thread.isConnected||thread.contains(focusedText))return;
      var viewport=window.visualViewport?.height||window.innerHeight,bottom=window.matchMedia('(max-width:760px)').matches?82:18,available=Math.floor(viewport-Math.max(0,thread.getBoundingClientRect().top)-bottom);
      thread.style.height=available>=300?Math.min(780,Math.max(320,available))+'px':'';
    }
    resizeThreads();threadFits.set(thread,fit);requestAnimationFrame(fit);
    root.querySelectorAll('.sp-case,.support-inbox').forEach(function(details){details.addEventListener('toggle',fit);});
    button.addEventListener('click',function(){box.scrollTop=box.scrollHeight;button.hidden=true;});
    box.addEventListener('scroll',function(){if(box.scrollHeight-box.scrollTop-box.clientHeight<90)button.hidden=true;},{passive:true});
  }
  function bindComposer(form,options){
    var text=form.querySelector('textarea'),button=form.querySelector('button[type="submit"]'),busy=false,retry=null;
    var feedback=document.createElement('div');feedback.className='support-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');form.appendChild(feedback);
    var count=form.querySelector('[data-support-count]');
    function update(){if(count)count.textContent=text.value.length+' / 3000';text.style.height='auto';text.style.height=Math.min(text.scrollHeight,126)+'px';button.disabled=busy||!text.value.trim();}
    text.addEventListener('input',function(){if(!busy){feedback.textContent='';form.removeAttribute('data-send-state');}update();});
    text.addEventListener('focus',function(){focusedText=text;});
    text.addEventListener('blur',function(){if(focusedText===text)focusedText=null;var thread=text.closest('.support-thread,.support-admin-thread');if(thread){thread.style.maxHeight='';thread.style.minHeight='';}});
    text.addEventListener('keydown',function(event){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!busy)form.requestSubmit();}});
    form.addEventListener('submit',async function(event){
      event.preventDefault();var message=text.value.trim();if(busy||!message)return;
      var topic=options.topic?options.topic():undefined,key=message;
      if(!retry||retry.key!==key)retry={key:key,topic:topic,id:crypto.randomUUID().replace(/-/g,'')};
      busy=true;form.setAttribute('aria-busy','true');form.setAttribute('data-send-state','sending');feedback.className='support-feedback';feedback.textContent='Enviando…';update();
      try{
        await options.send({message:message,topic:retry.topic,clientRequestId:retry.id});
        retry=null;if(text.value.trim()===message)text.value='';feedback.textContent='Mensaje enviado.';form.setAttribute('data-send-state','sent');
        if(options.sent)await options.sent();
      }catch(error){form.setAttribute('data-send-state','error');feedback.className='support-feedback is-error';feedback.textContent='No pudimos enviar el mensaje. Se conservó tu texto; puedes reintentar sin duplicarlo.';}
      finally{busy=false;form.removeAttribute('aria-busy');update();if(form.isConnected)text.focus({preventScroll:true});}
    });
    update();return{isBusy:function(){return busy;}};
  }
  window.ICADEMSupportUI={syncMessages:syncMessages,bindComposer:bindComposer,icon:icon,hero:hero,categoriesMarkup:categoriesMarkup,bindCategories:bindCategories,setCaseStatus:setCaseStatus,composerMarkup:composerMarkup,bindThread:bindThread};
})();
