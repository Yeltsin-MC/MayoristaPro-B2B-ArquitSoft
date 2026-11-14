const { test } = require('node:test');
const assert = require('node:assert/strict');
const { priceTiers, unitPriceFor } = require('../apps/api/dist/trade/domain/price-tiers');

const product = { price: '48.00', minimum: 2, multiple: 2 };

test('Escalas válidas: se ordenan por cantidad y normalizan el precio', () => {
  assert.deepEqual(
    priceTiers({ escalas: [{ desde: 20, precioUnitario: '42' }, { desde: 10, precioUnitario: '45.50' }] }, product),
    [
      { desde: 10, precioUnitario: '45.50' },
      { desde: 20, precioUnitario: '42.00' },
    ],
  );
  assert.deepEqual(priceTiers({ escalas: [] }, product), []);
});

test('Escalas inválidas se rechazan con INVALID_INPUT', () => {
  const invalid = [
    {}, // sin lista
    { escalas: new Array(6).fill({ desde: 10, precioUnitario: '40.00' }) }, // más de 5
    { escalas: [{ desde: 2, precioUnitario: '40.00' }] }, // no supera el mínimo
    { escalas: [{ desde: 11, precioUnitario: '40.00' }] }, // no es múltiplo
    { escalas: [{ desde: 10, precioUnitario: '48.00' }] }, // no mejora el precio base
    { escalas: [{ desde: 10, precioUnitario: '40.00' }, { desde: 20, precioUnitario: '41.00' }] }, // precio sube
    { escalas: [{ desde: 10, precioUnitario: '40.00' }, { desde: 10, precioUnitario: '39.00' }] }, // cantidad repetida
    { escalas: [{ desde: 10, precioUnitario: '40.005' }] }, // más de 2 decimales
  ];
  for (const body of invalid) assert.throws(() => priceTiers(body, product), { code: 'INVALID_INPUT' });
});

test('Precio por cantidad: escala más alta alcanzada y nunca sobre el precio base', () => {
  const tiers = [
    { desde: 10, precioUnitario: '45.00' },
    { desde: 20, precioUnitario: '42.00' },
  ];
  assert.equal(unitPriceFor('48.00', tiers, 2), '48.00');
  assert.equal(unitPriceFor('48.00', tiers, 10), '45.00');
  assert.equal(unitPriceFor('48.00', tiers, 19), '45.00');
  assert.equal(unitPriceFor('48.00', tiers, 50), '42.00');
  // El proveedor bajó el precio base por debajo de la primera escala.
  assert.equal(unitPriceFor('44.00', tiers, 10), '44.00');
  assert.equal(unitPriceFor('44.00', tiers, 20), '42.00');
});
