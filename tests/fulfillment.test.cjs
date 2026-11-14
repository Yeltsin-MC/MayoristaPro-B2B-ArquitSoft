const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertFulfillment, fulfillmentDraft } = require('../apps/api/dist/trade/domain/fulfillment');

test('Despacho: transiciones en orden y por el rol correcto', () => {
  assert.equal(assertFulfillment('paid', 'preparing', ['supplier']), true);
  assert.equal(assertFulfillment('preparing', 'dispatched', ['supplier']), true);
  assert.equal(assertFulfillment('dispatched', 'delivered', ['buyer']), true);
  // Repetir el estado actual no es un error, pero no cambia nada.
  assert.equal(assertFulfillment('preparing', 'preparing', ['supplier']), false);
  assert.throws(() => assertFulfillment('pendiente', 'preparing', ['supplier']), { code: 'ORDER_STATE_CONFLICT' });
  assert.throws(() => assertFulfillment('paid', 'dispatched', ['supplier']), { code: 'ORDER_STATE_CONFLICT' });
  assert.throws(() => assertFulfillment('delivered', 'preparing', ['supplier']), { code: 'ORDER_STATE_CONFLICT' });
  assert.throws(() => assertFulfillment('paid', 'preparing', ['buyer']), { code: 'FORBIDDEN' });
  assert.throws(() => assertFulfillment('dispatched', 'delivered', ['supplier']), { code: 'FORBIDDEN' });
});

test('Despacho: validación del cuerpo', () => {
  assert.deepEqual(fulfillmentDraft({ estado: 'dispatched', nota: '  Guía 001  ' }), {
    estado: 'dispatched',
    nota: 'Guía 001',
  });
  assert.deepEqual(fulfillmentDraft({ estado: 'preparing' }), { estado: 'preparing', nota: null });
  for (const body of [{}, { estado: 'paid' }, { estado: 'toString' }, { estado: 'preparing', nota: 'x'.repeat(301) }])
    assert.throws(() => fulfillmentDraft(body), { code: 'INVALID_INPUT' });
});
