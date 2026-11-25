# SOLID y patrones de diseño en el código

Actividad 6 del Sprint 2: dónde se aplican los principios SOLID y los patrones de diseño
en la implementación real. El diseño propuesto está en
[Sprint 1 · patrones de diseño](../sprint-1/03-diseno-de-software/diseno-interno/patrones-de-diseno.md);
aquí cada fila apunta a un archivo que existe en `apps/api/src` (backend) o `apps/web/src` (frontend).

## Principios SOLID

| Principio | Qué dice | Dónde se cumple | Cómo explicarlo |
|---|---|---|---|
| **S** · Responsabilidad única | Cada clase tiene un solo motivo para cambiar. | `catalog/application/list-products.ts` (`ListProducts` solo convierte página y filtros en una lectura), `catalog/infrastructure/postgres-products.ts` (solo SQL), `catalog/infrastructure/redis-catalog-cache.ts` (solo Redis), `common/api-exception.filter.ts` (solo traduce errores a HTTP). | Si cambia la consulta SQL no se toca la caché, y si cambia Redis no se toca la regla de paginación. |
| **O** · Abierto/cerrado | Se extiende sin modificar lo que ya funciona. | `catalog/infrastructure/cached-products.ts`: la caché se agregó envolviendo a `PostgresProducts` sin cambiar su código. `trade/domain/fulfillment.ts`: los estados de despacho están en la tabla `TRANSITIONS`; un estado nuevo es una fila más. | Para agregar Redis no se editó el repositorio de PostgreSQL: se puso una capa encima. |
| **L** · Sustitución de Liskov | Una implementación puede reemplazar a otra sin romper a quien la usa. | `PostgresProducts` y `CachedProducts` implementan la misma interfaz `ProductReader`; `ListProducts` funciona igual con cualquiera de las dos. `MercadoPagoGateway` trabaja en modo real o simulado (`useMock`) con el mismo contrato `PaymentGateway`. | Las pruebas `tests/catalog-cache.test.cjs` (RC06) comprueban que si Redis falla se responde igual desde PostgreSQL. |
| **I** · Segregación de interfaces | Interfaces pequeñas, con solo lo que el cliente necesita. | `ProductReader` (2 métodos) en `catalog/application/list-products.ts`; `PublicCatalogCache` y `CatalogRevision` separadas en `catalog/application/public-catalog-cache.ts`; `OfferReputation` (1 método) en `ai/application/offer-reputation.ts`. | El caso de uso del catálogo no ve métodos de escritura porque solo lee. |
| **D** · Inversión de dependencias | Los casos de uso dependen de abstracciones, no de PostgreSQL ni de Redis. | `ListProducts` recibe `ProductReader` (token `PRODUCT_READER`); `Trade` recibe `TradeStore` (token `TRADE_STORE`); `Payments` recibe `PaymentStore` y `PaymentGateway`; `AiService` recibe `OfferReputation`. Las implementaciones se conectan en los módulos (`catalog.module.ts`, `trade.module.ts`, `payments.module.ts`, `ai.module.ts`). | El dominio no importa NestJS, `pg` ni `redis`, y dominio y aplicación no importan infraestructura ni presentación. Lo comprueba `tests/architecture.test.cjs`. |

## Patrones de diseño

| Patrón | Archivo | Para qué sirve aquí |
|---|---|---|
| **Repository** | `catalog/infrastructure/postgres-products.ts`, `trade/infrastructure/postgres-trade.ts`, `payments/infrastructure/postgres-payments.ts`, `ai/infrastructure/postgres-offer-reputation.ts` | Esconden el SQL detrás de una interfaz (`ProductReader`, `TradeStore`, `PaymentStore`, `OfferReputation`). |
| **Inyección de dependencias** | `*.module.ts` con `provide` / `useFactory` / `useClass` y tokens `Symbol(...)` | Nest arma el grafo: en producción conecta PostgreSQL y Redis; en pruebas se pueden pasar dobles. |
| **Decorator** | `catalog/infrastructure/cached-products.ts` | `CachedProducts` envuelve al repositorio y añade caché Redis con la misma interfaz (cache-aside por revisión del catálogo). |
| **Adapter** | `payments/infrastructure/mercadopago-gateway.ts`, `ai/application/ai.service.ts` (HTTP a FastAPI), `catalog/infrastructure/redis-catalog-cache.ts` | Traducen contratos propios a servicios externos: Mercado Pago, servicio de IA en Python y Redis. |
| **Use Case / Application Service** | `catalog/application/list-products.ts`, `catalog/application/catalog-imports.ts`, `trade/application/trade.ts`, `payments/application/payments.ts` | Coordinan una operación completa (cotizar, ofertar, crear pedido, importar Excel) sin conocer HTTP. |
| **Value Object / validación de dominio** | `trade/domain/trade.ts` (`money`, `amount`, `positive`, `priceTotal`), `trade/domain/price-tiers.ts` | El dinero se maneja en céntimos (`bigint`) para no perder precisión; una cantidad o precio inválido no entra al sistema. |
| **State (máquina de estados)** | `trade/domain/fulfillment.ts` (preparing → dispatched → delivered), `payments/domain/payment.ts` (`canTransitionTo`) | Solo se permiten transiciones válidas y por el rol correcto; repetir la misma no hace nada (idempotente). |
| **DTO / Draft** | `requestDraft`, `offerDraft` en `trade/domain/trade.ts`; `fulfillmentDraft` en `fulfillment.ts` | Convierten el cuerpo HTTP en datos validados; campos extra (como `platform_admin`) se ignoran. |
| **Exception Filter (traducción de errores)** | `common/domain-error.ts` + `common/api-exception.filter.ts` | El dominio lanza `DomainError` con un código (`OFFER_EXPIRED`); la capa HTTP lo convierte en 404/409/422 con formato único `{ statusCode, code, message }`. |
| **Fallback (degradación controlada)** | `ai/application/ai.service.ts` (bloque `catch`) | Si el servicio de IA cae, la comparación de ofertas sigue funcionando sin puntaje en lugar de fallar. |
| **Unit of Work (transacción)** | método `tx()` en `trade/infrastructure/postgres-trade.ts` e `identity/identity.service.ts` | Pedido, reserva de stock y oferta se guardan juntos o no se guarda nada (`BEGIN`/`COMMIT`, `FOR UPDATE`). |
| **Idempotency Key** | `trade/presentation/trade.controller.ts`, `catalog/presentation/imports.controller.ts` | Repetir la misma solicitud de pedido o de importación no crea duplicados. |
| **Observer (vía base de datos)** | triggers de `database/migrations/012_notifications.sql` | Cada paso del flujo de compra genera un aviso a la empresa interesada sin que la API tenga que acordarse. |
| **Singleton de estado (frontend)** | `apps/web/src/session.service.ts` (`providedIn: 'root'` con *signals*) | Una sola sesión compartida por todas las páginas de Angular. |

## Deuda técnica reconocida

Ser honestos sobre esto también es parte de la defensa:

- `identity/identity.service.ts` (~500 líneas) concentra registro, sesiones, invitaciones, moderación
  y "Mis productos" en una sola clase con SQL directo. Funciona y está probado
  (`tests/identity.integration.cjs`), pero no sigue la separación por capas de `catalog` y `trade`.
  El siguiente paso sería dividirlo en `identity/application` + `identity/infrastructure`, como los demás módulos.
- Los patrones Circuit Breaker y Specification del diseño del Sprint 1 quedaron como "según necesidad":
  hoy basta con el fallback de IA y las validaciones de dominio.
