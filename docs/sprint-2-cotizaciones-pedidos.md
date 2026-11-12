# T4 — Cotizaciones, pedidos y reserva de stock

## Estado y dependencias

**T4 implementada para revisión en `sprint-2/cotizaciones-pedidos`.** Rama creada desde `main` actualizado en `2af3b1f`, que incorpora T3. La SDD de `docs/preparacion-t4` hasta `4741615` se incorporó por merge, conservando sus commits. D2 y D4 aprobadas en [preparación del sprint](05-preparacion-sprint-2.md). La fusión de T4 a `main` continúa pendiente de revisión.

Fuentes: [flujo y permisos](03-diseno-de-software/flujo-comercial-sprint-2.md), [API](03-diseno-de-software/contratos-api-rest.md), [esquema](03-diseno-de-software/esquema-base-de-datos.md) y [reglas mayoristas](03-diseno-de-software/reglas-comerciales-mayoristas.md). La matriz final vincula el comportamiento implementado con sus pruebas y evidencia.

## Flujo e invariantes aprobadas

1. Comprador empresarial habilitado con permiso `buy` crea una solicitud con ítems, cantidades por presentación y varios proveedores destinatarios. La empresa se resuelve en servidor. Compartir SKU entre proveedores no acredita equivalencia de productos o presentaciones.
2. Cada proveedor destinatario, verificado y con permiso `publish`, responde con sus propios productos: presentación, equivalencia, mínimo, múltiplo, cantidad, precio PEN, indicador de IGV, envío, plazo y vigencia. El comprador ve las ofertas recibidas; cada proveedor ve solo su propia oferta y los datos de la solicitud necesarios para responder, nunca las ofertas privadas de competidores. Empresas ajenas y administradores sin participación no reciben acceso comercial por su rol.
3. Angular muestra precio por presentación, cantidades, subtotales, tratamiento declarado de IGV, envío, plazo, vigencia y total antes de aceptar. No permite aceptar si el total final no puede determinarse con las reglas fiscales confirmadas.
4. La aceptación bloquea la solicitud y permite exactamente una oferta ganadora. No descuenta ni reserva stock. Repetir la aceptación de la misma oferta devuelve el resultado existente; intentar aceptar otra devuelve 409. La oferta aceptada queda inmutable.
5. Crear pedido desde la oferta aceptada vuelve a autorizar al comprador, bloquea solicitud/oferta y productos en orden estable, verifica vigencia y condiciones relevantes, agrupa cantidades por producto y comprueba stock disponible. En **una conexión y transacción** guarda pedido `pendiente`, ítems históricos y reservas `activas`, y descuenta stock disponible. No puede quedar ningún efecto parcial.
6. Existe como máximo un pedido por oferta aceptada, aun con claves diferentes o solicitudes simultáneas. La idempotencia se delimita por empresa compradora y operación; misma clave y contenido normalizado devuelve el pedido existente, distinta huella devuelve 409. Resolver el pedido existente exige autorización y no vuelve a reservar ni falla por el stock ya reservado por ese mismo pedido.
7. Si la oferta venció, cambiaron condiciones incompatibles o falta stock, devolver un motivo específico y permitir **«Nueva solicitud»** en Angular. No sustituir precios, cantidades ni oferta aceptada silenciosamente; no reabrir la solicitud anterior. La nueva solicitud vuelve a requerir ofertas y aceptación.
8. El recorrido termina con pedido pendiente y stock reservado. No se cobra, consume ni libera la reserva automáticamente en T4. Pasarela, vencimiento operativo de reservas, cancelación y reconciliación se resuelven en T5/D3. Una oferta que vence después de crear el pedido no libera por sí sola la reserva.

Se conservan los mínimos y múltiplos de T3: cantidades enteras positivas, cantidad igual o superior al mínimo y divisible por el múltiplo; mínimo divisible por múltiplo. Presentación y unidades base deben ser compatibles. No reinterpretar stock al cambiar la equivalencia, ni confiar en importes o empresa enviados por el navegador.

