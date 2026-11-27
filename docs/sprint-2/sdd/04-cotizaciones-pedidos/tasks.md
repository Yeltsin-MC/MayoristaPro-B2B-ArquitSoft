# Tareas de implementación — Cotizaciones, pedidos, pago y despacho

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 04 · Cotizaciones, pedidos, pago y despacho                  |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Completado ✓                                                 |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## Resumen de fases

| Fase | Descripción | Tareas | Estado |
| ---- | ----------- | ------ | ------ |
| 1 | Análisis y especificación | 1.1 – 1.2 | ✓ |
| 2 | Base de datos | 2.1 – 2.4 | ✓ |
| 3 | Dominio | 3.1 – 3.3 | ✓ |
| 4 | Backend de comercio | 4.1 – 4.5 | ✓ |
| 5 | Backend de pagos y workers | 5.1 – 5.5 | ✓ |
| 6 | Frontend | 6.1 – 6.4 | ✓ |
| 7 | Pruebas | 7.1 – 7.4 | ✓ |

---

## Fase 1 — Análisis y especificación

### Tarea 1.1 — Definir el flujo comercial

**Descripción:** Modelar el flujo cotización → oferta → aceptación → pedido → pago → despacho, con sus actores, estados y reglas de dinero, stock e idempotencia.

**Resultado:** [`requirements.md`](requirements.md) con 8 RF, 7 RNF, ciclo de vida del pedido y criterios EARS.

**Estado:** ✓ Completado

---

### Tarea 1.2 — Diseñar la concurrencia

**Descripción:** Definir el orden de bloqueos (asesor por clave → tabla `products` en `ROW EXCLUSIVE` → filas por ID ordenado), el reintento ante interbloqueo y la compatibilidad con la carga masiva.

**Resultado:** [`design.md`](design.md) con los 10 pasos de `order()` y la tabla de códigos de error.

**Estado:** ✓ Completado

---

## Fase 2 — Base de datos

### Tarea 2.1 — Migración `004_trade.sql`

**Descripción:** Solicitudes, ítems, destinatarios, ofertas, líneas, pedidos, líneas de pedido, reservas y `order_keys`, con FK compuestas y `CHECK` de importes (`total = subtotal + shipping`, `subtotal = unit_price × quantity`).

**Requisitos:** RF-COT-01, 02, 04, 05 · **Estado:** ✓ Completado

---

### Tarea 2.2 — Migraciones `005_payments.sql` y `006_add_payment_pending_state.sql`

**Descripción:** `trade_orders.expires_at` (+30 min), nuevos estados del pedido y de la reserva, `payment_attempts`, `payment_webhook_events` (único por `notification_id`), `payment_reconciliations`, funciones `count_active_payment_attempts` y `can_create_payment_attempt`, e índice único parcial de intentos activos.

**Requisitos:** RF-COT-06 · **Estado:** ✓ Completado

---

### Tarea 2.3 — Migración `009_order_fulfillment.sql`

**Descripción:** Estados `preparing`, `dispatched` y `delivered`, y tabla `trade_order_events` con nota de 1 a 300 caracteres.

**Requisitos:** RF-COT-07 · **Estado:** ✓ Completado

---

### Tarea 2.4 — Migración `014_delivery_addresses.sql`

**Descripción:** Dirección de la empresa y `quotation_requests.delivery` (jsonb) con modalidad `envio`, `recojo` o `agencia`.

**Requisitos:** RF-COT-01 · **Estado:** ✓ Completado

---

## Fase 3 — Dominio

### Tarea 3.1 — Dinero exacto

**Archivo:** `trade/domain/trade.ts → money(), amount(), priceTotal()`

**Casos validados:**

- [x] 3.1.1 `"12.345"` → `INVALID_INPUT`.
- [x] 3.1.2 Totales grandes sin pérdida de precisión.

**Requisitos:** RNF-COT-01 · **Estado:** ✓ Completado

---

### Tarea 3.2 — Reglas de solicitud, oferta y entrega

**Archivo:** `trade/domain/trade.ts → requestDraft(), offerDraft(), deliveryDraft(), assertCoversRequest(), offerLines(), assertAcceptable(), reservationQuantities()`

