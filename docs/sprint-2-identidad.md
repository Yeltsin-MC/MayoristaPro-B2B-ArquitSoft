# T2 — Identidad y vinculación empresarial

D1 aprobada el 10/11/2026 por el responsable del proyecto. Alcance: identidad, vinculación, invitaciones, revocación y autorización de publicación. No se implementan compras, importación, cotizaciones ni pagos. El catálogo público de T1 permanece accesible sin sesión.

## Comportamiento aprobado

El primer usuario solicita alta con correo, contraseña, RUC, razón social y evidencia de representación. Para la demo, todos los datos y evidencias son ficticios. El RUC tiene exactamente 11 dígitos y es único por empresa; el correo se normaliza a minúsculas y es único. No se consulta SUNAT y no se acredita representación por coincidencia de RUC. Un alta duplicada devuelve 409 sin crear usuarios ni proveedores parciales.

Administración revisa la evidencia y aprueba la vinculación en una transacción. Se habilita la empresa y se asignan al solicitante los permisos `manage`, `buy` y `publish`. La etiqueta es «revisado manualmente». La empresa puede comprar y vender. La verificación del proveedor se aprueba en una operación administrativa independiente: hasta entonces, incluso el responsable tiene prohibido publicar.

El responsable crea invitaciones para un correo específico con permisos `buy`, `publish` o ambos. El enlace vence en 24 horas y se consume una sola vez, incluso con solicitudes simultáneas. Para esta entrega incorpora cuentas nuevas; un correo ya registrado produce 409 y no consume el enlace. El enlace se entrega al responsable para compartirlo: no se envía correo automáticamente. El token viaja en el fragmento del enlace y se almacena únicamente su hash en PostgreSQL.

La revocación alcanza a usuarios invitados de la propia empresa y elimina sus sesiones. Una cuenta revocada puede autenticarse, pero ya no accede a operaciones empresariales. T2 conserva un único responsable inicial por empresa; su transferencia o revocación y la pertenencia a múltiples empresas quedan fuera de este incremento. Los campos de administración, empresa y permisos enviados al registro público no conceden privilegios.

## Implementación

1. Migración aditiva `002_identity.sql`: `companies`, `accounts`, `memberships`, `enrollment_requests`, `identity_sessions`, `invitations` e `identity_audit`. Los proveedores sintéticos de T1 permanecen intactos; cada empresa nueva obtiene un perfil de proveedor pendiente.
2. Contraseñas derivadas con scrypt y sal aleatoria. Sesión Bearer opaca de 256 bits, hash SHA-256 persistido y vencimiento de 8 horas. No se implementa refresh. El navegador mantiene la sesión en memoria: recargar requiere iniciar sesión otra vez.
3. Servidor resuelve vinculación activa y permisos para cada operación; las transacciones coordinan aprobación, aceptación y revocación. Auditoría de aprobaciones, invitaciones, aceptación, revocación, verificación y publicación. Los secretos no aparecen en la auditoría.
4. Pantalla Angular bajo el catálogo: solicitar alta, ingresar, aceptar invitación, gestionar usuarios, revisar solicitudes, verificar proveedor y probar la publicación de un producto propio existente. Crear productos pertenece a T3; T2 solo incorpora el cambio autorizado a publicado.

## Contrato implementado

Base `/api/v1`. Cuerpos JSON; en rutas protegidas usar `Authorization: Bearer <token>`. Identificadores UUID. Errores: 400 entrada inválida o invitación no utilizable; 401 sesión ausente, vencida o credenciales incorrectas; 403 permiso, vinculación o propiedad insuficientes; 409 correo o RUC duplicado.

