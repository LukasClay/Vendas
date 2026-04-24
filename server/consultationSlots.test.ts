import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  withRetry: vi.fn(),
  notifyOwner: vi.fn(),
  queryResults: [] as unknown[],
  updateSets: [] as unknown[],
}));

function nextQueryResult() {
  return mocks.queryResults.shift() ?? [];
}

function createDbMock() {
  const selectBuilder: any = {
    from: vi.fn(() => selectBuilder),
    leftJoin: vi.fn(() => selectBuilder),
    where: vi.fn(() => selectBuilder),
    orderBy: vi.fn(() => Promise.resolve(nextQueryResult())),
    limit: vi.fn(() => Promise.resolve(nextQueryResult())),
  };

  return {
    select: vi.fn(() => selectBuilder),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        mocks.updateSets.push(values);
        return {
          where: vi.fn(() => Promise.resolve(nextQueryResult())),
          returning: vi.fn(() => Promise.resolve(nextQueryResult())),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(nextQueryResult())),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve(nextQueryResult())),
    })),
  };
}

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: mocks.getDb,
    withRetry: mocks.withRetry,
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: mocks.notifyOwner,
}));

const { appRouter } = await import("./routers");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(
  role: "user" | "admin" | "consultora" = "user",
  id = 1
): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `user-${id}`,
    email: `user${id}@test.com`,
    name: `Test User ${id}`,
    loginMethod: "manus",
    role: role as AuthenticatedUser["role"],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    displayName: `Display ${id}`,
    phone: null,
    active: true,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryResults.length = 0;
  mocks.getDb.mockResolvedValue(createDbMock());
  mocks.withRetry.mockImplementation(
    async (fn: () => Promise<unknown>) => await fn()
  );
  mocks.notifyOwner.mockResolvedValue(undefined);
  mocks.updateSets.length = 0;
});

async function expectNotFoundError(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    message: "Horário não encontrado.",
  });
}

