const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl } = require('../deployment/start.cjs');

test('T7: URL PostgreSQL existente y secretos con caracteres reservados', () => {
  assert.equal(databaseUrl({ DATABASE_URL: 'postgresql://configured/db' }), 'postgresql://configured/db');
  const url = new URL(databaseUrl({ POSTGRES_HOST: 'db', POSTGRES_PORT: '5433',
    POSTGRES_USER: 'demo@user', POSTGRES_PASSWORD: 'demo:@/#? value', POSTGRES_DB: 'demo database' }));
  assert.equal(url.hostname, 'db'); assert.equal(url.port, '5433');
  assert.equal(decodeURIComponent(url.username), 'demo@user');
  assert.equal(decodeURIComponent(url.password), 'demo:@/#? value');
  assert.equal(decodeURIComponent(url.pathname), '/demo database');
});

test('T7: configuración incompleta o puerto inválido detiene el arranque', () => {
  assert.throws(() => databaseUrl({}), /POSTGRES_HOST/);
  const env = { POSTGRES_HOST: 'db', POSTGRES_USER: 'demo', POSTGRES_PASSWORD: 'synthetic', POSTGRES_DB: 'demo' };
  for (const port of ['0', '70000', 'bad']) assert.throws(() => databaseUrl({ ...env, POSTGRES_PORT: port }), /POSTGRES_PORT/);
});

test('T7: workers empaquetados resuelven sus módulos JavaScript compilados', () => {
  const { readFileSync } = require('node:fs');
  for (const file of ['expire-orders.cjs', 'recover-webhooks.cjs']) {
    assert.equal(readFileSync('apps/api/dist/workers/' + file, 'utf8'), readFileSync('apps/api/src/workers/' + file, 'utf8'));
  }
  assert.ok(require.resolve('../apps/api/dist/payments/application/payments'));
  assert.ok(require.resolve('../apps/api/dist/payments/infrastructure/postgres-payments'));
  assert.ok(require.resolve('../apps/api/dist/payments/infrastructure/mercadopago-gateway'));
});
