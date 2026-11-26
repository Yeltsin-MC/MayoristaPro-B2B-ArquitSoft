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
  /** true cuando no hay credenciales de Mercado Pago y el cobro se simula (demo académica). */
  readonly simulated: boolean;
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

  /** Último pago hecho para un intento (external_reference); null si el comprador aún no pagó. */
  findPaymentByReference?(externalReference: string): Promise<string | null>;
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

  /** Datos de la pantalla «Pago de prueba»: solo en modo simulado y para la empresa compradora. */
  async simulatedCheckout(attemptId: string, companyId: string) {
    const { attempt, order } = await this.simulatedAttempt(attemptId, companyId);
    return {
      attemptId: attempt.id,
      orderId: order.id,
      state: attempt.state,
      orderState: order.state,
      total: order.total,
      shipping: order.shipping,
      expiresAt: order.expires_at,
      medio: attempt.mp_payment_response?.medio ?? null,
      cip: attempt.mp_payment_response?.cip ?? null,
    };
  }

  /**
   * Simula lo que haría Mercado Pago: tarjeta o Yape se aprueban o rechazan al instante;
   * PagoEfectivo primero genera un código CIP (pago pendiente) y luego se «paga en agente».
   * Usa las mismas transiciones que el webhook real (created → pending → approved).
   */
  async simulatePayment(attemptId: string, companyId: string, body: any) {
    const accion = body?.accion;
    const medio = body?.medio;
    rule(['aprobar', 'rechazar', 'generar-cip'].includes(accion), 'INVALID_INPUT', 'Acción inválida.');
    rule(['tarjeta', 'yape', 'pagoefectivo'].includes(medio), 'INVALID_INPUT', 'Medio de pago inválido.');
    rule(accion !== 'generar-cip' || medio === 'pagoefectivo', 'INVALID_INPUT', 'El código CIP es de PagoEfectivo.');
    const { attempt, order } = await this.simulatedAttempt(attemptId, companyId);
    const reference = 'SIM-' + attempt.id.slice(0, 8).toUpperCase();
    const cip = attempt.mp_payment_response?.cip ?? cipFor(attempt.id);
    const detail = (status: string) => ({
      simulated: true,
      medio,
      status,
      ...(medio === 'pagoefectivo' ? { cip } : {}),
    });
    let state: PaymentState = attempt.state;
    if (state === 'created' && accion !== 'rechazar') {
      validateOrderForPayment(order);
      await this.store.updateAttemptState(attempt.id, 'pending', reference, detail('pending'));
      state = 'pending';
    }
    if (accion === 'generar-cip') return { state, orderId: order.id, cip };
    const target: PaymentState =
      accion === 'rechazar' ? 'rejected' : new Date() > new Date(order.expires_at) ? 'approved_late' : 'approved';
    rule(canTransitionTo(state, target), 'INVALID_TRANSITION', 'Este intento de pago ya terminó; inicia uno nuevo.');
    await this.store.updateAttemptState(attempt.id, target, reference, detail(target));
    return { state: target, orderId: order.id, cip: medio === 'pagoefectivo' ? cip : null };
  }

  private async simulatedAttempt(attemptId: string, companyId: string) {
    rule(this.gateway.simulated, 'FORBIDDEN', 'El pago de prueba solo existe cuando Mercado Pago no está configurado.');
    rule(/^[0-9a-f-]{36}$/i.test(attemptId), 'INVALID_INPUT', 'Intento de pago inválido.');
    const attempt = await this.store.getAttemptByExternalReference(attemptId);
    rule(attempt, 'ATTEMPT_NOT_FOUND', 'Intento de pago no encontrado.');
    const order = await this.store.getOrder(attempt.order_id, companyId);
    rule(order, 'ORDER_NOT_FOUND', 'Pedido no encontrado o no pertenece a tu empresa.');
    return { attempt, order };
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

    // 8-10. Mapear el estado de MP, validar la transición y actualizar el intento
    await this.applyPaymentInfo(attempt, order, paymentInfo);

    // 11. Marcar webhook como procesado exitosamente
    await this.store.markWebhookProcessed(notificationId);
  }

  /**
   * Retorno desde Mercado Pago (back_urls): el comprador vuelve con ?payment_id=…&external_reference=….
   * Se consulta el pago a Mercado Pago (fuente de verdad) y se aplica igual que el webhook. Así el pago
   * se confirma también en localhost, donde Mercado Pago no puede enviar webhooks; en AWS es el respaldo.
   */
  async confirmReturn(body: any, companyId: string) {
    rule(!this.gateway.simulated, 'FORBIDDEN', 'Mercado Pago no está configurado: usa el pago de prueba.');
    const attemptId = String(body?.attemptId ?? '');
    rule(/^[0-9a-f-]{36}$/i.test(attemptId), 'INVALID_INPUT', 'Intento de pago inválido.');
    const attempt = await this.store.getAttemptByExternalReference(attemptId);
    rule(attempt, 'ATTEMPT_NOT_FOUND', 'Intento de pago no encontrado.');
    const order = await this.store.getOrder(attempt.order_id, companyId);
    rule(order, 'ORDER_NOT_FOUND', 'Pedido no encontrado o no pertenece a tu empresa.');
    // Sin payment_id (no hubo «Volver al sitio» o se verifica desde el pedido): se busca el pago en Mercado Pago.
    let paymentId = String(body?.paymentId ?? '');
    if (!/^\d{1,20}$/.test(paymentId) && this.gateway.findPaymentByReference) {
      paymentId = (await this.gateway.findPaymentByReference(attempt.id)) ?? '';
    }
    // Sin pago (el comprador canceló o volvió antes de pagar): solo se informa el estado actual.
    if (!/^\d{1,20}$/.test(paymentId)) return { state: attempt.state, orderId: order.id };
    const paymentInfo = await this.gateway.getPaymentInfo(paymentId);
    rule(paymentInfo.external_reference === attempt.id, 'INVALID_INPUT', 'El pago no corresponde a este pedido.');
    validateCurrency(paymentInfo.currency_id);
    validateAmount(paymentInfo.transaction_amount, parseFloat(order.total));
    const state = await this.applyPaymentInfo(attempt, order, paymentInfo);
    return { state, orderId: order.id };
  }

  /** Aplica el estado informado por Mercado Pago; repetir la misma notificación no cambia nada. */
  private async applyPaymentInfo(
    attempt: PaymentAttempt,
    order: Order,
    paymentInfo: { id: string; status: string },
  ): Promise<PaymentState> {
    const newState = this.mapMercadoPagoStatus(paymentInfo.status, order.expires_at);
    if (attempt.state === newState) return newState;
    let current = attempt.state;
    // Mercado Pago puede informar «approved» sin un «pending» previo: se registra el paso intermedio.
    if (current === 'created' && (newState === 'approved' || newState === 'approved_late')) {
      await this.store.updateAttemptState(attempt.id, 'pending', String(paymentInfo.id), paymentInfo);
      current = 'pending';
    }
    rule(
      canTransitionTo(current, newState),
      'INVALID_TRANSITION',
      `Transición inválida de "${current}" a "${newState}".`,
    );
    await this.store.updateAttemptState(attempt.id, newState, String(paymentInfo.id), paymentInfo);
    return newState;
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

/** Código CIP de 8 dígitos, estable para cada intento (PagoEfectivo simulado). */
function cipFor(attemptId: string): string {
  const digits = attemptId.replace(/[^0-9]/g, '') + '73519284';
  return digits.slice(0, 8);
}
