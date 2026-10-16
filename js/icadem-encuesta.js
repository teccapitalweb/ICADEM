/* Encuesta del landing · ICADEM (portada de la encuesta de Alintec Food)
   Perfila a los visitantes nuevos y los lleva a crear su cuenta con un curso recomendado.
   Anónima: el WhatsApp es opcional y va al final ("que un asesor me escriba").

   Árbol real: cada perfil (p1) sigue su propio camino de preguntas en obtenerPasos().
   La pregunta "tamano" (tamaño del equipo) solo aparece para perfiles que ya trabajan.

   Personaje: la guía virtual de ICADEM (#af-enc-face).
   Las respuestas se envían al webhook (/api/encuesta); el navegador nunca escribe en Firestore. */

const API_ENCUESTA = 'https://icadem-webhook-production.up.railway.app/api/encuesta';

// EDICION identifica la "vuelta" de la encuesta. Para que TODOS vuelvan a verla (por ejemplo después de borrar
// los datos de prueba) basta con subir este número: el estado guardado en cada navegador deja de aplicar.
const EDICION = 1;
const ESTADO_KEY = 'icadem_encuesta_estado_e' + EDICION; // ya no se usa (antes: 'completada'); solo se borra si quedó de versiones anteriores
const PROG_KEY = 'icadem_encuesta_prog_e' + EDICION; // { respuestas, paso, parcialN, guardado } para retomar donde se quedó (se borra al terminar)
const PEND_KEY = 'icadem_encuesta_pend_e' + EDICION; // envíos que la base de datos aún no confirmó (se reintentan solos)
const SID_KEY = 'icadem_encuesta_sid';
// Versión del aviso de privacidad (privacidad.html): queda guardada junto con
// el WhatsApp como constancia de qué versión aceptó la persona.
const AVISO_VERSION = 'aviso-icadem-2026-10';

function getSessionId() {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid = (crypto.randomUUID ? crypto.randomUUID() : 'sid-' + Date.now() + '-' + Math.random().toString(16).slice(2));
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch (e) { return 'sid-' + Date.now(); }
}

function leerProgreso() {
  try { return JSON.parse(localStorage.getItem(PROG_KEY) || 'null') || {}; } catch (e) { return {}; }
}

function guardarProgreso(extra) {
  try { localStorage.setItem(PROG_KEY, JSON.stringify({ ...leerProgreso(), respuestas, paso, ...extra })); } catch (e) {}
}

const PERFILES = ['Abogacía o área legal', 'Contabilidad o fiscal', 'Dirección o emprendimiento', 'Estudiante'];
// Perfiles que ya trabajan: a ellos se les pregunta el tamaño de su equipo (clave "tamano").
const PERFILES_EMPRESA = ['Abogacía o área legal', 'Contabilidad o fiscal', 'Dirección o emprendimiento'];

// Primer nivel de pregunta de reto, distinto por perfil.
const RETOS = {
  'Abogacía o área legal': { q: '¿Tu reto hoy?', opts: ['Litigio y audiencias', 'Contratos', 'Familiar y civil'] },
  'Contabilidad o fiscal': { q: '¿Qué buscas?', opts: ['Defensa fiscal', 'Cumplimiento y control', 'Finanzas y reportes'] },
  'Dirección o emprendimiento': { q: '¿Tu reto hoy?', opts: ['Vender más', 'Finanzas del negocio', 'Equipo y operación'] },
  'Estudiante': { q: '¿Tu meta es?', opts: ['Certificado', 'Empleo', 'Saber más'] }
};

// Segundo nivel: profundiza según la respuesta del reto. 12 preguntas
// distintas en total (4 perfiles x 3 respuestas): es un árbol real, no el mismo formulario para todos.
const PROFUNDIZACION = {
  'Abogacía o área legal': {
    'Litigio y audiencias': { q: '¿Qué quieres dominar?', opts: ['Argumentación jurídica', 'Litigación oral', 'Amparo'] },
    'Contratos': { q: '¿Qué tipo de contratos?', opts: ['Contratos mercantiles', 'Contratos inmobiliarios', 'Fraude inmobiliario'] },
    'Familiar y civil': { q: '¿Qué tema te interesa?', opts: ['Divorcio', 'Pensión alimentaria', 'Notarial y registral'] }
  },
  'Contabilidad o fiscal': {
    'Defensa fiscal': { q: '¿Dónde está el problema?', opts: ['Créditos fiscales', 'Medios de defensa', 'Derecho fiscal'] },
    'Cumplimiento y control': { q: '¿Qué necesitas ordenar?', opts: ['Comercio exterior', 'Excel y controles', 'Inventarios'] },
    'Finanzas y reportes': { q: '¿Qué quieres mejorar?', opts: ['Toma de decisiones', 'Inversiones', 'Finanzas personales'] }
  },
  'Dirección o emprendimiento': {
    'Vender más': { q: '¿Por dónde quieres crecer?', opts: ['Meta Ads', 'Ventas en redes', 'Negocio inmobiliario'] },
    'Finanzas del negocio': { q: '¿Qué te falta?', opts: ['Toma de decisiones', 'Excel y controles', 'Inversiones'] },
    'Equipo y operación': { q: '¿Qué te preocupa más?', opts: ['Liderazgo', 'Selección de personal', 'Logística'] }
  },
  'Estudiante': {
    'Certificado': { q: '¿Para qué lo necesitas?', opts: ['Trabajo actual', 'Buscar empleo', 'Titulación'] },
    'Empleo': { q: '¿En qué área buscas?', opts: ['Legal', 'Fiscal y contable', 'Negocios'] },
    'Saber más': { q: '¿Tu nivel es?', opts: ['Principiante', 'Intermedio', 'Avanzado'] }
  }
};

// Grandes temas del catálogo: la respuesta se usa para recomendar cursos.
const TEMAS_INTERES = ['Legal y litigación', 'Fiscal y contable', 'Finanzas y negocios', 'Liderazgo y talento'];

const respuestas = {};
let paso = 0;

