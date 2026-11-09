/* Shared presentation and retry safety; conversations remain server-authorized. */
(function(){
  'use strict';
  var focusedText=null;
  if(window.visualViewport)window.visualViewport.addEventListener('resize',function(){
    if(!focusedText?.isConnected)return;
    var thread=focusedText.closest('.support-thread,.support-admin-thread');
    if(thread){thread.style.minHeight='240px';thread.style.maxHeight=Math.max(240,window.visualViewport.height-24)+'px';}
    focusedText.closest('form')?.scrollIntoView({block:'end'});
  });
  function syncMessages(box,html,force){
    if(!box||box.innerHTML===html)return;
    var follow=force||box.scrollHeight-box.scrollTop-box.clientHeight<90,top=box.scrollTop;
    box.innerHTML=html;
    if(follow)box.scrollTop=box.scrollHeight;else box.scrollTop=top;
  }
  function bindComposer(form,options){
    var text=form.querySelector('textarea'),button=form.querySelector('button[type="submit"]'),busy=false,retry=null;
    var feedback=document.createElement('div');feedback.className='support-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');form.appendChild(feedback);
    var count=form.querySelector('[data-support-count]');
    function update(){if(count)count.textContent=text.value.length+' / 3000';text.style.height='auto';text.style.height=Math.min(text.scrollHeight,126)+'px';button.disabled=busy||!text.value.trim();}
    text.addEventListener('input',update);
    text.addEventListener('focus',function(){focusedText=text;});
    text.addEventListener('blur',function(){if(focusedText===text)focusedText=null;var thread=text.closest('.support-thread,.support-admin-thread');if(thread){thread.style.maxHeight='';thread.style.minHeight='';}});
    text.addEventListener('keydown',function(event){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!busy)form.requestSubmit();}});
    form.addEventListener('submit',async function(event){
      event.preventDefault();var message=text.value.trim();if(busy||!message)return;
      var topic=options.topic?options.topic():undefined,key=JSON.stringify([message,topic]);
      if(!retry||retry.key!==key)retry={key:key,id:crypto.randomUUID().replace(/-/g,'')};
      busy=true;form.setAttribute('aria-busy','true');feedback.className='support-feedback';feedback.textContent='Enviando…';update();
      try{
        await options.send({message:message,topic:topic,clientRequestId:retry.id});
        retry=null;if(text.value.trim()===message)text.value='';feedback.textContent='Mensaje enviado.';
        if(options.sent)await options.sent();
      }catch(error){feedback.className='support-feedback is-error';feedback.textContent='No pudimos enviar el mensaje. Se conservó tu texto; puedes reintentar sin duplicarlo.';}
      finally{busy=false;form.removeAttribute('aria-busy');update();if(form.isConnected)text.focus({preventScroll:true});}
    });
    update();return{isBusy:function(){return busy;}};
  }
  window.ICADEMSupportUI={syncMessages:syncMessages,bindComposer:bindComposer};
})();
