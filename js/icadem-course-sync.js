/* Academic views share the existing authenticated refresh cycle. No browser persistence. */
(function () {
  'use strict';
  let generation=0, flight=null, pendingTimer=null, status={uid:'',phase:'idle'};
  const owner=()=>window.__isDemoMode?'':window.__auth?.currentUser?.uid||'';
  const active=()=>/^#(?:cursos(?:-(?:disponibles|progreso|completados|bloqueados|proximamente|regalo))?|ruta-aprendizaje)$/.test(location.hash);
  const current=t=>Boolean(t.uid&&t.uid===owner()&&t.generation===generation&&!window.__sessionEnding);
  function paint(){
    document.querySelectorAll('[data-course-sync]').forEach(node=>{
      const visible=status.uid===owner()&&(status.phase==='stale'||status.phase==='pending'&&status.visible===true);
      node.hidden=!visible;
      node.dataset.courseSyncPhase=visible?status.phase:'idle';
      const description=visible?(status.phase==='pending'?'Actualizando tus cursos…':'No pudimos actualizar tus cursos. Mostramos la última información consultada; vuelve a intentarlo al recuperar la conexión.'):'';
      node.textContent=visible?(node.closest?.('.courses-controls')?(status.phase==='pending'?'Actualizando…':'Sin actualizar · última información consultada'):description):'';
      node.setAttribute('aria-label',description);node.setAttribute('title',description);
    });
    document.querySelectorAll('#cur-list').forEach(node=>node.setAttribute('aria-busy',String(status.uid===owner()&&status.phase==='pending')));
  }
  async function refresh(){
    if(!active()||!owner()||window.__sessionEnding)return null;
    if(flight&&current(flight))return flight.promise;
    const ticket={uid:owner(),generation};
    status={uid:ticket.uid,phase:'pending'};paint();
    clearTimeout(pendingTimer);
    // Fast revalidation needs no flashing label; slow reads remain explicit.
    pendingTimer=setTimeout(()=>{if(current(ticket)&&status.phase==='pending'){status.visible=true;paint();}},180);
    ticket.promise=Promise.allSettled([
      window.ICADEMCourseUnlocks.refresh(),
      window.__refreshAcademicCourseCatalog()
    ]).then(results=>{
      if(!current(ticket))return null;
      if(results.some(r=>r.status==='rejected'))throw new Error('No pudimos confirmar todos los datos de tus cursos.');
      return true;
    }).finally(()=>{if(flight===ticket)flight=null;});
    flight=ticket;return ticket.promise;
  }
  function settled(identity,progress,academic){
    if(!owner()||window.__sessionEnding||status.uid!==owner())return;
    clearTimeout(pendingTimer);pendingTimer=null;
    const ok=[identity,progress,academic].every(r=>r?.status==='fulfilled'&&r.value!=null);
    status={uid:owner(),phase:ok?'synced':'stale'};paint();
  }
  function requestRefresh(){
    if(!active()||!owner()||window.__sessionEnding)return;
    if(window.navigator?.onLine===false){status={uid:owner(),phase:'stale'};paint();return;}
    Promise.resolve(window.ICADEMPlatform?.refreshCriticalData?.()).catch(()=>{});
  }
  function reset(){generation++;flight=null;clearTimeout(pendingTimer);pendingTimer=null;status={uid:'',phase:'idle'};paint();}
  window.ICADEMCourseSync={active,refresh,settled,paint};
  window.addEventListener('focus',requestRefresh);
  window.addEventListener('icadem:navigation',()=>{paint();Promise.resolve().then(requestRefresh);});
  window.addEventListener('offline',()=>{if(active()&&owner()){status={uid:owner(),phase:'stale'};paint();}});
  document.addEventListener('icadem:session-ending',reset);
  document.addEventListener('icadem:session-ended',reset);
  document.addEventListener('icadem:user-ready',()=>{reset();Promise.resolve().then(requestRefresh);});
})();
