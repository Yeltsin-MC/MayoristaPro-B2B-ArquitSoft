const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const { setTimeout: delay } = require('node:timers/promises');
const { createClient } = require('redis');
const { tradeFixture } = require('./trade-fixture.cjs');
const { CachedProducts } = require('../apps/api/dist/catalog/infrastructure/cached-products');
const { PostgresProducts } = require('../apps/api/dist/catalog/infrastructure/postgres-products');
const { RedisCatalogCache } = require('../apps/api/dist/catalog/infrastructure/redis-catalog-cache');

async function main() {
  assert.ok(process.env.REDIS_URL, 'Configura REDIS_URL con Redis de prueba disponible.');
  const f = await tradeFixture();
  const redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', () => {});
  try {
    await redis.connect();
    const cache = f.app.get(RedisCatalogCache);
    for (let n = 0; !cache.available && n < 200; n++) await delay(10);
    assert.equal(cache.available, true);
    const source = f.app.get(PostgresProducts);
    const reader = f.app.get(CachedProducts);
    await f.db.query(`INSERT INTO products(supplier_id,sku,name,category,unit,units_per_pack,minimum,multiple,stock,price,includes_tax,published)
      SELECT $1,'BENCH-'||n,'Cuaderno benchmark '||n,'Papeleria','caja',12,2,1,20,10+(n%70),true,true
      FROM generate_series(1,1000) n`, [f.accounts.vendor.supplier]);
    const filters = { search: 'benchmark', category: 'Papeleria', available: true, sort: 'price-asc' };
    const parameters = [0, 100, 'benchmark', 'Papeleria', '', true, 'price-asc'];
    const key = reader.key(await source.revision(), 'products', parameters);
    const bypass = { available: false, get: async () => null, set: async () => {} };
    const uncached = new CachedProducts(source, bypass, reader.namespace, 30);
    const expected = JSON.stringify(await uncached.listPublished(0, 100, filters));
    assert.equal(JSON.parse(expected).length, 100);
    const samples = 30;
    async function measure(target, cold = false) {
      const before = { ...target.stats };
      const times = [];
      for (let n = 0; n < samples; n++) {
        if (cold) await redis.del(key);
        const start = performance.now();
        const result = await target.listPublished(0, 100, filters);
        times.push(performance.now() - start);
        assert.equal(JSON.stringify(result), expected, 'Todas las fases deben consultar los mismos datos');
      }
      times.sort((a, b) => a - b);
      const rounded = value => Number(value.toFixed(3));
      return { samples, meanMs: rounded(times.reduce((a, b) => a + b, 0) / samples),
        p50Ms: rounded(times[Math.ceil(samples * .5) - 1]), p95Ms: rounded(times[Math.ceil(samples * .95) - 1]),
        minMs: rounded(times[0]), maxMs: rounded(times.at(-1)),
        counters: Object.fromEntries(Object.keys(before).map(key => [key, target.stats[key] - before[key]])) };
    }
    for (let n = 0; n < 5; n++) await uncached.listPublished(0, 100, filters);
    const postgresOnly = await measure(uncached);
    const cold = await measure(reader, true);
    await reader.listPublished(0, 100, filters);
    const warm = await measure(reader);
    assert.equal(warm.counters.sourceReads, 0);
    assert.equal(warm.counters.hits, samples);
    assert.equal(cold.counters.sourceReads, samples);
    const info = await redis.info('server');
    const result = {
      generatedAt: new Date().toISOString(), node: process.version,
      postgres: (await f.db.query('SHOW server_version')).rows[0].server_version,
      redis: info.match(/redis_version:([^\r\n]+)/)?.[1],
      scope: 'Aplicacion secuencial, esquema sintetico aislado, sin HTTP. Diferente del ensayo k6.',
      dataset: { seededProducts: 1000, returnedProducts: 100,
        responseSha256: createHash('sha256').update(expected).digest('hex') },
      query: { page: 1, limit: 100, ...filters }, ttlSeconds: 30,
      postgresOnly, cold, warm,
    };
    await mkdir('docs/evidencias/redis-catalogo', { recursive: true });
    await writeFile('docs/evidencias/redis-catalogo/medicion.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    try {
      const keys = await redis.keys(f.app.get(CachedProducts).namespace + ':*');
      if (keys.length) await redis.unlink(keys);
    } finally {
      if (redis.isOpen) redis.destroy();
      await f.close();
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
