# Plan propuesto de medición de atributos de calidad

**Alcance del Sprint 01:** definir herramientas, procedimientos y criterios de evaluación. **Estado:** pendiente de implementación y ejecución; no hay resultados medidos. Swagger/OpenAPI y la construcción de los scripts corresponden al Sprint 02 y siguientes entregas de implementación.

Las pruebas de aceptación sobre el sistema completo se realizarán **después del despliegue en un entorno de pruebas AWS**, cuando estén implementadas las operaciones evaluadas. Durante el desarrollo se ejecutarán las pruebas unitarias, de integración y de dependencias que correspondan.

## 1. Herramientas y función

| Herramienta o medio | Para qué se utilizará | Evidencia esperada |
|---|---|---|
| **Grafana k6** | Generar solicitudes HTTP de usuarios virtuales, aumentar la carga y medir tiempos, rendimiento y errores de la API. | Scripts versionados, configuración, resumen de métricas y resultado de los umbrales. |
| **Amazon CloudWatch** | Observar CPU, registros, conexiones de RDS y otras métricas disponibles durante la misma ventana de prueba. La memoria de EC2 requiere agente o instrumentación adicional. | Exportaciones de métricas y registros con fecha y hora, junto a la configuración de instancias. |
| **Jest y cliente HTTP de pruebas** | Verificar reglas, permisos, transacciones, reintentos y respuestas de integraciones controladas. | Casos ejecutados, resultados y estados antes/después. |
| **ESLint con reglas de imports configuradas** | Detectar dependencias prohibidas entre capas y módulos. Instalar ESLint por sí solo no verifica Clean Architecture. | Configuración de reglas y reporte de infracciones. |
| **Consultas SQL en PostgreSQL** | Contrastar respuestas HTTP con pedidos, ítems, reservas, stock y auditoría. | Consultas versionadas y resultados identificados por ejecución. |
| **Comprobaciones HTTP programadas** | Ejecutar recorridos críticos a intervalos regulares durante el período de observación. | Historial de accesibilidad, intervalos sin observación e incidentes. |
| **Cronómetro y ficha de observación** | Medir finalización, duración y dificultades de tareas realizadas por usuarios representativos. | Fichas anonimizadas, tiempos, errores y resultados por tarea. |

k6 genera la carga; CloudWatch ayuda a explicar qué ocurre en la infraestructura. Las consultas SQL verifican la integridad de los datos: una respuesta rápida no demuestra que el stock sea correcto.

## 2. Preparación del entorno

Antes de cada ejecución se registrarán: identificador de prueba, commit desplegado, URL y región, configuración de EC2/RDS/Redis, cantidad de instancias, versiones de herramientas y hora de inicio/fin con zona horaria.

Se propone un conjunto inicial de **20 proveedores, 1,000 productos y hasta 2,000 cuentas compradoras de prueba**. Se prepararán cotizaciones aceptadas vigentes, pedidos de consulta y credenciales válidas según el escenario. Son datos sintéticos propuestos; su tamaño se ajustará y dejará registrado antes de ejecutar. Las pruebas de escritura tendrán ofertas, stock y claves de idempotencia suficientes para evitar conflictos ajenos al objetivo de la prueba.

El generador k6 se ejecutará en una máquina distinta al backend. Se observarán también sus recursos y conectividad: si no puede producir la carga objetivo, el resultado se declarará inconcluso. Los datos se restablecerán entre ejecuciones comparables; no se guardarán tokens, contraseñas ni información real en los informes.

## 3. Rendimiento y escalabilidad con k6 — AC01 y AC03

### Operaciones y mezcla propuesta

Las rutas corresponden al [contrato de API](../03-diseno-de-software/contratos-api-rest.md), con base `/api/v1`.

