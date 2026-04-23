import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendPushToRoles: vi.fn(),
}));

function createDbMock(rows: unknown[]) {
  const selectBuilder: any = {
    from: vi.fn(() => selectBuilder),
    where: vi.fn(() => Promise.resolve(rows)),
  };

  return {
    select: vi.fn(() => selectBuilder),
  };
}

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: mocks.getDb,
  };
});

vi.mock("./webpush", () => ({
  sendPushToRoles: mocks.sendPushToRoles,
}));

const { checkAndNotify } = await import("./jobs/alertsJob");

describe("alertsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignora Consulta Cartas mesmo se o filtro SQL falhar (defense-in-depth)", async () => {
    // O mock de drizzle não respeita o WHERE — o teste simula o cenário em que
    // o filtro SQL foi removido por engano e garante que o guard in-loop segura.
    mocks.getDb.mockResolvedValue(
      createDbMock([
        {
          id: 1,
          clientName: "Cliente Teste",
          productName: "Consulta Cartas",
          productCategory: "individual",
          saleDate: "2020-01-01",
          workStatus: "pendente",
        },
      ])
    );

    await checkAndNotify();

    expect(mocks.sendPushToRoles).not.toHaveBeenCalled();
  });

  it("dispara push quando há trabalho atrasado (caminho normal)", async () => {
    mocks.getDb.mockResolvedValue(
      createDbMock([
        {
          id: 2,
          clientName: "Cliente Atrasado",
          productName: "Trabalho Espiritual",
          productCategory: "individual",
          saleDate: "2020-01-01",
          workStatus: "pendente",
        },
      ])
    );

    await checkAndNotify();

    expect(mocks.sendPushToRoles).toHaveBeenCalledTimes(1);
    const [roles, payload] = mocks.sendPushToRoles.mock.calls[0];
    expect(roles).toEqual(["admin", "consultora"]);
    expect(payload.title).toMatch(/atrasado/);
    expect(payload.body).toContain("Cliente Atrasado");
  });

  it("não envia push quando não há trabalhos urgentes nem atrasados", async () => {
    mocks.getDb.mockResolvedValue(createDbMock([]));

    await checkAndNotify();

    expect(mocks.sendPushToRoles).not.toHaveBeenCalled();
  });
});
