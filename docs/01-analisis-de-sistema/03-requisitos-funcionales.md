# Requisitos Funcionales

| ID | Requisito | Módulo | Prioridad |
|---|---|---|---|
| RF-01 | El sistema debe permitir el registro de proveedores mayoristas con validación de RUC contra SUNAT. | Usuarios | Alta |
| RF-02 | El sistema debe permitir el registro de compradores empresariales con validación de RUC contra SUNAT. | Usuarios | Alta |
| RF-03 | El sistema debe autenticar usuarios mediante email y contraseña con token JWT. | Usuarios | Alta |
| RF-04 | El sistema debe asignar permisos diferenciados según el rol del usuario (proveedor, comprador, administrador). | Usuarios | Alta |
| RF-05 | El sistema debe permitir al administrador verificar y aprobar proveedores antes de que operen. | Proveedores | Alta |
| RF-06 | El sistema debe permitir al proveedor consultar su historial de ventas, pedidos y evaluaciones. | Proveedores | Media |
| RF-07 | El sistema debe permitir al proveedor publicar productos con nombre, descripción, categoría, precio, cantidad mínima de compra, stock e imágenes. | Productos | Alta |
| RF-08 | El sistema debe permitir al proveedor definir precios diferenciados por rango de cantidad. | Productos | Alta |
| RF-09 | El sistema debe permitir al proveedor actualizar precios, stock y características de sus productos. | Productos | Alta |
| RF-10 | El sistema debe permitir al proveedor cargar su catálogo por bloques mediante CSV/Excel, revisar errores y confirmar un lote válido sin duplicados. | Productos | Alta |
| RF-11 | El sistema debe permitir buscar productos por nombre, categoría, rango de precio y proveedor. | Búsqueda | Alta |
| RF-12 | El sistema debe permitir comparar hasta 5 proveedores para un mismo producto. | Búsqueda | Alta |
| RF-13 | El sistema debe permitir al comprador solicitar cotización a uno o varios proveedores. | Cotizaciones | Alta |
| RF-14 | El sistema debe permitir al proveedor responder cotizaciones con precio, disponibilidad y condiciones de entrega. | Cotizaciones | Alta |
| RF-15 | El sistema debe permitir al comprador comparar cotizaciones recibidas y aceptar una. | Cotizaciones | Alta |
| RF-16 | El sistema debe generar recomendaciones de proveedores mediante IA según precio, disponibilidad, ubicación e historial. | IA | Alta |
| RF-17 | El sistema debe permitir consultar y comparar proveedores aunque el servicio de IA no esté disponible. | IA | Media |
| RF-18 | El sistema debe permitir al comprador confirmar un pedido a partir de una cotización aceptada. | Pedidos | Alta |
| RF-19 | El sistema debe revalidar presentación, mínimo, múltiplo y stock y aplicar control de concurrencia al crear un pedido. | Pedidos | Alta |
| RF-20 | El sistema debe gestionar los estados del pedido: Pendiente, Confirmado, En preparación, Despachado, Entregado, Cancelado. | Pedidos | Alta |
| RF-21 | El sistema debe permitir al comprador y proveedor consultar el estado e historial de pedidos. | Pedidos | Alta |
| RF-22 | El sistema debe integrarse con pasarela de pago externa para procesar transacciones. | Pagos | Alta |
| RF-23 | El sistema no debe almacenar fondos ni datos completos de tarjetas. | Pagos | Alta |
| RF-24 | El sistema debe registrar y consultar el estado de pagos: Pendiente, Autorizado, Pagado, Rechazado, Cancelado, Reembolsado. | Pagos | Alta |
| RF-25 | El sistema debe integrarse con un PSE externo para emitir comprobantes electrónicos (facturas y boletas). | Facturación | Alta |
| RF-26 | El sistema debe permitir al proveedor registrar información de despacho (transportista, guía, fecha estimada). | Entregas | Media |
| RF-27 | El sistema debe permitir al comprador confirmar la recepción del pedido. | Entregas | Media |
| RF-28 | El sistema debe permitir al comprador evaluar al proveedor después de recibir el pedido. | Reputación | Media |
| RF-29 | El sistema debe permitir registrar incidencias relacionadas con productos, pagos, pedidos o entregas. | Incidencias | Media |
| RF-30 | El sistema debe permitir al administrador consultar y dar seguimiento a las incidencias. | Incidencias | Media |
| RF-31 | El sistema debe proporcionar un panel administrativo para supervisar usuarios, proveedores, productos y operaciones. | Administración | Media |
| RF-32 | El sistema debe generar reportes de ventas, productos más solicitados y comportamiento de pedidos. | Reportes | Media |
| RF-33 | El sistema debe proporcionar dashboards con indicadores clave para proveedores y administradores. | Reportes | Media |
| RF-34 | El sistema debe enviar notificaciones por email y WhatsApp ante eventos relevantes. | Notificaciones | Media |
| RF-35 | El sistema debe implementar autenticación, autorización, auditoría y protección de la información comercial. | Seguridad | Alta |
| RF-36 | El sistema debe registrar las operaciones relevantes para fines de auditoría y trazabilidad. | Seguridad | Alta |
| RF-37 | El sistema debe ser web y responsive, accesible desde computadoras y dispositivos móviles. | Rendimiento | Alta |
| RF-38 | El sistema debe soportar 2,000 usuarios concurrentes como objetivo de validación mediante pruebas de carga. | Rendimiento | Alta |
| RF-39 | El sistema debe preservar la integridad del stock ante operaciones simultáneas. | Rendimiento | Alta |
| RF-40 | El sistema debe permitir pruebas de carga para evaluar rendimiento, concurrencia y estabilidad. | Rendimiento | Media |

