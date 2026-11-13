const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { createClient } = require('redis');
const { createServer } = require('node:net');
const { tradeFixture } = require('./trade-fixture.cjs');
const { CachedProducts } = require('../apps/api/dist/catalog/infrastructure/cached-products');
const { PostgresProducts } = require('../apps/api/dist/catalog/infrastructure/postgres-products');
const { RedisCatalogCache } = require('../apps/api/dist/catalog/infrastructure/redis-catalog-cache');
const { expireOrders } = require('../apps/api/src/workers/expire-orders.cjs');

async function waitReady(cache) {
  for (let n = 0; !cache.available && n < 200; n++) await delay(10);
  assert.equal(cache.available, true, 'Redis debe estar listo');
}

test('Redis/PostgreSQL: cache publica e invalidacion confirmada', { skip: !process.env.REDIS_URL, timeout: 60000 }, async t => {
  const f = await tradeFixture();
  const redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', () => {});
  let down;
  try {
    await redis.connect();
    const cache = f.app.get(RedisCatalogCache);
    const reader = f.app.get(CachedProducts);
    const source = f.app.get(PostgresProducts);
    await waitReady(cache);
    const filters = { supplier: f.accounts.vendor.supplier };
    const own = () => reader.listPublished(0, 100, filters);
    const revision = () => source.revision();
    const ok = (result, status = 201) => {
      assert.equal(result.status, status, JSON.stringify(result.body)); return result.body;
    };

    await t.test('RC01/02: HTTP miss/hit, TTL real y aislamiento de pagina, filtros, ruta y esquema', async () => {
      const url = 'products?supplier=' + filters.supplier;
      ok(await f.call(url, 'GET', undefined, null), 200);
      const before = reader.stats.sourceReads;
      ok(await f.call(url, 'GET', undefined, null), 200);
      assert.equal(reader.stats.sourceReads, before);
      assert.equal(reader.stats.hits, 1);
      await reader.options(); await reader.options();
      assert.equal(reader.stats.hits, 2);
      const short = new CachedProducts(source, cache, reader.namespace + ':ttl', 1);
      await short.listPublished(0, 100, filters);
      const keys = await redis.keys(short.namespace + ':*');
      assert.equal(keys.length, 1);
      assert.ok((await redis.ttl(keys[0])) <= 1);
      await delay(1100);
      await short.listPublished(0, 100, filters);
      assert.equal(short.stats.sourceReads, 2);
      assert.equal(short.stats.hits, 0);
      const other = new CachedProducts(source, cache, reader.namespace + ':other', 30);
      await other.listPublished(0, 100, filters);
      assert.equal(other.stats.hits, 0);
      for (const variant of [{ search: 'Cuaderno' }, { category: 'General' }, { available: false },
        { sort: 'price-asc' }, { sort: 'price-desc' }]) {
        await reader.listPublished(0, 100, { ...filters, ...variant });
      }
      await reader.listPublished(100, 100, filters);
      await reader.listPublished(0, 1, filters);
      assert.ok((await redis.keys(reader.namespace + ':*')).length >= 10);
    });

    await t.test('RC03: publicar e importar invalidan los datos visibles', async () => {
      await f.db.query('UPDATE products SET published=false WHERE id=$1', [f.products.vendor.id]);
      assert.equal((await own()).length, 0);
      ok(await f.call('products/' + f.products.vendor.id + '/publish', 'POST', undefined, 'vendor'));
      assert.equal((await own()).length, 1);
      const csv = 'sku,nombre,categoria,presentacion,unidades_por_presentacion,precio,moneda,incluye_igv,minimo,multiplo,stock,publicado\r\n' +
        'CAJA,Cuaderno Redis actualizado,Papeleria,caja,12,55.00,PEN,true,2,1,999,true\r\n';
      const form = new FormData(); form.append('file', new Blob([csv]), 'redis.csv');
      const preview = await fetch(f.base + 'products/imports/preview', {
        method: 'POST', headers: { Authorization: 'Bearer ' + f.accounts.vendor.token }, body: form,
      });
      assert.equal(preview.status, 201);
      const batch = await preview.json();
      assert.equal(batch.status, 'preview');
      const before = await revision();
      ok(await f.call('products/imports/' + batch.id + '/confirm', 'POST', { previewHash: batch.previewHash },
        'vendor', { 'Idempotency-Key': 'redis-import-' + batch.id }));
      assert.notEqual(await revision(), before);
      const updated = (await own())[0];
      assert.equal(updated.price, '55.00'); assert.equal(updated.stock, 20);
      assert.equal(updated.name, 'Cuaderno Redis actualizado');
    });

    await t.test('RC03: proveedor oculto y empresa deshabilitada invalidan lista y opciones', async () => {
      await reader.options(); await own();
      await f.db.query('UPDATE suppliers SET verified=false WHERE id=$1', [filters.supplier]);
      assert.equal((await own()).length, 0);
      assert.ok(!(await reader.options()).suppliers.some(item => item.id === filters.supplier));
      await f.db.query('UPDATE suppliers SET verified=true WHERE id=$1', [filters.supplier]);
      assert.equal((await own()).length, 1);
      await f.db.query("UPDATE companies SET status='pending' WHERE id=$1", [f.accounts.vendor.company]);
      assert.equal((await own())[0].quoteEnabled, false);
      await f.db.query("UPDATE companies SET status='enabled' WHERE id=$1", [f.accounts.vendor.company]);
      assert.equal((await own())[0].quoteEnabled, true);
    });

    await t.test('RC05: revision diferida al commit, una por transaccion y rollback', async () => {
      const before = await revision();
      await own();
      const db = await f.db.connect();
      try {
        await db.query('BEGIN');
        await db.query('UPDATE products SET stock=19 WHERE id=$1', [f.products.vendor.id]);
        await db.query('UPDATE suppliers SET name=name WHERE id=$1', [filters.supplier]);
        assert.equal((await db.query('SELECT revision::text FROM catalog_cache_revision')).rows[0].revision, before);
        assert.equal((await own())[0].stock, 20);
        await db.query('COMMIT');
        assert.equal(BigInt(await revision()), BigInt(before) + 1n);
        assert.equal((await own())[0].stock, 19);
        const committed = await revision();
        await db.query('BEGIN');
        await db.query('UPDATE products SET stock=4 WHERE id=$1', [f.products.vendor.id]);
        await db.query('ROLLBACK');
        assert.equal(await revision(), committed);
        assert.equal((await own())[0].stock, 19);
      } finally { await db.query('ROLLBACK'); db.release(); }
      await f.db.query('UPDATE products SET stock=20 WHERE id=$1', [f.products.vendor.id]);
    });

    let quotation, order;
    await t.test('RC04/07: las operaciones privadas no se cachean; reservar y vencer devuelven stock vigente', async () => {
      await own();
      const privateVersion = await revision();
      const beforeKeys = (await redis.keys(reader.namespace + ':' + privateVersion + ':*')).sort();
      quotation = ok(await f.request('buyer', 2, ['vendor']));
      const response = ok(await f.offer(quotation));
      ok(await f.accept(quotation, response.offers[0].id), 200);
      ok(await f.call('quotations/' + quotation.id), 200);
      assert.deepEqual((await redis.keys(reader.namespace + ':' + privateVersion + ':*')).sort(), beforeKeys);
      const before = await revision();
      order = ok(await f.order(response.offers[0].id));
      assert.notEqual(await revision(), before);
      assert.equal((await own())[0].stock, 18);
      ok(await f.order(response.offers[0].id));
      assert.equal((await own())[0].stock, 18);
      await f.db.query("UPDATE trade_orders SET expires_at=now()-interval '1 minute' WHERE id=$1", [order.id]);
      const reserved = await revision();
      await expireOrders();
      assert.notEqual(await revision(), reserved);
      assert.equal((await own())[0].stock, 20);
      await expireOrders();
      assert.equal((await own())[0].stock, 20);
      for (const key of await redis.keys(reader.namespace + ':*')) {
        const value = await redis.get(key);
        assert.ok(!value.includes(quotation.id) && !value.includes(order.id));
        assert.ok(!value.includes(f.accounts.buyer.token) && !value.includes(f.accounts.buyer.email));
      }
    });

    await t.test('RC06: Redis caido durante la escritura conserva invalidacion al recuperar', async () => {
      await own();
      const oldVersion = await revision();
      const oldKeys = await redis.keys(reader.namespace + ':' + oldVersion + ':products:*');
      assert.ok(oldKeys.length > 0);
      const reservation = createServer();
      await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
      const closedPort = reservation.address().port;
      await new Promise(resolve => reservation.close(resolve));
      down = new RedisCatalogCache('redis://127.0.0.1:' + closedPort, 30);
      const fallback = new CachedProducts(source, down, reader.namespace, 30);
      await f.db.query('UPDATE products SET stock=17 WHERE id=$1', [f.products.vendor.id]);
      const start = performance.now();
      assert.equal((await fallback.listPublished(0, 100, filters))[0].stock, 17);
      assert.ok(performance.now() - start < 1000);
      assert.equal((await own())[0].stock, 17);
      assert.ok((await redis.get(oldKeys[0])).includes('"stock":20'));
    });
  } finally {
    if (down) down.onModuleDestroy();
    try {
      const namespace = f.app.get(CachedProducts).namespace;
      const keys = await redis.keys(namespace + ':*');
      if (keys.length) await redis.unlink(keys);
    } finally {
      if (redis.isOpen) redis.destroy();
      await f.close();
    }
  }
});
