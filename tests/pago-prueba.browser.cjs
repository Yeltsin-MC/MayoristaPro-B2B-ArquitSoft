const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium,expect}=require('@playwright/test');
const {tradeFixture}=require('./trade-fixture.cjs');

// Pago simulado estilo Perú (sin MP_ACCESS_TOKEN): Yape, PagoEfectivo con CIP, rechazo y orden de compra con IGV.
test('Pago de prueba: Yape y PagoEfectivo pagan el pedido y la orden de compra desglosa el IGV',{timeout:120000},async t=>{
 const f=await tradeFixture();let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  const errors=[];
  async function pendingOrder(){
   const q=(await f.request()).body;const offer=(await f.offer(q)).body.offers[0];
   assert.equal((await f.accept(q,offer.id)).status,200);const o=await f.order(offer.id);assert.equal(o.status,201);return o.body;
  }
  async function buyerPage(orderId){
   const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
   await page.goto(f.base.replace('/api/v1/','/cuenta'));await page.getByLabel('Correo',{exact:true}).fill(f.accounts.buyer.email);
   await page.getByLabel(/^Contraseña/).fill(f.password);await page.locator('form').getByRole('button',{name:'Ingresar',exact:true}).click();
   await expect(page.getByRole('button',{name:'Salir',exact:true})).toBeVisible();
   await page.goto(f.base.replace('/api/v1/','/cuenta/pedidos/'+orderId));return page;
  }
  await t.test('Yape: el botón Pagar abre el pago de prueba y el pedido queda pagado',async()=>{
   const order=await pendingOrder();const page=await buyerPage(order.id);
   await page.getByRole('button',{name:'Pagar S/ '+order.total,exact:true}).click();
   await expect(page).toHaveURL(/\/pago-de-prueba\//);
   await expect(page.getByText('Pago de prueba: no se cobra dinero real.')).toBeVisible();
   await expect(page.locator('.sim-amount')).toHaveText('S/ '+order.total);
   await page.getByRole('radio',{name:/Yape/}).click();
   await page.getByRole('button',{name:'Yapear S/ '+order.total,exact:true}).click();
   await expect(page.getByRole('heading',{name:'¡Pago aprobado!',exact:true})).toBeVisible();
   assert.equal((await f.db.query('SELECT state FROM trade_orders WHERE id=$1',[order.id])).rows[0].state,'paid');
   assert.equal((await f.db.query("SELECT count(*)::int AS n FROM stock_reservations WHERE order_id=$1 AND state='consumed'",[order.id])).rows[0].n>0,true);
   // Orden de compra con IGV desglosado (precios con IGV incluido).
   await page.getByRole('link',{name:'Ver mi pedido',exact:true}).click();
   await page.getByRole('button',{name:/Orden de compra \(PDF\)/}).click();
   await expect(page.getByRole('heading',{name:'ORDEN DE COMPRA',exact:true})).toBeVisible();
   const total=Math.round(Number(order.total)*100);const base=Math.round(total/1.18);
   const fmt=c=>(c/100).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
   await expect(page.locator('.po-grand-total dd')).toHaveText('S/ '+fmt(total));
   await expect(page.locator('.po-totals')).toContainText('S/ '+fmt(total-base));
   await expect(page.locator('.po-parties')).toContainText('RUC');
   await expect(page.getByRole('button',{name:/Descargar PDF/})).toBeVisible();
   await page.close();
  });
  await t.test('PagoEfectivo: genera CIP (pago pendiente) y luego se paga en agente',async()=>{
   const order=await pendingOrder();const page=await buyerPage(order.id);
   await page.getByRole('button',{name:'Pagar S/ '+order.total,exact:true}).click();
   await page.getByRole('radio',{name:/PagoEfectivo/}).click();
   await page.getByRole('button',{name:'Generar código CIP',exact:true}).click();
   await expect(page.locator('.sim-cip')).toHaveText(/^\d{8}$/);
   assert.equal((await f.db.query('SELECT state FROM payment_attempts WHERE order_id=$1',[order.id])).rows[0].state,'pending');
   assert.equal((await f.db.query('SELECT state FROM trade_orders WHERE id=$1',[order.id])).rows[0].state,'pendiente');
   await page.getByRole('button',{name:'Simular pago en agente',exact:true}).click();
   await expect(page.getByRole('heading',{name:'¡Pago aprobado!',exact:true})).toBeVisible();
   assert.equal((await f.db.query('SELECT state FROM trade_orders WHERE id=$1',[order.id])).rows[0].state,'paid');
   await page.close();
  });
  await t.test('rechazo, intento ajeno y entradas inválidas',async()=>{
   const order=await pendingOrder();
   const attempt=(await f.call('orders/'+order.id+'/payment-attempts','POST',{})).body;
   assert.equal(attempt.init_point,'/pago-de-prueba/'+attempt.attempt_id);
   assert.equal((await f.call('payments/simulated/'+attempt.attempt_id,'GET',undefined,'buyer2')).status,404);
   assert.equal((await f.call('payments/simulated/'+attempt.attempt_id,'POST',{accion:'aprobar',medio:'bitcoin'})).status,422);
   assert.equal((await f.call('payments/simulated/'+attempt.attempt_id,'POST',{accion:'generar-cip',medio:'yape'})).status,422);
   const rejected=await f.call('payments/simulated/'+attempt.attempt_id,'POST',{accion:'rechazar',medio:'tarjeta'});
   assert.equal(rejected.status,201);assert.equal(rejected.body.state,'rejected');
   assert.equal((await f.call('payments/simulated/'+attempt.attempt_id,'POST',{accion:'aprobar',medio:'tarjeta'})).status,422);
   assert.equal((await f.db.query('SELECT state FROM trade_orders WHERE id=$1',[order.id])).rows[0].state,'pendiente');
  });
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await f.close();}
});
