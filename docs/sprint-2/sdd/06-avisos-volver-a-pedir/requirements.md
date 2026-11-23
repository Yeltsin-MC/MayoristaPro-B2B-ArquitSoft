# Requisitos — Avisos y «Volver a pedir»

## Introducción

En un flujo B2B con varias partes (comprador, proveedores, pasarela de pago), cada empresa necesita enterarse de lo que le toca hacer sin revisar pantalla por pantalla. Este módulo agrega una campana 🔔 con contador de avisos y el botón «Volver a pedir», que repite una compra entregada en un clic, un caso típico del abastecimiento recurrente mayorista.

## Glosario

- **Aviso:** fila de `notifications` dirigida a una empresa, con tipo, título y enlace a la pantalla correspondiente.
- **No leído:** aviso con `read_at` vacío; cuenta para el número rojo de la campana.

## Requisitos

### Requisito 1: Generar avisos en cada paso

**Historia de usuario:** Como proveedor o comprador, quiero que se me avise cuando algo requiere mi atención, para responder a tiempo.

#### Criterios de aceptación

1. CUANDO se envíe una solicitud de cotización, EL sistema DEBERÁ avisar a cada proveedor destinatario.
2. CUANDO un proveedor envíe una oferta, EL sistema DEBERÁ avisar al comprador.
3. CUANDO el comprador acepte una oferta, EL sistema DEBERÁ avisar al proveedor ganador.
4. CUANDO se cree un pedido, EL sistema DEBERÁ avisar al proveedor; CUANDO el pedido pase a `paid`, DEBERÁ avisar al proveedor que ya puede prepararlo.
5. CUANDO el pedido pase a `preparing` o `dispatched`, EL sistema DEBERÁ avisar al comprador; CUANDO pase a `delivered`, DEBERÁ avisar al proveedor.
6. EL aviso DEBERÁ generarse aunque el cambio venga de un camino distinto de la API web (por ejemplo, el webhook de pago o un proceso del worker).

### Requisito 2: Ver y marcar avisos

**Historia de usuario:** Como usuario de una empresa, quiero ver mis últimos avisos y marcarlos como leídos.

#### Criterios de aceptación

1. EL encabezado DEBERÁ mostrar la campana con el número de avisos no leídos de la empresa, actualizado cada 30 segundos.
2. CUANDO el usuario abra la campana, EL sistema DEBERÁ listar los últimos 20 avisos, cada uno con enlace a su cotización o pedido.
3. CUANDO el usuario marque los avisos como leídos, EL contador DEBERÁ quedar en 0.
4. Un usuario NO DEBERÁ ver avisos de otra empresa; el administrador de plataforma y los usuarios sin permisos NO DEBERÁN ver la campana.

### Requisito 3: Volver a pedir

**Historia de usuario:** Como comprador recurrente, quiero repetir un pedido entregado sin volver a escribir los productos.

#### Criterios de aceptación

1. CUANDO el comprador presione «Volver a pedir» en un pedido `delivered`, EL sistema DEBERÁ crear una nueva solicitud de cotización al mismo proveedor, con los mismos productos, presentaciones y cantidades.
2. SI el pedido no está entregado, ENTONCES EL sistema DEBERÁ rechazarlo con el motivo «Solo puedes volver a pedir un pedido entregado».
3. SI el pedido no pertenece a la empresa compradora o el usuario no tiene permiso `buy`, ENTONCES EL sistema DEBERÁ responder 404.
4. La nueva solicitud DEBERÁ seguir el flujo normal (oferta, aceptación y pedido); no se reutilizan precios anteriores.
