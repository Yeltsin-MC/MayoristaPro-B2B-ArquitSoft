# Especificación de Requisitos — Carga masiva del catálogo (CSV y Excel)

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 03 · Carga masiva del catálogo (CSV y Excel)                 |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Implementado ✓                                               |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## 1. Contexto

Un proveedor mayorista maneja cientos de productos: registrarlos uno por uno no es viable. Este módulo le permite descargar una plantilla, llenarla en Excel, subirla y ver una **vista previa** con lo que va a pasar (altas, actualizaciones y errores por fila y columna) **antes** de tocar su catálogo. Recién al confirmar, el lote completo se aplica en una sola transacción.

Como la confirmación puede repetirse (doble clic, red lenta) y otro proceso puede cambiar un producto mientras el proveedor revisa, la confirmación es **idempotente** y detecta **cambios concurrentes** por SKU.

Origen: entrega T3 (carga masiva, criterios T3-AC01 a T3-AC12). La experiencia de 4 pasos para el proveedor está en [Mis productos](../08-mis-productos/requirements.md).

---

## 2. Objetivo

- Plantillas CSV y XLSX con 12 columnas fijas y una fila de ejemplo.
- Lectura acotada y segura de archivos (tamaño, filas, ZIP, fórmulas).
- Validación por fila y columna, con mensajes claros de encabezados mal escritos.
- Vista previa persistida, con huella (`previewHash`) y vencimiento de 30 minutos.
- Confirmación atómica e idempotente que conserva el stock de los productos existentes.
- Autorización por sesión: solo el proveedor verificado dueño del lote.

---

## 3. Actores involucrados

| Actor | Permisos en este módulo |
| ----- | ----------------------- |
| Visitante | Descargar las plantillas (públicas) |
| Proveedor verificado (`publish`) | Subir archivo, ver su vista previa, consultar y confirmar sus lotes |
| Proveedor no verificado o sin `publish` | Ninguno (403) |
| Administrador de plataforma | No carga productos; sus retiros se respetan (no se republican) |

---

## 4. Glosario

| Término | Definición |
| ------- | ---------- |
| Lote | Archivo subido con su vista previa guardada en `catalog_imports` |
| Estado del lote | `preview` (listo), `invalid` (tiene errores), `stale` (vencido o desactualizado), `applied` (aplicado) |
| Huella (`previewHash`) | Resumen de la vista previa que el proveedor revisó; debe enviarse al confirmar |
| `Idempotency-Key` | Cabecera que identifica el intento de confirmación; repetirla no aplica dos veces |
| Revisión del producto | `products.revision`, sube con cada cambio de metadatos; sirve para detectar cambios concurrentes |
| Fila vacía | Fila sin ningún valor; se ignora |

---

## 5. Requisitos funcionales

### RF-IMP-01 — Descargar plantillas

**Endpoint:** `GET /api/v1/products/imports/template?format=csv|xlsx`
**Acceso:** Público

**Columnas (en este orden):** `sku`, `nombre`, `categoria`, `presentacion`, `unidades_por_presentacion`, `precio`, `moneda`, `incluye_igv`, `minimo`, `multiplo`, `stock`, `publicado`.

**Fila de ejemplo:** `CUAD-A4, Cuaderno A4, Papelería, caja, 12, 48.00, PEN, true, 2, 1, 20, true`.

#### Criterios de aceptación (EARS)

1. CUANDO se pida `format=xlsx`, EL sistema DEBERÁ devolver un libro Excel con la hoja «Catalogo».
2. EN cualquier otro caso, EL sistema DEBERÁ devolver un CSV UTF-8 con BOM (se abre bien en Excel en español).

---

### RF-IMP-02 — Subir el archivo y ver la vista previa

**Endpoint:** `POST /api/v1/products/imports/preview` (multipart, campo `file`)
**Acceso:** Proveedor verificado con `publish`
**Respuesta:** 201 `{ id, status, previewHash, expiresAt, rows[], summary }`

**Límites:**

- Máximo 5 MiB → si no, 413 «Máximo 5 MB.».
- Entre 1 y 500 filas → si no, 400 «Se requieren entre 1 y 500 filas.».
- Solo CSV UTF-8 con comas o XLSX → si no, 400.
- XLSX descomprimido ≤ 20 MiB y ≤ 100 entradas ZIP, sin macros → si no, 400.

#### Criterios de aceptación (EARS)

1. CUANDO el proveedor suba un archivo válido, EL sistema DEBERÁ mostrar por fila la acción (`create` o `update`), el stock que se conserva y los errores, **sin modificar productos**.
2. SI los encabezados son incorrectos, ENTONCES EL sistema DEBERÁ indicar qué columnas faltan, cuáles sobran o están mal escritas y cuáles se repiten.
3. SI el archivo supera los límites, ENTONCES EL sistema DEBERÁ rechazarlo (413 o 400).
4. EL lote DEBERÁ quedar guardado como `preview` o `invalid` y vencer a los 30 minutos.

---

### RF-IMP-03 — Validar cada fila

| Columna | Regla |
| ------- | ----- |
| `sku` | 1 a 64 caracteres; único dentro del archivo |
| `nombre`, `categoria` | Texto obligatorio |
| `presentacion` | `unidad`, `paquete`, `docena`, `caja` o `saco` |
| `unidades_por_presentacion`, `minimo`, `multiplo` | Enteros positivos; `minimo` múltiplo de `multiplo` |
| `precio` | Mayor que 0, hasta 2 decimales |
| `moneda` | `PEN` |
| `incluye_igv`, `publicado` | `true` o `false` |
| `stock` | Entero ≥ 0 |
| Cualquier texto | No puede empezar con `=`, `+`, `-` o `@` (fórmulas) |

