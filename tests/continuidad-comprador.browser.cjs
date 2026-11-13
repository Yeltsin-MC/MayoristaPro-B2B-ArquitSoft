const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const { tradeFixture } = require('./trade-fixture.cjs');

test('EC12-14: sesión validada, selección visible y motivos para cotizar en escritorio y móvil', {timeout:120000}, async()=>{
 const f=await tradeFixture();let browser;
 const folder='docs/evidencias/primera-tanda-ux';const results=[];
 try{
  await f.db.query("UPDATE suppliers SET name='Oficina Central (demo)' WHERE id=$1",[f.accounts.vendor.supplier]);
  await f.db.query("UPDATE products SET name='Cuaderno A4 (demo)' WHERE id=$1",[f.products.vendor.id]);
  await mkdir(folder,{recursive:true});
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  for(const [label,width,height] of [['escritorio',1440,1000],['movil',390,844]]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(f.base.replace('/api/v1/','/'));
    await expect(page.getByLabel('Correo',{exact:true})).toBeVisible();
    await expect(page.locator('.quote-unavailable').filter({hasText:'empresa habilitada'})).toHaveCount(3);
    await page.getByRole('button',{name:'Ver otra oferta para cotizar',exact:true}).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button',{name:'Solicitar cotización',exact:false})).toBeEnabled();
    await page.keyboard.press('Escape');
    const card=page.locator('.product-card').filter({has:page.getByRole('heading',{name:'Cuaderno A4 (demo)',exact:true})});
    await card.getByRole('spinbutton').fill('4');
    await card.getByRole('button',{name:'Solicitar cotización',exact:false}).click();
    const summary=page.getByRole('complementary',{name:'Selección para cotizar',exact:true});
    await expect(summary).toContainText('Cuaderno A4 (demo)');
    await expect(summary).toContainText('Oficina Central (demo)');
    await expect(summary).toContainText('caja de 12 unidades');
    await expect(summary).toContainText('4 cajas');
    await expect(summary).toBeInViewport({ratio:1});
    await page.screenshot({path:`${folder}/ingreso-${label}.png`,mask:[page.locator('input[type=email],input[type=password]')],maskColor:'#dce2dd'});
    async function login(){
     await page.getByLabel('Correo',{exact:true}).fill(f.accounts.buyer.email);
     await page.getByLabel(/^Contraseña/).fill(f.password);
     await page.locator('form').getByRole('button',{name:'Ingresar',exact:true}).click();
     await expect(page.getByRole('button',{name:'Salir',exact:true})).toBeVisible();
    }
    await login();
    await expect(page.getByLabel('Cantidad de presentaciones',{exact:true})).toHaveValue('4');
    await expect(page.getByLabel('Descripción',{exact:true})).toHaveValue('Cuaderno A4 (demo)');
    await expect(page.getByRole('checkbox',{name:'Oficina Central (demo)',exact:true})).toBeChecked();
    const created=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/quotations');
    await page.getByRole('button',{name:'Enviar solicitud',exact:true}).click();
    const response=await created;assert.equal(response.status(),201);const quotation=await response.json();
    assert.equal(quotation.items[0].quantity,4);
    assert.equal(quotation.suppliers[0].id,f.accounts.vendor.supplier);
    await card.getByRole('spinbutton').fill('6');
    await card.getByRole('button',{name:'Solicitar cotización',exact:false}).click();
    await expect(page.getByLabel('Cantidad de presentaciones',{exact:true})).toHaveValue('6');
    await expect(page.getByLabel('Correo',{exact:true})).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button',{name:'Salir',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Abrir solicitud '+quotation.id,exact:true})).toBeVisible();
    const cookie=(await context.cookies()).find(c=>c.name==='mayoristapro_session');
    assert.ok(cookie?.httpOnly);assert.equal(cookie.sameSite,'Strict');assert.equal(cookie.expires,-1);
    const storage=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),cookies:document.cookie}));
    assert.deepEqual(storage.local,[]);assert.deepEqual(storage.session,[]);assert.ok(!storage.cookies.includes('mayoristapro_session'));
    if(label==='escritorio'){
     await f.db.query("UPDATE memberships SET permissions=ARRAY[]::text[] WHERE account_id=$1",[f.accounts.buyer.account]);
     await page.reload();await expect(page.getByRole('button',{name:'Salir',exact:true})).toBeVisible();
     await expect(page.locator('app-trade')).toHaveCount(0);
     await f.db.query("UPDATE memberships SET permissions=ARRAY['buy'] WHERE account_id=$1",[f.accounts.buyer.account]);
     await page.reload();await expect(page.locator('app-trade')).toHaveCount(1);
     await page.route('**/auth/restore',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
     await page.reload();await expect(page.getByLabel('Correo',{exact:true})).toBeVisible();
     await expect(page.locator('app-trade')).toHaveCount(0);
     await page.unroute('**/auth/restore');await page.reload();
     await expect(page.getByRole('button',{name:'Salir',exact:true})).toBeVisible();
    }
    await page.getByRole('button',{name:'Salir',exact:true}).click();
    await expect(page.getByLabel('Correo',{exact:true})).toBeVisible();
    await expect(page.locator('.quote-selection')).toHaveCount(0);
    await page.reload();await expect(page.getByLabel('Correo',{exact:true})).toBeVisible();
    await expect(page.locator('app-trade')).toHaveCount(0);
    assert.ok(!(await context.cookies()).some(c=>c.name==='mayoristapro_session'));
    await login();
    const expiring=(await context.cookies()).find(c=>c.name==='mayoristapro_session');
    await f.db.query("UPDATE identity_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[createHash('sha256').update(expiring.value).digest('hex')]);
    await page.reload();await expect(page.getByLabel('Correo',{exact:true})).toBeVisible();
    await expect(page.locator('app-trade')).toHaveCount(0);
    assert.ok(!(await context.cookies()).some(c=>c.name==='mayoristapro_session'));
    assert.deepEqual(errors,[]);
    results.push({viewport:`${width}x${height}`,selectionVisible:true,quantityAfterLogin:4,quantityAlreadyLoggedIn:6,
     liveSessionRestored:true,logoutCleared:true,expiredSessionRejected:true,serverPermissionsRechecked:true,
     persistentTokenStorage:false,disabledProductsExplained:3,functionalAlternative:true,javascriptErrors:errors});
   }finally{await context.close();}
  }
  await writeFile(folder+'/resultado.json',JSON.stringify({generatedAt:new Date().toISOString(),data:'Comprador y proveedor demo en esquema PostgreSQL aislado',results},null,2));
 }finally{if(browser)await browser.close();await f.close();}
});