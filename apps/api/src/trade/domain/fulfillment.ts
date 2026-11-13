import { rule } from './trade';

export type FulfillmentState = 'preparing' | 'dispatched' | 'delivered';
export type FulfillmentRole = 'buyer' | 'supplier';

/**
 * Transiciones de despacho permitidas: desde qué estado se llega y quién la hace.
 * El proveedor prepara y despacha; el comprador confirma la recepción.
 */
const TRANSITIONS: Record<FulfillmentState, { from: string; by: FulfillmentRole }> = {
  preparing: { from: 'paid', by: 'supplier' },
  dispatched: { from: 'preparing', by: 'supplier' },
  delivered: { from: 'dispatched', by: 'buyer' },
};

export interface FulfillmentDraft {
  estado: FulfillmentState;
  nota: string | null;
}

export function fulfillmentDraft(body: any): FulfillmentDraft {
  rule(
    typeof body?.estado === 'string' && Object.hasOwn(TRANSITIONS, body.estado),
    'INVALID_INPUT',
    'Estado de despacho inválido: preparing, dispatched o delivered.',
  );
  const nota = body.nota === undefined || body.nota === null ? '' : body.nota;
  rule(
    typeof nota === 'string' && nota.trim().length <= 300 && !nota.includes('\0'),
    'INVALID_INPUT',
    'Nota de hasta 300 caracteres.',
  );
  return { estado: body.estado, nota: nota.trim() || null };
}

/**
 * Decide si el pedido puede pasar a `target`. Devuelve false si ya está en ese
 * estado (repetir la operación no hace nada) y lanza un error si la transición
 * no corresponde al estado actual o al rol de quien la pide.
 */
export function assertFulfillment(current: string, target: FulfillmentState, roles: FulfillmentRole[]): boolean {
  const transition = TRANSITIONS[target];
  rule(
    roles.includes(transition.by),
    'FORBIDDEN',
    transition.by === 'buyer'
      ? 'Solo el comprador confirma la recepción.'
      : 'Solo el proveedor prepara y despacha el pedido.',
  );
  if (current === target) return false;
  rule(
    current === transition.from,
    'ORDER_STATE_CONFLICT',
    current === 'pendiente' ? 'El pedido aún no está pagado.' : `No se puede pasar de ${current} a ${target}.`,
  );
  return true;
}
