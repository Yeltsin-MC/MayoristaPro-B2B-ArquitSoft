const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tradeFixture } = require('./trade-fixture.cjs');

test('Precios por volumen: API y catálogo', async t => {
  const f = await tradeFixture();
  const { db, products, call } = f;
  const ok = (r, status = 200) => {
    assert.equal(r.status, status, JSON.stringify(r.body));
    return r.body;
  };
  try {
    const product = products.vendor;
    const path = 'trade/products/' + product.id + '/price-tiers';

    await t.test('Precios por volumen: solo el proveedor dueño define escalas válidas', async () => {
      const escalas = [
        { desde: 10, precioUnitario: '45.00' },
        { desde: 5, precioUnitario: '46.50' },
      ];
      assert.equal((await call(path, 'PUT', { escalas }, 'buyer')).status, 403);
      assert.equal((await call(path, 'PUT', { escalas }, 'vendor2')).status, 404);
      assert.equal(
        (await call(path, 'PUT', { escalas: [{ desde: 5, precioUnitario: '50.00' }] }, 'vendor')).status,
        422,
      );
      const saved = ok(await call(path, 'PUT', { escalas }, 'vendor'));
      assert.deepEqual(saved.priceTiers, [
        { desde: 5, precioUnitario: '46.50' },
        { desde: 10, precioUnitario: '45.00' },
      ]);
      const own = ok(await call('trade/products', 'GET', undefined, 'vendor')).find(p => p.id === product.id);
      assert.deepEqual(own.priceTiers, saved.priceTiers);
    });

    await t.test('Precios por volumen: el catálogo público muestra las escalas vigentes', async () => {
      const list = ok(await call('products?limit=100', 'GET', undefined, null)).items;
      const item = list.find(p => p.id === product.id);
      assert.deepEqual(item.priceTiers, [
        { desde: 5, precioUnitario: '46.50' },
        { desde: 10, precioUnitario: '45.00' },
      ]);
      assert.deepEqual(list.find(p => p.id === products.vendor2.id).priceTiers, []);
      // Si el precio base baja, las escalas que ya no mejoran el precio se ocultan.
      await db.query('UPDATE products SET price=46 WHERE id=$1', [product.id]);
      const lowered = ok(await call('products?limit=100', 'GET', undefined, null)).items.find(p => p.id === product.id);
      assert.deepEqual(lowered.priceTiers, [{ desde: 10, precioUnitario: '45.00' }]);
      await db.query('UPDATE products SET price=48 WHERE id=$1', [product.id]);
      ok(await call(path, 'PUT', { escalas: [] }, 'vendor'));
      const cleared = ok(await call('products?limit=100', 'GET', undefined, null)).items.find(p => p.id === product.id);
      assert.deepEqual(cleared.priceTiers, []);
    });

  } finally {
    await f.close();
  }
});
