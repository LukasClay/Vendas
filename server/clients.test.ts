import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  searchAccessibleClients: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: mocks.getDb,
  };
});

vi.mock("./clientAccess", async () => {
  const actual =
    await vi.importActual<typeof import("./clientAccess")>("./clientAccess");
  return {
    ...actual,
    searchAccessibleClients: mocks.searchAccessibleClients,
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

describe("clients.search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
    mocks.searchAccessibleClients.mockResolvedValue([]);
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
    const database = { select: vi.fn() };
    mocks.getDb.mockResolvedValue(database);
    mocks.searchAccessibleClients.mockResolvedValue(rows);
    const caller = appRouter.createCaller(createContext(createUser()));

    await expect(
      caller.clients.search({ query: "  Maria  " })
    ).resolves.toEqual(rows);

    expect(mocks.searchAccessibleClients).toHaveBeenCalledWith(
      database,
      { id: 10, role: "user" },
      "Maria"
    );
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