describe("consultationSlots.listPending (permissão)", () => {
  it("permite acesso para admin", async () => {
    mocks.queryResults.push([
      {
        sold: true,
        status: "pendente",
        consultationDate: "2099-01-01",
        consultationTime: "10:00",
      },
    ]);

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.consultationSlots.listPending();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("permite acesso para consultora", async () => {
    mocks.queryResults.push([
      {
        sold: true,
        status: "pendente",
        consultationDate: "2099-01-01",
        consultationTime: "11:00",
      },
    ]);

    const caller = appRouter.createCaller(createContext("consultora"));
    const result = await caller.consultationSlots.listPending();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("bloqueia acesso para usuário comum", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultationSlots.listPending()).rejects.toThrow();
  });
});

describe("consultationSlots.listCancelled (permissão)", () => {
  it("permite acesso para admin", async () => {
    mocks.queryResults.push([
      {
        status: "cancelada",
        consultationDate: "2099-01-01",
        consultationTime: "10:00",
      },
    ]);

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.consultationSlots.listCancelled();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("permite acesso para consultora", async () => {
    mocks.queryResults.push([
      {
        status: "cancelada",
        consultationDate: "2099-01-01",
        consultationTime: "11:00",
      },
    ]);

    const caller = appRouter.createCaller(createContext("consultora"));
    const result = await caller.consultationSlots.listCancelled();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("bloqueia acesso para usuário comum", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultationSlots.listCancelled()).rejects.toThrow();
  });
});

describe("consultationSlots.cancel (permissão)", () => {
  it("bloqueia usuário comum de cancelar", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(
      caller.consultationSlots.cancel({ id: 9999 })
    ).rejects.toThrow();
  });

  it("retorna NOT_FOUND para slot inexistente (admin)", async () => {
    mocks.queryResults.push([]);

    const caller = appRouter.createCaller(createContext("admin"));
    await expectNotFoundError(caller.consultationSlots.cancel({ id: 9999 }));
  });
});

describe("consultationSlots.restore (permissão)", () => {
  it("bloqueia consultora de restaurar", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await expect(
      caller.consultationSlots.restore({ id: 9999 })
    ).rejects.toThrow(/FORBIDDEN|administradores/i);
  });

  it("bloqueia usuário comum de restaurar", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(
      caller.consultationSlots.restore({ id: 9999 })
    ).rejects.toThrow();
  });

  it("retorna NOT_FOUND para slot inexistente (admin)", async () => {
    mocks.queryResults.push([]);

    const caller = appRouter.createCaller(createContext("admin"));
    await expectNotFoundError(caller.consultationSlots.restore({ id: 9999 }));
  });
  it("restaura slot cancelado limpando cancelamento e reembolso", async () => {
    mocks.queryResults.push([
      {
        id: 10,
        saleId: 55,
        status: "cancelada",
        refundStatus: "pending",
      },
    ]);

    const caller = appRouter.createCaller(createContext("admin"));
    await caller.consultationSlots.restore({ id: 10 });

    expect(mocks.updateSets).toEqual(
      expect.arrayContaining([
        { deletedAt: null },
        expect.objectContaining({
          sold: true,
          saleId: 55,
          status: "pendente",
          cancelledBy: null,
          cancelledAt: null,
          cancelReason: null,
          refundStatus: "none",
          refundRequestedAt: null,
          refundRequestedBy: null,
          refundResolvedAt: null,
          refundResolvedBy: null,
        }),
      ])
    );
  });
});

describe("consultationSlots.approveRefund", () => {
  it("libera o slot aprovado para uso normal", async () => {
    mocks.queryResults.push([
      {
        id: 20,
        saleId: 77,
        refundStatus: "pending",
        status: "cancelada",
      },
    ]);

    const caller = appRouter.createCaller(createContext("admin"));
    await caller.consultationSlots.approveRefund({ id: 20 });

    expect(mocks.updateSets).toContainEqual(
      expect.objectContaining({
        sold: false,
        saleId: null,
        status: "pendente",
        cancelledBy: null,
        cancelledAt: null,
        cancelReason: null,
        refundStatus: "approved",
        refundResolvedBy: 1,
      })
    );
  });
});

describe("consultationSlots.rejectRefund", () => {
  it("restaura a venda e preserva historico de reembolso rejeitado", async () => {
    mocks.queryResults.push([
      {
        id: 21,
        saleId: 78,
        refundStatus: "pending",
        status: "cancelada",
      },
    ]);

    const caller = appRouter.createCaller(createContext("admin"));
    await caller.consultationSlots.rejectRefund({ id: 21 });

    expect(mocks.updateSets).toEqual(
      expect.arrayContaining([
        { deletedAt: null },
        expect.objectContaining({
          sold: true,
          saleId: 78,
          status: "pendente",
          cancelledBy: null,
          cancelledAt: null,
          cancelReason: null,
          refundStatus: "rejected",
          refundResolvedBy: 1,
        }),
      ])
    );
  });
});

describe("consultationSlots.deleteCancelled (permissão)", () => {
  it("bloqueia consultora de liberar horário cancelado", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await expect(
      caller.consultationSlots.deleteCancelled({ id: 9999 })
    ).rejects.toThrow(/FORBIDDEN|administradores/i);
  });

  it("bloqueia usuário comum de liberar horário cancelado", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(
      caller.consultationSlots.deleteCancelled({ id: 9999 })
    ).rejects.toThrow();
  });

  it("retorna NOT_FOUND para slot inexistente (admin)", async () => {
    mocks.queryResults.push([]);

    const caller = appRouter.createCaller(createContext("admin"));
    await expectNotFoundError(
      caller.consultationSlots.deleteCancelled({ id: 9999 })
    );
  });
});

describe("consultationSlots.listAvailable (público)", () => {
  it("retorna lista de slots disponíveis para qualquer usuário autenticado", async () => {
    mocks.queryResults.push([
      {
        sold: false,
        status: "pendente",
        consultationDate: "2099-01-01",
        consultationTime: "15:00",
      },
    ]);

    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.consultationSlots.listAvailable();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});
