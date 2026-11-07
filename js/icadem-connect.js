/* ═══════════════════════════════════════════════════════════════════
   ICADEM Connect · Tu red de contactos profesionales
   Vive dentro de la sección "Directorio VIP" del panel. Reutiliza la tarjeta
   del directorio (misma foto, mismo nombre) y agrega: explorar, conexiones,
   solicitudes, CV virtual y medios de contacto autorizados por el servidor.
   Sin chat: los usuarios solo se conectan y, ya conectados, abren WhatsApp,
   LinkedIn, Instagram, Facebook, correo o sitio web externos.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SECTORES = ['Fiscal y Contable', 'Nómina y RH', 'Legal y Corporativo', 'Finanzas', 'Consultoría de Negocios', 'Marketing y Ventas', 'Tecnología', 'Educación', 'Otro'];
  const MEDIOS = [
    { id: 'whatsapp', nombre: 'WhatsApp', icono: 'i-whatsapp', clase: 'wa', placeholder: '52 238 123 4567' },
    { id: 'email', nombre: 'Correo profesional', icono: 'i-mail', clase: 'mail', placeholder: 'correo@empresa.com' },
    { id: 'linkedin', nombre: 'LinkedIn', icono: 'i-linkedin', clase: 'li', placeholder: 'linkedin.com/in/tu-perfil' },
    { id: 'instagram', nombre: 'Instagram', icono: 'i-instagram', clase: 'ig', placeholder: '@usuario' },
    { id: 'facebook', nombre: 'Facebook', icono: 'i-facebook', clase: 'fb', placeholder: 'facebook.com/tu-perfil' },
    { id: 'web', nombre: 'Sitio web', icono: 'i-link', clase: 'web', placeholder: 'tusitio.com' }
  ];
  const ALCANCE_LABEL = { publico: 'Público', conexiones: 'Solo mis conexiones', oculto: 'Oculto' };
  const MOTIVOS = [['spam', 'Spam o publicidad'], ['suplantacion', 'Suplantación de identidad'], ['contenido-inapropiado', 'Contenido inapropiado'], ['acoso', 'Acoso'], ['otro', 'Otro']];
  const POLL_MS = 90 * 1000;

  const S = {
    container: null, tab: 'explorar', view: 'tabs', profileUid: null, overview: null,
    explore: { q: '', sector: '', vip: false, habilidad: '', ubicacion: '', empresa: '', page: 1, items: [], recomendados: [], total: 0, hasMore: false, loading: false, filtersOpen: false, advanced: false, revision: 0 },
    conexiones: { items: [], q: '', loaded: false },
    solicitudes: { recibidas: [], enviadas: [], box: 'recibidas', loaded: false },
    perfil: null, editorDraft: null, notifs: { items: [], timer: null },
    pendingTab: null
  };

  /* ───────────── utilidades ───────────── */
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ic = name => `<svg class="ic" aria-hidden="true"><use href="#${name}"/></svg>`;
  const toast = (type, title, msg) => { if (typeof Toast !== 'undefined' && Toast[type]) Toast[type](title, msg || ''); else console.log('[connect]', type, title, msg || ''); };
  const uidActual = () => window.UserState?.uid || (window.__isDemoMode ? 'demo-yo' : null);
  const esDemo = () => window.__isDemoMode === true;
  const esVip = () => window.UserState?.modo === 'vip' || window.UserState?.isAdmin === true || (S.overview?.cuota?.vip === true);
  function fotoSrc(card) {
    const url = card?.foto || '';
    if (!url) return '';
    return card?.fotoOrigen === 'google' ? (window.__avatarSrc?.(url) || url) : url;
  }
  function avatar(card, size) {
    const src = fotoSrc(card);
    const cls = `icx-avatar${size ? ` icx-avatar--${size}` : ''}`;
    if (src) return `<div class="${cls}"><img src="${esc(src)}" alt="" referrerpolicy="no-referrer" loading="lazy"></div>`;
    const inicial = card?.iniciales || String(card?.nombre || '?').trim().slice(0, 2).toUpperCase();
    return `<div class="${cls}">${esc(inicial)}</div>`;
  }
  function tiempoRel(value) {
    if (!value) return '';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    const seg = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seg < 60) return 'ahora';
    if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
    if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
    const dias = Math.floor(seg / 86400);
    if (dias === 1) return 'ayer';
    if (dias < 30) return `hace ${dias} días`;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function horaLocal(value) {
    if (!value) return '';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-MX', { timeZone: S.overview?.cuota?.timezone || 'America/Mexico_City', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
  }
  const debounce = (fn, ms) => { let t = 0; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
  function confirmar({ title, message, okLabel = 'Confirmar', danger = false }) {
    return new Promise(resolve => {
      if (typeof Modal === 'undefined') { resolve(window.confirm(`${title}\n\n${message}`)); return; }
      const footer = document.createElement('div');
      footer.innerHTML = `<button class="btn btn--ghost" data-cancel>Cancelar</button><button class="btn ${danger ? 'btn--ghost' : 'btn--accent'}" data-ok ${danger ? 'style="color:var(--danger);border-color:color-mix(in srgb,var(--danger) 40%,transparent)"' : ''}>${esc(okLabel)}</button>`;
      let done = false;
      const m = Modal.open({ id: 'icx-confirm', title, icon: 'i-alert-circle', size: 'sm', body: `<p style="font-size:13.5px;line-height:1.6;color:var(--text-2);margin:0">${esc(message)}</p>`, footer, onClose: () => { if (!done) resolve(false); } });
      footer.querySelector('[data-cancel]').addEventListener('click', () => { done = true; resolve(false); m.close(); });
      footer.querySelector('[data-ok]').addEventListener('click', () => { done = true; resolve(true); m.close(); });
    });
  }

  /* ───────────── API (servidor o demo) ───────────── */
  const Demo = (() => {
    const yo = 'demo-yo';
    const base = (uid, nombre, profesion, sector, empresa, ubicacion, habilidades, isVip, extra = {}) => ({ uid, nombre, profesion, puesto: profesion, especialidad: sector, sector, empresa, ubicacion, habilidades, intereses: [], isVip, perfilCompleto: true, aceptaSolicitudes: true, foto: '', iniciales: nombre.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(), ...extra });
    const cards = [
      base(yo, 'Tú (Invitado)', 'Consultor fiscal', 'Fiscal y Contable', 'Mi despacho', 'Puebla', ['Excel', 'SAT', 'Nómina'], false),
      base('demo-01', 'Mariana López', 'Contadora senior', 'Fiscal y Contable', 'Contadores del Bajío', 'León, Gto.', ['SAT', 'CFDI 4.0', 'Auditoría'], true),
      base('demo-02', 'Rodrigo Pérez', 'Abogado corporativo', 'Legal y Corporativo', 'Pérez & Asociados', 'CDMX', ['Contratos', 'Litigio', 'Compliance'], true),
      base('demo-03', 'Ana Sofía Ruiz', 'Gerente de RH', 'Nómina y RH', 'Grupo Textil', 'Tehuacán', ['Nómina', 'IMSS', 'Reclutamiento'], false),
      base('demo-04', 'Luis Hernández', 'Director financiero', 'Finanzas', 'Agroindustrias LH', 'Querétaro', ['Flujo de efectivo', 'Excel', 'Presupuestos'], true),
      base('demo-05', 'Gabriela Torres', 'Consultora de marketing', 'Marketing y Ventas', 'GT Marketing', 'Guadalajara', ['Meta Ads', 'Ventas', 'Branding'], false),
      base('demo-06', 'Jorge Castillo', 'Desarrollador web', 'Tecnología', 'Freelance', 'Puebla', ['Firebase', 'JavaScript', 'Stripe'], false)
    ];
    const rel = { 'demo-01': 'connected', 'demo-02': 'received', 'demo-03': 'sent' };
    let usadas = 0;
    const limite = 2;
    const perfilDemo = {
      acercaDe: 'Profesional con experiencia en la práctica fiscal y contable de PyMEs. Me interesa colaborar con despachos y áreas de RH.',
      experiencia: [{ id: 'e1', cargo: 'Consultor fiscal', empresa: 'Mi despacho', inicio: '2021', fin: '', actual: true, descripcion: 'Atención a 40 contribuyentes; declaraciones, CFDI y cumplimiento.' }],
      formacion: [{ id: 'f1', institucion: 'BUAP', estudios: 'Licenciatura en Contaduría', especialidad: 'Fiscal', periodo: '2012–2016' }],
      formacionIcadem: { cursos: [{ id: 'c1', titulo: 'Declaraciones anuales ante el SAT', area: 'Fiscal' }], certificados: [{ folio: 'ICADEM-2026-0001', curso: 'Declaraciones anuales ante el SAT', year: 2026 }], areas: ['Fiscal'] },
      medios: { whatsapp: { valor: '5212381234567', alcance: 'conexiones' }, email: { valor: 'tu@correo.com', alcance: 'oculto' }, linkedin: { valor: 'https://www.linkedin.com/in/tu-perfil', alcance: 'publico' }, instagram: { valor: '', alcance: 'oculto' }, facebook: { valor: '', alcance: 'oculto' }, web: { valor: '', alcance: 'oculto' } },
      privacidad: { buscable: true, aceptaSolicitudes: true, mostrarUbicacion: true, mostrarEmpresa: true, mostrarFormacion: true, compartirCursos: true, compartirCertificados: true }
    };
    const relOf = uid => (uid === yo ? { estado: 'self' } : { estado: rel[uid] || 'none' });
    const contactosDe = uid => (rel[uid] === 'connected'
      ? [{ medio: 'whatsapp', valor: '5212381234567', url: 'https://wa.me/5212381234567', alcance: 'conexiones' }, { medio: 'linkedin', valor: 'https://www.linkedin.com/in/demo', url: 'https://www.linkedin.com/in/demo', alcance: 'publico' }]
      : []);
    async function request(path, options) {
      const method = options?.method || 'GET';
      const url = new URL(path, 'https://demo.local');
      const p = url.pathname;
      if (p === '/api/connect/overview') return { ok: true, cuota: { limite, usadas, restantes: Math.max(0, limite - usadas), reiniciaEn: new Date(Date.now() + 6 * 3600e3).toISOString(), timezone: 'America/Mexico_City', vip: false }, conteos: { conexiones: 1, recibidas: 1, enviadas: 1 }, tieneTarjeta: true, perfilCompleto: true };
      if (p === '/api/connect/explore') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const sector = url.searchParams.get('sector') || '';
        const items = cards.filter(c => (!q || `${c.nombre} ${c.profesion} ${c.habilidades.join(' ')}`.toLowerCase().includes(q)) && (!sector || c.sector === sector) && (url.searchParams.get('membership') !== 'vip' || c.isVip)).map(c => ({ ...c, relacion: relOf(c.uid) }));
        return { ok: true, items, total: items.length, page: 1, pageSize: 24, hasMore: false, recomendados: q || sector ? [] : cards.filter(c => c.uid !== yo && !rel[c.uid]).slice(0, 3).map(c => ({ ...c, relacion: relOf(c.uid), afinidad: 3 })), advancedFilters: false };
      }
      if (p.startsWith('/api/connect/profile/') && method === 'GET') {
        const uid = decodeURIComponent(p.split('/').pop());
        const target = uid === 'me' ? yo : uid;
        const card = cards.find(c => c.uid === target); if (!card) throw Object.assign(new Error('Este perfil ya no está disponible.'), { status: 404 });
        return { ok: true, perfil: { ...card, ...perfilDemo, relacion: relOf(target), esPropia: target === yo, contactos: target === yo ? Object.entries(perfilDemo.medios).filter(([, m]) => m.valor).map(([medio, m]) => ({ medio, valor: m.valor, url: m.valor, alcance: m.alcance })) : contactosDe(target), tieneContactos: true } };
      }
      if (p === '/api/connect/profile' && method === 'PATCH') { Object.assign(perfilDemo, options.body || {}); return { ok: true, perfil: { ...cards[0], ...perfilDemo, relacion: { estado: 'self' }, esPropia: true, contactos: [] } }; }
      if (p.startsWith('/api/connect/contact/')) { const uid = decodeURIComponent(p.split('/').pop()); const card = cards.find(c => c.uid === uid) || {}; const items = contactosDe(uid); return { ok: true, items, conectado: rel[uid] === 'connected', viewerVip: false, nombre: card.nombre, foto: '', bloqueado: !items.length }; }
      if (p === '/api/connect/requests' && method === 'POST') {
        const to = options.body?.to;
        if (usadas >= limite) throw Object.assign(new Error(`Las cuentas gratuitas pueden enviar ${limite} solicitudes al día.`), { status: 429, code: 'daily-limit' });
        usadas += 1; rel[to] = 'sent';
        return { ok: true, relacion: { estado: 'sent' }, cuota: { limite, usadas, restantes: limite - usadas } };
      }
      if (p === '/api/connect/requests' && method === 'GET') {
        const map = estado => cards.filter(c => rel[c.uid] === estado).map(c => ({ ...c, relacion: { estado: estado === 'received' ? 'received' : 'sent', since: new Date(Date.now() - 3600e3).toISOString() } }));
        return { ok: true, recibidas: map('received'), enviadas: map('sent') };
      }
      const m = p.match(/^\/api\/connect\/requests\/([^/]+)\/(accept|reject|cancel)$/);
      if (m) { const uid = decodeURIComponent(m[1]); rel[uid] = m[2] === 'accept' ? 'connected' : undefined; return { ok: true, relacion: { estado: m[2] === 'accept' ? 'connected' : 'none' } }; }
      if (p === '/api/connect/connections') { const items = cards.filter(c => rel[c.uid] === 'connected').map(c => ({ ...c, relacion: { estado: 'connected', since: new Date(Date.now() - 86400e3 * 3).toISOString() }, tieneContactos: true })); return { ok: true, items, total: items.length }; }
      const r = p.match(/^\/api\/connect\/connections\/([^/]+)\/remove$/); if (r) { delete rel[decodeURIComponent(r[1])]; return { ok: true }; }
      const b = p.match(/^\/api\/connect\/(block|unblock)\/([^/]+)$/); if (b) { rel[decodeURIComponent(b[2])] = b[1] === 'block' ? 'blocked' : undefined; return { ok: true, relacion: { estado: b[1] === 'block' ? 'blocked' : 'none' } }; }
      if (p === '/api/connect/report') return { ok: true };
      if (p === '/api/connect/notifications') return { ok: true, items: [{ id: 'n1', tipo: 'connect-solicitud', titulo: 'Nueva solicitud de conexión', descripcion: 'Rodrigo Pérez quiere conectar contigo en ICADEM Connect.', tab: 'solicitudes', leida: false, createdAt: new Date(Date.now() - 1800e3).toISOString() }] };
      if (p === '/api/connect/notifications/read') return { ok: true };
      return { ok: true };
    }
    return { request };
  })();

  async function api(path, options) {
    if (esDemo()) return Demo.request(path, options);
    if (!window.ICADEMPlatform?.request) throw new Error('El servicio de ICADEM Connect no está disponible.');
    return window.ICADEMPlatform.request(path, options);
  }
  function mensajeError(error, fallback) {
    const data = error?.data || {};
    if (error?.code === 'daily-limit' || data.code === 'daily-limit') {
      const reinicio = data.reiniciaEn || error.reiniciaEn;
      return `${error.message}${reinicio ? ` Se reinicia ${horaLocal(reinicio)} h.` : ''}`;
    }
    return error?.message || fallback;
  }

  /* ───────────── armazón ───────────── */
  function render(container) {
    S.container = container;
    S.view = 'tabs';
    S.profileUid = null;
    const params = new URLSearchParams(window.location.search);
    const wanted = S.pendingTab || params.get('connect');
    if (['explorar', 'conexiones', 'solicitudes'].includes(wanted)) S.tab = wanted;
    S.pendingTab = null;
    if (params.has('connect')) {
      params.delete('connect');
      try { history.replaceState(null, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`); } catch (_) {}
    }
    container.innerHTML = `
      <div class="fade-up icx" id="icx-root">
        <section class="icx-hero">
          <div>
            <div class="icx-hero__brand"><span class="icx-hero__logo">${ic('i-users')}</span><div><h1>ICADEM Connect</h1><p class="icx-hero__sub">Tu red de contactos profesionales</p></div></div>
            <p class="icx-hero__desc">Descubre profesionales, amplía tu red y genera nuevas oportunidades de colaboración.</p>
          </div>
          <div class="icx-stats" id="icx-stats">
            <div class="icx-stat"><strong data-stat="conexiones">—</strong><small>Conexiones</small></div>
            <div class="icx-stat"><strong data-stat="recibidas">—</strong><small>Por responder</small></div>
            <div class="icx-stat icx-stat--quota" title="Solicitudes nuevas disponibles hoy"><strong data-stat="restantes">—</strong><small>Hoy disponibles</small></div>
          </div>
        </section>
        <div class="icx-tabs" role="tablist" id="icx-tabs">
          <button class="icx-tab" role="tab" data-tab="explorar">${ic('i-search')}<span>Explorar</span></button>
          <button class="icx-tab" role="tab" data-tab="conexiones">${ic('i-users')}<span class="icx-tab__long">Mis conexiones</span><span class="icx-tab__short">Conexiones</span></button>
          <button class="icx-tab" role="tab" data-tab="solicitudes">${ic('i-send')}<span>Solicitudes</span><span class="icx-tab__badge" data-badge="solicitudes" hidden>0</span></button>
        </div>
        <div id="icx-body"></div>
      </div>`;
    container.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => abrirTab(btn.dataset.tab)));
    cargarOverview();
    pintarTab();
    iniciarNotificaciones();
  }
  function abrirTab(tab) {
    S.tab = tab; S.view = 'tabs'; S.profileUid = null;
    pintarTab();
  }
  function pintarTab() {
    const root = S.container?.querySelector('#icx-root'); if (!root) return;
    root.querySelectorAll('[data-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === S.tab));
    const body = root.querySelector('#icx-body'); if (!body) return;
    if (S.view === 'perfil') return pintarPerfil(body);
    if (S.view === 'editor') return pintarEditor(body);
    if (S.tab === 'conexiones') return pintarConexiones(body);
    if (S.tab === 'solicitudes') return pintarSolicitudes(body);
    return pintarExplorar(body);
  }
  async function cargarOverview() {
    try {
      S.overview = await api('/api/connect/overview');
      actualizarStats();
    } catch (error) { console.warn('[connect overview]', error.message); }
  }
  function actualizarStats() {
    const root = S.container?.querySelector('#icx-root'); if (!root || !S.overview) return;
    const set = (key, value) => { const el = root.querySelector(`[data-stat="${key}"]`); if (el) el.textContent = value; };
    set('conexiones', S.overview.conteos?.conexiones ?? 0);
    set('recibidas', S.overview.conteos?.recibidas ?? 0);
    set('restantes', `${S.overview.cuota?.restantes ?? 0}/${S.overview.cuota?.limite ?? 0}`);
    const badge = root.querySelector('[data-badge="solicitudes"]');
    if (badge) { const n = S.overview.conteos?.recibidas || 0; badge.hidden = n === 0; badge.textContent = n; }
    root.querySelectorAll('[data-quota-note]').forEach(el => { el.innerHTML = quotaNota(); });
  }
  function quotaNota() {
    const c = S.overview?.cuota; if (!c) return '';
    const base = `${ic('i-send')}Te quedan <strong>${c.restantes}</strong> de ${c.limite} solicitudes nuevas hoy`;
    const vipHint = !c.vip ? ' · con membresía VIP envías hasta 10 al día' : '';
    return `${base}${vipHint}`;
  }

  /* ───────────── estados del botón ───────────── */
  function botonRelacion(card, ctx = 'card') {
    const r = card.relacion || { estado: 'none' };
    const uid = esc(card.uid);
    const sm = ctx === 'card' ? ' icx-btn--sm' : '';
    switch (r.estado) {
      case 'self': return `<button class="icx-btn icx-btn--secondary${sm}" data-act="editar-perfil">${ic('i-edit')}Editar mi perfil</button>`;
      case 'connected': return ctx === 'profile'
        ? `<button class="icx-btn icx-btn--primary" data-act="contactar" data-uid="${uid}">${ic('i-send')}Contactar</button><button class="icx-btn icx-btn--outline" disabled>${ic('i-check')}Conectados</button>`
        : `<button class="icx-btn icx-btn--outline${sm}" disabled>${ic('i-check')}Conectados</button>`;
      case 'sent': return `<button class="icx-btn icx-btn--outline${sm}" data-act="cancelar" data-uid="${uid}" title="Cancelar solicitud">${ic('i-clock')}Solicitud enviada</button>`;
      case 'received': return `<button class="icx-btn icx-btn--primary${sm}" data-act="responder" data-uid="${uid}">${ic('i-bell')}Responder solicitud</button>`;
      case 'blocked': return `<button class="icx-btn icx-btn--outline${sm}" data-act="desbloquear" data-uid="${uid}">Desbloquear</button>`;
      case 'cooldown': return `<button class="icx-btn icx-btn--outline${sm}" disabled title="${r.motivo === 'rechazada' ? 'La solicitud anterior no fue aceptada' : 'Podrás volver a enviar una solicitud más adelante'}">${r.motivo === 'rechazada' ? 'No disponible' : 'Disponible pronto'}</button>`;
      case 'unavailable': return `<button class="icx-btn icx-btn--outline${sm}" disabled>No recibe solicitudes</button>`;
      default: return `<button class="icx-btn icx-btn--primary${sm}" data-act="conectar" data-uid="${uid}">${ic('i-send')}Conectar</button>`;
    }
  }
  function estadoChip(card) {
    const r = card.relacion?.estado || 'none';
    if (r === 'connected') return `<span class="icx-state icx-state--connected">${ic('i-check-circle')}Conectados</span>`;
    if (r === 'sent') return `<span class="icx-state icx-state--sent">${ic('i-clock')}Solicitud enviada</span>`;
    if (r === 'received') return `<span class="icx-state icx-state--received">${ic('i-bell')}Te envió solicitud</span>`;
    if (r === 'self') return `<span class="icx-state">${ic('i-user')}Tu perfil</span>`;
    return '';
  }

  /* ───────────── tarjeta ───────────── */
  function tarjetaHTML(card, opts = {}) {
    const esMia = card.relacion?.estado === 'self';
    const meta = [];
    if (card.empresa) meta.push(`<span>${ic('i-briefcase')}<em>${esc(card.empresa)}</em></span>`);
    if (card.especialidad && card.especialidad !== card.profesion) meta.push(`<span>${ic('i-certificate')}<em>${esc(card.especialidad)}</em></span>`);
    if (card.ubicacion) meta.push(`<span>${ic('i-home')}<em>${esc(card.ubicacion)}</em></span>`);
    const skills = (card.habilidades || []).slice(0, 3);
    return `
      <article class="icx-card${card.isVip ? ' icx-card--vip' : ''}${esMia ? ' icx-card--self' : ''}" data-card="${esc(card.uid)}">
        ${esMia ? '<span class="icx-card__you">Tú</span>' : (opts.afinidad ? `<span class="icx-afinidad" title="Intereses en común">${esc(opts.afinidad)} en común</span>` : '')}
        <div class="icx-card__top">
          ${avatar(card)}
          <div class="icx-card__id">
            <div class="icx-card__name"><span>${esc(card.nombre)}</span>${card.isVip ? `<span class="icx-vip" title="Miembro VIP verificado">${ic('i-crown')}</span>` : ''}</div>
            <div class="icx-card__role">${esc(card.profesion || card.puesto || 'Profesional ICADEM')}</div>
          </div>
        </div>
        ${meta.length ? `<div class="icx-card__meta">${meta.join('')}</div>` : ''}
        ${skills.length ? `<div class="icx-tags">${skills.map(s => `<span class="icx-tag">${esc(s)}</span>`).join('')}</div>` : ''}
        ${estadoChip(card)}
        <div class="icx-card__actions">
          <button class="icx-btn icx-btn--outline icx-btn--sm" data-act="ver" data-uid="${esc(card.uid)}">${ic('i-user')}Ver perfil</button>
          ${botonRelacion(card, 'card')}
        </div>
      </article>`;
  }
  function filaHTML(card, acciones) {
    return `
      <div class="icx-row" data-card="${esc(card.uid)}">
        ${avatar(card, 'sm')}
        <div class="icx-row__body">
          <div class="icx-row__name"><span>${esc(card.nombre)}</span>${card.isVip ? `<span class="icx-vip" title="VIP verificado">${ic('i-crown')}</span>` : ''}</div>
          <div class="icx-row__sub">${esc([card.profesion || card.puesto, card.empresa].filter(Boolean).join(' · ') || 'Profesional ICADEM')}</div>
          ${card.relacion?.since ? `<div class="icx-row__time">${esc(card.relacion.estado === 'connected' ? 'Conectados ' : '')}${esc(tiempoRel(card.relacion.since))}</div>` : ''}
        </div>
        <div class="icx-row__actions">${acciones}</div>
      </div>`;
  }
  function vacio(icon, title, text, extra = '') {
    return `<div class="icx-empty"><span class="icx-empty__icon">${ic(icon)}</span><strong>${esc(title)}</strong><p>${esc(text)}</p>${extra}</div>`;
  }

  /* ───────────── acciones comunes ───────────── */
  function enlazarAcciones(scope) {
    scope.querySelectorAll('[data-act]').forEach(btn => {
      if (btn.__icx) return; btn.__icx = true;
      btn.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        const act = btn.dataset.act; const uid = btn.dataset.uid;
        if (act === 'ver') return abrirPerfil(uid);
        if (act === 'editar-perfil') return abrirEditor();
        if (act === 'conectar') return conectar(uid, btn);
        if (act === 'cancelar') return cancelar(uid, btn);
        if (act === 'responder') { S.tab = 'solicitudes'; S.view = 'tabs'; S.solicitudes.box = 'recibidas'; return pintarTab(); }
        if (act === 'aceptar') return responder(uid, 'accept', btn);
        if (act === 'rechazar') return responder(uid, 'reject', btn);
        if (act === 'contactar') return abrirContacto(uid);
        if (act === 'eliminar') return eliminarConexion(uid, btn);
        if (act === 'bloquear') return bloquear(uid);
        if (act === 'desbloquear') return desbloquear(uid);
        if (act === 'reportar') return reportar(uid);
      });
    });
    scope.querySelectorAll('[data-card]').forEach(card => {
      if (card.__icx) return; card.__icx = true;
      card.addEventListener('click', event => { if (event.target.closest('button,a')) return; abrirPerfil(card.dataset.card); });
    });
  }
  function ocupado(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.label = btn.innerHTML; btn.textContent = 'Un momento…'; } else if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }

  async function conectar(uid, btn) {
    if (!uidActual()) { toast('info', 'Inicia sesión', 'Crea tu cuenta gratuita para conectar.'); return; }
    ocupado(btn, true);
    try {
      const result = await api('/api/connect/requests', { method: 'POST', body: { to: uid } });
      aplicarRelacion(uid, result.relacion || { estado: 'sent' });
      if (result.cuota && S.overview) { S.overview.cuota = { ...S.overview.cuota, ...result.cuota }; S.overview.conteos.enviadas = (S.overview.conteos.enviadas || 0) + 1; actualizarStats(); }
      toast('success', 'Solicitud enviada', 'Te avisaremos cuando la respondan.');
      S.solicitudes.loaded = false;
    } catch (error) {
      const code = error?.data?.code || error?.code;
      if (code === 'respond-existing') { toast('info', 'Ya te envió una solicitud', 'Respóndela desde la pestaña Solicitudes.'); aplicarRelacion(uid, { estado: 'received' }); }
      else if (code === 'already-connected') { aplicarRelacion(uid, { estado: 'connected' }); }
      else if (code === 'already-sent') { aplicarRelacion(uid, { estado: 'sent' }); }
      else toast('error', 'No se envió la solicitud', mensajeError(error, 'Intenta de nuevo.'));
      ocupado(btn, false);
    }
  }
  async function cancelar(uid, btn) {
    const ok = await confirmar({ title: 'Cancelar solicitud', message: 'La persona dejará de ver tu solicitud. Podrás enviar otra más adelante.', okLabel: 'Cancelar solicitud', danger: true });
    if (!ok) return;
    ocupado(btn, true);
    try {
      const result = await api(`/api/connect/requests/${encodeURIComponent(uid)}/cancel`, { method: 'POST' });
      aplicarRelacion(uid, result.relacion || { estado: 'cooldown' });
      S.solicitudes.enviadas = S.solicitudes.enviadas.filter(c => c.uid !== uid);
      if (S.overview) { S.overview.conteos.enviadas = Math.max(0, (S.overview.conteos.enviadas || 1) - 1); actualizarStats(); }
      toast('success', 'Solicitud cancelada', '');
      if (S.tab === 'solicitudes' && S.view === 'tabs') pintarTab();
    } catch (error) { toast('error', 'No se pudo cancelar', mensajeError(error, '')); ocupado(btn, false); }
  }
  async function responder(uid, accion, btn) {
    ocupado(btn, true);
    try {
      const result = await api(`/api/connect/requests/${encodeURIComponent(uid)}/${accion}`, { method: 'POST' });
      const card = S.solicitudes.recibidas.find(c => c.uid === uid);
      S.solicitudes.recibidas = S.solicitudes.recibidas.filter(c => c.uid !== uid);
      if (accion === 'accept') {
        aplicarRelacion(uid, { estado: 'connected', since: new Date().toISOString() });
        if (card) { S.conexiones.items.unshift({ ...card, relacion: { estado: 'connected', since: new Date().toISOString() }, tieneContactos: true }); }
        S.conexiones.loaded = false;
        if (S.overview) { S.overview.conteos.conexiones = (S.overview.conteos.conexiones || 0) + 1; }
        toast('success', 'Conexión aceptada', `${card?.nombre || 'Ya están conectados'} · ahora puedes contactarle.`);
      } else {
        aplicarRelacion(uid, result.relacion || { estado: 'none' });
        toast('info', 'Solicitud rechazada', '');
      }
      if (S.overview) { S.overview.conteos.recibidas = Math.max(0, (S.overview.conteos.recibidas || 1) - 1); actualizarStats(); }
      if (S.view === 'tabs') pintarTab(); else if (S.view === 'perfil') abrirPerfil(uid);
      revisarNotificaciones();
    } catch (error) { toast('error', 'No se pudo responder', mensajeError(error, '')); ocupado(btn, false); }
  }
  async function eliminarConexion(uid, btn) {
    const ok = await confirmar({ title: 'Eliminar conexión', message: 'Dejarán de ver los medios de contacto reservados para conexiones. Podrán volver a conectar más adelante.', okLabel: 'Eliminar conexión', danger: true });
    if (!ok) return;
    ocupado(btn, true);
    try {
      await api(`/api/connect/connections/${encodeURIComponent(uid)}/remove`, { method: 'POST' });
      S.conexiones.items = S.conexiones.items.filter(c => c.uid !== uid);
      aplicarRelacion(uid, { estado: 'cooldown', motivo: 'reciente' });
      if (S.overview) { S.overview.conteos.conexiones = Math.max(0, (S.overview.conteos.conexiones || 1) - 1); actualizarStats(); }
      toast('success', 'Conexión eliminada', '');
      if (S.view === 'perfil') abrirPerfil(uid); else pintarTab();
    } catch (error) { toast('error', 'No se pudo eliminar', mensajeError(error, '')); ocupado(btn, false); }
  }
  async function bloquear(uid) {
    const ok = await confirmar({ title: 'Bloquear usuario', message: 'No podrá ver tu perfil ni enviarte solicitudes, y se eliminará cualquier conexión o solicitud entre ustedes. Puedes desbloquear después desde su perfil.', okLabel: 'Bloquear', danger: true });
    if (!ok) return;
    try {
      await api(`/api/connect/block/${encodeURIComponent(uid)}`, { method: 'POST' });
      S.conexiones.items = S.conexiones.items.filter(c => c.uid !== uid);
      S.solicitudes.recibidas = S.solicitudes.recibidas.filter(c => c.uid !== uid);
      S.solicitudes.enviadas = S.solicitudes.enviadas.filter(c => c.uid !== uid);
      S.explore.items = S.explore.items.filter(c => c.uid !== uid);
      S.explore.recomendados = S.explore.recomendados.filter(c => c.uid !== uid);
      toast('success', 'Usuario bloqueado', '');
      cargarOverview();
      if (S.view === 'perfil') abrirPerfil(uid); else pintarTab();
    } catch (error) { toast('error', 'No se pudo bloquear', mensajeError(error, '')); }
  }
  async function desbloquear(uid) {
    try {
      await api(`/api/connect/unblock/${encodeURIComponent(uid)}`, { method: 'POST' });
      aplicarRelacion(uid, { estado: 'none' });
      toast('success', 'Usuario desbloqueado', '');
      S.explore.revision += 1;
      if (S.view === 'perfil') abrirPerfil(uid); else pintarTab();
    } catch (error) { toast('error', 'No se pudo desbloquear', mensajeError(error, '')); }
  }
  function reportar(uid) {
    if (typeof Modal === 'undefined') return;
    const body = `
      <div class="icx" style="gap:10px">
        <div class="icx-field"><label>Motivo</label><select class="icx-select" id="icx-rep-motivo">${MOTIVOS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
        <div class="icx-field"><label>Detalles (opcional)</label><textarea class="icx-textarea" id="icx-rep-detalle" maxlength="500" placeholder="Cuéntanos qué ocurrió…"></textarea></div>
        <p class="icx-note">El equipo de ICADEM revisará el perfil. La persona reportada no recibe ningún aviso.</p>
      </div>`;
    const footer = document.createElement('div');
    footer.innerHTML = `<button class="btn btn--ghost" data-cancel>Cancelar</button><button class="btn btn--accent" data-ok>Enviar reporte</button>`;
    const m = Modal.open({ id: 'icx-report', title: 'Reportar perfil', subtitle: 'Ayúdanos a mantener la red profesional', icon: 'i-alert-circle', size: 'sm', body, footer });
    footer.querySelector('[data-cancel]').addEventListener('click', () => m.close());
    footer.querySelector('[data-ok]').addEventListener('click', async () => {
      const btn = footer.querySelector('[data-ok]'); btn.disabled = true;
      try {
        await api('/api/connect/report', { method: 'POST', body: { uid, motivo: document.getElementById('icx-rep-motivo').value, detalle: document.getElementById('icx-rep-detalle').value } });
        toast('success', 'Reporte enviado', 'Gracias por avisarnos.'); m.close();
      } catch (error) { toast('error', 'No se envió el reporte', mensajeError(error, '')); btn.disabled = false; }
    });
  }
  function aplicarRelacion(uid, relacion) {
    const apply = card => { if (card && card.uid === uid) card.relacion = { ...(card.relacion || {}), ...relacion }; };
    S.explore.items.forEach(apply); S.explore.recomendados.forEach(apply);
    if (S.perfil && S.perfil.uid === uid) S.perfil.relacion = { ...(S.perfil.relacion || {}), ...relacion };
    S.container?.querySelectorAll(`[data-card="${CSS.escape(uid)}"]`).forEach(el => {
      const card = S.explore.items.find(c => c.uid === uid) || S.explore.recomendados.find(c => c.uid === uid) || { uid, relacion };
      const actions = el.querySelector('.icx-card__actions');
      if (actions) { actions.innerHTML = `<button class="icx-btn icx-btn--outline icx-btn--sm" data-act="ver" data-uid="${esc(uid)}">${ic('i-user')}Ver perfil</button>${botonRelacion(card, 'card')}`; }
      const chip = el.querySelector('.icx-state'); const nuevo = estadoChip(card);
      if (chip) chip.outerHTML = nuevo; else if (nuevo && actions) actions.insertAdjacentHTML('beforebegin', nuevo);
      enlazarAcciones(el);
    });
  }

  /* ───────────── Explorar ───────────── */
  function pintarExplorar(body) {
    const e = S.explore;
    body.innerHTML = `
      <div class="icx-section">
        <div class="icx-toolbar">
          <label class="icx-search">${ic('i-search')}<input type="search" id="icx-q" placeholder="Buscar por nombre, profesión, especialidad o habilidad" value="${esc(e.q)}" autocomplete="off"></label>
          <button class="icx-btn icx-btn--outline" id="icx-filters-toggle" aria-expanded="${e.filtersOpen}">${ic('i-tools')}Filtros</button>
        </div>
        <div class="icx-filters" id="icx-filters" ${e.filtersOpen ? '' : 'hidden'}>
          <div class="icx-chips" id="icx-sectores">
            <button class="icx-chip${e.vip ? ' is-active' : ''}" data-vip="1">${ic('i-crown')}Solo VIP</button>
            <button class="icx-chip${!e.sector && !e.vip ? ' is-active' : ''}" data-sector="">Todos</button>
            ${SECTORES.map(s => `<button class="icx-chip${e.sector === s ? ' is-active' : ''}" data-sector="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
          ${esVip() || e.advanced ? `<div class="icx-filters__grid">
            <div class="icx-field"><label>Habilidad</label><input class="icx-input" id="icx-f-hab" value="${esc(e.habilidad)}" placeholder="Ej. Nómina, Excel, Litigio"></div>
            <div class="icx-field"><label>Ubicación</label><input class="icx-input" id="icx-f-ubi" value="${esc(e.ubicacion)}" placeholder="Ej. Puebla"></div>
            <div class="icx-field"><label>Empresa</label><input class="icx-input" id="icx-f-emp" value="${esc(e.empresa)}" placeholder="Ej. Despacho, universidad…"></div>
          </div>` : `<div class="icx-lock-hint">${ic('i-crown')}Los filtros por habilidad, ubicación y empresa son parte de la membresía VIP.</div>`}
        </div>
        <div class="icx-quota-note" data-quota-note>${quotaNota()}</div>
        <div id="icx-recomendados"></div>
        <div class="icx-section__head"><div><h2>Profesionales</h2><p id="icx-explore-count" class="icx-count">${e.total ? `${e.total} perfiles` : ''}</p></div></div>
        <div id="icx-explore-grid" class="icx-grid"></div>
        <div class="icx-more" id="icx-more"></div>
      </div>`;
    const input = body.querySelector('#icx-q');
    input.addEventListener('input', debounce(() => { e.q = input.value.trim(); e.page = 1; cargarExplorar(); }, 320));
    body.querySelector('#icx-filters-toggle').addEventListener('click', () => { e.filtersOpen = !e.filtersOpen; const f = body.querySelector('#icx-filters'); f.hidden = !e.filtersOpen; body.querySelector('#icx-filters-toggle').setAttribute('aria-expanded', String(e.filtersOpen)); });
    body.querySelectorAll('[data-sector]').forEach(chip => chip.addEventListener('click', () => { e.sector = chip.dataset.sector; e.vip = false; e.page = 1; body.querySelectorAll('#icx-sectores .icx-chip').forEach(c => c.classList.toggle('is-active', c === chip)); cargarExplorar(); }));
    body.querySelector('[data-vip]').addEventListener('click', () => { e.vip = !e.vip; e.sector = ''; e.page = 1; body.querySelectorAll('#icx-sectores .icx-chip').forEach(c => c.classList.toggle('is-active', c.dataset.vip ? e.vip : (!e.vip && c.dataset.sector === ''))); cargarExplorar(); });
    ['hab', 'ubi', 'emp'].forEach(key => {
      const el = body.querySelector(`#icx-f-${key}`); if (!el) return;
      el.addEventListener('input', debounce(() => { e.habilidad = body.querySelector('#icx-f-hab').value.trim(); e.ubicacion = body.querySelector('#icx-f-ubi').value.trim(); e.empresa = body.querySelector('#icx-f-emp').value.trim(); e.page = 1; cargarExplorar(); }, 350));
    });
    if (e.items.length && e.revision === e.loadedRevision) pintarExplorarResultados(); else cargarExplorar();
  }
  async function cargarExplorar(append) {
    const e = S.explore; const body = S.container?.querySelector('#icx-body'); if (!body) return;
    const grid = body.querySelector('#icx-explore-grid'); if (!grid) return;
    const revision = ++e.revision;
    e.loading = true;
    if (!append) grid.innerHTML = '<div class="icx-skeleton"><div></div><div></div><div></div></div>';
    const params = new URLSearchParams({ page: String(e.page), pageSize: '24' });
    if (e.q) params.set('q', e.q); if (e.sector) params.set('sector', e.sector); if (e.vip) params.set('membership', 'vip');
    if (e.habilidad) params.set('habilidad', e.habilidad); if (e.ubicacion) params.set('ubicacion', e.ubicacion); if (e.empresa) params.set('empresa', e.empresa);
    try {
      const data = await api(`/api/connect/explore?${params}`);
      if (revision !== e.revision) return;
      e.items = append ? e.items.concat(data.items || []) : (data.items || []);
      e.total = data.total || 0; e.hasMore = data.hasMore === true; e.advanced = data.advancedFilters === true;
      if (!append) e.recomendados = data.recomendados || [];
      e.loadedRevision = revision;
      pintarExplorarResultados(data.degraded);
    } catch (error) {
      if (revision !== e.revision) return;
      grid.innerHTML = vacio('i-alert-circle', 'No pudimos cargar los profesionales', mensajeError(error, 'Intenta de nuevo en unos segundos.'), `<button class="icx-btn icx-btn--outline icx-btn--sm" id="icx-retry">Reintentar</button>`);
      grid.querySelector('#icx-retry')?.addEventListener('click', () => cargarExplorar());
    } finally { e.loading = false; }
  }
  function pintarExplorarResultados(degraded) {
    const e = S.explore; const body = S.container?.querySelector('#icx-body'); if (!body) return;
    const grid = body.querySelector('#icx-explore-grid'); const rec = body.querySelector('#icx-recomendados'); const more = body.querySelector('#icx-more'); const count = body.querySelector('#icx-explore-count');
    if (!grid) return;
    if (count) count.textContent = `${e.total === 1 ? '1 perfil' : `${e.total} perfiles`}${degraded ? ' · última copia disponible' : ''}`;
    if (rec) {
      rec.innerHTML = e.recomendados.length ? `
        <div class="icx-section">
          <div class="icx-section__head"><div><h2>Sugerencias para ti</h2><p>Profesionales con sector, especialidad o habilidades en común.</p></div></div>
          <div class="icx-grid">${e.recomendados.map(c => tarjetaHTML(c, { afinidad: c.afinidad })).join('')}</div>
        </div>` : '';
    }
    grid.innerHTML = e.items.length ? e.items.map(c => tarjetaHTML(c)).join('')
      : vacio('i-search', e.q || e.sector || e.vip || e.habilidad || e.ubicacion || e.empresa ? 'Sin resultados' : 'Aún no hay perfiles', e.q || e.sector ? 'Prueba con otra búsqueda o quita los filtros.' : 'Sé de los primeros en completar tu perfil profesional.');
    if (more) {
      more.innerHTML = e.hasMore ? `<button class="icx-btn icx-btn--outline" id="icx-load-more">Cargar más</button>` : '';
      more.querySelector('#icx-load-more')?.addEventListener('click', () => { e.page += 1; cargarExplorar(true); });
    }
    enlazarAcciones(body);
  }

  /* ───────────── Mis conexiones ───────────── */
  function pintarConexiones(body) {
    const c = S.conexiones;
    body.innerHTML = `
      <div class="icx-section">
        <div class="icx-toolbar">
          <label class="icx-search">${ic('i-search')}<input type="search" id="icx-cq" placeholder="Buscar en mis conexiones" value="${esc(c.q)}" autocomplete="off"></label>
          <span class="icx-count" id="icx-c-count"></span>
        </div>
        <div id="icx-c-list" class="icx-grid icx-grid--list"></div>
      </div>`;
    body.querySelector('#icx-cq').addEventListener('input', debounce(ev => { c.q = ev.target.value.trim(); pintarConexionesLista(); }, 200));
    if (c.loaded) pintarConexionesLista(); else cargarConexiones();
  }
  async function cargarConexiones() {
    const list = S.container?.querySelector('#icx-c-list'); if (!list) return;
    list.innerHTML = '<div class="icx-skeleton"><div></div><div></div></div>';
    try {
      const data = await api('/api/connect/connections');
      S.conexiones.items = data.items || []; S.conexiones.loaded = true;
      pintarConexionesLista();
    } catch (error) { list.innerHTML = vacio('i-alert-circle', 'No pudimos cargar tus conexiones', mensajeError(error, '')); }
  }
  function pintarConexionesLista() {
    const list = S.container?.querySelector('#icx-c-list'); const count = S.container?.querySelector('#icx-c-count'); if (!list) return;
    const q = S.conexiones.q.toLowerCase();
    const items = S.conexiones.items.filter(card => !q || `${card.nombre} ${card.profesion} ${card.empresa} ${card.sector} ${(card.habilidades || []).join(' ')}`.toLowerCase().includes(q));
    if (count) count.textContent = `${items.length} ${items.length === 1 ? 'conexión' : 'conexiones'}`;
    list.innerHTML = items.length ? items.map(card => filaHTML(card, `
        <button class="icx-btn icx-btn--outline icx-btn--sm" data-act="ver" data-uid="${esc(card.uid)}">${ic('i-user')}Ver perfil</button>
        <button class="icx-btn icx-btn--primary icx-btn--sm" data-act="contactar" data-uid="${esc(card.uid)}">${ic('i-send')}Contactar</button>
        <button class="icx-btn icx-btn--ghost icx-btn--sm icx-btn--icon" data-act="eliminar" data-uid="${esc(card.uid)}" title="Eliminar conexión" aria-label="Eliminar conexión">${ic('i-trash')}</button>`)).join('')
      : vacio('i-users', q ? 'Sin coincidencias' : 'Todavía no tienes conexiones', q ? 'Prueba con otro nombre o profesión.' : 'Explora profesionales y envía tu primera solicitud de conexión.', q ? '' : `<button class="icx-btn icx-btn--primary icx-btn--sm" id="icx-go-explore">${ic('i-search')}Explorar profesionales</button>`);
    list.querySelector('#icx-go-explore')?.addEventListener('click', () => abrirTab('explorar'));
    enlazarAcciones(list);
  }

  /* ───────────── Solicitudes ───────────── */
  function pintarSolicitudes(body) {
    const s = S.solicitudes;
    const n = { recibidas: s.recibidas.length, enviadas: s.enviadas.length, pendientes: s.recibidas.length + s.enviadas.length };
    body.innerHTML = `
      <div class="icx-section">
        <div class="icx-subtabs" id="icx-boxes">
          <button class="icx-subtab${s.box === 'recibidas' ? ' is-active' : ''}" data-box="recibidas">Recibidas <span class="icx-subtab__n" data-n="recibidas">${n.recibidas}</span></button>
          <button class="icx-subtab${s.box === 'enviadas' ? ' is-active' : ''}" data-box="enviadas">Enviadas <span class="icx-subtab__n" data-n="enviadas">${n.enviadas}</span></button>
          <button class="icx-subtab${s.box === 'pendientes' ? ' is-active' : ''}" data-box="pendientes">Pendientes <span class="icx-subtab__n" data-n="pendientes">${n.pendientes}</span></button>
        </div>
        <div class="icx-quota-note" data-quota-note>${quotaNota()}</div>
        <div id="icx-s-list" class="icx-grid icx-grid--list"></div>
      </div>`;
    body.querySelectorAll('[data-box]').forEach(btn => btn.addEventListener('click', () => { s.box = btn.dataset.box; body.querySelectorAll('[data-box]').forEach(b => b.classList.toggle('is-active', b === btn)); pintarSolicitudesLista(); }));
    if (s.loaded) pintarSolicitudesLista(); else cargarSolicitudes();
  }
  async function cargarSolicitudes() {
    const list = S.container?.querySelector('#icx-s-list'); if (!list) return;
    list.innerHTML = '<div class="icx-skeleton"><div></div><div></div></div>';
    try {
      const data = await api('/api/connect/requests');
      S.solicitudes.recibidas = data.recibidas || []; S.solicitudes.enviadas = data.enviadas || []; S.solicitudes.loaded = true;
      if (S.overview) { S.overview.conteos.recibidas = S.solicitudes.recibidas.length; S.overview.conteos.enviadas = S.solicitudes.enviadas.length; actualizarStats(); }
      pintarSolicitudesLista();
    } catch (error) { list.innerHTML = vacio('i-alert-circle', 'No pudimos cargar tus solicitudes', mensajeError(error, '')); }
  }
  function pintarSolicitudesLista() {
    const list = S.container?.querySelector('#icx-s-list'); if (!list) return;
    const s = S.solicitudes;
    const body = S.container.querySelector('#icx-body');
    body.querySelectorAll('[data-n]').forEach(el => { el.textContent = el.dataset.n === 'pendientes' ? s.recibidas.length + s.enviadas.length : s[el.dataset.n].length; });
    const recibida = card => filaHTML(card, `
      <button class="icx-btn icx-btn--outline icx-btn--sm" data-act="ver" data-uid="${esc(card.uid)}">Ver perfil</button>
      <button class="icx-btn icx-btn--success icx-btn--sm" data-act="aceptar" data-uid="${esc(card.uid)}">${ic('i-check')}Aceptar</button>
      <button class="icx-btn icx-btn--ghost icx-btn--sm" data-act="rechazar" data-uid="${esc(card.uid)}">Rechazar</button>`);
    const enviada = card => filaHTML(card, `
      <button class="icx-btn icx-btn--outline icx-btn--sm" data-act="ver" data-uid="${esc(card.uid)}">Ver perfil</button>
      <span class="icx-state icx-state--sent">${ic('i-clock')}En espera</span>
      <button class="icx-btn icx-btn--ghost icx-btn--sm" data-act="cancelar" data-uid="${esc(card.uid)}">Cancelar</button>`);
    let html = '';
    if (s.box === 'recibidas') html = s.recibidas.length ? s.recibidas.map(recibida).join('') : vacio('i-bell', 'No tienes solicitudes por responder', 'Cuando alguien quiera conectar contigo aparecerá aquí.');
    else if (s.box === 'enviadas') html = s.enviadas.length ? s.enviadas.map(enviada).join('') : vacio('i-send', 'No tienes solicitudes enviadas', 'Explora profesionales y envía una solicitud para ampliar tu red.');
    else {
      const parts = [];
      if (s.recibidas.length) parts.push(`<div class="icx-section__head"><div><h2>Por responder</h2></div></div>${s.recibidas.map(recibida).join('')}`);
      if (s.enviadas.length) parts.push(`<div class="icx-section__head"><div><h2>En espera de respuesta</h2></div></div>${s.enviadas.map(enviada).join('')}`);
      html = parts.length ? parts.join('') : vacio('i-check-circle', 'Todo al día', 'No tienes solicitudes pendientes en ningún sentido.');
    }
    list.innerHTML = html;
    enlazarAcciones(list);
  }

  /* ───────────── Perfil (CV virtual) ───────────── */
  async function abrirPerfil(uid) {
    if (!uid) return;
    S.view = 'perfil'; S.profileUid = uid; S.perfil = null;
    pintarTab();
    try {
      const data = await api(`/api/connect/profile/${encodeURIComponent(uid === uidActual() ? 'me' : uid)}`);
      if (S.view !== 'perfil' || S.profileUid !== uid) return;
      S.perfil = data.perfil; pintarTab();
    } catch (error) {
      const body = S.container?.querySelector('#icx-body');
      if (body && S.view === 'perfil') body.innerHTML = `<button class="icx-back" id="icx-back">${ic('i-arrow-right')}Volver</button>${vacio('i-alert-circle', 'Perfil no disponible', mensajeError(error, 'Este perfil ya no está disponible.'))}`;
      body?.querySelector('#icx-back')?.addEventListener('click', () => { S.view = 'tabs'; pintarTab(); });
    }
  }
  function pintarPerfil(body) {
    const p = S.perfil;
    const back = `<button class="icx-back" id="icx-back">${ic('i-arrow-right')}Volver a ${S.tab === 'conexiones' ? 'mis conexiones' : S.tab === 'solicitudes' ? 'solicitudes' : 'explorar'}</button>`;
    if (!p) { body.innerHTML = `${back}<div class="icx-skeleton"><div style="height:140px;grid-column:1/-1"></div></div>`; body.querySelector('#icx-back').addEventListener('click', () => { S.view = 'tabs'; pintarTab(); }); return; }
    const esMia = p.esPropia === true;
    const sub = [p.profesion || p.puesto, p.empresa].filter(Boolean).join(' · ');
    const meta = [];
    if (p.especialidad) meta.push(`<span>${ic('i-certificate')}<em>${esc(p.especialidad)}</em></span>`);
    if (p.ubicacion) meta.push(`<span>${ic('i-home')}<em>${esc(p.ubicacion)}</em></span>`);
    if (p.sector && p.sector !== p.especialidad) meta.push(`<span>${ic('i-briefcase')}<em>${esc(p.sector)}</em></span>`);
    const exp = (p.experiencia || []).map(e => `<div class="icx-item"><div><strong>${esc(e.cargo || 'Cargo')}</strong><span>${esc(e.empresa || '')}</span><small>${esc([e.inicio, e.actual ? 'Actual' : e.fin].filter(Boolean).join(' – '))}</small>${e.descripcion ? `<p>${esc(e.descripcion)}</p>` : ''}</div></div>`).join('');
    const edu = (p.formacion || []).map(f => `<div class="icx-item"><div><strong>${esc(f.estudios || f.institucion)}</strong><span>${esc(f.estudios ? f.institucion : '')}${f.especialidad ? ` · ${esc(f.especialidad)}` : ''}</span><small>${esc(f.periodo || '')}</small></div></div>`).join('');
    const fi = p.formacionIcadem;
    const fiHTML = fi && (fi.cursos?.length || fi.certificados?.length) ? `
      <div class="icx-block">
        <div class="icx-block__head"><h3>${ic('i-certificate')}Formación en ICADEM</h3>${fi.areas?.length ? `<small>${esc(fi.areas.join(' · '))}</small>` : ''}</div>
        ${fi.cursos?.length ? `<div class="icx-timeline">${fi.cursos.map(c => `<div class="icx-item"><div><strong>${esc(c.titulo)}</strong><span>Curso completado${c.area ? ` · ${esc(c.area)}` : ''}</span></div></div>`).join('')}</div>` : ''}
        ${fi.certificados?.length ? `<div class="icx-tags">${fi.certificados.map(c => `<span class="icx-tag" title="Folio ${esc(c.folio)}">${ic('i-check')} ${esc(c.curso)}${c.year ? ` · ${esc(c.year)}` : ''}</span>`).join('')}</div>` : ''}
      </div>` : '';
    const contactosHTML = contactosBloque(p);
    body.innerHTML = `
      ${back}
      <div class="icx-profile">
        <div class="icx-profile__head">
          ${avatar(p, 'lg')}
          <div class="icx-profile__id">
            <div class="icx-profile__name"><span>${esc(p.nombre)}</span>${p.isVip ? `<span class="icx-vip" title="Miembro VIP verificado">${ic('i-crown')}</span>` : ''}</div>
            <div class="icx-profile__role">${esc(sub || 'Profesional ICADEM')}</div>
            ${meta.length ? `<div class="icx-card__meta">${meta.join('')}</div>` : ''}
            ${estadoChip(p)}
          </div>
          <div class="icx-profile__actions">
            ${botonRelacion(p, 'profile')}
            ${esMia ? `<button class="icx-btn icx-btn--outline" id="icx-edit-basic">${ic('i-image')}Foto y datos básicos</button>` : `<div class="icx-profile__menu"><button class="icx-btn icx-btn--ghost" id="icx-menu-btn" aria-haspopup="true" aria-expanded="false">Más opciones</button>
              <div class="icx-menu" id="icx-menu" hidden>
                ${p.relacion?.estado === 'connected' ? `<button data-act="eliminar" data-uid="${esc(p.uid)}">${ic('i-trash')}Eliminar conexión</button>` : ''}
                ${p.relacion?.estado === 'blocked' ? `<button data-act="desbloquear" data-uid="${esc(p.uid)}">${ic('i-check')}Desbloquear</button>` : `<button class="is-danger" data-act="bloquear" data-uid="${esc(p.uid)}">${ic('i-x')}Bloquear</button>`}
                <button class="is-danger" data-act="reportar" data-uid="${esc(p.uid)}">${ic('i-alert-circle')}Reportar perfil</button>
              </div></div>`}
          </div>
        </div>
        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-user')}Acerca de mí</h3></div>
          ${p.acercaDe ? `<p>${esc(p.acercaDe)}</p>` : `<p class="icx-note">${esMia ? 'Escribe un resumen profesional desde "Editar mi perfil".' : 'Este profesional aún no agrega un resumen.'}</p>`}
        </div>
        <div class="icx-cols">
          <div class="icx-block">
            <div class="icx-block__head"><h3>${ic('i-briefcase')}Experiencia profesional</h3></div>
            ${exp ? `<div class="icx-timeline">${exp}</div>` : `<p class="icx-note">${esMia ? 'Agrega tus cargos y empresas desde "Editar mi perfil".' : 'Sin experiencia registrada.'}</p>`}
          </div>
          <div class="icx-block">
            <div class="icx-block__head"><h3>${ic('i-book')}Formación académica</h3></div>
            ${edu ? `<div class="icx-timeline">${edu}</div>` : `<p class="icx-note">${esMia ? 'Agrega tus estudios desde "Editar mi perfil".' : 'Sin formación registrada.'}</p>`}
          </div>
        </div>
        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-bolt')}Habilidades</h3></div>
          ${(p.habilidades || []).length ? `<div class="icx-tags">${p.habilidades.map(h => `<span class="icx-tag">${esc(h)}</span>`).join('')}</div>` : `<p class="icx-note">${esMia ? 'Agrega tus competencias desde "Editar mi perfil".' : 'Sin habilidades registradas.'}</p>`}
        </div>
        ${fiHTML}
        ${contactosHTML}
      </div>`;
    body.querySelector('#icx-back').addEventListener('click', () => { S.view = 'tabs'; pintarTab(); });
    body.querySelector('#icx-edit-basic')?.addEventListener('click', () => { if (typeof window.__dirEditar === 'function') window.__dirEditar(); else toast('info', 'Edita tu tarjeta', 'Desde Mi perfil → Mi tarjeta del directorio.'); });
    const menuBtn = body.querySelector('#icx-menu-btn'); const menu = body.querySelector('#icx-menu');
    if (menuBtn && menu) {
      menuBtn.addEventListener('click', ev => { ev.stopPropagation(); menu.hidden = !menu.hidden; menuBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
      document.addEventListener('click', () => { if (menu.isConnected) menu.hidden = true; }, { once: true });
    }
    enlazarAcciones(body);
  }
  function contactosBloque(p) {
    const items = p.contactos || [];
    const esMia = p.esPropia === true;
    const conectado = p.relacion?.estado === 'connected';
    let inner;
    if (items.length) {
      inner = `<div class="icx-contacts">${items.map(contactoHTML).join('')}</div>${esMia ? `<p class="icx-note">Así es como lo verán tus conexiones. Administra cada medio desde "Editar mi perfil".</p>` : ''}`;
    } else if (esMia) {
      inner = `<p class="icx-note">Aún no registras medios de contacto. Agrégalos desde "Editar mi perfil" y decide quién puede verlos.</p>`;
    } else if (p.tieneContactos && !conectado) {
      const texto = p.relacion?.estado === 'received'
        ? `Los medios de contacto se habilitan cuando aceptes la solicitud de ${esc(p.nombre)}.`
        : p.relacion?.estado === 'sent'
          ? `Los medios de contacto se habilitan cuando ${esc(p.nombre)} acepte tu solicitud.`
          : `Los medios de contacto se habilitan al conectar con ${esc(p.nombre)}.`;
      inner = `<div class="icx-private">${ic('i-shield-check')}<span>${texto}</span></div>`;
    } else {
      inner = `<p class="icx-note">Este profesional no comparte medios de contacto por ahora.</p>`;
    }
    return `<div class="icx-block"><div class="icx-block__head"><h3>${ic('i-send')}Medios de contacto</h3>${conectado ? '<small>Conexión aceptada</small>' : ''}</div>${inner}</div>`;
  }
  function contactoHTML(item) {
    const def = MEDIOS.find(m => m.id === item.medio) || { nombre: item.medio, icono: 'i-link', clase: 'web' };
    const label = item.medio === 'whatsapp' ? `+${item.valor}` : item.medio === 'instagram' ? `@${String(item.url).split('/').filter(Boolean).pop()}` : String(item.valor).replace(/^https?:\/\/(www\.)?/, '');
    const href = item.medio === 'email' ? `mailto:${item.valor}` : item.url;
    return `<a class="icx-contact icx-contact--${def.clase}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${ic(def.icono)}<span><small>${esc(def.nombre)}</small>${esc(label)}</span></a>`;
  }
  async function abrirContacto(uid) {
    if (typeof Modal === 'undefined') return abrirPerfil(uid);
    const bodyEl = document.createElement('div');
    bodyEl.className = 'icx';
    bodyEl.innerHTML = '<div class="icx-skeleton"><div style="height:60px"></div><div style="height:60px"></div></div>';
    const m = Modal.open({ id: 'icx-contact', title: 'Contactar', subtitle: 'Medios externos autorizados', icon: 'i-send', size: 'sm', body: bodyEl });
    try {
      const data = await api(`/api/connect/contact/${encodeURIComponent(uid)}`);
      const items = data.items || [];
      bodyEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">${avatar({ foto: data.foto, nombre: data.nombre }, 'sm')}<div><strong style="font-size:14px">${esc(data.nombre || '')}</strong><div class="icx-note">${data.conectado ? 'Conexión aceptada' : data.viewerVip ? 'Medios públicos (beneficio VIP)' : 'Sin conexión'}</div></div></div>
        ${items.length ? `<div class="icx-sheet-list">${items.map(contactoHTML).join('')}</div><p class="icx-note">Cada botón abre la aplicación o el sitio externo. ICADEM Connect no envía mensajes por ti.</p>`
          : data.bloqueado ? `<div class="icx-private">${ic('i-shield-check')}<span>Los medios de contacto se habilitan cuando ${esc(data.nombre || 'la persona')} acepte tu solicitud.</span></div>`
          : '<p class="icx-note">Este profesional no comparte medios de contacto por ahora.</p>'}`;
    } catch (error) { bodyEl.innerHTML = vacio('i-alert-circle', 'No disponible', mensajeError(error, '')); }
  }

  /* ───────────── Editor del perfil profesional ───────────── */
  async function abrirEditor() {
    if (!uidActual()) { toast('info', 'Inicia sesión', ''); return; }
    S.view = 'editor'; S.editorDraft = null; pintarTab();
    try {
      const data = await api('/api/connect/profile/me');
      const p = data.perfil || {};
      S.editorDraft = {
        acercaDe: p.acercaDe || '', experiencia: (p.experiencia || []).map(e => ({ ...e })), formacion: (p.formacion || []).map(f => ({ ...f })),
        habilidades: (p.habilidades || []).slice(), medios: p.medios || {}, privacidad: p.privacidad || {}, nombre: p.nombre, foto: p.foto, fotoOrigen: p.fotoOrigen, profesion: p.profesion, empresa: p.empresa
      };
      if (S.view === 'editor') pintarTab();
    } catch (error) {
      const body = S.container?.querySelector('#icx-body');
      if (body) body.innerHTML = `<button class="icx-back" id="icx-back">${ic('i-arrow-right')}Volver</button>${vacio('i-alert-circle', 'No pudimos abrir tu perfil', mensajeError(error, ''), error?.data?.code === 'card-missing' ? `<button class="icx-btn icx-btn--primary icx-btn--sm" id="icx-make-card">Crear mi tarjeta</button>` : '')}`;
      body?.querySelector('#icx-back')?.addEventListener('click', () => { S.view = 'tabs'; pintarTab(); });
      body?.querySelector('#icx-make-card')?.addEventListener('click', () => window.__dirEditar?.());
    }
  }
  function pintarEditor(body) {
    const d = S.editorDraft;
    const back = `<button class="icx-back" id="icx-back">${ic('i-arrow-right')}Volver</button>`;
    if (!d) { body.innerHTML = `${back}<div class="icx-skeleton"><div style="height:140px;grid-column:1/-1"></div></div>`; body.querySelector('#icx-back').addEventListener('click', () => { S.view = 'tabs'; pintarTab(); }); return; }
    const sw = (key, label, hint, value) => `<label class="icx-switch"><div><strong>${esc(label)}</strong><small>${esc(hint)}</small></div><button type="button" class="icx-toggle${value ? ' is-on' : ''}" data-switch="${key}" role="switch" aria-checked="${value}" aria-label="${esc(label)}"></button></label>`;
    const priv = d.privacidad || {};
    body.innerHTML = `
      ${back}
      <div class="icx-editor">
        <div class="icx-profile__head">
          ${avatar(d, 'lg')}
          <div class="icx-profile__id"><div class="icx-profile__name"><span>${esc(d.nombre || '')}</span></div><div class="icx-profile__role">${esc([d.profesion, d.empresa].filter(Boolean).join(' · ') || 'Completa tu profesión en la tarjeta')}</div><p class="icx-note">La foto, el nombre, la profesión y la empresa son los de tu tarjeta del Directorio VIP: cambian desde ahí y se reflejan aquí al instante.</p></div>
          <div class="icx-profile__actions"><button class="icx-btn icx-btn--outline" id="icx-edit-basic">${ic('i-image')}Foto y datos básicos</button></div>
        </div>

        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-user')}Acerca de mí</h3><small>Máx. 600 caracteres</small></div>
          <textarea class="icx-textarea" id="icx-e-acerca" maxlength="600" placeholder="Resume tu experiencia, en qué te especializas y qué tipo de colaboraciones buscas.">${esc(d.acercaDe)}</textarea>
        </div>

        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-briefcase')}Experiencia profesional</h3><button class="icx-btn icx-btn--secondary icx-btn--sm" id="icx-add-exp">${ic('i-edit')}Agregar</button></div>
          <div id="icx-exp-list" class="icx-editor__row"></div>
        </div>

        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-book')}Formación académica</h3><button class="icx-btn icx-btn--secondary icx-btn--sm" id="icx-add-edu">${ic('i-edit')}Agregar</button></div>
          <div id="icx-edu-list" class="icx-editor__row"></div>
        </div>

        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-bolt')}Habilidades</h3><small>Hasta 15 · Enter para agregar</small></div>
          <div class="icx-tag-input" id="icx-skills"></div>
        </div>

        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-certificate')}Formación en ICADEM</h3><small>Datos reales de tu cuenta</small></div>
          ${sw('compartirCursos', 'Mostrar cursos completados', 'Solo los cursos que ya terminaste en ICADEM.', priv.compartirCursos === true)}
          ${sw('compartirCertificados', 'Mostrar certificados obtenidos', 'Certificados emitidos por ICADEM con folio verificable.', priv.compartirCertificados === true)}
        </div>

        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-send')}Medios de contacto</h3><small>Quién puede verlos</small></div>
          <p class="icx-note">“Público”: lo ven los miembros VIP del directorio. “Solo mis conexiones”: se habilita al aceptar una conexión. “Oculto”: nadie lo ve.</p>
          <div class="icx-sheet-list" id="icx-medios"></div>
        </div>

        <div class="icx-block">
          <div class="icx-block__head"><h3>${ic('i-shield-check')}Privacidad del perfil</h3></div>
          ${sw('buscable', 'Mostrar mi perfil en búsquedas', 'Si lo ocultas, solo tus conexiones podrán verlo.', priv.buscable !== false)}
          ${sw('aceptaSolicitudes', 'Permitir nuevas solicitudes', 'Desactívalo si por ahora no quieres recibir solicitudes.', priv.aceptaSolicitudes !== false)}
          ${sw('mostrarUbicacion', 'Compartir ubicación general', 'La ciudad o región de tu tarjeta.', priv.mostrarUbicacion !== false)}
          ${sw('mostrarEmpresa', 'Mostrar empresa', 'La empresa registrada en tu tarjeta.', priv.mostrarEmpresa !== false)}
          ${sw('mostrarFormacion', 'Mostrar formación académica', 'Tus estudios registrados arriba.', priv.mostrarFormacion !== false)}
        </div>

        <div class="icx-editor__footer">
          <button class="icx-btn icx-btn--ghost" id="icx-e-cancel">Cancelar</button>
          <button class="icx-btn icx-btn--primary" id="icx-e-save">${ic('i-check')}Guardar perfil</button>
        </div>
      </div>`;
    body.querySelector('#icx-back').addEventListener('click', () => { S.view = 'tabs'; pintarTab(); });
    body.querySelector('#icx-e-cancel').addEventListener('click', () => { S.view = 'tabs'; pintarTab(); });
    body.querySelector('#icx-edit-basic').addEventListener('click', () => window.__dirEditar?.());
    body.querySelector('#icx-e-acerca').addEventListener('input', ev => { d.acercaDe = ev.target.value; });
    body.querySelectorAll('[data-switch]').forEach(btn => btn.addEventListener('click', () => { const on = !btn.classList.contains('is-on'); btn.classList.toggle('is-on', on); btn.setAttribute('aria-checked', String(on)); d.privacidad[btn.dataset.switch] = on; }));
    body.querySelector('#icx-add-exp').addEventListener('click', () => { d.experiencia.push({ id: `exp-${Date.now()}`, cargo: '', empresa: '', inicio: '', fin: '', actual: false, descripcion: '' }); pintarExperiencia(body); });
    body.querySelector('#icx-add-edu').addEventListener('click', () => { d.formacion.push({ id: `edu-${Date.now()}`, institucion: '', estudios: '', especialidad: '', periodo: '' }); pintarFormacion(body); });
    body.querySelector('#icx-e-save').addEventListener('click', () => guardarEditor(body));
    pintarExperiencia(body); pintarFormacion(body); pintarSkills(body); pintarMedios(body);
  }
  function campo(label, value, attrs) { return `<div class="icx-field"><label>${esc(label)}</label><input class="icx-input" value="${esc(value || '')}" ${attrs}></div>`; }
  function pintarExperiencia(body) {
    const d = S.editorDraft; const list = body.querySelector('#icx-exp-list');
    list.innerHTML = d.experiencia.length ? d.experiencia.map((e, i) => `
      <div class="icx-editor__item" data-i="${i}">
        <div class="icx-editor__item-head"><span>Experiencia ${i + 1}</span><button type="button" class="icx-btn icx-btn--ghost icx-btn--sm" data-remove="${i}">${ic('i-trash')}Quitar</button></div>
        ${campo('Cargo', e.cargo, `data-k="cargo" maxlength="90" placeholder="Ej. Jefe de contabilidad"`)}
        ${campo('Empresa', e.empresa, `data-k="empresa" maxlength="90" placeholder="Ej. Despacho Contable"`)}
        <div class="icx-editor__row" style="grid-template-columns:1fr 1fr">${campo('Inicio', e.inicio, `data-k="inicio" maxlength="20" placeholder="2021"`)}${campo('Fin', e.fin, `data-k="fin" maxlength="20" placeholder="2024" ${e.actual ? 'disabled' : ''}`)}</div>
        <label class="icx-note" style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-k="actual" ${e.actual ? 'checked' : ''}> Trabajo actual</label>
        <div class="icx-field"><label>Responsabilidades</label><textarea class="icx-textarea" data-k="descripcion" maxlength="280" rows="2" placeholder="Breve descripción">${esc(e.descripcion || '')}</textarea></div>
      </div>`).join('') : '<p class="icx-note">Aún no agregas experiencia.</p>';
    list.querySelectorAll('[data-i]').forEach(item => {
      const i = Number(item.dataset.i);
      item.querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => { d.experiencia[i][el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.k === 'actual') { const fin = item.querySelector('[data-k="fin"]'); fin.disabled = el.checked; if (el.checked) { fin.value = ''; d.experiencia[i].fin = ''; } } }));
    });
    list.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => { d.experiencia.splice(Number(btn.dataset.remove), 1); pintarExperiencia(body); }));
  }
  function pintarFormacion(body) {
    const d = S.editorDraft; const list = body.querySelector('#icx-edu-list');
    list.innerHTML = d.formacion.length ? d.formacion.map((f, i) => `
      <div class="icx-editor__item" data-i="${i}">
        <div class="icx-editor__item-head"><span>Formación ${i + 1}</span><button type="button" class="icx-btn icx-btn--ghost icx-btn--sm" data-remove="${i}">${ic('i-trash')}Quitar</button></div>
        ${campo('Institución', f.institucion, `data-k="institucion" maxlength="120" placeholder="Ej. BUAP"`)}
        ${campo('Estudios', f.estudios, `data-k="estudios" maxlength="120" placeholder="Ej. Licenciatura en Contaduría"`)}
        ${campo('Especialidad', f.especialidad, `data-k="especialidad" maxlength="120" placeholder="Opcional"`)}
        ${campo('Periodo o año', f.periodo, `data-k="periodo" maxlength="40" placeholder="Ej. 2012–2016"`)}
      </div>`).join('') : '<p class="icx-note">Aún no agregas formación académica.</p>';
    list.querySelectorAll('[data-i]').forEach(item => { const i = Number(item.dataset.i); item.querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => { d.formacion[i][el.dataset.k] = el.value; })); });
    list.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => { d.formacion.splice(Number(btn.dataset.remove), 1); pintarFormacion(body); }));
  }
  function pintarSkills(body) {
    const d = S.editorDraft; const box = body.querySelector('#icx-skills');
    box.innerHTML = `${d.habilidades.map((h, i) => `<span class="icx-tag icx-tag--removable">${esc(h)}<button type="button" data-remove="${i}" aria-label="Quitar ${esc(h)}">${ic('i-x')}</button></span>`).join('')}<input id="icx-skill-input" maxlength="40" placeholder="${d.habilidades.length >= 15 ? 'Límite alcanzado' : 'Ej. Nómina, Litigio, Excel…'}" ${d.habilidades.length >= 15 ? 'disabled' : ''}>`;
    const input = box.querySelector('#icx-skill-input');
    const add = () => { const v = input.value.trim().replace(/,+$/, ''); if (!v) return; if (d.habilidades.some(h => h.toLowerCase() === v.toLowerCase())) { input.value = ''; return; } if (d.habilidades.length >= 15) return; d.habilidades.push(v); pintarSkills(body); body.querySelector('#icx-skill-input')?.focus(); };
    input.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ',') { ev.preventDefault(); add(); } if (ev.key === 'Backspace' && !input.value && d.habilidades.length) { d.habilidades.pop(); pintarSkills(body); body.querySelector('#icx-skill-input')?.focus(); } });
    input.addEventListener('blur', add);
    box.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => { d.habilidades.splice(Number(btn.dataset.remove), 1); pintarSkills(body); }));
  }
  function pintarMedios(body) {
    const d = S.editorDraft; const list = body.querySelector('#icx-medios');
    list.innerHTML = MEDIOS.map(m => {
      const cur = d.medios[m.id] || { valor: '', alcance: 'oculto' };
      return `<div class="icx-medio" data-medio="${m.id}">
        <span class="icx-contact--${m.clase}" style="display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--icx-surface-2)">${ic(m.icono)}</span>
        <div class="icx-field"><label>${esc(m.nombre)}</label><input class="icx-input" data-valor value="${esc(cur.valor || '')}" placeholder="${esc(m.placeholder)}" maxlength="180"></div>
        <select class="icx-select" data-alcance aria-label="Visibilidad de ${esc(m.nombre)}">${Object.entries(ALCANCE_LABEL).map(([v, l]) => `<option value="${v}" ${cur.alcance === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-medio]').forEach(row => {
      const id = row.dataset.medio;
      if (!d.medios[id]) d.medios[id] = { valor: '', alcance: 'oculto' };
      row.querySelector('[data-valor]').addEventListener('input', ev => { d.medios[id].valor = ev.target.value; d.medios[id].dirty = true; });
      row.querySelector('[data-alcance]').addEventListener('change', ev => { d.medios[id].alcance = ev.target.value; d.medios[id].dirty = true; });
    });
  }
  async function guardarEditor(body) {
    const d = S.editorDraft; const btn = body.querySelector('#icx-e-save'); if (!d || !btn) return;
    btn.disabled = true; btn.textContent = 'Guardando…';
    const contactos = {};
    for (const m of MEDIOS) { const cur = d.medios[m.id]; if (!cur) continue; contactos[m.id] = { valor: String(cur.valor || '').trim(), alcance: cur.alcance || 'oculto' }; }
    try {
      await api('/api/connect/profile', { method: 'PATCH', body: { acercaDe: d.acercaDe, experiencia: d.experiencia, formacion: d.formacion, habilidades: d.habilidades, contactos, privacidad: d.privacidad } });
      toast('success', 'Perfil guardado', 'Tu CV profesional ya está actualizado.');
      S.explore.revision += 1; S.explore.items = []; S.conexiones.loaded = false;
      cargarOverview();
      abrirPerfil(uidActual());
    } catch (error) {
      toast('error', 'No se pudo guardar', mensajeError(error, 'Revisa los datos e intenta de nuevo.'));
      btn.disabled = false; btn.innerHTML = `${ic('i-check')}Guardar perfil`;
      const medio = error?.data?.medio; if (medio) body.querySelector(`[data-medio="${medio}"] [data-valor]`)?.focus();
    }
  }

  /* ───────────── notificaciones (campana + reutiliza el sistema del panel) ───────────── */
  const TIPO_ICONO = { 'connect-solicitud': { icono: 'i-users', color: '#1459C7' }, 'connect-aceptada': { icono: 'i-check-circle', color: '#0F9D58' } };
  function iniciarNotificaciones() {
    if (S.notifs.timer || !uidActual()) return;
    revisarNotificaciones();
    S.notifs.timer = setInterval(revisarNotificaciones, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarNotificaciones(); });
  }
  async function revisarNotificaciones() {
    if (!uidActual() || document.hidden) return;
    try {
      const data = await api('/api/connect/notifications');
      S.notifs.items = (data.items || []).map(n => {
        const preset = TIPO_ICONO[n.tipo] || { icono: 'i-bell', color: '#1459C7' };
        return { id: `cx-${n.id}`, cxId: n.id, tipo: n.tipo, icono: preset.icono, color: preset.color, titulo: n.titulo, descripcion: n.descripcion, createdAtMs: new Date(n.createdAt).getTime() || Date.now(), seccion: 'directorio', tab: n.tab || 'solicitudes', leida: n.leida === true };
      });
      fusionarEnCampana();
      const recibidas = S.notifs.items.filter(n => n.tipo === 'connect-solicitud' && !n.leida).length;
      if (S.overview && S.view === 'tabs' && S.tab !== 'solicitudes' && recibidas !== (S.overview.conteos?.recibidas || 0)) cargarOverview();
    } catch (error) { console.warn('[connect notif]', error.message); }
  }
  function fusionarEnCampana() {
    const state = window.__notifsState; if (!state) return;
    const otros = (state.items || []).filter(n => !String(n.id).startsWith('cx-'));
    state.items = [...S.notifs.items, ...otros].sort((a, b) => b.createdAtMs - a.createdAtMs);
    // Lo ya leído en el servidor no vuelve a marcar el punto rojo.
    const leidasLocal = typeof window.marcarNotifsLeidas === 'function' ? window.marcarNotifsLeidas : null;
    const yaLeidas = S.notifs.items.filter(n => n.leida).map(n => n.id);
    if (leidasLocal && yaLeidas.length) leidasLocal(yaLeidas);
    if (typeof window.actualizarBadgeNotif === 'function') window.actualizarBadgeNotif();
  }
  // El panel llama a esto al tocar un aviso de Connect en la campana.
  function abrirDesdeNotificacion(item) {
    const ids = item?.cxId ? [item.cxId] : S.notifs.items.filter(n => !n.leida).map(n => n.cxId);
    if (ids.length) api('/api/connect/notifications/read', { method: 'POST', body: { ids } }).catch(() => {});
    S.notifs.items.forEach(n => { if (ids.includes(n.cxId)) n.leida = true; });
    open(item?.tab || 'solicitudes');
  }
  function open(tab) {
    S.pendingTab = tab;
    S.solicitudes.loaded = false; S.conexiones.loaded = false;
    const enDirectorio = (typeof __seccionActualVIP !== 'undefined' && __seccionActualVIP === 'directorio') || location.hash === '#directorio';
    if (enDirectorio && S.container?.isConnected && S.container.querySelector('#icx-root')) { S.pendingTab = null; abrirTab(tab); return; }
    if (typeof window.navigateToSection === 'function') window.navigateToSection('directorio');
    else location.hash = '#directorio';
  }
  function cleanup() { /* los listeners viven dentro del contenedor; el sondeo sigue para la campana */ }

  window.ICADEMConnect = { render, open, openProfile: abrirPerfil, openEditor: abrirEditor, refreshNotifications: revisarNotificaciones, abrirDesdeNotificacion, cleanup, _state: S };
  document.addEventListener('icadem:identity-ready', () => { if (!S.notifs.timer) iniciarNotificaciones(); });
})();
