const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {mkdir,writeFile}=require('node:fs/promises');
const {chromium,expect}=require('@playwright/test');
const {loadDemo,demoDatabaseUrl,withDemoApi,apiCall,manifest}=require('../database/demo/load.cjs');
const {comparison}=require('../database/demo/quote.cjs');

test('UX comprador: papel A4, cantidad, ingreso, envío y comparación compacta en escritorio/móvil', {timeout:120000},async()=>{
 const schema='demo_mayoristapro150_test_ux_'+randomBytes(5).toString('hex');
 const config={source:process.env.DATABASE_URL,schema,adminEmail:'admin-demo150@example.test',adminPassword:randomBytes(24).toString('hex'),demoPassword:randomBytes(24).toString('hex')};
 const folder='docs/evidencias/cotizacion-simple';const results=[];let browser;
 try{
  await loadDemo(config);await mkdir(folder,{recursive:true});
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  await withDemoApi(demoDatabaseUrl(config.source,schema),async base=>{
   const scenario=await comparison(base,config);
   for(const [label,width,height] of [['escritorio',1440,1000],['movil',390,844]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
     await page.goto(base.replace('/api/v1/','/'));
     await page.getByLabel('Buscar productos',{exact:true}).fill('Papel A4');
     await page.getByRole('button',{name:'Buscar',exact:false}).first().click();
     await expect(page.locator('.product-card')).toHaveCount(2);
     const card=page.locator('.product-card').filter({hasText:manifest.providers[1].name});
     await card.getByRole('spinbutton').fill('4');
     await card.getByRole('button',{name:'Solicitar cotización',exact:false}).click();
     await expect(page.getByRole('complementary',{name:'Selección para cotizar'})).toContainText('4 cajas');
     await page.getByLabel('Correo',{exact:true}).fill(manifest.buyer.email);
     await page.getByLabel(/^Contraseña/).fill(config.demoPassword);
     await page.locator('form').getByRole('button',{name:'Ingresar',exact:true}).click();
     const form=page.locator('.compact-quotation');const quantity=form.getByLabel('Cantidad de presentaciones',{exact:true});
     await expect(quantity).toHaveValue('4');
     await expect(form.locator('.quotation-product')).toContainText(manifest.comparison.description);
     await expect(form.locator('.quotation-product')).toContainText(manifest.providers[1].name);
     await expect(form.locator('.quotation-product')).toContainText('caja de 5 resmas');
     await expect(form.locator('input')).toHaveCount(1);
     await expect(form.locator('.quantity-equivalence')).toHaveText('4 cajas = 20 resmas');
     const send=form.getByRole('button',{name:'Enviar solicitud',exact:true});
     await quantity.fill('1');await expect(form.locator('.quantity-error')).toContainText('mínimo de compra es 2 cajas');await expect(send).toBeDisabled();
     await expect(quantity).toHaveAttribute('aria-invalid','true');
     await form.screenshot({path:folder+'/cantidad-invalida-'+label+'.png'});
     await quantity.fill('3');await expect(form.locator('.quantity-error')).toContainText('múltiplo de 2 cajas');await expect(send).toBeDisabled();
     await quantity.fill('42');await expect(form.locator('.quantity-error')).toContainText('Solo hay 40 cajas');await expect(send).toBeDisabled();
     await quantity.fill('2');await expect(send).toBeEnabled();
     await form.screenshot({path:folder+'/formulario-'+label+'.png'});
     await form.getByRole('button',{name:'Añadir otro proveedor',exact:true}).click();
     await expect(form.getByRole('checkbox',{name:manifest.providers[1].name,exact:true})).toBeChecked();
     await expect(form.getByRole('checkbox',{name:manifest.providers[1].name,exact:true})).toBeDisabled();
     await form.getByRole('checkbox',{name:manifest.providers[0].name,exact:true}).check();
     const sent=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/quotations');
     await send.click();const response=await sent;assert.equal(response.status(),201);const request=await response.json();
     assert.equal(request.items[0].description,manifest.comparison.description);assert.equal(request.items[0].quantity,2);assert.equal(request.suppliers.length,2);
     await expect(page.locator('.request-success')).toContainText('Solicitud enviada');
     await page.locator('.request-success').screenshot({path:folder+'/confirmacion-'+label+'.png'});
     await page.getByRole('button',{name:'Ir a Mis cotizaciones',exact:true}).click();
     const row=page.locator('[data-request-id="'+request.id+'"]');
     await expect(row).toContainText('Papel A4');await expect(row).toContainText('Esperando ofertas');await expect(row).not.toContainText(request.id);
     await row.getByRole('button',{name:'Ver cotización',exact:true}).click();
     await expect(page.locator('.selected-request')).toContainText('cantidad 2');
     const compared=page.locator('[data-request-id="'+scenario.detail.id+'"]');await expect(compared).toContainText('2 ofertas recibidas');
     await compared.getByRole('button',{name:'Ver cotización',exact:true}).click();
     await expect(page.locator('.offer')).toHaveCount(2);
     for(const offer of scenario.detail.offers){
      const article=page.locator('.offer').filter({has:page.getByRole('heading',{name:'Oferta de '+offer.supplierName,exact:true})});
      await expect(article.locator('.offer-total')).toContainText('S/ '+offer.total);
      await expect(article.locator('.offer-delivery')).toContainText(offer.deliveryDays+' días');
      await expect(article.locator('.offer-conditions')).not.toBeVisible();
      await article.getByText('Ver detalles',{exact:true}).click();
      await expect(article.locator('.offer-conditions')).toContainText('Vigente hasta');
      await expect(article.locator('.offer-conditions')).toContainText('S/ '+offer.shipping);
      await article.getByText('Ver detalles',{exact:true}).click();
      await expect(article.getByRole('button',{name:'Aceptar oferta',exact:true})).toBeEnabled();
     }
     await page.locator('.offers-grid').screenshot({path:folder+'/comparacion-'+label+'.png'});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
     // Ya autenticado: una segunda selección abre de nuevo el mismo formulario compacto.
     await page.locator('.header-nav').getByRole('link',{name:'Catálogo',exact:true}).click();
     await card.getByRole('spinbutton').fill('6');await card.getByRole('button',{name:'Solicitar cotización',exact:false}).click();
     await expect(page.locator('.compact-quotation').getByLabel('Cantidad de presentaciones',{exact:true})).toHaveValue('6');
     await expect(page.getByRole('button',{name:'Salir',exact:true})).toBeVisible();await expect(page.locator('.auth-layout')).toHaveCount(0);
     await page.locator('app-trade').getByRole('button',{name:'Mis pedidos',exact:true}).click();await expect(page.getByRole('heading',{name:'Mis pedidos',exact:true})).toBeVisible();
     await page.getByRole('button',{name:'Nueva solicitud',exact:true}).click();await expect(page.getByLabel('Descripción',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'Añadir ítem',exact:true})).toBeVisible();
     assert.deepEqual(errors,[]);
     results.push({viewport:label,width,height,preservedQuantity:4,invalidMinimum:true,invalidMultiple:true,invalidStock:true,submittedQuantity:2,recipients:2,confirmation:true,status:'Esperando ofertas',comparisonTotals:['187.80','180.00'],deliveryDays:[2,5],detailsAccessible:true,authenticatedSelection:6,fullNewRequest:true,pageErrors:errors});
    }finally{await context.close();}
   }
  });
  await writeFile(folder+'/resultado.json',JSON.stringify({date:new Date().toISOString(),results},null,2)+'\n');
 }finally{
  if(browser)await browser.close();
  const root=new Pool({connectionString:config.source});try{assert.match(schema,/^demo_mayoristapro150_test_ux_[a-f0-9]+$/);await root.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');}finally{await root.end();}
 }
});
