# Nivel 4: diseño de código de Pedidos

**Pregunta:** ¿qué clases e interfaces colaborarán para crear un pedido? Es un diseño propuesto, no código ya implementado. Se detalla el módulo crítico en lugar de dibujar todas las clases del sistema.

## Diagrama de clases

```mermaid
classDiagram
    class Pedido {
        +id
        +compradorEmpresaId
        +proveedorId
        -estado
        +crear()
        +confirmarPagoVerificado()
        +solicitarCancelacion()
        +marcarDespachado()
    }
    class ItemPedido {
        +productoId
        +cantidad
        +precioUnitario
        +subtotal()
    }
    class OrderRepository {
        <<interface>>
        +guardar()
        +buscarPorId()
    }
    class UnidadTrabajoPort {
        <<interface>>
        +ejecutar()
    }
    class StockPort {
        <<interface>>
        +reservar()
        +liberarUnaVez()
    }
    class CotizacionesPort {
        <<interface>>
        +obtenerOfertaAceptada()
    }
    class CrearPedidoUseCase {
        +ejecutar()
    }
    class ConfirmarPagoPedidoUseCase {
        +ejecutar()
    }
    class PostgresOrderRepository
    class PostgresUnidadTrabajo
    class OrderController
    Pedido "1" *-- "1..*" ItemPedido
    CrearPedidoUseCase --> OrderRepository
    CrearPedidoUseCase --> UnidadTrabajoPort
    CrearPedidoUseCase --> StockPort
    CrearPedidoUseCase --> CotizacionesPort
    CrearPedidoUseCase ..> Pedido
    ConfirmarPagoPedidoUseCase --> OrderRepository
    ConfirmarPagoPedidoUseCase --> UnidadTrabajoPort
    ConfirmarPagoPedidoUseCase --> StockPort
    OrderController --> CrearPedidoUseCase
    PostgresOrderRepository ..|> OrderRepository
    PostgresUnidadTrabajo ..|> UnidadTrabajoPort
```

Composición: un Pedido contiene sus ítems. Realización: el repositorio PostgreSQL implementa una interfaz. Las firmas se completarán en Sprint 02; no se presupone que ejecutar varias operaciones por separado forme una transacción.

## Secuencia principal

```mermaid
sequenceDiagram
    participant C as Comprador
    participant UC as CrearPedido
    participant TX as Unidad de trabajo y adaptadores
    participant PG as PostgreSQL
    participant P as Modulo Pagos
    participant EXT as Pasarela
    C->>UC: Oferta aceptada e identidad autenticada
    UC->>UC: Autorizar y comprobar idempotencia
    UC->>TX: Crear pedido y reserva de forma atomica
    TX->>PG: BEGIN, revalidar y bloquear productos
    alt Stock y condiciones validos
        TX->>PG: Guardar pedido, items y reserva
        TX->>PG: COMMIT
        UC-->>C: Pedido pendiente y vencimiento
        C->>P: Iniciar pago del pedido
        P->>PG: Persistir intento y referencia
        P->>EXT: Solicitar pago fuera de transaccion SQL
        EXT-->>P: Confirmacion verificable o resultado pendiente
        P->>PG: Guardar estado del intento
        P->>TX: Aplicar resultado verificado al pedido
        TX->>PG: Cambio de pedido, reserva y outbox atomicos
    else Stock insuficiente o conflicto
        TX->>PG: ROLLBACK
        UC-->>C: Rechazo controlado sin iniciar pago
    end
```

El resultado pendiente no confirma ni cancela el pedido. Pagos consulta la pasarela hasta resolver la incertidumbre; solo un resultado definitivo autoriza la transición correspondiente. Los pasos de intento y pedido requieren una política de reintentos persistida para recuperarse si el proceso se interrumpe entre ellos.

## Reglas de negocio

| ID | Regla propuesta |
|---|---|
| RN-01 | Cada pedido tiene una empresa compradora, un usuario responsable y un proveedor. |
| RN-02 | El pedido contiene al menos un ítem del mismo proveedor. |
| RN-03 | Las cantidades son positivas y cumplen los mínimos de compra. |
| RN-04 | El total se obtiene de cantidades y precios aceptados, con una política explícita de moneda y redondeo. |
| RN-05 | Solo se inicia un nuevo pago de un pedido pendiente y con reserva vigente; una confirmación tardía se reconcilia. |
| RN-06 | No se cancela directamente un pedido despachado o entregado. La cancelación de uno pagado requiere resolver el reembolso. |
| RN-07 | Pedido y reserva se persisten atómicamente antes de iniciar el pago externo. |
| RN-08 | Un rechazo definitivo permite liberar la reserva de forma idempotente; un timeout exige consultar el pago antes de liberarla. |
| RN-09 | Los precios son positivos y proceden del servidor, nunca del importe declarado por el cliente. |
| RN-10 | Solo un pedido en preparación puede pasar a despachado. |

## Capas y verificación

| Capa | Elementos del diseño | Comprobación |
|---|---|---|
| Dominio | Pedido, ItemPedido y OrderRepository. | Reglas probadas sin framework ni base de datos. |
| Aplicación | Casos de uso y puertos de coordinación. | Permisos, secuencia e idempotencia. |
| Infraestructura | Repositorio y unidad de trabajo PostgreSQL; adaptadores de otros módulos. | Rollback completo, concurrencia y recuperación. |
| Presentación y composición | OrderController y pedidos.module.ts. | HTTP correcto e inyección de implementaciones. |

**Anterior:** [Componentes](Nivel3-Diagrama-de-Componentes.md). **Detalle:** [Diseño interno](../03-diseno-de-software/diseno-interno/diseno-interno-de-modulos.md).
