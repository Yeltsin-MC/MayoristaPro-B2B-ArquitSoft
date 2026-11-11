const { withDatabase, reportFailure } = require('./connect.cjs');
const { passwordHash } = require('../apps/api/dist/identity/identity.service.js');
// Provisionamiento explícito: no existe ruta HTTP para crear administradores.
(async () => {
 const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
 if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Configura ADMIN_EMAIL.');
 const hash = await passwordHash(process.env.ADMIN_PASSWORD);
 await withDatabase(async db => {
   await db.query('INSERT INTO accounts(email,password_hash,platform_admin) VALUES($1,$2,true)',[email,hash]);
 });
 console.log('Administrador creado.');
})().catch(reportFailure);
