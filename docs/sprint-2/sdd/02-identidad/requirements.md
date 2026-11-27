# Especificación de Requisitos — Identidad, empresas y permisos

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 02 · Identidad, empresas y permisos                          |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Contexto

MayoristaPro es B2B: quien compra o vende no es una persona suelta sino una **empresa** identificada por su RUC. Las personas actúan en nombre de la empresa mediante una **vinculación** que tiene permisos concretos: administrar (`manage`), comprar (`buy`) y vender (`publish`).

Para evitar empresas falsas, el alta pasa por la revisión del administrador de la plataforma y, aparte, el proveedor necesita una **verificación** antes de publicar productos. Como no se consulta SUNAT en línea, la empresa queda marcada como «revisado manualmente».

Origen: [T2 — Identidad y vinculación empresarial](../../identidad.md) y decisión D1 de la [preparación del Sprint 2](../../00-preparacion-sprint-2.md).

---

## 2. Objetivo

Implementar el ciclo de vida de la identidad empresarial:

- Registro público de la empresa con RUC, razón social y evidencia.
- Revisión del administrador: aprobar o rechazar el alta, y verificar al proveedor.
- Inicio de sesión seguro con token opaco y cookie `HttpOnly` para restaurar la sesión.
- Invitaciones de un solo uso para sumar compañeros con permisos específicos, y revocación.
- Dirección de la empresa (dónde recibe o desde dónde despacha).
- Auditoría de cada acción sensible, sin guardar secretos.

---

## 3. Actores involucrados

| Actor | Permisos en este módulo |
| ----- | ----------------------- |
| Visitante | Registrar su empresa, iniciar sesión, aceptar una invitación |
| Responsable de la empresa (`manage`) | Invitar y revocar usuarios, ver miembros, editar la dirección |
| Usuario con `buy` | Comprar (cotizaciones y pedidos) |
| Usuario con `publish` | Vender (requiere además proveedor verificado) |
| Administrador de plataforma (`platform_admin`) | Ver solicitudes, aprobar, rechazar y verificar proveedores; no pertenece a ninguna empresa |

---

## 4. Glosario

| Término | Definición |
| ------- | ---------- |
| Empresa habilitada | Alta aprobada por el administrador (`companies.status = 'enabled'`) |
| Empresa suspendida | Bloqueada por el administrador (`status = 'suspended'`), ver [Moderación](../05-moderacion/requirements.md) |
| Proveedor verificado | Verificación separada (`suppliers.verified`) que permite publicar |
| Vinculación | Fila de `memberships` que une una cuenta con una empresa y sus permisos |
| Token opaco | Cadena aleatoria de 256 bits sin datos dentro; la base guarda solo su SHA-256 |
| Invitación | Enlace de un solo uso para crear una cuenta vinculada con permisos definidos |

---

## 5. Requisitos funcionales

### RF-IDE-01 — Registrar una empresa

**Endpoint:** `POST /api/v1/auth/register`
**Acceso:** Público
**Body:** `{ email, password, ruc, legalName, evidence }`

**Validaciones obligatorias:**

- Correo válido, guardado en minúsculas (≤ 254 caracteres).
- Contraseña de 12 a 128 caracteres → si no, 400 «Contraseña de 12 a 128 caracteres.».
- RUC de exactamente 11 dígitos y razón social de al menos 2 caracteres → si no, 400.
- Evidencia de hasta 2000 caracteres.
- Correo o RUC repetido → 409 «Correo o RUC ya registrado. La coincidencia no concede acceso.».

**Resultado:** 201 `{ requestId, status: "pending" }`. Se crean proveedor, empresa, cuenta y solicitud en **una sola transacción**.

#### Criterios de aceptación (EARS)

1. CUANDO se envíe un registro válido, EL sistema DEBERÁ crear la solicitud en estado `pending`.
2. SI el correo o el RUC ya existen, ENTONCES EL sistema DEBERÁ responder 409 sin crear registros parciales.
3. EL registro público NO DEBERÁ conceder administración ni permisos enviados en el cuerpo.
4. MIENTRAS la solicitud esté pendiente, EL usuario NO DEBERÁ acceder a operaciones empresariales (403 «Vinculación no habilitada.»).

---

### RF-IDE-02 — Aprobar o rechazar el alta

**Endpoints:** `GET /api/v1/admin/enrollments`, `POST /api/v1/admin/enrollments/:id/approve`, `POST /api/v1/admin/enrollments/:id/reject`
**Acceso:** Solo administrador de plataforma

**Reglas:**

