import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

const authenticatedUser: AuthenticatedUser = {
  id: 17,
  openId: "internal-open-id",
  name: "Usuario Teste",
  email: "usuario@example.com",
  loginMethod: "password",
  role: "admin",
  displayName: "Nome interno",
  phone: "11999999999",
  active: true,
  deletedAt: null,
  username: "usuario",
  passwordHash: "hash-que-nao-pode-sair",
  createdAt: new Date("2026-07-01T12:00:00.000Z"),
  updatedAt: new Date("2026-07-02T12:00:00.000Z"),
  lastSignedIn: new Date("2026-07-03T12:00:00.000Z"),
  sessionVersion: 9,
  monthlyGoal: "1000.00",
};

describe("auth.me public contract", () => {
  it("returns null for an anonymous request", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.auth.me()).resolves.toBeNull();
  });

  it("exposes only fields required by the authenticated frontend", async () => {
    const caller = appRouter.createCaller(createContext(authenticatedUser));

    const result = await caller.auth.me();

    expect(result).toEqual({
      role: "admin",
      name: "Usuario Teste",
      email: "usuario@example.com",
      username: "usuario",
    });
    expect(Object.keys(result ?? {}).sort()).toEqual(
      ["email", "name", "role", "username"].sort()
    );
  });

  it("preserves nullable public identity fields", async () => {
    const caller = appRouter.createCaller(
      createContext({
        ...authenticatedUser,
        name: null,
        email: null,
        username: null,
      })
    );

    await expect(caller.auth.me()).resolves.toEqual({
      role: "admin",
      name: null,
      email: null,
      username: null,
    });
  });
});
