# Tareas de implementación — Avisos y «Volver a pedir»

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 06 · Avisos y «Volver a pedir»                               |
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
| 3 | Backend | 3.1 – 3.3 | ✓ |
| 4 | Frontend | 4.1 – 4.2 | ✓ |
| 5 | Pruebas y documentación | 5.1 – 5.2 | ✓ |

---

## Fase 1 — Análisis y especificación

### Tarea 1.1 — Definir qué avisar y a quién

**Descripción:** Recorrer el flujo comercial e identificar los 8 eventos que requieren que otra empresa actúe, con su destinatario, título y enlace.

**Resultado:** [`requirements.md`](requirements.md) con 5 RF, 6 RNF y la tabla de eventos.

**Estado:** ✓ Completado

---

### Tarea 1.2 — Elegir cómo generar los avisos

**Descripción:** Comparar llamadas desde el código frente a triggers; elegir triggers porque el webhook de pago y los workers no pasan por el servicio web. Elegir consulta periódica en lugar de WebSockets.

**Resultado:** [`design.md`](design.md) con la tabla de la función `notify_trade_event()` y decisiones.

**Estado:** ✓ Completado

---

## Fase 2 — Base de datos

### Tarea 2.1 — Tabla e índices

**Archivo:** `database/migrations/012_notifications.sql`

**Descripción:** Crear `notifications` con `title` ≤ 300, `link` interno (`LIKE '/%'`), índice por empresa e índice parcial de no leídos.

**Requisitos:** RF-AVI-02, RNF-AVI-02 · **Estado:** ✓ Completado

---

### Tarea 2.2 — Función y triggers

**Archivo:** `database/migrations/012_notifications.sql`

**Descripción:** Función `notify_trade_event()` y triggers `AFTER INSERT` / `AFTER UPDATE` en `quotation_recipients`, `quotation_offers`, `quotation_requests` y `trade_orders`.

**Casos validados:**

- [x] 2.2.1 Solicitud a 3 proveedores → 3 avisos `quote-request`.
- [x] 2.2.2 Cambio de estado del pedido → un aviso por transición.
- [x] 2.2.3 `UPDATE` sin cambio de estado → ningún aviso.

**Requisitos:** RF-AVI-01 · **Estado:** ✓ Completado

---

## Fase 3 — Backend

### Tarea 3.1 — `GET /notifications`

**Archivo:** `postgres-trade.ts → notifications()`

**Descripción:** Últimos 20 avisos de la empresa y conteo de no leídos, con `Cache-Control: no-store`.

**Requisitos:** RF-AVI-02 · **Estado:** ✓ Completado

---

### Tarea 3.2 — `POST /notifications/read`

**Archivo:** `postgres-trade.ts → readNotifications()`

**Requisitos:** RF-AVI-03 · **Estado:** ✓ Completado

---

### Tarea 3.3 — `POST /orders/:id/reorder`

**Archivo:** `postgres-trade.ts → reorder()` (extrae y reusa `createRequest()`)

**Casos validados:**

- [x] 3.3.1 Pedido entregado → nueva solicitud con los mismos ítems y el mismo proveedor.
- [x] 3.3.2 El proveedor intenta volver a pedir → 404.
- [x] 3.3.3 Pedido no entregado → 422 (regla `o.state === 'delivered'`).

**Requisitos:** RF-AVI-05 · **Estado:** ✓ Completado

---

## Fase 4 — Frontend

### Tarea 4.1 — Campana en el encabezado

**Archivo:** `apps/web/src/notifications.ts`

**Descripción:** Componente con contador, panel desplegable, «Marcar como leídos», consulta cada 30 s con la pestaña visible, cierre al hacer clic fuera o con Escape, animación al llegar un aviso nuevo, y visible solo para usuarios de empresa con permisos.

**Requisitos:** RF-AVI-04 · **Estado:** ✓ Completado

---

### Tarea 4.2 — Botón «↻ Volver a pedir»

**Archivo:** `apps/web/src/trade.ts`

**Descripción:** Mostrar el botón en pedidos entregados y llevar al comprador a la nueva solicitud creada.

**Requisitos:** RF-AVI-05 · **Estado:** ✓ Completado

---

## Fase 5 — Pruebas y documentación

### Tarea 5.1 — Pruebas de integración (Jest + PostgreSQL)

