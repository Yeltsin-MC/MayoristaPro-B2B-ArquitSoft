const { readFile, readdir } = require('node:fs/promises');
const { join } = require('node:path');
const { withDatabase, reportFailure } = require('./connect.cjs');

withDatabase(async client => {
  const folder = join(__dirname, 'migrations');
  const files = (await readdir(folder)).filter(name => name.endsWith('.sql')).sort();
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(196401)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)');
    for (const file of files) {
      const result = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (result.rowCount > 0) continue;
      await client.query(await readFile(join(folder, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}).catch(reportFailure);
