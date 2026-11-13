#!/usr/bin/env node
// Worker: Liberar reservas de pedidos vencidos

const { Pool } = require('pg');

async function expireOrders() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query('BEGIN');

    // Buscar pedidos vencidos que aún están en estado pendiente o con pago pendiente
    const expired = await pool.query(`
      SELECT o.id, o.state, 
             (SELECT COUNT(*)::int FROM payment_attempts WHERE order_id = o.id AND state IN ('pending', 'created')) AS active_payments
      FROM trade_orders o
      WHERE o.expires_at < now()
        AND o.state IN ('pendiente', 'expired_pending_payment')
      FOR UPDATE OF o
    `);

    if (expired.rows.length === 0) {
      await pool.query('COMMIT');
      console.log(`[${new Date().toISOString()}] No hay pedidos vencidos.`);
      return;
    }

    for (const order of expired.rows) {
      const newState = order.active_payments > 0 ? 'expired_pending_payment' : 'expired';

      // Actualizar estado del pedido
      await pool.query('UPDATE trade_orders SET state = $1 WHERE id = $2', [newState, order.id]);

      // Si no hay pagos pendientes, liberar reservas y devolver stock
      if (order.active_payments === 0) {
        // Obtener reservas activas
        const reservations = await pool.query(
          'SELECT product_id, quantity FROM stock_reservations WHERE order_id = $1 AND state = $2',
          [order.id, 'activa'],
        );

        // Liberar reservas y devolver stock
        for (const res of reservations.rows) {
          await pool.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [res.quantity, res.product_id]);
        }

        // Marcar reservas como expiradas
        await pool.query("UPDATE stock_reservations SET state = 'expired' WHERE order_id = $1 AND state = 'activa'", [
          order.id,
        ]);

        console.log(`[${new Date().toISOString()}] Pedido ${order.id} expirado, stock liberado.`);
      } else {
        // Marcar reservas como pendientes de pago vencido
        await pool.query(
          "UPDATE stock_reservations SET state = 'payment_pending' WHERE order_id = $1 AND state = 'activa'",
          [order.id],
        );

        console.log(
          `[${new Date().toISOString()}] Pedido ${order.id} expirado con pago pendiente (requiere reconciliación).`,
        );
      }
    }

    await pool.query('COMMIT');
    console.log(`[${new Date().toISOString()}] Procesados ${expired.rows.length} pedidos vencidos.`);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(`[${new Date().toISOString()}] Error al expirar pedidos:`, error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Si se ejecuta directamente (no en tests)
if (require.main === module) {
  expireOrders()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { expireOrders };
