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

  it("ignora Consulta Cartas nas notificações automáticas de atraso", async () => {
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
});
