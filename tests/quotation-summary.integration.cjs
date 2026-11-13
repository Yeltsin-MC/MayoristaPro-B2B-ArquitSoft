const {test}=require('node:test');
const assert=require('node:assert/strict');
const {tradeFixture}=require('./trade-fixture.cjs');
test('UX cotizaciones: resumen comprensible sin filtrar ofertas de otra empresa', async t=>{
 const f=await tradeFixture();
 try{
  const q=(await f.request()).body;
  await t.test('producto principal y cero ofertas para el comprador autorizado',async()=>{
   const rows=(await f.call('quotations')).body;
   const row=rows.find(r=>r.id===q.id);assert.equal(row.primaryProduct,q.items[0].description);assert.equal(row.offerCount,0);
   assert.deepEqual((await f.call('quotations','GET',undefined,'buyer2')).body,[]);
   assert.deepEqual((await f.call('quotations','GET',undefined,'outsider')).body,[]);
  });
  const first=(await f.offer(q,'vendor')).body.offers[0];
  await f.offer(q,'vendor2');
  await t.test('el comprador cuenta ambas ofertas; cada proveedor cuenta únicamente la propia',async()=>{
   assert.equal((await f.call('quotations')).body.find(r=>r.id===q.id).offerCount,2);
   for(const who of ['vendor','vendor2'])assert.equal((await f.call('quotations','GET',undefined,who)).body.find(r=>r.id===q.id).offerCount,1);
   assert.deepEqual((await f.call('quotations','GET',undefined,'pending')).body,[]);
  });
  await t.test('la aceptación conserva el estado y la privacidad del resumen',async()=>{
   assert.equal((await f.accept(q,first.id)).status,200);
   const row=(await f.call('quotations')).body.find(r=>r.id===q.id);assert.equal(row.status,'aceptada');assert.equal(row.offerCount,2);
   const vendor=(await f.call('quotations','GET',undefined,'vendor2')).body.find(r=>r.id===q.id);assert.equal(vendor.offerCount,1);
   assert.equal(vendor.acceptedOfferId,undefined);
  });
 }finally{await f.close();}
});
