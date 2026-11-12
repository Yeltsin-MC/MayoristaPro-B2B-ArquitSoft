# Demo mayorista y cierre de integración T6

Verificación local del 12 de noviembre de 2026. Rama `sprint-2/demo-mayorista-t6`, creada desde `sprint-2/ia-proveedores` en `6f88fe4` y los cambios locales de T6 existentes.

## Especificación y criterios de aceptación

Se conservan las reglas de [identidad](../sprint-2-identidad.md), [cotizaciones y reservas](../sprint-2-cotizaciones-pedidos.md) y el [plan de Sprint 2](../05-preparacion-sprint-2.md). Los proveedores necesitan una empresa habilitada, verificación y permiso de publicación. La puntuación compara las ofertas privadas de una misma solicitud y la aceptación sigue siendo una decisión del comprador.

| Criterio | Comportamiento | Comprobación |
|---|---|---|
| UX01 | Identificar las cuentas demo, sus empresas, permisos y verificación | Consulta de solo lectura de PostgreSQL y [resultado público](demo-mayorista/demo-publica.json). Las cuatro cuentas existen. Inicio de sesión de esas cuentas pendiente de sus credenciales. |
| UX02 | Búsqueda por nombre, categoría o proveedor, filtros y orden por precio sobre todo el catálogo, antes de paginar | [Prueba PostgreSQL de catálogo](../../tests/catalog-filters.integration.cjs), cuatro casos y contenedor. Se excluyen borradores y proveedores pendientes. |
| UX03 | Cuenta empresarial con acciones según permisos y verificación | [Regresión de roles e importación](../../tests/catalog.browser.cjs), cinco resultados aprobados. |
| UX04 | Solicitar cotización desde un producto conserva proveedor, presentación y cantidad mínima válida, incluso al iniciar sesión | [Recorrido UX](../../tests/demo-ux.browser.cjs). Los proveedores antiguos sin empresa habilitada muestran la cotización deshabilitada. |
| UX05 | Comparar condiciones completas y puntuación de ofertas autorizadas mediante Angular, NestJS y FastAPI | [Integración T6](../../tests/ai.integration.cjs) y recorrido UX. Puntuaciones 90 y 10 con ambos proveedores sin historial. Otra empresa recibe 404 y carece del enlace a la solicitud. |
| UX06 | Una caída de IA permite revisar las ofertas y continuar con su aceptación | T6 prueba un HTTP 503 del adaptador. El navegador recibe el mismo contrato de degradación mediante una respuesta interceptada y comprueba dos ofertas sin puntuación, importes conservados y aceptación disponible. |
| UX07 | Foco visible y ausencia de desbordamiento horizontal en escritorio y móvil | Recorrido UX en 1440 px, 390 px, 360 px y 320 px. Capturas revisadas de catálogo y comparación. |
| UX08 | La presentación nueva conserva aceptación, pedido repetible y reserva de stock | [Regresión T4 de navegador](../../tests/quotations.browser.cjs). Total S/ 104.00, stock 20 a 18 y una reserva activa de dos presentaciones. |

## Cambios implementados

