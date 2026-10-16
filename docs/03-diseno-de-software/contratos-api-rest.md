# Contratos de API REST

> **Proyecto:** MayoristaPro B2B  
> **Backend:** NestJS · **Versión API:** v1  
> **Base URL:** `https://api.mayoristapro.pe/api/v1`  
> **Relacionado con:** ADR-011 (API-First), RF-01 a RF-40

---

## Convenciones generales

| Aspecto | Decisión |
|---|---|
| Autenticación | Bearer token JWT en header `Authorization: Bearer <token>` |
| Formato | JSON (`Content-Type: application/json`) |
| Paginación | Query params `page` (default: 1) y `limit` (default: 20, max: 100) |
| Códigos de éxito | `200 OK`, `201 Created`, `204 No Content` |
| Errores | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`, `500 Internal Server Error` |
| Formato de error | `{ "code": "string", "message": "string", "details": [...] }` |
| Multi-tenancy | El `tenant_id` se extrae del JWT, no se pasa en el body |
| Timestamps | ISO 8601 con timezone (`2026-10-16T14:30:00-05:00`) |

---

## Módulo de Autenticación (`/auth`)

### `POST /auth/register`
Registra un nuevo usuario (proveedor o comprador).

**Body:**
```json
{
  "email": "ventas@distribuidoraabc.pe",
  "password": "Segura123!",
  "rol": "proveedor",
  "razonSocial": "Distribuidora ABC S.A.C.",
  "ruc": "20123456789",
  "direccion": "Av. Comercio 123, Ayacucho",
  "ciudad": "Ayacucho"
}
```

**Respuesta `201`:**
```json
{
  "id": "uuid",
  "email": "ventas@distribuidoraabc.pe",
  "rol": "proveedor",
  "estado": "pendiente_verificacion",
  "createdAt": "2026-10-16T14:30:00-05:00"
}
```

**Errores posibles:** `400` (datos inválidos), `409` (email o RUC ya registrado), `422` (RUC inválido en SUNAT).

---

### `POST /auth/login`
Autentica un usuario y devuelve tokens JWT.

**Body:**
```json
{
  "email": "ventas@distribuidoraabc.pe",
  "password": "Segura123!"
}
```

**Respuesta `200`:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 3600,
  "usuario": {
    "id": "uuid",
    "email": "ventas@distribuidoraabc.pe",
    "rol": "proveedor"
  }
}
```

**Errores posibles:** `401` (credenciales inválidas), `403` (cuenta bloqueada).

---

### `POST /auth/refresh`
Renueva el access token usando el refresh token.

**Body:** `{ "refreshToken": "eyJhbGci..." }`  
**Respuesta `200`:** `{ "accessToken": "...", "expiresIn": 3600 }`  
**Errores:** `401` (token inválido o expirado).

---

### `POST /auth/logout`
Invalida el refresh token del usuario. Requiere JWT.

**Respuesta:** `204 No Content`

---

## Módulo de Proveedores (`/providers`)

### `GET /providers`
Lista proveedores verificados con filtros opcionales.

**Query params:** `ciudad`, `categoria`, `page`, `limit`  
**Acceso:** Comprador, Administrador

**Respuesta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "razonSocial": "Distribuidora ABC",
      "ciudad": "Ayacucho",
      "calificacionPromedio": 4.5,
      "estadoVerificacion": "verificado"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45 }
}
```

---

### `GET /providers/:id`
Devuelve el perfil completo de un proveedor.

**Acceso:** Público (solo proveedores verificados)  
**Respuesta `200`:** Perfil completo + productos activos + calificación.  
**Errores:** `404` (proveedor no encontrado).

---

### `PATCH /providers/:id/verify`
El administrador verifica o rechaza un proveedor.

**Acceso:** Administrador  
**Body:** `{ "decision": "verificado" | "rechazado", "motivo": "string" }`  
**Respuesta `200`:** Proveedor con estado actualizado.  
**Errores:** `403`, `404`.

---

## Módulo de Productos (`/products`)

### `GET /products`
Busca productos con filtros. Responde desde caché Redis cuando está disponible.

**Query params:** `q` (texto libre), `categoria`, `precioMin`, `precioMax`, `proveedorId`, `page`, `limit`  
**Acceso:** Comprador, Proveedor (solo propios si es proveedor)

**Respuesta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "nombre": "Arroz Costeño 50kg",
      "categoria": "Abarrotes",
      "precioBase": 120.00,
      "stock": 500,
      "unidad": "saco",
      "proveedor": { "id": "uuid", "razonSocial": "Distribuidora ABC", "ciudad": "Ayacucho" },
      "preciosVolumen": [
        { "cantidadMinima": 10, "cantidadMaxima": 49, "precioUnitario": 115.00 },
        { "cantidadMinima": 50, "cantidadMaxima": null, "precioUnitario": 108.00 }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 130 }
}
```

---

### `POST /products`
El proveedor publica un nuevo producto.

