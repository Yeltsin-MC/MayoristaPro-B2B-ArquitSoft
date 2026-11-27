# Especificación de Requisitos — Fotos reales y ficha del producto

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 07 · Fotos reales y ficha del producto                       |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Contexto

En compras mayoristas el comprador necesita reconocer el producto exacto antes de cotizar: marca, presentación y empaque. Una tarjeta con solo texto genera dudas y llamadas al proveedor.

Este módulo agrega a cada producto una **galería de fotos** y una **descripción**, una **ficha de detalle** completa y fotos reales en las 15 categorías de la portada. Para la demo se usan **417 fotos libres de Pixabay**, revisadas a mano y convertidas a WebP, que cubren **382 de los 450 productos**. Los productos sin foto adecuada muestran una ilustración de su categoría.

---

## 2. Objetivo

- Guardar de 1 a 10 fotos por producto, ordenadas, con su crédito.
- Incluir las fotos y la descripción en el catálogo público sin crear un endpoint nuevo.
- Mostrar una ficha con galería, miniaturas, descripción, precio, escalas y disponibilidad.
- Mostrar siempre algo correcto: si no hay foto o falla, una ilustración de respaldo.
- Cargar las fotos de la demo desde un mapa versionado, sin duplicarlas al recargar.
- Servir las fotos desde el mismo sitio, en WebP, con caché de CDN.

---

## 3. Actores involucrados

| Actor | Permisos en este módulo |
| ----- | ----------------------- |
| Visitante o comprador | Ver fotos, galería, descripción y créditos |
| Proveedor | Sus productos muestran las fotos registradas (la subida desde la plantilla está pendiente) |
| Script de carga de la demo | Registrar fotos y descripciones desde `fotos.json` |
| Cloudflare (CDN) | Guardar en caché los archivos estáticos |

---

## 4. Glosario

| Término | Definición |
| ------- | ---------- |
| Foto principal | La de menor posición; se usa en la tarjeta del catálogo |
| Galería | Fotos del producto en orden de posición (1 a 10) |
| Crédito | Autor y licencia de la foto, mostrados en la ficha |
| Ilustración de respaldo | Imagen por categoría que se muestra cuando no hay foto o no carga |
| `fotos.json` | Mapa de la demo: nombre del producto → grupo de fotos, y grupo → archivos con crédito |
| WebP | Formato de imagen comprimido, más liviano que JPG o PNG |

---

## 5. Requisitos funcionales

### RF-FOT-01 — Galería por producto

**Tabla:** `product_images (product_id, position, url, credit)`

**Reglas:**

- `position` entre 1 y 10; clave primaria `(product_id, position)`.
- `url` de hasta 500 caracteres que empieza con `/` (ruta propia) o `https://`.
- `credit` de hasta 300 caracteres.
- Al borrar el producto se borran sus fotos (`ON DELETE CASCADE`).

#### Criterios de aceptación (EARS)

1. EL sistema DEBERÁ permitir de 1 a 10 fotos por producto, ordenadas por posición.
2. SI una URL no empieza con `/` ni con `https://`, ENTONCES la base DEBERÁ rechazarla.
3. CUANDO cambien las fotos de un producto, EL sistema DEBERÁ invalidar la caché del catálogo igual que cuando cambia el producto.

---

### RF-FOT-02 — Fotos y descripción en el catálogo

**Endpoint:** `GET /api/v1/products` (el mismo del módulo 01)
**Campos nuevos por producto:** `images: [{ url, credito }]` y `description` (hasta 2000 caracteres).

#### Criterios de aceptación (EARS)

1. `GET /products` DEBERÁ devolver por producto la lista `images` en orden de galería y la `description`.
2. SI el producto no tiene fotos, ENTONCES `images` DEBERÁ ser una lista vacía.

---

### RF-FOT-03 — Ficha del producto

**Componente:** `apps/web/src/catalog.ts` / `catalog.html` («Ver detalle»)

#### Criterios de aceptación (EARS)

1. CUANDO el comprador presione «Ver detalle», EL sistema DEBERÁ mostrar la galería con miniaturas, descripción, proveedor, «Despacha desde», presentación, precio, escalas por volumen, mínimo y disponibilidad.
2. En computadora, la foto DEBERÁ ir a la izquierda y los datos a la derecha; en celular, los botones de cotizar DEBERÁN quedar fijos al pie.
3. EL sistema DEBERÁ mostrar el crédito de la foto visible.
4. CUANDO el comprador elija otra miniatura, la foto grande y el crédito DEBERÁN cambiar.

---

### RF-FOT-04 — Ilustración de respaldo

**Componente:** `apps/web/src/catalog-photo.ts` (`app-catalog-photo`)

#### Criterios de aceptación (EARS)

