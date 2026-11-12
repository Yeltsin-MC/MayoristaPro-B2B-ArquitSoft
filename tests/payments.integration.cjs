const {test}=require('node:test');const assert=require('node:assert/strict');const {tradeFixture}=require('./trade-fixture.cjs');

test('T5: Pagos con Mercado Pago (mock)',async t=>{
 const f=await tradeFixture();const {db,accounts,call,request,offer,accept,order}=f;
 const ok=(r,status=201)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 
 async function prepared(who='buyer',vendor='vendor'){
  const q=ok(await request(who,2,[vendor]));
  const response=ok(await offer(q,vendor));
  const o=response.offers[0];
  ok(await accept(q,o.id,who),200);
  return {q,o};
 }

 try{
  await t.test('T5-P01: crear intento de pago para pedido válido',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'pay-1'));
   
   // Crear intento de pago
   const attempt=ok(await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer'));
   
   assert.ok(attempt.attempt_id,'Debe retornar attempt_id');
   assert.ok(attempt.init_point,'Debe retornar init_point de MP');
   assert.ok(attempt.expires_at,'Debe retornar expires_at');
   
   // Verificar que se creó en DB
   const dbAttempt=await db.query('SELECT * FROM payment_attempts WHERE order_id=$1',[ord.id]);
   assert.equal(dbAttempt.rows.length,1,'Debe crear 1 intento');
   assert.equal(dbAttempt.rows[0].state,'created','Estado debe ser created');
   assert.equal(dbAttempt.rows[0].currency,'PEN','Moneda debe ser PEN');
  });

  await t.test('T5-P02: no permitir pago sin autenticación',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'pay-2'));
   
   const result=await call(`orders/${ord.id}/payment-attempts`,'POST',{},null);
   assert.equal(result.status,401,'Debe rechazar sin autenticación');
  });

  await t.test('T5-P03: no permitir pago de pedido de otra empresa',async()=>{
   const {o}=await prepared('buyer');
   const ord=ok(await order(o.id,'pay-3','buyer'));
   
   const result=await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer2');
   assert.equal(result.status,404,'Debe retornar 404 para pedido de otra empresa');
  });

  await t.test('T5-P04: máximo 3 intentos de pago',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'pay-4'));
   
   // Crear 3 intentos fallidos directamente en DB
   for(let i=0;i<3;i++){
    await db.query(
     "INSERT INTO payment_attempts(order_id,state,amount,currency) VALUES($1,'rejected',100,'PEN')",
     [ord.id]
    );
   }
   
   // Intento 4 debe fallar
   const result=await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer');
   assert.equal(result.status,409,'Debe rechazar 4to intento');
   assert.ok(result.body.message.includes('máximo'),'Mensaje debe mencionar máximo');
  });

  await t.test('T5-P05: no permitir dos intentos activos simultáneos',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'pay-5'));
   
   // Crear primer intento
   ok(await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer'));
   
   // Segundo intento debe fallar (índice único parcial)
   const result=await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer');
   assert.equal(result.status,409,'Debe rechazar segundo intento activo');
  });

  await t.test('T5-P06: no permitir pago de pedido expirado',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'pay-6'));
   
   // Expirar el pedido
   await db.query("UPDATE trade_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",[ord.id]);
   
   const result=await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer');
   assert.equal(result.status,409,'Debe rechazar pedido expirado');
   assert.ok(result.body.message.includes('vencido'),'Mensaje debe mencionar vencimiento');
  });

  await t.test('T5-P07: listar intentos de pago',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'pay-7'));
   
   ok(await call(`orders/${ord.id}/payment-attempts`,'POST',{},'buyer'));
   
   const attempts=ok(await call(`orders/${ord.id}/payment-attempts`,'GET',undefined,'buyer'),200);
   assert.ok(Array.isArray(attempts),'Debe retornar array');
   assert.equal(attempts.length,1,'Debe haber 1 intento');
   assert.ok(attempts[0].id,'Intento debe tener id');
   assert.equal(attempts[0].state,'created','Estado debe ser created');
  });

  await t.test('T5-P08: webhook registra notificación recibida',async()=>{
   const {o}=await prepared();
   const ord=ok(await order(o.id,'pay-8'));
   
   // Simular webhook sin procesamiento completo (solo registro)
   const webhookBody={
    action:'payment.updated',
    data:{id:'MOCK_PAYMENT_TEST_123'},
    type:'payment'
   };
   
   // El webhook fallará en procesamiento (sin external_reference válido) pero se registra
   await call(
    `webhooks/mercadopago?id=notif-001&data.id=MOCK_PAYMENT_TEST_123&type=payment`,
    'POST',
    webhookBody,
    null
   );
   
   // Verificar que el webhook se registró
   const dbWebhook=await db.query('SELECT notification_id, signature_verified, processed, processing_error FROM payment_webhook_events WHERE notification_id=$1',['notif-001']);
   assert.equal(dbWebhook.rows.length,1,'Debe registrar webhook');
   // Con los cambios de recuperación, el webhook se registra pero NO se marca como procesado si falla
   assert.equal(dbWebhook.rows[0].processed,false,'Webhook fallido queda pendiente de recuperación');
   assert.equal(dbWebhook.rows[0].signature_verified,true,'Firma verificada en modo mock');
  });

 }finally{await f.close();}
});
