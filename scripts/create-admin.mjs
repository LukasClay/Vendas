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
    const username = 'LucasCattani';
    const password = 'Binario00123@';
    const hash = await bcrypt.hash(password, 12);

    console.log(`[AdminSetup] Criando administrador: ${username}...`);

    await client.query(`
      INSERT INTO users (username, password, role, name, active, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (username) DO UPDATE SET password = $2, role = $3, name = $4, active = $5, "updatedAt" = NOW()
    `, [
      username,
      hash,
      'admin',
      'Lucas Cattani',
      true
    ]);

    console.log('\n✅ Usuário Administrador configurado com sucesso!');
    console.log('   Usuário:', username);
    console.log('   Senha:  ', password);
    console.log('\n⚠️  Você já pode logar no sistema!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('Falha ao criar admin:', e.message);
  process.exit(1);
});
