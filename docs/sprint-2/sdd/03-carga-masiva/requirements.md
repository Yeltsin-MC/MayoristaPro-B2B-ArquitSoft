# Requisitos — Carga masiva del catálogo (CSV y Excel)

## Introducción

Un proveedor mayorista maneja cientos de productos: registrarlos uno por uno no es viable. Este módulo permite subir una plantilla CSV o Excel, revisar una vista previa con los errores por fila y columna, y confirmar el lote completo de forma atómica e idempotente.

Origen: [T3 — Carga masiva](../../carga-masiva.md). Criterios originales T3-AC01 a T3-AC12. La interfaz de 4 pasos está en [Mis productos](../08-mis-productos/requirements.md).

## Glosario

- **Lote:** archivo subido con su vista previa persistida (`preview`, `invalid`, `stale` o `applied`).
- **Huella (`previewHash`):** resumen de la vista previa que el proveedor confirma.
- **Clave de idempotencia (`Idempotency-Key`):** evita aplicar dos veces el mismo lote.

## Requisitos

### Requisito 1: Plantillas y vista previa

**Historia de usuario:** Como proveedor verificado, quiero descargar una plantilla y ver qué pasará antes de aplicar, para no dañar mi catálogo.

#### Criterios de aceptación

1. EL sistema DEBERÁ ofrecer plantillas CSV y XLSX públicas con las 12 columnas obligatorias: `sku`, `nombre`, `categoria`, `presentacion`, `unidades_por_presentacion`, `precio`, `moneda`, `incluye_igv`, `minimo`, `multiplo`, `stock`, `publicado`.
2. CUANDO el proveedor suba un archivo, EL sistema DEBERÁ mostrar altas, actualizaciones, stock conservado y errores por fila y columna, **sin modificar productos**.
3. SI los encabezados son incorrectos, ENTONCES EL sistema DEBERÁ indicar qué columnas faltan, cuáles sobran o están mal escritas y cuáles están repetidas.
4. SI el archivo supera 5 MiB o 500 filas, ENTONCES EL sistema DEBERÁ rechazarlo (413 o 400).

### Requisito 2: Validaciones por fila

#### Criterios de aceptación

1. EL sistema DEBERÁ validar SKU (1–64 caracteres), presentación (`unidad`, `paquete`, `docena`, `caja`, `saco`), enteros positivos, mínimo múltiplo del incremento, precio con hasta 2 decimales, moneda `PEN` e IGV `true/false`.
2. SI un SKU se repite en el archivo, ENTONCES EL sistema DEBERÁ rechazar todas sus filas.
3. EL sistema NO DEBERÁ ejecutar fórmulas Excel y DEBERÁ rechazar celdas que empiecen con `=`, `+`, `-` o `@` en textos.
4. SI una sola fila es inválida, ENTONCES EL sistema NO DEBERÁ permitir confirmar el lote.

### Requisito 3: Confirmación atómica e idempotente

**Historia de usuario:** Como proveedor, quiero confirmar el lote una sola vez y que se aplique completo o nada.

#### Criterios de aceptación

1. CUANDO el proveedor confirme antes de 30 minutos con `Idempotency-Key` y `previewHash`, EL sistema DEBERÁ aplicar productos, estado y auditoría en una sola transacción.
2. SI la confirmación se repite o llega dos veces a la vez, ENTONCES EL sistema DEBERÁ devolver el mismo resultado sin duplicar productos.
3. SI ocurre un fallo durante la aplicación, ENTONCES EL sistema DEBERÁ revertir todo.
4. SI un SKU cambió después de la vista previa, ENTONCES EL sistema DEBERÁ marcar el lote `stale` y responder 409.
5. EN productos existentes, EL sistema DEBERÁ conservar el stock vigente (la plantilla no repone stock).

### Requisito 4: Autorización

#### Criterios de aceptación

1. EL sistema DEBERÁ exigir vinculación activa con permiso `publish` y proveedor verificado, incluso para consultar un lote.
2. EL proveedor se DEBERÁ obtener de la sesión, nunca del archivo; un lote ajeno DEBERÁ responder 404.
3. SI el administrador retiró un producto, ENTONCES la carga NO DEBERÁ volver a publicarlo.
