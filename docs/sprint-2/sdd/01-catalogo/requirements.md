# Especificación de Requisitos — Catálogo público, filtros, precios por volumen y caché

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 01 · Catálogo público, filtros, precios por volumen y caché  |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Contexto

El catálogo es la puerta de entrada de MayoristaPro. Cualquier visitante, sin iniciar sesión, consulta las ofertas que publican los proveedores verificados, las filtra por categoría, proveedor y disponibilidad, y ve los precios por volumen (por ejemplo, «desde 10 cajas, S/ 45.00 la caja»).

Es también la pantalla con más tráfico. El escenario de escalabilidad del Sprint 1 exige soportar hasta 2000 usuarios virtuales concurrentes en k6, por lo que el listado se sirve desde una caché Redis que se invalida automáticamente cuando cambia cualquier dato visible (producto, proveedor, empresa, escala de precio o foto).

Origen: historias de usuario del [Sprint 1](../../../sprint-1/01-analisis-de-sistema/02-historias-del-usuario.md), [experiencia de catálogo](../../experiencia-catalogo.md) y [caché Redis](../../redis-catalogo.md).

---

## 2. Objetivo

Implementar un catálogo público, rápido y siempre consistente:

- Listado paginado de productos visibles sin necesidad de sesión.
- Búsqueda literal y filtros por categoría, proveedor y disponibilidad, con orden por precio.
- Opciones de filtro que solo muestran categorías y proveedores con productos visibles.
- Precios por volumen (hasta 5 escalas por producto) definidos por el proveedor dueño.
- Caché Redis con invalidación confirmada por transacción y fallo abierto hacia PostgreSQL.

---

## 3. Actores involucrados

| Actor | Permisos en este módulo |
| ----- | ----------------------- |
| Visitante (sin sesión) | Consultar el catálogo, buscar, filtrar, ordenar y ver la ficha |
| Comprador (`buy`) | Lo mismo que el visitante, y además agregar a la Lista de pedido y cotizar |
| Proveedor verificado (`publish`) | Definir y reemplazar las escalas de precio de sus propios productos |
| Administrador de plataforma | Consultar el catálogo; retira productos desde [Moderación](../05-moderacion/requirements.md) |
| Sistema (Redis + triggers) | Guardar respuestas en caché e invalidarlas al confirmar cambios |

---

## 4. Glosario

| Término | Definición |
| ------- | ---------- |
| Producto visible | Producto `published`, de un proveedor `verified`, cuya empresa no está `suspended` y que no fue retirado por el administrador |
| Disponible | Stock vigente mayor o igual al pedido mínimo (`stock >= minimum`) |
| Presentación | Unidad de venta: `unidad`, `paquete`, `docena`, `caja` o `saco` |
| Escala de precio | Precio por presentación más bajo que aplica desde una cantidad mínima (`product_price_tiers`) |
| Revisión del catálogo | Contador en `catalog_cache_revision` que sube una vez por cada transacción confirmada que cambia datos visibles |
| Cache-Aside | Patrón en que la aplicación busca primero en la caché y, si no está, lee la base y guarda el resultado |

---

## 5. Requisitos funcionales

### RF-CAT-01 — Listar el catálogo sin sesión

El sistema debe devolver los productos visibles, paginados.

**Endpoint:** `GET /api/v1/products`
**Acceso:** Público
**Parámetros:** `page` (≥ 1, por defecto 1), `limit` (1 a 100, por defecto 20)

**Datos por producto:** nombre, categoría, proveedor y su ciudad de despacho, presentación, unidades por presentación, precio en PEN, indicador de IGV, pedido mínimo, múltiplo, disponibilidad, escalas de precio, fotos y descripción.

**Validaciones:**

- `page` o `limit` fuera de rango → HTTP 400 «Página o límite inválidos.», sin consultar la base.
- La respuesta lleva `Cache-Control: no-store` para que ningún navegador ni proxy guarde una versión vieja.

#### Criterios de aceptación (EARS)

1. CUANDO un visitante solicite `GET /api/v1/products`, EL sistema DEBERÁ devolver solo productos visibles, paginados (20 por defecto, máximo 100).
2. EL sistema DEBERÁ incluir por producto los datos listados arriba.
3. SI `page` o `limit` son inválidos, ENTONCES EL sistema DEBERÁ responder 400 sin consultar la base.
4. EL sistema NO DEBERÁ exponer precios negociados ni datos privados de la empresa.

---

### RF-CAT-02 — Buscar, filtrar y ordenar

El sistema debe permitir combinar búsqueda de texto, filtros y orden por precio.

