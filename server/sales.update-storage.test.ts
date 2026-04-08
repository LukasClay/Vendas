import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  getSaleById: vi.fn(),
  updateSale: vi.fn(),
  storagePut: vi.fn(),
  storageDelete: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createAuditLog: mocks.createAuditLog,
    getSaleById: mocks.getSaleById,
    updateSale: mocks.updateSale,
  };
});

vi.mock("./storage", async () => {
  const actual = await vi.importActual<typeof import("./storage")>("./storage");
  return {
    ...actual,
    storagePut: mocks.storagePut,
    storageDelete: mocks.storageDelete,
  };
});

vi.mock("nanoid", () => ({
  nanoid: () => "fixed-id",
}));

const { salesRouter } = await import("./routers/sales");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(id = 7): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `user-${id}`,
    email: `user${id}@test.com`,
    name: `Admin ${id}`,
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    displayName: `Admin ${id}`,
    phone: null,
    active: true,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

describe("sales.update storage cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.getSaleById.mockResolvedValue(undefined);
    mocks.updateSale.mockResolvedValue(undefined);
    mocks.storagePut.mockResolvedValue({ key: "ignored", url: "https://cdn.test/uploaded-file" });
    mocks.storageDelete.mockResolvedValue(undefined);
  });

  it("deleta a key antiga somente depois de atualizar a venda ao trocar a foto", async () => {
    mocks.getSaleById.mockResolvedValue({ photo1Key: "fotos/old-photo.jpg" });

    const caller = salesRouter.createCaller(createAdminContext());

    await caller.update({
      id: 10,
      photo1Base64: Buffer.from("new-photo").toString("base64"),
      photo1Mime: "image/png",
    });

    expect(mocks.updateSale).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        photo1Url: "https://cdn.test/uploaded-file",
        photo1Key: "fotos/7/fixed-id.png",
      }),
    );
    expect(mocks.storageDelete).toHaveBeenCalledWith("fotos/old-photo.jpg");
    expect(mocks.updateSale.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storageDelete.mock.invocationCallOrder[0],
    );
  });

  it("remove a foto antiga do storage quando o admin marca remoção", async () => {
    mocks.getSaleById.mockResolvedValue({ photo1Key: "fotos/old-photo.jpg" });

    const caller = salesRouter.createCaller(createAdminContext());

    await caller.update({
      id: 11,
      removePhoto1: true,
    });

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateSale).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        photo1Url: null,
        photo1Key: null,
      }),
    );
    expect(mocks.storageDelete).toHaveBeenCalledWith("fotos/old-photo.jpg");
  });

  it("limpa o arquivo recém-enviado se o update do banco falhar", async () => {
    mocks.getSaleById.mockResolvedValue({ attachmentKey: "comprovantes/old-proof.pdf" });
    mocks.updateSale.mockRejectedValue(new Error("db failed"));

    const caller = salesRouter.createCaller(createAdminContext());

    await expect(
      caller.update({
        id: 12,
        attachmentBase64: Buffer.from("pdf-content").toString("base64"),
        attachmentMime: "application/pdf",
      }),
    ).rejects.toThrow("db failed");

    expect(mocks.storageDelete).toHaveBeenCalledWith("comprovantes/7/fixed-id.pdf");
    expect(mocks.storageDelete).not.toHaveBeenCalledWith("comprovantes/old-proof.pdf");
  });
});
