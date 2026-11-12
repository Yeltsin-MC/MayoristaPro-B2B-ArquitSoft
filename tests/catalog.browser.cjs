const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { Pool } = require('pg');
const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const ExcelJS = require('exceljs');

test('T3: controles por rol y recorrido Angular/Excel/PostgreSQL en navegador', {timeout:120000}, async t => {
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { CatalogModule } = require('../apps/api/dist/catalog/catalog.module.js');
  const { passwordHash } = require('../apps/api/dist/identity/identity.service.js');
  const { COLUMNS } = require('../apps/api/dist/catalog/application/import-file.js');
  const original = process.env.DATABASE_URL;
  const root = new Pool({connectionString:original});
  const schema = 't3_browser_' + randomBytes(8).toString('hex');
  const password = 'Browser-demo-ficticia-2026!';
  let db, app, browser;
  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(original);url.searchParams.set('options',`-c search_path=${schema},public`);
    process.env.DATABASE_URL = url.toString();
    db = new Pool({connectionString:process.env.DATABASE_URL});
    for (const file of ['database/migrations/001_catalog.sql','database/migrations/002_identity.sql',
      'database/migrations/003_catalog_imports.sql','database/migrations/004_trade.sql','database/seed.sql']) await db.query(await readFile(file,'utf8'));
    const hash = await passwordHash(password);
    await db.query("INSERT INTO accounts(email,password_hash,platform_admin) VALUES('admin@browser.test',$1,true)",[hash]);
    for (const [i,name] of ['verified','pending','reader'].entries()) {
      const supplier = (await db.query('INSERT INTO suppliers(code,name,verified) VALUES($1,$1,$2) RETURNING id',
        [name,name!=='pending'])).rows[0].id;
      const company = (await db.query("INSERT INTO companies(ruc,legal_name,status,supplier_id,review_label) VALUES($1,$2,'enabled',$3,'revisado manualmente') RETURNING id",
        ['2088888888'+i,name,supplier])).rows[0].id;
      const account = (await db.query('INSERT INTO accounts(email,password_hash) VALUES($1,$2) RETURNING id',[name+'@browser.test',hash])).rows[0].id;
      await db.query('INSERT INTO memberships(company_id,account_id,permissions) VALUES($1,$2,$3)',
        [company,account,name==='reader'?['buy']:['buy','publish']]);
    }
    app = await NestFactory.create(CatalogModule,{logger:false,abortOnError:false});
    app.setGlobalPrefix('api/v1');app.useStaticAssets(resolve(__dirname,'../apps/web/dist/catalog/browser'));
    await app.listen(0,'127.0.0.1');
    const base = await app.getUrl();
    browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
    console.log('Navegador de prueba: '+await browser.version());

    async function withAccount(name, check) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [], denied = [];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.status()===403)denied.push(new URL(response.url()).pathname);});
      try {
        await page.goto(base);
        await page.getByLabel('Correo',{exact:true}).fill(name+'@browser.test');
        await page.getByLabel(/^Contraseña/).fill(password);
        await page.locator('form').getByRole('button',{name:'Ingresar',exact:true}).click();
        await expect(page.getByRole('button',{name:'Salir',exact:true})).toBeVisible();
        await check(page);
        assert.deepEqual(errors,[],'No debe haber errores JavaScript en Angular.');
        assert.deepEqual(denied,[],'La pantalla no debe consultar funciones ajenas al rol.');
      } finally {await context.close();}
    }

    await t.test('administrador ve solicitudes sin requerir vinculación empresarial',async()=>{
      await withAccount('admin',async page=>{
        await expect(page.getByRole('button',{name:'Solicitudes (administración)',exact:true})).toBeVisible();
        await expect(page.getByRole('button',{name:'Mi empresa',exact:true})).toHaveCount(0);
        await page.getByRole('button',{name:'Solicitudes (administración)',exact:true}).click();
        await expect(page.getByRole('button',{name:'Verificar proveedor por separado',exact:true})).toBeVisible();
      });
    });
    await t.test('proveedor pendiente no ve administración, publicación ni carga masiva',async()=>{
      await withAccount('pending',async page=>{
        await expect(page.getByText(/La carga masiva y la publicación requieren/)).toBeVisible();
        await expect(page.getByRole('button',{name:'Solicitudes (administración)',exact:true})).toHaveCount(0);
        await expect(page.getByRole('button',{name:'Publicar producto',exact:true})).toHaveCount(0);
        await expect(page.getByRole('heading',{name:'Carga masiva del catálogo',exact:true})).toHaveCount(0);
      });
    });
    await t.test('usuario sin publish tampoco ve controles de publicación',async()=>{
      await withAccount('reader',async page=>{
        await expect(page.getByRole('heading',{name:'reader',exact:true})).toBeVisible();
        await expect(page.getByRole('button',{name:'Solicitudes (administración)',exact:true})).toHaveCount(0);
        await expect(page.getByRole('button',{name:'Publicar producto',exact:true})).toHaveCount(0);
        await expect(page.getByRole('heading',{name:'Carga masiva del catálogo',exact:true})).toHaveCount(0);
      });
    });
    await t.test('proveedor verificado: ingresar, subir Excel inválido, corregir, confirmar y ver publicación',async()=>{
      await withAccount('verified',async page=>{
        await expect(page.getByRole('heading',{name:'Carga masiva del catálogo',exact:true})).toBeVisible();
        await expect(page.getByRole('button',{name:'Solicitudes (administración)',exact:true})).toHaveCount(0);
        await expect(page.getByRole('button',{name:'Publicar producto',exact:true})).toBeVisible();
        const values={sku:'BROWSER-CUAD',nombre:'Cuaderno Browser',categoria:'Papelería',presentacion:'caja',
          unidades_por_presentacion:12,precio:'abc',moneda:'PEN',incluye_igv:'true',minimo:2,multiplo:1,stock:20,publicado:'true'};
        const templatePromise=page.waitForEvent('download');
        await page.getByRole('link',{name:'Plantilla Excel',exact:true}).click();
        const template=await templatePromise;
        assert.equal(template.suggestedFilename(),'catalogo.xlsx');
        const templateBytes=await readFile(await template.path());
        async function upload() {
          const workbook = new ExcelJS.Workbook();await workbook.xlsx.load(templateBytes);
          const sheet=workbook.worksheets[0];
          COLUMNS.forEach((column,index)=>{sheet.getRow(2).getCell(index+1).value=values[column];});
          await page.getByLabel('Archivo del catálogo').setInputFiles({name:'catalogo.xlsx',
            mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await workbook.xlsx.writeBuffer())});
          await page.getByRole('button',{name:'Cargar y revisar lote',exact:true}).click();
        }
        await upload();
        await expect(page.getByText(/precio: Precio positivo por presentación/)).toBeVisible();
        await expect(page.getByRole('button',{name:'Confirmar lote completo',exact:true})).toHaveCount(0);
        assert.equal((await db.query("SELECT count(*) FROM products WHERE sku='BROWSER-CUAD'")).rows[0].count,'0');
        values.precio='48.00';await upload();
        await page.getByRole('button',{name:'Confirmar lote completo',exact:true}).click();
        await expect(page.getByText(/Lote aplicado: 1 altas y 0 actualizaciones/)).toBeVisible();
        await expect(page.getByRole('heading',{name:'Cuaderno Browser',exact:true})).toBeVisible();
        const product=(await db.query("SELECT stock,price,published FROM products WHERE sku='BROWSER-CUAD'")).rows[0];
        assert.deepEqual(product,{stock:20,price:'48.00',published:true});
        const downloadPromise=page.waitForEvent('download');
        await page.getByRole('button',{name:'Descargar reporte CSV',exact:true}).click();
        const download=await downloadPromise;assert.match(download.suggestedFilename(),/^reporte-.*\.csv$/);
      });
    });
  } finally {
    if(browser)await browser.close();if(app)await app.close();if(db)await db.end();process.env.DATABASE_URL=original;
    await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await root.end();
  }
});
