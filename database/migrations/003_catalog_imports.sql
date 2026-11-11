ALTER TABLE products ADD COLUMN category text NOT NULL DEFAULT 'General';
ALTER TABLE products ADD COLUMN revision bigint NOT NULL DEFAULT 1;

-- Stock movements do not change metadata revisions. Even an edit followed by
-- restoring the old value must invalidate an earlier preview.
CREATE FUNCTION bump_product_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.supplier_id,NEW.sku,NEW.name,NEW.category,NEW.unit,
         NEW.units_per_pack,NEW.minimum,NEW.multiple,NEW.price,NEW.currency,
         NEW.includes_tax,NEW.published)
     IS DISTINCT FROM
     ROW(OLD.supplier_id,OLD.sku,OLD.name,OLD.category,OLD.unit,
         OLD.units_per_pack,OLD.minimum,OLD.multiple,OLD.price,OLD.currency,
         OLD.includes_tax,OLD.published) THEN
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER product_revision BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION bump_product_revision();

CREATE TABLE catalog_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  actor_id uuid NOT NULL REFERENCES accounts(id),
  status text NOT NULL CHECK (status IN ('preview','invalid','stale','applied')),
  rows jsonb NOT NULL,
  preview_hash text NOT NULL,
  confirmation_key text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  applied_at timestamptz
);
CREATE INDEX catalog_imports_supplier ON catalog_imports(supplier_id,created_at);
