(function(){
  'use strict';
  let current=null;
  function mount({container,courseId,lessonNumber}){
    current?.dispose();current=null;
    const fields=[...container.querySelectorAll('[data-lesson-notes]')],states=[...container.querySelectorAll('[data-notes-state]')];
    const uid=window.__auth?.currentUser?.uid;
    if(!uid||window.__sessionEnding||!fields.length)return;
    const key='icadem:notes-draft:'+uid+':'+courseId+':'+lessonNumber;
    const legacyKey='icadem:v2:lesson-notes:'+uid+':'+courseId+':'+lessonNumber;
    const endpoint=(window.WEBHOOK_URL||'https://icadem-webhook-production.up.railway.app')+'/api/learning/notes/'+encodeURIComponent(courseId)+'/'+lessonNumber;
    let disposed=false,revision=0,ready=false,dirty=false,saving=false,loading=false,conflict=false,timer=0,attempt=null;
    const alive=()=>!disposed&&!window.__sessionEnding&&container.isConnected&&window.__auth?.currentUser?.uid===uid;
    const read=()=>fields[0].value;
    const write=text=>fields.forEach(field=>{if(field.value!==text)field.value=text;});
    function status(text,action,label){states.forEach(state=>{state.replaceChildren(document.createTextNode(text));if(action){const button=document.createElement('button');button.type='button';button.className='btn btn--ghost';button.style.cssText='margin-left:8px;font-size:11px;padding:5px 9px;min-height:32px';button.textContent=label;button.addEventListener('click',action);state.append(button);}});}
    function backup(){try{localStorage.setItem(key,JSON.stringify({text:read(),baseRevision:revision,attempt}));}catch(_){}}
    function draft(){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
    async function request(options){
      const user=window.__auth?.currentUser;if(user?.uid!==uid)throw new Error('La sesión cambió.');
      const token=await user.getIdToken();if(!alive())throw new Error('La sesión cambió.');
      const response=await fetch(endpoint,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store'});
      const data=await response.json();if(!alive())throw new Error('La sesión cambió.');
      if(!response.ok)throw Object.assign(new Error(data.error||'No pudimos sincronizar las notas.'),data);
      return data;
    }
    async function load(){
      if(!alive()||loading||saving||dirty)return;
      loading=true;
      try{
        const data=await request();if(!alive()||dirty)return;
        revision=data.note.revision;ready=true;write(data.note.text);fields.forEach(f=>f.disabled=false);
        const saved=draft();let legacy='';try{legacy=localStorage.getItem(legacyKey)||'';}catch(_){}
        if(saved&&saved.text!==data.note.text){
          status('Tienes un borrador pendiente en este dispositivo. La versión guardada está visible.',()=>{write(saved.text);dirty=true;conflict=false;attempt=saved.attempt&&saved.baseRevision===revision?saved.attempt:null;backup();status('Borrador recuperado. Guardando en tu cuenta…');save();},'Recuperar borrador');
        }else if(legacy&&revision===0){
          status('Hay notas antiguas de esta cuenta guardadas en este dispositivo.',()=>{write(legacy);dirty=true;backup();save();},'Guardar en mi cuenta');
        }else{if(saved)try{localStorage.removeItem(key);}catch(_){}status('Guardado en tu cuenta · Disponible en tus dispositivos.');}
      }catch(error){if(alive())status(error.message+' Tu borrador se conserva.',load,'Reintentar');}
      finally{loading=false;}
    }
    async function save(){
      if(!alive()||saving||!dirty||conflict)return;
      if(!ready){status('Conecta para cargar la versión de tu cuenta antes de guardar.',load,'Reintentar');return;}
      saving=true;const text=read();
      if(!attempt||attempt.text!==text)attempt={text,baseRevision:revision,requestId:crypto.randomUUID().replace(/-/g,'')};
      const submitted=attempt;backup();status('Guardando en tu cuenta…');
      try{
        const data=await request({method:'PUT',body:JSON.stringify(submitted)});
        if(!alive())return;
        revision=data.note.revision;attempt=null;
        if(read()===text){
          dirty=false;write(data.note.text);try{localStorage.removeItem(key);localStorage.removeItem(legacyKey);}catch(_){}
          status('Guardado en tu cuenta · Disponible en tus dispositivos.');
        }else{backup();}
      }catch(error){
        if(!alive())return;
        if(error.code==='note-conflict'){
          conflict=true;status('La nota cambió en otro dispositivo. Tu borrador está protegido. Copia lo que quieras conservar y consulta la versión guardada.',()=>{dirty=false;conflict=false;attempt=null;load();},'Consultar versión guardada');
        }else status(error.message+' Borrador pendiente de sincronizar.',save,'Reintentar');
      }finally{saving=false;if(alive()&&dirty&&!conflict&&attempt===null)save();}
    }
    const inputHandlers=fields.map(field=>{field.disabled=true;field.maxLength=10000;const input=()=>{if(!alive())return;fields.filter(f=>f!==field).forEach(f=>f.value=field.value);dirty=true;backup();status('Borrador pendiente de sincronizar…');clearTimeout(timer);timer=setTimeout(save,700);};field.addEventListener('input',input);return[field,input];});
    const sync=()=>{if(!document.hidden){if(dirty)save();else load();}};
    window.addEventListener('online',sync);document.addEventListener('visibilitychange',sync);
    const interval=setInterval(sync,60000);
    current={isDirty:()=>dirty,dispose(){disposed=true;clearTimeout(timer);clearInterval(interval);inputHandlers.forEach(([field,listener])=>field.removeEventListener('input',listener));window.removeEventListener('online',sync);document.removeEventListener('visibilitychange',sync);}};
    status('Cargando notas guardadas en tu cuenta…');load();
    return current;
  }
  function resetSession(){current?.dispose();current=null;document.querySelectorAll('[data-lesson-notes]').forEach(f=>{f.value='';f.disabled=true;});}
  document.addEventListener('icadem:session-ending',resetSession);
  document.addEventListener('icadem:session-ended',resetSession);
  document.addEventListener('icadem:user-ready',resetSession);
  window.addEventListener('icadem:navigation',()=>{current?.dispose();current=null;});
  window.ICADEMLessonNotes={mount,isDirty:()=>current?.isDirty()===true};
})();
