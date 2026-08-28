import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import {
  getHiddenAuditLogActions,
  isSuperAdminUser,
  securityRouter,
  SUPER_ADMIN_MAINTENANCE_ACTIONS,
} from "./routers/security";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const originalSuperAdminUserId = process.env.SUPER_ADMIN_USER_ID;
const originalOwnerOpenId = process.env.OWNER_OPEN_ID;

function createAdminContext(id: number, openId = `admin-${id}`): TrpcContext {
  const user = {
    id,
    openId,
    email: `admin${id}@test.com`,
    name: `Admin ${id}`,
    loginMethod: "local",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    displayName: `Admin ${id}`,
    active: true,
  } as AuthenticatedUser;

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

beforeEach(() => {
  delete process.env.SUPER_ADMIN_USER_ID;
  delete process.env.OWNER_OPEN_ID;
});

afterAll(() => {
  if (originalSuperAdminUserId === undefined) {
    delete process.env.SUPER_ADMIN_USER_ID;
  } else {
    process.env.SUPER_ADMIN_USER_ID = originalSuperAdminUserId;
  }

  if (originalOwnerOpenId === undefined) {
    delete process.env.OWNER_OPEN_ID;
  } else {
    process.env.OWNER_OPEN_ID = originalOwnerOpenId;
  }
});

describe("Super ADM", () => {
  it("autoriza exclusivamente o ID configurado", async () => {
    process.env.SUPER_ADMIN_USER_ID = "7";

    const authorized = securityRouter.createCaller(createAdminContext(7));
    const unauthorized = securityRouter.createCaller(createAdminContext(8));

    await expect(authorized.getSuperAdminAccess()).resolves.toEqual({
      granted: true,
    });
    await expect(unauthorized.getSuperAdminAccess()).rejects.toThrow(
      "Acesso exclusivo do Super ADM."
    );
  });

  it("usa OWNER_OPEN_ID quando não há ID específico configurado", () => {
    process.env.OWNER_OPEN_ID = "owner-account";

    expect(isSuperAdminUser(createAdminContext(3, "owner-account").user!)).toBe(
      true
    );
    expect(isSuperAdminUser(createAdminContext(3, "other-account").user!)).toBe(
      false
    );
  });

  it("faz SUPER_ADMIN_USER_ID prevalecer sobre OWNER_OPEN_ID", () => {
    process.env.SUPER_ADMIN_USER_ID = "7";
    process.env.OWNER_OPEN_ID = "owner-account";

    expect(isSuperAdminUser(createAdminContext(8, "owner-account").user!)).toBe(
      false
    );
  });

  it("oculta registros de manutenção dos demais administradores", () => {
    process.env.SUPER_ADMIN_USER_ID = "7";

    expect(getHiddenAuditLogActions(createAdminContext(8).user!)).toEqual([
      ...SUPER_ADMIN_MAINTENANCE_ACTIONS,
    ]);
    expect(getHiddenAuditLogActions(createAdminContext(7).user!)).toEqual([]);
  });

  it("bloqueia mutações de qualquer outro administrador antes do banco", async () => {
    process.env.SUPER_ADMIN_USER_ID = "7";
    const unauthorized = securityRouter.createCaller(createAdminContext(8));

    await expect(
      unauthorized.deleteAuditLog({ id: 1, masterPassword: "qualquer" })
    ).rejects.toThrow("Acesso exclusivo do Super ADM.");
  });
});
