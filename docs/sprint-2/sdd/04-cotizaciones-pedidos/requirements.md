# Requisitos — Cotizaciones, pedidos, pago y despacho

## Introducción

Es el corazón comercial B2B: el comprador pide cotización a varios proveedores, compara ofertas privadas, acepta una, genera el pedido con stock reservado, lo paga (Mercado Pago en modo de prueba) y sigue su despacho hasta la entrega.

Origen: [T4 — Cotizaciones y pedidos](../../cotizaciones-pedidos.md) (T4-AC01 a T4-AC11), decisiones D2, D3 y D4 de la [preparación](../../00-preparacion-sprint-2.md) y las [reglas comerciales mayoristas](../../../sprint-1/03-diseno-de-software/reglas-comerciales-mayoristas.md).

## Glosario

- **Solicitud de cotización:** ítems y cantidades por presentación enviados a 1–20 proveedores.
- **Oferta:** respuesta privada e inmutable de un proveedor, con precio, envío, plazo y vigencia.
- **Reserva:** stock apartado para un pedido pendiente de pago.
- **Estados del pedido:** `pendiente` → `paid` → `preparing` → `dispatched` → `delivered`; además `expired`, `cancelled` y `requires_reconciliation`.

## Requisitos

### Requisito 1: Solicitar cotización

**Historia de usuario:** Como comprador, quiero pedir cotización a varios proveedores a la vez, para comparar condiciones.

#### Criterios de aceptación

1. CUANDO un usuario con permiso `buy` cree una solicitud con 1–50 ítems y 1–20 proveedores verificados, EL sistema DEBERÁ guardarla y notificar a cada proveedor.
2. EL sistema NO DEBERÁ permitir a la propia empresa como destinataria.
3. CUANDO el comprador use la «Lista de pedido», EL sistema DEBERÁ agrupar los productos por proveedor y crear las solicitudes desde ella.

### Requisito 2: Ofertas privadas

**Historia de usuario:** Como proveedor, quiero responder con mi precio sin que mis competidores lo vean.

#### Criterios de aceptación

1. CUANDO un proveedor destinatario responda, EL sistema DEBERÁ exigir que cubra todos los ítems con sus propios productos, respetando presentación, mínimo y múltiplo.
2. EL comprador DEBERÁ ver todas las ofertas recibidas; cada proveedor solo DEBERÁ ver la suya.
3. EL sistema DEBERÁ calcular subtotal y total en céntimos exactos (sin decimales binarios) y rechazar precios con más de 2 decimales.
4. EL sistema PUEDE ordenar las ofertas por puntaje con el servicio de IA (50 % precio total, 30 % plazo de entrega y 20 % reputación del proveedor); si la IA no está disponible, la comparación DEBERÁ seguir funcionando sin puntaje.

### Requisito 3: Aceptar oferta y crear pedido

#### Criterios de aceptación

1. EL sistema DEBERÁ permitir exactamente una oferta aceptada por solicitud, incluso con dos usuarios aceptando a la vez (uno gana y el otro recibe 409).
2. CUANDO se cree el pedido desde la oferta aceptada, EL sistema DEBERÁ en una sola transacción: validar vigencia y condiciones, descontar stock, crear la reserva y copiar los importes históricos.
3. SI la oferta venció, cambiaron las condiciones o falta stock, ENTONCES EL sistema DEBERÁ responder con el motivo (`OFFER_EXPIRED`, `CONDITIONS_CHANGED`, `INSUFFICIENT_STOCK`) y ofrecer «Nueva solicitud».
4. EL sistema DEBERÁ crear como máximo un pedido por oferta, aunque se repita la petición con otra `Idempotency-Key`.
5. SI dos compradores compiten por el mismo stock, ENTONCES EL sistema NO DEBERÁ sobrevender.

### Requisito 4: Pago

**Historia de usuario:** Como comprador, quiero pagar el pedido en línea antes de que venza la reserva.

#### Criterios de aceptación

1. EL pedido pendiente DEBERÁ vencer a los 30 minutos; el proceso `worker` DEBERÁ liberar la reserva de los pedidos vencidos.
2. CUANDO el comprador inicie un pago, EL sistema DEBERÁ crear un intento en Mercado Pago (modo de prueba sin credenciales), con un máximo de 3 intentos y uno activo a la vez.
3. CUANDO llegue el webhook de pago aprobado a tiempo, EL sistema DEBERÁ marcar el pedido `paid`; si llega tarde, DEBERÁ marcarlo `requires_reconciliation`.
4. EL sistema DEBERÁ registrar cada webhook una sola vez y reprocesar los pendientes.

### Requisito 5: Despacho y entrega

#### Criterios de aceptación

1. CUANDO el pedido esté `paid`, el proveedor DEBERÁ poder pasarlo a `preparing` y luego a `dispatched`, con una nota opcional de hasta 300 caracteres (por ejemplo, la guía de remisión).
2. CUANDO esté `dispatched`, solo el comprador DEBERÁ poder confirmar `delivered`.
3. SI la transición no corresponde al estado o al rol, ENTONCES EL sistema DEBERÁ rechazarla; repetir la misma transición NO DEBERÁ hacer nada.
4. EL sistema DEBERÁ guardar el historial de cambios (quién, cuándo y nota).
