/* ICADEM Admin · Marketing: diagnósticos del index y campaña de conversión. */
(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function num(value) { return Number(value || 0).toLocaleString('es-MX'); }
  function when(value) {
    if (!value) return '—';
    var date = typeof value === 'number' ? new Date(value) : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function api(options, path, init) {
    return options.getToken().then(function (token) {
      var config = Object.assign({}, init || {});
      config.headers = Object.assign({ Authorization: 'Bearer ' + token }, config.headers || {});
      return fetch(options.api + path, config).then(async function (response) {
        var body = await response.json().catch(function () { return {}; });
        if (!response.ok || body.ok === false) throw new Error(body.error || 'No pudimos completar la solicitud.');
        return body;
      });
    });
  }
  function tabs(active) {
    return '<nav class="mk-tabs" aria-label="Marketing">' +
      [['encuestas', 'Encuestas'], ['metricas', 'Métricas'], ['correos', 'Correos']].map(function (item) {
        return '<button type="button" class="' + (active === item[0] ? 'is-active' : '') + '" data-mk-go="' + item[0] + '">' + item[1] + '</button>';
      }).join('') + '</nav>';
  }
  function bindTabs(container) {
    container.querySelectorAll('[data-mk-go]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (window.location.hash !== '#' + button.dataset.mkGo) window.location.hash = button.dataset.mkGo;
      });
    });
  }
  function rank(items) {
    var list = Array.isArray(items) ? items : [];
    if (!list.length) return '<div class="mk-empty">Aún no hay respuestas en este periodo.</div>';
    var max = Math.max.apply(null, list.map(function (item) { return Number(item.count) || 0; }).concat([1]));
    return '<ol class="mk-rank">' + list.map(function (item) {
      var width = Math.max(4, Math.round((Number(item.count) || 0) / max * 100));
      return '<li><div><span>' + esc(item.label) + '</span><b>' + num(item.count) + '</b></div><i><em style="width:' + width + '%"></em></i></li>';
    }).join('') + '</ol>';
  }

  function mountSurveys(container, options) {
    var days = 30;
    function shell() {
      container.innerHTML = '<div class="mx-page mk-page fade-up"><div class="sec-hero"><span class="sec-hero__eyebrow">Marketing · intención real</span><h1 class="sec-hero__title">Encuestas</h1><p class="sec-hero__sub">Respuestas del diagnóstico del index, intereses profesionales y cursos recomendados a cada prospecto.</p></div>' + tabs('encuestas') + '<div class="mx-toolbar"><div class="mx-seg-ctrl">' + [7, 30, 90].map(function (value) { return '<button type="button" data-mk-days="' + value + '" class="' + (value === days ? 'is-active' : '') + '">' + value + ' días</button>'; }).join('') + '</div><button class="mx-btn" data-mk-refresh>Actualizar</button></div><div data-mk-body class="mk-loading"><span class="mx-spin"></span>Cargando encuestas…</div></div>';
      bindTabs(container);
      container.querySelectorAll('[data-mk-days]').forEach(function (button) { button.addEventListener('click', function () { days = Number(button.dataset.mkDays); shell(); load(); }); });
      container.querySelector('[data-mk-refresh]').addEventListener('click', load);
    }
    async function load() {
      var body = container.querySelector('[data-mk-body]');
      if (!body) return;
      body.className = 'mk-loading'; body.innerHTML = '<span class="mx-spin"></span>Cargando encuestas…';
      try {
        var data = await api(options, '/admin/index-experience?dias=' + days);
        var events = data.assistant && data.assistant.events || {};
        var leads = Array.isArray(data.recentLeads) ? data.recentLeads : [];
        body.className = 'mk-stack';
        body.innerHTML = '<div class="mx-cards"><article class="mx-card"><span class="mx-card__label">Visitantes del asistente</span><strong class="mx-card__value">' + num(data.assistant && data.assistant.visitors) + '</strong><span class="mx-card__sub">personas identificadas</span></article><article class="mx-card"><span class="mx-card__label">Diagnósticos iniciados</span><strong class="mx-card__value">' + num(events.questionnaire_start) + '</strong><span class="mx-card__sub">intención de respuesta</span></article><article class="mx-card"><span class="mx-card__label">Diagnósticos completos</span><strong class="mx-card__value">' + num(events.questionnaire_complete) + '</strong><span class="mx-card__sub">ruta recomendada</span></article><article class="mx-card"><span class="mx-card__label">Datos recibidos</span><strong class="mx-card__value">' + num(data.assistant && data.assistant.leads) + '</strong><span class="mx-card__sub">prospectos con consentimiento</span></article></div>' +
          '<div class="mx-two"><section class="mx-panel"><div class="mx-panel__head"><div><span class="mx-kicker">Perfil</span><h3>Áreas profesionales</h3></div></div>' + rank(data.roles) + '</section><section class="mx-panel"><div class="mx-panel__head"><div><span class="mx-kicker">Objetivo</span><h3>Lo que quieren resolver</h3></div></div>' + rank(data.objectives) + '</section></div>' +
          '<section class="mx-panel"><div class="mx-panel__head"><div><span class="mx-kicker">Prospectos</span><h3>Respuestas recientes</h3></div><span class="mx-muted">' + leads.length + ' visibles</span></div>' + (leads.length ? '<div class="mx-table-wrap"><table class="mx-table"><thead><tr><th>Persona</th><th>Respuestas</th><th>Recomendaciones</th><th>Fecha</th></tr></thead><tbody>' + leads.map(function (lead) { return '<tr><td><div class="mx-user"><span class="mx-avatar">' + esc((lead.name || '?').slice(0, 2).toUpperCase()) + '</span><div><strong>' + esc(lead.name || 'Sin nombre') + '</strong><small>' + esc(lead.email || '') + (lead.phone ? ' · ' + esc(lead.phone) : '') + '</small></div></div></td><td><div class="mk-answer">' + (lead.answers || []).map(function (answer) { return '<span><small>' + esc(answer.question) + '</small>' + esc(answer.answer) + '</span>'; }).join('') + '</div></td><td>' + (lead.recommendations || []).map(function (course) { return '<span class="mx-badge mx-badge--vip">' + esc(course.title) + '</span>'; }).join(' ') + '</td><td class="mx-when">' + when(lead.createdAt) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="mk-empty">Aún no se han guardado diagnósticos.</div>') + '</section>';
      } catch (error) {
        body.className = 'mk-empty'; body.innerHTML = '<strong>No pudimos cargar las encuestas</strong><p>' + esc(error.message) + '</p>';
      }
    }
    shell(); load();
  }

  function mountEmails(container, options) {
    function members() {
      return options.members ? options.members() : [];
    }
    function shell() {
      container.innerHTML = '<div class="mx-page mk-page fade-up"><div class="sec-hero"><span class="sec-hero__eyebrow">Marketing · conversión</span><h1 class="sec-hero__title">Correos</h1><p class="sec-hero__sub">Tres mensajes para cuentas registradas que aún no son VIP: beneficios a las 12 h, precio especial 12 h después y último llamado 24 h más tarde.</p></div>' + tabs('correos') + '<div data-email-body class="mk-loading"><span class="mx-spin"></span>Cargando campaña…</div></div>';
      bindTabs(container);
    }
    function memberOptions() {
      var rows = members().slice().sort(function (a, b) { return String(a.email || '').localeCompare(String(b.email || '')); });
      return '<option value="">Mi correo de administrador</option>' + rows.map(function (member) {
        var id = member.id || member.uid || '';
        return '<option value="' + esc(id) + '">' + esc(member.nombre || member.displayName || member.email || id) + (member.email ? ' · ' + esc(member.email) : '') + '</option>';
      }).join('');
    }
    function paint(data) {
      var body = container.querySelector('[data-email-body]');
      if (!body) return;
      var active = data.mode === 'active';
      var counts = data.counts || {};
      var upcoming = data.upcoming || [];
      var latest = data.latest || [];
      body.className = 'mk-stack';
      body.innerHTML = '<section class="mk-campaign ' + (active ? 'is-active' : '') + '"><div><span class="mx-kicker">Estado de la automatización</span><h2>' + (active ? 'Campaña activa' : 'Campaña apagada') + '</h2><p>' + (active ? 'Solo entran cuentas creadas desde ' + when(data.startedAtMs) + '. El cron revisa cada 15 minutos.' : 'Puedes probar cada mensaje. No se enviará nada automáticamente hasta que la actives.') + '</p></div><button type="button" class="btn ' + (active ? 'btn--ghost' : 'btn--primary') + '" data-email-mode="' + (active ? 'off' : 'active') + '">' + (active ? 'Pausar campaña' : 'Activar campaña') + '</button></section>' +
        '<div class="mx-cards"><article class="mx-card"><span class="mx-card__label">En seguimiento</span><strong class="mx-card__value">' + num(counts.receiving) + '</strong><span class="mx-card__sub">cuentas elegibles</span></article><article class="mx-card"><span class="mx-card__label">Contactadas</span><strong class="mx-card__value">' + num(counts.sent) + '</strong><span class="mx-card__sub">al menos un correo</span></article><article class="mx-card"><span class="mx-card__label">Se volvieron VIP</span><strong class="mx-card__value">' + num(counts.converted) + '</strong><span class="mx-card__sub">después de la serie</span></article><article class="mx-card"><span class="mx-card__label">Bajas</span><strong class="mx-card__value">' + num(counts.unsubscribed) + '</strong><span class="mx-card__sub">no reciben más mensajes</span></article></div>' +
        '<section class="mx-panel"><div class="mx-panel__head"><div><span class="mx-kicker">Secuencia aprobable</span><h3>12 h → 12 h → 24 h</h3></div></div><div class="mk-timeline"><article><b>01</b><div><strong>Beneficios VIP</strong><span>12 horas después del registro · sin cupón</span></div></article><article><b>02</b><div><strong>Precio especial</strong><span>12 horas después · código personal de un uso</span></div></article><article><b>03</b><div><strong>Último llamado</strong><span>24 horas después · mejor condición de la serie</span></div></article></div></section>' +
        '<section class="mx-panel"><div class="mx-panel__head"><div><span class="mx-kicker">Demostración</span><h3>Enviar un correo de prueba ahora</h3></div></div><p class="mx-muted">La prueba no cambia el estado de la cuenta. Los pasos 2 y 3 crean un cupón real de Stripe, de un uso y válido por 24 horas.</p><div class="mk-test"><label>Cuenta<select data-test-member>' + memberOptions() + '</select></label><label>Mensaje<select data-test-step><option value="1">1 · Beneficios</option><option value="2">2 · Precio especial</option><option value="3">3 · Último llamado</option></select></label><button type="button" class="btn btn--primary" data-send-test>Enviar prueba</button></div><p class="mx-muted" style="margin-top:12px">Cada correo también llega como <b>notificación al teléfono</b> de quien activó los avisos en su panel. Para verlo tú: abre tu panel VIP en el teléfono, acepta "Activar avisos" y toca aquí.</p><div class="mk-test"><button type="button" class="btn btn--ghost" data-push-test>🔔 Probar notificación en mi teléfono</button></div></section>' +
        '<div class="mx-two"><section class="mx-panel"><div class="mx-panel__head"><div><span class="mx-kicker">Cola</span><h3>Próximos envíos</h3></div><button class="mx-btn" data-run-due>Revisar ahora</button></div>' + list(upcoming, 'dueMs') + '</section><section class="mx-panel"><div class="mx-panel__head"><div><span class="mx-kicker">Historial</span><h3>Últimos envíos</h3></div></div>' + list(latest, 'sentMs') + '</section></div>';
      bindEmailActions(data);
    }
    function list(rows, timeKey) {
      if (!rows.length) return '<div class="mk-empty">Sin movimientos todavía.</div>';
      return '<ul class="mx-people">' + rows.map(function (row) { return '<li><span class="mx-avatar">' + esc((row.name || row.email || '?').slice(0, 2).toUpperCase()) + '</span><div><strong>' + esc(row.name || row.email) + '</strong><small>' + esc(row.email) + ' · correo ' + num(row.step) + '</small></div><time class="mx-when">' + when(row[timeKey]) + '</time></li>'; }).join('') + '</ul>';
    }
    function bindEmailActions(data) {
      var modeButton = container.querySelector('[data-email-mode]');
      if (modeButton) modeButton.addEventListener('click', async function () {
        var next = modeButton.dataset.emailMode;
        var message = next === 'active' ? 'Se incluirán únicamente registros nuevos desde este momento. ¿Activar la campaña?' : 'Los correos automáticos quedarán pausados. ¿Continuar?';
        if (!window.confirm(message)) return;
        modeButton.disabled = true;
        try { await api(options, '/admin/conversion-emails/mode', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: next }) }); window.Toast && Toast.success(next === 'active' ? 'Campaña activada' : 'Campaña pausada'); load(); }
        catch (error) { window.Toast && Toast.error('No se pudo cambiar', error.message); modeButton.disabled = false; }
      });
      var testButton = container.querySelector('[data-send-test]');
      if (testButton) testButton.addEventListener('click', async function () {
        var uid = container.querySelector('[data-test-member]').value;
        var step = Number(container.querySelector('[data-test-step]').value);
        if (!window.confirm('Se enviará un correo real de PRUEBA. ¿Continuar?')) return;
        testButton.disabled = true; testButton.textContent = 'Enviando…';
        try {
          var result = await api(options, '/admin/conversion-emails/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: uid, step: step }) });
          window.Toast && Toast.success('Correo de prueba enviado', result.code ? 'Código: ' + result.code : 'Mensaje 1 sin cupón');
        } catch (error) { window.Toast && Toast.error('No se pudo enviar', error.message); }
        finally { testButton.disabled = false; testButton.textContent = 'Enviar prueba'; }
      });
      var pushButton = container.querySelector('[data-push-test]');
      if (pushButton) pushButton.addEventListener('click', async function () {
        pushButton.disabled = true;
        try {
          var r = await api(options, '/admin/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
          if (r.sent) window.Toast && Toast.success('Notificación enviada', 'Llegó a ' + num(r.sent) + ' dispositivo(s) tuyo(s).');
          else window.Toast && Toast.info('Aún no tienes avisos activados', 'Abre tu panel VIP en el teléfono y toca "Activar avisos".');
        } catch (error) { window.Toast && Toast.error('No se pudo enviar', error.message); }
        finally { pushButton.disabled = false; }
      });
      var runButton = container.querySelector('[data-run-due]');
      if (runButton) runButton.addEventListener('click', async function () {
        runButton.disabled = true;
        try { var result = await api(options, '/admin/conversion-emails/run', { method: 'POST' }); window.Toast && Toast.info('Revisión terminada', result.skipped === 'off' ? 'La campaña está apagada.' : num(result.sent) + ' enviados · ' + num(result.failed) + ' fallidos'); load(); }
        catch (error) { window.Toast && Toast.error('No se pudo revisar', error.message); runButton.disabled = false; }
      });
    }
    async function load() {
      var body = container.querySelector('[data-email-body]');
      if (body) { body.className = 'mk-loading'; body.innerHTML = '<span class="mx-spin"></span>Cargando campaña…'; }
      try { paint(await api(options, '/admin/conversion-emails')); }
      catch (error) { if (body) { body.className = 'mk-empty'; body.innerHTML = '<strong>No pudimos cargar la campaña</strong><p>' + esc(error.message) + '</p>'; } }
    }
    shell(); load();
  }

  window.ICADEMMarketingAdmin = { mountSurveys: mountSurveys, mountEmails: mountEmails, tabs: tabs, bindTabs: bindTabs };
  window.dispatchEvent(new CustomEvent('icadem:marketing-admin-ready'));
})();
