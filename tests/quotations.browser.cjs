const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium,expect}=require('@playwright/test');
const {mkdir,writeFile}=require('node:fs/promises');const {tradeFixture}=require('./trade-fixture.cjs');
test('T4 navegador: solicitud, ofertas privadas, aceptación y pedido pendiente', {timeout:120000},async t=>{
 const f=await tradeFixture();let browser;const pages=[];
 try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  const errors=[];
  async function login(who){const page=await browser.newPage({viewport:{width:1440,height:1000}});pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(f.base.replace('/api/v1/','/cuenta'));await page.getByLabel('Correo',{exact:true}).fill(f.accounts[who].email);await page.getByLabel(/^Contraseña/).fill(f.password);
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
    await expect(seller.getByRole('heading',{name:/^Responder a /})).toBeVisible();
    // La descripción libre no coincide con un producto propio: se pide elegirlo.
    await expect(seller.getByText(/No encontramos «Cuadernos para demo T4» en tu catálogo/)).toBeVisible();
    await seller.getByLabel(/^Producto que ofrecerás/).selectOption(f.products[who].id);
    await expect(seller.locator('.offer-product')).toHaveCount(0);
    await seller.getByLabel(/^Precio por .*\(S\/, IGV incluido\)/).fill('48.00');
    await seller.getByLabel(/^Costo de envío/).fill(shipping);
    // Subtotal y total se calculan en vivo antes de enviar.
    const total=(2*48+Number(shipping)).toFixed(2);
    await expect(seller.locator('.offer-subtotal strong')).toHaveText('S/ 96.00');
    await expect(seller.locator('.offer-grand-total dd')).toHaveText('S/ '+total);
    const offered=seller.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/responses'));
    await seller.getByRole('button',{name:'Enviar oferta por S/ '+total,exact:true}).click();const result=await(await offered).json();assert.equal(result.offers.length,1);offerIds.push(result.offers[0].id);
   }
   await open(buyer,q.id);
   // Cada cotización tiene su propia URL: se puede recargar o compartir dentro de la empresa.
   await expect(buyer).toHaveURL(new RegExp('/cuenta/cotizaciones/'+q.id+'$'));
   await buyer.reload();
   await expect(buyer.locator('.selected-request')).toContainText('Cuadernos para demo T4');
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
   // Con el pedido ya creado, la oferta ofrece «Ver pedido» y no deja crear otro.
   await expect(buyer.getByRole('button',{name:'Crear pedido y reservar stock',exact:true})).toHaveCount(0);
   await buyer.getByRole('button',{name:'Ver pedido',exact:true}).first().click();await expect(buyer.getByRole('heading',{name:'Pedido pendiente',exact:true})).toBeVisible();
   assert.equal((await f.db.query('SELECT stock FROM products WHERE id=$1',[f.products.vendor.id])).rows[0].stock,18);
   const seller=pages[1];await open(seller,q.id);await expect(seller.getByText('S/ 108.00',{exact:true})).toHaveCount(0);
   await mkdir('.angular/t4-evidence',{recursive:true});
   await buyer.getByRole('article',{name:'Detalle del pedido'}).screenshot({path:'.angular/t4-evidence/pedido-pendiente.png'});
   await writeFile('.angular/t4-evidence/resultado.json',JSON.stringify({browser:await browser.version(),requestId:q.id,offerIds,order,stockAfter:stock,reservations},null,2)+'\n');
   console.log('T4 navegador: pedido '+order.id+', total '+order.total+', stock 20→18, reserva activa 2.');
  });
  await t.test('oferta: el producto pedido se muestra fijo, sin desplegable, y se puede ofrecer otro',async()=>{
   const q=(await f.call('quotations','POST',{proveedorIds:[f.accounts.vendor.supplier],items:[{descripcion:'Cuaderno vendor',presentacion:'caja',unidadesPorPresentacion:12,cantidad:4}]},'buyer')).body;
   const seller=await login('vendor');await open(seller,q.id);
   const card=seller.locator('.offer-product');
   await expect(card).toContainText('Cuaderno vendor');await expect(card).toContainText('Es el producto que pidió');
   await expect(seller.getByLabel(/^Producto que ofrecerás/)).toHaveCount(0);
   await expect(seller.locator('.offer-subtotal strong')).toHaveText('S/ 192.00');
   await seller.getByRole('button',{name:/Ofrecer un producto parecido/}).click();
   await expect(seller.getByLabel(/^Producto que ofrecerás/)).toBeVisible();
   await seller.getByRole('button',{name:'Volver al producto que pidió',exact:true}).click();
   await expect(card).toBeVisible();
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
  await t.test('entrega en Ayacucho: el comprador elige cómo recibe y el proveedor de Lima ve el envío interprovincial',async()=>{
   await f.db.query(`UPDATE companies SET address='Jr. Ficticio 123',district='San Juan Bautista',province='Huamanga',department='Ayacucho' WHERE id=$1`,[f.accounts.buyer.company]);
   await f.db.query(`UPDATE companies SET address='Av. Ficticia 456',district='Ate',province='Lima',department='Lima' WHERE id=$1`,[f.accounts.vendor.company]);
   const buyer=await login('buyer');await buyer.getByRole('button',{name:'Nueva solicitud',exact:true}).click();
   await buyer.getByRole('checkbox',{name:'vendor',exact:true}).check();
   await buyer.getByLabel('Descripción',{exact:true}).fill('Cuadernos para Huamanga');
   // Se propone la dirección registrada del negocio, en una línea que se puede cambiar.
   await expect(buyer.locator('.delivery-summary')).toContainText('Jr. Ficticio 123, San Juan Bautista, Huamanga (Ayacucho)');
   await buyer.getByRole('button',{name:'Cambiar lugar de entrega',exact:true}).click();
   await expect(buyer.getByRole('radio',{name:/Envío a mi negocio/})).toBeChecked();
   await expect(buyer.getByLabel('Distrito',{exact:true})).toHaveValue('San Juan Bautista');
   await buyer.getByLabel('Referencia (opcional)',{exact:true}).fill('Puerta verde');
   const requested=buyer.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/quotations');
   await buyer.getByRole('button',{name:'Enviar solicitud',exact:true}).click();const q=await(await requested).json();
   assert.equal(q.delivery.referencia,'Puerta verde');
   const seller=await login('vendor');await open(seller,q.id);
   await expect(seller.locator('.selected-request .delivery-line')).toContainText('Jr. Ficticio 123, San Juan Bautista, Huamanga (Ayacucho)');
   await expect(seller.getByRole('note').filter({hasText:'Envío interprovincial'})).toContainText('desde Lima a Huamanga');
   // Recojo en almacén: sin dirección y sin aviso interprovincial.
   await buyer.getByRole('button',{name:'Nueva solicitud',exact:true}).click();
   await buyer.getByRole('checkbox',{name:'vendor',exact:true}).check();
   await buyer.getByLabel('Descripción',{exact:true}).fill('Recojo en almacén');
   await buyer.getByRole('button',{name:'Cambiar lugar de entrega',exact:true}).click();
   await buyer.getByText('Recojo en almacén',{exact:true}).click();
   await expect(buyer.getByLabel('Distrito',{exact:true})).toHaveCount(0);
   const second=buyer.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/quotations');
   await buyer.getByRole('button',{name:'Enviar solicitud',exact:true}).click();assert.deepEqual((await(await second).json()).delivery,{modalidad:'recojo'});
   assert.deepEqual(errors,[]);
  });
 }finally{if(browser)await browser.close();await f.close();}
});
