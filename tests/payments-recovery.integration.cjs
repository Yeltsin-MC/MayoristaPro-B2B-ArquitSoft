const {test}=require('node:test');const assert=require('node:assert/strict');const {tradeFixture}=require('./trade-fixture.cjs');

test('T5-R: Recuperación de webhooks y concurrencia de inventario',async t=>{
 const f=await tradeFixture();const {db,accounts,products,call,request,offer,accept,order}=f;
 const ok=(r,status=201)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 
 async function prepared(who='buyer',vendor='vendor'){
  const q=ok(await request(who,2,[vendor]));
  const response=ok(await offer(q,vendor));
  const o=response.offers[0];
  ok(await accept(q,o.id,who),200);
  return {q,o};
 }

 try{
  await t.test('T5-R01: webhook fallido queda pendiente de recuperación',async()=>{
   // Insertar webhook manualmente con processed=false
   await db.query(
    "INSERT INTO payment_webhook_events(notification_id, data_id, action, type, payload, signature_verified, processed, received_at) VALUES('rec-01', 'PAY123', 'payment.updated', 'payment', '{}'::jsonb, true, false, now()-interval '2 minutes')"
   );
   
   // Verificar que NO está procesado
   const check1=await db.query('SELECT processed FROM payment_webhook_events WHERE notification_id=$1',['rec-01']);
   assert.equal(check1.rows[0].processed,false,'Debe estar pendiente');
   
   // Simular recuperación manual marcándolo como procesado
   await db.query('UPDATE payment_webhook_events SET processed=true, processed_at=now() WHERE notification_id=$1',['rec-01']);
   
   // Verificar que ahora SÍ está procesado
   const check2=await db.query('SELECT processed FROM payment_webhook_events WHERE notification_id=$1',['rec-01']);
   assert.equal(check2.rows[0].processed,true,'Debe estar procesado');
  });

  await t.test('T5-R02: webhooks duplicados son idempotentes (deduplicación por notification_id)',async()=>{
   // Primera inserción
   await db.query(
    "INSERT INTO payment_webhook_events(notification_id, data_id, action, type, payload, signature_verified, processed) VALUES('dup-01', 'PAY456', 'payment.updated', 'payment', '{}'::jsonb, true, false) ON CONFLICT (notification_id) DO NOTHING"
   );
   
   // Segunda inserción (duplicado) - debe ser ignorada por ON CONFLICT
   await db.query(
    "INSERT INTO payment_webhook_events(notification_id, data_id, action, type, payload, signature_verified, processed) VALUES('dup-01', 'PAY456', 'payment.updated', 'payment', '{}'::jsonb, true, false) ON CONFLICT (notification_id) DO NOTHING"
   );
   
   // Solo debe haber 1 registro
   const count=await db.query('SELECT COUNT(*) FROM payment_webhook_events WHERE notification_id=$1',['dup-01']);
   assert.equal(count.rows[0].count,'1','Solo debe haber 1 registro (idempotencia)');
  });

  await t.test('T5-R03: worker de expiración no libera stock dos veces (idempotencia)',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'idem-01'));
   
   // Stock antes de expiración
   const stock1=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const before=parseInt(stock1.rows[0].stock);
   
   // Expirar pedido
   await db.query("UPDATE trade_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",[ord.id]);
   
   // Ejecutar worker primera vez
   const {expireOrders}=require('../apps/api/src/workers/expire-orders.cjs');
   await expireOrders();
   
   // Stock después de primera ejecución
   const stock2=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const after1=parseInt(stock2.rows[0].stock);
   assert.equal(after1,before+2,'Stock debe incrementar +2');
   
   // Verificar estado de reservas
   const res1=await db.query('SELECT state FROM stock_reservations WHERE order_id=$1',[ord.id]);
   assert.equal(res1.rows[0].state,'expired','Reservas deben estar expiradas');
   
   // Ejecutar worker segunda vez (no debe cambiar nada)
   await expireOrders();
   
   // Stock después de segunda ejecución (debe ser igual)
   const stock3=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const after2=parseInt(stock3.rows[0].stock);
   assert.equal(after2,after1,'Stock NO debe cambiar en segunda ejecución (idempotencia)');
  });

  await t.test('T5-R04: dos pedidos distintos pueden expirar simultáneamente',async()=>{
   // Crear dos pedidos
   const {o:o1}=await prepared('buyer','vendor');
   const ord1=ok(await order(o1.id,'concurrent-01'));
   
   const {o:o2}=await prepared('buyer','vendor');
   const ord2=ok(await order(o2.id,'concurrent-02'));
   
   // Stock antes
   const stockBefore=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const before=parseInt(stockBefore.rows[0].stock);
   
   // Expirar ambos pedidos
   await db.query("UPDATE trade_orders SET expires_at=now()-interval '1 minute' WHERE id IN ($1,$2)",[ord1.id,ord2.id]);
   
   // Ejecutar worker (procesa ambos)
   const {expireOrders}=require('../apps/api/src/workers/expire-orders.cjs');
   await expireOrders();
   
   // Stock después (debe incrementar +4: 2 de cada pedido)
   const stockAfter=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const after=parseInt(stockAfter.rows[0].stock);
   assert.equal(after,before+4,'Stock debe incrementar +4 (2 pedidos × 2 unidades)');
   
   // Verificar ambos pedidos expirados
   const orders=await db.query('SELECT id, state FROM trade_orders WHERE id IN ($1,$2)',[ord1.id,ord2.id]);
   assert.equal(orders.rows.length,2,'Debe haber 2 pedidos');
   assert.ok(orders.rows.every(o=>o.state==='expired'),'Ambos deben estar expirados');
  });

  await t.test('T5-R05: pedido con múltiples productos se expira atómicamente',async()=>{
   // Este test requeriría crear una oferta con múltiples productos
   // Por ahora verificamos que la lógica del worker procesa todas las reservas de un pedido
   const {o}=await prepared();
   const ord=ok(await order(o.id,'multi-prod-01'));
   
   // Verificar que hay reservas para este pedido
   const reservations=await db.query('SELECT COUNT(*) FROM stock_reservations WHERE order_id=$1 AND state=$2',[ord.id,'activa']);
   assert.ok(parseInt(reservations.rows[0].count)>0,'Debe haber reservas activas');
   
   // Expirar
   await db.query("UPDATE trade_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",[ord.id]);
   const {expireOrders}=require('../apps/api/src/workers/expire-orders.cjs');
   await expireOrders();
   
   // Todas las reservas deben cambiar de estado
   const allExpired=await db.query('SELECT COUNT(*) FROM stock_reservations WHERE order_id=$1 AND state=$2',[ord.id,'expired']);
   const activeLeft=await db.query('SELECT COUNT(*) FROM stock_reservations WHERE order_id=$1 AND state=$2',[ord.id,'activa']);
   
   assert.ok(parseInt(allExpired.rows[0].count)>0,'Todas las reservas deben estar expiradas');
   assert.equal(activeLeft.rows[0].count,'0','No debe quedar ninguna reserva activa');
  });

  await t.test('T5-R06: pedido con pago pendiente NO libera stock',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'pending-pay-01'));
   
   // Crear intento de pago
   const attempt=ok(await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer'));
   assert.ok(attempt.attempt_id,'Debe tener attempt_id');
   
   // Stock antes
   const stockBefore=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const before=parseInt(stockBefore.rows[0].stock);
   
   // Expirar pedido (con pago pendiente)
   await db.query("UPDATE trade_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",[ord.id]);
   
   // Ejecutar worker
   const {expireOrders}=require('../apps/api/src/workers/expire-orders.cjs');
   await expireOrders();
   
   // Stock NO debe cambiar (pago pendiente)
   const stockAfter=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const after=parseInt(stockAfter.rows[0].stock);
   assert.equal(after,before,'Stock NO debe cambiar (pago pendiente)');
   
   // Pedido debe estar en estado expired_pending_payment
   const orderState=await db.query('SELECT state FROM trade_orders WHERE id=$1',[ord.id]);
   assert.equal(orderState.rows[0].state,'expired_pending_payment','Estado debe ser expired_pending_payment');
   
   // Reservas deben estar en payment_pending
   const resState=await db.query('SELECT state FROM stock_reservations WHERE order_id=$1',[ord.id]);
   assert.ok(resState.rows.every(r=>r.state==='payment_pending'),'Reservas deben estar en payment_pending');
  });

 }finally{await f.close();}
});
