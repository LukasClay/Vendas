import { beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import {
  checkAdminActionRateLimit,
  resetAdminActionRateLimitForTest,
} from "./adminRateLimit";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(ipAddress = "127.0.0.1"): TrpcContext & {
  user: AuthenticatedUser;
} {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-1",
    email: "admin@test.com",
    name: "Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    ipAddress,
    userAgent: "vitest",
    req: {
      protocol: "https",
      headers: {},
      ip: ipAddress,
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("admin action rate limit", () => {
  beforeEach(() => {
    resetAdminActionRateLimitForTest();
  });

  it("bloqueia resetPassword depois do limite por admin e IP", () => {
    const ctx = createAdminContext();

    for (let i = 0; i < 5; i += 1) {
      expect(() => checkAdminActionRateLimit(ctx, "resetPassword")).not.toThrow();
    }

    expect(() =>
      checkAdminActionRateLimit(ctx, "resetPassword")
    ).toThrow("Muitas solicitações administrativas.");
  });

  it("mantem limites separados por acao", () => {
    const ctx = createAdminContext();

    for (let i = 0; i < 5; i += 1) {
      checkAdminActionRateLimit(ctx, "resetPassword");
    }

    expect(() =>
      checkAdminActionRateLimit(ctx, "sales.exportCsv")
    ).not.toThrow();
  });
});
