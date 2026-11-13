# Experiencia del catálogo B2B

Base `062cc0b`, rama `sprint-2/experiencia-catalogo-b2b`. Se reutilizan Angular, la consulta paginada PostgreSQL, permisos T2 y solicitudes privadas T4. Redis y Compose conservan la evidencia de la integración #5 y #6.

## Flujo y reglas

Portada → categoría disponible → resultados filtrados en servidor → detalle del producto → solicitar cotización → ingreso del comprador conservando la selección → solicitud con presentación, cantidad mínima y proveedor preseleccionados. La cabecera permite buscar y acceder a la cuenta y las cotizaciones. El catálogo público muestra precios por presentación y las condiciones comerciales. Las ofertas privadas conservan cantidad, envío, total, plazo y vigencia.

Las categorías se obtienen de `/products/options`, independientemente de la página visible. Se priorizan los rubros de oficina y tecnología cuando existen. Cada acceso contiene únicamente imagen referencial y nombre. Cada cambio de filtro reinicia la paginación. No se calculan descuentos ni promociones sin datos. El detalle usa un diálogo accesible con cierre por botón o Escape. Las imágenes generadas ilustran familias de productos, sin atribuirlas a productos exactos.

Los datos de exposición se entregan como CSV identificado demo y se cargan mediante T3 con un proveedor verificado y permiso publish. La comprobación usa empresas y productos sintéticos en un esquema PostgreSQL aislado. No se agregan permisos ni equivalencias comerciales por inferencia.

## Aceptación

| ID | Criterio | Prueba o comprobación |
|---|---|---|
| EC01 | Cabecera con búsqueda funcional y accesos utilizables en escritorio y móvil | experiencia-catalogo.browser.cjs, búsqueda HTTP y geometría de controles |
| EC02 | Banner fotográfico, categorías cercanas al inicio y accesos solo con imagen y nombre | Capturas 1440 y 390 px y estructura de los accesos |
| EC03 | Categorías y búsqueda abarcan el catálogo completo, incluida una coincidencia fuera de la primera página | Fixture con más de 12 productos cargados mediante T3, filtros de servidor y página reiniciada |
| EC04 | Tarjetas y detalle muestran proveedor, presentación, mínimo, múltiplo, precio PEN y disponibilidad | Comprobación DOM y capturas de tarjetas |
| EC05 | Producto y proveedor llegan a una solicitud real tras ingresar con permiso buy | Navegador hasta POST /quotations y lectura autorizada en PostgreSQL/API |
| EC06 | Comparación conserva total con envío, cantidad, plazo y vigencia y privacidad T4 | Regresión demo-ux.browser.cjs y quotations.browser.cjs en CI |
| EC07 | Sin desbordamiento ni controles superpuestos, foco y cierre de diálogo por Escape | Pasada focalizada en 1440, 390 y 320 px |
| EC08 | Compilación y regresión completas aprobadas | GitHub Actions del PR |

## Publicación de este incremento

En el host de demo autorizado, desde el checkout MayoristaPro-Kiro, elegir el commit revisado de esta rama o el main que lo incorpore. Conservar el archivo privado `.env.demo`, el volumen de datos y PUBLIC_BASE_URL del enlace HTTPS. En PowerShell con Docker Compose y Node disponibles, ejecutar los siguientes comandos en orden.

```powershell
git fetch origin
git switch sprint-2/experiencia-catalogo-b2b
git pull --ff-only origin sprint-2/experiencia-catalogo-b2b
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml --profile cache config --quiet
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml --profile cache up -d --build
$env:DEMO_URL = 'http://127.0.0.1:8080'
node tests/deployment.smoke.cjs
```

Para un host Linux de AWS, mediante SSH en Bash con Docker Compose ya instalado, ejecutar desde el mismo checkout los siguientes comandos. El archivo privado `.env.demo` debe existir antes del arranque, con POSTGRES_PASSWORD y PUBLIC_BASE_URL completos.

```bash
git fetch origin
git switch sprint-2/experiencia-catalogo-b2b
git pull --ff-only origin sprint-2/experiencia-catalogo-b2b
git log -1 --oneline
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml --profile cache config --quiet
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml --profile cache up -d --build
curl --fail 'http://127.0.0.1:8080/api/v1/products?limit=1'
curl --fail 'http://127.0.0.1:8080/api/v1/ai/health'
```

Esperar catálogo con items y salud FastAPI `status=ok`. El volumen PostgreSQL conserva los datos y el migrador aplica únicamente lo pendiente. Usar `WEB_PORT` de `.env.demo` en los curl si se configuró otro puerto. Mantener el ingreso HTTPS apuntando al puerto local de Nginx y abrir el enlace público para comprobar una categoría, el detalle y una solicitud demo. Estos pasos preparan la publicación sobre un host autorizado existente.

