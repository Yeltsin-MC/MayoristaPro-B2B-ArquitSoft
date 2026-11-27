# Especificación de Requisitos — Moderación del administrador

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 05 · Moderación del administrador                            |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Contexto

Un marketplace abierto necesita control. Si un proveedor publica algo prohibido o engañoso, o una empresa comete abusos, el administrador de la plataforma debe poder actuar rápido, explicar el motivo y dejar constancia de lo que hizo.

Este módulo agrega tres herramientas: **retirar productos** del catálogo, **suspender empresas** (cortando su acceso al instante) y una **bitácora de moderación** donde queda registrado quién hizo qué, sobre qué, por qué y cuándo. También incluye el **rechazo de solicitudes de alta** falsas, que se registra en la misma bitácora.

---

## 2. Objetivo

- Retirar y restaurar productos con un motivo obligatorio.
- Impedir que el proveedor republique un producto retirado, por cualquier camino.
- Suspender y reactivar empresas, cerrando sus sesiones de inmediato.
- Ocultar del catálogo los productos de empresas suspendidas.
- Buscar empresas registradas por razón social o RUC.
- Registrar cada acción en una bitácora que no se puede editar desde la aplicación.

---

## 3. Actores involucrados

| Actor | Permisos en este módulo |
| ----- | ----------------------- |
| Administrador de plataforma | Todas las acciones de moderación y consultas |
| Proveedor dueño del producto | Ve el motivo del retiro; no puede republicarlo |
| Usuario de una empresa suspendida | No puede iniciar sesión; ve el motivo |
| Visitante o comprador | Deja de ver productos retirados o de empresas suspendidas |

---

## 4. Glosario

| Término | Definición |
| ------- | ---------- |
| Producto retirado | Producto ocultado por el administrador (`retired_at` con fecha); su dueño no puede publicarlo |
| Empresa suspendida | Empresa con `status = 'suspended'`; sus usuarios no ingresan y su catálogo se oculta |
| Motivo | Texto de 5 a 500 caracteres que explica la acción |
| Bitácora de moderación | Tabla `moderation_actions`: administrador, acción, recurso, nombre del recurso, motivo y fecha |

---

## 5. Requisitos funcionales

### RF-MOD-01 — Retirar un producto

**Endpoint:** `POST /api/v1/admin/products/:id/retire`
**Acceso:** Solo administrador de plataforma
**Body:** `{ "reason": "Producto con registro sanitario vencido" }`

**Reglas:**

- Motivo de 5 a 500 caracteres → si no, 400 «Escribe un motivo de 5 a 500 caracteres.».
- El producto debe existir y no estar retirado → si no, 400 «El producto no existe o ya fue retirado.».
- En la misma transacción: `published = false`, `retired_at = now()`, `retired_reason` y registro en la bitácora.

#### Criterios de aceptación (EARS)

1. CUANDO el administrador retire un producto con un motivo válido, EL sistema DEBERÁ despublicarlo, guardar fecha y motivo, y registrar la acción en la misma transacción.
2. MIENTRAS el producto esté retirado, EL catálogo público NO DEBERÁ mostrarlo.
3. SI quien retira no es administrador, ENTONCES EL sistema DEBERÁ responder 403.

---

### RF-MOD-02 — Impedir la republicación

**Caminos protegidos:** `POST /api/v1/products/:id/publish` (manual) y la confirmación de la carga masiva.

#### Criterios de aceptación (EARS)

1. SI el dueño intenta publicar un producto retirado, ENTONCES EL sistema DEBERÁ responder 403 «El administrador retiró este producto. Motivo: …».
2. CUANDO una carga masiva incluya un producto retirado con `publicado = true`, EL sistema DEBERÁ actualizar sus datos pero mantenerlo oculto.
3. LA base de datos DEBERÁ impedir, con una restricción, que un producto esté retirado y publicado a la vez.

---

### RF-MOD-03 — Restaurar un producto

**Endpoint:** `POST /api/v1/admin/products/:id/restore`
**Body:** `{ "reason": "…" }`

#### Criterios de aceptación (EARS)

1. CUANDO el administrador restaure un producto retirado con motivo, EL sistema DEBERÁ quitar el retiro y volver a publicarlo solo si su stock alcanza el pedido mínimo.
2. SI el producto no está retirado, ENTONCES EL sistema DEBERÁ responder 400 «El producto no está retirado.».

---

### RF-MOD-04 — Listar productos retirados

**Endpoint:** `GET /api/v1/admin/products/retired`
**Respuesta:** hasta 100 productos `{ id, name, supplier, retiredAt, reason }`, los más recientes primero.

---

### RF-MOD-05 — Suspender una empresa

**Endpoint:** `POST /api/v1/admin/companies/:id/suspend`
**Body:** `{ "reason": "…" }`

#### Criterios de aceptación (EARS)

1. CUANDO el administrador suspenda una empresa habilitada con motivo, EL sistema DEBERÁ cambiar su estado, guardar el motivo, cerrar todas las sesiones de sus usuarios y registrar la acción.
2. SI la empresa no está habilitada, ENTONCES EL sistema DEBERÁ responder 400 «Solo se puede suspender una empresa habilitada.».
3. MIENTRAS esté suspendida, SI uno de sus usuarios intenta ingresar, ENTONCES EL sistema DEBERÁ responder 403 «Tu empresa está suspendida por el administrador. Motivo: …».
4. MIENTRAS esté suspendida, EL catálogo y las opciones de filtro NO DEBERÁN mostrar sus productos.

