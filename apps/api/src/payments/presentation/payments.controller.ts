// Presentation: HTTP REST controllers for payments

import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseFilters,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Payments } from '../application/payments';
import { PaymentError } from '../domain/payment';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { IdentityService } from '../../identity/identity.service';
import { Pool } from 'pg';

@Catch(PaymentError)
class PaymentFilter implements ExceptionFilter {
  catch(error: PaymentError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const statusCode = this.getStatusCode(error.code);
    response.status(statusCode).json({
      code: error.code,
      message: error.message,
    });
  }

  private getStatusCode(code: string): number {
    if (code === 'ORDER_NOT_FOUND') return 404;
    if (code === 'INVALID_SIGNATURE') return 401;
    if (code.startsWith('INVALID_')) return 422;
    return 409;
  }
}

@Controller()
@UseFilters(PaymentFilter)
export class PaymentsController {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  constructor(
    private readonly payments: Payments,
    private readonly identity: IdentityService,
  ) {}

  @Post('orders/:id/payment-attempts')
  async createPaymentAttempt(@Param('id') orderId: string, @Headers('authorization') auth?: string) {
    const db = await this.pool.connect();
    try {
      const actor = await this.identity.tradeIdentity(db, auth);
      if (!actor.canBuy) {
        throw new PaymentError('FORBIDDEN', 'Se requiere permiso de compra.');
      }
      return await this.payments.createPaymentAttempt(orderId, actor.companyId);
    } finally {
      db.release();
    }
  }

  @Get('orders/:id/payment-attempts')
  async getOrderAttempts(@Param('id') orderId: string, @Headers('authorization') auth?: string) {
    const db = await this.pool.connect();
    try {
      const actor = await this.identity.tradeIdentity(db, auth);
      if (!actor.canBuy) {
        throw new PaymentError('FORBIDDEN', 'Se requiere permiso de compra.');
      }
      return await this.payments.getOrderAttempts(orderId, actor.companyId);
    } finally {
      db.release();
    }
  }

  @Post('webhooks/mercadopago')
  @HttpCode(200)
  async handleWebhook(
    @Query('id') notificationId: string,
    @Query('topic') topic: string,
    @Query('data.id') dataId: string,
    @Query('type') type: string,
    @Body() body: any,
    @Headers('x-signature') xSignature?: string,
    @Headers('x-request-id') xRequestId?: string,
  ) {
    if (!notificationId || !dataId) {
      throw new BadRequestException('Missing notification ID or data ID');
    }

    // Verificar firma webhook
    const signatureVerified = this.verifyWebhookSignature({
      dataId,
      xSignature,
      xRequestId,
    });

    // Procesar webhook (con manejo de errores y registro)
    try {
      await this.payments.processWebhookNotification({
        notificationId,
        dataId,
        type: type || topic || 'payment',
        action: body.action || 'payment.updated',
        payload: body,
        signatureVerified,
      });
    } catch (error) {
      // Webhook registrado pero procesamiento falló
      // Registrar error para recuperación posterior
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Webhook] Processing error:', errorMsg);

      // Si es error de validación crítica, devolver error para que MP reintente
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Para otros errores, devolver 200 (webhook será recuperado por worker)
    }

    return { status: 'ok' };
  }

  private verifyWebhookSignature(params: { dataId: string; xSignature?: string; xRequestId?: string }): boolean {
    const { dataId, xSignature, xRequestId } = params;
    const secret = process.env.MP_WEBHOOK_SECRET;

    // En desarrollo/test sin secret, aceptar todo
    if (!secret || process.env.NODE_ENV === 'test') {
      return true;
    }

    if (!xSignature) {
      return false;
    }

    try {
      // Parsear x-signature: "ts=1704908010,v1=618c85345..."
      const parts = xSignature.split(',').reduce(
        (acc, part) => {
          const [key, value] = part.split('=');
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>,
      );

      const ts = parts.ts;
      const v1 = parts.v1;

      if (!ts || !v1) {
        return false;
      }

      // Construir manifiesto según documentación MP
      // Formato: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
      // Si alguno falta, se omite completo (incluido el ;)
      const manifestParts: string[] = [];
      if (dataId) manifestParts.push(`id:${dataId.toLowerCase()}`);
      if (xRequestId) manifestParts.push(`request-id:${xRequestId}`);
      if (ts) manifestParts.push(`ts:${ts}`);

      const manifest = manifestParts.join(';') + ';';

      // Calcular HMAC-SHA256
      const expected = createHmac('sha256', secret).update(manifest).digest('hex');

      // Comparación segura (timing-safe)
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
    } catch (error) {
      console.error('[Webhook] Signature verification error:', error);
      return false;
    }
  }
}
