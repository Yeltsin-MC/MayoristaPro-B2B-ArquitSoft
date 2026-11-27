# Especificación de Requisitos — Cotizaciones, pedidos, pago y despacho

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 04 · Cotizaciones, pedidos, pago y despacho                  |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Contexto

Es el corazón comercial de MayoristaPro. En el comercio mayorista el precio de lista es solo una referencia: el comprador **pide cotización** a varios proveedores, cada uno responde con una **oferta privada** (precio, envío, plazo y vigencia), el comprador compara, **acepta una** y genera el **pedido**. En ese momento se reserva el stock y el pedido tiene 30 minutos para pagarse. Después, el proveedor lo prepara y despacha, y el comprador confirma la recepción.

Al ser un flujo con dinero y stock compartido, las reglas más importantes son de **consistencia**: una sola oferta aceptada por solicitud, un solo pedido por oferta, nada de sobreventa aunque dos compradores compitan, y montos exactos en céntimos.

Origen: entrega T4 (cotizaciones y pedidos, T4-AC01 a T4-AC11), T5 pagos, decisiones D2, D3 y D4 de la [preparación](../../00-preparacion-sprint-2.md) y las [reglas comerciales mayoristas](../../../sprint-1/03-diseno-de-software/reglas-comerciales-mayoristas.md).

---

## 2. Objetivo

- Solicitudes de cotización a 1–20 proveedores, con lugar de entrega.
- Ofertas privadas, completas e inmutables, con montos exactos.
- Comparación con puntaje de IA opcional (precio, plazo y reputación).
- Aceptación única y pedido idempotente con reserva atómica de stock.
- Pago con Mercado Pago (sandbox) o pago de prueba estilo Perú, con vencimiento de 30 minutos.
- Despacho por estados con historial, y orden de compra con IGV desglosado.

---

## 3. Actores involucrados

| Actor | Permisos en este módulo |
| ----- | ----------------------- |
| Comprador (`buy`) | Crear solicitudes, ver todas sus ofertas, aceptar una, crear y pagar el pedido, confirmar la recepción |
| Proveedor verificado (`publish`) | Ver solicitudes donde es destinatario, enviar su oferta, preparar y despachar |
| Mercado Pago | Notificar pagos por webhook firmado |
| Servicio de IA (FastAPI) | Calcular el puntaje de las ofertas |
| Worker | Vencer pedidos impagos, liberar stock y reprocesar webhooks |

---

## 4. Glosario

| Término | Definición |
| ------- | ---------- |
| Solicitud de cotización | Ítems y cantidades por presentación enviados a 1–20 proveedores |
| Oferta | Respuesta privada e inmutable de un proveedor: precio por ítem, envío, plazo y vigencia |
| Snapshot | Copia de las condiciones del producto (presentación, mínimo, múltiplo) al momento de ofertar |
| Reserva | Stock descontado y apartado para un pedido pendiente de pago |
| `Idempotency-Key` | Clave que hace que repetir «Crear pedido» no cree dos pedidos |
| Modalidad de entrega | `envio` (a una dirección), `recojo` (en almacén) o `agencia` (agencia de transporte) |
| Estados del pedido | `pendiente`, `paid`, `preparing`, `dispatched`, `delivered`, `expired`, `expired_pending_payment`, `cancelled`, `requires_reconciliation` |

---

## 5. Requisitos funcionales

### RF-COT-01 — Crear solicitud de cotización

**Endpoint:** `POST /api/v1/quotations`
**Acceso:** Usuario con `buy`
**Body:** `{ proveedorIds: uuid[], items: [{ descripcion, presentacion, unidadesPorPresentacion, cantidad }], entrega? }`

**Validaciones obligatorias:**

- 1 a 20 proveedores, sin repetir → 422 «Selecciona de 1 a 20 proveedores.» / «Proveedor repetido.».
- 1 a 50 ítems → 422 «Solicitud de 1 a 50 ítems.».
- Descripción obligatoria de hasta 200 caracteres.
- Presentación `unidad`, `paquete`, `docena`, `caja` o `saco`; una docena exige 12 unidades.
- Entrega: `envio` exige dirección, distrito, provincia y departamento; `agencia` exige el nombre de la agencia; `recojo` no exige nada. Sin `entrega` se usa la dirección registrada de la empresa.
- Los proveedores deben estar verificados y no pueden ser la propia empresa.

