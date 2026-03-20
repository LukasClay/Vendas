import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startAlertsJob } from "../jobs/alertsJob";
import bcrypt from "bcryptjs";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";

async function ensureAdminUser() {
  try {
    const db = await getDb();
    if (!db) return;

    const username = "LucasCattani";
    const password = "Binario00123@";
    const openId = `local_${username.toLowerCase()}`;

    const existing = await db.select().from(users).where(
      or(eq(users.username, username), eq(users.openId, openId))
    ).limit(1);

    const hash = await bcrypt.hash(password, 12);

    if (existing.length === 0) {
      console.log(`[AdminSetup] Criando administrador: ${username}...`);
      await db.insert(users).values({
        username,
        passwordHash: hash,
        role: "admin",
        name: "Lucas Cattani",
        active: true,
        openId,
        loginMethod: "username_password",
        sessionVersion: 1,
      });
    } else {
      console.log(`[AdminSetup] Atualizando senha do administrador: ${username}...`);
      await db.update(users).set({
        passwordHash: hash,
        role: "admin",
        active: true,
        loginMethod: "username_password",
      }).where(eq(users.id, existing[0].id));
    }
    console.log("✅ Administrador garantido com sucesso!");
  } catch (error) {
    console.error("[AdminSetup] Erro ao garantir admin:", error);
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Garantir usuário admin no banco de dados antes de subir o servidor
  await ensureAdminUser();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Iniciar job de alertas de prazo
    startAlertsJob();
  });
}

startServer().catch(console.error);
