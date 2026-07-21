# CAMBIOS

## 2026-07-20 — Fix: "Recibo de nómina" y "Multi-empleado" rotos (ReferenceError) + causa raíz de `__ensureCfGenerators`

**Archivo:** `vip-panel.html` (sin commitear todavía — cambios en working tree, pendientes de autorización para push)

### 1. `aplicarTablaISR`/`aplicarSubsidio`/`TABLA_ISR_MENSUAL_2026` no eran accesibles entre scripts

**Problema:** están declaradas dentro de `window.__initCalcFiscal` (un `<script>`), y
`window.__initCalcNomina` (otro `<script>` separado) las usaba asumiendo que eran
globales. No lo son: una `const`/`function` local a una función no se filtra a otro
script. Esto rompía por completo las pestañas "Recibo de nómina" y "Multi-empleado"
de la Calculadora de Nómina (`Uncaught ReferenceError: aplicarTablaISR is not
defined`) para todos los usuarios, incluidos VIP.

**Fix:**
- Se exponen `aplicarTablaISR`, `aplicarSubsidio` y `TABLA_ISR_MENSUAL_2026` como
  `window.*` al final de `__initCalcFiscal` (mismo patrón ya usado ahí para
  `window._cfGenerarPDF`/`window._cfGenerarXLS`). Fuente única, sin duplicar la
  tabla ni las funciones dentro de `__initCalcNomina`.
- `calcRecibo()` y `calcMulti()` ahora leen `window.aplicarTablaISR` /
  `window.TABLA_ISR_MENSUAL_2026` / `window.aplicarSubsidio`.
- Se agregó `try/catch` alrededor de la llamada `fn()` en el wiring de los botones
  de la Calculadora de Nómina (`bindings.forEach`), con `Toast.error(...)` si algo
  truena. Red de seguridad adicional — no reemplaza el fix de causa raíz.

### 2. `window.__ensureCfGenerators` era código muerto (nunca se ejecutaba)

**Problema descubierto durante la verificación en vivo del fix anterior:** para
que el escenario "usuario entra directo a Nómina/Crédito sin pasar por Fiscal"
funcionara, el fix de arriba dependía de `window.__ensureCfGenerators()` — una
función preexistente que monta la Calculadora Fiscal en un contenedor invisible
para poblar sus exports. Esa función estaba declarada **después** del `return`
del IIFE `const Sections = (function(){ ... })();` que la contiene, por lo que
nunca se asignaba a `window` (código muerto, sin lanzar error, solo un no-op
silencioso). Esto afectaba, de forma completamente independiente al fix #1, a
los 6 sitios preexistentes que ya dependían de ella: `cfDownloadPDF_externo`,
`cfDownloadXLS_externo`, `ptDownloadPDF`, `ptDownloadXLS`, `ptHistDownloadPDF`,
`ptHistDownloadXLS` — es decir, la descarga de PDF/Excel de la Calculadora de
Crédito también estaba rota en el mismo escenario de entrada directa.

**Fix:** se reubicó la declaración completa de `window.__ensureCfGenerators`
de después del `return {...}` a antes, dentro del mismo IIFE. Sin cambios de
lógica, solo de posición — deja de ser código muerto.

**Verificado en vivo (Chrome, servidor local, sesión nueva cada vez, sin pasar
por Calculadora Fiscal):**
- Recibo de nómina (salario diario 500, 30 días): recibo completo, ISR
  $1,552.78, Neto $13,051.17, consola limpia.
- Multi-empleado (mismo caso, 1 fila): tabla completa, mismos valores,
  consola limpia.
- Calculadora de Crédito → Comparador → "Descargar Excel": sin errores,
  `window._cfGenerarXLS` queda poblado vía `__ensureCfGenerators`.

### Hallazgo relacionado — NO corregido en este cambio

**`doc.autoTable is not a function`** al usar "Descargar PDF" en Fiscal, Nómina
o Crédito (`generarPDF`, `generarReciboPDF`, `generarAmortizacionPDF`). El
archivo carga `jspdf.umd.min.js` pero **nunca carga el plugin
`jspdf-autotable`** — no hay ningún `<script>` para él en todo el HTML. Es un
bug preexistente e independiente de los dos fixes de arriba (afecta también el
flujo normal, vía Fiscal, no solo la entrada directa). Se reporta para
atenderlo aparte; no se tocó en este cambio.

**No tocado (a propósito):** `calcPatronal()`, `calcSDI()` (no dependían del
bug), `UMA_2026`/`SMG_2026` (duplicación ya conocida, fix aparte), herramientas
de laboratorio (código muerto, fuera de alcance), sistema de notificaciones
(pausado, se retoma en su propio commit).
