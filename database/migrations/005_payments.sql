-- =====================================================
-- MIGRATION 005: Payment Integration with Mercado Pago
-- Autor: Sistema
-- Fecha: 2026-11-11
-- Objetivo: Integrar pagos con MP Checkout Pro sin romper T1-T4
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Ampliar trade_orders con expiración y nuevos estados
-- =====================================================

-- 1.1. Agregar columna expires_at (calculada desde created_at + 30 min)
ALTER TABLE trade_orders 
ADD COLUMN expires_at timestamptz;

-- 1.2. Backfill: calcular expiración para pedidos existentes
UPDATE trade_orders 
SET expires_at = created_at + INTERVAL '30 minutes'
WHERE expires_at IS NULL;

-- 1.3. Hacer expires_at obligatorio
ALTER TABLE trade_orders 
ALTER COLUMN expires_at SET NOT NULL;

-- 1.4. Agregar default para nuevos registros (basado en created_at)
-- Nota: DEFAULT no puede referenciar otras columnas directamente
-- Se usará trigger para garantizar expires_at = created_at + 30 min
ALTER TABLE trade_orders 
ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '30 minutes');

-- 1.5. Ampliar constraint de estados (mantener compatibilidad T4)
ALTER TABLE trade_orders 
DROP CONSTRAINT IF EXISTS trade_orders_state_check;

ALTER TABLE trade_orders
ADD CONSTRAINT trade_orders_state_check 
CHECK (state IN (
  'pendiente',                   -- [T4] Esperando pago
  'paid',                        -- [T5] Pago confirmado a tiempo
  'expired',                     -- [T5] Expiró sin pago
  'expired_pending_payment',     -- [T5] Expiró con pago pendiente en MP
  'cancelled',                   -- [T5] Cancelado manualmente
  'requires_reconciliation'      -- [T5] Pago tardío o caso anómalo
));

-- 1.6. Índice para worker de expiración
CREATE INDEX idx_trade_orders_expires_at 
ON trade_orders(expires_at) 
WHERE state IN ('pendiente', 'expired_pending_payment');

-- =====================================================
-- 2. Ampliar stock_reservations con nuevos estados
-- =====================================================

-- 2.1. Ampliar constraint de estados (mantener compatibilidad T4)
ALTER TABLE stock_reservations 
DROP CONSTRAINT IF EXISTS stock_reservations_state_check;

ALTER TABLE stock_reservations
ADD CONSTRAINT stock_reservations_state_check 
CHECK (state IN (
  'activa',      -- [T4] Reservada
  'consumed',    -- [T5] Consumida (pedido pagado)
  'expired',     -- [T5] Expiró sin pago
  'released'     -- [T5] Liberada por expiración o rechazo
));

-- 2.2. Índice para consultas del worker
CREATE INDEX idx_stock_reservations_order_state 
ON stock_reservations(order_id, state);

-- =====================================================
-- 3. Tabla de intentos de pago
-- =====================================================

CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES trade_orders(id) ON DELETE CASCADE,
  
  -- Estados del intento
  state text NOT NULL CHECK (state IN (
    'created',       -- Creado, esperando respuesta MP
    'pending',       -- MP respondió, pago pendiente
    'approved',      -- Aprobado a tiempo
    'approved_late', -- Aprobado después de expiración
    'rejected',      -- Rechazado por MP
    'cancelled',     -- Cancelado por usuario
    'refunded'       -- Reembolsado (futuro)
  )),
  
  -- IDs de Mercado Pago
  preference_id text,              -- ID de preferencia MP
  payment_id text,                 -- ID de pago MP (cuando confirma)
  
  -- Montos siempre en PEN
  amount numeric(24,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency = 'PEN'),
  
  -- Respuestas completas de MP (para debugging/audit)
  mp_preference_response jsonb,
  mp_payment_response jsonb,
  
  -- Metadatos
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints de unicidad
  UNIQUE(preference_id),  -- Una preferencia = un intento
  UNIQUE(payment_id)      -- Un pago = un intento
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_payment_attempts_order_id ON payment_attempts(order_id);
CREATE INDEX idx_payment_attempts_state ON payment_attempts(state);
CREATE INDEX idx_payment_attempts_order_created 
ON payment_attempts(order_id, created_at DESC);

-- Índice para worker de reconciliación (pagos pendientes antiguos)
CREATE INDEX idx_payment_attempts_pending_stale
ON payment_attempts(updated_at)
WHERE state = 'pending';

-- GARANTÍA DE CONCURRENCIA: Solo un intento activo por pedido
-- Índice único parcial que impide múltiples intentos en estados activos
CREATE UNIQUE INDEX idx_payment_attempts_active_order
ON payment_attempts(order_id)
WHERE state IN ('created', 'pending');

-- =====================================================
-- 4. Tabla de eventos webhook (deduplicación)
-- =====================================================