---

### RF-MOD-06 — Reactivar una empresa

**Endpoint:** `POST /api/v1/admin/companies/:id/reactivate`
**Body:** `{ "reason": "…" }`

#### Criterios de aceptación (EARS)

1. CUANDO el administrador reactive una empresa suspendida con motivo, EL sistema DEBERÁ habilitarla, borrar el motivo de suspensión y registrar la acción.
2. SI la empresa no está suspendida, ENTONCES EL sistema DEBERÁ responder 400 «La empresa no está suspendida.».

---

### RF-MOD-07 — Buscar empresas registradas

**Endpoint:** `GET /api/v1/admin/companies?q=`
**Respuesta:** hasta 100 empresas `{ id, ruc, legalName, status, suspendedReason, supplierVerified, publishedProducts }`.

#### Criterios de aceptación (EARS)

1. CUANDO se envíe `q` (hasta 100 caracteres), EL sistema DEBERÁ buscar de forma literal en la razón social y el RUC.
2. EL listado DEBERÁ mostrar primero las empresas suspendidas y luego en orden alfabético.

---

### RF-MOD-08 — Bitácora de moderación

**Endpoint:** `GET /api/v1/admin/moderation`
**Respuesta:** las 50 acciones más recientes `{ id, action, resourceId, resourceName, reason, createdAt, actor }`.

**Acciones registradas:** `retire-product`, `restore-product`, `suspend-company`, `reactivate-company`, `reject-enrollment`.

#### Criterios de aceptación (EARS)

1. EL sistema DEBERÁ listar las acciones más recientes primero, con el correo del administrador.
2. Las acciones NO DEBERÁN poder editarse ni borrarse desde la aplicación.

---

### RF-MOD-09 — Interfaz de moderación

**Componentes:** `apps/web/src/identity.ts` (Panel de administración) y la ficha del producto en `catalog.ts`.

- Botón «Retirar producto» en la ficha, visible solo para el administrador, que pide el motivo.
- Secciones «Empresas registradas» (con buscador, Suspender y Reactivar), «Productos retirados» (con Restaurar) y «Bitácora de moderación».

---

## 6. Requisitos no funcionales

| ID | Atributo | Detalle |
| -- | -------- | ------- |
| RNF-MOD-01 | Seguridad | Todas las rutas exigen sesión de administrador de plataforma (403 en otro caso) |
| RNF-MOD-02 | Integridad | `CHECK (retired_at IS NULL OR NOT published)` en PostgreSQL: la regla se cumple aunque se escriba SQL directo |
| RNF-MOD-03 | Atomicidad | Cada acción cambia el recurso y registra la bitácora en la misma transacción |
| RNF-MOD-04 | Efecto inmediato | Suspender borra las sesiones; el catálogo se invalida por los triggers de revisión |
| RNF-MOD-05 | Auditoría | `moderation_actions` con motivo obligatorio de 5 a 500 caracteres |
| RNF-MOD-06 | Transparencia | El afectado ve el motivo al iniciar sesión o al intentar publicar |

---

## 7. Criterios de aceptación del módulo

- [x] Retirar con motivo «abc» → 400.
- [x] Retirar como comprador → 403.
- [x] Producto retirado → desaparece del catálogo público.
- [x] Publicar un producto retirado → 403 con el motivo.
- [x] La carga masiva no republica un producto retirado.
- [x] Restaurar un producto con stock suficiente → vuelve a publicarse.
- [x] Suspender → el usuario de la empresa ya no puede usar su token.
- [x] Iniciar sesión en una empresa suspendida → 403 con el motivo.
- [x] Productos de empresas suspendidas → fuera del catálogo y de las opciones.
- [x] Reactivar → la empresa vuelve a operar.
- [x] Cada acción aparece en la bitácora con su motivo.

---

## 8. Estados de producto y empresa

```
PRODUCTO                                   EMPRESA

 PUBLICADO / OCULTO                         HABILITADA
       │                                      │      ▲
 [RETIRAR + motivo]                  [SUSPENDER]   [REACTIVAR]
       ▼                                      ▼      │
    RETIRADO  (no se puede publicar)        SUSPENDIDA
       │                                (sesiones cerradas,
 [RESTAURAR + motivo]                    catálogo oculto)
       ▼
 PUBLICADO si stock ≥ mínimo, si no OCULTO

 Toda flecha → INSERT en moderation_actions
```

---

## 9. Trazabilidad SDD

| Artefacto | Archivo |
| --------- | ------- |
| Diseño técnico | [`design.md`](design.md) |
| Tareas de implementación | [`tasks.md`](tasks.md) |
| Controlador | `apps/api/src/identity/identity.controller.ts` |
| Servicio | `apps/api/src/identity/identity.service.ts` (sección «Moderación») |
| Catálogo | `apps/api/src/catalog/infrastructure/postgres-products.ts` (excluye suspendidas) |
| Carga masiva | `apps/api/src/catalog/application/catalog-imports.ts` (no republica retirados) |
| Migraciones | `database/migrations/011_moderation.sql`, `013_reject_enrollment.sql` |
| Frontend | `apps/web/src/identity.ts`, `apps/web/src/catalog.ts` |
| Pruebas | `tests/identity.integration.cjs`, `tests/openapi.test.cjs` |
