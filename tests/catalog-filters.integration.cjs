const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tradeFixture } = require('./trade-fixture.cjs');

test('Catalogo: filtros publicos, busqueda y orden con PostgreSQL', async t => {
  const f = await tradeFixture();
  try {
    await f.db.query("UPDATE products SET category='Papeleria' WHERE id=$1", [f.products.vendor.id]);
    await f.db.query("UPDATE products SET category='Embalaje',stock=0 WHERE id=$1", [f.products.vendor2.id]);
    await f.db.query(`INSERT INTO products(supplier_id,sku,name,unit,units_per_pack,minimum,multiple,stock,price,includes_tax,published)
      VALUES($1,'PENDING','Producto pendiente','caja',12,2,1,10,10,true,true),
            ($2,'DRAFT','Producto borrador','caja',12,2,1,10,10,true,false)`,
      [f.accounts.pending.supplier, f.accounts.vendor.supplier]);
    const read = async path => {
      const result = await f.call(path, 'GET', undefined, null);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      return result.body;
    };
    await t.test('opciones incluyen solo productos publicados de proveedores verificados', async () => {
      const options = await read('products/options');
      assert.ok(options.categories.includes('Papeleria'));
      assert.ok(options.categories.includes('Embalaje'));
      assert.ok(options.suppliers.some(s => s.id === f.accounts.vendor.supplier));
      assert.ok(!options.suppliers.some(s => s.id === f.accounts.pending.supplier));
      const items = (await read('products?limit=100')).items;
      assert.ok(!items.some(item => /pendiente|borrador/.test(item.name)));
      assert.ok(items.every(item => typeof item.supplierId === 'string'));
      assert.equal(items.find(item => item.id === f.products.vendor.id).quoteEnabled, true);
      assert.equal(items.find(item => item.name === 'Cuaderno A4').quoteEnabled, false);
    });
    await t.test('busqueda literal, categoria y proveedor filtran antes de paginar', async () => {
      const result = await read('products?q=VENDOR2&limit=1');
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].id, f.products.vendor2.id);
      const supplier = await read('products?supplier=' + f.accounts.vendor.supplier);
      assert.deepEqual(supplier.items.map(item => item.id), [f.products.vendor.id]);
      const category = await read('products?category=Embalaje');
      assert.deepEqual(category.items.map(item => item.id), [f.products.vendor2.id]);
      assert.deepEqual((await read('products?q=%25')).items, []);
      assert.deepEqual((await read('products?q=' + encodeURIComponent("' OR 1=1 --"))).items, []);
    });
    await t.test('disponibilidad y precios usan datos persistidos', async () => {
      assert.deepEqual((await read('products?category=Embalaje&available=true')).items, []);
      assert.equal((await read('products?category=Embalaje&available=false')).items[0].stock, 0);
      for (const sort of ['price-asc', 'price-desc']) {
        const prices = (await read('products?limit=100&sort=' + sort)).items.map(item => Number(item.price));
        assert.deepEqual(prices, [...prices].sort((a, b) => sort === 'price-asc' ? a - b : b - a));
      }
    });
    await t.test('filtros invalidos y paginacion conservan respuestas 400', async () => {
      for (const query of ['supplier=invalido', 'available=si', 'sort=sql', 'q=a&q=b', 'limit=101', 'page=0']) {
        assert.equal((await f.call('products?' + query, 'GET', undefined, null)).status, 400, query);
      }
      assert.equal((await read('products?limit=1')).items.length, 1);
    });
  } finally {
    await f.close();
  }
});
