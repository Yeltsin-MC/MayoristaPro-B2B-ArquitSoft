const { readFile } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
const manifest = require('./catalogo150/manifest.json');
const ROOT = resolve(__dirname, '../..');

function demoDatabaseUrl(source, schema = 'demo_mayoristapro150') {
  if (!source) throw new Error('Configura DATABASE_URL.');
  if (!/^demo_mayoristapro150(?:_[a-z0-9_]+)?$/.test(schema) || schema.length > 63) throw new Error('Usa un esquema demo_mayoristapro150 o una variante con sufijo.');
  const url = new URL(source);
  url.searchParams.set('options', '-c search_path=' + schema + ',public');
  return url.toString();
}

function configuration(env = process.env) {
  return {
    source: env.DATABASE_URL, schema: env.DEMO_CATALOG_SCHEMA || 'demo_mayoristapro150',
    adminEmail: env.ADMIN_EMAIL || 'admin-demo150@example.test',
    adminPassword: env.ADMIN_PASSWORD, demoPassword: env.DEMO_PASSWORD,
  };
}

function runExistingScript(file, env) {
  const result = spawnSync(process.execPath, [join(ROOT, file)], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Falló ' + file + '. ' + (result.stderr || result.error?.message || '').trim());
}

async function withDemoApi(databaseUrl, action) {
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../../apps/api/dist/app.module.js');
  const previous = process.env.DATABASE_URL;
  let app;
  process.env.DATABASE_URL = databaseUrl;
  try {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    require('../../apps/api/dist/http-setup.js').configureHttp(app, join(ROOT, 'apps/web/dist/catalog/browser'));
    await app.listen(0, '127.0.0.1');
    return await action((await app.getUrl()) + '/api/v1/');
  } finally {
    if (app) await app.close();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

async function apiCall(base, path, method = 'GET', body, token, extraHeaders = {}) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(15000),
    headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: 'Bearer ' + token } : {}), ...extraHeaders },
    ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(method + ' ' + path + ' devolvió ' + response.status + ': ' + JSON.stringify(data.message || data.code || 'Operación rechazada'));
  return data;
}

async function loadDemo(config = configuration()) {
  const databaseUrl = demoDatabaseUrl(config.source, config.schema);
  for (const [name, password] of [['ADMIN_PASSWORD', config.adminPassword], ['DEMO_PASSWORD', config.demoPassword]]) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Configura ' + name + ' con 12 a 128 caracteres.');
  }
  const root = new Pool({ connectionString: config.source, connectionTimeoutMillis: 5000 });
  const lock = await root.connect();
  let db;
  try {
    await lock.query('SELECT pg_advisory_lock(hashtext($1))', ['mayoristapro:demo150:' + config.schema]);
    await lock.query('CREATE SCHEMA IF NOT EXISTS "' + config.schema + '"');
    runExistingScript('database/migrate.cjs', { DATABASE_URL: databaseUrl });
    db = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
    const admin = (await db.query('SELECT platform_admin FROM accounts WHERE email=$1', [config.adminEmail.toLowerCase()])).rows[0];
    if (admin && !admin.platform_admin) throw new Error('La cuenta administrativa indicada ya existe sin administración.');
    if (!admin) runExistingScript('database/create-admin.cjs', {
      DATABASE_URL: databaseUrl, ADMIN_EMAIL: config.adminEmail, ADMIN_PASSWORD: config.adminPassword,
    });
    return await withDemoApi(databaseUrl, async base => {
      const login = async (email, password) => (await apiCall(base, 'auth/login', 'POST', { email, password })).token;
      const adminToken = await login(config.adminEmail, config.adminPassword);
      const imports = [];
      for (const entity of [...manifest.providers, manifest.buyer]) {
        const exists = (await db.query('SELECT 1 FROM accounts WHERE email=$1', [entity.email])).rowCount > 0;
        if (!exists) await apiCall(base, 'auth/register', 'POST', {
          email: entity.email, password: config.demoPassword, ruc: entity.ruc, legalName: entity.name,
          evidence: 'Empresa, representación y evidencias ficticias para demo académica MayoristaPro. No corresponde a un socio real.',
        });
        const enrollments = await apiCall(base, 'admin/enrollments', 'GET', undefined, adminToken);
        const enrollment = enrollments.find(row => row.email === entity.email && row.ruc === entity.ruc && row.legal_name === entity.name);
        if (!enrollment) throw new Error('La cuenta demo existente no coincide con la solicitud prevista.');
        if (!enrollment.approved_at) await apiCall(base, 'admin/enrollments/' + enrollment.id + '/approve', 'POST', undefined, adminToken);
        const token = await login(entity.email, config.demoPassword);
        let me = await apiCall(base, 'auth/me', 'GET', undefined, token);
        if (me.company.ruc !== entity.ruc) throw new Error('Vinculación demo inesperada.');
        if (!entity.file) continue; // La compradora puede comprar con su proveedor pendiente.
        if (!me.company.supplier_verified) {
          await apiCall(base, 'providers/' + me.company.supplier_id + '/verify', 'PATCH', undefined, adminToken);
          me = await apiCall(base, 'auth/me', 'GET', undefined, token);
        }
        if (!me.permissions.includes('publish') || !me.company.supplier_verified) throw new Error('Proveedor demo sin permiso de publicación verificado.');
        const csv = await readFile(join(__dirname, 'catalogo150', entity.file));
        const form = new FormData(); form.append('file', new Blob([csv], { type: 'text/csv' }), entity.file);
        const preview = await apiCall(base, 'products/imports/preview', 'POST', form, token);
        if (preview.status !== 'preview' || preview.summary.total !== 30 || preview.summary.invalid !== 0) throw new Error('Revisa el CSV de ' + entity.code + '. El lote debe contener 30 filas válidas.');
        const result = await apiCall(base, 'products/imports/' + preview.id + '/confirm', 'POST', { previewHash: preview.previewHash }, token,
          { 'Idempotency-Key': 'demo150-' + entity.code + '-' + preview.id });
        const products = await apiCall(base, 'trade/products', 'GET', undefined, token);
        if (products.length !== 30) throw new Error('El proveedor ' + entity.code + ' no tiene exactamente 30 referencias en este esquema.');
        imports.push({ provider: entity.name, products: products.length, created: result.result.created, updated: result.result.updated });
      }
      const counts = (await db.query(`SELECT
        (SELECT count(*)::int FROM suppliers WHERE verified) AS suppliers,
        (SELECT count(*)::int FROM products) AS products,
        (SELECT count(DISTINCT category)::int FROM products) AS categories,
        (SELECT count(*)::int FROM products p JOIN suppliers s ON s.id=p.supplier_id
          JOIN companies c ON c.supplier_id=s.id WHERE p.published AND s.verified AND c.status='enabled') AS quotable`)).rows[0];
      if (counts.suppliers !== 5 || counts.products !== 150 || counts.categories !== 5 || counts.quotable !== 150) throw new Error('Los conteos de la demo no corresponden a 5 proveedores y 150 productos cotizables.');
      return { schema: config.schema, ...counts, imports };
    });
  } finally {
    if (db) await db.end();
    lock.release();
    await root.end(); // Cierra también la conexión que posee el advisory lock.
  }
}

module.exports = { configuration, demoDatabaseUrl, withDemoApi, apiCall, loadDemo, manifest };
if (require.main === module) loadDemo().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });