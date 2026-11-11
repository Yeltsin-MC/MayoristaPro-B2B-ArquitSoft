# T4 — Cotizaciones, pedidos y reserva de stock

## Estado y dependencias

**SDD preparada; implementación y pruebas T4 pendientes.** D2 y D4 aprobadas el 11/11/2026 en [preparación del sprint](05-preparacion-sprint-2.md). Tras consultar GitHub, `origin/main` continúa en `8c2e5b4` (T2); T3, cerrada en `55006f9`, todavía no está incorporada. Por instrucción del proyecto, esta rama `docs/preparacion-t4` contiene solo documentación.

Después de fusionar T3, actualizar `main`, incorporar esta preparación documental y crear **`sprint-2/cotizaciones-pedidos` desde ese `main` actualizado**. No comenzar código ni migraciones T4 sobre una base anterior a T3. La fusión de cualquiera de las ramas requiere revisión; este trabajo no la realiza.

Fuentes: [flujo y permisos](03-diseno-de-software/flujo-comercial-sprint-2.md), [API](03-diseno-de-software/contratos-api-rest.md), [esquema](03-diseno-de-software/esquema-base-de-datos.md) y [reglas mayoristas](03-diseno-de-software/reglas-comerciales-mayoristas.md). Lo siguiente especifica comportamiento futuro, no evidencia de ejecución.

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

Regla técnica propuesta para el cálculo comercial: entradas monetarias como cadenas decimales positivas para precio y no negativas para envío, máximo dos decimales; rechazar exceso de escala, no truncarlo. Usar aritmética decimal exacta en servidor/PostgreSQL `numeric`, sin `Number`/flotantes binarios para operaciones monetarias. `R2(x)` significa redondeo a dos decimales, mitad hacia arriba para importes no negativos. Calcular `subtotal_i = R2(cantidad_i × precio_i)` y `subtotal_productos = suma(subtotal_i)`. Validar desbordamiento antes de persistir.

Para la demo aprobada, cada precio por presentación incluye IGV y el envío es un importe final fijo o S/ 0. El total es `R2(subtotal_productos + costo_envio_final)`; informar «IGV incluido en precios; no se calcula desglose fiscal». Ejemplo ejecutable previsto: 2 cajas × `48.00` = `96.00`, envío `0.00`, total `96.00`. No sumar IGV por segunda vez. El desglose es comercial: productos y envío, sin inventar un importe fiscal de impuesto.

La demo rechaza ofertas con precios que excluyen IGV o sin importe final de envío. El envío se suma por el importe final declarado, sin calcular ni desglosar impuestos del transporte. Ejemplo: productos S/ 96.00 y envío final S/ 8.00 dan un total de S/ 104.00. La tasa, la base imponible y el desglose tributario quedan fuera de esta demo. Los rangos de volumen sin precio quedan pendientes.

Guardar en oferta y copiar al pedido cada cantidad/presentación, precio unitario, subtotal, indicador de IGV, envío, total, moneda y plazo; no recalcular el pedido desde el catálogo después de aceptar. Los cambios incompatibles obligan a recotizar. El precio público no sustituye al negociado.

## Contrato y persistencia previstos

Base `/api/v1`, Bearer y permisos de T2 vigentes en cada llamada. Se requieren listas/detalles de solicitudes y pedidos filtrados por participación. Las rutas documentadas continúan como objetivo: `POST/GET /quotations`, `POST /quotations/:id/responses`, `PATCH /quotations/:id/responses/:respuestaId/accept`, `POST/GET /orders`, `GET /orders/:id`.

- Oferta: añadir al contrato existente `precioIncluyeIgv`, `costoEnvio`, `diasEntrega`, `vigenteHasta`, ítems y desglose calculado por servidor; en caso de indicadores por ítem, conservarlos sin mezclar bases fiscales indeterminadas. La solicitud no contiene precios privados de otros proveedores.
- Pedido: cuerpo con oferta aceptada e `Idempotency-Key`; importes y participantes obtenidos del servidor. Errores de negocio distinguibles: `OFFER_EXPIRED`, `INSUFFICIENT_STOCK`, `CONDITIONS_CHANGED`, `ALREADY_ACCEPTED` e `IDEMPOTENCY_CONFLICT`. Códigos HTTP coherentes con el contrato: 401/403/404 según acceso, 409 para conflictos y 422 para cantidades o precios inválidos.
- Restricciones: una aceptación por solicitud; un pedido por oferta; unicidad de idempotencia por empresa/operación/clave; una reserva por pedido/producto; FK y comprobación de pertenencia entre solicitud, destinatario, oferta, ítems y proveedor; stock nunca negativo.
- Transacción: bloqueo estable de productos y actualización condicional de stock, pedido/ítems/reservas/auditoría juntos. Coordinación con importaciones T3 para que ninguna actualización masiva reponga stock reservado. La aceptación por sí sola no modifica existencias.
- No fijar una duración de reserva de pago por analogía con los 30 minutos de vista previa T3. Ese plazo pertenece a D3; el contrato de vencimiento de reserva se cerrará antes de T5. T4 no inventa una tarea de liberación automática.

