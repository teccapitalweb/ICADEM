/* ═══════════════════ ADMIN · ICADEM Connect ═══════════════════
   Límites diarios de solicitudes (gratuitos / VIP), zona horaria del
   reinicio, estadísticas de la red y moderación de reportes de perfiles.
   Fuentes: GET/PATCH /admin/connect/config · GET /admin/connect/stats ·
            GET /admin/connect/reports · POST /admin/connect/reports/:id/resolve
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WEBHOOK = window.WEBHOOK_URL || 'https://icadem-webhook-production.up.railway.app';
  const MOTIVOS = { spam: 'Spam o publicidad', suplantacion: 'Suplantación', 'contenido-inapropiado': 'Contenido inapropiado', acoso: 'Acoso', otro: 'Otro' };
  const notify = (type, title, msg) => { if (typeof Toast !== 'undefined') Toast[type](title, msg || ''); else console.log(type, title, msg); };

  async function token() {
    for (let i = 0; i < 60 && !(window._fb && window._fb.auth && window._fb.auth.currentUser); i++) await new Promise(r => setTimeout(r, 250));
    const u = window._fb && window._fb.auth && window._fb.auth.currentUser;
    return u ? u.getIdToken() : null;
  }
  async function api(path, options = {}) {
    const t = await token();
    const config = { method: options.method || 'GET', cache: 'no-store', headers: { Accept: 'application/json', Authorization: 'Bearer ' + t } };
    if (options.body !== undefined) { config.headers['Content-Type'] = 'application/json'; config.body = JSON.stringify(options.body); }
    const r = await fetch(WEBHOOK + path, config);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  const fecha = v => { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

  function render(p) {
    p.innerHTML = `
      <div class="fade-up">
        <div class="sec-hero">
          <span class="sec-hero__eyebrow">Comunidad</span>
          <h1 class="sec-hero__title">ICADEM Connect</h1>
          <p class="sec-hero__sub">Red profesional sobre el Directorio VIP: límites diarios de solicitudes, actividad de la red y reportes de perfiles.</p>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card" style="--c1:#1459C7;--c2:#8fbce6;"><div class="kpi-card__label">Conexiones aceptadas</div><div class="kpi-card__value" id="cx-k-aceptadas">—</div><div class="kpi-card__sub">Pares conectados</div></div>
          <div class="kpi-card" style="--c1:#F7941D;--c2:#FBBF24;"><div class="kpi-card__label">Solicitudes pendientes</div><div class="kpi-card__value" id="cx-k-pendientes">—</div><div class="kpi-card__sub">En espera de respuesta</div></div>
          <div class="kpi-card" style="--c1:#64748B;--c2:#94A3B8;"><div class="kpi-card__label">Bloqueos activos</div><div class="kpi-card__value" id="cx-k-bloqueos">—</div><div class="kpi-card__sub">Entre miembros</div></div>
          <div class="kpi-card" style="--c1:#DC2D3F;--c2:#F87171;"><div class="kpi-card__label">Reportes abiertos</div><div class="kpi-card__value" id="cx-k-reportes">—</div><div class="kpi-card__sub">Pendientes de revisar</div></div>
        </div>
        <div class="dash-grid" style="margin-top:18px">
          <div class="dash-card">
            <div class="dash-card__header"><div class="dash-card__title"><svg class="ic"><use href="#i-settings"/></svg>Límites diarios de solicitudes</div></div>
            <div class="form-grid">
              <div class="form-field"><label class="label">Cuentas gratuitas · por día</label><input type="number" class="input" id="cx-free" min="0" max="500" placeholder="Cargando…" disabled></div>
              <div class="form-field"><label class="label">Cuentas VIP · por día</label><input type="number" class="input" id="cx-vip" min="0" max="500" placeholder="Cargando…" disabled></div>
              <div class="form-field form-field--full"><label class="label">Zona horaria del reinicio</label><select class="input" id="cx-tz" disabled>
                ${['America/Mexico_City', 'America/Cancun', 'America/Tijuana', 'America/Hermosillo', 'America/Bogota', 'America/Lima', 'UTC'].map(z => `<option value="${z}">${z}</option>`).join('')}
              </select></div>
            </div>
            <div style="font-size:11.5px;color:var(--text-3);padding:10px 12px;background:color-mix(in srgb,var(--primary) 8%,var(--surface-2));border-left:3px solid var(--primary);border-radius:6px;line-height:1.55;margin:0 0 14px">El límite aplica a solicitudes <strong>nuevas</strong> (aceptar no descuenta). Cancelar una solicitud tampoco devuelve el cupo. Se guarda en Firestore <code>config/connect</code> y el servidor lo aplica al instante; el navegador no puede modificarlo.</div>
            <div class="form-actions"><button class="btn btn--accent" id="cx-save" disabled>Guardar límites<svg class="ic"><use href="#i-check"/></svg></button></div>
          </div>
          <div class="dash-card">
            <div class="dash-card__header"><div class="dash-card__title"><svg class="ic"><use href="#i-shield-check"/></svg>Reglas vigentes</div></div>
            <ul style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.7;color:var(--text-2)">
              <li>Sin chat interno: solo solicitudes y, al aceptar, medios externos (WhatsApp, LinkedIn, Instagram, Facebook, correo, web).</li>
              <li>Cada medio tiene alcance <em>público</em> (lo ven VIP), <em>solo conexiones</em> u <em>oculto</em>. El servidor nunca manda enlaces no autorizados.</li>
              <li>Una sola relación por par de cuentas: no hay duplicados ni solicitudes cruzadas.</li>
              <li>Rechazo: 30 días antes de volver a solicitar. Cancelación: 24 h. Conexión eliminada: 24 h / 7 días.</li>
              <li>Bloqueos y reportes quedan en la bitácora <code>connectAudit</code>.</li>
            </ul>
          </div>
        </div>
        <div class="dash-card" style="margin-top:18px">
          <div class="dash-card__header"><div class="dash-card__title"><svg class="ic"><use href="#i-alert-circle"/></svg>Reportes de perfiles</div>
            <div style="display:flex;gap:6px"><button class="btn btn--sm btn--ghost is-active" data-cx-status="abierto">Abiertos</button><button class="btn btn--sm btn--ghost" data-cx-status="resuelto">Resueltos</button></div></div>
          <div id="cx-reports"><div class="empty-state">Cargando reportes…</div></div>
        </div>
      </div>`;
    cargarConfig(p); cargarStats(p); cargarReportes(p, 'abierto');
    p.querySelectorAll('[data-cx-status]').forEach(btn => btn.addEventListener('click', () => { p.querySelectorAll('[data-cx-status]').forEach(b => b.classList.toggle('is-active', b === btn)); cargarReportes(p, btn.dataset.cxStatus); }));
    p.querySelector('#cx-save').addEventListener('click', () => guardarConfig(p));
  }
  async function cargarConfig(p) {
    try {
      const { config } = await api('/admin/connect/config');
      const free = p.querySelector('#cx-free'), vip = p.querySelector('#cx-vip'), tz = p.querySelector('#cx-tz');
      free.value = config.freeDailyLimit; vip.value = config.vipDailyLimit;
      if (![...tz.options].some(o => o.value === config.timezone)) tz.add(new Option(config.timezone, config.timezone));
      tz.value = config.timezone;
      [free, vip, tz, p.querySelector('#cx-save')].forEach(el => { el.disabled = false; });
    } catch (e) { notify('error', 'No se pudo leer la configuración', e.message); }
  }
  async function guardarConfig(p) {
    const btn = p.querySelector('#cx-save'); btn.disabled = true;
    try {
      const body = { freeDailyLimit: Number(p.querySelector('#cx-free').value), vipDailyLimit: Number(p.querySelector('#cx-vip').value), timezone: p.querySelector('#cx-tz').value };
      const { config } = await api('/admin/connect/config', { method: 'PATCH', body });
      notify('success', 'Límites guardados', `Gratuitos ${config.freeDailyLimit} · VIP ${config.vipDailyLimit} · ${config.timezone}`);
    } catch (e) { notify('error', 'No se guardó', e.message); }
    btn.disabled = false;
  }
  async function cargarStats(p) {
    try {
      const s = await api('/admin/connect/stats');
      const set = (id, v) => { const el = p.querySelector('#' + id); if (el) el.textContent = v == null ? '—' : v; };
      set('cx-k-aceptadas', s.aceptadas); set('cx-k-pendientes', s.pendientes); set('cx-k-bloqueos', s.bloqueos); set('cx-k-reportes', s.reportesAbiertos);
    } catch (e) { console.warn('[connect stats]', e.message); }
  }
  async function cargarReportes(p, status) {
    const box = p.querySelector('#cx-reports'); if (!box) return;
    box.innerHTML = '<div class="empty-state">Cargando reportes…</div>';
    try {
      const { items } = await api('/admin/connect/reports?status=' + encodeURIComponent(status));
      if (!items.length) { box.innerHTML = `<div class="empty-state">${status === 'abierto' ? 'No hay reportes pendientes. 🎉' : 'Sin reportes resueltos todavía.'}</div>`; return; }
      box.innerHTML = `<div class="foro-admin-list">${items.map(r => `
        <div class="dir-adm-card" data-report="${esc(r.id)}">
          <div class="dir-adm-card__main">
            <div class="dir-adm-card__head"><span class="dir-adm-card__name">${esc(r.reported.nombre)}</span><span class="tag-mini ${r.status === 'abierto' ? '' : 'tag-mini--admin'}">${esc(MOTIVOS[r.motivo] || r.motivo)}</span>${r.reported.visible === false ? '<span class="tag-mini" style="background:rgba(150,150,150,.18);color:#999;">Perfil oculto</span>' : ''}</div>
            <div class="dir-adm-card__sub">Reportado por ${esc(r.reporter.nombre)} · ${esc(fecha(r.createdAt))}${r.resolvedAt ? ` · Resuelto ${esc(fecha(r.resolvedAt))} (${esc(r.accion || '')}) por ${esc(r.resolvedBy || '')}` : ''}</div>
            ${r.detalle ? `<div class="dir-adm-card__bio">${esc(r.detalle)}</div>` : ''}
            <div class="dir-adm-card__meta" style="font-family:monospace;font-size:10.5px">UID: ${esc(r.reported.uid)}</div>
          </div>
          ${r.status === 'abierto' ? `<div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn--sm btn--ghost" data-resolve="descartar">Descartar</button>
            <button class="btn btn--sm btn--ghost" data-resolve="ocultar-perfil" style="color:var(--danger)">Ocultar perfil</button>
          </div>` : (r.accion === 'ocultar-perfil' && r.reported.visible === false ? `<button class="btn btn--sm btn--ghost" data-resolve="restaurar-perfil">Restaurar perfil</button>` : '')}
        </div>`).join('')}</div>`;
      box.querySelectorAll('[data-resolve]').forEach(btn => btn.addEventListener('click', async () => {
        const card = btn.closest('[data-report]'); const id = card.dataset.report; const accion = btn.dataset.resolve;
        if (accion === 'ocultar-perfil') { const ok = typeof adminConfirm === 'function' ? await adminConfirm('¿Ocultar este perfil de ICADEM Connect?', 'Dejará de aparecer en búsquedas y nadie podrá enviarle solicitudes. Puedes restaurarlo después.') : window.confirm('¿Ocultar este perfil?'); if (!ok) return; }
        btn.disabled = true;
        try { await api('/admin/connect/reports/' + encodeURIComponent(id) + '/resolve', { method: 'POST', body: { accion } }); notify('success', 'Reporte resuelto', accion); cargarReportes(p, status); cargarStats(p); }
        catch (e) { notify('error', 'No se pudo resolver', e.message); btn.disabled = false; }
      }));
    } catch (e) { box.innerHTML = `<div class="empty-state">No se pudieron cargar los reportes: ${esc(e.message)}</div>`; }
  }

  if (typeof Pages !== 'undefined') Pages.connect = p => render(p);
  window.ICADEMAdminConnect = { render };
})();