| Ruta | Cuerpo y resultado |
|---|---|
| `POST /auth/register` | `{email,password,ruc,legalName,evidence}` → 201 `{requestId,status:"pending"}`. Contraseña de 12–128 caracteres, razón social de 2–200 y evidencia de 1–2000. |
| `POST /auth/login` | `{email,password}` → 201 `{token,expiresIn:28800}`. La autenticación no implica vinculación habilitada. |
| `POST /auth/logout` | Bearer → 201 `{loggedOut:true}`. Invalida la sesión. |
| `GET /auth/me` | Vinculación habilitada → cuenta, vinculación, permisos y empresa con etiqueta manual y estado del proveedor. |
| `GET /admin/enrollments` | Solo administración → solicitudes, evidencia, datos empresariales e ID del proveedor. |
| `POST /admin/enrollments/:id/approve` | Solo administración → 201 `{companyId,reviewLabel}`. Repetir aprobación no duplica vinculaciones. |
| `POST /company/invitations` | Responsable, `{email,permissions}` → 201 `{id,expires_at,link}`. No admite `manage` ni administración. |
| `POST /auth/invitations/accept` | Pública, `{token,email,password}` → 201 `{accepted:true}`. No permite elegir empresa ni permisos. |
| `GET /company/members` | Responsable → usuarios de su empresa, sin contraseñas ni sesiones. |
| `POST /company/members/:id/revoke` | Responsable de la misma empresa → 201 `{revoked:true}`. No revoca al responsable. |
| `PATCH /providers/:id/verify` | Solo administración, empresa habilitada → 200 `{verified:true,reviewLabel}`. |
| `POST /products/:id/publish` | Vinculación activa, permiso `publish`, propietario y proveedor verificado → 201 `{published:true}`. |

## Revisión local

Después de `npm ci`, ejecutar `npm run db:migrate` y `npm run build`. La administración no se crea desde HTTP ni se incluye una contraseña fija en el seed. Para aprovisionar una cuenta administrativa nueva en PowerShell:

```powershell
$env:ADMIN_EMAIL = 'admin@example.test'
$adminSecret = Read-Host 'Contraseña ficticia de al menos 12 caracteres' -AsSecureString
$env:ADMIN_PASSWORD = ([System.Net.NetworkCredential]::new('', $adminSecret)).Password
npm run identity:admin
Remove-Item Env:ADMIN_PASSWORD
Remove-Item Env:ADMIN_EMAIL
Remove-Variable adminSecret
```

Arrancar API y Angular como en [T1](sprint-2-base-catalogo.md). Solicitar alta ficticia; ingresar como administrador y abrir «Solicitudes (administración)» para aprobarla. Salir e ingresar como responsable: se muestra «revisado manualmente» y proveedor pendiente. Crear una invitación y abrir su enlace en otra sesión del navegador; aceptar con el correo destinatario e ingresar. Desde el responsable, listar usuarios y revocar al invitado. La siguiente operación del invitado se rechaza.

Para verificar al proveedor, administración usa el ID mostrado en su solicitud aprobada. La publicación requiere además un producto existente propiedad de ese proveedor; se cubre automáticamente con fixtures de prueba, sin incorporar la gestión del catálogo de T3. Fuera del servidor de desarrollo, el frontend necesita fallback a `index.html` para abrir `/accept-invitation`, `/api` hacia NestJS y HTTPS para transportar credenciales y tokens.

## Aceptación automatizada

`npm run test:integration` ejecuta el catálogo original y T2 contra PostgreSQL real. T2 crea un esquema temporal aislado, aplica las dos migraciones y el seed, arranca NestJS y lo elimina al terminar. Necesita permiso de creación de esquemas en la base de pruebas. No altera las empresas de desarrollo.

- Alta pendiente, sin acceso empresarial, aprobada manualmente y aprobación concurrente sin duplicación.
- RUC duplicado rechazado sin altas parciales; registro público sin administración.
- Empresa habilitada con permiso de compra mientras el proveedor sigue pendiente; publicación bloqueada.
- Publicación permitida tras verificación administrativa, conservando propiedad y permiso; otras empresas bloqueadas.
- Invitación vinculada al destinatario y empresa del responsable; consumo concurrente de un solo uso y vencimiento.
- Revocación aislada por empresa, invalidación de sesión y rechazo posterior aunque vuelva a autenticarse.
- Catálogo público, credenciales incorrectas, sesión vencida y logout.

SUNAT externa queda pendiente de confirmación para una entrega posterior. Esta entrega no afirma validación fiscal externa ni implementa tareas T3–T7.

Verificación local del 10/11/2026: migración aplicada; `npm run build` completó Angular y NestJS; `npm run test:integration` pasó 7 pruebas (catálogo, escenario T2 y sus cinco casos). La interfaz se verificó mediante compilación; no se ejecutó una prueba E2E de navegador.
