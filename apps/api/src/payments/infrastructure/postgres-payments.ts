// Infrastructure: PostgreSQL adapter for payments

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PaymentStore, PaymentAttempt, Order } from '../application/payments';
import { PaymentState } from '../domain/payment';

@Injectable()
export class PostgresPayments implements PaymentStore, OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleDestroy() {
    await this.pool.end();
  }

  private async tx<T>(work: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL lock_timeout='5s'");
      const result = await work(db);
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }

  async getOrder(orderId: string, companyId: string): Promise<Order | null> {
    const query = companyId
      ? 'SELECT id, buyer_company_id, state, total, shipping, expires_at, created_at FROM trade_orders WHERE id=$1 AND buyer_company_id=$2'
      : 'SELECT id, buyer_company_id, state, total, shipping, expires_at, created_at FROM trade_orders WHERE id=$1';
    
    const params = companyId ? [orderId, companyId] : [orderId];
    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  async getAttempts(orderId: string): Promise<PaymentAttempt[]> {
    const result = await this.pool.query(
      'SELECT id, order_id, state, preference_id, payment_id, amount, currency, mp_preference_response, mp_payment_response, created_at, updated_at FROM payment_attempts WHERE order_id=$1 ORDER BY created_at DESC',
      [orderId]
    );
    return result.rows;
  }

  async createAttempt(orderId: string, amount: number): Promise<{ id: string; attempt: PaymentAttempt }> {
    return this.tx(async (db) => {
      // Verificar que se puede crear (función de la migración)
      const check = await db.query('SELECT can_create_payment_attempt($1) AS allowed', [orderId]);
      if (!check.rows[0]?.allowed) {
        throw new Error('No se puede crear un nuevo intento de pago.');
      }

      // Crear intento
      const result = await db.query(
        'INSERT INTO payment_attempts(order_id, state, amount, currency) VALUES($1, $2, $3, $4) RETURNING id, order_id, state, preference_id, payment_id, amount, currency, mp_preference_response, mp_payment_response, created_at, updated_at',
        [orderId, 'created', amount.toFixed(2), 'PEN']
      );

      const attempt = result.rows[0];
      return { id: attempt.id, attempt };
    });
  }

  async updateAttemptWithPreference(attemptId: string, preferenceId: string, initPoint: string, response: any): Promise<void> {
    await this.pool.query(
      'UPDATE payment_attempts SET preference_id=$2, mp_preference_response=$3 WHERE id=$1',
      [attemptId, preferenceId, response]
    );
  }

  async updateAttemptState(attemptId: string, state: PaymentState, paymentId?: string, paymentResponse?: any): Promise<boolean> {
    return this.tx(async (db) => {
      // Bloquear el intento para evitar actualizaciones concurrentes
      const current = await db.query(
        'SELECT state, order_id FROM payment_attempts WHERE id=$1 FOR UPDATE',
        [attemptId]
      );

      if (!current.rows[0]) {
        return false;
      }

      const currentState = current.rows[0].state;
      const orderId = current.rows[0].order_id;

      // Actualizar intento
      await db.query(
        'UPDATE payment_attempts SET state=$2, payment_id=$3, mp_payment_response=$4 WHERE id=$1',
        [attemptId, state, paymentId || null, paymentResponse || null]
      );

      // Si el pago fue aprobado, actualizar el pedido y las reservas
      if (state === 'approved') {
        // Actualizar pedido solo si aún está pendiente (compare-and-set)
        const orderUpdate = await db.query(
          "UPDATE trade_orders SET state='paid' WHERE id=$1 AND state='pendiente' RETURNING id",
          [orderId]
        );

        if (orderUpdate.rowCount && orderUpdate.rowCount > 0) {
          // Consumir reservas (solo si el pedido cambió a paid)
          await db.query(
            "UPDATE stock_reservations SET state='consumed' WHERE order_id=$1 AND state='activa'",
            [orderId]
          );
        }
      }

      // Si el pago fue aprobado tarde, registrar para reconciliación
      if (state === 'approved_late') {
        const orderUpdate = await db.query(
          "UPDATE trade_orders SET state='requires_reconciliation' WHERE id=$1 AND state IN ('pendiente', 'expired') RETURNING id",
          [orderId]
        );

        if (orderUpdate.rowCount && orderUpdate.rowCount > 0) {
          await db.query(
            "INSERT INTO payment_reconciliations(order_id, payment_attempt_id, reason, notes) VALUES($1, $2, 'approved_late', 'Pago aprobado después de la expiración del pedido.')",
            [orderId, attemptId]
          );
        }
      }

      return true;
    });
  }

  async getAttemptByExternalReference(externalReference: string): Promise<PaymentAttempt | null> {
    const result = await this.pool.query(
      'SELECT id, order_id, state, preference_id, payment_id, amount, currency, mp_preference_response, mp_payment_response, created_at, updated_at FROM payment_attempts WHERE id=$1',
      [externalReference]
    );
    return result.rows[0] || null;
  }

  async markWebhookReceived(notificationId: string, payload: any, signatureVerified: boolean): Promise<void> {
    await this.pool.query(
      'INSERT INTO payment_webhook_events(notification_id, data_id, action, type, payload, signature_verified, processed, received_at) VALUES($1, $2, $3, $4, $5, $6, true, now()) ON CONFLICT (notification_id) DO NOTHING',
      [notificationId, payload.data?.id || '', payload.action || '', payload.type || '', payload, signatureVerified]
    );
  }

  async wasWebhookProcessed(notificationId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT processed FROM payment_webhook_events WHERE notification_id=$1',
      [notificationId]
    );
    return result.rows[0]?.processed ?? false;
  }
}
