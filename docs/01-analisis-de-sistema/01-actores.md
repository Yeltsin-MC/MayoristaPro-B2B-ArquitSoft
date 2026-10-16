# Actores del Sistema

Este documento identifica los actores que interactúan con MayoristaPro B2B, sus responsabilidades y sus interacciones principales con la plataforma.

---

## 1. Proveedor Mayorista

**Descripción:**
Empresa que vende productos al por mayor. Puede estar ubicada en Lima, Ayacucho u otras regiones del Perú.

**Ejemplos:**
- Distribuidoras mayoristas (Stanford, Tai Loy, Artesco)
- Importadores directos
- Fabricantes
- Mayoristas regionales

**Responsabilidades en la plataforma:**
- Registrarse y pasar por verificación de RUC.
- Publicar productos con precios diferenciados por volumen.
- Definir cantidades mínimas de compra y stock disponible.
- Responder solicitudes de cotización.
- Gestionar pedidos y despachos.
- Actualizar disponibilidad y precios.

**Interacciones principales:**
- Publicar producto
- Responder cotización
- Confirmar pedido
- Registrar despacho
- Consultar reportes de ventas

---

## 2. Comprador Empresarial

**Descripción:**
Negocio que compra productos al por mayor para revender o usar como insumo. No es consumidor final.

**Ejemplos:**
- Bodegas
- Librerías
- Minimarkets
- Restaurantes
- Ferreterías

**Responsabilidades en la plataforma:**
- Registrarse y validar RUC.
- Buscar productos y proveedores.
- Solicitar cotizaciones a uno o varios proveedores.
- Comparar ofertas (precio, tiempo, reputación).
- Confirmar pedidos y realizar pagos.
- Hacer seguimiento de entregas.
- Evaluar proveedores.

**Interacciones principales:**
- Buscar producto
- Solicitar cotización
- Comparar cotizaciones
- Confirmar pedido
- Realizar pago
- Confirmar recepción
- Evaluar proveedor

---

## 3. Administrador de Plataforma

**Descripción:**
Responsable de la operación y supervisión de MayoristaPro.

**Responsabilidades en la plataforma:**
- Gestionar usuarios, proveedores y compradores.
- Verificar y aprobar proveedores.
- Supervisar operaciones comerciales.
- Gestionar incidencias y reclamos.
- Consultar reportes y dashboards.
- Configurar categorías y parámetros del sistema.

**Interacciones principales:**
- Aprobar proveedor
- Gestionar incidencia
- Consultar dashboard
- Generar reporte
- Supervisar operaciones

---

## 4. Sistema Externo: SUNAT / PSE

**Descripción:**
Servicio externo que valida RUC y emite comprobantes electrónicos.

**Interacciones:**
- Validación de RUC de proveedores y compradores.
- Emisión de facturas y boletas electrónicas.
- Envío de CDR (Constancia de Recepción).

---

## 5. Sistema Externo: Pasarela de Pagos

**Descripción:**
Servicio externo que procesa pagos de compradores a proveedores.

**Interacciones:**
- Procesamiento de pagos con tarjeta.
- Notificación de pago exitoso/fallido vía webhook.
- Reembolsos cuando corresponda.

---

## 6. Sistema Externo: Servicio de IA

**Descripción:**
Servicio que genera recomendaciones de proveedores según criterios comerciales.

**Interacciones:**
- Análisis de necesidades del comprador.
- Evaluación de proveedores por precio, disponibilidad, ubicación e historial.
- Generación de recomendaciones ordenadas.

---

## 7. Sistema Externo: Servicio de Notificaciones

**Descripción:**
Servicio que envía alertas por email y WhatsApp.

**Interacciones:**
- Notificar cotización recibida.
- Notificar pedido confirmado.
- Notificar pago procesado.
- Notificar despacho y entrega.

---

## Resumen de actores

| Actor | Tipo | Interacción principal |
|---|---|---|
| Proveedor mayorista | Humano | Publica productos, responde cotizaciones |
| Comprador empresarial | Humano | Busca, cotiza, compra |
| Administrador | Humano | Supervisa y gestiona |
| SUNAT / PSE | Sistema externo | Valida RUC, emite comprobantes |
| Pasarela de pagos | Sistema externo | Procesa pagos |
| Servicio de IA | Sistema externo | Genera recomendaciones |
| Servicio de notificaciones | Sistema externo | Envía alertas |
