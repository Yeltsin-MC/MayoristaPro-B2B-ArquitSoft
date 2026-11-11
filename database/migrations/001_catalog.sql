CREATE TABLE suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    verified boolean NOT NULL DEFAULT false
);

CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES suppliers(id),
    sku text NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    units_per_pack integer NOT NULL CHECK (units_per_pack > 0),
    minimum integer NOT NULL CHECK (minimum > 0),
    multiple integer NOT NULL CHECK (multiple > 0),
    stock integer NOT NULL CHECK (stock >= 0),
    price numeric(12, 2) NOT NULL CHECK (price > 0),
    currency text NOT NULL DEFAULT 'PEN' CHECK (currency = 'PEN'),
    includes_tax boolean NOT NULL,
    published boolean NOT NULL DEFAULT false,
    CHECK (minimum % multiple = 0),
    UNIQUE (supplier_id, sku)
);
