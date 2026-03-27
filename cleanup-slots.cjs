const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL,
  ssl: (process.env.RAILWAY_DATABASE_URL || '').includes('railway') ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('🧹 Cleaning up consultation_slots...');
    const result = await client.query('DELETE FROM consultation_slots WHERE sold = false');
    console.log(`✓ Deleted ${result.rowCount} consultation slots`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
