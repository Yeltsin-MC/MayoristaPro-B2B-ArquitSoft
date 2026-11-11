const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { readFile } = require('node:fs/promises');
const { randomBytes } = require('node:crypto');

test('T2: identidad empresarial y permisos con PostgreSQL real', async t => {
 require('reflect-metadata');
 const { NestFactory } = require('@nestjs/core');
 const { CatalogModule } = require('../apps/api/dist/catalog/catalog.module.js');
 const { passwordHash } = require('../apps/api/dist/identity/identity.service.js');
 const original = process.env.DATABASE_URL;
 const root = new Pool({ connectionString: original });
 const schema = 't2_' + randomBytes(8).toString('hex');
 let db, app;
 const password='Demo-ficticia-2026!';
 try {
  await root.query(`CREATE SCHEMA ${schema}`);
  const url=new URL(original); url.searchParams.set('options',`-c search_path=${schema},public`);
  process.env.DATABASE_URL=url.toString();
  db=new Pool({connectionString:process.env.DATABASE_URL});
  for(const file of ['database/migrations/001_catalog.sql','database/migrations/002_identity.sql','database/migrations/003_catalog_imports.sql','database/seed.sql']) await db.query(await readFile(file,'utf8'));
  await db.query('INSERT INTO accounts(email,password_hash,platform_admin) VALUES($1,$2,true)',['admin@example.test',await passwordHash(password)]);
  app=await NestFactory.create(CatalogModule,{logger:false,abortOnError:false});
  app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  async function call(path,method='GET',body,token){
   const response=await fetch(base+'/api/v1/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
   return {status:response.status,body:await response.json()};
  }
  async function login(email){const response=await call('auth/login','POST',{email,password});assert.equal(response.status,201);return response.body.token;}
  const admin=await login('admin@example.test');
  let a,b,tokenA,tokenB,companyA,companyB;
  await t.test('alta pendiente, aprobación manual y sin privilegios públicos',async()=>{
   assert.equal((await call('auth/register','POST',{email:'invalid@example.test',password,ruc:'123',legalName:'Inválida',evidence:'Ficticia'})).status,400);
   a=await call('auth/register','POST',{email:'a@example.test',password,ruc:'20111111111',legalName:'Empresa A ficticia',evidence:'Representación ficticia A',platform_admin:true,permissions:['admin']});
   b=await call('auth/register','POST',{email:'b@example.test',password,ruc:'20222222222',legalName:'Empresa B ficticia',evidence:'Representación ficticia B'});
   assert.equal(a.status,201);assert.equal(b.status,201);
   tokenA=await login('a@example.test');tokenB=await login('b@example.test');
   assert.equal((await call('auth/me','GET',undefined,tokenA)).status,403);
   assert.equal((await call('admin/enrollments','GET',undefined,tokenA)).status,403);
   assert.equal((await call('admin/enrollments/'+a.body.requestId+'/approve','POST',{},tokenA)).status,403);
   const approvals=await Promise.all([1,2].map(()=>call('admin/enrollments/'+a.body.requestId+'/approve','POST',{},admin)));
   assert.ok(approvals.every(r=>r.status===201));
   companyA=approvals[0].body.companyId;
   companyB=(await call('admin/enrollments/'+b.body.requestId+'/approve','POST',{},admin)).body.companyId;
   const me=await call('auth/me','GET',undefined,tokenA);
   assert.equal(me.body.company.review_label,'revisado manualmente');assert.ok(me.body.permissions.includes('buy'));
   assert.equal((await call('auth/register','POST',{email:'impostor@example.test',password,ruc:'20111111111',legalName:'Impostor',evidence:'Ficticia'})).status,409);
   assert.equal((await db.query('SELECT count(*) FROM accounts WHERE email=$1',['impostor@example.test'])).rows[0].count,'0');
  });
  let productA,productB,supplierA,supplierB;
  await t.test('aislamiento, compra habilitada y publicación bloqueada hasta verificar proveedor',async()=>{
   supplierA=(await db.query('SELECT supplier_id FROM companies WHERE id=$1',[companyA])).rows[0].supplier_id;
   supplierB=(await db.query('SELECT supplier_id FROM companies WHERE id=$1',[companyB])).rows[0].supplier_id;
   async function product(supplier){return (await db.query("INSERT INTO products(supplier_id,sku,name,unit,units_per_pack,minimum,multiple,stock,price,includes_tax) VALUES($1,'SKU','Producto ficticio','caja',1,1,1,10,10,true) RETURNING id",[supplier])).rows[0].id;}
   productA=await product(supplierA);productB=await product(supplierB);
   assert.equal((await call('products/'+productA+'/publish','POST',{},tokenA)).status,403);
   assert.equal((await call('providers/'+supplierA+'/verify','PATCH',{},tokenA)).status,403);
   assert.equal((await call('providers/'+supplierA+'/verify','PATCH',{},admin)).status,200);
   assert.equal((await call('products/'+productA+'/publish','POST',{},tokenB)).status,403);
   assert.equal((await call('products/'+productB+'/publish','POST',{},tokenA)).status,403);
   assert.equal((await call('products/'+productA+'/publish','POST',{},tokenA)).status,201);
   const publicCatalog=await call('products');assert.equal(publicCatalog.status,200);
   assert.ok(publicCatalog.body.items.some(p=>p.id===productA));assert.ok(!publicCatalog.body.items.some(p=>p.id===productB));
   assert.ok(publicCatalog.body.items.some(p=>p.name==='Cuaderno A4'));
  });
  let invitedToken,memberId;
  await t.test('invitación vinculada al correo, permiso limitado y un solo consumo concurrente',async()=>{
   const inv=await call('company/invitations','POST',{email:'invited@example.test',permissions:['buy'],companyId:companyB},tokenA);
   assert.equal(inv.status,201);const token=inv.body.link.split('token=')[1];
   assert.equal((await call('auth/invitations/accept','POST',{token,email:'wrong@example.test',password})).status,400);
   const results=await Promise.all([1,2].map(()=>call('auth/invitations/accept','POST',{token,email:'invited@example.test',password})));
   assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);
   invitedToken=await login('invited@example.test');
   const me=(await call('auth/me','GET',undefined,invitedToken)).body;
   assert.equal(me.company.id,companyA);assert.deepEqual(me.permissions,['buy']);memberId=me.membershipId;
   assert.equal((await call('products/'+productA+'/publish','POST',{},invitedToken)).status,403);
   assert.equal((await call('company/invitations','POST',{email:'no@example.test',permissions:['buy']},invitedToken)).status,403);
   assert.equal((await call('company/invitations','POST',{email:'no@example.test',permissions:['manage']},tokenA)).status,400);
  });
  await t.test('invitación vencida y revocación inmediata con aislamiento',async()=>{
   const inv=await call('company/invitations','POST',{email:'expired@example.test',permissions:['publish']},tokenA);
   await db.query("UPDATE invitations SET expires_at=now()-interval '1 second' WHERE id=$1",[inv.body.id]);
   assert.equal((await call('auth/invitations/accept','POST',{token:inv.body.link.split('token=')[1],email:'expired@example.test',password})).status,400);
   assert.equal((await call('company/members/'+memberId+'/revoke','POST',{},tokenB)).status,403);
   assert.equal((await call('auth/me','GET',undefined,invitedToken)).status,200);
   assert.equal((await call('company/members/'+memberId+'/revoke','POST',{},tokenA)).status,201);
   assert.equal((await call('auth/me','GET',undefined,invitedToken)).status,401);
   const newToken=await login('invited@example.test');assert.equal((await call('auth/me','GET',undefined,newToken)).status,403);
   const members=(await call('company/members','GET',undefined,tokenB)).body;
   assert.ok(!members.some(m=>m.email==='invited@example.test'));
  });
  await t.test('sesiones vencidas, logout y credenciales inválidas',async()=>{
   assert.equal((await call('auth/login','POST',{email:'a@example.test',password:'Incorrecta-2026!'})).status,401);
   assert.equal((await call('auth/me')).status,401);
   const expired=await login('a@example.test');
   await db.query("UPDATE identity_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[require('node:crypto').createHash('sha256').update(expired).digest('hex')]);
   assert.equal((await call('auth/me','GET',undefined,expired)).status,401);
   await call('auth/logout','POST',{},tokenA);assert.equal((await call('auth/me','GET',undefined,tokenA)).status,401);
  });
 } finally {
  if(app)await app.close();if(db)await db.end();process.env.DATABASE_URL=original;
  await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await root.end();
 }
});