CREATE TABLE payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- IDs de MP para deduplicación
  notification_id text NOT NULL UNIQUE, -- ID único de notificación MP
  data_id text NOT NULL,                -- payment.id del query string
  action text NOT NULL,                 -- payment.updated, payment.created
  type text NOT NULL,                   -- payment, merchant_order
  
  -- Payload completo
  payload jsonb NOT NULL,
  
  -- Verificación de firma
  signature_verified boolean NOT NULL DEFAULT false,
  x_signature text,
  x_request_id text,
  
  -- Estado de procesamiento
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  processing_error text,
  
  -- Metadatos
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para deduplicación y consulta
CREATE INDEX idx_webhook_events_notification_id 
ON payment_webhook_events(notification_id);

CREATE INDEX idx_webhook_events_data_id 
ON payment_webhook_events(data_id);

CREATE INDEX idx_webhook_events_unprocessed 
ON payment_webhook_events(received_at) 
WHERE NOT processed;

-- =====================================================
-- 5. Tabla de reconciliaciones (casos especiales)
-- =====================================================

CREATE TABLE payment_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencias
  order_id uuid NOT NULL REFERENCES trade_orders(id) ON DELETE CASCADE,
  payment_attempt_id uuid REFERENCES payment_attempts(id) ON DELETE SET NULL,
  
  -- Razón de reconciliación
  reason text NOT NULL CHECK (reason IN (
    'approved_late',           -- Pago aprobado post-expiración
    'expired_pending_payment', -- Expiró con pago pendiente
    'webhook_never_arrived',   -- Webhook no llegó
    'amount_mismatch',         -- Monto no coincide
    'manual_adjustment'        -- Ajuste manual admin
  )),
  
  -- Descripción y notas
  notes text,
  
  -- Estado de resolución
  resolved boolean NOT NULL DEFAULT false,
  resolved_by text,              -- username del admin
  resolved_at timestamptz,
  resolution_notes text,
  
  -- Metadatos
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_reconciliations_order_id 
ON payment_reconciliations(order_id);

CREATE INDEX idx_reconciliations_unresolved 
ON payment_reconciliations(created_at) 
WHERE NOT resolved;

CREATE INDEX idx_reconciliations_reason 
ON payment_reconciliations(reason) 
WHERE NOT resolved;

-- =====================================================
-- 6. Trigger para expires_at en trade_orders
-- =====================================================

-- Garantizar que expires_at siempre sea created_at + 30 minutos
CREATE OR REPLACE FUNCTION set_order_expiration()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at = NEW.created_at + INTERVAL '30 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_expiration
BEFORE INSERT ON trade_orders
FOR EACH ROW
EXECUTE FUNCTION set_order_expiration();

-- =====================================================
-- 7. Trigger para updated_at en payment_attempts
-- =====================================================

CREATE OR REPLACE FUNCTION update_payment_attempt_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_attempt_updated
BEFORE UPDATE ON payment_attempts
FOR EACH ROW
EXECUTE FUNCTION update_payment_attempt_timestamp();

-- =====================================================
-- 8. Función auxiliar: contar intentos activos de un pedido
-- =====================================================

CREATE OR REPLACE FUNCTION count_active_payment_attempts(p_order_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM payment_attempts
    WHERE order_id = p_order_id
      AND state IN ('created', 'pending')
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 9. Función auxiliar: verificar si orden puede tener nuevo intento
-- =====================================================

CREATE OR REPLACE FUNCTION can_create_payment_attempt(p_order_id uuid)
RETURNS boolean AS $$
DECLARE
  v_total_attempts integer;
  v_active_attempts integer;
  v_order_state text;
  v_expires_at timestamptz;
BEGIN
  -- Obtener estado y expiración del pedido
  SELECT state, expires_at INTO v_order_state, v_expires_at
  FROM trade_orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Solo pedidos pendientes pueden tener nuevos intentos
  IF v_order_state != 'pendiente' THEN
    RETURN false;
  END IF;
  
  -- No permitir si ya expiró
  IF v_expires_at < now() THEN
    RETURN false;
  END IF;
  
  -- Contar intentos totales (máximo 3)
  SELECT COUNT(*)::integer INTO v_total_attempts
  FROM payment_attempts
  WHERE order_id = p_order_id;
  
  IF v_total_attempts >= 3 THEN
    RETURN false;
  END IF;
  
  -- No permitir si ya hay un intento activo (created o pending)
  SELECT count_active_payment_attempts(p_order_id) INTO v_active_attempts;
  
  IF v_active_attempts > 0 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 10. Verificar integridad
-- =====================================================

-- Confirmar que columnas existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trade_orders' AND column_name = 'expires_at'
  ) THEN
    RAISE EXCEPTION 'Column trade_orders.expires_at not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'payment_attempts'
  ) THEN
    RAISE EXCEPTION 'Table payment_attempts not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'payment_webhook_events'
  ) THEN
    RAISE EXCEPTION 'Table payment_webhook_events not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'payment_reconciliations'
  ) THEN
    RAISE EXCEPTION 'Table payment_reconciliations not created';
  END IF;
END $$;

COMMIT;
