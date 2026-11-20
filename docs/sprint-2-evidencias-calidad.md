# Sprint 2: evidencias de validación de los atributos de calidad

Este documento junta, para cada escenario de calidad del Sprint 1
([08-escenarios-atributos-calidad.md](01-analisis-de-sistema/08-escenarios-atributos-calidad.md)),
la prueba que lo verifica, la herramienta, el resultado obtenido y lo que queda para el Sprint 3.
Responde al punto 8 y al entregable «Evidencias y resultados de validación de los atributos de
calidad» de la guía del Sprint 2.

## Herramientas y cómo reproducir

| Herramienta | Qué valida | Comando | Evidencia |
|---|---|---|---|
| **Jest 30** (unitarias e integración con PostgreSQL, Redis y FastAPI reales) | Reglas de negocio, permisos, concurrencia, idempotencia, caché, arquitectura | `npm run test:coverage` | [cobertura/jest-cobertura-2026-11-20.txt](evidencias/cobertura/jest-cobertura-2026-11-20.txt); en CI, artefacto `cobertura-jest` |
| **Postman / Newman** | Contrato REST, códigos HTTP, formato de error, flujo B2B completo | `npx newman run postman/MayoristaPro.postman_collection.json ...` ([postman/README.md](../postman/README.md)) | [postman/ejecucion-local-2026-11-20.txt](evidencias/postman/ejecucion-local-2026-11-20.txt) |
| **OpenAPI / Swagger UI** | Contrato documentado igual al implementado | `/api-docs` y prueba `tests/openapi.test.cjs` | [apps/api/openapi.yaml](../apps/api/openapi.yaml) |
| **k6** | Rendimiento y escalabilidad hasta 2.000 VU | `npm run test:carga -- humo\|local\|completo` ([pruebas-carga-k6.md](pruebas-carga-k6.md)) | [evidencias/k6/](evidencias/k6/) |
| **Playwright** | Recorridos E2E en navegador | `npm run test:browser` | artefacto `evidencia-demo` del CI |
| **GitHub Actions** | Todo lo anterior (salvo k6) ante cada push y PR | `.github/workflows/ci.yml` | pestaña Actions |

### Cobertura de pruebas (Jest)

27 suites y 44 pruebas aprobadas (20/11/2026). Cobertura sobre el código TypeScript de la API:

| Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|
| 89,13 % (3323/3728) | 86,94 % (719/827) | 92,88 % (222/239) | 89,13 % |

El CI falla si la cobertura baja de 80 % en sentencias, funciones y líneas, o de 75 % en ramas.
Los módulos con menos cobertura son Pagos (adaptador de Mercado Pago, 53–70 %), porque la
pasarela real solo se prueba en su sandbox.

Las pruebas de integración usan un esquema PostgreSQL aislado por suite y la API NestJS real.
Sus subpruebas comparten esa preparación y se ejecutan en orden dentro de una prueba de Jest
mediante un adaptador (`tests/jest/node-test-adapter.cjs`); si una falla, Jest indica cuál.

## Resultados por escenario

Estado: ✅ cumplido con evidencia · 🟡 verificado en parte · ⏳ requiere el despliegue (Sprint 3).

| Escenario | Medida esperada | Cómo se verificó | Resultado | Estado |
|---|---|---|---|---|
| **EQ-01 Rendimiento** | p95 ≤ 500 ms y < 1 % de errores con 2.000 VU | k6 `humo`, `local` y `completo` contra la demo de 15 empresas y 450 productos | 2.000 VU: p95 global 6,02 ms, catálogo 3,67 ms; 0 % de errores en 734.824 peticiones | ✅ en la nube (servidor único); ⏳ repetir contra AWS |
| **EQ-02 Disponibilidad** | 99,5 % mensual, RTO ≤ 4 h, RPO ≤ 1 h | Arranque, healthchecks y prueba de humo del despliegue Docker en CI (`deployment.smoke.cjs`, `deployment-cache.smoke.cjs`); con Redis detenido el catálogo sigue respondiendo desde PostgreSQL | El entorno se levanta y se recupera solo; la caché no es punto único de falla | ⏳ La meta mensual, el monitoreo y la restauración de copias se miden en AWS |
| **EQ-03 Escalabilidad** | 500 → 1.000 → 2.000 VU con las metas de EQ-01 | k6 `completo` (etapas de 500, 1.000 y 2.000 VU) | Las metas de EQ-01 se mantienen en las etapas de 500, 1.000 y 2.000 VU con una sola instancia | 🟡 Falta comparar con varias instancias en AWS |
| **EQ-04 Seguridad** | Rechazar todos los accesos no autorizados | Jest: `identity`, `browser-session`, `payments-security`, `orders` (AC01/02), `ai` (T6-02); Postman: carpeta Identidad y casos 401/403 | Se rechazan token ausente, vencido, falsificado o revocado; rol incorrecto (proveedor que acepta, comprador que publica); empresa ajena; origen ajeno para la cookie; invitaciones vencidas o de otro correo. Las respuestas no exponen datos de otras empresas | ✅ |
| **EQ-05 Mantenibilidad** | Cambiar el adaptador de pagos sin tocar el dominio; dominio sin NestJS, BD ni SDK | Jest: `tests/architecture.test.cjs` y suites de Pagos (P01–P08, S01–S05, R01–R06) | Ningún archivo de `*/domain` importa NestJS, `pg`, Redis, HTTP ni SDK; dominio y aplicación no importan infraestructura ni presentación. Pagos depende de una interfaz de pasarela | ✅ |
| **EQ-06 Concurrencia** | Solo reservas cubiertas por stock; sin duplicados ni reservas huérfanas | Jest `orders.integration.cjs`: AC03 (aceptación concurrente), AC04/09 (pedido idempotente, una sola reserva), AC07 (dos compradores compiten por stock 5 pidiendo 4), AC08 (fallo SQL revierte todo); `payments-recovery` R03–R05 | Bloqueo `FOR UPDATE` comprobado con dos conexiones esperando; un solo pedido gana, el otro se rechaza por stock; stock final correcto; `Idempotency-Key` repetida devuelve el mismo pedido (también en Postman) | 🟡 Falta el ensayo de 500 compradores contra 100 cajas con dos instancias backend |
| **EQ-07 Interoperabilidad** | Sin efectos duplicados; IA con respuesta degradada | Jest `ai.integration.cjs` (T6-01/03, FastAPI real), `payments.integration.cjs` y `payments-recovery` (webhooks) | Si FastAPI falla o responde algo incompatible se conservan las ofertas con `score: null`; webhooks duplicados se deduplican por `notification_id`; un webhook fallido queda pendiente de recuperación | 🟡 Tiempos de los proveedores reales (PSE, pago ≤ 2 s) se miden en el sandbox desplegado |
| **EQ-08 Auditabilidad** | Actor, fecha, entidad y cambio en cada operación, sin secretos | Jest `fulfillment.integration.cjs`, `orders.integration.cjs`, `imports.integration.cjs` (tabla `identity_audit`) | Despacho, pedido, importación e identidad dejan registro con actor y recurso; los tokens se guardan como hash | 🟡 Falta la matriz de 20 operaciones y la revisión en CloudWatch |
| **EQ-09 Usabilidad** | 4 de 5 compradores y 3 de 3 proveedores completan sin ayuda | Playwright E2E (`test:browser`) recorre catálogo, cotización, lista de pedido y continuidad del comprador | Los recorridos principales funcionan de punta a punta en escritorio y móvil | ⏳ La prueba con usuarios reales requiere el entorno desplegado |

## Rendimiento y escalabilidad con k6 (EQ-01 y EQ-03)

Mezcla del plan de medición: 55 % catálogo, 20 % opciones, 15 % cotizaciones y 10 % pedidos del
comprador demo, con 2 s de pausa entre operaciones. Umbrales por endpoint: p95 < 500 ms y menos
de 1 % de errores; k6 termina con error si no se cumplen.

| Fecha | Perfil | Entorno | Peticiones | p95 (global / catálogo / cotizaciones / pedidos) | p99 global | Errores | Resultado |
|---|---|---|---|---|---|---|---|
| 13/11/2026 | humo (5 VU, 1 min) | Laptop Windows, demo 3300, k6 2.4.0 | 62 | — / 98,83 / 113 / 83 ms | — | 0 % | ✓ |
| 13/11/2026 | local (hasta 200 VU, 6,5 min) | Laptop Windows, demo 3300, k6 2.4.0 | 20.961 | — / 11,08 / 39,7 / 39 ms | 52 ms | 0 % | ✓ |
| 20/11/2026 | **completo (500 → 1.000 → 2.000 VU, 23 min)** | Contenedor en la nube (4 vCPU, 15 GB), demo de 15 empresas y 450 productos, PostgreSQL 16, Redis 7, k6 1.4.2 | **734.824** (532/s) | **6,02 / 3,67 / 11,52 / 11,33 ms** | 15,67 ms | **0 %** (734.822/734.822 comprobaciones) | **✓ Aprobado** |

Resumen JSON de k6: [evidencias/k6/resumen-completo.json](evidencias/k6/resumen-completo.json).
Durante la etapa de 2.000 VU el contenedor usó cerca del 50 % de CPU en total; la API (Node) ocupó
unos 285 MB de memoria y k6 cerca de 1 GB.

### Límites de la medición

- El generador de carga (k6) y el servidor corrieron en la **misma máquina**, por loopback y sin
  red de por medio. Las latencias son menores que las que verá un usuario por Internet, y el CPU que
  usa k6 compite con el del servidor. Por eso el resultado vale como evidencia de que la aplicación
  sostiene 2.000 VU, no como medida definitiva para producción.
- Las lecturas del catálogo se sirven en su mayoría desde Redis (ver
  [sprint-2-redis-catalogo.md](sprint-2-redis-catalogo.md)); la mezcla no incluye la creación de
  pedidos, que se mide en EQ-06.
- La medición definitiva se repetirá en el Sprint 3 desde otra máquina contra la URL pública.

## Pendiente para el Sprint 3

1. Repetir k6 `completo` contra la URL pública de AWS desde otra máquina (el generador de carga y
   el servidor separados) y registrar CPU, memoria y conexiones de PostgreSQL (EQ-01, EQ-03).
2. Ensayo de concurrencia EQ-06 con 500 compradores y 100 cajas sobre dos instancias backend.
3. Monitoreo de disponibilidad, copia y restauración de la base (EQ-02) y revisión de registros (EQ-08).
4. Prueba de usabilidad con participantes (EQ-09).
