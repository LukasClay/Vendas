import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  withRetry: vi.fn(),
  notifyOwner: vi.fn(),
  queryResults: [] as unknown[],
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
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(nextQueryResult())),
        returning: vi.fn(() => Promise.resolve(nextQueryResult())),
      })),
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

function createContext(role: "user" | "admin" | "consultora" = "user", id = 1): TrpcContext {
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
  mocks.withRetry.mockImplementation(async (fn: () => Promise<unknown>) => await fn());
  mocks.notifyOwner.mockResolvedValue(undefined);
});

describe("consultationSlots.listPending (permissÃ£o)", () => {
  it("permite acesso para admin", async () => {
    mocks.queryResults.push([
      { sold: true, status: "pendente", consultationDate: "2099-01-01", consultationTime: "10:00" },
    ]);

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.consultationSlots.listPending();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("permite acesso para consultora", async () => {
    mocks.queryResults.push([
      { sold: true, status: "pendente", consultationDate: "2099-01-01", consultationTime: "11:00" },
    ]);

    const caller = appRouter.createCaller(createContext("consultora"));
    const result = await caller.consultationSlots.listPending();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("bloqueia acesso para usuÃ¡rio comum", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultationSlots.listPending()).rejects.toThrow();
  });
});

describe("consultationSlots.listCancelled (permissÃ£o)", () => {
  it("permite acesso para admin", async () => {
    mocks.queryResults.push([
      { status: "cancelada", consultationDate: "2099-01-01", consultationTime: "10:00" },
    ]);

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.consultationSlots.listCancelled();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("permite acesso para consultora", async () => {
    mocks.queryResults.push([
      { status: "cancelada", consultationDate: "2099-01-01", consultationTime: "11:00" },
    ]);

    const caller = appRouter.createCaller(createContext("consultora"));
    const result = await caller.consultationSlots.listCancelled();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("bloqueia acesso para usuÃ¡rio comum", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultationSlots.listCancelled()).rejects.toThrow();
  });
});

describe("consultationSlots.cancel (permissÃ£o)", () => {
  it("bloqueia usuÃ¡rio comum de cancelar", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultationSlots.cancel({ id: 9999 })).rejects.toThrow();
  });

  it("retorna NOT_FOUND para slot inexistente (admin)", async () => {
    mocks.queryResults.push([]);

    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.consultationSlots.cancel({ id: 9999 })).rejects.toThrow(
      /NOT_FOUND|nÃ£o encontrado/i,
    );
  });
});

describe("consultationSlots.restore (permissÃ£o)", () => {
  it("bloqueia consultora de restaurar", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await expect(caller.consultationSlots.restore({ id: 9999 })).rejects.toThrow(
      /FORBIDDEN|administradores/i,
    );
  });

  it("bloqueia usuÃ¡rio comum de restaurar", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultationSlots.restore({ id: 9999 })).rejects.toThrow();
  });

  it("retorna NOT_FOUND para slot inexistente (admin)", async () => {
    mocks.queryResults.push([]);

    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.consultationSlots.restore({ id: 9999 })).rejects.toThrow(
      /NOT_FOUND|nÃ£o encontrado/i,
    );
  });
});

describe("consultationSlots.deleteCancelled (permissÃ£o)", () => {
  it("bloqueia consultora de liberar horÃ¡rio cancelado", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await expect(caller.consultationSlots.deleteCancelled({ id: 9999 })).rejects.toThrow(
      /FORBIDDEN|administradores/i,
    );
  });

  it("bloqueia usuÃ¡rio comum de liberar horÃ¡rio cancelado", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultationSlots.deleteCancelled({ id: 9999 })).rejects.toThrow();
  });

  it("retorna NOT_FOUND para slot inexistente (admin)", async () => {
    mocks.queryResults.push([]);

    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.consultationSlots.deleteCancelled({ id: 9999 })).rejects.toThrow(
      /NOT_FOUND|nÃ£o encontrado/i,
    );
  });
});

describe("consultationSlots.listAvailable (pÃºblico)", () => {
  it("retorna lista de slots disponÃ­veis para qualquer usuÃ¡rio autenticado", async () => {
    mocks.queryResults.push([
      { sold: false, status: "pendente", consultationDate: "2099-01-01", consultationTime: "15:00" },
    ]);

    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.consultationSlots.listAvailable();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});
