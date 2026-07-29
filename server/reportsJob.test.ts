import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  isEmailConfigured: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("./email", () => ({
  isEmailConfigured: mocks.isEmailConfigured,
  sendEmail: mocks.sendEmail,
}));

const originalTimeZone = process.env.TZ;
process.env.TZ = "America/Sao_Paulo";

const { getScheduledReportIdempotencyKey, startReportsJob } = await import(
  "./jobs/reportsJob"
);

type Schedule = {
  id: number;
  frequency: "daily" | "weekly" | "monthly";
  recipientEmail: string;
  active: boolean;
  lastSentAt: Date | null;
};

function createDbMock(getSchedules: () => Schedule[]) {
  const updateBuilder: any = {
    set: vi.fn(() => updateBuilder),
    where: vi.fn(() => Promise.resolve()),
  };

  return {
    select: vi.fn((selection?: unknown) => {
      if (selection === undefined) {
        const schedulesBuilder: any = {
          from: vi.fn(() => schedulesBuilder),
          where: vi.fn(() => Promise.resolve(getSchedules())),
        };
        return schedulesBuilder;
      }

      const salesBuilder: any = {
        from: vi.fn(() => salesBuilder),
        where: vi.fn(() => salesBuilder),
        orderBy: vi.fn(() => Promise.resolve([])),
      };
      return salesBuilder;
    }),
    update: vi.fn(() => updateBuilder),
  };
}

const cleanups = new Set<() => void>();

function startForTest() {
  const cleanup = startReportsJob();
  cleanups.add(cleanup);
  return cleanup;
}

describe("reportsJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T10:00:00.000Z"));
    vi.clearAllMocks();
    mocks.isEmailConfigured.mockReturnValue(true);
    mocks.sendEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    for (const cleanup of cleanups) cleanup();
    cleanups.clear();
    vi.useRealTimers();
  });

  afterAll(() => {
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  });

  it("gera a mesma chave para a mesma ocorrencia civil de Sao Paulo", () => {
    expect(
      getScheduledReportIdempotencyKey(7, new Date("2026-07-29T03:00:00.000Z"))
    ).toBe(
      getScheduledReportIdempotencyKey(7, new Date("2026-07-30T02:59:59.999Z"))
    );
  });

  it("gera chaves diferentes para outra data ou outro agendamento", () => {
    const base = getScheduledReportIdempotencyKey(
      7,
      new Date("2026-07-29T12:00:00.000Z")
    );

    expect(
      getScheduledReportIdempotencyKey(8, new Date("2026-07-29T12:00:00.000Z"))
    ).not.toBe(base);
    expect(
      getScheduledReportIdempotencyKey(7, new Date("2026-07-30T12:00:00.000Z"))
    ).not.toBe(base);
  });

  it("encaminha ao email a chave do agendamento e da data civil", async () => {
    mocks.getDb.mockResolvedValue(
      createDbMock(() => [
        {
          id: 7,
          frequency: "daily",
          recipientEmail: "destinatario@example.com",
          active: true,
          lastSentAt: null,
        },
      ])
    );

    startForTest();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "scheduled-report/7/2026-07-29",
      })
    );
  });

  it("nao sobrepoe execucoes locais enquanto a anterior esta em andamento", async () => {
    let resolveSend: ((sent: boolean) => void) | undefined;
    mocks.sendEmail.mockReturnValue(
      new Promise<boolean>(resolve => {
        resolveSend = resolve;
      })
    );
    mocks.getDb.mockResolvedValue(
      createDbMock(() => [
        {
          id: 7,
          frequency: "daily",
          recipientEmail: "destinatario@example.com",
          active: true,
          lastSentAt: null,
        },
      ])
    );

    const cleanup = startForTest();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);

    cleanup();
    startForTest();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);

    resolveSend?.(true);
    await vi.advanceTimersByTimeAsync(0);
  });

  it("mantem um unico scheduler e limpa os timers de forma idempotente", async () => {
    mocks.getDb.mockResolvedValue(createDbMock(() => []));

    const cleanup = startForTest();
    const sameCleanup = startForTest();

    expect(sameCleanup).toBe(cleanup);
    expect(vi.getTimerCount()).toBe(2);

    cleanup();
    cleanup();

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
