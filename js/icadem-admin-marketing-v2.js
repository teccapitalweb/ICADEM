/* ═══════════════════ MARKETING · Encuestas, Métricas y Pruebas gratuitas ═══════════════════
   Portado tal cual del admin de Alintec Food (misma lógica, flujo, estructura y diseño),
   con la paleta de ICADEM. Fuentes de datos:
   · Encuestas         → GET /api/admin/encuestas   (encuesta del landing, js/icadem-encuesta.js)
   · Métricas          → GET /api/admin/metricas y /api/admin/visitas (contador js/icadem-visitas.js)
   · Pruebas gratuitas → miembros (Firestore) + GET /api/admin/pruebas (curso gratuito elegido en users/{uid}.freeCourseId)
   ═════════════════════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const AdminEsc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const MK = {
  _webhookUrl: 'https://icadem-webhook-production.up.railway.app',
  _mbToDate(v){ return typeof window.toDate === 'function' ? window.toDate(v) : (v ? (v.toDate ? v.toDate() : new Date(v)) : null); },
  async _getAuthToken(){
    for (let i = 0; i < 60 && !(window._fb && window._fb.auth && window._fb.auth.currentUser); i++) await new Promise(r => setTimeout(r, 250));
    const u = window._fb && window._fb.auth && window._fb.auth.currentUser;
    return u ? u.getIdToken() : null;
  },
  async _api(ruta){
    const token = await MK._getAuthToken();
    const r = await fetch(MK._webhookUrl + ruta, { headers: { 'Authorization': 'Bearer ' + token }, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  },
  _encuestasLanding(p){
    p.innerHTML = `
      <div class="fade-up">
        <div class="sec-hero">
          <span class="sec-hero__eyebrow">Marketing</span>
          <h1 class="sec-hero__title">Encuestas</h1>
          <p class="sec-hero__sub">Resultados de la encuesta del landing de ICADEM · quién visita, qué busca, qué urgencia tiene y quién pidió que lo contacten.</p>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card" style="--c1:#5b92c8;--c2:#8fbce6;">
            <div class="kpi-card__label">Respuestas totales</div>
            <div class="kpi-card__value" id="enc-kpi-total">—</div>
            <div class="kpi-card__sub">Incluye completas e incompletas</div>
          </div>
          <div class="kpi-card" style="--c1:#10b981;--c2:#6ee7b7;">
            <div class="kpi-card__label">Completaron la encuesta</div>
            <div class="kpi-card__value" id="enc-kpi-completas">—</div>
            <div class="kpi-card__sub" id="enc-kpi-completas-sub">—</div>
          </div>
          <div class="kpi-card" style="--c1:#F7941D;--c2:#FBBF24;">
            <div class="kpi-card__label">Leads calientes</div>
            <div class="kpi-card__value" id="enc-kpi-calientes">—</div>
            <div class="kpi-card__sub">Quieren empezar lo antes posible</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;">
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Perfil de quién responde</h3>
            <canvas id="enc-chart-perfil" height="220"></canvas>
          </div>
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Cómo nos conoció</h3>
            <canvas id="enc-chart-origen" height="220"></canvas>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Urgencia declarada</h3>
            <canvas id="enc-chart-urgencia" height="220"></canvas>
          </div>
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Qué los detiene hoy</h3>
            <canvas id="enc-chart-freno" height="220"></canvas>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Qué quieren lograr este año</h3>
            <canvas id="enc-chart-meta" height="200"></canvas>
          </div>
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Área donde trabajan</h3>
            <canvas id="enc-chart-giro" height="200"></canvas>
          </div>
        </div>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:16px;">
          <h3 style="margin:0 0 4px;font-size:14px;color:var(--text);">Dónde se quedan los que no terminan</h3>
          <p style="margin:0 0 12px;font-size:12px;color:var(--text-3);">Última pregunta que alcanzaron a contestar antes de irse. Solo cuenta a quienes contestaron al menos una; quien no contestó ninguna no deja registro.</p>
          <canvas id="enc-chart-abandono" height="170"></canvas>
        </div>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:16px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Tema de interés · para saber qué más ofrecer</h3>
          <canvas id="enc-chart-interes" height="160"></canvas>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Lugar de trabajo · solo profesionales en activo</h3>
            <canvas id="enc-chart-tamano" height="200"></canvas>
          </div>
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Experiencia con cursos online</h3>
            <canvas id="enc-chart-experiencia" height="200"></canvas>
          </div>
        </div>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:16px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Personas que pidieron que las contacten</h3>
          <div id="enc-leads" style="color:var(--text-2);font-size:13px;">Cargando…</div>
        </div>
      </div>
    `;
    if (!MK._encSinCarga) MK._cargarEncuestas();
  },

  // Al abrir el panel se restaura la última sección ANTES de que Firebase confirme la sesión de
  // administrador; leer Firestore en ese momento da permission-denied. Se espera al evento 'adminready'.
  _esperarAdmin(){
    if (window.__currentAdmin) return Promise.resolve();
    return new Promise(resolver => {
      window.addEventListener('adminready', () => resolver(), { once: true });
      setTimeout(resolver, 10000);
    });
  },

  async _cargarEncuestas(){
    let docs = [];
    try {
      await MK._esperarAdmin();
      // ICADEM: las encuestas se leen por el webhook (el navegador nunca toca encuestasProspectos)
      const datos = await MK._api('/api/admin/encuestas');
      docs = (datos.items || []).map(d => {
        const ms = d.creado ? Date.parse(d.creado) : 0;
        return { ...d, creado: ms ? { toMillis: () => ms, toDate: () => new Date(ms) } : null };
      });
    } catch (e) {
      console.error('❌ No se pudo leer encuestasProspectos:', e.code || '', e.message);
      const leadsEl = document.getElementById('enc-leads');
      if (leadsEl) {
        leadsEl.innerHTML = 'No se pudieron cargar los datos (' + (e.code || e.message || 'error') + '). <a href="#" id="enc-reintentar" style="color:var(--primary);font-weight:700;">Reintentar</a>';
        const re = document.getElementById('enc-reintentar');
        if (re) re.addEventListener('click', ev => { ev.preventDefault(); MK._cargarEncuestas(); });
      }
      return;
    }
    // Una misma persona puede tener varias copias (parcial, completa, otra vuelta, una con WhatsApp):
    // por sesión nos quedamos con una sola. La completa gana a la parcial; entre completas, la más reciente
    // (a igualdad, la que tiene más respuestas); y si la elegida no trae WhatsApp pero otra copia sí, se conserva.
    const msDe = x => (x && x.creado && typeof x.creado.toMillis === 'function') ? x.creado.toMillis() : 0;
    const nResp = x => Object.keys(x.respuestas || {}).length;
    const grupos = new Map();
    docs.forEach((d, i) => {
      const clave = d.sessionId || ('sin-sesion-' + i);
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(d);
    });
    const porSesion = new Map();
    grupos.forEach((g, clave) => {
      const elegida = g.reduce((a, d) => {
        if (!!d.completada !== !!a.completada) return d.completada ? d : a;
        if (msDe(d) !== msDe(a)) return msDe(d) > msDe(a) ? d : a;
        return nResp(d) > nResp(a) ? d : a;
      });
      const conContacto = g.find(d => d.contacto);
      porSesion.set(clave, (conContacto && !elegida.contacto)
        ? { ...elegida, contacto: conContacto.contacto, avisoAceptado: conContacto.avisoAceptado, avisoVersion: conContacto.avisoVersion }
        : elegida);
    });
    docs = [...porSesion.values()];
    const total = docs.length;
    const completas = docs.filter(d => d.completada === true);
    const contar = (campo) => {
      const conteo = {};
      completas.forEach(d => {
        const v = d.respuestas?.[campo];
        if (!v) return; // los pasos condicionales (ej. "tamano") no existen para todos
        conteo[v] = (conteo[v] || 0) + 1;
      });
      return conteo;
    };
    const porPerfil = contar('p1');
    const porOrigen = contar('origen');
    const porUrgencia = contar('urgencia');
    const porFreno = contar('freno');
    const porInteres = contar('interes');
    const porTamano = contar('tamano');
    const porExperiencia = contar('experiencia');
    const porMeta = contar('meta');
    const porGiro = contar('giro');
    // Abandono: para cada persona que no terminó, la última pregunta que contestó según el
    // orden del flujo (las barras salen en ese mismo orden).
    const ORDEN_PREGUNTAS = [
      ['meta', 'Qué quieren lograr'], ['p1', 'Perfil'], ['origen', 'Cómo nos conoció'], ['giro', 'Área'],
      ['p2', 'Reto principal'], ['p2b', 'Profundización del reto'], ['tamano', 'Lugar de trabajo'],
      ['interes', 'Tema de interés'], ['experiencia', 'Cursos online'], ['urgencia', 'Cuándo empezar'], ['freno', 'Qué los detiene']
    ];
    const porAbandono = {};
    ORDEN_PREGUNTAS.forEach(([, nombre]) => { porAbandono[nombre] = 0; });
    docs.filter(d => d.completada !== true).forEach(d => {
      const ultima = [...ORDEN_PREGUNTAS].reverse().find(([k]) => d.respuestas && d.respuestas[k]);
      if (ultima) porAbandono[ultima[1]]++;
    });
    Object.keys(porAbandono).forEach(k => { if (!porAbandono[k]) delete porAbandono[k]; });
    const calientes = completas.filter(d => d.respuestas?.urgencia === 'Lo antes posible');

    const elTotal = document.getElementById('enc-kpi-total');
    if (elTotal) elTotal.textContent = total;
    const elCompletas = document.getElementById('enc-kpi-completas');
    if (elCompletas) elCompletas.textContent = completas.length;
    const elCompletasSub = document.getElementById('enc-kpi-completas-sub');
    if (elCompletasSub) elCompletasSub.innerHTML = total > 0 ? `<strong>${Math.round(completas.length/total*100)}%</strong> de las visitas` : 'Sin respuestas aún';
    const elCalientes = document.getElementById('enc-kpi-calientes');
    if (elCalientes) elCalientes.textContent = calientes.length;

    // Si una pregunta aún no tiene respuestas, en vez de una tarjeta en blanco se avisa.
    const sinDatos = (cv, datos) => {
      if (Object.keys(datos).length) return false;
      cv.insertAdjacentHTML('afterend', '<p style="margin:24px 0;text-align:center;font-size:13px;color:var(--text-3);">Aún no hay respuestas para esta pregunta.</p>');
      cv.style.display = 'none';
      return true;
    };
    if (!window.Chart) {
      document.querySelectorAll('canvas[id^="enc-chart-"]').forEach(cv => {
        cv.insertAdjacentHTML('afterend', '<p style="margin:24px 0;text-align:center;font-size:13px;color:var(--text-3);">No se pudo cargar la librería de gráficas. Recarga la página.</p>');
        cv.style.display = 'none';
      });
    }
    if (window.Chart) {
      Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--text-2').trim() || '#666';
      const colores = ['#5b92c8','#10b981','#F7941D','#D4537E','#9CA3AF'];
      const pie = (id, datos) => {
        const cv = document.getElementById(id);
        if (cv && sinDatos(cv, datos)) return;
        if (cv) new Chart(cv, {
          type: 'pie',
          data: { labels: Object.keys(datos), datasets: [{ data: Object.values(datos), backgroundColor: colores }] },
          options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
        });
      };
      const barra = (id, datos, color, horizontal) => {
        const cv = document.getElementById(id);
        if (cv && sinDatos(cv, datos)) return;
        if (cv) new Chart(cv, {
          type: 'bar',
          data: { labels: Object.keys(datos), datasets: [{ data: Object.values(datos), backgroundColor: color }] },
          options: {
            indexAxis: horizontal ? 'y' : 'x',
            plugins: { legend: { display: false } },
            scales: horizontal
              ? { x: { beginAtZero: true, ticks: { precision: 0 } } }
              : { y: { beginAtZero: true, ticks: { precision: 0 } } }
          }
        });
      };
      pie('enc-chart-perfil', porPerfil);
      pie('enc-chart-origen', porOrigen);
      barra('enc-chart-urgencia', porUrgencia, '#10b981', false);
      barra('enc-chart-freno', porFreno, '#D4537E', false);
      barra('enc-chart-interes', porInteres, '#F7941D', true);
      barra('enc-chart-meta', porMeta, '#10b981', true);
      pie('enc-chart-giro', porGiro);
      barra('enc-chart-abandono', porAbandono, '#D4537E', true);
      barra('enc-chart-tamano', porTamano, '#5b92c8', false);
      barra('enc-chart-experiencia', porExperiencia, '#9CA3AF', false);
    }

    const leadsEl = document.getElementById('enc-leads');
    if (leadsEl) {
      // Todos pasan por el paso de WhatsApp (opcional): aquí salen quienes lo dejaron, con los
      // urgentes primero y un enlace para escribirles directo.
      const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
      // Misma regla que la encuesta: detecta números que no parecen reales (para revisarlos antes de escribir).
      const patronFalso = n => {
        if (n.length < 6) return true;
        for (let p = 1; p <= 5; p++) if (n.length % p === 0 && n === n.slice(0, p).repeat(n.length / p)) return true;
        const dif = [...n].slice(1).map((c, i) => (Number(c) - Number(n[i]) + 10) % 10);
        return dif.every(x => x === 1) || dif.every(x => x === 9);
      };
      const numeroDudoso = crudo => {
        let n = String(crudo).replace(/\D/g, '');
        if (n.length < 8 || n.length > 15) return true;
        if (n.length === 10 || n.startsWith('52')) {
          // México (lo guardado antes de los demás países llegaba a 10 dígitos): lada válida y 10 dígitos.
          if (n.length === 13 && n.startsWith('521')) n = n.slice(3);
          else if (n.length === 12 && n.startsWith('52')) n = n.slice(2);
          if (n.length !== 10 || !/^[2-9]/.test(n)) return true;
        }
        return patronFalso(n) || /^(\d)\1{7}$/.test(n.slice(-8)); // los últimos 8 dígitos no pueden ser todos iguales
      };
      const conContacto = completas.filter(d => d.contacto).sort((a, b) =>
        (b.respuestas?.urgencia === 'Lo antes posible') - (a.respuestas?.urgencia === 'Lo antes posible'));
      if (conContacto.length === 0) {
        leadsEl.textContent = 'Nadie ha dejado su WhatsApp todavía.';
      } else {
        leadsEl.innerHTML = conContacto.map(d => {
          const fecha = d.creado?.toDate ? d.creado.toDate().toLocaleDateString('es-MX') : '—';
          const digitos = String(d.contacto).replace(/\D/g, '');
          const wa = digitos.length === 10 ? '52' + digitos : digitos;
          const urgencia = d.respuestas?.urgencia || '—';
          const urgente = urgencia === 'Lo antes posible';
          const etiqueta = `<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:${urgente ? 'rgba(247,148,29,.18)' : 'var(--surface-3)'};color:${urgente ? '#C9740A' : 'var(--text-2)'};">${esc(urgencia)}</span>`;
          const enlace = digitos ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:700;text-decoration:none;">${esc(d.contacto)}</a>` : esc(d.contacto);
          const dudoso = numeroDudoso(d.contacto) ? '<span title="No parece un WhatsApp válido de México: revísalo antes de escribir" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(179,38,30,.14);color:#B3261E;">Número dudoso</span>' : '';
          const constancia = dudoso + (d.avisoAceptado ? `<span title="Aceptó el Aviso de privacidad (${esc(d.avisoVersion || 'sin versión')})" style="font-size:11px;color:var(--text-3);">✓ Aviso aceptado</span>` : '');
          return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;"><span>${enlace}</span>${etiqueta}${constancia}<span style="color:var(--text-3);">${fecha}</span></div>`;
        }).join('');
      }
    }
  },

  // ─── Pruebas gratuitas: cuántos eligen curso, cuáles y cuántos terminan pagando ───
  // ─────────── MÉTRICAS DE VISITAS · tráfico, origen de los miembros, países e historial ───────────
  metricas(p){
    const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const num = n => (Number(n) || 0).toLocaleString('es-MX');
    const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const NOMBRE_PAGINA = { landing: 'Sitio público', acceso: 'Inicio de sesión', panel: 'Panel de miembros', demo: 'Demo gratuita' };
    const NOMBRE_FUENTE = { directo: 'Directo', interno: 'Dentro del sitio', google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', yahoo: 'Yahoo', facebook: 'Facebook', instagram: 'Instagram', meta: 'Meta (Facebook o Instagram)', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', x: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok', correo: 'Correo electrónico', otros: 'Otros sitios' };
    const COLOR_FUENTE = { directo: '#94A3B8', interno: '#CBD5E1', google: '#4285F4', bing: '#00809D', duckduckgo: '#DE5833', yahoo: '#7E1FFF', facebook: '#1877F2', instagram: '#E1306C', meta: '#6366F1', whatsapp: '#25D366', linkedin: '#0A66C2', x: '#64748B', youtube: '#FF0000', tiktok: '#10b981', correo: '#F59E0B', otros: '#A8A29E' };
    const NOMBRE_DISP = { movil: 'Teléfono', tablet: 'Tableta', computadora: 'Computadora' };
    const COLOR_DISP = { movil: '#5b92c8', tablet: '#F7941D', computadora: '#10b981' };
    const VERDE = '#5b92c8', VERDE_OSC = '#2c526f', AZUL = '#10b981';
    const RANGOS = [['semana', 'Semana'], ['30', '30 días'], ['90', '90 días'], ['365', '12 meses'], ['todo', 'Todo']];
    const nombresPaises = (() => { try { return new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) { return { of: c => c }; } })();
    const nombrePais = c => (c === 'ZZ' ? 'No identificado' : (nombresPaises.of(c) || c));

    // Gráficas anteriores de esta pantalla (si se vuelve a entrar) se destruyen para no acumularlas
    (MK._mxCharts || []).forEach(c => { try { c.destroy(); } catch (e) {} });
    MK._mxCharts = [];

    if (!document.getElementById('mx2-estilos')) {
      const st = document.createElement('style');
      st.id = 'mx2-estilos';
      st.textContent = `
.mx2{--mx-g:#5b92c8;--mx-line:var(--border);max-width:1240px}
.mx2 *{box-sizing:border-box}
.mx2-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.mx2-hero h1{margin:0;font:800 30px/1.1 'Plus Jakarta Sans','Inter',sans-serif;letter-spacing:-.8px}
.mx2-hero p{margin:8px 0 0;max-width:640px;font-size:13.5px;line-height:1.6;color:var(--text-2)}
.mx2-eyebrow{display:block;margin-bottom:8px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.6px;text-transform:uppercase;color:var(--primary)}
.mx2-estado{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font:600 12px Inter,sans-serif;color:var(--text-2)}
.mx2-estado i{width:9px;height:9px;border-radius:50%;background:#94A3B8}
.mx2-estado.ok i{background:#22C55E;box-shadow:0 0 0 4px rgba(34,197,94,.18)}
.mx2-estado.error i{background:#EF4444;box-shadow:0 0 0 4px rgba(239,68,68,.16)}
.mx2-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px;padding:10px;border:1px solid var(--border);border-radius:18px;background:var(--surface)}
.mx2-seg{display:flex;gap:4px;padding:4px;border-radius:13px;background:var(--surface-2);flex-wrap:wrap}
.mx2-seg button{border:0;background:transparent;color:var(--text-2);padding:8px 15px;border-radius:10px;font:700 12.5px Inter,sans-serif;cursor:pointer;transition:.18s}
.mx2-seg button:hover{color:var(--text)}
.mx2-seg button.on{background:var(--surface);color:var(--primary);box-shadow:0 2px 8px rgba(0,0,0,.09)}
.mx2-semnav{display:flex;align-items:center;gap:8px}
.mx2-semnav button{width:34px;height:34px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-size:17px;font-weight:700;cursor:pointer}
.mx2-semnav button:hover:not(:disabled){border-color:var(--primary);color:var(--primary)}
.mx2-semnav button:disabled{opacity:.35;cursor:default}
.mx2-semnav span{min-width:150px;text-align:center;font:700 13px 'Plus Jakarta Sans',Inter,sans-serif}
.mx2-semnav small{display:block;font:600 10px 'JetBrains Mono',monospace;color:var(--text-3);letter-spacing:.6px}
.mx2-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);background:var(--surface);color:var(--text);padding:9px 14px;border-radius:11px;font:700 12.5px Inter,sans-serif;cursor:pointer}
.mx2-btn:hover{border-color:var(--primary);color:var(--primary)}
.mx2-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:14px;margin-bottom:16px}
.mx2-kpi{position:relative;overflow:hidden;padding:18px 20px 14px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}
.mx2-kpi::before{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:var(--c)}
.mx2-kpi__l{font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-3)}
.mx2-kpi__v{margin-top:8px;font:800 34px/1 'Plus Jakarta Sans',sans-serif;letter-spacing:-1px}
.mx2-kpi__s{margin-top:6px;font-size:12px;color:var(--text-3)}
.mx2-kpi svg{display:block;width:100%;height:34px;margin-top:10px}
.mx2-d{display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:2px 9px;border-radius:999px;font:700 11px 'JetBrains Mono',monospace}
.mx2-d.up{background:rgba(16,185,129,.14);color:#0E9F6E}.mx2-d.down{background:rgba(239,68,68,.13);color:#DC2626}.mx2-d.eq{background:var(--surface-2);color:var(--text-3)}
.mx2-grid{display:grid;gap:16px;margin-bottom:16px}
.mx2-g2{grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))}
.mx2-g3{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.mx2-card{min-width:0;padding:20px 22px;border:1px solid var(--border);border-radius:22px;background:var(--surface)}
.mx2-card h3{margin:0;font:700 16px 'Plus Jakarta Sans',Inter,sans-serif;letter-spacing:-.3px}
.mx2-sub{margin:5px 0 14px;font-size:12.5px;line-height:1.55;color:var(--text-3)}
.mx2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.mx2-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text-2)}
.mx2-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.mx2-cv{position:relative;width:100%}
.mx2-hero-card{border-color:color-mix(in srgb,var(--primary) 35%,var(--border));background:linear-gradient(150deg,color-mix(in srgb,var(--primary) 7%,var(--surface)),var(--surface) 60%)}
.mx2-top{display:flex;align-items:center;gap:14px;margin:4px 0 16px;padding:14px 16px;border-radius:16px;background:var(--surface);border:1px solid var(--border)}
.mx2-top b{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;flex:none;color:#fff;font:800 18px Inter,sans-serif}
.mx2-top div{font-size:13px;line-height:1.5;color:var(--text-2)}
.mx2-top strong{color:var(--text);font-size:15px}
.mx2-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:14px}
.mx2-tbl th{padding:6px 8px;text-align:right;font:700 10px 'JetBrains Mono',monospace;letter-spacing:1px;text-transform:uppercase;color:var(--text-3);border-bottom:1px solid var(--border)}
.mx2-tbl th:first-child,.mx2-tbl td:first-child{text-align:left}
.mx2-tbl td{padding:9px 8px;text-align:right;border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums}
.mx2-tbl tr:last-child td{border-bottom:0}
.mx2-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:9px;vertical-align:-1px}
.mx2-pill{display:inline-block;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary);font:700 11px 'JetBrains Mono',monospace}
.mx2-heat{display:grid;grid-template-columns:36px repeat(24,minmax(0,1fr));gap:3px;align-items:center}
.mx2-heat span{font:600 10px 'JetBrains Mono',monospace;color:var(--text-3)}
.mx2-heat i{display:block;aspect-ratio:1/1;border-radius:4px;background:var(--surface-2)}
.mx2-hl{display:grid;grid-template-columns:36px repeat(24,minmax(0,1fr));gap:3px;margin-top:8px;font:600 10px 'JetBrains Mono',monospace;color:var(--text-3)}
.mx2-hl span{white-space:nowrap;overflow:visible}
.mx2-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 12px;align-items:center;margin-bottom:12px}
.mx2-row__t{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx2-row__n{font:700 12px 'JetBrains Mono',monospace;color:var(--text-2)}
.mx2-row__b{grid-column:1/-1;height:8px;border-radius:999px;background:var(--surface-2);overflow:hidden}
.mx2-row__b i{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#5b92c8,#8fbce6);transition:width .8s cubic-bezier(.2,.8,.25,1)}
.mx2-q{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border)}
.mx2-q:last-child{border-bottom:0}
.mx2-q__av{width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;color:#fff;font:800 13px Inter,sans-serif;background:linear-gradient(135deg,#5b92c8,#2c526f)}
.mx2-q__m{flex:1;min-width:0}
.mx2-q__n{font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx2-q__e{font-size:11.5px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx2-q__tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.mx2-q__tag{padding:1px 8px;border-radius:999px;font:700 10px 'JetBrains Mono',monospace;background:var(--surface-2);color:var(--text-2)}
.mx2-q__tag.vip{background:rgba(247,148,29,.16);color:#C26A00}
.mx2-q__u{text-align:right;font:600 11px 'JetBrains Mono',monospace;color:var(--text-3);min-width:96px}
.mx2-rec{display:grid;grid-template-columns:70px minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,.9fr);gap:6px 12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px}
.mx2-rec:last-child{border-bottom:0}
.mx2-rec__t{font:600 11px 'JetBrains Mono',monospace;color:var(--text-3)}
.mx2-rec__o{display:inline-flex;align-items:center;gap:7px;font-weight:700;min-width:0}
.mx2-rec__o i{width:9px;height:9px;border-radius:50%;flex:none}
.mx2-rec small{color:var(--text-3);font-size:11px;font-weight:600}
.mx2-nuevo{display:inline-block;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary);font:700 10px 'JetBrains Mono',monospace}
@media(max-width:700px){.mx2-rec{grid-template-columns:62px minmax(0,1fr) minmax(0,1fr)}.mx2-rec>:nth-child(n+4){grid-column:2/-1}}
.mx2-seg2{display:flex;gap:4px;padding:4px;border-radius:13px;background:var(--surface-2);flex-wrap:wrap}
.mx2-seg2 button{border:0;background:transparent;color:var(--text-2);padding:7px 13px;border-radius:10px;font:700 12.5px Inter,sans-serif;cursor:pointer;transition:.18s}
.mx2-seg2 button:hover{color:var(--text)}
.mx2-seg2 button.on{background:var(--surface);color:var(--primary);box-shadow:0 2px 8px rgba(0,0,0,.09)}
.mx2-per__k{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
.mx2-per__k div{padding:12px 14px;border-radius:14px;background:var(--surface-2);min-width:0}
.mx2-per__k b{display:block;font:800 22px/1.1 'Plus Jakarta Sans',sans-serif;letter-spacing:-.5px;overflow-wrap:anywhere}
.mx2-per__k span{display:block;margin-top:3px;font:600 10.5px 'JetBrains Mono',monospace;letter-spacing:.6px;text-transform:uppercase;color:var(--text-3)}
.mx2-mb{display:flex;align-items:flex-end;gap:4px;height:92px;margin-bottom:12px}
.mx2-mb div{flex:1 1 0;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;gap:4px}
.mx2-mb i{display:block;width:100%;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#8fbce6,#2c526f)}
.mx2-mb span{font:600 9.5px 'JetBrains Mono',monospace;color:var(--text-3);text-align:center;height:11px;white-space:nowrap;overflow:visible}
.mx2-chips{display:flex;flex-wrap:wrap;gap:8px}
.mx2-chip{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;background:var(--surface-2);font-size:12.5px;font-weight:600}
.mx2-chip i{width:9px;height:9px;border-radius:50%;flex:none}
.mx2-chip b{font:800 12px 'JetBrains Mono',monospace;color:var(--text-2)}
.mx2-det{margin-top:16px;border-top:1px solid var(--border);padding-top:12px}
.mx2-det summary{display:flex;align-items:center;gap:10px;cursor:pointer;font:700 13px Inter,sans-serif;color:var(--text-2);list-style:none}
.mx2-det summary::-webkit-details-marker{display:none}
.mx2-det summary::before{content:'▸';font-size:12px;transition:transform .2s}
.mx2-det[open] summary::before{transform:rotate(90deg)}
.mx2-det__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px}
.mx2-det__top .mx2-sub{margin:0;flex:1 1 260px}
.mx2-det__lista{max-height:300px;overflow-y:auto;margin-top:8px;padding-right:4px}
.mx2-r2{display:grid;grid-template-columns:130px minmax(0,1fr) minmax(0,1.3fr);gap:2px 12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:12.5px}
.mx2-r2:last-child{border-bottom:0}
.mx2-r2__m{color:var(--text-2)}
.mx2-r2__p{grid-column:2/-1;font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:700px){.mx2-per__k{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.mx2-per__k b{font-size:17px}.mx2-r2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.mx2-r2__m,.mx2-r2__p{grid-column:1/-1}}
.mx2-trio{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:18px;margin-bottom:6px}
.mx2-mini h4{margin:0 0 8px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1px;text-transform:uppercase;color:var(--text-3)}
.mx2-mr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;align-items:center;margin-bottom:9px;font-size:13px}
.mx2-mr__t{display:flex;align-items:center;gap:8px;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx2-mr__t i{width:9px;height:9px;border-radius:50%;flex:none}
.mx2-mr b{font:700 12px 'JetBrains Mono',monospace;color:var(--text-2)}
.mx2-mr__b{grid-column:1/-1;height:5px;border-radius:99px;background:var(--surface-2);overflow:hidden}
.mx2-mr__b u{display:block;height:100%;border-radius:99px;text-decoration:none}
.mx2-mr__v{font-size:12.5px;color:var(--text-3)}
.mx2-det__top h4{margin:0;font:700 14px 'Plus Jakarta Sans',Inter,sans-serif}
.mx2-det__top{display:flex;align-items:center;gap:10px}
.mx2-det__lista .mx2-r2:nth-child(n+6){display:none}
.mx2-det__lista{max-height:none;overflow:visible;margin-top:8px;padding-right:0}
.mx2-det__lista.abierta{max-height:340px;overflow-y:auto;padding-right:4px}
.mx2-det__lista.abierta .mx2-r2:nth-child(n+6){display:grid}
.mx2-mas{margin-top:10px;width:100%;border:1px dashed var(--border);background:transparent;color:var(--primary);border-radius:12px;padding:9px;font:700 12.5px Inter,sans-serif;cursor:pointer}
.mx2-mas:hover{background:color-mix(in srgb,var(--primary) 8%,transparent)}
.mx2-r2__m strong{color:var(--text)}
.mx2-log{max-height:430px;overflow-y:auto;padding-right:4px}
.mx2-log .mx2-r2:first-child{padding-top:2px}
.mx2-log__pie{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:11.5px;color:var(--text-3)}
@media(max-width:700px){.mx2-trio{gap:12px;margin-bottom:0}.mx2-mr{margin-bottom:6px}.mx2-mr__b{display:none}.mx2-mini .mx2-mr:nth-child(n+5){display:none}.mx2-mini h4{margin-bottom:5px}}
.mx2-empty{padding:34px 16px;text-align:center;color:var(--text-3);font-size:13px;line-height:1.6}
.mx2-empty b{display:block;margin-bottom:4px;font:700 15px 'Plus Jakarta Sans',sans-serif;color:var(--text)}
.mx2-big{padding:56px 20px}
@media(max-width:480px){.mx2-tbl th,.mx2-tbl td{padding:8px 3px;font-size:12px}.mx2-tbl th{font-size:9px;letter-spacing:.4px}.mx2-heat{grid-template-columns:30px repeat(24,minmax(0,1fr));gap:2px}.mx2-hl{grid-template-columns:30px repeat(24,minmax(0,1fr));gap:2px}}
@media(max-width:700px){.mx2-hero h1{font-size:25px}.mx2-q{flex-wrap:wrap}.mx2-q__u{min-width:0;width:100%;text-align:left;padding-left:52px}.mx2-card{padding:18px 16px}.mx2-bar{padding:8px}.mx2-seg button{padding:7px 11px}}
`;
      document.head.appendChild(st);
    }

    p.innerHTML = `<div class="mx2 fade-up"><div id="mx2-raiz"><div class="mx2-empty"><b>Cargando métricas…</b>Un momento.</div></div></div>`;
    const raiz = p.querySelector('#mx2-raiz');

    // ── Utilidades de fechas (claves AAAA-MM-DD en hora de México) ──
    const sumarDias = (clave, n) => { const [a, m, d] = clave.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
    const dow = clave => { const [a, m, d] = clave.split('-').map(Number); return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7; };
    const lunesDe = clave => sumarDias(clave, -dow(clave));
    const corta = clave => { const [, m, d] = clave.split('-').map(Number); return d + ' ' + MESES[m - 1]; };
    const mesDe = clave => { const [a, m] = clave.split('-').map(Number); return MESES[m - 1] + ' ' + String(a).slice(2); };
    const lista = (desde, hasta) => { const r = []; for (let c = desde; c <= hasta; c = sumarDias(c, 1)) r.push(c); return r; };

    // Al recargar la página directamente en esta sección, Firebase tarda un instante en confirmar la sesión
    const esperarSesion = async () => {
      for (let i = 0; i < 60; i++) {
        if (window._fb && window._fb.auth && window._fb.auth.currentUser) return;
        await new Promise(r => setTimeout(r, 250));
      }
    };
    const cargar = async dias => {
      await esperarSesion();
      const token = await MK._getAuthToken();
      const r = await fetch(MK._webhookUrl + '/api/admin/metricas?dias=' + dias, { headers: { 'Authorization': 'Bearer ' + token } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron cargar las métricas');
      return d;
    };

    const pintar = datos => {
      const estado = { rango: 'semana', semana: 0 };
      let diasCargados = datos.dias.length;
      const hoy = datos.hoy;
      const cero = clave => ({ dia: clave, total: 0, unicos: 0, miembros: 0, dispositivos: {}, paginas: {}, fuentes: {}, paises: {}, horas: {} });
      let porDia = {};
      const indexar = () => { porDia = {}; datos.dias.forEach(d => { porDia[d.dia] = d; }); };
      indexar();
      const dato = clave => porDia[clave] || cero(clave);
      const origenes = () => (datos.origenes || []).map(o => ({ ...o, dia: o.creada ? String(o.creada).slice(0, 10) : null }));
      // 'creada' viene en UTC; el día que importa es el de México
      const diaMx = iso => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: datos.zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch (e) { return String(iso).slice(0, 10); } };
      const cuentas = () => (datos.origenes || []).map(o => ({ ...o, dia: o.creada ? diaMx(o.creada) : null })).filter(o => o.dia);

      // ── Rango activo: periodo actual y el anterior (para comparar) ──
      const rangoActual = () => {
        const primerDia = datos.dias[0].dia;
        if (estado.rango === 'semana') {
          const lunes = sumarDias(lunesDe(hoy), -7 * estado.semana);
          const hasta = sumarDias(lunes, 6);
          const parcial = hasta > hoy;
          const finVisto = parcial ? hoy : hasta;
          const largo = lista(lunes, finVisto).length;
          const pLunes = sumarDias(lunes, -7);
          return { desde: lunes, hasta: finVisto, completo: hasta, prev: lista(pLunes, sumarDias(pLunes, largo - 1)), parcial, titulo: corta(lunes) + ' – ' + corta(hasta) };
        }
        if (estado.rango === 'todo') {
          const con = datos.dias.find(d => d.total > 0);
          const desde = con ? con.dia : sumarDias(hoy, -29);
          return { desde, hasta: hoy, prev: [], titulo: 'Todo el historial' };
        }
        const n = Number(estado.rango);
        const desde = sumarDias(hoy, -(n - 1));
        const pDesde = sumarDias(desde, -n);
        return { desde: desde < primerDia && n > diasCargados ? primerDia : desde, hasta: hoy, prev: lista(pDesde, sumarDias(desde, -1)), titulo: 'Últimos ' + (n === 365 ? '12 meses' : n + ' días') };
      };

      const suma = (claves, campo) => claves.reduce((t, c) => t + (dato(c)[campo] || 0), 0);
      const sumaMapa = (claves, campo) => { const o = {}; claves.forEach(c => Object.entries(dato(c)[campo] || {}).forEach(([k, v]) => { o[k] = (o[k] || 0) + v; })); return o; };
      const delta = (ahora, antes, hayPrev) => {
        if (!hayPrev) return '';
        if (!antes && !ahora) return '<span class="mx2-d eq">— sin cambio</span>';
        if (!antes) return '<span class="mx2-d up">▲ nuevo</span>';
        const pct = Math.round((ahora - antes) / antes * 100);
        if (pct === 0) return '<span class="mx2-d eq">= igual que antes</span>';
        return '<span class="mx2-d ' + (pct > 0 ? 'up">▲ +' : 'down">▼ ') + Math.abs(pct) + '% vs periodo anterior</span>';
      };
      const spark = (vals, color) => {
        const max = Math.max(1, ...vals), w = 200, h = 34;
        if (vals.length < 2) return '';
        const pts = vals.map((v, i) => [i / (vals.length - 1) * w, h - 3 - v / max * (h - 8)]);
        const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
        const id = 'sp' + Math.random().toString(36).slice(2, 7);
        return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
      };
      const filas = (obj, nombres, color) => {
        const orden = Object.entries(obj).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const max = Math.max(1, ...orden.map(o => o[1]));
        return orden.length ? orden.map(([k, v]) => `<div class="mx2-row"><span class="mx2-row__t">${esc(nombres[k] || k)}</span><span class="mx2-row__n">${num(v)}</span><div class="mx2-row__b"><i data-w="${Math.round(v / max * 100)}"${color ? ' style="background:' + color(k) + '"' : ''}></i></div></div>`).join('')
          : '<div class="mx2-empty">Sin datos en este periodo</div>';
      };

      // ── Estilo común de Chart.js ──
      const colorTexto = () => (getComputedStyle(document.body).getPropertyValue('--text-3').trim() || '#6b7280');
      const colorLinea = () => (getComputedStyle(document.body).getPropertyValue('--border').trim() || 'rgba(0,0,0,.08)');
      const crear = (canvas, config) => {
        if (!canvas || typeof Chart === 'undefined') return null;
        Chart.defaults.font.family = "Inter, system-ui, sans-serif";
        Chart.defaults.font.size = 12;
        const c = new Chart(canvas, config);
        MK._mxCharts.push(c);
        return c;
      };
      const tooltip = { backgroundColor: '#0b1f3a', titleColor: '#fff', bodyColor: '#E3EEF8', padding: 12, cornerRadius: 12, boxPadding: 5, titleFont: { weight: '700', size: 13 }, bodyFont: { size: 12 } };
      const degradado = (color, alto) => ctx => {
        const area = ctx.chart.chartArea; if (!area) return color + '33';
        const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, color + '59'); g.addColorStop(1, color + '00'); return g;
      };
      const ejes = (extra) => ({
        x: { grid: { display: false }, border: { display: false }, ticks: { color: colorTexto(), maxRotation: 0, autoSkipPadding: 14 } },
        y: { beginAtZero: true, grid: { color: colorLinea(), drawTicks: false }, border: { display: false }, ticks: { color: colorTexto(), precision: 0, padding: 8 }, ...(extra || {}) }
      });

      const dibujar = () => {
        (MK._mxCharts || []).forEach(c => { try { c.destroy(); } catch (e) {} });
        MK._mxCharts = [];
        const R = rangoActual();
        const claves = lista(R.desde, R.hasta);
        const hayPrev = R.prev.length > 0 && suma(R.prev, 'total') + suma(R.prev, 'unicos') > 0;
        const total = suma(claves, 'total'), unicos = suma(claves, 'unicos');
        const totalPrev = suma(R.prev, 'total'), unicosPrev = suma(R.prev, 'unicos');
        const todasCuentas = cuentas();
        const enRango = lista0 => todasCuentas.filter(o => lista0.includes(o.dia));
        const nuevas = enRango(claves), nuevasPrev = enRango(R.prev);
        const vipNuevos = nuevas.filter(o => o.vip).length;
        const promedio = Math.round(total / Math.max(1, claves.length));
        const hayAlgo = datos.dias.some(d => d.total > 0) || (datos.miembros || []).length || todasCuentas.length;
        const est = datos.estado || null;
        const estadoHtml = est ? (est.errores > 0 && !est.ultimoOk ? `<span class="mx2-estado error" title="${esc((est.ultimoError && est.ultimoError.mensaje) || '')}"><i></i>El contador tuvo errores</span>`
          : est.ultimoOk ? `<span class="mx2-estado ok"><i></i>Contador activo · última visita ${esc(new Date(est.ultimoOk).toLocaleString('es-MX', { timeZone: datos.zona, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</span>`
          : '<span class="mx2-estado"><i></i>Contador activo · esperando la primera visita</span>') : '';

        const barra = `
          <div class="mx2-bar">
            <div class="mx2-seg" role="tablist">${RANGOS.map(([k, t]) => `<button type="button" role="tab" data-r="${k}" class="${estado.rango === k ? 'on' : ''}">${t}</button>`).join('')}</div>
            ${estado.rango === 'semana' ? `<div class="mx2-semnav"><button type="button" id="mx2-ant" aria-label="Semana anterior" ${estado.semana >= 51 ? 'disabled' : ''}>‹</button><span>${esc(R.titulo)}<small>${estado.semana === 0 ? 'ESTA SEMANA' : 'HACE ' + estado.semana + (estado.semana === 1 ? ' SEMANA' : ' SEMANAS')}</small></span><button type="button" id="mx2-sig" aria-label="Semana siguiente" ${estado.semana === 0 ? 'disabled' : ''}>›</button></div>` : `<span style="font:700 13px 'Plus Jakarta Sans',Inter,sans-serif">${esc(R.titulo)}</span>`}
            <button type="button" class="mx2-btn" id="mx2-csv"><svg class="ic" width="15" height="15"><use href="#i-download"/></svg>Descargar historial (CSV)</button>
          </div>`;

        const cab = `
          <div class="mx2-hero">
            <div><span class="mx2-eyebrow">Marketing</span><h1>Métricas de visitas</h1>
            <p>Cuánta gente visita ICADEM, desde dónde llega y de qué red social salen tus miembros. Conteo anónimo y sin cookies; todo se guarda día a día para que consultes el historial.</p>${datos.importacion ? `<p style="margin-top:6px;font-size:12px;color:var(--text-3)">Del ${esc(corta(datos.importacion.desde))} al ${esc(corta(datos.importacion.hasta))} los datos vienen del contador anterior de ICADEM: visitas, personas, horas, páginas y miembros. Origen, país y dispositivo se registran a partir del contador nuevo.</p>` : ''}</div>
            ${estadoHtml}
          </div>`;

        if (!hayAlgo) {
          raiz.innerHTML = cab + `<div class="mx2-card"><div class="mx2-empty mx2-big"><b>Todavía no hay visitas registradas</b>El contador ya está encendido. En cuanto entre la primera persona al sitio verás aquí las gráficas, y el historial se irá guardando solo, día tras día.</div></div>`;
          return;
        }

        // ── Serie del gráfico principal ──
        let serie;
        if (estado.rango === 'semana') {
          const lunes = R.desde;
          serie = { tipo: 'barras', etiquetas: DIAS, visitas: DIAS.map((_, i) => { const c = sumarDias(lunes, i); return c > hoy ? null : dato(c).total; }), unicos: DIAS.map((_, i) => { const c = sumarDias(lunes, i); return c > hoy ? null : dato(c).unicos; }) };
        } else if (estado.rango === '30' || estado.rango === '90') {
          serie = { tipo: 'linea', etiquetas: claves.map(corta), visitas: claves.map(c => dato(c).total), unicos: claves.map(c => dato(c).unicos), previa: R.prev.map(c => dato(c).total) };
        } else {
          const meses = {};
          claves.forEach(c => { const k = c.slice(0, 7); meses[k] = meses[k] || { v: 0, u: 0 }; meses[k].v += dato(c).total; meses[k].u += dato(c).unicos; });
          const ks = Object.keys(meses).sort();
          serie = { tipo: 'barras', etiquetas: ks.map(k => mesDe(k + '-01')), visitas: ks.map(k => meses[k].v), unicos: ks.map(k => meses[k].u) };
        }

        // Los mismos grupos de la gráfica principal (días o meses), para repartir las redes sociales en el tiempo
        let grupos;
        if (estado.rango === 'semana') grupos = DIAS.map((_, i) => { const c = sumarDias(R.desde, i); return c > hoy ? [] : [c]; });
        else if (estado.rango === '30' || estado.rango === '90') grupos = claves.map(c => [c]);
        else { const m = {}; claves.forEach(c => { (m[c.slice(0, 7)] = m[c.slice(0, 7)] || []).push(c); }); grupos = Object.keys(m).sort().map(k => m[k]); }

        // ── Origen de los miembros ──
        const porOrigen = {};
        nuevas.forEach(o => { const k = o.origen || 'directo'; porOrigen[k] = porOrigen[k] || { n: 0, vip: 0 }; porOrigen[k].n += 1; if (o.vip) porOrigen[k].vip += 1; });
        const ordenOrigen = Object.entries(porOrigen).sort((a, b) => b[1].n - a[1].n);
        const ganador = ordenOrigen[0];
        const sinDato = Number(datos.sinOrigen) || 0;

        // ── Datos de apoyo ──
        const disp = sumaMapa(claves, 'dispositivos');
        const totDisp = Object.values(disp).reduce((a, b) => a + b, 0);
        const paises = sumaMapa(claves, 'paises');
        const totPaises = Object.values(paises).reduce((a, b) => a + b, 0);
        const topPaises = Object.entries(paises).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const fueraMx = totPaises - (paises.MX || 0) - (paises.ZZ || 0);
        const fuentes = sumaMapa(claves, 'fuentes');
        const ordenFuentes = Object.entries(fuentes).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const totFuentes = ordenFuentes.reduce((a, [, v]) => a + v, 0);
        const REDES = ['facebook', 'instagram', 'meta', 'whatsapp', 'tiktok', 'youtube', 'linkedin', 'x'];
        const sociales = REDES.map(k => ({ k, total: fuentes[k] || 0 })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        const totSociales = sociales.reduce((a, x) => a + x.total, 0);
        const serieRedes = sociales.slice(0, 5).map(x => ({ k: x.k, datos: grupos.map(g => g.reduce((t, c) => t + (((dato(c).fuentes || {})[x.k]) || 0), 0)) }));
        const redesVacio = '<div class="mx2-empty"><b>Todavía nadie ha llegado desde una red social</b>Aquí verás cuántas personas llegan desde cada una. Comparte tus enlaces con <code>?utm_source=facebook</code> o <code>?utm_source=instagram</code> para medirlo con exactitud.<div class="mx2-leg" style="justify-content:center;margin-top:14px">' + REDES.map(k => `<span><i style="background:${COLOR_FUENTE[k]};border-radius:50%"></i>${NOMBRE_FUENTE[k]} <b>0</b></span>`).join('') + '</div></div>';
        const pags = sumaMapa(claves, 'paginas');
        const porSemDia = DIAS.map((_, i) => { const l = claves.filter(c => dow(c) === i); return l.length ? l.reduce((s, c) => s + dato(c).total, 0) / l.length : 0; });
        const diaFuerte = porSemDia.indexOf(Math.max(...porSemDia));
        const mapa = DIAS.map(() => Array(24).fill(0));
        claves.forEach(c => { const h = dato(c).horas || {}; for (let i = 0; i < 24; i++) mapa[dow(c)][i] += Number(h[String(i).padStart(2, '0')]) || 0; });
        const maxMapa = Math.max(1, ...mapa.flat());
        const horaPico = (() => { const t = Array(24).fill(0); mapa.forEach(f => f.forEach((v, i) => { t[i] += v; })); const m = Math.max(...t); return m ? t.indexOf(m) : -1; })();
        const recientes = (datos.recientes || []).map(r => {
          const d = new Date(r.t);
          const ok = !Number.isNaN(d.getTime());
          const p = r.pistas || {};
          const pistas = [p.ref ? 'viene de ' + p.ref : '', p.utm ? 'etiqueta ' + p.utm : '', p.app ? 'app de ' + (NOMBRE_FUENTE[p.app] || p.app) : '', p.fbclid ? 'enlace con marca de Meta' : '', p.igshid ? 'enlace compartido desde Instagram' : ''].filter(Boolean);
          return { ...r,
            pistaTxt: pistas.length ? pistas.join(' · ') : 'sin pistas del origen',
            hora: ok ? d.toLocaleTimeString('es-MX', { timeZone: datos.zona, hour: 'numeric', minute: '2-digit' }) : '',
            fecha: ok ? d.toLocaleDateString('es-MX', { timeZone: datos.zona, day: 'numeric', month: 'short' }) : '' };
        });
        const quienes = (datos.miembros || []).map(m => ({ ...m, enRango: claves.reduce((s, c) => s + ((m.dias || {})[c] || 0), 0), act: claves.map(c => (m.dias || {})[c] || 0) })).filter(m => m.enRango > 0).sort((a, b) => b.enRango - a.enRango).slice(0, 15);
        const origenDe = new Map((datos.origenes || []).map(o => [o.uid, o]));
        const anonimos = Math.max(0, unicos - (datos.miembros || []).filter(m => claves.some(c => (m.dias || {})[c])).length);

        // ── Tarjeta "Visitas por periodo": el registro de visitas (guardado en el servidor) por Hoy, Ayer, 7 y 30 días ──
        const PERIODOS = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['7', '7 días'], ['30', '30 días']];
        if (!estado.periodo) estado.periodo = 'hoy';
        if (!estado.visibles) estado.visibles = 10;
        const clavesPeriodo = k => k === 'hoy' ? [hoy] : k === 'ayer' ? [sumarDias(hoy, -1)] : lista(sumarDias(hoy, -(Number(k) - 1)), hoy);
        const enriquecerVisita = r => {
          const d = new Date(r.t);
          const ok = !Number.isNaN(d.getTime());
          const p = r.pistas || {};
          const pistas = [p.ref ? 'viene de ' + p.ref : '', p.utm ? 'etiqueta ' + p.utm : '', p.app ? 'app de ' + (NOMBRE_FUENTE[p.app] || p.app) : '', p.fbclid ? 'enlace con marca de Meta' : '', p.igshid ? 'enlace compartido desde Instagram' : ''].filter(Boolean);
          return { ...r, pistaTxt: pistas.length ? pistas.join(' · ') : 'sin pistas del origen',
            hora: ok ? d.toLocaleTimeString('es-MX', { timeZone: datos.zona, hour: 'numeric', minute: '2-digit' }) : '',
            fecha: ok ? d.toLocaleDateString('es-MX', { timeZone: datos.zona, day: 'numeric', month: 'short' }) : '' };
        };
        const filaVisita = r => '<div class="mx2-r2"><span class="mx2-rec__t">' + esc(r.hora) + ' · ' + esc(r.fecha) + '</span>'
          + '<span class="mx2-rec__o"><i style="background:' + (COLOR_FUENTE[r.fuente] || '#64748B') + '"></i>' + esc(NOMBRE_FUENTE[r.fuente] || r.fuente) + '</span>'
          + '<span class="mx2-r2__m"><strong>' + esc(nombrePais(r.pais)) + '</strong> · ' + esc(NOMBRE_DISP[r.dispositivo] || '') + (r.nuevo ? ' · primera del día' : '') + '</span>'
          + '<span class="mx2-r2__p" title="' + esc(r.pistaTxt) + '">' + esc(r.pistaTxt) + '</span></div>';
        const tarjetaVisitas = '<div class="mx2-card" style="margin-bottom:16px" id="mx2-per">'
          + '<div class="mx2-head"><div><h3>Visitas por periodo</h3><p class="mx2-sub" style="margin-bottom:6px" id="mx2-per-resumen">&nbsp;</p></div>'
          + '<div class="mx2-seg2" role="tablist">' + PERIODOS.map(([k, t]) => '<button type="button" role="tab" data-per="' + k + '" class="' + (estado.periodo === k ? 'on' : '') + '">' + t + '</button>').join('') + '</div></div>'
          + '<div class="mx2-log" id="mx2-log"><div class="mx2-empty" style="padding:22px 10px">Cargando visitas…</div></div>'
          + '<button type="button" class="mx2-mas" id="mx2-log-mas" style="display:none"></button>'
          + '<div class="mx2-log__pie"><span id="mx2-log-hora">Cada visita se guarda sola al ocurrir, sin datos personales.</span><button type="button" class="mx2-btn" id="mx2-rec-actualizar">Actualizar</button></div></div>';

        raiz.innerHTML = cab + barra + `
          <div class="mx2-kpis">
            <div class="mx2-kpi" style="--c:${VERDE}"><div class="mx2-kpi__l">Visitas</div><div class="mx2-kpi__v">${num(total)}</div><div class="mx2-kpi__s">Páginas vistas</div>${delta(total, totalPrev, hayPrev)}${spark(claves.map(c => dato(c).total), VERDE)}</div>
            <div class="mx2-kpi" style="--c:${AZUL}"><div class="mx2-kpi__l">Personas distintas</div><div class="mx2-kpi__v">${num(unicos)}</div><div class="mx2-kpi__s">Visitantes únicos por día, sumados</div>${delta(unicos, unicosPrev, hayPrev)}${spark(claves.map(c => dato(c).unicos), AZUL)}</div>
            <div class="mx2-kpi" style="--c:#F7941D"><div class="mx2-kpi__l">Cuentas nuevas</div><div class="mx2-kpi__v">${num(nuevas.length)}</div><div class="mx2-kpi__s">${vipNuevos ? num(vipNuevos) + ' ya son VIP' : 'Personas que crearon su cuenta'}</div>${delta(nuevas.length, nuevasPrev.length, hayPrev && nuevasPrev.length > 0)}${spark(claves.map(c => todasCuentas.filter(o => o.dia === c).length), '#F7941D')}</div>
            <div class="mx2-kpi" style="--c:#8B5CF6"><div class="mx2-kpi__l">Promedio por día</div><div class="mx2-kpi__v">${num(promedio)}</div><div class="mx2-kpi__s">${horaPico >= 0 ? 'Hora pico: ' + (horaPico % 12 || 12) + (horaPico < 12 ? ' a. m.' : ' p. m.') : 'Aún sin visitas'}</div>${spark(claves.map(c => dato(c).total), '#8B5CF6')}</div>
          </div>

          <div class="mx2-card" style="margin-bottom:16px">
            <div class="mx2-head"><div><h3>${estado.rango === 'semana' ? 'Visitas por día de la semana' : estado.rango === '365' || estado.rango === 'todo' ? 'Visitas por mes' : 'Visitas día a día'}</h3><p class="mx2-sub" style="margin-bottom:6px">${estado.rango === 'semana' ? 'De lunes a domingo; los días que aún no pasan quedan vacíos.' : serie.previa && hayPrev ? 'La línea punteada es el periodo anterior, para comparar.' : 'Evolución del periodo seleccionado.'}</p></div>
              <div class="mx2-leg"><span><i style="background:${VERDE}"></i>Visitas</span><span><i style="background:${AZUL}"></i>Personas distintas</span>${serie.previa && hayPrev ? '<span><i style="background:#94A3B8"></i>Periodo anterior</span>' : ''}</div></div>
            <div class="mx2-cv" style="height:300px"><canvas id="mx2-principal"></canvas></div>
          </div>

          ${tarjetaVisitas}

          <div class="mx2-card mx2-hero-card" style="margin-bottom:16px">
            <h3>¿De dónde vienen tus miembros?</h3>
            <p class="mx2-sub">Cuentas creadas en este periodo, según la red social o el enlace por el que llegaron${sinDato ? ' · ' + num(sinDato) + ' cuentas anteriores al contador no tienen origen' : ''}.</p>
            ${ordenOrigen.length ? `
              <div class="mx2-top"><b style="background:${COLOR_FUENTE[ganador[0]] || '#64748B'}">${esc((NOMBRE_FUENTE[ganador[0]] || ganador[0]).slice(0, 1))}</b><div><strong>${esc(NOMBRE_FUENTE[ganador[0]] || ganador[0])}</strong> es de donde más miembros llegaron: <strong>${num(ganador[1].n)}</strong> de ${num(nuevas.length)} cuentas nuevas (${Math.round(ganador[1].n / nuevas.length * 100)}%)${ganador[1].vip ? ', y <strong>' + num(ganador[1].vip) + '</strong> ya son VIP' : ''}.</div></div>
              <div class="mx2-g2" style="display:grid;gap:18px;align-items:start">
                <div class="mx2-cv" style="height:${Math.max(180, ordenOrigen.length * 46 + 40)}px"><canvas id="mx2-origen"></canvas></div>
                <table class="mx2-tbl"><thead><tr><th>Origen</th><th>Cuentas</th><th>VIP</th><th>Conversión</th></tr></thead><tbody>
                  ${ordenOrigen.map(([k, v]) => `<tr><td><span class="mx2-dot" style="background:${COLOR_FUENTE[k] || '#64748B'}"></span>${esc(NOMBRE_FUENTE[k] || k)}</td><td>${num(v.n)}</td><td>${num(v.vip)}</td><td><span class="mx2-pill">${Math.round(v.vip / v.n * 100)}%</span></td></tr>`).join('')}
                </tbody></table>
              </div>` : `<div class="mx2-empty"><b>Aún no hay cuentas con origen en este periodo</b>Desde que se publicó el contador, cada cuenta nueva guarda por dónde llegó (Facebook, Instagram, Google, WhatsApp…). Cuando alguien se registre lo verás aquí.</div>`}
          </div>

          <div class="mx2-grid mx2-g2">
            <div class="mx2-card"><h3>Redes sociales · ¿cuánta gente llega de cada una?</h3>
              <p class="mx2-sub">${totSociales ? '<strong>' + num(totSociales) + '</strong> de ' + num(totFuentes) + ' personas (' + Math.round(totSociales / Math.max(1, totFuentes) * 100) + '%) llegaron desde una red social. La más fuerte: <strong>' + esc(NOMBRE_FUENTE[sociales[0].k]) + '</strong>.' : 'Personas que llegaron desde Facebook, Instagram, WhatsApp, TikTok y más.'}</p>
              ${sociales.length ? `<div class="mx2-cv" style="height:${Math.max(170, sociales.length * 44 + 30)}px"><canvas id="mx2-redes"></canvas></div>` : redesVacio}</div>
            <div class="mx2-card"><h3>Redes sociales a lo largo del tiempo</h3>
              <p class="mx2-sub">Cuántas personas llegaron de cada red ${estado.rango === '365' || estado.rango === 'todo' ? 'mes a mes' : 'día a día'}.</p>
              ${sociales.length ? `<div class="mx2-cv" style="height:${Math.max(220, sociales.length * 44 + 30)}px"><canvas id="mx2-redes-tiempo"></canvas></div>` : redesVacio}</div>
          </div>

          <div class="mx2-grid mx2-g2">
            <div class="mx2-card"><h3>¿Qué día entra más gente?</h3><p class="mx2-sub">Promedio de visitas por día de la semana en el periodo.${porSemDia[diaFuerte] > 0 ? ' El más fuerte: <strong>' + DIAS[diaFuerte] + '</strong>.' : ''}</p><div class="mx2-cv" style="height:250px"><canvas id="mx2-semana"></canvas></div></div>
            <div class="mx2-card"><h3>Mapa de calor · día y hora</h3><p class="mx2-sub">Cuándo entra la gente (hora de México). Más oscuro = más visitas.</p>
              <div class="mx2-heat">${DIAS.map((n, d) => `<span>${n}</span>` + mapa[d].map((v, h) => `<i title="${n} ${h}:00 · ${v} visitas" style="background:${v ? 'color-mix(in srgb,#5b92c8 ' + Math.max(15, Math.round(v / maxMapa * 100)) + '%,var(--surface-2))' : 'var(--surface-2)'}"></i>`).join('')).join('')}</div>
              <div class="mx2-hl"><span></span>${Array.from({ length: 24 }, (_, h) => `<span>${h % 6 === 0 ? (h % 12 || 12) + (h < 12 ? 'a' : 'p') : ''}</span>`).join('')}</div></div>
          </div>

          <div class="mx2-grid mx2-g3">
            <div class="mx2-card"><h3>Países</h3><p class="mx2-sub">${totPaises ? (fueraMx > 0 ? 'Hubo <strong>' + num(fueraMx) + '</strong> persona' + (fueraMx === 1 ? '' : 's') + ' de fuera de México.' : 'Por ahora todas las visitas identificadas son de México.') : 'Aún sin visitas.'}</p><div class="mx2-cv" style="height:${Math.max(160, topPaises.length * 36 + 30)}px"><canvas id="mx2-paises"></canvas></div></div>
            <div class="mx2-card"><h3>Dispositivos</h3><p class="mx2-sub">Desde qué aparato entra la gente.</p><div class="mx2-cv" style="height:210px"><canvas id="mx2-disp"></canvas></div>
              <div class="mx2-leg" style="justify-content:center;margin-top:12px">${Object.keys(NOMBRE_DISP).map(k => `<span><i style="background:${COLOR_DISP[k]};border-radius:50%"></i>${NOMBRE_DISP[k]} <b>${totDisp ? Math.round((disp[k] || 0) / totDisp * 100) : 0}%</b></span>`).join('')}</div></div>
            <div class="mx2-card"><h3>Cómo llegan al sitio</h3><p class="mx2-sub">Por dónde entró cada persona en su primera visita del día.</p>${ordenFuentes.length ? `<div class="mx2-cv" style="height:210px"><canvas id="mx2-fuentes"></canvas></div>
              <div class="mx2-leg" style="margin-top:12px">${ordenFuentes.slice(0, 6).map(([k, v]) => `<span><i style="background:${COLOR_FUENTE[k] || '#64748B'};border-radius:50%"></i>${esc(NOMBRE_FUENTE[k] || k)} <b>${Math.round(v / totFuentes * 100)}%</b></span>`).join('')}</div>` : '<div class="mx2-empty">Sin datos en este periodo</div>'}</div>
          </div>

          <div class="mx2-grid mx2-g2">
            <div class="mx2-card"><h3>Páginas más vistas</h3><p class="mx2-sub">Dónde entra la gente.</p>${filas(pags, NOMBRE_PAGINA)}</div>
            <div class="mx2-card"><h3>Quiénes entraron al panel</h3><p class="mx2-sub">Miembros con sesión iniciada en el periodo${anonimos ? '. Además hubo <strong>' + num(anonimos) + '</strong> visitantes anónimos que no se identifican' : ''}.</p>
              ${quienes.length ? quienes.map(m => {
                const ini = (m.nombre || m.email || '?').trim().slice(0, 2).toUpperCase();
                const o = origenDe.get(m.uid);
                const ult = m.ultima ? new Date(m.ultima).toLocaleString('es-MX', { timeZone: datos.zona, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
                return `<div class="mx2-q"><div class="mx2-q__av">${esc(ini)}</div><div class="mx2-q__m"><div class="mx2-q__n">${esc(m.nombre || 'Sin nombre')}</div><div class="mx2-q__e">${esc(m.email)}</div><div class="mx2-q__tags">${o ? '<span class="mx2-q__tag">' + esc(NOMBRE_FUENTE[o.origen] || o.origen) + '</span>' : ''}${o && o.vip ? '<span class="mx2-q__tag vip">VIP</span>' : ''}</div></div><div class="mx2-q__u">${num(m.enRango)} visita${m.enRango === 1 ? '' : 's'}<br>${esc(ult)}</div></div>`;
              }).join('') : '<div class="mx2-empty">Ningún miembro entró al panel en este periodo.</div>'}
            </div>
          </div>`;

        // ── Gráficas ──
        const ej = ejes();
        if (serie.tipo === 'linea') {
          crear(raiz.querySelector('#mx2-principal'), { type: 'line', data: { labels: serie.etiquetas, datasets: [
            { label: 'Visitas', data: serie.visitas, borderColor: VERDE, backgroundColor: degradado(VERDE), fill: true, tension: .38, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: '#fff', pointHoverBorderColor: VERDE, pointHoverBorderWidth: 3 },
            { label: 'Personas distintas', data: serie.unicos, borderColor: AZUL, backgroundColor: degradado(AZUL), fill: true, tension: .38, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: '#fff', pointHoverBorderColor: AZUL, pointHoverBorderWidth: 3 },
            ...(hayPrev ? [{ label: 'Periodo anterior', data: serie.previa, borderColor: '#94A3B8', borderDash: [6, 6], borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 0, fill: false, tension: .38 }] : [])
          ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip }, scales: ej } });
        } else {
          crear(raiz.querySelector('#mx2-principal'), { type: 'bar', data: { labels: serie.etiquetas, datasets: [
            { label: 'Visitas', data: serie.visitas, backgroundColor: ctx => { const a = ctx.chart.chartArea; if (!a) return VERDE; const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, '#8fbce6'); g.addColorStop(1, VERDE_OSC); return g; }, borderRadius: 10, borderSkipped: false, maxBarThickness: 38 },
            { label: 'Personas distintas', data: serie.unicos, backgroundColor: ctx => { const a = ctx.chart.chartArea; if (!a) return AZUL; const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, '#6ee7b7'); g.addColorStop(1, '#2563EB'); return g; }, borderRadius: 10, borderSkipped: false, maxBarThickness: 38 }
          ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip }, scales: ej } });
        }
        if (ordenOrigen.length) {
          crear(raiz.querySelector('#mx2-origen'), { type: 'bar', data: { labels: ordenOrigen.map(([k]) => NOMBRE_FUENTE[k] || k), datasets: [
            { label: 'Cuentas creadas', data: ordenOrigen.map(([, v]) => v.n), backgroundColor: ordenOrigen.map(([k]) => COLOR_FUENTE[k] || '#64748B'), borderRadius: 8, borderSkipped: false, barThickness: 20 },
            { label: 'Ya son VIP', data: ordenOrigen.map(([, v]) => v.vip), backgroundColor: ordenOrigen.map(([k]) => (COLOR_FUENTE[k] || '#64748B') + '55'), borderColor: ordenOrigen.map(([k]) => COLOR_FUENTE[k] || '#64748B'), borderWidth: 1.5, borderRadius: 8, borderSkipped: false, barThickness: 12 }
          ] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: colorTexto() } }, tooltip }, scales: { x: { beginAtZero: true, grid: { color: colorLinea() }, border: { display: false }, ticks: { precision: 0, color: colorTexto() } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: colorTexto(), font: { weight: '600' } } } } } });
        }
        if (sociales.length) {
          crear(raiz.querySelector('#mx2-redes'), { type: 'bar', data: { labels: sociales.map(x => NOMBRE_FUENTE[x.k]), datasets: [{ label: 'Personas', data: sociales.map(x => x.total), backgroundColor: sociales.map(x => COLOR_FUENTE[x.k]), borderRadius: 10, borderSkipped: false, barThickness: 22 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: c => ' ' + num(c.parsed.x) + ' personas (' + Math.round(c.parsed.x / Math.max(1, totSociales) * 100) + '% de las redes)' } } }, scales: { x: { beginAtZero: true, grid: { color: colorLinea() }, border: { display: false }, ticks: { precision: 0, color: colorTexto() } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: colorTexto(), font: { weight: '600' } } } } } });
          crear(raiz.querySelector('#mx2-redes-tiempo'), { type: 'bar', data: { labels: serie.etiquetas, datasets: serieRedes.map(s => ({ label: NOMBRE_FUENTE[s.k], data: s.datos, backgroundColor: COLOR_FUENTE[s.k], borderRadius: 4, borderSkipped: false, maxBarThickness: 30 })) }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: colorTexto() } }, tooltip }, scales: { x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: colorTexto(), maxRotation: 0, autoSkipPadding: 14 } }, y: { stacked: true, beginAtZero: true, grid: { color: colorLinea(), drawTicks: false }, border: { display: false }, ticks: { color: colorTexto(), precision: 0, padding: 8 } } } } });
        }
        crear(raiz.querySelector('#mx2-semana'), { type: 'bar', data: { labels: DIAS, datasets: [{ label: 'Visitas por día (promedio)', data: porSemDia.map(v => Math.round(v * 10) / 10), backgroundColor: porSemDia.map((v, i) => (i === diaFuerte && v > 0 ? VERDE : VERDE + '66')), borderRadius: 10, borderSkipped: false, maxBarThickness: 34 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip }, scales: ej } });
        if (topPaises.length) {
          crear(raiz.querySelector('#mx2-paises'), { type: 'bar', data: { labels: topPaises.map(([k]) => nombrePais(k)), datasets: [{ label: 'Personas', data: topPaises.map(([, v]) => v), backgroundColor: topPaises.map(([k], i) => (k === 'MX' ? VERDE : AZUL + (i % 2 ? 'AA' : 'CC'))), borderRadius: 8, borderSkipped: false, barThickness: 18 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip }, scales: { x: { beginAtZero: true, grid: { color: colorLinea() }, border: { display: false }, ticks: { precision: 0, color: colorTexto() } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: colorTexto(), font: { weight: '600' } } } } } });
        }
        const centro = texto => ({ id: 'centro', afterDraw(c) { const { ctx, chartArea: a } = c; ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#111'; ctx.font = "800 28px 'Plus Jakarta Sans',Inter,sans-serif"; ctx.fillText(texto, (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 4); ctx.fillStyle = colorTexto(); ctx.font = "600 10px 'JetBrains Mono',monospace"; ctx.fillText('PERSONAS', (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 22); ctx.restore(); } });
        crear(raiz.querySelector('#mx2-disp'), { type: 'doughnut', data: { labels: Object.values(NOMBRE_DISP), datasets: [{ data: Object.keys(NOMBRE_DISP).map(k => disp[k] || 0), backgroundColor: Object.keys(NOMBRE_DISP).map(k => COLOR_DISP[k]), borderWidth: 0, hoverOffset: 6, borderRadius: 6, spacing: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip } }, plugins: [centro(num(totDisp))] });
        if (ordenFuentes.length) {
          crear(raiz.querySelector('#mx2-fuentes'), { type: 'doughnut', data: { labels: ordenFuentes.map(([k]) => NOMBRE_FUENTE[k] || k), datasets: [{ data: ordenFuentes.map(([, v]) => v), backgroundColor: ordenFuentes.map(([k]) => COLOR_FUENTE[k] || '#64748B'), borderWidth: 0, hoverOffset: 6, borderRadius: 6, spacing: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip } }, plugins: [centro(num(totFuentes))] });
        }
        requestAnimationFrame(() => requestAnimationFrame(() => raiz.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; })));

        // ── Interacciones ──
        raiz.querySelectorAll('.mx2-seg button').forEach(b => b.addEventListener('click', async () => {
          const r = b.dataset.r;
          estado.rango = r; estado.semana = 0;
          if ((r === 'todo' || r === '365') && diasCargados < 730 && !pintar._pidio) {
            pintar._pidio = true;
            raiz.querySelectorAll('.mx2-seg button').forEach(x => { x.disabled = true; });
            try { const mas = await cargar(730); datos.dias = mas.dias; datos.miembros = mas.miembros; datos.origenes = mas.origenes; datos.sinOrigen = mas.sinOrigen; diasCargados = mas.dias.length; indexar(); } catch (e) { /* se queda con lo cargado */ }
          }
          dibujar();
        }));
        // Registro de visitas por periodo: se pide al servidor, se guarda en memoria un momento y se actualiza solo cada minuto
        const cacheLog = estado.cacheLog || (estado.cacheLog = {});
        const pintarLog = () => {
          const cuerpoLog = raiz.querySelector('#mx2-log');
          if (!cuerpoLog) return;
          const cl = clavesPeriodo(estado.periodo);
          const resumen = raiz.querySelector('#mx2-per-resumen');
          if (resumen) resumen.innerHTML = '<strong>' + num(suma(cl, 'total')) + '</strong> visitas · <strong>' + num(suma(cl, 'unicos')) + '</strong> personas en este periodo';
          const c = cacheLog[estado.periodo];
          const mas = raiz.querySelector('#mx2-log-mas');
          if (!c) { cuerpoLog.innerHTML = '<div class="mx2-empty" style="padding:22px 10px">Cargando visitas…</div>'; if (mas) mas.style.display = 'none'; return; }
          const visibles = estado.visibles;
          cuerpoLog.innerHTML = c.items.length ? c.items.slice(0, visibles).map(filaVisita).join('') : '<div class="mx2-empty" style="padding:22px 10px">Sin visitas registradas en este periodo.</div>';
          const faltan = c.items.length - visibles;
          if (mas) { mas.style.display = faltan > 0 ? '' : 'none'; mas.textContent = 'Ver más (' + faltan + ' restantes)'; }
          const pie = raiz.querySelector('#mx2-log-hora');
          if (pie) pie.textContent = 'Se guarda cada visita sola, sin datos personales · actualizado ' + new Date(c.t).toLocaleTimeString('es-MX', { timeZone: datos.zona, hour: 'numeric', minute: '2-digit' });
        };
        const cargarLog = async (k, silencioso) => {
          try {
            await esperarSesion();
            const token = await MK._getAuthToken();
            const r = await fetch(MK._webhookUrl + '/api/admin/visitas?periodo=' + k, { headers: { 'Authorization': 'Bearer ' + token } });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'No se pudo cargar');
            cacheLog[k] = { items: (d.items || []).map(enriquecerVisita), t: Date.now() };
            if (estado.periodo === k) pintarLog();
          } catch (e) {
            if (!silencioso) { const c = raiz.querySelector('#mx2-log'); if (c) c.innerHTML = '<div class="mx2-empty" style="padding:22px 10px">No se pudo cargar el registro: ' + esc(e.message) + '</div>'; }
          }
        };
        pintarLog();
        if (!cacheLog[estado.periodo] || Date.now() - cacheLog[estado.periodo].t > 20000) cargarLog(estado.periodo);
        if (MK._mxTimer) clearInterval(MK._mxTimer);
        MK._mxTimer = setInterval(() => {
          if (!document.getElementById('mx2-log')) { clearInterval(MK._mxTimer); return; }
          if (document.hidden) return;
          cargarLog(estado.periodo, true);
        }, 60000);
        raiz.querySelector('#mx2-log-mas')?.addEventListener('click', () => { estado.visibles += 20; pintarLog(); });
        raiz.querySelectorAll('.mx2-seg2 button').forEach(b => b.addEventListener('click', () => {
          estado.periodo = b.dataset.per;
          estado.visibles = 10;
          raiz.querySelectorAll('.mx2-seg2 button').forEach(x => x.classList.toggle('on', x === b));
          pintarLog();
          if (!cacheLog[estado.periodo] || Date.now() - cacheLog[estado.periodo].t > 20000) cargarLog(estado.periodo);
        }));
        raiz.querySelector('#mx2-rec-actualizar')?.addEventListener('click', async (ev) => {
          const b = ev.currentTarget; b.disabled = true; b.textContent = 'Actualizando…';
          await cargarLog(estado.periodo);
          b.disabled = false; b.textContent = 'Actualizar';
        });
        raiz.querySelector('#mx2-ant')?.addEventListener('click', () => { estado.semana += 1; dibujar(); });
        raiz.querySelector('#mx2-sig')?.addEventListener('click', () => { if (estado.semana > 0) { estado.semana -= 1; dibujar(); } });
        raiz.querySelector('#mx2-csv')?.addEventListener('click', () => {
          const fuentesCols = Object.keys(NOMBRE_FUENTE);
          const filasCsv = [['fecha', 'visitas', 'personas_distintas', 'miembros_que_entraron', 'telefono', 'tableta', 'computadora', ...fuentesCols.map(k => 'origen_' + k), 'paises', 'cuentas_nuevas']];
          const todos = lista(datos.dias[0].dia, hoy);
          todos.forEach(c => { const d = dato(c); filasCsv.push([c, d.total, d.unicos, d.miembros, d.dispositivos.movil || 0, d.dispositivos.tablet || 0, d.dispositivos.computadora || 0, ...fuentesCols.map(k => (d.fuentes || {})[k] || 0), Object.entries(d.paises || {}).map(([k, v]) => k + ':' + v).join('|'), todasCuentas.filter(o => o.dia === c).length]); });
          const csv = '﻿' + filasCsv.map(f => f.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          a.download = 'historial-visitas-icadem-' + hoy + '.csv';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        });
      };
      dibujar();
    };

    cargar(400).then(pintar).catch(err => {
      raiz.innerHTML = `<div class="mx2-card"><div class="mx2-empty"><b>No se pudieron cargar las métricas</b>${esc(err.message)}<br><button type="button" class="mx2-btn" id="mx2-reintentar" style="margin-top:14px">Reintentar</button></div></div>`;
      raiz.querySelector('#mx2-reintentar')?.addEventListener('click', () => MK.metricas(p));
    });
  },

  pruebas(p){
    p.innerHTML = `
      <div class="fade-up">
        <div class="sec-hero">
          <span class="sec-hero__eyebrow">Marketing</span>
          <h1 class="sec-hero__title">Pruebas gratuitas</h1>
          <p class="sec-hero__sub">Qué curso gratuito eligen las cuentas nuevas en el Club VIP y cuántas de ellas terminan pagando la membresía.</p>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card" style="--c1:#5b92c8;--c2:#8fbce6;">
            <div class="kpi-card__label">Pruebas elegidas</div>
            <div class="kpi-card__value" id="pg-kpi-elegidas">—</div>
            <div class="kpi-card__sub" id="pg-kpi-elegidas-sub">—</div>
          </div>
          <div class="kpi-card" style="--c1:#F7941D;--c2:#FBBF24;">
            <div class="kpi-card__label">Cuentas nuevas sin elegir</div>
            <div class="kpi-card__value" id="pg-kpi-sin">—</div>
            <div class="kpi-card__sub">Se registraron y todavía no escogen curso</div>
          </div>
          <div class="kpi-card" style="--c1:#10b981;--c2:#6ee7b7;">
            <div class="kpi-card__label">Eligieron y ya pagaron</div>
            <div class="kpi-card__value" id="pg-kpi-pagaron">—</div>
            <div class="kpi-card__sub" id="pg-kpi-pagaron-sub">—</div>
          </div>
          <div class="kpi-card" style="--c1:#A855F7;--c2:#C084FC;">
            <div class="kpi-card__label">Pagaron sin elegir curso</div>
            <div class="kpi-card__value" id="pg-kpi-pagaron-sin">—</div>
            <div class="kpi-card__sub" id="pg-kpi-pagaron-sin-sub">Para comparar contra los que sí eligieron</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;">
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Cursos más elegidos</h3>
            <canvas id="pg-chart-cursos" height="260"></canvas>
          </div>
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:var(--text);">Pruebas elegidas por día (últimos 14 días)</h3>
            <canvas id="pg-chart-dias" height="260"></canvas>
          </div>
        </div>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:16px;">
          <style>.pg-tabs{display:inline-flex;gap:4px;padding:3px;border:1px solid var(--border);border-radius:999px}.pg-tabs button{border:0;background:transparent;padding:6px 13px;border-radius:999px;font:700 12px Inter,sans-serif;color:var(--text-2);cursor:pointer}.pg-tabs button.on{background:var(--primary);color:#fff}</style>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 12px;">
            <h3 id="pg-lista-titulo" style="margin:0;font-size:14px;color:var(--text);">Últimas pruebas elegidas</h3>
            <div class="pg-tabs" role="tablist" aria-label="Ver cuentas">
              <button type="button" role="tab" data-pg-modo="elegidas" class="on">Eligieron <span id="pg-tab-elegidas"></span></button>
              <button type="button" role="tab" data-pg-modo="sin">Sin elegir <span id="pg-tab-sin"></span></button>
            </div>
          </div>
          <div id="pg-lista" style="font-size:13px;color:var(--text-2);">Cargando…</div>
        </div>
        <p style="font-size:11.5px;color:var(--text-3);margin-top:12px;line-height:1.5;">"Cuentas nuevas" son las creadas desde el <span id="pg-nota-corte">arranque de esta función</span> (la primera vez que alguien eligió su curso gratuito). "Pagó" significa que la cuenta tiene o tuvo una membresía.</p>
      </div>`;
    MK._cargarPruebas();
  },

  async _cargarPruebas(){
    const lista = document.getElementById('pg-lista');
    let miembros = [], cursosPorId = {};
    try {
      await MK._esperarAdmin();
      // ICADEM: la "prueba gratuita" es el curso gratuito que cada cuenta elige en el panel (users/{uid}.freeCourseId, leído por el webhook)
      const { db, collection, getDocs } = window._fb;
      const [mSnap, datos] = await Promise.all([getDocs(collection(db, 'miembros')), MK._api('/api/admin/pruebas')]);
      const porUid = {};
      (datos.items || []).forEach(x => { porUid[x.uid] = x; });
      miembros = mSnap.docs.map(d => {
        const m = { id: d.id, ...d.data() };
        const elegido = porUid[d.id];
        if (elegido) {
          m.cursoPruebaElegido = elegido.titulo || elegido.collectionId;
          m.pruebaElegidaEn = elegido.elegidoEn;
        }
        return m;
      });
      MK._corteIcadem = (datos.items || []).map(x => Date.parse(x.elegidoEn || '')).filter(Number.isFinite).sort((a, b) => a - b)[0] || null;
    } catch (e) {
      console.error('❌ No se pudieron leer las pruebas gratuitas:', e.code || '', e.message);
      if (lista) {
        lista.innerHTML = 'No se pudieron cargar los datos (' + AdminEsc(e.code || e.message || 'error') + '). <a href="#" id="pg-reintentar" style="color:var(--primary);font-weight:700;">Reintentar</a>';
        const re = document.getElementById('pg-reintentar');
        if (re) re.addEventListener('click', ev => { ev.preventDefault(); MK._cargarPruebas(); });
      }
      return;
    }
    // Fecha de arranque de la función en ICADEM: la primera vez que alguien eligió su curso gratuito
    const CORTE = MK._corteIcadem ? new Date(MK._corteIcadem) : new Date(Date.now() - 30 * 86400000);
    const notaCorte = document.getElementById('pg-nota-corte');
    if (notaCorte) notaCorte.textContent = CORTE.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const fechaReg = m => MK._mbToDate(m.fechaRegistro || m.createdAt);
    const pago = m => !!(m.fechaAlta || m.stripeSubscriptionId || m.activa === true || m.activo === true || m.esRegalo === true);
    const nuevas = miembros.filter(m => { const f = fechaReg(m); return f && f >= CORTE; });
    const elegidas = miembros.filter(m => typeof m.cursoPruebaElegido === 'string' && m.cursoPruebaElegido);
    const sinElegir = nuevas.filter(m => !m.cursoPruebaElegido && !pago(m));
    const elegidasPagaron = elegidas.filter(pago);
    const nuevasSinElegir = nuevas.filter(m => !m.cursoPruebaElegido);
    const sinElegirPagaron = nuevasSinElegir.filter(pago);
    const pct = (a, b) => b > 0 ? Math.round(a / b * 100) + '%' : '—';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('pg-kpi-elegidas', elegidas.length);
    set('pg-kpi-elegidas-sub', nuevas.length ? pct(elegidas.length, nuevas.length) + ' de las cuentas nuevas (' + nuevas.length + ')' : 'Aún no hay cuentas nuevas');
    set('pg-kpi-sin', sinElegir.length);
    set('pg-kpi-pagaron', elegidasPagaron.length);
    set('pg-kpi-pagaron-sub', elegidas.length ? pct(elegidasPagaron.length, elegidas.length) + ' de quienes eligieron' : 'Todavía nadie elige');
    set('pg-kpi-pagaron-sin', sinElegirPagaron.length);
    set('pg-kpi-pagaron-sin-sub', nuevasSinElegir.length ? pct(sinElegirPagaron.length, nuevasSinElegir.length) + ' de las cuentas nuevas que no eligieron' : 'Para comparar contra los que sí eligieron');

    // Cursos más elegidos
    const porCurso = {};
    elegidas.forEach(m => { const t = cursosPorId[m.cursoPruebaElegido] || m.cursoPruebaElegido; porCurso[t] = (porCurso[t] || 0) + 1; });
    const ordenCursos = Object.entries(porCurso).sort((a, b) => b[1] - a[1]).slice(0, 12);
    // Por día (últimos 14)
    const dias = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); dias.push(d); }
    const claveDia = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    const porDia = {};
    elegidas.forEach(m => { const f = MK._mbToDate(m.pruebaElegidaEn); if (f) porDia[claveDia(f)] = (porDia[claveDia(f)] || 0) + 1; });

    const mostrarVacio = (cv) => { cv.insertAdjacentHTML('afterend', '<p style="margin:24px 0;text-align:center;font-size:13px;color:var(--text-3);">Aún no hay datos.</p>'); cv.style.display = 'none'; };
    const cvCursos = document.getElementById('pg-chart-cursos');
    const cvDias = document.getElementById('pg-chart-dias');
    if (!window.Chart) {
      [cvCursos, cvDias].forEach(cv => { if (cv) { cv.insertAdjacentHTML('afterend', '<p style="margin:24px 0;text-align:center;font-size:13px;color:var(--text-3);">No se pudo cargar la librería de gráficas. Recarga la página.</p>'); cv.style.display = 'none'; } });
    } else {
      Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--text-2').trim() || '#666';
      if (cvCursos) {
        if (!ordenCursos.length) mostrarVacio(cvCursos);
        else new Chart(cvCursos, { type: 'bar', data: { labels: ordenCursos.map(c => c[0].length > 38 ? c[0].slice(0, 38) + '…' : c[0]), datasets: [{ data: ordenCursos.map(c => c[1]), backgroundColor: '#5b92c8' }] },
          options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } });
      }
      if (cvDias) {
        if (!elegidas.length) mostrarVacio(cvDias);
        else new Chart(cvDias, { type: 'bar', data: { labels: dias.map(d => d.getDate() + '/' + (d.getMonth() + 1)), datasets: [{ data: dias.map(d => porDia[claveDia(d)] || 0), backgroundColor: '#10b981' }] },
          options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
      }
    }

    // Listas: quienes ya eligieron y las cuentas nuevas que todavía no escogen su curso (marcadas "Sin elegir")
    if (lista) {
      const fmt = f => f ? f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const fmtHora = f => f ? f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }) + ' · ' + f.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' }) : '—';
      const chip = (txt, fondo, color) => '<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:' + fondo + ';color:' + color + ';">' + txt + '</span>';
      const chipPago = m => pago(m)
        ? '<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(52,211,153,.18);color:#0f9f6e;">Pagó</span>'
        : '<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--surface-3);color:var(--text-2);">Sin pagar</span>';
      const fila = (m, centro, chips, fecha) => {
        const nombre = m.nombre || m.displayName || (m.email || '').split('@')[0] || 'Miembro';
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;">'
          + '<span style="min-width:0;flex:1 1 220px;"><strong style="color:var(--text);">' + AdminEsc(nombre) + '</strong><br><span style="font-size:11.5px;color:var(--text-3);">' + AdminEsc(m.email || '') + '</span></span>'
          + '<span style="flex:2 1 260px;color:var(--text);">' + centro + '</span>'
          + chips + '<span style="color:var(--text-3);">' + AdminEsc(fecha) + '</span></div>';
      };
      const recientes = elegidas.slice().sort((a, b) => ((MK._mbToDate(b.pruebaElegidaEn) || 0) - (MK._mbToDate(a.pruebaElegidaEn) || 0))).slice(0, 15);
      const pendientes = sinElegir.slice().sort((a, b) => ((fechaReg(b) || 0) - (fechaReg(a) || 0))).slice(0, 30);
      const pintar = modo => {
        const titulo = document.getElementById('pg-lista-titulo');
        document.querySelectorAll('[data-pg-modo]').forEach(b => b.classList.toggle('on', b.dataset.pgModo === modo));
        if (modo === 'sin') {
          if (titulo) titulo.textContent = 'Cuentas nuevas que aún no eligen su prueba';
          if (!pendientes.length) { lista.textContent = 'No hay cuentas nuevas pendientes de elegir.'; return; }
          lista.innerHTML = pendientes.map(m => fila(m,
            'Todavía no elige su curso · se registró el ' + AdminEsc(fmtHora(fechaReg(m))),
            chip('Sin elegir', 'rgba(247,148,29,.18)', '#b45309') + chipPago(m),
            fmt(fechaReg(m)))).join('')
            + (sinElegir.length > pendientes.length ? '<p style="margin:10px 0 0;font-size:11.5px;color:var(--text-3);">Mostrando las ' + pendientes.length + ' más recientes de ' + sinElegir.length + '.</p>' : '');
          return;
        }
        if (titulo) titulo.textContent = 'Últimas pruebas elegidas';
        if (!recientes.length) { lista.textContent = 'Todavía nadie ha elegido su prueba gratuita.'; return; }
        lista.innerHTML = recientes.map(m => {
          const curso = cursosPorId[m.cursoPruebaElegido] || m.cursoPruebaElegido;
          return fila(m, AdminEsc(curso), chipPago(m), fmt(MK._mbToDate(m.pruebaElegidaEn)));
        }).join('');
      };
      set('pg-tab-elegidas', '(' + elegidas.length + ')');
      set('pg-tab-sin', '(' + sinElegir.length + ')');
      document.querySelectorAll('[data-pg-modo]').forEach(b => { b.onclick = () => pintar(b.dataset.pgModo); });
      pintar('elegidas');
    }
  },

};
// En ICADEM el admin ya está confirmado cuando se pinta una sección (adminready); se conserva la espera por si acaso.
// ═══ Encuestas con dos pestañas: la encuesta del landing (igual que Alintec) y la ruta de la guía virtual ═══
MK._encTab = 'landing';
MK.encuestas = function(p){
  // La cabecera es la misma en ambas pestañas; en "ruta" no se descargan las respuestas del landing
  MK._encSinCarga = MK._encTab !== 'landing';
  MK._encuestasLanding(p);
  MK._encSinCarga = false;
  const hero = p.querySelector('.sec-hero');
  if (!hero) return;
  if (!document.getElementById('enc-tabs-estilos')) {
    const st = document.createElement('style');
    st.id = 'enc-tabs-estilos';
    st.textContent = `.enc-tabs{display:inline-flex;gap:4px;padding:4px;margin:-8px 0 22px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}
.enc-tabs button{border:0;background:transparent;color:var(--text-2);padding:9px 16px;border-radius:10px;font:700 12.5px Inter,sans-serif;cursor:pointer;transition:.18s}
.enc-tabs button:hover{color:var(--text)}.enc-tabs button.on{background:var(--primary);color:#fff;box-shadow:0 4px 14px color-mix(in srgb,var(--primary) 30%,transparent)}
.enc-card{background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px}
.enc-card h3{margin:0 0 12px;font-size:14px;color:var(--text)}
.enc-card p.enc-sub{margin:-6px 0 12px;font-size:12px;color:var(--text-3);line-height:1.5}
.enc-g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:16px;margin-top:16px}
.enc-fila{display:grid;grid-template-columns:110px minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr);gap:4px 12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:12.5px}
.enc-fila:last-child{border-bottom:0}.enc-fila small{color:var(--text-3);font-size:11px}
.enc-chip{display:inline-block;padding:2px 9px;border-radius:999px;font:700 10.5px Inter,sans-serif}
#enc-prospectos .sec-hero,#enc-prospectos .mk-tabs{display:none}#enc-prospectos>.mx-page{padding:0;max-width:none}
@media(max-width:700px){.enc-fila{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(st);
  }
  const tabs = document.createElement('div');
  tabs.className = 'enc-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.innerHTML = `<button type="button" role="tab" data-enc-tab="landing" class="${MK._encTab === 'landing' ? 'on' : ''}">Encuesta del landing</button><button type="button" role="tab" data-enc-tab="ruta" class="${MK._encTab === 'ruta' ? 'on' : ''}">Ruta de la guía virtual</button><button type="button" role="tab" data-enc-tab="prospectos" class="${MK._encTab === 'prospectos' ? 'on' : ''}">Prospectos de la guía</button>`;
  hero.after(tabs);
  tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-enc-tab]');
    if (!b || b.dataset.encTab === MK._encTab) return;
    MK._encTab = b.dataset.encTab;
    MK.encuestas(p);
  });
  if (MK._encTab === 'ruta') MK._rutasGuia(p, tabs);
  if (MK._encTab === 'prospectos') MK._prospectosGuia(p, tabs);
};

// ─── Prospectos de la guía: quienes dejaron nombre y correo en "Guarda tu ruta" (vista anterior de Encuestas) ───
MK._prospectosGuia = function(p, tabs){
  const sub = p.querySelector('.sec-hero__sub');
  if (sub) sub.textContent = 'Personas que terminaron el diagnóstico de la guía y dejaron sus datos con consentimiento, con sus respuestas y los cursos recomendados.';
  let n = tabs.nextSibling;
  while (n) { const sig = n.nextSibling; n.remove(); n = sig; }
  const vista = document.createElement('div');
  vista.id = 'enc-prospectos';
  p.querySelector('.fade-up').appendChild(vista);
  const montar = () => window.ICADEMMarketingAdmin.mountSurveys(vista, { getToken: () => MK._getAuthToken(), api: MK._webhookUrl });
  if (window.ICADEMMarketingAdmin) montar();
  else {
    vista.innerHTML = '<p style="color:var(--text-3);font-size:13px">Cargando prospectos…</p>';
    window.addEventListener('icadem:marketing-admin-ready', () => { if (document.body.contains(vista)) montar(); }, { once: true });
  }
};

// ─── Ruta de la guía virtual ("Preparar mi ruta", 7 preguntas) ───
MK._rutasGuia = async function(p, tabs){
  const sub = p.querySelector('.sec-hero__sub');
  if (sub) sub.textContent = 'Resultados de la ruta de la guía virtual del landing · quién la abre, quién la termina, qué responde y qué curso elige al final.';
  // Se reemplaza todo lo que va después de las pestañas
  let n = tabs.nextSibling;
  while (n) { const sig = n.nextSibling; n.remove(); n = sig; }
  const vista = document.createElement('div');
  vista.id = 'ruta-vista';
  vista.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card" style="--c1:#5b92c8;--c2:#8fbce6;"><div class="kpi-card__label">Abrieron la ruta</div><div class="kpi-card__value" id="rt-kpi-total">—</div><div class="kpi-card__sub" id="rt-kpi-total-sub">Cada intento cuenta una vez</div></div>
      <div class="kpi-card" style="--c1:#10b981;--c2:#6ee7b7;"><div class="kpi-card__label">Completaron las 5 preguntas</div><div class="kpi-card__value" id="rt-kpi-comp">—</div><div class="kpi-card__sub" id="rt-kpi-comp-sub">—</div></div>
      <div class="kpi-card" style="--c1:#F7941D;--c2:#FBBF24;"><div class="kpi-card__label">Se fueron a la mitad</div><div class="kpi-card__value" id="rt-kpi-parcial">—</div><div class="kpi-card__sub">Empezaron y no terminaron</div></div>
      <div class="kpi-card" style="--c1:#94A3B8;--c2:#CBD5E1;"><div class="kpi-card__label">Dijeron "Ahora no"</div><div class="kpi-card__value" id="rt-kpi-desc">—</div><div class="kpi-card__sub">Cerraron la invitación sin empezar</div></div>
      <div class="kpi-card" style="--c1:#A855F7;--c2:#C084FC;"><div class="kpi-card__label">Abrieron un curso</div><div class="kpi-card__value" id="rt-kpi-clic">—</div><div class="kpi-card__sub" id="rt-kpi-clic-sub">—</div></div>
    </div>
    <div class="enc-g2">
      <div class="enc-card"><h3>Qué describe su trabajo</h3><canvas id="rt-chart-perfil" height="220"></canvas></div>
      <div class="enc-card"><h3>Área que quieren abrir primero</h3><canvas id="rt-chart-tema" height="220"></canvas></div>
    </div>
    <div class="enc-g2">
      <div class="enc-card"><h3>Lo que quieren resolver primero</h3><canvas id="rt-chart-prioridad" height="220"></canvas></div>
      <div class="enc-card"><h3>Desde dónde comienzan</h3><canvas id="rt-chart-nivel" height="220"></canvas></div>
    </div>
    <div class="enc-card" style="margin-top:16px"><h3>Formato que más les ayuda</h3><canvas id="rt-chart-formato" height="170"></canvas></div>
    <div class="enc-card" style="margin-top:16px"><h3>Dónde se quedan los que no terminan</h3><p class="enc-sub">Última pregunta que alcanzaron a contestar antes de irse. "Sin contestar" son quienes empezaron el diagnóstico y se fueron sin elegir nada.</p><canvas id="rt-chart-abandono" height="170"></canvas></div>
    <div class="enc-g2">
      <div class="enc-card"><h3>Cursos que más recomienda la ruta</h3><canvas id="rt-chart-recom" height="240"></canvas></div>
      <div class="enc-card"><h3>Cursos que abrieron desde la ruta</h3><p class="enc-sub">Al tocar un curso del resultado se les lleva a crear su cuenta gratis.</p><canvas id="rt-chart-elegidos" height="220"></canvas></div>
    </div>
    <div class="enc-card" style="margin-top:16px"><h3>Últimas rutas</h3><div id="rt-lista" style="color:var(--text-2);font-size:13px;">Cargando…</div></div>`;
  p.querySelector('.fade-up').appendChild(vista);

  let items = [];
  try {
    await MK._esperarAdmin();
    const datos = await MK._api('/api/admin/rutas');
    items = datos.items || [];
  } catch (e) {
    const lista = document.getElementById('rt-lista');
    if (lista) {
      lista.innerHTML = 'No se pudieron cargar los datos (' + AdminEsc(e.message || 'error') + '). <a href="#" id="rt-reintentar" style="color:var(--primary);font-weight:700;">Reintentar</a>';
      document.getElementById('rt-reintentar')?.addEventListener('click', ev => { ev.preventDefault(); MK.encuestas(p); });
    }
    return;
  }
  if (!document.body.contains(vista)) return;

  const total = items.length;
  const comp = items.filter(x => x.estado === 'completada');
  const parcial = items.filter(x => x.estado === 'parcial');
  const desc = items.filter(x => x.estado === 'descartada');
  const empezaron = comp.length + parcial.length;
  const clic = comp.filter(x => x.cursoElegido);
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) + '%' : '—';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('rt-kpi-total', total);
  set('rt-kpi-total-sub', total ? empezaron + ' empezaron a contestar' : 'Aún no hay intentos');
  set('rt-kpi-comp', comp.length);
  set('rt-kpi-comp-sub', empezaron ? pct(comp.length, empezaron) + ' de quienes empezaron' : 'Sin respuestas aún');
  set('rt-kpi-parcial', parcial.length);
  set('rt-kpi-desc', desc.length);
  set('rt-kpi-clic', clic.length);
  set('rt-kpi-clic-sub', comp.length ? pct(clic.length, comp.length) + ' de quienes completaron' : 'Sin rutas completadas');

  const contar = campo => { const o = {}; comp.forEach(x => { const v = x.respuestas && x.respuestas[campo]; if (v) o[v] = (o[v] || 0) + 1; }); return o; };
  const ORDEN = [['perfil', 'Tu perfil'], ['prioridad', 'Tu prioridad'], ['nivel', 'Tu nivel'], ['formato', 'Tu forma de aprender'], ['tema', 'Tu primer tema']];
  const abandono = { 'Sin contestar': 0 };
  ORDEN.forEach(([, n]) => { abandono[n] = 0; });
  parcial.forEach(x => {
    const ultima = [...ORDEN].reverse().find(([k]) => x.respuestas && x.respuestas[k]);
    abandono[ultima ? ultima[1] : 'Sin contestar']++;
  });
  Object.keys(abandono).forEach(k => { if (!abandono[k]) delete abandono[k]; });
  const recom = {}, elegidos = {};
  comp.forEach(x => { (x.recomendados || []).forEach(t => { recom[t] = (recom[t] || 0) + 1; }); if (x.cursoElegido) elegidos[x.cursoElegido] = (elegidos[x.cursoElegido] || 0) + 1; });
  const top = (o, n) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k.length > 34 ? k.slice(0, 34) + '…' : k, v]));

  const sinDatos = (cv, datos) => {
    if (Object.keys(datos).length) return false;
    cv.insertAdjacentHTML('afterend', '<p style="margin:24px 0;text-align:center;font-size:13px;color:var(--text-3);">Aún no hay respuestas para esta pregunta.</p>');
    cv.style.display = 'none';
    return true;
  };
  if (!window.Chart) {
    vista.querySelectorAll('canvas').forEach(cv => { cv.insertAdjacentHTML('afterend', '<p style="margin:24px 0;text-align:center;font-size:13px;color:var(--text-3);">No se pudo cargar la librería de gráficas. Recarga la página.</p>'); cv.style.display = 'none'; });
  } else {
    Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--text-2').trim() || '#666';
    const colores = ['#5b92c8', '#10b981', '#F7941D', '#D4537E', '#A855F7', '#9CA3AF'];
    const pie = (id, datos) => { const cv = document.getElementById(id); if (!cv || sinDatos(cv, datos)) return;
      new Chart(cv, { type: 'pie', data: { labels: Object.keys(datos), datasets: [{ data: Object.values(datos), backgroundColor: colores }] }, options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } } }); };
    const barra = (id, datos, color, horizontal) => { const cv = document.getElementById(id); if (!cv || sinDatos(cv, datos)) return;
      new Chart(cv, { type: 'bar', data: { labels: Object.keys(datos), datasets: [{ data: Object.values(datos), backgroundColor: color }] },
        options: { indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: false } }, scales: horizontal ? { x: { beginAtZero: true, ticks: { precision: 0 } } } : { y: { beginAtZero: true, ticks: { precision: 0 } } } } }); };
    pie('rt-chart-perfil', contar('perfil'));
    pie('rt-chart-tema', contar('tema'));
    barra('rt-chart-prioridad', contar('prioridad'), '#10b981', true);
    barra('rt-chart-nivel', contar('nivel'), '#5b92c8', false);
    barra('rt-chart-formato', contar('formato'), '#A855F7', true);
    barra('rt-chart-abandono', abandono, '#D4537E', true);
    barra('rt-chart-recom', top(recom, 10), '#5b92c8', true);
    barra('rt-chart-elegidos', top(elegidos, 10), '#A855F7', true);
  }

  const lista = document.getElementById('rt-lista');
  if (lista) {
    const msDe = x => Date.parse(x.actualizado || x.creado || '') || 0;
    const recientes = items.filter(x => x.estado !== 'descartada').sort((a, b) => msDe(b) - msDe(a)).slice(0, 25);
    const zona = 'America/Mexico_City';
    const fecha = x => { const ms = msDe(x); return ms ? new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: zona }) + ' · ' + new Date(ms).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: zona }) : '—'; };
    const chip = x => x.estado === 'completada'
      ? '<span class="enc-chip" style="background:rgba(20,184,166,.16);color:#0f9f6e">Completó</span>'
      : '<span class="enc-chip" style="background:rgba(247,148,29,.18);color:#C9740A">Se quedó en ' + (x.pasos || 0) + ' de 5</span>';
    lista.innerHTML = recientes.length ? recientes.map(x => {
      const r = x.respuestas || {};
      return `<div class="enc-fila"><small>${AdminEsc(fecha(x))}</small><span><strong style="color:var(--text)">${AdminEsc(r.perfil || '—')}</strong><br><small>${AdminEsc(r.prioridad || '')}</small></span><span>${chip(x)}<br><small>${AdminEsc(r.tema ? 'Empezaría con: ' + r.tema : '')}</small></span><span>${x.cursoElegido ? '<small>Abrió</small><br><strong style="color:var(--text)">' + AdminEsc(x.cursoElegido) + '</strong>' : '<small>' + (x.estado === 'completada' ? 'No abrió ningún curso' : '—') + '</small>'}</span></div>`;
    }).join('') : 'Todavía nadie ha hecho la ruta de la guía.';
  }
};

MK._esperarAdmin = function(){
  if (window.__currentAdmin) return Promise.resolve();
  return new Promise(resolver => { window.addEventListener('adminready', () => resolver(), { once: true }); setTimeout(resolver, 10000); });
};

// Se registran en el router del admin de ICADEM (const Pages global del script principal)
if (typeof Pages !== 'undefined') {
  Pages.encuestas = p => MK.encuestas(p);
  Pages.metricas = p => MK.metricas(p);
  Pages.pruebas = p => MK.pruebas(p);
}
window.ICADEMMarketingAdminV2 = MK;
})();
