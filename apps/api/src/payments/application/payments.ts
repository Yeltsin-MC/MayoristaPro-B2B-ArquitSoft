// Application: Payment use cases and coordination

import {
  rule,
  PaymentError,
  validateCurrency,
  validateAmount,
  validateOrderForPayment,
  canCreateAttempt,
  canTransitionTo,
  PaymentState,
} from '../domain/payment';

export interface PaymentAttempt {
  id: string;
  order_id: string;
  state: PaymentState;
  preference_id: string | null;
  payment_id: string | null;
  amount: string;
  currency: string;
  mp_preference_response: any;
  mp_payment_response: any;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  buyer_company_id: string;
  state: string;
  total: string;
  shipping: string;
  expires_at: Date;
  created_at: Date;
}

export interface PaymentGateway {
  createPreference(params: {
    external_reference: string;
    items: Array<{ title: string; quantity: number; unit_price: number }>;
    shipment_cost: number;
    expires_at: Date;
    back_urls?: { success: string; failure: string; pending: string };
  }): Promise<{ preference_id: string; init_point: string; response: any }>;

  getPaymentInfo(paymentId: string): Promise<{
    id: string;
    status: string;
    status_detail: string;
    transaction_amount: number;
    currency_id: string;
    external_reference: string | null;
  }>;
}

export interface PaymentStore {
  getOrder(orderId: string, companyId: string): Promise<Order | null>;
  getAttempts(orderId: string): Promise<PaymentAttempt[]>;
  createAttempt(orderId: string, amount: number): Promise<{ id: string; attempt: PaymentAttempt }>;
  updateAttemptWithPreference(attemptId: string, preferenceId: string, initPoint: string, response: any): Promise<void>;
  updateAttemptState(
    attemptId: string,
    state: PaymentState,
    paymentId?: string,
    paymentResponse?: any,
  ): Promise<boolean>;
  getAttemptByExternalReference(externalReference: string): Promise<PaymentAttempt | null>;
  markWebhookReceived(notificationId: string, payload: any, signatureVerified: boolean): Promise<void>;
  wasWebhookProcessed(notificationId: string): Promise<boolean>;
  markWebhookProcessed(notificationId: string): Promise<void>;
  markWebhookFailed(notificationId: string, error: string): Promise<void>;
  getPendingWebhooks(limit?: number): Promise<
    Array<{
      notification_id: string;
      data_id: string;
      action: string;
      type: string;
      payload: any;
      signature_verified: boolean;
      received_at: Date;
    }>
  >;
}

