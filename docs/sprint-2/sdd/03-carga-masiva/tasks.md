# Tareas de implementación — Carga masiva del catálogo (CSV y Excel)

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 03 · Carga masiva del catálogo (CSV y Excel)                 |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Completado ✓                                                 |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## Resumen de fases

| Fase | Descripción | Tareas | Estado |
| ---- | ----------- | ------ | ------ |
| 1 | Análisis y especificación | 1.1 – 1.2 | ✓ |
| 2 | Base de datos | 2.1 | ✓ |
| 3 | Backend | 3.1 – 3.6 | ✓ |
| 4 | Frontend | 4.1 | ✓ |
| 5 | Pruebas | 5.1 – 5.2 | ✓ |

---

## Fase 1 — Análisis y especificación

### Tarea 1.1 — Definir requisitos de la carga masiva

**Descripción:** Fijar las 12 columnas de la plantilla, los límites de archivo, las reglas por fila, el ciclo de vida del lote y las garantías de la confirmación (atómica, idempotente y con detección de cambios).

**Resultado:** [`requirements.md`](requirements.md) con 5 RF, 7 RNF y criterios EARS.

**Estado:** ✓ Completado

---

### Tarea 1.2 — Diseñar vista previa y confirmación

**Descripción:** Decidir guardar la vista previa en la base con huella y vencimiento, usar la revisión por SKU para detectar cambios y un bloqueo acotado de `products` durante la confirmación.

**Resultado:** [`design.md`](design.md) con secuencia, algoritmo de confirmación en 12 pasos y decisiones.

**Estado:** ✓ Completado

---

## Fase 2 — Base de datos

### Tarea 2.1 — Migración `003_catalog_imports.sql`

**Archivo:** `database/migrations/003_catalog_imports.sql`

**Descripción:** Agregar `products.category` y `products.revision` (con trigger que la incrementa ante cambios de metadatos) y crear `catalog_imports` con estado, filas, huella, clave de confirmación, resultado y vencimiento de 30 minutos.

**Requisitos:** RF-IMP-02, RF-IMP-05 · **Estado:** ✓ Completado

---

## Fase 3 — Backend

### Tarea 3.1 — Plantillas descargables

**Archivo:** `imports.controller.ts → template()`

**Descripción:** Generar `catalogo.xlsx` con ExcelJS (hoja «Catalogo») o `catalogo.csv` con BOM UTF-8, ambos con la fila de ejemplo.

**Requisitos:** RF-IMP-01 · **Estado:** ✓ Completado

---

### Tarea 3.2 — Lectura acotada de CSV y XLSX

**Archivo:** `import-file.ts → readImportFile()`

**Descripción:** Límite de 5 MiB en `FileInterceptor` y en el código, de 1 a 500 filas, revisión del ZIP (20 MiB, 100 entradas, sin macros) y solo valores literales.

**Casos validados:**

- [x] 3.2.1 Archivo de más de 5 MiB → 413.
- [x] 3.2.2 501 filas → 400.
- [x] 3.2.3 XLSX corrupto o con fórmulas → 400 o error de fila.

**Requisitos:** RF-IMP-02, RF-IMP-03 · **Estado:** ✓ Completado

---

### Tarea 3.3 — Validación por fila y mensaje de encabezados

**Archivo:** `import-file.ts`

**Descripción:** Validar cada columna, marcar SKU repetidos y, si los encabezados no coinciden, armar un mensaje con las columnas que faltan, sobran (mal escritas) o se repiten.

**Casos validados:**

- [x] 3.3.1 Encabezado `precioo` → «Encabezados incorrectos (faltan: precio; sobran o están mal escritas: precioo)…».
- [x] 3.3.2 Presentación `bolsa` → error en esa columna.
- [x] 3.3.3 Precio `12.345` → error (más de 2 decimales).
- [x] 3.3.4 SKU repetido → error en todas sus filas.

**Requisitos:** RF-IMP-02, RF-IMP-03 · **Estado:** ✓ Completado

---

### Tarea 3.4 — Vista previa persistida

**Archivo:** `catalog-imports.ts → preview()`

**Descripción:** Leer el snapshot de los SKU existentes, decidir `create`/`update`, calcular la huella y guardar el lote como `preview` o `invalid`.

