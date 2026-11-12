# CAMBIOS

## 2026-11-12 — Clases en vivo: ajustes finales y cuenta solo-administrador

**Archivos:** `vip-admin.html`, `vip-auth.html`, `vip-panel.html`

- Admin · Grabaciones automáticas: se quita el botón «Quitar de la lista» (quedan Buscar ahora / Reintentar, Editar y Eliminar).
- Admin: la etiqueta de rol dice «SUPERADMIN» solo con la cuenta de superadministración; las demás cuentas de administración dicen «ADMINISTRADOR».
- Panel de miembros · Clases en vivo: la agenda espera a que Firebase restaure la sesión antes de pedirla al servidor (antes, al recargar directamente en la sección salía «No pudimos cargar la agenda» hasta pulsar Reintentar).
- Panel de miembros · tarjeta de la próxima clase: durante la clase la cuenta regresiva muestra cuánto falta para que termine («La sesión está en vivo · termina en») en lugar de quedarse en cero; al terminar dice «La sesión terminó».
- Cuenta solo-administrador: `grupeliptica@gmail.com` (la que organiza y graba las clases en Meet) ya no tiene panel de miembros; al abrirlo va directo al administrador. Es una separación de uso, no de seguridad (lista `ADMIN_SOLO` en vip-panel.html).
- Corrección: la función auxiliar de «Ver como usuario» en vip-auth.html quedó dentro del bloque que extraen las pruebas del equipo (profesional-profile-auth); antes esas 3 pruebas fallaban.

## 2026-11-11 — Vistas del Directorio y actualización de datos académicos

- Solicitudes, Mis conexiones y Profesionales VIP abren vistas internas dedicadas del Directorio. Reutilizan las tarjetas, servicios, filtros y reglas de contacto actuales; los perfiles regresan a la vista de origen y se conserva su contexto de navegación.
- Banner más compacto, buscador de 46 px y selector de especialidades con etiqueta de 11 px y valor de 14 px. Se eliminan los textos solicitados del Directorio y el subtítulo de Mis cursos. El catálogo conserva distribución, portadas, criterios de orden y desbloqueos.
- El Directorio consulta la API actual: una copia local no decide membresías, profesionales ni conexiones. Actualiza al recuperar visibilidad/foco/conexión y usa su intervalo existente. Las acciones esperan confirmación y evitan duplicar operaciones en curso.
- Se publica también la corrección pendiente de sincronización de cursos: el ciclo existente consulta catálogo y prioridades además de identidad/progreso; las respuestas quedan vinculadas al UID y a la generación de sesión. Un fallo muestra que los datos no pudieron actualizarse. Un cambio remoto conserva el borrador y exige revisar el conflicto; se mantiene la revisión transaccional existente del backend.
- Chrome y WebKit: Directorio en 320/360/375/390/414/768/1024/1440 px con APIs aisladas. Dos contextos independientes verifican acciones de comunidad y prioridades en ambas direcciones, recargas, conflictos, errores y recuperación. Las pruebas de mutación son simuladas: no se cambiaron datos reales de usuarios. No se presenta esa evidencia como dos sesiones autenticadas contra producción ni como dispositivos físicos.
- Se integra main tras el PR de Ciudad ICADEM 1.0 y se conserva su referencia v5. Caché v160; no se modifica su código, infraestructura ni configuración. Sin cambios de backend académico, reglas Firebase, Stripe, membresías, créditos o emisión de certificados.
- Reversión: revertir únicamente este PR e incrementar de nuevo el Service Worker; no revertir el PR de Ciudad ni cambiar datos de cuentas.

## 2026-11-11 — Mis cursos: abiertos primero y vistas por categoría

