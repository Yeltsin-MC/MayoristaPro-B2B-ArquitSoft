const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { METHOD_METADATA, PATH_METADATA } = require('@nestjs/common/constants');
const { loadOpenApi } = require('../apps/api/dist/api-docs');

// Rutas reales: se leen los metadatos de Nest de cada controlador compilado.
function controllers(dir) {
  return readdirSync(dir).flatMap(name => {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) return controllers(file);
    return name.endsWith('.controller.js') ? Object.values(require(file)) : [];
  });
}
const METHODS = ['get', 'post', 'put', 'delete', 'patch', 'all', 'options', 'head'];
function implemented() {
  const routes = new Set();
  for (const controller of controllers(join(__dirname, '../apps/api/dist'))) {
    if (typeof controller !== 'function') continue;
    const base = Reflect.getMetadata(PATH_METADATA, controller);
    if (base === undefined) continue;
    for (const key of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = controller.prototype[key];
      const method = Reflect.getMetadata(METHOD_METADATA, handler);
      if (method === undefined) continue;
      const path = ['', base, Reflect.getMetadata(PATH_METADATA, handler)]
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/\/$/, '')
        .replace(/:(\w+)/g, '{$1}');
      routes.add(METHODS[method] + ' ' + path);
    }
  }
  return routes;
}
function documented(spec) {
  return new Set(
    Object.entries(spec.paths).flatMap(([path, item]) =>
      Object.keys(item).filter(m => METHODS.includes(m)).map(m => m + ' ' + path),
    ),
  );
}

test('el contrato OpenAPI documenta exactamente los endpoints implementados', () => {
  const spec = loadOpenApi();
  const code = implemented();
  const docs = documented(spec);
  assert.ok(code.size > 30, 'se esperaban más de 30 endpoints, hay ' + code.size);
  assert.deepEqual([...code].filter(r => !docs.has(r)).sort(), [], 'endpoints sin documentar');
  assert.deepEqual([...docs].filter(r => !code.has(r)).sort(), [], 'endpoints documentados que no existen');
});

test('cada operación tiene resumen, respuestas y referencias válidas', () => {
  const spec = loadOpenApi();
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.servers[0].url, '/api/v1');
  for (const [path, item] of Object.entries(spec.paths))
    for (const [method, op] of Object.entries(item)) {
      assert.ok(op.summary, method + ' ' + path + ' sin summary');
      assert.ok(Object.keys(op.responses ?? {}).length > 0, method + ' ' + path + ' sin respuestas');
    }
  const text = readFileSync(join(__dirname, '../apps/api/openapi.yaml'), 'utf8');
  for (const [, section, name] of text.matchAll(/\$ref: '#\/components\/(\w+)\/(\w+)'/g))
    assert.ok(spec.components[section]?.[name], 'referencia rota: ' + section + '/' + name);
});
