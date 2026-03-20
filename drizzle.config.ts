import { defineConfig } from "drizzle-kit";

const connectionString = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("RAILWAY_DATABASE_URL ou DATABASE_URL é necessária para rodar comandos do Drizzle");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
