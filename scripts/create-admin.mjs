import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'crypto';

const { Pool } = pg;

const connStr = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
if (!connStr) {
  console.error('❌ Nenhuma variável de conexão encontrada.');
  console.error('   Defina RAILWAY_DATABASE_URL ou DATABASE_URL antes de executar este script.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connStr,
  ssl: connStr.includes('railway') ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
});

/**
 * Gera uma senha segura com pelo menos 16 caracteres contendo
 * letras maiúsculas, minúsculas, números e símbolos.
 */
function generateSecurePassword() {
  const upper  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower  = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  const all = upper + lower + digits + symbols;

  // Garante pelo menos um caractere de cada categoria
  const pick = (charset) => charset[randomBytes(1)[0] % charset.length];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];

  // Preenche os 12 caracteres restantes aleatoriamente
  const extra = Array.from({ length: 12 }, () => pick(all));

  // Embaralha usando Fisher-Yates com bytes criptográficos
  const chars = [...required, ...extra];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

async function run() {
  const client = await pool.connect();
  try {
    const username = 'LucasCattani';
    const name     = 'Lucas Cattani';
    const role     = 'admin';
    const openId   = `local_${randomUUID()}`;

    // Verifica se o usuário já existe
    const existing = await client.query(
      'SELECT id, username FROM users WHERE username = $1 LIMIT 1',
      [username]
    );

    if (existing.rows.length > 0) {
      console.log(`ℹ️  Usuário "${username}" já existe (id=${existing.rows[0].id}).`);
      console.log('   Para redefinir a senha, use a opção de reset no painel de administração.');
      return;
    }

    const password = generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, 12);

    console.log(`[AdminSetup] Criando administrador: ${username}...`);

    await client.query(
      `INSERT INTO users
         (username, "passwordHash", "openId", role, name, "loginMethod", active, "createdAt", "updatedAt", "lastSignedIn", "sessionVersion")
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW(), 1)`,
      [username, passwordHash, openId, role, name, 'username_password', true]
    );

    console.log('\n✅ Usuário Administrador criado com sucesso!');
    console.log('─────────────────────────────────────────');
    console.log('   Usuário :', username);
    console.log('   Senha   :', password);
    console.log('─────────────────────────────────────────');
    console.log('⚠️  Guarde esta senha agora — ela não será exibida novamente.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('❌ Falha ao criar admin:', e.message);
  process.exit(1);
});
