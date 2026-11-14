# QA local y futuras conexiones con Mundo Vivo

Este laboratorio continúa aislado. Su `dispatch`, los IDs `*-sample`, las acciones `equipSample`/`pauseWalk` y el resultado `{ok,model}` son **propuestas locales**, no APIs de Claude. No se deben conectar traduciendo sus nombres por semejanza. La fuente real revisada es `feature/ciudad-mundo-vivo` **ca84ff6**, especialmente `ciudad/MUNDO_VIVO.md`; main **f43f608** todavía no contiene esa expansión.

## Datos y aceptación por cada composición

| Vista | Fuente comprobada en ca84ff6 | Confirmación/eventos y comprobaciones necesarias |
| --- | --- | --- |
| Mascotas | `api.vivo.state.pets/activePet/inv`, `catalog()`, `adopt`, `setPet`, `rest`, `feed`, `accessoriesFor`; `PetPreview` | No conceder propiedad antes de `ok` y del perfil confirmado. Probar razas/requisitos/precio reales, mascota ajena, accesorios compatibles, cuenta infantil, nombre filtrado, adoptada/colección llena. Adopción: repetir el mismo rid sin doble cargo. Liberar preview y suscripción al cerrar. |
| Paseo | `api.vivo.activePet`, `leash`, `walk(true/false)`, `WALK_SCENES`, accesorios persistentes mediante `setPet` | Sólo perro activo con correa compatible. Confirmar `{ok,leash}` y apariencia `pet` en otro jugador. Correa efímera por sesión: desconexión/recarga debe restablecerla; no exigir guardarla. Collar/arnés/correa sí pertenecen a la mascota persistida. No existe `pauseWalk` ni un selector arbitrario de color en el contrato. |
| Tiendas | `shops`, `shop(id)`, `buy(item,qty)`, catálogo `ITEMS`, `state.coins/inv` | Precio, saldo, cantidades y propiedad del servidor. Compras atómicas e idempotencia del mismo rid; no requieren inventar expectedRevision. Doble toque, saldo insuficiente, artículo único, consumible/mueble apilable, ACK tardío y recuperación del perfil sin comprar de nuevo automáticamente. XP y cartera financiera intactos. |
| Inventario | `state.inv` con cantidades, `ITEMS.kind`, `actions.useToy(id)`, `setAvatar`, `wearInfo/locked` | No usar un «equipar todo» genérico. Probar la acción real correspondiente a cada tipo, artículo no poseído y prenda pagada. La colección no pierde una prenda al vestirla; los consumibles siguen sus reglas. El rechazo servidor de ropa pagada prometido en MUNDO_VIVO§15 requiere comprobación contra el código y prueba; no basta el bloqueo de la UI. `coinbook.recent` es un tramo de 12 movimientos, no un historial completo. |
| Casa | `homeEditor` (draft/sel/add/move/rotate/remove/setWall/setFloor/check/save/close), `scene.applyHome`, `vivo.saveHome(layout)` | Borrador sin escribir, cancelar/revertir, validar propiedad/límites y mostrar guardado sólo tras confirmar. Aquí sí es relevante proteger dos borradores simultáneos contra sobrescritura silenciosa. Existe `profile.rev`, pero la firma leída no recibe una revisión esperada: declarar puerta pendiente hasta que Claude acuerde y pruebe la estrategia. No añadir un campo de red por iniciativa de la UI. |
| Aguas | `FLAVORS`, `INGREDIENTS`, `DRINK_PRICE`, `drinkSteps`, `vivo.drink(flavor,'self'/'buy',steps)` | Las recetas reales sustituyen los tres pasos ilustrativos. Preparar/pedir tienen resultados y costes distintos; premio diario del servidor. Repetir el mismo rid no repite cargo/premio. Lo persistente son monedas/movimientos, no el vaso o sabor servido; no inventar `profile.water`. |
| Juegos | Controladores educativos actuales; las diez mecánicas nuevas siguen sin contrato en MUNDO_VIVO | Mantener la puerta `canonical-games`. Antes de conectar: IDs, inicio/cancelación/retorno, objetivos, controles, progreso, resultado/recompensa, requisitos y reintento aprobados. La pregunta de muestra no certifica ninguna de esas mecánicas. |

Para las áreas persistentes: probar A→B y B→A con **dos sesiones independientes del mismo UID**, recarga y cierre/reapertura de sesión. Declarar si B se actualiza mediante evento real o mediante lectura explícita. En ca84ff6, `vivo.change` es local a perfiles recibidos; el evento público `pet` no replica el inventario ni la casa completa. No llamar «sincronización en vivo» a una comprobación que solicitó manualmente `profile/get`.

`api.vivo.online` debe gobernar disponibilidad. El getter `state` puede conservar datos previamente guardados aunque la conexión no esté activa. Un timeout de 9 s significa resultado desconocido: recuperar la autoridad antes de ofrecer otro intento. El servicio genera un rid nuevo en cada llamada pública; para probar la repetición exacta se necesita una fixture de transporte autorizada que conserve el intento original. No cambiar la firma del servicio desde el kit.

## Harness opcional, sin adaptador incorporado

`integration-harness.cjs` es un verificador de observaciones de QA. **No importa código de una rama, inicia servidor, abre cuentas, crea catálogos, migra perfiles ni conoce URLs.** Las funciones descritas aquí son callbacks del adaptador de pruebas, no operaciones nuevas del juego.