// Construye la lista de pasos EN VIVO según lo que ya se respondió, por
// eso los pasos que dependen de una respuesta anterior (reto, profundización,
// tamaño de empresa) solo existen una vez que esa respuesta ya se dio.
function obtenerPasos() {
  const pasos = [];
  // Pregunta de arranque: amplia, aspiracional y fácil de contestar para cualquier perfil.
  pasos.push({
    clave: 'meta', q: '¿Qué quieres lograr este año?',
    opts: ['Crecer en mi carrera', 'Ganar más clientes', 'Cumplir y reducir riesgos', 'Certificarme y destacar'],
    expr: 'neutral',
    mensaje: { titulo: '¡Hola! Te ayudo a empezar.', texto: 'Son preguntas rápidas: toma menos de un minuto.' }
  });
  pasos.push({ clave: 'p1', q: '¿Tú eres...?', opts: PERFILES, expr: 'neutral' });
  pasos.push({ clave: 'origen', q: '¿Cómo nos conociste?', opts: ['Redes sociales', 'Recomendación', 'Buscador', 'Otro'], expr: 'neutral' });
  pasos.push({ clave: 'giro', q: '¿En qué sector trabajas o quieres trabajar?', opts: ['Despacho o firma', 'Empresa privada', 'Gobierno', 'Negocio propio', 'Otra área'], expr: 'thinking' });
  if (respuestas.p1) pasos.push({ clave: 'p2', ...RETOS[respuestas.p1], expr: 'thinking' });
  if (respuestas.p1 && respuestas.p2) pasos.push({ clave: 'p2b', ...PROFUNDIZACION[respuestas.p1][respuestas.p2], expr: 'thinking' });
  if (PERFILES_EMPRESA.includes(respuestas.p1)) pasos.push({ clave: 'tamano', q: '¿Cuántas personas trabajan contigo?', opts: ['Solo yo', '2 a 10', '11 a 50', 'Más de 50'], expr: 'neutral' });
  pasos.push({ clave: 'interes', q: '¿Qué tema te interesa más?', opts: TEMAS_INTERES, expr: 'thinking' });
  pasos.push({ clave: 'experiencia', q: '¿Ya tomaste cursos online?', opts: ['Sí, me gusta', 'Prefiero presencial', 'Es mi primera vez'], expr: 'neutral' });
  pasos.push({ clave: 'urgencia', q: '¿Cuándo te gustaría empezar a capacitarte?', opts: [URGENTE, 'En el próximo mes', 'Solo estoy explorando'], expr: 'surprised' });
  pasos.push({ clave: 'freno', q: '¿Qué te detiene hoy?', opts: ['Precio', 'Tiempo', 'No estoy seguro', 'Nada, listo'], expr: 'thinking' });
  return pasos;
}

// Respuesta de urgencia que el panel de admin cuenta como "lead caliente".
const URGENTE = 'Lo antes posible';

// La encuesta vive como una sección fija justo debajo del hero (no flotante):
// el personaje a la izquierda, la pregunta y sus opciones a la derecha.
function construirUI() {
  const sec = document.createElement('section');
  sec.id = 'encuentra';
  sec.className = 'af-enc-section';
  sec.setAttribute('aria-label', 'Cuéntanos de ti');
  sec.innerHTML = `
    <div id="af-enc-wrap" class="af-enc-inner">
      <div id="af-enc-companion" class="af-enc-companion">
        <div id="af-enc-note" class="af-enc-note" role="status" aria-live="polite">
          <strong id="af-enc-note-title"></strong>
          <span id="af-enc-note-copy"></span>
        </div>
        <div id="af-enc-face" class="af-enc-face" aria-hidden="true"><span class="af-enc-base"></span><span class="af-enc-mano"></span></div>
      </div>
      <div id="af-enc-card">
        <div class="af-enc-top">
          <p class="af-enc-step" id="af-enc-step"></p>
          <button type="button" class="af-enc-atras" id="af-enc-atras" hidden>← Anterior</button>
        </div>
        <p class="af-enc-q" id="af-enc-q"></p>
        <div id="af-enc-body"></div>
      </div>
    </div>
  `;
  // Va después de la franja de valor: esa franja se monta sobre el borde del hero y taparía la encuesta
  const hero = document.querySelector('.trust-strip') || document.querySelector('.hero');
  if (hero) hero.after(sec); else document.body.prepend(sec);
  sec.querySelector('#af-enc-atras').addEventListener('click', atras);
  if ('IntersectionObserver' in window) {
    let visible = false;
    const io = new IntersectionObserver(entradas => {
      const ahora = entradas.some(e => e.isIntersecting);
      if (ahora && !visible) setTimeout(saludar, 350); // saluda al aparecer en pantalla
      visible = ahora;
    }, { threshold: 0.4 });
    io.observe(sec);
    // mientras se ve la primera pregunta, vuelve a saludar de vez en cuando
    setInterval(() => { if (visible && paso === 0 && document.visibilityState === 'visible') saludar(); }, 9000);
  }
  return sec;
}

// Personaje: la guía virtual de ICADEM, recortada de la cabeza a la cintura.
// Solo hay dos dibujos (normal y ojos cerrados): el parpadeo se usa cuando "piensa".
const IMAGENES_EXPR = {
  neutral: 'assets/img/encuesta/busto-guia.webp',
  thinking: 'assets/img/encuesta/busto-guia-parpadeo.webp',
  confused: 'assets/img/encuesta/busto-guia-parpadeo.webp',
  concerned: 'assets/img/encuesta/busto-guia.webp',
  surprised: 'assets/img/encuesta/busto-guia.webp',
  happy: 'assets/img/encuesta/busto-guia-parpadeo.webp',
  excited: 'assets/img/encuesta/busto-guia-parpadeo.webp'
};

// Se guardan las imágenes y se decodifican de antemano para que el cambio de pose
// del personaje sea instantáneo y no parpadee la primera vez que aparece cada una.
const imagenesPrecargadas = [];
function precargarImagenes() {
  [...new Set(Object.values(IMAGENES_EXPR))].forEach(src => {
    const img = new Image();
    img.src = src;
    if (img.decode) img.decode().catch(() => {});
    imagenesPrecargadas.push(img);
  });
}

const MENSAJES_EXPR = {
  neutral: { titulo: 'Estoy aquí para ayudarte.', texto: 'Elige la opción que mejor te represente. No hay respuestas incorrectas.' },
  thinking: { titulo: 'Pensemos juntos.', texto: 'Esta respuesta me ayudará a entender mejor lo que necesitas.' },
  confused: { titulo: 'No pasa nada si aún dudas.', texto: 'Elige la opción más cercana; podremos afinarla después.' },
  concerned: { titulo: 'Entiendo esa dificultad.', texto: 'Buscaremos una alternativa práctica para ayudarte a avanzar.' },
  surprised: { titulo: '¡Esto es importante!', texto: 'Tu respuesta cambia la prioridad de la recomendación.' },
  happy: { titulo: '¡Excelente elección!', texto: 'Ya puedo personalizar mejor tu experiencia.' },
  excited: { titulo: '¡Estamos listos!', texto: 'Tengo una recomendación preparada para ti.' }
};

