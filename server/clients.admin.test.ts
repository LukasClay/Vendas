import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  update: vi.fn(),
  duplicates: vi.fn(),
}));

vi.mock("./clientAdmin", async () => {
  const actual =
    await vi.importActual<typeof import("./clientAdmin")>("./clientAdmin");
  return {
    ...actual,
    listAdminClients: mocks.list,
    getAdminClientDetail: mocks.detail,
    updateAdminClient: mocks.update,
    getDuplicateGroups: mocks.duplicates,
  };
});

const { appRouter } = await import("./routers");
const { ClientAdminConflictError, ClientAdminNotFoundError } = await import(
  "./clientAdmin"
);

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: 7,
    openId: "user-7",
    email: null,
    name: "Admin Test",
    loginMethod: "local",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    displayName: "Admin Test",
    phone: null,
    active: true,
  } as AuthenticatedUser;
}

function createContext(role: AuthenticatedUser["role"]): TrpcContext {
  return {
    user: createUser(role),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

const updateInput = {
  id: 3,
  fullName: "Maria",
  birthDate: "1990-05-20",
  phone: "11999998888",
  expectedUpdatedAt: "2026-07-22T12:00:00.000Z",
};

describe("clients admin procedures", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["user", "consultora"] as const)(
    "blocks %s from every administrative endpoint",
    async role => {
      const caller = appRouter.createCaller(createContext(role));

      await expect(caller.clients.adminList()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(caller.clients.adminDetail({ id: 3 })).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      await expect(
        caller.clients.adminUpdate(updateInput)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.clients.duplicateGroups()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(mocks.list).not.toHaveBeenCalled();
    }
  );

  it("forwards pagination, detail and duplicate reads for admin", async () => {
    mocks.list.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
      totalPages: 0,
    });
    mocks.detail.mockResolvedValue({});
    mocks.duplicates.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext("admin"));

    await caller.clients.adminList({ query: "Maria", page: 2, pageSize: 10 });
    await caller.clients.adminDetail({ id: 3 });
    await caller.clients.duplicateGroups();

    expect(mocks.list).toHaveBeenCalledWith({
      query: "Maria",
      page: 2,
      pageSize: 10,
    });
    expect(mocks.detail).toHaveBeenCalledWith(3);
    expect(mocks.duplicates).toHaveBeenCalledOnce();
  });

  it("passes audit context on canonical update", async () => {
    mocks.update.mockResolvedValue({ id: 3 });
    const caller = appRouter.createCaller(createContext("admin"));

    await caller.clients.adminUpdate(updateInput);

    expect(mocks.update).toHaveBeenCalledWith(updateInput, {
      userId: 7,
      userName: "Admin Test",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
  });

  it("maps optimistic conflicts and missing clients", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    mocks.update.mockRejectedValueOnce(new ClientAdminConflictError(3));

    await expect(caller.clients.adminUpdate(updateInput)).rejects.toMatchObject(
      { code: "CONFLICT" }
    );

    mocks.detail.mockRejectedValueOnce(new ClientAdminNotFoundError(3));
    await expect(caller.clients.adminDetail({ id: 3 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