**Endpoint:** `GET /api/v1/products`
**Parámetros opcionales:** `q` (≤ 120 caracteres), `category` (≤ 100), `supplier` (UUID), `available` (`true`/`false`), `sort` (`price-asc`/`price-desc`)

**Reglas:**

- La búsqueda es **literal** sobre nombre, proveedor y categoría: no interpreta `%`, `_` ni otros comodines.
- Los filtros se aplican en SQL **antes** de paginar.
- Cualquier parámetro inválido → HTTP 400 «Filtros de catálogo inválidos.».

#### Criterios de aceptación (EARS)

1. CUANDO se envíe `q`, EL sistema DEBERÁ buscar de forma literal en nombre, categoría y proveedor, sin interpretar comodines.
2. CUANDO se envíen `category`, `supplier` o `available`, EL sistema DEBERÁ aplicar los filtros antes de paginar.
3. CUANDO se envíe `sort=price-asc|price-desc`, EL sistema DEBERÁ ordenar por precio por presentación, con desempate estable por ID.
4. SI algún filtro es inválido, ENTONCES EL sistema DEBERÁ responder 400.

---

### RF-CAT-03 — Opciones de filtro

El sistema debe devolver las categorías y proveedores que tienen al menos un producto visible.

**Endpoint:** `GET /api/v1/products/options`
**Acceso:** Público
**Respuesta:** `{ categories: string[], suppliers: [{ id, name }] }`

#### Criterios de aceptación (EARS)

1. `GET /api/v1/products/options` DEBERÁ devolver solo categorías y proveedores con al menos un producto visible.
2. CUANDO una empresa sea suspendida, sus proveedores NO DEBERÁN aparecer en las opciones.

---

### RF-CAT-04 — Precios por volumen

El proveedor dueño debe poder definir hasta 5 escalas de precio por producto.

**Endpoint:** `PUT /api/v1/trade/products/:id/price-tiers`
**Acceso:** Proveedor dueño, verificado, con permiso `publish`
**Body:** `{ "escalas": [{ "desde": 10, "precioUnitario": "45.00" }] }`

**Validaciones obligatorias:**

- De 0 a 5 escalas; una lista vacía elimina las escalas.
- Cada `desde` es mayor que el pedido mínimo y que la escala anterior, sin repetir.
- Cada `desde` es múltiplo del incremento del producto (para que se pueda alcanzar).
- Cada precio es estrictamente menor que el precio base y que la escala anterior, con hasta 2 decimales.

#### Criterios de aceptación (EARS)

1. CUANDO el proveedor dueño envíe las escalas, EL sistema DEBERÁ reemplazarlas en una sola transacción.
2. SI alguna regla de las escalas no se cumple, ENTONCES EL sistema DEBERÁ responder 422 con el motivo.
3. SI quien envía no es el proveedor dueño verificado con permiso `publish`, ENTONCES EL sistema DEBERÁ responder 403.
4. EL catálogo público DEBERÁ mostrar las escalas vigentes, y la ficha DEBERÁ calcular el precio aplicable a la cantidad elegida.

---

### RF-CAT-05 — Caché con invalidación confirmada

El listado y las opciones deben servirse desde Redis cuando sea posible, sin mostrar datos desactualizados.

**Componentes:** `CachedProducts` (decorador), `RedisCatalogCache`, tabla `catalog_cache_revision` y triggers diferidos.

#### Criterios de aceptación (EARS)

1. CUANDO llegue una consulta pública, EL sistema DEBERÁ buscarla en Redis con una clave que incluya el esquema, la revisión vigente, la ruta y los parámetros; si no existe (miss), DEBERÁ leer PostgreSQL y guardarla con TTL de 30 s.
2. CUANDO una transacción cambie productos, proveedores, empresas, escalas o fotos, EL sistema DEBERÁ incrementar la revisión una sola vez y solo al confirmar; un rollback NO DEBERÁ invalidarla.
3. SI Redis no responde en 100 ms o está caído, ENTONCES EL sistema DEBERÁ responder desde PostgreSQL sin error para el usuario.
4. SI la revisión cambió mientras se leía de la base, ENTONCES EL sistema NO DEBERÁ guardar ese resultado en caché.
5. Las operaciones privadas (cotizaciones, pedidos, Mis productos) NO DEBERÁN cachearse.

---

### RF-CAT-06 — Interfaz del catálogo

El frontend debe presentar el catálogo de forma clara en computadora y en celular.

**Componentes:** `apps/web/src/catalog.ts`, `catalog.html`, `catalog-product.ts`, `wholesale-quantity.ts`

