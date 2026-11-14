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

La rama de Claude `feature/ciudad-mundo-vivo` en **ca84ff6** ya contiene `api.vivo`, paneles funcionales, mascotas, tiendas, casa y aguas. La base histórica del inventario es **f43f608**; main publicado **b97c80d** incorpora la UI de PR73 (chat, accesos y Studio), pero no esa expansión 2.0. Este PR72 sigue siendo un borrador aislado. Antes de integrar, revisar las APIs reales y sus límites en [MUNDO_VIVO_UI_CONTRACTS.md](../MUNDO_VIVO_UI_CONTRACTS.md) y el [plan QA](INTEGRATION_QA.md); sustituir los datos y acciones de muestra por contratos aprobados, sin inventar traducciones por nombre. No importar `fixtures.js` ni `demo.js` desde producción.

La carpeta comienza por `_`, por lo que el flujo actual de Jekyll no la publica. No añadirla a `include`. Las pruebas verifican también que ningún archivo de producción la importa.

Las categorías de la tienda se derivan de `catalogs.products[].category`; el catálogo de muestra incluye Ropa, Mascotas, Muebles, Accesorios, Juguetes y Alimentos. Esto no amplía el catálogo real del vestidor ni las categorías de la expansión. El saldo, nivel, XP, recompensas y compras sólo se leen de `model`; su control local está en fixtures. No se cambia la etiqueta ni el funcionamiento de los créditos de prueba existentes.

Prueba local: `node ciudad/_ui-previews/preview.test.cjs RUTA_A_JSDOM` (puede usarse el `jsdom` del entorno de pruebas de UI). Las capturas de este laboratorio se deben identificar siempre como prototipos locales.

Capturas y comprobación de navegador: `node ciudad/_ui-previews/render.cjs RUTA_A_PLAYWRIGHT CARPETA_CAPTURAS`. El script sirve el HTML local, bloquea otros orígenes, usa un navegador por vez y no abre el mundo 3D. Para WebKit, configurar `PLAYWRIGHT_BROWSERS_PATH` al directorio de motores instalado.

## Verificación del kit

- 10/10 pruebas DOM: controles sin callback, confirmación, compra pendiente/cancelada/rechazada, modelo inalterado ante error, inventario/equipamiento sin pérdida, dos flujos de aguas, estado no válido de decoración, feedback posterior a respuesta y cierre del laboratorio durante una operación.
- Chrome 1440×1000, 768×1024 y 390×844; WebKit 390×844. Siete vistas por tamaño, sin desbordamiento horizontal ni errores de JavaScript, compra local confirmada e inventario actualizado. Son 28 composiciones verificadas, más capturas del inventario equipado.
- Revisión visual de escritorio y móvil: mascotas, casa, inventario y panel de preguntas. Los iconos de mascotas y objetos son esquemas SVG de referencia; no representan modelos 3D ya disponibles.
- No se usó una cuenta real, no hubo escrituras en Railway/Firestore y no se probaron dispositivos físicos. Las siete vistas siguen aisladas de la producción.

## Segunda revisión local (13 de noviembre)

Correcciones pequeñas: contraste de textos auxiliares, objetivos de 44 px también en tablet, cierre del diálogo de 44 px en móvil, limpieza de la alerta al cambiar de composición y conservación del scroll horizontal del navegador interno para mantener visible la opción seleccionada. Sin cambios de presentación general ni conexión a servicios.

`qa.cjs` añade revisión de teclado/foco, diálogo, etiquetas, objetivos, overflow y contrastes concretos. La matriz local previa al último ajuste exclusivo de scroll cubrió **56 composiciones**: siete vistas en Chrome y WebKit, 320×740, 390×844, 768×1024 y 1440×1000. Después se verificaron **28 composiciones móviles finales** (14 Chrome y 14 WebKit en 320/390 px), incluida la nueva aserción de que el elemento seleccionado del nav permanece visible. Las capturas y métricas separan esa base de las pasadas finales de navegación. Se revisaron visualmente las siete vistas en móvil. No equivale a una auditoría WCAG completa ni a dispositivos físicos.

`integration-harness.cjs` queda **pendiente de adaptador externo**: sin él sale con PENDIENTE, no certifica backend. Sus pruebas en memoria validan solamente el verificador. No exige CAS a compras atómicas y no exige persistir la correa de paseo; vivienda y ciclo de sesión tienen casos distintos. Ver instrucciones, fuentes reales y puertas pendientes en [INTEGRATION_QA.md](INTEGRATION_QA.md).

Pruebas ejecutadas en esta revisión: **20/20 pruebas finales**, sin omisiones: las diez originales, una regresión de composición y nueve unidades del harness, incluida su salida CLI 2/PENDIENTE sin adaptador. No se ejecutó una integración con la rama de Claude, backend o cuentas reales.

## Última comprobación del verificador

Se conservaron las veinte pruebas anteriores y se añadieron dos regresiones: un contenido nuevo de vivienda con la misma revisión no acredita protección de concurrencia; una confirmación de B con revisión distinta de su lectura autoritativa tampoco acredita éxito. Sólo se exige cambio de revisión cuando la operación declara política de revisión, sin imponerlo a compras atómicas ni al paseo de sesión. Son pruebas del harness con unidades en memoria; no son una integración con Claude.

Resultado de esta última pasada: **22/22 pruebas**, sin omisiones. Las dos regresiones fallaron antes de la corrección y pasaron después. No se repitieron matrices de navegador ni se ejecutó un adaptador de backend.

| Interfaz | Composición local | Contrato de Claude ca84ff6 | Estado de conexión |
| --- | --- | --- | --- |
| Mascotas | Revisada | Servicio y catálogo existentes | Pendiente adaptador aprobado y prueba real |
| Paseo/correas | Revisada | Efímero por sesión; sin pausa canónica | Pendiente mapeo de capacidades y ciclo real |
| Tiendas | Revisada | Compra atómica y rid interno | Pendiente prueba real de repetición/recuperación |
| Inventario | Revisada | Cantidades y acciones por tipo | Pendiente permisos y mapeo real |
| Casa | Revisada | Editor funcional y validación | Pendiente resolver/verificar conflictos de borradores |
| Aguas | Dos flujos revisados | Recetas y compra existentes | Pendiente sustituir pasos y resultados de muestra |
| Diez juegos | Portadas y una pregunta de muestra | Diez contratos nuevos pendientes | No conectar ni publicar como funcional |
