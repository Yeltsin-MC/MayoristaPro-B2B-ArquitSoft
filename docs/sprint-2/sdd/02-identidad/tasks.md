# Tareas de implementación — Identidad, empresas y permisos

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 02 · Identidad, empresas y permisos                          |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Completado ✓                                                 |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## Resumen de fases

| Fase | Descripción | Tareas | Estado |
| ---- | ----------- | ------ | ------ |
| 1 | Análisis y especificación | 1.1 – 1.2 | ✓ |
| 2 | Base de datos | 2.1 – 2.2 | ✓ |
| 3 | Backend | 3.1 – 3.7 | ✓ |
| 4 | Frontend | 4.1 – 4.2 | ✓ |
| 5 | Pruebas | 5.1 – 5.3 | ✓ |

---

## Fase 1 — Análisis y especificación

### Tarea 1.1 — Definir requisitos de identidad

**Descripción:** Definir el modelo empresa–cuenta–vinculación, los tres permisos, el flujo de alta con revisión manual, la verificación separada del proveedor y las reglas de invitación y revocación.

**Resultado:** [`requirements.md`](requirements.md) con 8 RF, 7 RNF y criterios EARS.

**Estado:** ✓ Completado

---

### Tarea 1.2 — Diseñar la seguridad de la sesión

**Descripción:** Elegir token opaco con hash en la base (en lugar de JWT) para poder revocar al instante, scrypt con comparación en tiempo constante y cookie `HttpOnly` limitada a `/api/v1/auth`.

**Resultado:** [`design.md`](design.md) con secuencia de alta, funciones del servicio y decisiones.

**Estado:** ✓ Completado

---

## Fase 2 — Base de datos

### Tarea 2.1 — Migración `002_identity.sql`

**Archivo:** `database/migrations/002_identity.sql`

**Descripción:** Crear `companies` (RUC único de 11 dígitos), `accounts` (correo único en minúsculas), `memberships` (una empresa por cuenta), `enrollment_requests`, `identity_sessions` (hash y vencimiento de 8 h), `invitations` (hash único, permisos ⊆ {buy, publish}) e `identity_audit`.

**Requisitos:** RF-IDE-01 a RF-IDE-06 · **Estado:** ✓ Completado

---

### Tarea 2.2 — Migraciones de soporte

**Archivos:** `013_reject_enrollment.sql`, `014_delivery_addresses.sql`

**Descripción:** Permitir registrar `reject-enrollment` en la bitácora de moderación y agregar las columnas de dirección de la empresa.

**Requisitos:** RF-IDE-02, RF-IDE-07 · **Estado:** ✓ Completado

---

## Fase 3 — Backend

### Tarea 3.1 — Registro de empresa

**Archivo:** `identity.service.ts → register()`

**Descripción:** Validar correo, RUC, razón social, evidencia y contraseña; crear proveedor, empresa, cuenta y solicitud en una transacción; traducir `23505` a 409.

**Casos validados:**

- [x] 3.1.1 Registro válido → 201 `pending`.
- [x] 3.1.2 RUC de 5 dígitos → 400.
- [x] 3.1.3 RUC o correo repetido → 409 sin registros parciales.
- [x] 3.1.4 Enviar `permissions` o `platform_admin` en el cuerpo no concede nada.

**Requisitos:** RF-IDE-01 · **Estado:** ✓ Completado

---

### Tarea 3.2 — Administrador inicial

**Archivo:** `database/create-admin.cjs` · comando `npm run identity:admin`

**Descripción:** Crear la cuenta de administrador a partir de las variables `ADMIN_EMAIL` y `ADMIN_PASSWORD` del entorno, sin escribir la contraseña en el repositorio.

**Requisitos:** RF-IDE-02 · **Estado:** ✓ Completado

---

### Tarea 3.3 — Aprobación, rechazo y verificación

**Archivos:** `identity.service.ts → requests(), approve(), reject(), verify()`

**Descripción:** Aprobación transaccional e idempotente con `FOR UPDATE`; rechazo con motivo que borra la solicitud y libera el RUC; verificación del proveedor solo para empresas habilitadas.

**Casos validados:**

- [x] 3.3.1 Dos aprobaciones simultáneas → una sola vinculación.
- [x] 3.3.2 Rechazar una solicitud aprobada → 409.
- [x] 3.3.3 Verificar el proveedor de una empresa pendiente → 400.

**Requisitos:** RF-IDE-02, RF-IDE-03 · **Estado:** ✓ Completado

---

### Tarea 3.4 — Inicio y cierre de sesión

**Archivos:** `identity.service.ts → login(), logout(), session(), me()` · `identity.controller.ts`

**Descripción:** scrypt + `timingSafeEqual` (con hash ficticio si el correo no existe), token de 256 bits, sesión de 8 horas y bloqueo con motivo si la empresa está suspendida.

**Casos validados:**

- [x] 3.4.1 Contraseña incorrecta → 401 «Credenciales inválidas.».
- [x] 3.4.2 Sesión vencida → 401.
- [x] 3.4.3 Logout → el token deja de funcionar.

**Requisitos:** RF-IDE-04 · **Estado:** ✓ Completado

---

### Tarea 3.5 — Cookie de sesión y restauración

**Archivo:** `browser-session.ts` · `GET /auth/restore`

**Descripción:** Cookie `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth` y `Secure` en HTTPS; validación del origen; la cookie se borra si la sesión ya no es válida.

**Casos validados:**

