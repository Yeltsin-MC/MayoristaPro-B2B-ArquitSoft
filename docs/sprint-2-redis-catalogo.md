# SDD — Caché Redis del catálogo público

Rama `sprint-2/redis-catalogo`, desde `main` actualizado en `9c9f463`. La actualización previa del contexto se conserva en el commit documental separado `2c8458c`. Este incremento implementa ADR-003 y mantiene PostgreSQL como autoridad transaccional.

## Lecturas, claves y límites

Se cachean las proyecciones de `GET /api/v1/products` y `GET /api/v1/products/options`. La caché se conecta mediante el puerto de lectura existente del catálogo. Las rutas privadas utilizan sus servicios actuales.

Las claves tienen la forma `mayoristapro:catalog:v1:<base>:<revisión>:<ruta>:<hash>`. `base` identifica servidor, base, usuario y opciones de esquema mediante SHA-256, excluyendo la contraseña. La revisión se lee de PostgreSQL. El hash utiliza una tupla canónica con página, límite, búsqueda recortada, categoría, UUID del proveedor normalizado, disponibilidad y orden. Las opciones tienen su propia clave. Se conservan los límites y la respuesta actuales del controlador, incluido `Cache-Control: no-store` para el cliente HTTP.

Configuración propuesta para la demo mediante variables de entorno

- `REDIS_URL` activa el adaptador Redis. Su ausencia permite las lecturas PostgreSQL habituales.
- `CATALOG_CACHE_TTL_SECONDS` vale 30 por defecto. Admite enteros de 1 a 86400.
- `CATALOG_CACHE_TIMEOUT_MS` vale 100 por defecto. Admite enteros de 10 a 1000. Limita conexiones y comandos.
- Redis tiene cola offline desactivada y reconexión de fondo. Una conexión indisponible, error, timeout o JSON inválido provoca lectura PostgreSQL. La cola de comandos tiene un límite finito.

## Invalidación y concurrencia

La migración `007_catalog_cache.sql` incorpora una revisión durable por esquema. Los cambios de `products`, `suppliers` y `companies` programan triggers de restricción diferidos hasta el commit. La revisión aumenta una vez por transacción y se publica atómicamente con sus datos. Un rollback conserva la revisión anterior. La ejecución diferida evita tomar el bloqueo del contador antes de terminar los bloqueos de negocio.

Esto reutiliza los puntos de escritura actuales, incluidas publicación, importación, verificación o visibilidad del proveedor, habilitación de empresa, descuento al reservar y devolución de existencias desde el worker de vencimientos. Los cambios de estados de pago que conservan stock mantienen la proyección del catálogo. La invalidación se deriva de la escritura efectiva de la proyección pública.

Después del commit las lecturas seleccionan una revisión nueva. Las entradas de revisiones anteriores caducan por TTL. Una lectura que comenzó antes de un commit utiliza su clave anterior y comprueba nuevamente la revisión antes de poblarla. En un hit también comprueba la revisión antes de devolverlo. Una operación concurrente puede observar el estado anterior durante su intervalo de ejecución, y ese resultado queda asociado a su revisión anterior.

La invalidación lógica se confirma en PostgreSQL, por lo que una caída de Redis durante la escritura conserva el cambio de revisión. Tras recuperarse, Redis recibe claves de la revisión vigente y sus entradas anteriores resultan inaccesibles para las nuevas lecturas. Las escrituras transaccionales consultan PostgreSQL y mantienen su autorización y validación de stock.

Cada hit realiza dos consultas pequeñas de revisión. La reducción que se mide corresponde a consultas de datos del catálogo. Se registran también latencias para evaluar el costo de esa garantía de coherencia.

## Criterios y pruebas

| ID | Criterio | Evidencia prevista |
|---|---|---|
| RC01 | Miss carga PostgreSQL y hit reutiliza Redis durante el TTL | `tests/catalog-cache.integration.cjs`, contadores de consulta y TTL real. |
| RC02 | Claves distintas por búsqueda, filtros, orden, paginación, ruta y esquema | Pruebas focalizadas de aplicación y Redis. |
| RC03 | Publicación, importación y visibilidad invalidan tras commit | Integración de rutas existentes con PostgreSQL y Redis. |
| RC04 | Reserva, devolución y vencimiento de stock invalidan | Integración con pedido T4 y worker T5. |
| RC05 | Rollback conserva caché válida; lecturas simultáneas no rellenan la revisión vigente con datos anteriores | Barreras deterministas en el lector y transacciones PostgreSQL. |
| RC06 | Redis caído o lento mantiene lectura PostgreSQL con espera acotada | Adaptador real, puerto cerrado y respuesta retrasada controlada. |
| RC07 | El contenido privado sigue fuera de Redis | Inspección de claves y payloads del namespace de prueba tras operaciones privadas. |
| RC08 | Medición reproducible fría y caliente con mismos datos y consulta | `tests/catalog-cache.benchmark.cjs`, JSON con configuración, versión, muestras, p50/p95/media y consultas de datos/revisión. |
| RC09 | Compilación y regresión completa en CI con Redis de prueba | PR y GitHub Actions con PostgreSQL, Redis y FastAPI. |

## Verificación y medición

Los resultados reales se registrarán al completar el incremento. Este equipo Windows carece de Redis, Docker y WSL instalados. Se ejecutarán localmente la compilación y las pruebas focalizadas disponibles. Redis real y la medición se ejecutarán en GitHub Actions con un servicio Redis dedicado al job.

La medición de caché utiliza llamadas de aplicación secuenciales, una consulta fija y un esquema sintético aislado. Es una evidencia separada del ensayo pendiente de k6 con al menos 2.000 usuarios virtuales concurrentes.
