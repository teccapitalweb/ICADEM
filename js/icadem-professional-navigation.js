/* Navigation state only. No profiles, contacts or membership data are cached. */
(function () {
  'use strict';
  var SECTION='directorio-perfil', memory=null, forumMemory=null, activeSection='', restore=false, restoreForum=false, revision=0;
  var KEY='icadem:directory-return:v1:', MAX_AGE=4*60*60*1000;
  var FORUM_KEY='icadem:forum-return:v1:';
  var DIRECTORY_VIEWS=['directorio','directorio-solicitudes','directorio-conexiones','directorio-vip'],directoryMemory={};
  function directoryTab(section){return section==='directorio-solicitudes'?'requests':section==='directorio-conexiones'?'connections':'directory';}
  var EDIT_SECTIONS=['basicos','apariencia','contactos','sobreMi','experiencia','formacion','idiomas','habilidades','certificaciones','proyectos','enlaces','estilo'];
  var historyIndex=Number.isInteger(history.state?.icademProfessionalIndex)?history.state.icademProfessionalIndex:0,committed=null,restoring=null,acceptedHistory=null;
  function viewer(){return window.UserState?.uid||window.__currentUser?.uid||'';}
  function validUid(uid){return typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);}
  function currentProfileId(){try{return new URL(location.href).searchParams.get('profesional')||'';}catch(_){return '';}}
  function currentEditorSection(){try{var value=new URL(location.href).searchParams.get('editar');return EDIT_SECTIONS.includes(value)?value:'';}catch(_){return '';}}
  function routeLocation(){return location.pathname+location.search+location.hash;}
  function allowNavigation(section,options,proceed){
    if(options?.professionalApproved)return true;
    if(acceptedHistory===routeLocation()){acceptedHistory=null;return true;}
    return window.ICADEMResumeEditor?.requestLeave?.(proceed)!==false;
  }
  function handleHistory(){
    var here=routeLocation();
    if(restoring){
      if(here===committed?.url){var resume=restoring;restoring=null;var leave=function(){acceptedHistory=resume.url;history.go(resume.delta);};if(window.ICADEMResumeEditor?.requestLeave?.(leave)!==false)leave();}
      return true;
    }
    if(acceptedHistory===here)return false;
    var editor=window.ICADEMResumeEditor;
    if(!committed||here===committed.url||!editor?.isOpen?.()||(!editor.isDirty?.()&&!editor.isBusy?.()))return false;
    var target={url:here,state:history.state,index:history.state?.icademProfessionalIndex},delta=Number.isInteger(target.index)?target.index-historyIndex:0;
    if(delta){restoring={url:here,delta:delta};history.go(-delta);return true;}
    // Old/unindexed links still keep the current form and URL when cancelled.
    var destination=new URL(here,location.href),section=destination.hash.slice(1),uid=destination.searchParams.get('profesional'),edit=destination.searchParams.get('editar');
    history.replaceState(committed.state,'',committed.url);
    var proceed=function(){window.navigateToSection?.(section,{reemplazar:true,profileUid:uid,editSection:edit,professionalApproved:true});};
    if(editor.requestLeave(proceed)!==false)proceed();
    return true;
  }
  function profileHref(uid){
    if(!validUid(uid))return '';
    var url=new URL('vip-panel.html',location.href);url.search='';url.searchParams.set('profesional',uid);url.hash=SECTION;return url.href;
  }
  function scrollPosition(){
    return {window:window.scrollY||0,document:document.documentElement?.scrollTop||0,body:document.body?.scrollTop||0,
      scrolling:document.scrollingElement?.scrollTop||0,main:document.querySelector('main.main')?.scrollTop||0,dynamic:document.getElementById('dynamic-section')?.scrollTop||0};
  }
  function capture(){
    var uid=viewer(),root=document.querySelector('[data-directory-refined]');if(!uid||!root)return;
    var value={uid,at:Date.now(),search:root.querySelector('#dir-search-input')?.value||'',sector:root.querySelector('#dir-sector-select')?.value||'todos',
      tier:root.querySelector('[data-tier][aria-pressed="true"]')?.dataset.tier||'todos',
      tab:activeSection==='directorio'?root.querySelector('[data-community-tab][aria-pressed="true"]')?.dataset.communityTab||'directory':directoryTab(activeSection),scroll:scrollPosition()};
    directoryMemory[activeSection]=value;if(activeSection==='directorio')memory=value;
    try{sessionStorage.setItem(KEY+uid+(activeSection==='directorio'?'':':'+activeSection),JSON.stringify(value));}catch(_){}
  }
  function saved(section){
    section=section||'directorio';
    var uid=viewer(),value=section==='directorio'?memory:directoryMemory[section];
    if(!uid)return null;
    if(!value||value.uid!==uid){try{value=JSON.parse(sessionStorage.getItem(KEY+uid+(section==='directorio'?'':':'+section))||'null');}catch(_){value=null;}}
    if(!value||value.uid!==uid||Date.now()-value.at>MAX_AGE||Date.now()<value.at)return null;
    return {search:String(value.search||'').slice(0,300),sector:String(value.sector||'todos').slice(0,100),tier:value.tier==='vip'?'vip':'todos',
      tab:['directory','requests','connections'].includes(value.tab)?value.tab:'directory',scroll:value.scroll||{}};
  }
  function captureForum(){
    var uid=viewer(),root=document.querySelector('[data-community-forum]');if(!uid||!root)return;
    forumMemory={uid:uid,at:Date.now(),filter:root.querySelector('[data-foro-tab][aria-pressed="true"]')?.dataset.foroTab||'recientes',scroll:scrollPosition()};
    try{sessionStorage.setItem(FORUM_KEY+uid,JSON.stringify(forumMemory));}catch(_){}
  }
  function savedForum(){
    var uid=viewer(),value=forumMemory;if(!uid)return null;
    if(!value||value.uid!==uid){try{value=JSON.parse(sessionStorage.getItem(FORUM_KEY+uid)||'null');}catch(_){value=null;}}
    if(!value||value.uid!==uid||Date.now()-value.at>MAX_AGE||Date.now()<value.at)return null;
    return {filter:['recientes','populares','mios'].includes(value.filter)?value.filter:'recientes',scroll:value.scroll||{}};
  }
  function prepare(section,options){
    options=options||{};revision++;
    if(DIRECTORY_VIEWS.includes(activeSection)&&(section===SECTION||DIRECTORY_VIEWS.includes(section)&&section!==activeSection))capture();
    if(activeSection==='foro'&&section===SECTION)captureForum();
    var url=new URL(location.href),state=Object.assign({},history.state||{}),previous=activeSection;
    if(section===SECTION){
      var uid=options.profileUid===undefined?currentProfileId():options.profileUid;
      // Invalid identifiers remain an explicit error view; never guess a user.
      if(validUid(uid))url.searchParams.set('profesional',uid);else url.searchParams.delete('profesional');
      var edit=options.editSection===undefined?(options.reemplazar?currentEditorSection():''):options.editSection;
      if(uid===viewer()&&EDIT_SECTIONS.includes(edit))url.searchParams.set('editar',edit);else url.searchParams.delete('editar');
      if(!options.reemplazar){
        var prior=state.icademProfessional;
        state.icademProfessional=DIRECTORY_VIEWS.includes(previous)?Object.assign({viewer:viewer(),depth:1},previous!=='directorio'?{origin:previous}:{}):previous==='foro'?{viewer:viewer(),depth:1,origin:'foro'}:
          previous===SECTION&&prior?.viewer===viewer()?Object.assign({viewer:viewer(),depth:Math.min(20,prior.depth+1)},prior.origin?{origin:prior.origin}:{}):null;
      }
    }else{url.searchParams.delete('profesional');url.searchParams.delete('editar');delete state.icademProfessional;}
    if(DIRECTORY_VIEWS.includes(section)&&section!=='directorio'&&previous==='directorio'&&!options.fromHistory)state.icademDirectoryReturn={viewer:viewer(),index:history.state?.icademProfessionalIndex};
    else if(!DIRECTORY_VIEWS.includes(section)&&section!==SECTION)delete state.icademDirectoryReturn;
    restore=DIRECTORY_VIEWS.includes(section)&&(previous===SECTION||DIRECTORY_VIEWS.includes(previous)&&previous!==section||options.fromHistory)&&Boolean(saved(section));
    restoreForum=section==='foro'&&previous===SECTION&&Boolean(savedForum());
    activeSection=section;url.hash=section;
    historyIndex=options.fromHistory&&Number.isInteger(state.icademProfessionalIndex)?state.icademProfessionalIndex:options.reemplazar||url.pathname+url.search+url.hash===routeLocation()?historyIndex:historyIndex+1;
    state.icademProfessionalIndex=historyIndex;
    committed={url:url.pathname+url.search+url.hash,state:state};
    return {url:committed.url,historyState:state,restoreDirectory:restore||restoreForum};
  }
  function directoryState(){return restore?saved(activeSection):null;}
  function directoryReady(root,readyTab){
    if(!restore||!DIRECTORY_VIEWS.includes(activeSection)||!root?.isConnected)return;
    var state=saved(activeSection);if(!state)return;
    var tab=activeSection==='directorio'?root.querySelector('[data-community-tab][aria-pressed="true"]')?.dataset.communityTab||'directory':directoryTab(activeSection);
    if(tab!==state.tab||(readyTab&&readyTab!==state.tab))return;
    var position=state.scroll,run=revision;
    requestAnimationFrame(function(){
      if(run!==revision||!restore||!root.isConnected)return;
      restore=false;
      var elements={document:document.documentElement,body:document.body,scrolling:document.scrollingElement,main:document.querySelector('main.main'),dynamic:document.getElementById('dynamic-section')};
      Object.entries(elements).forEach(function(entry){if(entry[1])entry[1].scrollTop=Math.max(0,Number(position[entry[0]])||0);});
      window.scrollTo({top:Math.max(0,Number(position.window)||0),left:0,behavior:'instant'});
    });
  }
  function openProfile(uid){if(!validUid(uid))return false;window.navigateToSection?.(SECTION,{profileUid:uid});return true;}
  function openEditor(section){
    if(!validUid(viewer()))return false;
    section=EDIT_SECTIONS.includes(section)?section:'basicos';
    if(currentProfileId()===viewer()&&window.ICADEMResumeEditor?.isOpen?.()){
      if(window.ICADEMResumeEditor.focusSection?.(section)===false)return false;
      var url=new URL(location.href);url.searchParams.set('editar',section);
      history.replaceState(history.state,'',url.pathname+url.search+url.hash);
      if(committed)committed.url=url.pathname+url.search+url.hash;
      window.__perfilProfesionalEdicionActual=section;return true;
    }
    window.navigateToSection?.(SECTION,{profileUid:viewer(),editSection:section});return true;
  }
  function forumState(){return restoreForum?savedForum():null;}
  function forumReady(root){
    if(!restoreForum||activeSection!=='foro'||!root?.isConnected)return;
    var state=savedForum(),run=revision;if(!state)return;
    requestAnimationFrame(function(){
      if(run!==revision||!restoreForum||!root.isConnected)return;restoreForum=false;
      var position=state.scroll,elements={document:document.documentElement,body:document.body,scrolling:document.scrollingElement,main:document.querySelector('main.main'),dynamic:document.getElementById('dynamic-section')};
      Object.entries(elements).forEach(function(entry){if(entry[1])entry[1].scrollTop=Math.max(0,Number(position[entry[0]])||0);});
      window.scrollTo({top:Math.max(0,Number(position.window)||0),left:0,behavior:'instant'});
    });
  }
  function backLabel(){var source=history.state?.icademProfessional;return source?.viewer===viewer()&&source.origin==='foro'?'Volver al Foro VIP':source?.viewer===viewer()&&source.origin==='directorio-vip'?'Volver a Profesionales VIP':source?.viewer===viewer()&&source.origin==='directorio-solicitudes'?'Volver a Solicitudes':source?.viewer===viewer()&&source.origin==='directorio-conexiones'?'Volver a Mis conexiones':'Volver al directorio';}
  function backToDirectory(){
    if(DIRECTORY_VIEWS.includes(activeSection)&&activeSection!=='directorio'){
      var parent=history.state?.icademDirectoryReturn,index=history.state?.icademProfessionalIndex;
      if(parent?.viewer===viewer()&&Number.isInteger(parent.index)&&Number.isInteger(index)&&index>parent.index&&index-parent.index<=20)history.go(parent.index-index);
      else window.navigateToSection?.('directorio',{reemplazar:true});
      return;
    }
    var source=history.state?.icademProfessional;
    if(source?.viewer===viewer()&&Number.isInteger(source.depth)&&source.depth>=1&&source.depth<=20&&history.length>source.depth)history.go(-source.depth);
    else window.navigateToSection?.(source?.viewer===viewer()&&(source.origin==='foro'||DIRECTORY_VIEWS.includes(source.origin))?source.origin:'directorio',{reemplazar:true});
  }
  function reset(){
    revision++;restore=false;restoreForum=false;activeSection='';memory=null;directoryMemory={};forumMemory=null;committed=null;restoring=null;acceptedHistory=null;
    try{if(viewer()){DIRECTORY_VIEWS.forEach(function(s){sessionStorage.removeItem(KEY+viewer()+(s==='directorio'?'':':'+s));});sessionStorage.removeItem(FORUM_KEY+viewer());}}catch(_){}
  }
  document.addEventListener('icadem:session-ending',reset);
  document.addEventListener('icadem:user-ready',function(){if(memory&&memory.uid!==viewer()||forumMemory&&forumMemory.uid!==viewer())reset();});
  window.ICADEMProfessionalNavigation={validUid:validUid,currentProfileId:currentProfileId,currentEditorSection:currentEditorSection,profileHref:profileHref,prepare:prepare,allowNavigation:allowNavigation,handleHistory:handleHistory,openEditor:openEditor,
    directoryState:directoryState,directoryReady:directoryReady,forumState:forumState,forumReady:forumReady,backLabel:backLabel,openProfile:openProfile,backToDirectory:backToDirectory};
})();
