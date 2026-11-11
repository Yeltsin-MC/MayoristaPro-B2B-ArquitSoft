// Opt-in local check against the existing fictitious demo provider. Unlike the
// isolated CI tests, this intentionally leaves an imported product in the demo DB.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {Pool}=require('pg');
const {readFile,mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {randomBytes}=require('node:crypto');
const ExcelJS=require('exceljs');

test('T3 cierre: proveedor demo existente descarga Excel, revisa error, confirma y publica', {timeout:120000}, async()=>{
  const email=process.env.DEMO_EMAIL??'proveedor@example.test';
  const password=process.env.DEMO_PASSWORD;
  assert.ok(password,'Configura DEMO_PASSWORD con la contraseña existente del proveedor ficticio.');
  const databaseUrl=new URL(process.env.DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(databaseUrl.hostname),'Solo se permite una base de desarrollo local.');
  require('reflect-metadata');
  const {NestFactory}=require('@nestjs/core');
  const {CatalogModule}=require('../apps/api/dist/catalog/catalog.module.js');
  const db=new Pool({connectionString:process.env.DATABASE_URL});
  const artifactDir=resolve(__dirname,'../.angular/t3-demo-evidence');
  let app,browser;
  try{
    const demo=(await db.query(`SELECT c.supplier_id,c.ruc FROM accounts a
      JOIN memberships m ON m.account_id=a.id JOIN companies c ON c.id=m.company_id
      JOIN suppliers s ON s.id=c.supplier_id
      WHERE a.email=$1 AND NOT a.platform_admin AND m.active AND c.status='enabled'
      AND s.verified AND 'publish'=ANY(m.permissions)`,[email])).rows[0];
    assert.ok(demo,'La cuenta debe ser un proveedor habilitado, verificado y con publish.');
    assert.equal(demo.ruc,'20999999991','Esta prueba solo modifica la empresa ficticia creada para la demo.');
    await mkdir(artifactDir,{recursive:true});
    const sku='T3-CIERRE-'+randomBytes(5).toString('hex').toUpperCase();
    const name='Cuaderno demo cierre T3 '+sku.slice(-6);
    app=await NestFactory.create(CatalogModule,{logger:false,abortOnError:false});
    app.setGlobalPrefix('api/v1');app.useStaticAssets(resolve(__dirname,'../apps/web/dist/catalog/browser'));
    await app.listen(0,'127.0.0.1');
    const base=await app.getUrl();
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+new URL(response.url()).pathname);});
    await page.goto(base);
    await page.getByLabel('Correo',{exact:true}).fill(email);
    await page.getByLabel(/^Contraseña/).fill(password);
    await page.locator('form').getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Carga masiva del catálogo',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Solicitudes (administración)',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Publicar producto',exact:true})).toBeVisible();

    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('link',{name:'Plantilla Excel',exact:true}).click();
    const download=await downloadPromise;
    assert.equal(download.suggestedFilename(),'catalogo.xlsx');
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await readFile(await download.path()));
    const sheet=workbook.worksheets[0];
    const headers=sheet.getRow(1).values.slice(1);
    const values={sku,nombre:name,categoria:'Papelería',presentacion:'caja',unidades_por_presentacion:12,
      precio:'abc',moneda:'PEN',incluye_igv:'true',minimo:2,multiplo:1,stock:20,publicado:'true'};
    async function upload(){
      headers.forEach((column,index)=>{sheet.getRow(2).getCell(index+1).value=values[column];});
      await page.getByLabel('Archivo del catálogo').setInputFiles({name:'catalogo-demo.xlsx',
        mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await workbook.xlsx.writeBuffer())});
      await page.getByRole('button',{name:'Cargar y revisar lote',exact:true}).click();
    }
    await upload();
    const invalidRow=page.getByRole('row').filter({has:page.getByRole('cell',{name:sku,exact:true})});
    await expect(invalidRow.getByRole('cell',{name:'2',exact:true})).toBeVisible();
    await expect(invalidRow.getByText(/precio: Precio positivo por presentación/)).toBeVisible();
    await expect(page.getByRole('button',{name:'Confirmar lote completo',exact:true})).toHaveCount(0);
    assert.equal((await db.query('SELECT count(*) FROM products WHERE supplier_id=$1 AND sku=$2',[demo.supplier_id,sku])).rows[0].count,'0');
    await page.screenshot({path:resolve(artifactDir,'01-error-precio.png'),fullPage:true});
    values.precio='48.00';await upload();
    await expect(page.getByRole('button',{name:'Confirmar lote completo',exact:true})).toBeVisible();
    const catalogReload=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/products'&&response.status()===200);
    await page.getByRole('button',{name:'Confirmar lote completo',exact:true}).click();
    await expect(page.getByText(/Lote aplicado: 1 altas y 0 actualizaciones/)).toBeVisible();
    await catalogReload;
    await page.screenshot({path:resolve(artifactDir,'02-lote-aplicado.png'),fullPage:true});
    const publicCount=Number((await db.query('SELECT count(*) FROM products p JOIN suppliers s ON s.id=p.supplier_id WHERE p.published AND s.verified')).rows[0].count);
    for(let n=1;await page.getByRole('heading',{name,exact:true}).count()===0&&n<Math.ceil(publicCount/20);n++){
      await page.getByRole('button',{name:'Siguiente',exact:true}).click();
      await expect(page.getByText('Página '+(n+1),{exact:true})).toBeVisible();
    }
    await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
    await page.getByRole('heading',{name,exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(artifactDir,'03-catalogo-publicado.png'),fullPage:true});
    const product=(await db.query('SELECT id,sku,name,price,stock,published FROM products WHERE supplier_id=$1 AND sku=$2',[demo.supplier_id,sku])).rows[0];
    assert.equal(product.price,'48.00');assert.equal(product.stock,20);assert.equal(product.published,true);
    assert.deepEqual(errors,[]);
    const result={account:email,browser:await browser.version(),template:download.suggestedFilename(),
      invalidPrice:'abc',errorRow:2,confirmedPrice:'48.00',product,consoleErrors:errors,controls:{administration:false,publish:true}};
    await writeFile(resolve(artifactDir,'resultado.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
    await page.getByRole('button',{name:'Salir',exact:true}).click();
    await expect(page.getByLabel('Correo',{exact:true})).toBeVisible();
  }finally{if(browser)await browser.close();if(app)await app.close();await db.end();}
});