| Prueba | Archivo y subprueba | Qué valida |
| ------ | ------------------- | ---------- |
| PI-AVI-01 | `tests/fulfillment.integration.cjs` · «Avisos de cada paso y "Volver a pedir" tras la entrega» | Avisos de solicitud, oferta, aceptación, pedido, preparación, despacho y entrega; lectura; volver a pedir |
| PN-AVI-01 | `tests/catalog.browser.cjs` | El administrador no ve la campana |

**Estado:** ✓ Completado

---

### Tarea 5.2 — Contrato OpenAPI

**Archivo:** `apps/api/openapi.yaml` (etiqueta «Avisos») · prueba `tests/openapi.test.cjs`

**Estado:** ✓ Completado

---

## Pendientes

- [ ] Avisos por correo o WhatsApp (fuera del alcance de la demo).
- [ ] Marcar un solo aviso como leído al abrir su enlace.

---

## Lista de tareas

Cada tarea tiene un código único `T###`, la fase a la que pertenece y los requisitos que cubre. `[x]` es completada y `[ ]` pendiente.

- [x] T001 [Fase 1] Definir qué avisar y a quién (Tarea 1.1)
- [x] T002 [Fase 1] Elegir cómo generar los avisos (Tarea 1.2)
- [x] T003 [Fase 2] Tabla e índices (Tarea 2.1) → RF-AVI-02, RNF-AVI-02
- [x] T004 [Fase 2] Función y triggers (Tarea 2.2) → RF-AVI-01
- [x] T005 [Fase 3] `GET /notifications` (Tarea 3.1) → RF-AVI-02
- [x] T006 [Fase 3] `POST /notifications/read` (Tarea 3.2) → RF-AVI-03
- [x] T007 [Fase 3] `POST /orders/:id/reorder` (Tarea 3.3) → RF-AVI-05
- [x] T008 [Fase 4] Campana en el encabezado (Tarea 4.1) → RF-AVI-04
- [x] T009 [Fase 4] Botón «↻ Volver a pedir» (Tarea 4.2) → RF-AVI-05
- [x] T010 [Fase 5] Pruebas de integración (Jest + PostgreSQL) (Tarea 5.1)
- [x] T011 [Fase 5] Contrato OpenAPI (Tarea 5.2)

### Dependencias

```
T001–T002 → T003–T004 → T005–T007 → T008–T009 → T010–T011
```

Cada fase empieza cuando la anterior está completa: primero la especificación, luego la base de datos y el backend, después la interfaz y al final las pruebas. Dentro de una fase, las tareas se hicieron en el orden de la lista.

---

## Registro de ejecución

Bitácora de cómo se construyó el módulo, con la fecha en que se fusionó cada cambio a `main`. Cada entrada enlaza su pull request, donde están los commits y el resultado del CI.

### 22/11/2026 · Avisos y «Volver a pedir» ([#30](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/30))

**Qué se hizo:** Migración `012_notifications.sql` con el trigger `notify_trade_event()` (8 tipos), campana con contador y botón para repetir un pedido entregado.

**Resultado:** `fulfillment.integration.cjs` y `catalog.browser.cjs` en verde.

### 25/11/2026 · Campana animada ([#41](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/41))

**Qué se hizo:** Animación de la campana cuando llegan avisos nuevos.

**Resultado:** Revisión visual en local.

### 27/11/2026 · Especificación ampliada

**Qué se hizo:** Se ampliaron `requirements.md`, `design.md` y este archivo con requisitos EARS, diagramas, decisiones, lista de tareas y este registro.

**Resultado:** Documentación al día con el código desplegado en https://mayoristapro.shop.

---

## Trazabilidad completa del módulo

```
requirements.md            design.md                    tasks.md
      │                        │                            │
      │ RF-AVI-01..05          │ notify_trade_event()       │ Tareas 2.1..2.2 (BD)
      │ RNF-AVI-01..06         │ postgres-trade.ts          │ Tareas 3.1..3.3 (API)
      │ Tabla de eventos       │ notifications.ts           │ Tareas 4.1..4.2 (web)
      │ Criterios EARS         │ reorder → createRequest    │ PI-AVI-01, PN-AVI-01
      └────────────────────────┴────────────────────────────┘
                               │
                      CÓDIGO IMPLEMENTADO
                               │
                      PRUEBAS EJECUTADAS (CI)
                               │
                   https://mayoristapro.shop ✓
```
