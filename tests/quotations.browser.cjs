const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium,expect}=require('@playwright/test');
const {mkdir,writeFile}=require('node:fs/promises');const {tradeFixture}=require('./trade-fixture.cjs');
test('T4 navegador: solicitud, ofertas privadas, aceptación y pedido pendiente', {timeout:120000},async t=>{
 const f=await tradeFixture();let browser;const pages=[];
 try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  const errors=[];
  async function login(who){const page=await browser.newPage({viewport:{width:1440,height:1000}});pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(f.base.replace('/api/v1/','/'));await page.getByLabel('Correo',{exact:true}).fill(f.accounts[who].email);await page.getByLabel(/^Contraseña/).fill(f.password);
   await page.locator('form').getByRole('button',{name:'Ingresar',exact:true}).click();await expect(page.getByRole('heading',{name:'Cotizaciones y pedidos',exact:true})).toBeVisible();return page;
  }
  async function open(page,id){await page.getByRole('button',{name:'Actualizar cotizaciones',exact:true}).click();await page.locator('[data-request-id="'+id+'"] ').getByRole('button', {name:'Ver cotización',exact:true}).click();}
  await t.test('T4-AC09/10: dos proveedores, total previo y reserva PostgreSQL comprobada',async()=>{
   const buyer=await login('buyer');await buyer.getByRole('button',{name:'Nueva solicitud',exact:true}).click();
   await buyer.getByRole('checkbox',{name:'vendor',exact:true}).check();await buyer.getByRole('checkbox',{name:'vendor2',exact:true}).check();
   await buyer.getByLabel('Descripción',{exact:true}).fill('Cuadernos para demo T4');
   const requested=buyer.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/quotations');
   await buyer.getByRole('button',{name:'Enviar solicitud',exact:true}).click();const q=await(await requested).json();assert.ok(q.id);
   const offerIds=[];
   for(const [who,shipping] of [['vendor','8.00'],['vendor2','12.00']]){
    const seller=await login(who);await open(seller,q.id);
    await expect(seller.getByRole('heading',{name:'Responder con productos propios',exact:true})).toBeVisible();
    await seller.locator('app-trade').getByRole('combobox').first().selectOption(f.products[who].id);
    await seller.getByLabel('Precio por presentación PEN (IGV incluido)',{exact:true}).fill('48.00');
    await seller.getByLabel('Envío final PEN',{exact:true}).fill(shipping);
    const offered=seller.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/responses'));
    await seller.getByRole('button',{name:'Enviar oferta',exact:true}).click();const result=await(await offered).json();assert.equal(result.offers.length,1);offerIds.push(result.offers[0].id);
   }
   await open(buyer,q.id);
   const vendorOffer=buyer.locator('.offer').filter({has:buyer.getByRole('heading',{name:'Oferta de vendor',exact:true})});
   await expect(vendorOffer.locator('.offer-total strong')).toHaveText('S/ 104.00');
   await vendorOffer.getByText('Ver detalles',{exact:true}).click();
   await expect(vendorOffer.locator('.offer-conditions dd').nth(0)).toHaveText('S/ 96.00');
   await expect(vendorOffer.locator('.offer-conditions dd').nth(1)).toHaveText('S/ 8.00');
   await vendorOffer.getByRole('button',{name:'Aceptar oferta',exact:true}).click();
   await expect(buyer.getByText('Oferta aceptada. Aceptar no reserva stock.',{exact:true})).toBeVisible();
   assert.equal((await f.db.query('SELECT stock FROM products WHERE id=$1',[f.products.vendor.id])).rows[0].stock,20);
   const ordered=buyer.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/orders');
   await buyer.getByRole('button',{name:'Crear pedido y reservar stock',exact:true}).click();const response=await ordered;assert.equal(response.status(),201);const order=await response.json();
   await expect(buyer.getByRole('heading',{name:'Pedido pendiente',exact:true})).toBeVisible();
   await expect(buyer.getByText('Reserva activa: 2 presentaciones.',{exact:true})).toBeVisible();
   const stock=(await f.db.query('SELECT stock FROM products WHERE id=$1',[f.products.vendor.id])).rows[0].stock;assert.equal(stock,18);
   const reservations=(await f.db.query('SELECT quantity,state,expires_at FROM stock_reservations WHERE order_id=$1',[order.id])).rows;
   assert.deepEqual(reservations,[{quantity:2,state:'activa',expires_at:null}]);assert.equal(order.total,'104.00');assert.equal(order.state,'pendiente');
   await buyer.getByRole('button',{name:'Crear pedido y reservar stock',exact:true}).click();await expect(buyer.getByRole('heading',{name:'Pedido pendiente',exact:true})).toBeVisible();
   assert.equal((await f.db.query('SELECT stock FROM products WHERE id=$1',[f.products.vendor.id])).rows[0].stock,18);
   const seller=pages[1];await open(seller,q.id);await expect(seller.getByText('S/ 108.00',{exact:true})).toHaveCount(0);
   await mkdir('.angular/t4-evidence',{recursive:true});
   await buyer.getByRole('article',{name:'Detalle del pedido'}).screenshot({path:'.angular/t4-evidence/pedido-pendiente.png'});
   await writeFile('.angular/t4-evidence/resultado.json',JSON.stringify({browser:await browser.version(),requestId:q.id,offerIds,order,stockAfter:stock,reservations},null,2)+'\n');
   console.log('T4 navegador: pedido '+order.id+', total '+order.total+', stock 20→18, reserva activa 2.');
  });
  await t.test('T4-AC05/06: motivo de vencimiento, stock o condiciones y nueva solicitud',async()=>{
   for(const reason of ['OFFER_EXPIRED','INSUFFICIENT_STOCK','CONDITIONS_CHANGED']){
    await f.db.query('UPDATE products SET stock=20,units_per_pack=12 WHERE id=$1',[f.products.vendor.id]);
    const q=(await f.request()).body;const o=(await f.offer(q)).body.offers[0];assert.equal((await f.accept(q,o.id)).status,200);
    if(reason==='OFFER_EXPIRED')await f.db.query("UPDATE quotation_offers SET expires_at=now()-interval '1 second' WHERE id=$1",[o.id]);
    if(reason==='INSUFFICIENT_STOCK')await f.db.query('UPDATE products SET stock=1 WHERE id=$1',[f.products.vendor.id]);
    if(reason==='CONDITIONS_CHANGED')await f.db.query('UPDATE products SET units_per_pack=24 WHERE id=$1',[f.products.vendor.id]);
    const buyer=await login('buyer');await open(buyer,q.id);await buyer.getByRole('button',{name:'Crear pedido y reservar stock',exact:true}).click();
    await expect(buyer.getByRole('status').filter({hasText:reason})).toBeVisible();
    await buyer.getByRole('button',{name:'Nueva solicitud',exact:true}).click();await expect(buyer.getByRole('heading',{name:'Nueva solicitud de cotización',exact:true})).toBeVisible();
    assert.equal((await f.db.query('SELECT count(*) FROM trade_orders WHERE offer_id=$1',[o.id])).rows[0].count,'0');
   }
   assert.deepEqual(errors,[]);
  });
 }finally{if(browser)await browser.close();await f.close();}
});