**Acceso:** Proveedor verificado  
**Body:**
```json
{
  "nombre": "Arroz Costeño 50kg",
  "descripcion": "Arroz extra de alta calidad, cosecha 2026.",
  "categoria": "Abarrotes",
  "precioBase": 120.00,
  "stock": 500,
  "unidad": "saco",
  "preciosVolumen": [
    { "cantidadMinima": 10, "cantidadMaxima": 49, "precioUnitario": 115.00 },
    { "cantidadMinima": 50, "cantidadMaxima": null, "precioUnitario": 108.00 }
  ]
}
```

**Respuesta `201`:** Producto creado con id.  
**Errores:** `400` (datos inválidos), `403` (proveedor no verificado).

---

### `PATCH /products/:id`
El proveedor actualiza precio, stock o descripción de su producto.

**Acceso:** Proveedor (solo sus productos)  
**Body:** Campos a actualizar (`precioBase`, `stock`, `descripcion`, etc.)  
**Respuesta `200`:** Producto actualizado.  
**Errores:** `403` (no es dueño del producto), `404`.

---

### `DELETE /products/:id`
El proveedor elimina (desactiva) un producto. No elimina físicamente.

**Acceso:** Proveedor (solo sus productos)  
**Respuesta:** `204 No Content`

---

## Módulo de Cotizaciones (`/quotations`)

### `POST /quotations`
El comprador solicita cotización a uno o varios proveedores.

**Acceso:** Comprador  
**Body:**
```json
{
  "items": [
    { "productoId": "uuid", "cantidad": 100 },
    { "productoId": "uuid", "cantidad": 50 }
  ],
  "proveedorIds": ["uuid", "uuid"]
}
```

**Respuesta `201`:** `{ "cotizacionId": "uuid", "estado": "abierta" }`  
**Errores:** `400` (items vacíos), `404` (producto no encontrado).

---

### `GET /quotations`
Lista las cotizaciones del usuario autenticado.

**Acceso:** Comprador (ve las suyas), Proveedor (ve las dirigidas a él)  
**Query params:** `estado`, `page`, `limit`  
**Respuesta `200`:** Lista de cotizaciones con ítems y respuestas.

---

### `POST /quotations/:id/responses`
El proveedor responde una cotización.

**Acceso:** Proveedor  
**Body:**
```json
{
  "precioTotal": 18500.00,
  "condicionesEntrega": "Entrega en almacén del comprador, pago 50% adelantado.",
  "diasEntrega": 3
}
```

**Respuesta `201`:** Respuesta registrada.  
**Errores:** `403` (cotización no dirigida a este proveedor), `404`, `409` (ya respondió).

---

### `PATCH /quotations/:id/responses/:respuestaId/accept`
El comprador acepta una respuesta de cotización.

**Acceso:** Comprador (dueño de la cotización)  
**Respuesta `200`:** `{ "cotizacionId": "uuid", "respuestaAceptadaId": "uuid", "estado": "aceptada" }`  
**Errores:** `403`, `404`, `409` (cotización ya aceptada o vencida).

---

## Módulo de IA (`/ai`)

### `GET /ai/recommendations`
Devuelve proveedores recomendados por el motor de IA.

**Acceso:** Comprador  
**Query params:** `productoNombre` (requerido), `cantidad` (requerido), `ciudad`

**Respuesta `200`:**
```json
{
  "source": "ia" | "fallback",
  "data": [
    {
      "proveedorId": "uuid",
      "razonSocial": "Distribuidora ABC",
      "score": 0.92,
      "precioEstimado": 115.00,
      "diasEntregaEstimado": 2,
      "calificacion": 4.7,
      "justificacion": "Mejor relación precio-calificación para esta cantidad."
    }
  ]
}
```

> `source: "fallback"` indica que el motor de IA no estaba disponible y se usó ordenamiento por precio.

---

## Módulo de Pedidos (`/orders`)

### `POST /orders`
El comprador confirma un pedido a partir de una cotización aceptada.

**Acceso:** Comprador  
**Body:**
```json
{
  "cotizacionRespuestaId": "uuid",
  "tokenPago": "TOKEN_PASARELA_XYZ"
}
```

**Respuesta `201`:**
```json
{
  "pedidoId": "uuid",
  "estado": "confirmado",
  "total": 18500.00,
  "autorizacionPago": "AUTH-12345"
}
```

**Errores:** `400` (token de pago inválido), `404` (cotización no encontrada), `409` (stock insuficiente o pedido ya creado), `422` (pago rechazado).

---

### `GET /orders`
Lista los pedidos del usuario autenticado.

**Acceso:** Comprador (sus pedidos), Proveedor (pedidos de sus productos)  
**Query params:** `estado`, `page`, `limit`  
**Respuesta `200`:** Lista de pedidos con ítems y estado de pago.

---

### `GET /orders/:id`
Devuelve el detalle completo de un pedido.

