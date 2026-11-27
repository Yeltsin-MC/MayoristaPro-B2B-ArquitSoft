# Especificación de Requisitos — Avisos y «Volver a pedir»

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 06 · Avisos y «Volver a pedir»                               |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Contexto

En un flujo B2B participan varias partes: el comprador, uno o más proveedores y la pasarela de pago. Cada empresa necesita enterarse de lo que le toca hacer (responder una cotización, preparar un pedido pagado, confirmar una entrega) sin revisar pantalla por pantalla.

Este módulo agrega una **campana 🔔** en el encabezado con el número de avisos sin leer y un panel con los últimos avisos, cada uno con enlace a la cotización o el pedido. También agrega el botón **«↻ Volver a pedir»**, que repite una compra entregada en un clic, un caso típico del abastecimiento recurrente mayorista (por ejemplo, la bodega que compra arroz cada semana).

---

## 2. Objetivo

- Generar un aviso en cada paso del flujo comercial, para la empresa que debe actuar.
- Garantizar que el aviso se genere sin importar desde dónde se hizo el cambio (API, webhook o worker).
- Mostrar la campana con contador y los últimos 20 avisos, y marcarlos como leídos.
- Repetir un pedido entregado creando una nueva solicitud de cotización.

---

## 3. Actores involucrados

| Actor | Permisos en este módulo |
| ----- | ----------------------- |
| Comprador (`buy`) | Recibe avisos de ofertas y de avance del pedido; usa «Volver a pedir» |
| Proveedor (`publish`) | Recibe avisos de solicitudes, ofertas aceptadas, pedidos, pagos y entregas |
| Administrador de plataforma | No ve la campana (no pertenece a ninguna empresa) |
| PostgreSQL (triggers) | Genera los avisos dentro de la misma transacción del cambio |

---

## 4. Glosario

| Término | Definición |
| ------- | ---------- |
| Aviso | Fila de `notifications` dirigida a una empresa, con tipo, título y enlace |
| No leído | Aviso con `read_at` vacío; cuenta para el número rojo de la campana |
| Tipo de aviso | `quote-request`, `offer`, `offer-accepted`, `order`, `order-paid`, `order-preparing`, `order-dispatched`, `order-delivered` |
| Volver a pedir | Crear una nueva solicitud al mismo proveedor con los mismos productos, presentaciones y cantidades |

---

## 5. Requisitos funcionales

### RF-AVI-01 — Generar avisos en cada paso

| Evento | Destinatario | Tipo | Título |
| ------ | ------------ | ---- | ------ |
| Se envía una solicitud de cotización | Cada proveedor destinatario | `quote-request` | «Nueva solicitud de cotización de <comprador>» |
| Un proveedor envía su oferta | Comprador | `offer` | «Nueva oferta de <proveedor>» |
| El comprador acepta una oferta | Proveedor ganador | `offer-accepted` | «<comprador> aceptó tu oferta» |
| Se crea el pedido | Proveedor | `order` | «Nuevo pedido de <comprador>» |
| El pedido pasa a `paid` | Proveedor | `order-paid` | «<comprador> pagó su pedido. Ya puedes prepararlo» |
| El pedido pasa a `preparing` | Comprador | `order-preparing` | «<proveedor> está preparando tu pedido» |
| El pedido pasa a `dispatched` | Comprador | `order-dispatched` | «<proveedor> despachó tu pedido» |
| El pedido pasa a `delivered` | Proveedor | `order-delivered` | «<comprador> confirmó la entrega del pedido» |

#### Criterios de aceptación (EARS)

1. CUANDO ocurra cada evento de la tabla, EL sistema DEBERÁ crear el aviso para el destinatario indicado, con enlace a `/cuenta/cotizaciones/<id>` o `/cuenta/pedidos/<id>`.
2. EL aviso DEBERÁ generarse aunque el cambio venga de un camino distinto de la API web (por ejemplo, el webhook de Mercado Pago o el worker).
3. SI la transacción que causó el evento se revierte, ENTONCES EL aviso NO DEBERÁ existir.

---

### RF-AVI-02 — Consultar avisos

**Endpoint:** `GET /api/v1/notifications`
**Acceso:** Usuario de una empresa habilitada · `Cache-Control: no-store`
**Respuesta:** `{ unread, items: [{ id, kind, title, link, createdAt, read }] }`

#### Criterios de aceptación (EARS)

1. EL sistema DEBERÁ devolver los últimos 20 avisos de la empresa del usuario, del más reciente al más antiguo, y el total de no leídos.
2. Un usuario NO DEBERÁ ver avisos de otra empresa.

---

### RF-AVI-03 — Marcar como leídos

**Endpoint:** `POST /api/v1/notifications/read`
**Respuesta:** `{ unread: 0 }`

#### Criterios de aceptación (EARS)

