# Historias de Usuario

| ID | Historia de usuario | Prioridad |
|---|---|---|
| HU-01 | Como proveedor mayorista, quiero registrarme con mi RUC y datos comerciales, para publicar mis productos y recibir cotizaciones. | Alta |
| HU-02 | Como comprador empresarial, quiero registrarme con mi RUC y datos del negocio, para buscar proveedores y solicitar cotizaciones. | Alta |
| HU-03 | Como usuario registrado, quiero iniciar sesión con mi email y contraseña, para acceder a las funcionalidades según mi rol. | Alta |
| HU-04 | Como administrador, quiero verificar y aprobar proveedores antes de que operen, para garantizar la confianza en la plataforma. | Alta |
| HU-05 | Como proveedor, quiero publicar productos con nombre, descripción, categoría, precio, stock e imágenes, para ofrecerlos a compradores empresariales. | Alta |
| HU-06 | Como proveedor, quiero definir precios diferenciados según la cantidad solicitada, para incentivar compras al por mayor. | Alta |
| HU-07 | Como proveedor, quiero actualizar precios, stock y características de mis productos, para mantener la información vigente. | Alta |
| HU-08 | Como proveedor, quiero subir múltiples productos mediante archivo CSV/Excel, para reducir el tiempo de carga de mi catálogo. | Media |
| HU-09 | Como comprador empresarial, quiero buscar productos por nombre, categoría, precio o proveedor, para encontrar lo que necesito rápidamente. | Alta |
| HU-10 | Como comprador empresarial, quiero comparar varios proveedores para un mismo producto, para elegir la mejor oferta. | Alta |
| HU-11 | Como comprador empresarial, quiero solicitar cotización a uno o varios proveedores, para obtener precios y condiciones antes de comprar. | Alta |
| HU-12 | Como proveedor, quiero responder cotizaciones indicando precio, disponibilidad y condiciones, para ofrecer mis productos. | Alta |
| HU-13 | Como comprador empresarial, quiero comparar las cotizaciones recibidas, para elegir la mejor opción antes de confirmar un pedido. | Alta |
| HU-14 | Como comprador empresarial, quiero recibir recomendaciones de proveedores generadas por IA, para identificar rápidamente las mejores opciones. | Alta |
| HU-15 | Como comprador empresarial, quiero confirmar un pedido a partir de una cotización aceptada, para concretar la compra. | Alta |
| HU-16 | Como comprador empresarial, quiero consultar el estado y el historial de mis pedidos, para saber en qué etapa se encuentran. | Alta |
| HU-17 | Como proveedor, quiero consultar y gestionar los pedidos recibidos, para organizar mi despacho y cumplir con los plazos. | Alta |
| HU-18 | Como comprador empresarial, quiero pagar mi pedido mediante una pasarela externa, para completar la transacción de forma segura. | Alta |
| HU-19 | Como proveedor, quiero que el sistema emita automáticamente el comprobante electrónico, para cumplir con las obligaciones tributarias. | Alta |
| HU-20 | Como proveedor, quiero registrar información del despacho, para que el comprador pueda hacer seguimiento. | Media |
| HU-21 | Como comprador empresarial, quiero confirmar la recepción de mi pedido, para cerrar la transacción y evaluar al proveedor. | Media |
| HU-22 | Como comprador empresarial, quiero evaluar al proveedor después de recibir el pedido, para contribuir a su reputación. | Media |
| HU-23 | Como comprador empresarial, quiero registrar incidencias relacionadas con productos, pagos o entregas, para que el administrador tome acción. | Media |
| HU-24 | Como administrador, quiero consultar y dar seguimiento a las incidencias, para resolver conflictos entre compradores y proveedores. | Media |
| HU-25 | Como administrador, quiero visualizar indicadores clave en un dashboard, para supervisar la operación de la plataforma. | Media |

---

## Criterios de aceptación

### Módulo de usuarios

**HU-01 — Registro de proveedor**
- El sistema valida el RUC contra SUNAT.
- El proveedor ingresa razón social, dirección y datos de contacto.
- El registro queda en estado "Pendiente de verificación".

**HU-02 — Registro de comprador**
- El sistema valida el RUC contra SUNAT.
- El comprador ingresa razón social, dirección y datos de contacto.
- El registro queda activo tras validación exitosa.

