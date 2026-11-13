# Ciudad ICADEM 2.0 — Mundo vivo · contratos técnicos

Este documento es el acuerdo entre la lógica (Claude) y las interfaces (Codex). Las interfaces **no
deciden** precios, premios, permisos ni validaciones: llaman al servicio `api.vivo` y muestran lo que
el servidor confirma. Si una interfaz necesita un dato que no está aquí, se agrega al contrato antes
de usarlo.

Reglas que no cambian:

- **XP** y **monedas de Ciudad ICADEM** son independientes. Comprar nunca descuenta XP.
- Las monedas son solo del juego: no se cambian por dinero, no se transfieren entre jugadores y no
  tienen relación con la cartera, los créditos de membresía, las comisiones, los embajadores ni Stripe.
- No hay compras con dinero real, cajas de botín, apuestas ni comercio entre jugadores.
- Ningún objeto, mascota o montura da ventaja en misiones o minijuegos.
- Las cuentas infantiles (modo familiar, hoy desactivado) no tienen Mundo vivo: el servidor responde
  `no-disponible`.

## 1. Archivos

| Archivo | Qué contiene | Quién lo edita |
|---|---|---|
| `js/economy/coins.js` | Montos y topes de monedas, `earn`, `spend` | Claude |
| `js/economy/catalog.js` | `SHOPS`, `ITEMS`, sabores de aguas frescas | Claude (Codex puede pedir artículos) |
| `js/pets/pet-catalog.js` | `SPECIES`, `BREEDS`, ranuras de accesorios, escenarios con mascota | Claude |
| `js/home/home-rules.js` | Espacio de la casa, colores, pisos, `checkLayout` | Claude |
| `js/vivo/vivo-rules.js` | Reglas de compras, adopción, mascotas, casa, comida y aguas | Claude |
| `js/vivo/vivo-service.js` | `api.vivo`: la única puerta que usan las interfaces | Claude |
| `_ciudad-server/profiles.js`, `server.js` | Aplicación de las reglas sobre la cuenta | Claude |

## 2. Perfil (lo que llega del servidor)

Además de los campos de siempre (`xp`, `missions`, `achievements`, `custom`, …), cada perfil trae:

```js
coins: 135,                                   // monedas del juego (entero ≥ 0)
inv: { 'correa-roja': 1, 'premio-galleta': 3 },   // artículos y cantidades
pets: [{ id: 'm1', breed: 'golden', name: 'Sol', acc: { collar: 'collar-basico', leash: 'correa-roja' } }],
activePet: 'm1',                              // la que acompaña; null = todas en casa
home: { wall: 'menta', floor: 'talavera', items: [{ item: 'sillon', x: 2.2, z: 1.4, r: 2 }] },
coinbook: { today: 30, cap: 150, recent: [{ k: 'logro:poliglota', a: 10, at: 1763140000000 }] }
```

En el cliente esto queda en `api.store.state.vivo` (null sin conexión). `testCredits` sigue en el
perfil solo como historial: los créditos de prueba se convirtieron **una vez** en monedas.

## 3. Servicio del cliente `api.vivo`

Todas las acciones son `async` y devuelven `{ ok, reason?, message?, ...datos }`. `message` ya es el
texto para mostrar al jugador. Mientras una acción del mismo tipo está en curso, una segunda devuelve
`reason: 'en-curso'` (evita el doble toque).

| Llamada | Respuesta útil | Notas |
|---|---|---|
| `api.vivo.state` | estado de la sección 2 | `null` sin conexión |
| `api.vivo.on('change', fn)` | — | se dispara con cada perfil confirmado |
| `api.vivo.shop(idTienda)` | artículos con `owned`, `affordable`, `unique` | catálogo para el escaparate |
| `api.vivo.buy(item, qty)` | `{ item, qty, spent }` | idempotente (identificador interno por toque) |
| `api.vivo.catalog()` | razas con `adopted`, `available`, `cost`, `requirement {text, met, progress}` | catálogo de adopción |
| `api.vivo.adopt(breed, name)` | `{ pet, spent }` | nombre filtrado igual que el chat |
| `api.vivo.setPet(id, { name?, acc?, active? })` | `{ pet }` | `acc: { ranura: idArtículo \| null }` |
| `api.vivo.accessoriesFor(petId)` | `{ ranura: [artículos que tiene y le quedan] }` | para el editor de accesorios |
| `api.vivo.rest()` | — | todas las mascotas se quedan en casa |
| `api.vivo.feed(petId, food)` | `{ treat, coins }` | `food`: `'croquetas'` (gratis) o un premio del inventario |
| `api.vivo.walk(true\|false)` | `{ leash }` | paseo con correa; solo perros con correa equipada |
| `api.vivo.saveHome(layout)` | — | se valida completa en el servidor |
| `api.vivo.drink(flavor, 'self'\|'buy', steps)` | `{ flavor, coins \| spent }` | ver sección 7 |

