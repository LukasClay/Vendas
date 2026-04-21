import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.role).toBe("user");
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("products.list (public)", () => {
  it("allows any authenticated user to list active products", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    // Should not throw FORBIDDEN
    const result = await caller.products.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("products.listAll (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.products.listAll()).rejects.toThrow();
  });

  it("allows admin users to list all products", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.products.listAll();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("users.listAll (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.listAll()).rejects.toThrow();
  });

  it("allows admin users to list all users", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.listAll();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("sales.list (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.sales.list()).rejects.toThrow();
  });

  it("allows admin users to list all sales", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sales.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("reports.summary (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reports.summary()).rejects.toThrow();
  });

  it("allows admin users to get report summary", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.summary();
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("topSellers");
    expect(result).toHaveProperty("topClients");
    expect(result).toHaveProperty("topProducts");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      user: createContext().user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => cleared.push(name),
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBe(1);
  });
});

describe("consultora.updateSeller (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.consultora.updateSeller({
        saleId: 1,
        sellerId: 1,
        sellerName: "Test",
      })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN for consultora users", async () => {
    const ctxConsultora: TrpcContext = {
      user: { ...createContext("user").user!, role: "consultora" as any },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctxConsultora);
    await expect(
      caller.consultora.updateSeller({
        saleId: 1,
        sellerId: 1,
        sellerName: "Test",
      })
    ).rejects.toThrow();
  });
});

describe("consultora.listActiveSellers (admin only)", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultora.listActiveSellers()).rejects.toThrow();
  });

  it("allows admin to list active sellers", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.consultora.listActiveSellers();
    expect(Array.isArray(result)).toBe(true);
  });
});

// Endpoints de prazo/urgência: cobertura de contrato de autorização.
// O shape `SaleUrgency` (hasDeadline discriminado) já é coberto por
// `shared/businessDays.test.ts`; aqui validamos apenas que os endpoints
// rejeitam usuários comuns e aceitam consultora/admin.
async function expectPassesAuthorization(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    const code = (err as { code?: string }).code;
    expect(code).not.toBe("FORBIDDEN");
  }
}

describe("consultora.toWrite (consultora/admin only)", () => {
  it("throws FORBIDDEN for plain users", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultora.toWrite()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("passes authorization for consultora users", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await expectPassesAuthorization(caller.consultora.toWrite());
  });

  it("passes authorization for admin users", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expectPassesAuthorization(caller.consultora.toWrite());
  });
});

describe("consultora.pending (consultora/admin only)", () => {
  it("throws FORBIDDEN for plain users", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultora.pending()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("passes authorization for consultora users", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await expectPassesAuthorization(caller.consultora.pending());
  });
});

describe("consultora.alerts (consultora/admin only)", () => {
  it("throws FORBIDDEN for plain users", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultora.alerts()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("passes authorization for consultora users", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await expectPassesAuthorization(caller.consultora.alerts());
  });
});

describe("consultora.worksSummary (consultora/admin only)", () => {
  it("throws FORBIDDEN for plain users", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.consultora.worksSummary()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("passes authorization for consultora users", async () => {
    const caller = appRouter.createCaller(createContext("consultora"));
    await expectPassesAuthorization(caller.consultora.worksSummary());
  });
});