#### Criterios de aceptación (EARS)

1. CUANDO un comprador cree una solicitud válida, EL sistema DEBERÁ guardarla con sus ítems, destinatarios y entrega, y avisar a cada proveedor.
2. EL sistema NO DEBERÁ permitir a la propia empresa como destinataria.
3. CUANDO el comprador use la «Lista de pedido», EL sistema DEBERÁ agrupar los productos por proveedor y crear una solicitud por cada uno.

---

### RF-COT-02 — Enviar oferta privada

**Endpoint:** `POST /api/v1/quotations/:id/responses`
**Acceso:** Proveedor destinatario verificado
**Body:** `{ moneda: "PEN", precioIncluyeIgv: true, costoEnvio, diasEntrega, vigenteHasta, items: [{ solicitudItemId, productoId, cantidad, precioUnitario }] }`

**Validaciones obligatorias:**

- Solo PEN con IGV incluido.
- `vigenteHasta` en ISO 8601 **con zona horaria** y en el futuro.
- La oferta cubre **todos** los ítems, con la misma cantidad, usando productos propios compatibles con la presentación, mínimo y múltiplo.
- Precios con hasta 2 decimales; stock suficiente al ofertar.
- Una oferta por proveedor y solicitud (`ALREADY_RESPONDED`); no se puede ofertar si ya hay una aceptada.

#### Criterios de aceptación (EARS)

1. CUANDO un proveedor destinatario responda, EL sistema DEBERÁ guardar la oferta con subtotal y total calculados en céntimos exactos.
2. EL comprador DEBERÁ ver todas las ofertas recibidas; cada proveedor solo DEBERÁ ver la suya.
3. SI la oferta no cubre todos los ítems o usa un producto ajeno, ENTONCES EL sistema DEBERÁ responder 422.
4. La oferta DEBERÁ ser inmutable una vez enviada.

---

### RF-COT-03 — Comparar ofertas con IA

**Endpoint:** `POST /api/v1/quotations/:id/score-offers`
**Acceso:** Comprador de la solicitud

#### Criterios de aceptación (EARS)

1. CUANDO el comprador pida el puntaje, EL sistema DEBERÁ ordenar las ofertas con el servicio FastAPI ponderando 50 % precio total, 30 % plazo de entrega y 20 % reputación del proveedor.
2. SI el servicio de IA no responde, ENTONCES la comparación DEBERÁ seguir funcionando sin puntaje.

---

### RF-COT-04 — Aceptar una oferta

**Endpoint:** `PATCH /api/v1/quotations/:id/responses/:offer/accept`
**Acceso:** Comprador de la solicitud

#### Criterios de aceptación (EARS)

1. EL sistema DEBERÁ permitir exactamente una oferta aceptada por solicitud, incluso con dos usuarios aceptando a la vez (uno gana y el otro recibe 409 `ALREADY_ACCEPTED`).
2. SI el proveedor dejó de estar verificado o la oferta venció, ENTONCES EL sistema DEBERÁ rechazar la aceptación con `CONDITIONS_CHANGED` u `OFFER_EXPIRED`.
3. EL proveedor NO DEBERÁ poder aceptar la oferta: solo el comprador ve el botón y la API responde 403 o 404.

---

### RF-COT-05 — Crear el pedido con reserva de stock

**Endpoint:** `POST /api/v1/orders`
**Cabecera:** `Idempotency-Key` (1–128 caracteres)
**Body:** `{ cotizacionRespuestaId }`

#### Criterios de aceptación (EARS)

