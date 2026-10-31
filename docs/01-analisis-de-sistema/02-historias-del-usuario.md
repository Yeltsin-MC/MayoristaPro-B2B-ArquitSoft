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
| HU-08 | Como proveedor, quiero cargar mi catálogo por bloques mediante CSV/Excel, revisar errores y confirmar una vista previa, para registrar o actualizar mis productos sin cargarlos uno por uno. | Alta |
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

## Criterios de aceptación resumidos

Estos criterios describen el comportamiento esperado; su implementación y verificación corresponden a los siguientes sprints. La prioridad orienta el trabajo y no significa que la funcionalidad ya esté construida.

| Historia | Resultado esperado |
|---|---|
| HU-01 | RUC y datos comerciales válidos; proveedor pendiente de verificación. |
| HU-02 | Registro de la empresa compradora con RUC y datos de contacto. |
| HU-03 | Credenciales válidas y acceso según rol y empresa. |
| HU-04 | El administrador aprueba, rechaza o solicita información adicional. |
| HU-05 | Solo un proveedor autorizado publica productos propios con los campos obligatorios. |
| HU-06 | Rangos de cantidad sin superposición y precio aplicable al volumen solicitado. |
| HU-07 | Solo el proveedor propietario modifica el producto; los pedidos conservan el precio aceptado. |
| HU-08 | Vista previa por SKU propio, errores por fila y confirmación transaccional de un lote válido sin duplicados. |
| HU-09 | Resultados filtrables por nombre, categoría, precio y proveedor. |
| HU-10 | Comparación de hasta cinco proveedores con precio, disponibilidad y condiciones. |
| HU-11 | Solicitud con productos, cantidades y proveedores destinatarios. |
| HU-12 | Cada proveedor responde con sus precios por ítem y condiciones de entrega. |
| HU-13 | El comprador compara respuestas y acepta una oferta vigente. |
| HU-14 | Lista ordenada con criterios explicables; consulta manual disponible si falla la recomendación. |
| HU-15 | Pedido de un comprador y un proveedor; revalidación de presentación, mínimo, múltiplo, precio y stock dentro de la transacción. |
| HU-16 | Consulta de estados: pendiente, confirmado, en preparación, despachado, entregado y cancelado. |
| HU-17 | El proveedor solo gestiona pedidos en los que participa y transiciones permitidas. |
| HU-18 | Pago externo confirmado mediante notificación verificada o consulta; duplicados no generan otro cobro o actualización. |
| HU-19 | Solicitud al PSE y registro del estado, XML y CDR cuando estén disponibles. |
| HU-20 | Registro de transportista, guía y fecha estimada para un pedido propio. |
| HU-21 | Solo el comprador del pedido confirma la recepción o registra una incidencia. |
| HU-22 | Puntuación de 1 a 5 y comentario vinculados a un pedido recibido. |
| HU-23 | Incidencia con tipo, descripción y pedido relacionado; evidencias cuando corresponda. |
| HU-24 | Seguimiento administrativo con estado y registro de actuaciones. |
| HU-25 | Indicadores de pedidos, ventas, proveedores e incidencias filtrados por período. |
