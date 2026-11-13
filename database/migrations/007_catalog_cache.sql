-- The committed revision is authoritative even while Redis is unavailable.
CREATE TABLE IF NOT EXISTS catalog_cache_revision (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  last_txid text
);
INSERT INTO catalog_cache_revision(singleton) VALUES(true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION advance_catalog_cache_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Deferred execution runs after business writes/row locks are complete.
  -- At most one increment per transaction, including multi-row imports.
  EXECUTE format(
    'UPDATE %I.catalog_cache_revision SET revision=revision+1, last_txid=pg_current_xact_id()::text
     WHERE singleton AND last_txid IS DISTINCT FROM pg_current_xact_id()::text',
    TG_TABLE_SCHEMA
  );
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER products_catalog_cache_revision
AFTER INSERT OR UPDATE OR DELETE ON products
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION advance_catalog_cache_revision();

CREATE CONSTRAINT TRIGGER suppliers_catalog_cache_revision
AFTER INSERT OR UPDATE OR DELETE ON suppliers
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION advance_catalog_cache_revision();

CREATE CONSTRAINT TRIGGER companies_catalog_cache_revision
AFTER INSERT OR UPDATE OR DELETE ON companies
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION advance_catalog_cache_revision();