#### Criterios de aceptación (EARS)

1. EL sistema DEBERÁ registrar cada error con su número de fila y columna.
2. SI un SKU se repite en el archivo, ENTONCES EL sistema DEBERÁ marcar todas esas filas con «SKU repetido dentro del archivo.».
3. EL sistema NO DEBERÁ ejecutar fórmulas, fechas ni vínculos de Excel: solo valores literales.
4. SI se intenta cambiar la presentación o la equivalencia de un producto que ya tiene stock, ENTONCES EL sistema DEBERÁ marcar el error (requiere un ajuste de inventario).
5. SI una sola fila es inválida, ENTONCES EL lote DEBERÁ quedar `invalid` y NO DEBERÁ poder confirmarse.

---

### RF-IMP-04 — Consultar un lote

**Endpoint:** `GET /api/v1/products/imports/:id`
**Acceso:** Proveedor dueño del lote · respuesta con `Cache-Control: no-store`

#### Criterios de aceptación (EARS)

1. EL sistema DEBERÁ devolver el estado y el reporte del lote propio.
2. SI el lote es de otro proveedor o no existe, ENTONCES EL sistema DEBERÁ responder 404 «Lote no disponible.».

---

### RF-IMP-05 — Confirmar el lote

**Endpoint:** `POST /api/v1/products/imports/:id/confirm`
**Cabecera:** `Idempotency-Key` (1–128 letras, números, punto o guion)
**Body:** `{ "previewHash": "…" }`
**Respuesta:** 201 `{ created, updated, productIds }`

#### Criterios de aceptación (EARS)

1. CUANDO el proveedor confirme antes de 30 minutos con la clave y la huella correctas, EL sistema DEBERÁ aplicar productos, estado del lote y auditoría en **una sola transacción**.
2. SI la confirmación se repite o llega dos veces a la vez, ENTONCES EL sistema DEBERÁ devolver el mismo resultado sin duplicar productos.
3. SI la huella no coincide, ENTONCES EL sistema DEBERÁ responder 409 «La huella de la vista previa no coincide.».
4. SI el lote venció o un SKU cambió después de la vista previa, ENTONCES EL sistema DEBERÁ marcarlo `stale` y responder 409.
5. SI ocurre un fallo durante la aplicación, ENTONCES EL sistema DEBERÁ revertir todo.
6. EN productos existentes, EL sistema DEBERÁ conservar el stock vigente (la plantilla no repone stock).
7. SI el administrador retiró un producto, ENTONCES la carga NO DEBERÁ volver a publicarlo.

---

## 6. Requisitos no funcionales

| ID | Atributo | Detalle |
| -- | -------- | ------- |
| RNF-IMP-01 | Seguridad | El proveedor se obtiene de la sesión, nunca del archivo |
| RNF-IMP-02 | Seguridad | Protección contra bombas ZIP (20 MiB, 100 entradas) e inyección de fórmulas en el reporte CSV |
| RNF-IMP-03 | Atomicidad | Todo o nada: productos, lote y auditoría en la misma transacción |
| RNF-IMP-04 | Idempotencia | Repetir la confirmación devuelve el mismo reporte |
| RNF-IMP-05 | Concurrencia | `LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE` con `lock_timeout` de 5 s; las lecturas públicas siguen funcionando |
| RNF-IMP-06 | Rendimiento | Un lote de 500 productos se previsualiza y aplica en segundos |
| RNF-IMP-07 | Usabilidad | Mensajes en español que indican la fila, la columna y cómo corregir |

---

## 7. Criterios de aceptación del módulo

- [x] La plantilla XLSX descargada se puede volver a subir sin errores.
- [x] La vista previa no crea ni modifica productos.
- [x] Encabezado mal escrito (`precioo`) → mensaje con la columna que falta y la que sobra.
- [x] Archivo de 6 MB → 413; 501 filas → 400.
- [x] Celda `=1+1` → error en esa fila y columna.
- [x] Un error en una fila impide confirmar todo el lote.
- [x] Dos confirmaciones simultáneas → un solo lote aplicado.
- [x] Sin `Idempotency-Key` → 400.
- [x] SKU modificado tras la vista previa → 409 y lote `stale`.
- [x] Producto existente → conserva su stock tras la carga.
- [x] Fallo SQL inyectado → no queda nada aplicado.
- [x] Lote de 500 productos → se aplica completo.

---

## 8. Ciclo de vida de un lote

```
          [SUBIR ARCHIVO — RF-IMP-02]
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
       PREVIEW               INVALID ───► (corregir y subir de nuevo)
          │
   ┌──────┴───────────────┬────────────────────────┐
   │                      │                        │
[CONFIRMAR a tiempo]  [pasan 30 min]     [SKU cambió antes de confirmar]
   │                      │                        │
   ▼                      ▼                        ▼
APPLIED (final)         STALE ◄────────────────── STALE
   │
[CONFIRMAR otra vez] → mismo reporte (idempotente)
```

---

## 9. Trazabilidad SDD

| Artefacto | Archivo |
| --------- | ------- |
| Diseño técnico | [`design.md`](design.md) |
| Tareas de implementación | [`tasks.md`](tasks.md) |
| Controlador | `apps/api/src/catalog/presentation/imports.controller.ts` |
| Lectura y validación | `apps/api/src/catalog/application/import-file.ts` |
| Vista previa y confirmación | `apps/api/src/catalog/application/catalog-imports.ts` |
| Migración | `database/migrations/003_catalog_imports.sql` |
| Frontend | `apps/web/src/catalog-import.ts` |
| Pruebas | `tests/imports.integration.cjs`, `tests/catalog.browser.cjs` |