| Proporción de operaciones | Endpoint | Preparación y resultado esperado |
|---|---|---|
| 50% | `GET /products?page=1&limit=20` | Consultar catálogo publicado; 200 con estructura válida. Variar páginas y filtros válidos. |
| 20% | `GET /providers` | Consultar proveedores publicados; 200. |
| 15% | `GET /quotations` | Comprador autenticado consulta sus cotizaciones; 200 sin datos ajenos. |
| 10% | `GET /orders/:id` | Cuenta participante consulta un pedido propio preparado; 200. |
| 5% | `POST /orders` | Cotización aceptada vigente, stock suficiente e Idempotency-Key nueva; 201 con pedido pendiente. |

La distribución se implementará y comprobará en los scripts; no es una medición del tráfico real. Las llamadas de autenticación preparatoria y los pagos externos se medirán aparte. El tiempo observado será el de HTTP desde el generador a la API; no representa el tiempo de renderizado de Angular.

### Carga y duración propuestas

| Fase | Duración | Usuarios virtuales activos | Uso del resultado |
|---|---|---|---|
| Comprobación inicial | 1 minuto | 5 | Validar credenciales, datos y respuestas antes de generar carga. |
| Calentamiento y subida | 2 minutos | De 0 a 500 | Identificar fallos de preparación; separar de la medición estable. |
| Meseta 1 | 5 minutos | 500 | Medir por endpoint y por etapa. |
| Subida | 2 minutos | De 500 a 1,000 | Observar comportamiento durante el incremento. |
| Meseta 2 | 5 minutos | 1,000 | Medir por endpoint y por etapa. |
| Subida | 2 minutos | De 1,000 a 2,000 | Observar comportamiento durante el incremento. |
| Meseta 3 | 5 minutos | 2,000 | Evaluar la meta académica con la mezcla definida. |
| Bajada | 2 minutos | De 2,000 a 0 | Registrar recuperación y completar iteraciones en curso. |

La comprobación inicial será una ejecución separada; el perfil de carga suma 23 minutos más el cierre de iteraciones. Cada usuario virtual tendrá una pausa propuesta de **2 segundos entre operaciones**. Los usuarios activos incluyen estas pausas y no equivalen a solicitudes por segundo. Se permitirán completar las iteraciones en curso y se registrarán las interrumpidas.

**Criterio de aprobación:** en cada meseta y para cada endpoint local, p95 ≤ 500 ms, menos de 1% de errores técnicos y respuestas con estado y contenido esperados. Se registrarán también p50, p99, solicitudes por segundo y cantidad de muestras. No se usará únicamente un promedio global ni un p95 que mezcle calentamiento y todas las cargas.

Los scripts etiquetarán endpoint y etapa y definirán umbrales de k6 para esas series. Se contabilizarán por separado rechazos de negocio previstos, fallos de transporte/5xx y respuestas inesperadas. Un 401 por una credencial de prueba vencida invalida la preparación; no se descartará silenciosamente para mejorar el resultado. En el perfil normal, un rechazo por falta de stock indica revisar el conjunto de datos.

Para evaluar **escalamiento**, se comparará el mismo perfil con una y luego dos instancias backend, manteniendo datos, versión, tamaño de cada instancia y configuración de base de datos comparables. Se relacionarán latencia y errores con CPU, memoria instrumentada y conexiones de RDS. Si una configuración falla, se informará el máximo nivel que cumplió y su cuello de botella; no se afirmará que agregar instancias garantiza capacidad.

## 4. Concurrencia y confiabilidad — AC06 y AC07

Las cantidades del ensayo se expresarán en una presentación mayorista: una caja de 12 artículos como unidad de venta, mínimo 1 caja y múltiplo 1. El stock inicial será de 100 cajas y cada comprador solicitará una caja. El informe conservará esta equivalencia para no confundir una presentación comercial con un artículo suelto.

Se ejecutará EQ-06 por separado del perfil normal: **500 compradores distintos, 100 unidades disponibles y una unidad por intento**, con dos instancias backend. Cada comprador tendrá una cotización aceptada válida para el mismo producto y una clave de idempotencia diferente. Se prepararán los datos y se deshabilitarán vencimientos/cancelaciones durante la ventana controlada.

