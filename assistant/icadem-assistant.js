(() => {
  'use strict';

  const config = window.ICADEM_ASSISTANT_CONFIG;
  const knowledge = window.ICADEM_ASSISTANT_KNOWLEDGE || {};
  if (!config || document.querySelector('[data-syg-root]')) return;

  const sessionKey = 'icadem:guide:session:v2';
  const cookieKey = 'icadem:privacy:consent:v1';
  const welcomeKey = 'icadem:guide:welcome:v1';
  const positionKey = 'icadem:guide:position:v1';
  const professionalCase = /(?:mi\s+caso|mi\s+demanda|mi\s+declaracion|mi\s+empresa|cuanto\s+debo\s+pagar|dime\s+que\s+hacer|garantiza|resultado\s+legal|asesoria\s+personalizada)/i;
  const stopwords = new Set(['quiero','curso','cursos','sobre','para','como','algo','una','uno','unos','unas','del','las','los','que','con','por','me','interesa','busco','aprender','capacitacion','tema','pregunta','icadem','profesional','profesionistas']);

  let messages = [];
  let quickActions = [];
  let waiting = false;
  let motionTimer = 0;
  let ambientTimer = 0;
  let gazeTimer = 0;
  let ambientIndex = 0;
  let suppressLauncherClick = false;
  let positionBucket = window.innerWidth <= 760 ? 'mobile' : 'desktop';
  let route = { step:-1, answers:[], selections:[], result:[] };

  const visitorId = readStoredId(localStorage, 'icadem:analytics:vid');
  const assistantSessionId = readStoredId(sessionStorage, 'icadem:assistant:sid');

  function readStoredId(store, key) {
    try {
      let value = store.getItem(key);
      if (!value) {
        value = (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).toLowerCase();
        store.setItem(key, value);
      }
      return value;
    } catch (_) { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
  }

  function track(type, detail = {}) {
    const allowed = ['assistant_open','assistant_question','questionnaire_start','questionnaire_complete','course_click','lead_submit','cookie_accept'];
    if (!allowed.includes(type)) return;
    const body = JSON.stringify({ type, vid:visitorId, sid:assistantSessionId, ...detail });
    fetch(`${config.apiBase}/api/index/events`, { method:'POST', keepalive:true, headers:{ 'Content-Type':'application/json' }, body }).catch(() => {});
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function characterMarkup(alt) {
    const blinkImage = config.blinkImage || config.image;
    return `<span class="syg-character">
      <span class="syg-character__motion">
        <img class="syg-character__frame syg-character__frame--open" src="${escapeHtml(config.image)}" alt="${escapeHtml(alt)}" decoding="async">
        <img class="syg-character__frame syg-character__frame--blink" src="${escapeHtml(blinkImage)}" alt="" aria-hidden="true" decoding="async" fetchpriority="low">
      </span>
    </span>`;
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function timeLabel() {
    try { return new Intl.DateTimeFormat('es-MX', { hour:'2-digit', minute:'2-digit' }).format(new Date()); }
    catch (_) { return ''; }
  }

  function loadSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(sessionKey) || '{}');
      if (Array.isArray(saved.messages)) messages = saved.messages.slice(-18);
    } catch (_) { messages = []; }
    if (!messages.length) messages = [{ role:'assistant', text:config.welcome, time:timeLabel() }];
  }

  function saveSession() {
    try { localStorage.setItem(sessionKey, JSON.stringify({ messages:messages.slice(-18) })); } catch (_) {}
  }

  function courseUrl(course) {
    const params = new URLSearchParams({ tab:'register', origin:'guia-icadem', curso:course.id, programa:course.title });
    return `vip-auth.html?${params.toString()}`;
  }

  function courseImage(course) {
    return course.cover || 'assets/img/cursos-mini/curso-01.webp';
  }

  function tokens(value) {
    return normalize(value).split(' ').filter(token => token.length > 2 && !stopwords.has(token));
  }

  function rankCourses(terms, limit = 3) {
    const wanted = Array.isArray(terms) ? terms : [terms];
    const queryTokens = [...new Set(wanted.flatMap(tokens))];
    return config.courses.map((course, index) => {
      const title = normalize(course.title);
      const haystack = normalize(`${course.title} ${course.area} ${course.detail} ${(course.tags || []).join(' ')}`);
      const titleWords = new Set(title.split(' '));
      const haystackWords = new Set(haystack.split(' '));
      const hasPhrase = (text, phrase) => (` ${text} `).includes(` ${phrase} `);
      const phraseScore = wanted.reduce((score, term) => {
        const phrase = normalize(term);
        if (!phrase) return score;
        return score + (hasPhrase(title, phrase) ? 14 : hasPhrase(haystack, phrase) ? 7 : 0);
      }, 0);
      const tokenScore = queryTokens.reduce((score, token) => score + (titleWords.has(token) ? 5 : haystackWords.has(token) ? 2 : 0), 0);
      return { course, score:phraseScore + tokenScore, index };
    }).filter(item => item.score > 0).sort((a,b) => b.score - a.score || a.index - b.index).slice(0, limit).map(item => item.course);
  }

  function findNamedCourses(names, limit = 3) {
    const selected = [];
    (names || []).forEach(name => {
      const needle = normalize(name);
      const exact = config.courses.find(course => normalize(course.title) === needle);
      const partial = exact || config.courses.find(course => normalize(course.title).includes(needle) || needle.includes(normalize(course.title)));
      if (partial && !selected.some(course => course.id === partial.id)) selected.push(partial);
    });
    return selected.slice(0, limit);
  }

  const root = document.createElement('div');
  root.className = 'syg-root';
  root.dataset.sygRoot = '';
  root.dataset.motion = 'idle';
  root.dataset.paused = 'false';
  root.innerHTML = `
    <button class="syg-launcher" type="button" aria-label="Abrir asistente virtual de ICADEM">
      <span class="syg-launcher__avatar">${characterMarkup('Asistente profesional virtual de ICADEM')}</span>
      <span class="syg-launcher__copy">
        <span class="syg-launcher__bubble"><strong>¡Hola! Soy tu guía ICADEM 👋</strong><span>Pregúntame sobre derecho, finanzas, fiscal, RR. HH. o negocios.</span></span>
        <em class="syg-launcher__cta">Preparar mi ruta <b aria-hidden="true">→</b></em>
        <small class="syg-launcher__drag"><span aria-hidden="true">✣</span> Arrástrame</small>
      </span>
    </button>
    <section class="syg-panel" aria-label="Conversación con ICADEM, asistente virtual" hidden>
      <header class="syg-header">
        <button class="syg-avatar" type="button" aria-label="Saludar al asistente">${characterMarkup('Asistente profesional virtual de ICADEM')}</button>
        <span class="syg-header__title"><strong>${escapeHtml(config.assistantName)}</strong><small>${escapeHtml(config.assistantLabel)}</small></span>
        <span class="syg-header__actions">
          <button class="syg-icon-btn" type="button" data-action="reset" aria-label="Empezar de nuevo" title="Empezar de nuevo">↻</button>
          <button class="syg-icon-btn" type="button" data-action="pause" aria-label="Pausar movimiento" title="Pausar movimiento">Ⅱ</button>
          <button class="syg-icon-btn" type="button" data-action="close" aria-label="Minimizar asistente" title="Minimizar">−</button>
        </span>
      </header>
      <div class="syg-disclosure">Orientación educativa con cursos reales de ICADEM. Para decisiones fiscales, legales o financieras sobre un caso concreto, verifica la norma vigente con un profesional.</div>
      <div class="syg-messages" aria-live="polite"></div>
      <div class="syg-quick" aria-label="Opciones rápidas"></div>
      <form class="syg-composer">
        <label for="syg-input">Escribe tu pregunta</label>
        <input class="syg-input" id="syg-input" maxlength="240" autocomplete="off" placeholder="¿Qué te gustaría aprender?">
        <button class="syg-send" type="submit" aria-label="Enviar mensaje">↑</button>
      </form>
    </section>`;
  document.body.appendChild(root);

  const launcher = root.querySelector('.syg-launcher');
  const panel = root.querySelector('.syg-panel');
  const messageBox = root.querySelector('.syg-messages');
  const quickBox = root.querySelector('.syg-quick');
  const input = root.querySelector('.syg-input');
  const send = root.querySelector('.syg-send');
  let panelScrollY = 0;
  let panelBackgroundLocked = false;

  function lockPanelBackground() {
    if (window.innerWidth > 760 || panelBackgroundLocked) return;
    panelScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    document.body.style.setProperty('--syg-panel-scroll-top', `-${panelScrollY}px`);
    document.body.classList.add('syg-panel-open');
    panelBackgroundLocked = true;
  }

  function unlockPanelBackground() {
    if (!panelBackgroundLocked) return;
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.body.classList.remove('syg-panel-open');
    document.body.style.removeProperty('--syg-panel-scroll-top');
    panelBackgroundLocked = false;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo({ left:0, top:panelScrollY, behavior:'auto' });
    if (previousScrollBehavior) document.documentElement.style.scrollBehavior = previousScrollBehavior;
    else document.documentElement.style.removeProperty('scroll-behavior');
  }

  function courseCards(items) {
    if (!items?.length) return '';
    return `<div class="syg-course-list">${items.map(course => `
      <a class="syg-course" data-course-id="${escapeHtml(course.id)}" href="${escapeHtml(courseUrl(course))}" aria-label="Ver ${escapeHtml(course.title)} y registrarme gratis">
        <span class="syg-course__cover"><img src="${escapeHtml(courseImage(course))}" alt="" loading="lazy"></span>
        <span class="syg-course__copy"><small>${escapeHtml(course.area)} · ${course.classes} clase${course.classes === 1 ? '' : 's'}</small><strong>${escapeHtml(course.title)}</strong><em>${escapeHtml(course.detail)}</em></span>
        <span class="syg-course__arrow" aria-hidden="true">→</span>
      </a>`).join('')}</div>`;
  }

  function renderMessages() {
    messageBox.innerHTML = messages.map(message => `
      <div class="syg-message syg-message--${message.role}">
        <div class="syg-message__bubble">
          ${message.role === 'assistant' ? `<span class="syg-message__label">ICADEM · ASISTENTE VIRTUAL</span>` : ''}
          ${escapeHtml(message.text)}
          ${courseCards(message.items)}
          ${message.human ? `<div class="syg-source"><span aria-hidden="true">💬</span><span><a href="${escapeHtml(config.whatsappUrl)}" target="_blank" rel="noreferrer">Abrir WhatsApp con un asesor</a>. La conversación no se transfiere automáticamente.</span></div>` : ''}
          <span class="syg-message__time">${escapeHtml(message.time || '')}</span>
        </div>
      </div>`).join('') + (waiting ? `<div class="syg-message syg-message--assistant"><div class="syg-message__bubble"><span class="syg-message__label">ICADEM está consultando</span><span class="syg-thinking" aria-label="Preparando respuesta"><i></i><i></i><i></i></span></div></div>` : '');
    requestAnimationFrame(() => { messageBox.scrollTop = messageBox.scrollHeight; });
  }

  function setQuick(actions) {
    quickActions = actions || [];
    quickBox.innerHTML = quickActions.map((action, index) => `<button type="button" class="syg-chip${action.primary ? ' syg-chip--primary' : ''}" data-quick="${escapeHtml(action.value)}" data-index="${index}">${escapeHtml(action.label)}</button>`).join('');
  }

  function homeActions() {
    setQuick([
      { label:'Descubrir mi ruta', value:'route', primary:true },
      { label:'Buscar por tema', value:'courses' },
      { label:'Resolver una duda', value:'concepts' },
      { label:'Conocer la membresía', value:'membership' },
      { label:'Hablar con un asesor', value:'human' }
    ]);
  }

  function setMotion(value, duration = 900) {
    clearTimeout(motionTimer);
    root.dataset.motion = value;
    if (value !== 'idle') motionTimer = window.setTimeout(() => { root.dataset.motion = 'idle'; }, duration);
  }

  function activeCharacter() {
    const host = panel.hidden ? launcher : panel;
    return host.querySelector('.syg-character');
  }

  function resetCharacterGaze(character = activeCharacter()) {
    if (!character) return;
    character.style.setProperty('--syg-look-x', '0px');
    character.style.setProperty('--syg-look-y', '0px');
    character.style.setProperty('--syg-look-r', '0deg');
  }

  function followPointer(event) {
    if (root.dataset.paused === 'true' || root.dataset.dragging === 'true') return;
    const character = activeCharacter();
    if (!character) return;
    const rect = character.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / Math.max(rect.width, 1)));
    const y = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / Math.max(rect.height, 1)));
    character.style.setProperty('--syg-look-x', `${(x * 5).toFixed(2)}px`);
    character.style.setProperty('--syg-look-y', `${(y * 3).toFixed(2)}px`);
    character.style.setProperty('--syg-look-r', `${(x * 1.5).toFixed(2)}deg`);
    window.clearTimeout(gazeTimer);
    gazeTimer = window.setTimeout(() => resetCharacterGaze(character), 650);
  }

  function scheduleAmbientMotion() {
    window.clearTimeout(ambientTimer);
    if (root.dataset.paused === 'true') return;
    const motions = [
      ['look-left', 1000],
      ['nod', 900],
      ['look-right', 1000],
      ['happy', 1050]
    ];
    ambientTimer = window.setTimeout(() => {
      if (root.dataset.paused !== 'true' && root.dataset.motion === 'idle') {
        const [motion, duration] = motions[ambientIndex % motions.length];
        ambientIndex += 1;
        setMotion(motion, duration);
      }
      scheduleAmbientMotion();
    }, 4200 + Math.round(Math.random() * 2400));
  }

  function openAssistant() {
    launcher.hidden = true;
    panel.hidden = false;
    lockPanelBackground();
    restorePosition(panel, 'panel');
    renderMessages();
    if (!quickActions.length) homeActions(); else setQuick(quickActions);
    setMotion('wave');
    track('assistant_open');
    window.setTimeout(() => input.focus(), 120);
  }

  function closeAssistant() {
    panel.hidden = true;
    launcher.hidden = false;
    unlockPanelBackground();
    restorePosition(launcher, 'launcher');
    setMotion('wave');
  }

  function readPositions() {
    try { return JSON.parse(localStorage.getItem(positionKey) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function clampPosition(element, left, top) {
    const rect = element.getBoundingClientRect();
    const margin = 8;
    return {
      left:Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin)),
      top:Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin))
    };
  }

  function placeElement(element, left, top) {
    if (element === panel && window.innerWidth <= 760) {
      const currentWidth = element.getBoundingClientRect().width;
      if (currentWidth) element.style.width = `${Math.round(currentWidth)}px`;
    }
    const next = clampPosition(element, left, top);
    element.style.left = `${Math.round(next.left)}px`;
    element.style.top = `${Math.round(next.top)}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    return next;
  }

  function restorePosition(element, name) {
    const saved = readPositions()[`${name}:${positionBucket}`];
    if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) {
      element.style.removeProperty('left');
      element.style.removeProperty('top');
      element.style.removeProperty('right');
      element.style.removeProperty('bottom');
      element.style.removeProperty('width');
      return;
    }
    requestAnimationFrame(() => placeElement(element, saved.left, saved.top));
  }

  function savePosition(name, position) {
    try {
      const saved = readPositions();
      saved[`${name}:${positionBucket}`] = position;
      localStorage.setItem(positionKey, JSON.stringify(saved));
    } catch (_) {}
  }

  function makeDraggable(element, handle, name) {
    let drag = null;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || (name === 'panel' && event.target.closest('button,a,input'))) return;
      const rect = element.getBoundingClientRect();
      drag = { id:event.pointerId, x:event.clientX, y:event.clientY, left:rect.left, top:rect.top, moved:false };
      try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      root.dataset.dragging = 'true';
      event.preventDefault();
      placeElement(element, drag.left + dx, drag.top + dy);
    });
    const finish = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = null;
      root.dataset.dragging = 'false';
      try { handle.releasePointerCapture(event.pointerId); } catch (_) {}
      if (!moved) return;
      const rect = element.getBoundingClientRect();
      savePosition(name, { left:rect.left, top:rect.top });
      if (name === 'launcher') {
        suppressLauncherClick = true;
        window.setTimeout(() => { suppressLauncherClick = false; }, 80);
      }
      event.preventDefault();
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  function addMessage(role, text, extra = {}) {
    messages.push({ role, text:String(text || ''), time:timeLabel(), ...extra });
    messages = messages.slice(-18);
    saveSession();
    renderMessages();
  }

  function reply(text, extra = {}) {
    waiting = false;
    send.disabled = false;
    addMessage('assistant', text, extra);
    setMotion(extra.items?.length ? 'course' : 'answer', extra.items?.length ? 1200 : 760);
  }

  function setWaiting(value) {
    waiting = value;
    send.disabled = value;
    renderMessages();
    if (value) setMotion('think', 16000);
  }

  function findConcept(value) {
    const normalized = normalize(value);
    let best = null;
    let bestScore = 0;
    Object.values(knowledge).forEach(concept => {
      (concept.aliases || []).forEach(alias => {
        const key = normalize(alias);
        const score = normalized === key ? 100 : normalized.includes(key) ? 60 + key.length : key.includes(normalized) && normalized.length > 3 ? 30 : 0;
        if (score > bestScore) { best = concept; bestScore = score; }
      });
    });
    return best;
  }

  function explainConcept(concept) {
    const recommendations = findNamedCourses(concept.courses || [], 3);
    const suffix = recommendations.length ? '\n\nPara llevar este tema a la práctica, te recomiendo estos cursos del Club VIP:' : '';
    reply(`${concept.answer}${suffix}`, { items:recommendations });
    setQuick([
      { label:'Explorar otro concepto', value:'concepts' },
      { label:'Buscar otro curso', value:'courses' },
      { label:'Preparar mi ruta', value:'route', primary:true },
      { label:'Volver al menú', value:'home' }
    ]);
  }

  function explainMembership() {
    reply('La membresía ICADEM reúne cursos profesionales, clases en vivo, materiales, herramientas, retos, biblioteca y certificados verificables. Puedes crear una cuenta sin costo, elegir un curso para probar sus primeras clases y activar VIP cuando quieras continuar con el catálogo completo.', { items:config.courses.filter(course => ['ZNGXQyIv3pWye25ugZ3q','N6ljRcFTkheVxmHXYBii'].includes(course.id)) });
    setQuick([
      { label:'Preparar mi ruta', value:'route', primary:true },
      { label:'Explorar cursos', value:'courses' },
      { label:'Hablar con un asesor', value:'human' },
      { label:'Volver al menú', value:'home' }
    ]);
  }

  function showConcepts() {
    reply('Puedo explicarte temas profesionales con lenguaje claro y relacionarlos con formación real de ICADEM. Elige un ejemplo o escribe tu propia pregunta.');
    setQuick([
      { label:'¿Cómo responder al SAT?', value:'ask:¿Cómo debo ordenar una respuesta a un requerimiento del SAT?' },
      { label:'Leer estados financieros', value:'ask:¿Cómo se leen juntos los estados financieros?' },
      { label:'Revisar un contrato', value:'ask:¿Qué debo revisar antes de firmar un contrato?' },
      { label:'Controlar inventarios', value:'ask:¿Cómo mejoro el control de inventarios?' },
      { label:'Liderar un equipo', value:'ask:¿Cómo doy seguimiento a un equipo sin saturarlo?' },
      { label:'Escribir otro tema', value:'question' }
    ]);
  }

  function showCourseTopics() {
    reply('¿Qué área te interesa? Buscaré dentro de los cursos reales que están en el Club VIP.');
    setQuick([
      { label:'Legal y litigación', value:'search:legal abogacia litigio contratos' },
      { label:'Fiscal y contable', value:'search:fiscal sat contabilidad finanzas' },
      { label:'Finanzas e inversión', value:'search:finanzas inversiones mercados' },
      { label:'Liderazgo y talento', value:'search:recursos humanos liderazgo talento' },
      { label:'Operaciones y logística', value:'search:operaciones logistica inventarios' },
      { label:'Ventas y marketing', value:'search:ventas marketing publicidad' }
    ]);
  }

  function searchCourses(value) {
    const results = rankCourses(value, 3);
    if (!results.length) {
      reply('No encontré una coincidencia exacta en el catálogo actual, pero puedo ayudarte a afinar la búsqueda por área o preparar una ruta completa.');
      showCourseTopics();
      return;
    }
    reply(`Encontré ${results.length === 1 ? 'un curso relacionado' : 'estos cursos relacionados'} dentro del Club VIP. Puedes abrir cualquiera para registrarte y ver su acceso:`, { items:results });
    setQuick([
      { label:'Buscar otro tema', value:'courses' },
      { label:'Preparar mi ruta', value:'route', primary:true },
      { label:'Conocer la membresía', value:'membership' }
    ]);
  }

  function broadAnswer(value) {
    const related = rankCourses(value, 3);
    const normalized = normalize(value);
    let text = 'Puedo ayudarte a ordenar ese tema profesional. Empieza por definir el objetivo, reunir evidencia confiable, separar hechos de supuestos, revisar riesgos y documentar una decisión con responsable y fecha. ';
    if (/fiscal|sat|impuesto|contab|factura|cfdi/.test(normalized)) text = 'En un tema fiscal o contable conviene identificar primero la obligación y el periodo, conciliar comprobantes, bancos y registros, revisar plazos y conservar evidencia. No presentes información aislada: la respuesta debe ser completa y congruente con la contabilidad. Para una operación o expediente concreto, valida la norma vigente con un contador o abogado fiscal.';
    else if (/legal|ley|abog|demanda|contrato|juicio|audiencia/.test(normalized)) text = 'En un asunto legal, ordena los hechos cronológicamente, identifica la pretensión o riesgo, reúne documentos y comunicaciones, revisa competencia, vía y plazos, y conecta cada afirmación con evidencia. Esta guía es educativa; un expediente real necesita revisión de un abogado y de la legislación vigente.';
    else if (/finan|dinero|credito|inversion|presupuesto|flujo/.test(normalized)) text = 'Para una decisión financiera, define objetivo y plazo, compara escenarios, costo total, liquidez y riesgo, y verifica qué supuestos cambian el resultado. Evita decidir solo por la mensualidad o el rendimiento prometido. Una recomendación personal requiere conocer tu situación completa.';
    else if (/rh|talento|lider|equipo|personal|estres/.test(normalized)) text = 'En personas y equipos, convierte el problema en conductas observables, expectativas claras, responsables y seguimiento. Escucha el contexto, documenta acuerdos y cuida que la decisión sea consistente y no discriminatoria. En conflictos o salud laboral, escala con el área profesional correspondiente.';
    else if (/venta|marketing|cliente|publicidad|negocio|emprend/.test(normalized)) text = 'En negocio y ventas, aclara cliente, problema, propuesta, canal y siguiente paso; después mide conversión, costo, margen y recompra. Prueba una hipótesis a la vez y registra resultados para decidir con datos, no solo con impresiones.';
    else if (/logistica|inventario|almacen|ruta|operacion/.test(normalized)) text = 'En operaciones, define el flujo real, puntos de control, responsables, tiempos y evidencia. Mide exactitud, capacidad, costo, servicio e incidencias; corrige la causa de las diferencias antes de ajustar el registro.';
    reply(`${text}${related.length ? '\n\nPara profundizar con una ruta práctica, te sugiero:' : ''}`, { items:related });
    setQuick([{ label:'Hacer otra pregunta', value:'question' }, { label:'Buscar cursos', value:'courses' }, { label:'Preparar mi ruta', value:'route', primary:true }, { label:'Volver al menú', value:'home' }]);
  }

  async function handleInput(rawValue) {
    const value = String(rawValue || '').trim().slice(0, 240);
    if (!value || waiting) return;
    addMessage('user', value);
    input.value = '';
    const normalized = normalize(value);

    track('assistant_question', { topic:tokens(value).slice(0, 3).join('-') || 'general' });

    if (/ruta|recomienda.*curso|que curso|por donde empiezo/.test(normalized)) { openRoute('welcome'); return; }
    if (/membresia|club vip|precio|suscripcion|que incluye/.test(normalized)) { explainMembership(); return; }
    if (/asesor|persona|whatsapp|contacto/.test(normalized)) { offerHuman(); return; }
    if (/catalogo|buscar curso|cursos de|curso sobre/.test(normalized)) { searchCourses(value); return; }

    const concept = findConcept(value);
    if (concept) { explainConcept(concept); return; }
    broadAnswer(value);
  }

  function offerHuman() {
    reply('Puedes hablar con el equipo de ICADEM por WhatsApp para resolver dudas sobre cursos, acceso o membresía. El botón abre una conversación nueva y no comparte automáticamente lo que escribiste aquí.', { human:true });
    setQuick([{ label:'Preparar mi ruta', value:'route', primary:true }, { label:'Buscar cursos', value:'courses' }, { label:'Volver al menú', value:'home' }]);
  }

  function resetConversation() {
    messages = [{ role:'assistant', text:config.welcome, time:timeLabel() }];
    saveSession();
    renderMessages();
    homeActions();
    setMotion('wave');
  }

  function runQuick(value) {
    if (value === 'home') { reply('Claro. ¿Qué te gustaría hacer ahora?'); homeActions(); return; }
    if (value === 'route') { openRoute('welcome'); return; }
    if (value === 'courses') { showCourseTopics(); return; }
    if (value === 'concepts') { showConcepts(); return; }
    if (value === 'membership') { explainMembership(); return; }
    if (value === 'human') { offerHuman(); return; }
    if (value === 'question') { reply('Escribe tu duda con palabras sencillas. Evita compartir RFC, expedientes, contraseñas, datos bancarios o información personal de terceros.'); setQuick([{ label:'SAT y fiscal', value:'ask:¿Cómo ordeno un requerimiento del SAT?' }, { label:'Contratos', value:'ask:¿Qué reviso en un contrato?' }, { label:'Finanzas', value:'ask:¿Cómo analizo el flujo de efectivo?' }]); input.focus(); return; }
    if (value.startsWith('ask:')) { void handleInput(value.slice(4)); return; }
    if (value.startsWith('search:')) { searchCourses(value.slice(7)); return; }
  }

  launcher.addEventListener('click', event => {
    if (suppressLauncherClick) { event.preventDefault(); return; }
    openAssistant();
  });
  makeDraggable(launcher, launcher, 'launcher');
  makeDraggable(panel, root.querySelector('.syg-header'), 'panel');
  launcher.addEventListener('pointermove', followPointer);
  panel.addEventListener('pointermove', followPointer);
  launcher.addEventListener('pointerleave', () => resetCharacterGaze(launcher.querySelector('.syg-character')));
  panel.addEventListener('pointerleave', () => resetCharacterGaze(panel.querySelector('.syg-character')));
  restorePosition(launcher, 'launcher');
  window.addEventListener('resize', () => {
    const visible = panel.hidden ? launcher : panel;
    const nextBucket = window.innerWidth <= 760 ? 'mobile' : 'desktop';
    if (!panel.hidden) {
      if (nextBucket === 'mobile') lockPanelBackground();
      else unlockPanelBackground();
    }
    if (nextBucket !== positionBucket) {
      positionBucket = nextBucket;
      restorePosition(visible, panel.hidden ? 'launcher' : 'panel');
      return;
    }
    const rect = visible.getBoundingClientRect();
    if (rect.width && rect.height) placeElement(visible, rect.left, rect.top);
  }, { passive:true });
  root.querySelector('.syg-avatar').addEventListener('click', () => setMotion('wave'));
  root.addEventListener('click', event => {
    const courseLink = event.target.closest('[data-course-id]');
    if (courseLink) track('course_click', { courseId:courseLink.dataset.courseId });
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') closeAssistant();
    if (action === 'reset') resetConversation();
    if (action === 'pause') {
      const paused = root.dataset.paused !== 'true';
      root.dataset.paused = String(paused);
      const button = root.querySelector('[data-action="pause"]');
      button.textContent = paused ? '▶' : 'Ⅱ';
      button.setAttribute('aria-label', paused ? 'Reanudar movimiento' : 'Pausar movimiento');
      if (paused) {
        window.clearTimeout(ambientTimer);
        resetCharacterGaze();
      } else {
        setMotion('wave');
        scheduleAmbientMotion();
      }
    }
    const quick = event.target.closest('[data-quick]');
    if (quick) runQuick(quick.dataset.quick);
  });
  root.querySelector('.syg-composer').addEventListener('submit', event => { event.preventDefault(); void handleInput(input.value); });

  const routeRoot = document.createElement('div');
  routeRoot.className = 'syg-route';
  routeRoot.dataset.sygRoute = '';
  routeRoot.hidden = true;
  routeRoot.innerHTML = '<section class="syg-route__dialog" role="dialog" aria-modal="true" aria-labelledby="syg-route-title"><button class="syg-route__close" type="button" aria-label="Cerrar cuestionario">×</button><div class="syg-route__content"></div></section>';
  document.body.appendChild(routeRoot);
  const routeContent = routeRoot.querySelector('.syg-route__content');

  function renderRouteWelcome() {
    const survey = config.survey;
    routeContent.innerHTML = `
      <div class="syg-route__mascot">${characterMarkup('Asistente profesional virtual de ICADEM')}</div>
      <p class="syg-route__eyebrow">${escapeHtml(survey.eyebrow)}</p>
      <h2 id="syg-route-title">${escapeHtml(survey.title)}</h2>
      <p class="syg-route__lead">${escapeHtml(survey.detail)}</p>
      <div class="syg-route__badges"><span>5 preguntas</span><span>Resultado inmediato</span><span>Cursos reales</span><span>Datos protegidos</span></div>
      <div class="syg-route__actions"><button class="syg-btn syg-btn--primary" type="button" data-route-action="start">Preparar mi ruta <span aria-hidden="true">→</span></button><button class="syg-btn" type="button" data-route-action="dismiss">Ahora no</button></div>`;
  }

  function renderRouteQuestion() {
    const question = config.survey.questions[route.step];
    const percent = Math.round(((route.step + 1) / config.survey.questions.length) * 100);
    routeContent.innerHTML = `
      <div class="syg-progress"><div class="syg-progress__meta"><span>Pregunta ${route.step + 1} de ${config.survey.questions.length}</span><span>${percent}%</span></div><div class="syg-progress__bar"><span style="width:${percent}%"></span></div></div>
      <div class="syg-route__question">
        <p class="syg-route__eyebrow">${escapeHtml(question.overline)}</p>
        <h2 id="syg-route-title">${escapeHtml(question.title)}</h2>
        <p class="syg-route__lead">${escapeHtml(question.detail)}</p>
        <div class="syg-options">${question.options.map((option, index) => `<button class="syg-option" type="button" data-option="${index}"><span class="syg-option__icon">${escapeHtml(option.icon)}</span><span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.detail)}</small></span><span class="syg-option__radio" aria-hidden="true"></span></button>`).join('')}</div>
        <div class="syg-route__footer"><button class="syg-btn" type="button" data-route-action="back">← Volver</button><span>Elige una respuesta y avanzamos automáticamente</span></div>
      </div>`;
  }

  function buildRouteProfile() {
    const selected = route.selections || [];
    const identity = selected[0]?.label || 'Profesionista';
    const objective = selected[1]?.label || 'Tomar mejores decisiones';
    const level = selected[2]?.label || 'Quiero actualizarme';
    const style = selected[3]?.label || 'Casos y criterio';
    const area = selected[4]?.label || 'Formación profesional';
    const strengths = [
      ['Intención profesional', `Tu punto de partida —${identity.toLowerCase()}— ayuda a enfocar el aprendizaje en situaciones que sí reconoces.`],
      ['Objetivo claro', `Priorizas ${objective.toLowerCase()}, así que la ruta conecta conocimiento con una decisión observable.`],
      ['Aprendizaje aplicable', `${style} indica que valoras entender y llevar el contenido a la práctica.`]
    ];
    const improvements = [
      ['Profundidad adecuada', `${level} será el punto de referencia para no saturarte ni dejar vacíos importantes.`],
      ['Seguimiento', 'Conviene completar una ruta, aplicar una idea y registrar el resultado antes de saltar al siguiente tema.']
    ];
    return {
      headline:`Tu ruta prioriza ${area.toLowerCase()} con aplicación real.`,
      summary:`Tus respuestas muestran una meta concreta: ${objective.toLowerCase()}. Seleccionamos contenido acorde con tu experiencia y tu forma de aprender.`,
      strengths,
      improvements
    };
  }

  function routeRecommendations() {
    const chosenTags = route.answers.flat();
    const wantsShort = chosenTags.includes('short');
    const wantsLong = chosenTags.includes('long');
    return config.courses.map((course, index) => {
      const score = (course.tags || []).reduce((sum, tag) => sum + chosenTags.filter(chosen => chosen === tag).length * 4, 0)
        + (wantsShort && course.classes <= 3 ? 3 : 0)
        + (wantsLong && course.classes >= 4 ? 2 : 0);
      return { course, score, index };
    }).sort((a,b) => b.score - a.score || a.index - b.index).slice(0, 3).map(item => item.course);
  }

  function renderRouteResult() {
    route.result = routeRecommendations();
    route.completada = true;
    enviarRuta('completada', { recomendados:route.result.map(c => c.title) });
    const profile = buildRouteProfile();
    try { localStorage.setItem(welcomeKey, 'completed'); } catch (_) {}
    track('questionnaire_complete', { result:route.result.map(course => course.id).join(',') });
    routeContent.innerHTML = `
      <div class="syg-result__hero">
        <div><p class="syg-route__eyebrow">TU PERFIL FORMATIVO</p><h2 id="syg-route-title">${escapeHtml(profile.headline)}</h2><p>${escapeHtml(profile.summary)}</p></div>
        <div class="syg-result__mascot">${characterMarkup('Asistente profesional virtual de ICADEM celebrando tu ruta')}</div>
      </div>
      <section class="syg-profile" aria-label="Fortalezas y áreas para mejorar">
        <div class="syg-profile__intro"><span>DIAGNÓSTICO DE APRENDIZAJE</span><h3>Lo que ya tienes y tu siguiente oportunidad.</h3><p>Este perfil no evalúa tu trabajo: convierte tus respuestas en una guía concreta para seguir creciendo.</p></div>
        <div class="syg-profile__grid">
          <article class="syg-profile__column syg-profile__column--strength"><span class="syg-profile__label">Tus cualidades</span>${profile.strengths.map(item => `<div class="syg-profile__item"><b aria-hidden="true">✓</b><span><strong>${escapeHtml(item[0])}</strong><small>${escapeHtml(item[1])}</small></span></div>`).join('')}</article>
          <article class="syg-profile__column syg-profile__column--growth"><span class="syg-profile__label">Lo que te conviene reforzar</span>${profile.improvements.map(item => `<div class="syg-profile__item"><b aria-hidden="true">↗</b><span><strong>${escapeHtml(item[0])}</strong><small>${escapeHtml(item[1])}</small></span></div>`).join('')}</article>
        </div>
      </section>
      <h3 class="syg-result__title">Tu ruta recomendada</h3>
      <p class="syg-result__lead">Seleccionamos cursos reales del Club VIP. Toca cualquier tarjeta para crear tu cuenta gratis y abrir el curso dentro del panel.</p>
      <div class="syg-result__courses">${route.result.map((course, index) => `<a class="syg-result-card${index === 0 ? ' is-featured' : ''}" data-course-id="${escapeHtml(course.id)}" href="${escapeHtml(courseUrl(course))}" aria-label="Ver ${escapeHtml(course.title)} y registrarme gratis"><span class="syg-result-card__cover"><img src="${escapeHtml(courseImage(course))}" alt="" loading="lazy"><em>${index === 0 ? 'MEJOR COINCIDENCIA' : escapeHtml(course.area)}</em></span><span class="syg-result-card__body"><small>${escapeHtml(course.area)} · ${course.classes} clase${course.classes === 1 ? '' : 's'}</small><strong>${escapeHtml(course.title)}</strong><span>${escapeHtml(course.detail)}</span><b>Ver curso y registrarme gratis <i aria-hidden="true">→</i></b></span></a>`).join('')}</div>
      <section class="syg-lead" aria-labelledby="syg-lead-title"><div><p class="syg-route__eyebrow">GUARDA TU RUTA</p><h3 id="syg-lead-title">Recibe orientación de ICADEM</h3><p>Déjanos tus datos para que el equipo conozca tu interés. No enviamos tu conversación.</p></div><form class="syg-lead__form" data-lead-form><label>Nombre<input name="name" autocomplete="name" maxlength="80" required></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" maxlength="120" required></label><label>WhatsApp <small>(opcional)</small><input name="phone" inputmode="tel" autocomplete="tel" maxlength="24"></label><label class="syg-lead__consent"><input name="consent" type="checkbox" required><span>Acepto el tratamiento de estos datos conforme al <a href="${escapeHtml(config.privacyUrl)}" target="_blank">Aviso de Privacidad</a>.</span></label><button class="syg-btn syg-btn--primary" type="submit">Guardar mi ruta <span aria-hidden="true">→</span></button><p class="syg-lead__status" role="status" aria-live="polite"></p></form></section>
      <div class="syg-route__actions"><button class="syg-btn syg-btn--primary" type="button" data-route-action="chat-result">Hablar con la guía</button><button class="syg-btn" type="button" data-route-action="restart">Repetir diagnóstico</button><a class="syg-btn syg-btn--ink" href="${escapeHtml(config.catalogUrl)}">Entrar al Club VIP →</a></div>`;
  }

  // ── Guardado de la ruta (aparece en el admin: Marketing → Encuestas → Ruta de la guía) ──
  // Un registro por intento, sin nombre ni teléfono: descartada, parcial o completada.
  // Es independiente del formulario "Guarda tu ruta" (/api/index/leads), que sigue igual.
  const RUTA_API = `${config.apiBase}/api/encuesta/ruta`;
  const CLAVES_RUTA = ['perfil', 'prioridad', 'nivel', 'formato', 'tema'];
  const RUTA_SID_KEY = 'icadem:guide:sid';
  const RUTA_PEND_KEY = 'icadem:guide:ruta-pend';
  const nuevoId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  function rutaSid() {
    try { let v = localStorage.getItem(RUTA_SID_KEY); if (!v) { v = nuevoId(); localStorage.setItem(RUTA_SID_KEY, v); } return v; } catch (_) { return nuevoId(); }
  }
  function leerPendRuta() { try { const l = JSON.parse(localStorage.getItem(RUTA_PEND_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } }
  function escribirPendRuta(l) { try { if (l.length) localStorage.setItem(RUTA_PEND_KEY, JSON.stringify(l.slice(-10))); else localStorage.removeItem(RUTA_PEND_KEY); } catch (_) {} }
  function postRuta(cuerpo) {
    return fetch(RUTA_API, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(cuerpo), keepalive:true })
      .then(r => { if (!r.ok && r.status >= 500) throw new Error('HTTP ' + r.status); return true; });
  }
  function enviarRuta(estado, extra) {
    if (!route.intento) return;
    const respuestas = {};
    (route.selections || []).forEach((sel, i) => { if (sel && CLAVES_RUTA[i]) respuestas[CLAVES_RUTA[i]] = String(sel.label || '').slice(0, 80); });
    const cuerpo = { intentoId:route.intento, sessionId:rutaSid(), estado, respuestas, pagina:(location.pathname.split('/').pop() || 'index.html'), ...(extra || {}) };
    const firma = JSON.stringify(cuerpo);
    if (route.ultimoEnvio === firma) return; // nada nuevo que guardar
    route.ultimoEnvio = firma;
    postRuta(cuerpo).catch(() => {
      // Sin conexión: se guarda y se reintenta en la siguiente visita (el servidor reemplaza el intento, no lo duplica)
      escribirPendRuta([...leerPendRuta().filter(x => !(x.intentoId === cuerpo.intentoId && x.estado === cuerpo.estado)), cuerpo]);
    });
  }
  function reintentarRutas() {
    const pend = leerPendRuta();
    if (!pend.length) return;
    escribirPendRuta([]);
    pend.forEach(c => postRuta(c).catch(() => escribirPendRuta([...leerPendRuta(), c])));
  }
  function guardarAvanceRuta() {
    if (!route.intento || route.completada) return;
    if (route.empezo && (route.selections || []).some(Boolean)) enviarRuta('parcial');
    else enviarRuta('descartada');
  }
  window.setTimeout(reintentarRutas, 2500);
  window.addEventListener('pagehide', () => { if (!routeRoot.hidden) guardarAvanceRuta(); });

  function openRoute(mode = 'welcome') {
    route = { step:mode === 'question' ? 0 : -1, answers:[], selections:[], result:[], intento:nuevoId(), empezo:mode === 'question' };
    routeRoot.hidden = false;
    document.body.classList.add('syg-lock');
    if (route.step < 0) renderRouteWelcome(); else renderRouteQuestion();
    setMotion('wave');
    routeRoot.querySelector('.syg-route__close').focus();
  }

  function closeRoute(dismiss = false) {
    guardarAvanceRuta();
    routeRoot.hidden = true;
    document.body.classList.remove('syg-lock');
    if (dismiss) { try { localStorage.setItem(welcomeKey, 'dismissed'); } catch (_) {} }
  }

  routeRoot.addEventListener('click', event => {
    const courseLink = event.target.closest('[data-course-id]');
    if (courseLink) track('course_click', { courseId:courseLink.dataset.courseId });
    if (courseLink && route.completada) {
      const elegido = route.result.find(c => c.id === courseLink.dataset.courseId);
      enviarRuta('completada', { recomendados:route.result.map(c => c.title), cursoElegido:elegido ? elegido.title : courseLink.dataset.courseId });
    }
    if (event.target === routeRoot || event.target.closest('.syg-route__close')) { closeRoute(true); return; }
    const action = event.target.closest('[data-route-action]')?.dataset.routeAction;
    if (action === 'start') { route.step = 0; route.empezo = true; renderRouteQuestion(); setMotion('wave'); track('questionnaire_start'); return; }
    if (action === 'dismiss') { closeRoute(true); return; }
    if (action === 'back') {
      if (route.step <= 0) { route.step = -1; renderRouteWelcome(); }
      else { route.step -= 1; route.answers.pop(); route.selections.pop(); renderRouteQuestion(); }
      return;
    }
    if (action === 'restart') { route = { step:0, answers:[], selections:[], result:[], intento:nuevoId(), empezo:true }; renderRouteQuestion(); return; }
    if (action === 'chat-result') {
      const result = route.result.slice();
      closeRoute();
      openAssistant();
      reply('Ya tengo tu ruta. Estas son tus tres recomendaciones principales; puedes abrir cada curso y registrarte en el Club VIP:', { items:result });
      setQuick([{ label:'Buscar otro tema', value:'courses' }, { label:'Resolver una duda', value:'question' }, { label:'Hablar con un asesor', value:'human' }]);
      return;
    }
    const optionButton = event.target.closest('[data-option]');
    if (!optionButton) return;
    const question = config.survey.questions[route.step];
    const option = question.options[Number(optionButton.dataset.option)];
    if (!option) return;
    routeRoot.querySelectorAll('.syg-option').forEach(button => button.classList.remove('is-selected'));
    optionButton.classList.add('is-selected');
    route.answers[route.step] = option.tags || [];
    route.selections[route.step] = { label:option.label, detail:option.detail, tags:option.tags || [] };
    setMotion('answer');
    window.setTimeout(() => {
      route.step += 1;
      if (route.step >= config.survey.questions.length) renderRouteResult(); else renderRouteQuestion();
    }, 230);
  });

  routeRoot.addEventListener('submit', async event => {
    const form = event.target.closest('[data-lead-form]');
    if (!form) return;
    event.preventDefault();
    const status = form.querySelector('.syg-lead__status');
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    button.disabled = true;
    status.textContent = 'Guardando tu ruta…';
    try {
      const response = await fetch(`${config.apiBase}/api/index/leads`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({
          name:String(data.get('name') || ''),
          email:String(data.get('email') || ''),
          phone:String(data.get('phone') || ''),
          consent:data.get('consent') === 'on',
          vid:visitorId,
          sid:assistantSessionId,
          answers:route.selections.map((selection, index) => ({ question:config.survey.questions[index]?.title || '', answer:selection?.label || '' })),
          recommendations:route.result.map(course => ({ id:course.id, title:course.title }))
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || 'No pudimos guardar tus datos.');
      form.classList.add('is-saved');
      form.querySelectorAll('input').forEach(field => { field.disabled = true; });
      button.textContent = 'Ruta guardada ✓';
      status.textContent = 'Listo. Tu ruta quedó registrada y ya puedes abrir cualquiera de los cursos sugeridos.';
      track('lead_submit', { result:route.result.map(course => course.id).join(',') });
      setMotion('happy', 1400);
    } catch (error) {
      status.textContent = error.message || 'No pudimos guardar tus datos. Intenta otra vez.';
      button.disabled = false;
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!routeRoot.hidden) closeRoute(true);
    else if (!panel.hidden) closeAssistant();
  });

  function mountCookieNotice() {
    let accepted = false;
    try { accepted = Boolean(localStorage.getItem(cookieKey)) || /(?:^|;\s*)icadem_privacy_consent=1(?:;|$)/.test(document.cookie); } catch (_) {}
    if (accepted) return;
    const notice = document.createElement('aside');
    notice.className = 'syg-cookie';
    notice.setAttribute('aria-label', 'Aviso de privacidad y almacenamiento local');
    notice.innerHTML = `<div><strong>Tu privacidad importa</strong><p>Usamos cookies y almacenamiento necesario para recordar tus preferencias, además de medición anónima para mejorar el sitio. Consulta nuestro <a href="${escapeHtml(config.privacyUrl)}">Aviso de Privacidad</a>.</p></div><button type="button">Acepto</button>`;
    document.body.appendChild(notice);
    document.body.classList.add('syg-cookie-open');
    notice.querySelector('button').addEventListener('click', () => {
      try { localStorage.setItem(cookieKey, JSON.stringify({ status:'accepted', at:new Date().toISOString() })); } catch (_) {}
      try { document.cookie = 'icadem_privacy_consent=1; Max-Age=31536000; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (_) {}
      notice.hidden = true;
      document.body.classList.remove('syg-cookie-open');
      window.dispatchEvent(new CustomEvent('icadem:privacy-consent'));
      track('cookie_accept');
    });
  }

  loadSession();
  renderMessages();
  homeActions();
  mountCookieNotice();
  scheduleAmbientMotion();
  window.setTimeout(() => {
    let seen = false;
    try { seen = Boolean(localStorage.getItem(welcomeKey)); } catch (_) {}
    // Si la encuesta del landing está en la página, no se abre otra encuesta encima (la ruta sigue disponible desde la guía)
    if (!seen && panel.hidden && !document.getElementById('encuentra')) openRoute('welcome');
  }, 850);

  window.ICADEMAssistant = Object.freeze({ open:openAssistant, openRoute, search:searchCourses, ask:handleInput });
})();