## Dinero y decisión fiscal pendiente

**Confirmado:** importes decimales en PEN, indicador de IGV, costo de envío, plazo, desglose previo y copia histórica. **No confirmado:** tasa/regímenes de IGV, base imponible y cálculo adicional para precios sin IGV, extracción del impuesto de un precio incluido, tratamiento del envío y redondeo fiscal. El repositorio no define esos datos; no se fija una tasa ni se presenta un documento tributario por inferencia.

Regla implementada para el cálculo comercial: entradas monetarias como cadenas decimales positivas para precio y no negativas para envío, máximo dos decimales; rechazar exceso de escala, no truncarlo. El dominio convierte a céntimos `bigint`, multiplica por cantidades enteras y suma exactamente; PostgreSQL conserva `numeric(12,2)` para precio y `numeric(24,2)` para subtotal/total. No se usa `Number`/flotante binario para operar dinero. `R2(x)` es redondeo a dos decimales, mitad hacia arriba para importes no negativos: en esta demo, cantidades enteras y precios de hasta dos decimales producen resultados ya exactos, de modo que R2 no altera ningún importe. La entrada `0.105` se rechaza. Se valida desbordamiento antes de persistir.

Para la demo aprobada, cada precio por presentación incluye IGV y el envío es un importe final fijo o S/ 0. El total es `R2(subtotal_productos + costo_envio_final)`; informar «IGV incluido en precios; no se calcula desglose fiscal». Ejemplo ejecutable previsto: 2 cajas × `48.00` = `96.00`, envío `0.00`, total `96.00`. No sumar IGV por segunda vez. El desglose es comercial: productos y envío, sin inventar un importe fiscal de impuesto.

La demo rechaza ofertas con precios que excluyen IGV o sin importe final de envío. El envío se suma por el importe final declarado, sin calcular ni desglosar impuestos del transporte. Ejemplo: productos S/ 96.00 y envío final S/ 8.00 dan un total de S/ 104.00. La tasa, la base imponible y el desglose tributario quedan fuera de esta demo. Los rangos de volumen sin precio quedan pendientes.

Guardar en oferta y copiar al pedido cada cantidad/presentación, precio unitario, subtotal, indicador de IGV, envío, total, moneda y plazo; no recalcular el pedido desde el catálogo después de aceptar. Los cambios incompatibles obligan a recotizar. El precio público no sustituye al negociado.

## Contrato y persistencia implementados

Base `/api/v1`, Bearer y permisos de T2 vigentes en cada llamada. Listas/detalles de solicitudes y pedidos filtrados por participación: `POST/GET /quotations`, `GET /quotations/:id`, `POST /quotations/:id/responses`, `PATCH /quotations/:id/responses/:respuestaId/accept`, `POST/GET /orders`, `GET /orders/:id`. `GET /trade/providers` ofrece proveedores verificados a compradores; `GET /trade/products` devuelve únicamente productos propios publicados al proveedor verificado.

Solicitud: `{proveedorIds:[uuid],items:[{descripcion,presentacion,unidadesPorPresentacion,cantidad}]}`, de 1 a 20 destinatarios y 1 a 50 ítems. No se permite la propia empresa como destinatario. La oferta debe cubrir todos los ítems en la presentación/equivalencia solicitada, usando productos del proveedor. Una respuesta inmutable por proveedor y solicitud. Oferta: `{moneda:"PEN",precioIncluyeIgv:true,costoEnvio:"8.00",diasEntrega:3,vigenteHasta:fechaISO,items:[{solicitudItemId,productoId,cantidad,precioUnitario:"48.00"}]}`. Pedido: `{cotizacionRespuestaId:uuid}` y cabecera `Idempotency-Key` (1–128 caracteres alfanuméricos, punto, guion o guion bajo).

