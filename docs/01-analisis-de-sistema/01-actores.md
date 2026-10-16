# Actores

| Actor | ¿Qué necesita realizar? |
|---|---|
| Proveedor mayorista | Registrarse con RUC, publicar productos con precios por volumen, responder cotizaciones, gestionar pedidos y despachos, consultar ventas y evaluaciones. |
| Comprador empresarial | Registrarse con RUC, buscar productos y proveedores, solicitar cotizaciones, comparar ofertas, confirmar pedidos, pagar y hacer seguimiento de entregas. |
| Administrador | Gestionar usuarios, verificar proveedores, supervisar operaciones, gestionar incidencias, consultar reportes y dashboards. |
| SUNAT / PSE | Validar RUC de empresas y emitir comprobantes electrónicos (facturas y boletas). |
| Pasarela de pago | Procesar pagos de compradores a proveedores mediante tarjeta. |
| Servicio de IA | Generar recomendaciones de proveedores según precio, disponibilidad, ubicación e historial. |
| Servicio de notificaciones | Enviar alertas por email y WhatsApp sobre cotizaciones, pedidos, pagos y entregas. |
| Servicio de mapas | Proporcionar geolocalización de proveedores y cálculo de distancias para el flete. |

---

## Clasificación de actores

Los actores se dividen en dos grupos:

- **Actores humanos:** Proveedor mayorista, Comprador empresarial, Administrador.
- **Sistemas externos:** SUNAT/PSE, Pasarela de pago, Servicio de IA, Servicio de notificaciones, Servicio de mapas.

Los actores humanos interactúan directamente con la plataforma mediante la interfaz web. Los sistemas externos se integran mediante APIs REST y webhooks.

---

## Detalle de actores humanos

### Proveedor mayorista

Empresa dedicada a la venta al por mayor, ubicada en Lima, Ayacucho u otras regiones del país. Su objetivo es ampliar su alcance comercial y recibir cotizaciones de compradores empresariales sin necesidad de una fuerza de ventas presencial.

Ejemplos: distribuidoras mayoristas, importadores directos, fabricantes, mayoristas regionales.

### Comprador empresarial

Negocio que adquiere productos al por mayor para revenderlos o utilizarlos como insumo. No es consumidor final.

Ejemplos: bodegas, librerías, minimarkets, restaurantes, ferreterías.

Su objetivo es encontrar proveedores confiables, comparar precios y abastecerse de forma rápida y segura.

### Administrador

Responsable de la operación, supervisión y gestión de la plataforma. Verifica proveedores, resuelve incidencias y monitorea los indicadores del sistema.

---

## Detalle de sistemas externos

### SUNAT / PSE

Servicio externo que permite validar el RUC de las empresas registradas y emitir comprobantes electrónicos (facturas y boletas) cumpliendo con la normativa tributaria peruana. Se integra mediante un Proveedor de Servicios Electrónicos (PSE) como NubeFacT o Alanube.

### Pasarela de pago

Servicio externo encargado de procesar los pagos de los compradores. La plataforma no almacena fondos ni datos de tarjetas. Se integra con Niubiz o Mercado Pago mediante API REST y webhooks.

### Servicio de IA

Servicio que genera recomendaciones de proveedores según precio, disponibilidad, ubicación e historial de cumplimiento. En v1 se implementa como módulo interno del backend (NestJS) con motor de reglas basado en Scikit-learn ejecutado como proceso Python; en v2 se prevé integración con API externa de IA.

### Servicio de notificaciones

Servicio que envía alertas a los usuarios por email y WhatsApp sobre eventos relevantes: nuevas cotizaciones, pedidos confirmados, pagos procesados, despachos y entregas.

### Servicio de mapas

Servicio que proporciona geolocalización de proveedores y cálculo de distancias para estimar el costo y tiempo del flete. Se utiliza OpenStreetMap con MapLibre para evitar costos de licencia.
