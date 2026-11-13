# Mundo Vivo · contratos de interfaz y límites de integración

Revisión del 13 de noviembre de 2026, basada en `main` **f43f608** (Ciudad ICADEM 1.3, PR #71), que incluye el vestidor del PR #70. Este inventario describe código comprobado en el repositorio; las propuestas pendientes no son contratos publicados por Claude.

## Lo disponible ahora

| Área | Contrato real y origen | Integración visual segura |
| --- | --- | --- |
| Ventanas y diálogos | `UI.modal({eyebrow,title,content,actions,validate,wide,hint,onClose})`, `UI.choice({speaker,text,options})`, `UI.dialog({speaker,lines})` en `js/ui/ui.js`. El modal devuelve el ID de la acción y conserva el bloqueo de controles. | Reutilizar ventanas, foco, cierre y bloqueo. Las hojas nuevas deben tener alcance por componente. |
| Personajes y equipamiento | `api.setAvatar(id, custom)`, `applyCustom`, `cleanCustom`, `isAvatarUnlocked`; catálogo finito compartido `js/progress/appearance-catalog.js`. `UI.openWardrobe(o)` ya transmite opciones al vestidor. | Miniaturas y borrador de vista previa mediante `AvatarPreview`; confirmar con el método actual. No crear otro inventario ni conceder personajes desde filtros. |
| Mapa | `UI.openMap()`, `createCityMap(ui)`, `api.setWaypoint(...)`; edificios y lugares existentes. | Una acción del menú rápido puede abrir este mapa. No crear teletransporte ni destinos ficticios. |
| Frases y emotes | `PHRASES` en `js/social/phrases.js`, con `id`, `text`, `emote`; seis frases actuales. `net.say(phraseId)` valida la lista y el ritmo. | Acceso a la interfaz de frases/gestos existente. No inventar emotes ni ampliar el índice de animaciones de red. |
| Casa actual | Escena privada `room`, puerta de la plaza con `api.travel('room','door')`; cama, escritorio, armario y espejo fijos en `js/world/room.js`. | Mostrar el lugar existente y sus accesos. Cualquier navegación nueva debe respetar el grafo de `net/scenes.js`; no equivale al editor de vivienda 2.0. |
| Saldo actual | `profile.testCredits` se aplica a `store.state.economy.balance` en `main.js`; HUD y Pasaporte lo llaman **créditos de prueba**. `api.economy.isTest === true`. | Separar nivel/XP/saldo y conservar esa etiqueta. No presentarlo como la moneda nueva de Mundo Vivo ni como cartera financiera. |
| Historial actual | `Profiles.view()` omite `testLedger` y devuelve su cantidad `testMoves`; `TestEconomy.history()` lee el ledger local del prototipo. | El ledger local no sirve como historial autoritativo de compras 2.0. Esperar al contrato de historial del servidor antes de mostrar compras sincronizadas. |
| Juegos actuales | `GAME_LIST` en `js/edu/games.js`, `api.games.open()`, `launch(id)`, `goTo(scene)`, `result(id,r)`. `goTo` pasa por la plaza cuando el grafo lo exige. | Mejorar las portadas y el resultado de esos juegos sin cambiar reglas ni rutas. No sustituirlos por los diez nombres del encargo 2.0. |
| NPC | `NpcQuiz.ask(speaker, question)`, `pickQuestion()` y `api.edu.quiz(questionId, choice)`; respuesta `{correct,answer,explain,xp,why,server}` o `{error}`. | La UI muestra pregunta/opciones antes de responder, y solución/recompensa tras la confirmación. No alterar el banco, edad, pausas ni acercamiento de NPC. |
| Actividades con semilla | `api.edu.activity(id, seed, level, log)` devuelve `{score,xp,bonus,capped,server}` o `{error}`. `net.profile(op,{...,n})` y evento `profile` conservan correlación. | Mantener indicador pendiente, error y resultado confirmado. No calificar ni fijar XP en una capa visual. |
| Distrito 1.3 | `api.district.play(id)`, `lab(content)`, `escape(content)`, `mazeStart()`, `gate(n)`, `mazeQuit(silent)`; `MAZE`, `LANDMARKS`, `DISTRICT_ACTIVITIES` en `district-rules.js`. | Conservar laberinto, laboratorio, sala de escape y Ruta del explorador. Estos sistemas no son mascotas, tiendas ni los nuevos minijuegos de Mundo Vivo. |

Los nueve juegos del catálogo actual son Carrera del conocimiento, Memoria ICADEM, Matemáticas contra reloj, Aventura de idiomas, Búsqueda del tesoro, Clasificación inteligente, Laberinto del conocimiento, Laboratorio de experimentos y Sala de escape. Ruta del explorador es un sistema de descubrimientos adicional, no una décima ficha de `GAME_LIST`.

## Funciones 2.0 pendientes de contrato de Claude

En esta revisión no hay un catálogo o servicio de mascotas, inventario personal de artículos, tiendas/compras, conjuntos guardados, editor de viviendas, correa/paseo, monturas ni vuelo habilitable. No hay operaciones de red de esas áreas en el adaptador actual. El carrito **AGUAS FRESCAS** de `world/plaza.js` es geometría decorativa de la plaza; no tiene una entrada en sus `interactables`. No es todavía un puesto funcional del parque.

| Entrega | Material que puede prepararse aisladamente | Datos/operaciones que debe confirmar Claude antes de conectar |
| --- | --- | --- |
| UI-3 Mascotas | Catálogo, ficha, estados de compañía y composición de paseo/correas. | IDs y categorías canónicos, propiedad, miniaturas/modelos y su liberación, selección activa, acciones permitidas por especie, confirmación/error, guardado y eventos entre sesiones. Para paseo: equipo compatible, comienzo/pausa/fin y estado del acompañante. Para montura/vuelo: capacidad explícita validada por la mecánica. |
| UI-4 Tiendas/inventario | Tarjetas uniformes, filtros, ficha, confirmación, pendiente/error, espacio de saldo e inventario. | Catálogo y precios autoritativos, moneda virtual definida, inventario real, posibilidad de equipar/usar, método de compra, resultado de saldo/propiedad confirmado, idempotencia y recuperación tras desconexión. No usar Stripe ni la cartera real. |
| UI-5 Vivienda | Panel de categorías, selección, controles visuales de mover/girar, estados válido/inválido y confirmar/cancelar. | Catálogo y propiedad de muebles, entrada/salida del modo decorar, selección de pieza, comandos de colocación aceptados, validez determinada por la mecánica, confirmación/cancelación, guardado/carga/revisión y notificación de cambios. No duplicar el algoritmo de colocación. |
| Aguas frescas | Selector Preparar/Pedir, sabor, ingredientes/pasos, menú y confirmación compacta. | Ubicación/interacción real, recetas y pasos canónicos, catálogo/precio virtual, compra/entrega y resultado de preparar. No deducir reglas del carrito decorativo. |
| UI-6 Diez juegos | Portadas, instrucciones, pregunta/opciones, progreso, feedback y resultado; una composición por personalidad visual. | IDs de las diez mecánicas, objetivo/instrucciones validados, comienzo/fin/cancelación, datos de partida, progreso, resultado y recompensa del servidor, reintento y retorno. No reutilizar reglas de un juego parecido por coincidencia de nombre. |

Los nombres del encargo 2.0 son referencias de diseño, no IDs ni contratos existentes: Carrera del Saber, Manzanas Perdidas, Héroes de la Ciudad, Rescate Responsable, Guardianes del Parque, Veterinarios por un Día, Mercado Justo, Amigos del Agua, Aventura de las Emociones y Expedición del Conocimiento.

## Kit visual aislado para revisión

`_ui-previews/` contiene composiciones locales de mascotas, paseo, tienda, inventario personal, decoración, aguas y una pantalla de juego. Nivel, XP, monedas, recompensas y compras de muestra tienen presentaciones diferenciadas. Sus datos están identificados como **muestra**, las acciones sólo modifican el estado de la demostración y no se importan desde el juego. No hay `fetch`, adaptador WebSocket, almacenamiento persistente ni conexión con cuentas, créditos o inventario reales. El directorio comienza por `_` para que la publicación Jekyll actual lo omita; no añadirlo a `include` ni copiarlo a otra ruta pública.

Los componentes reciben datos y callbacks locales. Sus nombres son una propuesta de presentación revisable, no una API de red ni un contrato definitivo. Para conectar una pantalla: sustituir primero el modelo de muestra por el adaptador aprobado de Claude, mostrar sólo acciones respaldadas y mantener pendiente/error hasta la respuesta autoritativa. Ninguna pantalla de muestra debe hacerse accesible desde el menú de producción.

## Archivos que se conservan bajo responsabilidad de la mecánica

- `js/core/`, `js/net/`, `js/world/`, `js/characters/`, `js/missions/` y `_ciudad-server/`: física, colisiones, escenas, modelos, animación, reglas, red, validación y persistencia.
- `js/progress/rules.js`, `js/progress/appearance-catalog.js`, `js/edu/activities.js`, `district-rules.js`, `questions.js`, `play-rules.js`, `family.js` y `js/economy/economy.js`: catálogos/reglas canónicos, preguntas, recompensas y límites.
- `js/edu/games.js`, `district.js`, `npc-quiz.js` mezclan control y presentación: evitar reemplazarlos completos. Preferir una hoja con alcance o una función de composición pequeña, conservando el flujo de la mecánica.
- La UI se concentra en `js/ui/`, `css/` y los puntos de montaje de `index.html`. Las modificaciones de integración en archivos compartidos deben revisarse contra `main` actualizado.

Los comentarios históricos de `economy.js` sobre una futura cartera real no autorizan activarla: el encargo actual exige moneda virtual separada y ninguna conexión nueva con créditos financieros.

## Verificaciones antes de habilitar cada conexión

1. Fixtures aislados y capturas de escritorio, tablet y móvil, con teclado, foco y movimiento reducido.
2. Contrato real confirmado por Claude y acciones ocultas cuando no estén soportadas; ningún resultado de muestra en producción.
3. Éxito, demora, error, respuesta antigua, doble toque, desconexión y cierre con borrador/selección pendiente.
4. Compras/equipamiento/colocación sólo cambian su estado definitivo después del backend o de la mecánica responsable.
5. Reinicio, recarga y dos sesiones independientes con la misma cuenta para propiedad, apariencia, compañía, saldo y vivienda, cuando cada servicio exista.
6. Sin cambio de derechos, XP, recompensas, moderación, edad, colisiones, grafo de viajes ni formato de animaciones.

Las pruebas locales de composición y los tamaños emulados no equivalen a dispositivos físicos, compras reales ni persistencia de mascotas/viviendas en Railway o Firestore. Estas últimas permanecen pendientes hasta que existan sus funcionalidades y contratos.
