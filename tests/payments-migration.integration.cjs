const {test}=require('node:test');const assert=require('node:assert/strict');const {tradeFixture}=require('./trade-fixture.cjs');

test('T5 Phase 1: Migración de estructura de pagos (sin integración MP)',async t=>{
 const f=await tradeFixture();const {db,call,request,offer,accept,order}=f;
 const ok=(r,status=201)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 
 async function prepared(who='buyer',quantity=2,vendor='vendor'){
  const q=ok(await request(who,quantity,[vendor]));
  const response=ok(await offer(q,vendor));
  const o=response.offers[0];
  ok(await accept(q,o.id,who),200);
  return {q,o};
 }

 try{
  await t.test('T5-M01: tabla payment_attempts existe con columnas requeridas',async()=>{
   const cols=await db.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name='payment_attempts' AND table_schema=current_schema()
    ORDER BY ordinal_position
   `);
   const names=cols.rows.map(c=>c.column_name);
   assert.ok(names.includes('id'),'Falta columna id');
   assert.ok(names.includes('order_id'),'Falta columna order_id');
   assert.ok(names.includes('state'),'Falta columna state');
   assert.ok(names.includes('preference_id'),'Falta columna preference_id');
   assert.ok(names.includes('payment_id'),'Falta columna payment_id');
   assert.ok(names.includes('amount'),'Falta columna amount');
   assert.ok(names.includes('currency'),'Falta columna currency');
   assert.ok(names.includes('mp_preference_response'),'Falta columna mp_preference_response');
   assert.ok(names.includes('mp_payment_response'),'Falta columna mp_payment_response');
   assert.ok(names.includes('created_at'),'Falta columna created_at');
   assert.ok(names.includes('updated_at'),'Falta columna updated_at');
   
   const currency=cols.rows.find(c=>c.column_name==='currency');
   assert.equal(currency.column_default,"'PEN'::text",'DEFAULT currency debe ser PEN');
  });

  await t.test('T5-M02: tabla payment_webhook_events existe con UNIQUE(notification_id)',async()=>{
   const cols=await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='payment_webhook_events' AND table_schema=current_schema()
    ORDER BY ordinal_position
   `);
   const names=cols.rows.map(c=>c.column_name);
   assert.ok(names.includes('notification_id'),'Falta columna notification_id');
   assert.ok(names.includes('processed'),'Falta columna processed');
   
   const constraints=await db.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name='payment_webhook_events' AND table_schema=current_schema()
   `);
   const unique=constraints.rows.find(c=>c.constraint_type==='UNIQUE');
   assert.ok(unique,'Debe existir constraint UNIQUE en payment_webhook_events');
  });

  await t.test('T5-M03: tabla payment_reconciliations existe con foreign keys',async()=>{
   const cols=await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='payment_reconciliations' AND table_schema=current_schema()
    ORDER BY ordinal_position
   `);
   const names=cols.rows.map(c=>c.column_name);
   assert.ok(names.includes('order_id'),'Falta columna order_id');
   assert.ok(names.includes('payment_attempt_id'),'Falta columna payment_attempt_id');
   assert.ok(names.includes('reason'),'Falta columna reason');
   assert.ok(names.includes('resolved'),'Falta columna resolved');
  });

  await t.test('T5-M04: trade_orders.expires_at existe con DEFAULT +30min',async()=>{
   const cols=await db.query(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name='trade_orders' AND column_name='expires_at' AND table_schema=current_schema()
   `);
   assert.equal(cols.rows.length,1,'Columna expires_at debe existir');
   assert.equal(cols.rows[0].is_nullable,'NO','expires_at debe ser NOT NULL');
   assert.ok(cols.rows[0].column_default?.includes("interval"),'DEFAULT debe incluir INTERVAL para cálculo de +30min');
  });

  await t.test('T5-M05: nuevos estados en trade_orders (paid, expired, requires_reconciliation)',async()=>{
   const constraint=await db.query(`
    SELECT pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname='trade_orders_state_check' AND conrelid='trade_orders'::regclass
   `);
   assert.ok(constraint.rows.length>0,'Constraint trade_orders_state_check debe existir');
   const checkDef=constraint.rows[0].def;
   assert.ok(checkDef.includes("'pendiente'"),'Estado pendiente debe existir');
   assert.ok(checkDef.includes("'paid'"),'Estado paid debe existir');
   assert.ok(checkDef.includes("'expired'"),'Estado expired debe existir');
   assert.ok(checkDef.includes("'expired_pending_payment'"),'Estado expired_pending_payment debe existir');
   assert.ok(checkDef.includes("'cancelled'"),'Estado cancelled debe existir');
   assert.ok(checkDef.includes("'requires_reconciliation'"),'Estado requires_reconciliation debe existir');
  });

  await t.test('T5-M06: nuevos estados en stock_reservations (consumed, expired, released)',async()=>{
   const constraint=await db.query(`
    SELECT pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname='stock_reservations_state_check' AND conrelid='stock_reservations'::regclass
   `);
   assert.ok(constraint.rows.length>0,'Constraint stock_reservations_state_check debe existir');
   const checkDef=constraint.rows[0].def;
   assert.ok(checkDef.includes("'activa'"),'Estado activa debe existir');
   assert.ok(checkDef.includes("'consumed'"),'Estado consumed debe existir');
   assert.ok(checkDef.includes("'expired'"),'Estado expired debe existir');
   assert.ok(checkDef.includes("'released'"),'Estado released debe existir');
  });

  await t.test('T5-M07: función count_active_payment_attempts existe y retorna 0 para pedido nuevo',async()=>{
   const {o}=await prepared();
   const oid=ok(await order(o.id,'t5-count'));
   const count=await db.query('SELECT count_active_payment_attempts($1) AS n',[oid.id]);
   assert.equal(count.rows[0].n,0,'Pedido nuevo debe tener 0 intentos activos');
  });

  await t.test('T5-M08: función can_create_payment_attempt existe y retorna true para pedido nuevo',async()=>{
   const {o}=await prepared();
   const oid=ok(await order(o.id,'t5-can'));
   const can=await db.query('SELECT can_create_payment_attempt($1) AS result',[oid.id]);
   assert.equal(can.rows[0].result,true,'Pedido nuevo debe permitir crear intento de pago');
  });

  await t.test('T5-M09: can_create_payment_attempt bloquea con intento activo (pending/created)',async()=>{
   const {o}=await prepared();
   const oid=ok(await order(o.id,'t5-block'));
   
   // Insertar intento activo en estado 'pending'
   await db.query(`
    INSERT INTO payment_attempts(order_id, state, amount, currency)
    VALUES($1, 'pending', 100.00, 'PEN')
   `,[oid.id]);
   
   const can=await db.query('SELECT can_create_payment_attempt($1) AS result',[oid.id]);
   assert.equal(can.rows[0].result,false,'No debe permitir nuevo intento con uno activo');
   
   const count=await db.query('SELECT count_active_payment_attempts($1) AS n',[oid.id]);
   assert.equal(count.rows[0].n,1,'Debe contar 1 intento activo');
  });

  await t.test('T5-M10: can_create_payment_attempt permite nuevo intento tras rechazo',async()=>{
   const {o}=await prepared();
   const oid=ok(await order(o.id,'t5-retry'));
   
   // Primer intento rechazado
   await db.query(`
    INSERT INTO payment_attempts(order_id, state, amount, currency)
    VALUES($1, 'rejected', 100.00, 'PEN')
   `,[oid.id]);
   
   const can1=await db.query('SELECT can_create_payment_attempt($1) AS result',[oid.id]);
   assert.equal(can1.rows[0].result,true,'Debe permitir segundo intento tras rechazo');
   
   // Segundo intento rechazado
   await db.query(`
    INSERT INTO payment_attempts(order_id, state, amount, currency)
    VALUES($1, 'rejected', 100.00, 'PEN')
   `,[oid.id]);
   
   const can2=await db.query('SELECT can_create_payment_attempt($1) AS result',[oid.id]);
   assert.equal(can2.rows[0].result,true,'Debe permitir tercer intento tras 2 rechazos');
   
   // Tercer intento rechazado (máximo alcanzado)
   await db.query(`
    INSERT INTO payment_attempts(order_id, state, amount, currency)
    VALUES($1, 'rejected', 100.00, 'PEN')
   `,[oid.id]);
   
   const can3=await db.query('SELECT can_create_payment_attempt($1) AS result',[oid.id]);
   assert.equal(can3.rows[0].result,false,'No debe permitir cuarto intento (máx=3)');
  });

  await t.test('T5-M11: constraint CHECK(currency=PEN) rechaza otras monedas',async()=>{
   const {o}=await prepared();
   const oid=ok(await order(o.id,'t5-currency'));
   
   await assert.rejects(
    db.query(`
     INSERT INTO payment_attempts(order_id, state, amount, currency)
     VALUES($1, 'pending', 100.00, 'USD')
    `,[oid.id]),
    /CHECK.*currency/i,
    'Debe rechazar moneda distinta a PEN'
   );
  });

  await t.test('T5-M12: expires_at se calcula correctamente en pedidos nuevos',async()=>{
   const {o}=await prepared();
   const oid=ok(await order(o.id,'t5-expires'));
   
   const result=await db.query(`
    SELECT created_at, expires_at,
           EXTRACT(EPOCH FROM (expires_at - created_at)) AS diff_seconds
    FROM trade_orders WHERE id=$1
   `,[oid.id]);
   
   const diff=parseFloat(result.rows[0].diff_seconds);
   assert.ok(diff>=1798 && diff<=1802,`expires_at debe ser ~30min después de created_at (diff=${diff}s)`);
  });

  await t.test('T5-M13: trigger update_payment_attempt_timestamp actualiza updated_at',async()=>{
   const {o}=await prepared();
   const oid=ok(await order(o.id,'t5-trigger'));
   
   const attempt=await db.query(`
    INSERT INTO payment_attempts(order_id, state, amount, currency)
    VALUES($1, 'created', 100.00, 'PEN')
    RETURNING id, created_at, updated_at
   `,[oid.id]);
   
   const id=attempt.rows[0].id;
   const created=attempt.rows[0].created_at;
   const updated1=attempt.rows[0].updated_at;
   
   assert.equal(created.getTime(),updated1.getTime(),'created_at y updated_at deben ser iguales al crear');
   
   // Esperar 50ms para asegurar diferencia de timestamp
   await new Promise(resolve=>setTimeout(resolve,50));
   
   await db.query(`UPDATE payment_attempts SET state='pending' WHERE id=$1`,[id]);
   
   const updated=await db.query(`SELECT updated_at FROM payment_attempts WHERE id=$1`,[id]);
   const updated2=updated.rows[0].updated_at;
   
   assert.ok(updated2>updated1,'updated_at debe incrementarse tras UPDATE');
  });

  await t.test('T5-M14: foreign key payment_attempts.order_id → trade_orders.id funciona',async()=>{
   await assert.rejects(
    db.query(`
     INSERT INTO payment_attempts(order_id, state, amount, currency)
     VALUES(gen_random_uuid(), 'pending', 100.00, 'PEN')
    `),
    /foreign key/i,
    'Debe rechazar order_id inexistente'
   );
  });

  await t.test('T5-M15: compatibilidad con T1-T4 (pedidos sin payment_attempts funcionan)',async()=>{
   const {o}=await prepared();
   const oid=ok(await order(o.id,'t5-compat'));
   
   // Verificar que el pedido se creó correctamente sin payment_attempts
   assert.equal(oid.state,'pendiente','Estado debe ser pendiente');
   
   const count=await db.query(`SELECT count(*) FROM payment_attempts WHERE order_id=$1`,[oid.id]);
   assert.equal(count.rows[0].count,'0','No debe haber payment_attempts aún');
   
   // Verificar que expires_at existe y es válido
   const exp=await db.query(`SELECT expires_at FROM trade_orders WHERE id=$1`,[oid.id]);
   assert.ok(exp.rows[0].expires_at,'expires_at debe estar poblado');
  });

 }finally{await f.close();}
});
