# T3 — Carga masiva del catálogo mayorista

Incremento desde `main` (`8c2e5b4`), rama `sprint-2/carga-masiva-catalogo`. Especificación, plan y aceptación del recorrido Angular → NestJS → PostgreSQL. T2 conserva la identidad y el catálogo sigue siendo público.

## Comportamiento

1. Un usuario con permiso `publish`, vinculación activa y proveedor verificado descarga la plantilla CSV o XLSX. Completa hasta 500 filas y 5 MiB (5 × 1024 × 1024 bytes).
2. Carga el archivo. El servidor valida datos y muestra una vista previa con número de fila, columna, errores, altas, actualizaciones y stock que se conserva. Todavía no modifica productos.
3. Revisa todas las filas y confirma el lote válido antes de 30 minutos. El servidor vuelve a comprobar autorización, propiedad, vigencia y revisiones de los SKU. Aplica el lote completo en una transacción y registra al responsable.
4. Obtiene resultado y reporte CSV descargable. Repetir la confirmación devuelve el mismo resultado. Angular recarga el catálogo tras confirmar; los productos publicados son públicos y los borradores permanecen ocultos. La paginación permite recorrer catálogos de más de 20 productos.

La unicidad es `(supplier_id, sku)`, con SKU sensible a mayúsculas. El mismo SKU puede existir en empresas distintas. No se toma el proveedor del archivo o del cuerpo: se obtiene de la sesión y la vinculación vigente.

## Plantilla y validaciones

Todas las columnas son obligatorias. Se admite cualquier orden, sin columnas desconocidas ni repetidas. CSV debe ser UTF-8, separado por comas; se admiten BOM, campos entre comillas y saltos CRLF. XLSX debe tener una sola hoja con encabezado en fila 1. Las filas vacías no crean productos. Los números de fila de la vista previa corresponden al registro CSV o a la fila Excel, contando el encabezado.

| Columna | Regla |
|---|---|
| `sku` | 1–64 caracteres: letra o número inicial, seguidos de letras, números, punto, guion o guion bajo. Se rechazan todas las filas de un SKU duplicado en el archivo. |
| `nombre` | Texto literal obligatorio, hasta 200 caracteres. |
| `categoria` | Texto literal obligatorio, hasta 120 caracteres. |
| `presentacion` | `unidad`, `paquete`, `docena`, `caja` o `saco`, para artículos contables. Se normaliza a minúsculas. |
| `unidades_por_presentacion` | Entero positivo; una docena tiene 12 unidades. |
| `precio` | Precio positivo por presentación, hasta 10 dígitos enteros y 2 decimales. Punto decimal, sin separadores de millares. Más decimales se rechazan, no se redondean. |
| `moneda` | `PEN`. |
| `incluye_igv` | `true` o `false`. Se informa el tratamiento declarado; no se calculan impuestos. |
| `minimo` | Entero positivo, múltiplo del incremento. |
| `multiplo` | Entero positivo. |
| `stock` | Entero no negativo en presentaciones. Solo establece stock de un producto nuevo; en productos existentes se valida el dato y se conserva el stock vigente en PostgreSQL. |
| `publicado` | `true` o `false`. Publicar inicialmente exige stock suficiente para al menos un mínimo. Una publicación existente cuyo stock caiga bajo el mínimo se conserva y se muestra sin disponibilidad. |

Los enteros se limitan al rango PostgreSQL de 32 bits. No se admiten fórmulas Excel, celdas de fecha, objetos de hipervínculo ni macros; tampoco expresiones que comiencen con `=`, `+`, `-` o `@` en nombre/categoría. No se ejecutan fórmulas ni se descargan enlaces. El reporte CSV escapa campos que podrían interpretarse como fórmulas al abrirlos en una hoja de cálculo. Para acotar XLSX se comprueba además el tamaño real descomprimido: máximo 20 MiB y 100 entradas ZIP.

