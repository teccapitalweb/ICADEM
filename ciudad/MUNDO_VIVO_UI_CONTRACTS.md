# Mundo Vivo · contratos de interfaz y límites de integración

Revisión del 13 de noviembre de 2026. Se distinguen dos fuentes: `main` **f43f608** (Ciudad ICADEM 1.3, PR #71, con vestidor #70) y la rama de Claude `feature/ciudad-mundo-vivo` en **ca84ff6**. Esta última ya contiene contratos y funciones 2.0 en desarrollo; no se integró, ejecutó ni desplegó al revisar sus objetos Git. Las propuestas locales del laboratorio no son esos contratos.

## Lo disponible en main f43f608

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

## Diferencia entre main y la rama 2.0

En **main f43f608** no hay servicio de mascotas, inventario de artículos, compras, editor de viviendas, correa/paseo, monturas ni vuelo habilitable. Allí el carrito **AGUAS FRESCAS** de `world/plaza.js` es decorativo. En **ca84ff6** sí existen estos sistemas y paneles funcionales: el carrito tiene a Don Chema, hay Paseo comercial y una escena `casa`. Por tanto, la tabla siguiente expresa dependencias de la integración con main, no ausencia de implementación en la rama de Claude. Los contratos comprobados de esa rama se detallan después.

| Entrega | Material que puede prepararse aisladamente | Datos/operaciones que debe confirmar Claude antes de conectar |
| --- | --- | --- |
| UI-3 Mascotas | Catálogo, ficha, estados de compañía y composición de paseo/correas. | IDs y categorías canónicos, propiedad, miniaturas/modelos y su liberación, selección activa, acciones permitidas por especie, confirmación/error, guardado y eventos entre sesiones. Para paseo: equipo compatible, comienzo/fin y ciclo de sesión del acompañante; no publicar pausa sin contrato. Para montura/vuelo: capacidad explícita validada por la mecánica. |
| UI-4 Tiendas/inventario | Tarjetas uniformes, filtros, ficha, confirmación, pendiente/error, espacio de saldo e inventario. | Catálogo y precios autoritativos, moneda virtual definida, inventario real, posibilidad de equipar/usar, método de compra, resultado de saldo/propiedad confirmado, idempotencia y recuperación tras desconexión. No usar Stripe ni la cartera real. |
| UI-5 Vivienda | Panel de categorías, selección, controles visuales de mover/girar, estados válido/inválido y confirmar/cancelar. | Catálogo y propiedad de muebles, entrada/salida del modo decorar, selección de pieza, comandos de colocación aceptados, validez determinada por la mecánica, confirmación/cancelación, guardado/carga/revisión y notificación de cambios. No duplicar el algoritmo de colocación. |
| Aguas frescas | Selector Preparar/Pedir, sabor, ingredientes/pasos, menú y confirmación compacta. | Ubicación/interacción real, recetas y pasos canónicos, catálogo/precio virtual, compra/entrega y resultado de preparar. No deducir reglas del carrito decorativo. |
| UI-6 Diez juegos | Portadas, instrucciones, pregunta/opciones, progreso, feedback y resultado; una composición por personalidad visual. | IDs de las diez mecánicas, objetivo/instrucciones validados, comienzo/fin/cancelación, datos de partida, progreso, resultado y recompensa del servidor, reintento y retorno. No reutilizar reglas de un juego parecido por coincidencia de nombre. |

Los nombres del encargo 2.0 son referencias de diseño, no IDs ni contratos existentes: Carrera del Saber, Manzanas Perdidas, Héroes de la Ciudad, Rescate Responsable, Guardianes del Parque, Veterinarios por un Día, Mercado Justo, Amigos del Agua, Aventura de las Emociones y Expedición del Conocimiento.

## Contratos reales de la rama ca84ff6

Fuentes leídas mediante `git show`: `ciudad/MUNDO_VIVO.md` (16 secciones), `js/vivo/vivo-service.js`, `js/ui/vivo-panels.js`, `js/ui/aguas.js`, `js/home/home-editor.js`, `js/pets/pet-preview.js`, `js/vivo/vivo-rules.js`, `js/net/ws-adapter.js`, `js/main.js`, `_ciudad-server/profiles.js` y `server.js`. Esta revisión de código **no es aceptación de la rama, prueba de backend ni autorización de migraciones**.

| Composición local | Contrato comprobado en ca84ff6 | Ajustes necesarios antes de sustituir el prototipo |
| --- | --- | --- |
| Mascotas | `api.vivo.catalog()`, `.adopt(breed,name)`, `.setPet(id,{name?,acc?,active?})`, `.rest()`, `.accessoriesFor(petId)`, `.feed(petId,food)`; `state.pets`, `activePet`, `inv`; catálogos `BREEDS`, `SPECIES`, `PET_SLOTS`. `PetPreview(renderer).show(breed,acc)`, `.start()`, `.stop()` comparten el renderizador. | Usar IDs, razas, cantidades, accesorios compatibles, requisitos y costes reales. Ningún perro/gato/dragón de muestra se convierte en propiedad. Conservar privacidad del nombre, límites y liberación del preview. |
| Paseo/correas | `api.vivo.walk(true/false)` confirma `{ok,leash}`; `.leash`, `.activePet`; `WALK_SCENES`, perros con correa equipada. Accesorios persistentes mediante `setPet`. `api.pets.react(...)`, `.throwBall()` y `api.actions.ball()` ya existen. | El paseo es efímero por sesión, no un campo persistente de `state`. No hay contrato `pauseWalk`: el «Detenerse» del ensayo no se debe publicar como funcional. Las variantes/colores deben venir de artículos compatibles, no de los swatches ficticios. |
| Tiendas | `api.vivo.shops`, `.shop(id)` devuelve artículos con `owned`, `affordable`, `unique`; `.buy(item,qty)` devuelve `{ok,item,qty,spent,...}`. `SHOPS`: ropa, zapatería, accesorios, mascotas, muebles, juguetes, aguas y especial. | Reemplazar categorías/precios/saldo de muestra por catálogo y `coins` reales. Cantidades, artículos únicos y consumibles tienen reglas distintas. La UI no resta monedas ni concede propiedad. |
| Inventario | `state.inv` es `{id: cantidad}`, no una lista booleana. Tipos `petAcc`, `petToy`, `treat`, `furniture`, `toy`, `wear`. `api.actions.inventory()`, `.useToy(id)`; prendas mediante `api.setAvatar` y `.wearInfo(slot,option)`/`.locked(custom)`. | No hay un `equipSample` universal: usar la operación correspondiente al tipo. Separar XP de `state.coins`. `coinbook.recent` muestra sólo 12 movimientos recientes; no presentarlo como historial completo de compras. |
| Casa/editor | `api.goHome()`, `api.homeEditor.open()/close(revert)/save()`, `.draft`, `.sel`, `.available(id)`, `.add(id)`, `.move(dx,dz)`, `.rotate()`, `.remove()`, `.setWall(id)`, `.setFloor(id)`, `.check()`. `api.scene.applyHome(layout)` sólo previsualiza; `.vivo.saveHome(layout)` confirma. | El layout real usa metros `x,z` y `r` en cuartos de vuelta: el plano porcentual de muestra no se persiste. Validez/propiedad pertenecen a `checkLayout`, límites y servidor. Cancelar debe revertir; no guardar cada movimiento del borrador. |
| Aguas | `openAguas(api)`; `.vivo.drink(flavor,'self'|'buy',steps)` y `FLAVORS`, `INGREDIENTS`, `DRINK_PRICE`, `drinkSteps(flavor)`. Secuencia canónica: vaso, agua, ingredientes, hielo, servir. Comprar cuesta 5 monedas; preparar concede 3 una vez al día. | Sustituir los tres pasos de muestra por la receta real y sus seis sabores. La recompensa sólo se muestra después de `ok`. El sabor servido y la animación no son una propiedad persistente llamada `water` en el perfil. |
| Juegos | Los controladores educativos existentes siguen separados; `MUNDO_VIVO.md` no define las diez mecánicas nuevas del encargo. | Las diez portadas y la pregunta del kit continúan siendo referencias. Faltan IDs, reglas, inicio/cancelación, resultados y recompensas canónicos de las nuevas mecánicas. No enlazarlas por parecido de nombre. |

Las acciones de navegación están en `api.actions`: `avatar`, `wardrobe`, `inventory`, `pets(tab)`, `home`, `mounts`, `emotes`, `map`, `missions`, `games`, `shop(id)`, `ball`, `useToy(id)`. No deben coexistir dos menús que ejecuten la misma navegación. Monturas/vuelo tienen `api.mounts`, requisitos y ruta controlada propios; el laboratorio no ofrece montura/vuelo simulados.

### Confirmación, eventos y límites comprobados

- `VivoService` sólo solicita al transporte; devuelve `{ok,reason?,message?,...}` y bloquea acciones simultáneas por clave con `en-curso`. `on('change',fn)` devuelve una función para desuscribir. `main.applyProfile` reemplaza los datos y llama a `vivo.changed()`. La UI debe leer el perfil confirmado, no asumir éxito al pulsar.
- El transporte usa mensajes `vivo` correlacionados por `n`. Espera hasta 9 segundos; después devuelve `sin-respuesta`. No se puede interpretar ese resultado como «no se cobró»: hay que recuperar el perfil antes de ofrecer reintento de una compra. Un ACK tardío también trae perfil.
- `buy`, `adopt` y `drink` generan un `rid` interno por llamada. El servidor recuerda hasta 40; repetir **el mismo rid** devuelve `duplicate:true` sin un segundo cargo. Volver a llamar al método público genera otro rid. La prueba de repetición debe retener el intento original en un transporte local revisado; no inventar una firma pública que acepte rid.
- `Profiles.#write` incrementa `profile.rev`; `VivoService.state` contiene `coins/inv/pets/activePet/home/coinbook`, pero **no rev**. Para QA puede observarse la revisión del evento `profile`. `setPet` y `saveHome` no reciben revisión esperada. En el código leído no hay un rechazo CAS documentado para dos editores de casa: no afirmar protección contra sobrescrituras simultáneas hasta acordarla y probarla con Claude.
- El servidor responde el perfil al socket que solicitó la operación; la difusión `pet` contiene raza/accesorios/correa para los demás jugadores, no inventario o vivienda completos. `change` en una sesión no demuestra actualización automática del perfil de otro dispositivo. Probar y acordar evento o lectura explícita al recuperar foco/abrir vista; indicar cuál se usó.
- `api.vivo.online` comprueba conexión y estado. Aunque el documento describe `state:null` sin conexión, el getter leído puede conservar el último `store.state.vivo`; su presencia por sí sola no demuestra conexión ni vigencia. No habilitar compras por tener un objeto de estado en caché.
- Criterios de aceptación de permisos: cuenta infantil → `no-disponible`; mascota ajena, artículo no poseído, accesorio incompatible, prenda pagada no poseída y layout inválido deben rechazarse en el servidor. Esta lista no certifica que todos los casos estén probados. No deducir permiso de la apariencia de un botón.
- **Paridad pendiente de prendas pagadas en ca84ff6:** `MUNDO_VIVO.md` §15 promete rechazo servidor `prenda-bloqueada`, pero la ruta leída de `Profiles.setAvatar` comprueba el personaje y normaliza `custom`, sin consultar el inventario de prendas. La guardia `api.vivo.locked(custom)` está en el cliente. Es un hallazgo de revisión estática, sin ejecución ni cambio de esa rama: Claude debe confirmar/corregir la paridad y añadir una prueba por socket antes de conectar prendas pagadas. No basta ocultar Equipar en la UI.
- La conversión única de créditos de prueba a monedas está en la rama de Claude, no en este PR. No se ejecutó al leer el código. No duplicar ni activar esa migración desde las interfaces de muestra.

El [plan de QA e integración](./_ui-previews/INTEGRATION_QA.md) separa estas APIs comprobadas de la interfaz exclusivamente de pruebas del harness. Sin adaptador y sin resolver sus puertas pendientes, la comprobación termina como **PENDIENTE**, nunca como backend verificado.

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
