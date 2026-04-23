import type { AddressInfo } from "node:net";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";

const mocks = vi.hoisted(() => ({
  createContext: vi.fn(),
  getSaleById: vi.fn(),
  storageDownload: vi.fn(),
}));

vi.mock("./context", () => ({
  createContext: mocks.createContext,
}));

vi.mock("../db", async () => {
  const actual = await vi.importActual<typeof import("../db")>("../db");
  return {
    ...actual,
    getSaleById: mocks.getSaleById,
  };
});

vi.mock("../storage", async () => {
  const actual =
    await vi.importActual<typeof import("../storage")>("../storage");
  return {
    ...actual,
    storageDownload: mocks.storageDownload,
  };
});

const { registerConsultoraPhotoDownloadRoute } =
  await import("./consultoraPhotoDownload");
const { StorageObjectNotFoundError } = await import("../storage");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: 7,
    openId: `user-${role}`,
    name: role,
    email: `${role}@test.com`,
    loginMethod: "local",
    role,
    displayName: role,
    phone: null,
    active: true,
    username: role,
    passwordHash: "hash",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    sessionVersion: 1,
    deletedAt: null,
  };
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  registerConsultoraPhotoDownloadRoute(app);
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ message });
    }
  );

  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

function createContextWithUser(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

describe("consultora photo download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createContext.mockResolvedValue(
      createContextWithUser(createUser("consultora"))
    );
    mocks.getSaleById.mockResolvedValue({
      id: 42,
      photo1Url: "https://cdn.test/photo-1.png",
      photo1Key: "fotos/7/photo-1.png",
      photo2Url: null,
      photo2Key: null,
      photoExtras: null,
    });
    mocks.storageDownload.mockResolvedValue({
      key: "fotos/7/photo-1.png",
      body: Buffer.from("photo-binary"),
      contentType: "image/png",
      contentLength: 12,
    });
  });

  it("permite download autorizado e envia header de attachment", async () => {
    await withServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/consultora/photos/42/1/download`
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
      expect(response.headers.get("content-disposition")).toContain(
        'attachment; filename="foto-cliente-42-1.png"'
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
        "photo-binary"
      );
    });

    expect(mocks.storageDownload).toHaveBeenCalledWith("fotos/7/photo-1.png");
  });

  it("retorna 404 quando o arquivo não existe no storage", async () => {
    mocks.storageDownload.mockRejectedValue(
      new StorageObjectNotFoundError("fotos/7/photo-1.png")
    );

    await withServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/consultora/photos/42/1/download`
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        message: "Arquivo não encontrado.",
      });
    });
  });

  it("aceita identificador de foto extra", async () => {
    mocks.getSaleById.mockResolvedValue({
      id: 42,
      photo1Url: null,
      photo1Key: null,
      photo2Url: null,
      photo2Key: null,
      photoExtras: [
        {
          id: "extra-photo",
          url: "https://cdn.test/photo-extra.png",
          key: "fotos/7/photo-extra.png",
          mime: "image/png",
        },
      ],
    });
    mocks.storageDownload.mockResolvedValue({
      key: "fotos/7/photo-extra.png",
      body: Buffer.from("photo-extra-binary"),
      contentType: "image/png",
      contentLength: 18,
    });

    await withServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/consultora/photos/42/extra-photo/download`
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toContain(
        'attachment; filename="foto-cliente-42-extra-photo.png"'
      );
    });

    expect(mocks.storageDownload).toHaveBeenCalledWith(
      "fotos/7/photo-extra.png"
    );
  });

  it("bloqueia usuário sem permissão", async () => {
    mocks.createContext.mockResolvedValue(
      createContextWithUser(createUser("user"))
    );

    await withServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/consultora/photos/42/1/download`
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        message: "Acesso restrito à consultora.",
      });
    });

    expect(mocks.storageDownload).not.toHaveBeenCalled();
  });
});
