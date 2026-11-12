/* Community presentation. Connections and contact permissions are resolved by the API. */
(function () {
  "use strict";
  var context = null,
    records = { received: [], sent: [], connected: [] },
    generation = 0,
    refreshTimer = null;
  var connectionRead=0, profileRead=0, pendingRequestUid='',pendingActions=new Set();
  var routes={directory:'directorio',requests:'directorio-solicitudes',connections:'directorio-conexiones'};
  var names = {
    whatsapp: "WhatsApp",
    email: "Correo profesional",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    facebook: "Facebook",
    web: "Sitio web",
  };
  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function icon(name) {
    return (
      '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>'
    );
  }
  function safeUrl(raw) {
    try {
      var u = new URL(raw, location.origin);
      return ["https:", "http:"].includes(u.protocol) ? u.href : "";
    } catch (_) {
      return "";
    }
  }
  function api(path, options) {
    if (!window.ICADEMPlatform?.request)
      return Promise.reject(
        Error("El servicio no está disponible. Intenta nuevamente."),
      );
    return window.ICADEMPlatform.request("/api/community" + path, options);
  }
  function notify(title, message, error) {
    context?.toast?.[error ? "error" : "success"](title, message || "");
  }
  function actionMarkup(uid, state, compact) {
    if (state === "self") return "";
    var label =
      {
        none: "Conectar",
        sent: "Solicitud enviada",
        received: compact ? "Responder" : "Solicitud recibida",
        connected: "Conectados",
        unknown: "Ver perfil",
      }[state] || "Conectar";
    return (
      '<button type="button" class="community-connect" data-connect="' +
      esc(uid) +
      '" data-state="' +
      esc(state || "none") +
      '">' +
      icon(state === "connected" ? "check" : "users") +
      "<span>" +
      label +
      "</span></button>"
    );
  }
  async function act(button, target, action) {
    if (context?.viewer !== window.UserState?.uid) {
      notify(
        "La sesión cambió",
        "Vuelve a abrir el directorio para continuar.",
        true,
      );
      return;
    }
    var ticket = generation;
    var actionKey=ticket+':'+target;
    if (button.disabled || pendingActions.has(actionKey)) return;
    pendingActions.add(actionKey);
    button.disabled = true;
    var original = button.innerHTML;
    button.textContent =
      action === "accept"
        ? "Aceptando…"
        : action === "reject"
          ? "Rechazando…"
          : action === "remove"
            ? "Actualizando…"
            : "Enviando…";
    try {
      await api(
        "/connections" +
          (action === "request"
            ? ""
            : "/" + encodeURIComponent(target) + "/" + action),
        {
          method: "POST",
          body: action === "request" ? { targetUid: target } : {},
        },
      );
      if (ticket !== generation || context?.viewer !== window.UserState?.uid)
        return;
      notify(
        action === "request"
          ? "Solicitud enviada"
          : action === "accept"
            ? "Ahora están conectados"
            : action === "reject"
              ? "Solicitud rechazada"
              : action === "cancel"
                ? "Solicitud cancelada"
                : "Conexión finalizada",
      );
      await Promise.allSettled([loadConnections(), context?.refresh?.()]);
      document
        .querySelectorAll(".community-profile[data-profile-uid]")
        .forEach(function (node) {
          if (node.dataset.profileUid === target) loadProfile(node, target);
        });
    } catch (error) {
      notify("No se pudo completar", error.message, true);
      button.innerHTML = original;
      button.disabled = false;
    } finally {
      pendingActions.delete(actionKey);
    }
  }
  function wire(root) {
    root.querySelectorAll("[data-connect]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        var uid = button.dataset.connect;
        if (button.dataset.state === "none") act(button, uid, "request");
        else openProfile(uid);
      });
    });
    root.querySelectorAll("[data-network-action]").forEach(function (button) {
      button.addEventListener("click", async function (event) {
        event.stopPropagation();
        if(button.dataset.networkAction==='remove'&&context?.kind==='profile'){
          var ticket=generation,viewer=context?.viewer;
          if(!context?.confirmDisconnect || !await context.confirmDisconnect())return;
          if(ticket!==generation||viewer!==window.UserState?.uid||!button.isConnected)return;
        }
        act(button, button.dataset.uid, button.dataset.networkAction);
      });
    });
    root.querySelectorAll("[data-network-profile]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        openProfile(button.dataset.networkProfile);
      });
    });
  }
  function paintCards(root) {
    if (!context) return;
    root.querySelectorAll("[data-dircard]").forEach(function (card) {
      var uid = card.dataset.dircard;
      if (uid === window.UserState?.uid) return;
      var item = context.cards?.().find(function (x) {
          return (x.uid || x.id) === uid;
        }),
        footer = card.querySelector(".network-card-footer");
      if (!footer || footer.querySelector("[data-connect]")) return;
      var locked = footer.querySelector("[data-contact-lock]");
      if (locked) {
        locked.removeAttribute("data-contact-lock");
        locked.dataset.networkProfile = uid;
        locked.textContent =
          item?.connection === "connected"
            ? "Ver contactos compartidos"
            : "Contacto en el perfil";
      }
      footer.classList.add("has-connection");
      footer
        .querySelector(".network-view-profile")
        .insertAdjacentHTML(
          "afterend",
          actionMarkup(uid, item?.connection || "none", true),
        );
    });
    wire(root);
  }
  function rows(items, empty) {
    if (!items.length)
      return '<p class="community-empty">' + esc(empty) + "</p>";
    return items
      .map(function (item) {
        return (
          '<article class="community-request"><div class="community-request__identity">' +
          (safeUrl(item.foto)
            ? '<img src="' +
              esc(safeUrl(item.foto)) +
              '" alt="" loading="lazy">'
            : '<span class="community-mini-avatar">' +
              esc(item.nombre.slice(0, 2).toUpperCase()) +
              "</span>") +
          '<div><button class="community-name" type="button" data-network-profile="' +
          esc(item.uid) +
          '">' +
          esc(item.nombre) +
          "</button><p>" +
          esc(item.puesto || "Comunidad ICADEM") +
          '</p></div></div><div class="community-request__actions">' +
          (item.connection === "received"
            ? '<button class="community-primary" data-network-action="accept" data-uid="' +
              esc(item.uid) +
              '">Aceptar</button><button class="community-secondary" data-network-action="reject" data-uid="' +
              esc(item.uid) +
              '">Rechazar</button>'
            : item.connection === "sent"
              ? '<span class="community-state">Solicitud enviada</span><button class="community-secondary" data-network-action="cancel" data-uid="' +
                esc(item.uid) +
                '">Cancelar</button>'
              : '<span class="community-state is-connected">' +
                icon("check") +
                'Conectados</span><button class="community-secondary" data-network-profile="' +
                esc(item.uid) +
                '">Ver perfil</button><button class="community-secondary" data-network-action="remove" data-uid="' +
                esc(item.uid) +
                '">Desconectar</button>') +
          "</div></article>"
        );
      })
      .join("");
  }
  function paintActivity() {
    if (!context) return;
    var target = context.root.querySelector("#community-activity");
    if (!target || target.hidden) return;
    var tab = context.tab;
    target.innerHTML =
      tab === "requests"
        ? '<section class="community-activity-section"><h2>Solicitudes recibidas <span>' +
          records.received.length +
          "</span></h2>" +
          rows(records.received, "No tienes solicitudes por responder.") +
          '</section><section class="community-activity-section"><h2>Solicitudes enviadas <span>' +
          records.sent.length +
          "</span></h2>" +
          rows(
            records.sent,
            "Tus próximas conexiones empiezan en el directorio.",
          ) +
          "</section>"
        : '<section class="community-activity-section"><h2>Mis conexiones <span>' +
          records.connected.length +
          '</span></h2><p class="community-caption">Encuentra los medios externos que cada profesional decidió compartir contigo.</p>' +
          rows(
            records.connected,
            "Todavía no tienes conexiones aceptadas. Explora la comunidad para empezar.",
          ) +
          "</section>";
    wire(target);
  }
  async function loadConnections() {
    if(context?.kind === "profile")return;
    var current = generation,read=++connectionRead;
    if (!context?.root.isConnected || context.viewer !== window.UserState?.uid)
      return;
    try {
      var response = await api("/connections");
      if (current !== generation || read!==connectionRead || context?.viewer !== window.UserState?.uid)
        return;
      records = {
        received: response.received || [],
        sent: response.sent || [],
        connected: response.connected || [],
      };
      var counter=context.root.querySelector("[data-request-count]");
      if(counter)counter.textContent = records
        .received.length
        ? String(records.received.length)
        : "";
      var viewCount=context.root.querySelector('[data-network-view-count]');
      if(viewCount&&context.tab!=="directory"){
        var total=context.tab==='requests'?records.received.length+records.sent.length:records.connected.length;
        viewCount.textContent=total+(context.tab==='requests'?(total===1?' solicitud':' solicitudes'):(total===1?' conexión':' conexiones'));
      }
      var states = new Map(
        []
          .concat(records.received, records.sent, records.connected)
          .map(function (x) {
            return [x.uid, x.connection];
          }),
      );
      context.root
        .querySelectorAll("[data-connect]")
        .forEach(function (button) {
          if (button.disabled) return;
          var next = states.get(button.dataset.connect) || "none";
          var shared = button
            .closest("[data-dircard]")
            ?.querySelector(".dir-card__contact-lock[data-network-profile]");
          if (shared)
            shared.textContent =
              next === "connected"
                ? "Ver contactos compartidos"
                : "Contacto en el perfil";
          if (next !== button.dataset.state) {
            button.dataset.state = next;
            button.innerHTML =
              icon(next === "connected" ? "check" : "users") +
              "<span>" +
              {
                none: "Conectar",
                sent: "Solicitud enviada",
                received: "Responder",
                connected: "Conectados",
              }[next] +
              "</span>";
          }
          button.disabled = false;
        });
      paintActivity();
      if(context.tab!=="directory")window.ICADEMProfessionalNavigation?.directoryReady(context.root,context.tab);
      if (context.notificationUid) {
        var match=Array.from(context.root.querySelectorAll("[data-network-profile]")).find(function(node){return node.dataset.networkProfile===context.notificationUid;});
        if(match){match.scrollIntoView({block:"center",behavior:"auto"});match.focus({preventScroll:true});}
        else notify("Solicitud actualizada", "Esta solicitud ya no está pendiente. Puedes consultar el perfil desde el directorio.");
        context.notificationUid=null;
      }
    } catch (error) {
      if (current !== generation || read!==connectionRead) return;
      var count=context.root.querySelector('[data-network-view-count]');if(count)count.textContent='Sin actualizar';
      var badge=context.root.querySelector('[data-request-count]');if(badge)badge.textContent='';
      var target = context.root.querySelector("#community-activity");
      if (target && !target.hidden) {
        target.innerHTML =
          '<div class="community-empty" role="alert">' +
          esc(error.message) +
          '<button type="button" class="community-secondary" data-network-retry>Reintentar</button></div>';
        target
          .querySelector("[data-network-retry]")
          .addEventListener("click", loadConnections);
      }
    }
  }
  function attach(root, options) {
    cleanup();
    context = {
      root,
      ...options,
      viewer: window.UserState?.uid,
      tab: options.view==='requests'?'requests':options.view==='connections'?'connections':'directory',
      notificationUid:pendingRequestUid||null,
    };
    generation++;
    records = { received: [], sent: [], connected: [] };
    pendingRequestUid='';
    var nav = document.createElement("nav");
    nav.className = "community-nav";
    nav.setAttribute("aria-label", "Tu red profesional");
    nav.innerHTML =
      '<button type="button" data-community-tab="directory" aria-pressed="true">' +
      icon("users") +
      'Directorio</button><button type="button" data-community-tab="requests" aria-pressed="false">Solicitudes <span data-request-count></span></button><button type="button" data-community-tab="connections" aria-pressed="false">Mis conexiones</button>';
    if(!options.view||options.view==='directory')root.querySelector(".network-filters").before(nav);
    var activity = document.createElement("div");
    activity.id = "community-activity";
    activity.hidden = context.tab==='directory';
    activity.setAttribute("aria-live", "polite");
    root.append(activity);
    nav.querySelectorAll("button").forEach(function (button) {
      button.addEventListener("click", function () {
        window.navigateToSection?.(routes[button.dataset.communityTab]||'directorio');
      });
    });
    openNotificationTarget();
    if(context?.root!==root)return;
    if(context.tab!=='directory')activity.innerHTML='<p class="community-empty" role="status">Cargando tu red…</p>';
    loadConnections();
    refreshTimer = setInterval(function () {
      if (document.visibilityState === "visible") refreshDirectory();
    }, 45000);
  }
  function openNotificationTarget() {
    if(!context?.root.isConnected || !['#directorio','#directorio-solicitudes'].includes(location.hash))return;
    var target=window.ICADEMNotifications?.consume("directorio");
    if(!target)return;
    if(target.view==="profile")openProfile(target.profileUid);
    else {pendingRequestUid=target.profileUid;if(location.hash!=='#directorio-solicitudes')window.navigateToSection?.('directorio-solicitudes');}
  }
  function cleanup() {
    if(context?.kind==="profile")document.title="ICADEM · Panel VIP";
    context?.modal.close("community-cv-editor");
    generation++;
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
    context = null;
  }
  function refreshDirectory(){
    if(context?.kind==='profile')return refreshVisibleProfile();
    if(!context?.root.isConnected||context.viewer!==window.UserState?.uid||window.__sessionEnding)return;
    return Promise.allSettled([loadConnections(),context.tab==='directory'?context.refresh?.():null]);
  }
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')refreshDirectory();});
  window.addEventListener?.('focus',refreshDirectory);
  window.addEventListener?.('online',refreshDirectory);
  function contactMarkup(contacts) {
    return Object.entries(contacts || {})
      .map(function (entry) {
        var key = entry[0],
          value = entry[1],
          url =
            key === "email"
              ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                ? "mailto:" + value
                : ""
              : key === "whatsapp"
                ? "https://wa.me/" + String(value).replace(/\D/g, "")
                : safeUrl(value);
        return url
          ? '<a class="community-contact" href="' +
              esc(url) +
              '" ' +
              (key === "email"
                ? ""
                : 'target="_blank" rel="noopener noreferrer"') +
              ">" +
              icon(
                key === "email"
                  ? "mail"
                  : key === "web" || key === "facebook"
                    ? "link"
                    : key,
              ) +
              "<span><strong>" +
              names[key] +
              "</strong><span>" +
              esc(value) +
              "</span></span>" +
              icon("arrow-right") +
              "</a>"
          : "";
      })
      .join("");
  }
  function section(title, content) {
    return (
      '<section class="community-cv-section"><h3>' +
      title +
      "</h3>" +
      content +
      "</section>"
    );
  }
  function profileMarkup(p) {
    return window.ICADEMProfessionalProfile?.markup(p,{esc:esc,icon:icon,safeUrl:safeUrl,contactMarkup:contactMarkup,actionMarkup:actionMarkup})||'<div class="community-empty" role="alert">No se pudo cargar la presentación del perfil. Actualiza la página para reintentar.</div>';
  }
  function paintProfile(node,profile){
    node.innerHTML=profileMarkup(profile);wire(node);
    window.ICADEMProfessionalNetwork?.mountSummary(node.querySelector('[data-profile-network-slot]'),profile);
    node.querySelector('[data-profile-activity]')?.addEventListener('click',function(){window.ICADEMProfessionalNavigation?.openActivity(profile.uid);});
    node.querySelector('[data-edit-cv]')?.addEventListener('click',function(){window.ICADEMProfessionalNavigation?.openEditor('basicos');});
    node.querySelector('[data-edit-card]')?.addEventListener('click',openCardEditor);
  }
  async function loadProfile(node, uid, background) {
    var viewer = window.UserState?.uid,
      ticket = generation,read=++profileRead;
    if(!background)node.setAttribute("aria-busy", "true");
    try {
      var data = await api("/profiles/" + encodeURIComponent(uid));
      if (
        !node.isConnected ||
        viewer !== window.UserState?.uid ||
        ticket !== generation || read!==profileRead || (background&&pendingActions.size) ||
        window.ICADEMResumeEditor?.isOpen?.(node)
      )
        return;
      var snapshot=JSON.stringify(data.profile);
      if(background&&node.__profileSnapshot===snapshot)return;
      var firstLoad=!node.dataset.profileUid;
      var focused=document.activeElement?.closest?.('[data-connect],[data-network-action],[data-profile-activity]');
      var focusData=focused&&node.contains?.(focused)?{...focused.dataset}:null;
      node.dataset.profileUid = uid;
      node.__profileSnapshot=snapshot;
      paintProfile(node,data.profile);
      if(focusData){var candidates=Array.from(node.querySelectorAll('[data-connect],[data-network-action],[data-profile-activity]')),next=candidates.find(function(button){return focusData.connect?button.dataset.connect===focusData.connect:focusData.networkAction?button.dataset.networkAction===focusData.networkAction:button.hasAttribute('data-profile-activity');});(next||node.querySelector('[data-profile-activity]'))?.focus({preventScroll:true});}
      var page=node.closest("[data-professional-view]");
      if(page){
        page.querySelector("[data-professional-copy]").disabled=false;
        document.title=data.profile.nombre+" · Perfil profesional | ICADEM";
        if(firstLoad)node.querySelector("h1")?.focus({preventScroll:true});
      }
      var editSection=window.ICADEMProfessionalNavigation?.currentEditorSection?.();
      if(editSection&&data.profile.own&&uid===viewer)editCv(data.profile,editSection);
    } catch (error) {
      if (!node.isConnected || viewer!==window.UserState?.uid || ticket!==generation || read!==profileRead || background&&pendingActions.size || window.ICADEMResumeEditor?.isOpen?.(node)) return;
      if(background&&node.__profileSnapshot&&![400,401,403,404,410].includes(error.status))return;
      delete node.__profileSnapshot;
      if(error.status===404 && uid===viewer){
        node.dataset.profileUid=uid;
        node.innerHTML='<div class="community-empty" role="status"><h1>Completa tu perfil profesional</h1><p>Agrega tus datos para crear tu currículum virtual en ICADEM.</p><button type="button" class="community-primary" data-create-own-profile>Completar mi perfil</button></div>';
        node.querySelector('[data-create-own-profile]').addEventListener('click',async function(event){
          var button=event.currentTarget;button.disabled=true;
          try{await window.ICADEMPlatform.syncIdentity(true,{progress:false});if(node.isConnected&&viewer===window.UserState?.uid&&ticket===generation)window.ICADEMProfessionalNavigation?.openEditor('basicos');}
          catch(error){if(node.isConnected){button.disabled=false;notify('No pudimos preparar tu perfil',error.message,true);}}
        });
        return;
      }
      node.innerHTML =
        '<div class="community-empty" role="alert"><h1>'+([400,404].includes(error.status)?'Perfil no disponible':'No pudimos cargar el perfil')+'</h1><p>' +
        esc(error.message) +
        '</p><button class="community-secondary" data-retry-profile>Reintentar</button></div>';
      node.querySelector("button").addEventListener("click", function () {
        loadProfile(node, uid);
      });
    } finally {
      if(read===profileRead)node.removeAttribute("aria-busy");
    }
  }
  function openCardEditor() {
    window.ICADEMProfessionalNavigation?.openEditor('apariencia');
  }
  function openProfile(uid) {
    if(!window.ICADEMProfessionalNavigation?.openProfile(uid))notify('Perfil no disponible','No pudimos abrir el perfil solicitado.',true);
  }
  function refreshCurrentProfile(){
    if(context?.kind!=='profile'||context.viewer!==window.UserState?.uid||!context.root.isConnected)return;
    var node=context.root.querySelector('.community-profile');
    if(window.ICADEMResumeEditor?.isOpen?.(node))return;
    if(node?.dataset.profileUid===window.UserState?.uid)return loadProfile(node,node.dataset.profileUid);
  }
  function refreshVisibleProfile(){
    if(document.visibilityState==='hidden'||context?.kind!=='profile'||context.viewer!==window.UserState?.uid||!context.root.isConnected||window.__sessionEnding||pendingActions.size)return;
    var node=context.root.querySelector('.community-profile');
    if(!node?.dataset.profileUid||window.ICADEMResumeEditor?.isOpen?.(node))return;
    return loadProfile(node,node.dataset.profileUid,true);
  }
  function syncOwnProfilePhoto(event){
    var photo=event.detail?.profile,viewer=window.UserState?.uid;
    if(window.__sessionEnding||!viewer||photo?.uid!==viewer||typeof photo.photoURL!=='string')return;
    window.ICADEMResumeEditor?.syncPhoto?.(photo);
    if(context?.kind!=='profile'||context.viewer!==viewer||!context.root.isConnected)return;
    var node=context.root.querySelector('.community-profile');
    if(node?.dataset.profileUid!==viewer)return;
    var url=safeUrl(photo.photoURL);
    if(url)url=window.__avatarSrc?.(url,photo.photoVersion)||url;
    // Update just the identity image: a provider refresh must never rebuild a
    // profile, replace a CV draft, or touch an unrelated professional's avatar.
    node.querySelectorAll('.pp-avatar').forEach(function(avatar){
      avatar.innerHTML=url?'<img src="'+esc(url)+'" alt="Foto de perfil" decoding="async">':'<span aria-hidden="true">'+esc(window.UserState?.iniciales||'MI')+'</span>';
    });
  }
  document.addEventListener('icadem:identity-ready',syncOwnProfilePhoto);
  async function copyProfileLink(button,node){
    var url=window.ICADEMProfessionalNavigation?.profileHref(node.dataset.profileUid);
    if(!url)return;
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
      else{var field=document.createElement('textarea');field.value=url;field.setAttribute('readonly','');field.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(field);field.select();var copied=document.execCommand('copy');field.remove();if(!copied)throw Error();}
      notify('Enlace copiado','Cada visitante verá únicamente la información que su sesión tenga autorizada.');
    }catch(_){notify('No se pudo copiar','Puedes copiar la dirección del perfil desde la barra del navegador.',true);}
  }
  function renderProfilePage(container,options){
    cleanup();
    context={root:container,...options,kind:'profile',viewer:window.UserState?.uid};generation++;
    container.innerHTML='<div class="professional-profile-shell" data-professional-view><nav class="professional-profile-toolbar" aria-label="Navegación del perfil"><button type="button" class="professional-profile-back" data-professional-back>'+icon('arrow-left')+'<span>'+esc(window.ICADEMProfessionalNavigation?.backLabel?.()||'Volver al directorio')+'</span></button><button type="button" class="professional-profile-share" data-professional-copy disabled>'+icon('copy')+'<span>Copiar enlace</span></button></nav><div class="community-profile"><div class="professional-profile-loading" role="status">Cargando perfil profesional…</div></div></div>';
    var node=container.querySelector('.community-profile');
    container.querySelector('[data-professional-back]').addEventListener('click',function(){window.ICADEMProfessionalNavigation.backToDirectory();});
    container.querySelector('[data-professional-copy]').addEventListener('click',function(event){copyProfileLink(event.currentTarget,node);});
    var uid=window.ICADEMProfessionalNavigation?.currentProfileId();
    if(!window.ICADEMProfessionalNavigation?.validUid(uid)){node.innerHTML='<div class="community-empty" role="alert"><h1>Perfil no disponible</h1><p>Este enlace no identifica un perfil válido. Puedes volver al directorio para encontrarlo.</p></div>';return;}
    loadProfile(node,uid);
    refreshTimer=setInterval(refreshVisibleProfile,45000);
  }
  var fieldSequence = 0;
  function input(label, key, value, max, textarea) {
    var id = "community-field-" + ++fieldSequence;
    return (
      '<label class="community-field" for="' +
      id +
      '"><span id="' +
      id +
      '-label">' +
      label +
      "</span><" +
      (textarea ? 'textarea rows="3"' : 'input type="text"') +
      ' id="' +
      id +
      '" aria-labelledby="' +
      id +
      '-label" name="' +
      key +
      '" maxlength="' +
      max +
      '" ' +
      (!textarea ? 'value="' + esc(value) + '"' : "") +
      ">" +
      (textarea ? esc(value) + "</textarea>" : "") +
      "</label>"
    );
  }
  function editCv(profile, section) {
    var node=context?.kind==='profile'&&context.root.querySelector('.community-profile'),ticket=generation,viewer=window.UserState?.uid;
    if(window.ICADEMResumeEditor&&node&&profile.own&&profile.uid===viewer){
      return window.ICADEMResumeEditor.open({container:node,profile:profile,
        section:section||'basicos',
        load:function(){return api('/profile');},
        save:function(payload){return api('/profile',{method:'PATCH',body:payload});},
        saveShared:async function(payload){
          if(viewer!==window.UserState?.uid||generation!==ticket)throw Error('La sesión cambió. Vuelve a abrir tu perfil.');
          var saved=await window.ICADEMPlatform.saveProfile(payload);
          if(!saved.professionalProfile||saved.professionalProfile.uid!==viewer||saved.professionalProfile.own!==true)throw Error('No se pudo confirmar tu perfil profesional.');
          return {profile:saved.professionalProfile};
        },
        preparePhoto:function(file){return window.__dirPreparePhoto(file);},
        syncGoogle:async function(){await window.__syncGoogleAccount();return api('/profile');},
        renderProfile:profileMarkup,
        onBasic:function(){window.ICADEMResumeEditor.focusSection?.('basicos');},
        onClose:function(){if(node.isConnected&&generation===ticket&&viewer===window.UserState?.uid&&!window.__sessionEnding)window.navigateToSection?.('directorio-perfil',{profileUid:viewer,editSection:'',reemplazar:true});}
      });
    }
    notify('No pudimos abrir el editor','Actualiza la página para cargar el centro de perfil profesional.',true);
  }
  function forumState(container) {
    var text = container.querySelector("#foro-text"),
      button = container.querySelector("#foro-publicar");
    if (!text || !button) return;
    text.style.height = "auto";
    text.style.height = Math.min(230, Math.max(100, text.scrollHeight)) + "px";
    if (!button.dataset.publishing)
      button.disabled =
        button.dataset.preparing === "true" ||
        !(
          text.value.trim() ||
          container.querySelector("#foro-img-preview")?.style.display ===
            "block"
        );
  }
  function enhanceForum(container) {
    var text = container.querySelector("#foro-text");
    if (text) {
      text.setAttribute(
        "aria-label",
        "Escribe una publicación para Comunidad ICADEM",
      );
      text.addEventListener("input", function () {
        forumState(container);
      });
      forumState(container);
    }
    container.querySelectorAll("[data-foro-tab]").forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        String(button.classList.contains("is-active")),
      );
      button.addEventListener("click", function () {
        container.querySelectorAll("[data-foro-tab]").forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === button));
        });
      });
    });
  }
  ["icadem:session-ending","icadem:session-ended"].forEach(function(event){document.addEventListener(event,function(){if(context?.kind==="profile")context.root.replaceChildren();cleanup();});});
  window.ICADEMCommunity = {
    attach: attach,
    openNotificationTarget: openNotificationTarget,
    cleanup: cleanup,
    paintCards: paintCards,
    openProfile: openProfile,
    renderProfilePage: renderProfilePage,
    refreshCurrentProfile: refreshCurrentProfile,
    enhanceForum: enhanceForum,
    forumState: forumState,
    profileMarkup: profileMarkup,
  };
})();
