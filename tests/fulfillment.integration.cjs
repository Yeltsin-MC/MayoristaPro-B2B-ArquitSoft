const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tradeFixture } = require('./trade-fixture.cjs');

test('Despacho de pedidos: preparing, dispatched y delivered', async t => {
  const f = await tradeFixture();
  const { db, call, request, offer, accept, order } = f;
  const ok = (r, status = 200) => {
    assert.equal(r.status, status, JSON.stringify(r.body));
    return r.body;
  };
  try {
    let pedido;
    await t.test('Despacho: no se prepara un pedido sin pagar', async () => {
      const q = ok(await request('buyer', 2, ['vendor']), 201);
      const o = ok(await offer(q, 'vendor'), 201).offers[0];
      ok(await accept(q, o.id));
      pedido = ok(await order(o.id), 201);
      assert.deepEqual(pedido.events, []);
      assert.equal(pedido.isBuyer, true);
      const early = await call('orders/' + pedido.id + '/fulfillment', 'PATCH', { estado: 'preparing' }, 'vendor');
      assert.equal(early.status, 409);
      assert.equal(early.body.code, 'ORDER_STATE_CONFLICT');
    });

    await t.test('Despacho: proveedor prepara y despacha, comprador confirma recepción', async () => {
      await db.query("UPDATE trade_orders SET state='paid' WHERE id=$1", [pedido.id]);
      const url = 'orders/' + pedido.id + '/fulfillment';
      assert.equal((await call(url, 'PATCH', { estado: 'preparing' }, 'buyer')).status, 403);
      assert.equal((await call(url, 'PATCH', { estado: 'preparing' }, 'vendor2')).status, 404);
      assert.equal((await call(url, 'PATCH', { estado: 'enviado' }, 'vendor')).status, 422);
      assert.equal((await call(url, 'PATCH', { estado: 'dispatched' }, 'vendor')).status, 409);
      assert.equal(ok(await call(url, 'PATCH', { estado: 'preparing' }, 'vendor')).state, 'preparing');
      // Repetir la misma operación no duplica el historial.
      ok(await call(url, 'PATCH', { estado: 'preparing' }, 'vendor'));
      const sent = ok(await call(url, 'PATCH', { estado: 'dispatched', nota: ' Guía T001-123 ' }, 'vendor'));
      assert.equal(sent.state, 'dispatched');
      assert.equal((await call(url, 'PATCH', { estado: 'delivered' }, 'vendor')).status, 403);
      const done = ok(await call(url, 'PATCH', { estado: 'delivered' }, 'buyer'));
      assert.equal(done.state, 'delivered');
      assert.deepEqual(
        done.events.map(e => [e.state, e.note]),
        [
          ['preparing', null],
          ['dispatched', 'Guía T001-123'],
          ['delivered', null],
        ],
      );
      const audit = await db.query('SELECT action FROM identity_audit WHERE resource_id=$1 ORDER BY id', [pedido.id]);
      assert.deepEqual(
        audit.rows.map(r => r.action).filter(a => a.startsWith('order-')),
        ['order-preparing', 'order-dispatched', 'order-delivered'],
      );
    });

    await t.test('Avisos de cada paso y «Volver a pedir» tras la entrega', async () => {
      const vendor = ok(await call('notifications', 'GET', undefined, 'vendor'));
      assert.deepEqual(
        vendor.items.map(n => n.kind).reverse(),
        ['quote-request', 'offer-accepted', 'order', 'order-paid', 'order-delivered'],
      );
      assert.equal(vendor.unread, vendor.items.length);
      const buyer = ok(await call('notifications', 'GET', undefined, 'buyer'));
      assert.deepEqual(buyer.items.map(n => n.kind).reverse(), ['offer', 'order-preparing', 'order-dispatched']);
      assert.ok(buyer.items.every(n => n.link.startsWith('/cuenta/')));
      assert.equal(ok(await call('notifications', 'GET', undefined, 'vendor2')).unread, 0);
      ok(await call('notifications/read', 'POST', {}, 'buyer'), 201);
      assert.equal(ok(await call('notifications', 'GET', undefined, 'buyer')).unread, 0);

      assert.equal((await call('orders/' + pedido.id + '/reorder', 'POST', {}, 'vendor')).status, 404);
      const again = ok(await call('orders/' + pedido.id + '/reorder', 'POST', {}, 'buyer'), 201);
      assert.notEqual(again.id, pedido.requestId);
      assert.equal(again.items.length, 1);
      assert.equal(again.items[0].quantity, pedido.items[0].quantity);
      const fresh = ok(await call('notifications', 'GET', undefined, 'vendor'));
      assert.equal(fresh.items[0].kind, 'quote-request');
      assert.equal(fresh.items[0].link, '/cuenta/cotizaciones/' + again.id);
    });
  } finally {
    await f.close();
  }
});
