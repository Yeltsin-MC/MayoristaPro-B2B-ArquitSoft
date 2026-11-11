# Evidencia de cierre T3 — proveedor demo local

Comprobación ejecutada sobre la implementación `6d80482`, con la cuenta ficticia existente `proveedor@example.test` y su empresa «Mayorista Demo Local (ficticia)». No se recrearon cuentas ni se cambiaron contraseñas. Angular compilado y NestJS se sirvieron en un puerto local aleatorio contra la misma base PostgreSQL de desarrollo, evitando depender de los procesos antiguos en 3000/4200.

La automatización usó Edge headless 157.0.4341.42 mediante [la prueba de demo](../../tests/demo.browser.cjs). Se inspeccionaron también las capturas del error y del catálogo publicado. La contraseña no se incluye en estas evidencias ni en el código.

| Paso | Resultado observado |
|---|---|
| Iniciar sesión con proveedor demo | Correcto; empresa habilitada, proveedor verificado y permiso `publish`. |
| Controles por rol | «Solicitudes (administración)» ausente; «Publicar producto» visible. Los perfiles pendiente y sin `publish` se verificaron por separado en la batería aislada. |
| Descargar «Plantilla Excel» | Descarga real `catalogo.xlsx` desde el enlace de Angular. Se editó ese archivo para las dos cargas. |
| Subir precio `abc` | Lote con errores; fila 2, columna `precio`; sin confirmación disponible. Consulta PostgreSQL comprobó que el SKU todavía no existía. |
| Corregir a `48.00` y volver a cargar | Vista previa válida, 1 alta y 0 filas con errores; confirmación disponible. |
| Confirmar lote | Resultado aplicado: 1 alta y 0 actualizaciones. |
| Verificar catálogo | Tarjeta pública del producto visible tras recargar; PostgreSQL confirma publicación, precio `48.00` y stock 20. |
| Errores de ejecución | Ningún error JavaScript ni respuesta HTTP de error durante el recorrido. |
| Salir | Cierre de sesión completado. |

Producto que quedó en la base local para revisión:

- SKU: `T3-CIERRE-F5B02AA3AF`.
- Nombre: **Cuaderno demo cierre T3 2AA3AF**.
- ID: `232a7292-a68e-45ae-9f9a-7165875f0d79`.
- Presentación: caja de 12; mínimo 2, múltiplo 1; stock 20; precio S/ 48.00; publicado.

## Capturas del recorrido

[Vista previa con error de precio en fila 2](t3-cierre-demo/01-error-precio.png).

[Lote aplicado y producto visible en catálogo](t3-cierre-demo/03-catalogo-publicado.png).

## Verificación de cierre

| Comprobación | Resultado real |
|---|---|
| Migraciones | Código de salida 0. |
| Compilación Angular/NestJS | Código de salida 0. |
| Regresión HTTP T1/T2/T3 con PostgreSQL | 19 aprobadas, 0 fallidas, 0 omitidas. |
| Navegador con perfiles aislados y plantilla descargada | 5 aprobadas, 0 fallidas, 0 omitidas. |
| Navegador con proveedor demo existente | 1 aprobada, 0 fallidas. |

La comprobación con demo usa datos locales persistentes; CI mantiene sus pruebas y esquemas aislados. Esta evidencia acredita el recorrido de carga masiva, no las decisiones D4, ajustes de inventario, venta por peso/volumen ni Redis, que siguen pendientes según la [especificación SDD](../sprint-2-carga-masiva.md). La fusión a `main` queda para revisión.
