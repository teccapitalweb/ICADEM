# Servidor de sesiones de Ciudad ICADEM (entorno de pruebas)

Servicio WebSocket del multijugador. **No está desplegado y no toca créditos ni datos reales.**

```bash
npm install
node server.js          # modo de prueba: solo escucha en esta máquina (127.0.0.1:8787)
```

| Archivo | Qué hace |
|---|---|
| `auth.js` | Verifica el token de sesión (Firebase, RS256) y emite/canjea boletos firmados de un solo uso. |
| `hub.js` | Reglas sin sockets: instancias, visibilidad, movimiento, frases, topes por acción, salas privadas con roles. |
| `server.js` | Emisor de boletos (`/ticket`, `/dev/ticket`), socket, fotografías a 10 Hz, latidos. |

El socket nunca acepta un identificador escrito por el navegador: solo boletos firmados.

Modos (`CIUDAD_AUTH`):
- `test` (por defecto): emisor de desarrollo, solo desde la misma máquina. Se niega a arrancar con `NODE_ENV=production`.
- `firebase`: exige `CIUDAD_FIREBASE_PROJECT`, `CIUDAD_TICKET_SECRET` (32+ caracteres) y `CIUDAD_ORIGINS`. Escrito y probado con llaves locales; falta probarlo contra el proyecto real.

Comparte con el cliente los módulos puros de `../ciudad/js` (protocolo, escenarios, frases, motor de misiones), por eso requiere Node 22.7 o posterior.
La carpeta empieza con guion bajo para que GitHub Pages no la publique.
