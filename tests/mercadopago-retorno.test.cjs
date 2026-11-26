const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Payments } = require('../apps/api/dist/payments/application/payments.js');
const { MercadoPagoGateway } = require('../apps/api/dist/payments/infrastructure/mercadopago-gateway.js');

// Retorno desde Mercado Pago real (sandbox): se consulta el pago y se confirma el pedido sin webhook.
const ATTEMPT = '11111111-2222-3333-4444-555555555555';
function escenario({ status = 'approved', amount = 104, reference = ATTEMPT, expired = false } = {}) {
  const attempt = { id: ATTEMPT, order_id: 'order-1', state: 'created' };
  const order = {
    id: 'order-1',
    total: '104.00',
    state: 'pendiente',
    expires_at: new Date(Date.now() + (expired ? -60000 : 1800000)),
  };
  const transitions = [];
  const store = {
    getAttemptByExternalReference: async id => (id === ATTEMPT ? attempt : null),
    getOrder: async (id, company) => (id === 'order-1' && company === 'empresa-1' ? order : null),
    updateAttemptState: async (id, state) => {
      transitions.push(state);
      attempt.state = state;
      return true;
    },
  };
  const gateway = {
    simulated: false,
    getPaymentInfo: async id => ({
      id,
      status,
      status_detail: 'accredited',
      transaction_amount: amount,
      currency_id: 'PEN',
      external_reference: reference,
    }),
  };
  return { payments: new Payments(store, gateway), transitions, attempt };
}

test('Mercado Pago: confirmación al volver del checkout', async t => {
  await t.test('un pago aprobado pasa por pending y queda approved; repetir no cambia nada', async () => {
    const { payments, transitions } = escenario();
    assert.deepEqual(await payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '123456789' }, 'empresa-1'), {
      state: 'approved',
      orderId: 'order-1',
    });
    assert.deepEqual(transitions, ['pending', 'approved']);
    await payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '123456789' }, 'empresa-1');
    assert.deepEqual(transitions, ['pending', 'approved']);
  });
  await t.test('pago aprobado después del vencimiento queda como approved_late', async () => {
    const { payments } = escenario({ expired: true });
    const r = await payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '1' }, 'empresa-1');
    assert.equal(r.state, 'approved_late');
  });
  await t.test('rechazado, pendiente y regreso sin pago', async () => {
    assert.equal((await escenario({ status: 'rejected' }).payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '2' }, 'empresa-1')).state, 'rejected');
    assert.equal((await escenario({ status: 'in_process' }).payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '3' }, 'empresa-1')).state, 'pending');
    const sinPago = escenario();
    assert.equal((await sinPago.payments.confirmReturn({ attemptId: ATTEMPT, paymentId: 'null' }, 'empresa-1')).state, 'created');
    assert.deepEqual(sinPago.transitions, []);
  });
  await t.test('sin payment_id busca el pago por external_reference (no apareció «Volver al sitio»)', async () => {
    const { payments, transitions } = escenario();
    const buscados = [];
    payments.gateway.findPaymentByReference = async ref => (buscados.push(ref), '191772116796');
    const r = await payments.confirmReturn({ attemptId: ATTEMPT }, 'empresa-1');
    assert.equal(r.state, 'approved');
    assert.deepEqual(buscados, [ATTEMPT]);
    assert.deepEqual(transitions, ['pending', 'approved']);
    const sinPago = escenario();
    sinPago.payments.gateway.findPaymentByReference = async () => null;
    assert.equal((await sinPago.payments.confirmReturn({ attemptId: ATTEMPT }, 'empresa-1')).state, 'created');
  });
  await t.test('rechaza pagos de otro pedido, otro monto u otra empresa', async () => {
    await assert.rejects(
      escenario({ reference: 'otro' }).payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '4' }, 'empresa-1'),
      /no corresponde/,
    );
    await assert.rejects(escenario({ amount: 1 }).payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '5' }, 'empresa-1'));
    await assert.rejects(
      escenario().payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '6' }, 'empresa-2'),
      /no pertenece/,
    );
    await assert.rejects(escenario().payments.confirmReturn({ attemptId: 'x', paymentId: '6' }, 'empresa-1'), /inválido/);
  });
  await t.test('sin credenciales de Mercado Pago se usa el pago de prueba', async () => {
    const { payments } = escenario();
    payments.gateway.simulated = true;
    await assert.rejects(payments.confirmReturn({ attemptId: ATTEMPT, paymentId: '7' }, 'empresa-1'), /pago de prueba/);
  });
});

test('Mercado Pago: preferencia con regreso a /pago-mercadopago', async t => {
  const previo = { ...process.env };
  const original = global.fetch;
  async function preferencia(frontend, api) {
    let body;
    global.fetch = async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ id: 'pref-1', init_point: 'https://www.mercadopago.com.pe/checkout' }) };
    };
    Object.assign(process.env, { MP_ACCESS_TOKEN: 'TEST-ficticio', NODE_ENV: 'production', FRONTEND_URL: frontend, API_URL: api });
    const gateway = new MercadoPagoGateway();
    await gateway.createPreference({
      external_reference: ATTEMPT,
      items: [{ title: 'Pedido', quantity: 1, unit_price: 104 }],
      shipment_cost: 0,
      expires_at: new Date(Date.now() + 1800000),
    });
    return body;
  }
  try {
    await t.test('en localhost: regreso manual y sin webhook (Mercado Pago no llega a localhost)', async () => {
      const body = await preferencia('http://localhost:3300', 'http://localhost:3300');
      assert.equal(body.back_urls.success, 'http://localhost:3300/pago-mercadopago');
      assert.equal(body.auto_return, undefined);
      assert.equal(body.notification_url, undefined);
      assert.equal(body.expires, true);
    });
    await t.test('con HTTPS público: regreso automático y webhook', async () => {
      const body = await preferencia('https://tienda.example.test', 'https://tienda.example.test/');
      assert.equal(body.back_urls.failure, 'https://tienda.example.test/pago-mercadopago');
      assert.equal(body.auto_return, 'approved');
      assert.equal(body.notification_url, 'https://tienda.example.test/api/v1/webhooks/mercadopago');
    });
  } finally {
    global.fetch = original;
    for (const key of ['MP_ACCESS_TOKEN', 'NODE_ENV', 'FRONTEND_URL', 'API_URL']) {
      if (previo[key] === undefined) delete process.env[key];
      else process.env[key] = previo[key];
    }
  }
});
