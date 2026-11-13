# Mejoras B2B (noviembre 2026)

Cada mejora está en commits separados sobre el [punto 0](punto-0.md) (`78af421`), para revisarla o revertirla sola con `git revert <commit>`.

| # | Commit | Qué cambia |
|---|---|---|
| 0 | `chore: punto 0 de las mejoras B2B` | Solo el registro del punto de partida. |
| 1 | `feat(api): precios por volumen por producto` | Migración `008_price_tiers.sql` (tabla `product_price_tiers`). `PUT /trade/products/:id/price-tiers`. `priceTiers` en `GET /trade/products` y en el catálogo público. Reglas en `trade/domain/price-tiers.ts`. |
| 2 | `feat(api): estados de despacho y entrega de pedidos` | Migración `009_order_fulfillment.sql` (estados `preparing`, `dispatched`, `delivered` e historial `trade_order_events`). `PATCH /orders/:id/fulfillment`. Reglas en `trade/domain/fulfillment.ts`. La reputación de la IA cuenta como completados los pedidos pagados y posteriores. |
| 3 | `feat(web): precios por volumen…` | Escalas en la tarjeta y el detalle del catálogo; precio publicado para la cantidad al cotizar; editor «Precios por volumen de mis productos» para el proveedor; precio propuesto al responder una cotización. |
| 4 | `feat(web): seguimiento de despacho…` | Estados en español; pasos Pagado → En preparación → Despachado → Entregado con fecha y nota; botones según el rol. |
| 5 | `docs: …` | Este registro y el contrato REST. |

## Reglas de negocio

**Precios por volumen.** Hasta 5 escalas por producto. Cada escala empieza en una cantidad mayor al mínimo de compra y múltiplo válido, y su precio es menor al precio base y a la escala anterior. Si después el proveedor baja el precio base (por ejemplo, con la carga masiva), las escalas que ya no mejoran ese precio no se muestran. Las escalas son una referencia pública: el precio que vale es el de la oferta privada del proveedor.

**Despacho.** Solo un pedido pagado (`paid`) entra al despacho. El proveedor lo pasa a `preparing` y luego a `dispatched` (con nota opcional: guía de remisión, transportista). El comprador confirma la recepción (`delivered`). Repetir el estado actual no cambia nada; saltarse un paso devuelve 409 `ORDER_STATE_CONFLICT`; el rol equivocado, 403. Cada cambio queda en `trade_order_events` y en `identity_audit`.

## Qué no cambió

- Cotizaciones, aceptación, creación de pedidos, reservas de stock y pagos funcionan igual.
- El precio de una oferta lo sigue escribiendo el proveedor; el servidor no lo fuerza a la escala.

## Verificación

- `npm run format:check` y `npm run lint`: sin errores.
- `npm run test:unit`: 22 correctas (5 nuevas).
- `npm run test:integration`: 109 correctas (6 nuevas en `price-tiers.integration.cjs` y `fulfillment.integration.cjs`).
- `npm run test:browser`: 12 correctas.
