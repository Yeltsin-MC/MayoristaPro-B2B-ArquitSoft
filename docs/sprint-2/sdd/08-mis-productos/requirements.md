# Especificación de Requisitos — Mis productos y asistente de carga en 4 pasos

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 08 · Mis productos y asistente de carga en 4 pasos           |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Contexto

En la primera versión, para publicar un producto el proveedor debía pegar su «ID de producto propio» (un UUID interno) en un formulario técnico, y la carga masiva era una sola pantalla con muchos controles juntos. En la revisión de usabilidad quedó claro que un proveedor mayorista no sabe qué es un UUID y que necesita ver su catálogo de un vistazo.

Este módulo reemplaza eso por un panel **«Mis productos»**, con la lista de todo lo que vende la empresa y botones **Publicar / Ocultar**, y por un **asistente de carga en 4 pasos** con las reglas explicadas en lenguaje simple.

La lógica de importación (validaciones, vista previa y confirmación atómica) está en [Carga masiva](../03-carga-masiva/requirements.md); aquí se especifica la experiencia del proveedor.

---

## 2. Objetivo

- Listar todos los productos de la empresa con foto, SKU, precio, stock y estado.
- Publicar u ocultar un producto con un clic, con las mismas reglas de seguridad del servidor.
- Mostrar claramente los productos retirados por el administrador y su motivo.
- Guiar la carga masiva en 4 pasos numerados, con ayuda desplegable y errores comprensibles.
- Funcionar bien en celular.

---

## 3. Actores involucrados

| Actor | Permisos en este módulo |
| ----- | ----------------------- |
| Proveedor verificado con `publish` | Ver «Mis productos», publicar, ocultar y usar el asistente |
| Usuario sin `publish` o proveedor no verificado | No ve el panel |
| Administrador de plataforma | No ve el panel (no pertenece a una empresa); retira productos desde [Moderación](../05-moderacion/requirements.md) |

---

## 4. Glosario

| Término | Definición |
| ------- | ---------- |
| Publicado | Visible en el catálogo público |
| Oculto | Existe, pero el proveedor lo sacó temporalmente del catálogo |
| Retirado | Ocultado por el administrador; el proveedor no puede publicarlo |
| Asistente | Componente `app-catalog-import` con los 4 pasos de la carga masiva |

---

## 5. Requisitos funcionales

### RF-MIS-01 — Ver mis productos

**Endpoint:** `GET /api/v1/company/products`
**Acceso:** Usuario con `publish` · `Cache-Control: no-store`
**Respuesta:** hasta 1000 productos `[{ id, sku, name, category, unit, stock, minimum, price, published, retiredReason, photo }]`, ordenados por nombre.

#### Criterios de aceptación (EARS)

1. CUANDO un usuario con permiso `publish` abra «Mis productos», EL sistema DEBERÁ listar todos los productos de su empresa (publicados, ocultos y retirados) con foto principal, SKU, nombre, precio, stock y estado.
2. EL panel DEBERÁ mostrar el resumen «N publicados de M».
3. CUANDO haya más de 6 productos, EL panel DEBERÁ ofrecer un buscador por nombre o SKU.
4. SI el producto está retirado, ENTONCES EL panel DEBERÁ mostrar «Retirado» y el motivo del administrador, sin botón de publicar.
5. Usuarios sin `publish`, proveedores no verificados y administradores NO DEBERÁN ver el panel.

---

### RF-MIS-02 — Ocultar un producto

**Endpoint:** `POST /api/v1/products/:id/unpublish`
**Respuesta:** 201 `{ published: false }`

#### Criterios de aceptación (EARS)

1. CUANDO el proveedor presione «Ocultar», EL sistema DEBERÁ despublicar el producto y registrar `unpublish-product` en la auditoría.
2. SI el producto es de otra empresa, ENTONCES EL sistema DEBERÁ responder 403 «Solo puedes ocultar tus propios productos.».

---

### RF-MIS-03 — Publicar un producto

**Endpoint:** `POST /api/v1/products/:id/publish`
**Respuesta:** 201 `{ published: true }`

#### Criterios de aceptación (EARS)

1. CUANDO el proveedor presione «Publicar», EL sistema DEBERÁ publicar el producto solo si es propio, el proveedor está verificado y el stock alcanza el pedido mínimo.
2. SI no se cumplen esas condiciones, ENTONCES EL sistema DEBERÁ responder 403 «Requiere propiedad y proveedor verificado.».
3. SI el producto está retirado, ENTONCES EL sistema DEBERÁ responder 403 con el motivo del administrador.

---

### RF-MIS-04 — Accesibilidad y actualización inmediata

#### Criterios de aceptación (EARS)