const REACCIONES_RESPUESTA = {
  origen: {
    'Redes sociales': { expr: 'happy', titulo: '¡Qué gusto encontrarte!', texto: 'Seguiremos compartiendo contenido útil también por aquí.' },
    'Recomendación': { expr: 'happy', titulo: '¡Gracias por la confianza!', texto: 'Nos alegra que alguien te haya recomendado ICADEM.' },
    'Buscador': { expr: 'thinking', titulo: 'Llegaste al lugar indicado.', texto: 'Te ayudaré a encontrar una ruta acorde con lo que buscabas.' },
    'Otro': { expr: 'neutral', titulo: 'Gracias por contármelo.', texto: 'Continuemos para conocer mejor lo que necesitas.' }
  },
  experiencia: {
    'Sí, me gusta': { expr: 'happy', titulo: '¡Perfecto!', texto: 'Podremos llevarte directamente a contenidos más especializados.' },
    'Prefiero presencial': { expr: 'concerned', titulo: 'Entiendo tu preferencia.', texto: 'Te mostraremos una experiencia digital clara, práctica y acompañada.' },
    'Es mi primera vez': { expr: 'surprised', titulo: '¡Bienvenido a esta experiencia!', texto: 'Te guiaremos paso a paso para que comenzar sea sencillo.' }
  },
  urgencia: {
    'Lo antes posible': { expr: 'surprised', titulo: 'Vamos a priorizarlo.', texto: 'Buscaremos cómo puedas comenzar cuanto antes.' },
    'En el próximo mes': { expr: 'thinking', titulo: 'Podemos planearlo bien.', texto: 'Tendrás tiempo de elegir con calma.' },
    'Solo estoy explorando': { expr: 'neutral', titulo: 'Explora con calma.', texto: 'Sin presión: mira las opciones y decide cuando quieras.' }
  },
  freno: {
    'Precio': { expr: 'concerned', titulo: 'El presupuesto importa.', texto: 'Tomaré en cuenta opciones de alto valor y acceso flexible.' },
    'Tiempo': { expr: 'concerned', titulo: 'Sé que el tiempo es limitado.', texto: 'Buscaremos contenidos breves que puedas avanzar a tu ritmo.' },
    'No estoy seguro': { expr: 'confused', titulo: 'Es normal tener dudas.', texto: 'Con tus respuestas podré darte una recomendación más clara.' },
    'Nada, listo': { expr: 'happy', titulo: '¡Entonces avancemos!', texto: 'Ya casi tengo lista una ruta adecuada para ti.' }
  }
};

function obtenerReaccionRespuesta(clave, opt) {
  const especifica = REACCIONES_RESPUESTA[clave] && REACCIONES_RESPUESTA[clave][opt];
  if (especifica) return especifica;
  if (clave === 'meta') return { expr: 'happy', titulo: '¡Buen objetivo!', texto: 'Vamos a ver cómo ayudarte a lograrlo.' };
  if (clave === 'giro') return { expr: 'thinking', titulo: 'Gracias, ya tengo tu contexto.', texto: opt === 'Otra área' ? 'Cada área tiene sus retos; seguimos conociéndote.' : `Trabajar en ${opt.toLowerCase()} abre muchas oportunidades.` };
  if (clave === 'p1') return { expr: 'happy', titulo: 'Perfecto, ya te ubico.', texto: `Adaptaré las siguientes preguntas a tu perfil: ${opt}.` };
  if (clave === 'tamano') {
    const expr = opt === 'Más de 50' ? 'surprised' : 'thinking';
    return { expr, titulo: 'Gracias, esto cambia la escala.', texto: opt === 'Solo yo' ? 'Te recomendaré algo que puedas aplicar por tu cuenta desde hoy.' : `Consideraré un equipo de ${opt.toLowerCase()} personas en la recomendación.` };
  }
  if (clave === 'interes') return { expr: 'happy', titulo: 'Tema seleccionado.', texto: `${opt} tendrá prioridad en tu ruta personalizada.` };
  if (clave === 'p2' || clave === 'p2b') return { expr: 'thinking', titulo: 'Ya entiendo mejor tu reto.', texto: `Tomaré en cuenta “${opt}” para afinar la siguiente pregunta.` };
  return { expr: 'happy', titulo: 'Respuesta guardada.', texto: 'Continuemos para completar tu recomendación.' };
}

function af_setExpr(nombre, mensaje) {
  const cara = document.getElementById('af-enc-face');
  if (!cara) return;
  const src = IMAGENES_EXPR[nombre] || IMAGENES_EXPR.neutral;
  // dirección completa: una variable CSS con url() relativa se resolvería desde la carpeta de estilos, no desde la página
  cara.style.setProperty('--af-cara', `url('${new URL(src, document.baseURI).href}')`);
  // La guía de ICADEM no tiene mano separada: el saludo es el meneo del cuerpo
  cara.classList.remove('tiene-mano');
  const contenido = mensaje || MENSAJES_EXPR[nombre] || MENSAJES_EXPR.neutral;
  const titulo = document.getElementById('af-enc-note-title');
  const copia = document.getElementById('af-enc-note-copy');
  if (titulo) titulo.textContent = contenido.titulo;
  if (copia) copia.textContent = contenido.texto;
}

// Saludo del personaje: se menea una vez (al aparecer la encuesta y al mostrar el resultado).
let saludoTimer = null;
function saludar() {
  const cara = document.getElementById('af-enc-face');
  if (!cara) return;
  clearTimeout(saludoTimer);
  cara.classList.remove('is-hello');
  void cara.offsetWidth; // reinicia la animación si ya estaba puesta
  cara.classList.add('is-hello');
  saludoTimer = setTimeout(() => cara.classList.remove('is-hello'), 2100);
}

function af_animarReaccion() {
  const companion = document.getElementById('af-enc-companion');
  if (!companion) return;
  companion.classList.remove('is-reacting');
  void companion.offsetWidth;
  companion.classList.add('is-reacting');
  window.setTimeout(() => companion.classList.remove('is-reacting'), 450);
}

// Título de la tarjeta: acepta texto o nodos (para resaltar una parte); "grande" es el del resultado.
function ponerTitulo(partes, grande) {
  const q = document.getElementById('af-enc-q');
  if (!q) return;
  q.classList.toggle('is-result', !!grande);
  q.textContent = '';
  q.append(...[].concat(partes));
}

function renderPaso() {
  if (!document.getElementById('af-enc-card')) return; // se cerró la sección mientras esperaba la reacción
  const pasos = obtenerPasos();
  const def = pasos[paso];
  if (!def) { renderResultado(); return; }
  resTk++; // cancela cualquier pantalla de resultado que estuviera cargando
  document.getElementById('af-enc-step').textContent = 'Cuéntanos de ti';
  ponerTitulo(def.q);
  af_setExpr(def.expr, def.mensaje);
  actualizarAtras();
  const body = document.getElementById('af-enc-body');
  body.innerHTML = '';
  def.opts.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'af-enc-opt';
    if (respuestas[def.clave] === opt) b.classList.add('is-selected'); // al volver, se ve lo que ya había elegido
    b.textContent = opt;
    b.addEventListener('click', () => elegir(def.clave, opt, b));
    body.appendChild(b);
  });
}

