import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "user" | "admin" | "consultora" = "user", id = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `user-${id}`,
    email: `user${id}@test.com`,
    name: `Test User ${id}`,
    loginMethod: "manus",
    role: role as "user" | "admin",
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

// ─── Testes de permissão ──────────────────────────────────────────────────────

describe("consultationSlots.listPending (permissão)", () => {
  it("permite acesso para admin", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.consultationSlots.listPending();
    expect(Array.isArray(result)).toBe(true);
  });

  it("permite acesso para consultora", async () => {
    const ctx = createContext("consultora");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.consultationSlots.listPending();
    expect(Array.isArray(result)).toBe(true);
  });

  it("bloqueia acesso para usuário comum", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultationSlots.listPending()).rejects.toThrow();
  });
});

describe("consultationSlots.listCancelled (permissão)", () => {
  it("permite acesso para admin", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.consultationSlots.listCancelled();
    expect(Array.isArray(result)).toBe(true);
  });

  it("permite acesso para consultora", async () => {
    const ctx = createContext("consultora");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.consultationSlots.listCancelled();
    expect(Array.isArray(result)).toBe(true);
  });

  it("bloqueia acesso para usuário comum", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultationSlots.listCancelled()).rejects.toThrow();
  });
});

describe("consultationSlots.cancel (permissão)", () => {
  it("bloqueia usuário comum de cancelar", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultationSlots.cancel({ id: 9999 })).rejects.toThrow();
  });

  it("retorna NOT_FOUND para slot inexistente (admin)", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultationSlots.cancel({ id: 9999 })).rejects.toThrow(/NOT_FOUND|não encontrado/i);
  });
});

describe("consultationSlots.restore (permissão)", () => {
  it("bloqueia consultora de restaurar", async () => {
    const ctx = createContext("consultora");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultationSlots.restore({ id: 9999 })).rejects.toThrow(/FORBIDDEN|administradores/i);
  });

  it("bloqueia usuário comum de restaurar", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultationSlots.restore({ id: 9999 })).rejects.toThrow();
  });

  it("retorna NOT_FOUND para slot inexistente (admin)", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultationSlots.restore({ id: 9999 })).rejects.toThrow(/NOT_FOUND|não encontrado/i);
  });
});

describe("consultationSlots.listAvailable (público)", () => {
  it("retorna lista de slots disponíveis para qualquer usuário autenticado", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.consultationSlots.listAvailable();
    expect(Array.isArray(result)).toBe(true);
  });
});