**Acceso:** Comprador (dueño) o Proveedor (involucrado)  
**Respuesta `200`:** Pedido con ítems, pago, entrega e incidencias.  
**Errores:** `403`, `404`.

---

### `PATCH /orders/:id/status`
El proveedor o el sistema actualiza el estado del pedido.

**Acceso:** Proveedor (en_preparacion, despachado), Comprador (entregado), Sistema (confirmado)  
**Body:** `{ "estado": "en_preparacion" | "despachado" | "entregado" | "cancelado" }`  
**Respuesta `200`:** Pedido con estado actualizado.  
**Errores:** `400` (transición de estado inválida), `403`, `404`.

---

## Módulo de Pagos (`/payments`)

### `GET /payments/:pedidoId`
Devuelve el estado del pago de un pedido.

**Acceso:** Comprador (dueño del pedido) o Administrador  
**Respuesta `200`:**
```json
{
  "id": "uuid",
  "pedidoId": "uuid",
  "monto": 18500.00,
  "pasarela": "niubiz",
  "estado": "pagado",
  "referenciaExterna": "NB-2026-001234",
  "createdAt": "2026-10-16T14:30:00-05:00"
}
```

---

### `POST /payments/:pedidoId/refund`
Solicita reembolso de un pago (solo administrador).

**Acceso:** Administrador  
**Body:** `{ "motivo": "string" }`  
**Respuesta `200`:** Pago con estado `reembolsado`.

---

## Módulo de Entregas (`/deliveries`)

### `POST /deliveries`
El proveedor registra información del despacho.

**Acceso:** Proveedor  
**Body:**
```json
{
  "pedidoId": "uuid",
  "transportista": "Transportes Ayacucho S.R.L.",
  "numeroGuia": "TA-2026-00456",
  "fechaEstimada": "2026-10-19"
}
```

**Respuesta `201`:** Entrega registrada.  
**Errores:** `403`, `404`, `409` (ya registrada).

---

### `PATCH /deliveries/:pedidoId/confirm`
El comprador confirma la recepción del pedido.

**Acceso:** Comprador (dueño del pedido)  
**Respuesta `200`:** Entrega con estado `entregado` y fecha real.

---

## Módulo de Evaluaciones (`/reviews`)

### `POST /reviews`
El comprador evalúa al proveedor tras recibir el pedido.

**Acceso:** Comprador  
**Body:**
```json
{
  "pedidoId": "uuid",
  "calificacion": 5,
  "comentario": "Excelente servicio, entrega puntual y producto de calidad."
}
```

**Respuesta `201`:** Evaluación registrada.  
**Errores:** `400` (calificación fuera de rango 1-5), `403` (pedido no recibido aún), `409` (ya evaluado).

---

## Módulo de Incidencias (`/incidents`)

### `POST /incidents`
Registra una incidencia relacionada con un pedido.

**Acceso:** Comprador  
**Body:**
```json
{
  "pedidoId": "uuid",
  "tipo": "producto_incorrecto",
  "descripcion": "Se recibieron 80 sacos en lugar de los 100 solicitados."
}
```

**Respuesta `201`:** Incidencia con estado `abierta`.

---

### `GET /incidents`
Lista incidencias. Comprador ve las suyas; Administrador ve todas.

**Query params:** `estado`, `page`, `limit`

---

### `PATCH /incidents/:id/status`
El administrador actualiza el estado de una incidencia.

**Acceso:** Administrador  
**Body:** `{ "estado": "en_revision" | "resuelta" | "cerrada", "resolucion": "string" }`

---

## Módulo de Reportes (`/reports`) — Solo Administrador

### `GET /reports/summary`
Resumen general de la plataforma.

**Respuesta `200`:**
```json
{
  "totalPedidosMes": 142,
  "ingresosMes": 45800.00,
  "proveedoresActivos": 23,
  "compradoresActivos": 78,
  "incidenciasAbiertas": 5
}
```

---

### `GET /reports/top-products`
Top 10 productos más solicitados.

**Query params:** `periodo` (`7d`, `30d`, `90d`), `limit`

---

### `GET /reports/top-providers`
Top proveedores por volumen de ventas y calificación.

**Query params:** `periodo`, `limit`

---

## Resumen de endpoints por módulo

| Módulo | Endpoints | Acceso principal |
|---|---|---|
| Autenticación | 4 | Público |
| Proveedores | 3 | Comprador, Admin |
| Productos | 4 | Proveedor (CRUD propio), Comprador (lectura) |
| Cotizaciones | 4 | Comprador, Proveedor |
| IA | 1 | Comprador |
| Pedidos | 4 | Comprador, Proveedor |
| Pagos | 2 | Comprador, Admin |
| Entregas | 2 | Proveedor, Comprador |
| Evaluaciones | 1 | Comprador |
| Incidencias | 3 | Comprador, Admin |
| Reportes | 3 | Administrador |
| **Total** | **31** | |
