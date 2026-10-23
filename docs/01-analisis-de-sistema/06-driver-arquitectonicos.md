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
| DA11 | El sistema debe mantener consistentes los pedidos, el stock y los estados de pago. | AC07 — Confiabilidad | Requiere transacciones locales, idempotencia y reconciliación con la pasarela externa. |
| DA12 | El sistema debe desplegarse sobre infraestructura cloud con presupuesto limitado. | RC10 y RC14 — Cloud y presupuesto | Influye en la selección de servicios gestionados (según disponibilidad de la cuenta educativa) y en la optimización de costos. |

## Cómo se relacionan

Un driver es una necesidad que condiciona la arquitectura. La decisión es la respuesta técnica elegida para atenderla.

| Necesidad | Driver | Decisión relacionada |
|---|---|---|
| Evitar vender dos veces las mismas unidades. | DA03 | ADR-005: PostgreSQL y transacciones con control de concurrencia. |
| Mantener consultas rápidas al aumentar usuarios. | DA01, DA02 | ADR-003 y ADR-009: caché y escalamiento horizontal. |
| Cambiar la pasarela sin modificar reglas comerciales. | DA06, DA09 | ADR-002 y ADR-004: Clean Architecture y adaptadores. |
| Seguir buscando proveedores si falla la recomendación. | DA05 | ADR-007: componente desacoplado con fallback. |

La concurrencia de 2,000 usuarios y la latencia p95 son objetivos de evaluación. Los escenarios de calidad precisan cómo se comprobarán.
