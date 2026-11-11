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

Registro y login públicos. Logout requiere token Bearer. T2 no implementa refresh: al vencer la sesión se inicia sesión otra vez. El registro comprueba formato y unicidad de RUC sin asociar usuarios por coincidencia. D1 aprobada: revisión manual del alta e invitaciones de un uso con vencimiento; administración de plataforma separada. Consulta SUNAT pendiente de confirmación. El contrato implementado y sus cuerpos están en [T2](../sprint-2-identidad.md).

| Método y ruta |
|---|
| `POST /auth/register` |
| `POST /auth/login` |
| `GET /auth/me` |
| `POST /auth/logout` |

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

### quotations

D2 y D4 aprobadas; [SDD T4 y pruebas previstas](../sprint-2-cotizaciones-pedidos.md). T3 está incorporada a main; T4 continúa pendiente de implementación. La respuesta agrega envío, plazo, vigencia e indicador de IGV y devuelve desglose/total calculado por el servidor antes de aceptar. Una aceptación por solicitud y un pedido por oferta. La demo admite precios con IGV incluido y envío por importe final fijo o S/ 0.

Comprador propietario y proveedores destinatarios; respuestas según participación.

| Método y ruta |
|---|
| `POST /quotations` |
| `GET /quotations` |
| `POST /quotations/:id/responses` |
| `PATCH /quotations/:id/responses/:respuestaId/accept` |

### ai

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
