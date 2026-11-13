# Contratos de API REST

Propuesta API-First. Base `/api/v1`. Las rutas pertenecen a MayoristaPro. El adaptador del MVP utiliza Mercado Pago Checkout Pro en modo de prueba.

## Convenciones

| Aspecto | Regla |
|---|---|
| Formato | JSON; fechas ISO 8601; importes decimales como cadenas y moneda explícita. |
| Autenticación | T2 usa Bearer opaco aleatorio con sesión persistida y vencimiento de 8 horas. Empresa y permisos se consultan en servidor. JWT queda como propuesta posterior. |
| Autorización | Validar rol, empresa y participación en cada recurso. No aceptar comprador o tenant arbitrarios del body. |
| Paginación | page y limit; límite máximo propuesto de 100. |
| Idempotencia | `Idempotency-Key` en creación de pedidos, confirmación de importaciones, inicio de pago y reembolso. Ámbito de creación por empresa compradora y operación. Los demás ámbitos se especifican en el diseño del flujo. Misma clave con distinto contenido devuelve `409`. |
| Errores | code y message; 400 entrada inválida, 401 sin autenticación, 403 sin permiso, 404 no encontrado, 409 conflicto y 422 regla de negocio. No exponer secretos ni trazas. |
| Respuesta incierta | Un timeout de pasarela no confirma rechazo. Consultar el intento persistido antes de repetir la operación. |

## Catálogo de rutas

### auth

Registro y login públicos. Logout acepta Bearer o la cookie de sesión del navegador y revoca la sesión en PostgreSQL. Al vencer la sesión se inicia sesión otra vez. El registro comprueba formato y unicidad de RUC sin asociar usuarios por coincidencia. D1 aprobada: revisión manual del alta e invitaciones de un uso con vencimiento; administración de plataforma separada. Consulta SUNAT pendiente de confirmación. El contrato implementado y sus cuerpos están en [T2](../sprint-2-identidad.md).

| Método y ruta |
|---|
| `POST /auth/register` |
| `POST /auth/login` |
| `GET /auth/session` |
| `GET /auth/restore` |
| `GET /auth/me` |
| `POST /auth/logout` |

