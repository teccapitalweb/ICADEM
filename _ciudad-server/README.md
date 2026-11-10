# Servidor de sesiones de Ciudad ICADEM (prototipo)

Servicio WebSocket del multijugador. **Solo se ha probado en local, con identidades y economía de prueba.**
No está desplegado y no toca créditos ni datos reales.

```bash
npm install
node server.js          # ws://127.0.0.1:8787 · modo de prueba
```

- `hub.js`: reglas sin sockets (instancias, visibilidad, validación de movimiento, frases, reconexión).
- `server.js`: transporte WebSocket, ritmo de 10 fotografías por segundo, latidos y límites por conexión.
- Comparte con el cliente los módulos puros de `../ciudad/js` (protocolo, frases, motor de misiones).

Antes de producción: verificador de token real, despliegue, orígenes permitidos (`CIUDAD_ORIGINS`), pruebas de carga
y panel de moderación. Con `NODE_ENV=production` o `CIUDAD_AUTH` distinto de `test`, el servidor se niega a arrancar.
La carpeta empieza con guion bajo para que GitHub Pages no la publique.
