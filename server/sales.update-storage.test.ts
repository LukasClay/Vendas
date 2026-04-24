import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  getSaleById: vi.fn(),
  getDb: vi.fn(),
  updateSale: vi.fn(),
  updateSaleAndReleaseConsultationSlot: vi.fn(),
  storagePut: vi.fn(),
  storageDelete: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createAuditLog: mocks.createAuditLog,
    getSaleById: mocks.getSaleById,
    getDb: mocks.getDb,
    updateSale: mocks.updateSale,
    updateSaleAndReleaseConsultationSlot:
      mocks.updateSaleAndReleaseConsultationSlot,
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

function createSellerContext(id = 42): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `user-${id}`,
    email: `user${id}@test.com`,
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

describe("sales.update storage cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.getSaleById.mockResolvedValue(undefined);
    mocks.updateSale.mockResolvedValue(undefined);
    mocks.updateSaleAndReleaseConsultationSlot.mockResolvedValue(undefined);
    mocks.storagePut.mockResolvedValue({
      key: "ignored",
      url: "https://cdn.test/uploaded-file",
    });
    mocks.storageDelete.mockResolvedValue(undefined);
    mocks.getDb.mockResolvedValue(null);
  });

  it("rejeita venda inexistente antes de qualquer upload", async () => {
    const caller = salesRouter.createCaller(createAdminContext());

    await expect(
      caller.update({
        id: 999,
        attachmentBase64: Buffer.from("new-proof").toString("base64"),
        attachmentMime: "application/pdf",
      })
    ).rejects.toThrow("Venda não encontrada.");

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateSale).not.toHaveBeenCalled();
  });

  it("rejeita campos extras no create usado por vendedor e consultora", async () => {
    const caller = salesRouter.createCaller(createAdminContext());

    await expect(
      caller.create({
        clientName: "Cliente",
        productName: "Trabalho Individual",
        productCategory: "individual",
        saleDate: "2026-04-23",
        amount: 100,
        extraPhotos: [
          {
            base64: Buffer.from("extra-photo").toString("base64"),
            mime: "image/jpeg",
            name: "Foto extra",
          },
        ],
      } as any)
    ).rejects.toThrow();

    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejeita MIME invalido no comprovante do sales.create antes do upload", async () => {
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.create({
        clientName: "Cliente",
        productName: "Trabalho Individual",
        productCategory: "individual",
        saleDate: "2026-04-23",
        amount: 100,
        attachmentBase64: Buffer.from("proof").toString("base64"),
        attachmentMime: "text/html",
      })
    ).rejects.toThrow("Formato invalido. Use JPG, PNG, WEBP ou PDF.");

    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejeita MIME invalido em foto do sales.create antes do upload", async () => {
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.create({
        clientName: "Cliente",
        productName: "Trabalho Individual",
        productCategory: "individual",
        saleDate: "2026-04-23",
        amount: 100,
        photo1Base64: Buffer.from("photo").toString("base64"),
        photo1Mime: "application/pdf",
      })
    ).rejects.toThrow("Formato invalido. Use JPG, PNG ou WEBP.");

    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejeita slot de consulta em venda que nao e Consulta Cartas", async () => {
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.create({
        clientName: "Cliente",
        productName: "Trabalho Individual",
        productCategory: "individual",
        saleDate: "2026-04-23",
        amount: 100,
        consultationSlotId: 123,
      })
    ).rejects.toThrow("Somente Consulta Cartas pode reservar horario");

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("bloqueia converter venda comum em Consulta Cartas sem agendamento", async () => {
    mocks.getSaleById.mockResolvedValue({
      productName: "Trabalho Individual",
    });

    const caller = salesRouter.createCaller(createAdminContext());

    await expect(
      caller.update({
        id: 30,
        productName: "Consulta Cartas",
      })
    ).rejects.toThrow("crie a venda pelo fluxo de agendamento");

    expect(mocks.updateSale).not.toHaveBeenCalled();
    expect(mocks.updateSaleAndReleaseConsultationSlot).not.toHaveBeenCalled();
  });

  it("libera o slot quando Consulta Cartas vira venda comum", async () => {
    mocks.getSaleById.mockResolvedValue({
      productName: "Consulta Cartas",
    });

    const caller = salesRouter.createCaller(createAdminContext());

    await caller.update({
      id: 31,
      productName: "Trabalho Individual",
    });

    expect(mocks.updateSale).not.toHaveBeenCalled();
    expect(mocks.updateSaleAndReleaseConsultationSlot).toHaveBeenCalledWith(
      31,
      expect.objectContaining({ productName: "Trabalho Individual" })
    );
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
      })
    );
    expect(mocks.storageDelete).toHaveBeenCalledWith("fotos/old-photo.jpg");
    expect(mocks.updateSale.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storageDelete.mock.invocationCallOrder[0]
    );

    const auditDetails = JSON.parse(
      mocks.createAuditLog.mock.calls[0][0].details
    );
    expect(auditDetails.changes.photo1Key).toBeUndefined();
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
      })
    );
    expect(mocks.storageDelete).toHaveBeenCalledWith("fotos/old-photo.jpg");
  });

  it("limpa o arquivo recém-enviado se o update do banco falhar", async () => {
    mocks.getSaleById.mockResolvedValue({
      attachmentKey: "comprovantes/old-proof.pdf",
    });
    mocks.updateSale.mockRejectedValue(new Error("db failed"));

    const caller = salesRouter.createCaller(createAdminContext());

    await expect(
      caller.update({
        id: 12,
        attachmentBase64: Buffer.from("pdf-content").toString("base64"),
        attachmentMime: "application/pdf",
      })
    ).rejects.toThrow("db failed");

    expect(mocks.storageDelete).toHaveBeenCalledWith(
      "comprovantes/7/fixed-id.pdf"
    );
    expect(mocks.storageDelete).not.toHaveBeenCalledWith(
      "comprovantes/old-proof.pdf"
    );
  });

  it("limpa uploads já concluídos se um segundo storagePut falhar antes do update", async () => {
    mocks.getSaleById.mockResolvedValue({
      photo1Key: "fotos/old-photo-1.jpg",
      photo2Key: "fotos/old-photo-2.jpg",
    });
    mocks.storagePut
      .mockResolvedValueOnce({
        key: "fotos/7/fixed-id.jpg",
        url: "https://cdn.test/photo-1",
      })
      .mockRejectedValueOnce(new Error("upload failed"));

    const caller = salesRouter.createCaller(createAdminContext());

    await expect(
      caller.update({
        id: 13,
        photo1Base64: Buffer.from("new-photo-1").toString("base64"),
        photo1Mime: "image/jpeg",
        photo2Base64: Buffer.from("new-photo-2").toString("base64"),
        photo2Mime: "image/jpeg",
      })
    ).rejects.toThrow("upload failed");

    expect(mocks.updateSale).not.toHaveBeenCalled();
    expect(mocks.storageDelete).toHaveBeenCalledWith("fotos/7/fixed-id.jpg");
    expect(mocks.storageDelete).not.toHaveBeenCalledWith(
      "fotos/old-photo-1.jpg"
    );
    expect(mocks.storageDelete).not.toHaveBeenCalledWith(
      "fotos/old-photo-2.jpg"
    );
  });

  it("rejeita upload de foto para Consulta Cartas", async () => {
    mocks.getSaleById.mockResolvedValue({
      productName: "Consulta Cartas",
      photo1Key: null,
      photo2Key: null,
    });

    const caller = salesRouter.createCaller(createAdminContext());

    await expect(
      caller.update({
        id: 14,
        photo1Base64: Buffer.from("new-photo").toString("base64"),
        photo1Mime: "image/jpeg",
      })
    ).rejects.toThrow("Consulta Cartas não permite fotos do cliente.");

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateSale).not.toHaveBeenCalled();
  });

  it("adiciona comprovantes extras e remove anexos extras marcados", async () => {
    mocks.getSaleById.mockResolvedValue({
      attachmentUrl: "https://cdn.test/legacy-proof.pdf",
      attachmentKey: "comprovantes/old-proof.pdf",
      attachmentExtras: [
        {
          id: "keep-proof",
          url: "https://cdn.test/keep-proof.pdf",
          key: "comprovantes/keep-proof.pdf",
          mime: "application/pdf",
          name: "Comprovante 2",
        },
        {
          id: "remove-proof",
          url: "https://cdn.test/remove-proof.pdf",
          key: "comprovantes/remove-proof.pdf",
          mime: "application/pdf",
          name: "Comprovante 3",
        },
      ],
    });

    const caller = salesRouter.createCaller(createAdminContext());

    await caller.update({
      id: 15,
      extraAttachments: [
        {
          base64: Buffer.from("extra-proof").toString("base64"),
          mime: "application/pdf",
          name: "Comprovante novo",
        },
      ],
      removeAttachmentIds: ["remove-proof"],
    });

    expect(mocks.updateSale).toHaveBeenCalledWith(
      15,
      expect.objectContaining({
        attachmentExtras: [
          expect.objectContaining({
            id: "keep-proof",
            key: "comprovantes/keep-proof.pdf",
          }),
          expect.objectContaining({
            id: "fixed-id",
            key: "comprovantes/7/fixed-id.pdf",
            name: "Comprovante novo",
          }),
        ],
      })
    );
    expect(mocks.storageDelete).toHaveBeenCalledWith(
      "comprovantes/remove-proof.pdf"
    );

    const auditDetails = JSON.parse(
      mocks.createAuditLog.mock.calls[0][0].details
    );
    const auditJson = JSON.stringify(auditDetails);
    expect(auditJson).not.toContain("comprovantes/");
    expect(auditDetails.changes.attachmentExtras).toEqual([
      {
        id: "keep-proof",
        mime: "application/pdf",
        name: "Comprovante 2",
      },
      {
        id: "fixed-id",
        mime: "application/pdf",
        name: "Comprovante novo",
      },
    ]);
  });

  it("rejeita quando o total de comprovantes excede o limite do ADM", async () => {
    mocks.getSaleById.mockResolvedValue({
      attachmentUrl: "https://cdn.test/legacy-proof.pdf",
      attachmentExtras: [
        {
          id: "proof-2",
          url: "https://cdn.test/proof-2.pdf",
          key: "comprovantes/proof-2.pdf",
          mime: "application/pdf",
        },
        {
          id: "proof-3",
          url: "https://cdn.test/proof-3.pdf",
          key: "comprovantes/proof-3.pdf",
          mime: "application/pdf",
        },
        {
          id: "proof-4",
          url: "https://cdn.test/proof-4.pdf",
          key: "comprovantes/proof-4.pdf",
          mime: "application/pdf",
        },
        {
          id: "proof-5",
          url: "https://cdn.test/proof-5.pdf",
          key: "comprovantes/proof-5.pdf",
          mime: "application/pdf",
        },
      ],
    });

    const caller = salesRouter.createCaller(createAdminContext());

    await expect(
      caller.update({
        id: 16,
        extraAttachments: [
          {
            base64: Buffer.from("overflow-proof").toString("base64"),
            mime: "application/pdf",
            name: "Comprovante 6",
          },
        ],
      })
    ).rejects.toThrow("O ADM pode manter no maximo 5 comprovantes por venda.");

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateSale).not.toHaveBeenCalled();
  });

  it("adiciona fotos extras e respeita limite total de fotos", async () => {
    mocks.getSaleById.mockResolvedValue({
      productName: "Trabalho Individual",
      photo1Url: "https://cdn.test/photo-1.jpg",
      photo1Key: "fotos/photo-1.jpg",
      photo2Url: null,
      photo2Key: null,
      photoExtras: [],
    });

    const caller = salesRouter.createCaller(createAdminContext());

    await caller.update({
      id: 17,
      extraPhotos: [
        {
          base64: Buffer.from("extra-photo").toString("base64"),
          mime: "image/jpeg",
          name: "Foto extra",
        },
      ],
    });

    expect(mocks.updateSale).toHaveBeenCalledWith(
      17,
      expect.objectContaining({
        photoExtras: [
          expect.objectContaining({
            id: "fixed-id",
            key: "fotos/7/fixed-id.jpg",
            name: "Foto extra",
          }),
        ],
      })
    );
  });

  it("veta vendedor de chamar sales.update (adminProcedure)", async () => {
    const caller = salesRouter.createCaller(createSellerContext());

    await expect(
      caller.update({
        id: 18,
        extraPhotos: [
          {
            base64: Buffer.from("tentativa-vendedor").toString("base64"),
            mime: "image/jpeg",
            name: "foto-extra-vendedor.jpg",
          },
        ],
      })
    ).rejects.toThrow();

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateSale).not.toHaveBeenCalled();
    expect(mocks.getSaleById).not.toHaveBeenCalled();
  });
});
