# Escenarios de atributos de calidad del Marketplace

## EQ-01. Rendimiento: búsqueda y confirmación de pedidos

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Rendimiento |
| **Fuente** | Comprador empresarial |
| **Estímulo** | El comprador busca productos, solicita cotizaciones o confirma un pedido. |
| **Condición** | El sistema opera con datos representativos y alta concurrencia (campaña escolar o navideña). |
| **Respuesta esperada** | El sistema muestra resultados de búsqueda, cotizaciones o confirmación de pedido sin errores inesperados. |
| **Medida** | El 95 % de las consultas responde en 500 ms o menos, con menos del 1 % de errores técnicos, durante una prueba con 2,000 usuarios simultáneos. |
| **Verificación** | Ejecutar pruebas de carga con k6 contra el entorno de staging (3 instancias EC2 + RDS + Redis) y registrar tiempos de respuesta p50/p95/p99, tasa de errores y usuarios concurrentes activos. |
| **Decisiones que la soportan** | ADR-003 (Redis), ADR-008 (SQS async), ADR-009 (escalabilidad horizontal). |

---

## EQ-02. Disponibilidad: continuidad durante campañas comerciales

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Disponibilidad |
| **Fuente** | Proveedor mayorista / Comprador empresarial |
| **Estímulo** | El usuario intenta operar durante una campaña comercial (escolar, navideña, cierre de mes) o cuando falla un componente. |
| **Condición** | El sistema está desplegado en AWS con monitoreo activo (CloudWatch) y múltiples instancias backend detrás del ALB. |
| **Respuesta esperada** | El sistema mantiene disponibles las operaciones críticas (login, búsqueda, pedidos, pagos) y comunica errores de forma controlada cuando un servicio externo no responde. |
| **Medida** | Disponibilidad mensual de 99.5 % para operaciones críticas; RTO de 4 horas y RPO de 1 hora. Operaciones críticas: autenticación, búsqueda de productos, cotizaciones, confirmación de pedido y pago. |
| **Verificación** | Revisar los registros de Amazon CloudWatch y calcular períodos de disponibilidad e interrupción. Simular falla de una instancia EC2 y medir tiempo de reconexión del ALB. |
| **Decisiones que la soportan** | ADR-009 (múltiples instancias + ALB), ADR-015 (AWS con CloudWatch). |

---

## EQ-03. Escalabilidad: aumento de usuarios concurrentes

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Escalabilidad |
| **Fuente** | Incremento de solicitudes de compradores y proveedores |
| **Estímulo** | Aumenta la cantidad de usuarios que utilizan MayoristaPro simultáneamente. |
| **Condición** | Se realiza una prueba con datos representativos, configuración de 3 instancias EC2, Redis y PostgreSQL. |
| **Respuesta esperada** | El sistema soporta el aumento de usuarios sin superar los límites acordados de tiempo de respuesta y errores. |
| **Medida** | Soportar hasta 2,000 usuarios simultáneos con el 95 % de las respuestas por debajo de 500 ms y menos del 1 % de errores técnicos. El sistema puede agregar instancias backend sin rediseño (sin estado en memoria local). |
| **Verificación** | Aumentar progresivamente la carga con k6 (500 → 1,000 → 2,000 VUs) y comparar tiempos de respuesta, errores y uso de CPU/memoria por instancia. |
| **Decisiones que la soportan** | ADR-001 (monolito modular sin estado), ADR-003 (sesiones en Redis), ADR-009 (ALB + múltiples instancias). |

---

## EQ-04. Seguridad: acceso a operaciones protegidas

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Seguridad |
| **Fuente** | Usuario sin sesión, con credenciales inválidas o sin permisos suficientes |
| **Estímulo** | El usuario intenta acceder a una función protegida o realizar una operación no autorizada. |
| **Condición** | Se realizan pruebas sobre las funciones protegidas de MayoristaPro con los tres roles definidos: Proveedor, Comprador y Administrador. |
| **Respuesta esperada** | El sistema rechaza la operación, no ejecuta el cambio solicitado y no expone información sensible (sin stack traces, sin datos de otros tenants). |
| **Medida** | Rechazar el 100 % de los intentos no autorizados en los siguientes escenarios: (1) token ausente o inválido, (2) token expirado, (3) rol incorrecto para la operación, (4) acceso a datos de otro tenant. |
| **Verificación** | Ejecutar pruebas de acceso con herramientas como Postman/Newman o Jest, revisar respuestas HTTP (401/403) y comprobar que ninguna respuesta incluya datos sensibles de otros usuarios o tenants. |
| **Decisiones que la soportan** | ADR-012 (multi-tenancy con tenant_id), ADR-013 (JWT + roles). |

---

