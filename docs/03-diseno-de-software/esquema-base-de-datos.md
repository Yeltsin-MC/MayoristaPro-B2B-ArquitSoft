# Esquema de base de datos

Modelo lógico propuesto para PostgreSQL. No es una migración ejecutada. Mantiene las tablas del diseño inicial y agrega el detalle necesario para reservas, respuestas por proveedor y recuperación de pagos.

## Relaciones del flujo comercial

```mermaid
erDiagram
    TENANTS ||--o{ USUARIOS : agrupa
    TENANTS ||--o| PROVEEDORES : perfil
    PROVEEDORES ||--o{ PRODUCTOS : publica
    PRODUCTOS ||--o{ PRECIOS_VOLUMEN : define
    TENANTS ||--o{ COTIZACIONES : solicita
    COTIZACIONES ||--|{ COTIZACION_ITEMS : contiene
    COTIZACIONES ||--|{ COTIZACION_DESTINATARIOS : dirige
    PROVEEDORES ||--o{ COTIZACION_DESTINATARIOS : recibe
    COTIZACION_DESTINATARIOS ||--o| COTIZACION_RESPUESTAS : responde
    COTIZACION_RESPUESTAS ||--|{ COTIZACION_RESPUESTA_ITEMS : ofrece
    COTIZACION_ITEMS ||--o{ COTIZACION_RESPUESTA_ITEMS : referencia
    PRODUCTOS ||--o{ COTIZACION_RESPUESTA_ITEMS : oferta
    COTIZACION_RESPUESTAS |o--o| PEDIDOS : origina
    TENANTS ||--o{ PEDIDOS : compra
    PROVEEDORES ||--o{ PEDIDOS : vende
    PEDIDOS ||--|{ PEDIDO_ITEMS : conserva
    PRODUCTOS ||--o{ PEDIDO_ITEMS : referencia
    PEDIDOS ||--|{ RESERVAS_STOCK : reserva
    PRODUCTOS ||--o{ RESERVAS_STOCK : afecta
    PEDIDOS ||--o{ PAGOS : intentos
    PAGOS ||--o{ PAGO_EVENTOS : notifica
    PEDIDOS ||--o| ENTREGAS : despacha
    PEDIDOS ||--o| EVALUACIONES : evalua
    PEDIDOS ||--o{ INCIDENCIAS : reporta
```

Se muestra el núcleo comercial. Auditoría, eventos de salida y archivos se describen debajo para no sobrecargar el diagrama.

## Tablas y campos principales

Todas las tablas usan id UUID y fechas de creación; las modificables agregan fecha de actualización. Las migraciones precisarán longitudes, nulabilidad e índices.

