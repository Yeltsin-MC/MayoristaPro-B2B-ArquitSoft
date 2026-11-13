const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { tradeFixture } = require('./trade-fixture.cjs');

test('UX sesión: cookie, validación vigente, permisos, cierre y vencimiento', async t => {
 const f = await tradeFixture();
 try {
  async function login(){
   const response=await fetch(f.base+'auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.accounts.buyer.email,password:f.password})});
   assert.equal(response.status,201);
   const header=response.headers.get('set-cookie');
   assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);assert.match(header,/Path=\/api\/v1\/auth/);
   assert.doesNotMatch(header,/Expires=|Max-Age=/);
   return {cookie:header.split(';')[0],...(await response.json())};
  }
  const restore=cookie=>fetch(f.base+'auth/restore',{headers:{Cookie:cookie}});
  await t.test('Cookie restaura únicamente sesión activa y permisos actuales; negocio sigue exigiendo Bearer',async()=>{
   const auth=await login();
   const response=await restore(auth.cookie);assert.equal(response.status,200);
   assert.equal(response.headers.get('cache-control'),'no-store');
   const session=await response.json();assert.equal(session.accountId,f.accounts.buyer.account);
   assert.deepEqual(session.permissions,['buy']);
   assert.equal((await fetch(f.base+'orders',{headers:{Cookie:auth.cookie}})).status,401);
   const foreign=await fetch(f.base+'auth/restore',{headers:{Cookie:auth.cookie,Origin:'https://otra.example.test'}});
   assert.equal(foreign.status,403);
   await f.db.query("UPDATE memberships SET permissions=ARRAY['publish'] WHERE account_id=$1",[f.accounts.buyer.account]);
   assert.deepEqual((await (await restore(auth.cookie)).json()).permissions,['publish']);
   await f.db.query('UPDATE memberships SET active=false WHERE account_id=$1',[f.accounts.buyer.account]);
   const revoked=await restore(auth.cookie);assert.equal(revoked.status,403);assert.match(revoked.headers.get('set-cookie'),/Max-Age=0/);
   await f.db.query("UPDATE memberships SET active=true,permissions=ARRAY['buy'] WHERE account_id=$1",[f.accounts.buyer.account]);
  });
  await t.test('El origen publico HTTPS emite cookie Secure',async()=>{
   const previous=process.env.FRONTEND_URL;
   try{
    process.env.FRONTEND_URL='https://demo.example.test';
    const response=await fetch(f.base+'auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.accounts.buyer.email,password:f.password})});
    assert.equal(response.status,201);assert.match(response.headers.get('set-cookie'),/; Secure(?:;|$)/);
   }finally{if(previous===undefined)delete process.env.FRONTEND_URL;else process.env.FRONTEND_URL=previous;}
  });
  await t.test('Cerrar borra la cookie y revoca también el Bearer anterior',async()=>{
   const auth=await login();
   const closed=await fetch(f.base+'auth/logout',{method:'POST',headers:{Cookie:auth.cookie}});
   assert.equal(closed.status,201);assert.match(closed.headers.get('set-cookie'),/Max-Age=0/);
   assert.equal((await restore(auth.cookie)).status,401);
   assert.equal((await f.call('auth/session','GET',undefined,null,{Authorization:'Bearer '+auth.token})).status,401);
  });
  await t.test('Vencida o falsificada no restaura cuenta; origen ajeno no inicia sesión',async()=>{
   const auth=await login();
   await f.db.query("UPDATE identity_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[createHash('sha256').update(auth.token).digest('hex')]);
   const expired=await restore(auth.cookie);assert.equal(expired.status,401);assert.match(expired.headers.get('set-cookie'),/Max-Age=0/);
   assert.equal((await restore('mayoristapro_session='+ '0'.repeat(64))).status,401);
   const crossSite=await fetch(f.base+'auth/login',{method:'POST',headers:{Origin:'https://otra.example.test','Content-Type':'application/json'},body:JSON.stringify({email:f.accounts.buyer.email,password:f.password})});
   assert.equal(crossSite.status,403);
  });
 }finally{await f.close();}
});