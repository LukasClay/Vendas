import crypto from "crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const TEST_MASTER_PASSWORD = "s05-characterization-only";
const TEST_MASTER_PASSWORD_HASH = crypto
  .createHash("sha256")
  .update(TEST_MASTER_PASSWORD)
  .digest("hex");
const originalMasterPasswordHash = process.env.MASTER_PASSWORD_HASH;

process.env.MASTER_PASSWORD_HASH = TEST_MASTER_PASSWORD_HASH;

afterAll(() => {
  if (originalMasterPasswordHash === undefined) {
    delete process.env.MASTER_PASSWORD_HASH;
  } else {
    process.env.MASTER_PASSWORD_HASH = originalMasterPasswordHash;
  }
});

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  sql: vi.fn(),
  createAuditLog: vi.fn(),
  deleteUserSession: vi.fn(),
  deleteUserSessionsByUser: vi.fn(),
  getAllUserSessions: vi.fn(),
  getAuditLogs: vi.fn(),
  getDb: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  calls: [] as string[],
  sessionVersionIncrement: { testKind: "session-version-increment" },
  userIdPredicate: { testKind: "user-id-predicate" },
}));

vi.mock("./db", () => ({
  createAuditLog: mocks.createAuditLog,
  deleteUserSession: mocks.deleteUserSession,
  deleteUserSessionsByUser: mocks.deleteUserSessionsByUser,
  getAllUserSessions: mocks.getAllUserSessions,
  getAuditLogs: mocks.getAuditLogs,
  getDb: mocks.getDb,
}));

vi.mock("drizzle-orm", async importOriginal => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: mocks.eq,
    sql: mocks.sql,
  };
});

const { users } = await import("../drizzle/schema");
const { securityRouter } = await import("./routers/security");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(
  role: AuthenticatedUser["role"] | null,
  id = 7
): TrpcContext {
  const user = role
    ? ({
        id,
        openId: `user-${id}`,
        email: `user${id}@test.invalid`,
        name: "Admin Test",
        displayName: "Admin Test",
        username: `user_${id}`,
        loginMethod: "local",
        role,
        active: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
      } as AuthenticatedUser)
    : null;

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

function expectNoDisconnectEffects() {
  expect(mocks.getAllUserSessions).not.toHaveBeenCalled();
  expect(mocks.getDb).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.deleteUserSession).not.toHaveBeenCalled();
  expect(mocks.deleteUserSessionsByUser).not.toHaveBeenCalled();
  expect(mocks.createAuditLog).not.toHaveBeenCalled();
}

function expectSessionVersionIncrement(userId: number) {
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(mocks.update).toHaveBeenCalledWith(users);
  expect(mocks.sql).toHaveBeenCalledOnce();

  const [queryParts, versionColumn] = mocks.sql.mock.calls[0]!;
  expect(Array.from(queryParts as readonly string[])).toEqual(["", " + 1"]);
  expect(versionColumn).toBe(users.sessionVersion);
  expect(mocks.set).toHaveBeenCalledWith({
    sessionVersion: mocks.sessionVersionIncrement,
  });
  expect(mocks.eq).toHaveBeenCalledOnce();
  expect(mocks.eq).toHaveBeenCalledWith(users.id, userId);
  expect(mocks.where).toHaveBeenCalledWith(mocks.userIdPredicate);
}

function expectNoMasterCredentialInAuditLog() {
  const serializedAuditCalls = JSON.stringify(mocks.createAuditLog.mock.calls);

  expect(serializedAuditCalls).not.toContain(TEST_MASTER_PASSWORD);
  expect(serializedAuditCalls).not.toContain(TEST_MASTER_PASSWORD_HASH);
}

