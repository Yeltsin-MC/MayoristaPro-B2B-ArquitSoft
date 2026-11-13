const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');
const { tradeFixture } = require('./trade-fixture.cjs');

test('T7: entrypoint nativo, catálogo y NestJS–FastAPI', { timeout: 30000 }, async () => {
  const f = await tradeFixture();
  let child;
  let output = '';
  try {
    const reservation = createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    child = spawn(process.execPath, ['deployment/start.cjs', 'api'], {
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port),
        AI_SERVICE_URL: process.env.T6_AI_URL || 'http://127.0.0.1:5055' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });
    const origin = 'http://127.0.0.1:' + port;
    let response;
    for (let n = 0; n < 40; n++) {
      if (child.exitCode !== null) throw new Error('La API terminó antes de estar disponible');
      try { response = await fetch(origin + '/api/v1/products?limit=1', { signal: AbortSignal.timeout(1000) }); }
      catch { await delay(100); continue; }
      break;
    }
    assert.equal(response?.status, 200, output.slice(-1200));
    assert.equal((await response.json()).items.length, 1);
    const page = await fetch(origin);
    assert.equal(page.status, 200); assert.match(await page.text(), /app-root/);
    const health = await fetch(origin + '/api/v1/ai/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok', 'FastAPI debe estar disponible');
  } finally {
    if (child && child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    await f.close();
  }
});
