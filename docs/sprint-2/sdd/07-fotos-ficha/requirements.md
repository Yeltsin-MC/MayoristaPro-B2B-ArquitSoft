# Requisitos — Fotos reales y ficha del producto

## Introducción

En compras mayoristas el comprador necesita reconocer el producto exacto antes de cotizar: marca, presentación y empaque. Este módulo agrega una galería de fotos y una descripción a cada producto, una ficha de detalle completa y fotos reales en las categorías de la portada. Para la demo se usan 417 fotos libres de Pixabay, revisadas a mano, que cubren 382 de los 450 productos.

## Glosario

- **Foto principal:** la de menor posición; se usa en la tarjeta del catálogo.
- **Crédito:** autor y licencia de la foto, mostrados en la ficha.
- **Ilustración de respaldo:** dibujo por categoría que se muestra cuando un producto no tiene foto o la imagen no carga.

## Requisitos

### Requisito 1: Galería por producto

**Historia de usuario:** Como comprador, quiero ver fotos reales del producto, para comprar con seguridad lo que necesito.

#### Criterios de aceptación

1. EL sistema DEBERÁ permitir de 1 a 10 fotos por producto, ordenadas por posición.
2. EL sistema DEBERÁ aceptar solo rutas propias (que empiecen con `/`) o URLs `https://`, de hasta 500 caracteres.
3. `GET /products` DEBERÁ devolver por producto la lista `images` (url, posición y crédito) y la `description` (hasta 2000 caracteres).
4. CUANDO cambien las fotos de un producto, EL sistema DEBERÁ invalidar la caché del catálogo igual que cuando cambia el producto.

### Requisito 2: Ficha del producto

**Historia de usuario:** Como comprador, quiero abrir una ficha con toda la información antes de cotizar.

#### Criterios de aceptación

1. CUANDO el comprador presione «Ver detalle», EL sistema DEBERÁ mostrar la galería con miniaturas, descripción, proveedor, presentación, precio, escalas por volumen, mínimo y disponibilidad.
2. En computadora, la foto DEBERÁ ir a la izquierda y los datos a la derecha; en celular, los botones de cotizar DEBERÁN quedar fijos al pie.
3. EL sistema DEBERÁ mostrar el crédito de la foto visible.
4. SI el producto no tiene foto o la imagen falla, ENTONCES EL sistema DEBERÁ mostrar la ilustración de respaldo de su categoría, sin romper el diseño.

### Requisito 3: Fotos de la demo y categorías

#### Criterios de aceptación

1. CUANDO se cargue el catálogo demo, EL sistema DEBERÁ registrar las fotos y descripciones según el mapa `database/demo/catalogo150/fotos.json`.
2. Repetir la carga NO DEBERÁ duplicar fotos (reemplaza las del producto).
3. La sección «Qué puedes comprar» DEBERÁ mostrar una foto real por cada una de las 15 categorías.
4. Las fotos DEBERÁN servirse en WebP desde el mismo sitio (sin depender de terceros) y sus créditos DEBERÁN constar en `CREDITOS.md`.
