import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const connStr = process.env.RAILWAY_DATABASE_URL;
if (!connStr) {
  console.error('RAILWAY_DATABASE_URL não definida');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  try {
    // Verificar se já existe um admin
    const existing = await client.query(
      `SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1`
    );
    if (existing.rows.length > 0) {
      console.log('✅ Admin já existe:', existing.rows[0]);
      return;
    }

    const username = 'admin';
    const password = 'MundoDaMagia@2026';
    const hash = await bcrypt.hash(password, 12);

    await client.query(`
      INSERT INTO users ("openId", name, "loginMethod", role, "displayName", active, username, "passwordHash", "createdAt", "updatedAt", "lastSignedIn")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
    `, [
      `local_admin_${Date.now()}`,
      'Administrador',
      'local',
      'admin',
      'Administrador',
      true,
      username,
      hash,
    ]);

    console.log('\n✅ Usuário ADM criado com sucesso!');
    console.log('   Usuário:', username);
    console.log('   Senha:  ', password);
    console.log('\n⚠️  Troque a senha após o primeiro login!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('Falha ao criar admin:', e.message);
  process.exit(1);
});
