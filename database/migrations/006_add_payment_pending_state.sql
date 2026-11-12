-- Migración 006: Agregar estado payment_pending a stock_reservations
-- Autor: Sistema de pagos
-- Fecha: 2026-11-12
-- Descripción: Corrige omisión en migración 005 para soportar pedidos expirados con pago pendiente

-- Verificar que la migración 005 existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'stock_reservations_state_check'
  ) THEN
    RAISE EXCEPTION 'Migración 005 debe ejecutarse primero';
  END IF;
END $$;

-- Eliminar constraint existente
ALTER TABLE stock_reservations 
DROP CONSTRAINT stock_reservations_state_check;

-- Recrear con el nuevo estado
ALTER TABLE stock_reservations
ADD CONSTRAINT stock_reservations_state_check 
CHECK (state IN (
  'activa',          -- [T4] Reservada
  'consumed',        -- [T5] Consumida (pedido pagado)
  'expired',         -- [T5] Expiró sin pago
  'released',        -- [T5] Liberada por expiración o rechazo
  'payment_pending'  -- [T5] Pedido expirado con pago pendiente (reconciliación)
));

-- Nota: Esta migración es idempotente. Si payment_pending ya existe en el constraint,
-- el DROP y ADD funcionarán correctamente sin afectar datos existentes.
