-- Migración 010: fotos y descripción de productos.
-- Cada producto puede tener varias fotos (galería); la de menor posición es la
-- principal y se usa en la tarjeta del catálogo. credit guarda el autor y la
-- licencia de fotos libres (p. ej. «Foto: Ana · CC BY 2.0»).
ALTER TABLE products ADD COLUMN IF NOT EXISTS description text CHECK (char_length(description) <= 2000);

CREATE TABLE IF NOT EXISTS product_images (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 10),
  url text NOT NULL CHECK (char_length(url) <= 500 AND (url LIKE '/%' OR url LIKE 'https://%')),
  credit text CHECK (char_length(credit) <= 300),
  PRIMARY KEY (product_id, position)
);

-- Las fotos se muestran en el catálogo público: invalidan la caché igual que products.
CREATE CONSTRAINT TRIGGER product_images_catalog_cache_revision
AFTER INSERT OR UPDATE OR DELETE ON product_images
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION advance_catalog_cache_revision();
