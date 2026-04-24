import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  capturedWhere: null as unknown,
}));

function createDbMock() {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn((arg: unknown) => {
          mocks.capturedWhere = arg;
          return Promise.resolve([]);
        }),
      })),
    })),
  };
}

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: mocks.getDb,
  };
});

const { appRouter } = await import("./routers");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(
  role: "user" | "admin" | "consultora" = "consultora",
  id = 42
): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `user-${id}`,
    email: `user${id}@test.com`,
    name: `Test User ${id}`,
    loginMethod: "manus",
    role,
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

// Caminha o AST SQL do Drizzle coletando os nomes das colunas referenciadas
// e os valores literais usados como parâmetros. Assim podemos verificar que
// o WHERE incluiu os filtros esperados sem depender de um driver real.
function collectSqlRefs(node: unknown): {
  columns: Set<string>;
  params: unknown[];
} {
  const columns = new Set<string>();
  const params: unknown[] = [];

  const visit = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    const anyN = n as {
      name?: string;
      value?: unknown;
      queryChunks?: unknown[];
      constructor?: { name?: string };
    };
    const ctorName = anyN.constructor?.name ?? "";
    if (ctorName.startsWith("Pg") && typeof anyN.name === "string") {
      columns.add(anyN.name);
    }
    if (ctorName === "Param" && "value" in anyN) {
      params.push(anyN.value);
    }
    if (Array.isArray(anyN.queryChunks)) {
      for (const c of anyN.queryChunks) visit(c);
    }
  };
  visit(node);
  return { columns, params };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.capturedWhere = null;
  mocks.getDb.mockResolvedValue(createDbMock());
});

describe("consultora.markWritten — invariantes do WHERE", () => {
  it("filtra por id, workStatus='para_escrever', exclui Consulta Cartas e lixeira", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await caller.consultora.markWritten({ id: 123 });

    const refs = collectSqlRefs(mocks.capturedWhere);
    expect(refs.columns).toContain("id");
    expect(refs.columns).toContain("workStatus");
    expect(refs.columns).toContain("productName");
    expect(refs.columns).toContain("deletedAt");
    expect(refs.params).toContain(123);
    expect(refs.params).toContain("para_escrever");
    expect(refs.params).toContain("Consulta Cartas");
  });
});

describe("consultora.markDone — invariantes do WHERE", () => {
  it("filtra por id, workStatus='pendente', exclui Consulta Cartas e lixeira", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await caller.consultora.markDone({ id: 321 });

    const refs = collectSqlRefs(mocks.capturedWhere);
    expect(refs.columns).toContain("id");
    expect(refs.columns).toContain("workStatus");
    expect(refs.columns).toContain("productName");
    expect(refs.columns).toContain("deletedAt");
    expect(refs.params).toContain(321);
    expect(refs.params).toContain("pendente");
    expect(refs.params).toContain("Consulta Cartas");
  });
});

describe("consultora.undoDone — invariantes do WHERE", () => {
  it("filtra por id, workStatus='feito', exclui Consulta Cartas e lixeira", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await caller.consultora.undoDone({ id: 777 });

    const refs = collectSqlRefs(mocks.capturedWhere);
    expect(refs.columns).toContain("id");
    expect(refs.columns).toContain("workStatus");
    expect(refs.columns).toContain("productName");
    expect(refs.columns).toContain("deletedAt");
    expect(refs.params).toContain(777);
    expect(refs.params).toContain("feito");
    expect(refs.params).toContain("Consulta Cartas");
  });

  it("admin também dispara o mesmo WHERE endurecido", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.consultora.undoDone({ id: 888 });

    const refs = collectSqlRefs(mocks.capturedWhere);
    expect(refs.columns).toContain("productName");
    expect(refs.columns).toContain("deletedAt");
  });
});