1. SI el producto no tiene foto, ENTONCES EL sistema DEBERÁ mostrar la ilustración de su categoría.
2. SI la imagen falla al cargar (por ejemplo, 404), ENTONCES EL sistema DEBERÁ cambiarla por la ilustración sin romper el diseño.
3. Las fotos fuera de la primera pantalla DEBERÁN cargarse de forma diferida (`loading="lazy"`).

---

### RF-FOT-05 — Fotos de la demo

**Archivos:** `database/demo/catalogo150/fotos.json`, `database/demo/load.cjs` · comando `npm run demo:catalog:load`

#### Criterios de aceptación (EARS)

1. CUANDO se cargue el catálogo demo, EL sistema DEBERÁ registrar las fotos según `fotos.json` (clave = nombre del producto) y una descripción por producto.
2. Repetir la carga NO DEBERÁ duplicar fotos: DEBERÁ reemplazar las del producto.
3. Las fotos DEBERÁN constar con su autor y licencia en `apps/web/public/images/productos/CREDITOS.md`.

---

### RF-FOT-06 — Fotos de las categorías

**Componente:** `catalog.ts → CATEGORY_PHOTOS`

#### Criterios de aceptación (EARS)

1. La sección «Qué puedes comprar» DEBERÁ mostrar una foto real por cada una de las 15 categorías.
2. CUANDO el comprador elija una categoría, EL catálogo DEBERÁ filtrarse por ella.

---

## 6. Requisitos no funcionales

| ID | Atributo | Detalle |
| -- | -------- | ------- |
| RNF-FOT-01 | Rendimiento | WebP de unos 40 KB por foto y carga diferida |
| RNF-FOT-02 | Disponibilidad | Las fotos van dentro de la imagen Docker `web` y las sirve Nginx: no dependen de terceros |
| RNF-FOT-03 | Escalabilidad | Cloudflare guarda en caché las fotos estáticas (CDN) |
| RNF-FOT-04 | Legalidad | Solo fotos con licencia libre, con crédito registrado; no se copian fotos de marketplaces |
| RNF-FOT-05 | Integridad | Restricciones `CHECK` en la base para posición, URL y longitudes |
| RNF-FOT-06 | Accesibilidad | Texto alternativo con el nombre del producto; la ilustración de respaldo es decorativa |
| RNF-FOT-07 | Usabilidad | Ficha legible de 320 a 1440 px, en modo claro y oscuro |

---

## 7. Criterios de aceptación del módulo

- [x] `GET /products` incluye `images` y `description`.
- [x] Producto sin fotos → `images: []` y la tarjeta muestra la ilustración.
- [x] Foto que responde 404 → se reemplaza por la ilustración.
- [x] La ficha muestra galería, miniaturas, crédito y escalas.
- [x] En celular los botones de cotizar quedan fijos al pie.
- [x] Agregar o cambiar una foto invalida la caché del catálogo.
- [x] Recargar la demo no duplica fotos.
- [x] Producción (mayoristapro.shop): 859 fotos registradas en `product_images`.
- [x] Las 15 categorías tienen foto real.

---

## 8. Flujo de una foto

```
 Pixabay (licencia libre)
        │  revisión manual + conversión a WebP (~40 KB)
        ▼
 apps/web/public/images/productos/*.webp  +  CREDITOS.md
        │                                       │
        │ imagen Docker «web» (Nginx)           │ fotos.json (nombre → fotos)
        ▼                                       ▼
 https://mayoristapro.shop/images/…      npm run demo:catalog:load
        │                                       │
        │ Cloudflare CDN                        ▼
        │                               product_images (posición 1..10)
        │                                       │ trigger → revisión de caché
        ▼                                       ▼
 Navegador ◄──── <img src> ◄──── GET /api/v1/products → images[]
        │
        └── si falla → ilustración de la categoría
```

---

## 9. Trazabilidad SDD

| Artefacto | Archivo |
| --------- | ------- |
| Diseño técnico | [`design.md`](design.md) |
| Tareas de implementación | [`tasks.md`](tasks.md) |
| Migración | `database/migrations/010_product_media.sql` |
| SQL del catálogo | `apps/api/src/catalog/infrastructure/price-tiers-sql.ts` (`IMAGES_JSON`), `postgres-products.ts` |
| Carga de la demo | `database/demo/load.cjs`, `database/demo/catalogo150/fotos.json` |
| Archivos | `apps/web/public/images/productos/`, `apps/web/public/images/categorias/` |
| Frontend | `apps/web/src/catalog.ts`, `catalog.html`, `catalog-photo.ts` |
| Pruebas | `tests/demo-catalog.integration.cjs`, `tests/cantidad-mayorista.browser.cjs`, `tests/experiencia-catalogo.browser.cjs` |
