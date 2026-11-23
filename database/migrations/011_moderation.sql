-- Moderación del administrador: retirar productos y suspender empresas, con bitácora.
ALTER TABLE products ADD COLUMN IF NOT EXISTS retired_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS retired_reason text CHECK (char_length(retired_reason) <= 500);
-- Un producto retirado nunca queda publicado (la importación tampoco puede republicarlo).
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_retired_unpublished;
ALTER TABLE products ADD CONSTRAINT products_retired_unpublished CHECK (retired_at IS NULL OR NOT published);

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies ADD CONSTRAINT companies_status_check CHECK (status IN ('pending','enabled','suspended'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_reason text CHECK (char_length(suspended_reason) <= 500);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES accounts(id),
  action text NOT NULL CHECK (action IN ('retire-product','restore-product','suspend-company','reactivate-company')),
  resource_id uuid NOT NULL,
  resource_name text NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_actions_created_idx ON moderation_actions (created_at DESC);
