# Diseño Técnico — Fotos reales y ficha del producto

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 07 · Fotos reales y ficha del producto                       |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Arquitectura del módulo

El módulo no agrega endpoints: amplía la consulta del catálogo (módulo 01) con dos campos y sirve las fotos como archivos estáticos.

```
┌──────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Angular)                           │
│                                                                  │
│  catalog.html                                                    │
│    ├── Tarjeta: foto principal (images[0]) + «Ver detalle»       │
│    └── Ficha: foto grande · miniaturas · crédito · descripción   │
│               precio, escalas, mínimo, disponibilidad            │
│  catalog-photo.ts (app-catalog-photo)                            │
│    └── (error) → ilustración de la categoría                     │
│  catalog.ts → CATEGORY_PHOTOS (15 categorías)                    │
└───────────────┬───────────────────────────────┬──────────────────┘
                │ GET /api/v1/products          │ GET /images/productos/x.webp
                ▼                               ▼
┌──────────────────────────────┐   ┌───────────────────────────────┐
│ API NestJS (catalog)         │   │ Nginx (contenedor «web»)      │
│ postgres-products.ts         │   │ archivos estáticos WebP       │
│   IMAGES_JSON → images[]     │   │ detrás de Cloudflare (CDN)    │
│   p.description              │   └───────────────────────────────┘
│ CachedProducts (Redis)       │
└───────────────┬──────────────┘
                │ pg
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ POSTGRESQL (migración 010)                                       │
│  products.description · product_images                           │
│  trigger product_images_catalog_cache_revision                   │
└──────────────────────────────────────────────────────────────────┘
                ▲
                │ npm run demo:catalog:load
┌───────────────┴──────────────────────────────────────────────────┐
│ database/demo/load.cjs + catalogo150/fotos.json                  │
│   por producto: DELETE fotos → INSERT fotos en orden             │
└──────────────────────────────────────────────────────────────────┘
```

Vista Mermaid:

```mermaid
flowchart LR
  F[fotos.json] -->|load-demo| DB[(product_images)]
  DB -->|trigger revisión| C[(Redis)]
  API[GET /products] -->|images[] + description| W[Angular ficha y galería]
  W -->|/images/productos/x.webp| N[Nginx web]
  N --> CF[Cloudflare CDN]
```

---

## 2. Diseño de la consulta — `price-tiers-sql.ts`

```sql
-- IMAGES_JSON
COALESCE(
  (SELECT json_agg(json_build_object('url', i.url, 'credito', i.credit) ORDER BY i.position)
   FROM product_images i WHERE i.product_id = p.id),
  '[]'::json
)
```

- Una sola consulta devuelve productos, escalas y fotos (sin consultas N+1).
- `COALESCE(…, '[]')` asegura que un producto sin fotos devuelva una lista vacía y no `null`.
- La interfaz `PublishedProduct` agrega `images: Array<{ url, credito }>` y `description: string | null`.

---

## 3. Diseño del componente — `catalog-photo.ts`

| Entrada | Uso |
| ------- | --- |
| `photo` | URL de la foto (puede ser `undefined`) |
| `category` | Para elegir la ilustración de respaldo |
| `failedSource` (señal) | Guarda la URL que falló; si coincide con la actual, se muestra la ilustración |

Lógica:

```
si hay foto y no falló → <img [src]="photo" loading="lazy" (error)="failedSource.set(photo)">
si no                  → <img [src]="ilustración(category)" (error)="failedSource.set(source)">
```

Guardar la URL que falló (y no un simple `true`) permite que, al cambiar de producto o de miniatura, la nueva foto se intente cargar normalmente.

---

## 4. Diseño de la ficha — `catalog.html`

| Zona | Contenido |
| ---- | --------- |
| Izquierda (computadora) / arriba (celular) | Foto grande, miniaturas con `aria-label` y crédito de la foto visible |
| Derecha (computadora) / abajo (celular) | Nombre, proveedor, «Despacha desde», presentación, precio con IGV, escalas, mínimo y múltiplo, disponibilidad, descripción |
| Pie fijo (celular) | Selector de cantidad mayorista y botón para agregar a la Lista de pedido |

---

## 5. Diseño de la carga de la demo — `load.cjs`

