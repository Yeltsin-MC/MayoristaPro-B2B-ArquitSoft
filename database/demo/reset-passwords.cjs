// Cambia las contraseñas de las cuentas demo (solo correos @example.test del esquema demo)
// por las de .env.demo-catalog150: ADMIN_PASSWORD para la administración y DEMO_PASSWORD para
// proveedores y compradora. No toca empresas, productos, pedidos ni otras cuentas.
// Uso: npm run demo:catalog:passwords
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { Pool } = require('pg');
const { configuration, demoDatabaseUrl } = require('./load.cjs');

const derive = promisify(scrypt);
// Mismo formato que passwordHash() de la API: sal hexadecimal y scrypt de 64 bytes.
async function hash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await derive(password, salt, 64)).toString('hex');
}

async function resetPasswords(config = configuration()) {
  for (const [name, password] of [['ADMIN_PASSWORD', config.adminPassword], ['DEMO_PASSWORD', config.demoPassword]]) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128)
      throw new Error('Configura ' + name + ' con 12 a 128 caracteres en .env.demo-catalog150.');
  }
  const db = new Pool({ connectionString: demoDatabaseUrl(config.source, config.schema), connectionTimeoutMillis: 5000 });
  try {
    const admin = await db.query('UPDATE accounts SET password_hash=$1 WHERE email=$2 AND platform_admin RETURNING email', [
      await hash(config.adminPassword), config.adminEmail.toLowerCase(),
    ]);
    const demo = await db.query(
      "UPDATE accounts SET password_hash=$1 WHERE email LIKE 'demo-%@example.test' AND NOT platform_admin RETURNING email",
      [await hash(config.demoPassword)],
    );
    return { schema: config.schema, admin: admin.rowCount, demoAccounts: demo.rowCount };
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  resetPasswords().then(r => console.log(JSON.stringify(r, null, 2)), e => { console.error(e.message); process.exit(1); });
}
module.exports = { resetPasswords };
