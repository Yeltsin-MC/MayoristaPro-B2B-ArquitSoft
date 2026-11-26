# Pruebas de carga con k6

Script: `tests/k6/catalogo.k6.js`. Sigue el [plan de medición](../sprint-1/01-analisis-de-sistema/09-plan-de-medicion-calidad.md) (AC01 y AC03).

## Qué simula

Cada usuario virtual repite una operación y espera 2 segundos:

| Proporción | Endpoint | Comprobación |
|---|---|---|
| 55 % | `GET /products` (páginas 1–5, filtro por categoría o búsqueda) | 200 con `items` |
| 20 % | `GET /products/options` (proveedores y categorías) | 200 con `suppliers` |
| 15 % | `GET /quotations` del comprador demo | 200 |
| 10 % | `GET /orders` del comprador demo | 200 |

La creación de pedidos (`POST /orders`) se mide aparte, en la prueba de concurrencia EQ-06, para no agotar el stock de la demo. Sin credenciales del comprador, las lecturas privadas se reemplazan por consultas al catálogo.

**Umbrales** (por endpoint): p95 < 500 ms y menos de 1 % de errores; más de 99 % de comprobaciones correctas. Si no se cumplen, k6 termina con error.

## Tipos de prueba

Las cuatro pruebas formales usan la misma mezcla de lecturas y los **mismos umbrales**: p95 < 500 ms y menos de 1 % de errores, más de 99 % de comprobaciones correctas. La sesión del comprador se prepara antes de empezar a medir.

| Prueba | Comando | Usuarios virtuales | Duración | Aprueba si |
|---|---|---|---|---|
| **Smoke** | `npm run test:carga -- smoke` | 1 VU, 5 iteraciones; cada una recorre los 4 endpoints con sesión real | Máximo 30 s | Todos los umbrales con ✓. Si falla, no sigas con las demás. |
| **Load** | `npm run test:carga -- load` | 10, 25 y 50 VU durante 1 min cada uno; 100 VU durante 10 min; 10 s de transición | ~13,5 min | Todos los niveles con ✓ (es la carga esperada). |
| **Stress** | `npm run test:carga -- stress` | De 100 en 100 hasta 2000 VU, 60 s por nivel, 10 s de transición | ~23 min | No se espera que pasen todos. El resultado es el **máximo nivel aprobado**: el último nivel con ✓ cuando todos los anteriores también lo tuvieron. |
| **Spike** | `npm run test:carga -- spike` | 10 VU por 30 s; salto a 1000 VU en 5 s; 30 s de pico; vuelta a 10 VU en 5 s; 60 s de recuperación | ~2 min 10 s | La fase **recuperación** con ✓: el sistema vuelve a la normalidad tras el pico. El pico se informa aparte. |
| Completo (plan original) | `npm run test:carga -- completo` | Mesetas de 500, 1000 y 2000 VU | 23 min | Todos los umbrales con ✓. |

`humo` y `local` siguen disponibles para comparar con las evidencias anteriores.

**Ajustes opcionales** (PowerShell, antes del comando): `$env:STRESS_MAX="1000"` acorta el stress, `$env:PICO="800"` ajusta el pico del spike (conviene usar el máximo nivel aprobado del stress), `$env:BASE_URL="https://…"` apunta a otro servidor. Para volver a los valores por defecto, cierra y abre la terminal.

En stress, load y spike, cada nivel o fase lleva su propia etiqueta (`nivel` o `fase`), así k6 evalúa los umbrales de cada uno por separado. Las escrituras (reservas, conflictos de stock, idempotencia) no entran en estas pruebas de lectura: se evalúan aparte en la prueba de concurrencia EQ-06.

## Cómo ejecutarlo (Windows)

