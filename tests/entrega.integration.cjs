const {test}=require('node:test');
const assert=require('node:assert/strict');
const {tradeFixture}=require('./trade-fixture.cjs');

// Caso Ayacucho: el comprador está en Huamanga y el proveedor despacha desde Lima.
const negocio={direccion:'Jr. Ficticio 123',distrito:'San Juan Bautista',provincia:'Huamanga',departamento:'Ayacucho',referencia:'Frente al mercado'};
const almacen={direccion:'Av. Ficticia 456',distrito:'Ate',provincia:'Lima',departamento:'Lima'};

test('Entrega y direcciones: dirección de empresa, modalidad por pedido y lugar de entrega', async t=>{
 const f=await tradeFixture();
 try{
  await t.test('guardar la dirección exige el permiso de gestionar la empresa',async()=>{
   assert.equal((await f.call('company/address','PUT',negocio)).status,403);
   for(const who of ['buyer','vendor'])
    await f.db.query("UPDATE memberships SET permissions=array_append(permissions,'manage') WHERE account_id=$1",[f.accounts[who].account]);
   const saved=await f.call('company/address','PUT',negocio);
   assert.equal(saved.status,200);
   assert.equal(saved.body.province,'Huamanga');
   assert.equal((await f.call('company/address','PUT',almacen,'vendor')).status,200);
   const me=(await f.call('auth/me')).body.company;
   assert.equal(me.district,'San Juan Bautista');
   assert.equal(me.address_reference,'Frente al mercado');
  });
  await t.test('la dirección valida campos obligatorios y teléfono',async()=>{
   assert.equal((await f.call('company/address','PUT',{...negocio,distrito:''})).status,400);
   assert.equal((await f.call('company/address','PUT',{...negocio,telefono:'llamar'})).status,400);
  });
  await t.test('sin «entrega» se usa la dirección del negocio y el proveedor ve si es interprovincial',async()=>{
   const q=(await f.request('buyer',2,['vendor'])).body;
   const buyerView=(await f.call('quotations/'+q.id)).body;
   assert.equal(buyerView.delivery.modalidad,'envio');
   assert.equal(buyerView.delivery.distrito,'San Juan Bautista');
   assert.equal(buyerView.origin,null);
   const vendorView=(await f.call('quotations/'+q.id,'GET',undefined,'vendor')).body;
   assert.equal(vendorView.delivery.provincia,'Huamanga');
   assert.deepEqual(vendorView.origin,{province:'Lima',department:'Lima'});
  });
  await t.test('cada pedido puede elegir agencia o recojo, y el pedido muestra el lugar de entrega',async()=>{
   const body=(entrega)=>({proveedorIds:[f.accounts.vendor.supplier],items:[{descripcion:'Cuadernos',presentacion:'caja',unidadesPorPresentacion:12,cantidad:2}],entrega});
   const agencia=await f.call('quotations','POST',body({modalidad:'agencia',agencia:'Terminal terrestre',distrito:'Ayacucho',provincia:'Huamanga',departamento:'Ayacucho'}));
   assert.equal(agencia.status,201);
   assert.equal((await f.call('quotations/'+agencia.body.id)).body.delivery.agencia,'Terminal terrestre');
   assert.equal((await f.call('quotations','POST',body({modalidad:'agencia',distrito:'Ayacucho',provincia:'Huamanga',departamento:'Ayacucho'}))).status,422);
   assert.equal((await f.call('quotations','POST',body({modalidad:'envio',distrito:'Ayacucho'}))).status,422);
   assert.equal((await f.call('quotations','POST',body({modalidad:'dron'}))).status,422);
   const recojo=(await f.call('quotations','POST',body({modalidad:'recojo'}))).body;
   const offer=(await f.offer(recojo,'vendor',{costoEnvio:'0.00'})).body.offers[0];
   assert.equal((await f.accept(recojo,offer.id)).status,200);
   const created=await f.order(offer.id);
   assert.equal(created.status,201);
   const order=(await f.call('orders/'+created.body.id)).body;
   assert.equal(order.delivery.modalidad,'recojo');
   assert.equal(order.pickup.district,'Ate');
   assert.deepEqual(order.origin,{province:'Lima',department:'Lima'});
  });
 }finally{await f.close();}
});
