const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const { loadDemo, demoDatabaseUrl, withDemoApi, apiCall, manifest } = require('../database/demo/load.cjs');
const { comparison } = require('../database/demo/quote.cjs');

test('Demo150: carga real, búsqueda, comparación y recarga que preserva reservas', { timeout: 120000 }, async t => {
  const schema = 'demo_mayoristapro150_test_' + randomBytes(6).toString('hex');
  const config = { source: process.env.DATABASE_URL, schema, adminEmail: 'admin-demo150@example.test',
    adminPassword: randomBytes(24).toString('hex'), demoPassword: randomBytes(24).toString('hex') };
  const databaseUrl = demoDatabaseUrl(config.source, schema);
  const db = new Pool({ connectionString: databaseUrl });
  let reservedProduct;
  try {
    await t.test('quince proveedores aprobados y verificados, 30 productos por proveedor', async () => {
      const result = await loadDemo(config);
      const providers = manifest.providers.length;
      assert.equal(providers, 15);
      assert.equal(result.suppliers, providers); assert.equal(result.products, providers * 30);
      assert.equal(result.categories, providers); assert.equal(result.quotable, providers * 30);
      assert.ok(result.imports.every(p => p.products === 30 && p.created === 30 && p.updated === 0));
      // Dos de cada tres productos llevan precios por volumen de demostración.
      assert.ok(result.imports.every(p => p.tiers === 20));
    });
    await withDemoApi(databaseUrl, async base => {
      await t.test('búsqueda y filtros por categoría recorren el catálogo completo paginado', async () => {
        const options = await apiCall(base, 'products/options');
        assert.equal(options.suppliers.length, manifest.providers.length);
        assert.deepEqual([...options.categories].sort(), manifest.providers.map(p => p.category).sort());
        const matches = (await apiCall(base, 'products?q=Papel%20A4&limit=100')).items;
        assert.equal(matches.length, 2);
        assert.equal(new Set(matches.map(p => p.supplierId)).size, 2);
        for (const provider of manifest.providers) {
          const rows = [];
          for (let page = 1; page <= 3; page++) {
            rows.push(...(await apiCall(base, 'products?category=' + encodeURIComponent(provider.category) + '&limit=12&page=' + page)).items);
          }
          assert.equal(rows.length, 30); assert.equal(new Set(rows.map(p => p.id)).size, 30);
          assert.ok(rows.every(p => p.quoteEnabled));
          assert.equal((await apiCall(base, 'products?category=' + encodeURIComponent(provider.category) + '&limit=12&page=4')).items.length, 0);
        }
      });
      const scenario = await comparison(base, config);
      await t.test('dos ofertas privadas válidas conservan precio final, envío y plazo', async () => {
        assert.equal(scenario.detail.offers.length, 2);
        assert.deepEqual(scenario.detail.offers.map(o => o.total).sort(), ['180.00', '187.80']);
        assert.deepEqual(scenario.detail.offers.map(o => o.deliveryDays).sort(), [2, 5]);
        assert.ok(scenario.detail.offers.every(o => o.items[0].quantity === 2));
      });
      await t.test('una caja incumple el mínimo de Cobre; no se guarda su oferta', async () => {
        const supplier = scenario.suppliers.find(s => s.provider.code === 'cobre');
        const request = await apiCall(base, 'quotations', 'POST', { proveedorIds: [supplier.id],
          items: [{ descripcion: manifest.comparison.description, presentacion: 'caja', unidadesPorPresentacion: 5, cantidad: 1 }] }, scenario.buyerToken);
        await assert.rejects(apiCall(base, 'quotations/' + request.id + '/responses', 'POST', {
          moneda: 'PEN', precioIncluyeIgv: true, costoEnvio: '12.00', diasEntrega: 5,
          vigenteHasta: new Date(Date.now() + 86400000).toISOString(),
          items: [{ solicitudItemId: request.items[0].id, productoId: supplier.product.id, cantidad: 1, precioUnitario: supplier.product.price }],
        }, supplier.token), /422.*mínimo/);
        const detail = await apiCall(base, 'quotations/' + request.id, 'GET', undefined, scenario.buyerToken);
        assert.equal(detail.offers.length, 0);
      });
      await t.test('el pedido del comprador reserva dos cajas mediante el flujo existente', async () => {
        const supplier = scenario.suppliers.find(s => s.provider.code === 'lirio');
        reservedProduct = supplier.product.id;
        const offer = scenario.detail.offers.find(o => o.supplierId === supplier.id);
        assert.ok(offer);
        await apiCall(base, 'quotations/' + scenario.detail.id + '/responses/' + offer.id + '/accept', 'PATCH', undefined, scenario.buyerToken);
        await apiCall(base, 'orders', 'POST', { cotizacionRespuestaId: offer.id }, scenario.buyerToken, { 'Idempotency-Key': 'demo150-stock-proof' });
        assert.equal((await db.query('SELECT stock FROM products WHERE id=$1', [reservedProduct])).rows[0].stock, 22);
      });
    });
    await t.test('repetir las importaciones no duplica productos ni repone el stock reservado', async () => {
      const result = await loadDemo(config);
      assert.equal(result.products, manifest.providers.length * 30);
      assert.ok(result.imports.every(p => p.created === 0 && p.updated === 30));
      assert.equal((await db.query('SELECT stock FROM products WHERE id=$1', [reservedProduct])).rows[0].stock, 22);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM trade_orders')).rows[0].n, 1);
    });
  } finally {
    await db.end();
    const root = new Pool({ connectionString: config.source });
    try {
      assert.match(schema, /^demo_mayoristapro150_test_[a-f0-9]+$/);
      await root.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
    } finally { await root.end(); }
  }
});
