const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdir, writeFile } = require('node:fs/promises');

const composeArgs = ['compose', '--env-file', process.env.DEMO_ENV_FILE || '.env.demo.example',
  '-f', 'compose.yaml', '-f', 'compose.demo.yaml', '--profile', 'cache'];
function compose(args, input) {
  return execFileSync('docker', [...composeArgs, ...args], {
    input, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
const databaseScript = `
const { Pool } = require('pg');
const { databaseUrl } = require('./deployment/start.cjs');
const input = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
async function main() {
  if (input.action === 'key') {
    const { catalogNamespace, CachedProducts } = require('./apps/api/dist/catalog/infrastructure/cached-products');
    return new CachedProducts(null, null, catalogNamespace(databaseUrl(process.env)), 30)
      .key(input.revision, 'products', [0, 1, '', '', '', null, '']);
  }
  const db = new Pool({ connectionString: databaseUrl(process.env), connectionTimeoutMillis: 5000 });
  try { return (await db.query(input.sql, input.params || [])).rows; }
  finally { await db.end(); }
}
main().then(value => console.log(JSON.stringify(value))).catch(() => {
  console.error('Fallo de comprobacion PostgreSQL'); process.exitCode = 1;
});`;
function database(input) {
  return JSON.parse(compose(['exec', '-T', 'api', 'node', '-e', databaseScript], JSON.stringify(input)));
}
const sql = (query, params) => database({ sql: query, params });
const redis = (...args) => compose(['exec', '-T', 'redis', 'redis-cli', '--raw', ...args]);
const revision = () => sql('SELECT revision::text FROM catalog_cache_revision WHERE singleton')[0].revision;
async function catalog() {
  const response = await fetch((process.env.DEMO_URL || 'http://127.0.0.1:8080') + '/api/v1/products?limit=1',
    { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, 'Catalogo disponible por Nginx');
  const body = await response.json();
  assert.equal(body.items.length, 1);
  return body.items[0];
}
async function main() {
  assert.equal(sql("SELECT name FROM schema_migrations WHERE name='007_catalog_cache.sql'").length, 1,
    'Migracion 007 registrada por el arranque');
  assert.equal(redis('PING'), 'PONG');
  let original, cacheKey, cacheValue, stopped = false;
  try {
    original = await catalog();
    const oldRevision = revision();
    cacheKey = database({ action: 'key', revision: oldRevision });
    cacheValue = redis('GET', cacheKey);
    const cached = JSON.parse(cacheValue);
    assert.equal(cached[0].id, original.id, 'La consulta publica llena su clave');
    assert.equal(cached[0].stock, original.stock);
    // Marca sintetica solo en la cache aislada del runner: demuestra un hit HTTP
    // de esta clave exacta sin depender del trafico de los healthchecks.
    cached[0].name = original.name + ' [T7 cache probe]';
    assert.equal(redis('SET', cacheKey, JSON.stringify(cached), 'EX', '120'), 'OK');
    const hit = await catalog();
    assert.equal(hit.name, cached[0].name, 'HTTP debe consumir la entrada Redis');
    assert.equal(sql('SELECT name FROM products WHERE id=$1', [original.id])[0].name, original.name,
      'La marca no se escribio en PostgreSQL');
    redis('SET', cacheKey, cacheValue, 'EX', '120');

    sql('UPDATE products SET stock=$1 WHERE id=$2', [original.stock + 1, original.id]);
    assert.notEqual(revision(), oldRevision, 'El commit de stock avanza la revision');
    const updated = await catalog();
    assert.equal(updated.stock, original.stock + 1, 'HTTP descarta el stock cacheado anterior');
    assert.equal(updated.name, original.name);
    assert.equal(JSON.parse(redis('GET', cacheKey))[0].stock, original.stock,
      'La clave anterior puede existir, pero ya no es vigente');

    compose(['stop', 'redis']); stopped = true;
    sql('UPDATE products SET stock=$1 WHERE id=$2', [original.stock + 2, original.id]);
    const fallback = await catalog();
    assert.equal(fallback.stock, original.stock + 2, 'Redis detenido: HTTP lee PostgreSQL vigente');
    const result = {
      generatedAt: new Date().toISOString(), commit: process.env.GITHUB_SHA || null,
      migration007: 'Aplicada y registrada por migrate',
      cacheHit: 'Comprobado por HTTP y clave exacta; marca sintetica ausente en PostgreSQL',
      stockInvalidation: 'Revision avanza al commit; HTTP devuelve stock nuevo aunque exista la clave anterior',
      redisStopped: 'Contenedor detenido; catalogo HTTP 200 con stock actualizado desde PostgreSQL',
      cleanup: 'Stock y contenido de prueba restaurados; Redis reiniciado',
    };
    await mkdir('docs/evidencias/preparacion-despliegue', { recursive: true });
    // La evidencia se escribe solo despues de completar tambien el finally.
    return result;
  } finally {
    try {
      if (original) sql('UPDATE products SET stock=$1 WHERE id=$2', [original.stock, original.id]);
    } finally {
      if (stopped) compose(['start', 'redis']);
      else if (cacheKey && cacheValue) redis('SET', cacheKey, cacheValue, 'EX', '30');
    }
  }
}
main().then(async result => {
  await writeFile('docs/evidencias/preparacion-despliegue/redis-conjunto.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}).catch(error => {
  // No imprimir stdout/stderr de subprocesos: pueden contener configuracion privada.
  console.error(error instanceof assert.AssertionError ? error.message : 'Fallo en smoke Redis/Compose: ' + error.message.split('\n')[0]);
  process.exitCode = 1;
});