/* Navigation state only. No profiles, contacts or membership data are cached. */
(function () {
  'use strict';
  var SECTION='directorio-perfil', memory=null, activeSection='', restore=false, revision=0;
  var KEY='icadem:directory-return:v1:', MAX_AGE=4*60*60*1000;
  function viewer(){return window.UserState?.uid||window.__currentUser?.uid||'';}
  function validUid(uid){return typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);}
  function currentProfileId(){try{return new URL(location.href).searchParams.get('profesional')||'';}catch(_){return '';}}
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
    memory={uid,at:Date.now(),search:root.querySelector('#dir-search-input')?.value||'',sector:root.querySelector('#dir-sector-select')?.value||'todos',
      tier:root.querySelector('[data-tier][aria-pressed="true"]')?.dataset.tier||'todos',
      tab:root.querySelector('[data-community-tab][aria-pressed="true"]')?.dataset.communityTab||'directory',scroll:scrollPosition()};
    try{sessionStorage.setItem(KEY+uid,JSON.stringify(memory));}catch(_){}
  }
  function saved(){
    var uid=viewer(),value=memory;
    if(!uid)return null;
    if(!value||value.uid!==uid){try{value=JSON.parse(sessionStorage.getItem(KEY+uid)||'null');}catch(_){value=null;}}
    if(!value||value.uid!==uid||Date.now()-value.at>MAX_AGE||Date.now()<value.at)return null;
    return {search:String(value.search||'').slice(0,300),sector:String(value.sector||'todos').slice(0,100),tier:value.tier==='vip'?'vip':'todos',
      tab:['directory','requests','connections'].includes(value.tab)?value.tab:'directory',scroll:value.scroll||{}};
  }
  function prepare(section,options){
    options=options||{};revision++;
    if(activeSection==='directorio'&&section===SECTION)capture();
    var url=new URL(location.href),state=Object.assign({},history.state||{}),previous=activeSection;
    if(section===SECTION){
      var uid=options.profileUid===undefined?currentProfileId():options.profileUid;
      // Invalid identifiers remain an explicit error view; never guess a user.
      if(validUid(uid))url.searchParams.set('profesional',uid);else url.searchParams.delete('profesional');
      if(!options.reemplazar){
        var prior=state.icademProfessional;
        state.icademProfessional=previous==='directorio'?{viewer:viewer(),depth:1}:
          previous===SECTION&&prior?.viewer===viewer()?{viewer:viewer(),depth:Math.min(20,prior.depth+1)}:null;
      }
    }else{url.searchParams.delete('profesional');delete state.icademProfessional;}
    restore=section==='directorio'&&previous===SECTION&&Boolean(saved());
    activeSection=section;url.hash=section;
    return {url:url.pathname+url.search+url.hash,historyState:state,restoreDirectory:restore};
  }
  function directoryState(){return restore?saved():null;}
  function directoryReady(root){
    if(!restore||activeSection!=='directorio'||!root?.isConnected)return;
    var state=saved();if(!state)return;
    var tab=root.querySelector('[data-community-tab][aria-pressed="true"]')?.dataset.communityTab||'directory';
    if(tab!==state.tab)return;
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
  function backToDirectory(){
    var source=history.state?.icademProfessional;
    if(source?.viewer===viewer()&&Number.isInteger(source.depth)&&source.depth>=1&&source.depth<=20&&history.length>source.depth)history.go(-source.depth);
    else window.navigateToSection?.('directorio',{reemplazar:true});
  }
  function reset(){
    revision++;restore=false;activeSection='';memory=null;
    try{if(viewer())sessionStorage.removeItem(KEY+viewer());}catch(_){}
  }
  document.addEventListener('icadem:session-ending',reset);
  document.addEventListener('icadem:user-ready',function(){if(memory&&memory.uid!==viewer())reset();});
  window.ICADEMProfessionalNavigation={validUid:validUid,currentProfileId:currentProfileId,profileHref:profileHref,prepare:prepare,
    directoryState:directoryState,directoryReady:directoryReady,openProfile:openProfile,backToDirectory:backToDirectory};
})();
