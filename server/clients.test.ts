import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: mocks.getDb,
  };
});

const { appRouter } = await import("./routers");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createUser(): AuthenticatedUser {
  return {
    id: 10,
    openId: "seller-10",
    email: "seller10@test.com",
    name: "Seller 10",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    displayName: "Seller 10",
    phone: null,
    active: true,
  };
}

function createDbMock(
  rows: Array<{
    id: number;
    fullName: string;
    birthDate: string | null;
    phone: string | null;
  }>
) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    db: { select },
    spies: { select, from, where, orderBy, limit },
  };
}

describe("clients.search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(
      caller.clients.search({ query: "Maria" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects searches shorter than two visible characters", async () => {
    const caller = appRouter.createCaller(createContext(createUser()));

    await expect(
      caller.clients.search({ query: "  M  " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns matching client data needed by autofill", async () => {
    const rows = [
      {
        id: 3,
        fullName: "Maria da Silva",
        birthDate: "1990-05-20",
        phone: "11999998888",
      },
    ];
    const database = createDbMock(rows);
    mocks.getDb.mockResolvedValue(database.db);
    const caller = appRouter.createCaller(createContext(createUser()));

    await expect(
      caller.clients.search({ query: "  Maria  " })
    ).resolves.toEqual(rows);

    expect(database.spies.select).toHaveBeenCalledOnce();
    expect(database.spies.where).toHaveBeenCalledOnce();
    expect(database.spies.orderBy).toHaveBeenCalledOnce();
    expect(database.spies.limit).toHaveBeenCalledWith(8);
  });

  it("reports database unavailability without leaking internals", async () => {
    const caller = appRouter.createCaller(createContext(createUser()));

    await expect(
      caller.clients.search({ query: "Maria" })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco de dados indispon\u00edvel.",
    });
  });
});
