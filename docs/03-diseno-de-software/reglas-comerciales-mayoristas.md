# Operación mayorista: catálogo, mínimos y recomendaciones

Diseño propuesto para la implementación. La carga masiva es un requisito obligatorio del MVP de MayoristaPro, conforme a la observación de la docente. El proveedor debe poder incorporar su catálogo mediante archivos, sin registrar cada producto manualmente. Un catálogo que supere el límite por archivo podrá dividirse en varios lotes; “carga masiva” no significa un archivo de tamaño ilimitado. Los valores de los ejemplos son ilustrativos; los mínimos comerciales se definirán por oferta y presentación, no mediante una cifra universal para todos los productos.

## 1. Carga del catálogo por bloques

El proveedor descarga una plantilla CSV o Excel, completa sus productos, carga el archivo y revisa un reporte antes de confirmar la importación. La edición individual queda disponible para correcciones y mantenimiento; no es el único medio de registrar un catálogo.

| Etapa | Comportamiento esperado |
|---|---|
| Preparación | Plantilla con SKU, nombre, categoría, presentación, unidades por presentación, precio por presentación, moneda, indicador de IGV, mínimo de compra, múltiplo de compra y stock disponible en presentaciones. |
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

### Catálogo al ingresar

La página de inicio mostrará productos publicados de proveedores verificados, buscador y categorías, sin exigir iniciar sesión para explorar. Solicitar cotización, acceder a condiciones privadas y crear pedidos requiere una cuenta empresarial autenticada. No se mostrarán cotizaciones, contactos privados ni precios negociados de otras empresas.

En el MVP, cada tarjeta corresponde a una oferta de un proveedor: imagen, nombre del producto, presentación, nombre del proveedor, ubicación, precio publicado, mínimo, múltiplo y disponibilidad. Al abrirla se accede al detalle de la oferta dentro de MayoristaPro. El catálogo inicial puede ordenar por fecha de publicación; una sección recomendada solo se habilita cuando exista un criterio calculado y explicado.

### Precio y comparación de ofertas

El precio visible procede del catálogo registrado por el proveedor; no se obtiene automáticamente de tiendas externas. Se muestra en PEN y por presentación (por ejemplo, S/ 48 por caja de 12), con indicación de si incluye IGV y de que el envío se cotiza aparte. Si existen rangos por volumen, se indica “desde” junto a la cantidad necesaria para ese precio y se calcula el importe correspondiente a la cantidad seleccionada. La cotización aceptada conserva el precio final y las condiciones acordadas.

Si se incorpora después una tarjeta que agrupe varios proveedores, solo reunirá ofertas del mismo producto identificado y con presentaciones comparables. El SKU es propio de cada proveedor y no demuestra equivalencia entre empresas. El precio “desde” será el menor precio publicado entre ofertas vigentes elegibles para la cantidad consultada, mostrando el proveedor de origen; no implica mejor reputación ni menor costo total con transporte. Si no hay cantidad seleccionada, cada oferta mostrará su propio mínimo y rango, sin un precio agregado engañoso.

El ejemplo recordado de enlaces a Falabella u Oechsle se toma como referencia de navegación, sin afirmar que esas empresas formen parte del proyecto. El MVP no incluye redirección para comprar en tiendas externas ni extracción automática de sus precios: mantiene el recorrido catálogo → cotización → pedido en MayoristaPro. La agrupación automática por producto común queda para una ampliación que requerirá definir su identificación y contrato de datos.

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

## Referencias de plataformas

- [Alibaba: herramientas de productos](https://seller.alibaba.com/pages/producttools/index.html): carga masiva de publicaciones desde Excel. Se toma como referencia para plantilla, carga y administración de un catálogo.
- [Deltron: inscripción de distribuidores](https://www.deltron.com.pe/xtranet/distribuidores/inscripcion.html): catálogo y condiciones comerciales para distribuidores, incluidos precios según volumen. Sirve como referencia del usuario empresarial; no implica replicar sus reglas de acceso.

Estas referencias sustentan decisiones concretas y no identifican la página mostrada por la docente. La venta B2B describe una relación comercial entre empresas; en MayoristaPro, la carga masiva se exige además como condición específica del MVP.

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