1. CUANDO se cree el pedido desde la oferta aceptada, EL sistema DEBERÁ en una sola transacción: validar vigencia y condiciones, descontar stock, crear la reserva y copiar los importes históricos.
2. SI la oferta venció, cambiaron las condiciones o falta stock, ENTONCES EL sistema DEBERÁ responder 409 con `OFFER_EXPIRED`, `CONDITIONS_CHANGED` o `INSUFFICIENT_STOCK`, y la interfaz DEBERÁ ofrecer «Nueva solicitud».
3. SI se repite la petición con la misma clave, ENTONCES EL sistema DEBERÁ devolver el mismo pedido; con la misma clave y otra oferta, DEBERÁ responder 409 `IDEMPOTENCY_CONFLICT`.
4. EL sistema DEBERÁ crear como máximo un pedido por oferta, aunque llegue otra clave.
5. SI dos compradores compiten por el mismo stock, ENTONCES EL sistema NO DEBERÁ sobrevender.

---

### RF-COT-06 — Pagar el pedido

**Endpoints:** `POST/GET /api/v1/orders/:id/payment-attempts`, `POST /api/v1/payments/mercadopago/confirm`, `GET/POST /api/v1/payments/simulated/:attemptId`, `POST /api/v1/webhooks/mercadopago`

**Reglas:**

- El pedido `pendiente` vence a los 30 minutos (`expires_at`).
- Máximo 3 intentos por pedido y uno activo a la vez.
- Con `MP_ACCESS_TOKEN` se crea una preferencia de Mercado Pago (Checkout Pro); sin él se usa el **pago de prueba** con Tarjeta, Yape o PagoEfectivo (código CIP).
- El webhook se verifica con `x-signature` (HMAC con `MP_WEBHOOK_SECRET`) y se registra una sola vez por `notification_id`.
- Al volver de Mercado Pago, o con el botón «Ya pagué en Mercado Pago: verificar», el sistema consulta el pago por su `external_reference`.

#### Criterios de aceptación (EARS)

1. CUANDO el comprador inicie un pago válido, EL sistema DEBERÁ crear un intento y devolver el enlace de pago.
2. CUANDO Mercado Pago informe un pago aprobado antes del vencimiento, EL sistema DEBERÁ marcar el pedido `paid` y la reserva como consumida.
3. SI el pago aprobado llega después del vencimiento, ENTONCES EL sistema DEBERÁ marcarlo `requires_reconciliation`.
4. CUANDO venza un pedido sin pago activo, EL worker DEBERÁ marcarlo `expired` y devolver el stock; si hay un pago pendiente, DEBERÁ marcarlo `expired_pending_payment` sin liberar stock.
5. SI llega dos veces el mismo webhook, ENTONCES EL sistema DEBERÁ procesarlo una sola vez; los fallidos DEBERÁN reprocesarse.

---

### RF-COT-07 — Despacho y entrega

**Endpoint:** `PATCH /api/v1/orders/:id/fulfillment`
**Body:** `{ estado: "preparing"|"dispatched"|"delivered", nota? }`

| Transición | Desde | Quién |
| ---------- | ----- | ----- |
| `preparing` | `paid` | Proveedor |
| `dispatched` | `preparing` | Proveedor (nota opcional, p. ej. guía de remisión) |
| `delivered` | `dispatched` | Comprador |

#### Criterios de aceptación (EARS)

1. SI la transición no corresponde al estado o al rol, ENTONCES EL sistema DEBERÁ rechazarla (403 o 409).
2. SI se repite la misma transición, ENTONCES EL sistema NO DEBERÁ hacer nada (idempotente).
3. EL sistema DEBERÁ guardar el historial con quién, cuándo y la nota (hasta 300 caracteres).

---

### RF-COT-08 — Consultar pedidos y orden de compra

**Endpoints:** `GET /api/v1/orders`, `GET /api/v1/orders/:id` · pantalla `/orden-de-compra/:id`

#### Criterios de aceptación (EARS)

1. Cada participante DEBERÁ ver solo los pedidos donde es comprador o proveedor.
2. CUANDO el pedido esté pagado, EL sistema DEBERÁ ofrecer la orden de compra imprimible o en PDF, con el IGV (18 %) desglosado del total y el lugar de entrega.

---

## 6. Requisitos no funcionales

