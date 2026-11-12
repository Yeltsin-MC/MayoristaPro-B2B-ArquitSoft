// Domain: Payment rules and validation (no external dependencies)

export class PaymentError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export function rule(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new PaymentError(code, message);
}

export function validateCurrency(currency: unknown): void {
  rule(currency === 'PEN', 'INVALID_CURRENCY', 'Solo se aceptan pagos en PEN (Soles Peruanos).');
}

export function validateAmount(amount: unknown, expected: number): void {
  rule(typeof amount === 'number' && amount > 0, 'INVALID_AMOUNT', 'El monto debe ser un número positivo.');
  const diff = Math.abs(amount - expected);
  rule(diff < 0.01, 'AMOUNT_MISMATCH', `El monto no coincide. Esperado: ${expected}, recibido: ${amount}.`);
}

export function validateOrderForPayment(order: {
  state: string;
  expires_at: Date;
}): void {
  rule(order.state === 'pendiente', 'ORDER_NOT_PENDING', `El pedido está en estado "${order.state}" y no puede recibir pagos.`);
  rule(new Date(order.expires_at) > new Date(), 'ORDER_EXPIRED', 'El pedido ha vencido. Crea una nueva solicitud de cotización.');
}

export function canCreateAttempt(
  attemptCount: number,
  activeAttempts: number,
  orderState: string,
  expiresAt: Date
): { allowed: boolean; reason?: string } {
  if (orderState !== 'pendiente') {
    return { allowed: false, reason: `El pedido está en estado "${orderState}".` };
  }
  if (new Date(expiresAt) < new Date()) {
    return { allowed: false, reason: 'El pedido ha vencido.' };
  }
  if (attemptCount >= 3) {
    return { allowed: false, reason: 'Se alcanzó el máximo de 3 intentos de pago.' };
  }
  if (activeAttempts > 0) {
    return { allowed: false, reason: 'Ya existe un intento de pago activo.' };
  }
  return { allowed: true };
}

// Payment attempt states from migration
export type PaymentState = 
  | 'created'       // Creado, esperando respuesta MP
  | 'pending'       // MP respondió, pago pendiente
  | 'approved'      // Aprobado a tiempo
  | 'approved_late' // Aprobado después de expiración
  | 'rejected'      // Rechazado por MP
  | 'cancelled'     // Cancelado por usuario
  | 'refunded';     // Reembolsado (futuro)

export function isActiveState(state: PaymentState): boolean {
  return state === 'created' || state === 'pending';
}

export function isTerminalState(state: PaymentState): boolean {
  return state === 'approved' || state === 'approved_late' || state === 'rejected' || state === 'cancelled' || state === 'refunded';
}

export function canTransitionTo(from: PaymentState, to: PaymentState): boolean {
  // Transiciones válidas según documentación MP y lógica de negocio
  const transitions: Record<PaymentState, PaymentState[]> = {
    created: ['pending', 'rejected', 'cancelled'],
    pending: ['approved', 'approved_late', 'rejected', 'cancelled'],
    approved: ['refunded'], // Solo puede reembolsarse un pago aprobado
    approved_late: ['refunded'],
    rejected: [], // Terminal
    cancelled: [], // Terminal
    refunded: [], // Terminal
  };
  return transitions[from]?.includes(to) ?? false;
}