1. Los botones DEBERÁN tener nombre accesible con el producto: «Publicar <nombre>» y «Ocultar <nombre>».
2. CUANDO cambie un estado, EL panel DEBERÁ recargarse sin borrar el mensaje de éxito, y el catálogo público DEBERÁ reflejarlo en la siguiente consulta (caché invalidada).
3. CUANDO se restaure la sesión al recargar la página, EL panel DEBERÁ cargarse solo.

---

### RF-MIS-05 — Asistente de carga en 4 pasos

**Componente:** `apps/web/src/catalog-import.ts`

| Paso | Contenido |
| ---- | --------- |
| 1. Descarga la plantilla | Botones «Plantilla Excel» y «Plantilla CSV» |
| 2. Sube tu archivo | Selector de archivo `.csv` o `.xlsx` (máximo 5 MB) |
| 3. Revisa la vista previa | Tabla con acción por fila y errores por columna |
| 4. Confirma | Botón de confirmación y tarjetas de resumen |

#### Criterios de aceptación (EARS)

1. EL asistente DEBERÁ mostrar los 4 pasos numerados.
2. EL asistente DEBERÁ incluir una sección desplegable «¿Cómo lleno la plantilla?» con las reglas en lenguaje simple.
3. SI el archivo no es `.csv` o `.xlsx`, o supera 5 MB, ENTONCES EL asistente DEBERÁ avisarlo antes de subirlo.
4. CUANDO haya errores, EL asistente DEBERÁ mostrarlos por fila y columna; SI los encabezados están mal, DEBERÁ decir cuáles faltan, sobran o se repiten.
5. CUANDO se confirme el lote, EL asistente DEBERÁ mostrar tarjetas de resumen (creados y actualizados), permitir descargar el reporte CSV y actualizar «Mis productos».
6. Los mensajes DEBERÁN anunciarse a lectores de pantalla (`role="status"`, `aria-live="polite"`).

---

### RF-MIS-06 — Uso en celular

#### Criterios de aceptación (EARS)

1. EL panel y el asistente DEBERÁN funcionar de 320 a 1440 px sin desbordar horizontalmente.
2. El selector de archivo y los botones DEBERÁN ocupar el ancho disponible en celular.

---

## 6. Requisitos no funcionales

| ID | Atributo | Detalle |
| -- | -------- | ------- |
| RNF-MIS-01 | Seguridad | La propiedad se valida en la misma consulta SQL (`WHERE` con la empresa del token), no en el navegador |
| RNF-MIS-02 | Usabilidad | El proveedor nunca ve ni escribe UUID internos |
| RNF-MIS-03 | Privacidad | `Cache-Control: no-store` en el listado propio |
| RNF-MIS-04 | Accesibilidad | Botones con nombre accesible, mensajes con `aria-live`, pasos en una lista ordenada |
| RNF-MIS-05 | Responsive | `grid-template-columns: minmax(0, 1fr)` y `input[type=file] { width: 100% }` |
| RNF-MIS-06 | Auditoría | `publish-product` y `unpublish-product` en `identity_audit` |

---

## 7. Criterios de aceptación del módulo

- [x] El proveedor ve todos sus productos con el resumen «N publicados de M».
- [x] Un comprador sin `publish` no ve el panel.
- [x] «Ocultar» quita el producto del catálogo público.
- [x] «Publicar» lo devuelve si hay stock para el mínimo.
- [x] Ocultar un producto de otra empresa → 403.
- [x] Producto retirado → «Retirado» con motivo y sin botón de publicar.
- [x] El asistente muestra los 4 pasos y la ayuda desplegable.
- [x] Encabezados mal escritos → mensaje con columnas faltantes y sobrantes.
- [x] Tras confirmar → tarjetas de resumen y lista actualizada.
- [x] A 320 px no hay desborde horizontal.

---

## 8. Estados de un producto en el panel

```
            [Ocultar — RF-MIS-02]
 PUBLICADO ──────────────────────► OCULTO
     ▲                               │
     └──────[Publicar — RF-MIS-03]───┘   (solo si stock ≥ mínimo)

 [Administrador retira] ──► RETIRADO  (motivo visible, sin botón Publicar)
                               │
               [Administrador restaura] ──► PUBLICADO u OCULTO
```

---

## 9. Trazabilidad SDD

| Artefacto | Archivo |
| --------- | ------- |
| Diseño técnico | [`design.md`](design.md) |
| Tareas de implementación | [`tasks.md`](tasks.md) |
| Servicio | `apps/api/src/identity/identity.service.ts` (`ownProducts()`, `publish()`, `unpublish()`) |
| Controlador | `apps/api/src/identity/identity.controller.ts` |
| Panel | `apps/web/src/identity.ts` (sección `my-products`) |
| Asistente | `apps/web/src/catalog-import.ts` |
| Pruebas | `tests/identity.integration.cjs`, `tests/catalog.browser.cjs`, `tests/demo.browser.cjs`, `tests/imports.integration.cjs` |
