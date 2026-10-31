# Escenarios de atributos de calidad

Son pruebas propuestas para comprobar el diseño. **Estado de todos los escenarios: pendiente de implementación y validación.** Las metas dependen del entorno y no representan capacidad demostrada.

El [plan de medición de calidad](09-plan-de-medicion-calidad.md) detalla herramientas, datos, duración, carga, criterios de aprobación y evidencias para ejecutar estos escenarios después del despliegue.

## EQ-01. Rendimiento

| Elemento | Descripción |
|---|---|
| Atributo | AC01 |
| Fuente | Comprador empresarial. |
| Estímulo | Busca productos, consulta cotizaciones o registra un pedido pendiente. |
| Condición | Datos representativos y una mezcla documentada de operaciones, con hasta 2,000 usuarios concurrentes. |
| Respuesta esperada | Responder sin errores técnicos inesperados; medir por separado las llamadas que esperan servicios externos. |
| Medida propuesta | Meta p95 ≤ 500 ms y menos de 1% de errores técnicos para endpoints locales definidos. Los rechazos de negocio esperados se contabilizan aparte. |
| Verificación | k6: registrar endpoints, duración, datos, infraestructura, p50/p95/p99, solicitudes por segundo y errores. |
| Decisiones relacionadas | ADR-003, ADR-008, ADR-009 |

## EQ-02. Disponibilidad

| Elemento | Descripción |
|---|---|
| Atributo | AC02 |
| Fuente | Usuario de la plataforma o componente que presenta una falla. |
| Estímulo | Intenta operar durante una campaña comercial o se interrumpe una instancia del backend. |
| Condición | Despliegue AWS con monitoreo y estrategia de copias de seguridad y restauración documentados. |
| Respuesta esperada | Mantener las operaciones disponibles y recuperar el servicio y los datos según las metas. |
| Medida propuesta | Meta mensual 99.5%; RTO ≤ 4 horas y RPO ≤ 1 hora. Definir endpoints críticos y tratamiento de dependencias externas. |
| Verificación | Monitorear autenticación, catálogo, cotizaciones, pedidos y registro de pagos; simular fallas y restaurar una copia. |
| Decisiones relacionadas | ADR-009, ADR-015 |

## EQ-03. Escalabilidad

| Elemento | Descripción |
|---|---|
| Atributo | AC03 |
| Fuente | Compradores y proveedores que incrementan la demanda. |
| Estímulo | Aumenta la cantidad de usuarios y solicitudes simultáneas. |
| Condición | Prueba repetible con configuración y conjunto de datos registrados. |
| Respuesta esperada | Agregar instancias y atender el incremento dentro de las metas definidas. |
| Medida propuesta | Evaluar 500 → 1,000 → 2,000 usuarios virtuales, conservando las metas de EQ-01 para la misma mezcla de operaciones. |
| Verificación | Comparar latencia, errores, CPU, memoria y conexiones de PostgreSQL; registrar número de instancias y límites del generador de carga. |
| Decisiones relacionadas | ADR-001, ADR-003, ADR-009 |

## EQ-04. Seguridad

| Elemento | Descripción |
|---|---|
| Atributo | AC04 |
| Fuente | Usuario sin sesión, con credenciales inválidas o sin permisos suficientes. |
| Estímulo | Intenta ejecutar una operación para la que no tiene autorización. |
| Condición | Pruebas con comprador, proveedor y administrador de distintas empresas. |
| Respuesta esperada | Rechazar accesos indebidos y permitir operaciones compartidas solo a las partes autorizadas. |
| Medida propuesta | Rechazar todos los casos no autorizados del conjunto de pruebas: token inválido/expirado, rol incorrecto y acceso a información privada ajena. |
| Verificación | Probar también accesos válidos al catálogo y al pedido compartido; revisar respuestas y ausencia de datos sensibles. |
| Decisiones relacionadas | ADR-012, ADR-013 |

## EQ-05. Mantenibilidad

| Elemento | Descripción |
|---|---|
| Atributo | AC05 |
| Fuente | Equipo de desarrollo. |
| Estímulo | Sustituye el adaptador de pagos por otro que cumple el mismo contrato. |
| Condición | Módulos con interfaces y pruebas del comportamiento esperado. |
| Respuesta esperada | Concentrar el cambio en el adaptador y su configuración. |
| Medida propuesta | Pruebas de Pagos y regresión de Pedidos aprobadas; dominio sin imports de NestJS, infraestructura o SDK externos. |
| Verificación | Revisar dependencias y ejecutar pruebas acordadas; un cambio del contrato requiere evaluar sus consumidores. |
| Decisiones relacionadas | ADR-002, ADR-004, ADR-014 |

## EQ-06. Concurrencia

