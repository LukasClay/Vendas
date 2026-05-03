import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerConsultoraPhotoDownloadRoute } from "./consultoraPhotoDownload";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startAlertsJob } from "../jobs/alertsJob";
import { startReportsJob } from "../jobs/reportsJob";
import { ensureSystemProducts, ensurePhotoColumns, ensureMonthlyGoalColumn, getDb } from "../db";
import { sseEmitter } from "./sse";
import { sdk } from "./sdk";
import { sql } from "drizzle-orm";
import { logKnownHttpError } from "./httpRequestErrors";

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
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1); // Confia no proxy do Railway para pegar o IP real

  // Configure body parser with safe size limit for file uploads
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  // ─── Health Check (Railway zero-downtime deploy) ──────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        return res
          .status(503)
          .json({ status: "error", message: "Database not configured" });
      }
      // Verifica conexão real com o banco
      await db.execute(sql`SELECT 1`);
      return res.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("[HealthCheck] Falha:", err);
      return res
        .status(503)
        .json({ status: "error", message: "Database connection failed" });
    }
  });

  // ─── SSE — tempo real para ADM ────────────────────────────────────────────
  app.get("/api/events", async (req, res) => {
    try {
      const sessionCookie = sdk.getSessionCookieFromRequest(req);
      if (!sessionCookie) { res.status(401).end(); return; }
      const user = await sdk.authenticateRequest(req, sessionCookie);
      if (user.role !== "admin") { res.status(403).end(); return; }
    } catch {
      res.status(401).end();
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (channel: string) => {
      res.write(`data: ${channel}\n\n`);
    };

    sseEmitter.on("event", send);

    // Heartbeat a cada 25s para evitar timeout do Railway
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 25000);

    req.on("close", () => {
      sseEmitter.off("event", send);
      clearInterval(heartbeat);
    });
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  registerConsultoraPhotoDownloadRoute(app);
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

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    const knownError = logKnownHttpError(req, error);
    if (!knownError) {
      next(error);
      return;
    }

    if (req.aborted || req.destroyed || res.headersSent || res.writableEnded) {
      return;
    }

    res.status(knownError.status).json({ message: knownError.message });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Garante que produtos do sistema existam no banco antes de aceitar requests
  await ensureSystemProducts();
  await ensurePhotoColumns();
  await ensureMonthlyGoalColumn();

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Iniciar job de alertas de prazo
    startAlertsJob();
    // Iniciar job de relatorios por email
    startReportsJob();
  });
}

startServer().catch(console.error);
