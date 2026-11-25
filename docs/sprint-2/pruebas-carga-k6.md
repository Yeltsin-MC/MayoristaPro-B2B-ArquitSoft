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

## Perfiles

| Perfil | Usuarios virtuales | Duración | Para qué |
|---|---|---|---|
| `humo` | 5 | 1 min | Validar datos y credenciales antes de cargar. |
| `local` | 50 y luego 200 | ~6,5 min | Laptop de desarrollo. |
| `completo` | 500, 1000 y 2000 | 23 min | Meta académica. Ejecutar desde otra máquina contra el despliegue en AWS. |

## Cómo ejecutarlo (Windows)

1. Instala k6 una vez: `winget install k6 --source winget` (o [otras opciones](https://grafana.com/docs/k6/latest/set-up/install-k6/)). Cierra y abre la terminal.
2. Levanta la demo en el puerto 3300 (`npm run demo:catalog:api`).
3. En otra terminal:

```
npm run test:carga -- humo
npm run test:carga -- local
```

El comando lee `DEMO_PASSWORD` de `.env.demo-catalog150` y usa la compradora `demo-comprador150@example.test`. Para otra URL, define `BASE_URL` (por ejemplo, la del despliegue). El resumen queda en `docs/sprint-2/evidencias/k6/resumen-<perfil>.json`; guárdalo como evidencia junto con la salida de la consola.

## Resultados

| Fecha | Perfil | Entorno | p95 catálogo | Errores | Resultado |
|---|---|---|---|---|---|
| 13/11/2026 | humo (5 VU, 1 min, 62 peticiones) | Laptop Windows, demo 3300, k6 2.4.0 | 98,83 ms (cotizaciones 113 ms, pedidos 83 ms, opciones 7,6 ms) | 0 % (60/60 comprobaciones) | ✓ Aprobado |
| 13/11/2026 | local (hasta 200 VU, 6,5 min, 20 961 peticiones, 53 por segundo) | Laptop Windows, demo 3300, k6 2.4.0 | 11,08 ms (cotizaciones 39,7 ms, pedidos 39 ms, opciones 8,1 ms; p99 global 52 ms) | 0 % (20 959/20 959 comprobaciones) | ✓ Aprobado |
| 20/11/2026 | completo (500 → 1000 → 2000 VU, 23 min, 734 824 peticiones, 532 por segundo) | Contenedor en la nube (4 vCPU), demo 450 productos, k6 1.4.2; k6 y API en la misma máquina | 3,67 ms (cotizaciones 11,5 ms, pedidos 11,3 ms; p95 global 6 ms, p99 15,7 ms) | 0 % (734 822/734 822 comprobaciones) | ✓ Aprobado |
| 25/11/2026 | completo (500 → 1000 → 2000 VU, 23 min, 572 361 peticiones, 414 por segundo) | Laptop Windows 16 GB; k6, API, PostgreSQL y Redis en la misma laptop | 1,68 s (mediana 17 ms; cotizaciones y pedidos 1,79 s; p99 global 1,93 s) | 0 % (572 359/572 359 comprobaciones) | ⚠ Disponibilidad aprobada, latencia no: p95 > 500 ms desde unos 1000 VU |
| (pendiente) | completo | AWS | | | |

**Lectura de la corrida del 25/11 en laptop.** Ninguna petición falló, pero la API llegó a su techo de unas 414 peticiones por segundo. Con 2000 usuarios que esperan 2 s, la demanda sube a unas 1000 por segundo, así que las peticiones hacen cola y el p95 pasa de 500 ms (la mediana sigue en 23 ms). La causa es que k6 genera la carga en la misma laptop donde corren la API (un solo proceso Node.js), PostgreSQL y Redis, y compite con ellos por CPU y memoria. En la nube, con 4 vCPU, la misma prueba dio p95 de 6 ms. La escalabilidad horizontal (varias réplicas de la API detrás de nginx, ver la arquitectura) es la respuesta para producción.

Comprobación previa sin k6 (13/11/2026, entorno de desarrollo): 2000 peticiones a `GET /products?page=2&limit=20`, 50 en paralelo, todas con 200, en 3,6 s (unas 550 por segundo, sin Redis). No reemplaza la medición k6.
