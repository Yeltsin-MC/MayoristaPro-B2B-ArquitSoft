# Tareas de implementación — Catálogo público, filtros, precios por volumen y caché

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 01 · Catálogo público, filtros, precios por volumen y caché  |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Completado ✓                                                 |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## Resumen de fases

| Fase | Descripción | Tareas | Estado |
| ---- | ----------- | ------ | ------ |
| 1 | Análisis y especificación | 1.1 – 1.2 | ✓ |
| 2 | Base de datos | 2.1 – 2.3 | ✓ |
| 3 | Backend | 3.1 – 3.5 | ✓ |
| 4 | Frontend | 4.1 – 4.3 | ✓ |
| 5 | Pruebas | 5.1 – 5.5 | ✓ |

---

## Fase 1 — Análisis y especificación

### Tarea 1.1 — Definir requisitos del catálogo

**Descripción:** Definir qué es un «producto visible», qué datos se muestran sin sesión, los filtros permitidos, las reglas de las escalas de precio y el comportamiento esperado de la caché bajo carga.

**Resultado:** [`requirements.md`](requirements.md) con 6 RF, 7 RNF y criterios EARS.

**Requisitos:** todos · **Estado:** ✓ Completado

---

### Tarea 1.2 — Diseñar la arquitectura del módulo

**Descripción:** Separar el módulo en presentación, aplicación e infraestructura; definir el puerto `ProductReader`; elegir el patrón Decorator para la caché y la invalidación por revisión con triggers diferidos.

**Resultado:** [`design.md`](design.md) con diagramas, algoritmo de caché, modelo de datos y decisiones.

**Requisitos:** RF-CAT-01, RF-CAT-05 · **Estado:** ✓ Completado

---

## Fase 2 — Base de datos

### Tarea 2.1 — Migración `001_catalog.sql`

**Archivo:** `database/migrations/001_catalog.sql`

**Descripción:** Crear `suppliers` y `products` con restricciones `CHECK` (precio > 0, stock ≥ 0, mínimo y múltiplo > 0, moneda `PEN`) y unicidad `(supplier_id, sku)`. Seed sintético con `npm run db:seed`.

**Requisitos:** RF-CAT-01 · **Estado:** ✓ Completado

---

### Tarea 2.2 — Migración `007_catalog_cache.sql`

**Archivo:** `database/migrations/007_catalog_cache.sql`

**Descripción:** Tabla `catalog_cache_revision` de una sola fila y función `advance_catalog_cache_revision()` como constraint trigger diferido en `products`, `suppliers` y `companies`, con un solo incremento por transacción (`last_txid`).

**Casos validados:**

- Carga de varias filas en una transacción → la revisión sube 1 vez.
- `ROLLBACK` → la revisión no cambia.
- Cambio por SQL directo → la revisión sube igual.

**Requisitos:** RF-CAT-05 · **Estado:** ✓ Completado

---

### Tarea 2.3 — Migración `008_price_tiers.sql`

**Archivo:** `database/migrations/008_price_tiers.sql`

**Descripción:** Tabla `product_price_tiers` con PK `(product_id, min_quantity)`, `min_quantity > 1`, `unit_price > 0`, y trigger de revisión del catálogo.

**Requisitos:** RF-CAT-04, RF-CAT-05 · **Estado:** ✓ Completado

---

## Fase 3 — Backend

### Tarea 3.1 — `GET /api/v1/products` con paginación validada

**Archivos:** `products.controller.ts`, `list-products.ts`, `postgres-products.ts`

**Descripción:** Listar productos visibles con `LIMIT/OFFSET`, validar `page` y `limit` antes de consultar y responder con `Cache-Control: no-store`.

**Casos validados:**

- Sin parámetros → 20 productos, `page = 1`.
- `limit = 101` → 400.
- `page = 0` → 400.

**Requisitos:** RF-CAT-01 · **Estado:** ✓ Completado

---

### Tarea 3.2 — Búsqueda, filtros y orden

**Archivos:** `products.controller.ts`, `postgres-products.ts`

**Descripción:** Agregar `q`, `category`, `supplier`, `available` y `sort`; validar cada uno en el controlador y aplicarlos en SQL parametrizado antes de paginar. Búsqueda literal con `strpos`.

**Casos validados:**

- [x] 3.2.1 `supplier` que no es UUID → 400.
- [x] 3.2.2 `sort=nombre` → 400.
- [x] 3.2.3 `q` con `%` no actúa como comodín.
- [x] 3.2.4 Filtro + orden + paginación combinados devuelven el mismo orden en cada página.