**Requisitos:** RF-IMP-02 · **Estado:** ✓ Completado

---

### Tarea 3.5 — Confirmación atómica e idempotente

**Archivo:** `catalog-imports.ts → confirm()`

**Descripción:** Validar clave y huella, bloquear el lote y la tabla de productos, comparar revisiones, aplicar `UPDATE`/`INSERT` conservando stock y respetando retiros, y marcar el lote `applied` con auditoría.

**Casos validados:**

- [x] 3.5.1 Dos confirmaciones a la vez → un solo lote aplicado y el mismo reporte.
- [x] 3.5.2 Huella distinta → 409.
- [x] 3.5.3 SKU cambiado tras la vista previa (aunque luego se restaure el valor) → 409 `stale`.
- [x] 3.5.4 Error SQL inyectado → nada aplicado.
- [x] 3.5.5 Producto retirado por el administrador → sigue oculto.

**Requisitos:** RF-IMP-05 · **Estado:** ✓ Completado

---

### Tarea 3.6 — Autorización

**Archivos:** `catalog-imports.ts`, `identity.service.ts → requireSupplier()`

**Descripción:** Exigir sesión, permiso `publish` y proveedor verificado en todas las rutas privadas, también al confirmar (por si perdió la verificación entre la vista previa y la confirmación).

**Requisitos:** RF-IMP-04, RNF-IMP-01 · **Estado:** ✓ Completado

---

## Fase 4 — Frontend

### Tarea 4.1 — Asistente de carga

**Archivo:** `apps/web/src/catalog-import.ts`

**Descripción:** Asistente de 4 pasos con descarga de plantillas, subida, tabla de vista previa con errores por fila y columna, confirmación con clave aleatoria y reporte CSV descargable (con fórmulas escapadas). Detalle de la experiencia en el [módulo 08](../08-mis-productos/tasks.md).

**Requisitos:** RF-IMP-02, RF-IMP-05 · **Estado:** ✓ Completado

---

## Fase 5 — Pruebas

### Tarea 5.1 — Pruebas de integración (Jest + PostgreSQL)

| Prueba | Subprueba en `tests/imports.integration.cjs` |
| ------ | -------------------------------------------- |
| PI-IMP-01 | Encabezados mal escritos: el mensaje dice cuál falta y cuál sobra |
| PI-IMP-02 | CSV: vista previa sin escrituras, confirmación y catálogo público |
| PI-IMP-03 | reintentos simultáneos aplican el lote una vez, huella y clave requeridas |
| PI-IMP-04 | actualización conserva stock incluso con movimiento posterior a la vista previa |
| PI-IMP-05 | mismo SKU de otro proveedor crea una oferta independiente; ajenos y pendientes bloqueados |
| PI-IMP-06 | errores por fila/columna impiden cualquier cambio parcial |
| PI-IMP-07 | cambio de SKU o metadatos invalida vista previa, incluso al restaurar el valor |
| PI-IMP-08 | dos lotes para un SKU ausente: solo uno se aplica y el otro exige revisar |
| PI-IMP-09 | XLSX real y plantillas; fórmulas y contenido corrupto rechazados |
| PI-IMP-10 | límites de archivo y filas; se admite un lote de 500 productos |
| PI-IMP-11 | vencimiento, pérdida de verificación y revocación se revalidan al confirmar |
| PI-IMP-12 | un fallo SQL durante la aplicación revierte altas, lote y auditoría juntos |

**Estado:** ✓ Completado

---

### Tarea 5.2 — Pruebas de navegador (Playwright)

| Prueba | Archivo | Qué valida |
| ------ | ------- | ---------- |
| PN-IMP-01 | `tests/catalog.browser.cjs` | Subir un Excel con error, ver el error, corregir, confirmar y ver el producto publicado |
| PN-IMP-02 | `tests/demo-catalog.integration.cjs` | Recargar la demo no repone stock ni duplica productos |

**Estado:** ✓ Completado

---

## Pendientes

- [ ] Columnas `imagenes` y `descripcion` en la plantilla para que el proveedor suba sus fotos.
- [ ] Ajuste de inventario para cambiar la equivalencia de un producto con stock.

---

## Lista de tareas

Cada tarea tiene un código único `T###`, la fase a la que pertenece y los requisitos que cubre. `[x]` es completada y `[ ]` pendiente.

