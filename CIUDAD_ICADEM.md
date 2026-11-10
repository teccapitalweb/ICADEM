# Ciudad ICADEM · arquitectura y estado

Videojuego 3D explorable integrado al panel VIP como la pestaña **Ciudad ICADEM**.
Este documento describe la **Fase 1 (prototipo jugable)** y lo que queda preparado para las siguientes.

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