**Casos validados:**

- [x] 3.2.1 Docena con 10 unidades → 422.
- [x] 3.2.2 Vigencia sin zona horaria → 422.
- [x] 3.2.3 Oferta que no cubre todos los ítems → 422.
- [x] 3.2.4 Entrega `envio` sin dirección → 422; `recojo` sin dirección → válido.

**Requisitos:** RF-COT-01, 02 · **Estado:** ✓ Completado

---

### Tarea 3.3 — Transiciones de despacho

**Archivo:** `trade/domain/fulfillment.ts → fulfillmentDraft(), assertFulfillment()`

**Descripción:** Tabla `TRANSITIONS` con desde qué estado y qué rol; repetir la misma transición devuelve `false` (no hace nada).

**Requisitos:** RF-COT-07 · **Estado:** ✓ Completado

---

## Fase 4 — Backend de comercio

### Tarea 4.1 — Solicitudes y Lista de pedido

**Archivos:** `trade.controller.ts`, `application/trade.ts`, `postgres-trade.ts → create(), createRequest(), requests(), detail()`

**Descripción:** Crear la solicitud con destinatarios verificados (sin la propia empresa), copiar la dirección de entrega y listar solo lo que corresponde a cada participante.

**Requisitos:** RF-COT-01 · **Estado:** ✓ Completado

---

### Tarea 4.2 — Ofertas privadas

**Archivo:** `postgres-trade.ts → respond()`

**Descripción:** Validar que el proveedor sea destinatario, que no haya respondido antes (`ALREADY_RESPONDED`), que no exista oferta aceptada y que los productos sean suyos; guardar líneas con snapshot.

**Requisitos:** RF-COT-02 · **Estado:** ✓ Completado

---

### Tarea 4.3 — Puntaje con IA

**Archivos:** `ai/application/ai.service.ts`, `apps/ai-service/main.py`

**Descripción:** Enviar las ofertas al servicio FastAPI y devolverlas con puntaje (50 % precio, 30 % plazo, 20 % reputación); si no responde, `ai_service_available: false`.

**Requisitos:** RF-COT-03 · **Estado:** ✓ Completado

---

### Tarea 4.4 — Aceptación única

**Archivo:** `postgres-trade.ts → accept()`

**Casos validados:**

- [x] 4.4.1 Dos compradores de la misma empresa aceptan ofertas distintas a la vez → una gana, la otra 409.
- [x] 4.4.2 Aceptar de nuevo la misma oferta → mismo resultado.
- [x] 4.4.3 El proveedor intenta aceptar → 403.

**Requisitos:** RF-COT-04 · **Estado:** ✓ Completado

---

### Tarea 4.5 — Pedido idempotente con reserva atómica

**Archivo:** `postgres-trade.ts → order()`

**Casos validados:**

- [x] 4.5.1 Misma clave → mismo pedido y una sola reserva.
- [x] 4.5.2 Misma clave con otra oferta → `IDEMPOTENCY_CONFLICT`.
- [x] 4.5.3 Oferta vencida → sin pedido ni descuento.
- [x] 4.5.4 Dos compradores piden 4 de un stock de 5 → uno solo lo consigue.
- [x] 4.5.5 Fallo SQL después del descuento → todo revertido.

**Requisitos:** RF-COT-05 · **Estado:** ✓ Completado

---

## Fase 5 — Backend de pagos y workers

### Tarea 5.1 — Intentos de pago

**Archivos:** `payments/domain/payment.ts`, `application/payments.ts → createPaymentAttempt(), getOrderAttempts()`

**Descripción:** Máximo 3 intentos, uno activo, solo pedidos `pendiente` no vencidos; crear la preferencia en el gateway.

**Requisitos:** RF-COT-06 · **Estado:** ✓ Completado

---

### Tarea 5.2 — Gateway de Mercado Pago y pago de prueba

**Archivos:** `infrastructure/mercadopago-gateway.ts`, `application/payments.ts → simulatedCheckout(), simulatePayment()`

