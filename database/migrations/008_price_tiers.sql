-- Migración 008: precios por volumen (escalas por cantidad).
-- Cada escala indica el precio por presentación desde una cantidad mínima.
-- El precio base del producto sigue siendo el de products.price; una escala
-- solo aplica si su precio es menor al precio base vigente.
CREATE TABLE product_price_tiers (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL CHECK (min_quantity > 1),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price > 0),
  PRIMARY KEY (product_id, min_quantity)
);

-- Las escalas se muestran en el catálogo público: invalidan la caché igual que products.
CREATE CONSTRAINT TRIGGER product_price_tiers_catalog_cache_revision
AFTER INSERT OR UPDATE OR DELETE ON product_price_tiers
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION advance_catalog_cache_revision();
