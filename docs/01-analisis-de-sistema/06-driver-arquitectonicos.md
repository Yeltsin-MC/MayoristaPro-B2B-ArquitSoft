# Drivers arquitectónicos

Los drivers arquitectónicos identificados para el sistema son los siguientes:

| ID | Driver arquitectónico | Origen | ¿Por qué influye en la arquitectura? |
|---|---|---|---|
| DA01 | El sistema debe soportar 2,000 usuarios concurrentes durante campañas comerciales. | AC03 — Escalabilidad | Influye en la estrategia de escalamiento horizontal y despliegue con balanceador de carga. |
| DA02 | El sistema debe mantener tiempos de respuesta menores a 500 ms en p95 durante alta concurrencia. | AC01 — Rendimiento | Influye en el uso de caché Redis, consultas optimizadas y procesamiento asíncrono. |
| DA03 | El sistema debe garantizar la integridad del stock ante confirmaciones simultáneas de pedidos. | AC06 — Concurrencia | Influye en el uso de transacciones ACID, bloqueo optimista/pesimista y control de concurrencia en PostgreSQL. |
| DA04 | El sistema debe proteger los datos de usuarios y operaciones comerciales. | AC04 — Seguridad | Influye en autenticación con JWT, autorización por roles, HTTPS y protección perimetral con Cloudflare. |
| DA05 | El sistema debe integrar un módulo de recomendación de proveedores con IA. | RC07 — Servicio de IA | Influye en el diseño de un componente de IA desacoplado, con fallback si el servicio no está disponible. |
| DA06 | El sistema debe integrarse con una pasarela de pago externa mediante API. | RC04 — Pasarela de pago | Condiciona la forma de comunicación con servicios externos y el manejo de webhooks. |
| DA07 | El sistema debe integrarse con un PSE externo para emitir comprobantes electrónicos. | RC05 — Servicio de facturación | Influye en el procesamiento asíncrono de facturación mediante colas (Amazon SQS). |
| DA08 | El sistema debe utilizar API REST para la comunicación entre frontend y backend. | RC03 — API REST | Limita las alternativas de comunicación entre las partes del sistema. |
| DA09 | El sistema debe permitir modificar funcionalidades sin afectar otros módulos. | AC05 — Mantenibilidad | Influye en la separación de responsabilidades, modularidad y Clean Architecture. |
| DA10 | El sistema debe registrar las operaciones relevantes para auditoría y trazabilidad. | AC08 — Auditabilidad | Influye en el diseño de un módulo de logs y almacenamiento de eventos. |
| DA11 | El sistema debe garantizar la integridad transaccional de pedidos y pagos. | AC07 — Confiabilidad | Influye en el uso de transacciones ACID y procesamiento asíncrono con reintentos. |
| DA12 | El sistema debe desplegarse sobre infraestructura cloud con presupuesto limitado. | RC10 y RC14 — Cloud y presupuesto | Influye en la selección de servicios gestionados (AWS Academy, Free Tier) y en la optimización de costos. |

---

## Clasificación de drivers

Los drivers se agrupan según el aspecto que impactan en la arquitectura:

| Categoría | Drivers | Enfoque |
|---|---|---|
| Rendimiento y escalabilidad | DA01, DA02, DA03 | Concurrencia, latencia, integridad de stock |
| Seguridad y confiabilidad | DA04, DA10, DA11 | Protección, auditoría, transaccionalidad |
| Integración | DA05, DA06, DA07, DA08 | Servicios externos y comunicación entre componentes |
| Evolución y operación | DA09, DA12 | Mantenibilidad y sostenibilidad operativa |

---

## Drivers críticos y su impacto

### DA01 y DA02 — Concurrencia y rendimiento
Son los drivers más importantes porque definen la capacidad del sistema para operar en picos estacionales (campaña escolar, navideña, cierre de mes). Influyen directamente en:
- Escalabilidad horizontal con múltiples instancias backend.
- Uso de caché Redis para consultas frecuentes.
- Procesamiento asíncrono con Amazon SQS.
- Balanceo de carga con AWS ALB.

### DA03 — Integridad transaccional de stock
Es el driver más crítico del dominio B2B. Cuando múltiples compradores confirmen pedidos simultáneamente sobre el mismo producto, el sistema debe garantizar:
- Validación de stock dentro de una transacción ACID.
- Bloqueo optimista o pesimista según el caso.
- Rechazo de pedidos que excedan el stock disponible.
- Cero sobreventa y cero stock negativo.

### DA05 — IA como componente arquitectónico
La IA no es una funcionalidad accesoria; es un componente arquitectónico que debe:
- Estar desacoplado del resto del sistema.
- Tener fallback si el servicio no está disponible.
- Ser evolutivo: motor de reglas en v1, modelo ML o API externa en v2.

### DA09 — Mantenibilidad mediante Clean Architecture
La decisión de usar Clean Architecture responde a este driver. Permite:
- Modificar reglas de negocio sin tocar infraestructura.
- Cambiar tecnologías sin afectar el dominio.
- Testear sin depender de BD ni framework.

---

## Relación drivers ↔ atributos de calidad ↔ restricciones

| Driver | Atributo de calidad | Restricción |
|---|---|---|
| DA01 | AC03 — Escalabilidad | RC13 — Alta concurrencia |
| DA02 | AC01 — Rendimiento | RC13 — Alta concurrencia |
| DA03 | AC06 — Concurrencia | RC12 — Arquitectura definida |
| DA04 | AC04 — Seguridad | RC06 — Validación de RUC |
| DA05 | AC09 — Interoperabilidad | RC07 — Servicio de IA |
| DA06 | AC09 — Interoperabilidad | RC04 — Pasarela de pago |
| DA07 | AC09 — Interoperabilidad | RC05 — Facturación |
| DA08 | AC09 — Interoperabilidad | RC03 — API REST |
| DA09 | AC05 — Mantenibilidad | RC12 — Clean Architecture |
| DA10 | AC08 — Auditabilidad | RC12 — Arquitectura definida |
| DA11 | AC07 — Confiabilidad | RC12 — Arquitectura definida |
| DA12 | AC02 — Disponibilidad | RC10 y RC14 — Cloud y presupuesto |