- «Mi orden de prioridad» presenta primero los cursos con acceso académico, con el orden secundario existente; después, los pendientes priorizados con sus números guardados; finalmente, el resto. Los otros cuatro criterios y los permisos permanecen iguales.
- Disponibles, En progreso, Completados, Bloqueados, Próximamente y Curso de regalo abren rutas internas `#cursos-…`, con encabezado compacto, contador y regreso a Mis cursos. Comparten catálogo, filtros, tarjetas, progreso y valoraciones. No repiten Mis desbloqueos ni las estadísticas generales.
- El regreso conserva los filtros y desplazamiento de la biblioteca para la misma cuenta; Atrás/Adelante usa el historial existente. Se elimina únicamente «Biblioteca profesional» de Mis cursos. Sin cambios al organizador ni al backend.
- Pruebas aisladas en Chrome a 320/360/375/390/414/768/1024/1440 px: grupos de orden, prioridades, estados, navegación, filtros, portadas, errores de guardado y concurrencia entre sesiones. Responsive y tacto emulados; capturas revisadas. La suite general conserva tres fallos preexistentes de fixtures de acceso a perfiles (`destinoVistaAdmin`), reproducidos en el commit base; no se modifica autenticación.
- CSS del catálogo v9, navegación v3, valoraciones v7 y caché v158. La estrategia de caché de Ciudad permanece intacta; su prueba admite versiones posteriores de caché.
- Reversión: revertir el commit de esta tarea, incrementar otra vez la versión del Service Worker y publicar Pages. No hay migraciones ni modificaciones de datos que revertir.

## 2026-11-11 — Guardar prioridades activa su orden al regresar al catálogo

- Una confirmación correcta del PUT de prioridades activa «Mi orden de prioridad» para Mis cursos. Al volver se conserva el resto de los filtros y el catálogo grande utiliza el orden confirmado, en lugar del criterio previo al organizador. Un guardado fallido no activa esta preferencia.
- La elección manual de otro criterio se conserva al navegar por el menú y recargar. Se guarda solo el nombre del criterio por cuenta; las prioridades permanecen exclusivamente en el backend. Sin cambios al algoritmo de «Próximos a desbloquear», accesos, diseño o portadas.
- Diagnóstico de sesión: Firebase está configurado con persistencia local; el panel redirige al acceso si Firebase devuelve un usuario nulo. La pérdida de la sesión de Britney en la prueba anterior no pudo atribuirse a una causa concreta: la sesión actualmente conectada es administrativa. No se modificó autenticación ni se considera verificada la recarga de esa cuenta real.
- Pruebas aisladas en Chrome a 390/1440 px: guardar desde otro criterio, volver, tarjetas grandes, recarga, menú, elección manual, error y aislamiento de cuenta. Caché v157.

## 2026-11-11 — Conservar el orden elegido del catálogo principal al recargar

- Se confirmó en la sesión abierta que seleccionar «Mi orden de prioridad» y recargar devolvía el selector a «Próximos a desbloquear». El catálogo principal conserva ahora el criterio elegido en el parámetro de interfaz `ordenCursos`; las prioridades siguen obteniéndose exclusivamente del backend.
- No cambia el comparador estándar, los filtros, permisos, portadas ni Mi ruta de aprendizaje. La prueba de recarga verifica el selector sin volver a seleccionarlo y las cinco primeras tarjetas grandes contra las prioridades guardadas.
- Verificación en Chrome con datos aislados de varias prioridades, a 390/768/1440 px; sesión real conectada usada para reproducir la pérdida del criterio. Caché v156.

## 2026-11-11 — Revisión final de acciones y prioridades de Mis cursos

- Se conserva el diseño actual del catálogo y Mi ruta de aprendizaje. El orden por prioridades y la sincronización confirmada funcionan correctamente; cambiar filtros u ordenamiento no escribe prioridades.
- «Ver detalles» ya no cambia de apariencia al pasar el cursor por cualquier parte de la tarjeta: el estado interactivo corresponde al botón. La acción usa un botón nativo con foco visible y navegación por teclado; disponible, bloqueado, en progreso, completado y próximamente conservan su lógica de acceso.
- El estado temporal de recuperación de catálogo mantiene la restricción existente y muestra «Sincronizando…» con su motivo. No se modifican permisos académicos ni backend.
- Pruebas del catálogo ampliadas para estados de acción, contraste, teclado y desbordamiento temporal; regresiones de prioridades, selector y organizador en ocho tamaños emulados. CSS v8 y caché v155.

## 2026-11-11 — Prioridades visibles y orden personal en Mis cursos

