# Requisitos — Mis productos y asistente de carga en 4 pasos

## Introducción

Antes, para publicar un producto el proveedor debía pegar su «ID de producto propio» en un formulario técnico, y la carga masiva era una sola pantalla con muchos controles. Este módulo reemplaza eso por un panel «Mis productos», con la lista de lo que la empresa vende y botones Publicar/Ocultar, y por un asistente de carga en 4 pasos con reglas en lenguaje simple.

La lógica de importación (validaciones, vista previa y confirmación atómica) está en [Carga masiva](../03-carga-masiva/requirements.md); aquí se especifica la experiencia del proveedor.

## Glosario

- **Publicado:** visible en el catálogo público.
- **Oculto:** existe, pero el proveedor lo retiró temporalmente del catálogo.
- **Retirado:** ocultado por el administrador ([Moderación](../05-moderacion/requirements.md)); el proveedor no puede publicarlo.

## Requisitos

### Requisito 1: Ver mis productos

**Historia de usuario:** Como proveedor, quiero ver todos mis productos y su estado en un solo lugar, para administrar mi catálogo.

#### Criterios de aceptación

1. CUANDO un usuario con permiso `publish` abra «Mis productos», EL sistema DEBERÁ listar todos los productos de su empresa (publicados, ocultos y retirados), con foto, SKU, nombre, precio, stock y estado.
2. EL panel DEBERÁ mostrar el resumen «N publicados de M» y permitir buscar por nombre o SKU.
3. SI el producto está retirado, ENTONCES EL panel DEBERÁ mostrar «Retirado» y el motivo del administrador, sin botón de publicar.
4. Usuarios sin permiso `publish`, proveedores no verificados y administradores NO DEBERÁN ver el panel.

### Requisito 2: Publicar y ocultar

**Historia de usuario:** Como proveedor, quiero ocultar un producto agotado y volver a publicarlo cuando tenga stock, con un clic.

#### Criterios de aceptación

1. CUANDO el proveedor presione «Ocultar», EL sistema DEBERÁ despublicar el producto (`POST /products/:id/unpublish`) y registrarlo en auditoría.
2. CUANDO presione «Publicar», EL sistema DEBERÁ publicarlo solo si es propio, el proveedor está verificado y el stock alcanza el pedido mínimo.
3. SI el producto es de otra empresa, ENTONCES EL sistema DEBERÁ responder 403.
4. Los botones DEBERÁN tener nombre accesible con el producto («Publicar <nombre>», «Ocultar <nombre>»).
5. CUANDO cambie un estado, EL panel y el catálogo público DEBERÁN reflejarlo sin recargar la página.

### Requisito 3: Asistente de carga en 4 pasos

**Historia de usuario:** Como proveedor sin conocimientos técnicos, quiero que la carga masiva me guíe paso a paso.

#### Criterios de aceptación

1. EL asistente DEBERÁ mostrar 4 pasos numerados: (1) descargar la plantilla, (2) subir el archivo, (3) revisar la vista previa y (4) confirmar.
2. EL asistente DEBERÁ incluir una sección desplegable «¿Cómo lleno la plantilla?» con las reglas en lenguaje simple.
3. CUANDO haya errores, EL asistente DEBERÁ mostrarlos por fila y columna; SI los encabezados están mal, DEBERÁ decir cuáles faltan, sobran o se repiten.
4. CUANDO se confirme el lote, EL asistente DEBERÁ mostrar tarjetas de resumen (creados y actualizados) y actualizar «Mis productos».
5. El asistente DEBERÁ funcionar en celular sin desbordar la pantalla.
