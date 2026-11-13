# Pruebas de carga con k6

Script: `tests/k6/catalogo.k6.js`. Sigue el [plan de medición](01-analisis-de-sistema/09-plan-de-medicion-calidad.md) (AC01 y AC03).

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

El comando lee `DEMO_PASSWORD` de `.env.demo-catalog150` y usa la compradora `demo-comprador150@example.test`. Para otra URL, define `BASE_URL` (por ejemplo, la del despliegue). El resumen queda en `docs/evidencias/k6/resumen-<perfil>.json`; guárdalo como evidencia junto con la salida de la consola.

## Resultados

| Fecha | Perfil | Entorno | p95 catálogo | Errores | Resultado |
|---|---|---|---|---|---|
| (pendiente) | humo | Laptop, demo 3300 | | | |
| (pendiente) | local | Laptop, demo 3300 | | | |
| (pendiente) | completo | AWS | | | |

Comprobación previa sin k6 (13/11/2026, entorno de desarrollo): 2000 peticiones a `GET /products?page=2&limit=20`, 50 en paralelo, todas con 200, en 3,6 s (unas 550 por segundo, sin Redis). No reemplaza la medición k6.
