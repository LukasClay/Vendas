import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import {
  ClientIdentityConflictError,
  ClientNotFoundError,
} from "./clientIdentity";
import { ConsultationSlotUnavailableError } from "./db";

const mocks = vi.hoisted(() => ({
  createSaleWithResolvedClient: vi.fn(),
  createAuditLog: vi.fn(),
  getDb: vi.fn(),
  getProductById: vi.fn(),
  storagePut: vi.fn(),
  storageDelete: vi.fn(),
  emitSseEvent: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createSaleWithResolvedClient: mocks.createSaleWithResolvedClient,
    createAuditLog: mocks.createAuditLog,
    getDb: mocks.getDb,
    getProductById: mocks.getProductById,
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

vi.mock("./_core/sse", () => ({
  emitSseEvent: mocks.emitSseEvent,
}));

vi.mock("nanoid", () => ({
  nanoid: () => "fixed-id",
}));

const { salesRouter } = await import("./routers/sales");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const resolvedClient = {
  id: 44,
  fullName: "Maria Canonica",
  birthDate: "1988-02-03",
  phone: "11911112222",
};

function createSellerContext(id = 17): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `seller-${id}`,
    email: `seller${id}@test.com`,
    name: `Vendedor ${id}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    displayName: `Vendedor ${id}`,
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

function createInput() {
  return {
    clientId: 44,
    clientName: "Nome vindo do formulario",
    clientBirthDate: "1990-05-20",
    clientPhone: "11999998888",
    productName: "Trabalho Individual",
    productCategory: "individual" as const,
    saleDate: "2026-07-21",
    amount: 150,
  };
}

function createAvailableSlotDb(
  slotId: number,
  overrides: Partial<{
    sold: boolean;
    saleId: number | null;
    status: "pendente" | "realizada" | "cancelada";
    consultationDate: string;
    consultationTime: string;
  }> = {}
) {
  const limit = vi.fn().mockResolvedValue([
    {
      id: slotId,
      sold: false,
      saleId: null,
      status: "pendente",
      consultationDate: "2099-12-31",
      consultationTime: "23:59",
      ...overrides,
    },
  ]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select };
}

function createEmptySlotDb() {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select };
}

describe("sales.create client integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSaleWithResolvedClient.mockResolvedValue({
      saleId: 901,
      client: resolvedClient,
    });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.getDb.mockResolvedValue(null);
    mocks.getProductById.mockResolvedValue(undefined);
    mocks.storagePut.mockResolvedValue({
      key: "ignored-by-router",
      url: "https://cdn.test/uploaded-file",
    });
    mocks.storageDelete.mockResolvedValue(undefined);
  });

  it("passes client identity and actor into the transaction", async () => {
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(caller.create(createInput())).resolves.toEqual({
      success: true,
      saleId: 901,
    });

    expect(mocks.createSaleWithResolvedClient).toHaveBeenCalledWith({
      client: {
        clientId: 44,
        fullName: "Nome vindo do formulario",
        birthDate: "1990-05-20",
        phone: "11999998888",
      },
      actor: { id: 17, role: "user" },
      audit: {
        userId: 17,
        userName: "Vendedor 17",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      sale: expect.objectContaining({
        sellerId: 17,
        sellerName: "Vendedor 17",
        productName: "Trabalho Individual",
        productCategory: "individual",
        amount: "150",
      }),
      consultationSlotId: undefined,
    });
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("returns success when the post-commit SSE notification fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.emitSseEvent.mockImplementationOnce(() => {
      throw new Error("listener failed");
    });
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(caller.create(createInput())).resolves.toEqual({
      success: true,
      saleId: 901,
    });
    expect(mocks.createSaleWithResolvedClient).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("uses the canonical product name when productId is provided", async () => {
    mocks.getProductById.mockResolvedValue({
      id: 99,
      name: "Consulta Cartas",
      active: true,
      deletedAt: null,
      allowedCategories: ["individual", "promocao", "coletivo"],
    });
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.create({
        ...createInput(),
        productId: 99,
        productName: "Outro produto",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mocks.getProductById).toHaveBeenCalledWith(99);
    expect(mocks.createSaleWithResolvedClient).not.toHaveBeenCalled();
  });

  it("rejects a slot for products other than Consulta Cartas", async () => {
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.create({
        ...createInput(),
        consultationSlotId: 77,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.createSaleWithResolvedClient).not.toHaveBeenCalled();
  });

  it("rejects a cancelled slot before uploading or creating a sale", async () => {
    const slotId = 78;
    mocks.getDb.mockResolvedValue(
      createAvailableSlotDb(slotId, { status: "cancelada" })
    );
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.create({
        ...createInput(),
        productName: "Consulta Cartas",
        consultationSlotId: slotId,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(mocks.createSaleWithResolvedClient).not.toHaveBeenCalled();
  });

  it("rejects a consultation slot that no longer exists", async () => {
    const slotId = 79;
    mocks.getDb.mockResolvedValue(createEmptySlotDb());
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.create({
        ...createInput(),
        productName: "Consulta Cartas",
        consultationSlotId: slotId,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(mocks.createSaleWithResolvedClient).not.toHaveBeenCalled();
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("maps an identity conflict to CONFLICT without auditing", async () => {
    mocks.createSaleWithResolvedClient.mockRejectedValue(
      new ClientIdentityConflictError(["fullName"])
    );
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(caller.create(createInput())).rejects.toMatchObject({
      code: "CONFLICT",
    });

    expect(mocks.createSaleWithResolvedClient).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("maps an unavailable selected client to NOT_FOUND without auditing", async () => {
    mocks.createSaleWithResolvedClient.mockRejectedValue(
      new ClientNotFoundError(44)
    );
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(caller.create(createInput())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(mocks.createSaleWithResolvedClient).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("maps an unexpected transaction failure to INTERNAL_SERVER_ERROR", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.createSaleWithResolvedClient.mockRejectedValue(
      new Error("database down")
    );
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(caller.create(createInput())).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });

    expect(mocks.createSaleWithResolvedClient).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("removes an uploaded key when client identity conflicts", async () => {
    mocks.createSaleWithResolvedClient.mockRejectedValue(
      new ClientIdentityConflictError(["phone"])
    );
    const caller = salesRouter.createCaller(createSellerContext());
    const attachmentBase64 = Buffer.from("proof").toString("base64");

    await expect(
      caller.create({
        ...createInput(),
        attachmentBase64,
        attachmentMime: "application/pdf",
        attachmentName: "proof.pdf",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(mocks.storagePut).toHaveBeenCalledWith(
      "comprovantes/17/fixed-id.pdf",
      Buffer.from("proof"),
      "application/pdf"
    );
    expect(mocks.storageDelete).toHaveBeenCalledWith(
      "comprovantes/17/fixed-id.pdf"
    );
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("cleans earlier uploads when a later photo is invalid", async () => {
    const caller = salesRouter.createCaller(createSellerContext());
    const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");

    await expect(
      caller.create({
        ...createInput(),
        attachmentBase64: Buffer.from("proof").toString("base64"),
        attachmentMime: "application/pdf",
        photo1Base64: Buffer.from("photo-one").toString("base64"),
        photo1Mime: "image/jpeg",
        photo2Base64: tooLarge,
        photo2Mime: "image/jpeg",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mocks.storagePut).toHaveBeenCalledTimes(2);
    expect(mocks.storageDelete).toHaveBeenCalledWith(
      "comprovantes/17/fixed-id.pdf"
    );
    expect(mocks.storageDelete).toHaveBeenCalledWith("fotos/17/fixed-id.jpg");

    expect(mocks.createSaleWithResolvedClient).not.toHaveBeenCalled();
  });
  it("maps a transaction slot race to CONFLICT and removes uploaded media", async () => {
    const slotId = 77;
    mocks.getDb.mockResolvedValue(createAvailableSlotDb(slotId));
    mocks.createSaleWithResolvedClient.mockRejectedValue(
      new ConsultationSlotUnavailableError()
    );
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.create({
        ...createInput(),
        productName: "Consulta Cartas",
        consultationSlotId: slotId,
        attachmentBase64: Buffer.from("slot-proof").toString("base64"),
        attachmentMime: "application/pdf",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(mocks.createSaleWithResolvedClient).toHaveBeenCalledWith(
      expect.objectContaining({ consultationSlotId: slotId })
    );
    expect(mocks.storageDelete).toHaveBeenCalledWith(
      "comprovantes/17/fixed-id.pdf"
    );
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
});
