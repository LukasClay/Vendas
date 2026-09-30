import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createContext: vi.fn(),
  getDb: vi.fn(),
  storageDownload: vi.fn(),
  rows: vi.fn(),
}));
vi.mock("./context", () => ({ createContext: mocks.createContext }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../storage", async () => ({
  ...(await vi.importActual<typeof import("../storage")>("../storage")),
  storageDownload: mocks.storageDownload,
}));

const { registerSandboxMediaRoute } = await import("./sandboxMedia");
const { StorageObjectNotFoundError } = await import("../storage");

const sale = {
  sellerId: 7,
  deletedAt: null,
  attachmentKey: "comprovantes/7/test.pdf",
  attachmentExtras: null,
  photo1Key: "fotos/7/test.png",
  photo2Key: null,
  photoExtras: null,
};

async function request(path = "/api/sandbox/media/fotos/7/test.png") {
  const app = express();
  registerSandboxMediaRoute(app);
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await response.text();
    return { status: response.status, headers: response.headers, body };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    );
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VENDAS_SANDBOX_MODE", "1");
  mocks.createContext.mockResolvedValue({ user: { id: 7, role: "user" } });
  mocks.rows.mockResolvedValue([sale]);
  mocks.getDb.mockResolvedValue({
    select: () => ({
      from: () => ({ where: () => ({ limit: mocks.rows }) }),
    }),
  });
  mocks.storageDownload.mockResolvedValue({
    body: Buffer.from("test image"),
    contentType: "image/png",
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("private sandbox media", () => {
  it("does not register the route in production", async () => {
    vi.stubEnv("VENDAS_SANDBOX_MODE", "0");
    expect((await request()).status).toBe(404);
    expect(mocks.createContext).not.toHaveBeenCalled();
    expect(mocks.storageDownload).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests before database or storage access", async () => {
    mocks.createContext.mockResolvedValue({ user: null });
    expect((await request()).status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.storageDownload).not.toHaveBeenCalled();
  });

  it("serves a seller's own photo with private caching and safe content headers", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.body).toBe("test image");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(mocks.storageDownload).toHaveBeenCalledWith("fotos/7/test.png");
  });

  it("denies another seller's media without downloading it", async () => {
    mocks.createContext.mockResolvedValue({ user: { id: 8, role: "user" } });
    expect((await request()).status).toBe(404);
    expect(mocks.storageDownload).not.toHaveBeenCalled();
  });

  it("permits consultant photos but denies receipts", async () => {
    mocks.createContext.mockResolvedValue({
      user: { id: 8, role: "consultora" },
    });
    expect((await request()).status).toBe(200);
    mocks.storageDownload.mockClear();
    expect(
      (await request("/api/sandbox/media/comprovantes/7/test.pdf")).status
    ).toBe(404);
    expect(mocks.storageDownload).not.toHaveBeenCalled();
  });

  it("keeps deleted-sale media accessible only to the administrator", async () => {
    mocks.rows.mockResolvedValue([{ ...sale, deletedAt: new Date() }]);
    expect((await request()).status).toBe(404);
    mocks.createContext.mockResolvedValue({ user: { id: 8, role: "admin" } });
    expect((await request()).status).toBe(200);
  });

  it("permits referenced extra media and rejects an unreferenced key", async () => {
    mocks.rows.mockResolvedValue([
      {
        ...sale,
        photoExtras: [
          {
            id: "extra",
            key: "fotos/7/extra.png",
            url: "/private",
            mime: "image/png",
          },
        ],
      },
    ]);
    expect((await request("/api/sandbox/media/fotos/7/extra.png")).status).toBe(
      200
    );
    mocks.storageDownload.mockClear();
    expect(
      (await request("/api/sandbox/media/fotos/7/unknown.png")).status
    ).toBe(404);
    expect(mocks.storageDownload).not.toHaveBeenCalled();
  });

  it("rejects invalid key prefixes and traversal before database access", async () => {
    for (const key of [
      "other/file.png",
      "fotos/%2e%2e%2ftest.png",
      "fotos/%5ctest.png",
    ]) {
      expect((await request(`/api/sandbox/media/${key}`)).status).toBe(400);
    }
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns 404 for missing private objects", async () => {
    mocks.storageDownload.mockRejectedValue(
      new StorageObjectNotFoundError("test")
    );
    expect((await request()).status).toBe(404);
  });

  it("downloads active document types without executing them on the app origin", async () => {
    mocks.storageDownload.mockResolvedValue({
      body: Buffer.from("<script>test</script>"),
      contentType: "text/html",
    });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/octet-stream"
    );
    expect(response.headers.get("content-disposition")).toBe("attachment");
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox"
    );
  });
});
