const assert = require('node:assert/strict');
const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { setTimeout: delay } = require('node:timers/promises');

async function main() {
  const origin = process.env.DEMO_URL || 'http://127.0.0.1:8080';
  let response;
  for (let n = 0; n < 30; n++) {
    try {
      response = await fetch(origin + '/api/v1/products?limit=1', { signal: AbortSignal.timeout(2000) });
      if (response.ok) break;
    } catch { /* The compose health dependencies may still be settling. */ }
    await delay(1000);
  }
  assert.equal(response?.status, 200, 'El catálogo debe responder a través de Nginx');
  assert.ok((await response.json()).items.length > 0);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const home = await fetch(origin);
  const html = await home.text();
  assert.equal(home.status, 200); assert.match(html, /app-root/);
  const asset = html.match(/<script[^>]+src="([^"]+)"/);
  assert.ok(asset, 'Angular debe incluir su bundle');
  const bundle = await fetch(new URL(asset[1], origin));
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get('content-type'), /javascript/);
  const spa = await fetch(origin + '/empresa/demo');
  assert.equal(spa.status, 200); assert.match(await spa.text(), /app-root/);
  const badApi = await fetch(origin + '/api/v1/unknown-route');
  assert.equal(badApi.status, 404); assert.match(badApi.headers.get('content-type'), /json/);
  const invalid = await fetch(origin + '/api/v1/products?limit=101');
  assert.equal(invalid.status, 400);
  const ai = await fetch(origin + '/api/v1/ai/health');
  assert.equal(ai.status, 200); assert.equal((await ai.json()).status, 'ok');
  const hidden = await fetch(origin + '/.env');
  assert.ok([403, 404].includes(hidden.status));
  if (process.env.COMPOSE_CONFIG_FILE) {
    const config = JSON.parse(await readFile(process.env.COMPOSE_CONFIG_FILE, 'utf8'));
    for (const name of ['db', 'api', 'ai', 'migrate', 'worker', 'redis']) {
      assert.equal(config.services[name]?.ports?.length || 0, 0, name + ' debe permanecer interno');
    }
    assert.equal(config.networks.backend.internal, true);
    for (const name of ['db', 'ai', 'redis']) {
      if (config.services[name]) assert.deepEqual(Object.keys(config.services[name].networks), ['backend']);
    }
    assert.equal(config.services.web.ports.length, 1);
  }
  const result = { generatedAt: new Date().toISOString(), origin,
    angular: 'HTML y bundle servidos por Nginx; fallback SPA correcto',
    catalog: '200 con datos y no-store; límites conservados',
    apiRouting: '404 JSON para API inexistente', fastApi: 'NestJS comunica con FastAPI interno',
    secrets: 'Ruta .env bloqueada', network: process.env.COMPOSE_CONFIG_FILE ? 'Solo web publicado; servicios de datos internos' : 'Sin comprobación Compose',
    redis: process.env.REDIS_URL ? 'Perfil cache activo; comprobacion conjunta en redis-conjunto.json' : 'Redis opcional desactivado' };
  await mkdir('docs/evidencias/preparacion-despliegue', { recursive: true });
  await writeFile('docs/evidencias/preparacion-despliegue/arranque.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
