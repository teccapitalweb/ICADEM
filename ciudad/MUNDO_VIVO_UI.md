# Mundo Vivo · entregas visuales sobre Ciudad 1.3

Base: `main` f43f608 (PR #71), con Avatar Studio y equipamiento del PR #70. Este cambio se desarrolla en `feature/ciudad-mundo-vivo-premium-ui` y un worktree propio. No modifica la rama de Claude.

## UI-1 · chat móvil y accesos rápidos

`js/ui/chat.js` conserva el protocolo actual. El texto permanece en el editor hasta recibir `chat/send` confirmado por su `n`; sólo entonces se añade al historial propio, se limpia el borrador correspondiente y puede cerrarse el panel. Un borrador nuevo no se borra por la confirmación anterior. En móvil, «Cerrar al enviar» actúa después de la confirmación y no cierra una apertura posterior. Error, desconexión y falta de confirmación se muestran sin reintentos automáticos: el protocolo actual no ofrece idempotencia de mensajes. No se cambian autenticación, activación del chat, edad, moderación ni bloqueos.

Hay cierre explícito, Escape y toque fuera sin un fondo que capture el joystick/cámara. El historial se mantiene en memoria al reabrir. El teclado pierde foco al enviar; la altura de `visualViewport` limita la hoja cuando un teclado reduce la pantalla. La emulación comprueba cambios de viewport y foco, no reproduce un teclado físico de iOS o Android.

`js/ui/quick-menu.js` reorganiza los botones existentes conservando sus IDs y listeners. Un disparador compacto despliega Mi avatar, Vestidor, Mi casa, Mapa, Juegos, Frases y gestos, Pasaporte, Ajustes y Salir al panel cuando corresponde. Mi casa **marca la entrada existente en la plaza**; no teletransporta ni abre un editor inexistente. El acceso original a frases sigue funcionando por teclado y se reutiliza el mismo sistema social. No aparecen inventario, mascotas o monturas sin su sistema real. El menú permite flechas, Home/End, Enter, Escape y cierre exterior. En horizontal deja libre el área de correr/saltar.

## UI-2 · probar, filtrar y equipar

`js/ui/wardrobe.js` amplía el Studio existente. `openWardrobe(ui,{tab:'ropa'})` permite una entrada directa al vestidor; la opción por defecto sigue siendo Personajes. El borrador pertenece al modal: probar personajes o varias piezas sólo cambia la vista previa. «Equipar selección» invoca `api.setAvatar` existente y distingue confirmación pendiente, éxito, rechazo y falta de confirmación. Descartar/cerrar elimina la prueba local, sin eliminar artículos de la cuenta.

Los filtros Tipo, Color y Estado se construyen con los datos del catálogo actual. No se inventan precios, bloqueos, atributos Nuevo ni categorías sin piezas. Las prendas preceden a las opciones de restablecer/quitar para que el catálogo muestre contenido real desde la primera fila. Personajes conserva sus requisitos reales. Se mantiene el arreglo de Claude que evita sobrescribir una elección remota si el perfil llega tarde durante la bienvenida.

Las miniaturas y el escenario comparten el renderizador existente. Se mantienen su cancelación, límite de caché y liberación de geometrías. No se modifican modelos, rig, materiales, animaciones o código del motor.

## UI-6 · paneles educativos existentes

`css/learning-premium.css` mejora los paneles de NPC y los nueve juegos actuales, con respuestas táctiles, personaje identificado por su inicial, colores contenidos, feedback y tarjetas compactas. La capa visual no recibe ni muestra una solución antes de la respuesta del sistema educativo. Preguntas, calificaciones, recompensas, viajes, Distrito del Saber y controladores no cambian. Las diez mecánicas nuevas del encargo 2.0 permanecen bajo responsabilidad de Claude.

## Puntos de integración compartidos

- `UI.modal` acepta opcionalmente acciones **síncronas** `onClick`, `close:false` y `disabled`, y expone `data-action`. Sin esas opciones conserva su cierre y validación anteriores. La confirmación de red continúa perteneciendo al sistema actual, no al botón del modal.
- `ui.js` instala el menú y añade sólo una inicial de presentación al nombre de NPC. Los botones del modal conservan su activación nativa de teclado sin enviar Enter/Espacio al mundo; no se modifica `Input`.
- Hojas nuevas separadas: `quick-menu.css`, `chat-mobile-premium.css`, `avatar-catalog-premium.css` y `learning-premium.css`. No se reemplaza la hoja global del juego.
- Core, red, geometrías, mundo, misiones, reglas, banco de preguntas, recompensas, servidor, Firebase, economía y Railway quedan fuera del diff de esta entrega.

## Pruebas reproducibles

- `node --test test/ciudad-chat-ui.test.cjs test/ciudad-studio-catalog.test.cjs test/ciudad-preview-ui.test.cjs` ejecuta los módulos reales con transporte DOM y verifica borradores, confirmación, bloqueos, selección inicial tardía y recursos.
- `node scripts/ciudad-chat-ui-e2e.cjs RUTA_A_PLAYWRIGHT CAPTURAS` usa panel DOM real y servidor WebSocket local con almacenamiento temporal, incluyendo receptor independiente, rechazo y confirmación demorada. Sin cuentas de producción.
- `node scripts/ciudad-studio-premium-e2e.cjs RUTA_A_PLAYWRIGHT CAPTURAS` usa juego, modelos y servidor WebSocket locales reales. La fixture reduce DPR, pausa el render del mundo y sustituye el giro continuo del Studio por fotogramas estáticos de los modelos reales para reducir el coste de SwiftShader. No prueba una animación a 60 FPS. Comprueba que probar no envía escrituras, Equipar confirma, y otra sesión recupera el aspecto.
- `node scripts/ciudad-mundo-vivo-shell-e2e.cjs RUTA_A_PLAYWRIGHT CAPTURAS` comprueba la clase UI, menú, foco, teclado, acciones que permanecen abiertas y presentación de preguntas en una fixture sin mundo ni GPU. Los resultados educativos son simulados y no conceden XP.
- `ICADEM_TEST_ENGINE=webkit` selecciona WebKit. `ICADEM_SHELL_SIZES`, `ICADEM_STUDIO_SIZES` y las opciones descritas en cada script permiten elegir tamaños.

Los tamaños de móvil/tablet son emulados. Estas comprobaciones no equivalen a dispositivos físicos, persistencia real en Firestore ni a pruebas de mascotas, compras o viviendas todavía inexistentes. La presentación aislada de estas áreas y sus dependencias está en el [PR #72](https://github.com/teccapitalweb/ICADEM/pull/72), como borrador de revisión; no está conectada al menú ni al juego público.

### Resultados de esta entrega

- Suite del repositorio: **575/575 pruebas aprobadas, sin omisiones** (`node --test --test-concurrency=2 test/*.test.cjs`; en PowerShell, enumerar los archivos para expandir el patrón).
- Menú, teclado real de `Input` y paneles educativos: Chromium en 1440×1000, 768×1024, 390×844, 320×740 y 740×390; WebKit en 390×844, 768×1024 y 740×390. Sin desbordamiento ni solapamiento con correr/saltar. La comprobación del nombre del waypoint se repitió en ambos motores.
- Chat DOM + servidor WebSocket local real: Chromium en 1440, 768, 390, 320 px y horizontal; WebKit en móvil, tablet y horizontal. Emisor y receptor independientes, confirmación demorada, rechazo, borrador y reapertura. Adicionalmente, **18 casos de altura/offset de teclado por motor** (alturas 260/280/300 px, desplazamientos 0/60/130, variables CSS y evento de viewport); controles completos y botones Enviar/X de 44 px. Auditoría independiente: 21 casos DOM en WebKit, incluidos los tamaños extremos.
- Studio con juego, modelos y WebSocket locales: Chromium en 1440×1000, 768×1024, 390×844 y 320×740; WebKit en 390×844. Prueba de diez campos cosméticos sin escrituras al previsualizar, aplicación confirmada, observador independiente, confirmaciones intercaladas, reinicio/nueva sesión y perfil inicial tardío. XP, créditos y misiones conservados. La fixture usa fotogramas estáticos, como se explica arriba.
- HUD integrado en ambos motores a 390×844 y 844×390: accesos Mi avatar/Vestidor/Mi casa/gestos reales; activación y envío de chat por UI, recepción en otro socket, borrador, cierre exterior/X e historial. Rectángulos del chat comprobados contra correr/saltar, Amigos y Accesos, sin solapamiento. No se utilizan cuentas reales ni se cambia la activación del chat en producción.
- Kit visual del PR #72: 10 pruebas DOM; 28 composiciones en Chromium (1440/768/390 px) y WebKit (390 px), más inventario poseído. Son datos de muestra identificados, sin llamadas de red ni escrituras; no son contratos aprobados por Claude.

Los scripts de regresión anteriores se adaptaron al botón explícito «Equipar selección»; no se afirma que todas sus variantes históricas se hayan ejecutado de nuevo. La cobertura ejecutada es la indicada aquí y en los scripts nuevos.

## Integración con Claude

Revisar `main` de nuevo antes de integrar. Conservar sus controladores, viajes 1.3 y selección inicial tardía. Los cambios funcionales de esta entrega se limitan al flujo de UI; los archivos de modelos y mecánica no deben sustituirse. Al incorporar los catálogos 2.0, suministrar primero datos/capacidades reales, mantener acciones ausentes si no están disponibles y conservar la validación del backend. La ampliación visual no crea un nuevo sistema de propiedad, colocación, compras o relaciones.