describe("security disconnect current behavior characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;

    mocks.getAllUserSessions.mockResolvedValue([]);
    mocks.getAuditLogs.mockResolvedValue([]);
    mocks.getDb.mockResolvedValue({ update: mocks.update });

    mocks.eq.mockReturnValue(mocks.userIdPredicate);
    mocks.sql.mockReturnValue(mocks.sessionVersionIncrement);
    mocks.update.mockImplementation(() => {
      mocks.calls.push("update");
      return { set: mocks.set };
    });
    mocks.set.mockImplementation(() => {
      mocks.calls.push("set");
      return { where: mocks.where };
    });
    mocks.where.mockImplementation(async () => {
      mocks.calls.push("where");
    });
    mocks.deleteUserSession.mockImplementation(async () => {
      mocks.calls.push("delete-session");
    });
    mocks.deleteUserSessionsByUser.mockImplementation(async () => {
      mocks.calls.push("delete-user-sessions");
    });
    mocks.createAuditLog.mockImplementation(async () => {
      mocks.calls.push("audit");
    });
  });

  it.each([
    ["anonymous", null],
    ["non-admin", "user"],
  ] as const)(
    "currently blocks %s callers before any effect",
    async (_, role) => {
      const caller = securityRouter.createCaller(createContext(role));

      await expect(
        caller.disconnectSession({
          sessionId: 55,
          masterPassword: TEST_MASTER_PASSWORD,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.disconnectUser({
          userId: 42,
          masterPassword: TEST_MASTER_PASSWORD,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expectNoDisconnectEffects();
    }
  );

  it("currently rejects a wrong master password before any effect", async () => {
    const caller = securityRouter.createCaller(createContext("admin"));

    await expect(
      caller.disconnectSession({ sessionId: 55, masterPassword: "incorrect" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.disconnectUser({ userId: 42, masterPassword: "incorrect" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expectNoDisconnectEffects();
  });

  it("currently requests a global session-version increment for the target user but deletes only the target row", async () => {
    mocks.getAllUserSessions.mockResolvedValue([
      { session: { id: 56, userId: 99 } },
      { session: { id: 55, userId: 42 } },
    ]);
    const caller = securityRouter.createCaller(createContext("admin"));

    await expect(
      caller.disconnectSession({
        sessionId: 55,
        masterPassword: TEST_MASTER_PASSWORD,
      })
    ).resolves.toEqual({ success: true });

    expect(mocks.getDb).toHaveBeenCalledOnce();
    expectSessionVersionIncrement(42);
    expect(mocks.deleteUserSession).toHaveBeenCalledOnce();
    expect(mocks.deleteUserSession).toHaveBeenCalledWith(55);
    expect(mocks.deleteUserSessionsByUser).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      userId: 7,
      userName: "Admin Test",
      action: "Desconectou Sessão",
      details: JSON.stringify({ sessionId: 55, targetUserId: 42 }),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expectNoMasterCredentialInAuditLog();
    expect(mocks.calls).toEqual([
      "update",
      "set",
      "where",
      "delete-session",
      "audit",
    ]);
  });

  it("currently reports success for an unknown session without incrementing a user version", async () => {
    const caller = securityRouter.createCaller(createContext("admin"));

    await expect(
      caller.disconnectSession({
        sessionId: 999,
        masterPassword: TEST_MASTER_PASSWORD,
      })
    ).resolves.toEqual({ success: true });

    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.deleteUserSession).toHaveBeenCalledOnce();
    expect(mocks.deleteUserSession).toHaveBeenCalledWith(999);
    expect(mocks.createAuditLog).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      action: "Desconectou Sessão",
      details: JSON.stringify({ sessionId: 999, targetUserId: null }),
      userId: 7,
      userName: "Admin Test",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expectNoMasterCredentialInAuditLog();
    expect(mocks.calls).toEqual(["delete-session", "audit"]);
  });

  it("currently requests a global session-version increment before deleting every recorded session", async () => {
    const caller = securityRouter.createCaller(createContext("admin"));

    await expect(
      caller.disconnectUser({
        userId: 42,
        masterPassword: TEST_MASTER_PASSWORD,
      })
    ).resolves.toEqual({ success: true });

    expect(mocks.getAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.getDb).toHaveBeenCalledOnce();
    expectSessionVersionIncrement(42);
    expect(mocks.deleteUserSessionsByUser).toHaveBeenCalledOnce();
    expect(mocks.deleteUserSessionsByUser).toHaveBeenCalledWith(42);
    expect(mocks.deleteUserSession).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      userId: 7,
      userName: "Admin Test",
      action: "Desconectou Usuário",
      details: JSON.stringify({ targetUserId: 42 }),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expectNoMasterCredentialInAuditLog();
    expect(mocks.calls).toEqual([
      "update",
      "set",
      "where",
      "delete-user-sessions",
      "audit",
    ]);
  });

  it.each(["session", "user"] as const)(
    "currently reports success for a %s disconnect when getDb returns null",
    async target => {
      mocks.getDb.mockResolvedValue(null);
      mocks.getAllUserSessions.mockResolvedValue([
        { session: { id: 55, userId: 42 } },
      ]);
      const caller = securityRouter.createCaller(createContext("admin"));

      const request =
        target === "session"
          ? caller.disconnectSession({
              sessionId: 55,
              masterPassword: TEST_MASTER_PASSWORD,
            })
          : caller.disconnectUser({
              userId: 42,
              masterPassword: TEST_MASTER_PASSWORD,
            });

      await expect(request).resolves.toEqual({ success: true });

      expect(mocks.getDb).toHaveBeenCalledOnce();
      expect(mocks.update).not.toHaveBeenCalled();
      if (target === "session") {
        expect(mocks.deleteUserSession).toHaveBeenCalledWith(55);
        expect(mocks.deleteUserSessionsByUser).not.toHaveBeenCalled();
      } else {
        expect(mocks.deleteUserSessionsByUser).toHaveBeenCalledWith(42);
        expect(mocks.deleteUserSession).not.toHaveBeenCalled();
      }
      expect(mocks.createAuditLog).toHaveBeenCalledOnce();
    }
  );

  it("currently reports success without confirming that a disconnectUser target exists", async () => {
    const caller = securityRouter.createCaller(createContext("admin"));

    await expect(
      caller.disconnectUser({
        userId: 999,
        masterPassword: TEST_MASTER_PASSWORD,
      })
    ).resolves.toEqual({ success: true });

    expect(mocks.getAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.deleteUserSessionsByUser).toHaveBeenCalledWith(999);
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      action: "Desconectou Usu\u00e1rio",
      details: JSON.stringify({ targetUserId: 999 }),
      userId: 7,
      userName: "Admin Test",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expectNoMasterCredentialInAuditLog();
  });

  it.each(["session", "user"] as const)(
    "currently stops a %s disconnect when the version-update call rejects",
    async target => {
      mocks.where.mockImplementationOnce(async () => {
        mocks.calls.push("where");
        throw new Error("synthetic session-version update failure");
      });
      mocks.getAllUserSessions.mockResolvedValue([
        { session: { id: 56, userId: 99 } },
        { session: { id: 55, userId: 42 } },
      ]);
      const caller = securityRouter.createCaller(createContext("admin"));

      const request =
        target === "session"
          ? caller.disconnectSession({
              sessionId: 55,
              masterPassword: TEST_MASTER_PASSWORD,
            })
          : caller.disconnectUser({
              userId: 42,
              masterPassword: TEST_MASTER_PASSWORD,
            });

      await expect(request).rejects.toThrow(
        "synthetic session-version update failure"
      );

      expect(mocks.getDb).toHaveBeenCalledOnce();
      expectSessionVersionIncrement(42);
      expect(mocks.deleteUserSession).not.toHaveBeenCalled();
      expect(mocks.deleteUserSessionsByUser).not.toHaveBeenCalled();
      expect(mocks.createAuditLog).not.toHaveBeenCalled();
      expect(mocks.calls).toEqual(["update", "set", "where"]);
    }
  );

  it("currently surfaces a deletion failure after the version update call completed", async () => {
    mocks.deleteUserSessionsByUser.mockImplementationOnce(async () => {
      mocks.calls.push("delete-user-sessions");
      throw new Error("synthetic session deletion failure");
    });
    const caller = securityRouter.createCaller(createContext("admin"));

    await expect(
      caller.disconnectUser({
        userId: 42,
        masterPassword: TEST_MASTER_PASSWORD,
      })
    ).rejects.toThrow("synthetic session deletion failure");

    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.deleteUserSessionsByUser).toHaveBeenCalledOnce();
    expect(mocks.deleteUserSessionsByUser).toHaveBeenCalledWith(42);
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    expect(mocks.calls).toEqual([
      "update",
      "set",
      "where",
      "delete-user-sessions",
    ]);
  });

  it("currently surfaces an audit failure after update and deletion calls completed", async () => {
    mocks.createAuditLog.mockImplementationOnce(async () => {
      mocks.calls.push("audit");
      throw new Error("synthetic audit failure");
    });
    const caller = securityRouter.createCaller(createContext("admin"));

    await expect(
      caller.disconnectUser({
        userId: 42,
        masterPassword: TEST_MASTER_PASSWORD,
      })
    ).rejects.toThrow("synthetic audit failure");

    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.deleteUserSessionsByUser).toHaveBeenCalledWith(42);
    expect(mocks.createAuditLog).toHaveBeenCalledOnce();
    expect(mocks.calls).toEqual([
      "update",
      "set",
      "where",
      "delete-user-sessions",
      "audit",
    ]);
  });
});
