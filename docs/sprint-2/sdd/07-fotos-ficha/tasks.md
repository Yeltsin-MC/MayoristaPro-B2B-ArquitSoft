# Tareas — Fotos reales y ficha del producto

- [x] 1. Migración `010_product_media.sql` con `description`, `product_images` y trigger de caché
  - _Requisitos: 1.1–1.4_
- [x] 2. Incluir `images[]` y `description` en `GET /products` y documentarlo en OpenAPI
  - _Requisitos: 1.3_
- [x] 3. Seleccionar 417 fotos libres (Pixabay), convertirlas a WebP y registrar los créditos en `CREDITOS.md`
  - _Requisitos: 3.4_
- [x] 4. Mapa `fotos.json` y aplicación en `load.cjs`, reemplazando las fotos del producto en cada carga
  - _Requisitos: 3.1, 3.2_
- [x] 5. Tarjeta con foto principal y ficha con galería, miniaturas, crédito y «Ver detalle»
  - [x] 5.1 Diseño de dos columnas en computadora y botones fijos en celular
  - [x] 5.2 Ilustración de respaldo por categoría
  - _Requisitos: 2.1–2.4_
- [x] 6. Fotos reales para las 15 categorías de «Qué puedes comprar» (`CATEGORY_PHOTOS`)
  - _Requisitos: 3.3_
- [x] 7. Publicar en producción: imagen web con las fotos y carga de la demo en EC2 (859 fotos)
  - _Requisitos: 3.1_
- [ ] 8. Columnas `imagenes` y `descripcion` en la plantilla de carga masiva, para que el proveedor suba sus fotos (pendiente)
