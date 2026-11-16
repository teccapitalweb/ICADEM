# Ciudad ICADEM 2.0 · contratos y comprobaciones de integración

Base revisada: `fd0c2b5` (PR #75). Esta integración conserva los catálogos, los modelos,
las reglas de monedas, las misiones y los diez juegos entregados por Claude. No incorpora
la simulación del PR #72 como fuente de datos: las interfaces usan los servicios reales
de `MUNDO_VIVO.md` y las respuestas confirmadas del servidor.

El catálogo de esa base contiene **39 razas**: 14 perros, 11 gatos, 8 aves y 6 fantásticas.
La interfaz calcula sus cantidades desde el catálogo; no inventa la raza número 40 anunciada.

## Qué se comprobó realmente

Las pruebas automáticas de esta entrega usan el servidor de sesiones real en `127.0.0.1`,
WebSockets reales, `Profiles` y almacenamiento en memoria con UIDs ficticios. No acceden a
Firebase, Railway, cuentas de alumnos, membresías, Stripe ni créditos reales. No usan GPU.
Una prueba adicional emula el contrato de revisión del adaptador Firestore para forzar
una colisión entre dos instancias; **no es una prueba de Firestore desplegado**.

Comandos desde la raíz del repositorio, después de instalar las dependencias del servidor:

```sh
node --test test/ciudad-vivo-integration-contracts.test.cjs test/ciudad-vivo-integration-safety.test.cjs test/ciudad-vivo.test.cjs
```

| Comprobación | Evidencia |
|---|---|
| El servidor rechaza una prenda de pago no comprada | `setAvatar` y petición `profile/avatar` por WebSocket: `prenda-bloqueada`; después de comprar se equipa |
| El navegador no decide precio, saldo, XP ni artículos concedidos | Compra con `price`, `coins` y cantidades manipuladas; precio del catálogo; rechazo sin mutación |
| Compras concurrentes no pierden saldo ni inventario | Dos operaciones sobre el mismo UID y cinco reenvíos del mismo `rid` |
| Compra, adopción y bebida idempotentes | Reenvío exacto del mismo `rid`, incluso mediante otra instancia de `Profiles` |
| Recuperación de inventario, mascotas y casa | Reconexión WebSocket y nueva lectura de la misma cuenta; otro UID permanece aislado |
| Una sesión por cuenta | Una segunda sesión recibe el perfil persistido y la primera recibe `sesion-en-otro-lugar` |
| Borradores de vivienda obsoletos | Dos borradores y dos guardados simultáneos; rechazo `casa-conflicto` sin cambiar casa, saldo ni revisión |
| Carrera entre procesos | Dos instancias sobre adaptador CAS **emulado**; al reintentar se relee y se rechaza el borrador obsoleto |
| Seis actividades educativas | Bitácoras válidas por WebSocket, calificación del servidor, rechazo de bitácora vacía, progreso recuperado en otra sesión |
| Cuatro juegos de campo | No se pueden conceder enviando `profile/activity`; pruebas existentes comprueban posiciones y tiempos con `Hub` real |

La pérdida de confirmación en el servicio cliente se reproduce mediante un transporte controlado
que ejecuta `Profiles.vivo` real y descarta la respuesta. Se distingue de una caída física de red:
verifica el fallo de aplicación y su reintento, no simula cobertura móvil ni un dispositivo físico.

Las capturas responsive, las pruebas DOM y las pruebas con navegador se informan por separado.
Un viewport de 390 px no equivale a probar un iPhone físico ni Safari de iOS.

## Contratos que consumen las interfaces

| Interfaz | Lecturas confirmadas | Acciones reales | Estados que debe presentar |
|---|---|---|---|
| Mascotas | `vivo.state.pets`, `activePet`, `catalog()` | `adopt`, `setPet`, `rest`, `feed` | Requisito, saldo, ya adoptada, nombre rechazado, pendiente y error |
| Correas y accesorios | `accessoriesFor(id)`, inventario y compatibilidad del catálogo | `setPet(id,{acc})`, `walk(boolean)` | Sólo accesorios propios compatibles; paseo confirmado por servidor |
| Tiendas | `shop(id)`, precios de `catalog.js`, saldo confirmado | `buy(item,qty)` | No confirmar antes de ACK; duplicado recuperado, falta de monedas, artículo bloqueado |
| Inventario | `state.inv` y catálogo compartido | Acciones existentes `useToy`, `setPet`, compras y editor | Cantidad real; nada concedido por selección visual |
| Vivienda | `state.home`, `homeRev` e inventario propio | `saveHome(layout,{expectedHomeRevision})` | Guardando, error, conflicto con borrador conservado, recarga explícita de casa guardada |
| Aguas frescas | `FLAVORS`, `drinkSteps`, saldo | `drink(flavor,'buy'|'self',steps)` | Receta incompleta, falta de saldo, confirmación y premio diario determinado por servidor |
| Juegos | `VivoGames`, `ACTIVITIES`, `FIELD_GAMES` y resultado del servidor | `choice`, `field`, `quit` | Preguntas, progreso y avisos sin chat superpuesto; resultados confirmados |

No faltan los contratos de los diez juegos: están en `MUNDO_VIVO.md`, sección 18. El plan
de integración pendiente anterior a PR #75 queda sustituido por los contratos siguientes:

| Juego | ID | Validación |
|---|---|---|
| Carrera del Saber | `carrera` | `play/start`, posiciones, barreras y respuestas; no `activity` |
| Manzanas perdidas | `manzanas` | `play/start`, `check` con `talk/pick/slip/deliver` |
| Héroes de la ciudad | `heroes` | Bitácora `activity` regenerada con semilla |
| Rescate responsable | `rescate` | Bitácora `activity`, intentos y acciones seguras |
| Guardianes del parque | `guardianes` | `play/check`: recoger, clasificar, reportar y regar |
| Veterinarios por un día | `veterinarios` | Bitácora `activity` |
| Mercado justo | `mercado` | Bitácora `activity`, nivel básico o avanzado |
| Amigos del agua | `agua` | Bitácora `activity` |
| Aventura de las emociones | `emociones` | Bitácora `activity` |
| Expedición del conocimiento | `expedicion` | `play/check`: sellos y respuestas, posiciones y finalización |

## Dos defectos reales detectados y correcciones mínimas

### Borradores de vivienda

PR #75 serializaba las escrituras por UID y el adaptador Firestore protegía la revisión general
de almacenamiento, pero el servidor no comparaba la versión con la que se abrió el editor.
Reproducción anterior: dos borradores en `rev=0`; A guardaba pared menta (`rev=1`) y B guardaba
pared cielo desde su borrador anterior (`rev=2`). Ambos recibían `ok:true` y se perdía A.

El contrato añadido es:

```js
// Perfil confirmado: homeRev comienza en 0 para perfiles previos.
{ home, homeRev }
// Petición de guardado: la revisión se captura al abrir el borrador.
{ t: 'vivo', op: 'home', layout, expectedHomeRevision: homeRev, n }
// Si cambió desde entonces:
{ t: 'vivo', op: 'home', ok: false, reason: 'casa-conflicto', profile, n }
```

La comparación ocurre en `Profiles.vivo`, dentro de la operación serializada, antes de aplicar
la distribución. Un guardado aceptado incrementa `homeRev` y la revisión general; compras,
mascotas y juegos no incrementan `homeRev`. Al reintentar un conflicto de almacenamiento,
`Profiles` relee y vuelve a comparar. El editor conserva el borrador rechazado y requiere
confirmación explícita antes de cargar la casa guardada. No reintenta ni sustituye la versión
actual automáticamente.

No requiere migración ni cambio de reglas Firestore: `cleanVivo` normaliza la revisión ausente
a cero. Un cliente antiguo sin `expectedHomeRevision` recibe un rechazo, porque permitir su
escritura dejaría abierta la sobrescritura. El despliegue requiere actualizar servidor y cliente,
incluido el caché del panel/juego, en una misma entrega. Durante el breve intervalo, el fallo
seguro es rechazar el guardado, conservar el borrador y pedir actualización.

### Confirmación perdida en una compra

El servidor ya deduplicaba un `rid`, pero `VivoService.buy` generaba uno nuevo en cada llamada.
Antes, si el servidor cobraba una galleta y se perdía la ACK, el mensaje «Inténtalo de nuevo»
conducía a otra compra: 90 monedas y dos galletas desde un saldo de 100.

Ahora el servicio conserva `rid` y datos de una operación con respuesta desconocida
(`sin-respuesta`). Un reintento **explícito de la misma acción** utiliza esa solicitud; no hay
reintentos automáticos. Si cambia la cantidad o los datos, se pide resolver primero la solicitud
pendiente. Una respuesta autoritativa libera la siguiente operación deliberada. Se conserva
también el identificador si entre ambos intentos hay `sin-conexion`.

Para cerrar y reabrir un panel durante esa misma instancia, `pendingTransactions()` entrega
metadatos clonados de las solicitudes sin confirmar, sin exponer ni permitir editar su `rid`.
`retryTransaction(key)` recupera explícitamente la solicitud original. Es una ayuda del servicio
cliente sobre el protocolo existente; no crea una API del servidor ni ejecuta compras al abrir
la pantalla. Los consumos sin `rid` (por ejemplo, dar un premio a una mascota) se comprueban
actualizando el perfil; no se reenvían como si fueran idempotentes.

Límites existentes: el servidor recuerda los últimos **40 identificadores** y el cliente mantiene
la solicitud pendiente en memoria mientras vive esa instancia. No se promete deduplicación
indefinida después de superar esa ventana ni después de cerrar/reabrir el juego. Tras una
recarga, el saldo y el inventario se recuperan del perfil del servidor; nunca se reenvían compras
automáticamente. Una garantía histórica ilimitada requeriría un contrato de recibos del servidor,
fuera de este ajuste. No se amplían economía ni reglas de caducidad en esta entrega.

## Prueba manual pendiente en producción

Con sesión legítima de adulto y chat autorizado: entrar a Ciudad, abrir chat, escribir un mensaje
breve de prueba y pulsar Enviar una vez. Comprobar que aparece después de la confirmación,
que al tocar fuera se cierra el panel y se oculta el teclado, y que un borrador sin enviar se
conserva al reabrirlo. Dejar un borrador y comenzar un juego de campo: el chat debe apartarse
sin cubrir preguntas ni controles y permitir recuperar el borrador al terminar.
No compartir tokens, contraseñas ni boletos.

La ausencia de acceso legítimo no se sustituye por datos ficticios en producción. Las pruebas
locales anteriores no demuestran un envío autenticado real ni persistencia en Railway/Firestore.
Los números de PR, commits publicados y estado de despliegues corresponden al informe final.
