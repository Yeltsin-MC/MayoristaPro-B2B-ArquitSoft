ALTER TABLE products ADD CONSTRAINT products_id_supplier UNIQUE(id,supplier_id);
CREATE TABLE quotation_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), buyer_company_id uuid NOT NULL REFERENCES companies(id),
 actor_id uuid NOT NULL REFERENCES accounts(id), accepted_offer_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE quotation_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES quotation_requests(id),
 description text NOT NULL, unit text NOT NULL, units_per_pack integer NOT NULL CHECK(units_per_pack>0),
 quantity integer NOT NULL CHECK(quantity>0), UNIQUE(id,request_id)
);
CREATE TABLE quotation_recipients (
 request_id uuid NOT NULL REFERENCES quotation_requests(id), supplier_id uuid NOT NULL REFERENCES suppliers(id),
 PRIMARY KEY(request_id,supplier_id)
);
CREATE TABLE quotation_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL, supplier_id uuid NOT NULL,
 currency text NOT NULL CHECK(currency='PEN'), includes_tax boolean NOT NULL CHECK(includes_tax),
 shipping numeric(24,2) NOT NULL CHECK(shipping>=0), subtotal numeric(24,2) NOT NULL CHECK(subtotal>0),
 total numeric(24,2) NOT NULL CHECK(total=subtotal+shipping),
 delivery_days integer NOT NULL CHECK(delivery_days>0), expires_at timestamptz NOT NULL,
 actor_id uuid NOT NULL REFERENCES accounts(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(request_id,supplier_id), UNIQUE(id,request_id), UNIQUE(id,request_id,supplier_id),
 FOREIGN KEY(request_id,supplier_id) REFERENCES quotation_recipients(request_id,supplier_id)
);
ALTER TABLE quotation_requests ADD CONSTRAINT accepted_offer_belongs_to_request
 FOREIGN KEY(accepted_offer_id,id) REFERENCES quotation_offers(id,request_id);
CREATE TABLE quotation_offer_items (
 offer_id uuid NOT NULL REFERENCES quotation_offers(id), request_id uuid NOT NULL, supplier_id uuid NOT NULL,
 request_item_id uuid NOT NULL, product_id uuid NOT NULL, quantity integer NOT NULL CHECK(quantity>0),
 unit_price numeric(12,2) NOT NULL CHECK(unit_price>0), subtotal numeric(24,2) NOT NULL CHECK(subtotal=unit_price*quantity),
 snapshot jsonb NOT NULL, PRIMARY KEY(offer_id,request_item_id),
 FOREIGN KEY(offer_id,request_id,supplier_id) REFERENCES quotation_offers(id,request_id,supplier_id),
 FOREIGN KEY(request_item_id,request_id) REFERENCES quotation_items(id,request_id),
 FOREIGN KEY(product_id,supplier_id) REFERENCES products(id,supplier_id)
);
CREATE TABLE trade_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE REFERENCES quotation_requests(id),
 offer_id uuid NOT NULL UNIQUE, buyer_company_id uuid NOT NULL REFERENCES companies(id), supplier_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES accounts(id), state text NOT NULL DEFAULT 'pendiente' CHECK(state='pendiente'),
 currency text NOT NULL CHECK(currency='PEN'), includes_tax boolean NOT NULL CHECK(includes_tax),
 shipping numeric(24,2) NOT NULL CHECK(shipping>=0), subtotal numeric(24,2) NOT NULL CHECK(subtotal>0),
 total numeric(24,2) NOT NULL CHECK(total=subtotal+shipping), delivery_days integer NOT NULL CHECK(delivery_days>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(offer_id,request_id,supplier_id) REFERENCES quotation_offers(id,request_id,supplier_id)
);
CREATE TABLE trade_order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES trade_orders(id),
 product_id uuid NOT NULL REFERENCES products(id), request_item_id uuid NOT NULL REFERENCES quotation_items(id),
 quantity integer NOT NULL CHECK(quantity>0), unit_price numeric(12,2) NOT NULL CHECK(unit_price>0),
 subtotal numeric(24,2) NOT NULL CHECK(subtotal=unit_price*quantity), snapshot jsonb NOT NULL,
 UNIQUE(order_id,request_item_id)
);
CREATE TABLE stock_reservations (
 order_id uuid NOT NULL REFERENCES trade_orders(id), product_id uuid NOT NULL REFERENCES products(id),
 quantity integer NOT NULL CHECK(quantity>0), state text NOT NULL DEFAULT 'activa' CHECK(state='activa'),
 expires_at timestamptz, PRIMARY KEY(order_id,product_id)
);
CREATE TABLE order_keys (
 buyer_company_id uuid NOT NULL REFERENCES companies(id), key text NOT NULL,
 request_hash text NOT NULL, order_id uuid NOT NULL REFERENCES trade_orders(id),
 PRIMARY KEY(buyer_company_id,key)
);
CREATE INDEX requests_buyer ON quotation_requests(buyer_company_id,created_at);
CREATE INDEX recipients_supplier ON quotation_recipients(supplier_id,request_id);
CREATE INDEX orders_buyer ON trade_orders(buyer_company_id,created_at);
CREATE INDEX orders_supplier ON trade_orders(supplier_id,created_at);
