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

### Revisión de calidad y compatibilidad posterior

La revisión remota de `main` sigue siendo **f43f608**. Esta entrega es independiente sobre Ciudad 1.3: no necesita migrar perfiles ni desplegar otro contrato del servidor. Se conserva la selección inicial tardía y la cola autoritativa de apariencia. El PR #73 se mantiene preparado para integración; las vistas del PR #72 permanecen aisladas.

Se corrigieron fallos concretos de foco del modal/menú, texto secundario demasiado tenue, foco perdido al reconstruir filtros del Studio y la confirmación antigua que podía borrar un borrador de chat nuevo con idénticas palabras. El modal contiene Tab/Shift+Tab y devuelve el foco a un control visible; los mensajes de validación se anuncian como estado. Los botones del menú conservan al menos 44 px y sus etiquetas se hacen más legibles, sin ampliar la navegación ni cambiar mecánicas.

Resultados de la pasada de calidad:

- **580/580 pruebas del repositorio aprobadas, sin omisiones.** La ejecución completa requiere acceso a sus servidores en `127.0.0.1`; una primera ejecución restringida falló por `EACCES` del sandbox y se repitió con ese permiso local.
- Chat: **14/14 pruebas específicas**, conservación de la revisión de edición incluso al reponer el mismo texto, estado inactivo legible, foco de apertura/cierre y contador accesible de mensajes nuevos. Chromium 1440/390/320 y WebKit 390/320 con DOM/Input/WebSocket locales reales. Los 18 casos de teclado reducido por motor siguen aprobados. Contraste CSS calculado sobre fondo blanco: mínimo 4,81:1.
- Studio: **11/11 pruebas específicas** (20/20 con preview y contratos de apariencia). Chromium y WebKit 320/390 con servidor local real; segunda sesión, reinicio, ACK intercalados y perfil tardío. Foco/caret y scroll se conservan al recibir el perfil; los filtros se hacen visibles sólo al abrirlos. Regresión final de «Limpiar filtros» repetida en ambos motores. Controles de al menos 44 px, contraste medido de 4,66–5,02:1 y ningún desbordamiento horizontal.
- La auditoría independiente encontró el recorrido inverso de Tab del menú; queda cubierto en la prueba real del shell. El cierre con Tab no depende de que el navegador proporcione `relatedTarget`, por lo que también funciona al pasar el foco a la barra del navegador.
- Shell final con teclado/foco/contraste y objetivos táctiles: Chromium 1440×1000, 768×1024, 320×740, 390×844 y 740×390; WebKit 768×1024, 320×740, 390×844 y 740×390. Los nueve casos terminaron sin errores ni solapamiento con correr/saltar. Se comprobó también apertura programática de modal y acción primaria deshabilitada.

Son pruebas locales y tamaños emulados, no dispositivos físicos, lectores de pantalla manuales, pruebas contra Railway/Firestore o medición de FPS. Los resultados de la suite anterior de 575 se conservan como historial; no sustituyen estos resultados posteriores.

**Hay contratos nuevos, todavía en una rama de desarrollo:** se consultó en modo de lectura `feature/ciudad-mundo-vivo`, commit **ca84ff6**, y su `ciudad/MUNDO_VIVO.md`. Esto actualiza la situación de la entrega inicial: `api.vivo`, `api.actions`, `PetPreview` y `api.homeEditor` ya están descritos e implementados en esa rama; no forman parte de `main` f43f608 ni han sido integrados/probados con este PR. La matriz exacta y las pruebas de conexión están en el PR #72. Los diez juegos nuevos siguen necesitando sus contratos propios.

Antes de integrar la expansión, hay que reconciliar expresamente estos puntos:

1. El menú de esta entrega reorganiza y reemplaza los hijos de `#more-menu`. La rama 2.0 incorpora `#btn-pets` y `#btn-inventory`, cuyos listeners instala `installVivoActions(api)` **después** de construir `UI`. No mezclar las ramas sin conservar esas entradas y acordar el montaje posterior a las capacidades reales; no duplicar listeners ni navegación.
2. La semántica 2.0 pasa por `api.actions`: Mi avatar abre Pasaporte/avatar y Mi casa llama a `api.goHome()`. En 1.3 Mi avatar abre Personajes y Mi casa sólo marca la puerta existente. Elegir las acciones canónicas de la expansión al conectarla, sin ejecutar ambas rutas.
3. El catálogo 2.0 añade 31 prendas, tres ranuras y artículos de pago. Deben usarse `api.vivo.wearInfo(slot, option)`, `locked(custom)` e inventario confirmado para mostrar propiedad/precio/candado. La etiqueta Gratuito del catálogo actual **no** es una garantía para futuras prendas. No habilitar el catálogo 2.0 en este Studio sin esta adaptación y pruebas de rechazo/compra/equipamiento.
4. Conservar el historial y las etiquetas de monedas autoritativas que Claude añadió a `ui.js`, sus destinos nuevos de `city-map.js` y sus controladores. Los cambios de foco/modal son complementarios, no un reemplazo de esos archivos completos.
5. Resolver las versiones de `index.html`, puente y caché una sola vez sobre el `main` que exista al integrar. Las pruebas de mapa deben contemplar los destinos canónicos nuevos, y las de vestidor el botón Equipar explícito.