export const PAYMENT_STORE = Symbol('PAYMENT_STORE');
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export class Payments {
  constructor(
    private readonly store: PaymentStore,
    private readonly gateway: PaymentGateway,
  ) {}

  async createPaymentAttempt(
    orderId: string,
    companyId: string,
  ): Promise<{
    attempt_id: string;
    init_point: string;
    expires_at: string;
  }> {
    // 1. Verificar que la orden existe y pertenece a la empresa
    const order = await this.store.getOrder(orderId, companyId);
    rule(order, 'ORDER_NOT_FOUND', 'Pedido no encontrado o no pertenece a tu empresa.');

    // 2. Validar que el pedido puede recibir pagos
    validateOrderForPayment(order);

    // 3. Obtener intentos existentes
    const attempts = await this.store.getAttempts(orderId);
    const activeAttempts = attempts.filter(a => a.state === 'created' || a.state === 'pending').length;

    // 4. Verificar que se puede crear un nuevo intento
    const check = canCreateAttempt(attempts.length, activeAttempts, order.state, order.expires_at);
    rule(check.allowed, 'CANNOT_CREATE_ATTEMPT', check.reason || 'No se puede crear un nuevo intento de pago.');

    // 5. Crear intento en DB (antes de llamar a MP)
    const total = parseFloat(order.total);
    const { id: attemptId } = await this.store.createAttempt(orderId, total);

    // 6. Crear preferencia en Mercado Pago (fuera de transacción)
    try {
      const preference = await this.gateway.createPreference({
        external_reference: attemptId,
        items: [{ title: `Pedido ${orderId.substring(0, 8)}`, quantity: 1, unit_price: total }],
        shipment_cost: 0, // Ya incluido en total
        expires_at: order.expires_at,
      });

      // 7. Actualizar intento con respuesta de MP
      await this.store.updateAttemptWithPreference(
        attemptId,
        preference.preference_id,
        preference.init_point,
        preference.response,
      );

      return {
        attempt_id: attemptId,
        init_point: preference.init_point,
        expires_at: order.expires_at.toISOString(),
      };
    } catch (error) {
      // Si falla la creación de preferencia, el intento queda en 'created' sin preference_id
      // El frontend puede reintentar o se puede implementar recuperación
      throw new PaymentError(
        'GATEWAY_ERROR',
        error instanceof Error ? error.message : 'Error al crear preferencia de pago.',
      );
    }
  }

  async getOrderAttempts(orderId: string, companyId: string): Promise<PaymentAttempt[]> {
    const order = await this.store.getOrder(orderId, companyId);
    rule(order, 'ORDER_NOT_FOUND', 'Pedido no encontrado o no pertenece a tu empresa.');
    return this.store.getAttempts(orderId);
  }

  async processWebhookNotification(params: {
    notificationId: string;
    dataId: string;
    type: string;
    action: string;
    payload: any;
    signatureVerified: boolean;
  }): Promise<void> {
    const { notificationId, dataId, type, signatureVerified, payload } = params;

    // 1. Verificar deduplicación
    const wasProcessed = await this.store.wasWebhookProcessed(notificationId);
    if (wasProcessed) {
      return; // Idempotencia: ya procesado exitosamente
    }

    // 2. Registrar webhook recibido (sin marcar como procesado aún)
    await this.store.markWebhookReceived(notificationId, payload, signatureVerified);

    // 3. Solo procesar notificaciones de pago verificadas
    rule(signatureVerified, 'INVALID_SIGNATURE', 'Firma de webhook inválida.');
    rule(type === 'payment', 'UNSUPPORTED_TYPE', 'Solo se procesan notificaciones de pago.');

    // 4. Consultar el pago a Mercado Pago (fuente de verdad)
    const paymentInfo = await this.gateway.getPaymentInfo(dataId);

    // 5. Buscar el intento asociado por external_reference
    const externalRef = paymentInfo.external_reference;
    rule(externalRef, 'MISSING_REFERENCE', 'El pago no tiene external_reference.');

    const attempt = await this.store.getAttemptByExternalReference(externalRef);
    rule(attempt, 'ATTEMPT_NOT_FOUND', `Intento ${externalRef} no encontrado.`);

    // 6. Obtener la orden para validar monto
    const order = await this.store.getOrder(attempt.order_id, ''); // Sin filtro de empresa (webhook es global)
    rule(order, 'ORDER_NOT_FOUND', `Pedido ${attempt.order_id} no encontrado.`);

    // 7. Validar moneda y monto
    validateCurrency(paymentInfo.currency_id);
    validateAmount(paymentInfo.transaction_amount, parseFloat(order.total));

    // 8. Mapear estado de MP a nuestro estado
    const newState = this.mapMercadoPagoStatus(paymentInfo.status, order.expires_at);

    // 9. Validar transición de estado
    rule(
      canTransitionTo(attempt.state, newState),
      'INVALID_TRANSITION',
      `Transición inválida de "${attempt.state}" a "${newState}".`,
    );

    // 10. Actualizar estado del intento
    await this.store.updateAttemptState(attempt.id, newState, paymentInfo.id, paymentInfo);

    // 11. Marcar webhook como procesado exitosamente
    await this.store.markWebhookProcessed(notificationId);
  }

  async retryPendingWebhooks(): Promise<{ processed: number; failed: number }> {
    const pending = await this.store.getPendingWebhooks(50);
    let processed = 0;
    let failed = 0;

    for (const webhook of pending) {
      try {
        await this.processWebhookNotification({
          notificationId: webhook.notification_id,
          dataId: webhook.data_id,
          type: webhook.type,
          action: webhook.action,
          payload: webhook.payload,
          signatureVerified: webhook.signature_verified,
        });
        processed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        await this.store.markWebhookFailed(webhook.notification_id, errorMsg);
        failed++;
        console.error(`[Webhook Recovery] Failed to process ${webhook.notification_id}:`, errorMsg);
      }
    }

    return { processed, failed };
  }

  private mapMercadoPagoStatus(mpStatus: string, orderExpiresAt: Date): PaymentState {
    const now = new Date();
    const expired = now > orderExpiresAt;

    switch (mpStatus) {
      case 'approved':
        return expired ? 'approved_late' : 'approved';
      case 'pending':
      case 'in_process':
      case 'in_mediation':
        return 'pending';
      case 'rejected':
      case 'cancelled':
        return 'rejected';
      case 'refunded':
      case 'charged_back':
        return 'refunded';
      default:
        throw new PaymentError('UNKNOWN_STATUS', `Estado MP desconocido: ${mpStatus}`);
    }
  }
}
