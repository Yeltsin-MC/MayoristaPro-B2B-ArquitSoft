-- Migración 009: estados de despacho y entrega de pedidos pagados.
-- Flujo: paid → preparing (proveedor) → dispatched (proveedor) → delivered (comprador).
ALTER TABLE trade_orders DROP CONSTRAINT trade_orders_state_check;
ALTER TABLE trade_orders ADD CONSTRAINT trade_orders_state_check
CHECK (state IN (
  'pendiente',                   -- [T4] Esperando pago
  'paid',                        -- [T5] Pago confirmado a tiempo
  'expired',                     -- [T5] Expiró sin pago
  'expired_pending_payment',     -- [T5] Expiró con pago pendiente en MP
  'cancelled',                   -- [T5] Cancelado manualmente
  'requires_reconciliation',     -- [T5] Pago tardío o caso anómalo
  'preparing',                   -- Proveedor prepara el pedido
  'dispatched',                  -- Proveedor despachó el pedido
  'delivered'                    -- Comprador confirmó la recepción
));

-- Historial de cambios de estado de despacho (quién, cuándo y nota opcional,
-- p. ej. número de guía de remisión o transportista).
CREATE TABLE trade_order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES trade_orders(id),
  state text NOT NULL CHECK (state IN ('preparing', 'dispatched', 'delivered')),
  actor_id uuid NOT NULL REFERENCES accounts(id),
  note text CHECK (note IS NULL OR length(note) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, state)
);
CREATE INDEX trade_order_events_order ON trade_order_events(order_id, created_at);