**Descripción:** Con `MP_ACCESS_TOKEN`, Checkout Pro en sandbox; sin él, pago de prueba con Tarjeta, Yape o PagoEfectivo (CIP de 8 dígitos). Guía en [`docs/guias/mercadopago-sandbox.md`](../../../guias/mercadopago-sandbox.md).

**Requisitos:** RF-COT-06 · **Estado:** ✓ Completado

---

### Tarea 5.3 — Webhook firmado e idempotente

**Archivos:** `presentation/payments.controller.ts → handleWebhook(), verifyWebhookSignature()`, `application/payments.ts → processWebhookNotification()`

**Descripción:** Aceptar ambos formatos de notificación, verificar la firma HMAC, registrar el evento una vez y aplicar el estado con `applyPaymentInfo()`.

**Requisitos:** RF-COT-06, RNF-COT-05 · **Estado:** ✓ Completado

---

### Tarea 5.4 — Confirmación al volver de Mercado Pago

**Archivos:** `payments.ts → confirmReturn()`, `apps/web/src/pago-mercadopago.ts`

**Descripción:** Consultar el pago por `payment_id` o `external_reference` y aplicar su estado; botón «Ya pagué en Mercado Pago: verificar» para `localhost`, donde Mercado Pago no muestra «Volver al sitio».

**Requisitos:** RF-COT-06 · **Estado:** ✓ Completado

---

### Tarea 5.5 — Workers

**Archivos:** `workers/expire-orders.cjs`, `workers/recover-webhooks.cjs` (contenedor `worker`)

**Descripción:** Vencer pedidos impagos y devolver stock (sin duplicar); reprocesar webhooks pendientes.

**Requisitos:** RF-COT-06 · **Estado:** ✓ Completado

---

## Fase 6 — Frontend

### Tarea 6.1 — Lista de pedido y cotización

**Archivos:** `order-list.ts`, `order-list.service.ts`, `trade.ts`

**Descripción:** Agregar productos desde el catálogo, agruparlos por proveedor, elegir el lugar de entrega («Cambiar lugar de entrega») y enviar las solicitudes.

**Requisitos:** RF-COT-01 · **Estado:** ✓ Completado

---

### Tarea 6.2 — Ofertas, comparación y pedido

**Archivo:** `trade.ts`

**Descripción:** Formulario de oferta con tarjeta fija del producto y subtotales en vivo; comparación con desglose antes de aceptar; motivos claros y botón «Nueva solicitud» ante `OFFER_EXPIRED`, `CONDITIONS_CHANGED` o `INSUFFICIENT_STOCK`.

**Requisitos:** RF-COT-02 a 05 · **Estado:** ✓ Completado

---

### Tarea 6.3 — Pago

**Archivos:** `pago-prueba.ts`, `pago-mercadopago.ts`

**Requisitos:** RF-COT-06 · **Estado:** ✓ Completado

---

### Tarea 6.4 — Despacho y orden de compra

**Archivos:** `trade.ts`, `orden-compra.ts`

**Descripción:** Botones de despacho según rol y estado, historial con notas, y orden de compra con IGV (18 %) desglosado en céntimos, lugar de entrega y opción de imprimir o guardar en PDF.

**Requisitos:** RF-COT-07, 08 · **Estado:** ✓ Completado

---

## Fase 7 — Pruebas

### Tarea 7.1 — Pruebas unitarias (Jest)

| Prueba | Archivo | Qué valida |
| ------ | ------- | ---------- |
| PU-COT-01 | `tests/pricing.test.cjs` | Dinero exacto y totales |
| PU-COT-02 | `tests/trade-rules.test.cjs` | Reglas de solicitud, oferta y reserva |
| PU-COT-03 | `tests/fulfillment.test.cjs` | Transiciones de despacho |
| PU-COT-04 | `tests/mercadopago-retorno.test.cjs` | Confirmación al regreso de Mercado Pago |

**Estado:** ✓ Completado

---

### Tarea 7.2 — Pruebas de integración (Jest + PostgreSQL)

