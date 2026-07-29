import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getSales: vi.fn(),
  getDeletedSales: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getSales: mocks.getSales,
    getDeletedSales: mocks.getDeletedSales,
  };
});

const { reportsRouter } = await import("./routers/reports");
const { salesRouter } = await import("./routers/sales");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const adminUser: AuthenticatedUser = {
  id: 1,
  openId: "admin-open-id",
  name: "Admin",
  email: "admin@example.com",
  loginMethod: "password",
  role: "admin",
  displayName: "Admin",
  phone: null,
  active: true,
  deletedAt: null,
  username: "admin",
  passwordHash: "internal-hash",
  createdAt: new Date("2026-07-01T12:00:00.000Z"),
  updatedAt: new Date("2026-07-01T12:00:00.000Z"),
  lastSignedIn: new Date("2026-07-01T12:00:00.000Z"),
  sessionVersion: 3,
  monthlyGoal: null,
};

function createContext(): TrpcContext {
  return {
    user: adminUser,
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

function createSensitiveSale() {
  return {
    id: 42,
    clientName: "Cliente",
    attachmentUrl: "https://cdn.example.com/main-proof.pdf",
    attachmentKey: "r2/private/main-proof.pdf",
    attachmentMime: "application/pdf",
    attachmentExtras: [
      {
        id: "proof-extra",
        url: "https://cdn.example.com/extra-proof.pdf",
        key: "r2/private/extra-proof.pdf",
        mime: "application/pdf",
        name: "Comprovante extra",
      },
    ],
    photo1Url: "https://cdn.example.com/photo-1.jpg",
    photo1Key: "r2/private/photo-1.jpg",
    photo2Url: "https://cdn.example.com/photo-2.jpg",
    photo2Key: "r2/private/photo-2.jpg",
    photoExtras: [
      {
        id: "photo-extra",
        url: "https://cdn.example.com/photo-extra.jpg",
        key: "r2/private/photo-extra.jpg",
        mime: "image/jpeg",
      },
    ],
  };
}

function expectSanitizedSale(sale: Record<string, unknown>) {
  expect(sale).not.toHaveProperty("attachmentKey");
  expect(sale).not.toHaveProperty("photo1Key");
  expect(sale).not.toHaveProperty("photo2Key");
  expect(sale).not.toHaveProperty("attachmentExtras");
  expect(sale).not.toHaveProperty("photoExtras");

  expect(sale.attachments).toEqual([
    {
      id: "legacy-attachment",
      url: "https://cdn.example.com/main-proof.pdf",
      mime: "application/pdf",
      name: "Comprovante principal",
      isLegacy: true,
    },
    {
      id: "proof-extra",
      url: "https://cdn.example.com/extra-proof.pdf",
      mime: "application/pdf",
      name: "Comprovante extra",
      isLegacy: false,
    },
  ]);
  expect(sale.clientPhotos).toEqual([
    {
      id: "1",
      url: "https://cdn.example.com/photo-1.jpg",
      mime: null,
      isLegacy: true,
    },
    {
      id: "2",
      url: "https://cdn.example.com/photo-2.jpg",
      mime: null,
      isLegacy: true,
    },
    {
      id: "photo-extra",
      url: "https://cdn.example.com/photo-extra.jpg",
      mime: "image/jpeg",
      isLegacy: false,
    },
  ]);
  expect(JSON.stringify(sale)).not.toContain("r2/private/");
}

describe("public sale media contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizes media keys from reports.exportData without changing its wrapper", async () => {
    const seller = {
      id: 7,
      name: "Vendedor",
      displayName: "Vendedor",
    };
    mocks.getSales.mockResolvedValue([{ sale: createSensitiveSale(), seller }]);
    const caller = reportsRouter.createCaller(createContext());

    const result = await caller.exportData({});

    expect(result).toHaveLength(1);
    expect(result[0]?.seller).toEqual(seller);
    expectSanitizedSale(result[0]?.sale as Record<string, unknown>);
  });

  it("sanitizes media keys from sales.listDeleted without changing its wrapper", async () => {
    mocks.getDeletedSales.mockResolvedValue([
      {
        sale: {
          ...createSensitiveSale(),
          deletedAt: new Date("2026-07-15T12:00:00.000Z"),
        },
        sellerName: "Vendedor",
        sellerDisplayName: "Vendedor",
      },
    ]);
    const caller = salesRouter.createCaller(createContext());

    const result = await caller.listDeleted();

    expect(result).toHaveLength(1);
    expect(result[0]?.sellerName).toBe("Vendedor");
    expect(result[0]?.sellerDisplayName).toBe("Vendedor");
    expectSanitizedSale(result[0]?.sale as Record<string, unknown>);
  });
});