Motivos de rechazo (`reason`) y su texto: `VIVO_REASONS` en `vivo-rules.js`, `HOME_REASONS` en
`home-rules.js` (llegan con prefijo `casa-`), más `sin-conexion`, `sin-respuesta` y `no-disponible`.

## 4. Monedas

| Fuente | Monedas | Límite |
|---|---|---|
| Bienvenida (una vez por cuenta) | 100 | única |
| Primera aprobación de una misión | la recompensa de la misión (15–20) | única por misión |
| Repetir una misión aprobada | 4 | junto con su XP de práctica diaria; cuenta para el tope |
| Minijuego validado (puntaje ≥ 30) | puntaje / 10 (máx. 10) | tope diario común |
| Primer minijuego completado | 15 | única por juego |
| Reto de un personaje que dio XP | 2 | tope diario común |
| Sitio de la Ruta del explorador | 5 | única por sitio |
| Logro nuevo | 10 | única por logro |
| Agua fresca bien preparada | 3 | una vez al día |
| Dar de comer a una mascota | 2 | una vez al día |

Tope diario común de práctica: **150** (`coins.js`). El día de juego es la hora del centro de México.

## 5. Tiendas y artículos

`SHOPS`: `ropa`, `zapateria`, `accesorios`, `mascotas`, `muebles`, `juguetes`, `aguas`, `especial`.

Cada artículo de `ITEMS`: `id, name, kind, shop, price, icon` y, según el tipo:

- `furniture`: `size [ancho, fondo]`, `layer` (`floor`, `rug`, `wall`, `pet`), `color`, `design?`, `petUse?`
- `petAcc`: `slot` (`collar`, `harness`, `leash`, `tag`, `scarf`, `outfit`, `hat`), `color`, `design?`
- `petToy`, `treat`: `species` (para quién es); los `treat` se acumulan (`stack`)
- `toy`: `use` (animación del avatar: `balero`, `trompo`, `yoyo`, `papalote`, `burbujas`)
- `wear`: prendas del avatar (Entrega C)

`price: 0` = regalo inicial (no se vende). Los artículos únicos no se compran dos veces; los muebles
se pueden tener hasta 9 piezas; los consumibles hasta 99.

## 6. Mascotas

`BREEDS` trae la forma de cada raza (tamaño, orejas, hocico, cola, pelaje, patrón) y cómo se obtiene:
`free`, `unlock { text, test, progress }` (por actividades) o `price`. Ver `api.vivo.catalog()`.

- Máximo 16 mascotas por cuenta, una de cada raza.
- Las mascotas **no** enferman, ni mueren, ni se pierden, ni se ponen tristes por no entrar al juego.
- Los demás jugadores ven la raza, los accesorios y la correa de la mascota activa; **no** su nombre.
- Escenarios donde acompañan: `PET_SCENES`. Paseo con correa: `WALK_SCENES`. En los demás escenarios
  la mascota espera en casa.

## 7. Aguas frescas

Sabores: `FLAVORS` (horchata, jamaica, limón, tamarindo, sandía, mango).

- **Prepara tu agua** (`mode: 'self'`): `steps` = `['vaso', 'agua', ...ingredientes en cualquier orden, 'hielo', 'servir']`
  (`drinkSteps(sabor)` da la secuencia). Bien hecha da 3 monedas una vez al día.
- **Pídela al vendedor** (`mode: 'buy'`): cuesta 5 monedas.

## 8. Casa

Escenario privado `casa` (12 × 10 m), entrada desde la habitación. Distribución:
`{ wall, floor, items: [{ item, x, z, r }] }`, `r` en cuartos de vuelta. `checkLayout(layout, inv)`
devuelve `{ ok, layout }` o `{ ok:false, reason, index }`. Los cuadros se ajustan solos a la pared
más cercana. La entrada (`HOME.clear`) siempre queda libre. Hasta 40 objetos y 3 alfombras.

## 9. Red (para pruebas y depuración)

Cliente → servidor: `{ t: 'vivo', op, n, ...datos }` con `op` = `buy | adopt | pet | rest | home | feed | drink | walk`.
Servidor → cliente: `{ t: 'vivo', op, n, ok, reason?, ...datos, profile }` y a los demás
`{ t: 'pet', pid, pet: { breed, acc, leash } | null }`. La lista de jugadores incluye `pet`.
Tope: 40 acciones por minuto.
