# Diseño — Mis productos y asistente de carga en 4 pasos

## Resumen

- **API (módulo `identity`):** `ownProducts()` (`GET /company/products`, con `Cache-Control: no-store`) devuelve hasta 1000 productos con su foto principal y el motivo de retiro; `publish()` y `unpublish()` (`POST /products/:id/publish|unpublish`) validan propiedad dentro de la misma consulta SQL.
- **Angular:** panel «Mis productos» en `apps/web/src/identity.ts` (búsqueda, contador, botones accesibles); asistente en `apps/web/src/catalog-import.ts` con `ol.import-steps`, el desplegable de reglas y la señal `failed` para mostrar errores.
- Tras cada acción, `loadOwnProducts()` recarga el panel sin borrar el mensaje de éxito, y el catálogo público se actualiza por la invalidación de caché.

## Interfaces

| Ruta | Resultado |
|---|---|
| `GET /company/products` | `[{id, sku, name, category, unit, stock, minimum, price, published, retiredReason, photo}]` |
| `POST /products/:id/publish` | 201 `{published: true}` |
| `POST /products/:id/unpublish` | 201 `{published: false}` |
| Rutas de importación | Ver [diseño de carga masiva](../03-carga-masiva/design.md) |

## Reglas en SQL

- **Publicar:** `UPDATE … WHERE` producto de la empresa del usuario, proveedor verificado, `(published OR stock >= minimum)`; antes se rechaza si `retired_at` no está vacío.
- **Ocultar:** `UPDATE … SET published=false WHERE` producto de la empresa del usuario.
- Ambas registran `publish-product` o `unpublish-product` en `identity_audit`.

## Decisiones

- **Lista en lugar de «ID del producto propio»:** el proveedor no debería conocer UUID internos.
- **El panel vive en «Mi cuenta»:** solo existe para usuarios con `publish`, lo que evita botones que luego fallarían con 403.
- **Asistente por pasos:** reduce errores de primera vez; los textos de la interfaz que usan las pruebas se conservaron para no romperlas.
- **CSS:** `grid-template-columns: minmax(0, 1fr)` y `input[type=file]{width:100%}` evitan el desborde en celular.

## Manejo de errores

403 «Solo puedes ocultar tus propios productos» o «Requiere propiedad y proveedor verificado» · 403 con el motivo si el producto está retirado · los errores de importación se muestran dentro del paso correspondiente.

## Estrategia de pruebas

| Requisito | Prueba |
|---|---|
| 1, 2 | [`tests/identity.integration.cjs`](../../../../tests/identity.integration.cjs), subprueba «mis productos: listar, ocultar y volver a publicar solo lo propio» |
| 1.4, 2.5, 3 | [`tests/catalog.browser.cjs`](../../../../tests/catalog.browser.cjs): visibilidad por rol, recorrido Excel y Ocultar/Publicar; [`tests/demo.browser.cjs`](../../../../tests/demo.browser.cjs) |
| 3.3 | [`tests/imports.integration.cjs`](../../../../tests/imports.integration.cjs), subprueba «Encabezados mal escritos» |
| 3.5 | Revisión responsive con `npm run revisar:front` (320 a 1440 px) |
