# Invariantes del flujo comercial

## Identidad y autorización

El RUC identifica a una empresa. T2 comprueba formato y unicidad; la consulta externa SUNAT queda pendiente de confirmación para otra entrega. El acceso a una empresa existente requiere una vinculación autorizada. El registro público no acepta asignaciones de administrador ni vincula automáticamente una cuenta por coincidencia de RUC. D1 aprobada: administración revisa el alta y la evidencia ficticia de la demo; después, el responsable invita y revoca usuarios. La empresa puede comprar y vender, con permisos por usuario. Habilitarla para comprar y verificarla como proveedor son decisiones separadas. Se informa «revisado manualmente». Véase [T2](../sprint-2-identidad.md).

| Operación | Autorización mínima |
|---|---|
| Catálogo público | Ofertas publicadas de proveedores verificados. |
| Importación y ajuste de inventario | Usuario autorizado del proveedor dueño del SKU. |
| Cotización | Empresa compradora propietaria y proveedores destinatarios. Cada proveedor ve su propia oferta. |
| Aceptación, pedido y pago | Comprador participante con permiso de escritura. El proveedor participante consulta y atiende según estado. |
| Reembolso y auditoría | Administración con permiso específico. |
| Webhook | Autenticación del proveedor y verificación del recurso; sin sesión de comprador. |

Resolver empresa y permisos en el servidor en cada operación protegida. Probar un comprador ajeno, otro proveedor destinatario, un proveedor no verificado y la revocación de acceso.

## Cotización e inventario

La aceptación bloquea la solicitud, comprueba la respuesta, pertenencia y vigencia y permite una sola oferta aceptada. Repetir la misma aceptación devuelve el resultado existente. Aceptar otra oferta en la misma solicitud devuelve conflicto mientras exista una aceptación. El cambio o reapertura posterior se define en D2.

El pedido exige una oferta aceptada y guarda sus condiciones. La misma transacción revalida la elegibilidad, agrupa cantidades por SKU para reservar, bloquea productos en orden estable y guarda pedido, ítems y reservas. Ante falta de stock, modificación incompatible o fallo, revierte todo. El precio pactado se toma de la oferta. PostgreSQL confirma el stock disponible. Consumir la reserva no vuelve a descontar inventario; liberarla devuelve unidades una sola vez.

Los lotes CSV/XLSX tienen plantilla, errores por fila, vista previa con vencimiento y confirmación atómica. Al confirmar se verifica la vigencia, la titularidad y si cambió un dato relevante del SKU desde la vista previa. Un conflicto devuelve el lote al flujo de revisión. La importación de metadatos preserva existencias; el ajuste autorizado registra actor y motivo y se coordina con las reservas. La política de precios, redondeo e impuestos se decide en D4.

## Repeticiones y pagos

| Operación | Identidad de la repetición |
|---|---|
| Crear pedido | Empresa compradora, operación y clave; la oferta aceptada también tiene unicidad propia. |
| Confirmar importación | Proveedor, operación, lote y clave; cada lote se aplica una sola vez. |
| Iniciar pago o reembolso | Pedido, operación y clave, con el actor autorizado nuevamente en cada llamada. |
| Notificación | Pasarela e identificador verificable según el perfil. Además, bloquear el intento y aplicar transiciones condicionadas frente a eventos diferentes para el mismo recurso. |

El servidor guarda la huella del contenido para distinguir reintento de conflicto. Para un pago, persiste el intento y su referencia antes de llamar a Mercado Pago. Se admite un intento activo por pedido. Un timeout deja el resultado incierto y obliga a reconciliar antes de iniciar otro. Nunca se mantiene un bloqueo SQL durante HTTP externo.

| Evento | Resultado técnico |
|---|---|
| Retorno del navegador | Mostrar estado consultado a MayoristaPro. |
| Notificación válida o reconciliación | Verificar el recurso con la pasarela, incluida referencia, monto, moneda y estado. Guardar resultado definitivo y cambios de pedido, reserva y outbox juntos cuando corresponda. |
| Aprobado con reserva activa y pedido pendiente | Confirmar y consumir una sola vez. |
| Incierto, incluso al vencer la reserva | Conservar tarea durable de reconciliación y bloquear nuevos intentos hasta resolver el estado. |
| Rechazo definitivo | Registrar rechazo. La liberación o el reintento siguen la política D3. |
| Cobro posterior a liberación o cancelación | Registrar y escalar a reconciliación. No confirmar el pedido sin inventario comprometido. |
| Reembolso solicitado | Registrar solicitud y confirmar el resultado consultado a la pasarela antes de marcar reembolsado. |

La recuperación requiere tareas durables y repetibles. El consumidor reconoce duplicados y comprueba las precondiciones de cada transición. El perfil de Checkout Pro, identificador de evento, verificación de firma, reintentos y redirección se verifican con documentación y credenciales de prueba. [Documentación de notificaciones de Mercado Pago](https://www.mercadopago.com.pe/developers/en/docs/checkout-pro-orders/notifications)

Las decisiones D1–D4 están en el [registro de preparación](../05-preparacion-sprint-2.md).