| Paso | Acción |
| ---- | ------ |
| 1 | Leer `catalogo150/fotos.json`, que tiene dos partes: `productos` (nombre del producto → grupo de fotos, por ejemplo «aceite») y `fotos` (grupo → lista de `{ archivo, credito }`) |
| 2 | Por cada producto del manifiesto, buscar su grupo por nombre |
| 3 | `UPDATE products SET description` con una descripción generada desde la presentación, la categoría y el mínimo |
| 4 | `DELETE FROM product_images WHERE product_id = …` y luego `INSERT` en orden (posición 1, 2, …) con la URL `/images/productos/<archivo>` |
| 5 | Al final, informar cuántos productos quedaron con foto |

Agrupar las fotos por tipo de producto permite que varios productos parecidos (por ejemplo, dos presentaciones de aceite) compartan las mismas fotos sin duplicar archivos.

Borrar y volver a insertar dentro de la misma transacción hace la carga **idempotente**: repetirla no duplica fotos.

---

## 6. Modelo de datos utilizado (migración 010)

| Tabla o columna | Tipo | Regla |
| --------------- | ---- | ----- |
| `products.description` | `text` | Hasta 2000 caracteres |
| `product_images.product_id` | `uuid` | FK a `products` con `ON DELETE CASCADE` |
| `product_images.position` | `smallint` | 1 a 10; PK `(product_id, position)` |
| `product_images.url` | `text` | ≤ 500, empieza con `/` o `https://` |
| `product_images.credit` | `text` | ≤ 300 |
| Trigger `product_images_catalog_cache_revision` | — | Sube la revisión del catálogo al cambiar fotos |

---

## 7. Decisiones de diseño

| Decisión | Justificación |
| -------- | ------------- |
| Fotos libres de Pixabay revisadas a mano | Respeta derechos de autor; no se copian fotos de marketplaces ni de marcas |
| 68 productos con ilustración en vez de foto | Mejor una ilustración honesta que una foto que no corresponde al producto |
| Archivos estáticos dentro de la imagen `web` | Cero dependencia externa en la demo; Nginx y Cloudflare los sirven rápido y gratis |
| WebP de unos 40 KB | Carga rápida en celulares con datos móviles |
| Tabla aparte para la galería (no columnas foto1, foto2…) | Orden flexible, hasta 10 fotos y espacio para el crédito |
| Solo URLs propias o `https://` | Evita contenido mixto y esquemas peligrosos como `javascript:` |
| Ampliar `GET /products` en vez de un endpoint nuevo | La tarjeta y la ficha ya usan esa respuesta, que además pasa por la caché Redis |
| `fotos.json` indexado por nombre y agrupado por tipo | Se mantiene en sincronía con el manifiesto de la demo y evita repetir archivos entre productos parecidos |

---

## 8. Manejo de errores

| Caso | Resultado |
| ---- | --------- |
| URL o posición inválida al insertar | La base rechaza la fila (`CHECK`) y la carga de la demo falla con el motivo |
| Producto sin fotos | `images: []` → ilustración de la categoría |
| Foto que no carga (404, red) | `(error)` → ilustración de la categoría |
| Categoría sin ilustración propia | Ilustración genérica |

---

## 9. Estrategia de pruebas

| Requisito | Prueba |
| --------- | ------ |
| RF-FOT-01, 05 | `tests/demo-catalog.integration.cjs` y la salida de `npm run demo:catalog:load` (fotos por proveedor) |
| RF-FOT-01.3 | `tests/catalog-cache.integration.cjs` (invalidación por triggers) |
| RF-FOT-03 | `tests/experiencia-catalogo.browser.cjs` (ficha, galería y ancho de 320 px) |
| RF-FOT-04 | `tests/cantidad-mayorista.browser.cjs` (foto con 404 simulado → respaldo) |
| Contrato | `tests/openapi.test.cjs` (`images` y `description` en el esquema `Product`) |
| Producción | `SELECT count(*) FROM demo_mayoristapro150.product_images` = 859 en mayoristapro.shop |

---

## 10. Trazabilidad SDD

| Requisito | Función o archivo |
| --------- | ----------------- |
| RF-FOT-01 | `010_product_media.sql` |
| RF-FOT-02 | `IMAGES_JSON`, `PostgresProducts.listPublished()` |
| RF-FOT-03 | `catalog.html`, `catalog.ts` |
| RF-FOT-04 | `catalog-photo.ts` |
| RF-FOT-05 | `load.cjs`, `fotos.json`, `CREDITOS.md` |
| RF-FOT-06 | `CATEGORY_PHOTOS`, `images/categorias/` |