En `.env.demo`, REDIS_URL debe ser `redis://redis:6379` para usar la caché. El migrador y los healthchecks existentes determinan el orden. Abrir el enlace HTTPS y comprobar la portada y una solicitud con una cuenta demo. Para exponer las familias de ejemplo, importar `docs/datos-demo/catalogo-exposicion.csv` mediante Carga masiva, revisar y confirmar el lote. Reimportar preserva las existencias según T3. El operador mantiene el túnel HTTPS o ingreso ya configurado.

El aprovisionamiento requiere autorización de recursos facturables, verificación de vigencia y cobertura de los US$100 promocionales y del presupuesto personal aproximado de S/65. La compra de dominio requiere autorización. k6 se realiza en el entorno desplegado.

## Resultados

Comprobación local aprobada con Angular y NestJS compilados. `node --env-file-if-exists=.env --test tests/experiencia-catalogo.browser.cjs` con PLAYWRIGHT_CHANNEL=msedge completó 1/1 prueba de recorrido sobre PostgreSQL real. Incluye dos solicitudes reales, categoría activa, página reiniciada, búsqueda de un producto de la segunda página, detalle y cierre con Escape, selección conservada al ingresar, proveedor y mínimo preseleccionados, rechazo 404 de otra empresa y áreas independientes de al menos 44px en cabecera. Se comprobó ausencia de desbordamiento en 1440, 390 y 320px. Las capturas y `resultado.json` están en `docs/evidencias/experiencia-catalogo/`.

La prueba se repitió al ajustar las etiquetas de mínimo y la selección de imagen por nombre de producto. Un CI posterior detectó una espera insuficiente tras limpiar filtros. Se corrigió esperando los nombres exactos de la primera página antes de comprobar que la coincidencia de la segunda página está ausente. La regresión completa se ejecuta en GitHub Actions mediante el comando existente `npm run test:browser`, que incluye ahora este recorrido. Su resultado y el commit probado se registran en el PR. Redis y Compose conservan su evidencia aprobada en la ejecución 43351282758. Los datos de prueba se eliminan al cerrar el esquema aislado. El CSV de ocho productos se entrega para carga opcional por T3 y no se inyecta en la base de la demo del operador.
## Imágenes de esta entrega

Se utilizó la herramienta integrada imagegen con dos prompts finales. Se conservaron los archivos PNG generados dentro del proyecto. `apps/web/public/images/abastecimiento-demo.png` sirve el banner y el recurso genérico. `apps/web/public/images/familias-demo.png` contiene cuatro fotografías referenciales usadas mediante posiciones CSS en categorías, tarjetas y detalle. Las fotografías se indican como referenciales en producto. Las cuatro familias corresponden a los datos del CSV demo. La identidad verde de MayoristaPro se conserva.

Prompt del banner

> Create a single photorealistic professional commercial photograph for a Peruvian B2B wholesale supply website MayoristaPro. Wide landscape image, 3:2 aspect ratio. A tasteful arranged assortment of office notebooks with sage green and terracotta covers, white A4 paper reams, blue ballpoint pens, one generic black computer keyboard and mouse, ethernet cables, and unbranded kraft cardboard shipping boxes on a warm light grey studio tabletop. Realistic materials, soft daylight from left, sophisticated editorial product photography, elevated three-quarter camera view, subtle sage and warm cream palette. Objects concentrated in central and right portions, natural clean cream negative space at left. No text, no logos, no people, no watermarks, no price stickers. This is a realistic illustrative photograph for a demo wholesale homepage.

Prompt de familias

> Create a 2 by 2 contact sheet of FOUR separate photorealistic unbranded product photographs for a wholesale office and technology website. Exactly four equally sized square quadrants, no gutters, no frames, no text, no logos. Each quadrant has its own light warm ivory seamless studio backdrop, subtle soft shadows, and its objects fully inside that quadrant with generous surrounding margin. TOP LEFT: a neat small stack of three spiral A4 notebooks with muted sage green, light blue and terracotta covers, plus two blue ballpoint pens. TOP RIGHT: a clean stack of white A4 paper reams with plain white unprinted wrapping, one open paper edge visible. BOTTOM LEFT: black computer keyboard and black wireless mouse, fully visible, neatly aligned diagonally. BOTTOM RIGHT: white generic WiFi router with two antennae and one neatly coiled blue ethernet cable. Consistent soft commercial studio lighting, realistic product photography, elevated three-quarter view. Image square, four square photos precisely arranged as quadrants so a website can crop them using CSS. No typography, no numbers, no discounts, no watermarks.

Referencias de jerarquía y navegación consultadas durante el diseño. [PcComponentes](https://www.pccomponentes.com/), [Oster Perú](https://www.oster.com.pe/) y [Compy](https://compy.pe/galeria).