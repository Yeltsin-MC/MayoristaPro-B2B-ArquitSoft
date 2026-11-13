const { configuration, demoDatabaseUrl } = require('./load.cjs');
const config = configuration();
process.env.DATABASE_URL = demoDatabaseUrl(config.source, config.schema);
process.env.PORT = process.env.DEMO_PORT || '3300';
process.env.HOST = '127.0.0.1';
process.env.FRONTEND_URL = process.env.DEMO_PUBLIC_URL || 'http://localhost:' + process.env.PORT;
process.env.AI_SERVICE_URL ||= 'http://127.0.0.1:5055';
require('../../apps/api/dist/main.js');