- Identidad visual verde, crema y lima, cabecera, navegación, buscador, filtros, tarjetas, formularios, estados y foco de teclado compartidos. Se consultaron [Compy Perú](https://www.compy.pe/) y [Oster Chile](https://www.oster.cl/) como referencias de organización y jerarquía. Las ilustraciones referenciales se construyen con CSS propio y llevan una etiqueta de presentación referencial.
- Catálogo con `q`, `category`, `supplier`, `available` y `sort`. `GET /api/v1/products/options` obtiene opciones de los productos públicos. Los filtros se aplican en PostgreSQL con parámetros. `supplierId` y `quoteEnabled` permiten conectar el producto con la solicitud y representar su elegibilidad.
- Cuenta ordenada por rol. La selección de catálogo se mantiene en memoria hasta completar el login. Administración dispone de una acción de verificación junto a la solicitud aprobada. Los usuarios gestionan sus invitaciones desde una sección desplegable.
- Comparación con cantidades, presentaciones, precio negociado, subtotal, envío final, total, plazo, vigencia y desglose de puntuación. La oferta de mayor puntuación se destaca cuando existen puntuaciones válidas.
- T6 utiliza el prefijo REST global una vez, verifica al comprador propietario y consume los nombres camelCase de T4. La reputación usa `DATABASE_URL` mediante un adaptador PostgreSQL con ciclo de vida del módulo. La respuesta de Python se valida y se combina con los importes comerciales autorizados.
- La API comprueba la consulta pública al arrancar y comunica una dependencia de PostgreSQL fallida antes de anunciar su disponibilidad. Sirve Angular compilado desde el mismo origen para la demo.

## Resultados reales

| Comando o comprobación | Resultado |
|---|---|
| `npm run build` y compilación Angular posterior al último ajuste de 320 px | Angular y NestJS completaron correctamente. |
| `npm run test:unit` | 1/1 aprobada. |
| `T6_AI_URL=http://127.0.0.1:5055` y `npm run test:integration` | 82/82 aprobadas, cero fallidas y cero omitidas en la ejecución completa final. Incluye las nueve comprobaciones T6 y cinco del nuevo catálogo. |
| `node --env-file=.env --test tests/catalog-filters.integration.cjs tests/catalog.integration.cjs` | 6/6 aprobadas sobre el catálogo final. |
| Regresión de navegador T3, Edge | 5/5 aprobadas. Registro, roles y recorrido Excel conservados. |
| Regresión de navegador T4, Edge | 3/3 aprobadas después de actualizar las aserciones del desglose. |
| `node --env-file=.env --test tests/demo-ux.browser.cjs` | 1/1 aprobada sobre la interfaz final. Incluye FastAPI real, respuesta de degradación simulada, aislamiento y anchos 1440, 390, 360 y 320 px. |
| Navegador contra la demo existente en 3100 | Catálogo con cinco productos, dos cotizaciones habilitadas, cero errores JavaScript, escritorio y móvil verificados. |
| `git diff --check` | Correcto. |

Los nueve resultados de navegador corresponden a los cinco de T3, tres de T4 y uno del recorrido UX. Se verificaron por ejecuciones focalizadas. Los informes con datos sintéticos están junto a las capturas. El log de la regresión completa queda en `.angular/demo-runtime/integration-final.log`.

La primera ejecución amplia detectó un `includes_tax` omitido en el nuevo fixture de filtros. Se corrigió el dato de prueba. La regresión visual T4 detectó que sus selectores esperaban el párrafo anterior del total. Se actualizaron las aserciones para comprobar por separado el mismo total, subtotal y envío en la nueva tarjeta.

La evidencia previa de Kiro de 11/11 unitarias Python se conserva. El algoritmo Python se mantuvo durante esta sesión.

## Evidencia de navegador

- [Catálogo de la instancia demo en escritorio](demo-mayorista/demo-real-escritorio.png) y [móvil](demo-mayorista/demo-real-movil.png). Se comprobaron cinco productos, dos acciones de cotización habilitadas y ausencia de errores JavaScript.
- [Comparación con FastAPI real en escritorio](demo-mayorista/comparacion-escritorio.png) y [móvil](demo-mayorista/comparacion-movil.png).
- [Comparación sin puntuaciones](demo-mayorista/comparacion-sin-ia.png).
- [Resultado del recorrido aislado](demo-mayorista/resultado.json). El fixture usa cuentas sintéticas, un esquema PostgreSQL temporal y un puerto NestJS aleatorio. El esquema se elimina al terminar.

Las capturas de comparación pertenecen al recorrido aislado. La comprobación de la instancia demo existente confirmó sus cuatro cuentas y la solicitud `5d04b33f-4652-4ce9-afca-e48a253c8324` con dos ofertas mediante consultas de solo lectura. Sus contraseñas faltan para automatizar ese inicio de sesión concreto. El usuario puede ingresar con las que eligió durante el alta.

## Abrir la demo al volver

1. Abrir <http://localhost:3100> y usar el buscador o el filtro de proveedor para ver los productos de Proveedor Demo Uno y Dos.
2. Pulsar Solicitar cotización en un producto habilitado e ingresar como `comprador@example.test` con la contraseña elegida al crear esa cuenta.
3. Para revisar las ofertas existentes, abrir Mi empresa y la solicitud `5d04b33f-4652-4ce9-afca-e48a253c8324`.
4. Pulsar Calcular puntuación IA. Para una nueva solicitud, revisar presentación y cantidad, añadir los destinatarios y enviar. Cada proveedor responde desde su propia cuenta.

La demo compilada utiliza el puerto 3100. El proceso creado por esta sesión se registra en `.angular/demo-runtime/api.pid`, con logs en esa misma carpeta. PostgreSQL se arrancó desde la instancia temporal de demo mediante la excepción autorizada expresamente por el usuario. FastAPI ya estaba disponible en el puerto 5055.

Para iniciar de nuevo la API y el frontend compilado, desde la raíz `MayoristaPro-Kiro`, con PostgreSQL y FastAPI disponibles

```powershell
$env:PORT = '3100'
$env:AI_SERVICE_URL = 'http://127.0.0.1:5055'
node --env-file=.env apps/api/dist/main.js
```

Para iniciar FastAPI en otra terminal desde la raíz del repositorio

```powershell
cd .\apps\ai-service
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 5055
```

Para detener la API de demo creada por esta sesión, comprobar el proceso guardado y su comando antes de detenerlo

```powershell
$demoPid = [int](Get-Content .angular/demo-runtime/api.pid)
Get-CimInstance Win32_Process -Filter "ProcessId=$demoPid" |
    Select-Object ProcessId, CommandLine
# Tras comprobar que corresponde a apps/api/dist/main.js de esta demo
Stop-Process -Id $demoPid
```

## Reproducir la verificación

Los comandos siguientes se ejecutan desde la raíz del repositorio y requieren PostgreSQL. T6_AI_URL habilita además el caso con FastAPI real.

```powershell
npm run build
npm run test:unit
$env:T6_AI_URL = 'http://127.0.0.1:5055'
npm run test:integration
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:browser
node --env-file=.env --test tests/demo-ux.browser.cjs
```

La pasarela de pagos se comprobó con el modo mock existente de T5. La validación real de Mercado Pago requiere sus credenciales de prueba. La siguiente revisión funcional de las cuentas demo requiere que el comprador ingrese con su contraseña existente.
