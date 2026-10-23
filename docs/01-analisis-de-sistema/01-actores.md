# Actores

MayoristaPro conecta empresas proveedoras con negocios compradores de Ayacucho. No contempla compras grupales entre consumidores.

## Personas que utilizan la plataforma

| Actor | Responsabilidad | Ejemplo |
|---|---|---|
| Proveedor mayorista | Publicar productos, definir precios por volumen, responder cotizaciones y gestionar pedidos y despachos. | Distribuidora de Lima o mayorista de Ayacucho. |
| Comprador empresarial | Buscar y comparar proveedores, solicitar cotizaciones, realizar pedidos y consultar entregas. | Bodega, librería o minimarket de Ayacucho. |
| Administrador | Verificar proveedores, supervisar operaciones y dar seguimiento a incidencias. | Responsable de la plataforma. |

## Servicios con los que se integra

| Servicio | Responsabilidad | Límite de la integración |
|---|---|---|
| Consulta de RUC | Contrastar los datos de la empresa con el padrón de SUNAT mediante el mecanismo disponible. | Proveedor y acceso pendientes de verificar. |
| PSE de facturación | Tramitar comprobantes electrónicos y devolver su estado y documentos. | Integración prevista en entorno de pruebas. |
| Pasarela de pago | Procesar pagos y comunicar su resultado. | MayoristaPro conserva referencias y estados; no custodia fondos ni datos completos de tarjetas. |
| Notificaciones | Enviar avisos sobre cotizaciones, pedidos y entregas. | Email y WhatsApp sujetos a disponibilidad del proveedor. |
| Mapas | Mostrar la ubicación de proveedores. | Los mapas no determinan por sí solos el costo real del transporte. |

## Recomendación de proveedores

Es un componente propio de MayoristaPro, ejecutado en un proceso Python separado y consultado por el backend. En v1 se propone una puntuación por reglas; el uso de un modelo entrenado requiere datos y evaluación. Si falla, la búsqueda y la comparación siguen disponibles. Una API de IA de terceros se considera una evolución futura.

**Ejemplo de interacción:** una librería solicita cotizaciones, compara las respuestas y realiza un pedido a un proveedor verificado. Cada parte consulta la operación que le corresponde.
