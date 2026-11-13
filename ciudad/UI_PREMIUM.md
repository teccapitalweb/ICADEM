# Avatar Studio y mapa · capa visual

La interfaz reutiliza los personajes, colores, sombreros, edificios y estados del juego. Las referencias visuales no incorporan prendas, destinos, monedas ni desbloqueos nuevos.

- `js/ui/wardrobe.js` mantiene `openWardrobe`, la selección inicial y `api.setAvatar`. Búsqueda y disponibilidad filtran la presentación. Las tarjetas y las variantes de estilo usan `AvatarPreview` con los modelos actuales.
- `js/ui/preview.js` continúa compartiendo el renderizador del juego. Su cámara de vista previa permite acercar y girar; libera las geometrías propias al cambiar de modelo, generar una miniatura o cerrar. Usa `disposeTree` existente para conservar materiales compartidos. No modifica el motor ni el modelo del jugador.
- `js/ui/city-map.js` exporta `createCityMap(ui)` y proyecta `BUILDINGS`, `doorPoint(..., 2.2)` y las dos actividades existentes. El estado completado proviene de la misión cargada. Zoom y desplazamiento sólo transforman el plano; la acción conserva `api.setWaypoint`, sin teletransporte.
- `js/ui/ui.js` conserva la ventana modal, el bloqueo de controles, el cierre y el evento `map-opened`; delega únicamente el contenido del mapa al nuevo módulo.
- `css/avatar-studio.css`, `css/city-map.css` y `css/premium-panels.css` están limitados a `.vest--studio` y `.map--premium`. Las demás ventanas del juego conservan su presentación.

No cambian Store, Firestore, reglas, inventario, XP, economía, misiones, red ni contratos. Las opciones que aún no existen, como prendas independientes o animaciones elegibles, no se presentan como controles funcionales.

## Comprobación

`node --test test/ciudad-map-ui.test.cjs test/ciudad-preview-ui.test.cjs` comprueba contratos y liberación de recursos propios sin disponer materiales compartidos.

`node scripts/ciudad-premium-ui-e2e.cjs RUTA_A_PLAYWRIGHT CARPETA_CAPTURAS` sirve el juego local, bloquea peticiones externas y comprueba selección, skins bloqueadas, apariencia, recarga, controles, mapa y ausencia de cambios en XP, misiones o cartera. `ICADEM_UI_SIZES` elige tamaños; `ICADEM_UI_MEMORY=1` mide geometrías y texturas durante cambios repetidos. La prueba detiene temporalmente el bucle del mundo en su fixture para reducir el coste del renderizado por software; la vista previa sigue usando modelos y renderizador reales. No equivale a una sesión en Railway ni a teléfonos físicos.

`node scripts/ciudad-premium-server-e2e.cjs URL_ESTATICA_LOCAL RUTA_A_PLAYWRIGHT CARPETA_CAPTURAS` comprueba por separado el servidor WebSocket local real con almacenamiento JSON temporal: apariencia desde la UI, rechazo de skins bloqueadas, observador Node independiente, reinicio del servidor y contexto nuevo sin datos del navegador. Usa un solo mundo 3D simultáneo. No se necesitan credenciales reales ni se escribe en Railway o Firebase.

## Integración con la expansión

Trabajar desde `main` actualizado. Al ampliar el catálogo, mantener los datos en los módulos actuales: el mapa y el vestidor los leen de ahí. No copiar catálogos paralelos en la interfaz. Si hay conflictos, conservar los cambios funcionales de la expansión y esta delegación visual; no reemplazar `ui.js` completo.

Entrada del juego y puente: `v=11`. Hojas nuevas: `v=1`. Caché del panel: `v178`. La carga resistente a fallos 5xx de Ciudad 1.2 permanece intacta.