| Prueba | Archivo | Casos |
| ------ | ------- | ----- |
| PI-COT-01 | `tests/orders.integration.cjs` | T4-AC01 a AC11 (privacidad, aceptación concurrente, idempotencia, vencimiento, sobreventa, rollback, reimportación) |
| PI-COT-02 | `tests/payments.integration.cjs` | T5-P01 a P08 |
| PI-COT-03 | `tests/payments-security.integration.cjs` | T5-S01 a S05 |
| PI-COT-04 | `tests/payments-recovery.integration.cjs` | T5-R01 a R06 |
| PI-COT-05 | `tests/payments-migration.integration.cjs` | T5-M01 a M17 |
| PI-COT-06 | `tests/fulfillment.integration.cjs` | Despacho por rol y estado |
| PI-COT-07 | `tests/ai.integration.cjs`, `tests/quotation-summary.integration.cjs`, `tests/entrega.integration.cjs` | IA, resumen y entrega |

**Estado:** ✓ Completado

---

### Tarea 7.3 — Pruebas de navegador (Playwright)

| Prueba | Archivo |
| ------ | ------- |
| PN-COT-01 | `tests/quotations.browser.cjs` |
| PN-COT-02 | `tests/cotizacion-simple.browser.cjs` |
| PN-COT-03 | `tests/lista-pedido.browser.cjs` |
| PN-COT-04 | `tests/pago-prueba.browser.cjs` |

**Estado:** ✓ Completado

---

### Tarea 7.4 — Pruebas funcionales con Postman

| Prueba | Petición | Resultado esperado |
| ------ | -------- | ------------------ |
| PT-COT-01 | Proveedores disponibles | ✓ 200 |
| PT-COT-02 | Productos del proveedor | ✓ 200 |
| PT-COT-03 | Inválido: cotización sin ítems | ✓ 422 |
| PT-COT-04 | Inválido: docena con 10 unidades | ✓ 422 |
| PT-COT-05 | Crear solicitud de cotización | ✓ 201 |
| PT-COT-06 | Consultar solicitud creada | ✓ 200 |
| PT-COT-07 | Inexistente: solicitud con UUID aleatorio | ✓ 404 |
| PT-COT-08 | Inválido: oferta con vigencia sin zona horaria | ✓ 422 |
| PT-COT-09 | Proveedor responde con oferta | ✓ 201 |
| PT-COT-10 | Prohibido: el proveedor no puede aceptar | ✓ 403 o 404 |
| PT-COT-11 | Comprador acepta la oferta | ✓ 200 |
| PT-PED-01 | Inválido: pedido sin Idempotency-Key | ✓ 422 |
| PT-PED-02 | Crear pedido | ✓ 201 |
| PT-PED-03 | Repetir pedido con la misma clave | ✓ mismo pedido |
| PT-PED-04 | Consultar pedido | ✓ 200 |
| PT-PED-05 | Listar pedidos | ✓ 200 |
| PT-PED-06 | Inválido: despacho de pedido no pagado | ✓ 409 o 422 |

**Estado:** ✓ Completado

---

## Pendientes

- [ ] Configurar `MP_WEBHOOK_SECRET` en producción para que el webhook rechace firmas inválidas (hoy se confirma también al volver de Mercado Pago).
- [ ] Pago a crédito o por transferencia para clientes frecuentes.
- [ ] Panel de conciliación para el administrador (`payment_reconciliations`).

---

## Trazabilidad completa del módulo

```
requirements.md            design.md                    tasks.md
      │                        │                            │
      │ RF-COT-01..08          │ trade/ (4 capas)           │ Tareas 2.1..2.4 (BD)
      │ RNF-COT-01..07         │ payments/ (4 capas)        │ Tareas 3.1..3.3 (dominio)
      │ Ciclo del pedido       │ ai/ + FastAPI              │ Tareas 4.1..5.5 (API)
      │ Criterios EARS         │ workers                    │ Tareas 6.1..6.4 (web)
      │                        │                            │ PU, PI, PN, PT
      └────────────────────────┴────────────────────────────┘
                               │
                      CÓDIGO IMPLEMENTADO
                               │
                      PRUEBAS EJECUTADAS (CI)
                               │
                   https://mayoristapro.shop ✓
```