## Criterios y pruebas previstas

Todos los casos siguientes están **pendientes de escribir y ejecutar**. Los archivos son destinos propuestos, no pruebas existentes. Cada caso debe registrar estado inicial, respuesta HTTP y estado final PostgreSQL.

| ID | Criterio | Prueba prevista |
|---|---|---|
| T4-AC01 | Solicitud a varios proveedores; permisos `buy`/`publish`, verificación y participación vigente. | `tests/orders.integration.cjs`, caso `AC01`: dos destinatarios autorizados, comprador ajeno, proveedor no destinatario, pendiente y acceso revocado. |
| T4-AC02 | Ofertas privadas: comprador ve las recibidas, proveedor solo la propia; catálogo no filtra importes negociados. | Mismo archivo, `AC02`: listas y acceso directo por UUID; buscar datos de competidor en JSON y catálogo público. |
| T4-AC03 | Una aceptación por solicitud, incluso concurrentemente, sin reserva anticipada. | `AC03`: dos usuarios compradores de la misma empresa, conexiones y ofertas distintas; llamadas concurrentes coordinadas; una aceptación y un conflicto; stock intacto. Repetición de ganadora devuelve la misma aceptación. |
| T4-AC04 | Pedido único e idempotente, también con claves diferentes; misma clave con otra oferta da conflicto. | `AC04`: reintentos secuenciales y concurrentes, comprobar un pedido y una sola deducción/reserva. Reintento autorizado posterior devuelve el pedido ya creado. |
| T4-AC05 | Oferta vencida no produce pedido ni reserva; motivo visible y nueva solicitud disponible. | `AC05`: vencimiento en PostgreSQL antes de crear; estado sin efectos. `tests/quotations.browser.cjs`: mostrar motivo y crear nueva solicitud, sin reabrir la anterior. |
| T4-AC06 | Validar condiciones, presentación, mínimo/múltiplo y stock al reservar. | `AC06`: presentación incompatible, cantidad inválida, cambio relevante tras oferta y stock insuficiente; cero efectos; precios aceptados no se sustituyen por catálogo. |
| T4-AC07 | Dos compradores compiten por las mismas existencias sin sobreventa. | `AC07`: dos empresas, dos ofertas aceptadas de solicitudes distintas, conexiones separadas y barrera de concurrencia; stock inicial 5, cada pedido solicita 4. Exactamente un pedido con reserva 4, otro conflicto y stock final 1. |
| T4-AC08 | Fallo intermedio revierte stock, pedido, ítems, reservas e idempotencia/auditoría. | `AC08`: inyectar fallo SQL después de descontar stock y antes de terminar; comparar tablas y stock inicial/final; retirar fallo y reintentar con la misma clave. |
| T4-AC09 | Total decimal y desglose mostrados antes de aceptar y copiados al pedido. | `tests/pricing.test.cjs`, `AC09`: `3 × 0.10 = 0.30`, `2 × 48.00 = 96.00`, exceso de escala rechazado, sin doble IGV, envío final fijo y envío cero, y rechazo de precios sin IGV incluido. Integración compara oferta/pedido; escenarios fiscales adicionales esperan decisión. |
| T4-AC10 | Recorrido Angular termina en pedido pendiente con reserva activa. | `tests/quotations.browser.cjs`, `AC10`: comprador solicita a dos proveedores, estos responden con sesión propia; comprador ve desglose, acepta y crea pedido; comprobar detalle, stock y reserva en PostgreSQL; sin checkout. |
| T4-AC11 | No romper identidad, carga masiva ni catálogo. | Compilación Angular/NestJS, regresión T1–T3 y sus pruebas de navegador; verificar que reimportar un SKU reservado conserva stock vigente. |

## Secuencia de implementación después de fusionar T3

1. Actualizar `main`, incorporar esta SDD y crear `sprint-2/cotizaciones-pedidos`; implementar el alcance de demo aprobado y dejar fuera combinaciones que requieren cálculo fiscal.
2. Implementar migraciones y restricciones, cálculo decimal y pruebas de dominio; luego permisos, cotización, aceptación y reserva transaccional con pruebas PostgreSQL.
3. Implementar pantallas y motivos de error/nueva solicitud; automatizar el recorrido de navegador con participantes ficticios.
4. Ejecutar migraciones, compilación, regresión T1–T3 y nuevos casos T4, y navegador. Registrar resultados reales, no solo el plan; subir la rama sin fusionar a `main`.

**Verificación realizada en esta preparación:** lectura de las cinco fuentes, consulta de referencias Git remotas, comprobación de dependencia y revisión documental. No se añadieron migraciones, API, pantalla ni pruebas ejecutables T4. No se ejecutaron compilación o pruebas funcionales como evidencia T4 porque su implementación está expresamente pendiente de la fusión T3.