`POST /auth/login` conserva `{token,expiresIn}` y emite una cookie de sesión HttpOnly, SameSite=Strict, limitada a `/api/v1/auth`, sin Expires ni Max-Age. `GET /auth/restore` usa esa cookie y valida sesión, vigencia y vinculación actual. Devuelve cuenta, administración y, para usuarios empresariales habilitados, empresa y permisos actuales junto al Bearer que Angular mantiene en memoria. La respuesta usa `Cache-Control: no-store`. La restauración conserva el vencimiento original de ocho horas. Una cookie inválida, sesión vencida o acceso revocado devuelve 401/403 y elimina la cookie. Las operaciones comerciales conservan el requisito Bearer. Login, restore y logout rechazan un Origin ajeno cuando está presente. Secure se activa con HTTPS directo o FRONTEND_URL/API_URL HTTPS del ingreso configurado. El cierre revoca el token y elimina la cookie. Las sesiones anteriores a este incremento requieren un ingreso para establecer la cookie. [Cookie de sesión](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

`GET /auth/session` exige Bearer válido y devuelve `{accountId,platformAdmin}` de la cuenta autenticada, sin exigir una vinculación empresarial. Angular consulta este dato para mostrar «Solicitudes (administración)» exclusivamente a administradores. `GET /auth/me` conserva el requisito de vinculación habilitada; publicación y carga masiva requieren además permiso `publish` y proveedor verificado. La visibilidad de controles no sustituye la autorización del backend.

### providers

Lectura de perfiles publicados; verificación solo administrador.

| Método y ruta |
|---|
| `GET /providers` |
| `GET /providers/:id` |
| `PATCH /providers/:id/verify` |

### products

Lectura pública del catálogo publicado desde la página de inicio; escritura solo proveedor propietario verificado. `GET /products` devuelve ofertas por proveedor, con imagen disponible, presentación, unidades por presentación, precio publicado PEN, indicador de IGV, rangos de cantidad, mínimo, múltiplo y disponibilidad. No devuelve cotizaciones privadas ni precios negociados. `GET /products/:id` permite abrir el detalle de una oferta publicada dentro de MayoristaPro; cotizar y comprar requiere autenticación empresarial.

| Método y ruta |
|---|
| `GET /products` |
| `GET /products/:id` |
| `POST /products` |
| `PATCH /products/:id` |
| `DELETE /products/:id` |

### Catálogo público implementado para la demo

`GET /products` devuelve `{items,page,limit}`. Acepta `page` desde 1, `limit` de 1 a 100, `q` de hasta 120 caracteres, `category`, `supplier` UUID, `available=true|false` y `sort=price-asc|price-desc`. La búsqueda literal y los filtros se aplican antes de paginar. Cada ítem incluye presentación, equivalencia, mínimo, múltiplo, stock, precio PEN, IGV, proveedor, `supplierId` y `quoteEnabled`. Este último indica si el proveedor tiene una empresa habilitada para recibir solicitudes. La disponibilidad de inventario se informa mediante `available`.

`GET /products/options` devuelve `{categories,suppliers:[{id,name}]}` a partir de productos publicados de proveedores verificados. Angular utiliza ilustraciones referenciales propias cuando falta una imagen del producto. La selección de un producto conduce al registro o inicio de sesión empresarial y al formulario de cotización autorizado.

### quotations

D2 y D4 aprobadas; [SDD T4, contrato implementado y pruebas](../sprint-2-cotizaciones-pedidos.md). Una aceptación por solicitud y un pedido por oferta. La respuesta agrega envío, plazo, vigencia e IGV incluido y devuelve desglose/total calculado antes de aceptar. Solicitudes: `GET/POST /quotations` y `GET /quotations/:id`; pedidos: `GET/POST /orders` y `GET /orders/:id`. Directorio autorizado: `GET /trade/providers`; productos propios: `GET /trade/products`. La SDD documenta cuerpos, respuestas, permisos y límites. El envío es un importe final fijo o cero, sin cálculo tributario adicional. La reserva T4 devuelve vencimiento nulo, sin inventar un plazo de pago.

Comprador propietario y proveedores destinatarios; respuestas según participación.

| Método y ruta |
|---|
| `POST /quotations` |
| `GET /quotations` |
| `POST /quotations/:id/responses` |
| `PATCH /quotations/:id/responses/:respuestaId/accept` |

### ai

La demo T6 implementa `POST /quotations/:id/score-offers`, con Bearer del comprador propietario, y `GET /ai/health`. NestJS agrega el prefijo `/api/v1` una sola vez. El scoring devuelve `{quotation_id,scored_offers,ai_service_available}`. Cada oferta conserva identificadores, nombre del proveedor, total y plazo, y agrega `score` de 0 a 100 y `breakdown`. El algoritmo determinista pondera precio 50%, entrega 30% y reputación 20%. Ante indisponibilidad o respuesta incompatible de FastAPI se conservan las ofertas con puntuación y desglose nulos. La cotización sin ofertas devuelve una lista vacía. El flujo se comprueba con PostgreSQL y FastAPI reales en la evidencia de demo.


Comprador propietario de la cotización. Las ofertas de la comparación pertenecen a la misma solicitud.

| Método y ruta |
|---|
| `GET /ai/recommendations` |

### orders

Comprador y proveedor participantes; transiciones según rol.

| Método y ruta |
|---|
| `POST /orders` |
| `GET /orders` |
| `GET /orders/:id` |
| `PATCH /orders/:id/status` |

### payments

Comprador participante y administración autorizada; sin datos sensibles del proveedor.

| Método y ruta |
|---|
| `GET /payments/:pedidoId` |
| `POST /payments/:pedidoId/refund` |

### deliveries

Proveedor participante registra; comprador participante confirma recepción.

| Método y ruta |
|---|
| `POST /deliveries` |
| `PATCH /deliveries/:pedidoId/confirm` |

### reviews

Comprador de un pedido recibido.

| Método y ruta |
|---|
| `POST /reviews` |

### incidents

Reportante participante y administración; solo información autorizada.

| Método y ruta |
|---|
| `POST /incidents` |
| `GET /incidents` |
| `PATCH /incidents/:id/status` |

### reports

Administración o proveedor sobre sus propios indicadores.

| Método y ruta |
|---|
| `GET /reports/summary` |
| `GET /reports/top-products` |
| `GET /reports/top-providers` |

## Contratos críticos

### Importación mayorista y cantidades

**Implementado en T3:** [contrato físico, columnas, estados y errores](../sprint-2-carga-masiva.md). Carga multipart en `file`, plantillas CSV/XLSX en `GET /products/imports/template`, vista previa de 30 minutos y confirmación con JSON `{previewHash}` más `Idempotency-Key`. Las tres operaciones del lote exigen proveedor verificado con permiso `publish`. Campos inválidos conservan un lote `invalid`, sin modificar productos; cambios posteriores del SKU dejan `stale` y exigen cargar/revisar de nuevo. La consulta pública sigue leyendo PostgreSQL y se recarga tras confirmar, sin caché de servidor implementada.

| Método y ruta propuesta | Acceso y resultado |
|---|---|
| `POST /products/imports/preview` | Proveedor propietario verificado; recibe CSV/XLSX, valida y devuelve identificador de lote, filas nuevas/actualizaciones, errores por fila y vencimiento de vista previa. No publica productos todavía. |
| `POST /products/imports/:id/confirm` | Proveedor propietario e Idempotency-Key; revalida lote vigente y confirma todos los registros en una transacción. Un lote con errores no se aplica parcialmente; reintentar no duplica efectos. |
| `GET /products/imports/:id` | Solo proveedor propietario; consulta estado y reporte del lote sin exponer archivos de otras empresas. |

La propuesta inicial limita cada archivo a 500 filas y 5 MB, pendiente de pruebas. La importación inicial declara stock; las actualizaciones de metadatos no reemplazan existencias. Los cambios posteriores de inventario se harán mediante un contrato de ajustes autorizado, por concretar antes de implementarlo.

Catálogo y cotizaciones expondrán presentación, unidades por presentación, mínimo y múltiplo de compra, además del precio y stock en esa misma presentación. Las cantidades de oferta y pedido deben alcanzar el mínimo y ser múltiplos válidos; el backend revalida dentro de la reserva. Las recomendaciones filtran ofertas elegibles y devuelven un motivo y método del orden. Estas reglas amplían los contratos propuestos y quedan pendientes de implementación y OpenAPI en Sprint 02. Detalle: [reglas mayoristas](reglas-comerciales-mayoristas.md).

| Operación | Entrada relevante | Resultado esperado |
|---|---|---|
| POST /quotations | Ítems con descripción, unidad y cantidad; proveedores destinatarios. Puede incluir producto de referencia para comparar equivalentes. | 201: solicitud e identificadores de sus ítems. |
| POST /quotations/:id/responses | Ítems con solicitudItemId, productoId propio, cantidad y precioUnitario; moneda, vigencia y condiciones de entrega. | 201: respuesta con sus propios precios por ítem y total calculado por el servidor. |
| PATCH /quotations/:id/responses/:respuestaId/accept | Identificador de respuesta; comprador obtenido de sesión. | 200: aceptación exclusiva de una oferta vigente. No reserva stock todavía. |
| POST /orders | cotizacionRespuestaId e Idempotency-Key. | 201: pedido pendiente, total, moneda y vencimientoReserva; stock y condiciones revalidados atómicamente. |
| PATCH /orders/:id/status | estado solicitado y motivo cuando corresponda. | Transición autorizada. No permite al navegador marcar confirmado sin pago verificado. |
| GET /payments/:pedidoId | Pedido visible para el solicitante. | Lista de intentos y su estado; nunca tokens ni credenciales. |
| POST /payments/:pedidoId/refund | motivo e Idempotency-Key; administrador autorizado. | 202 si se solicita al proveedor de forma asíncrona; reembolsado solo tras confirmación. |
| GET /ai/recommendations | Cotización propia y preferencia opcional. | `200` con ofertas elegibles, costo/plazo disponibles, explicación y método. El cálculo y el filtrado se ejecutan en el backend. |

Para v1 se toma como recorrido principal el pedido desde cotización aceptada. La compra directa desde catálogo descrita en la propuesta general requiere definir su contrato y las mismas validaciones antes de implementarse.

## Inicio y confirmación del pago

| Método y ruta propuesta | Acceso y comportamiento |
|---|---|
| POST /payments/:pedidoId/attempts | Comprador participante y reserva válida. Persiste intento y referencia antes de invocar al proveedor. Devuelve `201` con referencia y URL de checkout cuando esté disponible, o `202` si está pendiente de resolución. |
| POST /payments/webhooks/:pasarela | Verifica autenticidad según el perfil de Mercado Pago, deduplica y verifica en la pasarela referencia, estado, monto y moneda. El retorno del navegador carece de autoridad para confirmar. |

El perfil Checkout Pro y sus campos se verificarán con las credenciales de prueba. El retorno del navegador muestra el estado consultado a MayoristaPro. El webhook autenticado dispara la verificación con el proveedor. El resultado definitivo se aplica en una única transacción local a intento, pedido, reserva y outbox cuando corresponde.

## Estados y permisos

| Recurso | Estados propuestos | Regla |
|---|---|---|
| Pedido | pendiente, confirmado, en_preparacion, despachado, entregado, cancelado | Confirmado por el sistema tras pago verificado; proveedor prepara/despacha; comprador recibe. Cancelación según estado y pago. |
| Intento de pago | pendiente, autorizado, pagado, rechazado, cancelado, reembolsado | Autorizado no equivale a pagado. Un resultado desconocido conserva pendiente para consulta. |
| Reserva | activa, consumida, liberada | Un cambio terminal no se repite. El vencimiento inicia revisión y reconciliación. |

## Ejemplo de creación de pedido

```json
{
  "cotizacionRespuestaId": "identificador-de-respuesta-aceptada"
}
```

La cabecera Idempotency-Key identifica el intento de creación. El servidor obtiene comprador, proveedor, productos y precios de fuentes autorizadas; no recibe el total como importe confiable.

**Pendientes para Sprint 02:** OpenAPI completo, esquemas de validación, matriz de permisos y prueba del perfil Checkout Pro. Véanse las [invariantes y decisiones pendientes](flujo-comercial-sprint-2.md).

### Resumen de solicitudes en el área privada

El incremento UX del comprador agrega a cada fila de `GET /quotations` los campos aditivos `primaryProduct` (descripción del primer ítem en el orden del detalle) y `offerCount` (entero). Solo el comprador autorizado ve el conteo de todas las ofertas de su solicitud; un proveedor destinatario ve únicamente el conteo de sus propias respuestas. Las otras empresas continúan sin acceso. Se conservan los campos `id`, `buyerName`, `status`, el límite existente y las validaciones comerciales. La interfaz muestra producto/estado y mantiene los identificadores internos fuera de las etiquetas visibles. Criterios EC15–EC19 en [SDD de experiencia](../sprint-2-experiencia-catalogo.md).
