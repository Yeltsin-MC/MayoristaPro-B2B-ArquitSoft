# Requisitos — Catálogo público, filtros, precios por volumen y caché

## Introducción

El catálogo es la puerta de entrada de MayoristaPro: cualquier visitante, sin iniciar sesión, consulta las ofertas publicadas por proveedores verificados, las filtra y ve los precios por volumen. Para soportar picos de consulta (escenario de escalabilidad del Sprint 1, k6 hasta 2000 usuarios) el listado se sirve desde una caché Redis que se invalida cuando cambia cualquier dato visible.

Origen: historias de usuario del [Sprint 1](../../../sprint-1/01-analisis-de-sistema/02-historias-del-usuario.md), [T1 base del catálogo](../../base-catalogo.md), [experiencia de catálogo](../../experiencia-catalogo.md) y [caché Redis](../../redis-catalogo.md).

## Glosario

- **Producto visible:** producto `published`, de un proveedor `verified`, cuya empresa está `enabled` y no fue retirado por el administrador.
- **Disponible:** stock vigente mayor o igual al pedido mínimo.
- **Escala de precio:** precio unitario menor que aplica desde una cantidad mínima (`product_price_tiers`).
- **Revisión del catálogo:** contador en `catalog_cache_revision` que sube en cada transacción que cambia datos visibles.

## Requisitos

### Requisito 1: Consultar el catálogo sin sesión

**Historia de usuario:** Como comprador visitante, quiero ver los productos publicados sin registrarme, para evaluar la plataforma antes de crear una cuenta.

#### Criterios de aceptación

1. CUANDO un visitante solicite `GET /api/v1/products`, EL sistema DEBERÁ devolver solo productos visibles, paginados (20 por defecto, máximo 100).
2. EL sistema DEBERÁ incluir por producto: nombre, categoría, proveedor, presentación, unidades por presentación, precio PEN, indicador de IGV, mínimo, múltiplo, disponibilidad, escalas de precio y fotos.
3. SI `page` o `limit` son inválidos, ENTONCES EL sistema DEBERÁ responder 400 sin consultar la base.
4. EL sistema NO DEBERÁ exponer stock exacto, precios negociados ni datos privados de la empresa.

### Requisito 2: Buscar, filtrar y ordenar

**Historia de usuario:** Como comprador, quiero buscar por texto y filtrar por categoría, proveedor y disponibilidad, para encontrar rápido lo que necesito.

#### Criterios de aceptación

1. CUANDO se envíe `q` (hasta 120 caracteres), EL sistema DEBERÁ buscar de forma literal en nombre, categoría y proveedor, sin interpretar comodines.
2. CUANDO se envíen `category`, `supplier` (UUID) o `available`, EL sistema DEBERÁ aplicar los filtros antes de paginar.
3. CUANDO se envíe `sort=price-asc|price-desc`, EL sistema DEBERÁ ordenar por precio por presentación.
4. `GET /api/v1/products/options` DEBERÁ devolver solo categorías y proveedores que tienen al menos un producto visible.
5. SI algún filtro es inválido, ENTONCES EL sistema DEBERÁ responder 400.

### Requisito 3: Precios por volumen

**Historia de usuario:** Como proveedor, quiero publicar precios más bajos por cantidad, para incentivar compras grandes.

#### Criterios de aceptación

1. CUANDO el proveedor dueño envíe `PUT /api/v1/trade/products/:id/price-tiers`, EL sistema DEBERÁ reemplazar sus escalas en una transacción.
2. EL sistema DEBERÁ aceptar de 0 a 5 escalas (una lista vacía las elimina), con cantidades crecientes, mayores que el pedido mínimo y múltiplos del incremento, y precios estrictamente decrecientes y menores que el precio base.
3. SI quien envía no es el proveedor dueño verificado con permiso `publish`, ENTONCES EL sistema DEBERÁ responder 403.
4. EL catálogo público DEBERÁ mostrar las escalas vigentes y la ficha DEBERÁ calcular el precio aplicable a la cantidad elegida.

### Requisito 4: Caché con invalidación confirmada

**Historia de usuario:** Como operador de la plataforma, quiero que el catálogo responda rápido bajo carga sin mostrar datos desactualizados.

#### Criterios de aceptación

1. CUANDO llegue una consulta pública, EL sistema DEBERÁ buscarla en Redis con una clave que incluya página, filtros, esquema y revisión vigente; si no existe (miss), DEBERÁ leer PostgreSQL y guardarla con TTL de 30 s.
2. CUANDO una transacción cambie productos, proveedores, empresas, escalas o fotos, EL sistema DEBERÁ incrementar la revisión una sola vez y solo al confirmar (commit); un rollback NO DEBERÁ invalidarla.
3. SI Redis no responde en 100 ms o está caído, ENTONCES EL sistema DEBERÁ responder desde PostgreSQL sin error para el usuario.
4. Las operaciones privadas (cotizaciones, pedidos, Mis productos) NO DEBERÁN cachearse y DEBERÁN responder con `Cache-Control: no-store`.
