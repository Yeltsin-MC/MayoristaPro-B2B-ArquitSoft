-- Avisos por empresa: se generan con triggers en cada paso del flujo de compra,
-- así ningún camino (API, pagos, webhooks) se olvida de avisar.
CREATE TABLE IF NOT EXISTS notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  kind text NOT NULL,
  title text NOT NULL CHECK (char_length(title) <= 300),
  link text NOT NULL CHECK (link LIKE '/%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_company_idx ON notifications (company_id, id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (company_id) WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION notify_trade_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  buyer uuid; seller uuid; buyer_name text; seller_name text; product text;
BEGIN
  IF TG_TABLE_NAME = 'quotation_recipients' THEN
    SELECT c.id INTO seller FROM companies c WHERE c.supplier_id = NEW.supplier_id;
    SELECT b.legal_name INTO buyer_name FROM quotation_requests q JOIN companies b ON b.id = q.buyer_company_id WHERE q.id = NEW.request_id;
    IF seller IS NOT NULL THEN
      INSERT INTO notifications(company_id, kind, title, link)
      VALUES (seller, 'quote-request', 'Nueva solicitud de cotización de ' || buyer_name, '/cuenta/cotizaciones/' || NEW.request_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'quotation_offers' THEN
    SELECT q.buyer_company_id INTO buyer FROM quotation_requests q WHERE q.id = NEW.request_id;
    SELECT s.name INTO seller_name FROM suppliers s WHERE s.id = NEW.supplier_id;
    INSERT INTO notifications(company_id, kind, title, link)
    VALUES (buyer, 'offer', 'Nueva oferta de ' || seller_name, '/cuenta/cotizaciones/' || NEW.request_id);
  ELSIF TG_TABLE_NAME = 'quotation_requests' THEN
    IF NEW.accepted_offer_id IS NOT NULL AND OLD.accepted_offer_id IS DISTINCT FROM NEW.accepted_offer_id THEN
      SELECT c.id, b.legal_name INTO seller, buyer_name FROM quotation_offers o
        JOIN companies c ON c.supplier_id = o.supplier_id JOIN companies b ON b.id = NEW.buyer_company_id
        WHERE o.id = NEW.accepted_offer_id;
      IF seller IS NOT NULL THEN
        INSERT INTO notifications(company_id, kind, title, link)
        VALUES (seller, 'offer-accepted', buyer_name || ' aceptó tu oferta', '/cuenta/cotizaciones/' || NEW.id);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'trade_orders' THEN
    SELECT c.id INTO seller FROM companies c WHERE c.supplier_id = NEW.supplier_id;
    SELECT b.legal_name INTO buyer_name FROM companies b WHERE b.id = NEW.buyer_company_id;
    SELECT s.name INTO seller_name FROM suppliers s WHERE s.id = NEW.supplier_id;
    IF TG_OP = 'INSERT' THEN
      IF seller IS NOT NULL THEN
        INSERT INTO notifications(company_id, kind, title, link)
        VALUES (seller, 'order', 'Nuevo pedido de ' || buyer_name, '/cuenta/pedidos/' || NEW.id);
      END IF;
    ELSIF OLD.state IS DISTINCT FROM NEW.state THEN
      IF NEW.state = 'paid' AND seller IS NOT NULL THEN
        INSERT INTO notifications(company_id, kind, title, link)
        VALUES (seller, 'order-paid', buyer_name || ' pagó su pedido. Ya puedes prepararlo', '/cuenta/pedidos/' || NEW.id);
      ELSIF NEW.state = 'preparing' THEN
        INSERT INTO notifications(company_id, kind, title, link)
        VALUES (NEW.buyer_company_id, 'order-preparing', seller_name || ' está preparando tu pedido', '/cuenta/pedidos/' || NEW.id);
      ELSIF NEW.state = 'dispatched' THEN
        INSERT INTO notifications(company_id, kind, title, link)
        VALUES (NEW.buyer_company_id, 'order-dispatched', seller_name || ' despachó tu pedido', '/cuenta/pedidos/' || NEW.id);
      ELSIF NEW.state = 'delivered' AND seller IS NOT NULL THEN
        INSERT INTO notifications(company_id, kind, title, link)
        VALUES (seller, 'order-delivered', buyer_name || ' confirmó la entrega del pedido', '/cuenta/pedidos/' || NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS quotation_recipients_notify ON quotation_recipients;
CREATE TRIGGER quotation_recipients_notify AFTER INSERT ON quotation_recipients
  FOR EACH ROW EXECUTE FUNCTION notify_trade_event();
DROP TRIGGER IF EXISTS quotation_offers_notify ON quotation_offers;
CREATE TRIGGER quotation_offers_notify AFTER INSERT ON quotation_offers
  FOR EACH ROW EXECUTE FUNCTION notify_trade_event();
DROP TRIGGER IF EXISTS quotation_requests_notify ON quotation_requests;
CREATE TRIGGER quotation_requests_notify AFTER UPDATE OF accepted_offer_id ON quotation_requests
  FOR EACH ROW EXECUTE FUNCTION notify_trade_event();
DROP TRIGGER IF EXISTS trade_orders_notify ON trade_orders;
CREATE TRIGGER trade_orders_notify AFTER INSERT OR UPDATE OF state ON trade_orders
  FOR EACH ROW EXECUTE FUNCTION notify_trade_event();
