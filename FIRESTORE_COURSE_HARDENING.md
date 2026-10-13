# Cierre del catálogo privado de ICADEM

El panel de miembros ya no consulta `cursos` directamente. Consume
`GET /api/courses/catalog`, que devuelve una whitelist de metadatos y agrega
`videoId` o `url` únicamente cuando el backend confirma el acceso actual del
usuario (administrador, membresía y goteo, o curso gratuito elegido).
`gameData`, `solution` y cualquier campo no reconocido nunca salen del servidor.

## Paso obligatorio en Firebase

El repositorio no contenía `firebase.json` ni el ruleset Firestore vigente. No
es seguro inventar un archivo completo: desplegarlo reemplazaría todas las
reglas del proyecto y podría bloquear directorio, foro, certificados o el panel
administrativo.

Antes de declarar cerrado el acceso directo:

1. exportar/copiar las reglas vigentes del proyecto `icadem-vip`;
2. integrar `firestore.courses.rules.fragment` dentro de
   `match /databases/{database}/documents` y retirar o acotar cualquier regla
   más amplia que también conceda lectura sobre `cursos` (los `allow` de
   Firestore se combinan con **OR**; un catch-all permisivo no queda anulado
   por agregar un bloque más restrictivo);
3. probar con Rules Emulator que un miembro normal no puede leer
   `/cursos/{id}` ni `/cursos/{id}/{subcolección}/{documento}`, y que los
   correos administrativos sí pueden administrarlos;
4. desplegar el ruleset completo con Firebase CLI;
5. comprobar el CRUD de cursos en `vip-admin.html` y el catálogo del panel.

Hasta completar ese despliegue, la aplicación evita la exposición en su flujo
normal, pero alguien que conozca la configuración pública de Firebase todavía
podría intentar leer la colección usando el SDK directamente si las reglas
vigentes continúan siendo permisivas.
