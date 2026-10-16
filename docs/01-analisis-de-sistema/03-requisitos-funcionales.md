# Requisitos Funcionales

| ID | Requisito | Módulo | Prioridad |
|---|---|---|---|
| RF-01 | El sistema debe permitir el registro de proveedores mayoristas con validación de RUC contra SUNAT. | Usuarios | Alta |
| RF-02 | El sistema debe permitir el registro de compradores empresariales con validación de RUC contra SUNAT. | Usuarios | Alta |
| RF-03 | El sistema debe autenticar usuarios mediante email y contraseña con token JWT. | Usuarios | Alta |
| RF-04 | El sistema debe asignar permisos diferenciados según el rol del usuario (proveedor, comprador, administrador). | Usuarios | Alta |
| RF-05 | El sistema debe permitir al administrador verificar y aprobar proveedores antes de que operen. | Proveedores | Alta |
| RF-06 | El sistema debe permitir al proveedor consultar su historial de ventas, pedidos y evaluaciones. | Proveedores | Media |
| RF-07 | El sistema debe permitir al proveedor publicar productos con nombre, descripción, categoría, precio, stock e imágenes. | Productos | Alta |
| RF-08 | El sistema debe permitir al proveedor definir precios diferenciados por rango de cantidad. | Productos | Alta |
| RF-09 | El sistema debe permitir al proveedor actualizar precios, stock y características de sus productos. | Productos | Alta |
| RF-10 | El sistema debe permitir al proveedor cargar múltiples productos mediante archivo CSV/Excel. | Productos | Media |
| RF-11 | El sistema debe permitir buscar productos por nombre, categoría, rango de precio y proveedor. | Búsqueda | Alta |
| RF-12 | El sistema debe permitir comparar hasta 5 proveedores para un mismo producto. | Búsqueda | Alta |
| RF-13 | El sistema debe permitir al comprador solicitar cotización a uno o varios proveedores. | Cotizaciones | Alta |
| RF-14 | El sistema debe permitir al proveedor responder cotizaciones con precio, disponibilidad y condiciones de entrega. | Cotizaciones | Alta |
| RF-15 | El sistema debe permitir al comprador comparar cotizaciones recibidas y aceptar una. | Cotizaciones | Alta |
| RF-16 | El sistema debe generar recomendaciones de proveedores mediante IA según precio, disponibilidad, ubicación e historial. | IA | Alta |
| RF-17 | El sistema debe permitir consultar y comparar proveedores aunque el servicio de IA no esté disponible. | IA | Media |
| RF-18 | El sistema debe permitir al comprador confirmar un pedido a partir de una cotización aceptada. | Pedidos | Alta |
| RF-19 | El sistema debe validar stock y aplicar control de concurrencia antes de confirmar un pedido. | Pedidos | Alta |
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
| RF-38 | El sistema debe soportar 2,000 usuarios concurrentes sin degradación significativa. | Rendimiento | Alta |
| RF-39 | El sistema debe preservar la integridad del stock ante operaciones simultáneas. | Rendimiento | Alta |
| RF-40 | El sistema debe permitir pruebas de carga para evaluar rendimiento, concurrencia y estabilidad. | Rendimiento | Media |

---

## Detalle por módulo

### Módulo de usuarios (RF-01 a RF-04)
Gestión completa del ciclo de vida de usuarios: registro con validación de RUC, autenticación con JWT y autorización basada en roles. Los permisos se diferencian según el tipo de usuario (proveedor, comprador o administrador).

### Módulo de proveedores (RF-05 a RF-06)
Verificación de proveedores por parte del administrador antes de que puedan operar. El proveedor puede consultar su historial comercial, pedidos y evaluaciones recibidas.

### Módulo de productos (RF-07 a RF-10)
Publicación y gestión de productos con precios diferenciados por volumen. Se soporta carga manual y carga masiva mediante CSV/Excel.

### Módulo de búsqueda y comparación (RF-11 a RF-12)
Búsqueda con filtros múltiples y comparación de hasta 5 proveedores para un mismo producto, mostrando precio, disponibilidad, tiempo de entrega y reputación.

### Módulo de cotizaciones (RF-13 a RF-15)
Flujo completo de cotización: solicitud del comprador, respuesta del proveedor, comparación de ofertas y aceptación de una cotización.

### Módulo de IA (RF-16 a RF-17)
Recomendación de proveedores basada en precio, disponibilidad, ubicación e historial de cumplimiento. El sistema debe mantener funcionalidad de consulta y comparación incluso si el servicio de IA no está disponible (fallback).

### Módulo de pedidos (RF-18 a RF-21)
Confirmación de pedidos con validación de stock y control de concurrencia para evitar sobreventa. Gestión de estados del pedido y consulta de historial.

### Módulo de pagos (RF-22 a RF-24)
Integración con pasarela de pago externa. La plataforma no almacena fondos ni datos de tarjetas. Registro y consulta del estado de cada pago.

### Módulo de facturación (RF-25)
Integración con PSE externo para emisión automática de comprobantes electrónicos ante SUNAT.

### Módulo de entregas (RF-26 a RF-27)
Registro de despacho por parte del proveedor y confirmación de recepción por parte del comprador.

### Módulo de reputación (RF-28)
Evaluación del proveedor por parte del comprador tras la recepción del pedido.

### Módulo de incidencias (RF-29 a RF-30)
Registro de incidencias por parte del comprador y gestión por parte del administrador.

### Módulo de administración y reportes (RF-31 a RF-33)
Panel administrativo con supervisión de operaciones, generación de reportes y dashboards con indicadores clave.

### Módulo de notificaciones (RF-34)
Notificaciones multicanal (email y WhatsApp) ante eventos relevantes del flujo comercial.

### Seguridad y rendimiento (RF-35 a RF-40)
Autenticación, autorización, auditoría y trazabilidad. Soporte para 2,000 usuarios concurrentes con integridad de stock ante operaciones simultáneas. Pruebas de carga para validar rendimiento.