k6 programará una única creación por comprador con inicio común; se registrará la dispersión real de los envíos, porque programar 500 usuarios no garantiza que lleguen en el mismo instante. No se reutilizará una sola oferta aceptada para los 500 compradores. Los pagos, si se incluyen, serán simulados y aprobados.

**Aprobación:** 100 pedidos aceptados y 400 rechazos por falta de stock, stock disponible final 0, sin cantidades negativas, duplicados ni reservas huérfanas. Se contará por producto uniendo pedidos, pedido_items y reservas_stock; no bastará contar respuestas HTTP. Consumir una reserva pagada no debe descontar el stock por segunda vez.

En pruebas adicionales con Jest, PostgreSQL y un adaptador controlado se provocarán: fallo antes del commit, timeout de pago, respuesta definitiva rechazada y evento de pago duplicado. Se verificará respectivamente rollback completo, estado pendiente hasta reconciliación, liberación única y aplicación única del efecto. Cada caso incluirá su condición inicial, plazo de espera configurado, resultado esperado y consultas antes/después; los plazos de reconciliación se fijarán al implementar la política de reintentos.

## 5. Disponibilidad y recuperación — AC02

Se propone comprobar **cada minuto** autenticación, consulta de catálogo y lectura de cotizaciones/pedidos de prueba. Se verificará contenido válido además del estado HTTP. La accesibilidad de pagos se observará por separado, distinguiendo fallos propios y de la pasarela; crear pedidos y cobrar no formará parte de cada sonda periódica.

La disponibilidad se estimará como `intervalos disponibles / intervalos observados × 100`, con intervalos de igual duración y registro de períodos sin datos. El informe indicará cobertura, fallos del monitor y tratamiento de mantenimientos; un monitor sin datos no demostrará disponibilidad. Las sondas por minuto pueden no detectar interrupciones más breves.

**Meta:** 99.5% durante un mes completo de observación. Un seguimiento menor solo permite informar el valor de ese período, sin extrapolar cumplimiento mensual.

Para recuperación se introducirán registros de prueba con hora conocida, se simulará una interrupción y se restaurará una copia en un entorno aislado. Se medirá el tiempo desde la interrupción hasta recuperar las operaciones críticas (**RTO ≤ 4 h**) y la diferencia entre la hora de interrupción y la del último dato recuperado (**RPO ≤ 1 h**). Se guardarán registros del incidente, restauración y consultas de comprobación.

## 6. Seguridad, mantenibilidad e interoperabilidad — AC04, AC05 y AC09

| Atributo | Procedimiento propuesto | Criterio de aprobación |
|---|---|---|
| Seguridad | Ejecutar con Jest/HTTP una matriz de operaciones con sesión válida, ausente, expirada, rol incorrecto y usuario de otra empresa. Incluir acceso válido al pedido compartido entre comprador y proveedor. | Todos los casos de la matriz responden según el contrato y ninguno expone datos privados a usuarios no autorizados. El alcance se limita a los casos probados. |
| Mantenibilidad | Sustituir un adaptador por otro que cumpla el mismo contrato, revisar imports con ESLint y ejecutar regresión de Pedidos/Pagos. | Todas las pruebas acordadas pasan; no hay imports prohibidos en Dominio ni dependencias directas de implementaciones de infraestructura en los casos de uso. Registrar archivos modificados. |
| Interoperabilidad | Probar éxito, rechazo, timeout y duplicado con adaptadores controlados y, por separado, sandboxes disponibles. Registrar latencia y cambios persistidos. | Sin efectos duplicados; estados y errores correctos. Evaluar las metas de EQ-07, identificando proveedor, muestra y condiciones. Un sandbox no demuestra el comportamiento de producción. |