function actualizarAtras(oculto) {
  const btn = document.getElementById('af-enc-atras');
  if (btn) btn.hidden = !!oculto || paso <= 0;
}

let ocupado = false; // evita clics (o "Anterior") mientras corre la transición

// Preguntas cuyo contenido o existencia depende de otra respuesta (ver obtenerPasos).
const DEPENDENCIAS = { p1: ['p2', 'p2b', 'tamano'], p2: ['p2b'] };

// Línea de tiempo al elegir: la opción se marca y el personaje reacciona al instante,
// la pregunta se desvanece y la siguiente aparece con un fundido corto.
function elegir(clave, opt, boton) {
  if (ocupado) return;
  ocupado = true;
  // Si al volver se cambia una respuesta, las que dependían de ella ya no aplican (el camino es otro).
  if (respuestas[clave] !== undefined && respuestas[clave] !== opt) {
    (DEPENDENCIAS[clave] || []).forEach(k => { delete respuestas[k]; });
  }
  respuestas[clave] = opt;
  guardarProgreso({ guardado: false }); // si cambió una respuesta, el resultado se vuelve a guardar
  guardadoPrincipal = null;
  const body = document.getElementById('af-enc-body');
  if (body) body.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
  if (boton) boton.classList.add('is-selected');
  const reaccion = obtenerReaccionRespuesta(clave, opt);
  af_setExpr(reaccion.expr, reaccion);
  af_animarReaccion();
  cambiarPaso(1, 380, 580);
}

function atras() {
  if (ocupado || paso <= 0) return;
  ocupado = true;
  cambiarPaso(-1, 0, 160);
}

// Mueve el paso (+1 / -1) con el fundido: desvanece a los `iniciaFundido` ms y cambia a los `cambia` ms.
function cambiarPaso(delta, iniciaFundido, cambia) {
  const card = document.getElementById('af-enc-card');
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducido) setTimeout(() => { if (card) card.classList.add('is-swapping'); }, iniciaFundido);
  setTimeout(() => {
    const alturaAnterior = card ? card.offsetHeight : 0;
    paso = Math.max(0, paso + delta);
    guardarProgreso();
    renderPaso();
    ocupado = false;
    if (card) {
      if (!reducido) animarAltura(card, alturaAnterior);
      requestAnimationFrame(() => card.classList.remove('is-swapping'));
    }
  }, reducido ? 200 : cambia);
}

// La tarjeta se ajusta al contenido de cada pregunta (sin espacios en blanco) y lo hace
// con una transición de altura, para que ni la página ni el personaje den un salto.
function animarAltura(card, desde) {
  if (!desde) return;
  card.style.height = 'auto';
  const hasta = card.offsetHeight;
  if (Math.abs(hasta - desde) < 2) { card.style.height = ''; return; }
  card.style.height = desde + 'px';
  void card.offsetHeight;
  card.style.height = hasta + 'px';
  setTimeout(() => { card.style.height = ''; }, 320);
}

// Países para el WhatsApp. "pref" es el código telefónico. Para "Otro país" la persona escribe el
// número completo con su código.
const PAISES = [
  { cod: 'MX', nombre: 'México', pref: '52' },
  { cod: 'CO', nombre: 'Colombia', pref: '57' },
  { cod: 'AR', nombre: 'Argentina', pref: '54' },
  { cod: 'CL', nombre: 'Chile', pref: '56' },
  { cod: 'PE', nombre: 'Perú', pref: '51' },
  { cod: 'EC', nombre: 'Ecuador', pref: '593' },
  { cod: 'GT', nombre: 'Guatemala', pref: '502' },
  { cod: 'CR', nombre: 'Costa Rica', pref: '506' },
  { cod: 'PA', nombre: 'Panamá', pref: '507' },
  { cod: 'DO', nombre: 'Rep. Dominicana', pref: '1' },
  { cod: 'US', nombre: 'Estados Unidos', pref: '1' },
  { cod: 'ES', nombre: 'España', pref: '34' },
  { cod: 'OT', nombre: 'Otro país', pref: '' }
];

// País que se preselecciona según el idioma del navegador (es-CO → Colombia). Solo se usa si el
// idioma es español: un navegador en inglés no indica de dónde es la persona. Si no se sabe, México.
function paisPorDefecto() {
  try {
    const idioma = navigator.language || '';
    const region = new Intl.Locale(idioma).region;
    if (/^es/i.test(idioma) && region && PAISES.some(p => p.cod === region)) return region;
  } catch (e) {}
  return 'MX';
}

// Números que casi seguro son inventados: todos iguales, patrones repetidos (1212121212) o
// secuencias (1234567890). No puede comprobar que el número exista (eso solo se logra mandando
// un código), pero descarta lo obvio.
function esNumeroFalso(d) {
  if (d.length < 6) return true;
  for (let p = 1; p <= 5; p++) {
    if (d.length % p === 0 && d === d.slice(0, p).repeat(d.length / p)) return true;
  }
  const dif = [...d].slice(1).map((c, i) => (Number(c) - Number(d[i]) + 10) % 10);
  return dif.every(x => x === 1) || dif.every(x => x === 9);
}

// Devuelve el número listo para guardar (código de país + número, solo dígitos) o null si no es válido.
function normalizarWhatsapp(codPais, crudo) {
  let d = String(crudo).replace(/\D/g, '');
  const pais = PAISES.find(p => p.cod === codPais) || PAISES[0];
  if (pais.cod === 'MX') {
    // México: 10 dígitos; acepta que escriban +52 o 521. La lada no puede empezar en 0 ni en 1.
    if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
    else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
    if (d.length !== 10 || !/^[2-9]/.test(d) || esNumeroFalso(d)) return null;
    return '52' + d;
  }
  if (pais.cod === 'OT') {
    // Otro país: número completo con su código, de 8 a 15 dígitos (estándar internacional).
    if (d.length < 8 || d.length > 15 || d.startsWith('0') || esNumeroFalso(d)) return null;
    return d;
  }
  // Resto: si escribieron también el código del país, se quita; el número nacional tiene 7 a 11 dígitos.
  if (d.startsWith(pais.pref) && d.length >= pais.pref.length + 8) d = d.slice(pais.pref.length);
  if (d.length < 7 || d.length > 11 || d.startsWith('0') || esNumeroFalso(d)) return null;
  return pais.pref + d;
}