No se hizo checkout, merge, escritura ni ejecución con datos reales sobre la rama de Claude. Consultar un contrato en desarrollo no equivale a dar la expansión por validada ni autoriza publicar las siete vistas de muestra.

## Última auditoría de la versión publicada 1.3

Base auditada: `main` **b97c80d**, publicada por el PR #73 con entrada v15 y caché v182. Las correcciones se preparan en `fix/ciudad-ui-final-qa`, worktree independiente. No se publican en esta fase. Las versiones v16/v183 y la hoja educativa v2 quedan listas para una futura integración revisada.

| Defecto reproducido | Corrección mínima | Evidencia |
| --- | --- | --- |
| Recibir un mensaje reiniciaba la lectura y eliminaba el control con foco. | Conservar las filas y su ancla; seguir abajo sólo si ya se leía al final. Un ACK actual propio muestra su mensaje; uno tardío/antiguo no interrumpe. | Chrome/WebKit DOM390; 16 pruebas de ChatPanel, incluidas cierre/reapertura, eliminación por bloqueo y límite de historial. |
| Una actualización sin cambio de apariencia reconstruía el modelo 3D del Studio y podía perder foco de Descartar. | Comparar la apariencia visible antes de `preview.show`; restaurar el control de estado o un destino visible si desaparece. No se cambia `AvatarPreview`, modelos, rig ni motor. | 13 pruebas del Studio y 2 de recursos de preview; E2E con juego y WebSocket locales reales, preview/cancelación, ACK intercalados, reinicio y perfil tardío. |
| Pasaporte tenía pestañas de 32 px, cierre de 36 px y acciones de 40–42 px, sin estado accesible seleccionado. | Objetivos de al menos 44 px y `aria-pressed`. | Juego local offline Chrome320/390/768/1440; estado académico/apariencia inalterados. |
| El cierre de Juegos era de 36 px y una regla heredada ocultaba sus distintivos Nuevo/Mejor en móvil. | Ajustar únicamente objetivos y visibilidad de los distintivos reales, con wrap seguro. | Misma matriz y capturas antes/después; ningún juego iniciado ni regla cambiada. |

El mapa pasó límites, scroll de lista, zoom, teclado y áreas táctiles en esos cuatro tamaños sin necesitar cambios. La versión 1.3 no tiene un inventario 2.0 publicado: conserva catálogo cosmético y Pasaporte; no se añadió un módulo ficticio.

### Trabajo y memoria medidos

- Referencia reproducida antes de corregir: 20 perfiles idénticos provocaban 20 llamadas a `AvatarPreview.show` (que reconstruye el modelo). Después: **0**. Un cambio real de ropa sigue actualizando la vista inmediatamente.
- Con el juego/modelos y servidor local reales: **10 lecturas confirmadas, 0 reconstrucciones**, contadores del renderizador estables en **22 geometrías y 2 texturas** antes/después. La fixture pausa mundo/giro continuo para reducir el coste del render por software; no mide FPS.
- Chat DOM390 con 20 filas: al llegar una nueva, **1 nodo añadido y 0 eliminados**; las 20 filas anteriores, scroll y foco permanecen. El historial y la tabla de filas siguen acotados por el límite existente.
- Las pruebas de recursos conservan liberación de geometrías propias, materiales compartidos y target del renderizador. No se afirma una mejora de FPS, de consumo de batería ni de memoria total del dispositivo: esas magnitudes no se midieron.

### Alcance de las comprobaciones

**585/585 pruebas del repositorio** sin omisiones. Chat con WebSocket local real en WebKit390 y 18 casos de viewport reducido; Studio Chrome390 con servidor real y receptor independiente. Pasaporte/mapa/Juegos se revisaron offline, sin sembrar progreso ni iniciar partidas. Son tamaños emulados, no teléfonos físicos ni sesiones reales de producción.

El control de la sesión autenticada se había detenido al no poder identificar con seguridad la URL. No se intentó eludirlo, recuperar tokens ni reutilizar credenciales. Para cerrar el único pendiente de envío en producción, usar la [prueba manual de siete pasos](CHAT_PRUEBA_MANUAL.md). Historial y borrador permanecen en memoria durante la sesión; no se prometen tras recargar.

PR #72 sigue aislado y en borrador. En esta revisión mantiene como fuente de desarrollo **ca84ff6**, sin cambios nuevos de contratos recibidos; su laboratorio/verificador pasa **22/22**, incluidas dos pruebas negativas nuevas de revisión de vivienda y confirmación de B. No hay adaptador real: integración y sincronización 2.0 siguen pendientes, sin ejecutar migraciones ni cuentas reales. Ver `MUNDO_VIVO_UI_CONTRACTS.md` e `INTEGRATION_QA.md` en ese PR, no importarlos desde el juego.
