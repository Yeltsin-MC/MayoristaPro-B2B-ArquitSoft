#!/usr/bin/env node
/**
 * Worker: Recuperación de webhooks fallidos
 * 
 * Procesa webhooks que fueron recibidos pero fallaron en su procesamiento inicial.
 * Debe ejecutarse periódicamente (ej: cada 5 minutos) mediante cron.
 * 
 * Uso: node apps/api/src/workers/recover-webhooks.cjs
 * 
 * Idempotencia garantizada: solo procesa eventos con processed=false y signature_verified=true
 */

const { Pool } = require('pg');
const path = require('path');

// Cargar variables de entorno si existe .env
try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
} catch (e) {
  // .env opcional
}

async function recoverWebhooks() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[Webhook Recovery] ERROR: DATABASE_URL no configurado.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Obtener webhooks pendientes (verificados pero no procesados, con más de 1 minuto de antigüedad)
    const pending = await pool.query(
      "SELECT notification_id, data_id, action, type, payload, received_at FROM payment_webhook_events WHERE processed=false AND signature_verified=true AND received_at < now()-interval '1 minute' ORDER BY received_at ASC LIMIT 50"
    );

    if (pending.rowCount === 0) {
      console.log('[Webhook Recovery] No hay webhooks pendientes de recuperación.');
      await pool.end();
      return { processed: 0, failed: 0 };
    }

    console.log(`[Webhook Recovery] Recuperando ${pending.rowCount} webhooks pendientes...`);

    let processed = 0;
    let failed = 0;

    // Cargar módulo de pagos dinámicamente
    const { Payments } = require('../payments/application/payments');
    const { PostgresPayments } = require('../payments/infrastructure/postgres-payments');
    const { MercadoPagoGateway } = require('../payments/infrastructure/mercadopago-gateway');

    const store = new PostgresPayments();
    const gateway = new MercadoPagoGateway();
    const payments = new Payments(store, gateway);

    for (const webhook of pending.rows) {
      try {
        await payments.processWebhookNotification({
          notificationId: webhook.notification_id,
          dataId: webhook.data_id,
          type: webhook.type,
          action: webhook.action,
          payload: webhook.payload,
          signatureVerified: true, // Ya fue verificado al recibirse
        });

        processed++;
        console.log(`[Webhook Recovery] ✓ Procesado: ${webhook.notification_id}`);
      } catch (error) {
        const errorMsg = error.message || 'Error desconocido';
        
        // Registrar error en la base de datos
        await pool.query(
          'UPDATE payment_webhook_events SET processing_error=$2 WHERE notification_id=$1',
          [webhook.notification_id, errorMsg.substring(0, 500)]
        );

        failed++;
        console.error(`[Webhook Recovery] ✗ Falló: ${webhook.notification_id} - ${errorMsg}`);
      }
    }

    console.log(`[Webhook Recovery] Completado: ${processed} procesados, ${failed} fallidos.`);

    await pool.end();
    return { processed, failed };
  } catch (error) {
    console.error('[Webhook Recovery] ERROR:', error);
    await pool.end();
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  recoverWebhooks()
    .then(result => {
      console.log(`[Webhook Recovery] Resultado final: ${JSON.stringify(result)}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('[Webhook Recovery] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { recoverWebhooks };
