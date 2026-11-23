# Diseño — Fotos reales y ficha del producto

## Resumen

- **Datos:** la migración 010 agrega `products.description` y la tabla `product_images`.
- **API:** `postgres-products.ts` agrega al listado un arreglo JSON `images` y `description`; no hace falta un endpoint nuevo.
- **Archivos:** las fotos viven en `apps/web/public/images/productos/*.webp` (unos 40 KB cada una), van dentro de la imagen Docker `web` y Nginx las sirve; Cloudflare las guarda en su CDN.
- **Angular:** `catalog.ts` y `catalog.html` (tarjeta con la foto principal, ficha con galería y miniaturas, «Ver detalle»), el componente `app-catalog-photo` con respaldo, y el mapa `CATEGORY_PHOTOS` para las 15 categorías.
- **Demo:** `database/demo/load.cjs` aplica `fotos.json` (producto → fotos y descripción) dentro de la carga del catálogo.

## Arquitectura

```mermaid
flowchart LR
  F[fotos.json] -->|load-demo| DB[(product_images)]
  DB -->|trigger revisión| C[(Redis)]
  API[GET /products] -->|images[] + description| W[Angular ficha y galería]
  W -->|/images/productos/x.webp| N[Nginx web]
  N --> CF[Cloudflare CDN]
```

## Modelo de datos (migración 010)

| Tabla o columna | Detalle |
|---|---|
| `products.description` | `text`, hasta 2000 caracteres |
| `product_images` | `(product_id, position)` como clave; `position` de 1 a 10; `url` ≤ 500 caracteres que empieza con `/` o `https://`; `credit` ≤ 300 |
| Trigger | `product_images_catalog_cache_revision` incrementa la revisión del catálogo |

## Decisiones

- **Fotos libres (Pixabay) revisadas a mano**, no tomadas de marketplaces, para respetar derechos de autor; las 68 sin foto adecuada usan la ilustración.
- **Archivos estáticos en la imagen web:** cero dependencia externa en la demo y caché de CDN gratuita.
- **WebP** para reducir peso en celulares.
- **Galería en tabla aparte** (y no columnas foto1, foto2…): orden flexible y hasta 10 fotos.

## Manejo de errores

Restricciones `CHECK` de PostgreSQL ante URLs o posiciones inválidas · `onerror` del componente de foto → ilustración de respaldo.

## Estrategia de pruebas

| Requisito | Prueba |
|---|---|
| 1.3, 3.1 | [`tests/demo-catalog.integration.cjs`](../../../../tests/demo-catalog.integration.cjs) y la salida de `npm run demo:catalog:load` (fotos por proveedor) |
| 2 | [`tests/experiencia-catalogo.browser.cjs`](../../../../tests/experiencia-catalogo.browser.cjs), [`tests/cantidad-mayorista.browser.cjs`](../../../../tests/cantidad-mayorista.browser.cjs) (foto 404 simulada → respaldo) |
| 1.4 | [`tests/catalog-cache.integration.cjs`](../../../../tests/catalog-cache.integration.cjs) (invalidación por triggers) |
| Producción | `SELECT count(*) FROM demo_mayoristapro150.product_images` = 859 en mayoristapro.shop (23/11/2026) |
