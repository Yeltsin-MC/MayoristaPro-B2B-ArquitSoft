# SDD — Caché Redis del catálogo público

Rama `sprint-2/redis-catalogo`, desde `main` actualizado en `9c9f463`. La actualización previa del contexto se conserva en el commit documental separado `2c8458c`. Este incremento implementa ADR-003 y mantiene PostgreSQL como autoridad transaccional.

## Lecturas, claves y límites

Se cachean las proyecciones de `GET /api/v1/products` y `GET /api/v1/products/options`. La caché se conecta mediante el puerto de lectura existente del catálogo. Las rutas privadas utilizan sus servicios actuales.

Las claves tienen la forma `mayoristapro:catalog:v1:<base>:<revisión>:<ruta>:<hash>`. `base` identifica servidor, base, usuario y opciones de esquema mediante SHA-256, excluyendo la contraseña. La revisión se lee de PostgreSQL y se comprueba que pertenece al mismo esquema que los productos. El hash utiliza una tupla canónica con página, límite, búsqueda recortada, categoría, UUID del proveedor normalizado, disponibilidad y orden. Las opciones tienen su propia clave. Se conservan los límites y la respuesta actuales del controlador, incluido `Cache-Control: no-store` para el cliente HTTP.

Configuración propuesta para la demo mediante variables de entorno

- `REDIS_URL` activa el adaptador Redis. Su ausencia permite las lecturas PostgreSQL habituales.
- `CATALOG_CACHE_TTL_SECONDS` vale 30 por defecto. Admite enteros de 1 a 86400.
- `CATALOG_CACHE_TIMEOUT_MS` vale 100 por defecto. Admite enteros de 10 a 1000. Limita conexiones y comandos.
- Redis usa RESP2, cola offline desactivada y reconexión de fondo. El deadline propio cubre también la respuesta del servidor y cierra una conexión que exceda el límite. La reconexión posterior espera un segundo. Una conexión indisponible, error, timeout o JSON inválido provoca lectura PostgreSQL. La cola de comandos tiene un límite finito.

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
| RC02 | Claves distintas por búsqueda, filtros, orden, paginación, ruta y esquema | Pruebas focalizadas de aplicación y Redis en `tests/catalog-cache.test.cjs` y `tests/catalog-cache.integration.cjs`. |
| RC03 | Publicación, importación y visibilidad invalidan tras commit | Integración de rutas existentes con PostgreSQL y Redis. |
| RC04 | Reserva, devolución y vencimiento de stock invalidan | Integración con pedido T4 y worker T5. |
| RC05 | Rollback conserva caché válida; lecturas simultáneas no rellenan la revisión vigente con datos anteriores | Barreras deterministas en `tests/catalog-cache.test.cjs` y transacciones reales en `tests/catalog-revision.integration.cjs`. |
| RC06 | Redis caído o lento mantiene lectura PostgreSQL con espera acotada | Adaptador real, puerto cerrado y respuesta retrasada controlada. |
| RC07 | El contenido privado sigue fuera de Redis | Inspección de claves y payloads del namespace de prueba tras operaciones privadas. |
| RC08 | Medición reproducible fría y caliente con mismos datos y consulta | `tests/catalog-cache.benchmark.cjs`, JSON con configuración, versión, muestras, p50/p95/media y consultas de datos/revisión. |
| RC09 | Compilación y regresión completa en CI con Redis de prueba | PR y GitHub Actions con PostgreSQL, Redis y FastAPI. |

## Verificación y medición

Este equipo Windows carece de Redis, Docker y WSL instalados. La verificación local completó la compilación NestJS, seis pruebas de claves/concurrencia/deadline y cinco resultados focalizados PostgreSQL de commit, rollback, concurrencia, esquema y fallback con puerto Redis cerrado. El servidor RESP controlado de la prueba de timeout verifica el límite de respuesta del adaptador.

El CI del PR #5, ejecución `43324942818`, aprobó Angular y NestJS, las migraciones, 94 resultados de integración, 7 unitarias Node, 11 Python y 9 de navegador, con cero fallidos y cero omitidos. Probó la cabeza de implementación `ea8dee8fa62e42e2218ad2ec4c9648ef88d65391` contra la base de `main`. Incluye Redis real y FastAPI real. La fusión del PR a `main` queda pendiente de revisión. [PR #5](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/5) · [CI con Redis](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/actions/runs/43324942818)

### Medición obtenida en CI

Node 24.22.2, PostgreSQL 17.12 y Redis 7.4.12. Cada fase tiene 30 muestras secuenciales de la misma consulta sobre 1.000 productos sintéticos y devuelve 100 productos. Se verificó la igualdad exacta de sus respuestas durante todas las fases. Se realizaron cinco lecturas iniciales de preparación antes de medir. Para provocar cada miss frío se elimina únicamente la clave de esa consulta del namespace aislado, fuera del intervalo medido.

| Fase | Media ms | p50 ms | p95 ms | Consultas de datos | Consultas de revisión | Hits |
|---|---|---|---|---|---|---|
| PostgreSQL directo | 2,411 | 2,264 | 2,697 | 30 | 0 | 0 |
| Redis frío | 3,491 | 3,228 | 4,231 | 30 | 60 | 0 |
| Redis caliente | 0,701 | 0,704 | 0,880 | 0 | 60 | 30 |

La caché fría añade el trabajo de consulta y relleno de Redis. La lectura caliente conserva dos comprobaciones pequeñas de revisión PostgreSQL por petición y evita repetir las consultas de datos del catálogo. Estas cifras corresponden a llamadas de aplicación dentro del runner y excluyen HTTP y concurrencia. La medición es una evidencia separada del ensayo pendiente de k6 con al menos 2.000 usuarios virtuales concurrentes. [JSON original de la medición](evidencias/redis-catalogo/medicion.json)

### Reproducir en PowerShell

Desde la raíz de MayoristaPro-Kiro, con PostgreSQL y una instancia Redis de prueba disponibles

```powershell
npm ci
npm run build -w @mayoristapro/api
$env:REDIS_URL = 'redis://127.0.0.1:6379'
$env:CATALOG_CACHE_TTL_SECONDS = '30'
$env:CATALOG_CACHE_TIMEOUT_MS = '100'
node --env-file=.env --test tests/catalog-cache.test.cjs tests/catalog-revision.integration.cjs tests/catalog-cache.integration.cjs
node --env-file=.env tests/catalog-cache.benchmark.cjs
```

La medición escribe `docs/evidencias/redis-catalogo/medicion.json`. Crea y elimina un esquema sintético temporal y elimina únicamente sus claves de Redis. Para habilitar la caché en la demo se aplica antes `npm run db:migrate` y se configura `REDIS_URL` al arrancar la API. La ausencia de Redis permite continuar consultando PostgreSQL. El CI ejecuta el mismo benchmark con el servicio Redis del job y conserva el JSON como artefacto `evidencia-demo`.

### Alcance de la invalidación

Los puntos de escritura de identidad, importación, pedidos y el worker de vencimientos mantienen su lógica de negocio. La migración observa las escrituras efectivas de sus tablas públicas y avanza la revisión al confirmar la transacción. Los fixtures anteriores de T2/T3 incorporan la migración 007 para comprobar también sus rutas con caché. Un esquema previo a esa migración utiliza fallback PostgreSQL y evita tomar la revisión de otro esquema de su search_path.

La invalidación lógica evita depender de que Redis reciba un DEL después del commit. Si Redis falla durante una escritura, la revisión confirmada sigue avanzando en PostgreSQL. Al volver a estar disponible, las lecturas eligen las claves de la revisión vigente y las entradas antiguas caducan por TTL.