Las respuestas usan campos `isBuyer`, `acceptedOfferId`, `offers`, `subtotal`, `shipping`, `total`, `deliveryDays`, `expiresAt`, `items` y `reservations`. Un proveedor solo recibe su propia oferta y destinatario, y tampoco recibe el ID de la aceptación de un competidor. Estados persistidos: pedido `pendiente`, reserva `activa`, `expiresAt:null`. No se habilitan estados de pago/cancelación o expiración automática.

- Oferta: añadir al contrato existente `precioIncluyeIgv`, `costoEnvio`, `diasEntrega`, `vigenteHasta`, ítems y desglose calculado por servidor; en caso de indicadores por ítem, conservarlos sin mezclar bases fiscales indeterminadas. La solicitud no contiene precios privados de otros proveedores.
- Pedido: cuerpo con oferta aceptada e `Idempotency-Key`; importes y participantes obtenidos del servidor. Errores de negocio distinguibles: `OFFER_EXPIRED`, `INSUFFICIENT_STOCK`, `CONDITIONS_CHANGED`, `ALREADY_ACCEPTED` e `IDEMPOTENCY_CONFLICT`. Códigos HTTP coherentes con el contrato: 401/403/404 según acceso, 409 para conflictos y 422 para cantidades o precios inválidos.
- Restricciones: una aceptación por solicitud; un pedido por oferta; unicidad de idempotencia por empresa/operación/clave; una reserva por pedido/producto; FK y comprobación de pertenencia entre solicitud, destinatario, oferta, ítems y proveedor; stock nunca negativo.
- Transacción: bloqueo estable de productos y actualización condicional de stock, pedido/ítems/reservas/auditoría juntos. Coordinación con importaciones T3 para que ninguna actualización masiva reponga stock reservado. La aceptación por sí sola no modifica existencias.
- No fijar una duración de reserva de pago por analogía con los 30 minutos de vista previa T3. Ese plazo pertenece a D3; el contrato de vencimiento de reserva se cerrará antes de T5. T4 no inventa una tarea de liberación automática.

La migración `004_trade.sql` crea `quotation_requests`, `quotation_items`, `quotation_recipients`, `quotation_offers`, `quotation_offer_items`, `trade_orders`, `trade_order_items`, `stock_reservations` y `order_keys`. La FK compuesta de la aceptación obliga a que la oferta corresponda a su solicitud. Claves compuestas protegen destinatario/producto/proveedor; unicidad protege oferta por destinatario, pedido por oferta/solicitud, reserva por pedido/producto y clave por empresa compradora.

El módulo `trade` mantiene dominio puro (validaciones, condiciones y dinero), casos de aplicación contra el puerto `TradeStore`, adaptador PostgreSQL con unidad de trabajo y controlador NestJS. Reutiliza la identidad T2 sin conceder permisos desde el body. La composición se registra en el monolito. Angular incorpora la sección de cotizaciones/pedidos dentro de la cuenta empresarial.

Antes de bloquear filas, la reserva obtiene intención de escritura sobre productos, compatible con otros pedidos pero incompatible con el bloqueo de importación T3. Luego bloquea productos por ID ordenado. Esto evita invertir bloqueos de tabla/fila con la importación y preserva stock reservado. La clave idempotente se coordina por bloqueo asesor transaccional y la solicitud serializa pedidos de una oferta, incluso con claves distintas. Un interbloqueo/conflicto de serialización se reintenta como máximo una vez; el resto devuelve conflicto recuperable, sin efectos parciales.

## Criterios y pruebas verificadas

Los archivos enlazados existen y se ejecutan con esquemas PostgreSQL aislados que se eliminan al terminar. Ninguna contraseña de pruebas permite acceder a datos reales. La matriz se complementa con el registro de ejecución al final.

