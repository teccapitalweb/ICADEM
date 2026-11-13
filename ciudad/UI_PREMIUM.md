# Avatar Studio y mapa · capa visual

La interfaz utiliza los personajes, edificios y estados del juego. La ampliación del vestidor añade prendas y accesorios cosméticos reales al modelo existente; no incorpora destinos, monedas ni condiciones de desbloqueo nuevas.

- `js/ui/wardrobe.js` mantiene `openWardrobe`, la selección inicial y `api.setAvatar`. Personajes, Ropa, Accesorios, Cabello y Estilo utilizan el mismo perfil. Búsqueda y disponibilidad filtran personajes. Las miniaturas usan `AvatarPreview`, acercando collares, cabello, sombreros y calzado para distinguir las piezas; su caché está limitada a 128 imágenes y cancela trabajos al cambiar de categoría.
- `js/ui/preview.js` continúa compartiendo el renderizador del juego. Su cámara de vista previa permite acercar y girar; libera las geometrías propias al cambiar de modelo, generar una miniatura o cerrar. Usa `disposeTree` existente para conservar materiales compartidos. No modifica el motor ni el modelo del jugador.
- `js/ui/city-map.js` exporta `createCityMap(ui)` y proyecta `BUILDINGS`, `doorPoint(..., 2.2)` y las dos actividades existentes. El estado completado proviene de la misión cargada. Zoom y desplazamiento sólo transforman el plano; la acción conserva `api.setWaypoint`, sin teletransporte.
- `js/ui/ui.js` conserva la ventana modal, el bloqueo de controles, el cierre y el evento `map-opened`; delega únicamente el contenido del mapa al nuevo módulo.
- `css/avatar-studio.css`, `css/city-map.css` y `css/premium-panels.css` están limitados a `.vest--studio` y `.map--premium`. Las demás ventanas del juego conservan su presentación.

## Ropa y accesorios reales

`js/progress/appearance-catalog.js` contiene el catálogo finito compartido por interfaz, validador y servidor: cinco prendas superiores, cinco inferiores (recto, cargo, acampanado Y2K y dos faldas), cuatro calzados, tres bolsos, cinco sombreros, cinco peinados/pelucas, diez colores de cabello y tres collares nuevos. Son 40 variantes nuevas, además de las opciones anteriores y de volver al aspecto original. Todas estas variantes son gratuitas; no cambian los requisitos de los personajes.

`js/characters/fashion-parts.js` construye las piezas sobre las articulaciones existentes. `avatar.js` sólo incorpora esos puntos de extensión cosméticos. Los 22 modelos sin personalización conservan exactamente geometrías, colores y articulaciones anteriores. Las prendas usan la animación existente y no simulan tela. Se fusionan por material y liberan junto al avatar.

`cleanCustom` admite únicamente identificadores del catálogo. Los siete campos opcionales (`top`, `bottom`, `shoes`, `bag`, `hairStyle`, `hairColor`, `necklace`) se omiten cuando son `base`; los perfiles anteriores siguen teniendo sus tres claves originales y versión 1. El adaptador Firestore existente ya aplica este validador en lectura y escritura; no se cambian colecciones ni reglas.

Los mensajes `profile/avatar` nuevos incluyen `customVersion: 2`: reemplazan la apariencia completa y permiten restablecer piezas. El servidor preserva los campos nuevos omitidos por clientes anteriores y sus sombreros desconocidos, evitando que una pestaña antigua borre el equipamiento nuevo. La selección sigue pasando por `isAvatarUnlocked`, la escritura serializada existente y la difusión de apariencia a los demás jugadores. Primero se despliega este servidor compatible; después la interfaz. Los jugadores necesitan actualizar la página para renderizar las piezas nuevas.

`js/progress/appearance-saves.js` mantiene una sola solicitud cosmética en vuelo y la última selección pendiente. Utiliza el identificador `n` ya devuelto por el servidor para descartar confirmaciones antiguas. `main.js` sigue aplicando el progreso autoritativo, pero conserva la apariencia pendiente hasta su confirmación. Rechazo, desconexión y un plazo de confirmación de 12 segundos liberan la cola; un fallo recupera el último aspecto confirmado y solicita de nuevo el perfil. Esto corrige la carrera preexistente donde una confirmación intermedia podía borrar una pieza elegida rápidamente.

No cambian Store, reglas de Firebase, XP, economía, misiones, colisiones, rig, controles, desbloqueos ni chat. No se modifica `icadem-webhook`.

## Comprobación

`node --test test/ciudad-map-ui.test.cjs test/ciudad-preview-ui.test.cjs` comprueba contratos y liberación de recursos propios sin disponer materiales compartidos.

`node scripts/ciudad-premium-ui-e2e.cjs RUTA_A_PLAYWRIGHT CARPETA_CAPTURAS` sirve el juego local, bloquea peticiones externas y comprueba selección, skins bloqueadas, apariencia, recarga, controles, mapa y ausencia de cambios en XP, misiones o cartera. `ICADEM_UI_SIZES` elige tamaños; `ICADEM_UI_MEMORY=1` mide geometrías y texturas durante cambios repetidos. La prueba detiene temporalmente el bucle del mundo en su fixture para reducir el coste del renderizado por software; la vista previa sigue usando modelos y renderizador reales. No equivale a una sesión en Railway ni a teléfonos físicos.

`node scripts/ciudad-premium-server-e2e.cjs URL_ESTATICA_LOCAL RUTA_A_PLAYWRIGHT CARPETA_CAPTURAS` comprueba por separado el servidor WebSocket local real con almacenamiento JSON temporal: apariencia desde la UI, rechazo de skins bloqueadas, observador Node independiente, reinicio del servidor y contexto nuevo sin datos del navegador. Usa un solo mundo 3D simultáneo. No se necesitan credenciales reales ni se escribe en Railway o Firebase.

`node --test test/ciudad-fashion-contracts.test.cjs test/ciudad-fashion-models.test.cjs` cubre catálogo finito, perfiles adultos/infantiles, persistencia, clientes antiguos/nuevos, rechazo de avatares bloqueados, difusión por WebSocket, equivalencia de los 22 modelos originales, geometrías distintas y articulaciones durante las poses existentes.

`node scripts/ciudad-fashion-e2e.cjs RUTA_A_PLAYWRIGHT CARPETA_CAPTURAS` levanta el juego y servidor WebSocket local reales con almacenamiento JSON temporal, comprueba categorías, prendas equipadas, otro observador, reinicio y nuevo contexto independiente. Compara también las imágenes de los 22 avatares originales contra `3485f05` y renderiza las 50 opciones no-base (incluyen retirar piezas). `ICADEM_FASHION_SIZES` elige tamaños y `ICADEM_TEST_ENGINE=webkit` selecciona WebKit. Los resultados locales no equivalen a una escritura con una cuenta real en Firestore.

## Integración con la expansión

Trabajar desde `main` actualizado. Al ampliar el catálogo, mantener los datos en los módulos actuales: el mapa y el vestidor los leen de ahí. No copiar catálogos paralelos en la interfaz. Si hay conflictos, conservar los cambios funcionales de la expansión y esta delegación visual; no reemplazar `ui.js` completo.

Entrada del juego y puente: `v=12`. Hojas nuevas: `v=1`. Caché del panel: `v179`. La carga resistente a fallos 5xx de Ciudad 1.2 permanece intacta.
