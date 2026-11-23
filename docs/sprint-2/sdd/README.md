# Especificaciones SDD de MayoristaPro

Cada módulo sigue el formato de desarrollo guiado por especificaciones (SDD) en tres archivos:

- **`requirements.md`:** qué debe hacer el sistema (historias de usuario y criterios de aceptación en formato EARS).
- **`design.md`:** cómo se resolvió (arquitectura, interfaces, modelo de datos, decisiones, errores y pruebas).
- **`tasks.md`:** plan de implementación con casillas, cada tarea enlazada a sus requisitos.

| # | Módulo | Requisitos | Diseño | Tareas |
|---|---|---|---|---|
| 01 | Catálogo público, filtros, precios por volumen y caché | [requirements](01-catalogo/requirements.md) | [design](01-catalogo/design.md) | [tasks](01-catalogo/tasks.md) |
| 02 | Identidad, empresas y permisos | [requirements](02-identidad/requirements.md) | [design](02-identidad/design.md) | [tasks](02-identidad/tasks.md) |
| 03 | Carga masiva CSV/Excel | [requirements](03-carga-masiva/requirements.md) | [design](03-carga-masiva/design.md) | [tasks](03-carga-masiva/tasks.md) |
| 04 | Cotizaciones, pedidos, pago y despacho | [requirements](04-cotizaciones-pedidos/requirements.md) | [design](04-cotizaciones-pedidos/design.md) | [tasks](04-cotizaciones-pedidos/tasks.md) |
| 05 | Moderación del administrador | [requirements](05-moderacion/requirements.md) | [design](05-moderacion/design.md) | [tasks](05-moderacion/tasks.md) |
| 06 | Avisos y «Volver a pedir» | [requirements](06-avisos-volver-a-pedir/requirements.md) | [design](06-avisos-volver-a-pedir/design.md) | [tasks](06-avisos-volver-a-pedir/tasks.md) |
| 07 | Fotos reales y ficha del producto | [requirements](07-fotos-ficha/requirements.md) | [design](07-fotos-ficha/design.md) | [tasks](07-fotos-ficha/tasks.md) |
| 08 | Mis productos y asistente de carga | [requirements](08-mis-productos/requirements.md) | [design](08-mis-productos/design.md) | [tasks](08-mis-productos/tasks.md) |

Los documentos técnicos detallados de cada entrega (por ejemplo, [carga-masiva.md](../carga-masiva.md)) se conservan como respaldo. Las tareas sin marcar son trabajo pendiente.