| ID | Criterio | Prueba prevista |
|---|---|---|
| T4-AC01 | Solicitud a varios proveedores; permisos `buy`/`publish`, verificación y participación vigente. | [Integración AC01/02](../tests/orders.integration.cjs): dos destinatarios, comprador ajeno, proveedor no destinatario/pendiente, producto ajeno y revocación. |
| T4-AC02 | Ofertas privadas: comprador ve las recibidas, proveedor solo la propia; catálogo no filtra importes negociados. | [Integración AC01/02 y AC03](../tests/orders.integration.cjs): JSON filtrado, acceso directo y aceptación ajena oculta. [Navegador](../tests/quotations.browser.cjs): proveedor no ve total del competidor. |
| T4-AC03 | Una aceptación por solicitud, incluso concurrentemente, sin reserva anticipada. | [Integración AC03](../tests/orders.integration.cjs): dos cuentas de la misma empresa, bloqueo PostgreSQL sostenido hasta observar dos conexiones esperando; un éxito y un 409, stock intacto y ninguna reserva. |
| T4-AC04 | Pedido único e idempotente, también con claves diferentes; misma clave con otra oferta da conflicto. | [Integración AC04/09](../tests/orders.integration.cjs): concurrencia con claves iguales y distintas, huella distinta rechazada y reintento tras vencimiento devuelve pedido existente. [Navegador](../tests/quotations.browser.cjs): repetir creación conserva pedido y stock. |
| T4-AC05 | Oferta vencida no produce pedido ni reserva; motivo visible y nueva solicitud disponible. | [Integración AC05](../tests/orders.integration.cjs) y [navegador AC05/06](../tests/quotations.browser.cjs): `OFFER_EXPIRED`, cero efectos y apertura del formulario de nueva solicitud. |
| T4-AC06 | Validar condiciones, presentación, mínimo/múltiplo y stock al reservar. | [Integración AC06](../tests/orders.integration.cjs) y [dominio](../tests/pricing.test.cjs): validación y cambio incompatible; precio público cambiado no sustituye al negociado. [Navegador](../tests/quotations.browser.cjs): motivos de stock/condiciones y nueva solicitud. |
| T4-AC07 | Dos compradores compiten por las mismas existencias sin sobreventa. | [Integración AC07](../tests/orders.integration.cjs): stock 5 y dos pedidos de 4; barrera comprueba dos conexiones bloqueadas en PostgreSQL antes de liberarlas. Un éxito, un conflicto, reserva 4 y stock final 1. |
| T4-AC08 | Fallo intermedio revierte stock, pedido, ítems, reservas e idempotencia/auditoría. | [Integración AC08](../tests/orders.integration.cjs): constraint SQL inyectada en los ítems tras descontar/reservar; conteos y stock idénticos al inicio, posterior reintento correcto. |
| T4-AC09 | Total decimal y desglose mostrados antes de aceptar y copiados al pedido. | [Dominio AC09](../tests/pricing.test.cjs): `3×0.10=0.30`, `2×48.00=96.00`, envío 0/8, total 104, escala inválida y rechazo sin IGV. [Integración](../tests/orders.integration.cjs) y [navegador](../tests/quotations.browser.cjs) comparan desglose y pedido. |
| T4-AC10 | Recorrido Angular termina en pedido pendiente con reserva activa. | [Navegador AC09/10](../tests/quotations.browser.cjs): tres sesiones reales, dos respuestas privadas, desglose, aceptación sin descuento, pedido pendiente, stock 20→18 y reserva activa 2 comprobados en PostgreSQL; sin checkout. |
| T4-AC11 | No romper identidad, carga masiva ni catálogo. | Regresión [T1](../tests/catalog.integration.cjs), [T2](../tests/identity.integration.cjs), [T3](../tests/imports.integration.cjs) y [navegador T3](../tests/catalog.browser.cjs); [integración AC11](../tests/orders.integration.cjs) reimporta SKU reservado con stock 999 y conserva el stock vigente. |

## Plan ejecutado

