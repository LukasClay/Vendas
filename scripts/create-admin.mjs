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
    // ─── 1. Criar/atualizar admin ───────────────────────────────────
    const username = 'LucasCattani';
    const password = 'Binario00123@';
    const hash = await bcrypt.hash(password, 12);

    console.log(`[AdminSetup] Criando administrador: ${username}...`);

    await client.query(`
      INSERT INTO users (username, "passwordHash", role, name, active, "openId", "loginMethod", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (username) DO UPDATE SET "passwordHash" = $2, role = $3, name = $4, active = $5, "updatedAt" = NOW()
    `, [
      username,
      hash,
      'admin',
      'Lucas Cattani',
      true,
      `local_${username.toLowerCase()}`,
      'local'
    ]);

    console.log('✅ Usuário Administrador configurado com sucesso!');
    console.log('   Usuário:', username);

    // ─── 2. Garantir produto do sistema "Consulta Cartas" ───────────
    console.log('\n[SystemProducts] Verificando produto "Consulta Cartas"...');

    const existing = await client.query(
      `SELECT id, "isSystem", active, "deletedAt" FROM products WHERE name = $1 LIMIT 1`,
      ['Consulta Cartas']
    );

    if (existing.rows.length > 0) {
      const p = existing.rows[0];
      // Garante que está ativo, não deletado e marcado como sistema
      if (!p.isSystem || !p.active || p.deletedAt) {
        await client.query(
          `UPDATE products SET "isSystem" = true, active = true, "deletedAt" = NULL, "updatedAt" = NOW() WHERE id = $1`,
          [p.id]
        );
        console.log(`✅ Produto "Consulta Cartas" restaurado/atualizado (id=${p.id}).`);
      } else {
        console.log(`✅ Produto "Consulta Cartas" já existe (id=${p.id}). OK.`);
      }
    } else {
      await client.query(
        `INSERT INTO products (name, description, active, "isSystem", "createdAt", "updatedAt")
         VALUES ($1, $2, true, true, NOW(), NOW())`,
        ['Consulta Cartas', 'Consulta espiritual com horário agendado (produto do sistema)']
      );
      console.log('✅ Produto "Consulta Cartas" criado com sucesso.');
    }

    console.log('\n⚠️  Tudo pronto! Você já pode logar no sistema.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('Falha no setup:', e.message);
  process.exit(1);
});
