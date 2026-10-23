# Atributos de calidad

Definen cómo debe comportarse MayoristaPro. Las cifras son metas de diseño pendientes de validación, no resultados de pruebas realizadas.

| ID | Atributo | Aplicación en MayoristaPro |
|---|---|---|
| AC01 | Rendimiento | Meta p95 de 500 ms o menos para consultas y operaciones locales definidas en EQ-01. |
| AC02 | Disponibilidad | Meta mensual de 99.5%; recuperación en hasta 4 horas (RTO) y pérdida máxima objetivo de 1 hora de datos (RPO). |
| AC03 | Escalabilidad | Evaluar hasta 2,000 usuarios concurrentes y permitir agregar instancias del backend. |
| AC04 | Seguridad | Controlar el acceso por identidad, rol, empresa y participación en la operación. |
| AC05 | Mantenibilidad | Separar módulos y capas para concentrar cada cambio en su responsabilidad. |
| AC06 | Concurrencia | Evitar sobreventa y stock negativo ante pedidos simultáneos. |
| AC07 | Confiabilidad | Guardar pedido y reserva de stock de forma atómica; confirmar y reconciliar el pago externo. |
| AC08 | Auditabilidad | Registrar quién realizó una operación, cuándo y qué estado cambió. |
| AC09 | Interoperabilidad | Integrar pagos, facturación, recomendaciones y notificaciones mediante contratos y adaptadores. |
| AC10 | Usabilidad | Interfaz web responsive con acciones y estados comprensibles para usuarios empresariales. |

## Prioridades del diseño

| Situación | Atributos principales | Respuesta propuesta |
|---|---|---|
| Dos negocios intentan comprar el mismo stock. | AC06, AC07 | Transacción y control de concurrencia en PostgreSQL. |
| Aumentan las consultas durante una campaña. | AC01, AC03 | Consultas optimizadas, caché y escalamiento medidos con pruebas. |
| Un usuario intenta consultar operaciones ajenas. | AC04, AC08 | Autorización y registro de intentos; acceso permitido a las partes de una operación compartida. |
| Cambia el proveedor de pagos o falla la recomendación. | AC05, AC09 | Adaptadores reemplazables y alternativa de consulta manual. |

Los **2,000 usuarios concurrentes** son un requisito académico de evaluación. No se presentan como una estimación demostrada del tráfico real de Ayacucho. Las pruebas deberán documentar mezcla de operaciones, duración, datos e infraestructura.

El pago de una pasarela externa no pertenece a la transacción ACID de PostgreSQL. Se requiere idempotencia (procesar un mismo evento una sola vez), confirmación y reconciliación de estados.