**Requisitos:** RF-CAT-02 · **Estado:** ✓ Completado

---

### Tarea 3.3 — `GET /api/v1/products/options`

**Archivo:** `postgres-products.ts → options()`

**Descripción:** Devolver categorías y proveedores con al menos un producto visible, excluyendo empresas suspendidas.

**Requisitos:** RF-CAT-03 · **Estado:** ✓ Completado

---

### Tarea 3.4 — Escalas de precio por volumen

**Archivos:** `trade/domain/price-tiers.ts`, `trade/infrastructure/postgres-trade.ts`, `catalog/infrastructure/price-tiers-sql.ts`

**Descripción:** Validar las reglas de `priceTiers()`, reemplazar las escalas en una transacción solo para el proveedor dueño, exponerlas en el catálogo como `priceTiers` y calcular el precio aplicable con `unitPriceFor()`.

**Casos validados:**

- [x] 3.4.1 6 escalas → 422.
- [x] 3.4.2 Precio igual o mayor al base → 422.
- [x] 3.4.3 `desde` que no es múltiplo del incremento → 422.
- [x] 3.4.4 Lista vacía → elimina las escalas.
- [x] 3.4.5 Producto de otro proveedor → 403.

**Requisitos:** RF-CAT-04 · **Estado:** ✓ Completado

---

### Tarea 3.5 — Caché Redis con invalidación confirmada

**Archivos:** `cached-products.ts`, `redis-catalog-cache.ts`, `public-catalog-cache.ts`, `catalog.module.ts`

**Descripción:** Implementar el decorador `CachedProducts` (cache-aside), la clave con esquema y revisión, la doble lectura de la revisión, el TTL de 30 s y el tiempo límite de 100 ms con fallo abierto hacia PostgreSQL. Registrar el decorador como `PRODUCT_READER`.

**Casos validados:**

- [x] 3.5.1 Primera consulta → miss y fill; segunda → hit.
- [x] 3.5.2 Cambio confirmado → la siguiente consulta usa otra clave.
- [x] 3.5.3 Redis detenido → 200 desde PostgreSQL (bypass).
- [x] 3.5.4 Revisión que cambia durante la lectura → no se guarda en caché.

**Requisitos:** RF-CAT-05 · **Estado:** ✓ Completado

---

## Fase 4 — Frontend

### Tarea 4.1 — Catálogo y filtros

**Archivos:** `apps/web/src/catalog.ts`, `catalog.html`, `catalog-search.service.ts`

**Descripción:** Carrusel de portada, sección «Qué puedes comprar», filtros laterales fijos en computadora y desplegables en celular, y paginación.

**Requisitos:** RF-CAT-02, RF-CAT-06 · **Estado:** ✓ Completado

---

### Tarea 4.2 — Tarjeta y ficha con precio por volumen

**Archivos:** `catalog-product.ts`, `wholesale-quantity.ts`

**Descripción:** Mostrar las escalas en la tarjeta y en la ficha, y recalcular el precio al cambiar la cantidad respetando mínimo y múltiplo.

**Requisitos:** RF-CAT-04, RF-CAT-06 · **Estado:** ✓ Completado

---

### Tarea 4.3 — Responsive y modo oscuro

**Archivo:** `apps/web/src/styles.css`

**Descripción:** Sin desborde horizontal de 320 a 1440 px, botones táctiles de 44 px y contraste legible en modo claro y oscuro.

**Requisitos:** RNF-CAT-06 · **Estado:** ✓ Completado

---

## Fase 5 — Pruebas

### Tarea 5.1 — Pruebas unitarias (Jest)

| Prueba | Archivo | Qué valida |
| ------ | ------- | ---------- |
| PU-CAT-01 | `tests/price-tiers.test.cjs` | Reglas de escalas y `unitPriceFor()` |
| PU-CAT-02 | `tests/catalog-cache.test.cjs` | Hit, miss, bypass y fill del decorador |

**Estado:** ✓ Completado

---

### Tarea 5.2 — Pruebas de integración (Jest + PostgreSQL + Redis)

| Prueba | Archivo | Qué valida |
| ------ | ------- | ---------- |
| PI-CAT-01 | `tests/catalog.integration.cjs` | Listado, visibilidad y paginación |
| PI-CAT-02 | `tests/catalog-filters.integration.cjs` | Filtros, orden y opciones |
| PI-CAT-03 | `tests/price-tiers.integration.cjs` | Endpoint de escalas y permisos |
| PI-CAT-04 | `tests/catalog-cache.integration.cjs` | RC01–RC07: invalidación, rollback y Redis caído |
| PI-CAT-05 | `tests/catalog-revision.integration.cjs` | Un incremento por transacción |

