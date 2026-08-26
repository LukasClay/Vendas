import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpRateLimit } from "./rateLimit";

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server!.close(error => (error ? reject(error) : resolve()));
  });
  server = undefined;
});

describe("MCP rate limit", () => {
  it("returns 429 after the configured per-IP allowance", async () => {
    const app = express();
    app.use(createMcpRateLimit(2));
    app.get("/mcp", (_request, response) => response.json({ ok: true }));

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/mcp`;

    expect((await fetch(url)).status).toBe(200);
    expect((await fetch(url)).status).toBe(200);
    const blocked = await fetch(url);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(await blocked.json()).toEqual({
      error: "rate_limit_exceeded",
      error_description: "Too many MCP requests",
    });
  });
});