- Aprobar habilita la empresa, la etiqueta «revisado manualmente» y crea la vinculación con `manage`, `buy` y `publish`.
- Aprobar dos veces no duplica la vinculación (idempotente).
- Rechazar exige un motivo de 5 a 500 caracteres, borra la cuenta, la empresa y el proveedor sin aprobar, y deja constancia en la bitácora de moderación.
- No se puede rechazar una solicitud ya aprobada → 409 «La solicitud ya fue aprobada. Para bloquear la empresa, suspéndela.».

#### Criterios de aceptación (EARS)

1. CUANDO el administrador apruebe una solicitud, EL sistema DEBERÁ habilitar la empresa y asignar los tres permisos en una transacción.
2. SI la aprobación se repite o llega dos veces a la vez, ENTONCES EL sistema NO DEBERÁ duplicar vinculaciones.
3. CUANDO el administrador rechace una solicitud pendiente con motivo, EL sistema DEBERÁ eliminarla y registrar el motivo.
4. EL listado DEBERÁ mostrar primero las solicitudes pendientes.

---

### RF-IDE-03 — Verificar al proveedor

**Endpoint:** `PATCH /api/v1/providers/:id/verify`
**Acceso:** Solo administrador de plataforma

**Regla:** solo se verifica el proveedor de una empresa habilitada → si no, 400 «Proveedor no habilitado.».

#### Criterios de aceptación (EARS)

1. CUANDO el administrador verifique al proveedor, EL sistema DEBERÁ permitir que la empresa publique.
2. MIENTRAS el proveedor no esté verificado, nadie de la empresa DEBERÁ poder publicar productos ni escalas (403 «Requiere proveedor verificado.»).

---

### RF-IDE-04 — Iniciar y cerrar sesión

**Endpoints:** `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/restore`, `GET /api/v1/auth/session`, `GET /api/v1/auth/me`
**Acceso:** Público (login) · sesión (resto)

**Reglas:**

- La contraseña se compara con scrypt y `timingSafeEqual`, incluso si el correo no existe (mismo tiempo de respuesta).
- El token es de 256 bits (64 caracteres hexadecimales) y dura 8 horas.
- Se guarda una cookie `mayoristapro_session` con `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth` y `Secure` en HTTPS.
- `GET /auth/restore` usa la cookie para recuperar la sesión al recargar y rechaza orígenes ajenos (403 «Origen de acceso no permitido.»).
- Si la empresa está suspendida → 403 «Tu empresa está suspendida por el administrador. Motivo: …».

#### Criterios de aceptación (EARS)

1. EL sistema DEBERÁ almacenar contraseñas con scrypt y sal aleatoria de 16 bytes.
2. CUANDO las credenciales sean correctas, EL sistema DEBERÁ emitir un token de 256 bits válido por 8 horas y guardar solo su hash SHA-256.
3. SI las credenciales son incorrectas, ENTONCES EL sistema DEBERÁ responder 401 «Credenciales inválidas.» sin revelar si el correo existe.
4. CUANDO se recargue el navegador, EL sistema DEBERÁ restaurar la sesión con la cookie y rechazar orígenes ajenos.
5. CUANDO se cierre la sesión, EL sistema DEBERÁ borrarla de la base y vaciar la cookie.

---

### RF-IDE-05 — Invitar compañeros

**Endpoints:** `POST /api/v1/company/invitations`, `POST /api/v1/auth/invitations/accept`
**Acceso:** Responsable (`manage`) · público con token

**Body de invitación:** `{ email, permissions: ["buy"|"publish"], dias: 1|7|30 }`

**Reglas:**

- Permisos solo `buy`, `publish` o ambos → si no, 400 «Permisos inválidos.».
- Vigencia de 1, 7 o 30 días (1 por defecto) → si no, 400.
- El enlace es `/accept-invitation#token=…`; la base guarda solo el hash.
- Aceptar exige el mismo correo invitado y una contraseña válida; la invitación se consume una vez, aun con peticiones simultáneas.
- Si quien invitó ya no es responsable activo, la invitación deja de valer.

#### Criterios de aceptación (EARS)

1. CUANDO el responsable cree una invitación, EL sistema DEBERÁ generar un enlace de un solo uso con la vigencia elegida.
2. SI la invitación está vencida, usada o el correo no coincide, ENTONCES EL sistema DEBERÁ responder 400 «Invitación inválida, vencida o utilizada.».
3. SI dos personas aceptan a la vez, ENTONCES solo una DEBERÁ crear la cuenta.

---

### RF-IDE-06 — Ver y revocar miembros

**Endpoints:** `GET /api/v1/company/members`, `POST /api/v1/company/members/:id/revoke`
**Acceso:** Responsable (`manage`)

#### Criterios de aceptación (EARS)