**Estado:** ✓ Completado

---

### Tarea 5.3 — Pruebas de navegador (Playwright)

| Prueba | Archivo | Qué valida |
| ------ | ------- | ---------- |
| PN-CAT-01 | `tests/experiencia-catalogo.browser.cjs` | Filtros, ficha y ancho de 320 px |
| PN-CAT-02 | `tests/cantidad-mayorista.browser.cjs` | Cantidad mayorista, escalas y foto de respaldo |

**Estado:** ✓ Completado

---

### Tarea 5.4 — Pruebas funcionales con Postman

**Colección:** `postman/MayoristaPro.postman_collection.json` · carpeta «1. Catálogo»

| Prueba | Petición | Resultado esperado |
| ------ | -------- | ------------------ |
| PT-CAT-01 | Listar productos (página 1) | ✓ 200 con `items`, `page` y `limit` |
| PT-CAT-02 | Buscar y ordenar por precio | ✓ 200, precios en orden |
| PT-CAT-03 | Opciones de filtro | ✓ 200 con `categories` y `suppliers` |
| PT-CAT-04 | Inválido: límite mayor a 100 | ✓ 400 |
| PT-CAT-05 | Inválido: orden desconocido | ✓ 400 |
| PT-CAT-06 | Inválido: proveedor no es UUID | ✓ 400 |

**Estado:** ✓ Completado

---

### Tarea 5.5 — Pruebas de carga con k6

**Archivo:** `tests/k6/catalogo.k6.js` · comando `npm run test:carga -- <smoke|load|stress|spike>`

| Tipo | Carga | Resultado (26/11/2026) |
| ---- | ----- | ---------------------- |
| Smoke | Pocos usuarios | ✓ Sin errores |
| Load | 100 VU durante 10 min | ✓ p95 9.9 ms |
| Stress | 100 → 2000 VU en 20 niveles | ✓ 2000 VU con p95 353 ms y 0 % de errores; satura cerca de 1900 VU |
| Spike | Pico de 1000 VU | ✓ p95 11.7 ms |

Evidencia: `docs/sprint-2/evidencias/k6/2026-11-26/`.

**Requisitos:** RNF-CAT-01 · **Estado:** ✓ Completado

---

## Pendientes

- [ ] Facetas con contador por categoría y filtro por rango de precio (mejora futura).

---

## Lista de tareas

Cada tarea tiene un código único `T###`, la fase a la que pertenece y los requisitos que cubre. `[x]` es completada y `[ ]` pendiente.

- [x] T001 [Fase 1] Definir requisitos del catálogo (Tarea 1.1) → todos
- [x] T002 [Fase 1] Diseñar la arquitectura del módulo (Tarea 1.2) → RF-CAT-01, RF-CAT-05
- [x] T003 [Fase 2] Migración `001_catalog.sql` (Tarea 2.1) → RF-CAT-01
- [x] T004 [Fase 2] Migración `007_catalog_cache.sql` (Tarea 2.2) → RF-CAT-05
- [x] T005 [Fase 2] Migración `008_price_tiers.sql` (Tarea 2.3) → RF-CAT-04, RF-CAT-05
- [x] T006 [Fase 3] `GET /api/v1/products` con paginación validada (Tarea 3.1) → RF-CAT-01
- [x] T007 [Fase 3] Búsqueda, filtros y orden (Tarea 3.2) → RF-CAT-02
- [x] T008 [Fase 3] `GET /api/v1/products/options` (Tarea 3.3) → RF-CAT-03
- [x] T009 [Fase 3] Escalas de precio por volumen (Tarea 3.4) → RF-CAT-04
- [x] T010 [Fase 3] Caché Redis con invalidación confirmada (Tarea 3.5) → RF-CAT-05
- [x] T011 [Fase 4] Catálogo y filtros (Tarea 4.1) → RF-CAT-02, RF-CAT-06
- [x] T012 [Fase 4] Tarjeta y ficha con precio por volumen (Tarea 4.2) → RF-CAT-04, RF-CAT-06
- [x] T013 [Fase 4] Responsive y modo oscuro (Tarea 4.3) → RNF-CAT-06
- [x] T014 [Fase 5] Pruebas unitarias (Jest) (Tarea 5.1)
- [x] T015 [Fase 5] Pruebas de integración (Jest + PostgreSQL + Redis) (Tarea 5.2)
- [x] T016 [Fase 5] Pruebas de navegador (Playwright) (Tarea 5.3)
- [x] T017 [Fase 5] Pruebas funcionales con Postman (Tarea 5.4)
- [x] T018 [Fase 5] Pruebas de carga con k6 (Tarea 5.5) → RNF-CAT-01