- [x] 3.5.1 Recargar el navegador → sesión restaurada con permisos actuales.
- [x] 3.5.2 Sitio HTTPS → cookie `Secure`.
- [x] 3.5.3 Origen ajeno → 403.
- [x] 3.5.4 Cookie falsificada o vencida → no restaura.

**Requisitos:** RF-IDE-04 · **Estado:** ✓ Completado

---

### Tarea 3.6 — Invitaciones y revocación

**Archivos:** `identity.service.ts → invite(), accept(), members(), revoke()`

**Descripción:** Invitaciones con vigencia de 1, 7 o 30 días y consumo único con `FOR UPDATE`; revocación que borra las sesiones y no permite tocar a otro responsable ni a otra empresa.

**Casos validados:**

- [x] 3.6.1 Aceptar con otro correo → 400.
- [x] 3.6.2 Dos aceptaciones simultáneas → una sola cuenta.
- [x] 3.6.3 Invitación vencida → 400.
- [x] 3.6.4 Usuario revocado → 401/403 en su siguiente petición.

**Requisitos:** RF-IDE-05, RF-IDE-06 · **Estado:** ✓ Completado

---

### Tarea 3.7 — Dirección de la empresa

**Archivo:** `identity.service.ts → updateAddress()` · `PUT /company/address`

**Descripción:** Guardar dirección, distrito, provincia, departamento, referencia, contacto y teléfono, solo con permiso `manage`.

**Requisitos:** RF-IDE-07 · **Estado:** ✓ Completado

---

## Fase 4 — Frontend

### Tarea 4.1 — Mi cuenta en paneles

**Archivos:** `apps/web/src/identity.ts`, `session.service.ts`, `app.routes.ts`

**Descripción:** Rutas `/cuenta/...` con paneles visibles según permisos; restauración de la sesión al cargar; avatar con iniciales y botón para mostrar u ocultar la contraseña.

**Requisitos:** RF-IDE-04, RF-IDE-08 · **Estado:** ✓ Completado

---

### Tarea 4.2 — Registro, invitación y Panel de administración

**Archivo:** `apps/web/src/identity.ts`

**Descripción:** Formulario «Registrar mi empresa», pantalla «Aceptar invitación» (lee el token del fragmento `#token=`) y Panel de administración con solicitudes pendientes, aprobar, rechazar con motivo y verificar; se actualiza solo cada 30 s.

**Requisitos:** RF-IDE-01, RF-IDE-02, RF-IDE-05 · **Estado:** ✓ Completado

---

## Fase 5 — Pruebas

### Tarea 5.1 — Pruebas de integración (Jest + PostgreSQL)

| Prueba | Subprueba en `tests/identity.integration.cjs` |
| ------ | --------------------------------------------- |
| PI-IDE-01 | alta pendiente, aprobación manual y sin privilegios públicos |
| PI-IDE-02 | aislamiento, compra habilitada y publicación bloqueada hasta verificar proveedor |
| PI-IDE-03 | invitación vinculada al correo, permiso limitado y un solo consumo concurrente |
| PI-IDE-04 | invitación vencida y revocación inmediata con aislamiento |
| PI-IDE-05 | rechazar una solicitud falsa borra la cuenta pendiente y libera el RUC |
| PI-IDE-06 | sesiones vencidas, logout y credenciales inválidas |
| PI-IDE-07 | `tests/browser-session.integration.cjs` (4 subpruebas de cookie y origen) |

**Estado:** ✓ Completado

---

### Tarea 5.2 — Pruebas de navegador (Playwright)

| Prueba | Archivo | Qué valida |
| ------ | ------- | ---------- |
| PN-IDE-01 | `tests/catalog.browser.cjs` | Paneles visibles por rol (comprador, proveedor, administrador) |
| PN-IDE-02 | `tests/continuidad-comprador.browser.cjs` | La sesión sobrevive a la recarga |

**Estado:** ✓ Completado

---

### Tarea 5.3 — Pruebas funcionales con Postman

**Colección:** carpeta «2. Identidad»

| Prueba | Petición | Resultado esperado |
| ------ | -------- | ------------------ |
| PT-IDE-01 | Login con contraseña incorrecta | ✓ 401 |
| PT-IDE-02 | Login comprador | ✓ 201 con `token` (se guarda en variable) |
| PT-IDE-03 | Login proveedor | ✓ 201 con `token` |
| PT-IDE-04 | Sesión actual del comprador | ✓ 200 con permisos y empresa |
| PT-IDE-05 | Sin token: pedidos | ✓ 401 |
| PT-IDE-06 | Registro inválido: RUC de 5 dígitos | ✓ 400 |

**Estado:** ✓ Completado

---

## Pendientes

- [ ] Inicio de sesión con Google (mejora futura; en B2B se mantiene el registro con RUC).
- [ ] Recuperar contraseña por correo.

---

## Trazabilidad completa del módulo

```
requirements.md            design.md                    tasks.md
      │                        │                            │
      │ RF-IDE-01..08          │ identity.controller.ts     │ Tareas 2.1..2.2 (BD)
      │ RNF-IDE-01..07         │ identity.service.ts        │ Tareas 3.1..3.7 (API)
      │ Ciclo de la empresa    │ browser-session.ts         │ Tareas 4.1..4.2 (web)
      │ Criterios EARS         │ identity.ts (Angular)      │ PI, PN, PT
      └────────────────────────┴────────────────────────────┘
                               │
                      CÓDIGO IMPLEMENTADO
                               │
                      PRUEBAS EJECUTADAS (CI)
                               │
                   https://mayoristapro.shop ✓
```