- [x] T001 [Fase 1] Definir requisitos de la carga masiva (Tarea 1.1)
- [x] T002 [Fase 1] Diseñar vista previa y confirmación (Tarea 1.2)
- [x] T003 [Fase 2] Migración `003_catalog_imports.sql` (Tarea 2.1) → RF-IMP-02, RF-IMP-05
- [x] T004 [Fase 3] Plantillas descargables (Tarea 3.1) → RF-IMP-01
- [x] T005 [Fase 3] Lectura acotada de CSV y XLSX (Tarea 3.2) → RF-IMP-02, RF-IMP-03
- [x] T006 [Fase 3] Validación por fila y mensaje de encabezados (Tarea 3.3) → RF-IMP-02, RF-IMP-03
- [x] T007 [Fase 3] Vista previa persistida (Tarea 3.4) → RF-IMP-02
- [x] T008 [Fase 3] Confirmación atómica e idempotente (Tarea 3.5) → RF-IMP-05
- [x] T009 [Fase 3] Autorización (Tarea 3.6) → RF-IMP-04, RNF-IMP-01
- [x] T010 [Fase 4] Asistente de carga (Tarea 4.1) → RF-IMP-02, RF-IMP-05
- [x] T011 [Fase 5] Pruebas de integración (Jest + PostgreSQL) (Tarea 5.1)
- [x] T012 [Fase 5] Pruebas de navegador (Playwright) (Tarea 5.2)

### Dependencias

```
T001–T002 → T003 → T004–T009 → T010 → T011–T012
```

Cada fase empieza cuando la anterior está completa: primero la especificación, luego la base de datos y el backend, después la interfaz y al final las pruebas. Dentro de una fase, las tareas se hicieron en el orden de la lista.

---

## Registro de ejecución

Bitácora de cómo se construyó el módulo, con la fecha en que se fusionó cada cambio a `main`. Cada entrada enlaza su pull request, donde están los commits y el resultado del CI.

### 11/11/2026 · T3 · Carga masiva ([#3](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/3))

**Qué se hizo:** Migración `003_catalog_imports.sql`, plantillas CSV y XLSX, vista previa con errores por fila y confirmación atómica con `Idempotency-Key`.

**Resultado:** `imports.integration.cjs` en verde: límites de 5 MiB y 500 filas, lote vencido, cambios concurrentes y repetición idempotente.

### 13/11/2026 · Catálogo de demostración ([#8](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/8))

**Qué se hizo:** Carga de los CSV de 15 proveedores con `npm run demo:catalog:load`.

**Resultado:** `demo-catalog.integration.cjs` en verde.

### 22/11/2026 · Asistente en 4 pasos ([#31](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/31))

**Qué se hizo:** La carga pasa a un asistente con pasos numerados, ayuda desplegable y mensaje de encabezados con columnas faltantes y sobrantes.

**Resultado:** Caso «Encabezados mal escritos» y `catalog.browser.cjs` en verde.

### 26/11/2026 · CSV de ejemplo ([#46](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/46))

**Qué se hizo:** Archivos de ejemplo en `docs/ejemplos`: uno correcto con 15 productos y otro con errores para la exposición.

**Resultado:** Revisados con la vista previa en local.

### 27/11/2026 · Especificación ampliada

**Qué se hizo:** Se ampliaron `requirements.md`, `design.md` y este archivo con requisitos EARS, diagramas, decisiones, lista de tareas y este registro.

**Resultado:** Documentación al día con el código desplegado en https://mayoristapro.shop.

---

## Trazabilidad completa del módulo

```
requirements.md            design.md                    tasks.md
      │                        │                            │
      │ RF-IMP-01..05          │ imports.controller.ts      │ Tarea 2.1 (BD)
      │ RNF-IMP-01..07         │ import-file.ts             │ Tareas 3.1..3.6 (API)
      │ Ciclo del lote         │ catalog-imports.ts         │ Tarea 4.1 (web)
      │ Criterios EARS         │ catalog-import.ts          │ PI-IMP-01..12, PN
      └────────────────────────┴────────────────────────────┘
                               │
                      CÓDIGO IMPLEMENTADO
                               │
                      PRUEBAS EJECUTADAS (CI)
                               │
                   https://mayoristapro.shop ✓
```
