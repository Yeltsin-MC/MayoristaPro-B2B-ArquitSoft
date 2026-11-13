const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertAcceptable, assertCoversRequest, conditions, offerLines, reservationQuantities,
} = require('../apps/api/dist/trade/domain/trade');

const SUPPLIER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const product = (over = {}) => ({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sku: 'A4-500', name: 'Papel A4', unit: 'Paquete',
  units_per_pack: 500, minimum: 10, multiple: 5, published: true, supplier_id: SUPPLIER, stock: 100, ...over,
});
const asked = [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', unit: 'paquete', units_per_pack: 500, quantity: 20 }];
const item = (over = {}) => ({
  solicitudItemId: asked[0].id, productoId: product().id, cantidad: 20, precioUnitario: '12.50', ...over,
});
const code = expected => error => error.code === expected;

test('la oferta debe cubrir todos los ítems de la solicitud', () => {
  assert.throws(() => assertCoversRequest(asked, []), code('INVALID_INPUT'));
  assert.doesNotThrow(() => assertCoversRequest(asked, [item()]));
});

test('offerLines guarda snapshot y subtotal exacto', () => {
  const [line] = offerLines(asked, [item()], [product()]);
  assert.equal(line.subtotal, '250.00');
  assert.deepEqual(line.snapshot, conditions(product()));
});

test('offerLines rechaza producto ajeno, presentación distinta, mínimo/múltiplo y falta de stock', () => {
  assert.throws(() => offerLines(asked, [item()], []), code('INVALID_INPUT'));
  assert.throws(() => offerLines(asked, [item({ cantidad: 25 })], [product()]), code('INVALID_INPUT'));
  assert.throws(() => offerLines(asked, [item()], [product({ units_per_pack: 250 })]), code('INVALID_INPUT'));
  assert.throws(() => offerLines(asked, [item()], [product({ multiple: 3 })]), code('INVALID_INPUT'));
  assert.throws(() => offerLines(asked, [item()], [product({ stock: 19 })]), code('INSUFFICIENT_STOCK'));
});

test('solo se acepta una oferta vigente de un proveedor verificado', () => {
  assert.throws(() => assertAcceptable({ verified: false, valid: true }), code('CONDITIONS_CHANGED'));
  assert.throws(() => assertAcceptable({ verified: true, valid: false }), code('OFFER_EXPIRED'));
  assert.doesNotThrow(() => assertAcceptable({ verified: true, valid: true }));
});

test('reservationQuantities suma líneas por producto y evita sobreventa', () => {
  const snapshot = conditions(product());
  const lines = [
    { product_id: product().id, quantity: 10, snapshot },
    { product_id: product().id, quantity: 15, snapshot },
  ];
  assert.equal(reservationQuantities(lines, [product()], SUPPLIER).get(product().id), 25);
  assert.throws(() => reservationQuantities(lines, [product({ stock: 24 })], SUPPLIER), code('INSUFFICIENT_STOCK'));
  assert.throws(() => reservationQuantities(lines, [product()], 'otro-proveedor'), code('CONDITIONS_CHANGED'));
  assert.throws(() => reservationQuantities(lines, [product({ minimum: 20 })], SUPPLIER), code('CONDITIONS_CHANGED'));
});
