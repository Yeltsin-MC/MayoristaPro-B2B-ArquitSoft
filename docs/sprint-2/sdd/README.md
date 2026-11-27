# Especificaciones SDD de MayoristaPro

MayoristaPro se desarrolló con **Spec-Driven Development (SDD)**: antes de programar cada módulo se escribió qué debía hacer, cómo se iba a resolver y en qué tareas se dividía. Cada carpeta de módulo tiene tres archivos:

| Archivo | Pregunta que responde | Contenido |
| ------- | --------------------- | --------- |
| `requirements.md` | ¿Qué debe hacer? | Contexto, objetivo, actores, glosario, requisitos funcionales (RF) con endpoint, acceso, validaciones y criterios de aceptación en formato **EARS** (CUANDO / SI / EL sistema DEBERÁ), requisitos no funcionales (RNF), criterios de aceptación del módulo, diagrama de flujo o de estados y trazabilidad |
| `design.md` | ¿Cómo se resolvió? | Arquitectura del módulo (diagrama de capas y Mermaid), diseño de funciones y consultas, modelo de datos, decisiones de diseño con su justificación, manejo de errores (HTTP y mensaje) y estrategia de pruebas |
| `tasks.md` | ¿En qué pasos se construyó? | Resumen de fases, tareas numeradas con archivo, descripción, casos validados y requisitos que cubren, tablas de pruebas (unitarias, integración, navegador y Postman), tareas pendientes y diagrama de trazabilidad completa |

Cada documento empieza con una tabla de metadatos (proyecto, módulo, sprint, estado y curso). Los identificadores conectan los tres archivos: un `RF-CAT-03` de `requirements.md` aparece en la tabla de trazabilidad de `design.md` y en las tareas de `tasks.md` que lo implementan.

## Módulos

| # | Módulo | Prefijo | Requisitos | Diseño | Tareas |
| -- | ------ | ------- | ---------- | ------ | ------ |
| 01 | Catálogo público, filtros, precios por volumen y caché | CAT | [requirements](01-catalogo/requirements.md) | [design](01-catalogo/design.md) | [tasks](01-catalogo/tasks.md) |
| 02 | Identidad, empresas y permisos | IDE | [requirements](02-identidad/requirements.md) | [design](02-identidad/design.md) | [tasks](02-identidad/tasks.md) |
| 03 | Carga masiva CSV/Excel | IMP | [requirements](03-carga-masiva/requirements.md) | [design](03-carga-masiva/design.md) | [tasks](03-carga-masiva/tasks.md) |
| 04 | Cotizaciones, pedidos, pago y despacho | COT / PED | [requirements](04-cotizaciones-pedidos/requirements.md) | [design](04-cotizaciones-pedidos/design.md) | [tasks](04-cotizaciones-pedidos/tasks.md) |
| 05 | Moderación del administrador | MOD | [requirements](05-moderacion/requirements.md) | [design](05-moderacion/design.md) | [tasks](05-moderacion/tasks.md) |
| 06 | Avisos y «Volver a pedir» | AVI | [requirements](06-avisos-volver-a-pedir/requirements.md) | [design](06-avisos-volver-a-pedir/design.md) | [tasks](06-avisos-volver-a-pedir/tasks.md) |
| 07 | Fotos reales y ficha del producto | FOT | [requirements](07-fotos-ficha/requirements.md) | [design](07-fotos-ficha/design.md) | [tasks](07-fotos-ficha/tasks.md) |
| 08 | Mis productos y asistente de carga | MIS | [requirements](08-mis-productos/requirements.md) | [design](08-mis-productos/design.md) | [tasks](08-mis-productos/tasks.md) |

## Convenciones

- **Prefijos de pruebas:** `PU` unitaria (Jest), `PI` integración con PostgreSQL y Redis, `PN` navegador (Playwright), `PT` Postman, `PC` contrato OpenAPI.
- **Estados:** ✓ completado, ○ pendiente. Las casillas sin marcar son trabajo pendiente.
- Los análisis transversales están fuera de estas carpetas: [caché Redis](../redis-catalogo.md), [SOLID y patrones](../solid-y-patrones.md), [pruebas de carga k6](../pruebas-carga-k6.md) y [evidencias de calidad](../evidencias-calidad.md).
