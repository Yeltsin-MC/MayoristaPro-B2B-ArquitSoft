const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { tradeFixture } = require('./trade-fixture.cjs');
const { CachedProducts } = require('../apps/api/dist/catalog/infrastructure/cached-products');
const { PostgresProducts } = require('../apps/api/dist/catalog/infrastructure/postgres-products');
const { RedisCatalogCache } = require('../apps/api/dist/catalog/infrastructure/redis-catalog-cache');

test('RC05/06 PostgreSQL: revision transaccional y lectura sin Redis', async t => {
  const f = await tradeFixture();
  const source = f.app.get(PostgresProducts);
  try {
    await t.test('commits concurrentes de productos distintos avanzan dos revisiones; rollback conserva la revision', async () => {
      const before = BigInt(await source.revision());
      const a = await f.db.connect(), b = await f.db.connect();
      try {
        await a.query('BEGIN'); await b.query('BEGIN');
        await a.query("SET LOCAL lock_timeout='2s'"); await b.query("SET LOCAL lock_timeout='2s'");
        await a.query('UPDATE products SET stock=stock-1 WHERE id=$1', [f.products.vendor.id]);
        await b.query('UPDATE products SET stock=stock-1 WHERE id=$1', [f.products.vendor2.id]);
        assert.equal(BigInt(await source.revision()), before);
        await Promise.all([a.query('COMMIT'), b.query('COMMIT')]);
        assert.equal(BigInt(await source.revision()), before + 2n);
        await a.query('BEGIN');
        await a.query('UPDATE products SET stock=stock-1 WHERE id=$1', [f.products.vendor.id]);
        await a.query('ROLLBACK');
        assert.equal(BigInt(await source.revision()), before + 2n);
      } finally {
        await a.query('ROLLBACK'); await b.query('ROLLBACK'); a.release(); b.release();
      }
    });
    await t.test('miss concurrente con commit PostgreSQL no rellena una revision anterior', async () => {
      let release, started;
      const gate = new Promise(resolve => { release = resolve; });
      const loaded = new Promise(resolve => { started = resolve; });
      const entries = new Map();
      const port = { available: true, get: async key => entries.get(key) ?? null,
        set: async (key, value) => entries.set(key, value) };
      const delayedSource = { revision: () => source.revision(), options: () => source.options(),
        listPublished: async (...args) => { const value = await source.listPublished(...args); started(); await gate; return value; } };
      const reader = new CachedProducts(delayedSource, port, 'pg-race', 30);
      const pending = reader.listPublished(0, 100);
      await loaded;
      await f.db.query('UPDATE products SET stock=8 WHERE id=$1', [f.products.vendor.id]);
      release(); await pending;
      assert.equal(entries.size, 0);
    });
    await t.test('un esquema anterior a la migracion no toma la revision de otro esquema', async () => {
      const schema = (await f.db.query('SELECT current_schema() AS name')).rows[0].name;
      assert.match(schema, /^t4_[0-9a-f]+$/);
      const legacy = schema + '_legacy';
      await f.db.query(`CREATE SCHEMA ${legacy}`);
      let oldSource;
      try {
        await f.db.query(`CREATE TABLE ${legacy}.products(id uuid)`);
        const url = new URL(process.env.DATABASE_URL);
        url.searchParams.set('options', `-c search_path=${legacy},${schema},public`);
        oldSource = new PostgresProducts(url.toString());
        await assert.rejects(oldSource.revision(), /Falta la revisión/);
      } finally {
        if (oldSource) await oldSource.onModuleDestroy();
        await f.db.query(`DROP SCHEMA ${legacy} CASCADE`);
      }
    });
    await t.test('adaptador Redis en puerto cerrado mantiene la lectura PostgreSQL', async () => {
      const server = createServer();
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      await new Promise(resolve => server.close(resolve));
      const cache = new RedisCatalogCache('redis://127.0.0.1:' + port, 30);
      try {
        const reader = new CachedProducts(source, cache, 'down', 30);
        const start = performance.now();
        const products = await reader.listPublished(0, 100, { supplier: f.accounts.vendor.supplier });
        assert.equal(products[0].stock, 8);
        assert.equal(reader.stats.bypasses, 1);
        assert.ok(performance.now() - start < 1000);
      } finally { cache.onModuleDestroy(); }
    });
  } finally { await f.close(); }
});
