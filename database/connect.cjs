const { Client } = require('pg');

async function withDatabase(action) {
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env.');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await action(client);
  } finally {
    await client.end();
  }
}

function reportFailure(error) {
  console.error(error.message);
  process.exitCode = 1;
}

module.exports = { withDatabase, reportFailure };
