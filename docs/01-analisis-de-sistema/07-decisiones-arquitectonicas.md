# Decisiones arquitectónicas

| ID | Decisión arquitectónica | Driver relacionado | Justificación | Resultado |
|---|---|---|---|---|
| ADR-001 | Monolito modular | DA01 — Escalabilidad; DA09 — Mantenibilidad | Organizar las funcionalidades en módulos independientes dentro de una misma aplicación desplegable, evitando la complejidad operativa de los microservicios. | Módulos de Usuarios, Proveedores, Productos, Cotizaciones, Pedidos, Pagos, IA, Reportes y Administración. |
| ADR-002 | Clean Architecture | DA09 — Mantenibilidad | Separar las reglas de negocio de los detalles tecnológicos para permitir cambios en framework, base de datos o UI sin afectar el dominio. | Capas de Dominio, Aplicación, Infraestructura y Presentación. |
| ADR-003 | Estrategia de caché | DA02 — Rendimiento | Reducir consultas repetitivas a la base de datos y mantener latencias bajas durante picos de concurrencia. | Caché Redis para productos, proveedores y sesiones. |
| ADR-004 | Integración de pagos mediante interfaces y adaptadores | DA06 — Integración con pagos | Desacoplar los casos de uso del proveedor específico de pagos para permitir cambiar de pasarela sin modificar el dominio. | Contrato de pagos y adaptador para la pasarela externa (Niubiz / Mercado Pago). |
| ADR-005 | PostgreSQL como base de datos transaccional | DA03 — Integridad de stock; DA11 — Confiabilidad | Garantizar transacciones ACID e integridad referencial en operaciones críticas de pedidos, pagos y stock. | PostgreSQL como motor principal con transacciones, constraints e índices optimizados. |
| ADR-006 | Estrategia de persistencia políglota | DA02 — Rendimiento; DA10 — Auditabilidad | Cada tipo de dato tiene un motor óptimo: transaccional en SQL, flexible/masivo en NoSQL, temporal en caché. | PostgreSQL (v1) + Redis (v1); MongoDB y Elasticsearch previstos para v2. |
| ADR-007 | Módulo de IA desacoplado con fallback | DA05 — Servicio de IA | Permitir que el sistema siga operando aunque el servicio de IA no esté disponible, sin bloquear la búsqueda ni la comparación de proveedores. | Motor de reglas con Scikit-learn (v1), API externa prevista para v2, con fallback automático. |
| ADR-008 | Procesamiento asíncrono con colas | DA02 — Rendimiento; DA07 — Facturación | Desacoplar operaciones no críticas (notificaciones, facturación, emails) del flujo principal de pedido para no bloquear al usuario. | Amazon SQS para cola de mensajes; workers independientes con reintentos. |
| ADR-009 | Escalabilidad horizontal con balanceador | DA01 — Escalabilidad | Permitir incrementar la capacidad de cómputo agregando instancias sin rediseñar el sistema. | Múltiples instancias del backend detrás de AWS ALB; sesiones en Redis. |
| ADR-010 | Integración con PSE externo para facturación | DA07 — Facturación | Delegar la emisión de comprobantes electrónicos a un proveedor autorizado por SUNAT, evitando implementar la firma digital y validación internamente. | Integración con PSE (NubeFacT / Alanube) mediante API REST; XML y CDR almacenados. |
| ADR-011 | API-First | DA08 — API REST; DA05 — Servicio de IA | Diseñar primero las APIs y luego los consumidores, permitiendo que el frontend, futuras apps móviles y ERPs consuman los mismos servicios. | API REST documentada; frontend Angular desacoplado del backend. |
| ADR-012 | Multi-tenancy con aislamiento lógico | DA04 — Seguridad | Permitir que múltiples empresas (proveedores y compradores) compartan la plataforma con aislamiento de datos por tenant. | Campo tenant_id en tablas; filtros automáticos en consultas; validación por rol. |
| ADR-013 | Autenticación con JWT y autorización por roles | DA04 — Seguridad | Garantizar que cada usuario acceda solo a las funcionalidades permitidas según su rol. | Tokens JWT con expiración; middleware de autorización por rol (proveedor, comprador, admin). |
| ADR-014 | Integración con servicios externos mediante adaptadores | DA05, DA06, DA07 — Integraciones | Aislar el dominio de los detalles de cada servicio externo para permitir cambiar de proveedor sin afectar la lógica de negocio. | Puertos y adaptadores para IA, pagos, facturación, notificaciones y mapas. |
| ADR-015 | Despliegue en AWS con créditos educativos | DA12 — Cloud y presupuesto | Utilizar servicios gestionados de AWS con créditos de AWS Academy durante el desarrollo, evitando costos operativos. | EC2, RDS, S3, SQS, CloudWatch en AWS; Cloudflare para CDN y WAF. |

---

## Detalle de decisiones críticas

### ADR-001 — Monolito modular
Se evaluó la alternativa de microservicios, pero se descartó por:
- Equipo de desarrollo pequeño.
- Necesidad de consistencia transaccional fuerte en pedidos y pagos.
- Complejidad operativa innecesaria (orquestación, service mesh, tracing distribuido).
- Mayor costo cloud.

El monolito modular permite extraer servicios en el futuro si el volumen lo justifica, sin rediseñar desde cero.

### ADR-005 — PostgreSQL como base transaccional
La integridad de stock y la consistencia de pagos son requisitos críticos del dominio B2B. MongoDB no ofrece transacciones multi-documento con el mismo nivel de garantía que PostgreSQL. Además, PostgreSQL permite consultas complejas para los dashboards analíticos sin necesidad de un motor adicional.

### ADR-006 — Persistencia políglota
Aunque PostgreSQL podría cubrir el 100% de los requisitos funcionales en v1, se prevé la incorporación de MongoDB (logs, catálogo extendido) y Elasticsearch (búsqueda avanzada) en v2, cuando el volumen de datos y la necesidad de búsqueda lo justifiquen. En v1 solo se implementan PostgreSQL y Redis para evitar sobreingeniería.

### ADR-007 — IA con fallback
El módulo de IA no debe ser un punto único de falla. Si el servicio de IA no está disponible, el comprador debe poder seguir buscando y comparando proveedores manualmente. El sistema muestra un mensaje informativo y registra la incidencia para monitoreo.

### ADR-008 — Procesamiento asíncrono
La confirmación de un pedido debe responder rápido al usuario. Las tareas secundarias (envío de notificaciones, emisión de factura, envío de email) se procesan en background mediante Amazon SQS, con reintentos automáticos en caso de fallo.

---

## Resumen

| Categoría | ADRs | Enfoque |
|---|---|---|
| Estructura | ADR-001, ADR-002, ADR-011 | Organización del sistema y APIs |
| Datos | ADR-005, ADR-006 | Motores de persistencia |
| Rendimiento | ADR-003, ADR-008, ADR-009 | Caché, colas y escalabilidad |
| Integraciones | ADR-004, ADR-007, ADR-010, ADR-014 | Servicios externos |
| Seguridad y operación | ADR-012, ADR-013, ADR-015 | Multi-tenancy, autenticación y cloud |
