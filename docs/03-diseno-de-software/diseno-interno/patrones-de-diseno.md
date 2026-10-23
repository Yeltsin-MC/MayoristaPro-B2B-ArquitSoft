# Patrones de diseño

Son patrones y mecanismos propuestos, no evidencia de código implementado. Se conservan los identificadores para mantener la trazabilidad.

## Patrones principales

| ID | Patrón o mecanismo | Aplicación en MayoristaPro | Problema que resuelve |
|---|---|---|---|
| P-01 | Repository | OrderRepository y su implementación PostgreSQL. | Separar el modelo de la persistencia. |
| P-02 | Inyección de dependencias | pedidos.module.ts conecta puertos con adaptadores. | Permitir pruebas y reemplazos explícitos. |
| P-03 | Strategy | Estrategia de recomendación por reglas y alternativa por precio. | Intercambiar algoritmos bajo un contrato. |
| P-04 | Adapter | Integraciones de pagos, PSE, mapas y proceso Python. | Traducir contratos propios a interfaces externas. |
| P-05 | Use Case | CrearPedido y ConfirmarPagoPedido. | Encapsular la coordinación de una operación. |
| P-06 | Value Object | Dinero, cantidades e ItemPedido con validaciones. | Evitar valores inválidos y cambios inconsistentes. |
| P-07 | Factory | Creación controlada de un Pedido válido. | Concentrar las condiciones iniciales de la entidad. |
| P-08 | DTO | Entrada HTTP y respuesta de los casos de uso. | No exponer directamente entidades ni aceptar campos internos. |
| P-09 | Compensación y reconciliación | Liberar una reserva tras rechazo definitivo; resolver cobros inciertos. | Recuperar un flujo que incluye un sistema externo. |
| P-10 | Circuit Breaker | Evaluar para integraciones con fallas repetidas; comenzar con timeouts y fallback de recomendación. | Limitar llamadas a una dependencia fallida. |
| P-11 | Specification | Evaluar si las reglas de elegibilidad de proveedores se vuelven complejas. | Reutilizar criterios sin duplicarlos. |
| P-12 | Facade | API pública de cada módulo. | Ocultar la organización interna a otros módulos. |

## Ejemplos para explicar

| Patrón | Ejemplo breve |
|---|---|
| Repository | El caso de uso solicita guardar un pedido; la implementación decide el SQL. |
| Adapter | Pagos solicita iniciar un pago; el adaptador traduce la operación al proveedor elegido. |
| Inyección de dependencias | Una prueba conecta un repositorio en memoria; el despliegue conecta PostgreSQL. |
| Strategy | La comparación usa puntuación por reglas o un orden alternativo por precio. |

## Consistencia de operaciones

Pedido y reserva usan una **unidad de trabajo** para compartir la transacción local. Las tareas posteriores usan **outbox**: el evento pendiente se guarda junto al cambio del pedido y luego se publica en SQS.

Los reintentos requieren **idempotencia**: una misma solicitud o notificación no debe duplicar el efecto. Una compensación no equivale a deshacer un pago externo automáticamente, y no se afirma que exista una saga completa en esta versión.

Specification y Circuit Breaker quedan sujetos a necesidad durante la implementación. No se incorporarán CQRS completo ni Event Sourcing sin una justificación concreta.
