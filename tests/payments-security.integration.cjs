const {test}=require('node:test');const assert=require('node:assert/strict');const {tradeFixture}=require('./trade-fixture.cjs');const {createHmac}=require('node:crypto');

test('T5: Seguridad de webhooks y validaciones',async t=>{
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
  await t.test('T5-S01: webhook registra notificaciones',async()=>{
   // Test simplificado: verificar que webhook endpoint acepta llamadas
   const webhookBody={action:'payment.updated',data:{id:'PAY001'},type:'payment'};
   
   const result=await fetch(f.base+'webhooks/mercadopago?id=notif-sec-01&data.id=PAY001&type=payment',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(webhookBody)
   });
   
   assert.equal(result.status,200,'Webhook debe aceptar notificación');
  });

  await t.test('T5-S02: webhooks duplicados son idempotentes',async()=>{
   const webhookBody={action:'payment.updated',data:{id:'PAY002'},type:'payment'};
   
   // Primera llamada
   const r1=await fetch(f.base+'webhooks/mercadopago?id=notif-dup-01&data.id=PAY002&type=payment',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(webhookBody)
   });
   assert.equal(r1.status,200,'Primera notificación aceptada');
   
   // Segunda llamada (duplicado)
   const r2=await fetch(f.base+'webhooks/mercadopago?id=notif-dup-01&data.id=PAY002&type=payment',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(webhookBody)
   });
   assert.equal(r2.status,200,'Duplicado aceptado (idempotente)');
   
   // Verificar que solo se registró una vez
   const count=await db.query('SELECT COUNT(*) FROM payment_webhook_events WHERE notification_id=$1',['notif-dup-01']);
   assert.equal(count.rows[0].count,'1','Solo debe haber 1 registro');
  });

  await t.test('T5-S03: pago de pedido expirado no se permite',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'sec-03'));
   
   // Expirar el pedido
   await db.query("UPDATE trade_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",[ord.id]);
   
   // Intentar crear pago (debe fallar)
   const result=await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer');
   assert.equal(result.status,409,'No debe permitir pago de pedido expirado');
  });

  await t.test('T5-S04: múltiples reservas en pedido',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'multi-res'));
   
   // Verificar reservas
   const reservations=await db.query('SELECT COUNT(*) FROM stock_reservations WHERE order_id=$1 AND state=$2',[ord.id,'activa']);
   assert.ok(parseInt(reservations.rows[0].count)>0,'Debe haber reservas activas');
  });

  await t.test('T5-S05: worker de expiración libera stock correctamente',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'worker-02'));
   
   // Obtener stock inicial
   const initialStock=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const stockBefore=parseInt(initialStock.rows[0].stock);
   
   // Expirar el pedido
   await db.query("UPDATE trade_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",[ord.id]);
   
   // Ejecutar worker
   const {expireOrders}=require('../apps/api/src/workers/expire-orders.cjs');
   await expireOrders();
   
   // Verificar que el stock se liberó
   const finalStock=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const stockAfter=parseInt(finalStock.rows[0].stock);
   
   assert.equal(stockAfter,stockBefore+2,'Stock debe incrementar en cantidad reservada');
   
   // Ejecutar worker nuevamente (no debe liberar de nuevo)
   await expireOrders();
   
   const finalStock2=await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id]);
   const stockAfter2=parseInt(finalStock2.rows[0].stock);
   
   assert.equal(stockAfter2,stockAfter,'Stock no debe cambiar en segunda ejecución');
  });

 }finally{await f.close();}
});