// ── Resultado final ─────────────────────────────────────────────────────────
// Al terminar las preguntas se muestra una pantalla de resultado: la fortaleza de la persona (sale de
// lo que respondió; el test no mide conocimientos, por eso solo se habla de su perfil, nunca de su nivel), los
// beneficios de empezar y 3 cursos recomendados con las mismas tarjetas de la guía virtual.
// Al elegir un curso se guarda como preferencia ('icadem_curso_pref') y
// se le lleva a crear su cuenta; ya en el panel, ese curso se le propone como prueba gratuita. Si ya
// tiene cuenta, inicia sesión: el panel le muestra el curso en su estado normal (la prueba es una sola).
// El WhatsApp pasó a ser una opción secundaria ("que un asesor me escriba").
const PREF_CURSO_KEY = 'icadem_curso_pref';
const AUTH_URL = 'vip-auth.html';
// Mismo formato de enlace que usa la guía virtual de ICADEM
function urlAuth(tab, curso) {
  const p = new URLSearchParams({ tab, origen: 'encuesta-icadem' });
  if (curso) { p.set('curso', curso.id); p.set('programa', curso.titulo); }
  return AUTH_URL + '?' + p.toString();
}

const FORT_PERFIL = {
  'Abogacía o área legal': 'tu criterio jurídico',
  'Contabilidad o fiscal': 'tu precisión con los números',
  'Dirección o emprendimiento': 'tu visión de negocio',
  'Estudiante': 'tus ganas de crecer'
};
// Halagos según lo que respondió: son para motivar (hablan de su actitud y su momento, no de lo que "sabe").
const HALAGO_EXP = {
  'Sí, me gusta': 'Ya dominas el aprendizaje en línea.',
  'Prefiero presencial': 'Valoras el trato cercano, y eso se nota en cómo aprendes.',
  'Es mi primera vez': 'Es tu primera vez en línea y ya diste el paso: eso no lo hace cualquiera.'
};
const HALAGO_NIVEL = {
  'Principiante': 'Empezar con tanta motivación es una gran ventaja.',
  'Intermedio': 'Tienes una base que te hará avanzar rápido.',
  'Avanzado': 'Tu nivel avanzado te permite sacarle el máximo provecho a cada curso.'
};
const HALAGO_URGENCIA = {
  'Lo antes posible': 'Tu decisión de empezar ya habla de alguien que va por más.',
  'En el próximo mes': 'Planear con calma es lo que hacen quienes llegan lejos.',
  'Solo estoy explorando': 'Explorar con curiosidad es el primer paso de quienes terminan destacando.'
};
const HALAGO_FRENO = {
  'Nada, listo': 'Y con la actitud de que nada te detiene, vas un paso adelante.',
  'Precio': 'Cuidas cada decisión, y eso es de quien sabe lo que vale.',
  'Tiempo': 'Y aun con poco tiempo piensas en crecer: eso se llama constancia.',
  'No estoy seguro': 'Y pensarlo bien antes de elegir es de quien se toma en serio su futuro.'
};
const HALAGO_EQUIPO = 'Liderar a un equipo grande exige visión, y se nota que la tienes.';

function halagos() {
  const primera = HALAGO_NIVEL[respuestas.p2b] || (respuestas.tamano === 'Más de 50' ? HALAGO_EQUIPO : HALAGO_EXP[respuestas.experiencia]);
  const frases = [primera, HALAGO_URGENCIA[respuestas.urgencia], HALAGO_FRENO[respuestas.freno]].filter(Boolean);
  return frases.join(' ') || 'Tienes todo para empezar.';
}
const TEMA_CORTO = {
  'Legal y litigación': 'legal y litigación',
  'Fiscal y contable': 'fiscal y contable',
  'Finanzas y negocios': 'finanzas y negocios',
  'Liderazgo y talento': 'liderazgo y talento'
};
const TEMA_CLAVES = {
  'Legal y litigación': /amparo|argumentacion|audiencia|litigacion|contrato|notarial|divorcio|pension|demanda|fraude|legal/,
  'Fiscal y contable': /fiscal|credito|arancel|comercio|excel|contab/,
  'Finanzas y negocios': /finanz|inversion|mercado|ventas|meta ads|negocio|inventario|logistica|rutas|negocios/,
  'Liderazgo y talento': /liderazgo|talento|emocional|docente|gerencia|equipos|recursos humanos/
};
// Respuestas concretas que apuntan a un curso: [patrón en título/descripción, cómo se nombra en la recomendación]
const METAS_NORMA = {
  'argumentacion juridica': [/argumentacion/, 'argumentación jurídica'],
  'litigacion oral': [/litigacion|audiencia/, 'litigación oral'],
  'amparo': [/amparo/, 'amparo'],
  'contratos mercantiles': [/contratos mercantiles/, 'contratos mercantiles'],
  'contratos inmobiliarios': [/contratos inmobiliarios/, 'contratos inmobiliarios'],
  'fraude inmobiliario': [/fraude/, 'fraude inmobiliario'],
  'divorcio': [/divorcio/, 'divorcio'],
  'pension alimentaria': [/pension/, 'pensión alimentaria'],
  'notarial y registral': [/notarial/, 'derecho notarial'],
  'creditos fiscales': [/creditos fiscales/, 'créditos fiscales'],
  'medios de defensa': [/defensa|creditos fiscales/, 'medios de defensa fiscal'],
  'derecho fiscal': [/derecho fiscal/, 'derecho fiscal'],
  'comercio exterior': [/arancel|tratados/, 'comercio exterior'],
  'excel y controles': [/excel/, 'Excel y controles'],
  'inventarios': [/inventario|almacen/, 'inventarios'],
  'toma de decisiones': [/toma de decisiones/, 'toma de decisiones'],
  'inversiones': [/inversion/, 'inversiones'],
  'finanzas personales': [/inteligencia financiera/, 'finanzas personales'],
  'meta ads': [/meta ads/, 'Meta Ads'],
  'ventas en redes': [/ventas digitales/, 'ventas en redes'],
  'negocio inmobiliario': [/negocio inmobiliario/, 'negocio inmobiliario'],
  'liderazgo': [/liderazgo/, 'liderazgo'],
  'seleccion de personal': [/talento/, 'selección de personal'],
  'logistica': [/logistica|rutas/, 'logística'],
  'legal': [/argumentacion|demanda|contrato/, 'práctica legal'],
  'fiscal y contable': [/fiscal/, 'fiscal'],
  'negocios': [/negocio|ventas/, 'negocios']
};

let resTk = 0; // sube cada vez que cambia la pantalla: cancela esperas de una pantalla anterior

const esperar = ms => new Promise(r => setTimeout(r, ms));
const normaTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function nodo(tag, cls, texto) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto != null) n.textContent = texto;
  return n;
}

