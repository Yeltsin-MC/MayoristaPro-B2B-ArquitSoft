# Diseño interno de módulos

**Referencia:** módulo Pedidos de NestJS. Es un diseño para implementar en los siguientes sprints; los nombres representan responsabilidades propuestas.

## Estructura de archivos

```text
src/modules/pedidos/
├── dominio/
│   ├── pedido.ts
│   ├── item-pedido.ts
│   ├── estado-pedido.ts
│   └── order-repository.ts
├── aplicacion/
│   ├── crear-pedido.use-case.ts
│   ├── crear-pedido.command.ts
│   ├── confirmar-pago-pedido.use-case.ts
│   └── puertos/
│       ├── unidad-trabajo.port.ts
│       ├── cotizaciones.port.ts
│       ├── stock-port.ts
│       └── pagos.port.ts
├── infraestructura/
│   ├── postgres-order-repository.ts
│   └── postgres-unidad-trabajo.ts
├── presentacion/
│   └── order.controller.ts
├── pedidos.module.ts
└── index.ts
```

| Elemento | Responsabilidad |
|---|---|
| Pedido e ItemPedido | Identidad de las partes, condiciones aceptadas, total y estados válidos. |
| OrderRepository | Contrato de persistencia del agregado Pedido, definido en Dominio. |
| CrearPedidoUseCase | Autorizar la compra, leer la oferta aceptada y coordinar pedido y reserva. |
| ConfirmarPagoPedidoUseCase | Aplicar un resultado verificado, sin repetir transiciones. |
| UnidadTrabajoPort | Coordinar una transacción compartida por los puertos participantes. |
| CotizacionesPort, StockPort y PagosPort | Contratos de colaboración con las APIs públicas de otros módulos. |
| Adaptadores PostgreSQL | Ejecutar SQL y conservar la misma conexión dentro de la transacción. |
| OrderController | Traducir HTTP a entradas y resultados del caso de uso. |
| pedidos.module.ts | Conectar implementaciones con inyección de dependencias de NestJS. |

El adaptador de stock pertenece a Productos y el adaptador de la pasarela a Pagos. Pedidos los usa mediante contratos; no importa sus SDK ni accede directamente a sus tablas.

## Flujo propuesto

| Paso | Acción | Resultado |
|---|---|---|
| 1 | Extraer identidad autenticada y comprobar participación. | Comprador autorizado. |
| 2 | Leer la oferta aceptada, su vigencia, proveedor e ítems. | Precios y condiciones confiables. |
| 3 | Iniciar la unidad de trabajo y revalidar las condiciones críticas. | Operación consistente ante cambios simultáneos. |
| 4 | Bloquear productos en orden estable, reservar stock y guardar pedido e ítems. | Una sola confirmación de transacción o rollback completo. |
| 5 | Responder con pedido pendiente y vencimiento de reserva. | El pedido existe antes de contactar la pasarela. |
| 6 | Pagos registra un intento e inicia la operación externa. | Referencia persistida y resultado pendiente o definitivo. |
| 7 | Procesar confirmación o consulta verificada. | Pedido confirmado, rechazo o estado por reconciliar. |

Si se repite una solicitud con la misma clave de idempotencia y contenido, se devuelve el resultado previo. Si cambia el contenido con la misma clave, se rechaza el conflicto.

## Reglas del pedido

| ID | Regla propuesta |
|---|---|
| RN-01 | Cada pedido tiene una empresa compradora, un usuario responsable y un proveedor. |
| RN-02 | El pedido contiene al menos un ítem del mismo proveedor. |
| RN-03 | Las cantidades usan la presentación ofertada, son positivas, alcanzan el mínimo y respetan el múltiplo; la transacción revalida esas condiciones. |
| RN-04 | El total se obtiene de cantidades y precios aceptados, con una política explícita de moneda y redondeo. |
| RN-05 | Solo se inicia un nuevo pago de un pedido pendiente y con reserva vigente; una confirmación tardía se reconcilia. |
| RN-06 | No se cancela directamente un pedido despachado o entregado. La cancelación de uno pagado requiere resolver el reembolso. |
| RN-07 | Pedido y reserva se persisten atómicamente antes de iniciar el pago externo. |
| RN-08 | Un rechazo definitivo permite liberar la reserva de forma idempotente; un timeout exige consultar el pago antes de liberarla. |
| RN-09 | Los precios son positivos y proceden del servidor, nunca del importe declarado por el cliente. |
| RN-10 | Solo un pedido en preparación puede pasar a despachado. |

## Recuperación y tareas posteriores

El vencimiento de reservas se procesa con cambios de estado condicionados y consulta del estado de pago. No se libera stock de un pedido pagado solo porque transcurrió un temporizador. Si un cobro tardío llega después de una cancelación, se reconcilia y se resuelve mediante reembolso o intervención controlada.

Los eventos de confirmación se guardan junto al cambio de estado en una tabla de salida pendiente (outbox). Un publicador los envía a SQS y los workers procesan sus identificadores sin duplicar facturación ni notificaciones.

**Verificación prevista:** reglas de dominio con pruebas unitarias; transacción y bloqueos con PostgreSQL; pagos con pruebas de duplicados, rechazo, timeout y confirmación tardía.
