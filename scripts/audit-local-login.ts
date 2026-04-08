import "dotenv/config";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../drizzle/schema";
import { getLocalLoginHealth } from "../server/_core/localLoginHealth";

async function run() {
  const connectionString = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("Banco de dados indisponível. Defina RAILWAY_DATABASE_URL ou DATABASE_URL.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  const db = drizzle(pool);

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        active: users.active,
        deletedAt: users.deletedAt,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .orderBy(asc(users.name));

    const inconsistentUsers = rows
      .map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        active: user.active,
        ...getLocalLoginHealth({
          active: user.active,
          deletedAt: user.deletedAt,
          username: user.username,
          passwordHash: user.passwordHash,
        }),
      }))
      .filter((user) => user.localLoginHealth !== "ok");

    if (inconsistentUsers.length === 0) {
      console.log("Nenhuma conta inconsistente encontrada.");
      return;
    }

    console.table(
      inconsistentUsers.map((user) => ({
        id: user.id,
        name: user.name ?? "",
        username: user.username ?? "",
        role: user.role,
        active: user.active,
        localLoginHealth: user.localLoginHealth,
        localLoginMessage: user.localLoginMessage,
      })),
    );
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Falha na auditoria de login local:", error);
  process.exit(1);
});