Para el caso mayorista, la unidad del ensayo será una **presentación comercial**: por ejemplo, caja de 12 artículos, con mínimo de 1 caja y múltiplo de 1. Las 100 unidades iniciales y cada intento de una unidad se interpretan como 100 cajas y una caja, respectivamente. El ensayo no representa venta minorista de un artículo suelto; se registrará la equivalencia en el conjunto de datos.

| Elemento | Descripción |
|---|---|
| Atributo | AC06, AC07 |
| Fuente | 500 compradores empresariales distintos. |
| Estímulo | Intentan reservar simultáneamente una unidad del mismo producto. |
| Condición | 100 unidades iniciales; cantidad mínima de una unidad, sin reservas previas, sin cancelaciones, al menos dos instancias backend y pagos simulados aprobados. |
| Respuesta esperada | Aceptar solo reservas cubiertas por stock y rechazar las restantes por falta de existencias. |
| Medida propuesta | 100 pedidos/reservas aceptados, 400 rechazos esperados por stock y stock final 0, sin reservas huérfanas ni duplicados. |
| Verificación | k6 y consulta de pedidos unida a pedido_items para contar el producto probado; contrastar unidades reservadas y stock. Simular fallas y reintentos en pruebas adicionales de recuperación. |
| Decisiones relacionadas | ADR-005, ADR-009 |

## EQ-07. Interoperabilidad

| Elemento | Descripción |
|---|---|
| Atributo | AC09 |
| Fuente | Caso de uso que requiere un servicio de pago, facturación, recomendación o notificación. |
| Estímulo | Solicita la operación al servicio integrado, que puede responder, fallar o superar el tiempo de espera. |
| Condición | Sandboxes disponibles y fallas simuladas para validar timeouts y respuestas duplicadas. |
| Respuesta esperada | Registrar estados y fallos; no duplicar efectos. Ante incertidumbre del pago, consultar/reconciliar antes de repetir el cobro o liberar la reserva. |
| Medida propuesta | Metas de respuesta del proveedor: PSE ≤ 3 s, pago ≤ 2 s y notificaciones ≤ 2 s. Recomendación: timeout de 1 s y fallback en ≤ 500 ms adicionales. |
| Verificación | Probar éxito, rechazo, timeout y duplicados por integración. Para IA, comprobar respuesta degradada en ≤ 1.5 s bajo las condiciones de prueba y mantener la comparación manual. |
| Decisiones relacionadas | ADR-004, ADR-007, ADR-010, ADR-014 |

## EQ-08. Auditabilidad

| Elemento | Descripción |
|---|---|
| Atributo | AC08 |
| Fuente | Comprador, proveedor o administrador autenticado. |
| Estímulo | Ejecuta operaciones auditables sobre pedidos y proveedores. |
| Condición | 20 operaciones preparadas con actor, entidad y cambio esperado conocidos. |
| Respuesta esperada | Conservar trazabilidad de cada operación sin registrar secretos. |
| Medida propuesta | 20 de 20 operaciones con actor, fecha, entidad y cambio identificables; sin tokens, contraseñas ni datos de tarjeta en los registros revisados. |
| Verificación | Contrastar la lista de operaciones con consultas de audit_log y registros de CloudWatch; guardar matriz y evidencia por ejecución. |
| Decisiones relacionadas | ADR-012, ADR-013, ADR-015 |

## EQ-09. Usabilidad

| Elemento | Descripción |
|---|---|
| Atributo | AC10 |
| Fuente | 5 compradores y 3 proveedores representativos; muestra formativa propuesta. |
| Estímulo | Realiza tareas de compra o gestión correspondientes a su rol. |
| Condición | Entorno desplegado con datos preparados, móvil y computadora; sin ayuda del moderador. |
| Respuesta esperada | Completar la tarea correctamente y comprender las acciones y estados mostrados. |
| Medida propuesta | Por tarea y dispositivo: al menos 4 de 5 compradores y 3 de 3 proveedores completan sin ayuda y sin errores críticos, dentro de los tiempos por tarea del plan. Umbrales pendientes de validación con la docente. |
| Verificación | Cronómetro y ficha por participante, tarea y dispositivo; registrar tiempos, finalización, errores y dificultades. No extrapolar representatividad estadística. |
| Decisiones relacionadas | ADR-002; organización de presentación separada de reglas comerciales. |

## Lectura de las medidas

- **p95 de 500 ms:** al menos el 95% de las solicitudes medidas debe completarse en ese tiempo.
- **Usuarios concurrentes:** usuarios virtuales activos con recorridos y pausas definidos; no equivalen a 2,000 solicitudes por segundo.
- **RTO:** tiempo objetivo de recuperación del servicio. **RPO:** pérdida máxima de datos expresada en tiempo.
- **Fallback:** alternativa disponible si falla la recomendación; no garantiza resolver fallas de pagos o facturación.