1. CUANDO el responsable revoque a un usuario de su empresa, EL sistema DEBERÁ desactivar la vinculación y borrar todas sus sesiones.
2. EL responsable NO DEBERÁ poder revocar a usuarios de otra empresa ni a otro responsable, incluido él mismo (403 «No se puede revocar esta vinculación.»).

---

### RF-IDE-07 — Dirección de la empresa

**Endpoint:** `PUT /api/v1/company/address`
**Acceso:** Responsable (`manage`)
**Body:** `{ direccion, distrito, provincia, departamento, referencia?, contacto?, telefono? }`

**Reglas:** dirección ≤ 200, distrito/provincia/departamento ≤ 60 y obligatorios, teléfono `^\+?[0-9 ]{6,15}$`.

#### Criterios de aceptación (EARS)

1. CUANDO el responsable guarde la dirección, EL sistema DEBERÁ usarla como lugar de entrega por defecto (comprador) o «Despacha desde» (proveedor).
2. Las cotizaciones ya enviadas DEBERÁN conservar su propia copia de la dirección.

---

### RF-IDE-08 — Pantallas de identidad

**Componente:** `apps/web/src/identity.ts` · rutas `/cuenta`, `/accept-invitation`

Mi cuenta en paneles (Empresa, Usuarios, Mis productos, Cotizaciones, Pedidos), Registrar mi empresa, Aceptar invitación y Panel de administración. Cada panel aparece solo si el usuario tiene el permiso correspondiente. Campo de contraseña con botón para mostrarla u ocultarla.

---

## 6. Requisitos no funcionales

| ID | Atributo | Detalle |
| -- | -------- | ------- |
| RNF-IDE-01 | Seguridad | Contraseñas con scrypt (64 bytes) y sal aleatoria; nunca en texto plano ni en logs |
| RNF-IDE-02 | Seguridad | Tokens opacos; en la base solo el SHA-256 (si se filtra la base, no sirven) |
| RNF-IDE-03 | Seguridad | Comparación en tiempo constante para no revelar si un correo existe |
| RNF-IDE-04 | Seguridad | La empresa y los permisos se resuelven en el servidor desde el token; nunca se confía en el cuerpo |
| RNF-IDE-05 | Integridad | Registro, aprobación, invitación y revocación en transacciones; bloqueos `FOR UPDATE` evitan carreras |
| RNF-IDE-06 | Auditoría | `identity_audit` registra quién, qué y sobre qué, sin secretos |
| RNF-IDE-07 | Privacidad | Cookie `HttpOnly` y `SameSite=Strict`; `Cache-Control: no-store` en respuestas de sesión |

---

## 7. Criterios de aceptación del módulo

- [x] `POST /auth/register` válido responde 201 con `status: "pending"`.
- [x] RUC de 5 dígitos responde 400.
- [x] RUC repetido responde 409 sin dejar registros a medias.
- [x] Una cuenta pendiente recibe 403 en operaciones empresariales.
- [x] Dos aprobaciones simultáneas crean una sola vinculación.
- [x] Proveedor sin verificar no puede publicar (403).
- [x] Login con contraseña incorrecta responde 401 «Credenciales inválidas.».
- [x] `GET /auth/restore` con origen ajeno responde 403.
- [x] Cerrar sesión invalida el token.
- [x] Una invitación aceptada dos veces a la vez crea una sola cuenta.
- [x] Revocar a un miembro borra sus sesiones al instante.
- [x] Un responsable no puede revocarse a sí mismo.

---

## 8. Ciclo de vida de la empresa

```
        [REGISTRAR — RF-IDE-01]
                 │
                 ▼
            PENDIENTE ─────────[RECHAZAR — RF-IDE-02]────► (eliminada + bitácora)
                 │
        [APROBAR — RF-IDE-02]
                 │
                 ▼
            HABILITADA  ──[VERIFICAR PROVEEDOR — RF-IDE-03]──► puede publicar
             │      ▲
   [SUSPENDER]      [REACTIVAR]          (ver módulo 05 · Moderación)
             ▼      │
            SUSPENDIDA  → sesiones cerradas, catálogo oculto
```

---

## 9. Trazabilidad SDD

| Artefacto | Archivo |
| --------- | ------- |
| Diseño técnico | [`design.md`](design.md) |
| Tareas de implementación | [`tasks.md`](tasks.md) |
| Controlador | `apps/api/src/identity/identity.controller.ts` |
| Servicio | `apps/api/src/identity/identity.service.ts` |
| Cookie y origen | `apps/api/src/identity/browser-session.ts` |
| Migraciones | `database/migrations/002_identity.sql`, `013_reject_enrollment.sql`, `014_delivery_addresses.sql` |
| Frontend | `apps/web/src/identity.ts`, `session.service.ts` |
| Pruebas | `tests/identity.integration.cjs`, `tests/browser-session.integration.cjs` |
