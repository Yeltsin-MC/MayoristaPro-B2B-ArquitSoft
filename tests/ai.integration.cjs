const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { tradeFixture } = require('./trade-fixture.cjs');

test('T6: rutas, permisos, reputacion PostgreSQL y contrato FastAPI', { timeout: 60000 }, async t => {
  const originalUrl = process.env.AI_SERVICE_URL;
  const realUrl = process.env.T6_AI_URL;
  let mode = 'ok';
  let lastRequest;
  let scoringCalls = 0;
  const python = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    try {
      if (mode === 'real') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const forwarded = await fetch(realUrl.replace(/\/+$/, '') + request.url, {
          method: request.method,
          headers: { 'Content-Type': 'application/json' },
          ...(request.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
          signal: AbortSignal.timeout(4000),
        });
        response.writeHead(forwarded.status);
        response.end(await forwarded.text());
        return;
      }
      if (request.url === '/health') {
        response.end(JSON.stringify({ status: 'healthy', service: 'mayoristapro-ai' }));
        return;
      }
      assert.equal(request.url, '/api/v1/score-offers');
      assert.equal(request.method, 'POST');
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      lastRequest = JSON.parse(Buffer.concat(chunks).toString());
      scoringCalls++;
      if (mode === 'unavailable') {
        response.writeHead(503);
        response.end(JSON.stringify({ detail: 'Servicio detenido para esta prueba' }));
        return;
      }
      // FastAPI returns identifiers, score, breakdown and rank. Commercial
      // amounts must be preserved by NestJS from the authorized T4 offers.
      const scored = lastRequest.offers.map((offer, index) => ({
        offer_id: offer.offer_id,
        supplier_id: offer.supplier_id,
        supplier_name: offer.supplier_name,
        score: index === 0 ? 100 : 10,
        breakdown: { price_score: index === 0 ? 100 : 0,
          delivery_score: index === 0 ? 100 : 0,
          reputation_score: index === 0 ? 100 : 50 },
        rank: index + 1,
      }));
      if (mode === 'invalid') scored[0].supplier_id = 'proveedor-ajeno';
      response.end(JSON.stringify({ scored_offers: scored }));
    } catch (error) {
      response.writeHead(502);
      response.end(JSON.stringify({ detail: error.message }));
    }
  });
  python.listen(0, '127.0.0.1');
  await once(python, 'listening');
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${python.address().port}`;
  let fixture;
  const ok = (result, status = 201) => {
    assert.equal(result.status, status, JSON.stringify(result.body));
    return result.body;
  };
  try {
    fixture = await tradeFixture();
    const { call, request, offer, accept, order, db, accounts } = fixture;
    // Persist one paid historical order to prove that reputation reads the
    // fixture DATABASE_URL/search_path instead of a separate default database.
    const history = ok(await request('buyer', 2, ['vendor']));
    const historicalOffer = ok(await offer(history)).offers[0];
    ok(await accept(history, historicalOffer.id), 200);
    const historicalOrder = ok(await order(historicalOffer.id));
    await db.query("UPDATE trade_orders SET state='paid' WHERE id=$1", [historicalOrder.id]);

    const quotation = ok(await request());
    ok(await offer(quotation, 'vendor', { costoEnvio: '0.00' }));
    ok(await offer(quotation, 'vendor2', { costoEnvio: '0.00', diasEntrega: 5,
      items: fixture.draft(quotation, 'vendor2').items.map(item => ({ ...item, precioUnitario: '52.00' })) }));
    const scorePath = `quotations/${quotation.id}/score-offers`;

    await t.test('catalogo y health usan un solo prefijo /api/v1', async () => {
      const catalog = ok(await call('products', 'GET', undefined, null), 200);
      assert.ok(catalog.items.length > 0);
      assert.equal(ok(await call('ai/health', 'GET', undefined, null), 200).status, 'ok');
      assert.equal((await call('api/v1/ai/health', 'GET', undefined, null)).status, 404);
    });

    await t.test('T6-01/04: campos T4, reputacion real y condiciones comerciales', async () => {
      const result = ok(await call(scorePath, 'POST'));
      assert.equal(result.ai_service_available, true);
      assert.equal(result.scored_offers.length, 2);
      const vendor = lastRequest.offers.find(item => item.supplier_id === accounts.vendor.supplier);
      assert.equal(vendor.supplier_name, 'vendor');
      assert.equal(vendor.delivery_days, 3);
      assert.equal(vendor.total, 96);
      assert.equal(vendor.supplier_completed_orders, 1);
      assert.equal(vendor.supplier_total_orders, 1);
      const newVendor = lastRequest.offers.find(item => item.supplier_id === accounts.vendor2.supplier);
      assert.equal(newVendor.supplier_completed_orders, 0);
      assert.equal(newVendor.supplier_total_orders, 0);
      assert.deepEqual(result.scored_offers.map(item => item.total), [96, 104]);
      assert.deepEqual(result.scored_offers.map(item => item.delivery_days), [3, 5]);
    });

    await t.test('T6-02: rechaza proveedor, empresa ajena, sesion ausente e ID invalido', async () => {
      const before = scoringCalls;
      assert.equal((await call(scorePath, 'POST', undefined, 'vendor')).status, 403);
      assert.equal((await call(scorePath, 'POST', undefined, 'buyer2')).status, 404);
      assert.equal((await call(scorePath, 'POST', undefined, 'outsider')).status, 404);
      assert.equal((await call(scorePath, 'POST', undefined, null)).status, 401);
      assert.equal((await call('quotations/invalido/score-offers', 'POST')).status, 422);
      assert.equal(scoringCalls, before);
    });

    await t.test('T6-02: acceso revocado impide puntuar', async () => {
      await db.query('UPDATE memberships SET active=false WHERE account_id=$1', [accounts.buyer.account]);
      try {
        assert.equal((await call(scorePath, 'POST')).status, 403);
      } finally {
        await db.query('UPDATE memberships SET active=true WHERE account_id=$1', [accounts.buyer.account]);
      }
    });

    await t.test('T6-03: fallo HTTP conserva ofertas y muestra score null', async () => {
      mode = 'unavailable';
      const result = ok(await call(scorePath, 'POST'));
      assert.equal(result.ai_service_available, false);
      assert.deepEqual(result.scored_offers.map(item => item.score), [null, null]);
      assert.deepEqual(result.scored_offers.map(item => item.total), [96, 104]);
      mode = 'ok';
    });

    await t.test('respuesta incompatible de IA conserva las ofertas autorizadas', async () => {
      mode = 'invalid';
      const result = ok(await call(scorePath, 'POST'));
      assert.equal(result.ai_service_available, false);
      assert.ok(result.scored_offers.every(item => item.score === null));
      assert.equal(result.scored_offers[0].supplier_id, accounts.vendor.supplier);
      mode = 'ok';
    });

    await t.test('solicitud sin ofertas devuelve resultado vacio sin llamar a Python', async () => {
      const empty = ok(await request());
      const before = scoringCalls;
      const result = ok(await call(`quotations/${empty.id}/score-offers`, 'POST'));
      assert.deepEqual(result.scored_offers, []);
      assert.equal(result.ai_service_available, false);
      assert.equal(scoringCalls, before);
    });

    await t.test('T6-01: integracion con FastAPI real indicado en T6_AI_URL', { skip: !realUrl }, async () => {
      mode = 'real';
      assert.equal(ok(await call('ai/health', 'GET', undefined, null), 200).status, 'ok');
      const result = ok(await call(scorePath, 'POST'));
      assert.equal(result.ai_service_available, true, JSON.stringify(result));
      assert.deepEqual(result.scored_offers.map(item => item.total), [96, 104]);
      assert.deepEqual(result.scored_offers.map(item => item.score), [100, 10]);
      assert.deepEqual(result.scored_offers.map(item => item.breakdown.reputation_score), [100, 50]);
    });
  } finally {
    try {
      if (fixture) await fixture.close();
    } finally {
      if (originalUrl === undefined) delete process.env.AI_SERVICE_URL;
      else process.env.AI_SERVICE_URL = originalUrl;
      python.closeAllConnections();
      await new Promise(resolve => python.close(resolve));
    }
  }
});
