const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');
const { CachedProducts, catalogNamespace } = require('../apps/api/dist/catalog/infrastructure/cached-products');
const { RedisCatalogCache } = require('../apps/api/dist/catalog/infrastructure/redis-catalog-cache');

function fixture() {
  let revision = '0';
  let stock = 20;
  const entries = new Map();
  const source = { revision: async () => revision,
    listPublished: async () => [{ stock }], options: async () => ({ categories: [], suppliers: [] }) };
  const cache = { available: true, get: async key => entries.get(key) ?? null,
    set: async (key, value) => { entries.set(key, value); } };
  return { source, cache, entries, reader: new CachedProducts(source, cache, 'test', 30),
    change() { revision = String(Number(revision) + 1); stock = 5; } };
}
function barrier() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

test('RC01/02: miss, hit y claves canonicas por todos los parametros y ruta', async () => {
  const f = fixture();
  await f.reader.listPublished(0, 12, { search: '  Cuaderno ' });
  await f.reader.listPublished(0, 12, { search: 'Cuaderno' });
  assert.equal(f.reader.stats.hits, 1);
  assert.equal(f.reader.stats.sourceReads, 1);
  const variants = [{ search: 'Otro' }, { category: 'Papeleria' }, { supplier: 'A' },
    { available: false }, { available: true }, { sort: 'price-asc' }, { sort: 'price-desc' }];
  for (const filter of variants) await f.reader.listPublished(0, 12, filter);
  await f.reader.listPublished(12, 12);
  await f.reader.listPublished(0, 24);
  await f.reader.options();
  assert.equal(f.entries.size, 11);
  assert.equal(catalogNamespace('postgres://u:secret1@localhost/db'), catalogNamespace('postgres://u:secret2@localhost/db'));
  assert.notEqual(catalogNamespace('postgres://u@localhost/db?options=-c%20search_path%3Da'),
    catalogNamespace('postgres://u@localhost/db?options=-c%20search_path%3Db'));
});

test('RC05: un miss anterior al commit no rellena la revision vigente', async () => {
  const f = fixture();
  const started = barrier(), finish = barrier();
  f.source.listPublished = async () => { started.release(); await finish.promise; return [{ stock: 20 }]; };
  const pending = f.reader.listPublished(0, 12);
  await started.promise;
  f.change(); finish.release();
  await pending;
  assert.equal(f.entries.size, 0);
  f.source.listPublished = async () => [{ stock: 5 }];
  assert.equal((await f.reader.listPublished(0, 12))[0].stock, 5);
});

test('RC05: un SET retrasado despues del commit solo escribe la clave anterior', async () => {
  const f = fixture();
  const started = barrier(), finish = barrier();
  f.cache.set = async (key, value) => { started.release(); await finish.promise; f.entries.set(key, value); };
  const pending = f.reader.listPublished(0, 12);
  await started.promise;
  f.change(); finish.release(); await pending;
  assert.ok([...f.entries.keys()].every(key => key.startsWith('test:0:')));
  f.cache.set = async (key, value) => { f.entries.set(key, value); };
  assert.equal((await f.reader.listPublished(0, 12))[0].stock, 5);
});

test('RC05: un hit que cruza un commit consulta el dato vigente', async () => {
  const f = fixture();
  await f.reader.listPublished(0, 12);
  f.cache.get = async key => { const value = f.entries.get(key); f.change(); return value; };
  assert.equal((await f.reader.listPublished(0, 12))[0].stock, 5);
  assert.equal(f.reader.stats.hits, 0);
});

test('RC06: caida, errores de cache, JSON corrupto y fallo de version conservan PostgreSQL', async () => {
  for (const mode of ['disabled', 'get', 'set', 'json', 'revision']) {
    const f = fixture();
    if (mode === 'disabled') f.cache.available = false;
    if (mode === 'get') f.cache.get = async () => { throw new Error('offline'); };
    if (mode === 'set') f.cache.set = async () => { throw new Error('offline'); };
    if (mode === 'json') f.cache.get = async () => 'invalid-json';
    if (mode === 'revision') f.source.revision = async () => { throw new Error('unavailable'); };
    assert.equal((await f.reader.listPublished(0, 12))[0].stock, 20, mode);
    assert.equal(f.reader.stats.sourceReads, 1, mode);
  }
  const f = fixture();
  f.source.listPublished = async () => { throw new Error('PostgreSQL error'); };
  await assert.rejects(f.reader.listPublished(0, 12), /PostgreSQL error/);
  assert.equal(f.reader.stats.sourceReads, 1);
});

test('RC06: cliente Redis real tiene deadline de comando y fallback ante socket lento', async () => {
  const sockets = new Set();
  const server = createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('data', buffer => {
      const text = buffer.toString();
      if (text.includes('$3\r\nGET\r\n')) return;
      const count = (text.match(/\*\d+\r\n/g) ?? []).length;
      socket.write('+OK\r\n'.repeat(count));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const cache = new RedisCatalogCache(`redis://127.0.0.1:${server.address().port}`, 30);
  try {
    for (let n = 0; !cache.available && n < 100; n++) await delay(10);
    assert.equal(cache.available, true, 'El servidor RESP controlado debe completar el handshake');
    const f = fixture();
    const reader = new CachedProducts(f.source, cache, 'timeout', 30);
    const start = performance.now();
    assert.equal((await reader.listPublished(0, 12))[0].stock, 20);
    assert.ok(performance.now() - start < 1000, 'El timeout debe acotar la espera');
    assert.equal(reader.stats.bypasses, 1);
  } finally {
    cache.onModuleDestroy();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
