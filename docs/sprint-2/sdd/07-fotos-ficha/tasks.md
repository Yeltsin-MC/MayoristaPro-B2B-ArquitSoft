# Tareas de implementación — Fotos reales y ficha del producto

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 07 · Fotos reales y ficha del producto                       |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Completado ✓ (una tarea pendiente)                           |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## Resumen de fases

| Fase | Descripción | Tareas | Estado |
| ---- | ----------- | ------ | ------ |
| 1 | Análisis y especificación | 1.1 | ✓ |
| 2 | Base de datos y API | 2.1 – 2.2 | ✓ |
| 3 | Contenido (fotos) | 3.1 – 3.2 | ✓ |
| 4 | Frontend | 4.1 – 4.3 | ✓ |
| 5 | Despliegue y pruebas | 5.1 – 5.2 | ✓ |
| — | Pendiente | 6.1 | ○ |

---

## Fase 1 — Análisis y especificación

### Tarea 1.1 — Definir galería, ficha y respaldo

**Descripción:** Definir cuántas fotos por producto, qué URLs se aceptan, qué muestra la ficha, qué pasa si no hay foto y de dónde se obtienen fotos legales para la demo.

**Resultado:** [`requirements.md`](requirements.md) y [`design.md`](design.md).

**Estado:** ✓ Completado

---

## Fase 2 — Base de datos y API

### Tarea 2.1 — Migración `010_product_media.sql`

**Descripción:** `products.description` (≤ 2000), tabla `product_images` con PK `(product_id, position)`, restricciones de URL y crédito, y trigger de revisión del catálogo.

**Requisitos:** RF-FOT-01 · **Estado:** ✓ Completado

---

### Tarea 2.2 — `images[]` y `description` en `GET /products`

**Archivos:** `price-tiers-sql.ts` (`IMAGES_JSON`), `postgres-products.ts`, `list-products.ts`, `apps/api/openapi.yaml`

**Casos validados:**

- [x] 2.2.1 Producto con 3 fotos → `images` en orden de posición.
- [x] 2.2.2 Producto sin fotos → `images: []`.

**Requisitos:** RF-FOT-02 · **Estado:** ✓ Completado

---

## Fase 3 — Contenido

### Tarea 3.1 — Seleccionar y convertir fotos

**Archivos:** `apps/web/public/images/productos/*.webp`, `CREDITOS.md`

**Descripción:** Elegir 417 fotos libres de Pixabay que correspondan a cada producto, convertirlas a WebP (unos 40 KB) y registrar autor y licencia.

**Requisitos:** RF-FOT-05, RNF-FOT-04 · **Estado:** ✓ Completado

---

### Tarea 3.2 — Mapa `fotos.json` y carga idempotente

**Archivos:** `database/demo/catalogo150/fotos.json`, `database/demo/load.cjs`

**Descripción:** Asociar cada producto, por su nombre, a un grupo de fotos; generar su descripción y, en cada carga, reemplazar sus fotos.

**Casos validados:**

- [x] 3.2.1 Cargar dos veces → mismo número de fotos.
- [x] 3.2.2 Renombrar productos (marcas peruanas ficticias) → `fotos.json` actualizado en sincronía.

**Requisitos:** RF-FOT-05 · **Estado:** ✓ Completado

---

## Fase 4 — Frontend

### Tarea 4.1 — Tarjeta con foto principal

**Archivos:** `catalog.html`, `catalog-photo.ts`

**Requisitos:** RF-FOT-02, RF-FOT-04 · **Estado:** ✓ Completado

---

### Tarea 4.2 — Ficha con galería

**Archivos:** `catalog.ts`, `catalog.html`, `styles.css`

**Subtareas:**

- [x] 4.2.1 Dos columnas en computadora y botones fijos al pie en celular.
- [x] 4.2.2 Miniaturas que cambian la foto grande y el crédito.
- [x] 4.2.3 Ilustración de respaldo por categoría.
- [x] 4.2.4 Contraste correcto en modo oscuro.

**Requisitos:** RF-FOT-03, RF-FOT-04 · **Estado:** ✓ Completado

---

### Tarea 4.3 — Fotos de las 15 categorías

**Archivos:** `catalog.ts → CATEGORY_PHOTOS`, `apps/web/public/images/categorias/`

**Requisitos:** RF-FOT-06 · **Estado:** ✓ Completado

---

## Fase 5 — Despliegue y pruebas

### Tarea 5.1 — Publicar en producción

**Descripción:** Construir la imagen `web` con las fotos (workflow «Preparar imágenes para AWS») y cargar la demo en EC2 con `deployment/actualizar.sh <SHA> --fotos`.

**Resultado:** 859 filas en `product_images` en mayoristapro.shop.

**Estado:** ✓ Completado

---

### Tarea 5.2 — Pruebas

| Prueba | Archivo | Qué valida |
| ------ | ------- | ---------- |
| PI-FOT-01 | `tests/demo-catalog.integration.cjs` | Carga de la demo sin duplicados |
| PI-FOT-02 | `tests/catalog-cache.integration.cjs` | Cambiar fotos invalida la caché |
| PN-FOT-01 | `tests/experiencia-catalogo.browser.cjs` | Ficha, galería y ancho de 320 px |
| PN-FOT-02 | `tests/cantidad-mayorista.browser.cjs` | Foto con 404 → ilustración de respaldo |
| PC-FOT-01 | `tests/openapi.test.cjs` | `images` y `description` en el contrato |

**Estado:** ✓ Completado

---

## Pendiente

### Tarea 6.1 — Fotos desde la plantilla de carga masiva

**Descripción:** Agregar las columnas `imagenes` y `descripcion` a la plantilla del [módulo 03](../03-carga-masiva/requirements.md), para que cada proveedor registre sus propias fotos.

**Estado:** ○ Pendiente

---

## Trazabilidad completa del módulo

```
requirements.md            design.md                    tasks.md
      │                        │                            │
      │ RF-FOT-01..06          │ IMAGES_JSON                │ Tareas 2.1..2.2 (BD/API)
      │ RNF-FOT-01..07         │ catalog-photo.ts           │ Tareas 3.1..3.2 (fotos)
      │ Flujo de una foto      │ load.cjs + fotos.json      │ Tareas 4.1..4.3 (web)
      │ Criterios EARS         │ Nginx + Cloudflare         │ Tareas 5.1..5.2
      └────────────────────────┴────────────────────────────┘
                               │
                      CÓDIGO IMPLEMENTADO
                               │
                      PRUEBAS EJECUTADAS (CI)
                               │
                   https://mayoristapro.shop ✓
```