### Dependencias

```
T001–T002 → T003–T005 → T006–T010 → T011–T013 → T014–T018
```

Cada fase empieza cuando la anterior está completa: primero la especificación, luego la base de datos y el backend, después la interfaz y al final las pruebas. Dentro de una fase, las tareas se hicieron en el orden de la lista.

---

## Registro de ejecución

Bitácora de cómo se construyó el módulo, con la fecha en que se fusionó cada cambio a `main`. Cada entrada enlaza su pull request, donde están los commits y el resultado del CI.

### 10/11/2026 · T1 · Base del catálogo ([#2](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/2))

**Qué se hizo:** Migración `001_catalog.sql`, consulta paginada y página pública en Angular. Primer catálogo con datos sintéticos.

**Resultado:** Compilación y `tests/catalog.integration.cjs` en verde en CI.

### 12/11/2026 · T6 · Caché Redis ([#5](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/5))

**Qué se hizo:** Decorador `CachedProducts` (Cache-Aside), TTL 30 s, revisión transaccional con trigger diferido y fallback a PostgreSQL.

**Resultado:** `catalog-cache.test.cjs`, `catalog-cache.integration.cjs` y `catalog-revision.integration.cjs` en verde; medición en `evidencias/redis-catalogo`.

### 13/11/2026 · Catálogo B2B ([#7](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/7))

**Qué se hizo:** Búsqueda en la cabecera, categorías cerca del inicio y tarjetas con proveedor, presentación, mínimo y precio.

**Resultado:** `experiencia-catalogo.browser.cjs` y `cantidad-mayorista.browser.cjs`, con capturas en 1440 y 390 px.

### 13/11/2026 · Precios por volumen ([#11](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/11))

**Qué se hizo:** Migración `008_price_tiers.sql`, escalas de precio en la tarjeta y la ficha, y 15 empresas con 450 productos en la demo.

**Resultado:** `price-tiers.test.cjs` y `price-tiers.integration.cjs` en verde.

### 20/11/2026 · Rediseño del catálogo ([#23](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/23))

**Qué se hizo:** Paleta azul, carrusel, filtros fijos y vista responsive. Ajustes posteriores en [#24](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/24).

**Resultado:** Revisión visual en celular y computadora, de 320 a 1440 px.

### 20/11/2026 · Pruebas de carga ([#16](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/16))

**Qué se hizo:** Primera campaña k6 contra el catálogo, hasta 2000 usuarios virtuales.

**Resultado:** Evidencia en `docs/sprint-2/evidencias/k6`.

### 25/11/2026 · Filtro de proveedores ([#39](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/39))

**Qué se hizo:** El filtro mostraba solo 6 proveedores; ahora muestra todos en orden alfabético.

**Resultado:** Revisado en local y CI en verde.

### 26/11/2026 · Campaña k6 formal ([#44](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/44))

**Qué se hizo:** Pruebas smoke, load, stress y spike con `npm run test:carga`. Complemento en [#45](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/45).

**Resultado:** Stress de 2000 VU con p95 de 353 ms y 0 % de errores; load de 100 VU durante 10 min con p95 de 9,9 ms.

### 27/11/2026 · Especificación ampliada

**Qué se hizo:** Se ampliaron `requirements.md`, `design.md` y este archivo con requisitos EARS, diagramas, decisiones, lista de tareas y este registro.

**Resultado:** Documentación al día con el código desplegado en https://mayoristapro.shop.

---

## Trazabilidad completa del módulo

```
requirements.md            design.md                    tasks.md
      │                        │                            │
      │ RF-CAT-01..06          │ products.controller.ts     │ Tareas 2.1..2.3 (BD)
      │ RNF-CAT-01..07         │ ListProducts               │ Tareas 3.1..3.5 (API)
      │ Criterios EARS         │ CachedProducts + Redis     │ Tareas 4.1..4.3 (web)
      │ Flujo de caché         │ PostgresProducts           │ PU, PI, PN, PT, k6
      │                        │ price-tiers.ts             │
      └────────────────────────┴────────────────────────────┘
                               │
                      CÓDIGO IMPLEMENTADO
                               │
                      PRUEBAS EJECUTADAS (CI)
                               │
                   https://mayoristapro.shop ✓
```
