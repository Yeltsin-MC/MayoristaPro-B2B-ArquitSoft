# Tareas de implementación — Mis productos y asistente de carga en 4 pasos

| Campo        | Valor                                                        |
| ------------ | ------------------------------------------------------------ |
| Proyecto     | MayoristaPro B2B                                             |
| Módulo       | 08 · Mis productos y asistente de carga en 4 pasos           |
| Metodología  | Spec-Driven Development (SDD)                                |
| Sprint       | Sprint 2                                                     |
| Estado       | Completado ✓ (una tarea pendiente)                           |
| Curso        | IS-488 Arquitectura de Software · EPIS – UNSCH · 2026-II     |

---

## Resumen de fases

| Fase | Descripción | Tareas | Estado |
| ---- | ----------- | ------ | ------ |
| 1 | Análisis y especificación | 1.1 | ✓ |
| 2 | Backend | 2.1 – 2.2 | ✓ |
| 3 | Panel «Mis productos» | 3.1 – 3.3 | ✓ |
| 4 | Asistente de carga | 4.1 – 4.3 | ✓ |
| 5 | Pruebas y documentación | 5.1 – 5.3 | ✓ |
| — | Pendiente | 6.1 | ○ |

---

## Fase 1 — Análisis y especificación

### Tarea 1.1 — Revisar la experiencia del proveedor

**Descripción:** Detectar los problemas de la primera versión (formulario con «ID del producto propio», carga masiva en una sola pantalla) y definir el panel y el asistente.

**Resultado:** [`requirements.md`](requirements.md) con 6 RF y 6 RNF; [`design.md`](design.md) con secuencia y decisiones.

**Estado:** ✓ Completado

---

## Fase 2 — Backend

### Tarea 2.1 — `GET /company/products`

**Archivo:** `identity.service.ts → ownProducts()`

**Descripción:** Listar hasta 1000 productos de la empresa con foto principal y motivo de retiro, con `Cache-Control: no-store`.

**Requisitos:** RF-MIS-01 · **Estado:** ✓ Completado

---

### Tarea 2.2 — `POST /products/:id/unpublish`

**Archivo:** `identity.service.ts → unpublish()`

**Descripción:** Ocultar solo productos propios (validación en el `WHERE`) y auditar.

**Casos validados:**

- [x] 2.2.1 Producto propio → `published: false`.
- [x] 2.2.2 Producto de otra empresa → 403.

**Requisitos:** RF-MIS-02 · **Estado:** ✓ Completado

---

## Fase 3 — Panel «Mis productos»

### Tarea 3.1 — Lista, contador y buscador

**Archivo:** `apps/web/src/identity.ts`

**Descripción:** Filas con foto, nombre, SKU, precio, stock y estado; contador «N publicados de M»; buscador cuando hay más de 6 productos.

**Requisitos:** RF-MIS-01 · **Estado:** ✓ Completado

---

### Tarea 3.2 — Botones Publicar / Ocultar

**Subtareas:**

- [x] 3.2.1 Nombre accesible «Publicar <nombre>» / «Ocultar <nombre>».
- [x] 3.2.2 Estado «Retirado» con motivo, sin botón.
- [x] 3.2.3 Recarga silenciosa tras cada acción, sin borrar el mensaje de éxito.
- [x] 3.2.4 Carga automática al restaurar la sesión.

**Requisitos:** RF-MIS-02, 03, 04 · **Estado:** ✓ Completado

---

### Tarea 3.3 — Quitar el formulario «ID del producto propio»

**Descripción:** Eliminar el formulario técnico anterior; las pruebas de navegador pasan a usar los botones del panel.

**Requisitos:** RNF-MIS-02 · **Estado:** ✓ Completado

---

## Fase 4 — Asistente de carga

### Tarea 4.1 — Pasos numerados y ayuda

**Archivo:** `apps/web/src/catalog-import.ts`

**Descripción:** `ol.import-steps` con los 4 pasos y el desplegable «¿Cómo lleno la plantilla?» con las reglas de cada columna en lenguaje simple.

**Requisitos:** RF-MIS-05 · **Estado:** ✓ Completado

---

### Tarea 4.2 — Errores comprensibles

**Archivos:** `catalog-import.ts`, `apps/api/src/catalog/application/import-file.ts`

**Descripción:** Validar extensión y tamaño antes de subir; mostrar los errores por fila y columna; mensaje de encabezados con columnas faltantes, sobrantes y repetidas; mensajes con `role="status"` y `aria-live`.

**Requisitos:** RF-MIS-05 · **Estado:** ✓ Completado

---

### Tarea 4.3 — Resumen y uso en celular

**Archivos:** `catalog-import.ts`, `styles.css`

**Descripción:** Tarjetas de creados y actualizados, reporte CSV descargable, evento `applied` que recarga «Mis productos», y reglas responsive (`minmax(0, 1fr)`, archivo al 100 %).

**Requisitos:** RF-MIS-05, RF-MIS-06 · **Estado:** ✓ Completado

---

## Fase 5 — Pruebas y documentación

### Tarea 5.1 — Pruebas de integración (Jest + PostgreSQL)

| Prueba | Archivo y subprueba |
| ------ | ------------------- |
| PI-MIS-01 | `tests/identity.integration.cjs` · «mis productos: listar, ocultar y volver a publicar solo lo propio» |
| PI-MIS-02 | `tests/imports.integration.cjs` · «Encabezados mal escritos: el mensaje dice cuál falta y cuál sobra» |

**Estado:** ✓ Completado

---

### Tarea 5.2 — Pruebas de navegador (Playwright)

| Prueba | Archivo | Qué valida |
| ------ | ------- | ---------- |
| PN-MIS-01 | `tests/catalog.browser.cjs` | Panel visible solo para el proveedor; recorrido Excel; Ocultar y Publicar |
| PN-MIS-02 | `tests/demo.browser.cjs` | Recorrido completo en la demo |

**Estado:** ✓ Completado

---

### Tarea 5.3 — Contrato y revisión visual

**Descripción:** Documentar `GET /company/products`, `publish` y `unpublish` en `apps/api/openapi.yaml` (verificado por `tests/openapi.test.cjs`) y revisar de 320 a 1440 px con `npm run revisar:front`.

**Estado:** ✓ Completado

---

## Pendiente

### Tarea 6.1 — Editar precio y stock desde el panel

**Descripción:** Permitir cambiar precio y stock de un producto directamente en «Mis productos» (hoy se hace con la plantilla).

**Estado:** ○ Pendiente

---

## Trazabilidad completa del módulo

```
requirements.md            design.md                    tasks.md
      │                        │                            │
      │ RF-MIS-01..06          │ ownProducts()              │ Tareas 2.1..2.2 (API)
      │ RNF-MIS-01..06         │ publish() / unpublish()    │ Tareas 3.1..3.3 (panel)
      │ Estados del producto   │ identity.ts (panel)        │ Tareas 4.1..4.3 (asistente)
      │ Criterios EARS         │ catalog-import.ts          │ PI, PN
      └────────────────────────┴────────────────────────────┘
                               │
                      CÓDIGO IMPLEMENTADO
                               │
                      PRUEBAS EJECUTADAS (CI)
                               │
                   https://mayoristapro.shop ✓
```
