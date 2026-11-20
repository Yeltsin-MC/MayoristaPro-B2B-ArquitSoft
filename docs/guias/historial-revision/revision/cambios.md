# Correcciones de la revisión (noviembre 2026)

Cada corrección está en un commit separado sobre el [punto 0](punto-0.md) (`8218f54`), para revisarla o revertirla sola con `git revert <commit>`.

| # | Commit | Qué cambia | Por qué |
|---|---|---|---|
| 0 | `chore: punto 0…` | Solo este registro. | Marca la versión de partida. |
| 1 | `style: Prettier y ESLint…` | Configuración de Prettier y ESLint; `npm run format`, `format:check` y `lint` (también en CI). Formateo de `apps/api/src` y `apps/web/src`. | Había archivos con métodos completos en una sola línea (`postgres-trade.ts`, `identity.service.ts`). |
| 2 | `refactor(api): AppModule, IdentityModule…` | `AppModule` como raíz; `IdentityModule` con una sola instancia de `IdentityService`; `DatabaseModule` con un único `Pool` (`DATABASE_POOL_SIZE`, 20 por defecto). | `CatalogModule` hacía de raíz y había siete pools de PostgreSQL y tres instancias de `IdentityService`. |
| 3 | `refactor(api): formato único de errores…` | `DomainError` común y `ApiExceptionFilter` global: todo error responde `{ statusCode, code, message }`. | Cada módulo devolvía errores con otro formato. Corrige `FORBIDDEN` (409 → 403) y `ATTEMPT_NOT_FOUND` (409 → 404) en pagos. |
| 4 | `refactor(trade): reglas… en el dominio` | `offerLines`, `assertAcceptable`, `reservationQuantities` y `assertCoversRequest` en `trade/domain`; `PostgresTrade` solo lee, bloquea y guarda. Pruebas unitarias nuevas. | Las reglas de negocio estaban dentro de la capa de infraestructura, contra lo que declara Clean Architecture. |
| 5 | `feat(web): rutas con Angular Router…` | Rutas `/`, `/cuenta`, `/cuenta/cotizaciones/:id`, `/cuenta/pedidos/:id`, `/accept-invitation` y `/payments/:result`. La API devuelve `index.html` en rutas de Angular. | Todo vivía en una sola página: no se podía enlazar ni recargar una cotización o un pedido. |

## Qué no cambió

- Las transacciones, bloqueos (`FOR UPDATE`, `LOCK TABLE`) e idempotencia de pedidos e importaciones siguen iguales.
- La autorización se sigue resolviendo dentro de cada transacción (`tradeIdentity`, `requireSupplier`). No se movió a un *guard* de Nest porque el guard corre fuera de la transacción y se perdería el bloqueo de la membresía, que evita carreras al revocar accesos.
- Contratos REST: mismas rutas y cuerpos; las respuestas de error solo suman los campos `statusCode` y `code`.

## Verificación

- `npm run format:check` y `npm run lint`: sin errores (quedan 55 avisos de `any`, para migrar a DTOs más adelante).
- `npm run test:unit`: 17 correctas (antes 10).
- `npm run test:integration`: 111 correctas.
- `npm run test:browser`: 12 correctas; `demo-ux.browser.cjs` y `demo.browser.cjs` también pasan.