- Las tarjetas muestran su posición confirmada en la lista («Prioridad #1», «Prioridad #2»…), con una acción discreta para Organizar. Elegir cursos sigue disponible cuando hay cupos. Las posiciones no se recalculan al filtrar el catálogo.
- Mis desbloqueos conserva su diseño compacto y añade «Primero en tu lista» con el primer curso pendiente elegible, nombre completo accesible y truncamiento visual. «Próximo cupo» evita sugerir un desbloqueo automático.
- Nuevo orden «Mi orden de prioridad»: aplica primero los filtros actuales, presenta los cursos de la lista en su orden guardado y después el resto con el criterio estándar. Se conservan los cuatro ordenamientos anteriores y las portadas actuales.
- Las confirmaciones del servidor actualizan inmediatamente números, primer curso y orden del catálogo. Una lectura tardía con una revisión antigua no reemplaza la información confirmada.
- El guardado envía `expectedRevision`; el backend lo compara dentro de la transacción. Un conflicto conserva el borrador y pide confirmar la carga de la lista actual. No modifica derechos ni consume cupos. El backend compatible se publicó antes del frontend.
- Validación visual y funcional en 320/360/375/390/414/768/1024/1440 px con Chrome y APIs aisladas; dispositivos y tacto emulados. Concurrencia comprobada también contra Firestore emulado. Recursos versionados y caché `icadem-vip-v154`.
- Reversión: revertir este cambio, incrementar de nuevo el Service Worker y publicar Pages. La precondición opcional del backend es compatible con el frontend anterior; las prioridades guardadas permanecen en su colección existente.

## 2026-11-11 — Mi ruta de aprendizaje y filtros compactos de Mis cursos

- «Organizar lista» abre una sección interna del panel, con las mismas portadas y el mismo catálogo de Mis cursos. En computadora se exploran cursos junto a la lista; en pantallas pequeñas la lista aparece primero.
- Las prioridades se reorganizan desde el asa de arrastre, con ratón o tacto, o mediante teclado y el menú de tres puntos. Guardar sigue usando únicamente el endpoint existente de prioridades: organizar no selecciona cursos ni consume desbloqueos.
- El panel avisa antes de descartar un borrador y lo conserva si falla el guardado. Atrás/Adelante y «Volver a Mis cursos» usan el historial existente; al volver se recuperan búsqueda, filtros y desplazamiento cuando están disponibles para la misma sesión.
- Buscador de 46 px, categoría y nivel compactos, valores de 13 px, Ordenar ligero y todas las pestañas en una fila desplazable. Sin cambios al diseño de las tarjetas principales ni a los criterios de filtrado y ordenamiento.
- Recursos nuevos del organizador y actualización del caché a `icadem-vip-v153`. Pruebas locales con APIs simuladas y Chrome: anchos 320, 360, 375, 390, 414, 768, 1024 y 1440 px; el tacto se verifica mediante emulación, no en dispositivos físicos.
- Reversión: revertir el commit de esta mejora y publicar el sitio; subir de nuevo la versión del Service Worker para que los clientes reciban los recursos restaurados. Las prioridades guardadas permanecen en el backend existente.

## 2026-11-12 — Admin · Clases en vivo: carga fiable tras recargar la página

**Archivos:** `vip-admin.html`

- Corrige que, al recargar la página directamente en Clases en vivo, las clases de prueba, las grabaciones automáticas y los videos de las clases salieran vacíos («Aún no hay clases de prueba», «Sin grabación»): la sección se dibujaba antes de que Firebase reconociera la sesión y las consultas fallaban en silencio. Ahora se espera a la sesión (`adminready`).
- Si una carga falla, la tarjeta muestra el motivo con un botón «Reintentar» en lugar de «no hay nada», y la lista ya no dice «Sin grabación» cuando no pudo leer los datos privados.
- Editar una clase real solo abre el formulario si se pudieron leer su enlace y su grabación: con el formulario vacío, al guardar se habrían borrado por error.

## 2026-11-12 — Clases de prueba: avisos solo para el superadministrador, sesión en «Ver como usuario» y ajustes del admin

**Archivos:** `vip-admin.html`, `vip-auth.html`, `vip-panel.html`; backend `icadem-webhook`: `webinar-alerts.js`, `webinar-private.js`, `index.js`, `test/webinar-alerts-prueba.test.js` (nuevo)

- Avisos de clases de prueba: al programarla, 1 hora antes y al empezar, con el prefijo «Prueba ·». Llegan únicamente a la cuenta de superadministración (campanita dirigida con `destinatarioUid` y push solo a sus dispositivos). Los miembros y los demás administradores no los reciben. Las clases reales siguen avisando a todos. La cuenta se resuelve por correo (`SUPERADMIN_EMAIL`, por defecto teccapitalweb@gmail.com); sin ella no se avisa a nadie. Al eliminar una prueba se borran sus avisos.
- «Ver como usuario» se abre en la misma pestaña (antes, otra pestaña con Firebase abierto en dos páginas a la vez), con el botón «Volver al administrador» en el panel (`?desde=admin`).
- Inicio de sesión: si hubo que iniciar sesión viniendo de «Ver como usuario», un administrador vuelve al panel que estaba viendo (destino de un solo uso en sessionStorage, validado) en lugar de caer siempre en el administrador.
- Admin · Clases en vivo: pestañas Todos, Próximos y Pasados (Todos por defecto); tarjeta «Con grabación»; al terminar la grabación automática la tarjeta pasa a «Clase ya disponible» (portada, Editar y Eliminar) y la tabla de pruebas y los conteos se actualizan solos.

## 2026-11-12 — Clases en vivo: grabación automática de Drive a Bunny y pruebas con Meet

**Archivos:** `vip-admin.html`; backend `icadem-webhook`: `clases-auto.js` (nuevo), `webinar-private.js`, `bunny-webinars.js`, `google-meet.js`, `index.js`, `test/clases-auto.test.js` (nuevo)

- Las clases de prueba también pueden crear su reunión de Google Meet automáticamente. Siguen siendo solo para administradores: no se publican, no avisan a nadie y su video solo se ve en «Ver como usuario».
- Grabación automática: al crear una clase (de prueba o real) con Meet automático se registra en `clasesAuto`. Después de la hora, el servidor busca cada 3 minutos el MP4 en el Drive de la cuenta conectada (por el título del evento o el código del enlace), lo sube en flujo a la colección de Bunny «clases en vivo» y, cuando Bunny termina de procesarlo, lo enlaza con la clase. Un video puesto a mano nunca se reemplaza.
- Admin · Clases en vivo: tarjeta «Grabaciones automáticas» con los pasos (programada, encontrada, pasando a Bunny, procesando, lista), avisos de fallos temporales, errores con motivo y botón Reintentar; se actualiza sola cada 20 segundos.
- Al eliminar una clase real también se borran sus avisos de la campanita y su registro de grabación; al eliminar una de prueba, su evento de Calendar.
- Con Gmail la grabación no empieza sola: la cuenta conectada debe pulsar «Grabar» en Meet y «Finalizar para todos» al terminar.

## 2026-11-11 — Admin: apartado «Ver como usuario» solo para el superadministrador

**Archivos:** `vip-admin.html`

- Nuevo apartado «Ver como usuario» en el menú (sección Cuenta), visible únicamente con la sesión `teccapitalweb@gmail.com`. Abre el panel de miembros en otra pestaña con la misma sesión: «Todo desbloqueado» (`vip-panel.html`, el administrador ya tiene todo abierto) o «Como un miembro normal» (`?como=user`, con los días desde el alta opcionales para probar el goteo de cursos).
- Para las demás cuentas de administración el elemento del menú no se muestra, y abrir `#vercomo` a mano las devuelve al inicio con un aviso.
- Límite conocido: oculta el apartado del menú; no cambia el acceso al panel de miembros, que cualquier administrador sigue pudiendo abrir escribiendo `vip-panel.html`.

## 2026-11-11 — Nueva cuenta de administración: grupeliptica@gmail.com

**Archivos:** `vip-admin.html`, `vip-panel.html`, `vip-auth.html`, `firestore.courses.rules.fragment`; backend `icadem-webhook`: `index.js`

- `grupeliptica@gmail.com` (la cuenta que graba las clases en Meet) se agrega a la lista de administradores en el servidor, el panel de administración, el panel de miembros, el acceso y el fragmento de reglas de cursos.
- Pendiente fuera del código: agregar el mismo correo a la función `isAdmin()` de las reglas de Firestore publicadas en la consola de Firebase.

## 2026-11-11 — Clases en vivo: clases de prueba solo para administradores

**Archivos:** `vip-admin.html`, `vip-panel.html`; backend `icadem-webhook`: `webinar-private.js`, `mobile-webinars.js`, `index.js`, `test/webinar-private.test.js`

- Admin · Clases en vivo: botón "Agregar clase de prueba" y tarjeta "Clases de prueba" (título, fecha, hora, duración, enlace, editar y eliminar). El enlace es opcional y no hay casilla de Google Meet.
- Las clases de prueba viven en `clasesPrueba/{id}` (colección cerrada, solo el servidor): no se publican en `webinars`, no generan notificación ni aviso al teléfono y ningún miembro las ve.
- Panel de miembros: con una cuenta de administrador, la agenda incluye las clases de prueba como una clase normal (cuenta regresiva, entrada, inscripción, grabación) con la etiqueta "Prueba". Para un miembro, entrar, inscribirse o reproducir una clase de prueba responde "no disponible".
- Servidor: `GET|POST /admin/clases-prueba`, `DELETE /admin/clases-prueba/:id`; el módulo de agenda recibe la dependencia opcional `testData` y sin ella se comporta igual que antes.

## 2026-11-11 — Clases en vivo: reunión de Google Meet automática

**Archivos:** `vip-admin.html`; backend `icadem-webhook`: `google-meet.js` (nuevo), `webinar-private.js`, `index.js`, `test/google-meet.test.js` (nuevo), `test/webinar-private.test.js`

- Admin · Clases en vivo: casilla "Crear la reunión de Google Meet automáticamente". Con ella marcada y sin enlace, el servidor crea el evento en Google Calendar (sin invitados) y guarda el enlace de Meet en los datos privados de la clase. Si se pega un enlace a mano, se usa ese.
- Si Google falla, la clase no se guarda a medias y el admin ve el motivo. Si Google no está conectado en el servidor, la casilla queda desactivada y se pega el enlace a mano.
- Editar una clase con Meet automático mantiene el evento de Calendar al día (título, fecha, duración); eliminarla borra también el evento.
- Variables de Railway: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (se obtiene una vez con `scripts/google-token.js`).
- Meet con una cuenta Gmail personal no graba solo: quien organiza pulsa «Grabar». El título del evento es el de la clase.

## 2026-11-11 — Clases en vivo: enlace y grabación en datos privados

**Archivos:** `vip-admin.html`; backend `icadem-webhook`: `webinar-private.js` (nuevo), `index.js`, `mobile-webinars.js`, `test/webinar-private.test.js` (nuevo)

- El enlace de la reunión y el ID de la grabación se guardan en `webinarsPrivados/{id}`, una colección que las reglas de Firestore dejan cerrada (solo la lee el servidor). Antes estaban en `webinars`, que es de lectura pública.
- Admin · Clases en vivo: crear, editar y eliminar pasan por el servidor (`POST /admin/webinars/guardar`, `DELETE /admin/webinars/:id`). La lista y el editor leen el enlace y la grabación de `GET /admin/webinars-privados`.
- Botón "Proteger enlaces de clases anteriores" (aparece solo si quedan clases con el enlace en el documento público): mueve esos datos a la colección privada (`POST /admin/webinars/migrar-privados`).
- Compatibilidad: mientras una clase conserve el enlace o la grabación en el documento público, el servidor los sigue leyendo de ahí; lo privado manda.
- Orden de publicación: primero el servidor y después el sitio (el admin nuevo llama a rutas que el servidor anterior no tiene). No requiere cambiar las reglas de Firestore.

## 2026-11-10 — Ciudad ICADEM · prototipo jugable (Fase 1)

**Archivos:** `ciudad/` (nuevo módulo del juego), `js/icadem-ciudad.js`, `css/icadem-ciudad.css`, `assets/ciudad/portada.webp`, `vip-panel.html`, `sw.js`, `test/ciudad-icadem.test.cjs`, `scripts/ciudad-e2e.cjs`, `CIUDAD_ICADEM.md`

- Panel VIP: nueva pestaña **Ciudad ICADEM** (menú lateral y menú "Más" en celular). Abre el juego a pantalla completa y se cierra con "Salir" o al cambiar de sección.
- Juego 3D aislado en `ciudad/` (Three.js incluido en el repo, sin compilación): habitación inicial, avatar Explorador en tercera persona, plaza con 11 edificios, colisiones, interior del Banco ICADEM y la misión 1 «El crédito correcto» completa.
- Interfaz del juego: misión activa, mapa con destinos, pasaporte, tablero de misiones, armario, ajustes de calidad y tutorial inicial. Controles de teclado/mouse y táctiles.
- **Créditos de prueba:** el prototipo no llama al backend ni modifica la cartera real. La integración con créditos ICADEM queda documentada para la Fase 3.
- Multijugador: quedó la capa de red preparada, sin conexión y sin jugadores simulados.
- `sw.js`: versión de caché v143.
- Detalle de arquitectura, estado por función y pendientes en `CIUDAD_ICADEM.md`.

## 2026-11-06 — Grabaciones de clases en vivo y avisos automáticos

**Archivos:** `vip-admin.html`, `vip-panel.html`, `sw.js`; backend `icadem-webhook`: `index.js`, `webinar-alerts.js` (nuevo), `test/webinar-alerts.test.js` (nuevo)

- Admin · Clases en vivo: campo "Grabación (Bunny Stream)" (acepta el ID o el enlace del video) y etiqueta "Grabación disponible" / "Sin grabación" en las clases pasadas.
- Panel VIP · Clases en vivo: las clases terminadas muestran "Grabación" o "Grabación en proceso"; "Reproducir" abre el video dentro del panel con token firmado (solo miembros con membresía activa).
- Avisos de clases en vivo: al programar la clase (también al teléfono), 1 hora antes y cuando empieza. Cada aviso se manda una sola vez por clase.
- Admin · editar clase: botón "Sincronizar con Bunny" que lista los videos de la colección `clases en vivo` de la biblioteca para elegir la grabación sin copiar el ID. Necesita la variable `BUNNY_LIBRARY_API_KEY` (API Key de la biblioteca de Bunny, distinta de la clave de tokens) en el servidor; backend `bunny-webinars.js` + `GET /admin/bunny/webinar-videos`.
- Backend: `POST /api/bunny/webinar-embed-token`, `POST /admin/webinars/:id/avisar-registro` y revisión cada minuto de clases por empezar. Hay que publicar el backend junto con el sitio.
- `sw.js`: caché v94 y versión de `icadem-platform-v2.js` alineada con el panel (v47); el verificador de contratos vuelve a pasar.

## 2026-10-16 — Pregunta de avisos e interruptor en Mi perfil

**Archivos:** `vip-panel.html`, `sw.js`, `js/icadem-push.js`

- Cada cuenta (existente o nueva) ve una vez la ventana "¿Quieres recibir avisos de ICADEM?" que solo se cierra con "Sí, activar" o "No, gracias".
- Mi perfil → Notificaciones: interruptor "Avisos en este teléfono" para activarlos o quitarlos cuando quiera.

## 2026-10-16 — Notificaciones push en el teléfono

**Archivos:** `vip-panel.html`, `vip-admin.html`, `sw.js`, `js/icadem-push.js` (nuevo), `js/icadem-admin-marketing.js`

- El panel ofrece "Activar avisos". Quien acepta recibe en la bandeja del teléfono (o de la computadora) los mensajes de la campaña de correos VIP y los créditos de regalo, aunque no tenga el panel abierto.
- En iPhone se pide primero agregar ICADEM a la pantalla de inicio (requisito de Apple).
- Admin · Correos: botón "Probar notificación en mi teléfono".

## 2026-10-16 — Lector en el panel y créditos de regalo

**Archivos:** `vip-panel.html`, `vip-admin.html`, `sw.js`, `js/icadem-platform-v2.js`, `js/icadem-resource-viewer.js` (nuevo)

- Libros y Materiales canjeados se abren dentro del panel: PDF con lector propio (zoom, pantalla completa y última página leída) y Word/Excel/PowerPoint con el visor de Office. El archivo llega por un enlace temporal firmado.
- Admin · Miembros → Acciones → "Dar créditos": regalo o venta con mensaje opcional; al miembro le aparece el cofre con el monto la próxima vez que abre su panel.

## 2026-10-16 — Marketing al estilo Alintec (como SYNOVA e IMFRA)

**Archivos:** `index.html`, `vip-admin.html`, `vip-auth.html`, `vip-panel.html`, `privacidad.html`, `verificar.html`, `sw.js`, `assistant/icadem-assistant.js`, `js/icadem-admin-metrics.js`, `js/icadem-visitas.js` (nuevo), `js/icadem-encuesta.js` (nuevo), `js/icadem-admin-marketing-v2.js` (nuevo), `css/icadem-encuesta.css` (nuevo), `assets/img/encuesta/*` (nuevo)

- Contador anónimo de visitas (sin cookies ni IP) en landing, acceso y panel: origen de cada visita y de cada cuenta nueva.
- Encuesta del landing debajo de la franja de valor, con la guía de ICADEM y cursos reales del catálogo; guarda respuestas parciales y completas.
- La ruta de la guía virtual guarda cada intento (descartada, parcial o completada), el curso recomendado y el que abrieron. Ya no se abre sola si la encuesta del landing está en la página.
- Admin · Marketing: Encuestas con tres pestañas (landing, ruta de la guía y prospectos de la guía), Métricas de visitas, Pruebas gratuitas y Correos. El tablero anterior de Métricas ahora es "Actividad del panel".
- Miembros VIP: fecha y hora de registro y activación, último acceso, cómo se registró, por dónde llegó, curso gratuito, filtro por fecha de registro, conteo y descarga CSV.

## 2026-10-09 — Retos y logros con dirección visual IMFRA/SYNOVA

**Archivos:** `vip-panel.html`, `css/panel-minimal.css`

- Retos adopta una portada fotográfica de alto contraste, progreso integrado y tres experiencias visuales con la paleta sobria de ICADEM.
- Las funciones de casos, flashcards y quiz permanecen intactas; se redujo el texto y se priorizaron acciones, avance y misión semanal.
- Mis logros ahora usa el patrón de tablero de retos: resumen de nivel, métricas verificables y tarjetas agrupadas con progreso individual.
- Se retiró “PDFs y material” de escritorio, móvil, portada y rutas; los enlaces antiguos redirigen de forma segura al inicio.
- Se verificaron Retos y Mis logros en laptop, tableta y móvil, sin desbordamiento horizontal ni errores de consola.

## 2026-10-09 — Ajuste responsive de módulos académicos

**Archivos:** `vip-panel.html`, `css/panel-minimal.css`

- Herramientas se redujo a un encabezado directo y cuatro recursos de lectura rápida, sin estados o textos redundantes.
- Certificados y Logros ahora agrupan sus métricas en bandas compactas; la ruta de niveles vive dentro del mismo panel de avance.
- Las medallas de Logros se convirtieron en filas breves que aprovechan todo el ancho y eliminan grandes espacios vacíos.
- PDFs usa un estado próximo horizontal y breve; Retos conserva su estructura pero cambia grandes franjas de color por acentos discretos.
- El widget de Comunidad se simplificó a miembros y una sola acción con color institucional.
- Se validaron Herramientas, Certificados, Logros, PDFs y Retos a 1366 px, 820 px y 390 px sin desbordamiento horizontal ni errores de consola.

## 2026-10-09 — Refinamiento sobrio del panel ICADEM

**Archivos:** `index.html`, `vip-auth.html`, `vip-panel.html`, `css/styles.css`, `css/auth-minimal.css`, `css/panel-minimal.css`

- Se sustituyó el azul brillante por azul marino, grises cálidos y un acento latón discreto en sitio, acceso y panel.
- Se compactó la bienvenida del panel y se eliminó el módulo redundante de accesos rápidos.
- Retos dejó la portada beige y la tipografía serif; ahora usa un resumen breve de progreso con la tipografía del sistema.
- Herramientas y Biblioteca cambiaron los degradados por encabezados claros, cortos y consistentes.
- Logros redujo espacios, altura de tarjetas y texto para priorizar avance, nivel y reconocimientos.
- Se verificaron portada, acceso, panel, Retos, Herramientas, Biblioteca y Logros sin errores de consola ni desbordamiento horizontal.

## 2026-10-09 — Rediseño visual minimalista de ICADEM

**Archivos:** `index.html`, `css/styles.css`, `vip-auth.html`, `vip-panel.html`, `css/auth-minimal.css`, `css/panel-minimal.css`

- Se simplificó la página pública con una jerarquía más corta, fondo claro, mayor espacio en blanco y una paleta azul institucional.
- Se mantuvieron la tipografía, los cursos, filtros, acceso VIP, galería, formulario por WhatsApp y enlaces de contacto.
- Se eliminaron de la portada los efectos 3D, brillos y bloques redundantes para mejorar lectura y rendimiento.
- El acceso y el panel VIP recibieron una capa visual más sobria, con modo claro predeterminado y modo oscuro conservado.
- Se corrigió el ancho del panel VIP en pantallas móviles sin tocar su lógica de autenticación, contenido o herramientas.

## 2026-07-20 — Fix: "Recibo de nómina" y "Multi-empleado" rotos (ReferenceError) + causa raíz de `__ensureCfGenerators`

**Archivo:** `vip-panel.html` (commiteado en `5994166` y pusheado a `main`)

### 1. `aplicarTablaISR`/`aplicarSubsidio`/`TABLA_ISR_MENSUAL_2026` no eran accesibles entre scripts

**Problema:** están declaradas dentro de `window.__initCalcFiscal` (un `<script>`), y
`window.__initCalcNomina` (otro `<script>` separado) las usaba asumiendo que eran
globales. No lo son: una `const`/`function` local a una función no se filtra a otro
script. Esto rompía por completo las pestañas "Recibo de nómina" y "Multi-empleado"
de la Calculadora de Nómina (`Uncaught ReferenceError: aplicarTablaISR is not
defined`) para todos los usuarios, incluidos VIP.

**Fix:**
- Se exponen `aplicarTablaISR`, `aplicarSubsidio` y `TABLA_ISR_MENSUAL_2026` como
  `window.*` al final de `__initCalcFiscal` (mismo patrón ya usado ahí para
  `window._cfGenerarPDF`/`window._cfGenerarXLS`). Fuente única, sin duplicar la
  tabla ni las funciones dentro de `__initCalcNomina`.
- `calcRecibo()` y `calcMulti()` ahora leen `window.aplicarTablaISR` /
  `window.TABLA_ISR_MENSUAL_2026` / `window.aplicarSubsidio`.
- Se agregó `try/catch` alrededor de la llamada `fn()` en el wiring de los botones
  de la Calculadora de Nómina (`bindings.forEach`), con `Toast.error(...)` si algo
  truena. Red de seguridad adicional — no reemplaza el fix de causa raíz.

### 2. `window.__ensureCfGenerators` era código muerto (nunca se ejecutaba)

**Problema descubierto durante la verificación en vivo del fix anterior:** para
que el escenario "usuario entra directo a Nómina/Crédito sin pasar por Fiscal"
funcionara, el fix de arriba dependía de `window.__ensureCfGenerators()` — una
función preexistente que monta la Calculadora Fiscal en un contenedor invisible
para poblar sus exports. Esa función estaba declarada **después** del `return`
del IIFE `const Sections = (function(){ ... })();` que la contiene, por lo que
nunca se asignaba a `window` (código muerto, sin lanzar error, solo un no-op
silencioso). Esto afectaba, de forma completamente independiente al fix #1, a
los 6 sitios preexistentes que ya dependían de ella: `cfDownloadPDF_externo`,
`cfDownloadXLS_externo`, `ptDownloadPDF`, `ptDownloadXLS`, `ptHistDownloadPDF`,
`ptHistDownloadXLS` — es decir, la descarga de PDF/Excel de la Calculadora de
Crédito también estaba rota en el mismo escenario de entrada directa.

**Fix:** se reubicó la declaración completa de `window.__ensureCfGenerators`
de después del `return {...}` a antes, dentro del mismo IIFE. Sin cambios de
lógica, solo de posición — deja de ser código muerto.

**Verificado en vivo (Chrome, servidor local, sesión nueva cada vez, sin pasar
por Calculadora Fiscal):**
- Recibo de nómina (salario diario 500, 30 días): recibo completo, ISR
  $1,552.78, Neto $13,051.17, consola limpia.
- Multi-empleado (mismo caso, 1 fila): tabla completa, mismos valores,
  consola limpia.
- Calculadora de Crédito → Comparador → "Descargar Excel": sin errores,
  `window._cfGenerarXLS` queda poblado vía `__ensureCfGenerators`.

### Hallazgo relacionado — NO corregido en este cambio

**`doc.autoTable is not a function`** al usar "Descargar PDF" en Fiscal, Nómina
o Crédito (`generarPDF`, `generarReciboPDF`, `generarAmortizacionPDF`). El
archivo carga `jspdf.umd.min.js` pero **nunca carga el plugin
`jspdf-autotable`** — no hay ningún `<script>` para él en todo el HTML. Es un
bug preexistente e independiente de los dos fixes de arriba (afecta también el
flujo normal, vía Fiscal, no solo la entrada directa). Se reporta para
atenderlo aparte; no se tocó en este cambio.

**No tocado (a propósito):** `calcPatronal()`, `calcSDI()` (no dependían del
bug), `UMA_2026`/`SMG_2026` (duplicación ya conocida, fix aparte), herramientas
de laboratorio (código muerto, fuera de alcance), sistema de notificaciones
(pausado, se retoma en su propio commit).