// Catálogo de cursos: el mismo de la guía virtual de ICADEM (assistant/icadem-assistant-config.js).
// Si no está disponible, el resultado se muestra igual, solo sin la lista de cursos.
async function cargarRecomendaciones() {
  for (let i = 0; i < 30 && !window.ICADEM_ASSISTANT_CONFIG; i++) await esperar(100);
  const cfg = window.ICADEM_ASSISTANT_CONFIG;
  if (!cfg || !Array.isArray(cfg.courses)) return null;
  const lista = cfg.courses
    .filter(c => (Number(c.classes) || 0) >= 2)
    .map(c => ({ id: c.id, titulo: c.title, area: c.area, texto: c.detail || '', clases: c.classes, imagen: c.cover || '', emoji: '📘' }));
  return lista.length ? { lista, portada: c => c.imagen || 'assets/img/cursos-mini/curso-01.webp' } : null;
}

// Elige hasta 3 cursos: primero los que coinciden con su meta (accesos vasculares, urgencias…) y con el tema que dijo
// que le interesa; el resto del catálogo solo completa si hacen falta.
function recomendar(lista) {
  const re = TEMA_CLAVES[respuestas.interes];
  const metas = [respuestas.p2b, respuestas.p2].filter(Boolean).map(normaTxt).filter(v => METAS_NORMA[v]);
  return lista
    .map((c, i) => {
      const t = normaTxt(c.titulo + ' ' + (c.texto || '') + ' ' + c.area);
      let pts = 0, razon = null;
      metas.forEach(m => { const [patron, nombre] = METAS_NORMA[m]; if (patron.test(t)) { pts += 5; razon = razon || nombre; } });
      if (re && re.test(t)) { pts += 3; razon = razon || TEMA_CORTO[respuestas.interes]; }
      if (re && re.test(normaTxt(c.area))) pts += 2; // el área del curso coincide: va por delante de una coincidencia solo en el título
      return { c, pts, razon, i };
    })
    .sort((a, b) => b.pts - a.pts || a.i - b.i)
    .slice(0, 3);
}

async function renderResultado() {
  const body = document.getElementById('af-enc-body');
  if (!body) return;
  const tk = ++resTk;
  actualizarAtras();
  document.getElementById('af-enc-step').textContent = 'Un momento';
  ponerTitulo('Preparando tu resultado…');
  af_setExpr('thinking', { titulo: 'Analizando tus respuestas.', texto: 'Estoy armando tu resultado y los cursos que más te pueden servir.' });
  body.innerHTML = '';
  const espera = nodo('div', 'af-enc-res af-enc-wait');
  espera.setAttribute('aria-hidden', 'true');
  espera.append(nodo('i'), nodo('i'), nodo('i'));
  body.appendChild(espera);
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [rec] = await Promise.all([cargarRecomendaciones(), esperar(reducido ? 250 : 1500)]);
  if (tk !== resTk || !document.getElementById('af-enc-card')) return;
  guardarRespuesta(null); // las respuestas ya están completas: se guardan sin esperar
  pintarResultado(rec);
}

function pintarResultado(rec, aviso) {
  const body = document.getElementById('af-enc-body');
  if (!body) return;
  resTk++;
  const recomendados = rec ? recomendar(rec.lista) : [];
  const fortaleza = FORT_PERFIL[respuestas.p1] || 'tus ganas de aprender';
  const tema = TEMA_CORTO[respuestas.interes];
  document.getElementById('af-enc-step').textContent = 'Tu resultado';
  if (tema) {
    const resalta = nodo('span', 'af-enc-hl', tema);
    ponerTitulo(['¡Vas por muy buen camino en ', resalta, '!'], true);
  } else {
    ponerTitulo('¡Estás listo para dar el siguiente paso!', true);
  }
  af_setExpr('excited', { titulo: '¡Tu resultado está listo!', texto: 'Elige un curso y empieza gratis sus primeras clases.' });
  saludar();
  actualizarAtras();
  const lead = nodo('p', 'af-enc-lead');
  lead.append('Destacas por ', nodo('b', null, fortaleza), '. ' + halagos());

  const res = nodo('div', 'af-enc-res');
  res.appendChild(lead);
  const promo = nodo('div', 'af-enc-promo');
  const etiqueta = nodo('span', 'af-enc-promo-tag', '¡GRATIS!');
  const titular = nodo('p', 'af-enc-promo-t');
  titular.append('Empieza ', nodo('mark', null, 'gratis'), ' con un curso de tu interés');
  promo.append(etiqueta, titular, nodo('p', 'af-enc-promo-s', 'Sin tarjeta de crédito · 100% en línea · A tu ritmo'));
  res.appendChild(promo);
  if (aviso) res.appendChild(nodo('p', 'af-enc-ok', aviso));

  if (recomendados.length) {
    res.appendChild(nodo('p', 'af-enc-hint', 'Elige el curso que más te interesa y crea tu cuenta gratis: dentro del Club VIP eliges tu curso gratuito y ves sus primeras clases.'));
    const lista = nodo('div', 'af-enc-lista');
    recomendados.forEach(({ c, razon }) => lista.appendChild(filaCurso(c, razon, rec.portada, () => confirmarCurso(c, razon, rec, aviso))));
    res.appendChild(lista);
  } else {
    const crear = nodo('a', 'af-enc-opt af-enc-cta', 'Crear mi cuenta gratis →');
    crear.href = urlAuth('register');
    crear.addEventListener('click', ev => { ev.preventDefault(); irAAuth('register'); });
    res.appendChild(crear);
  }

  const pie = nodo('div', 'af-enc-pie');
  const yaTengo = nodo('button', 'af-enc-link', 'Ya tengo cuenta');
  yaTengo.type = 'button';
  yaTengo.addEventListener('click', () => irAAuth('login'));
  const asesor = nodo('button', 'af-enc-link', 'Prefiero que un asesor me escriba');
  asesor.type = 'button';
  asesor.addEventListener('click', () => renderContacto(rec));
  const seguir = nodo('button', 'af-enc-link', 'Seguir viendo');
  seguir.type = 'button';
  seguir.addEventListener('click', async () => { await finalizarEncuesta(); cerrarSeccion(); });
  pie.append(yaTengo, asesor, seguir);
  res.appendChild(pie);
  body.innerHTML = '';
  body.appendChild(res);
}

// Misma tarjeta que usa la guía virtual (foto, nombre y "Ver →"), con el motivo de la recomendación.
function filaCurso(c, razon, portada, alElegir) {
  const b = nodo('button', 'af-cb-cur');
  b.type = 'button';
  const th = nodo('span', 'af-cb-th', c.emoji);
  const img = nodo('img');
  img.alt = '';
  img.loading = 'lazy';
  img.src = portada(c);
  img.addEventListener('error', () => img.remove());
  th.appendChild(img);
  const ct = nodo('span', 'af-cb-ct');
  ct.append(nodo('b', null, c.titulo), nodo('small', null, razon ? 'Te serviría para reforzar ' + razon : c.area));
  b.append(th, ct, nodo('span', 'af-cb-go', 'Ver →'));
  b.addEventListener('click', alElegir);
  return b;
}

