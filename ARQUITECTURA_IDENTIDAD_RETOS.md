# ICADEM · identidad, progreso y retos

## Fuentes de verdad

- Firebase Authentication conserva la cuenta y proveedores de acceso.
- `users/{uid}` mantiene la identidad privada normalizada.
- `directorio/{uid}` contiene el perfil profesional y solo publica correo o WhatsApp con consentimiento explícito.
- `miembros/{uid}` mantiene el estado de membresía.
- `progress/{uid}/courses/{courseId}` mantiene las clases finalizadas.
- `credits/{uid}` mantiene el saldo; `creditTransactions/{uid}__lesson__{courseId}__{lessonNumber}` es el ledger idempotente.
- `ranking/{uid}` contiene únicamente nombre, foto, nivel, XP y progreso agregado.

La prioridad de identidad es: edición explícita del usuario, Auth, proveedor Google, documentos históricos, prefijo del correo e iniciales.

## Cierre de una clase

1. El cliente solicita `POST /api/learning/challenge` con curso y número de clase.
2. El servidor valida la sesión, el curso y el desbloqueo de la clase.
3. Se asigna de forma determinista uno de seis juegos: crucigrama, memoria, sopa de letras, rompecabezas, adivina el concepto o clasificación.
4. La interfaz bloquea el fondo y permite resolver con toque, arrastre o teclado.
5. El cliente envía la prueba a `POST /api/learning/complete`.
6. Una transacción de Firestore valida la solución, registra el progreso y acredita exactamente 5 créditos una sola vez.
7. Solo después de la confirmación se muestra el cofre, el saldo nuevo y la continuación.

Los reintentos de red son seguros: el identificador del ledger es estable por usuario, curso y clase.

## Identidad y privacidad

- `POST /api/identity/sync`: crea o repara los documentos canónicos.
- `GET /api/identity/me`: obtiene identidad, membresía, directorio y saldo.
- `PATCH /api/profile`: actualiza nombre, perfil, foto y portada.
- `GET /api/directory`: devuelve únicamente campos públicos y ordena primero al usuario actual, perfiles VIP y perfiles completos.
- `GET /api/ranking`: devuelve solo campos permitidos; nunca correo, teléfono ni datos de pago.

Las imágenes se almacenan en Firebase Storage bajo `profiles/{uid}/`. La portada personalizada se limita a miembros VIP. Correo y WhatsApp permanecen privados salvo aceptación individual.

## Migración

El backend ejecuta una migración idempotente `identity-v1` al iniciar. Recorre Firebase Auth por lotes y crea o completa `users`, `directorio`, `ranking`, `credits` y `miembros`. El estado puede consultarse en `GET /api/migrations/identity-status` y relanzarse por un administrador autenticado con `POST /admin/backfill-identities`.

## Operación

Variables requeridas en el backend:

- credenciales de Firebase Admin ya usadas por el servicio;
- `FIREBASE_STORAGE_BUCKET` si el bucket difiere de `icadem-vip.firebasestorage.app`;
- variables existentes de Stripe, Bunny y Resend.

El frontend continúa desplegándose mediante GitHub Pages y el backend mediante Railway. Los cambios de progreso o crédito nunca dependen de `localStorage`; este se usa únicamente como compatibilidad visual y para importar progreso anterior una sola vez.

## Pruebas mínimas antes de publicar

- Crear cuenta con correo y con Google, cerrar y recuperar sesión.
- Vincular Google a una cuenta existente.
- Completar una clase y verificar juego, cofre, +5 créditos y desbloqueo.
- Repetir la misma solicitud de finalización y comprobar que no duplica créditos.
- Revisar los seis juegos con teclado y pantalla táctil.
- Verificar directorio, privacidad, foto, portada VIP y ranking.
- Probar 320, 360, 390, 430, 768, 1024, 1280 y 1440 píxeles de ancho.
- Confirmar ausencia de errores de consola y respetar `prefers-reduced-motion`.
