import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlFile = join(__dirname, '../drizzle/0000_watery_fat_cobra.sql');

const connStr = process.env.RAILWAY_DATABASE_URL;
if (!connStr) {
  console.error('RAILWAY_DATABASE_URL não definida');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // Drizzle usa "--> statement-breakpoint" como separador
    const sql = readFileSync(sqlFile, 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Aplicando ${statements.length} statements...`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.query(stmt);
        console.log(`  [${i + 1}/${statements.length}] OK`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  [${i + 1}/${statements.length}] JÁ EXISTE (ignorado)`);
        } else {
          console.error(`  [${i + 1}/${statements.length}] ERRO: ${err.message}`);
          throw err;
        }
      }
    }
    console.log('\n✅ Migration aplicada com sucesso!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('Falha na migration:', e.message);
  process.exit(1);
});