// Confirmación antes de llevar a la persona a otra página (como en la guía virtual).
function confirmarCurso(c, razon, rec, aviso) {
  const body = document.getElementById('af-enc-body');
  if (!body) return;
  resTk++;
  document.getElementById('af-enc-step').textContent = 'Último paso';
  ponerTitulo(['¡Excelente ', nodo('span', 'af-enc-hl', 'elección'), '!'], true);
  af_setExpr('happy', { titulo: '¡Buena elección!', texto: 'Crea tu cuenta gratis y elige este curso como tu curso gratuito.' });
  const res = nodo('div', 'af-enc-res');
  // el curso elegido, destacado
  const sel = nodo('div', 'af-enc-sel');
  const th = nodo('span', 'af-cb-th', c.emoji);
  const img = nodo('img');
  img.alt = '';
  img.src = rec.portada(c);
  img.addEventListener('error', () => img.remove());
  th.appendChild(img);
  const info = nodo('span', 'af-enc-sel-i');
  info.append(nodo('span', 'af-enc-sel-tag', 'Tu curso gratuito'), nodo('b', null, c.titulo), nodo('small', null, razon ? 'Para reforzar ' + razon : c.area));
  sel.append(th, info);
  res.appendChild(sel);
  res.appendChild(nodo('p', 'af-enc-lead', 'Crea tu cuenta gratis y, ya en el Club VIP, elige este curso como tu curso gratuito. Solo toma un minuto.'));
  const crear = nodo('a', 'af-enc-opt af-enc-cta', 'Crear mi cuenta gratis →');
  crear.href = urlAuth('register', c);
  crear.addEventListener('click', ev => { ev.preventDefault(); irAAuth('register', c); });
  const ya = nodo('button', 'af-enc-opt af-enc-sec', 'Ya tengo cuenta');
  ya.type = 'button';
  ya.addEventListener('click', () => irAAuth('login', c));
  const otro = nodo('button', 'af-enc-link', '← Elegir otro curso');
  otro.type = 'button';
  otro.addEventListener('click', () => pintarResultado(rec, aviso));
  res.append(crear, ya, otro);
  body.innerHTML = '';
  body.appendChild(res);
}

// Guarda lo respondido y lleva a crear cuenta o iniciar sesión. El curso elegido queda como preferencia
// para que el panel lo proponga como prueba gratuita (solo si la cuenta es nueva y elegible).
async function irAAuth(tab, curso) {
  if (curso) {
    try { localStorage.setItem(PREF_CURSO_KEY, JSON.stringify({ id: curso.id, titulo: curso.titulo, t: Date.now() })); } catch (e) {}
  }
  document.querySelectorAll('#af-enc-body button, #af-enc-body a').forEach(el => { el.style.pointerEvents = 'none'; });
  await finalizarEncuesta(); // se espera el guardado: si no, el cambio de página lo cancelaría (y si falla queda pendiente)
  window.location.href = urlAuth(tab, curso);
}

// Pantalla secundaria: dejar el WhatsApp para que un asesor escriba (opcional, con Aviso de privacidad).
function renderContacto(rec) {
  const body = document.getElementById('af-enc-body');
  if (!body) return;
  resTk++;
  actualizarAtras(true);
  document.getElementById('af-enc-step').textContent = 'Un asesor te escribe';
  ponerTitulo('¿A qué WhatsApp te escribimos?');
  af_setExpr('excited', { titulo: 'Con gusto te ayudamos.', texto: 'Déjanos tu WhatsApp y un asesor te escribe con opciones para ti. Es opcional.' });
  body.innerHTML = `
    <div class="af-enc-telrow">
      <select class="af-enc-pais" id="af-enc-pais" aria-label="País de tu WhatsApp">
        ${PAISES.map(p => `<option value="${p.cod}">${p.nombre}${p.pref ? ' +' + p.pref : ''}</option>`).join('')}
      </select>
      <input class="af-enc-input" id="af-enc-contacto" type="tel" inputmode="tel" autocomplete="tel">
    </div>
    <p class="af-enc-error" id="af-enc-error" role="alert" hidden></p>
    <label class="af-enc-consent" id="af-enc-consent">
      <input type="checkbox" id="af-enc-acepto">
      <span>Acepto el <a href="privacidad.html" target="_blank" rel="noopener">Aviso de privacidad</a> y que un asesor me escriba por WhatsApp con información de cursos.</span>
    </label>
    <button type="button" class="af-enc-opt af-enc-cta" id="af-enc-enviar">Guardar mi WhatsApp</button>
    <button type="button" class="af-enc-opt af-enc-sec" id="af-enc-volver">Volver a mis cursos</button>
  `;
  const input = document.getElementById('af-enc-contacto');
  const error = document.getElementById('af-enc-error');
  const acepto = document.getElementById('af-enc-acepto');
  const consent = document.getElementById('af-enc-consent');
  const enviar = document.getElementById('af-enc-enviar');
  const volver = document.getElementById('af-enc-volver');
  const pais = document.getElementById('af-enc-pais');
  const AYUDA_NUMERO = {
    MX: 'Escribe tu WhatsApp de México con 10 dígitos y lada (por ejemplo 55 1234 5678).',
    OT: 'Escríbelo completo con el código de tu país (por ejemplo +49 151 2345 6789).',
    otro: 'Escríbelo completo, sin el código del país.'
  };
  const PLACEHOLDER = { MX: '10 dígitos con lada', OT: 'Con código de país (+…)' };
  const avisar = (texto, marcarCasilla) => {
    error.textContent = texto;
    error.hidden = false;
    consent.classList.toggle('is-error', !!marcarCasilla);
  };
  const limpiarError = () => { error.hidden = true; consent.classList.remove('is-error'); };
  pais.value = paisPorDefecto();
  // El selector se ajusta al texto del país elegido para que la flecha quede junto a él, no al fondo.
  const ajustarAnchoPais = () => {
    const medidor = document.createElement('span');
    const estilo = getComputedStyle(pais);
    medidor.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + estilo.font;
    medidor.textContent = pais.options[pais.selectedIndex].text;
    document.body.appendChild(medidor);
    pais.style.width = Math.ceil(medidor.getBoundingClientRect().width) + 14 + 30 + 4 + 'px';
    medidor.remove();
  };
  const actualizarPais = () => { input.placeholder = PLACEHOLDER[pais.value] || 'Tu número'; ajustarAnchoPais(); };
  actualizarPais();
  pais.addEventListener('change', () => { actualizarPais(); limpiarError(); });
  input.addEventListener('input', limpiarError);
  acepto.addEventListener('change', limpiarError);
  // Aquí el número sí es el objetivo: debe ser válido (WhatsApp de México u otro país) y tener marcada la
  // casilla del Aviso de privacidad; sin eso no se guarda ni se usa.
  const guardar = async () => {
    if (enviar.disabled) return; // ya se está guardando (por ejemplo, doble Enter)
    const crudo = input.value.trim();
    if (!crudo) { avisar('Escribe tu número, o vuelve a tus cursos si prefieres no dejarlo.', false); input.focus(); return; }
    const numero = normalizarWhatsapp(pais.value, crudo);
    if (!numero) {
      avisar(`Ese número no parece válido. ${AYUDA_NUMERO[pais.value] || AYUDA_NUMERO.otro}`, false);
      input.focus();
      return;
    }
    if (!acepto.checked) { avisar('Marca la casilla para que un asesor pueda escribirte.', true); return; }
    enviar.textContent = 'Guardando…';
    enviar.disabled = true;
    volver.disabled = true;
    await guardarRespuesta(numero);
    pintarResultado(rec, '¡Listo! Un asesor te escribirá por WhatsApp. Mientras, puedes elegir tu curso.');
  };
  enviar.addEventListener('click', guardar);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') guardar(); });
  volver.addEventListener('click', () => pintarResultado(rec));
}

