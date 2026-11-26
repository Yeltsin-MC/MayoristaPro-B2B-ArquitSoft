# Archivos de ejemplo para la carga masiva

Archivos para probar «Mis productos → Carga masiva» en clase. La empresa y los productos son ficticios, con fines académicos.

| Archivo | Contenido | Resultado esperado |
|---|---|---|
| `distribuidora-wari-15-productos.csv` | 15 abarrotes de un proveedor de Huamanga (SKU `WARI-001` a `WARI-015`) | Vista previa con **15 nuevos** y 0 errores. Al confirmar, aparecen en el catálogo. |
| `distribuidora-wari-con-errores.csv` | 6 filas, 3 con errores a propósito | Vista previa con **3 filas con error**; el sistema no deja confirmar. |

Errores incluidos en el segundo archivo:

1. Fila 3 (`WARIX-002`): precio negativo (`-12.00`).
2. Fila 5 (`WARIX-004`): stock 0, menor que el mínimo, en un producto publicado.
3. Fila 6 (`WARIX-005`): categoría vacía.

## Cómo usarlos en la exposición

1. Registra la empresa: **Mi cuenta → Registrar empresa**, con un RUC ficticio de 11 dígitos (por ejemplo `20999000099`) y la razón social «Distribuidora Wari S.A.C.».
2. Ingresa como administrador, aprueba la solicitud y verifica al proveedor.
3. Ingresa con la cuenta nueva y completa la **Dirección del almacén** (por ejemplo, Huamanga, Ayacucho).
4. En **Mis productos → Carga masiva**, sube primero el archivo con errores, para mostrar la validación, y luego el de 15 productos y confírmalo.
5. Busca «Wari» o «quinua» en el catálogo: los productos aparecen con «Despacha desde Huamanga».