La recuperación de la recomendación se medirá simulando un timeout de 1 s y comprobando el fallback dentro de 500 ms adicionales. Las metas de latencia de proveedores externos son objetivos a evaluar, no garantías controladas por MayoristaPro. No se enviará carga masiva a sandboxes o servicios externos sin autorización del proveedor.

## 7. Auditabilidad y usabilidad — AC08 y AC10

**Auditabilidad:** preparar una lista de 20 operaciones auditables con actor, entidad y cambio esperados, incluyendo creación de pedido, cambio de estado y verificación de proveedor. Ejecutarlas y contrastarlas con `audit_log` y los registros de CloudWatch. Meta propuesta: **20 de 20 operaciones con trazabilidad completa**, sin contraseñas, tokens, credenciales ni datos de tarjeta; los reintentos se correlacionarán sin duplicar el efecto de negocio. Conservar una matriz operación → registro y consultas de verificación.

**Usabilidad:** realizar una evaluación formativa propuesta con **5 compradores y 3 proveedores representativos**, usando móvil y computadora. Cada participante realizará tres tareas correspondientes a su rol, sin ayuda del moderador:

| Rol | Tareas | Tiempo objetivo por tarea |
|---|---|---|
| Comprador | Buscar un producto, solicitar una cotización y consultar un pedido preparado. | ≤ 2 min, ≤ 4 min y ≤ 2 min, respectivamente. |
| Proveedor | Importar un lote CSV/XLSX de 10 productos válidos mediante vista previa y confirmación, responder una cotización y registrar un despacho permitido. | ≤ 6 min, ≤ 4 min y ≤ 2 min, respectivamente. |

Se añadirá un caso de importación con un SKU duplicado y una cantidad inválida: el proveedor debe localizar los errores, corregirlos y confirmar sin efectos parciales ni duplicados. La integridad del lote se verificará con pruebas de API y SQL. La edición individual se evaluará como mantenimiento, sin sustituir la importación.

Son **umbrales iniciales propuestos para validar con la docente**, no resultados ni una muestra estadísticamente representativa. Se alternará el dispositivo inicial y se usarán datos equivalentes para reducir el aprendizaje entre intentos. Para cada tarea, rol y dispositivo se informará el número exacto de participantes que la completó sin ayuda, el tiempo individual, errores y observaciones.

Meta formativa: al menos 4 de 5 compradores y los 3 proveedores completan cada tarea de su rol sin ayuda, dentro del tiempo objetivo y sin errores críticos que impidan terminar o produzcan una operación incorrecta. Los incumplimientos originarán ajustes de interfaz y una nueva evaluación documentada; no se afirmará usabilidad general por este único estudio.

## 8. Registro y cierre de cada medición

| Campo del informe | Contenido obligatorio |
|---|---|
| Identificación | ID de prueba, atributo/escenario, fecha, responsable y commit. |
| Entorno | URL, configuración de recursos, datos iniciales, herramientas y simulaciones empleadas. |
| Procedimiento | Script/casos, operaciones, usuarios, pausas, duración y condiciones de fallo. |
| Meta | Criterio establecido antes de ejecutar. |
| Resultado | Métricas reales, muestra, respuestas y estados finales comprobados. Mientras no se ejecute: **pendiente**. |
| Evidencia | Resúmenes, series exportadas, logs, consultas SQL y fichas; capturas solo como apoyo. |
| Dictamen | Cumple, no cumple o inconcluso; limitaciones y ajustes a realizar. |

Las evidencias se organizarán por identificador de ejecución cuando existan. Un script preparado, una captura de CloudWatch o la elección de una herramienta por sí solos no prueban el cumplimiento de un atributo.

## Referencias de herramientas

- [Grafana k6: umbrales de aprobación](https://grafana.com/docs/k6/latest/using-k6/thresholds/).
- [Grafana k6: carga gradual con usuarios virtuales](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/).
- [AWS: métricas y registros con el agente de CloudWatch](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Install-CloudWatch-Agent.html).