## Relación entre historias y requisitos

La carga masiva es parte del núcleo inicial. Las reglas de presentación, mínimos, múltiplos y tarjetas recomendadas se detallan en [operación mayorista](../03-diseno-de-software/reglas-comerciales-mayoristas.md). Los IDs existentes se conservan.

| Historia | Funcionalidad | Requisitos relacionados |
|---|---|---|
| HU-01 | Registro de proveedor | RF-01 |
| HU-02 | Registro de comprador | RF-02 |
| HU-03 | Inicio de sesión | RF-03, RF-04, RF-35 |
| HU-04 | Verificación de proveedor | RF-05 |
| HU-05 | Publicación de productos | RF-07 |
| HU-06 | Precios por volumen | RF-08 |
| HU-07 | Actualización de productos | RF-09 |
| HU-08 | Carga masiva | RF-10 |
| HU-09 | Búsqueda de productos | RF-11 |
| HU-10 | Comparación de proveedores | RF-12 |
| HU-11 | Solicitud de cotización | RF-13 |
| HU-12 | Respuesta a cotización | RF-14 |
| HU-13 | Comparación y aceptación de ofertas | RF-15 |
| HU-14 | Recomendación de proveedores | RF-16, RF-17 |
| HU-15 | Confirmación de pedido | RF-18, RF-19, RF-39 |
| HU-16 | Consulta de pedidos del comprador | RF-20, RF-21 |
| HU-17 | Gestión de pedidos del proveedor | RF-06, RF-20, RF-21 |
| HU-18 | Pago externo y consulta de estado | RF-22, RF-23, RF-24 |
| HU-19 | Comprobante electrónico | RF-25 |
| HU-20 | Registro de despacho | RF-26 |
| HU-21 | Confirmación de recepción | RF-27 |
| HU-22 | Evaluación del proveedor | RF-28 |
| HU-23 | Registro de incidencia | RF-29 |
| HU-24 | Seguimiento de incidencias | RF-30 |
| HU-25 | Panel e indicadores administrativos | RF-31, RF-32, RF-33 |

### Requisitos transversales

| Requisitos | Aplicación |
|---|---|
| RF-04, RF-35 | Control de acceso por rol, empresa y participación en cada operación protegida. |
| RF-34 | Avisos asociados a cotizaciones, pedidos, pagos y entregas; complementa las historias de esos procesos. |
| RF-36 | Registro de operaciones relevantes para auditoría en los distintos módulos. |
| RF-37 | Interfaz web responsive para las historias que se realizan desde el navegador. |
| RF-38, RF-40 | Objetivo de concurrencia y pruebas de carga aplicables al conjunto del sistema. |

## Precisiones de alcance

- RF-37 a RF-40 se conservan con sus identificadores para mantener la trazabilidad, aunque describen cualidades y verificación del sistema. Sus medidas se desarrollan en los escenarios de calidad.
- Cada pedido corresponde a un comprador y un proveedor. Los precios y condiciones aceptados se conservan aunque el catálogo cambie.
- Los requisitos son el alcance documentado; las prioridades y dependencias definirán el orden de implementación. Las integraciones de pagos y facturación se probarán primero en sandbox.
