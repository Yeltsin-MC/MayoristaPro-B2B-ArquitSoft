const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { readFile } = require('node:fs/promises');
const { randomBytes } = require('node:crypto');
const ExcelJS = require('exceljs');

test('T3: importación CSV/XLSX con PostgreSQL y HTTP reales', async t => {
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../apps/api/dist/app.module.js');
  const { passwordHash } = require('../apps/api/dist/identity/identity.service.js');
  const { COLUMNS } = require('../apps/api/dist/catalog/application/import-file.js');
  const original = process.env.DATABASE_URL;
  const root = new Pool({ connectionString:original });
  const schema = 't3_' + randomBytes(8).toString('hex');
  const password = 'Demo-T3-ficticia-2026!';
  let db, app;
  const owners = {};
  const example = (sku, extra={}) => Object.assign({ sku, nombre:'Cuaderno de prueba', categoria:'Papelería',
    presentacion:'caja', unidades_por_presentacion:12, precio:'48.00', moneda:'PEN',
    incluye_igv:'true', minimo:2, multiplo:1, stock:20, publicado:'true' }, extra);
  const csv = rows => COLUMNS.join(',')+'\r\n'+rows.map(row=>COLUMNS.map(c=>'"'+String(row[c]??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(original); url.searchParams.set('options',`-c search_path=${schema},public`);
    process.env.DATABASE_URL = url.toString();
    db = new Pool({ connectionString:process.env.DATABASE_URL });
    for (const file of ['database/migrations/001_catalog.sql','database/migrations/002_identity.sql',
      'database/migrations/003_catalog_imports.sql','database/migrations/004_trade.sql','database/migrations/007_catalog_cache.sql','database/seed.sql']) await db.query(await readFile(file,'utf8'));
    const hash = await passwordHash(password);
    for (const [index,name] of ['owner','other','pending','reader'].entries()) {
      const supplier = (await db.query('INSERT INTO suppliers(code,name,verified) VALUES($1,$1,$2) RETURNING id',[name,name!=='pending'])).rows[0].id;
      const company = (await db.query("INSERT INTO companies(ruc,legal_name,status,supplier_id) VALUES($1,$2,'enabled',$3) RETURNING id",['2099999999'+index,name,supplier])).rows[0].id;
      const account = (await db.query('INSERT INTO accounts(email,password_hash) VALUES($1,$2) RETURNING id',[name+'@example.test',hash])).rows[0].id;
      await db.query('INSERT INTO memberships(company_id,account_id,permissions) VALUES($1,$2,$3)',[company,account,name==='reader'?['buy']:['publish','buy']]);
      owners[name] = { supplier,company,account };
    }
    app = await NestFactory.create(AppModule,{ logger:false, abortOnError:false });
    app.setGlobalPrefix('api/v1'); await app.listen(0,'127.0.0.1');
    const base = (await app.getUrl())+'/api/v1/';
    async function json(path, method='GET', body, token, headers={}) {
      const response = await fetch(base+path,{ method,headers:{'Content-Type':'application/json',...headers,...(token?{Authorization:'Bearer '+token}:{})},
        ...(body?{body:JSON.stringify(body)}:{}) });
      return { status:response.status, body:await response.json(), headers:response.headers };
    }
    for (const name of Object.keys(owners)) owners[name].token = (await json('auth/login','POST',{email:name+'@example.test',password})).body.token;
    const token = owners.owner.token;
    async function upload(content, filename='catalogo.csv', who=token) {
      const form = new FormData(); form.append('file',new Blob([content]),filename);
      const response = await fetch(base+'products/imports/preview',{method:'POST',headers:who?{Authorization:'Bearer '+who}:{},body:form});
      return {status:response.status,body:await response.json()};
    }
    async function preview(rows, who=token) {
      const response = await upload(csv(rows),'catalogo.csv',who);
      assert.equal(response.status,201,JSON.stringify(response.body)); return response.body;
    }
    async function confirm(batch, who=token, key='test-key', hash=batch.previewHash) {
      return json('products/imports/'+batch.id+'/confirm','POST',{previewHash:hash},who,{'Idempotency-Key':key});
    }
    async function product(sku, supplier=owners.owner.supplier) {
      return (await db.query('SELECT * FROM products WHERE supplier_id=$1 AND sku=$2',[supplier,sku])).rows[0];
    }

    let first;
    await t.test('CSV: vista previa sin escrituras, confirmación y catálogo público',async()=>{
      first = await preview([example('NEW-1'), example('DRAFT',{publicado:'false'})]);
      assert.equal(first.status,'preview'); assert.equal(first.summary.creates,2);
      assert.equal(await product('NEW-1'),undefined);
      assert.equal((await confirm(first)).status,201);
      assert.equal((await product('NEW-1')).stock,20);
      const catalog = await json('products?limit=100');
      assert.equal(catalog.status,200); assert.equal(catalog.headers.get('cache-control'),'no-store');
      const published = await product('NEW-1'); const draft = await product('DRAFT');
      assert.ok(catalog.body.items.some(p=>p.id===published.id && p.category==='Papelería' && p.available));
      assert.ok(!catalog.body.items.some(p=>p.id===draft.id));
      assert.ok(catalog.body.items.some(p=>p.name==='Cuaderno A4'));
    });

    await t.test('reintentos simultáneos aplican el lote una vez, huella y clave requeridas',async()=>{
      const batch = await preview([example('ONCE')]);
      assert.equal((await json('products/imports/'+batch.id+'/confirm','POST',{previewHash:batch.previewHash},token)).status,400);
      assert.equal((await confirm(batch,token,'same','bad-hash')).status,409);
      const results = await Promise.all([confirm(batch),confirm(batch)]);
      assert.ok(results.every(r=>r.status===201)); assert.deepEqual(results[0].body.result,results[1].body.result);
      assert.equal((await confirm(batch,token,'new-key')).status,201);
      assert.equal((await db.query('SELECT count(*) FROM products WHERE supplier_id=$1 AND sku=$2',[owners.owner.supplier,'ONCE'])).rows[0].count,'1');
      assert.equal((await db.query("SELECT count(*) FROM identity_audit WHERE resource_id=$1 AND action='confirm-import'",[batch.id])).rows[0].count,'1');
    });

    await t.test('actualización conserva stock incluso con movimiento posterior a la vista previa',async()=>{
      const batch = await preview([example('NEW-1',{nombre:'Nombre actualizado',precio:'50.25',stock:999})]);
      assert.equal(batch.summary.updates,1); assert.equal(batch.rows[0].snapshot.stock,20);
      await db.query('UPDATE products SET stock=1 WHERE id=$1',[(await product('NEW-1')).id]);
      assert.equal((await confirm(batch)).status,201);
      const updated = await product('NEW-1'); assert.equal(updated.stock,1); assert.equal(updated.price,'50.25');
      const publicRow = (await json('products?limit=100')).body.items.find(p=>p.id===updated.id);
      assert.equal(publicRow.available,false); assert.equal(publicRow.name,'Nombre actualizado');
    });

    await t.test('mismo SKU de otro proveedor crea una oferta independiente; ajenos y pendientes bloqueados',async()=>{
      assert.equal((await upload(csv([example('DENIED')]),'catalogo.csv',owners.pending.token)).status,403);
      assert.equal((await upload(csv([example('DENIED')]),'catalogo.csv',owners.reader.token)).status,403);
      assert.equal((await upload(csv([example('DENIED')]),'catalogo.csv',null)).status,401);
      assert.equal((await json('products/imports/'+first.id,'GET',undefined,owners.other.token)).status,404);
      assert.equal((await confirm(first,owners.other.token)).status,404);
      assert.equal((await confirm(first,owners.pending.token)).status,403);
      assert.equal((await json('products/imports/'+first.id,'GET',undefined,owners.pending.token)).status,403);
      const other = await preview([example('NEW-1')],owners.other.token);
      assert.equal(other.summary.creates,1); assert.equal((await confirm(other,owners.other.token)).status,201);
      assert.notEqual((await product('NEW-1',owners.other.supplier)).id,(await product('NEW-1')).id);
    });

    await t.test('errores por fila/columna impiden cualquier cambio parcial',async()=>{
      const batch = await preview([example('NO-PARTIAL'), example('BAD',{precio:'1.234',minimo:3,multiplo:2}),example('BAD')]);
      assert.equal(batch.status,'invalid'); assert.equal(batch.summary.invalid,2);
      assert.ok(batch.rows[1].errors.some(e=>e.column==='precio'));
      assert.ok(batch.rows[1].errors.some(e=>e.column==='minimo'));
      assert.ok(batch.rows[1].errors.some(e=>e.column==='sku'));
      assert.equal((await confirm(batch)).status,422); assert.equal(await product('NO-PARTIAL'),undefined);
      assert.equal(await product('BAD'),undefined);
      const invalid = await preview([example('VALIDATION',{presentacion:'litro',stock:-1,unidades_por_presentacion:0,moneda:'USD',incluye_igv:'sí',publicado:'quizás',categoria:''})]);
      assert.ok(invalid.rows[0].errors.length>=6);
      const stock = await preview([example('LOW-STOCK',{stock:1})]);
      assert.ok(stock.rows[0].errors.some(e=>e.column==='stock'));
      const pack = await preview([example('ONCE',{unidades_por_presentacion:24})]);
      assert.ok(pack.rows[0].errors.some(e=>e.column==='presentacion'));
    });

    await t.test('cambio de SKU o metadatos invalida vista previa, incluso al restaurar el valor',async()=>{
      const batch = await preview([example('ONCE',{precio:'55.00'}),example('NO-STALE-WRITE')]);
      const before = await product('ONCE');
      await db.query("UPDATE products SET sku='RENAMED' WHERE id=$1",[before.id]);
      const response = await confirm(batch);assert.equal(response.status,409);
      assert.match(response.body.message,/SKU/);assert.equal(await product('NO-STALE-WRITE'),undefined);
      assert.equal((await json('products/imports/'+batch.id,'GET',undefined,token)).body.status,'stale');
      const again = await preview([example('RENAMED')]);
      await db.query('UPDATE products SET price=51 WHERE id=$1',[before.id]);
      await db.query('UPDATE products SET price=$2 WHERE id=$1',[before.id,before.price]);
      assert.equal((await confirm(again)).status,409);
      const reviewed = await preview([example('RENAMED')]);assert.equal((await confirm(reviewed)).status,201);
    });

    await t.test('dos lotes para un SKU ausente: solo uno se aplica y el otro exige revisar',async()=>{
      const one = await preview([example('RACE')]); const two = await preview([example('RACE')]);
      const responses = await Promise.all([confirm(one),confirm(two)]);
      assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
      assert.equal((await db.query('SELECT count(*) FROM products WHERE supplier_id=$1 AND sku=$2',[owners.owner.supplier,'RACE'])).rows[0].count,'1');
    });

    await t.test('XLSX real y plantillas; fórmulas y contenido corrupto rechazados',async()=>{
      const workbook = new ExcelJS.Workbook(); const sheet=workbook.addWorksheet('Catalogo');
      sheet.addRow([...COLUMNS]); sheet.addRow(COLUMNS.map(c=>example('XLSX')[c]));
      const response=await upload(await workbook.xlsx.writeBuffer(),'catalogo.xlsx');
      assert.equal(response.status,201); assert.equal((await confirm(response.body)).status,201);
      assert.ok(await product('XLSX'));
      sheet.getRow(2).getCell(COLUMNS.indexOf('precio')+1).value={formula:'1+1',result:2};
      const formula=await upload(await workbook.xlsx.writeBuffer(),'formula.xlsx');assert.equal(formula.status,201);
      assert.ok(formula.body.rows[0].errors.some(e=>e.column==='precio'));
      assert.equal((await confirm(formula.body)).status,422);
      assert.equal((await upload('no es xlsx','roto.xlsx')).status,400);
      assert.equal((await upload(csv([example('A')]),'catalogo.xlsm')).status,400);
      assert.equal((await upload('sku,nombre\nX,Test')).status,400);
      const csvTemplate=await fetch(base+'products/imports/template');assert.equal(csvTemplate.status,200);
      assert.equal((await upload(await csvTemplate.text())).status,201);
      const xlsxTemplate=await fetch(base+'products/imports/template?format=xlsx');
      assert.equal((await upload(Buffer.from(await xlsxTemplate.arrayBuffer()),'plantilla.xlsx')).status,201);
    });

    await t.test('límites de archivo y filas; se admite un lote de 500 productos',async()=>{
      assert.equal((await upload(Buffer.alloc(5*1024*1024+1),'grande.csv')).status,413);
      assert.equal((await upload(csv(Array.from({length:501},(_,i)=>example('LIMIT-'+i))))).status,400);
      const max=await preview(Array.from({length:500},(_,i)=>example('MAX-'+i,{publicado:'false'})));
      assert.equal(max.summary.total,500);assert.equal((await confirm(max)).status,201);
      assert.equal((await db.query("SELECT count(*) FROM products WHERE supplier_id=$1 AND sku LIKE 'MAX-%'",[owners.owner.supplier])).rows[0].count,'500');
    });

    await t.test('vencimiento, pérdida de verificación y revocación se revalidan al confirmar',async()=>{
      const expired=await preview([example('EXPIRED')]);
      await db.query("UPDATE catalog_imports SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
      assert.equal((await confirm(expired)).status,409);assert.equal(await product('EXPIRED'),undefined);
      const revoked=await preview([example('REVOKED')]);
      await db.query('UPDATE suppliers SET verified=false WHERE id=$1',[owners.owner.supplier]);
      assert.equal((await confirm(revoked)).status,403);
      await db.query('UPDATE suppliers SET verified=true WHERE id=$1',[owners.owner.supplier]);
      await db.query('UPDATE memberships SET active=false WHERE account_id=$1',[owners.owner.account]);
      assert.equal((await confirm(revoked)).status,403);assert.equal(await product('REVOKED'),undefined);
      assert.equal((await json('products/imports/'+revoked.id,'GET',undefined,token)).status,403);
      await db.query('UPDATE memberships SET active=true WHERE account_id=$1',[owners.owner.account]);
    });

    await t.test('un fallo SQL durante la aplicación revierte altas, lote y auditoría juntos',async()=>{
      const batch=await preview([example('ROLLBACK-FIRST'),example('ROLLBACK-FAIL')]);
      await db.query("ALTER TABLE products ADD CONSTRAINT simulated_failure CHECK(sku <> 'ROLLBACK-FAIL')");
      try {
        assert.equal((await confirm(batch)).status,500);
        assert.equal(await product('ROLLBACK-FIRST'),undefined);
        assert.equal((await json('products/imports/'+batch.id,'GET',undefined,token)).body.status,'preview');
        assert.equal((await db.query("SELECT count(*) FROM identity_audit WHERE resource_id=$1 AND action='confirm-import'",[batch.id])).rows[0].count,'0');
      } finally {await db.query('ALTER TABLE products DROP CONSTRAINT simulated_failure');}
      assert.equal((await confirm(batch)).status,201);
    });
  } finally {
    if (app) await app.close(); if (db) await db.end(); process.env.DATABASE_URL=original;
    await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await root.end();
  }
});
