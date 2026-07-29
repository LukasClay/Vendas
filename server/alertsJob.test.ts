import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const { checkAndNotify, startAlertsJob } = await import("./jobs/alertsJob");

describe("alertsJob", () => {
  let cleanups: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanups.forEach(cleanup => cleanup());
    cleanups = [];
    vi.useRealTimers();
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

  it("inicializa somente um loop por processo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 7, 0, 0));

    const firstCleanup = startAlertsJob();
    const secondCleanup = startAlertsJob();
    cleanups.push(firstCleanup, secondCleanup);

    expect(secondCleanup).toBe(firstCleanup);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("retorna cleanup idempotente que cancela o timer pendente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 7, 0, 0));

    const cleanup = startAlertsJob();
    cleanups.push(cleanup);
    expect(vi.getTimerCount()).toBe(1);

    cleanup();
    cleanup();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("não reagenda depois do cleanup durante uma execução", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 7, 59, 59));

    let resolveRows!: (rows: unknown[]) => void;
    const rowsPromise = new Promise<unknown[]>(resolve => {
      resolveRows = resolve;
    });
    const selectBuilder: any = {
      from: vi.fn(() => selectBuilder),
      where: vi.fn(() => rowsPromise),
    };
    const dbMock = {
      select: vi.fn(() => selectBuilder),
    };
    mocks.getDb.mockResolvedValue(dbMock);

    const cleanup = startAlertsJob();
    cleanups.push(cleanup);

    vi.advanceTimersByTime(1_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(dbMock.select).toHaveBeenCalledTimes(1);

    cleanup();
    resolveRows([]);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.getTimerCount()).toBe(0);
  });
});