1. Se actualizó `main`, se incorporó la SDD hasta `4741615` y se creó `sprint-2/cotizaciones-pedidos` desde T3 fusionada.
2. Se implementaron migración y restricciones, dominio decimal, casos contra puerto de persistencia y adaptador PostgreSQL transaccional con identidad T2.
3. Se implementaron pantallas y motivos de error/nueva solicitud y el recorrido de navegador con participantes ficticios.
4. Se ejecutaron migraciones, compilación, regresión T1–T3, nuevos casos T4 y navegador; resultados y captura en la evidencia. La rama se entrega para revisión sin fusionar a `main`.

## Reproducir y revisar

PostgreSQL debe estar disponible y `.env` configurado fuera de Git. Detener servidores Angular antes de reinstalar dependencias en Windows. Ejecutar `npm ci`, `npm run db:migrate`, `npm run db:seed`, `npm run build`, `npm run test:unit`, `npm run test:integration`. Para navegador, instalar Chromium con `npx playwright install chromium` y ejecutar `npm run test:browser`; si Edge ya está instalado, usar `PLAYWRIGHT_CHANNEL=msedge`.

Las pruebas de navegador sirven Angular compilado y NestJS en un puerto aleatorio con participantes ficticios y comprueban la reserva en PostgreSQL. No requieren servidores en 3000/4200 y eliminan sus esquemas al terminar. Artefactos locales sin secretos: `.angular/t4-evidence/`.

Para uso manual, arrancar `npm run dev:api` y `npm run dev:web`. Preparar por T2 un comprador habilitado con `buy` y dos proveedores verificados con `publish`, e importar por T3 productos publicados de presentación compatible. En «Cotizaciones y pedidos», el comprador crea «Nueva solicitud», selecciona destinatarios e ítems; cada proveedor ingresa con su cuenta, actualiza solicitudes, abre la recibida y responde con producto propio, precio, envío final, plazo y vigencia. El comprador actualiza, abre, revisa desglose y acepta una oferta. «Crear pedido pendiente» muestra las condiciones históricas y la reserva activa. Ante un conflicto, «Nueva solicitud» inicia otro proceso sin reabrir el anterior.

### Resultados reales

Registro final y capturas en [evidencia T4](evidencias/t4-cotizaciones-pedidos.md). La pasarela, liberación automática, IA y despliegue no forman parte de esta implementación. T4-AC01 a T4-AC11 quedan cubiertos por las pruebas enlazadas; la revisión y fusión de esta rama siguen pendientes.

| Comando | Resultado local |
|---|---|
| `npm run db:migrate` | Salida 0; migración T4 aplicada en PostgreSQL real. |
| `npm run db:seed` | Salida 0; datos sintéticos de catálogo. |
| `npm run build` | Salida 0; Angular y NestJS compilados. |
| `npm run test:unit` | 1 prueba aprobada, 0 fallidas. |
| `npm run test:integration` | 28 pruebas aprobadas, 0 fallidas: regresión T1–T3 y T4. |
| `npm run test:browser` con `PLAYWRIGHT_CHANNEL=msedge` | 8 pruebas aprobadas, 0 fallidas: T3 y recorrido/motivos T4 en Edge headless. |

Entorno local: Node 24.21.0, PostgreSQL 18.6 (instancia temporal de demo existente) y Edge 157.0.4341.46. CI conserva PostgreSQL 17 y Chromium; estos resultados corresponden a ejecución local, no se presentan como resultados remotos de CI. Tras iniciar la instancia se comprobó que faltaba la base `mayorista` configurada; se creó esa base local y se aplicaron migraciones/seed, sin modificar `.env` ni crear otra instancia. Las suites se ejecutan secuencialmente y cada archivo de prueba tiene concurrencia 1 para respetar el límite de conexiones de la demo; los casos de carrera dentro de T4 sí usan conexiones y peticiones simultáneas, con barrera PostgreSQL verificada.