**Elementos:** carrusel de portada, sección «Qué puedes comprar» con foto por categoría, filtros laterales fijos (desplegables en celular), tarjetas con foto, precio, escalas y botón «Ver detalle», y selector de cantidad que respeta mínimo y múltiplo.

---

## 6. Requisitos no funcionales

| ID | Atributo | Detalle |
| -- | -------- | ------- |
| RNF-CAT-01 | Rendimiento | p95 menor a 500 ms con 2000 usuarios virtuales (k6, escenario stress) |
| RNF-CAT-02 | Disponibilidad | Si Redis falla, el catálogo sigue respondiendo desde PostgreSQL (fallo abierto) |
| RNF-CAT-03 | Consistencia | Ningún usuario ve datos de una revisión anterior después de un commit; el TTL de 30 s es solo una red de seguridad |
| RNF-CAT-04 | Seguridad | SQL parametrizado en todos los filtros; búsqueda con `strpos` para evitar comodines e inyección |
| RNF-CAT-05 | Escalabilidad | La clave de caché incluye un hash del esquema y la base, de modo que varias instancias o esquemas no se mezclan |
| RNF-CAT-06 | Usabilidad | Diseño responsive de 320 a 1440 px sin desborde horizontal; botones táctiles de al menos 44 px |
| RNF-CAT-07 | Exactitud monetaria | Precios `numeric(12,2)` en PostgreSQL y cadenas decimales en la API (sin binario flotante) |

---

## 7. Criterios de aceptación del módulo

La funcionalidad se considera **completamente aceptada** cuando:

- [x] `GET /api/v1/products` sin sesión devuelve 20 productos visibles y la paginación.
- [x] `GET /api/v1/products?limit=101` responde 400.
- [x] `GET /api/v1/products?supplier=abc` responde 400 (no es UUID).
- [x] `GET /api/v1/products?sort=nombre` responde 400.
- [x] La búsqueda `q=100%` no actúa como comodín.
- [x] `GET /api/v1/products/options` no incluye proveedores sin productos visibles ni empresas suspendidas.
- [x] `PUT …/price-tiers` con precio mayor al base responde 422.
- [x] `PUT …/price-tiers` sobre un producto ajeno responde 403.
- [x] Tras confirmar un cambio de precio, la siguiente consulta ya no usa la clave anterior.
- [x] Un rollback no cambia la revisión del catálogo.
- [x] Con Redis detenido, el catálogo responde 200 desde PostgreSQL.
- [x] k6 stress con 2000 usuarios virtuales: 0 % de errores.

---

## 8. Flujo de una consulta con caché

```
           GET /api/v1/products?page=1&q=arroz
                         │
                         ▼
               ¿Redis disponible? ──no──► leer PostgreSQL ─► responder
                         │ sí
                         ▼
            leer revisión vigente (PostgreSQL)
                         │
                         ▼
      clave = esquema : revisión : ruta : hash(parámetros)
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
          HIT (existe)          MISS (no existe)
              │                     │
   ¿revisión sigue igual?     leer PostgreSQL
        │ sí      │ no              │
        ▼         ▼                 ▼
    responder  leer base    ¿revisión sigue igual?
                              │ sí          │ no
                              ▼             ▼
                    guardar (TTL 30 s)   no guardar
                              │             │
                              └──── responder ┘
```

---

## 9. Trazabilidad SDD

| Artefacto | Archivo |
| --------- | ------- |
| Diseño técnico | [`design.md`](design.md) |
| Tareas de implementación | [`tasks.md`](tasks.md) |
| Controlador | `apps/api/src/catalog/presentation/products.controller.ts` |
| Caso de uso | `apps/api/src/catalog/application/list-products.ts` |
| Infraestructura | `apps/api/src/catalog/infrastructure/` (`postgres-products.ts`, `cached-products.ts`, `redis-catalog-cache.ts`, `price-tiers-sql.ts`) |
| Dominio de escalas | `apps/api/src/trade/domain/price-tiers.ts` |
| Migraciones | `database/migrations/001_catalog.sql`, `007_catalog_cache.sql`, `008_price_tiers.sql` |
| Frontend | `apps/web/src/catalog.ts`, `catalog.html`, `catalog-product.ts`, `wholesale-quantity.ts` |
| Contrato OpenAPI | `apps/api/openapi.yaml` (Swagger en `/api-docs`) |
| Pruebas | `tests/catalog*.cjs`, `tests/price-tiers*.cjs`, `tests/k6/catalogo.k6.js` |
