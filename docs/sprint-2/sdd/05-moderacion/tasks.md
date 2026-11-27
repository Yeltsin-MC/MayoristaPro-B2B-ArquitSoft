# Tareas de implementación — Moderación del administrador

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 05 · Moderación del administrador                            |
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
| 3 | Backend | 3.1 – 3.5 | ✓ |
| 4 | Frontend | 4.1 – 4.2 | ✓ |
| 5 | Pruebas y documentación | 5.1 – 5.3 | ✓ |

---

## Fase 1 — Análisis y especificación

### Tarea 1.1 — Definir las acciones de moderación

**Descripción:** Definir retiro y restauración de productos, suspensión y reactivación de empresas, la bitácora y los mensajes que ve el afectado.

**Resultado:** [`requirements.md`](requirements.md) con 9 RF, 6 RNF y criterios EARS.

**Estado:** ✓ Completado

---

### Tarea 1.2 — Diseñar dónde vive la moderación

**Descripción:** Decidir extender `identity` (ya tiene la autorización del administrador), poner la regla «retirado nunca publicado» como restricción de la base y reusar los triggers de caché.

**Resultado:** [`design.md`](design.md) con secuencias de retiro y suspensión, y los puntos de control en otros flujos.

**Estado:** ✓ Completado

---

## Fase 2 — Base de datos

### Tarea 2.1 — Migración `011_moderation.sql`

**Descripción:** Agregar `products.retired_at` y `retired_reason`, la restricción `products_retired_unpublished`, el estado `suspended` con `companies.suspended_reason` y la tabla `moderation_actions` con motivo de 5 a 500 caracteres.

**Requisitos:** RF-MOD-01, 05, 08 · **Estado:** ✓ Completado

---

### Tarea 2.2 — Migración `013_reject_enrollment.sql`

**Descripción:** Permitir la acción `reject-enrollment` en la bitácora.

**Requisitos:** RF-MOD-08 · **Estado:** ✓ Completado

---

## Fase 3 — Backend

### Tarea 3.1 — Validación del motivo y registro en bitácora

**Archivo:** `identity.service.ts → reason(), moderation()`

**Requisitos:** RF-MOD-01, 08 · **Estado:** ✓ Completado

---

### Tarea 3.2 — Retirar y restaurar productos

**Archivo:** `identity.service.ts → retireProduct(), restoreProduct(), retiredProducts()`

**Casos validados:**

- [x] 3.2.1 Retirar con motivo de 3 letras → 400.
- [x] 3.2.2 Retirar dos veces → 400 la segunda.
- [x] 3.2.3 Restaurar con stock suficiente → publicado.
- [x] 3.2.4 Restaurar sin stock suficiente → queda oculto.

**Requisitos:** RF-MOD-01, 03, 04 · **Estado:** ✓ Completado

---

### Tarea 3.3 — Impedir la republicación

**Archivos:** `identity.service.ts → publish()`, `catalog-imports.ts → confirm()`

**Descripción:** Rechazar la publicación manual con el motivo; en la carga masiva, calcular `published = (valor AND retired_at IS NULL)`.

**Requisitos:** RF-MOD-02 · **Estado:** ✓ Completado

---

### Tarea 3.4 — Suspender y reactivar empresas

**Archivos:** `identity.service.ts → suspendCompany(), reactivateCompany(), companies(), login()`, `postgres-products.ts`

**Casos validados:**

- [x] 3.4.1 Suspender → se borran las sesiones de sus usuarios.
- [x] 3.4.2 Iniciar sesión → 403 con el motivo.
- [x] 3.4.3 Catálogo y opciones → sin productos de la empresa.
- [x] 3.4.4 Suspender una empresa pendiente → 400.
- [x] 3.4.5 Reactivar → vuelve a operar.

**Requisitos:** RF-MOD-05, 06, 07 · **Estado:** ✓ Completado

---

### Tarea 3.5 — Rutas del controlador

**Archivo:** `identity.controller.ts`

**Descripción:** Exponer las 8 rutas `admin/...` de moderación y rechazo, todas protegidas con `actor(db, auth, true)`.

**Requisitos:** todos · **Estado:** ✓ Completado

---

## Fase 4 — Frontend

### Tarea 4.1 — «Retirar producto» en la ficha

**Archivo:** `apps/web/src/catalog.ts`

**Descripción:** Botón visible solo para el administrador; pide el motivo y, al confirmar, el producto desaparece del catálogo.

**Requisitos:** RF-MOD-01, RF-MOD-09 · **Estado:** ✓ Completado

---

### Tarea 4.2 — Secciones del Panel de administración

**Archivo:** `apps/web/src/identity.ts`

**Descripción:** «Empresas registradas» con buscador y botones Suspender/Reactivar, «Productos retirados» con Restaurar y «Bitácora de moderación»; el panel se actualiza solo cada 30 s.

**Requisitos:** RF-MOD-04 a 09 · **Estado:** ✓ Completado

---

## Fase 5 — Pruebas y documentación

### Tarea 5.1 — Pruebas de integración (Jest + PostgreSQL)

| Prueba | Subprueba en `tests/identity.integration.cjs` |
| ------ | --------------------------------------------- |
| PI-MOD-01 | moderación: retirar producto y suspender empresa con bitácora |
| PI-MOD-02 | rechazar una solicitud falsa borra la cuenta pendiente y libera el RUC |
| PI-MOD-03 | `tests/imports.integration.cjs`: la carga no republica retirados |

**Estado:** ✓ Completado

---

### Tarea 5.2 — Contrato OpenAPI

**Archivo:** `apps/api/openapi.yaml` · prueba `tests/openapi.test.cjs`

**Descripción:** Documentar las rutas de administración con sus cuerpos y respuestas; la prueba compara las rutas de Nest con el contrato.

**Estado:** ✓ Completado

---

### Tarea 5.3 — Revisión visual

**Comando:** `npm run revisar:front` ([guía](../../../guias/revision-frontend.md))

**Descripción:** Revisar el Panel de administración de 320 a 1440 px y en modo oscuro.

**Estado:** ✓ Completado

---

## Pendientes

- [ ] Avisar por correo a la empresa afectada (hoy el motivo se muestra al ingresar o al publicar).
- [ ] Permitir que la empresa apele una suspensión desde la aplicación.

---

## Trazabilidad completa del módulo

```
requirements.md            design.md                    tasks.md
      │                        │                            │
      │ RF-MOD-01..09          │ identity.controller.ts     │ Tareas 2.1..2.2 (BD)
      │ RNF-MOD-01..06         │ identity.service.ts        │ Tareas 3.1..3.5 (API)
      │ Estados                │ CHECK en PostgreSQL        │ Tareas 4.1..4.2 (web)
      │ Criterios EARS         │ triggers de caché          │ PI-MOD-01..03
      └────────────────────────┴────────────────────────────┘
                               │
                      CÓDIGO IMPLEMENTADO
                               │
                      PRUEBAS EJECUTADAS (CI)
                               │
                   https://mayoristapro.shop ✓
```