// ── Guardado ────────────────────────────────────────────────────────────────
// Las respuestas completas se guardan una sola vez por vuelta de la encuesta; el WhatsApp, si lo deja, va
// en un segundo documento con la misma sesión (el panel de admin junta ambos).
// Cada envío queda anotado en el navegador (PEND_KEY) hasta que la base de datos lo CONFIRMA: si falla el
// internet o la persona cierra la página antes, se reintenta solo cuando vuelva la conexión o la próxima
// vez que abra el sitio. Solo se marca "guardado" tras la confirmación.
const enVuelo = new Set();
let guardadoPrincipal = null; // envío de las respuestas de esta vuelta (se reinicia si cambia una respuesta)
let finalizada = false;       // la persona ya terminó y salió de la encuesta

function leerPendientes() {
  try { const l = JSON.parse(localStorage.getItem(PEND_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
function escribirPendientes(lista) {
  try { if (lista.length) localStorage.setItem(PEND_KEY, JSON.stringify(lista)); else localStorage.removeItem(PEND_KEY); } catch (e) {}
}

function postEncuesta(cuerpo) {
  return fetch(API_ENCUESTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), keepalive: true })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return true; });
}

function enviarPendiente(item) {
  if (enVuelo.has(item.id)) return Promise.resolve(false);
  enVuelo.add(item.id);
  const doc = { sessionId: item.sid, respuestas: item.respuestas, completada: true };
  if (item.contacto) {
    doc.contacto = item.contacto;
    doc.avisoAceptado = true;
    doc.avisoVersion = AVISO_VERSION;
  }
  return postEncuesta(doc)
    .then(() => { escribirPendientes(leerPendientes().filter(x => x.id !== item.id)); return true; })
    .catch(e => { console.warn('[encuesta] no se pudo guardar; se reintentará:', e.message); return false; })
    .finally(() => enVuelo.delete(item.id));
}

function enviarNuevo(contacto) {
  const item = { id: Date.now() + '-' + Math.random().toString(16).slice(2), sid: getSessionId(), respuestas: { ...respuestas }, contacto: contacto || null };
  escribirPendientes([...leerPendientes(), item]);
  return enviarPendiente(item);
}

function reintentarPendientes() {
  leerPendientes().forEach(enviarPendiente);
}

// Guarda lo respondido. Espera como máximo 3 s para no dejar colgada a la persona; si no alcanzó a confirmarse,
// el envío sigue en curso (o queda pendiente para reintentarse).
async function guardarRespuesta(contacto) {
  let promesa;
  if (contacto) {
    promesa = enviarNuevo(contacto);
  } else {
    if (leerProgreso().guardado) return true; // ya confirmado en esta vuelta
    if (!guardadoPrincipal) {
      guardadoPrincipal = enviarNuevo(null).then(ok => {
        if (ok && !finalizada) guardarProgreso({ guardado: true });
        else if (!ok) guardadoPrincipal = null; // falló: el siguiente intento vuelve a mandarlo
        return ok;
      });
    }
    promesa = guardadoPrincipal;
  }
  return Promise.race([promesa, new Promise(r => setTimeout(() => r(false), 3000))]);
}

// La persona terminó (eligió un curso, creó cuenta/inició sesión o pulsó "Seguir viendo"): se asegura el guardado
// y se borra su avance, de modo que al actualizar la página la encuesta aparece de nuevo desde el principio.
async function finalizarEncuesta() {
  await guardarRespuesta(null);
  finalizada = true;
  try { localStorage.removeItem(PROG_KEY); } catch (e) {}
}

// La sección desaparece en esta visita; al actualizar la página vuelve a aparecer.
function cerrarSeccion() {
  const sec = document.getElementById('encuentra');
  if (sec) sec.remove();
}

// Si el visitante se va a media encuesta se guarda una copia parcial (el panel de
// admin la reemplaza por la completa si luego termina). Mejor esfuerzo: al salir
// de la página el navegador puede cortar la petición.
function guardarParcialSiHaceFalta() {
  if (finalizada || guardadoPrincipal || leerProgreso().guardado) return;
  const n = Object.keys(respuestas).length;
  if (n === 0 || n === (leerProgreso().parcialN || 0)) return;
  guardarProgreso({ parcialN: n });
  postEncuesta({ sessionId: getSessionId(), respuestas: { ...respuestas }, completada: false })
    .catch(e => console.warn('[encuesta] no se pudo guardar parcial:', e.message));
}

function iniciar() {
  // Limpia el estado de ediciones anteriores y el "completada" que dejaban las versiones previas
  // (ya no se usa: la encuesta vuelve a aparecer al actualizar la página).
  try {
    localStorage.removeItem(ESTADO_KEY);
    Object.keys(localStorage).filter(k => /^icadem_encuesta_(estado|prog|pend)_e/.test(k) && !k.endsWith('_e' + EDICION)).forEach(k => localStorage.removeItem(k));
  } catch (e) {}
  setTimeout(reintentarPendientes, 1500); // envíos que no se confirmaron en una visita anterior
  window.addEventListener('online', reintentarPendientes);
  precargarImagenes();
  const prog = leerProgreso();
  Object.assign(respuestas, prog.respuestas || {});
  paso = prog.paso || 0;
  construirUI();
  renderPaso();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') guardarParcialSiHaceFalta();
  });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') iniciar();
else document.addEventListener('DOMContentLoaded', iniciar);
