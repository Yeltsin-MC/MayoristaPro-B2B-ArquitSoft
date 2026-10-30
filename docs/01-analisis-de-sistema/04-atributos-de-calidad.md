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

## Cómo y con qué se medirá

Las siguientes herramientas y evidencias se proponen para la implementación. Las metas se comprobarán sobre el software construido; no se consideran resultados del Sprint 01.

| ID | Herramienta o medio | Procedimiento y evidencia |
|---|---|---|
| AC01 | k6 | Ejecutar consultas contra la URL desplegada y registrar p95, solicitudes por segundo y porcentaje de errores. Comparar con la meta por endpoint. |
| AC02 | Amazon CloudWatch y comprobaciones HTTP programadas | Registrar accesibilidad de operaciones críticas durante el período acordado. Calcular disponibilidad como tiempo disponible / tiempo observado × 100. Probar restauración y medir RTO y pérdida de datos para RPO. |
| AC03 | k6 y Amazon CloudWatch | Incrementar la carga de 500 a 1,000 y 2,000 usuarios virtuales. Comparar latencia y errores con CPU, memoria si está instrumentada y conexiones de base de datos; registrar recursos e instancias usados. |
| AC04 | Pruebas automatizadas con Jest y solicitudes HTTP de prueba | Intentar operaciones con distintos roles y empresas, tokens inválidos y acceso a recursos ajenos. Registrar casos autorizados/no autorizados y comprobar que no se filtran datos. |
| AC05 | Jest y análisis de dependencias con ESLint | Cambiar de forma controlada un adaptador, ejecutar regresión y revisar imports. Evidencia: pruebas aprobadas y ausencia de dependencias prohibidas en Dominio. |
| AC06 | k6 y consultas SQL en PostgreSQL | Ejecutar el escenario EQ-06: 500 compradores, una unidad por intento y 100 unidades iniciales. Contrastar respuestas con pedidos, ítems, reservas y stock final. Los rechazos esperados por stock no son errores técnicos. |
| AC07 | Jest, sandbox de pagos y PostgreSQL | Simular fallo, timeout, reintentos y eventos duplicados. Verificar rollback local, una sola aplicación de cada efecto y reconciliación sin pedidos o reservas huérfanos. |
| AC08 | Consultas de audit_log y registros en CloudWatch | Ejecutar operaciones conocidas y contrastarlas con sus registros de actor, fecha, entidad y cambio. Comprobar que no se registran secretos. |
| AC09 | Pruebas HTTP automatizadas y sandboxes disponibles | Probar respuestas válidas, rechazo, timeout y duplicados por integración. Registrar tiempos, estados y activación del fallback de IA según EQ-07. |
| AC10 | Sesiones de tareas con usuarios representativos, cronómetro y ficha de observación | Pedir que busquen un producto, soliciten una cotización y consulten un pedido. Registrar finalización, tiempos, errores y dificultades en móvil y computadora. Muestra y umbrales pendientes de acordar. |

## Momento de ejecución

1. **Durante el desarrollo:** pruebas unitarias de reglas y casos de uso, revisión de dependencias e integración local con PostgreSQL y sandboxes.
2. **Después del despliegue en AWS:** pruebas de extremo a extremo, carga, concurrencia, escalamiento y recuperación contra un entorno de pruebas representativo, con monitoreo activo y datos de prueba.
3. **Durante el período de observación:** medición de disponibilidad. Una prueba de pocos minutos no demuestra una meta mensual de 99.5%.
4. **Cierre de validación:** guardar configuración, versión probada, scripts, resultados, registros y comparación con las metas. Documentar incumplimientos y ajustes necesarios.

El generador de carga debe ejecutarse separado del backend bajo prueba, para no competir por sus recursos. El informe indicará duración, pausas, mezcla de operaciones y recursos usados. No se someterá a las pasarelas externas a la carga masiva sin autorización; su latencia y fallas se evaluarán por separado o con simulaciones identificadas como tales.

## Prioridades del diseño

| Situación | Atributos principales | Respuesta propuesta |
|---|---|---|
| Dos negocios intentan comprar el mismo stock. | AC06, AC07 | Transacción y control de concurrencia en PostgreSQL. |
| Aumentan las consultas durante una campaña. | AC01, AC03 | Consultas optimizadas, caché y escalamiento medidos con pruebas. |
| Un usuario intenta consultar operaciones ajenas. | AC04, AC08 | Autorización y registro de intentos; acceso permitido a las partes de una operación compartida. |
| Cambia el proveedor de pagos o falla la recomendación. | AC05, AC09 | Adaptadores reemplazables y alternativa de consulta manual. |

Los **2,000 usuarios concurrentes** son un requisito académico de evaluación. No se presentan como una estimación demostrada del tráfico real de Ayacucho. Las pruebas deberán documentar mezcla de operaciones, duración, datos e infraestructura.

El pago de una pasarela externa no pertenece a la transacción ACID de PostgreSQL. Se requiere idempotencia (procesar un mismo evento una sola vez), confirmación y reconciliación de estados.
