const {Pool}=require('pg');const {readFile,readdir}=require('node:fs/promises');const {resolve}=require('node:path');const {randomBytes}=require('node:crypto');
async function tradeFixture(){
 require('reflect-metadata');
 const {NestFactory}=require('@nestjs/core');const { AppModule } = require('../apps/api/dist/app.module.js');
 const {passwordHash}=require('../apps/api/dist/identity/identity.service');
 const original=process.env.DATABASE_URL;const root=new Pool({connectionString:original});const schema='t4_'+randomBytes(8).toString('hex');
 let db,app;const accounts={};const products={};const password='T4-ficticia-pruebas-2026!';
 async function close(){if(app)await app.close();if(db)await db.end();process.env.DATABASE_URL=original;await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await root.end();}
 try{
  await root.query(`CREATE SCHEMA ${schema}`);const url=new URL(original);url.searchParams.set('options',`-c search_path=${schema},public`);url.searchParams.set('application_name',schema);process.env.DATABASE_URL=url.toString();
  db=new Pool({connectionString:process.env.DATABASE_URL});
  for(const file of (await readdir('database/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile('database/migrations/'+file,'utf8'));
  await db.query(await readFile('database/seed.sql','utf8'));const hash=await passwordHash(password);
  for(const [n,name] of ['buyer','buyer2','vendor','vendor2','outsider','pending'].entries()){
   const supplier=(await db.query('INSERT INTO suppliers(code,name,verified) VALUES($1,$1,$2) RETURNING id',[name,name!=='pending'])).rows[0].id;
   const company=(await db.query("INSERT INTO companies(ruc,legal_name,status,supplier_id) VALUES($1,$2,'enabled',$3) RETURNING id",['2077777777'+n,name,supplier])).rows[0].id;
   const account=(await db.query('INSERT INTO accounts(email,password_hash) VALUES($1,$2) RETURNING id',[name+'@t4.test',hash])).rows[0].id;
   await db.query('INSERT INTO memberships(company_id,account_id,permissions) VALUES($1,$2,$3)',[company,account,name.startsWith('buyer')?['buy']:['publish']]);
   accounts[name]={account,company,supplier,email:name+'@t4.test'};
   if(['vendor','vendor2'].includes(name))products[name]=(await db.query(`INSERT INTO products(supplier_id,sku,name,unit,units_per_pack,minimum,multiple,stock,price,includes_tax,published)
    VALUES($1,'CAJA','Cuaderno '||$2,'caja',12,2,1,20,48,true,true) RETURNING *`,[supplier,name])).rows[0];
  }
  const peer=(await db.query("INSERT INTO accounts(email,password_hash) VALUES('buyerpeer@t4.test',$1) RETURNING id",[hash])).rows[0].id;
  // Identity normalizes email, so store the fixture in that same canonical form.
  await db.query("UPDATE accounts SET email='buyerpeer@t4.test' WHERE id=$1",[peer]);
  await db.query("INSERT INTO memberships(company_id,account_id,permissions) VALUES($1,$2,ARRAY['buy'])",[accounts.buyer.company,peer]);
  accounts.buyerPeer={...accounts.buyer,account:peer,email:'buyerpeer@t4.test'};
  app=await NestFactory.create(AppModule,{logger:false,abortOnError:false});require('../apps/api/dist/http-setup.js').configureHttp(app,resolve('apps/web/dist/catalog/browser'));await app.listen(0,'127.0.0.1');
  const base=(await app.getUrl())+'/api/v1/';
  async function call(path,method='GET',body,who='buyer',headers={}){
   const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(who&&accounts[who]?.token?{Authorization:'Bearer '+accounts[who].token}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
   return {status:response.status,body:await response.json()};
  }
  for(const a of Object.values(accounts)){const response=await call('auth/login','POST',{email:a.email,password},null);if(response.status!==201)throw new Error('No se pudo autenticar fixture '+a.email);a.token=response.body.token;}
  async function request(who='buyer',quantity=2,suppliers=['vendor','vendor2']){
   return call('quotations','POST',{proveedorIds:suppliers.map(s=>accounts[s].supplier),items:[{descripcion:'Cuadernos T4',presentacion:'caja',unidadesPorPresentacion:12,cantidad:quantity}]},who);
  }
  function draft(q,who='vendor',extra={}){return {moneda:'PEN',precioIncluyeIgv:true,costoEnvio:'8.00',diasEntrega:3,vigenteHasta:new Date(Date.now()+86400000).toISOString(),
   items:q.items.map(i=>({solicitudItemId:i.id,productoId:(products[who]??products.vendor).id,cantidad:i.quantity,precioUnitario:'48.00'})),...extra};}
  async function offer(q,who='vendor',extra={}){return call('quotations/'+q.id+'/responses','POST',draft(q,who,extra),who);}
  async function accept(q,id,who='buyer'){return call(`quotations/${q.id}/responses/${id}/accept`,'PATCH',undefined,who);}
  async function order(id,key='key-'+randomBytes(5).toString('hex'),who='buyer'){return call('orders','POST',{cotizacionRespuestaId:id},who,{'Idempotency-Key':key});}
  async function contention(){
   for(let n=0;n<200;n++){
    const count=Number((await db.query("SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%'",[schema])).rows[0].count);
    if(count>=2)return;await new Promise(resolve=>setTimeout(resolve,10));
   }throw new Error('No se observaron dos conexiones concurrentes esperando el bloqueo PostgreSQL.');
  }
  return {db,app,base,accounts,products,password,close,call,request,draft,offer,accept,order,contention};
 }catch(error){await close();throw error;}
}
module.exports={tradeFixture};