1. CUANDO el usuario marque los avisos como leídos, EL sistema DEBERÁ fijar `read_at` en todos los no leídos de su empresa y el contador DEBERÁ quedar en 0.

---

### RF-AVI-04 — Campana en el encabezado

**Componente:** `apps/web/src/notifications.ts`

#### Criterios de aceptación (EARS)

1. EL encabezado DEBERÁ mostrar la campana con el número de no leídos, actualizado cada 30 segundos mientras la pestaña esté visible.
2. CUANDO el usuario abra la campana, EL sistema DEBERÁ mostrar el panel con los últimos 20 avisos y enlaces.
3. EL panel DEBERÁ cerrarse al hacer clic fuera o al presionar Escape.
4. El administrador de plataforma y los usuarios sin permisos NO DEBERÁN ver la campana.

---

### RF-AVI-05 — Volver a pedir

**Endpoint:** `POST /api/v1/orders/:id/reorder`
**Acceso:** Comprador de la empresa compradora del pedido

#### Criterios de aceptación (EARS)

1. CUANDO el comprador presione «↻ Volver a pedir» en un pedido `delivered`, EL sistema DEBERÁ crear una nueva solicitud de cotización al mismo proveedor, con los mismos productos, presentaciones y cantidades.
2. SI el pedido no está entregado, ENTONCES EL sistema DEBERÁ responder 422 «Solo puedes volver a pedir un pedido entregado.».
3. SI el pedido no pertenece a la empresa o el usuario no tiene permiso `buy`, ENTONCES EL sistema DEBERÁ responder 404.
4. La nueva solicitud DEBERÁ seguir el flujo normal (oferta, aceptación y pedido); no se reutilizan precios anteriores.

---

## 6. Requisitos no funcionales

| ID | Atributo | Detalle |
| -- | -------- | ------- |
| RNF-AVI-01 | Confiabilidad | Los avisos se crean con triggers en la misma transacción: no se pierden ni se duplican |
| RNF-AVI-02 | Rendimiento | Índice `(company_id, id DESC)` para la lista e índice parcial de no leídos para el contador |
| RNF-AVI-03 | Privacidad | Filtro por empresa en el servidor; respuestas con `Cache-Control: no-store` |
| RNF-AVI-04 | Eficiencia | Consulta periódica cada 30 s solo con la pestaña visible |
| RNF-AVI-05 | Integridad | `title` de hasta 300 caracteres y `link` que empieza con `/` (sin enlaces externos) |
| RNF-AVI-06 | Accesibilidad | Botón de la campana con nombre accesible y contador anunciado |

---

## 7. Criterios de aceptación del módulo

- [x] Enviar una solicitud → el proveedor ve un aviso nuevo.
- [x] El proveedor oferta → el comprador ve «Nueva oferta de …».
- [x] Pago aprobado por webhook → el proveedor ve «… pagó su pedido».
- [x] Preparar y despachar → el comprador recibe cada aviso.
- [x] Confirmar entrega → el proveedor recibe el aviso.
- [x] Marcar como leídos → contador en 0.
- [x] Otra empresa no ve estos avisos.
- [x] Volver a pedir un pedido entregado → nueva solicitud con los mismos ítems.
- [x] Volver a pedir un pedido no entregado → rechazado con el motivo.

---

## 8. Flujo de avisos a lo largo del pedido

```
 COMPRADOR                         SISTEMA (triggers)                 PROVEEDOR
     │  envía solicitud ─────────────► quote-request ─────────────────► 🔔
     │ 🔔 ◄─────────────────────────── offer ◄──────────────── envía oferta
     │  acepta oferta ───────────────► offer-accepted ────────────────► 🔔
     │  crea pedido ─────────────────► order ─────────────────────────► 🔔
 Mercado Pago aprueba (webhook) ─────► order-paid ────────────────────► 🔔
     │ 🔔 ◄─────────────────────────── order-preparing ◄──────── prepara
     │ 🔔 ◄─────────────────────────── order-dispatched ◄─────── despacha
     │  confirma entrega ────────────► order-delivered ───────────────► 🔔
     │
     └─ «↻ Volver a pedir» ──────────► nueva solicitud ─► quote-request ► 🔔
```

---

## 9. Trazabilidad SDD

| Artefacto | Archivo |
| --------- | ------- |
| Diseño técnico | [`design.md`](design.md) |
| Tareas de implementación | [`tasks.md`](tasks.md) |
| Migración y triggers | `database/migrations/012_notifications.sql` |
| Controlador | `apps/api/src/trade/presentation/trade.controller.ts` |
| Repositorio | `apps/api/src/trade/infrastructure/postgres-trade.ts` (`notifications()`, `readNotifications()`, `reorder()`) |
| Frontend | `apps/web/src/notifications.ts`, `apps/web/src/trade.ts` |
| Pruebas | `tests/fulfillment.integration.cjs` |
