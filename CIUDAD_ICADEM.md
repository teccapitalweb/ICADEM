# Ciudad ICADEM · arquitectura y estado

Videojuego 3D explorable integrado al panel VIP como la pestaña **Ciudad ICADEM**.
Las secciones 1 a 7 describen la **Fase 1 (prototipo jugable)**, ya publicada.
Las **secciones 8 y 9** describen lo desarrollado después en la rama `feature/ciudad-icadem`, **aún no publicado**: donde haya diferencia, manda la sección más reciente. Las secciones 8 y 9 ya están publicadas (PR #36); la **sección 10** está en la rama `feature/ciudad-icadem-social`, sin publicar.

Última actualización: 2026-11-10.

## 1. Qué se analizó de ICADEM antes de construir

| Tema | Cómo funciona hoy | Qué significa para el juego |
|---|---|---|
| Frontend | Sitio estático en GitHub Pages (`vip-panel.html` + `js/` + `css/`), sin empaquetador. Se publica con el workflow `pages.yml` al hacer push a `main`. | El juego también es estático: módulos ES nativos, sin paso de compilación. |
| Autenticación | Firebase Auth en el panel (`window.__auth`). Las llamadas al backend llevan el ID token (`ICADEMPlatform.request`). | El prototipo **no** usa la sesión. En Fase 2/3 el juego pedirá el token al panel para hablar con el backend. |
| Cartera de créditos | El saldo vive en Firestore (`credits/{uid}`) con ledger idempotente (`creditTransactions/...`). Solo el backend de Railway (`icadem-webhook`) lo modifica; el panel lo lee con `GET /api/credits/wallet`. | El juego nunca escribirá créditos desde el navegador. La recompensa real será un endpoint nuevo en ese backend. |
| Conexiones / directorio | `GET /api/directory`, perfiles en `directorio/{uid}`. | Base para "invitar amigos" en Fase 2, sin crear otra lista de amigos. |
| Navegación del panel | Cada pestaña es un *renderer* registrado en `Sections.renderers`; el menú se arma con `data-section`. | La pestaña nueva es un renderer más. |
| Service worker | `sw.js` guarda JS/CSS/imágenes del mismo origen con estrategia *cache-first*. | Cada publicación del juego debe subir la versión de `CACHE` en `sw.js`. |
| Backend | Repositorio aparte (`icadem-webhook`, Railway). No forma parte de este repo. | Todo lo que requiere servidor queda documentado, no implementado. |

## 2. Arquitectura elegida

**Three.js r170** (licencia MIT, incluido en `ciudad/lib/`, sin CDN) sobre módulos ES nativos.

- Compatibilidad: no necesita compilación ni cambia cómo se publica ICADEM.
- Rendimiento móvil: WebGL 1/2 directo, tres niveles de calidad y fusión de mallas (entre 100 y 260 llamadas de dibujo por escena, con sombras).
- Mantenimiento: el equipo ya trabaja con JS plano; no se agrega React, TypeScript ni un motor con editor propio.
- Babylon.js se descartó por peso (varios MB) para lo que pide la Fase 1.

**Aislamiento.** El juego vive completo en `ciudad/` y se abre dentro de un `<iframe>` a pantalla completa. Su CSS y su JS no pueden chocar con los del panel, y el panel solo recibió seis líneas nuevas.

```
ciudad/
  index.html            interfaz del juego (HUD, diálogos, ventanas)
  css/ciudad.css
  lib/three.module.min.js (+ licencia)
  js/
    main.js             arranque y ciclo principal
    core/               engine (render, calidad), input (teclado, mouse, táctil),
                        camera (tercera persona), collision, store (guardado de prueba)
    world/              kit (materiales, texturas, piezas), room, plaza, buildings, bank
    characters/         avatar (esqueleto + animaciones), catalog (10 avatares), npc
    missions/           bank-credit-logic (reglas puras) y bank-credit (flujo)
    economy/            economía de prueba + contrato de la cartera real
    net/                formato de estado y adaptador de red (sin conexión en Fase 1)
    ui/                 HUD, diálogos, mapa, pasaporte, misiones, armario, ajustes, tutorial
js/icadem-ciudad.js     puente del panel: portada de la pestaña y marco del juego
css/icadem-ciudad.css
assets/ciudad/portada.webp
test/ciudad-icadem.test.cjs
scripts/ciudad-e2e.cjs  prueba en navegador real (opcional, requiere Playwright)
```

Todo el arte (personajes, edificios, texturas) se genera por código: es original y no usa recursos de terceros.

## 3. Estado de las funciones

### Implementado y probado
Probado con 9 pruebas automáticas (`node --test test/ciudad-icadem.test.cjs`) y 47 comprobaciones en Chrome real (`scripts/ciudad-e2e.cjs`: 31 de juego y 16 de integración con el panel, en escritorio y en emulación de iPhone).

- Habitación inicial 3D: cama, armario, espejo, escritorio de misiones, panel de logros y puerta a la ciudad.
- Avatar Explorador controlable: caminar, correr, saltar, saludar, celebrar, sentarse e interactuar.
- Cámara en tercera persona (orbitar, acercar, sensibilidad, eje invertido) que no atraviesa paredes.
- Colisiones con paredes, muebles, edificios, fuente, árboles, faroles y personajes.
- Ciudad explorable: plaza con fuente, calles, banquetas, parque y 11 edificios con identidad propia.
- Entrada al Banco ICADEM (interior completo) y regreso a la ciudad y a la habitación.
- Misión 1 «El crédito correcto», completa: hablar con la clienta, leer dos documentos, pedir tres propuestas, comparar en el tablero, recomendar, justificar y recibir resultado con explicación.
- Calificación reconstruida de lo que el jugador hizo (no de un contador) y recompensa idempotente.
- Interfaz: jugador y nivel, créditos de prueba, misión activa, aviso de interacción, mapa interactivo con destino, pasaporte (resumen, logros, movimientos), tablero de las diez misiones, armario y ajustes.
- Tutorial de la primera vez (caminar, cámara, interactuar, mapa), omitible y repetible.
- Controles de computadora (teclado + mouse) y táctiles (joystick, arrastre de cámara, botones).
- Tres calidades gráficas más modo automático que baja un nivel si el equipo no alcanza.
- Pestaña en el panel (menú lateral y menú móvil), apertura a pantalla completa, salida y cierre al cambiar de sección.

### Implementado, pendiente de pruebas
- **Teléfonos y tabletas reales.** Los controles táctiles se probaron en emulación de iPhone dentro de Chrome, no en dispositivos físicos. Falta probar iPhone/iPad (Safari) y Android de gama media y baja.
- **Rendimiento real.** Las pruebas corren con render por software, que no representa a una GPU. Falta medir cuadros por segundo en equipos reales y ajustar las calidades.
- **Tipografía Outfit dentro de los letreros 3D** (en el entorno de pruebas no hay acceso a Google Fonts; se usó la fuente de respaldo).
- Rombos de interacción, encuadre del espejo y transiciones en pantallas muy angostas (menos de 340 px).

### Planeado (siguientes fases)
- Fase 2: multijugador (salas, avatares visibles, mensajes flotantes moderados, invitaciones y grupos).
- Fase 3: misiones validadas en servidor, créditos reales, XP e historial persistentes entre dispositivos.
- Fase 4: los otros 9 avatares, tienda, inventario y personalización. Sus apariencias base ya están en `characters/catalog.js`.
- Fase 5: las otras 9 misiones. Sus edificios ya existen en la ciudad con el letrero «Próximamente».
- Fase 6: habitación decorable, eventos, vehículos, fotografía, rutas y rangos del pasaporte.
- Sonido y música.

### Requiere infraestructura adicional
| Necesidad | Para qué | Dónde |
|---|---|---|
| Endpoint `POST /api/ciudad/missions/complete` | Validar la misión en servidor (con `bank-credit-logic.js`) y acreditar una sola vez. | Backend `icadem-webhook` (Railway) |
| Colecciones `ciudad/{uid}` en Firestore + reglas | Avatar, inventario, XP, logros, misiones: que el avance siga al usuario entre dispositivos. | Firestore |
| Servicio WebSocket autoritativo | Salas de 10–20 jugadores, validación de movimiento e interacciones. | Servicio nuevo en Railway |
| Moderación del chat | Filtro de contenido, límites, bloqueos, reportes y panel de moderación. | Backend + `vip-admin.html` |
| Panel administrativo del juego | Recompensas configurables, activar/desactivar misiones, revisar créditos entregados. | `vip-admin.html` + backend |
| Entorno de pruebas de créditos | Probar acreditación sin tocar saldos reales. | Proyecto Firebase de pruebas |

## 4. Créditos: cómo quedó protegida la cartera

- El juego corre con `TestEconomy`: créditos **de prueba**, guardados en `localStorage` bajo `ciudad-icadem:prototipo:v1`, etiquetados como tales en toda la interfaz.
- El código del juego no hace ninguna llamada de red y no puede leer el token de sesión. Una prueba automática lo verifica en cada archivo.
- El panel solo le pasa al juego el nombre visible del usuario (mensaje `ciudad:identity`, mismo origen).
- `IcademWalletEconomy` existe como contrato pero lanza error si se usa. Se activa hasta la Fase 3, cuando el backend valide.
- No se creó ninguna moneda nueva: en producción la recompensa se sumará a los créditos ICADEM existentes.

## 5. Multijugador: qué quedó listo

- `net/network.js` define el estado que envía cada cliente (`encodeState`), el ritmo de red (10 Hz, independiente de los cuadros por segundo) y la interfaz del adaptador.
- El ciclo del juego ya produce ese estado en cada paso (`StateSync`), hoy contra un `OfflineAdapter` que no envía nada.
- El avatar y los NPC usan el mismo esqueleto, así que un jugador remoto es otra instancia de `createAvatar`.
- **No hay jugadores simulados.** Los personajes que caminan por la ciudad son NPC sin nombre de usuario.

## 6. Cómo probar

```bash
node --test test/*.test.cjs          # 225 pruebas: 216 existentes + 9 de Ciudad ICADEM
node scripts/verify-static.js
node scripts/verify-release-contracts.js

# Prueba en navegador real (opcional): requiere Playwright y Chrome
python3 -m http.server 8765 &
node scripts/ciudad-e2e.cjs http://127.0.0.1:8765
```

Parámetros útiles de `ciudad/index.html`: `?scene=room|plaza|bank`, `?autostart=1`, `?tutorial=0`, `?debug=1` (expone `window.__ciudad` para las pruebas; solo afecta datos de prueba locales).

En producción el juego solo arranca incrustado en el panel; si alguien abre `ciudad/index.html` directo, ve un botón que lo lleva a su panel. No es una medida de seguridad (el prototipo no maneja datos reales), solo mantiene la experiencia dentro de ICADEM. Compatibilidad mínima: navegadores con WebGL y módulos ES (Chrome/Edge/Firefox actuales, Safari y iOS 15 o posterior).

Nota: `scripts/verify-account-deletion-flow.js` y `scripts/verify-marketing-admin.js` ya fallaban en `main` antes de este cambio; no se tocaron.

## 7. Al publicar cambios del juego

1. Subir la versión de `CACHE` en `sw.js` (el service worker guarda los módulos del juego).
2. Subir el `?v=` de `js/icadem-ciudad.js` / `css/icadem-ciudad.css` en `vip-panel.html` y `sw.js` si cambiaron.
3. Correr las pruebas de la sección 6.
4. Registrar el cambio en `CAMBIOS.md`.

## 8. Etapa 2 · rama `feature/ciudad-icadem` (sin publicar)

### 8.1 Entorno de trabajo aislado
- Rama `feature/ciudad-icadem`, creada desde `origin/main` (`7de7e53`, que ya incluye el PR #33 del otro agente).
- Carpeta física propia mediante `git worktree`; la carpeta original (`main`) no se tocó ni se cambió de rama.
- Antes de empezar no había cambios sin confirmar ni la rama `feature/perfiles-foro-notificaciones` en el remoto.
- Sin base de datos: esta etapa no ejecuta migraciones ni escribe en Firestore. El servidor multijugador guarda todo en memoria y solo corre en local.
- Archivos tocados: únicamente `ciudad/`, `_ciudad-server/`, `test/ciudad-*.test.cjs`, `scripts/ciudad-*.cjs` y este documento. **No se modificó** `vip-panel.html`, `sw.js`, `CAMBIOS.md`, ni nada de Directorio, Currículum, Foro, perfiles, fotografías o notificaciones.

### 8.2 Qué cambió

| Área | Cambio | Archivos |
|---|---|---|
| Cámara | Brazo retráctil: nunca entra a un edificio ni cruza el límite de un interior; junto a un muro sube en vez de meterse en el avatar. Lo que queda entre cámara y jugador (árboles, faroles, columnas, muebles, muros) se vuelve translúcido. Giro suavizado (mouse y dedo), seguimiento vertical amortiguado, regreso gradual tras un encuadre. | `core/camera.js`, `core/collision.js` (`segmentHit`), `world/kit.js` (`CUTOUT`) |
| Movimiento | Aceleración y frenado, velocidad real tras chocar (no "camina en su lugar"), salto con margen, aterrizaje, paso ligado a la distancia y mezcla continua caminar↔correr. Gestos nuevos: llamar, aplaudir, señalar, pedir ayuda. | `main.js`, `characters/avatar.js` |
| Motor de misiones | Definición declarativa (id, edificio, dificultad, objetivos, acciones con condición, evaluación, recompensa), intento con bitácora, `replay()` para validar, registro, reintentos y recompensa única. Importes por dificultad (10–15 / 20 / 25) y configurables. | `missions/engine.js`, `missions/controller.js` |
| Banco | La misión migra al motor. Paso nuevo: **computadora con simulador de crédito** (calcular las tres propuestas antes de usar el tablero). | `missions/bank-credit*.js`, `world/bank.js` |
| Social | Seis frases rápidas con gesto y burbuja sobre el avatar (teclas 1–6, tecla T o botón). Lista cerrada: no hay texto libre. | `social/phrases.js`, `ui/social.js` |
| Multijugador | Servidor de sesiones (instancias de 16, una sesión por usuario, validación de movimiento, visibilidad por escenario, habitación privada, frases con límite y alcance, reportes, reconexión con lugar reservado 30 s). Cliente con reconexión automática, latencia, jugadores remotos interpolados, nombres, silenciar y reportar. | `_ciudad-server/`, `net/ws-adapter.js`, `characters/remote.js` |

### 8.3 Estado de cada función

**IMPLEMENTADA Y PROBADA** (en Chrome real sin tarjeta gráfica; ver 8.4)
- Cámara: 608 posiciones alrededor de los 11 edificios y 96 dentro del banco, sin quedar dentro de un muro ni pegada al avatar.
- Movimiento, colisiones, salto, animaciones, entrada a edificios, NPC e interacciones.
- Misión «El crédito correcto» de principio a fin con el simulador; reintento; fallo; recompensa única.
- Motor de misiones (orden de pasos, bitácora, validación, registro, recompensa configurable).
- Frases rápidas con gesto en computadora, tablet y celular.
- Controles táctiles en tablet (vertical y horizontal) y celular (vertical y horizontal): dentro de pantalla y sin encimarse.
- Multijugador **en local**: dos navegadores reales (computadora + celular) en la misma instancia, movimiento y animación sincronizados, frases, silenciar, habitación privada, caída y reconexión del servidor.
- Servidor: rechazo de movimientos imposibles, límite de frases, origen permitido, token inválido, sesión duplicada.

**IMPLEMENTADA PARCIALMENTE**
- **Multijugador.** Funciona en local con identidades de prueba. Falta: verificar el token real de ICADEM, desplegar el servicio y probar carga (10–20 jugadores). En producción el juego sigue sin red: el multijugador solo se activa con `?mp=ws://127.0.0.1:…` en `localhost`.
- **Validación de misiones en servidor.** El servidor ya reproduce la bitácora (`verify`) y rechaza la que se salta pasos, pero no acredita nada. Falta conectarlo a la cartera.
- **Moderación.** Hay lista cerrada de frases, límite de envío, silenciar y reportar (el reporte se guarda en memoria del servidor). Falta panel de moderación, bloqueo persistente por cuenta y restricciones por edad.
- **Persistencia.** El progreso se guarda en el dispositivo. El motor ya usa un adaptador (`progress`) listo para el backend, pero el guardado entre dispositivos no existe todavía.
- **Calidad visual.** Mejoró lo que estorbaba la vista y el interior del banco (computadora). Fachadas, vegetación e iluminación de la ciudad siguen como en la Fase 1.
- **Pasaporte, rangos y logros**: funcionan con lo que hay (1 misión, 4 logros).

**PENDIENTE**
- Los otros 9 juegos (sus edificios siguen con «Próximamente»). El motor está listo para recibirlos.
- Los otros 9 avatares, tienda, inventario y skins.
- Amigos, invitaciones, grupos de 2 a 4, sala de espera y misiones cooperativas.
- Chat de texto libre (no se activa sin filtro y moderación funcionando).
- Créditos reales de ICADEM, panel administrativo del juego, habitación personalizable, eventos, sonido.
- Pruebas en teléfonos y tabletas físicos y medición de rendimiento con GPU real.

### 8.4 Pruebas ejecutadas

| Batería | Resultado |
|---|---|
| `node --test test/*.test.cjs` | 250/250 (15 son de Ciudad ICADEM; el resto, del panel, sin cambios) |
| `node scripts/ciudad-e2e.cjs` · juego en computadora | 39/39 |
| `node scripts/ciudad-e2e.cjs` · tablet y celular | 12/12 |
| `node scripts/ciudad-e2e.cjs` · integración con el panel (escritorio y celular) | 16/16 |
| `node scripts/ciudad-mp-e2e.cjs` · dos jugadores | 16/16 |
| `scripts/verify-static.js`, `scripts/verify-release-contracts.js` | OK |

```bash
# Sitio en local
python3 -m http.server 8765 &
# Servidor multijugador de PRUEBA (una vez: cd _ciudad-server && npm install)
node _ciudad-server/server.js            # ws://127.0.0.1:8787
# Dos pestañas, dos jugadores:
#   http://127.0.0.1:8765/ciudad/index.html?scene=plaza&mp=ws://127.0.0.1:8787&uid=ana&name=Ana
#   http://127.0.0.1:8765/ciudad/index.html?scene=plaza&mp=ws://127.0.0.1:8787&uid=beto&name=Beto
node scripts/ciudad-mp-e2e.cjs http://127.0.0.1:8765      # arranca su propio servidor de prueba
ONLY=juego|dispositivos|panel node scripts/ciudad-e2e.cjs http://127.0.0.1:8765
```

Límite de estas pruebas: tablet y celular son emulación táctil en Chrome, no dispositivos físicos; el render es por software, así que no miden cuadros por segundo reales.

### 8.5 Cómo integrar esta rama

1. Esperar a que el otro agente integre `feature/perfiles-foro-notificaciones` (o integrar esta primero: no comparten archivos).
2. `git fetch && git rebase origin/main` sobre esta rama (no debería haber conflictos: aquí no se tocan archivos compartidos).
3. **En el momento de integrar**, y solo entonces, tocar dos archivos compartidos:
   - `sw.js`: subir `CACHE` un número (el service worker guarda los módulos del juego; sin esto, quien ya entró seguiría con los módulos viejos).
   - `ciudad/index.html`: `js/main.js?v=1` → `?v=2` y `css/ciudad.css?v=1` → `?v=2`.
4. Correr la sección 8.4 y registrar la entrada en `CAMBIOS.md`.
5. Hacer el merge a `main` = publicar (GitHub Pages despliega solo). **Esta rama no se ha integrado a `main` a propósito.**

`_ciudad-server/` empieza con guion bajo para que GitHub Pages no lo publique como parte del sitio. No es parte del sitio estático: es un servicio aparte.

### 8.6 Riesgos técnicos
- **Recorte translúcido en celulares de gama baja**: añade un cálculo por píxel a los materiales. Barato, pero falta medirlo en equipos reales; se puede apagar con `CUTOUT.radius = 0`.
- **Servidor en memoria**: un reinicio saca a todos (se reconectan solos, probado). Para varias réplicas haría falta estado compartido.
- **Identidad**: el modo de prueba confía en el nombre del token; el servidor se niega a arrancar en producción hasta tener el verificador real.
- **Posición no simulada en servidor**: se valida velocidad, saltos y límites del mapa, no las colisiones con edificios.
- **Node ≥ 22.7 en el servidor**: comparte módulos con el cliente (`ciudad/js`) sin empaquetar.
- **Una sola misión**: el motor está validado con un juego; al sumar el segundo pueden aparecer ajustes al contrato.

## 9. Etapa 3 · identidad del multijugador y Tribunal ICADEM (rama `feature/ciudad-icadem`, sin publicar)

Mismo aislamiento que en 8.1: worktree propio, sin tocar `main`, `sw.js`, `vip-panel.html`, `CAMBIOS.md` ni módulos del panel.
Nada se desplegó y no hay economía real: todo corre en local con créditos de prueba.

### 9.1 Multijugador: quién es quién lo decide el servidor

| Tema | Antes (sección 8) | Ahora |
|---|---|---|
| Identidad | El navegador mandaba `test:<uid>:<nombre>` y el servidor lo creía. | El socket **solo** acepta un boleto firmado (HMAC-SHA256), de 60 s y un solo uso. Lo que el navegador escriba como nombre o identificador se ignora. |
| Quién emite el boleto | — | `POST /ticket` con el token de sesión de ICADEM (Firebase), verificado con firma RS256, proyecto, emisor y vigencia. En pruebas, `POST /dev/ticket`, que solo responde a la misma máquina. |
| Autorización | — | Gancho `authorize(identidad)` antes de emitir el boleto (para exigir membresía activa cuando se conecte). |
| Reconexión | Reentraba con el mismo texto. | Pase de reanudación firmado, de un solo uso, renovado cada minuto. Vencido → se pide boleto nuevo. |
| Suplantación | Bastaba conocer el `uid`. | El identificador público se deriva en el servidor; una cuenta = una sesión (la nueva sustituye a la anterior). |
| Movimiento | Velocidad y límites del mapa. | Además: los cambios de escenario solo por escenarios contiguos y llegando a una puerta. |
| Límites | 40 mensajes/s por conexión; 3 frases cada 8 s. | Además, tope por tipo de acción (estados 25/s, reportes 5/min, operaciones de sala 12/min, validaciones 6/min) y 20 boletos/min por dirección. |
| Salas privadas | Solo la habitación. | Salas de espera con código de invitación; el Tribunal es «de sala»: solo se ven y se hablan quienes comparten sala. |
| Orígenes | Opcional. | Obligatorio fuera del modo de prueba (HTTP y socket). |

Sigue igual: sin chat libre (seis frases predefinidas), silenciar y reportar.

Flujo previsto en producción (no activado): el panel, que ya tiene la sesión, pide el boleto y se lo pasa al juego; el juego nunca recibe el token de sesión.

### 9.2 Tribunal ICADEM · «Tú eres el juez»

- **Escenario** (`world/court.js`): sala de audiencias con estrado, estrado de testigos, secretaría con expedientes, mesa de pruebas, mesas de las partes, barandilla, bancas del público, emblema, estandartes, ventanales y candiles. Diez NPC. La fachada del edificio ganó frontón, balanza y estandartes, y ya tiene entrada.
- **Caso** (`missions/court-judge-logic.js`): expediente ficticio «Ríos vs. Salgado», devolución de un depósito de arrendamiento. Cinco pruebas, dos partes con abogado, dos testigos, tres objeciones, dos contradicciones reales entre tres declaraciones consistentes.
- **Mecánica** (`missions/court-judge.js`): pedir el expediente → leer antecedentes → examinar las pruebas en la mesa → subir al estrado → abrir la audiencia → dar la palabra a cada parte → llamar testigos (interrogatorio, contrainterrogatorio y preguntas propias) → resolver objeciones al momento (si se admite, el testigo no contesta) → confrontar declaraciones con pruebas → valorar cada prueba → dictar resolución con fundamentos → retroalimentación.
- **Calificación** (100): investigación 10 · objeciones 15 · contradicciones 20 (marcar una inexistente resta) · valoración 20 · resolución 25 · fundamentos 10. Se aprueba con 70.
- **Recompensa**: 20 créditos de prueba la primera vez (dificultad intermedia), después solo XP.
- No es asesoría jurídica ni reproduce un procedimiento real; se indica dentro del juego.

### 9.3 Un motor, dos juegos

| Pieza | Banco | Tribunal | Compartido |
|---|---|---|---|
| Reglas y evaluación | `bank-credit-logic.js` | `court-judge-logic.js` | Contrato de `engine.js` (`defineMission`) |
| Estados, orden de pasos, bitácora, validación | — | — | `MissionRun`, `replay` |
| Registro, reintentos, recompensa única | — | — | `MissionService` |
| Rastreador, cierre, pantalla de resultado | — | — | `MissionController` |
| Diálogos, ventanas, hoja de opciones | — | — | `ui.js` (`dialog`, `modal`, `choice`) |
| Guardado | — | — | adaptador `progress` (hoy en el dispositivo) |
| Lo propio | simulador de crédito, tablero | estrado, objeciones, confrontación | — |

Agregar el tercer juego = un archivo de reglas, un controlador con lo propio y su escenario.

### 9.4 Modo cooperativo del Tribunal (preparado, no activo)

- Roles: Juez, Abogado A, Abogado B, Testigo (`net/scenes.js`).
- El servidor crea salas con código, valida roles únicos, «listo», anfitrión, mínimo de jugadores y que haya juez. Si el anfitrión sale, la sala pasa a otro miembro.
- Pantalla de sala de espera en el tablero «Audiencia en equipo» dentro del Tribunal.
- **Iniciar la audiencia en equipo responde «en desarrollo»**: la audiencia cooperativa no existe todavía y no se simula. Sin servidor (producción hoy), la pantalla lo dice.

### 9.5 Estado

**IMPLEMENTADA Y PROBADA**
- Tribunal individual completo: acierto (100), fallo y repetición sin duplicar créditos.
- Banco sin cambios de comportamiento, sobre el mismo motor.
- Hoja de opciones para decisiones sin tapar el escenario.
- Boletos firmados, verificación del token de sesión (con llaves generadas en la prueba), reanudación, sustitución de sesión, validación de transiciones, topes por acción.
- Salas privadas y sala de espera con roles, en pruebas unitarias, con socket real y con dos navegadores.

**IMPLEMENTADA PARCIALMENTE**
- **Identidad real**: el verificador está escrito y probado con llaves locales; **no** se ha probado contra el proyecto real ni está desplegado. El panel todavía no pide ni entrega boletos.
- **Autorización por membresía**: existe el gancho; no está conectado.
- **Modo cooperativo**: sala de espera y roles sí; audiencia en equipo no.
- **Calidad visual**: Tribunal (interior y fachada) y la interfaz de audiencia. Plaza, vegetación e iluminación general siguen como estaban.
- **Moderación**: los reportes siguen en memoria del servidor.

**PENDIENTE**
- Audiencia cooperativa jugable; los otros 8 juegos; 9 avatares; tienda e inventario; amigos e invitaciones desde las conexiones de ICADEM; chat libre; créditos reales; progreso entre dispositivos; panel administrativo; sonido.
- Despliegue del servidor, pruebas de carga y pruebas en dispositivos físicos.

### 9.6 Pruebas

| Batería | Resultado |
|---|---|
| `node --test test/*.test.cjs` | 312/312 (22 de Ciudad ICADEM; el resto, del panel, incluidas las nuevas del otro agente) |
| `ONLY=juego node scripts/ciudad-e2e.cjs` (Banco y ciudad, computadora) | 39/39 |
| `ONLY=tribunal node scripts/ciudad-e2e.cjs` (tres audiencias completas) | 19/19 |
| `ONLY=dispositivos node scripts/ciudad-e2e.cjs` (tablet y celular, emulación táctil) | 15/15 |
| `ONLY=panel node scripts/ciudad-e2e.cjs` (integración con el panel) | 16/16 |
| `node scripts/ciudad-mp-e2e.cjs` (dos navegadores: computadora + celular emulado) | 28/28 |

La rama ya incluye lo último de `main` (merge sin conflictos el 2026-11-10; no comparte archivos con el otro agente) y todas las baterías se corrieron así.
Tablet y celular son **emulación táctil en Chrome**, no dispositivos físicos. El render es por software: no mide cuadros por segundo reales.

### 9.7 Para integrar (cuando se autorice)
Igual que 8.5: al momento del merge, subir `CACHE` en `sw.js` y el `?v=` de `ciudad/index.html`. Además, para activar el multijugador real: desplegar `_ciudad-server` con `CIUDAD_AUTH=firebase`, `CIUDAD_FIREBASE_PROJECT`, `CIUDAD_TICKET_SECRET` y `CIUDAD_ORIGINS`, y hacer que el panel pida el boleto y lo entregue al juego.

### 9.8 Riesgos
- El verificador de identidad no se ha ejercitado con tokens reales (rotación de llaves de Google, reloj del servidor).
- El secreto de boletos vive en una variable de entorno; con varias réplicas todas deben compartirlo, y los boletos usados se recuerdan en memoria por réplica.
- Al reconectar, el primer estado solo se valida contra el mapa (para no castigar a quien caminó sin red): permite un salto por reconexión.
- Un caso con una sola resolución «mejor» se aprende rápido; harán falta más expedientes para rejugarlo.
- El Tribunal suma ~270 llamadas de dibujo con diez personajes: falta medirlo en celulares reales.

## 10. Etapa 4 · social, avatares y progreso en servidor (rama `feature/ciudad-icadem-social`, sin publicar)

Worktree propio, rama creada desde `main` después del PR #36. Sin merge, sin despliegue, sin escrituras en la base de datos de producción.

### 10.1 Autenticación del multijugador: qué hay y qué falta

Cadena de identidad (nada depende de lo que diga el navegador):

1. El panel ya tiene la sesión del usuario (Firebase, proyecto `icadem-vip`).
2. `js/icadem-ciudad.js` pide un boleto: `POST {servidor}/ticket` con `Authorization: Bearer <token de sesión>`. Solo lo hace si existe `window.ICADEM_CIUDAD_SERVER` (https). **Hoy nadie la define: en producción el juego sigue sin red.**
3. El servidor verifica el token (firma RS256 con las llaves públicas de Google, proyecto, emisor, vigencia), consulta `authorize()` y emite un boleto firmado de 60 s y un solo uso.
4. El panel entrega al juego **solo el boleto** (el token de sesión nunca entra al juego).
5. El socket acepta el boleto; el nombre, el avatar y el progreso salen del servidor.

| Punto | Estado |
|---|---|
| Boletos firmados, un solo uso, reanudación, sesión única, anti-teletransporte, topes | Probado (unitarias, socket real y dos navegadores) |
| Verificador del token de sesión | Probado con llaves generadas en la prueba. **No probado con tokens reales**: desde este entorno no hay salida a `googleapis.com` |
| Entrega panel → juego | Escrita; verificada solo por contrato estático. Falta la prueba de extremo a extremo con sesión real |
| `authorize()` (membresía activa) | Gancho listo; sin conectar |
| Servidor público | **No desplegado.** No debe desplegarse hasta cerrar los tres puntos anteriores |

Variables de entorno del servidor (valores fuera del repositorio):

| Variable | Para qué |
|---|---|
| `CIUDAD_AUTH=firebase` | Modo real. En `test` el servidor solo escucha en la misma máquina y se niega a arrancar con `NODE_ENV=production` |
| `CIUDAD_FIREBASE_PROJECT=icadem-vip` | Proyecto contra el que se validan los tokens |
| `CIUDAD_TICKET_SECRET` | Secreto de firma de boletos, 32+ caracteres aleatorios. Secreto |
| `CIUDAD_ORIGINS` | Orígenes permitidos, p. ej. `https://www.icademx.com` |
| `PORT`, `HOST` | Los pone la plataforma |
| `CIUDAD_DATA_DIR` | Solo pruebas: carpeta para guardar perfiles en archivos |

Servicios nuevos que harían falta: un servicio Node (≥ 22.7) con WebSocket, y un adaptador de almacenamiento sobre la base de datos (pendiente de autorización). En el panel: definir `window.ICADEM_CIUDAD_SERVER` (cambio compatible de una línea, a proponer cuando se autorice).

Moderación revisada: sin chat libre; seis frases; tope 3 cada 8 s; silenciar (local); reportar (se guarda en memoria del servidor, máx. 500). Falta persistir reportes y un panel para revisarlos.

### 10.2 Amigos y equipos
- **Fuente de las conexiones**: `connections(uid)` en el servidor. En producción debe consultarlo el backend de ICADEM (contrato: recibe un usuario autenticado y devuelve los identificadores con los que tiene conexión aceptada). **No se tocó el Directorio Profesional**; en pruebas se declaran con `/dev/connect`.
- Solo se muestran conexiones **mutuas** que están en la ciudad; de los demás no se revela nada.
- Invitar → aceptar o rechazar (caduca en 60 s, una respuesta, tope 6/min) → mismo equipo y misma instancia (el invitado se cambia de ciudad si hay lugar).
- Equipos de 2 a 4; el equipo puede elegir misión sin deshacerse; el anfitrión puede reunir a todos en la plaza.

### 10.3 Avatares y equipamiento
- Los diez avatares aprobados comparten esqueleto y animaciones; cada uno tiene apariencia propia (nuevos accesorios: gorro de chef, casco, estetoscopio, toga).
- Se desbloquean jugando (`progress/rules.js`): misiones, nivel o exploración. No se compran y ninguno da ventaja.
- Equipamiento: color del atuendo (7) y sombrero (4). Se ve en los demás jugadores.
- Con conexión, el servidor decide si un avatar está desbloqueado; el que anuncie el cliente se ignora.

### 10.4 Progreso entre dispositivos
- `_ciudad-server/profiles.js`: perfil por usuario autenticado (misiones, XP, logros, edificios, tutorial, avatar, equipamiento, créditos **de prueba**).
- El cliente envía acciones (bitácora de misión, edificio descubierto, avatar elegido); el servidor recalcula y guarda. XP, logros y recompensas no se aceptan del cliente.
- Recompensa única aunque dos dispositivos cierren la misión a la vez.
- Almacenamiento por interfaz: memoria y archivos JSON (pruebas). **El adaptador de la base real no está hecho**: requiere autorización.
- Sin conexión (producción hoy) todo sigue guardándose en el dispositivo, como antes. La cartera real no se toca en ningún caso.

### 10.5 Mundo
Plaza: banderines entre faroles, ocho jardineras, botes, carrito de aguas frescas, aves y hojas en el aire. Fachadas, iluminación general y transiciones siguen como estaban.

### 10.6 Fase futura registrada: Ciudad ICADEM Living
Casas ampliables, propiedades, muebles, vehículos, estudios, tiendas, skins y compras opcionales. **No implementada**; solo queda anotada.

### 10.7 Pruebas
| Batería | Resultado |
|---|---|
| `node --test test/*.test.cjs` | 334/334 (27 de Ciudad ICADEM) |
| Dos navegadores (computadora + celular emulado; al final, un tercero como "otro dispositivo") | 38/38 |
| Banco y ciudad (computadora) | 39/39 |
| Tribunal (computadora) | 19/19 |
| Tablet y celular | 15/15 |
| Integración con el panel (escritorio y celular) | 16/16 |

Todas las pruebas de tablet y celular son **emulación táctil en Chrome con render por software**. **No se hizo ninguna prueba en dispositivos físicos.**

### 10.8 Riesgos
- Lo más importante: la identidad real no se ha probado contra el servicio real. Hasta entonces el servidor no debe hacerse público.
- La fuente de conexiones depende de un servicio del backend que hay que acordar; hoy no existe ese contrato.
- Sin adaptador de base de datos, el progreso en servidor solo existe en pruebas.
- Al conectarse, el progreso del servidor sustituye al local: quien ya jugó sin conexión no lo "sube" (decisión de seguridad; habrá que avisarlo o migrarlo de forma controlada).
- La plaza subió a ~230 llamadas de dibujo; falta medir en celulares reales.

## 11. Despliegue del servidor de sesiones en Railway (preparado; pendiente de ejecutar)

Decisión: el servidor va como **servicio nuevo dentro del proyecto `content-spirit`, entorno `production`**, construido desde la rama `feature/ciudad-icadem-social`. No se toca `icadem-webhook` ni se crea un entorno nuevo (duplicaría sus crons y correos). La guía completa de activación (Railway, variables, Firebase, pruebas, costos y fases) está en el documento de la auditoría; aquí queda el resumen técnico.

### 11.1 Cómo se integra con ICADEM (sin modificar el backend)
`_ciudad-server/icadem.js` usa la **misma cuenta de servicio de Firebase** que el backend, en modo lectura:

| Dato | De dónde | Regla |
|---|---|---|
| Identidad | Token del panel, `verifyIdToken(token, true)` (revisa sesiones revocadas y cuentas deshabilitadas) | Igual que el backend |
| Nombre | `directorio/{uid}` (`nombrePersonalizado` o `nombre`); si no, el del token | Solo lectura |
| Acceso | **Cuentas gratuitas y VIP.** Se rechazan: cuentas en `_accountDeletions` (salvo cuenta recreada después), `CIUDAD_BLOCKED_UIDS` y, en piloto, quien no esté en `CIUDAD_PILOT_EMAILS` (los `CIUDAD_ADMINS` siempre entran) | Solo lectura |
| VIP | `miembros/{uid}` con las mismas reglas que `membresiaActiva()` del backend; solo se marca, no limita | Solo lectura |
| Conexiones | `professionalConnections` donde `participants` contiene al usuario y `status === 'accepted'` | Solo lectura; misma consulta que el backend, sin índice nuevo |
| Progreso del juego | `ciudadProfiles/{uid}` (colección **nueva**), en transacción con control de versión | Solo si `CIUDAD_PROFILES=firestore`; **requiere autorización** y la regla `_ciudad-server/firestore.ciudad.rules.fragment` |

Nunca lee ni escribe `credits`, Stripe, notificaciones, foro ni `professionalProfiles` (hay prueba que lo vigila).

### 11.2 Pasos (los hace quien tenga acceso a Railway)
1. GitHub → Railway App → Repository access: incluir `teccapitalweb/ICADEM`.
2. `content-spirit` (entorno `production`) → **New → GitHub Repo → `teccapitalweb/ICADEM`**, rama `feature/ciudad-icadem-social`.
3. Settings: Root Directory vacío; Watch Paths `/_ciudad-server/**` y `/ciudad/js/**`; Healthcheck `/health`; **1 réplica**; Replica Limits 0.5 vCPU / 512 MB; sin Start Command; Serverless apagado en el piloto. **No se usa `railway.json`** (Config as Code ya no se admite en servicios nuevos).
4. Variables:

| Variable | Valor |
|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `_ciudad-server/Dockerfile` |
| `CIUDAD_TICKET_SECRET` | 32+ caracteres nuevos (`openssl rand -hex 32`), sellada; no reutilizar otros secretos |
| `CIUDAD_ORIGINS` | `https://www.icademx.com,https://icademx.com` |
| `FIREBASE_SERVICE_ACCOUNT` | referencia `${{icadem-webhook.FIREBASE_SERVICE_ACCOUNT}}` |
| `CIUDAD_PILOT_EMAILS` | correos del piloto (vacío = abierto a todas las cuentas válidas) |
| `CIUDAD_ADMINS` | correos de administradores del juego |
| `CIUDAD_MAX_PLAYERS` | `64` (2–500) |
| `CIUDAD_PROFILES` | vacío hasta autorizar `ciudadProfiles`; entonces `firestore` |
| `CIUDAD_BLOCKED_UIDS` | opcional |

`CIUDAD_AUTH=firebase`, `CIUDAD_TRUST_PROXY=1` y `NODE_ENV=production` ya vienen en la imagen. No poner `PORT`, `HOST`, `CIUDAD_DATA_DIR` ni variables del backend.

5. Networking → Generate Domain. Anotar la URL.
6. **Comprobar sin sesión:** `node scripts/ciudad-server-check.cjs https://<url>` → 11/11.
7. **Comprobar con sesión real** desde la consola de www.icademx.com: `window.__auth.currentUser.getIdToken().then(t => fetch('https://<url>/ticket', {method: 'POST', headers: {Authorization: 'Bearer ' + t}})).then(r => console.log(r.status))` → `200` con cuenta gratuita o VIP del piloto; `403` fuera del piloto.
8. Solo entonces, con autorización: `CIUDAD_SERVER_URL` en `js/icadem-ciudad.js`, `?v=3` en `vip-panel.html`, `sw.js` y `ciudad/index.html`, y `CACHE` nuevo en `sw.js`.

### 11.3 Qué queda sin probar hasta desplegar
- Tokens reales y lectura real de `miembros`, `directorio`, `_accountDeletions` y `professionalConnections` (aquí se probó con Firebase simulado con la misma forma de datos).
- El despliegue real en Railway, la latencia y el comportamiento con 10–20 jugadores.
- Teléfonos físicos (solo tamaños emulados).
- Sin `CIUDAD_PROFILES=firestore`, el progreso en servidor se pierde al reiniciar el servicio.