| Tabla | Campos y relaciones relevantes | Regla principal |
|---|---|---|
| tenants | nombre, ruc único, tipo, estado | Cada empresa es un tenant. |
| usuarios | tenant_id, email único, password_hash, rol, estado | Usuario empresarial asociado a su empresa. Cuenta administrativa de plataforma con tenant nulo y permisos explícitos. |
| proveedores | tenant_id único, estado_verificacion, dirección, ciudad | Perfil de empresa, no extensión exclusiva de un usuario; varios usuarios autorizados pueden operarlo. |
| productos | tenant_id, proveedor_id, nombre, descripción, categoría, precio_base, moneda, cantidad_minima_compra, stock, unidad, estado | Stock disponible no negativo; producto y proveedor pertenecen a la misma empresa. |
| precios_volumen | producto_id, cantidad_minima, cantidad_maxima opcional, precio_unitario | Cantidades positivas; máximo mayor o igual al mínimo; rangos sin solapamientos. |
| cotizaciones | tenant_id del comprador, comprador_id del usuario, estado | Solicitud privada con destinatarios explícitos. |
| cotizacion_items | cotizacion_id, descripción solicitada, unidad, cantidad, producto_referencia_id opcional | No almacena el precio que ofrecen todos los proveedores. |
| cotizacion_destinatarios | cotizacion_id, proveedor_id | Par único; identifica quién puede recibir y responder. |
| cotizacion_respuestas | destinatario_id único, estado, moneda, precio_total, vigente_hasta, condiciones_entrega, dias_entrega | Oferta completa de un proveedor; solo una respuesta aceptada por solicitud en v1. |
| cotizacion_respuesta_items | respuesta_id, solicitud_item_id, producto_id, cantidad, precio_unitario, subtotal | Precio por ítem de cada oferta; producto del proveedor que responde. |
| pedidos | tenant_id del comprador, comprador_id, proveedor_id obligatorio, cotizacion_respuesta_id opcional único, total, moneda, estado, idempotency_key, request_hash | Un comprador y un proveedor; snapshot de condiciones y entrega aceptadas. En el recorrido v1 la respuesta de cotización es obligatoria. |
| pedido_items | pedido_id, producto_id, descripción y unidad históricas, cantidad, precio_unitario, subtotal | Conserva cantidades y precios aceptados; todos los productos corresponden al proveedor del pedido. |
| reservas_stock | pedido_id, producto_id, cantidad, estado, vence_at | Par pedido/producto único. Activa, consumida o liberada. |
| pagos | pedido_id, monto, moneda, pasarela, estado, idempotency_key, referencia_externa, autorización opcional | Una fila por intento; el pedido puede tener varios intentos, pero no cobros duplicados. |
| pago_eventos | pago_id, pasarela, evento_externo_id, estado_procesamiento | Identificador externo único por pasarela para no repetir eventos. |
| entregas | pedido_id único, transportista, numero_guia, fecha_estimada, fecha_entrega_real, estado | Una entrega agregada por pedido en v1. |
| evaluaciones | pedido_id único, tenant_id, comprador_id, proveedor_id, calificación, comentario | Solo comprador de pedido recibido; calificación de 1 a 5. |
| incidencias | pedido_id, tenant_id, reportado_por, tipo, descripción, estado | Participantes autorizados y administración. |
| audit_log | tenant_id y usuario_id cuando correspondan, acción, entidad, registro_id, fecha, cambios permitidos | Sin contraseñas, credenciales, datos de tarjeta ni tokens. |
| outbox_eventos | tipo, agregado_id, payload permitido, estado, intentos, proximo_intento_at | Cambio comercial y evento pendiente se guardan en la misma transacción. |
| archivos | propietario_tenant_id, entidad e identificador asociado, objeto_s3, tipo, visibilidad | Imágenes públicas o documentos privados según permiso; sin URL pública permanente para documentos privados. |
| comprobantes | pedido_id, referencia_pse, estado, xml_archivo_id, cdr_archivo_id | Conserva resultado de facturación y documentos disponibles. |

## Integridad y concurrencia

- Dinero en numeric con precisión definida y moneda PEN en v1; no usar flotantes para cálculos monetarios.
- FK y restricciones de unicidad protegen relaciones; checks validan cantidades, stock y estados. La pertenencia entre entidades se refuerza con claves compuestas o validaciones transaccionales en la implementación.
- Crear pedido, ítems y reservas y descontar stock disponible en **una transacción y conexión**. Bloquear productos en orden estable para reducir interbloqueos; aplicar reintentos limitados ante conflictos recuperables.
- Consumir la reserva después del pago no vuelve a descontar stock. Liberarla lo reintegra una sola vez mediante transición condicionada.
- La clave de creación es única por empresa compradora y operación; el hash detecta contenido distinto. Solo se permite un intento de pago en curso por pedido, con referencias estables y reconciliación antes de otro intento.
- La aceptación de una oferta debe ser exclusiva y repetible sin crear otro pedido. Los cobros tardíos y reembolsos requieren seguimiento, no eliminación de registros.

## Acceso entre empresas

| Datos | Acceso autorizado |
|---|---|
| Catálogo publicado | Compradores consultan productos de proveedores de otras empresas. |
| Solicitud de cotización | Comprador propietario y proveedores destinatarios; cada proveedor ve su propia respuesta, no las ofertas privadas de competidores. |
| Pedido y entrega | Empresa compradora y proveedora participantes, con permisos distintos. |
| Pagos y documentos privados | Solo la información necesaria para el participante autorizado y administración con permiso. |
| Auditoría | Acceso administrativo restringido y acciones registradas. |

No se aplica un filtro universal tenant_id del usuario a toda consulta. Las tablas hijas heredan autorización del recurso padre; los permisos se verifican también en accesos por identificador.

## Índices y validación propuesta

Índices iniciales: productos por proveedor/categoría, pedidos por empresa compradora/proveedor y fecha, reservas por estado/vencimiento, pagos por pedido/referencia, outbox por estado/próximo intento. Las búsquedas de texto se evaluarán con PostgreSQL y datos representativos antes de agregar otro motor.

Se probarán restricciones, restauración, acceso entre empresas, reintentos y sobreventa. Para EQ-06 se cuentan unidades y pedidos mediante la relación pedidos → pedido_items; producto_id no es una columna de pedidos.
