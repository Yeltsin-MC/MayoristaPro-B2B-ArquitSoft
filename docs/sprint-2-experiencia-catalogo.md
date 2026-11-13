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
## Corrección de imágenes y elección de cantidad mayorista

El navegador contra `http://localhost:4200/#inicio` solicitaba `/images/abastecimiento-demo.png` y `/images/familias-demo.png`, ambas con 404 HTML. Los dos PNG existen en la rama y son los mismos archivos generados de esta entrega. El proceso dev:web estaba iniciado con la configuración anterior de assets. Se explicitó la salida `/` de `public` en Angular y se reinició únicamente ese proceso. El proxy antiguo consultaba localhost:3000, cuya API devuelve 404 para `/api/v1/products/options`. La instancia existente localhost:3100 sí ofrece esa ruta. `proxy.conf.cjs` permite seleccionar API_PROXY_TARGET y conserva localhost:3000 como valor habitual. La comprobación local usa la API existente 3100.

Para reproducir el arranque de la web contra esa instancia, desde PowerShell en MayoristaPro-Kiro, ejecutar los siguientes comandos. Reiniciar dev:web al modificar angular.json o el destino del proxy.

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:3100'
npm run dev:web
```

Cada foto de categoría, tarjeta y detalle usa el recurso generado correspondiente a su familia y un rótulo referencial. Si la descarga falla, el componente muestra el respaldo MayoristaPro y el rótulo Imagen referencial. El banner conserva su archivo original. En localhost:4200, ambos PNG devuelven 200 image/png. Se verificaron por separado 1 banner, 2 accesos reales de categoría y 5 tarjetas, con imágenes decodificadas en 1440x1050 y 390x1000. Las URL, estados, dimensiones y capturas están en `docs/evidencias/cantidad-mayorista/imagenes-dev-web.json` y los archivos imagenes-dev-web-* y tarjeta-dev-web-*.

El precio se expresa por presentación y contenido, por ejemplo S/ 48.00 por caja de 12 unidades. Mínimo y múltiplo incluyen el nombre de la presentación. La cantidad comienza en el menor múltiplo válido que alcanza el mínimo. Se puede editar desde la tarjeta o el detalle y se comparte por producto. El formulario conserva producto, proveedor y cantidad al ingresar. Muestra equivalencia en unidades cuando el empaque contiene más de una. Los campos del producto seleccionado se presentan como solo lectura para conservar el significado de la cantidad. Las solicitudes genéricas mantienen sus campos editables.

La tarjeta y el formulario explican cantidad vacía, no entera, inferior al mínimo, incompatible con el múltiplo o superior al stock consultado. Si el stock no alcanza el mínimo, explican la condición y bloquean la acción. El formulario también comprueba la cantidad antes de enviar. Las reglas y los permisos de servidor continúan en sus puntos existentes. La disponibilidad mostrada corresponde a la lectura del catálogo. El pedido vuelve a validar y reservar en su transacción según T4.

| ID | Criterio adicional | Prueba o evidencia |
|---|---|---|
| EC09 | Banner, categorías y tarjetas servidos y decodificados en dev:web y compilación, con respaldo visual si falla una foto | imagenes-dev-web.json y cantidad-mayorista.browser.cjs, respuesta 404 simulada para la foto de familia |
| EC10 | Precio y contenido legibles, cantidad inicial válida y errores visibles de mínimo, múltiplo y stock | cantidad-mayorista.browser.cjs, capturas cantidad-valida-* y cantidad-invalida-* |
| EC11 | Producto, proveedor y cantidad elegida conservados tras ingreso y solicitud privada real | cantidad-mayorista.browser.cjs, capturas solicitud-*, lectura autorizada de la solicitud y 404 para otra empresa |

Comprobación local de los dos recorridos afectados aprobada con 2/2 pruebas, Angular compilado y Edge sobre PostgreSQL real. En cada viewport se probaron 1 caja inválida por mínimo, 3 inválidas por múltiplo de 2, 4 válidas equivalentes a 48 unidades y un producto con stock inferior al mínimo. El formulario rechaza 3 y conserva 4 al crear la solicitud. Los datos se cargaron por T3 en esquema aislado. Se conservan las capturas y resultado.json en docs/evidencias/cantidad-mayorista/. La regresión completa se ejecuta en GitHub Actions del PR #7 e incluye este recorrido dentro de npm run test:browser.
## Primera tanda de la auditoría UX

La pérdida de sesión visible se debía a que Angular guardaba el Bearer únicamente en un signal y lo inicializaba vacío al recargar. La sesión correspondiente seguía vigente en PostgreSQL. Se conserva el Bearer en memoria y se introduce una cookie de sesión HttpOnly para recuperar la credencial tras validarla en el servidor. La cookie usa SameSite=Strict, Path=/api/v1/auth y Secure con el origen HTTPS configurado. Login y logout gestionan la cookie, y GET /auth/restore devuelve la cuenta y los permisos actuales con no-store. La sesión conserva su vencimiento original de ocho horas. El servidor rechaza origen ajeno en los endpoints de acceso. Las operaciones de negocio siguen autorizándose con Bearer y sus controles existentes.

Angular muestra la comprobación de sesión antes de habilitar la cuenta. Si la sesión venció, se cerró o perdió su vinculación, limpia el estado y muestra el ingreso. Si el servidor no permite comprobarla, presenta el acceso y un mensaje de recuperación. El cierre se considera completado cuando responde el servidor. El primer ingreso tras actualizar establece la cookie para las siguientes recargas. Se mantiene fuera del almacenamiento local y de sesión de JavaScript cualquier token. La restauración no guarda borradores sin enviar.

El ingreso desde un producto muestra junto al formulario un resumen con nombre, proveedor, presentación y cantidad. En móvil sustituye el texto genérico de la cuenta por la selección y desplaza la vista inmediatamente al resumen. Conserva la cantidad al ingresar y también cuando el comprador ya está autenticado. Los mensajes de acceso se muestran junto al formulario.

### Causa real de las tres acciones deshabilitadas

Consulta de solo lectura de la demo realizada durante este incremento. Los tres registros pertenecen al proveedor de prueba Distribuidora Huamanga, verificado para el catálogo público y sin empresa vinculada. La consulta de cotización exige una empresa habilitada del proveedor.

| Producto público | Stock | Mínimo | Empresa vinculada | Motivo |
|---|---|---|---|---|
| Bolígrafo azul | 48 paquetes | 2 paquetes | Ausente | Falta empresa habilitada para recibir cotizaciones |
| Cuaderno A4 | 20 cajas | 2 cajas | Ausente | Falta empresa habilitada para recibir cotizaciones |
| Resma de papel A4 | 15 cajas | 1 caja | Ausente | Falta empresa habilitada para recibir cotizaciones |

La tarjeta y el detalle explican el motivo. Ofrecen abrir otra oferta cotizable y disponible de la página consultada. Cuando la página no contiene otra oferta, el enlace Explorar el catálogo restablece los filtros. Los errores de cantidad muestran cómo ajustar mínimo, múltiplo y stock. Se conservan las reglas de publicación, proveedor, empresa y permisos del servidor.

| ID | Criterio | Evidencia |
|---|---|---|
| EC12 | Restauración validada, permisos vigentes y limpieza al cerrar, vencer o revocar | browser-session.integration.cjs y continuidad-comprador.browser.cjs |
| EC13 | Resumen visible en móvil y escritorio y cantidad conservada al ingresar o con sesión iniciada | continuidad-comprador.browser.cjs, ingreso-movil.png e ingreso-escritorio.png |
| EC14 | Motivo de las tarjetas deshabilitadas y alternativa que abre un producto cotizable | Consulta de demo documentada y continuidad-comprador.browser.cjs |

Compilación local Angular y NestJS aprobada. Pruebas focalizadas de PostgreSQL y navegador completadas con comprador y proveedor ficticios en un esquema aislado. Se comprobaron cookie HttpOnly de sesión y Secure para HTTPS, rechazo de origen ajeno, vencimiento, cierre, cambio de permisos y acceso revocado. En 1440x1000 y 390x844 se crearon solicitudes reales conservando cuatro cajas después del ingreso y se abrió otra solicitud con seis cajas estando autenticado. La recarga recuperó la cuenta y la solicitud guardada. Un fallo 503 simulado en restore mantuvo el acceso sin autorizar el área privada. localStorage y sessionStorage permanecieron vacíos. Capturas y resultado.json en docs/evidencias/primera-tanda-ux/. La regresión completa corresponde al CI del PR #7.
## Simplificación de cotizaciones para compradores — EC15–EC19

Rama `sprint-2/ux-cotizacion-comprador`, basada en `e4df9c9` del PR #8, que incluye la interfaz del PR #7 (`45b9678`). Ambos PR siguen abiertos al comenzar esta entrega. Este incremento UX se revisa sobre #8; después de integrar las dependencias se deberá revisar contra `main`. No incluye fusión ni AWS.

### Flujo y decisiones

Desde una tarjeta o detalle, se conserva la selección actual y el ingreso validado por el servidor. Al autenticarse aparece un formulario compacto con producto, proveedor, empaque, cantidad y **Enviar solicitud**. Los datos del producto son texto, no campos repetidos de edición. El proveedor de origen permanece seleccionado; **Añadir otro proveedor** despliega los destinatarios adicionales para enviar una sola solicitud. Los mínimos, múltiplos, equivalencia y errores de stock aparecen junto a la cantidad. En A4, se usa el empaque real del catálogo: caja de **5 resmas**, no las diez del ejemplo ilustrativo. Dos cajas equivalen a diez resmas.

**Nueva solicitud** conserva el formulario completo para descripciones libres, presentaciones e ítems múltiples. Iniciarla limpia la selección anterior. Mis pedidos queda accesible mediante navegación separada y fuera del formulario de envío.

El envío correcto muestra **Solicitud enviada** y acceso a **Mis cotizaciones**. La lista usa producto principal, **Esperando ofertas**, **1 oferta recibida**, **N ofertas recibidas** u **Oferta aceptada**, y **Ver cotización**. No muestra UUID en sus etiquetas; los identificadores permanecen internos para API/automatización. Abrir una cotización desplaza el foco a su detalle.

Para evitar descargar todos los detalles al construir la lista, `GET /quotations` agrega `primaryProduct` (mismo orden de ítems que el detalle) y `offerCount`. El comprador autorizado cuenta las ofertas de su solicitud; cada proveedor destinatario cuenta solo sus propias ofertas. No se expone el número de ofertas de competidores ni información de otras empresas. Se mantienen los filtros de autorización y el máximo de 100 solicitudes existentes.

Las tarjetas de comparación destacan proveedor, total PEN con envío y plazo. **Ver detalles** mantiene disponibles antes de aceptar la cantidad, precio, desglose, IGV y vigencia. La puntuación calculada está dentro de los detalles de la oferta; su cálculo y ordenación permanecen en **Ver detalles de comparación e IA**. No se cambia el algoritmo ni se llama a otro modelo.

**Aceptar oferta** conserva su significado: no reserva stock. Luego aparece **Crear pedido y reservar stock**, que usa la transacción/idempotencia existentes de T4. No se cambian precios, permisos, inventario ni pagos.

### Criterios y evidencia

| ID | Criterio | Prueba/comprobación |
|---|---|---|
| EC15 | Compacto desde producto, solo cantidad editable, proveedor de origen conservado, segundo proveedor secundario y selección recuperada al ingresar | `cotizacion-simple.browser.cjs`: A4 Cobre, ingreso conservando cuatro cajas, un solo input inicial, dos destinatarios en la solicitud enviada; selección autenticada de seis cajas |
| EC16 | Mensaje próximo a cantidad inválida y envío bloqueado por mínimo, múltiplo o stock | Mismo navegador: 1 caja, 3 cajas y 42 cajas inválidas; 2 válidas; `aria-invalid` y explicación asociada |
| EC17 | Confirmación y lista legibles sin UUID; conteo privado de ofertas | Navegador: confirmación, acceso a lista, producto y estado, dos ofertas recibidas; `quotation-summary.integration.cjs`: comprador ve dos, cada proveedor una y empresas ajenas ninguna |
| EC18 | Total y plazo destacados, desglose/vigencia accesibles en detalles, aceptación y reserva separadas | Navegador A4: S/187.80/2 días y S/180.00/5 días, detalles cerrados/abiertos y aceptación disponible; regresión `quotations.browser.cjs` comprueba aceptar sin descontar, pedido/reserva e idempotencia |
| EC19 | Pedidos separados del envío y formulario completo para nueva solicitud | Navegador: acceso Mis pedidos, nueva solicitud vacía con descripción y Añadir ítem; regresiones previas adaptadas a etiquetas nuevas |

Comprobación focalizada local con PostgreSQL real: **4/4 resultados de integración** del resumen (tres casos y su contenedor), más **1/1 prueba de navegador** que recorre escritorio 1440×1000 y móvil 390×844. Ambos recorridos enviaron una solicitud real a dos proveedores, conservaron selección al ingresar, comprobaron errores y confirmación, y abrieron la comparación privada con dos ofertas. Sin errores JavaScript ni desbordamiento horizontal. Se usa el catálogo CSV del PR #8 en un esquema aleatorio aislado, eliminado al terminar; no se modifican pedidos ni stock de la demo existente.

Compilación Angular/NestJS comprobada. Capturas y resultado estructurado: [evidencias de cotización simplificada](evidencias/cotizacion-simple/resultado.json), incluidos `formulario-movil.png`, `cantidad-invalida-movil.png`, `confirmacion-movil.png` y `comparacion-movil.png`. La regresión completa se delega al CI del PR de esta rama, que incluye ambas pruebas nuevas y los recorridos existentes adaptados; su enlace y resultado definitivo quedan registrados en el PR.
