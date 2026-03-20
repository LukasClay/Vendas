/**
 * scripts/seed.ts
 *
 * Cria o usuário administrador inicial no banco de dados.
 * Gera uma senha segura aleatória e exibe no console.
 *
 * Uso:
 *   RAILWAY_DATABASE_URL=<url> npx tsx scripts/seed.ts
 *   DATABASE_URL=<url>         npx tsx scripts/seed.ts
 */

import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";

// ─── Database connection ──────────────────────────────────────────────────────

const connStr =
  process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

if (!connStr) {
  console.error("❌ Nenhuma variável de conexão encontrada.");
  console.error(
    "   Defina RAILWAY_DATABASE_URL ou DATABASE_URL antes de executar este script."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: connStr,
  max: 5,
  connectionTimeoutMillis: 15000,
  ssl: connStr.includes("railway") ? { rejectUnauthorized: false } : undefined,
});

const db = drizzle(pool);

// ─── Password generator ───────────────────────────────────────────────────────

/**
 * Gera uma senha criptograficamente segura de 16 caracteres com
 * letras maiúsculas, minúsculas, números e símbolos.
 */
function generateSecurePassword(): string {
  const upper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower   = "abcdefghijklmnopqrstuvwxyz";
  const digits  = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?";
  const all     = upper + lower + digits + symbols;

  const pick = (charset: string): string =>
    charset[randomBytes(1)[0] % charset.length];

  // Garante pelo menos um caractere de cada categoria
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];

  // Preenche os 12 caracteres restantes aleatoriamente
  const extra = Array.from({ length: 12 }, () => pick(all));

  // Embaralha usando Fisher-Yates com bytes criptográficos
  const chars = [...required, ...extra];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const username = "LucasCattani";
  const name     = "Lucas Cattani";
  const role     = "admin" as const;
  const openId   = `local_${randomUUID()}`;

  // Idempotência: não recria se o usuário já existir
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing.length > 0) {
    console.log(`ℹ️  Usuário "${username}" já existe (id=${existing[0].id}).`);
    console.log(
      "   Para redefinir a senha, use a opção de reset no painel de administração."
    );
    return;
  }

  const password     = generateSecurePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  console.log(`[Seed] Criando administrador: ${username}...`);

  await db.insert(users).values({
    username,
    passwordHash,
    openId,
    role,
    name,
    loginMethod: "username_password",
    active: true,
    lastSignedIn: new Date(),
    sessionVersion: 1,
  });

  console.log("\n✅ Usuário Administrador criado com sucesso!");
  console.log("─────────────────────────────────────────");
  console.log("   Usuário :", username);
  console.log("   Senha   :", password);
  console.log("─────────────────────────────────────────");
  console.log("⚠️  Guarde esta senha agora — ela não será exibida novamente.");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

seed()
  .catch((err) => {
    console.error("❌ Falha ao executar seed:", err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
