const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

function databaseUrl(env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  for (const name of ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
    if (!env[name]) throw new Error('Falta configurar ' + name);
  }
  const port = Number(env.POSTGRES_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('POSTGRES_PORT inválido');
  const url = new URL('postgresql://localhost');
  url.hostname = env.POSTGRES_HOST;
  url.port = String(port);
  url.username = env.POSTGRES_USER;
  url.password = env.POSTGRES_PASSWORD;
  url.pathname = '/' + encodeURIComponent(env.POSTGRES_DB);
  return url.toString();
}

function runScript(path) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [resolve(__dirname, '..', path)], { stdio: 'inherit' });
    const stop = () => child.kill('SIGTERM');
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.removeListener('SIGTERM', stop);
      process.removeListener('SIGINT', stop);
      if (code === 0 || signal === 'SIGTERM' || signal === 'SIGINT') resolveRun();
      else reject(new Error('Falló ' + path));
    });
  });
}

async function main(mode) {
  process.env.DATABASE_URL = databaseUrl(process.env);
  if (mode === 'api') {
    require('../apps/api/dist/main.js');
  } else if (mode === 'migrate') {
    await runScript('database/migrate.cjs');
    if (process.env.DEMO_SEED === 'true') await runScript('database/seed.cjs');
  } else if (mode === 'worker') {
    const seconds = Number(process.env.WORKER_INTERVAL_SECONDS || 120);
    if (!Number.isInteger(seconds) || seconds < 1) throw new Error('WORKER_INTERVAL_SECONDS inválido');
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    while (!controller.signal.aborted) {
      await runScript('apps/api/dist/workers/expire-orders.cjs');
      if (controller.signal.aborted) break;
      await runScript('apps/api/dist/workers/recover-webhooks.cjs');
      try { await delay(seconds * 1000, undefined, { signal: controller.signal }); }
      catch (error) { if (error.name !== 'AbortError') throw error; }
    }
  } else {
    throw new Error('Modo de arranque inválido. Usa api, migrate o worker.');
  }
}

if (require.main === module) {
  main(process.argv[2] || 'api').catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { databaseUrl };