1. Instala k6 una vez: `winget install k6 --source winget` (o [otras opciones](https://grafana.com/docs/k6/latest/set-up/install-k6/)). Cierra y abre la terminal.
2. Arranca PostgreSQL y levanta la demo en el puerto 3300 (`npm run demo:catalog:api`) en su propia terminal.
3. Cierra los programas pesados (navegador, editores con IA) para dejar memoria libre.
4. En otra terminal, en este orden:

```
npm run test:carga -- smoke
npm run test:carga -- load
npm run test:carga -- stress
npm run test:carga -- spike
```

Cada comando muestra antes de empezar el tipo de prueba, su objetivo, los usuarios, la duración y los umbrales. Después muestra el progreso de k6, sus `THRESHOLDS` y `TOTAL RESULTS`, y al final una tabla por nivel o fase. `Ctrl + C` una vez detiene la prueba de forma ordenada. Si la RAM de la máquina pasa de 97 %, la prueba se detiene sola y no cuenta como aprobada.

El comando lee `DEMO_PASSWORD` de `.env.demo-catalog150` y usa la compradora `demo-comprador150@example.test`.

### Evidencias

Se guardan por campaña (la fecha del día, o `$env:CAMPANA="nombre"`) en `docs/sprint-2/evidencias/k6/<campaña>/`:

| Archivo | Contenido |
|---|---|
| `<prueba>.json` | Resumen exportado por k6: todas las métricas y umbrales. |
| `<prueba>-niveles.md` | Tabla por nivel o fase: peticiones, RPS, promedio, p50, p95, p99, errores y resultado. En el stress incluye el máximo nivel aprobado. |
| `<prueba>-recursos.csv` | CPU y RAM de la máquina cada 5 s. En local, ahí corren k6, la API y PostgreSQL. |

Los resúmenes anteriores (`resumen-humo.json`, `resumen-local.json`, `resumen-completo.json`) se conservan como pruebas preliminares.

## Resultados

| Fecha | Perfil | Entorno | p95 catálogo | Errores | Resultado |
|---|---|---|---|---|---|
| 13/11/2026 | humo (5 VU, 1 min, 62 peticiones) | Laptop Windows, demo 3300, k6 2.4.0 | 98,83 ms (cotizaciones 113 ms, pedidos 83 ms, opciones 7,6 ms) | 0 % (60/60 comprobaciones) | ✓ Aprobado |
| 13/11/2026 | local (hasta 200 VU, 6,5 min, 20 961 peticiones, 53 por segundo) | Laptop Windows, demo 3300, k6 2.4.0 | 11,08 ms (cotizaciones 39,7 ms, pedidos 39 ms, opciones 8,1 ms; p99 global 52 ms) | 0 % (20 959/20 959 comprobaciones) | ✓ Aprobado |
| 20/11/2026 | completo (500 → 1000 → 2000 VU, 23 min, 734 824 peticiones, 532 por segundo) | Contenedor en la nube (4 vCPU), demo 450 productos, k6 1.4.2; k6 y API en la misma máquina | 3,67 ms (cotizaciones 11,5 ms, pedidos 11,3 ms; p95 global 6 ms, p99 15,7 ms) | 0 % (734 822/734 822 comprobaciones) | ✓ Aprobado |
| 25/11/2026 | completo (500 → 1000 → 2000 VU, 23 min, 572 361 peticiones, 414 por segundo) | Laptop Windows 16 GB; k6, API, PostgreSQL y Redis en la misma laptop | 1,68 s (mediana 17 ms; cotizaciones y pedidos 1,79 s; p99 global 1,93 s) | 0 % (572 359/572 359 comprobaciones) | ⚠ Disponibilidad aprobada, latencia no: p95 > 500 ms desde unos 1000 VU |
| (pendiente) | completo | AWS | | | |

**Lectura de la corrida del 25/11 en laptop.** Ninguna petición falló, pero la API llegó a su techo de unas 414 peticiones por segundo. Con 2000 usuarios que esperan 2 s, la demanda sube a unas 1000 por segundo, así que las peticiones hacen cola y el p95 pasa de 500 ms (la mediana sigue en 23 ms). La causa es que k6 genera la carga en la misma laptop donde corren la API (un solo proceso Node.js), PostgreSQL y Redis, y compite con ellos por CPU y memoria. En la nube, con 4 vCPU, la misma prueba dio p95 de 6 ms. La escalabilidad horizontal (varias réplicas de la API detrás de nginx, ver la arquitectura) es la respuesta para producción.

### Campaña formal del 26/11/2026 (laptop Windows 16 GB, demo 450 productos en el 3300)

k6, la API, PostgreSQL y Redis corrieron en la misma laptop. Umbrales: p95 < 500 ms y errores < 1 % por nivel o fase. Las tablas completas, los resúmenes JSON y la CPU/RAM cada 5 s están en [evidencias/k6/2026-11-26/](evidencias/k6/2026-11-26).

| Prueba | Carga | Peticiones | Resultado clave | Errores | CPU / RAM máx. | Resultado |
|---|---|---|---|---|---|---|
| Smoke | 1 VU, 5 iteraciones | 22 | p95 por endpoint: catálogo 11,5 ms, cotizaciones 15,2 ms, opciones 2,6 ms, pedidos 7,9 ms | 0 % | 12 % / 85 % | ✓ Aprobado |
| Load | 10, 25, 50 VU (1 min) y 100 VU (10 min) | 32 452 | p95 7,8 / 7,8 / 7,3 / 9,9 ms; 49,8 RPS con 100 VU | 0 % | 41 % / 85 % | ✓ Aprobado (máximo nivel: 100 VU) |
| Stress | 100 a 2000 VU de 100 en 100, 1 min por nivel | 615 711 | **Los 20 niveles aprobados.** p95 ≤ 27,8 ms hasta 1100 VU; 116 ms con 1200; 275 ms con 1900; **353 ms con 2000 VU (905 RPS)** | 0 % | 48 % / 85 % | ✓ Aprobado (máximo nivel: 2000 VU) |
| Spike | 10 → 1000 VU en 5 s, 30 s de pico, → 10 VU | 17 920 | p95 base 6,3 ms; pico 11,7 ms (436,7 RPS); recuperación 6,3 ms | 0 % | 27 % / 74 % | ✓ Aprobado (se recupera al nivel previo) |

**Stress por nivel (p95):** 100: 9,3 ms · 200: 8,0 · 300: 6,6 · 400: 7,2 · 500: 6,4 · 600: 9,4 · 700: 12,0 · 800: 17,5 · 900: 13,9 · 1000: 27,7 · 1100: 27,8 · 1200: 116,4 · 1300: 66,3 · 1400: 73,6 · 1500: 98,4 · 1600: 162,6 · 1700: 122,0 · 1800: 138,6 · 1900: 275,2 · 2000: 353,2 ms.

**Lectura.** El sistema atiende de forma lineal (≈ 0,45 RPS por usuario) hasta unos 1800 VU con p95 por debajo de 140 ms. Desde 1900 VU el rendimiento se aplana (892 → 905 RPS) y la latencia sube a 275–353 ms: es el punto de **saturación** de una sola instancia en esta laptop, aunque todavía dentro del umbral y sin errores. Cada nivel del stress dura 1 minuto. La corrida `completo` del 25/11 mantuvo 2000 VU durante 5 minutos, con la laptop más cargada (navegador y editores abiertos), y superó los 500 ms. Por eso la capacidad que se acredita es la del stress con la máquina dedicada, y la meseta larga en AWS queda pendiente.

Comprobación previa sin k6 (13/11/2026, entorno de desarrollo): 2000 peticiones a `GET /products?page=2&limit=20`, 50 en paralelo, todas con 200, en 3,6 s (unas 550 por segundo, sin Redis). No reemplaza la medición k6.
