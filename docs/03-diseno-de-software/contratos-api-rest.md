# Contratos de API REST

Propuesta API-First para la implementación. Base: `/api/v1`. Las rutas son contratos propios de MayoristaPro; no representan rutas verificadas de Niubiz, Mercado Pago u otro proveedor.

## Convenciones

| Aspecto | Regla |
|---|---|
| Formato | JSON; fechas ISO 8601; importes decimales como cadenas y moneda explícita. |
| Autenticación | JWT Bearer para operaciones protegidas. Identidad y empresa se obtienen de la sesión validada. |
| Autorización | Validar rol, empresa y participación en cada recurso. No aceptar comprador o tenant arbitrarios del body. |
| Paginación | page y limit; límite máximo propuesto de 100. |
| Idempotencia | Idempotency-Key en creación de pedidos, inicio de pago y reembolso; alcance por identidad y operación. Misma clave con distinto contenido devuelve conflicto. |
| Errores | code y message; 400 entrada inválida, 401 sin autenticación, 403 sin permiso, 404 no encontrado, 409 conflicto y 422 regla de negocio. No exponer secretos ni trazas. |
| Respuesta incierta | Un timeout de pasarela no confirma rechazo. Consultar el intento persistido antes de repetir la operación. |

## Catálogo de rutas

### auth

Registro/login públicos; refresh/logout requieren credencial o sesión válida.

| Método y ruta |
|---|
| `POST /auth/register` |
| `POST /auth/login` |
| `POST /auth/refresh` |
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

Comprador propietario y proveedores destinatarios; respuestas según participación.

| Método y ruta |
|---|
| `POST /quotations` |
| `GET /quotations` |
| `POST /quotations/:id/responses` |
| `PATCH /quotations/:id/responses/:respuestaId/accept` |

### ai

Comprador autenticado; datos autorizados.

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
| GET /ai/recommendations | producto, cantidad y ubicación pertinentes. | 200: lista, explicación y método reglas o precio_alternativo. No etiqueta reglas como modelo entrenado. |

Para v1 se toma como recorrido principal el pedido desde cotización aceptada. La compra directa desde catálogo descrita en la propuesta general requiere definir su contrato y las mismas validaciones antes de implementarse.

## Inicio y confirmación del pago

| Método y ruta propuesta | Acceso y comportamiento |
|---|---|
| POST /payments/:pedidoId/attempts | Comprador del pedido pendiente y con reserva válida. Persiste intento y clave antes de llamar a la pasarela; responde 201 o 202 con referencia y estado. |
| POST /payments/webhooks/:pasarela | Autenticación propia del proveedor (firma o mecanismo verificado), no JWT de comprador. Verifica evento, referencia, monto y moneda; identifica duplicados. |

El contrato exacto de tokenización, redirección y verificación de firma se definirá con la documentación del proveedor elegido. Una notificación no verificada no confirma un pedido. Los eventos confirmados actualizan intento y pedido, junto a la tarea pendiente de publicación.

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

**Pendientes para Sprint 02:** OpenAPI completo, esquemas de validación por ruta, límites de archivos/carga masiva, permisos detallados y contrato sandbox del proveedor seleccionado. Los endpoints de consulta existentes no implican que todo el alcance esté implementado.
