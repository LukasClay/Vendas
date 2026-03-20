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
    const openId = `local_${username.toLowerCase()}`;

    console.log(`[AdminFix] Configurando super administrador: ${username} (openId: ${openId})...`);

    // Limpa qualquer entrada anterior para evitar conflitos de unique keys
    await client.query('DELETE FROM users WHERE username = $1 OR "openId" = $2', [username, openId]);

    // Insere o novo usuário com todos os campos necessários para o login local funcionar
    await client.query(`
      INSERT INTO users (
        username, 
        "passwordHash", 
        role, 
        name, 
        active, 
        "openId", 
        "loginMethod", 
        "sessionVersion",
        "createdAt", 
        "updatedAt", 
        "lastSignedIn"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
    `, [
      username,
      hash,
      'admin',
      'Lucas Cattani',
      true,
      openId,
      'username_password', // Importante para o fluxo de login local
      1
    ]);

    console.log('\n✅ Super Administrador configurado com sucesso total!');
    console.log('   Usuário:', username);
    console.log('   Senha:  ', password);
    console.log('\n⚠️  O Railway executará este script no próximo deploy!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('Falha ao configurar admin:', e.message);
  process.exit(1);
});
