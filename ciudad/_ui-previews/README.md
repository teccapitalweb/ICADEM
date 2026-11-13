# Laboratorio visual local · Mundo Vivo

Prototipos de composición de UI-3 a UI-6. **No están integrados en Ciudad ICADEM y no son funcionalidades disponibles.**

Servir el repositorio con un servidor estático local y abrir `/ciudad/_ui-previews/`. No abrir el HTML con `file://`, porque usa módulos. No tiene dependencias externas, red, cuentas, almacenamiento persistente ni recursos 3D.

- Mascotas: tres fichas de muestra y estados de selección/compañía.
- Paseo: equipo, colores y composición del control de paseo; sin movimiento ni correa 3D.
- Tienda: categorías, ficha, confirmación y respuesta del controlador local; saldo de muestra separado, sin dinero real.
- Inventario: artículos adquiridos en el ensayo, equipar/quitar sin perderlos, compras y recompensas de muestra diferenciadas. Nivel, XP y monedas se presentan como magnitudes separadas, siempre suministradas por el modelo de muestra.
- Casa: panel compacto y plano esquemático de muestra; no es un algoritmo de colocación del mundo.
- Aguas: dos composiciones Preparar/Pedir y resultado local de muestra; no son recetas, precios ni interacciones canónicas.
- Juegos: los diez nombres del encargo como portadas de referencia, con iconos y tintes propios. Sólo Carrera del Saber incluye una pregunta de demostración para revisar jerarquía y feedback; no hay diez mecánicas implementadas ni XP.

`views.js` exporta `createVisualLab(host,{model,catalogs,dispatch,initialView})`, `icon(name)` y `catalogCard(...)`. Son componentes locales propuestos, **no contratos técnicos de Claude**. Exige modelo y catálogos explícitos y no importa fixtures. Sin `dispatch`, las acciones de escritura aparecen deshabilitadas. El modelo sólo se sustituye después de una respuesta `{ok:true,model}`; el ejemplo no decide compras ni saldos dentro del renderizador. `fixtures.js` contiene el controlador de muestra, claramente separado.

Para integrar una pantalla futura, acordar primero los contratos de [MUNDO_VIVO_UI_CONTRACTS.md](../MUNDO_VIVO_UI_CONTRACTS.md). Reemplazar el controlador de muestra por la funcionalidad autorizada, conservar estados pendientes/errores y mostrar sólo acciones admitidas. No importar `fixtures.js` ni `demo.js` desde producción.

La carpeta comienza por `_`, por lo que el flujo actual de Jekyll no la publica. No añadirla a `include`. Las pruebas verifican también que ningún archivo de producción la importa.

Las categorías de la tienda se derivan de `catalogs.products[].category`; el catálogo de muestra incluye Ropa, Mascotas, Muebles, Accesorios, Juguetes y Alimentos. Esto no amplía el catálogo real del vestidor ni las categorías de la expansión. El saldo, nivel, XP, recompensas y compras sólo se leen de `model`; su control local está en fixtures. No se cambia la etiqueta ni el funcionamiento de los créditos de prueba existentes.

Prueba local: `node ciudad/_ui-previews/preview.test.cjs RUTA_A_JSDOM` (puede usarse el `jsdom` del entorno de pruebas de UI). Las capturas de este laboratorio se deben identificar siempre como prototipos locales.

Capturas y comprobación de navegador: `node ciudad/_ui-previews/render.cjs RUTA_A_PLAYWRIGHT CARPETA_CAPTURAS`. El script sirve el HTML local, bloquea otros orígenes, usa un navegador por vez y no abre el mundo 3D. Para WebKit, configurar `PLAYWRIGHT_BROWSERS_PATH` al directorio de motores instalado.

## Verificación del kit

- 10/10 pruebas DOM: controles sin callback, confirmación, compra pendiente/cancelada/rechazada, modelo inalterado ante error, inventario/equipamiento sin pérdida, dos flujos de aguas, estado no válido de decoración, feedback posterior a respuesta y cierre del laboratorio durante una operación.
- Chrome 1440×1000, 768×1024 y 390×844; WebKit 390×844. Siete vistas por tamaño, sin desbordamiento horizontal ni errores de JavaScript, compra local confirmada e inventario actualizado. Son 28 composiciones verificadas, más capturas del inventario equipado.
- Revisión visual de escritorio y móvil: mascotas, casa, inventario y panel de preguntas. Los iconos de mascotas y objetos son esquemas SVG de referencia; no representan modelos 3D ya disponibles.
- No se usó una cuenta real, no hubo escrituras en Railway/Firestore y no se probaron dispositivos físicos. Las siete vistas siguen aisladas de la producción.