## EQ-05. Mantenibilidad: cambios sin afectar otras funciones

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Mantenibilidad |
| **Fuente** | Equipo de desarrollo |
| **Estímulo** | Se modifica una regla de negocio (ej.: porcentaje de comisión) o se necesita sustituir el proveedor de pagos (Niubiz → Mercado Pago) o el servicio de IA. |
| **Condición** | El sistema está organizado en capas (Clean Architecture) con interfaces (puertos) que desacoplan el dominio de la infraestructura. |
| **Respuesta esperada** | El cambio se concentra en el módulo responsable (capa de infraestructura o dominio según corresponda) sin afectar módulos no relacionados. |
| **Medida** | Al sustituir el adaptador de pagos (ej.: de `NiubizPaymentAdapter` a `MercadoPagoPaymentAdapter`), los tests del módulo de Pagos y los tests de regresión de los módulos de Pedidos y Cotizaciones deben aprobarse sin modificaciones adicionales. Las dependencias entre módulos deben respetar la regla de Clean Architecture: ningún archivo de `dominio/` debe importar desde `infraestructura/`. |
| **Verificación** | Revisar los imports de `dominio/` con análisis estático (ESLint con reglas de dependencias), ejecutar tests del módulo modificado y los de regresión definidos. |
| **Decisiones que la soportan** | ADR-002 (Clean Architecture), ADR-004 (adaptador de pagos), ADR-014 (adaptadores externos). |

---

## EQ-06. Concurrencia: integridad del stock ante pedidos simultáneos

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Concurrencia |
| **Fuente** | Múltiples compradores empresariales |
| **Estímulo** | Varios compradores confirman pedidos simultáneamente sobre el mismo producto con stock limitado. |
| **Condición** | El sistema opera con datos representativos y procesa las confirmaciones en paralelo desde múltiples instancias backend conectadas al mismo PostgreSQL. |
| **Respuesta esperada** | El sistema acepta únicamente los pedidos que pueden cubrirse con el stock disponible, rechaza los restantes y no genera sobreventa ni stock negativo. |
| **Medida** | Con 500 compradores intentando adquirir un producto con 100 unidades disponibles, el sistema debe aceptar exactamente 100 pedidos y rechazar los 400 restantes, sin sobreventa ni stock negativo. La prueba se ejecuta en un entorno con al menos 2 instancias backend activas para validar el aislamiento transaccional. |
| **Verificación** | Ejecutar prueba de concurrencia con k6 simulando 500 confirmaciones simultáneas (`POST /api/v1/orders`) sobre el mismo `productoId` con `stock = 100`. Validar: (a) `SELECT count(*) FROM pedidos WHERE producto_id = X AND estado = 'confirmado'` = 100, (b) `SELECT stock FROM productos WHERE id = X` = 0, (c) 0 pedidos con stock negativo. |
| **Decisiones que la soportan** | ADR-005 (PostgreSQL ACID + SELECT FOR UPDATE), ADR-009 (múltiples instancias). |

---

## EQ-07. Interoperabilidad: integración con servicios externos

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Interoperabilidad |
| **Fuente** | Servicios externos (SUNAT/PSE, pasarela de pagos, IA, notificaciones) |
| **Estímulo** | El sistema debe emitir un comprobante electrónico, procesar un pago o generar una recomendación con IA. |
| **Condición** | Los servicios externos están disponibles en modo sandbox y responden dentro de los tiempos acordados. |
| **Respuesta esperada** | El sistema se comunica correctamente con el servicio externo mediante su adaptador, procesa la respuesta y actualiza el estado correspondiente en la plataforma. Si el servicio externo no responde, el módulo de IA activa el fallback y los demás servicios registran el error para reintento. |
| **Medida** | El 100 % de las integraciones críticas (PSE, pasarela de pagos, IA, notificaciones) debe responder exitosamente en modo sandbox. Tiempo de respuesta aceptable por integración: PSE ≤ 3 s, pasarela ≤ 2 s, IA ≤ 1 s, notificaciones ≤ 2 s. El fallback de IA debe activarse en menos de 500 ms cuando el servicio no responde. |
| **Verificación** | Ejecutar tests de integración con Jest (o Postman/Newman) contra los sandboxes de cada servicio. Para el fallback de IA: simular timeout del servicio y verificar que el sistema responde con resultados del motor de reglas local en menos de 500 ms. |
| **Decisiones que la soportan** | ADR-004 (adaptador pagos), ADR-007 (IA con fallback), ADR-010 (PSE externo), ADR-014 (adaptadores externos). |

---

## Resumen de escenarios

| Código | Atributo de calidad | Qué se busca comprobar | ADRs relacionados |
|---|---|---|---|
| EQ-01 | Rendimiento | Que MayoristaPro responda en ≤ 500 ms para el p95 con 2,000 usuarios concurrentes. | ADR-003, ADR-008, ADR-009 |
| EQ-02 | Disponibilidad | Que las operaciones críticas estén disponibles ≥ 99.5 % mensual con RTO ≤ 4 h / RPO ≤ 1 h. | ADR-009, ADR-015 |
| EQ-03 | Escalabilidad | Que el sistema soporte hasta 2,000 usuarios simultáneos sin rediseño. | ADR-001, ADR-003, ADR-009 |
| EQ-04 | Seguridad | Que las operaciones protegidas rechacen el 100 % de intentos no autorizados. | ADR-012, ADR-013 |
| EQ-05 | Mantenibilidad | Que sustituir un adaptador no rompa módulos no relacionados. | ADR-002, ADR-004, ADR-014 |
| EQ-06 | Concurrencia | Que el stock sea íntegro ante 500 confirmaciones simultáneas sobre 100 unidades. | ADR-005, ADR-009 |
| EQ-07 | Interoperabilidad | Que las 4 integraciones críticas funcionen en sandbox con tiempos definidos. | ADR-004, ADR-007, ADR-010, ADR-014 |
