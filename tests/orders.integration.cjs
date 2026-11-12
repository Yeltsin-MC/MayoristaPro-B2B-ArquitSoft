const {test}=require('node:test');const assert=require('node:assert/strict');const {tradeFixture}=require('./trade-fixture.cjs');
test('T4 PostgreSQL: cotizaciones, pedidos y reservas',async t=>{
 const f=await tradeFixture();const {db,accounts,products,call,request,offer,accept,order}=f;
 const ok=(r,status=201)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 async function prepared(who='buyer',quantity=2,vendor='vendor'){
  const q=ok(await request(who,quantity,[vendor]));const response=ok(await offer(q,vendor));const o=response.offers[0];ok(await accept(q,o.id,who),200);return {q,o};
 }
 try{
  let q,one,two;
  await t.test('T4-AC01/02: permisos, destinatarios, productos propios y privacidad',async()=>{
   assert.equal((await request('vendor')).status,403);assert.equal((await call('quotations','POST',{},null)).status,422);
   q=ok(await request());assert.equal(q.suppliers.length,2);
   assert.equal((await call('quotations/'+q.id,'GET',undefined,'buyer2')).status,404);
   assert.equal((await offer(q,'outsider')).status,404);assert.equal((await offer(q,'pending')).status,403);
   const own=f.draft(q);own.items[0].productoId=products.vendor2.id;
   assert.equal((await call('quotations/'+q.id+'/responses','POST',own,'vendor')).status,422);
   one=ok(await offer(q)).offers[0];two=ok(await offer(q,'vendor2',{costoEnvio:'0.00'})).offers[0];
   const buyer=ok(await call('quotations/'+q.id),200);assert.equal(buyer.offers.length,2);
   const seller=ok(await call('quotations/'+q.id,'GET',undefined,'vendor'),200);
   assert.equal(seller.offers.length,1);assert.ok(!JSON.stringify(seller).includes(two.id));assert.equal(seller.suppliers.length,1);
   const pub=ok(await call('products?limit=100','GET',undefined,null),200);assert.ok(!JSON.stringify(pub).includes(one.id));
   await db.query('UPDATE memberships SET active=false WHERE account_id=$1',[accounts.vendor2.account]);
   assert.equal((await call('quotations/'+q.id,'GET',undefined,'vendor2')).status,403);
   await db.query('UPDATE memberships SET active=true WHERE account_id=$1',[accounts.vendor2.account]);
  });
  let winner;
  await t.test('T4-AC03: aceptación concurrente con cuentas distintas y stock intacto',async()=>{
   // Both connections must wait on a held request lock, then race after release.
   const blocker=await db.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM quotation_requests WHERE id=$1 FOR UPDATE',[q.id]);
   let pending;try{pending=[accept(q,one.id),accept(q,two.id,'buyerPeer')];await f.contention();}finally{await blocker.query('COMMIT');blocker.release();}
   const results=await Promise.all(pending);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
   winner=results.find(r=>r.status===200).body.acceptedOfferId;
   const loser=winner===one.id?'vendor2':'vendor';
   assert.ok(!JSON.stringify(ok(await call('quotations/'+q.id,'GET',undefined,loser),200)).includes(winner));
   ok(await accept(q,winner),200);assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id])).rows[0].stock,20);
   assert.equal((await db.query('SELECT count(*) FROM stock_reservations')).rows[0].count,'0');
  });
  let firstOrder;
  await t.test('T4-AC04/09: pedido repetible, importes históricos y una sola reserva',async()=>{
   const r=await Promise.all([order(winner,'same'),order(winner,'same','buyerPeer')]);firstOrder=ok(r[0]);assert.equal(ok(r[1]).id,firstOrder.id);
   assert.equal(ok(await order(winner,'another')).id,firstOrder.id);assert.equal(firstOrder.state,'pendiente');assert.equal(firstOrder.reservations[0].state,'activa');
   const chosen=winner===one.id?one:two;assert.equal(firstOrder.total,chosen.total);assert.equal(firstOrder.shipping,chosen.shipping);
   assert.equal((await db.query('SELECT count(*) FROM trade_orders WHERE offer_id=$1',[winner])).rows[0].count,'1');
   const other=await prepared();assert.equal((await order(other.o.id,'same')).body.code,'IDEMPOTENCY_CONFLICT');
   const distinct=await prepared();const aliases=await Promise.all([order(distinct.o.id,'distinct-a'),order(distinct.o.id,'distinct-b','buyerPeer')]);
   assert.equal(ok(aliases[0]).id,ok(aliases[1]).id);
   await db.query("UPDATE quotation_offers SET expires_at=now()-interval '1 second' WHERE id=$1",[winner]);
   assert.equal(ok(await order(winner,'same')).id,firstOrder.id);
   assert.equal((await order(winner,'x','buyer2')).status,404);
   assert.equal((await call('orders/'+firstOrder.id,'GET',undefined,'outsider')).status,404);
  });
  await t.test('T4-AC05: oferta vencida no genera pedido, reserva ni descuento',async()=>{
   const expiredRequest=ok(await request());const expiredOffer=ok(await offer(expiredRequest)).offers[0];
   await db.query("UPDATE quotation_offers SET expires_at=now()-interval '1 second' WHERE id=$1",[expiredOffer.id]);
   assert.equal((await accept(expiredRequest,expiredOffer.id)).body.code,'OFFER_EXPIRED');
   const {o}=await prepared();const before=(await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id])).rows[0].stock;
   await db.query("UPDATE quotation_offers SET expires_at=now()-interval '1 second' WHERE id=$1",[o.id]);
   const r=await order(o.id);assert.equal(r.status,409);assert.equal(r.body.code,'OFFER_EXPIRED');assert.match(r.body.message,/nueva solicitud/);
   assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id])).rows[0].stock,before);
   assert.equal((await db.query('SELECT count(*) FROM trade_orders WHERE offer_id=$1',[o.id])).rows[0].count,'0');
  });
  await t.test('T4-AC06: cantidades, presentación, cambios incompatibles y stock',async()=>{
   const req=ok(await request('buyer',1));assert.equal((await offer(req)).status,422);
   await db.query('UPDATE products SET multiple=2 WHERE id=$1',[products.vendor.id]);
   const badMultiple=ok(await request('buyer',3));assert.equal((await offer(badMultiple)).status,422);
   await db.query('UPDATE products SET multiple=1 WHERE id=$1',[products.vendor.id]);
   const {o}=await prepared();await db.query('UPDATE products SET units_per_pack=24 WHERE id=$1',[products.vendor.id]);
   assert.equal((await order(o.id)).body.code,'CONDITIONS_CHANGED');await db.query('UPDATE products SET units_per_pack=12 WHERE id=$1',[products.vendor.id]);
   const short=await prepared();await db.query('UPDATE products SET stock=1 WHERE id=$1',[products.vendor.id]);
   assert.equal((await order(short.o.id)).body.code,'INSUFFICIENT_STOCK');await db.query('UPDATE products SET stock=20 WHERE id=$1',[products.vendor.id]);
   const change=await prepared();await db.query('UPDATE products SET price=99 WHERE id=$1',[products.vendor.id]);
   const historical=ok(await order(change.o.id));assert.equal(historical.items[0].unitPrice,'48.00');
  });
  await t.test('T4-AC07: dos compradores compiten por stock 5 solicitando 4 cada uno',async()=>{
   await db.query('UPDATE products SET stock=5 WHERE id=$1',[products.vendor.id]);
   const a=await prepared('buyer',4),b=await prepared('buyer2',4);
   const blocker=await db.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM products WHERE id=$1 FOR UPDATE',[products.vendor.id]);
   let pending;try{pending=[order(a.o.id,'race-a'),order(b.o.id,'race-b','buyer2')];await f.contention();}finally{await blocker.query('COMMIT');blocker.release();}
   const results=await Promise.all(pending);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(results.find(r=>r.status===409).body.code,'INSUFFICIENT_STOCK');
   assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id])).rows[0].stock,1);
   const reservations=await db.query('SELECT sum(r.quantity)::text AS n FROM stock_reservations r JOIN trade_orders o ON o.id=r.order_id WHERE o.offer_id=ANY($1::uuid[])',[[a.o.id,b.o.id]]);assert.equal(reservations.rows[0].n,'4');
   await db.query('UPDATE products SET stock=20 WHERE id=$1',[products.vendor.id]);
  });
  await t.test('T4-AC08: fallo SQL después del descuento revierte toda la transacción',async()=>{
   const {o}=await prepared();const before=(await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id])).rows[0].stock;
   const counts=async()=>{const out={};for(const table of ['trade_orders','trade_order_items','stock_reservations','order_keys','identity_audit'])out[table]=(await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count;return out;};
   const baseline=await counts();await db.query('ALTER TABLE trade_order_items ADD CONSTRAINT injected_failure CHECK(quantity<>2) NOT VALID');
   try{assert.equal((await order(o.id,'rollback')).status,500);assert.deepEqual(await counts(),baseline);assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id])).rows[0].stock,before);}
   finally{await db.query('ALTER TABLE trade_order_items DROP CONSTRAINT injected_failure');}
   assert.equal(ok(await order(o.id,'rollback')).state,'pendiente');
  });
  await t.test('T4-AC11: reimportación T3 preserva stock reservado',async()=>{
   const before=(await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id])).rows[0].stock;
   const csv='sku,nombre,categoria,presentacion,unidades_por_presentacion,precio,moneda,incluye_igv,minimo,multiplo,stock,publicado\nCAJA,Cuaderno actualizado,Papeleria,caja,12,48.00,PEN,true,2,1,999,true\n';
   const form=new FormData();form.append('file',new Blob([csv]),'catalogo.csv');
   const p=await fetch(f.base+'products/imports/preview',{method:'POST',headers:{Authorization:'Bearer '+accounts.vendor.token},body:form});assert.equal(p.status,201);const batch=await p.json();
   ok(await call('products/imports/'+batch.id+'/confirm','POST',{previewHash:batch.previewHash},'vendor',{'Idempotency-Key':'after-reserve'}));
   assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[products.vendor.id])).rows[0].stock,before);
  });
 }finally{await f.close();}
});
