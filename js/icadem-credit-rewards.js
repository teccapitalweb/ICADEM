(function(){
  'use strict';
  const BASE=window.WEBHOOK_URL||'https://icadem-webhook-production.up.railway.app';
  let owner='',generation=0,loading=false,navigating=false,queued=false,contextOffered=false,viewIntent='',preferredCourseId='',opening=null,active=null;
  let pending=new Map(),armed=new Set(),offered=new Set();
  const section=()=>String(location.hash||'').replace(/^#/,'');
  function same(uid,rev){return !window.__sessionEnding&&!!uid&&uid===owner&&rev===generation&&window.__auth?.currentUser?.uid===uid;}
  function storageKey(){return 'icadem:rating-invitation-session:'+owner;}
  function remember(id){contextOffered=true;offered.add(id);if(preferredCourseId===id)preferredCourseId='';try{sessionStorage.setItem(storageKey(),JSON.stringify([...offered]));}catch(_){}}
  function blocked(){
    // Closing backdrops count until their actual removal, including the certificate.
    return Array.from(document.querySelectorAll('.modal-backdrop,#splash-completado,.learning-game,.credit-wallet-modal,.cc-overlay,#splash-bienvenida,#name-modal,#icadem-credit-gift,#free-course-intro,.ica-tour-overlay,dialog[open]')).some(el=>!el.hidden&&getComputedStyle(el).display!=='none');
  }
  async function request(path){
    const user=window.__auth?.currentUser,rev=generation;
    if(!user||window.__sessionEnding||user.uid!==owner)throw new Error('Sesión no disponible.');
    const token=await user.getIdToken();if(!same(user.uid,rev))throw new Error('Sesión cambiada.');
    const response=await fetch(BASE+path,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    const data=await response.json();if(!same(user.uid,rev))throw new Error('Sesión cambiada.');
    if(!response.ok)throw new Error(data.error||'No fue posible consultar las recompensas.');
    return data;
  }
  async function refresh(){
    if(!owner||loading||window.__isDemoMode)return;
    const uid=owner,rev=generation;loading=true;
    try{const data=await request('/api/course-rating-rewards/pending');if(!same(uid,rev))return;pending=new Map((data.items||[]).map(item=>[String(item.courseId),item]));maybeQueue();}
    catch(_){/* An invitation failure never blocks the course or its certificate. */}
    finally{if(same(uid,rev))loading=false;}
  }
  function maybeQueue(){
    if(!owner||queued||contextOffered||opening||active||navigating||viewIntent||document.hidden||blocked())return;
    if(!['cursos','curso-detalle','certificados','clase-detalle'].includes(section()))return;
    // El certificado recién obtenido tiene prioridad sobre cursos antiguos.
    // Si su escritura aún no es visible, esperamos la siguiente lectura real.
    const item=preferredCourseId?pending.get(preferredCourseId):[...pending.values()].find(x=>!offered.has(x.courseId)&&!armed.has(x.courseId));
    if(item&&(offered.has(item.courseId)||armed.has(item.courseId)))return;
    if(!item||!window.ICADEMExperience)return;
    queued=true;window.ICADEMExperience.enqueue('course-rating',{...item,owner,generation},{unique:false});
  }
  async function runInvitation(item){
    if(!same(item.owner,item.generation))return;
    queued=false;
    if(preferredCourseId&&preferredCourseId!==item.courseId){maybeQueue();return;}
    if(contextOffered||opening||active||document.hidden||offered.has(item.courseId)||navigating||viewIntent||armed.has(item.courseId)||blocked())return;
    const entry={owner:item.owner,generation:item.generation};opening=entry;
    let data;try{data=await request('/api/course-ratings/'+encodeURIComponent(item.courseId));}catch(_){return;}finally{if(opening===entry)opening=null;}
    if(!same(item.owner,item.generation)||contextOffered||document.hidden||navigating||viewIntent||blocked()||offered.has(item.courseId))return;
    if(preferredCourseId&&preferredCourseId!==item.courseId){maybeQueue();return;}
    if(!data.reward?.eligible){pending.delete(item.courseId);if(preferredCourseId===item.courseId)preferredCourseId='';maybeQueue();return;}
    const body=document.createElement('div');body.className='rating-reward-dialog';
    const lead=document.createElement('p');lead.className='rating-reward-dialog__lead';lead.textContent=item.courseTitle||'Curso completado';
    const gift=document.createElement('div');gift.className='rating-reward-dialog__gift';gift.innerHTML='<svg aria-hidden="true"><use href="#i-gift"/></svg><strong>+25 créditos ICADEM</strong><small>Por tu opinión sincera, sin importar la puntuación.</small>';
    const copy=document.createElement('p');copy.className='rating-reward-dialog__copy';copy.textContent='Utiliza tus créditos para desbloquear materiales y recursos profesionales. El comentario es opcional.';
    const widget=document.createElement('div');widget.className='rating-reward-dialog__widget';
    body.append(lead,gift,copy,widget);
    const footer=document.createElement('div');footer.className='rating-reward-dialog__footer';
    const later=document.createElement('button');later.className='btn btn--ghost';later.type='button';later.textContent='Ahora no · Puedes calificar después';footer.append(later);
    remember(item.courseId);
    await new Promise(resolve=>{
      active=Modal.open({id:'course-rating-reward',title:'¡Tu opinión vale créditos!',size:'sm',body,footer,beforeClose:()=>!same(item.owner,item.generation)||widget.dataset.ratingBusy!=='true',onClose:()=>{active=null;resolve();}});
      later.addEventListener('click',()=>active?.close());
      window.ICADEMCourseRatings.mount({container:widget,courseId:item.courseId,courseTitle:item.courseTitle,variant:'compact',rewardMode:true,onSaved:()=>{pending.delete(item.courseId);later.textContent='Listo';}});
    });
    maybeQueue();
  }
  function certificateOpened(course,node){
    const id=String(course.courseId),uid=owner,rev=generation;armed.add(id);preferredCourseId=id;contextOffered=false;
    const observer=new MutationObserver(()=>{
      if(node.isConnected)return;observer.disconnect();
      if(!same(uid,rev))return;armed.delete(id);refresh();maybeQueue();
    });observer.observe(document.body,{childList:true,subtree:true});
  }
  function reset(){
    generation++;owner='';loading=false;queued=false;contextOffered=false;opening=null;navigating=false;viewIntent='';preferredCourseId='';pending.clear();armed.clear();offered.clear();
    // Session disposal must never leave the previous user's financial UI open.
    const old=document.querySelector('[data-modal-id="course-rating-reward"]');if(old)old.querySelector('.modal__body')?.replaceChildren();active?.close();active=null;
  }
  function start(force){
    const uid=window.__auth?.currentUser?.uid||'';if(!force&&uid===owner)return;
    reset();owner=uid;if(!owner)return;
    try{offered=new Set(JSON.parse(sessionStorage.getItem(storageKey())||'[]'));}catch(_){}
    refresh();
  }
  window.ICADEMCreditRewards={runInvitation,refresh,certificateOpened,
    arm(courseId){armed.add(String(courseId));preferredCourseId=String(courseId);contextOffered=false;},
    certificateViewIntent(courseId){viewIntent=String(courseId);preferredCourseId=String(courseId);contextOffered=false;return{owner,generation,courseId:String(courseId)};},
    isCurrent(ticket){return !!ticket&&same(ticket.owner,ticket.generation);},
    certificateViewSettled(courseId,ticket){if(ticket&&!same(ticket.owner,ticket.generation))return;if(viewIntent===String(courseId))viewIntent='';refresh();maybeQueue();}
  };
  document.addEventListener('icadem:user-ready',()=>start(true));
  document.addEventListener('icadem:identity-ready',()=>{start();refresh();});
  document.addEventListener('icadem:progress-ready',refresh);
  document.addEventListener('icadem:session-ending',reset);
  document.addEventListener('icadem:session-ended',reset);
  document.addEventListener('icadem:course-rating-saved',event=>{if(event.detail?.subject==='course'){const id=String(event.detail.courseId);pending.delete(id);if(preferredCourseId===id)preferredCourseId='';}});
  window.addEventListener('icadem:navigation',()=>{navigating=true;contextOffered=false;});
  window.addEventListener('icadem:section-ready',()=>{navigating=false;refresh();maybeQueue();});
  window.addEventListener('online',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  new MutationObserver(maybeQueue).observe(document.body,{childList:true,subtree:true});
  start();
})();
