window.ICADEM_ASSISTANT_CONFIG = Object.freeze({
  id: 'icadem-guia-profesional',
  assistantName: 'ICADEM',
  assistantLabel: 'Asistente virtual · Guía profesional',
  apiBase: 'https://icadem-webhook-production.up.railway.app',
  image: 'assistant/assets/icadem-guide.png',
  blinkImage: 'assistant/assets/icadem-guide-blink.png',
  privacyUrl: 'privacidad.html',
  whatsappUrl: 'https://wa.me/522381479274?text=Hola%2C%20vengo%20del%20asistente%20de%20ICADEM%20y%20necesito%20orientaci%C3%B3n.',
  catalogUrl: 'vip-auth.html?tab=register&origen=guia-icadem',
  welcome: 'Hola, soy la guía virtual de ICADEM. Puedo explicarte temas fiscales, contables, legales, financieros, de recursos humanos y de negocio; también puedo recomendarte una ruta con cursos reales.',
  courses: [
    { id:'BcWI7FGsZ6Lqz5YmfFIe', title:'Amparo directo e indirecto en materia penal', area:'Legal', classes:5, cover:'assets/cursos/vip/amparo-penal.jpg', detail:'Distingue procedencia, etapas y estrategia del amparo penal.', tags:['legal','abogacia','amparo','penal','litigio','defensa'] },
    { id:'A67K9cNKktrC38t8GBmn', title:'Argumentación jurídica en audiencias previas al juicio', area:'Legal', classes:5, cover:'assets/cursos/vip/argumentacion-audiencias-previas.jpg', detail:'Estructura argumentos sólidos para audiencias previas.', tags:['legal','abogacia','argumentacion','audiencias','litigio','oral'] },
    { id:'kiFbLvkNnMed8lgouXh8', title:'Argumentación jurídica: narrativa, falacias y persuasión', area:'Legal', classes:5, cover:'assets/cursos/vip/argumentacion-narrativa-falacias.jpg', detail:'Mejora narrativa, razonamiento y persuasión jurídica.', tags:['legal','abogacia','argumentacion','falacias','persuasion','litigio'] },
    { id:'UrMcpg0pQgAgBI6dSs8O', title:'Conducción de audiencias y litigación oral', area:'Legal', classes:3, cover:'assets/cursos/vip/conduccion-audiencias-litigacion.jpg', detail:'Entrena conducción, teoría del caso y litigación oral.', tags:['legal','abogacia','audiencias','litigio','oral','practica'] },
    { id:'1xaWMqqsQTwzlsQAGEfy', title:'Contratos mercantiles en la práctica', area:'Legal', classes:4, cover:'assets/cursos/vip/contratos-mercantiles.jpg', detail:'Redacta y revisa acuerdos comerciales con mejor control de riesgos.', tags:['legal','contratos','mercantil','empresa','pymes','riesgos'] },
    { id:'3UErA6VzEb8yCHBP8wu5', title:'Contratos inmobiliarios y derecho civil', area:'Legal', classes:5, cover:'assets/cursos/vip/contratos-inmobiliarios-derecho-civil.jpg', detail:'Aplica criterios civiles a operaciones inmobiliarias.', tags:['legal','contratos','civil','inmobiliario','fraude','patrimonio'] },
    { id:'ZNGXQyIv3pWye25ugZ3q', title:'Derecho fiscal aplicado', area:'Fiscal', classes:5, cover:'assets/cursos/vip/derecho-fiscal-aplicado.jpg', detail:'Comprende obligaciones, facultades de la autoridad y defensa fiscal.', tags:['fiscal','sat','impuestos','contabilidad','legal','defensa','cumplimiento'] },
    { id:'VdTVm9KeKEx2qoIgnBPZ', title:'Derecho notarial y registral', area:'Legal', classes:5, cover:'assets/cursos/vip/derecho-notarial-registral.jpg', detail:'Estudia función notarial, instrumentos y registros públicos.', tags:['legal','notarial','registral','escrituras','inmobiliario'] },
    { id:'ZHIhKUptcNXZawUn6lOc', title:'Divorcio mediante juicio oral', area:'Legal', classes:5, cover:'assets/cursos/vip/divorcio-juicio-oral.jpg', detail:'Ordena la estrategia y las etapas del divorcio oral.', tags:['legal','familiar','divorcio','juicio','oral','litigio'] },
    { id:'2okJKdxTaHeroaiII40i', title:'Pensión alimentaria y litigación familiar', area:'Legal', classes:5, cover:'assets/cursos/vip/pension-alimentaria-litigacion-familiar.jpg', detail:'Aborda alimentos, prueba y estrategia de litigación familiar.', tags:['legal','familiar','pension','alimentos','litigio'] },
    { id:'dyWzInQkh46VjFo9xJKn', title:'Prevención y análisis del fraude inmobiliario', area:'Legal', classes:3, cover:'assets/cursos/vip/prevencion-fraude-inmobiliario.jpg', detail:'Identifica señales de alerta y valida operaciones inmobiliarias.', tags:['legal','inmobiliario','fraude','riesgos','debida-diligencia'] },
    { id:'CkbC8n6VHc67gqWbLUL7', title:'Elaboración de demandas y contestaciones', area:'Legal', classes:4, cover:'assets/cursos/vip/elaboracion-demandas-contestaciones.jpg', detail:'Estructura pretensiones, hechos, pruebas y defensas procesales.', tags:['legal','abogacia','demandas','contestaciones','litigio','redaccion'] },
    { id:'1cZo316GQR8P6Y4eFK53', title:'Caducidad de créditos fiscales y medios de defensa', area:'Fiscal', classes:1, cover:'assets/cursos/vip/caducidad-creditos-fiscales-defensa.jpg', detail:'Distingue caducidad, prescripción y vías de defensa fiscal.', tags:['fiscal','sat','creditos','caducidad','prescripcion','defensa','legal'] },
    { id:'i6jlJmjyz3j3Xa1o21za', title:'Tratados de libre comercio: aplicación práctica y beneficios arancelarios', area:'Negocios', classes:4, cover:'assets/cursos/vip/tratados-libre-comercio.jpg', detail:'Aplica tratados y aprovecha preferencias arancelarias con evidencia.', tags:['negocios','comercio-exterior','aduanas','tratados','aranceles','exportacion'] },
    { id:'0PJFLfcqyc9R2wSTP6kF', title:'Clasificación arancelaria y reglas de interpretación', area:'Negocios', classes:4, cover:'assets/cursos/vip/clasificacion-arancelaria.jpg', detail:'Clasifica mercancías con reglas y criterios verificables.', tags:['negocios','comercio-exterior','aduanas','aranceles','importacion','exportacion'] },
    { id:'0LykwhqPns9qNQbO51iO', title:'Excel administrativo: control y optimización', area:'Negocios', classes:3, cover:'assets/cursos/vip/excel-administrativo.jpg', detail:'Organiza información, controles y reportes administrativos.', tags:['negocios','administracion','excel','datos','contabilidad','control','productividad'] },
    { id:'N6ljRcFTkheVxmHXYBii', title:'Finanzas para la toma de decisiones', area:'Finanzas', classes:4, cover:'assets/cursos/vip/finanzas-toma-decisiones.jpg', detail:'Interpreta información financiera para decidir con criterio.', tags:['finanzas','contabilidad','estados-financieros','flujo','presupuesto','decisiones'] },
    { id:'O7CGIcE0flHuUTQF8rty', title:'Inteligencia financiera', area:'Finanzas', classes:5, cover:'assets/cursos/vip/inteligencia-financiera.jpg', detail:'Fortalece hábitos, análisis y planeación financiera.', tags:['finanzas','contabilidad','planeacion','ahorro','credito','negocio'] },
    { id:'TnzDdjMOovb5z3GPU2zt', title:'Inversiones y mercados financieros', area:'Finanzas', classes:3, cover:'assets/cursos/vip/inversiones-mercados-financieros.jpg', detail:'Comprende instrumentos, rendimiento, riesgo y diversificación.', tags:['finanzas','inversiones','mercados','riesgo','rendimiento','portafolio'] },
    { id:'5AMpKfjsSIpNEBffd63p', title:'Gestión de almacenes e inventarios', area:'Negocios', classes:5, cover:'assets/cursos/vip/gestion-almacenes-inventarios.jpg', detail:'Controla existencias, movimientos, indicadores y operación.', tags:['negocios','almacenes','inventarios','logistica','operaciones','control'] },
    { id:'pAdSmtHjxULW4CNajb9H', title:'Logística, operaciones y almacenes', area:'Negocios', classes:5, cover:'assets/cursos/vip/logistica-operaciones-almacenes.jpg', detail:'Integra abastecimiento, operación, almacén y distribución.', tags:['negocios','logistica','operaciones','almacenes','cadena-suministro'] },
    { id:'c3BNdUDfjBj4hJ9Unnqb', title:'Planeación estratégica de rutas de distribución', area:'Negocios', classes:1, cover:'assets/cursos/vip/planeacion-rutas-distribucion.jpg', detail:'Diseña rutas con criterios de costo, servicio y capacidad.', tags:['negocios','logistica','rutas','distribucion','costos','operaciones'] },
    { id:'dVAhomFtlE3Xts6Y1wQ1', title:'Indicadores y mejores prácticas para la gestión de inventarios', area:'Negocios', classes:2, cover:'assets/cursos/vip/indicadores-gestion-inventarios.jpg', detail:'Mide rotación, exactitud, cobertura y nivel de servicio.', tags:['negocios','inventarios','indicadores','kpi','almacenes','control'] },
    { id:'Chv5kQzoC473LZpfVwtj', title:'Inteligencia emocional y manejo del estrés', area:'Recursos Humanos', classes:5, cover:'assets/cursos/vip/inteligencia-emocional-manejo-estres.jpg', detail:'Regula emociones y fortalece respuestas saludables al estrés.', tags:['recursos-humanos','personas','estres','inteligencia-emocional','bienestar'] },
    { id:'is1aPC49EvZnIKkyS3Y7', title:'Liderazgo estratégico y gestión de alto impacto', area:'Recursos Humanos', classes:5, cover:'assets/cursos/vip/liderazgo-estrategico-alto-impacto.jpg', detail:'Alinea equipos, prioridades y ejecución estratégica.', tags:['recursos-humanos','liderazgo','equipos','estrategia','gestion'] },
    { id:'yOqWUsJonnQ0IO5fJyeO', title:'Liderazgo para mandos medios', area:'Recursos Humanos', classes:5, cover:'assets/cursos/vip/liderazgo-mandos-medios.jpg', detail:'Desarrolla supervisión, comunicación y seguimiento.', tags:['recursos-humanos','liderazgo','mandos-medios','equipos','comunicacion'] },
    { id:'FWkM4YO1VlE2BSGX9WYZ', title:'Liderazgo y gerencia de equipos', area:'Recursos Humanos', classes:3, cover:'assets/cursos/vip/liderazgo-gerencia-equipos.jpg', detail:'Coordina desempeño, acuerdos y resultados colectivos.', tags:['recursos-humanos','liderazgo','gerencia','equipos','desempeno'] },
    { id:'t3Sqq9QbiOXCN6r6QE7N', title:'Selección de talento 4.0: técnicas y tendencias', area:'Recursos Humanos', classes:4, cover:'assets/cursos/vip/seleccion-talento-4.jpg', detail:'Mejora perfiles, entrevistas y decisiones de contratación.', tags:['recursos-humanos','seleccion','reclutamiento','talento','entrevistas'] },
    { id:'PlXGveysEzktbxz08oTH', title:'Competencias digitales para docentes', area:'Recursos Humanos', classes:3, cover:'assets/cursos/vip/competencias-digitales-docentes.jpg', detail:'Integra herramientas digitales a experiencias de aprendizaje.', tags:['recursos-humanos','docencia','digital','educacion','productividad'] },
    { id:'fN1cNQYJEUDbWNTwo8vu', title:'Meta Ads con IA: campañas, métricas y optimización', area:'Negocios', classes:5, cover:'assets/cursos/vip/meta-ads-ia.jpg', detail:'Planea campañas, interpreta métricas y optimiza inversión.', tags:['negocios','marketing','ventas','meta-ads','publicidad','ia','metricas'] },
    { id:'iTGcAVqeip8NukrXrk6P', title:'Ventas digitales y publicidad en redes sociales', area:'Negocios', classes:2, cover:'assets/cursos/vip/ventas-digitales-redes-sociales.jpg', detail:'Conecta contenido, publicidad y seguimiento comercial.', tags:['negocios','marketing','ventas','redes-sociales','publicidad','clientes'] },
    { id:'cJsV1WkKs0cuyAJ2YYMO', title:'Negocio inmobiliario más allá de las ventas', area:'Negocios', classes:5, cover:'assets/cursos/vip/negocio-inmobiliario.jpg', detail:'Profesionaliza estrategia, operación y servicio inmobiliario.', tags:['negocios','inmobiliario','ventas','servicio','estrategia'] }
  ],
  survey: {
    eyebrow: 'TU RUTA ICADEM',
    title: 'Encuentra una ruta profesional hecha para ti.',
    detail: 'Responde cinco preguntas breves. Obtendrás un perfil y cursos reales de la membresía; al final puedes guardar tu ruta con tus datos.',
    questions: [
      { overline:'TU PERFIL', title:'¿Qué describe mejor tu trabajo actual?', detail:'Así ajustamos el lenguaje y el enfoque.', options:[
        { icon:'⚖️', label:'Abogacía o área legal', detail:'Litigio, contratos, fiscal o cumplimiento.', tags:['legal','abogacia','litigio'] },
        { icon:'🧾', label:'Contabilidad o fiscal', detail:'Impuestos, control, información financiera o SAT.', tags:['contabilidad','fiscal','sat','finanzas'] },
        { icon:'🏢', label:'Dirección o emprendimiento', detail:'Tomo decisiones para una empresa o proyecto.', tags:['negocios','estrategia','finanzas','liderazgo'] },
        { icon:'👥', label:'Recursos humanos', detail:'Talento, liderazgo, bienestar y equipos.', tags:['recursos-humanos','liderazgo','talento'] },
        { icon:'📦', label:'Operaciones o logística', detail:'Inventarios, almacenes, rutas y ejecución.', tags:['operaciones','logistica','inventarios'] },
        { icon:'🎓', label:'Estudiante o profesionista', detail:'Quiero actualizarme o ampliar oportunidades.', tags:['practica','legal','negocios','finanzas'] }
      ] },
      { overline:'TU PRIORIDAD', title:'¿Qué quieres resolver primero?', detail:'Elige el resultado más importante hoy.', options:[
        { icon:'🛡️', label:'Cumplir y reducir riesgos', detail:'Prevenir errores fiscales, legales u operativos.', tags:['cumplimiento','fiscal','legal','riesgos'] },
        { icon:'📊', label:'Tomar mejores decisiones', detail:'Leer datos, finanzas e indicadores con claridad.', tags:['finanzas','contabilidad','indicadores','datos'] },
        { icon:'📣', label:'Vender y crecer', detail:'Captación, campañas y estrategia comercial.', tags:['ventas','marketing','publicidad','negocios'] },
        { icon:'🤝', label:'Liderar personas', detail:'Mejorar comunicación, selección y desempeño.', tags:['recursos-humanos','liderazgo','equipos'] },
        { icon:'⚙️', label:'Ordenar la operación', detail:'Controlar procesos, inventario y logística.', tags:['operaciones','inventarios','logistica','control'] },
        { icon:'🗣️', label:'Fortalecer mi práctica legal', detail:'Argumentar, redactar y litigar mejor.', tags:['legal','abogacia','litigio','argumentacion'] }
      ] },
      { overline:'TU NIVEL', title:'¿Desde dónde comienzas?', detail:'No es una evaluación; solo calibra la ruta.', options:[
        { icon:'1', label:'Voy empezando', detail:'Necesito bases claras y ejemplos.', tags:['fundamentos'] },
        { icon:'2', label:'Ya tengo experiencia', detail:'Quiero aplicar mejor lo que sé.', tags:['practica','control'] },
        { icon:'3', label:'Busco especializarme', detail:'Necesito profundidad y criterio profesional.', tags:['especialidad','legal','finanzas'] },
        { icon:'↻', label:'Quiero actualizarme', detail:'Deseo revisar tendencias y reforzar decisiones.', tags:['actualizacion','digital','ia'] }
      ] },
      { overline:'TU FORMA DE APRENDER', title:'¿Qué formato te ayuda más?', detail:'Priorizaremos cursos compatibles con tu ritmo.', options:[
        { icon:'⚡', label:'Ruta breve y práctica', detail:'Quiero comenzar con una victoria rápida.', tags:['short','practica'] },
        { icon:'🗺️', label:'Ruta completa', detail:'Prefiero avanzar paso a paso.', tags:['long','fundamentos'] },
        { icon:'🧠', label:'Casos y criterio', detail:'Aprendo resolviendo situaciones reales.', tags:['practica','riesgos','decisiones'] },
        { icon:'📈', label:'Herramientas y métricas', detail:'Quiero aplicar controles y medir resultados.', tags:['datos','indicadores','control','excel'] }
      ] },
      { overline:'TU PRIMER TEMA', title:'¿Qué área quieres abrir hoy?', detail:'Después podrás explorar todo el catálogo.', options:[
        { icon:'⚖️', label:'Legal y litigación', detail:'Contratos, demandas, audiencias y defensa.', tags:['legal','litigio','contratos'] },
        { icon:'🧾', label:'Fiscal y contable', detail:'SAT, obligaciones, defensa e información financiera.', tags:['fiscal','sat','contabilidad','finanzas'] },
        { icon:'💰', label:'Finanzas e inversiones', detail:'Decisiones, mercados, riesgo y planeación.', tags:['finanzas','inversiones','riesgo'] },
        { icon:'👥', label:'Liderazgo y talento', detail:'Equipos, selección, bienestar y desempeño.', tags:['recursos-humanos','liderazgo','talento'] },
        { icon:'📦', label:'Operaciones y comercio', detail:'Logística, inventarios, rutas y aduanas.', tags:['operaciones','logistica','inventarios','comercio-exterior'] },
        { icon:'📣', label:'Ventas y marketing', detail:'Redes, publicidad, clientes y crecimiento.', tags:['ventas','marketing','publicidad'] }
      ] }
    ]
  }
});
