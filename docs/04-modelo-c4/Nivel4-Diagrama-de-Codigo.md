# Nivel 4: diseño de código de Pedidos

**Pregunta:** ¿qué clases e interfaces colaborarán para crear un pedido? Es un diseño propuesto, no código ya implementado. Se detalla el módulo crítico en lugar de dibujar todas las clases del sistema.

## Diagrama de clases

![Diagrama UML de clases del módulo Pedidos](../../img/fuentes-svg/nivel4-clases.svg)

**Fuente editable:** [nivel4-clases.svg](../../img/fuentes-svg/nivel4-clases.svg).

Composición: un Pedido contiene sus ítems. Realización: el repositorio PostgreSQL implementa una interfaz. Las firmas se completarán en Sprint 02; no se presupone que ejecutar varias operaciones por separado forme una transacción.

## Secuencia principal

![Diagrama UML de secuencia de creación de pedido y pago](../../img/fuentes-svg/nivel4-secuencia.svg)

**Fuente editable:** [nivel4-secuencia.svg](../../img/fuentes-svg/nivel4-secuencia.svg).

El resultado pendiente conserva el intento para reconciliación. Los resultados definitivos y verificados se aplican a intento, pedido, reserva y outbox dentro de la misma transacción local cuando corresponde. La llamada a la pasarela queda fuera de esa transacción.

## Reglas de negocio

| ID | Regla propuesta |
|---|---|
| RN-01 | Cada pedido tiene una empresa compradora, un usuario responsable y un proveedor. |
| RN-02 | El pedido contiene al menos un ítem del mismo proveedor. |
| RN-03 | Las cantidades usan la presentación ofertada, son positivas, alcanzan el mínimo y respetan el múltiplo; la transacción revalida esas condiciones. |
| RN-04 | El total se obtiene de cantidades y precios aceptados, con una política explícita de moneda y redondeo. |
| RN-05 | Solo se inicia un nuevo pago de un pedido pendiente y con reserva vigente; una confirmación tardía se reconcilia. |
| RN-06 | No se cancela directamente un pedido despachado o entregado. La cancelación de uno pagado requiere resolver el reembolso. |
| RN-07 | Pedido y reserva se persisten atómicamente antes de iniciar el pago externo. |
| RN-08 | Un timeout o un resultado incierto mantiene el caso en reconciliación. Un rechazo definitivo se procesa según la política de reintentos y liberación pendiente de aprobación. |
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
