import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getSalesPage: vi.fn(), getSales: vi.fn() }));
vi.mock("./db", async () => ({
  ...(await vi.importActual<typeof import("./db")>("./db")),
  ...mocks,
}));
const { salesRouter } = await import("./routers/sales");
function caller(role: "admin" | "user" | "consultora" | null = "admin") {
  return salesRouter.createCaller({
    user: role ? { id: 1, role } : null,
    req: { headers: {} },
    res: {},
  } as TrpcContext);
}
const row = {
  sale: {
    id: 1,
    clientName: "Teste",
    amount: "1.00",
    attachmentKey: "private-receipt",
    photo1Key: "private-photo",
    attachmentUrl: "/api/sandbox/media/receipt.png",
    photo1Url: "/api/sandbox/media/photo.png",
    photoExtras: [
      {
        id: "extra",
        key: "private-extra",
        url: "/api/sandbox/media/extra.png",
        mime: "image/png",
      },
    ],
  },
  seller: { id: 1, name: "Teste", displayName: "Teste" },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSalesPage.mockResolvedValue({
    items: [row],
    total: 2702,
    totalAmount: "457299.23",
  });
  mocks.getSales.mockResolvedValue([row]);
});

describe("Histórico ADM paginado", () => {
  for (const role of ["user", "consultora", null] as const) {
    it(`bloqueia página e exportação para ${role ?? "anônimo"}`, async () => {
      await expect(caller(role).pagedList({})).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(caller(role).exportRows({})).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(mocks.getSalesPage).not.toHaveBeenCalled();
      expect(mocks.getSales).not.toHaveBeenCalled();
    });
  }
  it("usa página de 50 e preserva totais fora da página sem expor chaves de mídia", async () => {
    const result = await caller().pagedList({});
    expect(mocks.getSalesPage).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 })
    );
    expect(result).toMatchObject({
      total: 2702,
      totalAmount: "457299.23",
      items: [{ sale: { id: 1 } }],
    });
    expect(JSON.stringify(result)).not.toContain("private-");
  });
  it("encaminha categoria, offset e demais filtros para a consulta completa", async () => {
    await caller().pagedList({
      startDate: "2026-01-01",
      endDate: "2026-09-30",
      sellerId: 17,
      productName: "Teste",
      category: "coletivo",
      offset: 250,
    });
    expect(mocks.getSalesPage).toHaveBeenCalledWith({
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-09-30"),
      sellerId: 17,
      productName: "Teste",
      category: "coletivo",
      limit: 50,
      offset: 250,
    });
  });
  for (const input of [
    { limit: 201 },
    { limit: 1.5 },
    { offset: -1 },
    { offset: 1.5 },
  ]) {
    it(`rejeita paginação inválida ${JSON.stringify(input)}`, async () => {
      await expect(caller().pagedList(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mocks.getSalesPage).not.toHaveBeenCalled();
    });
  }
  it("mantém o contrato anterior de sales.list", async () => {
    expect(await caller().list({ limit: 10 })).toBeInstanceOf(Array);
    expect(mocks.getSales).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 })
    );
  });
  it("exporta além da primeira página com os mesmos filtros e mídias sanitizadas", async () => {
    mocks.getSales.mockResolvedValue(
      Array.from({ length: 250 }, (_, id) => ({
        ...row,
        sale: { ...row.sale, id },
      }))
    );
    const result = await caller().exportRows({
      category: "individual",
      sellerId: 17,
    });
    expect(result).toHaveLength(250);
    expect(mocks.getSales).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "individual",
        sellerId: 17,
        limit: 5001,
        offset: 0,
      })
    );
    expect(JSON.stringify(result)).not.toContain("private-");
  });
  it("permite exatamente 5.000 registros e recusa 5.001 sem truncar", async () => {
    mocks.getSales.mockResolvedValue(Array(5000).fill(row));
    expect(await caller().exportRows({})).toHaveLength(5000);
    mocks.getSales.mockResolvedValue(Array(5001).fill(row));
    await expect(caller().exportRows({})).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
  it("preserva resposta vazia na exportação", async () => {
    mocks.getSales.mockResolvedValue([]);
    expect(await caller().exportRows({})).toEqual([]);
  });
});
