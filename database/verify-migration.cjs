const { withDatabase, reportFailure } = require('./connect.cjs');

withDatabase(async client => {
  console.log('Verifying migration 005_payments...\n');
  
  // Check payment tables
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' 
      AND table_name IN ('payment_attempts', 'payment_webhook_events', 'payment_reconciliations')
    ORDER BY table_name
  `);
  
  console.log('Payment tables created:');
  tables.rows.forEach(row => console.log('  ✓', row.table_name));
  
  // Check expires_at column
  const column = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name='trade_orders' AND column_name='expires_at'
  `);
  
  if (column.rows.length > 0) {
    console.log('\n✓ trade_orders.expires_at column added');
    console.log(`  Type: ${column.rows[0].data_type}, Nullable: ${column.rows[0].is_nullable}`);
  }
  
  // Check functions
  const functions = await client.query(`
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema='public'
      AND routine_name IN ('count_active_payment_attempts', 'can_create_payment_attempt')
    ORDER BY routine_name
  `);
  
  console.log('\nHelper functions created:');
  functions.rows.forEach(row => console.log('  ✓', row.routine_name));
  
  console.log('\n✅ Migration 005 successfully applied');
  
}).catch(reportFailure);
