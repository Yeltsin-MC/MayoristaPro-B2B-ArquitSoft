CREATE TABLE companies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ruc text NOT NULL UNIQUE CHECK (ruc ~ '^[0-9]{11}$'),
 legal_name text NOT NULL CHECK (length(legal_name) BETWEEN 2 AND 200),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','enabled')),
 review_label text,
 supplier_id uuid NOT NULL UNIQUE REFERENCES suppliers(id)
);
CREATE TABLE accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE CHECK (email = lower(email)),
 password_hash text NOT NULL,
 platform_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id),
 account_id uuid NOT NULL UNIQUE REFERENCES accounts(id),
 permissions text[] NOT NULL DEFAULT '{}',
 active boolean NOT NULL DEFAULT true,
 UNIQUE(company_id, account_id),
 CHECK (permissions <@ ARRAY['manage','buy','publish']::text[])
);
CREATE TABLE enrollment_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL UNIQUE REFERENCES companies(id),
 account_id uuid NOT NULL UNIQUE REFERENCES accounts(id),
 evidence text NOT NULL,
 approved_by uuid REFERENCES accounts(id),
 approved_at timestamptz
);
CREATE TABLE identity_sessions (
 token_hash text PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES accounts(id),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '8 hours'
);
CREATE TABLE invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id),
 email text NOT NULL,
 permissions text[] NOT NULL CHECK (permissions <@ ARRAY['buy','publish']::text[]),
 token_hash text NOT NULL UNIQUE,
 created_by uuid NOT NULL REFERENCES memberships(id),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
 used_at timestamptz
);
CREATE TABLE identity_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES accounts(id),
 action text NOT NULL,
 resource_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
