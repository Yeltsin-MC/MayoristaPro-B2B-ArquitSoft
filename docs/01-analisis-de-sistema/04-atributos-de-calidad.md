# Atributos de calidad

| ID | Atributo de calidad | Escenario de calidad |
|---|---|---|
| AC01 | Rendimiento | Las búsquedas de productos, cotizaciones y confirmaciones de pedido deben responder en menos de 500 ms incluso cuando existan 2,000 usuarios concurrentes. |
| AC02 | Disponibilidad | El sistema debe permanecer disponible durante las campañas comerciales (escolar, navideña, cierre de mes) con un SLA mínimo de 99.5%. |
| AC03 | Escalabilidad | El sistema debe soportar un incremento de usuarios y solicitudes mediante escalabilidad horizontal, sin afectar significativamente su funcionamiento. |
| AC04 | Seguridad | Los datos de usuarios, cuentas, cotizaciones y operaciones comerciales deben estar protegidos frente a accesos no autorizados. |
| AC05 | Mantenibilidad | El sistema debe estar organizado en capas (Clean Architecture) para permitir cambios y correcciones sin afectar otras funcionalidades. |
| AC06 | Concurrencia | El sistema debe garantizar la integridad del stock cuando múltiples compradores confirmen pedidos simultáneamente, evitando sobreventa. |V
| AC07 | Confiabilidad | El sistema debe garantizar la integridad transaccional de pedidos y pagos mediante operaciones ACID. |
| AC08 | Auditabilidad | El sistema debe registrar las operaciones relevantes (cotizaciones, pedidos, pagos, cambios de estado) para fines de auditoría y trazabilidad. |
| AC09 | Interoperabilidad | El sistema debe integrarse con servicios externos (SUNAT/PSE, pasarela de pagos, servicio de IA, notificaciones) mediante APIs REST. |
| AC10 | Usabilidad | El sistema debe ser web y responsive, accesible desde computadoras y dispositivos móviles, con interfaz clara para usuarios empresariales. |

---

## Clasificación de atributos

Los atributos se agrupan en tres categorías según el aspecto del sistema que impactan:

| Categoría | Atributos | Enfoque |
|---|---|---|
| Operacionales | AC01, AC02, AC03, AC06, AC07 | Rendimiento, disponibilidad, escalabilidad y concurrencia |
| De seguridad y confianza | AC04, AC08 | Protección de datos y trazabilidad |
| De evolución y uso | AC05, AC09, AC10 | Mantenibilidad, integración y experiencia de usuario |

---

## Atributos críticos y su justificación

### AC01 — Rendimiento
El sistema debe soportar **2,000 usuarios concurrentes** en picos estacionales. Se justifica por el volumen proyectado de compradores empresariales en Ayacucho (700 negocios activos × 2 usuarios × factor de concurrencia del 30% + margen de seguridad del 20%).

Para lograrlo: caché Redis, balanceador de carga, procesamiento asíncrono con Amazon SQS y consultas optimizadas en PostgreSQL.

### AC03 — Escalabilidad
La arquitectura debe permitir escalabilidad horizontal sin rediseño. Esto se logra con múltiples instancias del backend detrás de un balanceador y sesiones almacenadas en Redis (no en memoria local).

### AC06 — Concurrencia
Es el atributo más crítico del dominio B2B. Cuando múltiples compradores confirmen pedidos simultáneamente sobre el mismo producto, el sistema debe aplicar transacciones ACID y control de bloqueo para evitar sobreventa. Este atributo es un driver arquitectónico directo.

### AC07 — Confiabilidad
Las operaciones de pedido, pago y facturación deben ser transaccionales. PostgreSQL garantiza ACID. Los eventos secundarios (notificaciones, facturación) se procesan asíncronamente con reintentos.

---

## Atributos y su relación con los drivers arquitectónicos

| Atributo | Driver arquitectónico relacionado |
|---|---|
| AC01 Rendimiento | Alta concurrencia en picos estacionales |
| AC03 Escalabilidad | Crecimiento proyectado a 3 años |
| AC04 Seguridad | Manejo de información comercial sensible |
| AC06 Concurrencia | Integridad de stock en operaciones simultáneas |
| AC07 Confiabilidad | Integridad transaccional de pedidos y pagos |
| AC08 Auditabilidad | Trazabilidad de operaciones comerciales |
| AC09 Interoperabilidad | Integración con SUNAT, pasarela, IA y notificaciones |
