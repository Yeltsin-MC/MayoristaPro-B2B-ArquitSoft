const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { withDatabase, reportFailure } = require('./connect.cjs');

withDatabase(async client => {
  await client.query(await readFile(join(__dirname, 'seed.sql'), 'utf8'));
}).catch(reportFailure);