| ID | Atributo | Detalle |
| -- | -------- | ------- |
| RNF-COT-01 | Exactitud monetaria | Céntimos `bigint` en el dominio; `numeric(12,2)` y `numeric(24,2)` en PostgreSQL; `CHECK (total = subtotal + shipping)` |
| RNF-COT-02 | Consistencia | Bloqueo ordenado de productos por ID y un reintento ante interbloqueo o conflicto de serialización |
| RNF-COT-03 | Idempotencia | `order_keys` + bloqueo asesor por clave; webhooks únicos por `notification_id` |
| RNF-COT-04 | Privacidad | Cada proveedor ve solo su oferta; respuestas con `Cache-Control: no-store` |
| RNF-COT-05 | Seguridad | Webhook con firma HMAC; la empresa y los permisos se toman del token |
| RNF-COT-06 | Disponibilidad | Si la IA o Mercado Pago fallan, el flujo de compra sigue (sin puntaje o con pago de prueba) |
| RNF-COT-07 | Integridad | FK compuestas: la oferta aceptada pertenece a su solicitud y los productos al proveedor |

---

## 7. Criterios de aceptación del módulo

- [x] Solicitud sin ítems → 422.
- [x] Docena con 10 unidades → 422.
- [x] Oferta con vigencia sin zona horaria → 422.
- [x] Un proveedor no ve las ofertas de otros.
- [x] El proveedor no puede aceptar (403 o 404).
- [x] Dos aceptaciones simultáneas → una gana y la otra recibe 409.
- [x] Pedido sin `Idempotency-Key` → 422.
- [x] Repetir el pedido con la misma clave → mismo pedido, una sola reserva.
- [x] Oferta vencida → no hay pedido, reserva ni descuento.
- [x] Dos compradores piden 4 de un stock de 5 → solo uno lo consigue.
- [x] Fallo SQL después del descuento → todo se revierte.
- [x] Máximo 3 intentos de pago y uno activo.
- [x] Webhook duplicado → se procesa una vez.
- [x] Despachar un pedido no pagado → rechazado.
- [x] El comprador confirma la recepción; el proveedor no puede.

---

## 8. Ciclo de vida del pedido

```
     [CREAR PEDIDO — RF-COT-05]  (descuenta stock + reserva, vence en 30 min)
                    │
                    ▼
               PENDIENTE ──────[30 min sin pago]──────► EXPIRED (stock devuelto)
                 │    │
                 │    └──[30 min con pago pendiente]──► EXPIRED_PENDING_PAYMENT
                 │
     [webhook / confirmación: aprobado a tiempo]       [aprobado tarde]
                 │                                            │
                 ▼                                            ▼
                PAID                               REQUIRES_RECONCILIATION
                 │
     [proveedor — RF-COT-07]
                 ▼
             PREPARING
                 │
     [proveedor, nota/guía]
                 ▼
             DISPATCHED
                 │
     [comprador confirma]
                 ▼
             DELIVERED ──► «Volver a pedir» (módulo 06)
```

---

## 9. Trazabilidad SDD

| Artefacto | Archivo |
| --------- | ------- |
| Diseño técnico | [`design.md`](design.md) |
| Tareas de implementación | [`tasks.md`](tasks.md) |
| Comercio | `apps/api/src/trade/` (`domain/trade.ts`, `domain/fulfillment.ts`, `application/trade.ts`, `infrastructure/postgres-trade.ts`, `presentation/trade.controller.ts`) |
| Pagos | `apps/api/src/payments/` (`domain/payment.ts`, `application/payments.ts`, `infrastructure/mercadopago-gateway.ts`, `postgres-payments.ts`, `presentation/payments.controller.ts`) |
| IA | `apps/api/src/ai/`, `apps/ai-service/` |
| Workers | `apps/api/src/workers/expire-orders.cjs`, `recover-webhooks.cjs` |
| Migraciones | `004_trade.sql`, `005_payments.sql`, `006_add_payment_pending_state.sql`, `009_order_fulfillment.sql`, `014_delivery_addresses.sql` |
| Frontend | `apps/web/src/trade.ts`, `order-list.ts`, `pago-prueba.ts`, `pago-mercadopago.ts`, `orden-compra.ts` |
| Pruebas | `tests/orders.integration.cjs`, `tests/payments*.cjs`, `tests/fulfillment*.cjs`, `tests/pricing.test.cjs`, `tests/trade-rules.test.cjs` |