Cambiar presentación o equivalencia de un SKU existente se rechaza: conservar el mismo número de cajas con un contenido diferente alteraría el significado del inventario. Requiere definir el ajuste autorizado y su coordinación con reservas. Los cambios de metadatos por importación nunca reemplazan ni suman existencias.

## Transacciones y concurrencia

La migración `003_catalog_imports.sql` agrega categoría, revisión de metadatos y lotes persistidos con filas normalizadas, errores, huella, responsable, vencimiento, clave de confirmación y resultado. Las operaciones de vista previa y aplicación se registran en auditoría.

Un trigger incrementa la revisión al cambiar SKU, proveedor, nombre, categoría, presentación, equivalencia, mínimo, múltiplo, precio, moneda, IGV o publicación. Restaurar luego el valor original no recupera la revisión anterior. Los movimientos exclusivamente de stock no incrementan esta revisión: al confirmar se preservan las existencias vigentes y se revalida su suficiencia cuando se trata de una publicación inicial.

La confirmación bloquea el lote y, por un intervalo acotado, las escrituras sobre `products` (`SHARE ROW EXCLUSIVE`, espera máxima de 5 segundos). Después compara identificador y revisión de cada SKU, incluyendo la ausencia esperada de productos nuevos. Esto detecta inserciones, eliminaciones y cambios concurrentes de SKU aun desde SQL o mantenimiento. Lecturas públicas continúan. Se valida todo antes de escribir; productos, estado aplicado, resultado y auditoría se confirman o revierten juntos.

Un conflicto deja el lote `stale` y devuelve 409; el proveedor debe cargar y revisar una nueva vista previa. Este bloqueo global es una limitación deliberada para lotes síncronos de hasta 500 filas: futuras mediciones pueden justificar coordinación más granular. No se implementan reservas ni ajustes de inventario de tareas posteriores.

Cada lote se aplica una sola vez. Se exige `Idempotency-Key` de 1–128 caracteres alfanuméricos, punto, guion o guion bajo y `previewHash`. La clave se delimita por proveedor, operación y lote; la huella evita confirmar una vista previa distinta. Reintentar un lote aplicado, incluso con otra clave, devuelve su resultado sin repetir escrituras, después de volver a autorizar al usuario. Una huella distinta devuelve 409.

Actualmente el catálogo consulta PostgreSQL sin caché de servidor. La API indica `Cache-Control: no-store` y Angular recarga su lista tras aplicar un lote, evitando resultados HTTP anteriores. Redis, hit/miss, invalidación distribuida y prueba de caída siguen pendientes del criterio de caché de la entrega; no se afirma que estén implementados.

## API implementada

Base `/api/v1`. Las rutas de lote requieren Bearer de T2 y proveedor verificado con permiso `publish`, incluso para consultar o reintentar.

| Ruta | Entrada / salida |
|---|---|
| `GET /products/imports/template?format=csv` | Plantilla CSV descargable; pública, sin información privada. |
| `GET /products/imports/template?format=xlsx` | Plantilla XLSX descargable. |
| `POST /products/imports/preview` | `multipart/form-data`, un archivo en campo `file`, sin campos adicionales. 201 con `{id,status,previewHash,expiresAt,rows,summary,result}`. Una fila inválida conserva el lote con estado `invalid`; el archivo ilegible o la estructura incorrecta devuelve 400. |
| `GET /products/imports/:id` | Estado y reporte del lote propio. No expone contenido de otras empresas; un lote ajeno o inexistente devuelve 404. |
| `POST /products/imports/:id/confirm` | Cabecera `Idempotency-Key`, JSON `{ "previewHash": "huella de la vista previa" }`. 201 con lote aplicado y resultado `{created,updated,productIds}`. |

Estados: `preview`, `invalid`, `stale`, `applied`. Otros errores: 401 sin sesión válida; 403 proveedor pendiente, permiso insuficiente o acceso revocado; 413 archivo superior al límite; 422 lote con filas inválidas; 409 huella distinta, vencimiento o cambios concurrentes. Un error de almacenamiento revierte el lote completo.

## Plan ejecutado