Sin `ICADEM_MUNDO_ADAPTER`, termina con código **2/PENDIENTE**, no con un éxito. El fichero externo debe exportar `createIntegrationAdapter()` y ser revisado contra el commit que se vaya a integrar. Usar exclusivamente servidor local o staging y cuentas/objetos de prueba; `metadata.production` debe ser `false`. Nunca incluir tokens, contraseñas o claves en el adaptador ni en el repositorio.

El adaptador suministra:

- `metadata`: `mode` (`local-service` o `staging`), `production:false`, `independentSessions:true`, `contractReferences` por las siete áreas y `pendingContracts` para lo que aún no pueda probarse. Las puertas son casos QA: `canonical-games`, `expected-revision`, `independent-session-refresh`, `repeat-identity`, `ack-recovery`, `permission`, `ephemeral-contract`.
- `createScenario(area)`: prepara una fixture aislada y devuelve callbacks. `cleanup()` es obligatorio, también al fallar; no borrar datos de alumnos. Las operaciones deben tener tiempos de espera acotados y resolver estados desconocidos sin repetir cargos.
- Para una operación persistente, `policy` declara `concurrency:'atomic'|'revision'`, `replay:'request-key'|'idempotent-state'|'not-applicable'` y `sync:'server-event'|'explicit-refresh'`. La política se justifica en referencias reales. CAS no es un requisito universal. En vivienda, si no hay estrategia de conflicto, usar `pendingContracts.home:['expected-revision']`.
- `snapshot('A'|'B')`: proyección de QA `{subjectKey,value,protected,revision?}`. `subjectKey` procede del UID autenticado; no se imprime. `value` usa exclusivamente datos autoritativos del área. `protected` incluye invariantes ajenas a la operación (al menos derechos académicos, membresía y cartera financiera, y XP cuando no corresponda cambiarlo). `revision` es la real, nunca un contador fabricado; sólo es obligatoria para el caso de revisión.
- `commitFrom(session)`: realiza un cambio real distinto en A y B y devuelve `{accepted:true,identity?,revision?}` sólo después de confirmarlo. `waitForReplica(session,revision?)` usa la estrategia declarada; `reload(session)` y `reauthenticate(session)` deben actuar sobre esas sesiones, sin reutilizar el mismo almacenamiento de navegador.
- Cuando corresponda, `replayCommitted()` repite **el mismo intento** y permite comprobar que no hubo otro efecto/cargo. `rejectStale(revision)` sólo se exige con política de revisión; no se inventa para compras atómicas. `rejectUnauthorized()` realiza el caso real no autorizado y mapea `{accepted:false,category:'permission'}`; esa categoría es sólo de QA.
- `recoverInterrupted()` corta/demora una confirmación en la fixture local y devuelve evidencia `{interrupted:true,settled:true,automaticRetries:0,outcome:'committed'|'not-committed'}` tras recuperar el estado real. No ocultar lecturas explícitas ni usar mocks como evidencia de backend.

Para **paseo**, el escenario usa `lifecycle()` y `cleanup()` en lugar del flujo de persistencia. Devuelve observaciones QA `before:{leash:false,protected}`, `active:{confirmed:true,leash:true,observerLeash:true,protected}` y `reset:{leash:false,trigger:'disconnect'|'reload',protected}`. Se comprueba reinicio de sesión y conservación de propiedad/saldo, no guardado de la correa ni una pausa inexistente.

El informe omite snapshots, UID y respuestas originales; identifica qué políticas se verificaron. El adaptador controla el alcance: aprobar esas proyecciones **no demuestra automáticamente** todos los permisos, dispositivos o sistemas del juego. Si hay puertas pendientes, el informe y la salida siguen siendo PENDIENTE/código 2.

Ejecución futura, cuando el adaptador y los contratos estén aprobados:

```powershell
$env:ICADEM_MUNDO_ADAPTER = 'C:\ruta\de\pruebas\adaptador-revisado.cjs'
node ciudad/_ui-previews/integration-harness.cjs
```

`integration-harness.test.cjs` utiliza unidades en memoria para verificar el **verificador**: detectar duplicaciones, conflictos de vivienda, fallos del adaptador, puertas pendientes y el reinicio de paseo. Esas unidades no acreditan una integración con ca84ff6, Railway o Firestore.

## Evidencia local de presentación

`preview.test.cjs` conserva sus diez pruebas originales. `qa.test.cjs` añade el regreso desde un error a otra composición. `qa.cjs` comprueba teclado, foco, diálogo, objetivos de 44 px, nav seleccionado visible, ausencia de overflow, etiquetas y contrastes concretos. Cumplir esos controles no sustituye una auditoría WCAG completa.

```powershell
node --test ciudad/_ui-previews/preview.test.cjs ciudad/_ui-previews/qa.test.cjs ciudad/_ui-previews/integration-harness.test.cjs
node ciudad/_ui-previews/qa.cjs RUTA_A_PLAYWRIGHT CARPETA_CAPTURAS
```

El renderizador sólo abre HTML/SVG local con Chrome/WebKit, sin mundo, WebGL, perfiles ni backend. Los tamaños son emulados. `ICADEM_PREVIEW_QA_ENGINES` y `ICADEM_PREVIEW_QA_SIZES` permiten una pasada puntual, por ejemplo `webkit` y `320x740,390x844`. Las capturas deben conservar la identificación de prototipo local.
