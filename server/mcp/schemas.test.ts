import { describe, expect, it, vi } from "vitest";
import type { SalesInsightsRepository } from "../salesInsights/repository";
import { createSalesInsightsService } from "../salesInsights/service";
import {
  salesPerformanceOutputSchema,
  salesPerformanceToolInputSchema,
  salesSnapshotOutputSchema,
  salesSnapshotToolInputSchema,
} from "./schemas";

function repository(): SalesInsightsRepository {
  return {
    getSeller: vi.fn(async sellerId => ({
      id: sellerId,
      name: "Vendedor de teste",
      displayName: null,
      role: "user",
      monthlyGoal: "20000.00",
    })),
    getSnapshotAggregates: vi.fn(async () => ({
      month: { totalAmount: "10500.00", totalSales: 12 },
      today: { totalAmount: "500.00", totalSales: 1 },
      completed: { totalAmount: "10000.00", totalSales: 11 },
    })),
    getDailyAggregates: vi.fn(async () => [
      { date: "2026-08-24", totalAmount: "100.00", totalSales: 1 },
      { date: "2026-08-25", totalAmount: "500.00", totalSales: 1 },
    ]),
  };
}

const actor = {
  userId: 7,
  role: "user" as const,
  scopes: ["sales:read:self" as const],
};
const now = new Date("2026-08-25T13:00:00.000Z");

describe("MCP Sales Insights schemas", () => {
  it("accepts the current aggregate service outputs", async () => {
    const service = createSalesInsightsService(repository());
    const snapshot = await service.getSalesSnapshot(actor, {}, now);
    const performance = await service.getSalesPerformance(
      actor,
      { startDate: "2026-08-24", endDate: "2026-08-25" },
      now
    );

    expect(salesSnapshotOutputSchema.safeParse(snapshot).success).toBe(true);
    expect(salesPerformanceOutputSchema.safeParse(performance).success).toBe(
      true
    );
  });

  it("rejects seller selection and unexpected output fields", async () => {
    expect(
      salesSnapshotToolInputSchema.safeParse({ sellerId: 99 }).success
    ).toBe(false);
    expect(
      salesPerformanceToolInputSchema.safeParse({
        sellerId: 99,
        startDate: "2026-08-24",
        endDate: "2026-08-25",
      }).success
    ).toBe(false);

    const service = createSalesInsightsService(repository());
    const snapshot = await service.getSalesSnapshot(actor, {}, now);
    expect(
      salesSnapshotOutputSchema.safeParse({
        ...snapshot,
        clientName: "campo que nunca deve sair",
      }).success
    ).toBe(false);
    expect(
      salesSnapshotOutputSchema.safeParse({
        ...snapshot,
        seller: { ...snapshot.seller, email: "campo@bloqueado.test" },
      }).success
    ).toBe(false);
  });
});