**HU-03 — Autenticación**
- El sistema valida credenciales.
- Se genera token JWT con expiración.
- Se redirige al panel según el rol.

**HU-04 — Verificación de proveedor**
- El administrador revisa RUC, datos comerciales y documentos.
- Puede aprobar, rechazar o solicitar información adicional.
- El proveedor recibe notificación del resultado.

### Módulo de productos

**HU-05 — Publicación de producto**
- Se ingresan todos los campos obligatorios.
- Se pueden subir hasta 5 imágenes.
- El producto queda en estado "Disponible".

**HU-06 — Precios por volumen**
- Se definen múltiples rangos de cantidad y precio.
- El sistema aplica el precio según la cantidad solicitada.

**HU-07 — Actualización de productos**
- El proveedor edita cualquier campo de sus productos.
- Los cambios se reflejan inmediatamente en el catálogo.

**HU-08 — Carga masiva**
- El sistema proporciona plantilla CSV.
- Se validan los datos antes de cargar.
- Se muestra reporte de productos cargados y errores.

### Módulo de búsqueda y comparación

**HU-09 — Búsqueda de productos**
- Búsqueda por texto libre con tolerancia a errores tipográficos.
- Filtros por categoría, rango de precio y ubicación.

**HU-10 — Comparación de proveedores**
- Se pueden seleccionar hasta 5 proveedores.
- Se muestra precio, disponibilidad, tiempo de entrega y reputación.

### Módulo de cotizaciones

**HU-11 — Solicitud de cotización**
- Se puede solicitar a múltiples proveedores simultáneamente.
- Se especifica producto, cantidad y condiciones requeridas.

**HU-12 — Respuesta a cotización**
- El proveedor ingresa precio final, stock y tiempo de entrega.
- El comprador recibe notificación de la respuesta.

**HU-13 — Comparación de cotizaciones**
- Se muestran todas las cotizaciones en vista comparativa.
- Se ordenan por precio, tiempo o reputación.

### Módulo de IA

**HU-14 — Recomendación de proveedores**
- El sistema considera precio, disponibilidad, ubicación e historial.
- Las recomendaciones se ordenan por relevancia.
- Se muestra la justificación de cada recomendación.

### Módulo de pedidos

**HU-15 — Confirmación de pedido**
- El sistema valida stock antes de confirmar.
- Se aplica control de concurrencia para evitar sobreventa.

**HU-16 — Seguimiento de pedido**
- Estados: Pendiente, Confirmado, En preparación, Despachado, Entregado, Cancelado.
- Se notifica al comprador en cada cambio de estado.

**HU-17 — Gestión de pedidos del proveedor**
- El proveedor ve pedidos pendientes, en preparación y despachados.
- Puede actualizar el estado y registrar despacho.

### Módulo de pagos

**HU-18 — Pago de pedido**
- El pago se procesa en pasarela externa.
- La plataforma no almacena datos de tarjetas.
- Se recibe confirmación vía webhook.

**HU-19 — Emisión de comprobante electrónico**
- El sistema se integra con PSE externo.
- Se emite factura o boleta según tipo de comprador.
- Se almacena el XML y el CDR.

### Módulo de entregas

**HU-20 — Registro de despacho**
- Se registra transportista, número de guía y fecha estimada.
- El comprador recibe notificación.

**HU-21 — Confirmación de recepción**
- El comprador confirma recepción conforme.
- Puede reportar incidencia si el producto no cumple.

### Módulo de reputación

**HU-22 — Evaluación de proveedor**
- Se evalúa con puntuación (1-5) y comentario.
- La evaluación se refleja en el perfil del proveedor.

### Módulo de incidencias

**HU-23 — Registro de incidencia**
- Se especifica tipo, descripción y pedido asociado.
- Se adjuntan evidencias.

**HU-24 — Gestión de incidencias**
- El administrador ve todas las incidencias abiertas.
- Puede cambiar estado, agregar comentarios y resolver.

### Módulo de reportes

**HU-25 — Dashboard administrativo**
- Indicadores: pedidos, ventas, proveedores activos, incidencias.
- Filtros por período.
- Exportación a PDF/Excel.
