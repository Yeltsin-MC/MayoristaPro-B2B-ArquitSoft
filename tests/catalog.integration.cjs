const { test } = require('node:test');
const assert = require('node:assert/strict');

test('el catálogo público consulta PostgreSQL y valida la paginación', async () => {
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { CatalogModule } = require('../apps/api/dist/catalog/catalog.module.js');
  const app = await NestFactory.create(CatalogModule, { logger: false, abortOnError: false });
  try {
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    const url = (await app.getUrl()) + '/api/v1/products';
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const { items } = await response.json();
    const notebook = items.find(item => item.name === 'Cuaderno A4');
    assert.ok(notebook, 'La base de prueba debe contener los productos de db:seed.');
    assert.equal(notebook.price, '48.00');
    assert.equal(notebook.currency, 'PEN');
    assert.equal(notebook.minimum, 2);

    const paginated = await fetch(url + '?page=1&limit=1');
    const firstPage = await paginated.json();
    assert.equal(paginated.status, 200);
    assert.equal(firstPage.items.length, 1);
    assert.equal(firstPage.limit, 1);

    const invalid = await fetch(url + '?limit=101');
    assert.equal(invalid.status, 400);
    await invalid.text();
  } finally {
    await app.close();
  }
});
