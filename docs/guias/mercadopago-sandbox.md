# Mercado Pago real en modo prueba (sandbox)

MayoristaPro tiene dos formas de cobrar un pedido:

| Modo | Cuándo se usa | Qué ve el comprador |
|---|---|---|
| **Pago de prueba simulado** | No hay `MP_ACCESS_TOKEN` (valor por defecto) | Página propia con Tarjeta, Yape y PagoEfectivo (CIP). No sale de MayoristaPro. |
| **Mercado Pago real (sandbox)** | `MP_ACCESS_TOKEN` con un token de prueba `TEST-…` | Checkout Pro de Mercado Pago. Al volver, el pedido se confirma solo. |

Usar la API y el sandbox de Mercado Pago es **gratis**. Mercado Pago solo cobra comisión por pagos reales aprobados con credenciales de producción.

## Cómo se confirma el pago

1. **Al volver del checkout:** Mercado Pago redirige a `/pago-mercadopago?payment_id=…&external_reference=…`. La API consulta ese pago a Mercado Pago (`POST /api/v1/payments/mercadopago/confirm`), valida pedido, empresa, moneda y monto, y marca el pedido como pagado. **Funciona en localhost.**
2. **Webhook:** Mercado Pago avisa a `/api/v1/webhooks/mercadopago` aunque el comprador cierre la pestaña. Solo funciona con una dirección pública HTTPS (el despliegue en AWS), porque Mercado Pago no puede llegar a `localhost`. La API registra la URL del webhook en la preferencia solo cuando `API_URL` es HTTPS.

Los dos caminos usan la misma lógica: repetir una notificación no cambia nada.

## Paso a paso (laptop, puerto 3300)

1. Entra a [Mercado Pago Developers Perú](https://www.mercadopago.com.pe/developers) con una cuenta de Mercado Pago (gratis).
2. **Tus integraciones → Crear aplicación.** Elige pagos en línea con **Checkout Pro**.
3. En la aplicación, abre **Cuentas de prueba** y crea dos: un **vendedor** y un **comprador** (país: Perú). Anota sus usuarios y contraseñas en un lugar seguro, fuera del repositorio.
4. Abre **Credenciales de prueba** y copia el **Access Token** (empieza con `TEST-`).
5. En la carpeta del proyecto, abre el archivo `.env` (créalo si no existe) y agrega una línea:

   ```
   MP_ACCESS_TOKEN=TEST-pega-aqui-tu-token
   ```

   El archivo `.env` está en `.gitignore`: **no se sube a GitHub**. No pegues el token en chats ni en documentos.
6. Reinicia la demo: `Ctrl + C` en su terminal y luego `npm run demo:catalog:api`.
7. Ingresa como compradora, crea un pedido y pulsa **Pagar**. Te lleva a Mercado Pago.
8. En el checkout, ingresa con el **comprador de prueba**. Lo mejor es usar una ventana de incógnito, para no mezclarlo con tu cuenta real. Paga con una tarjeta de prueba:

   | Tarjeta | Número | CVV | Vencimiento |
   |---|---|---|---|
   | Visa | 4009 1753 3280 6176 | 123 | 11/30 |
   | Mastercard | 5031 7557 3453 0604 | 123 | 11/30 |

   El **nombre del titular** decide el resultado: `APRO` = aprobado, `OTHE` = rechazado, `CONT` = pendiente. Documento: DNI `12345678`.
9. Al terminar, pulsa **Volver al sitio**. En localhost no hay regreso automático. MayoristaPro muestra «¡Pago aprobado por Mercado Pago!» y el pedido queda pagado.
   Si Mercado Pago no muestra «Volver al sitio», abre el pedido en MayoristaPro y pulsa **Ya pagué en Mercado Pago: verificar**. La API busca el pago por su referencia y lo confirma.

> **Ojo con tu cuenta real:** si el checkout muestra tu nombre, estás con tu cuenta real y el pago de prueba falla. Abre el enlace del pago (`https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=…`) en una ventana de incógnito e ingresa con el comprador de prueba. Desde 2026 el token de prueba puede empezar con `APP_USR-` en lugar de `TEST-`; los dos sirven.

Si cambian las tarjetas o los pasos, consulta la [documentación de pruebas de Checkout Pro](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro/integration-test).

### Volver al pago simulado

Borra la línea `MP_ACCESS_TOKEN` del `.env`, o ponle `#` adelante, y reinicia la demo. Es el plan B de la exposición si falla internet o Mercado Pago.

## En el despliegue (AWS, HTTPS)

1. En `.env.demo` del servidor: `MP_ACCESS_TOKEN=TEST-…`. `PUBLIC_BASE_URL` ya es `https://mayoristapro.shop`, así que se activan el regreso automático y el webhook.
2. En la aplicación de Mercado Pago, en **Webhooks**, configura la URL `https://mayoristapro.shop/api/v1/webhooks/mercadopago` con el evento **Pagos**. Copia la **clave secreta** en `MP_WEBHOOK_SECRET` para que la API verifique la firma `x-signature`.
3. Reinicia los contenedores.