- Migración aditiva y revisión de productos; conservación de seed y datos existentes.
- Lectura CSV/XLSX acotada, validación por fila, vista previa persistida y confirmación atómica/idempotente.
- Plantillas descargables, carga, tabla de errores, confirmación, reporte y recarga de catálogo en Angular.
- Pruebas HTTP con PostgreSQL real, regresión T1/T2 y documentación de alcance y pendientes.

## Ejecutar y revisar

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run build
npm run test:integration
```

Detén antes los servidores de desarrollo al reinstalar dependencias en Windows. PostgreSQL debe estar disponible y `.env` configurado como en [T1](sprint-2-base-catalogo.md). Las pruebas T2/T3 crean y eliminan esquemas aislados, por lo que la cuenta de pruebas necesita ese permiso. No se borran empresas de desarrollo.

Inicia `npm run dev:api` y `npm run dev:web` en terminales separadas. Sigue [T2](sprint-2-identidad.md) para registrar una empresa ficticia, aprobar su vinculación y verificar por separado al proveedor. Ingresa como responsable, abre la carga masiva, descarga la plantilla y revisa un lote. Introduce un precio inválido para ver el error por fila y la confirmación bloqueada. Corrige el archivo, vuelve a cargarlo y confirma: los productos con `publicado=true` aparecen en el catálogo. Reimporta el mismo SKU con otro nombre y stock diferente: se actualiza el nombre, manteniendo existencias.

## Aceptación automatizada

`tests/imports.integration.cjs` arranca NestJS y envía archivos multipart por HTTP a un esquema PostgreSQL temporal. Cubre:

- Vista previa sin escrituras, confirmación, borradores ocultos y publicaciones visibles en catálogo con categoría/disponibilidad.
- Confirmación repetida y concurrente sin duplicar productos ni auditoría; clave requerida y huella distinta rechazada.
- Actualización sin reemplazar stock, incluso tras un movimiento posterior a la vista previa.
- Proveedor pendiente, ajeno, usuario sin permiso y sesión ausente bloqueados; mismo SKU en dos proveedores permitido.
- Errores de precio, duplicados, mínimo/múltiplo, presentación, equivalencia, moneda, IGV y stock; cero cambios parciales.
- Cambio de SKU y de metadatos, incluso restaurando el valor; dos lotes simultáneos para un SKU nuevo.
- XLSX real, fórmulas, archivo corrupto, extensión no permitida y ambas plantillas.
- Límites de tamaño y filas; aplicación real de 500 productos.
- Vencimiento, revocación y pérdida de verificación después de la vista previa.
- Fallo SQL inyectado después de la primera escritura: rollback de productos, lote y auditoría; reintento posterior correcto.

## Reglas y evidencias pendientes

D4 sigue abierta para transporte, impuestos, redondeo y rangos sin precio de las ofertas/cotizaciones. T3 importa únicamente el precio publicado por presentación, PEN e indicador de IGV; no calcula totales comerciales ni inventa rangos de volumen. Envío se cotiza aparte. Venta por peso/volumen y excepciones por categoría siguen por definir: no se habilitan mediante esta plantilla. No se exige una cantidad mínima universal de unidades base ni de SKU distintos; mínimo y múltiplo son los declarados por oferta.

500 filas/5 MiB se usan como límites operativos iniciales de la propuesta y se prueban funcionalmente, sin afirmar capacidad de carga general. Imágenes, importación asíncrona y movimientos autorizados de inventario siguen pendientes de su contrato. El criterio Redis y las pruebas de carga pertenecen a evidencia posterior.

Verificación local del 10/11/2026: migración aplicada y compilación Angular/NestJS correcta. La batería T1–T3 pasó 19 pruebas con PostgreSQL real. La revisión visual quedó bloqueada porque el servicio de navegador no estaba disponible y el navegador local no devolvió estado accesible; no se afirma una prueba E2E de navegador. El recorrido de archivos, vista previa, confirmación y catálogo sí se verificó automáticamente por HTTP.
