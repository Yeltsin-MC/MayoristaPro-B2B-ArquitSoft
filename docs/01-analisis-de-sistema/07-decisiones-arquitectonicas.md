# Decisiones arquitectónicas

| ID | Decisión arquitectónica | Driver relacionado | Justificación | Aplicación propuesta |
|---|---|---|---|---|
| ADR-001 | Monolito modular | DA01 — Escalabilidad; DA09 — Mantenibilidad | Organizar las funcionalidades en módulos independientes dentro de una misma aplicación desplegable, evitando la complejidad operativa de los microservicios. | Módulos de Usuarios, Proveedores, Productos, Cotizaciones, Pedidos, Pagos, IA, Reportes y Administración. |
| ADR-002 | Clean Architecture | DA09 — Mantenibilidad | Separar las reglas de negocio de los detalles tecnológicos para permitir cambios en framework, base de datos o UI sin afectar el dominio. | Capas de Dominio, Aplicación, Infraestructura y Presentación. |
| ADR-003 | Estrategia de caché | DA02 — Rendimiento | Reducir consultas repetitivas a la base de datos y mantener latencias bajas durante picos de concurrencia. | Caché Redis para productos, proveedores y sesiones. |
| ADR-004 | Integración de pagos mediante interfaces y adaptadores | DA06 — Integración con pagos | Desacoplar los casos de uso del proveedor específico de pagos para permitir cambiar de pasarela sin modificar el dominio. | Contrato de pagos y adaptador para la pasarela externa (Niubiz / Mercado Pago). |
| ADR-005 | PostgreSQL como base de datos transaccional | DA03 — Integridad de stock; DA11 — Confiabilidad | Garantizar transacciones ACID e integridad referencial en operaciones críticas de pedidos, pagos y stock. | PostgreSQL como motor principal con transacciones, constraints e índices optimizados. |
| ADR-006 | Estrategia de persistencia políglota | DA02 — Rendimiento; DA10 — Auditabilidad | Usar PostgreSQL para transacciones y Redis para datos temporales; evaluar otros motores solo si existe una necesidad medida. | PostgreSQL (v1) + Redis (v1); MongoDB y Elasticsearch previstos para v2. |
| ADR-007 | Módulo de IA desacoplado con fallback | DA05 — Servicio de IA | Permitir que el sistema siga operando aunque el servicio de IA no esté disponible, sin bloquear la búsqueda ni la comparación de proveedores. | Proceso Python separado con puntuación por reglas en v1 y fallback en NestJS. Modelo entrenado o API externa como evolución evaluable. |
| ADR-008 | Procesamiento asíncrono con colas | DA02 — Rendimiento; DA07 — Facturación | Desacoplar operaciones no críticas (notificaciones, facturación, emails) del flujo principal de pedido para no bloquear al usuario. | Amazon SQS para cola de mensajes; workers independientes con reintentos. |
| ADR-009 | Escalabilidad horizontal con balanceador | DA01 — Escalabilidad | Permitir incrementar la capacidad de cómputo agregando instancias sin rediseñar el sistema. | Múltiples instancias del backend detrás de AWS ALB; sesiones en Redis. |
| ADR-010 | Integración con PSE externo para facturación | DA07 — Facturación | Delegar la emisión de comprobantes electrónicos a un proveedor autorizado por SUNAT, evitando implementar la firma digital y validación internamente. | Integración con PSE (NubeFacT / Alanube) mediante API REST; XML y CDR almacenados. |
| ADR-011 | API-First | DA08 — API REST; DA05 — Servicio de IA | Diseñar primero las APIs y luego los consumidores, permitiendo que el frontend, futuras apps móviles y ERPs consuman los mismos servicios. | API REST documentada; frontend Angular desacoplado del backend. |
| ADR-012 | Multi-tenancy con aislamiento lógico | DA04 — Seguridad | Permitir que múltiples empresas (proveedores y compradores) compartan la plataforma con aislamiento de datos por tenant. | Datos privados filtrados por empresa; catálogo visible y cotizaciones/pedidos autorizados por participación. El JWT no basta como autorización. |
| ADR-013 | Autenticación con JWT y autorización por roles | DA04 — Seguridad | Garantizar que cada usuario acceda solo a las funcionalidades permitidas según su rol. | Tokens JWT con expiración; middleware de autorización por rol (proveedor, comprador, admin). |
| ADR-014 | Integración con servicios externos mediante adaptadores | DA05, DA06, DA07 — Integraciones | Aislar el dominio de los detalles de cada servicio externo para permitir cambiar de proveedor sin afectar la lógica de negocio. | Puertos y adaptadores para IA, pagos, facturación, notificaciones y mapas. |
| ADR-015 | Despliegue en AWS con créditos educativos | DA12 — Cloud y presupuesto | Utilizar servicios gestionados de AWS con créditos de AWS Academy durante el desarrollo, ajustando el despliegue a los servicios y presupuesto disponibles. | EC2, RDS, S3, SQS, CloudWatch en AWS; Cloudflare para CDN y WAF. |

## Alcance de las decisiones

| Tema | Explicación para el proyecto |
|---|---|
| Monolito modular | Los módulos comerciales pertenecen a una aplicación backend. El proceso Python de recomendación es un componente auxiliar separado, no una división de todo el negocio en microservicios. |
| Clean Architecture | El dominio contiene reglas comerciales y no depende de NestJS, SQL ni SDK de proveedores. Las implementaciones se conectan mediante interfaces. |
| Consistencia | Pedido y reserva de stock se guardan en una transacción local. La pasarela se coordina mediante referencias persistidas, idempotencia y reconciliación; no mediante una transacción distribuida implícita. |
| Aislamiento por empresa | Una empresa no accede a información privada ajena. Comprador y proveedor sí acceden, según sus permisos, a la cotización o pedido que comparten. |
| IA | Las reglas de puntuación son una primera versión explicable. Usar una biblioteca no demuestra aprendizaje automático; un modelo entrenado requerirá datos y evaluación. |
| Evolución | MongoDB, Elasticsearch y una API de IA externa quedan para una versión posterior si su necesidad se justifica. |

Estas decisiones orientan la implementación. La capacidad, disponibilidad y tiempos de respuesta se deberán validar con pruebas; no son garantías actuales del sistema.
