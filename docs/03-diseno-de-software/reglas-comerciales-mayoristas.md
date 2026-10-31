# Operación mayorista: catálogo, mínimos y recomendaciones

Diseño propuesto para la implementación. La carga masiva forma parte del núcleo inicial. Los valores de los ejemplos son ilustrativos; los mínimos comerciales se definirán por oferta y presentación, no mediante una cifra universal para todos los productos.

## 1. Carga del catálogo por bloques

El proveedor descarga una plantilla CSV o Excel, completa sus productos, carga el archivo y revisa un reporte antes de confirmar la importación. La edición individual queda disponible para correcciones y mantenimiento; no es el único medio de registrar un catálogo.

| Etapa | Comportamiento esperado |
|---|---|
| Preparación | Plantilla con SKU, nombre, categoría, presentación, unidades por presentación, precio por presentación, moneda, mínimo de compra, múltiplo de compra y stock disponible en presentaciones. |
| Validación | Comprobar proveedor autorizado, formato, campos obligatorios, SKU repetidos, cantidades enteras positivas, moneda y coherencia de precios y mínimos. Mostrar errores por fila y columna. |
| Vista previa | Informar cuántos productos son nuevos, cuáles actualizarían SKU propios y qué errores impiden confirmar. El proveedor revisa los cambios. |
| Confirmación | Aplicar un lote válido de forma transaccional y registrar su responsable. Si hay filas inválidas, se rechaza la confirmación completa hasta corregirlas. |
| Resultado | Entregar identificador del lote, cantidad de altas/actualizaciones y reporte descargable. Repetir la misma confirmación no duplica productos. |

Propuesta inicial: hasta **500 filas y 5 MB por archivo**, pendiente de evaluar con pruebas y recursos disponibles. Las imágenes se adjuntan después o se vinculan por SKU mediante un mecanismo autorizado; no se descargan direcciones arbitrarias de Internet desde una celda. Los archivos se leen como datos y no se ejecutan macros ni fórmulas.

En la importación inicial se declara stock. Las actualizaciones masivas de productos existentes no sobrescriben existencias: los movimientos posteriores de inventario se registran como ajustes autorizados, coordinados con las reservas. La unicidad se establece por proveedor y SKU. Estos límites permiten empezar con procesamiento acotado en el backend; lotes mayores requerirán evaluar tareas asíncronas.

## 2. Oferta del proveedor y mínimo del comprador

La **presentación de venta** determina qué significa una cantidad: unidad, paquete, docena, caja o saco. El stock, precio y cantidad del pedido deben utilizar la misma presentación y conservar su equivalencia en unidades base.

| Concepto | Regla propuesta |
|---|---|
| Presentación | El proveedor declara qué contiene la oferta: por ejemplo, una caja con 12 cuadernos. |
| Mínimo de compra | Menor cantidad de presentaciones que acepta el proveedor en un pedido de ese producto. |
| Múltiplo de compra | Incremento permitido: la cantidad debe ser múltiplo de ese valor y alcanzar el mínimo. El mínimo también debe ser múltiplo del incremento. |
| Stock ofertable | Se permite publicar una oferta activa cuando el stock alcanza al menos un mínimo de compra. Si cae por debajo, se conserva el producto pero se muestra sin disponibilidad para una nueva compra. |
| Operación mayorista | Para artículos contables se proponen lotes de varias unidades base. Comprar una caja puede cumplir la regla aunque la cantidad de presentaciones sea 1. Excepciones para bienes vendidos por unidad, peso o volumen se definirán por categoría antes de implementarlas. |
| Precio por volumen | Cada rango se expresa en la presentación declarada y sin solapamientos. Se muestra el precio aplicable a la cantidad elegida. |

**Ejemplo ilustrativo:** caja de 12 cuadernos, precio S/ 48 por caja, mínimo 2 cajas, múltiplo 1 caja y stock 20 cajas. El proveedor ofrece 240 cuadernos en total. El comprador puede pedir 2 cajas (24 cuadernos, S/ 96), pero no 1 caja. Si el múltiplo fuese 2, admitiría 2, 4 o 6 cajas, no 3.

No se exige que el proveedor publique una cantidad mínima de productos distintos: importar muchas referencias y vender un lote mayorista son conceptos diferentes. Un proveedor especializado puede tener pocas referencias y venderlas por volumen.

Se validarán mínimo, múltiplo y stock al responder la cotización, aceptar la oferta y crear el pedido. La aceptación no reserva existencias; la creación revalida dentro de la transacción y bloquea el stock. El pedido conserva presentación, equivalencia, cantidad y precio aceptados, aunque el catálogo cambie. Si cambian condiciones obligatorias entre la oferta y la creación, se informa el conflicto para recotizar, sin modificar silenciosamente el acuerdo.

## 3. Tarjetas comerciales y recomendaciones

El catálogo presentará tarjetas con información suficiente para decidir si solicitar una cotización:

| Información visible | Ejemplo ilustrativo |
|---|---|
| Producto y presentación | Cuaderno A4, caja de 12 unidades. |
| Proveedor y ubicación | Distribuidora de ejemplo, Huamanga; verificación vigente. |
| Precio y volumen | S/ 48 por caja; precio por volumen cuando corresponda. |
| Mínimo y disponibilidad | Mínimo 2 cajas; múltiplo 1; 20 cajas disponibles. |
| Acción | Solicitar cotización, indicando una cantidad válida. |
| Motivo de recomendación | “Puede atender tus 4 cajas y tiene menor precio para esa cantidad”. Solo cuando el criterio se haya calculado. |

La sección **Proveedores recomendados** mostrará ofertas elegibles para el producto, cantidad y ubicación consultados. Primero se filtra verificación, vigencia, compatibilidad de presentación, mínimo, múltiplo y disponibilidad. Después se aplica el orden documentado. No se comparan directamente cajas de distinto contenido sin normalizar la equivalencia y el importe de la cantidad solicitada.

El distintivo “Recomendado” debe indicar su motivo. No significa automáticamente “mejor proveedor” ni “IA entrenada”. Si todavía no se implementa recomendación, la interfaz ofrece filtros y orden por precio con ese nombre. Si falla Python, la alternativa conserva los mismos filtros de elegibilidad y se identifica como orden por precio. La validación definitiva de stock siempre ocurre al crear el pedido.

La página mostrada por la docente queda pendiente de identificar. Este diseño recoge las observaciones recordadas, sin atribuirle funcionalidades no verificadas a un sitio concreto.

## 4. Responsabilidades arquitectónicas

| Componente | Responsabilidad |
|---|---|
| Angular | Plantilla y carga del archivo, vista previa de errores, tarjetas y selector de cantidades. |
| Productos | Importación y SKU, presentaciones, mínimos, múltiplos, precios y disponibilidad. |
| Cotizaciones | Oferta por proveedor y condiciones de cantidad y precio. |
| Pedidos | Revalidación del acuerdo y persistencia del pedido con reserva atómica. |
| Recomendaciones | Filtrar candidatos y explicar el orden usando contratos de lectura autorizados. |
| PostgreSQL | Unicidad de SKU por proveedor, restricciones y transacciones sobre lotes y reservas. |

**Aceptación prevista:** importar un lote válido sin duplicados; rechazar un lote con errores indicando sus filas; impedir compras menores al mínimo o incompatibles con el múltiplo; no recomendar ofertas incapaces de atender la cantidad solicitada; impedir sobreventa entre compradores concurrentes.
